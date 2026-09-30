/** Same-origin HTTP implementation of the domain-facing HvApi port. */
import { ApiProblem, type Actor, type HvApi, type ReadEvent, type StreamChange, type StreamTopic } from '@hv/domain';
import type { components, paths } from '../../../../packages/contract/src/types';
import { translate } from '../i18n';
import { createConnectionStore, type ConnectionSignal, type ConnectionStore } from './connection';
import { actorKey, READ_TOPICS } from './liveStore';
import { createSseParser, decodeMessage, type SseItem } from './sse';

export type HttpSession = components['schemas']['Session'];
export type TransparencyNotice = components['schemas']['TransparencyNotice'];

type Verb = 'get' | 'post' | 'put' | 'patch';
type Route<M extends Verb> = { [P in keyof paths]: paths[P][M] extends never ? never : P }[keyof paths];
type Query = Record<string, string | number | readonly string[] | undefined>;
type Transport = (url: string, init: RequestInit) => Promise<Response>;
type Language = 'de' | 'en';

export interface HttpApiOptions {
  /** Only a confirmed, in-memory session may provide this token. */
  getCsrfToken: () => string | undefined;
  onUnauthorized: () => void;
  locale?: () => Language;
  fetcher?: Transport;
  /**
   * Slice 036a: how each own write ended, for the live store (liveStore.ts). `success` after a 2xx, once the ETag
   * is set and before the listeners run; `server_error` for any answer or network failure after sending;
   * `local_reject` for a write refused here without a request (no CSRF token, the speaker reopen reason).
   */
  onWriteSettled?: (outcome: WriteOutcome) => void;
  /** Slice 036b: every message of the stream, for the live store (`liveStore.onStreamMessage`); `[]` = everything. */
  onStreamMessage?: (events: readonly ReadEvent[], change?: StreamChange) => void;
  /**
   * Slice 036b: the stream ended through a loss of session or rights (`end {session|forbidden|roles_changed}`, 403 or 401
   * on open). The buffer must be emptied now; for all but `unauthorized` the session is read again (`/auth/me`). The
   * adapter opens no new stream until `openStream()` is called after a confirmed session.
   */
  onStreamEnd?: (reason: StreamEndReason) => void;
  /** Slice 036b: where the connection state goes (the shell's indicator); a private store if absent. */
  connection?: ConnectionStore;
  /** Slice 036b: visibility, online state and jitter of the browser; injected by tests. */
  environment?: StreamEnvironment;
}

export type WriteOutcome = 'success' | 'server_error' | 'local_reject';
export type StreamEndReason = 'session' | 'forbidden' | 'roles_changed' | 'unauthorized';

export interface StreamEnvironment {
  hidden(): boolean;
  onVisibilityChange(listener: () => void): () => void;
  online(): boolean;
  onOnlineChange(listener: () => void): () => void;
  /** A number in [0, 1) for the jitter of the backoff. */
  random(): number;
}

/** The HTTP adapter plus the stream it holds for the confirmed session (slice 036b). */
export interface HttpApi extends HvApi {
  /** A session is confirmed (`onActorChange(actor)`): open the stream unless one is open or a retry is pending. */
  openStream(): void;
  /** No session any more: close the stream, no new attempt. */
  closeStream(): void;
}

/**
 * Slice 036b: what a change of the session's actor does to the stream (`index.ts`). Every confirmed actor asks for the
 * stream; a structurally other actor first closes the open one (review minor 3), so nothing opened under the previous
 * actor keeps running and its cursor is dropped (minor 2); no actor closes it.
 */
export function followSessionActor(api: Pick<HttpApi, 'openStream' | 'closeStream'>): (actor: Actor | undefined) => void {
  let last: string | undefined;
  return (actor) => {
    const next = actor === undefined ? undefined : actorKey(actor);
    if (next === undefined) api.closeStream();
    else {
      if (last !== undefined && next !== last) api.closeStream();
      api.openStream();
    }
    last = next;
  };
}

