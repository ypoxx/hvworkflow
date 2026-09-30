import { describe, expect, it } from 'vitest';
import type { DomainEvent, NewEvent } from '../events.js';
import { createInMemoryEventStore } from '../store.js';
import { isVerifiedLog, sealVerifiedLog, verifiedEventCount } from '../envelope.js';

const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'test-actor', role: 'admin' as const };

function closed(id: string): NewEvent {
  return { id, type: 'QuestionClosed', at, actor, subjectId: id, payload: { note: { nested: id } } } as unknown as NewEvent;
}

/** A plain, JSON-shaped copy: what a database row or a file would hand back. */
function plain(events: readonly DomainEvent[]): DomainEvent[] {
  return JSON.parse(JSON.stringify(events)) as DomainEvent[];
}

function source(count: number): DomainEvent[] {
  return plain(createInMemoryEventStore().append(Array.from({ length: count }, (_, index) => closed(`q${index + 1}`))));
}

/** Events hashed by `verifyEventChain` while `run` executes (public counter of the domain). */
function hashedDuring(run: () => unknown): number {
  const before = verifiedEventCount();
  run();
  return verifiedEventCount() - before;
}

describe('takt-033: sealed (verified) event logs', () => {
  it('verifies once when sealing and never again when a store loads the sealed log', () => {
    const events = source(5);
    let sealed: ReturnType<typeof sealVerifiedLog> | undefined;
    expect(hashedDuring(() => { sealed = sealVerifiedLog(undefined, events); })).toBe(5);
    expect(isVerifiedLog(sealed)).toBe(true);
    expect(Object.isFrozen(sealed)).toBe(true);
    for (const event of sealed!) {
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.actor)).toBe(true);
      expect(Object.isFrozen(event.payload)).toBe(true);
    }
    let store: ReturnType<typeof createInMemoryEventStore> | undefined;
    expect(hashedDuring(() => { store = createInMemoryEventStore({ load: () => sealed!, save: () => undefined }); })).toBe(0);
    expect(store!.lastSeq()).toBe(5);
    expect(store!.all().map((event) => event.hash)).toEqual(events.map((event) => event.hash));
  });

  it('extends a sealed prefix by hashing exactly the new suffix', () => {
    const events = source(6);
    const prefix = sealVerifiedLog(undefined, events.slice(0, 4));
    let extended: ReturnType<typeof sealVerifiedLog> | undefined;
    expect(hashedDuring(() => { extended = sealVerifiedLog(prefix, events.slice(4)); })).toBe(2);
    expect(extended!.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(isVerifiedLog(extended)).toBe(true);
    expect(prefix).toHaveLength(4);
    let empty: ReturnType<typeof sealVerifiedLog> | undefined;
    expect(hashedDuring(() => { empty = sealVerifiedLog(undefined, []); })).toBe(0);
    expect(isVerifiedLog(empty)).toBe(true);
    expect(sealVerifiedLog(empty, events.slice(0, 1))).toHaveLength(1);
  });

  it('verifies a copy of a sealed log, a plain array and throws on a tampered one', () => {
    const events = source(4);
    const sealed = sealVerifiedLog(undefined, events);
    expect(isVerifiedLog([...sealed])).toBe(false);
    expect(hashedDuring(() => createInMemoryEventStore({ load: () => [...sealed], save: () => undefined }))).toBe(4);
    expect(hashedDuring(() => createInMemoryEventStore({ load: () => plain(events), save: () => undefined }))).toBe(4);
    const tampered = plain(events);
    tampered[2] = { ...tampered[2]!, subjectId: 'changed' } as DomainEvent;
    expect(() => createInMemoryEventStore({ load: () => tampered, save: () => undefined })).toThrow(/seq 3/i);
  });

  it('refuses every write to a sealed log or its events', () => {
    'use strict';
    const sealed = sealVerifiedLog(undefined, source(2));
    const first = sealed[0]! as unknown as Record<string, unknown> & { payload: Record<string, unknown>; actor: Record<string, unknown> };
    expect(() => { first['subjectId'] = 'changed'; }).toThrow(TypeError);
    expect(() => { first.payload['note'] = 'changed'; }).toThrow(TypeError);
    expect(() => { (first.payload['note'] as Record<string, unknown>)['nested'] = 'changed'; }).toThrow(TypeError);
    expect(() => { first.actor['role'] = 'moderation'; }).toThrow(TypeError);
    expect(() => { delete first['hash']; }).toThrow(TypeError);
    expect(() => { (sealed as unknown as DomainEvent[]).push(sealed[0]!); }).toThrow(TypeError);
    expect(sealed[0]!.subjectId).toBe('q1');
    expect(sealed).toHaveLength(2);
  });

  it('freezes the children of an event the caller froze only shallowly', () => {
    const events = source(1);
    Object.freeze(events[0]);
    const sealed = sealVerifiedLog(undefined, events);
    expect(Object.isFrozen(sealed[0]!.payload)).toBe(true);
    expect(Object.isFrozen((sealed[0]!.payload as unknown as { note: object }).note)).toBe(true);
  });

  it('seals plain-data copies: accessors, symbols and non-enumerables cannot change after the check', () => {
    const events = source(2);
    let reads = 0;
    const tricky = { ...events[1]! } as Record<string | symbol, unknown>;
    const realSubject = tricky['subjectId'];
    Object.defineProperty(tricky, 'subjectId', { enumerable: true, get: () => (++reads === 1 ? realSubject : 'changed') });
    Object.defineProperty(tricky, 'hidden', { enumerable: false, value: 'not copied' });
    tricky[Symbol('extra')] = 'not copied';
    const sealed = sealVerifiedLog(undefined, [events[0]!, tricky as unknown as DomainEvent]);
    expect(sealed[1]!.subjectId).toBe(realSubject);
    expect(sealed[1]!.subjectId).toBe(realSubject);
    expect(Object.getOwnPropertyDescriptor(sealed[1], 'subjectId')).toMatchObject({ value: realSubject, writable: false });
    expect(Object.hasOwn(sealed[1]!, 'hidden')).toBe(false);
    expect(Object.getOwnPropertySymbols(sealed[1])).toEqual([]);
    // The caller's objects are copied, not frozen.
    expect(Object.isFrozen(events[0])).toBe(false);
    expect(sealed[0]).not.toBe(events[0]);
    expect(() => sealVerifiedLog(undefined, [new Proxy(events[0]!, {})])).toThrow();
  });

  it('keeps the sealed log unchanged when a store built on it appends', () => {
    const sealed = sealVerifiedLog(undefined, source(2));
    const saved: DomainEvent[][] = [];
    const store = createInMemoryEventStore({ load: () => sealed, save: (all) => { saved.push([...all]); } });
    store.append([closed('q3')]);
    expect(store.lastSeq()).toBe(3);
    expect(sealed).toHaveLength(2);
    expect(saved[0]!.map((event) => event.seq)).toEqual([1, 2, 3]);
  });

  it('throws on a suffix that breaks the chain and registers nothing', () => {
    const events = source(5);
    const prefix = sealVerifiedLog(undefined, events.slice(0, 3));
    const broken = [events[3]!, { ...events[4]!, prevHash: '0'.repeat(64) } as DomainEvent];
    const captured: unknown[] = [];
    expect(() => captured.push(sealVerifiedLog(prefix, broken))).toThrow(/seq 5/i);
    expect(() => captured.push(sealVerifiedLog(prefix, events.slice(4)))).toThrow(/seq 4/i);
    expect(() => captured.push(sealVerifiedLog(undefined, events.slice(1)))).toThrow(/seq 1/i);
    expect(captured).toEqual([]);
    expect(isVerifiedLog(broken)).toBe(false);
    expect(isVerifiedLog(prefix)).toBe(true);
    // A failed seal leaves the prefix usable and unchanged.
    expect(sealVerifiedLog(prefix, events.slice(3))).toHaveLength(5);
  });

  it('accepts only a sealed prefix, never a plain array posing as one', () => {
    const events = source(3);
    expect(() => sealVerifiedLog(events.slice(0, 2) as never, events.slice(2))).toThrow();
    const sealed = sealVerifiedLog(undefined, events.slice(0, 2));
    expect(() => sealVerifiedLog([...sealed] as never, events.slice(2))).toThrow();
  });
});
