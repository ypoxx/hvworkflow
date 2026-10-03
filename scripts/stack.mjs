/**
 * Slice 037a: the one command of the local operations package. Node built-ins and `scripts/lib` only, so it runs
 * without `pnpm install`:
 *
 *   node scripts/stack.mjs up [-- --recreate <service…>]   prerequisites, state, images, stack, wait, smoke test
 *   node scripts/stack.mjs smoke                          the smoke test alone (S12)
 *   node scripts/stack.mjs credentials                    the only command that prints user names and passwords
 *   node scripts/stack.mjs down                           stop; the data stays
 *   node scripts/stack.mjs reset --yes                    down with volumes, state directory deleted
 *   node scripts/stack.mjs probe <name>                   the checks of S14 to S16 (images, refusals,
 *                                                         postgres-restart, api-crash), also listed on the install page
 *
 * Secrets and the whole test realm are generated once per installation and kept in the state directory
 * `${XDG_STATE_HOME:-$HOME/.local/state}/hv-tool-stack` (0700, files 0600, realm.json 0644), outside the repository.
 * Every `up` writes the realm and one env file per service byte-identical from `state.json`; nothing is regenerated.
 *
 * Output rule: no value of a secret, no driver or Docker message, ever; on a failure only the name of the stage (as in
 * 031a) or one of the fixed refusal sentences. With GITHUB_ACTIONS=true one `::add-mask::` line per secret comes before
 * any other output. Neither this script nor CI runs `docker compose config` (it would print the env files).
 */
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRealm, randomSecret } from './lib/keycloak-ci.mjs';
import { PERSONS } from './lib/demo-persons.mjs';
import { assertOutsideRepository } from './e2e-http-031.mjs';
import { SEED_ALREADY_FILLED, SEED_FILLED, SEED_REFUSALS } from './stack-seed.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PROJECT = 'hv-tool';
export const COMPOSE_FILE = join(ROOT, 'deploy/compose/compose.yaml');
export const REALM_NAME = 'hv-local';
export const DEFAULT_WEB_PORT = 8480;
export const DEFAULT_IDP_PORT = 8180;
export const SERVICE_PORT = 8787;
export const START_LINE = 'HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none';
export const ENV_FILES = ['api.env', 'postgres.env', 'migrate.env', 'seed.env', 'keycloak.env'];
export const MIN_ENGINE_MAJOR = 28;
export const MIN_COMPOSE = [2, 20];
export const RECREATABLE = ['postgres', 'keycloak', 'api', 'web'];
export const PROBES = ['images', 'refusals', 'postgres-restart', 'api-crash'];
export const CLOCK_NOT_CONFIGURED =
  'Uhrprüfung nicht eingerichtet (erwartet ohne HV_STACK_NTP_SERVERS); Datenbank und Migrationen bereit.';
