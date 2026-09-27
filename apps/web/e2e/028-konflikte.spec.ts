import { expect, test } from '@playwright/test';
import type { HvApi } from '@hv/domain';

test('Erfassung zeigt 412 sichtbar und behält eine nicht bestätigte Einzelfrage', async ({ page }) => {
  const evidence = `${test.info().project.testDir}/../../../docs/evidence/028-capture-stale.png`;
  await page.goto('/');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-capture').click();
  await page.getByTestId('nav-capture').click();
  const free = page.getByTestId('capture-free-input');
  if (await page.getByTestId('capture-text').isVisible()) {
    await page.getByTestId('capture-text').fill('Erster Wortlaut für den Konflikttest.');
    await page.getByTestId('capture-submit').click();
  }
  await expect(free).toBeVisible();

  await page.evaluate(async () => {
    const url = '/src/api/index.ts';
    const { api } = (await import(/* @vite-ignore */ url)) as { api: HvApi };
    const original = api.captureQuestions.bind(api);
    let first = true;
    api.captureQuestions = async (...args) => {
      if (first) {
        first = false;
        throw { status: 412, title: 'Precondition failed', detail: 'Another writer changed this contribution.' };
      }
      return original(...args);
    };
  });

  const draft = 'Nicht bestätigte Frage nach gleichzeitigem Schreiben?';
  await free.fill(draft);
  await free.press('Enter');
  await expect(page.getByTestId('capture-stale-banner')).toBeVisible();
  await expect(free).toHaveValue(draft);
  await expect(page.getByTestId('capture-stale-banner')).toContainText('aktualis');
  await page.screenshot({ path: evidence });
  await page.getByTestId('capture-stale-banner').getByRole('button').click();
  await expect(free).toHaveValue(draft);
  await expect(page.getByTestId('capture-stale-banner')).toHaveCount(0);
  await expect(free).toBeFocused();
});

test('Wortmeldung sendet die angezeigte Listen-Version bei Registrierung', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-moderation').click();
  await page.getByTestId('nav-speakers').click();
  await expect(page.getByTestId('speaker-register')).toBeVisible();

  const expected = await page.evaluate(async () => {
    const url = '/src/api/index.ts';
    const { api } = (await import(/* @vite-ignore */ url)) as { api: HvApi };
    const meeting = await api.getMeeting();
    const original = api.registerSpeaker.bind(api);
    (window as typeof window & { registrationIfMatch: string | undefined }).registrationIfMatch = undefined;
    api.registerSpeaker = async (input, opts) => {
      (window as typeof window & { registrationIfMatch?: string }).registrationIfMatch = opts?.ifMatch;
      return original(input, opts);
    };
    return `"v${meeting.speakerListVersion}"`;
  });

  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill('Konflikt Testperson');
  await page.getByTestId('speaker-register-submit').click();
  await expect(page.getByText('Konflikt Testperson')).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { registrationIfMatch?: string }).registrationIfMatch)).toBe(expected);
});
