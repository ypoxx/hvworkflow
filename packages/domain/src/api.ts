/**
 * The application core behind the contract. `HvApi` is the interface the user interface talks to;
 * `createInProcessApi` implements it directly on the domain (used in the browser for the demo and
 * by the HTTP server in `apps/api`). An HTTP client adapter implements the same interface with
 * `fetch` and needs no other change in the interface (ADR 0002).
 *
 * Every write:
 *   1. checks permission and transition through `can()` (deny by default),
 *   2. checks `If-Match` against the resource version (optimistic locking),
 *   3. replays an earlier result if the `Idempotency-Key` was seen,
 *   4. appends one event and returns the projected resource with `_actions`.
 */
import type { DomainEvent, NewEvent, ReadEvent } from './events.js';
import { ALLOW, deny, extendingScopesFor, hasPermission, hasUnitBoundRead, READ_SCOPES, ROLE_PERMISSIONS, type Decision } from './permissions.js';
import { resolveAgendaProgress, resolveMeetingCapture, resolveSpeakerTransition, resolveTransition, TRANSITION_ACTIONS } from './transitions.js';
import { emptyState, reduce, type State } from './state.js';
import { CORPUS_DEMO } from './seed.js';
import type { EventStore } from './store.js';
import type {
  Actor,
  AgendaItem,
  AnswerDraft,
  Classification,
  Contribution,
  ContributionCapture,
  MeetingContributionCapture,
  Meeting,
  Person,
  LegalClearanceRequest,
  Permission,
  Role,
  RoleAssignment,
  RoleAssignmentCreate,
  Question,
  QuestionCapture,
  QuestionFilter,
  QuestionRecord,
  QuestionStatus,
  ReadMethod,
  Speaker,
  SpeakerRecord,
  SpeakerRegistration,
  SpeakerUpdate,
  StageView,
  Unit,
  WriteOptions,
} from './types.js';
import { PERMISSIONS, READ_PERMISSIONS, STAGE_ASSIGNMENTS, TRACKS } from './types.js';

