/**
 * Fokusansicht (Scheibe 054) — "Meine Fragen": the questions whose answer this person may draft and forward now, the
 * oldest first, without filters, agenda item or clock time. One is chosen; its return reason and the reason it came here
 * stand first; a double click or Enter opens the writing mode (Schreibmodus), Ctrl+Enter saves, Escape leaves, and
 * "Weiterleiten" hands the answer to the next step — then the next question stands there. A question that belongs to
 * another unit goes there through the dialog of 053.
 *
 * Every button follows `_actions` (AGENTS.md R4); no code here compares a role, and no action is chosen by status (R5).
 * The data is the Beantwortung's (`useBacklog`, whole list, no server filter), every write goes through the write door
 * of 053 (`useWriteDoor`), the forward dialog is 053's (`ForwardDialog`, `forwardProblemHandler`), and the focus after a
 * hand-over follows 053's rule (`mayMoveFocus`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import type { Question } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { EmptyState, PageHeader, Panel, SplitPane, StaleBanner, showToast } from '../../components';
import { useT } from '../../i18n';
import { ForwardDialog } from '../answers/ForwardDialog';
import { forwardProblemHandler } from '../answers/forward';
import { splitSources } from '../answers/lib';
import { EMPTY_FILTERS, useBacklog } from '../answers/useBacklog';
import { useWriteDoor } from '../answers/useWriteDoor';
import { mayMoveFocus } from '../steering/steering';
import { FocusDetail } from './FocusDetail';
import { FocusList } from './FocusList';
import type { FocusListState } from './FocusList';
import { WritingMode } from './WritingMode';
import { draftKey, isDirty, myQuestions, newDraft, nextSelection, writingOutcome } from './focus';
import type { FocusAction, FocusDraft } from './focus';

// Browser-storage name of the split position. A module constant, not a JSX literal: gitleaks' generic-api-key rule
// flags `storageKey="…"` lines once the value's entropy passes its threshold (054, CI on #148).
const FOCUS_SPLIT_STORAGE = 'hv-focus-split-v1';

/** The only dialog of this page: forwarding to another answering unit (053). */
type FocusDialog = 'forward';

/** The question a hand-over was made against, to move the focus once the next one is on screen (takt-008). */
interface PendingFocus {
  id: string;
  version: number;
}

type Drafts = Readonly<Record<string, FocusDraft>>;
const NO_DRAFTS: Drafts = {};

