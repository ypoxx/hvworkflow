/**
 * `isReadForbidden` — the sole thing that decides between the "keine Leseberechtigung" state and a
 * generic error toast (slice 010b, Ziel 1/4). Test gap 8c (review round 2): every copy of this
 * function (`speakers/useSpeakers.ts`, `capture/useCapture.ts`, `answers/lib.ts`, `stage/lib.ts`)
 * carries the same table, so a change to one that silently drifts from the others fails loudly
 * here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Actor, HvApi, Question, QuestionFilter, ReadEvent } from '@hv/domain';
import { createLiveStore } from '../../api/liveStore';
import {
  advanceStream,
  createDetailProblemGate,
  extendWindow,
  isCurrentLoad,
  isReadForbidden,
  keyBelongsTo,
  loadKey,
  mergeResultPages,
  NO_VERDICT,
  readResultPages,
  readVerdict,
  STREAM_SCAN_LIMIT,
  tableRows,
} from './lib';
import type { KeyedRead, PagedResults, ResultPage } from './lib';

describe('isReadForbidden', () => {
  it('R-PERM-02 (no read permission): true', () => {
    expect(isReadForbidden({ status: 403, ruleId: 'R-PERM-02' })).toBe(true);
  });

  it('R-PERM-03 (read scope exceeded): true', () => {
    expect(isReadForbidden({ status: 403, ruleId: 'R-PERM-03' })).toBe(true);
  });

  it('R-PERM-01 (no write permission, a 403 too): false — a denied write is not a denied read', () => {
    expect(isReadForbidden({ status: 403, ruleId: 'R-PERM-01' })).toBe(false);
  });

  it('404 (Festlegung 3\'s masked "not found"): false — never confused with a 403', () => {
    expect(isReadForbidden({ status: 404 })).toBe(false);
  });

  it('500 (a real fault, not a rule): false — still becomes an error toast', () => {
    expect(isReadForbidden({ status: 500 })).toBe(false);
  });
});

/** Codex (b) on 7f542b6, Codex P2-2 on 4f0d231, Codex P2-A on 948a721, nit C of review round 4
 *  and nit 2 of review round 5 — the same table in `answers/lib.test.ts` and `history/lib.test.ts`. */
