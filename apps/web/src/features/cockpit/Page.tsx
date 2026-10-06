/**
 * Leitstand (Scheibe 061) — the control desk of the coordination: what waits longest, where it backs up, how things
 * develop. One reading of the core (`getCockpit`, permission `cockpit.read`), live: again on every change of the log or
 * the actor (`useApiVersion`) and every 15 s (`feed.ts`); never buffered, because the ages move without an event. Every
 * figure opens the list behind it, every row the thread (Faden) of its question; the state of both lives in the URL
 * (`?list=…&q=…`), Back closes, Escape closes the thread first and then the list, the focus returns to the trigger.
 *
 * Rights are data (AGENTS.md R4): a refused read (R-PERM-02/-03) is the read state `cockpit-forbidden`, never partial
 * figures; the page compares no role. Nothing here reads the device clock (W7): ages come from the service or from
 * `asOf` of the same reading. Nothing names a person: no speaker, no actor, no claim (spec decision 8).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Question, Unit } from '@hv/domain';
import { api } from '../../api';
import { useActor } from '../../api/actor';
import { statusTrail } from '../../api/cockpit';
import type { Cockpit } from '../../api/cockpit';
import { useApiVersion } from '../../api/useApiVersion';
import { getLang, translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { isReadForbidden } from '../answers/lib';
import { CockpitView } from './CockpitView';
import { applyResult, INITIAL_READING, startCockpitFeed } from './feed';
import type { CockpitFeed, CockpitResult, ReadingState } from './feed';
import {
  escapeTarget,
  LEGAL_LIST_MAX,
  OPEN_STATUSES,
  parseSelection,
  rowsFromQuestions,
  rowsFromRefs,
  selectionSearch,
  threadEntries,
} from './lib';
import type { ListRead, Selection, ThreadRead } from './lib';

const NO_UNITS: readonly Unit[] = [];

/**
 * Brings a panel to the top of the main region (block "start"). Only the scroller of the views moves: `scrollIntoView`
 * would also scroll the shell's root, which hides its overflow but is still scrollable, and push the header away.
 */
function scrollToTop(element: HTMLElement | null): void {
  const main = element?.closest('main');
  if (element === null || element === undefined || main === null || main === undefined) return;
  const gap = Number.parseFloat(getComputedStyle(main).paddingTop) || 0;
  main.scrollTop += element.getBoundingClientRect().top - main.getBoundingClientRect().top - gap;
}
const LIST_LIMIT = 2000;

/** The fields a list row needs; the question text and the speaker are dropped right after the read (spec decision 8). */
type RowSource = Pick<Question, 'id' | 'number' | 'status' | 'unitId' | 'createdAt'>;
const rowSource = (question: Question): RowSource => ({
  id: question.id,
  number: question.number,
  status: question.status,
  createdAt: question.createdAt,
  ...(question.unitId !== undefined ? { unitId: question.unitId } : {}),
});

/** The language at call time: results arrive outside a render, and a language switch must not restart the feed. */
const tNow = (key: TKey, params?: TParams): string => translate(getLang(), key, params);

/** The answering units, for the names of the backlog rows and the lists. Master data, read again with every change. */
function useUnits(version: number): readonly Unit[] {
  const [units, setUnits] = useState<readonly Unit[]>(NO_UNITS);
  useEffect(() => {
    let cancelled = false;
    api.listUnits().then((next) => { if (!cancelled) setUnits(next); }, () => undefined);
    return () => { cancelled = true; };
  }, [version]);
  return units;
}

/** The reading of the control desk and its one polite announcement (`applyResult`, feed.ts). */
function useCockpit(actorId: string, version: number, units: readonly Unit[]) {
  const [state, setState] = useState<ReadingState & { actor: string }>({ ...INITIAL_READING, actor: actorId });
  // A reading belongs to its actor: another person at the device starts from "loading", never from foreign figures.
  if (state.actor !== actorId) setState({ ...INITIAL_READING, actor: actorId });

  // The names for the announcement, read when a result arrives (outside a render).
  const unitsRef = useRef(units);
  useEffect(() => { unitsRef.current = units; }, [units]);
  const feed = useRef<CockpitFeed | null>(null);

  useEffect(() => {
    const onResult = (result: CockpitResult): void => {
      setState((current) => {
        const base = current.actor === actorId ? current : { ...INITIAL_READING, actor: actorId };
        return { ...applyResult(base, result, tNow, unitsRef.current), actor: actorId };
      });
    };
  const handle = startCockpitFeed({
      read: () => api.getCockpit(),
      onResult,
      timers: {
        setInterval: (fn, ms) => window.setInterval(fn, ms),
        clearInterval: (id) => window.clearInterval(id),
      },
      visibility: {
        hidden: () => document.hidden,
        subscribe: (listener) => {
          document.addEventListener('visibilitychange', listener);
          return () => document.removeEventListener('visibilitychange', listener);
        },
      },
    });
    feed.current = handle;
    return () => {
      handle.stop();
      feed.current = null;
    };
  }, [actorId]);

  // Every change of the log reads again; the feed itself read once on start.
  const seenVersion = useRef(version);
  useEffect(() => {
    if (seenVersion.current === version) return;
    seenVersion.current = version;
    feed.current?.refresh();
  }, [version]);

  const retry = useCallback(() => feed.current?.refresh(), []);
  const read = state.actor === actorId ? state.read : INITIAL_READING.read;
  return { read, announcement: state.actor === actorId ? state.announcement : '', retry };
}

