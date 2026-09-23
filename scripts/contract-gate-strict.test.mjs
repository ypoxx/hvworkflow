import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACT_DIR = join(SCRIPTS_DIR, '..', 'packages', 'contract');
const CHECK_SCRIPT = join(CONTRACT_DIR, 'scripts', 'check.mjs');

/** Review rework round 1, m1: the original approach stripped `git` from `PATH`, assuming `node` and
 * `git` never live in the same directory — not guaranteed on every machine. This copies the contract
 * package into a fresh temp directory with no `.git` anywhere above it at all, so `git rev-parse`
 * fails not because the *tool* is hidden but because there is, deterministically, no repository to
 * find (an OS temp directory is never itself inside a git working tree). */
function detachedContractDir() {
  const dir = mkdtempSync(join(tmpdir(), 'contract-gate-strict-test-'));
  cpSync(CONTRACT_DIR, join(dir, 'packages', 'contract'), { recursive: true });
  return dir;
}

function run(root, env) {
  const r = spawnSync('node', [join(root, 'packages', 'contract', 'scripts', 'check.mjs')], {
    encoding: 'utf8',
    cwd: join(root, 'packages', 'contract'),
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: without CONTRACT_GATE_STRICT, no repository at all is a skip, not a failure', () => {
  const dir = detachedContractDir();
  try {
    const r = run(dir, { CONTRACT_GATE_STRICT: undefined });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /skip {2}\(c\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('red: CONTRACT_GATE_STRICT=1 turns that same skip into a failure, with the same message', () => {
  const dir = detachedContractDir();
  try {
    const r = run(dir, { CONTRACT_GATE_STRICT: '1' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /FAIL {2}\(c\)/);
    assert.match(r.stdout, /not available — version-bump check skipped/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('green: with a real git repository available, CONTRACT_GATE_STRICT=1 does not affect a normal pass', () => {
  const r = spawnSync('node', [CHECK_SCRIPT], {
    encoding: 'utf8',
    cwd: CONTRACT_DIR,
    env: { ...process.env, CONTRACT_GATE_STRICT: '1' },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ok {4}\(c\)/);
});
