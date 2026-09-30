/**
 * A counter that increments on every new event and on every real actor change. Views use it as a
 * dependency to refetch through the API, which keeps them independent of how the data arrives
 * (in-process now, SSE later) and of who is looking (`_actions` differ per actor).
 *
 * It does not count on mount (a second load per view would only be discarded by the client, but the
 * service would answer it) and not when a session refresh hands over an equal actor object (takt-033b).
 */
import { useEffect, useRef, useState } from 'react';
import type { Actor } from '@hv/domain';
import { subscribeToChanges } from './index';
import { useActor } from './actor';

/** Structural comparison of two actors, every field counts; two values are compared, never a role literal. */
export function actorChanged(previous: Actor, next: Actor): boolean {
  if (previous === next) return false;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]) as Set<keyof Actor>;
  for (const key of keys) if (previous[key] !== next[key]) return true;
  return false;
}

export function useApiVersion(): number {
  const [version, setVersion] = useState(0);
  const actor = useActor();
  // Last actor seen by the effect below. Compared and set inside the effect, so the count still happens after the
  // commit (010c/010d rely on that gap) and a StrictMode double run is idempotent: the second run sees an equal actor.
  const seen = useRef(actor);
  useEffect(() => subscribeToChanges(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    if (!actorChanged(seen.current, actor)) return;
    seen.current = actor;
    setVersion((v) => v + 1);
  }, [actor]);
  return version;
}
