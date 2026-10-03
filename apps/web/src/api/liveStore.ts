/**
 * Slice 036a: the live store (Live-Store) — buffered reads behind `HvApi`, over both adapters (ADR 0002).
 *
 * After the first load a view only fetches what a change touched, at most once per batch. Only successful answers of
 * read methods are buffered, keyed by the structural actor (every field of the current `Actor`), the method and its
 * arguments, so no actor ever gets an answer asked for another one (010d, MF-LS-1). The buffer lives in this tab's
 * memory only; nothing goes to browser storage (T-G1-I-08).
 *
 * Invalidation comes from the adapter's `subscribe` (the store is its only subscriber): a `change` signal names topics
 * and item ids (R-PERM-04), an `event` message is mapped through `EVENT_TOPICS`/`EVENT_SUBJECTS` from the domain — the
 * same side effects as in the service — and a bare call (the 30 s tick) empties everything. Own writes empty the buffer
 * synchronously (takt-030, takt-032). The views keep hanging on `useApiVersion`, which listens here.
 *
 * Generations (m2): an actor epoch `A`, a data epoch `E` and per key a generation `g(k)`. A request remembers all three
 * at its start; its answer is buffered only if all three are unchanged on arrival. If `A` changed (or the actor read on
 * arrival is structurally another one), the answer is never delivered: the caller's promise stays unsettled, because
 * the views' load keys compare only `getActor().id` and would otherwise show fields or `_actions` of the previous
 * rights (Codex P1). The view reloads anyway, `useApiVersion` counts on the actor change or on the listener call after
 * `clear()`.
 */
import {
  EVENT_SUBJECTS,
  EVENT_TOPICS,
  STREAM_TOPICS,
  type Actor,
  type HvApi,
  type Meeting,
  type ReadEvent,
  type StreamChange,
  type StreamTopic,
  type SubjectRef,
} from '@hv/domain';
import type { WriteOutcome } from './http';

/** Every read method of `HvApi` (the contract names them get… and list…); a new one fails to compile below. */
export type ReadMethodName = Extract<keyof HvApi, `get${string}` | `list${string}`>;
/** `listEvents` is a cursor read and never buffered. */
type BufferedRead = Exclude<ReadMethodName, 'listEvents'>;

/** Topics → reads, as data (m7). Complete by type: a missing or unknown read fails `satisfies`. */
export const READ_TOPICS = {
  getMeeting: ['meeting'],
  listMeetings: ['meeting'],
  getMeetingById: ['meeting'],
  listMeetingAgendaItems: ['meeting'],
  listMeetingUnits: ['meeting'],
  listMeetingStageSeats: ['meeting'],
  listAgendaItems: ['meeting'],
  listUnits: ['meeting'],
  listSpeakers: ['speakers'],
  getSpeaker: ['speakers'],
  listContributions: ['contributions'],
  getContribution: ['contributions'],
  listQuestions: ['questions'],
  getQuestion: ['questions'],
  getQuestionHistory: ['questions'],
  getStage: ['questions', 'stage'],
  listRoleAssignments: ['roles'],
  // Scheibe 044a: the catalogue is code data and changes only with a deploy; no topic invalidates it.
  listRefusalGrounds: [],
} as const satisfies Record<BufferedRead, readonly StreamTopic[]>;

/** Item reads: invalidated per id (the first argument) where a message names ids. */
const ITEM_READS: Partial<Record<BufferedRead, SubjectRef['kind']>> = {
  getQuestion: 'question',
  getQuestionHistory: 'question',
  getSpeaker: 'speaker',
  getContribution: 'contribution',
};

/**
 * Version watermarks (N3): a counter of `Meeting` → the reads that depend on it. `speakerListVersion` is the tag the
 * speaker list is written against; `version` counts lifecycle and agenda progress, shown by the other meeting reads.
 */
