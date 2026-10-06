/**
 * Scheibe 041, Test 2: the state of a role assignment is display only (the service checks expiry and revocation
 * itself), with `now` passed in; the sort follows the subject id, then the order of the roles in the rights table;
 * the filter "only active"; the input sent to `assignRole` is exactly the contract fields that are set.
 */
import { describe, expect, it } from 'vitest';
import type { Actor, Role, RoleAssignment } from '@hv/domain';
import { ROLE_PERMISSIONS } from '@hv/domain';
import { roleCards } from '../../api/roleCards';
import {
  EMPTY_ASSIGN_FORM,
  assignInput,
  assignmentState,
  expiresInvalid,
  sortAssignments,
  submitRevoke,
  visibleAssignments,
} from './assignments';

const NOW = new Date('2026-10-05T12:00:00.000Z');
const BY: Actor = { id: 'u-admin', role: Object.keys(ROLE_PERMISSIONS)[0] as Role, displayName: 'Verwaltung' };
const ROLE_ORDER = roleCards().map((card) => card.role);
const [FIRST, SECOND, THIRD] = ROLE_ORDER as [Role, Role, Role];

function assignment(id: string, subjectId: string, role: Role, extra: Partial<RoleAssignment> = {}): RoleAssignment {
  return { id, meetingId: 'm-1', subjectId, role, assignedAt: '2026-10-01T08:00:00.000Z', assignedBy: BY, ...extra };
}

describe('assignmentState', () => {
  it('without expiresAt and not revoked → active', () => {
    expect(assignmentState(assignment('a', 's', FIRST), NOW)).toBe('active');
  });

  it('expiry in the future → active; exactly now → expired; in the past → expired', () => {
    expect(assignmentState(assignment('a', 's', FIRST, { expiresAt: '2026-10-05T12:00:01.000Z' }), NOW)).toBe('active');
    expect(assignmentState(assignment('a', 's', FIRST, { expiresAt: NOW.toISOString() }), NOW)).toBe('expired');
    expect(assignmentState(assignment('a', 's', FIRST, { expiresAt: '2026-10-04T12:00:00.000Z' }), NOW)).toBe('expired');
  });

  it('revoked before expired before active', () => {
    const both = assignment('a', 's', FIRST, { expiresAt: '2026-10-04T12:00:00.000Z', revokedAt: '2026-10-03T12:00:00.000Z' });
    expect(assignmentState(both, NOW)).toBe('revoked');
    expect(assignmentState(assignment('a', 's', FIRST, { revokedAt: '2026-10-03T12:00:00.000Z' }), NOW)).toBe('revoked');
  });

  it('reads now only from its argument', () => {
    const later = assignment('a', 's', FIRST, { expiresAt: '2030-01-01T00:00:00.000Z' });
    expect(assignmentState(later, new Date('2031-01-01T00:00:00.000Z'))).toBe('expired');
    expect(assignmentState(later, new Date('2029-01-01T00:00:00.000Z'))).toBe('active');
  });
});

describe('sortAssignments and visibleAssignments', () => {
  const list = Object.freeze([
    assignment('1', 'zeta', FIRST),
    assignment('2', 'alpha', THIRD),
    assignment('3', 'alpha', FIRST),
    assignment('4', 'beta', SECOND, { revokedAt: '2026-10-02T08:00:00.000Z' }),
    assignment('5', 'alpha', SECOND, { expiresAt: '2026-10-04T08:00:00.000Z' }),
  ]);

  it('by subject id, then by the order of the roles in the rights table; the input stays', () => {
    expect(sortAssignments(list, ROLE_ORDER).map((a) => a.id)).toEqual(['3', '5', '2', '4', '1']);
    expect(list.map((a) => a.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('only active by default; with the switch every assignment', () => {
    expect(visibleAssignments(list, ROLE_ORDER, NOW, false).map((a) => a.id)).toEqual(['3', '2', '1']);
    expect(visibleAssignments(list, ROLE_ORDER, NOW, true).map((a) => a.id)).toEqual(['3', '5', '2', '4', '1']);
  });
});

describe('assignInput (Test 7c: exactly the contract fields that are set)', () => {
  it('without subject or role nothing is sent', () => {
    expect(assignInput(EMPTY_ASSIGN_FORM)).toBeUndefined();
    expect(assignInput({ ...EMPTY_ASSIGN_FORM, subjectId: 'kennung-1' })).toBeUndefined();
    expect(assignInput({ ...EMPTY_ASSIGN_FORM, role: FIRST })).toBeUndefined();
    expect(assignInput({ ...EMPTY_ASSIGN_FORM, subjectId: '   ', role: FIRST })).toBeUndefined();
  });

  it('subject and role only → exactly { subjectId, role }', () => {
    const input = assignInput({ ...EMPTY_ASSIGN_FORM, subjectId: ' kennung-1 ', role: FIRST });
    expect(input).toEqual({ subjectId: 'kennung-1', role: FIRST });
    expect(Object.keys(input!).sort()).toEqual(['role', 'subjectId']);
  });

  it('with unit and expiry → exactly four keys, the expiry read as Europe/Berlin', () => {
    const input = assignInput({ subjectId: 'kennung-1', role: SECOND, unitId: 'unit-fin', expires: '2026-12-01T18:00' });
    expect(input).toEqual({ subjectId: 'kennung-1', role: SECOND, unitId: 'unit-fin', expiresAt: '2026-12-01T17:00:00.000Z' });
    expect(Object.keys(input!).sort()).toEqual(['expiresAt', 'role', 'subjectId', 'unitId']);
  });

  it('a local time that does not exist blocks sending and marks the field', () => {
    const form = { subjectId: 'kennung-1', role: SECOND, unitId: '', expires: '2027-03-28T02:30' };
    expect(expiresInvalid(form)).toBe(true);
    expect(assignInput(form)).toBeUndefined();
    expect(expiresInvalid({ ...form, expires: '' })).toBe(false);
  });
});

describe('submitRevoke (Test 7f)', () => {
  function fake() {
    const calls: unknown[][] = [];
    return {
      calls,
      api: { revokeRole: (...args: unknown[]) => { calls.push(args); return Promise.resolve(); } },
    };
  }

  it('with a reason: revokeRole(id, reason), trimmed', async () => {
    const { api, calls } = fake();
    await submitRevoke(api, 'ra-1', '  Wechsel der Zuständigkeit ');
    expect(calls).toEqual([['ra-1', 'Wechsel der Zuständigkeit']]);
  });

  it('without a reason: revokeRole(id), no second argument at all', async () => {
    const { api, calls } = fake();
    await submitRevoke(api, 'ra-1', '   ');
    expect(calls).toEqual([['ra-1']]);
    expect(calls[0]).toHaveLength(1);
  });
});
