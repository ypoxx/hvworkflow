/**
 * Domain value to house wording. Every later slice renders statuses, tracks, podium assignments,
 * actions and history entries through these helpers, so the vocabulary of docs/glossar.md is fixed
 * in one place instead of being retyped per view.
 *
 * The maps below use role and status names as *keys* — that is a display lookup, never a rights
 * decision. Rights come from `_actions` alone (AGENTS.md rule 4).
 */
import type {
  EventType,
  Permission,
  QuestionStatus,
  Role,
  StageAssignment,
  Track,
} from '@hv/domain';
import type { TKey, Translate } from './types';

const STATUS_KEYS: Readonly<Record<QuestionStatus, TKey>> = {
  captured: 'status.captured',
  classified: 'status.classified',
  assigned: 'status.assigned',
  answer_drafted: 'status.answer_drafted',
  in_review: 'status.in_review',
  approved: 'status.approved',
  staged: 'status.staged',
  delivered: 'status.delivered',
  closed: 'status.closed',
  withdrawn: 'status.withdrawn',
  merged: 'status.merged',
};

const TRACK_KEYS: Readonly<Record<Track, TKey>> = {
  podium: 'track.podium',
  fast_track: 'track.fast_track',
  expert_track: 'track.expert_track',
};

const TRACK_SHORT_KEYS: Readonly<Record<Track, TKey>> = {
  podium: 'track.podium.short',
  fast_track: 'track.fast_track.short',
  expert_track: 'track.expert_track.short',
};

const STAGE_KEYS: Readonly<Record<StageAssignment, TKey>> = {
  supervisory_board_chair: 'stage.supervisory_board_chair',
  ceo: 'stage.ceo',
  cfo: 'stage.cfo',
  board_member: 'stage.board_member',
};

const ACTION_KEYS: Readonly<Record<Permission, TKey>> = {
  'speaker.register': 'action.speaker.register',
  'speaker.reorder': 'action.speaker.reorder',
  'speaker.update': 'action.speaker.update',
  'contribution.capture': 'action.contribution.capture',
  'question.capture': 'action.question.capture',
  'question.classify': 'action.question.classify',
  'question.assign': 'action.question.assign',
  'answer.draft': 'action.answer.draft',
  'question.submit_review': 'action.question.submit_review',
  'question.approve': 'action.question.approve',
  'question.return': 'action.question.return',
  'question.stage': 'action.question.stage',
  'question.deliver': 'action.question.deliver',
  'question.close': 'action.question.close',
  'question.withdraw': 'action.question.withdraw',
  'question.merge': 'action.question.merge',
  'question.read': 'action.question.read',
  'demo.seed': 'action.demo.seed',
};

const ROLE_KEYS: Readonly<Record<Role, TKey>> = {
  moderation: 'role.moderation',
  capture: 'role.capture',
  expert: 'role.expert',
  legal: 'role.legal',
  approver: 'role.approver',
  podium: 'role.podium',
  admin: 'role.admin',
  observer: 'role.observer',
};

const EVENT_KEYS: Readonly<Record<EventType, TKey>> = {
  MeetingCreated: 'event.MeetingCreated',
  SpeakerRegistered: 'event.SpeakerRegistered',
  SpeakersReordered: 'event.SpeakersReordered',
  SpeakerUpdated: 'event.SpeakerUpdated',
  ContributionCaptured: 'event.ContributionCaptured',
  QuestionCaptured: 'event.QuestionCaptured',
  QuestionClassified: 'event.QuestionClassified',
  QuestionAssigned: 'event.QuestionAssigned',
  AnswerDrafted: 'event.AnswerDrafted',
  QuestionSubmittedForReview: 'event.QuestionSubmittedForReview',
  QuestionApproved: 'event.QuestionApproved',
  QuestionReturned: 'event.QuestionReturned',
  QuestionStaged: 'event.QuestionStaged',
  QuestionDelivered: 'event.QuestionDelivered',
  QuestionClosed: 'event.QuestionClosed',
  QuestionWithdrawn: 'event.QuestionWithdrawn',
  QuestionMerged: 'event.QuestionMerged',
};

export function statusLabel(t: Translate, status: QuestionStatus): string {
  return t(STATUS_KEYS[status]);
}

export function trackLabel(t: Translate, track: Track): string {
  return t(TRACK_KEYS[track]);
}

/** The short form for narrow columns and badges: "Pfad C" instead of "Pfad C · Expert Track". */
export function trackShortLabel(t: Translate, track: Track): string {
  return t(TRACK_SHORT_KEYS[track]);
}

export function stageAssignmentLabel(t: Translate, assignment: StageAssignment): string {
  return t(STAGE_KEYS[assignment]);
}

export function actionLabel(t: Translate, permission: Permission): string {
  return t(ACTION_KEYS[permission]);
}

export function roleLabel(t: Translate, role: Role): string {
  return t(ROLE_KEYS[role]);
}

export function eventTypeLabel(t: Translate, type: EventType): string {
  return t(EVENT_KEYS[type]);
}