const PG_VOLUME = `${PROJECT}_hv-pgdata`;
const SECURITY_HEADERS = { 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const NOTICE = {
  version: 'hv-stack-local-1',
  de: 'Lokale Demo-Installation des HV-Tools mit ausschließlich synthetischen Testdaten. Das Zugriffslog ist pseudonym und wird nach 30 Tagen gelöscht.',
  en: 'Local demo installation of the HV-Tool with synthetic test data only. The access log is pseudonymous and is deleted after 30 days.',
};

/** A refusal with a fixed sentence that holds no secret; the only error text that reaches the output. */
export class StackRefusal extends Error {}

// ---- state ----------------------------------------------------------------------------------------------------------

export function stateDirectory(env = process.env) {
  const base = env.XDG_STATE_HOME && env.XDG_STATE_HOME !== '' ? env.XDG_STATE_HOME : join(env.HOME ?? '', '.local/state');
  return join(base, 'hv-tool-stack');
}

/** A new installation: every secret and the whole realm, generated once. */
export function createState({ webPort, idpPort }) {
  const origin = `http://localhost:${webPort}`;
  const { identity, users, realm } = buildRealm({ realmName: REALM_NAME, redirectUris: [`${origin}/auth/callback`],
    webOrigins: [origin], persons: PERSONS.map((person) => person.key) });
  // Readable user names and addresses on @example.test; ids and passwords stay those of buildRealm (random).
  const keyById = Object.fromEntries(Object.entries(users).map(([key, user]) => [user.id, key]));
  for (const user of realm.users) {
    const key = keyById[user.id];
    user.username = key;
    user.email = `${key}@example.test`;
  }
  const persons = Object.fromEntries(Object.entries(users).map(([key, user]) => [key, { id: user.id, username: key,
    password: user.password }]));
  return {
    version: 1,
    webPort,
    idpPort,
    started: false,
    postgres: { superPassword: randomSecret(), ownerPassword: randomSecret(), runtimePassword: randomSecret() },
    api: { authKey: randomBytes(32).toString('base64url'), accessLogHashKey: randomBytes(32).toString('base64') },
    keycloak: { adminName: 'hv-admin', adminPassword: identity.adminPassword },
    identity: { clientId: identity.clientId, clientSecret: identity.clientSecret },
    persons,
    realm,
  };
}

export function secretsOf(state) {
  return [state.postgres.superPassword, state.postgres.ownerPassword, state.postgres.runtimePassword, state.api.authKey,
    state.api.accessLogHashKey, state.keycloak.adminPassword, state.identity.clientSecret,
    ...PERSONS.map((person) => state.persons[person.key].password)];
}

export const issuerOf = (state) => `http://localhost:${state.idpPort}/realms/${REALM_NAME}`;
const envLines = (entries) => `${entries.map(([key, value]) => `${key}=${value}`).join('\n')}\n`;

/** The realm and the env file of each service. Pure: the same state gives the same bytes. */
export function renderFiles(state, { ntpServers } = {}) {
  const ownerUrl = `postgres://hv_owner:${state.postgres.ownerPassword}@postgres:5432/hv`;
  return {
    'realm.json': `${JSON.stringify(state.realm, null, 2)}\n`,
    'postgres.env': envLines([
      ['POSTGRES_PASSWORD', state.postgres.superPassword],
      ['HV_OWNER_PASSWORD', state.postgres.ownerPassword],
      ['HV_RUNTIME_PASSWORD', state.postgres.runtimePassword],
    ]),
    'keycloak.env': envLines([
      ['KC_BOOTSTRAP_ADMIN_USERNAME', state.keycloak.adminName],
      ['KC_BOOTSTRAP_ADMIN_PASSWORD', state.keycloak.adminPassword],
    ]),
    'migrate.env': envLines([['HV_MIGRATION_DATABASE_URL', ownerUrl], ['HV_DB_RUNTIME_ROLE', 'hv_runtime']]),
    'seed.env': envLines([
      ['STACK_SEED_DATABASE_URL', ownerUrl],
      ['STACK_SEED_ISSUER', issuerOf(state)],
      ['STACK_SEED_SUBJECTS', PERSONS.map((person) => `${person.key}=${state.persons[person.key].id}`).join(',')],
    ]),
    'api.env': envLines([
      ['PORT', String(SERVICE_PORT)],
      ['HV_DATABASE_URL', `postgres://hv_runtime:${state.postgres.runtimePassword}@postgres:5432/hv`],
      ['HV_OIDC_ISSUER', issuerOf(state)],
      ['HV_OIDC_CLIENT_ID', state.identity.clientId],
      ['HV_OIDC_CLIENT_SECRET', state.identity.clientSecret],
      ['HV_OIDC_REDIRECT_URI', `http://localhost:${state.webPort}/auth/callback`],
      ['HV_AUTH_ENCRYPTION_KEY', state.api.authKey],
      ['HV_ACCESS_LOG_DIR', '/var/lib/hv/access-log'],
      ['HV_ACCESS_LOG_HASH_KEY', state.api.accessLogHashKey],
      ['HV_TRANSPARENCY_NOTICE_VERSION', NOTICE.version],
      ['HV_TRANSPARENCY_NOTICE_DE', NOTICE.de],
      ['HV_TRANSPARENCY_NOTICE_EN', NOTICE.en],
      ...(ntpServers ? [['HV_NTP_SERVERS', ntpServers]] : []),
    ]),
  };
}

/** The state directory must belong to the caller, allow nobody else (0700) and lie outside the repository. */
export function assertPrivateDirectory(dir) {
  const stat = lstatSync(dir);
  const rule = 'muss ein eigenes Verzeichnis mit den Rechten 0700 sein (kein Link, nur der Eigentümer)';
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) {
    throw new StackRefusal(`Das Zustandsverzeichnis ${dir} ${rule}.`);
  }
  assertOutsideRepository(dir);
}

function writeFile(path, content, mode) {
  writeFileSync(path, content, { mode });
  chmodSync(path, mode);
}

function parsePort(name, raw) {
  if (raw === undefined || raw === '') return undefined;
  const port = /^\d{1,5}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!(port >= 1024 && port <= 65_535)) throw new StackRefusal(`${name} muss eine ganze Zahl von 1024 bis 65535 sein.`);
  return port;
}

/** Ports come from the first start; a later different value is refused (realm and issuer depend on them). */
export function resolvePorts(env, state) {
  const web = parsePort('HV_STACK_WEB_PORT', env.HV_STACK_WEB_PORT);
  const idp = parsePort('HV_STACK_IDP_PORT', env.HV_STACK_IDP_PORT);
  if (state) {
    for (const [name, given, stored] of [['HV_STACK_WEB_PORT', web, state.webPort], ['HV_STACK_IDP_PORT', idp, state.idpPort]]) {
      if (given !== undefined && given !== stored) {
        throw new StackRefusal(`${name} weicht vom Port der Installation (${stored}) ab. Realm und Issuer hängen daran; `
          + 'ein anderer Port braucht eine neue Installation: pnpm stack:reset --yes, dann pnpm stack:up.');
      }
    }
    return { webPort: state.webPort, idpPort: state.idpPort };
  }
  const ports = { webPort: web ?? DEFAULT_WEB_PORT, idpPort: idp ?? DEFAULT_IDP_PORT };
  if (ports.webPort === ports.idpPort) throw new StackRefusal('HV_STACK_WEB_PORT und HV_STACK_IDP_PORT müssen verschieden sein.');
  return ports;
}

export function readState(env = process.env) {
  const dir = stateDirectory(env);
  if (!existsSync(dir)) return undefined;
  assertPrivateDirectory(dir);
  const file = join(dir, 'state.json');
  if (!existsSync(file)) return undefined;
  return { dir, state: JSON.parse(readFileSync(file, 'utf8')) };
}

export function readOrCreateState(env = process.env) {
  const existing = readState(env);
  if (existing) {
    resolvePorts(env, existing.state);
    return { ...existing, created: false };
  }
  const dir = stateDirectory(env);
  const ports = resolvePorts(env, undefined);
  mkdirSync(dirname(dir), { recursive: true });
  if (!existsSync(dir)) {
    mkdirSync(dir, { mode: 0o700 });
    chmodSync(dir, 0o700);
  }
  assertPrivateDirectory(dir);
  const state = createState(ports);
  saveState(dir, state);
  return { dir, state, created: true };
}

