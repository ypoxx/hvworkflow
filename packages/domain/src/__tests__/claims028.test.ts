import { describe, expect, it } from 'vitest';
import { can, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import type { Actor, Contribution, Permission, Question, WriteOptions } from '../types.js';

const at = '2027-04-20T10:00:00.000Z';
const admin: Actor = { id: 'admin', role: 'admin' };
const moderation: Actor = { id: 'moderator', role: 'moderation' };
const capturerA: Actor = { id: 'capture-a', role: 'capture' };
const capturerB: Actor = { id: 'capture-b', role: 'capture' };

type Claim = { actorId: string; personId?: string; claimedAt: string; expiresAt: string };
type ClaimedContribution = Contribution & { version: number; claim?: Claim };
type ClaimedQuestion = Question & { claim?: Claim };
type ClaimApi = Omit<HvApi, 'getMeeting' | 'getContribution' | 'captureContribution' | 'getQuestion'> & {
  getMeeting(): Promise<Awaited<ReturnType<HvApi['getMeeting']>> & { speakerListVersion: number }>;
  getContribution(id: string): Promise<ClaimedContribution>;
  captureContribution(input: { speakerId: string; text: string }, opts?: WriteOptions): Promise<ClaimedContribution>;
  getQuestion(id: string): Promise<ClaimedQuestion>;
  claimContribution(id: string, opts?: WriteOptions): Promise<ClaimedContribution>;
  releaseContribution(id: string, opts?: WriteOptions): Promise<ClaimedContribution>;
  claimQuestion(id: string, opts?: WriteOptions): Promise<ClaimedQuestion>;
  releaseQuestion(id: string, opts?: WriteOptions): Promise<ClaimedQuestion>;
};

function fixture() {
  const store = createInMemoryEventStore();
  store.append([
    { id: 'meeting', type: 'MeetingCreated', at, actor: admin, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [{ id: 'unit-a', name: 'Unit A' }] } },
    { id: 'start', type: 'MeetingStarted', at, actor: admin, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} },
  ]);
  let current: Actor = moderation;
  let currentTime = at;
  let nextId = 0;
  const api = createInProcessApi({ store, meetingId: 'hv-2027', actor: () => current,
    clock: () => new Date(currentTime), idGenerator: () => `generated-${++nextId}` }) as ClaimApi;
  return { store, api, as: (actor: Actor) => { current = actor; }, time: (value: string) => { currentTime = value; } };
}

async function contribution(f: ReturnType<typeof fixture>) {
  const listVersion = (await f.api.getMeeting()).speakerListVersion;
  const speaker = await f.api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf(listVersion) });
  f.as(capturerA);
  const captured = await f.api.captureContribution({ speakerId: speaker.id, text: 'A question' },
    { ifMatch: etagOf(speaker.version) });
  return { speaker, captured };
}

