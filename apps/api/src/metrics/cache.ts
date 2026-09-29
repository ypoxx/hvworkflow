/**
 * Short result cache with one computation in flight (slice 033b, T-G2-D-03): however often the
 * endpoint is polled, the event log is scanned at most once per window. Time comes from the injected
 * clock (AGENTS.md rule 8). A failed computation is not cached; the next call tries again.
 */
export function createSingleFlightCache<T>(ttlMs: number, clock: () => Date): (compute: () => Promise<T>) => Promise<T> {
  let value: { at: number; result: T } | undefined;
  let inFlight: Promise<T> | undefined;
  return async (compute) => {
    const now = clock().getTime();
    if (value !== undefined && now - value.at >= 0 && now - value.at < ttlMs) return value.result;
    if (inFlight !== undefined) return inFlight;
    inFlight = compute().then((result) => {
      value = { at: now, result };
      return result;
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  };
}
