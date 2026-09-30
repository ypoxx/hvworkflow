/**
 * Domain types of the HV-Tool. They mirror the OpenAPI contract in `packages/contract/openapi.yaml`;
 * the contract is the source of truth, this file is the typed projection the domain works with.
 * German house terms are given in parentheses so that the code stays readable for the people who
 * run the general meeting (docs/glossar.md).
 */

/** Roles are only bundles of permissions. Nothing in the domain branches on a role name. */
export type Role =
  | 'moderation' // Versammlungsleitung / Backoffice: Wortmeldeliste
  | 'capture' // Erfassung: Redebeiträge, Atomisierung
  // Koordination (slice 021b, working name of decision E1): classifies questions into tracks and
  // assigns them to units — taken over from capture so that capturing and routing are separate hands.
  | 'coordination'
  | 'expert' // Fachbereich: Antwortentwurf
  | 'legal' // Recht / Legal Clearing
  | 'approver' // Freigabe (Vorstandsbüro / Leitung)
  | 'podium' // Bühne: Vorstand liest vor
  | 'admin'
  | 'observer';

export interface Actor {
  id: string;
  role: Role;
  displayName?: string;
  personId?: string;
  /** Internal assignment context, never accepted from a request body. */
  unitId?: string;
  assignmentScoped?: boolean;
}

