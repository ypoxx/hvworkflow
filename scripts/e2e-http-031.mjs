/**
 * Slice 031a: the harness of the `http` project of the e2e suite. It starts the pieces the interface needs to run
 * against a real service, runs the Playwright project, checks the access log, and removes everything again:
 *
 *   1. Keycloak (skipped with `E2E_HTTP_IDP=none`)   2. a fresh Postgres database, migrated
 *   3. bootstrap of the corpus and the role assignments, past the administration path (only here, into an empty database)
 *   4. the service (explicit environment, start line checked)   5. `playwright test --project=http --workers=1`
 *      (its web server: `vite build`, then `vite preview` on the build, takt-035: the dev server doubles mount effects
 *      in StrictMode and compiles on demand)
 *   6. stop the service, check the access log   7. remove container, database and temporary directory, also after a failure
 *
 * Secrets (client secret, passwords, keys) are random per run, live only in child process environments and in files
 * with rights 0600 in a directory 0700 outside the repository, and are never printed. On a failure only the name of
 * the stage reaches stderr, as in 029b: driver and provider errors can carry credentials.
 *
 * `--check` needs neither Docker nor a database: it checks the realm structure, the pinned image and the service
 * environment (against the real configuration schema of the service).
 *
 * Run with the tsx loader: `node --import ./apps/api/node_modules/tsx/dist/loader.mjs scripts/e2e-http-031.mjs`.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { chmodSync, realpathSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { KEYCLOAK_IMAGE, KEYCLOAK_IMAGE_FORM, buildRealm, removeKeycloak, startKeycloak, waitForHttp } from './lib/keycloak-ci.mjs';
import { PERSONS } from './lib/demo-persons.mjs';
import { bootstrap } from './lib/demo-bootstrap.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(pathToFileURL(join(ROOT, 'apps/api/package.json')));
const LOADER = join(ROOT, 'apps/api/node_modules/tsx/dist/loader.mjs');

export const REALM_NAME = 'hv-e2e-031';
export const KEYCLOAK_PORT = 18080;
export const SERVICE_PORT = 18091;
export const START_LINE = 'HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none';

/** The whole run stays inside the 14 minutes of the CI step (`gates.yml`, 2 minutes of room), so that the cleanup surely runs. */
const TOTAL_MS = 720_000;
const CLEANUP_RESERVE_MS = 30_000;
/** Soft threshold (takt-046, 6:30 = plan threshold): above it the duration annotation is a warning; exit code and flow stay the same. */
const WARN_MS = 390_000;

/** The tsx loader is needed for the TypeScript of the service and the domain (spec decision 6). */
export function loaderIsActive(execArgv = process.execArgv, options = process.env.NODE_OPTIONS ?? '') {
  return [...execArgv, options].join(' ').includes('tsx');
}
export const LOADER_HINT =
  '031a needs the tsx loader: node --import ./apps/api/node_modules/tsx/dist/loader.mjs scripts/e2e-http-031.mjs';

/** A port that is taken belongs to someone else: the run stops and reports, it never ends a foreign process. */
function assertPortFree(port) {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', () => rejectPort(new Error('port in use')));
    probe.listen(port, () => probe.close(() => resolvePort()));
  });
}

/** The synthetic persons of the realm (slice 037a moved the list to `scripts/lib/demo-persons.mjs`). */
export { PERSONS };

// ---- pure parts (unit-tested, no Docker, no database) --------------------------------------------------------------

export function buildFixture({ httpPort }) {
  const origin = `http://localhost:${httpPort}`;
  const redirectUri = `${origin}/auth/callback`;
  return {
    redirectUri,
    ...buildRealm({ realmName: REALM_NAME, redirectUris: [redirectUri], webOrigins: [origin],
      persons: PERSONS.map((person) => person.key) }),
  };
}

