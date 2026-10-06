/**
 * Scheibe 046: follow-up threads (Nachfragen-Threads) in the core. A captured question may name a
 * referenced question (Bezugsfrage) of the same meeting as a follow-up question (Nachfrage) or a
 * clarification (Klarstellung). The reference is the event `QuestionLinked`, written in the same
 * command right after the `QuestionCaptured` of the new question (R-LINK-01 at capture, R-LINK-02 in
 * the reducer). The view masks the referenced id and the read-out answer version for readers who may
 * not read the referenced question; the stage and every event read path never carry them.
 * Built on the defaults ("auf Standard gebaut (Spec 046)"). Every call goes through
 * `createInProcessApi` with an injected clock; after every rejected call the store's head is unchanged.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, can, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { verifyEventChain } from '../envelope.js';
import type { DomainEvent, NewEvent } from '../events.js';
import { ruleRegister } from '../rules.js';
import { seedEvents } from '../seed.js';
import { emptyState, project, reduce, type State } from '../state.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import {
  EVENT_SUBJECTS, EVENT_TOPICS, SCOPE_EXIT_EVENTS, maskEvent, snapshotBefore, visibleMessages, type StreamMessage,
} from '../stream.js';
import {
  QUESTION_RELATIONS,
  type Actor, type Contribution, type Question, type QuestionCapture, type QuestionRecord, type Track,
} from '../types.js';

const A = {
  admin: { id: 'adm46', role: 'admin' },
  moderation: { id: 'mod46', role: 'moderation' },
  capture: { id: 'cap46', role: 'capture' },
  coordination: { id: 'coo46', role: 'coordination' },
  /** Unbound demo expert (no assignment): sees every question, drafts in the setup. */
  expert: { id: 'exp46-demo', role: 'expert' },
  legal: { id: 'leg46', role: 'legal' },
  approver: { id: 'app46', role: 'approver' },
  podium: { id: 'pod46', role: 'podium' },
  observer: { id: 'obs46', role: 'observer' },
} as const satisfies Record<string, Actor>;
/** Bound experts: the core resolves their assignment (`assignmentScoped`, unit) from `RoleAssigned`. */
const FIN: Actor = { id: 'exp46-fin', role: 'expert' };
const HR: Actor = { id: 'exp46-hr', role: 'expert' };

const PARENT_MARK = 'BEZUGSFRAGE46X';
const OTHER_MEETING = 'hv-046-other';

let time: number;
let current: Actor;
let api: HvApi;
let store: EventStore;
let meetingId: string;
const as = (actor: Actor) => { current = actor; };
const at = (): string => new Date((time += 1000)).toISOString();

