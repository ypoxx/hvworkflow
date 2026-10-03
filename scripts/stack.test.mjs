/**
 * Slice 037a: tests of the local operations package without Docker (S1 to S10 of the spec). The images, the compose
 * file, the init script, `.dockerignore`, the state and the realm of `scripts/stack.mjs`, the refusals of
 * `scripts/stack-seed.mjs` and the output rules. The real stack (S11 to S16) runs with Docker: locally and in the CI
 * job `stack-037a`.
 *
 * The compose file and gates.yml are read with `yaml` from apps/api (createRequire, as in 031a). TypeScript is loaded
 * only in a child process with the tsx loader (S5), never directly.
 * Bedrohungsmodell: T-G2-E-02, T-Q-S-02, T-Q-I-01, T-Q-I-02, T-G2-T-04, T-Q-T-04.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  COMPOSE_FILE, DEFAULT_IDP_PORT, DEFAULT_WEB_PORT, ENV_FILES, PROJECT, REALM_NAME, START_LINE, assertPrivateDirectory,
  checkComposeVersion, checkDockerHost, checkDrift, checkEngineVersion, createState, formatCredentials, formatDiagnostics,
  formatFailure, needsLog, redact, REFUSAL_LINE, evaluatePostgresRestart, observePostgresRestart,
  formatSmokeLine, formatUpSummary, parseArgs, readOrCreateState, renderFiles, resolvePorts, secretsOf, startOutput,
  stateDirectory, upPlan, writeStateFiles,
} from './stack.mjs';
import { SEED_REFUSALS, checkDatabaseHost, checkIssuer } from './stack-seed.mjs';
import { FORBIDDEN_SERVICE_VARIABLES } from './e2e-http-031.mjs';
import { KEYCLOAK_IMAGE } from './lib/keycloak-ci.mjs';
import { PERSONS } from './lib/demo-persons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiRequire = createRequire(pathToFileURL(join(ROOT, 'apps/api/package.json')));
const YAML = apiRequire('yaml');
const LOADER = join(ROOT, 'apps/api/node_modules/tsx/dist/loader.mjs');
const STACK = join(ROOT, 'scripts/stack.mjs');

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const scratch = () => mkdtempSync(join(tmpdir(), 'stack-037a-test-'));
const API_DOCKERFILE = 'deploy/docker/api.Dockerfile';
const WEB_DOCKERFILE = 'deploy/docker/web.Dockerfile';
const INIT_SCRIPT = 'deploy/compose/postgres-init/10-roles.sh';
const MARKER = 'MARKER-SECRET-037a';

// ---- helpers: compose interpolation and Dockerfile stages -----------------------------------------------------------

/** `${VAR}`, `${VAR:-default}` and `${VAR:?message}` as compose resolves them; an unset `:?` variable throws. */
function interpolate(text, env) {
  return text.replace(/\$\{([A-Z0-9_]+)(?::([-?])([^}]*))?\}/g, (_, name, kind, rest) => {
    const value = env[name];
    if (value !== undefined && value !== '') return value;
    if (kind === '-') return rest;
    if (kind === '?') throw new Error(`compose variable ${name} is required`);
    return '';
  });
}
const STACK_ENV = { HV_STACK_STATE_DIR: '/state/hv-tool-stack', HV_STACK_WEB_PORT: '8480', HV_STACK_IDP_PORT: '8180' };
const composeText = () => read('deploy/compose/compose.yaml');
const loadCompose = (env = STACK_ENV, text = composeText()) => YAML.parse(interpolate(text, env));

/** Stages of a Dockerfile: name, base and instructions (continuation lines joined, comments dropped). */
function dockerStages(text) {
  const lines = text.replace(/\\\n/g, ' ').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const stages = [];
  for (const line of lines) {
    const from = line.match(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i);
    if (from) { stages.push({ base: from[1], name: from[2] ?? `stage${stages.length}`, lines: [] }); continue; }
    stages.at(-1)?.lines.push(line);
  }
  return stages;
}
/** The stage and every stage it builds on, by name. */
function lineage(stages, name) {
  const out = [];
  let current = stages.find((stage) => stage.name === name);
  while (current) {
    out.push(current);
    current = stages.find((stage) => stage.name === current.base);
  }
  return out;
}
const lastUser = (stages, name) => {
  for (const stage of lineage(stages, name)) {
    const users = stage.lines.filter((line) => /^USER\s/i.test(line));
    if (users.length > 0) return users.at(-1).split(/\s+/)[1];
  }
  return undefined;
};

const PINNED = /^[a-z0-9./-]+(?::[A-Za-z0-9._-]+)@sha256:[0-9a-f]{64}$/;
/** S1: every base and service image by `name:tag@sha256:<64 hex>`; returns the offending references. */
function unpinned(references) {
  return references.filter((ref) => !PINNED.test(ref));
}
function imageReferences(dockerfiles, compose) {
  const stageNames = new Set();
  const refs = [];
  for (const text of dockerfiles) {
    for (const stage of dockerStages(text)) {
      if (!stageNames.has(stage.base)) refs.push(stage.base);
      stageNames.add(stage.name);
    }
  }
  // A service without `build` either pulls a pinned image or reuses an image another service of this file builds.
  const built = new Set(Object.values(compose.services).filter((service) => service.build !== undefined).map((service) => service.image));
  for (const service of Object.values(compose.services)) {
    if (service.build === undefined && !built.has(service.image)) refs.push(service.image);
  }
  return refs;
}

/** S3: findings in a compose document, Dockerfiles and the init script. */
const SECRET_NAME = /PASSWORD|SECRET|KEY|TOKEN/;
function secretFindings({ compose, dockerfiles, initScript, stateDir = STACK_ENV.HV_STACK_STATE_DIR }) {
  const findings = [];
  for (const [name, service] of Object.entries(compose.services)) {
    const environment = Array.isArray(service.environment)
      ? Object.fromEntries(service.environment.map((entry) => entry.split('=')))
      : service.environment ?? {};
    for (const [key, value] of Object.entries(environment)) {
      if (SECRET_NAME.test(key) && value !== undefined && value !== null && value !== '') findings.push(`${name}: ${key} literal`);
      if (key === 'POSTGRES_DB' && String(value) === 'hv') findings.push(`${name}: POSTGRES_DB=hv`);
    }
    for (const file of [service.env_file ?? []].flat()) {
      const path = typeof file === 'string' ? file : file.path;
      if (!path.startsWith(`${stateDir}/`)) findings.push(`${name}: env_file outside the state directory`);
    }
  }
  for (const text of dockerfiles) {
    for (const stage of dockerStages(text)) {
      for (const line of stage.lines) {
        const declared = line.match(/^(ARG|ENV)\s+(.*)$/i);
        if (declared && SECRET_NAME.test(declared[2])) findings.push(`Dockerfile: ${declared[1]} with a secret name`);
      }
    }
  }
  if (/PASSWORD\s+'[^']*'/i.test(initScript)) findings.push('init script: password literal');
  if (/\bpsql\b[^\n]*\s(-c|--command)\b/.test(initScript)) findings.push('init script: psql -c');
  return findings;
}

