/**
 * Scheibe 053 (decision 6): the write door (Schreibtür) of a view over one selected question, lifted out of
 * `answers/Page.tsx` word for word so that the steering view uses the same door instead of a copy. Nothing of its
 * behaviour changed; the comments below are the page's own, with their slice and review references.
 *
 * Every write goes through `api` (HvApi) via `run`, carries `ifMatch: etagOf(question.version)` so that two people
 * cannot overwrite each other, and refetches on refusal — a 412 means somebody else wrote first, and the record, not
 * the interface, says what is true afterwards. The door also owns the open dialog and the "Stand veraltet" notice,
 * because both belong to the actor who opened or caused them (slice 010d).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { etagOf } from '@hv/domain';
import type { Permission, Question, WriteOptions } from '@hv/domain';
import { useActor } from '../../api/actor';
import { showProblem, showToast } from '../../components';
import { actionLabel, useT } from '../../i18n';
import { settleProblem } from './lib';

/** The question a write was made against, as it was read (takt-008), and by whom (slice 010d). */
interface WriteLock {
  id: string;
  /** The number the person knows the question by — named in the confirmation (010d, round 1). */
  number: string;
  version: number;
  actorId: string;
}

/**
 * The question on screen, the actor it was read for, and the selection the person has made (slice
 * 010d, Ziel 3). The last differs from the first while a newly selected question still loads: the
 * detail then shows the previous one, but the person has already moved on (review round 1, finding 1).
 */
interface Shown {
  id: string;
  actorId: string;
  selectedId: string | null;
}

export interface WriteDoor<D extends string> {
  run: (
    permission: Permission,
    write: (options: WriteOptions) => Promise<unknown>,
    onDone?: () => void,
    onProblem?: (error: unknown, stillShown: () => boolean) => boolean,
  ) => Promise<void>;
  busy: boolean;
  dialog: D | null;
  setDialog: (dialog: D | null) => void;
  /** The question a 412 notice stands above, or `null`. */
  staleFor: string | null;
  clearStale: () => void;
}

