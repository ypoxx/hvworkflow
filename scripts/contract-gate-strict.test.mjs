import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACT_DIR = join(SCRIPTS_DIR, '..', 'packages', 'contract');

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

/** Codex review PR #14, C1: the third test below used to run `check.mjs` directly against *this*
 * checkout's own `packages/contract`, relying on `origin/claude/dax-shareholder-meeting-workflow-0s934z`
 * already existing among *this checkout's own* remote-tracking refs — true in a normal full clone, but
 * not in a fresh clone with no remote configured at all (`pnpm test:scripts` then failed there, and so
 * did `pnpm gates`). This builds a self-contained throwaway git repository instead: a copy of the real
 * `packages/contract` (so checks (a)/(b)/(d) still validate today's real content), one commit, and the
 * integration ref fabricated with `git update-ref` — a real, reachable `refs/remotes/origin/…` ref,
 * exactly what a full `fetch-depth: 0` CI checkout of `origin` would also leave behind, without ever
 * configuring or reaching an actual remote. */
function detachedContractDirWithIntegrationRef() {
  const dir = detachedContractDir();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'contract snapshot'], { cwd: dir });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  execFileSync('git', ['update-ref', 'refs/remotes/origin/claude/dax-shareholder-meeting-workflow-0s934z', head], { cwd: dir });
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

test('green: with a self-contained integration ref (no dependency on this checkout\'s own remotes), CONTRACT_GATE_STRICT=1 does not affect a normal pass', () => {
  const dir = detachedContractDirWithIntegrationRef();
  try {
    const r = run(dir, { CONTRACT_GATE_STRICT: '1' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /ok {4}\(c\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
