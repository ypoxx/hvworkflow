/**
 * Starts the HV-Tool API as a standalone Node process. `app.ts` is the part under test — this file
 * only wires it to a socket, so `pnpm --filter @hv/api dev`/`start` and the test suite's
 * `app.request()` stay a one-line difference. `seedOnStart` only has an effect when `HV_DEMO=1`
 * (rework review major 5: `dev` sets it so the acceptance criterion is reproducible on its own;
 * production is unaffected because `HV_DEMO` stays unset there).
 */
import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import { systemClock } from '@hv/domain';
import { createApp } from './app.ts';
import { createNtpClockCheck, parseNtpEnv } from './clock/ntp.ts';
import { postgresPoolOptions } from './limits/poolOptions.ts';
import { createFileSink, discardSink } from './observability/accessLog.ts';
import { readMetricsToken, readObservabilityConfig } from './observability/config.ts';

// Slice 033a: the access log cannot be switched off outside demo mode. Fixed sentences, no values.
let observability: ReturnType<typeof readObservabilityConfig>;
let ntp: ReturnType<typeof parseNtpEnv>;
let metricsToken: string | undefined;
try {
  observability = readObservabilityConfig(process.env);
  ntp = parseNtpEnv(process.env);
  metricsToken = readMetricsToken(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'HV-Tool API: refusing to start: invalid configuration.');
  process.exit(1);
}

const port = Number.parseInt(process.env['PORT'] ?? '8787', 10);
const databaseUrl = process.env['HV_DATABASE_URL'];
if (databaseUrl && process.env['HV_EVENT_LOG']) {
  throw new Error('Configure either Postgres or the JSONL development log.');
}
// Slice 034a: statement, lock and idle-in-transaction timeouts as connection parameters (one testable function).
const postgres = databaseUrl
  ? new Pool(postgresPoolOptions({ connectionString: databaseUrl, tls: process.env['HV_DB_TLS'] === '1' }))
  : undefined;
postgres?.on('error', () => {
  // Driver error objects can contain connection details; the pool can reconnect on a later request.
  console.error('HV-Tool API: Postgres pool connection failed.');
});
const app = createApp({ seedOnStart: postgres === undefined,
  monotonic: () => performance.now(), // now-ok: latency needs a monotonic source that a wall-clock step cannot bend
  accessLog: { sink: observability.dir === undefined ? discardSink
    : createFileSink({ dir: observability.dir, retentionDays: observability.retentionDays, clock: systemClock }),
  hashKey: observability.hashKey },
  ...(metricsToken !== undefined ? { metricsToken } : {}),
  ...(ntp !== undefined ? { clockHealth: createNtpClockCheck({ ...ntp, clock: systemClock }) } : {}),
  ...(postgres !== undefined ? { postgres } : {}) });

const server = serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`HV-Tool API listening on http://localhost:${info.port}`);
  if (process.env['HV_DEMO'] !== '1' && !(postgres && process.env['HV_OIDC_ISSUER'] &&
      process.env['HV_OIDC_CLIENT_ID'] && process.env['HV_OIDC_CLIENT_SECRET'] &&
      process.env['HV_OIDC_REDIRECT_URI'] && process.env['HV_AUTH_ENCRYPTION_KEY'])) {
    // eslint-disable-next-line no-console
    console.warn(
      'HV-Tool API: no complete sign-in configuration is present — protected requests are answered with 401; X-Actor is ignored.',
    );
  }
});

// Slice 034a: against slowly trickling headers and bodies. Node answers these two limits itself with an empty
// 408 and `Connection: close`, before a request reaches the application: that answer has no security headers
// and no access log line (named exception, spec decision 7; visibility and limit at the proxy, slice 037).
const nodeServer = server as unknown as { headersTimeout: number; requestTimeout: number };
nodeServer.headersTimeout = 10_000;
nodeServer.requestTimeout = 30_000;
