import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { ACTOR, req } from './helpers.ts';

const at = '2027-04-20T10:00:00.000Z';
const meetingId = 'hv-2027';
const actor = { id: 'fixture', role: 'admin' as const };
const secondCapture = 'capture-two:capture';
const secondExpert = 'expert-two:expert';

function fixture() {
  const source = createInMemoryEventStore();
  let events: DomainEvent[] = [...source.append([
    { id: 'meeting', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
    { id: 'speaker', type: 'SpeakerRegistered', at, actor, subjectId: 'speaker', meetingId,
      personId: 'person', payload: { number: 1, round: 1, position: 1,
        pii: { keyId: meetingId, displayName: 'Synthetische Person' } } },
    { id: 'contribution', type: 'ContributionCaptured', at, actor, subjectId: 'contribution', meetingId,
      payload: { speakerId: 'speaker', text: 'Eine Frage.', source: 'manual' } },
    { id: 'question', type: 'QuestionCaptured', at, actor, subjectId: 'question', meetingId,
      payload: { number: 'F-0001', contributionId: 'contribution', speakerId: 'speaker', text: 'Eine Frage.' } },
  ] as NewEvent[])];
  let now = Date.parse('2027-04-20T10:15:00.000Z');
  let id = 0;
  const app = createApp({ demoEnabled: true,
    persistence: { load: () => events, save: (next) => { events = [...next]; } },
    clock: () => new Date(now), idGenerator: () => `claim-${++id}` });
  return { app, events: () => events, advance: (milliseconds: number) => { now += milliseconds; } };
}

async function version(app: App, path: string, actorHeader: string): Promise<string> {
  const read = await req(app, 'GET', path, { actor: actorHeader });
  expect(read.status).toBe(200);
  const etag = read.headers.get('ETag');
  expect(etag).toMatch(/^"v\d+"$/);
  return etag!;
}

const contribution = '/v1/contributions/contribution';
const question = '/v1/questions/question';

describe('Scheibe 028: contribution and question claims over HTTP', () => {
  it.each([
    [contribution, ACTOR.capture, secondCapture],
    [question, ACTOR.expert, secondExpert],
  ])('takes, renews and releases %s with current ETags and the injected 10-minute clock', async (
    resource, holder, other,
  ) => {
    const { app, events, advance } = fixture();
    const claim = `${resource}/claim`;
    const release = `${resource}/release`;
    const startTag = await version(app, resource, holder);
    const before = events().length;
    const missing = await app.request(claim, { method: 'POST', headers: { 'X-Actor': holder } });
    expect(missing.status).toBe(428);
    expect(events()).toHaveLength(before);

    const first = await req(app, 'POST', claim, { actor: holder, headers: { 'If-Match': startTag } });
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { version: number; claim?: { actorId: string; expiresAt: string } };
    expect(firstBody.claim).toMatchObject({ actorId: holder.split(':')[0], expiresAt: '2027-04-20T10:25:00.000Z' });
    expect(first.headers.get('ETag')).toBe(`"v${firstBody.version}"`);
    expect(events().at(-1)?.type).toBe(resource === contribution ? 'ContributionClaimed' : 'QuestionClaimed');

    const stale = await req(app, 'POST', claim, { actor: other, headers: { 'If-Match': startTag } });
    expect(stale.status).toBe(412);
    const liveTag = first.headers.get('ETag')!;
    expect((await req(app, 'POST', claim, { actor: other, headers: { 'If-Match': liveTag } })).status).toBe(409);
    expect((await req(app, 'POST', release, { actor: other, headers: { 'If-Match': liveTag } })).status).toBe(409);

    advance(60_000);
    const renewed = await req(app, 'POST', claim, { actor: holder, headers: { 'If-Match': liveTag } });
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toMatchObject({ claim: { expiresAt: '2027-04-20T10:26:00.000Z' } });
    const renewedTag = renewed.headers.get('ETag')!;
    const released = await req(app, 'POST', release, { actor: holder, headers: { 'If-Match': renewedTag } });
    expect(released.status).toBe(200);
    expect((await released.json() as { claim?: unknown }).claim).toBeUndefined();
    expect(events().at(-1)?.type).toBe(resource === contribution ? 'ContributionReleased' : 'QuestionReleased');

    const reclaimed = await req(app, 'POST', claim, { actor: other, headers: { 'If-Match': released.headers.get('ETag')! } });
    expect(reclaimed.status).toBe(200);
    const writtenTag = reclaimed.headers.get('ETag')!;
    const count = events().length;
    advance(600_000);
    const expired = await req(app, 'GET', resource, { actor: holder });
    expect((await expired.json() as { claim?: unknown }).claim).toBeUndefined();
    expect(expired.headers.get('ETag')).toBe(writtenTag);
    expect(events()).toHaveLength(count);
    expect((await req(app, 'POST', release, { actor: other, headers: { 'If-Match': writtenTag } })).status).toBe(409);
    expect((await req(app, 'POST', claim, { actor: holder, headers: { 'If-Match': writtenTag } })).status).toBe(200);
  });

  it('keeps an authorized question write possible during another actor’s claim', async () => {
    const { app } = fixture();
    const tag = await version(app, question, ACTOR.expert);
    const held = await req(app, 'POST', `${question}/claim`, { actor: ACTOR.expert, headers: { 'If-Match': tag } });
    expect(held.status).toBe(200);
    const classified = await req(app, 'POST', `${question}/classification`, {
      actor: 'coord:coordination', headers: { 'If-Match': held.headers.get('ETag')! }, body: { track: 'podium' },
    });
    expect(classified.status).toBe(200);
  });

  it('enforces the explicit claim permissions before reporting resource versions', async () => {
    const { app, events } = fixture();
    const start = events().length;
    for (const actorHeader of [ACTOR.moderation, ACTOR.admin, ACTOR.observer, ACTOR.expert]) {
      expect((await req(app, 'POST', `${contribution}/claim`, { actor: actorHeader })).status, actorHeader).toBe(403);
    }
    for (const actorHeader of [ACTOR.moderation, ACTOR.admin, ACTOR.capture]) {
      expect((await req(app, 'POST', `${question}/claim`, { actor: actorHeader })).status, actorHeader).toBe(403);
    }
    expect((await req(app, 'POST', `${question}/claim`, { actor: ACTOR.observer })).status).toBe(404);
    expect((await req(app, 'POST', `${contribution}/claim`, {
      actor: ACTOR.capture, headers: { 'If-Match': '"v999"' },
    })).status).toBe(412);
    expect((await req(app, 'POST', `${question}/claim`, {
      actor: ACTOR.legal, headers: { 'If-Match': '"v999"' },
    })).status).toBe(412);
    expect(events()).toHaveLength(start);
  });
});
