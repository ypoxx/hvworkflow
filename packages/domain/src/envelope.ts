import { sha256 } from '@noble/hashes/sha2.js';
import type { DomainEvent, EventType, NewEvent } from './events.js';
import { identityPiiCodec, type PiiCodec, type PiiEnvelope } from './piiCodec.js';

const EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  'MeetingCreated', 'MeetingStarted', 'MeetingClosed', 'DebateClosed',
  'AgendaItemOpened', 'VotingOpened', 'VotingClosed',
  'SpeakerRegistered', 'SpeakersReordered', 'SpeakerUpdated',
  'RoleAssigned', 'RoleRevoked',
  'ContributionCaptured', 'QuestionCaptured', 'QuestionClassified', 'QuestionAssigned',
  'AnswerDrafted', 'QuestionSubmittedForReview', 'QuestionApproved', 'QuestionLegalCleared',
  'QuestionReturned', 'QuestionStaged', 'QuestionDelivered', 'QuestionClosed',
  'QuestionWithdrawn', 'QuestionMerged',
  'ContributionClaimed', 'ContributionReleased', 'QuestionClaimed', 'QuestionReleased', 'IdempotencyRecorded',
]);
const V2_ONLY_FIELDS = [
  'meetingId', 'idempotencyKey', 'causationId', 'prevHash', 'hash', 'recordedAt',
  'occurredAt', 'occurredAtSource', 'retentionClass', 'legalHold', 'personId',
  'commandId', 'commandOperation', 'commandResource',
] as const;

/**
 * Fields a caller may hand to `stampEvent` (SC-07). Anything else is a programming error and is
 * rejected instead of silently entering the hash chain; `hash`, `prevHash`, `schemaVersion`,
 * `recordedAt` and `legalHold` are accepted only to be overwritten by the store.
 */
const INPUT_FIELDS: ReadonlySet<string> = new Set([
  'seq', 'id', 'type', 'at', 'actor', 'subjectId', 'payload',
  'schemaVersion', 'hash', 'prevHash', 'recordedAt', 'legalHold',
  'meetingId', 'idempotencyKey', 'causationId', 'personId',
  'commandId', 'commandOperation', 'commandResource',
  'occurredAt', 'occurredAtSource', 'retentionClass',
]);
const OPTIONAL_TEXT_FIELDS = ['personId', 'causationId', 'idempotencyKey', 'commandId', 'commandOperation', 'commandResource'] as const;
const MAX_ENVELOPE_TEXT = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function nonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Reject malformed JSONL rows before they can become typed events or projections. */
export function assertEventShape(value: unknown): asserts value is DomainEvent {
  if (!isRecord(value)) throw new Error('event must be an object');
  if (!Number.isSafeInteger(value['seq']) || (value['seq'] as number) < 1) throw new Error('invalid seq');
  if (!nonemptyString(value['id'])) throw new Error('invalid id');
  if (!nonemptyString(value['type']) || !EVENT_TYPES.has(value['type'])) throw new Error('invalid type');
  if (!nonemptyString(value['at'])) throw new Error('invalid at');
  if (!nonemptyString(value['subjectId'])) throw new Error('invalid subjectId');
  if (!isRecord(value['actor']) || !nonemptyString(value['actor']['id']) || !nonemptyString(value['actor']['role'])) {
    throw new Error('invalid actor');
  }
  if (!isRecord(value['payload'])) throw new Error('invalid payload');
}

/** Browser classification only: never offer a destructive reset for a downgraded v2 row. */
export function isLegacyEventShape(value: unknown): boolean {
  try {
    assertEventShape(value);
  } catch {
    return false;
  }
  const event = value as DomainEvent;
  const version: unknown = (event as unknown as Record<string, unknown>)['schemaVersion'];
  return (version === undefined || version === 1) &&
    !V2_ONLY_FIELDS.some((field) => Object.hasOwn(event, field));
}

