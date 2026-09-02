/**
 * Helpers of the history view. Local to the feature: how a time is printed and how much of a text a
 * row can carry is a decision of this view, not of the component kit.
 */

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
