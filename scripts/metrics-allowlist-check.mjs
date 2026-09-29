#!/usr/bin/env node
/**
 * Kennzahlen-Allowlist-Tor (metrics allowlist gate, slice 033b, ADR 0013). Reads the one catalog
 * `apps/api/src/metrics/catalog.json` and fails when a metric could become a metric per person or is
 * not covered by a spec:
 *   (a) a name that does not match `^hv_[a-z0-9_]+$`, or a duplicate name;
 *   (b) a label outside {meeting_id, unit_id};
 *   (c) a name or label that points at a person (subject, actor, person, user, employee, assignee,
 *       claim, session, login, email, ip) — ALWAYS, also with a spec entry. This is stricter than the
 *       wording of ADR 0013 ("no metric per subject without a spec entry") on purpose: "no metric per
 *       person" and the rights concept (section 6) win. Loosening it takes an ADR change, not a switch;
 *   (d) a name containing `rate_limit` (ephemeral, ADR 0013, never in the catalog);
 *   (e) a `spec` that does not name a file `docs/slices/<spec>-*.md` whose section
 *       "## Kennzahlen-Allowlist" contains the name in backticks.
 * Run as `pnpm metrics-allowlist` (part of `pnpm gates`). `--catalog <file>` and `--specs-dir <dir>`
 * override the inputs for tests. No network, deterministic.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOWED_LABELS = new Set(['meeting_id', 'unit_id']);
const PERSONAL_SUBSTRINGS = ['subject', 'actor', 'person', 'user', 'employee', 'assignee', 'claim', 'session', 'login', 'email'];
const NAME_RE = /^hv_[a-z0-9_]+$/;

function parseArgs(argv) {
  const out = { catalog: join(ROOT, 'apps/api/src/metrics/catalog.json'), specsDir: join(ROOT, 'docs/slices') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--catalog') out.catalog = resolve(argv[++i]);
    else if (argv[i] === '--specs-dir') out.specsDir = resolve(argv[++i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return out;
}

/** Long terms match as substrings (strict on purpose); the short `ip` only as a whole word of the name. */
function personalTerm(text) {
  const lower = text.toLowerCase();
  for (const term of PERSONAL_SUBSTRINGS) if (lower.includes(term)) return term;
  if (lower.split('_').includes('ip')) return 'ip';
  return undefined;
}

function allowlistSection(text) {
  const start = text.search(/^## Kennzahlen-Allowlist\s*$/m);
  if (start === -1) return undefined;
  const rest = text.slice(start).replace(/^## Kennzahlen-Allowlist\s*$/m, '');
  const end = rest.search(/^## /m);
  return end === -1 ? rest : rest.slice(0, end);
}

function specNames(specsDir, spec) {
  if (typeof spec !== 'string' || !/^[0-9]{3}[a-z]?$/.test(spec) || !existsSync(specsDir)) return undefined;
  const files = readdirSync(specsDir).filter((f) => f.startsWith(`${spec}-`) && f.endsWith('.md')).sort();
  if (files.length === 0) return undefined;
  const names = new Set();
  for (const file of files) {
    for (const m of (allowlistSection(readFileSync(join(specsDir, file), 'utf8')) ?? '').matchAll(/`([^`]+)`/g)) names.add(m[1]);
  }
  return names;
}

export function checkCatalog(catalog, specsDir) {
  const failures = [];
  const seen = new Set();
  for (const metric of catalog.metrics ?? []) {
    const name = String(metric.name);
    const labels = Array.isArray(metric.labels) ? metric.labels.map(String) : [];
    if (!NAME_RE.test(name)) failures.push(`${name}: (a) name must match ^hv_[a-z0-9_]+$`);
    if (seen.has(name)) failures.push(`${name}: (a) duplicate name`);
    seen.add(name);
    for (const label of labels) {
      if (!ALLOWED_LABELS.has(label)) failures.push(`${name}: (b) label "${label}" is outside {meeting_id, unit_id}`);
    }
    for (const text of [name, ...labels]) {
      const term = personalTerm(text);
      if (term !== undefined) failures.push(`${name}: (c) "${text}" points at a person ("${term}"); no metric per person, with or without a spec entry`);
    }
    if (name.includes('rate_limit')) failures.push(`${name}: (d) rate-limit counters are ephemeral and never part of the catalog`);
    const covered = specNames(specsDir, metric.spec);
    if (covered === undefined || !covered.has(name)) {
      failures.push(`${name}: (e) spec "${metric.spec}" has no docs/slices/${metric.spec}-*.md with "## Kennzahlen-Allowlist" naming \`${name}\``);
    }
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const failures = checkCatalog(JSON.parse(readFileSync(args.catalog, 'utf8')), args.specsDir);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL  ${failure}`);
    console.error(`metrics-allowlist: ${failures.length} finding(s).`);
    process.exit(1);
  }
  console.log(`metrics-allowlist: ${JSON.parse(readFileSync(args.catalog, 'utf8')).metrics.length} metrics, all within the allowlist.`);
}
