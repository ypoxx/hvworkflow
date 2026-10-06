/**
 * Scheibe 041 (decision 8): the time of the hall. A `datetime-local` value is read as local time in Europe/Berlin (as
 * the clock and the history show it) and turned into an instant with `Intl` alone. These functions never read the
 * clock; whether a time lies in the future is the service's check (422).
 */
import type { Lang } from '../../i18n';

const ZONE = 'Europe/Berlin';
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
/** Berlin is UTC+2 in summer and UTC+1 in winter; the larger offset first gives the earlier of two equal local times. */
const OFFSETS_MINUTES = [120, 60] as const;

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function berlinParts(instant: number): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of PARTS.formatToParts(instant)) parts[part.type] = part.value;
  return parts;
}

function localOf(instant: number, seconds: boolean): string {
  const p = berlinParts(instant);
  const base = `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
  return seconds ? `${base}:${p['second']}` : base;
}

/**
 * The instant of a local Berlin time, or `undefined` for a value that is not a local date-time, or a local time that
 * does not exist (the hour skipped in spring). A local time that exists twice (the hour repeated in autumn) is its
 * earlier occurrence, in summer time.
 */
export function berlinLocalToIso(value: string): string | undefined {
  const match = LOCAL.exec(value);
  if (match === null) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (!Number.isFinite(asUtc)) return undefined;
  // Only a candidate that reads back as exactly the typed value counts; an overflow (month 13, hour 24) never does.
  for (const offset of OFFSETS_MINUTES) {
    const instant = asUtc - offset * 60_000;
    if (localOf(instant, s !== undefined) === value) return new Date(instant).toISOString();
  }
  return undefined;
}

/** The `datetime-local` value (minutes) of an instant, in Berlin time. */
export function isoToBerlinLocal(iso: string): string {
  return localOf(Date.parse(iso), false);
}

const LOCALES: Readonly<Record<Lang, string>> = { de: 'de-DE', en: 'en-US' };

/** Date and time of an instant for the eye, in Berlin time and the language of the interface. */
export function formatBerlinDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(Date.parse(iso));
}

/** A calendar date (the meeting's `date`), in the language of the interface. */
export function formatBerlinDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    timeZone: ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(Date.parse(date));
}
