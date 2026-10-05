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
import type { AnswerBodyInput, Question } from '@hv/domain';
import { previewAnswer, previewText } from '../../api/answerFormat';
import { isDirty, newDraft, writingOutcome } from '../focus/focus';
import type { FocusDraft } from '../focus/focus';

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
