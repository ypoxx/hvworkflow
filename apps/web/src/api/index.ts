/**
 * The interface's only door to the application core. `api` implements the contract (`HvApi`).
 *
 * Demo mode (ADR 0002): the domain runs in-process in the browser, the event log lives in
 * localStorage of this device. Switching to the HTTP server later means replacing this file's
 * `createInProcessApi` with an HTTP client that implements the same `HvApi` — nothing else changes.
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
import { getActor, setActor, DEMO_ACTORS } from './actor';

const STORAGE_KEY = 'hv-demo-events-v1';

export class LegacyDemoLogError extends Error {
  constructor() { super('Legacy demo event log requires an explicit reset.'); }
}

function loadLog(): DomainEvent[] | undefined {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Demo event log is not an array.');
  if (parsed.length > 0 && parsed.every(isLegacyEventShape)) {
    throw new LegacyDemoLogError();
  }
  return parsed as DomainEvent[];
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
let store: EventStore;
try {
  store = createInMemoryEventStore({ load: loadLog, save: saveLog });
} catch (error) {
  startupError = error instanceof Error ? error : new Error(String(error));
  store = createInMemoryEventStore();
}

export const api: HvApi = createInProcessApi({
  store,
  actor: getActor,
  clock: () => new Date(),
  seeder: seedEvents,
});

/** Whether the demo corpus is loaded. The shell seeds on first start. */
export function isSeeded(): boolean {
  return store.lastSeq() > 0;
}

/**
 * Seed the synthetic corpus once. Seeding needs `demo.seed`, which only the administration persona
 * holds; the current persona is restored afterwards so the demo starts in the chosen role.
 */
export async function seedIfEmpty(): Promise<void> {
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

export const DEMO_MODE = true;
