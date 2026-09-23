#!/usr/bin/env node
/**
 * PostToolUse hook for Write|Edit (Plan 5.4 "PostToolUse auf Schreiben"). Lints the just-written or
 * -edited file with oxlint immediately. oxlint's own exit code already distinguishes the two cases
 * this hook needs (verified against a real run: a rule at "warning" severity, e.g. `no-eval`, exits 0;
 * an actual error, e.g. a syntax error or a rule denied to error severity, exits non-zero) — so this
 * hook does not re-parse oxlint's summary line itself, it just forwards that distinction: exit 2 (the
 * finding becomes feedback to the agent) only when oxlint itself found an error, never for warnings
 * alone, per the slice's "Exit 2 nur bei Fehlern, nicht bei Warnungen".
 *
 * Skips (exit 0, silent) for anything that is not a `.ts`/`.tsx` file, or a path that does not exist
 * (e.g. the agent wrote then immediately deleted it again).
 *
 * Wired in `.claude/settings.json` under `hooks.PostToolUse` (matcher `Write|Edit`). Test via a
 * redirected fixture file: `node scripts/hooks/post-tool-use-lint.mjs < payload.json`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OXLINT_BIN = join(ROOT, 'node_modules', '.bin', 'oxlint');

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

function main() {
  const input = readStdinJson();
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== 'string' || !/\.tsx?$/.test(filePath)) return 0;
  if (!existsSync(filePath)) return 0;

  const result = spawnSync(OXLINT_BIN, [filePath], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();

  if ((result.status ?? 0) !== 0) {
    console.error(`oxlint found error(s) in ${filePath}:\n${output}`);
    return 2;
  }
  if (output) {
    console.log(`oxlint (warnings only, not blocking) for ${filePath}:\n${output}`);
  }
  return 0;
}

process.exit(main());
