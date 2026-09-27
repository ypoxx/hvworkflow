import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, type NewEvent, type Persistence } from '@hv/domain';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';

const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };
const base = '/v1/meetings/hv-2027/role-assignments';

function fixture(): { persistence: Persistence; events: () => readonly NewEvent[] } {
  const source = createInMemoryEventStore();
  source.append([
    { id: 'create-2026', type: 'MeetingCreated', at, actor, subjectId: 'hv-2026', meetingId: 'hv-2026',
      payload: { title: 'HV 2026', date: '2026-04-20', agendaItems: [], units: [] } },
    { id: 'start-2026', type: 'MeetingStarted', at, actor, subjectId: 'hv-2026', meetingId: 'hv-2026', payload: {} },
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [{ id: 'unit-fin', name: 'Finanzen' }] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} },
  ]);
  let events = [...source.all()];
  return {
    persistence: { load: () => events, save: (next) => { events = [...next]; } },
    events: () => events,
  };
}

function appWithFixture() {
  const data = fixture();
  const app = createApp({ demoEnabled: true, persistence: data.persistence,
    clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: (() => {
      let next = 0;
      return () => `new-${++next}`;
    })() });
  return { app, ...data };
}

describe('Scheibe 026: vertragsvalidierte Rollenzuordnung', () => {
  it('mounts all three canonical operations and filters the administered table', async () => {
    const { app, events } = appWithFixture();
    const empty = await req(app, 'GET', base, { actor: ACTOR.admin });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual([]);

    const created = await req(app, 'POST', base, { actor: ACTOR.admin,
      body: { subjectId: 'person-1', personId: 'person-1', role: 'expert', unitId: 'unit-fin' } });
    expect(created.status).toBe(201);
    const assignment = await created.json() as { id: string; meetingId: string; subjectId: string; role: string; unitId: string };
    expect(assignment).toMatchObject({ meetingId: 'hv-2027', subjectId: 'person-1', role: 'expert', unitId: 'unit-fin' });
    expect(events().at(-1)).toMatchObject({ type: 'RoleAssigned', meetingId: 'hv-2027', subjectId: assignment.id });

    const filtered = await req(app, 'GET', `${base}?subjectId=person-1&role=expert`, { actor: ACTOR.admin });
    expect(filtered.status).toBe(200);
    expect((await filtered.json() as { id: string }[]).map((row) => row.id)).toEqual([assignment.id]);
    const noMatch = await req(app, 'GET', `${base}?subjectId=other`, { actor: ACTOR.admin });
    expect(await noMatch.json()).toEqual([]);

    const revoked = await req(app, 'POST', `${base}/${assignment.id}/revocation`, {
      actor: ACTOR.admin, body: { reason: 'Zuständigkeit gewechselt' },
    });
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toMatchObject({ id: assignment.id, revokedAt: '2027-04-20T10:15:00.000Z' });
    expect(events().at(-1)).toMatchObject({ type: 'RoleRevoked', meetingId: 'hv-2027', subjectId: assignment.id });
  });

  it('limits list, assign and revoke to the administration right', async () => {
    const { app } = appWithFixture();
    const created = await req(app, 'POST', base, {
      actor: ACTOR.admin, body: { subjectId: 'person-1', role: 'expert', unitId: 'unit-fin' },
    });
    const { id } = await created.json() as { id: string };
    for (const actorName of [ACTOR.capture, ACTOR.moderation, ACTOR.expert, ACTOR.legal, ACTOR.approver, ACTOR.podium, ACTOR.observer]) {
      expect((await req(app, 'GET', base, { actor: actorName })).status, actorName).toBe(403);
      expect((await req(app, 'POST', base, { actor: actorName,
        body: { subjectId: 'other', role: 'expert' } })).status, actorName).toBe(403);
      expect((await req(app, 'POST', `${base}/${id}/revocation`, { actor: actorName })).status, actorName).toBe(403);
    }
  });

  it('rejects duplicate assignment, duplicate revocation and cross-year IDs', async () => {
    const { app } = appWithFixture();
    const body = { subjectId: 'person-1', role: 'expert', unitId: 'unit-fin' };
    const created = await req(app, 'POST', base, { actor: ACTOR.admin, body });
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    expect((await req(app, 'POST', base, { actor: ACTOR.admin, body })).status).toBe(409);
    expect((await req(app, 'POST', `/v1/meetings/hv-2026/role-assignments/${id}/revocation`,
      { actor: ACTOR.admin })).status).toBe(404);
    expect((await req(app, 'POST', `${base}/${id}/revocation`, { actor: ACTOR.admin })).status).toBe(200);
    expect((await req(app, 'POST', `${base}/${id}/revocation`, { actor: ACTOR.admin })).status).toBe(409);
    expect((await req(app, 'GET', '/v1/meetings/missing/role-assignments', { actor: ACTOR.admin })).status).toBe(404);
  });

  it('validates input against the declared contract before calling the domain', async () => {
    const { app } = appWithFixture();
    expect((await req(app, 'POST', base, { actor: ACTOR.admin,
      body: { subjectId: 'person-1', role: 'unknown-role' } })).status).toBe(422);
    expect((await req(app, 'POST', base, { actor: ACTOR.admin,
      body: { subjectId: 'person-1', role: 'expert', expiresAt: 'tomorrow' } })).status).toBe(422);
    expect((await req(app, 'GET', `${base}?role=unknown-role`, { actor: ACTOR.admin })).status).toBe(422);
  });
});