/** S2: published ports. */
function portFindings(compose) {
  const findings = [];
  for (const [name, service] of Object.entries(compose.services)) {
    for (const port of service.ports ?? []) {
      const text = typeof port === 'string' ? port : `${port.host_ip ?? ''}:${port.published}:${port.target}`;
      if (!text.startsWith('127.0.0.1:')) findings.push(`${name}: ${text} not on loopback`);
      if (['postgres', 'api', 'migrate', 'seed'].includes(name)) findings.push(`${name}: publishes a port`);
    }
  }
  return findings;
}

/** S4: the api target and its ancestors copy nothing from scripts/. */
function apiCopiesScripts(text) {
  return lineage(dockerStages(text), 'api').some((stage) =>
    stage.lines.some((line) => /^(COPY|ADD)\s/i.test(line) && !/--from=/i.test(line) && /(^|\s)\.?\/?scripts\b/.test(line)));
}

// ---- S1 pinning -------------------------------------------------------------------------------------------------------

test('S1 every base image and every service image is pinned by tag and index digest', () => {
  const refs = imageReferences([read(API_DOCKERFILE), read(WEB_DOCKERFILE)], loadCompose());
  assert(refs.length >= 5, 'node, distroless, nginx, postgres and keycloak are all checked');
  assert.deepEqual(unpinned(refs), []);
  assert.deepEqual(unpinned(['postgres:16']), ['postgres:16'], 'a tag without digest fails');
  assert.deepEqual(unpinned(['postgres@sha256:' + 'a'.repeat(64)]), ['postgres@sha256:' + 'a'.repeat(64)], 'a digest without tag fails');
});

test('S1 Postgres equals the CI service in gates.yml, Keycloak equals KEYCLOAK_IMAGE, pnpm carries its sha512', () => {
  const compose = loadCompose();
  const gates = YAML.parse(read('.github/workflows/gates.yml'));
  assert.equal(compose.services.postgres.image, gates.jobs.gates.services.postgres.image);
  assert.equal(compose.services.keycloak.image, KEYCLOAK_IMAGE);
  const manifest = JSON.parse(read('package.json'));
  assert.match(manifest.packageManager, /^pnpm@10\.33\.0\+sha512\.[0-9a-f]{128}$/);
});

// ---- S2 ports -------------------------------------------------------------------------------------------------------

test('S2 every published port binds 127.0.0.1; postgres, api, migrate and seed publish none', () => {
  const compose = loadCompose();
  assert.deepEqual(portFindings(compose), []);
  assert.deepEqual(compose.services.web.ports, ['127.0.0.1:8480:8080']);
  for (const name of ['postgres', 'api', 'migrate', 'seed']) assert.equal(compose.services[name].ports, undefined);
  const injected = loadCompose(STACK_ENV, composeText().replace('"127.0.0.1:${HV_STACK_WEB_PORT:?set by scripts/stack.mjs}:8080"', '"8480:8080"'));
  assert.deepEqual(portFindings(injected), ['web: 8480:8080 not on loopback']);
});

test('S2 Keycloak listens inside on the same port as on the host, also with an overridden port', () => {
  for (const port of ['8180', '18555']) {
    const compose = loadCompose({ ...STACK_ENV, HV_STACK_IDP_PORT: port });
    assert.deepEqual(compose.services.keycloak.ports, [`127.0.0.1:${port}:${port}`]);
    assert.equal(String(compose.services.keycloak.environment.KC_HTTP_PORT), port);
    assert.equal(compose.services.keycloak.environment.KC_HOSTNAME, `http://localhost:${port}`);
  }
  assert.throws(() => loadCompose({ HV_STACK_STATE_DIR: '/s', HV_STACK_WEB_PORT: '8480' }), /HV_STACK_IDP_PORT is required/,
    'without the script the compose file has no default port to fall back on');
});

test('S2 --recreate keeps the stored ports, also an override from the first start', () => {
  const state = createState({ webPort: 18480, idpPort: 18555 });
  const plan = upPlan(parseArgs(['up', '--', '--recreate', 'api', 'web']), state, '/state/dir');
  assert.equal(plan.env.HV_STACK_WEB_PORT, '18480');
  assert.equal(plan.env.HV_STACK_IDP_PORT, '18555');
  assert.equal(plan.env.HV_STACK_STATE_DIR, '/state/dir');
  assert.deepEqual(plan.up.slice(-3), ['--force-recreate', 'api', 'web']);
  assert(plan.compose.includes('-f') && plan.compose.includes(COMPOSE_FILE) && plan.compose.includes(PROJECT));
  assert.throws(() => parseArgs(['up', '--recreate', 'nothing']), /recreate/);
  const normal = upPlan(parseArgs(['up']), state, '/state/dir');
  assert(!normal.up.includes('--force-recreate'));
});

// ---- S3 secrets -----------------------------------------------------------------------------------------------------

test('S3 no secret in a versioned file; every env_file points into the state directory', () => {
  const input = { compose: loadCompose(), dockerfiles: [read(API_DOCKERFILE), read(WEB_DOCKERFILE)], initScript: read(INIT_SCRIPT) };
  assert.deepEqual(secretFindings(input), []);
  const services = loadCompose().services;
  for (const name of ['postgres', 'keycloak', 'migrate', 'seed', 'api']) {
    assert.deepEqual(services[name].env_file, [`${STACK_ENV.HV_STACK_STATE_DIR}/${name}.env`], `${name} gets only its own file`);
  }
  assert.equal(services.web.env_file, undefined);
  assert.equal(services.postgres.environment.POSTGRES_DB, undefined, 'POSTGRES_DB stays unset');
  assert.equal(services.migrate.image, services.api.image, 'migrate reuses the api image built by the api service');
});

