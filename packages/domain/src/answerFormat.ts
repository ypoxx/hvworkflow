/**
 * Scheibe 055 (ADR 0005, contract 0.4.4): the answer format (Antwortformat) in the core. Pure functions, no clock,
 * no I/O, no markup: the core never sees HTML.
 *
 * Two forms (decision 1): the open input form `AnswerBodyInput` (block type and mark are bounded strings, so the
 * editor of 055b maps what it finds and never applies the whitelist) and the closed stored form `AnswerBody`
 * (blocks `paragraph`, `list`; marks `bold`, `italic`, `highlight`; `language` only `de`, E21).
 *
 * Two variants with the same rules (decision 2): `normalizeAnswerBodyForWrite` for `draftAnswer` (may throw a 422)
 * and `normalizeAnswerBodyForRead` for the projection (never throws; unusable parts fall away). The rules, in this
 * order within one paragraph or list item:
 *   N1 blocks: `list` gives one list of all its pieces (`content`, each of `items`); every other type one paragraph
 *      per piece. Nothing is lost, nothing invented.
 *   N2 marks: only the whitelist, once each, canonical order.
 *   N3 characters: `\p{White_Space}` becomes U+0020, then `\p{Cc}` and every `\p{Cf}` are removed (bidi, zero width,
 *      tag characters). A lone surrogate is a 422 when writing and U+FFFD when reading. Removing U+200D splits
 *      emoji joined with it into their parts (documented, Nit 6).
 *   N4 white space: a run of spaces across run boundaries becomes one space, kept in the run where it begins; a run
 *      of spaces only loses its marks; leading and trailing space of the paragraph falls away.
 *   N5 runs: empty runs fall away, neighbours with the same marks merge. Then NFC per run (runs are never merged by
 *      NFC: a combining mark that starts a run with other marks than its base stays separate, which is stable).
 *   N6 empty paragraphs, items and lists fall away. N7 adjacent lists merge.
 *   N8 (write only) a missing `language` is `de`, another value is a 422 (in the shape check).
 *   N9 (write only) the plain-text projection has at most 20000 code points; the structural limits of the stored
 *      form follow from that and never apply on their own when writing.
 *   N10 idempotent: the stored form is a fixed point of both variants.
 * P `answerPlainText` and L `answerBodyFromText` (decision 3), the lossless projection `projectAnswerBody`
 * (Codex P1 on #151) and the character filter of plain text `sanitizeAnswerText` (decision 2a).
 */
import { isWellFormed } from './masterData.js';

export const ANSWER_MARKS = ['bold', 'italic', 'highlight'] as const;
export type AnswerMark = (typeof ANSWER_MARKS)[number];
export const ANSWER_LANGUAGES = ['de'] as const;
export type AnswerLanguage = (typeof ANSWER_LANGUAGES)[number];
/** Every key the document uses. None may ever be one `maskValue` strips recursively (`MASKED_KEYS`, stream.ts; Nit 5). */
export const ANSWER_BODY_FIELDS = ['language', 'blocks', 'type', 'content', 'items', 'text', 'marks'] as const;
/** The text limit of `AnswerDraft.text` and of the plain-text projection (N9), in code points. */
export const ANSWER_TEXT_MAX_LENGTH = 20000;
/** Limits of the input form `AnswerBodyInput`, in step with the contract (Test 6). Lengths in code points. */
export const ANSWER_INPUT_LIMITS = { blocks: 2000, blockType: 32, content: 2000, items: 1000, itemRuns: 2000, runText: 20000, marks: 16, mark: 32 } as const;
/** Limits of the stored form `AnswerBody`, in step with the contract; they follow from N9. */
export const ANSWER_BODY_LIMITS = { blocks: 10000, items: 10000, runs: 20000, runText: 20000, marks: 3 } as const;

export interface AnswerInline { text: string; marks?: AnswerMark[] }
export interface AnswerParagraph { type: 'paragraph'; content: AnswerInline[] }
export interface AnswerList { type: 'list'; items: AnswerInline[][] }
export type AnswerBlock = AnswerParagraph | AnswerList;
export interface AnswerBody { language: AnswerLanguage; blocks: AnswerBlock[] }

