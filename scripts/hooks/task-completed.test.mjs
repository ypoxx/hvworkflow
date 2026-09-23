import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'task-completed.mjs');
// Review rework round 1, B2: a fixture root with its own docs/slices/, never the live 016/017 specs
// (whose Status can legitimately change under this very rework, which would make these tests flaky).
const FIXTURE_ROOT = join(HERE, '..', 'fixtures', 'task-completed');

function run(todos, root = FIXTURE_ROOT) {
  const payload = JSON.stringify({ hook_event_name: 'TaskCompleted', tool_input: { todos } });
  const r = spawnSync('node', [SCRIPT, '--root', root], { input: payload, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('red: a completed to-do naming a not-yet-accepted slice (status review) is blocked', () => {
  const r = run([{ content: 'finish slice 900', status: 'completed' }]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /names slice 900/);
});

test('green: a completed to-do naming an accepted slice (status accepted) passes', () => {
  const r = run([{ content: 'finish slice 901', status: 'completed' }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: status "angenommen" (German) also counts as accepted', () => {
  const r = run([{ content: 'finish slice 903', status: 'completed' }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('m3: a stray "- [x]" elsewhere in the spec never counts as acceptance on its own', () => {
  const r = run([{ content: 'finish slice 902', status: 'completed' }]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test('green: a completed to-do that names no slice number is nothing to check', () => {
  const r = run([{ content: 'write the spec', status: 'completed' }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: no to-do is completed — nothing to check, even alongside an unrelated in-progress item', () => {
  const r = run([
    { content: 'finish slice 900', status: 'in_progress' },
    { content: 'test', status: 'pending' },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: a completed to-do naming a slice number with no matching spec file is nothing to check', () => {
  const r = run([{ content: 'finish slice 999', status: 'completed' }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green (fail open): unrecognised input shape (no todos array) is never blocked', () => {
  const payload = JSON.stringify({ hook_event_name: 'TaskCompleted', tool_input: { note: 'not a todo list' } });
  const r = spawnSync('node', [SCRIPT, '--root', FIXTURE_ROOT], { input: payload, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green (fail open): empty stdin is never blocked', () => {
  const r = spawnSync('node', [SCRIPT, '--root', FIXTURE_ROOT], { input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
