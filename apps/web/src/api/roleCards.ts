/**
 * Scheibe 041: the role cards (Rollenkarten) — the rights table of this build read as data. One card per key of
 * `ROLE_PERMISSIONS`, in its order; what the role reads (a permission that unlocks a read method, `READ_PERMISSIONS`) and
 * what it acts with (every other permission), both in the order of `PERMISSIONS`; and whether its read is bound to its
 * answering unit (`unitBoundRead`).
 *
 * It lives in `api/` because only this folder loads values from `@hv/domain` (ADR 0001/0002 boundary). It names no role
 * and branches on none: it iterates the table, so a role or a permission added later appears without a change here. What
 * a person may actually do is decided by the service (`can()`); the cards are an explanation, never a decision.
 */
import { PERMISSIONS, READ_PERMISSIONS, ROLE_PERMISSIONS } from '@hv/domain';
import type { Permission, Role } from '@hv/domain';

export interface RoleCard {
  readonly role: Role;
  readonly reads: readonly Permission[];
  readonly acts: readonly Permission[];
  readonly unitBound: boolean;
}

const READS: ReadonlySet<Permission> = new Set<Permission>(Object.values(READ_PERMISSIONS).flat());

function build(): readonly RoleCard[] {
  return Object.freeze(
    (Object.keys(ROLE_PERMISSIONS) as Role[]).map((role): RoleCard => {
      const bundle = ROLE_PERMISSIONS[role];
      const held = new Set<Permission>(bundle);
      const ordered = PERMISSIONS.filter((permission) => held.has(permission));
      return Object.freeze({
        role,
        reads: Object.freeze(ordered.filter((permission) => READS.has(permission))),
        acts: Object.freeze(ordered.filter((permission) => !READS.has(permission))),
        unitBound: bundle.unitBoundRead === true,
      });
    }),
  );
}

const CARDS = build();

/** The cards of this build; the same frozen list on every call. */
export function roleCards(): readonly RoleCard[] {
  return CARDS;
}
