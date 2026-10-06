/**
 * Scheibe 041, Test 4: the role cards are the rights table read as data. The expectations are computed from the same
 * data (`ROLE_PERMISSIONS`, `READ_PERMISSIONS`, `PERMISSIONS`); a role name appears only in the one sample at the end.
 */
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, READ_PERMISSIONS, ROLE_PERMISSIONS } from '@hv/domain';
import type { Permission, Role } from '@hv/domain';
import { roleCards } from './roleCards';

const READS = new Set<Permission>(Object.values(READ_PERMISSIONS).flat());
const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

describe('roleCards', () => {
  it('one card per key of ROLE_PERMISSIONS, in its order', () => {
    expect(roleCards().map((card) => card.role)).toEqual(roles);
  });

  it('reads ∪ acts is the bundle as a set; disjoint; reads ⊆ READ_PERMISSIONS', () => {
    for (const card of roleCards()) {
      const bundle = new Set<Permission>(ROLE_PERMISSIONS[card.role]);
      const union = new Set<Permission>([...card.reads, ...card.acts]);
      expect(union).toEqual(bundle);
      expect(card.reads.length + card.acts.length).toBe(bundle.size);
      for (const permission of card.reads) {
        expect(READS.has(permission)).toBe(true);
        expect(card.acts).not.toContain(permission);
      }
      for (const permission of card.acts) expect(READS.has(permission)).toBe(false);
    }
  });

  it('both sections follow the order of PERMISSIONS', () => {
    const rank = (permission: Permission): number => PERMISSIONS.indexOf(permission);
    for (const card of roleCards()) {
      expect([...card.reads].sort((a, b) => rank(a) - rank(b))).toEqual(card.reads);
      expect([...card.acts].sort((a, b) => rank(a) - rank(b))).toEqual(card.acts);
    }
  });

  it('unitBound exactly for the bundles with unitBoundRead', () => {
    for (const card of roleCards()) expect(card.unitBound).toBe(ROLE_PERMISSIONS[card.role].unitBoundRead === true);
  });

  it('sample: a unit-bound role carries unitBound, another does not', () => {
    const byRole = new Map(roleCards().map((card) => [card.role, card]));
    expect(byRole.get('expert')?.unitBound).toBe(true);
    expect(byRole.get('coordination')?.unitBound).toBe(false);
    expect(byRole.get('coordination')?.acts).toContain('question.forward');
  });

  it('is stable: the same cards on every call, frozen', () => {
    expect(roleCards()).toBe(roleCards());
    expect(Object.isFrozen(roleCards())).toBe(true);
  });
});
