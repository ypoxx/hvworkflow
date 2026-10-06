/**
 * Scheibe 041 (decision 3): role assignments (Rollenzuordnungen) for the eye and the one input form of "Rolle
 * zuordnen". The state is display only — the service checks expiry and revocation itself — and `now` is always passed
 * in. The role order comes from the role cards (the rights table as data); no role is named here.
 */
import type { Role, RoleAssignment, RoleAssignmentCreate } from '@hv/domain';
import { berlinLocalToIso } from './time';

export type AssignmentState = 'revoked' | 'expired' | 'active';

/** Revoked before expired before active; an expiry exactly at `now` has expired. */
export function assignmentState(assignment: Pick<RoleAssignment, 'revokedAt' | 'expiresAt'>, now: Date): AssignmentState {
  if (assignment.revokedAt !== undefined) return 'revoked';
  if (assignment.expiresAt !== undefined && Date.parse(assignment.expiresAt) <= now.getTime()) return 'expired';
  return 'active';
}

/** By subject id, then by the position of the role in the rights table; a new list. */
export function sortAssignments(list: readonly RoleAssignment[], roleOrder: readonly Role[]): RoleAssignment[] {
  const rank = (role: Role): number => {
    const index = roleOrder.indexOf(role);
    return index < 0 ? roleOrder.length : index;
  };
  return [...list].sort((a, b) =>
    a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : rank(a.role) - rank(b.role));
}

/** The rows of the table: sorted, and without revoked and expired ones unless the switch shows them. */
export function visibleAssignments(
  list: readonly RoleAssignment[],
  roleOrder: readonly Role[],
  now: Date,
  showInactive: boolean,
): RoleAssignment[] {
  const sorted = sortAssignments(list, roleOrder);
  return showInactive ? sorted : sorted.filter((assignment) => assignmentState(assignment, now) === 'active');
}

/** What the dialog holds; `role` is empty until one is chosen, `expires` is the `datetime-local` value. */
export interface AssignForm {
  subjectId: string;
  role: Role | '';
  unitId: string;
  expires: string;
}

export const EMPTY_ASSIGN_FORM: AssignForm = Object.freeze({ subjectId: '', role: '', unitId: '', expires: '' });

/** A typed expiry that is no instant in Berlin (e.g. the hour skipped in spring). An empty field is valid. */
export function expiresInvalid(form: AssignForm): boolean {
  return form.expires !== '' && berlinLocalToIso(form.expires) === undefined;
}

/**
 * Exactly the contract fields that are set: `{ subjectId, role }`, plus `unitId` and `expiresAt` when given. No
 * `personId`, no `deputyForSubjectId` (041b). `undefined` while subject or role is missing or the expiry is invalid;
 * the form of the subject id is the service's check (422).
 */
export function assignInput(form: AssignForm): RoleAssignmentCreate | undefined {
  const subjectId = form.subjectId.trim();
  if (subjectId === '' || !form.role || expiresInvalid(form)) return undefined;
  const expiresAt = form.expires === '' ? undefined : berlinLocalToIso(form.expires);
  return {
    subjectId,
    role: form.role,
    ...(form.unitId !== '' ? { unitId: form.unitId } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
  };
}

/** A blank reason sends none at all; otherwise the trimmed text (the service refuses an empty one). */
export function submitRevoke(
  api: { revokeRole: (id: string, reason?: string) => Promise<unknown> },
  id: string,
  reason: string,
): Promise<unknown> {
  const text = reason.trim();
  return text === '' ? api.revokeRole(id) : api.revokeRole(id, text);
}