export const WATERMARKS = {
  speakerListVersion: ['listSpeakers', 'getSpeaker'],
  version: ['listMeetings', 'getMeetingById', 'listMeetingAgendaItems', 'listMeetingUnits', 'listMeetingStageSeats', 'listAgendaItems', 'listUnits'],
} as const satisfies Partial<Record<keyof Meeting, readonly Exclude<BufferedRead, 'getMeeting'>[]>>;
type Counter = keyof typeof WATERMARKS;
const COUNTERS = Object.keys(WATERMARKS) as Counter[];
const COUNTER_OF = new Map<BufferedRead, Counter>(
  COUNTERS.flatMap((counter) => WATERMARKS[counter].map((method): [BufferedRead, Counter] => [method, counter])),
);

/** Writes: complete by type, so a new command of `HvApi` has to be sorted in here. */
type WriteMethodName = Exclude<keyof HvApi, ReadMethodName | 'lastWriteEtag' | 'seedDemo' | 'subscribe'>;
const WRITE_METHODS = {
  openAgendaItem: true, openVoting: true, closeVoting: true, assignRole: true, revokeRole: true,
  replaceMeetingAgendaItems: true, replaceMeetingUnits: true, replaceMeetingStageSeats: true,
  registerSpeaker: true, reorderSpeakers: true, updateSpeaker: true, captureContribution: true,
  captureMeetingContribution: true, captureQuestions: true, claimContribution: true, releaseContribution: true,
  claimQuestion: true, releaseQuestion: true, classifyQuestion: true, assignQuestion: true, draftAnswer: true,
  submitForReview: true, approveQuestion: true, clearQuestionLegally: true, returnQuestion: true, stageQuestion: true,
  deliverQuestion: true, closeQuestion: true, withdrawQuestion: true, mergeQuestion: true,
  proposeRefusal: true, approveRefusal: true,
} as const satisfies Record<WriteMethodName, true>;

const MAX_ENTRIES = 200;
const BATCH_MS = 100;
/**
 * Review M1 (SP-7, T-G1-I-08): every entry lives at most this long — the same as the HTTP tick — because rights can end
 * without any signal (an expired role assignment, a sign-out or revocation in another window). Plain entries expire
 * silently; the next read asks the network. N7: an entry holding a claim ends at the earliest `claim.expiresAt`, at the
 * latest after the same maximum age, and wakes the listeners, since the claim ended without an event.
 */
const MAX_AGE_MS = 30_000;

/** Why the buffer is emptied (Entscheidung 8); the last three are the stream ends of slice 036b. */
export type ClearReason = 'actor' | 'unauthorized' | 'logout' | 'roles_changed' | 'forbidden' | 'session';

export interface LiveStoreControl {
  /** Empties the buffer and drops every answer on its way (`A` and `E` raised). */
  clear(reason: ClearReason): void;
  /** A message of the stream (036b), handled like one from the adapter's `subscribe`. */
  onStreamMessage(events: readonly ReadEvent[], change?: StreamChange): void;
  /** The HTTP adapter's `onWriteSettled` hook (http.ts). */
  onWriteSettled(outcome: WriteOutcome): void;
}
export type LiveStore = HvApi & LiveStoreControl;

export interface LiveStoreOptions {
  /** The calling actor; throws when there is none (signed out). */
  getActor: () => Actor;
  /**
   * Milliseconds since the epoch; injected (the web time source of slice 032 is not merged). Used only to compare a
   * `claim.expiresAt`, which is a wall-clock time from the service.
   */
  now: () => number;
  /**
   * A monotonic millisecond source (the browser's `performance.now()`), for the maximum age of entries. A wall clock set
   * back must not extend the 30 s bound on a loss of rights without a signal (re-check minor 2, MF-LS-1, SP-2).
   */
  monotonic: () => number;
  /** Demo adapter: it has no write hook, so the store watches the writes' promises itself. */
  observeWrites?: boolean;
}

