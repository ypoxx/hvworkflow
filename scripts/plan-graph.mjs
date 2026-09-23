#!/usr/bin/env node
/**
 * Plan-Graph-Prüfung (plan-graph gate). Parses every slice bullet in section 5 ("Meilensteine und
 * Scheiben") of `docs/produktplan-beta.md` — number, title, risk class, effort (AStd), documented
 * calendar date, lanes, dependencies — and checks:
 *   - every dependency number exists as a slice;
 *   - no dependency cycle;
 *   - every dependency's documented calendar date is on or before its dependant's (same day: the
 *     dependency must appear earlier in the section — "Innerhalb eines Meilensteins stehen die
 *     Scheiben in der Reihenfolge ihres Starts");
 *   - slices that start on the same documented day and share a lane are reported (a warning; with
 *     `--strict`, a failure) — two simultaneous slices never share a lane (5.1).
 *
 * `--calendar` recomputes the calendar from the dependency graph and the model in Plan section 8.3
 * (work days Monday-Friday, none 24 Dec-1 Jan; `--hours` (default 3) Agentenstunden per active slice
 * per work day; at most three slices run in parallel; two simultaneous slices never share a lane;
 * a handful of slices have an externally-set earliest start date, taken from the small table below,
 * sourced from Plan 8.3's prose) and prints the computed start/finish date per slice.
 * `--merged a,b,c` removes already-merged slice numbers from the schedule (their dependants treat them
 * as finished from day one). Only the base check (without `--calendar`) is part of `pnpm gates`
 * (`pnpm plan-graph`) — recomputing the calendar is a report/what-if tool, run by hand.
 *
 * `--plan <path>` points at a different (e.g. fixture) copy of the plan, for tests.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
process.chdir(ROOT);

const DEFAULT_PLAN_PATH = 'docs/produktplan-beta.md';
const HOURS_PER_CLASS_PATTERN = /^- \*\*(\d{3}) · ([^*]+)\*\* — (niedrig|mittel|hoch) · ([\d,]+) AStd · Kalender ([^·]+) · Lanes?: (.+)$/;
const DEP_LINE_RE = /^\s*- \*Abhängigkeiten:\* (.+)$/;
const NEXT_BULLET_RE = /^- \*\*\d{3} ·/;

// Plan 8.3: "Äußere Termine setzen frühestmögliche Starts" — a small table, not derived from the
// document (the prose names occasions, not slice numbers); kept here with its source sentence.
const EXTERNAL_EARLIEST_START = {
  '043': { date: '2026-10-12', why: 'Vertrag 0.4.0 nach Feedback-Runde 2 (ab 12.10.)' },
  '064': { date: '2026-10-19', why: 'Ingest nach der Ansprechperson des Tool-Teams (ab 19.10.)' },
  '038': { date: '2026-11-02', why: 'Restore-Drill erst mit Staging-Host (ab 02.11.)' },
  '071': { date: '2026-11-02', why: 'Lasttest erst mit Staging-Host (ab 02.11.)' },
  '072': { date: '2026-11-02', why: 'Chaos erst mit Staging-Host (ab 02.11.)' },
  '074': { date: '2027-02-01', why: 'Sicherheitsprüfung im Pentest-Fenster (ab 01.02.)' },
  '076': { date: '2027-02-01', why: 'Rechtsprüfungs-Nachtrag nach der Rückmeldefrist (ab 01.02.)' },
  '077': { date: '2027-02-08', why: 'Freeze ab 08.02.' },
  '078': { date: '2027-02-15', why: 'Generalprobe 15.02.–05.03.' },
  '079': { date: '2027-03-08', why: 'Abnahme ab 08.03.' },
};
const BUILD_START_DATE = '2026-09-28'; // Plan 8.3: "Bau (28.09.–04.12.2026)"
// Plan 8.3: "Bautage Montag bis Freitag ohne 24.12.–01.01."
const HOLIDAY_WINDOW = { start: '2026-12-24', end: '2027-01-01' };

// ---- CLI -------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { strict: false, calendar: false, hours: 3, merged: new Set(), plan: DEFAULT_PLAN_PATH };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') out.strict = true;
    else if (a === '--calendar') out.calendar = true;
    else if (a === '--hours') out.hours = Number(argv[++i]);
    else if (a === '--merged') out.merged = new Set(argv[++i].split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--plan') out.plan = argv[++i];
    else throw new Error(`plan-graph: unknown argument "${a}"`);
  }
  return out;
}

// ---- parsing -----------------------------------------------------------------------------------------

function extractSection5(planText) {
  const lines = planText.split('\n');
  const startIdx = lines.findIndex((l) => /^## 5\./.test(l));
  if (startIdx === -1) throw new Error('no "## 5." heading found.');
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^## \d/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx);
}

/** "28.09.2026 (W1)" -> "2026-09-28"; "01.02.–05.02.2027 (W19)" -> "2027-02-01" (the *start* date;
 * the missing year on the first half is taken from the second). */
