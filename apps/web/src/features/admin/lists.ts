/**
 * Scheibe 041: pure helpers for the whole-list replacements of the master data (Stammdaten: Fachbereiche,
 * Tagesordnung, Bühnenplätze). No React, no domain values. Every edit returns a new list and leaves its input as it
 * was, so one dialog sends exactly one change on top of the list it read (decision 4).
 */
import type { AgendaItem, AgendaItemInput, StageSeat, StageSeatInput, Unit, UnitInput } from '@hv/domain';

/** Answer form → input form; every id stays, an unset short name is left out. */
export function unitsToInput(units: readonly Unit[]): UnitInput[] {
  return units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    ...(unit.shortName !== undefined ? { shortName: unit.shortName } : {}),
  }));
}

/** The progress times (`openedAt`, voting) are never sent: the core keeps them per id. */
export function agendaToInput(items: readonly AgendaItem[]): AgendaItemInput[] {
  return items.map((item) => ({ id: item.id, number: item.number, title: item.title }));
}

export function seatsToInput(seats: readonly StageSeat[]): StageSeatInput[] {
  return seats.map((seat) => ({
    id: seat.id,
    label: seat.label,
    ...(seat.position !== undefined ? { position: seat.position } : {}),
    ...(seat.personId !== undefined ? { personId: seat.personId } : {}),
    ...(seat.deviceId !== undefined ? { deviceId: seat.deviceId } : {}),
  }));
}

/** A new entry at the end; it comes without an id (the service assigns one). */
export function withAdded<T>(list: readonly T[], entry: T): T[] {
  return [...list, entry];
}

/** Exactly one entry replaced in place; it keeps its id, and fields the new entry lacks are gone. */
export function withReplaced<T extends { id?: string }>(list: readonly T[], id: string, entry: Omit<T, 'id'>): T[] {
  return list.map((item) => (item.id === id ? ({ ...entry, id } as T) : item));
}

export function withRemoved<T extends { id?: string }>(list: readonly T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

/** The largest number plus one; 1 for an empty agenda. */
export function nextAgendaNumber(items: readonly { number: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.number), 0) + 1;
}

/** The largest position plus one; seats without a position do not count. */
export function nextSeatPosition(seats: readonly { position?: number }[]): number {
  return seats.reduce((max, seat) => Math.max(max, seat.position ?? 0), 0) + 1;
}
