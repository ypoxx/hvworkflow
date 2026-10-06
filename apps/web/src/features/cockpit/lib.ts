/**
 * Scheibe 061 (part B): the pure helpers of the control desk (Leitstand). No clock (every age comes from the service or
 * from `asOf` of the same reading, spec decision 10), no status logic (the station order below is display order, like
 * the status labels; transitions live in the core, AGENTS.md R5), no role names (R4).
 */
import type { Question, QuestionStatus, StageAssignment, Unit } from '@hv/domain';
import { cockpitLevel, COCKPIT_THRESHOLDS } from '../../api/cockpit';
import type { Cockpit, CockpitFigure, CockpitLevel, CockpitOldestRef, CockpitOpenStatus, CockpitReviewRef, StatusTrailEntry } from '../../api/cockpit';
import { statusLabel } from '../../i18n';
import type { Translate } from '../../i18n';

/** A station of the strip: an open status except "auf der Bühne", which is the fourth card, not a seventh column. */
export type StationStatus = Exclude<CockpitOpenStatus, 'staged'>;
/** The six stations of the strip, in display order. */
export const STATIONS: readonly StationStatus[] = ['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved'];
/** The open statuses (033b), for the list reads. */
export const OPEN_STATUSES: readonly CockpitOpenStatus[] = [...STATIONS, 'staged'];
/** The stations of a thread up to "vorgelesen", in display order. */
export const THREAD_STATIONS: readonly QuestionStatus[] = [...OPEN_STATUSES, 'delivered'];
/** A thread breaks after this many entries (spec decision 6). */
export const THREAD_ROW = 8;
/** The legal clearing list carries at most this many references (contract `maxItems`). */
export const LEGAL_LIST_MAX = 50;

/* ---------- durations ---------- */

export interface DurationPart {
  value: number;
  unit: 'h' | 'min';
}

const minutes = (seconds: number): number => Math.floor(Math.max(0, seconds) / 60);

/** Whole minutes; from 100 minutes on hours and minutes ("1 h 40 min", spec decision 3). */
export function durationParts(seconds: number): DurationPart[] {
  const total = minutes(seconds);
  if (total < 100) return [{ value: total, unit: 'min' }];
  return [{ value: Math.floor(total / 60), unit: 'h' }, { value: total % 60, unit: 'min' }];
}

export function formatDuration(t: Translate, seconds: number): string {
  const parts = durationParts(seconds);
  const [first, second] = parts;
  if (second === undefined) return t('cockpit.duration.min', { m: first?.value ?? 0 });
  return t('cockpit.duration.hmin', { h: first?.value ?? 0, m: second.value });
}

/** Wall clock of the hall (Europe/Berlin, 24 hours) from a server timestamp; never the device's own clock. */
export function hallTime(iso: string, withSeconds = false): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Seconds between a timestamp and `asOf` of the same reading, never negative. */
export function secondsBetween(fromIso: string, asOf: string): number {
  return Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(fromIso)) / 1000));
}

/* ---------- levels (spec decision 4) ---------- */

export interface LevelText {
  level: Exclude<CockpitLevel, 'calm'>;
  /** "erhöht · ab 3": word and threshold, both from the dictionary and COCKPIT_THRESHOLDS. */
  text: string;
}

function thresholdText(t: Translate, figure: CockpitFigure, level: Exclude<CockpitLevel, 'calm'>): string {
  switch (figure) {
    case 'oldestOpen':
      return t('cockpit.threshold.over', { n: COCKPIT_THRESHOLDS.oldestOpenSeconds[level] / 60 });
    case 'legalReviewOver10m':
      return t('cockpit.threshold.from', { n: COCKPIT_THRESHOLDS.legalReviewOver10m[level] });
    case 'unitBacklog':
    case 'unassignedBacklog':
      return t('cockpit.threshold.from', { n: COCKPIT_THRESHOLDS.unitBacklog[level] });
    case 'openTotal':
    case 'inflow':
    case 'staged':
      return t('cockpit.threshold.afterClose');
  }
}

