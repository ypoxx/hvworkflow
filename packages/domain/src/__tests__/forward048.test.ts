/**
 * Scheibe 048: forward a question to another answering unit (An anderen Fachbereich weiterleiten) in the
 * core — the right `question.forward` as data, the row R-TRANS-17 (status stays), the guard R-GUARD-15
 * (target is another unit), the event `QuestionForwarded` with a closed reason code (never free text),
 * the unit binding of the experts (R-PERM-03), the widened read circle of the target unit without the
 * refusal justification, idempotency, the claim that stays, counters, stream and envelope.
 * Built on the default ("auf Standard gebaut", E5 open; owner's go 04.10.2026). Every call goes through
 * `createInProcessApi` with an injected clock; after every rejected call the store's head is unchanged.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, can, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { verifyEventChain } from '../envelope.js';
import type { DomainEvent, NewEvent } from '../events.js';
import { computeIndicators } from '../indicators.js';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { seedEvents } from '../seed.js';
import { emptyState, project, reduce, type State } from '../state.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { EVENT_SUBJECTS, SCOPE_EXIT_EVENTS, replayMessage, visibleMessages, type StreamMessage } from '../stream.js';
import { resolveTransition } from '../transitions.js';
import {
  FORWARD_REASON_CODES, PERMISSIONS,
  type Actor, type ForwardReasonCode, type ForwardRequest, type Question, type QuestionStatus, type Role, type Track,
} from '../types.js';

const A = {
  admin: { id: 'adm48', role: 'admin' },
  moderation: { id: 'mod48', role: 'moderation' },
  capture: { id: 'cap48', role: 'capture' },
  coordination: { id: 'coo48', role: 'coordination' },
  /** Unbound demo expert (no assignment): sees every question, drafts in the setup. */
  expert: { id: 'exp48-demo', role: 'expert' },
  legal: { id: 'leg48', role: 'legal' },
  legal2: { id: 'leg48-b', role: 'legal' },
  approver: { id: 'app48', role: 'approver' },
  podium: { id: 'pod48', role: 'podium' },
  observer: { id: 'obs48', role: 'observer' },
} as const satisfies Record<string, Actor>;
/** Bound experts: the core resolves their assignment (`assignmentScoped`, unit) from `RoleAssigned`. */
const FIN: Actor = { id: 'exp48-fin', role: 'expert' };
const HR: Actor = { id: 'exp48-hr', role: 'expert' };
const ESG: Actor = { id: 'exp48-esg', role: 'expert' };
const NO_UNIT: Actor = { id: 'exp48-none', role: 'expert' };

const RETURN_MARK = 'RUECKGABE48X';
const JUSTIFICATION_MARK = 'BEGRUENDUNG48X';

let time: number;
let current: Actor;
let api: HvApi;
let store: EventStore;
let meetingId: string;
const as = (actor: Actor) => { current = actor; };

beforeEach(async () => {
  store = createInMemoryEventStore();
  time = Date.parse('2027-04-20T12:00:00.000Z');
  current = A.admin;
  api = createInProcessApi({ store, actor: () => current, clock: () => new Date((time += 1000)), seeder: seedEvents });
  await api.seedDemo({ questions: 30, seed: 7 });
  meetingId = (await api.getMeeting()).id;
  await api.assignRole({ subjectId: FIN.id, role: 'expert', unitId: 'unit-fin' });
  await api.assignRole({ subjectId: HR.id, role: 'expert', unitId: 'unit-hr' });
  await api.assignRole({ subjectId: ESG.id, role: 'expert', unitId: 'unit-esg' });
  await api.assignRole({ subjectId: NO_UNIT.id, role: 'expert' });
});

async function problemOf(p: Promise<unknown>): Promise<ApiProblem> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiProblem) return e;
    throw e;
  }
  throw new Error('expected an ApiProblem');
}
/** A rejected call: the problem, and no event was written. */
async function rejected(run: () => Promise<unknown>): Promise<ApiProblem> {
  const before = store.lastSeq();
  const p = await problemOf(run());
  expect(store.lastSeq()).toBe(before);
  return p;
}
async function asActor<T>(actor: Actor, run: () => Promise<T>): Promise<T> {
  const before = current;
  as(actor);
  try { return await run(); } finally { as(before); }
}
const read = (id: string, actor: Actor = A.admin): Promise<Question> => asActor(actor, () => api.getQuestion(id));

