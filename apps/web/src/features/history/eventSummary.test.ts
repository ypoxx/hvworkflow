import { describe, expect, it } from 'vitest';
import type { AnswerDrafted, QuestionApproved, QuestionForwarded, RoleAssigned, RoleRevoked, SpeakerRegistered } from '@hv/domain';
import { eventLabel, eventTypeLabel, translate } from '../../i18n';
import { eventSubject, eventSummary, refusalVersionsOf, type SummaryContext } from './eventSummary';

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
    refusalVersions: new Set(),
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

describe('Scheibe 028: neutrale technische Historie', () => {
  it('names a durable no-op receipt without exposing its key or command scope', () => {
    expect(eventTypeLabel(t, 'IdempotencyRecorded')).toBe('Schreibvorgang bestätigt');
    const receipt = {
      ...speakerEvent,
      type: 'IdempotencyRecorded' as const,
      subjectId: 'speaker-1',
      idempotencyKey: 'private-client-key',
      commandOperation: 'updateSpeaker',
      commandResource: 'speaker-1',
      payload: {},
    };
    expect(eventSummary(t, receipt, context(new Map()))).toBe('');
  });
});

/**
 * Scheibe 045, Test 8: a refusal in the history. The proposal names its kind and the ground's title from
 * the snapshot in the event (the catalogue as it was at the proposal, never the current one); the
 * approval is called "Verweigerung freigegeben" only when the proposal of the same question and version
 * is among the loaded events; the justification appears in no summary.
 */
describe('Scheibe 045: Verweigerung in der Historie (Test 8)', () => {
  const JUSTIFICATION_MARKER = 'interne begruendung fuenfundvierzig';
  const at = '2027-04-20T10:00:00.000Z';
  const by = { id: 'u-legal-1', role: 'legal' as const };
  const legalRef = { source: 'AktG' as const, citation: 'Zitat', docVersion: '1', docHash: null, verified: false as const };
  const withGround: AnswerDrafted = {
    seq: 5, id: 'event-refusal', type: 'AnswerDrafted', at, actor: by, subjectId: 'q-1',
    payload: {
      answer: {
        version: 2, text: 'Wortlaut.', createdAt: at, createdBy: by, answerKind: 'refusal_with_ground',
        refusalGroundId: 'g1', refusalGroundHash: 'h-now', refusalGround: { title: 'Titel zum Zeitpunkt des Vorschlags', stageText: 'B.', legalRef },
      },
      pii: { keyId: 'hv-2027', refusalJustification: JUSTIFICATION_MARKER },
    },
  };
  const noClaim: AnswerDrafted = {
    ...withGround,
    id: 'event-noclaim',
    payload: { answer: { version: 3, text: 'Wortlaut.', createdAt: at, createdBy: by, answerKind: 'refusal_no_claim' }, pii: { keyId: 'hv-2027', refusalJustification: JUSTIFICATION_MARKER } },
  };
  const approved: QuestionApproved = {
    seq: 6, id: 'event-approved', type: 'QuestionApproved', at, actor: { id: 'u-appr-1', role: 'approver' }, subjectId: 'q-1',
    payload: { answerVersion: 2 },
  };
  const ctx = (refusalVersions: ReadonlySet<string>): SummaryContext => ({ ...context(new Map()), refusalVersions });

  it('AnswerDrafted refusal_with_ground: "Verweigerung vorgeschlagen" with the title from the snapshot', () => {
    expect(eventLabel(t, withGround, ctx(new Set()))).toBe('Verweigerung vorgeschlagen');
    const summary = eventSummary(t, withGround, ctx(new Set()));
    expect(summary).toBe('Version 2 · Verweigerung · Grund aus Katalog: Titel zum Zeitpunkt des Vorschlags');
  });

  it('refusal_no_claim without a ground', () => {
    expect(eventLabel(t, noClaim, ctx(new Set()))).toBe('Verweigerung vorgeschlagen');
    expect(eventSummary(t, noClaim, ctx(new Set()))).toBe('Version 3 · Verweigerung · kein Auskunftsanspruch');
  });

  it('an ordinary draft keeps its label', () => {
    const plain: AnswerDrafted = { ...withGround, payload: { answer: { version: 1, text: 'A.', createdAt: at, createdBy: by } } };
    expect(eventLabel(t, plain, ctx(new Set()))).toBe(eventTypeLabel(t, 'AnswerDrafted'));
  });

  it('QuestionApproved with a matching proposal → "Verweigerung freigegeben", without → ordinary label', () => {
    const refusals = refusalVersionsOf([withGround, approved]);
    expect(refusals).toEqual(new Set(['q-1:2']));
    expect(eventLabel(t, approved, ctx(refusals))).toBe('Verweigerung freigegeben');
    expect(eventLabel(t, approved, ctx(new Set()))).toBe('Freigegeben');
    expect(eventLabel(t, { ...approved, payload: { answerVersion: 1 } }, ctx(refusals))).toBe('Freigegeben');
    expect(eventSummary(t, approved, ctx(new Set()))).toBe('Version 2');
  });

  it('a justification in pii appears in no summary and no label', () => {
    for (const event of [withGround, noClaim]) {
      expect(eventSummary(t, event, ctx(new Set()))).not.toContain(JUSTIFICATION_MARKER);
      expect(eventLabel(t, event, ctx(new Set()))).not.toContain(JUSTIFICATION_MARKER);
    }
  });

  it('English labels', () => {
    const en = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('en', key, params);
    expect(eventLabel(en, withGround, ctx(new Set()))).toBe('Refusal proposed');
    expect(eventLabel(en, approved, ctx(new Set(['q-1:2'])))).toBe('Refusal approved');
  });
});

