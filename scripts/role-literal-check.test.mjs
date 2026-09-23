import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPTS_DIR, '..');
const SCRIPT = join(SCRIPTS_DIR, 'role-literal-check.mjs');
const TYPES_PATH = join(ROOT, 'packages', 'domain', 'src', 'types.ts');
const PERMISSIONS_PATH = join(ROOT, 'packages', 'domain', 'src', 'permissions.ts');

function run() {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8', cwd: ROOT });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The gate has no `--root`/`--scan-roots` override (its "Files allowed" for slice 016 is "nur Punkt
// 7" — the five review findings, not new CLI surface), so its own tests exercise it against the real
// scan roots, via a throwaway scratch file created and removed around each case.
function withScratchFile(relPathUnderApiSrc, contents, fn) {
  const absPath = join(ROOT, 'apps', 'api', 'src', relPathUnderApiSrc);
  writeFileSync(absPath, contents);
  try {
    return fn();
  } finally {
    rmSync(absPath, { force: true });
  }
}

test('green: the real repository has no role-literal finding today', () => {
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no role-name literal outside the policy layer/);
});

test('red: role: \'admin\' outside the policy layer is a finding', () => {
  withScratchFile('__scratch_probe_admin__.ts', "export const x = { id: '1', role: 'admin' };\n", () => {
    const r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_admin__\.ts/);
  });
});

test('red (round 2, minor 4): object-key access ({podium: 1})[actor.role] is a finding', () => {
  withScratchFile(
    '__scratch_probe_objkey__.ts',
    "export function f(actor: { role: string }) {\n  return ({ podium: 1 })[actor.role];\n}\n",
    () => {
      const r = run();
      assert.equal(r.status, 1);
      assert.match(r.stderr, /__scratch_probe_objkey__\.ts/);
    },
  );
});

test('red (round 2, minor 4): new Set([...]).has(actor.role) is a finding', () => {
  withScratchFile(
    '__scratch_probe_sethas__.ts',
    "export function g(actor: { role: string }) {\n  return new Set(['podium', 'expert']).has(actor.role);\n}\n",
    () => {
      const r = run();
      assert.equal(r.status, 1);
      assert.match(r.stderr, /__scratch_probe_sethas__\.ts/);
    },
  );
});

test('green: q.track === "podium" (not a role access) stays clean', () => {
  withScratchFile('__scratch_probe_track__.ts', "export const ok = (q: { track: string }) => q.track === 'podium';\n", () => {
    const r = run();
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test('red (round 2, minor 2): types.ts is scanned outside the Role union now, not excluded wholesale', () => {
  const original = readFileSync(TYPES_PATH, 'utf8');
  try {
    writeFileSync(TYPES_PATH, `${original}\nexport const oops = { role: 'admin' };\n`);
    const r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /types\.ts/);
  } finally {
    writeFileSync(TYPES_PATH, original);
  }
});

test('red (round 2, minor 3): a Role union / ROLE_PERMISSIONS key mismatch aborts loudly', () => {
  const original = readFileSync(PERMISSIONS_PATH, 'utf8');
  try {
    const withExtraRole = original.replace(
      "observer: ['question.read'],",
      "observer: ['question.read'],\n  coordination: ['question.read'],",
    );
    assert.notEqual(withExtraRole, original, 'fixture edit did not match — has permissions.ts changed shape?');
    writeFileSync(PERMISSIONS_PATH, withExtraRole);
    const r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr + r.stdout, /Role list mismatch/);
  } finally {
    writeFileSync(PERMISSIONS_PATH, original);
  }
});

test('green: types.ts and permissions.ts are back to their real, matching content', () => {
  // A cheap sanity check that the two destructive tests above always restore their file, even if one
  // of them fails midway (they use try/finally, but this makes the invariant explicit and checked).
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', TYPES_PATH, PERMISSIONS_PATH], { cwd: ROOT, encoding: 'utf8' }).trim(), '');
  assert.equal(existsSync(join(ROOT, 'apps', 'api', 'src', '__scratch_probe_admin__.ts')), false);
});
