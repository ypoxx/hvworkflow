/**
 * Scheibe 029b: a real browser + official Keycloak + Postgres smoke test.
 * Every identity and secret exists only for this CI run. Never print browser traces or tokens.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(pathToFileURL(join(root, 'apps/api/package.json')));
const webRequire = createRequire(pathToFileURL(join(root, 'apps/web/package.json')));
const image = 'quay.io/keycloak/keycloak:26.7.4';
const keycloakPort = 18080;
const apiPort = 18081;
const realmName = 'hv-ci-029b';
const issuer = `http://localhost:${keycloakPort}/realms/${realmName}`;
const apiOrigin = `http://localhost:${apiPort}`;
const callback = `${apiOrigin}/auth/callback`;
const randomSecret = () => randomBytes(32).toString('base64url');
let stage = 'setup';

function realmFixture() {
  const identity = {
    adminName: `admin-${randomUUID()}`,
    adminPassword: randomSecret(),
    clientId: `hv-ci-${randomUUID()}`,
    clientSecret: randomSecret(),
    userId: randomUUID(),
    username: `synthetic-${randomUUID()}`,
    userPassword: randomSecret(),
  };
  const realm = {
    realm: realmName,
    enabled: true,
    registrationAllowed: false,
    resetPasswordAllowed: false,
    clients: [{
      clientId: identity.clientId,
      enabled: true,
      protocol: 'openid-connect',
      publicClient: false,
      secret: identity.clientSecret,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: [callback],
      webOrigins: [apiOrigin],
    }],
    users: [{
      id: identity.userId,
      username: identity.username,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: identity.userPassword, temporary: false }],
    }],
  };
  return { identity, realm };
}

function checkFixture() {
  assert.match(image, /^quay\.io\/keycloak\/keycloak:\d+\.\d+\.\d+$/);
  const { identity, realm } = realmFixture();
  assert.equal(realm.clients[0].secret, identity.clientSecret);
  assert.equal(realm.users[0].id, identity.userId);
  assert.equal(realm.clients[0].redirectUris[0], callback);
  assert.equal(realm.users[0].credentials[0].value, identity.userPassword);
  assert.notEqual(identity.clientSecret, identity.userPassword);
  console.log('029b Keycloak fixture structure: PASS');
}

async function waitForHttp(url, expectedStatus, timeoutMs, child) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('API process exited before it became ready.');
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status === expectedStatus) return response;
    } catch { /* startup can temporarily refuse connections */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Timed out waiting for ${new URL(url).pathname}.`);
}

async function stopApi(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function bootstrapMeeting(ownerUrl, userId) {
  const { Pool } = apiRequire('pg');
  const { actorIdForIdentity } = await import('../apps/api/src/auth/oidc.ts');
  const { createInMemoryEventStore, createInProcessApi, SYSTEM_ACTOR } = await import('../packages/domain/src/index.ts');
  const meetingId = `hv-ci-${randomUUID()}`;
  const store = createInMemoryEventStore();
  store.append([{ id: randomUUID(), type: 'MeetingCreated', at: new Date().toISOString(),
    actor: SYSTEM_ACTOR, subjectId: meetingId, meetingId,
    payload: { title: 'Synthetic CI meeting', date: '2027-04-20', agendaItems: [], units: [] } }]);
  const domain = createInProcessApi({ store, meetingId, actor: () => SYSTEM_ACTOR,
    clock: () => new Date(), idGenerator: randomUUID });
  const actorId = actorIdForIdentity(issuer, userId);
  await domain.assignRole({ subjectId: actorId, role: 'moderation' });
  const owner = new Pool({ connectionString: ownerUrl, connectionTimeoutMillis: 3_000 });
  const db = await owner.connect();
  try {
    const migrations = await db.query('SELECT version FROM schema_migrations ORDER BY version');
    assert(migrations.rows.some((row) => Number(row.version) === 2), 'Auth migration is missing.');
    await db.query('BEGIN');
    for (const event of store.all()) {
      await db.query('INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)]);
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
    await owner.end();
  }
  return { actorId, meetingId };
}

async function sessionCount(ownerUrl) {
  const { Pool } = apiRequire('pg');
  const owner = new Pool({ connectionString: ownerUrl, connectionTimeoutMillis: 3_000 });
  try {
    const result = await owner.query('SELECT COUNT(*)::integer AS total FROM auth_sessions');
    return result.rows[0].total;
  } finally {
    await owner.end();
  }
}

function startApi(runtimeUrl, identity, encryptionKey) {
  const env = {
    ...process.env,
    PORT: String(apiPort),
    HV_DATABASE_URL: runtimeUrl,
    HV_OIDC_ISSUER: issuer,
    HV_OIDC_CLIENT_ID: identity.clientId,
    HV_OIDC_CLIENT_SECRET: identity.clientSecret,
    HV_OIDC_REDIRECT_URI: callback,
    HV_AUTH_ENCRYPTION_KEY: encryptionKey,
  };
  delete env.HV_DEMO;
  delete env.HV_EVENT_LOG;
  const child = spawn(process.execPath,
    ['--import', join(root, 'apps/api/node_modules/tsx/dist/loader.mjs'), join(root, 'apps/api/src/server.ts')],
    { cwd: root, env, stdio: 'ignore' });
  return child;
}

async function checkBrowserFlow(identity, expectedActorId, meetingId) {
  const { chromium } = webRequire('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const loginResponse = await page.goto(`${apiOrigin}/auth/login?returnTo=%2Fv1%2Fmeeting`);
    assert.equal(loginResponse?.status(), 200, 'Keycloak login form did not load.');
    const authorization = new URL(page.url());
    assert.equal(authorization.origin, `http://localhost:${keycloakPort}`);
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert(authorization.searchParams.get('code_challenge'));
    assert(authorization.searchParams.get('state'));
    assert(authorization.searchParams.get('nonce'));
    await page.locator('#username').fill(identity.username);
    await page.locator('#password').fill(identity.userPassword);
    const callbackResponse = page.waitForResponse((response) => response.url().startsWith(`${apiOrigin}/auth/callback?`));
    await page.locator('#kc-login').click();
    const completed = await callbackResponse;
    assert.equal(completed.status(), 302, 'OIDC callback was not accepted.');
    const cookies = (await completed.headersArray())
      .filter((header) => header.name.toLowerCase() === 'set-cookie').map((header) => header.value);
    assert.equal(cookies.length, 2, 'Callback must send two separate Set-Cookie fields.');
    assert.equal(cookies.filter((line) => line.startsWith('hv_session=')).length, 1);
    assert.equal(cookies.filter((line) => line.startsWith('hv_auth_state=') && line.includes('Max-Age=0')).length, 1);
    await page.waitForURL(`${apiOrigin}/v1/meeting`);

    const me = await page.evaluate(async () => {
      const response = await fetch('/auth/me', { headers: { 'X-Actor': 'attacker:admin' } });
      return { status: response.status, cache: response.headers.get('Cache-Control'), body: await response.json() };
    });
    assert.equal(me.status, 200);
    assert.equal(me.cache, 'no-store');
    assert.equal(me.body.scheme, 'session');
    assert.equal(me.body.subjectId, expectedActorId);
    assert.equal(me.body.actor.role, 'moderation');
    assert.deepEqual(me.body.roles, ['moderation']);
    assert.match(me.body.csrfToken, /^[A-Za-z0-9_-]{43}$/);

    const mutation = await page.evaluate(async ({ meetingId: id, csrfToken }) => {
      const route = `/v1/meetings/${id}/speakers`;
      const before = await fetch(route);
      const tag = before.headers.get('ETag');
      const body = JSON.stringify({ displayName: 'Synthetic CI speaker', round: 1 });
      const rejected = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'If-Match': tag }, body });
      const accepted = await fetch(route, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'If-Match': tag, 'X-CSRF-Token': csrfToken,
        'X-Actor': 'attacker:admin',
      }, body });
      return { read: before.status, tag, rejected: rejected.status, accepted: accepted.status };
    }, { meetingId, csrfToken: me.body.csrfToken });
    assert.equal(mutation.read, 200);
    assert.match(mutation.tag, /^"v\d+"$/);
    assert.equal(mutation.rejected, 403, 'Missing CSRF token must reject a mutation.');
    assert.equal(mutation.accepted, 201, 'Signed-in moderation actor must be able to register a speaker.');

    const logout = await page.evaluate(async (csrfToken) => {
      const response = await fetch('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
      return { status: response.status, after: (await fetch('/auth/me')).status };
    }, me.body.csrfToken);
    assert.equal(logout.status, 204);
    assert.equal(logout.after, 401);
    console.log('029b Keycloak browser login, role, CSRF, write and logout: PASS');
  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.argv.includes('--check')) { checkFixture(); return; }
  const ownerUrl = process.env.TEST_DATABASE_URL;
  const runtimeUrl = process.env.TEST_RUNTIME_DATABASE_URL;
  assert(ownerUrl && runtimeUrl, 'TEST_DATABASE_URL and TEST_RUNTIME_DATABASE_URL are required.');
  const { identity, realm } = realmFixture();
  const encryptionKey = randomSecret();
  const temp = await mkdtemp(join(tmpdir(), 'hv-keycloak-029b-'));
  const container = `hv-keycloak-029b-${randomUUID()}`;
  let api;
  let containerStarted = false;
  try {
    stage = 'Keycloak startup';
    const realmFile = join(temp, 'realm.json');
    const envFile = join(temp, 'keycloak.env');
    await writeFile(realmFile, JSON.stringify(realm), { mode: 0o644 });
    await writeFile(envFile, `KC_BOOTSTRAP_ADMIN_USERNAME=${identity.adminName}\nKC_BOOTSTRAP_ADMIN_PASSWORD=${identity.adminPassword}\n`, { mode: 0o600 });
    containerStarted = true;
    await execFile('docker', ['run', '--detach', '--rm', '--name', container,
      '-p', `127.0.0.1:${keycloakPort}:8080`, '--env-file', envFile,
      '-v', `${realmFile}:/opt/keycloak/data/import/realm.json:ro`, image,
      'start-dev', '--import-realm', `--hostname=http://localhost:${keycloakPort}`],
    { cwd: root, timeout: 120_000 });
    await waitForHttp(`${issuer}/.well-known/openid-configuration`, 200, 120_000);
    stage = 'synthetic Postgres bootstrap';
    const { actorId, meetingId } = await bootstrapMeeting(ownerUrl, identity.userId);
    stage = 'service startup';
    api = startApi(runtimeUrl, identity, encryptionKey);
    await waitForHttp(`${apiOrigin}/readyz`, 200, 30_000, api);
    stage = 'browser login and role flow';
    await checkBrowserFlow(identity, actorId, meetingId);
    const sessionsBeforeOutage = await sessionCount(ownerUrl);
    await stopApi(api);
    api = undefined;
    stage = 'IdP outage';
    await execFile('docker', ['rm', '-f', container], { timeout: 10_000 });
    containerStarted = false;
    api = startApi(runtimeUrl, identity, encryptionKey);
    await waitForHttp(`${apiOrigin}/readyz`, 200, 30_000, api);
    const unavailable = await fetch(`${apiOrigin}/auth/login`, { redirect: 'manual' });
    assert.equal(unavailable.status, 503, 'A fresh login must fail closed while Keycloak is unavailable.');
    assert.equal(await sessionCount(ownerUrl), sessionsBeforeOutage, 'An IdP outage must not create a session.');
    console.log('029b IdP outage blocks a new login: PASS');
  } finally {
    await stopApi(api);
    if (containerStarted) await execFile('docker', ['rm', '-f', container], { timeout: 10_000 }).catch(() => {});
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch(() => {
  // Provider and driver errors can embed credentials; report only the safe stage.
  console.error(`029b Keycloak integration failed during ${stage}.`);
  process.exitCode = 1;
});
