/**
 * The data behind the answer backlog. One fetch of the whole corpus per version and per server-side
 * filter; everything the person changes while scanning (status chip, order) is applied in memory so
 * that 800 questions stay instant (D9). The status counts are computed from the very list that is
 * shown, so a chip never promises a row that is not there.
 *
 * Refetching is bound to `useApiVersion()` (new events, changed actor) and to `reload()`, which
 * every refused write calls: the record is the truth, the interface never patches state locally.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgendaItem, DomainEvent, Question, QuestionStatus, Track, Unit } from '@hv/domain';
import { QUESTION_STATUSES } from '@hv/domain';
import { api } from '../../api';
import { getActor, useActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import { showProblem } from '../../components';
import { getLang, translate } from '../../i18n';
import {
  LIST_LIMIT,
  createDetailProblemGate,
  NO_VERDICT,
  isCurrentLoad,
  isReadForbidden,
  keyBelongsTo,
  listOmits,
  loadKey,
  readVerdict,
} from './lib';
import type { KeyedRead, ReadVerdict } from './lib';

export type StatusFilter = QuestionStatus | 'all';
export type TrackFilter = Track | 'all';
export type SortOrder = 'number' | 'age';

export interface Filters {
  q: string;
  status: StatusFilter;
  track: TrackFilter;
  unitId: string;
  agendaItemId: string;
  sort: SortOrder;
}

export const ALL = 'all';

export const EMPTY_FILTERS: Filters = {
  q: '',
  status: ALL,
  track: ALL,
  unitId: ALL,
  agendaItemId: ALL,
  sort: 'number',
};

export function isFiltered(filters: Filters): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.status !== ALL ||
    filters.track !== ALL ||
    filters.unitId !== ALL ||
    filters.agendaItemId !== ALL
  );
}

export interface Backlog {
  /** Filtered and ordered, ready to be windowed. */
  items: readonly Question[];
  /** One count per status, over the list before the status chip is applied. */
  counts: Readonly<Record<QuestionStatus, number>>;
  /** Size of that same list — the number the "Alle" chip carries. */
  total: number;
  listLoading: boolean;
  /** Slice 010d, Ziel 2: this actor's last list read failed and no newer one is on its way — the
   *  list shows a gestalteter Fehlerzustand where it has no rows, never "Kein Treffer". */
  listFailed: boolean;
  /** Ziel 1 (slice 010b): `listQuestions` is the Hauptabfrage of the Beantwortung — set from the
   *  403's ruleId alone (AGENTS.md rule 4), e.g. podium, who holds neither `question.read` nor
   *  `question.read.delivered`. */
  listForbidden: boolean;
  selected: Question | null;
  selectedLoading: boolean;
  /** The event log of the open question — the only source for a lapsed approval. */
  selectedHistory: readonly DomainEvent[];
  /** Major (review round 2): `getQuestion` and `getQuestionHistory` used to share one
   *  `Promise.all` — a denied `getQuestionHistory` (e.g. observer, no `history.read`) rejected the
   *  whole pair, so `selected` stayed `null` and a row click looked like nothing had happened at
   *  all. Split apart: the question shows regardless, and this flag says where its history would
   *  be instead. */
  selectedHistoryForbidden: boolean;
  units: readonly Unit[];
  agendaItems: readonly AgendaItem[];
  reload: () => void;
}

const NO_EVENTS: readonly DomainEvent[] = [];
const NO_QUESTIONS: readonly Question[] = [];

/** Read the language at call time so that a message never re-runs the effect that raised it. */
function problem(error: unknown): void {
  showProblem(error, translate(getLang(), 'toast.problem'));
}

