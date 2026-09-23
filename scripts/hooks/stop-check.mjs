#!/usr/bin/env node
/**
 * Stop hook (Plan 5.4 "Stop"): refuses to let a session end (exit 2, reason on stderr) if code under
 * `apps/`, `packages/` or `scripts/` (never `docs/`, never any `*.md` file, wherever it lives) has
 * changed more recently than the last successful test run. A run counts as "successful" only via
 * `scripts/hooks/mark-test-run.mjs`, which the root `gates` script calls last (so it only ever runs
 * after every earlier step in `pnpm gates` has already succeeded) and which writes an ISO timestamp
 * to `.claude/state/last-test-run` (gitignored — a fresh clone or worktree has none yet, which this
 * hook treats the same as "definitely older than any code": no proof of a younger run, no stop).
 * Without any code file at all under those three directories, or with no code newer than the marker,
 * the hook never blocks — a documentation-only session, or the orchestrator's own day-report session,
 * may always stop (the slice's "Ohne Codeänderung blockiert der Hook nie").
 *
 * Wired in `.claude/settings.json` under `hooks.Stop`. It reads no meaningful fields from the Claude
 * Code hook JSON on stdin (stdin is drained and ignored, so piping the real payload never hurts);
 * `--root <dir>` points it at a scratch tree in tests, in place of this repository.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CODE_DIRS = ['apps', 'packages', 'scripts'];
const IGNORED_DIR_NAMES = new Set(['node_modules', 'dist', 'coverage', '.turbo', '.git']);
const MARKER_REL_PATH = join('.claude', 'state', 'last-test-run');

function drainStdin() {
  try {
    readFileSync(0, 'utf8');
  } catch {
    // no stdin piped in — fine, this hook does not need it.
  }
}

function parseArgs(argv) {
  const out = { root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
  }
  return out;
}

/** The most recently modified non-`.md` file under `apps/`, `packages/`, `scripts/` — or `undefined`
 * if none of those three directories contain any (a docs-only worktree, or one with only `.md` files
 * in them, e.g. `packages/domain/policy-truth-table.md`). */
function newestCodeFile(root) {
  let newest;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && !/\.md$/i.test(entry.name)) {
        const mtime = statSync(full).mtimeMs;
        if (!newest || mtime > newest.mtime) newest = { path: full, mtime };
      }
    }
  };
  for (const dir of CODE_DIRS) {
    const abs = join(root, dir);
    if (existsSync(abs)) walk(abs);
  }
  return newest;
}

function main(argv) {
  drainStdin();
  const args = parseArgs(argv);
  const newest = newestCodeFile(args.root);
  if (!newest) return 0; // no code at all under apps/, packages/, scripts/ — never blocks

  const markerPath = join(args.root, MARKER_REL_PATH);
  if (!existsSync(markerPath)) {
    console.error(
      `Stop blocked (Plan 5.4): no successful test run recorded yet (${MARKER_REL_PATH} is missing). ` +
        `Run "pnpm gates" (it writes the marker on success) before stopping. Newest code file: ${newest.path}.`,
    );
    return 2;
  }
  const markerTime = Date.parse(readFileSync(markerPath, 'utf8').trim());
  if (Number.isNaN(markerTime) || newest.mtime > markerTime) {
    console.error(
      'Stop blocked (Plan 5.4): code changed after the last successful test run. Newest code file: ' +
        `${newest.path} (mtime ${new Date(newest.mtime).toISOString()}); last test run: ` +
        `${Number.isNaN(markerTime) ? 'unreadable timestamp' : new Date(markerTime).toISOString()}. Run "pnpm gates" again.`,
    );
    return 2;
  }
  console.log(`Stop check: no code change since the last successful test run (${new Date(markerTime).toISOString()}).`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
