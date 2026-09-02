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
import { etagOf } from '@hv/domain';
import type { Permission, WriteOptions } from '@hv/domain';
import { api } from '../../api';
import { EmptyState, Panel, PageHeader, SplitPane, showProblem, showToast } from '../../components';
import { actionLabel, useT } from '../../i18n';
import { AssignDialog, MergeDialog, ReasonDialog } from './ActionDialogs';
import { QuestionDetail } from './QuestionDetail';
import type { DetailAction } from './QuestionDetail';
import { WorkList } from './WorkList';
import { splitSources } from './lib';
import { EMPTY_FILTERS, useBacklog } from './useBacklog';
import type { Filters } from './useBacklog';

type OpenDialog = 'return' | 'assign' | 'merge' | 'withdraw' | null;

export function AnswersPage() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [busy, setBusy] = useState(false);
  const [draftResetToken, setDraftResetToken] = useState(0);

  const backlog = useBacklog(filters, selectedId);
  const { reload, selected: question } = backlog;

  /**
   * One door for every write: optimistic lock in, problem out, refetch on refusal. The permission
   * is only used to name the step in the confirmation — the decision was made by `_actions`.
   */
  const run = useCallback(
    async (permission: Permission, write: (options: WriteOptions) => Promise<unknown>) => {
      if (question === null) return false;
      setBusy(true);
      try {
        await write({ ifMatch: etagOf(question.version) });
        showToast({
          tone: 'success',
          title: t('answers.toast.done'),
          detail: actionLabel(t, permission),
        });
        setDialog(null);
        return true;
      } catch (error) {
        showProblem(error, t('toast.problem'));
        // Any refusal can mean this view holds an outdated copy; 412 says so outright. Refetch the
        // list and the open question instead of repairing state locally.
        reload();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [question, reload, t],
  );

  const onAction = useCallback(
    (action: DetailAction) => {
      if (question === null) return;
      const id = question.id;
      switch (action.kind) {
        case 'draft': {
          const sources = splitSources(action.sources);
          void run('answer.draft', (options) =>
            api.draftAnswer(
              id,
              { text: action.text.trim(), ...(sources.length > 0 ? { sources } : {}) },
              options,
            ),
          ).then((ok) => {
            if (ok) setDraftResetToken((value) => value + 1);
          });
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
          question === null ? (
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
            <div data-testid="answers-detail" className="h-full">
              <QuestionDetail
                key={question.id}
                question={question}
                history={backlog.selectedHistory}
                units={backlog.units}
                agendaItems={backlog.agendaItems}
                busy={busy}
                draftResetToken={draftResetToken}
                onAction={onAction}
              />
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