/** Typing must not fire a fetch per keystroke. */
function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useBacklog(filters: Filters, selectedId: string | null): Backlog {
  const version = useApiVersion();
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  /**
   * Slice 010d, Ziel 1: every record of this view is kept with the key of the load that read it
   * and handed out only to that load's actor (`keyBelongsTo`, lib.ts) — the list (`pool`, with
   * whether it is complete), the open question and its history. After a role switch the previous
   * role's rows, its question and that question's `_actions` are not offered for the one response
   * time until the new role has answered; the list shows its skeleton and the detail "wird
   * geladen" instead (design principle 9). A newer `version` of the same actor keeps them on screen
   * while it loads (principle 8).
   */
  const [poolState, setPoolState] = useState<{
    key: string;
    items: readonly Question[];
    complete: boolean;
  } | null>(null);
  const [listLoadingState, setListLoading] = useState(true);
  /**
   * Slice 010c, Ziel 1: the list's answer carries the key of its load (actor and `version`), and
   * "keine Leseberechtigung" is the verdict of the current key only (`readVerdict`, lib.ts). It used
   * to be a bare flag that only a successful list cleared — after a switch from a refused role, a
   * 500 on the new role's first read left the refusal standing. The refusal belongs to the actor:
   * a plain failure of the same actor's next load keeps it (review round 1, finding 4).
   */
  const actorId = useActor().id;
  const listKey = loadKey(actorId, version);
  const [listRead, setListRead] = useState<KeyedRead | null>(null);
  const [shownVerdict, setShownVerdict] = useState<ReadVerdict>(NO_VERDICT);
  const listVerdict = readVerdict(shownVerdict, [{ read: listRead, key: listKey }], actorId);
  if (listVerdict !== shownVerdict) setShownVerdict(listVerdict);
  const listForbidden = listVerdict.forbidden;
  const poolOwned = poolState !== null && keyBelongsTo(poolState.key, actorId);
  const pool = poolOwned ? poolState.items : NO_QUESTIONS;
  // Codex P2-A on 948a721: whether `pool` is the whole of what this actor may read — no
  // server-side filter, nothing cut off by the limit. Only then does "not in the list" mean "not
  // readable"; a filtered list says nothing about what it leaves out.
  const poolComplete = poolOwned && poolState.complete;
  const listLoading = listLoadingState || !poolOwned;
  // Slice 010d, Ziel 2: a failure of this actor's current list read, with nothing newer on its way.
  const listFailed =
    !listLoading && listRead !== null && listRead.status === 'error' && listRead.key === listKey;
  /**
   * Slice 010c, Ziel 5: who made the current selection. A selection of another actor that the new
   * actor's list leaves out is taken as not readable, even when that list is filtered
   * (`listOmits`) — but only its masked 404 is swallowed; a 5xx or any other failure is a real
   * fault and shows (review round 2, decision of the architect, replacing the "adopt after the
   * first list answer" rule of round 1, which toasted that 404 on every later event). The marker
   * lasts as long as the selection.
   */
  const selectedBy = useRef<string | null>(null);
  const [selectedState, setSelected] = useState<{ key: string; question: Question | null } | null>(
    null,
  );
  // Minor 2 (review round 3), Codex (a) on 7f542b6: the history is stored together with the id of
  // the question it belongs to and handed out only while that question is the one shown — while B
  // loads, A's events must not reach `lapsedApproval(B, …)` and show a false "Freigabe erloschen".
  const [history, setHistory] = useState<{
    key: string;
    questionId: string;
    events: readonly DomainEvent[];
    forbidden: boolean;
  } | null>(null);
  const [selectedLoadingState, setSelectedLoading] = useState(false);
  const [units, setUnits] = useState<readonly Unit[]>([]);
  const [agendaItems, setAgendaItems] = useState<readonly AgendaItem[]>([]);

  const search = useDebounced(filters.q.trim(), 150);
  const { track, unitId, agendaItemId } = filters;

  /**
   * Codex (b) on 7f542b6 and Codex P2-2 on 4f0d231 (one class of bug, see `createDetailProblemGate`
   * in lib.ts): a detail read's failure becomes a toast only once the list of the same load has
   * answered and was not refused — a role switch to podium refuses the list with R-PERM-02, while
   * `getQuestion` for the question still open answers with the masked 404 (Festlegung 3 of
   * docs/slices/010-lesepfade-leserechte.md), which is no read refusal by rule id.
   *
   * Nit C (review round 4): the detail reads no longer wait for the list to settle — at an event
   * rate above the list's response time that wait never ended. They wait only for a known refusal
   * (`selectionHidden` below); only the toast waits for the list's verdict, and a load the next version
   * overtakes simply never reports (its successor reads again). Minor 2 (review round 3) holds:
   * one failed selection is one toast, whichever of the two reads reports first.
   */
  const gate = useMemo(() => createDetailProblemGate(problem), []);
  const load = `${version}:${nonce}`;

  useEffect(() => {
    let cancelled = false;
    // Slice 010c, review round 1, finding 3: the same guard as every other read of this view.
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    Promise.all([api.listUnits(), api.listAgendaItems()])
      .then(([nextUnits, nextAgenda]) => {
        if (!isCurrentLoad(requested, current())) return;
        setUnits(nextUnits);
        setAgendaItems(nextAgenda);
      })
      .catch((error: unknown) => {
        if (isCurrentLoad(requested, current())) problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce]);

  useEffect(() => {
    let cancelled = false;
    // Slice 010c: the key this load answers for, and the view's key when the answer arrives —
    // read from the actor store at that moment, so an answer in the gap between an actor switch and
    // the `version` bump is dropped too.
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    setListLoading(true);
    api
      .listQuestions({
        limit: LIST_LIMIT,
        ...(search !== '' ? { q: search } : {}),
        ...(track !== ALL ? { track } : {}),
        ...(unitId !== ALL ? { unitId } : {}),
        ...(agendaItemId !== ALL ? { agendaItemId } : {}),
      })
      .then((page) => {
        if (!isCurrentLoad(requested, current())) return;
        const complete =
          search === '' &&
          track === ALL &&
          unitId === ALL &&
          agendaItemId === ALL &&
          page.items.length >= page.total;
        const ids = new Set(page.items.map((question) => question.id));
        const selectedByOther = selectedBy.current !== null && selectedBy.current !== getActor().id;
        setPoolState({ key: requested, items: page.items, complete });
        setListLoading(false);
        setListRead({ key: requested, status: 'ready' });
        gate.settleMain(`${version}:${nonce}`, false, listOmits(ids, complete, selectedByOther));
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        setListLoading(false);
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast — e.g. podium, who
          // holds neither `question.read` nor `question.read.delivered` at all.
          setPoolState({ key: requested, items: NO_QUESTIONS, complete: false });
          setListRead({ key: requested, status: 'forbidden' });
          gate.settleMain(`${version}:${nonce}`, true);
          return;
        }
        // Slice 010c, Ziel 1: a failure is this load's answer too — it replaces a refusal given to
        // another actor instead of leaving it standing (`readVerdict`).
        setListRead({ key: requested, status: 'error' });
        // Slice 010d: the same actor keeps the rows it already had; rows another actor read give
        // way to none — this actor has none yet, and the list says it failed (Ziel 2).
        setPoolState((previous) =>
          previous !== null && keyBelongsTo(previous.key, getActor().id)
            ? previous
            : { key: requested, items: NO_QUESTIONS, complete: false },
        );
        problem(error);
        // A list that failed for another reason does not say the detail is unreadable.
        gate.settleMain(`${version}:${nonce}`, false);
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce, search, track, unitId, agendaItemId, gate]);

  /**
   * Codex P2-A on 948a721: the selection is hidden — no detail read, no detail, no `_actions` of
   * the previous actor — while the view cannot show it: the list is refused (podium), or it is the
   * complete list of this actor and leaves the question out (observer, and a question that has not
   * been read out). The selection itself is kept, so switching back shows it again.
   */
  const selectionHidden =
    listForbidden ||
    (selectedId !== null && poolComplete && !pool.some((question) => question.id === selectedId));

  // Nit 2 (review round 5): each change of the selection is a new pass for the gate's one toast.
  useEffect(() => {
    gate.select();
    selectedBy.current = selectedId === null ? null : getActor().id;
  }, [selectedId, gate]);

  // Major (review round 2): the open question and its history used to travel together in one
  // `Promise.all` — a denied `getQuestionHistory` (e.g. observer, no `history.read`) rejected the
  // whole pair and `selected` stayed `null`, so a row click looked like nothing had happened.
  // `getQuestion` alone decides whether the question shows at all (a 404 — outside the actor's own
  // read scope, Festlegung 3 of docs/slices/010-lesepfade-leserechte.md — is the only reason it
  // would not); its history is a fact about that one question, not the Hauptabfrage of this view,
  // and is fetched — and can fail — on its own.
  useEffect(() => {
    if (selectedId === null || selectionHidden) {
      setSelected(null);
      setSelectedLoading(false);
      return undefined;
    }
    let cancelled = false;
    // Slice 010c, review round 1, finding 3: an answer asked for the previous actor that lands in
    // the gap before the `version` bump — with that actor's `_actions` — is dropped.
    const requested = loadKey(getActor().id, load);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, load));
    setSelectedLoading(true);
    api
      .getQuestion(selectedId)
      .then((question) => {
        if (!isCurrentLoad(requested, current())) return;
        setSelected({ key: requested, question });
        setSelectedLoading(false);
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        setSelected({ key: requested, question: null });
        setSelectedLoading(false);
        if (isReadForbidden(error)) return;
        gate.report(load, selectedId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [load, selectionHidden, selectedId, gate]);

  useEffect(() => {
    if (selectedId === null || selectionHidden) {
      setHistory(null);
      return undefined;
    }
    let cancelled = false;
    // Slice 010c, review round 1, finding 3: the same guard — a refusal given to the previous
    // actor must not stand where this actor's history would be.
    const requested = loadKey(getActor().id, load);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, load));
    api
      .getQuestionHistory(selectedId)
      .then((events) => {
        if (!isCurrentLoad(requested, current())) return;
        setHistory({ key: requested, questionId: selectedId, events, forbidden: false });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        if (isReadForbidden(error)) {
          // Put the refused state where its history would be (review round 2) — never an error
          // toast for a read refusal (Ziel 5).
          setHistory({ key: requested, questionId: selectedId, events: [], forbidden: true });
          return;
        }
        setHistory({ key: requested, questionId: selectedId, events: [], forbidden: false });
        gate.report(load, selectedId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [load, selectionHidden, selectedId, gate]);

  // Slice 010d: the open question, only to the actor it was read for; while another actor's copy
  // stands and the selection is to be read, the detail says "wird geladen".
  const selectedOwned = selectedState !== null && keyBelongsTo(selectedState.key, actorId);
  const selected = selectedOwned ? selectedState.question : null;
  const selectedLoading =
    selectedLoadingState ||
    (selectedState !== null && !selectedOwned && selectedId !== null && !selectionHidden);

  // Only the history of the question actually on screen is handed on (minor 2, review round 3),
  // and only to the actor it was read for (slice 010d).
  const ownHistory =
    selected !== null &&
    history !== null &&
    history.questionId === selected.id &&
    keyBelongsTo(history.key, actorId)
      ? history
      : null;

  const counts = useMemo(() => {
    const next = Object.fromEntries(QUESTION_STATUSES.map((status) => [status, 0])) as Record<
      QuestionStatus,
      number
    >;
    for (const question of pool) next[question.status] += 1;
    return next;
  }, [pool]);

  const items = useMemo(() => {
    const filtered =
      filters.status === ALL ? [...pool] : pool.filter((q) => q.status === filters.status);
    filtered.sort(
      filters.sort === 'number'
        ? (a, b) => a.number.localeCompare(b.number)
        : (a, b) => a.createdAt.localeCompare(b.createdAt) || a.number.localeCompare(b.number),
    );
    return filtered;
  }, [pool, filters.status, filters.sort]);

  return {
    items,
    counts,
    total: pool.length,
    listLoading,
    listFailed,
    listForbidden,
    selected,
    selectedLoading,
    selectedHistory: ownHistory?.events ?? NO_EVENTS,
    selectedHistoryForbidden: ownHistory?.forbidden ?? false,
    units,
    agendaItems,
    reload,
  };
}
