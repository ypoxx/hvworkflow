/**
 * Scheibe 041, Test 1: the pure list helpers of the Verwaltung. Answer form → input form keeps every id, leaves
 * unset optional fields out and never sends the progress times of an agenda item; the three edits return new lists,
 * leave the input untouched and keep the order; the next number and position are the largest plus one.
 */
import { describe, expect, it } from 'vitest';
import type { AgendaItem, StageSeat, Unit } from '@hv/domain';
import {
  agendaToInput,
  nextAgendaNumber,
  nextSeatPosition,
  seatsToInput,
  unitsToInput,
  withAdded,
  withRemoved,
  withReplaced,
} from './lists';

const UNITS: readonly Unit[] = Object.freeze([
  Object.freeze({ id: 'unit-a', name: 'Finanzen und Controlling', shortName: 'Finanzen' }),
  Object.freeze({ id: 'unit-b', name: 'Investor Relations' }),
]);

const AGENDA: readonly AgendaItem[] = Object.freeze([
  Object.freeze({ id: 'top-1', number: 1, title: 'Vorlage', openedAt: '2026-06-01T08:00:00.000Z' }),
  Object.freeze({
    id: 'top-4',
    number: 4,
    title: 'Entlastung',
    openedAt: '2026-06-01T09:00:00.000Z',
    votingOpenedAt: '2026-06-01T09:30:00.000Z',
    votingClosedAt: '2026-06-01T09:40:00.000Z',
  }),
]);

const SEATS: readonly StageSeat[] = Object.freeze([
  Object.freeze({ id: 'seat-1', label: 'Aufsichtsratsvorsitz', position: 1, personId: 'p-1', deviceId: 'geraet-1' }),
  Object.freeze({ id: 'seat-2', label: 'Gast' }),
]);

describe('answer form to input form', () => {
  it('units keep every id and drop an unset short name', () => {
    expect(unitsToInput(UNITS)).toEqual([
      { id: 'unit-a', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
      { id: 'unit-b', name: 'Investor Relations' },
    ]);
    expect(Object.keys(unitsToInput(UNITS)[1]!)).toEqual(['id', 'name']);
  });

  it('agenda items keep id, number and title and never send progress times', () => {
    const input = agendaToInput(AGENDA);
    expect(input).toEqual([
      { id: 'top-1', number: 1, title: 'Vorlage' },
      { id: 'top-4', number: 4, title: 'Entlastung' },
    ]);
    for (const entry of input) expect(Object.keys(entry).sort()).toEqual(['id', 'number', 'title']);
  });

  it('seats keep every id and only the optional fields that are set', () => {
    const input = seatsToInput(SEATS);
    expect(input[0]).toEqual({ id: 'seat-1', label: 'Aufsichtsratsvorsitz', position: 1, personId: 'p-1', deviceId: 'geraet-1' });
    expect(Object.keys(input[1]!)).toEqual(['id', 'label']);
  });
});

describe('edits return new lists', () => {
  const base = Object.freeze(unitsToInput(UNITS).map((entry) => Object.freeze(entry)));

  it('withAdded appends at the end, without an id, and leaves the input untouched', () => {
    const next = withAdded(base, { name: 'Prüfbereich' });
    expect(next).not.toBe(base);
    expect(next.map((entry) => entry.id)).toEqual(['unit-a', 'unit-b', undefined]);
    expect(next[2]).toEqual({ name: 'Prüfbereich' });
    expect(base).toHaveLength(2);
  });

  it('withReplaced swaps exactly one entry in place and keeps its id', () => {
    const next = withReplaced(base, 'unit-a', { name: 'Finanzen', shortName: 'FIN' });
    expect(next).toEqual([
      { id: 'unit-a', name: 'Finanzen', shortName: 'FIN' },
      { id: 'unit-b', name: 'Investor Relations' },
    ]);
    expect(base[0]).toEqual({ id: 'unit-a', name: 'Finanzen und Controlling', shortName: 'Finanzen' });
  });

  it('withReplaced drops an optional field the new entry no longer has', () => {
    const next = withReplaced(base, 'unit-a', { name: 'Finanzen' });
    expect(Object.keys(next[0]!)).toEqual(['name', 'id']);
  });

  it('withRemoved removes exactly one entry and keeps the order of the rest', () => {
    const three = withAdded(base, { id: 'unit-c', name: 'Dritter' });
    expect(withRemoved(three, 'unit-b').map((entry) => entry.id)).toEqual(['unit-a', 'unit-c']);
    expect(three).toHaveLength(3);
  });

  it('an unknown id changes nothing but still returns a new list', () => {
    expect(withReplaced(base, 'missing', { name: 'x' })).toEqual(base);
    expect(withRemoved(base, 'missing')).toEqual(base);
    expect(withRemoved(base, 'missing')).not.toBe(base);
  });
});

describe('next number and position', () => {
  it('nextAgendaNumber: empty → 1, gaps → largest + 1', () => {
    expect(nextAgendaNumber([])).toBe(1);
    expect(nextAgendaNumber(AGENDA)).toBe(5);
    expect(nextAgendaNumber([{ number: 7 }, { number: 2 }])).toBe(8);
  });

  it('nextSeatPosition: empty → 1, seats without a position do not count', () => {
    expect(nextSeatPosition([])).toBe(1);
    expect(nextSeatPosition([{}])).toBe(1);
    expect(nextSeatPosition(SEATS)).toBe(2);
    expect(nextSeatPosition([{ position: 4 }, {}, { position: 2 }])).toBe(5);
  });
});
