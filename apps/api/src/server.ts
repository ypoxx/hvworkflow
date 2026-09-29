/**
 * Starts the HV-Tool API as a standalone Node process. `app.ts` is the part under test — this file
 * only wires it to a socket, so `pnpm --filter @hv/api dev`/`start` and the test suite's
 * `app.request()` stay a one-line difference. `seedOnStart` only has an effect when `HV_DEMO=1`
 * (rework review major 5: `dev` sets it so the acceptance criterion is reproducible on its own;
 * production is unaffected because `HV_DEMO` stays unset there).
 *
 * Slice 034b: the configuration schema runs first, before any socket, pool or file is opened. A violation writes
 * one fixed sentence per rule to stderr (never a value) and ends the process with exit 1. Every value then goes to
 * `createApp` explicitly, so the `process.env` fallbacks of `app.ts` are never reached at process start.
 */
import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import { systemClock } from '@hv/domain';
import { createApp } from './app.ts';
import { createNtpClockCheck } from './clock/ntp.ts';
import { appOptionsOf } from './config/appOptions.ts';
import { ConfigError, readServiceConfig, type ServiceConfig } from './config/schema.ts';
import { formatStartLine, formatUnknownVariables } from './config/startLine.ts';
import { postgresPoolOptions } from './limits/poolOptions.ts';
import { createFileSink, discardSink } from './observability/accessLog.ts';

let config: ServiceConfig;
try {
  config = readServiceConfig(process.env);
} catch (error) {
  if (error instanceof ConfigError) for (const line of error.sentences) console.error(line);
  else console.error('HV-Tool API: refusing to start: invalid configuration.');
  process.exit(1);
}
const unknownLine = formatUnknownVariables(config.unknownVariables);
if (unknownLine !== undefined) console.error(unknownLine);

// Slice 034a: statement, lock and idle-in-transaction timeouts as connection parameters (one testable function).
const postgres = config.databaseUrl !== undefined
  ? new Pool(postgresPoolOptions({ connectionString: config.databaseUrl, tls: config.dbTls,
    limits: { lockTimeoutMs: config.limits.lockTimeoutMs, statementTimeoutMs: config.limits.statementTimeoutMs,
      idleInTransactionTimeoutMs: config.limits.idleInTransactionTimeoutMs } }))
  : undefined;
postgres?.on('error', () => {
  // Driver error objects can contain connection details; the pool can reconnect on a later request.
  console.error('HV-Tool API: Postgres pool connection failed.');
});
const app = createApp({ ...appOptionsOf(config), seedOnStart: postgres === undefined,
  monotonic: () => performance.now(), // now-ok: latency needs a monotonic source that a wall-clock step cannot bend
  accessLog: { sink: config.accessLog.dir === undefined ? discardSink
    : createFileSink({ dir: config.accessLog.dir, retentionDays: config.accessLog.retentionDays, clock: systemClock }),
  hashKey: config.accessLog.hashKey },
  ...(config.ntp !== undefined ? { clockHealth: createNtpClockCheck({ ...config.ntp, clock: systemClock }) } : {}),
  ...(postgres !== undefined ? { postgres } : {}) });

// Slice 034a: against slowly trickling headers and bodies. Node checks these limits only every
// `connectionsCheckingInterval` (default 30 s), so `headersTimeout` alone acts between 10 s and 40 s; the interval
// is lowered to 5 s (10 to 15 s). Node answers a breach itself with an empty 408 and `Connection: close`, before a
// request reaches the application: that answer has no security headers and no access log line (named exception,
// spec decision 7; visibility and limit at the proxy, slice 037). These three numbers stay fixed.
serve({ fetch: app.fetch, port: config.port,
  serverOptions: { headersTimeout: 10_000, requestTimeout: 30_000, connectionsCheckingInterval: 5_000 } }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`HV-Tool API listening on http://localhost:${info.port}`);
  // eslint-disable-next-line no-console
  console.log(formatStartLine(config));
  if (config.auth === 'none' && !config.demo) {
    // eslint-disable-next-line no-console
    console.warn(
      'HV-Tool API: no complete sign-in configuration is present — protected requests are answered with 401; X-Actor is ignored.',
    );
  }
});
