/**
 * Scheibe 041, Test 6: no lost state. A fake `HvApi` logs every call. (a) A master-data tab reads the meeting version
 * before the list; (b) the whole-list replacement sends `If-Match` of that version, also when the header (`useMeeting`)
 * shows a higher one by then; (c) when the version changes between the two reads, the replacement sends the older one
 * and gets 412, which the tab turns into "stale": dialog closed, toast `admin.stale`, read again.
 */
import { describe, expect, it } from 'vitest';
import { ApiProblem, etagOf } from '@hv/domain';
import type { AgendaItem, Meeting, StageSeat, Unit } from '@hv/domain';
import { ifMatchOf, readMaster, writeMaster } from './masterData';
import type { MasterApi } from './masterData';
import { attempt, outcomeEffects } from './problems';

const MEETING_ID = 'meeting-2026';

function fakeApi(start: number) {
  const calls: string[] = [];
  const sent: Array<{ method: string; items: unknown; ifMatch: string | undefined }> = [];
  let version = start;
  let units: Unit[] = [{ id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' }];
  const agenda: AgendaItem[] = [{ id: 'top-1', number: 1, title: 'Vorlage', openedAt: '2026-06-01T08:00:00.000Z' }];
  const seats: StageSeat[] = [{ id: 'cfo', label: 'Finanzvorstand', position: 3 }];
  /** Set to make "someone else" write between the meeting read and the list read. */
  let bumpOnList = false;
  const meeting = (): Meeting => ({ id: MEETING_ID, version } as Meeting);
  const replace = (method: string) => (id: string, items: unknown, opts?: { ifMatch?: string }) => {
    calls.push(`${method}:${id}`);
    sent.push({ method, items, ifMatch: opts?.ifMatch });
    if (opts?.ifMatch !== etagOf(version)) return Promise.reject(new ApiProblem(412, 'Precondition failed', 'changed'));
    version += 1;
    if (method === 'replaceMeetingUnits') units = items as Unit[];
    return Promise.resolve(items);
  };
  const list = <T>(method: string, value: () => T) => (id: string) => {
    calls.push(`${method}:${id}`);
    if (bumpOnList) version += 1;
    return Promise.resolve(value());
  };
  const api: MasterApi = {
    getMeeting: () => {
      calls.push(`getMeeting:${MEETING_ID}`);
      return Promise.resolve(meeting());
    },
    listMeetingUnits: list('listMeetingUnits', () => units),
    listMeetingAgendaItems: list('listMeetingAgendaItems', () => agenda),
    listMeetingStageSeats: list('listMeetingStageSeats', () => seats),
    replaceMeetingUnits: replace('replaceMeetingUnits') as MasterApi['replaceMeetingUnits'],
    replaceMeetingAgendaItems: replace('replaceMeetingAgendaItems') as MasterApi['replaceMeetingAgendaItems'],
    replaceMeetingStageSeats: replace('replaceMeetingStageSeats') as MasterApi['replaceMeetingStageSeats'],
  };
  return {
    api,
    calls,
    sent,
    bump: () => { version += 1; },
    bumpBetweenReads: () => { bumpOnList = true; },
    current: () => version,
  };
}

describe('ifMatchOf', () => {
  it('is the contract ETag of a version (same as the domain)', () => {
    for (const version of [1, 7, 120]) expect(ifMatchOf(version)).toBe(etagOf(version));
  });
});

describe('(a) the meeting version is read before the list', () => {
  it.each([
    ['units', 'listMeetingUnits'],
    ['agenda', 'listMeetingAgendaItems'],
    ['seats', 'listMeetingStageSeats'],
  ] as const)('%s', async (kind, method) => {
    const fake = fakeApi(4);
    const read = await readMaster(fake.api, MEETING_ID, kind);
    expect(fake.calls).toEqual([`getMeeting:${MEETING_ID}`, `${method}:${MEETING_ID}`]);
    expect(read.version).toBe(4);
  });
});

describe('(b) the replacement sends If-Match of the version read before the list', () => {
  it('also when the header shows a higher version by then', async () => {
    const fake = fakeApi(4);
    const read = await readMaster(fake.api, MEETING_ID, 'units');
    // The header (`useMeeting`) has meanwhile seen version 5 from an unrelated write; the tab still holds its read.
    const headerVersion = 5;
    expect(headerVersion).toBeGreaterThan(read.version);
    await writeMaster(fake.api, MEETING_ID, 'units', read, { op: 'add', entry: { name: 'Prüfbereich' } });
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]?.ifMatch).toBe(etagOf(4));
    expect(fake.sent[0]?.items).toEqual([
      { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
      { name: 'Prüfbereich' },
    ]);
  });

  it('agenda and seats send exactly one change on top of the read list, never progress times', async () => {
    const fake = fakeApi(9);
    const agenda = await readMaster(fake.api, MEETING_ID, 'agenda');
    await writeMaster(fake.api, MEETING_ID, 'agenda', agenda, { op: 'replace', id: 'top-1', entry: { number: 1, title: 'Neu' } });
    expect(fake.sent[0]).toEqual({ method: 'replaceMeetingAgendaItems', items: [{ id: 'top-1', number: 1, title: 'Neu' }], ifMatch: etagOf(9) });
    const seats = await readMaster(fake.api, MEETING_ID, 'seats');
    await writeMaster(fake.api, MEETING_ID, 'seats', seats, { op: 'remove', id: 'cfo' });
    expect(fake.sent[1]).toEqual({ method: 'replaceMeetingStageSeats', items: [], ifMatch: etagOf(10) });
  });
});

describe('(c) a change between the two reads ends in 412 and "stale"', () => {
  it('sends the older version, gets 412, and the tab closes the dialog, toasts and reads again', async () => {
    const fake = fakeApi(4);
    fake.bumpBetweenReads();
    const read = await readMaster(fake.api, MEETING_ID, 'units');
    expect(read.version).toBe(4);
    expect(fake.current()).toBe(5);
    const outcome = await attempt(() =>
      writeMaster(fake.api, MEETING_ID, 'units', read, { op: 'replace', id: 'unit-fin', entry: { name: 'Finanzen' } }));
    expect(fake.sent[0]?.ifMatch).toBe(etagOf(4));
    expect(outcome).toEqual({ kind: 'stale' });
    expect(outcomeEffects(outcome)).toEqual({ close: true, reload: true, toast: 'admin.stale' });
  });

  it('never sends a version newer than the list', async () => {
    const fake = fakeApi(4);
    const read = await readMaster(fake.api, MEETING_ID, 'units');
    fake.bump();
    await attempt(() => writeMaster(fake.api, MEETING_ID, 'units', read, { op: 'remove', id: 'unit-fin' }));
    expect(fake.sent[0]?.ifMatch).toBe(etagOf(4));
  });
});
