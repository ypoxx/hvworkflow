/**
 * Test reader for open SSE streams (slice 035b, m5). A stream never ends on its own, so the helpers
 * here open it, parse the `text/event-stream` framing block by block and let a test wait for the next
 * block, for a matching block, or for the end of the stream, each with a time limit.
 *
 * The stream is opened through `req()` from `helpers.ts` (unchanged): `req()` checks status, media
 * type and headers against the contract and does not buffer an event stream (`readBodyFor`), so a
 * `200` counts as the coverage hit of `streamEvents`. Error answers end and are read the usual way.
 */
import type { App } from '../app.ts';
import { req } from './helpers.ts';

/** One SSE block: the `retry:` line, a comment (heartbeat) or a message with `event:`, `id:`, `data:`. */
export interface SseBlock {
  readonly raw: string;
  readonly retry?: number;
  readonly comment?: string;
  readonly event?: string;
  readonly id?: string;
  readonly data?: unknown;
  /** Number of `data:` lines (the contract allows exactly one). */
  readonly dataLines: number;
}

export function parseBlock(raw: string): SseBlock {
  let retry: number | undefined;
  let comment: string | undefined;
  let event: string | undefined;
  let id: string | undefined;
  let data: unknown;
  let dataLines = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) comment = line.slice(1).trim();
    else if (line.startsWith('retry:')) retry = Number(line.slice(6).trim());
    else if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('data:')) { dataLines += 1; data = JSON.parse(line.slice(5).trim()); }
  }
  return { raw, dataLines,
    ...(retry !== undefined ? { retry } : {}), ...(comment !== undefined ? { comment } : {}),
    ...(event !== undefined ? { event } : {}), ...(id !== undefined ? { id } : {}),
    ...(dataLines > 0 ? { data } : {}) };
}

export interface ReaderOptions {
  /** Pause after every chunk read: a slow client (backpressure test). */
  pauseMs?: number;
}

export class StreamReader {
  readonly blocks: SseBlock[] = [];
  closed = false;
  bytes = 0;
  private buffer = '';
  private cursor = 0;
  private waiters: (() => void)[] = [];
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly decoder = new TextDecoder();

  constructor(readonly res: Response, private readonly options: ReaderOptions = {}) {
    this.reader = res.body!.getReader();
    void this.pump();
  }

  private wake(): void {
    const waiting = this.waiters;
    this.waiters = [];
    for (const wake of waiting) wake();
  }

  private async pump(): Promise<void> {
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this.bytes += value.byteLength;
        this.buffer += this.decoder.decode(value, { stream: true });
        let end = this.buffer.indexOf('\n\n');
        while (end !== -1) {
          const raw = this.buffer.slice(0, end);
          this.buffer = this.buffer.slice(end + 2);
          if (raw !== '') this.blocks.push(parseBlock(raw));
          end = this.buffer.indexOf('\n\n');
        }
        this.wake();
        if (this.options.pauseMs !== undefined) await new Promise((resolve) => setTimeout(resolve, this.options.pauseMs));
      }
    } catch { /* cancelled or aborted: treated as closed */ }
    this.closed = true;
    this.wake();
  }

  private waitForChange(deadline: number): Promise<boolean> {
    return new Promise((resolve) => {
      const left = deadline - performance.now();
      if (left <= 0) { resolve(false); return; }
      const timer = setTimeout(() => resolve(false), left);
      this.waiters.push(() => { clearTimeout(timer); resolve(true); });
    });
  }

  /** The next block not yet returned; `null` when the stream closed first. Throws after `timeoutMs`. */
  async next(timeoutMs = 3_000): Promise<SseBlock | null> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      if (this.cursor < this.blocks.length) return this.blocks[this.cursor++]!;
      if (this.closed) return null;
      if (!await this.waitForChange(deadline) && this.cursor >= this.blocks.length && !this.closed) {
        throw new Error(`No SSE block within ${timeoutMs} ms (received ${this.blocks.length}).`);
      }
    }
  }

  /** The next message block (skips comments and the `retry:` line). */
  async nextMessage(timeoutMs = 3_000): Promise<SseBlock | null> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const block = await this.next(Math.max(1, deadline - performance.now()));
      if (block === null || block.event !== undefined) return block;
    }
  }

  /** Skips blocks until `match`; throws when the stream closes or the time runs out first. */
  async until(match: (block: SseBlock) => boolean, timeoutMs = 3_000): Promise<SseBlock> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const block = await this.next(Math.max(1, deadline - performance.now()));
      if (block === null) throw new Error('Stream closed before the expected block.');
      if (match(block)) return block;
    }
  }

  /** Every message block up to and including the one `match` accepts. */
  async messagesUntil(match: (block: SseBlock) => boolean, timeoutMs = 3_000): Promise<SseBlock[]> {
    const out: SseBlock[] = [];
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const block = await this.next(Math.max(1, deadline - performance.now()));
      if (block === null) throw new Error(`Stream closed before the expected block (got ${out.map((b) => b.event).join(',')}).`);
      if (block.event !== undefined) out.push(block);
      if (match(block)) return out;
    }
  }

  /** Waits until the stream is closed; returns the message blocks not yet returned. Throws after `timeoutMs`. */
  async rest(timeoutMs = 3_000): Promise<SseBlock[]> {
    const out: SseBlock[] = [];
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      const block = await this.next(Math.max(1, deadline - performance.now()));
      if (block === null) return out;
      if (block.event !== undefined) out.push(block);
    }
  }

  /** Every message block that arrives within `ms` (the stream stays open). */
  async during(ms: number): Promise<SseBlock[]> {
    const out: SseBlock[] = [];
    const deadline = performance.now() + ms;
    for (;;) {
      if (this.cursor < this.blocks.length) {
        const block = this.blocks[this.cursor++]!;
        if (block.event !== undefined) out.push(block);
        continue;
      }
      if (this.closed || !await this.waitForChange(deadline)) return out;
    }
  }

  async cancel(): Promise<void> {
    await this.reader.cancel().catch(() => undefined);
    this.closed = true;
  }
}

export interface Opened {
  res: Response;
  /** Present for a `200` event stream. */
  reader?: StreamReader;
}

/** Opens `/v1/stream…` through `req()`; a `200` gets a reader, any other status is returned as it is. */
export async function openStream(app: App, path: string, headers: Record<string, string> = {}, options: ReaderOptions = {}): Promise<Opened> {
  const res = await req(app, 'GET', path, { headers });
  if (res.status !== 200) return { res };
  return { res, reader: new StreamReader(res, options) };
}

/** Opens and expects a `200`. */
export async function mustOpen(app: App, path: string, headers: Record<string, string> = {}, options: ReaderOptions = {}): Promise<StreamReader> {
  const opened = await openStream(app, path, headers, options);
  if (opened.reader === undefined) throw new Error(`Expected 200, got ${opened.res.status}: ${await opened.res.text()}`);
  return opened.reader;
}

export const idOf = (block: SseBlock): number => Number(block.id);
export const seqOf = (block: SseBlock): number => (block.data as { seq: number }).seq;
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `check` until it holds; throws after `timeoutMs`. */
export async function eventually(check: () => boolean, timeoutMs = 3_000, what = 'condition'): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!check()) {
    if (performance.now() > deadline) throw new Error(`Timed out waiting for ${what}.`);
    await sleep(10);
  }
}
