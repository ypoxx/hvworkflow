/**
 * Scheibe 040a — Administration ohne Inhaltsrechte (docs/slices/040a-admin-ohne-inhaltsrechte.md).
 *
 * The administration (Administration) manages rights and master data, reads and routes questions,
 * and writes no content (Rechtekonzept §4). Its bundle is an explicit list, so a new permission no
 * longer falls to it silently (§3 point 4, deny by default). Two new rules close the role-assignment
 * paths: nobody assigns a role to themselves (R-ADM-07), and the last usable ("tragfähig")
 * assignment of a role that holds `admin.roles.manage` cannot be revoked while the meeting is not
 * closed (R-ADM-08). The administrative role is always derived from the rights data, never named.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { READ_PERMISSION_LIST, ROLE_PERMISSIONS, hasPermission } from '../permissions.js';
import { seedEvents } from '../seed.js';
import type { NewEvent } from '../events.js';
import type { Actor, Permission, Question, QuestionStatus, Role } from '../types.js';
import { PERMISSIONS } from '../types.js';

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
/** Every role whose bundle holds `admin.roles.manage` — derived from the data (AGENTS.md R4). */
const MANAGING_ROLES = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes('admin.roles.manage'));
/** The role the demo seeds with: the one holding `demo.seed`. */
const SEEDING_ROLE = ROLES.find((role) => ROLE_PERMISSIONS[role].includes('demo.seed'))!;
/** One role per permission, for the fachlich zuständige actor in fixtures. */
const holder = (permission: Permission, not?: Role): Role =>
  ROLES.find((role) => role !== not && ROLE_PERMISSIONS[role].includes(permission) && !ROLE_PERMISSIONS[role].unitBoundRead)!;

const ADMIN_LIST: readonly Permission[] = [
  'speaker.read', 'contribution.read', 'question.read', 'question.read.delivered', 'stage.read', 'history.read', 'event.read',
  'question.assign', 'question.return',
  'agenda.manage', 'admin.roles.manage', 'demo.seed',
  'admin.units.manage', 'admin.seats.manage', // Scheibe 040b
];

const admin: Actor = { id: 'admin-040a', role: SEEDING_ROLE };
const at = '2027-04-20T10:00:00.000Z';

describe('Scheibe 040a: the administration bundle is an explicit list', () => {
  it('Test 1: holds exactly the fourteen rights of 040a and 040b', () => {
    expect(MANAGING_ROLES).toEqual([SEEDING_ROLE]);
    expect([...ROLE_PERMISSIONS[SEEDING_ROLE]].sort()).toEqual([...ADMIN_LIST].sort());
    expect(ROLE_PERMISSIONS[SEEDING_ROLE]).toHaveLength(14);
  });

  it('Test 2: deny by default — every other permission is refused with R-PERM-01 or R-PERM-02', () => {
    const denied = PERMISSIONS.filter((permission) => !ADMIN_LIST.includes(permission));
    expect(denied.length).toBe(PERMISSIONS.length - 14);
    for (const permission of denied) {
      const decision = hasPermission(admin, permission);
      expect(decision, permission).toMatchObject({
        allow: false,
        ruleId: READ_PERMISSION_LIST.includes(permission) ? 'R-PERM-02' : 'R-PERM-01',
      });
    }
  });
});

