/**
 * Scheibe 061, part A (core): the control desk (Leitstand) figures as a pure function of the meeting's
 * events, a passed-in `now` and a read check (docs/slices/061-leitstand.md, tests K1–K12).
 * Threat ids: R-PERM-02 (missing `cockpit.read`), R-PERM-03 (references only to readable questions),
 * T-G1-I-01 / MF-17 (no text, no actor, no figure per person), T-G2-D-03 (one fold per read).
 * Synthetic corpus and fixture events only.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, can, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { COCKPIT_REPORT, COCKPIT_THRESHOLDS, cockpitLevel, computeCockpit, statusTrail } from '../cockpit.js';
import { computeIndicators } from '../indicators.js';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { project } from '../state.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { CORPUS_DEMO, seedEvents } from '../seed.js';
import type { DomainEvent } from '../events.js';
import type { Actor, Cockpit, QuestionRecord, Role } from '../types.js';
import { PERMISSIONS, READ_PERMISSIONS } from '../types.js';

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
/** The decided holders of `cockpit.read` (rights diff of the spec), as data in the test. */
const COCKPIT_HOLDERS: readonly Role[] = ['moderation', 'coordination', 'admin'];

/* ---------- fixture events (same shape as indicators033b.test.ts) ---------- */

const NOW = new Date('2031-05-06T12:00:00.000Z');
const ago = (seconds: number): string => new Date(NOW.getTime() - seconds * 1000).toISOString();
const fixtureActor = { id: 'fixture-actor-061', role: 'admin' as const };
const M = 'hv-2031';
let seq = 0;

function ev(type: string, subjectId: string, payload: unknown, at: string, extra: Record<string, unknown> = {}): DomainEvent {
  seq += 1;
  return { seq, id: `e-${seq}`, type, at, actor: fixtureActor, subjectId, meetingId: M, payload, ...extra } as unknown as DomainEvent;
}
function meeting(status: 'preparation' | 'running' | 'closed' = 'running'): DomainEvent[] {
  const created = ev('MeetingCreated', M, { title: 'Synthetisch', date: '2031-05-06', lifecycleVersion: 2, agendaItems: [],
    units: [{ id: 'u-fin', name: 'Finanzen' }, { id: 'u-ir', name: 'IR' }] }, ago(86_000));
  if (status === 'preparation') return [created];
  const started = ev('MeetingStarted', M, {}, ago(85_000));
  return status === 'running' ? [created, started] : [created, started, ev('MeetingClosed', M, {}, ago(1))];
}
const capture = (id: string, at: string, extra: Record<string, unknown> = {}): DomainEvent =>
  ev('QuestionCaptured', id, { number: id.toUpperCase(), contributionId: 'c-1', speakerId: 's-1',
    text: 'MARKER-Fragetext darf nie erscheinen' }, at, extra);
const classify = (id: string, at: string): DomainEvent => ev('QuestionClassified', id, { track: 'expert_track' }, at);
const assignTo = (id: string, unit: string, at: string): DomainEvent => ev('QuestionAssigned', id, { unitId: unit }, at);
const draft = (id: string, version: number, at: string): DomainEvent =>
  ev('AnswerDrafted', id, { answer: { version, text: 'x', createdAt: at, createdBy: fixtureActor } }, at);
const submit = (id: string, at: string): DomainEvent => ev('QuestionSubmittedForReview', id, { answerVersion: 1 }, at);
const refusal = (id: string, version: number, at: string): DomainEvent => ev('AnswerDrafted', id, {
  answer: { version, text: 'x', createdAt: at, createdBy: fixtureActor, answerKind: 'refusal_no_claim' },
  pii: { keyId: M, refusalJustification: 'MARKER-Begruendung' }, toStatus: 'in_review' }, at);
const allRead = (): boolean => true;
const compute = (events: readonly DomainEvent[], now: Date = NOW, canRead: (q: QuestionRecord) => boolean = allRead): Cockpit =>
  computeCockpit(events, now, M, canRead)!;
const plus = (seconds: number): Date => new Date(NOW.getTime() + seconds * 1000);

/* ---------- seeded API (K2, K7, K9) ---------- */

let store: EventStore;
let current: Actor;
let clockAt: Date;
let api: HvApi;
const SEED_NOW = new Date('2031-05-06T15:00:00.000Z');
/** Legal clearing over 10 minutes for the demo corpus at seed time + 25 minutes (pinned once, review 061 A). */
const OVER10M_AFTER_600S = 15;

