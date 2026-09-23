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
 * 0) whenever the input shape is not recognised (no `tool_input.todos` array at all) — an unfamiliar
 * shape is never grounds to block a real session.
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

function main(argv) {
  const args = parseArgs(argv);
  const input = readStdinJson();

  const todos = input?.tool_input?.todos;
  if (!Array.isArray(todos)) return 0; // unrecognised input shape — fail open, nothing to check

  const completedTexts = todos.filter((t) => t?.status === 'completed' && typeof t?.content === 'string').map((t) => t.content);
  if (completedTexts.length === 0) return 0; // nothing newly marked completed

  let named;
  for (const text of completedTexts) {
    const m = text.match(SLICE_NUMBER_RE);
    if (!m) continue;
    const specPath = findSpecFile(args.root, m[1]);
    if (specPath) {
      named = { number: m[1], specPath, text };
      break;
    }
  }
  if (!named) return 0; // no completed item names a slice number with a real spec — nothing to check

  const specText = readFileSync(named.specPath, 'utf8');
  if (!isAccepted(specText)) {
    console.error(
      `TaskCompleted blocked (AGENTS.md rule 2, "Evidence, not claims"): the completed to-do "${named.text}" ` +
        `names slice ${named.number}, whose spec (${named.specPath}) is not yet "**Status:** accepted"/"angenommen".`,
    );
    return 2;
  }

  console.log(`task-completed: slice ${named.number} (${named.specPath}) is accepted.`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