describe('Scheibe 040a: content writes and routing on the seed', () => {
  let store: EventStore;
  let current: Actor;
  let api: HvApi;
  const as = (actor: Actor): void => { current = actor; };
  const byStatus = async (status: QuestionStatus, where: (q: Question) => boolean = () => true): Promise<Question> => {
    as({ id: 'reader', role: holder('question.read') });
    const { items } = await api.listQuestions({ status: [status], limit: 2000 });
    const found = items.find(where);
    if (!found) throw new Error(`seed has no question in ${status}`);
    as(admin);
    return found;
  };

  beforeEach(async () => {
    store = createInMemoryEventStore();
    let t = Date.parse('2027-04-20T12:00:00.000Z');
    current = admin;
    api = createInProcessApi({ store, actor: () => current, clock: () => new Date((t += 1000)), seeder: seedEvents });
    await api.seedDemo();
  });

  /** 403 with R-PERM-01 and no event: the right answered, not the table or the input check. */
  const refused = async (label: string, call: () => Promise<unknown>): Promise<void> => {
    as(admin);
    const before = store.lastSeq();
    const error = await call().then(() => undefined, (e: unknown) => e);
    expect(error, label).toBeInstanceOf(ApiProblem);
    expect({ label, status: (error as ApiProblem).status, ruleId: (error as ApiProblem).ruleId })
      .toEqual({ label, status: 403, ruleId: 'R-PERM-01' });
    expect(store.lastSeq(), label).toBe(before);
  };

  it('Test 3: every content write answers 403 R-PERM-01 and appends nothing', async () => {
    const meeting = await api.getMeeting();
    const speakers = await api.listSpeakers();
    const waiting = speakers.find((s) => s.status === 'waiting')!;
    const withContribution = (await api.listContributions())[0]!;
    const contribution = await api.getContribution(withContribution.id);
    const round = waiting.round;
    const roundIds = speakers.filter((s) => s.round === round).map((s) => s.id);
    const captured = await byStatus('captured');
    const assigned = await byStatus('assigned');
    const drafted = await byStatus('answer_drafted');
    const inReview = await byStatus('in_review', (q) => q.answers.length > 0);
    const approved = await byStatus('approved');
    const staged = await byStatus('staged');
    const delivered = await byStatus('delivered');
    const mergeTarget = await byStatus('classified');
    const latest = inReview.answers.at(-1)!.version;

    await refused('registerSpeaker', () => api.registerSpeaker({ displayName: 'Testaktionär 040a' }, { ifMatch: etagOf(meeting.speakerListVersion) }));
    await refused('reorderSpeakers', () => api.reorderSpeakers(round, [...roundIds].reverse(), { ifMatch: etagOf(meeting.speakerListVersion) }));
    await refused('updateSpeaker', () => api.updateSpeaker(waiting.id, { status: 'speaking' }, { ifMatch: etagOf(waiting.version) }));
    await refused('captureContribution', () => api.captureContribution({ speakerId: waiting.id, text: 'Redebeitrag 040a?' }, { ifMatch: etagOf(waiting.version) }));
    await refused('captureMeetingContribution', () => api.captureMeetingContribution({ speakerId: waiting.id, text: 'Redebeitrag 040a?' }, { ifMatch: etagOf(waiting.version) }));
    await refused('captureQuestions', () => api.captureQuestions(contribution.id, [{ text: 'Frage 040a?' }], { ifMatch: etagOf(contribution.version) }));
    await refused('classifyQuestion', () => api.classifyQuestion(captured.id, { track: 'expert_track' }, { ifMatch: etagOf(captured.version) }));
    await refused('draftAnswer', () => api.draftAnswer(assigned.id, { text: 'Antwort 040a.' }, { ifMatch: etagOf(assigned.version) }));
    await refused('submitForReview', () => api.submitForReview(drafted.id, { ifMatch: etagOf(drafted.version) }));
    await refused('approveQuestion', () => api.approveQuestion(inReview.id, latest, { ifMatch: etagOf(inReview.version) }));
    await refused('clearQuestionLegally', () => api.clearQuestionLegally(inReview.id, { answerVersion: latest }, { ifMatch: etagOf(inReview.version) }));
    await refused('stageQuestion', () => api.stageQuestion(approved.id, { ifMatch: etagOf(approved.version) }));
    await refused('deliverQuestion', () => api.deliverQuestion(staged.id, { ifMatch: etagOf(staged.version) }));
    await refused('closeQuestion', () => api.closeQuestion(delivered.id, { ifMatch: etagOf(delivered.version) }));
    await refused('withdrawQuestion', () => api.withdrawQuestion(delivered.id, 'Zurückgezogen 040a.', { ifMatch: etagOf(delivered.version) }));
    await refused('mergeQuestion', () => api.mergeQuestion(captured.id, mergeTarget.id, { ifMatch: etagOf(captured.version) }));
  });

  it('Test 4: assign and return succeed; the event carries the administrative role and shows in the history', async () => {
    const classified = await byStatus('classified');
    const inReview = await byStatus('in_review');
    const unitId = (await api.listUnits())[0]!.id;
    const assigned = await api.assignQuestion(classified.id, unitId, { ifMatch: etagOf(classified.version) });
    expect(assigned.status).toBe('assigned');
    const returned = await api.returnQuestion(inReview.id, 'Bitte an den Fachbereich zurück.', { ifMatch: etagOf(inReview.version) });
    expect(returned.status).toBe('answer_drafted');

    as({ id: 'coord-040a', role: holder('history.read', SEEDING_ROLE) });
    for (const [id, type] of [[classified.id, 'QuestionAssigned'], [inReview.id, 'QuestionReturned']] as const) {
      const history = await api.getQuestionHistory(id);
      const own = history.filter((event) => event.type === type && event.actor.id === admin.id);
      expect(own, type).toHaveLength(1);
      expect(own[0]!.actor.role).toBe(SEEDING_ROLE);
    }
  });

  it('Test 5: _actions of the administration hold at most assign, return and the two question reads', async () => {
    const { items } = await api.listQuestions({ limit: 2000 });
    expect(items.length).toBeGreaterThan(0);
    const allowed: readonly Permission[] = ['question.assign', 'question.return', 'question.read', 'question.read.delivered'];
    const seen = new Set<Permission>();
    for (const q of items) {
      for (const action of q._actions) {
        expect(allowed, `${q.number} ${action}`).toContain(action);
        seen.add(action);
      }
    }
    expect(seen.has('question.assign')).toBe(true);
    expect(seen.has('question.return')).toBe(true);
  });

  it('Test 6: reads and administration stay', async () => {
    expect((await api.listSpeakers()).length).toBeGreaterThan(0);
    expect((await api.listContributions()).length).toBeGreaterThan(0);
    const { items } = await api.listQuestions({ limit: 5 });
    expect(items.length).toBeGreaterThan(0);
    expect((await api.getQuestionHistory(items[0]!.id)).length).toBeGreaterThan(0);
    await api.getStage();
    expect((await api.listEvents()).items.length).toBeGreaterThan(0);
    const meeting = await api.getMeeting();
    expect(meeting.status).toBe('running');
    const closedItem = (await api.listAgendaItems()).find((item) => item.openedAt === undefined)!;
    expect((await api.openAgendaItem(closedItem.id, { ifMatch: etagOf(meeting.version ?? 1) })).openedAt).toBeDefined();
    const first = await api.assignRole({ subjectId: 'other-040a', role: holder('question.capture') });
    await api.assignRole({ subjectId: 'other-040a-2', role: holder('question.capture') });
    expect((await api.revokeRole(first.id)).revokedAt).toBeDefined();
    // `demo.seed` stays: seeding a fresh store as the administration works (beforeEach did the same).
    const fresh = createInProcessApi({ store: createInMemoryEventStore(), actor: () => admin, clock: () => new Date(at), seeder: seedEvents });
    expect((await fresh.seedDemo()).counts.questions).toBeGreaterThan(0);
  });
});

