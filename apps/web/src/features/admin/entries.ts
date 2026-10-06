/**
 * Scheibe 041 (decision 4): the input forms of the three master-data dialogs and the one entry each sends. The client
 * checks only what makes a field empty or not a number; lengths are limited by the inputs, and the service checks the
 * rest (422: pseudonymous ids, duplicate numbers, positions and devices).
 */
import type { AgendaItem, StageSeat, Unit } from '@hv/domain';
import type { MasterInputs, MasterItems, MasterKind } from './masterData';

export type EntryForm = Readonly<Record<string, string>>;

export interface FieldSpec {
  name: string;
  labelKey:
    | 'admin.units.field.name'
    | 'admin.units.field.shortName'
    | 'admin.agenda.field.number'
    | 'admin.agenda.field.title'
    | 'admin.seats.field.label'
    | 'admin.seats.field.position'
    | 'admin.seats.field.person'
    | 'admin.seats.field.device';
  required: boolean;
  maxLength?: number;
  numeric?: boolean;
  mono?: boolean;
  hintKey?: 'admin.agenda.field.number.hint' | 'admin.seats.pseudonymHint';
}

export const FIELDS: Readonly<Record<MasterKind, readonly FieldSpec[]>> = {
  units: [
    { name: 'name', labelKey: 'admin.units.field.name', required: true, maxLength: 200 },
    { name: 'shortName', labelKey: 'admin.units.field.shortName', required: false, maxLength: 32 },
  ],
  agenda: [
    { name: 'number', labelKey: 'admin.agenda.field.number', required: true, numeric: true, mono: true, hintKey: 'admin.agenda.field.number.hint' },
    { name: 'title', labelKey: 'admin.agenda.field.title', required: true, maxLength: 500 },
  ],
  seats: [
    { name: 'label', labelKey: 'admin.seats.field.label', required: true, maxLength: 100 },
    { name: 'position', labelKey: 'admin.seats.field.position', required: false, numeric: true, mono: true },
    { name: 'personId', labelKey: 'admin.seats.field.person', required: false, maxLength: 128, mono: true, hintKey: 'admin.seats.pseudonymHint' },
    { name: 'deviceId', labelKey: 'admin.seats.field.device', required: false, maxLength: 128, mono: true, hintKey: 'admin.seats.pseudonymHint' },
  ],
};

/** A whole number from 1, or `undefined`. */
function wholeNumber(value: string): number | undefined {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 1 ? number : undefined;
}

const text = (form: EntryForm, name: string): string => (form[name] ?? '').trim();

/** The form of a new entry (number and position prefilled) or of an existing one. */
export function formOf<K extends MasterKind>(kind: K, item: MasterItems[K] | undefined, next: number): EntryForm {
  if (kind === 'units') {
    const unit = item as Unit | undefined;
    return { name: unit?.name ?? '', shortName: unit?.shortName ?? '' };
  }
  if (kind === 'agenda') {
    const agendaItem = item as AgendaItem | undefined;
    return { number: String(agendaItem?.number ?? next), title: agendaItem?.title ?? '' };
  }
  const seat = item as StageSeat | undefined;
  return {
    label: seat?.label ?? '',
    position: seat === undefined ? String(next) : seat.position === undefined ? '' : String(seat.position),
    personId: seat?.personId ?? '',
    deviceId: seat?.deviceId ?? '',
  };
}

/** The entry a form sends (without id), or `undefined` while a required field is empty or a number is not one. */
export function entryOf<K extends MasterKind>(kind: K, form: EntryForm): Omit<MasterInputs[K], 'id'> | undefined {
  if (kind === 'units') {
    const name = text(form, 'name');
    const shortName = text(form, 'shortName');
    if (name === '') return undefined;
    return { name, ...(shortName !== '' ? { shortName } : {}) } as unknown as Omit<MasterInputs[K], 'id'>;
  }
  if (kind === 'agenda') {
    const number = wholeNumber(form['number'] ?? '');
    const title = text(form, 'title');
    if (number === undefined || title === '') return undefined;
    return { number, title } as unknown as Omit<MasterInputs[K], 'id'>;
  }
  const label = text(form, 'label');
  const positionText = text(form, 'position');
  const position = positionText === '' ? undefined : wholeNumber(positionText);
  if (label === '' || (positionText !== '' && position === undefined)) return undefined;
  const personId = text(form, 'personId');
  const deviceId = text(form, 'deviceId');
  return {
    label,
    ...(position !== undefined ? { position } : {}),
    ...(personId !== '' ? { personId } : {}),
    ...(deviceId !== '' ? { deviceId } : {}),
  } as unknown as Omit<MasterInputs[K], 'id'>;
}

/** The name of an entry in sentences and accessible names. */
export function entryName<K extends MasterKind>(kind: K, item: MasterItems[K]): string {
  if (kind === 'units') {
    const unit = item as Unit;
    return unit.shortName ?? unit.name;
  }
  if (kind === 'agenda') {
    const agendaItem = item as AgendaItem;
    return `${agendaItem.number} ${agendaItem.title}`;
  }
  return (item as StageSeat).label;
}
