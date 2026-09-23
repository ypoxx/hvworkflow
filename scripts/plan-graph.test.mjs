import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'plan-graph.mjs');
const FIXTURES = join(SCRIPTS_DIR, 'fixtures', 'plan-graph');
const REAL_PLAN = join(SCRIPTS_DIR, '..', 'docs', 'produktplan-beta.md');

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: the real product plan has 80 slices, no missing deps, no cycles, no order problems', () => {
  const r = run(['--plan', REAL_PLAN]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /plan-graph: 80 slice\(s\) found/);
  assert.match(r.stdout, /missing dependencies: 0/);
  assert.match(r.stdout, /cycles: 0/);
  assert.match(r.stdout, /dependency-order problems: 0/);
});

test('green: --strict on the real plan also passes (no lane-sharing warnings today)', () => {
  const r = run(['--plan', REAL_PLAN, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('red: a dependency on a slice number that does not exist fails', () => {
  const r = run(['--plan', join(FIXTURES, 'missing-dep.md')]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /missing dependencies: 1/);
  assert.match(r.stdout, /009 depends on 999/);
});

test('red: a dependency cycle fails', () => {
  const r = run(['--plan', join(FIXTURES, 'cycle.md')]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /cycles: 1/);
  assert.match(r.stdout, /009 -> 010 -> 009/);
});

test('red: a dependency that starts after its dependant fails', () => {
  const r = run(['--plan', join(FIXTURES, 'swapped-order.md')]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /dependency-order problems: 1/);
  assert.match(r.stdout, /009 \(2026-09-28\) depends on 010 \(2026-09-29\)/);
});

test('warning vs. --strict: same-day lane sharing warns but passes by default, fails with --strict', () => {
  const warn = run(['--plan', join(FIXTURES, 'lane-conflict.md')]);
  assert.equal(warn.status, 0, warn.stdout + warn.stderr);
  assert.match(warn.stdout, /same-day lane-sharing warnings: 1/);

  const strict = run(['--plan', join(FIXTURES, 'lane-conflict.md'), '--strict']);
  assert.equal(strict.status, 1);
});

test('--calendar prints a start/finish date per slice and respects --merged', () => {
  const r = run(['--plan', join(FIXTURES, 'ok.md'), '--calendar', '--hours', '3']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /3 slice\(s\) scheduled \(0 taken out as already merged\)/);
  assert.match(r.stdout, /009\s+start 2026-09-28\s+finish 2026-09-28/);
  // 010 depends on 009 and cannot start before it finishes.
  assert.match(r.stdout, /010\s+start 2026-09-29\s+finish 2026-09-29/);

  const merged = run(['--plan', join(FIXTURES, 'ok.md'), '--calendar', '--merged', '009,010']);
  assert.equal(merged.status, 0, merged.stdout + merged.stderr);
  assert.match(merged.stdout, /1 slice\(s\) scheduled \(2 taken out as already merged\)/);
  // 011 depends on 010, which is now merged (done from day one) — starts on day one.
  assert.match(merged.stdout, /011\s+start 2026-09-28\s+finish 2026-09-28/);
});
