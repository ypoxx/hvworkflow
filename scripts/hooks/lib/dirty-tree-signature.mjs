/**
 * Shared by `scripts/hooks/stop-check.mjs` and `scripts/hooks/mark-test-run.mjs` (review rework round
 * 1, M2): a content-addressable signature of whatever is currently uncommitted (modified, added,
 * deleted, or untracked-but-not-ignored) under `apps/`, `packages/`, `scripts/`. Built from
 * `git status --porcelain`, which already respects `.gitignore` — a file under e.g.
 * `apps/web/test-results/` never appears here, no separate ignore-list needed.
 *
 * Codex review PR #14, C2: plain `git status --porcelain` collapses a wholly untracked directory into
 * one line, `?? dir/` — hashing that "file" always fails (it is a directory) and falls back to the
 * constant `'absent'`, so any further edit *inside* that still-untracked directory never changes the
 * signature at all, and the Stop hook would then let an untested change through as long as it lives
 * inside a brand-new directory nothing has been added from yet. `--untracked-files=all` makes git list
 * every file inside a new directory individually instead of the directory itself; `-z` (NUL-separated
 * records, no quoting/escaping of unusual filenames) is parsed explicitly below rather than relying on
 * newline-per-line output.
 *
 * takt-006 rework, NIT finding 8: a rename/copy can be reported on either side — `status[0]` (staged,
 * relative to `HEAD`) *or* `status[1]` (an unstaged, worktree-side rename, which git only detects once
 * the new path is at least known to it, e.g. via `git add -N`) — either one pairs the record with a
 * second, NUL-separated "from" path that must be consumed, not misread as an unrelated status line.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CODE_DIRS = ['apps', 'packages', 'scripts'];

function git(root, args, env = process.env) {
  return execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The commit currently at `HEAD` — `undefined` if git is unavailable or there is no commit yet (both
 * callers fail open on that, same as `statusLines`). takt-006 point 2: recorded by `mark-test-run.mjs`
 * alongside the dirty-tree signature, and compared by `stop-check.mjs` against the *current* `HEAD` —
 * a `git commit` after the last successful test run moves `HEAD` to a commit that was never actually
 * tested (whatever the tree looked like at test time, the commit may fold in a further, untested edit,
 * or a formatting/normalisation step during the commit itself), and a clean tree alone can no longer
 * tell the two situations apart. */
export function headCommit(root) {
  try {
    return git(root, ['rev-parse', 'HEAD']).trim();
  } catch {
    return undefined;
  }
}

/** A `git` tree-object hash of exactly `apps/`, `packages/` and `scripts/` as they currently sit on
 * disk — committed or not, and regardless of `HEAD` — `undefined` if git is unavailable (both callers
 * fail open on that). takt-006 rework, MAJOR finding 1 (Opus review)/point 4: `headCommit` alone (the
 * previous round's fix) makes `stop-check.mjs` block on *any* `git commit`, even a docs-only one, or
 * one that only formalises code already recorded as tested — because a commit always changes `HEAD`
 * even when it never touches these three directories at all. Comparing a hash of their *content*
 * instead answers the question that actually matters ("did the tested code change?") independently of
 * whether, or how many times, it got committed in between.
 *
 * Built with a throwaway index file (`GIT_INDEX_FILE`, never the repository's real index — this must
 * never disturb whatever a real `pnpm gates`/git operation elsewhere has staged) : `git add -A -- <code
 * dirs>` stages exactly the current on-disk content of those paths into it, then `git write-tree`
 * hashes the resulting tree. Nothing outside those three directories is ever staged, so the result
 * depends only on their content, never on `docs/`, root config files, or anything else. */
export function codeTreeHash(root) {
  const indexFile = join(tmpdir(), `takt-hooks-index-${randomUUID()}`);
  const env = { ...process.env, GIT_INDEX_FILE: indexFile };
  // A pathspec that matches nothing at all (e.g. a scratch test repo that never created `packages/`)
  // makes `git add` fail outright ("did not match any files") rather than just adding nothing for it —
  // only ask for the ones that currently exist.
  const existingDirs = CODE_DIRS.filter((d) => existsSync(join(root, d)));
  try {
    if (existingDirs.length > 0) git(root, ['add', '-A', '--', ...existingDirs], env);
    return git(root, ['write-tree'], env).trim(); // an empty tree is still a well-defined, stable hash
  } catch {
    return undefined;
  } finally {
    try {
      rmSync(indexFile, { force: true });
    } catch {
      // best-effort cleanup of a temp file in the OS temp dir — never worth failing the caller over
    }
  }
}

/** `git status --porcelain` lines for the three code directories, one file at a time even inside a
 * brand-new untracked directory (`--untracked-files=all`) — `undefined` if git itself is unavailable
 * (both callers fail open on that). Reads the `-z` (NUL-separated) form and turns it back into the
 * same `"XY path"` strings the rest of this module and its callers already expect; a rename/copy
 * record carries a second, NUL-separated "from" path that is consumed and discarded (only the
 * *current* path matters for a dirty-tree signature). */
export function statusLines(root) {
  let raw;
  try {
    raw = git(root, ['status', '--porcelain=1', '-z', '--untracked-files=all', '--', ...CODE_DIRS]);
  } catch {
    return undefined;
  }
  const fields = raw.split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const status = field.slice(0, 2);
    const path = field.slice(3);
    out.push(`${status} ${path}`);
    // A rename/copy pairs this record with a second, NUL-separated "from" path, whichever side (staged
    // X or worktree Y) reports it (takt-006 rework, NIT 8) — skip it, it is not its own status line.
    if (status[0] === 'R' || status[0] === 'C' || status[1] === 'R' || status[1] === 'C') i++;
  }
  return out;
}

/** A path plus a content hash for every changed/untracked file, sorted and joined into one signature
 * — the same dirty state (same files, same bytes) always signs the same, regardless of file order or
 * mtimes; any further edit, revert, add or delete changes it. Call only when `lines.length > 0`; a
 * clean tree is handled by both callers before ever needing a signature at all. */
export function signatureFor(root, lines) {
  const entries = lines.map((line) => {
    const relPath = line.slice(3);
    let contentHash;
    try {
      contentHash = createHash('sha1').update(readFileSync(join(root, relPath))).digest('hex');
    } catch {
      contentHash = 'absent'; // deleted or a rename's old side
    }
    return `${line.slice(0, 2)} ${relPath}:${contentHash}`;
  });
  entries.sort();
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}
