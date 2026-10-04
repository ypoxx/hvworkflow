/**
 * Scheibe 053 (decision 5): which steering steps (Steuerung) the detail offers, as a pure helper without React.
 *
 * It reads the list of rights of the question (`_actions`) and nothing else — never a role (AGENTS.md R4), never the
 * status (R5): the same list yields the same result in every status. Whether a step may actually happen is decided
 * by the transition table on the server.
 */
import type { Permission } from '@hv/domain';

export type SteeringAction = 'classify' | 'assign' | 'forward' | 'refuse';

export interface SteeringActions {
  primary?: SteeringAction;
  secondary: SteeringAction[];
}

/** Candidates for the primary action, in rank: forwarding keeps its reason in the log, assigning does not (048). */
const RANK: readonly { action: SteeringAction; permission: Permission }[] = [
  { action: 'forward', permission: 'question.forward' },
  { action: 'assign', permission: 'question.assign' },
  { action: 'classify', permission: 'question.classify' },
];

export function steeringActions(actions: readonly Permission[]): SteeringActions {
  const has = (permission: Permission): boolean => actions.includes(permission);
  // Owner question 2 (default): where forwarding is allowed, assigning is not offered here — both change the unit,
  // only forwarding says why. The answer view keeps assigning as it is.
  const offered = RANK.filter(({ action, permission }) => has(permission) && !(action === 'assign' && has('question.forward')))
    .map(({ action }) => action);
  const [primary, ...rest] = offered;
  // Proposing a refusal is never primary (045): it is a side step, not the next step.
  const secondary = has('question.refuse.propose') ? [...rest, 'refuse' as const] : rest;
  return primary === undefined ? { secondary } : { primary, secondary };
}
