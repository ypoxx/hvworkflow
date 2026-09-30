/**
 * takt-037 — the selection in the suggestion dialog survives a refresh. Codex P1 on PR #95 asked for evidence
 * that can be seen: an unchecked suggestion stays unchecked when the contribution is refreshed behind the open
 * dialog, and reopening starts fresh. Runs in the `in-process` project only (the demo store lives in the browser).
 */
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const SENTENCES = [
  'Wie hoch war der Investitionsaufwand im abgelaufenen Geschäftsjahr?',
  'Welche Rückstellungen hat die Gesellschaft für die anhängigen Verfahren gebildet?',
  'Wie entwickelt sich die Eigenkapitalquote im laufenden Geschäftsjahr?',
  'Wann rechnet die Gesellschaft mit einer Entscheidung der Kartellbehörde?',
];
const SPEECH = ['Sehr geehrte Damen und Herren, ich danke für den Bericht.', ...SENTENCES, 'Vielen Dank.'].join(' ');

test.use({ viewport: { width: 1440, height: 900 } });

test('an unchecked suggestion stays unchecked after a refresh @screenshot', async ({ page }) => {
  // The meeting office calls the next speaker, so the capture desk has someone at the microphone.
  await page.goto('/speakers');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-moderation').click();
  const waiting = page.getByTestId('speakers-round-3').locator('[data-testid="speaker-row"][data-status="waiting"]');
  await waiting.first().getByTestId('speaker-call').click();
  await expect(page.locator('[data-testid="speaker-row"][data-status="speaking"]')).toHaveCount(1);

  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-capture').click();
  await page.getByTestId('nav-capture').click();
  await expect(page.getByTestId('capture-text')).toBeVisible();

  await page.getByTestId('capture-text').fill(SPEECH);
  await page.getByTestId('capture-submit').click();
  await expect(page.getByTestId('capture-contribution-text')).toContainText('Sehr geehrte Damen und Herren');

  await page.getByTestId('capture-suggest').click();
  const items = page.getByTestId('capture-suggest-item');
  await expect(items).toHaveCount(SENTENCES.length);
  for (let i = 0; i < SENTENCES.length; i += 1) await expect(items.nth(i)).toBeChecked();

  await items.nth(1).uncheck();
  await expect(items.nth(1)).not.toBeChecked();

  // A real refresh behind the open dialog. The dialog is modal, so no control of the page can write. The only way is
  // a write through the demo store: the dev server serves the same module instance the app uses, so `api` there is the
  // app's own in-process HvApi, called as the signed-in capture desk. A free question (no marked passage) changes the
  // contribution and its coverage, the listeners fire and the candidates are rebuilt with a new `uncovered` array.
  const written = await page.evaluate(async () => {
    const appApi = '/src/api/index.ts';
    const { api } = (await import(/* @vite-ignore */ appApi)) as {
      api: {
        listContributions(): Promise<{ id: string; version: number }[]>;
        captureQuestions(id: string, q: { text: string }[], o: { ifMatch: string }): Promise<unknown[]>;
      };
    };
    const all = await api.listContributions();
    const last = all[all.length - 1];
    if (last === undefined) throw new Error('no contribution');
    return (await api.captureQuestions(last.id, [{ text: 'Wie viele Stimmrechte waren vertreten?' }], {
      ifMatch: `"v${last.version}"`,
    })).length;
  });
  expect(written).toBe(1);
  await expect(page.getByTestId('capture-question-card')).toHaveCount(1);

  await expect(items).toHaveCount(SENTENCES.length);
  await expect(items.nth(0)).toBeChecked();
  await expect(items.nth(1)).not.toBeChecked();
  await expect(items.nth(2)).toBeChecked();
  await expect(items.nth(3)).toBeChecked();
  await expect(page.getByTestId('capture-suggest-add')).toContainText('3');

  await checkAxe(page, 'capture (Vorschlagsdialog offen, Auswahl nach Auffrischung)');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('takt-037-vorschlagsauswahl.png') });

  // Reopening starts fresh: everything checked.
  await page.keyboard.press('Escape');
  await expect(items).toHaveCount(0);
  await page.getByTestId('capture-suggest').click();
  await expect(items).toHaveCount(SENTENCES.length);
  for (let i = 0; i < SENTENCES.length; i += 1) await expect(items.nth(i)).toBeChecked();
});
