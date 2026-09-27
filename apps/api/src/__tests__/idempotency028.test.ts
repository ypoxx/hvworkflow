import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryEventStore, type DomainEvent, type NewEvent, type Persistence } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { ACTOR } from './helpers.ts';

const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };
const meeting = 'hv-2027';
const base = `/v1/meetings/${meeting}`;
const temporaryDirectories: string[] = [];
afterEach(() => temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

function initialEvents(): DomainEvent[] {
  return [...createInMemoryEventStore().append([
    { id: 'meeting', type: 'MeetingCreated', at, actor, subjectId: meeting, meetingId: meeting,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [],
        units: [{ id: 'unit-fin', name: 'Finanzen' }] } },
    { id: 'start', type: 'MeetingStarted', at, actor, subjectId: meeting, meetingId: meeting, payload: {} },
    { id: 'speaker-one', type: 'SpeakerRegistered', at, actor, subjectId: 'speaker-one', meetingId: meeting,
      personId: 'person-one', payload: { number: 1, round: 1, position: 1,
        pii: { keyId: meeting, displayName: 'Synthetische Person A' } } },
    { id: 'speaker-two', type: 'SpeakerRegistered', at, actor, subjectId: 'speaker-two', meetingId: meeting,
      personId: 'person-two', payload: { number: 2, round: 1, position: 2,
        pii: { keyId: meeting, displayName: 'Synthetische Person B' } } },
    { id: 'contribution', type: 'ContributionCaptured', at, actor, subjectId: 'contribution', meetingId: meeting,
      payload: { speakerId: 'speaker-one', text: 'Eine Frage. Noch eine Frage.', source: 'manual' } },
    { id: 'question', type: 'QuestionCaptured', at, actor, subjectId: 'question', meetingId: meeting,
      payload: { number: 'F-0001', contributionId: 'contribution', speakerId: 'speaker-one', text: 'Eine Frage.' } },
    { id: 'other-question', type: 'QuestionCaptured', at, actor, subjectId: 'other-question', meetingId: meeting,
      payload: { number: 'F-0002', contributionId: 'contribution', speakerId: 'speaker-one', text: 'Noch eine Frage.' } },
  ] as NewEvent[])];
}

function fixture() {
  let events = initialEvents();
  const persistence: Persistence = { load: () => events, save: (next) => { events = [...next]; } };
  let id = 0;
  const app = createApp({ demoEnabled: true, persistence,
    clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: () => `new-${++id}` });
  return { app, events: () => events };
}

