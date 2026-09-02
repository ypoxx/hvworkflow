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
  SpeakerKind,
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
}

export type MeetingCreated = Base<
  'MeetingCreated',
  {
    title: string;
    legalEntity?: string;
    date: string;
    agendaItems: { id: string; number: number; title: string }[];
    units: { id: string; name: string; shortName?: string }[];
  }
>;
export type SpeakerRegistered = Base<
  'SpeakerRegistered',
  {
    number: number;
    displayName: string;
    organisation?: string;
    kind: SpeakerKind;
    round: number;
    position: number;
    requestedMinutes?: number;
  }
>;
export type SpeakersReordered = Base<'SpeakersReordered', { round: number; speakerIds: string[] }>;
export type SpeakerUpdated = Base<
  'SpeakerUpdated',
  { status?: SpeakerStatus; round?: number; requestedMinutes?: number }
>;
export type ContributionCaptured = Base<
  'ContributionCaptured',
  { speakerId: string; text: string; source: 'manual' | 'transcript' }
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
  | QuestionReturned
  | QuestionStaged
  | QuestionDelivered
  | QuestionClosed
  | QuestionWithdrawn
  | QuestionMerged;

export type EventType = DomainEvent['type'];

/** An event before it is appended: the store assigns `seq`. */
export type NewEvent = Omit<DomainEvent, 'seq'>;