async function captured(text = 'Wie entwickelt sich die Synthesequote?'): Promise<Question> {
  as(A.moderation);
  const speaker = await api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
  as(A.capture);
  const contribution = await api.captureContribution({ speakerId: speaker.id, text }, { ifMatch: etagOf(speaker.version) });
  const [question] = await api.captureQuestions(contribution.id, [{ text }], { ifMatch: etagOf(contribution.version) });
  return question!;
}
async function classified(track: Track = 'expert_track'): Promise<Question> {
  const q = await captured();
  as(A.coordination);
  return api.classifyQuestion(q.id, { track }, { ifMatch: etagOf(q.version) });
}
async function assignedTo(unitId = 'unit-fin'): Promise<Question> {
  const q = await classified();
  as(A.coordination);
  return api.assignQuestion(q.id, unitId, { ifMatch: etagOf(q.version) });
}
async function drafted(q: Question): Promise<Question> {
  as(A.expert);
  return api.draftAnswer(q.id, { text: 'Belastbare Antwort.' }, { ifMatch: etagOf(q.version) });
}
async function inReview(unitId = 'unit-fin'): Promise<Question> {
  const d = await drafted(await assignedTo(unitId));
  as(A.expert);
  return api.submitForReview(d.id, { ifMatch: etagOf(d.version) });
}
async function legallyCleared(q: Question): Promise<Question> {
  as(A.legal);
  return api.clearQuestionLegally(q.id, { answerVersion: q.answers.at(-1)!.version }, { ifMatch: etagOf(q.version) });
}
async function approved(): Promise<Question> {
  const q = await legallyCleared(await inReview());
  as(A.approver);
  return api.approveQuestion(q.id, q.answers.at(-1)!.version, { ifMatch: etagOf(q.version) });
}
function forward(q: Question, actor: Actor, input: ForwardRequest, extra: { idempotencyKey?: string; ifMatch?: string | null } = {}): Promise<Question> {
  as(actor);
  const ifMatch = extra.ifMatch === undefined ? etagOf(q.version) : extra.ifMatch;
  return api.forwardQuestion(q.id, input, {
    ...(ifMatch !== null ? { ifMatch } : {}),
    ...(extra.idempotencyKey !== undefined ? { idempotencyKey: extra.idempotencyKey } : {}),
  });
}
const forwardEvents = (id: string): DomainEvent[] => store.all().filter((e) => e.type === 'QuestionForwarded' && e.subjectId === id);
/** The view without the fields a forward may change. */
const stable = (q: Question): Record<string, unknown> => {
  const { unitId: _unit, version: _version, updatedAt: _updated, _actions: _actionList, ...rest } = q;
  return rest;
};

/* ---------- 1 ---------- */

describe('Test 1: rights as data', () => {
  it('question.forward stands right after question.assign; holders are exactly coordination and expert; admin unchanged', () => {
    expect(PERMISSIONS.indexOf('question.forward')).toBe(PERMISSIONS.indexOf('question.assign') + 1);
    const holders = (Object.keys(ROLE_PERMISSIONS) as Role[]).filter((role) => ROLE_PERMISSIONS[role].includes('question.forward'));
    expect(holders.sort()).toEqual(['coordination', 'expert']);
    expect([...ROLE_PERMISSIONS.admin]).toEqual([
      'speaker.read', 'contribution.read', 'question.read', 'question.read.delivered', 'stage.read', 'history.read', 'event.read',
      'question.assign', 'question.return', 'agenda.manage', 'admin.roles.manage', 'admin.units.manage', 'admin.seats.manage', 'demo.seed',
    ]);
    expect(FORWARD_REASON_CODES).toEqual(['wrong_unit', 'expertise_elsewhere', 'capacity', 'other']);
  });
});

/* ---------- 2 ---------- */

