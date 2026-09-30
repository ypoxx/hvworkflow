import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, sealVerifiedLog, type DomainEvent, type NewEvent } from '@hv/domain';
import {
  createChainCache, createEntry, decide, extendEntry, MAX_CHECKPOINTS, prefixDigest, selectCheckpoint,
  type ChainCacheEntry, type Checkpoint,
} from '../persistence/chainCache.ts';
import { loadPostgresSnapshotCached } from '../persistence/postgres.ts';
import type { PoolClient } from 'pg';

const at = '2027-04-20T10:00:00.000Z';
const actor = { id: 'fixture', role: 'admin' as const };

function events(count: number, prefix = 'q'): DomainEvent[] {
  return JSON.parse(JSON.stringify(createInMemoryEventStore().append(Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index + 1}`, type: 'QuestionClosed', at, actor, subjectId: `${prefix}${index + 1}`, payload: {},
  }) as NewEvent)))) as DomainEvent[];
}

const digestOf = (text: string): string => createHash('sha256').update(text).digest('hex');
const rows = (count: number): string[] => Array.from({ length: count }, (_, index) => digestOf(`row-${index + 1}`));

function entryWith(count: number): ChainCacheEntry {
  return createEntry(sealVerifiedLog(undefined, events(count)), rows(count), new Map());
}

describe('takt-033: chain cache (pure logic, no Postgres)', () => {
  it('computes the prefix digest as sha256 over the concatenated row digests, order-sensitive', () => {
    const digests = rows(3);
    const expected = createHash('sha256').update(Buffer.concat(digests.map((hex) => Buffer.from(hex, 'hex')))).digest('hex');
    expect(prefixDigest(digests, 3)).toBe(expected);
    expect(prefixDigest(digests, 2)).not.toBe(expected);
    expect(prefixDigest([digests[1]!, digests[0]!, digests[2]!], 3)).not.toBe(expected);
    expect(prefixDigest([], 0)).toBe(createHash('sha256').update(Buffer.alloc(0)).digest('hex'));
    expect(() => prefixDigest(digests, 4)).toThrow();
  });

  it('starts an entry with one checkpoint at the end of its log', () => {
    const entry = entryWith(4);
    expect(entry.checkpoints).toEqual([{ seq: 4, lastHash: entry.log[3]!.hash, prefixDigest: prefixDigest(entry.rowDigests, 4) }]);
    const empty = createEntry(sealVerifiedLog(undefined, []), [], new Map());
    expect(empty.checkpoints).toEqual([{ seq: 0, lastHash: '', prefixDigest: prefixDigest([], 0) }]);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.checkpoints)).toBe(true);
    expect(() => createEntry(entry.log, rows(3), new Map())).toThrow();
  });

  it('bounds the checkpoints to the newest sixteen prefixes of the same log, moving forward only', () => {
    const all = events(MAX_CHECKPOINTS + 6);
    const digests = rows(all.length);
    let entry = createEntry(sealVerifiedLog(undefined, all.slice(0, 1)), digests.slice(0, 1), new Map());
    for (let seq = 2; seq <= all.length; seq++) {
      entry = extendEntry(entry, sealVerifiedLog(entry.log, all.slice(seq - 1, seq)), digests.slice(0, seq), new Map());
    }
    expect(entry.checkpoints).toHaveLength(MAX_CHECKPOINTS);
    expect(entry.checkpoints.map((point) => point.seq)).toEqual(
      Array.from({ length: MAX_CHECKPOINTS }, (_, index) => all.length - MAX_CHECKPOINTS + index + 1));
    for (const point of entry.checkpoints) {
      expect(point.lastHash).toBe(all[point.seq - 1]!.hash);
      expect(point.prefixDigest).toBe(prefixDigest(digests, point.seq));
    }
    // No new event: the same entry comes back (nothing to publish).
    expect(extendEntry(entry, entry.log, entry.rowDigests, entry.persons)).toBe(entry);
    // Never backwards, and never onto a log that does not continue this one.
    expect(() => extendEntry(entry, sealVerifiedLog(undefined, all.slice(0, 3)), digests.slice(0, 3), new Map())).toThrow();
    const foreign = sealVerifiedLog(undefined, events(all.length + 1, 'other-'));
    expect(() => extendEntry(entry, foreign, rows(foreign.length), new Map())).toThrow();
  });

  it('selects the largest checkpoint at or below the maximum seq', () => {
    const points: Checkpoint[] = [3, 7, 12].map((seq) => ({ seq, lastHash: `h${seq}`, prefixDigest: `d${seq}` }));
    expect(selectCheckpoint(points, 12)?.seq).toBe(12);
    expect(selectCheckpoint(points, 40)?.seq).toBe(12);
    expect(selectCheckpoint(points, 11)?.seq).toBe(7);
    expect(selectCheckpoint(points, 7)?.seq).toBe(7);
    expect(selectCheckpoint(points, 3)?.seq).toBe(3);
    expect(selectCheckpoint(points, 2)).toBeUndefined();
    expect(selectCheckpoint([], 5)).toBeUndefined();
  });

  it('decides incremental only for an unchanged, gap-free prefix at the cached end, full otherwise', () => {
    const entry = entryWith(5);
    const end = entry.checkpoints.at(-1)!;
    const probe = { count: 8, maxSeq: 8, checkpointSeq: 5, digest: end.prefixDigest };
    expect(decide(entry, probe)).toEqual({ kind: 'incremental', checkpoint: end });
    expect(decide(entry, { ...probe, count: 5, maxSeq: 5 })).toEqual({ kind: 'incremental', checkpoint: end });
    expect(decide(undefined, probe)).toEqual({ kind: 'full', reason: 'empty' });
    expect(decide(entry, { ...probe, count: 7 })).toEqual({ kind: 'full', reason: 'gap' });
    expect(decide(entry, { ...probe, digest: '0'.repeat(64) })).toEqual({ kind: 'full', reason: 'digest' });
    expect(decide(entry, { ...probe, checkpointSeq: 4 })).toEqual({ kind: 'full', reason: 'digest' });
    expect(decide(entry, { ...probe, count: 4, maxSeq: 4 })).toEqual({ kind: 'full', reason: 'shortened' });
    expect(decide(entry, { ...probe, count: 0, maxSeq: 0 })).toEqual({ kind: 'full', reason: 'shortened' });
  });

  it('publishes by compare-and-swap only onto the entry a request started from', () => {
    const cache = createChainCache();
    expect(cache.current()).toBeUndefined();
    const first = entryWith(2);
    const second = entryWith(3);
    const third = entryWith(4);
    expect(cache.compareAndSet(undefined, first)).toBe(true);
    expect(cache.current()).toBe(first);
    // A request that started before `first` was published loses its swap; the cache keeps `first`.
    expect(cache.compareAndSet(undefined, second)).toBe(false);
    expect(cache.current()).toBe(first);
    expect(cache.compareAndSet(first, second)).toBe(true);
    expect(cache.compareAndSet(first, third)).toBe(false);
    expect(cache.current()).toBe(second);
  });

  it('empties on an integrity error, whatever entry the failing request started from', () => {
    const cache = createChainCache();
    const first = entryWith(2);
    cache.compareAndSet(undefined, first);
    cache.invalidate();
    expect(cache.current()).toBeUndefined();
    // A late swap from a request that started on the discarded entry cannot bring it back.
    expect(cache.compareAndSet(first, entryWith(3))).toBe(false);
    expect(cache.current()).toBeUndefined();
  });

  it('keeps its own copy of the expected persons', () => {
    const persons = new Map([['m\0p', { meetingId: 'm', personId: 'p', displayName: 'X', keyId: 'm', sourceSeq: 1 }]]);
    const entry = createEntry(sealVerifiedLog(undefined, []), [], persons);
    persons.clear();
    expect(entry.persons.size).toBe(1);
  });
});

/**
 * Review finding 2: a write runs under READ COMMITTED, so the probe statement and the full path see different
 * snapshots. A fake client answers the probe as "unchanged" and then shows a changed database; the verified result
 * decides. Since Codex P1 (PR #88) probe and suffix are one statement (`CHAIN_SQL`); the fake answers it with a probe
 * that does not fit its own suffix (six rows reported, none returned), which must also run the full path.
 */
describe('takt-033: history change seen only after the probe (fake client, no Postgres)', () => {
  const rowOf = (event: DomainEvent) => ({ seq: String(event.seq), id: event.id, meeting_id: event.meetingId ?? null,
    hash: event.hash, prev_hash: event.prevHash, envelope: JSON.stringify(event) });
  const noRow = { seq: null, id: null, meeting_id: null, hash: null, prev_hash: null, envelope: null };

  function client(state: { probe?: { count: number; max: number; digest: string }; suffix: DomainEvent[]; full: DomainEvent[] }) {
    return { query: async (text: string) => {
      if (text.includes('count(*)')) {
        expect(text).toContain('events.seq > $1');
        const probe = { count: String(state.probe!.count), max_seq: String(state.probe!.max), digest: state.probe!.digest };
        return { rows: state.suffix.length === 0 ? [{ ...probe, ...noRow }] : state.suffix.map((event) => ({ ...probe, ...rowOf(event) })) };
      }
      if (text.includes('FROM persons')) return { rows: [] };
      return { rows: state.full.map(rowOf) };
    } } as unknown as PoolClient;
  }

  it.each([
    ['shortened', (original: DomainEvent[]) => original.slice(0, 3), true],
    ['rewritten', () => events(6, 'other-'), true],
    ['extended as expected', (original: DomainEvent[]) => [...original, ...events(6).slice(5)], false],
  ] as const)('reports the history as changed only when the verified full log does not continue the cache: %s',
    async (_label, fullAfter, changed) => {
      const original = events(5);
      const cache = createChainCache();
      const state: Parameters<typeof client>[0] = { suffix: [], full: original };
      const first = await loadPostgresSnapshotCached(client(state), cache);
      expect(first).toMatchObject({ hashed: 5, rowsRead: 5, historyChanged: false });
      const end = cache.current()!.checkpoints.at(-1)!;
      // The probe still sees the old, unchanged prefix plus one row; the suffix statement then finds nothing.
      state.probe = { count: 6, max: 6, digest: end.prefixDigest };
      state.suffix = [];
      state.full = fullAfter(original);
      const second = await loadPostgresSnapshotCached(client(state), cache);
      expect(second.historyChanged).toBe(changed);
      expect(second.hashed).toBe(state.full.length);
      expect(cache.current()!.log).toHaveLength(state.full.length);
    });
});
