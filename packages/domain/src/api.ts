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
import type { DomainEvent, NewEvent } from './events.js';
import { ALLOW, deny, hasPermission, type Decision } from './permissions.js';
import { resolveTransition, TRANSITION_ACTIONS } from './transitions.js';
import { emptyState, reduce, type State } from './state.js';
import type { EventStore } from './store.js';
import type {
  Actor,
  AgendaItem,
  AnswerDraft,
  Classification,
  Contribution,
  ContributionCapture,
  Meeting,
  Permission,
  Question,
  QuestionCapture,
  QuestionFilter,
  QuestionRecord,
  Speaker,
  SpeakerRecord,
  SpeakerRegistration,
  SpeakerUpdate,
  StageView,
  Unit,
  WriteOptions,
} from './types.js';
import { PERMISSIONS, STAGE_ASSIGNMENTS, TRACKS } from './types.js';

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
  listAgendaItems(): Promise<AgendaItem[]>;
  listUnits(): Promise<Unit[]>;

  listSpeakers(filter?: { round?: number; status?: Speaker['status'] }): Promise<Speaker[]>;
  getSpeaker(id: string): Promise<Speaker>;
  registerSpeaker(input: SpeakerRegistration, opts?: WriteOptions): Promise<Speaker>;
  reorderSpeakers(round: number, speakerIds: string[], opts?: WriteOptions): Promise<Speaker[]>;
  updateSpeaker(id: string, input: SpeakerUpdate, opts?: WriteOptions): Promise<Speaker>;

  listContributions(filter?: { speakerId?: string }): Promise<Contribution[]>;
  getContribution(id: string): Promise<Contribution>;
  captureContribution(input: ContributionCapture, opts?: WriteOptions): Promise<Contribution>;
  captureQuestions(contributionId: string, questions: QuestionCapture[], opts?: WriteOptions): Promise<Question[]>;

  listQuestions(filter?: QuestionFilter): Promise<{ items: Question[]; total: number }>;
  getQuestion(id: string): Promise<Question>;
  getQuestionHistory(id: string): Promise<DomainEvent[]>;
  classifyQuestion(id: string, input: Classification, opts?: WriteOptions): Promise<Question>;
  assignQuestion(id: string, unitId: string, opts?: WriteOptions): Promise<Question>;
  draftAnswer(id: string, input: AnswerDraft, opts?: WriteOptions): Promise<Question>;
  submitForReview(id: string, opts?: WriteOptions): Promise<Question>;
  approveQuestion(id: string, answerVersion: number, opts?: WriteOptions): Promise<Question>;
  returnQuestion(id: string, reason: string, opts?: WriteOptions): Promise<Question>;
  stageQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  deliverQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  closeQuestion(id: string, opts?: WriteOptions): Promise<Question>;
  withdrawQuestion(id: string, reason: string, opts?: WriteOptions): Promise<Question>;
  mergeQuestion(id: string, intoQuestionId: string, opts?: WriteOptions): Promise<Question>;

  getStage(): Promise<StageView>;
  listEvents(after?: number, limit?: number): Promise<{ items: DomainEvent[]; lastSeq: number }>;
  seedDemo(options?: { questions?: number; seed?: number }): Promise<Meeting>;

  /** In-process realtime: called after every append. The HTTP adapter maps this to SSE/polling. */
  subscribe(listener: (events: DomainEvent[]) => void): () => void;
}

export interface InProcessApiOptions {
  store: EventStore;
  /** The calling actor. A function so that the demo role switcher can change it at runtime. */
  actor: () => Actor;
  /** Single source of time (docs: R-TIME). Defaults to the system clock. */
  clock?: () => Date;
  idGenerator?: () => string;
  /** Provided by seed.ts; injected to keep this module free of demo content. */
  seeder?: (options: { questions: number; seed: number; now: Date; actor: Actor }) => NewEvent[];
}

export function etagOf(version: number): string {
  return `"v${version}"`;
}

const defaultId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The single decision point (docs/rollen-und-rechtekonzept.md): permission bundle first, then the
 * transition table with its guards. Exported so that tests can produce the truth table from it.
 */
export function can(
  actor: Actor,
  action: Permission,
  question?: QuestionRecord,
  payload?: unknown,
): Decision {
  const perm = hasPermission(actor, action);
  if (!perm.allow) return perm;
  if (question && TRANSITION_ACTIONS.includes(action)) {
    const t = resolveTransition(question, action, payload);
    if (!t.ok) return deny(t.ruleId, t.reason);
  }
  return ALLOW;
}

