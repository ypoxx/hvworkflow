#!/usr/bin/env node
/**
 * SubagentStop hook (Plan 5.4 "SubagentStop"): when a subagent built with one of the
 * `implementierer-*`/`mechaniker` roles finishes, its last reported message must contain the report
 * format from AGENTS.md ("Slice:", "Done:", "Evidence:", "Open:", "Touched:"). Every other agent
 * (architekt, planer, design-kritiker, reviewer, reviewer-sonnet, or anything this hook cannot
 * positively identify) passes through untouched (exit 0).
 *
 * Review rework round 1, M3: the first version of this script identified the agent by searching for
 * its system-prompt fingerprint inside `transcript_path` — but that field name is ambiguous and, on
 * at least one real run, resolved to the *parent* orchestrator's transcript rather than one scoped to
 * this one subagent, so the fingerprint search could match a *different* agent that had merely
 * appeared earlier in the same parent conversation and block the wrong one. This version trusts only
 * fields that name the agent and its message directly:
 *   - `agent_type` (a plain string, e.g. "implementierer-backend") decides *whether* to check at all
 *     — no `agent_type`, or one outside the three checked roles, is never blocked;
 *   - `last_assistant_message` (a plain string), if present, is used as-is;
 *   - otherwise `agent_transcript_path` (explicitly a per-agent transcript, unlike the ambiguous
 *     `transcript_path`), if present, is read and its last assistant entry's text extracted;
 *   - if neither is present, `agent_type` itself is absent, or the JSON does not parse, this hook
 *     fails open (exit 0) — an unrecognised input shape is never grounds to block a real session.
 *   - `stop_hook_active: true` (Claude Code sets this when a Stop-family hook is already retrying)
 *     always exits 0 immediately, so this hook can never contribute to a retry loop.
 *
 * Wired in `.claude/settings.json` under `hooks.SubagentStop`. Test via a redirected fixture payload:
 * `node scripts/hooks/subagent-stop-check.mjs < payload.json`.
 */
import { existsSync, readFileSync } from 'node:fs';

const CHECKED_AGENT_TYPES = new Set(['implementierer-backend', 'implementierer-oberflaeche', 'mechaniker']);
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

/** Every string found anywhere in a parsed transcript entry — text blocks, tool_use inputs (so a
 * report delivered as a tool call's `message` parameter, e.g. SubagentHandback, still counts). */
function allStringsIn(value, out) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) allStringsIn(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) allStringsIn(v, out);
  }
}

function isAssistantEntry(entry) {
  return entry?.type === 'assistant' || entry?.message?.role === 'assistant';
}

/** The last assistant entry's text from a JSONL transcript file — `undefined` if it can't be read or
 * has no assistant entry at all (both fail open, never a finding). */
function lastAssistantMessageFrom(transcriptPath) {
  if (!existsSync(transcriptPath)) return undefined;
  const lines = readFileSync(transcriptPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim());
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // a non-JSON or partially written line — skip it.
    }
  }
  const assistantEntries = entries.filter(isAssistantEntry);
  if (assistantEntries.length === 0) return undefined;
  const out = [];
  allStringsIn(assistantEntries[assistantEntries.length - 1], out);
  return out.join('\n');
}

function main() {
  const input = readStdinJson();
  if (input?.stop_hook_active === true) return 0; // already retrying — never contribute to a loop

  const agentType = input?.agent_type;
  if (typeof agentType !== 'string' || !CHECKED_AGENT_TYPES.has(agentType)) return 0; // unknown shape or an out-of-scope role — fail open

  let lastMessage;
  if (typeof input.last_assistant_message === 'string') {
    lastMessage = input.last_assistant_message;
  } else if (typeof input.agent_transcript_path === 'string') {
    lastMessage = lastAssistantMessageFrom(input.agent_transcript_path);
  }
  if (typeof lastMessage !== 'string') return 0; // no reliable source for the last message — fail open

  const missing = REQUIRED_FIELDS.filter((f) => !lastMessage.includes(f));
  if (missing.length > 0) {
    console.error(`SubagentStop blocked (AGENTS.md report format, agent "${agentType}"): the last message is missing ${missing.join(', ')}.`);
    return 2;
  }
  return 0;
}

process.exit(main());
