/**
 * Scheibe 040b — Stammdaten und Bühnenplätze over HTTP (docs/slices/040b-stammdaten-buehnenplaetze.md,
 * Tests 15 and 16, plus the contract half of Test 6). Every response goes through `req()`, which checks
 * status, body and headers against `packages/contract/openapi.yaml` and records the operation as
 * exercised for the coverage gate (`operation-coverage.setup.ts`).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import { createInMemoryEventStore, createInProcessApi, ROLE_PERMISSIONS, SYSTEM_ACTOR, type DomainEvent, type NewEvent, type Role } from '@hv/domain';
import { actorIdForIdentity } from '../auth/oidc.ts';
import type { AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { createApp } from '../app.ts';
import { allOperationIds, openapiDoc } from '../contractSchema.ts';
import { ACTOR, req } from './helpers.ts';

const allowlist = JSON.parse(readFileSync(join(dirname(createRequire(import.meta.url).resolve('@hv/contract/openapi.yaml')), 'allowlist.json'), 'utf8')) as { operationId: string }[];

const at = '2027-04-20T10:00:00.000Z';
const OPERATIONS = ['replaceMeetingAgendaItems', 'replaceMeetingUnits', 'listMeetingStageSeats', 'replaceMeetingStageSeats'] as const;

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(openapiDoc, 'openapi');
const validators = new Map<string, ValidateFunction>();
function validSchema(name: string, value: unknown): boolean {
  let validate = validators.get(name);
  if (validate === undefined) {
    validate = ajv.compile({ $ref: `openapi#/components/schemas/${name}` });
    validators.set(name, validate);
  }
  return validate(value);
}

function meetingEvents(): NewEvent[] {
  const actor = SYSTEM_ACTOR;
  return [
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [{ id: 'top-1', number: 1, title: 'Aussprache' }],
        units: [{ id: 'unit-a', name: 'Fachbereich A' }], stageSeats: [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1 }] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} } as unknown as NewEvent,
  ] as NewEvent[];
}
function closed(id: string): NewEvent {
  return { id: `close-${id}`, type: 'MeetingClosed', at, actor: SYSTEM_ACTOR, subjectId: id, meetingId: id, payload: {} } as unknown as NewEvent;
}
function demoApp(extra: NewEvent[] = []) {
  const source = createInMemoryEventStore();
  source.append([...meetingEvents(), ...extra]);
  let events: readonly DomainEvent[] = [...source.all()];
  const app = createApp({ demoEnabled: true, persistence: { load: () => [...events], save: (next) => { events = [...next]; } } });
  return { app, count: () => events.length, events: () => events };
}

describe('Scheibe 040b: master data over HTTP (Test 15)', () => {
  it('serves the four operations: 200 with the new version as ETag, 412, 422 at maxItems + 1, 403 with ruleId, 404', async () => {
    const { app, count, events } = demoApp();
    const meeting = await (await req(app, 'GET', '/v1/meetings/hv-2027', { actor: ACTOR.admin })).json() as { version: number };

    const agenda = await req(app, 'PUT', '/v1/meetings/hv-2027/agenda-items', { actor: ACTOR.admin,
      body: [{ id: 'top-1', number: 1, title: 'Aussprache' }, { number: 2, title: 'Neu' }] });
    expect(agenda.status).toBe(200);
    expect(agenda.headers.get('ETag')).toBe(`"v${meeting.version + 1}"`);
    expect((await agenda.json() as { number: number }[]).map((item) => item.number)).toEqual([1, 2]);

    const units = await req(app, 'PUT', '/v1/meetings/hv-2027/units', { actor: ACTOR.admin,
      headers: { 'If-Match': `"v${meeting.version + 1}"` }, body: [{ id: 'unit-a', name: 'Fachbereich A' }, { name: 'B', shortName: 'B' }] });
    expect(units.status).toBe(200);
    expect(units.headers.get('ETag')).toBe(`"v${meeting.version + 2}"`);

    const seatsPut = await req(app, 'PUT', '/v1/meetings/hv-2027/stage-seats', { actor: ACTOR.admin,
      body: [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-ceo', deviceId: 'dev-1' }] });
    expect(seatsPut.status).toBe(200);
    expect(seatsPut.headers.get('ETag')).toBe(`"v${meeting.version + 3}"`);
    expect(await seatsPut.json()).toEqual([{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-ceo', deviceId: 'dev-1' }]);
    const stored = events().at(-1)!;
    expect(stored).toMatchObject({ type: 'StageSeatsReplaced', subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { stageSeats: [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-ceo', deviceId: 'dev-1' }] } });
    expect(validSchema('Event', stored)).toBe(true);

    const full = await req(app, 'GET', '/v1/meetings/hv-2027/stage-seats', { actor: ACTOR.admin });
    expect(full.status).toBe(200);
    expect(await full.json()).toEqual([{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-ceo', deviceId: 'dev-1' }]);
    const masked = await req(app, 'GET', '/v1/meetings/hv-2027/stage-seats', { actor: ACTOR.observer });
    expect(masked.status).toBe(200);
    expect(await masked.json()).toEqual([{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1 }]);

    const before = count();
    const stale = await req(app, 'PUT', '/v1/meetings/hv-2027/units', { actor: ACTOR.admin,
      headers: { 'If-Match': `"v${meeting.version}"` }, body: [{ id: 'unit-a', name: 'A' }] });
    expect(stale.status).toBe(412);
    for (const [path, size, body] of [
      ['agenda-items', 201, (i: number) => ({ number: i + 1, title: `TOP ${i + 1}` })],
      ['units', 201, (i: number) => ({ name: `Fachbereich ${i}` })],
      ['stage-seats', 51, (i: number) => ({ label: `Platz ${i}` })],
    ] as const) {
      const tooMany = await req(app, 'PUT', `/v1/meetings/hv-2027/${path}`, { actor: ACTOR.admin,
        body: Array.from({ length: size }, (_, i) => body(i)) });
      expect(tooMany.status, path).toBe(422);
    }
    for (const path of ['agenda-items', 'units', 'stage-seats']) {
      const forbidden = await req(app, 'PUT', `/v1/meetings/hv-2027/${path}`, { actor: ACTOR.observer, body: [] });
      expect(forbidden.status, path).toBe(403);
      expect(await forbidden.json(), path).toMatchObject({ ruleId: 'R-PERM-01' });
      expect((await req(app, 'PUT', `/v1/meetings/hv-unbekannt/${path}`, { actor: ACTOR.admin, body: [] })).status, path).toBe(404);
    }
    expect((await req(app, 'GET', '/v1/meetings/hv-unbekannt/stage-seats', { actor: ACTOR.admin })).status).toBe(404);
    expect(count()).toBe(before);

    // R-IDEM-01: the same key returns the first result and its ETag.
    const first = await req(app, 'PUT', '/v1/meetings/hv-2027/units', { actor: ACTOR.admin,
      headers: { 'Idempotency-Key': 'k-040b' }, body: [{ id: 'unit-a', name: 'Eins' }] });
    const firstTag = first.headers.get('ETag');
    await req(app, 'PUT', '/v1/meetings/hv-2027/units', { actor: ACTOR.admin, body: [{ id: 'unit-a', name: 'Zwei' }] });
    const replay = await req(app, 'PUT', '/v1/meetings/hv-2027/units', { actor: ACTOR.admin,
      headers: { 'Idempotency-Key': 'k-040b' }, body: [{ id: 'unit-a', name: 'Drei' }] });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual([{ id: 'unit-a', name: 'Eins' }]);
    expect(replay.headers.get('ETag')).toBe(firstTag);
  });

  it('closed meeting in demo mode: the demo header reaches the core, R-ADM-01 answers 409 without an event', async () => {
    const { app, count } = demoApp([closed('hv-2027')]);
    const before = count();
    for (const path of ['agenda-items', 'units', 'stage-seats']) {
      const res = await req(app, 'PUT', `/v1/meetings/hv-2027/${path}`, { actor: ACTOR.admin, body: [] });
      expect(res.status, path).toBe(409);
      expect(await res.json(), path).toMatchObject({ ruleId: 'R-ADM-01' });
    }
    expect(count()).toBe(before);
  });

  it('closed meeting with a session: no active assignment, 403 before R-ADM-01, without an event', async () => {
    const now = new Date('2027-04-20T10:00:00.000Z');
    const actorId = actorIdForIdentity('https://idp.example.invalid/realms/hv', 'synthetic-admin');
    const events = createInMemoryEventStore();
    events.append(meetingEvents());
    const domain = createInProcessApi({ store: events, actor: () => SYSTEM_ACTOR, meetingId: 'hv-2027',
      clock: () => now, idGenerator: () => 'assignment-040b' });
    // The role that administers master data, from the rights data (AGENTS.md R4).
    const managing = (Object.keys(ROLE_PERMISSIONS) as Role[]).find((role) => ROLE_PERMISSIONS[role].includes('admin.units.manage'))!;
    await domain.assignRole({ subjectId: actorId, role: managing });
    const logins = new Map<string, { browserCorrelation: string; nonce: string; pkceVerifier: string; returnTo: string }>();
    const sessions = new Map<string, { actorId: string; csrfToken: string }>();
    const authStore: AuthStore = {
      async createLoginState(input) { logins.set(input.state, input); },
      async consumeLoginState({ state, browserCorrelation }) {
        const found = logins.get(state);
        if (!found || found.browserCorrelation !== browserCorrelation) return null;
        logins.delete(state);
        return found;
      },
      async createSession(input) {
        const token = 's'.repeat(43);
        sessions.set(token, { actorId: input.actorId, csrfToken: 'c'.repeat(43) });
        return { token, csrfToken: 'c'.repeat(43), expiresAt: new Date(now.getTime() + 3_600_000), idleExpiresAt: new Date(now.getTime() + 1_800_000) };
      },
      async readSession(token) {
        const session = sessions.get(token);
        return session ? { ...session, expiresAt: new Date(now.getTime() + 3_600_000), idleExpiresAt: new Date(now.getTime() + 1_800_000) } : null;
      },
      async verifyCsrf(token, submitted) { return sessions.get(token)?.csrfToken === submitted; },
      async revokeSession(token) { return sessions.delete(token); },
      async blockSubject() {},
      async isSubjectBlocked() { return false; },
    };
    const oidcFlow: OidcFlow = {
      async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
      async complete() { return { issuer: 'https://idp.example.invalid/realms/hv', subject: 'synthetic-admin' }; },
    };
    let saved = 0;
    const app = createApp({ demoEnabled: false, oidcIssuer: 'https://idp.example.invalid/realms/hv',
      oidcFlow, authStore, authEvents: async () => events.all(), clock: () => now,
      persistence: { load: () => [...events.all()], save: () => { saved += 1; } },
      transparencyNotice: { version: 'synthetic-1', text: { de: 'Ungeprüfter Testhinweis.', en: 'Unreviewed test notice.' } } });
    const login = await req(app, 'GET', '/auth/login');
    const state = new URL(login.headers.get('Location')!).searchParams.get('state');
    const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
    const callback = await req(app, 'GET', `/auth/callback?code=synthetic-code&state=${state}`, { headers: { Cookie: correlation } });
    const cookie = callback.headers.getSetCookie().find((line) => line.startsWith('hv_session='))!.split(';')[0]!;
    const headers = { Cookie: cookie, 'X-CSRF-Token': 'c'.repeat(43) };

    // While the meeting runs the session administers it.
    const open = await req(app, 'GET', '/v1/meetings/hv-2027/stage-seats', { headers });
    expect(open.status).toBe(200);
    const savedBefore = saved;
    // The meeting closes afterwards; the session resolution reads the log and finds no active grant.
    events.append([closed('hv-2027')]);
    const lastSeq = events.lastSeq();
    const refused = await req(app, 'PUT', '/v1/meetings/hv-2027/units', { headers, body: [{ id: 'unit-a', name: 'Neu' }] });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ ruleId: 'R-PERM-01' });
    expect(saved).toBe(savedBefore);
    expect(events.lastSeq()).toBe(lastSeq);
  });
});

describe('Scheibe 040b: classification with seatId against the contract (Test 6, contract half)', () => {
  it('every answer is valid against Question with its if/then; mismatch and unknown seat are 422', async () => {
    let t = Date.parse('2027-04-20T12:00:00.000Z');
    const app = createApp({ demoEnabled: true, clock: () => new Date((t += 1000)) });
    expect((await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 60, seed: 7 } })).status).toBe(200);
    const meeting = await (await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin })).json() as { id: string };
    const seats = await (await req(app, 'GET', `/v1/meetings/${meeting.id}/stage-seats`, { actor: ACTOR.admin })).json() as { id: string; label: string; position?: number }[];
    expect(seats.map((seat) => seat.id)).toEqual(['supervisory_board_chair', 'ceo', 'cfo', 'board_member']);
    await req(app, 'PUT', `/v1/meetings/${meeting.id}/stage-seats`, { actor: ACTOR.admin, body: [...seats, { id: 'seat-gast', label: 'Gast', position: 5 }] });
    const list = await (await req(app, 'GET', '/v1/questions?status=captured', { actor: ACTOR.admin })).json() as { items: { id: string; version: number }[] };
    const [a, b, c, d] = list.items;
    const coordination = 'coord:coordination';
    const classify = (q: { id: string; version: number }, body: Record<string, unknown>) =>
      req(app, 'POST', `/v1/questions/${q.id}/classification`, { actor: coordination, headers: { 'If-Match': `"v${q.version}"` }, body });

    const own = await classify(a!, { track: 'podium', seatId: 'seat-gast' });
    expect(own.status).toBe(200);
    const ownBody = await own.json();
    expect(validSchema('Question', ownBody)).toBe(true);
    expect(ownBody).toMatchObject({ seatId: 'seat-gast' });
    expect(ownBody).not.toHaveProperty('stageAssignment');
    const ceo = await (await classify(b!, { track: 'podium', seatId: 'ceo' })).json();
    expect(ceo).toMatchObject({ seatId: 'ceo', stageAssignment: 'ceo' });
    expect(validSchema('Question', ceo)).toBe(true);
    expect((await classify(c!, { track: 'podium', seatId: 'ceo', stageAssignment: 'cfo' })).status).toBe(422);
    expect((await classify(c!, { track: 'podium', seatId: 'seat-unbekannt' })).status).toBe(422);
    const legacy = await (await classify(d!, { track: 'podium', stageAssignment: 'cfo' })).json();
    expect(legacy).toMatchObject({ seatId: 'cfo', stageAssignment: 'cfo' });
    expect(validSchema('Question', legacy)).toBe(true);
    // Negative probe: the contract's if/then rejects a question whose two fields disagree.
    expect(validSchema('Question', { ...legacy, seatId: 'ceo' })).toBe(false);

    // The meeting view carries every seat and unit as a counter key.
    const counts = (await (await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin })).json() as { counts: { byUnit: object; bySeat: object } }).counts;
    expect(Object.keys(counts.bySeat).sort()).toEqual(['board_member', 'ceo', 'cfo', 'seat-gast', 'supervisory_board_chair']);
    expect(Object.keys(counts.byUnit)).toContain('unit-ar');
  });
});

describe('Scheibe 040b: contract 0.4.1 (Test 16)', () => {
  const schemas = openapiDoc.components.schemas;
  const seatEvent = (type: string, payload: Record<string, unknown>) => ({
    seq: 2, id: 'e-2', type, at, recordedAt: at, actor: { id: 'admin', role: 'admin' }, subjectId: 'hv-2027',
    payload, redacted: true, sourceHash: 'a'.repeat(64),
  });

  it('Classification has exactly track, agendaItemId, stageAssignment and seatId', () => {
    expect(Object.keys(schemas.Classification.properties).sort()).toEqual(['agendaItemId', 'seatId', 'stageAssignment', 'track']);
  });

  it('Event.type lists the three master-data events', () => {
    const types = schemas.Event.properties.type.enum as string[];
    for (const type of ['AgendaItemsReplaced', 'UnitsReplaced', 'StageSeatsReplaced']) expect(types).toContain(type);
  });

  it('EventRead with a seat carrying personId is invalid, for StageSeatsReplaced and for MeetingCreated; without it valid', () => {
    const withPerson = [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-1', deviceId: 'dev-1' }];
    const withoutPerson = [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, deviceId: 'dev-1' }];
    expect(validSchema('EventRead', seatEvent('StageSeatsReplaced', { stageSeats: withPerson }))).toBe(false);
    expect(validSchema('EventRead', seatEvent('StageSeatsReplaced', { stageSeats: withoutPerson }))).toBe(true);
    const meetingPayload = { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] };
    expect(validSchema('EventRead', seatEvent('MeetingCreated', { ...meetingPayload, stageSeats: withPerson }))).toBe(false);
    expect(validSchema('EventRead', seatEvent('MeetingCreated', { ...meetingPayload, stageSeats: withoutPerson }))).toBe(true);
  });

  it('the allowlist no longer names the four operations; they are in the contract and served (coverage hits above)', () => {
    const listed = allowlist.map((entry) => entry.operationId);
    for (const operationId of OPERATIONS) {
      expect(listed).not.toContain(operationId);
      expect(allOperationIds).toContain(operationId);
    }
  });

  it('a stored master-data event of the core is valid against Event; listEvents masks personId', async () => {
    const { app } = demoApp();
    for (const [path, body] of [
      ['agenda-items', [{ id: 'top-1', number: 1, title: 'Aussprache' }]],
      ['units', [{ id: 'unit-a', name: 'Fachbereich A', shortName: 'A' }]],
      ['stage-seats', [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-ceo', deviceId: 'dev-1' }]],
    ] as const) {
      expect((await req(app, 'PUT', `/v1/meetings/hv-2027/${path}`, { actor: ACTOR.admin, body })).status).toBe(200);
    }
    const listed = await (await req(app, 'GET', '/v1/events', { actor: ACTOR.admin })).json() as { items: Record<string, unknown>[] };
    const read = listed.items.filter((event) => ['AgendaItemsReplaced', 'UnitsReplaced', 'StageSeatsReplaced'].includes(event['type'] as string));
    expect(read.map((event) => event['type'])).toEqual(['AgendaItemsReplaced', 'UnitsReplaced', 'StageSeatsReplaced']);
    for (const event of read) expect(validSchema('EventRead', event)).toBe(true);
    expect(JSON.stringify(read)).not.toContain('p-ceo');
  });
});
