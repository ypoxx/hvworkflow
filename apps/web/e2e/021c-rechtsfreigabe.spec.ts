import { CORPUS_DEMO } from '@hv/domain';
import { checkAxe } from './support/axe';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole, expectRoleLabel } from './support/roles';

test('021c: Recht gibt rechtlich frei, Freigabe und Bühne folgen @screenshot', async ({ page }) => {
  await page.goto('/answers');
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, ''))).toBeGreaterThanOrEqual(CORPUS_DEMO.questions);

  await asRole(page, 'legal');
  await page.getByTestId('answers-filter-status-in_review').click();
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  let number: string | null = null;
  for (let i = 0; i < Math.min(await rows.count(), 20); i++) {
    const rowNumber = (await rows.nth(i).getAttribute('data-number')) ?? '';
    await rows.nth(i).click();
    // The selected question is read on its own in `http`; its actions are known once its number shows in the detail.
    await expect(page.getByTestId('answers-detail-number')).toHaveText(rowNumber);
    if (await page.getByTestId('answer-legal-clear').isVisible()) {
      number = await page.getByTestId('answers-detail-number').innerText();
      break;
    }
  }
  expect(number).not.toBeNull();
  await expect(page.getByTestId('answer-approve')).toHaveCount(0);
  await page.getByTestId('answer-legal-clear').click();
  await expect(page.getByTestId('legal-clearance-block')).toContainText('Rechtlich freigegeben (Version');
  await expect(page.getByTestId('legal-clearance-block')).toBeFocused();
  await checkAxe(page, '021c Rechtsfreigabe DE');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('021c-rechtsfreigabe-de.png') });

  await page.getByTestId('lang-option-en').click();
  await expect(page.getByTestId('legal-clearance-block')).toContainText('Legally cleared (version');
  await checkAxe(page, '021c legal clearance EN');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('021c-rechtsfreigabe-en.png') });

  await asRole(page, 'approver');
  // The language is kept in localStorage, so it survives the reload of the `http` switch as it survives the demo switch:
  // it is asserted here, not repaired, and the role must be named in it.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expectRoleLabel(page, 'approver', 'en');
  await page.getByTestId('answers-search').fill(number!);
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-number', number!);
  await row.click();
  await page.getByTestId('answer-approve').click();
  await expect(page.getByTestId('approval-block')).toContainText('Approved');
  await page.getByTestId('answer-stage').click();
  await expect(page.getByTestId('answers-detail')).toContainText('on the podium');
});
