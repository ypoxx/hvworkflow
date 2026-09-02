/**
 * The acceptance sentence of the first version, expressed against the application core:
 * capture a speech, atomise seven questions, classify, answer, approve, read out on the podium,
 * close — with 800 questions already in the store. Plus locking, idempotency and rights.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore } from '../store.js';
import { seedEvents } from '../seed.js';
import type { Actor } from '../types.js';

const actors: Record<string, Actor> = {
  admin: { id: 'admin', role: 'admin' },
  moderation: { id: 'mod', role: 'moderation' },
  capture: { id: 'cap', role: 'capture' },
  expert: { id: 'exp', role: 'expert' },
  legal: { id: 'leg', role: 'legal' },
  approver: { id: 'app', role: 'approver' },
  podium: { id: 'pod', role: 'podium' },
  observer: { id: 'obs', role: 'observer' },
};

let current: Actor = actors.admin!;
let api: HvApi;
const as = (a: Actor) => {
  current = a;
};

beforeEach(async () => {
  const store = createInMemoryEventStore();
  let t = Date.parse('2027-04-20T12:00:00.000Z');
  api = createInProcessApi({
    store,
    actor: () => current,
    clock: () => new Date((t += 1000)),
    seeder: seedEvents,
  });
  as(actors.admin!);
  await api.seedDemo({ questions: 800, seed: 7 });
});

describe('acceptance sentence', () => {
  it('runs the spine end to end with 800 questions in the store', async () => {
    const meeting = await api.getMeeting();
    expect(meeting.counts.questions).toBe(800);

    as(actors.moderation!);
    const speaker = await api.registerSpeaker({ displayName: 'Testaktionärin', kind: 'shareholder' });
    expect(speaker._actions).toContain('speaker.update');

    as(actors.capture!);
    const text =
      'Meine erste Frage: Wie hoch war die Ausschüttungsquote? Zweitens: Wie viele Stellen wurden abgebaut? ' +
      'Drittens: Welche Rückstellungen bestehen? Viertens: Wann ist der Prüferwechsel? Fünftens: Wie hoch sind die IT-Ausgaben? ' +
      'Sechstens: Welche Zölle belasten das Ergebnis? Siebtens: Wie hoch ist die Fluktuation?';
    const contribution = await api.captureContribution({ speakerId: speaker.id, text });
    expect(contribution.coverage.coveredRatio).toBe(0);

    const sentences = text.split(/(?<=\?)\s*/).filter(Boolean);
    let cursor = 0;
    const captures = sentences.map((s) => {
      const start = text.indexOf(s, cursor);
      cursor = start + s.length;
      return { text: s.replace(/^[A-Za-zäöü]+:\s*/, ''), span: { start, end: start + s.length } };
    });
    const questions = await api.captureQuestions(contribution.id, captures);
    expect(questions).toHaveLength(7);
    expect((await api.getContribution(contribution.id)).coverage.coveredRatio).toBeGreaterThan(0.95);
    expect((await api.getMeeting()).counts.questions).toBe(807);

    const q = questions[0]!;
    expect(q._actions).toContain('question.classify');
    expect(q._actions).not.toContain('answer.draft');

    const classified = await api.classifyQuestion(q.id, { track: 'expert_track', agendaItemId: 'top-2', stageAssignment: 'cfo' }, { ifMatch: etagOf(q.version) });
    expect(classified.status).toBe('classified');
    const assigned = await api.assignQuestion(q.id, 'unit-fin', { ifMatch: etagOf(classified.version) });
    expect(assigned.status).toBe('assigned');

    as(actors.expert!);
    const drafted = await api.draftAnswer(q.id, { text: 'Die Quote lag bei 45 Prozent.', sources: ['Geschäftsbericht'] });
    expect(drafted.answers).toHaveLength(1);
    const submitted = await api.submitForReview(q.id);
    expect(submitted.status).toBe('in_review');
    expect(submitted._actions).not.toContain('question.approve');

    as(actors.legal!);
    await expect(api.approveQuestion(q.id, 99)).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-04' });
    const approved = await api.approveQuestion(q.id, 1);
    expect(approved.status).toBe('approved');
    expect(approved.approval?.answerVersion).toBe(1);

    as(actors.approver!);
    const staged = await api.stageQuestion(q.id);
    expect(staged.status).toBe('staged');
    const stage = await api.getStage();
    expect(stage.queue.map((x) => x.id).concat(stage.current?.id ?? [])).toContain(q.id);

    as(actors.podium!);
    const delivered = await api.deliverQuestion(q.id);
    expect(delivered.status).toBe('delivered');
    const closed = await api.closeQuestion(q.id);
    expect(closed.status).toBe('closed');
    expect(closed._actions).toEqual(['question.read']); // terminal: nothing but reading

    const history = await api.getQuestionHistory(q.id);
    expect(history.map((e) => e.type)).toEqual([
      'QuestionCaptured',
      'QuestionClassified',
      'QuestionAssigned',
      'AnswerDrafted',
      'QuestionSubmittedForReview',
      'QuestionApproved',
      'QuestionStaged',
      'QuestionDelivered',
      'QuestionClosed',
    ]);
  });
});