describe('Scheibe 028: visible soft claims', () => {
  it('grants claim rights only to capture, expert and legal; admin has neither claim right', () => {
    const grants = new Map<Actor['role'], readonly Permission[]>([
      ['moderation', []], ['capture', ['contribution.claim' as Permission]], ['coordination', []],
      ['expert', ['question.claim' as Permission]], ['legal', ['question.claim' as Permission]],
      ['approver', []], ['podium', []], ['admin', []], ['observer', []],
    ]);
    for (const [role, allowed] of grants) {
      for (const permission of ['contribution.claim', 'question.claim'] as const) {
        expect(can({ id: role, role }, permission as Permission).allow, `${role}: ${permission}`)
          .toBe(allowed.includes(permission as Permission));
      }
    }
  });

  it('claims and renews a contribution from the injected clock; another actor gets 409', async () => {
    const f = fixture();
    const { captured } = await contribution(f);
    const first = await f.api.claimContribution(captured.id, { ifMatch: etagOf(captured.version) });
    expect(first.claim).toEqual({ actorId: capturerA.id, claimedAt: at, expiresAt: '2027-04-20T10:10:00.000Z' });
    expect(first.version).toBe(captured.version + 1);
    f.as(capturerB);
    const before = f.store.lastSeq();
    await expect(f.api.claimContribution(captured.id, { ifMatch: etagOf(first.version) }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-CLAIM-01' });
    expect(f.store.lastSeq()).toBe(before);
    f.as(capturerA);
    f.time('2027-04-20T10:05:00.000Z');
    const renewed = await f.api.claimContribution(captured.id, { ifMatch: etagOf(first.version) });
    expect(renewed.claim?.expiresAt).toBe('2027-04-20T10:15:00.000Z');
    expect(renewed.version).toBe(first.version + 1);
  });

  it('expires at the exact ten-minute boundary without an event or version change, then permits a new holder', async () => {
    const f = fixture();
    const { captured } = await contribution(f);
    const claimed = await f.api.claimContribution(captured.id, { ifMatch: etagOf(captured.version) });
    const before = f.store.lastSeq();
    f.time('2027-04-20T10:10:00.000Z');
    expect((await f.api.getContribution(captured.id)).claim).toBeUndefined();
    expect((await f.api.getContribution(captured.id)).version).toBe(claimed.version);
    expect(f.store.lastSeq()).toBe(before);
    f.as(capturerB);
    const next = await f.api.claimContribution(captured.id, { ifMatch: etagOf(claimed.version) });
    expect(next.claim?.actorId).toBe(capturerB.id);
    expect(next.version).toBe(claimed.version + 1);
  });

  it('allows only the current holder to release, and never treats a claim as a hard write lock', async () => {
    const f = fixture();
    const { captured } = await contribution(f);
    const claimed = await f.api.claimContribution(captured.id, { ifMatch: etagOf(captured.version) });
    f.as(capturerB);
    await expect(f.api.releaseContribution(captured.id, { ifMatch: etagOf(claimed.version) }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-CLAIM-02' });
    const [question] = await f.api.captureQuestions(captured.id, [{ text: 'What?' }],
      { ifMatch: etagOf(claimed.version) });
    expect(question?.id).toBeTruthy();
    f.as(capturerA);
    const latest = await f.api.getContribution(captured.id);
    const released = await f.api.releaseContribution(captured.id, { ifMatch: etagOf(latest.version) });
    expect(released.claim).toBeUndefined();
    expect(released.version).toBe(latest.version + 1);
  });

  it('requires the question version for claim and release and projects the owner', async () => {
    const f = fixture();
    const { captured } = await contribution(f);
    const [question] = await f.api.captureQuestions(captured.id, [{ text: 'What?' }],
      { ifMatch: etagOf(captured.version) });
    expect(question).toBeDefined();
    f.as({ id: 'coordinator', role: 'coordination' });
    const classified = await f.api.classifyQuestion(question!.id, { track: 'expert_track' },
      { ifMatch: etagOf(question!.version) });
    const assigned = await f.api.assignQuestion(question!.id, 'unit-a', { ifMatch: etagOf(classified.version) });
    f.as({ id: 'expert-a', role: 'expert' });
    const before = f.store.lastSeq();
    await expect(f.api.claimQuestion(question!.id)).rejects.toMatchObject({ status: 428 });
    await expect(f.api.claimQuestion(question!.id, { ifMatch: etagOf(question!.version) }))
      .rejects.toMatchObject({ status: 412 });
    expect(f.store.lastSeq()).toBe(before);
    const claimed = await f.api.claimQuestion(question!.id, { ifMatch: etagOf(assigned.version) });
    expect(claimed.claim?.actorId).toBe('expert-a');
    expect(claimed.version).toBe(assigned.version + 1);
    const released = await f.api.releaseQuestion(question!.id, { ifMatch: etagOf(claimed.version) });
    expect(released.claim).toBeUndefined();
    expect(released.version).toBe(claimed.version + 1);
  });
  // takt-027 (privacy, Codex P1 on #66): the event log keeps personId inside the claim, but no read view
  // shows it; presence needs only actorId (event reads already mask personId, slice 026).
  it('never shows the claimant personId in contribution or question views', async () => {
    const f = fixture();
    const withPerson = (actor: Actor): Actor => ({ ...actor, personId: `person-of-${actor.id}` });
    const listVersion = (await f.api.getMeeting()).speakerListVersion;
    const speaker = await f.api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf(listVersion) });
    f.as(withPerson(capturerA));
    const captured = await f.api.captureContribution({ speakerId: speaker.id, text: 'A question' },
      { ifMatch: etagOf(speaker.version) });
    const claimedContribution = await f.api.claimContribution(captured.id, { ifMatch: etagOf(captured.version) });
    expect(claimedContribution.claim?.actorId).toBe('capture-a');
    expect(claimedContribution.claim).not.toHaveProperty('personId');
    expect(f.store.all().some((e) => e.type === 'ContributionClaimed' &&
      (e.payload as { personId?: string }).personId === 'person-of-capture-a')).toBe(true);
    f.as(moderation);
    const readByOther = await f.api.getContribution(captured.id);
    expect(readByOther.claim?.actorId).toBe('capture-a');
    expect(readByOther.claim).not.toHaveProperty('personId');

    f.as(withPerson(capturerA));
    const [question] = await f.api.captureQuestions(captured.id, [{ text: 'What?' }],
      { ifMatch: etagOf(claimedContribution.version) });
    f.as({ id: 'coordinator', role: 'coordination' });
    const classified = await f.api.classifyQuestion(question!.id, { track: 'expert_track' },
      { ifMatch: etagOf(question!.version) });
    const assigned = await f.api.assignQuestion(question!.id, 'unit-a', { ifMatch: etagOf(classified.version) });
    f.as(withPerson({ id: 'expert-a', role: 'expert' }));
    const claimedQuestion = await f.api.claimQuestion(question!.id, { ifMatch: etagOf(assigned.version) });
    expect(claimedQuestion.claim?.actorId).toBe('expert-a');
    expect(claimedQuestion.claim).not.toHaveProperty('personId');
    f.as(moderation);
    const questionReadByOther = await f.api.getQuestion(question!.id);
    expect(questionReadByOther.claim?.actorId).toBe('expert-a');
    expect(questionReadByOther.claim).not.toHaveProperty('personId');
  });
});
