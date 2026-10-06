/**
 * Scheibe 060: the draft buffer (Entwurfspuffer) of the answer views — the unsaved answer draft of the Beantwortung and of
 * the writing mode, kept in this browser (IndexedDB) per actor and meeting, so that a reload, a closed tab, a lost
 * connection or a new sign-in of the same person does not lose it (DSFA V5, T-G1-I-08).
 *
 * Three layers:
 *   - a pure core: the id of an entry (`entryId`), the check of an entry read or written (`sanitizeEntry`: the fields of
 *     decision 2 only, the core's `checkAnswerBodyInput`, the normalisation, the caps), expiry after 14 hours;
 *   - the snapshot (`createDraftBuffer`): loaded once per confirmed actor, then write-through; every access compares the
 *     owner with `getActor()` (re-check major 1), so a persona switch never shows or writes another person's draft;
 *   - a thin IndexedDB adapter behind `BufferStore` (`createIndexedDbStore`), and the same interface in memory for tests.
 *
 * The module knows neither the mode nor the session (it imports none of the session modules): `index.ts` wires the
 * places that clear it (`wireDraftBuffer`, `clearBeforeSignOut`). Nothing here ever leaves the browser: no network, no
 * broadcast between tabs, no service worker (decision 8). A restored body reaches the field only through `bodyToDom` and
 * the comparison only through `AnswerText` (decision 2).
 */
import { useSyncExternalStore } from 'react';
import { checkAnswerBodyInput, codePointLength } from '@hv/domain';
import type { AnswerBodyInput } from '@hv/domain';
import { previewAnswer, previewText } from './answerFormat';

/** The database, its object store and the schema number (decision 1). Names, not credentials (gitleaks, takt-021). */
export const BUFFER_DATABASE = 'hv-answer-drafts';
export const BUFFER_OBJECT_STORE = 'drafts';
export const BUFFER_SCHEMA = 1;

/** Decision 4 (owner question 2, default): an entry lives 14 hours after its last change (DSFA V11, longest session). */
export const BUFFER_LIFETIME_MS = 14 * 60 * 60 * 1000;
/** Decision 4: a write follows 400 ms after the last input. */
export const BUFFER_DEBOUNCE_MS = 400;
/** Decision 4: sign-out waits for the clear at most this long. */
export const SIGN_OUT_CLEAR_LIMIT_MS = 1000;
/** Decision 2: an entry is never larger than 256 KiB serialised. */
const ENTRY_MAX_CHARS = 256 * 1024;
/** Decision 2: a device clock a little ahead is tolerated, more is a manipulated entry. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
/** The contract's limits of the sources (50 of 2 000 characters each) and of the whole line. */
const SOURCES_MAX_PARTS = 50;
const SOURCE_MAX_CHARS = 2000;
const SOURCES_MAX_CHARS = 102_000;
const ANSWER_TEXT_MAX_CHARS = 20_000;

/** One buffered draft: exactly the fields of decision 2. The base itself always comes from the record. */
export interface BufferEntry {
  id: string;
  schema: number;
  ownerId: string;
  meetingId: string;
  questionId: string;
  body: AnswerBodyInput | null;
  sources: string;
  baseVersion: number;
  changedAt: number;
}

/** What a view hands over to buffer a draft; id, schema and time are added here. */
export interface DraftFields {
  ownerId: string;
  meetingId: string;
  questionId: string;
  body: AnswerBodyInput | null;
  sources: string;
  baseVersion: number;
}

/** Which draft: one person, one meeting, one question. */
export type DraftTarget = Pick<DraftFields, 'ownerId' | 'meetingId' | 'questionId'>;

/** What `restoreDraft` reads of an entry. */
export type BufferedDraft = Omit<BufferEntry, 'id' | 'schema'>;