beforeEach(async () => {
  store = createInMemoryEventStore();
  time = Date.parse('2027-04-20T12:00:00.000Z');
  current = A.admin;
  api = createInProcessApi({ store, actor: () => current, clock: () => new Date((time += 1000)), seeder: seedEvents });
  await api.seedDemo({ questions: 30, seed: 7 });
  meetingId = (await api.getMeeting()).id;
  await api.assignRole({ subjectId: FIN.id, role: 'expert', unitId: 'unit-fin' });
  await api.assignRole({ subjectId: HR.id, role: 'expert', unitId: 'unit-hr' });
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
const record = (id: string): QuestionRecord => project(store.all().filter((e) => e.meetingId === meetingId)).questions.get(id)!;

async function contribution(text = 'Wie entwickelt sich die Synthesequote, und was folgt daraus?'): Promise<Contribution> {
  as(A.moderation);
  const speaker = await api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
  as(A.capture);
  return api.captureContribution({ speakerId: speaker.id, text }, { ifMatch: etagOf(speaker.version) });
}
function capture(c: Contribution, items: QuestionCapture[], extra: { idempotencyKey?: string; ifMatch?: string | null; actor?: Actor } = {}): Promise<Question[]> {
  as(extra.actor ?? A.capture);
  const ifMatch = extra.ifMatch === undefined ? etagOf(c.version) : extra.ifMatch;
  return api.captureQuestions(c.id, items, {
    ...(ifMatch !== null ? { ifMatch } : {}),
    ...(extra.idempotencyKey !== undefined ? { idempotencyKey: extra.idempotencyKey } : {}),
  });
}
async function captured(text = 'Wie entwickelt sich die Synthesequote?'): Promise<Question> {
  const c = await contribution(text);
  const [q] = await capture(c, [{ text }]);
  return q!;
}
async function followUp(parentId: string, relation: 'follow_up' | 'clarification' = 'follow_up', text = 'Und warum genau?'): Promise<Question> {
  const c = await contribution(text);
  const [q] = await capture(c, [{ text, parentQuestionId: parentId, relation }]);
  return q!;
}
const classify = (q: Question, track: Track = 'expert_track') => asActor(A.coordination, () => api.classifyQuestion(q.id, { track }, { ifMatch: etagOf(q.version) }));
const assign = (q: Question, unitId: string) => asActor(A.coordination, () => api.assignQuestion(q.id, unitId, { ifMatch: etagOf(q.version) }));
const draft = (q: Question, text = 'Belastbare Antwort.') => asActor(A.expert, () => api.draftAnswer(q.id, { text }, { ifMatch: etagOf(q.version) }));
const submit = (q: Question) => asActor(A.expert, () => api.submitForReview(q.id, { ifMatch: etagOf(q.version) }));
const clear = (q: Question) => asActor(A.legal, () => api.clearQuestionLegally(q.id,
  q.answers.length > 0 ? { answerVersion: q.answers.at(-1)!.version } : {}, { ifMatch: etagOf(q.version) }));
const approve = (q: Question) => asActor(A.approver, () => api.approveQuestion(q.id, q.answers.at(-1)!.version, { ifMatch: etagOf(q.version) }));
const stage = (q: Question) => asActor(A.moderation, () => api.stageQuestion(q.id, { ifMatch: etagOf(q.version) }));
const deliver = (q: Question, idempotencyKey?: string) => asActor(A.podium, () => api.deliverQuestion(q.id,
  { ifMatch: etagOf(q.version), ...(idempotencyKey !== undefined ? { idempotencyKey } : {}) }));
const giveBack = (q: Question) => asActor(A.moderation, () => api.returnQuestion(q.id, 'Korrektur nötig.', { ifMatch: etagOf(q.version) }));
async function toApproved(q: Question, unitId = 'unit-fin'): Promise<Question> {
  return approve(await clear(await submit(await draft(await assign(await classify(q), unitId)))));
}
async function toDelivered(q: Question, unitId = 'unit-fin'): Promise<Question> {
  return deliver(await stage(await toApproved(q, unitId)));
}
/** Version 1 read out, returned, a newer draft version 2 (not read out). */
async function parentWithNewerDraft(): Promise<Question> {
  const delivered = await toDelivered(await captured(`${PARENT_MARK} Wie hoch ist die Quote?`));
  return draft(await giveBack(delivered), 'Neue Fassung.');
}
const linkEvents = (id?: string): DomainEvent[] =>
  store.all().filter((e) => e.type === 'QuestionLinked' && (id === undefined || e.subjectId === id));
const REF_KEYS = ['parentQuestionId', 'relation', 'parentAnswerVersion'] as const;
const hasNoRefKeys = (q: object): boolean => REF_KEYS.every((key) => !Object.hasOwn(q, key));

/** A second meeting in the same global log, older and in preparation, so the demo alias stays put. */
function appendOtherMeeting(questionIds: string[]): void {
  store.append([
    { id: `create-${OTHER_MEETING}`, type: 'MeetingCreated', at: at(), actor: A.admin, subjectId: OTHER_MEETING, meetingId: OTHER_MEETING,
      payload: { title: 'HV alt', date: '2020-04-20', agendaItems: [{ id: 'top-old', number: 1, title: 'Aussprache' }], units: [], lifecycleVersion: 2 } },
    ...questionIds.flatMap((id): NewEvent[] => [
      { id: `other-cap-${id}`, type: 'QuestionCaptured', at: at(), actor: A.admin, subjectId: id, meetingId: OTHER_MEETING,
        payload: { number: 'F-0001', contributionId: 'other-contribution', speakerId: 'other-speaker', text: 'Fremde Frage' } },
      { id: `other-del-${id}`, type: 'QuestionDelivered', at: at(), actor: A.admin, subjectId: id, meetingId: OTHER_MEETING,
        payload: { answerVersion: 9 } },
    ]),
  ] as NewEvent[]);
}
/** A complete command envelope for a forged event (the chain check requires all three fields). */
const cmd = (commandId: string) => ({ commandId, commandOperation: 'forged', commandResource: 'forged' });
let rawCounter = 0;
const raw = (type: string, subjectId: string, payload: object, extra: object = {}): NewEvent =>
  ({ id: `raw46-${(rawCounter += 1)}`, type, at: at(), actor: A.capture, subjectId, meetingId, payload, ...extra }) as unknown as NewEvent;
const rawCapture = (id: string, extra: object = {}): NewEvent =>
  raw('QuestionCaptured', id, { number: `F-9${String(rawCounter).padStart(3, '0')}`, contributionId: 'raw-contribution', speakerId: 'raw-speaker', text: `Rohfrage ${id}` }, extra);
const rawLink = (id: string, parentQuestionId: string, extra: object = {}, payload: object = {}): NewEvent =>
  raw('QuestionLinked', id, { parentQuestionId, relation: 'follow_up', ...payload }, extra);

/* ---------- 1 ---------- */

describe('Test 1: capture with a follow-up reference', () => {
  it('Captured then Linked (next seq, same commandId); payload with the read-out version; parent ETag stable; contribution ETag as without reference', async () => {
    const parent = await parentWithNewerDraft();
    expect(parent.answers.map((a) => a.version)).toEqual([1, 2]);
    const parentBefore = await read(parent.id);
    const c = await contribution('Nachfrage zur Quote: warum gerade jetzt?');
    const speakerBefore = await asActor(A.moderation, () => api.getSpeaker(c.speakerId));
    const listBefore = (await api.getMeeting()).speakerListVersion;
    const head = store.lastSeq();
    const [child] = await capture(c, [{ text: 'Warum gerade jetzt?', parentQuestionId: parent.id, relation: 'follow_up' }]);
    const written = store.all().slice(head);
    expect(written.map((e) => e.type)).toEqual(['QuestionCaptured', 'QuestionLinked']);
    const [cap, link] = written as [DomainEvent, DomainEvent];
    expect(link.seq).toBe(cap.seq + 1);
    expect(link.commandId).toBeDefined();
    expect(link.commandId).toBe(cap.commandId);
    expect(link.subjectId).toBe(child!.id);
    expect(link.meetingId).toBe(meetingId);
    expect(link.payload).toEqual({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1 });
    expect(Object.keys(link.payload).sort()).toEqual(['parentAnswerVersion', 'parentQuestionId', 'relation']);
    expect('pii' in link.payload).toBe(false);
    expect(child).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1, version: 2 });
    // Parent ETag stable: neither version nor updatedAt moves.
    const parentAfter = await read(parent.id);
    expect([parentAfter.version, parentAfter.updatedAt]).toEqual([parentBefore.version, parentBefore.updatedAt]);
    // The speaker request and the speaker list move by the one QuestionCaptured only, as without a reference.
    const speakerAfter = await asActor(A.moderation, () => api.getSpeaker(c.speakerId));
    expect(speakerAfter.version).toBe(speakerBefore.version + 1);
    expect((await api.getMeeting()).speakerListVersion).toBe(listBefore + 1);
    // The contribution rises by the one question: the answer's ETag is that of a capture without reference.
    expect(api.lastWriteEtag()).toBe(etagOf(c.version + 1));
    const plain = await contribution('Ohne Bezug.');
    await capture(plain, [{ text: 'Ohne Bezug?' }]);
    expect(api.lastWriteEtag()).toBe(etagOf(plain.version + 1));
  });
});

