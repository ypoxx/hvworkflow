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
import { api, draftBuffer } from '../../api';
import { useActor } from '../../api/actor';
import { previewAnswer, previewText } from '../../api/answerFormat';
import { BUFFER_LIFETIME_MS, useBufferRevision } from '../../api/draftBuffer';
import { DraftNote, EmptyState, PageHeader, Panel, SplitPane, StaleBanner, showToast } from '../../components';
import { useT } from '../../i18n';
import { CompareVersions } from '../answers/CompareVersions';
import { bufferStep, conflictAfterRefusal, keepMine, lateRestore, restoreDraft, takeTheirs } from '../answers/draft';
import { ForwardDialog } from '../answers/ForwardDialog';
import { forwardProblemHandler } from '../answers/forward';
import { problemStatus, splitSources } from '../answers/lib';
import { EMPTY_FILTERS, useBacklog } from '../answers/useBacklog';
import { useWriteDoor } from '../answers/useWriteDoor';
import { mayMoveFocus } from '../steering/steering';
import { FocusDetail } from './FocusDetail';
import { FocusList } from './FocusList';
import type { FocusListState } from './FocusList';
import { WritingMode } from './WritingMode';
import { disarmFocus, draftKey, focusDue, isDirty, myQuestions, nextSelection, writingOutcome } from './focus';
import type { FocusAction, FocusDraft, PendingFocus, ShownForFocus } from './focus';

// Browser-storage name of the split position. A module constant, not a JSX literal: gitleaks' generic-api-key rule
// flags `storageKey="…"` lines once the value's entropy passes its threshold (054, CI on #148).
const FOCUS_SPLIT_STORAGE = 'hv-focus-split-v1';

/** The only dialog of this page: forwarding to another answering unit (053). */
type FocusDialog = 'forward';

type Drafts = Readonly<Record<string, FocusDraft>>;
const NO_DRAFTS: Drafts = {};
const NO_TIMES: Readonly<Record<string, number>> = {};

