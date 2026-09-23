#!/usr/bin/env node
/**
 * TaskCompleted hook (docs/agentische-entwicklung-plan.md 5.4 "TaskCompleted"): a to-do that names a
 * slice is not "done" (AGENTS.md rule 2, "Evidence, not claims") until that slice's own spec carries
 * `**Status:** accepted` (or its German equivalent `angenommen`, used by several specs in this
 * repository, e.g. 012/014/takt-002) — never on the bauende's own say-so.
 *
 * Review rework round 1, m3: this only blocks when a *completed* to-do item's own text names a
 * three-digit slice/takt number that resolves to a real spec file under `docs/slices/` — an unrelated
 * to-do ("write tests", "fix typo") never triggers a check, and a bare acceptance checkbox
 * (`- [x] …`) elsewhere in a spec no longer counts by itself (round 1 fixed a false negative that
 * would have let a `- [x]` in unrelated prose stand in for `**Status:** accepted`). Fails open (exit
 * 0) whenever the input shape is not recognised (neither a `tool_input.todos` array nor a
 * `task_subject`/`task_description` pair) — an unfamiliar shape is never grounds to block a real
 * session.
 *
 * takt-006 point 4: besides `tool_input.todos`, the real TaskCompleted hook event's own shape —
 * `task_subject`/`task_description` at the top level, describing the one task that just completed —
 * is read too, so this hook still fires under whichever shape the running Claude Code build actually
 * sends.
 *
 * takt-006 / Codex review PR #14, C3: every completed item that names a resolvable spec is checked,
 * not just the first — several completed items each naming a different slice used to stop at the
 * first spec found and let every later, still-unaccepted one through unexamined.
 *
 * Note: Claude Code has no built-in "TaskCompleted" hook event; this key is the plan's own vocabulary
 * for "the point at which a to-do is marked done" (docs/agentische-entwicklung-plan.md 5.4). Wiring it
 * in `.claude/settings.json` under `hooks.TaskCompleted` keeps `scripts/plan-honesty.mjs`'s
 * `läuft (Hook: TaskCompleted)` row honest (the row only claims the *hook is configured*, not that a
 * particular Claude Code build fires it) and gives the check a real, tested script rather than a stub.
 *
 * `--root <dir>` points at a different repository root (its `docs/slices/`), for tests.
 * Test via a redirected fixture payload: `node scripts/hooks/task-completed.mjs --root <dir> < payload.json`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SLICES_DIR = 'docs/slices';
const SLICE_NUMBER_RE = /\b(\d{3})\b/;
const ACCEPTED_STATUS_RE = /^\*\*Status:\*\*\s*(accepted|angenommen)\b/m;

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

function parseArgs(argv) {
  const out = { root: DEFAULT_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else throw new Error(`task-completed: unknown argument "${a}"`);
  }
  return out;
}

/** The first `docs/slices/NNN-*.md` or `docs/slices/takt-NNN-*.md` for a given three-digit number,
 * relative to `root` — `undefined` if neither exists. */
function findSpecFile(root, number) {
  const dir = join(root, SLICES_DIR);
  if (!existsSync(dir)) return undefined;
  const files = readdirSync(dir);
  const match = files.find((f) => (f.startsWith(`${number}-`) || f.startsWith(`takt-${number}-`)) && f.endsWith('.md'));
  return match ? join(dir, match) : undefined;
}

function isAccepted(specText) {
  return ACCEPTED_STATUS_RE.test(specText);
}

/** Every completed item's own text, from either recognised input shape — `tool_input.todos` (a to-do
 * list, zero or more of which may be `completed`) or `task_subject`/`task_description` (the
 * TaskCompleted hook event's own shape: one task, implicitly the one that just completed; takt-006
 * point 4). `undefined` if neither shape is present at all. */
function completedTextsFrom(input) {
  const todos = input?.tool_input?.todos;
  if (Array.isArray(todos)) {
    return todos.filter((t) => t?.status === 'completed' && typeof t?.content === 'string').map((t) => t.content);
  }
  const subject = input?.task_subject;
  const description = input?.task_description;
  if (typeof subject === 'string' || typeof description === 'string') {
    return [[subject, description].filter((s) => typeof s === 'string').join(' ')];
  }
  return undefined; // unrecognised input shape
}

/** Every completed item that names a three-digit slice/takt number resolving to a real spec file —
 * Codex C3: *every* one, not just the first (a for-loop with an early `break` used to stop checking
 * the moment the first resolvable spec was found, silently ignoring every later completed item). */
function namedFindings(root, completedTexts) {
  const out = [];
  for (const text of completedTexts) {
    const m = text.match(SLICE_NUMBER_RE);
    if (!m) continue;
    const specPath = findSpecFile(root, m[1]);
    if (specPath) out.push({ number: m[1], specPath, text });
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const input = readStdinJson();

  const completedTexts = completedTextsFrom(input);
  if (completedTexts === undefined) return 0; // unrecognised input shape — fail open, nothing to check
  if (completedTexts.length === 0) return 0; // nothing newly marked completed

  const named = namedFindings(args.root, completedTexts);
  if (named.length === 0) return 0; // no completed item names a slice number with a real spec — nothing to check

  for (const item of named) {
    const specText = readFileSync(item.specPath, 'utf8');
    if (!isAccepted(specText)) {
      console.error(
        `TaskCompleted blocked (AGENTS.md rule 2, "Evidence, not claims"): the completed to-do "${item.text}" ` +
          `names slice ${item.number}, whose spec (${item.specPath}) is not yet "**Status:** accepted"/"angenommen".`,
      );
      return 2;
    }
  }

  console.log(`task-completed: ${named.length} completed item(s) naming a slice, all accepted (${named.map((n) => n.number).join(', ')}).`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
