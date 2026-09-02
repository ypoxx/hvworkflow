/**
 * A counter that increments on every new event and on every actor change. Views use it as a
 * dependency to refetch through the API, which keeps them independent of how the data arrives
 * (in-process now, SSE later) and of who is looking (`_actions` differ per actor).
 */
import { useEffect, useState } from 'react';
import { subscribeToChanges } from './index';
import { useActor } from './actor';

export function useApiVersion(): number {
  const [version, setVersion] = useState(0);
  const actor = useActor();
  useEffect(() => subscribeToChanges(() => setVersion((v) => v + 1)), []);
  useEffect(() => setVersion((v) => v + 1), [actor]);
  return version;
}
