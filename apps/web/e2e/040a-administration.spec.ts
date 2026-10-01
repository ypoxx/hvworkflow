/**
 * Scheibe 040a — Administration ohne Inhaltsrechte (docs/slices/040a-admin-ohne-inhaltsrechte.md).
 *
 * Acceptance 4: in the Beantwortung, the administration sees at most the return on a question in
 * review — no approval, drafting, legal clearance or withdrawal. Acceptance 5: after the
 * administration returned a question, its history shows the "Administration" badge at that event,
 * and at no other, in German and in American English (Rechtekonzept §4).
 */
import { CORPUS_DEMO } from '@hv/domain';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { checkAxe } from './support/axe';
import { evidence } from './support/evidence';

test.use({ viewport: { width: 1440, height: 900 } });

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^(Meldung schließen|Close the message)$/ });
  for (let open = await close.count(); open > 0; open = await close.count()) {
    await close.first().click();
  }
}

/** Every writing action the administration no longer holds, as the Beantwortung names them. */
const CONTENT_ACTIONS = [
  'answer-editor',
  'answer-submit-review',
  'answer-legal-clear',
  'answer-approve',
  'answer-stage',
  'answer-withdraw',
  'answer-merge',
];

async function inReviewAsAdmin(page: Page): Promise<string> {
  await page.goto('/answers');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-status-in_review').click();
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-status', 'in_review');
  await row.click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  return page.getByTestId('answers-detail-number').innerText();
}

test('040a: Administration in der Beantwortung — auf einer Frage in Prüfung höchstens die Rückgabe', async ({ page }) => {
  await inReviewAsAdmin(page);
  await expect(page.getByTestId('answer-return')).toBeVisible();
  for (const testId of CONTENT_ACTIONS) await expect(page.getByTestId(testId), testId).toHaveCount(0);
  await checkAxe(page, 'answers (Administration, Frage in Prüfung)');
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('040a-admin-ohne-schreibaktionen.png') });
});

test('040a: Historie — die Rückgabe der Administration trägt das Abzeichen, die übrigen Ereignisse nicht (de, en)', async ({
  page,
}) => {
  const number = await inReviewAsAdmin(page);
  await page.getByTestId('answer-return').click();
  await page.getByTestId('answer-return-reason').fill('Bitte an den Fachbereich zurück, Quelle fehlt.');
  await page.getByTestId('answer-return-submit').click();
  await expect(page.getByTestId('answers-detail')).toContainText('Antwortentwurf');

  // The administration holds history.read: it reads the course of the question it routed.
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await page.getByTestId('history-search').fill(number);
  const result = page.getByTestId('history-result').filter({ hasText: number }).first();
  await expect(result).toBeVisible();
  await result.click();

  const timeline = page.getByTestId('history-timeline');
  await expect(timeline).toBeVisible();
  const returned = timeline.locator('[data-testid="history-event"][data-type="QuestionReturned"]').last();
  const badges = timeline.getByTestId('history-admin-badge');

  for (const [lang, text, label] of [
    ['de', 'Administration', 'Aktion der Administration'],
    ['en', 'Administration', 'Action by the administration'],
  ] as const) {
    if (lang === 'en') {
      await page.getByTestId('lang-option-en').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    }
    await expect(badges).toHaveCount(1);
    await expect(returned.getByTestId('history-admin-badge')).toHaveText(text);
    await expect(returned.getByTestId('history-admin-badge')).toHaveAttribute('aria-label', label);
    await expect(timeline.locator('[data-testid="history-event"]:not([data-type="QuestionReturned"]) [data-testid="history-admin-badge"]'))
      .toHaveCount(0);
    await checkAxe(page, `history (Zeitleiste mit Abzeichen, ${lang})`);
    await clearToasts(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence(`040a-historie-administration-${lang}.png`) });
  }
});
