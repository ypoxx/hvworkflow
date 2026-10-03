/**
 * Scheibe 044b on Postgres: proposal, legal clearance and approval of a refusal survive a restart with the chain
 * check (P1), the justification (Begründung) lies in the `pii` part of the stored row with retention class
 * `record` (P2), a replay after the restart writes nothing (P3), a rejection writes no row and exactly one access
 * log line with `seq: null` (P4), and the chain protects the stored justification (P5, ADR 0011). Own schema per
 * test through `search_path`; skipped without `TEST_DATABASE_URL` and `TEST_RUNTIME_DATABASE_URL`.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const ACT = {
  admin: 'adm44b:admin', moderation: 'mod44b:moderation', capture: 'cap44b:capture', coordination: 'coo44b:coordination',
  legal: 'leg44b:legal', approver: 'app44b:approver',
} as const;
const SECRET = 'PGBEGRUENDUNG44BX';
const NOTE = 'PGVERMERK44BX';
const WORDING = 'PGWORTLAUT44BX';
const PATH_B = { answerKind: 'refusal_with_ground', text: `${WORDING} Zu dieser Frage gibt der Vorstand keine Auskunft.`,
  refusalGroundId: 'aktg-131-3-nr1', refusalJustification: `${SECRET}: Offenlegung schadet der Gesellschaft.` };

let owner: Pool;
let runtime: Pool;
let schema: string;
const clock = { now: new Date(T0) };

interface Q { id: string; version: number; status: string; answers: { version: number; refusalJustification?: string }[] }
interface Ev { seq: number; type: string; subjectId: string; payload: Record<string, unknown> }
interface Line { operationId: string | null; status: number; seq: number | null }

function scopedPool(connectionString: string | undefined, name: string): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3, application_name: `${schema}_${name}` });
}

/** The synthetic seed corpus, stamped by a core store (hash chain), written through the owner connection. */
async function insertSeed(): Promise<void> {
  const store = createInMemoryEventStore();
  const core = createInProcessApi({ store, actor: () => ({ ...SYSTEM_ACTOR }), clock: () => new Date(T0 - 3_600_000), seeder: seedEvents });
  await core.seedDemo({ questions: 30, seed: 7 });
  // The service's own write path (pii of `SpeakerRegistered` into `persons`), as in postgres-stream035a.
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
  const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => clock.now, accessLog: { sink, hashKey: Buffer.alloc(32, 44) } });
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
const maxSeq = async (): Promise<number> => Number((await owner.query<{ m: string }>('SELECT max(seq)::text AS m FROM events')).rows[0]!.m);

async function assigned(app: App): Promise<Q> {
  const speakers = await ok<{ id: string; version: number }[]>(call(app, ACT.capture, 'GET', '/v1/speakers'));
  const made = await call(app, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speakers[0]!), body: { speakerId: speakers[0]!.id, text: 'Warum?' } });
  expect(made.status).toBe(201);
  const contribution = (await made.json()) as { id: string };
  const capturedRes = await call(app, ACT.capture, 'POST', `/v1/contributions/${contribution.id}/questions`,
    { headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text: 'Warum?' }] } });
  expect(capturedRes.status).toBe(201);
  const q = ((await capturedRes.json()) as Q[])[0]!;
  const classified = await ok<Q>(call(app, ACT.coordination, 'POST', `/v1/questions/${q.id}/classification`, { headers: ifMatch(q), body: { track: 'expert_track' } }));
  return ok<Q>(call(app, ACT.coordination, 'POST', `/v1/questions/${q.id}/assignment`, { headers: ifMatch(classified), body: { unitId: 'unit-fin' } }));
}
async function scanEvents(app: App, after: number): Promise<Ev[]> {
  const out: Ev[] = [];
  for (;;) {
    const page = await ok<{ items: Ev[] }>(call(app, ACT.admin, 'GET', `/v1/events?after=${after}&limit=5000`));
    if (page.items.length === 0) return out;
    out.push(...page.items);
    after = page.items.at(-1)!.seq;
  }
}

