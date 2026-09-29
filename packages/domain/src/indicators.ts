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
const CAPTURED_WINDOW_MS = 300_000;
const LEGAL_REVIEW_LIMIT_MS = 600_000;
const EVENTS_WINDOW_MS = 60_000;

const eventTime = (event: DomainEvent): number => Date.parse(event.recordedAt ?? event.at);

export function computeIndicators(events: readonly DomainEvent[], now: Date): Indicators {
  const nowMs = now.getTime();
  const byMeeting = new Map<string, DomainEvent[]>();
  let eventsLast1m = 0;
  for (const event of events) {
    if (nowMs - eventTime(event) <= EVENTS_WINDOW_MS) eventsLast1m += 1;
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
      else if (event.type === 'QuestionSubmittedForReview' ||
        (event.type === 'QuestionReturned' && event.payload.toStatus === 'in_review')) {
        inReviewSince.set(event.subjectId, eventTime(event));
      }
    }

    const openByUnit: Record<string, number> = { [UNASSIGNED_UNIT]: 0 };
    for (const unit of state.units) openByUnit[unit.id] = 0;
    let oldest: number | undefined;
    let captured = 0;
    let legalOver = 0;
    for (const q of state.questions.values()) {
      const at = capturedAt.get(q.id);
      if (at !== undefined && nowMs - at <= CAPTURED_WINDOW_MS) captured += 1;
      if (!['delivered', 'closed', 'withdrawn', 'merged'].includes(q.status)) {
        const unit = q.unitId ?? UNASSIGNED_UNIT;
        openByUnit[unit] = (openByUnit[unit] ?? 0) + 1;
        if (at !== undefined && (oldest === undefined || at < oldest)) oldest = at;
      }
      if (q.status === 'in_review') {
        const latest = q.answers.at(-1)?.version;
        const cleared = q.legalClearance !== undefined &&
          (q.legalClearance.answerVersion === undefined || q.legalClearance.answerVersion === latest);
        const since = inReviewSince.get(q.id);
        if (!cleared && since !== undefined && nowMs - since > LEGAL_REVIEW_LIMIT_MS) legalOver += 1;
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
