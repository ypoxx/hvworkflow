/**
 * Helpers of the history view. Local to the feature: how a time is printed and how much of a text a
 * row can carry is a decision of this view, not of the component kit.
 */
import type { DomainEvent } from '@hv/domain';

/** How many results are rendered before the person is asked to narrow the search. */
export const RESULT_LIMIT = 200;

/** How many events the "Ereignisstrom" tab shows — the tail of the meeting, not its whole log. */
export const STREAM_LIMIT = 200;

/** Wall clock with seconds: two events of the same minute must stay distinguishable. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return [at.getHours(), at.getMinutes(), at.getSeconds()]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function excerpt(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "1 h 12 min", "2 min 10 s", "9 s" — the coarsest two units that matter at each scale. */
function formatSpan(ms: number): string {
  const totalSeconds = Math.round(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${pad2(minutes)} min`;
  if (minutes > 0) return `${minutes} min ${pad2(seconds)} s`;
  return `${seconds} s`;
}

/** Durchlaufzeit between two consecutive events on the timeline ("+9 s", "+1 h 05 min", point 8). */
export function eventGap(fromIso: string, toIso: string): string {
  return `+${formatSpan(Date.parse(toIso) - Date.parse(fromIso))}`;
}

/** A total elapsed span for the KPI line — the same scale rule, without the "+" of a gap. */
export function elapsedSpan(fromIso: string, toIso: string): string {
  return formatSpan(Date.parse(toIso) - Date.parse(fromIso));
}

/** The three KPI numbers of point 8, read from the event log alone (AGENTS.md rule 5). */
export interface HistoryKpi {
  capturedAt: string | undefined;
  deliveredAt: string | undefined;
  versions: number;
  returns: number;
}

export function historyKpi(events: readonly DomainEvent[]): HistoryKpi {
  let capturedAt: string | undefined;
  let deliveredAt: string | undefined;
  let versions = 0;
  let returns = 0;
  for (const event of events) {
    switch (event.type) {
      case 'QuestionCaptured':
        capturedAt = event.at;
        break;
      case 'QuestionDelivered':
        deliveredAt = event.at;
        break;
      case 'AnswerDrafted':
        versions += 1;
        break;
      case 'QuestionReturned':
        returns += 1;
        break;
      default:
        break;
    }
  }
  return { capturedAt, deliveredAt, versions, returns };
}

/** Width of one bucket and how many make up the "Lastkurve" window (point 9). */
const BUCKET_MS = 5 * 60_000;
const BUCKET_COUNT = 24; // two hours

/** Event counts in 5-minute buckets over the last two hours, oldest first — the "Lastkurve". */
export function loadCurve(events: readonly DomainEvent[], now: number): number[] {
  const start = now - BUCKET_COUNT * BUCKET_MS;
  const counts = new Array<number>(BUCKET_COUNT).fill(0);
  for (const event of events) {
    const at = Date.parse(event.at);
    if (at < start || at > now) continue;
    const index = Math.min(BUCKET_COUNT - 1, Math.floor((at - start) / BUCKET_MS));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return counts;
}
