import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, verifyEventChain, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { ACTOR } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };
const meetingId = 'hv-2027';
let owner: Pool;
let poolA: Pool;
let poolB: Pool;
let schema: string;

// `application_name` scopes the lock-wait polls below to this test's own pools: the Postgres test
// files run in parallel against one database, and advisory locks are database-wide, so an unscoped
// poll could be satisfied by another file's waiter and release the gate too early (flaky 201 vs 412).
function scopedPool(connectionString: string | undefined, name = 'owner'): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3,
    application_name: `${schema}_${name}` });
}

function fixtureEvents(): readonly DomainEvent[] {
  return createInMemoryEventStore().append([
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
  ] as NewEvent[]);
}

async function insertEvents(events: readonly DomainEvent[]): Promise<void> {
  for (const event of events) {
    await owner.query(
      'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)],
    );
  }
}

async function events(): Promise<DomainEvent[]> {
  const result = await owner.query<{ envelope: DomainEvent }>('SELECT envelope FROM events ORDER BY seq');
  return result.rows.map((row) => row.envelope);
}

function app(pool: Pool, idPrefix: string) {
  let id = 0;
  return createApp({ demoEnabled: true, postgres: pool,
    clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: () => `${idPrefix}-${++id}` });
}

async function register(pool: Pool, idPrefix: string, name: string, key?: string): Promise<Response> {
  const instance = app(pool, idPrefix);
  const tag = await speakerListTag(instance, meetingId);
  return instance.request(`/v1/meetings/${meetingId}/speakers`, {
    method: 'POST', headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json',
      'If-Match': tag,
      ...(key === undefined ? {} : { 'Idempotency-Key': key }) },
    body: JSON.stringify({ displayName: name, round: 1 }),
  });
}

async function speakerListTag(instance: ReturnType<typeof app>, id: string): Promise<string> {
  const read = await instance.request(`/v1/meetings/${id}/speakers`, {
    headers: { 'X-Actor': ACTOR.admin },
  });
  expect(read.status).toBe(200);
  const tag = read.headers.get('ETag');
  expect(tag).toMatch(/^"v\d+"$/);
  return tag!;
}

