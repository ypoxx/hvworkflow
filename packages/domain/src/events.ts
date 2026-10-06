/**
 * Events are the only thing that is ever written. The projection (`state.ts`) is derived from them
 * and can be rebuilt at any time. Sequence numbers are global and gap-free; `subjectId` names the
 * aggregate the event belongs to (question, speaker, contribution, meeting).
 */
import type {
  Actor,
  AnswerVersion,
  Classification,
  ForwardReasonCode,
  QuestionRelation,
  QuestionStatus,
  SpeakerReopenReason,
  SpeakerStatus,
  StageSeat,
  TextSpan,
  Role,
} from './types.js';
import type { LegalRef } from './rules.js';

interface Base<T extends string, P> {
  seq: number;
  id: string;
  type: T;
  at: string; // UTC ISO 8601
  actor: Actor;
  subjectId: string;
  payload: P;
  /** Envelope v2 fields are optional in contract 0.3.0 so legacy dev fixtures can still be read. */
  schemaVersion?: 2;
  meetingId?: string;
  idempotencyKey?: string;
  commandId?: string;
  commandOperation?: string;
  commandResource?: string;
  causationId?: string;
  prevHash?: string;
  hash?: string;
  recordedAt?: string;
  occurredAt?: string;
  occurredAtSource?: 'server' | 'device' | 'paper' | 'transcript';
  retentionClass?: 'record' | 'working' | 'technical';
  legalHold?: boolean;
  personId?: string;
}

export type MeetingCreated = Base<
  'MeetingCreated',
  {
    title: string;
    legalEntity?: string;
    date: string;
    /** Written on new creations since 025; absent on older logs that were already running. */
    lifecycleVersion?: 2;
    agendaItems: { id: string; number: number; title: string }[];
    units: { id: string; name: string; shortName?: string }[];
    /** Scheibe 040b: the seat list (seed; cloning from 040c). Absent in older logs: no seats. */
    stageSeats?: StageSeat[];
  }
>;
export type MeetingStarted = Base<'MeetingStarted', Record<string, never>>;
export type MeetingClosed = Base<'MeetingClosed', Record<string, never>>;
export type DebateClosed = Base<'DebateClosed', Record<string, never>>;
export type AgendaItemOpened = Base<'AgendaItemOpened', { agendaItemId: string; number: number }>;
export type VotingOpened = Base<'VotingOpened', { agendaItemId: string; number: number }>;
export type VotingClosed = Base<'VotingClosed', { agendaItemId: string; number: number }>;
export type SpeakerRegistered = Base<
  'SpeakerRegistered',
  {
    number: number;
    /** Historical events only; new writes place the name in `pii`. */
    displayName?: string;
    organisation?: string;
    pii?: { keyId: string; displayName: string; organisation?: string };
    round: number;
    position: number;
  }
>;
export type RoleAssigned = Base<'RoleAssigned', {
  assignmentId: string; subjectId: string; role: Role; unitId?: string; expiresAt?: string; deputyForSubjectId?: string;
}>;
export type RoleRevoked = Base<'RoleRevoked', { assignmentId: string; subjectId: string; role: Role; reason?: string }>;
export type SpeakersReordered = Base<'SpeakersReordered', { round: number; speakerIds: string[] }>;
export type SpeakerUpdated = Base<
  'SpeakerUpdated',
  { status?: SpeakerStatus; round?: number; reason?: SpeakerReopenReason }
>;
export type ContributionCaptured = Base<
  'ContributionCaptured',
  { speakerId: string; text: string; source: 'manual' | 'transcript' | 'paper'; lateEntry?: boolean; lateEntryReason?: string }
>;
export type QuestionCaptured = Base<
  'QuestionCaptured',
  { number: string; contributionId: string; speakerId: string; text: string; span?: TextSpan }
>;
/**
 * Scheibe 046: the reference of a new question (subject) to its referenced question of the same
 * meeting, written in the capture command right after its `QuestionCaptured` (R-LINK-02). No personal
 * data, no number, no text. Every event read path removes `parentQuestionId` and `parentAnswerVersion`
 * (`maskEvent`); the stored original keeps them.
 */
export type QuestionLinked = Base<'QuestionLinked', {
  parentQuestionId: string;
  relation: QuestionRelation;
  /** Last delivered answer version of the parent at capture (QuestionDelivered.answerVersion); absent if none. */
  parentAnswerVersion?: number;
}>;
export type QuestionClassified = Base<'QuestionClassified', Classification>;
/** Scheibe 040b: master data as whole lists; `subjectId` is the meeting, every one raises `Meeting.version`. */
export type AgendaItemsReplaced = Base<'AgendaItemsReplaced', { agendaItems: { id: string; number: number; title: string }[] }>;
export type UnitsReplaced = Base<'UnitsReplaced', { units: { id: string; name: string; shortName?: string }[] }>;
export type StageSeatsReplaced = Base<'StageSeatsReplaced', { stageSeats: StageSeat[] }>;
export type QuestionAssigned = Base<'QuestionAssigned', { unitId: string }>;
/**
 * Scheibe 048: forwarded to another answering unit. Only the unit changes (R-TRANS-17); the status
 * stays, so the event carries none. `fromUnitId` is absent when the question had no unit. The reason
 * is a closed code without personal data; it stands only here, never in the projection.
 */