/** All fields of the actor, the same field list as `actorChanged`; an absent and an undefined field are equal. */
export function actorKey(actor: Actor): string {
  const fields = actor as unknown as Record<string, unknown>;
  return JSON.stringify(Object.keys(fields).filter((name) => fields[name] !== undefined).sort().map((name) => [name, fields[name]]));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
  }
  return value;
}

/** The earliest `claim.expiresAt` anywhere in an answer (question, contribution, stage). */
function earliestClaimEnd(value: unknown): number | undefined {
  let earliest: number | undefined;
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    for (const [name, inner] of Object.entries(node as Record<string, unknown>)) {
      if (name === 'claim' && inner !== null && typeof inner === 'object') {
        const end = Date.parse(String((inner as { expiresAt?: unknown }).expiresAt));
        // An unreadable end counts as already past: such an entry is not kept.
        const at = Number.isNaN(end) ? -Infinity : end;
        earliest = earliest === undefined ? at : Math.min(earliest, at);
      }
      visit(inner);
    }
  };
  visit(value);
  return earliest;
}

/** Trailing `undefined` arguments do not make another key (`listSpeakers()` = `listSpeakers(undefined)`). */
function trimmed(args: readonly unknown[]): readonly unknown[] {
  let end = args.length;
  while (end > 0 && args[end - 1] === undefined) end -= 1;
  return args.slice(0, end);
}

interface Entry {
  method: BufferedRead;
  args: readonly unknown[];
  value: unknown;
  watermark: number | undefined;
  /** Arrival on the monotonic clock; the entry is not delivered from `bornAt + MAX_AGE_MS` on. */
  bornAt: number;
  /** Earliest `claim.expiresAt` on the wall clock, if the answer holds a claim: its end wakes the listeners (N7). */
  claimEnd: number | undefined;
}
type Outcome = { kind: 'ok'; value: unknown } | { kind: 'error'; error: unknown } | { kind: 'withheld' };
interface Flight {
  method: BufferedRead;
  args: readonly unknown[];
  shared: Promise<Outcome>;
}
type Match = (method: BufferedRead, args: readonly unknown[]) => boolean;
type Listener = Parameters<HvApi['subscribe']>[0];

