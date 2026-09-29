/**
 * Options of the service's Postgres pool (slice 034a, decision 8), in one testable function that
 * `server.ts` uses. The three timeouts are connection parameters, so the server enforces them whatever the
 * client does; the client-side per-query timer is the service's own (`timedQuery` in `postgres.ts`), and the
 * driver's `query_timeout` stays unset on purpose (it reports as a plain `Error` without code).
 * The pool of the migration CLI is not built here: DDL may run longer.
 */
import type { PoolConfig } from 'pg';
import { DEFAULT_LIMITS, type LimitsConfig } from './config.ts';

export function postgresPoolOptions(input: {
  connectionString: string;
  tls?: boolean;
  limits?: Partial<Pick<LimitsConfig, 'lockTimeoutMs' | 'statementTimeoutMs' | 'idleInTransactionTimeoutMs'>>;
  /** Extra pass-through options for tests (`options`, `application_name`, `max`). */
  extra?: Partial<PoolConfig>;
}): PoolConfig {
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  return {
    connectionString: input.connectionString,
    connectionTimeoutMillis: 2_000,
    statement_timeout: limits.statementTimeoutMs,
    lock_timeout: limits.lockTimeoutMs,
    idle_in_transaction_session_timeout: limits.idleInTransactionTimeoutMs,
    ...(input.tls === true ? { ssl: { rejectUnauthorized: true } } : {}),
    ...input.extra,
  };
}