export function saveState(dir, state) {
  writeFile(join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, 0o600);
}

/** state.json, the realm (0644, readable by the Keycloak user, the directory stays 0700) and the env files (0600). */
export function writeStateFiles(dir, state, { ntpServers, buildCa } = {}) {
  assertPrivateDirectory(dir);
  saveState(dir, state);
  for (const [name, content] of Object.entries(renderFiles(state, { ntpServers }))) {
    writeFile(join(dir, name), content, name === 'realm.json' ? 0o644 : 0o600);
  }
  writeFile(join(dir, 'build-ca.pem'), buildCa ?? '', 0o600);
}

/** Pure drift check between the state directory and the database volume. */
export function checkDrift({ stateExists, started, volumeExists }) {
  if (volumeExists && !stateExists) {
    return `Das Datenbank-Volume ${PG_VOLUME} besteht ohne Zustandsverzeichnis; die Passwörter dazu fehlen. `
      + 'Abhilfe: pnpm stack:reset --yes (löscht die lokalen Daten), dann pnpm stack:up.';
  }
  if (stateExists && started && !volumeExists) {
    return `Das Zustandsverzeichnis besteht, das Datenbank-Volume ${PG_VOLUME} aber nicht mehr. `
      + 'Abhilfe: pnpm stack:reset --yes, dann pnpm stack:up.';
  }
  return undefined;
}

// ---- local limits ---------------------------------------------------------------------------------------------------

/** A remote daemon would make `up` a deploy without the owner's go (R11). */
export function checkDockerHost({ dockerHost, contextHost }) {
  for (const host of [dockerHost, contextHost]) {
    if (typeof host === 'string' && /^(tcp|ssh):\/\//i.test(host.trim())) {
      return 'Ein entfernter Docker-Daemon (DOCKER_HOST oder Docker-Kontext mit tcp:// oder ssh://) wird verweigert: '
        + 'Das Paket läuft nur auf dem eigenen Rechner.';
    }
  }
  return undefined;
}

const versionParts = (raw) => String(raw ?? '').trim().replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10));

/** Older engines could let machines in the same network segment reach ports published only on 127.0.0.1. */
export function checkEngineVersion(raw) {
  const [major] = versionParts(raw);
  return Number.isInteger(major) && major >= MIN_ENGINE_MAJOR ? undefined
    : `Docker Engine ab Version ${MIN_ENGINE_MAJOR} ist Pflicht (ältere Versionen schützen Ports auf 127.0.0.1 nicht sicher).`;
}

export function checkComposeVersion(raw) {
  const [major, minor] = versionParts(raw);
  const ok = Number.isInteger(major) && (major > MIN_COMPOSE[0] || (major === MIN_COMPOSE[0] && minor >= MIN_COMPOSE[1]));
  return ok ? undefined : `Docker Compose v2 ab Version ${MIN_COMPOSE.join('.')} ist Pflicht.`;
}

// ---- arguments and plan ---------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const tokens = argv.filter((token) => token !== '--');
  const args = { command: tokens[0], yes: false, recreate: [], probe: undefined };
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--yes') args.yes = true;
    else if (token === '--recreate') {
      while (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) args.recreate.push(tokens[++i]);
      if (args.recreate.length === 0 || args.recreate.some((name) => !RECREATABLE.includes(name))) {
        throw new StackRefusal(`--recreate nimmt nur diese Dienste: ${RECREATABLE.join(', ')}.`);
      }
    } else if (args.command === 'probe' && args.probe === undefined) args.probe = token;
    else throw new StackRefusal(`Unbekanntes Argument für ${args.command ?? 'stack'}.`);
  }
  return args;
}

/** The compose calls of `up`, always with the stored ports and the state directory. */
export function upPlan(args, state, dir) {
  const compose = ['compose', '-p', PROJECT, '-f', COMPOSE_FILE];
  return {
    compose,
    build: [...compose, 'build'],
    up: [...compose, 'up', '--detach', '--quiet-pull', ...(args.recreate.length > 0 ? ['--force-recreate', ...args.recreate] : [])],
    env: { HV_STACK_STATE_DIR: dir, HV_STACK_WEB_PORT: String(state.webPort), HV_STACK_IDP_PORT: String(state.idpPort) },
  };
}

// ---- output ---------------------------------------------------------------------------------------------------------

/** In GitHub Actions every secret is masked before the first other line. */
export function startOutput({ env = process.env, secrets, write = (line) => process.stdout.write(`${line}\n`) }) {
  if (env.GITHUB_ACTIONS === 'true') for (const secret of secrets) write(`::add-mask::${secret}`);
  return (line) => write(line);
}

export const formatSmokeLine = (label, ok) => `${ok ? 'PASS' : 'FAIL'} ${label}`;

export function formatFailure(stage, error) {
  const detail = error instanceof StackRefusal ? `\n${error.message}` : '';
  return `HV-Stack: Fehler in der Stufe „${stage}“.${detail}`;
}

export function formatUpSummary(state, { realmHash, fill }) {
  return [
    `Befüllung: ${fill}. realm.json sha256 ${realmHash}.`,
    `Anmeldung (Keycloak, nur lokal): http://localhost:${state.idpPort}/realms/${REALM_NAME}`,
    `HV-Stack bereit: http://localhost:${state.webPort} – Zugangsdaten der Testpersonen mit pnpm stack:credentials.`,
  ].join('\n');
}