beforeEach(async () => {
  store = createInMemoryEventStore();
  clockAt = SEED_NOW;
  current = { id: 'actor-admin-061', role: 'admin' };
  api = createInProcessApi({ store, actor: () => current, clock: () => clockAt, seeder: seedEvents });
  await api.seedDemo({ questions: CORPUS_DEMO.questions, seed: CORPUS_DEMO.seed });
  clockAt = new Date(SEED_NOW.getTime() + 900_000);
});

describe('K1 rights: cockpit.read as data', () => {
  it('exactly moderation, coordination and admin hold cockpit.read; admin has 15 rights with cockpit.read last', () => {
    const holders = ROLES.filter((role) => ROLE_PERMISSIONS[role].includes('cockpit.read'));
    expect([...holders].sort()).toEqual([...COCKPIT_HOLDERS].sort());
    const adminRole = ROLES.find((role) => ROLE_PERMISSIONS[role].includes('demo.seed'))!;
    expect(ROLE_PERMISSIONS[adminRole]).toHaveLength(15);
    expect(ROLE_PERMISSIONS[adminRole].at(-1)).toBe('cockpit.read');
    expect(PERMISSIONS.indexOf('cockpit.read')).toBe(PERMISSIONS.indexOf('event.read') + 1);
    expect(READ_PERMISSIONS.getCockpit).toEqual(['cockpit.read']);
  });

  it('every holder holds question.read and history.read, and its bundle is not unit-bound', () => {
    for (const role of ROLES.filter((r) => ROLE_PERMISSIONS[r].includes('cockpit.read'))) {
      expect(ROLE_PERMISSIONS[role], role).toContain('question.read');
      // statusAgeSeconds and reviewAgeSeconds of a reference are history data (review 061 A, minor 3).
      expect(ROLE_PERMISSIONS[role], role).toContain('history.read');
      expect(ROLE_PERMISSIONS[role].unitBoundRead, role).toBeUndefined();
    }
  });
});

describe('K2 denial: 403 R-PERM-02 without partial data', () => {
  it('every other role and a unit-bound expert are refused', async () => {
    await api.assignRole({ subjectId: 'actor-bound-061', role: 'expert', unitId: 'unit-fin' });
    const others = ROLES.filter((role) => !ROLE_PERMISSIONS[role].includes('cockpit.read'));
    expect(others.length).toBe(ROLES.length - 3);
    const actors: Actor[] = [...others.map((role) => ({ id: `actor-${role}-061`, role })),
      { id: 'actor-bound-061', role: 'expert', assignmentScoped: true }];
    for (const actor of actors) {
      current = actor;
      const error = await api.getCockpit().then(() => undefined, (e: unknown) => e);
      expect(error, actor.role).toBeInstanceOf(ApiProblem);
      expect((error as ApiProblem).status).toBe(403);
      expect((error as ApiProblem).ruleId).toBe('R-PERM-02');
    }
  });

  it('every holder gets the figures', async () => {
    for (const role of COCKPIT_HOLDERS) {
      current = { id: `actor-${role}-061`, role };
      expect((await api.getCockpit()).totals.captured).toBe(CORPUS_DEMO.questions);
    }
  });
});