test('S3 negative: an injected password literal, POSTGRES_DB=hv or psql -c fails', () => {
  const base = { dockerfiles: [read(API_DOCKERFILE)], initScript: read(INIT_SCRIPT) };
  const withPassword = composeText().replace('      POSTGRES_USER: postgres\n', '      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD: x\n');
  assert.deepEqual(secretFindings({ ...base, compose: loadCompose(STACK_ENV, withPassword) }), ['postgres: POSTGRES_PASSWORD literal']);
  const withDb = composeText().replace('      POSTGRES_USER: postgres\n', '      POSTGRES_USER: postgres\n      POSTGRES_DB: hv\n');
  assert.deepEqual(secretFindings({ ...base, compose: loadCompose(STACK_ENV, withDb) }), ['postgres: POSTGRES_DB=hv']);
  assert.deepEqual(secretFindings({ ...base, compose: loadCompose(), initScript: 'psql -c "select 1"' }), ['init script: psql -c']);
  assert.deepEqual(secretFindings({ ...base, compose: loadCompose(), initScript: "CREATE ROLE x PASSWORD 'abc';" }),
    ['init script: password literal']);
  assert.deepEqual(secretFindings({ ...base, compose: loadCompose(), dockerfiles: ['FROM a:b@sha256:x\nARG DB_PASSWORD'] }),
    ['Dockerfile: ARG with a secret name']);
});

test('S3 the generated postgres.env sets no POSTGRES_DB; the superuser password stands only there', () => {
  const state = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  const files = renderFiles(state);
  assert(!/^POSTGRES_DB=/m.test(files['postgres.env']));
  const superPassword = state.postgres.superPassword;
  for (const [name, content] of Object.entries(files)) {
    if (name !== 'postgres.env') assert(!content.includes(superPassword), `${name} must not hold the superuser password`);
  }
  assert(!files['api.env'].includes(state.postgres.ownerPassword), 'the service never sees the owner password');
  assert(files['migrate.env'].includes(state.postgres.ownerPassword) && files['seed.env'].includes(state.postgres.ownerPassword));
});

// ---- S4 hardening and processes -------------------------------------------------------------------------------------

test('S4 users, read-only, capabilities, init, restart policies and healthchecks', () => {
  const api = dockerStages(read(API_DOCKERFILE));
  assert.equal(lastUser(api, 'api'), '65532:65532');
  assert.equal(lastUser(api, 'seed'), '65532:65532');
  assert.equal(api.at(-1).name, 'api', 'api is the last target and therefore the default');
  assert.equal(lastUser(dockerStages(read(WEB_DOCKERFILE)), 'web'), '101');
  const { services } = loadCompose();
  for (const name of ['api', 'web', 'seed']) {
    assert.equal(services[name].read_only, true, `${name} read_only`);
    assert.deepEqual(services[name].cap_drop, ['ALL'], `${name} cap_drop`);
    assert(services[name].security_opt.includes('no-new-privileges:true'), `${name} no-new-privileges`);
    assert(services[name].tmpfs.includes('/tmp'), `${name} tmpfs /tmp`);
  }
  assert(services.web.tmpfs.includes('/var/cache/nginx'));
  for (const name of ['postgres', 'keycloak']) assert(services[name].security_opt.includes('no-new-privileges:true'));
  for (const name of ['api', 'migrate', 'seed']) assert.equal(services[name].init, true, `${name} init`);
  for (const name of ['migrate', 'seed']) {
    assert.deepEqual(services[name].healthcheck, { disable: true });
    assert.equal(services[name].restart, 'no');
  }
  for (const name of ['postgres', 'keycloak', 'api', 'web']) assert.equal(services[name].restart, 'unless-stopped');
  assert.equal(services.api.network_mode, 'service:keycloak');
});

test('S4 no fixed address, no ipam and no proxy trust for the service (decision 10)', () => {
  const compose = loadCompose();
  assert.equal(compose.services.api.networks, undefined);
  assert.equal(compose.networks, undefined);
  assert(!/ipam|ipv4_address|HV_TRUSTED_PROXY_CIDRS/.test(composeText()));
  const files = renderFiles(createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT }));
  assert(!/HV_TRUSTED_PROXY_CIDRS/.test(files['api.env']));
});

test('S4 /var/lib/hv root 0755, access-log 65532 0700; the api target copies nothing from scripts/', () => {
  const text = read(API_DOCKERFILE);
  assert.match(text, /chown 0:0 \/out\/hv && chmod 0755 \/out\/hv\b/);
  assert.match(text, /chown 65532:65532 \/out\/hv\/access-log && chmod 0700 \/out\/hv\/access-log/);
  assert.match(text, /^COPY --from=build \/out\/hv \/var\/lib\/hv$/m);
  assert.equal(apiCopiesScripts(text), false);
  assert(lineage(dockerStages(text), 'seed').some((stage) => stage.lines.some((line) => line.includes('scripts/stack-seed.mjs'))));
  const injected = text.replace('FROM runtime AS api\n', 'FROM runtime AS api\nCOPY scripts /app/scripts\n');
  assert.equal(apiCopiesScripts(injected), true, 'an injected COPY scripts in the api target fails');
  const injectedBase = text.replace('ENV TMPDIR=/tmp\n', 'ENV TMPDIR=/tmp\nCOPY scripts/lib /app/scripts/lib\n');
  assert.equal(apiCopiesScripts(injectedBase), true, 'also in a stage the api target builds on');
});

test('Nachtrag: the mode of the access-log volume depends neither on the BuildKit version nor on the mount order', () => {
  // COPY --chmod on a directory leaves the destination at 0755 on BuildKit v0.17/v0.20 (CI); the entry is prepared in the
  // build stage and copied with its parent instead, without --chown/--chmod (owner and mode come from the source).
  const text = read(API_DOCKERFILE);
  for (const stage of dockerStages(text)) {
    for (const line of stage.lines.filter((entry) => /^COPY\s/i.test(entry))) {
      assert(!/--chmod/.test(line), `no --chmod on COPY: ${line}`);
      if (/\/var\/lib\/hv/.test(line)) assert(!/--chown/.test(line), `no --chown on the /var/lib/hv copy: ${line}`);
    }
  }
  // Only the service mounts the volume, so no other image can be the first to fill it.
  const mounts = Object.entries(loadCompose().services)
    .filter(([, service]) => (service.volumes ?? []).some((volume) => String(volume).startsWith('hv-access-log:')))
    .map(([name]) => name);
  assert.deepEqual(mounts, ['api']);
});

