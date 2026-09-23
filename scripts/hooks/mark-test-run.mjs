#!/usr/bin/env node
/**
 * Writes the current time to `.claude/state/last-test-run` (gitignored) — the timestamp
 * `scripts/hooks/stop-check.mjs` compares code file mtimes against. Called as the last step of the
 * root `gates` script (`&&`-chained after every earlier step, so it only ever runs once the whole of
 * `pnpm gates` has already succeeded).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

function rootFromArgs(argv) {
  const i = argv.indexOf('--root');
  return i === -1 ? DEFAULT_ROOT : argv[i + 1];
}

const root = rootFromArgs(process.argv.slice(2));
const markerPath = join(root, '.claude', 'state', 'last-test-run');

mkdirSync(dirname(markerPath), { recursive: true });
writeFileSync(markerPath, new Date().toISOString());
console.log(`mark-test-run: wrote ${markerPath}`);
