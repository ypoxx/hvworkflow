import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';

// Existing demo tests run in the default build. These cases exercise the separate HTTP build.
const nodeEnvironment = globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
test.skip(nodeEnvironment.process?.env?.['HV_WEB_MODE'] !== 'http', 'HTTP build only');

const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const notice = {
  version: 'beta-1',
  text: { de: 'Datenschutz für die interne Beta.', en: 'Privacy notice for the internal beta.' },
  dataProtectionSummaryUrl: 'https://example.org/privacy-summary',
};

async function unsigned(page: import('@playwright/test').Page, available = true) {
  await page.route('**/auth/me', (route) => route.fulfill({
    status: 401,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status: 401, title: 'Unauthorized', detail: 'Session required' }),
  }));
  await page.route('**/auth/transparency-notice', (route) => route.fulfill(available
    ? { status: 200, contentType: 'application/json', body: JSON.stringify(notice) }
    : { status: 404, contentType: 'application/problem+json', body: JSON.stringify({ status: 404, title: 'Not found', detail: 'Unavailable' }) }));
}

test('HTTP sign-in shows DE/EN notice and safe local return path @screenshot', async ({ page }) => {
  await unsigned(page);
  await page.goto('/speakers?round=2');
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText(notice.text.de)).toBeVisible();
  await expect(page.getByText(notice.text.en)).toBeVisible();
  await expect(page.getByText('Rechtlich noch ungeprüft')).toBeVisible();
  await expect(page.getByRole('link', { name: /Datenschutz-Folgenabschätzung/ })).toHaveAttribute('href', notice.dataProtectionSummaryUrl);
  await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/auth/login?returnTo=%2Fspeakers%3Fround%3D2');
  await expect(page.getByTestId('role-switcher')).toHaveCount(0);
  await expect(page.getByTestId('demo-reset')).toHaveCount(0);
  await checkAxe(page, 'HTTP sign-in (German)');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('030-login-de.png'), fullPage: true });

  await page.getByTestId('lang-option-en').click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.screenshot({ path: evidence('030-login-en.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Data protection impact/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeFocused();
  await page.screenshot({ path: evidence('030-login-mobile.png'), fullPage: true });
});

test('HTTP sign-in remains blocked when the notice is unavailable', async ({ page }) => {
  await unsigned(page, false);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Transparenzhinweis');
  await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveCount(0);
});

test('HTTP session shows the server role and confirms logout with CSRF', async ({ page }) => {
  const csrfToken = 'a'.repeat(32);
  let logoutHeader: string | null = null;
  await page.route('**/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      scheme: 'session',
      actor: { id: 'subject-1', role: 'capture', displayName: 'Erfassung' },
      subjectId: 'subject-1', roles: ['capture'], expiresAt: '2026-09-30T00:00:00Z', csrfToken,
    }),
  }));
  await page.route('**/auth/transparency-notice', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(notice) }));
  await page.route('**/auth/logout', (route) => {
    logoutHeader = route.request().headers()['x-csrf-token'] ?? null;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/v1/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname === '/v1/meeting'
      ? { id: 'meeting-1', title: 'Interne Beta', legalEntity: 'Test AG', status: 'running', currentRound: 1,
          counts: { speakers: 0, questions: 0, open: 0, byStatus: {
            captured: 0, classified: 0, assigned: 0, answer_drafted: 0, in_review: 0,
            approved: 0, staged: 0, delivered: 0, closed: 0, withdrawn: 0, merged: 0,
          } } }
      : pathname === '/v1/questions' ? { items: [], total: 0 } : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });

  await page.goto('/speakers');
  await expect(page.getByTestId('session-role')).toContainText('Erfassung');
  await expect(page.getByTestId('role-switcher')).toHaveCount(0);
  await expect(page.getByTestId('demo-reset')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  expect(logoutHeader).toBe(csrfToken);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('hv-demo')))).toEqual([]);
});

test('HTTP session without an active role offers sign-out only and returns to sign-in @screenshot', async ({ page }) => {
  const csrfToken = 'c'.repeat(43);
  let signedOut = false;
  let logoutHeader: string | null = null;
  await page.route('**/auth/me', (route) => route.fulfill(signedOut
    ? { status: 401, contentType: 'application/problem+json', body: JSON.stringify({ status: 401, title: 'Unauthorized', detail: 'Session required' }) }
    : { status: 403, contentType: 'application/problem+json',
      body: JSON.stringify({ type: 'urn:hv:problem:403', status: 403, title: 'Forbidden', detail: 'No active role assignment.', csrfToken }) }));
  await page.route('**/auth/transparency-notice', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(notice) }));
  await page.route('**/auth/logout', (route) => {
    logoutHeader = route.request().headers()['x-csrf-token'] ?? null;
    signedOut = true;
    return route.fulfill({ status: 204 });
  });

  await page.goto('/speakers');
  await expect(page.getByRole('heading', { name: 'Keine aktive Rolle' })).toBeVisible();
  await expect(page.getByText('Für Ihr Konto ist derzeit keine Rolle aktiv.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveCount(0);
  await expect(page.getByTestId('role-switcher')).toHaveCount(0);
  await checkAxe(page, 'HTTP no active role (German)');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('takt-023-rollenverlust.png'), fullPage: true });

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  expect(logoutHeader).toBe(csrfToken);
});
