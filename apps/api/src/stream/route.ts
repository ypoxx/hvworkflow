/**
 * `GET /v1/stream` (slice 035b): opening, pre-checks, limits and reservation, the handover from catch-up
 * to live, and the delivery per connection with backpressure. Visibility per reader is the domain's
 * (R-PERM-04, `visibleMessages` / `replayMessage` with `can()`); this file only decides when to ask and
 * what to do with the answer. No role name appears here.
 *
 * Order on open (decision 1, m7): the existing middleware (access log, security headers, CORS, request
 * timeout, source, body limit, actor, subject limits) and `validateOperation('streamEvents')` run before
 * this handler. Then: pre-checks without a transaction (Postgres), the reservation (synchronous, right
 * after the count checks), a fresh distributor projection when needed, the reader's actors per meeting,
 * and the `200`. The session token stays in this closure: it is never logged, never put into an error or
 * a message, and never handed to the distributor or the session checker (they get a key and a function).
 */
import type { Context } from 'hono';
import {
  ApiProblem,
  can,
  maskEvent,
  replayMessage,
  resolveMeetingActor,
  resolveReaderActors,
  visibleMessages,
  type Actor,
  type DomainEvent,
  type StreamChange,
  type StreamMessage,
  type StreamStates,
} from '@hv/domain';
import { tokenHash } from '../auth/sessions.ts';
import type { StreamLimits } from '../limits/config.ts';
import { STREAM_RETRY_AFTER_SECONDS } from '../limits/config.ts';
import { currentRequest } from '../observability/context.ts';
import { isPersistenceBusy, PostgresIntegrityError } from '../persistence/postgres.ts';
import { problemResponse } from '../problem.ts';
import { getValidatedQuery, type Variables } from '../validate.ts';
import { MissingHashError, type Hub, type HubConnection, type HubTerminal } from './hub.ts';
import type { SessionChecker } from './sessionCheck.ts';
import {
  cursorFrame, endFrame, HEARTBEAT_FRAME, messageFrame, mergeChanges, parseCursor, resetFrame, RETRY_FRAME,
  type Frame,
} from './sse.ts';

export interface StreamRouteOptions {
  hub: Hub;
  sessionChecks: SessionChecker;
  limits: StreamLimits;
  clock: () => Date;
  /** The actor the actor stage resolved for this request. */
  actor: () => Actor;
  /**
   * Session sign-in: the token of the request's cookie and a fresh read of that session without extending
   * its idle window (`readSession(token, clock(), false)`). Absent in the demo header mode (tests only).
   */
  session?: { token: (c: Context) => string | null; valid: (token: string) => Promise<boolean> };
  /** Postgres: migration status and runtime rights, without a transaction. A response means "answer this". */
  precheck?: () => Promise<Response | undefined>;
  notice: (text: string) => void;
  /** Tests only: awaited between reading the head and writing the catch-up (test 13a). */
  handoverHook?: () => Promise<void>;
}

const UNAVAILABLE_LINE = 'HV-Tool API: stream ended (unavailable).';

export function streamUnavailable(detail: 'The stream limit is reached.' | 'Migrations are pending.' | 'Persistence is busy.' |
  'The event log cannot be verified.'): Response {
  return problemResponse(new ApiProblem(503, 'Service Unavailable', detail), { 'Retry-After': String(STREAM_RETRY_AFTER_SECONDS) });
}
const tooManyStreams = (): Response =>
  problemResponse(new ApiProblem(429, 'Too Many Requests', 'Too many open streams. Try again later.'),
    { 'Retry-After': String(STREAM_RETRY_AFTER_SECONDS) });

/** Two actor maps are the same reference: the same meetings with the same role, unit, person and scope. */
function sameActors(a: ReadonlyMap<string, Actor>, b: ReadonlyMap<string, Actor>): boolean {
  if (a.size !== b.size) return false;
  for (const [meetingId, x] of a) {
    const y = b.get(meetingId);
    if (!y || x.id !== y.id || x.role !== y.role || x.unitId !== y.unitId || x.personId !== y.personId ||
        x.assignmentScoped !== y.assignmentScoped) return false;
  }
  return true;
}

