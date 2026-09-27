import { describe, expect, it } from 'vitest';
import { createInProcessApi, type HvApi } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import type { Actor, Permission } from '../types.js';
import type { NewEvent } from '../events.js';
import { can } from '../api.js';
import { verifyEventChain } from '../envelope.js';

const at = '2027-04-20T10:00:00.000Z';
const admin: Actor = { id: 'demo-admin', role: 'admin' };

function fixture() {
  const store = createInMemoryEventStore();
  store.append([
    { id: 'meeting', type: 'MeetingCreated', at, actor: admin, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [{ id: 'unit-a', name: 'Fachbereich A' }, { id: 'unit-b', name: 'Fachbereich B' }] } },
    { id: 'start', type: 'MeetingStarted', at, actor: admin, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} },
  ] as NewEvent[]);
  let current: Actor = { id: 'demo-mod', role: 'moderation' };
  let currentTime = '2027-04-20T10:05:00.000Z';
  const api = createInProcessApi({ store, actor: () => current, meetingId: 'hv-2027',
    clock: () => new Date(currentTime), idGenerator: (() => { let n = 0; return () => `new-${++n}`; })() });
  return { store, api, actor: (actor: Actor) => { current = actor; }, time: (value: string) => { currentTime = value; } };
}

type RoleOps = HvApi & {
  assignRole(input: { subjectId: string; role: Actor['role']; unitId?: string; expiresAt?: string }): Promise<{ id: string; subjectId: string; role: Actor['role'] }>;
  revokeRole(id: string, reason?: string): Promise<{ id: string; revokedAt?: string }>;
  listRoleAssignments(filter?: { subjectId?: string; role?: Actor['role'] }): Promise<Array<{ id: string; subjectId: string; role: Actor['role']; revokedAt?: string }>>;
};

