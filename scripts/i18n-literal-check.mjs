#!/usr/bin/env node
/**
 * i18n-Literal-Tor (AGENTS.md rule 10: every interface string goes through the i18n dictionary).
 * Scans `apps/web/src/features/**` and `apps/web/src/app/**` `.tsx` files for a visible string
 * literal in JSX text (`>literal text<`, no `{`/`}` in between — an expression child like
 * `{t('key')}` is not a literal, and may now span several lines, see below) or in one of the props
 * `title`, `aria-label`, `placeholder`, `alt`, `label` written as a plain quoted string instead of an
 * expression (`title={t('key')}` is fine, `title="Text"` is a finding).
 *
 * Exceptions: `data-testid` and `className` are never watched props regardless of content; a
 * candidate made up only of punctuation/digits/whitespace (`·`, `—`, `/`, `12`, …) is not a finding;
 * a line carrying an `i18n-ok: <reason>` comment suppresses every finding on that line, the same
 * convention as `now-ok`/`gitleaks` allowlisting elsewhere in this repository.
 *
 * This is a plain text scan, not a JSX parser (consistent with the other gates in `scripts/`): it can,
 * rarely, flag something that is not actually rendered — a TypeScript generic's closing `>` right
 * before a type annotation, e.g. `): Promise<boolean>`, reads like a tag close otherwise; the
 * `looksLikeCodeNotProse` guard below is what a real JSX text node never starts with or contains,
 * catching exactly that shape without a full parser.
 *
 * Review rework round 1, M6:
 *   - the count-based grace period is gone — every finding blocks, unconditionally (`pnpm gates`
 *     fails on any finding). It existed only for a hypothetical backlog; today's real count is 0 (see
 *     the report), so the condition it was gated on ("mehr als eine Handvoll") never applied, and a
 *     future large refactor introducing many literals at once is exactly the kind of change that
 *     should be caught immediately, not waved through with a grace period no later slice asked for.
 *   - `//` and `/* *\/` comments are masked (replaced with spaces, newlines kept so line numbers stay
 *     correct) *before* either scan runs, so a comment that merely *talks about* JSX/HTML tags in
 *     prose — e.g. `{/* no <div>/<p> inside a <button> *\/}` — can never be misread as real tag
 *     boundaries (confirmed against `apps/web/src/features/stage/Podium.tsx:101` in slice 020,
 *     a real false positive of exactly this shape before this fix — see the report).
 *   - JSX text may now span multiple lines (`[^<>{}]+` instead of `[^<>{}\n]+`), capped at 4 embedded
 *     newlines and rejected if it contains a semicolon, `=` or a backtick (`looksLikeCodeNotProse`) —
 *     real UI copy is short and prose-shaped; a long run of code with neither `<`, `>`, `{` nor `}` at
 *     all is rare enough, and now additionally filtered, that this stays practical without a full
 *     parser.
 *
 * Run as `pnpm i18n-literals` (part of `pnpm gates`). `--root <dir>` and `--scan-roots a,b` point it at
 * a different tree, for tests (and for checking a sibling worktree, e.g. `--root ../other-worktree`).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const SCAN_ROOTS = ['apps/web/src/features', 'apps/web/src/app'];
const WATCHED_PROPS = ['title', 'aria-label', 'placeholder', 'alt', 'label'];
const WATCHED_PROPS_ALT = WATCHED_PROPS.join('|');

function parseArgs(argv) {
  const out = { scanRoots: SCAN_ROOTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') process.chdir(argv[++i]); // test hook: scan a fixture tree, or a sibling worktree
    else if (a === '--scan-roots') out.scanRoots = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else throw new Error(`i18n-literal-check: unknown argument "${a}"`);
  }
  return out;
}

function collectTsxFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) out.push(full);
    }
  };
  if (statSync(root, { throwIfNoEntry: false })) walk(root);
  return out;
}

/** Replaces every `//` and `/* *\/` comment with spaces of the same length (newlines kept), so a
 * comment that merely mentions tag-like text in prose can never be scanned as real JSX/attributes
 * (round 1, M6). Length- and newline-preserving, so line numbers of real code stay correct. */
