/**
 * Slice 080: the Wortmeldeliste without kind (Art) and speaking time (Redezeit), in German and in
 * American English, with axe on both. Evidence: docs/evidence/080-wortmeldeliste-{de,en}.png.
 */
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';

const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

test.use({ viewport: { width: 1440, height: 900 } });

test('080: Wortmeldeliste ohne Art und Redezeit, DE und EN @screenshot', async ({ page }) => {
  await page.goto('/speakers');
  const counter = page.getByTestId('header-counter-questions');
  await expect(counter).toBeVisible({ timeout: 90_000 });

  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-moderation').click();

  const round = page.getByTestId('speakers-round-3');
  await expect(round.locator('[data-testid="speaker-row"]').first()).toBeVisible();
  // The row grid closes without a gap: six columns, no kind, no requested or running time.
  const columns = await round
    .locator('[data-testid="speaker-row"]')
    .first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(6);
  await expect(page.getByTestId('speaker-timer-ring')).toHaveCount(0);
  for (const gone of ['Art', 'Angemeldet', 'Läuft', 'Redezeit']) {
    await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
  }
  await checkAxe(page, '080 speakers (de)');
  await page.screenshot({ path: evidence('080-wortmeldeliste-de.png') });

  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  for (const gone of ['Kind', 'Requested', 'Running', 'Speaking time']) {
    await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
  }
  await checkAxe(page, '080 speakers (en)');
  await page.screenshot({ path: evidence('080-wortmeldeliste-en.png') });

  // The register dialog asks only for name, organisation and round.
  await page.getByTestId('speaker-register').click();
  await expect(page.getByRole('dialog').locator('select')).toHaveCount(1);
  await expect(page.getByRole('dialog').locator('input[type="number"]')).toHaveCount(0);
});
