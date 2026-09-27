import { describe, expect, it } from 'vitest';
import { createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import type { Actor, Contribution, Meeting, WriteOptions } from '../types.js';

const at = '2027-04-20T10:00:00.000Z';
const admin: Actor = { id: 'admin', role: 'admin' };
const moderation: Actor = { id: 'moderator', role: 'moderation' };
const capture: Actor = { id: 'capture', role: 'capture' };

type VersionedApi = Omit<HvApi, 'getMeeting' | 'getContribution' | 'captureContribution'> & {
  getMeeting(): Promise<Meeting & { speakerListVersion: number }>;
  getContribution(id: string): Promise<Contribution & { version: number }>;
  captureContribution(input: { speakerId: string; text: string }, opts?: WriteOptions): Promise<Contribution & { version: number }>;
};

function fixture() {
  const store = createInMemoryEventStore();
  store.append([
    { id: 'meeting', type: 'MeetingCreated', at, actor: admin, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [{ id: 'unit-a', name: 'Unit A' }] } },
    { id: 'start', type: 'MeetingStarted', at, actor: admin, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} },
  ]);
  let current = moderation;
  let nextId = 0;
  const api = () => createInProcessApi({ store, meetingId: 'hv-2027', actor: () => current,
    clock: () => new Date(at), idGenerator: () => `generated-${++nextId}` }) as VersionedApi;
  return { store, api, as: (actor: Actor) => { current = actor; } };
}

async function register(api: VersionedApi, name = 'Testperson', opts?: WriteOptions) {
  const version = (await api.getMeeting()).speakerListVersion;
  return api.registerSpeaker({ displayName: name }, { ifMatch: etagOf(version), ...opts });
}

