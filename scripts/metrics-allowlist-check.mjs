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
 *   (f) `metrics` missing or not an array; a label twice within one metric; a `type` outside {gauge, counter}.
 *   (e) a `spec` that does not name a file `docs/slices/<spec>-*.md` whose section
 *       "## Kennzahlen-Allowlist" contains the name in backticks;
 *   (g) slice 061, for every entry of the optional `reports` (a view that shows figures, e.g. the
 *       control desk): an `id` outside `^[a-z0-9-]+$`; a `spec` whose "## Kennzahlen-Allowlist" does not
 *       name the id in backticks; an `aggregation` that is not a non-empty list from the closed set
 *       {meeting, status, unit, seat}; a `questionReferences` that is not boolean; a `minimumGroupSize`
 *       that is neither null nor a positive integer; a field path that points at a person (same terms
 *       as (c)); a field source that is not a family of `metrics`, a `Meeting.counts.*` field,
 *       `derived: <reason>` or `meta: <what>`. A catalog without `reports` passes (backward compatible).
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

const REPORT_ID_RE = /^[a-z0-9-]+$/;
const AGGREGATION_LEVELS = new Set(['meeting', 'status', 'unit', 'seat']);
const COUNTS_SOURCE_RE = /^Meeting\.counts\.[A-Za-z]+(\.[A-Za-z_]+)?$/;
const FREE_SOURCE_RE = /^(derived|meta): \S/;

/** Rule (g): the reports of the catalog (slice 061). `metricNames` are the families of `metrics`. */
function checkReports(catalog, specsDir, metricNames) {
  if (catalog.reports === undefined) return [];
  if (!Array.isArray(catalog.reports)) return ['catalog: (g) "reports" is not an array'];
  const failures = [];
  for (const report of catalog.reports) {
    const id = String(report?.id);
    if (!REPORT_ID_RE.test(id)) failures.push(`report ${id}: (g) id must match ^[a-z0-9-]+$`);
    const covered = specNames(specsDir, report?.spec);
    if (covered === undefined || !covered.has(id)) {
      failures.push(`report ${id}: (g) spec "${report?.spec}" has no docs/slices/${report?.spec}-*.md with "## Kennzahlen-Allowlist" naming \`${id}\``);
    }
    const aggregation = report?.aggregation;
    if (!Array.isArray(aggregation) || aggregation.length === 0 || aggregation.some((level) => !AGGREGATION_LEVELS.has(level))) {
      failures.push(`report ${id}: (g) aggregation must be a non-empty list from {meeting, status, unit, seat}`);
    }
    if (typeof report?.questionReferences !== 'boolean') failures.push(`report ${id}: (g) questionReferences must be boolean`);
    const minimum = report?.minimumGroupSize;
    if (minimum !== null && !(Number.isInteger(minimum) && minimum > 0)) {
      failures.push(`report ${id}: (g) minimumGroupSize must be null or a positive integer`);
    }
    const fields = Array.isArray(report?.fields) ? report.fields : [];
    if (fields.length === 0) failures.push(`report ${id}: (g) fields must be a non-empty list`);
    for (const field of fields) {
      const path = String(field?.path);
      // Path segments become words, so the short term `ip` matches as in (c) (`client.ip`, `ipAddress` aside).
      const term = personalTerm(path.replace(/[^A-Za-z0-9]+/g, '_'));
      if (term !== undefined) failures.push(`report ${id}: (g) field "${path}" points at a person ("${term}")`);
      const source = String(field?.source);
      if (!metricNames.has(source) && !COUNTS_SOURCE_RE.test(source) && !FREE_SOURCE_RE.test(source)) {
        failures.push(`report ${id}: (g) field "${path}" has source "${source}", not a catalog family, Meeting.counts.*, derived: or meta:`);
      }
    }
  }
  return failures;
}

export function checkCatalog(catalog, specsDir) {
  const failures = [];
  const seen = new Set();
  // A catalog without a metrics array must not pass as an empty, therefore clean, catalog.
  if (!Array.isArray(catalog?.metrics)) return ['catalog: (f) "metrics" is missing or not an array'];
  for (const metric of catalog.metrics) {
    const name = String(metric.name);
    const labels = Array.isArray(metric.labels) ? metric.labels.map(String) : [];
    if (!NAME_RE.test(name)) failures.push(`${name}: (a) name must match ^hv_[a-z0-9_]+$`);
    if (seen.has(name)) failures.push(`${name}: (a) duplicate name`);
    seen.add(name);
    if (!['gauge', 'counter'].includes(metric.type)) failures.push(`${name}: (f) type "${metric.type}" is not gauge or counter`);
    if (new Set(labels).size !== labels.length) failures.push(`${name}: (f) a label appears twice`);
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
  failures.push(...checkReports(catalog, specsDir, seen));
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
  const checked = JSON.parse(readFileSync(args.catalog, 'utf8'));
  console.log(`metrics-allowlist: ${checked.metrics.length} metrics, ${(checked.reports ?? []).length} report(s), all within the allowlist.`);
}
