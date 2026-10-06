/**
 * The control desk (Leitstand, slice 061): what waits longest, where it backs up, how the situation
 * develops — aggregates per meeting (Jahrgang), status and unit (Fachbereich), never per person
 * (ADR 0013, Rechtekonzept §6). A pure function of the meeting's events, a passed-in `now` and a read
 * check: no I/O, no clock (AGENTS.md rule 8), no actor beyond the `canRead` callback.
 *
 * The figures share their definitions with `/metrics` (`indicators.ts`, 033b): the same capture window,
 * the same "open" and the same entry into legal review. Status changes are read off the projection
 * (`reduce`) by comparing a question's status before and after each event — there is no second mapping
 * from event type to status here (AGENTS.md rule 5). The report `leitstand` in the evaluation catalogue
 * (`apps/api/src/metrics/catalog.json`) lists every leaf path of the answer; `COCKPIT_REPORT` mirrors it.
 */
import type { DomainEvent, ReadEvent } from './events.js';
import { awaitsLegalClearance, CAPTURED_WINDOW_MS, entersLegalReview, eventTime, isOpenStatus, LEGAL_REVIEW_LIMIT_MS } from './indicators.js';
import { emptyState, reduce, refreshCounts, type State } from './state.js';
import type { Cockpit, CockpitOldestRef, CockpitOpenStatus, CockpitReviewRef, QuestionRecord, QuestionStatus } from './types.js';
import { QUESTION_STATUSES } from './types.js';

/** One entry of a question's status trail (Faden): the status it entered and when (server time). */
export interface StatusTrailEntry {
  status: QuestionStatus;
  at: string;
}

const INFLOW_BINS = 12;
const OLDEST_ITEMS = 4;
const REVIEW_ITEMS = 50;

/**
 * The one fold (spec decision 6): `reduce` over the events, calling `onChange` whenever the status of
 * the event's question differs after the event from before it. Every status change in the projection
 * concerns the event's own subject (`state.ts`), so comparing that question is complete.
 */
function foldStatusChanges(
  events: readonly (DomainEvent | ReadEvent)[],
  onChange: (questionId: string, status: QuestionStatus, event: DomainEvent) => void,
  onEvent?: (event: DomainEvent, state: State) => void,
): State {
  const state = emptyState();
  for (const item of events) {
    // A read event lacks only the hash fields and identity blocks, which `reduce` does not use.
    const event = item as DomainEvent;
    const before = state.questions.get(event.subjectId)?.status;
    reduce(state, event);
    const after = state.questions.get(event.subjectId)?.status;
    if (after !== undefined && after !== before) onChange(event.subjectId, after, event);
    onEvent?.(event, state);
  }
  return state;
}

/**
 * The status trail (Faden) of one question: an entry each time its status changed, `at` = server time
 * (`recordedAt ?? at`) of that event. The same status again (a new refusal proposal in legal clearing)
 * gives no entry; a return is its own entry. Over the events of `getQuestionHistory` the first entry is
 * `captured`.
 */
export function statusTrail(events: readonly (DomainEvent | ReadEvent)[], questionId: string): StatusTrailEntry[] {
  const trail: StatusTrailEntry[] = [];
  foldStatusChanges(events, (id, status, event) => {
    if (id === questionId) trail.push({ status, at: event.recordedAt ?? event.at });
  });
  return trail;
}