export interface AnswerInlineInput { text: string; marks?: string[] }
export interface AnswerBlockInput { type: string; content?: AnswerInlineInput[]; items?: AnswerInlineInput[][] }
export interface AnswerBodyInput { language?: AnswerLanguage; blocks: AnswerBlockInput[] }

/** A 422 of the answer format. The API turns it into an `ApiProblem`; no message repeats submitted text. */
export class AnswerFormatError extends Error {
  readonly status = 422;
}

/**
 * Length in Unicode code points, as JSON Schema 2020-12 and the service's validator (Ajv `ucs2length`) count
 * `maxLength`: a surrogate pair is one character, a lone surrogate is one as well (Scheibe 044b, Codex P2 on #131).
 */
export function codePointLength(s: string): number {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const onlyKeys = (value: Obj, allowed: readonly string[]): boolean => Object.keys(value).every((key) => allowed.includes(key));
const boundedString = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'string' && value.length >= min && codePointLength(value) <= max;

function checkRuns(runs: unknown, max: number, at: string): string | undefined {
  if (!Array.isArray(runs) || runs.length > max) return `${at} must be an array of at most ${max} runs.`;
  for (const [i, run] of runs.entries()) {
    const here = `${at}[${i}]`;
    if (!isObject(run) || !onlyKeys(run, ['text', 'marks'])) return `${here} must be an object with text and optional marks only.`;
    if (!boundedString(run['text'], 0, ANSWER_INPUT_LIMITS.runText)) return `${here}.text must be a string of at most ${ANSWER_INPUT_LIMITS.runText} characters.`;
    const marks = run['marks'];
    if (marks !== undefined && (!Array.isArray(marks) || marks.length > ANSWER_INPUT_LIMITS.marks ||
        marks.some((mark) => !boundedString(mark, 1, ANSWER_INPUT_LIMITS.mark)))) {
      return `${here}.marks must be an array of at most ${ANSWER_INPUT_LIMITS.marks} strings of 1 to ${ANSWER_INPUT_LIMITS.mark} characters.`;
    }
  }
  return undefined;
}

/**
 * Shape and sizes of the input form, in step with the contract schema `AnswerBodyInput` (pattern of 044a), so that
 * the demo, which does not validate against the contract (034a), answers the same 422 as the service.
 */
export function checkAnswerBodyInput(input: unknown): string | undefined {
  if (!isObject(input) || !onlyKeys(input, ['language', 'blocks'])) return 'body must be an object with blocks and optional language only.';
  const language = input['language'];
  if (language !== undefined && !(ANSWER_LANGUAGES as readonly unknown[]).includes(language)) return 'body.language must be de.';
  const blocks = input['blocks'];
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > ANSWER_INPUT_LIMITS.blocks) {
    return `body.blocks must be an array of 1 to ${ANSWER_INPUT_LIMITS.blocks} blocks.`;
  }
  for (const [i, block] of blocks.entries()) {
    const at = `body.blocks[${i}]`;
    if (!isObject(block) || !onlyKeys(block, ['type', 'content', 'items'])) return `${at} must be an object with type, content and items only.`;
    if (!boundedString(block['type'], 1, ANSWER_INPUT_LIMITS.blockType)) return `${at}.type must be a string of 1 to ${ANSWER_INPUT_LIMITS.blockType} characters.`;
    if (block['content'] !== undefined) {
      const problem = checkRuns(block['content'], ANSWER_INPUT_LIMITS.content, `${at}.content`);
      if (problem) return problem;
    }
    const items = block['items'];
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length > ANSWER_INPUT_LIMITS.items) return `${at}.items must be an array of at most ${ANSWER_INPUT_LIMITS.items} items.`;
      for (const [j, item] of items.entries()) {
        const problem = checkRuns(item, ANSWER_INPUT_LIMITS.itemRuns, `${at}.items[${j}]`);
        if (problem) return problem;
      }
    }
  }
  return undefined;
}

interface Run { text: string; marks: AnswerMark[] }

const WHITE_SPACE = /\p{White_Space}/gu;
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}]/gu;
const LONE_SURROGATE = /\p{Cs}/gu;

const canonicalMarks = (marks: unknown): AnswerMark[] =>
  Array.isArray(marks) ? ANSWER_MARKS.filter((mark) => marks.includes(mark)) : [];