/** RFC 9457-shaped error. The HTTP adapter maps it 1:1 to a problem+json response. */
export class ApiProblem extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly ruleId: string | undefined;
  constructor(status: number, title: string, detail: string, ruleId?: string) {
    super(`${status} ${title}: ${detail}`);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.ruleId = ruleId;
  }
  toProblem(): { type: string; title: string; status: number; detail: string; ruleId?: string } {
    return {
      type: `urn:hv:problem:${this.status}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      ...(this.ruleId !== undefined ? { ruleId: this.ruleId } : {}),
    };
  }
}

export interface HvApi {
  getMeeting(): Promise<Meeting>;
  listMeetings(status?: Meeting['status']): Promise<Meeting[]>;
  getMeetingById(meetingId: string): Promise<Meeting>;
  listMeetingAgendaItems(meetingId: string): Promise<AgendaItem[]>;
  listMeetingUnits(meetingId: string): Promise<Unit[]>;
  openAgendaItem(agendaItemId: string, opts?: WriteOptions): Promise<AgendaItem>;
  openVoting(agendaItemId: string, opts?: WriteOptions): Promise<AgendaItem>;
  closeVoting(agendaItemId: string, opts?: WriteOptions): Promise<AgendaItem>;
  listAgendaItems(): Promise<AgendaItem[]>;
  listUnits(): Promise<Unit[]>;
  listRoleAssignments(filter?: { subjectId?: string; role?: Role }): Promise<RoleAssignment[]>;
  assignRole(input: RoleAssignmentCreate, opts?: WriteOptions): Promise<RoleAssignment>;
  revokeRole(id: string, reason?: string, opts?: WriteOptions): Promise<RoleAssignment>;

  listSpeakers(filter?: { round?: number; status?: Speaker['status'] }): Promise<Speaker[]>;
  getSpeaker(id: string): Promise<Speaker>;
  registerSpeaker(input: SpeakerRegistration, opts?: WriteOptions): Promise<Speaker>;
  reorderSpeakers(round: number, speakerIds: string[], opts?: WriteOptions): Promise<Speaker[]>;
  updateSpeaker(id: string, input: SpeakerUpdate, opts?: WriteOptions): Promise<Speaker>;

  listContributions(filter?: { speakerId?: string }): Promise<Contribution[]>;
  getContribution(id: string): Promise<Contribution>;
  captureContribution(input: ContributionCapture, opts?: WriteOptions): Promise<Contribution>;
  captureMeetingContribution(input: MeetingContributionCapture, opts?: WriteOptions): Promise<Contribution>;
  captureQuestions(contributionId: string, questions: QuestionCapture[], opts?: WriteOptions): Promise<Question[]>;
  claimContribution(id: string, opts?: WriteOptions): Promise<Contribution>;
  releaseContribution(id: string, opts?: WriteOptions): Promise<Contribution>;
  claimQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  releaseQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  /** ETag of the resource written by the last command on this request-local API instance. */
  lastWriteEtag(): string | undefined;

  listQuestions(filter?: QuestionFilter): Promise<{ items: Question[]; total: number }>;
  getQuestion(id: string): Promise<Question>;
  getQuestionHistory(id: string): Promise<ReadEvent[]>;
  classifyQuestion(id: string, input: Classification, opts?: WriteOptions): Promise<Question>;
  assignQuestion(id: string, unitId: string, opts?: WriteOptions): Promise<Question>;
  draftAnswer(id: string, input: AnswerDraft, opts?: WriteOptions): Promise<Question>;
  submitForReview(id: string, opts?: WriteOptions): Promise<Question>;
  approveQuestion(id: string, answerVersion: number, opts?: WriteOptions): Promise<Question>;
  clearQuestionLegally(id: string, input: LegalClearanceRequest, opts?: WriteOptions): Promise<Question>;
  returnQuestion(id: string, reason: string, opts?: WriteOptions): Promise<Question>;
  stageQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  deliverQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  closeQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  withdrawQuestion(id: string, reason: string, opts?: WriteOptions): Promise<Question>;
  mergeQuestion(id: string, intoQuestionId: string, opts?: WriteOptions): Promise<Question>;

  getStage(): Promise<StageView>;
  listEvents(after?: number, limit?: number): Promise<{ items: ReadEvent[]; lastSeq: number }>;
  /** Defaults to CORPUS_DEMO. `roundSizes` is a domain-only option; the contract names `questions` and `seed`. */
  seedDemo(options?: { questions?: number; seed?: number; roundSizes?: readonly number[] }): Promise<Meeting>;

  /** In-process realtime: called after every append. The HTTP adapter maps this to SSE/polling. */
  subscribe(listener: (events: ReadEvent[]) => void): () => void;
}

export interface InProcessApiOptions {
  store: EventStore;
  /** Canonical /meetings/{meetingId} handlers use a per-meeting projection; legacy aliases omit it. */
  meetingId?: string;
  /** The calling actor. A function so that the demo role switcher can change it at runtime. */
  actor: () => Actor;
  /** Single source of time (docs: R-TIME). Defaults to the system clock. */
  clock?: () => Date;
  idGenerator?: () => string;
  /** Provided by seed.ts; injected to keep this module free of demo content. */
  seeder?: (options: { questions: number; seed: number; roundSizes: readonly number[]; now: Date; actor: Actor }) => NewEvent[];
  /** A committed person-table projection, keyed by meeting, for the Postgres request boundary. */
  personSnapshots?: ReadonlyMap<string, readonly Person[]>;
}

export function etagOf(version: number): string {
  return `"v${version}"`;
}

/** 16 random bytes as hex, via the Web Crypto API — available even in "insecure" browser contexts
 * that lack `crypto.randomUUID` (review rework round 1, minor 16), unlike the clock, never involved. */
function randomIdFromBytes(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// `crypto.randomUUID` exists in Node 22 and every target browser in a secure context;
// `crypto.getRandomValues` is the wider-available next choice. Both are built from randomness
// alone — never from the clock (`scripts/now-check.mjs`, AGENTS.md rule 8) — so an id never
// doubles as a timestamp. `Math.random` is a last resort for an environment with no Web Crypto API
// at all (none of Node 22 or any target browser; kept only so this never throws).
const defaultId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) return randomIdFromBytes();
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * The single decision point (docs/rollen-und-rechtekonzept.md): permission bundle first, then a read
 * scope (R-PERM-03, Festlegung 2 of slice 010) if the action has one, then the transition table with
 * its guards. Exported so that tests can produce the truth table from it.
 *
 * `READ_SCOPES` (permissions.ts) restricts an action to specific statuses whenever it is a key there
 * — applied even to a role that holds the permission outright (e.g. admin's
 * `question.read.delivered` is still bound to `delivered`/`closed`). When the actor lacks `action`
 * itself, a scoped permission that `extends` it (Festlegung 2: `question.read.delivered` extends
 * `question.read`) substitutes for it within its scope — never by comparing permission names, only by
 * walking this data.
 */
export function can(
  actor: Actor,
  action: Permission,
  question?: QuestionRecord,
  payload?: unknown,
): Decision {
  const perm = hasPermission(actor, action);
  if (perm.allow) {
    if (question) {
      if (actor.assignmentScoped && hasUnitBoundRead(actor) && question.unitId !== actor.unitId) {
        return deny('R-PERM-03', 'Question is outside the assigned unit.');
      }
      const scope = READ_SCOPES[action];
      if (scope && !scope.statuses.includes(question.status)) {
        return deny('R-PERM-03', `Permission "${action}" only covers status ${scope.statuses.join('/')} (Leseumfang).`);
      }
    }
    if (question && TRANSITION_ACTIONS.includes(action)) {
      const t = resolveTransition(question, action, payload, { actor });
      if (!t.ok) return deny(t.ruleId, t.reason);
    }
    return ALLOW;
  }
  if (question) {
    // The single place this walk happens (rework round, point 3) — `extendingScopesFor`
    // (permissions.ts) is also what `listQuestions`'s status-filter pre-check calls into, via this
    // same `can()`, so a second scoped read right needs no further change anywhere.
    for (const scope of extendingScopesFor(actor, action)) {
      if (scope.statuses.includes(question.status)) return ALLOW;
    }
  }
  return perm;
}

/** A question shell for a status-only check (rework round, point 3): `status` and the actor's unit
 * matter to `READ_SCOPES`/`can()`; every other field is a harmless placeholder a caller never sees. Used to
 * validate a `listQuestions` status filter against the actor's own read scope through `can()` itself
 * — never a second, hand-rolled walk of `READ_SCOPES` outside it. */
function questionShell(status: QuestionStatus, unitId?: string): QuestionRecord {
  return {
    id: '',
    number: '',
    contributionId: '',
    speakerId: '',
    text: '',
    status,
    ...(unitId !== undefined ? { unitId } : {}),
    answers: [],
    version: 0,
    createdAt: '',
    updatedAt: '',
  };
}

/** Actions the actor may take on this question right now — the server-provided `_actions`. */
export function actionsFor(actor: Actor, q: QuestionRecord): Permission[] {
  return PERMISSIONS.filter((p) => p !== 'question.identity.reveal' && (p.startsWith('question.') || p === 'answer.draft'))
    .filter((p) => can(actor, p, q).allow);
}

const SPEAKER_ACTIONS: readonly Permission[] = ['speaker.update', 'speaker.reorder'];

export function systemClock(): Date { return new Date(); } // now-ok: default clock injection point for domain and server

export function createInProcessApi(options: InProcessApiOptions): HvApi {
  const { store } = options;
  const clock = options.clock ?? systemClock;
  const newId = options.idGenerator ?? defaultId;
  let state: State = emptyState();
  const aliasStates = new Map<string, State>();
  if (options.meetingId !== undefined) {
    for (const e of store.all()) if (e.meetingId === options.meetingId) reduce(state, e);
  } else {
    for (const e of store.all()) {
      if (!e.meetingId) continue;
      let scoped = aliasStates.get(e.meetingId);
      if (!scoped) {
        scoped = emptyState();
        aliasStates.set(e.meetingId, scoped);
      }
      reduce(scoped, e);
    }
  }
  if (options.personSnapshots !== undefined) {
    if (options.meetingId !== undefined) {
      state.persons = new Map((options.personSnapshots.get(options.meetingId) ?? []).map((person) => [person.personId, person]));
    } else {
      for (const [meetingId, scoped] of aliasStates) {
        scoped.persons = new Map((options.personSnapshots.get(meetingId) ?? []).map((person) => [person.personId, person]));
      }
    }
  }
  let activeIdempotencyKey: string | undefined;
  let activeCommand: { id: string; operation: string; resource: string } | undefined;
  let lastWriteVersion: number | undefined;

  const stateForMeeting = (meetingId: string): State => {
    const projected = emptyState();
    for (const e of store.all()) if (e.meetingId === meetingId) reduce(projected, e);
    if (!projected.meeting) throw new ApiProblem(404, 'Not found', `Meeting ${meetingId} does not exist.`);
    return projected;
  };
  const refreshAliasState = (): void => {
    const meetings = [...aliasStates.values()].filter((candidate) => candidate.meeting !== null);
    // Contract 0.3.3: latest running date wins; otherwise latest date. Equal dates keep the
    // later MeetingCreated, which is later in the append-only global log.
    const candidates = meetings.some((candidate) => candidate.meeting?.status === 'running')
      ? meetings.filter((candidate) => candidate.meeting?.status === 'running') : meetings;
    state = candidates.reduce<State | undefined>((latest, candidate) =>
      !latest || candidate.meeting!.date >= latest.meeting!.date ? candidate : latest, undefined) ?? emptyState();
    state.lastSeq = store.lastSeq();
  };
  if (options.meetingId === undefined) refreshAliasState();
  store.subscribe((events) => {
    if (options.meetingId === undefined) {
      for (const e of events) {
        if (!e.meetingId) continue;
        let scoped = aliasStates.get(e.meetingId);
        if (!scoped) {
          scoped = emptyState();
          aliasStates.set(e.meetingId, scoped);
        }
        reduce(scoped, e);
      }
      refreshAliasState();
    } else {
      for (const e of events) if (e.seq > state.lastSeq && e.meetingId === options.meetingId) reduce(state, e);
    }
  });
  const viewMeeting = (meeting: Meeting): Meeting => ({
    ...meeting,
    counts: { ...meeting.counts, byStatus: { ...meeting.counts.byStatus } },
  });

  const now = (): string => clock().toISOString();
  const actor = (): Actor => {
    const current = options.actor();
    const history = [...state.roleAssignments.values()].filter((assignment) => assignment.subjectId === current.id);
    if (history.length === 0 && current.assignmentScoped !== true) return current; // synthetic demo identity
    // The projection retains event order; a session uses the oldest active grant in this meeting.
    const assignment = history.find((item) => (current.assignmentScoped === true || item.role === current.role) && !item.revokedAt &&
      (item.expiresAt === undefined || Date.parse(item.expiresAt) > clock().getTime()) && state.meeting?.status !== 'closed');
    if (!assignment) throw new ApiProblem(403, 'Forbidden', 'Role assignment is no longer active.', 'R-PERM-01');
    return { id: current.id, role: assignment.role, assignmentScoped: true,
      ...(assignment.personId !== undefined ? { personId: assignment.personId } : {}),
      ...(assignment.unitId !== undefined ? { unitId: assignment.unitId } : {}) };
  };

  const viewRoleAssignment = (assignment: RoleAssignment): RoleAssignment => ({ ...assignment,
    assignedBy: { id: assignment.assignedBy.id, role: assignment.assignedBy.role },
    ...(assignment.revokedBy !== undefined ? { revokedBy: { id: assignment.revokedBy.id, role: assignment.revokedBy.role } } : {}),
  });
  const viewActor = (source: Actor): Actor => ({ id: source.id, role: source.role });
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
  const maskEvent = (event: DomainEvent): ReadEvent => {
    if (!event.hash) throw new Error(`Event seq ${event.seq}: integrity check failed (source hash missing).`);
    const { personId: _personId, hash: sourceHash, prevHash: _prevHash,
      commandId: _commandId, commandOperation: _commandOperation, commandResource: _commandResource,
      ...visible } = event;
    const { displayName: _actorName, personId: _actorPerson, ...eventActor } = event.actor;
    const payload = maskValue(event.payload) as Record<string, unknown>;
    if (event.type === 'IdempotencyRecorded') delete visible.idempotencyKey;
    return { ...visible, actor: eventActor, payload, redacted: true, sourceHash } as ReadEvent;
  };

  const viewSpeaker = (s: SpeakerRecord, source: State = state): Speaker => ({
    ...s,
    ...(can(actor(), 'question.identity.reveal').allow && s.personId !== undefined && source.persons.has(s.personId)
      ? { displayName: source.persons.get(s.personId)!.displayName,
          ...(source.persons.get(s.personId)!.organisation !== undefined ? { organisation: source.persons.get(s.personId)!.organisation } : {}) }
      : { displayName: `Redner ${s.number}` }),
    _actions: SPEAKER_ACTIONS.filter((p) => can(actor(), p).allow),
  });
  // takt-027 (privacy): presence needs only actorId; the claimant's personId stays in the event log and
  // never reaches a read view (event reads mask it too, slice 026).
  const viewClaim = (claim: { actorId: string; personId?: string; claimedAt: string; expiresAt: string } | undefined) =>
    claim !== undefined && Date.parse(claim.expiresAt) > clock().getTime()
      ? { claim: { actorId: claim.actorId, claimedAt: claim.claimedAt, expiresAt: claim.expiresAt } }
      : {};
  const viewQuestion = (q: QuestionRecord, source: State = state): Question => {
    const { claim, ...record } = q;
    return {
    ...record,
    ...viewClaim(claim),
    ...(source.speakers.has(q.speakerId) ? { speakerDisplayName: viewSpeaker(source.speakers.get(q.speakerId)!, source).displayName } : {}),
    answers: q.answers.map((a) => ({ ...a, createdBy: viewActor(a.createdBy) })),
    ...(q.approval !== undefined ? { approval: { ...q.approval, approvedBy: viewActor(q.approval.approvedBy) } } : {}),
    ...(q.legalClearance !== undefined ? { legalClearance: { ...q.legalClearance, clearedBy: viewActor(q.legalClearance.clearedBy) } } : {}),
    _actions: actionsFor(actor(), q),
  };
  };
  const viewContribution = (c: Contribution): Contribution => {
    const { claim, ...rest } = c;
    return { ...rest,
      ...viewClaim(claim),
      questionIds: [...c.questionIds], coverage: { ...c.coverage, uncovered: [...c.coverage.uncovered] },
    };
  };

  const requireQuestion = (id: string): QuestionRecord => {
    const q = state.questions.get(id);
    if (!q) throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
    return q;
  };
  const requireSpeaker = (id: string): SpeakerRecord => {
    const s = state.speakers.get(id);
    if (!s) throw new ApiProblem(404, 'Not found', `Speaker ${id} does not exist.`);
    return s;
  };
  const requireContribution = (id: string): Contribution => {
    const c = state.contributions.get(id);
    if (!c) throw new ApiProblem(404, 'Not found', `Contribution ${id} does not exist.`);
    return c;
  };
  // Every decision in this file goes through `can()` (AGENTS.md rule 4, Codex on PR #21), even where
  // no question is involved and `can()` is the bare permission check today — a scope or context rule
  // added to `can()` later then reaches every decision point without a second edit.
  const requirePermission = (p: Permission): void => {
    const d = can(actor(), p);
    if (!d.allow) throw new ApiProblem(403, 'Forbidden', d.reason, d.ruleId);
  };
  /** A method that accepts more than one permission (`READ_PERMISSIONS`, types.ts): allow if the
   * actor holds any of them, else 403 with the first denial's reason/rule id (every permission in
   * `perms` is a read permission, so that is always R-PERM-02). */
  const requireAnyPermission = (perms: readonly Permission[]): void => {
    const denials = perms.map((p) => can(actor(), p)).filter((d): d is Extract<Decision, { allow: false }> => !d.allow);
    if (denials.length < perms.length) return; // at least one permission was granted
    const first = denials[0]!;
    throw new ApiProblem(403, 'Forbidden', first.reason, first.ruleId);
  };
  /** Every read method takes its permission(s) from `READ_PERMISSIONS` (types.ts, Festlegung 6) —
   * never a permission name hard-coded at the call site (rework round, point 4), so the
   * method-to-permission mapping stays single-sourced data. */
  const requireReadPermission = (method: ReadMethod): void => requireAnyPermission(READ_PERMISSIONS[method]);
  /**
   * 404 precedence for a single question (Festlegung 3, "keine ableitbare ID"): applies only when the
   * actor can neither read this question (`can(actor, 'question.read', q)`) nor holds the permission
   * the operation itself needs — then every operation on the question, including a write, reports 404
   * so a role without any read access learns nothing about which ids exist. An actor holding the
   * operation's permission keeps today's order (404 for an unknown id, then whatever check follows) —
   * podium holds `question.deliver`/`question.close`/`question.return` but no `question.read`, and
   * must keep working the stage.
   */
  const requireQuestionFor = (id: string, operationPermission: Permission): QuestionRecord => {
    const q = state.questions.get(id);
    if (can(actor(), operationPermission).allow) {
      if (!q) throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
      return q;
    }
    if (!q || !can(actor(), 'question.read', q).allow) {
      throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
    }
    return q;
  };
  const checkIfMatch = (version: number, opts?: WriteOptions, required = false): void => {
    if (opts?.ifMatch === undefined && required) {
      throw new ApiProblem(428, 'Precondition required', 'If-Match is required for this write.');
    }
    if (required && opts?.ifMatch !== undefined && !/^"v[1-9][0-9]*"$/.test(opts.ifMatch)) {
      throw new ApiProblem(422, 'Unprocessable', 'If-Match must contain one version tag.');
    }
    if (opts?.ifMatch !== undefined && opts.ifMatch !== etagOf(version)) {
      throw new ApiProblem(
        412,
        'Precondition failed',
        `Resource changed: expected ${opts.ifMatch}, current ${etagOf(version)}.`,
      );
    }
  };
  const operationPermission: Partial<Record<string, Permission>> = {
    registerSpeaker: 'speaker.register', reorderSpeakers: 'speaker.reorder', updateSpeaker: 'speaker.update',
    captureMeetingContribution: 'contribution.capture', captureQuestions: 'question.capture',
    claimContribution: 'contribution.claim', releaseContribution: 'contribution.claim',
    claimQuestion: 'question.claim', releaseQuestion: 'question.claim',
    assignRole: 'admin.roles.manage', revokeRole: 'admin.roles.manage',
    AgendaItemOpened: 'agenda.manage', VotingOpened: 'agenda.manage', VotingClosed: 'agenda.manage',
  };
  const legacyEventType: Partial<Record<string, DomainEvent['type']>> = {
    registerSpeaker: 'SpeakerRegistered', reorderSpeakers: 'SpeakersReordered', updateSpeaker: 'SpeakerUpdated',
    captureMeetingContribution: 'ContributionCaptured', captureQuestions: 'QuestionCaptured',
    assignRole: 'RoleAssigned', revokeRole: 'RoleRevoked',
    AgendaItemOpened: 'AgendaItemOpened', VotingOpened: 'VotingOpened', VotingClosed: 'VotingClosed',
    'question.classify': 'QuestionClassified', 'question.assign': 'QuestionAssigned',
    'answer.draft': 'AnswerDrafted', 'question.submit_review': 'QuestionSubmittedForReview',
    'question.approve': 'QuestionApproved', 'question.legal.clear': 'QuestionLegalCleared',
    'question.return': 'QuestionReturned', 'question.stage': 'QuestionStaged',
    'question.deliver': 'QuestionDelivered', 'question.close': 'QuestionClosed',
    'question.withdraw': 'QuestionWithdrawn', 'question.merge': 'QuestionMerged',
  };
  const authorizeReplay = (operation: string, resource: string): void => {
    // Current grants, meeting lifecycle and scoped reads govern every historical replay.
    actor();
    if (state.meeting?.status === 'closed') throw new ApiProblem(403, 'Forbidden', 'Meeting is closed.', 'R-PERM-01');
    const permission = operationPermission[operation] ?? (PERMISSIONS.includes(operation as Permission) ? operation as Permission : undefined);
    if (!permission) throw new ApiProblem(409, 'Conflict', 'Historical command scope is unsupported.', 'R-IDEM-01');
    if (operation.startsWith('question.') || operation === 'answer.draft' || operation === 'claimQuestion' || operation === 'releaseQuestion') {
      const q = requireQuestionFor(resource, permission);
      if (actor().assignmentScoped && hasUnitBoundRead(actor()) && !can(actor(), 'question.read', q).allow) {
        throw new ApiProblem(404, 'Not found', `Question ${resource} does not exist.`);
      }
    } else requirePermission(permission);
    if (operation === 'updateSpeaker') requireSpeaker(resource);
    else if (operation === 'captureQuestions' || operation === 'claimContribution' || operation === 'releaseContribution') requireContribution(resource);
    else if (operation === 'captureMeetingContribution') requireSpeaker(resource.split(':').at(-1)!);
    if (operation.startsWith('question.') || operation === 'answer.draft' || operation === 'claimQuestion' || operation === 'releaseQuestion') requirePermission(permission);
  };
  const legacyMatch = (event: DomainEvent, operation: string, resource: string): boolean => {
    if (event.commandId !== undefined || event.type !== legacyEventType[operation]) return false;
    if (operation === 'captureMeetingContribution') return event.type === 'ContributionCaptured' && event.payload.speakerId === resource.split(':').at(-1);
    if (operation === 'captureQuestions') return event.type === 'QuestionCaptured' && event.payload.contributionId === resource;
    if (operation === 'reorderSpeakers') return event.type === 'SpeakersReordered' && String(event.payload.round) === resource;
    if (operation === 'registerSpeaker' || operation === 'assignRole') return true;
    if (operation === 'AgendaItemOpened' || operation === 'VotingOpened' || operation === 'VotingClosed') {
      return 'agendaItemId' in event.payload && event.payload.agendaItemId === resource.split(':').at(-1);
    }
    return event.subjectId === resource;
  };
  const replayValue = (operation: string, resource: string, events: DomainEvent[], meetingId: string): unknown => {
    const last = events.at(-1)!;
    const historical = emptyState();
    for (const event of store.all()) if (event.meetingId === meetingId && event.seq <= last.seq) reduce(historical, event);
    // Clear identity is supplied by the current person projection; it is never taken from stale read results.
    historical.persons = state.persons;
    if (operation === 'registerSpeaker' || operation === 'updateSpeaker') {
      lastWriteVersion = historical.meeting?.speakerListVersion;
      const speaker = historical.speakers.get(operation === 'registerSpeaker' ? events[0]!.subjectId : resource);
      if (!speaker) throw new ApiProblem(409, 'Conflict', 'Historical speaker result is missing.', 'R-IDEM-01');
      if (operation === 'updateSpeaker') lastWriteVersion = speaker.version;
      return viewSpeaker(speaker, historical);
    }
    if (operation === 'reorderSpeakers') {
      lastWriteVersion = historical.meeting?.speakerListVersion;
      return [...historical.speakers.values()].filter((speaker) => speaker.round === Number(resource))
        .sort((a, b) => a.position - b.position).map((speaker) => viewSpeaker(speaker, historical));
    }
    if (operation === 'captureMeetingContribution' || operation === 'claimContribution' || operation === 'releaseContribution') {
      const contribution = historical.contributions.get(operation === 'captureMeetingContribution' ? events[0]!.subjectId : resource);
      if (!contribution) throw new ApiProblem(409, 'Conflict', 'Historical contribution result is missing.', 'R-IDEM-01');
      lastWriteVersion = contribution.version;
      return viewContribution(contribution);
    }
    if (operation === 'captureQuestions') {
      lastWriteVersion = historical.contributions.get(resource)?.version;
      return events.filter((event) => event.type === 'QuestionCaptured').map((event) => {
        const question = historical.questions.get(event.subjectId);
        if (!question) throw new ApiProblem(409, 'Conflict', 'Historical question result is missing.', 'R-IDEM-01');
        return { ...viewQuestion(question, historical), _actions: actionsFor(actor(), state.questions.get(event.subjectId) ?? question) };
      });
    }
    if (operation.startsWith('question.') || operation === 'answer.draft' || operation === 'claimQuestion' || operation === 'releaseQuestion') {
      const question = historical.questions.get(resource);
      if (!question) throw new ApiProblem(409, 'Conflict', 'Historical question result is missing.', 'R-IDEM-01');
      lastWriteVersion = question.version;
      return { ...viewQuestion(question, historical), _actions: actionsFor(actor(), state.questions.get(resource) ?? question) };
    }
    if (operation === 'assignRole' || operation === 'revokeRole') {
      const assignment = historical.roleAssignments.get(operation === 'assignRole' ? events[0]!.subjectId : resource);
      if (!assignment) throw new ApiProblem(409, 'Conflict', 'Historical assignment result is missing.', 'R-IDEM-01');
      return viewRoleAssignment(assignment);
    }
    if (operation === 'AgendaItemOpened' || operation === 'VotingOpened' || operation === 'VotingClosed') {
      lastWriteVersion = historical.meeting?.version;
      const item = historical.agendaItems.find((candidate) => candidate.id === resource.split(':').at(-1));
      if (!item) throw new ApiProblem(409, 'Conflict', 'Historical agenda result is missing.', 'R-IDEM-01');
      return { ...item };
    }
    throw new ApiProblem(409, 'Conflict', 'Historical command result is unsupported.', 'R-IDEM-01');
  };
  const idempotent = <T>(scope: string, opts: WriteOptions | undefined, run: () => T): T => {
    const key = opts?.idempotencyKey;
    if (key !== undefined && (key.length === 0 || key.length > 128)) {
      throw new ApiProblem(422, 'Unprocessable', 'Idempotency-Key must contain 1 to 128 characters.');
    }
    const split = scope.indexOf(':');
    const operation = split < 0 ? scope : scope.slice(0, split);
    const resource = split < 0 ? '' : scope.slice(split + 1);
    const meetingId = options.meetingId ?? state.meeting?.id ?? 'none';
    const currentActor = actor();
    if (key !== undefined) {
      const candidates = store.all().filter((event) => event.meetingId === meetingId && event.actor.id === currentActor.id &&
        event.idempotencyKey === key && ((event.commandOperation === operation && event.commandResource === resource) ||
        (event.commandId === undefined && legacyMatch(event, operation, resource))));
      if (candidates.length > 0) {
        authorizeReplay(operation, resource);
        const ids = new Set(candidates.map((event) => event.commandId ?? 'legacy'));
        if (ids.size > 1 || (ids.has('legacy') && candidates.some((event, i) => i > 0 && event.seq !== candidates[i - 1]!.seq + 1))) {
          throw new ApiProblem(409, 'Conflict', 'Historical idempotency command is ambiguous.', 'R-IDEM-01');
        }
        return replayValue(operation, resource, candidates, meetingId) as T;
      }
    }
    const before = store.lastSeq();
    const previousKey = activeIdempotencyKey;
    const previousCommand = activeCommand;
    activeIdempotencyKey = key;
    activeCommand = { id: defaultId(), operation, resource };
    let result: T;
    try {
      result = run();
      if (key !== undefined && store.lastSeq() === before) {
        append([{ type: 'IdempotencyRecorded', subjectId: resource || meetingId, payload: {} }]);
      }
    } finally {
      activeIdempotencyKey = previousKey;
      activeCommand = previousCommand;
    }
    if (operation === 'registerSpeaker' || operation === 'reorderSpeakers') lastWriteVersion = state.meeting?.speakerListVersion;
    else if (operation === 'captureQuestions') lastWriteVersion = state.contributions.get(resource)?.version;
    else if (typeof result === 'object' && result !== null && 'version' in result && typeof result.version === 'number') lastWriteVersion = result.version;
    else lastWriteVersion = undefined;
    return result;
  };
  const append = (events: Omit<NewEvent, 'id' | 'at' | 'actor'>[]): DomainEvent[] => {
    const a = actor();
    const at = now();
    for (const event of events) {
      if (event.type === 'MeetingCreated') continue;
      if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
      if (event.meetingId !== undefined && event.meetingId !== state.meeting.id) {
        throw new ApiProblem(404, 'Not found', `Meeting ${event.meetingId} does not exist here.`);
      }
    }
    return store.append(events.map((e) => ({ ...e, id: newId(), at, actor: a,
      ...(e.type !== 'MeetingCreated' ? { meetingId: state.meeting!.id } : { meetingId: e.subjectId }),
      ...(activeIdempotencyKey !== undefined ? { idempotencyKey: activeIdempotencyKey } : {}),
      ...(e.type === 'IdempotencyRecorded' ? { retentionClass: 'technical' as const } : {}),
      ...(activeCommand !== undefined ? { commandId: activeCommand.id,
        commandOperation: activeCommand.operation, commandResource: activeCommand.resource } : {}),
    }) as NewEvent));
  };

  const agendaProgress = (event: 'AgendaItemOpened' | 'VotingOpened' | 'VotingClosed', agendaItemId: string, opts?: WriteOptions): AgendaItem =>
    idempotent(`${event}:${state.meeting?.id ?? 'none'}:${agendaItemId}`, opts, () => {
      requirePermission('agenda.manage');
      const meeting = state.meeting;
      if (!meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
      const item = state.agendaItems.find((candidate) => candidate.id === agendaItemId);
      if (!item) throw new ApiProblem(404, 'Not found', `Agenda item ${agendaItemId} does not exist.`);
      const decision = resolveAgendaProgress(meeting, item, event);
      if (!decision.ok) throw new ApiProblem(409, 'Conflict', decision.reason, decision.ruleId);
      checkIfMatch(meeting.version ?? 1, opts);
      append([{ type: event, subjectId: meeting.id, payload: { agendaItemId, number: item.number } }]);
      return { ...state.agendaItems.find((candidate) => candidate.id === agendaItemId)! };
    });

  const captureInMeeting = (input: MeetingContributionCapture, opts?: WriteOptions): Contribution =>
    idempotent(`captureMeetingContribution:${state.meeting?.id ?? 'none'}:${input.speakerId}`, opts, () => {
      requirePermission('contribution.capture');
      const meeting = state.meeting;
      if (!meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
      const speaker = requireSpeaker(input.speakerId);
      if (!input.text?.trim()) throw new ApiProblem(422, 'Unprocessable', 'text is required.');
      checkIfMatch(speaker.version, opts, true);
      const at = now();
      const decision = resolveMeetingCapture(meeting, input, at);
      if (!decision.ok) throw new ApiProblem(decision.status, decision.status === 422 ? 'Unprocessable' : 'Conflict', decision.reason, decision.ruleId);
      const id = newId();
      append([{ type: 'ContributionCaptured', subjectId: id,
        ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt, occurredAtSource: input.occurredAtSource } : {}),
        payload: { speakerId: input.speakerId, text: input.text, source: input.source ?? 'manual',
          ...(decision.lateEntry ? { lateEntry: true, lateEntryReason: input.lateEntryReason!.trim() } : {}) },
      }]);
      const contribution = state.contributions.get(id)!;
      return viewContribution(contribution);
    });

  /**
   * Generic question transition: permission + transition table + guards, If-Match, one event.
   * Every question-changing endpoint of the contract is one call of this function.
   */
  const transition = (
    id: string,
    action: Permission,
    opts: WriteOptions | undefined,
    payload: unknown,
    build: (q: QuestionRecord, to: QuestionRecord['status']) => Omit<NewEvent, 'id' | 'at' | 'actor'>,
  ): Question =>
    idempotent(`${action}:${id}`, opts, () => {
      const q = requireQuestionFor(id, action);
      if (actor().assignmentScoped && hasUnitBoundRead(actor()) && !can(actor(), 'question.read', q).allow) {
        throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
      }
      const perm = can(actor(), action);
      if (!perm.allow) throw new ApiProblem(403, 'Forbidden', perm.reason, perm.ruleId);
      checkIfMatch(q.version, opts, action !== 'question.deliver');
      const t = resolveTransition(q, action, payload, { actor: actor() });
      if (!t.ok) {
        // Festlegung 8: a 409 to an actor who may not read the question names no status and no rule
        // id — the message is the generic "Transition not allowed" (Übergang nicht zulässig). Only an
        // actor who can read the question (including its scope) gets the real reason/rule id. This is
        // the case Festlegung 3 leaves open on purpose: podium holds `question.deliver` etc. and keeps
        // working the stage (no 404 here), but must not learn the question's actual status from a
        // rejected transition it cannot otherwise see.
        throw can(actor(), 'question.read', q).allow
          ? new ApiProblem(409, 'Conflict', t.reason, t.ruleId)
          : new ApiProblem(409, 'Conflict', 'Transition not allowed.');
      }
      append([build(q, t.to)]);
      return viewQuestion(requireQuestion(id));
    });

  const questionMatches = (q: QuestionRecord, f: QuestionFilter): boolean => {
    if (f.status && f.status.length > 0 && !f.status.includes(q.status)) return false;
    if (f.track && q.track !== f.track) return false;
    if (f.unitId && q.unitId !== f.unitId) return false;
    if (f.speakerId && q.speakerId !== f.speakerId) return false;
    if (f.contributionId && q.contributionId !== f.contributionId) return false;
    if (f.agendaItemId && q.agendaItemId !== f.agendaItemId) return false;
    if (f.q) {
      const needle = f.q.toLowerCase();
      const speaker = state.speakers.get(q.speakerId);
      const name = speaker && can(actor(), 'question.identity.reveal').allow && speaker.personId
        ? state.persons.get(speaker.personId)?.displayName ?? '' : '';
      const hay = [q.number, q.text, q.speakerDisplayName ?? '', name, ...q.answers.map((a) => a.text)]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };

  return {
    async listRoleAssignments(filter = {}) {
      requirePermission('admin.roles.manage');
      if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
      return [...state.roleAssignments.values()].filter((item) =>
        (filter.subjectId === undefined || item.subjectId === filter.subjectId) &&
        (filter.role === undefined || item.role === filter.role)).map(viewRoleAssignment);
    },
    async assignRole(input, opts) {
      return idempotent(`assignRole:${state.meeting?.id ?? 'none'}`, opts, () => {
        requirePermission('admin.roles.manage');
        if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
        if (!input.subjectId?.trim() || input.subjectId.includes('@') || /\s/.test(input.subjectId))
          throw new ApiProblem(422, 'Unprocessable', 'A pseudonymous subjectId is required.');
        if (input.deputyForSubjectId !== undefined && (!input.deputyForSubjectId.trim() || input.deputyForSubjectId.length > 128 ||
            input.deputyForSubjectId.includes('@') || /\s/.test(input.deputyForSubjectId)))
          throw new ApiProblem(422, 'Unprocessable', 'A pseudonymous deputyForSubjectId is required.');
        if (!input.role || !Object.hasOwn(ROLE_PERMISSIONS, input.role))
          throw new ApiProblem(422, 'Unprocessable', 'A valid role is required.');
        if (input.unitId !== undefined && !state.units.some((unit) => unit.id === input.unitId))
          throw new ApiProblem(404, 'Not found', 'Unit does not exist here.');
        if (input.personId !== undefined && !state.persons.has(input.personId))
          throw new ApiProblem(404, 'Not found', 'Person does not exist in this meeting.');
        if (input.expiresAt !== undefined && (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= clock().getTime()))
          throw new ApiProblem(422, 'Unprocessable', 'expiresAt must be in the future.');
        const duplicate = [...state.roleAssignments.values()].some((item) => item.subjectId === input.subjectId &&
          item.role === input.role && !item.revokedAt && (item.expiresAt === undefined || Date.parse(item.expiresAt) > clock().getTime()));
        if (duplicate) throw new ApiProblem(409, 'Conflict', 'An active assignment already exists.');
        const id = newId();
        append([{ type: 'RoleAssigned', subjectId: id,
          ...(input.personId !== undefined ? { personId: input.personId } : {}),
          payload: { assignmentId: id, subjectId: input.subjectId, role: input.role,
            ...(input.unitId !== undefined ? { unitId: input.unitId } : {}),
            ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
            ...(input.deputyForSubjectId !== undefined ? { deputyForSubjectId: input.deputyForSubjectId } : {}),
          } }]);
        return viewRoleAssignment(state.roleAssignments.get(id)!);
      });
    },
    async revokeRole(id, reason, opts) {
      return idempotent(`revokeRole:${id}`, opts, () => {
        requirePermission('admin.roles.manage');
        const assignment = state.roleAssignments.get(id);
        if (!assignment) throw new ApiProblem(404, 'Not found', 'Role assignment does not exist here.');
        if (assignment.revokedAt) throw new ApiProblem(409, 'Conflict', 'Role assignment already revoked.');
        if (reason !== undefined && !reason.trim()) throw new ApiProblem(422, 'Unprocessable', 'reason must not be empty.');
        if (reason !== undefined && reason.trim().length > 500) throw new ApiProblem(422, 'Unprocessable', 'reason must not exceed 500 characters.');
        append([{ type: 'RoleRevoked', subjectId: id, payload: {
          assignmentId: id, subjectId: assignment.subjectId, role: assignment.role,
          ...(reason !== undefined ? { reason: reason.trim() } : {}),
        } }]);
        return viewRoleAssignment(state.roleAssignments.get(id)!);
      });
    },
    async getMeeting() {
      if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
      return viewMeeting(state.meeting);
    },
    async listMeetings(status) {
      const ids = [...new Set(store.all().filter((e) => e.type === 'MeetingCreated').map((e) => e.subjectId))];
      return ids.map((id) => viewMeeting(stateForMeeting(id).meeting!))
        .filter((meeting) => status === undefined || meeting.status === status)
        .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    },
    async getMeetingById(meetingId) {
      return viewMeeting(stateForMeeting(meetingId).meeting!);
    },
    async listMeetingAgendaItems(meetingId) {
      return stateForMeeting(meetingId).agendaItems.map((item) => ({ ...item }));
    },
    async listMeetingUnits(meetingId) {
      return stateForMeeting(meetingId).units.map((unit) => ({ ...unit }));
    },
    async openAgendaItem(agendaItemId, opts) { return agendaProgress('AgendaItemOpened', agendaItemId, opts); },
    async openVoting(agendaItemId, opts) { return agendaProgress('VotingOpened', agendaItemId, opts); },
    async closeVoting(agendaItemId, opts) { return agendaProgress('VotingClosed', agendaItemId, opts); },
    async listAgendaItems() {
      return state.agendaItems.map((a) => ({ ...a }));
    },
    async listUnits() {
      return state.units.map((u) => ({ ...u }));
    },

    async listSpeakers(filter = {}) {
      requireReadPermission('listSpeakers');
      return [...state.speakers.values()]
        .filter((s) => (filter.round === undefined || s.round === filter.round) && (filter.status === undefined || s.status === filter.status))
        .sort((a, b) => a.round - b.round || a.position - b.position)
        .map((speaker) => viewSpeaker(speaker));
    },
    async getSpeaker(id) {
      requireReadPermission('getSpeaker');
      return viewSpeaker(requireSpeaker(id));
    },
    async registerSpeaker(input, opts) {
      return idempotent('registerSpeaker', opts, () => {
        requirePermission('speaker.register');
        if (!input.displayName?.trim()) throw new ApiProblem(422, 'Unprocessable', 'displayName is required.');
        if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
        checkIfMatch(state.meeting.speakerListVersion, opts, true);
        const round = input.round ?? state.meeting?.currentRound ?? 1;
        const inRound = [...state.speakers.values()].filter((s) => s.round === round);
        const id = newId();
        append([
          {
            type: 'SpeakerRegistered',
            subjectId: id,
            personId: newId(),
            payload: {
              number: state.speakers.size + 1,
              pii: { keyId: state.meeting?.id ?? '', displayName: input.displayName.trim(),
                ...(input.organisation !== undefined ? { organisation: input.organisation } : {}) },
              round,
              position: inRound.length + 1,
            },
          },
        ]);
        return viewSpeaker(requireSpeaker(id));
      });
    },
    async reorderSpeakers(round, speakerIds, opts) {
      return idempotent(`reorderSpeakers:${round}`, opts, () => {
        requirePermission('speaker.reorder');
        for (const id of speakerIds) requireSpeaker(id);
        if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
        checkIfMatch(state.meeting.speakerListVersion, opts, true);
        append([{ type: 'SpeakersReordered', subjectId: state.meeting?.id ?? 'meeting', payload: { round, speakerIds } }]);
        return [...state.speakers.values()]
          .filter((s) => s.round === round)
          .sort((a, b) => a.position - b.position)
          .map((speaker) => viewSpeaker(speaker));
      });
    },
    async updateSpeaker(id, input, opts) {
      return idempotent(`updateSpeaker:${id}`, opts, () => {
        requirePermission('speaker.update');
        const s = requireSpeaker(id);
        // If-Match is checked before we know whether the PATCH has any effect: a stale precondition
        // fails the same way (412) whatever the body says, so a parallel client racing a real change
        // still sees the conflict instead of a silent no-op 200 (takt-015 Ziel 1/AK1).
        checkIfMatch(s.version, opts, true);
        // The reason is kept only when the resolved row has a guard that reads it (today R-SPK-05 with
        // R-SPK-GUARD-01); on any other row it is dropped, so no unchecked text reaches the log (review R1).
        let keepReason = false;
        if (input.status !== undefined) {
          const t = resolveSpeakerTransition(s, input.status, input);
          if (!t.ok) throw new ApiProblem(409, 'Conflict', t.reason, t.ruleId);
          keepReason = (t.transition.guards?.length ?? 0) > 0;
        }
        // Built field by field: fields the contract still accepts but the core ignores since 080
        // (Redezeit) never reach an event; the reason only travels with a status change.
        const payload = {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.round !== undefined ? { round: input.round } : {}),
          ...(keepReason && input.reason !== undefined ? { reason: input.reason } : {}),
        };
        // takt-015 Ziel 1: nothing named survives the cut (empty body, or only fields the domain
        // type no longer has, e.g. the deprecated requestedMinutes) — write no event. Regel 7 keeps
        // the log append-only; that is a reason to never write one for no change, not a licence for
        // one, and a version bump with nothing to show for it would confuse an optimistic-lock client.
        if (Object.keys(payload).length > 0) {
          append([{ type: 'SpeakerUpdated', subjectId: id, payload }]);
        }
        return viewSpeaker(requireSpeaker(id));
      });
    },

    async listContributions(filter = {}) {
      requireReadPermission('listContributions');
      if (options.meetingId !== undefined && filter.speakerId !== undefined) requireSpeaker(filter.speakerId);
      return [...state.contributions.values()]
        .filter((c) => filter.speakerId === undefined || c.speakerId === filter.speakerId)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
        .map((c) => viewContribution(c));
    },
    async getContribution(id) {
      requireReadPermission('getContribution');
      const c = requireContribution(id);
      return viewContribution(c);
    },
    async captureContribution(input, opts) {
      return captureInMeeting(input, opts);
    },
    async captureMeetingContribution(input, opts) {
      return captureInMeeting(input, opts);
    },
    async captureQuestions(contributionId, questions, opts) {
      return idempotent(`captureQuestions:${contributionId}`, opts, () => {
        requirePermission('question.capture');
        const c = requireContribution(contributionId);
        if (questions.length === 0) throw new ApiProblem(422, 'Unprocessable', 'At least one question is required.');
        for (const q of questions) {
          if (!q.text?.trim()) throw new ApiProblem(422, 'Unprocessable', 'Question text is required.');
          if (q.span && (q.span.start < 0 || q.span.end > c.text.length || q.span.end < q.span.start)) {
            throw new ApiProblem(422, 'Unprocessable', 'Span is outside the contribution text.');
          }
        }
        checkIfMatch(c.version, opts, true);
        const ids: string[] = [];
        const base = state.questions.size;
        append(
          questions.map((q, i) => {
            const id = newId();
            ids.push(id);
            return {
              type: 'QuestionCaptured' as const,
              subjectId: id,
              payload: {
                number: `F-${String(base + i + 1).padStart(4, '0')}`,
                contributionId,
                speakerId: c.speakerId,
                text: q.text.trim(),
                ...(q.span !== undefined ? { span: q.span } : {}),
              },
            };
          }),
        );
        return ids.map((id) => viewQuestion(requireQuestion(id)));
      });
    },
    async claimContribution(id, opts) {
      return idempotent(`claimContribution:${id}`, opts, () => {
        requirePermission('contribution.claim');
        const contribution = requireContribution(id);
        checkIfMatch(contribution.version, opts, true);
        const active = viewContribution(contribution).claim;
        if (active && active.actorId !== actor().id) {
          throw new ApiProblem(409, 'Conflict', 'Contribution is claimed by another actor.', 'R-CLAIM-01');
        }
        const claimedAt = now();
        append([{ type: 'ContributionClaimed', subjectId: id, payload: {
          actorId: actor().id, ...(actor().personId !== undefined ? { personId: actor().personId } : {}),
          claimedAt, expiresAt: new Date(Date.parse(claimedAt) + 600_000).toISOString(),
        } }]);
        return viewContribution(requireContribution(id));
      });
    },
    async releaseContribution(id, opts) {
      return idempotent(`releaseContribution:${id}`, opts, () => {
        requirePermission('contribution.claim');
        const contribution = requireContribution(id);
        checkIfMatch(contribution.version, opts, true);
        if (viewContribution(contribution).claim?.actorId !== actor().id) {
          throw new ApiProblem(409, 'Conflict', 'Only the current claim holder may release.', 'R-CLAIM-02');
        }
        append([{ type: 'ContributionReleased', subjectId: id, payload: {} }]);
        return viewContribution(requireContribution(id));
      });
    },
    async claimQuestion(id, opts) {
      return idempotent(`claimQuestion:${id}`, opts, () => {
        const question = requireQuestionFor(id, 'question.claim');
        if (actor().assignmentScoped && hasUnitBoundRead(actor()) && !can(actor(), 'question.read', question).allow) {
          throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
        }
        requirePermission('question.claim');
        checkIfMatch(question.version, opts, true);
        const active = question.claim && Date.parse(question.claim.expiresAt) > clock().getTime() ? question.claim : undefined;
        if (active && active.actorId !== actor().id) {
          throw new ApiProblem(409, 'Conflict', 'Question is claimed by another actor.', 'R-CLAIM-01');
        }
        const claimedAt = now();
        append([{ type: 'QuestionClaimed', subjectId: id, payload: {
          actorId: actor().id, ...(actor().personId !== undefined ? { personId: actor().personId } : {}),
          claimedAt, expiresAt: new Date(Date.parse(claimedAt) + 600_000).toISOString(),
        } }]);
        return viewQuestion(requireQuestion(id));
      });
    },
    async releaseQuestion(id, opts) {
      return idempotent(`releaseQuestion:${id}`, opts, () => {
        const question = requireQuestionFor(id, 'question.claim');
        if (actor().assignmentScoped && hasUnitBoundRead(actor()) && !can(actor(), 'question.read', question).allow) {
          throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
        }
        requirePermission('question.claim');
        checkIfMatch(question.version, opts, true);
        const active = question.claim && Date.parse(question.claim.expiresAt) > clock().getTime() ? question.claim : undefined;
        if (active?.actorId !== actor().id) {
          throw new ApiProblem(409, 'Conflict', 'Only the current claim holder may release.', 'R-CLAIM-02');
        }
        append([{ type: 'QuestionReleased', subjectId: id, payload: {} }]);
        return viewQuestion(requireQuestion(id));
      });
    },
    lastWriteEtag() { return lastWriteVersion === undefined ? undefined : etagOf(lastWriteVersion); },

    async listQuestions(filter = {}) {
      requireReadPermission('listQuestions');
      if (options.meetingId !== undefined) {
        if (filter.speakerId !== undefined) requireSpeaker(filter.speakerId);
        if (filter.contributionId !== undefined) requireContribution(filter.contributionId);
        if (filter.unitId !== undefined && !state.units.some((unit) => unit.id === filter.unitId)) {
          throw new ApiProblem(404, 'Not found', `Unit ${filter.unitId} does not exist.`);
        }
        if (filter.agendaItemId !== undefined && !state.agendaItems.some((item) => item.id === filter.agendaItemId)) {
          throw new ApiProblem(404, 'Not found', `Agenda item ${filter.agendaItemId} does not exist.`);
        }
      }
      // Festlegung 2: a status filter naming a status outside the actor's own read scope is R-PERM-03
      // — checked through `can()` itself (a `questionShell` per candidate status), never a second,
      // hand-rolled walk of `READ_SCOPES` (rework round, point 3). `requireReadPermission` above
      // already guarantees the actor holds at least one qualifying permission, so any status this
      // rejects is specifically a scope overrun, not a missing permission — R-PERM-03, not R-PERM-02.
      if (filter.status) {
        const currentActor = actor();
        const outOfScope = filter.status.find((s) => !can(currentActor, 'question.read', questionShell(s, currentActor.unitId)).allow);
        if (outOfScope !== undefined) {
          throw new ApiProblem(403, 'Forbidden', `Status "${outOfScope}" is outside the read scope (Leseumfang).`, 'R-PERM-03');
        }
      }
      const all = [...state.questions.values()].filter((q) => questionMatches(q, filter) && can(actor(), 'question.read', q).allow);
      const offset = filter.offset ?? 0;
      const limit = filter.limit ?? 500;
      return { items: all.slice(offset, offset + limit).map((question) => viewQuestion(question)), total: all.length };
    },
    async getQuestion(id) {
      const q = state.questions.get(id);
      if (!q || !can(actor(), 'question.read', q).allow) {
        // Outside the actor's read scope is reported exactly like an unknown id (Festlegung 3).
        throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
      }
      return viewQuestion(q);
    },
    async getQuestionHistory(id) {
      const q = requireQuestionFor(id, 'history.read');
      // Festlegung 8 (rework round, point 5): `history.read` alone is not enough — the actor must
      // also be able to read the question itself, including its scope (e.g. observer's
      // `question.read.delivered`). `requireQuestionFor` above already lets an actor who holds
      // `history.read` past on existence alone (Festlegung 3's normal carve-out for an operation-
      // permission holder); this closes that gap for the one operation Festlegung 8 exempts from it.
      // Masked identically to an unknown id: holding `history.read` must never turn into "history of
      // any question, readable or not".
      if (!can(actor(), 'question.read', q).allow) {
        throw new ApiProblem(404, 'Not found', `Question ${id} does not exist.`);
      }
      requireReadPermission('getQuestionHistory'); // 403 R-PERM-02 if history.read itself is missing
      return store.all().filter((e) => e.subjectId === q.id && e.meetingId === state.meeting?.id).map(maskEvent);
    },
    async classifyQuestion(id, input, opts) {
      if (!TRACKS.includes(input.track)) throw new ApiProblem(422, 'Unprocessable', 'track must be podium, fast_track or expert_track.');
      if (input.agendaItemId !== undefined && !state.agendaItems.some((a) => a.id === input.agendaItemId)) {
        throw new ApiProblem(422, 'Unprocessable', `Agenda item ${input.agendaItemId} does not exist.`);
      }
      if (input.stageAssignment !== undefined && !STAGE_ASSIGNMENTS.includes(input.stageAssignment)) {
        throw new ApiProblem(422, 'Unprocessable', 'stageAssignment is not a known podium assignment.');
      }
      return transition(id, 'question.classify', opts, input, (q) => ({
        type: 'QuestionClassified',
        subjectId: q.id,
        payload: { ...input },
      }));
    },
    async assignQuestion(id, unitId, opts) {
      if (!state.units.some((u) => u.id === unitId)) throw new ApiProblem(422, 'Unprocessable', `Unit ${unitId} does not exist.`);
      return transition(id, 'question.assign', opts, { unitId }, (q) => ({
        type: 'QuestionAssigned',
        subjectId: q.id,
        payload: { unitId },
      }));
    },
    async draftAnswer(id, input, opts) {
      if (!input.text?.trim()) throw new ApiProblem(422, 'Unprocessable', 'Answer text is required.');
      return transition(id, 'answer.draft', opts, input, (q) => ({
        type: 'AnswerDrafted',
        subjectId: q.id,
        payload: {
          answer: {
            version: q.answers.length + 1,
            text: input.text.trim(),
            createdAt: now(),
            createdBy: { id: actor().id, role: actor().role },
            ...(input.sources !== undefined ? { sources: [...input.sources] } : {}),
          },
          ...(q.approval ? { invalidatedApprovalOfVersion: q.approval.answerVersion } : {}),
        },
      }));
    },
    async submitForReview(id, opts) {
      return transition(id, 'question.submit_review', opts, undefined, (q) => ({
        type: 'QuestionSubmittedForReview',
        subjectId: q.id,
        payload: { answerVersion: q.answers[q.answers.length - 1]!.version },
      }));
    },
    async approveQuestion(id, answerVersion, opts) {
      return transition(id, 'question.approve', opts, { answerVersion }, (q) => ({
        type: 'QuestionApproved',
        subjectId: q.id,
        payload: { answerVersion },
      }));
    },
    async clearQuestionLegally(id, input, opts) {
      if (input.answerVersion !== undefined && (!Number.isInteger(input.answerVersion) || input.answerVersion < 1)) {
        throw new ApiProblem(422, 'Unprocessable', 'answerVersion must be a positive integer.');
      }
      if (input.note !== undefined && typeof input.note !== 'string') {
        throw new ApiProblem(422, 'Unprocessable', 'note must be a string.');
      }
      return transition(id, 'question.legal.clear', opts, input, (q) => {
        const latest = q.answers[q.answers.length - 1]?.version;
        if (latest !== undefined && input.answerVersion === undefined) {
          throw new ApiProblem(422, 'Unprocessable', 'answerVersion is required for a text-answer legal clearance.');
        }
        if (input.answerVersion !== undefined && input.answerVersion !== latest) {
          throw new ApiProblem(409, 'Conflict', 'Legal clearance must name the latest answer version.', 'R-GUARD-04');
        }
        return {
          type: 'QuestionLegalCleared',
          subjectId: q.id,
          payload: {
            questionId: q.id,
            ...(latest !== undefined ? { answerVersion: latest } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
          },
        };
      });
    },
    async returnQuestion(id, reason, opts) {
      if (!reason?.trim()) throw new ApiProblem(422, 'Unprocessable', 'A reason is required.');
      return transition(id, 'question.return', opts, { reason }, (q, to) => ({
        type: 'QuestionReturned',
        subjectId: q.id,
        payload: { reason: reason.trim(), fromStatus: q.status, toStatus: to },
      }));
    },
    async stageQuestion(id, opts) {
      return transition(id, 'question.stage', opts, undefined, (q) => ({
        type: 'QuestionStaged',
        subjectId: q.id,
        payload: { stagePosition: state.stageCounter + 1 },
      }));
    },
    async deliverQuestion(id, opts) {
      return transition(id, 'question.deliver', opts, undefined, (q) => ({
        type: 'QuestionDelivered',
        subjectId: q.id,
        payload: q.approval ? { answerVersion: q.approval.answerVersion } : {},
      }));
    },
    async closeQuestion(id, opts) {
      return transition(id, 'question.close', opts, undefined, (q) => ({
        type: 'QuestionClosed',
        subjectId: q.id,
        payload: {},
      }));
    },
    async withdrawQuestion(id, reason, opts) {
      if (!reason?.trim()) throw new ApiProblem(422, 'Unprocessable', 'A reason is required.');
      return transition(id, 'question.withdraw', opts, { reason }, (q) => ({
        type: 'QuestionWithdrawn',
        subjectId: q.id,
        payload: { reason: reason.trim() },
      }));
    },
    async mergeQuestion(id, intoQuestionId, opts) {
      // Rework round, point 1: `intoQuestionId` is resolved only inside `build`, i.e. only after
      // `transition()` has already required `question.merge` on `id` (permission, then the transition
      // table). Resolving it any earlier — as a plain `requireQuestion` ahead of any check — made the
      // target an existence oracle: any caller, regardless of rights, could learn whether an arbitrary
      // id exists from this one field alone. `requireQuestionFor` applies the same 404 precedence
      // (Festlegung 3) to the target as to `id` itself.
      return transition(id, 'question.merge', opts, { intoQuestionId }, (q) => {
        requireQuestionFor(intoQuestionId, 'question.merge');
        return {
          type: 'QuestionMerged',
          subjectId: q.id,
          payload: { intoQuestionId },
        };
      });
    },

    async getStage() {
      requireReadPermission('getStage');
      const staged = [...state.questions.values()]
        .filter((q) => q.status === 'staged')
        .sort((a, b) => (a.stagePosition ?? 0) - (b.stagePosition ?? 0))
        .map((question) => viewQuestion(question));
      const [current, ...queue] = staged;
      const counts = state.meeting?.counts;
      return {
        current: current ?? null,
        queue,
        deliveredCount: counts?.delivered ?? 0,
        openCount: counts?.open ?? 0,
      };
    },
    async listEvents(after = 0, limit = 1000) {
      requireReadPermission('listEvents');
      return { items: store.readAfter(after, limit).map(maskEvent), lastSeq: store.lastSeq() };
    },
    async seedDemo(o = {}) {
      requirePermission('demo.seed');
      if (!options.seeder) throw new ApiProblem(409, 'Conflict', 'No seeder configured.');
      if (store.lastSeq() > 0) {
        throw new ApiProblem(409, 'Conflict', 'The event log is not empty; seeding only into an empty store.');
      }
      const events = options.seeder({
        questions: o.questions ?? CORPUS_DEMO.questions,
        seed: o.seed ?? CORPUS_DEMO.seed,
        roundSizes: o.roundSizes ?? CORPUS_DEMO.roundSizes,
        now: clock(),
        actor: actor(),
      });
      store.append(events);
      return this.getMeeting();
    },
    subscribe(listener) {
      // Festlegung 5: the 13th read method. Payloads only for `event.read`; everyone else gets `[]`
      // as a bare change signal (the interface only reacts to it, `api/useApiVersion.ts`). Checked
      // fresh against the *current* actor on every delivery, because the demo role switcher changes
      // `actor()` at runtime — a subscription started under one role must not keep leaking events
      // once the demo user switches to a role without `event.read`.
      return store.subscribe((events) => {
        if (!can(actor(), 'event.read').allow) { listener([]); return; }
        // A broken event must not abort the store's notification loop (other subscribers, the
        // append that already persisted). It is skipped here; `listEvents` reports it by seq.
        const visible: ReadEvent[] = [];
        for (const event of events) {
          try { visible.push(maskEvent(event)); } catch { /* integrity error, surfaced by listEvents */ }
        }
        listener(visible);
      });
    },
  };
}