describe('K3 equality with the 033b indicators', () => {
  const same = (events: DomainEvent[], now: Date = NOW) => {
    const indicator = computeIndicators(events, now).meetings.find((m) => m.meetingId === M)!;
    const cockpit = compute(events, now);
    expect(cockpit.oldestOpen.ageSeconds).toBe(indicator.oldestOpenQuestionAgeSeconds);
    expect({ ...cockpit.openByUnit, unassigned: cockpit.openUnassigned }).toEqual(indicator.openQuestionsByUnit);
    expect(cockpit.inflow.last5m).toBe(indicator.questionsCapturedLast5m);
    expect(cockpit.legalReview.over10m).toBe(indicator.questionsInLegalReviewOver10m);
    return cockpit;
  };

  it('on the seeded corpus at three instants', () => {
    for (const offset of [120, 900, 3600]) {
      const events = store.all().filter((e) => e.meetingId !== undefined);
      const meetingId = events[0]!.meetingId!;
      const indicator = computeIndicators(events, new Date(SEED_NOW.getTime() + offset * 1000)).meetings[0]!;
      const cockpit = computeCockpit(events, new Date(SEED_NOW.getTime() + offset * 1000), meetingId, allRead)!;
      expect(cockpit.oldestOpen.ageSeconds).toBe(indicator.oldestOpenQuestionAgeSeconds);
      expect({ ...cockpit.openByUnit, unassigned: cockpit.openUnassigned }).toEqual(indicator.openQuestionsByUnit);
      expect(cockpit.inflow.last5m).toBe(indicator.questionsCapturedLast5m);
      expect(cockpit.legalReview.over10m).toBe(indicator.questionsInLegalReviewOver10m);
    }
  });

  it('at the borders: capture 300/301 s, entry into legal clearing 600/601 s', () => {
    expect(same([...meeting(), capture('q1', ago(300))]).inflow.last5m).toBe(1);
    expect(same([...meeting(), capture('q1', ago(301))]).inflow.last5m).toBe(0);
    const review = (s: number) => [...meeting(), capture('q1', ago(2000)), classify('q1', ago(1990)), assignTo('q1', 'u-fin', ago(1980)),
      draft('q1', 1, ago(1900)), submit('q1', ago(s))];
    expect(same(review(600)).legalReview.over10m).toBe(0);
    expect(same(review(601)).legalReview.over10m).toBe(1);
  });

  it('with a hand-built legacy QuestionReturned to in_review (not producible through the API) and a new refusal proposal', () => {
    const base = [...meeting(), capture('q1', ago(4000)), classify('q1', ago(3990)), assignTo('q1', 'u-fin', ago(3980)),
      draft('q1', 1, ago(3500)), submit('q1', ago(3000))];
    const legacy = ev('QuestionReturned', 'q1', { reason: 'r', fromStatus: 'in_review', toStatus: 'in_review' }, ago(500));
    expect(same([...base, legacy]).legalReview.over10m).toBe(0);
    expect(same([...base]).legalReview.over10m).toBe(1);
    expect(same([...base, refusal('q1', 2, ago(300))]).legalReview.over10m).toBe(0);
    expect(same([...base, refusal('q1', 2, ago(700))]).legalReview.over10m).toBe(1);
  });

  it('per unit, unassigned and a unit id that left the configuration', () => {
    const events = [...meeting(), capture('q1', ago(500)), capture('q2', ago(500)), capture('q3', ago(500)), capture('q4', ago(500)),
      classify('q1', ago(400)), assignTo('q1', 'u-fin', ago(390)), classify('q2', ago(400)), assignTo('q2', 'u-gone', ago(390))];
    const cockpit = same(events);
    expect(cockpit.openByUnit).toEqual({ 'u-fin': 1, 'u-ir': 0, 'u-gone': 1 });
    expect(cockpit.openUnassigned).toBe(2);
  });
});

describe('K4 inflow: twelve disjoint windows of 300 s', () => {
  it('borders 300/600/3600 s, bins[11] = last5m, sum = captures within 3600 s', () => {
    const events = [...meeting(), capture('q0', ago(0)), capture('q1', ago(300)), capture('q2', ago(301)), capture('q3', ago(600)),
      capture('q4', ago(601)), capture('q5', ago(3300)), capture('q6', ago(3301)), capture('q7', ago(3600)), capture('q8', ago(3601))];
    const { inflow } = compute(events);
    expect(inflow.binSeconds).toBe(300);
    expect(inflow.bins).toHaveLength(12);
    expect(inflow.bins[11]).toBe(2); // 0 and 300 s
    expect(inflow.bins[10]).toBe(2); // 301 and 600 s
    expect(inflow.bins[9]).toBe(1); // 601 s
    expect(inflow.bins[1]).toBe(1); // 3300 s
    expect(inflow.bins[0]).toBe(2); // 3301 and 3600 s
    expect(inflow.last5m).toBe(inflow.bins[11]);
    expect(inflow.bins.reduce((a, b) => a + b, 0)).toBe(8); // 3601 s is outside the hour
  });
});