/** The one place that prints values, only on an explicit call. Role names stand here and on the install page only. */
export function formatCredentials(state) {
  const width = Math.max(...PERSONS.map((person) => person.key.length));
  return [
    `Testpersonen (Realm ${REALM_NAME}, Anmeldung unter http://localhost:${state.webPort}):`,
    ...PERSONS.map((person) => `  ${person.key.padEnd(width)}  Rolle: ${(person.role ?? '–').padEnd(width)}  Passwort: ${state.persons[person.key].password}`),
    `Keycloak-Admin-Konsole (nur lokal): http://localhost:${state.idpPort}/admin/  Nutzer: ${state.keycloak.adminName}  Passwort: ${state.keycloak.adminPassword}`,
  ].join('\n');
}

// ---- Docker ---------------------------------------------------------------------------------------------------------

/** Runs docker; output is captured and never printed unless `inherit` (the image build, which holds no value). */
export function docker(args, { env = {}, inherit = false, timeoutMs = 600_000 } = {}) {
  return new Promise((resolveRun) => {
    const child = spawn('docker', args, { cwd: ROOT, env: { ...process.env, ...env },
      stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { if (stdout.length < 4_000_000) stdout += chunk; });
    child.stderr?.on('data', (chunk) => { if (stderr.length < 1_000_000) stderr += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.once('error', () => { clearTimeout(timer); resolveRun({ code: 127, stdout, stderr }); });
    child.once('close', (code) => { clearTimeout(timer); resolveRun({ code: code ?? 1, stdout, stderr }); });
  });
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function mustDocker(args, options) {
  const result = await docker(args, options);
  if (result.code !== 0) throw new Error('docker failed');
  return result.stdout;
}

async function prerequisites() {
  const context = await docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { timeoutMs: 20_000 });
  const hostRefusal = checkDockerHost({ dockerHost: process.env.DOCKER_HOST, contextHost: context.stdout.trim() });
  if (hostRefusal) throw new StackRefusal(hostRefusal);
  const engine = await docker(['version', '--format', '{{.Server.Version}}'], { timeoutMs: 30_000 });
  if (engine.code !== 0) throw new StackRefusal('Docker läuft nicht oder ist für diesen Nutzer nicht erreichbar.');
  const engineRefusal = checkEngineVersion(engine.stdout);
  if (engineRefusal) throw new StackRefusal(engineRefusal);
  const compose = await docker(['compose', 'version', '--short'], { timeoutMs: 20_000 });
  const composeRefusal = compose.code === 0 ? checkComposeVersion(compose.stdout) : checkComposeVersion('');
  if (composeRefusal) throw new StackRefusal(composeRefusal);
}

function assertPortFree(port) {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', () => rejectPort(new StackRefusal(`Port ${port} auf 127.0.0.1 ist belegt. Anderen Dienst beenden oder `
      + 'beim ersten Start HV_STACK_WEB_PORT und HV_STACK_IDP_PORT setzen.')));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolvePort()));
  });
}

/** One row per container: service, state, health, exit code (newer compose prints NDJSON, older a JSON array). */
async function composePs(plan) {
  const out = await mustDocker([...plan.compose, 'ps', '--all', '--format', 'json'], { env: plan.env, timeoutMs: 30_000 });
  const text = out.trim();
  if (text === '') return [];
  const rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  return rows.map((row) => ({ service: row.Service, state: row.State, health: row.Health ?? '', exitCode: row.ExitCode }));
}

const LONG_RUNNING = ['postgres', 'keycloak', 'api', 'web'];
const ONE_OFF = ['migrate', 'seed'];

async function waitForStack(plan, { timeoutMs = 900_000, services = [...LONG_RUNNING, ...ONE_OFF] } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await composePs(plan);
    const byService = Object.fromEntries(rows.map((row) => [row.service, row]));
    for (const name of ONE_OFF) {
      const row = byService[name];
      if (services.includes(name) && row?.state === 'exited' && row.exitCode !== 0) {
        throw new StackRefusal(`Der einmalige Schritt ${name} endete mit Fehler. Protokoll lokal: docker compose -p ${PROJECT} logs ${name}`);
      }
    }
    const ready = services.every((name) => {
      const row = byService[name];
      if (ONE_OFF.includes(name)) return row?.state === 'exited' && row.exitCode === 0;
      return row?.state === 'running' && row.health === 'healthy';
    });
    if (ready) return;
    await sleep(2_000);
  }
  throw new Error('timeout');
}

async function containerId(plan, service) {
  return (await mustDocker([...plan.compose, 'ps', '--all', '-q', service], { env: plan.env, timeoutMs: 20_000 })).trim();
}

async function restartCount(plan, service) {
  // Only the count is read; `docker inspect` without a format would print the environment.
  const out = await mustDocker(['inspect', '--format', '{{.RestartCount}}', await containerId(plan, service)], { timeoutMs: 20_000 });
  return Number(out.trim());
}

async function sql(plan, query) {
  const out = await mustDocker([...plan.compose, 'exec', '-T', 'postgres', 'psql', '-U', 'hv_owner', '-d', 'hv', '-At', '-v',
    'ON_ERROR_STOP=1', '-c', query], { env: plan.env, timeoutMs: 30_000 });
  return out.trim();
}

const eventCount = async (plan) => Number(await sql(plan, 'SELECT count(*) FROM events'));

