import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { ACTOR } from './helpers.ts';

// Slice takt-024: the Postgres write lock must only be taken for requests that hit a route and pass
// the contract check. Unknown paths (404) and contract violations (422) must not queue on the lock.
const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };
const meetingId = 'hv-2027';
let owner: Pool;
let pool: Pool;
let schema: string;

function scopedPool(connectionString: string | undefined): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 4 });
}

function fixtureEvents(): readonly DomainEvent[] {
  return createInMemoryEventStore().append([
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
  ] as NewEvent[]);
}

async function eventCount(): Promise<number> {
  return Number((await owner.query<{ n: string }>('SELECT count(*)::text AS n FROM events')).rows[0]!.n);
}

async function advisoryWaiters(): Promise<number> {
  const result = await owner.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM pg_stat_activity
     WHERE datname = current_database() AND wait_event_type = 'Lock' AND wait_event = 'advisory'`);
  return Number(result.rows[0]?.count);
}

async function pollUntil(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Expected a valid write to wait on the global advisory lock.');
}

/** Fails instead of hanging when a request that must not need the lock queues behind it. */
async function promptly(pending: Promise<Response>, label = 'request'): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} waited on the write lock.`)), 2000);
  });
  try { return await Promise.race([pending, deadline]); } finally { if (timer) clearTimeout(timer); }
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe takt-024: lock after validation', () => {
  beforeEach(async () => {
    schema = `hv024_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    pool = scopedPool(runtimeUrl);
    for (const event of fixtureEvents()) {
      await owner.query(
        'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)]);
    }
  });

  afterEach(async () => {
    await pool?.end();
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  it('answers 404 and 422 without the lock while a valid write still waits for it', async () => {
    let id = 0;
    const instance = createApp({ demoEnabled: true, postgres: pool,
      clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: () => `t024-${++id}` });
    const json = { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' };
    const list = await instance.request(`/v1/meetings/${meetingId}/speakers`, { headers: { 'X-Actor': ACTOR.admin } });
    const tag = list.headers.get('ETag')!;

    const gate = await owner.connect();
    let valid: Promise<Response> | undefined;
    try {
      await gate.query('BEGIN');
      await gate.query('SELECT pg_advisory_xact_lock($1, $2)', [27027, 1]);

      const unknown = await promptly(Promise.resolve(instance.request('/v1/gibt-es-nicht', {
        method: 'POST', headers: json, body: '{}' })), '404');
      expect(unknown.status).toBe(404);

      const badBody = await promptly(Promise.resolve(instance.request(`/v1/meetings/${meetingId}/speakers`, {
        method: 'POST', headers: { ...json, 'If-Match': tag }, body: JSON.stringify({ displayName: 42, round: 'x' }) })), 'bad body');
      expect(badBody.status).toBe(422);

      const badHeader = await promptly(Promise.resolve(instance.request(`/v1/meetings/${meetingId}/speakers`, {
        method: 'POST', headers: { ...json, 'If-Match': tag, 'Idempotency-Key': 'k'.repeat(129) },
        body: JSON.stringify({ displayName: 'X', round: 1 }) })), 'bad header');
      expect(badHeader.status).toBe(422);

      // Reads take no lock (REPEATABLE READ READ ONLY) and are unaffected.
      const read = await promptly(Promise.resolve(instance.request(`/v1/meetings/${meetingId}/speakers`, {
        headers: { 'X-Actor': ACTOR.admin } })), 'read');
      expect(read.status).toBe(200);
      expect(await advisoryWaiters()).toBe(0);
      expect(await eventCount()).toBe(2);

      valid = Promise.resolve(instance.request(`/v1/meetings/${meetingId}/speakers`, {
        method: 'POST', headers: { ...json, 'If-Match': tag },
        body: JSON.stringify({ displayName: 'Gueltige Testperson', round: 1 }) }));
      await pollUntil(async () => (await advisoryWaiters()) > 0);
      expect(await eventCount()).toBe(2);
      await gate.query('COMMIT');
    } finally {
      await gate.query('ROLLBACK');
      gate.release();
    }
    expect((await valid!).status).toBe(201);
    expect(await eventCount()).toBe(3);
  });

  it('keeps every /v1 handler behind the boundary, including routes without contract validation', async () => {
    const instance = createApp({ demoEnabled: true, postgres: pool,
      clock: () => new Date('2027-04-20T10:15:00.000Z') });
    const res = await instance.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } });
    expect(res.status).toBe(200);
  });
});
