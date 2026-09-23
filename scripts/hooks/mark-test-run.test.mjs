import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'mark-test-run.mjs');

test('mark-test-run writes a parseable, current-ish ISO timestamp under --root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mark-test-run-test-'));
  try {
    const r = spawnSync('node', [SCRIPT, '--root', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /mark-test-run: wrote/);
    const written = readFileSync(join(dir, '.claude', 'state', 'last-test-run'), 'utf8').trim();
    const parsed = Date.parse(written);
    assert.equal(Number.isNaN(parsed), false, `not a parseable timestamp: "${written}"`);
    assert.ok(Math.abs(Date.now() - parsed) < 60_000, 'timestamp should be roughly now');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
