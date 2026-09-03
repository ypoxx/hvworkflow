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

  // The process strip (005) carries these testids on its own segment labels now, one per workflow
  // stage, each with a real count next to it — not just a decorative bar.
  await expect(page.getByTestId('header-counter-drafting')).toContainText(/\d/);
  await expect(page.getByTestId('header-counter-staged')).toContainText(/\d/);

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

test('header strip on the answers desk @screenshot', async ({ page }) => {
  await page.goto('/answers');

  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), {
      timeout: 90_000,
    })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
  await expect(page.getByTestId('header-counter-staged')).toBeVisible();

  // Design review rework: the counters pill must never force the meeting title to truncate at
  // 1440px. Measure both directly instead of trusting a screenshot to reveal it.
  const pill = page.locator('[aria-label="Zählwerk"]');
  const pillBox = await pill.boundingBox();
  expect(pillBox).not.toBeNull();
  if (pillBox === null) throw new Error('header counters pill not found');
  console.log(`[005 rework] header counters pill width: ${pillBox.width.toFixed(1)}px`);
  expect(pillBox.width).toBeLessThanOrEqual(560);

  const titleMetrics = await page.getByTestId('header-meeting-title').evaluate((el) => {
    const h1 = el.querySelector('h1');
    const p = el.querySelector('p');
    return {
      h1Scroll: h1?.scrollWidth ?? 0,
      h1Client: h1?.clientWidth ?? 0,
      pScroll: p?.scrollWidth ?? 0,
      pClient: p?.clientWidth ?? 0,
    };
  });
  // scrollWidth > clientWidth is exactly what "truncated" means for a `truncate` (ellipsis) element.
  expect(titleMetrics.h1Scroll).toBeLessThanOrEqual(titleMetrics.h1Client);
  expect(titleMetrics.pScroll).toBeLessThanOrEqual(titleMetrics.pClient);

  // "Offen" is not a visible cell any more, but it must still carry the one true figure
  // (`meeting.counts.open`, the same value the navigation badge shows) for tests and screen readers.
  await expect(page.getByTestId('header-counter-open')).toContainText(/\d/);

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('005-header.png') });
});
