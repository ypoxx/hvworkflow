import { describe, expect, it } from 'vitest';
import type { RoleAssigned, RoleRevoked, SpeakerRegistered } from '@hv/domain';
import { translate } from '../../i18n';
import { eventSubject, eventSummary, type SummaryContext } from './eventSummary';

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
  translate('de', key, params);

const speakerEvent: SpeakerRegistered = {
  seq: 1,
  id: 'event-1',
  type: 'SpeakerRegistered',
  at: '2027-04-20T10:00:00.000Z',
  actor: { id: 'moderation-1', role: 'moderation' },
  subjectId: 'speaker-1',
  payload: { number: 7, round: 2, position: 1, pii: { keyId: 'hv-2027', displayName: 'Private Name' } },
};

function context(speakerNames: ReadonlyMap<string, string>): SummaryContext {
  return {
    unitNames: new Map(),
    agendaNumbers: new Map(),
    questionNumbers: new Map(),
    speakerNames,
  };
}

describe('history speaker summary', () => {
  it('uses only the permission scoped speaker projection for a new PII event', () => {
    const hidden = context(new Map([['speaker-1', 'Redner 7']]));
    const revealed = context(new Map([['speaker-1', 'Visible Name']]));

    expect(eventSummary(t, speakerEvent, hidden)).toContain('Redner 7');
    expect(eventSummary(t, speakerEvent, hidden)).not.toContain('Private Name');
    expect(eventSubject(speakerEvent, hidden)).toBe('Redner 7');
    expect(eventSummary(t, speakerEvent, revealed)).toContain('Visible Name');
    expect(eventSummary(t, speakerEvent, revealed)).not.toContain('Private Name');
  });

  it('does not expose a historical payload name when speaker lookup is unavailable', () => {
    const historical: SpeakerRegistered = {
      ...speakerEvent,
      payload: { number: 7, round: 2, position: 1, displayName: 'Historical Name' },
    };

    const summary = eventSummary(t, historical, context(new Map()));
    expect(summary).toContain('Runde 2');
    expect(summary).not.toContain('Historical Name');
    expect(summary).not.toContain('undefined');
  });

  it('summarises assignment facts by role without exposing their subject', () => {
    const assigned: RoleAssigned = {
      ...speakerEvent,
      type: 'RoleAssigned',
      subjectId: 'assignment-1',
      payload: { assignmentId: 'assignment-1', subjectId: 'private-subject', role: 'approver' },
    };
    const revoked: RoleRevoked = {
      ...assigned,
      type: 'RoleRevoked',
      payload: { assignmentId: 'assignment-1', subjectId: 'private-subject', role: 'approver' },
    };
    const empty = context(new Map());

    expect(eventSummary(t, assigned, empty)).toBe('Freigabe');
    expect(eventSummary(t, revoked, empty)).toBe('Freigabe');
  });
});