const browserEnvironment: StreamEnvironment = {
  hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  onVisibilityChange(listener) {
    if (typeof document === 'undefined') return () => undefined;
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  onOnlineChange(listener) {
    if (typeof window === 'undefined') return () => undefined;
    window.addEventListener('online', listener);
    window.addEventListener('offline', listener);
    return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
  },
  random: () => Math.random(),
};

/**
 * Stream limits of the client (spec 036b decision 3). Fixed constants: a change is a spec change.
 * Backoff 1 s, 2 s, 4 s … 30 s, each step drawn up to 20 % below itself (never above the cap, MF-SC-2).
 */
const STREAM_PATH = '/v1/stream';
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_JITTER = 0.2;
/** Three heartbeat intervals of the service (15 s) without a heartbeat or message. */
const WATCHDOG_MS = 45_000;
/** A stream shorter than this with nothing but heartbeats and cursors counts as short-lived (m8). */
const SHORT_LIVED_MS = 10_000;
const SHORT_LIVED_LIMIT = 3;
const SHORT_LIVED_PAUSE_MS = 300_000;
/** Session or rights ends in a row without a healthy stream before the 5 min pause (review major 1, MF-SC-2). */
const SESSION_END_LIMIT = 3;
const HIDDEN_CLOSE_MS = 60_000;
/** Used after `end {unavailable}` when the stream named no `retry:` (contract: `retry: 3000`). */
const DEFAULT_RETRY_MS = 3_000;
const RETRY_AFTER_MAX_S = 300;
/** More reads than this before a stream without cursor: the first cursor invalidates everything. */
const MAX_RECORDED_READS = 200;
const CURSOR_PATTERN = /^[0-9]{1,16}$/;

type ReadName = keyof typeof READ_TOPICS;

/** `Retry-After` as whole seconds (contract: a plain integer), within 1 s and 5 min; anything else is ignored. */
function retryAfterMs(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After')?.trim();
  if (raw === undefined || !/^[0-9]{1,6}$/.test(raw)) return undefined;
  return Math.min(Math.max(Number(raw), 1), RETRY_AFTER_MAX_S) * 1000;
}

function genericProblem(status: number, language: Language): ApiProblem {
  return new ApiProblem(status, translate(language, 'http.errorTitle'), translate(language, 'http.errorDetail'));
}

function randomKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto.randomUUID === 'function') return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function urlFor(route: keyof paths, params?: Record<string, string>, query?: Query): string {
  const path = route.replace(/\{([^}]+)\}/g, (_placeholder, name: string) => {
    const value = params?.[name];
    if (value === undefined) throw new Error(`Missing route parameter: ${name}`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(name, Array.isArray(value) ? value.join(',') : String(value));
  }
  return `/v1${path}${search.size > 0 ? `?${search.toString()}` : ''}`;
}

interface RequestDetails {
  params?: Record<string, string>;
  query?: Query;
  body?: unknown;
  write?: Parameters<HvApi['closeQuestion']>[1];
  /** For auth endpoints outside /v1. */
  authPath?: '/auth/me' | '/auth/transparency-notice' | '/auth/logout';
  csrf?: string;
}

async function perform<T>(
  method: Uppercase<Verb>,
  route: keyof paths | undefined,
  details: RequestDetails,
  transport: Transport,
  language: Language,
  onUnauthorized?: () => void,
  onWriteEtag?: (etag: string | null) => void,
): Promise<T> {
  const url = details.authPath ?? urlFor(route!, details.params, details.query);
  const headers = new Headers();
  if (details.body !== undefined) headers.set('Content-Type', 'application/json');
  if (method !== 'GET') {
    const csrf = details.csrf;
    if (!csrf) throw new ApiProblem(401, translate(language, 'http.errorTitle'), translate(language, 'http.noSession'));
    headers.set('X-CSRF-Token', csrf);
    headers.set('Idempotency-Key', details.write?.idempotencyKey ?? randomKey());
    if (details.write?.ifMatch !== undefined) headers.set('If-Match', details.write.ifMatch);
  }
  let response: Response;
  try {
    response = await transport(url, {
      method,
      credentials: 'same-origin',
      headers,
      ...(details.body !== undefined ? { body: JSON.stringify(details.body) } : {}),
    });
  } catch {
    throw genericProblem(0, language);
  }
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType === 'application/problem+json') {
      try {
        const body: unknown = await response.json();
        if (body && typeof body === 'object') {
          const problem = body as Record<string, unknown>;
          if (problem.status === response.status && typeof problem.title === 'string' && typeof problem.detail === 'string') {
            const rejected = new ApiProblem(response.status, problem.title, problem.detail,
              typeof problem.ruleId === 'string' ? problem.ruleId : undefined);
            // Contract 0.3.8 `NoActiveRole`: only this one response carries a token, for sign-out.
            if (details.authPath === '/auth/me' && response.status === 403 && typeof problem.csrfToken === 'string') {
              return Promise.reject(Object.assign(rejected, { csrfToken: problem.csrfToken }));
            }
            return Promise.reject(rejected);
          }
        }
      } catch { /* malformed provider/server data must not be reflected */ }
    }
    throw genericProblem(response.status, language);
  }
  if (method !== 'GET') onWriteEtag?.(response.headers.get('ETag'));
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw genericProblem(response.status, language);
  }
}

