/**
 * The meeting and its counters, refetched whenever the event log grows or the actor changes. Views
 * never read the projection directly — everything comes through `HvApi` (AGENTS.md rule 6).
 */
import { useEffect, useState } from 'react';
import type { Meeting } from '@hv/domain';
import { api } from '../api';
import { useApiVersion } from '../api/useApiVersion';
import { showProblem } from '../components';
import { getLang, translate } from '../i18n';

export function useMeeting(): Meeting | null {
  const version = useApiVersion();
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getMeeting()
      .then((next) => {
        if (!cancelled) setMeeting(next);
      })
      .catch((error: unknown) => {
        // Read the language at call time: the message must not re-run this effect on a language switch.
        if (!cancelled) showProblem(error, translate(getLang(), 'toast.problem'));
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return meeting;
}