/** Everything the test service may be started with. Nothing else reaches it (no `...process.env`). */
export const ALLOWED_SERVICE_VARIABLES = [
  'PATH', 'PORT', 'HV_DATABASE_URL',
  'HV_OIDC_ISSUER', 'HV_OIDC_CLIENT_ID', 'HV_OIDC_CLIENT_SECRET', 'HV_OIDC_REDIRECT_URI', 'HV_AUTH_ENCRYPTION_KEY',
  'HV_ACCESS_LOG_DIR', 'HV_ACCESS_LOG_HASH_KEY',
  'HV_TRANSPARENCY_NOTICE_VERSION', 'HV_TRANSPARENCY_NOTICE_DE', 'HV_TRANSPARENCY_NOTICE_EN', 'HV_DSFA_SUMMARY_URL',
  'HV_RATE_LIMIT_WRITES_PER_MIN', 'HV_RATE_LIMIT_READS_PER_MIN',
];

/**
 * Deliberately not set (spec decision 7): demo mode, JSONL log, CORS, proxy trust, NTP, the request timeout, and every
 * limit other than the two per-person ones. A test switch that a wrong value could turn on in a real environment has
 * no place here (MF-12).
 */
export const FORBIDDEN_SERVICE_VARIABLES = [
  'NODE_ENV', 'HV_DEMO', 'HV_EVENT_LOG', 'HV_DB_TLS', 'HV_SEED_ACTOR', 'HV_ACCESS_LOG_RETENTION_DAYS', 'HV_NTP_SERVERS',
  'HV_CLOCK_MAX_DRIFT_MS', 'HV_METRICS_TOKEN', 'HV_CORS_ORIGINS', 'HV_TRUSTED_PROXY_CIDRS', 'HV_REQUEST_TIMEOUT_MS',
  'HV_RATE_LIMIT_ANON_PER_MIN', 'HV_RATE_LIMIT_LOGIN_PER_MIN', 'HV_RATE_LIMIT_LOGIN_GLOBAL_PER_MIN',
  'HV_RATE_LIMIT_PROBES_PER_MIN', 'HV_RATE_LIMIT_PREFLIGHT_PER_MIN', 'HV_DB_STATEMENT_TIMEOUT_MS',
  'HV_DB_LOCK_TIMEOUT_MS', 'HV_DB_QUERY_TIMEOUT_MS', 'HV_DB_IDLE_TX_TIMEOUT_MS',
];

/** Only the limits per person are raised (spec decision 9); the numbers stay inside the ranges of the schema. */
const RAISED_LIMITS = { HV_RATE_LIMIT_WRITES_PER_MIN: '1000', HV_RATE_LIMIT_READS_PER_MIN: '20000' };

/**
 * `texts` are the constants of `apps/web/e2e/support/e2e-texts.ts` (loaded by the caller, so this file needs no
 * TypeScript at import time). The keys are fresh for every call.
 */
export function buildServiceEnv({ runtimeUrl, issuer, clientId, clientSecret, redirectUri, logDir, path, texts }) {
  return {
    PATH: path,
    PORT: String(SERVICE_PORT),
    HV_DATABASE_URL: runtimeUrl,
    HV_OIDC_ISSUER: issuer,
    HV_OIDC_CLIENT_ID: clientId,
    HV_OIDC_CLIENT_SECRET: clientSecret,
    HV_OIDC_REDIRECT_URI: redirectUri,
    HV_AUTH_ENCRYPTION_KEY: randomBytes(32).toString('base64url'),
    HV_ACCESS_LOG_DIR: logDir,
    HV_ACCESS_LOG_HASH_KEY: randomBytes(32).toString('base64'),
    HV_TRANSPARENCY_NOTICE_VERSION: texts.NOTICE_VERSION,
    HV_TRANSPARENCY_NOTICE_DE: texts.NOTICE_DE,
    HV_TRANSPARENCY_NOTICE_EN: texts.NOTICE_EN,
    HV_DSFA_SUMMARY_URL: texts.DSFA_SUMMARY_URL,
    ...RAISED_LIMITS,
  };
}

