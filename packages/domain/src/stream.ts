/**
 * Stream visibility (Stromsichtbarkeit), rule R-PERM-04, slice 035a: a pure decision of what one
 * reader learns from a batch of events — the full masked event, a change signal without content
 * (Änderungssignal), or nothing. Decided per event, per reader, with the rights at delivery time.
 * The in-process `subscribe` (api.ts) and the SSE service (slice 035b) use these same functions.
 *
 * Every rights decision goes through `can()`, passed in as a function so that this module imports
 * nothing but types from `api.ts` (no runtime import cycle). No role name appears here, and no check
 * infers "what kind of read scope" a reader has: a reader is item-bound exactly when `can()` denies
 * it some item it would otherwise see.
 */
import type { can as canFunction } from './api.js';
import type { DomainEvent, EventType, ReadEvent } from './events.js';
import { emptyState, isOnStage, type State } from './state.js';
import type { Actor, Permission, QuestionRecord, RoleAssignment, StreamChange, StreamTopic } from './types.js';
import { READ_PERMISSIONS } from './types.js';

export type Can = typeof canFunction;

/** All topics, in the order a change message lists them. */
export const STREAM_TOPICS = ['meeting', 'speakers', 'contributions', 'questions', 'stage', 'roles'] as const satisfies readonly StreamTopic[];
// Exhaustive both ways: a topic added to the contract type must be listed above.
const _allTopicsListed: Record<StreamTopic, true> = { meeting: true, speakers: true, contributions: true, questions: true, stage: true, roles: true };
void _allTopicsListed;

/** Contract `StreamChange.subjects` has `maxItems: 100`; above that the field is left out. */
export const MAX_STREAM_SUBJECTS = 100;

/** An item an event touches, including side effects of the reduction (state.ts). */
export interface SubjectRef {
  readonly kind: 'question' | 'speaker' | 'contribution' | 'roleAssignment' | 'meeting';
  readonly id: string;
}

/**
 * Topics per event type: a conservative superset of the read views the event can change
 * (test 2 checks it against every event of the corpus run).
 */
export const EVENT_TOPICS: Readonly<Record<EventType, readonly StreamTopic[]>> = {
  MeetingCreated: ['meeting'],
  MeetingStarted: ['meeting'],
  MeetingClosed: ['meeting'],
  DebateClosed: ['meeting'],
  AgendaItemOpened: ['meeting'],
  VotingOpened: ['meeting'],
  VotingClosed: ['meeting'],
  SpeakerRegistered: ['meeting', 'speakers'],
  RoleAssigned: ['roles'],
  RoleRevoked: ['roles'],
  SpeakersReordered: ['meeting', 'speakers'],
  SpeakerUpdated: ['meeting', 'speakers'],
  ContributionCaptured: ['meeting', 'speakers', 'contributions'],
  QuestionCaptured: ['meeting', 'speakers', 'contributions', 'questions', 'stage'],
  QuestionClassified: ['meeting', 'questions', 'stage'],
  QuestionAssigned: ['meeting', 'questions', 'stage'],
  AnswerDrafted: ['meeting', 'questions', 'stage'],
  QuestionSubmittedForReview: ['meeting', 'questions', 'stage'],
  QuestionApproved: ['meeting', 'questions', 'stage'],
  QuestionLegalCleared: ['questions', 'stage'],
  QuestionReturned: ['meeting', 'questions', 'stage'],
  QuestionStaged: ['meeting', 'questions', 'stage'],
  QuestionDelivered: ['meeting', 'questions', 'stage'],
  QuestionClosed: ['meeting', 'questions', 'stage'],
  QuestionWithdrawn: ['meeting', 'questions', 'stage'],
  QuestionMerged: ['meeting', 'questions', 'stage'],
  ContributionClaimed: ['contributions'],
  ContributionReleased: ['contributions'],
  QuestionClaimed: ['questions', 'stage'],
  QuestionReleased: ['questions', 'stage'],
  // The question history lists every event whose subjectId is the question (Bauklärung C1).
  IdempotencyRecorded: ['questions'],
  // Scheibe 040b: master data of the meeting; the counters per unit and seat change with them.
  AgendaItemsReplaced: ['meeting'],
  UnitsReplaced: ['meeting'],
  StageSeatsReplaced: ['meeting'],
};

