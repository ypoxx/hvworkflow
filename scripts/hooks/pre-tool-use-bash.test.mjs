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

// Codex review PR #14, C5: the old host extraction cut off at the *first* colon, so a bracketed IPv6
// literal (`[::1]`) was seen as host "[" — never matching the `[::1]` local-hosts entry — and a public
// IPv6 literal was never recognised as external either.
test('Codex C5 green: curl to http://[::1]:3000/... passes (bracketed IPv6 loopback, with a port)', () => {
  const r = runCommand('curl http://[::1]:3000/health');
  assert.equal(r.status, 0, r.stderr);
});

test('Codex C5 red: curl to a public IPv6 literal is blocked', () => {
  const r = runCommand('curl http://[2001:db8::1]/x');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /2001:db8::1/);
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
  const r = runCommand('git -C /tmp/x -c user.email=t@t.invalid push origin claude/slice-016-agenten');
  assert.equal(r.status, 0, r.stderr);
});

test('M4 green: --git-dir with an explicit, non-forced push still passes', () => {
  const r = runCommand('git --git-dir=/tmp/x/.git push origin claude/slice-016-agenten');
  assert.equal(r.status, 0, r.stderr);
});

// takt-006, point 1 (016 re-review round 2, findings 1-4): each of these bypassed the M4 fixes and
// must now block too — combined short options, quoted refspecs, abbreviated long options, and global
// options between `git` and `push` beyond `-C`/`-c`/`--git-dir`.
const TAKT_006_P1_BYPASSES = [
  ['git push -uf origin main', /force flag/],
  ['git push -fu origin main', /force flag/],
  ["git push origin '+main'", /forced\) refspec/],
  ['git push origin "+main"', /forced\) refspec/],
  ["git push origin ':main'", /remote-branch deletion/],
  ['git push --dele origin main', /remote-branch deletion/],
  ['git push --forc origin main', /force flag/],
  ['git --work-tree=/tmp/x push --force origin main', /force flag/],
  ['git --no-pager push --force origin main', /force flag/],
  ["git push --prune origin 'refs/heads/*:refs/heads/*'", /prune/],
];
for (const [command, expected] of TAKT_006_P1_BYPASSES) {
  test(`takt-006 point 1 red: "${command}" is blocked`, () => {
    const r = runCommand(command);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, expected);
  });
}

test('takt-006 point 1 green: "git push -u origin claude/…" (setting upstream, no force) still passes', () => {
  const r = runCommand('git push -u origin claude/takt-006-nacharbeit-016');
  assert.equal(r.status, 0, r.stderr);
});

// Codex review PR #14, C4: an option that takes its own value (`--push-option`/`-o`, `--receive-pack`,
// `--repo`) must not be miscounted as a target token — its value must be skipped along with it, so a
// push hiding a missing refspec behind one of these still gets caught as a bare push.
const CODEX_C4_BYPASSES = [
  ['git push --push-option ci.skip origin', /explicit remote and branch/],
  ['git push -o ci.skip origin', /explicit remote and branch/],
  ['git push --receive-pack /bin/sh origin', /explicit remote and branch/],
  ['git push --repo origin', /explicit remote and branch/],
];
for (const [command, expected] of CODEX_C4_BYPASSES) {
  test(`Codex C4 red: "${command}" is blocked`, () => {
    const r = runCommand(command);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, expected);
  });
}

test('Codex C4 green: --push-option with an explicit remote and branch still passes', () => {
  const r = runCommand('git push --push-option ci.skip origin claude/takt-006-nacharbeit-016');
  assert.equal(r.status, 0, r.stderr);
});

// takt-006 rework (review round 2, MAJOR finding 2): GIT_PUSH_RE only recognised an enumerated list of
// global options (-C, -c, --git-dir, --work-tree, --no-pager) between `git` and `push` — any *other*
// global option (there are dozens) still hid the subcommand from the regex entirely, so the push
// findings below it (force, delete, mirror, bare push, ...) never even ran.
const REWORK_P2_BYPASSES = [
  ['git -C "a b" push -f origin main', /force flag/],
  ['git -p push -f origin main', /force flag/],
  ['git --paginate push -f origin main', /force flag/],
  ['git --bare push -f origin main', /force flag/],
  ['git --namespace=x push -f origin main', /force flag/],
];
for (const [command, expected] of REWORK_P2_BYPASSES) {
  test(`rework point 2 red: "${command}" is blocked`, () => {
    const r = runCommand(command);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, expected);
  });
}