const demoAdmin: Actor = { id: 'demo-admin', role: SEEDING_ROLE };

function fixture(options: { started?: boolean } = {}) {
  const store = createInMemoryEventStore();
  store.append([
    { id: 'meeting', type: 'MeetingCreated', at, actor: demoAdmin, subjectId: 'hv-2027', meetingId: 'hv-2027',
      payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] } },
    ...(options.started === false ? [] : [{ id: 'start', type: 'MeetingStarted', at, actor: demoAdmin, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} }]),
  ] as NewEvent[]);
  let current: Actor = demoAdmin;
  let now = Date.parse('2027-04-20T10:05:00.000Z');
  const api = createInProcessApi({ store, actor: () => current, meetingId: 'hv-2027', clock: () => new Date(now),
    idGenerator: (() => { let n = 0; return () => `new-${++n}`; })() });
  return {
    store, api,
    as: (actor: Actor) => { current = actor; },
    advance: (ms: number) => { now += ms; },
    in: (ms: number) => new Date(now + ms).toISOString(),
    close: () => store.append([{ id: 'close', type: 'MeetingClosed', at, actor: demoAdmin, subjectId: 'hv-2027', meetingId: 'hv-2027', payload: {} } as NewEvent]),
  };
}

const conflict = async (call: () => Promise<unknown>, ruleId: string): Promise<void> => {
  const error = await call().then(() => undefined, (e: unknown) => e);
  expect(error).toBeInstanceOf(ApiProblem);
  expect({ status: (error as ApiProblem).status, ruleId: (error as ApiProblem).ruleId }).toEqual({ status: 409, ruleId });
};

const HOUR = 3_600_000;