/* ---------- 2 ---------- */

describe('Test 2: parentAnswerVersion follows what was read out', () => {
  it('never read out (approved, staged): the field is absent in payload and view', async () => {
    const approved = await toApproved(await captured());
    const a = await followUp(approved.id);
    expect(Object.hasOwn(a, 'parentAnswerVersion')).toBe(false);
    expect(Object.hasOwn(linkEvents(a.id)[0]!.payload, 'parentAnswerVersion')).toBe(false);
    const staged = await stage(await toApproved(await captured()));
    const b = await followUp(staged.id);
    expect(Object.hasOwn(b, 'parentAnswerVersion')).toBe(false);
    expect(b.parentQuestionId).toBe(staged.id);
  });

  it('a podium question read out without an answer version: the field is absent', async () => {
    const podium = await deliver(await stage(await clear(await classify(await captured(), 'podium'))));
    expect(podium.status).toBe('delivered');
    expect(store.all().filter((e) => e.type === 'QuestionDelivered' && e.subjectId === podium.id).at(-1)!.payload).toEqual({});
    const child = await followUp(podium.id);
    expect(Object.hasOwn(child, 'parentAnswerVersion')).toBe(false);
    expect(Object.hasOwn(linkEvents(child.id)[0]!.payload, 'parentAnswerVersion')).toBe(false);
  });

  it('correction and second read-out: 1 between the read-outs, 2 afterwards, the first keeps 1', async () => {
    const delivered = await toDelivered(await captured());
    const between = await followUp(delivered.id);
    expect(between.parentAnswerVersion).toBe(1);
    const v2 = await draft(await giveBack(await read(delivered.id)), 'Korrigierte Fassung.');
    const redelivered = await deliver(await stage(await approve(await clear(await submit(v2)))));
    expect(redelivered.answers.map((a) => a.version)).toEqual([1, 2]);
    const after = await followUp(delivered.id);
    expect(after.parentAnswerVersion).toBe(2);
    expect((await read(between.id)).parentAnswerVersion).toBe(1);
    expect(record(between.id).parentAnswerVersion).toBe(1);
  });

  it('deliveredAnswerVersion stands in no view, also not in a replayed answer; the rebuilt projection holds it', async () => {
    const approved = await stage(await toApproved(await captured()));
    const delivered = await deliver(approved, 'deliver-046-key');
    const replayed = await deliver(approved, 'deliver-046-key');
    expect(replayed.id).toBe(delivered.id);
    const staged = await stage(await toApproved(await captured()));
    const views: unknown[] = [
      delivered, replayed,
      await read(delivered.id), await read(delivered.id, A.observer),
      (await asActor(A.admin, () => api.listQuestions({}))).items,
      await asActor(A.moderation, () => api.getStage()),
      await read(staged.id),
    ];
    for (const view of views) expect(JSON.stringify(view)).not.toContain('deliveredAnswerVersion');
    expect(record(delivered.id).deliveredAnswerVersion).toBe(1);
    expect(project(store.all().filter((e) => e.meetingId === meetingId)).questions.get(delivered.id)!.deliveredAnswerVersion).toBe(1);
  });
});

/* ---------- 3 ---------- */

describe('Test 3: mixed call and calls without reference', () => {
  it('three questions, two with reference: Captured, Linked, Captured, Linked, Captured; the third has none of the keys', async () => {
    const p1 = await captured('Erste Bezugsfrage?');
    const p2 = await captured('Zweite Bezugsfrage?');
    const c = await contribution('Drei Fragen in einem Beitrag, zwei davon mit Bezug.');
    const head = store.lastSeq();
    const views = await capture(c, [
      { text: 'Eins?', parentQuestionId: p1.id, relation: 'follow_up' },
      { text: 'Zwei?', parentQuestionId: p2.id, relation: 'clarification' },
      { text: 'Drei?' },
    ]);
    const written = store.all().slice(head);
    expect(written.map((e) => [e.type, e.subjectId])).toEqual([
      ['QuestionCaptured', views[0]!.id], ['QuestionLinked', views[0]!.id],
      ['QuestionCaptured', views[1]!.id], ['QuestionLinked', views[1]!.id],
      ['QuestionCaptured', views[2]!.id],
    ]);
    // The legitimate adjacent pair applies, with equal commandId on both events.
    expect(new Set(written.map((e) => e.commandId)).size).toBe(1);
    expect(views[0]).toMatchObject({ parentQuestionId: p1.id, relation: 'follow_up' });
    expect(views[1]).toMatchObject({ parentQuestionId: p2.id, relation: 'clarification' });
    expect(hasNoRefKeys(views[2]!)).toBe(true);
    const rebuilt = project(store.all().filter((e) => e.meetingId === meetingId));
    expect(rebuilt.questions.get(views[0]!.id)).toMatchObject({ parentQuestionId: p1.id, relation: 'follow_up' });
    expect(rebuilt.questions.get(views[1]!.id)).toMatchObject({ parentQuestionId: p2.id, relation: 'clarification' });
    expect(hasNoRefKeys(rebuilt.questions.get(views[2]!.id)!)).toBe(true);
  });

  it('the adjacent raw pair applies without commandId and with equal commandId; a different commandId does not', async () => {
    const parent = await captured();
    store.append([rawCapture('pair-none'), rawLink('pair-none', parent.id)]);
    store.append([rawCapture('pair-same', cmd('cmd-a')), rawLink('pair-same', parent.id, cmd('cmd-a'))]);
    store.append([rawCapture('pair-diff', cmd('cmd-b')), rawLink('pair-diff', parent.id, cmd('cmd-c'))]);
    expect(record('pair-none')).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', version: 2 });
    expect(record('pair-same')).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', version: 2 });
    expect(hasNoRefKeys(record('pair-diff'))).toBe(true);
    expect(record('pair-diff').version).toBe(1);
    expect(() => verifyEventChain([...store.all()])).not.toThrow();
  });

  it('a call without any reference: events and answer as before the slice', async () => {
    const c = await contribution('Zwei Fragen ohne Bezug.');
    const head = store.lastSeq();
    const views = await capture(c, [{ text: 'A?' }, { text: 'B?' }]);
    expect(store.all().slice(head).map((e) => e.type)).toEqual(['QuestionCaptured', 'QuestionCaptured']);
    for (const view of views) {
      expect(hasNoRefKeys(view)).toBe(true);
      expect(view.version).toBe(1);
    }
    for (const e of store.all().slice(head)) expect(Object.keys(e.payload).sort()).toEqual(['contributionId', 'number', 'speakerId', 'text']);
  });
});

