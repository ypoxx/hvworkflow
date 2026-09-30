/**
 * Slice 035a (docs/slices/035a-sse-domaene-vertrag.md), rule R-PERM-04: what a reader learns from a
 * batch of events — the full (masked) event, a change signal without content, or nothing. Tests 1–12
 * of the spec; every decision under test runs through `can()` and `ROLE_PERMISSIONS`, so the readers
 * below are generated from `ROLE_PERMISSIONS` wherever the spec asks for "je Rolle".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiProblem, can, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { ROLE_PERMISSIONS } from '../permissions.js';
import { seedEvents } from '../seed.js';
import { emptyState, isOnStage, reduce, type State } from '../state.js';
import type { DomainEvent, EventType, NewEvent, ReadEvent } from '../events.js';
import type { Actor, Role, StreamChange, StreamTopic } from '../types.js';
import {
  EVENT_SUBJECTS,
  EVENT_TOPICS,
  SCOPE_EXIT_EVENTS,
  STAGE_COUNTER_EVENTS,
  STREAM_TOPICS,
  replayMessage,
  resolveMeetingActor,
  resolveReaderActors,
  visibleMessages,
  type StreamMessage,
} from '../stream.js';

/* ---------- fixtures ---------- */

const START = Date.parse('2027-04-20T12:00:00.000Z');
const fixedClock = (): Date => new Date(START);
const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

/** Writers: synthetic demo identities (no role assignment), one per role that writes in the script. */
const W: Record<string, Actor> = {
  admin: { id: 'w-admin', role: 'admin' },
  moderation: { id: 'w-mod', role: 'moderation' },
  capture: { id: 'w-cap', role: 'capture' },
  coordination: { id: 'w-coord', role: 'coordination' },
  expert: { id: 'w-exp', role: 'expert' },
  legal: { id: 'w-leg', role: 'legal' },
  approver: { id: 'w-app', role: 'approver' },
  podium: { id: 'w-pod', role: 'podium' },
};
/** A reader per role, generated from ROLE_PERMISSIONS. */
const reader = (role: Role, extra: Partial<Actor> = {}): Actor => ({ id: `reader-${role}`, role, ...extra });
/** The unit-bound Fachbereich reader (assignment context from the projection in production). */
const EXPERT_FIN: Actor = { id: 'reader-expert-fin', role: 'expert', assignmentScoped: true, unitId: 'unit-fin' };
const DRAFT_TEXT = 'Entwurf-Marker: vertraulicher Antworttext';

const deps = { can };
const readers = (meetingId: string, actor: Actor): ReadonlyMap<string, Actor> => new Map([[meetingId, actor]]);

interface Step<T = unknown> {
  batch: DomainEvent[];
  before: Map<string, State>;
  after: Map<string, State>;
  result: T;
}

/** Per-meeting projections of a log, the same fold `createInProcessApi` uses for its alias states. */
function statesOf(events: readonly DomainEvent[]): Map<string, State> {
  const out = new Map<string, State>();
  for (const e of events) {
    if (!e.meetingId) continue;
    let s = out.get(e.meetingId);
    if (!s) {
      s = emptyState();
      out.set(e.meetingId, s);
    }
    reduce(s, e);
  }
  return out;
}

interface Harness {
  store: EventStore;
  writer: HvApi;
  peek: HvApi;
  meetingId: string;
  as(a: Actor): void;
  step<T>(fn: () => Promise<T> | T): Promise<Step<T>>;
  steps: Step[];
  /** The current projection of the corpus meeting. */
  after(): State;
}

const SEED = { questions: 12, seed: 3, roundSizes: [3, 2] } as const;

/** A store with the small synthetic corpus, appended event by event so every seed event is its own step. */
async function harness(onStep?: (step: Step) => Promise<void> | void, store: EventStore = createInMemoryEventStore()): Promise<Harness> {
  let t = START;
  let current: Actor = W.admin!;
  const writer = createInProcessApi({ store, actor: () => current, clock: () => new Date((t += 1000)) });
  const peek = createInProcessApi({ store, actor: () => W.admin!, clock: fixedClock });
  const steps: Step[] = [];
  const step = async <T,>(fn: () => Promise<T> | T): Promise<Step<T>> => {
    const from = store.lastSeq();
    const before = statesOf(store.all());
    const result = await fn();
    const s: Step<T> = { batch: store.all().slice(from), before, after: statesOf(store.all()), result };
    steps.push(s);
    await onStep?.(s);
    return s;
  };
  const events = seedEvents({ ...SEED, now: new Date(START), actor: W.admin! });
  for (const e of events) await step(() => store.append([e]));
  const meetingId = events[0]!.subjectId;
  return { store, writer, peek, meetingId, as: (a) => { current = a; }, step, steps,
    after: () => statesOf(store.all()).get(meetingId)! };
}

const changeOf = (messages: readonly StreamMessage[]): StreamChange | undefined => {
  const changes = messages.filter((m) => m.kind === 'change');
  expect(changes.length).toBeLessThanOrEqual(1);
  const c = changes[0];
  return c?.kind === 'change' ? c.change : undefined;
};
const eventsOf = (messages: readonly StreamMessage[]): ReadEvent[] =>
  messages.flatMap((m) => (m.kind === 'event' ? [m.event] : []));
const live = (actor: Actor, s: Step, meetingId: string): StreamMessage[] =>
  visibleMessages(readers(meetingId, actor), s.batch, s.before, s.after, deps);

async function newSpeaker(h: Harness): Promise<string> {
  h.as(W.moderation!);
  const m = await h.peek.getMeeting();
  return (await h.step(() => h.writer.registerSpeaker({ displayName: 'Testaktionärin' }, { ifMatch: etagOf(m.speakerListVersion) }))).result.id;
}
async function newContribution(h: Harness, speakerId: string, text: string): Promise<string> {
  h.as(W.capture!);
  const sp = await h.peek.getSpeaker(speakerId);
  return (await h.step(() => h.writer.captureContribution({ speakerId, text }, { ifMatch: etagOf(sp.version) }))).result.id;
}
async function newQuestions(h: Harness, n: number): Promise<{ speakerId: string; contributionId: string; ids: string[]; step: Step }> {
  const speakerId = await newSpeaker(h);
  const parts = Array.from({ length: n }, (_, i) => `Frage Nummer ${i + 1}?`);
  const text = parts.join(' ');
  const contributionId = await newContribution(h, speakerId, text);
  h.as(W.capture!);
  const c = await h.peek.getContribution(contributionId);
  let cursor = 0;
  const captures = parts.map((p) => {
    const start = text.indexOf(p, cursor);
    cursor = start + p.length;
    return { text: p, span: { start, end: start + p.length } };
  });
  const s = await h.step(() => h.writer.captureQuestions(contributionId, captures, { ifMatch: etagOf(c.version) }));
  return { speakerId, contributionId, ids: s.result.map((q) => q.id), step: s };
}

