/**
 * The failure paths the contract documents: 401 (no/bad actor), 403 (role lacks the permission, and
 * the demo endpoint disabled), 409 (transition not allowed from the current status), 412 (stale
 * `If-Match`), 422 (validation), and idempotent replay (AGENTS.md rule 6 conventions).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';
import { expectValid } from './schema.ts';

describe('negative cases and idempotency', () => {
  let app: Hono;

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
    expect(body.status).toBe(401);
    expect(body.title).toBeTruthy();
  });

  it('401: malformed X-Actor header (no role)', async () => {
    const res = await req(app, 'GET', '/v1/questions?limit=1', { actor: 'just-an-id' });
    expect(res.status).toBe(401);
  });

  it('401: unknown role in X-Actor header', async () => {
    const res = await req(app, 'GET', '/v1/questions?limit=1', { actor: 'u1:superhero' });
    expect(res.status).toBe(401);
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
    expect(problem.ruleId).toBe('R-PERM-01');
  });

  it('403: POST /v1/demo/seed is refused unless HV_DEMO=1', async () => {
    const disabledApp = createApp({ demoEnabled: false });
    const res = await req(disabledApp, 'POST', '/v1/demo/seed', { actor: ACTOR.admin });
    expect(res.status).toBe(403);
    const problem = await res.json();
    expect(problem.status).toBe(403);
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
    expect(problem.status).toBe(422);
  });

  it('422: registering a speaker without a display name is rejected', async () => {
    const res = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.moderation,
      body: { displayName: '  ', kind: 'shareholder' },
    });
    expect(res.status).toBe(422);
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
});