/** Every method settles only after the transaction completed (`oncomplete`), and rejects when it failed. */
export interface BufferStore {
  getAll(): Promise<unknown[]>;
  put(entry: BufferEntry): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export type BufferStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

/** The id of an entry, from its three parts; each part is encoded, so no separator inside a part can collide. */
export function entryId(meetingId: string, ownerId: string, questionId: string): string {
  return [meetingId, ownerId, questionId].map(encodeURIComponent).join('|');
}

type Obj = Record<string, unknown>;
const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

function hasText(body: AnswerBodyInput): boolean {
  const runs = (piece: unknown): boolean =>
    Array.isArray(piece) && piece.some((run) => isObject(run) && typeof run['text'] === 'string' && run['text'].trim() !== '');
  return body.blocks.some((block) => runs(block.content) || (block.items ?? []).some(runs));
}

/** The sources line split as `splitSources` splits it: at `;`, trimmed, empty parts dropped. */
function sourcesFit(sources: string): boolean {
  if (sources.length > SOURCES_MAX_CHARS) return false;
  const parts = sources.split(';').map((part) => part.trim()).filter((part) => part !== '');
  return parts.length <= SOURCES_MAX_PARTS && parts.every((part) => codePointLength(part) <= SOURCE_MAX_CHARS);
}

/**
 * Decision 2: the check of an entry, when written and when read. Returns a fresh object with exactly the allowed fields,
 * or `undefined` for anything else (the caller deletes it; nothing is thrown and nothing of its content is logged).
 * The body is the open input form of the field: it is checked with the core's own shape check (the same forms and limits
 * as the contract and the service's 422), so a draft the service would accept is never refused here.
 */
export function sanitizeEntry(raw: unknown, now: number): BufferEntry | undefined {
  if (!isObject(raw) || raw['schema'] !== BUFFER_SCHEMA) return undefined;
  const { id, ownerId, meetingId, questionId, sources, baseVersion, changedAt, body } = raw;
  if (typeof id !== 'string' || typeof ownerId !== 'string' || typeof meetingId !== 'string' ||
    typeof questionId !== 'string' || typeof sources !== 'string') return undefined;
  if (ownerId === '' || meetingId === '' || questionId === '') return undefined;
  if (id !== entryId(meetingId, ownerId, questionId)) return undefined;
  if (typeof baseVersion !== 'number' || !Number.isInteger(baseVersion) || baseVersion < 0) return undefined;
  if (typeof changedAt !== 'number' || !Number.isFinite(changedAt) || changedAt <= 0 || changedAt > now + FUTURE_TOLERANCE_MS) return undefined;
  if (!sourcesFit(sources)) return undefined;
  let checked: AnswerBodyInput | null = null;
  if (body !== null) {
    if (checkAnswerBodyInput(body) !== undefined) return undefined;
    checked = body as AnswerBodyInput;
    if (previewAnswer(checked) === null && hasText(checked)) return undefined;
    if (codePointLength(previewText(checked)) > ANSWER_TEXT_MAX_CHARS) return undefined;
  }
  return { id, schema: BUFFER_SCHEMA, ownerId, meetingId, questionId, body: checked, sources, baseVersion, changedAt };
}

/** A store in memory with the same interface, for tests (and nothing else). */
export function createMemoryStore(): BufferStore & { rows: Map<string, unknown> } {
  const rows = new Map<string, unknown>();
  return {
    rows,
    getAll: async () => [...rows.values()].map((row) => structuredClone(row)),
    put: async (entry) => { rows.set(entry.id, structuredClone(entry)); },
    delete: async (id) => { rows.delete(id); },
    clear: async () => { rows.clear(); },
  };
}

/**
 * The IndexedDB adapter. The database is opened on first use, never on import (decision 1). Every call resolves on
 * `oncomplete` of its transaction and rejects on `onerror`/`onabort` (quota, a blocked or missing database).
 */
export function createIndexedDbStore(factory: () => IDBFactory | undefined = () => globalThis.indexedDB): BufferStore {
  let opened: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const idb = factory();
      if (idb === undefined) { reject(new Error('IndexedDB is not available.')); return; }
      const request = idb.open(BUFFER_DATABASE, BUFFER_SCHEMA);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(BUFFER_OBJECT_STORE)) {
          request.result.createObjectStore(BUFFER_OBJECT_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
      request.onblocked = () => reject(new Error('IndexedDB is blocked.'));
    });
    opened.catch(() => { opened = undefined; });
    return opened;
  };
  const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest | undefined): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(BUFFER_OBJECT_STORE, mode);
      const request = work(tx.objectStore(BUFFER_OBJECT_STORE));
      tx.oncomplete = () => resolve(request?.result as T);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
    });
  };
  return {
    getAll: () => run<unknown[]>('readonly', (store) => store.getAll()),
    put: (entry) => run<void>('readwrite', (store) => store.put(entry)),
    delete: (id) => run<void>('readwrite', (store) => store.delete(id)),
    clear: () => run<void>('readwrite', (store) => store.clear()),
  };
}

