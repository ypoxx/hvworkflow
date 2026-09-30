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
  /** `true` when the session is valid now. Rejects when the check itself fails (fail closed at the caller). */
  check(occasion: string, sessionKey: string, read: () => Promise<boolean>): Promise<boolean>;
}

export function createSessionChecker(options: { concurrency: number; onWindow?: (phase: 'start' | 'end') => void }): SessionChecker {
  const running = new Map<string, Promise<boolean>>();
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
  const window = (phase: 'start' | 'end'): void => {
    try { options.onWindow?.(phase); } catch { /* a test hook never breaks a check */ }
  };

  return {
    check(occasion, sessionKey, read) {
      const key = `${occasion}\u0000${sessionKey}`;
      const joined = running.get(key);
      if (joined) return joined;
      const run = (async () => {
        await acquire();
        window('start');
        try {
          return await read();
        } finally {
          window('end');
          releaseSlot();
        }
      })();
      running.set(key, run);
      // Forget the result as soon as it is known: the next batch or heartbeat checks anew.
      const forget = (): void => { if (running.get(key) === run) running.delete(key); };
      run.then(forget, forget);
      return run;
    },
  };
}
