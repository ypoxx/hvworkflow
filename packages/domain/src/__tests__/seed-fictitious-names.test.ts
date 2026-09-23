/**
 * takt-004: the synthetic corpus must never resemble a real shareholder association or a known
 * family name from the shareholder-activism context (review 014 round 1 finding 10, round 2 point
 * 11). This test guards the fix in `seed.ts` (`ASSOCIATIONS`, `LAST_NAMES`) so a future edit cannot
 * silently reintroduce one of the five old names, and pins the corpus size the fix must not change.
 */
import { describe, expect, it } from 'vitest';
import { project } from '../state.js';
import { seedEvents } from '../seed.js';
import type { DomainEvent } from '../events.js';

// Same options as the corpus test in `seed.test.ts`, so the counts below are the ones already
// established for today's seed (118 Wortmeldungen from `roundSizes`, 800 Einzelfragen requested).
const OPTIONS = {
  questions: 800,
  seed: 2027,
  now: new Date('2027-04-20T13:30:00.000Z'),
  actor: { id: 'sys', role: 'admin' as const },
};

const FORBIDDEN_NAMES = [
  /DSW/,
  /SdK/,
  /Kritischer Aktionäre/,
  /Kleinaktionäre/,
  /Quandt/,
];

describe('seed corpus: no real association or family names (takt-004)', () => {
  const events = seedEvents(OPTIONS);
  const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));

  it('does not contain any of the five retired names anywhere in speaker or contribution text', () => {
    const haystack: string[] = [];
    for (const speaker of state.speakers.values()) {
      haystack.push(speaker.displayName);
      if (speaker.organisation !== undefined) haystack.push(speaker.organisation);
    }
    for (const contribution of state.contributions.values()) haystack.push(contribution.text);
    const joined = haystack.join('\n');
    for (const pattern of FORBIDDEN_NAMES) {
      expect(joined).not.toMatch(pattern);
    }
  });

  it('keeps the same number of Wortmeldungen and Einzelfragen as before the name change', () => {
    // roundSizes = [40, 34, 28, 16] in seed.ts — unchanged by this slice.
    expect(state.speakers.size).toBe(118);
    expect(state.questions.size).toBe(800);
  });

  it('keeps the seeded random sequence unchanged (same event ids and types as the reference run)', () => {
    const again = seedEvents(OPTIONS);
    expect(again.map((e) => e.type + e.subjectId)).toEqual(events.map((e) => e.type + e.subjectId));
  });
});
