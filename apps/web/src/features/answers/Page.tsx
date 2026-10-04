/**
 * Beantwortung — the afternoon under pressure: the backlog on the left, one question on the right,
 * and the steps that move it towards the podium.
 *
 * This page owns the writes. Every one of them goes through `api` (HvApi), carries
 * `ifMatch: etagOf(question.version)` so that two people cannot overwrite each other, and refetches
 * on refusal — a 412 means somebody else wrote first, and the record, not the interface, says what
 * is true afterwards.
 */
import { useCallback, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import type { RefusalGround } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { useRefusalGrounds } from '../../api/useRefusalGrounds';
import {
  EmptyState,
  Panel,
  PageHeader,
  SplitPane,
  StaleBanner,
} from '../../components';
import { actionLabel, useT } from '../../i18n';
import { AssignDialog, MergeDialog, ReasonDialog } from './ActionDialogs';
import { QuestionDetail } from './QuestionDetail';
import type { DetailAction } from './QuestionDetail';
import { WorkList } from './WorkList';
import { splitSources } from './lib';
import { RefusalDialog } from './RefusalDialog';
import { carriesJustification, refusalProblemHandler } from './refusal';
import { EMPTY_FILTERS, useBacklog } from './useBacklog';
import type { Filters } from './useBacklog';
import { useWriteDoor } from './useWriteDoor';

type OpenDialog = 'return' | 'assign' | 'merge' | 'withdraw' | 'refusal' | null;

/** Scheibe 045: the catalogue read of this page (stable, so the hook's loader keeps one function). */
const loadRefusalGrounds = (): Promise<readonly RefusalGround[]> => api.listRefusalGrounds();

export function AnswersPage() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftResetToken, setDraftResetToken] = useState(0);
  // Scheibe 045: bumped after a refusal was written; the detail then focuses the new version card.
  const [versionFocus, setVersionFocus] = useState({ token: 0, version: 0 });
  const catalogue = useRefusalGrounds(loadRefusalGrounds);

  const backlog = useBacklog(filters, selectedId);
  const { reload, selected: question } = backlog;
  const actorId = useActor().id;

  /**
   * The write door (Scheibe 053, decision 6: lifted out of this page unchanged into `useWriteDoor`): the lock until
   * the record has caught up, `If-Match`, `stillShown`/`onScreen` (010d), 412 as "Stand veraltet", `onProblem` (045),
   * refetch on refusal — and the open dialog and the notice, which fall on an actor change (010d, Ziel 1).
   */
  const { run, busy, dialog, setDialog, staleFor, clearStale } = useWriteDoor<NonNullable<OpenDialog>>({
    question,
    selectedId,
    reload,
  });

  // Slice 010d, Ziel 1: compared by `id`, never by role (AGENTS.md rule 4). The dialog and the notice fall in the
  // write door in the same render.
  const [viewActorId, setViewActorId] = useState(actorId);
  if (viewActorId !== actorId) {
    setViewActorId(actorId);
    // Slice 090: the search text is typed input and belongs to the actor who typed it; the other
    // filters (status, track, unit, agenda item, sort) are choices, not text, and stay (010d).
    setFilters((previous) => (previous.q === '' ? previous : { ...previous, q: '' }));
  }

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
        case 'legal_clear':
          void run('question.legal.clear', (options) =>
            api.clearQuestionLegally(id, action.version === undefined ? {} : { answerVersion: action.version }, options),
          );
          break;
        case 'refuse_approve':
          void run('question.refuse.approve', (options) => api.approveRefusal(id, action.version, options));
          break;
        case 'stage':
          void run('question.stage', (options) => api.stageQuestion(id, options));
          break;
        case 'open-refusal':
          setDialog('refusal');
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
    [question, run, setDialog],
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
                    clearStale();
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
                  versionFocus={versionFocus}
                  catalogue={catalogue}
                  onAction={onAction}
                />
              </div>
            </div>
          )
        }
      />

      {/* Codex P1 on PR #38: keyed to the actor so a switch remounts the dialog and drops the previous actor's text synchronously; its own reset runs in an effect, one paint too late. */}
      <ReasonDialog
        key={`${actorId}:return`}
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
        // Scheibe 045 (decision 4): only where the record of this question carries a justification.
        {...(question !== null && carriesJustification(question) ? { note: t('answers.return.refusalWarning') } : {})}
        onSubmit={(reason) => {
          if (question === null) return;
          void run('question.return', (options) =>
            api.returnQuestion(question.id, reason, options),
          );
        }}
      />

      <ReasonDialog
        key={`${actorId}:withdraw`}
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

      {/* Scheibe 045 (decision 3): rendered only while open, keyed to actor and question (090) — every
       * opening starts empty, and a change of either drops every input in the same render. */}
      {dialog === 'refusal' && question !== null && (
        <RefusalDialog
          key={`${actorId}:${question.id}:refusal`}
          catalogue={catalogue}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(proposal, report) => {
            const id = question.id;
            const writtenAt = question.version;
            void run(
              'question.refuse.propose',
              (options) => api.proposeRefusal(id, proposal, options),
              () => setVersionFocus((previous) => ({ token: previous.token + 1, version: writtenAt })),
              refusalProblemHandler(report, () => setDialog(null)),
            );
          }}
        />
      )}

      <AssignDialog
        key={`${actorId}:assign`}
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
        key={`${actorId}:merge`}
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
