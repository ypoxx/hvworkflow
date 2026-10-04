/**
 * Projection of the event log into the current state. Pure: `reduce(state, event)` returns a new
 * state; `project(events)` folds the whole log. Rebuilding from scratch is cheap at HV volume
 * (a few thousand events).
 */
import type { DomainEvent } from './events.js';
import type {
  AgendaItem,
  Contribution,
  Meeting,
  Person,
  QuestionRecord,
  QuestionStatus,
  SpeakerRecord,
  RoleAssignment,
  StageAssignment,
  StageSeat,
  Unit,
} from './types.js';
import { QUESTION_STATUSES, STAGE_ASSIGNMENTS } from './types.js';
import { computeCoverage } from './coverage.js';
import { projectAnswerBody } from './answerFormat.js';
import { resolveAgendaProgress, resolveMeetingLifecycle } from './transitions.js';

export interface State {
  meeting: Meeting | null;
  agendaItems: AgendaItem[];
  units: Unit[];
  /** Scheibe 040b: podium seats, sorted by `position`, then `id` (a seat without position last). */
  stageSeats: StageSeat[];
  speakers: Map<string, SpeakerRecord>;
  persons: Map<string, Person>;
  roleAssignments: Map<string, RoleAssignment>;
  contributions: Map<string, Contribution>;
  questions: Map<string, QuestionRecord>;
  /** Highest stage position handed out so far; the queue is ordered by it. */
  stageCounter: number;
  lastSeq: number;
}

export function emptyState(): State {
  return {
    meeting: null,
    agendaItems: [],
    units: [],
    stageSeats: [],
    speakers: new Map(),
    persons: new Map(),
    roleAssignments: new Map(),
    contributions: new Map(),
    questions: new Map(),
    stageCounter: 0,
    lastSeq: 0,
  };
}

/**
 * The stage predicate (Bühne, slice 035a m10): a question is on the podium queue. The single place
 * that names the stage status — `getStage` (api.ts), the stream visibility (stream.ts) and the
 * counters below all ask this, so there is no second status literal for the stage.
 */
export function isOnStage(q: Pick<QuestionRecord, 'status'>): boolean {
  return q.status === 'staged';
}

