import { describe, expect, it } from 'vitest';
import { expectValid, openapiDoc, operations } from '../contractSchema.ts';

describe('takt-019: additive meeting lifecycle contract', () => {
  const schemas = openapiDoc.components.schemas;

  it('declares the new patch without changing the operation surface', () => {
    expect(openapiDoc.info.version).toBe('0.3.3');
    expect(Object.keys(operations)).toHaveLength(66);
    expect(schemas.MeetingStatus.enum).toEqual(['preparation', 'running', 'closed']);
    expect(schemas.MeetingStatus.description).toMatch(/MeetingCreated[\s\S]*MeetingStarted[\s\S]*MeetingClosed/);
    expect(schemas.MeetingStatus.description).toMatch(/DebateClosed[\s\S]*does not close/i);
  });

  for (const type of ['MeetingStarted', 'MeetingClosed'] as const) {
    it(`types ${type} as a meeting fact with subjectId and an empty payload`, () => {
      expect(schemas.Event.properties.type.enum).toContain(type);
      const event = {
        seq: 1,
        id: `e-${type}`,
        type,
        at: '2026-09-27T09:00:00Z',
        actor: { id: 'moderation-1', role: 'moderation' },
        subjectId: 'hv-2027',
        payload: {},
      };
      expectValid('listEvents', 200, { items: [event], lastSeq: 1 });
      expect(() => expectValid('listEvents', 200, { items: [{ ...event, subjectId: undefined }], lastSeq: 1 })).toThrow();
      expect(() => expectValid('listEvents', 200, { items: [{ ...event, payload: { secret: 'not allowed' } }], lastSeq: 1 })).toThrow();
    });
  }
});
