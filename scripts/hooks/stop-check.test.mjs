import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'stop-check.mjs');

function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'stop-check-test-'));
  mkdirSync(join(dir, 'apps', 'api', 'src'), { recursive: true });
  mkdirSync(join(dir, 'packages', 'domain'), { recursive: true });
  return dir;
}

function run(root) {
  const r = spawnSync('node', [SCRIPT, '--root', root], { encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout };
}

function writeMarker(root, isoString) {
  mkdirSync(join(root, '.claude', 'state'), { recursive: true });
  writeFileSync(join(root, '.claude', 'state', 'last-test-run'), isoString);
}

test('green: no code directories at all never blocks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stop-check-test-'));
  try {
    const r = run(dir);
    assert.equal(r.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: only .md files under apps/packages/scripts never blocks (not "code")', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'packages', 'domain', 'policy-truth-table.md'), '# doc');
    const r = run(dir);
    assert.equal(r.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('red: code present, no marker at all -> blocked', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;');
    const r = run(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no successful test run recorded/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('red: marker older than the newest code file -> blocked', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;');
    writeMarker(dir, '2020-01-01T00:00:00.000Z');
    const r = run(dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /code changed after the last successful test run/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: marker newer than every code file -> passes (this is what "pnpm gates" produces)', () => {
  const dir = scratchRepo();
  try {
    writeFileSync(join(dir, 'apps', 'api', 'src', 'index.ts'), 'export const x = 1;');
    writeMarker(dir, new Date(Date.now() + 5000).toISOString());
    const r = run(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('red then green: editing code after a marker blocks again, and re-marking clears it', () => {
  const dir = scratchRepo();
  try {
    const filePath = join(dir, 'apps', 'api', 'src', 'index.ts');
    writeFileSync(filePath, 'export const x = 1;');
    writeMarker(dir, new Date(Date.now() + 2000).toISOString());
    assert.equal(run(dir).status, 0);

    // Simulate an edit strictly after the marker (the marker itself now counts as stale).
    writeFileSync(filePath, 'export const x = 2;');
    writeMarker(dir, new Date(Date.now() - 60_000).toISOString());
    assert.equal(run(dir).status, 2);

    // A fresh "pnpm gates" run re-marks after the edit — passes again.
    writeMarker(dir, new Date(Date.now() + 5000).toISOString());
    assert.equal(run(dir).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
