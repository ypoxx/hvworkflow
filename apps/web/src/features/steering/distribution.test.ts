/**
 * Scheibe 053, Tests 1 and 2: the distribution (Verteilung) — two strips of totals from the service
 * (`Meeting.counts.byUnit`, open per answering unit; `Meeting.counts.bySeat`, on the podium per seat). The view
 * counts nothing itself: every number is the service's, never one per person (040b).
 */
import { describe, expect, it } from 'vitest';
import type { Meeting, StageSeat, Unit } from '@hv/domain';
import { noUnitCount, seatCells, unitCells } from './distribution';

type Counts = Meeting['counts'];

const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
  { id: 'unit-ar', name: 'Büro des Aufsichtsrats' },
];

function counts(over: Partial<Counts>): Counts {
  return {
    speakers: 0,
    questions: 0,
    open: 0,
    staged: 0,
    delivered: 0,
    byStatus: {} as Counts['byStatus'],
    ...over,
  };
}

describe('unitCells and noUnitCount (Test 1)', () => {
  it('one cell per unit in master-data order, with exactly the value of byUnit, also 0', () => {
    const cells = unitCells(counts({ open: 30, byUnit: { 'unit-ops': 15, 'unit-fin': 9, 'unit-ar': 0 } }), UNITS);
    expect(cells).toEqual([
      { unitId: 'unit-fin', name: 'Finanzen', count: 9 },
      { unitId: 'unit-ops', name: 'Operations', count: 15 },
      { unitId: 'unit-ar', name: 'Büro des Aufsichtsrats', count: 0 },
    ]);
  });

  it('a key of byUnit without a master-data record does not appear', () => {
    const cells = unitCells(counts({ open: 30, byUnit: { 'unit-fin': 2, 'unit-ghost': 7 } }), UNITS);
    expect(cells?.map((cell) => cell.unitId)).toEqual(['unit-fin', 'unit-ops', 'unit-ar']);
    expect(cells?.find((cell) => cell.unitId === 'unit-ops')?.count).toBe(0);
  });

  it('"Ohne Fachbereich" is open minus the sum of byUnit, never negative', () => {
    expect(noUnitCount(counts({ open: 30, byUnit: { 'unit-fin': 9, 'unit-ops': 15 } }))).toBe(6);
    expect(noUnitCount(counts({ open: 3, byUnit: { 'unit-fin': 9 } }))).toBe(0);
    expect(noUnitCount(counts({ open: 0, byUnit: {} }))).toBe(0);
  });

  it('without byUnit both say undefined', () => {
    expect(unitCells(counts({ open: 30 }), UNITS)).toBeUndefined();
    expect(noUnitCount(counts({ open: 30 }))).toBeUndefined();
  });
});

describe('seatCells (Test 2)', () => {
  const SEATS: readonly StageSeat[] = [
    { id: 'cfo', label: 'Finanzvorstand', position: 3 },
    { id: 'seat-x', label: '' },
    { id: 'ceo', label: 'Vorstandsvorsitz', position: 2 },
    { id: 'board_member', label: 'Vorstandsmitglied', position: 3 },
    { id: 'supervisory_board_chair', label: 'Aufsichtsratsvorsitz', position: 1 },
  ];

  it('ordered by position, then by label; seats without a position last', () => {
    const cells = seatCells(counts({ bySeat: {} }), SEATS);
    expect(cells?.map((cell) => cell.seatId)).toEqual(['supervisory_board_chair', 'ceo', 'cfo', 'board_member', 'seat-x']);
  });

  it('the value comes from bySeat, a missing key counts 0', () => {
    const cells = seatCells(counts({ bySeat: { ceo: 3, cfo: 1, 'seat-unknown': 4 } }), SEATS);
    expect(cells?.find((cell) => cell.seatId === 'ceo')?.count).toBe(3);
    expect(cells?.find((cell) => cell.seatId === 'cfo')?.count).toBe(1);
    expect(cells?.find((cell) => cell.seatId === 'board_member')?.count).toBe(0);
    expect(cells?.some((cell) => cell.seatId === 'seat-unknown')).toBe(false);
  });

  it('without a label the id stands in its place, marked as such', () => {
    const cell = seatCells(counts({ bySeat: {} }), SEATS)?.find((entry) => entry.seatId === 'seat-x');
    expect(cell).toEqual({ seatId: 'seat-x', label: 'seat-x', labelled: false, count: 0 });
    const named = seatCells(counts({ bySeat: {} }), SEATS)?.find((entry) => entry.seatId === 'ceo');
    expect(named?.labelled).toBe(true);
    expect(named?.label).toBe('Vorstandsvorsitz');
  });

  it('without bySeat it says undefined', () => {
    expect(seatCells(counts({}), SEATS)).toBeUndefined();
  });

  it('does not reorder its input', () => {
    const before = SEATS.map((seat) => seat.id);
    seatCells(counts({ bySeat: {} }), SEATS);
    expect(SEATS.map((seat) => seat.id)).toEqual(before);
  });
});
