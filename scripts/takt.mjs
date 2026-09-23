#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
let filePath = 'docs/messung.md';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && i + 1 < args.length) {
    filePath = args[i + 1];
  }
}

// Read file - if relative path, resolve from current directory
const fullPath = filePath.startsWith('/') ? filePath : resolve(process.cwd(), filePath);
let content;
try {
  content = readFileSync(fullPath, 'utf-8');
} catch (err) {
  console.error(`Error reading file: ${fullPath}`);
  process.exit(1);
}

// Find the "## Takt" section
const taktIndex = content.indexOf('## Takt');
if (taktIndex === -1) {
  console.log('0 Punkte');
  process.exit(0);
}

// Find the table start: first line starting with | after ## Takt
const afterTakt = content.substring(taktIndex);
const lines = afterTakt.split('\n');

let tableStart = -1;
let separatorFound = false;
let dataStartIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('|') && !separatorFound) {
    tableStart = i;
  }
  if (tableStart >= 0 && lines[i].includes('---') && lines[i].startsWith('|')) {
    separatorFound = true;
    dataStartIndex = i + 1;
    break;
  }
}

if (!separatorFound || dataStartIndex < 0) {
  console.log('0 Punkte');
  process.exit(0);
}

// Parse data rows
const rows = [];
for (let i = dataStartIndex; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('|')) {
    break;
  }

  const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
  // Expected: Punkt | Quelle | Klasse | Nachricht | Live | Dauer
  // That's 6 columns, but last might be empty
  if (cells.length >= 5) {
    rows.push({
      punkt: cells[0],
      quelle: cells[1],
      klasse: cells[2],
      nachricht: cells[3],
      live: cells[4],
      dauer: cells[5] || ''
    });
  }
}

if (rows.length === 0) {
  console.log('0 Punkte');
  process.exit(0);
}

// Parse dates and compute durations
const durations = [];
const durationsByClass = { S: [], M: [], L: [] };
let openPoints = 0;

for (const row of rows) {
  if (!row.live || row.live === '') {
    openPoints++;
    continue;
  }

  // Parse times: JJJJ-MM-TT HH:MM
  const nachrichtMatch = row.nachricht.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  const liveMatch = row.live.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);

  if (!nachrichtMatch || !liveMatch) {
    openPoints++;
    continue;
  }

  const nachrichtTime = new Date(
    parseInt(nachrichtMatch[1]),
    parseInt(nachrichtMatch[2]) - 1,
    parseInt(nachrichtMatch[3]),
    parseInt(nachrichtMatch[4]),
    parseInt(nachrichtMatch[5])
  );

  const liveTime = new Date(
    parseInt(liveMatch[1]),
    parseInt(liveMatch[2]) - 1,
    parseInt(liveMatch[3]),
    parseInt(liveMatch[4]),
    parseInt(liveMatch[5])
  );

  const durationMs = liveTime - nachrichtTime;
  if (durationMs < 0) {
    openPoints++;
    continue;
  }

  const durationHours = durationMs / (1000 * 60 * 60);
  durations.push(durationHours);

  const klasse = row.klasse.toUpperCase();
  if (durationsByClass[klasse]) {
    durationsByClass[klasse].push(durationHours);
  }
}

// Calculate medians
function median(arr) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

const totalPoints = rows.length;
const medianOverall = median(durations);
const medianS = median(durationsByClass.S);
const medianM = median(durationsByClass.M);
const medianL = median(durationsByClass.L);

console.log(`${totalPoints} Punkte`);
console.log(`${openPoints} offen`);
if (medianOverall !== null) {
  console.log(`Median gesamt: ${medianOverall.toFixed(2)} h`);
} else {
  console.log('Median gesamt: —');
}
if (medianS !== null) {
  console.log(`Median S: ${medianS.toFixed(2)} h`);
}
if (medianM !== null) {
  console.log(`Median M: ${medianM.toFixed(2)} h`);
}
if (medianL !== null) {
  console.log(`Median L: ${medianL.toFixed(2)} h`);
}
