/**
 * SSE framing of the stream (slice 035b): pure functions, no I/O, no clock. Every message is one block
 * with an `event:` line, an `id:` line for `event`, `change` and `cursor` only, and exactly one `data:`
 * line with one JSON document (`JSON.stringify` never emits a raw line break). The contract's
 * `x-sse-messages` of `streamEvents` is the reference.
 */
import { MAX_STREAM_SUBJECTS, STREAM_TOPICS, type StreamChange, type StreamMessage } from '@hv/domain';

export type EndReason = 'session' | 'forbidden' | 'roles_changed' | 'rotate' | 'unavailable';

/** One encoded block; `id` is the SSE id it carries (none for `reset`, `end`, comments and `retry:`). */
export interface Frame {
  readonly bytes: Uint8Array;
  readonly id?: number;
}

const encoder = new TextEncoder();
const encode = (text: string, id?: number): Frame => ({ bytes: encoder.encode(text), ...(id !== undefined ? { id } : {}) });

/** The first line of every stream (contract: `retry: 3000`). */
export const RETRY_FRAME: Frame = encode('retry: 3000\n\n');
/** The heartbeat: a comment line without content. */
export const HEARTBEAT_FRAME: Frame = encode(': heartbeat\n\n');

function message(kind: 'event' | 'change' | 'cursor' | 'reset' | 'end', data: unknown, id?: number): Frame {
  return encode(`event: ${kind}\n${id !== undefined ? `id: ${id}\n` : ''}data: ${JSON.stringify(data)}\n\n`, id);
}

export const messageFrame = (m: StreamMessage): Frame =>
  m.kind === 'event' ? message('event', m.event, m.event.seq) : message('change', m.change, m.change.seq);
export const cursorFrame = (seq: number): Frame => message('cursor', { seq }, seq);
export const resetFrame = (lastSeq: number): Frame => message('reset', { lastSeq });
export const endFrame = (reason: EndReason): Frame => message('end', { reason });

/**
 * Two not yet sent live `change` messages as one (M8): the union of topics and ids, `seq` the higher one.
 * `subjects` only when both name ids and the union stays within 100; otherwise the client reloads the
 * topics as a whole (a missing list is never narrower than the truth). `meetingId` only when both agree.
 */
export function mergeChanges(a: StreamChange, b: StreamChange): StreamChange {
  const topics = new Set([...a.topics, ...b.topics]);
  const subjects = a.subjects !== undefined && b.subjects !== undefined ? [...new Set([...a.subjects, ...b.subjects])] : undefined;
  return {
    seq: Math.max(a.seq, b.seq),
    topics: STREAM_TOPICS.filter((t) => topics.has(t)),
    ...(subjects !== undefined && subjects.length > 0 && subjects.length <= MAX_STREAM_SUBJECTS ? { subjects } : {}),
    ...(a.meetingId !== undefined && a.meetingId === b.meetingId ? { meetingId: a.meetingId } : {}),
  };
}

/**
 * The cursor of a new connection: `Last-Event-ID` wins over `after` (contract). The header's pattern is
 * checked by `validateOperation`; its upper bound (the largest safe integer) is checked here.
 * `undefined`: no cursor. `'invalid'`: 422.
 */
export function parseCursor(lastEventId: string | undefined, after: number | undefined): number | undefined | 'invalid' {
  if (lastEventId !== undefined) {
    if (!/^[0-9]{1,16}$/.test(lastEventId)) return 'invalid';
    const value = Number(lastEventId);
    return Number.isSafeInteger(value) ? value : 'invalid';
  }
  return after;
}
