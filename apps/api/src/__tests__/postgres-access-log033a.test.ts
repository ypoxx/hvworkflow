/**
 * Scheibe 033a on Postgres: `seq` in the access log is the highest event inserted *after COMMIT*,
 * null after a rollback, and a driver error with a secret reaches neither response nor any log line
 * (T-G1-R-01, T-G2-I-02). Runs in CI's Postgres step; skipped without `TEST_DATABASE_URL`.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { ACTOR } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };
const meetingId = 'hv-2027';
const fixed = new Date('2027-04-20T10:15:00.000Z');
let owner: Pool;
let runtime: Pool;
let schema: string;

interface Line { requestId: string; status: number; seq: number | null; operationId: string | null; subjectHash: string | null }

function scopedPool(connectionString: string | undefined, name: string): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3, application_name: `${schema}_${name}` });
}

function fixtureEvents(): readonly DomainEvent[] {
  return createInMemoryEventStore().append([
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
  ] as NewEvent[]);
}

async function maxSeq(): Promise<number> {
  return Number((await owner.query<{ max: string }>('SELECT max(seq)::text AS max FROM events')).rows[0]!.max);
}

function build() {
  const sink = createMemorySink();
  let id = 0;
  const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => fixed, idGenerator: () => `al-${++id}`,
    accessLog: { sink, hashKey: Buffer.alloc(32, 5) } });
  const lines = (): Line[] => sink.lines.map((l) => JSON.parse(l) as Line);
  const tag = async (): Promise<string> => (await app.request(`/v1/meetings/${meetingId}/speakers`,
    { headers: { 'X-Actor': ACTOR.admin } })).headers.get('ETag')!;
  const register = async (ifMatch?: string): Promise<Response> => app.request(`/v1/meetings/${meetingId}/speakers`, {
    method: 'POST',
    headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json', 'If-Match': ifMatch ?? await tag() },
    body: JSON.stringify({ displayName: 'Nur synthetisch', round: 1 }) });
  return { app, sink, lines, register };
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 033a: access log on Postgres', () => {
  beforeEach(async () => {
    schema = `hv033a_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl, 'owner');
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    runtime = scopedPool(runtimeUrl, 'runtime');
    for (const event of fixtureEvents()) {
      await owner.query('INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)]);
    }
  });

  afterEach(async () => {
    await runtime?.end();
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  it('logs the seq inserted after COMMIT for a write and null for a read', async () => {
    const { lines, register } = build();
    const res = await register();
    expect(res.status).toBe(201);
    const all = lines();
    expect(all[0]).toMatchObject({ operationId: 'listMeetingSpeakers', status: 200, seq: null });
    const write = all.at(-1)!;
    expect(write).toMatchObject({ operationId: 'registerMeetingSpeaker', status: 201 });
    expect(write.seq).toBe(await maxSeq());
    expect(write.seq).toBe(3);
    expect(write.subjectHash).not.toBeNull();
  });

  it('logs null for a 412 and adds no event', async () => {
    const { lines, register } = build();
    const before = await maxSeq();
    const res = await register('"v999"');
    expect(res.status).toBe(412);
    expect(lines().at(-1)).toMatchObject({ status: 412, seq: null });
    expect(await maxSeq()).toBe(before);
  });

  it('logs null after a rollback, shows the replaced 500 with header and instance, and keeps the driver secret out of every line', async () => {
    const secret = 'postgres-driver-secret-033a';
    await owner.query(`CREATE FUNCTION fail_event_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION '${secret}'; END $$`);
    await owner.query('CREATE TRIGGER fail_event_insert BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION fail_event_insert()');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { lines, sink, register } = build();
      const res = await register();
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.headers.get('X-Server-Time')).toBe(fixed.toISOString());
      const bodyText = await res.text();
      expect(bodyText).not.toContain(secret);
      const write = lines().at(-1)!;
      expect(write).toMatchObject({ operationId: 'registerMeetingSpeaker', seq: null });
      expect(write.status).toBe(res.status);
      expect((JSON.parse(bodyText) as { instance: string }).instance).toBe(`urn:hv:request:${write.requestId}`);
      expect(sink.lines.join('\n')).not.toContain(secret);
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
      expect(await maxSeq()).toBe(2);
    } finally {
      errorLog.mockRestore();
    }
  });
});
