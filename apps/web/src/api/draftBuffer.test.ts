/**
 * Scheibe 060, U1: the draft buffer (Entwurfspuffer) of the answer views, with a store in memory and a fixed clock.
 *
 * What it proves: the entry carries only the fields of decision 2, a manipulated entry is rejected and deleted (the core's
 * `checkAnswerBodyInput`, normalisation, caps), entries run out after 14 hours, loading for one actor deletes every
 * other actor's entries (`purgeOthers`), writes go through the snapshot first and are rolled back on a failing
 * transaction, the owner is compared on every access (`getActor`), the wiring clears on `noRole` and `forbidden` but
 * not on a 401, sign-out waits for the clear at most 1 s, and the module never talks to the network.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerBodyInput } from '@hv/domain';
import {
  BUFFER_DATABASE,
  BUFFER_OBJECT_STORE,
  BUFFER_SCHEMA,
  clearBeforeSignOut,
  createDraftBuffer,
  createMemoryStore,
  entryId,
  sanitizeEntry,
  wireDraftBuffer,
} from './draftBuffer';
import type { BufferEntry, BufferStore, DraftBuffer } from './draftBuffer';

const NOW = Date.parse('2027-04-20T10:00:00.000Z');
const HOUR = 3_600_000;
const plain = (text: string): AnswerBodyInput => ({ blocks: [{ type: 'paragraph', content: [{ text }] }] });

function entry(over: Partial<BufferEntry> & Record<string, unknown> = {}): BufferEntry & Record<string, unknown> {
  const meetingId = (over.meetingId as string | undefined) ?? 'm-1';
  const ownerId = (over.ownerId as string | undefined) ?? 'u-a';
  const questionId = (over.questionId as string | undefined) ?? 'q-1';
  return {
    id: entryId(meetingId, ownerId, questionId),
    schema: BUFFER_SCHEMA,
    ownerId,
    meetingId,
    questionId,
    body: plain('Mein Entwurf.'),
    sources: 'GB S. 4',
    baseVersion: 1,
    changedAt: NOW - 60_000,
    ...over,
  };
}

/** The actor the buffer sees; a test changes it or makes it throw (no confirmed actor). */
let actor: { id: string } | Error = { id: 'u-a' };
const getActor = (): { id: string } => {
  if (actor instanceof Error) throw actor;
  return actor;
};

function bufferOver(store: BufferStore, now = (): number => NOW): DraftBuffer {
  return createDraftBuffer({ store, now, getActor });
}

const fields = (over: Partial<{ ownerId: string; meetingId: string; questionId: string; body: AnswerBodyInput | null; sources: string; baseVersion: number }> = {}) => ({
  ownerId: 'u-a',
  meetingId: 'm-1',
  questionId: 'q-1',
  body: plain('Neuer Text.'),
  sources: '',
  baseVersion: 1,
  ...over,
});

/** A store whose transactions finish only when the test says so (oncomplete), or fail. */
function deferredStore(inner = createMemoryStore()) {
  const pending: { resolve: () => void; reject: (e: unknown) => void; run: () => Promise<void> }[] = [];
  const hold = (run: () => Promise<void>): Promise<void> =>
    new Promise<void>((resolve, reject) => pending.push({ resolve, reject, run }));
  const store: BufferStore = {
    getAll: () => inner.getAll(),
    put: (e) => hold(() => inner.put(e)),
    delete: (id) => hold(() => inner.delete(id)),
    clear: () => hold(() => inner.clear()),
  };
  return {
    store,
    inner,
    pending,
    async complete(i = 0) {
      const [p] = pending.splice(i, 1);
      await p!.run();
      p!.resolve();
    },
    fail(i = 0) {
      const [p] = pending.splice(i, 1);
      p!.reject(new Error('QuotaExceededError'));
    },
  };
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  actor = { id: 'u-a' };
});
afterEach(() => {
  vi.useRealTimers();
});

