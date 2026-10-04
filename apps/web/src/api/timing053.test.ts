/**
 * Scheibe 053, Test 11 (decision 8): the filter change of the steering view at 800 questions, in-process path.
 *
 * The plan's gate "filter change p90 < 150 ms at 800" needs a load corpus in the interface and the gate of 084,
 * neither of which exists. Until then this measures what the browser does on a filter change, without the browser:
 * the service-side unit filter (`listQuestions({ limit: LIST_LIMIT, unitId })`, as `useBacklog` asks for it) plus the
 * status chip and the order applied in memory (`applyClientFilters`, the very function `useBacklog` calls). It lives in
 * `src/api` because only here may values be loaded from `@hv/domain` (rule `web-features-i18n-domain-types-only`).
 *
 * p90 < 150 ms is hard; p90 against 100 ms (D9, E41) is only reported in the log line.
 */
import { describe, expect, it } from 'vitest';
import {
  CORPUS_LOAD,
  createInMemoryEventStore,
  createInProcessApi,
  seedEvents,
  type Actor,
  type QuestionStatus,
} from '@hv/domain';
import { LIST_LIMIT, applyClientFilters } from '../features/answers/lib';

const WARMUP = 5;
const RUNS = 30;
const HARD_P90_MS = 150;
const D9_MS = 100;

const ADMIN: Actor = { id: 'u-admin', role: 'admin', displayName: 'Administration' };
const COORDINATION: Actor = { id: 'u-coord-1', role: 'coordination', displayName: 'Koordination' };

function p90(samples: readonly number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] ?? Number.NaN;
}

describe('timing 053: filter change of the steering view at 800 questions (in-process)', () => {
  it('p90 of unit filter (service) plus status chip and order (client) stays below 150 ms', async () => {
    const store = createInMemoryEventStore();
    let actor: Actor = ADMIN;
    // The clock is injected (AGENTS.md R8): a fixed afternoon of the meeting.
    const api = createInProcessApi({ store, actor: () => actor, clock: () => new Date('2026-06-15T15:00:00.000Z'), seeder: seedEvents });
    await api.seedDemo({ questions: CORPUS_LOAD.questions, roundSizes: CORPUS_LOAD.roundSizes, seed: CORPUS_LOAD.seed });
    actor = COORDINATION;

    const all = await api.listQuestions({ limit: LIST_LIMIT });
    expect(all.total).toBeGreaterThanOrEqual(CORPUS_LOAD.questions);
    const units = await api.listUnits();
    expect(units.length).toBeGreaterThan(1);
    const statuses: readonly (QuestionStatus | 'all')[] = ['all', 'captured', 'classified', 'assigned', 'in_review', 'approved'];
    const sorts = ['number', 'age'] as const;

    const once = async (i: number): Promise<number> => {
      const unit = units[i % units.length]!;
      const started = performance.now();
      const page = await api.listQuestions({ limit: LIST_LIMIT, unitId: unit.id });
      const rows = applyClientFilters(page.items, statuses[i % statuses.length]!, sorts[i % sorts.length]!);
      const elapsed = performance.now() - started;
      // The rows are real: every one belongs to the chosen unit.
      expect(rows.every((row) => row.unitId === unit.id)).toBe(true);
      return elapsed;
    };

    for (let i = 0; i < WARMUP; i++) await once(i);
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) samples.push(await once(WARMUP + i));

    const value = p90(samples);
    console.log(
      `[timing] 053 in-process filter p90 ${value.toFixed(1)} ms (D9 ${D9_MS} ms: ${value < D9_MS ? 'within' : 'above'}); ` +
        `median ${[...samples].sort((a, b) => a - b)[Math.floor(RUNS / 2)]!.toFixed(1)} ms, max ${Math.max(...samples).toFixed(1)} ms, ` +
        `${RUNS} runs after ${WARMUP} warm-up, ${all.total} questions`,
    );
    expect(value).toBeLessThan(HARD_P90_MS);
  }, 120_000);
});
