#!/usr/bin/env node
/**
 * Writes the current dirty-tree signature (and a timestamp, for humans) to
 * `.claude/state/last-test-run` (gitignored) — what `scripts/hooks/stop-check.mjs` compares against.
 * A clean tree writes a marker too (harmless — `stop-check.mjs` allows a clean tree unconditionally as
 * long as the recorded commit still matches `HEAD`), so the file is always evidence that "pnpm gates"
 * last ran here, at this exact state. Called as the last step of the root `gates` script (`&&`-chained
 * after every earlier step, so it only ever runs once the whole of `pnpm gates` has already succeeded).
 *
 * takt-006 point 2: also records `git rev-parse HEAD` (`commit`, `null` if unavailable) — a `git
 * commit` made after this marker was written moves `HEAD` away from what the marker vouches for.
 *
 * takt-006 rework, MAJOR finding 1 (Opus review)/point 4: `commit` alone made `stop-check.mjs` block on
 * *any* later commit, even a docs-only one — also records a tree hash of just `apps/`, `packages/` and
 * `scripts/` (`treeHash`, `null` if unavailable); `stop-check.mjs` uses `commit` only to notice that
 * something happened, and `treeHash` to decide whether it actually matters (see there).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusLines, signatureFor, headCommit, codeTreeHash } from './lib/dirty-tree-signature.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function rootFromArgs(argv) {
  const i = argv.indexOf('--root');
  return i === -1 ? DEFAULT_ROOT : argv[i + 1];
}

const root = rootFromArgs(process.argv.slice(2));
const markerPath = join(root, '.claude', 'state', 'last-test-run');

const lines = statusLines(root);
const signature = lines === undefined || lines.length === 0 ? null : signatureFor(root, lines);
const commit = headCommit(root) ?? null;
const treeHash = codeTreeHash(root) ?? null;

mkdirSync(dirname(markerPath), { recursive: true });
writeFileSync(markerPath, JSON.stringify({ timestamp: new Date().toISOString(), signature, commit, treeHash }));
console.log(
  `mark-test-run: wrote ${markerPath}${signature ? ` (signature ${signature.slice(0, 12)}…)` : ' (clean tree)'}` +
    `${commit ? ` at commit ${commit.slice(0, 7)}` : ''}${treeHash ? `, tree ${treeHash.slice(0, 12)}…` : ''}`,
);