const two = (n: number): string => String(n).padStart(2, '0');
/** "HH:MM" of a wall-clock time in milliseconds (the end of the buffer's lifetime in the notice). */
const clockOf = (ms: number): string => {
  const at = new Date(ms);
  return `${two(at.getHours())}:${two(at.getMinutes())}`;
};

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
   * Scheibe 060: the draft buffer. Per draft key: the meeting of its question (the record is gone when a question leaves),
   * the keys an input changed (only those are buffered, decision 4), the keys a save settled (an unchanged draft then
   * deletes its entry), and when a restored text was last changed (the line "wiederhergestellt").
   */
  useBufferRevision(draftBuffer);
  const meetingOf = useRef<Record<string, string>>({});
  const typedKeys = useRef(new Set<string>());
  const savedKeys = useRef(new Set<string>());
  const [restoredAt, setRestoredAt] = useState<Readonly<Record<string, number>>>(NO_TIMES);
  /** Decision 7: the question whose writing mode shows "Fassungen vergleichen" instead of the field. */
  const [compareFor, setCompareFor] = useState<string | null>(null);
  /** Decision 7.3: a refused (412) save, until a newer record of that question sorted it. */
  const [refused, setRefused] = useState<{ questionId: string; version: number } | null>(null);
  const [snapshotSeen, setSnapshotSeen] = useState(draftBuffer.snapshotId());


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
    setRestoredAt(NO_TIMES);
    setCompareFor(null);
    setRefused(null);
  }

  // Scheibe 060: a persona switch loads the buffer for the new actor at once (deleting every other actor's entries); the
  // buffer itself compares the owner on every access, this only does it before the next access needs it.
  useEffect(() => {
    void draftBuffer.load();
  }, [actorId]);

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
    const discarded: { number: string; key: string; questionId: string }[] = [];
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
        if (outcome.discarded) discarded.push({ number: draft.number, key: draft.key, questionId: draft.questionId });
        if (draft.questionId === writingId) endWriting = true;
        continue;
      }
      next[draft.key] = outcome.draft;
    }
    if (!changed) return;
    setDrafts(next);
    if (endWriting) setWritingId(null);
    // Scheibe 060 (decision 4): the newest text is written at once (no debounce); only once that completed does the notice
    // say until when it stays on this device. Without the buffer the notice of 054 stands: the text is gone.
    for (const { number, key, questionId } of discarded) {
      const meetingId = meetingOf.current[key];
      const written = meetingId === undefined ? Promise.resolve(undefined) : draftBuffer.flush(meetingId, questionId);
      void written.then((at) => showToast({
        tone: 'neutral',
        title: at === undefined
          ? t('focus.write.gone', { number })
          : t('focus.write.goneKept', { number, time: clockOf(at + BUFFER_LIFETIME_MS) }),
      }));
    }
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
    if (drafts[key] === undefined) {
      // Scheibe 060 (decision 5): a buffered draft of this actor goes before the prefill of takt-048.
      const meetingId = selected.meetingId;
      if (meetingId !== undefined) meetingOf.current[key] = meetingId;
      const entry = meetingId === undefined ? undefined : draftBuffer.entryFor(meetingId, selected.id);
      const result = restoreDraft(entry, actorId, selected, 0, { rolesChanged: draftBuffer.rolesChanged() });
      if (result.drop && meetingId !== undefined) void draftBuffer.delete(meetingId, selected.id);
      setDrafts((previous) => (previous[key] !== undefined ? previous : { ...previous, [key]: result.draft }));
      if (result.restored && result.changedAt !== undefined) setRestoredAt((previous) => ({ ...previous, [key]: result.changedAt! }));
    }
    setWritingId(selected.id);
  }, [openRequest, selectedId, selected, mine, actorId, drafts]);

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
    setCompareFor(null);
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
   * shown, or to its number — once `focusDue` says so (takt-043), and only while the person is not working elsewhere
   * (`mayMoveFocus`). Saving does not move the focus (who saves with Ctrl+Enter writes on).
   */
  const pendingFocus = useRef<PendingFocus | null>(null);
  const shownNow = useRef<ShownForFocus>({ question: null, selectedId: null, mine: [], listSettled: false });
  useEffect(() => {
    pendingFocus.current = null;
  }, [actorId]);

  // Everything from the ref, nothing from the closure (empty list of dependencies): `handedOver` and `run` hold the
  // callback of the render of the click, whose `listSettled` may be stale (takt-043).
  const settleFocus = useCallback((): void => {
    const due = focusDue(pendingFocus.current, shownNow.current);
    if (due === 'wait') return;
    if (due === 'clear') {
      pendingFocus.current = null;
      return;
    }
    const root = detailRef.current;
    if (root === null) return;
    pendingFocus.current = null;
    if (!mayMoveFocus<Node>(document.activeElement, document.body, root)) return;
    const target =
      root.querySelector<HTMLElement>('[data-primary="true"]') ??
      root.querySelector<HTMLElement>('[data-testid="focus-detail-number"]');
    target?.focus();
  }, []);

  useEffect(() => {
    shownNow.current = { question: selected, selectedId, mine, listSettled };
    settleFocus();
  });

  /**
   * takt-043 (U2): the focus is armed when a hand-over is sent, not when it answers — the stream can carry the whole
   * change (list, selection, the next question's detail) before the write answers, and then the write door no longer
   * calls `onDone`. A refusal drops exactly this pending focus and then answers as the handler it wraps did.
   */
  const armHandOver = useCallback((question: Question) => {
    pendingFocus.current = { id: question.id, version: question.version };
  }, []);
  const disarmOnProblem = useCallback(
    (question: Question, next?: (error: unknown, stillShown: () => boolean) => boolean) =>
      (error: unknown, stillShown: () => boolean): boolean => {
        pendingFocus.current = disarmFocus(pendingFocus.current, question);
        return next !== undefined ? next(error, stillShown) : false;
      },
    [],
  );

  /** After "Weiterleiten" or forwarding to another unit: the writing mode ends in any case, and the focus may be due. */
  const handedOver = useCallback(() => {
    setWritingId(null);
    settleFocus();
  }, [settleFocus]);

  const updateDraft = useCallback((key: string, patch: Partial<Pick<FocusDraft, 'body' | 'sources'>>) => {
    typedKeys.current.add(key);
    setDrafts((previous) => {
      const draft = previous[key];
      return draft === undefined ? previous : { ...previous, [key]: { ...draft, ...patch } };
    });
  }, []);

  /**
   * Scheibe 060 (decision 4): only an input (or a decision in the comparison) writes to the buffer, debounced 400 ms; a
   * draft made unchanged again deletes its entry; a save that leaves the draft unchanged deletes it too.
   */
  useEffect(() => {
    for (const key of typedKeys.current) {
      const draft = drafts[key];
      const meetingId = meetingOf.current[key];
      if (draft === undefined || meetingId === undefined) continue;
      const target = { ownerId: actorId, meetingId, questionId: draft.questionId };
      const step = bufferStep(draft, true);
      if (step.kind === 'put') draftBuffer.schedule({ ...target, body: step.body, sources: step.sources, baseVersion: step.baseVersion });
      else if (step.kind === 'delete') draftBuffer.scheduleDelete(target);
    }
    typedKeys.current.clear();
    for (const key of savedKeys.current) {
      const draft = drafts[key];
      const meetingId = meetingOf.current[key];
      if (draft !== undefined && meetingId !== undefined && !isDirty(draft)) {
        void draftBuffer.delete(meetingId, draft.questionId);
        setRestoredAt((previous) => {
          if (previous[key] === undefined) return previous;
          const { [key]: _gone, ...rest } = previous;
          return rest;
        });
      }
    }
    savedKeys.current.clear();
  }, [drafts, actorId]);

  // Decision 5, the late snapshot: over an unchanged draft of the writing mode, the buffered draft restores.
  const snapshotNow = draftBuffer.snapshotId();
  useEffect(() => {
    if (snapshotSeen === snapshotNow) return;
    setSnapshotSeen(snapshotNow);
    if (writingId === null || selected === null || selected.id !== writingId || selected.meetingId === undefined) return;
    const key = draftKey(actorId, writingId);
    const draft = drafts[key];
    if (draft === undefined) return;
    const late = lateRestore(draft, draftBuffer.entryFor(selected.meetingId, writingId), actorId, selected, { rolesChanged: draftBuffer.rolesChanged() });
    if (late.restored) {
      setDrafts((previous) => ({ ...previous, [key]: late.draft }));
      if (late.changedAt !== undefined) setRestoredAt((previous) => ({ ...previous, [key]: late.changedAt! }));
    }
  }, [snapshotSeen, snapshotNow, writingId, selected, actorId, drafts]);

  // Decision 7.3: a refused save is sorted against the next record of its question that is newer than the click's.
  useEffect(() => {
    if (refused === null || selected === null || selected.id !== refused.questionId || selected.version <= refused.version) return;
    setRefused(null);
    const key = draftKey(actorId, selected.id);
    const draft = drafts[key];
    if (draft === undefined || conflictAfterRefusal(draft, selected) !== 'compare') return;
    setDrafts((previous) => (previous[key] === undefined ? previous : { ...previous, [key]: { ...previous[key]!, rebase: true } }));
    setCompareFor(selected.id);
  }, [refused, selected, actorId, drafts]);

  const save = useCallback(
    (question: Question, draft: FocusDraft) => {
      const id = question.id;
      const key = draft.key;
      // Scheibe 055b (decision 7): always with the input form; `text` is the plain text of its preview (055 decision 4).
      const body = draft.body;
      if (body === null) return;
      const text = previewText(body);
      const sentBody = previewAnswer(body);
      const sources = splitSources(draft.sources);
      const savedVersion = question.answers.length + 1;
      const clickedAt = question.version;
      void run(
        'answer.draft',
        (options) => api.draftAnswer(id, { text, body, ...(sources.length > 0 ? { sources } : {}) }, options),
        // The draft now starts from what was saved: no longer unsaved. What was typed meanwhile stays (and counts); the
        // field is not rebuilt (`generation` stays), so caret and content stay where they are.
        () => {
          savedKeys.current.add(key);
          setDrafts((previous) => {
            const current = previous[key];
            if (current === undefined) return previous;
            return {
              ...previous,
              [key]: {
                ...current,
                baseVersion: Math.max(current.baseVersion, savedVersion),
                baseBody: sentBody,
                baseSources: sources.join('; '),
                rebase: false,
              },
            };
          });
        },
        // Scheibe 060 (decision 7.3): a 412 is remembered and sorted once a newer record is shown; the default stays.
        (error) => {
          if (problemStatus(error) === 412) setRefused({ questionId: id, version: clickedAt });
          return false;
        },
      );
    },
    [run],
  );

  const submit = useCallback(
    (question: Question) => {
      const id = question.id;
      armHandOver(question);
      void run('question.submit_review', (options) => api.submitForReview(id, options), handedOver, disarmOnProblem(question));
    },
    [run, handedOver, armHandOver, disarmOnProblem],
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
          armHandOver(selected);
          void run(
            'question.forward',
            (options) => api.forwardQuestion(id, request, options),
            handedOver,
            disarmOnProblem(
              selected,
              forwardProblemHandler(
                report,
                () => setDialog(null),
                () => showToast({ tone: 'neutral', title: t('answers.forward.gone', { number }) }),
              ),
            ),
          );
        }}
      />
    ) : null;

  // One notice, not two: while the comparison is open, "Stand veraltet" of the same question gives way.
  useEffect(() => {
    if (compareFor !== null && staleFor === compareFor) clearStale();
  }, [compareFor, staleFor, clearStale]);

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
    const meetingId = writingQuestion.meetingId;
    const dirty = isDirty(writingDraft);
    const keptAt = meetingId === undefined ? undefined : draftBuffer.keptAt(meetingId, writingQuestion.id);
    const latest = writingQuestion.answers[writingQuestion.answers.length - 1];
    const closeCompare = (): void => setCompareFor(null);
    const compare = compareFor === writingQuestion.id && latest !== undefined ? (
      <CompareVersions
        mine={{ body: writingDraft.body, sources: writingDraft.sources }}
        theirs={latest}
        autoFocus
        onKeepMine={(shown) => {
          typedKeys.current.add(key);
          setDrafts((previous) => (previous[key] === undefined ? previous : { ...previous, [key]: keepMine(previous[key]!, shown, writingQuestion) }));
          closeCompare();
        }}
        onTakeTheirs={(shown) => {
          setDrafts((previous) => (previous[key] === undefined ? previous : { ...previous, [key]: takeTheirs(previous[key]!, shown, writingQuestion) }));
          if (meetingId !== undefined) void draftBuffer.delete(meetingId, writingQuestion.id);
          setRestoredAt((previous) => {
            const { [key]: _gone, ...rest } = previous;
            return rest;
          });
          closeCompare();
        }}
        onBack={closeCompare}
      />
    ) : undefined;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <WritingMode
          question={writingQuestion}
          body={writingDraft.body}
          generation={writingDraft.generation}
          sources={writingDraft.sources}
          dirty={dirty}
          busy={busy}
          rebase={writingDraft.rebase}
          stale={staleFor === writingQuestion.id}
          dialogOpen={dialog !== null}
          onBody={(body) => updateDraft(key, { body })}
          onSources={(sources) => updateDraft(key, { sources })}
          onAction={(action) => {
            if (action === 'save') save(writingQuestion, writingDraft);
            else if (action === 'submit') submit(writingQuestion);
            else if (action === 'forward') setDialog('forward');
          }}
          onClose={leaveWriting}
          onCompare={() => setCompareFor(writingQuestion.id)}
          {...(compare !== undefined ? { compare } : {})}
          {...(restoredAt[key] !== undefined && dirty ? { restoredNote: <DraftNote kind="restored" time={restoredAt[key]} /> } : {})}
          {...(dirty && keptAt !== undefined
            ? { keptNote: <DraftNote kind="kept" time={keptAt} /> }
            : dirty && meetingId !== undefined && draftBuffer.status() === 'unavailable'
              ? { keptNote: <DraftNote kind="unavailable" /> }
              : {})}
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
