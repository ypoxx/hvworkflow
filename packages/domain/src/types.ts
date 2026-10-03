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
  // Scheibe 040b: the administration maintains the answering units and the podium seats.
  'admin.units.manage',
  'admin.seats.manage',
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
  // Scheibe 044a (ADR 0012 model A, E25; built on the default): propose and approve a refusal
  // (Verweigerung). Placed right after the legal clearance: the order is the column order of the
  // policy truth table.
  'question.refuse.propose',
  'question.refuse.approve',
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
  // Scheibe 044a (043a): the catalogue of refusal grounds is global code data; every reader of a
  // question or of the stage may read it.
  listRefusalGrounds: ['question.read', 'question.read.delivered', 'stage.read'],
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
    /**
     * Scheibe 040b: open questions per answering unit and questions on the podium per seat. Every
     * unit and every seat of the meeting is a key, also with 0; aggregates, never a figure per person.
     * Optional in the type because the contract declares them optional; the projection always sets them.
     */
    byUnit?: Record<string, number>;
    bySeat?: Record<string, number>;
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

/**
 * Scheibe 040b (ADR 0006): a podium seat (Bühnenplatz) of a meeting. `personId` is a pseudonymous key
 * (ADR 0009) and `deviceId` a technical id of the podium device; only holders of `admin.seats.manage`
 * read them (`listMeetingStageSeats`).
 */
export interface StageSeat {
  id: string;
  label: string;
  position?: number;
  personId?: string;
  deviceId?: string;
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

/**
 * Scheibe 044a (contract 0.4.0, ADR 0012 model A): the kind of an answer version. `refusal_no_claim`
 * is refusal path A (Verweigerungspfad A, "kein Auskunftsanspruch"), `refusal_with_ground` refusal
 * path B (Verweigerungspfad B, "Verweigerung trotz Anspruchs", with a catalogue ground).
 */
export type AnswerKind = 'answer' | 'refusal_no_claim' | 'refusal_with_ground';

export interface AnswerVersion {
  version: number;
  text: string;
  createdAt: string;
  createdBy: Actor;
  sources?: string[];
  /** Absent means `answer`; `draftAnswer` never writes it. */
  answerKind?: AnswerKind;
  /** Path B only: the catalogue entry and its hash at the time of the proposal (R-GUARD-11). */
  refusalGroundId?: string;
  refusalGroundHash?: string;
  /**
   * The justification (Begründung), a legal assessment that may concern the shareholder (SG2, DSFA V7).
   * In the log it lives only in `payload.pii`; a view carries it only for holders of
   * `REFUSAL_JUSTIFICATION_READ` (permissions.ts).
   */
  refusalJustification?: string;
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
  /** Scheibe 040b: the seat that answers — `Classification.seatId`, otherwise the value of `stageAssignment`. */
  seatId?: string;
  unitId?: string;
  answers: AnswerVersion[];
  approval?: Approval;
  legalClearance?: LegalClearance;
  /**
   * Scheibe 044a (review finding 1): every actor id that legally cleared the current version (or, on the
   * podium track, the question), because a repeated clearance replaces `legalClearance.clearedBy`.
   * Internal to the projection for R-GUARD-14; never part of a view (`viewQuestion` strips it).
   */
  legalClearerIds?: string[];
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
  /** In the contract since 0.4.0 (slice 043a): required by R-SPK-05 (finished → waiting). */
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
  /** Scheibe 040b: a seat of the question's meeting; equal to `stageAssignment` when both are sent. */
  seatId?: string;
}
/** Scheibe 040b: one entry of a whole-list replacement; without `id` the server assigns one. */
export interface AgendaItemInput {
  id?: string;
  number: number;
  title: string;
}
export interface UnitInput {
  id?: string;
  name: string;
  shortName?: string;
}
export interface StageSeatInput {
  id?: string;
  label: string;
  position?: number;
  personId?: string;
  deviceId?: string;
}
export interface AnswerDraft {
  text: string;
  sources?: string[];
}
/** Scheibe 044a: body of `proposeRefusal` (contract `RefusalProposal`, closed). */
export interface RefusalProposal {
  answerKind: 'refusal_no_claim' | 'refusal_with_ground';
  text: string;
  refusalGroundId?: string;
  refusalJustification?: string;
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
