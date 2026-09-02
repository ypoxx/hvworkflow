/**
 * Small helpers of the answer backlog (Beantwortung). They live in the feature, not in the component
 * kit: the kit owns look and behaviour, not the wording of an age or the shape of a refused call.
 */
import type { Approval, DomainEvent, Question } from '@hv/domain';
import type { Translate } from '../../i18n';

/** One fetch per version carries the whole corpus; filtering and windowing happen in the client. */
export const LIST_LIMIT = 2000;

/** Row height of the work list. Fixed, because the windowing arithmetic depends on it. */
export const ROW_HEIGHT = 36;

/** How long a question has been in the house, in the house wording ("vor 12 min"). */
export function relativeAge(t: Translate, iso: string, now: number): string {
  const minutes = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t('time.now');
  if (minutes < 60) return t('time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hours', { n: hours });
  return t('time.days', { n: Math.floor(hours / 24) });
}

/** Wall clock of the hall, 24 hours, zero padded — the form an approval is quoted in. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/**
 * The status of a refused call. Structural instead of `instanceof`: the interface talks to `HvApi`,
 * and the HTTP adapter hands out a plain problem object rather than the domain's error class.
 */
export function problemStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/** The first 90 characters, the amount a 36px row can carry without shouting. */
export function excerpt(text: string, max = 90): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * The approval as a seal, or nothing. An approval is bound to a text version (R-GUARD-04); the
 * moment a newer version exists the seal is gone. The record decides that, not this function — it
 * only refuses to show a seal that the record itself has already outgrown.
 */
export function sealedApproval(question: Question): Approval | undefined {
  const approval = question.approval;
  if (approval === undefined) return undefined;
  return question.answers.length > approval.answerVersion ? undefined : approval;
}

/** The version "Freigeben" acts on: always the newest text. */
export function latestVersion(question: Question): number | undefined {
  return question.answers[question.answers.length - 1]?.version;
}

/** A lapsed approval, read off the event log (never inferred from the status). */
export interface LapsedApproval {
  /** The version that had been approved. */
  previous: number;
  /** The version that voided it. */
  current: number;
}

/**
 * "Freigabe erloschen": the record has no approval any more, but the log says there was one — an
 * `AnswerDrafted` event that carries `invalidatedApprovalOfVersion` (the domain writes it in
 * `draftAnswer`, R-GUARD-04). A later `QuestionApproved` ends the state again. Both facts come from
 * the event log; nothing here is derived from the status.
 */
export function lapsedApproval(
  question: Question,
  history: readonly DomainEvent[],
): LapsedApproval | undefined {
  if (question.approval !== undefined) return undefined;
  let lapsed: LapsedApproval | undefined;
  for (const event of history) {
    if (
      event.type === 'AnswerDrafted' &&
      event.payload.invalidatedApprovalOfVersion !== undefined
    ) {
      lapsed = {
        previous: event.payload.invalidatedApprovalOfVersion,
        current: event.payload.answer.version,
      };
    } else if (event.type === 'QuestionApproved') {
      lapsed = undefined;
    }
  }
  return lapsed;
}

/** Sources are typed as one line and stored as a list. */
export function splitSources(input: string): string[] {
  return input
    .split(';')
    .map((source) => source.trim())
    .filter((source) => source.length > 0);
}
