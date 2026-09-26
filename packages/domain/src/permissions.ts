/**
 * Rights as data (docs/rollen-und-rechtekonzept.md).
 *
 * - `ROLE_PERMISSIONS` is the only place where a role name appears in the code base.
 * - `can()` is the single decision point. It answers Allow or Deny(reason, ruleId) and is used by
 *   the API for enforcement and for computing `_actions`.
 * - Transitions are checked in `transitions.ts`; `can()` combines both.
 */
import type { Actor, Permission, QuestionStatus, Role } from './types.js';
import { PERMISSIONS, READ_PERMISSIONS } from './types.js';

/**
 * Rights vested by role (Festlegung 4 of docs/slices/010-lesepfade-leserechte.md — the read grants
 * are reasoned there beyond the plan's wording; the diff goes to the owner). `podium` lost
 * `question.read` (it only holds `stage.read`: it works the podium queue, not the question archive)
 * and `observer` lost `question.read` for the scoped `question.read.delivered` (it sees counters and
 * what has been read out, R-PERM-03 below).
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  moderation: [
    'speaker.register',
    'speaker.reorder',
    'speaker.update',
    'question.stage',
    'question.return',
    'question.withdraw',
    'question.merge',
    'speaker.read', // runs the Wortmeldeliste (docs/ist-analyse-und-schnittstellen.md)
    'contribution.read', // sees which speaker request became a Redebeitrag
    'question.read',
    'stage.read', // holds question.stage, must see what is on the podium
    'history.read', // may read a question, may trace how it came to be (Plan 3)
  ],
  capture: [
    'contribution.capture',
    'question.capture',
    'question.merge',
    'question.withdraw',
    'speaker.read',
    'contribution.read',
    'question.read', // atomises questions (question.capture); classify/assign moved to coordination (021b)
    'history.read',
  ],
  // Koordination (slice 021b): routes what capture atomised — classify into a track, assign to a
  // unit. Reads what it needs to judge a question in context; captures nothing itself.
  coordination: [
    'question.classify',
    'question.assign',
    'question.read',
    'contribution.read',
    'speaker.read',
    'history.read',
  ],
  expert: ['answer.draft', 'question.submit_review', 'question.read', 'history.read'],
  legal: ['answer.draft', 'question.approve', 'question.return', 'question.read', 'history.read'],
  approver: [
    'question.assign',
    'question.approve',
    'question.return',
    'question.stage',
    'question.read',
    'stage.read', // holds question.stage
    'history.read',
  ],
  podium: ['question.deliver', 'question.return', 'question.close', 'stage.read'],
  admin: [...PERMISSIONS],
  observer: ['question.read.delivered'],
};

/**
 * R-PERM-03 (Leseumfang): a permission that only unlocks a question in specific statuses. `can()`
 * (packages/domain/src/api.ts) applies this whenever the checked action is a key here, and — via
 * `extends` — also offers it as a status-scoped alternative to a broader permission (Festlegung 2):
 * `question.read.delivered` both restricts itself to `delivered`/`closed` (for every holder, admin
 * included) and, within that scope, substitutes for `question.read`. Data, never a status literal in
 * `api.ts` (Regel 5, Rechtekonzept 2.2).
 */
export interface ReadScope {
  readonly statuses: readonly QuestionStatus[];
  readonly extends?: Permission;
}
export const READ_SCOPES: Partial<Record<Permission, ReadScope>> = {
  'question.read.delivered': { statuses: ['delivered', 'closed'], extends: 'question.read' },
};

/**
 * Every `READ_SCOPES` entry whose `extends` targets `action` and that `actor` holds — the walk
 * `can()` needs when the actor lacks `action` itself, to see whether a scoped alternative substitutes
 * for it. The single place this walk happens (rework round after review, point 3): a second scoped
 * read right that `extends` the same action is picked up here automatically, with no further change
 * to `can()`, `listQuestions`'s status-filter check, or any other caller.
 */
export function extendingScopesFor(actor: Actor, action: Permission): readonly ReadScope[] {
  const scopes: ReadScope[] = [];
  for (const [p, scope] of Object.entries(READ_SCOPES) as [Permission, ReadScope][]) {
    if (scope.extends === action && hasPermission(actor, p).allow) scopes.push(scope);
  }
  return scopes;
}

/** Every permission named in `READ_PERMISSIONS` (types.ts, Festlegung 6) — turns a missing grant
 * into R-PERM-02 (Leserecht fehlt) instead of R-PERM-01 (Schreibrecht fehlt). Membership in this
 * data decides; there is no name-based check like `.endsWith('.read')`. */
export const READ_PERMISSION_LIST: readonly Permission[] = Array.from(
  new Set(Object.values(READ_PERMISSIONS).flat()),
);
const READ_PERMISSION_SET: ReadonlySet<Permission> = new Set(READ_PERMISSION_LIST);

export type Decision =
  | { allow: true }
  | { allow: false; reason: string; ruleId: string };

export const ALLOW: Decision = { allow: true };
export const deny = (ruleId: string, reason: string): Decision => ({ allow: false, ruleId, reason });

/** R-PERM-01/R-PERM-02: a role may only do what its permission bundle lists. Deny by default; a
 * missing read permission (member of `READ_PERMISSIONS`, types.ts) is R-PERM-02, anything else
 * (a write permission) is R-PERM-01. */
export function hasPermission(actor: Actor, permission: Permission): Decision {
  const bundle = ROLE_PERMISSIONS[actor.role];
  if (!bundle || !bundle.includes(permission)) {
    const ruleId = READ_PERMISSION_SET.has(permission) ? 'R-PERM-02' : 'R-PERM-01';
    return deny(ruleId, `Role "${actor.role}" lacks permission "${permission}".`);
  }
  return ALLOW;
}
