/**
 * Scheibe 061, part A (web adapter), test L1: the control desk read (`getCockpit`) passes the live store
 * unbuffered. Its value ages without an event (every age moves with the service clock), so a buffered
 * answer would show stale minutes for up to 30 s; the store hands every call to the adapter.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Actor, Cockpit, HvApi } from '@hv/domain';
import { createLiveStore, READ_TOPICS, WithheldAnswer } from './liveStore';

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
 * stays. A withheld write rejects with the content-free `WithheldAnswer` (review finding 1), so the views' write locks
 * fall; a withheld read stays unsettled. Every case failed first against the store of takt-056, except three regression
 * guards that takt-056 already satisfied: "for the same person a write answer and a write failure are delivered
 * unchanged", "a rejection is delivered to the same person and withheld after a change" and "an actor change without
 * clear() withholds a running getCockpit answer" (checked by mutation: they fail without the delivery-time actor
 * comparison in `forCaller` or without its `reject`).
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};
function tracked(promise: Promise<unknown>): { settled: () => boolean; value: () => unknown; error: () => unknown } {
  let settled = false;
  let value: unknown;
  let error: unknown;
  void promise.then((v) => { settled = true; value = v; }, (e: unknown) => { settled = true; error = e; });
  return { settled: () => settled, value: () => value, error: () => error };
}
/** Review finding 1: a withheld write rejects with the sentinel and nothing else — no payload, text, status or cause. */
function expectWithheld(outcome: ReturnType<typeof tracked>, ...secrets: string[]): void {
  expect(outcome.settled()).toBe(true);
  expect(outcome.value()).toBeUndefined();
  const error = outcome.error();
  expect(error).toBeInstanceOf(WithheldAnswer);
  const own = Object.getOwnPropertyNames(error).filter((name) => name !== 'stack' && name !== 'message' && name !== 'name');
  expect(own).toEqual([]);
  expect((error as Error).cause).toBeUndefined();
  for (const name of ['status', 'detail', 'title', 'ruleId', 'body']) expect(name in (error as object)).toBe(false);
  const text = `${(error as Error).message} ${String(error)}`;
  for (const secret of secrets) expect(text).not.toContain(secret);
}

