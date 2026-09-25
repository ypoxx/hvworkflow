/**
 * Slice 090 — Eingaben gehören dem Akteur (docs/slices/090-eingaben-je-akteur.md).
 *
 * 010d tied loaded data to the actor. This file checks the other direction: text a person typed
 * must not outlive an actor change. Each case follows the same pattern — role A types, the actor
 * changes to B (and back to A where A is the only one who sees the field) — and expects the field
 * empty or its dialog closed on both sides: nothing of A is shown to B, and nothing is restored
 * for A either (no per-actor draft store, that is Z.365 / 060).
 *
 * Per the Nachtrag des Architekten the fix is per field, not a rebuild of the routes. The cases for
 * fields 010d already clears stay as regression guards; the cases for fields that leaked were run
 * red against the code before the change (the Bericht quotes them).
 *
 * Not here: the search of the Beantwortung (`answers-search`) also survives a switch, but emptying
 * it contradicts three 010c scenarios built on a search kept across the switch — open in the
 * Bericht, for the architect to decide.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { checkAxe } from './support/axe';

const SEEDED_QUESTIONS = 800;

test.use({ viewport: { width: 1440, height: 900 } });

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

const ACTOR_MODULE = '/src/api/actor.ts';

/**
 * Switches the demo actor without the header — the call the role switcher makes. Needed while a
 * modal dialog is open: its backdrop covers the header, so the switcher cannot be clicked, but a
 * second person at the device (or an OIDC re-login) changes the actor all the same. As in
 * `010d-ansichtsdaten.spec.ts`, the import is started and its outcome polled; the page never holds a
 * pending promise for Playwright.
 */
async function switchActor(page: Page, role: string): Promise<void> {
  await page.evaluate(
    ([url, wanted]) => {
      const w = window as unknown as { __switch090?: string };
      w.__switch090 = 'pending';
      void import(/* @vite-ignore */ url!).then(
        (mod: { DEMO_ACTORS: readonly { role: string }[]; setActor: (actor: unknown) => void }) => {
          mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
          w.__switch090 = 'done';
        },
        (error: unknown) => {
          w.__switch090 = `failed: ${String(error)}`;
        },
      );
    },
    [ACTOR_MODULE, role],
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __switch090?: string }).__switch090))
    .toBe('done');
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

/** The value of a field if it is on screen, `null` if it is not — polled, never read once. */
async function valueOrAbsent(page: Page, testId: string): Promise<string | null> {
  const field = page.getByTestId(testId);
  if ((await field.count()) === 0) return null;
  return field.inputValue();
}

/** The capture desk with the Redebeitrag form open for the preselected Wortmeldung. */
async function captureForm(page: Page): Promise<void> {
  await page.goto('/capture');
  await waitForCorpus(page);
  const text = page.getByTestId('capture-text');
  const compose = page.getByTestId('capture-contribution-new');
  await expect(text.or(compose)).toBeVisible();
  if (!(await text.isVisible())) await compose.click();
  await expect(text).toBeVisible();
}

/** The Beantwortung as `role`, one question of `status` selected. */
async function answersWith(page: Page, role: string, status: string): Promise<void> {
  await page.goto('/answers');
  await waitForCorpus(page);
  await asRole(page, role);
  await selectFirst(page, status);
}

async function selectFirst(page: Page, status: string): Promise<void> {
  await page.getByTestId(`answers-filter-status-${status}`).click();
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-status', status);
  await row.click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
}

test('090: Erfassung, Redebeitrag (draft) — capture tippt, Wechsel zu observer und zurück: leer', async ({
  page,
}) => {
  await captureForm(page);
  await page.getByTestId('capture-text').fill('Vertraulicher Redebeitrag der vorigen Person.');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'capture-text')).not.toBe(
    'Vertraulicher Redebeitrag der vorigen Person.',
  );
  await expect(page.locator('#main')).not.toContainText(
    'Vertraulicher Redebeitrag',
  );

  await asRole(page, 'capture');
  const text = page.getByTestId('capture-text');
  const compose = page.getByTestId('capture-contribution-new');
  await expect(text.or(compose)).toBeVisible();
  if (!(await text.isVisible())) await compose.click();
  await expect.poll(() => valueOrAbsent(page, 'capture-text')).toBe('');
  await checkAxe(page, 'capture (090, after a role switch and back)');
});

