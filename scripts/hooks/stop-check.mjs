#!/usr/bin/env node
/**
 * Stop hook (Plan 5.4 "Stop"): refuses to let a session end (exit 2, reason on stderr) if
 * `apps/`, `packages/` or `scripts/` have an uncommitted change (modified, added, deleted or
 * untracked-but-not-ignored) that was not yet present, in exactly that form, at the last successful
 * test run. A run counts as "successful" only via `scripts/hooks/mark-test-run.mjs`, which the root
 * `gates` script calls last (so it only ever runs after every earlier step in `pnpm gates` has already
 * succeeded) and which writes a signature to `.claude/state/last-test-run` (gitignored).
 *
 * Review rework round 1, M2: the first version compared file *mtimes* against the marker's
 * *timestamp* — but a fresh clone, a branch checkout, a merge, or e2e output (e.g.
 * `apps/web/test-results/`) all touch mtimes without any real code change, so the hook blocked a
 * session that had done nothing wrong. This version asks git instead (`scripts/hooks/lib/
 * dirty-tree-signature.mjs`, shared with `mark-test-run.mjs`):
 *   - `git status --porcelain -- apps packages scripts` is the change signal, not mtimes — it already
 *     ignores anything `.gitignore` covers (so generated output like `apps/web/test-results/` or
 *     `playwright-report/` never counts, with no separate ignore-list needed here).
 *   - If that status is empty (a clean tree under those three directories), this hook always allows —
 *     regardless of whether a marker exists at all (a fresh clone/checkout/merge with no working
 *     changes has nothing to prove; a "no marker yet" state is no longer, on its own, a reason to
 *     block).
 *   - If the tree is *not* clean, the change is fingerprinted (path plus content hash of every
 *     changed/untracked file, sorted) into one signature; this hook blocks unless that signature
 *     exactly matches the one `mark-test-run.mjs` recorded — i.e. `pnpm gates` last ran against this
 *     very dirty state, not an earlier one.
 *   - `stop_hook_active: true` in the hook's own stdin JSON (Claude Code sets this while a Stop-family
 *     hook is already retrying) always exits 0 immediately, so this hook can never contribute to a
 *     retry loop.
 *
 * takt-006 point 2: the marker also carries the commit that was `HEAD` when `mark-test-run.mjs` wrote
 * it — a `git commit` made after the last successful test run moves `HEAD` to a commit nothing has
 * actually run "pnpm gates" against yet.
 *
 * takt-006 rework, MAJOR finding 1 (Opus review)/point 4: comparing the commit id alone made this hook
 * block on *any* later commit, even a docs-only one, or one that only formalises code already recorded
 * as tested (`pnpm gates`, then `git commit` the exact tested change) — a commit always moves `HEAD`
 * even when it never touches `apps/`, `packages/` or `scripts/` at all. The marker also carries a tree
 * hash of just those three directories' current content (`codeTreeHash`, unaffected by `docs/` or any
 * other path, and by *how many* commits happened, only by what they actually changed there); a moved
 * `HEAD` only blocks when that hash also differs from what was recorded — i.e. the code itself, not
 * merely the history, changed since the last successful test run.
 *
 * Wired in `.claude/settings.json` under `hooks.Stop`. `--root <dir>` points it at a scratch git
 * repository in tests, in place of this one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusLines, signatureFor, headCommit, codeTreeHash } from './lib/dirty-tree-signature.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const MARKER_REL_PATH = join('.claude', 'state', 'last-test-run');

function readStdinJson() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    raw = '';
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const out = { root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
  }
  return out;
}

/** The marker's recorded `{ signature, commit, treeHash }` — all `undefined` if the marker is missing
 * or unparsable (treated the same as "no marker" by the caller). */
function readMarker(markerPath) {
  if (!existsSync(markerPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf8'));
    return { signature: parsed.signature, commit: parsed.commit ?? undefined, treeHash: parsed.treeHash ?? undefined };
  } catch {
    return undefined;
  }
}

function main(argv) {
  const input = readStdinJson();
  if (input?.stop_hook_active === true) return 0; // already retrying — never contribute to a loop

  const args = parseArgs(argv);
  const lines = statusLines(args.root);
  if (lines === undefined) return 0; // git unavailable — fail open, this hook cannot judge anything

  const markerPath = join(args.root, MARKER_REL_PATH);
  const marker = readMarker(markerPath);
  const currentCommit = headCommit(args.root);

  // takt-006 point 2, reworked at rework point 4: a commit made after the last successful test run
  // (HEAD has moved away from what the marker vouches for) is only a *reason to look closer*, not an
  // automatic block — only checked when both sides of the commit comparison are actually known, so "no
  // marker yet"/"no commits yet" never fires this on their own (those are the existing, narrower checks
  // below). Whether it actually blocks depends on the code-directory tree hash just below.
  if (marker?.commit && currentCommit && marker.commit !== currentCommit) {
    const currentTreeHash = codeTreeHash(args.root);
    if (marker.treeHash && currentTreeHash && marker.treeHash !== currentTreeHash) {
      console.error(
        'Stop blocked (Plan 5.4): a commit was made after the last successful test run ' +
          `(HEAD moved from ${marker.commit.slice(0, 7)} to ${currentCommit.slice(0, 7)}) and apps/, packages/ ` +
          'or scripts/ changed as a result — that code was never tested. Run "pnpm gates" again.',
      );
      return 2;
    }
    // HEAD moved, but apps/, packages/ and scripts/ are byte-for-byte what they were when last tested
    // (a docs-only commit, or a commit that only formalises the exact change "pnpm gates" already ran
    // against) — nothing new to test, fall through to the ordinary checks below.
  }

  if (lines.length === 0) {
    console.log('Stop check: apps/, packages/ and scripts/ have no uncommitted change.');
    return 0; // a clean tree (and HEAD unmoved since the marker, checked above) is safe to stop from
  }

  const signature = signatureFor(args.root, lines);
  if (marker === undefined) {
    console.error(
      `Stop blocked (Plan 5.4): apps/, packages/ or scripts/ have an uncommitted change and no successful ` +
        `test run is recorded yet (${MARKER_REL_PATH} is missing). Run "pnpm gates" (it writes the marker on ` +
        `success) before stopping. Changed: ${lines.map((l) => l.slice(3)).join(', ')}.`,
    );
    return 2;
  }

  if (marker.signature !== signature) {
    console.error(
      'Stop blocked (Plan 5.4): apps/, packages/ or scripts/ changed after the last successful test run ' +
        `(the dirty-tree signature no longer matches). Changed: ${lines.map((l) => l.slice(3)).join(', ')}. ` +
        'Run "pnpm gates" again.',
    );
    return 2;
  }

  console.log('Stop check: the current uncommitted change matches the one "pnpm gates" last ran against.');
  return 0;
}

process.exit(main(process.argv.slice(2)));
