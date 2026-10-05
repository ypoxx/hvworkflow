/**
 * takt-048 — Nullzähler in Grau 600 und Beantwortung mit der letzten Version vorbelegt
 * (docs/slices/takt-048-nullzaehler-vorbelegung.md). Project `in-process` only.
 *
 * N1: a zero of the distribution (Verteilung) shows its number in grey 600 (rgb(99, 96, 91)), axe pass b with the zero cell
 * in view. V1–V6: the Beantwortung starts with the latest answer version; an unchanged draft is not saveable (so no
 * version that silently voids an approval), "Verwerfen" restores the version, a saved draft stays in the field as the new
 * base, a refusal as latest version starts empty, and another actor never sees the text typed before the switch.
 *
 * Roles are only switched here (test helpers may, AGENTS.md R4); which question is taken is read off the buttons the
 * detail offers, never off a role name in the interface.
 */
import { CORPUS_DEMO } from '@hv/domain';
import type { Locator, Page } from '@playwright/test';
import { checkAxe } from './support/axe';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

test.use({ viewport: { width: 1440, height: 900 } });

const API_MODULE = '/src/api/index.ts';
const GREY_600 = 'rgb(99, 96, 91)';
const PRIMARY = /(^|\s)bg-accent-600(\s|$)/;

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^(Meldung schließen|Close the message)$/ });
  for (let open = await close.count(); open > 0; open = await close.count()) await close.first().click();
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

/** Counts the calls of one `HvApi` method in the running in-process API (the counter of 010d, reduced to counting). */
async function countCalls(page: Page, method: string): Promise<void> {
  await page.evaluate(
    ([url, name]) =>
      import(/* @vite-ignore */ url!).then((module: { api: Record<string, (...args: unknown[]) => unknown> }) => {
        const w = window as unknown as { __takt048: Record<string, number> };
        w.__takt048 = { ...(w.__takt048 ?? {}), [name!]: 0 };
        const original = module.api[name!]!.bind(module.api);
        module.api[name!] = (...args: unknown[]) => {
          w.__takt048[name!] = (w.__takt048[name!] ?? 0) + 1;
          return original(...args);
        };
      }),
    [API_MODULE, method],
  );
}

const callsOf = (page: Page, method: string): Promise<number> =>
  page.evaluate((name) => (window as unknown as { __takt048: Record<string, number> }).__takt048[name] ?? 0, method);

const field = (page: Page): Locator => page.getByTestId('answer-editor');
const sources = (page: Page): Locator => page.getByTestId('answer-sources');
const save = (page: Page): Locator => page.getByTestId('answer-submit-draft');
const discard = (page: Page): Locator => page.getByRole('button', { name: /^(Eingabe verwerfen|Discard the input)$/ });
const latestCard = (page: Page): Locator => page.getByTestId('answer-version').last();
const squash = (text: string): string => text.replace(/\s+/g, '');

/** As `role` in the Beantwortung, filtered to `status`; selects the first row whose detail passes `fits`. */
async function openWhere(page: Page, role: string, status: string, fits: (page: Page) => Promise<boolean>): Promise<string> {
  await asRole(page, role);
  if (!/\/answers$/.test(page.url())) await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId(`answers-filter-status-${status}`).click();
  await expect(page.getByTestId(`answers-filter-status-${status}`)).toHaveAttribute('aria-pressed', 'true');
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  for (let i = 0; i < Math.min(await rows.count(), 25); i++) {
    const row = rows.nth(i);
    if ((await row.getByTestId('answers-row-refusal').count()) > 0) continue;
    const number = (await row.getAttribute('data-number')) ?? '';
    await row.click();
    await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
    if (await fits(page)) return number;
  }
  throw new Error(`No ${status} question for ${role} that fits.`);
}

/** A question with a latest answer version (not a refusal) and the editor. */
const drafted = async (page: Page): Promise<boolean> =>
  (await field(page).count()) > 0 &&
  (await page.getByTestId('answer-version').count()) > 0 &&
  (await page.getByTestId('answer-editor-refusal-hint').count()) === 0;