describe('K5 oldest open questions and time in status', () => {
  it('at most four, oldest first, ties by number; items[0].ageSeconds = ageSeconds', () => {
    const events = [...meeting(), capture('q5', ago(900)), capture('q2', ago(1000)), capture('q1', ago(1000)), capture('q3', ago(800)),
      capture('q4', ago(700)), capture('q6', ago(5000)), ev('QuestionWithdrawn', 'q6', { reason: 'r' }, ago(10))];
    const { oldestOpen } = compute(events);
    expect(oldestOpen.items.map((item) => item.id)).toEqual(['q1', 'q2', 'q5', 'q3']);
    expect(oldestOpen.items[0]!.ageSeconds).toBe(oldestOpen.ageSeconds);
    expect(oldestOpen.ageSeconds).toBe(1000);
  });

  it('statusAgeSeconds stays after claim, release, legal clearance, forward and a new refusal proposal in legal clearing', () => {
    const base = [...meeting(), capture('q1', ago(5000)), classify('q1', ago(4900)), assignTo('q1', 'u-fin', ago(4800)),
      refusal('q1', 1, ago(4000))];
    const age = (extra: DomainEvent[]) => compute([...base, ...extra]).oldestOpen.items[0]!.statusAgeSeconds;
    expect(age([])).toBe(4000);
    expect(age([ev('QuestionClaimed', 'q1', { actorId: 'x', claimedAt: ago(100), expiresAt: ago(-100) }, ago(100))])).toBe(4000);
    expect(age([ev('QuestionClaimed', 'q1', { actorId: 'x', claimedAt: ago(100), expiresAt: ago(-100) }, ago(100)),
      ev('QuestionReleased', 'q1', {}, ago(50))])).toBe(4000);
    expect(age([ev('QuestionLegalCleared', 'q1', { questionId: 'q1', answerVersion: 1 }, ago(100))])).toBe(4000);
    expect(age([ev('QuestionForwarded', 'q1', { unitId: 'u-ir', reasonCode: 'wrong_unit' }, ago(100))])).toBe(4000);
    expect(age([refusal('q1', 2, ago(100))])).toBe(4000);
  });

  it('statusAgeSeconds restarts after assign, submit, return and approve', () => {
    const at = (extra: DomainEvent[]) => compute([...meeting(), capture('q1', ago(5000)), ...extra]).oldestOpen.items[0]!.statusAgeSeconds;
    expect(at([classify('q1', ago(4900)), assignTo('q1', 'u-fin', ago(4000))])).toBe(4000);
    const drafted = [classify('q1', ago(4900)), assignTo('q1', 'u-fin', ago(4800)), draft('q1', 1, ago(4700))];
    expect(at([...drafted, submit('q1', ago(3000))])).toBe(3000);
    expect(at([...drafted, submit('q1', ago(3000)),
      ev('QuestionReturned', 'q1', { reason: 'r', fromStatus: 'in_review', toStatus: 'answer_drafted' }, ago(2000))])).toBe(2000);
    expect(at([...drafted, submit('q1', ago(3000)), ev('QuestionApproved', 'q1', { answerVersion: 1 }, ago(1000))])).toBe(1000);
  });
});

describe('K6 legal clearing over 10 minutes', () => {
  it('at most 50, longest waiting first, reviewAgeSeconds > 600, reset by a new proposal; never in oldestOpen.items', () => {
    const events = [...meeting()];
    for (let i = 0; i < 55; i += 1) {
      const id = `r${String(i).padStart(2, '0')}`;
      events.push(capture(id, ago(9000)), classify(id, ago(8900)), assignTo(id, 'u-fin', ago(8800)), refusal(id, 1, ago(700 + i)));
    }
    events.push(capture('fresh', ago(9000)), classify('fresh', ago(8900)), assignTo('fresh', 'u-fin', ago(8800)),
      refusal('fresh', 1, ago(5000)), refusal('fresh', 2, ago(100)));
    const cockpit = compute(events);
    expect(cockpit.legalReview.over10m).toBe(55);
    expect(cockpit.legalReview.items).toHaveLength(50);
    expect(cockpit.legalReview.items[0]!.id).toBe('r54');
    const ages = cockpit.legalReview.items.map((item) => item.reviewAgeSeconds);
    expect([...ages].sort((a, b) => b - a)).toEqual(ages);
    expect(ages.every((a) => a > 600)).toBe(true);
    expect(cockpit.legalReview.items.some((item) => item.id === 'fresh')).toBe(false);
    for (const item of cockpit.oldestOpen.items) expect(Object.keys(item)).not.toContain('reviewAgeSeconds');
  });
});

