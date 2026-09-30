import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * End-to-end gate. Runs against the Vite dev server so that several agents can test in parallel on
 * different ports (E2E_PORT) without fighting over `dist/`. CI uses the default port.
 * The remote build environment ships a pinned Chromium; PW_CHROMIUM_PATH overrides the binary.
 *
 * Slice 031a: two ways to run the interface. `in-process` is the demo (the domain runs in the browser); `http`
 * drives the HTTP mode against the real service, Postgres and a Keycloak test realm. `http-setup` and `http` exist
 * only when the harness (`scripts/e2e-http-031.mjs`) sets `E2E_HTTP=1`; without it `pnpm --filter @hv/web e2e`
 * behaves as before. `E2E_HTTP_IDP=none` is the local mode without Keycloak (no Docker on the workstation): no setup
 * project, no default state, only the tests that need no sign-in.
 */
const port = Number(process.env['E2E_PORT'] ?? 4173);
const httpEnabled = process.env['E2E_HTTP'] === '1';
const withoutIdp = process.env['E2E_HTTP_IDP'] === 'none';
const httpPort = Number(process.env['E2E_HTTP_PORT'] ?? 4174);
const httpApiOrigin = process.env['E2E_HTTP_API_ORIGIN'] ?? 'http://localhost:18091';
const pinnedChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env['PW_CHROMIUM_PATH'] ?? (existsSync(pinnedChromium) ? pinnedChromium : undefined);

/** Files of the HTTP project, in the order they run (`scripts/e2e-http-031.test.mjs` pins it). 031b extends the list. */
const HTTP_SPECS = ['030-anmeldung.spec.ts', '031-http-betriebsart.spec.ts'];
const HTTP_SETUP = 'http/anmeldung.setup.ts';

const launch = executablePath ? { launchOptions: { executablePath } } : {};

/**
 * Security (decision 4): no trace, no video in the HTTP projects: they would hold the values typed into the
 * Keycloak form, i.e. the passwords of the test persons. Failure screenshots stay.
 */
// The failure report of Playwright (`error-context.md`, a page snapshot) can hold the text typed into a password field, and
// the variable `PLAYWRIGHT_NO_COPY_PROMPT` does not stop it for a failed matcher (probe, slice 031a review). So the output
// of both HTTP projects goes into the private state directory of the harness, which is removed with the temporary directory.
const stateDir = process.env['E2E_HTTP_STATE_DIR'];
const httpOutput = stateDir ? { outputDir: `${stateDir}/test-results` } : {};

const httpUse = {
  ...devices['Desktop Chrome'],
  baseURL: `http://localhost:${httpPort}`,
  trace: 'off',
  video: 'off',
  screenshot: 'only-on-failure',
} as const;

const httpProjects: NonNullable<PlaywrightTestConfig['projects']> = httpEnabled
  ? [
      ...(withoutIdp ? [] : [{ name: 'http-setup', testMatch: HTTP_SETUP, ...httpOutput, use: httpUse }]),
      {
        name: 'http',
        testMatch: HTTP_SPECS,
        ...httpOutput,
        ...(withoutIdp ? { grepInvert: /@idp/ } : { dependencies: ['http-setup'] }),
        use: httpUse,
      },
    ]
  : [];

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  // The HTML report shows `fill` values, i.e. the passwords typed in the HTTP project: only the list reporter then.
  reporter: httpEnabled ? [['list']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1440, height: 900 },
    ...launch,
  },
  // The demo server exists only without the HTTP run: `in-process` does not run with `E2E_HTTP=1` (slice 031a review).
  webServer: httpEnabled
    ? [{
        command: `pnpm exec vite --port ${httpPort} --strictPort`,
        url: `http://localhost:${httpPort}`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { HV_WEB_MODE: 'http', HV_API_ORIGIN: httpApiOrigin },
      }]
    : [{
        command: `pnpm exec vite --port ${port} --strictPort`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        timeout: 120_000,
      }],
  projects: [
    {
      name: 'in-process',
      testIgnore: [...HTTP_SPECS.map((name) => `**/${name}`), `**/${HTTP_SETUP}`],
      use: { ...devices['Desktop Chrome'] },
    },
    ...httpProjects,
  ],
});