export function FocusPage() {
  const t = useT();
  const actorId = useActor().id;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<string | null>(null);
  /** A double click or Enter asked to open the writing mode; it opens once the record of that question is read. */
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  /** The texts of the writing mode, one per actor and question, while the page lives (decision 4). */
  const [drafts, setDrafts] = useState<Drafts>(NO_DRAFTS);
  const lastIndex = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const focusListPending = useRef(false);

  /**
   * Slice 090 / 010d: the writing mode, its text and the selection belong to the actor who made them. On an actor change
   * they go in the same render (compared by `id`, never by role, AGENTS.md R4); the dialog and "Stand veraltet" fall in
   * the write door. The selection is set again from the new actor's list (`nextSelection`).
   */
  const [viewActorId, setViewActorId] = useState(actorId);
  if (viewActorId !== actorId) {
    setViewActorId(actorId);
    setSelectedId(null);
    setWritingId(null);
    setOpenRequest(null);
    setDrafts(NO_DRAFTS);
  }

  const backlog = useBacklog(EMPTY_FILTERS, selectedId);
  const { reload, selected, listLoading, listFailed, listForbidden } = backlog;
  const mine = useMemo(() => myQuestions(backlog.items), [backlog.items]);
  const listSettled = !listLoading && !listFailed && !listForbidden;

  const { run, busy, dialog, setDialog, staleFor, clearStale } = useWriteDoor<FocusDialog>({
    question: selected,
    selectedId,
    reload,
  });

  // The selection follows the list (decision 6), once this actor's list has answered — never while it loads.
  useEffect(() => {
    if (!listSettled) return;
    const next = nextSelection(mine, selectedId, lastIndex.current);
    const index = next === null ? -1 : mine.findIndex((question) => question.id === next);
    if (index >= 0) lastIndex.current = index;
    if (next !== selectedId) setSelectedId(next);
  }, [listSettled, mine, selectedId]);

  /** The newest record of a question among "Meine Fragen": the detail read, if it is newer than the list's row. */
  const recordOf = useCallback(
    (id: string): Question | undefined => {
      const row = mine.find((question) => question.id === id);
      if (row === undefined) return undefined;
      return selected !== null && selected.id === id && selected.version >= row.version ? selected : row;
    },
    [mine, selected],
  );

  /**
   * The drafts follow their questions (decision 4/6): a question that left "Meine Fragen" or no longer offers drafting
   * takes its draft along (with a notice when unsaved text goes); a newer version moves an unchanged text onto it and
   * marks a changed one. The writing mode ends with its question.
   */
  useEffect(() => {
    if (!listSettled) return;
    let changed = false;
    let endWriting = false;
    const next: Record<string, FocusDraft> = {};
    const discarded: string[] = [];
    for (const draft of Object.values(drafts)) {
      if (draft.key !== draftKey(actorId, draft.questionId)) {
        changed = true;
        continue;
      }
      const outcome = writingOutcome(draft, recordOf(draft.questionId));
      if (outcome.kind === 'keep') {
        next[draft.key] = draft;
        continue;
      }
      changed = true;
      if (outcome.kind === 'end') {
        if (outcome.discarded) discarded.push(draft.number);
        if (draft.questionId === writingId) endWriting = true;
        continue;
      }
      next[draft.key] = outcome.draft;
    }
    if (!changed) return;
    setDrafts(next);
    if (endWriting) setWritingId(null);
    for (const number of discarded) showToast({ tone: 'neutral', title: t('focus.write.gone', { number }) });
  }, [listSettled, drafts, recordOf, actorId, writingId, t]);

  // Opening the writing mode waits for the record of the chosen question; it opens only when that record offers
  // drafting and the question is one of "Meine Fragen" (the list can be older than the detail).
  useEffect(() => {
    if (openRequest === null) return;
    if (selectedId !== openRequest) {
      setOpenRequest(null);
      return;
    }
    if (selected === null || selected.id !== openRequest) return;
    setOpenRequest(null);
    if (!selected._actions.includes('answer.draft') || !mine.some((question) => question.id === selected.id)) return;
    const key = draftKey(actorId, selected.id);
    setDrafts((previous) => (previous[key] !== undefined ? previous : { ...previous, [key]: newDraft(actorId, selected) }));
    setWritingId(selected.id);
  }, [openRequest, selectedId, selected, mine, actorId]);

  const requestOpen = useCallback((id: string) => {
    setSelectedId(id);
    setOpenRequest(id);
  }, []);

  const writingQuestion =
    writingId !== null && selectedId === writingId && selected !== null && selected.id === writingId ? selected : null;
  const writingDraft = writingQuestion === null ? undefined : drafts[draftKey(actorId, writingQuestion.id)];
  const inWriting = writingQuestion !== null && writingDraft !== undefined;

  const leaveWriting = useCallback(() => {
    setWritingId(null);
    focusListPending.current = true;
  }, []);

  // Leaving the writing mode puts the focus on the list, whose active row is the question (decision 5).
  useEffect(() => {
    if (!focusListPending.current || inWriting) return;
    focusListPending.current = false;
    listRef.current?.focus();
  });

  /**
   * takt-008, as in the steering view: after a hand-over the focus goes to the primary action of the question now
   * shown, or to its number — once the detail shows another question or a newer version, and only while the person is
   * not working elsewhere (`mayMoveFocus`). Saving does not move the focus (who saves with Ctrl+Enter writes on).
   */
  const pendingFocus = useRef<PendingFocus | null>(null);
  const shownNow = useRef<{ question: Question | null; selectedId: string | null; mine: readonly Question[] }>({
    question: null,
    selectedId: null,
    mine: [],
  });
  useEffect(() => {
    pendingFocus.current = null;
  }, [actorId]);

  const settleFocus = useCallback((): void => {
    const pending = pendingFocus.current;
    const { question, selectedId: chosen, mine: list } = shownNow.current;
    if (pending === null) return;
    if (list.length === 0 && listSettled) {
      pendingFocus.current = null;
      return;
    }
    if (question === null || question.id !== chosen || !list.some((entry) => entry.id === question.id)) return;
    if (question.id === pending.id && question.version <= pending.version) return;
    const root = detailRef.current;
    if (root === null) return;
    pendingFocus.current = null;
    if (!mayMoveFocus<Node>(document.activeElement, document.body, root)) return;
    const target =
      root.querySelector<HTMLElement>('[data-primary="true"]') ??
      root.querySelector<HTMLElement>('[data-testid="focus-detail-number"]');
    target?.focus();
  }, [listSettled]);

  useEffect(() => {
    shownNow.current = { question: selected, selectedId, mine };
    settleFocus();
  });

  /** After "Weiterleiten" or forwarding to another unit: the writing mode ends in any case, and the focus is armed. */
  const handedOver = useCallback(
    (question: Question) => () => {
      setWritingId(null);
      pendingFocus.current = { id: question.id, version: question.version };
    },
    [],
  );

  const updateDraft = useCallback((key: string, patch: Partial<Pick<FocusDraft, 'text' | 'sources'>>) => {
    setDrafts((previous) => {
      const draft = previous[key];
      return draft === undefined ? previous : { ...previous, [key]: { ...draft, ...patch } };
    });
  }, []);

  const save = useCallback(
    (question: Question, draft: FocusDraft) => {
      const id = question.id;
      const key = draft.key;
      const text = draft.text.trim();
      const sources = splitSources(draft.sources);
      const savedVersion = question.answers.length + 1;
      void run(
        'answer.draft',
        (options) => api.draftAnswer(id, { text, ...(sources.length > 0 ? { sources } : {}) }, options),
        // The draft now starts from what was saved: no longer unsaved. What was typed meanwhile stays (and counts).
        () =>
          setDrafts((previous) => {
            const current = previous[key];
            if (current === undefined) return previous;
            return {
              ...previous,
              [key]: {
                ...current,
                baseVersion: Math.max(current.baseVersion, savedVersion),
                baseText: text,
                baseSources: sources.join('; '),
                rebase: false,
              },
            };
          }),
      );
    },
    [run],
  );

  const submit = useCallback(
    (question: Question) => {
      const id = question.id;
      void run('question.submit_review', (options) => api.submitForReview(id, options), handedOver(question));
    },
    [run, handedOver],
  );

  const onDetailAction = useCallback(
    (question: Question) => (action: FocusAction) => {
      if (action === 'write') requestOpen(question.id);
      else if (action === 'submit') submit(question);
      else if (action === 'forward') setDialog('forward');
    },
    [requestOpen, submit, setDialog],
  );

  const forwardDialog =
    dialog === 'forward' && selected !== null ? (
      <ForwardDialog
        key={`${actorId}:${selected.id}:forward`}
        question={selected}
        units={backlog.units}
        busy={busy}
        onClose={() => setDialog(null)}
        onSubmit={(request, report) => {
          const id = selected.id;
          const number = selected.number;
          void run(
            'question.forward',
            (options) => api.forwardQuestion(id, request, options),
            handedOver(selected),
            forwardProblemHandler(
              report,
              () => setDialog(null),
              () => showToast({ tone: 'neutral', title: t('answers.forward.gone', { number }) }),
            ),
          );
        }}
      />
    ) : null;

  const header = <PageHeader title={t('page.focus.title')} description={t('page.focus.description')} />;

  if (listForbidden) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        {header}
        <div data-testid="focus-forbidden" role="status" className="min-h-0 flex-1">
          <Panel className="h-full" bodyClassName="flex items-center justify-center">
            <EmptyState icon={FileQuestion} title={t('focus.forbidden.title')} description={t('focus.forbidden.body')} />
          </Panel>
        </div>
      </div>
    );
  }

  if (inWriting) {
    const key = writingDraft.key;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <WritingMode
          question={writingQuestion}
          text={writingDraft.text}
          sources={writingDraft.sources}
          dirty={isDirty(writingDraft)}
          busy={busy}
          rebase={writingDraft.rebase}
          stale={staleFor === writingQuestion.id}
          dialogOpen={dialog !== null}
          onText={(text) => updateDraft(key, { text })}
          onSources={(sources) => updateDraft(key, { sources })}
          onAction={(action) => {
            if (action === 'save') save(writingQuestion, writingDraft);
            else if (action === 'submit') submit(writingQuestion);
            else if (action === 'forward') setDialog('forward');
          }}
          onClose={leaveWriting}
          onRebase={() => setDrafts((previous) => ({ ...previous, [key]: newDraft(actorId, writingQuestion) }))}
          onStaleReload={() => {
            clearStale();
            reload();
          }}
        />
        {forwardDialog}
      </div>
    );
  }

  const listState: FocusListState = listFailed
    ? 'failed'
    : listLoading && backlog.items.length === 0
      ? 'loading'
      : 'ready';
  const list = (
    <FocusList
      items={mine}
      state={listState}
      selectedId={selectedId}
      listRef={listRef}
      onSelect={setSelectedId}
      onOpen={requestOpen}
      onRetry={reload}
    />
  );

  if (listState === 'ready' && mine.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        {header}
        <div className="min-h-0 flex-1">{list}</div>
      </div>
    );
  }

  const shown = selected !== null && selected.id === selectedId ? selected : null;
  const shownDraft = shown === null ? undefined : drafts[draftKey(actorId, shown.id)];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {header}
      <SplitPane
        storageKey={FOCUS_SPLIT_STORAGE}
        initial={42}
        min={28}
        max={65}
        className="min-h-0 flex-1"
        left={list}
        right={
          listState !== 'ready' ? null : shown === null ? (
            <Panel className="h-full" bodyClassName="flex items-center justify-center">
              <EmptyState
                icon={FileQuestion}
                title={selectedId !== null ? t('answers.detail.loading') : t('focus.detail.empty')}
              />
            </Panel>
          ) : (
            <div ref={detailRef} data-testid="focus-detail" className="flex h-full min-h-0 flex-col gap-2">
              {staleFor === shown.id && (
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
                <FocusDetail
                  key={shown.id}
                  question={shown}
                  units={backlog.units}
                  history={backlog.selectedHistory}
                  dirty={shownDraft !== undefined && isDirty(shownDraft)}
                  busy={busy}
                  onAction={onDetailAction(shown)}
                />
              </div>
            </div>
          )
        }
      />
      {forwardDialog}
    </div>
  );
}
