/**
 * Scheibe 046 — Nachfragen-Threads (docs/slices/046-nachfragen-threads.md).
 *
 * The capture desk sets a follow-up reference ("Bezug setzen", button "Nachfrage zu …" or Alt+B; Alt+N is the shell's
 * navigation key) for the next single capture; the new card says "Klarstellung zu F-…", the chip is gone afterwards; a
 * question without a reference has no badge. The history shows the block "Bezug" on both questions and the timeline line
 * "Als Klarstellung erfasst". The roles are only switched here; every button the tests press is one the interface offers
 * where `_actions` allows it (AGENTS.md R4).
 *
 * `in-process`: a fresh demo state per test (own browser context); screenshots DE/EN (E4). `http` (E1, E2; after 045,
 * before 053): end state after this file — one new Redebeitrag of the speaker at the microphone with two new questions in
 * `captured` (one a clarification of a seed question found by the search word, one without reference), no track, no
 * unit, no answer; the stage unchanged; no chip left set.
 */
import type { Page } from '@playwright/test';
import { CORPUS_DEMO } from '@hv/domain';
import { checkAxe } from './support/axe';
import { FOLLOW_UP_046_FREE_QUESTION, FOLLOW_UP_046_QUESTION, FOLLOW_UP_046_SEARCH, FOLLOW_UP_046_SPEECH } from './support/e2e-texts';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole, expectNotBusy } from './support/roles';

test.use({ viewport: { width: 1440, height: 900 } });

const isHttp = (): boolean => test.info().project.name === 'http';

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

/** Mark a passage of the Redebeitrag the way a person would with the mouse (as in 002). */
async function markPassage(page: Page, passage: string): Promise<void> {
  await page.evaluate((needle) => {
    const container = document.querySelector('[data-testid="capture-contribution-text"]');
    if (container === null) throw new Error('the contribution text is not on the page');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const index = (node.nodeValue ?? '').indexOf(needle);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    throw new Error(`passage not found: ${needle}`);
  }, passage);
  await expect(page.getByTestId('capture-add-selection')).toBeVisible();
}

