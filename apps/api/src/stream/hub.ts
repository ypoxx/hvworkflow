/**
 * The stream distributor (Verteiler) of one app (slice 035b, decisions 2 and 3). It keeps one projection
 * per meeting (Jahrgang) from a verified log, reloads on a nudge, and hands every applied batch to the
 * registered connections in one synchronous step: "apply the batch" and "give it to every connection"
 * have no `await` between them, so a connection registered before a batch sees it, and one registered
 * after it reads a head that already includes it (the handover of decision 5).
 *
 * Continuity (B1): the distributor checks on its own, on every reload, that the verified log still holds
 * its last applied event unchanged (`lastSeq`, `lastHash`). A shorter log or another hash there resets
 * every stream, whatever the shared chain cache reported to earlier callers. Only events of a verified
 * log are ever handed on; an event without hash ends every stream with `unavailable` (m6).
 *
 * A reload runs on its own short read transaction (the source decides; with Postgres the same structure
 * as the sign-in lookup), never on a request's transaction, and no connection is held between reloads.
 * At most one reload runs at a time and batches follow each other at the earliest after the spacing.
 * Triggers only schedule (m8): the store listener and the COMMIT nudge do no work themselves.
 */
import { AsyncResource } from 'node:async_hooks';
import { emptyState, reduce, snapshotBefore, type DomainEvent, type State, type StreamStates } from '@hv/domain';
import { PostgresIntegrityError } from '../persistence/postgres.ts';

export interface HubSource {
  /** A verified log (with Postgres: sealed by the chain check of its own read transaction). */
  load(): Promise<readonly DomainEvent[]>;
  /** In-memory and JSONL: the store's listener. Called only while the distributor runs. */
  subscribe?(trigger: () => void): () => void;
  /** Postgres: reload on a tick while streams are open (writes of other instances). */
  tick: boolean;
}

export type HubTerminal = { readonly kind: 'reset'; readonly lastSeq: number } | { readonly kind: 'unavailable' };

export interface HubConnection {
  /** Called synchronously for every applied batch, with the projections before (partial) and after. */
  onBatch(batch: readonly DomainEvent[], before: StreamStates, after: StreamStates, head: number): void;
  /** The distributor resets or ends every stream; the connection sends the message and closes. */
  onTerminal(terminal: HubTerminal): void;
}

/** What a connection reads in the same synchronous step as its registration. */
export interface HubSnapshot {
  readonly head: number;
  readonly log: readonly DomainEvent[];
  readonly states: StreamStates;
}

export interface Hub {
  /**
   * Reload first when the projection was never loaded, went stale while idle, or is older than the freshness bound;
   * with `force` in any case (a cursor beyond the head may be a write this instance has not seen yet).
   */
  ensureFresh(force?: boolean): Promise<void>;
  /** Registers a connection and returns head, log and projections of this very moment (no `await` in between). */
  register(connection: HubConnection): HubSnapshot;
  unregister(connection: HubConnection): void;
  /** The current projections (for the rights check of a heartbeat). */
  states(): StreamStates;
  head(): number;
  /** Nudge without payload (after a COMMIT with new events): schedules a reload while streams are open. */
  poke(): void;
}

export interface HubOptions {
  source: HubSource;
  clock: () => Date;
  reloadTickMs: number;
  spacingMs: number;
  freshnessMs: number;
  /** A fixed stderr line, at most once a minute (`createNotices`). */
  notice: (text: string) => void;
  /** Tests only. */
  onWindow?: (phase: 'start' | 'end') => void;
  onApplied?: (head: number) => void;
  reloadGate?: () => Promise<void>;
}

const UNAVAILABLE_LINE = 'HV-Tool API: stream ended (unavailable).';
const RELOAD_FAILED_LINE = 'HV-Tool API: stream reload failed.';

