/**
 * Scheibe 054, Test 12: the cut of "Meine Fragen" per demo person, in-process. Seeds `CORPUS_DEMO` with an injected
 * clock, writes the demo's bindings (`DEMO_BINDINGS`) as the demo start does, and applies `myQuestions` to each person's
 * list — by `id`, never by role. The bound expert has the seven questions of Finanzen; everybody else has none. Without
 * the binding the expert would have the work of every unit (the control). It lives in `src/api` because only here may
 * values be loaded from `@hv/domain` (rule `web-features-i18n-domain-types-only`).
 *
 * At 800 questions the count is only reported (log line), not asserted.
 */
import { describe, expect, it } from 'vitest';
import {
  CORPUS_DEMO,
  CORPUS_LOAD,
  createInMemoryEventStore,
  createInProcessApi,
  seedEvents,
  type Actor,
  type Corpus,
  type HvApi,
} from '@hv/domain';
import { LIST_LIMIT } from '../features/answers/lib';
import { myQuestions } from '../features/focus/focus';
import { DEMO_ACTORS, DEMO_BINDINGS } from './actor';

const ADMIN_ID = 'u-admin';
const EXPERT_ID = 'u-exp-fin';
const PODIUM_ID = 'u-podium';
/** The observer reads only what was read out (`question.read.delivered`, slice 010): 130 of 230 on this seed. */
const READS: Readonly<Record<string, number>> = { [EXPERT_ID]: 35, 'u-obs': 130 };

function personById(id: string): Actor {
  const found = DEMO_ACTORS.find((actor) => actor.id === id);
  if (found === undefined) throw new Error(`No demo person ${id}.`);
  return found;
}

async function seeded(corpus: Corpus, bind: boolean): Promise<{ api: HvApi; as: (id: string) => void }> {
  let actor = personById(ADMIN_ID);
  // The clock is injected (AGENTS.md R8): a fixed afternoon of the meeting.
  const api = createInProcessApi({
    store: createInMemoryEventStore(),
    actor: () => actor,
    clock: () => new Date('2026-06-15T15:00:00.000Z'),
    seeder: seedEvents,
  });
  await api.seedDemo({ questions: corpus.questions, roundSizes: corpus.roundSizes, seed: corpus.seed });
  if (bind) for (const binding of DEMO_BINDINGS) await api.assignRole(binding);
  return { api, as: (id) => (actor = personById(id)) };
}

describe('Test 12: "Meine Fragen" per demo person (CORPUS_DEMO, bound as the demo start binds)', () => {
  it('the bound expert has exactly 7, all of Finanzen, and reads 35; every other person has none and reads 230 (observer 130)', async () => {
    const { api, as } = await seeded(CORPUS_DEMO, true);
    for (const person of DEMO_ACTORS) {
      as(person.id);
      if (person.id === PODIUM_ID) {
        // The podium does not read the list at all (R-PERM-02); the page shows its read state.
        await expect(api.listQuestions({ limit: LIST_LIMIT })).rejects.toMatchObject({ status: 403 });
        continue;
      }
      const page = await api.listQuestions({ limit: LIST_LIMIT });
      const mine = myQuestions(page.items);
      expect(page.items, person.id).toHaveLength(READS[person.id] ?? 230);
      if (person.id === EXPERT_ID) {
        expect(mine).toHaveLength(7);
        expect(mine.every((question) => question.unitId === 'unit-fin')).toBe(true);
      } else {
        expect(mine, person.id).toHaveLength(0);
      }
    }
  });

  it('control without the binding: the expert would have 40 from every unit', async () => {
    const { api, as } = await seeded(CORPUS_DEMO, false);
    as(EXPERT_ID);
    const mine = myQuestions((await api.listQuestions({ limit: LIST_LIMIT })).items);
    expect(mine).toHaveLength(40);
    expect(new Set(mine.map((question) => question.unitId)).size).toBeGreaterThan(1);
  });

  it('a second binding run answers 409 — the demo start passes over it', async () => {
    const { api } = await seeded(CORPUS_DEMO, true);
    for (const binding of DEMO_BINDINGS) {
      await expect(api.assignRole(binding)).rejects.toMatchObject({ status: 409 });
    }
  });

  it('at 800 questions (reported only)', async () => {
    const { api, as } = await seeded(CORPUS_LOAD, true);
    as(EXPERT_ID);
    const mine = myQuestions((await api.listQuestions({ limit: LIST_LIMIT })).items);
    console.log(`[size] 054 my questions at 800: ${mine.length}`);
    expect(mine.every((question) => question.unitId === 'unit-fin')).toBe(true);
  }, 60_000);
});
