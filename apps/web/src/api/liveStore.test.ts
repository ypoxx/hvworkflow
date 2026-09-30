/**
 * Slice 036a: the live store (buffered reads behind HvApi). A fake adapter stands in for either
 * adapter; every test drives messages, write outcomes and actor changes by hand. No retries, no fixed
 * waits: microtasks are drained explicitly and the 100 ms batch and claim expiry run on fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiProblem,
  createInMemoryEventStore,
  createInProcessApi,
  type Actor,
  type HvApi,
  type ReadEvent,
  type StreamChange,
} from '@hv/domain';
import { createLiveStore, READ_TOPICS, type LiveStore } from './liveStore';
import { readStableSpeakerList } from '../features/speakers/useSpeakers';

type Listener = Parameters<HvApi['subscribe']>[0];
type Call = { method: string; args: unknown[]; actor: Actor };
type Held = Call & { resolve: (value: unknown) => void; reject: (error: unknown) => void };

const READS = [...Object.keys(READ_TOPICS), 'listEvents'];
const A: Actor = { id: 'a1', role: 'coordination', displayName: 'A', unitId: 'u1' };
const B: Actor = { id: 'b1', role: 'capture', displayName: 'B' };

/** Drain the microtask queue a few rounds deep (promise chains inside the store). */
async function drain(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function track<T>(promise: Promise<T>) {
  const state: { status: 'pending' | 'fulfilled' | 'rejected'; value?: T; error?: unknown } = { status: 'pending' };
  promise.then(
    (value) => { state.status = 'fulfilled'; state.value = value; },
    (error: unknown) => { state.status = 'rejected'; state.error = error; },
  );
  return state;
}

function setup(options: { observeWrites?: boolean } = {}) {
  let actor: Actor | undefined = A;
  let clock = 0;
  const listeners = new Set<Listener>();
  const calls: Call[] = [];
  const held: Held[] = [];
  let hold = false;
  let etag: string | undefined;
  let respond: (method: string, args: unknown[], who: Actor) => unknown = (method, args, who) => ({
    method, args, who: who.role, unit: who.unitId ?? null, n: calls.length,
  });
  const failOnce = new Set<string>();
  const adapter: Record<string, unknown> = {};
  for (const name of READS) {
    adapter[name] = vi.fn((...args: unknown[]) => {
      const call = { method: name, args, actor: actor! };
      calls.push(call);
      if (failOnce.delete(name)) return Promise.reject(new ApiProblem(500, 't', 'd'));
      if (hold) return new Promise((resolve, reject) => held.push({ ...call, resolve, reject }));
      return Promise.resolve(respond(name, args, call.actor));
    });
  }
  const write = vi.fn(async () => ({ id: 'w' }));
  adapter['closeQuestion'] = write;
  adapter['lastWriteEtag'] = () => etag;
  adapter['seedDemo'] = vi.fn(async () => ({}));
  adapter['subscribe'] = (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const store: LiveStore = createLiveStore(adapter as unknown as HvApi, {
    getActor: () => {
      if (!actor) throw new Error('no actor');
      return actor;
    },
    now: () => clock,
    ...(options.observeWrites !== undefined ? { observeWrites: options.observeWrites } : {}),
  });
  const heard = vi.fn();
  const stop = store.subscribe(heard);
  return {
    store,
    heard,
    stop,
    write,
    calls,
    held,
    failOnce,
    count: (method: string, arg?: unknown) =>
      calls.filter((c) => c.method === method && (arg === undefined || c.args[0] === arg)).length,
    emit: (events: ReadEvent[], change?: StreamChange) => {
      for (const listener of [...listeners]) listener(events, change);
    },
    adapterListeners: () => listeners.size,
    setActor: (next: Actor | undefined) => { actor = next; },
    setHold: (next: boolean) => { hold = next; },
    setEtag: (next: string) => { etag = next; },
    setRespond: (next: typeof respond) => { respond = next; },
    advance: async (ms: number) => { clock += ms; await vi.advanceTimersByTimeAsync(ms); },
  };
}

const event = (type: string, subjectId: string, payload: Record<string, unknown> = {}): ReadEvent =>
  ({ seq: 1, type, subjectId, meetingId: 'm1', at: '2026-09-30T10:00:00.000Z', actor: { id: 'x', role: 'capture' }, payload, redacted: true, sourceHash: 'h' }) as unknown as ReadEvent;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('live store (slice 036a)', () => {
  it('(a) two reads without a change: one adapter call, each answer a new asynchronous promise, deeply frozen', async () => {
    const t = setup();
    const first = t.store.listSpeakers();
    const second = t.store.listSpeakers();
    expect(first).not.toBe(second);
    const [one, two] = await Promise.all([first, second]);
    expect(t.count('listSpeakers')).toBe(1);
    const third = t.store.listSpeakers();
    const state = track(third);
    expect(state.status).toBe('pending');
    await drain();
    expect(state.status).toBe('fulfilled');
    expect(t.count('listSpeakers')).toBe(1);
    expect(two).toEqual(one);
    expect(Object.isFrozen(one)).toBe(true);
    expect(Object.isFrozen((one as unknown as { args: unknown[] }).args)).toBe(true);
  });

  async function warm(t: ReturnType<typeof setup>) {
    await t.store.listQuestions();
    await t.store.getQuestion('q1');
    await t.store.getQuestion('q2');
    await t.store.getQuestionHistory('q1');
    await t.store.listSpeakers();
    await t.store.getSpeaker('s1');
    await t.store.getContribution('c1');
    await t.store.getContribution('c2');
  }
  async function reread(t: ReturnType<typeof setup>) {
    await warm(t);
  }

  it('(b) change with topics and subjects: only the list and the named item are read again', async () => {
    const t = setup();
    await warm(t);
    t.emit([], { seq: 2, topics: ['questions'], subjects: ['q1'] });
    await t.advance(100);
    await reread(t);
    expect(t.count('listQuestions')).toBe(2);
    expect(t.count('getQuestion', 'q1')).toBe(2);
    expect(t.count('getQuestionHistory', 'q1')).toBe(2);
    expect(t.count('getQuestion', 'q2')).toBe(1);
    expect(t.count('listSpeakers')).toBe(1);
    expect(t.count('getSpeaker', 's1')).toBe(1);
  });

  it('(c) change without subjects: every item read of the topic is read again', async () => {
    const t = setup();
    await warm(t);
    t.emit([], { seq: 2, topics: ['questions'] });
    await t.advance(100);
    await reread(t);
    expect(t.count('getQuestion', 'q1')).toBe(2);
    expect(t.count('getQuestion', 'q2')).toBe(2);
    expect(t.count('listSpeakers')).toBe(1);
  });

  it('(d) event messages: topics from EVENT_TOPICS, items from EVENT_SUBJECTS, side effects included', async () => {
    const t = setup();
    await warm(t);
    t.emit([event('QuestionClassified', 'q1', { track: 'written' })]);
    await t.advance(100);
    await reread(t);
    expect(t.count('listQuestions')).toBe(2);
    expect(t.count('getQuestion', 'q1')).toBe(2);
    expect(t.count('getQuestion', 'q2')).toBe(1);
    expect(t.count('listSpeakers')).toBe(1);

    t.emit([event('QuestionCaptured', 'q9', { contributionId: 'c1', speakerId: 's1', text: 'x' })]);
    await t.advance(100);
    await reread(t);
    expect(t.count('getContribution', 'c1')).toBe(2);
    expect(t.count('getSpeaker', 's1')).toBe(2);
    expect(t.count('listSpeakers')).toBe(2);
    expect(t.count('getContribution', 'c2')).toBe(1);

    t.emit([event('QuestionMerged', 'q1', { intoQuestionId: 'q2' })]);
    await t.advance(100);
    await reread(t);
    expect(t.count('getQuestion', 'q1')).toBe(3);
    expect(t.count('getQuestion', 'q2')).toBe(2);
  });

  it('(d2) an event type the tables do not know empties the whole buffer', async () => {
    const t = setup();
    await warm(t);
    t.emit([event('SomethingNew', 'z1')]);
    await t.advance(100);
    await reread(t);
    expect(t.count('listSpeakers')).toBe(2);
    expect(t.count('getContribution', 'c2')).toBe(2);
  });

  it('(e) messages within 100 ms form one batch: invalidated once, listeners called once', async () => {
    const t = setup();
    await warm(t);
    t.emit([], { seq: 2, topics: ['questions'], subjects: ['q1'] });
    await t.advance(50);
    t.emit([], { seq: 3, topics: ['speakers'], subjects: ['s1'] });
    expect(t.heard).not.toHaveBeenCalled();
    await t.advance(50);
    expect(t.heard).toHaveBeenCalledTimes(1);
    await reread(t);
    expect(t.count('listQuestions')).toBe(2);
    expect(t.count('listSpeakers')).toBe(2);
    await t.advance(500);
    expect(t.heard).toHaveBeenCalledTimes(1);
  });

  it('(f) a request started before the invalidation and answered after it is delivered but not buffered', async () => {
    const t = setup();
    t.setHold(true);
    const pending = track(t.store.listQuestions());
    t.emit([], { seq: 2, topics: ['questions'] });
    await t.advance(100);
    t.held[0]!.resolve({ items: [], total: 0 });
    await drain();
    expect(pending.status).toBe('fulfilled');
    t.setHold(false);
    await t.store.listQuestions();
    expect(t.count('listQuestions')).toBe(2);
  });

  it('(g) own write success: synchronously invalid, listeners at once with the new ETag, one run for hook plus write', async () => {
    const t = setup();
    await t.store.listSpeakers();
    t.setHold(true);
    const before = track(t.store.listQuestions());
    t.setHold(false);
    let etagSeen: string | undefined;
    t.heard.mockImplementation(() => { etagSeen = t.store.lastWriteEtag(); });
    t.setEtag('"v8"');
    t.store.onWriteSettled('success');
    t.emit([]); // the adapter's own call to its listeners right after the hook (takt-030)
    expect(t.heard).toHaveBeenCalledTimes(1);
    expect(etagSeen).toBe('"v8"');
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(2);
    t.held[0]!.resolve({ items: [], total: 0 });
    await drain();
    expect(before.status).toBe('fulfilled');
    await t.store.listQuestions();
    expect(t.count('listQuestions')).toBe(2);
    await t.advance(1000);
    expect(t.heard).toHaveBeenCalledTimes(1);
    // A later bare call is not swallowed: it is the 30 s tick.
    t.emit([]);
    await t.advance(100);
    expect(t.heard).toHaveBeenCalledTimes(2);
  });

  it('(h) server_error invalidates without listeners; local_reject does nothing', async () => {
    const t = setup();
    await t.store.listSpeakers();
    t.store.onWriteSettled('local_reject');
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(1);
    t.store.onWriteSettled('server_error');
    await t.advance(1000);
    expect(t.heard).not.toHaveBeenCalled();
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(2);
  });

  it('(g2/h2) demo adapter: the store observes writes itself (success, core ApiProblem)', async () => {
    const t = setup({ observeWrites: true });
    await t.store.listSpeakers();
    await t.store.closeQuestion('q1');
    expect(t.heard).toHaveBeenCalledTimes(1);
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(2);
    t.write.mockRejectedValueOnce(new ApiProblem(412, 't', 'd'));
    await expect(t.store.closeQuestion('q1')).rejects.toBeInstanceOf(ApiProblem);
    await t.advance(1000);
    expect(t.heard).toHaveBeenCalledTimes(1);
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(3);
  });

  it('(i) failures are never buffered; listEvents never', async () => {
    const t = setup();
    t.failOnce.add('listQuestions');
    await expect(t.store.listQuestions()).rejects.toBeInstanceOf(ApiProblem);
    await t.store.listQuestions();
    expect(t.count('listQuestions')).toBe(2);
    await t.store.listEvents(0, 10);
    await t.store.listEvents(0, 10);
    expect(t.count('listEvents')).toBe(2);
  });

  it('(j) actor change, 401 and sign-out empty the buffer; answers still on their way are not buffered', async () => {
    const t = setup();
    await t.store.listQuestions();
    t.setActor(B);
    await t.store.listQuestions();
    t.setActor(A);
    await t.store.listQuestions();
    expect(t.count('listQuestions')).toBe(3);

    for (const reason of ['actor', 'unauthorized', 'logout'] as const) {
      await t.store.listQuestions();
      const before = t.count('listQuestions');
      t.setHold(true);
      const running = track(t.store.getQuestion(reason));
      t.store.clear(reason);
      t.held.shift()!.resolve({ id: reason });
      t.setHold(false);
      await drain();
      expect(running.status).toBe('pending');
      await t.store.listQuestions();
      expect(t.count('listQuestions')).toBe(before + 1);
      await t.store.getQuestion(reason);
      expect(t.count('getQuestion', reason)).toBe(2);
    }
  });

  it('(j1) clear() calls the listeners, except for an actor change (useApiVersion counts that itself)', () => {
    const t = setup();
    t.store.clear('actor');
    expect(t.heard).not.toHaveBeenCalled();
    t.store.clear('unauthorized');
    expect(t.heard).toHaveBeenCalledTimes(1);
  });

  it('(j2) same id, other role or unit, without clear(): the network is asked, the entry of A never delivered', async () => {
    const t = setup();
    const ofA = await t.store.listQuestions();
    t.setActor({ ...A, role: 'legal' });
    const ofRole = await t.store.listQuestions();
    t.setActor({ ...A, unitId: 'u2' });
    const ofUnit = await t.store.listQuestions();
    expect(t.count('listQuestions')).toBe(3);
    expect(ofRole).not.toEqual(ofA);
    expect(ofUnit).not.toEqual(ofA);
    expect((ofRole as unknown as { who: string }).who).toBe('legal');
    expect((ofUnit as unknown as { unit: string }).unit).toBe('u2');
  });

  it('(j2b) an answer asked for A that arrives after the switch to A\' stays unsettled and is not buffered', async () => {
    const t = setup();
    t.setHold(true);
    const running = track(t.store.listQuestions());
    t.setActor({ ...A, role: 'legal' });
    t.store.clear('actor');
    t.held.shift()!.resolve({ items: [{ secret: true }], total: 1 });
    await drain();
    await vi.runAllTimersAsync();
    await drain();
    expect(running.status).toBe('pending');
    t.setHold(false);
    await t.store.listQuestions();
    expect(t.count('listQuestions')).toBe(2);

    // The same without clear(): the store itself notices the other actor when the answer arrives.
    t.setHold(true);
    const second = track(t.store.getStage());
    t.setActor({ ...A, role: 'approver' });
    t.held.shift()!.reject(new ApiProblem(403, 't', 'd'));
    await drain();
    expect(second.status).toBe('pending');

    // Counter-check: only E raised (own write) — the caller gets the answer.
    const third = track(t.store.getSpeaker('s1'));
    t.store.onWriteSettled('success');
    t.held.shift()!.resolve({ id: 's1' });
    await drain();
    expect(third.status).toBe('fulfilled');
    expect(third.value).toEqual({ id: 's1' });
  });

  it('(j2c) a buffered answer is withheld if the actor changes between the call and its delivery', async () => {
    const t = setup();
    await t.store.listQuestions();
    const hit = track(t.store.listQuestions());
    t.setActor({ ...A, role: 'legal' });
    await drain();
    expect(hit.status).toBe('pending');
    expect(t.count('listQuestions')).toBe(1);
  });

  it.each(['roles_changed', 'forbidden', 'session'] as const)('(j3) clear(%s) empties the buffer and drops answers on their way', async (reason) => {
    const t = setup();
    await t.store.listSpeakers();
    t.setHold(true);
    const running = track(t.store.listQuestions());
    t.store.clear(reason);
    t.held.shift()!.resolve({ items: [], total: 0 });
    await drain();
    expect(running.status).toBe('pending');
    t.setHold(false);
    await t.store.listSpeakers();
    await t.store.listQuestions();
    expect(t.count('listSpeakers')).toBe(2);
    expect(t.count('listQuestions')).toBe(2);
    expect(t.heard).toHaveBeenCalledTimes(1);
  });

  it('(k) at most 200 entries, the oldest dropped first', async () => {
    const t = setup();
    for (let i = 0; i <= 200; i++) await t.store.getQuestion(`q${i}`);
    await t.store.getQuestion('q200');
    expect(t.count('getQuestion', 'q200')).toBe(1);
    // Review nit 8: exactly one entry went, the second oldest is still there (a cap off by one fails here).
    await t.store.getQuestion('q1');
    expect(t.count('getQuestion', 'q1')).toBe(1);
    await t.store.getQuestion('q0');
    expect(t.count('getQuestion', 'q0')).toBe(2);
  });

  it('(l) a bare listener call without change (30 s tick) empties the whole buffer after one batch', async () => {
    const t = setup();
    await warm(t);
    t.emit([]);
    await t.advance(100);
    expect(t.heard).toHaveBeenCalledTimes(1);
    await reread(t);
    expect(t.count('listSpeakers')).toBe(2);
    expect(t.count('getContribution', 'c2')).toBe(2);
  });

  it('(m) generations: another key keeps a running answer, the same key or E drops it; two calls share one request', async () => {
    const t = setup();
    t.setHold(true);
    const q1 = track(t.store.getQuestion('q1'));
    t.emit([], { seq: 2, topics: ['questions'], subjects: ['q2'] });
    await t.advance(100);
    t.held.shift()!.resolve({ id: 'q1' });
    await drain();
    expect(q1.status).toBe('fulfilled');
    await t.store.getQuestion('q1').catch(() => undefined);
    expect(t.count('getQuestion', 'q1')).toBe(1);

    const q3 = track(t.store.getQuestion('q3'));
    t.emit([], { seq: 3, topics: ['questions'], subjects: ['q3'] });
    await t.advance(100);
    t.held.shift()!.resolve({ id: 'q3' });
    await drain();
    expect(q3.status).toBe('fulfilled');
    const again = t.store.getQuestion('q3');
    t.held.shift()!.resolve({ id: 'q3' });
    await again;
    expect(t.count('getQuestion', 'q3')).toBe(2);

    const q4 = track(t.store.getQuestion('q4'));
    t.store.onWriteSettled('server_error');
    t.held.shift()!.resolve({ id: 'q4' });
    await drain();
    expect(q4.status).toBe('fulfilled');
    const q4again = t.store.getQuestion('q4');
    t.held.shift()!.resolve({ id: 'q4' });
    await q4again;
    expect(t.count('getQuestion', 'q4')).toBe(2);

    const x = t.store.getQuestion('q5');
    const y = t.store.getQuestion('q5');
    expect(t.count('getQuestion', 'q5')).toBe(1);
    t.held.shift()!.resolve({ id: 'q5' });
    expect(await x).toEqual(await y);
  });

  it('(n) version watermark: never old rows with a new version (readStableSpeakerList against the store)', async () => {
    const t = setup();
    let listVersion = 5;
    t.setRespond((method) => {
      if (method === 'getMeeting') return { id: 'm1', version: 1, speakerListVersion: listVersion };
      if (method === 'listSpeakers') return [{ id: 's1', stand: listVersion }];
      return {};
    });
    const first = await readStableSpeakerList(t.store);
    expect(first.version).toBe(5);
    expect(first.speakers[0]).toMatchObject({ stand: 5 });

    // The service moves on; only the meeting read is invalidated (e.g. a signal naming `meeting` alone).
    listVersion = 6;
    t.emit([], { seq: 9, topics: ['meeting'] });
    await t.advance(100);
    const second = await readStableSpeakerList(t.store);
    expect(second.version).toBe(6);
    expect(second.speakers[0]).toMatchObject({ stand: 6 });

    // Directly: after a fresh meeting read with a higher counter, the buffered list of the old stand is gone.
    listVersion = 7;
    t.emit([], { seq: 10, topics: ['meeting'] });
    await t.advance(100);
    const meeting = await t.store.getMeeting();
    const rows = await t.store.listSpeakers();
    expect(rows[0]).toMatchObject({ stand: meeting.speakerListVersion });

    // A list on its way when the higher counter arrives is delivered but not buffered.
    t.setHold(true);
    const running = t.store.listSpeakers({ round: 2 });
    listVersion = 8;
    t.setHold(false);
    t.emit([], { seq: 11, topics: ['meeting'] });
    await t.advance(100);
    await t.store.getMeeting();
    t.held.shift()!.resolve([{ id: 's1', stand: 7 }]);
    await running;
    const fresh = await t.store.listSpeakers({ round: 2 });
    expect(fresh[0]).toMatchObject({ stand: 8 });
  });

  it('(o) claims expire without an event and wake the listeners: at claim.expiresAt, at the latest after 30 s', async () => {
    const t = setup();
    const at = (ms: number) => new Date(ms).toISOString();
    t.setRespond((method, args) => {
      if (args[0] === 'q1') return { id: 'q1', claim: { actorId: 'x', claimedAt: at(0), expiresAt: at(10_000) } };
      if (args[0] === 'q2') return { id: 'q2', claim: { actorId: 'x', claimedAt: at(0), expiresAt: at(600_000) } };
      if (args[0] === 'q4') return { id: 'q4', claim: { actorId: 'x', claimedAt: at(-600_000), expiresAt: at(-1) } };
      return { id: args[0], method };
    });
    await t.store.getQuestion('q1');
    await t.store.getQuestion('q2');
    await t.store.getQuestion('q3');
    await t.advance(10_000);
    expect(t.heard).toHaveBeenCalledTimes(1);
    await t.store.getQuestion('q1');
    await t.store.getQuestion('q2');
    await t.store.getQuestion('q3');
    expect(t.count('getQuestion', 'q1')).toBe(2);
    expect(t.count('getQuestion', 'q2')).toBe(1);
    expect(t.count('getQuestion', 'q3')).toBe(1);
    await t.advance(20_000);
    // Only q2 wakes the listeners; q3 (no claim) reaches the general maximum age silently (review M1).
    expect(t.heard).toHaveBeenCalledTimes(2);
    await t.store.getQuestion('q2');
    await t.store.getQuestion('q3');
    expect(t.count('getQuestion', 'q2')).toBe(2);
    expect(t.count('getQuestion', 'q3')).toBe(2);
    // A claim already past on arrival (clock skew) is not buffered and wakes nobody: no reload loop.
    const heard = t.heard.mock.calls.length;
    await t.store.getQuestion('q4');
    await t.advance(0);
    await t.store.getQuestion('q4');
    expect(t.count('getQuestion', 'q4')).toBe(2);
    expect(t.heard.mock.calls.length).toBe(heard);
  });

  it('(q) review M1: every entry has a maximum age of 30 s; it expires silently and the next read asks the network', async () => {
    const t = setup();
    await t.store.listSpeakers();
    await t.advance(29_999);
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(1);
    await t.advance(1);
    expect(t.heard).not.toHaveBeenCalled();
    const read = track(t.store.listSpeakers());
    await drain();
    expect(read.status).toBe('fulfilled');
    expect(t.count('listSpeakers')).toBe(2);
    // The fresh answer starts a new 30 s.
    await t.advance(29_999);
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(2);
  });

  describe('review M2: no caller joins a request started before an invalidation', () => {
    it('(r1) after an own write (success)', async () => {
      const t = setup();
      t.setHold(true);
      const first = track(t.store.listQuestions());
      t.store.onWriteSettled('success');
      void t.store.listQuestions();
      expect(t.count('listQuestions')).toBe(2);
      t.held.splice(0).forEach((call) => call.resolve({ items: [], total: 0 }));
      await drain();
      expect(first.status).toBe('fulfilled');
    });

    it('(r2) after a key invalidation (change with subjects)', async () => {
      const t = setup();
      t.setHold(true);
      void t.store.getQuestion('q1');
      t.emit([], { seq: 2, topics: ['questions'], subjects: ['q1'] });
      await t.advance(100);
      void t.store.getQuestion('q1');
      expect(t.count('getQuestion', 'q1')).toBe(2);
    });

    it('(r3) after a higher getMeeting counter', async () => {
      const t = setup();
      let listVersion = 5;
      t.setRespond((method) => (method === 'getMeeting' ? { id: 'm1', version: 1, speakerListVersion: listVersion } : []));
      await t.store.getMeeting();
      t.setHold(true);
      void t.store.listSpeakers();
      t.setHold(false);
      listVersion = 6;
      t.emit([], { seq: 2, topics: ['meeting'] });
      await t.advance(100);
      await t.store.getMeeting();
      t.setHold(true);
      void t.store.listSpeakers();
      expect(t.count('listSpeakers')).toBe(2);
    });

    it('(r4) after clear() for the same actor', async () => {
      const t = setup();
      t.setHold(true);
      const first = track(t.store.listQuestions());
      t.store.clear('logout');
      void t.store.listQuestions();
      expect(t.count('listQuestions')).toBe(2);
      t.held.shift()!.resolve({ items: [], total: 0 });
      await drain();
      expect(first.status).toBe('pending');
    });
  });

  it('(s) review minor 3: an actor switch between the arrival of a shared answer and its delivery withholds it', async () => {
    const t = setup();
    t.setHold(true);
    const first = track(t.store.listQuestions());
    const joined = track(t.store.listQuestions());
    expect(t.count('listQuestions')).toBe(1);
    // The answer arrives (its check passes for A); in the next microtask, before delivery, the actor switches.
    t.held.shift()!.resolve({ items: [{ secret: true }], total: 1 });
    queueMicrotask(() => t.setActor({ ...A, role: 'legal' }));
    await drain();
    expect(first.status).toBe('pending');
    expect(joined.status).toBe('pending');
  });

  it('(t) review minor 4: a failure inside the settling (answer that cannot be copied) reaches the caller as a rejection', async () => {
    const t = setup();
    t.setRespond(() => ({ id: 'q1', notData: () => 1 }));
    const read = track(t.store.getQuestion('q1'));
    await drain();
    expect(read.status).toBe('rejected');
    t.setRespond(() => ({ id: 'q1' }));
    await t.store.getQuestion('q1');
    expect(t.count('getQuestion', 'q1')).toBe(2);
  });

  it('(p) READ_TOPICS names every read method of HvApi except listEvents', () => {
    const inProcess = createInProcessApi({ store: createInMemoryEventStore(), actor: () => A, clock: () => new Date(0) });
    const reads = Object.keys(inProcess).filter((name) => /^(get|list)[A-Z]/.test(name)).sort();
    expect([...Object.keys(READ_TOPICS), 'listEvents'].sort()).toEqual(reads);
    expect(Object.keys(READ_TOPICS)).not.toContain('listEvents');
  });

  it('is the only subscriber of the adapter and buffers nothing without a listener of its own', async () => {
    const t = setup();
    const extra = t.store.subscribe(vi.fn());
    expect(t.adapterListeners()).toBe(1);
    extra();
    t.stop();
    expect(t.adapterListeners()).toBe(0);
    await t.store.listSpeakers();
    await t.store.listSpeakers();
    expect(t.count('listSpeakers')).toBe(2);
  });
});
