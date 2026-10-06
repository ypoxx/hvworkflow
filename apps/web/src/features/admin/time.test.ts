/**
 * Scheibe 041, Test 3: the local time of the hall (Europe/Berlin) to an instant and back, without a library. A local
 * time that does not exist (spring forward) is `undefined`; one that exists twice (fall back) is its earlier
 * occurrence (summer time); anything that is not a `datetime-local` value is `undefined`.
 */
import { describe, expect, it } from 'vitest';
import { berlinLocalToIso, formatBerlinDateTime, isoToBerlinLocal } from './time';

describe('berlinLocalToIso', () => {
  it('winter time is UTC+1', () => {
    expect(berlinLocalToIso('2026-12-01T18:00')).toBe('2026-12-01T17:00:00.000Z');
  });

  it('summer time is UTC+2', () => {
    expect(berlinLocalToIso('2026-06-15T09:30')).toBe('2026-06-15T07:30:00.000Z');
  });

  it('accepts seconds as the input sends them with a step', () => {
    expect(berlinLocalToIso('2026-06-15T09:30:15')).toBe('2026-06-15T07:30:15.000Z');
  });

  it('28.03.2027 02:30 does not exist (spring forward) → undefined', () => {
    expect(berlinLocalToIso('2027-03-28T02:30')).toBeUndefined();
    expect(berlinLocalToIso('2027-03-28T01:59')).toBe('2027-03-28T00:59:00.000Z');
    expect(berlinLocalToIso('2027-03-28T03:00')).toBe('2027-03-28T01:00:00.000Z');
  });

  it('25.10.2026 02:30 exists twice (fall back) → the earlier occurrence, summer time', () => {
    expect(berlinLocalToIso('2026-10-25T02:30')).toBe('2026-10-25T00:30:00.000Z');
  });

  it('anything else → undefined', () => {
    for (const value of ['', 'morgen', '2026-13-01T10:00', '2026-02-30T10:00', '2026-01-01', '2026-01-01T24:00', '2026-01-01 10:00']) {
      expect(berlinLocalToIso(value)).toBeUndefined();
    }
  });
});

describe('isoToBerlinLocal', () => {
  it('winter and summer, there and back', () => {
    expect(isoToBerlinLocal('2026-12-01T17:00:00.000Z')).toBe('2026-12-01T18:00');
    expect(isoToBerlinLocal('2026-06-15T07:30:00.000Z')).toBe('2026-06-15T09:30');
    for (const local of ['2026-12-01T18:00', '2026-06-15T09:30', '2026-10-25T02:30', '2027-01-01T00:00']) {
      expect(isoToBerlinLocal(berlinLocalToIso(local)!)).toBe(local);
    }
  });

  it('midnight is 00, never 24', () => {
    expect(isoToBerlinLocal('2026-12-31T23:00:00.000Z')).toBe('2027-01-01T00:00');
  });
});

describe('formatBerlinDateTime', () => {
  it('shows the hall time in the language of the interface', () => {
    expect(formatBerlinDateTime('2026-12-01T17:00:00.000Z', 'de')).toBe('01.12.2026, 18:00');
    expect(formatBerlinDateTime('2026-12-01T17:00:00.000Z', 'en')).toMatch(/12\/01\/2026, 0?6:00\sPM/);
  });
});
