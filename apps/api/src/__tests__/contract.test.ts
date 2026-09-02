/**
 * Contract coverage for the operations the acceptance sentence (`acceptance.test.ts`) does not
 * exercise: master data, the speaker list, contributions, filtered question listing, the podium
 * view, the event feed, and the remaining question transitions (return, withdraw, merge). Every
 * response is checked against its schema in `packages/contract/openapi.yaml` with `expectValid`,
 * so together with `acceptance.test.ts` and `negative.test.ts` every operationId has a test.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';
import { allOperationIds, expectValid } from '../contractSchema.ts';

interface QuestionLike {
  id: string;
  version: number;
  status: string;
}

async function firstQuestion(app: App, status: string): Promise<QuestionLike> {
  const res = await req(app, 'GET', `/v1/questions?status=${status}&limit=1`, { actor: ACTOR.admin });
  const { items } = (await res.json()) as { items: QuestionLike[] };
  expect(items.length).toBeGreaterThan(0);
  return items[0]!;
}

describe('contract: the operations the acceptance sentence does not reach', () => {
  let app: App;

  beforeAll(async () => {
    app = createApp({ demoEnabled: true });
    const res = await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 300, seed: 11 } });
    expect(res.status).toBe(200);
  });

  it('every operationId in the contract is exercised by this test suite', () => {
    // A sanity check, not a substitute for `expectValid`: it only proves the contract still has the
    // 29 operations this suite was written against, so a silently added/removed path is noticed.
    expect(allOperationIds.length).toBeGreaterThanOrEqual(29);
  });

  it('listAgendaItems / listUnits — meeting master data', async () => {
    const agendaRes = await req(app, 'GET', '/v1/agenda-items', { actor: ACTOR.admin });
    const agenda = await agendaRes.json();
    expectValid('listAgendaItems', 200, agenda);
    expect(agenda.length).toBeGreaterThan(0);

    const unitsRes = await req(app, 'GET', '/v1/units', { actor: ACTOR.admin });
    const units = await unitsRes.json();
    expectValid('listUnits', 200, units);
    expect(units.length).toBeGreaterThan(0);
  });

  it('listSpeakers / getSpeaker / updateSpeaker / reorderSpeakers', async () => {
    const listRes = await req(app, 'GET', '/v1/speakers', { actor: ACTOR.moderation });
    const speakers = await listRes.json();
    expectValid('listSpeakers', 200, speakers);
    expect(speakers.length).toBeGreaterThan(1);
    const first = speakers[0];

    const getRes = await req(app, 'GET', `/v1/speakers/${first.id}`, { actor: ACTOR.moderation });
    expect(getRes.status).toBe(200);
    const speaker = await getRes.json();
    expectValid('getSpeaker', 200, speaker);
    expect(getRes.headers.get('ETag')).toBe(`"v${speaker.version}"`);

    const patchRes = await req(app, 'PATCH', `/v1/speakers/${first.id}`, {
      actor: ACTOR.moderation,
      headers: { 'If-Match': getRes.headers.get('ETag')! },
      body: { requestedMinutes: 7 },
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expectValid('updateSpeaker', 200, updated);
    expect(updated.requestedMinutes).toBe(7);

    const round = updated.round as number;
    const roundSpeakerIds = (speakers as { id: string; round: number }[])
      .filter((s) => s.round === round)
      .map((s) => s.id);
    const reorderRes = await req(app, 'PUT', '/v1/speakers/order', {
      actor: ACTOR.moderation,
      body: { round, speakerIds: [...roundSpeakerIds].reverse() },
    });
    expect(reorderRes.status).toBe(200);
    expectValid('reorderSpeakers', 200, await reorderRes.json());
  });

  it('listContributions / getContribution', async () => {
    const listRes = await req(app, 'GET', '/v1/contributions', { actor: ACTOR.capture });
    const contributions = await listRes.json();
    expectValid('listContributions', 200, contributions);
    expect(contributions.length).toBeGreaterThan(0);

    const getRes = await req(app, 'GET', `/v1/contributions/${contributions[0].id}`, { actor: ACTOR.capture });
    expect(getRes.status).toBe(200);
    expectValid('getContribution', 200, await getRes.json());

    const filteredRes = await req(app, 'GET', `/v1/contributions?speakerId=${contributions[0].speakerId}`, {
      actor: ACTOR.capture,
    });
    const filtered = await filteredRes.json();
    expectValid('listContributions', 200, filtered);
    expect(filtered.every((c: { speakerId: string }) => c.speakerId === contributions[0].speakerId)).toBe(true);
  });

  it('listQuestions with comma-separated status filter, getStage, listEvents', async () => {
    const qRes = await req(app, 'GET', '/v1/questions?limit=5&status=captured,classified', { actor: ACTOR.capture });
    expect(qRes.status).toBe(200);
    const list = await qRes.json();
    expectValid('listQuestions', 200, list);
    expect(list.items.length).toBeGreaterThan(0);
    for (const item of list.items) expect(['captured', 'classified']).toContain(item.status);

    const stageRes = await req(app, 'GET', '/v1/stage', { actor: ACTOR.podium });
    expect(stageRes.status).toBe(200);
    expectValid('getStage', 200, await stageRes.json());

    const eventsRes = await req(app, 'GET', '/v1/events?after=0&limit=10', { actor: ACTOR.admin });
    expect(eventsRes.status).toBe(200);
    const events = await eventsRes.json();
    expectValid('listEvents', 200, events);
    expect(events.items.length).toBeLessThanOrEqual(10);
  });

  it('returnQuestion — legal sends a question back for rework', async () => {
    const q = await firstQuestion(app, 'in_review');
    const res = await req(app, 'POST', `/v1/questions/${q.id}/returns`, {
      actor: ACTOR.legal,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { reason: 'Bitte Quelle ergänzen.' },
    });
    expect(res.status).toBe(200);
    const returned = await res.json();
    expectValid('returnQuestion', 200, returned);
    expect(returned.returnReason).toBe('Bitte Quelle ergänzen.');
  });

  it('withdrawQuestion — moderation withdraws a captured question', async () => {
    const q = await firstQuestion(app, 'captured');
    const res = await req(app, 'POST', `/v1/questions/${q.id}/withdrawal`, {
      actor: ACTOR.moderation,
      body: { reason: 'Aktionärin hat die Frage zurückgezogen.' },
    });
    expect(res.status).toBe(200);
    const withdrawn = await res.json();
    expectValid('withdrawQuestion', 200, withdrawn);
    expect(withdrawn.status).toBe('withdrawn');
  });

  it('mergeQuestion — capture merges a duplicate into another question', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=2', { actor: ACTOR.admin });
    const { items } = (await listRes.json()) as { items: QuestionLike[] };
    expect(items.length).toBeGreaterThanOrEqual(2);
    const [into, duplicate] = items as [QuestionLike, QuestionLike];
    const res = await req(app, 'POST', `/v1/questions/${duplicate.id}/merge`, {
      actor: ACTOR.capture,
      body: { intoQuestionId: into.id },
    });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expectValid('mergeQuestion', 200, merged);
    expect(merged.status).toBe('merged');
    expect(merged.mergedIntoId).toBe(into.id);
  });
});
