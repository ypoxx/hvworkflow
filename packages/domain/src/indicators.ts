/**
 * The five business indicators of the evaluation catalogue (slice 033b, ADR 0013). A pure function
 * of the event log and a passed-in `now`: no I/O, no clock, no actor (AGENTS.md rule 8). It lives in
 * the core so the control desk (Leitstand, 061) uses the same definitions instead of rebuilding them.
 *
 * Event time is `recordedAt ?? at` (server time, ADR 0011), never the `occurredAt` a device or a
 * paper capture reports. The result holds counts per meeting (Jahrgang) and unit (Fachbereich) only:
 * no question text, no actor, person or session identifier can reach it, by construction.
 */
import type { DomainEvent } from './events.js';
import { project } from './state.js';
import type { QuestionRecord, QuestionStatus } from './types.js';

export interface MeetingIndicators {
  meetingId: string;
  /** Seconds since the oldest open question was captured; 0 without an open question. */
  oldestOpenQuestionAgeSeconds: number;
  /** Open questions per unit id from the meeting configuration; `unassigned` without assignment. */
  openQuestionsByUnit: Readonly<Record<string, number>>;
  /** Questions captured within the last 300 s (inclusive). */
  questionsCapturedLast5m: number;
  /** Questions in `in_review` without legal clearance of the latest version, entered more than 600 s ago. */
  questionsInLegalReviewOver10m: number;
}

export interface Indicators {
  /** Only meetings in status `running`, ordered by id. */
  meetings: readonly MeetingIndicators[];
  /** Events with server time within the last 60 s (inclusive), over all meetings. */
  eventsLast1m: number;
}

export const UNASSIGNED_UNIT = 'unassigned';
/*
 * The definitions below are shared with the control desk (Leitstand, slice 061, `cockpit.ts`), so both
 * read the same window, the same "open" and the same entry into legal review; `/metrics` stays byte for
 * byte the same (golden `apps/api/src/__tests__/fixtures/metrics-golden-061.txt`).
 */
export const CAPTURED_WINDOW_MS = 300_000;
export const LEGAL_REVIEW_LIMIT_MS = 600_000;
const EVENTS_WINDOW_MS = 60_000;

/** Server time of an event (ADR 0011): `recordedAt`, else `at`; never the device's `occurredAt`. */
export const eventTime = (event: Pick<DomainEvent, 'at' | 'recordedAt'>): number => Date.parse(event.recordedAt ?? event.at);

/** An age inside a rolling window: never negative, so an event after `now` (clock set back) counts nowhere. */
export const withinWindow = (ageMs: number, windowMs: number): boolean => ageMs >= 0 && ageMs <= windowMs;

/** "Open" in the evaluation catalogue (033b): every status except the four that end the question's way. */
const NOT_OPEN_STATUSES: readonly QuestionStatus[] = ['delivered', 'closed', 'withdrawn', 'merged'];
export const isOpenStatus = (status: QuestionStatus): boolean => !NOT_OPEN_STATUSES.includes(status);

/**
 * An event that (re)starts the legal-review clock (033b): submitted for review, a return into
 * `in_review` (a legacy form R-TRANS-06 no longer writes), or an answer version written straight into
 * `in_review` (Scheibe 044a: a refusal proposal; every new proposal restarts the clock).
 */
export const entersLegalReview = (event: DomainEvent): boolean =>
  event.type === 'QuestionSubmittedForReview' ||
  (event.type === 'QuestionReturned' && event.payload.toStatus === 'in_review') ||
  (event.type === 'AnswerDrafted' && event.payload.toStatus === 'in_review');

/** In `in_review` without a legal clearance of the latest answer version (033b). */
export function awaitsLegalClearance(q: QuestionRecord): boolean {
  if (q.status !== 'in_review') return false;
  const latest = q.answers.at(-1)?.version;
  const cleared = q.legalClearance !== undefined &&
    (q.legalClearance.answerVersion === undefined || q.legalClearance.answerVersion === latest);
  return !cleared;
}

export function computeIndicators(events: readonly DomainEvent[], now: Date): Indicators {
  const nowMs = now.getTime();
  const byMeeting = new Map<string, DomainEvent[]>();
  let eventsLast1m = 0;
  for (const event of events) {
    if (withinWindow(nowMs - eventTime(event), EVENTS_WINDOW_MS)) eventsLast1m += 1;
    if (event.meetingId === undefined) continue;
    const group = byMeeting.get(event.meetingId);
    if (group) group.push(event);
    else byMeeting.set(event.meetingId, [event]);
  }

  const meetings: MeetingIndicators[] = [];
  for (const meetingId of [...byMeeting.keys()].sort()) {
    const group = byMeeting.get(meetingId)!;
    const state = project(group);
    if (state.meeting?.id !== meetingId || state.meeting.status !== 'running') continue;

    const capturedAt = new Map<string, number>();
    const inReviewSince = new Map<string, number>();
    for (const event of group) {
      if (event.type === 'QuestionCaptured') capturedAt.set(event.subjectId, eventTime(event));
      else if (entersLegalReview(event)) inReviewSince.set(event.subjectId, eventTime(event));
    }

    const openByUnit: Record<string, number> = { [UNASSIGNED_UNIT]: 0 };
    for (const unit of state.units) openByUnit[unit.id] = 0;
    let oldest: number | undefined;
    let captured = 0;
    let legalOver = 0;
    for (const q of state.questions.values()) {
      const at = capturedAt.get(q.id);
      if (at !== undefined && withinWindow(nowMs - at, CAPTURED_WINDOW_MS)) captured += 1;
      if (isOpenStatus(q.status)) {
        const unit = q.unitId ?? UNASSIGNED_UNIT;
        openByUnit[unit] = (openByUnit[unit] ?? 0) + 1;
        if (at !== undefined && (oldest === undefined || at < oldest)) oldest = at;
      }
      if (awaitsLegalClearance(q)) {
        const since = inReviewSince.get(q.id);
        if (since !== undefined && nowMs - since > LEGAL_REVIEW_LIMIT_MS) legalOver += 1;
      }
    }
    meetings.push({
      meetingId,
      oldestOpenQuestionAgeSeconds: oldest === undefined ? 0 : Math.max(0, Math.floor((nowMs - oldest) / 1000)),
      openQuestionsByUnit: Object.fromEntries(Object.entries(openByUnit).sort(([a], [b]) => a.localeCompare(b))),
      questionsCapturedLast5m: captured,
      questionsInLegalReviewOver10m: legalOver,
    });
  }
  return { meetings, eventsLast1m };
}
