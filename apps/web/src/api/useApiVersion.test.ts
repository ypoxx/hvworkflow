import { describe, expect, it } from 'vitest';
import type { Actor } from '@hv/domain';
import { actorChanged } from './useApiVersion';

const base: Actor = { id: 'a1', role: 'moderation', displayName: 'A', personId: 'p1', unitId: 'u1' };

describe('actorChanged', () => {
  it('(a) same object: no change', () => expect(actorChanged(base, base)).toBe(false));
  it('(b) new object with equal fields: no change', () => expect(actorChanged(base, { ...base })).toBe(false));
  it('(c) other id: change', () => expect(actorChanged(base, { ...base, id: 'a2' })).toBe(true));
  it('(d) same id, other role: change', () =>
    expect(actorChanged(base, { ...base, role: 'capture' })).toBe(true));
  it('(e) same id, other personId or unitId: change', () => {
    expect(actorChanged(base, { ...base, personId: 'p2' })).toBe(true);
    expect(actorChanged(base, { ...base, unitId: 'u2' })).toBe(true);
  });
  it('(f) optional field missing once and set once: change', () => {
    const { unitId: _unused, ...without } = base;
    expect(actorChanged(base, without)).toBe(true);
    expect(actorChanged(without, base)).toBe(true);
    expect(actorChanged(base, { ...base, assignmentScoped: true })).toBe(true);
  });
});