/** A Node one-liner inside the api container (the image has no shell); prints one JSON line. */
async function inApi(plan, script, { timeoutMs = 30_000 } = {}) {
  const result = await docker([...plan.compose, 'exec', '-T', 'api', '/nodejs/bin/node', '-e', script], { env: plan.env, timeoutMs });
  const line = result.stdout.trim().split('\n').at(-1) ?? '';
  try { return { code: result.code, value: JSON.parse(line) }; } catch { return { code: result.code, value: undefined }; }
}

const READINESS_SCRIPT = `
const get = async (path) => { const r = await fetch('http://127.0.0.1:${SERVICE_PORT}' + path); let b = null; try { b = await r.json(); } catch {} return { status: r.status, body: b }; };
(async () => { const h = await get('/healthz'); const r = await get('/readyz'); const c = (r.body && r.body.checks) || {};
  console.log(JSON.stringify({ healthz: h.status, readyz: r.status, db: c.db && c.db.status, migrations: c.migrations && c.migrations.status,
    clock: c.clock && c.clock.status, clockCode: c.clock && c.clock.code })); })().catch(() => console.log('{}'));`;

// ---- smoke test (S12) -----------------------------------------------------------------------------------------------

function headersOnce(response) {
  return Object.entries(SECURITY_HEADERS).every(([name, value]) => response.headers.get(name) === value);
}

async function fetchStatus(url, init) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...init });
  const body = await response.text();
  return { response, status: response.status, body };
}

async function waitService(plan, service, timeoutMs = 120_000) {
  await waitForStack(plan, { timeoutMs, services: [service] });
}

export async function smoke({ state, dir, plan, say }) {
  const web = `http://127.0.0.1:${state.webPort}`;
  const check = (label, ok) => {
    say(formatSmokeLine(label, ok));
    if (!ok) throw new StackRefusal(`Rauchtest fehlgeschlagen: ${label}`);
  };

  // 1. headers, each exactly once
  const root = await fetchStatus(`${web}/`);
  check('Header einmal auf GET / (200, text/html)',
    root.status === 200 && /text\/html/.test(root.response.headers.get('content-type') ?? '') && headersOnce(root.response));
  const meetings = await fetchStatus(`${web}/v1/meetings`);
  check(`Header einmal auf GET /v1/meetings ohne Sitzung (Antwort des Dienstes, ${meetings.status})`,
    meetings.status === 401 && headersOnce(meetings.response));
  const asset = root.body.match(/\/assets\/[A-Za-z0-9._-]+\.js/)?.[0];
  const assetResponse = asset ? await fetchStatus(`${web}${asset}`) : undefined;
  check('Header einmal auf einer Datei unter /assets/', assetResponse?.status === 200 && headersOnce(assetResponse.response));
  await mustDocker([...plan.compose, 'stop', 'api'], { env: plan.env, timeoutMs: 60_000 });
  let gateway;
  try {
    gateway = await fetchStatus(`${web}/v1/meetings`);
  } finally {
    await mustDocker([...plan.compose, 'start', 'api'], { env: plan.env, timeoutMs: 60_000 });
  }
  check('Header einmal auf 502 bei angehaltenem Dienst', gateway.status === 502 && headersOnce(gateway.response));
  await waitService(plan, 'api');

  // 2. proxy paths
  const notice = await fetchStatus(`${web}/auth/transparency-notice`);
  check('GET /auth/transparency-notice 200 (Web → Dienst)', notice.status === 200 && headersOnce(notice.response));
  for (const path of ['/healthz', '/readyz', '/metrics']) {
    const probe = await fetchStatus(`${web}${path}`);
    check(`GET ${path} auf dem Webport 404, nicht index.html`, probe.status === 404 && !probe.body.includes('id="root"')
      && headersOnce(probe.response));
  }
  const map = await fetchStatus(`${web}${asset}.map`);
  check('Quelltextkarte (.map) 404', map.status === 404 && !map.body.includes('id="root"'));
  const large = await fetchStatus(`${web}/v1/meetings`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: 'x'.repeat(300 * 1024) });
  check('Body von 300 KB 413 am Proxy', large.status === 413 && headersOnce(large.response));

  // 4. probes inside the container
  const ntp = /^HV_NTP_SERVERS=/m.test(readFileSync(join(dir, 'api.env'), 'utf8'));
  const { value: ready } = await inApi(plan, READINESS_SCRIPT);
  check('/healthz im Container 200', ready?.healthz === 200);
  check('/readyz im Container: db und migrations ok', ready?.db === 'ok' && ready?.migrations === 'ok');
  if (ready?.readyz === 503 && ready.clockCode === 'not_configured' && !ntp) say(CLOCK_NOT_CONFIGURED);
  else check('/readyz im Container 200, clock ok', ready?.readyz === 200 && ready.clock === 'ok');

  // 5. start line (read only, never printed)
  const logs = (await mustDocker([...plan.compose, 'logs', '--no-color', '--no-log-prefix', 'api'], { env: plan.env })).split('\n');
  check('Startzeile des Dienstes genau wie erwartet, kein "refusing to start", keine unbekannte Variable',
    logs.includes(START_LINE) && !logs.some((line) => /refusing to start|ignoring unknown variables/.test(line)));

  // 6. fill
  const events = await eventCount(plan);
  check(`Ereignislog befüllt (${events} Ereignisse)`, events > 0);

  // 7. roles
  const roles = await sql(plan, "SELECT rolname, rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname IN ('hv_owner', 'hv_runtime') ORDER BY rolname");
  check('hv_owner und hv_runtime: kein Superuser, kein CREATEROLE, kein CREATEDB', roles === 'hv_owner|f|f|f\nhv_runtime|f|f|f');
  const rights = await sql(plan, "SELECT has_table_privilege('hv_runtime', 'public.events', 'UPDATE'), has_table_privilege('hv_runtime', 'public.events', 'DELETE')");
  check('hv_runtime ohne UPDATE und DELETE am Ereignislog', rights === 'f|f');
  const owner = await sql(plan, "SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'auth_purge_login_states'");
  check('Eigentümer von auth_purge_login_states ist hv_owner', owner === 'hv_owner');

  // 8. Keycloak (S12.3; last, so the other checks still report when the IdP is the problem)
  const discovery = await fetchStatus(`http://127.0.0.1:${state.idpPort}/realms/${REALM_NAME}/.well-known/openid-configuration`);
  let issuer;
  try { issuer = JSON.parse(discovery.body).issuer; } catch { issuer = undefined; }
  check('Keycloak-Discovery 200, issuer wie konfiguriert', discovery.status === 200 && issuer === issuerOf(state));
}