describe('K7 privacy (negative test): nothing per person reaches the answer', () => {
  it('no actor id, personId, assignment subject, speakerId, speaker name or question text', async () => {
    current = { id: 'actor-admin-061', role: 'admin' };
    // Two persons with clear names from the synthetic corpus, bound to units through role assignments.
    const [first, second] = [...project(store.all()).persons.keys()];
    await api.assignRole({ subjectId: 'subject-fin-4711', personId: first!, role: 'expert', unitId: 'unit-fin' });
    await api.assignRole({ subjectId: 'subject-hr-4712', personId: second!, role: 'expert', unitId: 'unit-hr' });
    // A claim by a bound expert, so a claim holder exists in the projection.
    current = { id: 'subject-fin-4711', role: 'expert', assignmentScoped: true };
    const own = (await api.listQuestions({ status: ['assigned'] })).items[0]!;
    await api.claimQuestion(own.id, { ifMatch: etagOf(own.version) });
    current = { id: 'actor-coordination-061', role: 'coordination' };
    expect(can(current, 'question.identity.reveal').allow).toBe(true);
    const cockpit = await api.getCockpit();
    const text = JSON.stringify(cockpit);
    const state = project(store.all());
    const forbidden = new Set<string>();
    for (const e of store.all()) forbidden.add(e.actor.id);
    for (const a of state.roleAssignments.values()) {
      forbidden.add(a.subjectId);
      if (a.personId !== undefined) forbidden.add(a.personId);
    }
    for (const s of state.speakers.values()) {
      forbidden.add(s.id);
      forbidden.add(s.displayName);
      if (s.personId !== undefined) forbidden.add(s.personId);
    }
    for (const p of state.persons.values()) forbidden.add(p.displayName);
    for (const q of state.questions.values()) forbidden.add(q.text.slice(0, 24));
    forbidden.add(current.id);
    for (const value of forbidden) expect(text, value).not.toContain(value);
    const unitIds = state.units.map((unit) => unit.id);
    expect(Object.keys(cockpit.openByUnit).every((key) => unitIds.includes(key))).toBe(true);
  });
});

describe('K8 time comes from the injected clock', () => {
  it('asOf = clock; +10 min without event moves every age by 600; an event after asOf counts nowhere', async () => {
    current = { id: 'actor-coordination-061', role: 'coordination' };
    const before = await api.getCockpit();
    expect(before.asOf).toBe(clockAt.toISOString());
    clockAt = new Date(clockAt.getTime() + 600_000);
    const after = await api.getCockpit();
    expect(after.asOf).toBe(clockAt.toISOString());
    expect(after.oldestOpen.ageSeconds).toBe(before.oldestOpen.ageSeconds + 600);
    after.oldestOpen.items.forEach((item, i) => {
      expect(item.ageSeconds).toBe(before.oldestOpen.items[i]!.ageSeconds + 600);
      expect(item.statusAgeSeconds).toBe(before.oldestOpen.items[i]!.statusAgeSeconds + 600);
    });
    expect(after.legalReview.over10m).toBeGreaterThanOrEqual(before.legalReview.over10m);
    // Exact after +600 s: the 033b count at the new clock, and every reference waits more than 600 s.
    const indicator = computeIndicators(store.all(), clockAt).meetings[0]!;
    expect(after.legalReview.over10m).toBe(indicator.questionsInLegalReviewOver10m);
    expect(after.legalReview.over10m).toBe(OVER10M_AFTER_600S);
    expect(after.legalReview.items.every((item) => item.reviewAgeSeconds > 600)).toBe(true);

    const fixture = [...meeting(), capture('q1', ago(100)), capture('q2', ago(-5))];
    const cockpit = compute(fixture);
    expect(cockpit.totals.captured).toBe(1);
    expect(cockpit.inflow.bins.reduce((a, b) => a + b, 0)).toBe(1);
    expect(cockpit.oldestOpen.items.map((item) => item.id)).toEqual(['q1']);
    const review = [...meeting(), capture('q1', ago(2000)), classify('q1', ago(1990)), assignTo('q1', 'u-fin', ago(1980)),
      refusal('q1', 1, ago(500))];
    expect(compute(review).legalReview.over10m).toBe(0);
    expect(compute(review, plus(101)).legalReview.over10m).toBe(1);
    expect(cockpitLevel('legalReviewOver10m', compute(review, plus(101)).legalReview.over10m)).toBe('calm');
  });
});

