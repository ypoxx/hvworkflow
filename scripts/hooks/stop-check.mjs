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
 * it; this hook now blocks whenever the current `HEAD` no longer matches that recorded commit, even if
 * the tree is clean again — a `git commit` made after the last successful test run moves `HEAD` to a
 * commit nothing has actually run "pnpm gates" against yet (it may fold in a further, untested edit;
 * it may not, but a formatting/normalisation step during the commit could still have changed a byte
 * since the tested state), so "clean tree" alone is no longer, on its own, proof enough.
 *
 * Wired in `.claude/settings.json` under `hooks.Stop`. `--root <dir>` points it at a scratch git
 * repository in tests, in place of this one.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statusLines, signatureFor, headCommit } from './lib/dirty-tree-signature.mjs';

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

/** The marker's recorded `{ signature, commit }` — both `undefined` if the marker is missing or
 * unparsable (treated the same as "no marker" by the caller). */
function readMarker(markerPath) {
  if (!existsSync(markerPath)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(markerPath, 'utf8'));
    return { signature: parsed.signature, commit: parsed.commit ?? undefined };
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

  // takt-006 point 2: whatever the tree looks like, a commit made after the last successful test run
  // (HEAD has moved away from what the marker itself vouches for) still needs a fresh "pnpm gates" —
  // only checked when both sides of the comparison are actually known, so "no marker yet"/"no commits
  // yet" never fires this on their own (those are the existing, narrower checks below).
  if (marker?.commit && currentCommit && marker.commit !== currentCommit) {
    console.error(
      'Stop blocked (Plan 5.4): a commit was made after the last successful test run ' +
        `(HEAD moved from ${marker.commit.slice(0, 7)} to ${currentCommit.slice(0, 7)}) — the commit itself was ` +
        'never tested. Run "pnpm gates" again.',
    );
    return 2;
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