async function waiting(name: string, _type: 'Lock', event: string): Promise<boolean> {
  const result = await owner.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM pg_stat_activity
     WHERE datname = current_database() AND application_name = $1
       AND wait_event_type = 'Lock' AND wait_event = $2`, [`${schema}_${name}`, event]);
  return Number(result.rows[0]?.count) > 0;
}

async function pollUntil(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Expected the second database writer to wait on the global advisory lock.');
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 027: Postgres requests', () => {
  beforeEach(async () => {
    schema = `hv027_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    poolA = scopedPool(runtimeUrl, 'a');
    poolB = scopedPool(runtimeUrl, 'b');
    await insertEvents(fixtureEvents());
  });

  afterEach(async () => {
    await Promise.all([poolA?.end(), poolB?.end()]);
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
    vi.restoreAllMocks();
  });

  it('waits for the global lock before loading the new READ COMMITTED tail in a second app instance', async () => {
    await owner.query('CREATE TABLE lock_gate (id integer PRIMARY KEY, touched integer NOT NULL)');
    await owner.query('INSERT INTO lock_gate VALUES (1, 0)');
    await owner.query(`CREATE FUNCTION block_event_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = ${schema} AS $$
      BEGIN UPDATE lock_gate SET touched = touched + 1 WHERE id = 1; RETURN NEW; END $$`);
    await owner.query('CREATE TRIGGER block_event_insert BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION block_event_insert()');

    const gate = await owner.connect();
    try {
      await gate.query('BEGIN');
      await gate.query('UPDATE lock_gate SET touched = touched + 1 WHERE id = 1');
      const first = register(poolA, 'one', 'Erste Testperson');
      await pollUntil(() => waiting('a', 'Lock', 'transactionid'));

      const second = register(poolB, 'two', 'Zweite Testperson');
      // The second instance has read the old list tag before it can queue on the advisory lock.
      await pollUntil(() => waiting('b', 'Lock', 'advisory'));
      await gate.query('COMMIT');
      expect((await first).status).toBe(201);
      expect((await second).status).toBe(412);
    } finally {
      await gate.query('ROLLBACK');
      gate.release();
    }

    const persisted = await events();
    expect(persisted.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(() => verifyEventChain(persisted)).not.toThrow();
    const restarted = app(poolB, 'restart');
    const read = await restarted.request(`/v1/meetings/${meetingId}/speakers`, {
      headers: { 'X-Actor': ACTOR.moderation },
    });
    expect(read.status).toBe(200);
    expect((await read.json() as Array<{ displayName: string }>).map((row) => row.displayName))
      .toEqual(['Erste Testperson']);
  });

  it('rejects an owner or superuser pool for business traffic and readiness while the runtime pool works', async () => {
    const privileged = app(owner, 'forbidden-owner');
    const denied = await privileged.request(`/v1/meetings/${meetingId}/speakers`, {
      headers: { 'X-Actor': ACTOR.admin },
    });
    expect(denied.status).toBeGreaterThanOrEqual(500);
    const readiness = await privileged.request('/readyz');
    expect(readiness.status).toBe(503);
    expect(await readiness.json()).toMatchObject({ checks: { db: { status: 'fail' } } });

    const allowed = await app(poolA, 'runtime').request(`/v1/meetings/${meetingId}/speakers`, {
      headers: { 'X-Actor': ACTOR.admin },
    });
    expect(allowed.status).toBe(200);
  });

  it('keeps a committed idempotency key separate for two meetings in the same service', async () => {
    const secondMeetingId = 'hv-2028';
    const secondMeeting = createInMemoryEventStore({ load: () => [...fixtureEvents()], save: () => undefined }).append([{
      id: 'create-2028', type: 'MeetingCreated', at, actor,
      subjectId: secondMeetingId, meetingId: secondMeetingId,
      payload: { title: 'Zweite synthetische HV', date: '2028-04-20', agendaItems: [], units: [] },
    } as NewEvent]);
    await insertEvents(secondMeeting);

    const instance = app(poolA, 'two-meetings');
    const request = (id: string, name: string, tag: string) => instance.request(`/v1/meetings/${id}/speakers`, {
      method: 'POST', headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json',
        'Idempotency-Key': 'same-key', 'If-Match': tag },
      body: JSON.stringify({ displayName: name, round: 1 }),
    });
    const firstTag = await speakerListTag(instance, meetingId);
    const secondTag = await speakerListTag(instance, secondMeetingId);
    const first = await request(meetingId, 'Person A', firstTag);
    const second = await request(secondMeetingId, 'Person B', secondTag);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = await first.json() as { id: string };
    const secondBody = await second.json() as { id: string };
    expect(secondBody.id).not.toBe(firstBody.id);
    expect((await events()).filter((event) => event.type === 'SpeakerRegistered').map((event) => event.meetingId))
      .toEqual([meetingId, secondMeetingId]);
    const replay = await request(meetingId, 'Ignored retry', firstTag);
    expect((await replay.json() as { id: string }).id).toBe(firstBody.id);
    expect((await events()).filter((event) => event.type === 'SpeakerRegistered')).toHaveLength(2);
  });

  it('rolls back a failed insert and does not publish a projection or an idempotency result', async () => {
    const secret = 'postgres-driver-secret-027';
    await owner.query(`CREATE FUNCTION fail_event_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION '${secret}'; END $$`);
    await owner.query('CREATE TRIGGER fail_event_insert BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION fail_event_insert()');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const instance = app(poolA, 'rollback');
    const tag = await speakerListTag(instance, meetingId);
    const request = () => instance.request(`/v1/meetings/${meetingId}/speakers`, {
      method: 'POST', headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json',
        'Idempotency-Key': 'retry-after-rollback', 'If-Match': tag },
      body: JSON.stringify({ displayName: 'Nur nach Commit', round: 1 }),
    });
    const failed = await request();
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(await failed.text()).not.toContain(secret);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secret);
    expect((await events()).map((event) => event.seq)).toEqual([1, 2]);
    await owner.query('DROP TRIGGER fail_event_insert ON events');
    const retried = await request();
    expect(retried.status).toBe(201);
    expect((await events()).map((event) => event.seq)).toEqual([1, 2, 3]);
    // Admin may register a speaker but has no right to reveal the clear name in the response.
    expect((await retried.json() as { displayName: string }).displayName).toBe('Redner 1');
    expect((await owner.query<{ display_name: string }>('SELECT display_name FROM persons')).rows)
      .toEqual([{ display_name: 'Nur nach Commit' }]);
  });

  it.each([
    ['envelope', `UPDATE events SET envelope = jsonb_set(envelope, '{subjectId}', '"tampered"') WHERE seq = 2`],
    ['index sequence', 'UPDATE events SET seq = 22 WHERE seq = 2'],
    ['index ID', `UPDATE events SET id = 'different-index-id' WHERE seq = 2`],
    ['index meeting', `UPDATE events SET meeting_id = 'different-meeting' WHERE seq = 2`],
    ['index hash', `UPDATE events SET hash = repeat('0', 64) WHERE seq = 2`],
    ['index predecessor', `UPDATE events SET prev_hash = repeat('0', 64) WHERE seq = 2`],
  ])('refuses a fresh business read when the stored %s is corrupt', async (_label, sql) => {
    await owner.query(sql);
    const response = await app(poolA, 'corrupt').request(`/v1/meetings/${meetingId}/speakers`, {
      headers: { 'X-Actor': ACTOR.admin },
    });
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await response.text();
    expect(body).toMatch(/seq 2/i);
    expect(body).not.toContain('Synthetische HV');
    expect(body).not.toContain('different-index-id');
  });

  it.each([
    ['missing', 'DELETE FROM persons WHERE person_id = $1'],
    ['changed', `UPDATE persons SET display_name = 'Falscher Name' WHERE person_id = $1`],
    ['extra', `INSERT INTO persons (meeting_id, person_id, display_name, key_id, source_seq)
      VALUES ('hv-2027', $1, 'Zusätzliche Person', 'hv-2027', 1)`],
  ])('blocks business reads on a %s person row', async (caseName, sql) => {
    const created = await register(poolA, 'person', 'Richtige Testperson');
    expect(created.status).toBe(201);
    const speakerEvent = (await events()).at(-1);
    expect(speakerEvent?.type).toBe('SpeakerRegistered');
    expect(speakerEvent?.personId).toBeTruthy();
    const personId = caseName === 'extra' ? 'unexpected-person' : speakerEvent?.personId;
    await owner.query(sql, [personId]);
    const response = await app(poolB, 'fresh').request(`/v1/meetings/${meetingId}/speakers`, {
      headers: { 'X-Actor': ACTOR.admin },
    });
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await response.text();
    expect(body).not.toContain('Richtige Testperson');
    expect(body).not.toContain('Falscher Name');
  });

  it('rebuilds a 10,000-event Postgres snapshot in under five minutes', async () => {
    const source = createInMemoryEventStore({ load: () => [...fixtureEvents()], save: () => undefined });
    const newEvents = source.append(Array.from({ length: 9998 }, (_, index): NewEvent => ({
      id: `benchmark-speaker-${index + 1}`, type: 'SpeakerRegistered', at, actor,
      subjectId: `benchmark-speaker-${index + 1}`, personId: `benchmark-person-${index + 1}`,
      meetingId, payload: { number: index + 1, round: 1, position: index + 1,
        pii: { keyId: meetingId, displayName: `Synthetische Person ${index + 1}` } },
    })));

    // Bulk setup is deliberately outside the timed reconstruction. A batch stays well below
    // PostgreSQL's parameter limit and avoids 20,000 individual network round trips.
    for (let offset = 0; offset < newEvents.length; offset += 500) {
      const batch = newEvents.slice(offset, offset + 500);
      const eventValues = batch.flatMap((event) => [event.seq, event.id, event.meetingId,
        event.hash, event.prevHash, JSON.stringify(event)]);
      const eventPlaceholders = batch.map((_, index) => {
        const start = index * 6;
        return `(${Array.from({ length: 6 }, (__, column) => `$${start + column + 1}${column === 5 ? '::jsonb' : ''}`).join(', ')})`;
      });
      await owner.query(
        `INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ${eventPlaceholders.join(', ')}`,
        eventValues,
      );
      const personValues = batch.flatMap((event) => [event.meetingId, event.personId,
        event.type === 'SpeakerRegistered' ? event.payload.pii?.displayName : undefined,
        null, meetingId, event.seq]);
      const personPlaceholders = batch.map((_, index) => {
        const start = index * 6;
        return `(${Array.from({ length: 6 }, (__, column) => `$${start + column + 1}`).join(', ')})`;
      });
      await owner.query(
        `INSERT INTO persons (meeting_id, person_id, display_name, organisation, key_id, source_seq)
         VALUES ${personPlaceholders.join(', ')}`,
        personValues,
      );
    }

    expect((await owner.query<{ count: string }>('SELECT count(*)::text AS count FROM events')).rows[0]?.count)
      .toBe('10000');
    const started = performance.now();
    const read = await app(poolA, 'benchmark').request('/v1/meetings', {
      headers: { 'X-Actor': ACTOR.admin },
    });
    const elapsedMs = performance.now() - started;
    console.info(`Scheibe 027: 10,000-event Postgres load/rebuild ${elapsedMs.toFixed(1)} ms`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: meetingId })]));
    expect(elapsedMs).toBeLessThan(300_000);
  }, 310_000);
});