export function createHttpApi(options: HttpApiOptions): HttpApi {
  const transport: Transport = options.fetcher ?? ((url, init) => fetch(url, init));
  const language = () => options.locale?.() ?? 'de';
  let writeEtag: string | undefined;
  let unauthorized = false;
  let observedToken = options.getCsrfToken();
  const listeners = new Set<Parameters<HvApi['subscribe']>[0]>();
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  const stopPolling = () => { if (pollTimer !== undefined) clearInterval(pollTimer); pollTimer = undefined; };
  const observeSession = () => {
    const token = options.getCsrfToken();
    if (token !== observedToken) {
      if (token) unauthorized = false;
      observedToken = token;
    }
  };
  // A listener that throws must not turn an accepted write into a failure or starve the other listeners.
  const notifyListeners = () => {
    for (const current of [...listeners]) {
      try { current([]); } catch { /* swallowed on purpose: the server has already accepted the write */ }
    }
  };
  // A throwing hook must not turn the outcome of a write into another one.
  const settled = (outcome: WriteOutcome) => {
    try { options.onWriteSettled?.(outcome); } catch { /* swallowed on purpose, like a throwing listener */ }
  };
  const onUnauthorized = () => {
    // Any 401 ends the stream too; only a new confirmed session (`openStream`) starts it again.
    stopStream();
    if (unauthorized) return;
    unauthorized = true;
    options.onUnauthorized();
    observedToken = options.getCsrfToken();
    stopPolling();
  };

  // ---- the stream (slice 036b) ---------------------------------------------------------------------------------------
  const environment = options.environment ?? browserEnvironment;
  const connection = options.connection ?? createConnectionStore(() => Date.now());
  const signal = (next: ConnectionSignal) => { connection.dispatch(next); };
  const now = () => Date.now();
  interface Connection {
    abort: AbortController;
    reader?: ReadableStreamDefaultReader<Uint8Array>;
    openedAt?: number;
    /** Something other than heartbeats and cursors arrived (m8). */
    sawData: boolean;
    /** Opened without a cursor and its first `cursor` is still to come (N5). */
    awaitingCursor: boolean;
    /** The reads asked for before this stream request was sent (N5); `'all'` when too many. */
    beforeSend: Map<string, { method: ReadName; args: readonly unknown[] }> | 'all' | undefined;
  }
  /** A confirmed session asked for the stream; false after sign-out and after a loss of session or rights. */
  let wanted = false;
  let current: Connection | undefined;
  /** The stream is open (200 with `text/event-stream`): the 30 s poll rests (decision 5). */
  let streamOpen = false;
  /** Last received `id` (never derived from `reset` or `end`, which carry none). */
  let cursor: string | undefined;
  let attempt = 0;
  let shortLived = 0;
  let serverRetryMs: number | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
  /** Closed after 60 s hidden, or not opened because hidden: opens when the tab is visible again. */
  let pausedHidden = false;
  let detachEnvironment: (() => void) | undefined;
  /**
   * Review major 1 (T-G1-D-03): session or rights ends in a row without a healthy stream, and whether the next
   * `openStream()` follows such an end. A proxy answering 403 only on the stream, or a service whose hub lags behind
   * `/auth/me`, would otherwise loop end → `/auth/me` → open → end without any pause.
   */
  let sessionEnds = 0;
  let afterSessionEnd = false;
  /** Reads started while no stream is in step (N5), keyed by method and arguments. */
  let recorded: Map<string, { method: ReadName; args: readonly unknown[] }> | 'all' = new Map();

  const recordRead = (method: ReadName, args: readonly unknown[]) => {
    if (current !== undefined && streamOpen && !current.awaitingCursor) return;
    if (recorded === 'all') return;
    recorded.set(JSON.stringify([method, args]), { method, args });
    if (recorded.size > MAX_RECORDED_READS) recorded = 'all';
  };
  const deliver = (events: readonly ReadEvent[], change?: StreamChange) => {
    try {
      if (change === undefined) options.onStreamMessage?.(events);
      else options.onStreamMessage?.(events, change);
    } catch { /* a throwing hook must not end the stream */ }
  };
  /** N5: after the first cursor, only what was asked for before the stream request is stale. */
  const invalidateBeforeSend = (before: Connection['beforeSend']) => {
    if (before === undefined) return;
    if (before === 'all') { deliver([]); return; }
    if (before.size === 0) return;
    const topics = new Set<StreamTopic>();
    const subjects = new Set<string>();
    for (const { method, args } of before.values()) {
      for (const topic of READ_TOPICS[method]) topics.add(topic);
      // Item reads are named by their id; list reads of a named topic are invalidated whatever the ids.
      if (typeof args[0] === 'string') subjects.add(args[0]);
    }
    deliver([], { seq: 0, topics: [...topics], subjects: [...subjects] });
  };
  const clearRetry = () => { if (retryTimer !== undefined) clearTimeout(retryTimer); retryTimer = undefined; };
  const clearWatchdog = () => { if (watchdog !== undefined) clearTimeout(watchdog); watchdog = undefined; };
  /** Ends the current connection on this side; nothing of it is read any more. */
  const drop = () => {
    clearWatchdog();
    streamOpen = false;
    const closing = current;
    current = undefined;
    if (closing === undefined) return;
    // Reads before a request that never reached its first cursor still need their invalidation.
    if (closing.awaitingCursor && closing.beforeSend !== undefined) {
      if (closing.beforeSend === 'all' || recorded === 'all') recorded = 'all';
      else for (const [key, value] of closing.beforeSend) recorded.set(key, value);
    }
    closing.abort.abort();
    closing.reader?.cancel().catch(() => undefined);
  };
  const backoffDelay = () => {
    const step = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
    attempt = Math.min(attempt + 1, 16);
    return step * (1 - BACKOFF_JITTER * environment.random());
  };
  const retryIn = (ms: number) => { clearRetry(); retryTimer = setTimeout(() => { retryTimer = undefined; connect(); }, ms); };
  /** A loss of session or rights: empty the buffer (the hook), no new stream without a new confirmation. */
  const endForSession = (reason: StreamEndReason) => {
    const closing = current;
    const lifetime = closing?.openedAt === undefined ? 0 : now() - closing.openedAt;
    if (lifetime >= SHORT_LIVED_MS) { attempt = 0; sessionEnds = 0; } else sessionEnds += 1;
    afterSessionEnd = true;
    drop();
    clearRetry();
    wanted = false;
    recorded = new Map();
    signal({ type: 'stop' });
    try { options.onStreamEnd?.(reason); } catch { /* the stream stays closed either way */ }
  };
  function stopStream() {
    wanted = false;
    drop();
    clearRetry();
    signal({ type: 'stop' });
  }
  /**
   * The service or the network ended a stream that was open. `soon`: rotate or reset, at once unless the stream was
   * itself short; `fallback`: `end {unavailable}`.
   */
  const ended = (how: 'lost' | 'soon' | 'fallback') => {
    const closing = current;
    const lifetime = closing?.openedAt === undefined ? 0 : now() - closing.openedAt;
    const healthy = closing !== undefined && (closing.sawData || lifetime >= SHORT_LIVED_MS);
    drop();
    if (healthy) { attempt = 0; shortLived = 0; sessionEnds = 0; } else shortLived += 1;
    if (shortLived >= SHORT_LIVED_LIMIT) {
      // A cutting or buffering proxy: stay on the poll for a while (m8).
      shortLived = 0;
      signal({ type: 'fallback' });
      retryIn(SHORT_LIVED_PAUSE_MS);
      return;
    }
    if (how === 'fallback') {
      signal({ type: 'fallback' });
      retryIn(Math.max(serverRetryMs ?? DEFAULT_RETRY_MS, backoffDelay()));
      return;
    }
    if (how === 'soon' && lifetime >= SHORT_LIVED_MS) { connect(); return; }
    signal({ type: 'lost' });
    retryIn(backoffDelay());
  };
  const armWatchdog = (owner: Connection) => {
    clearWatchdog();
    watchdog = setTimeout(() => { if (current === owner) ended('lost'); }, WATCHDOG_MS);
  };
  const handle = (owner: Connection, item: SseItem, lastEventId: string | undefined) => {
    if (item.kind === 'retry') { serverRetryMs = Math.min(item.ms, BACKOFF_MAX_MS); return; }
    armWatchdog(owner);
    signal({ type: 'synced' });
    if (item.kind === 'comment') return;
    if (lastEventId !== undefined && CURSOR_PATTERN.test(lastEventId)) cursor = lastEventId;
    const message = decodeMessage(item);
    if (message === undefined) { owner.sawData = true; deliver([]); return; }
    switch (message.kind) {
      case 'event': owner.sawData = true; deliver([message.event]); return;
      case 'change': owner.sawData = true; deliver([], message.change); return;
      case 'cursor':
        if (owner.awaitingCursor) {
          owner.awaitingCursor = false;
          const before = owner.beforeSend;
          owner.beforeSend = undefined;
          recorded = new Map();
          invalidateBeforeSend(before);
        }
        return;
      case 'reset':
        // The whole buffer once (the listeners reload their views), then a new stream without a cursor.
        owner.sawData = true;
        deliver([]);
        cursor = undefined;
        ended('soon');
        return;
      case 'end':
        if (message.reason === 'rotate') ended('soon');
        else if (message.reason === 'unavailable') ended('fallback');
        else endForSession(message.reason);
        return;
    }
  };
  const readBody = async (owner: Connection, body: ReadableStream<Uint8Array>) => {
    const reader = body.getReader();
    owner.reader = reader;
    const parser = createSseParser();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (current !== owner) return;
        if (done) break;
        for (const item of parser.push(value)) {
          handle(owner, item, parser.lastEventId);
          if (current !== owner) return;
        }
      }
    } catch {
      // Over 1 MiB (`SseTooLargeError`, SP-2) or a broken body: this connection is dropped, a new one follows with
      // backoff. Nothing of the body is reported anywhere (SC-11).
    }
    if (current === owner) ended('lost');
  };
  const opened = (owner: Connection, response: Response) => {
    if (current !== owner) { response.body?.cancel().catch(() => undefined); return; }
    const status = response.status;
    if (status === 401) {
      // m4 (Codex P1): the buffer first, then the path every request takes on a 401.
      endForSession('unauthorized');
      onUnauthorized();
      return;
    }
    if (status === 403) { endForSession('forbidden'); return; }
    if (status === 429 || status === 503) {
      drop();
      signal({ type: 'fallback' });
      retryIn(retryAfterMs(response) ?? backoffDelay());
      return;
    }
    const type = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
    if (!response.ok || type !== 'text/event-stream' || response.body === null) {
      // A cursor the service refuses (422) is not sent again.
      if (status === 422) cursor = undefined;
      response.body?.cancel().catch(() => undefined);
      drop();
      signal({ type: 'lost' });
      retryIn(backoffDelay());
      return;
    }
    owner.openedAt = now();
    streamOpen = true;
    signal({ type: 'opened' });
    armWatchdog(owner);
    void readBody(owner, response.body);
  };
  function connect() {
    clearRetry();
    if (!wanted || current !== undefined) return;
    if (environment.hidden()) { pausedHidden = true; return; }
    observeSession();
    if (!options.getCsrfToken()) { stopStream(); return; }
    const owner: Connection = {
      abort: new AbortController(),
      sawData: false,
      awaitingCursor: cursor === undefined,
      beforeSend: cursor === undefined ? recorded : undefined,
    };
    recorded = new Map();
    current = owner;
    signal({ type: 'start' });
    const headers = new Headers({ Accept: 'text/event-stream' });
    if (cursor !== undefined) headers.set('Last-Event-ID', cursor);
    let request: Promise<Response>;
    try {
      request = transport(STREAM_PATH, { method: 'GET', credentials: 'same-origin', headers, cache: 'no-store', signal: owner.abort.signal });
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then((response) => { opened(owner, response); }, () => {
      if (current !== owner) return;
      drop();
      signal({ type: 'networkError' });
      retryIn(backoffDelay());
    });
  }
  const onVisibility = () => {
    if (environment.hidden()) {
      if (hiddenTimer === undefined && current !== undefined) {
        hiddenTimer = setTimeout(() => {
          hiddenTimer = undefined;
          if (!environment.hidden() || !wanted) return;
          pausedHidden = true;
          drop();
          clearRetry();
          signal({ type: 'lost' });
        }, HIDDEN_CLOSE_MS);
      }
      return;
    }
    if (hiddenTimer !== undefined) { clearTimeout(hiddenTimer); hiddenTimer = undefined; }
    if (pausedHidden) {
      pausedHidden = false;
      attempt = 0;
      if (wanted && current === undefined) connect();
    }
  };
  const onOnline = () => { signal({ type: environment.online() ? 'online' : 'offline' }); };
  const attachEnvironment = () => {
    if (detachEnvironment !== undefined) return;
    const offVisibility = environment.onVisibilityChange(onVisibility);
    const offOnline = environment.onOnlineChange(onOnline);
    detachEnvironment = () => { offVisibility(); offOnline(); };
    if (!environment.online()) signal({ type: 'offline' });
  };

  const read = <T, M extends Verb>(method: M, route: Route<M>, details: RequestDetails = {}): Promise<T> => {
    observeSession();
    return perform<T>(method.toUpperCase() as Uppercase<M>, route, details, transport, language(), onUnauthorized)
      .then((value) => {
        // Without a stream, what a view shows is as current as its last read ("Stand von", slice 036b).
        if (!streamOpen) signal({ type: 'synced' });
        return value;
      });
  };
  const write = <T, M extends Exclude<Verb, 'get'>>(method: M, route: Route<M>, details: RequestDetails = {}): Promise<T> => {
    observeSession();
    const csrf = options.getCsrfToken();
    if (!csrf) {
      settled('local_reject');
      return Promise.reject(new ApiProblem(401, translate(language(), 'http.errorTitle'), translate(language(), 'http.noSession')));
    }
    // Own successful writes refresh the views at once (the demo adapter does the same); the ETag is set inside `perform`
    // before the listeners run, so a reload sees the current `lastWriteEtag()`. Failures reject before this line.
    return perform<T>(method.toUpperCase() as Uppercase<M>, route, { ...details, csrf }, transport,
      language(), onUnauthorized, (etag) => { writeEtag = etag ?? undefined; }).then((result) => {
      settled('success');
      notifyListeners();
      return result;
    }, (error: unknown) => {
      settled('server_error');
      throw error;
    });
  };
  const currentMeetingId = async () => (await read<Awaited<ReturnType<HvApi['getMeeting']>>, 'get'>('get', '/meeting')).id;
  const meetingRoute = async () => ({ meetingId: await currentMeetingId() });
  const questionPath = (questionId: string) => ({ questionId });
  const contributionPath = (contributionId: string) => ({ contributionId });
  const api: HttpApi = {
    getMeeting: () => read('get', '/meeting'),
    listMeetings: (status) => read('get', '/meetings', { query: { status } }),
    getMeetingById: (meetingId) => read('get', '/meetings/{meetingId}', { params: { meetingId } }),
    listMeetingAgendaItems: (meetingId) => read('get', '/meetings/{meetingId}/agenda-items', { params: { meetingId } }),
    listMeetingUnits: (meetingId) => read('get', '/meetings/{meetingId}/units', { params: { meetingId } }),
    openAgendaItem: async (agendaItemId, writeOptions) => write('post', '/meetings/{meetingId}/agenda-items/{agendaItemId}/opening', { params: { ...await meetingRoute(), agendaItemId }, write: writeOptions }),
    openVoting: async (agendaItemId, writeOptions) => write('post', '/meetings/{meetingId}/agenda-items/{agendaItemId}/voting/opening', { params: { ...await meetingRoute(), agendaItemId }, write: writeOptions }),
    closeVoting: async (agendaItemId, writeOptions) => write('post', '/meetings/{meetingId}/agenda-items/{agendaItemId}/voting/closure', { params: { ...await meetingRoute(), agendaItemId }, write: writeOptions }),
    listAgendaItems: () => read('get', '/agenda-items'),
    listUnits: () => read('get', '/units'),
    listRoleAssignments: async (filter) => read('get', '/meetings/{meetingId}/role-assignments', { params: await meetingRoute(), query: { subjectId: filter?.subjectId, role: filter?.role } }),
    assignRole: async (input, writeOptions) => write('post', '/meetings/{meetingId}/role-assignments', { params: await meetingRoute(), body: input, write: writeOptions }),
    revokeRole: async (id, reason, writeOptions) => write('post', '/meetings/{meetingId}/role-assignments/{assignmentId}/revocation', { params: { ...await meetingRoute(), assignmentId: id }, ...(reason !== undefined ? { body: { reason } } : {}), write: writeOptions }),
    listSpeakers: (filter) => read('get', '/speakers', { query: { round: filter?.round, status: filter?.status } }),
    getSpeaker: (speakerId) => read('get', '/speakers/{speakerId}', { params: { speakerId } }),
    registerSpeaker: (input, writeOptions) => write('post', '/speakers', { body: input, write: writeOptions }),
    reorderSpeakers: (round, speakerIds, writeOptions) => write('put', '/speakers/order', { body: { round, speakerIds }, write: writeOptions }),
    updateSpeaker: (speakerId, input, writeOptions) => {
      if (input.reason !== undefined) {
        settled('local_reject');
        return Promise.reject(new ApiProblem(422, translate(language(), 'http.errorTitle'), translate(language(), 'http.unsupported')));
      }
      return write('patch', '/speakers/{speakerId}', { params: { speakerId }, body: input, write: writeOptions });
    },
    listContributions: (filter) => read('get', '/contributions', { query: { speakerId: filter?.speakerId } }),
    getContribution: (contributionId) => read('get', '/contributions/{contributionId}', { params: contributionPath(contributionId) }),
    captureContribution: (input, writeOptions) => write('post', '/contributions', { body: input, write: writeOptions }),
    captureMeetingContribution: async (input, writeOptions) => write('post', '/meetings/{meetingId}/contributions', { params: await meetingRoute(), body: input, write: writeOptions }),
    captureQuestions: (contributionId, questions, writeOptions) => write('post', '/contributions/{contributionId}/questions', { params: contributionPath(contributionId), body: { questions }, write: writeOptions }),
    claimContribution: (contributionId, writeOptions) => write('post', '/contributions/{contributionId}/claim', { params: contributionPath(contributionId), write: writeOptions }),
    releaseContribution: (contributionId, writeOptions) => write('post', '/contributions/{contributionId}/release', { params: contributionPath(contributionId), write: writeOptions }),
    claimQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/claim', { params: questionPath(questionId), write: writeOptions }),
    releaseQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/release', { params: questionPath(questionId), write: writeOptions }),
    lastWriteEtag: () => writeEtag,
    listQuestions: (filter) => read('get', '/questions', { query: { status: filter?.status, track: filter?.track, unitId: filter?.unitId, speakerId: filter?.speakerId, contributionId: filter?.contributionId, agendaItemId: filter?.agendaItemId, q: filter?.q, limit: filter?.limit, offset: filter?.offset } }),
    getQuestion: (questionId) => read('get', '/questions/{questionId}', { params: questionPath(questionId) }),
    getQuestionHistory: (questionId) => read('get', '/questions/{questionId}/history', { params: questionPath(questionId) }),
    classifyQuestion: (questionId, input, writeOptions) => write('post', '/questions/{questionId}/classification', { params: questionPath(questionId), body: input, write: writeOptions }),
    assignQuestion: (questionId, unitId, writeOptions) => write('post', '/questions/{questionId}/assignment', { params: questionPath(questionId), body: { unitId }, write: writeOptions }),
    draftAnswer: (questionId, input, writeOptions) => write('post', '/questions/{questionId}/answers', { params: questionPath(questionId), body: input, write: writeOptions }),
    submitForReview: (questionId, writeOptions) => write('post', '/questions/{questionId}/review-submissions', { params: questionPath(questionId), write: writeOptions }),
    approveQuestion: (questionId, answerVersion, writeOptions) => write('post', '/questions/{questionId}/approvals', { params: questionPath(questionId), body: { answerVersion }, write: writeOptions }),
    clearQuestionLegally: (questionId, input, writeOptions) => write('post', '/questions/{questionId}/legal-clearances', { params: questionPath(questionId), body: input, write: writeOptions }),
    returnQuestion: (questionId, reason, writeOptions) => write('post', '/questions/{questionId}/returns', { params: questionPath(questionId), body: { reason }, write: writeOptions }),
    stageQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/staging', { params: questionPath(questionId), write: writeOptions }),
    deliverQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/delivery', { params: questionPath(questionId), write: writeOptions }),
    closeQuestion: (questionId, writeOptions) => write('post', '/questions/{questionId}/closure', { params: questionPath(questionId), write: writeOptions }),
    withdrawQuestion: (questionId, reason, writeOptions) => write('post', '/questions/{questionId}/withdrawal', { params: questionPath(questionId), body: { reason }, write: writeOptions }),
    mergeQuestion: (questionId, intoQuestionId, writeOptions) => write('post', '/questions/{questionId}/merge', { params: questionPath(questionId), body: { intoQuestionId }, write: writeOptions }),
    getStage: () => read('get', '/stage'),
    listEvents: (after, limit) => read('get', '/events', { query: { after, limit } }),
    seedDemo: () => Promise.reject(new ApiProblem(403, translate(language(), 'http.errorTitle'), translate(language(), 'http.demoOnly'))),
    subscribe(listener) {
      listeners.add(listener);
      if (pollTimer === undefined) {
        pollTimer = setInterval(() => {
          if (!options.getCsrfToken()) { stopPolling(); return; }
          if (environment.hidden()) return;
          // Slice 036b decision 5: the poll rests while the stream is open, and is the fallback while it is not.
          if (streamOpen) return;
          // The whole buffer goes stale with this impulse, so nothing recorded before it needs the N5 invalidation.
          recorded = new Map();
          signal({ type: 'synced' });
          for (const each of listeners) each([]);
        }, 30_000);
      }
      return () => { listeners.delete(listener); if (listeners.size === 0) stopPolling(); };
    },
    openStream() {
      wanted = true;
      attachEnvironment();
      if (current !== undefined || retryTimer !== undefined || pausedHidden) {
        if (pausedHidden && !environment.hidden()) onVisibility();
        return;
      }
      if (afterSessionEnd) {
        // The session is confirmed again, but the open that follows an end waits: backoff, and after three ends without
        // a healthy stream the 5 min pause of m8 (review major 1). Still nothing opens without this confirmation.
        afterSessionEnd = false;
        if (sessionEnds >= SESSION_END_LIMIT) {
          sessionEnds = 0;
          signal({ type: 'start' });
          signal({ type: 'fallback' });
          retryIn(SHORT_LIVED_PAUSE_MS);
        } else retryIn(backoffDelay());
        return;
      }
      connect();
    },
    closeStream() {
      // Review minor 2: the cursor belongs to this session and actor; the next stream starts without it (N5 path).
      cursor = undefined;
      pausedHidden = false;
      if (hiddenTimer !== undefined) { clearTimeout(hiddenTimer); hiddenTimer = undefined; }
      stopStream();
    },
  };
  // N5: the reads of this adapter note that they started while no stream was in step.
  const methods = api as unknown as Record<string, (...args: unknown[]) => unknown>;
  for (const method of Object.keys(READ_TOPICS) as ReadName[]) {
    const inner = methods[method]!;
    methods[method] = (...args: unknown[]) => { recordRead(method, args); return inner(...args); };
  }
  return api;
}

const authTransport: Transport = (url, init) => fetch(url, init);

export function getHttpSession(): Promise<HttpSession> {
  return perform<HttpSession>('GET', undefined, { authPath: '/auth/me' }, authTransport, 'de');
}

export function getTransparencyNotice(): Promise<TransparencyNotice> {
  return perform<TransparencyNotice>('GET', undefined, { authPath: '/auth/transparency-notice' }, authTransport, 'de');
}

export function logoutHttpSession(csrfToken: string): Promise<void> {
  return perform<void>('POST', undefined, { authPath: '/auth/logout', csrf: csrfToken }, authTransport, 'de');
}