/** Counts of open streams; a slot is taken synchronously and released exactly once. */
class Reservations {
  private total = 0;
  private readonly perSession = new Map<string, number>();
  private readonly perSubject = new Map<string, number>();
  constructor(private readonly limits: StreamLimits) {}

  take(sessionKey: string, subjectId: string): { release: () => void } | 'session' | 'subject' | 'process' {
    if ((this.perSession.get(sessionKey) ?? 0) >= this.limits.perSession) return 'session';
    if ((this.perSubject.get(subjectId) ?? 0) >= this.limits.perSubject) return 'subject';
    if (this.total >= this.limits.perProcess) return 'process';
    this.total += 1;
    this.perSession.set(sessionKey, (this.perSession.get(sessionKey) ?? 0) + 1);
    this.perSubject.set(subjectId, (this.perSubject.get(subjectId) ?? 0) + 1);
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.total -= 1;
        const drop = (map: Map<string, number>, key: string): void => {
          const left = (map.get(key) ?? 1) - 1;
          if (left <= 0) map.delete(key);
          else map.set(key, left);
        };
        drop(this.perSession, sessionKey);
        drop(this.perSubject, subjectId);
      },
    };
  }
}

type Item =
  | { kind: 'batch'; events: Frame[]; change?: StreamChange; occasion: string }
  | { kind: 'heartbeat'; head: number; occasion: string };

interface ConnectionSetup {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  reference: ReadonlyMap<string, Actor>;
  resolveActors: (states: StreamStates) => ReadonlyMap<string, Actor>;
  meetingFilter: string | undefined;
  checkSession: ((occasion: string) => Promise<boolean>) | undefined;
  release: () => void;
  limits: StreamLimits;
  clock: () => Date;
  hub: Hub;
  notice: (text: string) => void;
}

let connectionCounter = 0;

/**
 * One open stream. States: `handover` (registered, the catch-up is being written; applied batches are
 * queued), `live` (the queue drains as batches arrive), `closed`. The queue holds only messages not yet
 * sent; its limit counts them (decision 5, M8). Every batch is checked right before it is written:
 * the actors from the distributor's projection when it arrives, the session when it is written.
 */
class Connection implements HubConnection {
  private state: 'handover' | 'live' | 'closed' = 'handover';
  private queue: Item[] = [];
  private draining = false;
  private lastSentId = -1;
  private heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  private rotateTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeats = 0;
  /** A rights and session check started by the heartbeat while the catch-up is written (review major 1). */
  private handoverCheck: Promise<boolean> | undefined;
  private readonly id = ++connectionCounter;
  private readonly openedAt: number;

  constructor(private readonly s: ConnectionSetup) {
    this.openedAt = s.clock().getTime();
    // A client that goes away (cancel, reset of the socket) errors the writer: free everything at once.
    s.writer.closed.then(() => this.close(null), () => this.close(null));
  }

  get closed(): boolean { return this.state === 'closed'; }

  /**
   * Started at registration, not after the catch-up (review major 1): a reader that stalls the catch-up
   * must not keep a stream past its lifetime, a sign-out, a block or a lost grant.
   */
  startTimers(): void {
    const { heartbeatMs, lifetimeMs } = this.s.limits;
    // Staggered heartbeats (decision 4): a start offset per stream within one interval.
    const beat = (delay: number): void => {
      this.heartbeatTimer = setTimeout(() => {
        if (this.closed) return;
        // Catch-up being written, or a live batch being written (the writer may hang behind a stalled reader):
        // check directly; the queued heartbeat item would wait behind the hanging write (re-check major).
        if (this.state === 'handover' || this.draining) this.checkDuringHandover();
        else this.enqueueHeartbeat();
        beat(heartbeatMs);
      }, delay);
    };
    beat(1 + Math.floor(Math.random() * heartbeatMs));
    this.rotateTimer = setTimeout(() => this.close(endFrame('rotate')), lifetimeMs);
  }

