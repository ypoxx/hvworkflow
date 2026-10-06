import { describe, expect, it } from 'vitest';
import { CORPUS_DEMO, CORPUS_LOAD, seedEvents } from '../seed.js';
import { project } from '../state.js';
import { QUESTION_STATUSES } from '../types.js';
import type { DomainEvent, NewEvent } from '../events.js';
import { createInProcessApi } from '../api.js';
import { computeCockpit } from '../cockpit.js';
import { isOpenStatus } from '../indicators.js';
import { createInMemoryEventStore } from '../store.js';

describe('synthetic corpus (CORPUS_LOAD)', () => {
  const events = seedEvents({ ...CORPUS_LOAD, now: new Date('2027-04-20T13:30:00.000Z'), actor: { id: 'sys', role: 'admin' } });
  const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));

  it('produces exactly the requested number of questions', () => {
    expect(CORPUS_LOAD.questions).toBe(800);
    expect(state.questions.size).toBe(CORPUS_LOAD.questions);
  });
  it('keeps speaker identity in a keyed PII envelope for this meeting', () => {
    const speakers = events.filter((event) => event.type === 'SpeakerRegistered') as Extract<DomainEvent, { type: 'SpeakerRegistered' }>[];
    expect(speakers).toHaveLength(118);
    for (const event of speakers) {
      expect(event.personId).toBeTruthy();
      expect(event.payload).not.toHaveProperty('displayName');
      expect(event.payload).not.toHaveProperty('organisation');
      expect(event.payload.pii).toEqual({
        keyId: event.meetingId,
        displayName: expect.any(String),
        ...(event.payload.pii?.organisation !== undefined ? { organisation: expect.any(String) } : {}),
      });
    }
  });
  it('does not reuse synthetic person IDs across meeting years', () => {
    const nextYear = seedEvents({ ...CORPUS_LOAD, now: new Date('2028-04-20T13:30:00.000Z'), actor: { id: 'sys', role: 'admin' } });
    const currentIds = new Set(events.filter((event) => event.type === 'SpeakerRegistered').map((event) => event.personId));
    const nextIds = nextYear.filter((event) => event.type === 'SpeakerRegistered').map((event) => event.personId);
    expect(nextIds.every((personId) => personId !== undefined && !currentIds.has(personId))).toBe(true);
  });
  it('is deterministic', () => {
    const again = seedEvents({ ...CORPUS_LOAD, now: new Date('2027-04-20T13:30:00.000Z'), actor: { id: 'sys', role: 'admin' } });
    expect(again.map((e) => e.type + e.subjectId)).toEqual(events.map((e) => e.type + e.subjectId));
  });
  it('covers every workflow status that the afternoon scene needs', () => {
    const present = new Set([...state.questions.values()].map((q) => q.status));
    for (const s of ['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved', 'staged', 'delivered', 'closed']) {
      expect(present.has(s as (typeof QUESTION_STATUSES)[number])).toBe(true);
    }
    // A short podium queue: reachable within a few presses, but never empty.
    expect(state.meeting?.counts.staged).toBeGreaterThanOrEqual(3);
    expect(state.meeting?.counts.staged).toBeLessThanOrEqual(12);
  });
  it('counts questions per status and the per-status counts add up to the total', () => {
    const by = state.meeting!.counts.byStatus;
    expect(Object.values(by).reduce((a, b) => a + b, 0)).toBe(CORPUS_LOAD.questions);
    expect(by.staged).toBe(state.meeting!.counts.staged);
  });
  it('keeps every question span inside its speech text', () => {
    for (const q of state.questions.values()) {
      const c = state.contributions.get(q.contributionId)!;
      expect(q.span).toBeDefined();
      expect(c.text.slice(q.span!.start, q.span!.end)).toBe(q.text);
    }
  });
  it('reports the round where the microphone is, not the last registered round', () => {
    const speaking = [...state.speakers.values()].find((s) => s.status === 'speaking')!;
    expect(state.meeting?.currentRound).toBe(speaking.round);
    expect(state.meeting?.currentRound).toBe(3);
  });
  it('has one speaker at the microphone and speakers waiting', () => {
    const statuses = [...state.speakers.values()].map((s) => s.status);
    expect(statuses.filter((s) => s === 'speaking')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'waiting').length).toBeGreaterThan(10);
  });
  it('timestamps never run ahead of now and are ordered', () => {
    for (let i = 1; i < events.length; i++) expect(events[i]!.at >= events[i - 1]!.at).toBe(true);
    expect(events[events.length - 1]!.at <= '2027-04-20T13:30:00.000Z').toBe(true);
  });
});

describe('synthetic corpus (CORPUS_DEMO)', () => {
  const now = new Date('2027-04-20T13:30:00.000Z');
  const actor = { id: 'sys', role: 'admin' } as const;
  const events = seedEvents({ ...CORPUS_DEMO, now, actor });
  const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));

  it('has exactly 28 speaker requests and 230 questions', () => {
    expect(CORPUS_DEMO.roundSizes.reduce((a, b) => a + b, 0)).toBe(28);
    expect(CORPUS_DEMO.roundSizes).toHaveLength(4);
    expect(state.speakers.size).toBe(28);
    expect(state.questions.size).toBe(230);
    expect(Object.values(state.meeting!.counts.byStatus).reduce((a, b) => a + b, 0)).toBe(230);
  });
  it('is deterministic', () => {
    const again = seedEvents({ ...CORPUS_DEMO, now, actor });
    expect(again).toEqual(events);
  });
  it('covers all nine workflow statuses', () => {
    const present = new Set([...state.questions.values()].map((q) => q.status));
    for (const s of ['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved', 'staged', 'delivered', 'closed']) {
      expect(present.has(s as (typeof QUESTION_STATUSES)[number])).toBe(true);
    }
  });
  it('has a short podium queue that is never empty', () => {
    expect(state.meeting?.counts.staged).toBeGreaterThanOrEqual(1);
    expect(state.meeting?.counts.staged).toBeLessThanOrEqual(8);
  });
  it('has one speaker at the microphone in round 3 and at least three waiting', () => {
    const speakers = [...state.speakers.values()];
    const speaking = speakers.filter((s) => s.status === 'speaking');
    expect(speaking).toHaveLength(1);
    expect(speaking[0]!.round).toBe(3);
    expect(state.meeting?.currentRound).toBe(3);
    expect(speakers.filter((s) => s.status === 'waiting').length).toBeGreaterThanOrEqual(3);
  });
  it('keeps every question span inside its speech text', () => {
    for (const q of state.questions.values()) {
      const c = state.contributions.get(q.contributionId)!;
      expect(c.text.slice(q.span!.start, q.span!.end)).toBe(q.text);
    }
  });
});

