#!/usr/bin/env node
/**
 * Writes the current dirty-tree signature (and a timestamp, for humans) to
 * `.claude/state/last-test-run` (gitignored) — what `scripts/hooks/stop-check.mjs` compares against.
 * A clean tree writes a marker too (harmless — `stop-check.mjs` allows a clean tree unconditionally
 * regardless of the marker), so the file is always evidence that "pnpm gates" last ran here, at this
 * exact state. Called as the last step of the root `gates` script (`&&`-chained after every earlier
 * step, so it only ever runs once the whole of `pnpm gates` has already succeeded).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusLines, signatureFor } from './lib/dirty-tree-signature.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function rootFromArgs(argv) {
  const i = argv.indexOf('--root');
  return i === -1 ? DEFAULT_ROOT : argv[i + 1];
}

const root = rootFromArgs(process.argv.slice(2));
const markerPath = join(root, '.claude', 'state', 'last-test-run');

const lines = statusLines(root);
const signature = lines === undefined || lines.length === 0 ? null : signatureFor(root, lines);

mkdirSync(dirname(markerPath), { recursive: true });
writeFileSync(markerPath, JSON.stringify({ timestamp: new Date().toISOString(), signature }));
console.log(`mark-test-run: wrote ${markerPath}${signature ? ` (signature ${signature.slice(0, 12)}…)` : ' (clean tree)'}`);
