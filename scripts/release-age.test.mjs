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

function assertErr(text, pattern, today = TODAY) {
  const errors = checkReleaseAge(text, today);
  assert.ok(
    errors.some((e) => pattern.test(e)),
    `expected an error matching ${pattern}, got ${JSON.stringify(errors)}`,
  );
}

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
  assertErr(build({ age: 'minimumReleaseAge: 1440\n' }), /must be the number 10080/);
});

test('red: value is a string', () => {
  assertErr(build({ age: 'minimumReleaseAge: "10080"\n' }), /must be the number 10080/);
});

test('red: key missing', () => {
  assertErr(build({ age: '' }), /minimumReleaseAge must occur exactly once, found 0/);
});

test('red: key twice', () => {
  const twice = 'minimumReleaseAge: 10080\nminimumReleaseAge: 10080\n';
  assertErr(build({ age: twice }), /exactly once, found 2/);
});

test('red: nested key only', () => {
  const nested = 'other:\n  minimumReleaseAge: 10080\n';
  assertErr(build({ age: nested }), /top level|must be the number 10080/);
});

test('red: exclude key missing', () => {
  assertErr(build({ exclude: '' }), /minimumReleaseAgeExclude is missing/);
});

test('red: exclude key twice', () => {
  const twice = 'minimumReleaseAgeExclude: []\nminimumReleaseAgeExclude: []\n';
  assertErr(build({ exclude: twice }), /minimumReleaseAgeExclude must occur exactly once/);
});

test('red: flow-style list', () => {
  assertErr(build({ exclude: 'minimumReleaseAgeExclude: ["hono"]\n' }), /unexpected minimumReleaseAgeExclude line/);
});

test('red: entry without comment', () => {
  assertErr(withEntries('  - "hono@4.13.13"'), /unknown line in minimumReleaseAgeExclude/);
});

test('red: comment without advisory id', () => {
  const e = '  - "hono@4.13.13" # urgent added 2026-10-06 expires 2026-10-13';
  assertErr(withEntries(e), /comment needs advisory id/);
});

test('red: expires 8 days after added', () => {
  const e = '  - "hono@4.13.13" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-14';
  assertErr(withEntries(e), /expires must be 0 to 7 days after added/);
});

test('red: expired entry', () => {
  assertErr(withEntries(OK_ENTRY), /expired on 2026-10-13/, '2026-10-14');
  assert.deepEqual(checkReleaseAge(withEntries(OK_ENTRY), '2026-10-13'), []);
});

test('red: added in the future', () => {
  const e = '  - "hono@4.13.13" # GHSA-abcd-1234-wxyz added 2099-10-06 expires 2099-10-13';
  assertErr(withEntries(e), /added .* in the future/);
});

test('red: bare package name', () => {
  const e = '  - "hono" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  assertErr(withEntries(e), /entry must be name@x\.y\.z/);
});

test('red: over-broad patterns', () => {
  const g = '# GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  for (const pat of ['*', '@*/*', 'h*', 'ho*', '@*scope/x*']) {
    assertErr(withEntries(`  - "${pat}" ${g}`), /entry must be name@x\.y\.z/);
  }
  assert.deepEqual(checkReleaseAge(withEntries(`  - "hon*" ${g}`), TODAY), []);
  assert.deepEqual(checkReleaseAge(withEntries(`  - "@oxlint/*" ${g}`), TODAY), []);
});

test('red: pattern combined with a version, range, or unknown line in the block', () => {
  const g = '# GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  assertErr(withEntries(`  - "@oxlint/binding-*@1.0.0" ${g}`), /entry must be name@x\.y\.z/);
  assertErr(withEntries(`  - "hono@^4.13.13" ${g}`), /entry must be name@x\.y\.z/);
  assertErr(withEntries(OK_ENTRY, '  # stray comment'), /unknown line/);
  assertErr(withEntries(OK_ENTRY, '  foo: bar'), /unknown line/);
});

test('red: unindented sequence (column-0 bare name)', () => {
  assertErr(build({ exclude: 'minimumReleaseAgeExclude:\n- "hono"\n' }), /unknown line/);
  assertErr(withEntries(OK_ENTRY, '- "hono"'), /unknown line/);
});

test('red: column-0 comment or document marker between entries', () => {
  const bare = '  - "hono" # GHSA-abcd-1234-wxyz added 2026-10-06 expires 2026-10-13';
  assertErr(withEntries(OK_ENTRY, '# note', bare), /unknown line/);
  assertErr(withEntries(OK_ENTRY, '---', bare), /document marker|unknown line/);
  assertErr(withEntries(OK_ENTRY, '---', bare), /entry must be name@x\.y\.z/);
});

test('red: second document', () => {
  assertErr(build() + '---\nminimumReleaseAgeExclude:\n  - "hono"\n', /document marker/);
});

test('red: entries after an inline empty list', () => {
  assertErr(build({ exclude: 'minimumReleaseAgeExclude: []\n- "hono"\n' }), /unknown line/);
});

test('red: CRLF entry line', () => {
  const crlf = withEntries(OK_ENTRY).replace(/\n/g, '\r\n');
  assertErr(crlf, /carriage return/);
});

test('block ends only at a new top-level key', () => {
  const text = withEntries(OK_ENTRY) + 'nextKey: 1\n';
  assert.deepEqual(checkReleaseAge(text, TODAY), []);
});
