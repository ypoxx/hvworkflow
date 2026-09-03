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

/**
 * Abbreviations whose trailing period does not end a sentence. Dictated speeches are full of them
 * ("in Mio. EUR", "z. B.", "Nr. 7"); a digit before the period ("3. Quartal") never ends one either.
 */
const ABBREVIATIONS = new Set([
  'mio', 'mrd', 'tsd', 'nr', 'ca', 'bzw', 'vgl', 'abs', 'art', 'z', 'b', 'u', 'a', 'd', 'h',
  'usw', 'evtl', 'ggf', 'inkl', 'exkl', 'sog', 'str', 'dr', 'prof', 'gj', 'vj', 'hv', 'ar',
]);
const LETTER = /[A-Za-zÄÖÜäöüß]/;

/** Does the character at `i` end a sentence (or a connective such as "Meine erste Frage:")? */
function endsSentence(chunk: string, i: number): boolean {
  const ch = chunk[i];
  const next = chunk[i + 1];
  const followedByBreak = next === undefined || /\s/.test(next);
  if (ch === '?' || ch === '!' || ch === ':') return followedByBreak;
  if (ch !== '.' || !followedByBreak) return false;
  let j = i - 1;
  while (j >= 0 && LETTER.test(chunk[j]!)) j--;
  const token = chunk.slice(j + 1, i);
  if (token.length === 0) return false; // "3. Quartal", "..."
  if (token.length <= 1) return false; // "z. B."
  return !ABBREVIATIONS.has(token.toLowerCase());
}

export function suggestQuestions(text: string, uncovered: readonly TextSpan[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const span of uncovered) {
    const chunk = text.slice(span.start, span.end);
    let cursor = 0;
    for (let q = chunk.indexOf('?'); q !== -1; q = chunk.indexOf('?', q + 1)) {
      // The candidate runs from the last sentence end before the question mark to the mark itself.
      let from = cursor;
      for (let i = q - 1; i >= cursor; i--) {
        if (endsSentence(chunk, i)) {
          from = i + 1;
          break;
        }
      }
      while (from < q && /\s/.test(chunk[from]!)) from++;
      const start = span.start + from;
      const end = span.start + q + 1;
      if (end - start >= MIN_LENGTH) candidates.push({ text: text.slice(start, end), start, end });
      cursor = q + 1;
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

/** One captured Einzelfrage's place in the Redebeitrag, with its 1-based position in the card list. */
export interface Marker {
  id: string;
  number: number;
  start: number;
  end: number;
}

/** A run of the Redebeitrag, tagged with the Einzelfrage it belongs to — or plain, if none does. */
export interface MarkedSegment {
  start: number;
  end: number;
  marker: Marker | undefined;
}

/**
 * The text split at the boundary of every captured span, individually — unlike `segmentsOf`, which
 * only tells covered from uncovered, this keeps each Einzelfrage's own boundary so every one gets its
 * own superscript marker, even where two captured spans sit back to back. Overlapping input (should
 * not occur: a capture is only ever taken from currently uncovered text) is resolved by keeping the
 * first span in text order and dropping what would overlap it, so the result never overlaps itself.
 */
export function markedSegmentsOf(textLength: number, markers: readonly Marker[]): MarkedSegment[] {
  const sorted = [...markers]
    .map((m) => ({ ...m, start: Math.max(0, m.start), end: Math.min(textLength, m.end) }))
    .filter((m) => m.end > m.start)
    .sort((a, b) => a.start - b.start);
  const segments: MarkedSegment[] = [];
  let cursor = 0;
  for (const marker of sorted) {
    if (marker.start < cursor) continue;
    if (marker.start > cursor) segments.push({ start: cursor, end: marker.start, marker: undefined });
    segments.push({ start: marker.start, end: marker.end, marker });
    cursor = marker.end;
  }
  if (cursor < textLength) segments.push({ start: cursor, end: textLength, marker: undefined });
  return segments;
}
