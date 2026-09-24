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
  const r = run([{ content: 'finish slice 904', status: 'completed' }]);
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

// takt-006 point 4: the real TaskCompleted hook event carries `task_subject`/`task_description` at
// the top level, not a `tool_input.todos` array — the hook must read that shape too.
function runTaskEvent(taskSubject, taskDescription, root = FIXTURE_ROOT) {
  const payload = JSON.stringify({ hook_event_name: 'TaskCompleted', task_subject: taskSubject, task_description: taskDescription });
  const r = spawnSync('node', [SCRIPT, '--root', root], { input: payload, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('takt-006 point 4 red: task_subject/task_description naming a not-yet-accepted slice is blocked', () => {
  const r = runTaskEvent('finish slice 900', 'complete the review');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /names slice 900/);
});

test('takt-006 point 4 green: task_subject/task_description naming an accepted slice passes', () => {
  const r = runTaskEvent('finish slice 901', '');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('takt-006 point 4 green: task_subject/task_description naming no slice is nothing to check', () => {
  const r = runTaskEvent('write the spec', 'no slice number here');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// Codex review PR #14, C3 (together with point 4): several completed items naming a slice each — the
// hook used to stop at the *first* one whose spec exists and never look at the rest.
test('Codex C3 red: two completed items, only the second unaccepted — the loop must not stop at the first', () => {
  const r = run([
    { content: 'finish slice 901', status: 'completed' }, // accepted — resolvable, but not the only one
    { content: 'finish slice 900', status: 'completed' }, // not accepted — must still be caught
  ]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /names slice 900/);
});

test('Codex C3 green: two completed items, both accepted, passes', () => {
  const r = run([
    { content: 'finish slice 901', status: 'completed' },
    { content: 'finish slice 904', status: 'completed' },
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// takt-006 rework, MINOR finding 5: task_subject/task_description can each (or together) name more
// than one slice number — only the *first* number in the combined text used to be extracted at all
// (a non-global regex match), so a second, unaccepted number right alongside an accepted one passed
// unseen.
test('rework point 5 red: task_subject names one accepted slice, task_description names a second, unaccepted one', () => {
  const r = runTaskEvent('901 fertig', 'und 900');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /names slice 900/);
});

test('rework point 5 green: task_subject and task_description both name only accepted slices', () => {
  const r = runTaskEvent('901 fertig', 'und 903');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// takt-006 review round 2 (Codex on PR #20): "takt-904" must resolve to takt-904-*.md, never to the
// accepted regular slice 904-*.md with the same number, or an unaccepted takt borrows its acceptance.
test('codex round 2 red: a completed "takt-904" is checked against takt-904, not the accepted slice 904', () => {
  const r = run([{ content: 'takt-904 fertig', status: 'completed' }]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test('codex round 2 green: a completed "Scheibe 904" still resolves to the accepted regular slice', () => {
  const r = run([{ content: 'Scheibe 904 fertig', status: 'completed' }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// takt-010 goal 2: today SLICE_NUMBER_RE requires a word boundary right after the three digits, but a
// digit and a following letter are both \w — so "906b" never matches at all (neither as "906b" nor,
// wrongly, as "906") and the hook silently has nothing to check. "906b" must be checked against its
// own spec, never against the plain, already-accepted "906" (same class of namespace confusion as
// "takt-006" vs "006", fixed for that case in takt-006).
test('takt-010 goal 2 red/green: a completed "906b" is blocked on its own (not yet accepted) spec, even though plain 906 is accepted', () => {
  const r = run([{ content: 'finish slice 906b', status: 'completed' }]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /names slice 906b/);
});

test('takt-010 goal 2 green: a completed "905b" passes on its own accepted spec (stdout names it, proof it was actually checked)', () => {
  const r = run([{ content: 'finish slice 905b', status: 'completed' }]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /905b/);
});

test('takt-010 goal 2 red/green: a completed "takt-905b" is checked against takt-905b, not against 905b or 905', () => {
  const r = run([{ content: 'takt-905b fertig', status: 'completed' }]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /names slice takt-905b/);
});
