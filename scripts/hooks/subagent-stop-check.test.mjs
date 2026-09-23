import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'subagent-stop-check.mjs');
const FIXTURES = join(HERE, '..', 'fixtures', 'hooks');

function runFixture(name) {
  const payload = readFileSync(join(FIXTURES, `${name}.json`), 'utf8');
  const r = spawnSync('node', [SCRIPT], { input: payload, encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr };
}

test('green: implementierer-backend with every report field present passes', () => {
  const r = runFixture('subagent-stop-backend-complete');
  assert.equal(r.status, 0, r.stderr);
});

test('red: implementierer-backend missing the report format is blocked', () => {
  const r = runFixture('subagent-stop-backend-incomplete');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Slice:.*Done:.*Evidence:.*Open:.*Touched:/);
});

test('green: mechaniker with every report field present passes', () => {
  const r = runFixture('subagent-stop-mechaniker-complete');
  assert.equal(r.status, 0, r.stderr);
});

test('green: a reviewer transcript (not one of the checked roles) is never blocked, report or not', () => {
  const r = runFixture('subagent-stop-reviewer');
  assert.equal(r.status, 0, r.stderr);
});

test('green: a missing/unreadable transcript fails open', () => {
  const r = runFixture('subagent-stop-missing-transcript');
  assert.equal(r.status, 0, r.stderr);
});

test('green: no transcript_path at all fails open', () => {
  const r = spawnSync('node', [SCRIPT], { input: '{"hook_event_name":"SubagentStop"}', encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