describe('Scheibe 026: Personentabelle und Rollenereignisse', () => {
  it('keeps clear speaker names in marked PII and reveals them only through the new right', async () => {
    const { store, api, actor } = fixture();
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson', organisation: 'Testverein' });
    const event = store.all().find((candidate) => candidate.type === 'SpeakerRegistered');
    expect(event?.personId).toBeTruthy();
    expect(event?.payload).not.toHaveProperty('displayName');
    expect(event?.payload).not.toHaveProperty('organisation');
    expect(event?.payload).toMatchObject({ pii: { keyId: 'hv-2027', displayName: 'Synthetische Testperson', organisation: 'Testverein' } });
    expect(speaker.displayName).toBe('Synthetische Testperson');

    actor({ id: 'demo-capture', role: 'capture' });
    expect((await api.getSpeaker(speaker.id)).displayName).toBe('Redner 1');
    actor({ id: 'demo-mod', role: 'moderation' });
    expect((await api.getSpeaker(speaker.id)).displayName).toBe('Synthetische Testperson');
  });

  it('does not copy the clear name into a question visible without reveal', async () => {
    const { api, actor } = fixture();
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson' });
    actor({ id: 'demo-capture', role: 'capture' });
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Eine Frage.' });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Wie?' }]);
    expect(question?.speakerDisplayName).toBe('Redner 1');
    actor({ id: 'demo-mod', role: 'moderation' });
    expect((await api.getQuestion(question!.id)).speakerDisplayName).toBe('Synthetische Testperson');
  });

  it('grants the two new rights only to their named bundles', () => {
    const reveal = new Set(['coordination', 'moderation', 'legal', 'approver', 'podium']);
    for (const role of ['moderation', 'capture', 'coordination', 'expert', 'legal', 'approver', 'podium', 'admin', 'observer'] as const) {
      expect(can({ id: role, role }, 'question.identity.reveal' as Permission).allow, role).toBe(reveal.has(role));
      expect(can({ id: role, role }, 'admin.roles.manage' as Permission).allow, role).toBe(role === 'admin');
    }
  });

  it('appends role grants and revocations, denying an expert assignment without unitId', async () => {
    const { store, api, actor } = fixture();
    actor(admin);
    const roles = api as RoleOps;
    const assigned = await roles.assignRole({ subjectId: 'expert-subject', role: 'expert' });
    expect(assigned).toMatchObject({ subjectId: 'expert-subject', role: 'expert' });
    expect((await roles.listRoleAssignments({ subjectId: 'expert-subject' })).map((item) => item.id)).toEqual([assigned.id]);
    expect(store.all().at(-1)).toMatchObject({ type: 'RoleAssigned', subjectId: assigned.id, meetingId: 'hv-2027' });
    actor({ id: 'expert-subject', role: 'expert' });
    await expect(api.listQuestions()).rejects.toMatchObject({ status: 403 });
    actor(admin);
    const revoked = await roles.revokeRole(assigned.id, 'Testentzug');
    expect(revoked.revokedAt).toBeTruthy();
    expect(store.all().at(-1)).toMatchObject({ type: 'RoleRevoked', subjectId: assigned.id, meetingId: 'hv-2027' });
    await expect(roles.revokeRole(assigned.id)).rejects.toMatchObject({ status: 409 });
  });

  it('bounds an assigned expert to their unit and expiry', async () => {
    const { api, actor } = fixture();
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson' });
    actor({ id: 'demo-capture', role: 'capture' });
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Frage an Fachbereich B.' });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Wie?' }]);
    actor({ id: 'demo-coordination', role: 'coordination' });
    await api.classifyQuestion(question!.id, { track: 'expert_track' });
    await api.assignQuestion(question!.id, 'unit-a');
    actor(admin);
    await api.assignRole({ subjectId: 'expert-a', role: 'expert', unitId: 'unit-a' });
    await api.assignRole({ subjectId: 'expert-b', role: 'expert', unitId: 'unit-b' });
    actor({ id: 'expert-a', role: 'expert' });
    expect((await api.listQuestions()).total).toBe(1);
    expect((await api.listQuestions({ status: ['assigned'] })).total).toBe(1);
    await expect(api.listQuestions({ unitId: 'unit-missing' })).rejects.toMatchObject({ status: 404 });
    actor({ id: 'expert-b', role: 'expert' });
    expect((await api.listQuestions()).total).toBe(0);
    expect((await api.listQuestions({ status: ['assigned'] })).total).toBe(0);
    await expect(api.getQuestion(question!.id)).rejects.toMatchObject({ status: 404 });
    actor(admin);
    const grant = await api.assignRole({ subjectId: 'expert-c', role: 'expert', unitId: 'unit-a', expiresAt: '2027-04-20T10:06:00.000Z' });
    actor({ id: 'expert-c', role: 'expert' });
    expect((await api.listQuestions()).total).toBe(1);
    actor(admin);
    await api.revokeRole(grant.id);
    actor({ id: 'expert-c', role: 'expert' });
    await expect(api.listQuestions()).rejects.toMatchObject({ status: 403 });
  });

  it('masks marked PII and personId in the standard event read path', async () => {
    const { api, actor, store } = fixture();
    await api.registerSpeaker({ displayName: 'Synthetische Testperson' });
    actor(admin);
    const result = await api.listEvents();
    const speakerEvent = result.items.find((item) => item.type === 'SpeakerRegistered');
    expect(speakerEvent).toBeTruthy();
    expect(JSON.stringify(speakerEvent)).not.toContain('Synthetische Testperson');
    expect(speakerEvent).not.toHaveProperty('personId');
    expect(speakerEvent).not.toHaveProperty('hash');
    expect(speakerEvent).not.toHaveProperty('prevHash');
    expect(speakerEvent).toHaveProperty('sourceHash', store.all().at(-1)?.hash);
    expect(() => verifyEventChain(store.all())).not.toThrow();
  });

  it('hides clear actor names from historical answer projections and event history', async () => {
    const { api, actor, store } = fixture();
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson' });
    actor({ id: 'demo-capture', role: 'capture' });
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Frage.' });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Wie?' }]);
    store.append([{ id: 'old-answer', type: 'AnswerDrafted', at, actor: { id: 'old-expert', role: 'expert' },
      subjectId: question!.id, meetingId: 'hv-2027', payload: { answer: { version: 1, text: 'Antwort.',
        createdAt: at, createdBy: { id: 'old-expert', role: 'expert', displayName: 'Historischer Klarname', personId: 'person-old' } } } }] as NewEvent[]);
    const read = await api.getQuestion(question!.id);
    expect(JSON.stringify(read)).not.toContain('Historischer Klarname');
    expect(JSON.stringify(read)).not.toContain('person-old');
    expect(JSON.stringify(await api.getQuestionHistory(question!.id))).not.toContain('Historischer Klarname');
  });

  it('rejects an unknown or another meeting’s personId on a role grant', async () => {
    const { api, actor } = fixture();
    actor(admin);
    await expect(api.assignRole({ subjectId: 'expert-a', role: 'expert', personId: 'person-from-2026' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('expires assigned roles at their instant and when the meeting closes', async () => {
    const { api, actor, time, store } = fixture();
    actor(admin);
    await api.assignRole({ subjectId: 'short-lived', role: 'moderation', expiresAt: '2027-04-20T12:10:00+02:00' });
    actor({ id: 'short-lived', role: 'moderation' });
    expect(await api.listSpeakers()).toEqual([]);
    time('2027-04-20T10:11:00.000Z');
    await expect(api.listSpeakers()).rejects.toMatchObject({ status: 403 });
    actor(admin);
    await api.assignRole({ subjectId: 'meeting-bound', role: 'moderation' });
    store.append([{ id: 'close', type: 'MeetingClosed', at: '2027-04-20T10:11:00.000Z', actor: admin,
      subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} }] as NewEvent[]);
    actor({ id: 'meeting-bound', role: 'moderation' });
    await expect(api.listSpeakers()).rejects.toMatchObject({ status: 403 });
  });
});
