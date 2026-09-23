import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'stop-check.mjs');
const MARK_SCRIPT = join(HERE, 'mark-test-run.mjs');

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
}

/** A real git repo (review rework round 1, M2 needs `git status`, not mtimes) with one committed
 * file under `apps/api/src`. */
function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'stop-check-test-'));
  git(dir, ['init', '-q']);
  git(dir, ['checkout', '-q', '-b', 'main']);
  mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true });
  writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;\n');
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);
  return dir;
}

function run(root, input) {
  const r = spawnSync('node', [SCRIPT, '--root', root], { input: input ? JSON.stringify(input) : '', encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function mark(root) {
  const r = spawnSync('node', [MARK_SCRIPT, '--root', root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
}

test('green: a freshly committed, clean tree never blocks (no marker needed)', () => {
  const dir = scratchRepo();
  try {
    const r = run(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M2 red: a real edit with no test run since is blocked (exit 2)', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n');
    const r = run(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /uncommitted change and no successful/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: the same dirty state that "pnpm gates" (mark-test-run) just ran against passes', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n');
    mark(dir);
    const r = run(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('red: editing again after mark-test-run invalidates the recorded signature', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n');
    mark(dir);
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 3;\n');
    const r = run(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /signature no longer matches/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M2 green: a checkout round-trip without an edit ends up clean and never blocks', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n');
    mark(dir); // pretend gates ran against the dirty state
    git(dir, ['checkout', '--', 'apps/api/src/index.ts']); // ...then the edit is reverted (e.g. a merge/checkout round-trip)
    const r = run(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /no uncommitted change/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M2: stop_hook_active always exits 0, even mid-edit with no marker', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n');
    const r = run(dir, { stop_hook_active: true });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an untracked new file counts as dirty; removing it returns to clean', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'new.ts'), 'export const y = 1;\n');
    const dirty = run(dir);
    assert.equal(dirty.status, 2);
    rmSync(join(dir, 'apps', 'api', 'src', 'new.ts'));
    const clean = run(dir);
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M2: a .gitignore-covered path (generated e2e output) never counts as dirty', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, '.gitignore'), 'apps/web/test-results/\n');
    git(dir, ['add', '.gitignore']);
    git(dir, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'add gitignore']);
    mkdirSync(join(dir, 'apps', 'web', 'test-results'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'web', 'test-results', 'run.json'), '{}');
    const r = run(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: git unavailable (not a repository at all) fails open', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stop-check-test-'));
  try {
    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