describe('Test 2: R-TRANS-17 per source status', () => {
  const cases: [string, () => Promise<Question>][] = [
    ['assigned', () => assignedTo('unit-fin')],
    ['answer_drafted', async () => drafted(await assignedTo('unit-fin'))],
    ['in_review', async () => legallyCleared(await inReview('unit-fin'))],
  ];
  for (const [status, make] of cases) {
    it(`${status}: status, answers, approval, clearance, return reason, seat and claim stay; only the unit changes; one event`, async () => {
      let q = await make();
      // A running claim (legal in in_review, the unit's expert otherwise) must survive.
      q = await asActor(status === 'in_review' ? A.legal : FIN, () => api.claimQuestion(q.id, { ifMatch: etagOf(q.version) }));
      const before = await read(q.id);
      expect(before.status).toBe(status);
      if (status === 'in_review') expect(before.legalClearance).toBeDefined();
      const head = store.lastSeq();
      const result = await forward(before, A.coordination, { unitId: 'unit-hr', reasonCode: 'expertise_elsewhere' });
      expect(result.status).toBe(status);
      expect(result.unitId).toBe('unit-hr');
      const after = await read(q.id);
      expect(stable(after)).toEqual(stable(before));
      expect(after.claim).toEqual(before.claim);
      expect(project(store.all()).questions.get(q.id)!.claim).toBeDefined();
      const written = store.all().slice(head);
      expect(written).toHaveLength(1);
      const event = written[0]!;
      expect(event.type).toBe('QuestionForwarded');
      expect(Object.keys(event.payload).sort()).toEqual(['fromUnitId', 'reasonCode', 'unitId']);
      expect(event.payload).toEqual({ unitId: 'unit-hr', fromUnitId: 'unit-fin', reasonCode: 'expertise_elsewhere' });
      expect('pii' in event.payload).toBe(false);
      // R5: the table itself says "status stays" — the row resolves to the current status, for the next forward too.
      const record = project(store.all()).questions.get(q.id)!;
      expect(resolveTransition(record, 'question.forward', { unitId: 'unit-esg' }, { actor: A.coordination }))
        .toMatchObject({ ok: true, to: status, transition: { ruleId: 'R-TRANS-17' } });
    });
  }

  it('without a previous unit (fast track, drafted from classified): fromUnitId is absent', async () => {
    const q = await drafted(await classified('fast_track'));
    expect(q.unitId).toBeUndefined();
    expect(q.status).toBe('answer_drafted');
    const result = await forward(q, A.coordination, { unitId: 'unit-esg', reasonCode: 'wrong_unit' });
    expect(result).toMatchObject({ status: 'answer_drafted', unitId: 'unit-esg' });
    const [event] = forwardEvents(q.id);
    expect(Object.keys(event!.payload).sort()).toEqual(['reasonCode', 'unitId']);
  });
});

/* ---------- 3 ---------- */

describe('Test 3: R-TRANS-00', () => {
  it('captured, classified, approved, staged, delivered, closed, withdrawn, merged: 409 R-TRANS-00, no event', async () => {
    const byStatus = new Map<QuestionStatus, Question>();
    byStatus.set('captured', await captured());
    byStatus.set('classified', await classified());
    byStatus.set('approved', await approved());
    // Staged, delivered and closed, each on a fresh question, step by step.
    const s = await approved();
    const stagedQ = await asActor(A.moderation, () => api.stageQuestion(s.id, { ifMatch: etagOf(s.version) }));
    byStatus.set('staged', stagedQ);
    const d0 = await approved();
    const d1 = await asActor(A.moderation, () => api.stageQuestion(d0.id, { ifMatch: etagOf(d0.version) }));
    const deliveredQ = await asActor(A.podium, () => api.deliverQuestion(d1.id, { ifMatch: etagOf(d1.version) }));
    byStatus.set('delivered', deliveredQ);
    const c0 = await approved();
    const c1 = await asActor(A.moderation, () => api.stageQuestion(c0.id, { ifMatch: etagOf(c0.version) }));
    const c2 = await asActor(A.podium, () => api.deliverQuestion(c1.id, { ifMatch: etagOf(c1.version) }));
    byStatus.set('closed', await asActor(A.podium, () => api.closeQuestion(c2.id, { ifMatch: etagOf(c2.version) })));
    const w = await assignedTo();
    byStatus.set('withdrawn', await asActor(A.moderation, () => api.withdrawQuestion(w.id, 'Doppelt gestellt.', { ifMatch: etagOf(w.version) })));
    const target = await captured('Zielfrage?');
    const m = await captured('Dublette?');
    byStatus.set('merged', await asActor(A.capture, () => api.mergeQuestion(m.id, target.id, { ifMatch: etagOf(m.version) })));
    for (const [status, q] of byStatus) {
      const fresh = await read(q.id);
      expect(fresh.status, status).toBe(status);
      const p = await rejected(() => forward(fresh, A.coordination, { unitId: 'unit-esg', reasonCode: 'capacity' }));
      expect([p.status, p.ruleId], status).toEqual([409, 'R-TRANS-00']);
    }
  });
});

/* ---------- 4 ---------- */

