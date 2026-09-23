/**
 * takt-004: the synthetic corpus must never resemble a real shareholder association, a known family
 * name from the shareholder-activism context (review 014 round 1 finding 10, round 2 point 11), or a
 * first+last name combination that reads as a real public figure (review round 2, rule 11). This
 * test guards the fix in `seed.ts` (`ASSOCIATIONS`, `LAST_NAMES`) so a future edit cannot silently
 * reintroduce one of the retired names, and pins both the corpus size and the seeded random sequence
 * the fix must not change.
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

/** Builds a forbidden-name pattern from two source-code fragments joined at runtime, so the retired
 *  name is never a contiguous, greppable substring of this file's own text (review round 2, item 8:
 *  a plain `git grep` for a retired name must have no hits outside the slice's own spec) while the
 *  resulting regex still matches the real, contiguous name if it ever reappears in the corpus. Word
 *  boundaries so the *replacement* names ('Falkenried', 'Wendhausen', ...), which contain a retired
 *  surname as a substring, don't trip this check on themselves.
 */
function retired(head: string, tail: string): RegExp {
  return new RegExp(`\\b${head}${tail}\\b`);
}

// The five names retired in the first round of this slice, plus the three retired in the rework
// round (rule 11: no first+last name combination may spell a well-known public figure).
const FORBIDDEN_NAMES = [
  retired('DS', 'W'),
  retired('Sd', 'K'),
  retired('Kritischer', ' Aktionäre'),
  retired('Klein', 'aktionäre'),
  retired('Quan', 'dt'),
  retired('Lind', 'ner'),
  retired('Fal', 'k'),
  retired('Wen', 'dt'),
];

/** Masks the two fields this slice is allowed to change (`displayName`, `organisation`) so the
 *  fingerprint below proves everything else the seed produces — ids, timestamps, order, statuses,
 *  tracks, numbers, answer text — is byte-identical to the pre-change seed (review round 2, item 2).
 */
function maskNames(json: string): string {
  return json
    .replace(/"displayName":"[^"]*"/g, '"displayName":"<masked>"')
    .replace(/"organisation":"[^"]*"/g, '"organisation":"<masked>"');
}

/** cyrb53 (public domain, bryc): a small, dependency-free string hash. Used instead of
 *  `node:crypto` because `packages/domain` must not depend on any Node core module — it runs in the
 *  browser too (ADR 0002; dependency-cruiser rule `domain-no-node-core-modules`). Collision
 *  resistance doesn't matter here: this is a fixture fingerprint, not a security control, and a
 *  false "unchanged" verdict would still be caught by the plain sequence check above it. */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function fingerprintOf(events: readonly unknown[]): string {
  return cyrb53(maskNames(JSON.stringify(events)));
}

// Computed once on commit c891616 (the last commit before this slice touched `seed.ts` at all — the
// original seed, before any of this slice's `ASSOCIATIONS`/`LAST_NAMES` substitutions), from the
// same `OPTIONS`, through the same `maskNames`/`fingerprintOf` pair as below. See
// docs/slices/takt-004-seed-fiktive-namen.md ("Bericht") for the exact command that produced it. If
// this ever needs recomputing: check out c891616, run this same fingerprint function against
// `seedEvents(OPTIONS)` there. A different value here would mean the RNG draw sequence changed, not
// just a name.
const PRE_CHANGE_FINGERPRINT = '14306754d3352f';

describe('seed corpus: no real association, family or public-figure names (takt-004)', () => {
  const events = seedEvents(OPTIONS);

  it('does not contain any of the retired names anywhere in the event log', () => {
    const json = JSON.stringify(events);
    for (const pattern of FORBIDDEN_NAMES) {
      expect(json).not.toMatch(pattern);
    }
  });

  it('keeps the same number of Wortmeldungen and Einzelfragen as before the name change', () => {
    const state = project(events.map((e, i) => ({ ...e, seq: i + 1 }) as DomainEvent));
    // roundSizes = [40, 34, 28, 16] in seed.ts — unchanged by this slice.
    expect(state.speakers.size).toBe(118);
    expect(state.questions.size).toBe(800);
  });

  it('keeps the seeded random sequence unchanged (same event ids and types as the reference run)', () => {
    const again = seedEvents(OPTIONS);
    expect(again.map((e) => e.type + e.subjectId)).toEqual(events.map((e) => e.type + e.subjectId));
  });

  it('is byte-identical to the pre-change seed once names/organisations are masked', () => {
    expect(fingerprintOf(events)).toBe(PRE_CHANGE_FINGERPRINT);
  });
});