function parseCalendarStart(raw) {
  const withoutWeek = raw.replace(/\s*\(W[\dW–-]+\)\s*$/, '').trim();
  const [startRaw, endRaw] = withoutWeek.split('–'); // en dash, only present on a date range
  const full = (endRaw ?? startRaw).trim();
  const fullMatch = full.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!fullMatch) throw new Error(`cannot parse calendar date "${raw}"`);
  const year = fullMatch[3];
  const start = startRaw.trim();
  let dd;
  let mm;
  const startFull = start.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (startFull) {
    [, dd, mm] = startFull;
  } else {
    const startShort = start.match(/^(\d{2})\.(\d{2})\.$/);
    if (!startShort) throw new Error(`cannot parse calendar start date "${raw}"`);
    [, dd, mm] = startShort;
  }
  return `${year}-${mm}-${dd}`;
}

function parseSlices(planText) {
  const lines = extractSection5(planText);
  const slices = [];
  const byNumber = new Map();
  lines.forEach((line, i) => {
    const m = line.match(HOURS_PER_CLASS_PATTERN);
    if (!m) return;
    const [, number, title, riskClass, hoursRaw, calendarRaw, lanesRaw] = m;
    let deps = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (NEXT_BULLET_RE.test(lines[j])) break; // next slice started, no deps line in between
      const dm = lines[j].match(DEP_LINE_RE);
      if (dm) {
        deps = dm[1].trim() === '—' ? [] : dm[1].split(',').map((s) => s.trim()).filter(Boolean);
        break;
      }
    }
    const slice = {
      number,
      title: title.trim(),
      riskClass,
      hours: Number(hoursRaw.replace(',', '.')),
      calendarRaw: calendarRaw.trim(),
      date: parseCalendarStart(calendarRaw.trim()),
      lanes: lanesRaw.split(',').map((s) => s.trim()).filter(Boolean),
      deps,
      order: slices.length,
    };
    if (byNumber.has(number)) throw new Error(`slice ${number} appears twice in section 5.`);
    byNumber.set(number, slice);
    slices.push(slice);
  });
  return { slices, byNumber };
}

// ---- base checks: existence, cycles, dependency order, same-day lane sharing ----------------------

function checkGraph(slices, byNumber) {
  const missingDeps = [];
  for (const s of slices) {
    for (const d of s.deps) {
      if (!byNumber.has(d)) missingDeps.push(`${s.number} depends on ${d}, which is not a slice in section 5.`);
    }
  }

  const cycles = [];
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(slices.map((s) => [s.number, WHITE]));
  const stack = [];
  function visit(n) {
    color.set(n, GRAY);
    stack.push(n);
    for (const d of byNumber.get(n)?.deps ?? []) {
      if (!byNumber.has(d)) continue; // already reported as a missing dependency
      if (color.get(d) === GRAY) {
        const cycleStart = stack.indexOf(d);
        cycles.push([...stack.slice(cycleStart), d].join(' -> '));
      } else if (color.get(d) === WHITE) {
        visit(d);
      }
    }
    stack.pop();
    color.set(n, BLACK);
  }
  for (const s of slices) if (color.get(s.number) === WHITE) visit(s.number);

  const orderProblems = [];
  for (const s of slices) {
    for (const d of s.deps) {
      const dep = byNumber.get(d);
      if (!dep) continue;
      if (dep.date > s.date || (dep.date === s.date && dep.order > s.order)) {
        orderProblems.push(
          `${s.number} (${s.date}) depends on ${d} (${dep.date}), which does not end before ${s.number} starts.`,
        );
      }
    }
  }

  const warnings = [];
  const byDate = new Map();
  for (const s of slices) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  for (const [date, group] of byDate) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const shared = group[i].lanes.filter((l) => group[j].lanes.includes(l));
        if (shared.length > 0) {
          warnings.push(`${group[i].number} and ${group[j].number} both start ${date} and share lane(s): ${shared.join(', ')}.`);
        }
      }
    }
  }

  return { missingDeps, cycles, orderProblems, warnings };
}

// ---- --calendar: recompute the schedule from the dependency graph ----------------------------------

function isHoliday(date) {
  return date >= HOLIDAY_WINDOW.start && date <= HOLIDAY_WINDOW.end;
}