/** The list behind a figure: the two lists the reading carries, the others from `listQuestions`. */
function useList(selection: Selection | null, cockpit: Cockpit | null, actorId: string, version: number): ListRead | null {
  const kind = selection?.list;
  const station = selection?.station;
  const unit = selection?.unit;
  const fetched = kind !== undefined && kind !== 'oldest' && kind !== 'legal';
  // The rows belong to one actor and one filter; a newer read of the same list replaces them without a loading flash.
  const filterKey = `${actorId}|${kind ?? ''}|${station ?? ''}|${unit ?? ''}`;
  const [loaded, setLoaded] = useState<{ filter: string; status: 'ready' | 'failed'; rows: readonly RowSource[] } | null>(null);

  useEffect(() => {
    if (!fetched) return undefined;
    let cancelled = false;
    const statuses = kind === 'open' && station !== undefined ? [station] : kind === 'stage' ? ['staged' as const] : [...OPEN_STATUSES];
    const filter = kind === 'inflow'
      ? { limit: LIST_LIMIT }
      : { status: statuses, limit: LIST_LIMIT, ...(kind === 'unit' && unit !== undefined && unit !== 'none' ? { unitId: unit } : {}) };
    api.listQuestions(filter).then(
      (page) => { if (!cancelled) setLoaded({ filter: filterKey, status: 'ready', rows: page.items.map(rowSource) }); },
      () => { if (!cancelled) setLoaded({ filter: filterKey, status: 'failed', rows: [] }); },
    );
    return () => { cancelled = true; };
  }, [fetched, filterKey, kind, station, unit, version]);

  return useMemo((): ListRead | null => {
    if (selection === null || cockpit === null) return null;
    if (selection.list === 'oldest') return { status: 'ready', rows: rowsFromRefs(cockpit.oldestOpen.items, 'oldest') };
    if (selection.list === 'legal') {
      return { status: 'ready', rows: rowsFromRefs(cockpit.legalReview.items.slice(0, LEGAL_LIST_MAX), 'legal'), total: cockpit.legalReview.over10m };
    }
    if (loaded === null || loaded.filter !== filterKey) return { status: 'loading' };
    if (loaded.status === 'failed') return { status: 'failed' };
    return { status: 'ready', rows: rowsFromQuestions(loaded.rows, cockpit.asOf, selection) };
  }, [selection, cockpit, loaded, filterKey]);
}

/** The thread of one question: its text (only with the read right) and its status trail (only with `history.read`). */
function useThread(id: string | undefined, cockpit: Cockpit | null, list: ListRead | null, actorId: string, version: number): ThreadRead | null {
  const [loaded, setLoaded] = useState<{
    owner: string;
    question: Question | null;
    trail: ReturnType<typeof statusTrail> | null;
    failed: boolean;
  } | null>(null);
  const owner = `${actorId}|${id ?? ''}`;

  useEffect(() => {
    if (id === undefined) return undefined;
    let cancelled = false;
    void Promise.allSettled([api.getQuestion(id), api.getQuestionHistory(id)]).then(([question, history]) => {
      if (cancelled) return;
      // A refusal is no failure: without the read right the thread shows no text, without `history.read` only the
      // current station (spec decision 6).
      const failed = (question.status === 'rejected' && !isReadForbidden(question.reason))
        || (history.status === 'rejected' && !isReadForbidden(history.reason));
      setLoaded({
        owner,
        question: question.status === 'fulfilled' ? question.value : null,
        trail: history.status === 'fulfilled' ? statusTrail(history.value, id) : null,
        failed,
      });
    });
    return () => { cancelled = true; };
  }, [id, owner, version]);

  if (id === undefined || cockpit === null) return null;
  const row = list?.status === 'ready' ? list.rows.find((candidate) => candidate.id === id) : undefined;
  const ref = row ?? cockpit.oldestOpen.items.find((item) => item.id === id) ?? cockpit.legalReview.items.find((item) => item.id === id);
  const current = loaded !== null && loaded.owner === owner ? loaded : null;
  const question = current?.question ?? null;
  const number = question?.number ?? ref?.number ?? '';
  if (current === null) return { status: 'loading', id, number };
  const status = question?.status ?? ref?.status;
  if ((current.failed && question === null) || status === undefined) return { status: 'failed', id, number };
  const unitId = question?.unitId ?? ref?.unitId;
  return {
    status: 'ready',
    id,
    number,
    ...(question !== null ? { text: question.text } : {}),
    ...(unitId !== undefined ? { unitId } : {}),
    ...(question?.stageAssignment !== undefined ? { stageAssignment: question.stageAssignment } : {}),
    entries: threadEntries(current.trail, status, cockpit.asOf),
  };
}

