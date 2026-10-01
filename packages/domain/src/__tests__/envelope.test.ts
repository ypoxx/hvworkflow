import { describe, expect, it, vi } from 'vitest';
import type { DomainEvent, NewEvent } from '../events.js';
import { createInMemoryEventStore } from '../store.js';
import { canonicalJson, upcastJsonlEvents, verifyEventChain } from '../envelope.js';
import type { PiiCodec } from '../piiCodec.js';
import { createInProcessApi, etagOf } from '../api.js';
import { seedEvents } from '../seed.js';
import type { Actor } from '../types.js';

const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'test-actor', role: 'admin' as const, displayName: 'Must not enter the envelope' };

function closed(id: string, extras: Record<string, unknown> = {}): NewEvent {
  return {
    id,
    type: 'QuestionClosed',
    at,
    actor,
    subjectId: id,
    payload: {},
    ...extras,
  } as NewEvent;
}

describe('slice 024: event envelope v2', () => {
  it('sorts nested Unicode keys, removes undefined properties and preserves array order', () => {
    expect(canonicalJson({ z: [{ b: 2, a: 'ä', omitted: undefined }, 3], a: '🔒' }))
      .toBe('{"a":"🔒","z":[{"a":"ä","b":2},3]}');
  });
  it('stamps a portable hash chain with server time and no actor display name', () => {
    const store = createInMemoryEventStore();
    const events = store.append([closed('q1'), closed('q2')]);
    const first = events[0]!;
    const second = events[1]!;
    expect(first).toMatchObject({ seq: 1, schemaVersion: 2, prevHash: '', at, recordedAt: at, occurredAt: at, occurredAtSource: 'server', legalHold: false });
    expect(createInMemoryEventStore().append([closed('q1')])[0]?.hash).toBe(first.hash);
    expect(second).toMatchObject({ seq: 2, schemaVersion: 2, prevHash: (first as DomainEvent & { hash: string }).hash });
    for (const event of [first, second]) {
      expect(event.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(event.actor).not.toHaveProperty('displayName');
    }
  });

  it('keeps a device time separate from recordedAt and rejects a future occurrence', () => {
    const store = createInMemoryEventStore();
    const event = store.append([closed('q1', { occurredAt: '2027-04-20T09:00:00.000Z', occurredAtSource: 'device' })])[0]!;
    expect(event).toMatchObject({ recordedAt: at, occurredAt: '2027-04-20T09:00:00.000Z', occurredAtSource: 'device' });
    expect(() => store.append([closed('q2', { occurredAt: '2027-04-20T11:00:00.000Z', occurredAtSource: 'device' })])).toThrow();
    expect(store.lastSeq()).toBe(1);
  });

  it('rejects a mutated persisted event before making it available, naming its seq', () => {
    const original = createInMemoryEventStore();
    const events = original.append([closed('q1'), closed('q2')]);
    const tampered = events.map((event) => ({ ...event }));
    tampered[1] = { ...tampered[1]!, subjectId: 'changed' } as DomainEvent;
    expect(() => createInMemoryEventStore({ load: () => tampered, save: () => undefined })).toThrow(/(?:seq|sequence).*2/i);
  });

  it('rejects gaps, swapped events, broken predecessors and invalid times at first affected seq', () => {
    const events = createInMemoryEventStore().append([closed('q1'), closed('q2'), closed('q3')]);
    const load = (items: DomainEvent[]) => createInMemoryEventStore({ load: () => items, save: () => undefined });
    expect(() => load([events[0]!, events[2]!])).toThrow(/seq 2/i);
    expect(() => load([events[1]!, events[0]!])).toThrow(/seq 1/i);
    expect(() => load([events[0]!, { ...events[1]!, prevHash: '0'.repeat(64) }])).toThrow(/seq 2/i);
    expect(() => load([{ ...events[0]!, occurredAt: '2027-04-20T11:00:00.000Z' }])).toThrow(/seq 1/i);
    const { occurredAtSource: _source, ...missingSource } = events[0]!;
    const { retentionClass: _retention, ...missingRetention } = events[0]!;
    expect(() => load([missingSource as DomainEvent])).toThrow(/seq 1/i);
    expect(() => load([missingRetention as DomainEvent])).toThrow(/seq 1/i);
  });

  it('rejects an unknown retention class before appending', () => {
    const store = createInMemoryEventStore();
    expect(() => store.append([closed('q1', { retentionClass: 'forever' })])).toThrow(/seq 1/i);
    expect(store.lastSeq()).toBe(0);
  });

  it('encodes only payload.pii, retaining its year-specific keyId', () => {
    const codec: PiiCodec = { encode: vi.fn((_meetingId, value) => ({ ...value, encoded: true })), decode: vi.fn((_meetingId, value) => value) };
    const event = createInMemoryEventStore(undefined, codec).append([closed('q1', {
      meetingId: 'meeting-2027', payload: { pii: { keyId: '2027:key-1', secret: 'sample' }, plain: 'kept' },
    })])[0]!;
    expect(event.payload).toEqual({ pii: { keyId: '2027:key-1', secret: 'sample', encoded: true }, plain: 'kept' });
    expect(codec.encode).toHaveBeenCalledWith('meeting-2027', { keyId: '2027:key-1', secret: 'sample' });
  });

  it('normalizes a v1 JSONL prefix deterministically and checks a following v2 suffix', () => {
    const first = { ...closed('q1'), seq: 1 } as DomainEvent;
    const normalized = upcastJsonlEvents([first]);
    expect(upcastJsonlEvents([first])).toEqual(normalized);
    const suffix = createInMemoryEventStore({ load: () => normalized, save: () => undefined }).append([closed('q2')])[0]!;
    expect(upcastJsonlEvents([first, suffix])).toEqual([...normalized, suffix]);
    expect(normalized.every((event) => event.schemaVersion === 2 && typeof event.meetingId === 'string' && event.meetingId.length > 0)).toBe(true);
    expect(() => upcastJsonlEvents([first, suffix, { ...closed('q3'), seq: 3 } as DomainEvent])).toThrow(/seq 3/i);
  });

  it('accepts only a complete legacy prefix and never rehashes altered v2 versions', () => {
    const legacy = { ...closed('q1'), seq: 1 } as DomainEvent;
    expect(upcastJsonlEvents([legacy])[0]).toMatchObject({ schemaVersion: 2, seq: 1 });
    expect(upcastJsonlEvents([{ ...legacy, schemaVersion: 1 as 2 }])[0]).toEqual(upcastJsonlEvents([legacy])[0]);
    const v2 = createInMemoryEventStore().append([closed('q1')])[0]!;
    for (const schemaVersion of [undefined, 1, 3, '2']) {
      const altered = { ...v2, schemaVersion } as DomainEvent;
      expect(() => upcastJsonlEvents([altered])).toThrow(/seq 1/i);
    }
    const { schemaVersion: _version, hash: _hash, ...halfEnvelope } = v2;
    expect(() => upcastJsonlEvents([halfEnvelope as DomainEvent])).toThrow(/seq 1/i);
  });

  it('carries the write idempotency key into the event and uses only the injected clock', async () => {
    const store = createInMemoryEventStore();
    // Scheibe 040a: the administration seeds (demo.seed); the speaker request is moderation's write.
    let who: Actor = { id: 'tester', role: 'admin' };
    const api = createInProcessApi({ store, actor: () => who,
      clock: () => new Date(at), seeder: seedEvents });
    await api.seedDemo({ questions: 0, roundSizes: [0] });
    who = { id: 'tester', role: 'moderation' };
    await api.registerSpeaker({ displayName: 'Demo' }, { idempotencyKey: 'x', ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
    const event = store.all().at(-1)!;
    expect(event).toMatchObject({ type: 'SpeakerRegistered', idempotencyKey: 'x', recordedAt: at });
  });
});

describe('takt-033: verifyEventChain from a start point', () => {
  const chain = () => createInMemoryEventStore().append([closed('q1'), closed('q2'), closed('q3'), closed('q4')]);

  it('keeps the default start (seq 0, empty predecessor) for a whole log', () => {
    const events = chain();
    expect(() => verifyEventChain(events)).not.toThrow();
    expect(() => verifyEventChain(events, { seq: 0, prevHash: '' })).not.toThrow();
    expect(() => verifyEventChain(events.slice(1))).toThrow(/seq 1/i);
  });

  it('accepts the correct suffix after a verified prefix', () => {
    const events = chain();
    expect(() => verifyEventChain(events.slice(2), { seq: 2, prevHash: events[1]!.hash! })).not.toThrow();
    expect(() => verifyEventChain([], { seq: 4, prevHash: events[3]!.hash! })).not.toThrow();
  });

  it('rejects a wrong first seq or a wrong predecessor, naming the seq', () => {
    const events = chain();
    expect(() => verifyEventChain(events.slice(2), { seq: 3, prevHash: events[1]!.hash! })).toThrow(/seq 4/i);
    expect(() => verifyEventChain(events.slice(2), { seq: 1, prevHash: events[1]!.hash! })).toThrow(/seq 2/i);
    expect(() => verifyEventChain(events.slice(2), { seq: 2, prevHash: events[0]!.hash! })).toThrow(/seq 3/i);
    expect(() => verifyEventChain(events.slice(2), { seq: 2, prevHash: '' })).toThrow(/seq 3/i);
    const tampered = [events[2]!, { ...events[3]!, subjectId: 'changed' } as DomainEvent];
    expect(() => verifyEventChain(tampered, { seq: 2, prevHash: events[1]!.hash! })).toThrow(/seq 4/i);
  });
});
