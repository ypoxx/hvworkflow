import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'subagent-stop-check.mjs');
const TRANSCRIPTS = join(HERE, '..', 'fixtures', 'hooks', 'transcripts');

function run(input) {
  const r = spawnSync('node', [SCRIPT], { input: JSON.stringify(input), encoding: 'utf8' });
  return { status: r.status, stderr: r.stderr };
}

test('green: agent_type + last_assistant_message with every report field present passes', () => {
  const r = run({
    agent_type: 'implementierer-backend',
    last_assistant_message: 'Slice: 900\nDone: x\nEvidence: y\nOpen: z\nTouched: w',
  });
  assert.equal(r.status, 0, r.stderr);
});

test('red: agent_type + last_assistant_message missing the report format is blocked', () => {
  const r = run({ agent_type: 'implementierer-backend', last_assistant_message: 'Done, trust me.' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Slice:.*Done:.*Evidence:.*Open:.*Touched:/);
});

test('green: mechaniker with every report field present passes', () => {
  const r = run({
    agent_type: 'mechaniker',
    last_assistant_message: 'Slice: takt-900\nDone: x\nEvidence: y\nOpen: z\nTouched: w',
  });
  assert.equal(r.status, 0, r.stderr);
});

test('M3: a reviewer stop is never blocked, report or not', () => {
  const withReport = run({
    agent_type: 'reviewer',
    last_assistant_message: 'Slice: 900\nDone: x\nEvidence: y\nOpen: z\nTouched: w',
  });
  assert.equal(withReport.status, 0, withReport.stderr);
  const withoutReport = run({ agent_type: 'reviewer', last_assistant_message: '0 blockers, 2 majors.' });
  assert.equal(withoutReport.status, 0, withoutReport.stderr);
});

test('M3: stop_hook_active always exits 0, even for a checked agent with no report', () => {
  const r = run({ agent_type: 'implementierer-backend', last_assistant_message: 'Done, trust me.', stop_hook_active: true });
  assert.equal(r.status, 0, r.stderr);
});

test('green: agent_transcript_path (per-agent transcript) is read when last_assistant_message is absent', () => {
  const complete = run({ agent_type: 'implementierer-backend', agent_transcript_path: join(TRANSCRIPTS, 'implementierer-backend-complete.jsonl') });
  assert.equal(complete.status, 0, complete.stderr);
  const incomplete = run({ agent_type: 'implementierer-backend', agent_transcript_path: join(TRANSCRIPTS, 'implementierer-backend-incomplete.jsonl') });
  assert.equal(incomplete.status, 2);
});

test('green: no agent_type at all fails open (unknown input shape)', () => {
  const r = run({ hook_event_name: 'SubagentStop', last_assistant_message: 'Done, trust me.' });
  assert.equal(r.status, 0, r.stderr);
});

test('green: agent_type present but neither message source given fails open', () => {
  const r = run({ agent_type: 'implementierer-backend' });
  assert.equal(r.status, 0, r.stderr);
});

test('green: empty stdin fails open', () => {
  const r = spawnSync('node', [SCRIPT], { input: '', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
