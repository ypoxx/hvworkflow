import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPTS_DIR, '..');
const SCRIPT = join(SCRIPTS_DIR, 'now-check.mjs');

function run() {
  const r = spawnSync('node', [SCRIPT], { encoding: 'utf8', cwd: ROOT });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The gate has no `--root` override (its "Files allowed" for slice 016 is "nur Punkt 7"), so its
// tests exercise it against the real scan roots via a throwaway scratch file.
function withScratchFile(relPathUnderApiSrc, contents, fn) {
  const absPath = join(ROOT, 'apps', 'api', 'src', relPathUnderApiSrc);
  writeFileSync(absPath, contents);
  try {
    return fn();
  } finally {
    rmSync(absPath, { force: true });
  }
}

test('green: the real repository has no now() finding today', () => {
  const r = run();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /no direct system-clock access/);
});

test('red (round 2, minor 7): process.hrtime.bigint( is a finding', () => {
  withScratchFile('__scratch_probe_hrtime_bigint__.ts', 'export const a = () => process.hrtime.bigint();\n', () => {
    const r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_hrtime_bigint__\.ts/);
  });
});

test("red (round 2, minor 7): performance['now']() is a finding", () => {
  withScratchFile('__scratch_probe_perf_bracket__.ts', "export const b = () => performance['now']();\n", () => {
    const r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_perf_bracket__\.ts/);
  });
});

test('green: process.hrtime( (without .bigint) is still caught by the pre-existing pattern', () => {
  withScratchFile('__scratch_probe_hrtime__.ts', 'export const c = () => process.hrtime();\n', () => {
    const r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /__scratch_probe_hrtime__\.ts/);
  });
});
