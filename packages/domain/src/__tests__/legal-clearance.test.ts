import { beforeEach, describe, expect, it } from 'vitest';
import { createInProcessApi, etagOf, type HvApi } from '../api.js';
import { seedEvents } from '../seed.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { LEGAL_GATE_BY_TRACK } from '../transitions.js';
import type { Actor, Question, Track } from '../types.js';

const ACTORS = {
  admin: { id: 'admin', role: 'admin' },
  moderation: { id: 'moderation', role: 'moderation' },
  capture: { id: 'capture', role: 'capture' },
  coordination: { id: 'coordination', role: 'coordination' },
  expert: { id: 'expert', role: 'expert' },
  legal: { id: 'legal', role: 'legal' },
  legal2: { id: 'legal-2', role: 'legal' },
  approver: { id: 'approver', role: 'approver' },
} as const satisfies Record<string, Actor>;

let current: Actor;
let api: HvApi;
let store: EventStore;
const as = (actor: Actor) => { current = actor; };

beforeEach(async () => {
  store = createInMemoryEventStore();
  let time = Date.parse('2027-04-20T12:00:00.000Z');
  current = ACTORS.admin;
  api = createInProcessApi({
    store,
    actor: () => current,
    clock: () => new Date((time += 1000)),
    seeder: seedEvents,
  });
  await api.seedDemo({ questions: 30, seed: 7 });
});

async function classified(track: Track): Promise<Question> {
  as(ACTORS.moderation);
  const speaker = await api.registerSpeaker({ displayName: 'Testperson' });
  as(ACTORS.capture);
  const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Warum?' });
  const [question] = await api.captureQuestions(contribution.id, [
    { text: 'Warum?', span: { start: 0, end: 6 } },
  ]);
  as(ACTORS.coordination);
  return api.classifyQuestion(question!.id, { track });
}

async function inReview(track: 'fast_track' | 'expert_track', drafter: Actor = ACTORS.expert): Promise<Question> {
  const question = await classified(track);
  as(drafter);
  await api.draftAnswer(question.id, { text: 'Belastbare Antwort.' });
  as(ACTORS.expert);
  return api.submitForReview(question.id);
}

describe('Scheibe 021c: legal clearance and stage gate', () => {
  it('keeps the gate enabled and frozen for all three tracks', () => {
    expect(Object.isFrozen(LEGAL_GATE_BY_TRACK)).toBe(true);
    expect(LEGAL_GATE_BY_TRACK).toEqual({ podium: true, fast_track: true, expert_track: true });
  });

  for (const track of ['fast_track', 'expert_track'] as const) {
    it(`${track}: staging requires legal clearance of the approved version`, async () => {
      const question = await inReview(track);
      as(ACTORS.approver);
      await api.approveQuestion(question.id, 1);
      await expect(api.stageQuestion(question.id)).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-07' });

      const clearedQuestion = await inReview(track);
      as(ACTORS.legal);
      const cleared = await api.clearQuestionLegally(clearedQuestion.id, { answerVersion: 1 }, { ifMatch: etagOf(clearedQuestion.version) });
      expect(cleared.legalClearance).toMatchObject({ answerVersion: 1, clearedBy: ACTORS.legal });
      expect(cleared.status).toBe('in_review');
      as(ACTORS.approver);
      await api.approveQuestion(clearedQuestion.id, 1);
      expect((await api.stageQuestion(clearedQuestion.id)).status).toBe('staged');
    });
  }

  it('podium: staging requires a clearance without an answer version', async () => {
    const question = await classified('podium');
    as(ACTORS.approver);
    await expect(api.stageQuestion(question.id)).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-07' });
    as(ACTORS.legal);
    const cleared = await api.clearQuestionLegally(question.id, {});
    expect(cleared.legalClearance).toMatchObject({ clearedBy: ACTORS.legal });
    expect(cleared.legalClearance).not.toHaveProperty('answerVersion');
    as(ACTORS.approver);
    expect((await api.stageQuestion(question.id)).status).toBe('staged');
  });

  it('uses the same four-eyes guard for legal clearance and offers a second legal actor the action', async () => {
    const question = await inReview('expert_track', ACTORS.legal);
    as(ACTORS.legal);
    expect((await api.getQuestion(question.id))._actions).not.toContain('question.legal.clear');
    const before = store.all().length;
    await expect(api.clearQuestionLegally(question.id, { answerVersion: 1 })).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
    expect(store.all()).toHaveLength(before);
    as(ACTORS.legal2);
    expect((await api.getQuestion(question.id))._actions).toContain('question.legal.clear');
    expect((await api.clearQuestionLegally(question.id, { answerVersion: 1 })).legalClearance?.answerVersion).toBe(1);
  });

  it('legal cannot approve; approver can approve and cannot legally clear', async () => {
    const question = await inReview('expert_track');
    as(ACTORS.legal);
    const actions = (await api.getQuestion(question.id))._actions;
    expect(actions).toContain('question.legal.clear');
    expect(actions).not.toContain('question.approve');
    await expect(api.approveQuestion(question.id, 1)).rejects.toMatchObject({ status: 403, ruleId: 'R-PERM-01' });
    as(ACTORS.approver);
    expect((await api.getQuestion(question.id))._actions).not.toContain('question.legal.clear');
    expect((await api.approveQuestion(question.id, 1)).approval?.answerVersion).toBe(1);
  });

  it('a new answer version voids legal clearance and the old version cannot open the gate', async () => {
    const question = await inReview('expert_track');
    as(ACTORS.legal);
    await api.clearQuestionLegally(question.id, { answerVersion: 1 });
    as(ACTORS.expert);
    await api.draftAnswer(question.id, { text: 'Neue Version.' });
    expect((await api.getQuestion(question.id)).legalClearance).toBeUndefined();
    await api.submitForReview(question.id);
    as(ACTORS.legal);
    await expect(api.clearQuestionLegally(question.id, { answerVersion: 1 })).rejects.toMatchObject({ status: 409 });
    await api.clearQuestionLegally(question.id, { answerVersion: 2 });
    as(ACTORS.approver);
    await api.approveQuestion(question.id, 2);
    expect((await api.stageQuestion(question.id)).status).toBe('staged');
  });

  it('returning a podium question to classified voids its clearance', async () => {
    const question = await classified('podium');
    as(ACTORS.legal);
    await api.clearQuestionLegally(question.id, {});
    as(ACTORS.approver);
    await api.stageQuestion(question.id);
    await api.returnQuestion(question.id, 'Überarbeiten.');
    expect((await api.getQuestion(question.id)).legalClearance).toBeUndefined();
    await expect(api.stageQuestion(question.id)).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-07' });
  });
});
