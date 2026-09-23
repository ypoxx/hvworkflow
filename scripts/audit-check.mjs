#!/usr/bin/env node
/**
 * `pnpm audit` with a reasoned, expiring exception list (docs/agentische-entwicklung-plan.md 5.2
 * "Statische Sicherheitsanalyse"). Blocks from `moderate` severity up, unless the advisory has a
 * matching, unexpired entry in `scripts/audit-exceptions.json` (id, module, reason, owner, expiry —
 * an expired entry blocks on its own). CI-only: needs the registry over the network.
 *
 * Run explicitly as its own named CI step (`pnpm audit:check`), not part of `pnpm gates`.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const EXCEPTIONS_PATH = 'scripts/audit-exceptions.json';
const BLOCKING_SEVERITIES = new Set(['moderate', 'high', 'critical']);

function loadExceptions() {
  const raw = JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8'));
  for (const entry of raw) {
    for (const field of ['id', 'reason', 'owner', 'expires']) {
      if (entry[field] === undefined || entry[field] === '') {
        throw new Error(`${EXCEPTIONS_PATH}: exception for id ${entry.id ?? '?'} is missing "${field}".`);
      }
    }
  }
  return raw;
}

function runPnpmAudit() {
  // `pnpm audit` exits non-zero when it finds vulnerabilities; that is expected, not a script failure —
  // the JSON on stdout is what we actually evaluate.
  const result = spawnSync('pnpm', ['audit', '--json'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (!result.stdout || result.stdout.trim() === '') {
    console.error('pnpm audit produced no output.');
    console.error(result.stderr);
    process.exit(1);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (e) {
    console.error('pnpm audit output was not valid JSON:', e);
    console.error(result.stdout);
    process.exit(1);
  }
}

const exceptions = loadExceptions();
const exceptionById = new Map(exceptions.map((e) => [String(e.id), e]));
const report = runPnpmAudit();
const advisories = Object.values(report.advisories ?? {});

if (advisories.length === 0) {
  console.log('pnpm audit: no advisories reported.');
  process.exit(0);
}

const now = new Date(); // now-ok: CI-only tooling script, not domain/api runtime code (scripts/ is
// outside now-check.mjs's scanned roots) — this only decides whether an audit exception has expired.
const blocking = [];
const excepted = [];

for (const advisory of advisories) {
  const severity = String(advisory.severity ?? '').toLowerCase();
  if (!BLOCKING_SEVERITIES.has(severity)) continue;
  const exception = exceptionById.get(String(advisory.id));
  if (!exception) {
    blocking.push({ advisory, reason: 'no exception entry' });
    continue;
  }
  const expires = new Date(exception.expires);
  if (Number.isNaN(expires.getTime()) || expires.getTime() < now.getTime()) {
    blocking.push({ advisory, reason: `exception expired on ${exception.expires}` });
    continue;
  }
  excepted.push({ advisory, exception });
}

for (const { advisory, exception } of excepted) {
  console.log(
    `pnpm audit: ${advisory.severity} advisory ${advisory.id} (${advisory.module_name}) allowed — ` +
      `${exception.reason} [owner: ${exception.owner}, expires: ${exception.expires}]`,
  );
}

if (blocking.length > 0) {
  console.error(`pnpm audit: ${blocking.length} blocking advisory(ies) at "moderate" or above:`);
  for (const { advisory, reason } of blocking) {
    console.error(
      `  #${advisory.id} ${advisory.severity} ${advisory.module_name} (${advisory.title}) — ${reason}. ` +
        `Add a reasoned entry to ${EXCEPTIONS_PATH} (id, module, reason, owner, expires) or fix the dependency.`,
    );
  }
  process.exit(1);
}

console.log(`pnpm audit: ${advisories.length} advisory(ies) found, all at "moderate"+ covered by an unexpired exception.`);
