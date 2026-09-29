/**
 * Scheibe 029b: a real browser + official Keycloak + Postgres smoke test.
 * Every identity and secret exists only for this CI run. Never print browser traces or tokens.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
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
      email: `${identity.username}@example.test`,
      firstName: 'Synthetic',
      lastName: 'Testperson',
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
  assert.match(realm.users[0].email, /@example\.test$/);
  assert(realm.users[0].firstName && realm.users[0].lastName);
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

async function waitForApi(child) {
  // Clock/NTP readiness exists since 033a, but this run configures no HV_NTP_SERVERS (no outbound
  // network in CI), so /readyz stays 503 with `not_configured` even when Postgres and its migrations
  // are healthy; the public notice proves the HTTP server is up.
  await waitForHttp(`${apiOrigin}/auth/transparency-notice`, 200, 30_000, child);
  const response = await fetch(`${apiOrigin}/readyz`);
  const body = await response.json();
  assert.equal(body.checks.db.status, 'ok', 'The API runtime login must reach Postgres.');
  assert.equal(body.checks.migrations.status, 'ok', 'The API must see the applied migrations.');
  if (response.status === 503) {
    assert.equal(body.checks.clock.code, 'not_configured', 'Only the future clock probe may hold readiness.');
  } else {
    assert.equal(response.status, 200);
  }
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

// Scheibe 033a: the access log is mandatory outside demo mode. Directory and HMAC key exist only
// for this run; afterwards the files are checked for anything that must never reach the log.
function startApi(runtimeUrl, identity, encryptionKey, accessLog) {
  const env = {
    ...process.env,
    PORT: String(apiPort),
    HV_DATABASE_URL: runtimeUrl,
    HV_OIDC_ISSUER: issuer,
    HV_OIDC_CLIENT_ID: identity.clientId,
    HV_OIDC_CLIENT_SECRET: identity.clientSecret,
    HV_OIDC_REDIRECT_URI: callback,
    HV_AUTH_ENCRYPTION_KEY: encryptionKey,
    HV_ACCESS_LOG_DIR: accessLog.dir,
    HV_ACCESS_LOG_HASH_KEY: accessLog.key,
    HV_TRANSPARENCY_NOTICE_VERSION: 'ci-synthetic-1',
    HV_TRANSPARENCY_NOTICE_DE: 'Unbestätigter synthetischer CI-Hinweis.',
    HV_TRANSPARENCY_NOTICE_EN: 'Unreviewed synthetic CI notice.',
  };
  delete env.HV_DEMO;
  delete env.HV_EVENT_LOG;
  const child = spawn(process.execPath,
    ['--import', join(root, 'apps/api/node_modules/tsx/dist/loader.mjs'), join(root, 'apps/api/src/server.ts')],
    { cwd: root, env, stdio: 'ignore' });
  return child;
}

async function checkAccessLog(dir, forbidden) {
  const files = (await readdir(dir)).filter((name) => /^access-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name));
  assert(files.length > 0, 'The access log must contain at least one daily file.');
  const keys = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];
  let lines = 0;
  for (const name of files) {
    const text = await readFile(join(dir, name), 'utf8');
    for (const value of forbidden) assert(!text.includes(value), 'The access log holds a secret, token, cookie or actor id.');
    for (const line of text.split('\n').filter(Boolean)) {
      assert.deepEqual(Object.keys(JSON.parse(line)).sort(), keys, 'Every access log line has exactly the eight keys.');
      lines += 1;
    }
  }
  assert(lines > 0, 'The browser run must have produced access log lines.');
  console.log('033a access log holds no secret, token, cookie or actor id: PASS');
}

async function checkBrowserFlow(identity, expectedActorId, meetingId) {
  stage = 'pre-login notice';
  const noticeResponse = await fetch(`${apiOrigin}/auth/transparency-notice`);
  assert.equal(noticeResponse.status, 200, 'The DE/EN notice must be readable before login.');
  const notice = await noticeResponse.json();
  assert(notice.text.de && notice.text.en);
  const { chromium } = webRequire('@playwright/test');
  stage = 'browser launch';
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    stage = 'Keycloak login form';
    const loginResponse = await page.goto(`${apiOrigin}/auth/login?returnTo=%2Fv1%2Fmeeting`);
    assert.equal(loginResponse?.status(), 200, 'Keycloak login form did not load.');
    const authorization = new URL(page.url());
    assert.equal(authorization.origin, `http://localhost:${keycloakPort}`);
    assert.equal(authorization.searchParams.get('response_type'), 'code');
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
    assert(authorization.searchParams.get('code_challenge'));
    assert(authorization.searchParams.get('state'));
    assert(authorization.searchParams.get('nonce'));
    stage = 'Keycloak credential form';
    await page.locator('#username').fill(identity.username);
    await page.locator('#password').fill(identity.userPassword);
    const callbackResponse = page.waitForResponse((response) => response.url().startsWith(`${apiOrigin}/auth/callback?`));
    await page.locator('#kc-login').click();
    stage = 'OIDC callback';
    const completed = await callbackResponse.catch(async (error) => {
      const current = new URL(page.url());
      const area = current.origin === `http://localhost:${keycloakPort}` ? 'Keycloak'
        : current.origin === apiOrigin ? 'API' : 'other origin';
      const profileForm = await page.locator('#email').isVisible().catch(() => false);
      stage = `OIDC callback absent at ${area}${profileForm ? ' profile form' : ''}`;
      throw error;
    });
    stage = `OIDC callback HTTP ${completed.status()}`;
    assert.equal(completed.status(), 302, 'OIDC callback was not accepted.');
    stage = 'OIDC callback cookies';
    const cookies = (await completed.headersArray())
      .filter((header) => header.name.toLowerCase() === 'set-cookie').map((header) => header.value);
    assert.equal(cookies.length, 2, 'Callback must send two separate Set-Cookie fields.');
    assert.equal(cookies.filter((line) => line.startsWith('hv_session=')).length, 1);
    const sessionCookie = cookies.find((line) => line.startsWith('hv_session='))?.split(';')[0]?.slice('hv_session='.length);
    assert.equal(cookies.filter((line) => line.startsWith('hv_auth_state=') && line.includes('Max-Age=0')).length, 1);
    stage = 'post-login navigation';
    await page.waitForURL(`${apiOrigin}/v1/meeting`);

    // Slice 034a: the service answers with `Content-Security-Policy: default-src 'none'`, so a script on one of its
    // own JSON pages may not call `fetch` (connect-src falls back to 'none'); that is intended. The checks after the
    // sign-in therefore run through a request context outside the page. It has no cookie jar of its own; the session
    // cookie from the callback is sent as one explicit `Cookie` header (never two `hv_session` cookies, and no doubt
    // about `Secure` cookies over http://localhost). Same assertions as before; cookie and token are never printed.
    const api = await webRequire('@playwright/test').request.newContext({ baseURL: apiOrigin });
    let csrfToken = '';
    try {
      const cookie = { Cookie: `hv_session=${sessionCookie}` };

      stage = 'session verification';
      const meResponse = await api.get('/auth/me', { headers: { ...cookie, 'X-Actor': 'attacker:admin' } });
      const me = { status: meResponse.status(), cache: meResponse.headers()['cache-control'], body: await meResponse.json() };
      assert.equal(me.status, 200);
      assert.equal(me.cache, 'no-store');
      assert.equal(me.body.scheme, 'session');
      assert.equal(me.body.subjectId, expectedActorId);
      assert.equal(me.body.actor.role, 'moderation');
      assert.deepEqual(me.body.roles, ['moderation']);
      assert.match(me.body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
      csrfToken = me.body.csrfToken;

      stage = 'CSRF mutation';
      const route = `/v1/meetings/${meetingId}/speakers`;
      const before = await api.get(route, { headers: cookie });
      const tag = before.headers().etag;
      const data = JSON.stringify({ displayName: 'Synthetic CI speaker', round: 1 });
      const rejected = await api.post(route, { headers: { ...cookie, 'Content-Type': 'application/json', 'If-Match': tag }, data });
      const accepted = await api.post(route, { headers: { ...cookie, 'Content-Type': 'application/json', 'If-Match': tag,
        'X-CSRF-Token': me.body.csrfToken, 'X-Actor': 'attacker:admin' }, data });
      assert.equal(before.status(), 200);
      assert.match(tag, /^"v\d+"$/);
      assert.equal(rejected.status(), 403, 'Missing CSRF token must reject a mutation.');
      assert.equal(accepted.status(), 201, 'Signed-in moderation actor must be able to register a speaker.');

      stage = 'logout';
      const logout = await api.post('/auth/logout', { headers: { ...cookie, 'X-CSRF-Token': me.body.csrfToken } });
      const after = await api.get('/auth/me', { headers: cookie });
      assert.equal(logout.status(), 204);
      assert.equal(after.status(), 401);
    } finally {
      await api.dispose();
    }
    console.log('029b Keycloak browser login, role, CSRF, write and logout: PASS');
    return [identity.clientSecret, identity.userPassword, sessionCookie, csrfToken, expectedActorId,
      expectedActorId.replace(/^oidc_/, ''), identity.userId, identity.username].filter(Boolean);
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
    const logDir = join(temp, 'access-log');
    await mkdir(logDir, { mode: 0o700 });
    const accessLog = { dir: logDir, key: randomBytes(32).toString('base64') };
    api = startApi(runtimeUrl, identity, encryptionKey, accessLog);
    await waitForApi(api);
    stage = 'browser login and role flow';
    const secrets = await checkBrowserFlow(identity, actorId, meetingId);
    const sessionsBeforeOutage = await sessionCount(ownerUrl);
    await stopApi(api);
    api = undefined;
    stage = 'access log check';
    await checkAccessLog(logDir, secrets);
    stage = 'IdP outage';
    await execFile('docker', ['rm', '-f', container], { timeout: 10_000 });
    containerStarted = false;
    api = startApi(runtimeUrl, identity, encryptionKey, accessLog);
    await waitForApi(api);
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
