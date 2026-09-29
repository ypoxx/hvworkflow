/**
 * Scheibe 034a, Postgres part: migration 0003 (purge function for login states), its catalog checks,
 * the runtime rights, the purge inside `createLoginState`, and (further below) pool timeouts, the
 * 503/500 mapping and the request timeout of the Postgres boundary. Runs only with the TEST_* variables
 * (CI step "Postgres integration tests" in gates.yml).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp, type CreateAppOptions } from '../app.ts';
import { createAuthStore } from '../auth/store.ts';
import type { LimitsConfig } from '../limits/config.ts';
import { postgresPoolOptions } from '../limits/poolOptions.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { getMigrationStatus, runMigrations } from '../persistence/migrations.ts';
import { assertRuntimePrivileges, QueryTimeoutError } from '../persistence/postgres.ts';
import { ACTOR } from './helpers.ts';

const ownerUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const enabled = ownerUrl !== undefined && runtimeUrl !== undefined;
const key = randomBytes(32);
const minute = (m: number, s = 0): Date => new Date(Date.UTC(2027, 3, 20, 10, m, s));

async function newSchema(admin: Pool): Promise<string> {
  const schema = `hv034a_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  return schema;
}

/** Applies migrations 0001 and 0002 by hand: the state of a database before migration 0003 ("pending"). */
async function migrateToVersionTwo(owner: Pool, schema: string): Promise<void> {
  const client = await owner.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE ${schema}.schema_migrations (version integer PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    for (const [version, name] of [[1, '0001_event_log'], [2, '0002_auth']] as const) {
      const sql = (await readFile(new URL(`../../migrations/${name}.up.sql`, import.meta.url), 'utf8'))
        .replaceAll('{{schema}}', schema);
      await client.query(sql);
      await client.query(`INSERT INTO ${schema}.schema_migrations (version) VALUES ($1)`, [version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertLoginState(pool: Pool, n: number, opts: { createdAt: Date; consumed?: boolean }): Promise<void> {
  const hash = n.toString(16).padStart(64, '0');
  await pool.query(
    `INSERT INTO auth_login_states (state_hash, browser_hash, secret_cipher, return_to, created_at, expires_at, consumed_at)
     VALUES ($1, $1, $2, '/', $3, $4, $5)`,
    [hash, Buffer.from('x'), opts.createdAt, new Date(opts.createdAt.getTime() + 5 * 60_000),
      opts.consumed ? opts.createdAt : null],
  );
}

describe.skipIf(!enabled)('Scheibe 034a: migration 0003 and the purge of login states', () => {
  let admin: Pool;
  let owner: Pool;
  let runtime: Pool;
  let schema: string;

  beforeEach(async () => {
    admin = new Pool({ connectionString: ownerUrl });
    schema = await newSchema(admin);
    owner = new Pool({ connectionString: ownerUrl, options: `-c search_path=${schema}` });
    runtime = new Pool({ connectionString: runtimeUrl, options: `-c search_path=${schema}` });
  });

  afterEach(async () => {
    await Promise.all([runtime?.end(), owner?.end()]);
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
    vi.restoreAllMocks();
  });

  const functionExists = async (): Promise<boolean> => (await owner.query<{ present: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = $1 AND p.proname = 'auth_purge_login_states') AS present`, [schema])).rows[0]!.present;

  it('migrates up, down and up again with version 3 (function and index appear and disappear)', async () => {
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    expect((await owner.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version))
      .toEqual([1, 2, 3]);
    expect(await functionExists()).toBe(true);
    const index = await owner.query(`SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname = $1
      AND tablename = 'auth_login_states' AND indexdef LIKE '%(expires_at)%'`, [schema]);
    expect(index.rowCount).toBe(1);
    await runMigrations(owner, { direction: 'down' });
    expect(await functionExists()).toBe(false);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    expect(await functionExists()).toBe(true);
    expect((await getMigrationStatus(owner)).pending).toBe(false);
  });

  it('a refused down run rolls version 3 back with the rest (one transaction)', async () => {
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    await insertLoginState(owner, 1, { createdAt: minute(0) });
    // The whole down run refuses because of the populated auth table (version 2), but only after version 3
    // was undone in the same transaction, which is rolled back: nothing changes.
    await expect(runMigrations(owner, { direction: 'down' })).rejects.toThrow();
    expect(await functionExists()).toBe(true);
    expect((await owner.query('SELECT version FROM schema_migrations ORDER BY version')).rows.length).toBe(3);
  });

  it('the function removes consumed and expired rows only, at most 500 per call, keeps valid ones', async () => {
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    const now = minute(30);
    for (let n = 1; n <= 3; n += 1) await insertLoginState(owner, n, { createdAt: minute(29) }); // valid until 10:34
    await insertLoginState(owner, 10, { createdAt: minute(20), consumed: true });
    await insertLoginState(owner, 11, { createdAt: minute(29), consumed: true }); // consumed, not yet expired
    for (let n = 100; n < 100 + 520; n += 1) await insertLoginState(owner, n, { createdAt: minute(10) }); // expired
    const first = await runtime.query<{ n: number }>('SELECT auth_purge_login_states($1::timestamptz) AS n', [now]);
    expect(first.rows[0]!.n).toBe(500);
    const second = await runtime.query<{ n: number }>('SELECT auth_purge_login_states($1::timestamptz) AS n', [now]);
    expect(second.rows[0]!.n).toBe(22); // 20 expired left + the two consumed rows
    const left = (await owner.query<{ state_hash: string }>('SELECT state_hash FROM auth_login_states ORDER BY state_hash'))
      .rows.map((r) => Number.parseInt(r.state_hash, 16));
    expect(left).toEqual([1, 2, 3]);
  });

  it('catalog: SECURITY DEFINER, fixed search_path, owner of the table, no PUBLIC in the ACL, even without a runtime role', async () => {
    const saved = process.env['HV_DB_RUNTIME_ROLE'];
    delete process.env['HV_DB_RUNTIME_ROLE'];
    try {
      await runMigrations(owner, { direction: 'up' });
    } finally {
      if (saved !== undefined) process.env['HV_DB_RUNTIME_ROLE'] = saved;
    }
    const row = (await owner.query<{ prosecdef: boolean; proconfig: string[] | null; owner_ok: boolean; public_acl: boolean; acl_null: boolean }>(
      `SELECT p.prosecdef, p.proconfig, p.proowner = c.relowner AS owner_ok, p.proacl IS NULL AS acl_null,
         EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS public_acl
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       JOIN pg_catalog.pg_class c ON c.relname = 'auth_login_states' AND c.relnamespace = n.oid
       WHERE n.nspname = $1 AND p.proname = 'auth_purge_login_states'`, [schema])).rows[0]!;
    expect(row.prosecdef).toBe(true);
    expect(row.proconfig).toEqual(['search_path=pg_catalog, pg_temp']);
    expect(row.owner_ok).toBe(true);
    expect(row.acl_null).toBe(false);
    expect(row.public_acl).toBe(false);
    await expect(getMigrationStatus(owner)).resolves.toMatchObject({ pending: false });
  });

  it('the consistency check refuses a version-3 schema whose function is open to PUBLIC or not SECURITY DEFINER', async () => {
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    await owner.query(`GRANT EXECUTE ON FUNCTION ${schema}.auth_purge_login_states(timestamptz) TO PUBLIC`);
    await expect(getMigrationStatus(owner)).rejects.toThrow();
    await owner.query(`REVOKE ALL ON FUNCTION ${schema}.auth_purge_login_states(timestamptz) FROM PUBLIC`);
    await expect(getMigrationStatus(owner)).resolves.toMatchObject({ pending: false });
    await owner.query(`ALTER FUNCTION ${schema}.auth_purge_login_states(timestamptz) SECURITY INVOKER`);
    await expect(getMigrationStatus(owner)).rejects.toThrow();
    await owner.query(`ALTER FUNCTION ${schema}.auth_purge_login_states(timestamptz) SECURITY DEFINER`);
    await owner.query(`ALTER FUNCTION ${schema}.auth_purge_login_states(timestamptz) SET search_path = public`);
    await expect(getMigrationStatus(owner)).rejects.toThrow();
  });

  it.skipIf(runtimeRole === undefined)('runtime role: no DELETE on the table, EXECUTE on the function is the one named exception', async () => {
    await runMigrations(owner, { direction: 'up', runtimeRole: runtimeRole! });
    await expect(runtime.query('DELETE FROM auth_login_states')).rejects.toMatchObject({ code: '42501' });
    await expect(runtime.query('SELECT auth_purge_login_states($1::timestamptz)', [minute(0)])).resolves.toBeDefined();
    await expect(assertRuntimePrivileges(runtime)).resolves.toBeUndefined();
  });

  it.skipIf(runtimeRole === undefined)('assertRuntimePrivileges fails without EXECUTE on the function and with DELETE on a table', async () => {
    await runMigrations(owner, { direction: 'up', runtimeRole: runtimeRole! });
    await owner.query(`REVOKE EXECUTE ON FUNCTION ${schema}.auth_purge_login_states(timestamptz) FROM ${runtimeRole}`);
    await expect(assertRuntimePrivileges(runtime)).rejects.toThrow();
    await owner.query(`GRANT EXECUTE ON FUNCTION ${schema}.auth_purge_login_states(timestamptz) TO ${runtimeRole}`);
    await expect(assertRuntimePrivileges(runtime)).resolves.toBeUndefined();
    await owner.query(`GRANT DELETE ON TABLE ${schema}.auth_login_states TO ${runtimeRole}`);
    await expect(assertRuntimePrivileges(runtime)).rejects.toThrow();
  });

  it.skipIf(runtimeRole === undefined)('before migration 3 readiness says migrations_pending, not "db unreachable"', async () => {
    await migrateToVersionTwo(owner, schema);
    // The runtime login of the earlier state: table rights only, no function.
    await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${runtimeRole}`);
    await owner.query(`GRANT SELECT, INSERT ON events, persons, auth_login_states, auth_sessions, auth_subject_blocks TO ${runtimeRole}`);
    await owner.query(`GRANT SELECT ON schema_migrations TO ${runtimeRole}`);
    await owner.query(`GRANT INSERT ON auth_logout_ids TO ${runtimeRole}`);
    await owner.query(`GRANT UPDATE (consumed_at) ON auth_login_states TO ${runtimeRole}`);
    await owner.query(`GRANT UPDATE (idle_expires_at, revoked_at) ON auth_sessions TO ${runtimeRole}`);
    await expect(assertRuntimePrivileges(runtime, false)).resolves.toBeUndefined();
    await expect(assertRuntimePrivileges(runtime, true)).rejects.toThrow();
    const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => minute(0) });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ checks: { db: { status: 'ok' }, migrations: { status: 'fail', code: 'migrations_pending' } } });
  });

  it.skipIf(runtimeRole === undefined)('createLoginState purges consumed and expired rows first, keeps valid ones, at most 500 per call', async () => {
    await runMigrations(owner, { direction: 'up', runtimeRole: runtimeRole! });
    const store = createAuthStore(runtime, key);
    await insertLoginState(owner, 1, { createdAt: minute(29) }); // still valid at 10:30
    await insertLoginState(owner, 2, { createdAt: minute(10), consumed: true });
    for (let n = 100; n < 100 + 520; n += 1) await insertLoginState(owner, n, { createdAt: minute(10) });
    await store.createLoginState({ state: 's-one', browserCorrelation: 'b', nonce: 'n', pkceVerifier: 'v', returnTo: '/', now: minute(30) });
    // 521 removable rows (520 expired, one consumed), 500 removed by the first call; the new row, the valid
    // one and the 21 remaining removable rows stay.
    expect((await owner.query('SELECT count(*)::int AS n FROM auth_login_states')).rows[0].n).toBe(522 + 1 - 500);
    await store.createLoginState({ state: 's-two', browserCorrelation: 'b', nonce: 'n', pkceVerifier: 'v', returnTo: '/', now: minute(30, 1) });
    expect((await owner.query('SELECT count(*)::int AS n FROM auth_login_states')).rows[0].n).toBe(3);
  });

  it.skipIf(runtimeRole === undefined)('a purge failure does not block sign-in start and is reported once per minute on stderr', async () => {
    await runMigrations(owner, { direction: 'up', runtimeRole: runtimeRole! });
    await owner.query(`REVOKE EXECUTE ON FUNCTION ${schema}.auth_purge_login_states(timestamptz) FROM ${runtimeRole}`);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = createAuthStore(runtime, key);
    for (let i = 0; i < 3; i += 1) {
      await store.createLoginState({ state: `s-${i}`, browserCorrelation: 'b', nonce: 'n', pkceVerifier: 'v', returnTo: '/', now: minute(1, i) });
    }
    expect((await owner.query('SELECT count(*)::int AS n FROM auth_login_states')).rows[0].n).toBe(3);
    expect(errorLog.mock.calls.filter((call) => call[0] === 'HV-Tool API: login state purge failed.')).toHaveLength(1);
    await store.createLoginState({ state: 's-next', browserCorrelation: 'b', nonce: 'n', pkceVerifier: 'v', returnTo: '/', now: minute(2) });
    expect(errorLog.mock.calls.filter((call) => call[0] === 'HV-Tool API: login state purge failed.')).toHaveLength(2);
  });
});

