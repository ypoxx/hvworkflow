/**
 * Scheibe 061, part A (web adapter), test L1: the control desk read (`getCockpit`) passes the live store
 * unbuffered. Its value ages without an event (every age moves with the service clock), so a buffered
 * answer would show stale minutes for up to 30 s; the store hands every call to the adapter.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Actor, Cockpit, HvApi } from '@hv/domain';
import { createLiveStore, READ_TOPICS } from './liveStore';

const reader: Actor = { id: 'coord-061', role: 'coordination' };

/** `getCockpit` is no key of READ_TOPICS: a type-level check that fails to compile if it ever becomes one. */
type NotBuffered = 'getCockpit' extends keyof typeof READ_TOPICS ? never : true;
const notBuffered: NotBuffered = true;

function answer(n: number): Cockpit {
  return {
    meetingId: 'hv-2031', asOf: `2031-05-06T12:00:0${n}.000Z`, meetingStatus: 'running',
    totals: { captured: n, open: n, staged: 0, answered: 0 },
    openByStatus: { captured: n, classified: 0, assigned: 0, answer_drafted: 0, in_review: 0, approved: 0, staged: 0 },
    openByUnit: {}, openUnassigned: n, oldestOpen: { ageSeconds: n, items: [] },
    inflow: { binSeconds: 300, bins: Array.from({ length: 12 }, () => 0), last5m: 0 },
    legalReview: { over10m: 0, items: [] },
  };
}

describe('L1 getCockpit passes the live store unbuffered', () => {
  it('exists, calls the adapter on every call and returns its answer unchanged', async () => {
    let n = 0;
    const getCockpit = vi.fn(async () => answer(++n));
    const adapter = { getCockpit, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    const store = createLiveStore(adapter, { getActor: () => reader, now: () => 0, monotonic: () => 0 });
    store.subscribe(() => undefined); // a listening store would buffer a buffered read
    expect(typeof store.getCockpit).toBe('function');
    const first = await store.getCockpit();
    const second = await store.getCockpit();
    expect(getCockpit).toHaveBeenCalledTimes(2);
    expect(first).toEqual(answer(1));
    expect(second).toEqual(answer(2));
    expect(Object.keys(READ_TOPICS)).not.toContain('getCockpit');
    expect(notBuffered).toBe(true);
  });
});

describe('L1b getCockpit is withheld after an actor change (Codex P1 on #168)', () => {
  it('an answer requested before clear() never reaches the caller, and a new request after it does', async () => {
    let release: (value: Cockpit) => void = () => undefined;
    const getCockpit = vi
      .fn<() => Promise<Cockpit>>()
      .mockImplementationOnce(() => new Promise<Cockpit>((resolve) => { release = resolve; }))
      .mockImplementation(async () => answer(2));
    const adapter = { getCockpit, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    let settled = false;
    void store.getCockpit().then(() => { settled = true; }, () => { settled = true; });
    actor = { id: 'other-061', role: 'coordination' };
    store.clear('actor');
    release(answer(1));
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(settled).toBe(false);
    await expect(store.getCockpit()).resolves.toEqual(answer(2));
  });
});

describe('takt-056 listEvents is withheld after an actor change (Codex P1 on #176)', () => {
  it('an event page requested before clear() never reaches the caller, and a page read after it does', async () => {
    const page = (n: number) => ({ items: [], lastSeq: n });
    let release: (value: ReturnType<typeof page>) => void = () => undefined;
    const listEvents = vi
      .fn<(after?: number, limit?: number) => Promise<ReturnType<typeof page>>>()
      .mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }))
      .mockImplementation(async () => page(2));
    const adapter = { listEvents, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    let settled = false;
    void store.listEvents(0, 50).then(() => { settled = true; }, () => { settled = true; });
    actor = { id: 'other-056', role: 'coordination' };
    store.clear('actor');
    release(page(1));
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(settled).toBe(false);
    await expect(store.listEvents(0, 50)).resolves.toEqual(page(2));
  });
});

