/**
 * Scheibe 061 (part B): the pure helpers of the control desk (Leitstand). W1 (levels and the one pattern of accessible
 * names), W2 (inflow geometry), W3 (backlog order and scale), W6 (thread entries), W8 (Escape closes the thread first,
 * then the list) and W11 (one announcement when a figure turns critical).
 */
import { describe, expect, it } from 'vitest';
import { COCKPIT_THRESHOLDS } from '../../api/cockpit';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { cockpitFixture, UNITS } from './fixtures';
import {
  announcementFor,
  backlogScale,
  durationParts,
  escapeTarget,
  formatDuration,
  groupByStation,
  inflowBars,
  INFLOW_GEOMETRY,
  levelText,
  listName,
  parseSelection,
  rowsFromQuestions,
  selectionSearch,
  settleThread,
  threadEntries,
  unitRows,
} from './lib';

const de = (key: TKey, params?: TParams) => translate('de', key, params);
const en = (key: TKey, params?: TParams) => translate('en', key, params);
const T = COCKPIT_THRESHOLDS;

describe('durations (minutes, from 100 min hours and minutes)', () => {
  it('floors seconds to whole minutes and switches to "h min" at 100 minutes', () => {
    expect(durationParts(59)).toEqual([{ value: 0, unit: 'min' }]);
    expect(durationParts(3000)).toEqual([{ value: 50, unit: 'min' }]);
    expect(durationParts(99 * 60 + 59)).toEqual([{ value: 99, unit: 'min' }]);
    expect(durationParts(100 * 60)).toEqual([{ value: 1, unit: 'h' }, { value: 40, unit: 'min' }]);
    expect(durationParts(-5)).toEqual([{ value: 0, unit: 'min' }]);
    expect(formatDuration(de, 840)).toBe('14 min');
    expect(formatDuration(de, 20469)).toBe('5 h 41 min');
  });
});

describe('W1 levels: calm without text; elevated and critical with word and threshold from COCKPIT_THRESHOLDS', () => {
  it('oldest open question: thresholds in minutes, equal is the higher level', () => {
    expect(levelText(de, 'oldestOpen', T.oldestOpenSeconds.attention - 1)).toBeUndefined();
    expect(levelText(de, 'oldestOpen', T.oldestOpenSeconds.attention)).toEqual({
      level: 'attention', text: `erhöht · über ${T.oldestOpenSeconds.attention / 60} min`,
    });
    expect(levelText(de, 'oldestOpen', T.oldestOpenSeconds.critical)).toEqual({
      level: 'critical', text: `kritisch · über ${T.oldestOpenSeconds.critical / 60} min`,
    });
    expect(levelText(en, 'oldestOpen', T.oldestOpenSeconds.critical)?.text).toBe(`critical · over ${T.oldestOpenSeconds.critical / 60} min`);
  });

  it('legal clearing over 10 min, unit and "no unit" backlog: "ab n"', () => {
    expect(levelText(de, 'legalReviewOver10m', T.legalReviewOver10m.attention - 1)).toBeUndefined();
    expect(levelText(de, 'legalReviewOver10m', T.legalReviewOver10m.attention)?.text).toBe(`erhöht · ab ${T.legalReviewOver10m.attention}`);
    expect(levelText(de, 'legalReviewOver10m', T.legalReviewOver10m.critical)?.text).toBe(`kritisch · ab ${T.legalReviewOver10m.critical}`);
    expect(levelText(de, 'unitBacklog', T.unitBacklog.attention)?.text).toBe(`erhöht · ab ${T.unitBacklog.attention}`);
    expect(levelText(de, 'unassignedBacklog', T.unitBacklog.critical)?.text).toBe(`kritisch · ab ${T.unitBacklog.critical}`);
    expect(levelText(en, 'unitBacklog', T.unitBacklog.attention)?.text).toBe(`elevated · from ${T.unitBacklog.attention}`);
  });

  it('"no final status yet" is elevated only after the close of the debate; inflow and stage never', () => {
    expect(levelText(de, 'openTotal', 47)).toBeUndefined();
    expect(levelText(de, 'openTotal', 47, { debateClosed: true })?.text).toBe('erhöht · nach Debattenschluss');
    expect(levelText(de, 'openTotal', 0, { debateClosed: true })).toBeUndefined();
    expect(levelText(de, 'inflow', 500)).toBeUndefined();
    expect(levelText(de, 'staged', 500)).toBeUndefined();
  });

  it('one pattern for every accessible name: "Liste öffnen: {label}, {count}[, {level}]"', () => {
    expect(listName(de, 'Ohne Endstatus', 47)).toBe('Liste öffnen: Ohne Endstatus, 47');
    expect(listName(de, 'Im Legal Clearing über 10 min', 6, levelText(de, 'legalReviewOver10m', 6)))
      .toBe(`Liste öffnen: Im Legal Clearing über 10 min, 6, erhöht · ab ${T.legalReviewOver10m.attention}`);
    expect(listName(en, 'No final status yet', 47)).toBe('Open the list: No final status yet, 47');
  });
});