const meetingRef = (e: DomainEvent): SubjectRef[] => (e.meetingId !== undefined ? [{ kind: 'meeting', id: e.meetingId }] : []);
const question = (id: string): SubjectRef => ({ kind: 'question', id });
/** A question status change: the question and the meeting counters. */
const questionStatus = (e: DomainEvent): readonly SubjectRef[] => [question(e.subjectId), ...meetingRef(e)];
const questionOnly = (e: DomainEvent): readonly SubjectRef[] => [question(e.subjectId)];

/**
 * Items per event type, side effects included (M2), read from `reduce` (state.ts): `QuestionCaptured`
 * also bumps the contribution, the speaker request and `speakerListVersion`; `QuestionMerged` names
 * its target too (reduce leaves the target unchanged; a harmless superset, Bauklärung).
 */
export const EVENT_SUBJECTS: { readonly [T in EventType]: (e: Extract<DomainEvent, { type: T }>) => readonly SubjectRef[] } = {
  MeetingCreated: (e) => [{ kind: 'meeting', id: e.subjectId }],
  MeetingStarted: meetingRef,
  MeetingClosed: meetingRef,
  DebateClosed: meetingRef,
  AgendaItemOpened: meetingRef,
  VotingOpened: meetingRef,
  VotingClosed: meetingRef,
  SpeakerRegistered: (e) => [{ kind: 'speaker', id: e.subjectId }, ...meetingRef(e)],
  RoleAssigned: (e) => [{ kind: 'roleAssignment', id: e.subjectId }],
  RoleRevoked: (e) => [{ kind: 'roleAssignment', id: e.subjectId }],
  SpeakersReordered: (e) => [...e.payload.speakerIds.map((id): SubjectRef => ({ kind: 'speaker', id })), ...meetingRef(e)],
  SpeakerUpdated: (e) => [{ kind: 'speaker', id: e.subjectId }, ...meetingRef(e)],
  ContributionCaptured: (e) => [{ kind: 'contribution', id: e.subjectId }, { kind: 'speaker', id: e.payload.speakerId }, ...meetingRef(e)],
  QuestionCaptured: (e) => [question(e.subjectId), { kind: 'contribution', id: e.payload.contributionId },
    { kind: 'speaker', id: e.payload.speakerId }, ...meetingRef(e)],
  QuestionClassified: questionStatus,
  QuestionAssigned: questionStatus,
  AnswerDrafted: questionStatus,
  QuestionSubmittedForReview: questionStatus,
  QuestionApproved: questionStatus,
  QuestionLegalCleared: questionOnly,
  QuestionReturned: questionStatus,
  QuestionStaged: questionStatus,
  QuestionDelivered: questionStatus,
  QuestionClosed: questionStatus,
  QuestionWithdrawn: questionStatus,
  QuestionMerged: (e) => [question(e.subjectId), question(e.payload.intoQuestionId), ...meetingRef(e)],
  ContributionClaimed: (e) => [{ kind: 'contribution', id: e.subjectId }],
  ContributionReleased: (e) => [{ kind: 'contribution', id: e.subjectId }],
  QuestionClaimed: questionOnly,
  QuestionReleased: questionOnly,
  // Resolved against the projection: only a subject that is a question counts (see `lookup`).
  IdempotencyRecorded: questionOnly,
  AgendaItemsReplaced: meetingRef,
  UnitsReplaced: meetingRef,
  StageSeatsReplaced: meetingRef,
};

/** Events after which a question may leave a reader's read scope (M3): a catch-up then resets. */
export const SCOPE_EXIT_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  'QuestionAssigned', 'QuestionDelivered', 'QuestionReturned', 'QuestionWithdrawn', 'QuestionMerged', 'QuestionClosed',
]);
/** Events that put a question on the stage: for a `stage.read` reader a catch-up resets on them too. */
export const STAGE_ENTRY_EVENTS: ReadonlySet<EventType> = new Set<EventType>(['QuestionStaged']);
/**
 * Events that can change `openCount`/`deliveredCount` of the stage view (Bauklärung): the catch-up
 * has no earlier projection to compare, so it signals the stage counter on these. Test 2 checks the
 * set against every counter change of the corpus run.
 */