/** Actions the actor may take on this question right now — the server-provided `_actions`. */
export function actionsFor(actor: Actor, q: QuestionRecord): Permission[] {
  return PERMISSIONS.filter((p) => p !== 'demo.seed' && p.startsWith('question.') || p === 'answer.draft')
    .filter((p) => can(actor, p, q).allow);
}

const SPEAKER_ACTIONS: readonly Permission[] = ['speaker.update', 'speaker.reorder'];

export function createInProcessApi(options: InProcessApiOptions): HvApi {
  const { store } = options;
  const clock = options.clock ?? (() => new Date());
  const newId = options.idGenerator ?? defaultId;
  let state: State = emptyState();
  for (const e of store.all()) reduce(state, e);
  const idempotency = new Map<string, unknown>();

  store.subscribe((events) => {
    for (const e of events) if (e.seq > state.lastSeq) reduce(state, e);
  });

  const now = (): string => clock().toISOString();
  const actor = (): Actor => options.actor();

  const viewSpeaker = (s: SpeakerRecord): Speaker => ({
    ...s,
    _actions: SPEAKER_ACTIONS.filter((p) => hasPermission(actor(), p).allow),
  });
  const viewQuestion = (q: QuestionRecord): Question => ({
    ...q,
    answers: q.answers.map((a) => ({ ...a })),
    _actions: actionsFor(actor(), q),
  });

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
  const requirePermission = (p: Permission): void => {
    const d = hasPermission(actor(), p);
    if (!d.allow) throw new ApiProblem(403, 'Forbidden', d.reason, d.ruleId);
  };
  const checkIfMatch = (version: number, opts?: WriteOptions): void => {
    if (opts?.ifMatch !== undefined && opts.ifMatch !== etagOf(version)) {
      throw new ApiProblem(
        412,
        'Precondition failed',
        `Resource changed: expected ${opts.ifMatch}, current ${etagOf(version)}.`,
      );
    }
  };
  /**
   * Wrap a write so that an idempotency key replays the first result instead of re-executing.
   * The key is scoped to the calling actor and the operation (R-IDEM-01): a replay by another actor
   * or against another resource is a new request and goes through the permission check again.
   */
  const idempotent = <T>(scope: string, opts: WriteOptions | undefined, run: () => T): T => {
    const key = opts?.idempotencyKey;
    const scoped = key !== undefined ? `${actor().id}|${scope}|${key}` : undefined;
    if (scoped !== undefined && idempotency.has(scoped)) return idempotency.get(scoped) as T;
    const result = run();
    if (scoped !== undefined) idempotency.set(scoped, result);
    return result;
  };
  const append = (events: Omit<NewEvent, 'id' | 'at' | 'actor'>[]): DomainEvent[] => {
    const a = actor();
    const at = now();
    return store.append(events.map((e) => ({ ...e, id: newId(), at, actor: a }) as NewEvent));
  };

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
      const q = requireQuestion(id);
      const perm = hasPermission(actor(), action);
      if (!perm.allow) throw new ApiProblem(403, 'Forbidden', perm.reason, perm.ruleId);
      const t = resolveTransition(q, action, payload);
      if (!t.ok) throw new ApiProblem(409, 'Conflict', t.reason, t.ruleId);
      checkIfMatch(q.version, opts);
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
      const hay = [q.number, q.text, q.speakerDisplayName ?? '', ...q.answers.map((a) => a.text)]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };

  return {
    async getMeeting() {
      if (!state.meeting) throw new ApiProblem(404, 'Not found', 'No meeting exists yet.');
      return { ...state.meeting, counts: { ...state.meeting.counts } };
    },
    async listAgendaItems() {
      return state.agendaItems.map((a) => ({ ...a }));
    },
    async listUnits() {
      return state.units.map((u) => ({ ...u }));
    },

    async listSpeakers(filter = {}) {
      return [...state.speakers.values()]
        .filter((s) => (filter.round === undefined || s.round === filter.round) && (filter.status === undefined || s.status === filter.status))
        .sort((a, b) => a.round - b.round || a.position - b.position)
        .map(viewSpeaker);
    },
    async getSpeaker(id) {
      return viewSpeaker(requireSpeaker(id));
    },
    async registerSpeaker(input, opts) {
      return idempotent('registerSpeaker', opts, () => {
        requirePermission('speaker.register');
        if (!input.displayName?.trim()) throw new ApiProblem(422, 'Unprocessable', 'displayName is required.');
        const round = input.round ?? state.meeting?.currentRound ?? 1;
        const inRound = [...state.speakers.values()].filter((s) => s.round === round);
        const id = newId();
        append([
          {
            type: 'SpeakerRegistered',
            subjectId: id,
            payload: {
              number: state.speakers.size + 1,
              displayName: input.displayName.trim(),
              kind: input.kind,
              round,
              position: inRound.length + 1,
              ...(input.organisation !== undefined ? { organisation: input.organisation } : {}),
              ...(input.requestedMinutes !== undefined ? { requestedMinutes: input.requestedMinutes } : {}),
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
        append([{ type: 'SpeakersReordered', subjectId: state.meeting?.id ?? 'meeting', payload: { round, speakerIds } }]);
        return [...state.speakers.values()]
          .filter((s) => s.round === round)
          .sort((a, b) => a.position - b.position)
          .map(viewSpeaker);
      });
    },
    async updateSpeaker(id, input, opts) {
      return idempotent(`updateSpeaker:${id}`, opts, () => {
        requirePermission('speaker.update');
        const s = requireSpeaker(id);
        checkIfMatch(s.version, opts);
        append([{ type: 'SpeakerUpdated', subjectId: id, payload: { ...input } }]);
        return viewSpeaker(requireSpeaker(id));
      });
    },

    async listContributions(filter = {}) {
      return [...state.contributions.values()]
        .filter((c) => filter.speakerId === undefined || c.speakerId === filter.speakerId)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
        .map((c) => ({ ...c, questionIds: [...c.questionIds], coverage: { ...c.coverage, uncovered: [...c.coverage.uncovered] } }));
    },
    async getContribution(id) {
      const c = requireContribution(id);
      return { ...c, questionIds: [...c.questionIds], coverage: { ...c.coverage, uncovered: [...c.coverage.uncovered] } };
    },
    async captureContribution(input, opts) {
      return idempotent('captureContribution', opts, () => {
        requirePermission('contribution.capture');
        requireSpeaker(input.speakerId);
        if (!input.text?.trim()) throw new ApiProblem(422, 'Unprocessable', 'text is required.');
        const id = newId();
        append([{ type: 'ContributionCaptured', subjectId: id, payload: { speakerId: input.speakerId, text: input.text, source: input.source ?? 'manual' } }]);
        return this.getContribution(id);
      });
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

    async listQuestions(filter = {}) {
      const all = [...state.questions.values()].filter((q) => questionMatches(q, filter));
      const offset = filter.offset ?? 0;
      const limit = filter.limit ?? 500;
      return { items: all.slice(offset, offset + limit).map(viewQuestion), total: all.length };
    },
    async getQuestion(id) {
      return viewQuestion(requireQuestion(id));
    },
    async getQuestionHistory(id) {
      requireQuestion(id);
      return store.all().filter((e) => e.subjectId === id);
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
            createdBy: actor(),
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
      requireQuestion(intoQuestionId);
      return transition(id, 'question.merge', opts, { intoQuestionId }, (q) => ({
        type: 'QuestionMerged',
        subjectId: q.id,
        payload: { intoQuestionId },
      }));
    },

    async getStage() {
      const staged = [...state.questions.values()]
        .filter((q) => q.status === 'staged')
        .sort((a, b) => (a.stagePosition ?? 0) - (b.stagePosition ?? 0))
        .map(viewQuestion);
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
      return { items: store.readAfter(after, limit), lastSeq: store.lastSeq() };
    },
    async seedDemo(o = {}) {
      requirePermission('demo.seed');
      if (!options.seeder) throw new ApiProblem(409, 'Conflict', 'No seeder configured.');
      if (store.lastSeq() > 0) {
        throw new ApiProblem(409, 'Conflict', 'The event log is not empty; seeding only into an empty store.');
      }
      const events = options.seeder({ questions: o.questions ?? 800, seed: o.seed ?? 2027, now: clock(), actor: actor() });
      store.append(events);
      return this.getMeeting();
    },
    subscribe(listener) {
      return store.subscribe(listener);
    },
  };
}