/** One question command as its proper role, with a fresh If-Match. */
async function act(h: Harness, who: Actor, id: string, run: (api: HvApi, ifMatch: string) => Promise<unknown>): Promise<Step> {
  const q = await h.peek.getQuestion(id);
  h.as(who);
  return h.step(() => run(h.writer, etagOf(q.version)));
}
const classify = (h: Harness, id: string, track: 'podium' | 'expert_track' = 'expert_track') =>
  act(h, W.coordination!, id, (api, ifMatch) => api.classifyQuestion(id, { track, agendaItemId: 'top-2', stageAssignment: 'ceo' }, { ifMatch }));
const assign = (h: Harness, id: string, unitId: string) =>
  act(h, W.coordination!, id, (api, ifMatch) => api.assignQuestion(id, unitId, { ifMatch }));
const draft = (h: Harness, id: string) =>
  act(h, W.expert!, id, (api, ifMatch) => api.draftAnswer(id, { text: DRAFT_TEXT }, { ifMatch }));
const submit = (h: Harness, id: string) => act(h, W.expert!, id, (api, ifMatch) => api.submitForReview(id, { ifMatch }));
const clear = (h: Harness, id: string) =>
  act(h, W.legal!, id, (api, ifMatch) => api.clearQuestionLegally(id, { answerVersion: 1 }, { ifMatch }));
const approve = (h: Harness, id: string) => act(h, W.approver!, id, (api, ifMatch) => api.approveQuestion(id, 1, { ifMatch }));
const stage = (h: Harness, id: string) => act(h, W.approver!, id, (api, ifMatch) => api.stageQuestion(id, { ifMatch }));
const deliver = (h: Harness, id: string) => act(h, W.podium!, id, (api) => api.deliverQuestion(id));
const close = (h: Harness, id: string) => act(h, W.podium!, id, (api, ifMatch) => api.closeQuestion(id, { ifMatch }));

/** Capture → classify → assign → draft → submit → clear → approve: the question ends `approved`. */
async function toApproved(h: Harness, id: string, unitId = 'unit-fin'): Promise<Step[]> {
  return [await classify(h, id), await assign(h, id, unitId), await draft(h, id), await submit(h, id), await clear(h, id), await approve(h, id)];
}

/** The scripted tail over every write path the seed corpus lacks (2, 2b). */
async function script(h: Harness): Promise<void> {
  const speakerId = await newSpeaker(h);
  h.as(W.moderation!);
  const m = await h.peek.getMeeting();
  const sp = await h.peek.getSpeaker(speakerId);
  const round = (await h.peek.listSpeakers({ round: sp.round })).map((s) => s.id).reverse();
  await h.step(() => h.writer.reorderSpeakers(sp.round, round, { ifMatch: etagOf(m.speakerListVersion) }));
  const other = await newSpeaker(h);
  const otherVersion = (await h.peek.getSpeaker(other)).version;
  h.as(W.moderation!);
  await h.step(() => h.writer.updateSpeaker(other, { status: 'withdrawn' }, { ifMatch: etagOf(otherVersion) }));

  const { contributionId, ids } = await newQuestions(h, 4);
  const [q1, q2, q3, q4] = ids as [string, string, string, string];
  h.as(W.capture!);
  let c = await h.peek.getContribution(contributionId);
  await h.step(() => h.writer.claimContribution(contributionId, { ifMatch: etagOf(c.version) }));
  c = await h.peek.getContribution(contributionId);
  await h.step(() => h.writer.releaseContribution(contributionId, { ifMatch: etagOf(c.version) }));

  await classify(h, q1);
  await assign(h, q1, 'unit-fin');
  await act(h, W.expert!, q1, (api, ifMatch) => api.claimQuestion(q1, { ifMatch }));
  await act(h, W.expert!, q1, (api, ifMatch) => api.releaseQuestion(q1, { ifMatch }));
  await draft(h, q1);
  await submit(h, q1);
  await clear(h, q1);
  await approve(h, q1);
  await stage(h, q1);
  await deliver(h, q1);
  await close(h, q1);

  await classify(h, q2, 'expert_track');
  await act(h, W.capture!, q2, (api, ifMatch) => api.withdrawQuestion(q2, 'Zurückgezogen', { ifMatch }));
  await act(h, W.capture!, q3, (api, ifMatch) => api.mergeQuestion(q3, q1, { ifMatch }));

  // A write with an idempotency key on a question, and the no-op record the idempotency helper
  // (api.ts, `idempotent`) appends with the question as subject (Bauklärung C1).
  await act(h, W.coordination!, q4, (api, ifMatch) =>
    api.classifyQuestion(q4, { track: 'expert_track' }, { ifMatch, idempotencyKey: 'k-2b-classify' }));
  await h.step(() => h.store.append([{ id: 'idem-q4', type: 'IdempotencyRecorded', at: new Date(START + 5).toISOString(), actor: W.coordination!,
    subjectId: q4, meetingId: h.meetingId, idempotencyKey: 'k-2b-noop', retentionClass: 'technical', payload: {} } as NewEvent]));
  await h.step(() => h.store.append([{ id: 'idem-m', type: 'IdempotencyRecorded', at: new Date(START + 6).toISOString(), actor: W.admin!,
    subjectId: h.meetingId, meetingId: h.meetingId, idempotencyKey: 'k-2b-meeting', retentionClass: 'technical', payload: {} } as NewEvent]));

  const inReview = (await h.peek.listQuestions({ status: ['in_review'], limit: 1 })).items[0]!;
  await act(h, W.legal!, inReview.id, (api, ifMatch) => api.returnQuestion(inReview.id, 'Bitte ergänzen', { ifMatch }));

  h.as(W.admin!);
  let meeting = await h.peek.getMeeting();
  await h.step(() => h.writer.openAgendaItem('top-1', { ifMatch: etagOf(meeting.version) }));
  meeting = await h.peek.getMeeting();
  await h.step(() => h.writer.openVoting('top-1', { ifMatch: etagOf(meeting.version) }));
  meeting = await h.peek.getMeeting();
  await h.step(() => h.writer.closeVoting('top-1', { ifMatch: etagOf(meeting.version) }));
  const grant = await h.step(() => h.writer.assignRole({ subjectId: 'u-new', role: 'legal' }));
  await h.step(() => h.writer.revokeRole(grant.result.id));
}

