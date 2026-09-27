/**
 * Starts the HV-Tool API as a standalone Node process. `app.ts` is the part under test — this file
 * only wires it to a socket, so `pnpm --filter @hv/api dev`/`start` and the test suite's
 * `app.request()` stay a one-line difference. `seedOnStart` only has an effect when `HV_DEMO=1`
 * (rework review major 5: `dev` sets it so the acceptance criterion is reproducible on its own;
 * production is unaffected because `HV_DEMO` stays unset there).
 */
import { serve } from '@hono/node-server';
import { Pool } from 'pg';
import { createApp } from './app.ts';

const port = Number.parseInt(process.env['PORT'] ?? '8787', 10);
const databaseUrl = process.env['HV_DATABASE_URL'];
if (databaseUrl && process.env['HV_EVENT_LOG']) {
  throw new Error('Configure either Postgres or the JSONL development log.');
}
const postgres = databaseUrl
  ? new Pool({ connectionString: databaseUrl,
    connectionTimeoutMillis: 2_000,
    ...(process.env['HV_DB_TLS'] === '1' ? { ssl: { rejectUnauthorized: true } } : {}) })
  : undefined;
postgres?.on('error', () => {
  // Driver error objects can contain connection details; the pool can reconnect on a later request.
  console.error('HV-Tool API: Postgres pool connection failed.');
});
const app = createApp({ seedOnStart: postgres === undefined,
  ...(postgres !== undefined ? { postgres } : {}) });

serve({ fetch: app.fetch, port }, (info) => {
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