/* ---------- 4 ---------- */

describe('Test 4: 422 for the form, all or nothing', () => {
  it('only one of the pair, an unknown relation, an empty id, 129 code points, one invalid among valid: 422, no event', async () => {
    const parent = await captured();
    const c = await contribution();
    const astral = '\u{1F600}';
    const bad: QuestionCapture[][] = [
      [{ text: 'X?', parentQuestionId: parent.id } as QuestionCapture],
      [{ text: 'X?', relation: 'follow_up' } as QuestionCapture],
      [{ text: 'X?', parentQuestionId: parent.id, relation: 'duplicate' } as unknown as QuestionCapture],
      [{ text: 'X?', parentQuestionId: '', relation: 'follow_up' }],
      [{ text: 'X?', parentQuestionId: astral.repeat(129), relation: 'follow_up' }],
      [{ text: 'Gut?', parentQuestionId: parent.id, relation: 'follow_up' }, { text: 'X?', parentQuestionId: parent.id } as QuestionCapture],
    ];
    for (const items of bad) {
      const p = await rejected(() => capture(c, items));
      expect([p.status, p.ruleId], JSON.stringify(items).slice(0, 80)).toEqual([422, undefined]);
    }
    // 128 code points with astral characters (256 UTF-16 units) are a valid form and end in R-LINK-01.
    expect(astral.repeat(128).length).toBe(256);
    const p = await rejected(() => capture(c, [{ text: 'X?', parentQuestionId: astral.repeat(128), relation: 'follow_up' }]));
    expect([p.status, p.ruleId]).toEqual([422, 'R-LINK-01']);
  });
});

/* ---------- 5 ---------- */

describe('Test 5: R-LINK-01', () => {
  it('unknown id and a question of another meeting: 422 R-LINK-01, equal problems without the id, no event', async () => {
    appendOtherMeeting(['foreign-q-046']);
    const c = await contribution();
    const unknown = await rejected(() => capture(c, [{ text: 'X?', parentQuestionId: 'unknown-q-046', relation: 'follow_up' }]));
    const foreign = await rejected(() => capture(c, [{ text: 'X?', parentQuestionId: 'foreign-q-046', relation: 'clarification' }]));
    expect([unknown.status, unknown.ruleId]).toEqual([422, 'R-LINK-01']);
    expect(foreign.toProblem()).toEqual(unknown.toProblem());
    expect(foreign.message).toBe(unknown.message);
    expect(JSON.stringify(unknown.toProblem())).not.toContain('unknown-q-046');
    expect(JSON.stringify(foreign.toProblem())).not.toContain('foreign-q-046');
    // A valid item in front does not get through either (all or nothing).
    const parent = await captured();
    await rejected(() => capture(c, [{ text: 'Gut?', parentQuestionId: parent.id, relation: 'follow_up' },
      { text: 'X?', parentQuestionId: 'unknown-q-046', relation: 'follow_up' }]));
  });

  it('colliding subject id in both meetings: the reference points to the question of the own meeting', async () => {
    const own = await captured();
    appendOtherMeeting([own.id]);
    const child = await followUp(own.id);
    expect(child.parentQuestionId).toBe(own.id);
    // The other meeting's twin was read out with version 9; the own question never was.
    expect(Object.hasOwn(child, 'parentAnswerVersion')).toBe(false);
    expect((await read(own.id)).text).toBe('Wie entwickelt sich die Synthesequote?');
  });
});

/* ---------- 6 ---------- */