describe('entryId and the constants', () => {
  it('separates meeting, actor and question, without collisions through the separator', () => {
    const ids = new Set([
      entryId('m-1', 'u-a', 'q-1'),
      entryId('m-2', 'u-a', 'q-1'),
      entryId('m-1', 'u-b', 'q-1'),
      entryId('m-1', 'u-a', 'q-2'),
      entryId('m|1', 'u-a', 'q-1'),
      entryId('m', '1|u-a', 'q-1'),
    ]);
    expect(ids.size).toBe(6);
  });

  it('the storage names never end on KEY/Key and name no credential', () => {
    for (const name of ['BUFFER_DATABASE', 'BUFFER_OBJECT_STORE', 'BUFFER_SCHEMA']) {
      expect(name).not.toMatch(/key$/i);
      expect(name).not.toMatch(/token|secret|auth|api/i);
    }
    expect(typeof BUFFER_DATABASE).toBe('string');
    expect(typeof BUFFER_OBJECT_STORE).toBe('string');
    expect(Number.isInteger(BUFFER_SCHEMA)).toBe(true);
  });
});

describe('sanitizeEntry (decision 2)', () => {
  it('keeps exactly the fields of decision 2; question text, number, display name and the base fall away', () => {
    const raw = entry({ questionText: 'Frage?', displayName: 'Erika', number: 'F-0001', baseBody: plain('x'), baseSources: 'y' });
    const clean = sanitizeEntry(raw, NOW);
    expect(clean).toBeDefined();
    expect(Object.keys(clean!).sort()).toEqual(
      ['baseVersion', 'body', 'changedAt', 'id', 'meetingId', 'ownerId', 'questionId', 'schema', 'sources'].sort(),
    );
  });

  it('accepts the open input form the service accepts (heading, quote, table, underline, strike, items, language de, null)', () => {
    const legit: AnswerBodyInput[] = [
      { language: 'de', blocks: [{ type: 'heading', content: [{ text: 'Titel' }] }, { type: 'paragraph', content: [{ text: 'Text' }] }] },
      { blocks: [{ type: 'quote', content: [{ text: 'Zitat', marks: ['underline', 'strike'] }] }] },
      { blocks: [{ type: 'table', items: [[{ text: 'Zelle 1' }], [{ text: 'Zelle 2' }]] }] },
      { blocks: [{ type: 'list', content: [{ text: 'eins' }], items: [[{ text: 'zwei', marks: ['bold'] }]] }] },
      { blocks: [{ type: 'paragraph', content: [{ text: 'leer davor' }] }, { type: 'paragraph', content: [] }] },
    ];
    for (const body of legit) expect(sanitizeEntry(entry({ body }), NOW), JSON.stringify(body)).toBeDefined();
    expect(sanitizeEntry(entry({ body: null }), NOW)).toBeDefined();
  });

  it('rejects what checkAnswerBodyInput rejects: a key html in a block, a run text as number, language xx, a script block with markup', () => {
    const bad: unknown[] = [
      { blocks: [{ type: 'script', content: [{ text: 'alert(1)' }], html: '<img src=x onerror=alert(1)>' }] },
      { blocks: [{ type: 'paragraph', content: [{ text: 42 }] }] },
      { language: 'xx', blocks: [{ type: 'paragraph', content: [{ text: 'x' }] }] },
      { blocks: [] },
      '<p>markup</p>',
    ];
    for (const body of bad) expect(sanitizeEntry(entry({ body: body as AnswerBodyInput }), NOW), JSON.stringify(body)).toBeUndefined();
  });

  it('caps: 51 source parts, a part of 2 001 characters, plain text over 20 000 (empty parts do not count)', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => `Q${i}`).join('; ');
    expect(sanitizeEntry(entry({ sources: `${fifty}; ;  ;` }), NOW)).toBeDefined();
    expect(sanitizeEntry(entry({ sources: `${fifty}; Q50` }), NOW)).toBeUndefined();
    expect(sanitizeEntry(entry({ sources: 'x'.repeat(2000) }), NOW)).toBeDefined();
    expect(sanitizeEntry(entry({ sources: 'x'.repeat(2001) }), NOW)).toBeUndefined();
    const long: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: [{ text: 'a'.repeat(10_001) }, { text: 'b'.repeat(10_001) }] }] };
    expect(sanitizeEntry(entry({ body: long }), NOW)).toBeUndefined();
  });

  it('rejects an id that does not fit the fields, a bad baseVersion, a future changedAt, another schema, a non-string field', () => {
    expect(sanitizeEntry(entry({ id: entryId('m-1', 'u-b', 'q-1') }), NOW)).toBeUndefined();
    expect(sanitizeEntry(entry({ baseVersion: -1 }), NOW)).toBeUndefined();
    expect(sanitizeEntry(entry({ baseVersion: 1.5 }), NOW)).toBeUndefined();
    expect(sanitizeEntry(entry({ changedAt: NOW + 5 * 60_000 + 1 }), NOW)).toBeUndefined();
    expect(sanitizeEntry(entry({ changedAt: NOW + 60_000 }), NOW)).toBeDefined();
    expect(sanitizeEntry(entry({ schema: BUFFER_SCHEMA + 1 }), NOW)).toBeUndefined();
    expect(sanitizeEntry(entry({ sources: 7 as unknown as string }), NOW)).toBeUndefined();
    expect(sanitizeEntry(null, NOW)).toBeUndefined();
  });

  it('a manipulated entry found on loading is deleted, not restored', async () => {
    const store = createMemoryStore();
    const bad = entry({ body: { blocks: [{ type: 'paragraph', content: [{ text: 'x' }], html: '<b>' }] } as unknown as AnswerBodyInput });
    await store.put(bad as BufferEntry);
    const buffer = bufferOver(store);
    await buffer.load();
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    expect(store.rows.size).toBe(0);
  });
});

