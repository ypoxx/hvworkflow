/**
 * Scheibe 061 — Leitstand (docs/slices/061-leitstand.md, part B "Oberfläche").
 *
 * The control desk of the coordination: the oldest open question as the one main reading, three cards and the inflow,
 * the stations with "Engpass", the backlog per answering unit with its threshold marker; every figure opens its list,
 * every row the thread (Faden) of its question. Aggregates only, nothing per person; rights are data (a refused read is
 * the read state `cockpit-forbidden`).
 *
 * Runs in both projects. This file writes nothing in `http` (S5, the only write, runs in-process only), so the database
 * state after 055b stays as it was for 080 and abnahme. `in-process`: every test starts from a fresh demo state (own
 * browser context), so `--repeat-each=3` is independent. The browser clock is installed before the first load (the demo
 * seeds at that time) and moved on by 22 minutes, so the figures have an afternoon to show: the questions the seed put
 * into legal clearing wait longer than 10 minutes, the seed's captures lie in the inflow 20–25 minutes back. In `http`
 * the service's own clock counts and the browser clock stays untouched; the tests then read whatever the figures are.
 */
import { CORPUS_DEMO } from '@hv/domain';
import type { Page } from '@playwright/test';
import { checkAxe } from './support/axe';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

test.use({ viewport: { width: 1440, height: 900 } });

const isHttp = (): boolean => test.info().project.name === 'http';
/** 15:20 in Berlin on the day of the demo meeting; 22 minutes later the page reads "Stand 15:42". */
const SEED_TIME = new Date('2026-06-15T13:20:00.000Z');

const pageTitle = (page: Page) => page.getByRole('heading', { level: 1, name: /^(Leitstand|Cockpit)$/ });
const listRows = (page: Page) => page.getByTestId('cockpit-list-row');

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^(Meldung schließen|Close the message)$/ });
  for (let open = await close.count(); open > 0; open = await close.count()) await close.first().click();
}

/**
 * Opens the control desk as `role`; in-process with the demo afternoon described in the head of this file. Returns the
 * speaker names the speakers list shows on the way (for the privacy check S6; read before the role changes).
 */
async function openCockpit(page: Page, role: string): Promise<string[]> {
  if (!isHttp()) await page.clock.install({ time: SEED_TIME });
  await page.goto('/speakers');
  await waitForCorpus(page);
  await expect(page.getByTestId('speaker-row').first()).toBeVisible();
  const names = (await page.getByTestId('speaker-row').locator('span.truncate.font-medium').allTextContents())
    .map((name) => name.trim())
    .filter((name) => name.length > 3);
  await asRole(page, role);
  if (!isHttp()) await page.clock.fastForward('22:00');
  await page.getByTestId('nav-cockpit').click();
  await expect(page).toHaveURL(/\/cockpit$/);
  await expect(pageTitle(page)).toBeVisible();
  return names;
}

async function count(page: Page, testId: string): Promise<number> {
  return Number(await page.getByTestId(testId).first().getAttribute('data-count'));
}

async function headerNumber(page: Page, testId: string): Promise<number> {
  return Number(((await page.getByTestId(testId).textContent()) ?? '').replace(/\D/g, ''));
}

/** Text of the page's main region (where the views render), for the privacy checks. */
const mainText = (page: Page): Promise<string> => page.locator('main').innerText();

/** Screenshots of the evidence: fonts loaded, toasts closed, axe at every view change (the shared gate of 013). */
async function shoot(page: Page, name: string, label: string): Promise<void> {
  await clearToasts(page);
  await checkAxe(page, label);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence(name) });
}

