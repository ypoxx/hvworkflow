/**
 * Steuerung (Scheibe 053) — where the coordination steers: above, where the open questions lie (the distribution,
 * per answering unit and what is on the podium per seat); below, the work list on the left and one question with its
 * next steering step on the right — classify, assign, or forward to another answering unit, and as a side step
 * propose a refusal.
 *
 * Every button follows `_actions` (AGENTS.md R4); no code here compares a role or a status to decide an action (R5).
 * The work list and its data are the Beantwortung's (`WorkList`, `useBacklog`), unchanged; every write except
 * classifying goes through the same write door (`useWriteDoor`). Classifying keeps its own way from the capture desk
 * (`ClassifyDialog`: If-Match, toast, closes on 412).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import type { RefusalGround, StageSeat } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import { useRefusalGrounds } from '../../api/useRefusalGrounds';
import { useMeeting } from '../../app/useMeeting';
import { EmptyState, PageHeader, Panel, SplitPane, StaleBanner, showToast } from '../../components';
import { useT } from '../../i18n';
import { AssignDialog } from '../answers/ActionDialogs';
import { ForwardDialog } from '../answers/ForwardDialog';
import { forwardProblemHandler } from '../answers/forward';
import { RefusalDialog } from '../answers/RefusalDialog';
import { refusalProblemHandler } from '../answers/refusal';
import { ALL, EMPTY_FILTERS, useBacklog } from '../answers/useBacklog';
import type { Filters } from '../answers/useBacklog';
import { useWriteDoor } from '../answers/useWriteDoor';
import { WorkList } from '../answers/WorkList';
import { ClassifyDialog } from '../capture/ClassifyDialog';
import { DistributionPanel } from './DistributionPanel';
import type { SeatRead } from './DistributionPanel';
import { SteeringDetail } from './SteeringDetail';
import { mayMoveFocus } from './steering';
import type { SteeringAction } from './steering';

/** Scheibe 045: the catalogue read of this page (stable, so the hook's loader keeps one function). */
const loadRefusalGrounds = (): Promise<readonly RefusalGround[]> => api.listRefusalGrounds();

const NO_SEATS: readonly StageSeat[] = [];

/**
 * The seats of the meeting, for the distribution and the detail. Master data, readable by every signed-in actor
 * (masked, 040b); read again with every change of the log, keeping the last list on screen meanwhile (principle 8).
 * A failure is a state of the strip, never a toast.
 */
