/**
 * Batch atomisation: propose one Einzelfrage per question sentence that is still uncovered.
 *
 * A speech is dictated, not written, so a question is almost always one sentence ending in a
 * question mark. Everything the desk has already captured is skipped — the proposal works on the
 * uncovered spans of the Redebeitrag (`contribution.coverage.uncovered`), never on the whole text.
 */
import type { TextSpan } from '@hv/domain';

export interface Candidate {
  /** The exact wording, identical to `text.slice(start, end)`. */
  text: string;
  start: number;
  end: number;
}

/** Sentences shorter than this are punctuation noise ("Wirklich?"), not a question of record. */
const MIN_LENGTH = 12;

const SENTENCE = /[^?]*?\?/g;

export function suggestQuestions(text: string, uncovered: readonly TextSpan[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const span of uncovered) {
    const chunk = text.slice(span.start, span.end);
    SENTENCE.lastIndex = 0;
    let match = SENTENCE.exec(chunk);
    while (match !== null) {
      const raw = match[0];
      const leading = raw.length - raw.trimStart().length;
      const start = span.start + match.index + leading;
      const end = span.start + match.index + raw.length;
      if (end - start >= MIN_LENGTH) candidates.push({ text: text.slice(start, end), start, end });
      match = SENTENCE.exec(chunk);
    }
  }
  return candidates;
}

/** The covered/uncovered pieces of the text, in reading order — the input of the highlighting. */
export interface Segment {
  start: number;
  end: number;
  covered: boolean;
}

export function segmentsOf(textLength: number, uncovered: readonly TextSpan[]): Segment[] {
  const sorted = [...uncovered].sort((a, b) => a.start - b.start);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start > cursor) segments.push({ start: cursor, end: span.start, covered: true });
    if (span.end > span.start) segments.push({ start: span.start, end: span.end, covered: false });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < textLength) segments.push({ start: cursor, end: textLength, covered: true });
  return segments;
}
