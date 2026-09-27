/**
 * Events are the only thing that is ever written. The projection (`state.ts`) is derived from them
 * and can be rebuilt at any time. Sequence numbers are global and gap-free; `subjectId` names the
 * aggregate the event belongs to (question, speaker, contribution, meeting).
 */
import type {
  Actor,
  AnswerVersion,
  Classification,
  QuestionStatus,
  SpeakerReopenReason,
  SpeakerStatus,
  TextSpan,
} from './types.js';

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
    displayName: string;
    organisation?: string;
    round: number;
    position: number;
  }
>;
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
export type QuestionClassified = Base<'QuestionClassified', Classification>;
export type QuestionAssigned = Base<'QuestionAssigned', { unitId: string }>;
export type AnswerDrafted = Base<
  'AnswerDrafted',
  { answer: AnswerVersion; invalidatedApprovalOfVersion?: number }
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

export type DomainEvent =
  | MeetingCreated
  | MeetingStarted
  | MeetingClosed
  | DebateClosed
  | AgendaItemOpened
  | VotingOpened
  | VotingClosed
  | SpeakerRegistered
  | SpeakersReordered
  | SpeakerUpdated
  | ContributionCaptured
  | QuestionCaptured
  | QuestionClassified
  | QuestionAssigned
  | AnswerDrafted
  | QuestionSubmittedForReview
  | QuestionApproved
  | QuestionLegalCleared
  | QuestionReturned
  | QuestionStaged
  | QuestionDelivered
  | QuestionClosed
  | QuestionWithdrawn
  | QuestionMerged;

export type EventType = DomainEvent['type'];

/** An event before it is appended: the store assigns `seq`. */
export type NewEvent = Omit<DomainEvent, 'seq'>;