describe('Test 4: R-GUARD-15', () => {
  it('target equals the current unit: 409 R-GUARD-15, no event; _actions still lists question.forward', async () => {
    const q = await assignedTo('unit-fin');
    expect((await read(q.id, A.coordination))._actions).toContain('question.forward');
    expect((await read(q.id, FIN))._actions).toContain('question.forward');
    const p = await rejected(() => forward(q, A.coordination, { unitId: 'unit-fin', reasonCode: 'other' }));
    expect([p.status, p.ruleId]).toEqual([409, 'R-GUARD-15']);
    const p2 = await rejected(() => forward(q, FIN, { unitId: 'unit-fin', reasonCode: 'other' }));
    expect([p2.status, p2.ruleId]).toEqual([409, 'R-GUARD-15']);
  });
});

/* ---------- 5 ---------- */

describe('Test 5: R-GUARD-03', () => {
  it('a podium question in assigned (constructed by a direct event): 409 R-GUARD-03', async () => {
    const q = await classified('podium');
    store.append([{ id: 'podium-assign-48', type: 'QuestionAssigned', at: new Date(time).toISOString(), actor: A.coordination,
      subjectId: q.id, meetingId, payload: { unitId: 'unit-fin' } } as NewEvent]);
    const fresh = await read(q.id);
    expect(fresh).toMatchObject({ status: 'assigned', track: 'podium', unitId: 'unit-fin' });
    const p = await rejected(() => forward(fresh, A.coordination, { unitId: 'unit-hr', reasonCode: 'wrong_unit' }));
    expect([p.status, p.ruleId]).toEqual([409, 'R-GUARD-03']);
  });
});

/* ---------- 6 ---------- */

describe('Test 6: 422 without an event', () => {
  it('unknown unit; reasonCode missing, unknown, not a string; unitId empty or 129 code points', async () => {
    const q = await assignedTo('unit-fin');
    const bad: [unknown, RegExp][] = [
      [{ unitId: 'unit-missing', reasonCode: 'wrong_unit' }, /unit-missing does not exist/],
      [{ unitId: 'unit-hr' }, /reasonCode/],
      [{ unitId: 'unit-hr', reasonCode: 'misc' }, /reasonCode/],
      [{ unitId: 'unit-hr', reasonCode: 42 }, /reasonCode/],
      [{ unitId: 'unit-hr', reasonCode: 'Die Kollegin ist krank' }, /reasonCode/],
      [{ unitId: '', reasonCode: 'wrong_unit' }, /unitId/],
      [{ unitId: 'x'.repeat(129), reasonCode: 'wrong_unit' }, /unitId/],
      [{ unitId: 7, reasonCode: 'wrong_unit' }, /unitId/],
      [{ reasonCode: 'wrong_unit' }, /unitId/],
    ];
    for (const [input, detail] of bad) {
      const p = await rejected(() => forward(q, A.coordination, input as ForwardRequest));
      expect(p.status, JSON.stringify(input)).toBe(422);
      expect(p.detail, JSON.stringify(input)).toMatch(detail);
      expect(p.detail).not.toContain('Kollegin');
    }
    // 128 code points (256 UTF-16 units) pass the length check and reach the unit lookup.
    const astral = '😀'.repeat(128);
    const p = await rejected(() => forward(q, A.coordination, { unitId: astral, reasonCode: 'wrong_unit' }));
    expect(p.status).toBe(422);
    expect(p.detail).toMatch(/does not exist/);
  });

  it('each of the four codes succeeds', async () => {
    let q = await assignedTo('unit-fin');
    const units = ['unit-hr', 'unit-esg', 'unit-strat', 'unit-fin'];
    for (const [i, reasonCode] of FORWARD_REASON_CODES.entries()) {
      q = await forward(q, A.coordination, { unitId: units[i]!, reasonCode });
      expect(q.unitId).toBe(units[i]);
    }
    expect(forwardEvents(q.id).map((e) => (e.payload as { reasonCode: ForwardReasonCode }).reasonCode)).toEqual([...FORWARD_REASON_CODES]);
  });
});

/* ---------- 7 ---------- */

describe('Test 7: rights', () => {
  it('moderation, capture, legal, approver, admin: 403 R-PERM-01; podium, observer: 404; no event', async () => {
    const q = await assignedTo('unit-fin');
    for (const actor of [A.moderation, A.capture, A.legal, A.approver, A.admin]) {
      const p = await rejected(() => forward(q, actor, { unitId: 'unit-hr', reasonCode: 'wrong_unit' }));
      expect([p.status, p.ruleId], actor.role).toEqual([403, 'R-PERM-01']);
    }
    for (const actor of [A.podium, A.observer]) {
      const p = await rejected(() => forward(q, actor, { unitId: 'unit-hr', reasonCode: 'wrong_unit' }));
      expect(p.status, actor.role).toBe(404);
    }
  });
});