export const STAGE_COUNTER_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  'QuestionCaptured', 'QuestionDelivered', 'QuestionClosed', 'QuestionWithdrawn', 'QuestionMerged', 'QuestionReturned',
]);

/**
 * Lookups that tolerate an event type the tables do not know (a log written by a newer or older
 * version): no topics, no items — such an event reaches only `event.read` holders, and the stream
 * bookkeeping never throws on it (e2e-http regression of slice 035a).
 */
const subjectsOf = (e: DomainEvent): readonly SubjectRef[] => {
  const pick = (EVENT_SUBJECTS as Partial<Record<string, (event: DomainEvent) => readonly SubjectRef[]>>)[e.type];
  return pick ? pick(e) : [];
};
const topicsOf = (e: DomainEvent): readonly StreamTopic[] =>
  (EVENT_TOPICS as Partial<Record<string, readonly StreamTopic[]>>)[e.type] ?? [];

/** Read methods per topic; the permissions come from `READ_PERMISSIONS` (types.ts), never by name. */
const methodPermissions = (...methods: (keyof typeof READ_PERMISSIONS)[]): readonly Permission[] =>
  [...new Set(methods.flatMap((m) => READ_PERMISSIONS[m]))];
/**
 * Which permission unlocks a topic. `null`: every reader with an active assignment (master data,
 * Festlegung 1 of slice 010). `roles`: `listRoleAssignments` checks `admin.roles.manage`, which is
 * not a `READ_PERMISSIONS` entry; a reader's own assignment is the one exception (see `collect`).
 */
const TOPIC_PERMISSIONS: Readonly<Record<StreamTopic, readonly Permission[] | null>> = {
  meeting: null,
  speakers: methodPermissions('listSpeakers', 'getSpeaker'),
  contributions: methodPermissions('listContributions', 'getContribution'),
  questions: methodPermissions('listQuestions', 'getQuestion', 'getQuestionHistory'),
  stage: methodPermissions('getStage'),
  roles: ['admin.roles.manage'],
};

/* ---------- masking (moved from the api.ts closure, same behaviour) ---------- */

// Nested actors and person blocks may sit anywhere in a payload (approval, clearance, answer
// versions), so the strip is recursive; `id` and `role` of a nested actor stay visible.
const MASKED_KEYS: ReadonlySet<string> = new Set(['displayName', 'organisation', 'pii', 'personId']);
const maskValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(maskValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !MASKED_KEYS.has(key)).map(([key, item]) => [key, maskValue(item)]));
  }
  return value;
};
/** The standard read projection of an event (`listEvents`, `subscribe`, the stream). Throws on a
 * missing source hash; callers report that by seq and never abort a delivery loop for it. */
export function maskEvent(event: DomainEvent): ReadEvent {
  if (!event.hash) throw new Error(`Event seq ${event.seq}: integrity check failed (source hash missing).`);
  const { personId: _personId, hash: sourceHash, prevHash: _prevHash,
    commandId: _commandId, commandOperation: _commandOperation, commandResource: _commandResource,
    ...visible } = event;
  const { displayName: _actorName, personId: _actorPerson, ...eventActor } = event.actor;
  const payload = maskValue(event.payload) as Record<string, unknown>;
  if (event.type === 'IdempotencyRecorded') delete visible.idempotencyKey;
  return { ...visible, actor: eventActor, payload, redacted: true, sourceHash } as ReadEvent;
}

/* ---------- actor per meeting (Jahrgang) ---------- */

/** The oldest active grant of `subjectId` in this meeting that `matches`; `now` is read lazily, only
 * for a grant with an expiry — the same clock calls as the former closure in api.ts. */
function activeAssignment(state: State, subjectId: string, matches: (a: RoleAssignment) => boolean, now: () => Date): RoleAssignment | undefined {
  return [...state.roleAssignments.values()].find((item) => item.subjectId === subjectId && matches(item) && !item.revokedAt &&
    (item.expiresAt === undefined || Date.parse(item.expiresAt) > now().getTime()) && state.meeting?.status !== 'closed');
}
const actorFrom = (subjectId: string, assignment: RoleAssignment): Actor => ({ id: subjectId, role: assignment.role, assignmentScoped: true,
  ...(assignment.personId !== undefined ? { personId: assignment.personId } : {}),
  ...(assignment.unitId !== undefined ? { unitId: assignment.unitId } : {}) });

