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

test('green: the real product plan parses, no missing deps, no cycles, no order problems', () => {
  // Round 1, m5: do not hard-code the current slice count here — the plan grows over the project's
  // life and a fixed number makes this test fail on every unrelated planning change. The slice count
  // is still asserted to be a real, positive number, so an empty or unparsed plan still fails loudly.
  const r = run(['--plan', REAL_PLAN]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /plan-graph: \d+ slice\(s\) found/);
  assert.match(r.stdout, /missing dependencies: 0/);
  assert.match(r.stdout, /cycles: 0/);
  assert.match(r.stdout, /dependency-order problems: 0/);
});

test('green: --strict passes on a clean fixture plan (no lane-sharing warnings)', () => {
  // Round 1, m5: --strict must not run against the live plan in this test — a plan-only change
  // (adding a same-day, same-lane slice) should not be able to break this script's own test suite.
  // `ok.md` is deliberately conflict-free (see the other tests in this file for the conflicting case).
  const r = run(['--plan', join(FIXTURES, 'ok.md'), '--strict']);
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

test('m5 red: a line that starts like a slice bullet but does not match the full format fails loudly', () => {
  const r = run(['--plan', join(FIXTURES, 'malformed-bullet.md')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /starts like a slice bullet/);
  assert.match(r.stderr, /009/);
});

// takt-006 point 6: any parse error — not only the one m5 already gives a clean message for — must
// print just that message and exit 1, never a raw Node stack trace (a "some/path.mjs:NN" source
// frame, or a "    at ..." call-stack line).
test('takt-006 point 6 red: a malformed plan line fails with a clean message, no raw stack trace', () => {
  const r = run(['--plan', join(FIXTURES, 'malformed-bullet.md')]);
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  assert.doesNotMatch(r.stderr, /plan-graph\.mjs:\d+/);
});

test('takt-006 point 6 red: an unparsable calendar date fails with a clean message and a line number, no raw stack trace', () => {
  const r = run(['--plan', join(FIXTURES, 'bad-calendar-date.md')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /plan-graph: section 5, line \d+/);
  assert.match(r.stderr, /cannot parse calendar/);
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  assert.doesNotMatch(r.stderr, /plan-graph\.mjs:\d+/);
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
