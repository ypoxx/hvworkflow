import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'i18n-literal-check.mjs');
const FIXTURES = join(SCRIPTS_DIR, 'fixtures', 'i18n-literal');
const REPO_ROOT = join(SCRIPTS_DIR, '..');
const SIBLING_020_ROOT = '/home/user/wt/020';

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: the real apps/web/src today has 0 literal findings', () => {
  const r = run(['--root', REPO_ROOT]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 literals found/);
});

test('red: findings block immediately, no grace period (round 1, M6 dropped it)', () => {
  const r = run(['--root', join(FIXTURES, 'few'), '--scan-roots', 'features']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /3 literal\(s\) found/);
  assert.match(r.stdout, /Rolle/);
  assert.match(r.stdout, /title="Speichern"/);
});

test('green: exceptions all apply (className/data-testid, expression children, punctuation/numbers, i18n-ok, HV monogram, code shapes)', () => {
  const r = run(['--root', join(FIXTURES, 'clean'), '--scan-roots', 'features']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 literals found/);
});

// Only present on this machine's set of sibling worktrees (not in CI, not in a fresh clone) — the
// coordinator's ask was to check this specific sibling tree once during this rework, not to make a
// permanent test depend on a directory that only exists here. Skips cleanly where absent.
test(
  'M6: the real 020 worktree has 0 findings (the Podium.tsx false positive is gone)',
  { skip: !existsSync(SIBLING_020_ROOT) },
  () => {
    const r = run(['--root', SIBLING_020_ROOT]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /Podium\.tsx/);
  },
);

test('M6: JSX text split over several lines is now detected', () => {
  const r = run(['--root', join(FIXTURES, 'multiline'), '--scan-roots', 'features']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Hallo Welt/);
});