describe('W2 inflow: 12 bars in 280 × 48, baseline 0, scale max(…, 5)', () => {
  it('places 12 bars of 18 px with 5 px gaps inside the box, the newest marked', () => {
    const { bars, scale } = inflowBars([2, 3, 0, 5, 3, 2, 1, 2, 3, 2, 1, 3]);
    expect(INFLOW_GEOMETRY).toEqual({ width: 280, height: 48, bar: 18, gap: 5 });
    expect(bars).toHaveLength(12);
    expect(scale).toBe(5);
    for (const bar of bars) {
      expect(bar.width).toBe(18);
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(280);
      // Baseline at 0: every bar stands on the bottom edge.
      expect(bar.y + bar.height).toBe(48);
    }
    for (let i = 1; i < 12; i++) expect(bars[i]!.x - bars[i - 1]!.x).toBe(23);
    expect(bars.map((bar) => bar.latest)).toEqual([...Array.from({ length: 11 }, () => false), true]);
    expect(bars[3]!.height).toBe(48); // 5 of scale 5
    expect(bars[2]).toMatchObject({ empty: true, height: 1 }); // an empty window is a 1 px line
  });

  it('the scale never drops below 5, and grows with the largest window', () => {
    expect(inflowBars(Array.from({ length: 12 }, () => 0)).scale).toBe(5);
    expect(inflowBars([...Array.from({ length: 11 }, () => 1), 215]).scale).toBe(215);
    const small = inflowBars([...Array.from({ length: 11 }, () => 0), 1]).bars[11]!;
    expect(small.height).toBeGreaterThanOrEqual(2); // a value above 0 is never a hairline
  });
});

describe('W3 backlog per unit: order, "no unit" last, scale and threshold marker', () => {
  it('sorts by count descending, then by name; "no unit" last with the same thresholds', () => {
    const rows = unitRows(cockpitFixture({ openByUnit: { 'unit-fin': 23, 'unit-hr': 9, 'unit-esg': 9, 'unit-gone': 2 } }), UNITS);
    expect(rows.map((row) => row.name)).toEqual(['Finanzen', 'ESG', 'Personal', 'unit-gone', '']);
    expect(rows.map((row) => row.count)).toEqual([23, 9, 9, 2, 5]);
    expect(rows[0]).toMatchObject({ id: 'unit-fin', level: 'attention' });
    expect(rows.at(-1)).toMatchObject({ id: 'none', unassigned: true, level: 'calm' });
    const crowded = unitRows(cockpitFixture({ openUnassigned: T.unitBacklog.critical }), UNITS);
    expect(crowded.at(-1)).toMatchObject({ id: 'none', level: 'critical' });
  });

  it('the scale is max(largest, critical threshold), so the marker sits at elevated / scale', () => {
    expect(backlogScale(unitRows(cockpitFixture(), UNITS))).toBe(T.unitBacklog.critical);
    expect(backlogScale(unitRows(cockpitFixture({ openByUnit: { 'unit-fin': 80 } }), UNITS))).toBe(80);
  });
});

