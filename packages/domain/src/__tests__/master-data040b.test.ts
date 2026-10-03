/**
 * Scheibe 040b — Administration im Kern, Teil 2: Stammdaten und Bühnenplätze
 * (docs/slices/040b-stammdaten-buehnenplaetze.md, "Tests zuerst", Tests 1–14).
 *
 * The administration maintains the agenda (TOPs), the answering units (Fachbereiche) and the podium
 * seats (Bühnenplätze) of a meeting as whole lists; every change is one event whose subject is the
 * meeting. Referenced master data stays (R-ADM-02), a closed meeting's configuration is immutable
 * (R-ADM-01), and `personId`/`deviceId` of a seat are read only by holders of `admin.seats.manage`.
 * The contract half of Test 6 (Ajv against `Question` with its `if`/`then`) runs over HTTP in
 * `apps/api/src/__tests__/master-data040b.test.ts`, because the domain carries no schema validator.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { seedEvents, SEED_UNITS } from '../seed.js';
import type { DomainEvent, NewEvent, ReadEvent } from '../events.js';
import type { Actor, Permission, Question, QuestionStatus, Role, StreamChange } from '../types.js';
import { STAGE_ASSIGNMENTS } from '../types.js';

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
const holds = (role: Role, permission: Permission): boolean => ROLE_PERMISSIONS[role].includes(permission);
/** The role the demo seeds with and that manages master data — derived from the rights data. */
const ADMIN_ROLE = ROLES.find((role) => holds(role, 'demo.seed'))!;
const roleWith = (permission: Permission): Role =>
  ROLES.find((role) => holds(role, permission) && !ROLE_PERMISSIONS[role].unitBoundRead)!;

const admin: Actor = { id: 'admin-040b', role: ADMIN_ROLE };
const at = '2027-04-20T10:00:00.000Z';

function rejection(promise: Promise<unknown>): Promise<ApiProblem> {
  return promise.then(() => { throw new Error('expected a rejection'); }, (error: unknown) => {
    if (!(error instanceof ApiProblem)) throw error;
    return error;
  });
}

/** A seeded store with a mutable actor; the clock ticks one second per call. */
function seeded() {
  const store = createInMemoryEventStore();
  let current: Actor = admin;
  let t = Date.parse('2027-04-20T12:00:00.000Z');
  const api = createInProcessApi({ store, actor: () => current, clock: () => new Date((t += 1000)), seeder: seedEvents });
  return { store, api, as: (actor: Actor) => { current = actor; },
    later: (ms: number): string => new Date(t + ms).toISOString(), advance: (ms: number) => { t += ms; } };
}

function created(id: string, date: string, extra: Record<string, unknown> = {}): NewEvent {
  return { id: `create-${id}`, type: 'MeetingCreated', at, actor: admin, subjectId: id, meetingId: id,
    payload: { title: `HV ${id}`, date, agendaItems: [{ id: `top-${id}`, number: 1, title: 'Aussprache' }],
      units: [{ id: `unit-${id}`, name: 'Fachbereich' }], ...extra } } as NewEvent;
}
function lifecycle(type: 'MeetingStarted' | 'MeetingClosed', id: string): NewEvent {
  return { id: `${type}-${id}`, type, at, actor: admin, subjectId: id, meetingId: id, payload: {} } as unknown as NewEvent;
}