export interface DraftBuffer {
  status(): BufferStatus;
  /** Changes with every change a view may show (snapshot, kept times, status). */
  revision(): number;
  /** Counts completed loads; a view uses it to restore over a draft built before the snapshot arrived. */
  snapshotId(): number;
  subscribe(listener: () => void): () => void;
  /** Loads the snapshot for the confirmed actor (and deletes every other actor's entries); arms the buffer. */
  load(): Promise<void>;
  entryFor(meetingId: string, questionId: string): BufferEntry | undefined;
  /** The time of the last write of this draft that completed (`oncomplete`), for the line "zwischengespeichert". */
  keptAt(meetingId: string, questionId: string): number | undefined;
  /** Writes now; the time once the transaction completed, `undefined` when nothing was written. */
  put(fields: DraftFields): Promise<number | undefined>;
  delete(meetingId: string, questionId: string): Promise<void>;
  /** Writes `fields` 400 ms after the last call for the same draft. */
  schedule(fields: DraftFields): void;
  /** Deletes the draft 400 ms after the last call for it (an input made it unchanged again). */
  scheduleDelete(target: DraftTarget): void;
  /** Writes a pending change at once; the time of the stored draft, `undefined` when none is stored. */
  flush(meetingId: string, questionId: string): Promise<number | undefined>;
  clear(): Promise<void>;
  /** Stream end `roles_changed`: drafts are re-checked where `answer.draft` is no longer offered (decision 4). */
  markRolesChanged(): void;
  rolesChanged(): boolean;
}

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  ownerId: string;
  meetingId: string;
  questionId: string;
  fields: DraftFields | null;
}