/**
 * takt-057: the remaining pass-throughs of the live store under the actor protection (T-G1-I-09). A write, `seedDemo`
 * and `lastWriteEtag` began for one person must not hand their content to the next; the invalidation signal of a write
 * stays. Each case first failed against the store of takt-056.
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};
function tracked(promise: Promise<unknown>): { settled: () => boolean } {
  let settled = false;
  void promise.then(() => { settled = true; }, () => { settled = true; });
  return { settled: () => settled };
}

describe('takt-057 writes are withheld after an actor change', () => {
  it('a write answered after clear() never reaches the caller, and its invalidation still runs (observeWrites)', async () => {
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    let n = 0;
    const listQuestions = vi.fn(async () => ({ items: [], total: ++n }));
    const adapter = {
      closeQuestion, listQuestions, subscribe: () => () => undefined, lastWriteEtag: () => undefined,
    } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0, observeWrites: true });
    const heard = vi.fn();
    store.subscribe(heard);
    const write = tracked(store.closeQuestion('q-1', { reason: 'answered' } as never));
    actor = { id: 'other-057', role: 'coordination' };
    store.clear('actor');
    await store.listQuestions(); // buffered for the new person
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(1);
    release({ id: 'q-1', _actions: ['close'] });
    await flush();
    expect(write.settled()).toBe(false);
    // settleWrite('success') ran anyway: the buffer is empty and the listeners heard it.
    expect(heard).toHaveBeenCalledTimes(1);
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(2);
  });

  it('a failed write after clear() is not delivered either, and still empties the buffer (observeWrites)', async () => {
    let fail: (error: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(() => new Promise((_resolve, reject) => { fail = reject; }));
    const listQuestions = vi.fn(async () => ({ items: [], total: 0 }));
    const adapter = {
      closeQuestion, listQuestions, subscribe: () => () => undefined, lastWriteEtag: () => undefined,
    } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0, observeWrites: true });
    store.subscribe(() => undefined);
    const write = tracked(store.closeQuestion('q-1', {} as never));
    actor = { id: 'other-057', role: 'coordination' };
    store.clear('actor');
    await store.listQuestions();
    fail(new Error('412'));
    await flush();
    expect(write.settled()).toBe(false);
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(2);
  });

  it('for the same person a write answer and a write failure are delivered unchanged', async () => {
    const closeQuestion = vi
      .fn()
      .mockImplementationOnce(async () => ({ id: 'q-1' }))
      .mockImplementationOnce(async () => { throw new Error('409'); });
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    const store = createLiveStore(adapter, { getActor: () => reader, now: () => 0, monotonic: () => 0 });
    await expect(store.closeQuestion('q-1', {} as never)).resolves.toEqual({ id: 'q-1' });
    await expect(store.closeQuestion('q-1', {} as never)).rejects.toThrow('409');
  });

  it('an actor change without clear() (only getActor() returns another person) withholds a running write', async () => {
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    const write = tracked(store.closeQuestion('q-1', {} as never));
    actor = { ...reader, role: 'moderation' }; // same id, other rights
    release({ id: 'q-1', _actions: ['close'] });
    await flush();
    expect(write.settled()).toBe(false);
  });

  it('seedDemo answered after clear() never reaches the caller', async () => {
    let release: (value: unknown) => void = () => undefined;
    const seedDemo = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const adapter = { seedDemo, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    const seeded = tracked(store.seedDemo());
    actor = { id: 'other-057', role: 'admin' };
    store.clear('actor');
    release({ questions: 3 });
    await flush();
    expect(seeded.settled()).toBe(false);
  });
});

describe('takt-057 lastWriteEtag belongs to the person who wrote', () => {
  function setupEtag() {
    const etag = '"v7"';
    const closeQuestion = vi.fn(async () => ({ id: 'q-1' }));
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => etag } as unknown as HvApi;
    const box: { actor: Actor } = { actor: reader };
    const store = createLiveStore(adapter, { getActor: () => box.actor, now: () => 0, monotonic: () => 0 });
    return { store, box, etag };
  }

  it('returns the adapter value after an own write, and undefined after clear()', async () => {
    const { store, etag } = setupEtag();
    await store.closeQuestion('q-1', {} as never);
    expect(store.lastWriteEtag()).toBe(etag);
    store.clear('logout');
    expect(store.lastWriteEtag()).toBeUndefined();
  });

  it('is undefined after an actor change without clear(), and the next own write brings it back', async () => {
    const { store, box, etag } = setupEtag();
    await store.closeQuestion('q-1', {} as never);
    expect(store.lastWriteEtag()).toBe(etag);
    box.actor = { ...reader, unitId: 'u-fin' };
    expect(store.lastWriteEtag()).toBeUndefined();
    await store.closeQuestion('q-1', {} as never);
    expect(store.lastWriteEtag()).toBe(etag);
  });
});

describe('takt-057 guarded() reads: failures and the signed-out path', () => {
  it('a rejection is delivered to the same person and withheld after a change', async () => {
    let fail: (error: unknown) => void = () => undefined;
    const listEvents = vi
      .fn()
      .mockImplementationOnce(async () => { throw new Error('500'); })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
    const adapter = { listEvents, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    await expect(store.listEvents(0, 50)).rejects.toThrow('500');
    const late = tracked(store.listEvents(0, 50));
    actor = { id: 'other-057', role: 'coordination' };
    store.clear('actor');
    fail(new Error('500'));
    await flush();
    expect(late.settled()).toBe(false);
  });

  it('an actor change without clear() withholds a running getCockpit answer', async () => {
    let release: (value: Cockpit) => void = () => undefined;
    const getCockpit = vi.fn(() => new Promise<Cockpit>((resolve) => { release = resolve; }));
    const adapter = { getCockpit, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    const late = tracked(store.getCockpit());
    actor = { ...reader, displayName: 'Koordination 2' };
    release(answer(1));
    await flush();
    expect(late.settled()).toBe(false);
  });

  it('signed out: an adapter that throws synchronously gives a rejected promise, for reads and writes', async () => {
    const boom = (): never => { throw new Error('sync'); };
    const adapter = {
      getCockpit: boom, listEvents: boom, closeQuestion: boom, seedDemo: boom,
      subscribe: () => () => undefined, lastWriteEtag: () => undefined,
    } as unknown as HvApi;
    const store = createLiveStore(adapter, {
      getActor: () => { throw new Error('signed out'); }, now: () => 0, monotonic: () => 0,
    });
    let cockpit: Promise<unknown> | undefined;
    expect(() => { cockpit = store.getCockpit(); }).not.toThrow();
    await expect(cockpit).rejects.toThrow('sync');
    let events: Promise<unknown> | undefined;
    expect(() => { events = store.listEvents(0, 50); }).not.toThrow();
    await expect(events).rejects.toThrow('sync');
    let write: Promise<unknown> | undefined;
    expect(() => { write = store.closeQuestion('q-1', {} as never); }).not.toThrow();
    await expect(write).rejects.toThrow('sync');
  });
});
