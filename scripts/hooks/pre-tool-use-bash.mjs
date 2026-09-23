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
 * takt-006 (016 re-review round 2, points 1 and 4; Codex review PR #14, C4) closed further bypasses in
 * `gitPushFindings`, all still just a text scan, not a shell parser:
 *   - a combined short-option cluster containing `f` (`-uf`, `-fu`) counts as a force flag, not just a
 *     lone `-f`;
 *   - a quoted refspec (`'+main'`, `"+main"`, `':main'`) has its wrapping quotes stripped before the
 *     `+`/`:` prefix checks run;
 *   - an unambiguous abbreviation of a long option (`--dele`, `--forc`, git itself accepts any prefix
 *     that is not ambiguous among the options it defines) is recognised the same as the option in full;
 *   - `--work-tree=<dir>`/`--work-tree <dir>` and `--no-pager` are recognised as further global options
 *     between `git` and `push` (alongside `-C`, `-c`, `--git-dir` from round 1);
 *   - `--prune` together with a wildcard (`*`) refspec (can delete many remote refs matching a pattern
 *     at once, the same class of risk as `--mirror`/`--delete`) is its own finding;
 *   - an option that takes its own value (`-o`/`--push-option <value>`, `--receive-pack <value>`,
 *     `--repo <value>`) has that value skipped along with the option itself before counting
 *     non-flag/target tokens, so `git push --push-option ci.skip origin` is still seen as missing a
 *     branch, not as already having two targets (Codex C4: the value used to be miscounted as the
 *     target).
 *
 * This is a first line of defence, not the enforcement itself (docs/agentische-entwicklung-plan.md
 * 5.4) — a plain scan of the command text, not a shell parser: it can miss an obfuscated command and,
 * rarely, flag an unrelated argument that happens to contain the same text (e.g. a `grep` pattern for
 * the literal string ".env"). On malformed/unrecognised input (no `tool_input.command` string, unparsable
 * JSON, empty stdin) it fails open (exit 0) deliberately — a hook that cannot even read its own input is
 * not evidence of a violation, and blocking on that basis would make every unrelated tool call fragile.
 *
 * Known, accepted bypasses of the network check (review rework round 1, m2) — narrowing them further
 * would need a real shell parser and a real network policy, both out of scope for a text scan: a
 * scheme-less host (`curl example.com`, no `http(s)://`), any wrapper or alias around `curl`/`wget`
 * (`xargs curl …`, a shell function named `curl`), and any other way to reach the network from a
 * one-liner (`node -e "fetch(...)"`, `python3 -c "import urllib.request; ..."`). These are not
 * silently "fine" — they are simply outside what this hook can see; the real backstop is that the
 * session has no credentials to exfiltrate anything meaningful to (AGENTS.md rule 11, Plan 5.4's own
 * framing: "Bequemlichkeit und erste Linie, nicht die Durchsetzung selbst").
 *
 * Wired in `.claude/settings.json` under `hooks.PreToolUse` (matcher
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
 * `-c <key>=<value>`, `--git-dir=<dir>`/`--git-dir <dir>`, `--work-tree=<dir>`/`--work-tree <dir>`,
 * `--no-pager` — then `push`. Review rework round 1, M4: the original pattern only matched a literal
 * `git push` and missed every one of these forms; takt-006 point 1 added `--work-tree` and
 * `--no-pager` (`-C`/`-c`/`--git-dir` were already there). */
const GIT_PUSH_RE =
  /\bgit\b(?:\s+(?:-C\s+\S+|-c\s+\S+|--git-dir(?:=\S+|\s+\S+)|--work-tree(?:=\S+|\s+\S+)|--no-pager))*\s+push\b([^\n&;|]*)/g;

/** Strips one layer of wrapping quotes (`'…'` or `"…"`) — this is a text scan, so a shell-quoted
 * refspec like `'+main'` still carries its quote characters literally; takt-006 point 1 strips them
 * before any prefix check (`+`, `:`, `-`) runs, so a quoted forced/deleting refspec is seen the same as
 * an unquoted one. */
function stripQuotes(t) {
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Options that take their own value as a separate token — the value must be skipped, not counted as
 * a non-flag/target token, before the "no explicit remote and branch" check runs (Codex review PR #14,
 * C4: `git push --push-option ci.skip origin` used to see `ci.skip` and `origin` as two targets and
 * wave the missing branch through). `--push-option`/`-o` may repeat; each occurrence still takes one
 * value. */
const OPTIONS_WITH_VALUE = new Set(['--push-option', '-o', '--receive-pack', '--repo']);

/** True if `token` (without a leading `--`, and without an `=value` suffix if present) is a non-empty
 * prefix of `name` — git accepts any unambiguous abbreviation of a long option (`--dele`, `--forc`;
 * takt-006 point 1). Not fully general (does not check the abbreviation is unambiguous among *every*
 * option `git push` defines, only among the handful this hook itself cares about), but every name
 * below is unrelated enough in its first two letters that this stays safe. */
function longFlagMatches(token, name) {
  if (!token.startsWith('--')) return false;
  const body = token.slice(2).split('=')[0];
  return body.length >= 2 && name.startsWith(body);
}

/** `-f`, a (possibly abbreviated) `--force`/`--force-with-lease[=…]`, or `f` inside a combined
 * short-option cluster (`-uf`, `-fu`; takt-006 point 1 — the M4 fix only matched a lone `-f`). */
function isForceFlag(t) {
  if (t === '-f') return true;
  if (longFlagMatches(t, 'force') || longFlagMatches(t, 'force-with-lease')) return true;
  return /^-[a-zA-Z]{2,}$/.test(t) && t.slice(1).includes('f');
}

/** `-d`, or a (possibly abbreviated) `--delete`. */
function isDeleteFlag(t) {
  if (t === '-d') return true;
  return longFlagMatches(t, 'delete');
}

/** Every `git … push …` invocation, classified: a force flag/refspec, a `--mirror`, a remote-branch
 * deletion, a `--prune` with a wildcard refspec, or a bare push with fewer than two non-flag tokens (no
 * explicit remote *and* branch) are all findings — the first that applies to a given invocation,
 * checked in this order (round 1, M4 lists `-f`, `--force`, a `+`-prefixed refspec, `--mirror`,
 * `--delete`, and a `:`-prefixed refspec as the bypasses the first version missed; takt-006 point 1
 * adds combined short options, quoted refspecs, abbreviated long options and `--prune`+wildcard). */
function gitPushFindings(command) {
  const out = [];
  const re = new RegExp(GIT_PUSH_RE.source, 'g');
  let m;
  while ((m = re.exec(command))) {
    const whole = m[0].trim();
    const rawTokens = m[1]
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);

    // Codex C4: drop an option-with-value's own value before classifying anything else, so it can
    // never be miscounted as a target token.
    const tokens = [];
    for (let i = 0; i < rawTokens.length; i++) {
      const t = stripQuotes(rawTokens[i]);
      tokens.push(t);
      if (OPTIONS_WITH_VALUE.has(t) && i + 1 < rawTokens.length) i++; // skip the value that follows
    }
    const nonFlagTokens = tokens.filter((t) => !t.startsWith('-'));

    if (tokens.some((t) => isMirrorFlag(t))) {
      out.push({ reason: 'a --mirror push (rewrites/deletes everything on the remote to match local)', text: whole });
    } else if (tokens.some(isForceFlag)) {
      out.push({ reason: 'a force flag (-f/--force/--force-with-lease)', text: whole });
    } else if (tokens.some((t) => !t.startsWith('-') && t.startsWith('+'))) {
      out.push({ reason: 'a "+"-prefixed (forced) refspec', text: whole });
    } else if (tokens.some(isDeleteFlag) || tokens.some((t) => !t.startsWith('-') && t.startsWith(':'))) {
      out.push({ reason: 'a remote-branch deletion (--delete/-d or a ":"-prefixed refspec)', text: whole });
    } else if (tokens.some((t) => t === '--prune') && tokens.some((t) => !t.startsWith('-') && t.includes('*'))) {
      out.push({ reason: 'a --prune push with a wildcard refspec (can delete many remote refs at once)', text: whole });
    } else if (nonFlagTokens.length < 2) {
      out.push({ reason: 'no explicit remote and branch', text: whole });
    }
  }
  return out;
}

/** A (possibly abbreviated) `--mirror`. */
function isMirrorFlag(t) {
  return longFlagMatches(t, 'mirror');
}

/** Any `.env*` token other than the literal `.env.example` — with a path boundary required on both
 * sides (review rework round 1, m2): a boundary character (start of string, whitespace, `/`, a quote,
 * `=`, `(`, `:`, `;`, `,`) before `.env`, and no further word/hyphen character right after the match,
 * so `process.env`/`import.meta.env` (a `.` preceded by an identifier, not a path separator) and
 * `.envrc` (a different, unrelated dotfile) are never mistaken for the `.env` family. Each optional
 * `.segment` after `.env` may repeat, so `.env.local.example` still resolves to one token. */
function envFileFinding(command) {
  const re = /(?:^|[\s/"'`=(:;,])(\.env(?:\.[\w-]+)*)(?![\w-])/g;
  let m;
  while ((m = re.exec(command))) {
    if (m[1] !== '.env.example') return m[1];
  }
  return undefined;
}

/** A `curl`/`wget` segment whose URL's host is not one of the local hosts. Codex review PR #14, C5:
 * cutting the host off at the *first* colon (the old approach) reads a bracketed IPv6 literal
 * (`http://[::1]:3000/…`) as host `[`, so it never matched the `[::1]` entry in `LOCAL_HOSTS` — this
 * parses the whole URL with `new URL()` instead, whose `.hostname` already keeps an IPv6 literal's
 * brackets and correctly separates it from a following `:<port>`. */
function externalCurlFinding(command) {
  for (const segment of splitTopLevelSegments(command)) {
    if (!/^\s*(curl|wget)\b/.test(segment)) continue;
    const urlRe = /https?:\/\/[^\s'"]+/g;
    let m;
    while ((m = urlRe.exec(segment))) {
      let host;
      try {
        host = new URL(m[0]).hostname;
      } catch {
        continue; // not a parseable URL — nothing this hook can judge, same fail-open spirit as elsewhere
      }
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
