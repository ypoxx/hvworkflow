/**
 * Scheibe 040b: input checks for the whole-list master data of a meeting (Stammdaten): agenda items
 * (TOPs), answering units (Fachbereiche) and podium seats (Bühnenplätze). Pure functions; a failed
 * check is a message for a 422, `null` means the list is fine. The core (`api.ts`) builds the event
 * from the named fields only (T-G1-T-02), so an unknown field never reaches the log.
 */
import type { AgendaItemInput, StageSeatInput, UnitInput } from './types.js';

/** Contract `maxItems` of the three request bodies. */
export const MAX_AGENDA_ITEMS = 200;
export const MAX_UNITS = 200;
export const MAX_STAGE_SEATS = 50;
const MAX_ID = 128;

/**
 * Well-formed UTF-16: no lone surrogate. In a `u` regular expression a valid pair is one code point,
 * so `\p{Cs}` matches only an unpaired half. Keeps every string that may later enter the freeze
 * snapshot (040d) inside the scope of RFC 8785.
 */
export function isWellFormed(value: string): boolean {
  return !/\p{Cs}/u.test(value);
}

type Check = string | null;

function text(value: unknown, field: string, min: number, max: number): Check {
  if (typeof value !== 'string') return `${field} must be a string.`;
  if (value.length < min || value.length > max) return `${field} must have ${min} to ${max} characters.`;
  if (!isWellFormed(value)) return `${field} must be well-formed UTF-16 (no lone surrogate).`;
  return null;
}
function optionalText(value: unknown, field: string, min: number, max: number): Check {
  return value === undefined ? null : text(value, field, min, max);
}
/** Like `subjectId` in `assignRole`: no `@`, no whitespace, so no address or clear name slips in. */
function pseudonym(value: unknown, field: string): Check {
  if (value === undefined) return null;
  const invalid = text(value, field, 1, MAX_ID);
  if (invalid) return invalid;
  return (value as string).includes('@') || /\s/.test(value as string) ? `${field} must be pseudonymous (no "@", no whitespace).` : null;
}
function positiveInteger(value: unknown, field: string, optional: boolean): Check {
  if (value === undefined && optional) return null;
  return Number.isSafeInteger(value) && (value as number) >= 1 ? null : `${field} must be a positive integer.`;
}
function list(items: unknown, max: number): Check {
  if (!Array.isArray(items)) return 'The body must be a list.';
  if (items.length > max) return `At most ${max} entries are allowed.`;
  return items.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item)) ? null : 'Every entry must be an object.';
}
function duplicate(values: readonly (string | number | undefined)[], field: string): Check {
  const seen = new Set<string | number>();
  for (const value of values) {
    if (value === undefined) continue;
    if (seen.has(value)) return `Duplicate ${field} "${value}".`;
    seen.add(value);
  }
  return null;
}
const first = (...checks: (() => Check)[]): Check => {
  for (const check of checks) {
    const result = check();
    if (result) return result;
  }
  return null;
};

export function checkAgendaItems(items: readonly AgendaItemInput[]): Check {
  const shape = list(items, MAX_AGENDA_ITEMS);
  if (shape) return shape;
  return first(
    ...items.map((item) => () => first(
      () => optionalText(item.id, 'id', 1, MAX_ID),
      () => positiveInteger(item.number, 'number', false),
      () => text(item.title, 'title', 1, 500),
    )),
    () => duplicate(items.map((item) => item.id), 'id'),
    () => duplicate(items.map((item) => item.number), 'number'),
  );
}

export function checkUnits(items: readonly UnitInput[]): Check {
  const shape = list(items, MAX_UNITS);
  if (shape) return shape;
  return first(
    ...items.map((item) => () => first(
      () => optionalText(item.id, 'id', 1, MAX_ID),
      () => text(item.name, 'name', 1, 200),
      () => optionalText(item.shortName, 'shortName', 0, 32),
    )),
    () => duplicate(items.map((item) => item.id), 'id'),
  );
}

export function checkStageSeats(items: readonly StageSeatInput[]): Check {
  const shape = list(items, MAX_STAGE_SEATS);
  if (shape) return shape;
  return first(
    ...items.map((item) => () => first(
      () => optionalText(item.id, 'id', 1, MAX_ID),
      () => text(item.label, 'label', 1, 100),
      () => positiveInteger(item.position, 'position', true),
      () => pseudonym(item.personId, 'personId'),
      () => pseudonym(item.deviceId, 'deviceId'),
    )),
    () => duplicate(items.map((item) => item.id), 'id'),
    () => duplicate(items.map((item) => item.position), 'position'),
    () => duplicate(items.map((item) => item.deviceId), 'deviceId'),
  );
}
