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
import { createApp } from '../app.ts';
import { createAuthStore } from '../auth/store.ts';
import { getMigrationStatus, runMigrations } from '../persistence/migrations.ts';
import { assertRuntimePrivileges } from '../persistence/postgres.ts';

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