/* ---------- 8 ---------- */

describe('Test 8: unit binding and the widened read circle', () => {
  it('(a) the unit-fin expert forwards to unit-hr: 200 with empty _actions, then 404; unit-hr sees it; unit-esg 404', async () => {
    const q = await assignedTo('unit-fin');
    const result = await forward(q, FIN, { unitId: 'unit-hr', reasonCode: 'wrong_unit' });
    expect(result.status).toBe('assigned');
    expect(result.unitId).toBe('unit-hr');
    expect(result._actions).toEqual([]);
    expect((await problemOf(read(q.id, FIN))).status).toBe(404);
    expect((await asActor(FIN, () => api.listQuestions())).items.map((x) => x.id)).not.toContain(q.id);
    const asHr = await read(q.id, HR);
    expect(asHr._actions).toContain('question.forward');
    expect((await asActor(HR, () => api.listQuestions())).items.map((x) => x.id)).toContain(q.id);
    const p = await rejected(() => forward(asHr, ESG, { unitId: 'unit-esg', reasonCode: 'capacity' }));
    expect(p.status).toBe(404);
    expect(forwardEvents(q.id)).toHaveLength(1);
  });

  it('(a) the target unit reads the return reason and the QuestionReturned of the history (named widened circle)', async () => {
    const r = await inReview('unit-fin');
    const returned = await asActor(A.legal, () => api.returnQuestion(r.id, `${RETURN_MARK}: Quelle fehlt.`, { ifMatch: etagOf(r.version) }));
    expect(returned.status).toBe('answer_drafted');
    expect((await problemOf(read(r.id, HR))).status).toBe(404);
    await forward(returned, FIN, { unitId: 'unit-hr', reasonCode: 'expertise_elsewhere' });
    const asHr = await read(r.id, HR);
    expect(asHr.returnReason).toContain(RETURN_MARK);
    const history = await asActor(HR, () => api.getQuestionHistory(r.id));
    const ret = history.find((e) => e.type === 'QuestionReturned');
    expect(ret && 'reason' in ret.payload ? ret.payload.reason : undefined).toContain(RETURN_MARK);
  });

  it('(b) an open refusal proposal: the target unit sees kind, ground and wording, never the justification', async () => {
    const q = await assignedTo('unit-fin');
    const proposed = await asActor(A.legal, () => api.proposeRefusal(q.id, {
      answerKind: 'refusal_with_ground', text: 'Zu dieser Frage gibt der Vorstand keine Auskunft.', refusalGroundId: 'aktg-131-3-nr1',
      refusalJustification: `${JUSTIFICATION_MARK}: Offenlegung schadet der Gesellschaft.`,
    }, { ifMatch: etagOf(q.version) }));
    expect(proposed.status).toBe('in_review');
    await forward(proposed, A.coordination, { unitId: 'unit-hr', reasonCode: 'expertise_elsewhere' });
    const asHr = await read(q.id, HR);
    const latest = asHr.answers.at(-1)!;
    expect(latest).toMatchObject({ answerKind: 'refusal_with_ground', refusalGroundId: 'aktg-131-3-nr1', text: 'Zu dieser Frage gibt der Vorstand keine Auskunft.' });
    expect('refusalJustification' in latest).toBe(false);
    const list = await asActor(HR, () => api.listQuestions());
    const history = await asActor(HR, () => api.getQuestionHistory(q.id));
    for (const payload of [asHr, list, history]) {
      const raw = JSON.stringify(payload);
      expect(raw).not.toContain(JUSTIFICATION_MARK);
      expect(raw).not.toContain('"pii"');
      expect(raw).not.toContain('refusalJustification');
    }
  });

  it('(c) a bound expert without a unit on a question without a unit: 404, no event', async () => {
    const q = await drafted(await classified('fast_track'));
    expect(q.unitId).toBeUndefined();
    const p = await rejected(() => forward(q, NO_UNIT, { unitId: 'unit-fin', reasonCode: 'wrong_unit' }));
    expect(p.status).toBe(404);
  });
});

/* ---------- 9 ---------- */

