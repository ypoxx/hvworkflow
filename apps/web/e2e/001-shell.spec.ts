/**
 * Slice 001 — the shell. Proves the three things a reviewer has to see with their own eyes: the
 * synthetic corpus really is behind the counters, the role can be switched to the podium persona,
 * and switching the language actually changes every visible string, header included.
 */
import { expect, test } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const SEEDED_QUESTIONS = 800;

test.use({ viewport: { width: 1440, height: 900 } });

test('shell: counters, role switch, language switch @screenshot', async ({ page }) => {
  await page.goto('/');

  // The day starts on the speakers list.
  await expect(page).toHaveURL(/\/speakers$/);

  // Seeding runs once on first start; the counters are the proof that the corpus is there.
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), {
      timeout: 90_000,
    })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);

  for (const testId of [
    'header-meeting-title',
    'header-counter-speakers',
    'header-counter-open',
    'header-counter-staged',
    'role-switcher',
    'lang-toggle',
    'demo-reset',
    'nav-speakers',
    'nav-capture',
    'nav-answers',
    'nav-stage',
    'nav-history',
  ]) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }

  // Rights are data: switching the persona is the only role decision in the interface.
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-podium').click();
  await expect(page.getByTestId('role-switcher')).toContainText('Podium');

  const headerTitle = page.getByTestId('header-meeting-title');
  await expect(headerTitle).toContainText('Runde');

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('001-shell.png') });

  // Every visible string changes with the language, including the header.
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(headerTitle).toContainText('Round');
  await expect(headerTitle).not.toContainText('Runde');
  await expect(page.getByTestId('nav-speakers')).toContainText('Requests to speak');
  await expect(page.getByTestId('header-counter-open')).toContainText('Open');

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('001-shell-en.png') });
});
