/**
 * Scheibe 046 on Postgres: a capture with a follow-up reference survives a restart with the chain check; after
 * loading, reference, read-out answer version, the child's version and the untouched parent are as before, the
 * filter finds the child, the stored row carries both fields and `/v1/events` the relation only (P1). A capture
 * rejected with R-LINK-01 writes no row and exactly one access-log line with `seq: null` (P2). Own schema per test
 * through `search_path`; skipped without `TEST_DATABASE_URL` and `TEST_RUNTIME_DATABASE_URL`.
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
const HASHER_BYTES = Buffer.alloc(32, 46);
const ACT = {
  admin: 'adm46:admin', capture: 'cap46:capture', moderation: 'mod46:moderation', coordination: 'coo46:coordination',
  expert: 'exp46:expert', legal: 'leg46:legal', approver: 'app46:approver', podium: 'pod46:podium',
} as const;

let owner: Pool;
let runtime: Pool;
let schema: string;
const clock = { now: new Date(T0) };

interface Q { id: string; version: number; updatedAt: string; status: string; parentQuestionId?: string; relation?: string; parentAnswerVersion?: number; answers: { version: number }[] }
interface Line { operationId: string | null; status: number; seq: number | null }
interface Made { id: string; etag: string }

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

async function contribution(app: App, text: string): Promise<Made> {
  const speakers = await ok<{ id: string; version: number }[]>(call(app, ACT.capture, 'GET', '/v1/speakers'));
  const made = await call(app, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speakers[0]!), body: { speakerId: speakers[0]!.id, text } });
  expect(made.status).toBe(201);
  return { id: ((await made.json()) as { id: string }).id, etag: made.headers.get('ETag')! };
}
function capture(app: App, c: Made, questions: unknown[]): Promise<Response> {
  return call(app, ACT.capture, 'POST', `/v1/contributions/${c.id}/questions`, { headers: { 'If-Match': c.etag }, body: { questions } });
}
const post = (app: App, actor: string, q: Q, step: string, body?: unknown): Promise<Q> =>
  ok<Q>(call(app, actor, 'POST', `/v1/questions/${q.id}/${step}`, { headers: ifMatch(q), ...(body !== undefined ? { body } : {}) }));
/** A question read out with answer version 1. */
async function deliveredParent(app: App): Promise<Q> {
  const res = await capture(app, await contribution(app, 'Wie hoch ist die Quote?'), [{ text: 'Wie hoch ist die Quote?' }]);
  expect(res.status).toBe(201);
  let x = ((await res.json()) as Q[])[0]!;
  x = await post(app, ACT.coordination, x, 'classification', { track: 'expert_track' });
  x = await post(app, ACT.coordination, x, 'assignment', { unitId: 'unit-fin' });
  x = await post(app, ACT.expert, x, 'answers', { text: 'Belastbare Antwort.' });
  x = await post(app, ACT.expert, x, 'review-submissions');
  x = await post(app, ACT.legal, x, 'legal-clearances', { answerVersion: 1 });
  x = await post(app, ACT.approver, x, 'approvals', { answerVersion: 1 });
  x = await post(app, ACT.moderation, x, 'staging');
  return post(app, ACT.podium, x, 'delivery');
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 046: follow-up references on Postgres', () => {
  beforeEach(async () => {
    clock.now = new Date(T0);
    schema = `hv046_${randomUUID().replaceAll('-', '')}`;
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

  it('P1 the reference survives a restart with the chain check; the stored row carries both fields, /v1/events the relation only', async () => {
    const a = build();
    const parent = await deliveredParent(a.app);
    const parentBefore = await ok<Q>(call(a.app, ACT.capture, 'GET', `/v1/questions/${parent.id}`));
    const res = await capture(a.app, await contribution(a.app, 'Warum gerade jetzt?'),
      [{ text: 'Warum gerade jetzt?', parentQuestionId: parent.id, relation: 'follow_up' }]);
    expect(res.status).toBe(201);
    const child = ((await res.json()) as Q[])[0]!;
    expect(child).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1, version: 2 });
    const stored = (await owner.query<{ envelope: DomainEvent }>(
      `SELECT envelope FROM events WHERE envelope->>'subjectId' = $1 AND envelope->>'type' = 'QuestionLinked'`, [child.id])).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0]!.envelope.payload).toEqual({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1 });
    // Restart: a new app loads the log from Postgres and checks the chain.
    const b = build();
    const reloaded = await ok<Q>(call(b.app, ACT.capture, 'GET', `/v1/questions/${child.id}`));
    expect(reloaded).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1, version: 2 });
    const parentAfter = await ok<Q>(call(b.app, ACT.capture, 'GET', `/v1/questions/${parent.id}`));
    expect([parentAfter.version, parentAfter.updatedAt]).toEqual([parentBefore.version, parentBefore.updatedAt]);
    const list = await ok<{ items: Q[] }>(call(b.app, ACT.capture, 'GET', `/v1/questions?parentQuestionId=${encodeURIComponent(parent.id)}`));
    expect(list.items.map((q) => q.id)).toEqual([child.id]);
    const feed = await ok<{ items: { type: string; subjectId: string; payload: unknown }[] }>(
      call(b.app, ACT.admin, 'GET', `/v1/events?after=0&limit=5000`));
    const linked = feed.items.filter((e) => e.type === 'QuestionLinked' && e.subjectId === child.id);
    expect(linked.map((e) => e.payload)).toEqual([{ relation: 'follow_up' }]);
  });

  it('P2 a capture rejected with R-LINK-01 writes no row and exactly one access-log line with seq null and eight keys', async () => {
    const a = build();
    const c = await contribution(a.app, 'Warum?');
    const before = await rowCount();
    const mark = a.sink.lines.length;
    const res = await capture(a.app, c, [{ text: 'Warum?', parentQuestionId: 'unknown-046-p2', relation: 'follow_up' }]);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { ruleId?: string }).ruleId).toBe('R-LINK-01');
    expect(await rowCount()).toBe(before);
    const own = a.lines().slice(mark);
    expect(own).toHaveLength(1);
    expect(Object.keys(own[0]!).sort()).toEqual(EIGHT_KEYS);
    expect(own[0]).toMatchObject({ operationId: 'captureQuestions', status: 422, seq: null });
  });
});