/** App A: path B proposed (coordination), cleared with a remark (legal), approved (approver) with a key. */
async function approvedOnA() {
  const a = build();
  const q = await assigned(a.app);
  const head = await maxSeq();
  const proposed = await ok<Q>(call(a.app, ACT.coordination, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: PATH_B }));
  const cleared = await ok<Q>(call(a.app, ACT.legal, 'POST', `/v1/questions/${q.id}/legal-clearances`,
    { headers: ifMatch(proposed), body: { answerVersion: 1, note: `${NOTE} Würdigung.` } }));
  const approveHeaders = { ...ifMatch(cleared), 'Idempotency-Key': 'pg-approve-44b' };
  const approved = await ok<Q>(call(a.app, ACT.approver, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: approveHeaders, body: { answerVersion: 1 } }));
  expect(approved.status).toBe('approved');
  return { q, head, approved, approveHeaders };
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 044b: refusals on Postgres', () => {
  beforeEach(async () => {
    clock.now = new Date(T0);
    schema = `hv044b_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl, 'owner');
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    runtime = scopedPool(runtimeUrl, 'runtime');
    await insertSeed();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await runtime?.end();
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  it('P1 restart with chain check: state, masking, events without pii and note, the chain goes on', async () => {
    const { q, head } = await approvedOnA();
    const b = build();
    const asLegal = await ok<Q>(call(b.app, ACT.legal, 'GET', `/v1/questions/${q.id}`));
    expect(asLegal.status).toBe('approved');
    expect(asLegal.answers.at(-1)).toMatchObject({ version: 1, refusalJustification: `${SECRET}: Offenlegung schadet der Gesellschaft.` });
    const asAdminRes = await call(b.app, ACT.admin, 'GET', `/v1/questions/${q.id}`);
    expect(await asAdminRes.clone().text()).not.toContain(SECRET);
    expect('refusalJustification' in ((await asAdminRes.json()) as Q).answers.at(-1)!).toBe(false);
    const events = (await scanEvents(b.app, head)).filter((e) => e.subjectId === q.id);
    const drafted = events.filter((e) => e.type === 'AnswerDrafted');
    const legalCleared = events.filter((e) => e.type === 'QuestionLegalCleared');
    expect(drafted).toHaveLength(1);
    expect(legalCleared).toHaveLength(1);
    for (const e of [...drafted, ...legalCleared]) {
      expect('pii' in e.payload).toBe(false);
      expect('note' in e.payload).toBe(false);
      expect(JSON.stringify(e)).not.toContain(SECRET);
      expect(JSON.stringify(e)).not.toContain(NOTE);
    }
    const staged = await ok<Q>(call(b.app, ACT.moderation, 'POST', `/v1/questions/${q.id}/staging`, { headers: ifMatch(asLegal) }));
    expect(staged.status).toBe('staged');
  });

  it('P2 storage: justification under envelope.payload.pii, retention classes, remark stored, no persons row', async () => {
    const { q } = await approvedOnA();
    const rows = (await owner.query<{ seq: string; envelope: DomainEvent & { retentionClass?: string } }>(
      `SELECT seq::text, envelope FROM events WHERE envelope->>'subjectId' = $1 AND envelope->>'type' IN ('AnswerDrafted', 'QuestionLegalCleared', 'QuestionApproved') ORDER BY seq`,
      [q.id])).rows;
    expect(rows.map((r) => r.envelope.type)).toEqual(['AnswerDrafted', 'QuestionLegalCleared', 'QuestionApproved']);
    const [draftedRow] = rows;
    const sql = await owner.query<{ justification: string; inAnswer: boolean; retention: string }>(
      `SELECT envelope->'payload'->'pii'->>'refusalJustification' AS justification,
              (envelope->'payload'->'answer') ? 'refusalJustification' AS "inAnswer",
              envelope->>'retentionClass' AS retention
         FROM events WHERE seq = $1`, [draftedRow!.seq]);
    expect(sql.rows[0]).toEqual({ justification: `${SECRET}: Offenlegung schadet der Gesellschaft.`, inAnswer: false, retention: 'record' });
    expect(rows.map((r) => r.envelope.retentionClass)).toEqual(['record', 'working', 'record']);
    expect((rows[1]!.envelope.payload as { note?: string }).note).toBe(`${NOTE} Würdigung.`);
    const persons = await owner.query('SELECT 1 FROM persons WHERE source_seq = $1', [draftedRow!.seq]);
    expect(persons.rowCount).toBe(0);
  });

  it('P3 replay after the restart: the historical answer, no new row', async () => {
    const { q, approved, approveHeaders } = await approvedOnA();
    const before = await rowCount();
    const b = build();
    const replay = await call(b.app, ACT.approver, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: approveHeaders, body: { answerVersion: 1 } });
    expect(replay.status).toBe(200);
    const body = (await replay.json()) as Q;
    expect(body.version).toBe(approved.version);
    expect(body.status).toBe('approved');
    expect(await rowCount()).toBe(before);
  });

  it('P4 rejection: 409 R-GUARD-08, no new row, exactly one access-log line with seq null and eight keys', async () => {
    const a = build();
    const q = await assigned(a.app);
    const proposed = await ok<Q>(call(a.app, ACT.coordination, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: PATH_B }));
    const before = await rowCount();
    const mark = a.sink.lines.length;
    const res = await call(a.app, ACT.approver, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: ifMatch(proposed), body: { answerVersion: 1 } });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { ruleId: string }).ruleId).toBe('R-GUARD-08');
    expect(await rowCount()).toBe(before);
    const lines = a.sink.lines.slice(mark);
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(EIGHT_KEYS);
    expect(line).toMatchObject({ operationId: 'approveRefusal', status: 409, seq: null });
  });

  it('P5 the chain protects the justification: a changed row is a bare 500, the justification nowhere', async () => {
    const { q } = await approvedOnA();
    const seq = (await owner.query<{ seq: string }>(
      `SELECT seq::text FROM events WHERE envelope->>'subjectId' = $1 AND envelope->>'type' = 'AnswerDrafted'`, [q.id])).rows[0]!.seq;
    await owner.query(`UPDATE events SET envelope = jsonb_set(envelope, '{payload,pii,refusalJustification}', '"MANIPULIERT44BX"') WHERE seq = $1`, [seq]);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fresh = build();
    const res = await call(fresh.app, ACT.legal, 'GET', `/v1/questions/${q.id}`);
    expect(res.status).toBe(500);
    const body = await res.text();
    const logged = [...fresh.sink.lines, ...errorLog.mock.calls.map((c) => String(c[0]))].join('\n');
    for (const text of [body, logged]) {
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain('MANIPULIERT44BX');
      expect(text).not.toContain(WORDING);
    }
    // The integrity error is a fixed problem (ADR 0011): seq only, no content of the row.
    expect((JSON.parse(body) as { detail: string }).detail).toMatch(/^Event seq \d+: integrity check failed\.$/);
    expect(fresh.lines().at(-1)).toMatchObject({ status: 500, seq: null });
  });
});
