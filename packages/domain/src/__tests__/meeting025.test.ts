import { describe, expect, it } from 'vitest';
import { createInProcessApi, etagOf } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import type { NewEvent } from '../events.js';
import type { Actor } from '../types.js';
import { can } from '../api.js';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { stampEvent } from '../envelope.js';

const admin: Actor = { id: 'test-admin', role: 'admin' };
// Scheibe 040a: the administration writes no content; speaker requests and capture run with the
// roles that hold those rights.
const moderation: Actor = { id: 'test-mod', role: 'moderation' };
const capture: Actor = { id: 'test-cap', role: 'capture' };
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
    const api = createInProcessApi({ store, actor: () => moderation });
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

  it('keeps pre-lifecycle logs usable without changing their event or chain', async () => {
    const legacy = stampEvent(meetingEvent('hv-2026', '2026-04-20'), 1, '');
    const persisted = [legacy];
    const store = createInMemoryEventStore({ load: () => persisted, save: (events) => { persisted.splice(0, persisted.length, ...events); } });
    let who: Actor = moderation;
    const api = createInProcessApi({ store, actor: () => who });
    expect((await api.getMeeting()).status).toBe('running');
    const speaker = await api.registerSpeaker({ displayName: 'Bestandsdatum' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
    who = capture;
    await expect(api.captureContribution({ speakerId: speaker.id, text: 'Weiter nutzbar' }, { ifMatch: etagOf(speaker.version) })).resolves.toMatchObject({ text: 'Weiter nutzbar' });
    expect(store.all()[0]).toEqual(legacy);
    expect(store.all().some((event) => event.type === 'MeetingStarted')).toBe(false);
  });

  it('marks new meeting creations for the explicit lifecycle', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2027', '2027-04-20')]);
    expect(store.all()[0]).toMatchObject({ type: 'MeetingCreated', payload: { lifecycleVersion: 2 } });
    const api = createInProcessApi({ store, actor: () => admin });
    expect((await api.getMeeting()).status).toBe('preparation');
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

  it('uses the latest running date for the alias, regardless of creation order', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2027', '2027-04-20'), meetingEvent('hv-2026', '2026-04-20'),
      lifecycleEvent('MeetingStarted', 'hv-2026', at)]);
    const api = createInProcessApi({ store, actor: () => admin });
    expect((await api.getMeeting()).id).toBe('hv-2026');
    store.append([lifecycleEvent('MeetingStarted', 'hv-2027', at)]);
    expect((await api.getMeeting()).id).toBe('hv-2027');
  });

  it('does not persist an agenda transition for an unknown or foreign point', () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2026', '2026-04-20'), lifecycleEvent('MeetingStarted', 'hv-2026', at),
      meetingEvent('hv-2027', '2027-04-20'), lifecycleEvent('MeetingStarted', 'hv-2027', at)]);
    const before = store.lastSeq();
    expect(() => store.append([{ id: 'bad-agenda', type: 'AgendaItemOpened', at, actor: admin,
      subjectId: 'hv-2027', meetingId: 'hv-2027', payload: { agendaItemId: 'top-hv-2026', number: 1 } }]))
      .toThrow(/R-MTG-04/);
    expect(store.lastSeq()).toBe(before);
  });

  it('grants agenda.manage explicitly only to the designated role', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Actor['role'][]) {
      expect(can({ id: 'actor', role }, 'agenda.manage').allow, role).toBe(role === 'admin');
    }
  });

  it('keeps question history within the requested meeting when subject IDs collide', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2026', '2026-04-20'), lifecycleEvent('MeetingStarted', 'hv-2026', at),
      { id: 'old-question', type: 'QuestionCaptured', at, actor: admin, subjectId: 'same-question', meetingId: 'hv-2026',
        payload: { number: 'F-0001', contributionId: 'old-contribution', speakerId: 'old-speaker', text: 'Alt' } },
      meetingEvent('hv-2027', '2027-04-20'), lifecycleEvent('MeetingStarted', 'hv-2027', at),
      { id: 'new-question', type: 'QuestionCaptured', at, actor: admin, subjectId: 'same-question', meetingId: 'hv-2027',
        payload: { number: 'F-0001', contributionId: 'new-contribution', speakerId: 'new-speaker', text: 'Neu' } }]);
    const api = createInProcessApi({ store, actor: () => admin, meetingId: 'hv-2027' });
    expect((await api.getQuestionHistory('same-question')).map((event) => event.id)).toEqual(['new-question']);
  });

  it('isolates writes, F-n counters and the latest demo alias when meetings interleave', async () => {
    const store = createInMemoryEventStore();
    store.append([meetingEvent('hv-2026', '2026-04-20'),
      lifecycleEvent('MeetingStarted', 'hv-2026', '2026-04-20T10:01:00.000Z'),
      meetingEvent('hv-2027', '2027-04-20'),
      lifecycleEvent('MeetingStarted', 'hv-2027', '2027-04-20T10:01:00.000Z')]);
    let who: Actor = moderation;
    const old = createInProcessApi({ store, actor: () => who, meetingId: 'hv-2026',
      clock: () => new Date('2027-04-20T10:30:00.000Z') });
    const current = createInProcessApi({ store, actor: () => who, meetingId: 'hv-2027',
      clock: () => new Date('2027-04-20T10:30:00.000Z') });
    const alias = createInProcessApi({ store, actor: () => who });
    const oldSpeaker = await old.registerSpeaker({ displayName: 'Alt' }, { ifMatch: etagOf((await old.getMeeting()).speakerListVersion) });
    const newSpeaker = await current.registerSpeaker({ displayName: 'Neu' }, { ifMatch: etagOf((await current.getMeeting()).speakerListVersion) });
    expect((await alias.getMeeting()).id).toBe('hv-2027');
    expect((await alias.listSpeakers()).map((s) => s.id)).toEqual([newSpeaker.id]);
    await expect(current.getSpeaker(oldSpeaker.id)).rejects.toMatchObject({ status: 404 });
    who = capture;
    await expect(current.captureContribution({ speakerId: oldSpeaker.id, text: 'Fremd' }))
      .rejects.toMatchObject({ status: 404 });
    const oldContribution = await old.captureContribution({ speakerId: oldSpeaker.id, text: 'Alttext' }, { ifMatch: etagOf(oldSpeaker.version) });
    const newContribution = await current.captureContribution({ speakerId: newSpeaker.id, text: 'Neutext' }, { ifMatch: etagOf(newSpeaker.version) });
    const oldQuestion = await old.captureQuestions(oldContribution.id, [{ text: 'Alte Frage' }], { ifMatch: etagOf(oldContribution.version) });
    const newQuestion = await current.captureQuestions(newContribution.id, [{ text: 'Neue Frage' }], { ifMatch: etagOf(newContribution.version) });
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
    await expect(api.captureContribution({ speakerId: 'sp-1', text: 'Später Text' }, { ifMatch: etagOf((await api.getSpeaker('sp-1')).version) }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-03' });
    await expect(api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Papiertext', source: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'paper' }, { ifMatch: etagOf((await api.getSpeaker('sp-1')).version) }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-03' });
    await expect(api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Falsche Quelle', source: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'device', lateEntryReason: 'Papierbogen' }, { ifMatch: etagOf((await api.getSpeaker('sp-1')).version) }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-MTG-03' });
    await expect(api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Papiertext', source: 'paper',
      occurredAt: '2027-04-20T11:06:00.000Z', occurredAtSource: 'paper', lateEntryReason: 'Papierbogen' }, { ifMatch: etagOf((await api.getSpeaker('sp-1')).version) }))
      .rejects.toMatchObject({ status: 422 });
    const paper = await api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Papiertext', source: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'paper', lateEntryReason: 'Papierbogen' }, { ifMatch: etagOf((await api.getSpeaker('sp-1')).version) });
    expect(paper).toMatchObject({ meetingId: 'hv-2027', source: 'paper', lateEntry: true,
      occurredAt: '2027-04-20T10:30:00.000Z' });
    expect(store.all().at(-1)).toMatchObject({ type: 'ContributionCaptured', meetingId: 'hv-2027',
      payload: { lateEntry: true, lateEntryReason: 'Papierbogen' }, occurredAtSource: 'paper',
      occurredAt: '2027-04-20T10:30:00.000Z', recordedAt: '2027-04-20T11:05:00.000Z' });
    const transcript = await api.captureMeetingContribution({ speakerId: 'sp-1', text: 'Transkripttext', source: 'transcript',
      occurredAt: '2027-04-20T10:35:00.000Z', occurredAtSource: 'transcript', lateEntryReason: 'Transkript nachgetragen' }, { ifMatch: etagOf((await api.getSpeaker('sp-1')).version) });
    expect(transcript.lateEntry).toBe(true);
  });
});
