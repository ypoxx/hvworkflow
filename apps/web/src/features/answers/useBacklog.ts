/**
 * The data behind the answer backlog. One fetch of the whole corpus per version and per server-side
 * filter; everything the person changes while scanning (status chip, order) is applied in memory so
 * that 800 questions stay instant (D9). The status counts are computed from the very list that is
 * shown, so a chip never promises a row that is not there.
 *
 * Refetching is bound to `useApiVersion()` (new events, changed actor) and to `reload()`, which
 * every refused write calls: the record is the truth, the interface never patches state locally.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgendaItem, Question, QuestionStatus, Track, Unit } from '@hv/domain';
import { QUESTION_STATUSES } from '@hv/domain';
import { api } from '../../api';
import { useApiVersion } from '../../api/useApiVersion';
import { showProblem } from '../../components';
import { getLang, translate } from '../../i18n';
import { LIST_LIMIT } from './lib';

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
  selected: Question | null;
  selectedLoading: boolean;
  units: readonly Unit[];
  agendaItems: readonly AgendaItem[];
  reload: () => void;
}

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
  const [selected, setSelected] = useState<Question | null>(null);
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
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListLoading(false);
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce, search, track, unitId, agendaItemId]);

  useEffect(() => {
    if (selectedId === null) {
      setSelected(null);
      return undefined;
    }
    let cancelled = false;
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
        problem(error);
      });
    return () => {
      cancelled = true;
    };
  }, [version, nonce, selectedId]);

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
    selected,
    selectedLoading,
    units,
    agendaItems,
    reload,
  };
}