export function CockpitPage() {
  const version = useApiVersion();
  const actorId = useActor().id;
  const units = useUnits(version);
  const [params, setParams] = useSearchParams();
  const selection = useMemo(() => parseSelection(params), [params]);
  const { read, announcement, retry } = useCockpit(actorId, version, units);
  const cockpit = read.status === 'ready' ? read.cockpit : null;
  const list = useList(selection, cockpit, actorId, version);
  const thread = useThread(selection?.q, cockpit, list, actorId, version);

  // Where the focus goes back to (spec decision 11): the trigger of the list and of the thread, by a stable key.
  const listTrigger = useRef<string | null>(null);
  const threadTrigger = useRef<string | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const go = useCallback((next: Selection | null, replace: boolean) => {
    setParams(new URLSearchParams(selectionSearch(next)), { replace });
  }, [setParams]);

  const onOpenList = useCallback((next: Selection, trigger: string) => {
    listTrigger.current = trigger;
    threadTrigger.current = null;
    pendingFocus.current = 'list-title';
    go(next, false);
  }, [go]);

  const onOpenThread = useCallback((id: string, trigger: string) => {
    // From the main reading the list of the oldest opens with it; from a row the list stays as it is.
    const base = trigger.startsWith('row:') && selection !== null ? selection : { list: 'oldest' as const };
    if (!trigger.startsWith('row:')) listTrigger.current = trigger;
    threadTrigger.current = trigger;
    pendingFocus.current = trigger.startsWith('row:') ? 'thread' : 'thread-title';
    go({ ...base, q: id }, base === selection && selection?.q !== undefined);
  }, [go, selection]);

  const close = useCallback((target: Selection | null, trigger: string | null) => {
    pendingFocus.current = trigger === null ? null : `trigger:${trigger}`;
    go(target, true);
  }, [go]);
  const onCloseThread = useCallback(() => close(escapeTarget(selection), threadTrigger.current), [close, selection]);
  const onCloseList = useCallback(() => close(null, listTrigger.current), [close]);

  // Escape: the thread first, then the list — unless a dialog of the shell, the header (role switcher, language),
  // a menu or a text field has the key (review R10).
  useEffect(() => {
    if (selection === null) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="dialog"]') !== null) return;
      const origin = event.target instanceof Element ? event.target : null;
      if (origin?.closest('input, textarea, select, [contenteditable="true"], [role="menu"]')) return;
      const header = origin?.closest('header');
      if (header && header.closest('[data-testid="cockpit-page"]') === null) return;
      event.preventDefault();
      if (selection.q !== undefined) onCloseThread();
      else onCloseList();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onCloseThread, onCloseList]);

  // The focus moves only after an action of the person — never on a live update (D8, W8). A close by the browser's
  // Back has no action of its own: the focus then returns to the stored trigger as well (review nit 11).
  const previous = useRef<Selection | null>(selection);
  const pendingThreadScroll = useRef(false);
  useEffect(() => {
    const target = pendingFocus.current;
    const before = previous.current;
    previous.current = selection;
    pendingFocus.current = null;
    const focusTrigger = (key: string | null): void => {
      if (key === null) return;
      document.querySelector<HTMLElement>(`[data-cockpit-trigger="${CSS.escape(key)}"]`)?.focus();
    };
    if (target === null) {
      if (before?.q !== undefined && selection?.q === undefined && selection !== null) focusTrigger(threadTrigger.current);
      else if (before !== null && selection === null) focusTrigger(listTrigger.current);
      return;
    }
    if (target === 'list-title') {
      document.querySelector<HTMLElement>('[data-testid="cockpit-list-title"]')?.focus({ preventScroll: true });
      scrollToTop(document.querySelector<HTMLElement>('[data-testid="cockpit-list"]'));
    } else if (target === 'thread' || target === 'thread-title') {
      // From the main reading the focus goes to the thread's heading; from a row it stays on the row (arrows browse).
      if (target === 'thread-title') document.querySelector<HTMLElement>('[data-testid="cockpit-thread-title"]')?.focus({ preventScroll: true });
      pendingThreadScroll.current = true;
    } else {
      focusTrigger(target.slice('trigger:'.length));
    }
  }, [selection]);

  // Scrolled once the thread has its content, so it is in view at its full height (design major 8).
  const threadStatus = thread?.status;
  useEffect(() => {
    if (!pendingThreadScroll.current || threadStatus === undefined || threadStatus === 'loading') return;
    pendingThreadScroll.current = false;
    scrollToTop(document.querySelector<HTMLElement>('[data-testid="cockpit-thread"]'));
  }, [threadStatus, selection?.q]);

  return (
    <CockpitView
      read={read}
      units={units}
      selection={selection}
      list={list}
      thread={thread}
      announcement={announcement}
      onOpenList={onOpenList}
      onOpenThread={onOpenThread}
      onCloseList={onCloseList}
      onCloseThread={onCloseThread}
      onRetry={retry}
    />
  );
}
