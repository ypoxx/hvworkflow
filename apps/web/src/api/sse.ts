/**
 * Slice 036b: a pure parser for the stream (`GET /v1/stream`, contract `streamEvents`), without `fetch`, timers or I/O.
 *
 * It follows the WHATWG rules for `text/event-stream` (line ends `\n`, `\r\n` and `\r`, comment lines, `retry:`, `id:`,
 * several `data:` lines), works on bytes so that a line end or a multi-byte character split over two chunks is joined
 * correctly, and fails on a message above 1 MiB (SP-2) instead of growing without bound. Only the five kinds of the
 * contract are passed on; an unknown `event:` kind is skipped (the contract: ignore what you do not know).
 * No content is logged anywhere (SC-11).
 */
import type { ReadEvent, StreamChange } from '@hv/domain';

/** Upper bound of one message (block) in bytes, and of one line still waiting for its end. */
export const MAX_MESSAGE_BYTES = 1_048_576;

export class SseTooLargeError extends Error {
  constructor() { super('Stream message exceeds the size limit.'); }
}

const KINDS = ['event', 'change', 'cursor', 'reset', 'end'] as const;
export type StreamKind = (typeof KINDS)[number];
const KIND_SET: ReadonlySet<string> = new Set(KINDS);

export type SseItem =
  | { kind: 'comment' }
  | { kind: 'retry'; ms: number }
  /** `id`: the block's own `id:` line, if it had one (never for `reset` and `end`). */
  | { kind: 'message'; event: StreamKind; data: string; id: string | undefined };

export interface SseParser {
  /** Feeds the next chunk of the body; returns every complete item in order. Throws `SseTooLargeError`. */
  push(chunk: Uint8Array): SseItem[];
  /** The last event id buffer (WHATWG): set by any `id:` line, kept by blocks without one. */
  readonly lastEventId: string | undefined;
}

const LF = 0x0a;
const CR = 0x0d;

export function createSseParser(): SseParser {
  const decoder = new TextDecoder();
  let pending = new Uint8Array(0); // bytes of a line still waiting for its end
  let skipLf = false; // the previous chunk ended in `\r`: a leading `\n` belongs to that line end
  let firstLine = true; // a byte order mark is stripped from the very first line only
  let lastEventId: string | undefined;
  let eventType = '';
  let data: string[] = [];
  let dataBytes = 0;
  let blockId: string | undefined;

  const resetBlock = (): void => { eventType = ''; data = []; dataBytes = 0; blockId = undefined; };

  const line = (raw: Uint8Array, out: SseItem[]): void => {
    let text = decoder.decode(raw);
    if (firstLine) { firstLine = false; if (text.startsWith('﻿')) text = text.slice(1); }
    if (text === '') {
      if (data.length > 0 && KIND_SET.has(eventType)) {
        out.push({ kind: 'message', event: eventType as StreamKind, data: data.join('\n'), id: blockId });
      }
      resetBlock();
      return;
    }
    if (text.startsWith(':')) { out.push({ kind: 'comment' }); return; }
    const colon = text.indexOf(':');
    const field = colon < 0 ? text : text.slice(0, colon);
    let value = colon < 0 ? '' : text.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') eventType = value;
    else if (field === 'data') {
      dataBytes += raw.byteLength;
      if (dataBytes > MAX_MESSAGE_BYTES) throw new SseTooLargeError();
      data.push(value);
    } else if (field === 'id') {
      if (!value.includes('\u0000')) { lastEventId = value; blockId = value; }
    } else if (field === 'retry') {
      if (/^[0-9]+$/.test(value)) out.push({ kind: 'retry', ms: Number(value) });
    }
  };

  return {
    push(chunk) {
      const out: SseItem[] = [];
      let buffer = chunk;
      if (pending.byteLength > 0) {
        buffer = new Uint8Array(pending.byteLength + chunk.byteLength);
        buffer.set(pending);
        buffer.set(chunk, pending.byteLength);
      }
      let start = 0;
      if (skipLf && buffer[0] === LF) start = 1;
      skipLf = false;
      for (let i = start; i < buffer.byteLength; i += 1) {
        const byte = buffer[i];
        if (byte !== LF && byte !== CR) continue;
        line(buffer.subarray(start, i), out);
        if (byte === CR) {
          if (i + 1 < buffer.byteLength) { if (buffer[i + 1] === LF) i += 1; } else skipLf = true;
        }
        start = i + 1;
      }
      pending = buffer.slice(start);
      if (pending.byteLength + dataBytes > MAX_MESSAGE_BYTES) throw new SseTooLargeError();
      return out;
    },
    get lastEventId() { return lastEventId; },
  };
}

export type EndReason = 'session' | 'forbidden' | 'roles_changed' | 'rotate' | 'unavailable';
const END_REASONS: ReadonlySet<string> = new Set<EndReason>(['session', 'forbidden', 'roles_changed', 'rotate', 'unavailable']);

export type StreamMessage =
  | { kind: 'event'; event: ReadEvent }
  | { kind: 'change'; change: StreamChange }
  | { kind: 'cursor'; seq: number }
  | { kind: 'reset' }
  | { kind: 'end'; reason: EndReason };

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isSeq = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * The JSON document of one message, checked against the contract's shape. `undefined` for a malformed document: the
 * caller then invalidates everything (never too little); nothing from the stream is ever shown.
 */
export function decodeMessage(item: SseItem): StreamMessage | undefined {
  if (item.kind !== 'message') return undefined;
  let body: unknown;
  try { body = JSON.parse(item.data); } catch { return undefined; }
  if (!isObject(body)) return undefined;
  switch (item.event) {
    case 'event':
      return isSeq(body['seq']) && typeof body['type'] === 'string' ? { kind: 'event', event: body as unknown as ReadEvent } : undefined;
    case 'change': {
      const { seq, topics, subjects, meetingId, replay } = body;
      if (!isSeq(seq) || !isStrings(topics) || (subjects !== undefined && !isStrings(subjects))) return undefined;
      return {
        kind: 'change',
        change: {
          seq,
          topics: topics as StreamChange['topics'],
          ...(subjects !== undefined ? { subjects } : {}),
          ...(typeof meetingId === 'string' ? { meetingId } : {}),
          ...(replay === true ? { replay: true as const } : {}),
        },
      };
    }
    case 'cursor':
      return isSeq(body['seq']) ? { kind: 'cursor', seq: body['seq'] } : undefined;
    case 'reset':
      return { kind: 'reset' };
    case 'end': {
      const reason = body['reason'];
      return typeof reason === 'string' && END_REASONS.has(reason) ? { kind: 'end', reason: reason as EndReason } : undefined;
    }
  }
}