async function request(app: App, method: string, path: string, actorHeader: string, body?: unknown,
  headers: Record<string, string> = {}): Promise<Response> {
  return app.request(path, { method, headers: { 'X-Actor': actorHeader, ...headers,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

const tag = (version: number): string => `"v${version}"`;

describe('Scheibe 028: HTTP comparison versions', () => {
  it.each([
    ['register alias', 'POST', '/v1/speakers', ACTOR.moderation, { displayName: 'Neue Person' }, '/v1/speakers'],
    ['register canonical', 'POST', `${base}/speakers`, ACTOR.moderation, { displayName: 'Neue Person' }, `${base}/speakers`],
    ['reorder alias', 'PUT', '/v1/speakers/order', ACTOR.moderation,
      { round: 1, speakerIds: ['speaker-two', 'speaker-one'] }, '/v1/speakers'],
    ['reorder canonical', 'PUT', `${base}/speakers/order`, ACTOR.moderation,
      { round: 1, speakerIds: ['speaker-two', 'speaker-one'] }, `${base}/speakers`],
    ['update speaker', 'PATCH', '/v1/speakers/speaker-one', ACTOR.moderation,
      { round: 2 }, '/v1/speakers/speaker-one'],
    ['capture alias', 'POST', '/v1/contributions', ACTOR.capture,
      { speakerId: 'speaker-one', text: 'Zusätzlicher Redebeitrag.' }, '/v1/speakers/speaker-one'],
    ['capture canonical', 'POST', `${base}/contributions`, ACTOR.capture,
      { speakerId: 'speaker-one', text: 'Zusätzlicher Redebeitrag.' }, '/v1/speakers/speaker-one'],
    ['atomise', 'POST', '/v1/contributions/contribution/questions', ACTOR.capture,
      { questions: [{ text: 'Noch eine Frage.' }] }, '/v1/contributions/contribution'],
    ['question transition', 'POST', '/v1/questions/question/classification', 'coord:coordination',
      { track: 'podium' }, '/v1/questions/question'],
  ] as const)('%s requires the correct source ETag and emits no event on 428/412', async (
    _name, method, path, writer, body, readPath,
  ) => {
    const { app, events } = fixture();
    const read = await request(app, 'GET', readPath, ACTOR.admin);
    expect(read.status).toBe(200);
    const current = read.headers.get('ETag');
    expect(current).toMatch(/^"v\d+"$/);
    const before = events().length;
    expect((await request(app, method, path, writer, body)).status).toBe(428);
    expect(events()).toHaveLength(before);
    expect((await request(app, method, path, writer, body, { 'If-Match': tag(999) })).status).toBe(412);
    expect(events()).toHaveLength(before);
    const accepted = await request(app, method, path, writer, body, { 'If-Match': current! });
    expect(accepted.status).toBeGreaterThanOrEqual(200);
    expect(accepted.status).toBeLessThan(300);
    expect(accepted.headers.get('ETag')).toMatch(/^"v\d+"$/);
    expect(events().length).toBeGreaterThan(before);
  });

  it('uses one year-wide list version for aliases, canonical paths and different rounds', async () => {
    const { app, events } = fixture();
    const alias = await request(app, 'GET', '/v1/speakers?round=1', ACTOR.moderation);
    const canonical = await request(app, 'GET', `${base}/speakers?round=2`, ACTOR.moderation);
    expect(alias.headers.get('ETag')).toBe(canonical.headers.get('ETag'));
    expect(Array.isArray(await alias.json())).toBe(true);
    expect(Array.isArray(await canonical.json())).toBe(true);
    const oldTag = alias.headers.get('ETag')!;
    const created = await request(app, 'POST', `${base}/speakers`, ACTOR.moderation,
      { displayName: 'Andere Runde', round: 2 }, { 'If-Match': oldTag });
    expect(created.status).toBe(201);
    expect(created.headers.get('ETag')).not.toBe(oldTag);
    const before = events().length;
    expect((await request(app, 'POST', '/v1/speakers', ACTOR.moderation,
      { displayName: 'Veralteter Stand', round: 1 }, { 'If-Match': oldTag })).status).toBe(412);
    expect(events()).toHaveLength(before);
  });

  it('checks rights and foreign IDs before revealing a missing or stale version', async () => {
    const { app, events } = fixture();
    const before = events().length;
    expect((await request(app, 'POST', '/v1/speakers', ACTOR.observer,
      { displayName: 'Unberechtigt' })).status).toBe(403);
    expect((await request(app, 'PATCH', '/v1/speakers/foreign', ACTOR.moderation,
      { round: 2 }, { 'If-Match': tag(999) })).status).toBe(404);
    expect((await request(app, 'PATCH', '/v1/speakers/speaker-one', ACTOR.moderation,
      { round: 2 }, { 'If-Match': 'not-an-etag' })).status).toBe(422);
    expect(events()).toHaveLength(before);
  });

  it.each([
    ['/classification', { track: 'podium' }],
    ['/assignment', { unitId: 'unit-fin' }],
    ['/answers', { text: 'Antworttext', sources: [] }],
    ['/review-submissions', undefined],
    ['/approvals', { answerVersion: 1 }],
    ['/legal-clearances', { answerVersion: 1 }],
    ['/returns', { reason: 'Erneut prüfen' }],
    ['/staging', undefined],
    ['/closure', undefined],
    ['/withdrawal', { reason: 'Zurückgezogen' }],
    ['/merge', { intoQuestionId: 'other-question' }],
  ] as const)('checks the question version before the state guard for %s', async (suffix, body) => {
    const { app, events } = fixture();
    const path = `/v1/questions/question${suffix}`;
    const before = events().length;
    expect((await request(app, 'POST', path, ACTOR.admin, body)).status).toBe(428);
    expect((await request(app, 'POST', path, ACTOR.admin, body, { 'If-Match': tag(999) })).status).toBe(412);
    expect(events()).toHaveLength(before);
  });
});

describe('Scheibe 028: replay from the confirmed log', () => {
  it('does not reserve a key on 412 and scopes it to actor, resource and operation', async () => {
    const { app, events } = fixture();
    const key = 'scoped-key';
    const firstTag = (await request(app, 'GET', '/v1/speakers/speaker-one', ACTOR.moderation)).headers.get('ETag')!;
    const secondTag = (await request(app, 'GET', '/v1/speakers/speaker-two', ACTOR.moderation)).headers.get('ETag')!;
    const stale = await request(app, 'PATCH', '/v1/speakers/speaker-one', ACTOR.moderation,
      { round: 2 }, { 'If-Match': tag(999), 'Idempotency-Key': key });
    expect(stale.status).toBe(412);
    const first = await request(app, 'PATCH', '/v1/speakers/speaker-one', ACTOR.moderation,
      { round: 2 }, { 'If-Match': firstTag, 'Idempotency-Key': key });
    expect(first.status).toBe(200);
    const otherResource = await request(app, 'PATCH', '/v1/speakers/speaker-two', ACTOR.moderation,
      { round: 2 }, { 'If-Match': secondTag, 'Idempotency-Key': key });
    expect(otherResource.status).toBe(200);
    const newFirstTag = first.headers.get('ETag')!;
    const otherActor = await request(app, 'PATCH', '/v1/speakers/speaker-one', 'mod-two:moderation',
      { round: 3 }, { 'If-Match': newFirstTag, 'Idempotency-Key': key });
    expect(otherActor.status).toBe(200);
    const listTag = (await request(app, 'GET', '/v1/speakers', ACTOR.moderation)).headers.get('ETag')!;
    const otherOperation = await request(app, 'POST', '/v1/speakers', ACTOR.moderation,
      { displayName: 'Neue Testperson' }, { 'If-Match': listTag, 'Idempotency-Key': key });
    expect(otherOperation.status).toBe(201);
    expect(events().filter((event) => event.type === 'SpeakerUpdated')).toHaveLength(3);
    expect(events().filter((event) => event.type === 'SpeakerRegistered')).toHaveLength(3);
  });

  it('records a successful keyed no-op for replay while leaving the resource version unchanged', async () => {
    const { app, events } = fixture();
    const path = '/v1/speakers/speaker-one';
    const current = (await request(app, 'GET', path, ACTOR.moderation)).headers.get('ETag')!;
    const before = events().length;
    const accepted = await request(app, 'PATCH', path, ACTOR.moderation, {},
      { 'If-Match': current, 'Idempotency-Key': 'empty-update' });
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get('ETag')).toBe(current);
    expect(events()).toHaveLength(before + 1);
    const restarted = createApp({ demoEnabled: true,
      persistence: { load: events, save: () => { throw new Error('keyed no-op replay wrote events'); } },
      idGenerator: () => 'wrong-new-id' });
    const replay = await request(restarted, 'PATCH', path, ACTOR.moderation,
      { round: 2 }, { 'If-Match': current, 'Idempotency-Key': 'empty-update' });
    expect(replay.status).toBe(200);
    expect(replay.headers.get('ETag')).toBe(current);
    expect(await replay.json()).toMatchObject({ id: 'speaker-one', round: 1 });
    expect(events()).toHaveLength(before + 1);
  });

  it('replays an alias write through the canonical route after JSONL restart with its original ID', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'hv-028-jsonl-'));
    temporaryDirectories.push(directory);
    const eventLogPath = join(directory, 'events.jsonl');
    writeFileSync(eventLogPath, initialEvents().map((event) => JSON.stringify(event)).join('\n') + '\n');
    const first = createApp({ demoEnabled: true, eventLogPath, idGenerator: () => 'first-id' });
    const listTag = (await request(first, 'GET', '/v1/speakers', ACTOR.moderation)).headers.get('ETag')!;
    const key = 'same-command-after-restart';
    const created = await request(first, 'POST', '/v1/speakers', ACTOR.moderation,
      { displayName: 'Ursprünglicher Name' }, { 'If-Match': listTag, 'Idempotency-Key': key });
    expect(created.status).toBe(201);
    const original = await created.json() as { id: string; version: number };
    const committedLines = readFileSync(eventLogPath, 'utf8').trim().split('\n').length;
    const restarted = createApp({ demoEnabled: true, eventLogPath, idGenerator: () => 'wrong-new-id' });
    const replay = await request(restarted, 'POST', `${base}/speakers`, ACTOR.moderation,
      { displayName: 'Changed retry body' }, { 'If-Match': listTag, 'Idempotency-Key': key });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toMatchObject({ id: original.id, version: original.version });
    expect(readFileSync(eventLogPath, 'utf8').trim().split('\n')).toHaveLength(committedLines);
    const denied = await request(restarted, 'POST', `${base}/speakers`, 'mod:observer',
      { displayName: 'Changed retry body' }, { 'If-Match': listTag, 'Idempotency-Key': key });
    expect(denied.status).toBe(403);
  });

  it('reconstructs one multi-question result and original IDs after later changes', async () => {
    const { app, events } = fixture();
    const contributionTag = (await request(app, 'GET', '/v1/contributions/contribution', ACTOR.capture)).headers.get('ETag')!;
    const body = { questions: [{ text: 'Frage A' }, { text: 'Frage B' }] };
    const headers = { 'If-Match': contributionTag, 'Idempotency-Key': 'two-questions' };
    const first = await request(app, 'POST', '/v1/contributions/contribution/questions', ACTOR.capture, body, headers);
    expect(first.status).toBe(201);
    const original = await first.json() as { id: string; version: number }[];
    expect(original).toHaveLength(2);
    const questionPath = `/v1/questions/${original[0]!.id}`;
    const questionTag = (await request(app, 'GET', questionPath, 'coord:coordination')).headers.get('ETag')!;
    const changed = await request(app, 'POST', `${questionPath}/classification`, 'coord:coordination',
      { track: 'podium' }, { 'If-Match': questionTag });
    expect(changed.status).toBe(200);
    const after = events().length;
    const restarted = createApp({ demoEnabled: true, persistence: { load: events, save: () => { throw new Error('replay wrote events'); } },
      idGenerator: () => 'wrong-new-id' });
    const replay = await request(restarted, 'POST', '/v1/contributions/contribution/questions', ACTOR.capture,
      { questions: [{ text: 'Changed body' }] }, headers);
    expect(replay.status).toBe(201);
    expect((await replay.json() as { id: string; version: number }[]).map(({ id, version }) => ({ id, version })))
      .toEqual(original.map(({ id, version }) => ({ id, version })));
    expect(events()).toHaveLength(after);
  });
});
