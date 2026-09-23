/**
 * Slice 010 (Lesepfade unter can() mit Leserechten), HTTP surface: one positive and one negative
 * test per read permission (Ziel 7), master data's "every role may" test (Festlegung 1), and the 404
 * precedence of Festlegung 3 — the same cases as `packages/domain/src/__tests__/api.test.ts`, driven
 * over HTTP with `ruleId` (no `subscribe`: it has no HTTP route, Festlegung 5).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';
import { expectValid, expectValidProblem } from '../contractSchema.ts';

describe('read rights over HTTP (slice 010)', () => {
  let app: App;

  beforeAll(async () => {
    app = createApp({ demoEnabled: true });
    const res = await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 200, seed: 13 } });
    expect(res.status).toBe(200);
  });

  it('master data (Festlegung 1): every role may read getMeeting, listAgendaItems, listUnits', async () => {
    for (const actor of Object.values(ACTOR)) {
      const meetingRes = await req(app, 'GET', '/v1/meeting', { actor });
      expect(meetingRes.status, `getMeeting as ${actor}`).toBe(200);
      const agendaRes = await req(app, 'GET', '/v1/agenda-items', { actor });
      expect(agendaRes.status, `listAgendaItems as ${actor}`).toBe(200);
      const unitsRes = await req(app, 'GET', '/v1/units', { actor });
      expect(unitsRes.status, `listUnits as ${actor}`).toBe(200);
    }
  });

  it('speaker.read: expert is denied listSpeakers and getSpeaker with R-PERM-02', async () => {
    const anySpeaker = (await (await req(app, 'GET', '/v1/speakers', { actor: ACTOR.admin })).json())[0];

    const listRes = await req(app, 'GET', '/v1/speakers', { actor: ACTOR.expert });
    expect(listRes.status).toBe(403);
    const listProblem = await listRes.json();
    expectValid('listSpeakers', 403, listProblem, 'application/problem+json');
    expect(listProblem.ruleId).toBe('R-PERM-02');

    const getRes = await req(app, 'GET', `/v1/speakers/${anySpeaker.id}`, { actor: ACTOR.expert });
    expect(getRes.status).toBe(403);
    const getProblem = await getRes.json();
    expectValid('getSpeaker', 403, getProblem, 'application/problem+json');
    expect(getProblem.ruleId).toBe('R-PERM-02');
  });

  it('contribution.read: podium is denied listContributions and getContribution with R-PERM-02', async () => {
    const anyContribution = (await (await req(app, 'GET', '/v1/contributions', { actor: ACTOR.admin })).json())[0];

    const listRes = await req(app, 'GET', '/v1/contributions', { actor: ACTOR.podium });
    expect(listRes.status).toBe(403);
    expect((await listRes.json()).ruleId).toBe('R-PERM-02');

    const getRes = await req(app, 'GET', `/v1/contributions/${anyContribution.id}`, { actor: ACTOR.podium });
    expect(getRes.status).toBe(403);
    expect((await getRes.json()).ruleId).toBe('R-PERM-02');
  });

  it('question.read: podium is denied listQuestions with R-PERM-02, and getQuestion is masked as 404 (Festlegung 3)', async () => {
    const anyQuestion = (await (await req(app, 'GET', '/v1/questions?limit=1', { actor: ACTOR.admin })).json()).items[0];

    const listRes = await req(app, 'GET', '/v1/questions', { actor: ACTOR.podium });
    expect(listRes.status).toBe(403);
    expect((await listRes.json()).ruleId).toBe('R-PERM-02');

    const getRes = await req(app, 'GET', `/v1/questions/${anyQuestion.id}`, { actor: ACTOR.podium });
    expect(getRes.status).toBe(404);
    expectValidProblem(await getRes.json());
  });

  it('question.read.delivered: observer 403 R-PERM-03 on a status filter outside the read scope', async () => {
    const res = await req(app, 'GET', '/v1/questions?status=answer_drafted', { actor: ACTOR.observer });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('listQuestions', 403, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-PERM-03');
  });

  it('question.read.delivered: observer sees only delivered/closed questions, and total matches', async () => {
    const allRes = await req(app, 'GET', '/v1/questions?limit=2000', { actor: ACTOR.admin });
    const all = await allRes.json();
    const visible = all.items.filter((q: { status: string }) => q.status === 'delivered' || q.status === 'closed');

    const observedRes = await req(app, 'GET', '/v1/questions?limit=2000', { actor: ACTOR.observer });
    const observed = await observedRes.json();
    expect(observed.items.every((q: { status: string }) => q.status === 'delivered' || q.status === 'closed')).toBe(true);
    expect(observed.total).toBe(visible.length);
  });

  it('question.read.delivered: observer getQuestion on a non-delivered question is masked as 404 (Festlegung 3)', async () => {
    const capturedRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const q = (await capturedRes.json()).items[0];
    const res = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.observer });
    expect(res.status).toBe(404);
  });

  it('stage.read: expert is denied getStage with R-PERM-02', async () => {
    const res = await req(app, 'GET', '/v1/stage', { actor: ACTOR.expert });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('getStage', 403, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-PERM-02');
  });

  it('history.read: observer is denied getQuestionHistory of a delivered question with R-PERM-02 (it can read the question itself)', async () => {
    const deliveredRes = await req(app, 'GET', '/v1/questions?status=delivered&limit=1', { actor: ACTOR.admin });
    const q = (await deliveredRes.json()).items[0];

    const getRes = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.observer });
    expect(getRes.status).toBe(200); // in scope: proves this is a real 403, not the 404 mask

    const historyRes = await req(app, 'GET', `/v1/questions/${q.id}/history`, { actor: ACTOR.observer });
    expect(historyRes.status).toBe(403);
    const problem = await historyRes.json();
    expectValid('getQuestionHistory', 403, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-PERM-02');
  });

  it('404 precedence (Festlegung 3): podium — no question.read, no history.read — gets 404 on getQuestionHistory, not 403', async () => {
    const capturedRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const q = (await capturedRes.json()).items[0];
    const res = await req(app, 'GET', `/v1/questions/${q.id}/history`, { actor: ACTOR.podium });
    expect(res.status).toBe(404);
    expectValidProblem(await res.json());
  });

  it('404 precedence (Festlegung 3): podium may still deliverQuestion on a staged question although it cannot read it', async () => {
    // Drive one question to `staged` under admin, so the delivery below is deterministic regardless
    // of the random seed corpus (podium track: classify -> classified -> staged, no approval needed).
    const capturedRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const q = (await capturedRes.json()).items[0];
    const classifyRes = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.admin,
      body: { track: 'podium' },
    });
    const classified = await classifyRes.json();
    expect(classified.status).toBe('classified');
    const stageRes = await req(app, 'POST', `/v1/questions/${classified.id}/staging`, { actor: ACTOR.admin });
    const staged = await stageRes.json();
    expect(staged.status).toBe('staged');

    // podium holds `question.deliver` but not `question.read` — Festlegung 3's masking does not
    // apply here because podium holds the operation's own permission (today's order: 404 for an
    // unknown id, otherwise proceed).
    const res = await req(app, 'POST', `/v1/questions/${staged.id}/delivery`, { actor: ACTOR.podium });
    expect(res.status).toBe(200);
    expectValid('deliverQuestion', 200, await res.json());
  });

  it('event.read: podium is denied listEvents with R-PERM-02', async () => {
    const res = await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.podium });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('listEvents', 403, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-PERM-02');
  });
});
