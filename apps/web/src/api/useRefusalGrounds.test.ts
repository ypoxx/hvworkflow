/**
 * Scheibe 045, Test 10: the catalogue of refusal grounds is read once per actor (010d: data belongs to
 * the actor, compared by `id`, never by role), read again after an actor change, and a refused read
 * ends in `failed` without a toast. The hook is a thin shell over `createRefusalGroundsLoader`, which
 * is tested here without React.
 */
import { describe, expect, it } from 'vitest';
import type { RefusalGround } from '@hv/domain';
import { createRefusalGroundsLoader, groundsFor } from './useRefusalGrounds';
import type { RefusalGroundsState } from './useRefusalGrounds';

const G = [{ id: 'g1', title: 'T', stageText: 'S', legalRef: { verified: false }, hash: 'h' }] as unknown as RefusalGround[];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createRefusalGroundsLoader (Test 10)', () => {
  it('loads once per actor; the same id again loads nothing', async () => {
    let calls = 0;
    const states: RefusalGroundsState[] = [];
    const loader = createRefusalGroundsLoader(async () => { calls += 1; return G; }, (s) => states.push(s));
    loader.follow('u-1');
    loader.follow('u-1');
    await flush();
    loader.follow('u-1');
    expect(calls).toBe(1);
    expect(states.map((s) => s.status)).toEqual(['loading', 'ready']);
    expect(states.at(-1)).toEqual({ actorId: 'u-1', status: 'ready', grounds: G });
  });

  it('loads again after an actor change; an answer for the previous actor never lands', async () => {
    let calls = 0;
    let release: (value: RefusalGround[]) => void = () => undefined;
    const states: RefusalGroundsState[] = [];
    const loader = createRefusalGroundsLoader(
      () => { calls += 1; return calls === 1 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(G); },
      (s) => states.push(s),
    );
    loader.follow('u-1');
    loader.follow('u-2');
    await flush();
    release(G);
    await flush();
    expect(calls).toBe(2);
    expect(states.filter((s) => s.actorId === 'u-1').map((s) => s.status)).toEqual(['loading']);
    expect(states.at(-1)).toEqual({ actorId: 'u-2', status: 'ready', grounds: G });
  });

  it('A → B → A: a late answer of the first read of A never settles over the second (Codex P2)', async () => {
    let calls = 0;
    let rejectFirst: (reason: unknown) => void = () => undefined;
    const states: RefusalGroundsState[] = [];
    const loader = createRefusalGroundsLoader(
      () => {
        calls += 1;
        return calls === 1 ? new Promise((_, reject) => { rejectFirst = reject; }) : Promise.resolve(G);
      },
      (s) => states.push(s),
    );
    loader.follow('u-1');
    loader.follow('u-2');
    loader.follow('u-1');
    await flush();
    expect(states.at(-1)).toEqual({ actorId: 'u-1', status: 'ready', grounds: G });
    rejectFirst({ status: 503 });
    await flush();
    expect(calls).toBe(3);
    expect(states.at(-1)).toEqual({ actorId: 'u-1', status: 'ready', grounds: G });
  });

  it('a refused read ends in failed (no toast: the loader has no toast path at all)', async () => {
    const states: RefusalGroundsState[] = [];
    const loader = createRefusalGroundsLoader(() => Promise.reject({ status: 403, ruleId: 'R-PERM-02' }), (s) => states.push(s));
    loader.follow('u-1');
    await flush();
    expect(states.at(-1)).toEqual({ actorId: 'u-1', status: 'failed', grounds: [] });
  });

  it('groundsFor shows another actor\'s state as loading (no data across an actor change)', () => {
    const ready: RefusalGroundsState = { actorId: 'u-1', status: 'ready', grounds: G };
    expect(groundsFor(ready, 'u-1')).toEqual({ status: 'ready', grounds: G });
    expect(groundsFor(ready, 'u-2')).toEqual({ status: 'loading', grounds: [] });
  });
});