/** Permission identifiers. Implemented entries from the contract's `Action` enum. */
export const PERMISSIONS = [
  'admin.roles.manage',
  'agenda.manage',
  'question.identity.reveal',
  'speaker.register',
  'speaker.reorder',
  'speaker.update',
  'speaker.read',
  'contribution.capture',
  'contribution.claim',
  'contribution.read',
  'question.capture',
  'question.claim',
  'question.classify',
  'question.assign',
  'answer.draft',
  'question.submit_review',
  'question.approve',
  'question.legal.clear',
  'question.return',
  'question.stage',
  'question.deliver',
  'question.close',
  'question.withdraw',
  'question.merge',
  'question.read',
  'question.read.delivered',
  'stage.read',
  'history.read',
  'event.read',
  'demo.seed',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Read methods and the permission(s) that unlock them — data, so `can()`/`hasPermission()`
 * (packages/domain/src/api.ts, permissions.ts) never derive "is this a read?" from a permission's
 * name (no `.endsWith('.read')`, Festlegung 6 of docs/slices/010-lesepfade-leserechte.md). More than
 * one entry is an OR: `question.read.delivered` is a status-scoped alternative to `question.read`
 * (R-PERM-03, see `READ_SCOPES` in permissions.ts). Master data (`getMeeting`, `listAgendaItems`,
 * `listUnits`) has no entry — every signed-in role may read it (Festlegung 1), so the service checks
 * only that the actor exists, never `can()`. `subscribe` (the 13th read method) has no entry either:
 * it is checked per delivery, directly against `event.read` (Festlegung 5).
 */
export const READ_PERMISSIONS = {
  listSpeakers: ['speaker.read'],
  getSpeaker: ['speaker.read'],
  listContributions: ['contribution.read'],
  getContribution: ['contribution.read'],
  listQuestions: ['question.read', 'question.read.delivered'],
  getQuestion: ['question.read', 'question.read.delivered'],
  getStage: ['stage.read'],
  getQuestionHistory: ['history.read'],
  listEvents: ['event.read'],
} as const satisfies Record<string, readonly Permission[]>;
export type ReadMethod = keyof typeof READ_PERMISSIONS;

export const QUESTION_STATUSES = [
  'captured', // erfasst
  'classified', // klassifiziert
  'assigned', // zugewiesen
  'answer_drafted', // Antwortentwurf liegt vor
  'in_review', // im Legal Clearing
  'approved', // freigegeben (an Textversion gebunden)
  'staged', // auf der Bühne (Warteschlange Podium)
  'delivered', // vorgelesen
  'closed', // abgeschlossen
  'withdrawn', // zurückgezogen
  'merged', // zusammengeführt (Duplikat)
] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Terminal statuses: nothing may follow. */
export const TERMINAL_STATUSES: readonly QuestionStatus[] = ['closed', 'withdrawn', 'merged'];

/** The three answer tracks (Antwortpfade A, B, C). */
export const TRACKS = ['podium', 'fast_track', 'expert_track'] as const;
export type Track = (typeof TRACKS)[number];

/** Who answers on the podium (Bühnenzuordnung). */
export const STAGE_ASSIGNMENTS = ['supervisory_board_chair', 'ceo', 'cfo', 'board_member'] as const;
export type StageAssignment = (typeof STAGE_ASSIGNMENTS)[number];

export type SpeakerStatus = 'waiting' | 'speaking' | 'finished' | 'withdrawn';
/** Why a finished Wortmeldung goes back to waiting (R-SPK-05): only a follow-up (Nachfrage). */
export type SpeakerReopenReason = 'follow_up';

export interface TextSpan {
  start: number;
  end: number;
}

export interface Meeting {
  id: string;
  title: string;
  legalEntity?: string;
  date: string; // ISO date
  status: 'preparation' | 'running' | 'closed';
  version: number;
  speakerListVersion: number;
  debateClosedAt?: string;
  pseudonymiseForUnits?: boolean;
  currentRound: number;
  counts: {
    speakers: number;
    questions: number;
    open: number;
    staged: number;
    delivered: number;
    /** Questions per workflow status, in one pass over the projection (Prozessleiste). */
    byStatus: Record<QuestionStatus, number>;
  };
}

export interface AgendaItem {
  id: string;
  number: number;
  title: string;
  openedAt?: string;
  votingOpenedAt?: string;
  votingClosedAt?: string;
}

export interface Unit {
  id: string;
  name: string;
  shortName?: string;
}

export interface SpeakerRecord {
  id: string;
  meetingId?: string;
  personId?: string;
  number: number;
  displayName: string;
  organisation?: string;
  round: number;
  position: number;
  status: SpeakerStatus;
  speakingStartedAt?: string;
  speakingEndedAt?: string;
  questionCount: number;
  version: number;
}

/** Clear identity stays in the person projection, separate from workflow records. */
export interface Person {
  personId: string;
  displayName: string;
  organisation?: string;
}

/** One append-only role grant and its optional later revocation. */
export interface RoleAssignment {
  id: string;
  meetingId: string;
  subjectId: string;
  personId?: string;
  role: Role;
  unitId?: string;
  expiresAt?: string;
  deputyForSubjectId?: string;
  assignedAt: string;
  assignedBy: Actor;
  revokedAt?: string;
  revokedBy?: Actor;
}
export interface RoleAssignmentCreate {
  subjectId: string;
  personId?: string;
  role: Role;
  unitId?: string;
  expiresAt?: string;
  deputyForSubjectId?: string;
}
export interface Speaker extends SpeakerRecord {
  _actions: Permission[];
}

export interface Contribution {
  id: string;
  version: number;
  meetingId?: string;
  speakerId: string;
  text: string;
  capturedAt: string;
  source: 'manual' | 'transcript' | 'paper';
  occurredAt?: string;
  occurredAtSource?: 'device' | 'paper' | 'transcript';
  lateEntry?: boolean;
  questionIds: string[];
  coverage: { coveredRatio: number; uncovered: TextSpan[] };
  claim?: Claim;
}

export interface Claim {
  actorId: string;
  personId?: string;
  claimedAt: string;
  expiresAt: string;
}

export interface AnswerVersion {
  version: number;
  text: string;
  createdAt: string;
  createdBy: Actor;
  sources?: string[];
}

export interface Approval {
  answerVersion: number;
  approvedAt: string;
  approvedBy: Actor;
}

export interface LegalClearance {
  answerVersion?: number;
  clearedAt: string;
  clearedBy: Actor;
}

/** A question as stored in the projection, without the per-actor `_actions`. */
export interface QuestionRecord {
  id: string;
  meetingId?: string;
  number: string;
  contributionId: string;
  speakerId: string;
  speakerDisplayName?: string;
  text: string;
  span?: TextSpan;
  status: QuestionStatus;
  track?: Track;
  agendaItemId?: string;
  stageAssignment?: StageAssignment;
  unitId?: string;
  answers: AnswerVersion[];
  approval?: Approval;
  legalClearance?: LegalClearance;
  returnReason?: string;
  stagePosition?: number;
  deliveredAt?: string;
  mergedIntoId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  claim?: Claim;
}
/** A question as returned by the API: record plus the actions the calling actor may take now. */
export interface Question extends QuestionRecord {
  _actions: Permission[];
}

export interface StageView {
  current: Question | null;
  queue: Question[];
  deliveredCount: number;
  openCount: number;
}

/* ---------- inputs (request bodies) ---------- */

export interface SpeakerRegistration {
  displayName: string;
  organisation?: string;
  round?: number;
}
export interface SpeakerUpdate {
  status?: SpeakerStatus;
  round?: number;
  /** Domain only until contract 0.4.0 (slice 043): required by R-SPK-05 (finished → waiting). */
  reason?: SpeakerReopenReason;
}
export interface ContributionCapture {
  speakerId: string;
  text: string;
  source?: 'manual' | 'transcript';
}
/** Canonical year-scoped capture; the legacy alias keeps its narrower request body. */
export interface MeetingContributionCapture {
  speakerId: string;
  text: string;
  source?: 'manual' | 'transcript' | 'paper';
  occurredAt?: string;
  occurredAtSource?: 'device' | 'paper' | 'transcript';
  lateEntryReason?: string;
}
export interface QuestionCapture {
  text: string;
  span?: TextSpan;
}
export interface Classification {
  track: Track;
  agendaItemId?: string;
  stageAssignment?: StageAssignment;
}
export interface AnswerDraft {
  text: string;
  sources?: string[];
}
export interface LegalClearanceRequest {
  answerVersion?: number;
  note?: string;
}
export interface QuestionFilter {
  status?: QuestionStatus[];
  track?: Track;
  unitId?: string;
  speakerId?: string;
  contributionId?: string;
  agendaItemId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/** Options every write accepts: optimistic locking and idempotent replay. */
export interface WriteOptions {
  ifMatch?: string;
  idempotencyKey?: string;
}

/* ---------- stream (slice 035a, contract 0.3.11) ---------- */

/** Areas a change signal names (contract `StreamTopic`); working term "Thema", not a glossary entry. */
export type StreamTopic = 'meeting' | 'speakers' | 'contributions' | 'questions' | 'stage' | 'roles';

/**
 * A change signal without content (contract `StreamChange`, R-PERM-04): the areas that changed and,
 * where the reader may read them, the ids of the changed items. `seq` is the last covered event.
 */
export interface StreamChange {
  seq: number;
  topics: StreamTopic[];
  subjects?: string[];
  meetingId?: string;
  replay?: true;
}