describe('K9 status trail: one fold over reduce', () => {
  it('for every question of the seed: first captured, last = projected status, no entry without a change', async () => {
    current = { id: 'actor-coordination-061', role: 'coordination' };
    const cockpit = await api.getCockpit();
    const { items } = await api.listQuestions({ limit: 2000 });
    expect(items).toHaveLength(CORPUS_DEMO.questions);
    for (const question of items) {
      const trail = statusTrail(await api.getQuestionHistory(question.id), question.id);
      expect(trail[0]!.status, question.id).toBe('captured');
      expect(trail.at(-1)!.status, question.id).toBe(question.status);
      for (let i = 1; i < trail.length; i += 1) expect(trail[i]!.status).not.toBe(trail[i - 1]!.status);
      const ref = [...cockpit.oldestOpen.items, ...cockpit.legalReview.items].find((item) => item.id === question.id);
      if (ref) {
        expect(ref.statusAgeSeconds).toBe(Math.floor((Date.parse(cockpit.asOf) - Date.parse(trail.at(-1)!.at)) / 1000));
      }
    }
  });

  it('a return is its own entry, a repeated proposal in legal clearing is none; at = recordedAt ?? at', () => {
    const events = [...meeting(), capture('q1', ago(5000), { recordedAt: ago(4999) }), classify('q1', ago(4900)),
      assignTo('q1', 'u-fin', ago(4800)), refusal('q1', 1, ago(4000)),
      ev('QuestionReturned', 'q1', { reason: 'r', fromStatus: 'in_review', toStatus: 'assigned' }, ago(3000)),
      refusal('q1', 2, ago(2000)), refusal('q1', 3, ago(1000))];
    expect(statusTrail(events, 'q1')).toEqual([
      { status: 'captured', at: ago(4999) }, { status: 'classified', at: ago(4900) }, { status: 'assigned', at: ago(4800) },
      { status: 'in_review', at: ago(4000) }, { status: 'assigned', at: ago(3000) }, { status: 'in_review', at: ago(2000) },
    ]);
    expect(statusTrail(events, 'other')).toEqual([]);
  });
});

describe('K10 levels from COCKPIT_THRESHOLDS', () => {
  it('at every threshold the higher level; inflow and stage always calm; open total only after the debate', () => {
    const t = COCKPIT_THRESHOLDS;
    expect(t.oldestOpenSeconds).toEqual({ attention: 900, critical: 2700 });
    expect(t.legalReviewOver10m).toEqual({ attention: 3, critical: 10 });
    expect(t.unitBacklog).toEqual({ attention: 20, critical: 40 });
    expect(cockpitLevel('oldestOpen', 899)).toBe('calm');
    expect(cockpitLevel('oldestOpen', 900)).toBe('attention');
    expect(cockpitLevel('oldestOpen', 2699)).toBe('attention');
    expect(cockpitLevel('oldestOpen', 2700)).toBe('critical');
    expect(cockpitLevel('legalReviewOver10m', 2)).toBe('calm');
    expect(cockpitLevel('legalReviewOver10m', 3)).toBe('attention');
    expect(cockpitLevel('legalReviewOver10m', 10)).toBe('critical');
    for (const figure of ['unitBacklog', 'unassignedBacklog'] as const) {
      expect(cockpitLevel(figure, 19)).toBe('calm');
      expect(cockpitLevel(figure, 20)).toBe('attention');
      expect(cockpitLevel(figure, 39)).toBe('attention');
      expect(cockpitLevel(figure, 40)).toBe('critical');
    }
    for (const value of [0, 5, 1000]) {
      expect(cockpitLevel('inflow', value)).toBe('calm');
      expect(cockpitLevel('staged', value)).toBe('calm');
    }
    expect(cockpitLevel('openTotal', 47)).toBe('calm');
    expect(cockpitLevel('openTotal', 47, { debateClosed: false })).toBe('calm');
    expect(cockpitLevel('openTotal', 0, { debateClosed: true })).toBe('calm');
    expect(cockpitLevel('openTotal', 1, { debateClosed: true })).toBe('attention');
  });
});

