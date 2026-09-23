#!/usr/bin/env node
/**
 * Contract gate (slice 019, ADR 0015 Vertragsversionierung). Runs as the `test` script of
 * `@hv/contract`, so `pnpm -r test` and therefore `pnpm gates` run it. No network, no dependencies:
 * the contract package has none, and adding one would touch the lockfile outside this slice's files.
 * The two values the gate needs from `openapi.yaml` (`info.version`, the `operationId`s) are read
 * line-wise; the document is authored, not generated, and both live on plain single lines.
 *
 * Checks:
 *   (a) `info.version` in openapi.yaml equals `version` in package.json.
 *   (b) CHANGELOG.md has a section heading for exactly that version.
 *   (c) If openapi.yaml differs from its state at the merge base with the integration branch, the
 *       version must be higher than it was there. Skipped with a note when git or the ref is not
 *       available (shallow CI checkout, no remote).
 *   (d) allowlist.json is a well-formed list of pre-declared, not yet implemented operations
 *       `{ operationId, reason, slice, expires }`; every operationId exists in the contract; no entry
 *       is expired (an expired entry makes the gate red on purpose — nothing dead may survive).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageDir, '..', '..');
const contractPath = join(packageDir, 'openapi.yaml');
const contractRel = relative(repoRoot, contractPath).split('\\').join('/');
const INTEGRATION_REF = 'origin/claude/dax-shareholder-meeting-workflow-0s934z';

const failures = [];
const ok = (msg) => console.log(`  ok    ${msg}`);
const skip = (msg) => console.log(`  skip  ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.log(`  FAIL  ${msg}`);
};

// ---- helpers ------------------------------------------------------------------------------------

/** `info.version` of an OpenAPI document: the first `version:` line inside the `info:` block. */
function contractVersionOf(yamlText) {
  const match = /^info:[ \t]*\r?\n((?:[ \t]+.*\r?\n)*?)?[ \t]+version:[ \t]*['"]?([^'"\s#]+)['"]?/m.exec(yamlText);
  return match ? match[2] : undefined;
}