describe('Scheibe 040b: master data on the seed', () => {
  let store: EventStore;
  let api: HvApi;
  let as: (actor: Actor) => void;
  let later: (ms: number) => string;
  let advance: (ms: number) => void;
  let meetingId: string;
  const questions = async (status: QuestionStatus, where: (q: Question) => boolean = () => true): Promise<Question[]> => {
    as({ id: 'reader-040b', role: roleWith('question.read') });
    const { items } = await api.listQuestions({ status: [status], limit: 2000 });
    as(admin);
    return items.filter(where);
  };

  beforeEach(async () => {
    ({ store, api, as, later, advance } = seeded());
    await api.seedDemo();
    meetingId = (await api.getMeeting()).id;
  });

  it('Test 1: replacing the agenda writes the whole list, fills server ids, raises the version and keeps progress', async () => {
    const before = await api.listMeetingAgendaItems(meetingId);
    const version = (await api.getMeeting()).version;
    const opened = await api.openAgendaItem(before[0]!.id);
    expect(opened.openedAt).toBeDefined();
    const items = [
      ...before.map((item, i) => ({ id: item.id, number: item.number, title: i === 0 ? 'Umbenannt' : item.title })),
      { number: before.length + 1, title: 'Neuer Punkt' },
    ];
    const seq = store.lastSeq();
    const result = await api.replaceMeetingAgendaItems(meetingId, items);
    const event = store.all().at(-1)!;
    expect(store.lastSeq()).toBe(seq + 1);
    expect(event).toMatchObject({ type: 'AgendaItemsReplaced', subjectId: meetingId, meetingId });
    const payload = event.payload as { agendaItems: { id: string; number: number; title: string }[] };
    expect(payload.agendaItems).toHaveLength(items.length);
    for (const item of payload.agendaItems) expect(Object.keys(item).sort()).toEqual(['id', 'number', 'title']);
    const added = result.find((item) => item.title === 'Neuer Punkt')!;
    expect(added.id).toEqual(expect.any(String));
    expect(added.id.length).toBeGreaterThan(0);
    const numbers = result.map((item) => item.number);
    expect(numbers.every((n, i) => i === 0 || numbers[i - 1]! < n)).toBe(true);
    expect(result[0]).toMatchObject({ id: before[0]!.id, title: 'Umbenannt', openedAt: opened.openedAt });
    expect((await api.getMeeting()).version).toBe(version + 2);
    expect(api.lastWriteEtag()).toBe(etagOf(version + 2));

    const dupId = await rejection(api.replaceMeetingAgendaItems(meetingId, [...items.slice(0, -1), { id: before[1]!.id, number: 99, title: 'Doppelt' }]));
    expect(dupId.status).toBe(422);
    const dupNumber = await rejection(api.replaceMeetingAgendaItems(meetingId, [...items.slice(0, -1), { number: 1, title: 'Doppelt' }]));
    expect(dupNumber.status).toBe(422);
    expect(store.lastSeq()).toBe(seq + 1);
  });

  it('Test 2: R-ADM-02 keeps an agenda item that has a question or progress', async () => {
    const items = await api.listMeetingAgendaItems(meetingId);
    const [withQuestion] = await questions('classified', (q) => q.agendaItemId !== undefined);
    const keep = items.filter((item) => item.id !== withQuestion!.agendaItemId);
    const seq = store.lastSeq();
    const referenced = await rejection(api.replaceMeetingAgendaItems(meetingId, keep));
    expect(referenced).toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(seq);

    const next = Math.max(...items.map((item) => item.number)) + 1;
    const grown = await api.replaceMeetingAgendaItems(meetingId, [...items, { id: 'top-frei', number: next, title: 'Ohne Frage' }]);
    expect(grown.some((item) => item.id === 'top-frei')).toBe(true);
    await api.openAgendaItem('top-frei');
    const seqOpened = store.lastSeq();
    const progressed = await rejection(api.replaceMeetingAgendaItems(meetingId, items));
    expect(progressed).toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(seqOpened);
  });

  it('Test 3: units — replace works; R-ADM-02 for a question or an active assignment; after revokeRole it works', async () => {
    const units = await api.listMeetingUnits(meetingId);
    const renamed = await api.replaceMeetingUnits(meetingId, units.map((unit) => ({ ...unit, name: `${unit.name} (neu)` })));
    expect(renamed.every((unit) => unit.name.endsWith('(neu)'))).toBe(true);
    expect(store.all().at(-1)).toMatchObject({ type: 'UnitsReplaced', subjectId: meetingId });

    const [assigned] = await questions('assigned', (q) => q.unitId !== undefined);
    const seq = store.lastSeq();
    expect(await rejection(api.replaceMeetingUnits(meetingId, units.filter((unit) => unit.id !== assigned!.unitId))))
      .toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(seq);
    // Review 040b: a duplicate unit id is 422.
    expect((await rejection(api.replaceMeetingUnits(meetingId, [...units, { id: units[0]!.id, name: 'Doppelt' }]))).status).toBe(422);
    expect(store.lastSeq()).toBe(seq);

    // unit-ar carries no question in the corpus; an active assignment alone keeps it.
    const unitBoundRole = ROLES.find((role) => ROLE_PERMISSIONS[role].unitBoundRead)!;
    const grant = await api.assignRole({ subjectId: 'fachkraft-ar', role: unitBoundRole, unitId: 'unit-ar' });
    const withoutAr = units.filter((unit) => unit.id !== 'unit-ar');
    const seqGrant = store.lastSeq();
    expect(await rejection(api.replaceMeetingUnits(meetingId, withoutAr))).toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(seqGrant);
    // Review 040b: a second grant with an expiry keeps the unit only while it is in force.
    await api.assignRole({ subjectId: 'fachkraft-ar-2', role: unitBoundRole, unitId: 'unit-ar', expiresAt: later(60_000) });
    await api.revokeRole(grant.id);
    expect(await rejection(api.replaceMeetingUnits(meetingId, withoutAr))).toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    advance(120_000);
    const result = await api.replaceMeetingUnits(meetingId, withoutAr);
    expect(result.map((unit) => unit.id)).not.toContain('unit-ar');
  });

  it('Test 4: seats — replace works; 422 for duplicates and a non-pseudonymous personId; R-ADM-02 for a carried seat', async () => {
    const seats = await api.listMeetingStageSeats(meetingId);
    expect(seats.map((seat) => seat.id)).toEqual([...STAGE_ASSIGNMENTS]);
    const replaced = await api.replaceMeetingStageSeats(meetingId, [...seats, { label: 'Gast', position: 5, personId: 'p-gast', deviceId: 'dev-5' }]);
    expect(replaced).toHaveLength(5);
    expect(store.all().at(-1)).toMatchObject({ type: 'StageSeatsReplaced', subjectId: meetingId });
    const seq = store.lastSeq();
    const base = replaced.map(({ id, label, position, personId, deviceId }) => ({ id, label,
      ...(position !== undefined ? { position } : {}), ...(personId !== undefined ? { personId } : {}), ...(deviceId !== undefined ? { deviceId } : {}) }));
    for (const extra of [
      { id: base[0]!.id, label: 'Doppelte id', position: 9 },
      { label: 'Doppelte Position', position: 1 },
      { label: 'Doppeltes Gerät', position: 9, deviceId: 'dev-5' },
      { label: 'Klarname', position: 9, personId: 'a@b' },
      { label: 'Leerraum', position: 9, deviceId: 'dev 9' },
    ]) {
      expect((await rejection(api.replaceMeetingStageSeats(meetingId, [...base, extra]))).status, extra.label).toBe(422);
    }
    expect(store.lastSeq()).toBe(seq);

    // A seat carried by a question, derived from its stageAssignment, stays.
    const [carried] = await questions('classified', (q) => q.seatId !== undefined);
    expect(await rejection(api.replaceMeetingStageSeats(meetingId, base.filter((seat) => seat.id !== carried!.seatId))))
      .toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(seq);
  });

  it('Test 5: reading the seats — admin sees personId and deviceId, coordination, podium and observer do not', async () => {
    const seats = await api.listMeetingStageSeats(meetingId);
    await api.replaceMeetingStageSeats(meetingId, seats.map((seat, i) => ({ ...seat, personId: `p-${i}`, deviceId: `dev-${i}` })));
    const full = await api.listMeetingStageSeats(meetingId);
    expect(full.every((seat) => seat.personId !== undefined && seat.deviceId !== undefined)).toBe(true);
    for (const role of ['coordination', 'podium', 'observer'] as Role[]) {
      expect(holds(role, 'admin.seats.manage')).toBe(false);
      as({ id: `reader-${role}`, role });
      const masked = await api.listMeetingStageSeats(meetingId);
      expect(masked, role).toEqual(full.map(({ personId: _p, deviceId: _d, ...rest }) => rest));
      for (const seat of masked) {
        expect(seat, role).not.toHaveProperty('personId');
        expect(seat, role).not.toHaveProperty('deviceId');
      }
    }
  });

  it('Test 6: classification with seatId — own seat, enum seat, mismatch, unknown seat, stageAssignment alone', async () => {
    const seats = await api.listMeetingStageSeats(meetingId);
    await api.replaceMeetingStageSeats(meetingId, [...seats, { id: 'seat-gast', label: 'Gast', position: 5 }]);
    const captured = await questions('captured');
    expect(captured.length).toBeGreaterThanOrEqual(5);
    const coordination: Actor = { id: 'coord-040b', role: roleWith('question.classify') };
    as(coordination);
    const classify = (q: Question, input: Parameters<HvApi['classifyQuestion']>[1]) =>
      api.classifyQuestion(q.id, input, { ifMatch: etagOf(q.version) });
    const consistent = (q: Question): void => {
      if (q.stageAssignment !== undefined && q.seatId !== undefined) expect(q.seatId).toBe(q.stageAssignment);
    };

    const own = await classify(captured[0]!, { track: 'podium', seatId: 'seat-gast' });
    expect(own.seatId).toBe('seat-gast');
    expect(own).not.toHaveProperty('stageAssignment');
    expect(store.all().at(-1)!.payload).toEqual({ track: 'podium', seatId: 'seat-gast' });
    // Review 040b: R-ADM-02 also keeps a seat referenced by an explicit seatId.
    as(admin);
    const seqOwn = store.lastSeq();
    expect(await rejection(api.replaceMeetingStageSeats(meetingId, seats))).toMatchObject({ status: 409, ruleId: 'R-ADM-02' });
    expect(store.lastSeq()).toBe(seqOwn);
    as(coordination);

    const ceo = await classify(captured[1]!, { track: 'podium', seatId: 'ceo' });
    expect(ceo).toMatchObject({ seatId: 'ceo', stageAssignment: 'ceo' });

    const seq = store.lastSeq();
    expect((await rejection(classify(captured[2]!, { track: 'podium', seatId: 'ceo', stageAssignment: 'cfo' }))).status).toBe(422);
    expect((await rejection(classify(captured[2]!, { track: 'podium', seatId: 'seat-unbekannt' }))).status).toBe(422);
    expect(store.lastSeq()).toBe(seq);

    const legacy = await classify(captured[3]!, { track: 'podium', stageAssignment: 'cfo' });
    expect(legacy).toMatchObject({ seatId: 'cfo', stageAssignment: 'cfo' });
    const both = await classify(captured[4]!, { track: 'podium', seatId: 'cfo', stageAssignment: 'cfo' });
    expect(both).toMatchObject({ seatId: 'cfo', stageAssignment: 'cfo' });
    // A new classification without a seat removes both.
    const cleared = await classify(both, { track: 'expert_track' });
    expect(cleared).not.toHaveProperty('seatId');
    expect(cleared).not.toHaveProperty('stageAssignment');
    for (const q of [own, ceo, legacy, both, cleared]) consistent(q);
  });

  it('Test 7: counts.byUnit and counts.bySeat have every unit and seat as key and agree with an independent count', async () => {
    const count = async () => {
      as({ id: 'reader-040b', role: roleWith('question.read') });
      const { items } = await api.listQuestions({ limit: 5000 });
      as(admin);
      const units = await api.listMeetingUnits(meetingId);
      const seats = await api.listMeetingStageSeats(meetingId);
      const open = items.filter((q) => !['closed', 'withdrawn', 'merged', 'delivered'].includes(q.status));
      return {
        byUnit: Object.fromEntries(units.map((unit) => [unit.id, open.filter((q) => q.unitId === unit.id).length])),
        bySeat: Object.fromEntries(seats.map((seat) => [seat.id, items.filter((q) => q.status === 'staged' && q.seatId === seat.id).length])),
      };
    };
    const meeting = await api.getMeeting();
    expect(SEED_UNITS).toHaveLength(9);
    expect(Object.keys(meeting.counts.byUnit ?? {}).sort()).toEqual(SEED_UNITS.map((unit) => unit.id).sort());
    expect(meeting.counts.byUnit?.['unit-ar']).toBe(0);
    expect(Object.keys(meeting.counts.bySeat ?? {}).sort()).toEqual([...STAGE_ASSIGNMENTS].sort());
    expect({ byUnit: meeting.counts.byUnit, bySeat: meeting.counts.bySeat }).toEqual(await count());

    const [toAssign] = await questions('classified', (q) => q.unitId === undefined);
    as({ id: 'coord-040b', role: roleWith('question.assign') });
    const unitBefore = (await api.getMeeting()).counts.byUnit!['unit-ar']!;
    await api.assignQuestion(toAssign!.id, 'unit-ar', { ifMatch: etagOf(toAssign!.version) });
    expect((await api.getMeeting()).counts.byUnit!['unit-ar']).toBe(unitBefore + 1);

    const [toStage] = await questions('approved', (q) => q.seatId !== undefined && (STAGE_ASSIGNMENTS as readonly string[]).includes(q.seatId));
    const seatBefore = (await api.getMeeting()).counts.bySeat![toStage!.seatId!]!;
    as({ id: 'stage-040b', role: roleWith('question.stage') });
    await api.stageQuestion(toStage!.id, { ifMatch: etagOf(toStage!.version) });
    as(admin);
    expect((await api.getMeeting()).counts.bySeat![toStage!.seatId!]).toBe(seatBefore + 1);
    const after = await api.getMeeting();
    expect({ byUnit: after.counts.byUnit, bySeat: after.counts.bySeat }).toEqual(await count());
  });

  it('Test 9: rights — units and seats only with their admin right, the agenda only with agenda.manage', async () => {
    const units = await api.listMeetingUnits(meetingId);
    const seats = await api.listMeetingStageSeats(meetingId);
    const items = await api.listMeetingAgendaItems(meetingId);
    for (const role of ROLES) {
      as({ id: `actor-${role}`, role });
      const cases: [Permission, () => Promise<unknown>][] = [
        ['admin.units.manage', () => api.replaceMeetingUnits(meetingId, units)],
        ['admin.seats.manage', () => api.replaceMeetingStageSeats(meetingId, seats)],
        ['agenda.manage', () => api.replaceMeetingAgendaItems(meetingId, items.map(({ id, number, title }) => ({ id, number, title })))],
      ];
      for (const [permission, run] of cases) {
        if (holds(role, permission)) {
          await expect(run(), `${role} ${permission}`).resolves.toBeDefined();
        } else {
          const seq = store.lastSeq();
          expect(await rejection(run()), `${role} ${permission}`).toMatchObject({ status: 403, ruleId: 'R-PERM-01' });
          expect(store.lastSeq()).toBe(seq);
        }
      }
    }
    // Only the administration holds the two new rights.
    expect(ROLES.filter((role) => holds(role, 'admin.units.manage'))).toEqual([ADMIN_ROLE]);
    expect(ROLES.filter((role) => holds(role, 'admin.seats.manage'))).toEqual([ADMIN_ROLE]);
  });

  it('Test 10: seed — unit-ar and the four default seats; every classified question with stageAssignment has the same seatId', async () => {
    const units = await api.listMeetingUnits(meetingId);
    expect(units.find((unit) => unit.id === 'unit-ar')).toEqual({ id: 'unit-ar', name: 'Büro des Aufsichtsratsvorsitzenden', shortName: 'AR-Büro' });
    const seats = await api.listMeetingStageSeats(meetingId);
    expect(seats).toEqual([
      { id: 'supervisory_board_chair', label: 'Aufsichtsratsvorsitz', position: 1 },
      { id: 'ceo', label: 'Vorstandsvorsitz', position: 2 },
      { id: 'cfo', label: 'Finanzvorstand', position: 3 },
      { id: 'board_member', label: 'Vorstandsmitglied', position: 4 },
    ]);
    as({ id: 'reader-040b', role: roleWith('question.read') });
    const { items } = await api.listQuestions({ limit: 5000 });
    const withAssignment = items.filter((q) => q.stageAssignment !== undefined);
    expect(withAssignment.length).toBeGreaterThan(0);
    for (const q of withAssignment) expect(q.seatId).toBe(q.stageAssignment);
    expect(items.some((q) => q.unitId === 'unit-ar')).toBe(false);
  });

  it('Test 11: the same Idempotency-Key after a later second change returns the first result, per operation', async () => {
    const units = await api.listMeetingUnits(meetingId);
    const seats = await api.listMeetingStageSeats(meetingId);
    const items = (await api.listMeetingAgendaItems(meetingId)).map(({ id, number, title }) => ({ id, number, title }));
    const runs: [string, (variant: string, key?: string) => Promise<unknown[]>][] = [
      ['units', (v, key) => api.replaceMeetingUnits(meetingId, units.map((u) => ({ ...u, name: `${u.name} ${v}` })), key ? { idempotencyKey: key } : {})],
      ['seats', (v, key) => api.replaceMeetingStageSeats(meetingId, seats.map((s) => ({ ...s, label: `${s.label} ${v}` })), key ? { idempotencyKey: key } : {})],
      ['agenda', (v, key) => api.replaceMeetingAgendaItems(meetingId, items.map((i) => ({ ...i, title: `${i.title} ${v}` })), key ? { idempotencyKey: key } : {})],
    ];
    for (const [name, run] of runs) {
      const first = await run('eins', `key-${name}`);
      const firstTag = api.lastWriteEtag();
      await run('zwei');
      const seq = store.lastSeq();
      const replay = await run('drei', `key-${name}`);
      expect(replay, name).toEqual(first);
      expect(api.lastWriteEtag(), name).toBe(firstTag);
      expect(store.lastSeq(), name).toBe(seq);
    }
  });

  it('Test 13: a lone surrogate in label, name or title is 422 and writes nothing', async () => {
    const seq = store.lastSeq();
    const seats = await api.listMeetingStageSeats(meetingId);
    const units = await api.listMeetingUnits(meetingId);
    const items = (await api.listMeetingAgendaItems(meetingId)).map(({ id, number, title }) => ({ id, number, title }));
    expect((await rejection(api.replaceMeetingStageSeats(meetingId, [...seats, { label: '\uD800', position: 9 }]))).status).toBe(422);
    expect((await rejection(api.replaceMeetingUnits(meetingId, [...units, { name: 'a\uDC00b' }]))).status).toBe(422);
    expect((await rejection(api.replaceMeetingAgendaItems(meetingId, [...items, { number: 99, title: '\uD800' }]))).status).toBe(422);
    // Review 040b: also in id, shortName, personId and deviceId.
    expect((await rejection(api.replaceMeetingUnits(meetingId, [...units, { id: 'u\uD800', name: 'Neu' }]))).status).toBe(422);
    expect((await rejection(api.replaceMeetingUnits(meetingId, [...units, { name: 'Neu', shortName: '\uDC00' }]))).status).toBe(422);
    expect((await rejection(api.replaceMeetingStageSeats(meetingId, [...seats, { label: 'Neu', position: 9, personId: 'p\uD800' }]))).status).toBe(422);
    expect((await rejection(api.replaceMeetingStageSeats(meetingId, [...seats, { label: 'Neu', position: 9, deviceId: 'd\uDC00' }]))).status).toBe(422);
    expect(store.lastSeq()).toBe(seq);
    // A well-formed pair (an emoji) is fine.
    await expect(api.replaceMeetingUnits(meetingId, [...units, { name: 'Fachbereich 😀' }])).resolves.toHaveLength(units.length + 1);
  });

  it('Test 14: StageSeatsReplaced in listEvents without personId; a reader without event.read gets one change on `meeting`', async () => {
    const seats = await api.listMeetingStageSeats(meetingId);
    const reader: Actor = { id: 'coord-040b', role: roleWith('question.classify') };
    expect(holds(reader.role, 'event.read')).toBe(false);
    let current: Actor = admin;
    const listenerApi = createInProcessApi({ store, actor: () => current });
    const received: { events: ReadEvent[]; change?: StreamChange }[] = [];
    const stop = listenerApi.subscribe((events, change) => { received.push({ events, ...(change !== undefined ? { change } : {}) }); });
    current = reader;
    await api.replaceMeetingStageSeats(meetingId, seats.map((seat, i) => ({ ...seat, personId: `p-${i}`, deviceId: `dev-${i}` })));
    stop();
    expect(received).toHaveLength(1);
    expect(received[0]!.events).toEqual([]);
    expect(received[0]!.change?.topics).toEqual(['meeting']);

    const { items } = await api.listEvents(store.lastSeq() - 1);
    const event = items.at(-1)!;
    expect(event.type).toBe('StageSeatsReplaced');
    const listed = (event.payload as { stageSeats: Record<string, unknown>[] }).stageSeats;
    expect(listed).toHaveLength(seats.length);
    for (const seat of listed) {
      expect(seat).not.toHaveProperty('personId');
      expect(seat['deviceId']).toEqual(expect.any(String));
    }
  });
});