function maskComments(text) {
  const withoutBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return withoutBlockComments.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/** True if the candidate has no letters at all once whitespace is stripped — pure punctuation,
 * digits, or a mix of both (`·`, `—`, `12`, `1/2`, `%`, an empty string). */
function isPurePunctuationOrNumbers(text) {
  const stripped = text.replace(/\s+/g, '');
  if (stripped === '') return true;
  return !/\p{L}/u.test(stripped);
}

/** "HV" (Hauptversammlung, docs/glossar.md) is this project's own event abbreviation, used in two
 * places as a visual monogram (a small square badge; `aria-hidden="true"` where marked) rather than
 * translatable prose — a deliberate, *named* exception, not a general "short uppercase word" rule
 * (which would also swallow a real short word like "OK"/"Ja"). Flagged in the report for review: this
 * is a judgement call, not a mechanical one. */
function isHouseAbbreviationMonogram(text) {
  return text === 'HV';
}

/** A JSX text node never starts with a closing bracket or a colon, never contains a semicolon, `=`,
 * a backtick, `&&` or `||`, and never has unbalanced parentheses, in real UI copy; a TypeScript
 * generic's closing `>` immediately followed by a type annotation (e.g. `): Promise<boolean>`) does,
 * and so does a run of ordinary code that happens to contain neither `<`, `>`, `{` nor `}` for a while
 * (round 1, M6, once multi-line matches are allowed at all — e.g. a JSX-guard expression
 * `{total > results.length && (` or a ternary `{cond ? (\n  a\n) : (`). */
function looksLikeCodeNotProse(text) {
  if (/^[)\]};:,.]/.test(text)) return true;
  if (/[;=`]/.test(text)) return true;
  if (/&&|\|\|/.test(text)) return true;
  const openParens = (text.match(/\(/g) ?? []).length;
  const closeParens = (text.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) return true;
  return false;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
function lineText(text, index) {
  const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1);
  const end = text.indexOf('\n', index) === -1 ? text.length : text.indexOf('\n', index);
  return text.slice(start, end);
}

/** Every `>literal text<` JSX text node — no `{`/`}` in between, so an expression child is never a
 * match — with pure whitespace, punctuation-or-numbers, and lines carrying `i18n-ok:` excluded. May
 * span up to 4 embedded newlines (round 1, M6: real JSX text can wrap over several source lines). */
// `i18n-ok:` is checked against the *original* (unmasked) text, not the comment-masked copy the
// finder regexes run over — otherwise a suppressing comment would blank out its own marker before it
// could ever be read. Masking is length- and newline-preserving, so a character index found in the
// masked text points at the exact same place in the original.
function jsxTextFindings(maskedText, originalText) {
  const out = [];
  // A negative lookbehind excludes `=>`/`->` (an arrow function, not a closing JSX tag) from ever
  // starting a match — otherwise e.g. `(): Promise<string> => {` reads the arrow's `>` as a tag close
  // and "Promise" as its text child.
  const re = /(?<![=-])>([^<>{}]+)</g;
  let m;
  while ((m = re.exec(maskedText))) {
    const raw = m[1];
    if ((raw.match(/\n/g) ?? []).length > 4) continue; // a genuine short UI text node is short
    const candidate = raw.replace(/\s+/g, ' ').trim();
    if (candidate === '' || isPurePunctuationOrNumbers(candidate) || looksLikeCodeNotProse(candidate) || isHouseAbbreviationMonogram(candidate)) continue;
    const index = m.index + 1;
    if (/i18n-ok:\s*\S/.test(lineText(originalText, index))) continue;
    out.push({ line: lineOf(maskedText, index), text: candidate });
  }
  return out;
}

/** Every `title="…"`/`aria-label='…'`/… — a plain quoted literal, never `title={…}` (an expression). */
function attributeFindings(maskedText, originalText) {
  const out = [];
  const re = new RegExp(`\\b(?:${WATCHED_PROPS_ALT})\\s*=\\s*(["'])((?:(?!\\1).)*)\\1`, 'g');
  let m;
  while ((m = re.exec(maskedText))) {
    const candidate = m[2].trim();
    if (candidate === '' || isPurePunctuationOrNumbers(candidate)) continue;
    if (/i18n-ok:\s*\S/.test(lineText(originalText, m.index))) continue;
    out.push({ line: lineOf(maskedText, m.index), text: m[0] });
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const findings = [];
  for (const root of args.scanRoots) {
    for (const absFile of collectTsxFiles(root)) {
      const rel = relative(process.cwd(), absFile).split('\\').join('/');
      const original = readFileSync(absFile, 'utf8');
      const masked = maskComments(original);
      for (const f of [...jsxTextFindings(masked, original), ...attributeFindings(masked, original)]) {
        findings.push({ file: rel, ...f });
      }
    }
  }
  findings.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

  if (findings.length > 0) {
    console.log(`i18n-literal check: ${findings.length} literal(s) found under ${args.scanRoots.join(', ')}:`);
    for (const f of findings) console.log(`  ${f.file}:${f.line}: ${f.text}`);
  } else {
    console.log(`i18n-literal check: 0 literals found under ${args.scanRoots.join(', ')}.`);
  }

  if (findings.length > 0) {
    console.error('\ni18n-literal check failed (AGENTS.md rule 10): move every literal above into the i18n dictionary.');
    return 1;
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