const REQUIRED_SERVICE_VARIABLES = ALLOWED_SERVICE_VARIABLES;

export function assertServiceEnv(env) {
  for (const name of Object.keys(env)) {
    assert(ALLOWED_SERVICE_VARIABLES.includes(name), 'The service environment holds a variable outside the allowed list.');
    assert(!FORBIDDEN_SERVICE_VARIABLES.includes(name), 'The service environment holds a forbidden variable.');
    assert(!name.startsWith('E2E_') && !name.startsWith('HV_E2E_'), 'A control variable must not reach the service.');
  }
  for (const name of REQUIRED_SERVICE_VARIABLES) {
    assert(typeof env[name] === 'string' && env[name] !== '', 'The service environment is incomplete.');
  }
  assert.equal(env.PORT, String(SERVICE_PORT));
  assert.equal(Object.keys(env).filter((name) => name.startsWith('HV_RATE_LIMIT_')).length, 2,
    'Only the two limits per person may be set.');
}

/** The whole sign-in limit must never be smaller than the limit per source (all requests come from one source). */
export function assertLoginLimits({ loginPerSource, loginTotal }) {
  assert(loginTotal >= loginPerSource, 'The whole sign-in limit is smaller than the limit per source.');
}

export function assertOutsideRepository(directory) {
  const rel = relative(ROOT, realpathSync(directory));
  assert(rel.startsWith('..') || isAbsolute(rel), 'A private directory must lie outside the repository.');
}

export function writePrivateFile(path, content) {
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

const ACCESS_LOG_KEYS = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];

/** Every line has exactly the eight keys of slice 033a, and no forbidden text appears anywhere in the files. */
export async function checkAccessLogFiles(dir, forbidden) {
  const files = (await readdir(dir)).filter((name) => /^access-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name));
  assert(files.length > 0, 'The access log must contain at least one daily file.');
  let lines = 0;
  for (const name of files) {
    const text = await readFile(join(dir, name), 'utf8');
    for (const value of forbidden) {
      assert(!text.includes(value), 'The access log holds a secret, token, cookie, actor id or written text.');
    }
    for (const line of text.split('\n').filter(Boolean)) {
      assert.deepEqual(Object.keys(JSON.parse(line)).sort(), ACCESS_LOG_KEYS, 'Every access log line has exactly the eight keys.');
      lines += 1;
    }
  }
  assert(lines > 0, 'The run must have produced access log lines.');
  return lines;
}

const clock = (ms) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** takt-046: numbers and fixed stage names only, never error text. `stages` is a list of `[name, ms]` in run order. */
export function formatDuration({ totalMs, limitMs, warnMs, stages }) {
  const line = `031a duration: total ${clock(totalMs)} of limit ${clock(limitMs)}, warning above ${clock(warnMs)}; stages: ` +
    stages.map(([name, ms]) => `${name} ${clock(ms)}`).join(', ');
  const annotation = totalMs <= warnMs
    ? `::notice title=e2e-http duration::${line}`
    : `::warning title=e2e-http duration::${line} (above the soft threshold; see takt-046 for the split decision)`;
  return { line, annotation };
}

/** Replaces every known secret in a line of child output; a safety net, the tests print none in the first place. */
export function redact(text, secrets) {
  let out = text;
  for (const secret of secrets) if (secret) out = out.split(secret).join('***');
  return out;
}

// ---- stages --------------------------------------------------------------------------------------------------------

let stage = 'setup';

async function loadTexts() {
  return import('../apps/web/e2e/support/e2e-texts.ts');
}

function httpPortOf(env) {
  const port = Number(env.E2E_HTTP_PORT ?? 4174);
  assert(Number.isInteger(port) && port >= 1024 && port <= 65_535, 'E2E_HTTP_PORT must be an integer from 1024 to 65535.');
  return port;
}

const say = (line) => console.log(line);