export function createLiveStore(adapter: HvApi, options: LiveStoreOptions): LiveStore {
  let actorEpoch = 0; // A
  let dataEpoch = 0; // E
  const generation = new Map<string, number>(); // g(k), kept only while a request for k is on its way
  const running = new Map<string, number>(); // requests on their way per key
  const flights = new Map<string, Flight>(); // the shared request of the current generation per key
  const entries = new Map<string, Entry>(); // insertion order = age
  let mark: { meetingId: string; values: Record<Counter, number> } | undefined;
  let lastActor: string | undefined;
  const listeners = new Set<Listener>();
  let detach: (() => void) | undefined;
  let batch: { full: boolean; matches: Match[] } | undefined;
  let batchTimer: ReturnType<typeof setTimeout> | undefined;
  let claimTimer: ReturnType<typeof setTimeout> | undefined;
  let swallowBareCall = false;

  const currentActor = (): string | undefined => {
    try { return actorKey(options.getActor()); } catch { return undefined; }
  };
  const notify = (): void => {
    for (const listener of [...listeners]) {
      try { listener([]); } catch { /* one view's listener must not starve the others */ }
    }
  };

  const invalidateKey = (key: string): void => {
    entries.delete(key);
    if ((running.get(key) ?? 0) > 0) generation.set(key, (generation.get(key) ?? 0) + 1);
    flights.delete(key);
  };
  const invalidateWhere = (match: Match): void => {
    const keys: string[] = [];
    for (const [key, entry] of entries) if (match(entry.method, entry.args)) keys.push(key);
    for (const [key, flight] of flights) if (match(flight.method, flight.args)) keys.push(key);
    for (const key of keys) invalidateKey(key);
  };
  const stopClaimTimer = (): void => {
    if (claimTimer !== undefined) clearTimeout(claimTimer);
    claimTimer = undefined;
  };
  /** Whole invalidation: raise `E`; every entry and every answer on its way is stale. */
  const invalidateAll = (): void => {
    dataEpoch += 1;
    entries.clear();
    flights.clear();
    stopClaimTimer();
  };
  const cancelBatch = (): void => {
    if (batchTimer !== undefined) clearTimeout(batchTimer);
    batchTimer = undefined;
    batch = undefined;
  };
  const clearAll = (): void => {
    actorEpoch += 1;
    invalidateAll();
    mark = undefined;
    lastActor = undefined;
  };
  /** A structurally other actor than the last one seen empties the buffer (also the demo role switcher). */
  const observeActor = (): string | undefined => {
    const key = currentActor();
    if (key !== lastActor) {
      if (lastActor !== undefined) clearAll();
      lastActor = key;
    }
    return key;
  };

  /** Past its maximum age (monotonic) or its claim (wall clock). */
  const expired = (entry: Entry): boolean =>
    options.monotonic() - entry.bornAt >= MAX_AGE_MS || (entry.claimEnd !== undefined && entry.claimEnd <= options.now());
  /** Milliseconds until a claim entry ends, the earlier of its maximum age and its claim. */
  const remaining = (entry: Entry): number =>
    Math.min(entry.bornAt + MAX_AGE_MS - options.monotonic(), (entry.claimEnd ?? Infinity) - options.now());
  const scheduleClaims = (): void => {
    stopClaimTimer();
    let next: number | undefined;
    for (const entry of entries.values()) {
      if (entry.claimEnd === undefined) continue;
      const left = remaining(entry);
      if (next === undefined || left < next) next = left;
    }
    if (next === undefined) return;
    claimTimer = setTimeout(expireClaims, Math.max(0, next));
  };
  function expireClaims(): void {
    claimTimer = undefined;
    let woke = false;
    for (const [key, entry] of entries) {
      if (expired(entry)) {
        entries.delete(key);
        if (entry.claimEnd !== undefined) woke = true;
      }
    }
    scheduleClaims();
    if (woke) notify();
  }

  const markOf = (method: BufferedRead): number | undefined => {
    const counter = COUNTER_OF.get(method);
    return counter === undefined ? undefined : mark?.values[counter];
  };
  /** A fresh `getMeeting` with a higher counter (or another meeting) drops the dependent entries before it resolves. */
  const raiseMark = (meeting: Meeting): void => {
    if (meeting === null || typeof meeting !== 'object' || typeof meeting.id !== 'string') return;
    const values = { speakerListVersion: meeting.speakerListVersion, version: meeting.version };
    if (mark === undefined || mark.meetingId !== meeting.id) {
      invalidateWhere((method) => COUNTER_OF.has(method));
      mark = { meetingId: meeting.id, values };
      return;
    }
    for (const counter of COUNTERS) {
      const next = values[counter];
      if (typeof next === 'number' && next > mark.values[counter]) {
        mark.values[counter] = next;
        invalidateWhere((method) => COUNTER_OF.get(method) === counter);
      }
    }
  };

  const keep = (key: string, method: BufferedRead, args: readonly unknown[], value: unknown, watermark: number | undefined): void => {
    const claimEnd = earliestClaimEnd(value);
    // Already past on arrival (clock skew between browser and service): not kept, and nobody is woken — no reload loop.
    if (claimEnd !== undefined && claimEnd <= options.now()) return;
    entries.delete(key);
    entries.set(key, { method, args, value, watermark, bornAt: options.monotonic(), claimEnd });
    while (entries.size > MAX_ENTRIES) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    if (claimEnd !== undefined) scheduleClaims();
  };

  /**
   * Each caller gets a promise of its own; a withheld answer leaves it unsettled, with no reference kept here. The actor
   * is checked again at the moment of delivery, a microtask after the arrival (review minor 3, defence in depth).
   */
  const forCaller = (shared: Promise<Outcome>, startA: number, actor: string): Promise<never> =>
    new Promise((resolve, reject) => {
      void shared.then((outcome) => {
        if (startA !== actorEpoch || observeActor() !== actor) return;
        if (outcome.kind === 'ok') resolve(outcome.value as never);
        else if (outcome.kind === 'error') reject(outcome.error);
      });
    });

  const read = (method: BufferedRead, args: unknown[]): Promise<unknown> => {
    const call = (): Promise<unknown> => {
      try {
        return Reflect.apply(adapter[method] as (...values: unknown[]) => Promise<unknown>, adapter, args);
      } catch (error) {
        return Promise.reject(error);
      }
    };
    const actor = observeActor();
    // Signed out: nothing to buffer, nothing of anyone to protect; the adapter answers (401).
    if (actor === undefined) return call();
    const argsKey = trimmed(args);
    const key = JSON.stringify([actor, method, argsKey]);
    const startA = actorEpoch;

    const entry = entries.get(key);
    if (entry !== undefined) {
      const fresh = entry.watermark === markOf(method) && !expired(entry);
      if (fresh) {
        // Asynchronous, as a new promise (010c); withheld if the actor changes before it is delivered.
        return forCaller(Promise.resolve({ kind: 'ok', value: entry.value }), startA, actor);
      }
      entries.delete(key);
    }
    const flight = flights.get(key);
    if (flight !== undefined) return forCaller(flight.shared, startA, actor);

    const startE = dataEpoch;
    const startG = generation.get(key) ?? 0;
    const watermark = markOf(method);
    running.set(key, (running.get(key) ?? 0) + 1);
    const settle = (outcome: { ok: true; value: unknown } | { ok: false; error: unknown }): Outcome => {
      const sameGeneration = (generation.get(key) ?? 0) === startG;
      const left = (running.get(key) ?? 1) - 1;
      if (left > 0) running.set(key, left);
      else { running.delete(key); generation.delete(key); }
      if (flights.get(key)?.shared === shared) flights.delete(key);
      if (startA !== actorEpoch || observeActor() !== actor) return { kind: 'withheld' };
      if (!outcome.ok) return { kind: 'error', error: outcome.error };
      try {
        const value = deepFreeze(structuredClone(outcome.value));
        if (method === 'getMeeting') raiseMark(value as Meeting);
        if (detach !== undefined && startE === dataEpoch && sameGeneration && watermark === markOf(method)) {
          keep(key, method, argsKey, value, watermark);
        }
        return { kind: 'ok', value };
      } catch (error) {
        // Review minor 4: an answer that cannot be copied (DataCloneError) or a failing bookkeeping step reaches the
        // caller as a failure, never as a promise that hangs with an unhandled rejection behind it.
        return { kind: 'error', error };
      }
    };
    const shared: Promise<Outcome> = call().then(
      (value) => settle({ ok: true, value }),
      (error: unknown) => settle({ ok: false, error }),
    );
    flights.set(key, { method, args: argsKey, shared });
    return forCaller(shared, startA, actor);
  };

  /** Collects what one message invalidates; applied once when the batch closes. */
  const collect = (events: readonly ReadEvent[], change: StreamChange | undefined): { full: boolean; matches: Match[] } => {
    if (events.length === 0 && change === undefined) return { full: true, matches: [] };
    const matches: Match[] = [];
    let full = false;
    for (const item of events) {
      const topics = (EVENT_TOPICS as Partial<Record<string, readonly StreamTopic[]>>)[item.type];
      const pick = (EVENT_SUBJECTS as Partial<Record<string, (e: ReadEvent) => readonly SubjectRef[]>>)[item.type];
      let refs: readonly SubjectRef[] | undefined;
      try { refs = pick?.(item); } catch { refs = undefined; }
      // An event type the tables do not know (a newer or older log): everything, never too little.
      if (topics === undefined || refs === undefined) { full = true; continue; }
      const topicSet = new Set(topics);
      const ids = new Map<SubjectRef['kind'], Set<string>>();
      for (const ref of refs) {
        if (typeof ref.id !== 'string') continue;
        const set = ids.get(ref.kind) ?? new Set<string>();
        set.add(ref.id);
        ids.set(ref.kind, set);
      }
      matches.push((method, args) => {
        const kind = ITEM_READS[method];
        if (kind !== undefined) return ids.get(kind)?.has(String(args[0])) ?? false;
        return READ_TOPICS[method].some((topic) => topicSet.has(topic));
      });
    }
    if (change !== undefined) {
      const known = new Set<StreamTopic>(STREAM_TOPICS);
      if (change.topics.some((topic) => !known.has(topic))) full = true;
      const topicSet = new Set(change.topics);
      const ids = change.subjects !== undefined ? new Set(change.subjects) : undefined;
      matches.push((method, args) =>
        READ_TOPICS[method].some((topic) => topicSet.has(topic)) &&
        (ITEM_READS[method] === undefined || ids === undefined || ids.has(String(args[0]))));
    }
    return { full, matches };
  };
  const flush = (): void => {
    const closing = batch;
    batchTimer = undefined;
    batch = undefined;
    if (closing === undefined) return;
    if (closing.full) invalidateAll();
    else invalidateWhere((method, args) => closing.matches.some((match) => match(method, args)));
    notify();
  };
  const onMessage = (events: readonly ReadEvent[], change?: StreamChange): void => {
    // The adapter's own listener call right after a successful write (takt-030) is the same impulse as the hook.
    if (swallowBareCall && events.length === 0 && change === undefined) { swallowBareCall = false; return; }
    const next = collect(events, change);
    batch ??= { full: false, matches: [] };
    batch.full ||= next.full;
    batch.matches.push(...next.matches);
    batchTimer ??= setTimeout(flush, BATCH_MS);
  };

  const settleWrite = (outcome: WriteOutcome): void => {
    if (outcome === 'success') {
      // m1: at once, no batch; the ETag is already set (takt-030). The open batch is covered by this.
      invalidateAll();
      cancelBatch();
      notify();
    } else if (outcome === 'server_error') {
      // 412/409/422/5xx/network: stale for sure, but no listeners (takt-030 Ziel 2); the view's reload reads fresh.
      invalidateAll();
    }
  };

  const store: Record<string, unknown> = {};
  for (const method of Object.keys(READ_TOPICS) as BufferedRead[]) {
    store[method] = (...args: unknown[]) => read(method, args);
  }
  for (const method of Object.keys(WRITE_METHODS) as WriteMethodName[]) {
    store[method] = (...args: unknown[]) => {
      const result = Reflect.apply(adapter[method] as (...values: unknown[]) => Promise<unknown>, adapter, args);
      if (options.observeWrites !== true) return result;
      return result.then(
        (value) => { settleWrite('success'); return value; },
        (error: unknown) => { settleWrite('server_error'); throw error; },
      );
    };
  }
  const control: LiveStoreControl = {
    clear(reason) {
      clearAll();
      // useApiVersion counts an actor change itself (takt-033b); a second count would load every view twice.
      if (reason !== 'actor') notify();
    },
    onStreamMessage: onMessage,
    onWriteSettled(outcome) {
      settleWrite(outcome);
      if (outcome === 'success') {
        swallowBareCall = true;
        queueMicrotask(() => { swallowBareCall = false; });
      }
    },
  };
  return Object.assign(store, control, {
    listEvents: (after?: number, limit?: number) => adapter.listEvents(after, limit),
    lastWriteEtag: () => adapter.lastWriteEtag(),
    seedDemo: (seedOptions?: Parameters<HvApi['seedDemo']>[0]) => adapter.seedDemo(seedOptions),
    subscribe(listener: Listener) {
      listeners.add(listener);
      if (detach === undefined) {
        // Nothing was heard while detached, so nothing from then may be kept.
        invalidateAll();
        detach = adapter.subscribe(onMessage);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && detach !== undefined) {
          detach();
          detach = undefined;
          cancelBatch();
          invalidateAll();
        }
      };
    },
  }) as unknown as LiveStore;
}
