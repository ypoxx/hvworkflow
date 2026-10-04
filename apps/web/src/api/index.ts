/**
 * The interface's only door to the application core. `api` implements the contract (`HvApi`).
 *
 * Demo mode (ADR 0002) runs the domain in-process. HTTP mode supplies the same port from the
 * session-bound server, without loading the demo store or a demo actor.
 */
import {
  CORPUS_DEMO,
  createInMemoryEventStore,
  createInProcessApi,
  isLegacyEventShape,
  seedEvents,
  type Actor,
  type DomainEvent,
  type HvApi,
  type EventStore,
} from '@hv/domain';
import { getActor, setActor, setSessionActor, DEMO_ACTORS, DEMO_BINDINGS } from './actor';
import { createSessionAuth } from './auth';
import { connection } from './connection';
import { createHttpApi, followSessionActor, getHttpSession, logoutHttpSession, type HttpApi } from './http';
import { actorKey, createLiveStore, type LiveStore } from './liveStore';
import { DEMO_MODE } from './mode';
import { getLang } from '../i18n';

const STORAGE_KEY = 'hv-demo-events-v1';

export class LegacyDemoLogError extends Error {
  constructor() { super('Legacy demo event log requires an explicit reset.'); }
}

/** The stored demo log is not JSON; the boot screen shows a translated fixed text (R10). */
export class DemoLogParseError extends Error {
  constructor() { super('Demo event log is not valid JSON.'); }
}

/** Parse the stored demo log; a syntax error never repeats the raw text (SC-11). */
export function parseDemoLog(raw: string): DomainEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new DemoLogParseError();
  }
  if (!Array.isArray(parsed)) throw new Error('Demo event log is not an array.');
  if (parsed.length > 0 && parsed.every(isLegacyEventShape)) {
    throw new LegacyDemoLogError();
  }
  return parsed as DomainEvent[];
}
function loadLog(): DomainEvent[] | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === null ? undefined : parseDemoLog(raw);
}
let saveTimer: number | undefined;
function saveLog(events: readonly DomainEvent[]): void {
  // Debounced: a burst of events (seed, atomisation) is written once.
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn('Could not persist the demo event log', e);
    }
  }, 150);
}

let startupError: Error | undefined;
let store: EventStore | undefined;
if (DEMO_MODE) {
  try {
    store = createInMemoryEventStore({ load: loadLog, save: saveLog });
  } catch (error) {
    startupError = error instanceof Error ? error : new Error(String(error));
    store = createInMemoryEventStore();
  }
}

/** Set right below; the adapters' callbacks only run after start-up. */
let liveStore: LiveStore | undefined;
/** The HTTP adapter with its stream (slice 036b); absent in the demo, which has no stream (ADR 0002). */
let httpAdapter: HttpApi | undefined;

/** Slice 036b: opens, closes and (on a structurally other actor) restarts the stream; set once the adapter exists. */
let followActor: ((actor: Actor | undefined) => void) | undefined;
/** The session actor as seen last, for the structural comparison on a session refresh (takt-033b). */
let sessionActorKey: string | undefined;
export const sessionAuth = DEMO_MODE ? undefined : createSessionAuth({
  readSession: getHttpSession,
  // Slice 036b: only an explicit sign-out (or a 401) lets the reconnect limit of the tab start afresh.
  signOut: async (csrfToken) => {
    await logoutHttpSession(csrfToken);
    httpAdapter?.resetStreamLimits();
  },
  onActorChange: (actor) => {
    // Slice 036a, Entscheidung 8: a structurally other actor or none (sign-out, 401) empties the live store before
    // any view learns of the new actor. An equal actor object from a refresh keeps it.
    const next = actor === undefined ? undefined : actorKey(actor);
    if (next !== sessionActorKey) liveStore?.clear(actor === undefined ? 'logout' : 'actor');
    sessionActorKey = next;
    setSessionActor(actor);
    // Slice 036b (N5): every confirmed `/auth/me` asks for the stream, before the shell mounts the views; an open stream
    // or a pending retry stays as it is, a structurally other actor restarts it. Without an actor the stream closes.
    followActor?.(actor);
  },
});

