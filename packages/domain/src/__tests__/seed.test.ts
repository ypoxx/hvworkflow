import { describe, expect, it } from 'vitest';
import { CORPUS_DEMO, CORPUS_LOAD, seedEvents } from '../seed.js';
import { project } from '../state.js';
import { QUESTION_STATUSES } from '../types.js';
import type { DomainEvent } from '../events.js';

describe('synthetic corpus (CORPUS_LOAD)', () => {
  const events = seedEvents({ ...CORPUS_LOAD, now: new Date('2027-04-20T13:30:00.000Z'), actor: { id: 'sys', role: 'admin' } });
  const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));

  it('produces exactly the requested number of questions', () => {
    expect(CORPUS_LOAD.questions).toBe(800);
    expect(state.questions.size).toBe(CORPUS_LOAD.questions);
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