/** The level of a figure as badge text; `undefined` while calm (no mark at all, D4). */
export function levelText(
  t: Translate,
  figure: CockpitFigure,
  value: number,
  context: { debateClosed?: boolean } = {},
): LevelText | undefined {
  const level = cockpitLevel(figure, value, context);
  if (level === 'calm') return undefined;
  return { level, text: t('cockpit.level.badge', { level: t(`cockpit.level.${level}`), threshold: thresholdText(t, figure, level) }) };
}

/** The one pattern of accessible names: "Liste öffnen: {label}, {count}[, {level}]". */
export function listName(t: Translate, label: string, count: number, level?: LevelText): string {
  return level === undefined
    ? t('cockpit.name.open', { label, count })
    : t('cockpit.name.openLevel', { label, count, level: level.text });
}

/* ---------- units and the backlog ---------- */

export function unitName(units: readonly Unit[], unitId: string | undefined): string | undefined {
  if (unitId === undefined) return undefined;
  const unit = units.find((candidate) => candidate.id === unitId);
  // A unit id from the log that left the configuration keeps its own row (as `hv_open_questions`), named by its id.
  return unit === undefined ? unitId : unit.shortName ?? unit.name;
}

export interface UnitRow {
  /** The unit id, or `none` for the open questions without a unit. */
  id: string;
  /** Short name; empty for `none` (the page writes "Ohne Fachbereich"). */
  name: string;
  count: number;
  level: CockpitLevel;
  unassigned: boolean;
}

/** Count descending, then name; "Ohne Fachbereich" last, with the same thresholds. */
export function unitRows(cockpit: Cockpit, units: readonly Unit[]): UnitRow[] {
  const rows = Object.entries(cockpit.openByUnit).map(([id, count]): UnitRow => ({
    id,
    name: unitName(units, id) ?? id,
    count,
    level: cockpitLevel('unitBacklog', count),
    unassigned: false,
  }));
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
  rows.push({
    id: 'none',
    name: '',
    count: cockpit.openUnassigned,
    level: cockpitLevel('unassignedBacklog', cockpit.openUnassigned),
    unassigned: true,
  });
  return rows;
}

/** The bars are relative to max(largest value, critical threshold), so the marker of "erhöht" never moves off scale. */
export function backlogScale(rows: readonly UnitRow[]): number {
  return Math.max(COCKPIT_THRESHOLDS.unitBacklog.critical, ...rows.map((row) => row.count));
}

/* ---------- inflow ---------- */

export const INFLOW_GEOMETRY = { width: 280, height: 48, bar: 18, gap: 5 } as const;

export interface InflowBar {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  latest: boolean;
  empty: boolean;
}

/** Twelve bars on a baseline at 0, scale max(…bins, 5); an empty window is a 1 px line, a value above 0 at least 2 px. */
export function inflowBars(bins: readonly number[]): { bars: InflowBar[]; scale: number } {
  const { width, height, bar, gap } = INFLOW_GEOMETRY;
  const scale = Math.max(5, ...bins);
  const span = bins.length * bar + Math.max(0, bins.length - 1) * gap;
  const offset = Math.floor((width - span) / 2);
  const bars = bins.map((value, i): InflowBar => {
    const empty = value <= 0;
    const h = empty ? 1 : Math.max(2, Math.round((value / scale) * height));
    return { x: offset + i * (bar + gap), y: height - h, width: bar, height: h, value, latest: i === bins.length - 1, empty };
  });
  return { bars, scale };
}

export const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

/* ---------- critical figures and the one announcement (spec decision 7, W11) ---------- */

