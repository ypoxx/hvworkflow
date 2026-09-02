/**
 * Rights are data (AGENTS.md rule 4). Every step this view offers is gated on
 * `question._actions` — the list the server computed for the calling actor. Nothing here compares a
 * role name, and nothing here decides anything the server would decide differently.
 *
 * One action cannot come from `_actions` today, and that is a finding in the domain, not a decision
 * of this view: `actionsFor()` in packages/domain/src/api.ts evaluates every transition with an
 * empty payload, so guard R-GUARD-04 ("the approved version must be the latest answer version")
 * always fails and `question.approve` never appears in `_actions` — for anybody. Until `actionsFor`
 * passes `{ answerVersion: latest }` for that one action, the view asks the domain's own decision
 * point `can()` with exactly the payload the button is about to send. Same function, same answer,
 * no role name.
 */
import { can } from '@hv/domain';
import type { Actor, Question } from '@hv/domain';

/** The version "Freigeben" approves: always the newest text. */
export function latestVersion(question: Question): number | undefined {
  return question.answers[question.answers.length - 1]?.version;
}

export function mayApproveLatest(actor: Actor, question: Question): boolean {
  const version = latestVersion(question);
  if (version === undefined) return false;
  return can(actor, 'question.approve', question, { answerVersion: version }).allow;
}