/** The order of the seat list: by `position`, then `id`; a seat without a position comes last. */
export function sortStageSeats(seats: readonly StageSeat[]): StageSeat[] {
  return [...seats].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Recompute the aggregate counters shown in the header and on the podium. */
export function refreshCounts(state: State): void {
  if (!state.meeting) return;
  let open = 0;
  let staged = 0;
  let delivered = 0;
  const byStatus = Object.fromEntries(QUESTION_STATUSES.map((s) => [s, 0])) as Record<QuestionStatus, number>;
  // Scheibe 040b: every unit and every seat of the meeting is a key, also with 0. A question whose
  // unit or seat is in neither list (an older log) counts under no key.
  const byUnit: Record<string, number> = Object.fromEntries(state.units.map((unit) => [unit.id, 0]));
  const bySeat: Record<string, number> = Object.fromEntries(state.stageSeats.map((seat) => [seat.id, 0]));
  for (const q of state.questions.values()) {
    byStatus[q.status] += 1;
    if (isOnStage(q)) {
      staged++;
      if (q.seatId !== undefined && Object.hasOwn(bySeat, q.seatId)) bySeat[q.seatId]! += 1;
    } else if (q.status === 'delivered' || q.status === 'closed') delivered++;
    if (!['closed', 'withdrawn', 'merged', 'delivered'].includes(q.status)) {
      open++;
      if (q.unitId !== undefined && Object.hasOwn(byUnit, q.unitId)) byUnit[q.unitId]! += 1;
    }
  }
  state.meeting.counts = {
    speakers: state.speakers.size,
    questions: state.questions.size,
    open,
    staged,
    delivered,
    byStatus,
    byUnit,
    bySeat,
  };
  // The current round is where the microphone is: the round of the speaker talking now, else the
  // lowest round that still has someone waiting, else the last round that was registered.
  const speakers = [...state.speakers.values()];
  const speaking = speakers.find((s) => s.status === 'speaking');
  if (speaking) state.meeting.currentRound = speaking.round;
  else {
    const waiting = speakers.filter((s) => s.status === 'waiting').map((s) => s.round);
    if (waiting.length > 0) state.meeting.currentRound = Math.min(...waiting);
    else if (speakers.length > 0) state.meeting.currentRound = Math.max(...speakers.map((s) => s.round));
  }
}

function recomputeCoverage(state: State, contributionId: string): void {
  const c = state.contributions.get(contributionId);
  if (!c) return;
  const spans = c.questionIds
    .map((id) => state.questions.get(id)?.span)
    .filter((s): s is NonNullable<typeof s> => s !== undefined);
  c.coverage = computeCoverage(c.text.length, spans);
}

function touch(q: QuestionRecord, at: string): void {
  q.version += 1;
  q.updatedAt = at;
}

/** Apply one event. Mutates `state` in place for speed; callers treat the result as the new state. */
export function reduce(state: State, e: DomainEvent): State {
  state.lastSeq = e.seq;
  // The unscoped demo alias follows the latest meeting even when an older meeting receives
  // another event later in the same global log. Scoped projections already filter by meetingId.
  if (e.type !== 'MeetingCreated' && state.meeting && e.meetingId !== state.meeting.id) return state;
  switch (e.type) {
    case 'MeetingCreated': {
      if (state.meeting?.id === e.subjectId) throw new Error('R-MTG-01: meeting already exists.');
      // The unscoped demo alias follows the newest meeting; canonical readers project one
      // meeting at a time from the same global event log.
      state.speakers = new Map();
      state.persons = new Map();
      state.roleAssignments = new Map();
      state.contributions = new Map();
      state.questions = new Map();
      state.stageCounter = 0;
      state.meeting = {
        id: e.subjectId,
        title: e.payload.title,
        date: e.payload.date,
        // A pre-025 MeetingCreated has no lifecycle marker: preserve the running projection
        // without mutating its hashed event or synthesising a second event in the global log.
        status: e.payload.lifecycleVersion === 2 ? 'preparation' : 'running',
        version: 1,
        speakerListVersion: 1,
        currentRound: 1,
        pseudonymiseForUnits: true,
        counts: { speakers: 0, questions: 0, open: 0, staged: 0, delivered: 0, byStatus: Object.fromEntries(QUESTION_STATUSES.map((st) => [st, 0])) as Record<QuestionStatus, number> },
        ...(e.payload.legalEntity !== undefined ? { legalEntity: e.payload.legalEntity } : {}),
      };
      state.agendaItems = e.payload.agendaItems.map((a) => ({ ...a }));
      state.units = e.payload.units.map((u) => ({ ...u }));
      state.stageSeats = sortStageSeats((e.payload.stageSeats ?? []).map((seat) => ({ ...seat })));
      break;
    }
    // Scheibe 040b: master data as whole lists. An agenda item that keeps its id keeps its progress.
    case 'AgendaItemsReplaced': {
      if (state.meeting?.id !== e.subjectId) break;
      const previous = new Map(state.agendaItems.map((item) => [item.id, item]));
      state.agendaItems = e.payload.agendaItems.map((item) => {
        const old = previous.get(item.id);
        return { id: item.id, number: item.number, title: item.title,
          ...(old?.openedAt !== undefined ? { openedAt: old.openedAt } : {}),
          ...(old?.votingOpenedAt !== undefined ? { votingOpenedAt: old.votingOpenedAt } : {}),
          ...(old?.votingClosedAt !== undefined ? { votingClosedAt: old.votingClosedAt } : {}) };
      }).sort((a, b) => a.number - b.number);
      state.meeting.version = (state.meeting.version ?? 1) + 1;
      break;
    }
    case 'UnitsReplaced': {
      if (state.meeting?.id !== e.subjectId) break;
      state.units = e.payload.units.map((unit) => ({ ...unit }));
      state.meeting.version = (state.meeting.version ?? 1) + 1;
      break;
    }
    case 'StageSeatsReplaced': {
      if (state.meeting?.id !== e.subjectId) break;
      state.stageSeats = sortStageSeats(e.payload.stageSeats.map((seat) => ({ ...seat })));
      state.meeting.version = (state.meeting.version ?? 1) + 1;
      break;
    }
    case 'MeetingStarted': {
      if (state.meeting?.id !== e.subjectId) throw new Error('R-MTG-02: meeting does not exist here.');
      const transition = resolveMeetingLifecycle(state.meeting, e.type);
      if (!transition.ok) throw new Error(`${transition.ruleId}: ${transition.reason}`);
      state.meeting.status = transition.to;
      state.meeting.version = (state.meeting.version ?? 1) + 1;
      break;
    }
    case 'MeetingClosed': {
      if (state.meeting?.id !== e.subjectId) throw new Error('R-MTG-02: meeting does not exist here.');
      const transition = resolveMeetingLifecycle(state.meeting, e.type);
      if (!transition.ok) throw new Error(`${transition.ruleId}: ${transition.reason}`);
      state.meeting.status = transition.to;
      state.meeting.version = (state.meeting.version ?? 1) + 1;
      break;
    }
    case 'DebateClosed': {
      if (state.meeting?.id === e.subjectId) {
        state.meeting.debateClosedAt = e.recordedAt ?? e.at;
        state.meeting.version = (state.meeting.version ?? 1) + 1;
      }
      break;
    }
    case 'AgendaItemOpened':
    case 'VotingOpened':
    case 'VotingClosed': {
      if (state.meeting?.id !== e.subjectId) throw new Error('R-MTG-04: meeting does not exist here.');
      const item = state.agendaItems.find((a) => a.id === e.payload.agendaItemId);
      if (!item) throw new Error('R-MTG-04: agenda item does not exist here.');
      const transition = resolveAgendaProgress(state.meeting, item, e.type);
      if (!transition.ok) throw new Error(`${transition.ruleId}: ${transition.reason}`);
      const at = e.recordedAt ?? e.at;
      if (e.type === 'AgendaItemOpened') item.openedAt = at;
      else if (e.type === 'VotingOpened') item.votingOpenedAt = at;
      else item.votingClosedAt = at;
      state.meeting.version = (state.meeting.version ?? 1) + 1;
      break;
    }
    case 'SpeakerRegistered': {
      if (state.meeting) state.meeting.speakerListVersion += 1;
      // Events written before slice 080 may still carry the kind (Art) and the speaking time; they stay in
      // the log untouched (rule 7), the projection just no longer reads them.
      const p = e.payload;
      const personId = e.personId ?? e.subjectId;
      const displayName = p.pii?.displayName ?? p.displayName;
      if (displayName) state.persons.set(personId, {
        personId, displayName,
        ...(p.pii?.organisation !== undefined ? { organisation: p.pii.organisation }
          : p.organisation !== undefined ? { organisation: p.organisation } : {}),
      });
      state.speakers.set(e.subjectId, {
        id: e.subjectId,
        ...(e.meetingId !== undefined ? { meetingId: e.meetingId } : {}),
        number: p.number,
        personId,
        displayName: `Redner ${p.number}`,
        round: p.round,
        position: p.position,
        status: 'waiting',
        questionCount: 0,
        version: 1,
      });
      break;
    }
    case 'RoleAssigned': {
      state.roleAssignments.set(e.subjectId, {
        id: e.subjectId,
        meetingId: e.meetingId ?? state.meeting?.id ?? '',
        subjectId: e.payload.subjectId,
        ...(e.personId !== undefined ? { personId: e.personId } : {}),
        role: e.payload.role,
        ...(e.payload.unitId !== undefined ? { unitId: e.payload.unitId } : {}),
        ...(e.payload.expiresAt !== undefined ? { expiresAt: e.payload.expiresAt } : {}),
        ...(e.payload.deputyForSubjectId !== undefined ? { deputyForSubjectId: e.payload.deputyForSubjectId } : {}),
        assignedAt: e.recordedAt ?? e.at,
        assignedBy: { id: e.actor.id, role: e.actor.role },
      });
      break;
    }
    case 'RoleRevoked': {
      const assignment = state.roleAssignments.get(e.subjectId);
      if (assignment) {
        assignment.revokedAt = e.recordedAt ?? e.at;
        assignment.revokedBy = { id: e.actor.id, role: e.actor.role };
      }
      break;
    }
    case 'SpeakersReordered': {
      if (state.meeting) state.meeting.speakerListVersion += 1;
      e.payload.speakerIds.forEach((id, i) => {
        const s = state.speakers.get(id);
        if (s) {
          s.round = e.payload.round;
          s.position = i + 1;
          s.version += 1;
        }
      });
      break;
    }
    case 'SpeakerUpdated': {
      const s = state.speakers.get(e.subjectId);
      if (!s) break;
      if (state.meeting) state.meeting.speakerListVersion += 1;
      const p = e.payload;
      if (p.status !== undefined) {
        s.status = p.status;
        if (p.status === 'speaking') s.speakingStartedAt = e.at;
        if (p.status === 'finished') s.speakingEndedAt = e.at;
      }
      if (p.round !== undefined) s.round = p.round;
      s.version += 1;
      break;
    }
    case 'ContributionCaptured': {
      const speaker = state.speakers.get(e.payload.speakerId);
      if (speaker) {
        speaker.version += 1;
        if (state.meeting) state.meeting.speakerListVersion += 1;
      }
      state.contributions.set(e.subjectId, {
        id: e.subjectId,
        version: 1,
        ...(e.meetingId !== undefined ? { meetingId: e.meetingId } : {}),
        speakerId: e.payload.speakerId,
        text: e.payload.text,
        capturedAt: e.at,
        source: e.payload.source,
        ...(e.occurredAtSource !== undefined && e.occurredAtSource !== 'server' ? { occurredAt: e.occurredAt, occurredAtSource: e.occurredAtSource } : {}),
        ...(e.payload.lateEntry === true ? { lateEntry: true } : {}),
        questionIds: [],
        coverage: computeCoverage(e.payload.text.length, []),
      });
      break;
    }
    case 'QuestionCaptured': {
      const p = e.payload;
      const speaker = state.speakers.get(p.speakerId);
      state.questions.set(e.subjectId, {
        id: e.subjectId,
        ...(e.meetingId !== undefined ? { meetingId: e.meetingId } : {}),
        number: p.number,
        contributionId: p.contributionId,
        speakerId: p.speakerId,
        text: p.text,
        status: 'captured',
        answers: [],
        version: 1,
        createdAt: e.at,
        updatedAt: e.at,
        ...(speaker ? { speakerDisplayName: speaker.displayName } : {}),
        ...(p.span !== undefined ? { span: p.span } : {}),
      });
      const c = state.contributions.get(p.contributionId);
      if (c) {
        c.questionIds.push(e.subjectId);
        c.version += 1;
        recomputeCoverage(state, c.id);
      }
      if (speaker) {
        speaker.questionCount += 1;
        speaker.version += 1;
        if (state.meeting) state.meeting.speakerListVersion += 1;
      }
      break;
    }
    case 'ContributionClaimed': {
      const c = state.contributions.get(e.subjectId);
      if (!c) break;
      c.claim = { ...e.payload };
      c.version += 1;
      break;
    }
    case 'ContributionReleased': {
      const c = state.contributions.get(e.subjectId);
      if (!c) break;
      delete c.claim;
      c.version += 1;
      break;
    }
    case 'QuestionClaimed': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.claim = { ...e.payload };
      touch(q, e.at);
      break;
    }
    case 'QuestionReleased': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      delete q.claim;
      touch(q, e.at);
      break;
    }
    case 'IdempotencyRecorded':
      break;
    case 'QuestionClassified': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'classified';
      q.track = e.payload.track;
      if (e.payload.agendaItemId !== undefined) q.agendaItemId = e.payload.agendaItemId;
      else delete q.agendaItemId;
      // Scheibe 040b: `seatId` is the sent seat, otherwise the deprecated enum value; `stageAssignment`
      // is the sent enum value, otherwise the seat when it is one of the four values. So both never
      // disagree, and a classification without either removes both.
      const seatId = e.payload.seatId ?? e.payload.stageAssignment;
      const stageAssignment = e.payload.stageAssignment ??
        (seatId !== undefined && (STAGE_ASSIGNMENTS as readonly string[]).includes(seatId) ? seatId as StageAssignment : undefined);
      if (seatId !== undefined) q.seatId = seatId;
      else delete q.seatId;
      if (stageAssignment !== undefined) q.stageAssignment = stageAssignment;
      else delete q.stageAssignment;
      touch(q, e.at);
      break;
    }
    case 'QuestionAssigned': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'assigned';
      q.unitId = e.payload.unitId;
      touch(q, e.at);
      break;
    }
    case 'QuestionForwarded': {
      // Scheibe 048 (R-TRANS-17): only the unit changes. Status, answers, approval, legal clearance,
      // return reason, seat and the claim stay: the claim is a soft lock that blocks no permitted write
      // and expires by itself; clearing it would act on someone else's work (Lesebefund M2).
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.unitId = e.payload.unitId;
      touch(q, e.at);
      break;
    }
    case 'AnswerDrafted': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      // Scheibe 044a: the snapshot of the catalogue entry stays in the event (audit path); the
      // justification comes from the `pii` part, read without decoding like `SpeakerRegistered`.
      const { refusalGround: _snapshot, body: stored, ...answer } = e.payload.answer;
      const justification = e.payload.pii?.refusalJustification;
      // Scheibe 055 (ADR 0005, decision 5): every version gets a document. A stored one runs through the whitelist
      // again (read variant, never throws), unless that lost wording against the stored `text` (Codex P1); otherwise,
      // and for versions before 0.4.4 and refusals, it is derived from `text` (L). `text` is never recomputed.
      const body = projectAnswerBody(stored, answer.text);
      q.answers.push({ ...answer, ...(body !== undefined ? { body } : {}),
        ...(typeof justification === 'string' ? { refusalJustification: justification } : {}) });
      // The target status is the one the transition table resolved when the event was written
      // (`toStatus`, like `QuestionReturned`); only a known status is taken, anything else keeps the
      // status every answer draft has had.
      const to = e.payload.toStatus;
      q.status = to !== undefined && (QUESTION_STATUSES as readonly string[]).includes(to) ? to : 'answer_drafted';
      delete q.approval; // R-GUARD-04: an approval is bound to a version; a new version voids it
      delete q.legalClearance;
      delete q.legalClearerIds; // Scheibe 044a: the clearers belong to the voided version
      delete q.returnReason;
      touch(q, e.at);
      break;
    }
    case 'QuestionSubmittedForReview': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'in_review';
      touch(q, e.at);
      break;
    }
    case 'QuestionApproved': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'approved';
      q.approval = { answerVersion: e.payload.answerVersion, approvedAt: e.at, approvedBy: e.actor };
      touch(q, e.at);
      break;
    }
    case 'QuestionLegalCleared': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      // Scheibe 044a (R-GUARD-14): a repeated clearance of the same version keeps the earlier clearers.
      const sameVersion = q.legalClearance !== undefined && q.legalClearance.answerVersion === e.payload.answerVersion;
      q.legalClearerIds = [...new Set([...(sameVersion ? q.legalClearerIds ?? [q.legalClearance!.clearedBy.id] : []), e.actor.id])];
      q.legalClearance = {
        ...(e.payload.answerVersion !== undefined ? { answerVersion: e.payload.answerVersion } : {}),
        clearedAt: e.at,
        clearedBy: e.actor,
      };
      touch(q, e.at);
      break;
    }
    case 'QuestionReturned': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = e.payload.toStatus;
      q.returnReason = e.payload.reason;
      delete q.stagePosition;
      if (e.payload.toStatus === 'classified') {
        delete q.approval;
        delete q.legalClearance;
        delete q.legalClearerIds;
      }
      touch(q, e.at);
      break;
    }
    case 'QuestionStaged': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'staged';
      q.stagePosition = e.payload.stagePosition;
      state.stageCounter = Math.max(state.stageCounter, e.payload.stagePosition);
      touch(q, e.at);
      break;
    }
    case 'QuestionDelivered': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'delivered';
      q.deliveredAt = e.at;
      touch(q, e.at);
      break;
    }
    case 'QuestionClosed': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'closed';
      delete q.stagePosition;
      touch(q, e.at);
      break;
    }
    case 'QuestionWithdrawn': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'withdrawn';
      q.returnReason = e.payload.reason;
      delete q.stagePosition;
      touch(q, e.at);
      break;
    }
    case 'QuestionMerged': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'merged';
      q.mergedIntoId = e.payload.intoQuestionId;
      touch(q, e.at);
      break;
    }
  }
  refreshCounts(state);
  return state;
}

export function project(events: readonly DomainEvent[]): State {
  const s = emptyState();
  for (const e of events) reduce(s, e);
  return s;
}
