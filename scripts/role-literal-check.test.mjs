import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, readFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REAL_ROOT = join(SCRIPTS_DIR, '..');
const SCRIPT = join(SCRIPTS_DIR, 'role-literal-check.mjs');

// Round 1, m6: the gate now takes `--root`, and every test below that needs to write a probe file or
// mutate `types.ts`/`permissions.ts` does so on a throwaway scratch copy of the scanned tree, never on
// the real repository. A crash mid-test can then never leave the real working tree dirty, and nothing
// here needs a try/finally restore of real files.
function makeScratchRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'role-literal-check-test-'));
  mkdirSync(join(dir, 'apps', 'api'), { recursive: true });
  mkdirSync(join(dir, 'packages', 'domain'), { recursive: true });
  cpSync(join(REAL_ROOT, 'apps', 'api', 'src'), join(dir, 'apps', 'api', 'src'), { recursive: true });
  cpSync(join(REAL_ROOT, 'packages', 'domain', 'src'), join(dir, 'packages', 'domain', 'src'), { recursive: true });
  return dir;
}

function withScratchRoot(fn) {
  const dir = makeScratchRoot();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runAt(root) {
  const r = spawnSync('node', [SCRIPT, '--root', root], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function runOnRealRepo() {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8', cwd: REAL_ROOT });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('green: the real repository has no role-literal finding today (default --root, read-only)', () => {
  const r = runOnRealRepo();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no role-name literal outside the policy layer/);
});

test('green: a scratch copy of the real tree, unmodified, also has no finding', () => {
  withScratchRoot((root) => {
    const r = runAt(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test('red: role: \'admin\' outside the policy layer is a finding', () => {
  withScratchRoot((root) => {
    writeFileSync(join(root, 'apps', 'api', 'src', '__scratch_probe_admin__.ts'), "export const x = { id: '1', role: 'admin' };\n");
    const r = runAt(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_admin__\.ts/);
  });
});

test('red (round 2, minor 4): object-key access ({podium: 1})[actor.role] is a finding', () => {
  withScratchRoot((root) => {
    writeFileSync(
      join(root, 'apps', 'api', 'src', '__scratch_probe_objkey__.ts'),
      "export function f(actor: { role: string }) {\n  return ({ podium: 1 })[actor.role];\n}\n",
    );
    const r = runAt(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_objkey__\.ts/);
  });
});

test('red (round 2, minor 4): new Set([...]).has(actor.role) is a finding', () => {
  withScratchRoot((root) => {
    writeFileSync(
      join(root, 'apps', 'api', 'src', '__scratch_probe_sethas__.ts'),
      "export function g(actor: { role: string }) {\n  return new Set(['podium', 'expert']).has(actor.role);\n}\n",
    );
    const r = runAt(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_sethas__\.ts/);
  });
});

test('green: q.track === "podium" (not a role access) stays clean', () => {
  withScratchRoot((root) => {
    writeFileSync(join(root, 'apps', 'api', 'src', '__scratch_probe_track__.ts'), "export const ok = (q: { track: string }) => q.track === 'podium';\n");
    const r = runAt(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test('red (round 2, minor 2): types.ts is scanned outside the Role union now, not excluded wholesale', () => {
  withScratchRoot((root) => {
    const typesPath = join(root, 'packages', 'domain', 'src', 'types.ts');
    const original = readFileSync(typesPath, 'utf8');
    writeFileSync(typesPath, `${original}\nexport const oops = { role: 'admin' };\n`);
    const r = runAt(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /types\.ts/);
  });
});

test('red (round 2, minor 3): a Role union / ROLE_PERMISSIONS key mismatch aborts loudly', () => {
  withScratchRoot((root) => {
    const permissionsPath = join(root, 'packages', 'domain', 'src', 'permissions.ts');
    const original = readFileSync(permissionsPath, 'utf8');
    const withExtraRole = original.replace(
      "observer: ['question.read.delivered'],",
      "observer: ['question.read.delivered'],\n  coordination: ['question.read'],",
    );
    assert.notEqual(withExtraRole, original, 'fixture edit did not match — has permissions.ts changed shape?');
    writeFileSync(permissionsPath, withExtraRole);
    const r = runAt(root);
    assert.equal(r.status, 1);
    assert.match(r.stderr + r.stdout, /Role list mismatch/);
  });
});

test('m10 green: a /* */ block comment in the Role union (with a semicolon and a fake quoted name inside) is masked, not just // line comments', () => {
  withScratchRoot((root) => {
    const typesPath = join(root, 'packages', 'domain', 'src', 'types.ts');
    const original = readFileSync(typesPath, 'utf8');
    // The fake `'legacy_role'` and the `;` both sit inside the block comment: before m10, only `//`
    // comments were masked, so this `;` would have been mistaken for the union's own terminator, and
    // `'legacy_role'` would have been derived as a real role name, aborting with "Role list mismatch".
    const withBlockComment = original.replace(
      "  | 'admin'\n",
      "  | 'admin' /* legacy alias, removed; used to be 'legacy_role' */\n",
    );
    assert.notEqual(withBlockComment, original, 'fixture edit did not match — has the Role union changed shape?');
    writeFileSync(typesPath, withBlockComment);
    const r = runAt(root);
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});

test('m6: the real types.ts and permissions.ts are untouched by this whole suite', () => {
  // The suite above only ever mutates scratch copies now; this is a cheap, explicit check that the
  // real repository's working tree stays clean regardless.
  const typesPath = join(REAL_ROOT, 'packages', 'domain', 'src', 'types.ts');
  const permissionsPath = join(REAL_ROOT, 'packages', 'domain', 'src', 'permissions.ts');
  assert.equal(execFileSync('git', ['status', '--porcelain', '--', typesPath, permissionsPath], { cwd: REAL_ROOT, encoding: 'utf8' }).trim(), '');
});
