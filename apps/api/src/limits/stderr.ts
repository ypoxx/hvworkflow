/**
 * The fixed stderr lines of slice 034a (decision 11): text without a value, a source or a subject, at
 * most one per minute each (minute of the injected clock). `suppressed` counts the refusals that the
 * access log does not write one by one and reports the sum of a finished minute once.
 */

export interface Notices {
  /** Writes `text` unless the same text was written in this minute. */
  once(text: string): void;
  /** One refusal of a kind that is not logged individually. */
  suppressed(label: string): void;
  /** Writes the sums of finished minutes; called at the start of every request. */
  tick(): void;
}

export function createNotices(clock: () => Date): Notices {
  const minuteOf = (): number => Math.floor(clock().getTime() / 60_000);
  const lastWritten = new Map<string, number>();
  const sums = new Map<string, { minute: number; count: number }>();

  const flush = (label: string, minute: number): void => {
    const entry = sums.get(label);
    if (entry === undefined || entry.count === 0 || entry.minute >= minute) return;
    sums.delete(label);
    console.error(`HV-Tool API: ${label} rate limit reached; ${entry.count} repeated rejections not logged individually.`);
  };

  const tick = (): void => {
    const minute = minuteOf();
    for (const label of sums.keys()) flush(label, minute);
  };

  return {
    once(text) {
      const minute = minuteOf();
      if (lastWritten.get(text) === minute) return;
      lastWritten.set(text, minute);
      console.error(text);
    },
    suppressed(label) {
      const minute = minuteOf();
      flush(label, minute);
      const entry = sums.get(label);
      if (entry === undefined) {
        sums.set(label, { minute, count: 1 });
        // The sum of a quiet last minute is written by the next request or, at the latest, by this timer.
        setTimeout(tick, 61_000).unref();
      } else {
        entry.count += 1;
      }
    },
    tick,
  };
}