test('090: Erfassung, freie Einzelfrage (free) — capture tippt, Wechsel zu observer und zurück: leer', async ({
  page,
}) => {
  await captureForm(page);
  await page.getByTestId('capture-text').fill('Ein Redebeitrag, damit das Feld für freie Fragen erscheint.');
  await page.getByTestId('capture-submit').click();
  const free = page.getByTestId('capture-free-input');
  await expect(free).toBeVisible();
  await free.fill('Vertrauliche Frage der vorigen Person?');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'capture-free-input')).not.toBe(
    'Vertrauliche Frage der vorigen Person?',
  );

  await asRole(page, 'capture');
  await expect(free).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'capture-free-input')).toBe('');
});

test('090: Antwortentwurf — expert tippt, Wechsel zu legal und zurück: leer', async ({ page }) => {
  await answersWith(page, 'expert', 'assigned');
  const number = await page.getByTestId('answers-detail-number').innerText();
  await page.getByTestId('answer-editor').fill('Vertraulicher Antwortentwurf der vorigen Person.');
  await page.getByTestId('answer-sources').fill('Vertrauliche Quelle');

  await asRole(page, 'legal');
  await expect.poll(() => valueOrAbsent(page, 'answer-editor')).not.toBe(
    'Vertraulicher Antwortentwurf der vorigen Person.',
  );

  await asRole(page, 'expert');
  // The same question again, whether or not the selection survived the switch.
  if ((await page.getByTestId('answers-detail-number').count()) === 0) {
    await selectFirst(page, 'assigned');
  }
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await expect(page.getByTestId('answer-editor')).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'answer-editor')).toBe('');
  await expect.poll(() => valueOrAbsent(page, 'answer-sources')).toBe('');
  await checkAxe(page, 'answers (090, after a role switch and back)');
});

test('090: Begründung der Rückgabe — legal tippt, Wechsel zu approver und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await answersWith(page, 'legal', 'in_review');
  await page.getByTestId('answer-return').click();
  await page.getByTestId('answer-return-reason').fill('Vertrauliche Begründung der vorigen Person.');

  await switchActor(page, 'approver');
  await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);

  await asRole(page, 'legal');
  await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);
  if ((await page.getByTestId('answer-return').count()) === 0) await selectFirst(page, 'in_review');
  await page.getByTestId('answer-return').click();
  await expect.poll(() => valueOrAbsent(page, 'answer-return-reason')).toBe('');
});

test('090: Wortmeldung registrieren (Name) — moderation tippt, Wechsel zu capture und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await page.goto('/speakers');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill('Vertraulicher Name');

  await switchActor(page, 'capture');
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);

  await asRole(page, 'moderation');
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);
  await page.getByTestId('speaker-register').click();
  await expect.poll(() => valueOrAbsent(page, 'speaker-register-name')).toBe('');
});

test('090: Suche der Historie — admin tippt, Wechsel zu observer und zurück: leer', async ({ page }) => {
  await page.goto('/history');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  const search = page.getByTestId('history-search');
  await expect(search).toBeVisible();
  await search.fill('Vertraulicher Suchbegriff');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'history-search')).not.toBe('Vertraulicher Suchbegriff');

  await asRole(page, 'admin');
  await expect(search).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'history-search')).toBe('');
  await checkAxe(page, 'history (090, after a role switch and back)');
});

test('090: Nummer im Zusammenführen-Dialog — capture tippt, Wechsel zu moderation und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await answersWith(page, 'capture', 'assigned');
  await page.getByTestId('answer-merge').click();
  await page.getByTestId('answer-merge-target').fill('F-0001');

  await switchActor(page, 'moderation');
  await expect(page.getByTestId('answer-merge-target')).toHaveCount(0);

  await switchActor(page, 'capture');
  await expect(page.getByTestId('answer-merge-target')).toHaveCount(0);
  if ((await page.getByTestId('answer-merge').count()) === 0) await selectFirst(page, 'assigned');
  await page.getByTestId('answer-merge').click();
  await expect.poll(() => valueOrAbsent(page, 'answer-merge-target')).toBe('');
});

test('090: Begründung der Rückgabe auf der Bühne — podium tippt, Wechsel zu approver und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await page.goto('/stage');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  await page.getByTestId('stage-return').click();
  await page.getByTestId('stage-return-reason').fill('Vertrauliche Begründung am Pult.');

  await switchActor(page, 'approver');
  await expect
    .poll(() => valueOrAbsent(page, 'stage-return-reason'))
    .not.toBe('Vertrauliche Begründung am Pult.');

  await switchActor(page, 'podium');
  await expect(page.getByTestId('stage-return')).toBeVisible();
  if ((await page.getByTestId('stage-return-reason').count()) === 0) {
    await page.getByTestId('stage-return').click();
  }
  await expect.poll(() => valueOrAbsent(page, 'stage-return-reason')).toBe('');
});
