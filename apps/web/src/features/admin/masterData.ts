/**
 * Scheibe 041 (decisions 4 and 6): read and write the master data of the managed meeting without losing anyone's
 * change. A tab reads the meeting's version first and the list after it; a write is one whole-list replacement with
 * exactly one change on top of that list and `If-Match` of that version. If someone wrote in between, the list is newer
 * than the version and the service answers 412 — safe. A version newer than the list is never sent, because then a
 * replacement could overwrite somebody else's change unnoticed. `useMeeting().version` is not used here: the header
 * and the lists are read separately.
 *
 * Review 041 (major): the reads go through the live store, which buffers the lists per meeting version. The version is
 * read with `getMeeting()`, the one read that raises the store's version watermark and so drops every list buffered at
 * an older version; `getMeetingById` would not, and a fresh version could then pair with an old buffered list. Only the
 * managed meeting (the alias) is edited in 041, so its id must match.
 */
import type {
  AgendaItem,
  AgendaItemInput,
  HvApi,
  StageSeat,
  StageSeatInput,
  Unit,
  UnitInput,
} from '@hv/domain';
import { agendaToInput, seatsToInput, unitsToInput, withAdded, withRemoved, withReplaced } from './lists';

export type MasterKind = 'units' | 'agenda' | 'seats';

export interface MasterItems {
  units: Unit;
  agenda: AgendaItem;
  seats: StageSeat;
}
export interface MasterInputs {
  units: UnitInput;
  agenda: AgendaItemInput;
  seats: StageSeatInput;
}

export type MasterApi = Pick<
  HvApi,
  | 'getMeeting'
  | 'listMeetingUnits'
  | 'listMeetingAgendaItems'
  | 'listMeetingStageSeats'
  | 'replaceMeetingUnits'
  | 'replaceMeetingAgendaItems'
  | 'replaceMeetingStageSeats'
>;

export interface MasterRead<K extends MasterKind> {
  /** `Meeting.version` as read before the list. */
  version: number;
  items: readonly MasterItems[K][];
}

export type MasterChange<K extends MasterKind> =
  | { op: 'add'; entry: MasterInputs[K] }
  | { op: 'replace'; id: string; entry: Omit<MasterInputs[K], 'id'> }
  | { op: 'remove'; id: string };

/** The contract's ETag of a meeting version (`"v<n>"`, as `etagOf` in the domain; pinned by a test). */
export function ifMatchOf(version: number): string {
  return `"v${version}"`;
}

function list(api: MasterApi, meetingId: string, kind: MasterKind): Promise<readonly unknown[]> {
  if (kind === 'units') return api.listMeetingUnits(meetingId);
  if (kind === 'agenda') return api.listMeetingAgendaItems(meetingId);
  return api.listMeetingStageSeats(meetingId);
}

/** The version first, the list after it (the order is the safety, see above). */
export async function readMaster<K extends MasterKind>(api: MasterApi, meetingId: string, kind: K): Promise<MasterRead<K>> {
  const meeting = await api.getMeeting();
  if (meeting.id !== meetingId) throw new Error('The managed meeting changed; read again.');
  const items = (await list(api, meetingId, kind)) as readonly MasterItems[K][];
  return { version: meeting.version, items };
}

function applied<T extends { id?: string }>(base: readonly T[], change: MasterChange<MasterKind>): T[] {
  if (change.op === 'add') return withAdded(base, change.entry as unknown as T);
  if (change.op === 'replace') return withReplaced(base, change.id, change.entry as unknown as Omit<T, 'id'>);
  return withRemoved(base, change.id);
}

/** One replacement: the read list in input form, exactly one change, `If-Match` of the read version. */
export async function writeMaster<K extends MasterKind>(
  api: MasterApi,
  meetingId: string,
  kind: K,
  read: MasterRead<K>,
  change: MasterChange<K>,
): Promise<void> {
  const options = { ifMatch: ifMatchOf(read.version) };
  if (kind === 'units') {
    await api.replaceMeetingUnits(meetingId, applied(unitsToInput(read.items as readonly Unit[]), change), options);
  } else if (kind === 'agenda') {
    await api.replaceMeetingAgendaItems(meetingId, applied(agendaToInput(read.items as readonly AgendaItem[]), change), options);
  } else {
    await api.replaceMeetingStageSeats(meetingId, applied(seatsToInput(read.items as readonly StageSeat[]), change), options);
  }
}
