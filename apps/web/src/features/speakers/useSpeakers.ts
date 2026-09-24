/**
 * The Wortmeldeliste as the API hands it out: sorted by round and position, with the `_actions` the
 * calling actor may take. Refetches whenever the event log grows or the actor changes
 * (`useApiVersion`), and on demand after a refused write.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Speaker } from '@hv/domain';
import { api } from '../../api';
import { getActor } from '../../api/actor';
import { useApiVersion } from '../../api/useApiVersion';
import { showProblem } from '../../components';
import { getLang, translate } from '../../i18n';

export type LoadStatus = 'loading' | 'ready' | 'error' | 'forbidden';

export interface SpeakersState {
  status: LoadStatus;
  speakers: readonly Speaker[];
  reload: () => void;
}

/**
 * A denied read (R-PERM-02 "no read permission" or R-PERM-03 "read scope exceeded", slice 010).
 * Structural, not `instanceof`: the interface talks to `HvApi`, and an HTTP adapter hands out a
 * plain problem object rather than the domain's error class. Read by ruleId alone, never by role
 * name (AGENTS.md rule 4, docs/slices/010b-lesepfade-oberflaeche.md Ziel 4).
 *
 * Test gap 8c (review round 2): identical in `capture/useCapture.ts`, `answers/lib.ts`,
 * `stage/lib.ts` and `history/lib.ts` — not one shared implementation. This slice's "Files
 * allowed" (docs/slices/010b-lesepfade-oberflaeche.md) is five feature folders, nothing else; the
 * house's own convention for a feature helper this small is to keep it local rather than import it
 * from a neighbour (`stage/lib.ts`'s own docstring: "must not start depending on the backlog's
 * machinery" — `clockTime` is duplicated the same way, in `answers/lib.ts`, `stage/lib.ts` and
 * `history/lib.ts`, each with its own house-specific format). Every copy carries its own test
 * (`useSpeakers.test.ts` here) covering the same table, so a change to one that silently drifts
 * from the others fails loudly rather than staying unnoticed.
 */
export function isReadForbidden(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = 'status' in error ? (error as { status: unknown }).status : undefined;
  const ruleId = 'ruleId' in error ? (error as { ruleId: unknown }).ruleId : undefined;
  return status === 403 && (ruleId === 'R-PERM-02' || ruleId === 'R-PERM-03');
}

export function useSpeakers(): SpeakersState {
  const version = useApiVersion();
  const [token, setToken] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [speakers, setSpeakers] = useState<readonly Speaker[]>([]);

  /**
   * Slice 010c, Ziel 4: every answer is set as it comes — ready, refused and failed alike — so a
   * failure already replaces an earlier refusal here. What was missing is the key: an answer asked
   * for the previous actor that lands in the gap between an actor switch and the `version` bump
   * (api/useApiVersion.ts) used to be taken — the refusal of a role that is no longer signed in
   * stood until the new role's own answer came in. It is dropped now (`isCurrentLoad`).
   */
  useEffect(() => {
    let cancelled = false;
    const requested = loadKey(getActor().id, version);
    const current = (): string | null => (cancelled ? null : loadKey(getActor().id, version));
    api
      .listSpeakers()
      .then((next) => {
        if (!isCurrentLoad(requested, current())) return;
        setSpeakers(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!isCurrentLoad(requested, current())) return;
        if (isReadForbidden(error)) {
          // Ziel 1 (slice 010b): a gestalteter Zustand, not an error toast — the Wortmeldeliste
          // is simply not readable in this role.
          setSpeakers([]);
          setStatus('forbidden');
          return;
        }
        // The language is read at call time so that a language switch does not re-run the load.
        showProblem(error, translate(getLang(), 'toast.problem'));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [version, token]);

  const reload = useCallback(() => setToken((value) => value + 1), []);
  return { status, speakers, reload };
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
