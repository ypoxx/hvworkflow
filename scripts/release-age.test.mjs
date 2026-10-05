import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { checkReleaseAge } from './release-age.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = '2026-10-06';
const HEAD = 'packages:\n  - "packages/*"\n\n';
const OK_ENTRY = '  - "hono@4.13.13" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';

function build({ age = 'minimumReleaseAge: 10080\n', exclude = 'minimumReleaseAgeExclude: []\n' } = {}) {
  return HEAD + age + exclude;
}
function withEntries(...entries) {
  return build({ exclude: `minimumReleaseAgeExclude:\n${entries.join('\n')}\n` });
}

test('real pnpm-workspace.yaml passes with today as the reference date', () => {
  const text = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  assert.deepEqual(checkReleaseAge(text, today), []);
});

test('green: empty list, valid version entry, valid pattern entry', () => {
  assert.deepEqual(checkReleaseAge(build(), TODAY), []);
  assert.deepEqual(checkReleaseAge(withEntries(OK_ENTRY), TODAY), []);
  assert.deepEqual(
    checkReleaseAge(
      withEntries(
        '  - "@oxlint/binding-*" # CVE-2026-12345 added 2026-10-06 expires 2026-10-12',
        '  - "hono@4.13.13||4.13.14" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13',
      ),
      TODAY,
    ),
    [],
  );
});

test('red: value 1440', () => {
  assert.notDeepEqual(checkReleaseAge(build({ age: 'minimumReleaseAge: 1440\n' }), TODAY), []);
});

test('red: value is a string', () => {
  assert.notDeepEqual(checkReleaseAge(build({ age: 'minimumReleaseAge: "10080"\n' }), TODAY), []);
});

test('red: key missing', () => {
  assert.notDeepEqual(checkReleaseAge(build({ age: '' }), TODAY), []);
});

test('red: key twice', () => {
  const twice = 'minimumReleaseAge: 10080\nminimumReleaseAge: 10080\n';
  assert.notDeepEqual(checkReleaseAge(build({ age: twice }), TODAY), []);
});

test('red: exclude key missing', () => {
  assert.notDeepEqual(checkReleaseAge(build({ exclude: '' }), TODAY), []);
});

test('red: entry without comment', () => {
  assert.notDeepEqual(checkReleaseAge(withEntries('  - "hono@4.13.13"'), TODAY), []);
});

test('red: comment without advisory id', () => {
  const e = '  - "hono@4.13.13" # urgent added 2026-10-06 expires 2026-10-13';
  assert.notDeepEqual(checkReleaseAge(withEntries(e), TODAY), []);
});

test('red: expires 8 days after added', () => {
  const e = '  - "hono@4.13.13" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-14';
  assert.notDeepEqual(checkReleaseAge(withEntries(e), TODAY), []);
});

test('red: expired entry', () => {
  const e = '  - "hono@4.13.13" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  assert.notDeepEqual(checkReleaseAge(withEntries(e), '2026-10-14'), []);
  assert.deepEqual(checkReleaseAge(withEntries(e), '2026-10-13'), []);
});

test('red: bare package name', () => {
  const e = '  - "hono" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  assert.notDeepEqual(checkReleaseAge(withEntries(e), TODAY), []);
});

test('red: pattern combined with a version, range, or unknown line in the block', () => {
  const g = '# GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  assert.notDeepEqual(checkReleaseAge(withEntries(`  - "@oxlint/binding-*@1.0.0" ${g}`), TODAY), []);
  assert.notDeepEqual(checkReleaseAge(withEntries(`  - "hono@^4.13.13" ${g}`), TODAY), []);
  assert.notDeepEqual(checkReleaseAge(withEntries(OK_ENTRY, '  # stray comment'), TODAY), []);
  assert.notDeepEqual(checkReleaseAge(withEntries(OK_ENTRY, '  foo: bar'), TODAY), []);
});
