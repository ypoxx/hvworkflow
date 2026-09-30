/**
 * takt-033: the per-app cache of the verified event chain, as pure functions plus a compare-and-swap cell.
 *
 * The cache holds one sealed log (`VerifiedEventLog`, frozen, verified by the domain), the digest of every stored
 * row (`rowDigests[i]` belongs to seq i + 1, computed from the exact bytes the log was parsed from), the person rows
 * expected from that log, and up to `MAX_CHECKPOINTS` checkpoints, all prefixes of the same log, ascending.
 *
 * A request may trust the cached prefix only when the database itself reports an unchanged digest over all rows up
 * to the checkpoint, no gap, and no row below it lost (`decide`). Anything else is a full check (the path of
 * `loadPostgresSnapshot`). The cell only moves by compare-and-swap onto the entry a request started from; an
 * integrity error empties it unconditionally. No I/O here; the SQL side lives in `postgres.ts`.
 */
import { createHash } from 'node:crypto';
import type { VerifiedEventLog } from '@hv/domain';
import type { PersonRow } from './postgres.ts';

export const MAX_CHECKPOINTS = 16;

export interface Checkpoint {
  readonly seq: number;
  readonly lastHash: string;
  readonly prefixDigest: string;
}

export interface ChainCacheEntry {
  readonly log: VerifiedEventLog;
  readonly rowDigests: readonly string[];
  readonly persons: ReadonlyMap<string, PersonRow>;
  readonly checkpoints: readonly Checkpoint[];
}

/** What the database reported in the request's own snapshot (one statement). */
export interface ChainProbe {
  /** `count(*)` over all rows. */
  count: number;
  /** `max(seq)` over all rows, 0 for none. */
  maxSeq: number;
  /** The checkpoint seq the digest was computed for. */
  checkpointSeq: number;
  /** Digest over all rows with `seq <= checkpointSeq`, same encoding as `prefixDigest`. */
  digest: string;
}

export type ChainDecision =
  | { kind: 'incremental'; checkpoint: Checkpoint }
  | { kind: 'full'; reason: 'empty' | 'gap' | 'shortened' | 'digest' };

/** sha256 over the concatenated raw row digests of seq 1..`seq`, as hex (Postgres: `sha256(string_agg(...))`). */
export function prefixDigest(rowDigests: readonly string[], seq: number): string {
  if (!Number.isSafeInteger(seq) || seq < 0 || seq > rowDigests.length) throw new Error('Checkpoint beyond the cached rows.');
  const hash = createHash('sha256');
  for (let index = 0; index < seq; index++) hash.update(Buffer.from(rowDigests[index]!, 'hex'));
  return hash.digest('hex');
}

function checkpointAt(log: VerifiedEventLog, rowDigests: readonly string[]): Checkpoint {
  return Object.freeze({ seq: log.length, lastHash: log.at(-1)?.hash ?? '', prefixDigest: prefixDigest(rowDigests, log.length) });
}

function assertAligned(log: VerifiedEventLog, rowDigests: readonly string[]): void {
  if (rowDigests.length !== log.length) throw new Error('Row digests do not match the sealed log.');
}

/** A fresh entry after a full check: one checkpoint at the end of the log. */
export function createEntry(
  log: VerifiedEventLog, rowDigests: readonly string[], persons: ReadonlyMap<string, PersonRow>,
): ChainCacheEntry {
  assertAligned(log, rowDigests);
  return Object.freeze({ log, rowDigests: Object.freeze([...rowDigests]), persons,
    checkpoints: Object.freeze([checkpointAt(log, rowDigests)]) });
}

/**
 * The entry after an incremental load: `log` must continue `entry.log` (same hash at the old end). Adds a checkpoint
 * at the new end and keeps only the newest `MAX_CHECKPOINTS`. Without new events the same entry comes back.
 */
export function extendEntry(
  entry: ChainCacheEntry, log: VerifiedEventLog, rowDigests: readonly string[], persons: ReadonlyMap<string, PersonRow>,
): ChainCacheEntry {
  assertAligned(log, rowDigests);
  const end = entry.checkpoints.at(-1)!;
  if (log.length < end.seq || (log[end.seq - 1]?.hash ?? '') !== end.lastHash) {
    throw new Error('A checkpoint may only move forward within the same log.');
  }
  if (log.length === end.seq) return entry;
  const checkpoints = [...entry.checkpoints, checkpointAt(log, rowDigests)].slice(-MAX_CHECKPOINTS);
  return Object.freeze({ log, rowDigests: Object.freeze([...rowDigests]), persons, checkpoints: Object.freeze(checkpoints) });
}

/** The largest checkpoint with `seq <= maxSeq`, if any. */
export function selectCheckpoint(checkpoints: readonly Checkpoint[], maxSeq: number): Checkpoint | undefined {
  let selected: Checkpoint | undefined;
  for (const point of checkpoints) if (point.seq <= maxSeq && (selected === undefined || point.seq > selected.seq)) selected = point;
  return selected;
}

/**
 * Incremental only when the digest was taken at the cached end, the database lost no row below it (the largest
 * checkpoint at or below `max(seq)` is that end), there is no gap, and the digest matches. A request reads the cache
 * before its snapshot is taken, so its snapshot is never older than its entry: `max(seq)` below the cached end means
 * rows vanished (restore, rollback, truncation) and is checked in full, as the spec requires.
 */
export function decide(entry: ChainCacheEntry | undefined, probe: ChainProbe): ChainDecision {
  if (entry === undefined) return { kind: 'full', reason: 'empty' };
  if (probe.count !== probe.maxSeq) return { kind: 'full', reason: 'gap' };
  const end = entry.checkpoints.at(-1)!;
  if (selectCheckpoint(entry.checkpoints, probe.maxSeq) !== end) return { kind: 'full', reason: 'shortened' };
  if (probe.checkpointSeq !== end.seq || probe.digest !== end.prefixDigest) return { kind: 'full', reason: 'digest' };
  return { kind: 'incremental', checkpoint: end };
}

export interface ChainCache {
  current(): ChainCacheEntry | undefined;
  /** Publish `next` only if the cell still holds `expected`; a lost swap costs speed, never correctness. */
  compareAndSet(expected: ChainCacheEntry | undefined, next: ChainCacheEntry): boolean;
  /** Integrity error: empty the cell whatever it holds; the next request checks in full. */
  invalidate(): void;
}

export function createChainCache(): ChainCache {
  let cell: ChainCacheEntry | undefined;
  return {
    current: () => cell,
    compareAndSet(expected, next) {
      if (cell !== expected) return false;
      cell = next;
      return true;
    },
    invalidate() {
      // A request still running on the discarded entry cannot swap it back (identity differs from `undefined`).
      // One that started empty may publish its own fully verified result; the next request's digest check still
      // compares it against the database, so a later manipulation is found either way.
      cell = undefined;
    },
  };
}