describe('takt-057 writes are withheld after an actor change, and settle without content', () => {
  it('a success answered after clear() rejects with WithheldAnswer, without its content, and its invalidation still runs (observeWrites)', async () => {
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
    expectWithheld(write, 'q-1', 'close');
    // settleWrite('success') ran anyway: the buffer is empty and the listeners heard it.
    expect(heard).toHaveBeenCalledTimes(1);
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(2);
  });

  it('a failure answered after clear() rejects with WithheldAnswer, not the earlier problem, and still empties the buffer (observeWrites)', async () => {
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
    fail(Object.assign(new Error('secret detail of the earlier person'), { status: 412, detail: 'secret detail', ruleId: 'R-X' }));
    await flush();
    expectWithheld(write, 'secret', 'R-X', '412');
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(2);
  });

  it('Codex P2 on #179: a write that throws synchronously takes the rejection path (withheld after clear(), buffer emptied)', async () => {
    const closeQuestion = vi.fn((): never => {
      throw Object.assign(new Error('secret sync detail'), { status: 412, ruleId: 'R-SYNC' });
    });
    const listQuestions = vi.fn(async () => ({ items: [], total: 0 }));
    const adapter = {
      closeQuestion, listQuestions, subscribe: () => () => undefined, lastWriteEtag: () => undefined,
    } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0, observeWrites: true });
    store.subscribe(() => undefined);
    await store.listQuestions();
    let write: ReturnType<typeof tracked> | undefined;
    expect(() => { write = tracked(store.closeQuestion('q-1', {} as never)); }).not.toThrow();
    actor = { id: 'other-057', role: 'coordination' };
    store.clear('actor');
    await flush();
    expectWithheld(write!, 'secret', 'R-SYNC', '412');
    // settleWrite('server_error') ran: the next read goes to the adapter again.
    actor = reader;
    store.clear('actor');
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(2);
  });

  it('Codex P2 on #179: for the same person a synchronous throw is delivered as a rejection and empties the buffer', async () => {
    const closeQuestion = vi.fn((): never => { throw new Error('sync 409'); });
    const listQuestions = vi.fn(async () => ({ items: [], total: 0 }));
    const adapter = {
      closeQuestion, listQuestions, subscribe: () => () => undefined, lastWriteEtag: () => undefined,
    } as unknown as HvApi;
    const store = createLiveStore(adapter, { getActor: () => reader, now: () => 0, monotonic: () => 0, observeWrites: true });
    store.subscribe(() => undefined);
    await store.listQuestions();
    await store.listQuestions();
    expect(listQuestions).toHaveBeenCalledTimes(1);
    await expect(store.closeQuestion('q-1', {} as never)).rejects.toThrow('sync 409');
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

  it('review finding 1: clear() for the same person (a stream end) withholds the content but settles the write', async () => {
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    const store = createLiveStore(adapter, { getActor: () => ({ ...reader }), now: () => 0, monotonic: () => 0 });
    const write = tracked(store.closeQuestion('q-1', {} as never));
    store.clear('roles_changed');
    release({ id: 'q-1', _actions: ['close'] });
    await flush();
    expectWithheld(write, 'q-1', 'close');
  });

  it('e2e finding: a write made while the actor is swapped for one synchronous task is answered, and neither empties the buffer nor withholds the view\'s reads', async () => {
    let releaseRead: (value: unknown) => void = () => undefined;
    const listQuestions = vi
      .fn()
      .mockImplementationOnce(async () => ({ items: [], total: 1 }))
      .mockImplementationOnce(() => new Promise((resolve) => { releaseRead = resolve; }));
    const getSpeaker = vi.fn(async () => ({ id: 's-1' }));
    const registerSpeaker = vi.fn(async () => ({ id: 's-2' }));
    const adapter = {
      listQuestions, getSpeaker, registerSpeaker, subscribe: () => () => undefined, lastWriteEtag: () => undefined,
    } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    store.subscribe(() => undefined);
    await store.getSpeaker('s-1'); // buffered for the view's person
    await store.listQuestions();
    const pending = tracked(store.listQuestions('again' as never));
    const before = actor;
    actor = { id: 'u-mod-2', role: 'moderation' };
    let written: Promise<unknown>;
    try {
      written = store.registerSpeaker({ displayName: 'x' } as never);
    } finally {
      actor = before;
    }
    const outcome = tracked(written);
    releaseRead({ items: [], total: 2 });
    await flush();
    expect(pending.value()).toEqual({ items: [], total: 2 });
    // The harness reads the write's answer (036a): the person at the device after the task is the one observed before.
    expect(outcome.value()).toEqual({ id: 's-2' });
    await store.getSpeaker('s-1');
    expect(getSpeaker).toHaveBeenCalledTimes(1);
  });

  it('an actor change without clear() (only getActor() returns another person) withholds a running write with WithheldAnswer', async () => {
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    const write = tracked(store.closeQuestion('q-1', {} as never));
    actor = { ...reader, role: 'moderation' }; // same id, other rights
    release({ id: 'q-1', _actions: ['close'] });
    await flush();
    expectWithheld(write, 'q-1', 'close');
  });

  it('seedDemo answered after clear() rejects with WithheldAnswer, without its content', async () => {
    let release: (value: unknown) => void = () => undefined;
    const seedDemo = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const adapter = { seedDemo, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    let actor: Actor = reader;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    const seeded = tracked(store.seedDemo());
    actor = { id: 'other-057', role: 'admin' };
    store.clear('actor');
    release({ questions: 3, marker: 'seed-secret' });
    await flush();
    expectWithheld(seeded, 'seed-secret');
  });
});

describe('takt-057 the swap rule does not open a path to another person', () => {
  it('a write of B started right after an unobserved switch from A, then a real switch back to A in a later task: withheld', async () => {
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const listQuestions = vi.fn(async () => ({ items: [], total: 0 }));
    const adapter = { closeQuestion, listQuestions, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    const a: Actor = reader;
    const b: Actor = { id: 'other-057', role: 'coordination' };
    let actor: Actor = a;
    const store = createLiveStore(adapter, { getActor: () => actor, now: () => 0, monotonic: () => 0 });
    await store.listQuestions(); // the store has observed A
    actor = b;
    const write = tracked(store.closeQuestion('q-1', {} as never));
    await Promise.resolve(); // the task ends with B at the device
    actor = a;
    release({ id: 'q-1', _actions: ['close'] });
    await flush();
    expectWithheld(write, 'q-1', 'close');
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

  it('review finding 2: the new person\'s own write as the first call after a change brings the tag back', async () => {
    const { store, box, etag } = setupEtag();
    await store.closeQuestion('q-1', {} as never);
    box.actor = { id: 'other-057', role: 'coordination' }; // no clear(), no read in between
    await store.closeQuestion('q-1', {} as never);
    expect(store.lastWriteEtag()).toBe(etag);
  });

  /** Second re-check: a store that has observed A through a read, so the swap rule (promotion to the observed person) is active. */
  function setupObserved() {
    let etag = '"v1"';
    let release: (value: unknown) => void = () => undefined;
    const closeQuestion = vi.fn(async (id: string) => {
      etag = `"${id}"`;
      return { id };
    });
    const heldWrite = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const listQuestions = vi.fn(async () => ({ items: [], total: 0 }));
    const adapter = {
      closeQuestion, deliverQuestion: heldWrite, listQuestions, subscribe: () => () => undefined, lastWriteEtag: () => etag,
    } as unknown as HvApi;
    const a: Actor = reader;
    const box: { actor: Actor } = { actor: a };
    const store = createLiveStore(adapter, { getActor: () => box.actor, now: () => 0, monotonic: () => 0 });
    return { store, box, a, release: (value: unknown) => release(value) };
  }

  it('second re-check (a): B writes after a switch the store has not observed; lastWriteEtag for B is the adapter value', async () => {
    const { store, box } = setupObserved();
    await store.listQuestions(); // observed A
    box.actor = { id: 'other-057', role: 'coordination' };
    await store.closeQuestion('b-1', {} as never);
    expect(store.lastWriteEtag()).toBe('"b-1"');
  });

  it('second re-check (b): a swap write (another actor for one task, A restored) leaves lastWriteEtag for A undefined', async () => {
    const { store, box, a } = setupObserved();
    await store.listQuestions(); // observed A
    await store.closeQuestion('a-1', {} as never);
    expect(store.lastWriteEtag()).toBe('"a-1"');
    box.actor = { id: 'u-mod-2', role: 'moderation' };
    let written: Promise<unknown>;
    try {
      written = store.closeQuestion('x-1', {} as never);
    } finally {
      box.actor = a;
    }
    await expect(written).resolves.toEqual({ id: 'x-1' }); // the harness reads the answer (036a)
    expect(store.lastWriteEtag()).toBeUndefined(); // the adapter holds the other person's tag
  });

  it('second re-check nit 4: an actor change the store observes during the flight ends the claim on the tag, even back to A', async () => {
    const { store, box, a, release } = setupObserved();
    await store.listQuestions(); // observed A
    const write = store.deliverQuestion('a-2', {} as never);
    box.actor = { id: 'other-057', role: 'coordination' };
    await store.listQuestions(); // observed B: epoch raised
    box.actor = a;
    await store.listQuestions(); // observed A again
    release({ id: 'a-2' });
    await expect(write).rejects.toBeInstanceOf(WithheldAnswer);
    expect(store.lastWriteEtag()).toBeUndefined();
  });

  it('review nit 5: signed out, a write leaves lastWriteEtag as the adapter value (today\'s behaviour)', async () => {
    const etag = '"v9"';
    const closeQuestion = vi.fn(async () => ({ id: 'q-1' }));
    const adapter = { closeQuestion, subscribe: () => () => undefined, lastWriteEtag: () => etag } as unknown as HvApi;
    const store = createLiveStore(adapter, {
      getActor: () => { throw new Error('signed out'); }, now: () => 0, monotonic: () => 0,
    });
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
    let seeded: Promise<unknown> | undefined;
    expect(() => { seeded = store.seedDemo(); }).not.toThrow();
    await expect(seeded).rejects.toThrow('sync');
  });
});