/**
 * The former `actor()` closure of `createInProcessApi`, extracted: the synthetic demo identity (no
 * grant in this meeting, not assignment-scoped) stays as it is; otherwise the oldest active grant
 * decides. `null` where the closure threw 403 R-PERM-01; api.ts turns that into the same problem.
 */
export function resolveMeetingActor(state: State, current: Actor, now: () => Date): Actor | null {
  const history = [...state.roleAssignments.values()].filter((assignment) => assignment.subjectId === current.id);
  if (history.length === 0 && current.assignmentScoped !== true) return current;
  const assignment = activeAssignment(state, current.id, (item) => current.assignmentScoped === true || item.role === current.role, now);
  return assignment ? actorFrom(current.id, assignment) : null;
}

/**
 * The reader's actor per meeting with an active assignment (M4), from the same projections that
 * decide visibility (M6). Slice 035b compares this map on every delivery; a meeting that drops out
 * or joins ends the stream (`roles_changed`).
 */
export function resolveReaderActors(states: ReadonlyMap<string, State>, subjectId: string, now: () => Date): ReadonlyMap<string, Actor> {
  const out = new Map<string, Actor>();
  for (const [meetingId, state] of states) {
    if (!state.meeting) continue;
    const assignment = activeAssignment(state, subjectId, () => true, now);
    if (assignment) out.set(meetingId, actorFrom(subjectId, assignment));
  }
  return out;
}

/* ---------- visibility ---------- */

export type StreamMessage =
  | { readonly kind: 'event'; readonly event: ReadEvent }
  | { readonly kind: 'change'; readonly change: StreamChange };
export type ReplayResult =
  | { readonly kind: 'reset' }
  | { readonly kind: 'messages'; readonly messages: readonly StreamMessage[] };
export interface StreamDeps {
  readonly can: Can;
  /** Called for an event without source hash; the event is skipped, the batch continues. */
  readonly onIntegrityError?: (error: Error) => void;
}
/** Projections per meeting id. The "before" map may be partial (`snapshotBefore`). */
export type StreamStates = ReadonlyMap<string, State>;

const holdsEventRead = (readerActors: ReadonlyMap<string, Actor>, can: Can): boolean =>
  [...readerActors.values()].some((a) => can(a, 'event.read').allow);
const topicReadable = (a: Actor, topic: StreamTopic, can: Can): boolean => {
  const perms = TOPIC_PERMISSIONS[topic];
  return perms === null || perms.some((p) => can(a, p).allow);
};

function eventMessages(events: readonly DomainEvent[], deps: StreamDeps): StreamMessage[] {
  const out: StreamMessage[] = [];
  for (const e of events) {
    try {
      out.push({ kind: 'event', event: maskEvent(e) });
    } catch (error) {
      try { deps.onIntegrityError?.(error instanceof Error ? error : new Error('Event integrity check failed.')); } catch { /* a faulty callback must not break delivery */ }
    }
  }
  return out;
}

/** Collects topics and ids across a batch into one change message (Codex P2: one change per batch). */
class ChangeBuilder {
  private readonly topics = new Set<StreamTopic>();
  private readonly subjects = new Set<string>();
  private readonly meetings = new Set<string>();
  add(meetingId: string, topic: StreamTopic, id?: string): void {
    this.topics.add(topic);
    this.meetings.add(meetingId);
    if (id !== undefined) this.subjects.add(id);
  }
  build(seq: number, replay: boolean): StreamChange | undefined {
    if (this.topics.size === 0) return undefined;
    const subjects = [...this.subjects];
    const [meetingId] = this.meetings;
    return {
      seq,
      topics: STREAM_TOPICS.filter((t) => this.topics.has(t)),
      ...(subjects.length > 0 && subjects.length <= MAX_STREAM_SUBJECTS ? { subjects } : {}),
      ...(this.meetings.size === 1 && meetingId !== undefined ? { meetingId } : {}),
      ...(replay ? { replay: true as const } : {}),
    };
  }
}

