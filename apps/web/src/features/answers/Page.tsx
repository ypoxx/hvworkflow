/**
 * Beantwortung — the afternoon under pressure: the backlog on the left, one question on the right,
 * and the steps that move it towards the podium.
 *
 * This page owns the writes. Every one of them goes through `api` (HvApi), carries
 * `ifMatch: etagOf(question.version)` so that two people cannot overwrite each other, and refetches
 * on refusal — a 412 means somebody else wrote first, and the record, not the interface, says what
 * is true afterwards.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { etagOf } from '@hv/domain';
import type { Permission, WriteOptions } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import {
  EmptyState,
  Panel,
  PageHeader,
  SplitPane,
  StaleBanner,
  showProblem,
  showToast,
} from '../../components';
import { actionLabel, useT } from '../../i18n';
import { AssignDialog, MergeDialog, ReasonDialog } from './ActionDialogs';
import { QuestionDetail } from './QuestionDetail';
import type { DetailAction } from './QuestionDetail';
import { WorkList } from './WorkList';
import { problemStatus, splitSources } from './lib';
import { EMPTY_FILTERS, useBacklog } from './useBacklog';
import type { Filters } from './useBacklog';

type OpenDialog = 'return' | 'assign' | 'merge' | 'withdraw' | null;

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

export function AnswersPage() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
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
  const [draftResetToken, setDraftResetToken] = useState(0);
  // A 412 gets its own notice instead of a toast (point 4) — the record moved under this view.
  // Slice 010d, review round 1, finding 1: the notice names the question it is about and stands
  // only above that one — a flag of the page landed above the next question once it had loaded.
  const [staleFor, setStaleFor] = useState<string | null>(null);

  const backlog = useBacklog(filters, selectedId);
  const { reload, selected: question } = backlog;
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
        if (problemStatus(error) === 412) {
          if (stillShown()) setStaleFor(taken.id);
          else {
            showToast({
              tone: 'danger',
              title: t('answers.toast.stale.title'),
              detail: t('answers.toast.stale.body', step),
            });
          }
        } else showProblem(error, t('toast.problem'));
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

  const onAction = useCallback(
    (action: DetailAction) => {
      if (question === null) return;
      const id = question.id;
      switch (action.kind) {
        case 'draft': {
          const sources = splitSources(action.sources);
          void run(
            'answer.draft',
            (options) =>
              api.draftAnswer(
                id,
                { text: action.text.trim(), ...(sources.length > 0 ? { sources } : {}) },
                options,
              ),
            // Only the draft of the question it was written for (slice 010d, Ziel 3).
            () => setDraftResetToken((value) => value + 1),
          );
          break;
        }
        case 'submit_review':
          void run('question.submit_review', (options) => api.submitForReview(id, options));
          break;
        case 'approve':
          void run('question.approve', (options) =>
            api.approveQuestion(id, action.version, options),
          );
          break;
        case 'stage':
          void run('question.stage', (options) => api.stageQuestion(id, options));
          break;
        case 'open-return':
          setDialog('return');
          break;
        case 'open-assign':
          setDialog('assign');
          break;
        case 'open-merge':
          setDialog('merge');
          break;
        case 'open-withdraw':
          setDialog('withdraw');
          break;
      }
    },
    [question, run],
  );

  /** The merge target is picked by number; the identifier comes from the corpus, never from a guess. */
  const resolveNumber = useCallback(async (number: string): Promise<string | undefined> => {
    const page = await api.listQuestions({ q: number, limit: 50 });
    const wanted = number.trim().toLowerCase();
    return page.items.find((item) => item.number.toLowerCase() === wanted)?.id;
  }, []);

  // Slice 010d, Ziel 2: the list could not be read and nothing is open — its own Fehlerzustand
  // (WorkList.tsx) says what happened; "select a question on the left" would not be true.
  const detailSilent =
    backlog.listForbidden || (backlog.listFailed && question === null && !backlog.selectedLoading);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={t('page.answers.title')} description={t('page.answers.description')} />

      <SplitPane
        storageKey="hv-answers-split-v1"
        initial={46}
        min={30}
        max={70}
        className="min-h-0 flex-1"
        left={
          <WorkList
            filters={filters}
            onFilters={setFilters}
            backlog={backlog}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        }
        right={
          // Minor 6 (review round 2): the backlog is itself unreadable (e.g. podium) — "select a
          // question on the left" is not honest when there is no left to select one from. The
          // Hauptabfrage's own gestalteter Zustand (`answers-forbidden`, WorkList.tsx) already
          // covers the whole story; the right pane says nothing rather than something misleading.
          //
          // Slice 010d, Ziel 2: the same when the list could not be read (`detailSilent`).
          detailSilent ? null : question === null ? (
            <Panel className="h-full" bodyClassName="flex items-center justify-center">
              <EmptyState
                icon={FileQuestion}
                title={
                  backlog.selectedLoading
                    ? t('answers.detail.loading')
                    : t('answers.detail.empty.title')
                }
                {...(backlog.selectedLoading
                  ? {}
                  : { description: t('answers.detail.empty.body') })}
              />
            </Panel>
          ) : (
            <div data-testid="answers-detail" className="flex h-full min-h-0 flex-col gap-2">
              {staleFor === question.id && (
                <StaleBanner
                  testId="stale-banner"
                  message={t('answers.stale.banner')}
                  onReload={() => {
                    setStaleFor(null);
                    reload();
                  }}
                />
              )}
              <div className="min-h-0 flex-1">
                <QuestionDetail
                  key={question.id}
                  question={question}
                  history={backlog.selectedHistory}
                  historyForbidden={backlog.selectedHistoryForbidden}
                  units={backlog.units}
                  busy={busy}
                  draftResetToken={draftResetToken}
                  onAction={onAction}
                />
              </div>
            </div>
          )
        }
      />

      <ReasonDialog
        open={dialog === 'return'}
        onClose={() => setDialog(null)}
        title={t('answers.return.title')}
        body={t('answers.return.body')}
        label={t('answers.return.reason')}
        placeholder={t('answers.return.placeholder')}
        submitLabel={actionLabel(t, 'question.return')}
        reasonTestId="answer-return-reason"
        submitTestId="answer-return-submit"
        busy={busy}
        onSubmit={(reason) => {
          if (question === null) return;
          void run('question.return', (options) =>
            api.returnQuestion(question.id, reason, options),
          );
        }}
      />

      <ReasonDialog
        open={dialog === 'withdraw'}
        onClose={() => setDialog(null)}
        title={t('answers.withdraw.title')}
        body={t('answers.withdraw.body')}
        label={t('answers.withdraw.reason')}
        placeholder={t('answers.return.placeholder')}
        submitLabel={actionLabel(t, 'question.withdraw')}
        danger
        reasonTestId="answer-withdraw-reason"
        submitTestId="answer-withdraw-submit"
        busy={busy}
        onSubmit={(reason) => {
          if (question === null) return;
          void run('question.withdraw', (options) =>
            api.withdrawQuestion(question.id, reason, options),
          );
        }}
      />

      <AssignDialog
        open={dialog === 'assign'}
        onClose={() => setDialog(null)}
        units={backlog.units}
        current={question?.unitId}
        busy={busy}
        onSubmit={(unitId) => {
          if (question === null) return;
          void run('question.assign', (options) =>
            api.assignQuestion(question.id, unitId, options),
          );
        }}
      />

      <MergeDialog
        open={dialog === 'merge'}
        onClose={() => setDialog(null)}
        busy={busy}
        onResolve={resolveNumber}
        onSubmit={(targetId) => {
          if (question === null) return;
          void run('question.merge', (options) =>
            api.mergeQuestion(question.id, targetId, options),
          );
        }}
      />
    </div>
  );
}