describe('invariants', () => {
  async function firstIn(status: string) {
    const { items } = await api.listQuestions({ status: [status as never], limit: 1 });
    expect(items.length).toBeGreaterThan(0);
    return items[0]!;
  }

  it('If-Match mismatch is a 412 and changes nothing', async () => {
    as(actors.capture!);
    const q = await firstIn('captured');
    await expect(api.classifyQuestion(q.id, { track: 'podium' }, { ifMatch: '"v999"' })).rejects.toMatchObject({ status: 412 });
    expect((await api.getQuestion(q.id)).status).toBe('captured');
  });

  it('Idempotency-Key replays the first result without a second event', async () => {
    as(actors.capture!);
    const q = await firstIn('captured');
    const before = (await api.listEvents(0, 100000)).lastSeq;
    const a = await api.classifyQuestion(q.id, { track: 'podium' }, { idempotencyKey: 'k-1' });
    const b = await api.classifyQuestion(q.id, { track: 'podium' }, { idempotencyKey: 'k-1' });
    expect(b).toEqual(a);
    expect((await api.listEvents(0, 100000)).lastSeq).toBe(before + 1);
  });

  it('a new answer version after approval voids the approval (bound to the text)', async () => {
    as(actors.expert!);
    const q = await firstIn('approved');
    const redrafted = await api.draftAnswer(q.id, { text: 'Korrigierte Antwort.' });
    expect(redrafted.status).toBe('answer_drafted');
    expect(redrafted.approval).toBeUndefined();
    expect(redrafted.answers.length).toBe(q.answers.length + 1);
  });

  it('observer may read but not act; deny reason carries a rule id', async () => {
    as(actors.observer!);
    const q = await firstIn('captured');
    expect(q._actions).toEqual(['question.read']);
    try {
      await api.classifyQuestion(q.id, { track: 'podium' });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      expect((e as ApiProblem).status).toBe(403);
      expect((e as ApiProblem).ruleId).toBe('R-PERM-01');
    }
  });

  it('events are append-only and gap-free', async () => {
    const { items, lastSeq } = await api.listEvents(0, 100000);
    expect(items.length).toBe(lastSeq);
    items.forEach((e, i) => expect(e.seq).toBe(i + 1));
  });

  it('the podium queue is ordered by stage position and delivering advances it', async () => {
    as(actors.podium!);
    const before = await api.getStage();
    expect(before.current).not.toBeNull();
    const positions = [before.current!, ...before.queue].map((q) => q.stagePosition!);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    await api.deliverQuestion(before.current!.id);
    const after = await api.getStage();
    expect(after.current?.id).toBe(before.queue[0]?.id ?? null);
  });

  it('classification validates its inputs (422) before any transition', async () => {
    as(actors.capture!);
    const q = await firstIn('captured');
    await expect(api.classifyQuestion(q.id, { track: 'nope' as never })).rejects.toMatchObject({ status: 422 });
    await expect(api.classifyQuestion(q.id, { track: 'podium', agendaItemId: 'top-99' })).rejects.toMatchObject({ status: 422 });
    await expect(api.classifyQuestion(q.id, { track: 'podium', stageAssignment: 'janitor' as never })).rejects.toMatchObject({ status: 422 });
    expect((await api.getQuestion(q.id)).status).toBe('captured');
  });

  it('seeding twice is refused: the log is never replaced', async () => {
    as(actors.admin!);
    await expect(api.seedDemo()).rejects.toMatchObject({ status: 409 });
  });
});
