import { describe, expect, it } from 'vitest';
import { createInProcessApi } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import type { NewEvent } from '../events.js';
import type { Actor } from '../types.js';

const admin: Actor = { id: 'test-admin', role: 'admin' };
const at = '2027-04-20T10:00:00.000Z';

function meetingEvent(id: string, date: string): NewEvent {
  return {
    id: `create-${id}`, type: 'MeetingCreated', at, actor: admin, subjectId: id, meetingId: id,
    payload: { title: `HV ${id}`, date, agendaItems: [{ id: `top-${id}`, number: 1, title: 'Aussprache' }], units: [] },
  };
}

function lifecycleEvent(type: 'MeetingStarted' | 'MeetingClosed' | 'DebateClosed', id: string, time: string): NewEvent {
  return {
    id: `${type}-${id}`, type, at: time, actor: admin, subjectId: id, meetingId: id, payload: {},
  } as unknown as NewEvent;
}

describe('Scheibe 025: Jahrgang und R-MTG', () => {
  it('does not write an unscoped event before a meeting exists', async () => {
    const store = createInMemoryEventStore();
    const api = createInProcessApi({ store, actor: () => admin });
    await expect(api.registerSpeaker({ displayName: 'Ohne Jahrgang' })).rejects.toMatchObject({ status: 404 });
    expect(store.lastSeq()).toBe(0);
  });
  it('projects lifecycle facts without confusing debate end with meeting closure', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2027', '2027-04-20')]);
    const api = createInProcessApi({ store, actor: () => admin });
    expect((await api.getMeeting()).status).toBe('preparation');

    store.append([lifecycleEvent('MeetingStarted', 'hv-2027', '2027-04-20T10:01:00.000Z')]);
    expect((await api.getMeeting()).status).toBe('running');
    store.append([lifecycleEvent('DebateClosed', 'hv-2027', '2027-04-20T11:00:00.000Z')]);
    expect((await api.getMeeting()).status).toBe('running');
    expect((await api.getMeeting()).debateClosedAt).toBe('2027-04-20T11:00:00.000Z');
    store.append([lifecycleEvent('MeetingClosed', 'hv-2027', '2027-04-20T12:00:00.000Z')]);
    expect((await api.getMeeting()).status).toBe('closed');
  });

  it('rejects duplicate creation and invalid lifecycle edges with their rule ids', async () => {
    const duplicate = createInMemoryEventStore();
    duplicate.append([meetingEvent('hv-2027', '2027-04-20')]);
    createInProcessApi({ store: duplicate, actor: () => admin });
    expect(() => duplicate.append([meetingEvent('hv-2027', '2027-04-20')])).toThrow(/R-MTG-01/);
    expect(duplicate.lastSeq()).toBe(1);

    const invalidClose = createInMemoryEventStore();
    invalidClose.append([meetingEvent('hv-2026', '2026-04-20')]);
    createInProcessApi({ store: invalidClose, actor: () => admin });
    expect(() => invalidClose.append([lifecycleEvent('MeetingClosed', 'hv-2026', at)])).toThrow(/R-MTG-02/);
    expect(invalidClose.lastSeq()).toBe(1);
  });

  it('lists two meetings from one global log and keeps their master data separate', async () => {
    const store = createInMemoryEventStore();
    store.append([
      meetingEvent('hv-2026', '2026-04-20'),
      meetingEvent('hv-2027', '2027-04-20'),
    ]);
    const api = createInProcessApi({ store, actor: () => admin });
    expect(store.all().map((e) => e.seq)).toEqual([1, 2]);
    expect((await api.listMeetings()).map((m) => m.id)).toEqual(['hv-2027', 'hv-2026']);
    expect((await api.getMeetingById('hv-2026')).status).toBe('preparation');
    expect((await api.listMeetingAgendaItems('hv-2026')).map((item) => item.id)).toEqual(['top-hv-2026']);
    await expect(api.getMeetingById('missing')).rejects.toMatchObject({ status: 404 });
  });

  it('isolates writes, F-n counters and the latest demo alias when meetings interleave', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2026', '2026-04-20'),
      lifecycleEvent('MeetingStarted', 'hv-2026', '2026-04-20T10:01:00.000Z'),
      meetingEvent('hv-2027', '2027-04-20'),
      lifecycleEvent('MeetingStarted', 'hv-2027', '2027-04-20T10:01:00.000Z')]);
    const old = createInProcessApi({ store, actor: () => admin, meetingId: 'hv-2026',
      clock: () => new Date('2027-04-20T10:30:00.000Z') });
    const current = createInProcessApi({ store, actor: () => admin, meetingId: 'hv-2027',
      clock: () => new Date('2027-04-20T10:30:00.000Z') });
    const alias = createInProcessApi({ store, actor: () => admin });
    const oldSpeaker = await old.registerSpeaker({ displayName: 'Alt' });
    const newSpeaker = await current.registerSpeaker({ displayName: 'Neu' });
    expect((await alias.getMeeting()).id).toBe('hv-2027');
    expect((await alias.listSpeakers()).map((s) => s.id)).toEqual([newSpeaker.id]);
    await expect(current.getSpeaker(oldSpeaker.id)).rejects.toMatchObject({ status: 404 });
    await expect(current.captureContribution({ speakerId: oldSpeaker.id, text: 'Fremd' }))
      .rejects.toMatchObject({ status: 404 });
    const oldContribution = await old.captureContribution({ speakerId: oldSpeaker.id, text: 'Alttext' });
    const newContribution = await current.captureContribution({ speakerId: newSpeaker.id, text: 'Neutext' });
    const oldQuestion = await old.captureQuestions(oldContribution.id, [{ text: 'Alte Frage' }]);
    const newQuestion = await current.captureQuestions(newContribution.id, [{ text: 'Neue Frage' }]);
    expect(oldQuestion[0]?.number).toBe('F-0001');
    expect(newQuestion[0]?.number).toBe('F-0001');
    expect((await old.listQuestions()).total).toBe(1);
    expect((await current.listQuestions()).total).toBe(1);
    expect((await alias.listQuestions()).items.map((q) => q.id)).toEqual([newQuestion[0]?.id]);
    expect(store.all().map((e) => e.seq)).toEqual(Array.from({ length: store.lastSeq() }, (_, i) => i + 1));
    expect(store.all().every((e) => e.meetingId === 'hv-2026' || e.meetingId === 'hv-2027')).toBe(true);
  });

  it('guards agenda progress with agenda.manage, meeting state and ETag', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2027', '2027-04-20')]);
    let current: Actor = admin;
    const api = createInProcessApi({ store, actor: () => current, meetingId: 'hv-2027',
      clock: () => new Date('2027-04-20T10:15:00.000Z') });
    await expect(api.openAgendaItem('top-hv-2027')).rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-04' });
    store.append([lifecycleEvent('MeetingStarted', 'hv-2027', '2027-04-20T10:01:00.000Z')]);
    current = { id: 'observer', role: 'observer' };
    await expect(api.openAgendaItem('top-hv-2027')).rejects.toMatchObject({ status: 403 });
    current = admin;
    await expect(api.openAgendaItem('top-hv-2027', { ifMatch: '"v0"' })).rejects.toMatchObject({ status: 412 });
    await expect(api.openVoting('top-hv-2027')).rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-05' });
    const opened = await api.openAgendaItem('top-hv-2027');
    expect(opened.openedAt).toBe('2027-04-20T10:15:00.000Z');
    await expect(api.openAgendaItem('top-hv-2027')).rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-04' });
    const voted = await api.openVoting('top-hv-2027');
    expect(voted.votingOpenedAt).toBe('2027-04-20T10:15:00.000Z');
    const closed = await api.closeVoting('top-hv-2027');
    expect(closed.votingClosedAt).toBe('2027-04-20T10:15:00.000Z');
    await expect(api.closeVoting('top-hv-2027')).rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-06' });
  });

  it('requires an earlier sender time and a reason for late paper after debate close', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2027', '2027-04-20'),
      lifecycleEvent('MeetingStarted', 'hv-2027', '2027-04-20T10:01:00.000Z'),
      { id: 'sp-1', type: 'SpeakerRegistered', at, actor: admin, subjectId: 'sp-1', meetingId: 'hv-2027',
        payload: { number: 1, displayName: 'Testperson', round: 1, position: 1 } },
      lifecycleEvent('DebateClosed', 'hv-2027', '2027-04-20T11:00:00.000Z'),
    ]);
    const api = createInProcessApi({ store, actor: () => ({ id: 'capture', role: 'capture' }), meetingId: 'hv-2027',
      clock: () => new Date('2027-04-20T11:05:00.000Z') });
    await expect(api.captureContribution({ speakerId: 'sp-1', text: 'Später Text' }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-03' });
    await expect(api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Papiertext', source: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'paper' }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-03' });
    await expect(api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Falsche Quelle', source: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'device', lateEntryReason: 'Papierbogen' }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-03' });
    await expect(api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Papiertext', source: 'paper',
      occurredAt: '2027-04-20T11:06:00.000Z', occurredAtSource: 'paper', lateEntryReason: 'Papierbogen' }))
      .rejects.toMatchObject({ status: 422 });
    const paper = await api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Papiertext', source: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'paper', lateEntryReason: 'Papierbogen' });
    expect(paper).toMatchObject({ meetingId: 'hv-2027', source: 'paper', lateEntry: true,
      occurredAt: '2027-04-20T10:30:00.000Z' });
    expect(store.all().at(-1)).toMatchObject({ type: 'ContributionCaptured', meetingId: 'hv-2027',
      payload: { lateEntry: true, lateEntryReason: 'Papierbogen' }, occurredAtSource: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', recordedAt: '2027-04-20T11:05:00.000Z' });
    const transcript = await api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Transkripttext', source: 'transcript',
      occurredAt: '2027-04-20T10:35:00.000Z', occurredAtSource: 'transcript', lateEntryReason: 'Transkript nachgetragen' });
    expect(transcript.lateEntry).toBe(true);
  });
});
