#!/usr/bin/env node
/**
 * SubagentStop hook (Plan 5.4 "SubagentStop"): when a subagent built with one of the
 * `implementierer-*`/`mechaniker` roles (`.claude/agents/`) finishes, its last reported message must
 * contain the report format from AGENTS.md ("Slice:", "Done:", "Evidence:", "Open:", "Touched:").
 * Every other agent (architekt, planer, design-kritiker, reviewer, reviewer-sonnet, or anything this
 * hook cannot identify) passes through untouched (exit 0) — this only ever tightens the three builder
 * roles the slice names, never anyone else.
 *
 * Claude Code's SubagentStop hook JSON does not carry an explicit "which agent" field, so this script
 * identifies the agent from its own system prompt: the opening line of `.claude/agents/<name>.md`'s
 * body (after the frontmatter) is, verbatim, also the opening line of that subagent's own transcript
 * (`transcript_path`, JSONL, one Claude Code message per line). If the transcript cannot be read, or
 * none of the three builder roles' opening line is found in it, this hook does not guess further and
 * exits 0 (fail open — it only ever blocks a role it positively recognises).
 *
 * Wired in `.claude/settings.json` under `hooks.SubagentStop`. Test via a redirected fixture payload
 * whose `transcript_path` points at a fixture JSONL transcript, e.g.:
 * `node scripts/hooks/subagent-stop-check.mjs < payload.json`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const AGENTS_DIR = join(ROOT, '.claude', 'agents');

// Only these three roles are held to the report format; every other agent is out of scope here.
const CHECKED_AGENT_FILES = ['implementierer-backend.md', 'implementierer-oberflaeche.md', 'mechaniker.md'];
const REQUIRED_FIELDS = ['Slice:', 'Done:', 'Evidence:', 'Open:', 'Touched:'];

function readStdinJson() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    raw = '';
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** The first non-empty line of an agent .md's body, after the frontmatter — a stable fingerprint of
 * that agent's own system prompt, verbatim in every transcript it produces. */
function agentFingerprint(fileName) {
  const path = join(AGENTS_DIR, fileName);
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, 'utf8');
  const afterFrontmatter = text.replace(/^---[\s\S]*?---\s*/, '');
  const firstLine = afterFrontmatter.split('\n').find((l) => l.trim().length > 0);
  return firstLine?.trim();
}

/** Every string found anywhere in a parsed transcript entry — text blocks, tool_use inputs (so a
 * report delivered as a tool call's `message` parameter, e.g. SubagentHandback, still counts), and
 * anything else — joined so a plain substring search covers all of it. */
function allStringsIn(value, out) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) allStringsIn(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) allStringsIn(v, out);
  }
}

function readTranscriptEntries(transcriptPath) {
  if (typeof transcriptPath !== 'string' || !existsSync(transcriptPath)) return [];
  const lines = readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim());
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // a non-JSON or partially written line — skip it, this hook only needs the well-formed ones.
    }
  }
  return entries;
}

function isAssistantEntry(entry) {
  return entry?.type === 'assistant' || entry?.message?.role === 'assistant';
}

function main() {
  const input = readStdinJson();
  const entries = readTranscriptEntries(input?.transcript_path);
  if (entries.length === 0) return 0; // no transcript to check — fail open

  const allText = [];
  for (const entry of entries) allStringsIn(entry, allText);
  const wholeTranscript = allText.join('\n');

  const matchedAgent = CHECKED_AGENT_FILES.find((f) => {
    const fingerprint = agentFingerprint(f);
    return fingerprint && wholeTranscript.includes(fingerprint);
  });
  if (!matchedAgent) return 0; // not one of the three checked roles (or unrecognisable) — fail open

  const assistantEntries = entries.filter(isAssistantEntry);
  if (assistantEntries.length === 0) return 0; // nothing said yet — nothing to check

  const lastText = [];
  allStringsIn(assistantEntries[assistantEntries.length - 1], lastText);
  const lastMessage = lastText.join('\n');

  const missing = REQUIRED_FIELDS.filter((f) => !lastMessage.includes(f));
  if (missing.length > 0) {
    console.error(
      `SubagentStop blocked (AGENTS.md report format, agent "${matchedAgent}"): the last message is missing ${missing.join(', ')}.`,
    );
    return 2;
  }
  return 0;
}

process.exit(main());
