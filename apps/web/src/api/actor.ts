/**
 * The calling actor of the demo. In production this comes from the identity provider (OIDC claims
 * mapped to a role bundle); in the demo the role switcher in the header sets it. This is the only
 * interface file that may mention role names (AGENTS.md rule 4) — everything else reads `_actions`.
 */
import { useSyncExternalStore } from 'react';
import type { Actor, Role } from '@hv/domain';

const STORAGE_KEY = 'hv-demo-actor-v1';

/** The demo personas, one per role bundle. Display names follow the house vocabulary. */
export const DEMO_ACTORS: readonly Actor[] = [
  { id: 'u-mod-1', role: 'moderation', displayName: 'Versammlungsbüro' },
  { id: 'u-cap-1', role: 'capture', displayName: 'Erfassung 1' },
  { id: 'u-exp-fin', role: 'expert', displayName: 'Fachbereich Finanzen' },
  { id: 'u-legal-1', role: 'legal', displayName: 'Legal Clearing' },
  { id: 'u-appr-1', role: 'approver', displayName: 'Freigabe Vorstandsbüro' },
  { id: 'u-podium', role: 'podium', displayName: 'Podium' },
  { id: 'u-admin', role: 'admin', displayName: 'Administration' },
  { id: 'u-obs', role: 'observer', displayName: 'Beobachtung' },
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

let current: Actor = load();
const listeners = new Set<() => void>();

export function getActor(): Actor {
  return current;
}
export function setActor(actor: Actor): void {
  current = actor;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: actor.role }));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
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
