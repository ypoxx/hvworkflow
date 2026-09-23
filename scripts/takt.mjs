#!/usr/bin/env node
/**
 * Reads the "## Takt" table of `docs/messung.md` (or the file given via `--file`) and prints the
 * point count, how many are still open and the median duration overall and per class (S/M/L).
 * No dependency, no entry in package.json (docs/slices/014-entscheidungsregister.md point 9).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const TIME_ZONE = 'Europe/Berlin';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
// Resolved from the script's own location, not the process's cwd, so `node scripts/takt.mjs` gives
// the same file no matter where it is invoked from.
const DEFAULT_FILE = resolve(SCRIPT_DIR, '..', 'docs', 'messung.md');

function parseArgs(argv) {
  let filePath = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--file' && i + 1 < argv.length) {
      filePath = argv[i + 1];
      i += 1;
    }
  }
  return filePath;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const explicitFile = parseArgs(process.argv.slice(2));
const fullPath =
  explicitFile === null
    ? DEFAULT_FILE
    : explicitFile.startsWith('/')
      ? explicitFile
      : resolve(process.cwd(), explicitFile);

let content;
try {
  content = readFileSync(fullPath, 'utf-8');
} catch {
  fail(`Fehler: Datei nicht lesbar: ${fullPath}`);
}

const taktIndex = content.indexOf('## Takt');
if (taktIndex === -1) {
  // A missing section is a broken contract between this script and the document, not an empty
  // table — the caller should see this as a failure, not read "0 Punkte" as a valid measurement.
  fail(`Fehler: Abschnitt "## Takt" nicht gefunden in ${fullPath}`);
}

const lines = content.slice(taktIndex).split('\n');

/** Splits one markdown table row by position, keeping empty cells (an empty Live or Quelle cell
 *  must not shift every column after it). Leading/trailing pipes are stripped once, not filtered. */
function splitRow(line) {
  const trimmed = line.trim();
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return body.split('|').map((cell) => cell.trim());
}

function isSeparatorRow(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && /^\|[\s:|-]+\|$/.test(trimmed);
}

let headerLineIndex = -1;
let separatorLineIndex = -1;
for (let i = 0; i < lines.length; i += 1) {
  const trimmed = lines[i].trim();
  if (trimmed.startsWith('|') && headerLineIndex === -1) {
    headerLineIndex = i;
    continue;
  }
  if (headerLineIndex !== -1 && isSeparatorRow(lines[i])) {
    separatorLineIndex = i;
    break;
  }
  // A header line must be followed directly by the separator; anything else under "## Takt" before
  // a table starts (e.g. the intro prose) resets the search.
  if (headerLineIndex !== -1 && separatorLineIndex === -1 && !trimmed.startsWith('|')) {
    headerLineIndex = -1;
  }
}

if (headerLineIndex === -1 || separatorLineIndex === -1) {
  fail(`Fehler: Keine Tabelle unter "## Takt" gefunden in ${fullPath}`);
}

// Column map by header name (not position), so a reordered or widened table still reads correctly.
// "Dauer (h)" normalises to "Dauer": the parenthetical unit suffix is not part of the column name.
const headerCells = splitRow(lines[headerLineIndex]).map((cell) => cell.replace(/\s*\([^)]*\)\s*$/, ''));
const REQUIRED_COLUMNS = ['Punkt', 'Quelle', 'Klasse', 'Nachricht', 'Live'];
const columnIndex = {};
for (const name of REQUIRED_COLUMNS) {
  const index = headerCells.indexOf(name);
  if (index === -1) fail(`Fehler: Spalte "${name}" fehlt in der Takt-Tabelle von ${fullPath}`);
  columnIndex[name] = index;
}

const dataLines = [];
for (let i = separatorLineIndex + 1; i < lines.length; i += 1) {
  if (!lines[i].trim().startsWith('|')) break;
  dataLines.push(lines[i]);
}

const rows = dataLines.map((line) => {
  const cells = splitRow(line);
  return {
    punkt: cells[columnIndex.Punkt] ?? '',
    quelle: cells[columnIndex.Quelle] ?? '',
    klasse: cells[columnIndex.Klasse] ?? '',
    nachricht: cells[columnIndex.Nachricht] ?? '',
    live: cells[columnIndex.Live] ?? '',
  };
});

if (rows.length === 0) {
  console.log('0 Punkte');
  process.exit(0);
}

/**
 * The UTC offset (in minutes) Europe/Berlin has at a given instant — read from `Intl`, so the
 * answer does not depend on the process's own `TZ` environment variable.
 */
function berlinOffsetMinutes(instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asIfUtc - instant.getTime()) / 60000;
}

/**
 * A "JJJJ-MM-TT HH:MM" wall-clock reading in Europe/Berlin → epoch milliseconds. Two-step fixed
 * point (enough outside the one folded/skipped hour a year, which this table never lands on for a
 * Bautag boundary) so the result is identical whether the process runs with TZ=UTC or
 * TZ=Europe/Berlin (R8, AGENTS.md: time is explicit, never ambient).
 */
function berlinWallClockToUtcMs(y, mo, d, h, mi) {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let step = 0; step < 2; step += 1) {
    const offsetMin = berlinOffsetMinutes(new Date(guess));
    guess = Date.UTC(y, mo - 1, d, h, mi) - offsetMin * 60000;
  }
  return guess;
}

const TIME_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/;

function parseBerlinTime(value) {
  const match = TIME_RE.exec(value.trim());
  if (match === null) return null;
  const [, y, mo, d, h, mi] = match;
  return berlinWallClockToUtcMs(Number(y), Number(mo), Number(d), Number(h), Number(mi));
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const durations = [];
const durationsByClass = { S: [], M: [], L: [] };
let openPoints = 0;

for (const row of rows) {
  if (row.live.trim() === '') {
    openPoints += 1;
    continue;
  }

  const nachrichtMs = parseBerlinTime(row.nachricht);
  const liveMs = parseBerlinTime(row.live);
  if (nachrichtMs === null || liveMs === null) {
    console.error(
      `Warnung: Punkt "${row.punkt}": Nachricht oder Live nicht im Format "JJJJ-MM-TT HH:MM" lesbar — zählt als offen.`,
    );
    openPoints += 1;
    continue;
  }

  const durationHours = (liveMs - nachrichtMs) / (1000 * 60 * 60);
  if (durationHours < 0) {
    console.error(`Warnung: Punkt "${row.punkt}": Live liegt vor Nachricht — zählt als offen.`);
    openPoints += 1;
    continue;
  }

  durations.push(durationHours);
  const klasse = row.klasse.trim().toUpperCase();
  if (klasse === 'S' || klasse === 'M' || klasse === 'L') {
    durationsByClass[klasse].push(durationHours);
  } else {
    console.error(
      `Warnung: Punkt "${row.punkt}": Klasse "${row.klasse}" ist keine von S/M/L — zählt nicht in eine Klassen-Median.`,
    );
  }
}

const medianOverall = median(durations);
const medianS = median(durationsByClass.S);
const medianM = median(durationsByClass.M);
const medianL = median(durationsByClass.L);

console.log(`${rows.length} Punkte`);
console.log(`${openPoints} offen`);
console.log(medianOverall !== null ? `Median gesamt: ${medianOverall.toFixed(2)} h` : 'Median gesamt: —');
console.log(medianS !== null ? `Median S: ${medianS.toFixed(2)} h` : 'Median S: —');
console.log(medianM !== null ? `Median M: ${medianM.toFixed(2)} h` : 'Median M: —');
console.log(medianL !== null ? `Median L: ${medianL.toFixed(2)} h` : 'Median L: —');
