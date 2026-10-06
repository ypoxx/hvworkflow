/**
 * The HTTP surface of the HV-Tool: every path of `packages/contract/openapi.yaml` under `/v1`,
 * implemented over `createInProcessApi` from `@hv/domain` (AGENTS.md rule 6 — the contract comes
 * first, the interface uses `HvApi`, and here the server is just another `HvApi` caller reached
 * over HTTP). No business logic lives in this file: every handler maps a request to one `HvApi`
 * call and maps the result (or the `ApiProblem` it throws) back to a response. `validateOperation`
 * (see `validate.ts`) checks every request against the contract's own schemas first, so a
 * wrongly-typed or contract-violating request never reaches the domain (rework review blockers 1/2).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context, type MiddlewareHandler, type Next } from 'hono';
import { cors } from 'hono/cors';
import {
  ApiProblem,
  computeIndicators,
  createInMemoryEventStore,
  createInProcessApi,
  etagOf,
  seedEvents,
  systemClock,
  verifiedEventCount,
  SYSTEM_ACTOR,
  type Actor,
  type DomainEvent,
  type Indicators,
  type AnswerDraft,
  type Classification,
  type ContributionCapture,
  type ForwardRequest,
  type HvApi,
  type LegalClearanceRequest,
  type MeetingContributionCapture,
  type Persistence,
  type Question,
  type QuestionCapture,
  type QuestionFilter,
  type QuestionStatus,
  type RefusalProposal,
  type Role,
  type RoleAssignmentCreate,
  type Speaker,
  type SpeakerRegistration,
  type SpeakerUpdate,
  type Track,
} from '@hv/domain';
import { parseActorHeader, selectAuthAdapter, sessionActorFromEvents, sessionTokenFromCookie } from './actor.ts';
import { actorIdForIdentity, createOidcFlow, safeReturnTo, type OidcFlow } from './auth/oidc.ts';
import { createAuthStore, type AuthStore } from './auth/store.ts';
import { createFileEventLog } from './eventLog.ts';
import { createBearerCheck } from './metrics/bearer.ts';
import { createSingleFlightCache } from './metrics/cache.ts';
import { METRICS_CONTENT_TYPE, renderMetrics } from './metrics/prometheus.ts';
import { requireParam, writeOptions } from './http.ts';
import { discardSink, type AccessLogSink } from './observability/accessLog.ts';
import { READINESS_CHECK_TIMEOUT_MS, resolveLimits, resolveStreamLimits, STREAM_BATCH_SPACING_MS, STREAM_OPEN_FRESHNESS_MS,
  STREAM_RELOAD_TICK_MS, STREAM_SESSION_CHECKS, type LimitsConfig, type StreamLimits } from './limits/config.ts';
import { DeadlineError, withDeadline } from './limits/deadline.ts';
import { createBodyLimit, createPreflightGuard, createRequestTimeout, createSecurityHeaders, createSourceLayer,
  createSubjectLimits } from './limits/middleware.ts';
import { outcomeUnknown, persistenceBusy } from './limits/responses.ts';
import { createForwardedResolver, createSourceKeyer } from './limits/source.ts';
import { normalizeOrigin } from './config/origins.ts';
import { createNotices } from './limits/stderr.ts';
import { currentRequest, noteSeq } from './observability/context.ts';
import { createRequestLog } from './observability/requestLog.ts';
import { createSubjectHasher } from './observability/subjectHash.ts';
import { problemBody, problemResponse } from './problem.ts';
import { getMigrationStatus } from './persistence/migrations.ts';
import { createChainCache } from './persistence/chainCache.ts';
import { assertRuntimePrivileges, insertPostgresEvents, isPersistenceBusy, loadPostgresSnapshotCached, mustDiscardConnection,
  pooledQuery, PostgresIntegrityError, timedQuery, withQueryTimers, type ChainLoad } from './persistence/postgres.ts';
import { getValidatedBody, getValidatedQuery, validateOperation, type Variables } from './validate.ts';
import { createHub, type HubSource } from './stream/hub.ts';
import { createStreamRoute, streamUnavailable } from './stream/route.ts';
import { createSessionChecker } from './stream/sessionCheck.ts';

export interface CreateAppOptions {
  /** Defaults to `process.env.HV_DEMO === '1'` — kept overridable so tests need not touch env vars. */
  demoEnabled?: boolean;
  /**
   * Defaults to `process.env.HV_OIDC_ISSUER` (slice 029a). Set together with demo mode, `createApp`
   * throws: the demo header must never be accepted where real sign-ins exist (ADR 0004).
   */
  oidcIssuer?: string;
  /** Synthetic test provider; production uses a discovered openid-client configuration. */
  oidcFlow?: OidcFlow;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcRedirectUri?: string;
  /** 32-byte AES-GCM key. Required whenever the production OIDC adapter is enabled. */
  authKey?: Buffer;
  /** Test-only store/event ports; the running service uses Postgres. */
  authStore?: AuthStore;
  authEvents?: () => Promise<readonly DomainEvent[]>;
  transparencyNotice?: { version: string; text: { de: string; en: string }; dataProtectionSummaryUrl?: string };
  /** Defaults to `process.env.HV_EVENT_LOG`. Append-only JSON-lines file (AGENTS.md rule 7). */
  eventLogPath?: string;
  /** Overrides `eventLogPath` — lets tests inject an in-memory `Persistence` without touching disk. */
  persistence?: Persistence;
  clock?: () => Date;
  /** Monotonic milliseconds for the access log latency (wired in server.ts); default: clock differences. */
  monotonic?: () => number;
  /**
   * Slice 033a access log: sink and HMAC key. Default for `createApp` (a library for tests): a discarding
   * sink and a random key per call, whatever the mode. The process start (`server.ts`) enforces the real one.
   */
  accessLog?: { sink: AccessLogSink; hashKey: Buffer };
  /** Slice 033a: SNTP status for `/readyz`; `server.ts` builds it from `HV_NTP_SERVERS`. */
  clockHealth?: () => Promise<ReadinessCheck>;
  /**
   * Slice 033b: bearer token of `GET /metrics` (`server.ts` passes `HV_METRICS_TOKEN`; never read from the
   * environment here, so a test cannot pick up a developer's token). Absent or shorter than 32 characters:
   * every call is answered 401.
   */
  metricsToken?: string;
  idGenerator?: () => string;
  /**
   * Seed the synthetic demo corpus once at startup when demo mode is on and the store is still
   * empty (rework review major 5 — makes `pnpm --filter @hv/api dev` reproducible on its own). Off
   * by default so constructing an app for a test never has this side effect; `server.ts` turns it on.
   */
  seedOnStart?: boolean;
  /**
   * Actor the demo auto-seed (`seedOnStart`) runs as. Falls back to `HV_SEED_ACTOR` (env var, same
   * `"<id>:<role>"` format as the `X-Actor` header) and finally to the synthetic system actor
   * `packages/domain/src/seed.ts` defines. Never a role-name literal here — the only places a `Role`
   * may appear as a string are `ROLE_PERMISSIONS`, the seed corpus and the demo role switcher
   * (AGENTS.md rule 4; `scripts/role-literal-check.mjs`, slice 012).
   */
  seedActor?: Actor;
  /** Transactional Postgres source of truth for the service; JSONL remains the dev adapter. */
  postgres?: Pool;
  /**
   * Slice 034a: limits and timeouts. The defaults are the fixed values of the spec (`DEFAULT_LIMITS`); a test may
   * lower one. The process start passes nothing (slice 034b reads the configurable ones from the environment).
   */
  limits?: Partial<LimitsConfig>;
  /**
   * Slice 035b: the stream limits (`limits/config.ts`, decision 7). A test may lower a value; a higher one is ignored
   * (a raise is a spec change). Never read from the environment.
   */
  streamLimits?: Partial<StreamLimits>;
  /**
   * Slice 034a: the peer of the TCP connection of a request, as a plain address string. Default: the connection
   * address of the Node server (`getConnInfo`); `app.request()` in tests has none, so tests set this.
   * Without an address the key is "unbekannt". `trustedProxyCidrs` (034b) then decides whether `X-Forwarded-For` counts.
   */
  sourceOf?: (c: Context) => string | undefined;
  /**
   * Slice 034b: CIDR blocks of the trusted proxies (`HV_TRUSTED_PROXY_CIDRS`, at most 16, never /0). Only a peer in
   * one of them may name the source through `X-Forwarded-For`. Default: none, the connection address always counts.
   */
  trustedProxyCidrs?: readonly string[];
  /**
   * Slice 034b: allowed CORS origins (`HV_CORS_ORIGINS`, exact, `scheme://host[:port]`). Default: in demo mode
   * `http://localhost:5173` (the Vite dev server), otherwise none, and then no CORS middleware at all (same origin).
   */
  corsOrigins?: readonly string[];
  /** Tests only: run a statement on the request's transaction connection at a named point of a write's Postgres boundary. */
  testHooks?: {
    at?: (point: 'afterLock' | 'beforeCommit', run: (sql: string) => Promise<unknown>) => Promise<void>;
    /**
     * takt-033: after each Postgres load (business request or auth lookup), the number of events hashed for it
     * (loader plus request store), the seq the chain cache ends at afterwards, and the event rows the load read.
     */
    chain?: (info: { hashed: number; cachedSeq: number | undefined; rowsRead: number }) => void;
    /** Slice 035b: replaces the verified log a distributor reload yields (a shortened, replaced or broken chain). */
    streamLoad?: (log: readonly DomainEvent[]) => readonly DomainEvent[];
    /** Slice 035b: awaited on open between reading the head and writing the catch-up (test 13a). */
    streamHandover?: () => Promise<void>;
    /**
     * Slice 035b: start and end of every distributor reload and every session check (tests 17, 28, 29); a session check
     * names its occasion (`b:<seq>` for a batch, `h:…` for a heartbeat).
     */
    streamWindow?: (kind: 'reload' | 'session', phase: 'start' | 'end', occasion?: string) => void;
    /** Slice 035b: the head after every applied batch or rebuild of the distributor. */
    streamApplied?: (head: number) => void;
    /** Slice 035b: awaited before every distributor reload (tests 25b, 25c: a business request loads first). */
    streamReloadGate?: () => Promise<void>;
  };
  /** Slice 027: readiness probes are injected so the server can check real DB/migration state. */
  readiness?: {
    clock: () => Promise<ReadinessCheck>;
    db: () => Promise<ReadinessCheck>;
    migrations: () => Promise<ReadinessCheck>;
  };
}

