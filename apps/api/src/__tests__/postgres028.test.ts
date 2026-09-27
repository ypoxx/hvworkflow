import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, verifyEventChain, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { ACTOR } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const meetingId = 'hv-2027';
const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };
let schema: string;
let owner: Pool;
let writerA: Pool;
let writerB: Pool;

function pool(connectionString: string): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3 });
}

function fixtureEvents(): readonly DomainEvent[] {
  return createInMemoryEventStore().append([
    { id: 'meeting', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
    { id: 'speaker-one', type: 'SpeakerRegistered', at, actor, subjectId: 'speaker-one', meetingId,
      personId: 'person-one', payload: { number: 1, round: 1, position: 1,
        pii: { keyId: meetingId, displayName: 'Synthetische Person A' } } },
    { id: 'speaker-two', type: 'SpeakerRegistered', at, actor, subjectId: 'speaker-two', meetingId,
      personId: 'person-two', payload: { number: 2, round: 1, position: 2,
        pii: { keyId: meetingId, displayName: 'Synthetische Person B' } } },
    { id: 'contribution', type: 'ContributionCaptured', at, actor, subjectId: 'contribution', meetingId,
      payload: { speakerId: 'speaker-one', text: 'Eine Frage. Noch eine Frage.', source: 'manual' } },
  ] as NewEvent[]);
}

async function rows(): Promise<DomainEvent[]> {
  const result = await owner.query<{ envelope: DomainEvent }>('SELECT envelope FROM events ORDER BY seq');
  return result.rows.map((row) => row.envelope);
}

function app(connection: Pool, prefix: string): App {
  let id = 0;
  return createApp({ demoEnabled: true, postgres: connection,
    clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: () => `${prefix}-${++id}` });
}

async function request(instance: App, method: string, path: string, actorHeader: string,
  body?: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return instance.request(path, { method, headers: { 'X-Actor': actorHeader, ...headers,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 028: two real Postgres writers', () => {
  beforeEach(async () => {
    schema = `hv028_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = pool(databaseUrl!);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    writerA = pool(runtimeUrl!);
    writerB = pool(runtimeUrl!);
    for (const event of fixtureEvents()) {
      await owner.query('INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)]);
    }
  });

  afterEach(async () => {
    await Promise.all([writerA?.end(), writerB?.end(), owner?.end()]);
    if (schema) {
      const admin = new Pool({ connectionString: databaseUrl });
      try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
    }
  });

  it.each([
    ['atomisation', 'POST', '/v1/contributions/contribution/questions', '/v1/contributions/contribution',
      ACTOR.capture, { questions: [{ text: 'Frage A' }, { text: 'Frage B' }] }, 201, 'QuestionCaptured'],
    ['list reorder', 'PUT', '/v1/speakers/order', '/v1/speakers', ACTOR.moderation,
      { round: 1, speakerIds: ['speaker-two', 'speaker-one'] }, 200, 'SpeakersReordered'],
  ] as const)('serializes concurrent %s calls against a fresh snapshot', async (
    _name, method, path, readPath, writer, body, successStatus, eventType,
  ) => {
    const firstApp = app(writerA, 'first');
    const secondApp = app(writerB, 'second');
    const read = await request(firstApp, 'GET', readPath, writer);
    expect(read.status).toBe(200);
    const tag = read.headers.get('ETag');
    expect(tag).toMatch(/^"v\d+"$/);
    const before = await rows();
    const [first, second] = await Promise.all([
      request(firstApp, method, path, writer, body, { 'If-Match': tag! }),
      request(secondApp, method, path, writer, body, { 'If-Match': tag! }),
    ]);
    expect([first.status, second.status].sort()).toEqual([successStatus, 412].sort());
    const persisted = await rows();
    expect(persisted.filter((event) => event.type === eventType)).toHaveLength(
      eventType === 'QuestionCaptured' ? 2 : 1,
    );
    expect(persisted.length).toBe(before.length + (eventType === 'QuestionCaptured' ? 2 : 1));
    expect(persisted.map((event) => event.seq)).toEqual(persisted.map((_, index) => index + 1));
    expect(() => verifyEventChain(persisted)).not.toThrow();
    const restarted = app(writerB, 'restart');
    const fresh = await request(restarted, 'GET', readPath, writer);
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('ETag')).not.toBe(tag);
  });

  it('replays a committed multi-event command in a second process without reserving a stale failed key', async () => {
    const first = app(writerA, 'first');
    const second = app(writerB, 'second');
    const path = '/v1/contributions/contribution/questions';
    const tag = (await request(first, 'GET', '/v1/contributions/contribution', ACTOR.capture)).headers.get('ETag')!;
    const failed = await request(first, 'POST', path, ACTOR.capture,
      { questions: [{ text: 'Stale' }] }, { 'If-Match': '"v999"', 'Idempotency-Key': 'retryable' });
    expect(failed.status).toBe(412);
    const committed = await request(first, 'POST', path, ACTOR.capture,
      { questions: [{ text: 'Frage A' }, { text: 'Frage B' }] },
      { 'If-Match': tag, 'Idempotency-Key': 'retryable' });
    expect(committed.status).toBe(201);
    const original = await committed.json() as { id: string; version: number }[];
    expect(original).toHaveLength(2);
    const beforeReplay = await rows();
    const replay = await request(second, 'POST', path, ACTOR.capture,
      { questions: [{ text: 'Changed retry body' }] },
      { 'If-Match': tag, 'Idempotency-Key': 'retryable' });
    expect(replay.status).toBe(201);
    expect((await replay.json() as { id: string; version: number }[]).map(({ id, version }) => ({ id, version })))
      .toEqual(original.map(({ id, version }) => ({ id, version })));
    expect(await rows()).toEqual(beforeReplay);
    expect(() => verifyEventChain(beforeReplay)).not.toThrow();
  });
});
