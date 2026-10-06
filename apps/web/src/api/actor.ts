/**
 * The calling actor of the demo. In production this comes from the identity provider (OIDC claims
 * mapped to a role bundle); in the demo the role switcher in the header sets it. This is the only
 * interface file that may mention role names (AGENTS.md rule 4) — everything else reads `_actions`.
 */
import { useSyncExternalStore } from 'react';
import type { Actor, Role, RoleAssignmentCreate } from '@hv/domain';
import { DEMO_MODE } from './mode';

const STORAGE_KEY = 'hv-demo-actor-v1';

/** The demo personas, one per role bundle. Display names follow the house vocabulary. */
export const DEMO_ACTORS: readonly Actor[] = [
  { id: 'u-mod-1', role: 'moderation', displayName: 'Versammlungsbüro' },
  { id: 'u-cap-1', role: 'capture', displayName: 'Erfassung 1' },
  { id: 'u-coord-1', role: 'coordination', displayName: 'Koordination' },
  { id: 'u-exp-fin', role: 'expert', displayName: 'Fachbereich Finanzen' },
  { id: 'u-legal-1', role: 'legal', displayName: 'Legal Clearing' },
  { id: 'u-appr-1', role: 'approver', displayName: 'Freigabe Vorstandsbüro' },
  { id: 'u-podium', role: 'podium', displayName: 'Podium' },
  { id: 'u-admin', role: 'admin', displayName: 'Administration' },
  { id: 'u-obs', role: 'observer', displayName: 'Beobachtung' },
];

/**
 * Scheibe 054 (decision 2a, Codex P1 on #147): the role assignments the demo writes at start-up, so that "Meine Fragen"
 * is the person's own unit in the demo too. The core binds an actor only through an active assignment in the event log
 * (`resolveMeetingActor`); `DEMO_ACTORS` stays as it is, because an actor with its own `unitId` but no assignment would
 * be refused (403 R-PERM-01). It narrows only: the expert persona then reads and writes Finanzen alone (R-PERM-03),
 * the same way the harness binds the expert test person in the `http` project. Demo mode only.
 */
export const DEMO_BINDINGS: readonly RoleAssignmentCreate[] = [
  { subjectId: 'u-exp-fin', role: 'expert', unitId: 'unit-fin' },
];

function load(): Actor {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { role?: Role };
      const found = DEMO_ACTORS.find((a) => a.role === parsed.role);
      if (found) return found;
    }
  } catch {
    /* storage unavailable: fall through to the default */
  }
  return DEMO_ACTORS[1]!; // the capture desk is the natural starting point of the demo
}

let current: Actor | undefined = DEMO_MODE ? load() : undefined;
const listeners = new Set<() => void>();

export function getActor(): Actor {
  if (!current) throw new Error('No confirmed session actor.');
  return current;
}
/**
 * takt-057: never swap the actor and restore it synchronously around a live store call (`setActor(x)`, call,
 * `setActor(before)` in one task). The live store treats such a swap as no change of person and attributes the write
 * and its answer to the restored person; only the e2e harness may rely on that.
 */
export function setActor(actor: Actor): void {
  if (!DEMO_MODE) throw new Error('Demo persona switching is unavailable in HTTP mode.');
  current = actor;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: actor.role }));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}
/** Session actors come only from /auth/me and are never persisted. */
export function setSessionActor(actor: Actor | undefined): void {
  if (DEMO_MODE) return;
  current = actor;
  for (const listener of listeners) listener();
}
export function useActor(): Actor {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getActor,
    getActor,
  );
}
