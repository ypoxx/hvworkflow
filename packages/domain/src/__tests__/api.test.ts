/**
 * The acceptance sentence of the first version, expressed against the application core:
 * capture a speech, atomise seven questions, classify, answer, approve, read out on the podium,
 * close — with 800 questions already in the store. Plus locking, idempotency and rights.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { CORPUS_DEMO, CORPUS_LOAD, seedEvents } from '../seed.js';
import type { DomainEvent } from '../events.js';
import type { Actor, Permission, Question, Role } from '../types.js';
import { READ_PERMISSIONS } from '../types.js';

const actors: Record<string, Actor> = {
  admin: { id: 'admin', role: 'admin' },
  moderation: { id: 'mod', role: 'moderation' },
  capture: { id: 'cap', role: 'capture' },
  coordination: { id: 'coord', role: 'coordination' },
  expert: { id: 'exp', role: 'expert' },
  legal: { id: 'leg', role: 'legal' },
  approver: { id: 'app', role: 'approver' },
  podium: { id: 'pod', role: 'podium' },
  observer: { id: 'obs', role: 'observer' },
};

let store: EventStore;
let current: Actor = actors.admin!;
let api: HvApi;
const as = (a: Actor) => {
  current = a;
};

beforeEach(async () => {
  store = createInMemoryEventStore();
  let t = Date.parse('2027-04-20T12:00:00.000Z');
  api = createInProcessApi({
    store,
    actor: () => current,
    clock: () => new Date((t += 1000)),
    seeder: seedEvents,
  });
  as(actors.admin!);
  // The load round sizes keep this store identical to before slice 080b (the default is now CORPUS_DEMO).
  await api.seedDemo({ questions: 800, seed: 7, roundSizes: CORPUS_LOAD.roundSizes });
});

describe('acceptance sentence', () => {
  it('runs the spine end to end with 800 questions in the store', async () => {
    const meeting = await api.getMeeting();
    expect(meeting.counts.questions).toBe(800);

    as(actors.moderation!);
    const speaker = await api.registerSpeaker({ displayName: 'Testaktionärin' });
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

    // Classify and assign are coordination's since slice 021b; capture hands over here.
    as(actors.coordination!);
    const q = await api.getQuestion(questions[0]!.id);
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
    expect((await api.getQuestion(q.id))._actions).toContain('question.legal.clear');
    await expect(api.clearQuestionLegally(q.id, { answerVersion: 99 })).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-04' });
    const cleared = await api.clearQuestionLegally(q.id, { answerVersion: 1 });
    expect(cleared.legalClearance?.answerVersion).toBe(1);

    as(actors.approver!);
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
    // Terminal: podium holds neither `question.read` nor `question.read.delivered` since slice 010
    // (Festlegung 4) — it works the stage, not the question archive — so no action is left at all.
    expect(closed._actions).toEqual([]);

    as(actors.moderation!); // podium has no `history.read` (slice 010); moderation does
    const history = await api.getQuestionHistory(q.id);
    expect(history.map((e) => e.type)).toEqual([
      'QuestionCaptured',
      'QuestionClassified',
      'QuestionAssigned',
      'AnswerDrafted',
      'QuestionSubmittedForReview',
      'QuestionLegalCleared',
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
    as(actors.coordination!);
    const q = await firstIn('captured');
    await expect(api.classifyQuestion(q.id, { track: 'podium' }, { ifMatch: '"v999"' })).rejects.toMatchObject({ status: 412 });
    expect((await api.getQuestion(q.id)).status).toBe('captured');
  });

  it('Idempotency-Key replays the first result without a second event', async () => {
    as(actors.coordination!);
    const q = await firstIn('captured');
    // `listEvents` requires `event.read` since slice 010; coordination does not hold it, so the counter
    // reads happen under admin instead — the idempotent write itself still runs as coordination.
    as(actors.admin!);
    const before = (await api.listEvents(0, 100000)).lastSeq;
    as(actors.coordination!);
    const a = await api.classifyQuestion(q.id, { track: 'podium' }, { idempotencyKey: 'k-1' });
    const b = await api.classifyQuestion(q.id, { track: 'podium' }, { idempotencyKey: 'k-1' });
    expect(b).toEqual(a);
    as(actors.admin!);
    expect((await api.listEvents(0, 100000)).lastSeq).toBe(before + 1);
  });

  it('R-IDEM-01: an idempotency key is scoped to actor and operation', async () => {
    as(actors.coordination!);
    const { items } = await api.listQuestions({ status: ['captured'], limit: 2 });
    const [a, b] = items as [Question, Question];
    const first = await api.classifyQuestion(a.id, { track: 'podium' }, { idempotencyKey: 'shared' });
    // Another actor replaying the same key is a new request: no leak of _actions. `a` is now
    // `classified`, outside observer's `question.read.delivered` scope, and observer holds no
    // `question.classify` either — 404, not 403 (Festlegung 3, "keine ableitbare ID", slice 010).
    as(actors.observer!);
    await expect(api.classifyQuestion(a.id, { track: 'podium' }, { idempotencyKey: 'shared' })).rejects.toMatchObject({ status: 404 });
    // The same actor with the same key on another resource executes independently.
    as(actors.coordination!);
    const other = await api.classifyQuestion(b.id, { track: 'fast_track' }, { idempotencyKey: 'shared' });
    expect(other.id).toBe(b.id);
    expect(other.track).toBe('fast_track');
    expect(await api.classifyQuestion(a.id, { track: 'expert_track' }, { idempotencyKey: 'shared' })).toEqual(first);
  });

  it('a new answer version after approval voids the approval (bound to the text)', async () => {
    as(actors.expert!);
    const q = await firstIn('approved');
    const redrafted = await api.draftAnswer(q.id, { text: 'Korrigierte Antwort.' });
    expect(redrafted.status).toBe('answer_drafted');
    expect(redrafted.approval).toBeUndefined();
    expect(redrafted.answers.length).toBe(q.answers.length + 1);
  });

  it('404 precedence (Festlegung 3): observer write attempt on a non-delivered question is masked as not found, not 403', async () => {
    as(actors.capture!);
    const q = await firstIn('captured');
    as(actors.observer!);
    try {
      await api.classifyQuestion(q.id, { track: 'podium' });
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      expect((e as ApiProblem).status).toBe(404);
    }
  });

  it('observer may read a delivered question (question.read.delivered) but not act on it — 403 with a rule id', async () => {
    as(actors.admin!);
    const deliveredAdmin = await firstIn('delivered');
    as(actors.observer!);
    const q = await api.getQuestion(deliveredAdmin.id);
    // `question.read.delivered` extends `question.read` within its scope (Festlegung 2), so both
    // read actions show up here — `can()` reaches the same allow via either permission.
    expect(q._actions).toEqual(['question.read', 'question.read.delivered']);
    try {
      await api.returnQuestion(q.id, 'nicht zulässig');
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
    as(actors.coordination!);
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

  it('seeds CORPUS_DEMO when no options are given (slice 080b)', async () => {
    const fresh = createInProcessApi({
      store: createInMemoryEventStore(),
      actor: () => actors.admin!,
      clock: () => new Date('2027-04-20T13:30:00.000Z'),
      seeder: seedEvents,
    });
    const meeting = await fresh.seedDemo();
    expect(meeting.counts.questions).toBe(CORPUS_DEMO.questions);
    expect(meeting.counts.speakers).toBe(CORPUS_DEMO.roundSizes.reduce((a, b) => a + b, 0));
  });
});

/**
 * Slice 010 (Lesepfade unter can() mit Leserechten): one positive and one negative test per read
 * permission (Ziel 7), the master-data "every role may" test (Festlegung 1), the 404 precedence of
 * Festlegung 3, and `subscribe` (Festlegung 5, the 13th read method).
 */
