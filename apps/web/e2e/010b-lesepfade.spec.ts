/**
 * Slice 010b — Lesepfade in der Oberfläche: gestalteter Zustand ohne Leseberechtigung.
 *
 * Slice 010 (core) taught `can()` to refuse a read with 403 and a rule id (R-PERM-02 "no read
 * permission", R-PERM-03 "read scope exceeded"). This slice is the interface half: every view
 * recognises that refusal by the rule id alone (AGENTS.md rule 4 — never a role name) and renders
 * the house's existing empty-state component instead of an error toast (docs/design-prinzipien.md,
 * "Fehler zeigen Grund und Regel-ID" / "leere Zustände sind gestaltet").
 *
 * Covers every state docs/slices/010b-lesepfade-oberflaeche.md's Ziel 5 lists:
 *   - Wortmeldeliste under podium (no `speaker.read` at all).
 *   - Bühne under expert (holds `question.read`, but no `stage.read`).
 *   - Beantwortung under observer (holds the scoped `question.read.delivered` — sees fewer rows,
 *     never a forbidden state of its own, per Ziel 3).
 *   - Historie under observer (Trefferliste scoped the same way; the Vorgangshistorie- and
 *     Ereignisstrom-tabs of the right panel *are* forbidden — observer holds neither `history.read`
 *     nor `event.read`).
 *   - Historie under expert (the regression from slice 010, Ziel 2: `listSpeakers`, a Nebenabfrage,
 *     used to be bundled into the same `Promise.all` as the corpus read it shares no permission
 *     with, and a denied Nebenabfrage rejected the whole group — the timeline could never open even
 *     though expert can read every question and its history fine).
 * Every scenario also checks axe (slice 013's two-pass helper) and that no error toast appears.
 */
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const SEEDED_QUESTIONS = 800;

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

/** Toasts (`components/Toast.tsx`) render as `role="status"` — a refused read must never raise one
 *  (Ziel 5, "Kein Fehler-Toast in diesen Fällen"), only the gestaltete Zustand it is replaced by. */
async function expectNoErrorToast(page: Page): Promise<void> {
  await expect(page.locator('[role="status"]')).toHaveCount(0);
}

/** The status word of a Historie result row — its last direct `<span>` child, the `StatusBadge`
 *  (`features/history/Page.tsx`). Read from the DOM rather than adding a `data-status` attribute to
 *  a pre-existing element outside this slice's "nur Ladepfade und der Zustand" file allowance. */
async function historyResultStatusWords(page: Page): Promise<string[]> {
  return page.getByTestId('history-result').evaluateAll((nodes) =>
    nodes.map((node) => node.querySelector(':scope > span:last-child')?.textContent?.trim() ?? ''),
  );
}

test.use({ viewport: { width: 1440, height: 900 } });

test('Wortmeldeliste unter podium zeigt den Zustand "keine Leseberechtigung"', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // podium holds neither `speaker.read` nor any other read permission this view needs
  // (docs/slices/010-lesepfade-leserechte.md Festlegung 4) — `listSpeakers` is the Hauptabfrage.
  await asRole(page, 'podium');
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);

  const forbidden = page.getByTestId('speakers-forbidden');
  await expect(forbidden).toBeVisible();
  await expect(forbidden).toContainText('In dieser Rolle keine Leseberechtigung für diese Ansicht');
  // Nothing offered that a role which cannot even read the list could not really do (design
  // principle 9, "Rechte werden nicht erklärt, sie sind einfach da").
  await expect(page.getByTestId('speaker-register')).toHaveCount(0);
  await expect(page.getByTestId('speakers-readonly-hint')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'speakers (podium, no read permission)');
});

