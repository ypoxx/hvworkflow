import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(SCRIPTS_DIR, 'slice-scope.mjs');
// Relative to the repository root (the script's default `--root`), like a real spec path — this also
// exercises that "the spec file itself" is matched by the very same string used in `--diff` below.
const FIXTURE_SPEC = 'scripts/fixtures/slice-scope/900-fixture.md';

function run(args) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
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

test('skip (exit 0): a branch outside the claude/slice-NNN-…/claude/takt-NNN-… naming scheme', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slice-scope-test-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd: dir });
    spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: dir });
    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /skipping/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('skip (exit 0): an unresolvable integration ref', () => {
  const r = run(['--slice', '016', '--base', 'origin/this-ref-does-not-exist-anywhere']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /skipping/);
});