async function check() {
  stage = 'check: configuration';
  const httpPort = httpPortOf(process.env);
  stage = 'check: image';
  assert.match(KEYCLOAK_IMAGE, KEYCLOAK_IMAGE_FORM);
  say('031a Keycloak image pinned by tag and digest: PASS');

  stage = 'check: realm';
  const { realm, users, identity, redirectUri } = buildFixture({ httpPort });
  assert.equal(realm.users.length, PERSONS.length);
  assert.equal(PERSONS.length, 9);
  assert.equal(realm.clients.length, 1);
  assert.deepEqual(realm.clients[0].redirectUris, [`http://localhost:${httpPort}/auth/callback`]);
  assert.equal(redirectUri, realm.clients[0].redirectUris[0]);
  assert(realm.users.every((user) => /@example\.test$/.test(user.email)));
  assert.equal(new Set(realm.users.map((user) => user.credentials[0].value)).size, PERSONS.length);
  assert.notEqual(identity.clientSecret, users.capture.password);
  say('031a realm structure, nine persons and one redirect URI: PASS');

  stage = 'check: service environment';
  const texts = await loadTexts();
  const { readServiceConfig } = await import('../apps/api/src/config/schema.ts');
  const { formatStartLine, formatUnknownVariables } = await import('../apps/api/src/config/startLine.ts');
  const temp = await mkdtemp(join(tmpdir(), 'hv-e2e-031-check-'));
  try {
    const logDir = join(temp, 'access-log');
    await mkdir(logDir, { mode: 0o700 });
    const env = buildServiceEnv({
      runtimeUrl: 'postgres://synthetic:synthetic@localhost:5432/synthetic',
      issuer: `http://localhost:${KEYCLOAK_PORT}/realms/${REALM_NAME}`,
      clientId: identity.clientId, clientSecret: identity.clientSecret, redirectUri, logDir,
      path: process.env.PATH ?? '', texts,
    });
    assertServiceEnv(env);
    const config = readServiceConfig(env);
    assert.equal(formatUnknownVariables(config.unknownVariables), undefined, 'the service must know every variable');
    assert.equal(formatStartLine(config), START_LINE);
    assertLoginLimits(config.limits);
    assert.equal(config.limits.writePerSubject, 1000);
    assert.equal(config.limits.readPerSubject, 20_000);
    assert(config.limits.requestTimeoutMs > 7000, 'the request timeout stays at its default, above the schema minimum');
    say('031a service environment passes the configuration schema: PASS');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }

  stage = 'check: private files';
  const dir = await mkdtemp(join(tmpdir(), 'hv-e2e-031-check-'));
  try {
    assertOutsideRepository(dir);
    say('031a private state directory lies outside the repository: PASS');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  assert(texts.WRITTEN_TEXTS.length > 0);
  say('031a shared texts for the access log check: PASS');
}

async function withDatabase(url, name) {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

let playwrightChild;

/** Playwright builds the interface, starts `vite preview` (takt-035: production build, not the dev server) and the browser; the whole group ends, not just the pnpm process. */
function endGroup(child, signal) {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  try { process.kill(-child.pid, signal); } catch { /* already gone */ }
}

async function main() {
  const startedAt = Date.now();
  // Entry times of the main stages (fixed names, takt-046); the last one ends at the finally block.
  const marks = [];
  const enter = (name) => marks.push([name, Date.now()]);
  stage = 'tsx loader check';
  if (!loaderIsActive()) { console.error(LOADER_HINT); process.exitCode = 1; return; }
  if (process.argv.includes('--check')) { await check(); return; }
  const ownerBase = process.env.TEST_DATABASE_URL;
  const runtimeBase = process.env.TEST_RUNTIME_DATABASE_URL;
  const runtimeRole = process.env.HV_DB_RUNTIME_ROLE;
  assert(ownerBase && runtimeBase && runtimeRole, 'TEST_DATABASE_URL, TEST_RUNTIME_DATABASE_URL and HV_DB_RUNTIME_ROLE are required.');
  const withoutIdp = process.env.E2E_HTTP_IDP === 'none';
  const httpPort = httpPortOf(process.env);
  const apiOrigin = `http://localhost:${SERVICE_PORT}`;
  const issuer = `http://localhost:${KEYCLOAK_PORT}/realms/${REALM_NAME}`;
  const texts = await loadTexts();

  const fixture = buildFixture({ httpPort });
  const secrets = [fixture.identity.clientSecret, fixture.identity.adminPassword,
    ...Object.values(fixture.users).map((user) => user.password)];
  const temp = await mkdtemp(join(tmpdir(), 'hv-e2e-031-'));
  assertOutsideRepository(temp);
  const stateDir = join(temp, 'state');
  await mkdir(stateDir, { mode: 0o700 });
  const container = `hv-keycloak-031-${randomUUID()}`;
  const databaseName = `hv_e2e031_${randomBytes(4).toString('hex')}`;
  let containerStarted = false;
  let databaseCreated = false;
  // Signals and the total time limit end the run through the same cleanup as a failure (the temporary directory holds credentials).
  let interrupt;
  const interruption = new Promise((_, rejectRun) => { interrupt = rejectRun; });
  interruption.catch(() => {});
  const onSignal = () => { stage = 'interrupted by a signal'; interrupt(new Error('signal')); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const limit = setTimeout(() => { stage = `total time limit, last stage ${stage}`; interrupt(new Error('deadline')); }, TOTAL_MS);
  let service;
  let serviceOutput = { stdout: '', stderr: '' };
  const body = async () => {
    stage = 'port check';
    await assertPortFree(SERVICE_PORT);
    if (!withoutIdp) await assertPortFree(KEYCLOAK_PORT);
    await assertPortFree(httpPort);
    // 1. Keycloak
    if (!withoutIdp) {
      enter('keycloak');
      stage = 'Keycloak startup';
      containerStarted = true;
      await startKeycloak({ directory: temp, container, port: KEYCLOAK_PORT, realm: fixture.realm,
        adminName: fixture.identity.adminName, adminPassword: fixture.identity.adminPassword, cwd: ROOT });
      await waitForHttp(`${issuer}/.well-known/openid-configuration`, 200, 120_000);
    }

    // 2. database
    enter('database');
    stage = 'database creation';
    const { Pool } = apiRequire('pg');
    const admin = new Pool({ connectionString: ownerBase, connectionTimeoutMillis: 5_000, max: 1 });
    try {
      databaseCreated = true;
      await admin.query(`CREATE DATABASE ${databaseName}`);
    } finally {
      await admin.end();
    }
    const ownerUrl = await withDatabase(ownerBase, databaseName);
    const runtimeUrl = await withDatabase(runtimeBase, databaseName);
    stage = 'database migration';
    const migrate = spawnSync('pnpm', ['--filter', '@hv/api', 'db:migrate', 'up'], {
      cwd: ROOT, stdio: 'ignore', timeout: 120_000,
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', HV_MIGRATION_DATABASE_URL: ownerUrl,
        HV_DB_RUNTIME_ROLE: runtimeRole },
    });
    assert.equal(migrate.status, 0);

    // 3. bootstrap
    enter('bootstrap');
    stage = 'bootstrap of corpus and roles';
    const actorIds = await bootstrap({ Pool, ownerUrl, issuer, users: fixture.users, persons: PERSONS });

    // private files for the tests
    stage = 'private state files';
    assertOutsideRepository(stateDir);
    writePrivateFile(join(stateDir, 'credentials.json'), JSON.stringify(Object.fromEntries(
      Object.entries(fixture.users).map(([key, user]) => [key, { username: user.username, password: user.password }]))));
    writePrivateFile(join(stateDir, 'revoke.json'), JSON.stringify({ databaseUrl: runtimeUrl, actorId: actorIds.revoke }));

    // 4. service
    enter('service');
    stage = 'service startup';
    const logDir = join(temp, 'access-log');
    await mkdir(logDir, { mode: 0o700 });
    const env = buildServiceEnv({ runtimeUrl, issuer, clientId: fixture.identity.clientId,
      clientSecret: fixture.identity.clientSecret, redirectUri: fixture.redirectUri, logDir,
      path: process.env.PATH ?? '', texts });
    assertServiceEnv(env);
    secrets.push(env.HV_AUTH_ENCRYPTION_KEY, env.HV_ACCESS_LOG_HASH_KEY);
    service = spawn(process.execPath, ['--import', LOADER, join(ROOT, 'apps/api/src/server.ts')],
      { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    serviceOutput = collect(service);
    await waitForService(service, apiOrigin);
    stage = 'service start line';
    assert(serviceOutput.stdout.split('\n').includes(START_LINE), 'The service did not print the expected start line.');
    assertQuietStderr(serviceOutput.stderr);
    say(`031a service start line: ${START_LINE}`);

    // 5. Playwright
    enter('playwright');
    stage = 'end-to-end run';
    const limitMs = TOTAL_MS - (Date.now() - startedAt) - CLEANUP_RESERVE_MS;
    assert(limitMs > 30_000, 'Not enough time left for the end-to-end run.');
    const exit = await runPlaywright({ httpPort, apiOrigin, stateDir, withoutIdp, secrets, limitMs });
    assert.equal(exit, 0);

    // 6. access log
    enter('access-log');
    stage = 'access log check';
    const forbidden = await forbiddenTexts({ stateDir, apiOrigin, users: fixture.users, actorIds, secrets, texts });
    await stopService(service);
    service = undefined;
    assertQuietStderr(serviceOutput.stderr);
    const lines = await checkAccessLogFiles(logDir, forbidden);
    say(`031a access log: ${lines} lines with exactly the eight keys and no secret, token, cookie, actor id or written text: PASS`);
  };
  try {
    await Promise.race([body(), interruption]);
  } finally {
    // 7. cleanup, always
    enter('cleanup');
    clearTimeout(limit);
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    endGroup(playwrightChild, 'SIGTERM');
    await stopService(service);
    endGroup(playwrightChild, 'SIGKILL');
    if (containerStarted) await removeKeycloak(container).catch(() => {});
    if (databaseCreated) await dropDatabase(ownerBase, databaseName).catch(() => {});
    await rm(temp, { recursive: true, force: true });
    const end = Date.now();
    const stages = marks.map(([name, from], index) => [name, (marks[index + 1]?.[1] ?? end) - from]);
    const { line, annotation } = formatDuration({ totalMs: end - startedAt, limitMs: TOTAL_MS, warnMs: WARN_MS, stages });
    say(line);
    say(annotation);
  }
}

function collect(child) {
  const output = { stdout: '', stderr: '' };
  const cap = 1_000_000;
  child.stdout.on('data', (chunk) => { if (output.stdout.length < cap) output.stdout += chunk; });
  child.stderr.on('data', (chunk) => { if (output.stderr.length < cap) output.stderr += chunk; });
  return output;
}

function assertQuietStderr(stderr) {
  for (const phrase of ['refusing to start', 'ignoring unknown variables', 'limit reached']) {
    assert(!stderr.includes(phrase), 'The service reported a configuration or limit problem on stderr.');
  }
}

async function waitForService(child, apiOrigin) {
  // No NTP servers are configured (no outbound network in CI), so /readyz can stay 503 with `not_configured` although
  // Postgres and the migrations are healthy; the public notice proves the HTTP server is up (as in 029b).
  await waitForHttp(`${apiOrigin}/auth/transparency-notice`, 200, 60_000, child);
  const response = await fetch(`${apiOrigin}/readyz`);
  const body = await response.json();
  assert.equal(body.checks.db.status, 'ok', 'The runtime login must reach Postgres.');
  assert.equal(body.checks.migrations.status, 'ok', 'The service must see the applied migrations.');
  if (response.status === 503) assert.equal(body.checks.clock.code, 'not_configured');
  else assert.equal(response.status, 200);
}

async function stopService(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 3_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function dropDatabase(ownerBase, name) {
  const { Pool } = apiRequire('pg');
  const admin = new Pool({ connectionString: ownerBase, connectionTimeoutMillis: 5_000, max: 1 });
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}

function runPlaywright({ httpPort, apiOrigin, stateDir, withoutIdp, secrets, limitMs }) {
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    // Stops the page snapshot of a failed test (it can hold what was typed into a password field); the output directory
    // in the private state directory covers the failed matcher, which this variable does not (slice 031a review).
    PLAYWRIGHT_NO_COPY_PROMPT: '1',
    E2E_HTTP: '1',
    E2E_HTTP_PORT: String(httpPort),
    E2E_HTTP_API_ORIGIN: apiOrigin,
    E2E_HTTP_STATE_DIR: stateDir,
    ...(withoutIdp ? { E2E_HTTP_IDP: 'none' } : {}),
    ...(process.env.PW_CHROMIUM_PATH ? { PW_CHROMIUM_PATH: process.env.PW_CHROMIUM_PATH } : {}),
    ...(process.env.E2E_PORT ? { E2E_PORT: process.env.E2E_PORT } : {}),
    ...(process.env.CI ? { CI: process.env.CI } : {}),
  };
  const child = spawn('pnpm', ['--filter', '@hv/web', 'exec', 'playwright', 'test', '--project=http', '--workers=1'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  playwrightChild = child;
  const forward = (stream, target) => {
    let pending = '';
    stream.on('data', (chunk) => {
      pending += chunk;
      const parts = pending.split('\n');
      pending = parts.pop() ?? '';
      for (const line of parts) target.write(`${redact(line, secrets)}\n`);
    });
    stream.on('end', () => { if (pending) target.write(`${redact(pending, secrets)}\n`); });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  return new Promise((resolveRun, rejectRun) => {
    // The rest of the total time minus the reserve for the cleanup, so that the cleanup still runs inside the step limit.
    const timer = setTimeout(() => { endGroup(child, 'SIGTERM'); rejectRun(new Error('timeout')); }, limitMs);
    child.once('error', rejectRun);
    child.once('exit', (code) => { clearTimeout(timer); resolveRun(code ?? 1); });
  });
}

/** What must never appear in the access log: secrets, tokens, cookies, actor and subject ids, and the written texts. */
async function forbiddenTexts({ stateDir, apiOrigin, users, actorIds, secrets, texts }) {
  const forbidden = [...secrets, ...Object.values(actorIds), ...Object.values(users).flatMap((user) => [user.id, user.username]),
    ...texts.WRITTEN_TEXTS];
  for (const { key } of PERSONS) {
    let state;
    try { state = JSON.parse(await readFile(join(stateDir, `state-${key}.json`), 'utf8')); } catch { continue; }
    const cookie = state.cookies?.find((entry) => entry.name === 'hv_session')?.value;
    if (!cookie) continue;
    forbidden.push(cookie);
    // The CSRF token of a still valid session: ask the service once, never print it.
    const me = await fetch(`${apiOrigin}/auth/me`, { headers: { Cookie: `hv_session=${cookie}` } }).catch(() => undefined);
    if (me?.status === 200) forbidden.push((await me.json()).csrfToken);
  }
  return forbidden.filter(Boolean);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(() => {
    // Provider and driver errors can embed credentials; report only the safe stage.
    console.error(`031a e2e http harness failed during ${stage}.`);
    process.exitCode = 1;
    // A stage that was interrupted can still hold an open handle; the cleanup has run, so the process ends.
    setTimeout(() => process.exit(1), 2_000).unref();
  });
}
