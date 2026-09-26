/**
 * Slice 021b — Koordinationsrolle. Classify (and assign) moved from the capture desk (Erfassung) to
 * the new coordination role (Koordination). The interface only renders `_actions` (AGENTS.md rule 4),
 * so this walk proves the move on the capture desk itself: capture no longer sees "Klassifizieren",
 * coordination sees it and can open the dialog, and coordination still captures nothing. Evidence:
 * docs/evidence/021b-koordination-{de,en}.png, axe on both.
 */
import { CORPUS_DEMO } from '@hv/domain';
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

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

/** Confirmations belong on screen, not in the evidence: clear the stack before a screenshot. */
async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /Meldung schließen|Close the message/ });
  for (let open = await close.count(); open > 0; open = await close.count()) {
    await close.first().click();
  }
}

test.use({ viewport: { width: 1440, height: 900 } });

test('021b: Koordination klassifiziert auf der Erfassung, die Erfassung nicht mehr — DE/EN, axe', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Capture: still captures, but "Klassifizieren" is gone (question.classify moved away).
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByTestId('capture-question-card').first()).toBeVisible();
  await expect(page.getByTestId('capture-free-add')).toBeVisible();
  await expect(page.getByTestId('capture-classify-open')).toHaveCount(0);

  // Coordination: the same desk, "Klassifizieren" on every open card, nothing to capture with.
  await asRole(page, 'coordination');
  await expect(page.getByTestId('role-switcher')).toContainText('Koordination');
  const firstCard = page.getByTestId('capture-question-card').first();
  await expect(firstCard).toBeVisible();
  const openClassify = firstCard.getByTestId('capture-classify-open');
  await expect(openClassify).toBeVisible();
  await expect(openClassify).toHaveText('Klassifizieren');
  await expect(page.getByTestId('capture-free-add')).toHaveCount(0);
  await expect(page.getByTestId('capture-submit')).toHaveCount(0);

  await openClassify.click();
  const dialog = page.getByRole('dialog', { name: 'Klassifizieren' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('classify-track-expert_track')).toBeVisible();
  await checkAxe(page, 'capture as coordination (Klassifizieren-Dialog offen)');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await checkAxe(page, 'capture as coordination (DE)');
  await page.screenshot({ path: evidence('021b-koordination-de.png') });

  // English: the same desk, the role and the action in American English.
  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.getByTestId('role-switcher')).toContainText('Coordination');
  await expect(page.getByTestId('capture-question-card').first().getByTestId('capture-classify-open')).toHaveText(
    'Classify',
  );
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await checkAxe(page, 'capture as coordination (EN)');
  await page.screenshot({ path: evidence('021b-koordination-en.png') });
});