/* ---------- read views (2, 2b) ---------- */

/** State slices per topic: what the read methods of that topic are computed from. */
function slices(s: State | undefined): Record<StreamTopic, string> {
  const staged = s ? [...s.questions.values()].filter(isOnStage).sort((a, b) => (a.stagePosition ?? 0) - (b.stagePosition ?? 0)) : [];
  return {
    meeting: JSON.stringify(s ? { meeting: s.meeting, agendaItems: s.agendaItems, units: s.units } : null),
    speakers: JSON.stringify(s ? [...s.speakers.values()] : []),
    contributions: JSON.stringify(s ? [...s.contributions.values()] : []),
    questions: JSON.stringify(s ? [...s.questions.values()] : []),
    stage: JSON.stringify({ staged, open: s?.meeting?.counts.open ?? 0, delivered: s?.meeting?.counts.delivered ?? 0 }),
    roles: JSON.stringify(s ? [...s.roleAssignments.values()] : []),
  };
}
const recordDiff = <V,>(before: Map<string, V> | undefined, after: Map<string, V> | undefined): string[] => {
  const ids = new Set([...(before?.keys() ?? []), ...(after?.keys() ?? [])]);
  return [...ids].filter((id) => JSON.stringify(before?.get(id)) !== JSON.stringify(after?.get(id)));
};

/** Every read method a role might call, as `key → serialised result or error status`. */
async function readViews(api: HvApi, ids: { speakers: string[]; contributions: string[]; questions: string[] }): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const put = async (key: string, f: () => Promise<unknown>): Promise<void> => {
    try {
      out.set(key, JSON.stringify(await f()));
    } catch (error) {
      out.set(key, `E${error instanceof ApiProblem ? error.status : String(error)}`);
    }
  };
  await put('meeting|getMeeting', () => api.getMeeting());
  await put('meeting|listAgendaItems', () => api.listAgendaItems());
  await put('meeting|listUnits', () => api.listUnits());
  await put('speakers|listSpeakers', () => api.listSpeakers());
  for (const id of ids.speakers) await put(`speakers|getSpeaker|${id}`, () => api.getSpeaker(id));
  await put('contributions|listContributions', () => api.listContributions());
  for (const id of ids.contributions) await put(`contributions|getContribution|${id}`, () => api.getContribution(id));
  await put('questions|listQuestions', () => api.listQuestions());
  for (const id of ids.questions) {
    await put(`questions|getQuestion|${id}`, () => api.getQuestion(id));
    await put(`questions|getQuestionHistory|${id}`, () => api.getQuestionHistory(id));
  }
  await put('stage|getStage', () => api.getStage());
  await put('roles|listRoleAssignments', () => api.listRoleAssignments());
  return out;
}
const idsOf = (states: Map<string, State>): { speakers: string[]; contributions: string[]; questions: string[] } => {
  const s = [...states.values()];
  return {
    speakers: s.flatMap((x) => [...x.speakers.keys()]),
    contributions: s.flatMap((x) => [...x.contributions.keys()]),
    questions: s.flatMap((x) => [...x.questions.keys()]),
  };
};

/* ---------- 1 ---------- */

/** Exhaustive by type: adding an EventType without listing it here fails `tsc`. */
const ALL_EVENT_TYPES: Record<EventType, true> = {
  MeetingCreated: true, MeetingStarted: true, MeetingClosed: true, DebateClosed: true, AgendaItemOpened: true,
  VotingOpened: true, VotingClosed: true, SpeakerRegistered: true, RoleAssigned: true, RoleRevoked: true,
  SpeakersReordered: true, SpeakerUpdated: true, ContributionCaptured: true, QuestionCaptured: true,
  QuestionClassified: true, QuestionAssigned: true, AnswerDrafted: true, QuestionSubmittedForReview: true,
  QuestionApproved: true, QuestionLegalCleared: true, QuestionReturned: true, QuestionStaged: true,
  QuestionDelivered: true, QuestionClosed: true, QuestionWithdrawn: true, QuestionMerged: true,
  ContributionClaimed: true, ContributionReleased: true, QuestionClaimed: true, QuestionReleased: true,
  IdempotencyRecorded: true,
};

