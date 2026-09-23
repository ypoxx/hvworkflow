import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'downgrade-check.mjs');
const FIXTURES = join(SCRIPTS_DIR, 'fixtures', 'downgrade');
const REAL_PLAN = join(SCRIPTS_DIR, '..', 'docs', 'produktplan-beta.md');
const REAL_SLICES_DIR = join(SCRIPTS_DIR, '..', 'docs', 'slices');

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: every real spec 009-099 matches its class in the product plan today', () => {
  const r = run(['--plan', REAL_PLAN, '--slices-dir', REAL_SLICES_DIR]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Downgrade check: \d+ spec\(s\)/);
});

test('red: a lower risk class than the plan, without the sign-off line, fails', () => {
  const r = run(['--plan', join(FIXTURES, 'red', 'plan.md'), '--slices-dir', join(FIXTURES, 'red', 'slices')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /risk class "niedrig" is lower than "mittel"/);
});

test('green: the same downgrade, with the sign-off line, passes', () => {
  const r = run(['--plan', join(FIXTURES, 'green', 'plan.md'), '--slices-dir', join(FIXTURES, 'green', 'slices')]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: a raised (not lowered) risk class needs no sign-off line', () => {
  const r = run(['--plan', join(FIXTURES, 'raised', 'plan.md'), '--slices-dir', join(FIXTURES, 'raised', 'slices')]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