describe('createDetailProblemGate', () => {
  const setup = () => {
    const shown: unknown[] = [];
    const gate = createDetailProblemGate((error) => shown.push(error));
    gate.select();
    return { shown, gate };
  };

  it('main refused, detail failed first: nothing shown (masked 404 after a role switch)', () => {
    const { shown, gate } = setup();
    gate.report('2', 'q1', { status: 404 });
    gate.settleMain('2', true);
    expect(shown).toEqual([]);
  });

  it('main refused first, detail failed after: nothing shown', () => {
    const { shown, gate } = setup();
    gate.settleMain('2', true);
    gate.report('2', 'q1', { status: 404 });
    expect(shown).toEqual([]);
  });

  it('main answered, detail failed: shown once, a second failure of the same pass is not', () => {
    const { shown, gate } = setup();
    gate.settleMain('2', false);
    gate.report('2', 'q1', 'a');
    gate.report('2', 'q1', 'b');
    expect(shown).toEqual(['a']);
  });

  it('detail failed before main answered (not refused): shown when main answers', () => {
    const { shown, gate } = setup();
    gate.report('3', 'q1', 'a');
    expect(shown).toEqual([]);
    gate.settleMain('3', false);
    expect(shown).toEqual(['a']);
  });

  it('an overtaken load never reports, the next selection still does', () => {
    const { shown, gate } = setup();
    gate.settleMain('1', false);
    gate.report('2', 'q1', 'old');
    gate.select();
    gate.report('3', 'q2', 'new');
    gate.settleMain('3', false);
    expect(shown).toEqual(['new']);
  });

  it('A fails (shown), B, then A again fails: shown again — a new pass (nit 2, round 5)', () => {
    const { shown, gate } = setup();
    gate.settleMain('1', false);
    gate.report('1', 'A', 'first');
    gate.select();
    gate.select();
    gate.report('1', 'A', 'second');
    expect(shown).toEqual(['first', 'second']);
  });

  it('main answered but leaves the question out (scoped list): nothing shown (Codex P2-A)', () => {
    const { shown, gate } = setup();
    gate.report('4', 'q1', { status: 404 });
    gate.settleMain('4', false, (id) => id === 'q1');
    gate.report('4', 'q1', { status: 404 });
    expect(shown).toEqual([]);
  });

  it('omits sees the failure: a 404 left out is dropped, a 500 is shown (slice 010c, round 2)', () => {
    const { shown, gate } = setup();
    const onlyMasked = (id: string, error: unknown) =>
      id === 'q1' && (error as { status?: number }).status === 404;
    gate.settleMain('5', false, onlyMasked);
    gate.report('5', 'q1', { status: 404 });
    expect(shown).toEqual([]);
    gate.select();
    gate.report('5', 'q1', { status: 500 });
    expect(shown).toEqual([{ status: 500 }]);
  });

  it('every failure of a pass counts: 404 then 500, list last and without the selection → 500 (R3-1)', () => {
    const onlyMasked = (id: string, error: unknown) =>
      id === 'q1' && (error as { status?: number }).status === 404;
    const first = setup();
    first.gate.report('6', 'q1', { status: 404 });
    first.gate.report('6', 'q1', { status: 500 });
    first.gate.settleMain('6', false, onlyMasked);
    expect(first.shown).toEqual([{ status: 500 }]);
    const mirror = setup();
    mirror.gate.report('6', 'q1', { status: 500 });
    mirror.gate.report('6', 'q1', { status: 404 });
    mirror.gate.settleMain('6', false, onlyMasked);
    expect(mirror.shown).toEqual([{ status: 500 }]);
    const both = setup();
    both.gate.report('6', 'q1', { status: 404 });
    both.gate.report('6', 'q1', { status: 404 });
    both.gate.settleMain('6', false, onlyMasked);
    expect(both.shown).toEqual([]);
  });

  it('every failure of a pass counts, list first: 404 dropped, 500 shown, a further failure not (010d, Ziel 4)', () => {
    const onlyMasked = (id: string, error: unknown) =>
      id === 'q1' && (error as { status?: number }).status === 404;
    const { shown, gate } = setup();
    gate.settleMain('7', false, onlyMasked);
    gate.report('7', 'q1', { status: 404 });
    expect(shown).toEqual([]);
    gate.report('7', 'q1', { status: 500 });
    expect(shown).toEqual([{ status: 500 }]);
    gate.report('7', 'q1', { status: 503 });
    expect(shown).toEqual([{ status: 500 }]);
  });
});

/**
 * Slice 010c — the key comparison of "Lesezustand je Ladevorgang". The same table stands in every
 * feature that keeps a copy (`speakers/useSpeakers.test.ts`, `capture/useCapture.test.ts`,
 * `answers/lib.test.ts`, `stage/lib.test.ts`, `history/lib.test.ts`), so a copy that drifts fails.
 */
