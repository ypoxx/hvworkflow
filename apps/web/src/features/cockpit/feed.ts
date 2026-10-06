/**
 * Scheibe 061 (part B, spec decision 7): how the control desk keeps its figures fresh. `getCockpit` is not buffered
 * (its value ages without an event), so the page reads it again on every change of the log or the actor and every 15 s
 * — an impulse, never a time source; the ages come from the service. The interval pauses while the document is hidden
 * and reads once when it shows again. One read at a time: an impulse during a read schedules exactly one more.
 *
 * Pure apart from the injected timers and visibility, so W9 drives it over the real live store without a browser.
 */
import type { Cockpit } from '../../api/cockpit';
import { isReadForbidden } from '../answers/lib';

export const COCKPIT_INTERVAL_MS = 15_000;

export type CockpitResult =
  | { status: 'ready'; cockpit: Cockpit }
  | { status: 'forbidden' }
  | { status: 'error'; ruleId?: string };

export interface CockpitFeedOptions {
  read: () => Promise<Cockpit>;
  onResult: (result: CockpitResult) => void;
  /** Changes of the log (in-process) or the stream; the page passes none and calls `refresh` on `useApiVersion`. */
  subscribe?: (listener: () => void) => () => void;
  timers: {
    setInterval: (fn: () => void, ms: number) => number;
    clearInterval: (handle: number) => void;
  };
  visibility: {
    hidden: () => boolean;
    subscribe: (listener: () => void) => () => void;
  };
  intervalMs?: number;
}

export interface CockpitFeed {
  refresh: () => void;
  stop: () => void;
}

function ruleIdOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('ruleId' in error)) return undefined;
  const ruleId = (error as { ruleId: unknown }).ruleId;
  return typeof ruleId === 'string' ? ruleId : undefined;
}

/** A failed read as the page shows it: a refusal is a read state (R-PERM-02/-03), anything else an error with its rule. */
export function resultOf(error: unknown): CockpitResult {
  if (isReadForbidden(error)) return { status: 'forbidden' };
  const ruleId = ruleIdOf(error);
  return ruleId === undefined ? { status: 'error' } : { status: 'error', ruleId };
}

export function startCockpitFeed(options: CockpitFeedOptions): CockpitFeed {
  let stopped = false;
  let running = false;
  let again = false;

  const run = (): void => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    options
      .read()
      .then(
        (cockpit) => { if (!stopped) options.onResult({ status: 'ready', cockpit }); },
        (error: unknown) => { if (!stopped) options.onResult(resultOf(error)); },
      )
      .finally(() => {
        running = false;
        if (again) {
          again = false;
          run();
        }
      });
  };

  const tick = (): void => {
    if (!options.visibility.hidden()) run();
  };
  const handle = options.timers.setInterval(tick, options.intervalMs ?? COCKPIT_INTERVAL_MS);
  const unsubscribeChanges = options.subscribe?.(run);
  const unsubscribeVisibility = options.visibility.subscribe(tick);
  run();

  return {
    refresh: run,
    stop: () => {
      stopped = true;
      options.timers.clearInterval(handle);
      unsubscribeChanges?.();
      unsubscribeVisibility();
    },
  };
}
