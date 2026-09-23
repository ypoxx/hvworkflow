#!/usr/bin/env node
/**
 * PreToolUse hook for the Bash tool (AGENTS.md rule 11; Plan 5.4 "PreToolUse auf Shell").
 * Reads the Claude Code hook JSON from stdin (`{tool_input: {command}}`) and blocks (exit 2, message
 * on stderr) a small, deliberately narrow set of shell patterns; everything else passes (exit 0).
 *
 * From slice 012: `rm -rf /`, `git reset --hard`, a `curl … | sh`/`bash` pipeline.
 * New in slice 016 (Plan 5.4 "PreToolUse auf Shell (voller Umfang)"), all handled by `gitPushFindings`:
 *   - a bare `git push` — no explicit remote *and* branch (`git push`, `git push origin` alone);
 *   - a force flag (`-f`, `--force`, `--force-with-lease`), a `+`-prefixed (forced) refspec, or
 *     `--mirror`;
 *   - a remote-branch deletion (`--delete`/`-d`, or a `:`-prefixed refspec like `git push origin :main`);
 *   - the git global options `-C <dir>`, `-c <key>=<value>` and `--git-dir=<dir>` between `git` and
 *     `push` are recognised, so `git -C x push --force origin main` is caught, not just a literal
 *     `git push --force` (round 1, M4 — the first version missed all of the above except a bare
 *     `--force`/no-target push written with neither option);
 *   - reading or writing any `.env*` file other than exactly `.env.example`;
 *   - `curl`/`wget` whose target host is not `localhost`/`127.0.0.1`/`[::1]`/`0.0.0.0`.
 *
 * This is a first line of defence, not the enforcement itself (docs/agentische-entwicklung-plan.md
 * 5.4) — a plain scan of the command text, not a shell parser: it can miss an obfuscated command and,
 * rarely, flag an unrelated argument that happens to contain the same text (e.g. a `grep` pattern for
 * the literal string ".env"). Wired in `.claude/settings.json` under `hooks.PreToolUse` (matcher
 * `Bash`). Test via a redirected file, never an inline literal, so a crafted test payload can never
 * itself read as the very shell command being scanned:
 * `node scripts/hooks/pre-tool-use-bash.mjs < payload.json`.
 */
import { readFileSync } from 'node:fs';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

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

/** Segments split on top-level shell operators — good enough to see whether a segment's own first
 * word is `curl`/`wget`, without needing a real shell parser. */
function splitTopLevelSegments(command) {
  return command
    .split(/&&|\|\||[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EXISTING_PATTERNS = [
  { name: 'rm -rf /', re: /rm\s+-rf\s+\/(\s|$)/ },
  { name: 'git reset --hard', re: /git\s+reset\s+--hard/ },
  { name: 'curl-into-shell pipeline', re: /curl[^|]*\|\s*(ba)?sh/ },
];

/** `git`, then any number of global options that can sit before the subcommand — `-C <dir>`,
 * `-c <key>=<value>`, `--git-dir=<dir>`/`--git-dir <dir>` — then `push`. Review rework round 1, M4:
 * the original pattern only matched a literal `git push` and missed every one of these forms. */
const GIT_PUSH_RE = /\bgit\b(?:\s+(?:-C\s+\S+|-c\s+\S+|--git-dir(?:=\S+|\s+\S+)))*\s+push\b([^\n&;|]*)/g;

/** Every `git … push …` invocation, classified: a force flag/refspec, a `--mirror`, a remote-branch
 * deletion, or a bare push with fewer than two non-flag tokens (no explicit remote *and* branch) are
 * all findings — the first that applies to a given invocation, checked in this order (round 1, M4
 * lists `-f`, `--force`, a `+`-prefixed refspec, `--mirror`, `--delete`, and a `:`-prefixed refspec as
 * the bypasses the first version missed). */
function gitPushFindings(command) {
  const out = [];
  const re = new RegExp(GIT_PUSH_RE.source, 'g');
  let m;
  while ((m = re.exec(command))) {
    const whole = m[0].trim();
    const tokens = m[1]
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const nonFlagTokens = tokens.filter((t) => !t.startsWith('-'));

    if (tokens.some((t) => t === '--mirror')) {
      out.push({ reason: 'a --mirror push (rewrites/deletes everything on the remote to match local)', text: whole });
    } else if (tokens.some((t) => t === '-f' || t === '--force' || t === '--force-with-lease' || t.startsWith('--force-with-lease='))) {
      out.push({ reason: 'a force flag (-f/--force/--force-with-lease)', text: whole });
    } else if (tokens.some((t) => !t.startsWith('-') && t.startsWith('+'))) {
      out.push({ reason: 'a "+"-prefixed (forced) refspec', text: whole });
    } else if (tokens.some((t) => t === '--delete' || t === '-d') || tokens.some((t) => !t.startsWith('-') && t.startsWith(':'))) {
      out.push({ reason: 'a remote-branch deletion (--delete/-d or a ":"-prefixed refspec)', text: whole });
    } else if (nonFlagTokens.length < 2) {
      out.push({ reason: 'no explicit remote and branch', text: whole });
    }
  }
  return out;
}

/** Any `.env*` token other than the literal `.env.example` (the greedy extension group consumes
 * ".example" whole, so `.env.example` itself is a single match and compares equal). */
function envFileFinding(command) {
  const re = /\.env(?:\.[\w.-]+)?/g;
  let m;
  while ((m = re.exec(command))) {
    if (m[0] !== '.env.example') return m[0];
  }
  return undefined;
}

/** A `curl`/`wget` segment whose URL's host is not one of the local hosts. */
function externalCurlFinding(command) {
  for (const segment of splitTopLevelSegments(command)) {
    if (!/^\s*(curl|wget)\b/.test(segment)) continue;
    const urlRe = /https?:\/\/([^\s/'":]+)/g;
    let m;
    while ((m = urlRe.exec(segment))) {
      const host = m[1].split(':')[0];
      if (!LOCAL_HOSTS.has(host)) return `${segment.trim()} (host: ${host})`;
    }
  }
  return undefined;
}

function main() {
  const input = readStdinJson();
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || command.length === 0) return 0;

  for (const p of EXISTING_PATTERNS) {
    if (p.re.test(command)) {
      console.error(`Blocked by repository policy (AGENTS.md rule 11): ${p.name} — ${command}`);
      return 2;
    }
  }

  const pushFindings = gitPushFindings(command);
  if (pushFindings.length > 0) {
    const f = pushFindings[0];
    console.error(`Blocked by repository policy (AGENTS.md rule 11, slice 016): ${f.reason} — ${f.text}`);
    return 2;
  }

  const envFile = envFileFinding(command);
  if (envFile) {
    console.error(
      `Blocked by repository policy (AGENTS.md rule 11, slice 016): access to "${envFile}" (only .env.example may be read or written) — ${command}`,
    );
    return 2;
  }

  const externalCurl = externalCurlFinding(command);
  if (externalCurl) {
    console.error(`Blocked by repository policy (AGENTS.md rule 11, slice 016): curl/wget to a non-local host — ${externalCurl}`);
    return 2;
  }

  return 0;
}

process.exit(main());