function useStageSeats(meetingId: string | undefined): SeatRead {
  const version = useApiVersion();
  const [read, setRead] = useState<SeatRead>({ status: 'loading', seats: NO_SEATS });
  useEffect(() => {
    if (meetingId === undefined) return undefined;
    let cancelled = false;
    api
      .listMeetingStageSeats(meetingId)
      .then((seats) => {
        if (!cancelled) setRead({ status: 'ready', seats });
      })
      .catch(() => {
        if (!cancelled) setRead((previous) => (previous.status === 'ready' ? previous : { status: 'failed', seats: NO_SEATS }));
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, version]);
  return read;
}

/** The question a write was made against, to move the focus once its new version is on screen (takt-008). */
interface PendingFocus {
  id: string;
  version: number;
  /** Classify only (review 053, minor 3c): the moment after which a new version no longer counts as its own write. */
  until?: number;
}

/** How long after the classify dialog closed a new version still counts as its own save (`performance.now()` ms). */
const CLASSIFY_FOCUS_WINDOW_MS = 3000;

export function SteeringPage() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const catalogue = useRefusalGrounds(loadRefusalGrounds);
  const meeting = useMeeting();
  const seats = useStageSeats(meeting?.id);

  const backlog = useBacklog(filters, selectedId);
  const { reload, selected: question } = backlog;
  const actorId = useActor().id;

  // The write door of the Beantwortung (decision 6): the dialog and "Stand veraltet" fall with an actor change there.
  const { run, busy, dialog, setDialog, staleFor, clearStale } = useWriteDoor<SteeringAction>({
    question,
    selectedId,
    reload,
  });

  /**
   * Slice 090, as in the Beantwortung: the search text is typed input and belongs to the actor who typed it; the
   * other filters are choices and stay. Compared by `id`, never by role (AGENTS.md R4).
   */
  const [viewActorId, setViewActorId] = useState(actorId);
  if (viewActorId !== actorId) {
    setViewActorId(actorId);
    setFilters((previous) => (previous.q === '' ? previous : { ...previous, q: '' }));
  }

  /**
   * takt-008: after a write from this page the focus goes to the primary action of the detail, or to its number
   * when there is none — once the new version is on screen. Only for the question the write was made against, and
   * only while the person is not working elsewhere (`mayMoveFocus`, review 053 minor 3a).
   */
  // Refs, not state: arming renders nothing; the effect acts when the question on screen changes. The pending focus
  // falls with a change of actor or selection, so it never moves the focus for another person or another question.
  const pendingFocus = useRef<PendingFocus | null>(null);
  const questionNow = useRef(question);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pendingFocus.current = null;
  }, [actorId, selectedId]);

  const focusDetail = useCallback(() => {
    const root = detailRef.current;
    if (!mayMoveFocus<Node>(document.activeElement, document.body, root)) return;
    const target =
      root?.querySelector<HTMLElement>('[data-primary="true"]') ??
      root?.querySelector<HTMLElement>('[data-testid="steering-detail-number"]');
    target?.focus();
  }, []);

  /** The pending focus is due when the question on screen is a newer version of the one written against. */
  const settleFocus = useCallback((): void => {
    const pending = pendingFocus.current;
    const current = questionNow.current;
    if (pending === null || current === null || current.id !== pending.id || current.version <= pending.version) return;
    pendingFocus.current = null;
    if (pending.until !== undefined && performance.now() > pending.until) return;
    focusDetail();
  }, [focusDetail]);

  useEffect(() => {
    questionNow.current = question;
    settleFocus();
  }, [question, settleFocus]);

  // Review 053, minor 3b: the stream can deliver the new version before the write answers; then it is due at once.
  const armFocus = useCallback(() => {
    if (question === null) return;
    pendingFocus.current = { id: question.id, version: question.version };
    settleFocus();
  }, [question, settleFocus]);

  /**
   * Review 053, minor 3c: the unchanged `ClassifyDialog` closes the same way on Cancel and after saving. So the close
   * arms only for a version that arrives shortly after it (its own write answers before it closes); a cancel arms
   * nothing that a later write of someone else could use. `onSaved` stays on the follow-up list.
   */
  const armFocusAfterClassify = useCallback(() => {
    if (question === null) return;
    pendingFocus.current = { id: question.id, version: question.version, until: performance.now() + CLASSIFY_FOCUS_WINDOW_MS };
    settleFocus();
  }, [question, settleFocus]);

  const onAction = useCallback((action: SteeringAction) => setDialog(action), [setDialog]);

  // A drill-down from the distribution: the list shows that unit, in every status.
  const onUnit = useCallback((unitId: string) => {
    setFilters((previous) => ({ ...previous, unitId, status: ALL }));
  }, []);

  if (backlog.listForbidden) {
    // Not the Beantwortung's sentence: this view has its own state when the questions cannot be read at all.
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <PageHeader title={t('page.steering.title')} description={t('page.steering.description')} />
        <div data-testid="steering-forbidden" role="status" className="min-h-0 flex-1">
          <Panel className="h-full" bodyClassName="flex items-center justify-center">
            <EmptyState icon={FileQuestion} title={t('steering.forbidden.title')} description={t('steering.forbidden.body')} />
          </Panel>
        </div>
      </div>
    );
  }

  const detailSilent = backlog.listFailed && question === null && !backlog.selectedLoading;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader title={t('page.steering.title')} description={t('page.steering.description')} />

      <DistributionPanel
        meeting={meeting}
        units={backlog.units}
        seats={seats}
        activeUnitId={filters.unitId}
        onUnit={onUnit}
      />

      <SplitPane
        storageKey="hv-steering-split-v1"
        initial={52}
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
          detailSilent ? null : question === null ? (
            <Panel className="h-full" bodyClassName="flex items-center justify-center">
              <EmptyState
                icon={FileQuestion}
                title={backlog.selectedLoading ? t('answers.detail.loading') : t('steering.detail.empty.title')}
                {...(backlog.selectedLoading ? {} : { description: t('steering.detail.empty.body') })}
              />
            </Panel>
          ) : (
            <div ref={detailRef} data-testid="steering-detail" className="flex h-full min-h-0 flex-col gap-2">
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
                <SteeringDetail
                  key={question.id}
                  question={question}
                  units={backlog.units}
                  seats={seats.seats}
                  busy={busy}
                  onAction={onAction}
                />
              </div>
            </div>
          )
        }
      />

      {/* Every dialog is rendered only while open, keyed to actor and question (090): every opening starts empty,
       * and a change of either drops every input in the same render. */}
      {dialog === 'classify' && question !== null && (
        <ClassifyDialog
          key={`${actorId}:${question.id}:classify`}
          question={question}
          onClose={() => {
            // Its own write path closes it on success too; the focus moves only if a new version arrives shortly.
            armFocusAfterClassify();
            setDialog(null);
          }}
          onProblem={reload}
        />
      )}

      {dialog === 'assign' && question !== null && (
        <AssignDialog
          key={`${actorId}:${question.id}:assign`}
          open
          onClose={() => setDialog(null)}
          units={backlog.units}
          current={question.unitId}
          busy={busy}
          onSubmit={(unitId) => {
            const id = question.id;
            void run('question.assign', (options) => api.assignQuestion(id, unitId, options), armFocus);
          }}
        />
      )}

      {dialog === 'forward' && question !== null && (
        <ForwardDialog
          key={`${actorId}:${question.id}:forward`}
          question={question}
          units={backlog.units}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(request, report) => {
            const id = question.id;
            const number = question.number;
            void run(
              'question.forward',
              (options) => api.forwardQuestion(id, request, options),
              armFocus,
              forwardProblemHandler(
                report,
                () => setDialog(null),
                () => showToast({ tone: 'neutral', title: t('answers.forward.gone', { number }) }),
              ),
            );
          }}
        />
      )}

      {dialog === 'refuse' && question !== null && (
        <RefusalDialog
          key={`${actorId}:${question.id}:refusal`}
          catalogue={catalogue}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(proposal, report) => {
            const id = question.id;
            void run(
              'question.refuse.propose',
              (options) => api.proposeRefusal(id, proposal, options),
              armFocus,
              refusalProblemHandler(report, () => setDialog(null)),
            );
          }}
        />
      )}
    </div>
  );
}
