/**
 * takt-048: the draft of the Beantwortung (answer detail), without React.
 *
 * The field starts with the latest answer version, exactly as the focus view's writing mode does: the draft is the same
 * `FocusDraft`, built and compared by the same helpers of `features/focus/focus.ts` (`newDraft`, `isDirty`,
 * `writingOutcome`; parity by construction, no second rule "which version counts"). What is the Beantwortung's own
 * stands here: when saving is offered, what a new record of the shown question does to the draft, what a saved version
 * does, and "Verwerfen".
 *
 * Why the care: a new version voids an approval and a legal clearance (R-TRANS-03, R-GUARD-04), even a version with the
 * same wording, and the core does not refuse one. A prefilled field must therefore never be saveable unchanged, and a
 * newer foreign version under it must never be overwritten silently with the older wording.
 */
import type { AnswerBody, AnswerBodyInput, Question } from '@hv/domain';
import { answerBodyOf, previewAnswer, previewText } from '../../api/answerFormat';
import type { BufferedDraft } from '../../api/draftBuffer';
import { draftBase, draftKey, isDirty, joinSources, newDraft, writingOutcome } from '../focus/focus';
import type { FocusDraft } from '../focus/focus';
import { refusalKindOf } from './refusal';

/** The draft a question's detail starts with (and starts again with on an actor change): its latest version. */
export function startDraft(actorId: string, question: Pick<Question, 'id' | 'number' | 'answers'>, generation = 0): FocusDraft {
  return newDraft(actorId, question, generation);
}

/**
 * Saving is offered only for a changed, non-empty draft the person may write, while no write runs. Changed means the
 * preview document (a mark counts, white space does not) or the sources differ from the base (055 decision 7; 054).
 */
export function canSave(draft: FocusDraft, ui: { mayDraft: boolean; busy: boolean }): boolean {
  return ui.mayDraft && !ui.busy && isDirty(draft) && previewText(draft.body) !== '';
}

/**
 * A new record of the shown question. One's own saved version moves the base without rebuilding the field; a foreign
 * version over an unchanged draft rebuilds it (`generation + 1`); over a changed draft the text stays and the notice
 * stands (`draft.rebase`). Without `answer.draft` the draft stays as it is (the field is not shown then).
 */
export function onRecord(draft: FocusDraft, question: Pick<Question, 'id' | 'answers' | '_actions'>): { draft: FocusDraft; notice: boolean } {
  const outcome = writingOutcome(draft, question);
  if (outcome.kind === 'rebase' || outcome.kind === 'notice') return { draft: outcome.draft, notice: outcome.draft.rebase };
  return { draft, notice: draft.rebase };
}

function normalSources(input: string): string {
  return input
    .split(';')
    .map((source) => source.trim())
    .filter((source) => source !== '')
    .join('; ');
}

/**
 * After the own version was written: the base becomes what was sent, `baseVersion` at least the saved number (counted
 * on the record when it was sent). The field is not rebuilt; what was typed meanwhile stays and counts as a change.
 * With `onRecord` for the same version, both orders end in the same draft.
 */
export function afterSave(draft: FocusDraft, sent: { body: AnswerBodyInput; sources: string }, savedVersion: number): FocusDraft {
  return {
    ...draft,
    baseVersion: Math.max(draft.baseVersion, savedVersion),
    baseBody: previewAnswer(sent.body),
    baseSources: normalSources(sent.sources),
    rebase: false,
  };
}

/**
 * "Verwerfen": the field shows the base again (the latest version, or what was saved last) and is rebuilt. When a newer
 * version stood behind the notice, the draft moves onto it at once, so the field never shows an outdated version.
 */
export function discard(draft: FocusDraft, question: Pick<Question, 'id' | 'answers' | '_actions'>): FocusDraft {
  const restored: FocusDraft = {
    ...draft,
    body: draft.baseBody,
    sources: draft.baseSources,
    rebase: false,
    generation: draft.generation + 1,
  };
  return onRecord(restored, question).draft;
}

/** The base of a draft: version number, its document (stored form) and its sources. */
export interface DraftBase {
  baseVersion: number;
  baseBody: AnswerBody | null;
  baseSources: string;
}

/**
 * Scheibe 060 (re-check major 2): the base at a given answer version of the record, by the rule of `draftBase` — the
 * document through `answerBodyOf`, the sources through `joinSources`, empty at a refusal and at version 0. `undefined`
 * when the record has no such version.
 */
export function baseAt(question: Pick<Question, 'answers'>, version: number): DraftBase | undefined {
  if (version === 0) return { baseVersion: 0, baseBody: null, baseSources: '' };
  const found = question.answers.find((answer) => answer.version === version);
  if (found === undefined) return undefined;
  if (refusalKindOf(found) !== 'answer') return { baseVersion: version, baseBody: null, baseSources: '' };
  return { baseVersion: version, baseBody: answerBodyOf(found), baseSources: joinSources(found.sources) };
}

/** Whether a draft says what a base says (same rule as `isDirty`: the preview document and the normalised sources). */
const saysWhat = (draft: Pick<FocusDraft, 'body' | 'sources'>, base: DraftBase): boolean =>
  !isDirty({ body: draft.body, sources: draft.sources, baseBody: base.baseBody, baseSources: base.baseSources });

export interface RestoreResult {
  draft: FocusDraft;
  /** The draft is the person's buffered text; the field says "wiederhergestellt". */
  restored: boolean;
  /** The entry is to be deleted (unchanged against its base, a base the record does not have, rights gone after roles_changed). */
  drop: boolean;
  /** When the restored text was last changed (the line "wiederhergestellt"). */
  changedAt?: number;
}

