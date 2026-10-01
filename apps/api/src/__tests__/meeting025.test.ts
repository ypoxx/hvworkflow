import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';

const actor = { id: 'fixture', role: 'admin' as const };
const at = '2027-04-20T10:00:00.000Z';

function fixture() {
  const source = createInMemoryEventStore();
  source.append([
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [{ id: 'top-1', number: 1, title: 'Aussprache' }], units: [] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} } as unknown as NewEvent,
    { id: 'speaker-1', type: 'SpeakerRegistered', at, actor, subjectId: 'speaker-1', meetingId: 'hv-2027',
      payload: { number: 1, displayName: 'Testperson', round: 1, position: 1 } },
  ]);
  let events = [...source.all()];
  const persistence = {
    load: () => events,
    save: (next: readonly typeof events[number][]) => { events = [...next]; },
  };
  return { persistence, events: () => events };
}

describe('Scheibe 025: kanonische Jahrgangsrouten', () => {
  it('keeps canonical year reads separate and the alias on the latest meeting', async () => {
    const source = createInMemoryEventStore();
    source.append([
      { id: 'create-2026', type: 'MeetingCreated', at, actor, subjectId: 'hv-2026', meetingId: 'hv-2026',
        payload: { title: 'HV 2026', date: '2026-04-20', agendaItems: [], units: [] } },
      { id: 'start-2026', type: 'MeetingStarted', at, actor, subjectId: 'hv-2026', meetingId: 'hv-2026', payload: {} },
      { id: 'old-speaker', type: 'SpeakerRegistered', at, actor, subjectId: 'old-speaker', meetingId: 'hv-2026',
        payload: { number: 1, displayName: 'Alte Testperson', round: 1, position: 1 } },
      { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027',
        payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] } },
      { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} },
      { id: 'new-speaker', type: 'SpeakerRegistered', at, actor, subjectId: 'new-speaker', meetingId: 'hv-2027',
        payload: { number: 1, displayName: 'Neue Testperson', round: 1, position: 1 } },
    ]);
    let events = [...source.all()];
    const app = createApp({ demoEnabled: true, persistence: {
      load: () => events, save: (next) => { events = [...next]; },
    } });
    const old = await req(app, 'GET', '/v1/meetings/hv-2026/speakers', { actor: ACTOR.admin });
    expect((await old.json() as { id: string }[]).map((s) => s.id)).toEqual(['old-speaker']);
    const current = await req(app, 'GET', '/v1/meetings/hv-2027/speakers', { actor: ACTOR.admin });
    expect((await current.json() as { id: string }[]).map((s) => s.id)).toEqual(['new-speaker']);
    const alias = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(await alias.json()).toMatchObject({ id: 'hv-2027', counts: { speakers: 1 } });
    const foreign = await req(app, 'GET', '/v1/meetings/missing/speakers', { actor: ACTOR.admin });
    expect(foreign.status).toBe(404);
    const foreignContributionFilter = await req(app, 'GET', '/v1/meetings/hv-2027/contributions?speakerId=old-speaker', { actor: ACTOR.admin });
    expect(foreignContributionFilter.status).toBe(404);
    const foreignQuestionFilter = await req(app, 'GET', '/v1/meetings/hv-2027/questions?speakerId=old-speaker', { actor: ACTOR.admin });
    expect(foreignQuestionFilter.status).toBe(404);
  });

  it('exercises all canonical readers, speaker writes and agenda transitions against the contract', async () => {
    const { persistence } = fixture();
    const app = createApp({ demoEnabled: true, persistence,
      clock: () => new Date('2027-04-20T10:15:00.000Z'), idGenerator: (() => {
        let next = 0;
        return () => `new-${++next}`;
      })() });
    const base = '/v1/meetings/hv-2027';
    for (const path of ['/agenda-items', '/units', '/speakers', '/contributions', '/questions', '/stage']) {
      const response = await req(app, 'GET', `${base}${path}`, { actor: ACTOR.admin });
      expect(response.status, path).toBe(200);
    }
    const listTag = (await req(app, 'GET', `${base}/speakers`, { actor: ACTOR.admin })).headers.get('ETag')!;
    // Scheibe 040a: speaker writes are moderation's, capture is capture's; admin keeps the agenda.
    const registered = await req(app, 'POST', `${base}/speakers`, {
      actor: ACTOR.moderation, headers: { 'If-Match': listTag },
      body: { displayName: 'Zweite Testperson', round: 1 },
    });
    expect(registered.status).toBe(201);
    const speaker = await registered.json() as { id: string; version: number };
    const speakerId = speaker.id;
    const reordered = await req(app, 'PUT', `${base}/speakers/order`, {
      actor: ACTOR.moderation, headers: { 'If-Match': registered.headers.get('ETag')! },
      body: { round: 1, speakerIds: [speakerId, 'speaker-1'] },
    });
    expect(reordered.status).toBe(200);
    const currentSpeaker = await req(app, 'GET', `/v1/speakers/${speakerId}`, { actor: ACTOR.admin });
    const captured = await req(app, 'POST', `${base}/contributions`, {
      actor: ACTOR.capture, headers: { 'If-Match': currentSpeaker.headers.get('ETag')! },
      body: { speakerId, text: 'Redeinhalt', source: 'manual' },
    });
    expect(captured.status).toBe(201);
    for (const [suffix, expectedField] of [
      ['/opening', 'openedAt'],
      ['/voting/opening', 'votingOpenedAt'],
      ['/voting/closure', 'votingClosedAt'],
    ] as const) {
      const response = await req(app, 'POST', `${base}/agenda-items/top-1${suffix}`, { actor: ACTOR.admin });
      expect(response.status).toBe(200);
      expect(response.headers.get('ETag')).toMatch(/^"v\d+"$/);
      expect(await response.json()).toHaveProperty(expectedField, '2027-04-20T10:15:00.000Z');
    }
  });

  it('lists and reads the correct Jahrgang with an ETag', async () => {
    const { persistence } = fixture();
    const app = createApp({ demoEnabled: true, persistence });
    const list = await req(app, 'GET', '/v1/meetings', { actor: ACTOR.admin });
    expect(list.status).toBe(200);
    expect((await list.json() as { id: string }[]).map((m) => m.id)).toEqual(['hv-2027']);
    const get = await req(app, 'GET', '/v1/meetings/hv-2027', { actor: ACTOR.admin });
    expect(get.status).toBe(200);
    expect(get.headers.get('ETag')).toMatch(/^"v\d+"$/);
  });

  it('rejects ordinary capture after synthetic DebateClosed and accepts grounded paper', async () => {
    const { persistence, events } = fixture();
    const extra = createInMemoryEventStore({ load: persistence.load, save: persistence.save });
    extra.append([{ id: 'debate-close', type: 'DebateClosed', at: '2027-04-20T11:00:00.000Z', actor,
      subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} } as unknown as NewEvent]);
    expect(events()).toHaveLength(4);
    const app = createApp({ demoEnabled: true, persistence,
      clock: () => new Date('2027-04-20T11:05:00.000Z') });
    const speakerTag = (await req(app, 'GET', '/v1/speakers/speaker-1', { actor: ACTOR.capture })).headers.get('ETag')!;
    const manual = await req(app, 'POST', '/v1/meetings/hv-2027/contributions', {
      actor: ACTOR.capture, headers: { 'If-Match': speakerTag },
      body: { speakerId: 'speaker-1', text: 'Später Text', source: 'manual' },
    });
    expect(manual.status).toBe(409);
    expect(await manual.json()).toMatchObject({ ruleId: 'R-MTG-03' });
    const paper = await req(app, 'POST', '/v1/meetings/hv-2027/contributions', {
      actor: ACTOR.capture,
      headers: { 'If-Match': speakerTag },
      body: { speakerId: 'speaker-1', text: 'Papiertext', source: 'paper',
        occurredAt: '2027-04-20T10:30:00.000Z', occurredAtSource: 'paper', lateEntryReason: 'Papierbogen nachgetragen' },
    });
    expect(paper.status).toBe(201);
    expect(await paper.json()).toMatchObject({ meetingId: 'hv-2027', lateEntry: true, source: 'paper' });
    expect(events().at(-1)).toMatchObject({ type: 'ContributionCaptured', meetingId: 'hv-2027', payload: { lateEntry: true, lateEntryReason: 'Papierbogen nachgetragen' } });
  });
});
