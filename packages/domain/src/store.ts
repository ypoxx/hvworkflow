/**
 * Append-only event store port with an in-memory implementation.
 * `persist` lets an adapter (localStorage in the browser, a file or Postgres on the server) save the
 * log after every append and load it at start. The store never mutates or deletes an event.
 */
import type { DomainEvent, NewEvent } from './events.js';
import { stampEvent, verifyEventChain } from './envelope.js';
import { identityPiiCodec, type PiiCodec } from './piiCodec.js';
import { project } from './state.js';

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

export function createInMemoryEventStore(persistence?: Persistence, codec: PiiCodec = identityPiiCodec): EventStore {
  const log: DomainEvent[] = [...(persistence?.load() ?? [])];
  verifyEventChain(log);
  const listeners = new Set<(events: DomainEvent[]) => void>();

  return {
    append(events) {
      // Reject a duplicate meeting before persistence or listener notification. The projection
      // checks R-MTG-01 too, but a listener exception after append would leave a poisoned log.
      const knownMeetings = new Set(log.filter((e) => e.type === 'MeetingCreated').map((e) => e.subjectId));
      for (const event of events) {
        if (event.type !== 'MeetingCreated') continue;
        if (knownMeetings.has(event.subjectId)) throw new Error('R-MTG-01: meeting already exists.');
        knownMeetings.add(event.subjectId);
      }
      const appended: DomainEvent[] = [];
      let meetingId: string | undefined;
      for (let index = log.length - 1; index >= 0; index--) {
        if (log[index]?.type === 'MeetingCreated') {
          meetingId = log[index]!.subjectId;
          break;
        }
      }
      for (const e of events) {
        const withSeq = stampEvent(e, log.length + appended.length + 1, appended.at(-1)?.hash ?? log.at(-1)?.hash ?? '', meetingId, codec);
        appended.push(withSeq);
        if (withSeq.type === 'MeetingCreated') meetingId = withSeq.subjectId;
      }
      // Validate lifecycle and agenda facts before saving. A projection listener may reject a
      // transition, but by then the append would already have persisted a bad event.
      const progressTypes = new Set(['MeetingStarted', 'MeetingClosed', 'AgendaItemOpened', 'VotingOpened', 'VotingClosed']);
      const changedMeetings = new Set(appended.filter((e) => progressTypes.has(e.type)).map((e) => e.meetingId));
      for (const id of changedMeetings) {
        if (!id) throw new Error('R-MTG-02: lifecycle event requires a meeting.');
        project([...log, ...appended].filter((e) => e.meetingId === id));
      }
      persistence?.save([...log, ...appended]);
      log.push(...appended);
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