const seconds = (ms: number): number => Math.max(0, Math.floor(ms / 1000));
const byNumber = (a: QuestionRecord, b: QuestionRecord): number =>
  a.number.localeCompare(b.number, 'en', { numeric: true }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The figures of `meetingId` at `now`; `undefined` while the events hold no such meeting. Events of other
 * meetings and events with a server time after `now` (clock set back) count nowhere. `canRead` filters the
 * references only; the aggregates stay unfiltered (every holder of `cockpit.read` reads unscoped, K1).
 */
export function computeCockpit(
  events: readonly DomainEvent[],
  now: Date,
  meetingId: string,
  canRead: (question: QuestionRecord) => boolean,
): Cockpit | undefined {
  const nowMs = now.getTime();
  const relevant = events.filter((e) => e.meetingId === meetingId && eventTime(e) <= nowMs);
  const capturedAt = new Map<string, number>();
  const statusSince = new Map<string, number>();
  const inReviewSince = new Map<string, number>();
  // T-G2-D-03: `reduce` recounts the meeting after every event, so folding the whole log costs events ×
  // questions (about 250 ms at 800 questions). The same fold therefore runs per question over its own
  // events on an empty state (no meeting, nothing to recount), the rest of the log once; the question
  // records then join that state and `refreshCounts` (state.ts) recounts once. Every question event names
  // its question as subject (state.ts), so the records equal those of `project` (K3, K11 pin it).
  const questionIds = new Set(relevant.filter((e) => e.type === 'QuestionCaptured').map((e) => e.subjectId));
  const perQuestion = new Map<string, DomainEvent[]>();
  const rest: DomainEvent[] = [];
  for (const event of relevant) {
    if (!questionIds.has(event.subjectId)) { rest.push(event); continue; }
    const list = perQuestion.get(event.subjectId);
    if (list) list.push(event);
    else perQuestion.set(event.subjectId, [event]);
  }
  const state = foldStatusChanges(rest, () => undefined);
  for (const [id, list] of perQuestion) {
    const own = foldStatusChanges(list, (_id, _status, event) => statusSince.set(id, eventTime(event)), (event) => {
      if (event.type === 'QuestionCaptured') capturedAt.set(id, eventTime(event));
      else if (entersLegalReview(event)) inReviewSince.set(id, eventTime(event));
    });
    const record = own.questions.get(id);
    if (record) state.questions.set(id, record);
  }
  refreshCounts(state);
  const meeting = state.meeting;
  if (meeting === null || meeting.id !== meetingId) return undefined;

  const openStatuses = QUESTION_STATUSES.filter(isOpenStatus) as CockpitOpenStatus[];
  const openByStatus = Object.fromEntries(openStatuses.map((s) => [s, meeting.counts.byStatus[s]])) as Record<CockpitOpenStatus, number>;
  const openByUnit: Record<string, number> = Object.fromEntries(state.units.map((unit) => [unit.id, 0]));
  let openUnassigned = 0;
  const bins = Array.from({ length: INFLOW_BINS }, () => 0);
  const open: QuestionRecord[] = [];
  const waiting: QuestionRecord[] = [];
  for (const q of state.questions.values()) {
    const at = capturedAt.get(q.id);
    if (at !== undefined) {
      const ageMs = nowMs - at;
      // bins[11] = age 0..300 s inclusive (033b window); bins[i] = age in (300·(11−i), 300·(12−i)].
      const window = ageMs <= CAPTURED_WINDOW_MS ? 1 : Math.ceil(ageMs / CAPTURED_WINDOW_MS);
      if (ageMs >= 0 && window <= INFLOW_BINS) bins[INFLOW_BINS - window]! += 1;
    }
    if (isOpenStatus(q.status)) {
      // Like `hv_open_questions`: a unit id from the log that left the configuration keeps its own key.
      if (q.unitId === undefined) openUnassigned += 1;
      else openByUnit[q.unitId] = (openByUnit[q.unitId] ?? 0) + 1;
      if (at !== undefined) open.push(q);
    }
    const since = inReviewSince.get(q.id);
    if (awaitsLegalClearance(q) && since !== undefined && nowMs - since > LEGAL_REVIEW_LIMIT_MS) waiting.push(q);
  }

  open.sort((a, b) => capturedAt.get(a.id)! - capturedAt.get(b.id)! || byNumber(a, b));
  waiting.sort((a, b) => inReviewSince.get(a.id)! - inReviewSince.get(b.id)! || byNumber(a, b));
  const ref = (q: QuestionRecord): CockpitOldestRef => ({
    id: q.id,
    number: q.number,
    status: q.status,
    ...(q.unitId !== undefined ? { unitId: q.unitId } : {}),
    ageSeconds: seconds(nowMs - capturedAt.get(q.id)!),
    statusAgeSeconds: seconds(nowMs - (statusSince.get(q.id) ?? capturedAt.get(q.id)!)),
  });
  const reviewRef = (q: QuestionRecord): CockpitReviewRef => ({ ...ref(q), reviewAgeSeconds: seconds(nowMs - inReviewSince.get(q.id)!) });

  const oldest = open[0];
  return {
    meetingId,
    asOf: now.toISOString(),
    meetingStatus: meeting.status,
    ...(meeting.debateClosedAt !== undefined ? { debateClosedAt: meeting.debateClosedAt } : {}),
    totals: { captured: meeting.counts.questions, open: meeting.counts.open, staged: meeting.counts.staged, answered: meeting.counts.delivered },
    openByStatus,
    openByUnit,
    openUnassigned,
    oldestOpen: {
      ageSeconds: oldest === undefined ? 0 : seconds(nowMs - capturedAt.get(oldest.id)!),
      items: open.filter(canRead).slice(0, OLDEST_ITEMS).map(ref),
    },
    inflow: { binSeconds: 300, bins, last5m: bins[INFLOW_BINS - 1]! },
    legalReview: { over10m: waiting.length, items: waiting.filter(canRead).slice(0, REVIEW_ITEMS).map(reviewRef) },
  };
}

/* ---------- levels: calm, attention, critical (spec decision 4) ---------- */

export type CockpitLevel = 'calm' | 'attention' | 'critical';
export type CockpitFigure = 'oldestOpen' | 'legalReviewOver10m' | 'unitBacklog' | 'unassignedBacklog' | 'openTotal' | 'inflow' | 'staged';

/** The one place of the thresholds (Eigentümerfrage 1); badge texts read them, never a literal. 085 and 086 read them too. */
export const COCKPIT_THRESHOLDS = {
  /** Age of the oldest open question, in seconds (15 and 45 minutes). */
  oldestOpenSeconds: { attention: 900, critical: 2700 },
  /** Questions in legal clearing over 10 minutes. */
  legalReviewOver10m: { attention: 3, critical: 10 },
  /** Open questions of one unit, and of "no unit". */
  unitBacklog: { attention: 20, critical: 40 },
} as const;

const stepped = (value: number, t: { attention: number; critical: number }): CockpitLevel =>
  value >= t.critical ? 'critical' : value >= t.attention ? 'attention' : 'calm';

/**
 * The level of a figure: equal to a threshold is the higher level. Inflow and stage are never coloured;
 * "no final status yet" is elevated only after the close of the debate and while something is open.
 */
export function cockpitLevel(figure: CockpitFigure, value: number, context: { debateClosed?: boolean } = {}): CockpitLevel {
  switch (figure) {
    case 'oldestOpen': return stepped(value, COCKPIT_THRESHOLDS.oldestOpenSeconds);
    case 'legalReviewOver10m': return stepped(value, COCKPIT_THRESHOLDS.legalReviewOver10m);
    case 'unitBacklog':
    case 'unassignedBacklog': return stepped(value, COCKPIT_THRESHOLDS.unitBacklog);
    case 'openTotal': return context.debateClosed === true && value > 0 ? 'attention' : 'calm';
    case 'inflow':
    case 'staged': return 'calm';
  }
}

/* ---------- report descriptor (spec decision 8b) ---------- */

export interface CockpitReportField {
  /** Leaf path of the schema `Cockpit`; `[]` marks an array item, `*` a map value. */
  path: string;
  /** A catalogue family, a `Meeting.counts.*` field, `derived: <reason>` or `meta: <what>`. */
  source: string;
  personalReference: string;
}

const NONE = 'keiner';
const REFERENCE = 'derived: Referenz je Einzelfrage aus der Projektion, gefiltert nach can(); keine Kennzahl';
const ROLE_GROUPS = 'E13: Rollengruppen Erfassung, Legal Clearing, Freigabe';
const refFields = (prefix: string, names: readonly string[]): CockpitReportField[] =>
  names.map((name) => ({ path: `${prefix}[].${name}`, source: REFERENCE, personalReference: 'keiner (kein Redner, kein Akteur)' }));
const REF_NAMES = ['id', 'number', 'status', 'unitId', 'ageSeconds', 'statusAgeSeconds'] as const;

/** Mirror of `reports[id = leitstand]` in `apps/api/src/metrics/catalog.json` (test A6 keeps both equal). */
export const COCKPIT_REPORT = {
  id: 'leitstand',
  spec: '061',
  operationId: 'getMeetingCockpit',
  permission: 'cockpit.read',
  aggregation: ['meeting', 'status', 'unit'],
  questionReferences: true,
  minimumGroupSize: null,
  fields: [
    { path: 'meetingId', source: 'meta: Jahrgang', personalReference: NONE },
    { path: 'asOf', source: 'meta: Rechenzeitpunkt aus der Uhr des Dienstes', personalReference: NONE },
    { path: 'meetingStatus', source: 'meta: Status des Jahrgangs', personalReference: NONE },
    { path: 'debateClosedAt', source: 'meta: Debattenschluss wie Meeting.debateClosedAt', personalReference: NONE },
    { path: 'totals.captured', source: 'Meeting.counts.questions', personalReference: NONE },
    { path: 'totals.open', source: 'Meeting.counts.open', personalReference: NONE },
    { path: 'totals.staged', source: 'Meeting.counts.staged', personalReference: NONE },
    { path: 'totals.answered', source: 'Meeting.counts.delivered', personalReference: NONE },
    ...QUESTION_STATUSES.filter(isOpenStatus).map((status) => (
      { path: `openByStatus.${status}`, source: `Meeting.counts.byStatus.${status}`, personalReference: ROLE_GROUPS })),
    { path: 'openByUnit.*', source: 'hv_open_questions', personalReference: 'E13: Fachbereich mit einer Person' },
    { path: 'openUnassigned', source: 'hv_open_questions', personalReference: 'E13: Fachbereich mit einer Person' },
    { path: 'oldestOpen.ageSeconds', source: 'hv_open_question_oldest_age_seconds', personalReference: NONE },
    ...refFields('oldestOpen.items', REF_NAMES),
    { path: 'inflow.binSeconds', source: 'meta: Fensterbreite 300 s (Konstante)', personalReference: NONE },
    { path: 'inflow.bins[]', source: 'derived: zwölf Fenster je 300 s derselben Definition wie hv_questions_captured_last_5m; bins[11] = last5m',
      personalReference: 'E13: Gruppe Erfassung, begrenzt durch Redetempo' },
    { path: 'inflow.last5m', source: 'hv_questions_captured_last_5m', personalReference: 'E13: Gruppe Erfassung, begrenzt durch Redetempo' },
    { path: 'legalReview.over10m', source: 'hv_questions_in_legal_review_over_10m', personalReference: 'E13: Rollengruppe Legal Clearing' },
    ...refFields('legalReview.items', [...REF_NAMES, 'reviewAgeSeconds']),
  ] as readonly CockpitReportField[],
} as const;
