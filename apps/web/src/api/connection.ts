/**
 * Slice 036b: the connection state of the stream (Verbindungszustand), as a small pure state machine plus a store for the
 * shell's indicator (`app/ConnectionStatus.tsx`). The HTTP adapter (`http.ts`) reports what happens to its stream; the
 * machine decides the phase. No role, no content of the stream is held here, only the phase and the time of the data.
 *
 * Phases: `idle` (no stream: demo, signed out, session to be confirmed), `connecting` (first attempt), `live`,
 * `reconnecting` (stream lost, a new attempt follows with backoff, the 30 s poll runs), `polling` (the service refused
 * the stream or streams keep dying: the 30 s poll only, for a while) and `offline` (`navigator.onLine === false` or three
 * network errors in a row).
 */
import { useSyncExternalStore } from 'react';

export type ConnectionPhase = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'polling' | 'offline';

export type ConnectionSignal =
  /** An attempt to open the stream starts. */
  | { type: 'start' }
  /** The service answered 200 with a stream. */
  | { type: 'opened' }
  /** The stream is gone (end, watchdog, broken body); a new attempt follows with backoff. */
  | { type: 'lost' }
  /** The service refused or keeps killing the stream (429, 503, `end {unavailable}`, short-lived streams). */
  | { type: 'fallback' }
  /** The request itself failed (no answer). */
  | { type: 'networkError' }
  /** The browser reports offline / online. */
  | { type: 'offline' }
  | { type: 'online' }
  /** Data is current as of now (a message or heartbeat, a poll impulse). */
  | { type: 'synced' }
  /** No stream any more (sign-out, session end, closed on purpose). */
  | { type: 'stop' };

export interface ConnectionState {
  readonly phase: ConnectionPhase;
  /** Milliseconds since the epoch of the last known current data, for "Stand von HH:MM:SS". */
  readonly asOf: number | undefined;
  readonly networkErrors: number;
  readonly browserOffline: boolean;
}

export const INITIAL_CONNECTION: ConnectionState = { phase: 'idle', asOf: undefined, networkErrors: 0, browserOffline: false };

/** Three failed requests in a row count as offline (spec decision 6). */
const OFFLINE_AFTER = 3;

export function nextConnectionState(state: ConnectionState, signal: ConnectionSignal, now: number): ConnectionState {
  const troubled = (phase: ConnectionPhase): ConnectionState =>
    ({ ...state, phase: state.browserOffline ? 'offline' : phase });
  switch (signal.type) {
    case 'offline':
      return { ...state, browserOffline: true, phase: state.phase === 'idle' ? 'idle' : 'offline' };
    case 'online':
      return { ...state, browserOffline: false, networkErrors: 0, phase: state.phase === 'offline' ? 'reconnecting' : state.phase };
    case 'stop':
      return { ...INITIAL_CONNECTION, browserOffline: state.browserOffline };
    case 'start':
      return state.phase === 'idle' ? troubled('connecting') : state;
    default:
      break;
  }
  if (state.phase === 'idle') return state;
  switch (signal.type) {
    case 'opened':
      return { ...state, phase: 'live', networkErrors: 0, asOf: now };
    case 'synced':
      return { ...state, asOf: now };
    case 'lost':
      return troubled('reconnecting');
    case 'fallback':
      return troubled('polling');
    case 'networkError': {
      const networkErrors = state.networkErrors + 1;
      return { ...troubled(networkErrors >= OFFLINE_AFTER ? 'offline' : 'reconnecting'), networkErrors };
    }
  }
}

export interface ConnectionStore {
  get(): ConnectionState;
  dispatch(signal: ConnectionSignal): void;
  subscribe(listener: () => void): () => void;
}

export function createConnectionStore(now: () => number): ConnectionStore {
  let state = INITIAL_CONNECTION;
  const listeners = new Set<() => void>();
  const same = (a: ConnectionState, b: ConnectionState): boolean =>
    a.phase === b.phase && a.asOf === b.asOf && a.networkErrors === b.networkErrors && a.browserOffline === b.browserOffline;
  return {
    get: () => state,
    dispatch(signal) {
      const next = nextConnectionState(state, signal, now());
      if (same(state, next)) return;
      state = next;
      for (const listener of [...listeners]) {
        try { listener(); } catch { /* one subscriber must not starve the others */ }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/**
 * The tab's one connection state. The wall clock of the browser stamps the time of the data; it is only shown, never
 * compared (the same kind of source the shell injects into the live store, 036a decision 7).
 */
export const connection: ConnectionStore = createConnectionStore(() => new Date().getTime());

export function useConnectionState(store: ConnectionStore = connection): ConnectionState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