describe('K11 meeting not running or empty', () => {
  it('preparation and closed are computed; an empty meeting gives zeros', () => {
    for (const status of ['preparation', 'closed'] as const) {
      const cockpit = compute([...meeting(status), capture('q1', ago(100))]);
      expect(cockpit.meetingStatus).toBe(status);
      expect(cockpit.totals.captured).toBe(1);
      expect(cockpit.openUnassigned).toBe(1);
    }
    const empty = compute(meeting());
    expect(empty).toEqual({
      meetingId: M, asOf: NOW.toISOString(), meetingStatus: 'running',
      totals: { captured: 0, open: 0, staged: 0, answered: 0 },
      openByStatus: { captured: 0, classified: 0, assigned: 0, answer_drafted: 0, in_review: 0, approved: 0, staged: 0 },
      openByUnit: { 'u-fin': 0, 'u-ir': 0 }, openUnassigned: 0,
      oldestOpen: { ageSeconds: 0, items: [] },
      inflow: { binSeconds: 300, bins: Array.from({ length: 12 }, () => 0), last5m: 0 },
      legalReview: { over10m: 0, items: [] },
    });
    expect(computeCockpit([], NOW, M, allRead)).toBeUndefined();
  });

  it('debateClosedAt is carried as projected; totals follow Meeting.counts', () => {
    const events = [...meeting(), ev('DebateClosed', M, {}, ago(50)), capture('q1', ago(100))];
    const cockpit = compute(events);
    const counts = project(events).meeting!.counts;
    expect(cockpit.debateClosedAt).toBe(project(events).meeting!.debateClosedAt);
    expect(cockpit.totals).toEqual({ captured: counts.questions, open: counts.open, staged: counts.staged, answered: counts.delivered });
  });
});

describe('K12 references filtered through the read check', () => {
  it('a refused question is missing in items, every figure stays', () => {
    const events = [...meeting(), capture('q1', ago(9000)), classify('q1', ago(8900)), assignTo('q1', 'u-fin', ago(8800)),
      refusal('q1', 1, ago(5000)), capture('q2', ago(8000)), classify('q2', ago(7900)), assignTo('q2', 'u-ir', ago(7800)),
      refusal('q2', 1, ago(4000))];
    const open = compute(events);
    const filtered = compute(events, NOW, (q) => q.id !== 'q1');
    expect(open.oldestOpen.items.map((item) => item.id)).toEqual(['q1', 'q2']);
    expect(filtered.oldestOpen.items.map((item) => item.id)).toEqual(['q2']);
    expect(filtered.legalReview.items.map((item) => item.id)).toEqual(['q2']);
    const { oldestOpen: _a, legalReview: _b, ...restOpen } = open;
    const { oldestOpen: _c, legalReview: _d, ...restFiltered } = filtered;
    expect(restFiltered).toEqual(restOpen);
    expect(filtered.oldestOpen.ageSeconds).toBe(open.oldestOpen.ageSeconds);
    expect(filtered.legalReview.over10m).toBe(open.legalReview.over10m);
  });
});

describe('COCKPIT_REPORT mirrors the report descriptor', () => {
  it('names operation, permission, structured aggregation and no minimum yet', () => {
    expect(COCKPIT_REPORT.id).toBe('leitstand');
    expect(COCKPIT_REPORT.operationId).toBe('getMeetingCockpit');
    expect(COCKPIT_REPORT.permission).toBe('cockpit.read');
    expect(COCKPIT_REPORT.aggregation).toEqual(['meeting', 'status', 'unit']);
    expect(COCKPIT_REPORT.questionReferences).toBe(true);
    expect(COCKPIT_REPORT.minimumGroupSize).toBeNull();
  });
});

describe('Review 061 A, major 1: the meeting-level log is folded without the time cut', () => {
  const agenda = [{ id: 'top-1', number: 1, title: 'TOP 1' }];
  const created = (at: string) => ev('MeetingCreated', M, { title: 'Synthetisch', date: '2031-05-06', lifecycleVersion: 2,
    agendaItems: agenda, units: [{ id: 'u-fin', name: 'Finanzen' }] }, at);

  it('MeetingStarted after now, then MeetingClosed at now: no throw, closed', () => {
    const events = [created(ago(86_000)), ev('MeetingStarted', M, {}, ago(-1)), ev('MeetingClosed', M, {}, ago(0)),
      capture('q1', ago(100))];
    const cockpit = compute(events);
    expect(cockpit.meetingStatus).toBe('closed');
    expect(cockpit.totals.captured).toBe(1);
  });

  it('AgendaItemOpened after now, then VotingOpened at now: no throw, figures as without them', () => {
    const base = [created(ago(86_000)), ev('MeetingStarted', M, {}, ago(85_000)), capture('q1', ago(100))];
    const events = [...base, ev('AgendaItemOpened', M, { agendaItemId: 'top-1', number: 1 }, ago(-1)),
      ev('VotingOpened', M, { agendaItemId: 'top-1', number: 1 }, ago(0))];
    expect(compute(events)).toEqual(compute(base));
  });

  it('MeetingCreated after now: the meeting is found, no false 404', () => {
    const events = [created(ago(-5)), ev('MeetingStarted', M, {}, ago(-5)), capture('q1', ago(-4))];
    const cockpit = computeCockpit(events, NOW, M, allRead);
    expect(cockpit).toBeDefined();
    expect(cockpit!.totals.captured).toBe(0); // the capture after now counts nowhere
  });

  it('per question: a capture after now is dropped, its own events after now are cut', () => {
    const events = [...meeting(), capture('q1', ago(1000)), classify('q1', ago(900)), assignTo('q1', 'u-fin', ago(-10)),
      capture('q2', ago(-5)), classify('q2', ago(-4))];
    const cockpit = compute(events);
    expect(cockpit.totals.captured).toBe(1);
    expect(cockpit.openByStatus.classified).toBe(1);
    expect(cockpit.openByUnit['u-fin']).toBe(0);
    expect(cockpit.openUnassigned).toBe(1);
    expect(cockpit.oldestOpen.items.map((item) => [item.id, item.status, item.statusAgeSeconds])).toEqual([['q1', 'classified', 900]]);
  });
});