describe('R-PERM-04 stream visibility (slice 035a)', () => {
  it('1: EVENT_TOPICS and EVENT_SUBJECTS are set for every EventType, with known topics only', () => {
    const types = Object.keys(ALL_EVENT_TYPES).sort();
    expect(Object.keys(EVENT_TOPICS).sort()).toEqual(types);
    expect(Object.keys(EVENT_SUBJECTS).sort()).toEqual(types);
    for (const type of types as EventType[]) {
      for (const topic of EVENT_TOPICS[type]) expect(STREAM_TOPICS).toContain(topic);
      expect(typeof EVENT_SUBJECTS[type]).toBe('function');
    }
    for (const type of SCOPE_EXIT_EVENTS) expect(types).toContain(type);
    expect([...SCOPE_EXIT_EVENTS].sort()).toEqual(
      ['QuestionAssigned', 'QuestionClosed', 'QuestionDelivered', 'QuestionMerged', 'QuestionReturned', 'QuestionWithdrawn']);
  });

  describe('2/2b: topics and subjects are not too narrow', () => {
    let h: Harness;
    /** Reader APIs, generated from ROLE_PERMISSIONS, plus the unit-bound Fachbereich. */
    const roleReaders: Actor[] = [...ROLES.map((r) => reader(r)), EXPERT_FIN];
    const failures: string[] = [];
    let checkedChanges = 0;

    beforeAll(async () => {
      const store = createInMemoryEventStore();
      const apis = new Map(roleReaders.map((r) => [r.id, createInProcessApi({ store, actor: () => r, clock: fixedClock })] as const));
      let views = new Map<string, Map<string, string>>();
      h = await harness(async (s) => {
        const meetingId = s.batch[0]!.meetingId!;
        const ids = idsOf(new Map([...s.before, ...s.after]));
        const next = new Map<string, Map<string, string>>();
        for (const r of roleReaders) {
          const after = await readViews(apis.get(r.id)!, ids);
          next.set(r.id, after);
          const beforeViews = views.get(r.id);
          if (!beforeViews) continue;
          const stateBefore = s.before.get(meetingId);
          const stateAfter = s.after.get(meetingId)!;
          const actorBefore = stateBefore ? resolveMeetingActor(stateBefore, r, fixedClock) : r;
          const actorAfter = resolveMeetingActor(stateAfter, r, fixedClock);
          // The reader's own rights changed in this step: that is the `roles` signal, not a read-view diff.
          if (!actorAfter || JSON.stringify(actorBefore) !== JSON.stringify(actorAfter)) continue;
          const messages = visibleMessages(readers(meetingId, actorAfter), s.batch, s.before, s.after, deps);
          if (can(actorAfter, 'event.read').allow) {
            const seqs = eventsOf(messages).map((e) => e.seq);
            if (JSON.stringify(seqs) !== JSON.stringify(s.batch.map((e) => e.seq))) failures.push(`${r.id}: events ${seqs} for batch ${s.batch.map((e) => e.seq)}`);
            continue;
          }
          const change = changeOf(messages);
          for (const [key, value] of after) {
            const was = beforeViews.get(key);
            if (was === undefined || was === value) continue;
            checkedChanges++;
            const [topic, method, id] = key.split('|') as [StreamTopic, string, string | undefined];
            const types = s.batch.map((e) => e.type).join(',');
            if (!change?.topics.includes(topic)) failures.push(`${r.id}: ${method}${id ? `(${id})` : ''} changed by ${types}, topic ${topic} missing`);
            else if (id !== undefined && !(change.subjects ?? []).includes(id)) failures.push(`${r.id}: ${method}(${id}) changed by ${types}, id missing`);
          }
        }
        views = next;
      }, store);
      // The unit-bound Fachbereich gets its assignment first; the step itself is its own `roles` change.
      h.as(W.admin!);
      await h.step(() => h.writer.assignRole({ subjectId: EXPERT_FIN.id, role: 'expert', unitId: 'unit-fin' }));
      await script(h);
    }, 180_000);

    it('2: every changed state slice of every event (seed corpus plus script) belongs to a topic of EVENT_TOPICS; subjects and counters complete', () => {
      const problems: string[] = [];
      const states = new Map<string, State>();
      for (const e of h.store.all()) {
        if (!e.meetingId) continue;
        const s = states.get(e.meetingId) ?? emptyState();
        states.set(e.meetingId, s);
        const before = slices(s);
        const snap = JSON.parse(JSON.stringify({ q: [...s.questions], sp: [...s.speakers], c: [...s.contributions], r: [...s.roleAssignments] })) as
          Record<'q' | 'sp' | 'c' | 'r', [string, unknown][]>;
        const beforeMaps = { q: new Map(snap.q), sp: new Map(snap.sp), c: new Map(snap.c), r: new Map(snap.r) };
        const beforeCounts = { open: s.meeting?.counts.open ?? 0, delivered: s.meeting?.counts.delivered ?? 0 };
        reduce(s, e);
        const after = slices(s);
        const subjects = EVENT_SUBJECTS[e.type](e as never);
        const has = (kind: string, id: string): boolean => subjects.some((x) => x.kind === kind && x.id === id);
        for (const topic of STREAM_TOPICS) {
          if (before[topic] !== after[topic] && !EVENT_TOPICS[e.type].includes(topic)) problems.push(`${e.type} #${e.seq}: ${topic} changed`);
        }
        if (before.meeting !== after.meeting && !has('meeting', e.meetingId)) problems.push(`${e.type} #${e.seq}: meeting subject missing`);
        for (const id of recordDiff(beforeMaps.q, s.questions as Map<string, unknown>)) if (!has('question', id)) problems.push(`${e.type} #${e.seq}: question ${id}`);
        for (const id of recordDiff(beforeMaps.sp, s.speakers as Map<string, unknown>)) if (!has('speaker', id)) problems.push(`${e.type} #${e.seq}: speaker ${id}`);
        for (const id of recordDiff(beforeMaps.c, s.contributions as Map<string, unknown>)) if (!has('contribution', id)) problems.push(`${e.type} #${e.seq}: contribution ${id}`);
        for (const id of recordDiff(beforeMaps.r, s.roleAssignments as Map<string, unknown>)) if (!has('roleAssignment', id)) problems.push(`${e.type} #${e.seq}: role ${id}`);
        // The question history (getQuestionHistory) lists every event whose subjectId is the question.
        if (s.questions.has(e.subjectId) && !has('question', e.subjectId)) problems.push(`${e.type} #${e.seq}: history of ${e.subjectId}`);
        const counts = { open: s.meeting?.counts.open ?? 0, delivered: s.meeting?.counts.delivered ?? 0 };
        if (JSON.stringify(counts) !== JSON.stringify(beforeCounts) && !STAGE_COUNTER_EVENTS.has(e.type)) problems.push(`${e.type} #${e.seq}: stage counter`);
      }
      expect(problems).toEqual([]);
      const covered = new Set(h.store.all().map((e) => e.type));
      for (const type of ['QuestionCaptured', 'QuestionMerged', 'QuestionReturned', 'QuestionWithdrawn', 'SpeakersReordered', 'RoleAssigned', 'RoleRevoked',
        'ContributionClaimed', 'QuestionClaimed', 'IdempotencyRecorded', 'AgendaItemOpened', 'VotingClosed'] as EventType[]) {
        expect(covered, type).toContain(type);
      }
    });

    it('2b: for every role (from ROLE_PERMISSIONS), each read method whose result changes gets its topic, single reads also the id', () => {
      expect(failures).toEqual([]);
      expect(checkedChanges).toBeGreaterThan(500);
      expect(h.steps.length).toBeGreaterThan(100);
    });
  });

  /* ---------- 3 ---------- */

  describe('3: visibility table', () => {
    type Classes = Record<'event' | StreamTopic, string>;
    /** The table of decision 2, verbatim. */
    const SPEC_TABLE: Record<Role, string[]> = {
      admin: ['ja (global, maskiert)', '–', '–', '–', '–', '–', '–'],
      moderation: ['nein', 'ja', 'ja', 'ja', 'ja', 'ja', 'nur eigene'],
      capture: ['nein', 'ja', 'ja', 'ja', 'ja', 'nein', 'nur eigene'],
      coordination: ['nein', 'ja', 'ja', 'ja', 'ja', 'nein', 'nur eigene'],
      expert: ['nein', 'ja', 'nein', 'nein', 'nur Fragen, die er vorher oder nachher lesen darf (eigener Fachbereich)', 'nein', 'nur eigene'],
      legal: ['nein', 'ja', 'nein', 'nein', 'ja', 'nein', 'nur eigene'],
      approver: ['nein', 'ja', 'nein', 'nein', 'ja', 'ja', 'nur eigene'],
      podium: ['nein', 'ja', 'nein', 'nein', 'nein', 'nur Fragen vorher oder nachher auf der Bühne; Zähler', 'nur eigene'],
      observer: ['nein', 'ja (Zähler, ohne Kennung)', 'nein', 'nein', 'nur `delivered`/`closed`', 'nein', 'nur eigene'],
    };
    const COLUMNS: ('event' | StreamTopic)[] = ['event', 'meeting', 'speakers', 'contributions', 'questions', 'stage', 'roles'];
    /** Spec wording → behaviour class. "Bühne" is the same class for every stage.read holder (M9). */
    const legend = (column: string, text: string): string => {
      if (text === '–') return 'n/a';
      if (text === 'nein') return 'none';
      if (text === 'ja (global, maskiert)') return 'global';
      if (text === 'nur eigene') return 'own';
      if (column === 'questions') {
        if (text === 'ja') return 'all';
        if (text.startsWith('nur Fragen, die er')) return 'own-unit';
        if (text === 'nur `delivered`/`closed`') return 'delivered';
      }
      if (column === 'stage' && (text === 'ja' || text.startsWith('nur Fragen vorher'))) return 'on-stage+counters';
      if (text === 'ja' || text === 'ja (Zähler, ohne Kennung)') return 'yes';
      throw new Error(`unmapped cell ${column}: ${text}`);
    };

    it('is generated from ROLE_PERMISSIONS through the stream functions and equals the table of decision 2', async () => {
      const h = await harness();
      const m = h.meetingId;
      // Probe steps: each isolates one kind of change.
      const speakerId = await newSpeaker(h);
      const speakerStep = h.steps.at(-1)!;
      const contributionId = await newContribution(h, speakerId, 'Frage A? Frage B? Frage C? Frage D?');
      const contributionStep = h.steps.at(-1)!;
      const { ids, step: captureStep } = await newQuestions(h, 3);
      const [own, foreign, staged] = ids as [string, string, string];
      await classify(h, own);
      await assign(h, own, 'unit-fin');
      const ownStep = await draft(h, own);
      await classify(h, foreign);
      await assign(h, foreign, 'unit-hr');
      const foreignStep = await draft(h, foreign);
      const deliveredQ = [...h.after().questions.values()].find((q) => q.status === 'delivered' && q.unitId !== 'unit-fin')!;
      const deliveredStep = await close(h, deliveredQ.id);
      await toApproved(h, staged, 'unit-hr');
      const stageStep = await stage(h, staged);
      h.as(W.admin!);
      const foreignGrant = await h.step(() => h.writer.assignRole({ subjectId: 'someone-else', role: 'legal' }));
      expect(contributionStep.batch[0]!.subjectId).toBe(contributionId);

      const generated: Record<string, Classes> = {};
      for (const role of ROLES) {
        const a = role === 'expert' ? { ...EXPERT_FIN, id: reader(role).id } : { ...reader(role), assignmentScoped: true, unitId: 'unit-fin' };
        const msgs = (s: Step): StreamMessage[] => live(a, s, m);
        const ch = (s: Step): StreamChange | undefined => changeOf(msgs(s));
        const got = (s: Step, topic: StreamTopic, id?: string): boolean => {
          const c = ch(s);
          return !!c && c.topics.includes(topic) && (id === undefined || (c.subjects ?? []).includes(id));
        };
        const cls: Classes = { event: 'none', meeting: 'none', speakers: 'none', contributions: 'none', questions: 'none', stage: 'none', roles: 'none' };
        if (eventsOf(msgs(captureStep)).length > 0) {
          generated[role] = { event: 'global', meeting: 'n/a', speakers: 'n/a', contributions: 'n/a', questions: 'n/a', stage: 'n/a', roles: 'n/a' };
          expect(ch(captureStep), role).toBeUndefined();
          continue;
        }
        cls.meeting = got(captureStep, 'meeting') ? 'yes' : 'none';
        cls.speakers = got(speakerStep, 'speakers', speakerId) ? 'yes' : 'none';
        cls.contributions = got(contributionStep, 'contributions', contributionStep.batch[0]!.subjectId) ? 'yes' : 'none';
        const q = [got(ownStep, 'questions', own), got(foreignStep, 'questions', foreign), got(deliveredStep, 'questions', deliveredQ.id)];
        cls.questions = q.every(Boolean) ? 'all' : q[0] && !q[1] && !q[2] ? 'own-unit' : !q[0] && !q[1] && q[2] ? 'delivered' : q.some(Boolean) ? `mixed ${q}` : 'none';
        const onStage = got(stageStep, 'stage', staged);
        const counter = got(captureStep, 'stage');
        const offStage = got(foreignStep, 'stage');
        cls.stage = onStage && counter && !offStage ? 'on-stage+counters' : !onStage && !counter && !offStage ? 'none' : `mixed ${onStage}/${counter}/${offStage}`;
        h.as(W.admin!);
        const ownGrant = await h.step(() => h.writer.assignRole({ subjectId: a.id, role: 'observer' }));
        const ownRole = got(ownGrant, 'roles', ownGrant.result.id);
        const foreignRole = got(foreignGrant, 'roles');
        cls.roles = ownRole && !foreignRole ? 'own' : foreignRole ? 'all' : 'none';
        generated[role] = cls;
      }
      const expected = Object.fromEntries(ROLES.map((role) => [role,
        Object.fromEntries(COLUMNS.map((column, i) => [column, legend(column, SPEC_TABLE[role][i]!)]))]));
      // The generated table, for the slice report.
      console.log(['| Rolle | ' + COLUMNS.join(' | ') + ' |', '|' + '---|'.repeat(COLUMNS.length + 1),
        ...ROLES.map((role) => `| ${role} | ${COLUMNS.map((c) => generated[role]![c]).join(' | ')} |`)].join('\n'));
      expect(generated).toEqual(expected);
      // Counter signals never carry the meeting id (T-G1-I-04: counters without an id).
      for (const role of ROLES) expect(changeOf(live(reader(role), captureStep, m))?.subjects ?? []).not.toContain(m);
    });
  });

  /* ---------- 4 ---------- */

  it('4: observer gets no draft events: at most `meeting` without subjects before delivery, `questions` with the id from delivery on', async () => {
    const h = await harness();
    const observer = reader('observer');
    const { ids, step: captured } = await newQuestions(h, 1);
    const id = ids[0]!;
    const before = [captured, ...(await toApproved(h, id)), await stage(h, id)];
    const delivered = await deliver(h, id);
    const serialised: string[] = [];
    for (const s of before) {
      const messages = live(observer, s, h.meetingId);
      serialised.push(JSON.stringify(messages));
      expect(eventsOf(messages)).toEqual([]);
      const c = changeOf(messages);
      if (c) {
        expect(c.topics).toEqual(['meeting']);
        expect(c.subjects).toBeUndefined();
      }
    }
    const after = live(observer, delivered, h.meetingId);
    serialised.push(JSON.stringify(after));
    expect(changeOf(after)?.topics).toContain('questions');
    expect(changeOf(after)?.subjects).toEqual([id]);
    const text = serialised.join('\n');
    expect(text).not.toContain(DRAFT_TEXT);
    expect(text).not.toContain('Entwurf-Marker');
    console.log(`observer output (035a test 4):\n${text}`);
  });

  /* ---------- 5 ---------- */

  it('5: expert gets nothing about another unit; a question moved away from his unit gets one `questions` with its id', async () => {
    const h = await harness();
    const { ids } = await newQuestions(h, 2);
    const [own, foreign] = ids as [string, string];
    await classify(h, own);
    await assign(h, own, 'unit-fin');
    await classify(h, foreign);
    const foreignAssigned = await assign(h, foreign, 'unit-hr');
    const foreignDraft = await draft(h, foreign);
    for (const s of [foreignAssigned, foreignDraft]) {
      const c = changeOf(live(EXPERT_FIN, s, h.meetingId));
      expect(c?.topics ?? []).not.toContain('questions');
      expect(c?.subjects ?? []).not.toContain(foreign);
    }
    const moved = await assign(h, own, 'unit-hr');
    expect(changeOf(live(EXPERT_FIN, moved, h.meetingId))).toMatchObject({ topics: expect.arrayContaining(['questions']), subjects: [own] });
    const later = await draft(h, own);
    const c = changeOf(live(EXPERT_FIN, later, h.meetingId));
    expect(c?.topics ?? []).not.toContain('questions');
    expect(c?.subjects ?? []).not.toContain(own);
  });

  /* ---------- 6 ---------- */

  it('6: podium gets `stage` with an id only for questions on the stage before or after, otherwise only a counter without id', async () => {
    const h = await harness();
    const podium = reader('podium');
    const { ids, step: captured } = await newQuestions(h, 2);
    const [a, b] = ids as [string, string];
    expect(changeOf(live(podium, captured, h.meetingId))).toMatchObject({ topics: expect.arrayContaining(['stage']) });
    expect(changeOf(live(podium, captured, h.meetingId))?.subjects).toBeUndefined();
    const steps = await toApproved(h, a);
    for (const s of steps) {
      const c = changeOf(live(podium, s, h.meetingId));
      expect(c?.subjects ?? []).toEqual([]);
      expect(c?.topics ?? []).not.toContain('questions');
    }
    const staged = await stage(h, a);
    expect(changeOf(live(podium, staged, h.meetingId))).toMatchObject({ topics: expect.arrayContaining(['stage']), subjects: [a] });
    const delivered = await deliver(h, a);
    expect(changeOf(live(podium, delivered, h.meetingId))).toMatchObject({ topics: expect.arrayContaining(['stage']), subjects: [a] });
    const classifiedB = await classify(h, b);
    const c = changeOf(live(podium, classifiedB, h.meetingId));
    expect(c?.topics ?? []).not.toContain('stage');
    expect(c?.subjects).toBeUndefined();
  });

  /* ---------- 7 ---------- */

  it('7: admin gets `event` with exactly the JSON of listEvents, also for a meeting without his assignment; without an active meeting nothing', async () => {
    const h = await harness();
    const { step } = await newQuestions(h, 1);
    const admin = reader('admin');
    const messages = visibleMessages(new Map([['another-meeting', admin]]), step.batch, step.before, step.after, deps);
    expect(messages.map((x) => x.kind)).toEqual(step.batch.map(() => 'event'));
    for (const e of eventsOf(messages)) {
      const listed = (await h.peek.listEvents(e.seq - 1, 1)).items[0];
      expect(JSON.stringify(e)).toBe(JSON.stringify(listed));
    }
    expect(visibleMessages(new Map(), step.batch, step.before, step.after, deps)).toEqual([]);
  });

  /* ---------- 8 ---------- */

  it('8: in-process subscribe gives each role the change of the function; a role switch acts on the next delivery; a throwing actor gives [] and the next listener still runs', async () => {
    const h = await harness();
    let current: Actor = reader('capture');
    const api = createInProcessApi({ store: h.store, actor: () => current, clock: fixedClock });
    const received: { events: ReadEvent[]; change?: StreamChange; args: number }[] = [];
    const off = api.subscribe((...args: [ReadEvent[], StreamChange?]) => {
      received.push({ events: args[0], ...(args[1] !== undefined ? { change: args[1] } : {}), args: args.length });
    });
    const second: number[] = [];
    const other = createInProcessApi({ store: h.store, actor: () => reader('moderation'), clock: fixedClock });
    const offSecond = other.subscribe((events) => second.push(events.length));

    const { ids } = await newQuestions(h, ROLES.length);
    received.length = 0;
    second.length = 0;
    for (const [i, role] of ROLES.entries()) {
      current = reader(role); // the demo role switcher: acts from the next delivery on
      const s = await classify(h, ids[i]!);
      expect(received).toHaveLength(i + 1);
      const got = received.at(-1)!;
      if (can(reader(role), 'event.read').allow) {
        expect(got.events.map((e) => e.seq)).toEqual(s.batch.map((e) => e.seq));
        expect(got.change).toBeUndefined();
      } else {
        expect(got.events).toEqual([]);
        expect(got.change).toEqual(changeOf(live(reader(role), s, h.meetingId)));
      }
    }
    expect(received).toHaveLength(ROLES.length);
    // Revoked or missing assignment: actor() throws → [] without change; the other listener still runs.
    current = { id: 'nobody', role: 'moderation', assignmentScoped: true };
    received.length = 0;
    second.length = 0;
    await classify(h, (await newQuestions(h, 1)).ids[0]!);
    expect(received.length).toBeGreaterThan(0);
    for (const r of received) {
      expect(r.events).toEqual([]);
      expect(r.change).toBeUndefined();
      expect(r.args).toBe(1);
    }
    expect(second.length).toBe(received.length);
    off();
    offSecond();
  });

  /* ---------- 9 ---------- */

  describe('9: catch-up (replayMessage)', () => {
    const range = (h: Harness, from: number): DomainEvent[] => h.store.all().slice(from);
    const now = (h: Harness): Map<string, State> => statesOf(h.store.all());

    it('(a) podium: QuestionDelivered or QuestionStaged in the range → reset; only QuestionClassified → at most meeting', async () => {
      const h = await harness();
      const podium = readers(h.meetingId, reader('podium'));
      const { ids } = await newQuestions(h, 2);
      const [a, b] = ids as [string, string];
      await toApproved(h, a);
      let from = h.store.lastSeq();
      await stage(h, a);
      expect(replayMessage(podium, range(h, from), now(h), deps)).toEqual({ kind: 'reset' });
      from = h.store.lastSeq();
      await deliver(h, a);
      expect(replayMessage(podium, range(h, from), now(h), deps)).toEqual({ kind: 'reset' });
      from = h.store.lastSeq();
      await classify(h, b);
      const r = replayMessage(podium, range(h, from), now(h), deps);
      expect(r.kind).toBe('messages');
      const c = r.kind === 'messages' ? changeOf(r.messages) : undefined;
      if (c) {
        expect(c.topics).toEqual(['meeting']);
        expect(c.subjects).toBeUndefined();
        expect(c.replay).toBe(true);
      }
    });

    it('(a2) moderation and approver: QuestionStaged or QuestionDelivered → reset; only QuestionClassified → replay change with questions, without stage', async () => {
      const h = await harness();
      const { ids } = await newQuestions(h, 2);
      const [a, b] = ids as [string, string];
      await toApproved(h, a);
      const fromStage = h.store.lastSeq();
      await stage(h, a);
      const staged = range(h, fromStage);
      const fromDeliver = h.store.lastSeq();
      await deliver(h, a);
      const delivered = range(h, fromDeliver);
      const fromClassify = h.store.lastSeq();
      await classify(h, b);
      const classified = range(h, fromClassify);
      for (const role of ['moderation', 'approver'] as Role[]) {
        const r = readers(h.meetingId, reader(role));
        expect(replayMessage(r, staged, now(h), deps), role).toEqual({ kind: 'reset' });
        expect(replayMessage(r, delivered, now(h), deps), role).toEqual({ kind: 'reset' });
        const out = replayMessage(r, classified, now(h), deps);
        const c = out.kind === 'messages' ? changeOf(out.messages) : undefined;
        expect(c, role).toMatchObject({ replay: true, seq: classified.at(-1)!.seq, subjects: [b] });
        expect(c!.topics).toContain('questions');
        expect(c!.topics).not.toContain('stage');
      }
    });

    it('(b) expert: QuestionAssigned of a question of his unit to another → reset; (c) capture over the same range → replay change', async () => {
      const h = await harness();
      const { ids } = await newQuestions(h, 1);
      const id = ids[0]!;
      await classify(h, id);
      await assign(h, id, 'unit-fin');
      const from = h.store.lastSeq();
      await assign(h, id, 'unit-hr');
      const events = range(h, from);
      expect(replayMessage(readers(h.meetingId, EXPERT_FIN), events, now(h), deps)).toEqual({ kind: 'reset' });
      const out = replayMessage(readers(h.meetingId, reader('capture')), events, now(h), deps);
      expect(out.kind).toBe('messages');
      expect(out.kind === 'messages' ? changeOf(out.messages) : undefined).toMatchObject({ replay: true, subjects: [id], topics: expect.arrayContaining(['questions']) });
    });

    it('(d) observer: a range of draft events only, without SCOPE_EXIT_EVENTS → at most meeting without id', async () => {
      const h = await harness();
      const { ids } = await newQuestions(h, 1);
      const id = ids[0]!;
      await classify(h, id);
      await assign(h, id, 'unit-fin');
      const from = h.store.lastSeq();
      await draft(h, id);
      await submit(h, id);
      await clear(h, id);
      await approve(h, id);
      const events = range(h, from);
      expect(events.some((e) => SCOPE_EXIT_EVENTS.has(e.type))).toBe(false);
      const out = replayMessage(readers(h.meetingId, reader('observer')), events, now(h), deps);
      expect(out.kind).toBe('messages');
      const c = out.kind === 'messages' ? changeOf(out.messages) : undefined;
      if (c) {
        expect(c.topics).toEqual(['meeting']);
        expect(c.subjects).toBeUndefined();
      }
      expect(JSON.stringify(out)).not.toContain(DRAFT_TEXT);
    });
  });

  /* ---------- 10 ---------- */

  it('10: resolveReaderActors loses a meeting on revocation and gains one on RoleAssigned; an event without meetingId goes only as event to event.read', () => {
    const meeting = (id: string): State => {
      const s = emptyState();
      reduce(s, { seq: 1, id: `mc-${id}`, type: 'MeetingCreated', at: new Date(START).toISOString(), actor: W.admin!, subjectId: id, meetingId: id,
        payload: { title: id, date: '2027-04-20', lifecycleVersion: 2, agendaItems: [], units: [{ id: 'unit-fin', name: 'Finanzen' }] } } as DomainEvent);
      reduce(s, { seq: 2, id: `ms-${id}`, type: 'MeetingStarted', at: new Date(START).toISOString(), actor: W.admin!, subjectId: id, meetingId: id, payload: {} } as DomainEvent);
      return s;
    };
    const grant = (s: State, assignmentId: string, role: Role, seq: number): void => {
      reduce(s, { seq, id: `ra-${assignmentId}`, type: 'RoleAssigned', at: new Date(START).toISOString(), actor: W.admin!, subjectId: assignmentId,
        meetingId: s.meeting!.id, payload: { assignmentId, subjectId: 'subject-1', role, ...(role === 'expert' ? { unitId: 'unit-fin' } : {}) } } as DomainEvent);
    };
    const a = meeting('hv-a');
    const b = meeting('hv-b');
    grant(a, 'g-a', 'legal', 3);
    let map = resolveReaderActors(new Map([['hv-a', a], ['hv-b', b]]), 'subject-1', fixedClock);
    expect([...map.keys()]).toEqual(['hv-a']);
    expect(map.get('hv-a')).toMatchObject({ id: 'subject-1', role: 'legal', assignmentScoped: true });
    grant(b, 'g-b', 'expert', 3);
    map = resolveReaderActors(new Map([['hv-a', a], ['hv-b', b]]), 'subject-1', fixedClock);
    expect([...map.keys()].sort()).toEqual(['hv-a', 'hv-b']);
    expect(map.get('hv-b')).toMatchObject({ role: 'expert', unitId: 'unit-fin' });
    reduce(a, { seq: 4, id: 'rr-a', type: 'RoleRevoked', at: new Date(START).toISOString(), actor: W.admin!, subjectId: 'g-a', meetingId: 'hv-a',
      payload: { assignmentId: 'g-a', subjectId: 'subject-1', role: 'legal' } } as DomainEvent);
    map = resolveReaderActors(new Map([['hv-a', a], ['hv-b', b]]), 'subject-1', fixedClock);
    expect([...map.keys()]).toEqual(['hv-b']);

    const noMeeting = { seq: 9, id: 'x', type: 'QuestionClosed', at: new Date(START).toISOString(), actor: W.admin!, subjectId: 'q-x', payload: {},
      hash: 'a'.repeat(64), prevHash: '' } as DomainEvent;
    const states = new Map([['hv-a', a], ['hv-b', b]]);
    expect(visibleMessages(new Map([['hv-a', reader('admin')]]), [noMeeting], states, states, deps).map((x) => x.kind)).toEqual(['event']);
    for (const role of ROLES.filter((r) => !can(reader(r), 'event.read').allow)) {
      expect(visibleMessages(new Map([['hv-a', reader(role)]]), [noMeeting], states, states, deps), role).toEqual([]);
    }
  });

  /* ---------- 11 ---------- */

  it('11: isOnStage agrees with getStage and visibleMessages; 101 subjects drop the field; IdempotencyRecorded on a question → questions with id, otherwise only event', async () => {
    const h = await harness();
    const approvedQ = [...h.after().questions.values()].find((x) => x.status === 'approved')!;
    await stage(h, approvedQ.id);
    const stageView = await createInProcessApi({ store: h.store, actor: () => reader('podium'), clock: fixedClock }).getStage();
    const onStage = [stageView.current, ...stageView.queue].filter((q) => q !== null).map((q) => q!.id).sort();
    const state = h.after();
    expect([...state.questions.values()].filter(isOnStage).map((q) => q.id).sort()).toEqual(onStage);
    const id = onStage[0]!;
    const q = state.questions.get(id)!;
    const claim = { seq: h.store.lastSeq() + 1, id: 'claim-x', type: 'QuestionClaimed', at: new Date(START).toISOString(), actor: W.expert!, subjectId: id,
      meetingId: h.meetingId, payload: { actorId: 'w-exp', claimedAt: new Date(START).toISOString(), expiresAt: new Date(START + 600_000).toISOString() } } as DomainEvent;
    const states = new Map([[h.meetingId, state]]);
    expect(changeOf(visibleMessages(readers(h.meetingId, reader('podium')), [claim], states, states, deps))).toMatchObject({ topics: ['stage'], subjects: [id] });
    const notStaged = [...state.questions.values()].find((x) => !isOnStage(x))!;
    expect(isOnStage(q)).toBe(true);
    const other = { ...claim, subjectId: notStaged.id } as DomainEvent;
    expect(changeOf(visibleMessages(readers(h.meetingId, reader('podium')), [other], states, states, deps))).toBeUndefined();

    // 101 subjects: the field is dropped, the topic stays.
    const big = await harness();
    const many = await newQuestions(big, 101);
    const c = changeOf(live(reader('capture'), many.step, big.meetingId));
    expect(c?.topics).toContain('questions');
    expect(c?.subjects).toBeUndefined();
    const hundred = many.ids.slice(0, 100).map((qid, i) => ({ ...claim, seq: 10_000 + i, subjectId: qid, meetingId: big.meetingId }) as DomainEvent);
    const bigStates = statesOf(big.store.all());
    expect(changeOf(visibleMessages(readers(big.meetingId, reader('capture')), hundred, bigStates, bigStates, deps))?.subjects).toHaveLength(100);

    // IdempotencyRecorded: with a question as subject the question history changes (Bauklärung C1).
    const idem = (subjectId: string): DomainEvent => ({ seq: h.store.lastSeq() + 1, id: `idem-${subjectId}`, type: 'IdempotencyRecorded',
      at: new Date(START).toISOString(), actor: W.admin!, subjectId, meetingId: h.meetingId, idempotencyKey: 'k', payload: {},
      hash: 'b'.repeat(64), prevHash: '' } as DomainEvent);
    const readable = [...state.questions.values()].find((x) => x.status === 'in_review')!;
    expect(changeOf(visibleMessages(readers(h.meetingId, reader('legal')), [idem(readable.id)], states, states, deps)))
      .toEqual({ seq: h.store.lastSeq() + 1, topics: ['questions'], subjects: [readable.id], meetingId: h.meetingId });
    expect(changeOf(visibleMessages(readers(h.meetingId, reader('observer')), [idem(readable.id)], states, states, deps))).toBeUndefined();
    for (const role of ROLES) {
      const out = visibleMessages(readers(h.meetingId, reader(role)), [idem(h.meetingId)], states, states, deps);
      expect(out.filter((x) => x.kind === 'change'), role).toEqual([]);
      if (can(reader(role), 'event.read').allow) {
        expect(out.map((x) => x.kind)).toEqual(['event']);
        expect(JSON.stringify(out)).not.toContain('"idempotencyKey"');
      }
    }
  });

  /* ---------- 12 ---------- */

  it('12: one change per batch — captureQuestions with three questions gives one listener call with one change', async () => {
    const h = await harness();
    const speakerId = await newSpeaker(h);
    const text = 'Erste Frage? Zweite Frage? Dritte Frage?';
    const contributionId = await newContribution(h, speakerId, text);
    const api = createInProcessApi({ store: h.store, actor: () => reader('capture'), clock: fixedClock });
    const calls: { events: ReadEvent[]; change?: StreamChange }[] = [];
    api.subscribe((events, change) => calls.push({ events, ...(change !== undefined ? { change } : {}) }));
    h.as(W.capture!);
    const c = await h.peek.getContribution(contributionId);
    const parts = text.split(/(?<=\?)\s*/).filter(Boolean);
    const s = await h.step(() => h.writer.captureQuestions(contributionId, parts.map((p) => ({ text: p })), { ifMatch: etagOf(c.version) }));
    const qids = s.result.map((q) => q.id);
    expect(s.batch.filter((e) => e.type === 'QuestionCaptured')).toHaveLength(3);
    expect(calls).toHaveLength(1);
    const change = calls[0]!.change!;
    expect(calls[0]!.events).toEqual([]);
    expect(change.seq).toBe(s.batch.at(-1)!.seq);
    expect(change.subjects).toEqual(expect.arrayContaining([...qids, contributionId, speakerId]));
    expect(change.meetingId).toBe(h.meetingId);
    const direct = live(reader('capture'), s, h.meetingId);
    expect(direct.filter((m) => m.kind === 'change')).toHaveLength(1);
    expect(changeOf(direct)).toEqual(change);
  });
});