describe('read rights (slice 010)', () => {
  async function firstIn(status: string) {
    const { items } = await api.listQuestions({ status: [status as never], limit: 1 });
    expect(items.length).toBeGreaterThan(0);
    return items[0]!;
  }

  async function expectDenied(promise: Promise<unknown>, status: number, ruleId?: string): Promise<void> {
    try {
      await promise;
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      expect((e as ApiProblem).status).toBe(status);
      if (ruleId !== undefined) expect((e as ApiProblem).ruleId).toBe(ruleId);
    }
  }

  it('master data (Festlegung 1): every role may read getMeeting, listAgendaItems, listUnits', async () => {
    for (const a of Object.values(actors)) {
      as(a);
      await expect(api.getMeeting()).resolves.toBeTruthy();
      await expect(api.listAgendaItems()).resolves.toBeTruthy();
      await expect(api.listUnits()).resolves.toBeTruthy();
    }
  });

  it('speaker.read: moderation, capture and admin may listSpeakers and getSpeaker', async () => {
    for (const a of [actors.moderation!, actors.capture!, actors.admin!]) {
      as(a);
      const speakers = await api.listSpeakers();
      expect(speakers.length).toBeGreaterThan(0);
      await expect(api.getSpeaker(speakers[0]!.id)).resolves.toBeTruthy();
    }
  });

  it('speaker.read: expert is denied listSpeakers and getSpeaker with R-PERM-02', async () => {
    as(actors.admin!);
    const anySpeaker = (await api.listSpeakers())[0]!;
    as(actors.expert!);
    await expectDenied(api.listSpeakers(), 403, 'R-PERM-02');
    await expectDenied(api.getSpeaker(anySpeaker.id), 403, 'R-PERM-02');
  });

  it('contribution.read: moderation, capture and admin may listContributions and getContribution', async () => {
    for (const a of [actors.moderation!, actors.capture!, actors.admin!]) {
      as(a);
      const contributions = await api.listContributions();
      expect(contributions.length).toBeGreaterThan(0);
      await expect(api.getContribution(contributions[0]!.id)).resolves.toBeTruthy();
    }
  });

  it('contribution.read: podium is denied listContributions and getContribution with R-PERM-02', async () => {
    as(actors.admin!);
    const anyContribution = (await api.listContributions())[0]!;
    as(actors.podium!);
    await expectDenied(api.listContributions(), 403, 'R-PERM-02');
    await expectDenied(api.getContribution(anyContribution.id), 403, 'R-PERM-02');
  });

  it('question.read: moderation, capture, expert, legal, approver and admin may listQuestions and getQuestion', async () => {
    for (const a of [actors.moderation!, actors.capture!, actors.expert!, actors.legal!, actors.approver!, actors.admin!]) {
      as(a);
      const { items } = await api.listQuestions({ limit: 1 });
      expect(items.length).toBeGreaterThan(0);
      await expect(api.getQuestion(items[0]!.id)).resolves.toBeTruthy();
    }
  });

  it('question.read: podium is denied listQuestions with R-PERM-02, and getQuestion is masked as 404 (Festlegung 3)', async () => {
    as(actors.admin!);
    const anyQuestion = (await api.listQuestions({ limit: 1 })).items[0]!;
    as(actors.podium!);
    await expectDenied(api.listQuestions(), 403, 'R-PERM-02');
    await expectDenied(api.getQuestion(anyQuestion.id), 404);
  });

  it('question.read.delivered: observer sees only delivered/closed questions in listQuestions(), and total matches; admin (holding question.read too) stays unrestricted', async () => {
    as(actors.admin!);
    const { items: all, total: totalAll } = await api.listQuestions({ limit: 10000 });
    const visible = all.filter((q) => q.status === 'delivered' || q.status === 'closed');

    as(actors.observer!);
    const observed = await api.listQuestions({ limit: 10000 });
    expect(observed.items.every((q) => q.status === 'delivered' || q.status === 'closed')).toBe(true);
    expect(observed.total).toBe(visible.length);
    expect(observed.items.length).toBe(visible.length);

    // The admin case the old title promised but the body never checked (rework round, point 10):
    // admin holds `question.read` unrestricted *as well as* the scoped `question.read.delivered`
    // (Festlegung 2), so its own listQuestions() is not limited to delivered/closed.
    as(actors.admin!);
    const adminAgain = await api.listQuestions({ limit: 10000 });
    expect(adminAgain.total).toBe(totalAll);
    expect(adminAgain.items.some((q) => q.status !== 'delivered' && q.status !== 'closed')).toBe(true);
  });

  it('question.read.delivered: paging through the observer visible list only ever returns visible items, and total is stable across pages', async () => {
    as(actors.observer!);
    const page1 = await api.listQuestions({ limit: 5, offset: 0 });
    const page2 = await api.listQuestions({ limit: 5, offset: 5 });
    expect(page1.total).toBeGreaterThanOrEqual(10); // seed corpus assumption, so the two pages differ
    expect(page2.total).toBe(page1.total);
    for (const q of [...page1.items, ...page2.items]) {
      expect(['delivered', 'closed']).toContain(q.status);
    }
    const page1Ids = new Set(page1.items.map((q) => q.id));
    for (const q of page2.items) expect(page1Ids.has(q.id)).toBe(false);
  });

  it('question.read.delivered: observer 403 R-PERM-03 on a status filter outside the read scope', async () => {
    as(actors.observer!);
    await expectDenied(api.listQuestions({ status: ['answer_drafted'] }), 403, 'R-PERM-03');
  });

  it('question.read.delivered: observer getQuestion on a non-delivered question is masked as 404 (Festlegung 3)', async () => {
    as(actors.capture!);
    const q = await firstIn('captured');
    as(actors.observer!);
    await expectDenied(api.getQuestion(q.id), 404);
  });

  it('stage.read: moderation, approver, podium and admin may getStage', async () => {
    for (const a of [actors.moderation!, actors.approver!, actors.podium!, actors.admin!]) {
      as(a);
      await expect(api.getStage()).resolves.toBeTruthy();
    }
  });

  it('stage.read: expert is denied getStage with R-PERM-02', async () => {
    as(actors.expert!);
    await expectDenied(api.getStage(), 403, 'R-PERM-02');
  });

  it('history.read: moderation, capture, expert, legal, approver and admin may getQuestionHistory', async () => {
    as(actors.admin!);
    const q = await firstIn('captured');
    for (const a of [actors.moderation!, actors.capture!, actors.expert!, actors.legal!, actors.approver!, actors.admin!]) {
      as(a);
      await expect(api.getQuestionHistory(q.id)).resolves.toBeTruthy();
    }
  });

  it('history.read: observer is denied getQuestionHistory of a delivered question with R-PERM-02 (it can read the question itself)', async () => {
    as(actors.admin!);
    const q = await firstIn('delivered');
    as(actors.observer!);
    await expect(api.getQuestion(q.id)).resolves.toBeTruthy(); // in scope: proves this is a real 403, not the 404 mask
    await expectDenied(api.getQuestionHistory(q.id), 403, 'R-PERM-02');
  });

  it('404 precedence (Festlegung 3): podium — no question.read, no history.read — gets 404 on getQuestionHistory, not 403', async () => {
    as(actors.admin!);
    const q = await firstIn('captured');
    as(actors.podium!);
    await expectDenied(api.getQuestionHistory(q.id), 404);
  });

  it('404 precedence (Festlegung 3): podium may still deliverQuestion on the staged question although it cannot read it', async () => {
    as(actors.podium!);
    const stage = await api.getStage(); // podium holds stage.read
    const current = stage.current!;
    const delivered = await api.deliverQuestion(current.id);
    expect(delivered.status).toBe('delivered');
  });

  it('event.read: admin may listEvents', async () => {
    as(actors.admin!);
    await expect(api.listEvents(0, 10)).resolves.toBeTruthy();
  });

  it('event.read: podium is denied listEvents with R-PERM-02', async () => {
    as(actors.podium!);
    await expectDenied(api.listEvents(0, 10), 403, 'R-PERM-02');
  });

  it('subscribe (Festlegung 5): delivers [] to an actor without event.read', async () => {
    const writer = createInProcessApi({ store, actor: () => actors.coordination! });
    const received: DomainEvent[][] = [];
    as(actors.observer!);
    const unsubscribe = api.subscribe((events) => received.push(events));
    const q = (await writer.listQuestions({ status: ['captured'], limit: 1 })).items[0]!;
    await writer.classifyQuestion(q.id, { track: 'podium' });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([]);
    unsubscribe();
  });

  it('subscribe (Festlegung 5): checks the permission fresh on every delivery, so a role switch between two deliveries changes what arrives', async () => {
    const writer = createInProcessApi({ store, actor: () => actors.coordination! });
    const received: DomainEvent[][] = [];
    as(actors.observer!);
    const unsubscribe = api.subscribe((events) => received.push(events));

    const first = (await writer.listQuestions({ status: ['captured'], limit: 1 })).items[0]!;
    await writer.classifyQuestion(first.id, { track: 'podium' });
    expect(received[0]).toEqual([]); // observer: no event.read

    as(actors.admin!); // the demo role switcher changes the actor at runtime, same subscription
    const second = (await writer.listQuestions({ status: ['captured'], limit: 1 })).items[0]!;
    await writer.classifyQuestion(second.id, { track: 'fast_track' });
    expect(received).toHaveLength(2);
    expect(received[1]!.length).toBeGreaterThan(0); // admin: holds event.read

    // The other direction too (rework round, point 10): switching back must stop the flow again —
    // this is not a one-way "gets enabled once" effect, the check really runs fresh every time.
    as(actors.observer!);
    const third = (await writer.listQuestions({ status: ['captured'], limit: 1 })).items[0]!;
    await writer.classifyQuestion(third.id, { track: 'expert_track' });
    expect(received).toHaveLength(3);
    expect(received[2]).toEqual([]); // observer again: no event.read

    unsubscribe();
  });

  it('every entry of READ_PERMISSIONS (types.ts) names a real HvApi method (rework round, point 4)', () => {
    for (const method of Object.keys(READ_PERMISSIONS)) {
      expect(typeof (api as unknown as Record<string, unknown>)[method], method).toBe('function');
    }
  });

  it('mergeQuestion: intoQuestionId is not an existence oracle — observer and podium get an identical 404 for a hidden target and a non-existent one (rework round, point 1)', async () => {
    as(actors.admin!);
    const primary = await firstIn('captured'); // neither observer nor podium can read `captured`
    const hiddenTarget = (await api.listQuestions({ status: ['captured'], limit: 2 })).items[1]!;

    for (const a of [actors.observer!, actors.podium!]) {
      as(a);
      let hiddenStatus: number | undefined;
      let hiddenRuleId: string | undefined;
      try {
        await api.mergeQuestion(primary.id, hiddenTarget.id);
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiProblem);
        hiddenStatus = (e as ApiProblem).status;
        hiddenRuleId = (e as ApiProblem).ruleId;
      }
      let unknownStatus: number | undefined;
      let unknownRuleId: string | undefined;
      try {
        await api.mergeQuestion(primary.id, 'does-not-exist-at-all');
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiProblem);
        unknownStatus = (e as ApiProblem).status;
        unknownRuleId = (e as ApiProblem).ruleId;
      }
      expect(hiddenStatus).toBe(404);
      expect(unknownStatus).toBe(404);
      expect(hiddenRuleId).toBeUndefined();
      expect(unknownRuleId).toBeUndefined();
    }
  });

  it('mergeQuestion: a delivered primary question observer may read is still not a target-existence oracle (Ziel 7, Nachprüfung A)', async () => {
    as(actors.admin!);
    const primary = await firstIn('delivered'); // in observer's read scope (question.read.delivered)
    const hiddenTarget = await firstIn('captured'); // outside observer's read scope

    as(actors.observer!);
    // Sanity: the primary really is readable — a difference below could then never come from
    // Festlegung 3's "cannot read the primary at all" precedence (the existing test above, with a
    // `captured` primary, covers that case).
    await expect(api.getQuestion(primary.id)).resolves.toBeTruthy();

    let hidden: ApiProblem | undefined;
    try {
      await api.mergeQuestion(primary.id, hiddenTarget.id);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      hidden = e as ApiProblem;
    }
    let unknown: ApiProblem | undefined;
    try {
      await api.mergeQuestion(primary.id, 'does-not-exist-at-all');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      unknown = e as ApiProblem;
    }
    // Observer never holds `question.merge` at all (Festlegung 4) — `transition()` denies on that
    // permission alone, before `build()` ever resolves `intoQuestionId` (rework round, point 1), so
    // the hidden target and the unknown one produce the identical response, id and all.
    expect(hidden!.status).toBe(403);
    expect(hidden!.ruleId).toBe('R-PERM-01');
    // The whole problem document, title included (Nachprüfung B, point 5).
    expect(unknown!.toProblem()).toEqual(hidden!.toProblem());
  });

  it('409 detail (Festlegung 8): an actor who may not read the question gets a generic detail with no status and no rule id; a reader keeps both', async () => {
    as(actors.admin!);
    const captured = await firstIn('captured'); // deliverQuestion only allows 'staged' -> 409 here

    as(actors.podium!); // holds question.deliver, but neither question.read nor question.read.delivered
    try {
      await api.deliverQuestion(captured.id);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      const problem = e as ApiProblem;
      expect(problem.status).toBe(409);
      expect(problem.ruleId).toBeUndefined();
      expect(problem.detail).toBe('Transition not allowed.');
    }

    as(actors.admin!); // holds question.deliver and unrestricted question.read
    try {
      await api.deliverQuestion(captured.id);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblem);
      const problem = e as ApiProblem;
      expect(problem.status).toBe(409);
      expect(problem.ruleId).toBe('R-TRANS-00');
      expect(problem.detail).toContain('captured');
    }
  });

  it('getQuestionHistory requires both history.read and read access to the question, including scope (Festlegung 8, rework round point 5)', async () => {
    as(actors.capture!);
    const captured = await firstIn('captured');
    // No current role holds `history.read` without full `question.read` (Festlegung 4's table always
    // grants both together); a synthetic role proves the endpoint does not treat "holds history.read"
    // as sufficient on its own once a future role might separate the two.
    const mutableRolePermissions = ROLE_PERMISSIONS as unknown as Record<string, readonly Permission[]>;
    mutableRolePermissions['auditor'] = ['history.read'];
    try {
      as({ id: 'aud', role: 'auditor' as Role });
      await expect(api.getQuestionHistory(captured.id)).rejects.toMatchObject({ status: 404 });
    } finally {
      delete mutableRolePermissions['auditor'];
    }
  });
});