describe('Scheibe 040a: R-ADM-07 — nobody assigns a role to themselves', () => {
  it('Test 7: a demo identity of every managing role, for every target role → 409 R-ADM-07, no event', async () => {
    for (const managing of MANAGING_ROLES) {
      const { api, store, as } = fixture();
      const self: Actor = { id: 'self-040a', role: managing };
      as(self);
      for (const role of ROLES) {
        const before = store.lastSeq();
        await conflict(() => api.assignRole({ subjectId: self.id, role }), 'R-ADM-07');
        expect(store.lastSeq()).toBe(before);
      }
      // Another subject is still fine: the rule is about the actor itself.
      expect((await api.assignRole({ subjectId: 'someone-else', role: holder('question.approve') })).subjectId).toBe('someone-else');
    }
  });

  it('Test 7: a session identity holding a managing role → 409 R-ADM-07, no event', async () => {
    for (const managing of MANAGING_ROLES) {
      const { api, store, as } = fixture();
      await api.assignRole({ subjectId: 'session-040a', role: managing });
      as({ id: 'session-040a', role: managing, assignmentScoped: true });
      const before = store.lastSeq();
      await conflict(() => api.assignRole({ subjectId: 'session-040a', role: holder('question.approve') }), 'R-ADM-07');
      expect(store.lastSeq()).toBe(before);
    }
  });
});

describe('Scheibe 040a: R-ADM-08 — the last usable administrative assignment stays', () => {
  const managing = MANAGING_ROLES[0]!;

  for (const started of [true, false]) {
    it(`Test 8: two usable assignments — the first may go, the second → 409 R-ADM-08 (${started ? 'running' : 'preparation'})`, async () => {
      const { api, store } = fixture({ started });
      const first = await api.assignRole({ subjectId: 'adm-1', role: managing });
      const second = await api.assignRole({ subjectId: 'adm-2', role: managing, expiresAt: '2099-01-01T00:00:00.000Z' });
      expect((await api.revokeRole(first.id)).revokedAt).toBeDefined();
      const before = store.lastSeq();
      await conflict(() => api.revokeRole(second.id), 'R-ADM-08');
      expect(store.lastSeq()).toBe(before);
    });
  }

  it('Test 8: an expired assignment and one expiring in under 24 hours are no backing', async () => {
    const { api, store, advance, in: inMs } = fixture();
    const permanent = await api.assignRole({ subjectId: 'adm-1', role: managing });
    await api.assignRole({ subjectId: 'adm-expired', role: managing, expiresAt: inMs(60_000) });
    advance(120_000);
    const soon = await api.assignRole({ subjectId: 'adm-soon', role: managing, expiresAt: inMs(24 * HOUR - 1) });
    const before = store.lastSeq();
    await conflict(() => api.revokeRole(permanent.id), 'R-ADM-08');
    expect(store.lastSeq()).toBe(before);
    // The soon-expiring one is not usable itself, so it is not "the last usable" either: it may go.
    expect((await api.revokeRole(soon.id)).revokedAt).toBeDefined();
  });

  it('Test 8: an assignment expiring in exactly 24 hours is usable backing', async () => {
    const { api, in: inMs } = fixture();
    const permanent = await api.assignRole({ subjectId: 'adm-1', role: managing });
    const day = await api.assignRole({ subjectId: 'adm-day', role: managing, expiresAt: inMs(24 * HOUR) });
    expect((await api.revokeRole(permanent.id)).revokedAt).toBeDefined();
    await conflict(() => api.revokeRole(day.id), 'R-ADM-08');
  });

  it('Test 8: an assignment of a role without admin.roles.manage is not guarded', async () => {
    const { api } = fixture();
    const other = await api.assignRole({ subjectId: 'cap-1', role: holder('question.capture') });
    expect((await api.revokeRole(other.id)).revokedAt).toBeDefined();
  });

  it('Test 8: in a closed meeting the rule does not apply', async () => {
    const { api, close } = fixture();
    const last = await api.assignRole({ subjectId: 'adm-1', role: managing });
    close();
    expect((await api.revokeRole(last.id)).revokedAt).toBeDefined();
  });

  // Review 040a, major 1: a managing assignment is only backing if the subject's session would select
  // it — the oldest active assignment of that subject across all non-closed meetings (apps/api/src/actor.ts).
  const other = holder('question.capture');

  it('Test 8: a managing assignment behind an older active one of the same subject is no backing', async () => {
    const { api, store } = fixture();
    const own = await api.assignRole({ subjectId: 'adm-a', role: managing });
    await api.assignRole({ subjectId: 'adm-b', role: other });
    await api.assignRole({ subjectId: 'adm-b', role: managing });
    const before = store.lastSeq();
    await conflict(() => api.revokeRole(own.id), 'R-ADM-08');
    expect(store.lastSeq()).toBe(before);
  });

  it('Test 8: the same with the older assignment in another non-closed meeting; once that meeting closes, it is backing', async () => {
    const { api, store, as } = fixture();
    const own = await api.assignRole({ subjectId: 'adm-a', role: managing });
    store.append([
      { id: 'create-2028', type: 'MeetingCreated', at, actor: demoAdmin, subjectId: 'hv-2028', meetingId: 'hv-2028',
        payload: { title: 'HV 2028', date: '2028-04-20', agendaItems: [], units: [] } },
      { id: 'b-2028', type: 'RoleAssigned', at, actor: demoAdmin, subjectId: 'b-2028', meetingId: 'hv-2028',
        payload: { assignmentId: 'b-2028', subjectId: 'adm-b', role: other } },
    ] as NewEvent[]);
    as(demoAdmin);
    await api.assignRole({ subjectId: 'adm-b', role: managing });
    await conflict(() => api.revokeRole(own.id), 'R-ADM-08');
    store.append([
      { id: 'start-2028', type: 'MeetingStarted', at, actor: demoAdmin, subjectId: 'hv-2028', meetingId: 'hv-2028', payload: {} },
      { id: 'close-2028', type: 'MeetingClosed', at, actor: demoAdmin, subjectId: 'hv-2028', meetingId: 'hv-2028', payload: {} },
    ] as NewEvent[]);
    expect((await api.revokeRole(own.id)).revokedAt).toBeDefined();
  });

  it('Test 8 (allowed): a session identity revokes its own managing assignment while another usable one exists', async () => {
    const { api, as } = fixture();
    const own = await api.assignRole({ subjectId: 'adm-a', role: managing });
    await api.assignRole({ subjectId: 'adm-b', role: managing });
    as({ id: 'adm-a', role: managing, assignmentScoped: true });
    expect((await api.revokeRole(own.id)).revokedAt).toBeDefined();
  });

  it('Test 8 (allowed): revoking an expired managing assignment', async () => {
    const { api, advance, in: inMs } = fixture();
    await api.assignRole({ subjectId: 'adm-1', role: managing });
    const expired = await api.assignRole({ subjectId: 'adm-expired', role: managing, expiresAt: inMs(60_000) });
    advance(120_000);
    expect((await api.revokeRole(expired.id)).revokedAt).toBeDefined();
  });
});