describe('loadKey, isCurrentLoad, readVerdict (slice 010c)', () => {
  const now = loadKey('u-exp-fin', 7);
  const one = (read: KeyedRead | null) => [{ read, key: now }];

  it('the same actor at the same version is the same load', () => {
    expect(loadKey('u-exp-fin', 7)).toBe(now);
    expect(isCurrentLoad(now, loadKey('u-exp-fin', 7))).toBe(true);
  });

  it('a newer version overtakes a load: its answer does not report', () => {
    expect(isCurrentLoad(now, loadKey('u-exp-fin', 8))).toBe(false);
  });

  it('another actor at the same version (the gap before the version bump) does not report', () => {
    expect(isCurrentLoad(now, loadKey('u-podium', 7))).toBe(false);
  });

  it('a view that has moved on (effect cleaned up) takes no answer', () => {
    expect(isCurrentLoad(now, null)).toBe(false);
  });

  it('keys do not collide across the actor/version boundary', () => {
    expect(loadKey('a', 12)).not.toBe(loadKey('a1', 2));
    expect(loadKey('a', '1:2')).not.toBe(loadKey('a:1', 2));
  });

  it('readVerdict: a failure of the current load lifts a refusal given to another actor', () => {
    const podium = { actor: 'u-podium', forbidden: true };
    expect(readVerdict(podium, one({ key: now, status: 'error' }), 'u-exp-fin')).toEqual({
      actor: 'u-exp-fin',
      forbidden: false,
    });
  });

  it('readVerdict: a plain failure of the same actor keeps its refusal (finding 4)', () => {
    const refused = { actor: 'u-exp-fin', forbidden: true };
    expect(readVerdict(refused, one({ key: now, status: 'error' }), 'u-exp-fin')).toBe(refused);
  });

  it('readVerdict: a refusal of the current load sets it, a ready answer lifts it', () => {
    expect(readVerdict(NO_VERDICT, one({ key: now, status: 'forbidden' }), 'u-exp-fin')).toEqual({
      actor: 'u-exp-fin',
      forbidden: true,
    });
    const refused = { actor: 'u-exp-fin', forbidden: true };
    expect(readVerdict(refused, one({ key: now, status: 'ready' }), 'u-exp-fin').forbidden).toBe(
      false,
    );
  });

  it('readVerdict: while the current load is on its way the previous verdict stands (no flicker)', () => {
    const earlier = { key: loadKey('u-obs', 6), status: 'forbidden' as const };
    const observer = { actor: 'u-obs', forbidden: true };
    expect(readVerdict(observer, one(earlier), 'u-exp-fin')).toBe(observer);
    expect(readVerdict(NO_VERDICT, one(earlier), 'u-exp-fin')).toBe(NO_VERDICT);
    expect(readVerdict(observer, one(null), 'u-exp-fin')).toBe(observer);
  });

  it('readVerdict: an unchanged verdict is the same object (safe to store during render)', () => {
    const ready = { actor: 'u-exp-fin', forbidden: false };
    expect(readVerdict(ready, one({ key: now, status: 'ready' }), 'u-exp-fin')).toBe(ready);
    expect(readVerdict(ready, one({ key: now, status: 'error' }), 'u-exp-fin')).toBe(ready);
  });

  it('readVerdict: with several reads it waits for all, then any refusal counts', () => {
    const other = loadKey('u-exp-fin', '7:q');
    const ready = { key: now, status: 'ready' as const };
    const refused = { actor: 'u-exp-fin', forbidden: true };
    expect(readVerdict(refused, [{ read: ready, key: now }, { read: null, key: other }], 'u-exp-fin')).toBe(
      refused,
    );
    expect(
      readVerdict(
        NO_VERDICT,
        [
          { read: ready, key: now },
          { read: { key: other, status: 'forbidden' }, key: other },
        ],
        'u-exp-fin',
      ).forbidden,
    ).toBe(true);
  });

  it('readVerdict: the same actor keeps its refusal only if every read failed', () => {
    const other = loadKey('u-exp-fin', '7:q');
    const refused = { actor: 'u-exp-fin', forbidden: true };
    const failed = { key: now, status: 'error' as const };
    expect(
      readVerdict(refused, [{ read: failed, key: now }, { read: { key: other, status: 'error' }, key: other }], 'u-exp-fin'),
    ).toBe(refused);
    expect(
      readVerdict(
        refused,
        [
          { read: failed, key: now },
          { read: { key: other, status: 'ready' }, key: other },
        ],
        'u-exp-fin',
      ).forbidden,
    ).toBe(false);
  });

  it('readVerdict: no reads (nothing was asked): the same actor keeps its verdict, another starts unrefused', () => {
    const refused = { actor: 'u-exp-fin', forbidden: true };
    expect(readVerdict(refused, [], 'u-exp-fin')).toBe(refused);
    expect(readVerdict(refused, [], 'u-podium')).toEqual({ actor: 'u-podium', forbidden: false });
    expect(readVerdict(NO_VERDICT, [], 'u-exp-fin')).toEqual({ actor: 'u-exp-fin', forbidden: false });
  });
});

/**
 * Slice 010d — whose data a view may offer. The same table stands in every feature that keeps a
 * copy (`speakers/useSpeakers.test.ts`, `capture/useCapture.test.ts`, `answers/lib.test.ts`,
 * `history/lib.test.ts`), so a copy that drifts fails.
 */
