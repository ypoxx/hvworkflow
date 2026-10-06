/**
 * Slice 031a: tests of the HTTP e2e harness (`scripts/e2e-http-031.mjs`), the Keycloak module and the shape of the
 * Playwright configuration. Nothing here needs Docker or a database; the real run is the CI job `e2e-http`.
 * Bedrohungsmodell: T-Q-I-01 (secrets in CI: random values, `--check` prints none, no trace, video or HTML report,
 * no report upload) and T-G2-I-02 (access log check with the texts of the suite).
 *
 * TypeScript is loaded only in child processes or through the tsx loader, never directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWED_SERVICE_VARIABLES, FORBIDDEN_SERVICE_VARIABLES, LOADER_HINT, PERSONS, START_LINE, loaderIsActive, assertLoginLimits, assertOutsideRepository,
  assertServiceEnv, buildFixture, buildServiceEnv, checkAccessLogFiles, formatDuration, writePrivateFile,
} from './e2e-http-031.mjs';
import { KEYCLOAK_IMAGE, KEYCLOAK_IMAGE_FORM } from './lib/keycloak-ci.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps/web');

// Slice 031b (decision 4): with an IdP the five shared files run in the http project, in the order of their paths.
const SHARED_FILES = ['002-speakers-capture.spec.ts', '021b-koordination.spec.ts', '021c-rechtsfreigabe.spec.ts',
  '045-verweigerung.spec.ts', '053-steuerung.spec.ts', '054-fokusansicht.spec.ts', '055b-antwortformat.spec.ts',
  '060-entwurfspuffer-praesenz.spec.ts', '080-sprecher-zustand.spec.ts', 'abnahme.spec.ts'];
const HTTP_ORDER = ['002-speakers-capture.spec.ts', '021b-koordination.spec.ts', '021c-rechtsfreigabe.spec.ts',
  '030-anmeldung.spec.ts', '031-http-betriebsart.spec.ts', '045-verweigerung.spec.ts', '053-steuerung.spec.ts',
  '054-fokusansicht.spec.ts', '055b-antwortformat.spec.ts', '060-entwurfspuffer-praesenz.spec.ts',
  '080-sprecher-zustand.spec.ts', 'abnahme.spec.ts'];

const LOADER = join(ROOT, 'apps/api/node_modules/tsx/dist/loader.mjs');
const HARNESS = join(ROOT, 'scripts/e2e-http-031.mjs');
const baseEnv = { PATH: process.env.PATH ?? '' };
const scratch = () => mkdtempSync(join(tmpdir(), 'e2e-http-031-test-'));

// ---- realm ---------------------------------------------------------------------------------------------------------

test('realm: nine synthetic persons, one client with one redirect URI from E2E_HTTP_PORT', () => {
  for (const port of [4174, 4999]) {
    const { realm, users, identity } = buildFixture({ httpPort: port });
    assert.deepEqual(Object.keys(users).sort(),
      ['approver', 'capture', 'coordination', 'expert', 'legal', 'moderation', 'norole', 'podium', 'revoke']);
    assert.equal(PERSONS.length, 9);
    assert.equal(realm.users.length, 9);
    assert.equal(realm.clients.length, 1);
    assert.deepEqual(realm.clients[0].redirectUris, [`http://localhost:${port}/auth/callback`]);
    assert.equal(realm.clients[0].publicClient, false);
    assert.equal(realm.clients[0].secret, identity.clientSecret);
    for (const user of realm.users) {
      assert.match(user.email, /^[^@\s]+@example\.test$/);
      assert.match(user.id, /^[0-9a-f-]{36}$/);
      assert.match(user.username, /^synthetic-[0-9a-f-]{36}$/);
      assert(user.firstName && user.lastName && user.emailVerified === true);
    }
    assert.equal(new Set(realm.users.map((user) => user.credentials[0].value)).size, 9, 'one password per person');
    assert.equal(new Set(realm.users.map((user) => user.id)).size, 9);
  }
});

test('realm: identities and secrets differ from run to run', () => {
  const first = buildFixture({ httpPort: 4174 });
  const second = buildFixture({ httpPort: 4174 });
  assert.notEqual(first.identity.clientSecret, second.identity.clientSecret);
  assert.notEqual(first.identity.adminPassword, second.identity.adminPassword);
  assert.notEqual(first.users.capture.password, second.users.capture.password);
  assert.notEqual(first.users.capture.id, second.users.capture.id);
  assert.notEqual(first.identity.clientSecret, first.users.capture.password);
});

test('roles: only the person norole has no assignment; the expert is bound to unit-fin; revoke is a capture person', () => {
  const byKey = Object.fromEntries(PERSONS.map((person) => [person.key, person]));
  assert.equal(byKey.norole.role, undefined);
  assert.equal(byKey.expert.unitId, 'unit-fin');
  assert.equal(byKey.revoke.role, byKey.capture.role);
  for (const person of PERSONS) if (person.key !== 'norole') assert(person.role, `${person.key} has a role`);
});

test('the image is pinned by tag and digest, and the form check accepts nothing looser', () => {
  assert.match(KEYCLOAK_IMAGE, KEYCLOAK_IMAGE_FORM);
  assert.doesNotMatch('quay.io/keycloak/keycloak:26.7.4', KEYCLOAK_IMAGE_FORM);
  assert.doesNotMatch('quay.io/keycloak/keycloak:latest@sha256:' + 'a'.repeat(64), KEYCLOAK_IMAGE_FORM);
  assert.doesNotMatch('quay.io/keycloak/keycloak:26.7.4@sha256:' + 'A'.repeat(64), KEYCLOAK_IMAGE_FORM);
});

// ---- service environment -------------------------------------------------------------------------------------------

const serviceInputs = () => {
  const { identity } = buildFixture({ httpPort: 4174 });
  return {
    runtimeUrl: 'postgres://runtime:synthetic@localhost:5432/e2e',
    issuer: 'http://localhost:18080/realms/hv-e2e-031',
    clientId: identity.clientId,
    clientSecret: identity.clientSecret,
    redirectUri: 'http://localhost:4174/auth/callback',
    logDir: '/tmp/synthetic-access-log',
    path: '/usr/bin',
    texts: { NOTICE_VERSION: 'e2e-synthetic-1', NOTICE_DE: 'Hinweis', NOTICE_EN: 'Notice',
      DSFA_SUMMARY_URL: 'https://example.org/hv-e2e-dsfa' },
  };
};

test('service environment: explicit, complete, none of the forbidden variables, only two limits raised', () => {
  const env = buildServiceEnv(serviceInputs());
  assertServiceEnv(env);
  for (const name of FORBIDDEN_SERVICE_VARIABLES) assert(!(name in env), `${name} must not be set`);
  for (const name of ['NODE_ENV', 'HV_DEMO', 'HV_EVENT_LOG', 'HV_CORS_ORIGINS', 'HV_TRUSTED_PROXY_CIDRS', 'HV_NTP_SERVERS',
    'HV_REQUEST_TIMEOUT_MS']) assert(FORBIDDEN_SERVICE_VARIABLES.includes(name), `${name} is on the forbidden list`);
  assert(Object.keys(env).every((name) => ALLOWED_SERVICE_VARIABLES.includes(name)), 'no variable outside the allowed list');
  assert(!Object.keys(env).some((name) => name.startsWith('HV_E2E_') || name.startsWith('E2E_')), 'no control variable reaches the service');
  assert.equal(env.PORT, '18091');
  assert.equal(env.HV_RATE_LIMIT_WRITES_PER_MIN, '1000');
  assert.equal(env.HV_RATE_LIMIT_READS_PER_MIN, '20000');
  const limits = Object.keys(env).filter((name) => name.startsWith('HV_RATE_LIMIT_'));
  assert.deepEqual(limits.sort(), ['HV_RATE_LIMIT_READS_PER_MIN', 'HV_RATE_LIMIT_WRITES_PER_MIN']);
  assert.equal(env.HV_DSFA_SUMMARY_URL, 'https://example.org/hv-e2e-dsfa');
  assert.equal(env.HV_TRANSPARENCY_NOTICE_VERSION, 'e2e-synthetic-1');
  assert.match(env.HV_AUTH_ENCRYPTION_KEY, /^[A-Za-z0-9_-]{43}$/);
  assert(Buffer.from(env.HV_ACCESS_LOG_HASH_KEY, 'base64').length >= 32);
});

test('service environment: the check refuses a forbidden or unknown variable and a leaked control variable', () => {
  for (const [name, value] of [['NODE_ENV', 'test'], ['HV_DEMO', '1'], ['HV_CORS_ORIGINS', 'https://a.example'],
    ['HV_E2E_SKIP_LOGIN', '1'], ['E2E_HTTP_PORT', '4174'], ['HV_NOT_A_VARIABLE', 'x'], ['HV_RATE_LIMIT_LOGIN_PER_MIN', '1000']]) {
    assert.throws(() => assertServiceEnv({ ...buildServiceEnv(serviceInputs()), [name]: value }), undefined, name);
  }
  const incomplete = buildServiceEnv(serviceInputs());
  delete incomplete.HV_ACCESS_LOG_HASH_KEY;
  assert.throws(() => assertServiceEnv(incomplete));
});

test('service environment: two runs use different keys', () => {
  const [a, b] = [buildServiceEnv(serviceInputs()), buildServiceEnv(serviceInputs())];
  assert.notEqual(a.HV_AUTH_ENCRYPTION_KEY, b.HV_AUTH_ENCRYPTION_KEY);
  assert.notEqual(a.HV_ACCESS_LOG_HASH_KEY, b.HV_ACCESS_LOG_HASH_KEY);
});

test('login limits: the total is never smaller than the limit per source', () => {
  assert.doesNotThrow(() => assertLoginLimits({ loginPerSource: 120, loginTotal: 600 }));
  assert.doesNotThrow(() => assertLoginLimits({ loginPerSource: 120, loginTotal: 120 }));
  assert.throws(() => assertLoginLimits({ loginPerSource: 700, loginTotal: 600 }));
});

test('the start line the service must print is the fixed sentence', () => {
  assert.equal(START_LINE, 'HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none');
});

// ---- --check -------------------------------------------------------------------------------------------------------

test('--check passes without Docker or database, prints only fixed lines and no marker value', () => {
  const marker = 'MARKER-not-to-be-printed-4f2a9c';
  const result = spawnSync(process.execPath, ['--import', LOADER, HARNESS, '--check'], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000,
    env: { ...baseEnv, TEST_DATABASE_URL: `postgres://owner:${marker}@localhost:1/x`,
      TEST_RUNTIME_DATABASE_URL: `postgres://runtime:${marker}@localhost:1/x`, E2E_HTTP_PASSWORD: marker },
  });
  assert.equal(result.status, 0, result.stderr);
  const output = `${result.stdout}\n${result.stderr}`;
  assert(!output.includes(marker), 'no marker value in the output');
  const lines = result.stdout.split('\n').filter(Boolean);
  assert(lines.length >= 3, 'the check reports its parts');
  for (const line of lines) assert.match(line, /^031a [A-Za-z0-9 ,:().'=-]+: PASS$/, 'fixed lines only');
  assert.doesNotMatch(output, /[A-Za-z0-9_-]{43}/, 'no 43-character token-like value');
});

test('--check fails with the stage name only when the service environment is broken', () => {
  const result = spawnSync(process.execPath, ['--import', LOADER, HARNESS, '--check'], {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...baseEnv, E2E_HTTP_PORT: 'not-a-port' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^031a e2e http harness failed during [A-Za-z0-9 ,:().'-]+\.\n$/);
});

// ---- private files -------------------------------------------------------------------------------------------------

test('private files: directory 0700, files 0600, never inside the repository', () => {
  const dir = scratch();
  try {
    const state = join(dir, 'state');
    mkdirSync(state, { mode: 0o700 });
    const file = join(state, 'credentials.json');
    writePrivateFile(file, '{}');
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(statSync(state).mode & 0o777, 0o700);
    assert.doesNotThrow(() => assertOutsideRepository(state));
    assert.throws(() => assertOutsideRepository(join(ROOT, 'docs', 'evidence')));
    assert.throws(() => assertOutsideRepository(ROOT));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---- access log check ----------------------------------------------------------------------------------------------

const EIGHT_KEYS = { v: 1, ts: '2026-09-30T10:00:00.000Z', requestId: 'r-1', seq: 1, operationId: 'getMeeting', status: 200,
  latencyMs: 3, subjectHash: 'a'.repeat(16) };
const logDirWith = (lines, name = 'access-2026-09-30.jsonl') => {
  const dir = scratch();
  writeFileSync(join(dir, name), lines.join('\n') + '\n');
  return dir;
};

test('access log check: accepts eight keys and nothing else', async () => {
  const dir = logDirWith([JSON.stringify(EIGHT_KEYS), JSON.stringify({ ...EIGHT_KEYS, seq: 2 })]);
  try {
    assert.equal(await checkAccessLogFiles(dir, ['secret-text']), 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('access log check: refuses a ninth key, a forbidden text, an empty log and a missing file', async () => {
  const cases = {
    ninthKey: logDirWith([JSON.stringify({ ...EIGHT_KEYS, extra: 1 })]),
    forbiddenText: logDirWith([JSON.stringify({ ...EIGHT_KEYS, operationId: 'Synthetische Testperson Ypsilon' })]),
    noLines: logDirWith([]),
    wrongName: logDirWith([JSON.stringify(EIGHT_KEYS)], 'other.jsonl'),
  };
  try {
    for (const [name, dir] of Object.entries(cases)) {
      await assert.rejects(checkAccessLogFiles(dir, ['Synthetische Testperson Ypsilon']), undefined, name);
    }
  } finally {
    for (const dir of Object.values(cases)) rmSync(dir, { recursive: true, force: true });
  }
});

test('access log check: the harness looks for every text the suite writes', () => {
  const source = readFileSync(HARNESS, 'utf8');
  assert.match(source, /WRITTEN_TEXTS/, 'the harness imports the shared constant');
  const texts = readFileSync(join(WEB, 'e2e/support/e2e-texts.ts'), 'utf8');
  for (const name of ['H8_SPEAKER_NAME', 'H8_CONTRIBUTION_TEXT', 'H8_OTHER_WRITER_QUESTION', 'H8_UNCONFIRMED_QUESTION']) {
    assert.match(texts, new RegExp(`WRITTEN_TEXTS[^]*${name}`), `${name} is in the list`);
  }
});

// ---- Playwright configuration --------------------------------------------------------------------------------------

function loadConfig(env) {
  const script = `
    const config = (await import(${JSON.stringify(join(WEB, 'playwright.config.ts'))})).default;
    const plain = (value) => (value instanceof RegExp ? String(value) : value);
    console.log(JSON.stringify({
      reporter: config.reporter, use: config.use,
      webServer: [config.webServer].flat().map((entry) => ({ command: entry.command, url: entry.url,
        reuse: entry.reuseExistingServer, env: entry.env })),
      projects: config.projects.map((project) => ({ name: project.name, use: project.use,
        dependencies: project.dependencies ?? [], outputDir: project.outputDir, testMatch: project.testMatch, testIgnore: project.testIgnore,
        grepInvert: plain(project.grepInvert) })),
    }));`;
  const result = spawnSync(process.execPath, ['--import', LOADER, '--input-type=module', '-e', script], {
    cwd: WEB, encoding: 'utf8', timeout: 60_000, env: { ...baseEnv, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
const effective = (config, project) => ({ ...config.use, ...project.use });

test('configuration: no trace, no video, no html reporter in the HTTP projects (with and without an IdP)', () => {
  for (const env of [{ E2E_HTTP: '1' }, { E2E_HTTP: '1', E2E_HTTP_IDP: 'none' }]) {
    const config = loadConfig(env);
    assert.deepEqual(config.reporter, [['list']], 'only the list reporter');
    assert(!JSON.stringify(config.reporter).includes('html'));
    const http = config.projects.filter((project) => project.name.startsWith('http'));
    assert(http.some((project) => project.name === 'http'));
    for (const project of http) {
      const use = effective(config, project);
      assert.equal(use.trace, 'off', `${project.name} trace`);
      assert.equal(use.video, 'off', `${project.name} video`);
      assert.equal(use.screenshot, 'only-on-failure', `${project.name} screenshot`);
    }
  }
});

test('configuration: without E2E_HTTP the suite is the in-process project alone, as before', () => {
  const config = loadConfig({});
  assert.deepEqual(config.projects.map((project) => project.name), ['in-process']);
  assert.deepEqual(config.reporter, [['list'], ['html', { open: 'never' }]]);
  assert.equal(config.webServer.length, 1);
  const ignored = config.projects[0].testIgnore.join(' ');
  assert.match(ignored, /030-anmeldung\.spec\.ts/);
  assert.match(ignored, /031-http-betriebsart\.spec\.ts/);
});

test('configuration: the local mode has no setup, no dependency and skips @idp', () => {
  const config = loadConfig({ E2E_HTTP: '1', E2E_HTTP_IDP: 'none' });
  assert.deepEqual(config.projects.map((project) => project.name), ['in-process', 'http']);
  const http = config.projects.find((project) => project.name === 'http');
  assert.deepEqual(http.dependencies, []);
  assert.equal(http.grepInvert, '/@idp/');
  assert.equal(http.use.storageState, undefined);
  assert.deepEqual(http.testMatch, ['030-anmeldung.spec.ts', '031-http-betriebsart.spec.ts']);
});

test('configuration: the shared files and the default state capture belong to the http project with an IdP only (031b)', () => {
  const config = loadConfig({ E2E_HTTP: '1', E2E_HTTP_STATE_DIR: '/tmp/synthetic-state' });
  const http = config.projects.find((project) => project.name === 'http');
  assert.deepEqual([...http.testMatch].sort(), [...HTTP_ORDER].sort());
  assert.equal(http.use.storageState, '/tmp/synthetic-state/state-capture.json');
  assert.equal(config.projects.find((project) => project.name === 'http-setup').use.storageState, undefined);
  const ignored = config.projects.find((project) => project.name === 'in-process').testIgnore.join(' ');
  for (const file of SHARED_FILES) assert.doesNotMatch(ignored, new RegExp(file.replace(/\./g, '\\.')), `${file} stays in-process`);
});

test('shared files: they take test from the guard, roles from support/roles, evidence from support/evidence (031b)', () => {
  for (const file of SHARED_FILES) {
    const source = readFileSync(join(WEB, 'e2e', file), 'utf8');
    assert.match(source, /from '\.\/support\/http-guard'/, file);
    assert.match(source, /from '\.\/support\/evidence'/, file);
    assert.doesNotMatch(source, /import\s+(?:type\s+)?\{[^}]*\b(test|expect)\b[^}]*\}\s+from\s+'@playwright\/test'/, file);
    const code = source.split('\n').filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line)).join('\n');
    assert.doesNotMatch(code, /role-switcher|role-option-/, `${file} switches roles only through asRole`);
    assert.doesNotMatch(code, /docs\/evidence\//, `${file} writes evidence only through the helper`);
  }
});

test('configuration: with an IdP the setup project runs first; the port comes from E2E_HTTP_PORT everywhere', () => {
  const config = loadConfig({ E2E_HTTP: '1', E2E_HTTP_PORT: '4555', E2E_HTTP_API_ORIGIN: 'http://localhost:18999' });
  assert.deepEqual(config.projects.map((project) => project.name), ['in-process', 'http-setup', 'http']);
  assert.deepEqual(config.projects.find((project) => project.name === 'http').dependencies, ['http-setup']);
  assert.equal(config.projects.find((project) => project.name === 'http').use.baseURL, 'http://localhost:4555');
  assert.equal(config.projects.find((project) => project.name === 'http-setup').use.baseURL, 'http://localhost:4555');
  assert.equal(config.webServer.length, 1, 'the demo server only runs without E2E_HTTP');
  const [http] = config.webServer;
  assert.match(http.command, /--port 4555 --strictPort/);
  assert.equal(http.url, 'http://localhost:4555');
  assert.equal(http.reuse, false);
  assert.deepEqual(http.env, { HV_WEB_MODE: 'http', HV_API_ORIGIN: 'http://localhost:18999' });
});

test('takt-035: the HTTP web server builds, then previews the build on E2E_HTTP_PORT with the same outDir', () => {
  const config = loadConfig({ E2E_HTTP: '1', E2E_HTTP_PORT: '4555', E2E_HTTP_STATE_DIR: '/tmp/synthetic-state' });
  const [http] = config.webServer;
  const match = /^pnpm exec vite build --outDir (\S+) --emptyOutDir && pnpm exec vite preview --outDir (\S+) --port 4555 --strictPort$/
    .exec(http.command);
  assert(match, `command shape: ${http.command}`);
  assert.equal(match[1], match[2], 'build and preview use the same outDir');
  assert.equal(match[1], "'/tmp/synthetic-state/web-build'", 'the build lies in the private state directory');
  assert.doesNotMatch(http.command, /vite --port|vite dev|vite serve/, 'no dev server in the HTTP branch');
  assert.deepEqual(http.env, { HV_WEB_MODE: 'http', HV_API_ORIGIN: 'http://localhost:18091' }, 'env stays exactly these two');
  assert.equal(http.reuse, false);
  assert.equal(http.url, 'http://localhost:4555');
});

test('takt-035: without a state directory the build goes below apps/web, outside dist and inside an ignored path', () => {
  const [http] = loadConfig({ E2E_HTTP: '1' }).webServer;
  const outDir = /vite build --outDir '([^']+)'/.exec(http.command)?.[1] ?? '';
  assert(outDir.startsWith(`${WEB}/`), outDir);
  assert(!outDir.startsWith(`${WEB}/dist`), 'not the dist of the gates build');
  assert(outDir.startsWith(`${WEB}/node_modules/`), 'below node_modules, which git ignores');
  assert.match(outDir, /\/\.e2e-http-build-\d+\/web-build$/, 'per-run suffix: runs do not share the directory');
});

test('takt-035: an empty or blank E2E_HTTP_STATE_DIR is treated as absent; a relative or root-level one is refused', () => {
  for (const value of ['', '   ']) {
    const [http] = loadConfig({ E2E_HTTP: '1', E2E_HTTP_STATE_DIR: value }).webServer;
    const outDir = /vite build --outDir '([^']+)'/.exec(http.command)?.[1] ?? '';
    assert(outDir.startsWith(`${WEB}/node_modules/.e2e-http-build-`), `fallback for ${JSON.stringify(value)}: ${outDir}`);
  }
  for (const value of ['/', 'relative/dir']) {
    const result = spawnSync(process.execPath, ['--import', LOADER, '--input-type=module', '-e',
      `await import(${JSON.stringify(join(WEB, 'playwright.config.ts'))});`], {
      cwd: WEB, encoding: 'utf8', timeout: 60_000, env: { ...baseEnv, E2E_HTTP: '1', E2E_HTTP_STATE_DIR: value } });
    assert.notEqual(result.status, 0, value);
    assert.match(result.stderr, /absolute path below the root directory/);
  }
});

test('takt-035: a single quote in E2E_HTTP_STATE_DIR is refused at config load', () => {
  const result = spawnSync(process.execPath, ['--import', LOADER, '--input-type=module', '-e',
    `await import(${JSON.stringify(join(WEB, 'playwright.config.ts'))});`], {
    cwd: WEB, encoding: 'utf8', timeout: 60_000,
    env: { ...baseEnv, E2E_HTTP: '1', E2E_HTTP_STATE_DIR: "/tmp/x'; touch /tmp/pwned; '" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not contain a single quote/);
});

test('takt-035: the demo branch stays the dev server', () => {
  const [demo] = loadConfig({}).webServer;
  assert.equal(demo.command, 'pnpm exec vite --port 4173 --strictPort');
  assert.equal(demo.reuse, true);
  assert.equal(demo.env, undefined);
  const [demoPort] = loadConfig({ E2E_PORT: '4235' }).webServer;
  assert.equal(demoPort.command, 'pnpm exec vite --port 4235 --strictPort');
});

test('takt-035: the comments say production build, not dev server; preview takes the proxy of server.proxy', () => {
  const config = readFileSync(join(WEB, 'playwright.config.ts'), 'utf8');
  assert.match(config, /vite preview/);
  assert.doesNotMatch(config, /HTTP-Modus = Vite-Entwicklungsserver/);
  const vite = readFileSync(join(WEB, 'vite.config.ts'), 'utf8');
  assert.doesNotMatch(vite, /preview:\s*\{[^}]*proxy/, 'preview inherits server.proxy (Vite: preview.proxy ?? server.proxy)');
});

test('configuration: the default HTTP port is 4174', () => {
  const config = loadConfig({ E2E_HTTP: '1' });
  assert.equal(config.projects.find((project) => project.name === 'http').use.baseURL, 'http://localhost:4174');
});

// ---- order of the files --------------------------------------------------------------------------------------------

function listedFiles(env) {
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '--list', '--project=http'], {
    cwd: WEB, encoding: 'utf8', timeout: 120_000, env: { ...baseEnv, HOME: process.env.HOME ?? '', ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  const files = [];
  for (const line of result.stdout.split('\n')) {
    const match = line.match(/\[[^\]]+\] › ([^:]+):\d+:\d+ ›/);
    if (match && !files.includes(match[1])) files.push(match[1]);
  }
  return files;
}

test('order: the http project lists the seven files in the pinned order, with one worker', () => {
  assert.deepEqual(listedFiles({ E2E_HTTP: '1', E2E_HTTP_IDP: 'none' }), ['030-anmeldung.spec.ts', '031-http-betriebsart.spec.ts'],
    'the local mode has no signed-in states: the shared files stay out');
  const files = listedFiles({ E2E_HTTP: '1' });
  assert.deepEqual(files.filter((file) => file.endsWith('.spec.ts')), HTTP_ORDER);
  assert.equal(files[0], 'http/anmeldung.setup.ts', 'the setup runs before all of them');
  assert.match(readFileSync(HARNESS, 'utf8'), /'--workers=1'/, 'the harness starts the project with one worker');
});

// ---- the guard and the files of the HTTP project --------------------------------------------------------------------

test('every file of the http project takes test and expect from the guard, not from @playwright/test', () => {
  for (const file of ['e2e/030-anmeldung.spec.ts', 'e2e/031-http-betriebsart.spec.ts', 'e2e/http/anmeldung.setup.ts']) {
    const source = readFileSync(join(WEB, file), 'utf8');
    assert.match(source, /from '[./]+\/(support\/)?http-guard'/, file);
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@playwright\/test'/g)) {
      const names = match[1].split(',').map((name) => name.trim().split(/\s+as\s+/)[0]);
      assert(!names.includes('test') && !names.includes('expect'), `${file} imports test or expect from @playwright/test`);
    }
  }
  const guard = readFileSync(join(WEB, 'e2e/support/http-guard.ts'), 'utf8');
  assert.match(guard, /auto: true/);
  assert.match(guard, /on\('response'/);
  assert.match(guard, /429/);
});

test('e2e-texts.ts needs nothing but type stripping: exports of constants only, no imports', () => {
  const source = readFileSync(join(WEB, 'e2e/support/e2e-texts.ts'), 'utf8');
  const code = source.split('\n').filter((line) => !/^\s*(\/\*|\*|\/\/)/.test(line));
  assert(!code.some((line) => /^\s*import\b|\benum\b|\bnamespace\b/.test(line)));
  for (const line of code.filter((entry) => /^export /.test(entry))) assert.match(line, /^export const /);
});

// ---- the workflow ---------------------------------------------------------------------------------------------------

const workflow = readFileSync(join(ROOT, '.github/workflows/gates.yml'), 'utf8');
const job = workflow.slice(workflow.indexOf('\n  e2e-http:'));
const gatesJob = workflow.slice(workflow.indexOf('\n  gates:'), workflow.indexOf('\n  e2e-http:'));

test('workflow: e2e-http is a second job on pull requests with the inherited rights and its own limits', () => {
  assert(workflow.indexOf('\n  e2e-http:') > workflow.indexOf('\n  gates:'));
  assert.match(job, /if: github\.event_name == 'pull_request'/);
  assert.match(job, /runs-on: ubuntu-latest/);
  assert.match(job, /timeout-minutes: 20/);
  assert.doesNotMatch(job, /\n    permissions:/, 'no own permissions block: the workflow rights are inherited');
  assert.match(workflow, /^permissions:\n  contents: read\n  pull-requests: read$/m);
  assert.match(job, /Install Chromium for Playwright[^]*?timeout-minutes: 4/);
  assert.match(job, /name: End-to-end http project against Hono, Postgres and Keycloak\n[^]*?timeout-minutes: 14/);
  assert.match(job, /scripts\/e2e-http-031\.mjs/);
  assert.match(job, /persist-credentials: false/);
  assert.match(job, /fetch-depth: 0/);
});

test('workflow: every action is pinned to a commit and the images to a digest, in both jobs', () => {
  for (const [name, text] of [['gates', gatesJob], ['e2e-http', job]]) {
    for (const line of text.split('\n').filter((entry) => /^\s*-?\s*uses:/.test(entry))) {
      assert.match(line, /uses: [\w./-]+@[0-9a-f]{40}( #.*)?$/, `${name}: ${line.trim()}`);
    }
    assert.match(text, /image: postgres:16@sha256:[0-9a-f]{64}/, `${name}: postgres image digest`);
    assert.doesNotMatch(text, /image: postgres:16\n/, `${name}: no bare tag`);
  }
});

test('workflow: e2e-http uploads only the four screenshots and never a report, trace or video', () => {
  assert.match(job, /name: evidence-031-http/);
  assert.match(job, /path: docs\/evidence\/031-\*\.png/);
  assert.doesNotMatch(job, /playwright-report|test-results|trace|\.webm|video/i);
  assert.equal((job.match(/upload-artifact/g) ?? []).length, 1);
});

test('workflow: the Keycloak step of 029b stays in the gates job, unchanged', () => {
  assert.match(gatesJob, /name: Keycloak browser login against migrated Postgres\n[^]*?scripts\/keycloak-ci-029b\.mjs/);
  assert.doesNotMatch(job, /keycloak-ci-029b/);
});

// ---- no test hook in the product path (MF-12) ------------------------------------------------------------------------

test('MF-12: no file of this slice sets a test switch, a HV_E2E variable or a wider CORS setting', () => {
  for (const file of ['scripts/e2e-http-031.mjs', 'scripts/lib/keycloak-ci.mjs', '.github/workflows/gates.yml',
    'apps/web/playwright.config.ts']) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    assert.doesNotMatch(source, /HV_E2E_[A-Z_]*\s*[:=]/, file);
    assert.doesNotMatch(source, /HV_CORS_ORIGINS\s*[:=]\s*['"`]?\S/, file);
  }
});

// ---- review round: failure report, signals, time, process group, loader ------------------------------------------------

test('configuration: the output of both HTTP projects goes into the private state directory', () => {
  const config = loadConfig({ E2E_HTTP: '1', E2E_HTTP_STATE_DIR: '/tmp/synthetic-state' });
  for (const name of ['http-setup', 'http']) {
    assert.equal(config.projects.find((project) => project.name === name).outputDir, '/tmp/synthetic-state/test-results', name);
  }
  assert.equal(config.projects.find((project) => project.name === 'in-process').outputDir, undefined);
});

test('the failure report cannot leave a password behind: variable set and output directory private', () => {
  // Probe of the review: a password typed with `fill` lands in `error-context.md` (page snapshot). The variable
  // `PLAYWRIGHT_NO_COPY_PROMPT` stops it for a plain failure but not for a failed matcher, so the output directory in the
  // private state directory is what protects it; both are pinned here.
  const harness = readFileSync(HARNESS, 'utf8');
  assert.match(harness, /PLAYWRIGHT_NO_COPY_PROMPT: '1'/);
  const config = readFileSync(join(WEB, 'playwright.config.ts'), 'utf8');
  assert.match(config, /outputDir: `\$\{stateDir\}\/test-results`/);
});

test('harness: signals, total time limit, process group and free ports are handled', () => {
  const source = readFileSync(HARNESS, 'utf8');
  assert.match(source, /process\.once\('SIGINT'/);
  assert.match(source, /process\.once\('SIGTERM'/);
  assert.match(source, /detached: true/);
  assert.match(source, /process\.kill\(-child\.pid/);
  assert.match(source, /assertPortFree\(SERVICE_PORT\)/);
  assert.doesNotMatch(source, /pkill|killall|lsof/);
  const number = (name) => Number(new RegExp(`const ${name} = ([\\d_]+);`).exec(source)?.[1].replaceAll('_', ''));
  const total = number('TOTAL_MS');
  assert.equal(total, 720_000);
  // takt-046: the limits are read from the workflow, not copied.
  const stepMinutes = Number(/name: End-to-end http project against Hono, Postgres and Keycloak\n[^]*?timeout-minutes: (\d+)/.exec(job)?.[1]);
  const chromiumMinutes = Number(/Install Chromium for Playwright[^]*?timeout-minutes: (\d+)/.exec(job)?.[1]);
  const jobMinutes = Number(/^    timeout-minutes: (\d+)$/m.exec(job)?.[1]);
  assert(total + 60_000 <= stepMinutes * 60_000, 'the harness limit lies at least one minute inside the step limit');
  assert(jobMinutes >= stepMinutes + chromiumMinutes + 1, 'the job limit covers step, Chromium and one minute');
  assert.equal(number('WARN_MS'), 390_000);
  assert(number('WARN_MS') < total - number('CLEANUP_RESERVE_MS'));
});

test('harness: the duration line reports total, limit, threshold and stages; the annotation is a warning only above the threshold', () => {
  const stages = [['database', 12_000], ['end-to-end run', 300_000]];
  const calm = formatDuration({ totalMs: 345_000, limitMs: 720_000, warnMs: 390_000, stages });
  assert(calm.line.startsWith('031a duration: total 5:45 of limit 12:00, warning above 6:30; stages: '), calm.line);
  assert(calm.line.indexOf('database 0:12') < calm.line.indexOf('end-to-end run 5:00'), 'stages keep their order');
  assert(calm.annotation.startsWith('::notice title=e2e-http duration::'));
  assert(formatDuration({ totalMs: 390_000, limitMs: 720_000, warnMs: 390_000, stages }).annotation.startsWith('::notice title=e2e-http duration::'));
  assert(formatDuration({ totalMs: 390_001, limitMs: 720_000, warnMs: 390_000, stages }).annotation
    .startsWith('::warning title=e2e-http duration::'));
  assert(formatDuration({ totalMs: 61_999, limitMs: 720_000, warnMs: 390_000, stages }).line.includes('total 1:01 of'));
  assert(formatDuration({ totalMs: 600_000, limitMs: 720_000, warnMs: 390_000, stages }).line.includes('total 10:00 of'));
});

test('harness: formatDuration is called in the finally of main around run(), guarded, with the four fields only', () => {
  const source = readFileSync(HARNESS, 'utf8');
  const main = source.slice(source.indexOf('async function main()'), source.indexOf('async function run('));
  assert.match(main, /await run\([^]*\} finally \{\s*(?:\/\/[^\n]*\n\s*)*try \{[^]*formatDuration\(\{ totalMs: [^}]*\}\)[^]*\} catch \{\}/);
  const run = source.slice(source.indexOf('async function run('), source.indexOf('function collect('));
  assert.doesNotMatch(run, /formatDuration/);
  assert.match(source, /export function formatDuration\(\{ totalMs, limitMs, warnMs, stages \}\)/);
});

test('harness: a setup failure (missing database variables) still prints the duration line and annotation', () => {
  const result = spawnSync(process.execPath, ['--import', LOADER, HARNESS], {
    cwd: ROOT, encoding: 'utf8', timeout: 30_000, env: baseEnv });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^031a duration: total 0:0\d of limit 12:00, warning above 6:30; stages: $/m);
  assert.match(result.stdout, /^::notice title=e2e-http duration::031a duration: /m);
  assert.equal(result.stderr, '031a e2e http harness failed during tsx loader check.\n');
});

test('harness: without the tsx loader it says so with a fixed sentence', () => {
  assert.equal(loaderIsActive(['--import', '/x/tsx/dist/loader.mjs'], ''), true);
  assert.equal(loaderIsActive([], ''), false);
  const result = spawnSync(process.execPath, [HARNESS, '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 30_000, env: baseEnv });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, `${LOADER_HINT}\n`);
});

test('the guard test exists: a 429 from a route double must turn a test.fail() test into a pass', () => {
  const source = readFileSync(join(WEB, 'e2e/031-http-betriebsart.spec.ts'), 'utf8');
  assert.match(source, /G1: a 429[^]*?test\.fail\(\)[^]*?status: 429/);
  assert.doesNotMatch(source.slice(source.indexOf('G1: a 429'), source.indexOf('H4/H5')), /@idp/);
});
