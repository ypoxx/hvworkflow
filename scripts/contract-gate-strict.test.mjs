import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const CONTRACT_DIR = join(SCRIPTS_DIR, '..', 'packages', 'contract');
const CHECK_SCRIPT = join(CONTRACT_DIR, 'scripts', 'check.mjs');
// A PATH with `git` removed makes check (c)'s "git or the integration ref not available" branch fire
// deterministically, without needing a real unreachable branch — the same technique used for the
// manual red probe in the report.
const NODE_BIN_DIR = dirname(process.execPath);

function run(env) {
  const r = spawnSync('node', [CHECK_SCRIPT], {
    encoding: 'utf8',
    cwd: CONTRACT_DIR,
    env: { ...process.env, PATH: NODE_BIN_DIR, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: without CONTRACT_GATE_STRICT, an unreachable integration ref is a skip, not a failure', () => {
  const r = run({ CONTRACT_GATE_STRICT: undefined });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /skip {2}\(c\)/);
});

test('red: CONTRACT_GATE_STRICT=1 turns that same skip into a failure, with the same message', () => {
  const r = run({ CONTRACT_GATE_STRICT: '1' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL {2}\(c\)/);
  assert.match(r.stdout, /not available — version-bump check skipped/);
});

test('green: with a real git available, CONTRACT_GATE_STRICT=1 does not affect a normal pass', () => {
  const r = spawnSync('node', [CHECK_SCRIPT], {
    encoding: 'utf8',
    cwd: CONTRACT_DIR,
    env: { ...process.env, CONTRACT_GATE_STRICT: '1' },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /ok {4}\(c\)/);
});
