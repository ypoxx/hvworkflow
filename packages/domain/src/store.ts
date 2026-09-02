/**
 * Append-only event store port with an in-memory implementation.
 * `persist` lets an adapter (localStorage in the browser, a file or Postgres on the server) save the
 * log after every append and load it at start. The store never mutates or deletes an event.
 */
import type { DomainEvent, NewEvent } from './events.js';

export interface EventStore {
  append(events: NewEvent[]): DomainEvent[];
  readAfter(seq: number, limit?: number): DomainEvent[];
  all(): readonly DomainEvent[];
  lastSeq(): number;
  /** Subscribe to new events (in-process realtime; the HTTP adapter uses SSE or polling). */
  subscribe(listener: (events: DomainEvent[]) => void): () => void;
}

export interface Persistence {
  load(): DomainEvent[] | undefined;
  save(events: readonly DomainEvent[]): void;
}

export function createInMemoryEventStore(persistence?: Persistence): EventStore {
  const log: DomainEvent[] = persistence?.load() ?? [];
  const listeners = new Set<(events: DomainEvent[]) => void>();

  return {
    append(events) {
      const appended: DomainEvent[] = [];
      for (const e of events) {
        const withSeq = { ...e, seq: log.length + 1 } as DomainEvent;
        log.push(withSeq);
        appended.push(withSeq);
      }
      persistence?.save(log);
      for (const l of listeners) l(appended);
      return appended;
    },
    readAfter(seq, limit = 1000) {
      return log.slice(seq, seq + limit);
    },
    all() {
      return log;
    },
    lastSeq() {
      return log.length;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
