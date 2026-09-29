import { describe, expect, it } from 'vitest';
import { createInProcessApi, etagOf, type HvApi } from '../api.js';
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
  it('requires a current grant for a session actor, while preserving the synthetic demo actor', async () => {
    const { api, actor } = fixture();
    actor({ id: 'unassigned', role: 'admin', assignmentScoped: true });
    await expect(api.listSpeakers()).rejects.toMatchObject({ status: 403, ruleId: 'R-PERM-01' });
    actor({ id: 'demo-mod', role: 'moderation' });
    expect(await api.listSpeakers()).toEqual([]);
  });

  it('uses the oldest active grant for the current meeting, not the session role', async () => {
    const { api, actor } = fixture();
    actor(admin);
    const oldest = await api.assignRole({ subjectId: 'session-subject', role: 'capture' });
    await api.assignRole({ subjectId: 'session-subject', role: 'admin' });
    actor({ id: 'session-subject', role: 'admin', assignmentScoped: true });
    await expect(api.assignRole({ subjectId: 'other', role: 'capture' })).rejects.toMatchObject({ status: 403 });
    actor(admin);
    await api.revokeRole(oldest.id);
    actor({ id: 'session-subject', role: 'observer', assignmentScoped: true });
    expect((await api.assignRole({ subjectId: 'other', role: 'capture' })).subjectId).toBe('other');
  });

  it('rejects a revoked, expired or closed grant for a session actor', async () => {
    const { api, actor, time, store } = fixture();
    actor(admin);
    const revoked = await api.assignRole({ subjectId: 'revoked-session', role: 'moderation' });
    const expired = await api.assignRole({ subjectId: 'expired-session', role: 'moderation', expiresAt: '2027-04-20T10:06:00.000Z' });
    await api.assignRole({ subjectId: 'closed-session', role: 'moderation' });
    await api.revokeRole(revoked.id);
    actor({ id: 'revoked-session', role: 'moderation', assignmentScoped: true });
    await expect(api.listSpeakers()).rejects.toMatchObject({ status: 403 });
    actor({ id: 'expired-session', role: 'moderation', assignmentScoped: true });
    expect(await api.listSpeakers()).toEqual([]);
    time(expired.expiresAt!);
    await expect(api.listSpeakers()).rejects.toMatchObject({ status: 403 });
    store.append([{ id: 'session-close', type: 'MeetingClosed', at: expired.expiresAt!, actor: admin,
      subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} }] as NewEvent[]);
    actor({ id: 'closed-session', role: 'moderation', assignmentScoped: true });
    await expect(api.listSpeakers()).rejects.toMatchObject({ status: 403 });
  });

  it('does not carry a session grant into another meeting', async () => {
    const { api, actor, store } = fixture();
    actor(admin);
    await api.assignRole({ subjectId: 'switching-subject', role: 'moderation' });
    store.append([
      { id: 'meeting-next', type: 'MeetingCreated', at, actor: admin, subjectId: 'hv-2028', meetingId: 'hv-2028',
        payload: { title: 'HV 2028', date: '2028-04-20', agendaItems: [], units: [] } },
      { id: 'start-next', type: 'MeetingStarted', at, actor: admin, subjectId: 'hv-2028', meetingId: 'hv-2028', payload: {} },
    ] as NewEvent[]);
    const next = createInProcessApi({ store, actor: () => ({ id: 'switching-subject', role: 'moderation', assignmentScoped: true }),
      meetingId: 'hv-2028', clock: () => new Date('2027-04-20T10:05:00.000Z') });
    await expect(next.listSpeakers()).rejects.toMatchObject({ status: 403 });
    actor({ id: 'switching-subject', role: 'moderation', assignmentScoped: true });
    expect(await api.listSpeakers()).toEqual([]);
  });

  it('denies an idempotent replay after revocation without appending an event', async () => {
    const { api, actor, store } = fixture();
    actor(admin);
    const grant = await api.assignRole({ subjectId: 'replay-session', role: 'moderation' });
    actor({ id: 'replay-session', role: 'moderation', assignmentScoped: true });
    const options = { ifMatch: etagOf((await api.getMeeting()).speakerListVersion), idempotencyKey: 'session-replay' };
    await api.registerSpeaker({ displayName: 'Synthetische Testperson' }, options);
    actor(admin);
    await api.revokeRole(grant.id);
    const before = store.lastSeq();
    actor({ id: 'replay-session', role: 'moderation', assignmentScoped: true });
    await expect(api.registerSpeaker({ displayName: 'Synthetische Testperson' }, options)).rejects.toMatchObject({ status: 403 });
    expect(store.lastSeq()).toBe(before);
  });

  it('keeps clear speaker names in marked PII and reveals them only through the new right', async () => {
    const { store, api, actor } = fixture();
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson', organisation: 'Testverein' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
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
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
    actor({ id: 'demo-capture', role: 'capture' });
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Eine Frage.' }, { ifMatch: etagOf(speaker.version) });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Wie?' }], { ifMatch: etagOf(contribution.version) });
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
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
    actor({ id: 'demo-capture', role: 'capture' });
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Frage an Fachbereich B.' }, { ifMatch: etagOf(speaker.version) });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Wie?' }], { ifMatch: etagOf(contribution.version) });
    actor({ id: 'demo-coordination', role: 'coordination' });
    await api.classifyQuestion(question!.id, { track: 'expert_track' }, { ifMatch: etagOf(question!.version) });
    await api.assignQuestion(question!.id, 'unit-a', { ifMatch: etagOf((await api.getQuestion(question!.id)).version) });
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
    await api.registerSpeaker({ displayName: 'Synthetische Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
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
    const speaker = await api.registerSpeaker({ displayName: 'Synthetische Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
    actor({ id: 'demo-capture', role: 'capture' });
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Frage.' }, { ifMatch: etagOf(speaker.version) });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Wie?' }], { ifMatch: etagOf(contribution.version) });
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

describe('takt-028: role fields without plaintext PII', () => {
  it('rejects deputyForSubjectId that looks like an e-mail, has whitespace or is too long', async () => {
    const { api, actor, store } = fixture();
    actor(admin);
    const before = store.lastSeq();
    for (const deputyForSubjectId of ['erika@example.test', 'two words', '', 'd'.repeat(129)]) {
      await expect((api as unknown as { assignRole(i: object): Promise<unknown> })
        .assignRole({ subjectId: 'deputy-s', role: 'capture', deputyForSubjectId })).rejects.toMatchObject({ status: 422 });
    }
    expect(store.lastSeq()).toBe(before);
    await expect((api as unknown as { assignRole(i: object): Promise<unknown> })
      .assignRole({ subjectId: 'deputy-s', role: 'capture', deputyForSubjectId: 'pseudo-1' })).resolves.toBeDefined();
  });

  it('rejects a revoke reason longer than 500 characters without an event', async () => {
    const { api, actor, store } = fixture();
    actor(admin);
    const granted = await (api as unknown as RoleOps).assignRole({ subjectId: 'r-subject', role: 'capture' });
    const before = store.lastSeq();
    await expect((api as unknown as RoleOps).revokeRole(granted.id, 'x'.repeat(501))).rejects.toMatchObject({ status: 422 });
    expect(store.lastSeq()).toBe(before);
    await expect((api as unknown as RoleOps).revokeRole(granted.id, 'x'.repeat(500))).resolves.toBeDefined();
  });
});