type RestoreQuestion = Pick<Question, 'id' | 'number' | 'answers' | '_actions' | 'meetingId'>;

/**
 * Scheibe 060 (decision 5): where a draft is started, a buffered draft of the same actor, meeting and question goes before
 * the prefill of takt-048. The base always comes from the record at `entry.baseVersion` (`baseAt`), never from the entry:
 * a manipulated or outdated entry can neither unlock saving an unchanged text nor fake a base. Then the restored draft is
 * compared with the record (`onRecord`): a newer version saying the same moves the base (entry dropped), over changed text
 * the notice stands. Without `answer.draft` nothing is restored; the entry stays, unless `roles_changed` was seen.
 */
export function restoreDraft(
  entry: BufferedDraft | undefined,
  actorId: string,
  question: RestoreQuestion,
  generation: number,
  options: { rolesChanged?: boolean } = {},
): RestoreResult {
  const prefill = (): FocusDraft => startDraft(actorId, question, generation);
  if (entry === undefined || entry.ownerId !== actorId || entry.questionId !== question.id ||
    question.meetingId === undefined || entry.meetingId !== question.meetingId) {
    return { draft: prefill(), restored: false, drop: false };
  }
  if (!question._actions.includes('answer.draft')) return { draft: prefill(), restored: false, drop: options.rolesChanged === true };
  const latest = draftBase(question).baseVersion;
  const base = entry.baseVersion > latest ? undefined : baseAt(question, entry.baseVersion);
  if (base === undefined) return { draft: prefill(), restored: false, drop: true };
  const draft: FocusDraft = {
    key: draftKey(actorId, question.id),
    questionId: question.id,
    number: question.number,
    body: entry.body,
    sources: entry.sources,
    ...base,
    rebase: false,
    generation,
  };
  if (!isDirty(draft)) return { draft: prefill(), restored: false, drop: true };
  const compared = onRecord(draft, question).draft;
  if (!isDirty(compared)) return { draft: compared, restored: false, drop: true };
  return { draft: compared, restored: true, drop: false, changedAt: entry.changedAt };
}

/**
 * Decision 5, the late snapshot: it arrived after the draft was started. Over an unchanged draft the restored one replaces
 * it with `generation + 1` (the field rebuilds); once the person has typed, their text stays.
 */
export function lateRestore(
  draft: FocusDraft,
  entry: BufferedDraft | undefined,
  actorId: string,
  question: RestoreQuestion,
  options: { rolesChanged?: boolean } = {},
): RestoreResult {
  if (isDirty(draft)) return { draft, restored: false, drop: false };
  const result = restoreDraft(entry, actorId, question, draft.generation + 1, options);
  return result.restored ? result : { draft, restored: false, drop: result.drop };
}

/**
 * Decision 7.3: what a 412 on one's own save means, read against the record shown at the time and again against the next
 * record of the question: a newer answer version saying something else → compare; saying the same → rebase silently (as
 * `onRecord`); none (the record moved otherwise) → retry, the notice "Stand veraltet" stays and a second click saves.
 */
export function conflictAfterRefusal(draft: FocusDraft, question: Pick<Question, 'answers'>): 'compare' | 'rebase-silent' | 'retry' {
  const base = draftBase(question);
  if (base.baseVersion <= draft.baseVersion) return 'retry';
  return saysWhat(draft, base) ? 'rebase-silent' : 'compare';
}

function fromShown(question: Pick<Question, 'answers'>, shownVersion: number): DraftBase {
  return baseAt(question, shownVersion) ?? draftBase(question);
}

/**
 * "Mit meiner Fassung weiter" (decision 7): the base becomes the version the comparison shows, not one read again from
 * the record; the text stays and the field rebuilds. Then the record is asked once more: a still newer version sets the
 * notice again (never a silent overwrite).
 */
export function keepMine(draft: FocusDraft, shownVersion: number, question: Pick<Question, 'id' | 'answers' | '_actions'>): FocusDraft {
  const next: FocusDraft = { ...draft, ...fromShown(question, shownVersion), rebase: false, generation: draft.generation + 1 };
  return onRecord(next, question).draft;
}

/** "Version n übernehmen": the draft is the shown version, unchanged, rebuilt; then the record is asked once more. */
export function takeTheirs(draft: FocusDraft, shownVersion: number, question: Pick<Question, 'id' | 'answers' | '_actions'>): FocusDraft {
  const base = fromShown(question, shownVersion);
  const next: FocusDraft = { ...draft, ...base, body: base.baseBody, sources: base.baseSources, rebase: false, generation: draft.generation + 1 };
  return onRecord(next, question).draft;
}

/** Decision 7.2: saving while the notice of a newer version stands opens the comparison; `canSave` itself is unchanged. */
export function saveDecision(draft: Pick<FocusDraft, 'rebase'>, saveable: boolean): 'compare' | 'send' | 'none' {
  if (!saveable) return 'none';
  return draft.rebase ? 'compare' : 'send';
}

export type BufferStep =
  | { kind: 'none' }
  | { kind: 'delete' }
  | { kind: 'put'; body: AnswerBodyInput | null; sources: string; baseVersion: number };

/**
 * Decision 4: only an input of the person writes to the buffer — a changed draft is put, one made unchanged again is
 * deleted; a programmatic rebuild (actor change, a foreign version, start) writes nothing.
 */
export function bufferStep(draft: FocusDraft, byInput: boolean): BufferStep {
  if (!byInput) return { kind: 'none' };
  if (!isDirty(draft)) return { kind: 'delete' };
  return { kind: 'put', body: draft.body, sources: draft.sources, baseVersion: draft.baseVersion };
}