test('rework point 2 green: "git -C x push -u origin claude/x" (explicit, non-forced) still passes', () => {
  const r = runCommand('git -C x push -u origin claude/x');
  assert.equal(r.status, 0, r.stderr);
});

// takt-006 rework, MINOR finding 3 (+Codex): a short-option cluster containing `f` alongside digits
// (`-4f`) must still count as force; a value-taking long option's *abbreviation* must still have its
// value skipped before counting targets.
const REWORK_P3_BYPASSES = [
  ['git push -4f origin main', /force flag/],
  ['git push -f4 origin main', /force flag/],
  ['git push -6uf origin main', /force flag/],
  ['git push --push-o ci.skip origin', /explicit remote and branch/],
  ['git push --receive-p /bin/sh origin', /explicit remote and branch/],
  ['git push --exec x origin', /explicit remote and branch/],
];
for (const [command, expected] of REWORK_P3_BYPASSES) {
  test(`rework point 3 red: "${command}" is blocked`, () => {
    const r = runCommand(command);
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, expected);
  });
}

// takt-006 rework, MINOR finding 7: splitTopLevelSegments only split on `&&`, `||`, `;`, `|` — a
// newline-separated second command (a common way a multi-line Bash tool call is written) was never
// split off at all, so a `curl` on its own later line was invisible to `externalCurlFinding`.
test('rework point 7 red: a curl on its own line (newline-separated) is blocked', () => {
  const r = runCommand('ls\ncurl https://evil.example');
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /evil\.example/);
});

test('rework point 7 green: a curl on its own line to a local host still passes', () => {
  const r = runCommand('ls\ncurl http://127.0.0.1:3000/health');
  assert.equal(r.status, 0, r.stderr);
});

test('rework point 7 red: a single "&" background separator is blocked', () => {
  const r = runCommand('sleep 1 & curl https://evil.example');
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /evil\.example/);
});

// takt-006 rework, point 1 (Wirkung text accuracy): an upper-case URL scheme is just as much an
// external request as a lower-case one — a "cheap" gap to close while writing the accurate Wirkung
// text (rather than merely documenting it as undetected).
test('rework point 1 red: an upper-case URL scheme (HTTPS://) is blocked the same as https://', () => {
  const r = runCommand('curl HTTPS://evil.example');
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /evil\.example/);
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

// takt-006 review round 2 (major, ReDoS): an option's optional value could itself be the next `-x`
// option, so a long run of global options without a following `push` backtracked exponentially
// (38 options: 12 s). A value may no longer start with `-`; the scan stays linear.
test('redos: 2000 global options without push return quickly and are not blocked', () => {
  const started = Date.now();
  const r = runCommand(`git${' -a'.repeat(2000)} x`);
  const elapsed = Date.now() - started;
  assert.equal(r.status, 0, r.stderr);
  assert.ok(elapsed < 3000, `hook took ${elapsed} ms`);
});

test('redos: 2000 --a=b options followed by a force push still block quickly', () => {
  const started = Date.now();
  const r = runCommand(`git${' --a=b'.repeat(2000)} push -f origin main`);
  const elapsed = Date.now() - started;
  assert.equal(r.status, 2);
  assert.ok(elapsed < 3000, `hook took ${elapsed} ms`);
});

// takt-006 review round 2 (Codex on PR #20): in a short-option cluster, `o` takes the rest as its
// value, so an `f` inside that value is not a force flag.
test('codex round 2 green: git push -ofoo origin main is not a force push', () => {
  assert.equal(runCommand('git push -ofoo origin main').status, 0);
});

test('codex round 2 red: git push -fofoo origin main is still a force push (f before o)', () => {
  assert.equal(runCommand('git push -fofoo origin main').status, 2);
});

test('codex round 2 red: git push -uo ci.skip origin has no branch (value of o in the next token)', () => {
  assert.equal(runCommand('git push -uo ci.skip origin').status, 2);
});