describe('Test 9: idempotency', () => {
  it('coordination repeats with the same key: same answer, one event', async () => {
    const q = await assignedTo('unit-fin');
    const first = await forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'capacity' }, { idempotencyKey: 'fwd48-coo' });
    const head = store.lastSeq();
    const again = await forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'capacity' }, { idempotencyKey: 'fwd48-coo' });
    expect(again).toEqual(first);
    expect(store.lastSeq()).toBe(head);
    expect(forwardEvents(q.id)).toHaveLength(1);
  });

  it('the bound expert repeats after forwarding out of his unit: 404, still one event', async () => {
    const q = await assignedTo('unit-fin');
    await forward(q, FIN, { unitId: 'unit-hr', reasonCode: 'wrong_unit' }, { idempotencyKey: 'fwd48-fin' });
    const p = await rejected(() => forward(q, FIN, { unitId: 'unit-hr', reasonCode: 'wrong_unit' }, { idempotencyKey: 'fwd48-fin' }));
    expect(p.status).toBe(404);
    expect(forwardEvents(q.id)).toHaveLength(1);
  });

  it('9b: removing the target unit after the forward is 409 R-ADM-02; the coordination replay then returns the stored result', async () => {
    // Target without questions and without assignments, so only the forwarded question can block its removal.
    expect((await asActor(A.admin, () => api.listQuestions({ unitId: 'unit-ar' }))).total).toBe(0);
    const q = await assignedTo('unit-fin');
    const first = await forward(q, A.coordination, { unitId: 'unit-ar', reasonCode: 'wrong_unit' }, { idempotencyKey: 'fwd48-9b' });
    const meeting = await asActor(A.admin, () => api.getMeeting());
    const units = (await asActor(A.admin, () => api.listUnits())).filter((u) => u.id !== 'unit-ar');
    const p = await rejected(() => asActor(A.admin, () => api.replaceMeetingUnits(meetingId,
      units.map((u) => ({ id: u.id, name: u.name, ...(u.shortName !== undefined ? { shortName: u.shortName } : {}) })),
      { ifMatch: etagOf(meeting.version ?? 1) })));
    expect([p.status, p.ruleId]).toEqual([409, 'R-ADM-02']);
    const again = await forward(q, A.coordination, { unitId: 'unit-ar', reasonCode: 'wrong_unit' }, { idempotencyKey: 'fwd48-9b' });
    expect(again).toEqual(first);
    expect(forwardEvents(q.id)).toHaveLength(1);
  });

  it('9b: the 422 replay is reachable after a re-forward and the removal of the old target (accepted, as assignQuestion)', async () => {
    expect((await asActor(A.admin, () => api.listQuestions({ unitId: 'unit-ar' }))).total).toBe(0);
    const q = await assignedTo('unit-fin');
    // 1. fin → ar with K1; 2. ar → hr with K2.
    const first = await forward(q, A.coordination, { unitId: 'unit-ar', reasonCode: 'wrong_unit' }, { idempotencyKey: 'fwd48-k1' });
    await forward(first, A.coordination, { unitId: 'unit-hr', reasonCode: 'capacity' }, { idempotencyKey: 'fwd48-k2' });
    // 3. Nothing references unit-ar any more: the administration removes it.
    const meeting = await asActor(A.admin, () => api.getMeeting());
    const units = (await asActor(A.admin, () => api.listUnits())).filter((u) => u.id !== 'unit-ar');
    await asActor(A.admin, () => api.replaceMeetingUnits(meetingId,
      units.map((u) => ({ id: u.id, name: u.name, ...(u.shortName !== undefined ? { shortName: u.shortName } : {}) })),
      { ifMatch: etagOf(meeting.version ?? 1) }));
    const count = forwardEvents(q.id).length;
    expect(count).toBe(2);
    // 4. The replay of K1 checks the unit before the replay lookup: 422, no new event.
    const p = await rejected(() => forward(first, A.coordination, { unitId: 'unit-ar', reasonCode: 'wrong_unit' }, { idempotencyKey: 'fwd48-k1' }));
    expect(p.status).toBe(422);
    expect(p.detail).toBe('Unit unit-ar does not exist.');
    expect(forwardEvents(q.id)).toHaveLength(count);
  });
});

/* ---------- 10 ---------- */

describe('Test 10: If-Match', () => {
  it('missing: 428; stale: 412; no event', async () => {
    const q = await assignedTo('unit-fin');
    expect((await rejected(() => forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'other' }, { ifMatch: null }))).status).toBe(428);
    expect((await rejected(() => forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'other' }, { ifMatch: etagOf(q.version - 1) }))).status).toBe(412);
  });
});