describe('Scheibe 040b: closed and other meetings', () => {
  it('Test 8: R-ADM-01 — on a closed meeting all three replace operations answer 409 for the demo identity, without an event', async () => {
    const store = createInMemoryEventStore();
    store.append([created('hv-2026', '2026-04-20', { stageSeats: [{ id: 'ceo', label: 'Vorstandsvorsitz', position: 1 }] }),
      lifecycle('MeetingStarted', 'hv-2026'), lifecycle('MeetingClosed', 'hv-2026')]);
    const api = createInProcessApi({ store, actor: () => admin });
    const seq = store.lastSeq();
    for (const run of [
      () => api.replaceMeetingAgendaItems('hv-2026', [{ id: 'top-hv-2026', number: 1, title: 'Neu' }]),
      () => api.replaceMeetingUnits('hv-2026', [{ id: 'unit-hv-2026', name: 'Neu' }]),
      () => api.replaceMeetingStageSeats('hv-2026', [{ id: 'ceo', label: 'Neu', position: 1 }]),
    ]) {
      expect(await rejection(run())).toMatchObject({ status: 409, ruleId: 'R-ADM-01' });
    }
    expect(store.lastSeq()).toBe(seq);
  });

  it('Test 12: a write on a meeting in preparation keeps the alias; the scoped instance is created once', async () => {
    const base = createInMemoryEventStore();
    let subscriptions = 0;
    const store: EventStore = { ...base, subscribe: (listener) => { subscriptions += 1; return base.subscribe(listener); } };
    base.append([created('hv-2027', '2027-04-20'), lifecycle('MeetingStarted', 'hv-2027'), created('hv-2028', '2028-04-20')]);
    const api = createInProcessApi({ store, actor: () => admin });
    expect((await api.getMeeting()).id).toBe('hv-2027');
    const aliasUnits = await api.listUnits();
    const afterConstruction = subscriptions;

    for (const name of ['Eins', 'Zwei', 'Drei']) {
      await api.replaceMeetingUnits('hv-2028', [{ id: 'unit-hv-2028', name }]);
      const event: DomainEvent = base.all().at(-1)!;
      expect(event).toMatchObject({ type: 'UnitsReplaced', subjectId: 'hv-2028', meetingId: 'hv-2028' });
    }
    expect(subscriptions - afterConstruction).toBe(1);
    expect((await api.getMeeting()).id).toBe('hv-2027');
    expect(await api.listUnits()).toEqual(aliasUnits);
    expect(await api.listMeetingUnits('hv-2028')).toEqual([{ id: 'unit-hv-2028', name: 'Drei' }]);
    expect((await api.getMeetingById('hv-2028')).version).toBe(4);
    // An unknown meeting is 404 and creates no instance.
    expect((await rejection(api.replaceMeetingUnits('hv-unbekannt', []))).status).toBe(404);
    expect(subscriptions - afterConstruction).toBe(1);
  });

  it('Test 6 (other meeting): classification in a meeting that is not the alias checks against its own seats', async () => {
    const store = createInMemoryEventStore();
    store.append([created('hv-2027', '2027-04-20', { stageSeats: [{ id: 'seat-a', label: 'Platz A', position: 1 }] }),
      lifecycle('MeetingStarted', 'hv-2027'),
      created('hv-2028', '2028-04-20', { stageSeats: [{ id: 'seat-b', label: 'Platz B', position: 1 }] }),
      { id: 'sp', type: 'SpeakerRegistered', at, actor: admin, subjectId: 'sp-1', meetingId: 'hv-2028',
        payload: { number: 1, round: 1, position: 1 } } as NewEvent,
      { id: 'c', type: 'ContributionCaptured', at, actor: admin, subjectId: 'c-1', meetingId: 'hv-2028',
        payload: { speakerId: 'sp-1', text: 'Frage?', source: 'manual' } } as NewEvent,
      { id: 'q', type: 'QuestionCaptured', at, actor: admin, subjectId: 'q-1', meetingId: 'hv-2028',
        payload: { number: 'F-0001', contributionId: 'c-1', speakerId: 'sp-1', text: 'Frage?' } } as NewEvent,
    ]);
    const coordination: Actor = { id: 'coord-040b', role: roleWith('question.classify') };
    const scoped = createInProcessApi({ store, actor: () => coordination, meetingId: 'hv-2028' });
    expect((await rejection(scoped.classifyQuestion('q-1', { track: 'podium', seatId: 'seat-a' }, { ifMatch: etagOf(1) }))).status).toBe(422);
    const classified = await scoped.classifyQuestion('q-1', { track: 'podium', seatId: 'seat-b' }, { ifMatch: etagOf(1) });
    expect(classified.seatId).toBe('seat-b');
    expect(classified).not.toHaveProperty('stageAssignment');
  });

  it('Review 040b [S]: per-meeting masking — an admin grant in meeting A reads meeting B masked; after closing A, A is masked too', async () => {
    const seat = { id: 'ceo', label: 'Vorstandsvorsitz', position: 1, personId: 'p-ceo', deviceId: 'dev-ceo' };
    const store = createInMemoryEventStore();
    store.append([created('hv-2027', '2027-04-20', { stageSeats: [seat] }), lifecycle('MeetingStarted', 'hv-2027'),
      created('hv-2028', '2028-04-20', { stageSeats: [seat] })]);
    await createInProcessApi({ store, actor: () => admin, meetingId: 'hv-2027', clock: () => new Date(at) })
      .assignRole({ subjectId: 'session-admin', role: ADMIN_ROLE });
    const session: Actor = { id: 'session-admin', role: ADMIN_ROLE, assignmentScoped: true };
    const api = createInProcessApi({ store, actor: () => session, clock: () => new Date(at) });
    const { personId: _p, deviceId: _d, ...masked } = seat;
    // (a) the grant counts in its own meeting only.
    expect(await api.listMeetingStageSeats('hv-2027')).toEqual([seat]);
    expect(await api.listMeetingStageSeats('hv-2028')).toEqual([masked]);
    // (b) closing the meeting ends the grant: masked from then on.
    store.append([lifecycle('MeetingClosed', 'hv-2027')]);
    expect(await api.listMeetingStageSeats('hv-2027')).toEqual([masked]);
  });

  it('a meeting without a seat list (older log) has no seats and still classifies with stageAssignment', async () => {
    const store = createInMemoryEventStore();
    store.append([created('hv-2027', '2027-04-20'), lifecycle('MeetingStarted', 'hv-2027')]);
    const api = createInProcessApi({ store, actor: () => admin });
    expect(await api.listMeetingStageSeats('hv-2027')).toEqual([]);
    expect((await api.getMeeting()).counts.bySeat).toEqual({});
  });
});
