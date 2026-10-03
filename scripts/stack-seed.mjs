/**
 * Slice 037a: the one-off fill of the local stack. It runs only in the image `hv-tool/seed:local` (the image `api` never
 * contains it), once, before the service starts. It writes the demo corpus and the role assignments of the nine test
 * persons as the database owner directly into the event log, past the rights path (SP-1). Therefore it refuses (exit 1,
 * a fixed sentence without any value) unless
 *
 *   1. the issuer is `http://localhost:<port>/…` or `http://127.0.0.1:<port>/…` (a local test realm), and
 *   2. the database URL points at the compose host `postgres`,
 *
 * both checked before any database connection exists, and it writes nothing if the event log is not empty (exit 0 with
 * the fixed sentence "bereits befüllt"). The owner has no superuser rights in the stack (decision 8).
 *
 * Environment (seed.env, written by scripts/stack.mjs): STACK_SEED_DATABASE_URL, STACK_SEED_ISSUER and
 * STACK_SEED_SUBJECTS (`key=subject` pairs, comma-separated). Runs with the tsx loader (the bootstrap imports the
 * TypeScript of the service and the domain).
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PERSONS } from './lib/demo-persons.mjs';
import { bootstrap } from './lib/demo-bootstrap.mjs';

export const SEED_REFUSALS = Object.freeze({
  issuer: 'HV-Stack-Befüllung verweigert: Der Issuer muss http://localhost:<Port>/… oder http://127.0.0.1:<Port>/… sein.',
  database: 'HV-Stack-Befüllung verweigert: Die Datenbank-URL muss auf den Compose-Host postgres zeigen.',
  subjects: 'HV-Stack-Befüllung verweigert: Die Testpersonen fehlen oder sind unvollständig.',
});
export const SEED_ALREADY_FILLED = 'HV-Stack-Befüllung: bereits befüllt, nichts geschrieben.';
export const SEED_FILLED = 'HV-Stack-Befüllung: Demo-Korpus und neun Testpersonen geschrieben.';
export const SEED_FAILED = 'HV-Stack-Befüllung fehlgeschlagen.';

/** Rule 1: a plain-http issuer on loopback with an explicit port (the local Keycloak of the stack). */
export function checkIssuer(raw) {
  try {
    const url = new URL(raw);
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol === 'http:' && loopback && url.port !== '' && url.username === '' && url.password === '') return undefined;
  } catch { /* not a URL */ }
  return SEED_REFUSALS.issuer;
}

/** Rule 2: the database host is exactly the compose service `postgres`. */
export function checkDatabaseHost(raw) {
  try {
    const url = new URL(raw);
    if ((url.protocol === 'postgres:' || url.protocol === 'postgresql:') && url.hostname === 'postgres') return undefined;
  } catch { /* not a URL */ }
  return SEED_REFUSALS.database;
}

/** `key=subject,…` for exactly the nine persons. */
export function parseSubjects(raw) {
  const pairs = Object.fromEntries(String(raw ?? '').split(',').filter(Boolean).map((pair) => pair.split('=')));
  const complete = PERSONS.every((person) => /^[0-9a-f-]{36}$/.test(pairs[person.key] ?? ''));
  return complete && Object.keys(pairs).length === PERSONS.length
    ? Object.fromEntries(PERSONS.map((person) => [person.key, { id: pairs[person.key] }]))
    : undefined;
}

/** `pg` lives in the dependencies of @hv/api; pnpm does not hoist it to the root (as `apiRequire` in 031a). */
function loadPg() {
  const manifest = join(dirname(fileURLToPath(import.meta.url)), '../apps/api/package.json');
  return createRequire(pathToFileURL(manifest))('pg');
}

async function main(env) {
  const issuerRefusal = checkIssuer(env.STACK_SEED_ISSUER);
  if (issuerRefusal) return { code: 1, line: issuerRefusal, stream: 'stderr' };
  const databaseRefusal = checkDatabaseHost(env.STACK_SEED_DATABASE_URL);
  if (databaseRefusal) return { code: 1, line: databaseRefusal, stream: 'stderr' };
  const users = parseSubjects(env.STACK_SEED_SUBJECTS);
  if (!users) return { code: 1, line: SEED_REFUSALS.subjects, stream: 'stderr' };

  const { Pool } = loadPg();
  const probe = new Pool({ connectionString: env.STACK_SEED_DATABASE_URL, connectionTimeoutMillis: 5_000, max: 1 });
  let count;
  try {
    count = Number((await probe.query('SELECT count(*)::bigint AS n FROM events')).rows[0].n);
  } finally {
    await probe.end();
  }
  if (count > 0) return { code: 0, line: SEED_ALREADY_FILLED, stream: 'stdout' };
  await bootstrap({ Pool, ownerUrl: env.STACK_SEED_DATABASE_URL, issuer: env.STACK_SEED_ISSUER, users, persons: PERSONS });
  return { code: 0, line: SEED_FILLED, stream: 'stdout' };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.env).then(({ code, line, stream }) => {
    (stream === 'stderr' ? console.error : console.log)(line);
    process.exitCode = code;
  }, () => {
    // Driver errors can carry connection details; only the fixed sentence leaves the process.
    console.error(SEED_FAILED);
    process.exitCode = 1;
  });
}
