/**
 * takt-057, Ziel 3 (T-G1-I-09): the held window of the Ereignisstrom belongs to one person in the structural sense
 * (`actorKey`, every field of the `Actor`), not only to one id. A role change under the same id reads it afresh.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Actor, HvApi, ReadEvent } from '@hv/domain';
import { advanceStream } from './lib';

// The page module wires the real adapter on import; the key helpers under test need none of it.
vi.mock('../../api', () => ({ api: {} }));

const { streamWindowKey, streamWindowOwned, heldStreamBase, shownStream } = await import('./Page');

const person: Actor = { id: 'u-057', role: 'coordination', displayName: 'Koordination' };

describe('stream window ownership (takt-057)', () => {
  it('a window read by the same structural actor is its own, at any version', () => {
    expect(streamWindowOwned(streamWindowKey(person, 3), { ...person })).toBe(true);
    expect(streamWindowOwned(streamWindowKey(person, 3), { ...person, unitId: undefined } as unknown as Actor)).toBe(true);
  });

  it('the same id with another role, unit or name does not own the window', () => {
    const key = streamWindowKey(person, 3);
    expect(streamWindowOwned(key, { ...person, role: 'observer' })).toBe(false);
    expect(streamWindowOwned(key, { ...person, unitId: 'u-fin' })).toBe(false);
    expect(streamWindowOwned(key, { ...person, displayName: 'Andere' })).toBe(false);
  });

  it('nothing loaded yet, or another id, is never owned', () => {
    expect(streamWindowOwned(null, person)).toBe(false);
    expect(streamWindowOwned(streamWindowKey({ ...person, id: 'u-058' }, 3), person)).toBe(false);
  });
});

/**
 * Review finding 4: at the level where the page wires the ownership in — `shownStream` is what the tab renders
 * (`streamWindow`, `curve`), `heldStreamBase` is the start the stream effect hands to `advanceStream`. The web package
 * has no DOM test environment (see admin/Page.test.tsx), so the effect's own call is replayed here with a stub `listEvents`.
 */
describe('a role change under the same id reads the stream window afresh (takt-057, review finding 4)', () => {
  const event = (seq: number) => ({ seq, type: 'question.captured' }) as unknown as ReadEvent;
  const held = {
    key: streamWindowKey(person, 7),
    cursor: 40,
    window: [event(39), event(40)] as readonly ReadEvent[],
    curve: [1, 2, 3] as readonly number[],
  };

  it('the same person sees the held window and the next read starts at its cursor', async () => {
    expect(shownStream(held, { ...person })).toEqual({ window: held.window, curve: held.curve });
    const listEvents = vi.fn(async () => ({ items: [], lastSeq: 40 }));
    await advanceStream({ listEvents } as unknown as Pick<HvApi, 'listEvents'>, heldStreamBase(held, { ...person }));
    expect(listEvents).toHaveBeenCalledTimes(1);
    expect(listEvents).toHaveBeenCalledWith(40, expect.any(Number));
  });

  it('the same id with another role is shown nothing held, and listEvents reads from the beginning', async () => {
    const other: Actor = { ...person, role: 'observer' };
    const shown = shownStream(held, other);
    expect(shown.window).toEqual([]);
    expect(shown.curve).toEqual([]);
    expect(heldStreamBase(held, other)).toBeNull();
    const listEvents = vi.fn(async () => ({ items: [], lastSeq: 40 }));
    await advanceStream({ listEvents } as unknown as Pick<HvApi, 'listEvents'>, heldStreamBase(held, other));
    // The fresh read: first the head (`listEvents(0, 1)`), never the held cursor.
    expect(listEvents.mock.calls[0]).toEqual([0, 1]);
    expect(listEvents.mock.calls.some((call) => (call as unknown[])[0] === 40)).toBe(false);
  });
});
