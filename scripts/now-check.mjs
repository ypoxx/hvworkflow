#!/usr/bin/env node
/**
 * Time comes from the clock injected into the API, never from the system clock read directly in
 * domain or server code (AGENTS.md rule 8). Flags, over the whole file text (so a match split across
 * lines is still caught): `Date.now(`, `Date['now']()`, a bare `new Date()` / `new Date(\n)` (no
 * argument — `new Date(x)` reconstructing a stored timestamp is fine), a bare `new Date` with no
 * parentheses at all, `Date()` called as a plain function, `performance.now(`, `performance['now']()`,
 * `process.hrtime(` and `process.hrtime.bigint(` (round 2, minor 7: the bracket and `.bigint(` forms
 * were the two remaining gaps after round 1's rework). Tests are excluded (fixed-clock tests
 * legitimately build fixed dates).
 *
 * Review rework (round 1, major 3): a `// now-ok: <reason>` comment only ever excuses a match in
 * `packages/domain/src/api.ts` (the default-clock injection point, at most once) or
 * `apps/api/src/server.ts` (where a real process may wire a clock) — a `now-ok` anywhere else is
 * itself a finding, not a silent bypass, and a second one in `api.ts` is a finding too.
 *
 * Run as part of `pnpm gates` (`pnpm now-check`). Deterministic, no network.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const SCAN_ROOTS = ['packages/domain/src', 'apps/api/src'];
const isTestFile = (relPath) => relPath.includes('/__tests__/') || relPath.endsWith('.test.ts');

const NOW_OK_ALLOWED_FILES = new Set(['packages/domain/src/api.ts', 'apps/api/src/server.ts']);
const NOW_OK_CAP = new Map([['packages/domain/src/api.ts', 1]]);
const NOW_OK_RE = /\/\/\s*now-ok:\s*\S/g;

// Each needs its own `g`-flagged instance per file (regex objects carry `lastIndex` state).
function buildPatterns() {
  return [
    { name: 'Date.now(', re: /Date\.now\(/g },
    { name: "Date['now']()", re: /Date\[\s*['"`]now['"`]\s*\]\s*\(/g },
    { name: 'new Date() / new Date(\\n)', re: /new\s+Date\s*\(\s*\)/g },
    { name: 'new Date (no parentheses)', re: /new\s+Date\b(?!\s*\()/g },
    { name: 'Date() called as a function', re: /(?<!new\s+)\bDate\s*\(\s*\)/g },
    { name: 'performance.now(', re: /performance\.now\(/g },
    { name: "performance['now']()", re: /performance\[\s*['"`]now['"`]\s*\]\s*\(/g },
    { name: 'process.hrtime(', re: /process\.hrtime\(/g },
    // Review rework round 2, minor 7: process.hrtime's own bigint variant.
    { name: 'process.hrtime.bigint(', re: /process\.hrtime\.bigint\(/g },
  ];
}

function collectTsFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith('.ts')) out.push(full);
    }
  };
  walk(join(ROOT, root));
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
function snippet(text, index) {
  const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1);
  const end = text.indexOf('\n', index) === -1 ? text.length : text.indexOf('\n', index);
  return text.slice(start, end).trim();
}
/** The text spanning every physical line a match touches (start line through end line), so a
 * trailing `// now-ok:` on a multi-line match's last line still counts as "the same line". */
function matchLines(text, start, end) {
  const from = Math.max(0, text.lastIndexOf('\n', start - 1) + 1);
  const to = text.indexOf('\n', end) === -1 ? text.length : text.indexOf('\n', end);
  return text.slice(from, to);
}

const dateFindings = [];
const nowOkMisplaced = [];
const nowOkOverCap = [];

for (const root of SCAN_ROOTS) {
  for (const absFile of collectTsFiles(root)) {
    const rel = relative(ROOT, absFile).split('\\').join('/');
    if (isTestFile(rel)) continue;
    const text = readFileSync(absFile, 'utf8');

    // 1. Every `now-ok` comment: allowed only in the two named files, and at most once in api.ts.
    const allowedHere = NOW_OK_ALLOWED_FILES.has(rel);
    const cap = NOW_OK_CAP.get(rel);
    let nowOkCount = 0;
    let hit;
    const nowOkRe = new RegExp(NOW_OK_RE.source, 'g');
    while ((hit = nowOkRe.exec(text))) {
      nowOkCount++;
      if (!allowedHere) {
        nowOkMisplaced.push({ file: rel, line: lineOf(text, hit.index), text: snippet(text, hit.index) });
      } else if (cap !== undefined && nowOkCount > cap) {
        nowOkOverCap.push({ file: rel, line: lineOf(text, hit.index), text: snippet(text, hit.index) });
      }
    }

    // 2. Every direct clock/timer access, suppressed only when `now-ok` covers the same line(s) *and*
    // the file is one where `now-ok` is actually honoured (a misplaced `now-ok` never suppresses).
    for (const { re } of buildPatterns()) {
      let m;
      while ((m = re.exec(text))) {
        const span = matchLines(text, m.index, m.index + m[0].length);
        const suppressed = allowedHere && /\/\/\s*now-ok:\s*\S/.test(span);
        if (!suppressed) dateFindings.push({ file: rel, line: lineOf(text, m.index), text: snippet(text, m.index) });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
  }
}

let failed = false;
if (dateFindings.length > 0) {
  failed = true;
  console.error('now() check failed (AGENTS.md rule 8): direct system-clock access outside the injected clock.');
  for (const f of dateFindings) console.error(`  ${f.file}:${f.line}: ${f.text}`);
  console.error(
    '\nUse the clock injected into createInProcessApi (packages/domain/src/api.ts), or, if this really ' +
      'is the injection point itself, mark the line `// now-ok: <reason>` (only honoured in ' +
      `${[...NOW_OK_ALLOWED_FILES].join(' and ')}).`,
  );
}
if (nowOkMisplaced.length > 0) {
  failed = true;
  console.error(`\n\`now-ok\` is only honoured in ${[...NOW_OK_ALLOWED_FILES].join(' and ')}; found it elsewhere:`);
  for (const f of nowOkMisplaced) console.error(`  ${f.file}:${f.line}: ${f.text}`);
}
if (nowOkOverCap.length > 0) {
  failed = true;
  console.error('\nAt most one `now-ok` is allowed in packages/domain/src/api.ts (the default-clock injection point); extra occurrence(s):');
  for (const f of nowOkOverCap) console.error(`  ${f.file}:${f.line}: ${f.text}`);
}

if (failed) process.exit(1);

console.log(`now() check: no direct system-clock access outside the injected clock (${SCAN_ROOTS.join(', ')}).`);