describe('keyBelongsTo (slice 010d)', () => {
  it('a load of the same actor belongs to it, at any version and scope', () => {
    expect(keyBelongsTo(loadKey('u-exp-fin', 7), 'u-exp-fin')).toBe(true);
    expect(keyBelongsTo(loadKey('u-exp-fin', '3:q-1'), 'u-exp-fin')).toBe(true);
  });

  it('a load of another actor does not, whatever the version', () => {
    expect(keyBelongsTo(loadKey('u-podium', 7), 'u-exp-fin')).toBe(false);
  });

  it('an actor id that is a prefix of another does not collide', () => {
    expect(keyBelongsTo(loadKey('u-a', 1), 'u-ab')).toBe(false);
    expect(keyBelongsTo(loadKey('u-ab', 1), 'u-a')).toBe(false);
  });

  it('an actor id with quotes or separators is compared whole', () => {
    expect(keyBelongsTo(loadKey('a","b', 1), 'a')).toBe(false);
    expect(keyBelongsTo(loadKey('a","b', 1), 'a","b')).toBe(true);
  });

  it('no load yet (null) belongs to nobody', () => {
    expect(keyBelongsTo(null, 'u-exp-fin')).toBe(false);
  });
});

/* ---------------------------------------------------------------------------------------------
 * takt-038 — Historie paginiert, Ereignisstrom-Reiter inkrementell.
 * ------------------------------------------------------------------------------------------- */

type Item = { id: string; v?: number };
const items = (from: number, to: number): Item[] =>
  Array.from({ length: to - from }, (_, i) => ({ id: `q${from + i}` }));
const page = (list: Item[], total: number): ResultPage<Item> => ({ items: list, total });

