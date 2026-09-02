/**
 * Coverage (Restabdeckung): how much of a speech text is already covered by captured questions.
 * Spans are half-open character intervals into the contribution text.
 */
import type { TextSpan } from './types.js';

export function computeCoverage(
  textLength: number,
  spans: readonly TextSpan[],
): { coveredRatio: number; uncovered: TextSpan[] } {
  if (textLength === 0) return { coveredRatio: 1, uncovered: [] };
  const sorted = spans
    .map((s) => ({ start: Math.max(0, s.start), end: Math.min(textLength, s.end) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const merged: TextSpan[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  const uncovered: TextSpan[] = [];
  let cursor = 0;
  let covered = 0;
  for (const m of merged) {
    if (m.start > cursor) uncovered.push({ start: cursor, end: m.start });
    covered += m.end - m.start;
    cursor = m.end;
  }
  if (cursor < textLength) uncovered.push({ start: cursor, end: textLength });
  return { coveredRatio: covered / textLength, uncovered };
}
