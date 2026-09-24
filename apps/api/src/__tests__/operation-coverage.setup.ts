/**
 * Operation-coverage gate (slice 023, goal 5; ADR 0015): after the whole API test suite has run,
 * every `operationId` in `packages/contract/openapi.yaml` must either have been exercised by a
 * test — a call through `req()` in `helpers.ts`, matched by `matchOperationId` — or be pre-declared
 * in `packages/contract/allowlist.json` (with an expiry date, checked by the contract gate
 * `packages/contract/scripts/check.mjs`). An allowlist entry that *is* exercised is overdue and must
 * be removed. Before this gate, `contract.test.ts` only asserted `allOperationIds.length >= 29`.
 *
 * Why a Vitest `globalSetup` and a directory of hit files: Vitest isolates every test file in its own
 * worker (module state in `helpers.ts` only ever sees one file's hits), while `setup`/`teardown` here
 * run once, in the main process, around all files. `setup` creates a temporary directory and hands
 * its path to the workers through `project.provide()`; `req()` appends every matched `operationId`
 * to a per-process file in it (`inject()` in `helpers.ts`); `teardown` folds the files and judges.
 *
 * Why `process.exitCode = 1` and not only `throw`: Vitest catches a teardown error, logs it as
 * "error during close" and still exits 0 — that would be a report, not a gate.
 *
 * Skipped (with a printed note, never silently) when a test failed (that failure is the finding;
 * the run is already red) or when the run was filtered (`vitest run negative`): a partial run cannot
 * prove coverage. `pnpm --filter @hv/api test` (= `vitest run`, what `pnpm gates` runs) is a full run.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestProject } from 'vitest/node';
import { allOperationIds } from '../contractSchema.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Directory the workers append their hit files to (`helpers.ts`); created in `setup`. */
    operationCoverageDir: string;
  }
}

interface AllowlistEntry {
  operationId: string;
  reason: string;
  slice: string;
  expires: string;
}

let project: TestProject | undefined;
let coverageDir: string | undefined;

export function setup(current: TestProject): void {
  project = current;
  coverageDir = mkdtempSync(join(tmpdir(), 'hv-operation-coverage-'));
  current.provide('operationCoverageDir', coverageDir);
}

function readAllowlist(): AllowlistEntry[] {
  const require = createRequire(import.meta.url);
  const contractPath = require.resolve('@hv/contract/openapi.yaml');
  return JSON.parse(readFileSync(join(dirname(contractPath), 'allowlist.json'), 'utf8')) as AllowlistEntry[];
}

function collectHits(dir: string): Set<string> {
  const hits = new Set<string>();
  for (const file of readdirSync(dir)) {
    for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
      if (line !== '') hits.add(line);
    }
  }
  return hits;
}

const log = (line: string): void => console.log(`operation-coverage: ${line}`);

export async function teardown(): Promise<void> {
  if (project === undefined || coverageDir === undefined) return;
  const hits = collectHits(coverageDir);
  rmSync(coverageDir, { recursive: true, force: true });

  const ranFiles = project.vitest.state.getFiles();
  if (ranFiles.some((f) => f.result?.state === 'fail')) {
    log('skipped — a test failed; fix that first (the run is already red).');
    return;
  }
  const { testFiles } = await project.globTestFiles();
  if (ranFiles.length < testFiles.length) {
    log(`skipped — filtered run (${ranFiles.length} of ${testFiles.length} test files); only a full run proves coverage.`);
    return;
  }

  const allowlist = readAllowlist();
  const allowed = new Set(allowlist.map((e) => e.operationId));
  const missing = allOperationIds.filter((id) => !hits.has(id) && !allowed.has(id));
  const overdue = allowlist.filter((e) => hits.has(e.operationId));

  log(
    `${allOperationIds.length} operations in the contract, ${hits.size} exercised by tests, ` +
      `${allowlist.length} pre-declared in allowlist.json`,
  );
  if (missing.length === 0 && overdue.length === 0) {
    log('ok — every operationId is exercised by a test or pre-declared in the allowlist.');
    return;
  }
  const lines: string[] = [];
  for (const id of missing) {
    lines.push(
      `  FAIL  "${id}" is neither exercised by a test (no req() call reaches it) nor pre-declared in ` +
        'packages/contract/allowlist.json — add a test or an allowlist entry with an expiry date (ADR 0015).',
    );
  }
  for (const e of overdue) {
    lines.push(
      `  FAIL  "${e.operationId}" is pre-declared in allowlist.json (slice ${e.slice}, expires ${e.expires}) ` +
        'but a test exercises it — the entry is overdue, remove it.',
    );
  }
  for (const line of lines) console.error(line);
  console.error(`operation-coverage: ${lines.length} failure(s)`);
  process.exitCode = 1;
  throw new Error(`operation-coverage gate: ${lines.length} failure(s) (see above)`);
}
