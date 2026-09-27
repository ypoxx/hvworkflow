import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'plan-graph.mjs');
const FIXTURES = join(SCRIPTS_DIR, 'fixtures', 'plan-graph');
const REAL_PLAN = join(SCRIPTS_DIR, '..', 'docs', 'produktplan-beta.md');
const ALPHA_PLAN = join(FIXTURES, 'alpha-splits.md');
const SERIAL_PLAN = join(FIXTURES, 'serial-same-day.md');

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function runChangedAlphaPlan(change) {
  const dir = mkdtempSync(join(tmpdir(), 'hv-plan-alpha-'));
  const plan = join(dir, 'plan.md');
  try {
    writeFileSync(plan, change(readFileSync(ALPHA_PLAN, 'utf8')));
    return run(['--plan', plan]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('takt-017 red: suffixed slice is parsed and satisfies a dependency', () => {
  const r = run(['--plan', ALPHA_PLAN]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /3 slice\(s\) found/);
  assert.match(r.stdout, /missing dependencies: 0/);
});

test('takt-017 red: --merged recognizes a suffixed slice', () => {
  const r = run(['--plan', ALPHA_PLAN, '--calendar', '--merged', '080b']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /2 slice\(s\) scheduled \(1 taken out as already merged\)/);
});

test('takt-017 red: duplicate and missing suffixed IDs fail', () => {
  const original = readFileSync(ALPHA_PLAN, 'utf8');
  const duplicate = runChangedAlphaPlan((plan) => plan.replace(
    '- **084 · Zeitbudget**',
    '- **080b · Duplikat** — mittel · 1 AStd · Kalender 10.10.2026 (W2) · Lanes: docs\n  - *Abhängigkeiten:* 080\n- **084 · Zeitbudget**',
  ));
  assert.equal(duplicate.status, 1, duplicate.stdout + duplicate.stderr);
  assert.match(duplicate.stderr, /slice 080b appears twice/);

  const missing = runChangedAlphaPlan(() => original.replace('  - *Abhängigkeiten:* 080b', '  - *Abhängigkeiten:* 080c'));
  assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  assert.match(missing.stdout, /084 depends on 080c/);
});

test('takt-017 P1 red: malformed suffixes fail loudly even without a dependent slice', () => {
  for (const malformed of ['080B', '080bb']) {
    const r = runChangedAlphaPlan((plan) => plan
      .replace('**080b ·', `**${malformed} ·`)
      .replace('  - *Abhängigkeiten:* 080b', '  - *Abhängigkeiten:* 080'));
    assert.equal(r.status, 1, `${malformed}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /starts like a slice bullet/);
    assert.match(r.stderr, new RegExp(malformed));
  }
});

test('takt-018 red: same-day lane ownership is serial along an explicit dependency path', () => {
  const r = run(['--plan', SERIAL_PLAN, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /6 slice\(s\) found/);
  assert.match(r.stdout, /same-day lane-sharing warnings: 0/);
});

test('takt-020 red: deferred emergency accounts no longer collide with beta sign-in', () => {
  const r = run(['--plan', REAL_PLAN, '--strict']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /missing dependencies: 0/);
  assert.match(r.stdout, /cycles: 0/);
  assert.match(r.stdout, /dependency-order problems: 0/);
  assert.match(r.stdout, /same-day lane-sharing warnings: 0/);
});

test('takt-020 review red: calendar cannot start emergency accounts before the continuation decision', () => {
  const r = run(['--plan', REAL_PLAN, '--calendar']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const start = r.stdout.match(/^\s+029\s+start\s+(\d{4}-\d{2}-\d{2})\s+/m)?.[1];
  assert.ok(start, 'calendar must include 029');
  assert.ok(start >= '2027-03-15', `029 starts too early: ${start}`);
});

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

// takt-006 rework, NIT finding 9: the reported line number was the offset *within* section 5 (relative
// to the "## 5." heading), not the real file line — correct only by coincidence whenever section 5
// happens to start at line 1 of the plan (true for every fixture above, so none of them caught this).
test('rework point 9 red: the reported line number is the real file line, not the offset from the section heading', () => {
  const r = run(['--plan', join(FIXTURES, 'malformed-bullet-offset.md')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /line 8/); // the real file line of the malformed bullet, not line 3 (its in-section offset)
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