test('Bühne unter expert zeigt den Zustand "keine Leseberechtigung"', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // expert holds `question.read` but no `stage.read` — `getStage` is the Hauptabfrage.
  await asRole(page, 'expert');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);

  const forbidden = page.getByTestId('stage-forbidden');
  await expect(forbidden).toBeVisible();
  await expect(forbidden).toContainText('In dieser Rolle keine Leseberechtigung für diese Ansicht');
  await expect(page.getByTestId('stage-current')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'stage (expert, no read permission)');

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-stage-expert-de.png') });

  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(forbidden).toContainText('This role has no read permission for this view.');
  await expectNoErrorToast(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-stage-expert-en.png') });
});

test('Beantwortung unter observer zeigt nur vorgelesene Fragen', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // observer holds the scoped `question.read.delivered` (R-PERM-03's scope) — `listQuestions`
  // succeeds, filtered to `delivered`/`closed` (Ziel 3: no forbidden state of its own here).
  await asRole(page, 'observer');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  const statuses = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-status')));
  expect(statuses.length).toBeGreaterThan(0);
  for (const status of statuses) expect(['delivered', 'closed']).toContain(status);
  // No gestalteter "keine Leseberechtigung"-Zustand here — the view stands with fewer rows, not none.
  await expect(page.getByTestId('answers-forbidden')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'answers (observer, delivered/closed only)');

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-answers-observer-de.png') });

  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expectNoErrorToast(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-answers-observer-en.png') });
});

test('Historie unter observer: nur Vorgelesenes, Zeitleiste und Ereignisstrom ohne Leseberechtigung', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);

  await asRole(page, 'observer');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);

  // Trefferliste: only "vorgelesen"/"abgeschlossen" — the same scope as the Beantwortung above.
  const results = page.getByTestId('history-result');
  await expect(results.first()).toBeVisible();
  const words = await historyResultStatusWords(page);
  expect(words.length).toBeGreaterThan(0);
  for (const word of words) expect(['vorgelesen', 'abgeschlossen']).toContain(word);
  await expect(page.getByTestId('history-forbidden')).toHaveCount(0);

  // Vorgangshistorie tab: observer holds no `history.read` at all — opening any result's course
  // is forbidden, however delivered/closed it is.
  await results.first().click();
  const timelineForbidden = page.getByTestId('history-timeline-forbidden');
  await expect(timelineForbidden).toBeVisible();
  await expect(page.getByTestId('history-timeline')).toHaveCount(0);
  await expectNoErrorToast(page);
  await checkAxe(page, 'history (observer, Vorgangshistorie forbidden)');

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-history-observer-de.png') });

  // Ereignisstrom tab: observer holds no `event.read` either.
  await page.getByTestId('history-tab-stream').click();
  const streamForbidden = page.getByTestId('history-stream-forbidden');
  await expect(streamForbidden).toBeVisible();
  await expect(page.getByTestId('history-stream')).toHaveCount(0);
  await expectNoErrorToast(page);
  await checkAxe(page, 'history (observer, Ereignisstrom forbidden)');

  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(streamForbidden).toContainText('This role has no read permission for the event stream.');
  await page.getByTestId('history-tab-question').click();
  await expect(timelineForbidden).toBeVisible();
  await expect(timelineForbidden).toContainText(
    'This role has no read permission for the history of this question.',
  );
  await expectNoErrorToast(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-history-observer-en.png') });
});

test('Historie unter expert öffnet die Zeitleiste', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // expert holds `question.read` and `history.read` — every question and its course are readable.
  // Only `speaker.read` is missing (a Nebenabfrage of this view, Ziel 2): before the fix, the
  // Promise.all bundling it with units/agendaItems/corpus rejected as a whole and the corpus this
  // view resolves `selected` against never populated, so the timeline never opened at all.
  await asRole(page, 'expert');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('history-forbidden')).toHaveCount(0);

  const results = page.getByTestId('history-result');
  await expect(results.first()).toBeVisible();

  await results.first().click();
  await expect(page.getByTestId('history-timeline')).toBeVisible();
  await expect(page.getByTestId('history-event').first()).toBeVisible();
  await expect(page.getByTestId('history-timeline-forbidden')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'history (expert, Vorgangshistorie opens; listSpeakers denied as a Nebenabfrage)');
});
