/**
 * Rights as data (docs/rollen-und-rechtekonzept.md).
 *
 * - `ROLE_PERMISSIONS` is the only place where a role name appears in the code base.
 * - `can()` is the single decision point. It answers Allow or Deny(reason, ruleId) and is used by
 *   the API for enforcement and for computing `_actions`.
 * - Transitions are checked in `transitions.ts`; `can()` combines both.
 */
import type { Actor, Permission, Role } from './types.js';
import { PERMISSIONS } from './types.js';

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  moderation: [
    'speaker.register',
    'speaker.reorder',
    'speaker.update',
    'question.stage',
    'question.return',
    'question.withdraw',
    'question.merge',
    'question.read',
  ],
  capture: [
    'contribution.capture',
    'question.capture',
    'question.classify',
    'question.assign',
    'question.merge',
    'question.withdraw',
    'question.read',
  ],
  expert: ['answer.draft', 'question.submit_review', 'question.read'],
  legal: ['answer.draft', 'question.approve', 'question.return', 'question.read'],
  approver: [
    'question.assign',
    'question.approve',
    'question.return',
    'question.stage',
    'question.read',
  ],
  podium: ['question.deliver', 'question.return', 'question.close', 'question.read'],
  admin: [...PERMISSIONS],
  observer: ['question.read'],
};

export type Decision =
  | { allow: true }
  | { allow: false; reason: string; ruleId: string };

export const ALLOW: Decision = { allow: true };
export const deny = (ruleId: string, reason: string): Decision => ({ allow: false, ruleId, reason });

/** R-PERM-01: a role may only do what its permission bundle lists. Deny by default. */
export function hasPermission(actor: Actor, permission: Permission): Decision {
  const bundle = ROLE_PERMISSIONS[actor.role];
  if (!bundle || !bundle.includes(permission)) {
    return deny('R-PERM-01', `Role "${actor.role}" lacks permission "${permission}".`);
  }
  return ALLOW;
}
