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
import { useApiVersion } from '../../api/useApiVersion';
import { showProblem } from '../../components';
import { getLang, translate } from '../../i18n';
import { LIST_LIMIT, isReadForbidden } from './lib';

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

  const [pool, setPool] = useState<readonly Question[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listForbidden, setListForbidden] = useState(false);
  const [selected, setSelected] = useState<Question | null>(null);
  // Minor 2 (review round 3), Codex (a) on 7f542b6: the history is stored together with the id of
  // the question it belongs to and handed out only while that question is the one shown — while B
  // loads, A's events must not reach `lapsedApproval(B, …)` and show a false "Freigabe erloschen".
  const [history, setHistory] = useState<{
    questionId: string;
    events: readonly DomainEvent[];
    forbidden: boolean;
  } | null>(null);
  // Codex (b) on 7f542b6: the version and nonce the list last settled on, and whether it was
  // refused — the detail loads wait for it (see below).
  const [listSettled, setListSettled] = useState<string | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [units, setUnits] = useState<readonly Unit[]>([]);
  const [agendaItems, setAgendaItems] = useState<readonly AgendaItem[]>([]);

  const search = useDebounced(filters.q.trim(), 150);
  const { track, unitId, agendaItemId } = filters;

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listUnits(), api.listAgendaItems()])
      .then(([nextUnits, nextAgenda]) => {
        if (cancelled) return;
        setUnits(nextUnits);
        setAgendaItems(nextAgenda);
      })
      .catch(problem);
    return () => {
      cancelled = true;
    };
  }, [version, nonce]);

  useEffect(() => {
    let cancelled = false;
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
        if (cancelled) return;
        setPool(page.items);
        setListLoading(false);
        setListForbidden(false);
        setListSettled(`${version}:${nonce}`);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListLoading(false);
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast — e.g. podium, who
          // holds neither `question.read` nor `question.read.delivered` at all.
          setPool([]);
          setListForbidden(true);
          setListSettled(`${version}:${nonce}:forbidden`);
          return;
        }
        problem(error);
        // A list that failed for another reason does not say the detail is unreadable: let it try.
        setListSettled(`${version}:${nonce}`);
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce, search, track, unitId, agendaItemId]);

  /**
   * Codex (b) on 7f542b6: the detail reads wait until the list has settled for this very
   * `version`/`nonce`, and do not run at all once the list is refused. A role switch bumps
   * `version`; a role without any question read (podium) is refused the list with R-PERM-02, but
   * `getQuestion` for the question still open answers with the masked 404 (Festlegung 3 of
   * docs/slices/010-lesepfade-leserechte.md) — no read refusal by rule id, so it used to become an
   * error toast on top of the gestaltete Zustand. While the list is loading, the detail on screen
   * stays as it is (nothing jumps, design principle 8).
   */
  const current = `${version}:${nonce}`;
  const detailGate =
    listSettled === current ? 'open' : listSettled === `${current}:forbidden` ? 'closed' : 'wait';

  /**
   * Minor 2 (review round 3): the question and its history fail independently (review round 2),
   * but one failed selection is one toast — whichever of the two reports first claims it.
   */
  const toastedFor = useRef<string | null>(null);
  const problemOnce = useCallback((key: string, error: unknown) => {
    if (toastedFor.current === key) return;
    toastedFor.current = key;
    problem(error);
  }, []);

  // Major (review round 2): the open question and its history used to travel together in one
  // `Promise.all` — a denied `getQuestionHistory` (e.g. observer, no `history.read`) rejected the
  // whole pair and `selected` stayed `null`, so a row click looked like nothing had happened.
  // `getQuestion` alone decides whether the question shows at all (a 404 — outside the actor's own
  // read scope, Festlegung 3 of docs/slices/010-lesepfade-leserechte.md — is the only reason it
  // would not); its history is a fact about that one question, not the Hauptabfrage of this view,
  // and is fetched — and can fail — on its own.
  useEffect(() => {
    if (selectedId === null || detailGate === 'closed') {
      setSelected(null);
      setSelectedLoading(false);
      return undefined;
    }
    if (detailGate === 'wait') return undefined;
    let cancelled = false;
    const key = `${current}:${selectedId}`;
    setSelectedLoading(true);
    api
      .getQuestion(selectedId)
      .then((question) => {
        if (cancelled) return;
        setSelected(question);
        setSelectedLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSelected(null);
        setSelectedLoading(false);
        if (isReadForbidden(error)) return;
        problemOnce(key, error);
      });
    return () => {
      cancelled = true;
    };
  }, [current, detailGate, selectedId, problemOnce]);

  useEffect(() => {
    if (selectedId === null || detailGate === 'closed') {
      setHistory(null);
      return undefined;
    }
    if (detailGate === 'wait') return undefined;
    let cancelled = false;
    const key = `${current}:${selectedId}`;
    api
      .getQuestionHistory(selectedId)
      .then((events) => {
        if (cancelled) return;
        setHistory({ questionId: selectedId, events, forbidden: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isReadForbidden(error)) {
          // Put the refused state where its history would be (review round 2) — never an error
          // toast for a read refusal (Ziel 5).
          setHistory({ questionId: selectedId, events: [], forbidden: true });
          return;
        }
        setHistory({ questionId: selectedId, events: [], forbidden: false });
        problemOnce(key, error);
      });
    return () => {
      cancelled = true;
    };
  }, [current, detailGate, selectedId, problemOnce]);

  // Only the history of the question actually on screen is handed on (minor 2, review round 3).
  const ownHistory = selected !== null && history?.questionId === selected.id ? history : null;

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
