/**
 * The acceptance sentence of slice 004, driven over HTTP instead of directly against `HvApi`
 * (see `packages/domain/src/__tests__/api.test.ts` for the in-process version): register a
 * speaker, capture a speech, atomise seven questions, classify, assign, draft, submit, approve,
 * stage, deliver, close — with 800 questions already seeded, proving the server and the domain
 * agree on one contract (AGENTS.md rule 6).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';
import { expectValid } from './schema.ts';

describe('acceptance sentence (HTTP)', () => {
  let app: Hono;
  let t = Date.parse('2027-04-20T12:00:00.000Z');

  beforeAll(async () => {
    app = createApp({ demoEnabled: true, clock: () => new Date((t += 1000)) });
    const seedRes = await req(app, 'POST', '/v1/demo/seed', {
      actor: ACTOR.admin,
      body: { questions: 800, seed: 7 },
    });
    expect(seedRes.status).toBe(200);
    expectValid('seedDemo', 200, await seedRes.json());
  });

  it('runs the spine end to end over HTTP with 800 questions in the store', async () => {
    const meetingRes = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    const meeting = await meetingRes.json();
    expectValid('getMeeting', 200, meeting);
    expect(meeting.counts.questions).toBe(800);

    const speakerRes = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      body: { displayName: 'Testaktionärin', kind: 'shareholder' },
    });
    expect(speakerRes.status).toBe(201);
    const speaker = await speakerRes.json();
    expectValid('registerSpeaker', 201, speaker);
    expect(speaker._actions).toContain('speaker.update');

    const text =
      'Meine erste Frage: Wie hoch war die Ausschüttungsquote? Zweitens: Wie viele Stellen wurden abgebaut? ' +
      'Drittens: Welche Rückstellungen bestehen? Viertens: Wann ist der Prüferwechsel? Fünftens: Wie hoch sind die IT-Ausgaben? ' +
      'Sechstens: Welche Zölle belasten das Ergebnis? Siebtens: Wie hoch ist die Fluktuation?';
    const contribRes = await req(app, 'POST', '/v1/contributions', {
      actor: ACTOR.capture,
      body: { speakerId: speaker.id, text },
    });
    expect(contribRes.status).toBe(201);
    const contribution = await contribRes.json();
    expectValid('captureContribution', 201, contribution);
    expect(contribution.coverage.coveredRatio).toBe(0);

    const sentences = text.split(/(?<=\?)\s*/).filter(Boolean);
    let cursor = 0;
    const captures = sentences.map((s) => {
      const start = text.indexOf(s, cursor);
      cursor = start + s.length;
      return { text: s.replace(/^[A-Za-zäöü]+:\s*/, ''), span: { start, end: start + s.length } };
    });
    const questionsRes = await req(app, 'POST', `/v1/contributions/${contribution.id}/questions`, {
      actor: ACTOR.capture,
      body: { questions: captures },
    });
    expect(questionsRes.status).toBe(201);
    const questions = await questionsRes.json();
    expectValid('captureQuestions', 201, questions);
    expect(questions).toHaveLength(7);

    const coverageRes = await req(app, 'GET', `/v1/contributions/${contribution.id}`, { actor: ACTOR.capture });
    const coveredContribution = await coverageRes.json();
    expectValid('getContribution', 200, coveredContribution);
    expect(coveredContribution.coverage.coveredRatio).toBeGreaterThan(0.95);

    const meetingAfterRes = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect((await meetingAfterRes.json()).counts.questions).toBe(807);

    const q = questions[0];
    expect(q._actions).toContain('question.classify');
    expect(q._actions).not.toContain('answer.draft');

    const classifyRes = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { track: 'expert_track', agendaItemId: 'top-2', stageAssignment: 'cfo' },
    });
    expect(classifyRes.status).toBe(200);
    expect(classifyRes.headers.get('ETag')).toBeTruthy();
    const classified = await classifyRes.json();
    expectValid('classifyQuestion', 200, classified);
    expect(classified.status).toBe('classified');

    const assignRes = await req(app, 'POST', `/v1/questions/${q.id}/assignment`, {
      actor: ACTOR.capture,
      headers: { 'If-Match': `"v${classified.version}"` },
      body: { unitId: 'unit-fin' },
    });
    expect(assignRes.status).toBe(200);
    const assigned = await assignRes.json();
    expectValid('assignQuestion', 200, assigned);
    expect(assigned.status).toBe('assigned');

    const draftRes = await req(app, 'POST', `/v1/questions/${q.id}/answers`, {
      actor: ACTOR.expert,
      body: { text: 'Die Quote lag bei 45 Prozent.', sources: ['Geschäftsbericht'] },
    });
    expect(draftRes.status).toBe(200);
    const drafted = await draftRes.json();
    expectValid('draftAnswer', 200, drafted);
    expect(drafted.answers).toHaveLength(1);

    const submitRes = await req(app, 'POST', `/v1/questions/${q.id}/review-submissions`, { actor: ACTOR.expert });
    expect(submitRes.status).toBe(200);
    const submitted = await submitRes.json();
    expectValid('submitForReview', 200, submitted);
    expect(submitted.status).toBe('in_review');
    expect(submitted._actions).not.toContain('question.approve');

    const rejectApprovalRes = await req(app, 'POST', `/v1/questions/${q.id}/approvals`, {
      actor: ACTOR.legal,
      body: { answerVersion: 99 },
    });
    expect(rejectApprovalRes.status).toBe(409);
    const rejectApprovalProblem = await rejectApprovalRes.json();
    expect(rejectApprovalProblem.ruleId).toBe('R-GUARD-04');

    const approveRes = await req(app, 'POST', `/v1/questions/${q.id}/approvals`, {
      actor: ACTOR.legal,
      body: { answerVersion: 1 },
    });
    expect(approveRes.status).toBe(200);
    const approved = await approveRes.json();
    expectValid('approveQuestion', 200, approved);
    expect(approved.status).toBe('approved');
    expect(approved.approval?.answerVersion).toBe(1);

    const stageRes = await req(app, 'POST', `/v1/questions/${q.id}/staging`, { actor: ACTOR.approver });
    expect(stageRes.status).toBe(200);
    const staged = await stageRes.json();
    expectValid('stageQuestion', 200, staged);
    expect(staged.status).toBe('staged');

    const stageViewRes = await req(app, 'GET', '/v1/stage', { actor: ACTOR.approver });
    const stageView = await stageViewRes.json();
    expectValid('getStage', 200, stageView);
    expect(stageView.queue.map((x: { id: string }) => x.id).concat(stageView.current?.id ?? [])).toContain(q.id);

    const deliverRes = await req(app, 'POST', `/v1/questions/${q.id}/delivery`, { actor: ACTOR.podium });
    expect(deliverRes.status).toBe(200);
    const delivered = await deliverRes.json();
    expectValid('deliverQuestion', 200, delivered);
    expect(delivered.status).toBe('delivered');

    const closeRes = await req(app, 'POST', `/v1/questions/${q.id}/closure`, { actor: ACTOR.podium });
    expect(closeRes.status).toBe(200);
    const closed = await closeRes.json();
    expectValid('closeQuestion', 200, closed);
    expect(closed.status).toBe('closed');
    expect(closed._actions).toEqual(['question.read']);

    const historyRes = await req(app, 'GET', `/v1/questions/${q.id}/history`, { actor: ACTOR.admin });
    expect(historyRes.status).toBe(200);
    const history = await historyRes.json();
    expectValid('getQuestionHistory', 200, history);
    expect(history.map((e: { type: string }) => e.type)).toEqual([
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

    const getQuestionRes = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.admin });
    expect(getQuestionRes.headers.get('ETag')).toBe(`"v${closed.version}"`);
    expectValid('getQuestion', 200, await getQuestionRes.json());
  });
});
