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

  // Statusverteilung als Filter (point 1): a ProcessStrip segment click filters the whole list.
  await page.getByTestId('answers-filter-status-assigned').click();
  const answersRows = page.getByTestId('answers-row');
  const firstRow = answersRows.first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow).toHaveAttribute('data-status', 'assigned');
  const visibleAfterFilter = Math.min(await answersRows.count(), 5);
  for (let i = 0; i < visibleAfterFilter; i++) {
    await expect(answersRows.nth(i)).toHaveAttribute('data-status', 'assigned');
  }

  // Dringlichkeit am Zeilenrand (point 2): a 3px bar carrying its urgency level.
  await expect(firstRow.getByTestId('answers-row-urgency')).toHaveAttribute(
    'data-level',
    /^[012]$/,
  );

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

  // Änderungen zwischen Versionen (point 3): version 2 offers a word-level diff against version 1.
  const diffToggle = page.getByTestId('answer-diff-toggle');
  await expect(diffToggle).toBeVisible();
  await expect(diffToggle).toContainText('Version 1');
  await diffToggle.click();
  const diff = page.getByTestId('answer-diff');
  await expect(diff).toBeVisible();
  // The seeded version 1 is arbitrary prose; only what this test itself typed is a safe fixture.
  await expect(diff.locator('.line-through').first()).toBeVisible();
  await expect(diff.locator('.underline').first()).toContainText('Ergänzte');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-approval-lapsed.png') });
  await page.screenshot({ path: evidence('007-answers.png') });

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
  // Nächste Frage vorbereiten (point 7): the first queue item is its own, larger "Als Nächstes" card.
  await expect(page.getByTestId('stage-next-preview')).toBeVisible();
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
  await page.screenshot({ path: evidence('007-stage.png') });

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

  // Kontrastmodus (point 6): offered only inside "Nur Bühne", flips the overlay to the dark scope.
  const contrastToggle = page.getByTestId('stage-contrast-toggle');
  await expect(contrastToggle).toBeVisible();
  await expect(overlay).not.toHaveClass(/stage-contrast/);
  await contrastToggle.click();
  await expect(overlay).toHaveClass(/stage-contrast/);
  await expect(page.getByTestId('stage-current-text')).toBeVisible();
  // Away from the toggle so the evidence shows the resting state, not a lingering :hover.
  await page.mouse.move(700, 500);
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('007-stage-contrast.png') });
  await contrastToggle.click();
  await expect(overlay).not.toHaveClass(/stage-contrast/);

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

  // Durchlaufzeiten (point 8): a KPI line above the timeline, and a gap between consecutive events.
  const kpi = page.getByTestId('history-kpi');
  await expect(kpi).toBeVisible();
  await expect(kpi).toContainText('Versionen');
  await expect(kpi).toContainText('Rückgaben');
  await expect(timeline.getByTestId('history-duration').first()).toBeVisible();

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('003-history.png') });
  await page.screenshot({ path: evidence('007-history.png') });

  // The event stream carries the tail of the whole meeting.
  await page.getByTestId('history-tab-stream').click();
  await expect(page.getByTestId('history-stream')).toBeVisible();
  const streamRows = page.getByTestId('history-stream').getByTestId('history-event');
  expect(await streamRows.count()).toBeGreaterThan(20);

  // Lastkurve (point 9): a sparkline of events per five-minute bucket, above the event list.
  await expect(page.getByTestId('history-sparkline')).toBeVisible();
});
