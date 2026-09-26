import { describe, expect, it } from 'vitest';
import { openapiDoc, requestBodyValidator } from '../contractSchema.ts';

describe('takt-016: additive contract bridge for meeting capture', () => {
  const schemas = openapiDoc.components.schemas;

  it('declares the patch version and the three typed fields without changing the alias body', () => {
    expect(openapiDoc.info.version).toBe('0.3.2');
    expect(schemas.Meeting.properties.debateClosedAt).toMatchObject({ type: 'string', format: 'date-time' });
    expect(schemas.Contribution.properties.lateEntry).toMatchObject({ type: 'boolean' });
    expect(schemas.MeetingContributionCapture.properties.lateEntryReason).toMatchObject({ type: 'string', minLength: 1 });
    expect(schemas.ContributionCapture.properties).not.toHaveProperty('lateEntryReason');
    expect(schemas.Meeting.required).not.toContain('debateClosedAt');
    expect(schemas.Contribution.required).not.toContain('lateEntry');
    expect(schemas.MeetingContributionCapture.required).not.toContain('lateEntryReason');
  });

  it('rejects an empty reason at the canonical capture operation', () => {
    const validate = requestBodyValidator('captureMeetingContribution');
    expect(validate).toBeDefined();
    const ordinary = { speakerId: 's1', text: 'Text', source: 'paper', occurredAt: '2026-09-26T09:00:00Z', occurredAtSource: 'paper' };
    expect(validate!({ ...ordinary, lateEntryReason: 'Nacherfassung vom Papierbogen' })).toBe(true);
    expect(validate!({ ...ordinary, lateEntryReason: '' })).toBe(false);
  });

  it('recognizes DebateClosed as a typed event of the meeting', () => {
    expect(schemas.Event.properties.type.enum).toContain('DebateClosed');
  });
});