describe('Test 6: R-LINK-02 in the reducer against a forged log', () => {
  const loads = (): void => {
    const log = [...store.all()];
    expect(() => verifyEventChain(log)).not.toThrow();
    expect(() => createInMemoryEventStore({ load: () => log, save: () => undefined })).not.toThrow();
  };
  const ancestors = (id: string): string[] => {
    const seen: string[] = [];
    let next = record(id)?.parentQuestionId;
    while (next !== undefined && !seen.includes(next)) { seen.push(next); next = record(next)?.parentQuestionId; }
    return seen;
  };

  it('(a) a second reference for the same child keeps the first', async () => {
    const p1 = await captured();
    const p2 = await captured();
    store.append([rawCapture('child-a'), rawLink('child-a', p1.id), rawLink('child-a', p2.id)]);
    expect(record('child-a').parentQuestionId).toBe(p1.id);
    loads();
  });

  it('(b) a referenced question of another meeting, (c) itself, (d) unknown question or parent: no reference', async () => {
    appendOtherMeeting(['foreign-only-046']);
    store.append([rawCapture('child-b'), rawLink('child-b', 'foreign-only-046')]);
    store.append([rawCapture('child-c'), rawLink('child-c', 'child-c')]);
    const p = await captured();
    store.append([rawLink('never-captured-046', p.id)]);
    store.append([rawCapture('child-d'), rawLink('child-d', 'unknown-parent-046')]);
    for (const id of ['child-b', 'child-c', 'child-d']) {
      expect(hasNoRefKeys(record(id)), id).toBe(true);
      expect(record(id).version, id).toBe(1);
    }
    expect(record('never-captured-046')).toBeUndefined();
    loads();
  });

  it('(e) a late reference closing a cycle, after another event on A and with another commandId: no effect', async () => {
    const a = await classify(await captured('Ältere Frage A?'));
    const b = await followUp(a.id);
    expect(b.parentQuestionId).toBe(a.id);
    store.append([raw('QuestionClaimed', a.id, { actorId: 'x', claimedAt: at(), expiresAt: at() }, cmd('cmd-other')),
      rawLink(a.id, b.id, cmd('cmd-late'))]);
    expect(hasNoRefKeys(record(a.id))).toBe(true);
    expect(ancestors(b.id)).toEqual([a.id]);
    loads();
  });

  it('(e2) a late reference for a question without reference and with version > 1: no effect', async () => {
    const a = await classify(await captured());
    expect(a.version).toBeGreaterThan(1);
    const other = await captured();
    store.append([rawLink(a.id, other.id)]);
    expect(hasNoRefKeys(record(a.id))).toBe(true);
    loads();
  });

  it('(e3) an untouched older question (version 1, no commandId) and a later link A -> B while B points to A: no effect, no cycle', async () => {
    store.append([rawCapture('untouched-a')]);
    expect(record('untouched-a').version).toBe(1);
    const b = await followUp('untouched-a');
    expect(b.parentQuestionId).toBe('untouched-a');
    store.append([rawLink('untouched-a', b.id)]);
    expect(record('untouched-a').version).toBe(1);
    expect(hasNoRefKeys(record('untouched-a'))).toBe(true);
    expect(ancestors(b.id)).toEqual(['untouched-a']);
    loads();
  });

  it('(f) relation "duplicate", (f2) parentAnswerVersion 0: no reference; nothing throws', async () => {
    const p = await captured();
    store.append([rawCapture('child-f'), raw('QuestionLinked', 'child-f', { parentQuestionId: p.id, relation: 'duplicate' })]);
    store.append([rawCapture('child-f2'), rawLink('child-f2', p.id, {}, { parentAnswerVersion: 0 })]);
    store.append([rawCapture('child-f3'), rawLink('child-f3', p.id, {}, { parentAnswerVersion: 1.5 })]);
    for (const id of ['child-f', 'child-f2', 'child-f3']) expect(hasNoRefKeys(record(id)), id).toBe(true);
    loads();
  });

  it('rule (e) memo: any reduced event of the meeting counts (applied or not); a foreign meeting event does not', async () => {
    const p = await captured();
    // An event of this meeting without effect (claim of an unknown question) between capture and link.
    store.append([rawCapture('memo-a'), raw('QuestionReleased', 'nobody-046', {}), rawLink('memo-a', p.id)]);
    expect(hasNoRefKeys(record('memo-a'))).toBe(true);
    // A foreign meeting's event between capture and link leaves the memo of this meeting alone.
    const fresh = createInMemoryEventStore();
    const ev = (e: object): NewEvent => ({ at: at(), actor: A.admin, ...e }) as unknown as NewEvent;
    fresh.append([
      ev({ id: 'm-old', type: 'MeetingCreated', subjectId: 'hv-old', meetingId: 'hv-old',
        payload: { title: 'Alt', date: '2020-01-01', agendaItems: [], units: [] } }),
      ev({ id: 'm-new', type: 'MeetingCreated', subjectId: 'hv-new', meetingId: 'hv-new',
        payload: { title: 'Neu', date: '2027-01-01', agendaItems: [], units: [] } }),
      ev({ id: 'q-parent', type: 'QuestionCaptured', subjectId: 'parent', meetingId: 'hv-new',
        payload: { number: 'F-0001', contributionId: 'c', speakerId: 's', text: 'P' } }),
      ev({ id: 'q-child', type: 'QuestionCaptured', subjectId: 'child', meetingId: 'hv-new',
        payload: { number: 'F-0002', contributionId: 'c', speakerId: 's', text: 'K' } }),
      ev({ id: 'q-foreign', type: 'QuestionCaptured', subjectId: 'foreign', meetingId: 'hv-old',
        payload: { number: 'F-0001', contributionId: 'c', speakerId: 's', text: 'F' } }),
      ev({ id: 'q-link', type: 'QuestionLinked', subjectId: 'child', meetingId: 'hv-new',
        payload: { parentQuestionId: 'parent', relation: 'clarification' } }),
    ]);
    // The unscoped projection follows the newest meeting and returns early on the foreign event.
    const all = project(fresh.all());
    expect(all.meeting?.id).toBe('hv-new');
    expect(all.questions.get('child')).toMatchObject({ parentQuestionId: 'parent', relation: 'clarification' });
    expect(all.lastReduced).toEqual({ type: 'QuestionLinked', subjectId: 'child' });
    const scoped = project(fresh.all().filter((e) => e.meetingId === 'hv-new'));
    expect(scoped.questions.get('child')).toMatchObject({ parentQuestionId: 'parent' });
  });

  it('the memo is carried by snapshotBefore copies', async () => {
    const p = await captured();
    const state = emptyState();
    for (const e of store.all()) if (e.meetingId === meetingId) reduce(state, e);
    expect(state.lastReduced).toMatchObject({ type: 'QuestionCaptured', subjectId: p.id });
    const batch = [{ ...store.all().at(-1)!, seq: store.lastSeq() + 1 }] as DomainEvent[];
    const snap = snapshotBefore(new Map([[meetingId, state]]), batch).get(meetingId)!;
    expect(snap.lastReduced).toEqual(state.lastReduced);
    expect(snap.lastReduced).not.toBe(state.lastReduced);
  });
});

