/**
 * Scheibe 040a, review major 1: R-ADM-08 counts a managing assignment as backing only if the subject's
 * session would select it. The core's `sessionAssignmentFor` (packages/domain/src/api.ts) mirrors the
 * session rule of `sessionActorFromEvents` (apps/api/src/actor.ts); this test pins both against each
 * other over the scenarios that matter, so the two cannot drift apart unnoticed.
 */
import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, sessionAssignmentFor, type DomainEvent, type NewEvent, type Role } from '@hv/domain';
import { ROLE_PERMISSIONS } from '@hv/domain';
import { sessionActorFromEvents } from '../actor.ts';

const at = '2027-04-20T10:00:00.000Z';
const now = new Date('2027-04-20T12:00:00.000Z');
const system = { id: 'system-040a', role: Object.keys(ROLE_PERMISSIONS).find((role) => ROLE_PERMISSIONS[role as Role].includes('admin.roles.manage')) as Role };
const roles = Object.keys(ROLE_PERMISSIONS) as Role[];
const [first, second] = [roles[0]!, roles[1]!];

function meeting(id: string, date: string): NewEvent[] {
  return [
    { id: `create-${id}`, type: 'MeetingCreated', at, actor: system, subjectId: id, meetingId: id,
      payload: { title: id, date, agendaItems: [], units: [] } },
  ] as NewEvent[];
}
function lifecycle(type: 'MeetingStarted' | 'MeetingClosed', id: string): NewEvent {
  return { id: `${type}-${id}`, type, at, actor: system, subjectId: id, meetingId: id, payload: {} } as unknown as NewEvent;
}
function assigned(id: string, meetingId: string, subjectId: string, role: Role, expiresAt?: string): NewEvent {
  return { id, type: 'RoleAssigned', at, actor: system, subjectId: id, meetingId,
    payload: { assignmentId: id, subjectId, role, ...(expiresAt !== undefined ? { expiresAt } : {}) } } as NewEvent;
}
function revoked(id: string, meetingId: string, subjectId: string, role: Role): NewEvent {
  return { id: `revoke-${id}`, type: 'RoleRevoked', at, actor: system, subjectId: id, meetingId,
    payload: { assignmentId: id, subjectId, role } } as NewEvent;
}

const scenarios: [string, NewEvent[]][] = [
  ['two roles in one meeting', [...meeting('m1', '2027-04-20'), assigned('a1', 'm1', 'b', first), assigned('a2', 'm1', 'b', second)]],
  ['older one revoked', [...meeting('m1', '2027-04-20'), assigned('a1', 'm1', 'b', first), assigned('a2', 'm1', 'b', second), revoked('a1', 'm1', 'b', first)]],
  ['older one expired', [...meeting('m1', '2027-04-20'), assigned('a1', 'm1', 'b', first, '2027-04-20T11:00:00.000Z'), assigned('a2', 'm1', 'b', second)]],
  ['older one in another open meeting', [...meeting('m2', '2028-04-20'), assigned('a1', 'm2', 'b', first), ...meeting('m1', '2027-04-20'),
    lifecycle('MeetingStarted', 'm1'), assigned('a2', 'm1', 'b', second)]],
  ['older one in a closed meeting', [...meeting('m2', '2026-04-20'), assigned('a1', 'm2', 'b', first), lifecycle('MeetingStarted', 'm2'),
    lifecycle('MeetingClosed', 'm2'), ...meeting('m1', '2027-04-20'), assigned('a2', 'm1', 'b', second)]],
];

describe('Scheibe 040a: R-ADM-08 uses the session selection of actor.ts', () => {
  for (const [name, events] of scenarios) {
    it(`selects the same assignment as the session: ${name}`, () => {
      const store = createInMemoryEventStore();
      const log: readonly DomainEvent[] = store.append(events);
      const selected = sessionAssignmentFor(log, 'b', now);
      const session = sessionActorFromEvents(log, 'b', now);
      expect(selected?.role).toBe(session.actor.role);
    });
  }

  it('selects nothing where the session has no active assignment', () => {
    const store = createInMemoryEventStore();
    const log = store.append([...meeting('m1', '2027-04-20'), assigned('a1', 'm1', 'b', first), revoked('a1', 'm1', 'b', first)]);
    expect(sessionAssignmentFor(log, 'b', now)).toBeUndefined();
    expect(() => sessionActorFromEvents(log, 'b', now)).toThrow();
  });
});