httpAdapter = DEMO_MODE ? undefined : createHttpApi({
  getCsrfToken: () => sessionAuth?.getCsrfToken(),
  onUnauthorized: () => {
    liveStore?.clear('unauthorized');
    sessionAuth?.onUnauthorized();
  },
  onWriteSettled: (outcome) => liveStore?.onWriteSettled(outcome),
  onStreamMessage: (events, change) => {
    if (change === undefined) liveStore?.onStreamMessage(events);
    else liveStore?.onStreamMessage(events, change);
  },
  // Slice 036b: a loss of session or rights empties the buffer at once (036a decision 8); the session is read again,
  // and only its confirmation (`onActorChange(actor)` above) opens a new stream. A 401 goes on to `onUnauthorized`.
  onStreamEnd: (reason) => {
    liveStore?.clear(reason);
    if (reason !== 'unauthorized') sessionAuth?.refresh().catch(() => undefined);
  },
  connection,
  locale: getLang,
});
followActor = httpAdapter === undefined ? undefined : followSessionActor(httpAdapter);
const adapter: HvApi = httpAdapter
  ?? createInProcessApi({ store: store!, actor: getActor, clock: () => new Date(), seeder: seedEvents });

/**
 * Slice 036a: the live store over either adapter. The demo adapter has no write hook, so the store watches its writes;
 * the role switcher is noticed structurally on the next read or answer. The browser's wall clock compares claim ends,
 * `performance.now()` measures the maximum age of entries (monotonic, unaffected by a clock set back).
 */
liveStore = createLiveStore(adapter, {
  getActor,
  now: () => new Date().getTime(),
  monotonic: () => performance.now(),
  observeWrites: DEMO_MODE,
});
export const api: HvApi = liveStore;

/** Whether the demo corpus is loaded. The shell seeds on first start. */
export function isSeeded(): boolean {
  return store?.lastSeq() !== undefined && store.lastSeq() > 0;
}

/**
 * Seed the synthetic corpus once. Seeding needs `demo.seed`, which only the administration persona
 * holds; the current persona is restored afterwards so the demo starts in the chosen role.
 */
export async function seedIfEmpty(): Promise<void> {
  if (!DEMO_MODE) return;
  if (startupError) throw startupError;
  const seeded = isSeeded();
  const before = getActor();
  const admin = DEMO_ACTORS.find((a) => a.id === 'u-admin')!;
  setActor(admin);
  try {
    if (!seeded) {
      await api.seedDemo({ questions: CORPUS_DEMO.questions, roundSizes: CORPUS_DEMO.roundSizes, seed: CORPUS_DEMO.seed });
    }
    await bindDemoActors();
  } finally {
    setActor(before);
  }
}

/**
 * Scheibe 054 (decision 2a): write the demo's role assignments (`DEMO_BINDINGS`) as the administration, on a fresh seed
 * and on the start of a log seeded before 054. A 409 means "already bound" and is passed over; any other refusal does
 * not block the start — the persona then stays unbound, and a fixed message (without content) says so.
 */
async function bindDemoActors(): Promise<void> {
  for (const binding of DEMO_BINDINGS) {
    try {
      await api.assignRole(binding);
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status: unknown }).status : undefined;
      if (status !== 409) console.warn('Demo role binding could not be written; the persona stays unbound.');
    }
  }
}

/** Wipe this device's demo data and reload with a fresh corpus. */
export function resetDemo(): void {
  if (!DEMO_MODE) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/** Subscribe to new events — the in-process equivalent of the realtime channel. */
export function subscribeToChanges(listener: (events: DomainEvent[]) => void): () => void {
  return api.subscribe(listener);
}

export { DEMO_MODE } from './mode';