/* ---------- 7 ---------- */

describe('Test 7: chain', () => {
  it('a follow-up on a follow-up is allowed; the filter on the top question returns the direct child only', async () => {
    const top = await captured();
    const child = await followUp(top.id);
    const grandchild = await followUp(child.id, 'clarification');
    expect(grandchild.parentQuestionId).toBe(child.id);
    const list = await asActor(A.capture, () => api.listQuestions({ parentQuestionId: top.id }));
    expect(list.items.map((q) => q.id)).toEqual([child.id]);
    expect(list.total).toBe(1);
  });
});

/* ---------- 8 ---------- */

describe('Test 8: filter per child', () => {
  it('capture: all children sorted by number, total, combined with status', async () => {
    const parent = await captured();
    const k1 = await followUp(parent.id);
    const k2 = await followUp(parent.id, 'clarification');
    const k3 = await followUp(parent.id);
    await classify(await read(k2.id));
    const all = await asActor(A.capture, () => api.listQuestions({ parentQuestionId: parent.id }));
    expect(all.items.map((q) => q.id)).toEqual([k1.id, k2.id, k3.id]);
    expect(all.items.map((q) => q.number)).toEqual([...all.items.map((q) => q.number)].sort());
    expect(all.total).toBe(3);
    const onlyCaptured = await asActor(A.capture, () => api.listQuestions({ parentQuestionId: parent.id, status: ['captured'] }));
    expect(onlyCaptured.items.map((q) => q.id)).toEqual([k1.id, k3.id]);
    expect(onlyCaptured.total).toBe(2);
  });

  it('bound experts see their unit only; parent unreadable, child readable: relation without the masked keys', async () => {
    const parent = await assign(await classify(await captured(`${PARENT_MARK} HR?`)), 'unit-hr');
    const kFin = await assign(await classify(await followUp(parent.id)), 'unit-fin');
    const kHr = await assign(await classify(await followUp(parent.id, 'clarification')), 'unit-hr');
    const fin = await asActor(FIN, () => api.listQuestions({ parentQuestionId: parent.id }));
    expect(fin.items.map((q) => q.id)).toEqual([kFin.id]);
    expect(fin.total).toBe(1);
    expect(fin.items[0]!.relation).toBe('follow_up');
    expect(Object.hasOwn(fin.items[0]!, 'parentQuestionId')).toBe(false);
    expect(Object.hasOwn(fin.items[0]!, 'parentAnswerVersion')).toBe(false);
    const hr = await asActor(HR, () => api.listQuestions({ parentQuestionId: parent.id }));
    expect(hr.items.map((q) => q.id)).toEqual([kHr.id]);
    expect(hr.items[0]!.parentQuestionId).toBe(parent.id);
  });

  it('observer: only children read out; unknown id and empty id: empty; without the key: all as before', async () => {
    const parent = await captured();
    const delivered = await toDelivered(await followUp(parent.id));
    await followUp(parent.id);
    const obs = await asActor(A.observer, () => api.listQuestions({ parentQuestionId: parent.id }));
    expect(obs.items.map((q) => q.id)).toEqual([delivered.id]);
    expect(await asActor(A.capture, () => api.listQuestions({ parentQuestionId: 'unknown-046' }))).toEqual({ items: [], total: 0 });
    expect(await asActor(A.capture, () => api.listQuestions({ parentQuestionId: '' }))).toEqual({ items: [], total: 0 });
    const everything = await asActor(A.capture, () => api.listQuestions({}));
    expect(everything.total).toBe(project(store.all().filter((e) => e.meetingId === meetingId)).questions.size);
  });
});

/* ---------- 9 ---------- */