// ---- probes (S14 to S16) --------------------------------------------------------------------------------------------

const IMAGES = { api: 'hv-tool/api:local', seed: 'hv-tool/seed:local', web: 'hv-tool/web:local' };

async function probeImages({ plan, say, check }) {
  for (const [name, image] of Object.entries(IMAGES)) {
    const info = (await mustDocker(['image', 'inspect', '--format', '{{.Config.User}} {{.Id}} {{.Size}}', image])).trim().split(' ');
    const expected = name === 'web' ? '101' : '65532:65532';
    say(`Image ${image}: User ${info[0]}, ID ${info[1].slice(7, 19)}, ${Math.round(Number(info[2]) / 1e6)} MB`);
    check(`Image ${name} läuft als ${expected}`, info[0] === expected);
  }
  for (const service of ['api', 'web']) {
    const top = await mustDocker(['top', await containerId(plan, service), '-eo', 'uid,pid,comm']);
    const uids = [...new Set(top.trim().split('\n').slice(1).map((line) => line.trim().split(/\s+/)[0]))];
    say(`Prozesse im Container ${service}: UID ${uids.join(', ')}`);
    check(`Container ${service} ohne UID 0`, !uids.includes('0'));
  }
  const inside = await mustDocker(['run', '--rm', '--network', 'none', '--entrypoint', '/nodejs/bin/node', IMAGES.api, '-e',
    "const fs = require('fs'); const s = (p) => { const x = fs.statSync(p); return [(x.mode & 0o777).toString(8), x.uid]; };"
    + " console.log(JSON.stringify({ scripts: fs.existsSync('/app/scripts'), hv: s('/var/lib/hv'), log: s('/var/lib/hv/access-log') }));"]);
  const facts = JSON.parse(inside.trim());
  check('Image api ohne /app/scripts', facts.scripts === false);
  check('/var/lib/hv 0755 root, access-log 0700 65532', facts.hv.join() === '755,0' && facts.log.join() === '700,65532');
}