// ---- pool timeouts, 503/500 mapping and the request timeout of the Postgres boundary ------------------------------

const meetingId = 'hv-2027';
const at = '2027-04-20T10:00:00.000Z';
const fixtureActor = { id: 'fixture', role: 'admin' as const };
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function fixtureEvents(): readonly DomainEvent[] {
  return createInMemoryEventStore().append([
    { id: 'create-2027', type: 'MeetingCreated', at, actor: fixtureActor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor: fixtureActor, subjectId: meetingId, meetingId, payload: {} },
  ] as NewEvent[]);
}

describe.skipIf(!enabled)('Scheibe 034a: Postgres boundary — timeouts, 503, 500 "outcome unknown", 408', () => {
  let admin: Pool;
  let owner: Pool;
  let schema: string;
  let pools: Pool[];
  let stderr: string[];

  beforeEach(async () => {
    pools = [];
    stderr = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { stderr.push(args.map(String).join(' ')); });
    admin = new Pool({ connectionString: ownerUrl });
    schema = await newSchema(admin);
    owner = new Pool({ connectionString: ownerUrl, options: `-c search_path=${schema}`, max: 4 });
    await runMigrations(owner, { direction: 'up', runtimeRole: runtimeRole! });
    for (const event of fixtureEvents()) {
      await owner.query(
        'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)]);
    }
  });

  afterEach(async () => {
    await Promise.all(pools.map((pool) => pool.end()));
    // A destroyed connection keeps its statement (and, in a write, the global write lock) until the server
    // notices: wait for the `pg_sleep` of the hooks so the next test does not queue behind it.
    for (let i = 0; i < 80; i += 1) {
      const busy = await admin.query(`SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND state = 'active' AND query LIKE 'SELECT pg_sleep(%'`);
      if (busy.rowCount === 0) break;
      await sleep(50);
    }
    await owner.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
    vi.restoreAllMocks();
  });

  const runtimePool = (limits: Parameters<typeof postgresPoolOptions>[0]['limits'] = {}): Pool => {
    const pool = new Pool(postgresPoolOptions({ connectionString: runtimeUrl!, limits,
      extra: { options: `-c search_path=${schema}`, max: 4 } }));
    pools.push(pool);
    return pool;
  };

  const build = (pool: Pool, over: Partial<CreateAppOptions> & { limits?: Partial<LimitsConfig> } = {}) => {
    let id = 0;
    const sink = createMemorySink();
    const app = createApp({ demoEnabled: true, postgres: pool, sourceOf: () => 'source-a',
      clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: () => `id-${++id}`,
      accessLog: { sink, hashKey: key }, ...over });
    return { app, sink, lines: () => sink.lines.map((line) => JSON.parse(line) as { status: number }) };
  };

  const eventCount = async (): Promise<number> =>
    (await owner.query<{ n: number }>('SELECT count(*)::int AS n FROM events')).rows[0]!.n;

  const speakerTag = async (app: ReturnType<typeof build>['app']): Promise<string> => {
    const read = await app.request(`/v1/meetings/${meetingId}/speakers`, { headers: { 'X-Actor': ACTOR.admin } });
    expect(read.status).toBe(200);
    return read.headers.get('ETag')!;
  };

  const postSpeaker = (app: ReturnType<typeof build>['app'], tag: string, name: string, idempotencyKey?: string): Promise<Response> =>
    Promise.resolve(app.request(`/v1/meetings/${meetingId}/speakers`, { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json', 'If-Match': tag,
        ...(idempotencyKey === undefined ? {} : { 'Idempotency-Key': idempotencyKey }) },
      body: JSON.stringify({ displayName: name, round: 1 }) }));

  const register = async (app: ReturnType<typeof build>['app'], name: string, idempotencyKey?: string): Promise<Response> =>
    postSpeaker(app, await speakerTag(app), name, idempotencyKey);

  /** Holds the global write lock on a connection of its own until `release()` is called. */
  const holdWriteLock = async (): Promise<{ release: () => Promise<void> }> => {
    const client = await owner.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [27027, 1]);
    return { release: async () => { await client.query('ROLLBACK'); client.release(); } };
  };

  it('the pool from the factory carries statement_timeout 5s, lock_timeout 3s, idle-in-transaction 15s and no driver query_timeout', async () => {
    const options = postgresPoolOptions({ connectionString: runtimeUrl! });
    expect(options).not.toHaveProperty('query_timeout');
    expect(options.connectionTimeoutMillis).toBe(2_000);
    expect(options).not.toHaveProperty('ssl');
    expect(postgresPoolOptions({ connectionString: runtimeUrl!, tls: true }).ssl).toEqual({ rejectUnauthorized: true });
    const pool = runtimePool();
    const shown = async (name: string): Promise<string> =>
      (await pool.query<Record<string, string>>(`SHOW ${name}`)).rows[0]![name]!;
    expect(await shown('statement_timeout')).toBe('5s');
    expect(await shown('lock_timeout')).toBe('3s');
    expect(await shown('idle_in_transaction_session_timeout')).toBe('15s');
    expect(await shown('client_connection_check_interval')).toBe('1s'); // and the test's search_path still applies
    expect((await pool.query<{ s: string }>('SELECT current_schema() AS s')).rows[0]!.s).toBe(schema);
  });

  it('408 in the Postgres path: a request that waited past its budget for the write lock commits nothing and stops early; the retry runs exactly once', async () => {
    const pool = runtimePool();
    const sql: string[] = [];
    pool.on('connect', (client) => {
      const original = client.query.bind(client) as (...args: unknown[]) => unknown;
      (client as unknown as { query: unknown }).query = (...args: unknown[]) => {
        const first = args[0];
        sql.push(typeof first === 'string' ? first : String((first as { text?: string }).text));
        return original(...args);
      };
    });
    const { app, lines } = build(pool, { limits: { requestTimeoutMs: 200 } });
    const tag = await speakerTag(app);
    sql.length = 0;
    const lock = await holdWriteLock();
    const started = performance.now();
    const outcome = await postSpeaker(app, tag, 'Erste Testperson', 'retry-key');
    expect(outcome.status).toBe(408);
    expect(performance.now() - started).toBeLessThan(1_500);
    await sleep(300); // the lock is still held; now it ends and the late boundary must roll back
    await lock.release();
    await sleep(500);
    expect(await eventCount()).toBe(2);
    expect(lines().filter((line) => line.status === 408)).toHaveLength(1);
    // Early exit after the lock: no snapshot was loaded, nothing was inserted, the transaction was rolled back.
    expect(sql.some((text) => /FROM events ORDER BY seq/.test(text))).toBe(false);
    expect(sql.some((text) => /INSERT INTO events/.test(text))).toBe(false);
    expect(sql).toContain('ROLLBACK');
    const { app: retry } = build(runtimePool());
    const first = await register(retry, 'Erste Testperson', 'retry-key');
    expect(first.status).toBe(201);
    const again = await register(retry, 'Erste Testperson', 'retry-key');
    expect(again.status).toBe(201);
    expect((await again.json() as { id: string }).id).toBe((await first.json() as { id: string }).id);
    expect(await eventCount()).toBe(3);
  });

  it('a request that ran out of time in the pre-checks takes no lock and no transaction', async () => {
    const pool = runtimePool();
    const sql: string[] = [];
    pool.on('connect', (client) => {
      const original = client.query.bind(client) as (...args: unknown[]) => unknown;
      (client as unknown as { query: unknown }).query = (...args: unknown[]) => {
        const first = args[0];
        sql.push(typeof first === 'string' ? first : String((first as { text?: string }).text));
        return original(...args);
      };
    });
    const { app } = build(pool, { limits: { requestTimeoutMs: 1 } });
    const res = await app.request(`/v1/meetings/${meetingId}/speakers`, { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json', 'If-Match': '"v1"' },
      body: JSON.stringify({ displayName: 'Zu spät', round: 1 }) });
    expect(res.status).toBe(408);
    await sleep(500);
    expect(sql.length).toBeGreaterThan(0); // the pre-checks ran
    expect(sql.some((text) => /pg_advisory_xact_lock/.test(text))).toBe(false);
    expect(sql.some((text) => /^BEGIN/.test(text))).toBe(false);
    expect(await eventCount()).toBe(2);
  });

  it('a COMMIT that is already on its way wins over the timer: 201, not 408', async () => {
    const { app, lines } = build(runtimePool(), { limits: { requestTimeoutMs: 200 },
      testHooks: { at: async (point, run) => { if (point === 'beforeCommit') await run('SELECT pg_sleep(0.6)'); } } });
    const res = await register(app, 'Spät festgeschrieben');
    expect(res.status).toBe(201);
    expect(await eventCount()).toBe(3);
    expect(lines().filter((line) => line.status === 201)).toHaveLength(1);
    expect(lines().some((line) => line.status === 408)).toBe(false);
  });

  it('statement_timeout answers 503 with a fixed text and Retry-After 2, no driver text, no event; the connection is kept', async () => {
    const pool = runtimePool({ statementTimeoutMs: 300 });
    const { app } = build(pool, { testHooks: { at: async (point, run) => { if (point === 'afterLock') await run('SELECT pg_sleep(2)'); } } });
    await app.request('/v1/meetings', { headers: { 'X-Actor': ACTOR.admin } }); // one connection in the pool
    expect(pool.totalCount).toBe(1);
    const res = await register(app, 'Wird abgebrochen');
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('2');
    const body = await res.text();
    expect(JSON.parse(body)).toMatchObject({ status: 503, detail: 'Persistence is busy.' });
    expect(body).not.toMatch(/statement timeout|canceling/i);
    expect(stderr.join('\n')).not.toMatch(/statement timeout|canceling/i);
    expect(stderr).toContain('HV-Tool API: persistence busy.');
    expect(await eventCount()).toBe(2);
    expect(pool.totalCount).toBe(1); // 57014 is a server answer: the connection was rolled back and stays in the pool
  });

  it('statement_timeout while the snapshot is loaded answers 503 as well (N2)', async () => {
    const pool = runtimePool({ statementTimeoutMs: 300 });
    const { app } = build(pool);
    const blocker = await owner.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE events IN ACCESS EXCLUSIVE MODE');
      const res = await app.request('/v1/meetings', { headers: { 'X-Actor': ACTOR.admin } });
      expect(res.status).toBe(503);
      expect(res.headers.get('Retry-After')).toBe('2');
      expect(await res.text()).not.toMatch(/statement timeout|canceling/i);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    expect((await app.request('/v1/meetings', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
  });

  it('a query that hangs past the service timer before the COMMIT answers 503; the connection is destroyed, no event (T-G2-I-02)', async () => {
    const pool = runtimePool(); // statement_timeout stays at 5 s, above the 200 ms timer of the test
    // The timer must be far above the fast checks in front of the transaction (about a dozen round trips).
    let reached = false;
    const { app } = build(pool, { limits: { queryTimeoutMs: 500 },
      testHooks: { at: async (point, run) => { if (point === 'afterLock') { reached = true; await run('SELECT pg_sleep(1.5)'); } } } });
    await app.request('/v1/meetings', { headers: { 'X-Actor': ACTOR.admin } }); // one connection in the pool
    expect(pool.totalCount).toBe(1);
    const res = await register(app, 'Hängt');
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('2');
    expect((await res.json() as { detail: string }).detail).toBe('Persistence is busy.');
    expect(reached).toBe(true);
    expect(pool.totalCount).toBe(0); // destroyed, not returned
    expect(await eventCount()).toBe(2);
  });

  it('a COMMIT phase that hangs past the service timer answers 500 "outcome unknown" without Retry-After; the connection is destroyed (N3)', async () => {
    const pool = runtimePool();
    let reached = false;
    const { app } = build(pool, { limits: { queryTimeoutMs: 500 },
      testHooks: { at: async (point, run) => { if (point === 'beforeCommit') { reached = true; await run('SELECT pg_sleep(1.5)'); } } } });
    await app.request('/v1/meetings', { headers: { 'X-Actor': ACTOR.admin } });
    expect(pool.totalCount).toBe(1);
    const res = await register(app, 'Unklar');
    expect(res.status).toBe(500);
    expect(res.headers.get('Retry-After')).toBeNull();
    expect(await res.json()).toMatchObject({ status: 500, detail: 'Persistence outcome is unknown.' });
    expect(reached).toBe(true);
    expect(pool.totalCount).toBe(0);
  });

  it('migrations pending answer 503 with Retry-After 30 and the fixed text (N4)', async () => {
    const pool = runtimePool();
    const { app } = build(pool);
    // Back to the state before migration 0003 (the down run would refuse: the event log is populated).
    await owner.query(`DROP INDEX ${schema}.auth_login_states_expires_idx`);
    await owner.query(`DROP FUNCTION ${schema}.auth_purge_login_states(timestamptz)`);
    await owner.query('DELETE FROM schema_migrations WHERE version = 3');
    const res = await app.request('/v1/meetings', { headers: { 'X-Actor': ACTOR.admin } });
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(await res.json()).toMatchObject({ status: 503, detail: 'Migrations are pending.' });
  });

  it('a write that waits longer than lock_timeout for the write lock answers 503 (T-G2-D-01); the retry with the same key runs once', async () => {
    const { app } = build(runtimePool());
    const lock = await holdWriteLock();
    const started = performance.now();
    const blocked = await register(app, 'Wartet', 'queue-key');
    const waited = performance.now() - started;
    expect(blocked.status).toBe(503);
    expect(blocked.headers.get('Retry-After')).toBe('2');
    expect(waited).toBeGreaterThanOrEqual(2_800);
    expect(waited).toBeLessThan(4_800);
    expect(await eventCount()).toBe(2);
    await lock.release();
    const first = await register(app, 'Wartet', 'queue-key');
    expect(first.status).toBe(201);
    expect((await register(app, 'Wartet', 'queue-key')).status).toBe(201);
    expect(await eventCount()).toBe(3);
  }, 15_000);

  it('the sign-in store runs under the query timer: a hung table ends in QueryTimeoutError and a destroyed connection', async () => {
    const pool = runtimePool();
    const store = createAuthStore(pool, key, { queryTimeoutMs: 200 });
    expect(await store.readSession('a'.repeat(43), minute(0), false)).toBeNull(); // one connection in the pool
    expect(pool.totalCount).toBe(1);
    const blocker = await owner.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE auth_sessions IN ACCESS EXCLUSIVE MODE');
      await expect(store.readSession('a'.repeat(43), minute(0), false)).rejects.toBeInstanceOf(QueryTimeoutError);
      expect(pool.totalCount).toBe(0);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    expect(await store.readSession('a'.repeat(43), minute(0), false)).toBeNull();
  });
});
