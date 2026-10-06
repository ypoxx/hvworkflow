/**
 * Scheibe 041, Test 11: the helpers of the Verwaltung against the real domain, in process, with the demo corpus and an
 * injected clock, acting as the administration persona. Every write is one whole-list replacement with `If-Match` of
 * the version read before the list (decision 6); refusals map to the dialog's keys (decision 7).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CORPUS_DEMO,
  ROLE_PERMISSIONS,
  createInMemoryEventStore,
  createInProcessApi,
  seedEvents,
} from '@hv/domain';
import type { Actor, DomainEvent, EventStore, HvApi, Role } from '@hv/domain';
import { adminProblemKey, attempt } from './problems';
import { readMaster, writeMaster } from './masterData';
import { assignInput, EMPTY_ASSIGN_FORM } from './assignments';

/** The demo administration persona: the role that holds `admin.roles.manage`, found in the data. */
const ADMIN_ROLE = (Object.keys(ROLE_PERMISSIONS) as Role[]).find((role) => ROLE_PERMISSIONS[role].includes('admin.roles.manage'))!;
const ADMIN: Actor = { id: 'u-admin', role: ADMIN_ROLE, displayName: 'Administration' };
const EXPERT_ROLE = (Object.keys(ROLE_PERMISSIONS) as Role[]).find((role) => ROLE_PERMISSIONS[role].unitBoundRead === true)!;
const NOW = new Date('2026-06-18T10:00:00.000Z');

// Each test rebuilds a projection over ~1000 events (well under a second alone); the margin covers a loaded machine.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let store: EventStore;
let api: HvApi;
let meetingId: string;
/** The seeded log, built once (seeding the demo corpus takes seconds under load; review 041, blocker). */
let seeded: readonly DomainEvent[];

beforeAll(async () => {
  const base = createInMemoryEventStore();
  const seeder = createInProcessApi({ store: base, actor: () => ADMIN, clock: () => NOW, seeder: seedEvents });
  await seeder.seedDemo({ questions: CORPUS_DEMO.questions, roundSizes: CORPUS_DEMO.roundSizes, seed: CORPUS_DEMO.seed });
  // The demo's binding of the Fachkraft (DEMO_BINDINGS): Finanzen is held by an active assignment.
  await seeder.assignRole({ subjectId: 'u-exp-fin', role: EXPERT_ROLE, unitId: 'unit-fin' });
  seeded = [...base.all()];
}, 60_000);

beforeEach(async () => {
  // Every test starts from its own store over the same seeded events (append-only: the shared ones are never changed).
  store = createInMemoryEventStore({ load: () => [...seeded], save: () => undefined });
  api = createInProcessApi({ store, actor: () => ADMIN, clock: () => NOW, seeder: seedEvents });
  meetingId = (await api.getMeeting()).id;
});

const typesSince = (seq: number): string[] => store.all().filter((event) => event.seq > seq).map((event) => event.type);

describe('units', () => {
  it('adding through withAdded: one UnitsReplaced, every earlier id kept, version + 1', async () => {
    const read = await readMaster(api, meetingId, 'units');
    const before = store.lastSeq();
    await writeMaster(api, meetingId, 'units', read, { op: 'add', entry: { name: 'E2E 041 Prüfbereich' } });
    expect(typesSince(before)).toEqual(['UnitsReplaced']);
    const after = await readMaster(api, meetingId, 'units');
    expect(after.version).toBe(read.version + 1);
    expect(after.items.slice(0, read.items.length).map((unit) => unit.id)).toEqual(read.items.map((unit) => unit.id));
    expect(after.items).toHaveLength(read.items.length + 1);
    expect(after.items.at(-1)?.name).toBe('E2E 041 Prüfbereich');
  });

  it('renaming Finanzen through withReplaced keeps the bound Fachkraft on the same unit id', async () => {
    const read = await readMaster(api, meetingId, 'units');
    await writeMaster(api, meetingId, 'units', read, { op: 'replace', id: 'unit-fin', entry: { name: 'Finanzen neu', shortName: 'FIN' } });
    const after = await readMaster(api, meetingId, 'units');
    expect(after.items.find((unit) => unit.id === 'unit-fin')).toEqual({ id: 'unit-fin', name: 'Finanzen neu', shortName: 'FIN' });
    const bound = (await api.listRoleAssignments({ subjectId: 'u-exp-fin' }))[0];
    expect(bound?.unitId).toBe('unit-fin');
  });

  it('removing Finanzen → 409 R-ADM-02 → the dialog key; nothing appended', async () => {
    const read = await readMaster(api, meetingId, 'units');
    const before = store.lastSeq();
    const outcome = await attempt(() => writeMaster(api, meetingId, 'units', read, { op: 'remove', id: 'unit-fin' }));
    expect(outcome).toEqual({ kind: 'problem', key: 'admin.problem.R-ADM-02', ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(before);
  });

  it('a stale If-Match → 412 → stale', async () => {
    const read = await readMaster(api, meetingId, 'units');
    await writeMaster(api, meetingId, 'units', read, { op: 'add', entry: { name: 'Erster' } });
    const outcome = await attempt(() => writeMaster(api, meetingId, 'units', read, { op: 'add', entry: { name: 'Zweiter' } }));
    expect(outcome).toEqual({ kind: 'stale' });
  });
});

describe('role assignments', () => {
  it('assigning a role to oneself → R-ADM-07', async () => {
    const input = assignInput({ ...EMPTY_ASSIGN_FORM, subjectId: ADMIN.id, role: EXPERT_ROLE });
    expect(input).toBeDefined();
    let error: unknown;
    await api.assignRole(input!).catch((caught: unknown) => { error = caught; });
    expect(adminProblemKey(error)).toBe('admin.problem.R-ADM-07');
  });
});

describe('agenda and seats', () => {
  it('adding an agenda item and removing it again gives the starting list', async () => {
    const start = await readMaster(api, meetingId, 'agenda');
    const number = Math.max(...start.items.map((item) => item.number)) + 1;
    await writeMaster(api, meetingId, 'agenda', start, { op: 'add', entry: { number, title: 'E2E 041 Prüfpunkt' } });
    const added = await readMaster(api, meetingId, 'agenda');
    const created = added.items.find((item) => item.title === 'E2E 041 Prüfpunkt');
    expect(created?.number).toBe(number);
    await writeMaster(api, meetingId, 'agenda', added, { op: 'remove', id: created!.id });
    const end = await readMaster(api, meetingId, 'agenda');
    expect(end.items).toEqual(start.items);
    expect(end.version).toBe(start.version + 2);
  });

  it('adding a seat with a device and removing it again gives the starting list', async () => {
    const start = await readMaster(api, meetingId, 'seats');
    await writeMaster(api, meetingId, 'seats', start, { op: 'add', entry: { label: 'Prüfplatz', position: 9, deviceId: 'geraet-041' } });
    const added = await readMaster(api, meetingId, 'seats');
    const created = added.items.find((seat) => seat.deviceId === 'geraet-041');
    expect(created).toMatchObject({ label: 'Prüfplatz', position: 9 });
    await writeMaster(api, meetingId, 'seats', added, { op: 'remove', id: created!.id });
    expect((await readMaster(api, meetingId, 'seats')).items).toEqual(start.items);
  });
});