/** Leaves any text field, so the shortcut is not typed into it (Alt+B is ignored while typing, W3). */
async function leaveField(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Opens "Bezug setzen" with Alt+B, finds a question by the search word, chooses the first hit; returns its number. */
async function setReference(page: Page, relation: 'follow_up' | 'clarification'): Promise<string> {
  await leaveField(page);
  await page.keyboard.press('Alt+b');
  const search = page.getByTestId('capture-follow-up-search');
  await expect(search).toBeFocused();
  await search.fill(FOLLOW_UP_046_SEARCH);
  const first = page.getByTestId('capture-follow-up-hit').first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  const number = (await first.getAttribute('data-number')) ?? '';
  expect(number).toMatch(/^F-\d+$/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('data-chosen', 'true');
  await page.getByTestId(`capture-follow-up-relation-${relation}`).check();
  await page.getByTestId('capture-follow-up-submit').click();
  await expect(page.getByTestId('capture-follow-up-chip')).toBeVisible();
  return number;
}

/** E1: a new Redebeitrag, one question captured as a clarification, one without reference. Returns both numbers. */
async function captureWithReference(page: Page): Promise<{ parent: string; child: string }> {
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture/);
  const pane = page.getByTestId('capture-contribution-pane');
  // The speaker at the microphone is preselected; a further Redebeitrag if one is already there.
  const fresh = page.getByTestId('capture-text');
  const another = page.getByTestId('capture-contribution-new');
  await expect(fresh.or(another)).toBeVisible({ timeout: 30_000 });
  if (await another.isVisible()) await another.click();
  await fresh.fill(FOLLOW_UP_046_SPEECH);
  await page.getByTestId('capture-submit').click();
  await expect(page.getByTestId('capture-contribution-text')).toContainText('Synthetischer Redebeitrag 046');
  const before = await page.getByTestId('capture-question-card').count();

  const parent = await setReference(page, 'clarification');
  await expect(page.getByTestId('capture-follow-up-chip')).toContainText(parent);

  await markPassage(page, FOLLOW_UP_046_QUESTION);
  await page.keyboard.press('Alt+q');
  await expectNotBusy(pane);
  const cards = page.getByTestId('capture-question-card');
  await expect(cards).toHaveCount(before + 1);
  const card = cards.filter({ hasText: FOLLOW_UP_046_QUESTION });
  await expect(card.getByTestId('capture-question-reference')).toContainText(parent);
  await expect(card.getByTestId('capture-question-reference')).toContainText(/Klarstellung|Clarification/);
  await expect(page.getByTestId('capture-follow-up-chip')).toHaveCount(0);
  const child = (await card.getAttribute('data-number')) ?? '';

  await page.getByTestId('capture-free-input').fill(FOLLOW_UP_046_FREE_QUESTION);
  await page.getByTestId('capture-free-input').press('Enter');
  await expectNotBusy(pane);
  const plain = cards.filter({ hasText: FOLLOW_UP_046_FREE_QUESTION });
  await expect(plain).toHaveCount(1);
  await expect(plain.getByTestId('capture-question-reference')).toHaveCount(0);
  return { parent, child };
}

async function openInHistory(page: Page, number: string): Promise<void> {
  await page.getByTestId('nav-history').click();
  await page.getByTestId('history-search').fill(number);
  await page.getByTestId('history-result').filter({ hasText: number }).first().click();
  await expect(page.getByTestId('history-timeline')).toBeVisible();
}

test('E1/E2 capture a clarification and see the thread in the history @screenshot', async ({ page }) => {
  await page.goto('/capture');
  await waitForCorpus(page);
  const { parent, child } = await test.step('E1 capture', () => captureWithReference(page));

  if (!isHttp()) {
    await test.step('E4 capture screenshots DE/EN: chip and card with badge', async () => {
      // A second chip for the screenshot only; it is removed again, so no further reference is written.
      await setReference(page, 'follow_up');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('046-erfassung-de.png') });
      await setLang(page, 'en');
      await expect(page.getByTestId('capture-follow-up-chip')).toContainText('Follow-up question to');
      await page.screenshot({ path: evidence('046-erfassung-en.png') });
      await setLang(page, 'de');
      await page.getByTestId('capture-follow-up-remove').click();
      await expect(page.getByTestId('capture-follow-up-chip')).toHaveCount(0);
    });
  }

  await test.step('E2 history: block on the child, the parent lists the child, the timeline line', async () => {
    await openInHistory(page, child);
    const block = page.getByTestId('history-thread');
    await expect(block).toBeVisible();
    await expect(page.getByTestId('history-thread-parent')).toContainText(parent);
    await expect(page.locator('[data-testid="history-event"][data-type="QuestionLinked"]')).toContainText('Als Klarstellung erfasst');
    await page.getByTestId('history-thread-parent').click();
    await expect(page.getByTestId('history-timeline')).toBeVisible();
    await expect(page.locator(`[data-testid="history-thread-child"][data-number="${child}"]`)).toBeVisible();
    if (!isHttp()) {
      await checkAxe(page, 'history (Block Bezug)');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('046-historie-de.png') });
      await setLang(page, 'en');
      await expect(page.getByTestId('history-thread')).toContainText('Follow-up questions and clarifications');
      await page.screenshot({ path: evidence('046-historie-en.png') });
      await setLang(page, 'de');
    }
  });
});

test('E3 keyboard and axe: Alt+B focuses the search, Escape returns to the button', async ({ page }) => {
  test.skip(isHttp(), 'E3 runs in-process only (the spec runs E1 and E2 in http).');
  await page.goto('/capture');
  await waitForCorpus(page);
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  const another = page.getByTestId('capture-contribution-new');
  const fresh = page.getByTestId('capture-text');
  await expect(fresh.or(another)).toBeVisible({ timeout: 30_000 });
  if (await fresh.isVisible()) {
    await fresh.fill(FOLLOW_UP_046_SPEECH);
    await page.getByTestId('capture-submit').click();
  }
  await expect(page.getByTestId('capture-follow-up-open')).toBeVisible();
  // Not while typing: Alt+B in the free entry leaves the dialog closed.
  await page.getByTestId('capture-free-input').focus();
  await page.keyboard.press('Alt+b');
  await expect(page.getByTestId('capture-follow-up-search')).toHaveCount(0);
  await leaveField(page);
  await page.keyboard.press('Alt+b');
  await expect(page.getByTestId('capture-follow-up-search')).toBeFocused();
  await page.getByTestId('capture-follow-up-search').fill(FOLLOW_UP_046_SEARCH);
  await expect(page.getByTestId('capture-follow-up-hit').first()).toBeVisible();
  await checkAxe(page, 'capture (Bezug setzen, dialog open)');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('capture-follow-up-search')).toHaveCount(0);
  await expect(page.getByTestId('capture-follow-up-open')).toBeFocused();
});
