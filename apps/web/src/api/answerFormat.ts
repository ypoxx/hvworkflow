/**
 * Scheibe 055b (decision 7): the core's answer format (Antwortformat, 055), re-exported for the interface. Only here may
 * `features/**` reach values of `@hv/domain` (ADR 0001/0002 boundary, `dependency-cruiser.cjs`).
 *
 * A preview, never an authority: the core normalises every `draftAnswer` itself (055 N1–N10) and answers 422 where
 * the input does not hold. The read variant is used here because it never throws; for every input the write variant
 * accepts, both give the same document (055 N1–N7). Where they differ (a lone surrogate, plain text beyond 20 000 code
 * points, more blocks than the input form allows), the core answers 422 and the write door shows it as any 422.
 */
import { answerBodyFromText, answerPlainText, normalizeAnswerBodyForRead } from '@hv/domain';
import type { AnswerBody, AnswerBodyInput, AnswerInline, AnswerVersion } from '@hv/domain';

/** The document the core would store for this input, or `null` when nothing is left (empty, white space only). */
export function previewAnswer(input: AnswerBodyInput | null): AnswerBody | null {
  return input === null ? null : normalizeAnswerBodyForRead(input);
}

/** The plain text (P) of the previewed document; `''` when nothing is left. Sent as `text` next to `body`. */
export function previewText(input: AnswerBodyInput | null): string {
  const body = previewAnswer(input);
  return body === null ? '' : answerPlainText(body);
}

/** The document of a version: its body, or L from its text (old versions; the projection fills it in 0.4.4). */
export function answerBodyOf(version: Pick<AnswerVersion, 'body' | 'text'>): AnswerBody | null {
  return version.body ?? answerBodyFromText(version.text);
}

const sameRuns = (a: readonly AnswerInline[], b: readonly AnswerInline[]): boolean =>
  a.length === b.length &&
  a.every((run, i) => {
    const other = b[i]!;
    const marks = run.marks ?? [];
    const otherMarks = other.marks ?? [];
    return run.text === other.text && marks.length === otherMarks.length && marks.every((mark, j) => mark === otherMarks[j]);
  });

/**
 * Deep comparison of two stored documents (the closed form; marks are canonical there, so their order compares).
 * Absent and empty marks are the same; `null` and `undefined` both mean "no document".
 */
export function sameBody(a: AnswerBody | null | undefined, b: AnswerBody | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (a.language !== b.language || a.blocks.length !== b.blocks.length) return false;
  return a.blocks.every((block, i) => {
    const other = b.blocks[i]!;
    if (block.type === 'paragraph') return other.type === 'paragraph' && sameRuns(block.content, other.content);
    return other.type === 'list' && block.items.length === other.items.length && block.items.every((item, j) => sameRuns(item, other.items[j]!));
  });
}
