#!/usr/bin/env node
/**
 * Scheibenumfang-Tor (slice-scope gate, AGENTS.md rules 1 and 12): a slice may only touch the files
 * its own spec names under "Files allowed" (docs/slices/README.md's template). This script parses
 * that section (every backtick-quoted path, wherever it sits in a bullet, wrapped line or not, is a
 * candidate glob — the convention across every spec in docs/slices/ is that a backtick span in that
 * section is always a path), compiles each into a regular expression (`**` any number of path
 * segments, `*` one path segment, `{a,b}` alternation) and checks every file changed on this branch
 * against it.
 *
 * The slice is identified from the current branch name — `GITHUB_HEAD_REF` first (set by GitHub
 * Actions on `pull_request` to the real source-branch name; a `pull_request` checkout puts a merge
 * ref, not that branch, on `HEAD`, so reading `HEAD` alone would silently see nothing to check — round
 * 1, M1), then `git rev-parse --abbrev-ref HEAD` (push events, local use) — or overridden with
 * `--slice NNN` / `--takt NNN` / `--spec <path>`. The changed files are
 * `git diff --name-only <merge-base>...HEAD` against the integration branch, or overridden with
 * `--diff a,b,c` (comma-separated, for tests — bypasses git entirely).
 *
 * Always allowed in addition to the spec's own list: the spec file itself, and `pnpm-lock.yaml` but
 * only when the spec's list already allows `package.json` (the root manifest).
 *
 * Skips (exit 0, with a note) rather than failing when the branch does not follow the
 * `claude/slice-NNN-…`/`claude/takt-NNN-…` naming scheme and no `--slice`/`--takt`/`--spec` was given
 * (e.g. the orchestrator's own day-report branch) — this is the only situation this gate treats as
 * "not applicable". Once a slice/takt branch *is* identified, every later failure is a hard exit 1,
 * including the merge-base/integration ref being unresolvable: round 1, M1 found that a silent skip
 * there in CI (`CI` env var set) is indistinguishable from "not applicable" and could mask the gate
 * going inert; locally (no `CI` env var) that same situation still only logs a note and exits 0,
 * mirroring `packages/contract/scripts/check.mjs`'s check (c) for a normal offline/local run.
 *
 * Run as `pnpm slice-scope` (part of `pnpm gates`) or directly, e.g.
 * `node scripts/slice-scope.mjs --slice 016`. Deterministic apart from the git/network dependency in
 * its default mode; every option above turns that off for tests.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SLICES_DIR = 'docs/slices';
const DEFAULT_INTEGRATION_REF = 'origin/claude/dax-shareholder-meeting-workflow-0s934z';

// ---- CLI -----------------------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { root: ROOT, base: DEFAULT_INTEGRATION_REF };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slice') out.slice = argv[++i];
    else if (a === '--takt') out.takt = argv[++i];
    else if (a === '--spec') out.specPath = argv[++i];
    else if (a === '--base') out.base = argv[++i];
    else if (a === '--diff') out.diff = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--root') out.root = resolve(argv[++i]);
    else throw new Error(`slice-scope: unknown argument "${a}"`);
  }
  return out;
}

// ---- glob compiler (**, *, {a,b}) -----------------------------------------------------------------

/** Expands a single (non-nested) `{a,b,c}` group into one glob per alternative. */
function expandBraces(glob) {
  const m = glob.match(/\{([^{}]+)\}/);
  if (!m) return [glob];
  const alts = m[1].split(',');
  const out = [];
  for (const alt of alts) out.push(...expandBraces(glob.slice(0, m.index) + alt + glob.slice(m.index + m[0].length)));
  return out;
}

/** `**\/` = zero or more path segments (so `a/**\/b` also matches `a/b`); a lone `**` = anything,
 * including `/`; `*` = anything but `/`; everything else is escaped and matched literally. */