/** The field holds the latest version: its text and its sources. */
async function expectPrefilled(page: Page): Promise<void> {
  const card = latestCard(page);
  const wanted = squash(await card.locator('[data-answer-text="true"]').innerText());
  expect(wanted).not.toBe('');
  await expect.poll(async () => squash(await field(page).innerText())).toBe(wanted);
  const badges = await card.locator('.flex.flex-wrap.items-center.gap-1\\.5 > span').allInnerTexts();
  const listed = badges.slice(1).map((badge) => badge.trim());
  await expect(sources(page)).toHaveValue(listed.join('; '));
  await expect(page.getByTestId('answer-editor-placeholder')).toHaveCount(0);
}

async function appendText(page: Page, text: string): Promise<void> {
  await field(page).focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
});

test('N1: a zero of the distribution is grey 600; axe in both languages @screenshot', async ({ page }) => {
  await asRole(page, 'coordination');
  await page.getByTestId('nav-steering').click();
  await expect(page).toHaveURL(/\/steering$/);
  const zero = page
    .locator('[data-testid="steering-unit-cell"], [data-testid="steering-unit-none"], [data-testid="steering-seat-cell"]')
    .and(page.locator('[data-count="0"]'));
  await expect(page.getByTestId('steering-unit-cell').first()).toBeVisible();
  expect(await zero.count(), 'keine Nullzelle im Seed').toBeGreaterThan(0);
  await expect(zero.first()).toBeVisible();
  for (const cell of await zero.all()) {
    const number = cell.locator('span.font-mono').last();
    await expect(number).toHaveText('0');
    await expect(number).toHaveCSS('color', GREY_600);
  }
  for (const lang of ['de', 'en'] as const) {
    await setLang(page, lang);
    await clearToasts(page);
    await zero.first().scrollIntoViewIfNeeded();
    await checkAxe(page, `takt-048 steering zero cell ${lang.toUpperCase()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence(`takt-048-nullzaehler-${lang}.png`) });
  }
  await setLang(page, 'de');
});

test('V1: the Beantwortung starts with the latest version; saving locked, "Zur Prüfung" primary @screenshot', async ({ page }) => {
  await openWhere(page, 'expert', 'answer_drafted', drafted);
  await expectPrefilled(page);
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('answer-submit-review')).toHaveClass(PRIMARY);
  await expect(save(page)).not.toHaveClass(PRIMARY);
  await expect(discard(page)).toHaveCount(0);
  // Design critique D1: the field says which version it starts from and why saving is locked; the button points at it.
  const version = (await latestCard(page).getAttribute('data-version')) ?? '';
  const hint = page.getByTestId('answer-editor-start');
  await expect(hint).toHaveText(`Beginnt mit Version ${version}. Speichern, sobald Sie etwas ändern.`);
  await expect(hint).toHaveCSS('color', GREY_600);
  const hintId = (await hint.getAttribute('id')) ?? '';
  expect(hintId).not.toBe('');
  await expect(save(page)).toHaveAttribute('aria-describedby', hintId);
  for (const lang of ['de', 'en'] as const) {
    await setLang(page, lang);
    if (lang === 'en') await expect(hint).toHaveText(`Starts from version ${version}. Save once you change something.`);
    await clearToasts(page);
    // The evidence shows the prefilled field together with the locked save button below it.
    await save(page).scrollIntoViewIfNeeded();
    await checkAxe(page, `takt-048 answers prefilled ${lang.toUpperCase()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence(`takt-048-vorbelegung-${lang}.png`) });
  }
  await setLang(page, 'de');
});

test('V2: white space changes nothing; a word makes saving primary; "Verwerfen" restores the version', async ({ page }) => {
  await openWhere(page, 'expert', 'answer_drafted', drafted);
  const before = await field(page).innerText();
  await appendText(page, ' ');
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(discard(page)).toHaveCount(0);
  await appendText(page, 'Zusatz048');
  await expect(save(page)).toHaveAttribute('aria-disabled', 'false');
  await expect(page.getByTestId('answer-editor-start')).toHaveCount(0);
  await expect(save(page)).not.toHaveAttribute('aria-describedby', /.+/);
  await expect(save(page)).toHaveClass(PRIMARY);
  await expect(discard(page)).toBeVisible();
  await discard(page).click();
  await expect(page.getByTestId('answer-editor-start')).toBeVisible();
  await expect.poll(async () => squash(await field(page).innerText())).toBe(squash(before));
  await expect(field(page)).not.toContainText('Zusatz048');
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
  await expectPrefilled(page);
});

