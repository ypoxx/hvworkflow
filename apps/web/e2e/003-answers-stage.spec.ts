/**
 * Slice 003 — the afternoon, walked from end to end by the people who actually do it: the answering
 * unit drafts and hands over, legal approves exactly one text version, the approver puts it on the
 * podium, the podium reads it out, and the history can prove every step afterwards.
 *
 * The test switches persona through the header's role switcher — the one place in the interface
 * that knows role names (AGENTS.md rule 4). Everything else it does is possible only because
 * `_actions` offered it.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const SEEDED_QUESTIONS = 800;

test.use({ viewport: { width: 1440, height: 900 } });

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

/** Confirmations belong on screen, not in the evidence: clear the stack before a screenshot. */
async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Meldung schließen' });
  for (let open = await close.count(); open > 0; open = await close.count()) {
    await close.first().click();
  }
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

test('backlog, approval, podium and history @screenshot', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  /* ---------- Fachbereich: draft an answer on an assigned question and hand it over ---------- */
  await asRole(page, 'expert');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  await page.getByTestId('answers-filter-status-assigned').click();
  const firstRow = page.getByTestId('answers-row').first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow).toHaveAttribute('data-status', 'assigned');
  const number = await firstRow.getAttribute('data-number');
  expect(number).not.toBeNull();
  await firstRow.click();

  const detail = page.getByTestId('answers-detail');
  await expect(detail).toBeVisible();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number!);

  // The question keeps its origin: one click back to the Redebeitrag it was atomised from.
  await expect(page.getByTestId('answers-detail-contribution')).toHaveAttribute(
    'href',
    /\/capture\?speaker=/,
  );

  await page
    .getByTestId('answer-editor')
    .fill(
      'Die Ausschüttungsquote lag im Berichtsjahr bei 47 Prozent des bereinigten Konzernergebnisses. ' +
        'Die Einzelheiten sind im Geschäftsbericht auf Seite 42 dargestellt.',
    );
  await page.getByTestId('answer-sources').fill('Geschäftsbericht, Seite 42; Konzernanhang');
  await page.getByTestId('answer-submit-draft').click();

  await expect(page.locator('[data-testid="answer-version"][data-version="1"]')).toBeVisible();
  await expect(detail).toContainText('Version 1');

  await page.getByTestId('answer-submit-review').click();
  await expect(page.getByTestId('approval-block')).toContainText('Legal Clearing');

  /* ---------- Recht: approve exactly the latest version ---------- */
  await asRole(page, 'legal');
  const approve = page.getByTestId('answer-approve');
  await expect(approve).toBeVisible();
  await expect(approve).toContainText('Version 1');
  await approve.click();

  const approval = page.getByTestId('approval-block');
  await expect(approval).toContainText('Freigegeben');
  await expect(approval).toContainText('Version 1');

  // Still legal: another answer goes back for rework — a return is impossible without a reason.
  await page.getByTestId('answers-filter-status-in_review').click();
  await page.getByTestId('answers-row').first().click();
  await page.getByTestId('answer-return').click();
  await page
    .getByTestId('answer-return-reason')
    .fill('Bitte die Zahl mit dem Geschäftsbericht abgleichen und die Quelle nennen.');
  await page.getByTestId('answer-return-submit').click();
  await expect(page.getByTestId('answers-detail')).toContainText('Antwortentwurf');

  /* ---------- Fachbereich: a new version voids the approval that was on the old one ---------- */
  await asRole(page, 'expert');
  await page.getByTestId('answers-filter-status-approved').click();
  // Not the question of this walk-through: it has to keep its approval to reach the podium.
  const otherApproved = page
    .locator(`[data-testid="answers-row"]:not([data-number="${number!}"])`)
    .first();
  await expect(otherApproved).toHaveAttribute('data-status', 'approved');
  await otherApproved.click();
  await expect(page.getByTestId('approval-block')).toContainText('Freigegeben');

  await page
    .getByTestId('answer-editor')
    .fill(
      'Ergänzte Fassung: die Zahl ist mit dem Konzernanhang abgeglichen und dort auf Seite 118 belegt.',
    );
  await page.getByTestId('answer-submit-draft').click();

  const lapsed = page.getByTestId('approval-lapsed');
  await expect(lapsed).toBeVisible();
  await expect(lapsed).toContainText('erloschen');
  await expect(page.getByTestId('approval-block')).not.toContainText('Freigegeben');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-approval-lapsed.png') });

  // Back to the question of this walk-through, found by its number.
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-search').fill(number!);
  // The search is debounced; wait for the list to answer before picking a row.
  const ownRow = page.getByTestId('answers-row').first();
  await expect(ownRow).toHaveAttribute('data-number', number!);
  await ownRow.click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number!);

  /* ---------- Freigabe: put it on the podium ---------- */
  await asRole(page, 'approver');
  await page.getByTestId('answer-stage').click();
  await expect(page.getByTestId('answers-detail')).toContainText('auf der Bühne');

  // The backlog as it is really read: every status in one list, one question open beside it.
  // The search is debounced, so wait until the whole corpus is back in the list.
  await page.getByTestId('answers-search').fill('');
  await expect(page.getByTestId('answers-filter-status-all')).toContainText(
    String(SEEDED_QUESTIONS),
  );
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-answers.png') });

  /* ---------- Podium: read out, next ---------- */
  await asRole(page, 'podium');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);

  await expect(page.getByTestId('stage-current')).toBeVisible();
  const currentNumber = page.getByTestId('stage-current-number');
  const answerBlock = page.getByTestId('stage-answer');
  await expect(currentNumber).toBeVisible();
  await expect(page.getByTestId('stage-current-text')).not.toBeEmpty();
  await expect(page.getByTestId('stage-assignment')).toBeVisible();
  await expect(page.getByTestId('stage-queue-item').first()).toBeVisible();

  const readOutOnce = async (): Promise<void> => {
    const before = await currentNumber.innerText();
    await page.getByTestId('stage-next').click();
    await expect(currentNumber).not.toHaveText(before);
  };

  // Work through the podium until a prepared answer stands in front of the person; questions on
  // the podium track carry no text and are answered freely by the board.
  for (let round = 0; round < 8; round++) {
    if ((await answerBlock.getAttribute('data-prepared')) === 'true') break;
    await readOutOnce();
  }
  await expect(answerBlock).toHaveAttribute('data-prepared', 'true');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-stage.png') });

  const delivered = page.getByTestId('stage-counter-delivered');
  const deliveredBefore = Number((await delivered.innerText()).replace(/\D/g, ''));
  await readOutOnce();
  await expect
    .poll(async () => Number((await delivered.innerText()).replace(/\D/g, '')))
    .toBeGreaterThan(deliveredBefore);

  // The keyboard is the podium's real interface: the space bar reads the next one out.
  const second = await currentNumber.innerText();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Space');
  await expect(currentNumber).not.toHaveText(second);

  // "Nur Bühne": the podium takes the whole viewport, the shell disappears behind it.
  await page.getByTestId('stage-only-toggle').click();
  const overlay = page.getByTestId('stage-only');
  await expect(overlay).toBeVisible();
  expect(await overlay.boundingBox()).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
  await expect(page.getByTestId('stage-current-text')).toBeVisible();
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-stage-only.png') });
  await page.getByTestId('stage-only-toggle').click();
  await expect(overlay).toHaveCount(0);

  /* ---------- Historie: every step of that one question is on the record ---------- */
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);

  await page.getByTestId('history-search').fill(number!);
  const result = page.getByTestId('history-result').filter({ hasText: number! }).first();
  await expect(result).toBeVisible();
  await result.click();

  const timeline = page.getByTestId('history-timeline');
  await expect(timeline).toBeVisible();
  for (const type of [
    'QuestionCaptured',
    'QuestionClassified',
    'QuestionAssigned',
    'AnswerDrafted',
    'QuestionSubmittedForReview',
    'QuestionApproved',
    'QuestionStaged',
  ]) {
    await expect(
      timeline.locator(`[data-testid="history-event"][data-type="${type}"]`),
    ).toHaveCount(1);
  }
  await expect(timeline).toContainText('Version 1');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-history.png') });

  // The event stream carries the tail of the whole meeting.
  await page.getByTestId('history-tab-stream').click();
  await expect(page.getByTestId('history-stream')).toBeVisible();
  const streamRows = page.getByTestId('history-stream').getByTestId('history-event');
  expect(await streamRows.count()).toBeGreaterThan(20);
});