describe('Scheibe 048, W1: history row of a forward to another answering unit', () => {
  const forwarded: QuestionForwarded = {
    seq: 9, id: 'event-forwarded', type: 'QuestionForwarded', at: '2027-04-20T10:30:00.000Z',
    actor: { id: 'u-coord-1', role: 'coordination' }, subjectId: 'q-1',
    payload: { unitId: 'unit-hr', fromUnitId: 'unit-fin', reasonCode: 'expertise_elsewhere' },
  };
  const units: SummaryContext = {
    ...context(new Map()),
    unitNames: new Map([['unit-fin', 'Finanzen und Controlling'], ['unit-hr', 'Personal und Vergütung']]),
  };
  const en = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('en', key, params);

  it('with fromUnitId: both unit names and the label of the code (de and en)', () => {
    expect(eventLabel(t, forwarded, units)).toBe('An anderen Fachbereich weitergeleitet');
    expect(eventSummary(t, forwarded, units))
      .toBe('Fachbereich: Finanzen und Controlling → Personal und Vergütung · Grund: Fachwissen liegt in einem anderen Fachbereich');
    expect(eventLabel(en, forwarded, units)).toBe('Forwarded to another answering unit');
    expect(eventSummary(en, forwarded, units))
      .toBe('Answering unit: Finanzen und Controlling → Personal und Vergütung · Reason: Expertise lies with another answering unit');
  });

  it('without fromUnitId: only the target; every code has a label in both languages', () => {
    const noFrom: QuestionForwarded = { ...forwarded, payload: { unitId: 'unit-hr', reasonCode: 'wrong_unit' } };
    expect(eventSummary(t, noFrom, units)).toBe('Fachbereich: Personal und Vergütung · Grund: Falscher Fachbereich');
    expect(eventSummary(en, noFrom, units)).toBe('Answering unit: Personal und Vergütung · Reason: Wrong answering unit');
    const labels: [QuestionForwarded['payload']['reasonCode'], string, string][] = [
      ['wrong_unit', 'Falscher Fachbereich', 'Wrong answering unit'],
      ['expertise_elsewhere', 'Fachwissen liegt in einem anderen Fachbereich', 'Expertise lies with another answering unit'],
      ['capacity', 'Auslastung', 'Workload'],
      ['other', 'Sonstiges', 'Other'],
    ];
    for (const [reasonCode, de, english] of labels) {
      const event: QuestionForwarded = { ...forwarded, payload: { ...forwarded.payload, reasonCode } };
      expect(eventSummary(t, event, units)).toContain(`Grund: ${de}`);
      expect(eventSummary(en, event, units)).toContain(`Reason: ${english}`);
    }
  });

  it('an unknown code (a later contract stage) stays the code, never a crash; an unknown unit stays its id', () => {
    const future = { ...forwarded, payload: { unitId: 'unit-new', fromUnitId: 'unit-fin', reasonCode: 'reorganisation' } } as unknown as QuestionForwarded;
    expect(eventSummary(t, future, units)).toBe('Fachbereich: Finanzen und Controlling → unit-new · Grund: reorganisation');
    expect(eventSummary(en, future, units)).toBe('Answering unit: Finanzen und Controlling → unit-new · Reason: reorganisation');
  });
});