describe('Scheibe 028: durable idempotency and resource versions', () => {
  it('projects mandatory year ids on all newly persisted workflow resources', async () => {
    const f = fixture();
    const speaker = await register(f.api());
    f.as(capture);
    const contribution = await f.api().captureContribution({ speakerId: speaker.id, text: 'Question text' },
      { ifMatch: etagOf(speaker.version) });
    const [question] = await f.api().captureQuestions(contribution.id, [{ text: 'What?' }],
      { ifMatch: etagOf(contribution.version) });
    expect([speaker.meetingId, contribution.meetingId, question?.meetingId]).toEqual(['hv-2027', 'hv-2027', 'hv-2027']);
    expect(f.store.all().every((event) => event.schemaVersion === 2 && event.meetingId === 'hv-2027')).toBe(true);
  });
  it('reconstructs a register replay from the log after a new API instance, including the original version', async () => {
    const f = fixture();
    const first = await register(f.api(), 'Erste Person', { idempotencyKey: 'register-1' });
    await register(f.api(), 'Zweite Person');
    const before = f.store.lastSeq();
    const replay = await f.api().registerSpeaker({ displayName: 'Changed retry body' },
      { idempotencyKey: 'register-1', ifMatch: etagOf(1) });
    expect(replay).toMatchObject({ id: first.id, version: first.version, displayName: first.displayName });
    expect(f.store.lastSeq()).toBe(before);
    expect(f.store.all().filter((event) => event.type === 'SpeakerRegistered')).toHaveLength(2);
  });

  it('reconstructs all questions from one multi-event capture command after a new API instance', async () => {
    const f = fixture();
    const speaker = await register(f.api());
    f.as(capture);
    const contribution = await f.api().captureContribution({ speakerId: speaker.id, text: 'Two questions' },
      { ifMatch: etagOf(speaker.version) });
    const questions = [{ text: 'First?' }, { text: 'Second?' }];
    const first = await f.api().captureQuestions(contribution.id, questions,
      { ifMatch: etagOf(1), idempotencyKey: 'atomise-1' });
    expect(first).toHaveLength(2);
    const before = f.store.lastSeq();
    const replay = await f.api().captureQuestions(contribution.id, [{ text: 'Changed retry body' }],
      { ifMatch: etagOf(1), idempotencyKey: 'atomise-1' });
    expect(replay.map((q) => ({ id: q.id, text: q.text, version: q.version })))
      .toEqual(first.map((q) => ({ id: q.id, text: q.text, version: q.version })));
    expect(f.store.lastSeq()).toBe(before);
  });

  it('persists an accepted keyed no-op without changing resource or list versions', async () => {
    const f = fixture();
    const speaker = await register(f.api());
    const beforeList = (await f.api().getMeeting()).speakerListVersion;
    const before = f.store.lastSeq();
    const first = await f.api().updateSpeaker(speaker.id, {},
      { ifMatch: etagOf(speaker.version), idempotencyKey: 'empty-patch' });
    expect(f.store.lastSeq()).toBe(before + 1);
    expect((await f.api().getSpeaker(speaker.id)).version).toBe(speaker.version);
    expect((await f.api().getMeeting()).speakerListVersion).toBe(beforeList);
    const replay = await f.api().updateSpeaker(speaker.id, { status: 'speaking' },
      { ifMatch: etagOf(1), idempotencyKey: 'empty-patch' });
    expect(replay).toMatchObject({ id: first.id, status: first.status, version: first.version });
    expect(f.store.lastSeq()).toBe(before + 1);
  });

  it('checks current authorization before replaying an old key', async () => {
    const f = fixture();
    f.as(admin);
    const grant = await f.api().assignRole({ subjectId: moderation.id, role: 'moderation' });
    f.as(moderation);
    await register(f.api(), 'Granted person', { idempotencyKey: 'granted-register' });
    f.as(admin);
    await f.api().revokeRole(grant.id);
    const before = f.store.lastSeq();
    f.as(moderation);
    await expect(f.api().registerSpeaker({ displayName: 'Granted person' },
      { idempotencyKey: 'granted-register', ifMatch: etagOf(1) })).rejects.toMatchObject({ status: 403 });
    expect(f.store.lastSeq()).toBe(before);
  });

  it('replays historical question fields with actions from the current state', async () => {
    const f = fixture();
    const speaker = await register(f.api());
    f.as(capture);
    const contribution = await f.api().captureContribution({ speakerId: speaker.id, text: 'Question text' },
      { ifMatch: etagOf(speaker.version) });
    const [question] = await f.api().captureQuestions(contribution.id, [{ text: 'What?' }],
      { ifMatch: etagOf(contribution.version) });
    f.as({ id: 'coordinator', role: 'coordination' });
    const first = await f.api().classifyQuestion(question!.id, { track: 'expert_track' },
      { ifMatch: etagOf(question!.version), idempotencyKey: 'classify-once' });
    await f.api().assignQuestion(question!.id, 'unit-a', { ifMatch: etagOf(first.version) });
    const replay = await f.api().classifyQuestion(question!.id, { track: 'podium' },
      { ifMatch: etagOf(question!.version), idempotencyKey: 'classify-once' });
    expect(replay).toMatchObject({ id: first.id, status: first.status, track: first.track, version: first.version });
    expect(replay._actions).toEqual((await f.api().getQuestion(question!.id))._actions);
    expect(replay._actions).not.toEqual(first._actions);
  });

  it('requires the list version for registration and rejects a stale version without appending', async () => {
    const f = fixture();
    const api = f.api();
    const initial = (await api.getMeeting()).speakerListVersion;
    const before = f.store.lastSeq();
    await expect(api.registerSpeaker({ displayName: 'No precondition' })).rejects.toMatchObject({ status: 428 });
    expect(f.store.lastSeq()).toBe(before);
    const first = await api.registerSpeaker({ displayName: 'First' }, { ifMatch: etagOf(initial) });
    expect(first.version).toBe(1);
    const after = f.store.lastSeq();
    await expect(api.registerSpeaker({ displayName: 'Stale' }, { ifMatch: etagOf(initial) }))
      .rejects.toMatchObject({ status: 412 });
    expect(f.store.lastSeq()).toBe(after);
  });

  it('projects one year-wide list version and speaker/contribution versions from each relevant event', async () => {
    const f = fixture();
    const api = f.api();
    expect((await api.getMeeting()).speakerListVersion).toBe(1);
    const speaker = await register(api);
    expect((await api.getMeeting()).speakerListVersion).toBe(2);
    await api.updateSpeaker(speaker.id, { status: 'speaking' }, { ifMatch: etagOf(speaker.version) });
    expect((await api.getMeeting()).speakerListVersion).toBe(3);
    f.as(capture);
    const updated = await api.getSpeaker(speaker.id);
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'A question' },
      { ifMatch: etagOf(updated.version) });
    expect(contribution.version).toBe(1);
    expect((await api.getSpeaker(speaker.id)).version).toBe(updated.version + 1);
    expect((await api.getMeeting()).speakerListVersion).toBe(4);
    await api.captureQuestions(contribution.id, [{ text: 'What?' }], { ifMatch: etagOf(contribution.version) });
    expect((await api.getContribution(contribution.id)).version).toBe(2);
    expect((await api.getSpeaker(speaker.id)).version).toBe(updated.version + 2);
    expect((await api.getMeeting()).speakerListVersion).toBe(5);
    expect((await f.api().getMeeting()).speakerListVersion).toBe(5);
  });

  it('requires the referenced speaker and contribution versions for capture writes', async () => {
    const f = fixture();
    const speaker = await register(f.api());
    f.as(capture);
    const api = f.api();
    const before = f.store.lastSeq();
    await expect(api.captureContribution({ speakerId: speaker.id, text: 'Text' })).rejects.toMatchObject({ status: 428 });
    expect(f.store.lastSeq()).toBe(before);
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Text' },
      { ifMatch: etagOf(speaker.version) });
    const after = f.store.lastSeq();
    await expect(api.captureQuestions(contribution.id, [{ text: 'Question?' }])).rejects.toMatchObject({ status: 428 });
    await expect(api.captureQuestions(contribution.id, [{ text: 'Question?' }], { ifMatch: etagOf(99) }))
      .rejects.toMatchObject({ status: 412 });
    expect(f.store.lastSeq()).toBe(after);
  });

  it('checks speaker and question write versions before state guards, without reserving failed keys', async () => {
    const f = fixture();
    const api = f.api();
    const speaker = await register(api);
    const before = f.store.lastSeq();
    await expect(api.updateSpeaker(speaker.id, { status: 'speaking' })).rejects.toMatchObject({ status: 428 });
    await expect(api.updateSpeaker(speaker.id, { status: 'speaking' },
      { ifMatch: etagOf(99), idempotencyKey: 'speaker-retry' })).rejects.toMatchObject({ status: 412 });
    expect(f.store.lastSeq()).toBe(before);
    const updated = await api.updateSpeaker(speaker.id, { status: 'speaking' },
      { ifMatch: etagOf(speaker.version), idempotencyKey: 'speaker-retry' });
    expect(updated.version).toBe(speaker.version + 1);

    f.as(capture);
    const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Question text' },
      { ifMatch: etagOf(updated.version) });
    const [question] = await api.captureQuestions(contribution.id, [{ text: 'Question?' }],
      { ifMatch: etagOf(contribution.version) });
    f.as({ id: 'coordinator', role: 'coordination' });
    const after = f.store.lastSeq();
    await expect(api.classifyQuestion(question!.id, { track: 'podium' })).rejects.toMatchObject({ status: 428 });
    await expect(api.classifyQuestion(question!.id, { track: 'podium' }, { ifMatch: etagOf(99) }))
      .rejects.toMatchObject({ status: 412 });
    expect(f.store.lastSeq()).toBe(after);
    await expect(api.classifyQuestion('unknown-question', { track: 'podium' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('masks an unreadable question before revealing a missing or stale precondition', async () => {
    const f = fixture();
    const speaker = await register(f.api());
    f.as(capture);
    const contribution = await f.api().captureContribution({ speakerId: speaker.id, text: 'Question text' },
      { ifMatch: etagOf(speaker.version) });
    const [question] = await f.api().captureQuestions(contribution.id, [{ text: 'Question?' }],
      { ifMatch: etagOf(contribution.version) });
    const before = f.store.lastSeq();
    f.as({ id: 'observer', role: 'observer' });
    await expect(f.api().classifyQuestion(question!.id, { track: 'podium' }))
      .rejects.toMatchObject({ status: 404 });
    await expect(f.api().classifyQuestion(question!.id, { track: 'podium' }, { ifMatch: etagOf(99) }))
      .rejects.toMatchObject({ status: 404 });
    expect(f.store.lastSeq()).toBe(before);
  });
});
