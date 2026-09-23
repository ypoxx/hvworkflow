import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('green: the real apps/web/src today has 0 literal findings (blocking mode trivially passes)', () => {
  const r = run(['--root', REPO_ROOT]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 literals found/);
});

test('red: a handful (<= 5) of findings blocks immediately, no grace period', () => {
  const r = run(['--root', join(FIXTURES, 'few'), '--scan-roots', 'features']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /3 literal\(s\) found/);
  assert.match(r.stdout, /Rolle/);
  assert.match(r.stdout, /title="Speichern"/);
});

test('green: exceptions all apply (className/data-testid, expression children, punctuation/numbers, i18n-ok)', () => {
  const r = run(['--root', join(FIXTURES, 'clean'), '--scan-roots', 'features']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /0 literals found/);
});

test('warn (exit 0): more than a handful of findings, before the grace period ends', () => {
  const r = run(['--root', join(FIXTURES, 'many'), '--scan-roots', 'features', '--today', '2026-09-23']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /8 literal\(s\) found/);
  assert.match(r.stdout, /warning only/);
});

test('red: the same many-findings fixture blocks once the grace period is over', () => {
  const r = run(['--root', join(FIXTURES, 'many'), '--scan-roots', 'features', '--today', '2026-12-01']);
  assert.equal(r.status, 1);
});

test('red: --strict blocks the many-findings fixture regardless of date', () => {
  const r = run(['--root', join(FIXTURES, 'many'), '--scan-roots', 'features', '--strict']);
  assert.equal(r.status, 1);
});
