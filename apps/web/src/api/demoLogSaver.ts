/**
 * takt-053: a delayed writer for the demo event log. A burst of events (seed, atomisation) is written once, after the
 * delay; `flush` writes a pending value at once (the page is being left, so the delay would lose it), and `cancel` drops
 * it (a demo reset must not write the old log back after deleting it).
 */
export interface DebouncedSaver<T> {
  save(value: T): void;
  flush(): void;
  cancel(): void;
  /** Cancels and ignores every later save and flush: after a demo reset nothing may write the old log back. */
  stop(): void;
}

export function createDebouncedSaver<T>(write: (value: T) => void, delayMs: number): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | undefined;
  let stopped = false;
  const clear = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const flush = (): void => {
    clear();
    if (stopped || pending === undefined) return;
    const { value } = pending;
    // Cleared before writing: a write that throws loses this value (the demo writer catches everything).
    pending = undefined;
    write(value);
  };
  return {
    save(value) {
      if (stopped) return;
      pending = { value };
      clear();
      timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      clear();
      pending = undefined;
    },
    stop() {
      stopped = true;
      clear();
      pending = undefined;
    },
  };
}