/** Records of one item in the given projections (before and after live, now only in a catch-up). */
interface Lookup {
  questions(id: string): QuestionRecord[];
  exists(kind: 'speaker' | 'contribution', id: string): boolean;
  assignments(id: string): RoleAssignment[];
}
function lookupIn(states: readonly (State | undefined)[]): Lookup {
  const present = states.filter((s): s is State => s !== undefined);
  return {
    questions: (id) => present.flatMap((s) => { const q = s.questions.get(id); return q ? [q] : []; }),
    exists: (kind, id) => present.some((s) => (kind === 'speaker' ? s.speakers.has(id) : s.contributions.has(id))),
    assignments: (id) => present.flatMap((s) => { const r = s.roleAssignments.get(id); return r ? [r] : []; }),
  };
}

/** Adds what reader `a` may learn about the items of event `e` (per item, through `can()`). */
function collect(out: ChangeBuilder, a: Actor, e: DomainEvent, meetingId: string, lookup: Lookup, can: Can): void {
  const topics = topicsOf(e);
  const allowed = (t: StreamTopic): boolean => topics.includes(t) && topicReadable(a, t, can);
  for (const ref of subjectsOf(e)) {
    switch (ref.kind) {
      case 'question': {
        const records = lookup.questions(ref.id);
        if (allowed('questions') && records.some((q) => can(a, 'question.read', q).allow)) out.add(meetingId, 'questions', ref.id);
        // The same for every role (M9): the item was or is on the stage, read with `stage.read`.
        if (allowed('stage') && records.some(isOnStage)) out.add(meetingId, 'stage', ref.id);
        break;
      }
      case 'speaker':
        if (allowed('speakers') && lookup.exists('speaker', ref.id)) out.add(meetingId, 'speakers', ref.id);
        break;
      case 'contribution':
        if (allowed('contributions') && lookup.exists('contribution', ref.id)) out.add(meetingId, 'contributions', ref.id);
        break;
      case 'roleAssignment': {
        const records = lookup.assignments(ref.id);
        if (topics.includes('roles') && records.length > 0 && (topicReadable(a, 'roles', can) || records.some((r) => r.subjectId === a.id))) {
          out.add(meetingId, 'roles', ref.id);
        }
        break;
      }
      case 'meeting':
        break; // counters and master data: `meeting`/`stage` without id, decided per batch below
    }
  }
}

const meetingView = (s: State | undefined): string =>
  JSON.stringify(s?.meeting ? { meeting: s.meeting, agendaItems: s.agendaItems, units: s.units } : null);
const stageCounters = (s: State | undefined): string =>
  `${s?.meeting?.counts.open ?? 0}/${s?.meeting?.counts.delivered ?? 0}`;

/**
 * Live batch (one delivery of `store.subscribe`, or one reload in the 035b distributor). A reader
 * holding `event.read` in any active meeting gets every event, masked like `listEvents` (M5 a).
 * Everyone else gets at most one `change`: per event of a meeting where the reader has an actor,
 * the readable topics and ids — an item counts when the reader may read it before or after the
 * batch. Events without `meetingId` never become a `change` (M4).
 */
export function visibleMessages(readerActors: ReadonlyMap<string, Actor>, batch: readonly DomainEvent[],
  before: StreamStates, after: StreamStates, deps: StreamDeps): StreamMessage[] {
  if (batch.length === 0) return [];
  if (holdsEventRead(readerActors, deps.can)) return eventMessages(batch, deps);
  const out = new ChangeBuilder();
  const touched = new Map<string, Set<StreamTopic>>();
  for (const e of batch) {
    if (e.meetingId === undefined) continue;
    const a = readerActors.get(e.meetingId);
    if (!a) continue;
    collect(out, a, e, e.meetingId, lookupIn([before.get(e.meetingId), after.get(e.meetingId)]), deps.can);
    const topics = touched.get(e.meetingId) ?? new Set<StreamTopic>();
    for (const t of topicsOf(e)) topics.add(t);
    touched.set(e.meetingId, topics);
  }
  for (const [meetingId, topics] of touched) {
    const a = readerActors.get(meetingId)!;
    const was = before.get(meetingId);
    const is = after.get(meetingId);
    // Counters without an id (T-G1-I-04): the meeting view, and for `stage.read` the stage counters.
    if (topics.has('meeting') && meetingView(was) !== meetingView(is)) out.add(meetingId, 'meeting');
    if (topics.has('stage') && deps.can(a, 'stage.read').allow && stageCounters(was) !== stageCounters(is)) out.add(meetingId, 'stage');
  }
  const change = out.build(batch.at(-1)!.seq, false);
  return change ? [{ kind: 'change', change }] : [];
}