  /** From the distributor, synchronously per applied batch. */
  onBatch(batch: readonly DomainEvent[], before: StreamStates, after: StreamStates): void {
    if (this.closed) return;
    // Rights at delivery time (M4, M6): the actors per meeting from the distributor's projection including
    // this batch, with the clock now. Any deviation ends the stream; nothing of this batch is delivered.
    const current = this.s.resolveActors(after);
    if (current.size === 0) { this.close(endFrame('forbidden')); return; }
    if (!sameActors(current, this.s.reference)) { this.close(endFrame('roles_changed')); return; }
    const events = this.s.meetingFilter === undefined ? batch : batch.filter((e) => e.meetingId === this.s.meetingFilter);
    if (events.length === 0) return;
    let failed = false;
    const messages = visibleMessages(current, events, before, after, { can, onIntegrityError: () => { failed = true; } });
    if (failed) { this.close(endFrame('unavailable')); this.s.notice(UNAVAILABLE_LINE); return; }
    if (messages.length === 0) return;
    // The occasion names the batch (its last global seq): the streams of one session share one check for it.
    this.enqueueBatch(messages, `b:${batch.at(-1)!.seq}`);
  }

  onTerminal(terminal: HubTerminal): void {
    this.close(terminal.kind === 'reset' ? resetFrame(terminal.lastSeq) : endFrame('unavailable'));
  }

  private enqueueBatch(messages: readonly StreamMessage[], occasion: string): void {
    const events = messages.flatMap((m) => (m.kind === 'event' ? [messageFrame(m)] : []));
    const change = messages.find((m) => m.kind === 'change')?.change;
    const last = this.queue.at(-1);
    if (last?.kind === 'batch') {
      // Not yet sent: fold into the queued batch (changes merge; one session check covers both, and it runs
      // after both were applied, so it is fresh for both).
      last.events.push(...events);
      if (change !== undefined) last.change = last.change === undefined ? change : mergeChanges(last.change, change);
      last.occasion = occasion;
    } else {
      this.queue.push({ kind: 'batch', events, ...(change !== undefined ? { change } : {}), occasion });
    }
    if (this.overLimit()) {
      // Over the backlog: close without a message; the client resumes with its last id, without a gap.
      this.close(null);
      return;
    }
    this.pump();
  }

  /**
   * While the catch-up or a live batch is written, the heartbeat checks directly: lifetime,
   * the actor map from the distributor's projection and a fresh session check. A failure closes with the
   * matching `end`; the catch-up waits for a running check after every write (`catchUpMayGoOn`).
   */
  private checkDuringHandover(): void {
    if (this.handoverCheck !== undefined) return;
    const run = (async () => {
      if (!this.heartbeatRights()) return false;
      return this.sessionValid(`h:${this.id}:${++this.heartbeats}`);
    })();
    this.handoverCheck = run;
    const clear = (): void => { if (this.handoverCheck === run) this.handoverCheck = undefined; };
    run.then(clear, clear);
  }

  /** Before each frame (catch-up and live): a heartbeat check that runs meanwhile must pass first. */
  async catchUpMayGoOn(): Promise<boolean> {
    if (this.handoverCheck !== undefined && !await this.handoverCheck.catch(() => false)) return false;
    return !this.closed;
  }

  private enqueueHeartbeat(): void {
    if (this.queue.some((item) => item.kind === 'heartbeat')) return;
    this.queue.push({ kind: 'heartbeat', head: this.s.hub.head(), occasion: `h:${this.id}:${++this.heartbeats}` });
    this.pump();
  }

  /** Frames of the batch being written that are not written yet (Codex P2: they count toward the backlog). */
  private inFlight = { count: 0, bytes: 0 };

  private overLimit(): boolean {
    let count = this.inFlight.count;
    let bytes = this.inFlight.bytes;
    for (const item of this.queue) {
      if (item.kind !== 'batch') continue;
      count += item.events.length + (item.change !== undefined ? 1 : 0);
      bytes += item.events.reduce((sum, f) => sum + f.bytes.byteLength, 0) + (item.change !== undefined ? JSON.stringify(item.change).length + 64 : 0);
    }
    return count > this.s.limits.backlogMessages || bytes > this.s.limits.backlogBytes;
  }

