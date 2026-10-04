/**
 * Scheibe 048 on Postgres: a forward to another answering unit survives a restart with the chain check, and
 * after loading the unit, the status and a running claim are as before (P1); a rejected forward writes no row
 * and exactly one access-log line with `seq: null` (P2). Own schema per test through `search_path`; skipped
 * without `TEST_DATABASE_URL` and `TEST_RUNTIME_DATABASE_URL`.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { SYSTEM_ACTOR, createInMemoryEventStore, createInProcessApi, seedEvents, type DomainEvent } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { insertPostgresEvents } from '../persistence/postgres.ts';
import { req } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const T0 = Date.parse('2027-04-20T12:00:00.000Z');
const EIGHT_KEYS = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];
const HASHER_BYTES = Buffer.alloc(32, 48);
const ACT = {
  admin: 'adm48:admin', capture: 'cap48:capture', coordination: 'coo48:coordination', legal: 'leg48:legal',
} as const;

let owner: Pool;
let runtime: Pool;
let schema: string;
const clock = { now: new Date(T0) };

interface Q { id: string; version: number; status: string; unitId?: string; claim?: { actorId: string; expiresAt: string } }
interface Line { operationId: string | null; status: number; seq: number | null }

function scopedPool(connectionString: string | undefined, name: string): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3, application_name: `${schema}_${name}` });
}

/** The synthetic seed corpus, stamped by a core store (hash chain), written through the owner connection. */
async function insertSeed(): Promise<void> {
  const store = createInMemoryEventStore();
  const core = createInProcessApi({ store, actor: () => ({ ...SYSTEM_ACTOR }), clock: () => new Date(T0 - 3_600_000), seeder: seedEvents });
  await core.seedDemo({ questions: 30, seed: 7 });
  const client = await owner.connect();
  try {
    await client.query('BEGIN');
    await insertPostgresEvents(client, store.all(), 60_000);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

function build() {
  const sink = createMemorySink();
  const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => clock.now, accessLog: { sink, hashKey: HASHER_BYTES } });
  return { app, sink, lines: () => sink.lines.map((l) => JSON.parse(l) as Line) };
}
async function call(app: App, actor: string, method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Response> {
  clock.now = new Date(clock.now.getTime() + 1_500);
  const res = await req(app, method, path, { actor, ...opts });
  if (res.status === 429) throw new Error('429: a test setup error');
  return res;
}
async function ok<T>(res: Promise<Response>): Promise<T> {
  const r = await res;
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return (await r.json()) as T;
}
const ifMatch = (q: { version: number }): Record<string, string> => ({ 'If-Match': `"v${q.version}"` });
const rowCount = async (): Promise<number> => Number((await owner.query<{ n: string }>('SELECT count(*)::text AS n FROM events')).rows[0]!.n);

/** A question in `in_review` of unit-fin with a legal claim: drafted, submitted, claimed by legal. */
async function inReviewClaimed(app: App): Promise<Q> {
  const speakers = await ok<{ id: string; version: number }[]>(call(app, ACT.capture, 'GET', '/v1/speakers'));
  const made = await call(app, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speakers[0]!), body: { speakerId: speakers[0]!.id, text: 'Warum?' } });
  expect(made.status).toBe(201);
  const contribution = (await made.json()) as { id: string };
  const capturedRes = await call(app, ACT.capture, 'POST', `/v1/contributions/${contribution.id}/questions`,
    { headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text: 'Warum?' }] } });
  expect(capturedRes.status).toBe(201);
  const q = ((await capturedRes.json()) as Q[])[0]!;
  const classified = await ok<Q>(call(app, ACT.coordination, 'POST', `/v1/questions/${q.id}/classification`, { headers: ifMatch(q), body: { track: 'expert_track' } }));
  const assigned = await ok<Q>(call(app, ACT.coordination, 'POST', `/v1/questions/${q.id}/assignment`, { headers: ifMatch(classified), body: { unitId: 'unit-fin' } }));
  const drafted = await ok<Q>(call(app, ACT.legal, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(assigned), body: { text: 'Belastbare Antwort.' } }));
  const submitted = await ok<Q>(call(app, 'exp48:expert', 'POST', `/v1/questions/${q.id}/review-submissions`, { headers: ifMatch(drafted) }));
  expect(submitted.status).toBe('in_review');
  return ok<Q>(call(app, ACT.legal, 'POST', `/v1/questions/${q.id}/claim`, { headers: ifMatch(submitted) }));
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 048: forwardQuestion on Postgres', () => {
  beforeEach(async () => {
    clock.now = new Date(T0);
    schema = `hv048_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl, 'owner');
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    runtime = scopedPool(runtimeUrl, 'runtime');
    await insertSeed();
  });

  afterEach(async () => {
    await runtime?.end();
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  it('P1 the forward survives a restart with the chain check; unit, status and claim are as before', async () => {
    const a = build();
    const q = await inReviewClaimed(a.app);
    expect(q.claim?.actorId).toBe('leg48');
    const forwarded = await ok<Q>(call(a.app, ACT.coordination, 'POST', `/v1/questions/${q.id}/forwards`,
      { headers: ifMatch(q), body: { unitId: 'unit-hr', reasonCode: 'expertise_elsewhere' } }));
    expect(forwarded).toMatchObject({ status: 'in_review', unitId: 'unit-hr' });
    const stored = (await owner.query<{ envelope: DomainEvent & { retentionClass?: string } }>(
      `SELECT envelope FROM events WHERE envelope->>'subjectId' = $1 AND envelope->>'type' = 'QuestionForwarded'`, [q.id])).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0]!.envelope.payload).toEqual({ unitId: 'unit-hr', fromUnitId: 'unit-fin', reasonCode: 'expertise_elsewhere' });
    expect(stored[0]!.envelope.retentionClass).toBe('working');
    // Restart: a new app loads the log from Postgres and checks the chain.
    const b = build();
    const reloaded = await ok<Q>(call(b.app, ACT.coordination, 'GET', `/v1/questions/${q.id}`));
    expect(reloaded).toMatchObject({ status: 'in_review', unitId: 'unit-hr', version: forwarded.version });
    expect(reloaded.claim).toEqual(q.claim);
    // The chain goes on after the restart.
    const back = await ok<Q>(call(b.app, ACT.coordination, 'POST', `/v1/questions/${q.id}/forwards`,
      { headers: ifMatch(reloaded), body: { unitId: 'unit-fin', reasonCode: 'wrong_unit' } }));
    expect(back.unitId).toBe('unit-fin');
  });

  it('P2 a rejected forward writes no row and exactly one access-log line with seq null and eight keys', async () => {
    const a = build();
    const q = await inReviewClaimed(a.app);
    const before = await rowCount();
    const mark = a.sink.lines.length;
    const res = await call(a.app, ACT.coordination, 'POST', `/v1/questions/${q.id}/forwards`,
      { headers: ifMatch(q), body: { unitId: 'unit-fin', reasonCode: 'other' } });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { ruleId?: string }).ruleId).toBe('R-GUARD-15');
    expect(await rowCount()).toBe(before);
    const own = a.lines().slice(mark);
    expect(own).toHaveLength(1);
    expect(Object.keys(own[0]!).sort()).toEqual(EIGHT_KEYS);
    expect(own[0]).toMatchObject({ operationId: 'forwardQuestion', status: 409, seq: null });
  });
});
