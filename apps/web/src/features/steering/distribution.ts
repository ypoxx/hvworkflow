/**
 * Scheibe 053 (decision 3): the distribution (Verteilung) as pure helpers without React — two strips of totals from
 * the service: open questions per answering unit (`Meeting.counts.byUnit`) and questions on the podium per seat
 * (`Meeting.counts.bySeat`). They are marginal sums over different sets (040b), so no cross table is built from
 * them. The view counts nothing itself: a filtered list says nothing about what it leaves out. Never a figure per
 * person.
 */
import type { Meeting, StageSeat, Unit } from '@hv/domain';

type Counts = Meeting['counts'];

export interface UnitCell {
  unitId: string;
  /** The short name the unit filter uses, otherwise the full name. */
  name: string;
  count: number;
}

export interface SeatCell {
  seatId: string;
  /** The seat's label, or its id where it has none (`labelled` false: shown in mono). */
  label: string;
  labelled: boolean;
  count: number;
}

/** One cell per unit of the master data, in their order; a counter key without a unit does not appear. */
export function unitCells(counts: Counts, units: readonly Unit[]): UnitCell[] | undefined {
  const byUnit = counts.byUnit;
  if (byUnit === undefined) return undefined;
  return units.map((unit) => ({ unitId: unit.id, name: unit.shortName ?? unit.name, count: byUnit[unit.id] ?? 0 }));
}

/** Open questions without a unit (or with one the counters do not know): open minus the sum, never negative. */
export function noUnitCount(counts: Counts): number | undefined {
  const byUnit = counts.byUnit;
  if (byUnit === undefined) return undefined;
  const assigned = Object.values(byUnit).reduce((sum, value) => sum + value, 0);
  return Math.max(0, counts.open - assigned);
}

/** One cell per seat, ordered by position (seats without one last), then by label. */
export function seatCells(counts: Counts, seats: readonly StageSeat[]): SeatCell[] | undefined {
  const bySeat = counts.bySeat;
  if (bySeat === undefined) return undefined;
  const label = (seat: StageSeat): string => (seat.label.trim() === '' ? seat.id : seat.label);
  return [...seats]
    .sort(
      (a, b) =>
        (a.position ?? Number.POSITIVE_INFINITY) - (b.position ?? Number.POSITIVE_INFINITY) ||
        label(a).localeCompare(label(b)),
    )
    .map((seat) => ({ seatId: seat.id, label: label(seat), labelled: seat.label.trim() !== '', count: bySeat[seat.id] ?? 0 }));
}