const sameMarks = (a: readonly AnswerMark[], b: readonly AnswerMark[]): boolean =>
  a.length === b.length && a.every((mark, i) => mark === b[i]);

/** N5: drop empty runs, merge neighbours with the same marks (marks are canonical, so order compares). */
function mergeRuns(runs: readonly Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (run.text.length === 0) continue;
    const previous = out[out.length - 1];
    if (previous !== undefined && sameMarks(previous.marks, run.marks)) previous.text += run.text;
    else out.push({ text: run.text, marks: run.marks });
  }
  return out;
}

/** N2–N5 and NFC for the runs of one paragraph or list item. Never throws; the write variant checked before. */
function normalizeRuns(raw: readonly unknown[], lenient: boolean): Run[] {
  const runs: Run[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item['text'] !== 'string') continue;
    const text = (lenient ? item['text'].replace(LONE_SURROGATE, '�') : item['text'])
      .replace(WHITE_SPACE, ' ')
      .replace(CONTROL_OR_FORMAT, '');
    runs.push({ text, marks: canonicalMarks(item['marks']) });
  }
  // N4: one space per sequence across runs, kept in the run where it begins; none at the start.
  let afterSpace = true;
  for (const run of runs) {
    let text = run.text.replace(/ {2,}/g, ' ');
    if (afterSpace && text.startsWith(' ')) text = text.slice(1);
    if (text.length > 0) afterSpace = text.endsWith(' ');
    run.text = text;
  }
  // N4: none at the end, also when the trailing space stands in a run of its own.
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i]!;
    if (run.text.length === 0) continue;
    if (run.text.endsWith(' ')) run.text = run.text.slice(0, -1);
    if (run.text.length > 0) break;
  }
  // A mark on white space is invisible and would break idempotency.
  for (const run of runs) if (run.text.length > 0 && run.text.trim().length === 0) run.marks = [];
  const merged = mergeRuns(runs);
  for (const run of merged) run.text = run.text.normalize('NFC');
  return mergeRuns(merged);
}

const toInlines = (runs: readonly Run[]): AnswerInline[] =>
  runs.map((run) => (run.marks.length > 0 ? { text: run.text, marks: [...run.marks] } : { text: run.text }));

/** N1, N6, N7 over the blocks; the runs of each piece through `normalizeRuns`. */
function normalizeBlocks(blocks: readonly unknown[], lenient: boolean): AnswerBlock[] {
  const out: AnswerBlock[] = [];
  for (const block of blocks) {
    if (!isObject(block)) continue;
    const pieces: unknown[][] = [];
    if (Array.isArray(block['content'])) pieces.push(block['content']);
    if (Array.isArray(block['items'])) for (const item of block['items']) if (Array.isArray(item)) pieces.push(item);
    const normalized = pieces.map((piece) => normalizeRuns(piece, lenient)).filter((runs) => runs.length > 0);
    if (block['type'] === 'list') {
      if (normalized.length === 0) continue;
      const items = normalized.map(toInlines);
      const previous = out[out.length - 1];
      // N7; a loop, not a spread: a merged list may be long.
      if (previous?.type === 'list') for (const item of items) previous.items.push(item);
      else out.push({ type: 'list', items });
    } else {
      for (const runs of normalized) out.push({ type: 'paragraph', content: toInlines(runs) });
    }
  }
  return out;
}

function exceedsStructure(blocks: readonly AnswerBlock[]): boolean {
  if (blocks.length > ANSWER_BODY_LIMITS.blocks) return true;
  const runsExceed = (runs: readonly AnswerInline[]): boolean =>
    runs.length > ANSWER_BODY_LIMITS.runs || runs.some((run) => codePointLength(run.text) > ANSWER_BODY_LIMITS.runText);
  return blocks.some((block) => (block.type === 'paragraph' ? runsExceed(block.content)
    : block.items.length > ANSWER_BODY_LIMITS.items || block.items.some(runsExceed)));
}

function allWellFormed(input: AnswerBodyInput): boolean {
  const runs = (piece: readonly AnswerInlineInput[] | undefined): boolean => (piece ?? []).every((run) => isWellFormed(run.text));
  return input.blocks.every((block) => runs(block.content) && (block.items ?? []).every(runs));
}

