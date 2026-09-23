import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { statusLines, signatureFor } from './dirty-tree-signature.mjs';

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
}

/** A real git repo with one committed file under `apps/api/src` — same shape as
 * `scripts/hooks/stop-check.test.mjs`'s `scratchRepo()`. */
function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'dirty-tree-signature-test-'));
  git(dir, ['init', '-q']);
  git(dir, ['checkout', '-q', '-b', 'main']);
  mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true });
  writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;\n');
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);
  return dir;
}

// Codex review PR #14, C2: a wholly untracked directory appears in plain `git status --porcelain` as
// one line `?? dir/`; hashing that "file" always fails (it's a directory) and falls back to the
// constant `'absent'`, so editing a file *inside* the new directory never changes the signature at
// all — the Stop hook would then let an untested change through as long as it lives inside a
// brand-new, still wholly untracked directory.
test('C2 red: a file inside a brand-new untracked directory changes the signature when edited', () => {
  const dir = scratchRepo();
  try {
    mkdirSync(join(dir, 'apps', 'api', 'src', 'newdir'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'api', 'src', 'newdir', 'new.ts'), 'export const y = 1;\n');
    const linesBefore = statusLines(dir);
    const sigBefore = signatureFor(dir, linesBefore);

    writeFileSync(join(dir, 'apps', 'api', 'src', 'newdir', 'new.ts'), 'export const y = 2;\n');
    const linesAfter = statusLines(dir);
    const sigAfter = signatureFor(dir, linesAfter);

    assert.notEqual(sigAfter, sigBefore, 'editing a file inside a new untracked directory must change the signature');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('C2 green: a file inside a brand-new untracked directory is listed on its own, not collapsed into "dir/"', () => {
  const dir = scratchRepo();
  try {
    mkdirSync(join(dir, 'apps', 'api', 'src', 'newdir'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'api', 'src', 'newdir', 'new.ts'), 'export const y = 1;\n');
    const lines = statusLines(dir);
    assert.ok(
      lines.some((l) => l.endsWith('newdir/new.ts')),
      `expected a line for newdir/new.ts, got: ${JSON.stringify(lines)}`,
    );
    assert.ok(
      !lines.some((l) => l.trim() === '?? apps/api/src/newdir/'),
      `expected the new directory not to be collapsed into a single "?? dir/" line, got: ${JSON.stringify(lines)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: an ordinary modified, tracked file still signs as before', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n');
    const lines = statusLines(dir);
    assert.deepEqual(lines, [' M apps/api/src/index.ts']);
    assert.equal(typeof signatureFor(dir, lines), 'string');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: a clean tree has no status lines', () => {
  const dir = scratchRepo();
  try {
    assert.deepEqual(statusLines(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: git unavailable (not a repository) fails open with undefined', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dirty-tree-signature-test-'));
  try {
    assert.equal(statusLines(dir), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