export function useWriteDoor<D extends string>({
  question,
  selectedId,
  reload,
}: {
  question: Question | null;
  selectedId: string | null;
  reload: () => void;
}): WriteDoor<D> {
  const t = useT();
  const [dialog, setDialog] = useState<D | null>(null);
  /**
   * takt-008: one write at a time, and the lock holds until the record on screen has caught up —
   * not merely until the write has answered. Buttons locked with `aria-disabled` keep focus, so a
   * second press can arrive while the detail still shows the version the first write was made
   * against; sent on, it would only meet its own 412 and a "Stand veraltet" notice (review round 1,
   * finding 3). Released when the question on screen is a different version or a different
   * question (or none), and at once when the write is refused.
   */
  const [lock, setLock] = useState<WriteLock | null>(null);
  // The same lock for a second activation in the same task, before React has rendered `lock`.
  const writing = useRef<WriteLock | null>(null);
  const busy = lock !== null;
  // A 412 gets its own notice instead of a toast (point 4) — the record moved under this view.
  // Slice 010d, review round 1, finding 1: the notice names the question it is about and stands
  // only above that one — a flag of the page landed above the next question once it had loaded.
  const [staleFor, setStaleFor] = useState<string | null>(null);

  const actorId = useActor().id;

  /**
   * Slice 010d, Ziel 1: an action dialog and the "Stand veraltet" notice belong to the actor who
   * opened or caused them. On an actor change both go in the same render (compared by `id`, never
   * by role, AGENTS.md rule 4): the next actor has been offered nothing yet.
   */
  const [viewActorId, setViewActorId] = useState(actorId);
  if (viewActorId !== actorId) {
    setViewActorId(actorId);
    setDialog(null);
    setStaleFor(null);
  }

  /**
   * Slice 010d, Ziel 3: the question on screen at this moment, read when a write answers. The
   * outcome of a write — "Stand veraltet", closing its dialog, emptying the draft — applies only
   * while its own question is still the one shown, for the actor who wrote. Otherwise it would land
   * on whatever question (or role) is shown by then. Kept after each commit, so it is exactly what
   * the person sees.
   */
  const shown = useRef<Shown | null>(null);
  useLayoutEffect(() => {
    shown.current = question === null ? null : { id: question.id, actorId, selectedId };
  }, [question, actorId, selectedId]);

  // Adjusted during render: the render that shows the new version is the one that unlocks.
  if (
    lock !== null &&
    (question === null || question.id !== lock.id || question.version !== lock.version)
  ) {
    setLock(null);
  }
  useEffect(() => {
    if (lock === null) writing.current = null;
  }, [lock]);

  // A fresh look at a (possibly different) question starts without yesterday's notice.
  useEffect(() => {
    setStaleFor(null);
  }, [selectedId]);

  /**
   * One door for every write: optimistic lock in, problem out, refetch on refusal. The permission
   * is only used to name the step in the confirmation — the decision was made by `_actions`.
   */
  const run = useCallback(
    async (
      permission: Permission,
      write: (options: WriteOptions) => Promise<unknown>,
      onDone?: () => void,
      // Scheibe 045 (decision 3): asked first on a refusal; `true` means handled — no toast, no "Stand
      // veraltet". It gets `stillShown` so that it acts only on the question it was written for.
      onProblem?: (error: unknown, stillShown: () => boolean) => boolean,
    ): Promise<void> => {
      if (question === null || writing.current !== null) return;
      const taken: WriteLock = {
        id: question.id,
        number: question.number,
        version: question.version,
        actorId,
      };
      writing.current = taken;
      setLock(taken);
      const step = { number: taken.number, action: actionLabel(t, permission) };
      // Slice 010d, Ziel 3: read at the moment of the answer, not when the write was sent — the
      // question is on screen for the actor who wrote, and it is still the one selected (review
      // round 1, finding 1: while the next selection loads, the detail still shows this one).
      //
      // Review round 2 (N1): emptying the draft is bound to the question on screen, not to the
      // selection — while the next selection loads, the editor of this very question is still
      // mounted with the saved text, and a person who comes back finds it there as if unsaved.
      const onScreen = (): boolean =>
        shown.current !== null &&
        shown.current.id === taken.id &&
        shown.current.actorId === taken.actorId;
      const stillShown = (): boolean =>
        onScreen() && shown.current !== null && shown.current.selectedId === taken.id;
      try {
        await write({ ifMatch: etagOf(question.version) });
        // The confirmation names the step and the question (review round 1, finding 2), so it
        // stands wherever the person is by now.
        showToast({
          tone: 'success',
          title: t('answers.toast.done'),
          detail: t('answers.toast.step', step),
        });
        if (stillShown()) setDialog(null);
        if (onScreen()) onDone?.();
      } catch (error) {
        // 412: somebody else wrote first — say so above the detail and reload; keep the toast for
        // every other refusal (403/409 among them). Slice 010d, Ziel 3: the notice stands above the
        // question it is about; once that question is no longer shown, the refusal is still
        // reported, as a toast in the house's words with the question's number (review round 1,
        // finding 2) — the server's own sentence names neither.
        const outcome = settleProblem(error, onProblem, stillShown);
        if (outcome === 'stale') {
          if (stillShown()) setStaleFor(taken.id);
          else {
            showToast({
              tone: 'danger',
              title: t('answers.toast.stale.title'),
              detail: t('answers.toast.stale.body', step),
            });
          }
        } else if (outcome === 'toast') showProblem(error, t('toast.problem'));
        // Refused: nothing changed on the record, so nothing to wait for — unlock at once. Slice
        // 010c, Ziel 6 (N2 of takt-008's Nachprüfung): only this write's own lock. Its lock may
        // already have fallen (the page moved on to another question), and a newer write may hold
        // the next one — an older write's refusal must not free that.
        if (writing.current === taken) writing.current = null;
        setLock((held) => (held === taken ? null : held));
        reload();
      }
    },
    [question, actorId, reload, t],
  );

  const clearStale = useCallback(() => setStaleFor(null), []);

  return { run, busy, dialog, setDialog, staleFor, clearStale };
}
