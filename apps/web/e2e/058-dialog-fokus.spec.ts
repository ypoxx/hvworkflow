/**
 * Takt-058 — the dialog keeps the focus when the page beneath it renders again (docs/slices/takt-058-dialog-fokus.md).
 *
 * CI `e2e-http` on #179: after Space on "ohne Anspruch" in the refusal dialog the arrow key no longer acted in the dialog.
 * `Dialog` ran its focus effect on every new `onClose`, and callers pass `onClose` inline, so any re-render of the page
 * while the dialog was open sent the focus back to the first focusable element (Close). Here the page re-renders in two
 * ways while a choice is focused: a language switch through the store, and a write elsewhere (a speaker request
 * registered by another person, the pattern of `unrelatedEvent` in 010c-lesezustand.spec.ts). The focus must stay on
 * the choice, and ArrowDown must select the next one.
 *
 * In-process only (not in the `http` file lists of playwright.config.ts): every test starts with a fresh demo state in
 * its own browser context and writes nothing to the questions.
 */
import { CORPUS_DEMO } from '@hv/domain';
import type { Page } from '@playwright/test';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

const I18N_MODULE = '/src/i18n/store.ts';
const API_MODULE = '/src/api/index.ts';
const ACTOR_MODULE = '/src/api/actor.ts';

test.use({ viewport: { width: 1440, height: 900 } });

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

/** The first `assigned` question whose detail offers "Verweigerung vorschlagen" (pattern of 045). */
async function openRefusableQuestion(page: Page): Promise<void> {
  await asRole(page, 'legal');
  if (!/\/answers$/.test(page.url())) await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-status-assigned').click();
  await page.getByTestId('answers-filter-unit').selectOption({ index: 0 });
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  for (let i = 0; i < Math.min(await rows.count(), 20); i++) {
    const row = rows.nth(i);
    if ((await row.getByTestId('answers-row-refusal').count()) > 0) continue;
    const number = (await row.getAttribute('data-number')) ?? '';
    await row.click();
    await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
    if (await page.getByTestId('answer-refuse').isVisible()) return;
  }
  throw new Error('No refusable assigned question for legal.');
}

/** Opens the refusal dialog by keyboard and puts the focus on "ohne Anspruch", checked with Space. */
async function focusNoClaim(page: Page): Promise<void> {
  await openRefusableQuestion(page);
  await page.getByTestId('answer-refuse').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('answer-refuse-submit')).toBeVisible();
  const noClaim = page.getByTestId('answer-refuse-kind-refusal_no_claim');
  for (let i = 0; i < 6 && !(await noClaim.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(noClaim).toBeFocused();
  await page.keyboard.press('Space');
  await expect(noClaim).toBeChecked();
}

/** The page's pending outcome, set by the evaluates below and polled (pattern of 045 E6: never await in the page). */
async function waitDone(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __t058?: string }).__t058)).toBe('done');
}

/** A language switch through the store, as the header's language buttons make it (they sit behind the backdrop). */
async function switchLanguage(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.evaluate(
    ([url, wanted]) => {
      const w = window as unknown as { __t058?: string };
      w.__t058 = 'pending';
      void import(/* @vite-ignore */ url!).then(
        (mod: { setLang: (lang: string) => void }) => {
          mod.setLang(wanted!);
          w.__t058 = 'done';
        },
        (error: unknown) => (w.__t058 = `failed: ${String(error)}`),
      );
    },
    [I18N_MODULE, lang],
  );
  await waitDone(page);
}

/**
 * A write elsewhere: a second meeting-office desk registers a speaker request (pattern of `unrelatedEvent` in 010c).
 * The actor is swapped only around the synchronous start of the write and restored at once.
 */
async function writeElsewhere(page: Page, displayName: string): Promise<void> {
  await page.evaluate(
    ([apiUrl, actorUrl, name]) => {
      type Api = {
        getMeeting: () => Promise<{ speakerListVersion: number }>;
        registerSpeaker: (input: { displayName: string }, opts: { ifMatch: string }) => Promise<unknown>;
      };
      type ActorModule = { getActor: () => unknown; setActor: (actor: unknown) => void };
      const w = window as unknown as { __t058?: string };
      w.__t058 = 'pending';
      void Promise.all([import(/* @vite-ignore */ apiUrl!), import(/* @vite-ignore */ actorUrl!)])
        .then(async ([apiModule, actorModule]) => {
          const { api } = apiModule as { api: Api };
          const actors = actorModule as ActorModule;
          const meeting = await api.getMeeting();
          const previous = actors.getActor();
          actors.setActor({ id: 'u-mod-2', role: 'moderation', displayName: 'Versammlungsbüro 2' });
          let written: Promise<unknown>;
          try {
            written = api.registerSpeaker({ displayName: name! }, { ifMatch: `"v${meeting.speakerListVersion}"` });
          } finally {
            actors.setActor(previous);
          }
          return written;
        })
        .then(
          () => (w.__t058 = 'done'),
          (error: unknown) => (w.__t058 = `failed: ${(error as { detail?: string } | null)?.detail ?? String(error)}`),
        );
    },
    [API_MODULE, ACTOR_MODULE, displayName],
  );
  await waitDone(page);
}

/** After the re-render: the focus is still on "ohne Anspruch", and the arrow key selects the next choice. */
async function expectFocusKept(page: Page): Promise<void> {
  const noClaim = page.getByTestId('answer-refuse-kind-refusal_no_claim');
  const withGround = page.getByTestId('answer-refuse-kind-refusal_with_ground');
  await expect(noClaim).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(withGround).toBeChecked();
  await expect(withGround).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('answer-refuse-submit')).toHaveCount(0);
}

test.describe('058 Dialog behält den Fokus', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/answers');
    await waitForCorpus(page);
  });

  test('F1 Sprachwechsel über den Store bei offenem Dialog', async ({ page }) => {
    await focusNoClaim(page);
    await switchLanguage(page, 'en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expectFocusKept(page);
  });

  test('F2 Schreibung anderswo (Wortmeldung einer anderen Person) bei offenem Dialog', async ({ page }) => {
    await focusNoClaim(page);
    const speakers = page.getByTestId('header-counter-speakers');
    const before = await speakers.innerText();
    await writeElsewhere(page, 'T058 Zweites Büro');
    await expect(speakers).not.toHaveText(before);
    await expectFocusKept(page);
  });
});
