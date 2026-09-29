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
