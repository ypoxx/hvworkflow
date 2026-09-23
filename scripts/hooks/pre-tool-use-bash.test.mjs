import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'pre-tool-use-bash.mjs');
const FIXTURES = join(HERE, '..', 'fixtures', 'hooks');

// Fixtures are plain files, never inline shell text: the JSON payload is fed to the hook script's
// stdin by Node's spawnSync directly (in-process, not by asking a shell to interpret the trigger
// phrase itself), so a payload containing e.g. "git push" can never be mistaken for the actual
// command this test process is asking a shell to run.
function runFixture(name) {
  const payload = readFileSync(join(FIXTURES, `${name}.json`), 'utf8');
  const r = spawnSync('node', [SCRIPT], { input: payload, encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr };
}

// Built here, in a JS test file — spawnSync feeds it to the hook's stdin directly (in-process), so a
// command string containing "git push" is never itself run by a shell; only inline where B1's lesson
// (never bake a machine-specific *path* into a fixture) does not apply, since these are plain strings.
function runCommand(command) {
  const r = spawnSync('node', [SCRIPT], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr };
}

test('red: git push --force is blocked (slice 012 pattern, unchanged)', () => {
  const r = runFixture('pre-tool-use-force-push');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /git push --force/);
});

test('red: rm -rf / is blocked (slice 012 pattern, unchanged)', () => {
  const r = runFixture('pre-tool-use-rm-rf-root');
  assert.equal(r.status, 2);
});

test('red: a bare "git push" with no remote/branch is blocked', () => {
  const r = runFixture('pre-tool-use-bare-push');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /explicit remote and branch/);
});

test('red: "git push origin" with a remote but no branch is blocked', () => {
  const r = runFixture('pre-tool-use-push-remote-only');
  assert.equal(r.status, 2);
});

test('green: "git push origin <branch>" (explicit target) passes', () => {
  const r = runFixture('pre-tool-use-push-explicit');
  assert.equal(r.status, 0);
});

test('red: reading .env is blocked', () => {
  const r = runFixture('pre-tool-use-env-read');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\.env/);
});

test('red: writing .env (even from .env.example) is blocked', () => {
  const r = runFixture('pre-tool-use-env-write');
  assert.equal(r.status, 2);
});

test('green: reading .env.example itself passes', () => {
  const r = runFixture('pre-tool-use-env-example-ok');
  assert.equal(r.status, 0);
});

test('red: curl to a non-local host is blocked', () => {
  const r = runFixture('pre-tool-use-curl-external');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /example\.com/);
});

test('green: curl to 127.0.0.1 passes', () => {
  const r = runFixture('pre-tool-use-curl-localhost');
  assert.equal(r.status, 0);
});

test('green: git ls-remote to a public https URL passes (not curl/wget)', () => {
  const r = runFixture('pre-tool-use-git-ls-remote');
  assert.equal(r.status, 0);
});

test('green: an unrelated command passes', () => {
  const r = runFixture('pre-tool-use-benign');
  assert.equal(r.status, 0);
});

test('green: no tool_input.command at all passes (e.g. a non-Bash tool call)', () => {
  const r = spawnSync('node', [SCRIPT], { input: '{"tool_name":"Read","tool_input":{"file_path":"/tmp/x"}}', encoding: 'utf8' });
  assert.equal(r.status, 0);
});

test('green: empty stdin passes', () => {
  const r = spawnSync('node', [SCRIPT], { input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
});

// Review rework round 1, M4: each of these bypassed the first version and must now block.
const M4_BYPASSES = [
  ['git push -f origin main', /force flag/],
  ['git push origin +main', /forced\) refspec/],
  ['git -C x push --force origin main', /force flag/],
  ['git -c k=v push --force origin main', /force flag/],
  ['git -C x push', /explicit remote and branch/],
  ['git push origin --delete main', /remote-branch deletion/],
  ['git push origin :main', /remote-branch deletion/],
  ['git push --mirror origin', /--mirror push/],
];
for (const [command, expected] of M4_BYPASSES) {
  test(`M4 red: "${command}" is blocked`, () => {
    const r = runCommand(command);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, expected);
  });
}

test('M4 green: git -C/-c for an unrelated, explicit, non-forced push still passes', () => {
  const r = runCommand('git -C /home/user/wt/016 -c user.email=t@t.invalid push origin claude/slice-016-agenten');
  assert.equal(r.status, 0, r.stderr);
});

test('M4 green: --git-dir with an explicit, non-forced push still passes', () => {
  const r = runCommand('git --git-dir=/home/user/wt/016/.git push origin claude/slice-016-agenten');
  assert.equal(r.status, 0, r.stderr);
});

// Review rework round 1, m2: these three used to false-positive on the old, boundary-free ".env" scan.
test('m2 green: grep -rn "process.env" is not a .env file access', () => {
  const r = runCommand('grep -rn "process.env" apps/api/src');
  assert.equal(r.status, 0, r.stderr);
});

test('m2 green: import.meta.env is not a .env file access', () => {
  const r = runCommand('grep -rn "import.meta.env" apps/web/src');
  assert.equal(r.status, 0, r.stderr);
});

test('m2 green: .envrc is a different, unrelated dotfile', () => {
  const r = runCommand('cat .envrc');
  assert.equal(r.status, 0, r.stderr);
});

test('m2 red: a real .env path still blocks after the path-boundary fix', () => {
  const r = runCommand('cat apps/api/.env');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\.env/);
});
