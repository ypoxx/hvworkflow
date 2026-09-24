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

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Structural, not `instanceof`: the interface talks to `HvApi`, and an HTTP adapter hands out a
 * plain problem object rather than the domain's error class. Read by ruleId alone, never by role
 * name (AGENTS.md rule 4, docs/slices/010b-lesepfade-oberflaeche.md Ziel 4) — e.g. expert, who
 * holds `question.read` but no `stage.read`.
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status: unknown }).status : undefined;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return status === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
}
