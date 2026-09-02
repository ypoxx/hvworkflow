/**
 * The failure paths the contract documents: 401 (no/bad actor), 403 (role lacks the permission, and
 * the demo endpoint disabled), 404 (unknown resource), 409 (transition not allowed from the current
 * status), 412 (stale `If-Match`), 422 (validation — including wrongly-typed and out-of-enum bodies,
 * per the rework review's major 4), and idempotent replay scoped to the actor and the operation
 * (rework review blocker 3 — `packages/domain/src/api.ts` rule R-IDEM-01). Every problem body is
 * checked against the contract's shared `Problem` schema, not just field-by-field.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';
import { expectValid, expectValidProblem } from '../contractSchema.ts';

describe('negative cases and idempotency', () => {
  let app: App;

  beforeAll(async () => {
    app = createApp({ demoEnabled: true });
    const res = await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 100, seed: 5 } });
    expect(res.status).toBe(200);
  });

  it('401: missing X-Actor header', async () => {
    const res = await req(app, 'GET', '/v1/questions?limit=1');
    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    const body = await res.json();
    expectValidProblem(body);
    expect(body.status).toBe(401);
    expect(body.title).toBeTruthy();
  });

  it('401: malformed X-Actor header (no role)', async () => {
    const res = await req(app, 'GET', '/v1/questions?limit=1', { actor: 'just-an-id' });
    expect(res.status).toBe(401);
    expectValidProblem(await res.json());
  });

  it('401: unknown role in X-Actor header', async () => {
    const res = await req(app, 'GET', '/v1/questions?limit=1', { actor: 'u1:superhero' });
    expect(res.status).toBe(401);
    expectValidProblem(await res.json());
  });

  it('403: observer may read but not classify (deny reason carries a rule id)', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const res = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.observer,
      body: { track: 'podium' },
    });
    expect(res.status).toBe(403);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    const problem = await res.json();
    expectValid('classifyQuestion', 403, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-PERM-01');
  });

  it('403: POST /v1/demo/seed is refused unless HV_DEMO=1', async () => {
    const disabledApp = createApp({ demoEnabled: false });
    const res = await req(disabledApp, 'POST', '/v1/demo/seed', { actor: ACTOR.admin });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('seedDemo', 403, problem, 'application/problem+json');
    expect(problem.status).toBe(403);
  });

  it('404: an unknown question, speaker and contribution are all reported as Not found', async () => {
    const questionRes = await req(app, 'GET', '/v1/questions/does-not-exist', { actor: ACTOR.admin });
    expect(questionRes.status).toBe(404);
    const questionProblem = await questionRes.json();
    expectValid('getQuestion', 404, questionProblem, 'application/problem+json');
    expectValidProblem(questionProblem);

    const speakerRes = await req(app, 'GET', '/v1/speakers/does-not-exist', { actor: ACTOR.admin });
    expect(speakerRes.status).toBe(404);
    const speakerProblem = await speakerRes.json();
    expectValid('getSpeaker', 404, speakerProblem, 'application/problem+json');
    expectValidProblem(speakerProblem);

    const contributionRes = await req(app, 'GET', '/v1/contributions/does-not-exist', { actor: ACTOR.admin });
    expect(contributionRes.status).toBe(404);
    const contributionProblem = await contributionRes.json();
    expectValidProblem(contributionProblem);
  });

  it('409: approving a captured question (wrong transition) is a conflict', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const res = await req(app, 'POST', `/v1/questions/${q.id}/approvals`, {
      actor: ACTOR.legal,
      body: { answerVersion: 1 },
    });
    expect(res.status).toBe(409);
    const problem = await res.json();
    expectValid('approveQuestion', 409, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-TRANS-00');
  });

  it('412: a stale If-Match is a precondition failure and changes nothing', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const res = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'If-Match': '"v999"' },
      body: { track: 'podium' },
    });
    expect(res.status).toBe(412);
    const problem = await res.json();
    expectValid('classifyQuestion', 412, problem, 'application/problem+json');
    expectValidProblem(problem);

    const unchanged = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.admin });
    expect((await unchanged.json()).status).toBe('captured');
  });

  it('422: capturing a contribution with blank text is rejected', async () => {
    const speakerRes = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      body: { displayName: 'Leerprobe', kind: 'shareholder' },
    });
    const speaker = await speakerRes.json();
    const res = await req(app, 'POST', '/v1/contributions', {
      actor: ACTOR.capture,
      body: { speakerId: speaker.id, text: '   ' },
    });
    expect(res.status).toBe(422);
    const problem = await res.json();
    expectValid('captureContribution', 422, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.status).toBe(422);
  });

  it('422: registering a speaker without a display name is rejected', async () => {
    const res = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      body: { displayName: '  ', kind: 'shareholder' },
    });
    expect(res.status).toBe(422);
    expectValidProblem(await res.json());
  });

  it('422: a wrongly-typed body is rejected against the contract before it reaches the domain', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=assigned&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const cases: { path: string; actor: string; body: unknown }[] = [
      { path: `/v1/questions/${q.id}/answers`, actor: ACTOR.expert, body: { text: 123 } },
      { path: `/v1/questions/${q.id}/returns`, actor: ACTOR.legal, body: { reason: 123 } },
      { path: `/v1/questions/${q.id}/withdrawal`, actor: ACTOR.moderation, body: { reason: 123 } },
      { path: '/v1/contributions', actor: ACTOR.capture, body: { speakerId: 'sp-1', text: 123 } },
      { path: '/v1/contributions/does-not-matter/questions', actor: ACTOR.capture, body: { questions: [{ text: 123 }] } },
    ];
    for (const { path, actor, body } of cases) {
      const res = await req(app, 'POST', path, { actor, body });
      expect(res.status, `${path} with ${JSON.stringify(body)}`).toBe(422);
      const problem = await res.json();
      expectValidProblem(problem);
      expect(problem.status).toBe(422);
    }
  });

  it('422: an out-of-enum kind or status is rejected, not silently written', async () => {
    const badKind = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      body: { displayName: 'Bogus Kind', kind: 'space-alien' },
    });
    expect(badKind.status).toBe(422);
    const badKindProblem = await badKind.json();
    expectValid('registerSpeaker', 422, badKindProblem, 'application/problem+json');
    expectValidProblem(badKindProblem);
    expect(badKindProblem.detail).toContain('kind');

    const speakerRes = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      body: { displayName: 'Fine', kind: 'shareholder' },
    });
    const speaker = await speakerRes.json();
    const badStatus = await req(app, 'PATCH', `/v1/speakers/${speaker.id}`, {
      actor: ACTOR.moderation,
      body: { status: 'teleported' },
    });
    expect(badStatus.status).toBe(422);
    const badStatusProblem = await badStatus.json();
    expectValid('updateSpeaker', 422, badStatusProblem, 'application/problem+json');
    expect(badStatusProblem.detail).toContain('status');

    // The server's own listing must never have accepted either bad value onto a stored resource.
    const listRes = await req(app, 'GET', '/v1/speakers', { actor: ACTOR.admin });
    expectValid('listSpeakers', 200, await listRes.json());
  });

  it('422: an out-of-range or out-of-enum query parameter is rejected, not clamped', async () => {
    const tooLarge = await req(app, 'GET', '/v1/questions?limit=99999', { actor: ACTOR.admin });
    expect(tooLarge.status).toBe(422);
    expectValidProblem(await tooLarge.json());

    const badEnum = await req(app, 'GET', '/v1/questions?status=nonsense', { actor: ACTOR.admin });
    expect(badEnum.status).toBe(422);
    expectValidProblem(await badEnum.json());
  });

  it('422: an Idempotency-Key over 128 characters is rejected', async () => {
    const res = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      headers: { 'Idempotency-Key': 'k'.repeat(129) },
      body: { displayName: 'Too Long a Key', kind: 'shareholder' },
    });
    expect(res.status).toBe(422);
    expectValidProblem(await res.json());
  });

  it('idempotent replay returns the same body and does not append a second event', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const before = await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json();

    const key = `idem-${q.id}`;
    const first = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(second.status).toBe(200);
    const secondBody = await second.json();

    expect(secondBody).toEqual(firstBody);

    const after = await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json();
    expect(after.lastSeq).toBe(before.lastSeq + 1);
  });

  it('idempotent replay is scoped to the actor (rework review blocker 3, domain rule R-IDEM-01)', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const before = await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json();

    const key = `cross-actor-${q.id}`;
    const byA = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(byA.status).toBe(200);
    const bodyA = await byA.json();
    expect(bodyA._actions).not.toContain('question.approve'); // capture role: sanity on this actor's view

    // The same key replayed by an actor without the permission must be a fresh, denied request —
    // never a cached 200 carrying the classifying actor's `_actions`.
    const byObserver = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.observer,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(byObserver.status).toBe(403);
    const observerProblem = await byObserver.json();
    expectValid('classifyQuestion', 403, observerProblem, 'application/problem+json');
    expect(observerProblem.ruleId).toBe('R-PERM-01');

    // The classifying actor replaying its own key still gets the original, unchanged result.
    const byAAgain = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(byAAgain.status).toBe(200);
    expect(await byAAgain.json()).toEqual(bodyA);

    // Only the one classification actually happened: the observer's replay never appended an event.
    const after = await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json();
    expect(after.lastSeq).toBe(before.lastSeq + 1);
  });
});