describe('Test 9: masking of the view', () => {
  it('observer: a read-out follow-up to an unread parent shows the relation only; after the parent is read out the id appears', async () => {
    const parent = await captured();
    const child = await toDelivered(await followUp(parent.id));
    const before = await read(child.id, A.observer);
    expect(before.relation).toBe('follow_up');
    expect(Object.hasOwn(before, 'parentQuestionId')).toBe(false);
    expect(Object.hasOwn(before, 'parentAnswerVersion')).toBe(false);
    expect(JSON.stringify(before)).not.toContain(parent.id);
    await toDelivered(await read(parent.id));
    const after = await read(child.id, A.observer);
    expect(after.parentQuestionId).toBe(parent.id);
    // The parent was not read out when the child was captured.
    expect(Object.hasOwn(after, 'parentAnswerVersion')).toBe(false);
  });

  it('bound expert of another unit: getQuestion without the two keys; the parent id stands nowhere in the answer', async () => {
    const parent = await assign(await classify(await captured(`${PARENT_MARK} HR?`)), 'unit-hr');
    const child = await assign(await classify(await followUp(parent.id)), 'unit-fin');
    const view = await read(child.id, FIN);
    expect(view.relation).toBe('follow_up');
    expect(Object.hasOwn(view, 'parentQuestionId')).toBe(false);
    expect(Object.hasOwn(view, 'parentAnswerVersion')).toBe(false);
    expect(JSON.stringify(view)).not.toContain(parent.id);
    await expect(read(parent.id, FIN)).rejects.toMatchObject({ status: 404 });
  });

  it('podium and stage: neither key in current or queue, read as podium and as moderation', async () => {
    const parent = await toDelivered(await captured());
    const child = await stage(await toApproved(await followUp(parent.id)));
    expect((await read(child.id)).parentQuestionId).toBe(parent.id);
    for (const actor of [A.podium, A.moderation]) {
      const view = await asActor(actor, () => api.getStage());
      const all = [view.current, ...view.queue].filter((q): q is Question => q !== null);
      const onStage = all.find((q) => q.id === child.id);
      expect(onStage, actor.role).toBeDefined();
      for (const q of all) {
        expect(Object.hasOwn(q, 'parentQuestionId'), actor.role).toBe(false);
        expect(Object.hasOwn(q, 'parentAnswerVersion'), actor.role).toBe(false);
      }
      expect(JSON.stringify(view)).not.toContain(parent.id);
    }
  });

  it('number and text of the parent stand in no view of the follow-up', async () => {
    const parent = await captured(`${PARENT_MARK} Wortlaut der Bezugsfrage?`);
    const child = await followUp(parent.id);
    for (const view of [child, await read(child.id), await read(child.id, A.capture)]) {
      const json = JSON.stringify(view);
      expect(json).not.toContain(PARENT_MARK);
      expect(json).not.toContain(`"${parent.number}"`);
    }
  });
});

/* ---------- 10 ---------- */

describe('Test 10: event read paths', () => {
  it('history, listEvents and a stream event carry { relation } only; the parent history has no link; the store keeps both', async () => {
    const parent = await toDelivered(await captured());
    const from = store.lastSeq();
    const child = await followUp(parent.id, 'clarification');
    const history = await asActor(A.capture, () => api.getQuestionHistory(child.id));
    const linked = history.filter((e) => e.type === 'QuestionLinked');
    expect(linked).toHaveLength(1);
    expect(linked[0]!.payload).toEqual({ relation: 'clarification' });
    expect(JSON.stringify(linked[0])).not.toContain(parent.id);
    const feed = await asActor(A.admin, () => api.listEvents(from));
    const fromFeed = feed.items.filter((e) => e.type === 'QuestionLinked');
    expect(fromFeed.map((e) => e.payload)).toEqual([{ relation: 'clarification' }]);
    expect(JSON.stringify(fromFeed)).not.toContain(parent.id);
    const batch = store.all().slice(from);
    const states = new Map([[meetingId, project(store.all().filter((e) => e.meetingId === meetingId))]]);
    const messages = visibleMessages(new Map([[meetingId, { id: 'reader-adm46', role: 'admin' } as Actor]]), batch, states, states, { can });
    const streamed = messages.flatMap((m) => (m.kind === 'event' && m.event.type === 'QuestionLinked' ? [m.event] : []));
    expect(streamed.map((e) => e.payload)).toEqual([{ relation: 'clarification' }]);
    expect(JSON.stringify(streamed)).not.toContain(parent.id);
    expect((await asActor(A.capture, () => api.getQuestionHistory(parent.id))).some((e) => e.type === 'QuestionLinked')).toBe(false);
    expect(linkEvents(child.id)[0]!.payload).toEqual({ parentQuestionId: parent.id, relation: 'clarification', parentAnswerVersion: 1 });
    expect(maskEvent(linkEvents(child.id)[0]!).payload).toEqual({ relation: 'clarification' });
  });
});

/* ---------- 11 ---------- */

describe('Test 11: replay', () => {
  it('same key, same body: same answer with reference, one QuestionLinked; same key, other reference: the original result', async () => {
    const parent = await toDelivered(await captured());
    const other = await captured();
    const c = await contribution();
    const body: QuestionCapture[] = [{ text: 'Nachgefragt?', parentQuestionId: parent.id, relation: 'follow_up' }];
    const first = await capture(c, body, { idempotencyKey: 'cap-046-key' });
    const head = store.lastSeq();
    const again = await capture(c, body, { idempotencyKey: 'cap-046-key' });
    expect(store.lastSeq()).toBe(head);
    expect(again).toEqual(first);
    expect(again[0]).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1 });
    expect(linkEvents(first[0]!.id)).toHaveLength(1);
    const changed = await capture(c, [{ text: 'Nachgefragt?', parentQuestionId: other.id, relation: 'clarification' }], { idempotencyKey: 'cap-046-key' });
    expect(store.lastSeq()).toBe(head);
    expect(changed).toEqual(first);
  });
});

/* ---------- 12 ---------- */

describe('Test 12: If-Match', () => {
  it('without: 428; stale: 412; no event, no QuestionLinked', async () => {
    const parent = await captured();
    const c = await contribution();
    const item: QuestionCapture[] = [{ text: 'X?', parentQuestionId: parent.id, relation: 'follow_up' }];
    expect((await rejected(() => capture(c, item, { ifMatch: null }))).status).toBe(428);
    expect((await rejected(() => capture(c, item, { ifMatch: etagOf(c.version + 5) }))).status).toBe(412);
    expect(linkEvents()).toHaveLength(0);
  });
});

/* ---------- 13 ---------- */

describe('Test 13: rights', () => {
  it('moderation, coordination, legal, approver, admin, podium, observer: 403 R-PERM-01, no event', async () => {
    const parent = await captured();
    const c = await contribution();
    for (const actor of [A.moderation, A.coordination, A.legal, A.approver, A.admin, A.podium, A.observer]) {
      const p = await rejected(() => capture(c, [{ text: 'X?', parentQuestionId: parent.id, relation: 'follow_up' }], { actor }));
      expect([p.status, p.ruleId], actor.role).toEqual([403, 'R-PERM-01']);
    }
  });
});

