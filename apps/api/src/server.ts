/**
 * Starts the HV-Tool API as a standalone Node process. `app.ts` is the part under test — this file
 * only wires it to a socket, so `pnpm --filter @hv/api dev`/`start` and the test suite's
 * `app.request()` stay a one-line difference. `seedOnStart` only has an effect when `HV_DEMO=1`
 * (rework review major 5: `dev` sets it so the acceptance criterion is reproducible on its own;
 * production is unaffected because `HV_DEMO` stays unset there).
 */
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';

const port = Number.parseInt(process.env['PORT'] ?? '8787', 10);
const app = createApp({ seedOnStart: true });

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`HV-Tool API listening on http://localhost:${info.port}`);
  if (process.env['HV_DEMO'] !== '1') {
    // Slice 029a (BF-01): without demo mode there is no sign-in path yet, so every /v1 call is a 401.
    // eslint-disable-next-line no-console
    console.warn(
      'HV-Tool API: demo mode is off (HV_DEMO is not 1) and no other sign-in is set up — every /v1 request is answered with 401; X-Actor is ignored.',
    );
  }
});
