/**
 * Scheibe 041, review major (lost update): the master-data read goes through the live store, which buffers lists per
 * meeting version. The version must be read in a way that raises the store's watermark, so a list buffered at an older
 * version can never pair with a newer version — otherwise `If-Match` of the newer version would let a replacement built
 * on the old list overwrite somebody else's change. A fake adapter plays the service; "someone else" writes between the
 * reads without any stream message reaching the store.
 */
import { describe, expect, it } from 'vitest';
import { ApiProblem, etagOf } from '@hv/domain';
import type { Actor, HvApi, Meeting, Unit, UnitInput } from '@hv/domain';
import { createLiveStore } from '../../api/liveStore';
import { attempt } from './problems';
import { readMaster, writeMaster } from './masterData';

const MEETING_ID = 'meeting-2026';
const ADMIN: Actor = { id: 'u-admin', role: 'observer' };

function service() {
  let version = 1;
  let units: Unit[] = [{ id: 'unit-fin', name: 'Finanzen und Controlling' }];
  const meeting = (): Meeting => ({ id: MEETING_ID, version, speakerListVersion: 1 } as Meeting);
  const adapter = {
    getMeeting: () => Promise.resolve(meeting()),
    getMeetingById: () => Promise.resolve(meeting()),
    listMeetingUnits: () => Promise.resolve(units.map((unit) => ({ ...unit }))),
    listMeetingAgendaItems: () => Promise.resolve([]),
    listMeetingStageSeats: () => Promise.resolve([]),
    replaceMeetingUnits: (_id: string, items: UnitInput[], opts?: { ifMatch?: string }) => {
      if (opts?.ifMatch !== etagOf(version)) return Promise.reject(new ApiProblem(412, 'Precondition failed', 'changed'));
      version += 1;
      units = items.map((item, index) => ({ id: item.id ?? `new-${version}-${index}`, name: item.name }));
      return Promise.resolve(units);
    },
    lastWriteEtag: () => undefined,
    subscribe: () => () => undefined,
  };
  const store = createLiveStore(adapter as unknown as HvApi, {
    getActor: () => ADMIN,
    now: () => 0,
    monotonic: () => 0,
  });
  // The store buffers only while someone listens (the views do, through `useApiVersion`).
  store.subscribe(() => undefined);
  return {
    store,
    /** Someone else adds a unit; no stream message reaches the store. */
    otherWrite: () => {
      version += 1;
      units = [...units, { id: 'unit-other', name: 'Fremder Fachbereich' }];
    },
    units: () => units,
  };
}

describe('the live store never pairs a buffered list with a newer version', () => {
  it('a list buffered before someone else wrote is dropped once the newer version is read', async () => {
    const { store, otherWrite, units } = service();
    // Another tab of the page (the roles tab) has buffered the unit list at version 1.
    await store.listMeetingUnits(MEETING_ID);
    otherWrite();
    const read = await readMaster(store, MEETING_ID, 'units');
    expect(read.version).toBe(2);
    expect(read.items.map((unit) => unit.id)).toEqual(['unit-fin', 'unit-other']);
    await writeMaster(store, MEETING_ID, 'units', read, { op: 'add', entry: { name: 'Prüfbereich' } });
    // Nobody's change is lost: the other unit is still there.
    expect(units().map((unit) => unit.id)).toContain('unit-other');
  });

  it('when version and list are both buffered from before, the pair is old and the write is refused (412), never silent', async () => {
    const { store, otherWrite, units } = service();
    await readMaster(store, MEETING_ID, 'units');
    otherWrite();
    const read = await readMaster(store, MEETING_ID, 'units');
    const outcome = await attempt(() => writeMaster(store, MEETING_ID, 'units', read, { op: 'remove', id: 'unit-fin' }));
    if (read.version === 1) expect(outcome).toEqual({ kind: 'stale' });
    else expect(read.items.map((unit) => unit.id)).toContain('unit-other');
    expect(units().map((unit) => unit.id)).toContain('unit-other');
  });

  it('a version of another meeting is refused instead of paired', async () => {
    const { store } = service();
    await expect(readMaster(store, 'another-meeting', 'units')).rejects.toThrow();
  });
});
