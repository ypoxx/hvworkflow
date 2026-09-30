/**
 * Loading for the capture desk. Every list is fetched through `HvApi` and refetched when the event
 * log grows or the actor changes (`useApiVersion`), so two capture desks working on the same
 * Redebeitrag see each other's Einzelfragen without a reload.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { etagOf } from '@hv/domain';
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
  /** Slice 010c: the answer of the last settled load with its key (`null` while it loads)… */
  read: KeyedRead | null;
  /** …and the key of this very render, to hand both to `readVerdict`. */
  key: string;
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

/** A lost optimistic-lock race or a missing required version needs an explicit reload. */
export function isVersionConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  return error.status === 412 || error.status === 428;
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
  const actorId = useActor().id;
  const current = loadKey(actorId, key);
  /**
   * Slice 010d, Ziel 1: `data` carries the key of the load that read it (`dataKey`), apart from
   * `key`, which names the load in progress. Data is handed out only to its own actor
   * (`keyBelongsTo`): after a role switch the previous role's records — and with them its
   * `_actions`, from which the desk reads what it may capture or classify — give way to the fallback
   * and a "loading" status until the new role has answered. The same actor keeps its data on screen
   * while the next `version` loads (design principle 8).
   */
  const [state, setState] = useState<{
    status: LoadStatus;
    data: T;
    dataKey: string | null;
    key: string;
  }>({
    status: 'loading',
    data: fallback,
    dataKey: null,
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
    setState((previous) => ({ ...previous, status: 'loading', key: requested }));
    loaderRef
      .current()
      .then((data) => {
        if (isCurrentLoad(requested, now())) {
          setState({ status: 'ready', data, dataKey: requested, key: requested });
        }
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, now())) return;
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast — and the data resets
          // to the fallback rather than keeping a stale, no-longer-readable list on screen.
          setState({
            status: 'forbidden',
            data: fallbackRef.current,
            dataKey: requested,
            key: requested,
          });
          return;
        }
        // The language is read at call time: a language switch must not re-run the load.
        showProblem(error, translate(getLang(), 'toast.problem'));
        setState((previous) => ({ ...previous, status: 'error', key: requested }));
      });
    return () => {
      cancelled = true;
    };
  }, [token, key]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  const owned = keyBelongsTo(state.dataKey, actorId);
  return {
    // Slice 010d: a status reached for another actor says nothing about this one's data.
    status: keyBelongsTo(state.key, actorId) ? state.status : 'loading',
    data: owned ? state.data : fallback,
    reload,
    settled: state.status !== 'loading' && isCurrentLoad(state.key, current),
    read: state.status === 'loading' ? null : { key: state.key, status: state.status },
    key: current,
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
 *   has answered for the current key (`readVerdict`). Until then the previous verdict stands, so
 *   nothing flickers while a load is on its way (design principle 8; review round 1, finding 7).
 *   A refusal belongs to the actor it was given to (review round 1, finding 4): a ready answer or a
 *   refusal replaces it, and so does a failure of another actor's load — but a plain failure of the
 *   same actor's next load says nothing new about that actor's rights, and the refusal stands.
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

/** The verdict a view shows, and the actor it was reached for (`null` before any). */
export interface ReadVerdict {
  readonly actor: string | null;
  readonly forbidden: boolean;
}

export const NO_VERDICT: ReadVerdict = { actor: null, forbidden: false };

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

/**
 * The verdict a view shows for `actorId`: `previous` until every read has answered for its own
 * current key, then "refused" if one of those answers is a refusal — or if every one of them failed
 * and the previous refusal was this very actor's. An unchanged verdict is returned as the same
 * object, so a caller may store it during render without looping.
 */
export function readVerdict(
  previous: ReadVerdict,
  reads: readonly { read: KeyedRead | null; key: string }[],
  actorId: string,
): ReadVerdict {
  const answers: ReadStatus[] = [];
  for (const { read, key } of reads) {
    if (read === null || read.key !== key) return previous;
    answers.push(read.status);
  }
  const keepsRefusal =
    previous.forbidden &&
    previous.actor === actorId &&
    answers.every((status) => status === 'error');
  const forbidden = answers.includes('forbidden') || keepsRefusal;
  return previous.actor === actorId && previous.forbidden === forbidden
    ? previous
    : { actor: actorId, forbidden };
}

/**
 * Slice 010d (Ansichtsdaten gehören dem Schlüssel des Akteurs): whether data loaded under `key` may
 * be offered to `actorId` — only data of that very actor, at any `version`. Data of another actor
 * (the previous role, until the new one has answered) carries that actor's `_actions` and read
 * scope; it is not offered (design principle 9), and the view shows its loading state instead.
 * `null`: nothing loaded yet. The actor is read from the key as a whole (`loadKey` is JSON), so
 * one id that is a prefix of another never matches.
 *
 * Kept as a small local copy per feature that holds such data (`speakers/useSpeakers.ts`,
 * `capture/useCapture.ts`, `answers/lib.ts`, `history/lib.ts`), next to the 010c pattern above, and
 * covered by the same test table in each.
 */
export function keyBelongsTo(key: string | null, actorId: string): boolean {
  if (key === null) return false;
  const [owner] = JSON.parse(key) as unknown[];
  return owner === actorId;
}

/**
 * takt-032 (Ziel 1): what the last `captureQuestions` answered with — the `ETag` of the Redebeitrag
 * from `lastWriteEtag()`, passed on unchanged — and the version the list showed when the write was made.
 */
export interface ContributionMark {
  readonly id: string;
  readonly base: number;
  readonly etag: string;
}

/**
 * The `ifMatch` for the next write on `contribution`: the tag from the answer while the list still
 * shows the version the write was made on; once a list read after the answer has another version,
 * that one. Another Redebeitrag never uses the mark. The page never counts a version up itself.
 */
export function etagForContribution(
  contribution: { readonly id: string; readonly version: number },
  mark: ContributionMark | null,
): string {
  return mark !== null && mark.id === contribution.id && contribution.version <= mark.base
    ? mark.etag
    : etagOf(contribution.version);
}

/**
 * The version an `ETag` of this API stands for (`etagOf`), or `null` for a tag it cannot place. Only
 * used to compare an answer with what is shown; the tag itself is always sent on unchanged.
 */
export function versionOfEtag(etag: string): number | null {
  const match = /^(?:W\/)?"v(\d+)"$/.exec(etag);
  return match === null ? null : Number(match[1]);
}

/**
 * The mark for an answer just received. Its base is the version shown *now*, not the one the write
 * began with: a reload may have landed while the write ran, and a mark based on the older closure
 * would let that newer list override the fresher tag of this answer.
 * Codex P1 on PR #86: another desk may have moved the Redebeitrag while the answer was delayed. If the
 * version shown is already at or past the one the answer tag stands for, there is no mark (`null`):
 * the next write uses the tag of the shown read, and a stale tag never outlives a newer read.
 */
export function markAfterAnswer(
  written: { readonly id: string; readonly version: number },
  shownNow: { readonly id: string; readonly version: number } | undefined,
  etag: string,
): ContributionMark | null {
  const answered = versionOfEtag(etag);
  if (answered === null) return null;
  const shown = shownNow !== undefined && shownNow.id === written.id ? shownNow.version : written.version;
  const base = Math.max(shown, written.version);
  return base >= answered ? null : { id: written.id, base, etag };
}

/** After `captureContribution` the new version of the Wortmeldung is not in the answer (Befund). */
export interface SpeakerLock {
  readonly speakerId: string;
  readonly base: number;
}

/** Locked until a list of the Wortmeldungen shows another version than the one the write was made on. */
export function isSpeakerLocked(
  speaker: { readonly id: string; readonly version: number } | undefined,
  lock: SpeakerLock | null,
): boolean {
  return lock !== null && speaker !== undefined && speaker.id === lock.speakerId && speaker.version === lock.base;
}

/** The cards and the coverage as shown together. */
export interface ShownPair<Q, C> {
  readonly questions: Q;
  readonly contributions: C;
}

/**
 * takt-032 (Ziel 3): a newer pair replaces the shown one only once both reads have answered for the
 * current key — the same `useApiVersion` stand. Until then the old pair stays on screen (design
 * principle 8). The pair shown itself comes back when nothing changed, so the caller may store the
 * result during render without looping.
 */
export function landPair<Q, C>(
  shown: ShownPair<Q, C> | null,
  next: { questions: Q; contributions: C; questionsReady: boolean; contributionsReady: boolean },
): ShownPair<Q, C> | null {
  if (!next.questionsReady || !next.contributionsReady) return shown;
  if (shown !== null && shown.questions === next.questions && shown.contributions === next.contributions) {
    return shown;
  }
  return { questions: next.questions, contributions: next.contributions };
}
