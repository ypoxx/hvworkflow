#!/usr/bin/env node
/**
 * i18n-Literal-Tor (AGENTS.md rule 10: every interface string goes through the i18n dictionary).
 * Scans `apps/web/src/features/**` and `apps/web/src/app/**` `.tsx` files for a visible string
 * literal in JSX text (`>literal text<`, no `{`/`}` in between — an expression child like
 * `{t('key')}` is not a literal) or in one of the props `title`, `aria-label`, `placeholder`, `alt`,
 * `label` written as a plain quoted string instead of an expression (`title={t('key')}` is fine,
 * `title="Text"` is a finding).
 *
 * Exceptions: `data-testid` and `className` are never watched props regardless of content; a
 * candidate made up only of punctuation/digits/whitespace (`·`, `—`, `/`, `12`, …) is not a finding;
 * a line carrying an `i18n-ok: <reason>` comment suppresses every finding on that line, the same
 * convention as `now-ok`/`gitleaks` allowlisting elsewhere in this repository.
 *
 * This is a plain text scan, not a JSX parser (consistent with the other gates in `scripts/`): it can
 * miss a literal split across lines and, rarely, flag something that is not actually rendered — a TS
 * generic's closing `>` right before a type annotation, e.g. `): Promise<boolean>`, reads like a tag
 * close otherwise; the `looksLikeCodeNotProse` guard below is what a real JSX text node never starts
 * with, catching exactly that shape without a full parser.
 *
 * Run as `pnpm i18n-literals` (part of `pnpm gates`). Every finding is listed either way; whether it
 * also blocks depends on the count, per the slice spec: today's run finds 0 (see the report), so the
 * gate is fully blocking from day one — "mehr als eine Handvoll" (more than `HANDFUL`) never applies
 * yet. If a later change ever pushes the count past `HANDFUL` at once (e.g. a large refactor), the
 * gate becomes a non-blocking warning instead of freezing `pnpm gates` red, but only up to
 * `GRACE_PERIOD_UNTIL` — after that date it blocks regardless of count, so the exception can never
 * silently become permanent. `--strict` blocks immediately regardless of the date, for tests.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const SCAN_ROOTS = ['apps/web/src/features', 'apps/web/src/app'];
const WATCHED_PROPS = ['title', 'aria-label', 'placeholder', 'alt', 'label'];
const WATCHED_PROPS_ALT = WATCHED_PROPS.join('|');

const HANDFUL = 5; // "mehr als eine Handvoll" (spec wording) — a count, not a date.
// Only reached if a future change pushes the count above HANDFUL; no apps/web/src/** file is in this
// slice's "Files allowed", so slice 016 itself cannot fix a backlog even if one existed. Plan 8.3: the
// "Bau" phase's construction is meant to be done a couple of days before this (04.12.), well after the
// M0/M1 oberflächen-slice 020 (02.10.) would have had a chance to clear any such backlog.
const GRACE_PERIOD_UNTIL = '2026-11-02';

function parseArgs(argv) {
  const out = { strict: false, today: new Date().toISOString().slice(0, 10), scanRoots: SCAN_ROOTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') out.strict = true;
    else if (a === '--today') out.today = argv[++i]; // test hook: pretend it is a different date
    else if (a === '--root') process.chdir(argv[++i]); // test hook: scan a fixture tree instead
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

/** True if the candidate has no letters at all once whitespace is stripped — pure punctuation,
 * digits, or a mix of both (`·`, `—`, `12`, `1/2`, `%`, an empty string). */
function isPurePunctuationOrNumbers(text) {
  const stripped = text.replace(/\s+/g, '');
  if (stripped === '') return true;
  return !/\p{L}/u.test(stripped);
}

/** A JSX text node never starts with a closing bracket or a colon in real UI copy; a TypeScript
 * generic's closing `>` immediately followed by a type annotation (e.g. `): Promise<boolean>`) does.
 * This is the one further false-positive shape single-line-only and the `=>` lookbehind do not catch
 * on their own. */
function looksLikeCodeNotProse(text) {
  return /^[)\]};:,.]/.test(text);
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
function lineText(text, index) {
  const start = Math.max(0, text.lastIndexOf('\n', index - 1) + 1);
  const end = text.indexOf('\n', index) === -1 ? text.length : text.indexOf('\n', index);
  return text.slice(start, end);
}

/** Every `>literal text<` JSX text node — no `{`/`}` in between, so an expression child is never a
 * match — with pure whitespace, punctuation-or-numbers, and lines carrying `i18n-ok:` excluded. */
function jsxTextFindings(text) {
  const out = [];
  // A negative lookbehind excludes `=>`/`->` (an arrow function, not a closing JSX tag) from ever
  // starting a match — otherwise e.g. `(): Promise<string> => {` reads the arrow's `>` as a tag close
  // and "Promise" as its text child.
  const re = /(?<![=-])>([^<>{}\n]+)</g;
  let m;
  while ((m = re.exec(text))) {
    const candidate = m[1].trim();
    if (candidate === '' || isPurePunctuationOrNumbers(candidate) || looksLikeCodeNotProse(candidate)) continue;
    const index = m.index + 1;
    if (/i18n-ok:\s*\S/.test(lineText(text, index))) continue;
    out.push({ line: lineOf(text, index), text: candidate });
  }
  return out;
}

/** Every `title="…"`/`aria-label='…'`/… — a plain quoted literal, never `title={…}` (an expression). */
function attributeFindings(text) {
  const out = [];
  const re = new RegExp(`\\b(?:${WATCHED_PROPS_ALT})\\s*=\\s*(["'])((?:(?!\\1).)*)\\1`, 'g');
  let m;
  while ((m = re.exec(text))) {
    const candidate = m[2].trim();
    if (candidate === '' || isPurePunctuationOrNumbers(candidate)) continue;
    if (/i18n-ok:\s*\S/.test(lineText(text, m.index))) continue;
    out.push({ line: lineOf(text, m.index), text: m[0] });
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const findings = [];
  for (const root of args.scanRoots) {
    for (const absFile of collectTsxFiles(root)) {
      const rel = relative(process.cwd(), absFile).split('\\').join('/');
      const text = readFileSync(absFile, 'utf8');
      for (const f of [...jsxTextFindings(text), ...attributeFindings(text)]) {
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

  if (findings.length === 0) return 0;

  const withinGracePeriod = findings.length > HANDFUL && args.today < GRACE_PERIOD_UNTIL && !args.strict;
  if (withinGracePeriod) {
    console.log(
      `\ni18n-literal check: ${findings.length} > ${HANDFUL} ("mehr als eine Handvoll") — warning only ` +
        `until ${GRACE_PERIOD_UNTIL}, not blocking yet.`,
    );
    return 0;
  }

  console.error(
    `\ni18n-literal check failed (AGENTS.md rule 10): move every literal above into the i18n dictionary ` +
      `(non-blocking only applies above ${HANDFUL} findings, and only until ${GRACE_PERIOD_UNTIL}).`,
  );
  return 1;
}

process.exit(main(process.argv.slice(2)));