type ReadinessCheck =
  | { status: 'ok' }
  | { status: 'fail'; code: 'not_configured' | 'unreachable' | 'timeout' | 'migrations_pending' | 'clock_unsynced' | 'clock_drift' };

/** The concrete app type (with its `Variables`), so tests can type `let app: App` without repeating it. */
export type App = Hono<{ Variables: Variables }>;

interface PostgresRequest {
  store: ReturnType<typeof createInMemoryEventStore>;
  domain: HvApi;
  scoped: Map<string, HvApi>;
  persons: ReadonlyMap<string, readonly { personId: string; displayName: string; organisation?: string }[]>;
}

/**
 * `HV_SEED_ACTOR` shares `parseActorHeader`'s `"<id>:<role>"` format, but its errors must say so —
 * review rework round 1, minor 9: a malformed value used to be reported as a problem with "the
 * X-Actor header", which is confusing outside an HTTP request. This is startup-time configuration
 * (`seedOnStart`), not a request, so it throws a plain `Error`, not the HTTP-shaped `ApiProblem`.
 */
function parseSeedActorEnv(raw: string): Actor {
  try {
    return parseActorHeader(raw);
  } catch (err) {
    const detail = err instanceof ApiProblem ? err.detail.replaceAll('X-Actor header', 'HV_SEED_ACTOR') : String(err);
    throw new Error(`Invalid HV_SEED_ACTOR: ${detail}`);
  }
}

