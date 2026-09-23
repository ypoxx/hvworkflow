#!/usr/bin/env node
/**
 * TaskCompleted hook (docs/agentische-entwicklung-plan.md 5.4 "TaskCompleted"): a task only counts as
 * done once the current slice's own spec carries `**Status:** accepted` or an acceptance checkbox
 * (`- [x] …`) — never on a bauende's own say-so (AGENTS.md rule 2, "Evidence, not claims"). If the
 * hook input names one or more to-do items and none of them is being marked `completed`, there is
 * nothing to check and it passes; only a transition to `completed` triggers the spec-acceptance check.
 *
 * Note: Claude Code has no built-in "TaskCompleted" hook event; this key is the plan's own vocabulary
 * for "the point at which a to-do is marked done" (docs/agentische-entwicklung-plan.md 5.4). Wiring it
 * in `.claude/settings.json` under `hooks.TaskCompleted` keeps `scripts/plan-honesty.mjs`'s
 * `läuft (Hook: TaskCompleted)` row honest (the row only claims the *hook is configured*, not that a
 * particular Claude Code build fires it) and gives the check a real, tested script rather than a
 * stub, ready the day an equivalent event exists.
 *
 * The slice is identified exactly as in `scripts/slice-scope.mjs`: from the current branch name
 * (`claude/slice-NNN-…`/`claude/takt-NNN-…`), or overridden with `--slice NNN`/`--takt NNN`/
 * `--spec <path>`. Skips (exit 0) when no slice can be identified, mirroring slice-scope.
 *
 * Test via a redirected fixture payload: `node scripts/hooks/task-completed.mjs --spec <path> < payload.json`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SLICES_DIR = 'docs/slices';

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
  const out = { root: ROOT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slice') out.slice = argv[++i];
    else if (a === '--takt') out.takt = argv[++i];
    else if (a === '--spec') out.specPath = argv[++i];
    else if (a === '--root') out.root = argv[++i];
    else throw new Error(`task-completed: unknown argument "${a}"`);
  }
  return out;
}

function findSpecFile(root, kind, number) {
  const prefix = kind === 'takt' ? `takt-${number}-` : `${number}-`;
  const dir = join(root, SLICES_DIR);
  const match = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith('.md'));
  return match ? join(SLICES_DIR, match) : undefined;
}

function detectSliceFromBranch(root) {
  let branch;
  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined;
  }
  const m = branch.match(/^claude\/(slice|takt)-(\d{3})-/);
  return m ? { kind: m[1], number: m[2] } : undefined;
}

/** Whether the input marks *something* as newly `completed` — a plain to-do list write with no
 * `completed` entry (or no to-do list at all) has nothing for this hook to check yet. Fails open
 * (treated as "yes, check it") for any input shape this script does not recognise, so a real
 * completion signal is never silently skipped just because its exact field name differs. */
function marksSomethingCompleted(input) {
  const todos = input?.tool_input?.todos;
  if (!Array.isArray(todos)) return true;
  return todos.some((t) => t?.status === 'completed');
}

function isAccepted(specText) {
  if (/^\*\*Status:\*\*\s*accepted\b/m.test(specText)) return true;
  if (/^\s*-\s*\[[xX]\]/m.test(specText)) return true; // an acceptance checkbox
  return false;
}

function main(argv) {
  const args = parseArgs(argv);
  const input = readStdinJson();

  if (!marksSomethingCompleted(input)) return 0;

  let specRelPath = args.specPath;
  if (!specRelPath) {
    let kind;
    let number;
    if (args.slice) {
      kind = 'slice';
      number = args.slice;
    } else if (args.takt) {
      kind = 'takt';
      number = args.takt;
    } else {
      const detected = detectSliceFromBranch(args.root);
      if (!detected) {
        console.log('task-completed: not on a claude/slice-NNN-…/claude/takt-NNN-… branch and no --slice/--takt/--spec given — skipping.');
        return 0;
      }
      kind = detected.kind;
      number = detected.number;
    }
    specRelPath = findSpecFile(args.root, kind, number);
    if (!specRelPath) {
      console.log(`task-completed: no spec file found under ${SLICES_DIR}/ for ${kind} ${number} — skipping.`);
      return 0;
    }
  }

  const specAbsPath = isAbsolute(specRelPath) ? specRelPath : join(args.root, specRelPath);
  if (!existsSync(specAbsPath)) {
    console.log(`task-completed: ${specRelPath} does not exist — skipping.`);
    return 0;
  }
  const specText = readFileSync(specAbsPath, 'utf8');

  if (!isAccepted(specText)) {
    console.error(
      `TaskCompleted blocked (AGENTS.md rule 2, "Evidence, not claims"): ${specRelPath} has neither ` +
        '"**Status:** accepted" nor an acceptance checkbox ("- [x] …") yet — a task is not done until the ' +
        'slice itself is.',
    );
    return 2;
  }

  console.log(`task-completed: ${specRelPath} is accepted.`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
