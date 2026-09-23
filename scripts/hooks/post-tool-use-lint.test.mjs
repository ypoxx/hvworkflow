import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'post-tool-use-lint.mjs');
const FIXTURES = join(HERE, '..', 'fixtures', 'hooks');

// Review rework round 1, B1: the payload is built here, with this machine's own absolute path to the
// fixture — never baked into a committed JSON file (a path like `/home/user/wt/016/...` would not
// exist on a CI runner, so the hook's `existsSync` check would just skip and every assertion below
// would pass or fail for the wrong reason).
function runWithFile(filePath, toolName = 'Write') {
  const payload = JSON.stringify({ tool_name: toolName, tool_input: { file_path: filePath, content: '' } });
  const r = spawnSync('node', [SCRIPT], { input: payload, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: a clean .ts file passes silently', () => {
  const r = runWithFile(join(FIXTURES, 'post-tool-use-clean.ts'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: oxlint warnings alone do not block (exit 0)', () => {
  const r = runWithFile(join(FIXTURES, 'post-tool-use-warning-only.ts'), 'Edit');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /warnings only, not blocking/);
});

test('red: an oxlint error blocks with exit 2 and the finding on stderr', () => {
  const r = runWithFile(join(FIXTURES, 'post-tool-use-error.ts'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /error/);
});

test('green: a non-.ts/.tsx file is skipped entirely (path need not even exist)', () => {
  const r = runWithFile(join(FIXTURES, 'post-tool-use-notes.md'));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});

test('green: a .ts path that does not exist is skipped', () => {
  const r = runWithFile(join(FIXTURES, 'this-file-does-not-exist-anywhere.ts'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('green: no tool_input.command/file_path at all passes (defensive)', () => {
  const r = spawnSync('node', [SCRIPT], { input: '{"tool_name":"Read","tool_input":{}}', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
