import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end gate. Runs against the Vite dev server so that several agents can test in parallel on
 * different ports (E2E_PORT) without fighting over `dist/`. CI uses the default port.
 * The remote build environment ships a pinned Chromium; PW_CHROMIUM_PATH overrides the binary.
 */
const port = Number(process.env['E2E_PORT'] ?? 4173);
const pinnedChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env['PW_CHROMIUM_PATH'] ?? (existsSync(pinnedChromium) ? pinnedChromium : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 1440, height: 900 },
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: `pnpm exec vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