function globToRegExp(glob) {
  const alternatives = expandBraces(glob).map((g) => {
    let re = '';
    let i = 0;
    while (i < g.length) {
      if (g.startsWith('**/', i)) {
        re += '(?:.*/)?';
        i += 3;
      } else if (g.startsWith('**', i)) {
        re += '.*';
        i += 2;
      } else if (g[i] === '*') {
        re += '[^/]*';
        i += 1;
      } else if (g[i] === '?') {
        re += '[^/]';
        i += 1;
      } else {
        re += g[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
        i += 1;
      }
    }
    return re;
  });
  return new RegExp(`^(?:${alternatives.join('|')})$`);
}

// ---- spec parsing ----------------------------------------------------------------------------------

/** The "## Files allowed" section's raw text, up to the next "## " heading or end of file. */
function extractFilesAllowedSection(specText) {
  const lines = specText.split('\n');
  const startIdx = lines.findIndex((l) => /^## Files allowed\s*$/.test(l));
  if (startIdx === -1) return undefined;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx + 1, endIdx).join('\n');
}

/** Every backtick-quoted span in the section is a path glob — the convention every spec in
 * docs/slices/ follows, wrapped markdown lines and multiple paths per bullet included. */
function extractGlobs(sectionText) {
  return [...sectionText.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

function findSpecFile(root, kind, number) {
  const prefix = kind === 'takt' ? `takt-${number}-` : `${number}-`;
  const dir = join(root, SLICES_DIR);
  if (!existsSync(dir)) return undefined;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix) && f.endsWith('.md'));
  return match ? join(SLICES_DIR, match) : undefined;
}

/** `GITHUB_HEAD_REF` first — GitHub Actions sets it on `pull_request` to the real source branch, while
 * `HEAD` itself is a detached merge ref there (round 1, M1) — then a plain git call, for push events
 * and local use. */
function resolveBranchName(root) {
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  try {
    return git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch {
    return undefined;
  }
}

function detectSliceFromBranch(root) {
  const branch = resolveBranchName(root);
  if (!branch) return undefined;
  const m = branch.match(/^claude\/(slice|takt)-(\d{3})-/);
  return m ? { kind: m[1], number: m[2], branch } : undefined;
}

// ---- git diff --------------------------------------------------------------------------------------

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function gitChangedFiles(root, base) {
  const mergeBase = git(root, ['merge-base', 'HEAD', base]).trim();
  const out = git(root, ['diff', '--name-only', `${mergeBase}...HEAD`]);
  return out.split('\n').filter(Boolean);
}

// ---- main ------------------------------------------------------------------------------------------

function main(argv) {
  const args = parseArgs(argv);
  const root = args.root;
  const inCI = Boolean(process.env.CI);

  // Once any of these is true, a slice/takt scope is identified and every later problem is a hard
  // failure, never a skip (round 1, M1) — only "no identifiable branch/override at all" may skip.
  let sliceIdentified = Boolean(args.specPath || args.slice || args.takt);

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
      const detected = detectSliceFromBranch(root);
      if (!detected) {
        console.log('slice-scope: not on a claude/slice-NNN-…/claude/takt-NNN-… branch (checked GITHUB_HEAD_REF and git HEAD) and no --slice/--takt/--spec given — skipping.');
        return 0;
      }
      kind = detected.kind;
      number = detected.number;
      sliceIdentified = true;
    }
    specRelPath = findSpecFile(root, kind, number);
    if (!specRelPath) {
      console.error(`slice-scope: no spec file found under ${SLICES_DIR}/ for ${kind} ${number}.`);
      return 1;
    }
  }

  const specAbsPath = isAbsolute(specRelPath) ? specRelPath : join(root, specRelPath);
  const specText = readFileSync(specAbsPath, 'utf8');
  const sectionText = extractFilesAllowedSection(specText);
  if (sectionText === undefined) {
    console.error(`slice-scope: ${specRelPath} has no "## Files allowed" section.`);
    return 1;
  }
  const globs = extractGlobs(sectionText);
  if (globs.length === 0) {
    console.error(`slice-scope: ${specRelPath}'s "Files allowed" section has no backtick-quoted path.`);
    return 1;
  }
  const patterns = globs.map((g) => ({ glob: g, re: globToRegExp(g) }));

  const alwaysAllowed = new Set([specRelPath]);
  if (patterns.some((p) => p.re.test('package.json'))) alwaysAllowed.add('pnpm-lock.yaml');

  let changed;
  if (args.diff) {
    changed = args.diff;
  } else {
    try {
      changed = gitChangedFiles(root, args.base);
    } catch (e) {
      const reason = e.message.split('\n')[0];
      if (inCI && sliceIdentified) {
        console.error(
          `slice-scope: could not resolve the merge-base with ${args.base} (${reason}) — failing instead of ` +
            'skipping: a slice/takt branch is identified and CI is set (round 1, M1).',
        );
        return 1;
      }
      console.log(`slice-scope: could not resolve the merge-base with ${args.base} (${reason}) — skipping.`);
      return 0;
    }
  }

  const outside = changed.filter((f) => !alwaysAllowed.has(f) && !patterns.some((p) => p.re.test(f)));

  if (outside.length > 0) {
    console.error(`slice-scope: ${outside.length} file(s) outside "${specRelPath}"'s "Files allowed" list:`);
    for (const f of outside) console.error(`  ${f}`);
    return 1;
  }

  console.log(`slice-scope: ${changed.length} changed file(s), all within "${specRelPath}"'s "Files allowed" list (${globs.length} pattern(s)).`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