describe('loading: expiry, purgeOthers, reading only own entries', () => {
  it('expiry at the boundary: 13:59:59 stays, 14:00:00 is deleted', async () => {
    const store = createMemoryStore();
    await store.put(entry({ questionId: 'q-1', changedAt: NOW - 14 * HOUR + 1000 }));
    await store.put(entry({ questionId: 'q-2', changedAt: NOW - 14 * HOUR }));
    const buffer = bufferOver(store);
    await buffer.load();
    expect(buffer.entryFor('m-1', 'q-1')).toBeDefined();
    expect(buffer.entryFor('m-1', 'q-2')).toBeUndefined();
    expect([...store.rows.keys()]).toEqual([entryId('m-1', 'u-a', 'q-1')]);
  });

  it('loading for A deletes every entry of B; loading again changes nothing (idempotent)', async () => {
    const store = createMemoryStore();
    await store.put(entry({ ownerId: 'u-a' }));
    await store.put(entry({ ownerId: 'u-b' }));
    await store.put(entry({ ownerId: 'u-b', questionId: 'q-2' }));
    await bufferOver(store).load();
    expect([...store.rows.keys()]).toEqual([entryId('m-1', 'u-a', 'q-1')]);
    await bufferOver(store).load();
    expect([...store.rows.keys()]).toEqual([entryId('m-1', 'u-a', 'q-1')]);
  });

  it('reads only own entries of the same meeting', async () => {
    const store = createMemoryStore();
    await store.put(entry({ meetingId: 'm-1' }));
    const buffer = bufferOver(store);
    await buffer.load();
    expect(buffer.entryFor('m-1', 'q-1')?.body).toEqual(plain('Mein Entwurf.'));
    expect(buffer.entryFor('m-2', 'q-1')).toBeUndefined();
    actor = { id: 'u-b' };
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
  });

  it('without a first load the buffer is not armed: no entry, no load, nothing deleted (the demo start switches personas)', async () => {
    const store = createMemoryStore();
    await store.put(entry({ ownerId: 'u-a' }));
    const buffer = bufferOver(store);
    actor = { id: 'u-admin' };
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    await settle();
    expect(store.rows.size).toBe(1);
  });
});

