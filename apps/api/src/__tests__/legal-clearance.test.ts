import { beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../app.ts';
import { expectValid } from '../contractSchema.ts';
import { ACTOR, req } from './helpers.ts';

interface QuestionLike {
  id: string;
  version: number;
  status: string;
  legalClearance?: { answerVersion?: number; clearedBy: { id: string } };
}

async function firstQuestion(app: App, status: string): Promise<QuestionLike> {
  const res = await req(app, 'GET', `/v1/questions?status=${status}&limit=1`, { actor: ACTOR.admin });
  const { items } = (await res.json()) as { items: QuestionLike[] };
  expect(items.length).toBeGreaterThan(0);
  return items[0]!;
}

describe('Scheibe 021c: legal clearance HTTP operation', () => {
  let app: App;

  beforeAll(async () => {
    app = createApp({ demoEnabled: true });
    const seeded = await req(app, 'POST', '/v1/demo/seed', {
      actor: ACTOR.admin,
      body: { questions: 100, seed: 5 },
    });
    expect(seeded.status).toBe(200);
  });

  it('returns a contract-valid Question with clearance and accepts If-Match', async () => {
    const question = await firstQuestion(app, 'in_review');
    const res = await req(app, 'POST', `/v1/questions/${question.id}/legal-clearances`, {
      actor: ACTOR.legal,
      headers: { 'If-Match': `"v${question.version}"` },
      body: { answerVersion: 1, note: 'Geprüft.' },
    });
    expect(res.status).toBe(200);
    const cleared = (await res.json()) as QuestionLike;
    expectValid('clearQuestionLegally', 200, cleared);
    expect(cleared.status).toBe('in_review');
    expect(cleared.legalClearance?.answerVersion).toBe(1);
  });

  it('rejects expert with 403 and a stale version with 412', async () => {
    const question = await firstQuestion(app, 'in_review');
    const forbidden = await req(app, 'POST', `/v1/questions/${question.id}/legal-clearances`, {
      actor: ACTOR.expert,
      body: { answerVersion: 1 },
    });
    expect(forbidden.status).toBe(403);
    expectValid('clearQuestionLegally', 403, await forbidden.json(), 'application/problem+json');

    const stale = await req(app, 'POST', `/v1/questions/${question.id}/legal-clearances`, {
      actor: ACTOR.legal,
      headers: { 'If-Match': '"v999"' },
      body: { answerVersion: 1 },
    });
    expect(stale.status).toBe(412);
    expectValid('clearQuestionLegally', 412, await stale.json(), 'application/problem+json');
  });

  it('refuses staging an approved answer without legal clearance', async () => {
    const list = await req(app, 'GET', '/v1/questions?status=in_review&limit=100', { actor: ACTOR.admin });
    const { items } = (await list.json()) as { items: QuestionLike[] };
    const question = items.find((item) => item.legalClearance === undefined);
    expect(question).toBeDefined();
    const approved = await req(app, 'POST', `/v1/questions/${question!.id}/approvals`, {
      actor: ACTOR.approver,
      body: { answerVersion: 1 },
    });
    expect(approved.status).toBe(200);
    const res = await req(app, 'POST', `/v1/questions/${question!.id}/staging`, {
      actor: ACTOR.approver,
    });
    expect(res.status).toBe(409);
    const problem = await res.json();
    expectValid('stageQuestion', 409, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-GUARD-07');
  });
});
