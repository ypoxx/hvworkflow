import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'task-completed.mjs');
const FIXTURES = join(HERE, '..', 'fixtures', 'hooks');
const ROOT = join(HERE, '..', '..');

function run(args, payloadName) {
  const payload = readFileSync(join(FIXTURES, `${payloadName}.json`), 'utf8');
  const r = spawnSync('node', [SCRIPT, ...args], { input: payload, encoding: 'utf8', cwd: ROOT });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('red: a spec that is not yet accepted blocks a completed to-do', () => {
  const r = run(['--spec', 'docs/slices/016-agenten-hooks-tore.md'], 'task-completed-with-completed-todo');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /neither "\*\*Status:\*\* accepted" nor an acceptance checkbox/);
});

test('green: an accepted spec passes', () => {
  const r = run(['--spec', 'docs/slices/017-i18n-feature-module.md'], 'task-completed-with-completed-todo');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: a spec with only an acceptance checkbox passes', () => {
  const r = run(['--spec', 'scripts/fixtures/slice-scope/901-checkbox-only.md'], 'task-completed-with-completed-todo');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: no to-do is being marked completed — nothing to check, even for an unaccepted spec', () => {
  const r = run(['--spec', 'docs/slices/016-agenten-hooks-tore.md'], 'task-completed-no-completed-todo');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('skip: no slice identifiable and no --spec given', () => {
  const r = spawnSync('node', [SCRIPT, '--root', '/tmp'], {
    input: readFileSync(join(FIXTURES, 'task-completed-with-completed-todo.json'), 'utf8'),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
