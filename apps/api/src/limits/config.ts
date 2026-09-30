/**
 * The fixed defaults of slice 034a (docs/slices/034a-...md, table "Feste Zahlen"). `createApp` takes any of
 * them as an option so tests can lower a limit; the process start uses these values unchanged. Slice 034b
 * reads the configurable ones from the environment and changes no default. Nothing here reads a clock.
 */

/** One counting window: fixed windows over the injected clock (`floor(ms / 60 000)`). Not configurable. */
export const WINDOW_MS = 60_000;

/** Every counter holds at most this many keys per window; further new keys share one overflow key. */
export const MAX_COUNTER_KEYS = 10_000;

/** Body limit of a request in bytes (256 KiB). A raise is a spec change, so it is not an option. */
export const BODY_LIMIT_BYTES = 262_144;

/** One readiness probe is cut off after this long; three of them stay under the request timeout. */
export const READINESS_CHECK_TIMEOUT_MS = 2_000;

export interface LimitsConfig {
  /** Request timeout of the service (408), ms. */
  requestTimeoutMs: number;
  /** Own timer per Postgres query (`QueryTimeoutError`), ms. */
  queryTimeoutMs: number;
  /** Postgres connection parameters, ms. */
  lockTimeoutMs: number;
  statementTimeoutMs: number;
  idleInTransactionTimeoutMs: number;
  /** Deadline of each OIDC call (discovery, authorization URL, token exchange), ms. */
  oidcTimeoutMs: number;
  /** Requests per window: per subject. */
  writePerSubject: number;
  readPerSubject: number;
  /** Requests per window: per source (the peer of the TCP connection). */
  anonymousPerSource: number;
  loginPerSource: number;
  probePerSource: number;
  preflightPerSource: number;
  /** `GET /auth/login` per window over all sources. */
  loginTotal: number;
  /** Keys per counter and window before the overflow key takes over (a test may lower it). */
  maxKeys: number;
}

export const DEFAULT_LIMITS: Readonly<LimitsConfig> = {
  requestTimeoutMs: 10_000,
  queryTimeoutMs: 6_000,
  lockTimeoutMs: 3_000,
  statementTimeoutMs: 5_000,
  idleInTransactionTimeoutMs: 15_000,
  oidcTimeoutMs: 5_000,
  writePerSubject: 60,
  readPerSubject: 1_200,
  anonymousPerSource: 600,
  loginPerSource: 120,
  probePerSource: 600,
  preflightPerSource: 1_200,
  loginTotal: 600,
  maxKeys: MAX_COUNTER_KEYS,
};

export function resolveLimits(over: Partial<LimitsConfig> | undefined): LimitsConfig {
  const resolved: LimitsConfig = { ...DEFAULT_LIMITS };
  for (const [name, value] of Object.entries(over ?? {})) {
    if (value !== undefined) (resolved as unknown as Record<string, number>)[name] = value;
  }
  return resolved;
}

// ---- SSE stream (slice 035b, decision 7) -------------------------------------------------------------------------
// Fixed values of the spec. `createApp` takes `streamLimits` for tests, which may only lower a value (a raise is a
// spec change); they are never read from the environment.

/** Heartbeat of an open stream: a comment line, the occasion of the per-stream rights and session check. */
export const STREAM_HEARTBEAT_MS = 15_000;
/** Open streams per session (demo header: per actor). Beyond: 429. */
export const STREAMS_PER_SESSION = 3;
/** Open streams per subject, over all its sessions (several devices of one person). Beyond: 429. */
export const STREAMS_PER_SUBJECT = 6;
/** Open streams per process. Beyond: 503 `StreamUnavailable`. */
export const STREAMS_PER_PROCESS = 200;
/** Lifetime of one stream; then `end {rotate}` and the client reconnects with `Last-Event-ID`. */
export const STREAM_LIFETIME_MS = 25 * 60_000;
/** Longest catch-up in events; a longer range is answered with `reset`. */
export const STREAM_REPLAY_MAX = 1_000;
/** Queued, not yet sent live messages per connection (count and bytes); beyond, the connection closes. */
export const STREAM_BACKLOG_MESSAGES = 256;
export const STREAM_BACKLOG_BYTES = 1_048_576;
/** `Retry-After` of the stream's own 429 and 503 answers (within the contract's 1 to 60). */
export const STREAM_RETRY_AFTER_SECONDS = 30;
/** Reload tick of the distributor while streams are open (writes of other instances). */
export const STREAM_RELOAD_TICK_MS = 1_000;
/** Earliest spacing between two reloads (batches) of the distributor. */
export const STREAM_BATCH_SPACING_MS = 250;
/** On open, a distributor projection older than this is reloaded first (a role assigned just now counts). */
export const STREAM_OPEN_FRESHNESS_MS = 1_000;
/** Concurrent session checks of all streams (pool connections they may take at once). */
export const STREAM_SESSION_CHECKS = 2;

export interface StreamLimits {
  heartbeatMs: number;
  perSession: number;
  perSubject: number;
  perProcess: number;
  lifetimeMs: number;
  replayMax: number;
  backlogMessages: number;
  backlogBytes: number;
}

export const DEFAULT_STREAM_LIMITS: Readonly<StreamLimits> = {
  heartbeatMs: STREAM_HEARTBEAT_MS,
  perSession: STREAMS_PER_SESSION,
  perSubject: STREAMS_PER_SUBJECT,
  perProcess: STREAMS_PER_PROCESS,
  lifetimeMs: STREAM_LIFETIME_MS,
  replayMax: STREAM_REPLAY_MAX,
  backlogMessages: STREAM_BACKLOG_MESSAGES,
  backlogBytes: STREAM_BACKLOG_BYTES,
};

/** Only a lower positive value is taken: a test may tighten a stream limit, never widen it. */
export function resolveStreamLimits(over: Partial<StreamLimits> | undefined): StreamLimits {
  const resolved: StreamLimits = { ...DEFAULT_STREAM_LIMITS };
  for (const [name, value] of Object.entries(over ?? {}) as [keyof StreamLimits, number | undefined][]) {
    if (value !== undefined && Number.isFinite(value) && value > 0 && value < resolved[name]) resolved[name] = value;
  }
  return resolved;
}