describe('coordination role (slice 021b): classify and assign move from capture to coordination', () => {
  async function firstCaptured() {
    as(actors.admin!);
    const { items } = await api.listQuestions({ status: ['captured'], limit: 1 });
    expect(items.length).toBeGreaterThan(0);
    return items[0]!;
  }

  it('coordination holds exactly classify, assign and the four read grants of the spec', () => {
    expect([...(ROLE_PERMISSIONS.coordination ?? [])].sort()).toEqual(
      ['contribution.read', 'history.read', 'question.assign', 'question.classify', 'question.read', 'speaker.read'].sort(),
    );
  });

  it('capture no longer classifies or assigns: 403 R-PERM-01, nothing changes', async () => {
    const q = await firstCaptured();
    as(actors.capture!);
    expect((await api.getQuestion(q.id))._actions).not.toContain('question.classify');
    await expect(api.classifyQuestion(q.id, { track: 'expert_track' })).rejects.toMatchObject({ status: 403, ruleId: 'R-PERM-01' });
    as(actors.coordination!);
    const classified = await api.classifyQuestion(q.id, { track: 'expert_track' });
    as(actors.capture!);
    expect((await api.getQuestion(q.id))._actions).not.toContain('question.assign');
    await expect(api.assignQuestion(q.id, 'unit-fin')).rejects.toMatchObject({ status: 403, ruleId: 'R-PERM-01' });
    expect((await api.getQuestion(q.id)).version).toBe(classified.version);
  });

  it('coordination classifies and assigns; _actions offers exactly that step', async () => {
    const q = await firstCaptured();
    as(actors.coordination!);
    const seen = await api.getQuestion(q.id);
    expect(seen._actions).toContain('question.classify');
    expect(seen._actions).not.toContain('question.capture');
    const classified = await api.classifyQuestion(q.id, { track: 'expert_track' }, { ifMatch: etagOf(seen.version) });
    expect(classified.status).toBe('classified');
    expect(classified._actions).toContain('question.assign');
    const assigned = await api.assignQuestion(q.id, 'unit-fin', { ifMatch: etagOf(classified.version) });
    expect(assigned.status).toBe('assigned');
  });

  it('coordination does not capture: question.capture and contribution.capture are 403', async () => {
    as(actors.coordination!);
    const contribution = (await api.listContributions())[0]!;
    await expect(api.captureQuestions(contribution.id, [{ text: 'Frage?', span: { start: 0, end: 6 } }])).rejects.toMatchObject({
      status: 403,
      ruleId: 'R-PERM-01',
    });
    const speaker = (await api.listSpeakers())[0]!;
    await expect(api.captureContribution({ speakerId: speaker.id, text: 'Text.' })).rejects.toMatchObject({ status: 403, ruleId: 'R-PERM-01' });
  });
});