describe('write-through snapshot', () => {
  it('after put the snapshot answers at once, after delete nothing', async () => {
    const buffer = bufferOver(createMemoryStore());
    await buffer.load();
    const written = buffer.put(fields());
    expect(buffer.entryFor('m-1', 'q-1')?.body).toEqual(plain('Neuer Text.'));
    await written;
    const deleted = buffer.delete('m-1', 'q-1');
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    await deleted;
  });

  it('a failing transaction rolls the snapshot back and switches the buffer off, without throwing', async () => {
    const d = deferredStore();
    const buffer = bufferOver(d.store);
    await buffer.load();
    const written = buffer.put(fields());
    expect(buffer.entryFor('m-1', 'q-1')).toBeDefined();
    d.fail();
    await expect(written).resolves.toBeUndefined();
    expect(buffer.status()).toBe('unavailable');
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
  });

  it('put A fails while put B on the same id already stands in the snapshot: B stays', async () => {
    const d = deferredStore();
    const buffer = bufferOver(d.store);
    await buffer.load();
    const a = buffer.put(fields({ body: plain('A') }));
    const b = buffer.put(fields({ body: plain('B') }));
    d.fail(0);
    await a;
    expect(buffer.entryFor('m-1', 'q-1')?.body).toEqual(plain('B'));
    await d.complete(0);
    await b;
  });

  it('the kept time appears only after oncomplete', async () => {
    const d = deferredStore();
    const buffer = bufferOver(d.store);
    await buffer.load();
    const written = buffer.put(fields());
    expect(buffer.keptAt('m-1', 'q-1')).toBeUndefined();
    await d.complete();
    await expect(written).resolves.toBe(NOW);
    expect(buffer.keptAt('m-1', 'q-1')).toBe(NOW);
  });

  it('clear empties store and snapshot; an entry over 256 KiB is not written (buffer off)', async () => {
    const store = createMemoryStore();
    const buffer = bufferOver(store);
    await buffer.load();
    await buffer.put(fields());
    await buffer.clear();
    expect(store.rows.size).toBe(0);
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    const marks = Array.from({ length: 16 }, (_, i) => `m${String(i).padStart(30, '0')}`);
    const heavy: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: Array.from({ length: 2000 }, () => ({ text: '', marks })) }] };
    await expect(buffer.put(fields({ body: heavy }))).resolves.toBeUndefined();
    expect(store.rows.size).toBe(0);
    expect(buffer.status()).toBe('unavailable');
  });

  it('a write for another owner than the confirmed actor is refused (a debounced write after a persona switch)', async () => {
    const store = createMemoryStore();
    const buffer = bufferOver(store);
    await buffer.load();
    actor = { id: 'u-b' };
    await expect(buffer.put(fields({ ownerId: 'u-a' }))).resolves.toBeUndefined();
    expect(store.rows.size).toBe(0);
  });

  it('schedule writes after 400 ms of quiet, once, with the newest fields; flush writes at once', async () => {
    vi.useFakeTimers();
    const store = createMemoryStore();
    const buffer = bufferOver(store);
    await buffer.load();
    buffer.schedule(fields({ body: plain('a') }));
    vi.advanceTimersByTime(399);
    buffer.schedule(fields({ body: plain('ab') }));
    vi.advanceTimersByTime(399);
    expect(store.rows.size).toBe(0);
    vi.advanceTimersByTime(1);
    await settle();
    expect((store.rows.get(entryId('m-1', 'u-a', 'q-1')) as BufferEntry).body).toEqual(plain('ab'));
    buffer.schedule(fields({ body: plain('abc') }));
    await expect(buffer.flush('m-1', 'q-1')).resolves.toBe(NOW);
    expect((store.rows.get(entryId('m-1', 'u-a', 'q-1')) as BufferEntry).body).toEqual(plain('abc'));
  });
});

describe('the owner through getActor (re-check major 1)', () => {
  it('A to B: the next access returns nothing of A, and A is deleted in the store', async () => {
    const store = createMemoryStore();
    await store.put(entry({ ownerId: 'u-a' }));
    const buffer = bufferOver(store);
    await buffer.load();
    expect(buffer.entryFor('m-1', 'q-1')).toBeDefined();
    actor = { id: 'u-b' };
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    await settle();
    expect(store.rows.size).toBe(0);
    actor = { id: 'u-a' };
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
  });

  it('getActor throws: no entry, no write', async () => {
    const store = createMemoryStore();
    await store.put(entry());
    const buffer = bufferOver(store);
    await buffer.load();
    actor = new Error('No confirmed session actor.');
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    await expect(buffer.put(fields())).resolves.toBeUndefined();
    expect(store.rows.size).toBe(1);
  });

  it('the same id loads nothing again', async () => {
    const inner = createMemoryStore();
    const getAll = vi.fn(() => inner.getAll());
    const buffer = bufferOver({ ...inner, getAll });
    await buffer.load();
    buffer.entryFor('m-1', 'q-1');
    await buffer.load();
    await settle();
    expect(getAll).toHaveBeenCalledTimes(1);
  });
});

