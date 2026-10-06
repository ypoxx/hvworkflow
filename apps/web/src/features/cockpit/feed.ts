/**
 * Scheibe 061 (part B, spec decision 7): how the control desk keeps its figures fresh. `getCockpit` is not buffered
 * (its value ages without an event), so the page reads it again on every change of the log or the actor and every 15 s
 * — an impulse, never a time source; the ages come from the service. The interval pauses while the document is hidden
 * and reads once when it shows again. One read at a time: an impulse during a read schedules exactly one more.
 *
 * Pure apart from the injected timers and visibility, so W9 drives it over the real live store without a browser.
 */
import type { Unit } from '@hv/domain';
import type { Cockpit } from '../../api/cockpit';
import type { Translate } from '../../i18n';
import { isReadForbidden } from '../answers/lib';
import { announcementFor } from './lib';
import type { CockpitRead } from './lib';

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

/** What the page shows for one actor: the reading, the text of the live region, and the reading before (for the change). */
export interface ReadingState {
  read: CockpitRead;
  announcement: string;
  previous: Cockpit | null;
}

export const INITIAL_READING: ReadingState = { read: { status: 'loading' }, announcement: '', previous: null };

/**
 * One result of the feed applied to what the page shows. The live region carries text only for the reading in which a
 * figure turned critical and is empty otherwise, so the same text after a calm phase is announced again (review R3). A
 * passing failure keeps the last figures ("Stand" says how old they are); a refusal always replaces them.
 */
export function applyResult(state: ReadingState, result: CockpitResult, t: Translate, units: readonly Unit[]): ReadingState {
  if (result.status === 'ready') {
    return {
      read: { status: 'ready', cockpit: result.cockpit },
      announcement: announcementFor(t, state.previous, result.cockpit, units) ?? '',
      previous: result.cockpit,
    };
  }
  if (result.status === 'error' && state.read.status === 'ready') return state;
  return { read: result, announcement: '', previous: null };
}

export function startCockpitFeed(options: CockpitFeedOptions): CockpitFeed {
  let stopped = false;
  let refused = false;
  let running = false;
  let again = false;
  let handle: number | undefined;

  const run = (): void => {
    // After a refusal nothing reads again until the next feed (another actor): no polling of a refused person (R4).
    if (stopped || refused) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    options
      .read()
      .then(
        (cockpit) => { if (!stopped) options.onResult({ status: 'ready', cockpit }); },
        (error: unknown) => {
          if (stopped) return;
          const result = resultOf(error);
          if (result.status === 'forbidden') {
            refused = true;
            again = false;
            if (handle !== undefined) options.timers.clearInterval(handle);
            handle = undefined;
          }
          options.onResult(result);
        },
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
  handle = options.timers.setInterval(tick, options.intervalMs ?? COCKPIT_INTERVAL_MS);
  const unsubscribeChanges = options.subscribe?.(run);
  const unsubscribeVisibility = options.visibility.subscribe(tick);
  run();

  return {
    refresh: run,
    stop: () => {
      stopped = true;
      if (handle !== undefined) options.timers.clearInterval(handle);
      unsubscribeChanges?.();
      unsubscribeVisibility();
    },
  };
}
