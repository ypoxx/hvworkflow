/**
 * Scheibe 041: the forms of the three master-data dialogs. A new agenda item and a new seat are prefilled with the next
 * number and position; the entry sent carries only the fields that are set, trimmed; an empty required field or a
 * number that is not a whole number from 1 sends nothing.
 */
import { describe, expect, it } from 'vitest';
import { entryName, entryOf, formOf } from './entries';

describe('formOf', () => {
  it('a new entry: empty, with the next number and position prefilled', () => {
    expect(formOf('units', undefined, 1)).toEqual({ name: '', shortName: '' });
    expect(formOf('agenda', undefined, 9)).toEqual({ number: '9', title: '' });
    expect(formOf('seats', undefined, 5)).toEqual({ label: '', position: '5', personId: '', deviceId: '' });
  });

  it('an existing entry: its own values, nothing prefilled', () => {
    expect(formOf('units', { id: 'u', name: 'Investor Relations' }, 1)).toEqual({ name: 'Investor Relations', shortName: '' });
    expect(formOf('seats', { id: 's', label: 'Gast' }, 5)).toEqual({ label: 'Gast', position: '', personId: '', deviceId: '' });
  });
});

describe('entryOf', () => {
  it('units: name required, short name only when set', () => {
    expect(entryOf('units', { name: '  ', shortName: 'X' })).toBeUndefined();
    expect(entryOf('units', { name: ' Prüfbereich ', shortName: '' })).toEqual({ name: 'Prüfbereich' });
    expect(entryOf('units', { name: 'Prüfbereich', shortName: 'PB' })).toEqual({ name: 'Prüfbereich', shortName: 'PB' });
  });

  it('agenda: a whole number from 1 and a title', () => {
    expect(entryOf('agenda', { number: '9', title: 'Prüfpunkt' })).toEqual({ number: 9, title: 'Prüfpunkt' });
    for (const number of ['', '0', '-1', '1.5', 'neun', '1e3']) {
      expect(entryOf('agenda', { number, title: 'Prüfpunkt' })).toBeUndefined();
    }
    expect(entryOf('agenda', { number: '9', title: '' })).toBeUndefined();
  });

  it('seats: label required; position, person and device only when set', () => {
    expect(entryOf('seats', { label: 'Prüfplatz', position: '', personId: '', deviceId: '' })).toEqual({ label: 'Prüfplatz' });
    expect(entryOf('seats', { label: 'Prüfplatz', position: '7', personId: ' p-7 ', deviceId: 'geraet-041' }))
      .toEqual({ label: 'Prüfplatz', position: 7, personId: 'p-7', deviceId: 'geraet-041' });
    expect(entryOf('seats', { label: 'Prüfplatz', position: 'x', personId: '', deviceId: '' })).toBeUndefined();
    expect(entryOf('seats', { label: '', position: '1', personId: '', deviceId: '' })).toBeUndefined();
  });
});

describe('entryName', () => {
  it('short name, number and title, label', () => {
    expect(entryName('units', { id: 'u', name: 'Finanzen und Controlling', shortName: 'Finanzen' })).toBe('Finanzen');
    expect(entryName('units', { id: 'u', name: 'Investor Relations' })).toBe('Investor Relations');
    expect(entryName('agenda', { id: 'a', number: 3, title: 'Entlastung' })).toBe('3 Entlastung');
    expect(entryName('seats', { id: 's', label: 'Gast' })).toBe('Gast');
  });
});