export type QuestionForwarded = Base<'QuestionForwarded', { unitId: string; fromUnitId?: string; reasonCode: ForwardReasonCode }>;
/** Scheibe 044a: what a path-B proposal keeps of its catalogue entry (audit path, 043a); never projected. */
export interface RefusalGroundSnapshot {
  title: string;
  stageText: string;
  legalRef: LegalRef;
}
/**
 * One answer version. Since Scheibe 044a also a refusal proposal: `answer` carries `answerKind`, on
 * path B the ground, its hash and the snapshot; the justification never stands in `answer` (the type
 * forbids it) but only in `pii` (ADR 0009, DSFA V7), which every event read path strips. `toStatus` is
 * the target status the transition table resolved (only written by `proposeRefusal`); without it the
 * projection keeps `answer_drafted`.
 */
export type AnswerDrafted = Base<
  'AnswerDrafted',
  {
    answer: Omit<AnswerVersion, 'refusalJustification'> & { refusalGround?: RefusalGroundSnapshot };
    invalidatedApprovalOfVersion?: number;
    toStatus?: QuestionStatus;
    pii?: { keyId: string; refusalJustification: string };
  }
>;
export type QuestionSubmittedForReview = Base<'QuestionSubmittedForReview', { answerVersion: number }>;
export type QuestionApproved = Base<'QuestionApproved', { answerVersion: number }>;
export type QuestionLegalCleared = Base<'QuestionLegalCleared', { questionId: string; answerVersion?: number; note?: string }>;
export type QuestionReturned = Base<
  'QuestionReturned',
  { reason: string; fromStatus: QuestionStatus; toStatus: QuestionStatus }
>;
export type QuestionStaged = Base<'QuestionStaged', { stagePosition: number }>;
export type QuestionDelivered = Base<'QuestionDelivered', { answerVersion?: number }>;
export type QuestionClosed = Base<'QuestionClosed', Record<string, never>>;
export type QuestionWithdrawn = Base<'QuestionWithdrawn', { reason: string }>;
export type QuestionMerged = Base<'QuestionMerged', { intoQuestionId: string }>;
export type ContributionClaimed = Base<'ContributionClaimed', { actorId: string; personId?: string; claimedAt: string; expiresAt: string }>;
export type ContributionReleased = Base<'ContributionReleased', Record<string, never>>;
export type QuestionClaimed = Base<'QuestionClaimed', { actorId: string; personId?: string; claimedAt: string; expiresAt: string }>;
export type QuestionReleased = Base<'QuestionReleased', Record<string, never>>;
export type IdempotencyRecorded = Base<'IdempotencyRecorded', Record<string, never>>;

export type DomainEvent =
  | MeetingCreated
  | MeetingStarted
  | MeetingClosed
  | DebateClosed
  | AgendaItemOpened
  | VotingOpened
  | VotingClosed
  | SpeakerRegistered
  | RoleAssigned
  | RoleRevoked
  | SpeakersReordered
  | SpeakerUpdated
  | ContributionCaptured
  | QuestionCaptured
  | QuestionLinked
  | QuestionClassified
  | QuestionAssigned
  | QuestionForwarded
  | AnswerDrafted
  | QuestionSubmittedForReview
  | QuestionApproved
  | QuestionLegalCleared
  | QuestionReturned
  | QuestionStaged
  | QuestionDelivered
  | QuestionClosed
  | QuestionWithdrawn
  | QuestionMerged
  | ContributionClaimed
  | ContributionReleased
  | QuestionClaimed
  | QuestionReleased
  | IdempotencyRecorded
  | AgendaItemsReplaced
  | UnitsReplaced
  | StageSeatsReplaced;

export type EventType = DomainEvent['type'];

/**
 * Standard read projection. `maskEvent` (api.ts) strips `displayName`, `organisation`, `pii` and
 * `personId` recursively from every payload; a new payload field that holds clear-text person data
 * must be added to that block list. sourceHash identifies the immutable original, not this redacted JSON. */
type ReadForm<E extends DomainEvent> = Omit<E, 'hash' | 'prevHash' | 'personId' | 'commandId' | 'commandOperation' | 'commandResource'> & { redacted: true; sourceHash: string };
export type ReadEvent = DomainEvent extends infer E
  ? E extends DomainEvent
    // Scheibe 046: the read payload of a link is the relation only, so no read path can type-read the id.
    ? E extends QuestionLinked ? Omit<ReadForm<E>, 'payload'> & { payload: { relation: QuestionRelation } } : ReadForm<E>
    : never
  : never;

/** An event before it is appended: the store assigns `seq`. */
export type NewEvent = Omit<DomainEvent, 'seq'>;
