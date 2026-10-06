/**
 * Scheibe 041 (090): an open dialog belongs to the actor who opened it. A change of actor — compared by `id`, never by
 * role (AGENTS.md R4) — drops it in the same render; the tab and its lists stay.
 */
import { useCallback, useState } from 'react';

export interface ActorScoped<D> {
  actorId: string;
  dialog: D | null;
}

/** The same state for the same actor; for another one, the dialog is gone. */
export function followActor<D>(state: ActorScoped<D>, actorId: string): ActorScoped<D> {
  return state.actorId === actorId ? state : { actorId, dialog: null };
}

/** The dialog of a tab, scoped to the acting person. */
export function useActorDialog<D>(actorId: string): [D | null, (dialog: D | null) => void] {
  const [state, setState] = useState<ActorScoped<D>>({ actorId, dialog: null });
  const current = followActor(state, actorId);
  if (current !== state) setState(current);
  // Stable per actor: the kit's Dialog re-runs its focus effect whenever `onClose` changes identity.
  const set = useCallback((dialog: D | null) => setState({ actorId, dialog }), [actorId]);
  return [current.dialog, set];
}
