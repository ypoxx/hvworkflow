/**
 * Scheibe 053, Test 3: the distribution panel (Verteilung), rendered statically like `stage/Podium.test.tsx`. Every
 * cell shows exactly its counter from the service; only the unit cells are buttons (they set the list's unit
 * filter); "Ohne Fachbereich" and the seats are not, because there is no such filter. States: loading, failed
 * (missing counters or seats), empty. Nothing here names a person.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Meeting, StageSeat, Unit } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey, TParams } from '../../i18n';
import { DistributionPanel } from './DistributionPanel';
import type { SeatRead } from './DistributionPanel';

const de = (key: TKey, params?: TParams) => translate('de', key, params);

const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
  { id: 'unit-ar', name: 'Büro des Aufsichtsrats', shortName: 'AR-Büro' },
];
const SEATS: readonly StageSeat[] = [
  { id: 'ceo', label: 'Vorstandsvorsitz', position: 2, personId: 'person-4711', deviceId: 'device-9' },
  { id: 'cfo', label: 'Finanzvorstand', position: 3 },
  { id: 'seat-x', label: '' },
];

function meeting(counts: Partial<Meeting['counts']>): Meeting {
  return {
    id: 'hv-2026', title: 'HV', date: '2026-06-15', status: 'running', version: 1, speakerListVersion: 1, currentRound: 3,
    counts: { speakers: 0, questions: 0, open: 30, staged: 4, delivered: 0, byStatus: {} as Meeting['counts']['byStatus'], ...counts },
  };
}
const FULL = meeting({ byUnit: { 'unit-fin': 9, 'unit-ops': 15, 'unit-ar': 0 }, bySeat: { ceo: 3, cfo: 1, 'seat-x': 0 } });
const READY: SeatRead = { status: 'ready', seats: SEATS };

function render(m: Meeting | null, seats: SeatRead = READY, units: readonly Unit[] = UNITS, active = 'all'): string {
  return renderToStaticMarkup(
    <DistributionPanel meeting={m} units={units} seats={seats} activeUnitId={active} onUnit={() => undefined} />,
  );
}
/** One attribute of a tag, read without writing the attribute literally into this file. */
const attr = (tag: string, name: string): string | undefined => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const tags = (html: string, testId: string): string[] =>
  [...html.matchAll(new RegExp(`<(\\w+)[^>]*data-testid="${testId}"[^>]*>`, 'g'))].map((match) => match[0]);
/** The markup of one cell: from its own tag to the next cell (or the end), so a count never leaks from a neighbour. */
const cellText = (html: string, testId: string, attr: string, value: string): string => {
  const tag = tags(html, testId).find((candidate) => candidate.includes(`${attr}="${value}"`));
  if (tag === undefined) return '';
  const start = html.indexOf(tag);
  const next = html.slice(start + tag.length).search(/data-testid="steering-(unit|seat)-(cell|none)"/);
  return next < 0 ? html.slice(start) : html.slice(start, start + tag.length + next);
};

describe('DistributionPanel (Test 3)', () => {
  it('every unit cell carries data-count equal to its counter and shows it as text', () => {
    const html = render(FULL);
    const cells = tags(html, 'steering-unit-cell');
    expect(cells).toHaveLength(3);
    for (const [unitId, count] of [['unit-fin', '9'], ['unit-ops', '15'], ['unit-ar', '0']] as const) {
      const tag = cells.find((cell) => cell.includes(`data-unit="${unitId}"`)) ?? '';
      expect(tag).toContain(`data-count="${count}"`);
      expect(cellText(html, 'steering-unit-cell', 'data-unit', unitId)).toContain(`>${count}<`);
    }
  });

  it('unit cells are buttons labelled with name and count; the active filter is aria-pressed', () => {
    const html = render(FULL, READY, UNITS, 'unit-ops');
    const cells = tags(html, 'steering-unit-cell');
    for (const cell of cells) expect(cell.startsWith('<button')).toBe(true);
    const ops = cells.find((cell) => cell.includes('data-unit="unit-ops"')) ?? '';
    expect(attr(ops, 'aria-label')).toBe(de('steering.distribution.filter', { unit: UNITS[1]?.shortName ?? '', count: 15 }));
    expect(ops).toContain('aria-pressed="true"');
    const fin = cells.find((cell) => cell.includes('data-unit="unit-fin"')) ?? '';
    expect(fin).toContain('aria-pressed="false"');
  });

  it('"Ohne Fachbereich" is open minus the sum, and not a button', () => {
    const html = render(FULL);
    const [none] = tags(html, 'steering-unit-none');
    expect(none).toBeDefined();
    expect(none?.startsWith('<button')).toBe(false);
    expect(none).toContain('data-count="6"');
    expect(html).toContain(de('steering.distribution.noUnit'));
  });

  it('seat cells carry their counter, are not buttons, and an unlabelled seat shows its id', () => {
    const html = render(FULL);
    const seats = tags(html, 'steering-seat-cell');
    expect(seats).toHaveLength(3);
    for (const seat of seats) expect(seat.startsWith('<button')).toBe(false);
    expect(seats.find((seat) => seat.includes('data-seat="ceo"'))).toContain('data-count="3"');
    expect(seats.find((seat) => seat.includes('data-seat="cfo"'))).toContain('data-count="1"');
    expect(cellText(html, 'steering-seat-cell', 'data-seat', 'ceo')).toContain('>3<');
    expect(html).toContain('Vorstandsvorsitz');
    expect(cellText(html, 'steering-seat-cell', 'data-seat', 'seat-x')).toContain('seat-x');
  });

  it('both strips have their heading and help text', () => {
    const html = render(FULL);
    for (const key of [
      'steering.distribution.units',
      'steering.distribution.unitsHelp',
      'steering.distribution.seats',
      'steering.distribution.seatsHelp',
    ] as const) {
      expect(html).toContain(de(key));
    }
  });

  it('loading: without a meeting, or while the seats load, one line of strip height and no cells', () => {
    for (const html of [render(null), render(FULL, { status: 'loading', seats: [] })]) {
      expect(html).toContain(de('steering.distribution.loading'));
      expect(tags(html, 'steering-unit-cell')).toHaveLength(0);
      expect(tags(html, 'steering-seat-cell')).toHaveLength(0);
    }
  });

  it('failed: missing counters or an unreadable seat list say so, as a status', () => {
    const noCounts = render(meeting({}));
    expect(noCounts).toContain(de('steering.distribution.failed'));
    expect(noCounts).toMatch(/role="status"[^>]*>[^<]*<?[^>]*>?/);
    expect(tags(noCounts, 'steering-unit-cell')).toHaveLength(0);
    const seatsFailed = render(FULL, { status: 'failed', seats: [] });
    expect(seatsFailed).toContain(de('steering.distribution.failed'));
    // The unit strip still stands: only the seats could not be read.
    expect(tags(seatsFailed, 'steering-unit-cell')).toHaveLength(3);
    expect(tags(seatsFailed, 'steering-seat-cell')).toHaveLength(0);
  });

  it('empty: no units and no seats', () => {
    const html = render(meeting({ byUnit: {}, bySeat: {} }), { status: 'ready', seats: [] }, []);
    expect(html).toContain(de('steering.distribution.empty'));
    expect(tags(html, 'steering-unit-cell')).toHaveLength(0);
  });

  it('names no person: neither person nor device of a seat reaches the markup', () => {
    const html = render(FULL);
    expect(html).not.toContain('person-4711');
    expect(html).not.toContain('device-9');
  });
});