  /** Writes with backpressure: resolves when the reader took the bytes. `false` when the connection is gone. */
  async write(frame: Frame): Promise<boolean> {
    if (this.closed) return false;
    try {
      await this.s.writer.write(frame.bytes);
    } catch {
      this.close(null);
      return false;
    }
    if (frame.id !== undefined) this.lastSentId = Math.max(this.lastSentId, frame.id);
    return !this.closed;
  }

  /** The catch-up is written: drain what arrived meanwhile and go live in the same synchronous step. */
  goLive(): void {
    if (this.closed) return;
    this.draining = false;
    this.pump(true);
  }

  private pump(force = false): void {
    if (this.closed || this.draining || (this.state === 'handover' && !force)) return;
    this.draining = true;
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (!this.closed) {
      const item = this.queue.shift();
      if (item === undefined) {
        // Queue empty: live from here on (same synchronous step as taking the last item).
        this.state = 'live';
        this.draining = false;
        return;
      }
      if (item.kind === 'batch') {
        // Rights at the moment of writing too (review minor 3): a grant may have expired by the clock since
        // the batch was applied, while the reader was slow.
        if (!this.rightsNow()) return;
        if (!await this.sessionValid(item.occasion)) return;
        const frames = [...item.events, ...(item.change !== undefined ? [messageFrame({ kind: 'change', change: item.change })] : [])];
        this.inFlight = { count: frames.length, bytes: frames.reduce((sum, f) => sum + f.bytes.byteLength, 0) };
        for (const frame of frames) {
          // An id is never lower than or equal to one already sent on this connection.
          if (frame.id === undefined || frame.id > this.lastSentId) {
            if (!await this.catchUpMayGoOn()) return;
            if (!await this.write(frame)) return;
          }
          // Written (or skipped): no longer part of the backlog.
          this.inFlight = { count: this.inFlight.count - 1, bytes: this.inFlight.bytes - frame.bytes.byteLength };
        }
        this.inFlight = { count: 0, bytes: 0 };
      } else {
        if (!this.heartbeatRights()) return;
        if (!await this.sessionValid(item.occasion)) return;
        if (!await this.catchUpMayGoOn()) return;
        if (!await this.write(HEARTBEAT_FRAME)) return;
        // The head moved on through events this reader cannot see: a cursor with the heartbeat.
        if (item.head > this.lastSentId && !await this.write(cursorFrame(item.head))) return;
      }
    }
  }

  private heartbeatRights(): boolean {
    if (this.s.clock().getTime() - this.openedAt >= this.s.limits.lifetimeMs) {
      this.close(endFrame('rotate'));
      return false;
    }
    return this.rightsNow();
  }

  /** The actor map from the distributor's projection with the clock now, against the reference of the open. */
  private rightsNow(): boolean {
    const current = this.s.resolveActors(this.s.hub.states());
    if (current.size === 0) { this.close(endFrame('forbidden')); return false; }
    if (!sameActors(current, this.s.reference)) { this.close(endFrame('roles_changed')); return false; }
    return true;
  }

  private async sessionValid(occasion: string): Promise<boolean> {
    if (this.s.checkSession === undefined) return !this.closed;
    let valid: boolean;
    try {
      valid = await this.s.checkSession(occasion);
    } catch {
      // The check itself failed (database, timeout): fail closed.
      this.s.notice(UNAVAILABLE_LINE);
      this.close(endFrame('unavailable'));
      return false;
    }
    if (this.closed) return false;
    if (!valid) {
      this.close(endFrame('session'));
      return false;
    }
    return true;
  }

  /**
   * Ends the connection once: the queue is dropped (a terminal message has priority), the slot and the
   * registration are released at once. With a frame: written after anything already on its way, then
   * the stream is closed; a reader that does not take it within `endDrainMs` gets the stream aborted, so a
   * reader that never reads cannot keep sockets and buffered frames outside the limits. Without a frame: the
   * stream is aborted (client gone, backlog over the limit).
   */
  close(frame: Frame | null): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    this.queue = [];
    if (this.heartbeatTimer !== undefined) clearTimeout(this.heartbeatTimer);
    if (this.rotateTimer !== undefined) clearTimeout(this.rotateTimer);
    this.s.hub.unregister(this);
    this.s.release();
    if (frame !== null) {
      const drain = setTimeout(() => { this.s.writer.abort().catch(() => undefined); }, this.s.limits.endDrainMs);
      const settled = (): void => clearTimeout(drain);
      this.s.writer.write(frame.bytes).catch(() => undefined);
      this.s.writer.close().then(settled, settled);
    } else {
      this.s.writer.abort().catch(() => undefined);
    }
  }
}

