/**
 * Loading for the capture desk. Every list is fetched through `HvApi` and refetched when the event
 * log grows or the actor changes (`useApiVersion`), so two capture desks working on the same
 * Redebeitrag see each other's Einzelfragen without a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getActor, useActor } from '../../api/actor';
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

export type LoadStatus = 'loading' | 'ready' | 'error' | 'forbidden';

export interface AsyncState<T> {
  status: LoadStatus;
  data: T;
  reload: () => void;
  /**
   * Minor 1 (review round 5): `status` has answered for the `key` of this very render. Right after
   * the key changes, `status` still belongs to the previous key until the loading effect has run —
   * a caller that combines several loads must not read that stale status as the current verdict.
   *
   * Slice 010c: the key includes the actor (`loadKey`), so the render right after an actor switch —
   * before the `version` bump reaches the caller's key — is not settled either.
   */
  settled: boolean;
}

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Structural, not `instanceof`: the interface talks to `HvApi`, and an HTTP adapter hands out a
 * plain problem object rather than the domain's error class. Read by ruleId alone, never by role
 * name (AGENTS.md rule 4, docs/slices/010b-lesepfade-oberflaeche.md Ziel 4).
 *
 * Test gap 8c (review round 2): identical in `speakers/useSpeakers.ts`, `answers/lib.ts`,
 * `stage/lib.ts` and `history/lib.ts` — see `speakers/useSpeakers.ts`'s copy for why this stays
 * five small local copies rather than one shared module. Covered by its own test here
 * (`useCapture.test.ts`).
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status: unknown }).status : undefined;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return status === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
}

/**
 * One loader with the house's failure behaviour: the data on screen stays while the next answer is
 * fetched (nothing jumps, design principle 8) and a refused call becomes a toast — except a denied
 * read (Ziel 1, slice 010b), which becomes the `'forbidden'` status instead: a gestalteter Zustand,
 * never a toast.
 *
 * `key` is what the load depends on — the API version plus the ids of the current selection. It is
 * one string instead of a dependency list so that the dependency of this hook stays checkable.
 *
 * Slice 010c: every state carries the key of its load together with the actor who asked
 * (`loadKey`); an answer that arrives for another actor than the current one is dropped, like one
 * of an overtaken `key`.
 */
export function useAsync<T>(loader: () => Promise<T>, fallback: T, key: string): AsyncState<T> {
  const current = loadKey(useActor().id, key);
  const [state, setState] = useState<{ status: LoadStatus; data: T; key: string }>({
    status: 'loading',
    data: fallback,
    key: current,
  });
  const [token, setToken] = useState(0);

  // Kept in sync before the loading effect of the same commit runs.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });
  // Same idea, for the value a denied read below resets to — `fallback` is stable in every caller
  // (a module-level constant such as `NO_SPEAKERS`), but a ref keeps the loading effect's own
  // dependency list exactly `[token, key]` (the two things the load actually depends on).
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  });

  useEffect(() => {
    let cancelled = false;
    const requested = loadKey(getActor().id, key);
    const now = (): string | null => (cancelled ? null : loadKey(getActor().id, key));
    setState((previous) => ({ status: 'loading', data: previous.data, key: requested }));
    loaderRef
      .current()
      .then((data) => {
        if (isCurrentLoad(requested, now())) setState({ status: 'ready', data, key: requested });
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, now())) return;
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast — and the data resets
          // to the fallback rather than keeping a stale, no-longer-readable list on screen.
          setState({ status: 'forbidden', data: fallbackRef.current, key: requested });
          return;
        }
        // The language is read at call time: a language switch must not re-run the load.
        showProblem(error, translate(getLang(), 'toast.problem'));
        setState((previous) => ({ status: 'error', data: previous.data, key: requested }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, key]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return {
    status: state.status,
    data: state.data,
    reload,
    settled: state.status !== 'loading' && isCurrentLoad(state.key, current),
  };
}

/**
 * Slice 010c (Lesezustand je Ladevorgang): a read state — ready, refused, failed — belongs to the
 * load that produced it, and a load is keyed by the actor who asked and the `version` it asked at.
 * Two rules follow, and every view keeps both:
 * - An answer counts only for its own load (`isCurrentLoad`). One that was overtaken — a newer
 *   `version`, or another actor in the gap before the `version` bump that follows every actor
 *   switch (api/useApiVersion.ts) — never reports.
 * - The view's verdict ("keine Leseberechtigung" or not) changes only once every read it depends on
 *   has answered for the current key (`readVerdict`), and then whatever those answers say replaces
 *   it: a refusal of an earlier load never outlives a failure of the current one. Until then the
 *   previous verdict stands, so nothing flickers while a load is on its way (design principle 8).
 *
 * Kept as a small local copy per feature (`speakers/useSpeakers.ts`, `capture/useCapture.ts`,
 * `answers/lib.ts`, `stage/lib.ts`, `history/lib.ts`) — the spec allows no shared folder outside the
 * features — and covered by the same test table in each.
 */
export type ReadStatus = 'ready' | 'forbidden' | 'error';

/** What one load answered, and which load that was. */
export interface KeyedRead {
  readonly key: string;
  readonly status: ReadStatus;
}

/** The key of one load: who asked, and at which `version` (plus, where needed, what was asked). */
export function loadKey(actorId: string, version: number | string): string {
  return JSON.stringify([actorId, String(version)]);
}

/**
 * Whether an answer asked under `requested` still speaks for the view. `current` is the view's key
 * at the moment the answer arrives, or `null` once the view has moved on (its effect was cleaned up).
 */
export function isCurrentLoad(requested: string, current: string | null): boolean {
  return current !== null && requested === current;
}

/** Whether `read` has answered for `key` — a read of an earlier key has not. */
export function settledFor(read: KeyedRead | null, key: string): boolean {
  return read !== null && read.key === key;
}

/**
 * The verdict a view shows: `previous` until every read has answered for its own current key, then
 * "refused" exactly if one of those answers is a refusal.
 */
export function readVerdict(
  previous: boolean,
  reads: readonly { read: KeyedRead | null; key: string }[],
): boolean {
  if (!reads.every(({ read, key }) => settledFor(read, key))) return previous;
  return reads.some(({ read }) => read?.status === 'forbidden');
}
