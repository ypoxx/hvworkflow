/**
 * Helpers of the podium. Deliberately tiny and local: the podium is a different device (design
 * principle 10) and must not start depending on the backlog's machinery.
 */
import type { AnswerVersion, Question } from '@hv/domain';

/** Wall clock of the hall, 24 hours, zero padded — the form an approval is quoted in. */
export function clockTime(iso: string): string {
  const at = new Date(iso);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/**
 * The text that may be read out: the answer version the approval is bound to, and nothing else.
 * If the record carries no approval, or a newer version has already voided it, the podium gets no
 * text — that is a fact of the record, not a decision of this view (R-GUARD-04).
 */
export function approvedAnswer(question: Question): AnswerVersion | undefined {
  const approval = question.approval;
  if (approval === undefined) return undefined;
  if (question.answers.length > approval.answerVersion) return undefined;
  return question.answers.find((answer) => answer.version === approval.answerVersion);
}

/** Space and R must never fire while somebody is typing a reason or tabbing over a button. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)
  );
}