describe('wireDraftBuffer and sign-out', () => {
  function session() {
    let state: { kind: string } = { kind: 'signedIn' };
    const listeners = new Set<() => void>();
    return {
      getState: () => state,
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      publish(next: { kind: string }) {
        state = next;
        for (const l of listeners) l();
      },
    };
  }

  async function wired() {
    const store = createMemoryStore();
    const buffer = bufferOver(store);
    await buffer.load();
    await buffer.put(fields());
    const auth = session();
    let streamEnd: ((reason: string) => void) | undefined;
    wireDraftBuffer({ buffer, sessionAuth: auth, onStreamEnd: (hook) => { streamEnd = hook; } });
    return { store, buffer, auth, end: (reason: string) => streamEnd!(reason) };
  }

  it('noRole clears', async () => {
    const w = await wired();
    w.auth.publish({ kind: 'noRole' });
    await settle();
    expect(w.store.rows.size).toBe(0);
  });

  it('stream end forbidden clears; unauthorized and session (401) delete nothing; a signed-out state deletes nothing', async () => {
    const w = await wired();
    w.end('unauthorized');
    w.end('session');
    w.auth.publish({ kind: 'signedOut' });
    await settle();
    expect(w.store.rows.size).toBe(1);
    w.end('forbidden');
    await settle();
    expect(w.store.rows.size).toBe(0);
  });

  it('roles_changed sets the marker and deletes nothing; it falls on loading for another id and on clear', async () => {
    const w = await wired();
    w.end('roles_changed');
    await settle();
    expect(w.store.rows.size).toBe(1);
    expect(w.buffer.rolesChanged()).toBe(true);
    actor = { id: 'u-b' };
    await w.buffer.load();
    expect(w.buffer.rolesChanged()).toBe(false);
    w.end('roles_changed');
    expect(w.buffer.rolesChanged()).toBe(true);
    await w.buffer.clear();
    expect(w.buffer.rolesChanged()).toBe(false);
  });

  it('the demo has no session: wiring without sessionAuth is a no-op', async () => {
    const buffer = bufferOver(createMemoryStore());
    expect(() => wireDraftBuffer({ buffer, sessionAuth: undefined, onStreamEnd: () => undefined })).not.toThrow();
  });

  it('sign-out: the clear is complete before the sign-out request of the double is called', async () => {
    const d = deferredStore();
    const order: string[] = [];
    const buffer = bufferOver({ ...d.store, clear: () => d.store.clear().then(() => { order.push('cleared'); }) });
    await buffer.load();
    const signOut = vi.fn(async () => { order.push('request'); });
    const done = clearBeforeSignOut(buffer, signOut);
    await settle();
    expect(signOut).not.toHaveBeenCalled();
    await d.complete();
    await done;
    expect(order).toEqual(['cleared', 'request']);
  });

  it('a clear that never completes, or throws, holds sign-out for at most 1 s', async () => {
    vi.useFakeTimers();
    const hung: BufferStore = { ...createMemoryStore(), clear: () => new Promise<void>(() => undefined) };
    const signOut = vi.fn(async () => undefined);
    const done = clearBeforeSignOut(bufferOver(hung), signOut);
    await vi.advanceTimersByTimeAsync(999);
    expect(signOut).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(signOut).toHaveBeenCalledTimes(1);

    const throwing: BufferStore = { ...createMemoryStore(), clear: () => Promise.reject(new Error('blocked')) };
    const signOut2 = vi.fn(async () => undefined);
    await clearBeforeSignOut(bufferOver(throwing), signOut2);
    expect(signOut2).toHaveBeenCalledTimes(1);
  });
});

