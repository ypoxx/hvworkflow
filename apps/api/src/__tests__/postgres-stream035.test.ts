/**
 * Slice 035b, tests 24–29 and the Postgres part of test 12: the SSE service over Postgres with the real
 * session store (`auth_sessions`), a schema of its own per test. Two app instances share one database:
 * the stream sits on the first, writes and revocations arrive through the second (the distributor's
 * 1 s tick), or through the first (the nudge after COMMIT).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { CORPUS_DEMO, SYSTEM_ACTOR, createInMemoryEventStore, createInProcessApi, seedEvents, type NewEvent, type Role } from '@hv/domain';
import { createApp, type App, type CreateAppOptions } from '../app.ts';
import { createAuthStore, type AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { insertPostgresEvents, loadPostgresSnapshot } from '../persistence/postgres.ts';
import type { StreamLimits } from '../limits/config.ts';
import { req } from './helpers.ts';
import { StreamReader, eventually, idOf, mustOpen, sleep, type SseBlock } from './stream-reader035.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const at = new Date('2027-04-20T10:15:00.000Z');
const ISSUER = 'https://idp.example.invalid/realms/hv';
const MEETING = 'hv-2027';
const LOAD_SUBJECTS = 34;
const PEOPLE: readonly { key: string; role: Role; unitId?: string }[] = [
  { key: 'admin', role: 'admin' }, { key: 'capture', role: 'capture' }, { key: 'moderation', role: 'moderation' },
  ...Array.from({ length: LOAD_SUBJECTS }, (_, i) => ({ key: `load${i + 1}`, role: 'admin' as Role })),
];
const subject = (key: string): string => `subject-${key}`;
const key = randomBytes(32);
let schema: string;
let owner: Pool;
let runtime: Pool;
let runtime2: Pool;
let sessionStore: AuthStore;
const assignments = new Map<string, string>();
const readers: StreamReader[] = [];
const track = (reader: StreamReader): StreamReader => { readers.push(reader); return reader; };

function pool(connectionString: string, max = 10): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max });
}

async function bootstrap(): Promise<void> {
  const store = createInMemoryEventStore();
  let id = 0;
  const domain = createInProcessApi({ store, actor: () => SYSTEM_ACTOR, clock: () => at, idGenerator: () => `boot-${++id}`, seeder: seedEvents });
  await domain.seedDemo({ questions: 40, roundSizes: [6, 5], seed: CORPUS_DEMO.seed });
  for (const person of PEOPLE) {
    const assignment = await domain.assignRole({ subjectId: subject(person.key), role: person.role, ...(person.unitId !== undefined ? { unitId: person.unitId } : {}) });
    assignments.set(person.key, assignment.id);
  }
  const client = await owner.connect();
  try {
    await client.query('BEGIN');
    await insertPostgresEvents(client, store.all(), 60_000);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

interface Hooks { windows: { kind: string; phase: string }[]; open: Map<string, number>; maxOpen: Map<string, number>;
  appliedHead: number; appliedAt: Map<number, number>; gate?: () => Promise<void> }
function newHooks(): Hooks { return { windows: [], open: new Map(), maxOpen: new Map(), appliedHead: 0, appliedAt: new Map() }; }

function build(db: Pool, hooks: Hooks = newHooks(), streamLimits?: Partial<StreamLimits>, extra: Partial<CreateAppOptions> = {}): App {
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
    async complete() { return { issuer: ISSUER, subject: 'unused' }; },
  };
  let id = 0;
  return createApp({ demoEnabled: false, oidcIssuer: ISSUER, oidcFlow, authKey: key, postgres: db, clock: () => at,
    idGenerator: () => `req-${++id}-${randomUUID().slice(0, 8)}`,
    ...(streamLimits !== undefined ? { streamLimits } : {}),
    testHooks: {
      streamWindow: (kind, phase) => {
        hooks.windows.push({ kind, phase });
        const now = (hooks.open.get(kind) ?? 0) + (phase === 'start' ? 1 : -1);
        hooks.open.set(kind, now);
        hooks.maxOpen.set(kind, Math.max(hooks.maxOpen.get(kind) ?? 0, now));
      },
      streamApplied: (head) => { hooks.appliedHead = head; hooks.appliedAt.set(head, performance.now()); },
      streamReloadGate: async () => { if (hooks.gate) await hooks.gate(); },
    },
    ...extra });
}

const sessions = new Map<string, { token: string; csrfToken: string }>();
async function session(who: string, n = 1): Promise<{ token: string; csrfToken: string }> {
  const name = `${who}#${n}`;
  let found = sessions.get(name);
  if (!found) {
    const created = await sessionStore.createSession({ actorId: subject(who), now: at });
    found = { token: created.token, csrfToken: created.csrfToken };
    sessions.set(name, found);
  }
  return found;
}
async function asSession(who: string, n = 1): Promise<Record<string, string>> {
  return { Cookie: `hv_session=${(await session(who, n)).token}` };
}
async function call(app: App, who: string, method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  const s = await session(who);
  return app.request(path, { method, headers: { Cookie: `hv_session=${s.token}`,
    ...(method === 'GET' ? {} : { 'X-CSRF-Token': s.csrfToken, 'Idempotency-Key': randomUUID() }), ...headers,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
let fillers = 0;
async function assignFiller(app: App, who = 'admin'): Promise<Response> {
  return call(app, who, 'POST', `/v1/meetings/${MEETING}/role-assignments`, {}, { subjectId: `filler-${++fillers}`, role: 'observer' });
}
async function head(): Promise<number> {
  return Number((await owner.query<{ max: string | null }>('SELECT max(seq) AS max FROM events')).rows[0]!.max ?? 0);
}
const isEvent = (b: SseBlock): boolean => b.event === 'event';
const kinds = (blocks: readonly SseBlock[]): string[] => blocks.map((b) => b.event ?? '');

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 035b: SSE stream with Postgres', () => {
  beforeEach(async () => {
    schema = `hv035b_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = pool(databaseUrl!);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    runtime = pool(runtimeUrl!);
    runtime2 = pool(runtimeUrl!);
    sessionStore = createAuthStore(runtime2, key);
    sessions.clear();
    assignments.clear();
    await bootstrap();
  });
  afterEach(async () => {
    await Promise.all(readers.splice(0).map((r) => r.cancel()));
    await sleep(50);
    await Promise.all([runtime?.end(), runtime2?.end(), owner?.end()]);
    if (schema) {
      const admin = new Pool({ connectionString: databaseUrl });
      try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
    }
  });

  it('12 (Postgres) migrations pending: 503 StreamUnavailable with Retry-After, nothing opened', async () => {
    const app = build(runtime);
    const headers = await asSession('admin');
    await owner.query(`DROP INDEX ${schema}.auth_login_states_expires_idx`);
    await owner.query(`DROP FUNCTION ${schema}.auth_purge_login_states(timestamptz)`);
    await owner.query('DELETE FROM schema_migrations WHERE version = 3');
    const res = await req(app, 'GET', '/v1/stream', { headers });
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(await res.json()).toMatchObject({ status: 503, detail: 'Migrations are pending.' });
  });

  it('24 a write through a second instance arrives within 2 s; through the same instance within 500 ms', async () => {
    const first = build(runtime);
    const second = build(runtime2);
    const reader = track(await mustOpen(first, '/v1/stream', await asSession('admin')));
    await reader.nextMessage();
    const t1 = performance.now();
    expect((await assignFiller(second)).status).toBe(201);
    const viaSecond = await reader.until(isEvent, 2_000);
    const secondMs = performance.now() - t1;
    expect(idOf(viaSecond)).toBe(await head());
    const t2 = performance.now();
    expect((await assignFiller(first)).status).toBe(201);
    await reader.until(isEvent, 500);
    const sameMs = performance.now() - t2;
    console.log(`035b test 24: delivery via second instance ${secondMs.toFixed(0)} ms, via same instance ${sameMs.toFixed(0)} ms`);
    expect(secondMs).toBeLessThan(2_000);
    expect(sameMs).toBeLessThan(500);
  }, 30_000);

  it('25 a tampered old row with open streams: end unavailable on every stream; a new open is a 500', async () => {
    const app = build(runtime);
    const a = track(await mustOpen(app, '/v1/stream', await asSession('admin')));
    const b = track(await mustOpen(app, '/v1/stream', await asSession('capture')));
    await a.nextMessage();
    await b.nextMessage();
    await owner.query(`UPDATE events SET envelope = jsonb_set(envelope, '{subjectId}', '"tampered"') WHERE seq = 5`);
    for (const reader of [a, b]) {
      const rest = await reader.rest(4_000);
      expect(kinds(rest)).toEqual(['end']);
      expect(rest[0]!.data).toEqual({ reason: 'unavailable' });
    }
    const again = await req(app, 'GET', '/v1/stream', { headers: await asSession('moderation') });
    expect(again.status).toBe(500);
    expect(await again.text()).not.toContain('tampered');
  }, 30_000);

  /** Replaces the log after `keep` by a valid other suffix of `extra` events (owner connection). */
  async function replaceSuffix(keep: number, extra: number): Promise<void> {
    const client = await owner.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      const snapshot = await loadPostgresSnapshot(client);
      const prefix = snapshot.events.slice(0, keep);
      await client.query('DELETE FROM events WHERE seq > $1', [keep]);
      if (extra > 0) {
        const alt = createInMemoryEventStore({ load: () => prefix, save: () => {} });
        alt.append(Array.from({ length: extra }, (_, i) => ({ id: `alt-${i}-${randomUUID()}`, type: 'RoleAssigned', at: at.toISOString(),
          actor: SYSTEM_ACTOR, subjectId: `alt-assignment-${i}`, meetingId: MEETING,
          payload: { assignmentId: `alt-assignment-${i}`, subjectId: `alt-subject-${i}`, role: 'observer' } }) as unknown as NewEvent));
        await insertPostgresEvents(client, alt.all().slice(keep), 60_000);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function seenFirstByBusinessRequest(app: App, hooks: Hooks, change: () => Promise<void>): Promise<void> {
    // Hold the distributor's next reload until a business request of the same app has loaded the changed chain.
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    hooks.gate = () => held;
    await sleep(1_300); // let a reload in flight finish; every later one waits at the gate
    await change();
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };
    try {
      expect((await call(app, 'admin', 'GET', '/v1/meetings')).status).toBe(200);
    } finally {
      console.error = original;
    }
    // The business request consumed `historyChanged` (the fixed takt-033 line was written there).
    expect(errors.some((line) => line.includes('history changed or was shortened'))).toBe(true);
    hooks.gate = undefined;
    release();
  }

  it('25b chain replaced, seen first by a business request (B1): every stream gets reset, nothing of the new chain as continuation', async () => {
    const hooks = newHooks();
    const app = build(runtime, hooks);
    const a = track(await mustOpen(app, '/v1/stream', await asSession('admin')));
    const b = track(await mustOpen(app, '/v1/stream', await asSession('capture')));
    await a.nextMessage();
    await b.nextMessage();
    const before = await head();
    await seenFirstByBusinessRequest(app, hooks, () => replaceSuffix(before - 2, 3));
    for (const reader of [a, b]) {
      const rest = await reader.rest(4_000);
      expect(kinds(rest)).toEqual(['reset']);
      expect(rest[0]!.data).toEqual({ lastSeq: before + 1 });
      expect(rest[0]!.id).toBeUndefined();
    }
    console.log(`035b test 25b raw: ${a.blocks.map((blk) => blk.raw.replaceAll('\n', ' | ')).join(' || ')}`);
  }, 30_000);

  it('25c log shortened, seen first by a business request (B1): reset; after the rebuild new events from the new head', async () => {
    const hooks = newHooks();
    const app = build(runtime, hooks);
    const a = track(await mustOpen(app, '/v1/stream', await asSession('admin')));
    await a.nextMessage();
    const before = await head();
    await seenFirstByBusinessRequest(app, hooks, () => replaceSuffix(before - 3, 0));
    const rest = await a.rest(4_000);
    expect(kinds(rest)).toEqual(['reset']);
    expect(rest[0]!.data).toEqual({ lastSeq: before - 3 });
    const again = track(await mustOpen(app, '/v1/stream', await asSession('admin')));
    expect(idOf((await again.nextMessage())!)).toBe(before - 3);
    expect((await assignFiller(app)).status).toBe(201);
    const next = await again.until(isEvent, 2_000);
    expect(idOf(next)).toBe(before - 2);
  }, 30_000);

  it('26 RoleRevoked through the second instance: end forbidden on the first', async () => {
    const first = build(runtime);
    const second = build(runtime2);
    const reader = track(await mustOpen(first, '/v1/stream', await asSession('capture')));
    await reader.nextMessage();
    const res = await call(second, 'admin', 'POST', `/v1/meetings/${MEETING}/role-assignments/${assignments.get('capture')}/revocation`, {}, { reason: 'Test' });
    expect(res.status).toBe(200);
    const rest = await reader.rest(3_000);
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'forbidden' });
  }, 30_000);

  it('27 subject block through a second instance: end session at the next heartbeat at the latest', async () => {
    const first = build(runtime, newHooks(), { heartbeatMs: 500 });
    const reader = track(await mustOpen(first, '/v1/stream', await asSession('capture')));
    await reader.nextMessage();
    await createAuthStore(runtime2, key).blockSubject(subject('capture'), at);
    const rest = await reader.rest(3_000);
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'session' });
  }, 30_000);

  it('28 ten idle streams hold no pool connection and no open transaction outside the reload and check windows', async () => {
    const hooks = newHooks();
    const app = build(runtime, hooks, { heartbeatMs: 300 });
    for (let i = 0; i < 10; i++) {
      const who = i % 2 === 0 ? 'admin' : 'capture';
      track(await mustOpen(app, '/v1/stream', await asSession(who, Math.floor(i / 2) % 3 + 1)));
    }
    let samples = 0;
    let busy = 0;
    const deadline = performance.now() + 4_000;
    while (performance.now() < deadline) {
      const quiet = (): boolean => [...hooks.open.values()].every((n) => n === 0);
      const startsBefore = hooks.windows.length;
      if (quiet()) {
        const checkedOut = runtime.totalCount - runtime.idleCount;
        const rows = (await owner.query<{ n: string }>(`SELECT count(*) AS n FROM pg_stat_activity
          WHERE usename = $1 AND datname = current_database() AND (state <> 'idle' OR xact_start IS NOT NULL)`, [runtimeRole])).rows;
        // Only a sample during which no window opened or closed counts (the query itself takes time).
        if (quiet() && hooks.windows.length === startsBefore) {
          samples += 1;
          if (checkedOut !== 0 || Number(rows[0]!.n) !== 0) busy += 1;
        }
      }
      await sleep(15);
    }
    console.log(`035b test 28: ${samples} samples between windows, ${busy} with a held connection or transaction; windows seen ${hooks.windows.length}`);
    expect(samples).toBeGreaterThan(20);
    expect(busy).toBe(0);
    expect(hooks.windows.some((w) => w.kind === 'session')).toBe(true);
  }, 30_000);

  it('29 load: 200 streams over 67 sessions of 34 subjects, 20 parallel writes: all 2xx in budget, no 503, at most 2 check connections', async () => {
    const hooks = newHooks();
    const app = build(runtime, hooks, { heartbeatMs: 3_000 });
    const plan: { who: string; n: number }[] = [];
    for (let s = 1; s <= LOAD_SUBJECTS; s++) {
      const sessionsOf = s === LOAD_SUBJECTS ? 1 : 2;
      for (let n = 1; n <= sessionsOf; n++) {
        const streams = s === LOAD_SUBJECTS ? 2 : 3;
        for (let i = 0; i < streams; i++) plan.push({ who: `load${s}`, n });
      }
    }
    expect(plan).toHaveLength(200);
    expect(new Set(plan.map((p) => `${p.who}#${p.n}`)).size).toBe(67);
    const all: StreamReader[] = [];
    for (const p of plan) all.push(track(await mustOpen(app, '/v1/stream', await asSession(p.who, p.n))));
    await Promise.all(all.map((r) => r.nextMessage(10_000)));
    const latencies: number[] = [];
    const statuses: number[] = [];
    await Promise.all(Array.from({ length: 20 }, async () => {
      const t = performance.now();
      const res = await assignFiller(app);
      latencies.push(performance.now() - t);
      statuses.push(res.status);
    }));
    const final = await head();
    await eventually(() => all.every((r) => r.blocks.some((b) => isEvent(b) && idOf(b) === final)), 15_000, 'every stream received the last event');
    const lastDelivery = performance.now();
    const batchAt = hooks.appliedAt.get(final) ?? lastDelivery;
    const spread = lastDelivery - batchAt;
    console.log(`035b test 29: writes max ${Math.max(...latencies).toFixed(0)} ms, median ${[...latencies].sort((x, y) => x - y)[10]!.toFixed(0)} ms; ` +
      `statuses ${[...new Set(statuses)].join(',')}; max concurrent session checks ${hooks.maxOpen.get('session') ?? 0}; ` +
      `batch to last delivery ${spread.toFixed(0)} ms`);
    expect(statuses.every((s) => s === 201)).toBe(true);
    expect(Math.max(...latencies)).toBeLessThan(10_000);
    expect(hooks.maxOpen.get('session') ?? 0).toBeLessThanOrEqual(2);
    expect(spread).toBeLessThan(2_000);
    for (const r of all) {
      const ids = r.blocks.filter(isEvent).map(idOf);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(20);
    }
  }, 180_000);
});
