#!/usr/bin/env node
/**
 * Section 5 of `docs/agentische-entwicklung-plan.md` ("Qualitätstore je Ebene") must not claim a gate
 * runs when it does not (Audit-Befund A2). Every data row of every table in 5.1–5.4 needs a last
 * column "Stand" with exactly one of:
 *   - `läuft (CI: <Schrittname>)`      — `<Schrittname>` must be a `name:` in .github/workflows/*.yml
 *   - `läuft (Hook: <Hook-Ereignis>)`  — `<Hook-Ereignis>` must be a key under `hooks` in .claude/settings.json
 *   - `läuft (Review: Reviewer-Checkliste)`
 *   - `geplant in Scheibe NNN`         — `NNN` must be a slice bullet in docs/produktplan-beta.md section 5,
 *                                        and must not already be `**Status:** accepted` in its own
 *                                        `docs/slices/NNN-*.md` (review rework round 1, major 8, optional part)
 *
 * Run as part of `pnpm gates` (`pnpm plan-honesty`). Deterministic, no network.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const PLAN_PATH = 'docs/agentische-entwicklung-plan.md';
const SETTINGS_PATH = '.claude/settings.json';
const WORKFLOWS_DIR = '.github/workflows';
const PRODUCT_PLAN_PATH = 'docs/produktplan-beta.md';
const SLICES_DIR = 'docs/slices';

const STAND_FORMS = [
  { re: /^läuft \(CI: (.+)\)$/, kind: 'ci' },
  { re: /^läuft \(Hook: (.+)\)$/, kind: 'hook' },
  { re: /^läuft \(Review: Reviewer-Checkliste\)$/, kind: 'review' },
  { re: /^geplant in Scheibe (\d{3})$/, kind: 'planned' },
];

// ---- collect the ground truth ------------------------------------------------------------------

/** Every step `name:` in every workflow, found by a plain line scan (no YAML parser dependency —
 * root `package.json` only adds `dependency-cruiser`, per this slice's Files allowed). A step name is
 * always a YAML sequence item (`  - name: ...`); the workflow's own top-level `name:` (no leading
 * `-`) is deliberately not matched. */
function collectCiStepNames() {
  const names = new Set();
  for (const file of readdirSync(WORKFLOWS_DIR)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = readFileSync(join(WORKFLOWS_DIR, file), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*-\s*name:\s*(.+?)\s*$/);
      if (!m) continue;
      let name = m[1];
      if ((name.startsWith('"') && name.endsWith('"')) || (name.startsWith("'") && name.endsWith("'"))) {
        name = name.slice(1, -1);
      }
      names.add(name);
    }
  }
  return names;
}

function collectHookEvents() {
  const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
  return new Set(Object.keys(settings.hooks ?? {}));
}

/** Slice numbers section 5 ("Meilensteine und Scheiben") of the product plan lists, e.g. the "012"
 * in "- **012 · Architektur- und Sicherheitstore, ...**". */
function collectPlannedSliceNumbers() {
  const text = readFileSync(PRODUCT_PLAN_PATH, 'utf8');
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l) => /^## 5\./.test(l));
  if (startIdx === -1) throw new Error(`${PRODUCT_PLAN_PATH}: no "## 5." heading found.`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## \d/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const section = lines.slice(startIdx, endIdx);
  const numbers = new Set();
  for (const line of section) {
    const m = line.match(/^-\s+\*\*(\d{3})\s+·/);
    if (m) numbers.add(m[1]);
  }
  return numbers;
}

/** Review rework round 1, major 8 (optional part): slice numbers whose own spec file in
 * `docs/slices/NNN-*.md` already has `**Status:** accepted` — a row still marked `geplant in
 * Scheibe NNN` for one of these is stale (the slice landed; the row should say `läuft` now). */
function collectAcceptedSliceNumbers() {
  const accepted = new Set();
  for (const file of readdirSync(SLICES_DIR)) {
    const m = file.match(/^(\d{3})-.*\.md$/);
    if (!m) continue;
    const text = readFileSync(join(SLICES_DIR, file), 'utf8');
    const status = text.match(/^\*\*Status:\*\*\s*(.+)$/m);
    if (status && /^accepted\b/.test(status[1].trim())) accepted.add(m[1]);
  }
  return accepted;
}