function criticalItems(t: Translate, cockpit: Cockpit, units: readonly Unit[]): Map<string, string> {
  const items = new Map<string, string>();
  const add = (key: string, label: string, figure: CockpitFigure, value: number): void => {
    const level = levelText(t, figure, value);
    if (level?.level !== 'critical') return;
    items.set(key, t('cockpit.announce.item', { label, threshold: thresholdText(t, figure, 'critical') }));
  };
  add('oldest', t('cockpit.label.oldest'), 'oldestOpen', cockpit.oldestOpen.ageSeconds);
  add('legal', t('cockpit.list.legal'), 'legalReviewOver10m', cockpit.legalReview.over10m);
  for (const row of unitRows(cockpit, units)) {
    const label = row.unassigned ? t('cockpit.announce.noUnit') : t('cockpit.announce.unit', { unit: row.name });
    add(`unit:${row.id}`, label, row.unassigned ? 'unassignedBacklog' : 'unitBacklog', row.count);
  }
  return items;
}

/**
 * The text of the one polite announcement: only when a figure turns critical between two readings; staying critical,
 * turning elevated and the first reading of the page stay silent. Several at once are one announcement.
 */
export function announcementFor(t: Translate, previous: Cockpit | null, next: Cockpit, units: readonly Unit[]): string | null {
  if (previous === null) return null;
  const before = criticalItems(t, previous, units);
  const fresh = [...criticalItems(t, next, units)].filter(([key]) => !before.has(key)).map(([, text]) => text);
  return fresh.length === 0 ? null : t('cockpit.announce', { items: fresh.join('; ') });
}

/* ---------- drill-down state in the URL (spec decision 6) ---------- */

export type ListKind = 'oldest' | 'open' | 'legal' | 'inflow' | 'unit' | 'stage';
const LIST_KINDS: readonly ListKind[] = ['oldest', 'open', 'legal', 'inflow', 'unit', 'stage'];

export interface Selection {
  list: ListKind;
  /** Only for `open`: one station of the strip. */
  station?: StationStatus;
  /** Only for `unit`: a unit id or `none`. */
  unit?: string;
  /** The question whose thread is open. */
  q?: string;
}

export function parseSelection(params: URLSearchParams): Selection | null {
  const list = params.get('list');
  if (list === null || !(LIST_KINDS as readonly string[]).includes(list)) return null;
  const selection: Selection = { list: list as ListKind };
  const station = params.get('station');
  if (list === 'open' && station !== null && (STATIONS as readonly string[]).includes(station)) selection.station = station as StationStatus;
  const unit = params.get('unit');
  if (list === 'unit') {
    if (unit === null || unit === '') return null;
    selection.unit = unit;
  }
  const q = params.get('q');
  if (q !== null && q !== '') selection.q = q;
  return selection;
}

export function selectionSearch(selection: Selection | null): string {
  if (selection === null) return '';
  const params = new URLSearchParams({ list: selection.list });
  if (selection.station !== undefined) params.set('station', selection.station);
  if (selection.unit !== undefined) params.set('unit', selection.unit);
  if (selection.q !== undefined) params.set('q', selection.q);
  return `?${params.toString()}`;
}

/** Escape closes the thread first, then the list (spec decision 11). */
export function escapeTarget(selection: Selection | null): Selection | null {
  if (selection === null || selection.q === undefined) return null;
  const { q: _closed, ...list } = selection;
  void _closed;
  return list;
}

/* ---------- list rows ---------- */

export interface ListRow {
  id: string;
  number: string;
  status: QuestionStatus;
  unitId?: string;
  /** "in diesem Status" (oldest) or "wartet seit" (legal clearing); absent in the other lists. */
  timeSeconds?: number;
  ageSeconds: number;
}

/** Rows of the two lists the reading itself carries. */
export function rowsFromRefs(items: readonly (CockpitOldestRef | CockpitReviewRef)[], kind: 'oldest' | 'legal'): ListRow[] {
  return items.map((item) => ({
    id: item.id,
    number: item.number,
    status: item.status,
    ...(item.unitId !== undefined ? { unitId: item.unitId } : {}),
    timeSeconds: kind === 'legal' && 'reviewAgeSeconds' in item ? item.reviewAgeSeconds : item.statusAgeSeconds,
    ageSeconds: item.ageSeconds,
  }));
}

