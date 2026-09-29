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
  type DomainEvent,
  type HvApi,
  type EventStore,
} from '@hv/domain';
import { getActor, setActor, setSessionActor, DEMO_ACTORS } from './actor';
import { createSessionAuth } from './auth';
import { createHttpApi, getHttpSession, logoutHttpSession } from './http';
import { DEMO_MODE } from './mode';
import { getLang } from '../i18n';

const STORAGE_KEY = 'hv-demo-events-v1';

export class LegacyDemoLogError extends Error {
  constructor() { super('Legacy demo event log requires an explicit reset.'); }
}

/** Parse the stored demo log; a syntax error never repeats the raw text (SC-11). */
export function parseDemoLog(raw: string): DomainEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Demo event log is not valid JSON.');
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

export const sessionAuth = DEMO_MODE ? undefined : createSessionAuth({
  readSession: getHttpSession,
  signOut: logoutHttpSession,
  onActorChange: setSessionActor,
});

export const api: HvApi = DEMO_MODE
  ? createInProcessApi({ store: store!, actor: getActor, clock: () => new Date(), seeder: seedEvents })
  : createHttpApi({
    getCsrfToken: () => sessionAuth?.getCsrfToken(),
    onUnauthorized: () => sessionAuth?.onUnauthorized(),
    locale: getLang,
  });

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
  if (isSeeded()) return;
  const before = getActor();
  const admin = DEMO_ACTORS.find((a) => a.id === 'u-admin')!;
  setActor(admin);
  try {
    await api.seedDemo({ questions: CORPUS_DEMO.questions, roundSizes: CORPUS_DEMO.roundSizes, seed: CORPUS_DEMO.seed });
  } finally {
    setActor(before);
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
