/**
 * Session check per batch and per heartbeat (slice 035b, decision 4). Every check is fresh: a result is
 * never kept for a later batch or heartbeat, and there is no time-based memo. Within one occasion (a
 * batch, named by its seq) the streams of one session share one check: concurrent calls for the same
 * occasion and session join the promise that already runs; it is forgotten once it settles.
 *
 * All checks go through one queue with at most `concurrency` running at once, so session checks never
 * take more than that many pool connections (the default is 2). This module never sees a session token:
 * the route passes a key (a hash) and a function that reads the session from its own closure.
 */
export interface SessionChecker {
  /**
   * `true` when the session is valid now. Rejects when the check itself fails (fail closed at the caller).
   * `alive` tells whether the caller still waits for the answer: when every caller of a check has gone by the
   * time it gets a slot, the session is not read at all (review minor 6).
   */
  check(occasion: string, sessionKey: string, read: () => Promise<boolean>, alive?: () => boolean): Promise<boolean>;
}

/** A check dropped because no caller waited any more; never an answer about the session. */
const GONE = Symbol('gone');

export function createSessionChecker(options: { concurrency: number; onWindow?: (phase: 'start' | 'end', occasion: string) => void }): SessionChecker {
  const running = new Map<string, { run: Promise<boolean | typeof GONE>; callers: (() => boolean)[] }>();
  const waiting: (() => void)[] = [];
  let active = 0;

  const acquire = async (): Promise<void> => {
    if (active < options.concurrency) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  const releaseSlot = (): void => {
    const next = waiting.shift();
    if (next) next(); // the slot passes on directly; `active` stays
    else active -= 1;
  };
  const window = (phase: 'start' | 'end', occasion: string): void => {
    try { options.onWindow?.(phase, occasion); } catch { /* a test hook never breaks a check */ }
  };

  return {
    check(occasion, sessionKey, read, alive = () => true) {
      const key = `${occasion}\u0000${sessionKey}`;
      const joined = running.get(key);
      const answer = (result: Promise<boolean | typeof GONE>): Promise<boolean> => result.then((value) => {
        if (value !== GONE) return value;
        // The check was dropped because nobody waited when it got its slot. A caller that still waits (it
        // joined in that window) checks anew instead of reading "invalid" (re-check nit).
        return alive() ? this.check(occasion, sessionKey, read, alive) : false;
      });
      if (joined) {
        joined.callers.push(alive);
        return answer(joined.run);
      }
      const callers = [alive];
      const run = (async (): Promise<boolean | typeof GONE> => {
        await acquire();
        try {
          // Nobody waits any more (every stream of this check closed while queued): no pool connection taken.
          if (!callers.some((caller) => caller())) {
            if (running.get(key)?.callers === callers) running.delete(key);
            return GONE;
          }
          window('start', occasion);
          try {
            return await read();
          } finally {
            window('end', occasion);
          }
        } finally {
          releaseSlot();
        }
      })();
      running.set(key, { run, callers });
      // Forget the result as soon as it is known: the next batch or heartbeat checks anew.
      const forget = (): void => { if (running.get(key)?.run === run) running.delete(key); };
      run.then(forget, forget);
      return answer(run);
    },
  };
}
