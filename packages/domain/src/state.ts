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
  QuestionRecord,
  QuestionStatus,
  SpeakerRecord,
  Unit,
} from './types.js';
import { QUESTION_STATUSES } from './types.js';
import { computeCoverage } from './coverage.js';

export interface State {
  meeting: Meeting | null;
  agendaItems: AgendaItem[];
  units: Unit[];
  speakers: Map<string, SpeakerRecord>;
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
    speakers: new Map(),
    contributions: new Map(),
    questions: new Map(),
    stageCounter: 0,
    lastSeq: 0,
  };
}

/** Recompute the aggregate counters shown in the header and on the podium. */
export function refreshCounts(state: State): void {
  if (!state.meeting) return;
  let open = 0;
  let staged = 0;
  let delivered = 0;
  const byStatus = Object.fromEntries(QUESTION_STATUSES.map((s) => [s, 0])) as Record<QuestionStatus, number>;
  for (const q of state.questions.values()) {
    byStatus[q.status] += 1;
    if (q.status === 'staged') staged++;
    else if (q.status === 'delivered' || q.status === 'closed') delivered++;
    if (!['closed', 'withdrawn', 'merged', 'delivered'].includes(q.status)) open++;
  }
  state.meeting.counts = {
    speakers: state.speakers.size,
    questions: state.questions.size,
    open,
    staged,
    delivered,
    byStatus,
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
  switch (e.type) {
    case 'MeetingCreated': {
      state.meeting = {
        id: e.subjectId,
        title: e.payload.title,
        date: e.payload.date,
        status: 'running',
        currentRound: 1,
        counts: { speakers: 0, questions: 0, open: 0, staged: 0, delivered: 0, byStatus: Object.fromEntries(QUESTION_STATUSES.map((st) => [st, 0])) as Record<QuestionStatus, number> },
        ...(e.payload.legalEntity !== undefined ? { legalEntity: e.payload.legalEntity } : {}),
      };
      state.agendaItems = e.payload.agendaItems.map((a) => ({ ...a }));
      state.units = e.payload.units.map((u) => ({ ...u }));
      break;
    }
    case 'SpeakerRegistered': {
      const p = e.payload;
      state.speakers.set(e.subjectId, {
        id: e.subjectId,
        number: p.number,
        displayName: p.displayName,
        kind: p.kind,
        round: p.round,
        position: p.position,
        status: 'waiting',
        questionCount: 0,
        version: 1,
        ...(p.organisation !== undefined ? { organisation: p.organisation } : {}),
        ...(p.requestedMinutes !== undefined ? { requestedMinutes: p.requestedMinutes } : {}),
      });
      break;
    }
    case 'SpeakersReordered': {
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
      const p = e.payload;
      if (p.status !== undefined) {
        s.status = p.status;
        if (p.status === 'speaking') s.speakingStartedAt = e.at;
        if (p.status === 'finished') s.speakingEndedAt = e.at;
      }
      if (p.round !== undefined) s.round = p.round;
      if (p.requestedMinutes !== undefined) s.requestedMinutes = p.requestedMinutes;
      s.version += 1;
      break;
    }
    case 'ContributionCaptured': {
      state.contributions.set(e.subjectId, {
        id: e.subjectId,
        speakerId: e.payload.speakerId,
        text: e.payload.text,
        capturedAt: e.at,
        source: e.payload.source,
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
        recomputeCoverage(state, c.id);
      }
      if (speaker) {
        speaker.questionCount += 1;
      }
      break;
    }
    case 'QuestionClassified': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = 'classified';
      q.track = e.payload.track;
      if (e.payload.agendaItemId !== undefined) q.agendaItemId = e.payload.agendaItemId;
      else delete q.agendaItemId;
      if (e.payload.stageAssignment !== undefined) q.stageAssignment = e.payload.stageAssignment;
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
    case 'AnswerDrafted': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.answers.push({ ...e.payload.answer });
      q.status = 'answer_drafted';
      delete q.approval; // R-GUARD-04: an approval is bound to a version; a new version voids it
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
    case 'QuestionReturned': {
      const q = state.questions.get(e.subjectId);
      if (!q) break;
      q.status = e.payload.toStatus;
      q.returnReason = e.payload.reason;
      delete q.stagePosition;
      if (e.payload.toStatus === 'classified') delete q.approval;
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