/* ---- takt-052: seed times compressed into the 90 minutes before now (docs/slices/takt-052-seed-zeiten.md) ---- */

const T052_NOW = new Date('2027-04-20T13:30:00.000Z');
const T052_ACTOR = { id: 'sys', role: 'admin' } as const;
const MINUTE_MS = 60_000;
const SPREAD_MS = 90 * MINUTE_MS;
// Age classes of `urgencyLevel` (apps/web/src/features/answers/lib.ts:147), not imported: apps/web is not
// a dependency of the domain. Under 15 min, 15 to under 45 min, from 45 min on.
const URGENCY_MEDIUM_FROM_MIN = 15;
const URGENCY_HIGH_FROM_MIN = 45;

type Drafted = Extract<DomainEvent, { type: 'AnswerDrafted' }>;
const drafted = (events: readonly NewEvent[]): Drafted[] => events.filter((e) => e.type === 'AnswerDrafted') as unknown as Drafted[];

describe('takt-052 Zeiten', () => {
  for (const [name, corpus] of [['CORPUS_DEMO', CORPUS_DEMO], ['CORPUS_LOAD', CORPUS_LOAD]] as const) {
    const events = seedEvents({ ...corpus, now: T052_NOW, actor: T052_ACTOR });
    const nowIso = T052_NOW.toISOString();

    it(`T1 ${name}: no event and no answer version lies after now; createdAt equals the event time`, () => {
      expect(events.filter((e) => e.at > nowIso)).toEqual([]);
      const answers = drafted(events);
      expect(answers.length).toBeGreaterThan(0);
      expect(answers.filter((e) => e.payload.answer.createdAt > nowIso).map((e) => e.id)).toEqual([]);
      expect(answers.filter((e) => e.payload.answer.createdAt !== e.at).map((e) => e.id)).toEqual([]);
    });

    it(`T2 ${name}: every capture lies in the 90 minutes before now, the first more than 80 minutes back`, () => {
      const captured = events.filter((e) => e.type === 'QuestionCaptured').map((e) => Date.parse(e.at));
      expect(captured).toHaveLength(corpus.questions);
      const from = T052_NOW.getTime() - SPREAD_MS;
      expect(captured.filter((t) => t < from || t > T052_NOW.getTime())).toEqual([]);
      expect(T052_NOW.getTime() - Math.min(...captured)).toBeGreaterThan(80 * MINUTE_MS);
    });
  }

  it('T3 CORPUS_DEMO: the inflow fills all twelve windows of the control desk', async () => {
    const store = createInMemoryEventStore();
    const api = createInProcessApi({ store, actor: () => T052_ACTOR, clock: () => T052_NOW, seeder: seedEvents });
    await api.seedDemo({ questions: CORPUS_DEMO.questions, seed: CORPUS_DEMO.seed });
    const log = store.all();
    const cockpit = computeCockpit(log, T052_NOW, log[0]!.meetingId!, () => true)!;
    expect(cockpit.inflow.bins.filter((n) => n === 0)).toEqual([]);
    expect(cockpit.inflow.bins).toEqual([11, 11, 10, 9, 14, 16, 16, 14, 8, 18, 18, 24]);
  });

  it('T4 CORPUS_DEMO: open questions carry many different ages and fill every urgency class', () => {
    const events = seedEvents({ ...CORPUS_DEMO, now: T052_NOW, actor: T052_ACTOR });
    const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));
    const ages = [...state.questions.values()].filter((q) => isOpenStatus(q.status))
      .map((q) => Math.floor((T052_NOW.getTime() - Date.parse(q.createdAt)) / MINUTE_MS));
    expect(new Set(ages).size).toBeGreaterThanOrEqual(30);
    expect(ages.filter((m) => m < URGENCY_MEDIUM_FROM_MIN).length).toBeGreaterThan(0);
    expect(ages.filter((m) => m >= URGENCY_MEDIUM_FROM_MIN && m < URGENCY_HIGH_FROM_MIN).length).toBeGreaterThan(0);
    expect(ages.filter((m) => m >= URGENCY_HIGH_FROM_MIN).length).toBeGreaterThan(0);
  });

  it('T5 edge cases: no questions and a single question seed without error, all times not after now', () => {
    for (const questions of [0, 1]) {
      const events = seedEvents({ ...CORPUS_DEMO, questions, now: T052_NOW, actor: T052_ACTOR });
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) expect(e.at <= T052_NOW.toISOString(), `${questions}: ${e.type} ${e.at}`).toBe(true);
      for (const e of drafted(events)) expect(e.payload.answer.createdAt <= T052_NOW.toISOString()).toBe(true);
    }
  });
});