async function probeRefusals({ check }) {
  const bare = await docker(['run', '--rm', '--network', 'none', IMAGES.api], { timeoutMs: 120_000 });
  check('api ohne Umgebung: Exit 1 mit dem Satz zu HV_ACCESS_LOG_DIR, ohne Wert', bare.code === 1
    && bare.stderr.split('\n').includes('HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR must name a writable directory.'));
  const temp = mkdtempSync(join(tmpdir(), 'hv-stack-probe-'));
  try {
    const synthetic = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
    const envFile = join(temp, 'api.env');
    writeFile(envFile, renderFiles(synthetic)['api.env'].replace(/^HV_OIDC_ISSUER=.*$/m,
      `HV_OIDC_ISSUER=http://keycloak:${DEFAULT_IDP_PORT}/realms/${REALM_NAME}`), 0o600);
    const remote = await docker(['run', '--rm', '--network', 'none', '--env-file', envFile, IMAGES.api], { timeoutMs: 120_000 });
    const lines = remote.stderr.trim().split('\n');
    check('api mit Issuer http://keycloak:…: Exit 1 mit dem Satz zu HV_OIDC_ISSUER', remote.code === 1
      && lines.some((line) => line.startsWith('HV-Tool API: refusing to start: HV_OIDC_ISSUER'))
      && lines.every((line) => line.startsWith('HV-Tool API: refusing to start:')));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  const subjects = PERSONS.map((person) => `${person.key}=00000000-0000-4000-8000-000000000000`).join(',');
  const seedRun = (issuer, url) => docker(['run', '--rm', '--network', 'none', '-e', `STACK_SEED_ISSUER=${issuer}`, '-e',
    `STACK_SEED_DATABASE_URL=${url}`, '-e', `STACK_SEED_SUBJECTS=${subjects}`, IMAGES.seed], { timeoutMs: 120_000 });
  const foreignIssuer = await seedRun('https://idp.example/realms/hv-local', 'postgres://hv_owner:synthetic@postgres:5432/hv');
  check('seed mit fremdem Issuer: Exit 1, fester Satz, ohne Datenbank (Netz none)', foreignIssuer.code === 1
    && foreignIssuer.stderr.trim() === SEED_REFUSALS.issuer);
  const foreignHost = await seedRun(`http://localhost:${DEFAULT_IDP_PORT}/realms/hv-local`, 'postgres://hv_owner:synthetic@db.example:5432/hv');
  check('seed mit fremdem Datenbank-Host: Exit 1, fester Satz', foreignHost.code === 1
    && foreignHost.stderr.trim() === SEED_REFUSALS.database);
}

/** Polls /readyz inside the container until db was seen not ok and then ok again; prints one JSON line (epoch ms). */
const POSTGRES_WATCH_SCRIPT = `
const start = Date.now(); let bad = null; let back = null;
const db = async () => { try { const r = await fetch('http://127.0.0.1:${SERVICE_PORT}/readyz', { signal: AbortSignal.timeout(3000) }); const b = await r.json(); return (b.checks && b.checks.db && (b.checks.db.code || b.checks.db.status)) || 'unknown'; } catch { return 'unreachable'; } };
(async () => { while (Date.now() - start < 75000) { const s = await db(); if (s !== 'ok' && bad === null) bad = { state: s, at: Date.now() };
  if (s === 'ok' && bad !== null) { back = Date.now(); break; } await new Promise((r) => setTimeout(r, 200)); }
  console.log(JSON.stringify({ bad, back })); })();`;

async function probePostgresRestart({ plan, say, check }) {
  const before = await restartCount(plan, 'api');
  const watch = inApi(plan, POSTGRES_WATCH_SCRIPT, { timeoutMs: 90_000 });
  await sleep(1_500);
  const restartAt = Date.now();
  await mustDocker([...plan.compose, 'restart', 'postgres'], { env: plan.env, timeoutMs: 90_000 });
  const { value } = await watch;
  // Container and host share the kernel clock, so the epoch times of the watcher compare with the host's.
  const seconds = typeof value?.back === 'number' ? Math.max(0, (value.back - restartAt) / 1000) : undefined;
  say(`Postgres-Neustart: db zeitweise ${value?.bad?.state ?? '–'}, wieder ok nach ${seconds?.toFixed(1) ?? '–'} s`
    + ` (restart-Befehl ${((Date.now() - restartAt) / 1000).toFixed(1)} s)`);
  check('Postgres-Neustart: /readyz db zeitweise nicht ok, innerhalb von 60 s wieder ok', value?.bad !== null && value?.bad !== undefined
    && seconds !== undefined && seconds <= 60);
  const after = await restartCount(plan, 'api');
  check(`RestartCount des Dienstes unverändert (${before})`, after === before);
  await waitForStack(plan, { timeoutMs: 120_000, services: ['postgres', 'api'] });
}

/** Finds exactly the Node process of the service (not itself, not PID 1) and kills it with SIGKILL. */
const KILL_SCRIPT = `
const fs = require('fs'); const hits = [];
for (const d of fs.readdirSync('/proc')) { if (!/^\\d+$/.test(d)) continue; const pid = Number(d); if (pid === process.pid || pid === 1) continue;
  let c = ''; try { c = fs.readFileSync('/proc/' + d + '/cmdline', 'utf8'); } catch { continue; }
  if (c.split('\\0').some((a) => a.endsWith('apps/api/src/server.ts'))) hits.push(pid); }
console.log(JSON.stringify({ hits: hits.length }));
if (hits.length === 1) process.kill(hits[0], 'SIGKILL');`;

async function probeApiCrash({ plan, say, check }) {
  const events = await eventCount(plan);
  const before = await restartCount(plan, 'api');
  const killed = await inApi(plan, KILL_SCRIPT, { timeoutMs: 30_000 });
  // The kill ends the container and with it the exec; a non-zero exit here is expected. Only what follows counts.
  if (killed.value !== undefined) check('genau ein Node-Prozess des Dienstes gefunden', killed.value.hits === 1);
  const deadline = Date.now() + 60_000;
  let after = before;
  while (Date.now() < deadline && after <= before) {
    await sleep(1_000);
    after = await restartCount(plan, 'api').catch(() => before);
  }
  check(`RestartCount gestiegen (${before} → ${after})`, after > before);
  const healthyFrom = Date.now();
  await waitService(plan, 'api', 60_000);
  say(`Dienst nach dem Absturz wieder gesund nach ${((Date.now() - healthyFrom) / 1000).toFixed(1)} s`);
  check(`Ereigniszahl unverändert (${events})`, await eventCount(plan) === events);
  const stopFrom = Date.now();
  await mustDocker([...plan.compose, 'stop', 'api'], { env: plan.env, timeoutMs: 30_000 });
  const stopMs = Date.now() - stopFrom;
  await mustDocker([...plan.compose, 'start', 'api'], { env: plan.env, timeoutMs: 60_000 });
  check(`docker compose stop api in unter 3 s (${(stopMs / 1000).toFixed(1)} s, SIGTERM kommt an)`, stopMs < 3_000);
  await waitService(plan, 'api', 60_000);
}

// ---- commands -------------------------------------------------------------------------------------------------------

let stage = 'Start';

async function cmdUp(args) {
  stage = 'Voraussetzungen';
  await prerequisites();
  stage = 'Zustand';
  const existed = readState() !== undefined;
  const { state, dir } = readOrCreateState();
  const say = startOutput({ secrets: secretsOf(state) });
  const plan = upPlan(args, state, dir);
  stage = 'Abgleich von Zustand und Volume';
  const volumeExists = (await docker(['volume', 'inspect', PG_VOLUME], { timeoutMs: 20_000 })).code === 0;
  const drift = checkDrift({ stateExists: existed, started: state.started === true, volumeExists });
  if (drift) throw new StackRefusal(drift);
  stage = 'Ports';
  const running = (await docker([...plan.compose, 'ps', '-q'], { env: plan.env, timeoutMs: 20_000 })).stdout.trim() !== '';
  if (!running) {
    await assertPortFree(state.webPort);
    await assertPortFree(state.idpPort);
  }
  stage = 'Dateien im Zustandsverzeichnis';
  const buildCa = process.env.HV_STACK_BUILD_CA ? readFileSync(process.env.HV_STACK_BUILD_CA, 'utf8') : '';
  writeStateFiles(dir, state, { ntpServers: process.env.HV_STACK_NTP_SERVERS || undefined, buildCa });
  say(`Zustandsverzeichnis: ${dir}`);
  stage = 'Images bauen';
  const startedAt = Date.now();
  await mustDocker(plan.build, { env: plan.env, inherit: true, timeoutMs: 1_800_000 });
  stage = 'Stack starten';
  await mustDocker(plan.up, { env: plan.env, timeoutMs: 1_200_000 });
  stage = 'Warten auf gesunde Dienste';
  await waitForStack(plan);
  say(`Alle Dienste gesund, migrate und seed mit 0 beendet (${Math.round((Date.now() - startedAt) / 1000)} s seit Baubeginn).`);
  if (!state.started) {
    state.started = true;
    saveState(dir, state);
  }
  stage = 'Rauchtest';
  await smoke({ state, dir, plan, say });
  const seedLog = (await docker([...plan.compose, 'logs', '--no-color', '--no-log-prefix', 'seed'], { env: plan.env })).stdout;
  // The last run of the one-off fill decides (a second `up` runs it again, it then writes nothing).
  const lastFill = seedLog.split('\n').filter(Boolean).at(-1) ?? '';
  const fill = lastFill === SEED_ALREADY_FILLED ? 'bereits befüllt'
    : lastFill === SEED_FILLED ? 'Demo-Korpus und neun Testpersonen neu geschrieben' : 'unbekannt';
  const realmHash = createHash('sha256').update(readFileSync(join(dir, 'realm.json'))).digest('hex').slice(0, 16);
  say(formatUpSummary(state, { realmHash, fill }));
}

function requireState() {
  const found = readState();
  if (!found) throw new StackRefusal('Keine Installation gefunden. Zuerst pnpm stack:up.');
  return found;
}

async function cmdSmoke() {
  stage = 'Zustand';
  const { state, dir } = requireState();
  const say = startOutput({ secrets: secretsOf(state) });
  stage = 'Rauchtest';
  await smoke({ state, dir, plan: upPlan(parseArgs(['up']), state, dir), say });
  say('Rauchtest bestanden.');
}

async function cmdCredentials() {
  stage = 'Zustand';
  const { state } = requireState();
  const say = startOutput({ secrets: secretsOf(state) });
  say(formatCredentials(state));
}

/** For down and reset without a state, an empty stand-in directory lets compose read the file (drift clean-up). */
function stackContext() {
  const found = readState();
  if (found) return { ...found, cleanup: () => {} };
  const dir = mkdtempSync(join(tmpdir(), 'hv-stack-empty-'));
  for (const name of [...ENV_FILES, 'realm.json', 'build-ca.pem']) writeFile(join(dir, name), '', 0o600);
  return { dir, state: { webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT }, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

async function cmdDown() {
  stage = 'Stoppen';
  const { state, dir, cleanup } = stackContext();
  try {
    const plan = upPlan(parseArgs(['up']), state, dir);
    await mustDocker([...plan.compose, 'down'], { env: plan.env, timeoutMs: 180_000 });
  } finally {
    cleanup();
  }
  console.log('HV-Stack gestoppt; die Daten bleiben erhalten. Wieder starten: pnpm stack:up');
}

async function cmdReset(args) {
  if (!args.yes) {
    throw new StackRefusal('stack:reset löscht alle lokalen Daten und Passwörter und braucht --yes: pnpm stack:reset --yes');
  }
  stage = 'Zurücksetzen';
  const { state, dir, cleanup } = stackContext();
  try {
    const plan = upPlan(parseArgs(['up']), state, dir);
    await mustDocker([...plan.compose, 'down', '--volumes', '--remove-orphans'], { env: plan.env, timeoutMs: 180_000 });
  } finally {
    cleanup();
  }
  rmSync(stateDirectory(), { recursive: true, force: true });
  console.log('HV-Stack zurückgesetzt: Container, Volumes und Zustandsverzeichnis gelöscht. Neu starten: pnpm stack:up');
}

async function cmdProbe(args) {
  if (!PROBES.includes(args.probe)) throw new StackRefusal(`probe nimmt: ${PROBES.join(', ')}.`);
  stage = 'Zustand';
  const { state, dir } = requireState();
  const say = startOutput({ secrets: secretsOf(state) });
  const plan = upPlan(parseArgs(['up']), state, dir);
  const check = (label, ok) => {
    say(formatSmokeLine(label, ok));
    if (!ok) throw new StackRefusal(`Probe fehlgeschlagen: ${label}`);
  };
  stage = `Probe ${args.probe}`;
  const run = { images: probeImages, refusals: probeRefusals, 'postgres-restart': probePostgresRestart, 'api-crash': probeApiCrash };
  await run[args.probe]({ state, dir, plan, say, check });
}

async function main(argv) {
  stage = 'Argumente';
  const args = parseArgs(argv);
  const commands = { up: cmdUp, smoke: cmdSmoke, credentials: cmdCredentials, down: cmdDown, reset: cmdReset, probe: cmdProbe };
  const command = commands[args.command];
  if (!command) throw new StackRefusal('Befehle: up, smoke, credentials, down, reset --yes, probe <name>.');
  if (args.recreate.length > 0 && args.command !== 'up') throw new StackRefusal('--recreate gehört zu up.');
  await command(args);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(formatFailure(stage, error));
    process.exitCode = 1;
  });
}
