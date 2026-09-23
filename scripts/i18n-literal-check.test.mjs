import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'i18n-literal-check.mjs');
const FIXTURES = join(SCRIPTS_DIR, 'fixtures', 'i18n-literal');
const REPO_ROOT = join(SCRIPTS_DIR, '..');

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

// takt-006 point 5: this test used to point `--root` at a sibling worktree by its absolute,
// machine-specific path — present on some machines but not in CI or a fresh clone (where the test then
// silently skipped, proving nothing) and, either way, a test reading a file outside this very
// repository. A fixture under `scripts/fixtures/` reproduces the same shape (a
// multi-line JSX comment mentioning tags in prose, the concrete false positive the M6 fix closed —
// see `apps/web/src/features/stage/Podium.tsx`'s own comment at the `<button>` in `NextPreview`) so
// the regression test always runs, everywhere, without ever leaving this repository.
test('M6: a multi-line JSX comment mentioning tags in prose (the Podium.tsx-shaped false positive) is masked, not flagged', () => {
  const r = run(['--root', join(FIXTURES, 'podium-regression'), '--scan-roots', 'features']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 literals found/);
});

test('takt-006 point 5: this test file itself names no path outside the repository', () => {
  const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.doesNotMatch(ownSource, /\/home\/[a-zA-Z0-9_-]+\/wt\//);
});

test('M6: JSX text split over several lines is now detected', () => {
  const r = run(['--root', join(FIXTURES, 'multiline'), '--scan-roots', 'features']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Hallo Welt/);
});