export function createHub(options: HubOptions): Hub {
  // Timers and listeners run in the async context of the app, not of the request that happened to start
  // them (the request's log context, actor and transaction must not leak into the distributor).
  const scope = new AsyncResource('hv-stream-hub');
  const inScope = <T>(run: () => T): T => scope.runInAsyncScope(run);
  const connections = new Set<HubConnection>();
  let states = new Map<string, State>();
  let log: readonly DomainEvent[] = [];
  let lastSeq = 0;
  let lastHash = '';
  let loaded = false;
  let stale = true;
  let lastReloadAt = 0;
  let inflight: Promise<void> | undefined;
  let cooling = false;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const hook = (run: () => void): void => { try { run(); } catch { /* a test hook never breaks the distributor */ } };
  const running = (): boolean => connections.size > 0;

  const discard = (): void => {
    states = new Map();
    log = [];
    lastSeq = 0;
    lastHash = '';
    loaded = false;
    stale = true;
  };
  const broadcast = (terminal: HubTerminal): void => {
    for (const connection of Array.from(connections)) {
      connections.delete(connection);
      try { connection.onTerminal(terminal); } catch { /* one connection never stops the others */ }
    }
    if (terminal.kind === 'unavailable') options.notice(UNAVAILABLE_LINE);
    stopIfIdle();
  };
  const rebuild = (next: readonly DomainEvent[]): void => {
    const fresh = new Map<string, State>();
    for (const e of next) {
      if (!e.hash) throw new MissingHashError();
      applyOne(fresh, e);
    }
    states = fresh;
    log = next;
    lastSeq = next.length;
    lastHash = next.at(-1)?.hash ?? '';
    loaded = true;
  };

  /** One reload result, applied and handed on in one synchronous step. */
  const apply = (next: readonly DomainEvent[]): void => {
    if (!loaded) {
      rebuild(next);
      hook(() => options.onApplied?.(lastSeq));
      return;
    }
    // B1: the distributor's own proof that the verified log continues what it applied.
    if (next.length < lastSeq || (lastSeq > 0 && next[lastSeq - 1]?.hash !== lastHash)) {
      rebuild(next);
      broadcast({ kind: 'reset', lastSeq });
      hook(() => options.onApplied?.(lastSeq));
      return;
    }
    const batch = next.slice(lastSeq);
    if (batch.length === 0) return;
    if (batch.some((e) => !e.hash)) throw new MissingHashError();
    const before = snapshotBefore(states, batch);
    for (const e of batch) applyOne(states, e);
    log = next;
    lastSeq = next.length;
    lastHash = next.at(-1)!.hash!;
    for (const connection of Array.from(connections)) {
      try {
        connection.onBatch(batch, before, states, lastSeq);
      } catch {
        connections.delete(connection);
        try { connection.onTerminal({ kind: 'unavailable' }); } catch { /* already closing */ }
        options.notice(UNAVAILABLE_LINE);
      }
    }
    stopIfIdle();
    hook(() => options.onApplied?.(lastSeq));
  };

  const reload = (): Promise<void> => {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        if (options.reloadGate) await options.reloadGate();
        let next: readonly DomainEvent[];
        hook(() => options.onWindow?.('start'));
        try {
          next = await options.source.load();
        } finally {
          hook(() => options.onWindow?.('end'));
        }
        // Before applying: a reset or an end in `apply` that leaves the distributor idle marks it stale again.
        stale = false;
        try {
          apply(next);
        } catch (error) {
          // An event without hash or a projection that cannot be reduced: nothing more is delivered from this log.
          discard();
          broadcast({ kind: 'unavailable' });
          throw error;
        }
        lastReloadAt = options.clock().getTime();
      } catch (error) {
        if (error instanceof PostgresIntegrityError) {
          discard();
          broadcast({ kind: 'unavailable' });
        } else if (!(error instanceof MissingHashError)) {
          // Database away: retried on the tick; open streams keep their heartbeats but get no delivery.
          options.notice(RELOAD_FAILED_LINE);
        }
        throw error;
      } finally {
        inflight = undefined;
        cooling = true;
        inScope(() => setTimeout(() => {
          cooling = false;
          if (again) {
            again = false;
            schedule();
          }
        }, options.spacingMs));
      }
    })();
    return inflight;
  };

  function schedule(): void {
    if (!running()) return;
    if (inflight || cooling) {
      again = true;
      return;
    }
    if (timer !== undefined) return;
    timer = inScope(() => setTimeout(() => {
      timer = undefined;
      reload().catch(() => undefined);
    }, 0));
  }

  const start = (): void => {
    if (options.source.tick && ticker === undefined) ticker = inScope(() => setInterval(schedule, options.reloadTickMs));
    if (options.source.subscribe && unsubscribe === undefined) {
      unsubscribe = options.source.subscribe(() => inScope(schedule));
    }
  };
  function stopIfIdle(): void {
    if (running()) return;
    if (ticker !== undefined) clearInterval(ticker);
    ticker = undefined;
    unsubscribe?.();
    unsubscribe = undefined;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    again = false;
    // Nothing watches the log while idle: the next open reloads first.
    stale = true;
  }

  return {
    async ensureFresh(force = false) {
      if (inflight) await inflight.catch(() => undefined);
      if (force || !loaded || stale || options.clock().getTime() - lastReloadAt > options.freshnessMs) await reload();
    },
    register(connection) {
      const first = connections.size === 0;
      connections.add(connection);
      if (first) {
        start();
        // Writes between the open's reload and this registration were not watched: catch up now.
        schedule();
      }
      return { head: lastSeq, log, states };
    },
    unregister(connection) {
      connections.delete(connection);
      stopIfIdle();
    },
    states: () => states,
    head: () => lastSeq,
    poke: () => { inScope(schedule); },
  };
}

class MissingHashError extends Error {
  constructor() {
    super('Stream batch: an event without source hash.');
  }
}

function applyOne(states: Map<string, State>, e: DomainEvent): void {
  if (!e.meetingId) return;
  let state = states.get(e.meetingId);
  if (!state) {
    state = emptyState();
    states.set(e.meetingId, state);
  }
  reduce(state, e);
}
