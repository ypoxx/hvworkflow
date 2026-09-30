/**
 * `isReadForbidden` — the sole thing that decides between the "keine Leseberechtigung" state and a
 * generic error toast (slice 010b, Ziel 1/4). Test gap 8c (review round 2): every copy of this
 * function (`speakers/useSpeakers.ts`, `capture/useCapture.ts`, `answers/lib.ts`,
 * `history/lib.ts`) carries the same table, so a change to one that silently drifts from the
 * others fails loudly here.
 */
import { describe, expect, it } from 'vitest';
import type { Permission, Question, StageView } from '@hv/domain';
import {
  deliverTarget,
  isCurrentLoad,
  isReadForbidden,
  loadKey,
  lockHolds,
  nextButton,
  NO_VERDICT,
  readVerdict,
  returnTargetOf,
  returnWrite,
  stageOnlyByRights,
  shownQuestion,
} from './lib';
import type { DeliverLock, KeyedRead } from './lib';

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

/**
 * takt-039 — one pure rule for "Vorgelesen, weiter": the button (Podium.tsx) is drawn from it and the
 * handler (Page.tsx, click and Space) writes by it, so a button that looks free always writes and a
 * press that would not write always looks locked (Befund 1).
 */
function staged(id: string, version: number, actions: Permission[] = ['question.deliver']): Question {
  return {
    id, number: `F-${id}`, contributionId: 'c-1', speakerId: 's-1', text: id, status: 'staged',
    answers: [], version, createdAt: '2026-09-30T10:00:00.000Z', updatedAt: '2026-09-30T10:00:00.000Z',
    _actions: actions,
  };
}
const onStage = (current: Question | null): StageView => ({ current, queue: [], deliveredCount: 0, openCount: 0 });

describe('deliverTarget, lockHolds, nextButton (takt-039)', () => {
  const q = staged('q1', 4);

  it('(a) a drawn record that offers delivery and holds no lock is the target, also while a read is on its way', () => {
    // Befund 1, Punkt 3: a read used to take the record away from the keyboard until its answer came. The drawn stage
    // stays on screen during the read (design principle 8), and the rule reads only what is drawn.
    const drawnDuringRead = onStage(q);
    expect(deliverTarget(shownQuestion(drawnDuringRead), null, false)).toBe(q);
  });

  it('(b) a lock on the drawn question in the drawn version prevents the target', () => {
    const lock: DeliverLock = { id: 'q1', version: 4 };
    expect(lockHolds(lock, q)).toBe(true);
    expect(deliverTarget(q, lock, false)).toBeNull();
  });

  it('(b) a lock of another question or another version no longer holds (Befund 1, Punkt 4)', () => {
    expect(lockHolds({ id: 'q1', version: 4 }, staged('q2', 4))).toBe(false);
    expect(lockHolds({ id: 'q1', version: 4 }, staged('q1', 5))).toBe(false);
    expect(deliverTarget(staged('q2', 4), { id: 'q1', version: 4 }, false)).not.toBeNull();
    expect(deliverTarget(staged('q1', 5), { id: 'q1', version: 4 }, false)).not.toBeNull();
    expect(lockHolds(null, q)).toBe(false);
    expect(lockHolds({ id: 'q1', version: 4 }, null)).toBe(false);
  });

  it('(c) after an actor change (drawn stage null) and after a read refusal there is no target', () => {
    // Review 3 Minor 4 and Codex P2-B on 948a721: Page.tsx drops the stage in the render of the actor change and on
    // a refusal; the rule then has nothing of the previous actor to act on.
    expect(shownQuestion(null)).toBeNull();
    expect(deliverTarget(shownQuestion(null), null, false)).toBeNull();
    expect(deliverTarget(shownQuestion(onStage(null)), null, false)).toBeNull();
  });

  it('no target without question.deliver in _actions, and none while a return is written', () => {
    expect(deliverTarget(staged('q1', 4, ['question.return']), null, false)).toBeNull();
    expect(deliverTarget(q, null, true)).toBeNull();
  });

  it('(d) "button drawn and not locked" exactly when there is a target', () => {
    const questions = [null, q, staged('q1', 4, ['question.return']), staged('q1', 5), staged('q2', 4)];
    const locks: (DeliverLock | null)[] = [null, { id: 'q1', version: 4 }, { id: 'q2', version: 4 }];
    for (const question of questions) {
      for (const lock of locks) {
        for (const returning of [false, true]) {
          const button = nextButton(question, lock, returning);
          const target = deliverTarget(question, lock, returning);
          const label = JSON.stringify({ id: question?.id, v: question?.version, lock, returning });
          expect(button.drawn && !button.locked, label).toBe(target !== null);
          if (target !== null) expect(target, label).toBe(question);
          expect(button.drawn, label).toBe(question?._actions.includes('question.deliver') ?? false);
        }
      }
    }
  });
});

/**
 * takt-039, review minor 7 (Recht/Audit): "Antwort zurückgeben" writes for the question the dialog was opened on, with
 * that question's version, never for a question drawn later.
 */
describe('returnTargetOf, returnWrite (takt-039, minor 7)', () => {
  const a = staged('qa', 3, ['question.deliver', 'question.return']);

  it('the dialog opened for F-A writes for F-A with its version after the stage moved on to F-B', () => {
    const opened = returnTargetOf(a);
    expect(opened).toEqual({ id: 'qa', version: 3, number: 'F-qa' });
    // The stage now draws F-B (qb, version 7); the captured target does not follow it, and the write takes nothing
    // from the drawn stage (the in-process e2e in 010c proves the same through the page).
    expect(returnWrite(opened!, 'Grund')).toEqual({ questionId: 'qa', reason: 'Grund', ifMatch: '"v3"' });
  });

  it('no target without question.return in _actions, and none without a question', () => {
    expect(returnTargetOf(staged('qa', 3, ['question.deliver']))).toBeNull();
    expect(returnTargetOf(null)).toBeNull();
    expect(returnTargetOf(undefined)).toBeNull();
  });
});

/**
 * Scheibe 040a, Test 11: "Nur Bühne" by rights, moved unchanged from `Page.tsx`. The e2e case 020 m2
 * needed a demo role holding `question.deliver` together with working actions; after 040a none does,
 * so the rule is checked here with synthetic action lists instead (a move, not a weakening).
 */
describe('stageOnlyByRights (Scheibe 040a, moved from Page.tsx)', () => {
  it('is true for the read-out right alone', () => {
    expect(stageOnlyByRights(['question.deliver'])).toBe(true);
    expect(stageOnlyByRights(['question.deliver', 'question.return', 'question.close'])).toBe(true);
  });

  it('is false as soon as a working action comes with it', () => {
    for (const work of ['question.capture', 'question.classify', 'answer.draft', 'question.approve'] as const) {
      expect(stageOnlyByRights(['question.deliver', work]), work).toBe(false);
    }
  });

  it('is false without the read-out right', () => {
    expect(stageOnlyByRights([])).toBe(false);
    expect(stageOnlyByRights(['question.return', 'question.stage'])).toBe(false);
  });
});
