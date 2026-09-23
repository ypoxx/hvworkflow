/**
 * Shared by `scripts/hooks/stop-check.mjs` and `scripts/hooks/mark-test-run.mjs` (review rework round
 * 1, M2): a content-addressable signature of whatever is currently uncommitted (modified, added,
 * deleted, or untracked-but-not-ignored) under `apps/`, `packages/`, `scripts/`. Built from
 * `git status --porcelain`, which already respects `.gitignore` — a file under e.g.
 * `apps/web/test-results/` never appears here, no separate ignore-list needed.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const CODE_DIRS = ['apps', 'packages', 'scripts'];

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** `git status --porcelain` lines for the three code directories — `undefined` if git itself is
 * unavailable (both callers fail open on that). */
export function statusLines(root) {
  try {
    return git(root, ['status', '--porcelain', '--', ...CODE_DIRS])
      .split('\n')
      .filter(Boolean);
  } catch {
    return undefined;
  }
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
