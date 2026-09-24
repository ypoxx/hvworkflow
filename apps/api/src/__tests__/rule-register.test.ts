/**
 * "Every rule id has a legalRef and at least one test" (slice 011), the file-scanning half
 * (Festlegung 3 of docs/slices/011-legal-trace-regelregister.md). This lives under `apps/api` and not
 * under `packages/domain` because it reads source files with `node:fs`, and the domain must never
 * import a Node core module, not even in a test (`arch`, rule `domain-no-node-core-modules`).
 *
 * Three checks:
 *   1. Every rule id mentioned anywhere in `packages/domain/src/**\/*.ts` or `apps/api/src/**\/*.ts`
 *      (excluding `__tests__` *and* `rules.ts` itself) is a member of `ruleRegister()` (`@hv/domain`)
 *      — an id used in production code without a register entry is a red run.
 *   2. Every register entry corresponds to a rule id still used somewhere in that same scan — a
 *      register entry with no matching code is a stale entry (rework after Codex's P2 on PR #24:
 *      `rules.ts` is excluded from the scan on *both* sides of this check, because it lists every
 *      register id as a literal by construction and would otherwise make a stale entry unfindable —
 *      every id in `OTHER_RULES` still has to show up elsewhere, e.g. `R-TRANS-00` in
 *      `resolveTransition()`, `R-PERM-01..03` in `permissions.ts`/`api.ts`, `R-IDEM-01` in the
 *      `api.ts` doc comment it names).
 *   3. Every register entry either is a `TRANSITIONS` row (its own generated test in
 *      `transitions.test.ts`), a guard (its own generated test, same file), or its id appears
 *      literally in some `*.test.ts` file under `packages/domain/src/__tests__/` or
 *      `apps/api/src/__tests__/` — "has a test" per Festlegung 3.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ruleRegister, TRANSITIONS } from '@hv/domain';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

const RULE_ID_RE = /\bR-[A-Z]+-\d{2,}\b/g;

/** Every `.ts` file under `root` (relative to the repo root), depth-first, optionally excluding any
 * path segment named `__tests__` and/or any of `excludePaths` (repository-relative). */
function collectTsFiles(
  root: string,
  { excludeTests, excludePaths = [] }: { excludeTests: boolean; excludePaths?: readonly string[] },
): string[] {
  // Full repository-relative paths, not basenames: a future `rules.ts` in a subfolder must still be
  // scanned (Legal recheck, nit).
  const excluded = new Set(excludePaths.map((p) => join(ROOT, p)));
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (excludeTests && entry === '__tests__') continue;
      const full = join(dir, entry);
      if (excluded.has(full)) continue;
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith('.ts')) out.push(full);
    }
  };
  walk(join(ROOT, root));
  return out;
}

function ruleIdsIn(files: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(RULE_ID_RE)) ids.add(m[0]);
  }
  return ids;
}

describe('rule register', () => {
  // `rules.ts` is excluded here (Codex P2, PR #24): it lists every register id as a literal by
  // construction, so leaving it in would make check 2 (stale register entry) vacuously pass no
  // matter what — every id would always "be found in code" via its own register entry.
  const productionFiles = [
    ...collectTsFiles('packages/domain/src', { excludeTests: true, excludePaths: ['packages/domain/src/rules.ts'] }),
    ...collectTsFiles('apps/api/src', { excludeTests: true }),
  ];
  // The two meta-tests about the register itself are excluded too (Codex P2, PR #24): they name rule
  // ids in comments and in the snapshot of docs/legal-trace.md, so counting them would let "every
  // register entry has at least one test" pass with no real test behind an id.
  const testFiles = [
    ...collectTsFiles('packages/domain/src/__tests__', {
      excludeTests: false,
      excludePaths: ['packages/domain/src/__tests__/rules.test.ts'],
    }),
    ...collectTsFiles('apps/api/src/__tests__', {
      excludeTests: false,
      excludePaths: ['apps/api/src/__tests__/rule-register.test.ts'],
    }),
  ];

  const entries = ruleRegister();
  const registerIds = new Set(entries.map((e) => e.ruleId));
  const idsInProductionCode = ruleIdsIn(productionFiles);
  const idsInTests = ruleIdsIn(testFiles);
  const transitionRowIds = new Set(TRANSITIONS.map((t) => t.ruleId));
  const guardIds = new Set(TRANSITIONS.flatMap((t) => (t.guards ?? []).map((g) => g.ruleId)));

  it('every rule id used in production code has a register entry', () => {
    const missing = [...idsInProductionCode].filter((id) => !registerIds.has(id));
    expect(missing, `rule id(s) used in code without a ruleRegister() entry: ${missing.join(', ')}`).toEqual([]);
  });

  it('every register entry corresponds to a rule id actually used in production code (no stale entries, rules.ts excluded from the scan)', () => {
    const stale = [...registerIds].filter((id) => !idsInProductionCode.has(id));
    expect(stale, `register entry(ies) with no matching production code (stale): ${stale.join(', ')}`).toEqual([]);
  });

  it('every register entry has a legalRef', () => {
    const withoutLegalRef = entries.filter((e) => !e.legalRef).map((e) => e.ruleId);
    expect(withoutLegalRef).toEqual([]);
  });

  it('no register entry is verified', () => {
    const verified = entries.filter((e) => e.legalRef.verified !== false).map((e) => e.ruleId);
    expect(verified).toEqual([]);
  });

  it('every register entry has at least one test (transition row, guard, or literal rule id in a test file)', () => {
    const untested = entries
      .filter((e) => !transitionRowIds.has(e.ruleId) && !guardIds.has(e.ruleId) && !idsInTests.has(e.ruleId))
      .map((e) => e.ruleId);
    expect(untested, `rule id(s) with no test: ${untested.join(', ')}`).toEqual([]);
  });

  it('prints the honest count', () => {
    const withLegalRef = entries.filter((e) => e.legalRef).length;
    const verifiedCount = entries.filter((e) => e.legalRef.verified).length;
    // eslint-disable-next-line no-console -- this line is the evidence the slice's report quotes.
    console.log(`${entries.length} Regel-IDs, ${withLegalRef} legalRef, ${verifiedCount} verified`);
    expect(withLegalRef).toBe(entries.length);
    expect(verifiedCount).toBe(0);
  });
});