describe('Review 061 A, minor 2: getCockpit checks the canonical question record', () => {
  it('a unit-bound reader sees a reference by the unit of the projection, not of the time-cut record', async () => {
    const fixture = createInMemoryEventStore();
    fixture.append([...meeting(), ev('RoleAssigned', 'ra-1', { assignmentId: 'ra-1', subjectId: 'reader-061', role: 'coordination',
      unitId: 'u-ir' }, ago(80_000)),
      capture('q1', ago(5000)), classify('q1', ago(4900)), assignTo('q1', 'u-fin', ago(4800)),
      ev('QuestionForwarded', 'q1', { unitId: 'u-ir', reasonCode: 'wrong_unit' }, ago(-30))]
      .map(({ seq: _seq, ...event }) => event) as never);
    const bundle = ROLE_PERMISSIONS.coordination as unknown as { unitBoundRead?: true };
    // Today no holder of cockpit.read is unit-bound (K1); the test binds one for its duration only.
    bundle.unitBoundRead = true;
    try {
      const reader = createInProcessApi({ store: fixture, meetingId: M, clock: () => NOW,
        actor: () => ({ id: 'reader-061', role: 'coordination', assignmentScoped: true }) });
      const cockpit = await reader.getCockpit();
      expect(cockpit.oldestOpen.items.map((item) => item.id)).toEqual(['q1']);
      expect(cockpit.oldestOpen.items[0]!.unitId).toBe('u-fin'); // the figure stays at now; only the check is canonical
    } finally {
      delete bundle.unitBoundRead;
    }
    expect(ROLE_PERMISSIONS.coordination.unitBoundRead).toBeUndefined();
  });
});

describe('Review 061 A, test 5: two meetings', () => {
  it('the cockpit of meeting B counts only B while A is the current meeting', async () => {
    const two = createInMemoryEventStore();
    const mk = (id: string, date: string, questions: number): DomainEvent[] => [
      { ...ev('MeetingCreated', id, { title: id, date, lifecycleVersion: 2, agendaItems: [], units: [{ id: 'u-fin', name: 'Finanzen' }] },
        ago(86_000)), meetingId: id },
      { ...ev('MeetingStarted', id, {}, ago(85_000)), meetingId: id },
      ...Array.from({ length: questions }, (_, i) => ({ ...capture(`${id}-q${i}`, ago(500 + i)), meetingId: id })),
    ];
    two.append([...mk('hv-a', '2031-06-01', 3), ...mk('hv-b', '2031-05-01', 2)].map(({ seq: _seq, ...event }) => event) as never);
    const coordination: Actor = { id: 'coord-two-061', role: 'coordination' };
    const current = await createInProcessApi({ store: two, clock: () => NOW, actor: () => coordination }).getCockpit();
    const b = await createInProcessApi({ store: two, meetingId: 'hv-b', clock: () => NOW, actor: () => coordination }).getCockpit();
    expect(current.meetingId).toBe('hv-a');
    expect(current.totals.captured).toBe(3);
    expect(b.meetingId).toBe('hv-b');
    expect(b.totals.captured).toBe(2);
    expect(b.oldestOpen.items.every((item) => item.id.startsWith('hv-b-'))).toBe(true);
  });
});
