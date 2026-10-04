/**
 * Scheibe 055 on Postgres (the recovery case of risk class high): a version with a stored block document survives a
 * restart, the projection rebuilt from the log gives the same stored form and the same text, and the chain check of
 * the load is green (P1); the seeded versions of the pre-055 form carry a body derived from their text after the
 * restart, and loading writes no event (P2). Own schema per test through `search_path`; skipped without
 * `TEST_DATABASE_URL` and `TEST_RUNTIME_DATABASE_URL`.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { SYSTEM_ACTOR, answerBodyFromText, createInMemoryEventStore, createInProcessApi, seedEvents, type DomainEvent } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { insertPostgresEvents } from '../persistence/postgres.ts';
import { req } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const T0 = Date.parse('2027-04-20T12:00:00.000Z');
const ACT = { admin: 'adm55:admin', capture: 'cap55:capture', coordination: 'coo55:coordination', legal: 'leg55:legal' } as const;

let owner: Pool;
let runtime: Pool;
let schema: string;
const clock = { now: new Date(T0) };

interface Q { id: string; version: number; status: string; answers: { version: number; text: string; body?: unknown }[] }

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

const build = (): App => createApp({ demoEnabled: true, postgres: runtime, clock: () => clock.now });
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

async function assigned(app: App): Promise<Q> {
  const speakers = await ok<{ id: string; version: number }[]>(call(app, ACT.capture, 'GET', '/v1/speakers'));
  const made = await call(app, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speakers[0]!), body: { speakerId: speakers[0]!.id, text: 'Warum?' } });
  expect(made.status).toBe(201);
  const contribution = (await made.json()) as { id: string };
  const res = await call(app, ACT.capture, 'POST', `/v1/contributions/${contribution.id}/questions`,
    { headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text: 'Warum?' }] } });
  expect(res.status).toBe(201);
  const q = ((await res.json()) as Q[])[0]!;
  const classified = await ok<Q>(call(app, ACT.coordination, 'POST', `/v1/questions/${q.id}/classification`, { headers: ifMatch(q), body: { track: 'expert_track' } }));
  return ok<Q>(call(app, ACT.coordination, 'POST', `/v1/questions/${q.id}/assignment`, { headers: ifMatch(classified), body: { unitId: 'unit-fin' } }));
}

const FORMATTED = {
  blocks: [
    { type: 'paragraph', content: [{ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold', 'underline'] }, { text: ' um 3 %.' }] },
    { type: 'ol', items: [[{ text: 'Segment A', marks: ['highlight'] }], [{ text: 'Segment B' }]] },
  ],
};

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 055: answer document on Postgres', () => {
  beforeEach(async () => {
    clock.now = new Date(T0);
    schema = `hv055_${randomUUID().replaceAll('-', '')}`;
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

  it('P1 a version with body survives a restart: same stored form, same text, the chain check of the load is green', async () => {
    const a = build();
    const q = await assigned(a);
    const drafted = await ok<Q>(call(a, ACT.legal, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(q), body: { text: 'x', body: FORMATTED } }));
    const written = drafted.answers.at(-1)!;
    // `ol` is not `list`: N1 makes one paragraph per item (the editor of 055b maps `ol` to `list` itself).
    expect(written.text).toBe('Der Umsatz stieg um 3 %.\n\nSegment A\n\nSegment B');
    const stored = (await owner.query<{ envelope: DomainEvent }>(
      `SELECT envelope FROM events WHERE envelope->>'subjectId' = $1 AND envelope->>'type' = 'AnswerDrafted'`, [q.id])).rows;
    expect(stored).toHaveLength(1);
    expect((stored[0]!.envelope.payload as { answer: { body?: unknown } }).answer.body).toEqual(written.body);
    // Restart: a new app loads the log from Postgres and checks the hash chain before it serves.
    const b = build();
    const reloaded = await ok<Q>(call(b, ACT.admin, 'GET', `/v1/questions/${q.id}`));
    expect(reloaded.answers.at(-1)).toEqual(written);
    expect(reloaded.version).toBe(drafted.version);
    // The chain goes on after the restart: a second version on top of the reloaded log.
    const second = await ok<Q>(call(b, ACT.legal, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(reloaded), body: { text: 'Klartext.' } }));
    expect(second.answers).toHaveLength(2);
    const c = build();
    expect((await ok<Q>(call(c, ACT.admin, 'GET', `/v1/questions/${q.id}`))).answers).toEqual(second.answers);
  });

  it('P2 seeded versions of the pre-055 form carry body from L after the restart; loading wrote no event', async () => {
    const before = await rowCount();
    const app = build();
    const { items } = await ok<{ items: Q[] }>(call(app, ACT.admin, 'GET', '/v1/questions?limit=200'));
    const versions = items.flatMap((q) => q.answers);
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) expect(v.body).toEqual(answerBodyFromText(v.text));
    const raw = (await owner.query<{ envelope: DomainEvent }>(`SELECT envelope FROM events WHERE envelope->>'type' = 'AnswerDrafted'`)).rows;
    expect(raw.length).toBeGreaterThan(0);
    for (const row of raw) expect((row.envelope.payload as { answer: object }).answer).not.toHaveProperty('body');
    expect(await rowCount()).toBe(before);
  });
});