/** Write variant (decision 2): shape check, then N1–N10. Throws `AnswerFormatError` (422). */
export function normalizeAnswerBodyForWrite(input: unknown): AnswerBody {
  const shape = checkAnswerBodyInput(input);
  if (shape !== undefined) throw new AnswerFormatError(shape);
  const doc = input as AnswerBodyInput;
  if (!allWellFormed(doc)) throw new AnswerFormatError('body must be well-formed UTF-16 (no lone surrogate).');
  const blocks = normalizeBlocks(doc.blocks, false);
  if (blocks.length === 0) throw new AnswerFormatError('Answer text is required.');
  const body: AnswerBody = { language: 'de', blocks };
  if (codePointLength(answerPlainText(body)) > ANSWER_TEXT_MAX_LENGTH) {
    throw new AnswerFormatError(`Answer text must not exceed ${ANSWER_TEXT_MAX_LENGTH} characters.`);
  }
  return body;
}

/**
 * Read variant (decision 2): N1–N7 on anything stored, never throws. `null` when nothing is left or the result
 * exceeds a structural limit of the stored form; the projection then derives the document from `text` (L).
 * `language` is always `de`, the only value of the stored form.
 */
export function normalizeAnswerBodyForRead(stored: unknown): AnswerBody | null {
  if (!isObject(stored) || !Array.isArray(stored['blocks'])) return null;
  const blocks = normalizeBlocks(stored['blocks'], true);
  if (blocks.length === 0 || exceedsStructure(blocks)) return null;
  return { language: 'de', blocks };
}

/** P: runs joined, items with "\n", blocks with "\n\n", NFC over the whole; no bullet (the reading time counts words). */
export function answerPlainText(body: AnswerBody): string {
  const line = (runs: readonly AnswerInline[]): string => runs.map((run) => run.text).join('');
  return body.blocks.map((block) => (block.type === 'list' ? block.items.map(line).join('\n') : line(block.content)))
    .join('\n\n').normalize('NFC');
}

/**
 * L: a document for a version without one (before 0.4.4, refusals). Lines split at CR LF, CR and LF (Codex P2 on
 * #151), each non-empty line one paragraph with one run without marks, then the read variant. Never throws; `null`
 * for a text of white space only or one beyond the structural limits (only above 20000 code points).
 */
export function answerBodyFromText(text: string): AnswerBody | null {
  if (typeof text !== 'string') return null;
  const blocks = text.split(/\r\n|\r|\n/).filter((line) => line.length > 0)
    .map((line) => ({ type: 'paragraph', content: [{ text: line }] }));
  return normalizeAnswerBodyForRead({ language: 'de', blocks });
}

/**
 * The document of a version in the projection (decision 5): the stored body through the read variant, unless that
 * lost wording, i.e. its plain text differs from the stored `text` (Codex P1 on #151); then, and without a stored
 * body, L from `text`. A dropped mark does not change the plain text. `undefined` only for broken old data.
 */
export function projectAnswerBody(stored: unknown, text: unknown): AnswerBody | undefined {
  if (stored !== undefined) {
    const read = normalizeAnswerBodyForRead(stored);
    if (read !== null && (typeof text !== 'string' || answerPlainText(read) === text)) return read;
  }
  return (typeof text === 'string' ? answerBodyFromText(text) : null) ?? undefined;
}

const TEXT_CONTROL_OR_FORMAT = /\p{Cf}|(?![\t\n\r])\p{Cc}/gu;

/**
 * Decision 2a: the character filter of plain text (`draftAnswer` without body, `proposeRefusal` for wording and
 * justification). Removes `\p{Cc}` except tab, LF and CR, and every `\p{Cf}`; NFC; trim. White space is not mapped,
 * the lines stay lines. A lone surrogate throws (422). A text without such characters and already in NFC comes back
 * as the same string apart from the trim.
 */
export function sanitizeAnswerText(text: string, field = 'text'): string {
  if (!isWellFormed(text)) throw new AnswerFormatError(`${field} must be well-formed UTF-16 (no lone surrogate).`);
  return text.replace(TEXT_CONTROL_OR_FORMAT, '').normalize('NFC').trim();
}
