import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, sealVerifiedLog, type DomainEvent, type NewEvent } from '@hv/domain';
import {
  createChainCache, createEntry, decide, extendEntry, MAX_CHECKPOINTS, prefixDigest, selectCheckpoint,
  type ChainCacheEntry, type Checkpoint,
} from '../persistence/chainCache.ts';

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
});
