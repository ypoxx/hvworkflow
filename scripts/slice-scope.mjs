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
 * `claude/slice-NNN-…`/`claude/takt-NNN-…` naming scheme — or its lettered-suffix form,
 * `claude/slice-NNNx-…`/`claude/takt-NNNx-…` (a single *lowercase* letter, e.g. `010b`, is its own
 * slice, distinct from plain `010` — takt-010 goal 1; the message says so explicitly, takt-010 rework
 * nit 6, so an upper-case suffix like `010B`, which this gate does not recognise at all and therefore
 * skips silently, is at least named as "NNNx" rather than left looking like an unmatched `NNN`) — and no
 * `--slice`/`--takt`/`--spec` was given (e.g. the orchestrator's own day-report branch) — this is the
 * only situation this gate treats as "not applicable". Once a slice/takt branch *is* identified, every
 * later failure is a hard exit 1, including the merge-base/integration ref being unresolvable: round 1,
 * M1 found that a silent skip there in CI (`CI` env var set) is indistinguishable from "not applicable"
 * and could mask the gate going inert; locally (no `CI` env var) that same situation still only logs a
 * note and exits 0, mirroring `packages/contract/scripts/check.mjs`'s check (c) for a normal
 * offline/local run.
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

/** takt-010 rework (blocker; same root cause as Codex's P2 on PR #27): whether a bare name is a real
 * file must be decided from a *fixed* reference point — the merge-base with the integration branch,
 * i.e. the state the slice branched off, before any of the slice's own commits — never the working tree
 * of the branch currently under review. That tree already contains the very diff being validated: a
 * slice could otherwise add a root file sharing a bare name from its own "Files allowed" (e.g. commit a
 * root-level `003-y.spec.ts` when the spec's shorthand — 020's — means `apps/web/e2e/003-y.spec.ts`)
 * purely to make this gate reinterpret that name as "root" for itself, silently widening its own scope
 * to whatever it just added there; conversely a slice that genuinely *deletes* a root file named in its
 * spec would wrongly fall back to the carried-directory reading the moment that file is gone from the
 * tree. `git cat-file -e <ref>:<path>` checks a path exists in a tree-ish without checking anything out.
 *
 * In `--diff` mode there is no merge-base at all — bypassing git entirely is the whole point of `--diff`
 * (tests) — so `mergeBase` is `undefined` and the only thing to check against is the actual working tree
 * at `root`; this mirrors how `--diff` already bypasses git for the changed-file list itself. */
function makeRootFileChecker(root, mergeBase) {
  return (relPath) => {
    if (mergeBase === undefined) {
      try {
        return existsSync(join(root, relPath));
      } catch {
        return false;
      }
    }
    try {
      git(root, ['cat-file', '-e', `${mergeBase}:${relPath}`]);
      return true;
    } catch {
      return false;
    }
  };
}

/** Every backtick-quoted span in the section is a path glob — the convention every spec in
 * docs/slices/ follows, wrapped markdown lines and multiple paths per bullet included.
 *
 * Review rework round 1, m4: a bare filename (no `/` at all) that follows a full path *within the
 * same bullet* is resolved against that full path's directory — e.g. 020's
 * `` Alt-Specs `apps/web/e2e/002-x.spec.ts`, `003-y.spec.ts`, `abnahme.spec.ts` `` means the second and
 * third live in `apps/web/e2e/` too, not at the repository root. The directory context resets at every
 * new bullet (a line starting with `- `), so an unrelated bare name in its *own* bullet (e.g.
 * `` `package.json` (Root, nur Skripte) ``) is never accidentally prefixed with some earlier bullet's
 * directory.
 *
 * takt-010 goal 3, reworked: a bare, wildcard-free name is checked against `pathExistsAtRef` both as
 * the root path and as the carried (directory-prefixed) path.
 *   - Root only exists → the root file wins (fixes the first version of the takt-007 spec, whose bare
 *     `README.md` used to inherit `docs/` from the previous full path in the same paragraph).
 *   - Carried only exists (or neither exists, e.g. a brand-new file) → the carried directory wins,
 *     unchanged from round 1's m4 (020's shorthand; also takt-003's bare ADR filenames, which never
 *     reach this branch at all because they carry a wildcard, see below).
 *   - **Both exist (takt-010 rework, Major finding)**: this is genuinely ambiguous — the spec's own
 *     text does not say which one is meant — so the name is collected in `ambiguous` instead of being
 *     resolved one way or the other; the caller fails loudly rather than silently preferring root ("if
 *     both the carried path and the root path exist at the merge base, fail with a clear message").
 *
 * A glob with wildcard characters (`*`, `?`, `{`) is never resolved this way — it cannot name a single
 * real file, and existing specs rely on the carry-over for exactly such globs (e.g. takt-003's
 * `` `docs/adr/0003-*.md`, `0009-*.md`, `0010-*.md`, … `` — every one of those bare names is meant to
 * live in `docs/adr/`). */
function extractGlobs(sectionText, pathExistsAtRef) {
  const lines = sectionText.split('\n');
  const bullets = [];
  let current = [];
  for (const line of lines) {
    if (/^-\s/.test(line)) {
      if (current.length > 0) bullets.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) bullets.push(current.join('\n'));

  const globs = [];
  const ambiguous = [];
  for (const bulletText of bullets) {
    let currentDir;
    for (const m of bulletText.matchAll(/`([^`]+)`/g)) {
      let glob = m[1];
      if (glob.includes('/')) {
        currentDir = glob.slice(0, glob.lastIndexOf('/'));
      } else if (currentDir) {
        if (/[*?{]/.test(glob)) {
          glob = `${currentDir}/${glob}`;
        } else {
          const carriedPath = `${currentDir}/${glob}`;
          const rootExists = pathExistsAtRef(glob);
          const carriedExists = pathExistsAtRef(carriedPath);
          if (rootExists && carriedExists) {
            ambiguous.push({ bareName: glob, carriedPath });
          } else if (rootExists) {
            // glob stays the bare root name
          } else {
            glob = carriedPath;
          }
        }
      }
      globs.push(glob);
    }
  }
  return { globs, ambiguous };
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

// takt-010 goal 1: an optional single lowercase letter suffix (`010b`) is its own slice, distinct from
// the plain `010` — before this, `\d{3}-` required the hyphen right after the three digits, so a
// branch like `claude/slice-010b-…` never matched at all and the gate fell through to "not on a
// claude/slice-NNN-… branch … skipping" (Quellen-ID: Bericht of 010b, exactly that skip). `findSpecFile`
// below already keeps `010` and `010b` apart on its own — its prefix match always includes the trailing
// hyphen (`010-` vs `010b-`), so passing the fuller number through here is the only change needed.
function detectSliceFromBranch(root) {
  const branch = resolveBranchName(root);
  if (!branch) return undefined;
  const m = branch.match(/^claude\/(slice|takt)-(\d{3}[a-z]?)-/);
  return m ? { kind: m[1], number: m[2], branch } : undefined;
}

// ---- git diff --------------------------------------------------------------------------------------

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The first commit, reachable from `HEAD` but not from `mergeBase`, that adds `specRelPath` —
 * `undefined` if no such commit exists (the file is not new on this branch at all, or something about
 * the log call itself fails). takt-006 point 3: a slice's spec is typically added on the slice's own
 * branch, in its first commit touching that path — it does not exist at the merge-base with the
 * integration branch at all, so `mergeBase` itself is never the right reference point to diff
 * "Files allowed" against; the commit that *introduced* the file is. */
function findSpecIntroducingCommit(root, mergeBase, specRelPath) {
  try {
    const log = git(root, ['log', '--reverse', '--format=%H', '--diff-filter=A', `${mergeBase}..HEAD`, '--', specRelPath]).trim();
    return log ? log.split('\n')[0] : undefined;
  } catch {
    return undefined;
  }
}

/** Round 1, m4 (takt-006 point 3 fixed the reference point): a warning (never a failure) when the
 * spec's own "Files allowed" section has changed since it was first introduced — widening (or
 * narrowing) what a slice may touch mid-implementation is not wrong, but it is exactly the kind of
 * thing a reviewer should notice, not discover by diffing the spec by hand.
 *
 * The reference is the spec's content at `mergeBase` if it already existed there (an edge case: a spec
 * committed before the slice branch even forked); otherwise — the ordinary case — the commit that
 * first added the file *on this branch* (`findSpecIntroducingCommit`), so a later commit widening
 * "Files allowed" is still caught even though the merge-base itself never had the file at all (the bug
 * round 1's version had: comparing only against the merge-base always saw "no spec there yet" and gave
 * up, silently, for every ordinary slice). `undefined` (no warning) if the spec is not found at either
 * reference point, or the comparison itself fails for any reason (never blocks on that); otherwise
 * `{ changed, refCommit, viaIntroducingCommit }`. */
function filesAllowedChangedSinceMergeBase(root, mergeBase, specRelPath, currentSectionText) {
  let baseText;
  let refCommit = mergeBase;
  let viaIntroducingCommit = false;
  try {
    baseText = git(root, ['show', `${mergeBase}:${specRelPath}`]);
  } catch {
    const introducingCommit = findSpecIntroducingCommit(root, mergeBase, specRelPath);
    if (!introducingCommit) return undefined; // not found at the merge-base or introduced on this branch
    try {
      baseText = git(root, ['show', `${introducingCommit}:${specRelPath}`]);
      refCommit = introducingCommit;
      viaIntroducingCommit = true;
    } catch {
      return undefined;
    }
  }
  try {
    const baseSection = extractFilesAllowedSection(baseText);
    if (baseSection === undefined) return undefined;
    return { changed: baseSection.trim() !== currentSectionText.trim(), refCommit, viaIntroducingCommit };
  } catch {
    return undefined;
  }
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
        console.log(
          'slice-scope: not on a claude/slice-NNN-…/claude/takt-NNN-… branch, or their lettered-suffix ' +
            'form claude/slice-NNNx-…/claude/takt-NNNx-… (checked GITHUB_HEAD_REF and git HEAD) and no ' +
            '--slice/--takt/--spec given — skipping.',
        );
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

  // takt-010 rework (blocker/Codex P2): the merge-base is resolved here, *before* parsing "Files
  // allowed", because a bare name's root-vs-carried-directory reading (`makeRootFileChecker`) must be
  // decided against that fixed reference point, not the (still-to-be-diffed) working tree. `--diff`
  // mode has no merge-base at all — bypassing git is the whole point of `--diff` — so it is skipped here
  // and `mergeBase` stays `undefined`.
  let mergeBase;
  if (!args.diff) {
    try {
      mergeBase = git(root, ['merge-base', 'HEAD', args.base]).trim();
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

  const pathExistsAtRef = makeRootFileChecker(root, mergeBase);
  const { globs, ambiguous } = extractGlobs(sectionText, pathExistsAtRef);
  if (ambiguous.length > 0) {
    console.error(
      `slice-scope: ${specRelPath}'s "Files allowed" section has ${ambiguous.length} ambiguous bare ` +
        'name(s) — write the full path instead:',
    );
    for (const a of ambiguous) {
      console.error(`  \`${a.bareName}\` matches both the repository root and \`${a.carriedPath}\``);
    }
    return 1;
  }
  if (globs.length === 0) {
    console.error(`slice-scope: ${specRelPath}'s "Files allowed" section has no backtick-quoted path.`);
    return 1;
  }
  // Round 1, m4: a bare `*`/`**` (not `dir/*`/`dir/**`) would allow "any file at the repository root"
  // or "any file anywhere" — almost certainly a typo, and dangerous enough to refuse outright rather
  // than silently apply it.
  const bareWildcards = globs.filter((g) => g === '*' || g === '**');
  if (bareWildcards.length > 0) {
    console.error(
      `slice-scope: ${specRelPath}'s "Files allowed" section has a bare "${bareWildcards[0]}" pattern ` +
        '(matches every file at the repository root, or everywhere) — write a directory prefix instead.',
    );
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
      const out = git(root, ['diff', '--name-only', `${mergeBase}...HEAD`]);
      changed = out.split('\n').filter(Boolean);
      const filesAllowedChange = filesAllowedChangedSinceMergeBase(root, mergeBase, specRelPath, sectionText);
      if (filesAllowedChange?.changed) {
        const where = filesAllowedChange.viaIntroducingCommit
          ? `at the commit that introduced it (${filesAllowedChange.refCommit.slice(0, 7)})`
          : `at the merge-base (${filesAllowedChange.refCommit.slice(0, 7)}) with ${args.base}`;
        console.log(`slice-scope: warning — "${specRelPath}"'s "Files allowed" section differs from its version ${where}.`);
      }
    } catch (e) {
      const reason = e.message.split('\n')[0];
      if (inCI && sliceIdentified) {
        console.error(
          `slice-scope: could not resolve the diff against ${args.base} (${reason}) — failing instead of ` +
            'skipping: a slice/takt branch is identified and CI is set (round 1, M1).',
        );
        return 1;
      }
      console.log(`slice-scope: could not resolve the diff against ${args.base} (${reason}) — skipping.`);
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
