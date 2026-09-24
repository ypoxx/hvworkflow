/**
 * `isReadForbidden` — the sole thing that decides between the "keine Leseberechtigung" state and a
 * generic error toast (slice 010b, Ziel 1/4). Test gap 8c (review round 2): every copy of this
 * function (`capture/useCapture.ts`, `answers/lib.ts`, `stage/lib.ts`, `history/lib.ts`) carries
 * the same table, so a change to one that silently drifts from the others fails loudly here.
 */
import { describe, expect, it } from 'vitest';
import { isCurrentLoad, isReadForbidden, loadKey, readVerdict, settledFor } from './useSpeakers';

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

/**
 * Slice 010c — the key comparison of "Lesezustand je Ladevorgang". The same table stands in every
 * feature that keeps a copy (`speakers/useSpeakers.test.ts`, `capture/useCapture.test.ts`,
 * `answers/lib.test.ts`, `stage/lib.test.ts`, `history/lib.test.ts`), so a copy that drifts fails.
 */
describe('loadKey, isCurrentLoad, settledFor, readVerdict (slice 010c)', () => {
  const now = loadKey('u-exp-fin', 7);

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

  it('settledFor: only an answer of this very key has settled', () => {
    expect(settledFor(null, now)).toBe(false);
    expect(settledFor({ key: loadKey('u-podium', 6), status: 'forbidden' }, now)).toBe(false);
    expect(settledFor({ key: now, status: 'error' }, now)).toBe(true);
  });

  it('readVerdict: a failure of the current load lifts a refusal of an earlier one', () => {
    expect(readVerdict(true, [{ read: { key: now, status: 'error' }, key: now }])).toBe(false);
  });

  it('readVerdict: a refusal of the current load sets it, a ready answer lifts it', () => {
    expect(readVerdict(false, [{ read: { key: now, status: 'forbidden' }, key: now }])).toBe(true);
    expect(readVerdict(true, [{ read: { key: now, status: 'ready' }, key: now }])).toBe(false);
  });

  it('readVerdict: while the current load is on its way the previous verdict stands (no flicker)', () => {
    const earlier = { key: loadKey('u-obs', 6), status: 'forbidden' as const };
    expect(readVerdict(true, [{ read: earlier, key: now }])).toBe(true);
    expect(readVerdict(false, [{ read: earlier, key: now }])).toBe(false);
    expect(readVerdict(true, [{ read: null, key: now }])).toBe(true);
  });

  it('readVerdict: with several reads it waits for all of them, then any refusal counts', () => {
    const other = loadKey('u-exp-fin', '7:q');
    const ready = { key: now, status: 'ready' as const };
    expect(readVerdict(true, [{ read: ready, key: now }, { read: null, key: other }])).toBe(true);
    expect(
      readVerdict(false, [
        { read: ready, key: now },
        { read: { key: other, status: 'forbidden' }, key: other },
      ]),
    ).toBe(true);
  });
});
