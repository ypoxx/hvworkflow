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
 * word is `curl`/`wget`, without needing a real shell parser. takt-006 rework, MINOR finding 7: a
 * newline (a multi-line Bash tool call is one command string with embedded `\n`s, each line its own
 * top-level command) and a single `&` (background) were missing — `&&` is tried first in the
 * alternation, so a double-ampersand is still consumed as one separator, not split into two stray
 * single-`&` matches. */
function splitTopLevelSegments(command) {
  return command
    .split(/&&|\|\||\r?\n|[;|&]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EXISTING_PATTERNS = [
  { name: 'rm -rf /', re: /rm\s+-rf\s+\/(\s|$)/ },
  { name: 'git reset --hard', re: /git\s+reset\s+--hard/ },
  { name: 'curl-into-shell pipeline', re: /curl[^|]*\|\s*(ba)?sh/ },
];

/** One global option token between `git` and its subcommand, with an optional value: `-x`/`--xxx`
 * alone, `--xxx=value` (`value` may be quoted), or `-x value`/`--xxx value` (`value` may be quoted,
 * as a separate token). takt-006 rework, MAJOR finding 2: round 1 (M4) and point 1 each enumerated a
 * fixed list of global options (`-C`, `-c`, `--git-dir`, `--work-tree`, `--no-pager`) — every other one
 * git actually accepts (`-p`/`--paginate`, `--bare`, `--namespace=…`, dozens more) still hid `push`
 * from `GIT_PUSH_RE` entirely, so none of the findings below it ever ran. This accepts *any*
 * `-`-prefixed token instead. The trailing value group is optional and, being a plain regex quantifier,
 * backtracks: for an option that takes no value at all (`--bare`, `-p`) sitting directly before `push`,
 * the engine first tries consuming `push` itself as that option's value, fails to find the required
 * literal `push` afterwards, and backtracks to not consuming a value — the correct reading — before
 * ever reporting a match; this needs no separate list of which options take a value and which do not. */
// A separate value (after a space) must not start with `-`: otherwise the next option could also be
// read as this option's value, and a long run of options without a following `push` backtracks
// exponentially (takt-006 review round 2, ReDoS). With the restriction each token parses one way.
const GIT_GLOBAL_OPTION_SRC = String.raw`-{1,2}[A-Za-z][\w-]*(?:=(?:"[^"]*"|'[^']*'|\S+))?(?:\s+(?:"[^"]*"|'[^']*'|[^\s"'-]\S*))?`;

/** `git`, then any number of global options (see `GIT_GLOBAL_OPTION_SRC`), then `push`. Review rework
 * round 1, M4: the original pattern only matched a literal `git push`. */
const GIT_PUSH_RE = new RegExp(String.raw`\bgit\b(?:\s+${GIT_GLOBAL_OPTION_SRC})*\s+push\b([^\n&;|]*)`, 'g');

/** The options of `git push` as data, taken from `git push -h` of the installed git (2.43). The hook
 * parses the push arguments against this table instead of matching single spellings, so short-option
 * clusters (`-vd`, `-4f`, `-ofoo`), unambiguous abbreviations of long options (`--pru`, `--dele`,
 * `--force-w`), `--no-` negations and options with values are all handled the same way (takt-006,
 * Codex rounds 1–5: each round had found one more spelling). `value`: `none`, `required` (inline
 * `=VALUE` or the next word) or `optional` (inline `=VALUE` only). `kind` marks what the hook blocks. */
const PUSH_LONG_OPTIONS = {
  verbose: { value: 'none' },
  quiet: { value: 'none' },
  repo: { value: 'required', kind: 'repo' },
  all: { value: 'none' },
  branches: { value: 'none' },
  mirror: { value: 'none', kind: 'mirror' },
  delete: { value: 'none', kind: 'delete' },
  tags: { value: 'none' },
  'dry-run': { value: 'none' },
  porcelain: { value: 'none' },
  force: { value: 'none', kind: 'force' },
  'force-with-lease': { value: 'optional', kind: 'force' },
  'force-if-includes': { value: 'none' },
  'recurse-submodules': { value: 'required' },
  thin: { value: 'none' },
  'receive-pack': { value: 'required' },
  exec: { value: 'required' },
  'set-upstream': { value: 'none' },
  progress: { value: 'none' },
  prune: { value: 'none', kind: 'prune' },
  verify: { value: 'none' },
  'follow-tags': { value: 'none' },
  signed: { value: 'optional' },
  atomic: { value: 'none' },
  'push-option': { value: 'required' },
  ipv4: { value: 'none' },
  ipv6: { value: 'none' },
};

/** Short options of `git push`: all are plain switches except `-o`, which takes the rest of its
 * cluster (`-ofoo`) or, if nothing follows in the cluster, the next word as its value. */
const PUSH_SHORT_OPTIONS = { v: null, q: null, d: 'delete', n: null, f: 'force', u: null, 4: null, 6: null };

/** Resolves a long option name the way git's parse-options does: an exact name, else the one option it
 * is an unambiguous prefix of. `--no-X` negates X (`--no-verify` is `verify`, negated). Returns
 * `{ spec, negated }`, or `{ ambiguous: true }` / `undefined` for an ambiguous or unknown name. */
function resolveLongOption(body) {
  let name = body;
  let negated = false;
  if (!(name in PUSH_LONG_OPTIONS) && name.startsWith('no-')) {
    name = name.slice(3);
    negated = true;
  }
  if (name in PUSH_LONG_OPTIONS) return { spec: PUSH_LONG_OPTIONS[name], negated };
  const candidates = Object.keys(PUSH_LONG_OPTIONS).filter((option) => option.startsWith(name));
  if (candidates.length === 1) return { spec: PUSH_LONG_OPTIONS[candidates[0]], negated };
  if (candidates.length > 1) return { ambiguous: true };
  return undefined;
}

/** Parses the words after `push` into what the hook needs: which dangerous kinds are switched on, and
 * the positional words (repository and refspecs). An ambiguous abbreviation counts as `ambiguous`; git
 * itself refuses such a command, so blocking it costs nothing. */
function parsePushArgs(words) {
  const kinds = new Set();
  const positional = [];
  let repoOption = false;
  let ambiguous = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === '--') {
      positional.push(...words.slice(i + 1));
      break;
    }
    if (word.startsWith('--')) {
      const [body, inline] = [word.slice(2).split('=')[0], word.includes('=')];
      const resolved = resolveLongOption(body);
      if (resolved?.ambiguous) {
        ambiguous = true;
        continue;
      }
      if (!resolved) continue; // unknown option: git refuses it; nothing to classify
      const { spec, negated } = resolved;
      if (spec.value === 'required' && !inline && !negated) i++; // the value is the next word
      if (spec.kind === 'repo' && !negated) repoOption = true;
      else if (spec.kind && !negated) kinds.add(spec.kind);
      continue;
    }
    if (word.startsWith('-') && word.length > 1) {
      const cluster = word.slice(1);
      for (let j = 0; j < cluster.length; j++) {
        const c = cluster[j];
        if (c === 'o') {
          if (j === cluster.length - 1) i++; // `-o VALUE` / `-uo VALUE`: the value is the next word
          break; // `-oVALUE`: the rest of the cluster is the value
        }
        const kind = PUSH_SHORT_OPTIONS[c];
        if (kind) kinds.add(kind);
      }
      continue;
    }
    positional.push(word);
  }
  return { kinds, positional, repoOption, ambiguous };
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
    const { kinds, positional, repoOption, ambiguous } = parsePushArgs(shellWords(m[1]));
    const targets = positional.length + (repoOption ? 1 : 0);

    if (ambiguous) {
      out.push({ reason: 'an ambiguous abbreviated option (git refuses it; spell the option out)', text: whole });
    } else if (kinds.has('mirror')) {
      out.push({ reason: 'a --mirror push (rewrites/deletes everything on the remote to match local)', text: whole });
    } else if (kinds.has('force')) {
      out.push({ reason: 'a force flag (-f/--force/--force-with-lease)', text: whole });
    } else if (positional.some((t) => t.startsWith('+'))) {
      out.push({ reason: 'a "+"-prefixed (forced) refspec', text: whole });
    } else if (kinds.has('delete') || positional.some((t) => t.startsWith(':'))) {
      out.push({ reason: 'a remote-branch deletion (--delete/-d or a ":"-prefixed refspec)', text: whole });
    } else if (kinds.has('prune') && positional.some((t) => t.includes('*'))) {
      out.push({ reason: 'a --prune push with a wildcard refspec (can delete many remote refs at once)', text: whole });
    } else if (targets < 2) {
      out.push({ reason: 'no explicit remote and branch', text: whole });
    }
  }
  return out;
}