/**
 * Slice 021a: R-GUARD-06 (Vier-Augen, "Ersteller ≠ Freigeber", docs/rollen-und-rechtekonzept.md:109,
 * :156). The guard compares actor ids of the latest answer version and the approver, never roles.
 */
describe('four-eyes approval R-GUARD-06 (slice 021a)', () => {
  /** An assigned question on a text track, ready for its first answer version. */
  async function assignedTextQuestion(): Promise<Question> {
    as(actors.admin!);
    const { items } = await api.listQuestions({ status: ['assigned'], limit: 200 });
    const q = items.find((x) => x.track !== undefined && x.track !== 'podium');
    expect(q).toBeDefined();
    return q!;
  }

  async function draftAs(a: Actor, id: string, text: string): Promise<Question> {
    as(a);
    return api.draftAnswer(id, { text });
  }

  async function submit(id: string): Promise<Question> {
    as(actors.expert!);
    return api.submitForReview(id);
  }

  it('legal drafts version 1 and tries to legally clear it: 409 R-GUARD-06, no event', async () => {
    const q = await assignedTextQuestion();
    await draftAs(actors.legal!, q.id, 'Entwurf von Recht.');
    await submit(q.id);
    as(actors.legal!);
    const before = store.all().length;
    await expect(api.clearQuestionLegally(q.id, { answerVersion: 1 })).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
    expect(store.all().length).toBe(before);
    expect((await api.getQuestion(q.id)).status).toBe('in_review');
  });

  it('admin drafts and approves: 409 R-GUARD-06 — no role bypasses the guard', async () => {
    const q = await assignedTextQuestion();
    await draftAs(actors.admin!, q.id, 'Entwurf von Admin.');
    as(actors.admin!);
    await api.submitForReview(q.id);
    const before = store.all().length;
    await expect(api.approveQuestion(q.id, 1)).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
    expect(store.all().length).toBe(before);
  });

  it('the same person under another role is still the creator (actor id, not role)', async () => {
    const q = await assignedTextQuestion();
    await draftAs(actors.legal!, q.id, 'Entwurf von Recht.');
    await submit(q.id);
    as({ id: actors.legal!.id, role: 'approver' });
    await expect(api.approveQuestion(q.id, 1)).rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
  });

  it('expert drafts, approver approves: allowed', async () => {
    const q = await assignedTextQuestion();
    await draftAs(actors.expert!, q.id, 'Entwurf vom Fachbereich.');
    await submit(q.id);
    as(actors.approver!);
    const approved = await api.approveQuestion(q.id, 1);
    expect(approved.status).toBe('approved');
    expect(approved.approval?.answerVersion).toBe(1);
  });

  it('legal drafts v1, expert drafts v2, legal clears v2 and approver approves: allowed', async () => {
    const q = await assignedTextQuestion();
    await draftAs(actors.legal!, q.id, 'Version 1 von Recht.');
    await draftAs(actors.expert!, q.id, 'Version 2 vom Fachbereich.');
    await submit(q.id);
    as(actors.legal!);
    const cleared = await api.clearQuestionLegally(q.id, { answerVersion: 2 });
    expect(cleared.legalClearance?.answerVersion).toBe(2);
    as(actors.approver!);
    const approved = await api.approveQuestion(q.id, 2);
    expect(approved.status).toBe('approved');
    expect(approved.approval?.answerVersion).toBe(2);
  });

  it('_actions: the creator is not offered question.legal.clear, another legal person is', async () => {
    const q = await assignedTextQuestion();
    await draftAs(actors.legal!, q.id, 'Entwurf von Recht.');
    await submit(q.id);
    as(actors.legal!);
    expect((await api.getQuestion(q.id))._actions).not.toContain('question.legal.clear');
    as({ id: 'leg-2', role: 'legal' });
    expect((await api.getQuestion(q.id))._actions).toContain('question.legal.clear');
    expect((await api.getQuestion(q.id))._actions).not.toContain('question.approve');
    as(actors.approver!);
    expect((await api.getQuestion(q.id))._actions).toContain('question.approve');
  });
});
