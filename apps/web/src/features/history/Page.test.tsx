/**
 * takt-057, Ziel 3 (T-G1-I-09): the held window of the Ereignisstrom belongs to one person in the structural sense
 * (`actorKey`, every field of the `Actor`), not only to one id. A role change under the same id reads it afresh.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '@hv/domain';

// The page module wires the real adapter on import; the key helpers under test need none of it.
vi.mock('../../api', () => ({ api: {} }));

const { streamWindowKey, streamWindowOwned } = await import('./Page');

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
