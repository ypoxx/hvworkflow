/**
 * The Wortmeldeliste as the API hands it out: sorted by round and position, with the `_actions` the
 * calling actor may take. Refetches whenever the event log grows or the actor changes
 * (`useApiVersion`), and on demand after a refused write.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Speaker } from '@hv/domain';
import { api } from '../../api';
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

  useEffect(() => {
    let cancelled = false;
    api
      .listSpeakers()
      .then((next) => {
        if (cancelled) return;
        setSpeakers(next);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
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