/* ---------- 11 ---------- */

describe('Test 11: the claim stays', () => {
  it('a unit-fin claim survives; unit-hr drafts at once, its own claim is 409 R-CLAIM-01 until expiry and succeeds after', async () => {
    const q = await assignedTo('unit-fin');
    const claimed = await asActor(FIN, () => api.claimQuestion(q.id, { ifMatch: etagOf(q.version) }));
    expect(claimed.claim?.actorId).toBe(FIN.id);
    const forwarded = await forward(claimed, A.coordination, { unitId: 'unit-hr', reasonCode: 'capacity' });
    expect(forwarded.claim).toEqual(claimed.claim);
    expect(project(store.all()).questions.get(q.id)!.claim).toMatchObject({ actorId: FIN.id, expiresAt: claimed.claim!.expiresAt });
    expect((await read(q.id, HR)).claim).toEqual(claimed.claim);
    const draftedByHr = await asActor(HR, () => api.draftAnswer(q.id, { text: 'Antwort aus dem Personalbereich.' }, { ifMatch: etagOf(forwarded.version) }));
    expect(draftedByHr.status).toBe('answer_drafted');
    const p = await rejected(() => asActor(HR, () => api.claimQuestion(q.id, { ifMatch: etagOf(draftedByHr.version) })));
    expect([p.status, p.ruleId]).toEqual([409, 'R-CLAIM-01']);
    time = Date.parse(claimed.claim!.expiresAt) + 1000;
    const own = await asActor(HR, () => api.claimQuestion(q.id, { ifMatch: etagOf(draftedByHr.version) }));
    expect(own.claim?.actorId).toBe(HR.id);
  });

  it('a legal claim in in_review survives the forward', async () => {
    const q = await inReview('unit-fin');
    const claimed = await asActor(A.legal, () => api.claimQuestion(q.id, { ifMatch: etagOf(q.version) }));
    const forwarded = await forward(claimed, A.coordination, { unitId: 'unit-esg', reasonCode: 'expertise_elsewhere' });
    expect(forwarded.status).toBe('in_review');
    expect(forwarded.claim).toEqual(claimed.claim);
    expect(forwarded.claim?.actorId).toBe(A.legal.id);
  });
});

/* ---------- 12 ---------- */

describe('Test 12: counters', () => {
  it('counts.byUnit and openQuestionsByUnit move by one; an in_review question keeps counting in legal review', async () => {
    const q = await inReview('unit-fin');
    time += 11 * 60_000;
    const before = (await api.getMeeting()).counts.byUnit!;
    const indicatorsBefore = computeIndicators(store.all(), new Date(time)).meetings.find((m) => m.meetingId === meetingId)!;
    expect(indicatorsBefore.questionsInLegalReviewOver10m).toBeGreaterThanOrEqual(1);
    await forward(await read(q.id), A.coordination, { unitId: 'unit-hr', reasonCode: 'wrong_unit' });
    const after = (await api.getMeeting()).counts.byUnit!;
    expect(after['unit-fin']).toBe(before['unit-fin']! - 1);
    expect(after['unit-hr']).toBe(before['unit-hr']! + 1);
    const indicatorsAfter = computeIndicators(store.all(), new Date(time)).meetings.find((m) => m.meetingId === meetingId)!;
    expect(indicatorsAfter.openQuestionsByUnit['unit-fin']).toBe(indicatorsBefore.openQuestionsByUnit['unit-fin']! - 1);
    expect(indicatorsAfter.openQuestionsByUnit['unit-hr']).toBe(indicatorsBefore.openQuestionsByUnit['unit-hr']! + 1);
    expect(indicatorsAfter.questionsInLegalReviewOver10m).toBe(indicatorsBefore.questionsInLegalReviewOver10m);
  });
});

/* ---------- 13 ---------- */