describe('drill-down state in the URL', () => {
  it('reads and writes list, station, unit and question', () => {
    expect(parseSelection(new URLSearchParams(''))).toBeNull();
    expect(parseSelection(new URLSearchParams('list=bogus'))).toBeNull();
    expect(parseSelection(new URLSearchParams('list=legal&q=q-141'))).toEqual({ list: 'legal', q: 'q-141' });
    expect(parseSelection(new URLSearchParams('list=open&station=in_review'))).toEqual({ list: 'open', station: 'in_review' });
    expect(parseSelection(new URLSearchParams('list=open&station=delivered'))).toEqual({ list: 'open' });
    expect(parseSelection(new URLSearchParams('list=unit&unit=none'))).toEqual({ list: 'unit', unit: 'none' });
    expect(parseSelection(new URLSearchParams('list=unit'))).toBeNull();
    expect(selectionSearch({ list: 'unit', unit: 'unit-fin', q: 'q-1' })).toBe('?list=unit&unit=unit-fin&q=q-1');
    expect(selectionSearch(null)).toBe('');
  });

  it('W8: Escape closes the thread first, then the list', () => {
    expect(escapeTarget({ list: 'legal', q: 'q-141' })).toEqual({ list: 'legal' });
    expect(escapeTarget({ list: 'open', station: 'assigned' })).toBeNull();
    expect(escapeTarget(null)).toBeNull();
  });
});

describe('list rows from listQuestions: age against asOf of the same reading, grouped by station', () => {
  const asOf = '2026-06-15T13:42:10.000Z';
  const q = (id: string, status: string, createdAt: string, unitId?: string) =>
    ({ id, number: id.toUpperCase(), status, createdAt, ...(unitId !== undefined ? { unitId } : {}) }) as never;
  const questions = [
    q('f-1', 'assigned', '2026-06-15T13:00:00.000Z', 'unit-fin'),
    q('f-2', 'captured', '2026-06-15T13:38:00.000Z'),
    q('f-3', 'in_review', '2026-06-15T12:50:00.000Z', 'unit-hr'),
    q('f-4', 'captured', '2026-06-15T13:43:00.000Z'), // after asOf: age 0, never negative
  ];

  it('ages are max(0, asOf − createdAt), oldest first', () => {
    const rows = rowsFromQuestions(questions, asOf, { list: 'open' });
    expect(rows.map((row) => [row.number, row.ageSeconds])).toEqual([
      ['F-3', 3130], ['F-1', 2530], ['F-2', 250], ['F-4', 0],
    ]);
  });

  it('inflow keeps ages up to 300 s; "no unit" keeps rows without a unit', () => {
    expect(rowsFromQuestions(questions, asOf, { list: 'inflow' }).map((row) => row.number)).toEqual(['F-2', 'F-4']);
    expect(rowsFromQuestions(questions, asOf, { list: 'unit', unit: 'none' }).map((row) => row.number)).toEqual(['F-2', 'F-4']);
  });

  it('groups by station in display order', () => {
    const groups = groupByStation(rowsFromQuestions(questions, asOf, { list: 'open' }));
    expect(groups.map((group) => [group.status, group.rows.map((row) => row.number)])).toEqual([
      ['captured', ['F-2', 'F-4']], ['assigned', ['F-1']], ['in_review', ['F-3']],
    ]);
  });
});