/** Every `operationId: xyz` line of the document. */
function operationIdsOf(yamlText) {
  const ids = new Set();
  for (const m of yamlText.matchAll(/^[ \t]+operationId:[ \t]*['"]?([A-Za-z0-9_.-]+)['"]?[ \t]*(?:#.*)?$/gm)) ids.add(m[1]);
  return ids;
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(v ?? '');
  if (!m) return undefined;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

/** -1, 0 or 1; a pre-release sorts before the release of the same triple. */
function compareSemver(a, b) {
  for (const k of ['major', 'minor', 'patch']) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  return a.pre < b.pre ? -1 : 1;
}

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

// ---- inputs -------------------------------------------------------------------------------------

const contractText = readFileSync(contractPath, 'utf8');
const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const contractVersion = contractVersionOf(contractText);
const operationIds = operationIdsOf(contractText);

console.log(`contract gate: ${contractRel} (info.version ${contractVersion ?? '?'}, ${operationIds.size} operations)`);

// ---- (a) version = package version ---------------------------------------------------------------

if (!contractVersion) fail('(a) info.version not found in openapi.yaml');
else if (!parseSemver(contractVersion)) fail(`(a) info.version "${contractVersion}" is not semver`);
else if (contractVersion !== pkg.version) fail(`(a) info.version ${contractVersion} != package.json version ${pkg.version}`);
else ok(`(a) info.version ${contractVersion} = package.json version`);

// ---- (b) changelog section -----------------------------------------------------------------------

const changelogPath = join(packageDir, 'CHANGELOG.md');
if (!existsSync(changelogPath)) fail('(b) CHANGELOG.md is missing');
else if (contractVersion) {
  const escaped = contractVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^## \\[?${escaped}\\]?(?:\\s|$)`, 'm');
  if (heading.test(readFileSync(changelogPath, 'utf8'))) ok(`(b) CHANGELOG.md has a section for ${contractVersion}`);
  else fail(`(b) CHANGELOG.md has no section "## [${contractVersion}] - YYYY-MM-DD"`);
}

// ---- (c) contract changed against the integration branch => version bumped -----------------------

(function checkVersionBump() {
  let base;
  try {
    git(['rev-parse', '--verify', '--quiet', `${INTEGRATION_REF}^{commit}`]);
    base = git(['merge-base', 'HEAD', INTEGRATION_REF]);
  } catch {
    skip(`(c) git or ${INTEGRATION_REF} not available — version-bump check skipped`);
    return;
  }
  let changed;
  try {
    git(['diff', '--quiet', base, '--', contractRel]);
    changed = false;
  } catch (e) {
    if (e && e.status === 1) changed = true;
    else {
      skip(`(c) git diff failed (${e?.message?.split('\n')[0] ?? 'unknown'}) — version-bump check skipped`);
      return;
    }
  }
  if (!changed) {
    ok(`(c) openapi.yaml unchanged against merge base ${base.slice(0, 7)} with ${INTEGRATION_REF}`);
    return;
  }
  let baseText;
  try {
    baseText = git(['show', `${base}:${contractRel}`]);
  } catch {
    ok(`(c) openapi.yaml is new against merge base ${base.slice(0, 7)} — nothing to compare`);
    return;
  }
  const baseVersion = contractVersionOf(baseText);
  const from = parseSemver(baseVersion);
  const to = parseSemver(contractVersion);
  if (!from || !to) {
    fail(`(c) cannot compare versions (merge base "${baseVersion}", working tree "${contractVersion}")`);
    return;
  }
  if (compareSemver(to, from) > 0) ok(`(c) openapi.yaml changed against merge base ${base.slice(0, 7)}; version ${baseVersion} -> ${contractVersion}`);
  else fail(`(c) openapi.yaml changed against merge base ${base.slice(0, 7)} but info.version stayed at ${contractVersion} (was ${baseVersion}) — bump the version and add a CHANGELOG section (ADR 0015)`);
})();

// ---- (d) allowlist -------------------------------------------------------------------------------

(function checkAllowlist() {
  const allowlistPath = join(packageDir, 'allowlist.json');
  if (!existsSync(allowlistPath)) {
    fail('(d) allowlist.json is missing (an empty list is `[]`)');
    return;
  }
  let entries;
  try {
    entries = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  } catch (e) {
    fail(`(d) allowlist.json is not valid JSON: ${e.message}`);
    return;
  }
  if (!Array.isArray(entries)) {
    fail('(d) allowlist.json must be a JSON array');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const required = ['operationId', 'reason', 'slice', 'expires'];
  const seen = new Set();
  let bad = 0;
  entries.forEach((entry, i) => {
    const where = `(d) allowlist[${i}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      fail(`${where} is not an object`);
      bad++;
      return;
    }
    const keys = Object.keys(entry);
    for (const k of required) {
      if (typeof entry[k] !== 'string' || entry[k].trim() === '') {
        fail(`${where} needs a non-empty string "${k}"`);
        bad++;
      }
    }
    for (const k of keys) {
      if (!required.includes(k)) {
        fail(`${where} has an unknown key "${k}" (allowed: ${required.join(', ')})`);
        bad++;
      }
    }
    if (typeof entry.operationId === 'string') {
      if (!operationIds.has(entry.operationId)) {
        fail(`${where} operationId "${entry.operationId}" does not exist in openapi.yaml`);
        bad++;
      }
      if (seen.has(entry.operationId)) {
        fail(`${where} operationId "${entry.operationId}" is listed twice`);
        bad++;
      }
      seen.add(entry.operationId);
    }
    if (typeof entry.expires === 'string') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.expires);
      const d = m ? new Date(`${entry.expires}T00:00:00Z`) : null;
      if (!m || !d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== entry.expires) {
        fail(`${where} expires "${entry.expires}" is not a calendar date YYYY-MM-DD`);
        bad++;
      } else if (entry.expires < today) {
        fail(`${where} operationId "${entry.operationId}" expired on ${entry.expires} (today ${today}, slice ${entry.slice}) — implement it or remove it from the contract`);
        bad++;
      }
    }
  });
  if (bad === 0) ok(`(d) allowlist.json well-formed, ${entries.length} pre-declared operation(s), none expired (today ${today})`);
})();

// ---- result --------------------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`contract gate: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('contract gate: ok');