/** Splits a command tail into shell words the way the shell hands them to git: whitespace separates
 * words, but not inside `'…'` or `"…"`; quote characters are removed and a backslash outside single
 * quotes yields the next character literally. So `-o "ci skip"` is two words (Codex round 3), and
 * `'+'main`, `':'main` and `\\+main` all arrive as `+main`/`:main` (Codex round 4). */
function shellWords(text) {
  const words = [];
  let word = '';
  let quote = null;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (quote === '"' && c === '\\' && i + 1 < text.length) word += text[++i];
      else word += c;
    } else if (c === '\\' && i + 1 < text.length) {
      word += text[++i];
      inWord = true;
    } else if (c === '"' || c === "'") {
      quote = c;
      inWord = true;
    } else if (/\s/.test(c)) {
      if (inWord) words.push(word);
      word = '';
      inWord = false;
    } else {
      word += c;
      inWord = true;
    }
  }
  if (inWord) words.push(word);
  return words;
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
 * brackets and correctly separates it from a following `:<port>`. Case-insensitive (`HTTPS://…` is just
 * as external as `https://…`; takt-006 rework, point 1) — `new URL()` itself normalises the scheme's
 * case regardless, so only the matching regex needed the `i` flag. */
function externalCurlFinding(command) {
  for (const segment of splitTopLevelSegments(command)) {
    if (!/^\s*(curl|wget)\b/.test(segment)) continue;
    const urlRe = /https?:\/\/[^\s'"]+/gi;
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
