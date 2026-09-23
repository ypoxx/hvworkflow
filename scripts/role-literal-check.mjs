#!/usr/bin/env node
/**
 * Rights are data (AGENTS.md rule 4): the only place a `Role` name may appear as a string literal is
 * `ROLE_PERMISSIONS` (`packages/domain/src/permissions.ts`) and the synthetic actors of the demo
 * corpus (`packages/domain/src/seed.ts`). This gate scans `apps/api/src` and `packages/domain/src`
 * for a role name used in a *role context* — an object property `role: '<role>'`, a comparison
 * `<expr>.role === '<role>'` (or `!==`/`==`/`!=`, either operand order), a bare `role === '<role>'`
 * on a destructured variable, or a `case '<role>':` inside a `switch` whose expression mentions
 * `role`.
 *
 * Deliberately narrow: `podium`, `expert` and `legal` are also `Track`/`StageAssignment` values
 * (docs/slices/012-architektur-sicherheitstore.md); a bare `track === 'podium'` must not be a finding,
 * so every pattern below requires the literal keyword `role` next to the comparison, never just the
 * value.
 *
 * Run as part of `pnpm gates` (`pnpm role-literals`). Deterministic, no network.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const ROLE_NAMES = ['admin', 'moderation', 'capture', 'expert', 'legal', 'approver', 'podium', 'observer'];
const ROLE_ALT = ROLE_NAMES.join('|');
const SCAN_ROOTS = ['apps/api/src', 'packages/domain/src'];
const EXCLUDED_FILES = new Set([
  'packages/domain/src/permissions.ts', // ROLE_PERMISSIONS: the one decision point (AGENTS.md rule 4)
  'packages/domain/src/seed.ts', // synthetic actors of the demo corpus (data, not policy)
]);

const isTestFile = (relPath) => relPath.includes('/__tests__/') || relPath.endsWith('.test.ts');

const DIRECT_PATTERNS = [
  // role: 'admin' (object literal property, incl. shorthand-adjacent forms)
  new RegExp(`\\brole\\s*:\\s*['"](${ROLE_ALT})['"]`),
  // actor.role === 'admin' / actor.role !== 'admin' / == / !=
  new RegExp(`\\.role\\s*(?:===|!==|==|!=)\\s*['"](${ROLE_ALT})['"]`),
  // 'admin' === actor.role (reversed operand order)
  new RegExp(`['"](${ROLE_ALT})['"]\\s*(?:===|!==|==|!=)\\s*[\\w.]*\\.role\\b`),
  // bare `role === 'admin'` (destructured `{ role }`)
  new RegExp(`\\brole\\s*(?:===|!==|==|!=)\\s*['"](${ROLE_ALT})['"]`),
  // 'admin' === role (reversed, destructured)
  new RegExp(`['"](${ROLE_ALT})['"]\\s*(?:===|!==|==|!=)\\s*\\brole\\b`),
];

/** [startLine, endLine] (0-based, inclusive) of every `switch (...)` block whose expression mentions
 * `role`, found by brace-depth counting from the `switch` line onward. */
function switchOverRoleRanges(lines) {
  const ranges = [];
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].match(/switch\s*\(([^)]*)\)/);
    if (!header || !/\brole\b/.test(header[1])) continue;
    let depth = 0;
    let started = false;
    let end = lines.length - 1;
    outer: for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') {
          depth++;
          started = true;
        } else if (ch === '}') {
          depth--;
          if (started && depth === 0) {
            end = j;
            break outer;
          }
        }
      }
    }
    ranges.push([i, end]);
  }
  return ranges;
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

const findings = [];
for (const root of SCAN_ROOTS) {
  for (const absFile of collectTsFiles(root)) {
    const rel = relative(ROOT, absFile).split('\\').join('/');
    if (EXCLUDED_FILES.has(rel) || isTestFile(rel)) continue;
    const lines = readFileSync(absFile, 'utf8').split('\n');

    lines.forEach((line, idx) => {
      if (DIRECT_PATTERNS.some((p) => p.test(line))) {
        findings.push({ file: rel, line: idx + 1, text: line.trim() });
      }
    });

    const caseRe = new RegExp(`case\\s*['"](${ROLE_ALT})['"]\\s*:`);
    for (const [start, end] of switchOverRoleRanges(lines)) {
      for (let j = start + 1; j <= end; j++) {
        if (caseRe.test(lines[j])) findings.push({ file: rel, line: j + 1, text: lines[j].trim() });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Role-literal check failed (AGENTS.md rule 4): a role name is used as a literal outside the policy layer.');
  for (const f of findings) console.error(`  ${f.file}:${f.line}: ${f.text}`);
  console.error(
    `\nMove the decision into packages/domain/src/permissions.ts (ROLE_PERMISSIONS) or packages/domain/src/api.ts (can()); ` +
      'a role name may only appear there, in seed.ts (demo corpus data) or in a test file.',
  );
  process.exit(1);
}

console.log(`Role-literal check: no role-name literal outside the policy layer (${SCAN_ROOTS.join(', ')}).`);
