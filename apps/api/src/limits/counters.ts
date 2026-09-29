/**
 * Fixed-window counters over the injected clock (slice 034a, decision 12). Pure: no I/O, no wall clock.
 * A window is `floor(ms / 60 000)`; when it changes, every key is dropped. A counter holds at most
 * `maxKeys` keys per window; a further new key counts on one shared overflow key with the same limit
 * (a flood of rotating sources slows new sources down together, known ones keep their own count).
 */
import { MAX_COUNTER_KEYS, WINDOW_MS } from './config.ts';

export interface HitResult {
  /** False once the count of the key in this window exceeds the limit. */
  allowed: boolean;
  /** True for the first refusal of this key in this window (the protocol exception keys on it). */
  firstRejection: boolean;
  /** Whole seconds to the end of the window, 1 to 60. */
  retryAfterSeconds: number;
  /** The key was counted on the shared overflow key. */
  overflow: boolean;
}

export interface WindowCounter {
  hit(key: string): HitResult;
  /** Number of keys held now (including the overflow key once used). */
  size(): number;
}

export interface WindowCounterOptions {
  limit: number;
  clock: () => Date;
  maxKeys?: number;
  /** Called once per window, when the first key had to go to the overflow key. */
  onTableFull?: () => void;
}

const OVERFLOW_KEY = '\0overflow';

export function createWindowCounter(options: WindowCounterOptions): WindowCounter {
  const { limit, clock } = options;
  const maxKeys = options.maxKeys ?? MAX_COUNTER_KEYS;
  let window = -1;
  let counts = new Map<string, { count: number; rejected: boolean }>();
  let announcedFull = false;

  return {
    hit(key) {
      const ms = clock().getTime();
      const current = Math.floor(ms / WINDOW_MS);
      if (current !== window) {
        window = current;
        counts = new Map();
        announcedFull = false;
      }
      const retryAfterSeconds = Math.min(60, Math.max(1, Math.ceil(((current + 1) * WINDOW_MS - ms) / 1_000)));
      let slot = counts.get(key);
      let overflow = false;
      if (slot === undefined) {
        if (counts.size >= maxKeys) {
          overflow = true;
          if (!announcedFull) {
            announcedFull = true;
            options.onTableFull?.();
          }
          slot = counts.get(OVERFLOW_KEY);
          if (slot === undefined) {
            slot = { count: 0, rejected: false };
            counts.set(OVERFLOW_KEY, slot);
          }
        } else {
          slot = { count: 0, rejected: false };
          counts.set(key, slot);
        }
      }
      slot.count += 1;
      if (slot.count <= limit) return { allowed: true, firstRejection: false, retryAfterSeconds, overflow };
      const firstRejection = !slot.rejected;
      slot.rejected = true;
      return { allowed: false, firstRejection, retryAfterSeconds, overflow };
    },
    size: () => counts.size,
  };
}
