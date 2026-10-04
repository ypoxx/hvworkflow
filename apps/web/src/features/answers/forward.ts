/**
 * Scheibe 053 (decision 4): the dialog "An anderen Fachbereich weiterleiten" (forward to another answering unit) as
 * pure helpers without React. Built once here, next to the other write dialogs of the answer feature; the steering
 * view (053) offers it, the focus view (054) reuses it.
 *
 * Forwarding widens who reads the question to the target unit (048, MF-14). So nothing is chosen for the person:
 * neither target nor reason is preselected, and the reason is one of four closed codes — never free text, because the
 * log cannot forget a text (048 decision 4). Nothing here decides a right: whether forwarding is offered is
 * `_actions`, and whether it may happen is the transition table on the server.
 */
import type { ForwardReasonCode, ForwardRequest, Unit } from '@hv/domain';
import { problemStatus } from './lib';

/**
 * The four closed codes of the contract, in its order. Spelt out as a typed list instead of importing the domain's
 * value (features import types only, rule `web-features-i18n-domain-types-only`); `_ReasonsComplete` below fails the
 * build if the contract gains a code this list lacks.
 */
export const FORWARD_REASONS = ['wrong_unit', 'expertise_elsewhere', 'capacity', 'other'] as const satisfies readonly ForwardReasonCode[];
type _ReasonsComplete = Exclude<ForwardReasonCode, (typeof FORWARD_REASONS)[number]> extends never ? true : never;
// Referenced so the check is not an unused type; it is `true` exactly while the list is complete.
export const FORWARD_REASONS_COMPLETE: _ReasonsComplete = true;

/** The state of the dialog: nothing chosen until the person chooses. */
export interface ForwardForm {
  unitId: string | undefined;
  reasonCode: ForwardReasonCode | undefined;
}

export const EMPTY_FORWARD_FORM: ForwardForm = { unitId: undefined, reasonCode: undefined };

/** Every unit but the current one, in the order of the master data; without a current unit, all. */
export function forwardTargets(units: readonly Unit[], currentUnitId: string | undefined): Unit[] {
  return units.filter((unit) => unit.id !== currentUnitId);
}

/** The body that is sent: only with a target and a reason, and then exactly these two keys. */
export function buildForwardRequest(form: ForwardForm): ForwardRequest | undefined {
  if (form.unitId === undefined || form.reasonCode === undefined) return undefined;
  return { unitId: form.unitId, reasonCode: form.reasonCode };
}

export type ForwardProblem = 'guard15' | 'invalid' | 'gone';
/** The refusals shown inside the dialog; `gone` closes it instead. */
export type ForwardDialogProblem = Exclude<ForwardProblem, 'gone'>;

function ruleIdOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
}

/**
 * The refusals the dialog handles itself: 409 R-GUARD-15 (the question is already with that unit), 422 (unknown
 * unit or missing reason), and 404 — after forwarding out of one's own unit the question may no longer be readable
 * (048 decision 5), so the 404 says "forwarded or no longer visible", not "out of date".
 */
export function forwardProblemKey(error: unknown): ForwardProblem | undefined {
  const status = problemStatus(error);
  if (status === 409 && ruleIdOf(error) === 'R-GUARD-15') return 'guard15';
  if (status === 422) return 'invalid';
  if (status === 404) return 'gone';
  return undefined;
}

/**
 * The `onProblem` of the forward dialog for the write door (`useWriteDoor`), after `refusalProblemHandler` (045):
 * `guard15` and `invalid` are shown in the dialog and handled (inputs stay); `gone` closes the dialog (while its
 * question is still shown) and reports
 * (`gone`, a toast with the number), handled — no "Stand veraltet"; a 412 closes the dialog while its question is
 * still shown and leaves the notice to the door; everything else goes on to the toast with the dialog left open.
 */
export function forwardProblemHandler(
  show: (key: ForwardDialogProblem) => void,
  close: () => void,
  gone: () => void,
): (error: unknown, stillShown: () => boolean) => boolean {
  return (error, stillShown) => {
    const key = forwardProblemKey(error);
    if (key === 'gone') {
      // Only the dialog of the question still on screen closes (review 053, minor 2); the toast names the number
      // wherever the person is by now.
      if (stillShown()) close();
      gone();
      return true;
    }
    if (key !== undefined) {
      show(key);
      return true;
    }
    if (problemStatus(error) === 412 && stillShown()) close();
    return false;
  };
}
