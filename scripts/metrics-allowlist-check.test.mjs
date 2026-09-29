import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPTS_DIR, '..');
const SCRIPT = join(SCRIPTS_DIR, 'metrics-allowlist-check.mjs');
const FIXTURES = join(SCRIPTS_DIR, 'fixtures', 'metrics-allowlist');

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', cwd: ROOT });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
const fixture = (name) => run(['--catalog', join(FIXTURES, name), '--specs-dir', join(FIXTURES, 'slices')]);

test('green: the real catalog passes against the real specs (T-G3-I-03)', () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /all within the allowlist/);
});

test('green: a fixture with meeting_id, unit_id and a spec entry passes', () => {
  assert.equal(fixture('green.json').status, 0);
});

// Every red fixture below is listed in the fixture spec: the rule under test must fire on its own.
const RED = [
  ['subject-label.json', /\(c\).*subject_hash|\(c\)/, 'a label subject_hash is a metric per person'],
  ['actor-name.json', /hv_answers_per_actor: \(c\)/, 'a name with "actor" (answers per person)'],
  ['user-with-unit-label.json', /hv_user_open_questions: \(c\)/, 'unit_id plus "user" in the name'],
  ['rate-limit.json', /\(d\)/, 'rate_limit is never part of the catalog'],
  ['label-outside.json', /\(b\).*track/, 'a label outside meeting_id and unit_id'],
  ['bad-name.json', /\(a\).*\^hv_/, 'a name outside ^hv_[a-z0-9_]+$'],
  ['duplicate.json', /\(a\).*duplicate/, 'a duplicate name'],
  ['ip-label.json', /\(c\).*"ip"/, 'a name that has the word ip'],
  ['not-in-spec-section.json', /\(e\)/, 'a name that stands outside the "## Kennzahlen-Allowlist" section'],
  ['unknown-spec.json', /\(e\).*777/, 'a spec without a file'],
];
for (const [file, pattern, why] of RED) {
  test(`red: ${file} (${why})`, () => {
    const r = fixture(file);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, pattern);
  });
}

test('red: rule (c) holds although the fixture spec lists the name (no switch)', () => {
  const r = fixture('subject-label.json');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no metric per person, with or without a spec entry/);
});
