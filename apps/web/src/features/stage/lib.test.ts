/**
 * `isReadForbidden` — the sole thing that decides between the "keine Leseberechtigung" state and a
 * generic error toast (slice 010b, Ziel 1/4). Test gap 8c (review round 2): every copy of this
 * function (`speakers/useSpeakers.ts`, `capture/useCapture.ts`, `answers/lib.ts`,
 * `history/lib.ts`) carries the same table, so a change to one that silently drifts from the
 * others fails loudly here.
 */
import { describe, expect, it } from 'vitest';
import { isCurrentLoad, isReadForbidden, loadKey, NO_VERDICT, readVerdict } from './lib';
import type { KeyedRead } from './lib';

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