test.describe.serial('061 Leitstand', () => {
  test('S1 coordination sees the main reading, four cards, inflow, stations and backlog; one primary button (with S8) @screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    await openCockpit(page, 'coordination');
    await expect(page.getByTestId('cockpit-oldest')).toBeVisible();
    for (const card of ['cockpit-card-open', 'cockpit-card-legal', 'cockpit-card-stage', 'cockpit-card-inflow']) {
      await expect(page.getByTestId(card)).toBeVisible();
    }
    await expect(page.getByTestId('cockpit-inflow-chart')).toBeVisible();
    await expect(page.getByTestId('cockpit-inflow-bar')).toHaveCount(12);
    await expect(page.getByTestId('cockpit-station')).toHaveCount(6);
    await expect(page.getByTestId('cockpit-unit-row').first()).toBeVisible();
    await expect(page.getByTestId('cockpit-unit-row').last()).toHaveAttribute('data-unit', 'none');
    await expect(page.getByTestId('cockpit-canary')).toHaveText('Kanarienfrage: nicht eingerichtet');
    await expect(page.getByTestId('cockpit-asof')).toHaveText(/^Stand \d{2}:\d{2}:\d{2}$/);
    // Exactly one primary button on the page: "Faden öffnen" at the oldest question (D2).
    const open = await count(page, 'cockpit-card-open');
    await expect(page.getByTestId('cockpit-page').locator('[data-primary="true"]')).toHaveCount(open > 0 ? 1 : 0);
    if (!isHttp()) {
      // The demo afternoon: the oldest question is critical, legal clearing over 10 min shows its level and "Engpass".
      await expect(page.getByTestId('cockpit-oldest').getByTestId('cockpit-level')).toHaveAttribute('data-level', 'critical');
      await expect(page.getByTestId('cockpit-bottleneck')).toBeVisible();
      await expect(page.getByTestId('cockpit-unit-marker').first()).toBeAttached();
      await shoot(page, '061-leitstand-de.png', '061 cockpit DE');
      await setLang(page, 'en');
      await expect(pageTitle(page)).toHaveText('Cockpit');
      await expect(page.getByTestId('cockpit-canary')).toHaveText('Canary question: not set up');
      await shoot(page, '061-leitstand-en.png', '061 cockpit EN');
      await setLang(page, 'de');
    } else {
      await checkAxe(page, '061 cockpit (http)');
    }
  });

  test('S2 the same figures as the other views: navigation counters and the distribution of the steering view', async ({ page }) => {
    test.setTimeout(120_000);
    await openCockpit(page, 'coordination');
    await expect(page.getByTestId('cockpit-unit-row').first()).toBeVisible();
    await expect.poll(async () => (await count(page, 'cockpit-card-open')) === (await headerNumber(page, 'header-counter-open'))).toBe(true);
    await expect.poll(async () => (await count(page, 'cockpit-card-stage')) === (await headerNumber(page, 'header-counter-staged'))).toBe(true);
    const rows = await page.getByTestId('cockpit-unit-row').evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-unit') ?? '', Number(el.getAttribute('data-count'))] as const));
    await page.getByTestId('nav-steering').click();
    await expect(page).toHaveURL(/\/steering$/);
    await expect(page.getByTestId('steering-unit-cell').first()).toBeVisible();
    for (const [unit, value] of rows) {
      const cell = unit === 'none'
        ? page.getByTestId('steering-unit-none')
        : page.locator(`[data-testid="steering-unit-cell"][data-unit="${unit}"]`);
      await expect(cell, `unit ${unit}`).toHaveAttribute('data-count', String(value));
    }
  });

  test('S3 drill-down legal clearing: rows equal the figure, "wartet seit", Enter opens the thread, Escape twice closes (with S6, S8) @screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    const speakers = await openCockpit(page, 'coordination');
    expect(speakers.length).toBeGreaterThan(0);
    const card = page.getByTestId('cockpit-card-legal');
    const figure = await count(page, 'cockpit-card-legal');
    await card.click();
    await expect(page).toHaveURL(/[?&]list=legal\b/);
    await expect(page.getByTestId('cockpit-list-title')).toBeFocused();
    await expect(listRows(page)).toHaveCount(Math.min(figure, 50));
    if (!isHttp()) expect(figure).toBeGreaterThan(0);

    if (figure > 0) {
      await expect(page.getByTestId('cockpit-list').getByText('wartet seit', { exact: true })).toBeVisible();
      // Keyboard: from the list's heading Tab reaches "close", then the one row in the tab order; arrows move, Enter opens.
      await page.keyboard.press('Tab');
      await expect(page.getByTestId('cockpit-list-close')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(listRows(page).first()).toBeFocused();
      if (figure > 1) {
        await page.keyboard.press('ArrowDown');
        await expect(listRows(page).nth(1)).toBeFocused();
        await page.keyboard.press('ArrowUp');
      }
      const row = listRows(page).first();
      await expect(row).toBeFocused();
      const status = (await row.getAttribute('data-status')) ?? '';
      const number = (await row.getAttribute('data-number')) ?? '';
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/[?&]q=/);
      const thread = page.getByTestId('cockpit-thread');
      await expect(thread).toBeVisible();
      await expect(page.getByTestId('cockpit-thread-title')).toHaveText(`Faden ${number}`);
      await expect(thread.locator('[data-testid="cockpit-thread-entry"][data-state="current"]')).toHaveAttribute('data-status', status);
      await expect(thread.locator('[data-testid="cockpit-thread-entry"][data-state="past"]').first()).toBeVisible();
      await expect(row).toBeFocused();

      if (!isHttp()) {
        // W8: a live reading (the 15 s interval) changes nothing about the focus.
        const asOf = await page.getByTestId('cockpit-asof').textContent();
        await page.clock.fastForward('00:16');
        await expect(page.getByTestId('cockpit-asof')).not.toHaveText(asOf ?? '');
        await expect(row).toBeFocused();
      }

      await test.step('S6 privacy: no speaker name of the corpus, no actor id in the page', async () => {
        const text = await mainText(page);
        for (const name of speakers) expect(text, name).not.toContain(name);
        expect(text).not.toMatch(/\bu-(mod|cap|coord|exp|legal|appr|podium|admin|obs)\b/);
        expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        expect(text).not.toMatch(/Wortmeldung/);
      });

      if (!isHttp()) {
        // The image shows the list with its thread: the list's head at the top of the view.
        await page.getByTestId('cockpit-list').evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await shoot(page, '061-liste-faden-de.png', '061 list and thread DE');
        await setLang(page, 'en');
        await expect(page.getByTestId('cockpit-thread-title')).toHaveText(`Thread ${number}`);
        await page.getByTestId('cockpit-list').evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await shoot(page, '061-liste-faden-en.png', '061 list and thread EN');
        await setLang(page, 'de');
        await row.focus();
      } else {
        await checkAxe(page, '061 list and thread (http)');
      }

      await page.keyboard.press('Escape');
      await expect(page.getByTestId('cockpit-thread')).toHaveCount(0);
      await expect(page).not.toHaveURL(/[?&]q=/);
      await expect(page.getByTestId('cockpit-list')).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cockpit-list')).toHaveCount(0);
    await expect(page).toHaveURL(/\/cockpit$/);
    await expect(card).toBeFocused();

    await test.step('the URL carries the list: opened directly, closed by Back', async () => {
      await page.goto('/cockpit?list=legal');
      await expect(page.getByTestId('cockpit-list')).toBeVisible();
      await page.goto('/cockpit');
      await expect(page.getByTestId('cockpit-list')).toHaveCount(0);
      await page.getByTestId('cockpit-card-open').click();
      await expect(page.getByTestId('cockpit-list')).toHaveAttribute('data-list', 'open');
      await page.goBack();
      await expect(page.getByTestId('cockpit-list')).toHaveCount(0);
    });
  });

  test('S4 a role without cockpit.read sees the read state, no figures', async ({ page }) => {
    test.setTimeout(120_000);
    await openCockpit(page, 'expert');
    await expect(page.getByTestId('cockpit-forbidden')).toBeVisible();
    await expect(page.getByTestId('cockpit-oldest')).toHaveCount(0);
    await expect(page.getByTestId('cockpit-station')).toHaveCount(0);
    await checkAxe(page, '061 cockpit forbidden');
  });

  test('S5 moderation withdraws a question: "Ohne Endstatus" N − 1, the question leaves the list (writes a withdrawal)', async ({ page }) => {
    // In-process only: the write goes through the demo's own HvApi module, which only the dev server serves; in `http`
    // this file writes nothing.
    test.skip(isHttp(), 'the write goes through the demo module of the dev server');
    test.setTimeout(120_000);
    await openCockpit(page, 'moderation');
    const before = await count(page, 'cockpit-card-open');
    await page.getByTestId('cockpit-card-open').click();
    await expect(page.getByTestId('cockpit-list-count')).toHaveAttribute('data-count', String(before));
    const row = listRows(page).first();
    const id = (await row.getAttribute('data-id')) ?? '';
    const number = (await row.getAttribute('data-number')) ?? '';
    const outcome = await page.evaluate(async ([url, questionId]) => {
      const mod = (await import(/* @vite-ignore */ url!)) as {
        api: {
          getQuestion: (id: string) => Promise<{ version: number }>;
          withdrawQuestion: (id: string, reason: string, o: { ifMatch: string }) => Promise<unknown>;
        };
      };
      const question = await mod.api.getQuestion(questionId!);
      await mod.api.withdrawQuestion(questionId!, 'Die Rednerin zieht die Frage zurück.', { ifMatch: `"v${question.version}"` });
      return 'written';
    }, ['/src/api/index.ts', id]);
    expect(outcome).toBe('written');
    await expect.poll(() => count(page, 'cockpit-card-open')).toBe(before - 1);
    await expect(page.locator(`[data-testid="cockpit-list-row"][data-number="${number}"]`)).toHaveCount(0);
    await expect(page.getByTestId('cockpit-list-count')).toHaveAttribute('data-count', String(before - 1));
  });

  test('S7 at 200 % zoom (640 CSS px) one column, no horizontal scrolling, list included', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 640, height: 450 });
    await openCockpit(page, 'coordination');
    await expect(page.getByTestId('cockpit-oldest')).toBeVisible();
    const overflow = () => page.evaluate(() => {
      const main = document.querySelector('main');
      return {
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        main: main === null ? 0 : main.scrollWidth - main.clientWidth,
      };
    });
    expect(await overflow()).toEqual({ doc: 0, main: 0 });
    await page.getByTestId('cockpit-card-legal').click();
    await expect(page.getByTestId('cockpit-list')).toBeVisible();
    expect(await overflow()).toEqual({ doc: 0, main: 0 });
    await checkAxe(page, '061 cockpit at 200 %');
  });

  test('S8 the wall screen 1280 × 720: main reading, cards with inflow and stations without scrolling @screenshot', async ({ page }) => {
    test.skip(isHttp(), 'evidence images come from in-process');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openCockpit(page, 'coordination');
    const viewport = page.viewportSize()!;
    for (const id of ['cockpit-oldest', 'cockpit-card-open', 'cockpit-card-legal', 'cockpit-card-stage', 'cockpit-card-inflow']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box!.y + box!.height, id).toBeLessThanOrEqual(viewport.height);
    }
    for (const station of await page.getByTestId('cockpit-station').all()) {
      const box = await station.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    // The bottom edges of the main reading and the inflow card are flush (D3).
    const oldest = await page.getByTestId('cockpit-oldest').boundingBox();
    const inflow = await page.getByTestId('cockpit-card-inflow').boundingBox();
    expect(Math.abs(oldest!.y + oldest!.height - (inflow!.y + inflow!.height))).toBeLessThanOrEqual(1);
    await shoot(page, '061-wand-1280x720-de.png', '061 wall DE');
    await setLang(page, 'en');
    await expect(pageTitle(page)).toHaveText('Cockpit');
    await shoot(page, '061-wand-1280x720-en.png', '061 wall EN');
    await setLang(page, 'de');
  });
});
