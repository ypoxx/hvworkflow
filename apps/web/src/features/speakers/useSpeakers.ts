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

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface SpeakersState {
  status: LoadStatus;
  speakers: readonly Speaker[];
  reload: () => void;
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
