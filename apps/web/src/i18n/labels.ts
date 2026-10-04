/**
 * Domain value to house wording. Every later slice renders statuses, tracks, podium assignments,
 * actions and history entries through these helpers, so the vocabulary of docs/glossar.md is fixed
 * in one place instead of being retyped per view.
 *
 * The maps below use role and status names as *keys* — that is a display lookup, never a rights
 * decision. Rights come from `_actions` alone (AGENTS.md rule 4).
 */
import type {
  DomainEvent,
  EventType,
  ForwardReasonCode,
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
  'admin.roles.manage': 'action.admin.roles.manage',
  'admin.units.manage': 'action.admin.units.manage',
  'admin.seats.manage': 'action.admin.seats.manage',
  'agenda.manage': 'action.agenda.manage',
  'question.identity.reveal': 'action.question.identity.reveal',
  'speaker.register': 'action.speaker.register',
  'speaker.reorder': 'action.speaker.reorder',
  'speaker.update': 'action.speaker.update',
  'contribution.capture': 'action.contribution.capture',
  'contribution.claim': 'action.contribution.claim',
  'question.capture': 'action.question.capture',
  'question.classify': 'action.question.classify',
  'question.assign': 'action.question.assign',
  'question.forward': 'action.question.forward',
  'answer.draft': 'action.answer.draft',
  'question.submit_review': 'action.question.submit_review',
  'question.approve': 'action.question.approve',
  'question.legal.clear': 'action.question.legal.clear',
  'question.refuse.propose': 'action.question.refuse.propose',
  'question.refuse.approve': 'action.question.refuse.approve',
  'question.return': 'action.question.return',
  'question.stage': 'action.question.stage',
  'question.deliver': 'action.question.deliver',
  'question.close': 'action.question.close',
  'question.withdraw': 'action.question.withdraw',
  'question.merge': 'action.question.merge',
  'question.claim': 'action.question.claim',
  'question.read': 'action.question.read',
  // Read permissions (slice 010): the read methods now check them through `can()` too.
  'speaker.read': 'action.speaker.read',
  'contribution.read': 'action.contribution.read',
  'question.read.delivered': 'action.question.read.delivered',
  'stage.read': 'action.stage.read',
  'history.read': 'action.history.read',
  'event.read': 'action.event.read',
  'demo.seed': 'action.demo.seed',
};

const ROLE_KEYS: Readonly<Record<Role, TKey>> = {
  moderation: 'role.moderation',
  capture: 'role.capture',
  coordination: 'role.coordination',
  expert: 'role.expert',
  legal: 'role.legal',
  approver: 'role.approver',
  podium: 'role.podium',
  admin: 'role.admin',
  observer: 'role.observer',
};

const EVENT_KEYS: Readonly<Record<EventType, TKey>> = {
  MeetingCreated: 'event.MeetingCreated',
  MeetingStarted: 'event.MeetingStarted',
  MeetingClosed: 'event.MeetingClosed',
  DebateClosed: 'event.DebateClosed',
  AgendaItemOpened: 'event.AgendaItemOpened',
  VotingOpened: 'event.VotingOpened',
  VotingClosed: 'event.VotingClosed',
  SpeakerRegistered: 'event.SpeakerRegistered',
  RoleAssigned: 'event.RoleAssigned',
  RoleRevoked: 'event.RoleRevoked',
  SpeakersReordered: 'event.SpeakersReordered',
  SpeakerUpdated: 'event.SpeakerUpdated',
  ContributionCaptured: 'event.ContributionCaptured',
  ContributionClaimed: 'event.ContributionClaimed',
  ContributionReleased: 'event.ContributionReleased',
  QuestionCaptured: 'event.QuestionCaptured',
  QuestionClassified: 'event.QuestionClassified',
  QuestionAssigned: 'event.QuestionAssigned',
  QuestionForwarded: 'event.QuestionForwarded',
  AnswerDrafted: 'event.AnswerDrafted',
  QuestionSubmittedForReview: 'event.QuestionSubmittedForReview',
  QuestionApproved: 'event.QuestionApproved',
  QuestionLegalCleared: 'event.QuestionLegalCleared',
  QuestionReturned: 'event.QuestionReturned',
  QuestionStaged: 'event.QuestionStaged',
  QuestionDelivered: 'event.QuestionDelivered',
  QuestionClosed: 'event.QuestionClosed',
  QuestionWithdrawn: 'event.QuestionWithdrawn',
  QuestionMerged: 'event.QuestionMerged',
  QuestionClaimed: 'event.QuestionClaimed',
  QuestionReleased: 'event.QuestionReleased',
  IdempotencyRecorded: 'event.IdempotencyRecorded',
  AgendaItemsReplaced: 'event.AgendaItemsReplaced',
  UnitsReplaced: 'event.UnitsReplaced',
  StageSeatsReplaced: 'event.StageSeatsReplaced',
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

/**
 * Scheibe 048: the reason codes of a forward to another answering unit (Grund der Weiterleitung). One
 * map for the history row and, from 054, the forward dialog.
 */
const FORWARD_REASON_KEYS: Readonly<Record<ForwardReasonCode, TKey>> = {
  wrong_unit: 'history.forward.reason.wrong_unit',
  expertise_elsewhere: 'history.forward.reason.expertise_elsewhere',
  capacity: 'history.forward.reason.capacity',
  other: 'history.forward.reason.other',
};

/** The label of a reason code; a code this build does not know (a later contract stage) stays the code. */
export function forwardReasonLabel(t: Translate, code: string): string {
  return Object.hasOwn(FORWARD_REASON_KEYS, code) ? t(FORWARD_REASON_KEYS[code as ForwardReasonCode]) : code;
}

/**
 * Scheibe 045: the label of one history row. A draft that carries a refusal kind is "Verweigerung
 * vorgeschlagen"; an approval is "Verweigerung freigegeben" only when the proposal of the same question
 * and version is among the loaded events (`refusalVersions`, keys `<subjectId>:<version>`, built by the
 * history page). Without that proof, the ordinary label stands: the event `QuestionApproved` itself
 * does not say what it approved.
 */
export function eventLabel(
  t: Translate,
  event: DomainEvent,
  context: { readonly refusalVersions: ReadonlySet<string> },
): string {
  if (event.type === 'AnswerDrafted') {
    const kind = event.payload.answer.answerKind;
    if (kind === 'refusal_no_claim' || kind === 'refusal_with_ground') return t('event.AnswerDrafted.refusal');
  }
  if (event.type === 'QuestionApproved' && context.refusalVersions.has(`${event.subjectId}:${event.payload.answerVersion}`)) {
    return t('event.QuestionApproved.refusal');
  }
  return eventTypeLabel(t, event.type);
}