test('V3: a changed draft saved stays in the field, locked, focus on the button; a second Enter writes nothing', async ({ page }) => {
  await openWhere(page, 'expert', 'answer_drafted', drafted);
  await countCalls(page, 'draftAnswer');
  const versions = await page.getByTestId('answer-version').count();
  await appendText(page, ' Gespeichert048.');
  const sent = squash(await field(page).innerText());
  await save(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('answer-version')).toHaveCount(versions + 1);
  await expect.poll(() => callsOf(page, 'draftAnswer')).toBe(1);
  await expect.poll(async () => squash(await field(page).innerText())).toBe(sent);
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(save(page)).toBeFocused();
  await expect(save(page)).toHaveCSS('outline-style', /solid|auto/);
  await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await callsOf(page, 'draftAnswer')).toBe(1);
  await expect(page.getByTestId('answer-version')).toHaveCount(versions + 1);
  await expectPrefilled(page);
});

test('V4: an approved question — Enter on the unchanged draft writes nothing, the approval stands; a mark opens saving', async ({ page }) => {
  // Whoever holds `answer.draft` on an approved question: the editor shows (legal does today; read off the detail).
  const withEditor = async (p: Page): Promise<boolean> => (await field(p).count()) > 0 && (await drafted(p));
  await openWhere(page, 'legal', 'approved', withEditor);
  await countCalls(page, 'draftAnswer');
  const sealed = await page.getByTestId('approval-block').innerText();
  await expectPrefilled(page);
  await expect(page.getByText('Eine neue Version hebt eine bestehende Freigabe auf.')).toBeVisible();
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
  await save(page).focus();
  await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await callsOf(page, 'draftAnswer')).toBe(0);
  await expect(page.getByTestId('approval-block')).toHaveText(sealed);
  await field(page).focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+b');
  await expect(save(page)).toHaveAttribute('aria-disabled', 'false');
  expect(await callsOf(page, 'draftAnswer')).toBe(0);
});

test('V5: a refusal as latest version — the field starts empty with its placeholder and the hint', async ({ page }) => {
  await openWhere(page, 'legal', 'assigned', async (p) => (await p.getByTestId('answer-refuse').count()) > 0);
  await page.getByTestId('answer-refuse').click();
  await page.getByTestId('answer-refuse-kind-refusal_no_claim').check();
  await page.getByTestId('answer-refuse-text').fill('Ein Auskunftsanspruch besteht nicht (takt-048).');
  await page.getByTestId('answer-refuse-justification').fill('Begründung takt-048.');
  await page.getByTestId('answer-refuse-submit').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(latestCard(page)).toContainText('Ein Auskunftsanspruch besteht nicht (takt-048).');
  await expect(field(page)).toBeVisible();
  await expect(page.getByTestId('answer-editor-placeholder')).toBeVisible();
  await expect(page.getByTestId('answer-editor-refusal-hint')).toBeVisible();
  await expect(page.getByTestId('answer-editor-start')).toHaveCount(0);
  await expect(field(page)).not.toContainText('Ein Auskunftsanspruch besteht nicht');
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
});

test('V6: an actor change — the field shows the latest version again, the appended text is gone', async ({ page }) => {
  const number = await openWhere(page, 'expert', 'answer_drafted', drafted);
  const typedText = 'Vertraulicher Zusatz takt-048';
  await appendText(page, ` ${typedText}`);
  await expect(field(page)).toContainText(typedText);
  await asRole(page, 'legal');
  await expect(page.locator('#main')).not.toContainText(typedText);
  await asRole(page, 'expert');
  if ((await page.getByTestId('answers-detail-number').count()) === 0) {
    await page.getByTestId('answers-filter-status-all').click();
    await page.getByTestId('answers-filter-status-answer_drafted').click();
    await page.locator(`[data-testid="answers-row"][data-number="${number}"]`).click();
  }
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await expectPrefilled(page);
  await expect(page.locator('#main')).not.toContainText(typedText);
  await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
});