export function createDraftBuffer(options: {
  store: BufferStore;
  /** Wall clock of the device in milliseconds: expiry and the "zwischengespeichert" line only. */
  now: () => number;
  /** The confirmed actor; throws when there is none. */
  getActor: () => { id: string };
}): DraftBuffer {
  const { store, now, getActor } = options;
  let snapshot = new Map<string, BufferEntry>();
  const kept = new Map<string, number>();
  const pending = new Map<string, Pending>();
  const listeners = new Set<() => void>();
  let status: BufferStatus = 'idle';
  let loadedFor: string | undefined;
  let loading: { id: string; done: Promise<void> } | undefined;
  let loads = 0;
  let rev = 0;
  let roles = false;
  // Not armed until the first explicit load: the demo start switches to the administration and back before it (blocker 1).
  let armed = false;

  const notify = (): void => {
    rev += 1;
    for (const listener of listeners) listener();
  };
  const actorId = (): string | undefined => {
    try {
      return getActor().id;
    } catch {
      return undefined;
    }
  };
  const switchOff = (): void => {
    status = 'unavailable';
    notify();
  };
  const cancelPending = (id: string): void => {
    const held = pending.get(id);
    if (held === undefined) return;
    clearTimeout(held.timer);
    pending.delete(id);
  };

  async function loadFor(id: string): Promise<void> {
    if (loading?.id === id) return loading.done;
    const done = (async () => {
      status = status === 'unavailable' ? status : 'loading';
      try {
        const rows = await store.getAll();
        const at = now();
        const next = new Map<string, BufferEntry>();
        const drop: string[] = [];
        for (const raw of rows) {
          const clean = sanitizeEntry(raw, at);
          const rawId = isObject(raw) && typeof raw['id'] === 'string' ? raw['id'] : undefined;
          if (clean === undefined || clean.ownerId !== id || at - clean.changedAt >= BUFFER_LIFETIME_MS) {
            if (rawId !== undefined) drop.push(rawId);
            continue;
          }
          next.set(clean.id, clean);
        }
        // purgeOthers: every entry of another actor, every rejected and every expired one goes (idempotent).
        for (const rawId of drop) await store.delete(rawId);
        if (actorId() !== id) return;
        if (loadedFor !== id) roles = false;
        for (const [key, held] of pending) if (held.ownerId !== id) cancelPending(key);
        snapshot = next;
        kept.clear();
        for (const entry of next.values()) kept.set(entry.id, entry.changedAt);
        loadedFor = id;
        loads += 1;
        if (status !== 'unavailable') status = 'ready';
      } catch {
        status = 'unavailable';
      } finally {
        if (loading?.id === id) loading = undefined;
        notify();
      }
    })();
    loading = { id, done };
    return done;
  }

  /** The owner rule of every access: the snapshot belongs to the confirmed actor, or nothing is answered. */
  function owner(): string | undefined {
    const id = actorId();
    if (id === undefined || !armed) return undefined;
    if (id !== loadedFor) {
      void loadFor(id);
      return undefined;
    }
    return id;
  }

  /** Whether a write for `ownerId` may go now (`yes`), after loading (`load`), or not at all (`no`). Synchronous. */
  function readiness(ownerId: string): 'yes' | 'load' | 'no' {
    const id = actorId();
    if (!armed || id === undefined || id !== ownerId || status === 'unavailable') return 'no';
    return loadedFor === id ? 'yes' : 'load';
  }

  function put(fields: DraftFields): Promise<number | undefined> {
    const ready = readiness(fields.ownerId);
    if (ready === 'no') return Promise.resolve(undefined);
    if (ready === 'load') return loadFor(fields.ownerId).then(() => (readiness(fields.ownerId) === 'yes' ? write(fields) : undefined));
    return write(fields);
  }

  /** Write-through: the snapshot changes at once (synchronously), the store after it. */
  async function write(fields: DraftFields): Promise<number | undefined> {
    const changedAt = now();
    const candidate = { ...fields, id: entryId(fields.meetingId, fields.ownerId, fields.questionId), schema: BUFFER_SCHEMA, changedAt };
    const entry = sanitizeEntry(candidate, changedAt);
    if (entry === undefined || JSON.stringify(entry).length > ENTRY_MAX_CHARS) {
      switchOff();
      return undefined;
    }
    const previous = snapshot.get(entry.id);
    snapshot.set(entry.id, entry);
    notify();
    try {
      await store.put(entry);
    } catch {
      // Roll back only while the snapshot still holds the failed value (a newer write stays, re-check minor 3).
      if (snapshot.get(entry.id) === entry) {
        if (previous === undefined) snapshot.delete(entry.id);
        else snapshot.set(entry.id, previous);
      }
      switchOff();
      return undefined;
    }
    if (snapshot.get(entry.id) !== entry) return undefined;
    kept.set(entry.id, changedAt);
    notify();
    return changedAt;
  }

  async function remove(meetingId: string, questionId: string): Promise<void> {
    const id = actorId();
    if (id === undefined || id !== loadedFor) return;
    const key = entryId(meetingId, id, questionId);
    cancelPending(key);
    const previous = snapshot.get(key);
    snapshot.delete(key);
    kept.delete(key);
    notify();
    try {
      await store.delete(key);
    } catch {
      if (!snapshot.has(key) && previous !== undefined) snapshot.set(key, previous);
      switchOff();
    }
  }

  function later({ ownerId, meetingId, questionId }: DraftTarget, fields: DraftFields | null): void {
    if (!armed || status === 'unavailable') return;
    const key = entryId(meetingId, ownerId, questionId);
    cancelPending(key);
    const timer = setTimeout(() => {
      const held = pending.get(key);
      if (held === undefined || held.timer !== timer) return;
      pending.delete(key);
      // A write captured for one person never lands under another (a persona switch within the 400 ms).
      if (actorId() !== ownerId) return;
      if (fields === null) void remove(meetingId, questionId);
      else void put(fields);
    }, BUFFER_DEBOUNCE_MS);
    pending.set(key, { timer, ownerId, meetingId, questionId, fields });
  }

  return {
    status: () => status,
    revision: () => rev,
    snapshotId: () => loads,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async load() {
      armed = true;
      const id = actorId();
      if (id === undefined || id === loadedFor) return;
      await loadFor(id);
    },
    entryFor(meetingId, questionId) {
      const id = owner();
      if (id === undefined) return undefined;
      const entry = snapshot.get(entryId(meetingId, id, questionId));
      if (entry === undefined) return undefined;
      if (now() - entry.changedAt >= BUFFER_LIFETIME_MS) {
        void remove(meetingId, questionId);
        return undefined;
      }
      return entry;
    },
    keptAt(meetingId, questionId) {
      const id = owner();
      return id === undefined ? undefined : kept.get(entryId(meetingId, id, questionId));
    },
    put,
    delete: remove,
    schedule: (fields) => later(fields, fields),
    scheduleDelete: (target) => later(target, null),
    async flush(meetingId, questionId) {
      const id = actorId();
      if (id === undefined) return undefined;
      const key = entryId(meetingId, id, questionId);
      const held = pending.get(key);
      if (held !== undefined) {
        cancelPending(key);
        if (held.fields === null) {
          await remove(meetingId, questionId);
          return undefined;
        }
        return put(held.fields);
      }
      return id === loadedFor && snapshot.has(key) ? kept.get(key) : undefined;
    },
    async clear() {
      for (const key of [...pending.keys()]) cancelPending(key);
      snapshot = new Map();
      kept.clear();
      roles = false;
      notify();
      try {
        await store.clear();
      } catch {
        switchOff();
      }
    },
    markRolesChanged() {
      roles = true;
    },
    rolesChanged: () => roles,
  };
}

