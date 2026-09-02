/**
 * Starts the HV-Tool API as a standalone Node process. `app.ts` is the part under test — this file
 * only wires it to a socket, so `pnpm --filter @hv/api dev` and the production entry point stay a
 * one-line difference from `app.request()` in the test suite.
 */
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';

const port = Number.parseInt(process.env['PORT'] ?? '8787', 10);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`HV-Tool API listening on http://localhost:${info.port}`);
});