// ---- parse section 5 of the development plan into table rows ----------------------------------

/** One table block: header cells, and each data row's cells (both arrays of trimmed strings). */
function parseTables(sectionLines) {
  const tables = [];
  let i = 0;
  while (i < sectionLines.length) {
    if (!isTableRow(sectionLines[i])) {
      i++;
      continue;
    }
    const header = splitRow(sectionLines[i]);
    if (!isSeparatorRow(sectionLines[i + 1] ?? '')) {
      i++;
      continue; // a `|`-containing prose line, not actually a table
    }
    const rows = [];
    let j = i + 2;
    while (j < sectionLines.length && isTableRow(sectionLines[j])) {
      rows.push({ line: j, cells: splitRow(sectionLines[j]) });
      j++;
    }
    tables.push({ headerLine: i, header, rows });
    i = j;
  }
  return tables;
}

const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isSeparatorRow = (line) => isTableRow(line) && /^[\s|:-]+$/.test(line);
const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

// ---- run the checks -----------------------------------------------------------------------------

function extractSection5(planText) {
  const lines = planText.split('\n');
  const startIdx = lines.findIndex((l) => /^## 5\./.test(l));
  if (startIdx === -1) throw new Error(`${PLAN_PATH}: no "## 5." heading found.`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## \d/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return { lines: lines.slice(startIdx, endIdx), offset: startIdx };
}

const ciStepNames = collectCiStepNames();
const hookEvents = collectHookEvents();
const plannedSlices = collectPlannedSliceNumbers();
const acceptedSlices = collectAcceptedSliceNumbers();

const planText = readFileSync(PLAN_PATH, 'utf8');
const { lines: sectionLines, offset } = extractSection5(planText);
const tables = parseTables(sectionLines);

if (tables.length === 0) {
  console.error(`${PLAN_PATH}: found no table in section 5 — has it moved or been reformatted?`);
  process.exit(1);
}

const problems = [];
for (const table of tables) {
  const standIdx = table.header.length - 1;
  if (table.header[standIdx] !== 'Stand') {
    problems.push(`line ${offset + table.headerLine + 1}: table header has no trailing "Stand" column (${table.header.join(' | ')}).`);
    continue;
  }
  for (const row of table.rows) {
    const fileLine = offset + row.line + 1;
    const value = row.cells[standIdx];
    if (value === undefined || value === '') {
      problems.push(`line ${fileLine}: missing "Stand" value (row: ${row.cells.join(' | ')}).`);
      continue;
    }
    const match = STAND_FORMS.map((f) => ({ ...f, m: value.match(f.re) })).find((f) => f.m);
    if (!match) {
      problems.push(
        `line ${fileLine}: "Stand" value "${value}" matches none of the four allowed forms ` +
          '(läuft (CI: …) / läuft (Hook: …) / läuft (Review: Reviewer-Checkliste) / geplant in Scheibe NNN).',
      );
      continue;
    }
    if (match.kind === 'ci' && !ciStepNames.has(match.m[1])) {
      problems.push(`line ${fileLine}: no CI step named "${match.m[1]}" in ${WORKFLOWS_DIR}/*.yml.`);
    }
    if (match.kind === 'hook' && !hookEvents.has(match.m[1])) {
      problems.push(`line ${fileLine}: no hook event "${match.m[1]}" configured in ${SETTINGS_PATH}.`);
    }
    if (match.kind === 'planned' && !plannedSlices.has(match.m[1])) {
      problems.push(`line ${fileLine}: "${match.m[1]}" is not a slice listed in ${PRODUCT_PLAN_PATH} section 5.`);
    }
    if (match.kind === 'planned' && acceptedSlices.has(match.m[1])) {
      problems.push(
        `line ${fileLine}: "geplant in Scheibe ${match.m[1]}" but ${SLICES_DIR}/${match.m[1]}-*.md already has ` +
          '"**Status:** accepted" — this row should say `läuft`, not `geplant`, by now.',
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`Plan-honesty check failed (${PLAN_PATH}, section 5):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

const rowCount = tables.reduce((n, t) => n + t.rows.length, 0);
console.log(`Plan-honesty check: ${tables.length} table(s), ${rowCount} row(s) in section 5, every "Stand" verified.`);