describe('mergeResultPages (takt-038 Ziel 1)', () => {
  it('(a) a second page is appended in order, no duplicate by id', () => {
    const first = mergeResultPages(null, [page(items(0, 3), 5)], 3);
    expect(first).not.toBeNull();
    const both = mergeResultPages(first, [page(items(0, 3), 5), page(items(3, 5), 5)], 3);
    expect(both?.total).toBe(5);
    expect(both?.pages.flat().map((item) => item.id)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4']);
  });

  it('(a) a duplicate id at the page boundary is refused', () => {
    expect(mergeResultPages(null, [page(items(0, 3), 6), page(items(2, 5), 6)], 3)).toBeNull();
  });

  it('(a) a missing id at the page boundary (short inner page) is refused', () => {
    expect(mergeResultPages(null, [page(items(0, 2), 5), page(items(3, 5), 5)], 3)).toBeNull();
  });

  it('(b) a different total between the pages is refused', () => {
    expect(mergeResultPages(null, [page(items(0, 3), 5), page(items(3, 5), 6)], 3)).toBeNull();
  });

  it('(b) a smaller total than the pages shown before: the further pages are dropped', () => {
    const previous = mergeResultPages(null, [page(items(0, 3), 6), page(items(3, 6), 6)], 3);
    expect(previous).not.toBeNull();
    expect(mergeResultPages(previous, [page(items(0, 3), 5), page(items(3, 5), 5)], 3)).toBeNull();
  });

  it('(b) a shifted first page: the further pages are dropped', () => {
    const previous = mergeResultPages(null, [page(items(0, 3), 6), page(items(3, 6), 6)], 3);
    const shifted = [page(items(1, 4), 6), page(items(4, 7), 6)];
    expect(mergeResultPages(previous, shifted, 3)).toBeNull();
  });

  it('(b) the first page alone always stands (nothing to piece together)', () => {
    const previous: PagedResults<Item> = { pages: [items(0, 3), items(3, 6)], total: 6 };
    expect(mergeResultPages(previous, [page(items(1, 4), 4)], 3)?.pages).toEqual([items(1, 4)]);
  });

  it('a growing total keeps the loaded pages', () => {
    const previous = mergeResultPages(null, [page(items(0, 3), 5), page(items(3, 5), 5)], 3);
    const grown = mergeResultPages(previous, [page(items(0, 3), 7), page(items(3, 6), 7)], 3);
    expect(grown?.pages.flat()).toHaveLength(6);
    expect(grown?.total).toBe(7);
  });
});

describe('readResultPages over the live store (takt-038 (a2))', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a2) a question on page 2 changes at the same total and first page: page 2 shows the new object', async () => {
    vi.useFakeTimers();
    const actor: Actor = { id: 'a1', role: 'coordination', displayName: 'A' } as Actor;
    const corpus: Item[] = items(0, 5);
    let calls = 0;
    const adapter = {
      listQuestions: (filter: QuestionFilter = {}) => {
        calls += 1;
        const offset = filter.offset ?? 0;
        const limit = filter.limit ?? 500;
        return Promise.resolve({ items: corpus.slice(offset, offset + limit).map((item) => ({ ...item })), total: corpus.length });
      },
      subscribe: () => () => undefined,
    };
    const store = createLiveStore(adapter as unknown as HvApi, {
      getActor: () => actor,
      now: () => 0,
      monotonic: () => 0,
    });
    const stop = store.subscribe(() => undefined);
    const api = store as Pick<HvApi, 'listQuestions'>;

    const before = await readResultPages(api, {}, 2, 3);
    const shown = mergeResultPages(null, before as ResultPage<Question>[], 3);
    expect(shown?.pages[1]?.[0]).toEqual({ id: 'q3' });
    expect(calls).toBe(2);

    // Without a change both pages come from the buffer.
    await readResultPages(api, {}, 2, 3);
    expect(calls).toBe(2);

    corpus[3] = { id: 'q3', v: 2 };
    store.onStreamMessage([], { seq: 9, topics: ['questions'] });
    await vi.advanceTimersByTimeAsync(100);

    const after = await readResultPages(api, {}, 2, 3);
    const next = mergeResultPages(shown, after as ResultPage<Question>[], 3);
    expect(next?.pages[0]?.map((item) => item.id)).toEqual(['q0', 'q1', 'q2']);
    expect(next?.pages[1]?.[0]).toEqual({ id: 'q3', v: 2 });
    stop();
  });

  it('reads the pages by offset with the page size as limit and keeps the filter', async () => {
    const asked: QuestionFilter[] = [];
    const api = {
      listQuestions: (filter: QuestionFilter = {}) => {
        asked.push(filter);
        return Promise.resolve({ items: [], total: 0 });
      },
    } as unknown as Pick<HvApi, 'listQuestions'>;
    await readResultPages(api, { q: 'Dividende' }, 3, 200);
    expect(asked).toEqual([
      { q: 'Dividende', limit: 200, offset: 0 },
      { q: 'Dividende', limit: 200, offset: 200 },
      { q: 'Dividende', limit: 200, offset: 400 },
    ]);
  });
});

const ev = (seq: number): ReadEvent => ({ seq, at: '2026-09-30T10:00:00.000Z', type: 'X' }) as unknown as ReadEvent;
const seqs = (list: readonly ReadEvent[]): number[] => list.map((event) => event.seq);

/** An event log as a fake `listEvents`: `seq` 1..head, optionally failing on the n-th call. */
function fakeLog(initial: number) {
  let head = initial;
  let failOn: number | undefined;
  const calls: { after: number; limit: number }[] = [];
  const api: Pick<HvApi, 'listEvents'> = {
    listEvents: (after = 0, limit = 1000) => {
      calls.push({ after, limit });
      if (failOn !== undefined && calls.length === failOn) return Promise.reject(new Error('page failed'));
      const out: ReadEvent[] = [];
      for (let seq = after + 1; seq <= head && out.length < limit; seq++) out.push(ev(seq));
      return Promise.resolve({ items: out, lastSeq: head });
    },
  };
  return {
    api,
    calls,
    grow: (n: number) => { head += n; },
    setHead: (n: number) => { head = n; },
    failOnCall: (n: number) => { failOn = calls.length + n; },
  };
}