function browserCorrelation(header: string | undefined): string | null {
  const values = header?.split(';').map((part) => part.trim())
    .filter((part) => part.startsWith('hv_auth_state=')) ?? [];
  if (values.length !== 1) return null;
  const value = values[0]!.slice('hv_auth_state='.length);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function createApp(options: CreateAppOptions = {}): App {
  const demoEnabled = options.demoEnabled ?? process.env['HV_DEMO'] === '1';
  const oidcIssuer = options.oidcIssuer ?? process.env['HV_OIDC_ISSUER'];
  const authKeyRaw = process.env['HV_AUTH_ENCRYPTION_KEY'];
  const authKey = options.authKey ?? (authKeyRaw ? Buffer.from(authKeyRaw, 'base64url') : undefined);
  const clock = options.clock ?? systemClock;
  const limits = resolveLimits(options.limits);
  const notices = createNotices(clock);
  const accessLog = options.accessLog ?? { sink: discardSink, hashKey: randomBytes(32) };
  const subjectHashOf = createSubjectHasher(accessLog.hashKey);
  // Slice 033b, `hv_auth_no_active_role_total`: process-local detection signal for the loss of every role
  // (Spec 030). Not persisted, not derived from events, no subject, session or path attached.
  let noActiveRoleTotal = 0;
  const noteNoActiveRole = (): void => { noActiveRoleTotal += 1; };
  const noteSubject = (actorId: string): void => {
    const context = currentRequest();
    if (context !== undefined) context.subjectHash = subjectHashOf(actorId);
  };
  const authStore = options.authStore ?? (options.postgres && authKey
    ? createAuthStore(options.postgres, authKey, { queryTimeoutMs: limits.queryTimeoutMs }) : undefined);
  const clientId = options.oidcClientId ?? process.env['HV_OIDC_CLIENT_ID'];
  const clientSecret = options.oidcClientSecret ?? process.env['HV_OIDC_CLIENT_SECRET'];
  const redirectUri = options.oidcRedirectUri ?? process.env['HV_OIDC_REDIRECT_URI'];
  if (!demoEnabled && oidcIssuer?.trim() && clientId && clientSecret && redirectUri && authKey &&
      !options.postgres && !options.authStore) {
    throw new Error('OIDC sign-in requires Postgres persistence.');
  }
  const oidcFlow = options.oidcFlow ?? (oidcIssuer?.trim() && clientId && clientSecret && redirectUri
    ? createOidcFlow({ issuer: oidcIssuer, clientId, clientSecret, redirectUri, clock,
      timeoutSeconds: Math.ceil(limits.oidcTimeoutMs / 1_000) }) : undefined);
  const noticeVersion = process.env['HV_TRANSPARENCY_NOTICE_VERSION'];
  const noticeDe = process.env['HV_TRANSPARENCY_NOTICE_DE'];
  const noticeEn = process.env['HV_TRANSPARENCY_NOTICE_EN'];
  const noticeCandidate = options.transparencyNotice ?? (noticeVersion && noticeDe && noticeEn
    ? { version: noticeVersion, text: { de: noticeDe, en: noticeEn },
      ...(process.env['HV_DSFA_SUMMARY_URL'] ? { dataProtectionSummaryUrl: process.env['HV_DSFA_SUMMARY_URL'] } : {}) }
    : undefined);
  let summaryUrl: string | undefined;
  if (noticeCandidate?.dataProtectionSummaryUrl) {
    try {
      const parsed = new URL(noticeCandidate.dataProtectionSummaryUrl);
      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password) {
        summaryUrl = parsed.href;
      }
    } catch { /* An optional, invalid link must not enter the contract response. */ }
  }
  const transparencyNotice = noticeCandidate?.version.trim() && noticeCandidate.text.de.trim() &&
    noticeCandidate.text.en.trim() ? { version: noticeCandidate.version, text: noticeCandidate.text,
      ...(summaryUrl ? { dataProtectionSummaryUrl: summaryUrl } : {}) } : undefined;
  // takt-033: one verified-chain cache per app (and so per process), shared by business requests and auth lookups.
  // Every load still reads its own snapshot: the database digest decides whether the cached prefix is usable.
  const chainCache = createChainCache();
  // Repeats of the history line since it (or the last count line) was written. An environment where the database
  // digest never matches the service's (e.g. a non-UTF-8 database, a lagging replica) would otherwise write it on
  // every request and dull the signal (review finding 3): the line is written once per streak, and the repeats as one
  // fixed count line every 100 repeats, after five minutes of the app's clock, and when the streak ends (review nit a).
  const HISTORY_COUNT_EVERY = 100;
  const HISTORY_COUNT_AFTER_MS = 5 * 60_000;
  let historyStreak: { repeats: number; since: number } | undefined;
  const writeHistoryCount = (): void => {
    if (historyStreak === undefined || historyStreak.repeats === 0) return;
    console.error(`HV-Tool API: the event history line repeated ${historyStreak.repeats} more times.`);
    historyStreak = { repeats: 0, since: clock().getTime() };
  };
  const loadChain = async (client: PoolClient): Promise<ChainLoad> => {
    const load = await loadPostgresSnapshotCached(client, chainCache, limits.queryTimeoutMs);
    // Open owner question 1, default (b): a changed or shortened history with a valid chain is accepted, with a
    // fixed line and no content (no seq, no id, no value).
    if (load.historyChanged) {
      if (historyStreak === undefined) {
        console.error('HV-Tool API: stored event history changed or was shortened; the valid chain was accepted.');
        historyStreak = { repeats: 0, since: clock().getTime() };
      } else {
        historyStreak.repeats += 1;
        if (historyStreak.repeats >= HISTORY_COUNT_EVERY || clock().getTime() - historyStreak.since >= HISTORY_COUNT_AFTER_MS) {
          writeHistoryCount();
        }
      }
    } else if (historyStreak !== undefined) {
      writeHistoryCount();
      historyStreak = undefined;
    }
    return load;
  };
  const reportChain = (hashed: number, rowsRead: number): void => {
    options.testHooks?.chain?.({ hashed, cachedSeq: chainCache.current()?.log.length, rowsRead });
  };
  // One read-only snapshot on a connection of its own (sign-in role lookup, metrics). A connection whose own query
  // timer fired is destroyed, never returned to the pool (slice 034a). The suffix is read on every call, so a
  // committed `RoleRevoked` counts on the next lookup; there is no time-based cache of the actor.
  const readSnapshotEvents = async (): Promise<readonly DomainEvent[]> => {
    const client = await options.postgres!.connect();
    let discard: Error | undefined;
    try {
      await timedQuery(client, limits.queryTimeoutMs, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const load = await loadChain(client);
      await timedQuery(client, limits.queryTimeoutMs, 'COMMIT');
      reportChain(load.hashed, load.rowsRead);
      return load.snapshot.events;
    } catch (error) {
      if (mustDiscardConnection(error)) discard = error as Error;
      else await timedQuery(client, limits.queryTimeoutMs, 'ROLLBACK').catch((rollbackError: unknown) => {
        // Any failed ROLLBACK leaves the connection in an unknown state: discard it.
        discard = rollbackError instanceof Error ? rollbackError : new Error('ROLLBACK failed.');
      });
      throw error;
    } finally {
      client.release(discard);
    }
  };
  const authEvents = options.authEvents ?? (options.postgres ? readSnapshotEvents : undefined);
  const sessionReady = !demoEnabled && authStore !== undefined && oidcFlow !== undefined && authEvents !== undefined;
  const authenticate = selectAuthAdapter({
    demoEnabled,
    oidcIssuer,
    ...(sessionReady ? { sessionCookie: async (readHeader) => {
      const token = sessionTokenFromCookie(readHeader('Cookie'));
      if (!token) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
      const session = await authStore.readSession(token, clock(), false);
      if (!session) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
      return sessionActorFromEvents(await authEvents(), session.actorId, clock()).actor;
    } } : {}),
  });
  const eventLogPath = options.eventLogPath ?? process.env['HV_EVENT_LOG'];
  const persistence = options.persistence ?? (eventLogPath !== undefined ? createFileEventLog(eventLogPath) : undefined);
  if (options.postgres && persistence) throw new Error('Configure only one service persistence source.');
  const store = createInMemoryEventStore(persistence);
  // In-memory and JSONL paths: the highest seq appended while a request runs (Postgres notes its
  // seq after COMMIT in `postgresBoundary`). The listener runs synchronously inside the request.
  store.subscribe((appended) => { for (const event of appended) noteSeq(event.seq); });
  const actorStorage = new AsyncLocalStorage<Actor>();
  const requestStorage = new AsyncLocalStorage<PostgresRequest>();

  // Slice 035b: one stream distributor per app. It reads its own verified log (Postgres: a short read transaction on a
  // connection of its own, as the sign-in lookup; otherwise the store) and never goes through a request boundary.
  const streamLimits = resolveStreamLimits(options.streamLimits);
  const hooks = options.testHooks;
  const streamLoad = (log: readonly DomainEvent[]): readonly DomainEvent[] => (hooks?.streamLoad ? hooks.streamLoad(log) : log);
  const streamSource: HubSource = options.postgres
    ? { load: async () => streamLoad(await readSnapshotEvents()), tick: true }
    : { load: async () => streamLoad([...store.all()]), subscribe: (trigger) => store.subscribe(() => trigger()), tick: false };
  const streamHub = createHub({
    source: streamSource, clock, reloadTickMs: STREAM_RELOAD_TICK_MS, spacingMs: STREAM_BATCH_SPACING_MS,
    freshnessMs: STREAM_OPEN_FRESHNESS_MS, notice: (text) => notices.once(text),
    ...(hooks?.streamWindow ? { onWindow: (phase: 'start' | 'end') => hooks.streamWindow!('reload', phase) } : {}),
    ...(hooks?.streamApplied ? { onApplied: hooks.streamApplied } : {}),
    ...(hooks?.streamReloadGate ? { reloadGate: hooks.streamReloadGate } : {}),
  });
  const streamSessionChecks = createSessionChecker({ concurrency: STREAM_SESSION_CHECKS,
    ...(hooks?.streamWindow ? { onWindow: (phase: 'start' | 'end', occasion: string) => hooks.streamWindow!('session', phase, occasion) } : {}) });

  const currentActor = (): Actor => {
    const actor = actorStorage.getStore();
    if (!actor) throw new ApiProblem(401, 'Unauthorized', 'The X-Actor header is required.');
    return actor;
  };

  const memoryDomain: HvApi = createInProcessApi({
    store,
    actor: currentActor,
    ...(options.clock !== undefined ? { clock: options.clock } : {}),
    ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
    seeder: seedEvents,
  });
  const domain: HvApi = new Proxy(memoryDomain, {
    get(target, property, receiver) {
      const active = requestStorage.getStore()?.domain;
      // With Postgres configured the in-memory store is never a valid source of truth: a handler
      // reached without the request boundary must fail loudly, not read or write a stale store.
      if (!active && options.postgres) throw new Error('Postgres request boundary missing for this route.');
      return Reflect.get(active ?? target, property, receiver);
    },
  });

  // A scoped projection is shared across requests for the same meeting. It follows the global
  // event log but applies only that meeting's events; the actor still comes from this request.
  const scopedDomains = new Map<string, HvApi>();
  const meetingDomain = async (meetingId: string): Promise<HvApi> => {
    const request = requestStorage.getStore();
    if (request) {
      let scoped = request.scoped.get(meetingId);
      if (!scoped) {
        await request.domain.getMeetingById(meetingId);
        scoped = createInProcessApi({
          store: request.store, meetingId, actor: currentActor,
          personSnapshots: request.persons,
          ...(options.clock !== undefined ? { clock: options.clock } : {}),
          ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
        });
        request.scoped.set(meetingId, scoped);
      }
      return scoped;
    }
    let scoped = scopedDomains.get(meetingId);
    if (!scoped) {
      await domain.getMeetingById(meetingId);
      scoped = createInProcessApi({
        store, meetingId,
        actor: currentActor,
        ...(options.clock !== undefined ? { clock: options.clock } : {}),
        ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
      });
      scopedDomains.set(meetingId, scoped);
    }
    return scoped;
  };

  if (options.seedOnStart && demoEnabled && options.postgres === undefined && store.lastSeq() === 0) {
    // `seedDemo` (packages/domain) does no real async I/O (AGENTS.md: "no framework, no I/O"), so the
    // store is already populated by the time this synchronous function returns even though the
    // promise below is not awaited here; `actorStorage.run` supplies the actor `seedDemo` needs
    // outside of any HTTP request.
    const seedActor: Actor =
      options.seedActor ??
      (process.env['HV_SEED_ACTOR'] !== undefined ? parseSeedActorEnv(process.env['HV_SEED_ACTOR']) : undefined) ??
      SYSTEM_ACTOR;
    actorStorage.run(seedActor, () => {
      domain
        .seedDemo({})
        .then((meeting) => {
          // eslint-disable-next-line no-console
          console.log(`HV-Tool API: demo mode — seeded ${meeting.counts.questions} sample questions.`);
        })
        .catch((err: unknown) => {
          console.error('HV-Tool API: demo auto-seed failed:', err);
        });
    });
  }

  const app = new Hono<{ Variables: Variables }>();

  // ---- outermost: correlation id, X-Server-Time, access log (slice 033a) ------------------------
  app.use('*', createRequestLog({ clock, sink: accessLog.sink,
    ...(options.monotonic !== undefined ? { monotonic: options.monotonic } : {}) }));

  // ---- request boundary in front of the actor stage (slice 034a) --------------------------------------
  // Order: (1) access log (above) -> (2) security headers -> (3) CORS with the preflight counter -> (4) request
  // timeout -> (5) source layer -> (6) body limit -> (7) actor and errors -> (8) subject limits -> routes. A refused
  // request costs neither a session read nor a database connection nor the global write lock.
  const sourceKeyOf = createSourceKeyer(randomBytes(32));
  const forwardedSource = createForwardedResolver(options.trustedProxyCidrs ?? []);
  const connectionAddress = (c: Context): string | undefined => {
    if (options.sourceOf) return options.sourceOf(c);
    try { return getConnInfo(c).remote.address; } catch { return undefined; } // no socket under `app.request()`
  };
  const peerAddress = (c: Context): string | undefined => forwardedSource(connectionAddress(c), c.req.header('X-Forwarded-For'));
  const sourceOf = (c: Context): string => sourceKeyOf(peerAddress(c));
  const rate = { clock, limits, notices };
  app.use('*', createSecurityHeaders());

  // CORS (slice 034b): the contract is same-origin (openapi.yaml: `servers: /v1`). An allowlist of exact origins comes
  // from configuration; in demo mode without one it is the Vite dev server (apps/web, port 5173). Without any origin
  // there is no CORS middleware. An origin outside the list gets no `Access-Control-*` header, also on a preflight. An
  // allowed origin gets its headers on every response, also on 408, 413, 429 and 503; `Retry-After` is readable.
  const corsAllowed = new Set((options.corsOrigins ?? (demoEnabled ? ['http://localhost:5173'] : [])).map((origin) => {
    const normalised = normalizeOrigin(origin);
    if (normalised === undefined) throw new Error('Invalid CORS origin option.');
    return normalised;
  }));
  if (corsAllowed.size > 0) {
    const allowedCors = cors({
      origin: (origin) => (corsAllowed.has(normalizeOrigin(origin) ?? '') ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'If-Match', 'Idempotency-Key', 'X-CSRF-Token', ...(demoEnabled ? ['X-Actor'] : [])],
      exposeHeaders: ['ETag', 'X-Server-Time', 'Retry-After'],
      maxAge: 600,
      credentials: !demoEnabled,
    });
    // Slice 035b (m9): `Last-Event-ID` is allowed on the stream path only, where the contract reads it.
    const streamCors = cors({
      origin: (origin) => (corsAllowed.has(normalizeOrigin(origin) ?? '') ? origin : null),
      allowMethods: ['GET', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Last-Event-ID', ...(demoEnabled ? ['X-Actor'] : [])],
      exposeHeaders: ['X-Server-Time', 'Retry-After'],
      maxAge: 600,
      credentials: !demoEnabled,
    });
    const corsPolicy: MiddlewareHandler = async (c, next) => {
      const origin = c.req.header('Origin');
      if (origin !== undefined && corsAllowed.has(normalizeOrigin(origin) ?? '')) {
        return c.req.path === '/v1/stream' ? streamCors(c, next) : allowedCors(c, next);
      }
      if (c.req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { Vary: 'Origin' } });
      await next();
      c.header('Vary', 'Origin', { append: true });
      return undefined;
    };
    const guard = createPreflightGuard(rate, sourceOf, corsPolicy);
    app.use('/v1/*', guard);
    app.use('/auth/*', guard);
  }
  app.use('*', createRequestTimeout(limits.requestTimeoutMs));
  // Sign-in material: the well-formed session cookie, in demo mode the `X-Actor` header (what the adapter reads).
  const hasSignInMaterial = (c: Context): boolean => demoEnabled
    ? (c.req.header('X-Actor') ?? '').trim() !== ''
    : sessionTokenFromCookie(c.req.header('Cookie')) !== null;
  app.use('*', createSourceLayer(rate, sourceOf, hasSignInMaterial));
  app.use('*', createBodyLimit());

  // ---- actor + errors -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    // Slice 033b: `/metrics` (exact path) brings its own bearer check; it is the scraper, not an actor.
    if (c.req.path === '/healthz' || c.req.path === '/readyz' || c.req.path === '/metrics' || c.req.path === '/auth/login' ||
        c.req.path === '/auth/callback' || c.req.path === '/auth/transparency-notice') {
      await next();
      return;
    }
    // takt-023: a session that lost every role must still learn of it (`/auth/me`, 403 with the
    // CSRF token) and sign out. Exactly these two paths skip the role resolution; they check the
    // session cookie, CSRF (logout) and `readSession` below, nothing else is exempted.
    const sessionOnly = sessionReady && (c.req.path === '/auth/me' || c.req.path === '/auth/logout');
    if (sessionOnly && !sessionTokenFromCookie(c.req.header('Cookie'))) {
      throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    }
    // The adapter decides whether any header is read at all (slice 029a: without demo, none is).
    let actor: Actor | undefined;
    try {
      actor = sessionOnly ? undefined : await authenticate((name) => c.req.header(name));
    } catch (error) {
      // Slice 033b, Ziel 8: only `/v1/*` counts here (`/auth/me` counts in its handler); the only 403 the
      // session adapter throws is the missing active role (takt-023).
      if (error instanceof ApiProblem && error.status === 403 && c.req.path.startsWith('/v1/')) noteNoActiveRole();
      throw error;
    }
    // The session was used from here on, whatever CSRF or the re-read decide next: log who (hashed).
    if (actor !== undefined) noteSubject(actor.id);
    if (sessionReady) {
      const token = sessionTokenFromCookie(c.req.header('Cookie'))!;
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
      // Without an adapter actor (`/auth/me`, `/auth/logout`) the session still identifies who acted,
      // also when CSRF fails below: peek without extending the idle window (order of checks unchanged).
      if (actor === undefined) {
        const peek = await authStore!.readSession(token, clock(), false);
        if (peek) noteSubject(peek.actorId);
        // takt-029: `/auth/me` extends the idle window only once the handler knows the session has a role.
        if (c.req.path === '/auth/me') {
          if (!peek) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
          await next();
          return;
        }
      }
      const csrfRequired = (mutation && c.req.path.startsWith('/v1/')) || c.req.path === '/auth/logout';
      if (csrfRequired) {
        const csrf = c.req.header('X-CSRF-Token');
        if (c.req.path === '/auth/logout' && !csrf) {
          throw new ApiProblem(422, 'Unprocessable', 'X-CSRF-Token is required.', 'R-AUTH-01');
        }
        if (!csrf || !await authStore!.verifyCsrf(token, csrf, clock())) {
          throw new ApiProblem(403, 'Forbidden', 'CSRF token is invalid.', 'R-AUTH-01');
        }
      }
      // Re-read only after CSRF validation; a rejected write cannot extend its idle window.
      const current = await authStore!.readSession(token, clock());
      if (!current) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
      if (actor === undefined) noteSubject(current.actorId);
    }
    if (actor === undefined) await next();
    else await actorStorage.run(actor, () => next());
  });
  app.use('*', createSubjectLimits(rate));
  // Slice takt-024: the Postgres boundary (migration status, runtime rights, transaction, write lock,
  // snapshot, commit/rollback) is NOT a blanket `/v1/*` middleware any more. It is chained onto each
  // route behind `validateOperation` (see `guarded` below), so an unknown path (404) or a contract
  // violation (422) never takes a connection or the global lock.
  const postgresBoundary = async (c: Context<{ Variables: Variables }>, next: Next): Promise<Response | void> => {
    const pool = options.postgres;
    if (!pool) {
      await next();
      return;
    }
    const context = currentRequest();
    // A function, not a property read: the timer may change the phase during any `await` (no narrowing).
    const phaseIs = (phase: 'committing' | 'timedOut'): boolean => context?.phase === phase;
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
    const queryMs = limits.queryTimeoutMs;
    const timedPool = withQueryTimers(pool, queryMs);
    let client: PoolClient | undefined;
    let started = false;
    let discard: Error | undefined;
    const query = (text: string, values?: unknown[]) => timedQuery(client!, queryMs, text, values);
    const rollback = async (): Promise<void> => {
      try {
        await query('ROLLBACK');
      } catch (rollbackError) {
        // A ROLLBACK that hangs or fails is not trusted: the connection dies and Postgres rolls back.
        discard = rollbackError instanceof Error ? rollbackError : new Error('ROLLBACK failed.');
      }
      started = false;
    };
    try {
      if ((await getMigrationStatus(timedPool)).pending) {
        return persistenceBusy('Migrations are pending.');
      }
      await assertRuntimePrivileges(timedPool);
      // A request that ran out of time in the checks above must not take a connection or queue for the lock.
      if (phaseIs('timedOut')) return;
      client = await pool.connect();
      await query(write ? 'BEGIN ISOLATION LEVEL READ COMMITTED' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      started = true;
      if (phaseIs('timedOut')) return await rollback();
      if (write) await query('SELECT pg_advisory_xact_lock($1, $2)', [27027, 1]);
      if (write) await options.testHooks?.at?.('afterLock', async (sql) => { await query(sql); });
      // A request that waited for the lock beyond its time budget was answered 408 already: leave early.
      if (phaseIs('timedOut')) return await rollback();
      const load = await loadChain(client);
      const snapshot = load.snapshot;
      if (phaseIs('timedOut')) return await rollback();
      let pendingEvents = snapshot.events.slice(snapshot.events.length);
      // The sealed log is not checked a second time here; own new events reach the cache only after COMMIT, as
      // rows the next request reads and verifies (takt-033, goal 2 (e)).
      const hashedBefore = verifiedEventCount();
      const requestStore = createInMemoryEventStore({
        load: () => snapshot.events,
        save: (all) => { pendingEvents = all.slice(snapshot.events.length); },
      });
      reportChain(load.hashed + verifiedEventCount() - hashedBefore, load.rowsRead);
      const persons = new Map<string, { personId: string; displayName: string; organisation?: string }[]>();
      for (const row of snapshot.persons) {
        const list = persons.get(row.meetingId) ?? [];
        list.push({ personId: row.personId, displayName: row.displayName,
          ...(row.organisation !== undefined ? { organisation: row.organisation } : {}) });
        persons.set(row.meetingId, list);
      }
      const activeDomain = createInProcessApi({
        store: requestStore, actor: currentActor, personSnapshots: persons,
        ...(options.clock !== undefined ? { clock: options.clock } : {}),
        ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
        seeder: seedEvents,
      });
      await requestStorage.run({ store: requestStore, domain: activeDomain, scoped: new Map(), persons }, () => next());
      if (c.res.status >= 400) {
        await rollback();
      } else if (phaseIs('timedOut')) {
        // The 408 is on its way: a 408 means "nothing was committed", so this request must not commit.
        await rollback();
      } else {
        // Check and mark are one synchronous step (no `await` between them): the timer of the request timeout
        // runs on this event loop and sees either `committing` or sets `timedOut` before this line.
        if (pendingEvents.length > 0 && context !== undefined) context.phase = 'committing';
        if (write) await options.testHooks?.at?.('beforeCommit', async (sql) => { await query(sql); });
        if (pendingEvents.length > 0) await insertPostgresEvents(client, pendingEvents, queryMs);
        await query('COMMIT');
        // Only what is committed counts: a rollback or a failed COMMIT leaves `seq` null.
        if (pendingEvents.length > 0) noteSeq(Math.max(...pendingEvents.map((event) => event.seq)));
        // Slice 035b: a nudge without payload; the distributor reloads on its own connection (no-op without streams).
        if (pendingEvents.length > 0) streamHub.poke();
        started = false;
      }
    } catch (error) {
      if (mustDiscardConnection(error)) {
        // The hanging statement dies with the connection; a queued ROLLBACK would only wait behind it.
        discard = error as Error;
      } else if (started && client) {
        await rollback();
      }
      // A handler may already have finalized a success response before persistence failed.
      // Hono ignores a returned middleware response at that point, so replace it explicitly.
      if (error instanceof PostgresIntegrityError) {
        c.res = problemResponse(new ApiProblem(500, 'Internal Server Error', `Event seq ${error.seq}: integrity check failed.`));
      } else if (mustDiscardConnection(error) && phaseIs('committing')) {
        // The service's own timer fired while events or COMMIT were on the wire: the server may have committed.
        // 500 without `Retry-After` and without a promise (the client reads before it writes again).
        c.res = outcomeUnknown();
      } else if (isPersistenceBusy(error)) {
        notices.once('HV-Tool API: persistence busy.');
        c.res = persistenceBusy('Persistence is busy.');
      } else {
        c.res = problemResponse(new ApiProblem(500, 'Internal Server Error', 'Persistence is unavailable.'));
      }
      return;
    } finally {
      client?.release(discard);
    }
  };
  // One handler per route: contract check first, Postgres boundary only for an accepted request.
  // Reaching a domain call without the boundary is impossible with Postgres configured: the `domain`
  // proxy refuses to fall back to the in-memory store then (guard above).
  const guarded = (operationId: string | undefined) => {
    const validate = operationId === undefined ? undefined : validateOperation(operationId);
    return async (c: Context<{ Variables: Variables }>, next: Next): Promise<Response | void> => {
      if (validate === undefined) return postgresBoundary(c, next);
      let boundaryResult: Response | void = undefined;
      await validate(c, async () => { boundaryResult = await postgresBoundary(c, next); });
      return boundaryResult;
    };
  };
  app.onError((err, c) => {
    const response = problemResponse(err);
    if (c.req.path.startsWith('/auth/')) {
      response.headers.set('Cache-Control', 'no-store');
      if (c.req.path === '/auth/callback') {
        response.headers.append('Set-Cookie',
          'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax');
      }
    }
    return response;
  });
  app.notFound(() => problemResponse(new ApiProblem(404, 'Not found', 'No such route.')));

  // Liveness: the process answers. No credential, no database, no NTP; exact path (see the auth exemption).
  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.get('/readyz', async (c) => {
    const serverTime = (options.clock ?? systemClock)().toISOString();
    const defaultChecks = {
      clock: options.clockHealth ?? (async (): Promise<ReadinessCheck> => ({ status: 'fail', code: 'not_configured' })),
      db: async (): Promise<ReadinessCheck> => {
        if (options.postgres) {
          await assertRuntimePrivileges(withQueryTimers(options.postgres, limits.queryTimeoutMs), false);
          await pooledQuery(options.postgres, limits.queryTimeoutMs, 'SELECT 1');
          return { status: 'ok' };
        }
        if (eventLogPath) {
          try {
            await access(eventLogPath, constants.R_OK | constants.W_OK);
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              await access(dirname(eventLogPath), constants.R_OK | constants.W_OK);
            } else {
              throw error;
            }
          }
          return { status: 'ok' };
        }
        return persistence ? { status: 'ok' } : { status: 'fail', code: 'not_configured' };
      },
      migrations: async (): Promise<ReadinessCheck> => {
        if (options.postgres) {
          return (await getMigrationStatus(withQueryTimers(options.postgres, limits.queryTimeoutMs))).pending
            ? { status: 'fail', code: 'migrations_pending' } : { status: 'ok' };
        }
        return persistence ? { status: 'ok' } : { status: 'fail', code: 'not_configured' };
      },
    };
    const probes = options.readiness ?? defaultChecks;
    const safeCheck = async (run: () => Promise<ReadinessCheck>, failureCode: 'timeout' | 'unreachable'): Promise<ReadinessCheck> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          run(),
          new Promise<ReadinessCheck>((resolve) => {
            timer = setTimeout(() => resolve({ status: 'fail', code: 'timeout' }), READINESS_CHECK_TIMEOUT_MS);
          }),
        ]);
      } catch {
        // Driver failures may contain credentials, SQL and host names. Do not pass the error on.
        return { status: 'fail', code: failureCode };
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const checks = {
      clock: await safeCheck(probes.clock, 'timeout'),
      db: await safeCheck(probes.db, 'unreachable'),
      migrations: await safeCheck(probes.migrations, 'unreachable'),
    };
    const ready = Object.values(checks).every((check) => check.status === 'ok');
    c.header('X-Server-Time', serverTime);
    return c.json({ status: ready ? 'ready' : 'not_ready', checks, serverTime }, ready ? 200 : 503);
  });

  // ---- metrics (slice 033b) -----------------------------------------------------------------------
  // The bearer check comes first, before any store access. The indicators are computed from an own
  // read-only snapshot, never from the global in-memory projection (takt-024: it throws with Postgres),
  // and cached for 10 s with one computation in flight (T-G2-D-03; the scan cost is measured in 071).
  const metricsBearer = createBearerCheck(options.metricsToken);
  const cachedIndicators = createSingleFlightCache<Indicators>(10_000, clock);
  const readEventsForMetrics = async (): Promise<readonly DomainEvent[]> => {
    if (!options.postgres) return store.all();
    return readSnapshotEvents();
  };
  app.get('/metrics', async (c) => {
    if (!metricsBearer(c.req.header('Authorization'))) {
      throw new ApiProblem(401, 'Unauthorized', 'A valid metrics token is required.');
    }
    // A failure is not caught here: `onError` answers a bare 500 and writes the one fixed error line
    // with `errorClass` only (problem.ts); no sequence number, no driver text, nothing in the response.
    const indicators: Indicators = await cachedIndicators(
      async () => computeIndicators(await readEventsForMetrics(), clock()));
    return new Response(renderMetrics(indicators, noActiveRoleTotal), { status: 200,
      headers: { 'Content-Type': METRICS_CONTENT_TYPE, 'Cache-Control': 'no-store' } });
  });

  // ---- browser sign-in -----------------------------------------------------------------------
  const authResponseHeaders = (c: Context): void => {
    c.header('Cache-Control', 'no-store');
  };
  app.get('/auth/login', validateOperation('login'), async (c) => {
    if (!sessionReady || !transparencyNotice) throw new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    const returnTo = safeReturnTo(c.req.query('returnTo'));
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const pkceVerifier = randomBytes(32).toString('base64url');
    const correlation = randomBytes(32).toString('base64url');
    let location: string;
    try {
      location = await withDeadline(oidcFlow!.authorizationUrl({ state, nonce, pkceVerifier }), limits.oidcTimeoutMs);
      await authStore!.createLoginState({ state, browserCorrelation: correlation, nonce, pkceVerifier,
        returnTo, now: clock() });
    } catch {
      throw new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    }
    authResponseHeaders(c);
    const response = c.redirect(location, 302);
    response.headers.append('Set-Cookie',
      `hv_auth_state=${correlation}; Max-Age=300; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax`);
    return response;
  });

  app.get('/auth/callback', validateOperation('completeLogin'), async (c) => {
    if (!sessionReady || !transparencyNotice) throw new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    const params = new URL(c.req.url).searchParams;
    const codes = params.getAll('code');
    const states = params.getAll('state');
    const correlation = browserCorrelation(c.req.header('Cookie'));
    if (codes.length !== 1 || states.length !== 1 || !codes[0] || codes[0].length > 2048 ||
        !states[0] || !/^[A-Za-z0-9_-]{43}$/.test(states[0]) || !correlation || params.has('error')) {
      throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    }
    // takt-029: a database fault is "unavailable" (503, contract `completeLogin`), never a bare 500.
    const unavailable = () => new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    const pending = await authStore!.consumeLoginState({ state: states[0],
      browserCorrelation: correlation, now: clock() }).catch(() => { throw unavailable(); });
    if (!pending) throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    let identity: Awaited<ReturnType<OidcFlow['complete']>>;
    try {
      identity = await withDeadline(oidcFlow!.complete({ search: params.toString(), state: states[0],
        nonce: pending.nonce, pkceVerifier: pending.pkceVerifier }), limits.oidcTimeoutMs);
    } catch (error) {
      // A provider that does not answer in time is "unavailable" (no session is created), not a bad response.
      throw error instanceof DeadlineError ? unavailable() : new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    }
    if (identity.issuer !== oidcIssuer) throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    const actorId = actorIdForIdentity(identity.issuer, identity.subject);
    if (await authStore!.isSubjectBlocked(actorId).catch(() => { throw unavailable(); })) {
      throw new ApiProblem(403, 'Forbidden', 'Sign-in is unavailable for this subject.');
    }
    sessionActorFromEvents(await authEvents!().catch(() => { throw unavailable(); }), actorId, clock());
    let session: Awaited<ReturnType<AuthStore['createSession']>>;
    try {
      session = await authStore!.createSession({ actorId, now: clock() });
    } catch {
      // Blocked between the check and the insert stays 403; any other fault is a persistence fault.
      const blocked = await authStore!.isSubjectBlocked(actorId).catch(() => false);
      throw blocked ? new ApiProblem(403, 'Forbidden', 'Sign-in is unavailable for this subject.') : unavailable();
    }
    authResponseHeaders(c);
    const response = c.redirect(pending.returnTo, 302);
    response.headers.append('Set-Cookie',
      `hv_session=${session.token}; Max-Age=50400; Path=/; HttpOnly; Secure; SameSite=Lax`);
    response.headers.append('Set-Cookie',
      'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax');
    return response;
  });

  app.get('/auth/me', validateOperation('getSession'), async (c) => {
    authResponseHeaders(c);
    if (demoEnabled) {
      const actor = currentActor();
      return c.json({ scheme: 'demoActor', actor: { id: actor.id, role: actor.role },
        subjectId: actor.id, roles: [actor.role] });
    }
    const token = sessionTokenFromCookie(c.req.header('Cookie'));
    const session = token && await authStore!.readSession(token, clock(), false);
    if (!session) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    let resolved: ReturnType<typeof sessionActorFromEvents>;
    try {
      resolved = sessionActorFromEvents(await authEvents!(), session.actorId, clock());
    } catch (error) {
      if (!(error instanceof ApiProblem) || error.status !== 403) throw error;
      // Contract 0.3.8 `NoActiveRole`: the token lets the client sign out; /v1 writes still fail.
      noteNoActiveRole();
      const response = new Response(JSON.stringify({ ...problemBody(error), csrfToken: session.csrfToken }),
        { status: 403, headers: { 'Content-Type': 'application/problem+json' } });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    // A session with an active role keeps its idle window alive (the sliding read); one without does not.
    const extended = await authStore!.readSession(token, clock());
    if (!extended) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    return c.json({ scheme: 'session', actor: { id: resolved.actor.id, role: resolved.actor.role },
      subjectId: session.actorId, roles: resolved.roles,
      ...(resolved.actor.personId !== undefined ? { personId: resolved.actor.personId } : {}),
      expiresAt: session.expiresAt.toISOString(), csrfToken: session.csrfToken });
  });

  app.post('/auth/logout', validateOperation('logout'), async (c) => {
    if (!sessionReady) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    const token = sessionTokenFromCookie(c.req.header('Cookie'));
    if (!token || !await authStore!.revokeSession(token)) {
      throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    }
    authResponseHeaders(c);
    const response = c.body(null, 204);
    response.headers.append('Set-Cookie', 'hv_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    return response;
  });

  app.get('/auth/transparency-notice', validateOperation('getTransparencyNotice'), async (c) => {
    if (!transparencyNotice) throw new ApiProblem(404, 'Not found', 'Transparency notice is unavailable.');
    return c.json(transparencyNotice);
  });

  const etag = (c: Context, resource: { version: number }): void => {
    c.header('ETag', etagOf(resource.version));
  };
  // A replay returns the original commit's list tag; a GET uses today's projected list tag.
  const speakerListEtag = async (c: Context, scoped: HvApi, afterWrite = false): Promise<void> => {
    const committedTag = afterWrite ? scoped.lastWriteEtag() : undefined;
    if (committedTag !== undefined) {
      c.header('ETag', committedTag);
      return;
    }
    const meeting = await scoped.getMeeting();
    etag(c, { version: meeting.speakerListVersion });
  };
  const questionFilter = (query: Record<string, unknown>): QuestionFilter => ({
    ...((query['status'] as QuestionStatus[] | undefined)?.length ? { status: query['status'] as QuestionStatus[] } : {}),
    ...(query['track'] !== undefined ? { track: query['track'] as Track } : {}),
    ...(query['unitId'] !== undefined ? { unitId: query['unitId'] as string } : {}),
    ...(query['speakerId'] !== undefined ? { speakerId: query['speakerId'] as string } : {}),
    ...(query['contributionId'] !== undefined ? { contributionId: query['contributionId'] as string } : {}),
    ...(query['agendaItemId'] !== undefined ? { agendaItemId: query['agendaItemId'] as string } : {}),
    ...(query['q'] !== undefined ? { q: query['q'] as string } : {}),
    // Scheibe 046: the validator has already refused an empty or overlong value (422).
    ...(query['parentQuestionId'] !== undefined ? { parentQuestionId: query['parentQuestionId'] as string } : {}),
    ...(query['limit'] !== undefined ? { limit: query['limit'] as number } : {}),
    ...(query['offset'] !== undefined ? { offset: query['offset'] as number } : {}),
  });

  // ---- meeting ----------------------------------------------------------------------------------
  app.get('/v1/meetings', guarded('listMeetings'), async (c) => {
    const status = getValidatedQuery(c)['status'] as Awaited<ReturnType<HvApi['getMeeting']>>['status'] | undefined;
    return c.json(await domain.listMeetings(status));
  });
  app.get('/v1/meetings/:meetingId', guarded('getMeetingById'), async (c) => {
    const meeting = await domain.getMeetingById(requireParam(c, 'meetingId'));
    etag(c, { version: meeting.version ?? 1 });
    return c.json(meeting);
  });
  app.get('/v1/meetings/:meetingId/agenda-items', guarded('listMeetingAgendaItems'), async (c) =>
    c.json(await domain.listMeetingAgendaItems(requireParam(c, 'meetingId'))));
  app.get('/v1/meetings/:meetingId/units', guarded('listMeetingUnits'), async (c) =>
    c.json(await domain.listMeetingUnits(requireParam(c, 'meetingId'))));
  // Scheibe 040b: master data as whole lists. The ETag is the meeting's new version, also on a replay.
  const masterDataResult = async (c: Context, write: (scoped: HvApi, meetingId: string) => Promise<unknown>): Promise<Response> => {
    const meetingId = requireParam(c, 'meetingId');
    const scoped = await meetingDomain(meetingId);
    const result = await write(scoped, meetingId);
    const tag = scoped.lastWriteEtag();
    c.header('ETag', tag ?? etagOf((await scoped.getMeeting()).version ?? 1));
    return c.json(result);
  };
  app.put('/v1/meetings/:meetingId/agenda-items', guarded('replaceMeetingAgendaItems'), (c) => masterDataResult(c, (scoped, meetingId) =>
    scoped.replaceMeetingAgendaItems(meetingId, getValidatedBody<Parameters<HvApi['replaceMeetingAgendaItems']>[1]>(c), writeOptions(c))));
  app.put('/v1/meetings/:meetingId/units', guarded('replaceMeetingUnits'), (c) => masterDataResult(c, (scoped, meetingId) =>
    scoped.replaceMeetingUnits(meetingId, getValidatedBody<Parameters<HvApi['replaceMeetingUnits']>[1]>(c), writeOptions(c))));
  app.get('/v1/meetings/:meetingId/stage-seats', guarded('listMeetingStageSeats'), async (c) => {
    const meetingId = requireParam(c, 'meetingId');
    return c.json(await (await meetingDomain(meetingId)).listMeetingStageSeats(meetingId));
  });
  app.put('/v1/meetings/:meetingId/stage-seats', guarded('replaceMeetingStageSeats'), (c) => masterDataResult(c, (scoped, meetingId) =>
    scoped.replaceMeetingStageSeats(meetingId, getValidatedBody<Parameters<HvApi['replaceMeetingStageSeats']>[1]>(c), writeOptions(c))));
  const agendaResult = async (c: Context, action: 'openAgendaItem' | 'openVoting' | 'closeVoting'): Promise<Response> => {
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const item = await scoped[action](requireParam(c, 'agendaItemId'), writeOptions(c));
    const meeting = await scoped.getMeeting();
    etag(c, { version: meeting.version ?? 1 });
    return c.json(item);
  };
  app.post('/v1/meetings/:meetingId/agenda-items/:agendaItemId/opening', guarded('openAgendaItem'),
    (c) => agendaResult(c, 'openAgendaItem'));
  app.post('/v1/meetings/:meetingId/agenda-items/:agendaItemId/voting/opening', guarded('openVoting'),
    (c) => agendaResult(c, 'openVoting'));
  app.post('/v1/meetings/:meetingId/agenda-items/:agendaItemId/voting/closure', guarded('closeVoting'),
    (c) => agendaResult(c, 'closeVoting'));

  app.get('/v1/meetings/:meetingId/role-assignments', guarded('listRoleAssignments'), async (c) => {
    const query = getValidatedQuery(c);
    return c.json(await (await meetingDomain(requireParam(c, 'meetingId'))).listRoleAssignments({
      ...(query['subjectId'] !== undefined ? { subjectId: query['subjectId'] as string } : {}),
      ...(query['role'] !== undefined ? { role: query['role'] as Role } : {}),
    }));
  });
  app.post('/v1/meetings/:meetingId/role-assignments', guarded('assignRole'), async (c) => {
    const assignment = await (await meetingDomain(requireParam(c, 'meetingId')))
      .assignRole(getValidatedBody<RoleAssignmentCreate>(c), writeOptions(c));
    return c.json(assignment, 201);
  });
  app.post('/v1/meetings/:meetingId/role-assignments/:assignmentId/revocation',
    guarded('revokeRole'), async (c) => {
      const body = getValidatedBody<{ reason?: string } | undefined>(c);
      const assignment = await (await meetingDomain(requireParam(c, 'meetingId')))
        .revokeRole(requireParam(c, 'assignmentId'), body?.reason, writeOptions(c));
      return c.json(assignment);
    });

  app.get('/v1/meetings/:meetingId/speakers', guarded('listMeetingSpeakers'), async (c) => {
    const query = getValidatedQuery(c);
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const speakers = await scoped.listSpeakers({
      ...(query['round'] !== undefined ? { round: query['round'] as number } : {}),
      ...(query['status'] !== undefined ? { status: query['status'] as Speaker['status'] } : {}),
    });
    await speakerListEtag(c, scoped);
    return c.json(speakers);
  });
  app.post('/v1/meetings/:meetingId/speakers', guarded('registerMeetingSpeaker'), async (c) => {
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const speaker = await scoped.registerSpeaker(getValidatedBody<SpeakerRegistration>(c), writeOptions(c));
    await speakerListEtag(c, scoped, true);
    return c.json(speaker, 201);
  });
  app.put('/v1/meetings/:meetingId/speakers/order', guarded('reorderMeetingSpeakers'), async (c) => {
    const body = getValidatedBody<{ round: number; speakerIds: string[] }>(c);
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const speakers = await scoped.reorderSpeakers(body.round, body.speakerIds, writeOptions(c));
    await speakerListEtag(c, scoped, true);
    return c.json(speakers);
  });
  app.get('/v1/meetings/:meetingId/contributions', guarded('listMeetingContributions'), async (c) => {
    const speakerId = getValidatedQuery(c)['speakerId'] as string | undefined;
    return c.json(await (await meetingDomain(requireParam(c, 'meetingId')))
      .listContributions(speakerId !== undefined ? { speakerId } : {}));
  });
  app.post('/v1/meetings/:meetingId/contributions', guarded('captureMeetingContribution'), async (c) => {
    const contribution = await (await meetingDomain(requireParam(c, 'meetingId')))
      .captureMeetingContribution(getValidatedBody<MeetingContributionCapture>(c), writeOptions(c));
    etag(c, contribution);
    return c.json(contribution, 201);
  });
  app.get('/v1/meetings/:meetingId/questions', guarded('listMeetingQuestions'), async (c) => {
    return c.json(await (await meetingDomain(requireParam(c, 'meetingId')))
      .listQuestions(questionFilter(getValidatedQuery(c))));
  });
  app.get('/v1/meetings/:meetingId/stage', guarded('getMeetingStage'), async (c) =>
    c.json(await (await meetingDomain(requireParam(c, 'meetingId'))).getStage()));

  app.get('/v1/meeting', guarded(undefined), async (c) => c.json(await domain.getMeeting()));
  app.get('/v1/agenda-items', guarded(undefined), async (c) => c.json(await domain.listAgendaItems()));
  app.get('/v1/units', guarded(undefined), async (c) => c.json(await domain.listUnits()));

  // ---- speakers -----------------------------------------------------------------------------------
  app.get('/v1/speakers', guarded('listSpeakers'), async (c) => {
    const query = getValidatedQuery(c);
    const round = query['round'] as number | undefined;
    const status = query['status'] as Speaker['status'] | undefined;
    const filter = {
      ...(round !== undefined ? { round } : {}),
      ...(status !== undefined ? { status } : {}),
    };
    const speakers = await domain.listSpeakers(filter);
    await speakerListEtag(c, domain);
    return c.json(speakers);
  });
  app.post('/v1/speakers', guarded('registerSpeaker'), async (c) => {
    const body = getValidatedBody<SpeakerRegistration>(c);
    const speaker = await domain.registerSpeaker(body, writeOptions(c));
    await speakerListEtag(c, domain, true);
    return c.json(speaker, 201);
  });
  app.put('/v1/speakers/order', guarded('reorderSpeakers'), async (c) => {
    const body = getValidatedBody<{ round: number; speakerIds: string[] }>(c);
    const speakers = await domain.reorderSpeakers(body.round, body.speakerIds, writeOptions(c));
    await speakerListEtag(c, domain, true);
    return c.json(speakers);
  });
  app.get('/v1/speakers/:speakerId', guarded('getSpeaker'), async (c) => {
    const speaker = await domain.getSpeaker(requireParam(c, 'speakerId'));
    etag(c, speaker);
    return c.json(speaker);
  });
  app.patch('/v1/speakers/:speakerId', guarded('updateSpeaker'), async (c) => {
    const body = getValidatedBody<SpeakerUpdate>(c);
    const speaker = await domain.updateSpeaker(requireParam(c, 'speakerId'), body, writeOptions(c));
    etag(c, speaker);
    return c.json(speaker);
  });

  // ---- contributions --------------------------------------------------------------------------
  app.get('/v1/contributions', guarded('listContributions'), async (c) => {
    const speakerId = getValidatedQuery(c)['speakerId'] as string | undefined;
    return c.json(await domain.listContributions(speakerId !== undefined ? { speakerId } : {}));
  });
  app.post('/v1/contributions', guarded('captureContribution'), async (c) => {
    const body = getValidatedBody<ContributionCapture>(c);
    const contribution = await domain.captureContribution(body, writeOptions(c));
    etag(c, contribution);
    return c.json(contribution, 201);
  });
  app.get('/v1/contributions/:contributionId', guarded('getContribution'), async (c) => {
    const contribution = await domain.getContribution(requireParam(c, 'contributionId'));
    etag(c, contribution);
    return c.json(contribution);
  });
  app.post('/v1/contributions/:contributionId/questions', guarded('captureQuestions'), async (c) => {
    const body = getValidatedBody<{ questions: QuestionCapture[] }>(c);
    const contributionId = requireParam(c, 'contributionId');
    const questions = await domain.captureQuestions(contributionId, body.questions, writeOptions(c));
    c.header('ETag', domain.lastWriteEtag() ?? etagOf((await domain.getContribution(contributionId)).version));
    return c.json(questions, 201);
  });
  app.post('/v1/contributions/:contributionId/claim', guarded('claimContribution'), async (c) => {
    const contribution = await domain.claimContribution(requireParam(c, 'contributionId'), writeOptions(c));
    etag(c, contribution);
    return c.json(contribution);
  });
  app.post('/v1/contributions/:contributionId/release', guarded('releaseContribution'), async (c) => {
    const contribution = await domain.releaseContribution(requireParam(c, 'contributionId'), writeOptions(c));
    etag(c, contribution);
    return c.json(contribution);
  });

  // ---- questions ----------------------------------------------------------------------------------
  app.get('/v1/questions', guarded('listQuestions'), async (c) => {
    return c.json(await domain.listQuestions(questionFilter(getValidatedQuery(c))));
  });
  app.get('/v1/questions/:questionId', guarded('getQuestion'), async (c) => {
    const question = await domain.getQuestion(requireParam(c, 'questionId'));
    etag(c, question);
    return c.json(question);
  });
  app.get('/v1/questions/:questionId/history', guarded('getQuestionHistory'), async (c) => {
    return c.json(await domain.getQuestionHistory(requireParam(c, 'questionId')));
  });

  const questionResult = (c: Context, question: Question): Response => {
    etag(c, question);
    return c.json(question);
  };

  app.post('/v1/questions/:questionId/classification', guarded('classifyQuestion'), async (c) => {
    const body = getValidatedBody<Classification>(c);
    const question = await domain.classifyQuestion(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/assignment', guarded('assignQuestion'), async (c) => {
    const body = getValidatedBody<{ unitId: string }>(c);
    const question = await domain.assignQuestion(requireParam(c, 'questionId'), body.unitId, writeOptions(c));
    return questionResult(c, question);
  });
  // Scheibe 048: forward to another answering unit. The route only passes through; rights (unit binding
  // included), the row R-TRANS-17 and the guards decide in the core.
  app.post('/v1/questions/:questionId/forwards', guarded('forwardQuestion'), async (c) => {
    const body = getValidatedBody<ForwardRequest>(c);
    const question = await domain.forwardQuestion(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/answers', guarded('draftAnswer'), async (c) => {
    const body = getValidatedBody<AnswerDraft>(c);
    const question = await domain.draftAnswer(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/review-submissions', guarded('submitForReview'), async (c) => {
    const question = await domain.submitForReview(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/approvals', guarded('approveQuestion'), async (c) => {
    const body = getValidatedBody<{ answerVersion: number }>(c);
    const question = await domain.approveQuestion(requireParam(c, 'questionId'), body.answerVersion, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/legal-clearances', guarded('clearQuestionLegally'), async (c) => {
    const body = getValidatedBody<LegalClearanceRequest>(c);
    const question = await domain.clearQuestionLegally(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  // Scheibe 044b: refusal paths A and B. The routes only pass through; rights, transition table and guards
  // decide in the core (`can()`, R-TRANS-15/16), the justification is masked there per reader.
  app.get('/v1/refusal-grounds', guarded('listRefusalGrounds'), async (c) => c.json(await domain.listRefusalGrounds()));
  app.post('/v1/questions/:questionId/refusals', guarded('proposeRefusal'), async (c) => {
    const body = getValidatedBody<RefusalProposal>(c);
    const question = await domain.proposeRefusal(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/refusal-approvals', guarded('approveRefusal'), async (c) => {
    const body = getValidatedBody<{ answerVersion: number }>(c);
    const question = await domain.approveRefusal(requireParam(c, 'questionId'), body.answerVersion, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/returns', guarded('returnQuestion'), async (c) => {
    const body = getValidatedBody<{ reason: string }>(c);
    const question = await domain.returnQuestion(requireParam(c, 'questionId'), body.reason, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/staging', guarded('stageQuestion'), async (c) => {
    const question = await domain.stageQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/delivery', guarded('deliverQuestion'), async (c) => {
    const question = await domain.deliverQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/closure', guarded('closeQuestion'), async (c) => {
    const question = await domain.closeQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/withdrawal', guarded('withdrawQuestion'), async (c) => {
    const body = getValidatedBody<{ reason: string }>(c);
    const question = await domain.withdrawQuestion(requireParam(c, 'questionId'), body.reason, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/merge', guarded('mergeQuestion'), async (c) => {
    const body = getValidatedBody<{ intoQuestionId: string }>(c);
    const question = await domain.mergeQuestion(requireParam(c, 'questionId'), body.intoQuestionId, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/claim', guarded('claimQuestion'), async (c) => {
    const question = await domain.claimQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/release', guarded('releaseQuestion'), async (c) => {
    const question = await domain.releaseQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });

  // ---- stage / events / demo -----------------------------------------------------------------
  app.get('/v1/stage', guarded(undefined), async (c) => c.json(await domain.getStage()));
  app.get('/v1/events', guarded('listEvents'), async (c) => {
    const query = getValidatedQuery(c);
    return c.json(await domain.listEvents(query['after'] as number | undefined, query['limit'] as number | undefined));
  });
  app.post('/v1/demo/seed', guarded('seedDemo'), async (c) => {
    if (!demoEnabled) {
      throw new ApiProblem(403, 'Forbidden', 'Demo endpoints are disabled. Set HV_DEMO=1 to enable them.');
    }
    const body = getValidatedBody<{ questions?: number; seed?: number }>(c);
    const seedOptions = {
      ...(body.questions !== undefined ? { questions: body.questions } : {}),
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
    };
    return c.json(await domain.seedDemo(seedOptions));
  });

  // ---- stream (slice 035b) -----------------------------------------------------------------------------
  // GET /v1/stream (SSE): behind the whole middleware chain and the contract check, without the Postgres boundary and
  // without the `domain` proxy. The pre-checks of the boundary run without a transaction; the delivery reads only the
  // distributor's projection. The request timeout covers the open (the handler returns the response right away).
  app.get('/v1/stream', validateOperation('streamEvents'), createStreamRoute({
    hub: streamHub,
    sessionChecks: streamSessionChecks,
    limits: streamLimits,
    clock,
    actor: currentActor,
    ...(sessionReady ? { session: {
      token: (c: Context) => sessionTokenFromCookie(c.req.header('Cookie')),
      valid: async (token: string) => (await authStore!.readSession(token, clock(), false)) !== null,
    } } : {}),
    ...(options.postgres ? { precheck: async (): Promise<Response | undefined> => {
      const timedPool = withQueryTimers(options.postgres!, limits.queryTimeoutMs);
      if ((await getMigrationStatus(timedPool)).pending) return streamUnavailable('Migrations are pending.');
      await assertRuntimePrivileges(timedPool);
      return undefined;
    } } : {}),
    notice: (text) => notices.once(text),
    ...(hooks?.streamHandover ? { handoverHook: hooks.streamHandover } : {}),
  }));

  return app;
}
