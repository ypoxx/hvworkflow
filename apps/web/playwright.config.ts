import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
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
 *
 * Takt-035: the HTTP mode is a production build behind `vite preview`, not the dev server (which renders `<StrictMode>`
 * with doubled mount effects and compiles modules on demand, inflating timings). `HV_WEB_MODE` is a build-time `define`,
 * so it is set for the build step too. `vite preview` takes `preview.proxy ?? server.proxy` (Vite 8), so `/v1` and `/auth`
 * reach the service exactly as in dev. The `in-process` project stays on the dev server.
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
/**
 * Slice 031b: the five files that run in both projects. They need signed-in states, so they join the `http` project only
 * with an IdP, never in the local mode. With one worker Playwright runs the files in the order of their paths (002, 021b,
 * 021c, 030, 031, 080, abnahme); `scripts/e2e-http-031.test.mjs` pins that order, because every file starts from the
 * database state its predecessors leave behind.
 */
const SHARED_SPECS = [
  '002-speakers-capture.spec.ts', '021b-koordination.spec.ts', '021c-rechtsfreigabe.spec.ts',
  '041-verwaltung.spec.ts', '045-verweigerung.spec.ts', '046-nachfragen.spec.ts', '053-steuerung.spec.ts', '054-fokusansicht.spec.ts', '055b-antwortformat.spec.ts',
  '061-leitstand.spec.ts', '080-sprecher-zustand.spec.ts', 'abnahme.spec.ts',
];
const HTTP_SETUP = 'http/anmeldung.setup.ts';

const launch = executablePath ? { launchOptions: { executablePath } } : {};

/**
 * Security (decision 4): no trace, no video in the HTTP projects: they would hold the values typed into the
 * Keycloak form, i.e. the passwords of the test persons. Failure screenshots stay.
 */
// The failure report of Playwright (`error-context.md`, a page snapshot) can hold the text typed into a password field, and
// the variable `PLAYWRIGHT_NO_COPY_PROMPT` does not stop it for a failed matcher (probe, slice 031a review). So the output
// of both HTTP projects goes into the private state directory of the harness, which is removed with the temporary directory.
// An empty or blank value counts as absent (never a root-level path such as '/web-build', which `--emptyOutDir` would wipe).
const stateDir = process.env['E2E_HTTP_STATE_DIR']?.trim() || undefined;
// Build output of the HTTP project: private and per run under the state directory; without it below `node_modules` of this
// package (git ignores it, and it is not `dist/`, which the gates build and parallel agents use).
// Without the state directory the fallback is per run (process id), so two runs never share or empty each other's build.
const httpBuildDir = `${stateDir ?? join(import.meta.dirname, `node_modules/.e2e-http-build-${process.pid}`)}/web-build`;
// The path goes into a shell command inside single quotes: a single quote in it would end the quoting (injection).
if (!isAbsolute(httpBuildDir) || dirname(resolve(httpBuildDir)) === '/') {
  throw new Error('E2E_HTTP_STATE_DIR must be an absolute path below the root directory.');
}
if (httpBuildDir.includes("'")) throw new Error('E2E_HTTP_STATE_DIR must not contain a single quote.');
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
        testMatch: withoutIdp ? HTTP_SPECS : [...HTTP_SPECS, ...SHARED_SPECS],
        ...httpOutput,
        ...(withoutIdp ? { grepInvert: /@idp/ } : { dependencies: ['http-setup'] }),
        // The default person of the demo is `DEMO_ACTORS[1]` (capture); 030 and H1-H3 set an empty state themselves.
        use: withoutIdp || !stateDir ? httpUse : { ...httpUse, storageState: `${stateDir}/state-capture.json` },
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
        // Single quotes keep a path with spaces in one piece; a quote in the path is not expected (private temp directory).
        command: `pnpm exec vite build --outDir '${httpBuildDir}' --emptyOutDir && ` +
          `pnpm exec vite preview --outDir '${httpBuildDir}' --port ${httpPort} --strictPort`,
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