const byAge = (a: ListRow, b: ListRow): number =>
  b.ageSeconds - a.ageSeconds || a.number.localeCompare(b.number, 'en', { numeric: true });

/** Rows of a `listQuestions` read, aged against `asOf` of the same reading, oldest first. */
export function rowsFromQuestions(
  questions: readonly Pick<Question, 'id' | 'number' | 'status' | 'unitId' | 'createdAt'>[],
  asOf: string,
  selection: Selection,
): ListRow[] {
  const rows = questions.map((question): ListRow => ({
    id: question.id,
    number: question.number,
    status: question.status,
    ...(question.unitId !== undefined ? { unitId: question.unitId } : {}),
    ageSeconds: secondsBetween(question.createdAt, asOf),
  }));
  const kept = rows.filter((row) => {
    if (selection.list === 'inflow') return row.ageSeconds <= 300;
    if (selection.list === 'unit' && selection.unit === 'none') return row.unitId === undefined;
    return true;
  });
  return kept.sort(byAge);
}

export interface StationGroup {
  status: QuestionStatus;
  rows: ListRow[];
}

/** Rows grouped by station in display order; a status outside the order (none in an open list) comes last. */
export function groupByStation(rows: readonly ListRow[]): StationGroup[] {
  const order = (status: QuestionStatus): number => {
    const index = THREAD_STATIONS.indexOf(status);
    return index < 0 ? THREAD_STATIONS.length : index;
  };
  const groups = new Map<QuestionStatus, ListRow[]>();
  for (const row of rows) {
    const list = groups.get(row.status);
    if (list) list.push(row);
    else groups.set(row.status, [row]);
  }
  return [...groups].sort(([a], [b]) => order(a) - order(b)).map(([status, list]) => ({ status, rows: list }));
}

/* ---------- the thread (Faden) ---------- */

export interface ThreadEntry {
  status: QuestionStatus;
  state: 'past' | 'current' | 'future';
  /** Server time the station was entered (past and current). */
  at?: string;
  /** Seconds in the current station, from `asOf` of the reading. */
  sinceSeconds?: number;
}

/**
 * The entries of a thread: the status trail of the core in time order (the last one current), then the stations not
 * yet reached up to "vorgelesen" (display order). Without the history (no `history.read`) only the current station.
 */
export function threadEntries(trail: readonly StatusTrailEntry[] | null, current: QuestionStatus, asOf: string): ThreadEntry[] {
  if (trail === null || trail.length === 0) return [{ status: current, state: 'current' }];
  const entries: ThreadEntry[] = trail.map((entry, i) =>
    i === trail.length - 1
      ? { status: entry.status, state: 'current', at: entry.at, sinceSeconds: secondsBetween(entry.at, asOf) }
      : { status: entry.status, state: 'past', at: entry.at },
  );
  const last = trail[trail.length - 1]!.status;
  const index = THREAD_STATIONS.indexOf(last);
  if (index >= 0) for (const status of THREAD_STATIONS.slice(index + 1)) entries.push({ status, state: 'future' });
  return entries;
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Station label from the shared status words (`status.*`). */
export const stationLabel = (t: Translate, status: QuestionStatus): string => statusLabel(t, status);

/** What the thread shows: number, text (only with read right), unit and seat, the entries. */
export type ThreadRead =
  | { status: 'loading'; id: string; number: string }
  | { status: 'failed'; id: string; number: string }
  | {
      status: 'ready';
      id: string;
      number: string;
      text?: string;
      unitId?: string;
      stageAssignment?: StageAssignment;
      entries: ThreadEntry[];
    };

export type ListRead =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; rows: ListRow[]; total?: number };

export type CockpitRead =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; ruleId?: string }
  | { status: 'ready'; cockpit: Cockpit };
