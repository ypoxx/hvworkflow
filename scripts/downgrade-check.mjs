#!/usr/bin/env node
/**
 * Herabstufungs-Tor (downgrade gate). A human decides a downgrade, never an agent
 * (docs/qualitaetsleitplanken-produktreife.md section 4). This script compares the risk class in a
 * spec's own header (`**Risikoklasse:** niedrig|mittel|hoch`, docs/slices/NNN-*.md) against the class
 * `docs/produktplan-beta.md` section 5 assigns that same slice number
 * (`- **NNN · Titel** — <klasse> · …`). If the spec is lower, the spec must contain the line
 * `Herabstufung freigegeben von <Name> am <TT.MM.JJJJ>`, or the gate fails.
 *
 * Run as `pnpm downgrade-check` (part of `pnpm gates`) over every `docs/slices/NNN-*.md` with a
 * three-digit number 009-099 (the plan's numbering range; 001-008 predate the plan and never appear
 * in it). Deterministic, no network. `--plan <path>` and `--slices-dir <dir>` override the two inputs
 * for tests.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const CLASS_RANK = { niedrig: 0, mittel: 1, hoch: 2 };
const DOWNGRADE_LINE_RE = /Herabstufung freigegeben von .+ am \d{2}\.\d{2}\.\d{4}/;
const SPEC_CLASS_RE = /^\*\*Risikoklasse:\*\*\s*(niedrig|mittel|hoch)\b/m;
const BULLET_RE = /^- \*\*(\d{3}) · [^*]+\*\* — (niedrig|mittel|hoch) ·/;

function parseArgs(argv) {
  const out = { plan: 'docs/produktplan-beta.md', slicesDir: 'docs/slices' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan') out.plan = argv[++i];
    else if (a === '--slices-dir') out.slicesDir = argv[++i];
    else throw new Error(`downgrade-check: unknown argument "${a}"`);
  }
  return out;
}

/** Slice number -> risk class, from every `- **NNN · Titel** — <klasse> · …` bullet in section 5 of
 * the product plan (5.0's coverage matrix and 5.1's lane table are plain tables, never such bullets). */
function planClasses(planPath) {
  const text = readFileSync(planPath, 'utf8');
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l) => /^## 5\./.test(l));
  if (startIdx === -1) throw new Error(`${planPath}: no "## 5." heading found.`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## \d/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  const classes = new Map();
  for (const line of lines.slice(startIdx, endIdx)) {
    const m = line.match(BULLET_RE);
    if (m) classes.set(m[1], m[2]);
  }
  return classes;
}

function specFiles(slicesDir) {
  return readdirSync(slicesDir)
    .map((f) => f.match(/^(\d{3})-.*\.md$/))
    .filter((m) => m && Number(m[1]) >= 9 && Number(m[1]) <= 99)
    .map((m) => ({ number: m[1], file: m[0] }));
}

function main(argv) {
  const args = parseArgs(argv);
  const classes = planClasses(args.plan);
  const problems = [];
  let checked = 0;

  for (const { number, file } of specFiles(args.slicesDir)) {
    const planClass = classes.get(number);
    if (planClass === undefined) {
      problems.push(`${file}: slice ${number} has no risk-class bullet in ${args.plan} section 5.`);
      continue;
    }
    const specPath = join(args.slicesDir, file);
    const specText = readFileSync(specPath, 'utf8');
    const specMatch = specText.match(SPEC_CLASS_RE);
    if (!specMatch) {
      problems.push(`${specPath}: no "**Risikoklasse:** niedrig|mittel|hoch" header line.`);
      continue;
    }
    checked++;
    const specClass = specMatch[1];
    if (CLASS_RANK[specClass] < CLASS_RANK[planClass] && !DOWNGRADE_LINE_RE.test(specText)) {
      problems.push(
        `${specPath}: risk class "${specClass}" is lower than "${planClass}" in ${args.plan} section 5, ` +
          'without a "Herabstufung freigegeben von <Name> am <TT.MM.JJJJ>" line.',
      );
    }
  }

  if (problems.length > 0) {
    console.error('Downgrade check failed (docs/qualitaetsleitplanken-produktreife.md section 4: a human decides a downgrade):');
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }

  console.log(`Downgrade check: ${checked} spec(s) with a number 009-099, no unauthorised risk-class downgrade against ${args.plan}.`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