describe('Scheibe 040a: four eyes unchanged', () => {
  it('Test 9: legal drafts and clears the same version → 409 R-GUARD-06, no event', async () => {
    const store = createInMemoryEventStore();
    let current: Actor = admin;
    let t = Date.parse('2027-04-20T12:00:00.000Z');
    const api = createInProcessApi({ store, actor: () => current, clock: () => new Date((t += 1000)), seeder: seedEvents });
    await api.seedDemo();
    const legal: Actor = { id: 'leg-040a', role: holder('question.legal.clear') };
    // The submitting role (expert) reads unit-bound only for session identities; a demo identity is unscoped.
    const submitter: Actor = { id: 'exp-040a', role: ROLES.find((role) => ROLE_PERMISSIONS[role].includes('question.submit_review'))! };
    current = legal;
    const { items } = await api.listQuestions({ status: ['assigned'], limit: 2000 });
    const q = items.find((item) => item.track !== undefined && item.track !== 'podium')!;
    await api.draftAnswer(q.id, { text: 'Entwurf der Rechtsabteilung.' }, { ifMatch: etagOf(q.version) });
    current = submitter;
    await api.submitForReview(q.id, { ifMatch: etagOf((await api.getQuestion(q.id)).version) });
    current = legal;
    const before = store.lastSeq();
    await expect(api.clearQuestionLegally(q.id, { answerVersion: 1 }, { ifMatch: etagOf((await api.getQuestion(q.id)).version) }))
      .rejects.toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
    expect(store.lastSeq()).toBe(before);
  });
});