export function createStreamRoute(options: StreamRouteOptions): (c: Context<{ Variables: Variables }>) => Promise<Response> {
  const reservations = new Reservations(options.limits);
  const { hub, clock } = options;

  return async (c) => {
    const query = getValidatedQuery(c);
    const cursor = parseCursor(c.req.header('Last-Event-ID'), query['after'] as number | undefined);
    if (cursor === 'invalid') throw new ApiProblem(422, 'Unprocessable', 'header parameter "Last-Event-ID": must be at most 9007199254740991');
    const meetingFilter = query['meetingId'] as string | undefined;
    const actor = options.actor();

    // Pre-checks as in the Postgres boundary, without a transaction (m7).
    if (options.precheck) {
      try {
        const answer = await options.precheck();
        if (answer !== undefined) return answer;
      } catch (error) {
        if (isPersistenceBusy(error)) return streamUnavailable('Persistence is busy.');
        return problemResponse(new ApiProblem(500, 'Internal Server Error', 'Persistence is unavailable.'));
      }
    }

    // Reservation (m4): count checks and the reservation in one synchronous step.
    const token = options.session?.token(c) ?? null;
    if (options.session !== undefined && token === null) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    const sessionKey = token !== null ? `session:${tokenHash(token)}` : `actor:${actor.id}`;
    const slot = reservations.take(sessionKey, actor.id);
    if (slot === 'session' || slot === 'subject') return tooManyStreams();
    if (slot === 'process') return streamUnavailable('The stream limit is reached.');
    let handedOver = false;
    try {
      try {
        await hub.ensureFresh();
        // A cursor beyond the head may name a write of another instance this one has not loaded yet.
        if (cursor !== undefined && cursor > hub.head()) await hub.ensureFresh(true);
      } catch (error) {
        if (error instanceof PostgresIntegrityError) {
          return problemResponse(new ApiProblem(500, 'Internal Server Error', `Event seq ${error.seq}: integrity check failed.`));
        }
        if (isPersistenceBusy(error)) return streamUnavailable('Persistence is busy.');
        // The distributor's log has an event without hash: nothing can be delivered reliably now (m6).
        if (error instanceof MissingHashError) return streamUnavailable('The event log cannot be verified.');
        return problemResponse(new ApiProblem(500, 'Internal Server Error', 'Persistence is unavailable.'));
      }
      // The request timeout answered already (408): open nothing.
      if (currentRequest()?.phase === 'timedOut') return new Response(null, { status: 408 });

      // The reader's actor per meeting from the distributor's projection (035a `resolveReaderActors`); in
      // the demo header mode the header actor per meeting, resolved like every request of that mode.
      const resolveActors = options.session !== undefined
        ? (states: StreamStates) => resolveReaderActors(states, actor.id, clock)
        : (states: StreamStates) => {
          const out = new Map<string, Actor>();
          for (const [meetingId, state] of states) {
            if (!state.meeting) continue;
            const resolved = resolveMeetingActor(state, actor, clock);
            if (resolved) out.set(meetingId, resolved);
          }
          return out as ReadonlyMap<string, Actor>;
        };
      const reference = resolveActors(hub.states());
      if (reference.size === 0) throw new ApiProblem(403, 'Forbidden', 'No active role assignment.', 'R-PERM-01');
      if (meetingFilter !== undefined) {
        if (!hub.states().get(meetingFilter)?.meeting) throw new ApiProblem(404, 'Not found', `Meeting ${meetingFilter} does not exist.`);
        if (!reference.has(meetingFilter)) throw new ApiProblem(403, 'Forbidden', 'No active role assignment in this meeting.', 'R-PERM-01');
      }

      const pipe = new TransformStream<Uint8Array, Uint8Array>();
      const writer = pipe.writable.getWriter();
      const connection: Connection = new Connection({
        writer, reference, resolveActors, meetingFilter,
        checkSession: options.session !== undefined && token !== null
          ? (occasion: string): Promise<boolean> => options.sessionChecks.check(occasion, sessionKey, () => options.session!.valid(token), () => !connection.closed)
          : undefined,
        release: slot.release, limits: options.limits, clock, hub, notice: options.notice,
      });
      // The first line of every stream, queued before anything else can be (also before an early `end` or `reset`).
      const retryWritten = connection.write(RETRY_FRAME);
      // Handover steps 1 and 2 (Codex P1): registered as waiting and the head read in one synchronous step.
      const snapshot = hub.register(connection);
      const H = snapshot.head;
      let opening: Opening;
      try {
        opening = openingFrames(cursor, H, snapshot.log, snapshot.states, reference, meetingFilter, options.limits.replayMax);
      } catch (error) {
        connection.close(null);
        throw error;
      }
      // Rotation and heartbeat checks from registration on, also while the catch-up is written (review major 1).
      connection.startTimers();
      const signal = c.req.raw.signal;
      if (signal.aborted) connection.close(null);
      else signal.addEventListener('abort', () => connection.close(null), { once: true });
      void (async () => {
        if (options.handoverHook) await options.handoverHook().catch(() => undefined);
        if (!await retryWritten) return;
        if (opening.kind === 'reset') {
          connection.close(resetFrame(H));
          return;
        }
        // Step 3: the catch-up `(cursor, H]` with backpressure, then `cursor` with `H`. Each frame is built only
        // when the previous one was taken (Codex P1): the catch-up is never serialized ahead of the reader.
        const frames = opening.frames[Symbol.iterator]();
        for (;;) {
          if (!await connection.catchUpMayGoOn()) return;
          let next: IteratorResult<Frame>;
          try {
            next = frames.next();
          } catch {
            // An event without hash in the distributor's log: every stream ends, not only this one (decision 3).
            hub.fail();
            connection.close(endFrame('unavailable'));
            return;
          }
          if (next.done) break;
          if (!await connection.write(next.value)) return;
        }
        if (!await connection.catchUpMayGoOn()) return;
        // Steps 4 and 5: what arrived meanwhile (all with seq > H), then live.
        connection.goLive();
      })();
      handedOver = true;
      return new Response(pipe.readable, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          'X-Accel-Buffering': 'no',
        },
      });
    } finally {
      if (!handedOver) slot.release();
    }
  };
}

