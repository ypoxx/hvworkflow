/**
 * `isReadForbidden` — the sole thing that decides between the "keine Leseberechtigung" state and a
 * generic error toast (slice 010b, Ziel 1/4). Test gap 8c (review round 2): every copy of this
 * function (`speakers/useSpeakers.ts`, `answers/lib.ts`, `stage/lib.ts`, `history/lib.ts`) carries
 * the same table, so a change to one that silently drifts from the others fails loudly here.
 */
import { describe, expect, it } from 'vitest';
import {
  etagForContribution,
  isCurrentLoad,
  isReadForbidden,
  isSpeakerLocked,
  isVersionConflict,
  landPair,
  markAfterAnswer,
  keyBelongsTo,
  loadKey,
  NO_VERDICT,
  readVerdict,
} from './useCapture';
import type { KeyedRead } from './useCapture';

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

describe('Scheibe 028: conflict classification', () => {
  it('shows stale recovery for 412 and 428, not for rights or validation errors', () => {
    expect(isVersionConflict({ status: 412 })).toBe(true);
    expect(isVersionConflict({ status: 428 })).toBe(true);
    expect(isVersionConflict({ status: 403, ruleId: 'R-PERM-01' })).toBe(false);
    expect(isVersionConflict({ status: 422 })).toBe(false);
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

/** takt-032: continue with the version from the answer (Ziel 1), and land cards with coverage as a pair (Ziel 3). */
describe('etagForContribution', () => {
  const mark = { id: 'c1', base: 4, etag: '"v5"' };

  it('the tag of the answer is the next ifMatch for the same Redebeitrag', () => {
    expect(etagForContribution({ id: 'c1', version: 4 }, mark)).toBe('"v5"');
  });

  it('another Redebeitrag does not use it', () => {
    expect(etagForContribution({ id: 'c2', version: 4 }, mark)).toBe('"v4"');
  });

  it('a list read after the answer (another version) takes over', () => {
    expect(etagForContribution({ id: 'c1', version: 5 }, mark)).toBe('"v5"');
    expect(etagForContribution({ id: 'c1', version: 7 }, mark)).toBe('"v7"');
  });

  it('without a mark the version of the list counts', () => {
    expect(etagForContribution({ id: 'c1', version: 2 }, null)).toBe('"v2"');
  });
});

describe('isSpeakerLocked', () => {
  it('stays locked while the Wortmeldung still has the version the write was made on', () => {
    expect(isSpeakerLocked({ id: 's1', version: 3 }, { speakerId: 's1', base: 3 })).toBe(true);
  });

  it('opens once a list with another version has arrived, and for another Wortmeldung', () => {
    expect(isSpeakerLocked({ id: 's1', version: 4 }, { speakerId: 's1', base: 3 })).toBe(false);
    expect(isSpeakerLocked({ id: 's2', version: 3 }, { speakerId: 's1', base: 3 })).toBe(false);
    expect(isSpeakerLocked(undefined, { speakerId: 's1', base: 3 })).toBe(false);
    expect(isSpeakerLocked({ id: 's1', version: 3 }, null)).toBe(false);
  });
});

describe('landPair', () => {
  const old = { questions: ['q-old'], contributions: ['c-old'] };

  it('only the cards new: the old pair stays', () => {
    const next = landPair(old, {
      questions: ['q-new'], contributions: ['c-old'], questionsReady: true, contributionsReady: false,
    });
    expect(next).toBe(old);
  });

  it('only the coverage new: the old pair stays', () => {
    const next = landPair(old, {
      questions: ['q-old'], contributions: ['c-new'], questionsReady: false, contributionsReady: true,
    });
    expect(next).toBe(old);
  });

  it('both new: the new pair lands', () => {
    const next = landPair(old, {
      questions: ['q-new'], contributions: ['c-new'], questionsReady: true, contributionsReady: true,
    });
    expect(next).toEqual({ questions: ['q-new'], contributions: ['c-new'] });
  });

  it('the same data again returns the pair shown (safe to store during render)', () => {
    const next = landPair(old, {
      questions: old.questions, contributions: old.contributions, questionsReady: true, contributionsReady: true,
    });
    expect(next).toBe(old);
  });

  it('the first pair lands as soon as both are there', () => {
    expect(landPair(null, {
      questions: ['q'], contributions: ['c'], questionsReady: false, contributionsReady: true,
    })).toBeNull();
    expect(landPair(null, {
      questions: ['q'], contributions: ['c'], questionsReady: true, contributionsReady: true,
    })).toEqual({ questions: ['q'], contributions: ['c'] });
  });
});

/** Review of takt-032, major 1: three quick writes while a reload lands in between. */
describe('markAfterAnswer', () => {
  it('bases the mark on what is shown when the answer arrives, not on the closure the write began with', () => {
    // write 1 answered "v6" (shown v5); reload lands showing v6; write 2 (begun on v5) answers "v7".
    const mark = markAfterAnswer({ id: 'c1', version: 5 }, { id: 'c1', version: 6 }, '"v7"');
    expect(mark).toEqual({ id: 'c1', base: 6, etag: '"v7"' });
    expect(etagForContribution({ id: 'c1', version: 6 }, mark)).toBe('"v7"');
  });

  it('an older list landing after the answer does not undo it', () => {
    const mark = markAfterAnswer({ id: 'c1', version: 5 }, { id: 'c1', version: 6 }, '"v7"');
    expect(etagForContribution({ id: 'c1', version: 5 }, mark)).toBe('"v7"');
  });

  it('a list read after the answer takes over', () => {
    const mark = markAfterAnswer({ id: 'c1', version: 5 }, { id: 'c1', version: 6 }, '"v7"');
    expect(etagForContribution({ id: 'c1', version: 8 }, mark)).toBe('"v8"');
  });

  it('another Redebeitrag on screen leaves the closure version as the base', () => {
    expect(markAfterAnswer({ id: 'c1', version: 5 }, { id: 'c2', version: 9 }, '"v6"').base).toBe(5);
    expect(markAfterAnswer({ id: 'c1', version: 5 }, undefined, '"v6"').base).toBe(5);
  });
});