/**
 * Catch-up over `(cursor, head]` without historical projections (M3). `event.read`: every event.
 * Everyone else: items are checked only against the current projection; a reader bound to items
 * resets instead when an item may have left its scope in the range — for `questions` when `can()`
 * denies it some current question and a `SCOPE_EXIT_EVENTS` event is in the range; for `stage`
 * (every `stage.read` holder, orchestrator's decision, option a) on `SCOPE_EXIT_EVENTS` or
 * `STAGE_ENTRY_EVENTS`. Otherwise one `change` with `replay: true` and `seq` = head.
 */
export function replayMessage(readerActors: ReadonlyMap<string, Actor>, events: readonly DomainEvent[],
  stateNow: StreamStates, deps: StreamDeps): ReplayResult {
  if (events.length === 0) return { kind: 'messages', messages: [] };
  if (holdsEventRead(readerActors, deps.can)) return { kind: 'messages', messages: eventMessages(events, deps) };
  const { can } = deps;
  const byMeeting = new Map<string, DomainEvent[]>();
  for (const e of events) {
    if (e.meetingId === undefined || !readerActors.has(e.meetingId)) continue;
    byMeeting.set(e.meetingId, [...(byMeeting.get(e.meetingId) ?? []), e]);
  }
  const out = new ChangeBuilder();
  for (const [meetingId, list] of byMeeting) {
    const a = readerActors.get(meetingId)!;
    const now = stateNow.get(meetingId);
    const exits = list.some((e) => SCOPE_EXIT_EVENTS.has(e.type));
    if (can(a, 'stage.read').allow && (exits || list.some((e) => STAGE_ENTRY_EVENTS.has(e.type)))) return { kind: 'reset' };
    if (exits && topicReadable(a, 'questions', can) && now !== undefined &&
      [...now.questions.values()].some((q) => !can(a, 'question.read', q).allow)) return { kind: 'reset' };
    const lookup = lookupIn([now]);
    for (const e of list) {
      collect(out, a, e, meetingId, lookup, can);
      const topics = topicsOf(e);
      if (topics.includes('meeting') && subjectsOf(e).some((ref) => ref.kind === 'meeting')) out.add(meetingId, 'meeting');
      if (topics.includes('stage') && STAGE_COUNTER_EVENTS.has(e.type) && can(a, 'stage.read').allow) out.add(meetingId, 'stage');
    }
  }
  const change = out.build(events.at(-1)!.seq, true);
  return { kind: 'messages', messages: change ? [{ kind: 'change', change }] : [] };
}

/* ---------- "before" for the in-process subscription ---------- */

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * A copy of the items a batch touches, taken before it is reduced (m6): the meeting view with its
 * counters and every record named by `EVENT_SUBJECTS`. Enough for `visibleMessages`, which looks up
 * nothing else in the "before" projection.
 */
export function snapshotBefore(states: StreamStates, batch: readonly DomainEvent[]): Map<string, State> {
  const out = new Map<string, State>();
  for (const e of batch) {
    if (e.meetingId === undefined) continue;
    const source = states.get(e.meetingId);
    if (!source) continue;
    let snap = out.get(e.meetingId);
    if (!snap) {
      snap = emptyState();
      snap.meeting = clone(source.meeting);
      snap.agendaItems = clone(source.agendaItems);
      snap.units = clone(source.units);
      snap.stageCounter = source.stageCounter;
      snap.lastSeq = source.lastSeq;
      out.set(e.meetingId, snap);
    }
    for (const ref of subjectsOf(e)) {
      if (ref.kind === 'question') copy(source.questions, snap.questions, ref.id);
      else if (ref.kind === 'speaker') copy(source.speakers, snap.speakers, ref.id);
      else if (ref.kind === 'contribution') copy(source.contributions, snap.contributions, ref.id);
      else if (ref.kind === 'roleAssignment') copy(source.roleAssignments, snap.roleAssignments, ref.id);
    }
  }
  return out;
}
function copy<V>(from: Map<string, V>, to: Map<string, V>, id: string): void {
  const value = from.get(id);
  if (value !== undefined && !to.has(id)) to.set(id, clone(value));
}
