/**
 * Scheibe 041 (decision 2, D9): whether the page opens at all. It reads the role assignments first; a 403 is the
 * locked state and nothing else is read. Any other failure is a read error of the roles tab, not the locked state.
 * The service decides (`can()`); the interface never derives the answer from a role.
 */
import type { HvApi, RoleAssignment } from '@hv/domain';

export type Access =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'failed'; error: unknown }
  | { status: 'ready'; assignments: readonly RoleAssignment[] };

const isForbidden = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'status' in error && (error as { status: unknown }).status === 403;

export async function readAccess(api: Pick<HvApi, 'listRoleAssignments'>): Promise<Access> {
  try {
    return { status: 'ready', assignments: await api.listRoleAssignments() };
  } catch (error) {
    return isForbidden(error) ? { status: 'forbidden' } : { status: 'failed', error };
  }
}
