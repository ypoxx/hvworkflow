import { describe, expect, it } from 'vitest';
import { seedEvents } from '../seed.js';
import { project } from '../state.js';
import { QUESTION_STATUSES } from '../types.js';
import type { DomainEvent } from '../events.js';

describe('synthetic corpus', () => {
  const events = seedEvents({ questions: 800, seed: 2027, now: new Date('2027-04-20T13:30:00.000Z'), actor: { id: 'sys', role: 'admin' } });
  const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));

  it('produces exactly the requested number of questions', () => {
    expect(state.questions.size).toBe(800);
  });
  it('is deterministic', () => {
    const again = seedEvents({ questions: 800, seed: 2027, now: new Date('2027-04-20T13:30:00.000Z'), actor: { id: 'sys', role: 'admin' } });
    expect(again.map((e) => e.type + e.subjectId)).toEqual(events.map((e) => e.type + e.subjectId));
  });
  it('covers every workflow status that the afternoon scene needs', () => {
    const present = new Set([...state.questions.values()].map((q) => q.status));
    for (const s of ['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved', 'staged', 'delivered', 'closed']) {
      expect(present.has(s as (typeof QUESTION_STATUSES)[number])).toBe(true);
    }
    expect(state.meeting?.counts.staged).toBeGreaterThan(5);
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
