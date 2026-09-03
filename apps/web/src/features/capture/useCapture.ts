/**
 * Loading for the capture desk. Every list is fetched through `HvApi` and refetched when the event
 * log grows or the actor changes (`useApiVersion`), so two capture desks working on the same
 * Redebeitrag see each other's Einzelfragen without a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { showProblem } from '../../components';
import { getLang, translate } from '../../i18n';

export interface HoveredQuestion {
  hoveredQuestionId: string | null;
  onHoverQuestion: (id: string | null) => void;
}

/**
 * The one piece of state a marked span in `ContributionText` and its `QuestionCard` share: hovering
 * (or focusing) either highlights the other (point 5 of slice 006). Lives here, next to `useAsync`,
 * because both halves of the capture desk (`ContributionPane`, `QuestionsPane`) sit as siblings under
 * `CapturePage` and have no closer common ancestor to hold it.
 */
export function useHoveredQuestion(): HoveredQuestion {
  const [hoveredQuestionId, onHoverQuestion] = useState<string | null>(null);
  return { hoveredQuestionId, onHoverQuestion };
}

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface AsyncState<T> {
  status: LoadStatus;
  data: T;
  reload: () => void;
}

/**
 * One loader with the house's failure behaviour: the data on screen stays while the next answer is
 * fetched (nothing jumps, design principle 8) and a refused call becomes a toast.
 *
 * `key` is what the load depends on — the API version plus the ids of the current selection. It is
 * one string instead of a dependency list so that the dependency of this hook stays checkable.
 */
export function useAsync<T>(loader: () => Promise<T>, fallback: T, key: string): AsyncState<T> {
  const [state, setState] = useState<{ status: LoadStatus; data: T }>({
    status: 'loading',
    data: fallback,
  });
  const [token, setToken] = useState(0);

  // Kept in sync before the loading effect of the same commit runs.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ status: 'loading', data: previous.data }));
    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // The language is read at call time: a language switch must not re-run the load.
        showProblem(error, translate(getLang(), 'toast.problem'));
        setState((previous) => ({ status: 'error', data: previous.data }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, key]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { status: state.status, data: state.data, reload };
}