/** The part of the session the wiring needs (`sessionAuth` in `index.ts`); absent in the demo. */
export interface SessionStateSource {
  getState(): { kind: string };
  subscribe(listener: () => void): () => void;
}

/**
 * Decision 4, the places that clear the buffer, as one testable function (`index.ts` calls it once): the state `noRole`
 * (read from the published session state, not from `onActorChange(undefined)`, which a 401 and sign-out send too), the
 * stream end `forbidden`; `roles_changed` only sets the marker. A 401, a session end and a lost network delete nothing.
 * `onStreamEnd` registers a hook with the HTTP adapter's stream end; `sessionAuth` is undefined in the demo.
 */
export function wireDraftBuffer({ buffer, sessionAuth, onStreamEnd }: {
  buffer: DraftBuffer;
  sessionAuth: SessionStateSource | undefined;
  onStreamEnd: (hook: (reason: string) => void) => void;
}): void {
  sessionAuth?.subscribe(() => {
    if (sessionAuth.getState().kind === 'noRole') void buffer.clear();
  });
  onStreamEnd((reason) => {
    if (reason === 'forbidden') void buffer.clear();
    else if (reason === 'roles_changed') buffer.markRolesChanged();
  });
}

/**
 * Clears the buffer, waiting at most `limitMs` (re-check minor 5): a hung or failing store never blocks what follows; the
 * next start cleans up through `purgeOthers` and expiry.
 */
export async function clearWithin(buffer: Pick<DraftBuffer, 'clear'>, limitMs = SIGN_OUT_CLEAR_LIMIT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<void>((resolve) => { timer = setTimeout(resolve, limitMs); });
  try {
    await Promise.race([buffer.clear().catch(() => undefined), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/** Decision 4, explicit sign-out: the buffer is cleared before the sign-out request is sent (at most 1 s). */
export async function clearBeforeSignOut(buffer: Pick<DraftBuffer, 'clear'>, signOut: () => Promise<void>): Promise<void> {
  await clearWithin(buffer);
  await signOut();
}

/** A view re-renders whenever the buffer changes (snapshot, kept times, status). */
export function useBufferRevision(buffer: Pick<DraftBuffer, 'subscribe' | 'revision'>): number {
  return useSyncExternalStore(buffer.subscribe, buffer.revision, buffer.revision);
}
