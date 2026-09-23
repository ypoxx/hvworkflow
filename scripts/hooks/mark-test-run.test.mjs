import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'mark-test-run.mjs');

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
}

test('mark-test-run writes a timestamp and a null signature for a clean (non-git) tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /mark-test-run: wrote/);
    const written = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    const parsed = Date.parse(written.timestamp);
    assert.equal(Number.isNaN(parsed), false, `not a parseable timestamp: "${written.timestamp}"`);
    assert.ok(Math.abs(Date.now() - parsed) < 60_000, 'timestamp should be roughly now');
    assert.equal(written.signature, null); // not a git repo at all here — nothing dirty to sign
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mark-test-run writes a matching signature for a dirty git tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    git(dir, ['init', '-q']);
    git(dir, ['checkout', '-q', '-b', 'main']);
    mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;\n');
    git(dir, ['add', '-A']);
    git(dir, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 2;\n'); // now dirty

    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const written = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    assert.equal(typeof written.signature, 'string');
    assert.ok(written.signature.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// takt-006 point 2: the marker now also carries the commit that was HEAD when it was written, so
// stop-check.mjs can tell a later `git commit` apart from "nothing changed since this marker".
test('mark-test-run also records the current HEAD commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    git(dir, ['init', '-q']);
    git(dir, ['checkout', '-q', '-b', 'main']);
    mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;\n');
    git(dir, ['add', '-A']);
    git(dir, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const written = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    assert.equal(written.commit, head);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// takt-006 rework point 4: the marker also carries a tree hash of just apps/, packages/ and scripts/
// (used by stop-check.mjs to tell a docs-only or code-unchanged commit apart from one that actually
// changed the tested code).
test('mark-test-run also records a code-directory tree hash, stable across a docs-only edit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    git(dir, ['init', '-q']);
    git(dir, ['checkout', '-q', '-b', 'main']);
    mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true });
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;\n');
    git(dir, ['add', '-A']);
    git(dir, ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'init']);

    const r1 = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r1.status, 0, r1.stdout + r1.stderr);
    const written1 = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    assert.equal(typeof written1.treeHash, 'string');
    assert.ok(written1.treeHash.length > 0);

    writeFileSync(join(dir, 'README.md'), '# notes\n'); // docs-only, outside apps/packages/scripts
    const r2 = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    const written2 = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    assert.equal(written2.treeHash, written1.treeHash);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mark-test-run records treeHash: null for a non-git tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const written = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    assert.equal(written.treeHash, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mark-test-run records commit: null for a non-git tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const written = JSON.parse(readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8'));
    assert.equal(written.commit, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
