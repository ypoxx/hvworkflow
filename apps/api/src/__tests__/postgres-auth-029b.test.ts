import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createAuthStore } from '../auth/store.ts';
import { assertRuntimePrivileges } from '../persistence/postgres.ts';
import { runMigrations } from '../persistence/migrations.ts';

const ownerUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const key = randomBytes(32);
const instant = (minute: number) => new Date(Date.UTC(2027, 3, 20, 10, minute));

it('rejects a session encryption key of the wrong length', () => {
  expect(() => createAuthStore({} as Pool, randomBytes(16))).toThrow();
});

describe.skipIf(ownerUrl === undefined || runtimeUrl === undefined)('Scheibe 029b: durable auth store', () => {
  let schema: string;
  let owner: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let admin: Pool;

  beforeEach(async () => {
    schema = `hv029b_${randomUUID().replaceAll('-', '')}`;
    admin = new Pool({ connectionString: ownerUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    owner = new Pool({ connectionString: ownerUrl, options: `-c search_path=${schema}` });
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    firstPool = new Pool({ connectionString: runtimeUrl, options: `-c search_path=${schema}` });
    secondPool = new Pool({ connectionString: runtimeUrl, options: `-c search_path=${schema}` });
  });

  afterEach(async () => {
    await Promise.all([firstPool?.end(), secondPool?.end(), owner?.end()]);
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  it('consumes a matching login state once across processes without accepting another browser', async () => {
    const first = createAuthStore(firstPool, key);
    const second = createAuthStore(secondPool, key);
    await first.createLoginState({ state: 'secret-state', browserCorrelation: 'browser-one', nonce: 'secret-nonce',
      pkceVerifier: 'secret-verifier', returnTo: '/v1/meetings', now: instant(0) });
    expect(await second.consumeLoginState({ state: 'secret-state', browserCorrelation: 'browser-two', now: instant(1) })).toBeNull();
    const results = await Promise.all([
      first.consumeLoginState({ state: 'secret-state', browserCorrelation: 'browser-one', now: instant(1) }),
      second.consumeLoginState({ state: 'secret-state', browserCorrelation: 'browser-one', now: instant(1) }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)).toEqual({ nonce: 'secret-nonce', pkceVerifier: 'secret-verifier', returnTo: '/v1/meetings' });
    const stored = (await owner.query<{ state_hash: string; browser_hash: string; secret_cipher: Buffer }>(
      'SELECT state_hash, browser_hash, secret_cipher FROM auth_login_states',
    )).rows[0]!;
    expect(JSON.stringify(stored)).not.toContain('secret-state');
    expect(JSON.stringify(stored)).not.toContain('secret-verifier');
  });

  it('rejects an expired login state without producing a session', async () => {
    const first = createAuthStore(firstPool, key);
    const second = createAuthStore(secondPool, key);
    await first.createLoginState({ state: 'expired-state', browserCorrelation: 'browser', nonce: 'nonce',
      pkceVerifier: 'verifier', returnTo: '/', now: instant(0) });
    expect(await second.consumeLoginState({ state: 'expired-state', browserCorrelation: 'browser', now: instant(5) })).toBeNull();
    expect((await owner.query('SELECT * FROM auth_sessions')).rows).toEqual([]);
  });

  it('shares sessions, CSRF checks, revocation and blocks across processes', async () => {
    const first = createAuthStore(firstPool, key);
    const second = createAuthStore(secondPool, key);
    const session = await first.createSession({ actorId: 'oidc_test-subject', refreshToken: 'secret-refresh', now: instant(0) });
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.expiresAt).toEqual(new Date(Date.UTC(2027, 3, 21, 0, 0)));
    const read = await second.readSession(session.token, instant(1));
    expect(read).toMatchObject({ actorId: 'oidc_test-subject', csrfToken: session.csrfToken, refreshToken: 'secret-refresh' });
    expect(await second.verifyCsrf(session.token, 'wrong', instant(2))).toBe(false);
    expect(await second.verifyCsrf(session.token, session.csrfToken, instant(2))).toBe(true);
    const row = (await owner.query<{ session_hash: string; csrf_cipher: Buffer; refresh_cipher: Buffer }>(
      'SELECT session_hash, csrf_cipher, refresh_cipher FROM auth_sessions',
    )).rows[0]!;
    expect(JSON.stringify(row)).not.toContain(session.token);
    expect(JSON.stringify(row)).not.toContain(session.csrfToken);
    expect(JSON.stringify(row)).not.toContain('secret-refresh');
    await second.blockSubject('oidc_test-subject', instant(3));
    expect(await first.isSubjectBlocked('oidc_test-subject')).toBe(true);
    expect(await first.readSession(session.token, instant(3))).toBeNull();
    expect(await first.verifyCsrf(session.token, session.csrfToken, instant(3))).toBe(false);
    await expect(second.createSession({ actorId: 'oidc_test-subject', now: instant(4) })).rejects.toThrow();
  });

  it('enforces 30-minute idle and 14-hour absolute limits and one-time logout', async () => {
    const first = createAuthStore(firstPool, key);
    const second = createAuthStore(secondPool, key);
    const idle = await first.createSession({ actorId: 'oidc_idle', now: instant(0) });
    expect(await second.readSession(idle.token, instant(29), false)).toMatchObject({ actorId: 'oidc_idle' });
    expect(await second.verifyCsrf(idle.token, 'wrong', instant(29))).toBe(false);
    const idleRow = await owner.query<{ idle_expires_at: Date }>(
      'SELECT idle_expires_at FROM auth_sessions WHERE actor_id = $1', ['oidc_idle'],
    );
    expect(idleRow.rows[0]?.idle_expires_at).toEqual(instant(30));
    expect(await first.readSession(idle.token, instant(30))).toBeNull();
    const refreshed = await first.createSession({ actorId: 'oidc_refreshed', now: instant(0) });
    expect(await second.readSession(refreshed.token, instant(29))).not.toBeNull();
    expect(await first.readSession(refreshed.token, instant(58))).not.toBeNull();
    expect(await second.readSession(refreshed.token, instant(89))).toBeNull();
    const absolute = await first.createSession({ actorId: 'oidc_absolute', now: instant(0) });
    for (let minute = 29; minute < 840; minute += 29) {
      expect(await second.readSession(absolute.token, instant(minute))).not.toBeNull();
    }
    expect(await first.readSession(absolute.token, instant(840))).toBeNull();
    const logout = await first.createSession({ actorId: 'oidc_logout', now: instant(0) });
    expect(await second.revokeSession(logout.token)).toBe(true);
    expect(await first.revokeSession(logout.token)).toBe(false);
    expect(await first.readSession(logout.token, instant(1))).toBeNull();
  });

  it('peeks without extending or restoring blocked and expired sessions', async () => {
    const first = createAuthStore(firstPool, key);
    const second = createAuthStore(secondPool, key);
    const blocked = await first.createSession({ actorId: 'oidc_blocked', now: instant(0) });
    await second.blockSubject('oidc_blocked', instant(1));
    expect(await first.readSession(blocked.token, instant(1), false)).toBeNull();
    const expired = await first.createSession({ actorId: 'oidc_expired', now: instant(0) });
    expect(await second.readSession(expired.token, instant(30), false)).toBeNull();
  });

  it('keeps runtime privileges narrow for events, persons and auth tables', async () => {
    await expect(assertRuntimePrivileges(firstPool)).resolves.toBeUndefined();
    await expect(firstPool.query(`UPDATE events SET id = 'bad'`)).rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`DELETE FROM persons`)).rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`DELETE FROM auth_sessions`)).rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`SELECT * FROM auth_logout_ids`)).rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`UPDATE auth_sessions SET actor_id = 'oidc_another'`))
      .rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP`))
      .rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`UPDATE auth_login_states SET return_to = '/elsewhere'`))
      .rejects.toMatchObject({ code: '42501' });
    await expect(firstPool.query(`CREATE TABLE forbidden_by_runtime (id integer)`)).rejects.toMatchObject({ code: '42501' });
  });
});