describe('W6 thread entries: past with time, current with "since", future without time', () => {
  const asOf = '2026-06-15T13:42:00.000Z';
  const trail = [
    { status: 'captured' as const, at: '2026-06-15T12:53:00.000Z' },
    { status: 'classified' as const, at: '2026-06-15T12:58:00.000Z' },
    { status: 'assigned' as const, at: '2026-06-15T13:02:00.000Z' },
    { status: 'answer_drafted' as const, at: '2026-06-15T13:10:00.000Z' },
    { status: 'in_review' as const, at: '2026-06-15T13:18:00.000Z' },
  ];

  it('marks the last entry current with its age, then the stations not yet reached up to "read out"', () => {
    const entries = threadEntries(trail, 'in_review', asOf);
    expect(entries.map((entry) => [entry.status, entry.state])).toEqual([
      ['captured', 'past'], ['classified', 'past'], ['assigned', 'past'], ['answer_drafted', 'past'],
      ['in_review', 'current'], ['approved', 'future'], ['staged', 'future'], ['delivered', 'future'],
    ]);
    expect(entries[4]!.sinceSeconds).toBe(24 * 60);
    expect(entries.filter((entry) => entry.state === 'future').every((entry) => entry.at === undefined)).toBe(true);
  });

  it('a return is its own entry; without history only the current station', () => {
    const returned = [...trail, { status: 'answer_drafted' as const, at: '2026-06-15T13:30:00.000Z' }];
    const entries = threadEntries(returned, 'answer_drafted', asOf);
    expect(entries.filter((entry) => entry.status === 'answer_drafted').map((entry) => entry.state)).toEqual(['past', 'current']);
    expect(entries.slice(-4).map((entry) => [entry.status, entry.state])).toEqual([
      ['in_review', 'future'], ['approved', 'future'], ['staged', 'future'], ['delivered', 'future'],
    ]);
    expect(entries.map((entry) => entry.state).filter((state) => state === 'current')).toHaveLength(1);
    expect(threadEntries(null, 'assigned', asOf)).toEqual([{ status: 'assigned', state: 'current' }]);
  });
});

describe('W11 one polite announcement when a figure turns critical', () => {
  const calm = cockpitFixture({ oldestOpen: { ageSeconds: 600, items: [] }, legalReview: { over10m: 0, items: [] } });
  const critical = cockpitFixture({ oldestOpen: { ageSeconds: T.oldestOpenSeconds.critical, items: [] }, legalReview: { over10m: 0, items: [] } });
  const elevated = cockpitFixture({ oldestOpen: { ageSeconds: T.oldestOpenSeconds.attention, items: [] }, legalReview: { over10m: 0, items: [] } });

  it('a change to critical gives exactly one announcement; staying critical none; a change to elevated none', () => {
    expect(announcementFor(de, calm, critical, UNITS)).toBe(
      `Leitstand: Älteste offene Einzelfrage kritisch, über ${T.oldestOpenSeconds.critical / 60} min`,
    );
    expect(announcementFor(de, critical, { ...critical, asOf: '2026-06-15T13:42:25.000Z' }, UNITS)).toBeNull();
    expect(announcementFor(de, calm, elevated, UNITS)).toBeNull();
    // The first reading of the page is no change.
    expect(announcementFor(de, null, critical, UNITS)).toBeNull();
  });

  it('units and legal clearing count as figures of their own; several at once stay one announcement', () => {
    const both = cockpitFixture({
      oldestOpen: { ageSeconds: 600, items: [] },
      legalReview: { over10m: T.legalReviewOver10m.critical, items: [] },
      openByUnit: { 'unit-fin': T.unitBacklog.critical, 'unit-hr': 0, 'unit-esg': 0 },
    });
    const text = announcementFor(de, calm, both, UNITS) ?? '';
    expect(text.match(/Leitstand:/g)).toHaveLength(1);
    expect(text).toContain('Legal Clearing über 10 min');
    expect(text).toContain('Rückstand Finanzen');
  });
});

describe('Codex P2: a failed history read is a failed thread, never the "no history right" state', () => {
  const question = { status: 'fulfilled', value: { id: 'q-1', status: 'in_review' } } as const;
  const history = { status: 'fulfilled', value: [] } as const;
  const refused = { status: 'rejected', reason: { status: 403, ruleId: 'R-PERM-02' } } as const;
  const broken = { status: 'rejected', reason: { status: 503, ruleId: 'R-PERSIST-01' } } as const;

  it('question read, history broken (network, 5xx): failed with the rule of the history read', () => {
    expect(settleThread('q-1', question, broken)).toMatchObject({ failed: true, ruleId: 'R-PERSIST-01', trail: null });
  });

  it('history refused (no history.read): not failed, the thread shows only the current station', () => {
    expect(settleThread('q-1', question, refused)).toMatchObject({ failed: false, trail: null });
  });

  it('question refused, history read: not failed, no text; question broken: failed', () => {
    expect(settleThread('q-1', refused, history)).toMatchObject({ failed: false, question: null, trail: [] });
    expect(settleThread('q-1', broken, history)).toMatchObject({ failed: true, ruleId: 'R-PERSIST-01' });
  });
});