function isWeekend(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function isWorkday(date) {
  return !isWeekend(date) && !isHoliday(date);
}

function nextDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextWorkday(date) {
  let d = nextDay(date);
  while (!isWorkday(d)) d = nextDay(d);
  return d;
}

/** Greedy list scheduler: at most three slices active on any work day, never two sharing a lane; a
 * slice becomes ready once every dependency has finished (merged slices are ready from day one) and,
 * if it has an external earliest-start date, not before that date either. Deterministic: ties break
 * by section order (Plan 5: "Innerhalb eines Meilensteins stehen die Scheiben in der Reihenfolge ihres
 * Starts"). */
function computeCalendar(slices, byNumber, { hours, merged }) {
  const state = new Map();
  for (const s of slices) {
    if (merged.has(s.number)) continue;
    state.set(s.number, { ...s, remaining: s.hours, started: false, finished: false, startDate: undefined, finishDate: undefined });
  }

  const isDone = (n) => merged.has(n) || state.get(n)?.finished === true;
  const readyOn = (s, date) => {
    if (!s.deps.every(isDone)) return false;
    const earliest = EXTERNAL_EARLIEST_START[s.number];
    if (earliest && date < earliest.date) return false;
    return true;
  };

  let date = BUILD_START_DATE;
  if (!isWorkday(date)) date = nextWorkday(date);
  let guard = 0;
  while ([...state.values()].some((s) => !s.finished)) {
    if (++guard > 5000) throw new Error('plan-graph --calendar: schedule did not converge (dependency or lane deadlock?).');
    const active = [];
    const activeLanes = new Set();
    // Continue whatever is already in progress first — never interrupt a started slice.
    for (const s of state.values()) {
      if (s.started && !s.finished) {
        active.push(s);
        for (const l of s.lanes) activeLanes.add(l);
      }
    }
    // Fill remaining capacity (max 3) with newly ready slices, in section order, lane-disjoint.
    const candidates = [...state.values()]
      .filter((s) => !s.started && !s.finished && readyOn(s, date))
      .sort((a, b) => a.order - b.order);
    for (const s of candidates) {
      if (active.length >= 3) break;
      if (s.lanes.some((l) => activeLanes.has(l))) continue;
      active.push(s);
      for (const l of s.lanes) activeLanes.add(l);
    }

    if (active.length === 0 && [...state.values()].some((s) => !s.finished)) {
      date = nextWorkday(date);
      continue;
    }

    for (const s of active) {
      if (!s.started) {
        s.started = true;
        s.startDate = date;
      }
      s.remaining -= hours;
      if (s.remaining <= 1e-9) {
        s.finished = true;
        s.finishDate = date;
      }
    }
    date = nextWorkday(date);
  }

  return [...state.values()].sort((a, b) => (a.startDate === b.startDate ? a.order - b.order : a.startDate < b.startDate ? -1 : 1));
}

// ---- main --------------------------------------------------------------------------------------------

function main(argv) {
  const args = parseArgs(argv);
  const planText = readFileSync(args.plan, 'utf8');
  const { slices, byNumber } = parseSlices(planText);

  if (slices.length === 0) {
    console.error(`plan-graph: no slice bullets found in ${args.plan} section 5.`);
    return 1;
  }

  const { missingDeps, cycles, orderProblems, warnings } = checkGraph(slices, byNumber);

  console.log(`plan-graph: ${slices.length} slice(s) found in ${args.plan} section 5.`);
  console.log(`  missing dependencies: ${missingDeps.length}`);
  for (const m of missingDeps) console.log(`    ${m}`);
  console.log(`  cycles: ${cycles.length}`);
  for (const c of cycles) console.log(`    ${c}`);
  console.log(`  dependency-order problems: ${orderProblems.length}`);
  for (const o of orderProblems) console.log(`    ${o}`);
  console.log(`  same-day lane-sharing warnings: ${warnings.length}`);
  for (const w of warnings) console.log(`    ${w}`);

  const hardFailure = missingDeps.length > 0 || cycles.length > 0 || orderProblems.length > 0;
  const strictFailure = args.strict && warnings.length > 0;

  if (args.calendar) {
    const schedule = computeCalendar(slices, byNumber, { hours: args.hours, merged: args.merged });
    console.log(
      `\nplan-graph --calendar: ${schedule.length} slice(s) scheduled (${args.merged.size} taken out as already merged), ` +
        `${args.hours} AStd/day, start ${BUILD_START_DATE}:`,
    );
    for (const s of schedule) {
      console.log(`  ${s.number}  start ${s.startDate}  finish ${s.finishDate}  (${s.hours} AStd, lanes: ${s.lanes.join(', ')})  ${s.title}`);
    }
  }

  if (hardFailure || strictFailure) return 1;
  console.log('\nplan-graph: ok.');
  return 0;
}

process.exit(main(process.argv.slice(2)));