/* ---------- 14 ---------- */

describe('Test 14: merge and withdraw afterwards', () => {
  it('the child keeps its reference; a merged or withdrawn question can be a parent; parentAnswerVersion of the child stays', async () => {
    const parent = await toDelivered(await captured());
    const child = await followUp(parent.id);
    expect(child.parentAnswerVersion).toBe(1);
    // Parent merged resp. withdrawn after the reference: the child keeps it.
    const target = await captured('Zielfrage?');
    const dup = await captured('Dublette?');
    const childOfDup = await followUp(dup.id);
    const merged = await asActor(A.capture, () => api.mergeQuestion(dup.id, target.id, { ifMatch: etagOf(dup.version) }));
    const w = await captured('Zurückgezogen?');
    const childOfW = await followUp(w.id, 'clarification');
    const withdrawn = await asActor(A.capture, () => api.withdrawQuestion(w.id, 'Doppelt.', { ifMatch: etagOf(w.version) }));
    expect([merged.status, withdrawn.status]).toEqual(['merged', 'withdrawn']);
    expect((await read(childOfDup.id)).parentQuestionId).toBe(dup.id);
    expect((await read(childOfW.id))).toMatchObject({ parentQuestionId: w.id, relation: 'clarification' });
    // A merged or withdrawn question can be the parent of a new capture (no status criterion).
    const onMerged = await followUp(merged.id);
    const onWithdrawn = await followUp(withdrawn.id, 'clarification');
    expect([onMerged.parentQuestionId, onWithdrawn.parentQuestionId]).toEqual([merged.id, withdrawn.id]);
    // New version and new read-out of the parent after the reference: the child keeps 1.
    const v2 = await draft(await giveBack(await read(parent.id)), 'Neu.');
    await deliver(await stage(await approve(await clear(await submit(v2)))));
    expect((await read(child.id)).parentAnswerVersion).toBe(1);
  });
});

/* ---------- 15 ---------- */

describe('Test 15: stream', () => {
  const STREAM_FIN: Actor = { id: 'reader-exp46-fin', role: 'expert', assignmentScoped: true, unitId: 'unit-fin' };
  const STREAM_COO: Actor = { id: 'reader-coo46', role: 'coordination' };
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
  const subjectsOf = (messages: readonly StreamMessage[]): string[] =>
    messages.flatMap((m) => (m.kind === 'change' ? m.change.subjects ?? [] : []));

  it('topics questions only; subjects the child only; not a scope exit; a reader of the parent only gets no signal naming either', async () => {
    expect(EVENT_TOPICS.QuestionLinked).toEqual(['questions']);
    expect(SCOPE_EXIT_EVENTS.has('QuestionLinked')).toBe(false);
    const parent = await assign(await classify(await captured()), 'unit-fin');
    const from = store.lastSeq();
    const before = statesOf(store.all());
    const child = await followUp(parent.id);
    const after = statesOf(store.all());
    const batch = store.all().slice(from);
    const link = batch.find((e) => e.type === 'QuestionLinked') as Extract<DomainEvent, { type: 'QuestionLinked' }>;
    expect(EVENT_SUBJECTS.QuestionLinked(link)).toEqual([{ kind: 'question', id: child.id }]);
    const fin = visibleMessages(new Map([[meetingId, STREAM_FIN]]), batch, before, after, { can });
    expect(subjectsOf(fin)).not.toContain(child.id);
    expect(subjectsOf(fin)).not.toContain(parent.id);
    expect(fin.some((m) => m.kind === 'event')).toBe(false);
    const coo = visibleMessages(new Map([[meetingId, STREAM_COO]]), batch, before, after, { can });
    expect(subjectsOf(coo)).toContain(child.id);
    expect(subjectsOf(coo)).not.toContain(parent.id);
  });
});

/* ---------- 16 ---------- */

describe('Test 16: register and tables', () => {
  it('R-LINK-01 and R-LINK-02 as guards with verified false and their sources', () => {
    const entries = ruleRegister().filter((r) => r.ruleId.startsWith('R-LINK-'));
    expect(entries.map((r) => [r.ruleId, r.kind, r.legalRef.verified])).toEqual([
      ['R-LINK-01', 'Guard', false], ['R-LINK-02', 'Guard', false]]);
    expect(entries[0]!.legalRef.source).toBe('Recherche');
    expect(entries[1]!.legalRef.source).toBe('Leitplanken');
    // The literals in api.ts/state.ts and the two lines of docs/legal-trace.md are read from disk in
    // apps/api/src/__tests__/link046.test.ts ("Test 16"): the domain package may not import node:fs (arch gate).
    expect(QUESTION_RELATIONS).toEqual(['follow_up', 'clarification']);
  });
});

/* ---------- 17 ---------- */

describe('Test 17: envelope', () => {
  it('a log with QuestionLinked stamps and loads with the chain check; a misspelt type does not load', async () => {
    await followUp((await captured()).id);
    const log = [...store.all()];
    expect(log.some((e) => e.type === 'QuestionLinked')).toBe(true);
    expect(() => verifyEventChain(log)).not.toThrow();
    expect(() => createInMemoryEventStore({ load: () => log, save: () => undefined })).not.toThrow();
    const typo = log.map((e) => (e.type === 'QuestionLinked' ? { ...e, type: 'QuestionLinkd' } : e)) as unknown as DomainEvent[];
    expect(() => createInMemoryEventStore({ load: () => typo, save: () => undefined })).toThrow(/type/);
  });
});
