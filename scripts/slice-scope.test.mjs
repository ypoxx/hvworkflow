import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'slice-scope.mjs');
// Relative to the repository root (the script's default `--root`), like a real spec path — this also
// exercises that "the spec file itself" is matched by the very same string used in `--diff` below.
const FIXTURE_SPEC = 'scripts/fixtures/slice-scope/900-fixture.md';

// GITHUB_HEAD_REF and CI are real, always-present GitHub Actions env vars; forcing both off here keeps
// every test below deterministic regardless of whether it happens to run inside a real GitHub Actions
// job on a real slice branch (round 1, M1 fallout) — tests that specifically want to simulate CI or a
// pull_request checkout set them explicitly instead, see below.
function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_HEAD_REF: '', CI: '' } });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: files matching the fixture spec\'s globs (**, *, {a,b}) pass', () => {
  const r = run([
    '--spec',
    FIXTURE_SPEC,
    '--diff',
    [
      'scripts/fixtures/slice-scope/900-fixture.md', // the spec file itself
      'scripts/fixtures/slice-scope/sub/dir/extra.mjs', // ** at any depth
      'apps/web/package.json', // apps/*/package.json
      'apps/api/package.json',
      'packages/domain/src/api.ts', // {domain,contract}
      'packages/contract/src/foo.ts',
    ].join(','),
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /6 changed file\(s\), all within/);
});

test('red: a file outside every glob fails, and is named in the output', () => {
  const r = run([
    '--spec',
    FIXTURE_SPEC,
    '--diff',
    ['scripts/fixtures/slice-scope/900-fixture.md', 'apps/web/src/features/stage/Page.tsx'].join(','),
  ]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /apps\/web\/src\/features\/stage\/Page\.tsx/);
});

test('red: a file one directory level too deep for a single-* pattern fails', () => {
  // apps/*/package.json must not match a nested apps/web/sub/package.json.
  const r = run(['--spec', FIXTURE_SPEC, '--diff', 'apps/web/sub/package.json']);
  assert.equal(r.status, 1);
});

test('always-allowed: pnpm-lock.yaml passes only because the fixture spec allows a package.json glob', () => {
  const r = run(['--spec', FIXTURE_SPEC, '--diff', 'pnpm-lock.yaml']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// GITHUB_HEAD_REF is a real, always-present GitHub Actions env var; when these tests run for real in
// CI on a slice branch, the outer job's own GITHUB_HEAD_REF would otherwise leak into every spawned
// child here and defeat the very branch this test simulates — explicitly cleared below wherever the
// scenario is meant to exercise plain git-based detection instead.
function runIsolated(args, root) {
  const r = spawnSync('node', [SCRIPT, '--root', root, ...args], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_HEAD_REF: '' },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('skip (exit 0): a branch outside the claude/slice-NNN-…/claude/takt-NNN-… naming scheme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slice-scope-test-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
    const r = runIsolated([], dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /skipping/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M1: GITHUB_HEAD_REF is read before git HEAD (pull_request checkouts detach HEAD)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slice-scope-test-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
    // Simulate a pull_request checkout: HEAD is detached (a plain branch name is not `claude/slice-…`
    // at all here, "main"), but GITHUB_HEAD_REF names the real source branch.
    const r = spawnSync('node', [SCRIPT, '--root', dir, '--diff', 'apps/web/src/foreign.tsx'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_HEAD_REF: 'claude/slice-016-agenten' },
    });
    // No spec file exists in this scratch repo for slice 016, so this is a (different) hard failure —
    // proof enough that the branch *was* identified via GITHUB_HEAD_REF rather than skipped.
    assert.equal(r.status, 1);
    assert.match(r.stderr, /no spec file found/);
    assert.doesNotMatch(r.stdout, /skipping/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('M1: in CI, an unresolvable merge-base on an identified slice branch fails instead of skipping', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slice-scope-test-'));
  try {
    mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'slices', '016-x.md'), '# 016 — X\n\n## Files allowed\n\n- `docs/slices/016-x.md`\n');
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd: dir });
    spawnSync('git', ['add', '-A'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
    const notInCI = spawnSync('node', [SCRIPT, '--root', dir, '--slice', '016', '--base', 'origin/does-not-exist-anywhere'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_HEAD_REF: '', CI: '' },
    });
    assert.equal(notInCI.status, 0, notInCI.stdout + notInCI.stderr);
    assert.match(notInCI.stdout, /skipping/);

    const inCI = spawnSync('node', [SCRIPT, '--root', dir, '--slice', '016', '--base', 'origin/does-not-exist-anywhere'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_HEAD_REF: '', CI: 'true' },
    });
    assert.equal(inCI.status, 1);
    assert.match(inCI.stderr, /failing instead of/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('skip (exit 0): an unresolvable integration ref', () => {
  const r = run(['--slice', '016', '--base', 'origin/this-ref-does-not-exist-anywhere']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /skipping/);
});

test('m4 green: a bare filename after a full path resolves against that path\'s directory', () => {
  const r = run([
    '--spec',
    FIXTURE_SPEC,
    '--diff',
    [
      'scripts/fixtures/slice-scope/900-fixture.md',
      'apps/web/e2e/002-x.spec.ts', // the full path itself
      'apps/web/e2e/003-y.spec.ts', // bare `003-y.spec.ts` in the spec, resolved against apps/web/e2e/
      'apps/web/e2e/abnahme.spec.ts', // bare `abnahme.spec.ts`, same directory
    ].join(','),
  ]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('m4 red: the same bare filenames do not match at the repository root (proof they were resolved, not left bare)', () => {
  const r = run(['--spec', FIXTURE_SPEC, '--diff', '003-y.spec.ts']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /003-y\.spec\.ts/);
});

test('m4 red: a bare "*" pattern is rejected outright, not interpreted as "everything"', () => {
  const r = run(['--spec', 'scripts/fixtures/slice-scope/902-bare-wildcard.md', '--diff', 'anything/at/all.ts']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /bare "\*" pattern/);
});

test('m4: a warning (not a failure) when "Files allowed" changed since the merge-base', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slice-scope-test-'));
  try {
    const specPath = join(dir, 'docs', 'slices', '016-x.md');
    mkdirSync(join(dir, 'docs', 'slices'), { recursive: true });
    writeFileSync(specPath, '# 016 — X\n\n## Files allowed\n\n- `docs/slices/016-x.md`\n');
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['checkout', '-q', '-b', 'claude/dax-shareholder-meeting-workflow-0s934z'], { cwd: dir });
    spawnSync('git', ['add', '-A'], { cwd: dir });
    spawnSync('git', ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'base'], { cwd: dir });
    spawnSync('git', ['remote', 'add', 'origin', dir], { cwd: dir });
    spawnSync('git', ['fetch', '-q', 'origin', 'claude/dax-shareholder-meeting-workflow-0s934z'], { cwd: dir });
    spawnSync('git', ['checkout', '-q', '-b', 'claude/slice-016-agenten'], { cwd: dir });
    // Widen "Files allowed" mid-slice.
    writeFileSync(specPath, '# 016 — X\n\n## Files allowed\n\n- `docs/slices/016-x.md`\n- `scripts/**`\n');
    spawnSync('git', ['add', '-A'], { cwd: dir });
    spawnSync('git', ['-c', 'user.email=t@t.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'widen scope'], { cwd: dir });

    const r = spawnSync('node', [SCRIPT, '--root', dir, '--slice', '016'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_HEAD_REF: '', CI: '' },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /differs from its version at the merge-base/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
