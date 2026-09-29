import { describe, expect, it } from 'vitest';
import { createInProcessApi } from '../api.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import type { Actor } from '../types.js';
import type { DomainEvent, NewEvent } from '../events.js';

const at = '2027-04-20T10:00:00.000Z';
const admin: Actor = { id: 'demo-admin', role: 'admin' };

function closed(id: string, extras: Record<string, unknown> = {}): NewEvent {
  return { id, type: 'QuestionClosed', at, actor: admin, subjectId: id, payload: {}, ...extras } as NewEvent;
}

describe('takt-028: envelope built from named fields (SC-07)', () => {
  it('rejects an unknown envelope field with a fixed error and appends nothing', () => {
    const store = createInMemoryEventStore();
    expect(() => store.append([closed('q1', { injected: 'x' })])).toThrow(/seq 1: unknown envelope field\.$/);
    expect(store.lastSeq()).toBe(0);
  });

  it('checks type and length of the optional envelope fields', () => {
    const store = createInMemoryEventStore();
    for (const extras of [
      { personId: 'p'.repeat(129) }, { causationId: 'c'.repeat(129) }, { idempotencyKey: '' },
      { idempotencyKey: 'k'.repeat(129) }, { commandId: 42 }, { commandOperation: 'o'.repeat(129) },
      { commandResource: 'r'.repeat(129) }, { personId: { id: 'x' } },
    ]) {
      expect(() => store.append([closed('q1', extras)]), JSON.stringify(extras).slice(0, 40)).toThrow(/seq 1: invalid optional envelope field\.$/);
    }
    expect(store.lastSeq()).toBe(0);
    expect(store.append([closed('q1', { personId: 'p'.repeat(128), idempotencyKey: 'k'.repeat(128) })])).toHaveLength(1);
  });
});

/** A store stub that serves hand-made events, so nested historical shapes can be read back. */
function stubStore(events: DomainEvent[]): EventStore & { emit(batch: DomainEvent[]): void } {
  const listeners = new Set<(batch: DomainEvent[]) => void>();
  return {
    append: () => { throw new Error('read only'); },
    readAfter: (seq, limit = 1000) => events.slice(seq, seq + limit),
    all: () => [],
    lastSeq: () => events.length,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    emit: (batch) => { for (const l of [...listeners]) l(batch); },
  };
}
const NAME = 'Klarname-Marker';
const nestedActor = { id: 'u1', role: 'legal', displayName: NAME, personId: 'person-marker' };
function raw(seq: number, type: string, payload: object): DomainEvent {
  return { seq, id: `e${seq}`, type, at, actor: { id: 'u', role: 'admin' }, subjectId: `s${seq}`, payload,
    schemaVersion: 2, meetingId: 'm', prevHash: '', hash: 'a'.repeat(64), recordedAt: at, occurredAt: at,
    occurredAtSource: 'server', retentionClass: 'working', legalHold: false } as unknown as DomainEvent;
}
function apiOver(store: EventStore) {
  return createInProcessApi({ store, actor: () => admin, clock: () => new Date(at) });
}

describe('takt-028: recursive masking (026)', () => {
  const shapes: Array<[string, object]> = [
    ['QuestionApproved', { answerVersion: 1, approvedBy: nestedActor, history: [{ by: nestedActor }] }],
    ['QuestionLegalCleared', { questionId: 'q', clearedBy: nestedActor, note: 'n' }],
    ['AnswerDrafted', { answer: { text: 't', createdBy: nestedActor, versions: [{ createdBy: nestedActor }] } }],
    ['SpeakerRegistered', { number: 1, round: 1, position: 1, deep: { organisation: NAME, list: [{ pii: { keyId: 'k', displayName: NAME } }] } }],
  ];
  for (const [type, payload] of shapes) {
    it(`removes nested names and personId from ${type} in listEvents`, async () => {
      const api = apiOver(stubStore([raw(1, type, payload)]));
      const text = JSON.stringify((await api.listEvents()).items);
      expect(text).not.toContain(NAME);
      expect(text).not.toContain('person-marker');
      expect(text).toContain('"redacted":true');
    });
  }

  it('removes nested names from events delivered to subscribers', () => {
    const store = stubStore([]);
    const seen: string[] = [];
    apiOver(store).subscribe((events) => seen.push(JSON.stringify(events)));
    store.emit([raw(1, 'QuestionApproved', { approvedBy: nestedActor })]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain(NAME);
  });

  it('turns a missing source hash into a defined integrity error; subscribers keep running', async () => {
    const { hash: _hash, ...noHash } = raw(7, 'QuestionClosed', {});
    const store = stubStore([noHash as DomainEvent]);
    const api = apiOver(store);
    await expect(api.listEvents()).rejects.toThrow(/^Event seq 7: integrity check failed \(source hash missing\)\.$/);
    const batches: number[] = [];
    api.subscribe((events) => batches.push(events.length));
    expect(() => store.emit([noHash as DomainEvent, raw(8, 'QuestionClosed', {})])).not.toThrow();
    expect(() => store.emit([raw(9, 'QuestionClosed', {})])).not.toThrow();
    expect(batches).toEqual([1, 1]);
  });
});