describe('never synchronises (source text without comments, nit N3)', () => {
  const source = readFileSync(decodeURIComponent(new URL('./draftBuffer.ts', import.meta.url).pathname), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

  it('names no network, broadcast, beacon, service worker, localStorage or HTML sink', () => {
    for (const word of ['fetch', 'BroadcastChannel', 'sendBeacon', 'serviceWorker', 'localStorage', 'innerHTML', 'XMLHttpRequest', 'WebSocket']) {
      expect(source, word).not.toContain(word);
    }
  });

  it('imports neither mode, http, actor nor auth', () => {
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of imports) expect(spec).not.toMatch(/\/(mode|http|actor|auth)$/);
  });

  it('declares the three storage constants under names that do not end on KEY/Key', () => {
    expect(source).toMatch(/export const BUFFER_DATABASE\b/);
    expect(source).toMatch(/export const BUFFER_OBJECT_STORE\b/);
    expect(source).toMatch(/export const BUFFER_SCHEMA\b/);
    expect(source).not.toMatch(/const \w*(KEY|Key)\s*=/);
  });
});

describe('notice (a persona switch seen on a read)', () => {
  it('once armed, another actor starts loading and deletes the previous actor’s entries; before arming nothing happens', async () => {
    const store = createMemoryStore();
    await store.put(entry({ ownerId: 'u-a' }));
    const buffer = bufferOver(store);
    actor = { id: 'u-b' };
    buffer.notice();
    await settle();
    expect(store.rows.size).toBe(1);
    actor = { id: 'u-a' };
    await buffer.load();
    actor = { id: 'u-b' };
    buffer.notice();
    await settle();
    expect(store.rows.size).toBe(0);
  });
});

describe('fix round (review 060)', () => {
  it('blocker 1: a store that always rejects is asked exactly once per actor id, however often views ask', async () => {
    const getAll = vi.fn(() => Promise.reject(new Error('blocked')));
    const store: BufferStore = { ...createMemoryStore(), getAll };
    const buffer = bufferOver(store);
    await buffer.load();
    expect(buffer.status()).toBe('unavailable');
    for (let i = 0; i < 50; i++) {
      buffer.entryFor('m-1', 'q-1');
      buffer.keptAt('m-1', 'q-1');
      buffer.notice();
    }
    await buffer.load();
    await settle();
    expect(getAll).toHaveBeenCalledTimes(1);
    actor = { id: 'u-b' };
    for (let i = 0; i < 50; i++) buffer.entryFor('m-1', 'q-1');
    await settle();
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  it('major 2: a put scheduled and then undone within 400 ms leaves no row', async () => {
    vi.useFakeTimers();
    const store = createMemoryStore();
    const buffer = bufferOver(store);
    await buffer.load();
    buffer.schedule(fields({ body: plain('weggenommen') }));
    vi.advanceTimersByTime(200);
    buffer.scheduleDelete({ ownerId: 'u-a', meetingId: 'm-1', questionId: 'q-1' });
    vi.advanceTimersByTime(1000);
    await settle();
    expect(store.rows.size).toBe(0);
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
  });

  it('minor 5: a clear during an in-flight load is not undone when the load lands', async () => {
    const inner = createMemoryStore();
    await inner.put(entry());
    let release: (() => void) | undefined;
    const store: BufferStore = {
      ...inner,
      getAll: async () => {
        const rows = await inner.getAll();
        await new Promise<void>((resolve) => { release = resolve; });
        return rows;
      },
    };
    const buffer = bufferOver(store);
    const loading = buffer.load();
    await settle();
    await buffer.clear();
    release!();
    await loading;
    expect(buffer.entryFor('m-1', 'q-1')).toBeUndefined();
    expect(inner.rows.size).toBe(0);
  });

  it('minor 6: an entry over 256 KiB serialised is rejected on read as well', async () => {
    const marks = Array.from({ length: 16 }, (_, i) => `m${String(i).padStart(30, '0')}`);
    const heavy: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: Array.from({ length: 2000 }, () => ({ text: '', marks })) }] };
    expect(sanitizeEntry(entry({ body: heavy }), NOW)).toBeUndefined();
    const store = createMemoryStore();
    await store.put(entry({ body: heavy }) as BufferEntry);
    const buffer = bufferOver(store);
    await buffer.load();
    expect(store.rows.size).toBe(0);
  });
});
