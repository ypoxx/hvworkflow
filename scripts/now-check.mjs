#!/usr/bin/env node
/**
 * Time comes from the clock injected into the API, never from the system clock read directly in
 * domain or server code (AGENTS.md rule 8). Flags `Date.now(`, a bare `new Date()` (no argument —
 * `new Date(x)` reconstructing a stored timestamp is fine) and `performance.now(` in
 * `packages/domain/src` and `apps/api/src` (tests excluded: fixed-clock tests legitimately build
 * fixed dates). A line survives only with a trailing `// now-ok: <reason>` comment.
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

// `new Date()` only — `new Date(anything)` reconstructs a stored ISO string and is not a clock read.
const PATTERNS = [/Date\.now\(/, /new Date\(\s*\)/, /performance\.now\(/];
const NOW_OK = /\/\/\s*now-ok:\s*\S/;

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

const findings = [];
for (const root of SCAN_ROOTS) {
  for (const absFile of collectTsFiles(root)) {
    const rel = relative(ROOT, absFile).split('\\').join('/');
    if (isTestFile(rel)) continue;
    const lines = readFileSync(absFile, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      if (PATTERNS.some((p) => p.test(line)) && !NOW_OK.test(line)) {
        findings.push({ file: rel, line: idx + 1, text: line.trim() });
      }
    });
  }
}

if (findings.length > 0) {
  console.error('now() check failed (AGENTS.md rule 8): direct system-clock access outside the injected clock.');
  for (const f of findings) console.error(`  ${f.file}:${f.line}: ${f.text}`);
  console.error(
    '\nUse the clock injected into createInProcessApi (packages/domain/src/api.ts), or, if this really ' +
      'is the injection point itself, mark the line `// now-ok: <reason>`.',
  );
  process.exit(1);
}

console.log(`now() check: no direct system-clock access outside the injected clock (${SCAN_ROOTS.join(', ')}).`);