/** Canonical UTF-8 JSON used by both append and replay. Array order remains meaningful. */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number in event.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item: unknown) => item === undefined ? 'null' : canonicalJson(item)).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const pairs = Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`);
    return `{${pairs.join(',')}}`;
  }
  throw new Error('Unsupported value in event.');
}

function digest(value: unknown): string {
  const bytes = sha256(new TextEncoder().encode(canonicalJson(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function piiPayload(payload: object, meetingId: string | undefined, codec: PiiCodec): object {
  const record = payload as Record<string, unknown>;
  if (record['pii'] === undefined) return payload;
  const pii = record['pii'];
  if (pii === null || typeof pii !== 'object' || Array.isArray(pii) || typeof (pii as Record<string, unknown>)['keyId'] !== 'string') {
    throw new Error('Event payload.pii requires a keyId.');
  }
  return { ...record, pii: codec.encode(meetingId, pii as PiiEnvelope) };
}

/** Add the v2 envelope after seq is known; never trust a caller-provided hash. */
export function stampEvent(
  event: NewEvent,
  seq: number,
  prevHash: string,
  meetingId?: string,
  codec: PiiCodec = identityPiiCodec,
): DomainEvent {
  const input = event as NewEvent & Record<string, unknown>;
  if (Object.keys(input).some((key) => !INPUT_FIELDS.has(key))) throw new Error(`Event seq ${seq}: unknown envelope field.`);
  for (const field of OPTIONAL_TEXT_FIELDS) {
    const value = input[field];
    // commandResource may be the empty string (a command without a resource id); the others may not.
    if (value !== undefined && (typeof value !== 'string' || value.length > MAX_ENVELOPE_TEXT ||
        (value.length === 0 && field !== 'commandResource'))) {
      throw new Error(`Event seq ${seq}: invalid optional envelope field.`);
    }
  }
  for (const field of ['id', 'subjectId'] as const) {
    const value = input[field];
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_ENVELOPE_TEXT) {
      throw new Error(`Event seq ${seq}: invalid optional envelope field.`);
    }
  }
  const recordedAt = event.at;
  const recordedMs = Date.parse(recordedAt);
  const source = input['occurredAtSource'] ?? 'server';
  const occurredAt = input['occurredAt'] ?? recordedAt;
  const occurredMs = typeof occurredAt === 'string' ? Date.parse(occurredAt) : Number.NaN;
  if (!Number.isFinite(recordedMs) || !Number.isFinite(occurredMs) || occurredMs > recordedMs) {
    throw new Error(`Event seq ${seq}: invalid or future occurrence time.`);
  }
  if (!['server', 'device', 'paper', 'transcript'].includes(String(source)) ||
      (source === 'server' && occurredAt !== recordedAt) ||
      (source !== 'server' && input['occurredAt'] === undefined)) {
    throw new Error(`Event seq ${seq}: invalid occurrence source/time pair.`);
  }
  const explicitMeetingId = input['meetingId'];
  if (explicitMeetingId !== undefined && (typeof explicitMeetingId !== 'string' || explicitMeetingId.length === 0 ||
      explicitMeetingId.length > MAX_ENVELOPE_TEXT)) throw new Error(`Event seq ${seq}: invalid meetingId.`);
  const retentionClass = input['retentionClass'] ?? 'working';
  if (!['record', 'working', 'technical'].includes(String(retentionClass))) {
    throw new Error(`Event seq ${seq}: invalid retention class.`);
  }
  // Pre-024 JSONL prefixes may consist solely of standalone facts. Give those a deterministic
  // synthetic scope during upcast; new API writes always supply their real year id.
  const effectiveMeetingId = explicitMeetingId ?? meetingId ?? (event.type === 'MeetingCreated' ? event.subjectId : 'legacy-unscoped');
  const named: Record<string, unknown> = {};
  for (const key of ['id', 'type', 'at', 'subjectId', ...OPTIONAL_TEXT_FIELDS] as const) {
    if (input[key] !== undefined) named[key] = input[key];
  }
  const envelope = {
    ...named,
    seq,
    actor: { id: event.actor.id, role: event.actor.role },
    payload: piiPayload(event.payload, effectiveMeetingId, codec),
    schemaVersion: 2,
    ...(effectiveMeetingId !== undefined ? { meetingId: effectiveMeetingId } : {}),
    prevHash,
    recordedAt,
    occurredAt,
    occurredAtSource: source,
    retentionClass,
    legalHold: false,
  };
  return { ...envelope, hash: digest(envelope) } as DomainEvent;
}

/**
 * Where a chain check starts (takt-033): the seq and hash of the last event already verified. The
 * default `{ seq: 0, prevHash: '' }` checks a whole log from its first event.
 */
export interface ChainStart {
  seq: number;
  prevHash: string;
}

const WHOLE_LOG: ChainStart = { seq: 0, prevHash: '' };

// Process-wide count of events whose hash `verifyEventChain` recomputed. Read-only from outside
// (`verifiedEventCount`); tests and the service's test hook use deltas around synchronous calls.
let hashedEvents = 0;

/** How many events `verifyEventChain` has hashed in this process so far (monotonic, for tests). */
export function verifiedEventCount(): number {
  return hashedEvents;
}

/** Check every link before projecting or serving a persisted log. */
export function verifyEventChain(events: readonly DomainEvent[], start: ChainStart = WHOLE_LOG): void {
  if (!Number.isSafeInteger(start.seq) || start.seq < 0 || typeof start.prevHash !== 'string' ||
      (start.seq === 0) !== (start.prevHash === '')) {
    throw new Error(`Event seq ${Number.isSafeInteger(start.seq) ? start.seq + 1 : 1}: integrity check failed (invalid start).`);
  }
  let previousHash = start.prevHash;
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    const seq = start.seq + index + 1;
    try {
      assertEventShape(event);
      if (event.seq !== seq || event.schemaVersion !== 2 || event.prevHash !== previousHash) throw new Error('sequence or predecessor');
      if (!nonemptyString(event.meetingId) || !nonemptyString(event.recordedAt) ||
          !nonemptyString(event.occurredAt) || !nonemptyString(event.hash) ||
          typeof event.legalHold !== 'boolean' || !nonemptyString(event.retentionClass) ||
          !nonemptyString(event.occurredAtSource)) throw new Error('required v2 envelope fields');
      if ([event.commandId, event.commandOperation, event.commandResource].some((field) => field !== undefined) &&
          (!nonemptyString(event.commandId) || !nonemptyString(event.commandOperation) || typeof event.commandResource !== 'string')) {
        throw new Error('incomplete command envelope');
      }
      if (Object.hasOwn(event.actor, 'displayName')) throw new Error('actor.displayName forbidden in v2');
      if (event.at !== event.recordedAt || event.legalHold !== false ||
          !['record', 'working', 'technical'].includes(String(event.retentionClass)) ||
          !['server', 'device', 'paper', 'transcript'].includes(String(event.occurredAtSource)) ||
          !/^[0-9a-f]{64}$/.test(event.hash ?? '')) throw new Error('envelope fields');
      const recordedMs = Date.parse(event.recordedAt);
      const occurredMs = Date.parse(event.occurredAt ?? '');
      if (!Number.isFinite(recordedMs) || !Number.isFinite(occurredMs) || occurredMs > recordedMs) throw new Error('time');
      if (event.occurredAtSource === 'server' && event.occurredAt !== event.recordedAt) throw new Error('server time');
      const { hash, ...withoutHash } = event;
      hashedEvents += 1;
      if (digest(withoutHash) !== hash) throw new Error('hash');
      previousHash = hash;
    } catch (error) {
      throw new Error(`Event seq ${seq}: integrity check failed (${error instanceof Error ? error.message : String(error)}).`);
    }
  }
}

declare const verifiedBrand: unique symbol;

/**
 * An event log this module has verified and frozen (takt-033). Only `sealVerifiedLog` produces one;
 * the brand is a type, the proof is membership in the module-private `WeakSet` below.
 */
export type VerifiedEventLog = readonly DomainEvent[] & { readonly [verifiedBrand]: true };

const verifiedLogs = new WeakSet<object>();

// Walks every child even below an already frozen object: a shallow `Object.freeze` by a caller must
// not leave a mutable payload behind a verified hash.
function deepFreeze(value: unknown, seen: Set<object> = new Set()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
}

/** Whether `value` is exactly an array returned by `sealVerifiedLog` (a copy is not). */
export function isVerifiedLog(value: unknown): value is VerifiedEventLog {
  return typeof value === 'object' && value !== null && verifiedLogs.has(value);
}

/**
 * Verify `suffix` as the continuation of an already sealed `prefix` (or as a whole log without one),
 * then return prefix plus suffix as a new, deeply frozen, sealed log. The suffix events are frozen
 * *before* they are checked, so what was verified is what stays in the log. A failed check throws
 * (naming the seq) and seals nothing; the frozen suffix objects are then simply not part of any log.
 * There is no flag to skip the check: `createInMemoryEventStore` trusts only arrays sealed here.
 */
export function sealVerifiedLog(prefix: VerifiedEventLog | undefined, suffix: readonly DomainEvent[]): VerifiedEventLog {
  if (prefix !== undefined && !isVerifiedLog(prefix)) throw new Error('Only a sealed event log can be extended.');
  const events = [...suffix];
  for (const event of events) deepFreeze(event);
  const last = prefix?.at(-1);
  verifyEventChain(events, last === undefined ? WHOLE_LOG : { seq: prefix!.length, prevHash: last.hash ?? '' });
  const sealed = Object.freeze([...(prefix ?? []), ...events]);
  verifiedLogs.add(sealed);
  return sealed as unknown as VerifiedEventLog;
}

/** Only the JSONL dev adapter calls this; demo localStorage never upcasts. */
export function upcastJsonlEvents(events: readonly DomainEvent[]): DomainEvent[] {
  const result: DomainEvent[] = [];
  let meetingId: string | undefined;
  let sawV2 = false;
  for (const [index, event] of events.entries()) {
    const seq = index + 1;
    try {
      assertEventShape(event);
    } catch (error) {
      throw new Error(`Event seq ${seq}: ${error instanceof Error ? error.message : String(error)}.`);
    }
    if (event.schemaVersion === 2) {
      sawV2 = true;
      result.push(event);
    } else if (event.schemaVersion === undefined || event.schemaVersion === 1) {
      if (sawV2) throw new Error(`Event seq ${seq}: v1 event after v2 suffix.`);
      if (V2_ONLY_FIELDS.some((field) => Object.hasOwn(event, field))) {
        throw new Error(`Event seq ${seq}: incomplete v2 envelope cannot be upcast as v1.`);
      }
      result.push(stampEvent(event, event.seq, result.at(-1)?.hash ?? '', meetingId));
    } else {
      throw new Error(`Event seq ${seq}: unsupported schemaVersion.`);
    }
    if (event.type === 'MeetingCreated') meetingId = event.subjectId;
  }
  verifyEventChain(result);
  return result;
}
