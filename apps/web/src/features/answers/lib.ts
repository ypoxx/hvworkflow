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

/**
 * Urgency of an open row, from the age of the question alone (no status logic, AGENTS.md rule 5):
 * 0 under 15 minutes, 1 from 15 to 45, 2 beyond that. The caller decides whether a terminal status
 * shows it at all.
 */
export function urgencyLevel(createdAt: string, now: number): 0 | 1 | 2 {
  const minutes = (now - Date.parse(createdAt)) / 60_000;
  if (minutes < 15) return 0;
  if (minutes < 45) return 1;
  return 2;
}

/** One token of a word-level diff: kept, taken out, or put in. */
export interface DiffPart {
  type: 'equal' | 'removed' | 'added';
  text: string;
}

/**
 * A word-level diff between two answer texts, so that "Änderung gegenüber Version n-1" can be read
 * at a glance instead of re-read in full. LCS over whitespace tokens — plenty for a few hundred words
 * of house prose, and simple enough to keep without pulling in a diff library.
 */
export function wordDiff(a: string, b: string): DiffPart[] {
  const left = a.split(/\s+/).filter((word) => word.length > 0);
  const right = b.split(/\s+/).filter((word) => word.length > 0);
  const n = left.length;
  const m = right.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] =
        left[i] === right[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string): void => {
    const last = parts[parts.length - 1];
    if (last !== undefined && last.type === type) last.text = `${last.text} ${text}`;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      push('equal', left[i]!);
      i += 1;
      j += 1;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push('removed', left[i]!);
      i += 1;
    } else {
      push('added', right[j]!);
      j += 1;
    }
  }
  while (i < n) {
    push('removed', left[i]!);
    i += 1;
  }
  while (j < m) {
    push('added', right[j]!);
    j += 1;
  }
  return parts;
}
