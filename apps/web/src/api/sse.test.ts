import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, SseTooLargeError, createSseParser, decodeMessage, type SseItem } from './sse';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const feed = (parser: ReturnType<typeof createSseParser>, ...chunks: string[]): SseItem[] =>
  chunks.flatMap((chunk) => parser.push(bytes(chunk)));

describe('SSE parser (slice 036b)', () => {
  it('assembles lines and blocks across chunk boundaries, also inside a multi-byte character', () => {
    const parser = createSseParser();
    const whole = bytes('event: cursor\nid: 7\ndata: {"seq":7,"x":"ä"}\n\n');
    const items: SseItem[] = [];
    // One byte at a time: every line and the two-byte "ä" are split.
    for (const byte of whole) items.push(...parser.push(Uint8Array.of(byte)));
    expect(items).toEqual([{ kind: 'message', event: 'cursor', data: '{"seq":7,"x":"ä"}', id: '7' }]);
    expect(parser.lastEventId).toBe('7');
  });

  it('accepts \\r\\n and bare \\r line ends, also with \\r\\n split over two chunks', () => {
    const parser = createSseParser();
    expect(feed(parser, 'event: cursor\r\nid: 1\r\ndata: {"seq":1}\r', '\n\r\n')).toEqual([
      { kind: 'message', event: 'cursor', data: '{"seq":1}', id: '1' },
    ]);
    expect(feed(parser, 'event: cursor\rid: 2\rdata: {"seq":2}\r\r')).toEqual([
      { kind: 'message', event: 'cursor', data: '{"seq":2}', id: '2' },
    ]);
  });

  it('reports comment lines (the heartbeat) and retry, and ignores a malformed retry', () => {
    const parser = createSseParser();
    expect(feed(parser, 'retry: 3000\n\n: heartbeat\n\nretry: 3x\n\n')).toEqual([
      { kind: 'retry', ms: 3000 },
      { kind: 'comment' },
    ]);
  });

  it('keeps an id: without data as the last id but dispatches nothing', () => {
    const parser = createSseParser();
    expect(feed(parser, 'id: 41\n\n')).toEqual([]);
    expect(parser.lastEventId).toBe('41');
  });

  it('joins several data: lines with a line break', () => {
    const parser = createSseParser();
    expect(feed(parser, 'event: change\nid: 3\ndata: {"seq":3,\ndata: "topics":["speakers"]}\n\n')).toEqual([
      { kind: 'message', event: 'change', data: '{"seq":3,\n"topics":["speakers"]}', id: '3' },
    ]);
    expect(decodeMessage({ kind: 'message', event: 'change', data: '{"seq":3,\n"topics":["speakers"]}', id: '3' }))
      .toEqual({ kind: 'change', change: { seq: 3, topics: ['speakers'] } });
  });

  it('skips an unknown event: kind and a block without event: line', () => {
    const parser = createSseParser();
    expect(feed(parser, 'event: notification\nid: 9\ndata: {"x":1}\n\ndata: {"y":2}\n\nevent: cursor\nid: 10\ndata: {"seq":10}\n\n'))
      .toEqual([{ kind: 'message', event: 'cursor', data: '{"seq":10}', id: '10' }]);
  });

  it('does not change the last id with reset or end, which carry none', () => {
    const parser = createSseParser();
    feed(parser, 'event: change\nid: 12\ndata: {"seq":12,"topics":["questions"]}\n\n');
    const items = feed(parser, 'event: reset\ndata: {"lastSeq":99}\n\nevent: end\ndata: {"reason":"rotate"}\n\n');
    expect(items).toEqual([
      { kind: 'message', event: 'reset', data: '{"lastSeq":99}', id: undefined },
      { kind: 'message', event: 'end', data: '{"reason":"rotate"}', id: undefined },
    ]);
    expect(parser.lastEventId).toBe('12');
    expect(items.map(decodeMessage)).toEqual([{ kind: 'reset' }, { kind: 'end', reason: 'rotate' }]);
  });

  it('fails on a message over 1 MiB, also when it arrives in small chunks without a line end', () => {
    const parser = createSseParser();
    const big = 'x'.repeat(64 * 1024);
    expect(() => {
      parser.push(bytes('event: change\ndata: '));
      for (let sent = 0; sent <= MAX_MESSAGE_BYTES; sent += big.length) parser.push(bytes(big));
    }).toThrow(SseTooLargeError);
    // Several data lines that each stay below the limit but add up above it.
    const other = createSseParser();
    const line = `data: ${'y'.repeat(512 * 1024)}\n`;
    expect(() => other.push(bytes(`event: change\n${line}${line}${line}`))).toThrow(SseTooLargeError);
    // Just below the limit passes.
    const fine = createSseParser();
    expect(fine.push(bytes(`event: event\ndata: ${'z'.repeat(1024)}\n\n`))).toHaveLength(1);
  });

  it('decodes the five kinds and rejects malformed documents', () => {
    const at = (event: 'event' | 'change' | 'cursor' | 'reset' | 'end', data: string) =>
      decodeMessage({ kind: 'message', event, data, id: undefined });
    expect(at('cursor', '{"seq":5}')).toEqual({ kind: 'cursor', seq: 5 });
    expect(at('event', '{"seq":6,"type":"SpeakerRegistered"}')).toMatchObject({ kind: 'event', event: { seq: 6 } });
    expect(at('change', '{"seq":7,"topics":["speakers"],"subjects":["s1"]}'))
      .toEqual({ kind: 'change', change: { seq: 7, topics: ['speakers'], subjects: ['s1'] } });
    expect(at('end', '{"reason":"roles_changed"}')).toEqual({ kind: 'end', reason: 'roles_changed' });
    for (const [event, data] of [
      ['cursor', '{"seq":"5"}'], ['cursor', 'not json'], ['event', '{"type":"X"}'], ['change', '{"seq":1}'],
      ['change', '{"seq":1,"topics":"speakers"}'], ['change', '{"seq":1,"topics":[],"subjects":[1]}'],
      ['end', '{"reason":"later"}'], ['reset', '[]'],
    ] as const) {
      expect(at(event, data), `${event} ${data}`).toBeUndefined();
    }
  });
});
