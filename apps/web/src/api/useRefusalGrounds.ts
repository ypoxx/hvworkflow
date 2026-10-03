/**
 * Scheibe 045 (decision 1): the catalogue of refusal grounds (Verweigerungsgründe), read once per actor.
 * Data belongs to the actor who read it (010d): a new actor — compared by `id`, never by role — reads
 * again, and until that answer is in, the view sees "loading", never the previous actor's list. No
 * reload on stream events (`READ_TOPICS.listRefusalGrounds` is empty: the catalogue is code data), and
 * no toast when the read fails: the views show the state where the catalogue would stand.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefusalGround } from '@hv/domain';
import { useActor } from './actor';

export type RefusalGroundsStatus = 'loading' | 'ready' | 'failed';

export interface RefusalGroundsState {
  readonly actorId: string;
  readonly status: RefusalGroundsStatus;
  readonly grounds: readonly RefusalGround[];
}

/** What a view gets: the catalogue of the current actor, or "loading". */
export interface RefusalGroundsView {
  readonly status: RefusalGroundsStatus;
  readonly grounds: readonly RefusalGround[];
}

const NONE: readonly RefusalGround[] = [];
const LOADING: RefusalGroundsView = { status: 'loading', grounds: NONE };

/**
 * One read per actor. `follow` with the same id does nothing (a StrictMode double effect included); a
 * new id starts a read whose answer lands only while that read is still the latest one. A generation
 * token, not the id, decides (Codex P2 on #139): after A → B → A the first read of A must not settle
 * over the second.
 */
export function createRefusalGroundsLoader(
  load: () => Promise<readonly RefusalGround[]>,
  onState: (state: RefusalGroundsState) => void,
): { follow: (actorId: string) => void } {
  let followed: string | undefined;
  let generation = 0;
  return {
    follow(actorId) {
      if (actorId === followed) return;
      followed = actorId;
      const mine = ++generation;
      onState({ actorId, status: 'loading', grounds: NONE });
      load().then(
        (grounds) => {
          if (generation === mine) onState({ actorId, status: 'ready', grounds });
        },
        () => {
          if (generation === mine) onState({ actorId, status: 'failed', grounds: NONE });
        },
      );
    },
  };
}

/** The state as the current actor may see it: another actor's state reads as "loading". */
export function groundsFor(state: RefusalGroundsState | null, actorId: string): RefusalGroundsView {
  if (state === null || state.actorId !== actorId) return LOADING;
  return { status: state.status, grounds: state.grounds };
}

/** `load` is `api.listRefusalGrounds` of the page (passed in, so this module needs no adapter). */
export function useRefusalGrounds(load: () => Promise<readonly RefusalGround[]>): RefusalGroundsView {
  const actorId = useActor().id;
  const [state, setState] = useState<RefusalGroundsState | null>(null);
  const loader = useRef<ReturnType<typeof createRefusalGroundsLoader> | null>(null);
  loader.current ??= createRefusalGroundsLoader(load, setState);
  useEffect(() => {
    loader.current?.follow(actorId);
  }, [actorId]);
  // One object per state and actor, so that a dependency on the view does not change on every render.
  return useMemo(() => groundsFor(state, actorId), [state, actorId]);
}
