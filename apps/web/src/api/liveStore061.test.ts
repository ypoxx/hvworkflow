/**
 * Scheibe 061, part A (web adapter), test L1: the control desk read (`getCockpit`) passes the live store
 * unbuffered. Its value ages without an event (every age moves with the service clock), so a buffered
 * answer would show stale minutes for up to 30 s; the store hands every call to the adapter.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Actor, Cockpit, HvApi } from '@hv/domain';
import { createLiveStore, READ_TOPICS } from './liveStore';

const reader: Actor = { id: 'coord-061', role: 'coordination' };

/** `getCockpit` is no key of READ_TOPICS: a type-level check that fails to compile if it ever becomes one. */
type NotBuffered = 'getCockpit' extends keyof typeof READ_TOPICS ? never : true;
const notBuffered: NotBuffered = true;

function answer(n: number): Cockpit {
  return {
    meetingId: 'hv-2031', asOf: `2031-05-06T12:00:0${n}.000Z`, meetingStatus: 'running',
    totals: { captured: n, open: n, staged: 0, answered: 0 },
    openByStatus: { captured: n, classified: 0, assigned: 0, answer_drafted: 0, in_review: 0, approved: 0, staged: 0 },
    openByUnit: {}, openUnassigned: n, oldestOpen: { ageSeconds: n, items: [] },
    inflow: { binSeconds: 300, bins: Array.from({ length: 12 }, () => 0), last5m: 0 },
    legalReview: { over10m: 0, items: [] },
  };
}

describe('L1 getCockpit passes the live store unbuffered', () => {
  it('exists, calls the adapter on every call and returns its answer unchanged', async () => {
    let n = 0;
    const getCockpit = vi.fn(async () => answer(++n));
    const adapter = { getCockpit, subscribe: () => () => undefined, lastWriteEtag: () => undefined } as unknown as HvApi;
    const store = createLiveStore(adapter, { getActor: () => reader, now: () => 0, monotonic: () => 0 });
    store.subscribe(() => undefined); // a listening store would buffer a buffered read
    expect(typeof store.getCockpit).toBe('function');
    const first = await store.getCockpit();
    const second = await store.getCockpit();
    expect(getCockpit).toHaveBeenCalledTimes(2);
    expect(first).toEqual(answer(1));
    expect(second).toEqual(answer(2));
    expect(Object.keys(READ_TOPICS)).not.toContain('getCockpit');
    expect(notBuffered).toBe(true);
  });
});