describe('stream window (takt-038 Ziel 2)', () => {
  it('(c) extendWindow appends new events, capped, the oldest fall out', () => {
    const held = [ev(1), ev(2), ev(3)];
    expect(seqs(extendWindow(held, [ev(4)], 10))).toEqual([1, 2, 3, 4]);
    expect(seqs(extendWindow(held, [ev(4), ev(5)], 4))).toEqual([2, 3, 4, 5]);
    expect(STREAM_SCAN_LIMIT).toBe(5000);
  });

  it('(c) the first load reads the trailing window only; a later count reads only what is new', async () => {
    const log = fakeLog(12);
    const first = await advanceStream(log.api, null, { pageSize: 5, windowLimit: 5 });
    expect(seqs(first.events)).toEqual([8, 9, 10, 11, 12]);
    expect(first.cursor).toBe(12);
    log.grow(2);
    const next = await advanceStream(log.api, first, { pageSize: 5, windowLimit: 5 });
    expect(seqs(next.events)).toEqual([10, 11, 12, 13, 14]);
    expect(next.cursor).toBe(14);
    expect(log.calls.at(-1)).toEqual({ after: 12, limit: 5 });
  });

  it('(c) an unchanged head keeps the very same window object', async () => {
    const log = fakeLog(3);
    const first = await advanceStream(log.api, null, { pageSize: 5, windowLimit: 5 });
    const again = await advanceStream(log.api, first, { pageSize: 5, windowLimit: 5 });
    expect(again).toBe(first);
  });

  it('(c2) 7000 new events between two counts: paged to the head, window ends at the head without a gap', async () => {
    const log = fakeLog(100);
    const options = { pageSize: 1000, windowLimit: 5000 };
    const first = await advanceStream(log.api, null, options);
    log.grow(7000);
    const next = await advanceStream(log.api, first, options);
    expect(next.cursor).toBe(7100);
    expect(next.events).toHaveLength(5000);
    expect(next.events.at(-1)?.seq).toBe(7100);
    expect(next.events[0]?.seq).toBe(2101);
    const gaps = next.events.filter((event, i) => i > 0 && event.seq !== (next.events[i - 1]?.seq ?? 0) + 1);
    expect(gaps).toEqual([]);
  });

  it('(c2) several pages appended when the head is within the window', async () => {
    const log = fakeLog(100);
    const options = { pageSize: 1000, windowLimit: 5000 };
    const first = await advanceStream(log.api, null, options);
    log.grow(3500);
    const next = await advanceStream(log.api, first, options);
    expect(next.cursor).toBe(3600);
    expect(seqs(next.events)).toEqual(Array.from({ length: 3600 }, (_, i) => i + 1));
  });

  it('(c2) a failing second page leaves cursor and window unchanged', async () => {
    const log = fakeLog(100);
    const options = { pageSize: 1000, windowLimit: 5000 };
    const first = await advanceStream(log.api, null, options);
    const snapshot = { cursor: first.cursor, events: [...first.events] };
    log.grow(7000);
    log.failOnCall(2);
    await expect(advanceStream(log.api, first, options)).rejects.toThrow('page failed');
    expect(first.cursor).toBe(snapshot.cursor);
    expect(seqs(first.events)).toEqual(seqs(snapshot.events));
  });

  it('(d) lastSeq below the last seq (restore): the window is dropped and read afresh', async () => {
    const log = fakeLog(20);
    const first = await advanceStream(log.api, null, { pageSize: 5, windowLimit: 5 });
    log.setHead(3);
    const next = await advanceStream(log.api, first, { pageSize: 5, windowLimit: 5 });
    expect(seqs(next.events)).toEqual([1, 2, 3]);
    expect(next.cursor).toBe(3);
  });
});

describe('tableRows (takt-038 (e))', () => {
  const window = Array.from({ length: 450 }, (_, i) => ev(i + 1));

  it('(e) 200 rows per page, newest first, with older rows left to load', () => {
    const one = tableRows(window, 1);
    expect(one.rows).toHaveLength(200);
    expect(one.rows[0]?.seq).toBe(450);
    expect(one.hasOlder).toBe(true);
    const two = tableRows(window, 2);
    expect(two.rows).toHaveLength(400);
    expect(two.rows.at(-1)?.seq).toBe(51);
    const three = tableRows(window, 3);
    expect(three.rows).toHaveLength(450);
    expect(three.hasOlder).toBe(false);
  });
});
