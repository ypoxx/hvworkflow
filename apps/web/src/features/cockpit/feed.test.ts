/**
 * Scheibe 061 (part B, fix round): how the page turns results of the feed into what it shows.
 * - W11 at page level (review R3): the live region announces a change to "kritisch" once, clears while nothing new is
 *   critical, and announces again after a calm phase — even with the identical text.
 * - Review R4: after a refusal the feed stops reading (no interval, no change-driven reads) until a new feed starts for
 *   another actor; every read of a refused person would be one more line in the access log (MF-17).
 */
import { describe, expect, it, vi } from 'vitest';
import type { Cockpit } from '../../api/cockpit';
import { COCKPIT_THRESHOLDS } from '../../api/cockpit';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { applyResult, INITIAL_READING, startCockpitFeed } from './feed';
import type { CockpitResult, ReadingState } from './feed';
import { cockpitFixture, UNITS } from './fixtures';

const de = (key: TKey, params?: TParams) => translate('de', key, params);
const at = (ageSeconds: number): Cockpit =>
  cockpitFixture({ oldestOpen: { ageSeconds, items: [] }, legalReview: { over10m: 0, items: [] }, openByUnit: {}, openUnassigned: 0 });

describe('W11 at page level: one announcement per change to critical', () => {
  it('announces, clears while it stays critical or calm, and announces the same text again after a calm phase', () => {
    const critical = COCKPIT_THRESHOLDS.oldestOpenSeconds.critical;
    const sequence = [at(600), at(critical), at(critical + 15), at(600), at(critical)];
    const shown: string[] = [];
    let state: ReadingState = INITIAL_READING;
    for (const cockpit of sequence) {
      state = applyResult(state, { status: 'ready', cockpit }, de, UNITS);
      shown.push(state.announcement);
    }
    const text = `Leitstand: Älteste offene Einzelfrage kritisch, über ${critical / 60} min`;
    expect(shown).toEqual(['', text, '', '', text]);
  });

  it('a passing error keeps the figures; a refusal replaces them and forgets the previous reading', () => {
    let state = applyResult(INITIAL_READING, { status: 'ready', cockpit: at(600) }, de, UNITS);
    state = applyResult(state, { status: 'error', ruleId: 'R-X' }, de, UNITS);
    expect(state.read.status).toBe('ready');
    state = applyResult(state, { status: 'forbidden' }, de, UNITS);
    expect(state.read).toEqual({ status: 'forbidden' });
    expect(state.previous).toBeNull();
    expect(applyResult(INITIAL_READING, { status: 'error', ruleId: 'R-X' }, de, UNITS).read).toEqual({ status: 'error', ruleId: 'R-X' });
  });
});

describe('R4: no reads after a refusal', () => {
  it('stops the interval and ignores ticks, changes and refreshes once the read was refused', async () => {
    const ticks: Array<() => void> = [];
    let change: (() => void) | undefined;
    const cleared: number[] = [];
    const read = vi.fn(async (): Promise<Cockpit> => {
      throw Object.assign(new Error('403'), { status: 403, ruleId: 'R-PERM-02' });
    });
    const results: CockpitResult[] = [];
    const feed = startCockpitFeed({
      read,
      onResult: (result) => results.push(result),
      subscribe: (listener) => { change = listener; return () => undefined; },
      timers: { setInterval: (fn) => { ticks.push(fn); return 7; }, clearInterval: (id) => { cleared.push(id); } },
      visibility: { hidden: () => false, subscribe: () => () => undefined },
    });
    await vi.waitFor(() => expect(results).toEqual([{ status: 'forbidden' }]));
    expect(cleared).toEqual([7]);
    ticks[0]!();
    change!();
    feed.refresh();
    await Promise.resolve();
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    feed.stop();
  });
});