type Opening = { kind: 'reset' } | { kind: 'frames'; frames: Iterable<Frame> };

/** What a new connection gets first (decision 5): `cursor` alone, a catch-up then `cursor`, or `reset`. */
function openingFrames(cursor: number | undefined, head: number, log: readonly DomainEvent[], states: StreamStates,
  reference: ReadonlyMap<string, Actor>, meetingFilter: string | undefined, replayMax: number): Opening {
  if (cursor === undefined) return { kind: 'frames', frames: [cursorFrame(head)] };
  if (cursor > head || head - cursor > replayMax) return { kind: 'reset' };
  const range = log.slice(cursor, head).filter((e) => meetingFilter === undefined || e.meetingId === meetingFilter);
  // A reader with `event.read` gets every event (R-PERM-04, as `replayMessage` decides): masked and framed one at a
  // time, while the catch-up is written.
  if ([...reference.values()].some((a) => can(a, 'event.read').allow)) {
    return { kind: 'frames', frames: (function* lazy(): Generator<Frame> {
      for (const e of range) yield messageFrame({ kind: 'event', event: maskEvent(e) });
      yield cursorFrame(head);
    })() };
  }
  let failed = false;
  const replay = replayMessage(reference, range, states, { can, onIntegrityError: () => { failed = true; } });
  if (failed || replay.kind === 'reset') return { kind: 'reset' };
  return { kind: 'frames', frames: [...replay.messages.map(messageFrame), cursorFrame(head)] };
}