describe('Test 13: stream', () => {
  const statesOf = (events: readonly DomainEvent[]): Map<string, State> => {
    const out = new Map<string, State>();
    for (const e of events) {
      if (!e.meetingId) continue;
      let s = out.get(e.meetingId);
      if (!s) { s = emptyState(); out.set(e.meetingId, s); }
      reduce(s, e);
    }
    return out;
  };
  const deps = { can };
  /** The unit-bound reader as the stream resolves it (assignment context from the projection). */
  const STREAM_FIN: Actor = { id: 'reader-exp48-fin', role: 'expert', assignmentScoped: true, unitId: 'unit-fin' };
  /** The reader bound to the target unit: the question enters its scope with the forward (T-G1-I-09). */
  const STREAM_HR: Actor = { id: 'reader-exp48-hr', role: 'expert', assignmentScoped: true, unitId: 'unit-hr' };
  const readers = (actor: Actor) => new Map([[meetingId, actor]]);
  const eventsOf = (messages: readonly StreamMessage[]) => messages.flatMap((m) => (m.kind === 'event' ? [m.event] : []));

  it('scope exit: a change without content live, a reset on catch-up for unit-fin; event.read gets the code; subjects', async () => {
    expect(SCOPE_EXIT_EVENTS.has('QuestionForwarded')).toBe(true);
    const q = await assignedTo('unit-fin');
    const from = store.lastSeq();
    const before = statesOf(store.all());
    await forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'wrong_unit' });
    const batch = store.all().slice(from);
    const after = statesOf(store.all());
    expect(batch.map((e) => e.type)).toEqual(['QuestionForwarded']);

    const live = visibleMessages(readers(STREAM_FIN), batch, before, after, deps);
    expect(eventsOf(live)).toEqual([]);
    expect(live.some((m) => m.kind === 'change')).toBe(true);
    expect(JSON.stringify(live)).not.toContain('reasonCode');

    expect(replayMessage(readers(STREAM_FIN), batch, after, deps)).toEqual({ kind: 'reset' });

    // The target unit: live a change that names the question (it is readable after the batch), on catch-up a reset.
    const liveHr = visibleMessages(readers(STREAM_HR), batch, before, after, deps);
    expect(eventsOf(liveHr)).toEqual([]);
    const changeHr = liveHr.find((m) => m.kind === 'change');
    expect(changeHr?.kind === 'change' ? changeHr.change.subjects : undefined).toContain(q.id);
    expect(changeHr?.kind === 'change' ? changeHr.change.topics : undefined).toContain('questions');
    expect(JSON.stringify(liveHr)).not.toContain('reasonCode');
    expect(replayMessage(readers(STREAM_HR), batch, after, deps)).toEqual({ kind: 'reset' });

    const asAdmin = eventsOf(visibleMessages(readers({ id: 'reader-adm48', role: 'admin' }), batch, before, after, deps));
    expect(asAdmin).toHaveLength(1);
    expect(asAdmin[0]!.payload).toMatchObject({ unitId: 'unit-hr', fromUnitId: 'unit-fin', reasonCode: 'wrong_unit' });

    const event = batch[0]! as Extract<DomainEvent, { type: 'QuestionForwarded' }>;
    expect(EVENT_SUBJECTS.QuestionForwarded(event)).toEqual([{ kind: 'question', id: q.id }, { kind: 'meeting', id: meetingId }]);
  });
});

/* ---------- 14 ---------- */

describe('Test 14: read paths of the code', () => {
  it('history as coordination carries the code; the question view and the stage do not', async () => {
    const q = await assignedTo('unit-fin');
    await forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'expertise_elsewhere' });
    const history = await asActor(A.coordination, () => api.getQuestionHistory(q.id));
    const fwd = history.find((e) => e.type === 'QuestionForwarded');
    expect(fwd?.payload).toEqual({ unitId: 'unit-hr', fromUnitId: 'unit-fin', reasonCode: 'expertise_elsewhere' });
    expect(JSON.stringify(await read(q.id, A.coordination))).not.toContain('reasonCode');
    expect(JSON.stringify(await read(q.id, HR))).not.toContain('expertise_elsewhere');
    expect(JSON.stringify(await asActor(A.moderation, () => api.getStage()))).not.toContain('reasonCode');
  });
});

/* ---------- 15 ---------- */

describe('Test 15: envelope', () => {
  it('a log with QuestionForwarded stamps and loads with the chain check; a misspelt type does not load', async () => {
    const q = await assignedTo('unit-fin');
    await forward(q, A.coordination, { unitId: 'unit-hr', reasonCode: 'other' });
    const log = [...store.all()];
    expect(() => verifyEventChain(log)).not.toThrow();
    expect(() => createInMemoryEventStore({ load: () => log, save: () => undefined })).not.toThrow();
    const typo = log.map((e) => (e.type === 'QuestionForwarded' ? { ...e, type: 'QuestionFowarded' } : e)) as unknown as DomainEvent[];
    expect(() => createInMemoryEventStore({ load: () => typo, save: () => undefined })).toThrow(/type/);
  });
});
