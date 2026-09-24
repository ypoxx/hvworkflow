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
 */
function isReadForbidden(error: unknown): boolean {
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
