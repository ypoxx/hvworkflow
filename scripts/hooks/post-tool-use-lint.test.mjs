import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'post-tool-use-lint.mjs');
const FIXTURES = join(HERE, '..', 'fixtures', 'hooks');

function runFixture(name) {
  const payload = readFileSync(join(FIXTURES, `${name}.json`), 'utf8');
  const r = spawnSync('node', [SCRIPT], { input: payload, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: a clean .ts file passes silently', () => {
  const r = runFixture('post-tool-use-clean');
  assert.equal(r.status, 0);
});

test('green: oxlint warnings alone do not block (exit 0)', () => {
  const r = runFixture('post-tool-use-warning-only');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /warnings only, not blocking/);
});

test('red: an oxlint error blocks with exit 2 and the finding on stderr', () => {
  const r = runFixture('post-tool-use-error');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /error/);
});

test('green: a non-.ts/.tsx file is skipped entirely', () => {
  const r = runFixture('post-tool-use-non-ts');
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('green: a .ts path that does not exist is skipped', () => {
  const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/tmp/does-not-exist-016.ts' } });
  const r = spawnSync('node', [SCRIPT], { input: payload, encoding: 'utf8' });
  assert.equal(r.status, 0);
});
