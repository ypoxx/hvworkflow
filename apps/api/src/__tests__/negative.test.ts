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

// Classify and assign belong to coordination since slice 021b (helpers.ts is outside that slice's
// files, so the token lives here: `id:role` as in ACTOR).
const COORDINATION = 'coord:coordination';
async function speakerListTag(app: App): Promise<string> {
  return (await req(app, 'GET', '/v1/speakers', { actor: ACTOR.moderation })).headers.get('ETag')!;
}

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

  it('404: observer classifying a captured question is masked as not found, not 403 (Festlegung 3, slice 010)', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    // Observer holds neither `question.read` (captured is outside `question.read.delivered`'s
    // scope) nor `question.classify` — Festlegung 3's 404 precedence masks this exactly like an
    // unknown id, so a role without any read access cannot tell which ids exist.
    const res = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.observer,
      body: { track: 'podium' },
    });
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    const problem = await res.json();
    expectValid('classifyQuestion', 404, problem, 'application/problem+json');
    expectValidProblem(problem);
  });

  it('401: POST /v1/demo/seed without HV_DEMO=1 already fails at sign-in, before the demo check (slice 029a)', async () => {
    const disabledApp = createApp({ demoEnabled: false });
    const res = await req(disabledApp, 'POST', '/v1/demo/seed', { actor: ACTOR.admin });
    expect(res.status).toBe(401);
    const problem = await res.json();
    expectValidProblem(problem);
    expect(problem.status).toBe(401);
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
      actor: ACTOR.approver,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { answerVersion: 1 },
    });
    expect(res.status).toBe(409);
    const problem = await res.json();
    expectValid('approveQuestion', 409, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-TRANS-00');
  });

  it('409: legal clearing its own answer version is refused with ruleId R-GUARD-06 (Vier-Augen, slice 021c)', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=assigned&limit=200', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items.find((x: { track?: string }) => x.track !== undefined && x.track !== 'podium');
    expect(q).toBeDefined();

    const draftRes = await req(app, 'POST', `/v1/questions/${q.id}/answers`, {
      actor: ACTOR.legal, headers: { 'If-Match': `"v${q.version}"` }, body: { text: 'Entwurf von Recht.' },
    });
    expect(draftRes.status).toBe(200);
    const drafted = await draftRes.json();
    const submitRes = await req(app, 'POST', `/v1/questions/${q.id}/review-submissions`, {
      actor: ACTOR.expert, headers: { 'If-Match': `"v${drafted.version}"` },
    });
    expect(submitRes.status).toBe(200);

    const submitted = await submitRes.json();
    const res = await req(app, 'POST', `/v1/questions/${q.id}/legal-clearances`, {
      actor: ACTOR.legal, headers: { 'If-Match': `"v${submitted.version}"` }, body: { answerVersion: 1 },
    });
    expect(res.status).toBe(409);
    const problem = await res.json();
    expectValid('clearQuestionLegally', 409, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-GUARD-06');

    const after = await (await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.legal })).json();
    expect(after.status).toBe('in_review');
    expect(after._actions).not.toContain('question.approve');
    expect(after._actions).not.toContain('question.legal.clear');
  });

  it('412: a stale If-Match is a precondition failure and changes nothing', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const res = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: COORDINATION,
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
      headers: { 'If-Match': await speakerListTag(app) },
      body: { displayName: 'Leerprobe' },
    });
    const speaker = await speakerRes.json();
    const res = await req(app, 'POST', '/v1/contributions', {
      actor: ACTOR.capture,
      headers: { 'If-Match': `"v${speaker.version}"` },
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
      body: { displayName: '  ' },
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

  it('409: finished → speaking is refused by the speaker state table with ruleId R-SPK-00 (slice 080)', async () => {
    const created = await (
      await req(app, 'POST', '/v1/speakers', { actor: ACTOR.moderation,
        headers: { 'If-Match': await speakerListTag(app) }, body: { displayName: 'Zustandsprobe' } })
    ).json();
    let speakerVersion = created.version as number;
    for (const status of ['speaking', 'finished'] as const) {
      const ok = await req(app, 'PATCH', `/v1/speakers/${created.id}`, { actor: ACTOR.moderation,
        headers: { 'If-Match': `"v${speakerVersion}"` }, body: { status } });
      expect(ok.status).toBe(200);
      speakerVersion = (await ok.json()).version as number;
    }
    const res = await req(app, 'PATCH', `/v1/speakers/${created.id}`, {
      actor: ACTOR.moderation,
      headers: { 'If-Match': `"v${speakerVersion}"` },
      body: { status: 'speaking' },
    });
    expect(res.status).toBe(409);
    const problem = await res.json();
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-SPK-00');
  });

  // Contract 0.4.0 (slice 043a) removed `kind`: an unknown `kind` is ignored now, see contract-043a.test.ts.
  it('422: an out-of-enum status is rejected, not silently written', async () => {
    const speakerRes = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      headers: { 'If-Match': await speakerListTag(app) },
      body: { displayName: 'Fine' },
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

    // The server's own listing must never have accepted the bad value onto a stored resource.
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
      body: { displayName: 'Too Long a Key' },
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
      actor: COORDINATION,
      headers: { 'Idempotency-Key': key, 'If-Match': `"v${q.version}"` },
      body: { track: 'podium' },
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();

    const second = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: COORDINATION,
      headers: { 'Idempotency-Key': key, 'If-Match': `"v${q.version}"` },
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
      actor: COORDINATION,
      headers: { 'Idempotency-Key': key, 'If-Match': `"v${q.version}"` },
      body: { track: 'podium' },
    });
    expect(byA.status).toBe(200);
    const bodyA = await byA.json();
    expect(bodyA._actions).not.toContain('question.approve'); // coordination role: sanity on this actor's view

    // The same key replayed by an actor without the permission must be a fresh, denied request —
    // never a cached 200 carrying the classifying actor's `_actions`. `q` is now `classified`
    // (byA's own classification), outside observer's `question.read.delivered` scope, and observer
    // holds no `question.classify` either — 404, not 403 (Festlegung 3, "keine ableitbare ID").
    const byObserver = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.observer,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(byObserver.status).toBe(404);
    const observerProblem = await byObserver.json();
    expectValid('classifyQuestion', 404, observerProblem, 'application/problem+json');

    // The classifying actor replaying its own key still gets the original, unchanged result.
    const byAAgain = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: COORDINATION,
      headers: { 'Idempotency-Key': key, 'If-Match': `"v${q.version}"` },
      body: { track: 'podium' },
    });
    expect(byAAgain.status).toBe(200);
    expect(await byAAgain.json()).toEqual(bodyA);

    // Only the one classification actually happened: the observer's replay never appended an event.
    const after = await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json();
    expect(after.lastSeq).toBe(before.lastSeq + 1);
  });

  // Rework round after review, point 6: restore write-permission-denial coverage that the 403 -> 404
  // changes above (Festlegung 3) removed from this file — using actors who *can* read the question,
  // so these two are real 403s, never the 404 mask.

  // Slice 021b (review R1): capture reads every question but lost question.classify and
  // question.assign to coordination — both are real 403s over HTTP, never the 404 mask.
  it('403: capture may read a captured question but classifying it is a real R-PERM-01, version unchanged', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const q = (await listRes.json()).items[0];

    const getRes = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.capture });
    expect(getRes.status).toBe(200); // capture holds question.read — proves the 403 below is not the 404 mask

    const res = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.capture,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { track: 'expert_track' },
    });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('classifyQuestion', 403, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-PERM-01');

    const after = await (await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.admin })).json();
    expect(after.version).toBe(q.version);
    expect(after.status).toBe('captured');
  });

  it('403: capture may read a classified question but assigning it is a real R-PERM-01, version unchanged', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=classified&limit=1', { actor: ACTOR.admin });
    const q = (await listRes.json()).items[0];

    const getRes = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.capture });
    expect(getRes.status).toBe(200);

    const res = await req(app, 'POST', `/v1/questions/${q.id}/assignment`, {
      actor: ACTOR.capture,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { unitId: 'unit-fin' },
    });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('assignQuestion', 403, problem, 'application/problem+json');
    expectValidProblem(problem);
    expect(problem.ruleId).toBe('R-PERM-01');

    const after = await (await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.admin })).json();
    expect(after.version).toBe(q.version);
    expect(after.status).toBe('classified');
  });

  it('403: observer may read a delivered question but returning it is a real R-PERM-01, not the 404 mask', async () => {
    const deliveredRes = await req(app, 'GET', '/v1/questions?status=delivered&limit=1', { actor: ACTOR.admin });
    const q = (await deliveredRes.json()).items[0];

    const getRes = await req(app, 'GET', `/v1/questions/${q.id}`, { actor: ACTOR.observer });
    expect(getRes.status).toBe(200); // in scope — proves the 403 below is not the 404 mask

    const res = await req(app, 'POST', `/v1/questions/${q.id}/returns`, {
      actor: ACTOR.observer,
      body: { reason: 'nicht zulässig' },
    });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expectValid('returnQuestion', 403, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-PERM-01');
  });

  it('403: an actor who can read the question but lacks the permission gets a real R-PERM-01 on idempotency replay, not a cached success', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const { items } = await listRes.json();
    const q = items[0];

    const key = `expert-replay-${q.id}`;
    const byCoordination = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: COORDINATION,
      headers: { 'Idempotency-Key': key, 'If-Match': `"v${q.version}"` },
      body: { track: 'podium' },
    });
    expect(byCoordination.status).toBe(200);

    // expert holds unrestricted question.read (so the now-`classified` question is not the 404 mask)
    // but not question.classify: the permission is re-checked fresh on this replay, not skipped
    // because coordination's key already produced a 200.
    const byExpert = await req(app, 'POST', `/v1/questions/${q.id}/classification`, {
      actor: ACTOR.expert,
      headers: { 'Idempotency-Key': key },
      body: { track: 'podium' },
    });
    expect(byExpert.status).toBe(403);
    const problem = await byExpert.json();
    expectValid('classifyQuestion', 403, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-PERM-01');
  });

  // Scheibe 040a, Test 10 (T-G1-E-01: the operations called directly, past the interface): the
  // administration writes no content, still reads, and cannot assign a role to itself.
  it('403/409: admin over HTTP — content writes are R-PERM-01, reading works, self-assignment is R-ADM-07 (Scheibe 040a)', async () => {
    const pick = async (status: string) => {
      const listed = await req(app, 'GET', `/v1/questions?status=${status}&limit=1`, { actor: ACTOR.admin });
      expect(listed.status).toBe(200);
      return (await listed.json()).items[0] as { id: string; version: number; answers: { version: number }[] };
    };
    const assigned = await pick('assigned');
    const inReview = await pick('in_review');
    const staged = await pick('staged');
    const writes: [string, string, Record<string, string>, unknown][] = [
      ['registerSpeaker', '/v1/speakers', { 'If-Match': await speakerListTag(app) }, { displayName: 'Admin 040a' }],
      ['draftAnswer', `/v1/questions/${assigned.id}/answers`, { 'If-Match': `"v${assigned.version}"` }, { text: 'Antwort der Administration.', sources: [] }],
      ['approveQuestion', `/v1/questions/${inReview.id}/approvals`, { 'If-Match': `"v${inReview.version}"` },
        { answerVersion: inReview.answers.at(-1)?.version ?? 1 }],
      ['deliverQuestion', `/v1/questions/${staged.id}/delivery`, { 'If-Match': `"v${staged.version}"` }, undefined],
    ];
    for (const [operation, path, headers, body] of writes) {
      const before = (await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json()).lastSeq;
      const res = await req(app, 'POST', path, { actor: ACTOR.admin, headers, ...(body !== undefined ? { body } : {}) });
      expect(res.status, operation).toBe(403);
      const problem = await res.json();
      expectValid(operation, 403, problem, 'application/problem+json');
      expect(problem.ruleId, operation).toBe('R-PERM-01');
      expect((await (await req(app, 'GET', '/v1/events?limit=1', { actor: ACTOR.admin })).json()).lastSeq, operation).toBe(before);
    }

    expect((await req(app, 'GET', '/v1/questions?limit=1', { actor: ACTOR.admin })).status).toBe(200);

    const meetingId = (await (await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin })).json()).id as string;
    const adminId = ACTOR.admin.split(':')[0]!;
    const self = await req(app, 'POST', `/v1/meetings/${meetingId}/role-assignments`, {
      actor: ACTOR.admin, body: { subjectId: adminId, role: 'approver' },
    });
    expect(self.status).toBe(409);
    const conflict = await self.json();
    expectValid('assignRole', 409, conflict, 'application/problem+json');
    expect(conflict.ruleId).toBe('R-ADM-07');
  });
});