test('Nachtrag: nginx answers only localhost and 127.0.0.1; any other Host gets 421 from the default server', () => {
  const conf = read('deploy/docker/nginx.conf');
  const servers = conf.split(/\n    server \{/).slice(1);
  assert.equal(servers.length, 2);
  assert.match(servers[0], /listen 8080 default_server;/);
  assert.match(servers[0], /return 421;/);
  assert.match(servers[0], /add_header X-Frame-Options "DENY" always;/);
  assert.match(servers[1], /server_name localhost 127\.0\.0\.1;/);
  assert.doesNotMatch(servers[1], /default_server/);
});

test('Nachtrag: api, seed and web are never pulled (pull_policy build); migrate reuses the built api image', () => {
  const { services } = loadCompose();
  for (const name of ['api', 'seed', 'web']) assert.equal(services[name].pull_policy, 'build', name);
  assert.equal(services.migrate.pull_policy, 'never');
  assert.equal(services.migrate.build, undefined);
});

// ---- S5 service environment against the real schema -----------------------------------------------------------------

function parseEnvFile(text) {
  return Object.fromEntries(text.split('\n').filter(Boolean).map((line) => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1)];
  }));
}

function checkWithSchema(env) {
  const temp = scratch();
  try {
    const logDir = join(temp, 'access-log');
    mkdirSync(logDir, { mode: 0o700 });
    chmodSync(logDir, 0o700);
    const script = `
      const { readServiceConfig } = await import(${JSON.stringify(pathToFileURL(join(ROOT, 'apps/api/src/config/schema.ts')).href)});
      const { formatStartLine, formatUnknownVariables } = await import(${JSON.stringify(pathToFileURL(join(ROOT, 'apps/api/src/config/startLine.ts')).href)});
      const config = readServiceConfig(process.env);
      console.log(JSON.stringify({ start: formatStartLine(config), unknown: formatUnknownVariables(config.unknownVariables) ?? null }));`;
    const run = spawnSync(process.execPath, ['--import', LOADER, '--input-type=module', '-e', script], {
      encoding: 'utf8', env: { ...env, HV_ACCESS_LOG_DIR: logDir, PATH: process.env.PATH ?? '' }, timeout: 60_000,
    });
    assert.equal(run.status, 0, 'the schema accepts the generated service environment');
    return JSON.parse(run.stdout.trim().split('\n').at(-1));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test('S5 api.env passes the real configuration schema with exactly the expected start line', () => {
  const state = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  state.api.authKey = state.api.authKey.replace(/^.{18}/, 'MARKERxSECRETx037a');
  const env = parseEnvFile(renderFiles(state)['api.env']);
  const result = checkWithSchema(env);
  assert.equal(result.unknown, null, 'no unknown variable');
  assert.equal(result.start, START_LINE);
  assert.equal(START_LINE, 'HV-Tool API: start mode=service persistence=postgres auth=oidc cors=none trusted-proxies=none');
  for (const name of Object.keys(env)) assert(!FORBIDDEN_SERVICE_VARIABLES.includes(name), `${name} is forbidden`);
  assert.equal(env.HV_DEMO, undefined);
  assert(!/hv_owner|postgres@/.test(renderFiles(state)['api.env']), 'no owner or superuser URL');
  assert.equal(env.HV_ACCESS_LOG_DIR, '/var/lib/hv/access-log');
  assert.equal(env.HV_OIDC_ISSUER, `http://localhost:${DEFAULT_IDP_PORT}/realms/${REALM_NAME}`);
});

test('S5 HV_NTP_SERVERS appears only with HV_STACK_NTP_SERVERS and still passes the schema', () => {
  const state = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  assert(!/HV_NTP_SERVERS/.test(renderFiles(state)['api.env']));
  const env = parseEnvFile(renderFiles(state, { ntpServers: 'ptbtime1.ptb.de,ptbtime2.ptb.de' })['api.env']);
  assert.equal(env.HV_NTP_SERVERS, 'ptbtime1.ptb.de,ptbtime2.ptb.de');
  assert.equal(checkWithSchema(env).unknown, null);
});

// ---- S6 state and a stable realm ------------------------------------------------------------------------------------

test('S6 the state directory follows XDG_STATE_HOME, else ~/.local/state', () => {
  assert.equal(stateDirectory({ XDG_STATE_HOME: '/x/state', HOME: '/home/a' }), '/x/state/hv-tool-stack');
  assert.equal(stateDirectory({ HOME: '/home/a' }), '/home/a/.local/state/hv-tool-stack');
});

test('S6 two new states differ in every secret; nine distinct passwords, none equal to the client secret', () => {
  const first = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  const second = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  const a = secretsOf(first);
  const b = secretsOf(second);
  assert(a.length >= 9 + 7);
  for (const secret of a) assert(!b.includes(secret), 'every secret is new');
  const passwords = PERSONS.map((person) => first.persons[person.key].password);
  assert.equal(new Set(passwords).size, 9);
  assert(!passwords.includes(first.identity.clientSecret));
  assert.notEqual(first.keycloak.adminPassword, first.postgres.superPassword);
});

test('S6 rights 0700/0600 (realm.json 0644), outside the repository; the same state writes byte-identical files', () => {
  const home = scratch();
  try {
    const env = { XDG_STATE_HOME: home, HOME: home };
    const { state, created, dir } = readOrCreateState(env);
    assert.equal(created, true);
    writeStateFiles(dir, state);
    assert.equal(statSync(dir).mode & 0o777, 0o700);
    for (const name of ['state.json', ...ENV_FILES, 'build-ca.pem']) assert.equal(statSync(join(dir, name)).mode & 0o777, 0o600, name);
    assert.equal(statSync(join(dir, 'realm.json')).mode & 0o777, 0o644);
    const before = Object.fromEntries(['realm.json', ...ENV_FILES].map((name) => [name, readFileSync(join(dir, name))]));
    const again = readOrCreateState(env);
    assert.equal(again.created, false);
    writeStateFiles(again.dir, again.state);
    for (const [name, bytes] of Object.entries(before)) assert(bytes.equals(readFileSync(join(dir, name))), `${name} byte-identical`);
    assert.deepEqual(again.state, state, 'nothing is regenerated');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('S6 a changed port is refused with a pointer to stack:reset; a port outside 1024..65535 is refused', () => {
  const state = createState({ webPort: 8480, idpPort: 8180 });
  assert.deepEqual(resolvePorts({}, state), { webPort: 8480, idpPort: 8180 });
  assert.deepEqual(resolvePorts({ HV_STACK_WEB_PORT: '8480' }, state), { webPort: 8480, idpPort: 8180 });
  assert.throws(() => resolvePorts({ HV_STACK_WEB_PORT: '9000' }, state), /stack:reset/);
  assert.throws(() => resolvePorts({ HV_STACK_IDP_PORT: '9000' }, state), /stack:reset/);
  assert.deepEqual(resolvePorts({ HV_STACK_WEB_PORT: '9000', HV_STACK_IDP_PORT: '9001' }, undefined), { webPort: 9000, idpPort: 9001 });
  assert.deepEqual(resolvePorts({}, undefined), { webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  assert.throws(() => resolvePorts({ HV_STACK_WEB_PORT: '80' }, undefined), /1024/);
  assert.throws(() => resolvePorts({ HV_STACK_IDP_PORT: 'x' }, undefined), /1024/);
  assert.throws(() => resolvePorts({ HV_STACK_WEB_PORT: '9000', HV_STACK_IDP_PORT: '9000' }, undefined), /verschieden/);
});

test('S6 negative: a state directory with 0755 is refused, the sentence names path and rule', () => {
  const home = scratch();
  try {
    const dir = join(home, 'hv-tool-stack');
    mkdirSync(dir, { mode: 0o755 });
    chmodSync(dir, 0o755);
    assert.throws(() => assertPrivateDirectory(dir), (error) => error.message.includes(dir) && /0700/.test(error.message));
    assert.throws(() => readOrCreateState({ XDG_STATE_HOME: home, HOME: home }), /0700/);
    const inside = join(ROOT, 'node_modules', '.stack-037a-test');
    mkdirSync(inside, { recursive: true, mode: 0o700 });
    try {
      chmodSync(inside, 0o700);
      assert.throws(() => assertPrivateDirectory(inside), /outside the repository/);
    } finally {
      rmSync(inside, { recursive: true, force: true });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('S6 drift: a volume without state and a state without volume (after a first start) are refused', () => {
  assert.equal(checkDrift({ stateExists: false, started: false, volumeExists: false }), undefined);
  assert.equal(checkDrift({ stateExists: true, started: false, volumeExists: false }), undefined, 'first start not done yet');
  assert.equal(checkDrift({ stateExists: true, started: true, volumeExists: true }), undefined);
  assert.match(checkDrift({ stateExists: false, started: false, volumeExists: true }), /stack:reset/);
  assert.match(checkDrift({ stateExists: true, started: true, volumeExists: false }), /stack:reset/);
});

// ---- S7 realm -------------------------------------------------------------------------------------------------------

test('S7 one confidential client with exactly the callback of the web port; nine readable persons on @example.test', () => {
  for (const webPort of [8480, 18480]) {
    const state = createState({ webPort, idpPort: 8180 });
    const realm = JSON.parse(renderFiles(state)['realm.json']);
    assert.equal(realm.realm, REALM_NAME);
    assert.equal(realm.clients.length, 1);
    const [client] = realm.clients;
    assert.equal(client.publicClient, false);
    assert.deepEqual(client.redirectUris, [`http://localhost:${webPort}/auth/callback`]);
    assert.equal(client.directAccessGrantsEnabled, false);
    assert.equal(realm.registrationAllowed, false);
    assert.equal(realm.users.length, 9);
    assert.deepEqual(realm.users.map((user) => user.username).sort(), PERSONS.map((person) => person.key).sort());
    for (const user of realm.users) {
      assert.equal(user.email, `${user.username}@example.test`);
      assert.match(user.id, /^[0-9a-f-]{36}$/);
      assert.equal(user.id, state.persons[user.username].id);
    }
  }
});

test('S7 keycloak-ci.mjs is unchanged and the 031a harness check stays green', () => {
  const working = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', 'scripts/lib/keycloak-ci.mjs'], { cwd: ROOT });
  assert.equal(working.status, 0, 'no uncommitted change to keycloak-ci.mjs');
  // On the 037a branch the comparison against the integration branch also covers committed changes. Later branches may
  // change the file in their own slice, so the check is limited to this slice's branch.
  const branch = process.env.GITHUB_HEAD_REF
    || spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  if (branch.startsWith('claude/slice-037a-')) {
    const base = spawnSync('git', ['merge-base', 'origin/claude/dax-shareholder-meeting-workflow-0s934z', 'HEAD'],
      { cwd: ROOT, encoding: 'utf8' });
    if (base.status === 0) {
      const committed = spawnSync('git', ['diff', '--quiet', base.stdout.trim(), 'HEAD', '--', 'scripts/lib/keycloak-ci.mjs'], { cwd: ROOT });
      assert.equal(committed.status, 0, 'no committed change to keycloak-ci.mjs on this branch');
    }
  }
  const check = spawnSync(process.execPath, ['--import', LOADER, join(ROOT, 'scripts/e2e-http-031.mjs'), '--check'],
    { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH ?? '' }, timeout: 60_000 });
  assert.equal(check.status, 0, '031a --check stays green');
});

// ---- S8 local limits as pure functions ------------------------------------------------------------------------------

test('S8 the daemon check refuses tcp:// and ssh:// and accepts unix://, npipe:// and unset', () => {
  for (const host of ['tcp://10.0.0.1:2376', 'ssh://user@host']) {
    assert.match(checkDockerHost({ dockerHost: host }), /entfernt/);
    assert.match(checkDockerHost({ contextHost: host }), /entfernt/);
  }
  for (const host of ['unix:///var/run/docker.sock', 'npipe:////./pipe/docker_engine', undefined, '']) {
    assert.equal(checkDockerHost({ dockerHost: host, contextHost: host }), undefined);
  }
});

test('S8 the version check refuses Engine 27.x and accepts 28.0; Compose needs v2 from the minimum', () => {
  assert.match(checkEngineVersion('27.5.1'), /28/);
  assert.equal(checkEngineVersion('28.0.0'), undefined);
  assert.equal(checkEngineVersion('29.3.1'), undefined);
  assert.match(checkEngineVersion('unknown'), /28/);
  assert.match(checkComposeVersion('1.29.2'), /Compose/);
  assert.match(checkComposeVersion('2.19.0'), /Compose/);
  assert.equal(checkComposeVersion('2.20.0'), undefined);
  assert.equal(checkComposeVersion('v2.39.1'), undefined);
  assert.equal(checkComposeVersion('5.1.1'), undefined);
});

test('S8 stack-seed refuses an issuer that is not loopback', () => {
  for (const issuer of ['https://idp.example/realms/hv-local', 'http://keycloak:8180/realms/hv-local', 'http://10.0.0.1/realms/x',
    'http://localhost/realms/x', 'not a url', undefined]) {
    assert.equal(checkIssuer(issuer), SEED_REFUSALS.issuer, String(issuer));
  }
  assert.equal(checkIssuer('http://localhost:8180/realms/hv-local'), undefined);
  assert.equal(checkIssuer('http://127.0.0.1:8180/realms/hv-local'), undefined);
});

test('S8 stack-seed accepts only the compose host postgres; the sentence names the rule, not the URL', () => {
  assert.equal(checkDatabaseHost('postgres://hv_owner:x@postgres:5432/hv'), undefined);
  for (const url of ['postgres://hv_owner:x@localhost:5432/hv', 'postgres://hv_owner:x@db.example:5432/hv',
    'postgres://hv_owner:x@10.0.0.5/hv', 'postgres:///hv', 'nonsense', undefined]) {
    const refusal = checkDatabaseHost(url);
    assert.equal(refusal, SEED_REFUSALS.database, String(url));
    if (url) assert(!refusal.includes(url) && !refusal.includes('x@'));
  }
});

test('S8 reset without --yes has no effect; --yes and -- --yes are both accepted', () => {
  assert.equal(parseArgs(['reset']).yes, false);
  assert.equal(parseArgs(['reset', '--yes']).yes, true);
  assert.equal(parseArgs(['reset', '--', '--yes']).yes, true);
  const home = scratch();
  try {
    const env = { XDG_STATE_HOME: home, HOME: home };
    const { state, dir } = readOrCreateState(env);
    writeStateFiles(dir, state);
    const run = spawnSync(process.execPath, [STACK, 'reset'], { encoding: 'utf8', env: { ...env, PATH: process.env.PATH ?? '' } });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /--yes/);
    assert(existsSync(join(dir, 'state.json')), 'the state is still there');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ---- S9 .dockerignore -----------------------------------------------------------------------------------------------

test('S9 .dockerignore keeps git, dependencies, env files, evidence, reports and builds out of the context', () => {
  const lines = read('.dockerignore').split('\n').map((line) => line.trim());
  for (const entry of ['.git', '**/node_modules', '.env', '.env.*', '**/.env', '**/.env.*', 'docs/evidence', '**/playwright-report',
    '**/test-results', '**/dist']) {
    assert(lines.includes(entry), entry);
  }
  assert.equal(lines.at(lines.indexOf('**/.env.*') + 1), '!**/.env.example', 'only the example file is let back in');
  assert.equal(read('.gitattributes').trim(), '*.sh text eol=lf');
});

// ---- S10 output without values --------------------------------------------------------------------------------------

function markedState() {
  const state = createState({ webPort: DEFAULT_WEB_PORT, idpPort: DEFAULT_IDP_PORT });
  state.identity.clientSecret = `${MARKER}-client`;
  state.keycloak.adminPassword = `${MARKER}-admin`;
  state.postgres.ownerPassword = `${MARKER}-owner`;
  for (const person of PERSONS) state.persons[person.key].password = `${MARKER}-${person.key}`;
  return state;
}

test('S10 the formatters of up, smoke and failures never carry a secret; only credentials does', () => {
  const state = markedState();
  const outputs = [
    formatUpSummary(state, { realmHash: 'abc', fill: 'neu befüllt' }),
    formatSmokeLine('Header auf GET /', true),
    formatSmokeLine('Header auf GET /', false),
    formatFailure('Rauchtest', new Error(`connection to postgres://hv_owner:${MARKER}-owner@postgres failed`)),
  ].join('\n');
  assert(!outputs.includes(MARKER), 'no marker in up, smoke or failure output');
  assert.match(formatUpSummary(state, { realmHash: 'abc', fill: 'neu befüllt' }), /http:\/\/localhost:8480/);
  assert.match(formatUpSummary(state, { realmHash: 'abc', fill: 'neu befüllt' }), /stack:credentials/);
  const credentials = formatCredentials(state);
  for (const person of PERSONS) assert(credentials.includes(`${MARKER}-${person.key}`));
  assert(credentials.includes(`${MARKER}-admin`));
  assert(!credentials.includes(`${MARKER}-owner`), 'database passwords are not part of the sign-in data');
});

test('S10 with GITHUB_ACTIONS=true the ::add-mask:: lines come before any other output', () => {
  const state = markedState();
  const lines = [];
  const say = startOutput({ env: { GITHUB_ACTIONS: 'true' }, secrets: secretsOf(state), write: (line) => lines.push(line) });
  say(formatSmokeLine('Header auf GET /', true));
  const masks = lines.filter((line) => line.startsWith('::add-mask::'));
  assert.equal(masks.length, secretsOf(state).length);
  assert(lines.slice(0, masks.length).every((line) => line.startsWith('::add-mask::')));
  assert(!lines.slice(masks.length).join('\n').includes(MARKER));
  const quiet = [];
  startOutput({ env: {}, secrets: secretsOf(state), write: (line) => quiet.push(line) })('x');
  assert.deepEqual(quiet, ['x'], 'no mask lines outside GitHub Actions');
});

test('S10 the credentials command masks first in CI and is the only command that prints values', () => {
  const home = scratch();
  try {
    const env = { XDG_STATE_HOME: home, HOME: home };
    const { state, dir } = readOrCreateState(env);
    writeStateFiles(dir, state);
    const run = spawnSync(process.execPath, [STACK, 'credentials'], { encoding: 'utf8',
      env: { ...env, PATH: process.env.PATH ?? '', GITHUB_ACTIONS: 'true' } });
    assert.equal(run.status, 0);
    const lines = run.stdout.split('\n').filter(Boolean);
    const masks = lines.findIndex((line) => !line.startsWith('::add-mask::'));
    assert.equal(masks, secretsOf(state).length);
    assert(lines.slice(masks).join('\n').includes(state.persons.moderation.password));
    assert.equal(run.stderr, '');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('S10 the package scripts are exactly the six stack commands, all through node', () => {
  const { scripts } = JSON.parse(read('package.json'));
  const stack = Object.keys(scripts).filter((name) => name.startsWith('stack:')).sort();
  assert.deepEqual(stack, ['stack:credentials', 'stack:down', 'stack:login', 'stack:reset', 'stack:smoke', 'stack:up']);
  for (const name of stack) assert.match(scripts[name], /^node scripts\/stack(-login)?\.mjs\b/);
  assert(!execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').some((path) => /(^|\/)state\.json$/.test(path)));
});

// ---- Nachtrag nach CI: diagnostics on a failed start -----------------------------------------------------------------

test('Nachtrag: the diagnostics dump shows ps rows and the logs of failed services, with every state secret redacted', () => {
  const state = markedState();
  const secrets = secretsOf(state);
  const rows = [
    { service: 'postgres', state: 'running', health: 'healthy', exitCode: 0 },
    { service: 'keycloak', state: 'running', health: 'unhealthy', exitCode: 0 },
    { service: 'migrate', state: 'exited', health: '', exitCode: 0 },
    { service: 'seed', state: 'exited', health: '', exitCode: 1 },
  ];
  assert.deepEqual(rows.filter(needsLog).map((row) => row.service), ['keycloak', 'seed']);
  const logs = {
    keycloak: `line one\nadmin password ${MARKER}-admin\nclient secret ${encodeURIComponent(`${MARKER}-client`)}\n`,
    seed: `postgres://hv_owner:${MARKER}-owner@postgres:5432/hv refused\n`,
  };
  const dump = formatDiagnostics({ rows, logs, composeError: `dependency failed to start: ${MARKER}-moderation`, secrets });
  assert(!dump.includes(MARKER), 'no secret of the state appears');
  assert.match(dump, /keycloak: running unhealthy exit=0/);
  assert.match(dump, /seed: exited exit=1/);
  assert.match(dump, /api: nicht angelegt/);
  assert.match(dump, /Protokoll keycloak/);
  assert.match(dump, /admin password \*\*\*/);
  assert.match(dump, /hv_owner:\*\*\*@postgres/);
  assert.match(dump, /dependency failed to start: \*\*\*/);
  const long = Array.from({ length: 200 }, (_, i) => `log ${i}`).join('\n');
  const tail = formatDiagnostics({ rows: [], logs: { api: long }, secrets });
  assert(tail.includes('log 199') && tail.includes('log 120') && !tail.includes('log 119\n'), 'only the last 80 lines');
  assert.equal(redact('a-b-c', ['b', '']), 'a-***-c');
});

test('Nachtrag des Orchestrators: in CI the dump shows status and ps rows only, no log line but the api refusal sentence', () => {
  const state = markedState();
  const secrets = secretsOf(state);
  const rows = [
    { service: 'keycloak', state: 'running', health: 'healthy', exitCode: 0 },
    { service: 'api', state: 'restarting', health: '', exitCode: 1 },
    { service: 'seed', state: 'exited', health: '', exitCode: 1 },
  ];
  const refusal = 'HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR must not be writable by group or accessible by others.';
  const logs = {
    api: `HV-Tool API: listening\n${refusal}\nsomething with ${MARKER}-owner\n${refusal}\nHV-Tool API: refusing to start: x ${'y'.repeat(300)}\n`,
    seed: `seed detail line ${MARKER}-client\n`,
  };
  const composeError = [
    ' Container hv-tool-api-1 Error',
    'dependency failed to start: container hv-tool-api-1 exited (1)',
    `free text from somewhere ${MARKER}-admin`,
  ].join('\n');
  const dump = formatDiagnostics({ rows, logs, composeError, secrets, ci: true });
  assert(!dump.includes(MARKER));
  assert(!dump.includes('seed detail line') && !dump.includes('listening') && !dump.includes('free text'), 'no log line, no free text');
  assert.equal(dump.split('\n').filter((line) => line.trim() === refusal).length, 1, 'the refusal sentence once');
  assert(dump.includes('Container hv-tool-api-1 Error') && dump.includes('dependency failed to start'));
  assert.match(dump, /api: restarting exit=1/);
  for (const line of dump.split('\n').filter((entry) => entry.startsWith('  HV-Tool'))) assert.match(line.trim(), REFUSAL_LINE);
  assert.doesNotMatch(`HV-Tool API: refusing to start: ${'y'.repeat(300)}`, REFUSAL_LINE);
  const local = formatDiagnostics({ rows, logs, composeError, secrets });
  assert(local.includes('seed detail line ***') && local.includes('free text from somewhere ***'), 'locally the full, redacted dump');
});

test('Nachtrag nach CI, Runde 3: CI compose lines are verb-bound and daemon errors character-limited', () => {
  // A marker that is not a state secret: redaction cannot hide it, only the filter can.
  const TAIL = 'FREE-TAIL-037a';
  const known = [
    ' Container hv-tool-api-1 Error',
    ' Container hv-tool-postgres-1  Healthy',
    ' ✔ Container hv-tool-keycloak-1  Started  2.1s',
    ' Network hv-tool_default  Creating',
    ' Volume "hv-tool_hv-access-log"  Created',
    ' Image hv-tool/api:local  Built',
    'dependency failed to start: container hv-tool-api-1 is unhealthy',
    'service "migrate" didn\'t complete successfully: exit 1',
    'Error response from daemon: driver failed programming external connectivity on endpoint hv-tool-web-1',
  ];
  const leaking = [
    ` Container hv-tool-api-1 Error ${TAIL}`,
    ` Container hv-tool-api-1 says ${TAIL}`,
    ` Network ${TAIL} Created with password=${TAIL}`,
    `Error response from daemon: "${TAIL}"`,
    `Error response from daemon: ${'x'.repeat(201)}`,
    `dependency failed to start: container hv-tool-api-1 is unhealthy ${TAIL}`,
  ];
  const dump = formatDiagnostics({ rows: [], logs: {}, composeError: [...known, ...leaking].join('\n'), secrets: [], ci: true });
  assert(!dump.includes(TAIL), 'no free-text tail in CI');
  assert(!dump.includes('x'.repeat(201)), 'daemon lines capped at 200 characters');
  const shown = dump.split('\n').map((line) => line.trim());
  for (const line of known) assert(shown.includes(line.trim()), `known status line kept: ${line}`);
});

test('Nachtrag nach CI, Runde 3: every docker run of a local image in stack.mjs carries --pull never', () => {
  const source = read('scripts/stack.mjs');
  const runs = [...source.matchAll(/[dD]ocker\(\[\s*'run'[\s\S]*?\]/g)].map((match) => match[0]).filter((call) => /IMAGES\./.test(call));
  assert(runs.length >= 4, `found ${runs.length} docker run calls with IMAGES.*`);
  for (const call of runs) assert.match(call, /'--pull', 'never'/, call);
  for (const line of read('docs/betrieb/installation.md').split('\n').filter((entry) => /docker run\b.*hv-tool\/\S+:local/.test(entry))) {
    assert.match(line, /--pull never/, line);
    assert.match(line, /--read-only/, line);
  }
});

test('Nachtrag: down, reset, smoke, probe, login and up refuse a remote daemon before any docker call', () => {
  const home = scratch();
  try {
    const env = { XDG_STATE_HOME: home, HOME: home };
    const { state, dir } = readOrCreateState(env);
    writeStateFiles(dir, state);
    // An empty PATH: a command that reached the docker binary would fail differently, not with the refusal.
    const runEnv = { ...env, PATH: '', DOCKER_HOST: 'tcp://10.0.0.1:2376' };
    const commands = [[STACK, 'down'], [STACK, 'reset', '--yes'], [STACK, 'smoke'], [STACK, 'probe', 'images'],
      [join(ROOT, 'scripts/stack-login.mjs')], [STACK, 'up']];
    for (const args of commands) {
      const run = spawnSync(process.execPath, args, { encoding: 'utf8', env: runEnv, timeout: 30_000 });
      assert.notEqual(run.status, 0, args.join(' '));
      assert.match(run.stderr, /entfernter Docker-Daemon/, args.slice(1).join(' ') || 'login');
    }
    assert(existsSync(join(dir, 'state.json')), 'reset refused before deleting anything');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('S18 the CI job stack-037a: pull requests only, inherited rights, 25 min, no secret output, one screenshot upload', () => {
  const workflow = YAML.parse(read('.github/workflows/gates.yml'));
  const job = workflow.jobs['stack-037a'];
  assert.equal(job.if, "github.event_name == 'pull_request'");
  assert.equal(job.permissions, undefined);
  assert.equal(job['timeout-minutes'], 25);
  const runs = job.steps.map((step) => step.run ?? '').join('\n');
  assert.doesNotMatch(runs, /stack:credentials|stack\.mjs credentials|compose\b[^\n]*\bconfig\b|compose\b[^\n]*\blogs\b/);
  for (const line of runs.split('\n').filter((entry) => /docker\s+inspect/.test(entry))) assert.match(line, /--format/);
  const uploads = job.steps.filter((step) => String(step.uses ?? '').startsWith('actions/upload-artifact@'));
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].with.path, 'docs/evidence/037a-stack-angemeldet.png');
  assert.equal(uploads[0].with.name, 'evidence-037a-stack');
  assert.equal(uploads[0].if, "always() && steps.docsfilter.outputs.code == 'true'");
  for (const step of job.steps.filter((entry) => entry.uses)) assert.match(step.uses, /^[\w./-]+@[0-9a-f]{40}$/, step.uses);
  assert.equal(job.steps[1].run, 'rm -f docs/evidence/037a-stack-angemeldet.png', 'the committed screenshot goes right after checkout');
  assert.match(runs, /node scripts\/stack\.mjs down[^]*pnpm stack:up[^]*bereits befüllt[^]*pnpm stack:login -- --no-screenshot/);
  assert.deepEqual(Object.keys(workflow.jobs), ['gates', 'stack-037a', 'e2e-http'], 'e2e-http stays the last job (031a tests)');
});

test('Nachtrag nach CI, Runde 4: postgres stops fast (SIGINT) with a grace period that covers the shutdown checkpoint', () => {
  const { postgres } = loadCompose().services;
  assert.equal(postgres.stop_signal, 'SIGINT');
  assert.equal(postgres.stop_grace_period, '30s');
});

/** A fake clock and a fake watcher/restart pair: the probe's order and timing without Docker. */
function fakeRestartWorld({ readyAfter = 4_000, watchReady = true, outage = [300, 900], restartTakes = 1_200, restartCode = 0 } = {}) {
  let clock = 1_000_000;
  const log = [];
  const tick = (ms) => new Promise((resolveTick) => setImmediate(() => { clock += ms; resolveTick(); }));
  let restartAt;
  let restartBegan;
  const began = new Promise((resolveBegan) => { restartBegan = resolveBegan; });
  const startWatch = () => {
    log.push('watch');
    const ready = tick(readyAfter).then(() => { log.push(`ready:${watchReady}`); return watchReady; });
    const done = ready.then(async (ok) => {
      if (!ok) return { code: 1, value: { baseline: false } };
      // The watcher keeps polling until the restart has begun, then sees the outage relative to the restart start.
      await began;
      const value = outage === null ? { baseline: true, bad: null, back: null }
        : { baseline: true, bad: { state: 'unreachable', at: restartAt + outage[0] }, back: restartAt + outage[1] };
      await tick(outage === null ? 75_000 : outage[1]);
      return { code: 0, value };
    });
    return { ready, done };
  };
  const startRestart = () => { restartAt = clock; log.push('restart'); restartBegan(); return tick(restartTakes).then(() => ({ code: restartCode })); };
  return { startWatch, startRestart, now: () => clock, log };
}

test('Nachtrag nach CI, Runde 4: the restart starts only after the watcher saw db ok, and time counts from the restart', async () => {
  const slowExec = fakeRestartWorld({ readyAfter: 9_000 });
  const result = await observePostgresRestart(slowExec);
  assert.deepEqual(slowExec.log, ['watch', 'ready:true', 'restart'], 'a slow exec start delays the restart, never the watcher');
  assert.equal(result.ok, true);
  assert.equal(result.state, 'unreachable');
  assert.equal(result.seconds, 0.9, 'back again measured from the restart start, not from the watcher start');
  assert.equal(result.restartSeconds, 1.2, 'the restart command is timed on its own, not with the watcher');

  const notReady = fakeRestartWorld({ watchReady: false });
  const refused = await observePostgresRestart(notReady);
  assert(!notReady.log.includes('restart'), 'no restart without a baseline');
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'watcher-not-ready');

  assert.equal((await observePostgresRestart(fakeRestartWorld({ outage: null }))).ok, false, 'never seen not ok fails');
  assert.equal((await observePostgresRestart(fakeRestartWorld({ outage: [500, 61_000] }))).ok, false, 'back after 61 s fails');
  assert.equal((await observePostgresRestart(fakeRestartWorld({ restartCode: 1 }))).ok, false, 'a failed restart command fails');
});

test('Nachtrag nach CI, Runde 4: the evaluation rejects an outage seen before the restart and a missing return', () => {
  const restartAt = 5_000;
  const base = { restartAt, restartCode: 0, restartMs: 800, limitMs: 60_000 };
  assert.equal(evaluatePostgresRestart({ ...base, value: { bad: { state: 'timeout', at: 5_100 }, back: 65_000 } }).ok, true);
  assert.equal(evaluatePostgresRestart({ ...base, value: { bad: { state: 'timeout', at: 5_100 }, back: 65_001 } }).ok, false);
  assert.equal(evaluatePostgresRestart({ ...base, value: { bad: { state: 'timeout', at: 4_999 }, back: 6_000 } }).ok, false);
  assert.equal(evaluatePostgresRestart({ ...base, value: { bad: { state: 'timeout', at: 5_100 }, back: null } }).ok, false);
  assert.equal(evaluatePostgresRestart({ ...base, value: undefined }).ok, false);
});
