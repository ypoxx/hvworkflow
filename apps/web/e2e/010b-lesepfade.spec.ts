/**
 * Slice 010b — Lesepfade in der Oberfläche: gestalteter Zustand ohne Leseberechtigung.
 *
 * Slice 010 (core) taught `can()` to refuse a read with 403 and a rule id (R-PERM-02 "no read
 * permission", R-PERM-03 "read scope exceeded"). This slice is the interface half: every view
 * recognises that refusal by the rule id alone (AGENTS.md rule 4 — never a role name) and renders
 * the house's existing empty-state component instead of an error toast (docs/design-prinzipien.md,
 * "Fehler zeigen Grund und Regel-ID" / "leere Zustände sind gestaltet").
 *
 * Covers every state docs/slices/010b-lesepfade-oberflaeche.md's Ziel 5 lists, plus the gaps a
 * review round found ("Nacharbeit nach Review und Codex" in the same spec's Bericht):
 *   - Wortmeldeliste under podium (no `speaker.read` at all).
 *   - Bühne under expert (holds `question.read`, but no `stage.read`) — twice: once with the
 *     ordinary layout's own default, once with a stored "Nur Bühne" choice forced ahead of the
 *     visit, proving the fullscreen device and its chrome never take over a role that cannot read
 *     the stage (minor 4).
 *   - Erfassung under observer (blocker, also Codex P1: `listContributions` used to run only once
 *     a `speakerId` resolved, and every role denied `contribution.read` is also denied
 *     `speaker.read`, so it never even tried the Hauptabfrage).
 *   - Beantwortung under observer (holds the scoped `question.read.delivered` — sees fewer rows,
 *     never a forbidden state of its own, per Ziel 3), including opening a row (major finding:
 *     `getQuestion`/`getQuestionHistory` used to share one `Promise.all`, so a denied history
 *     rejected the question too and a click looked like nothing happened).
 *   - Historie under observer (Trefferliste scoped the same way; the Vorgangshistorie- and
 *     Ereignisstrom-tabs of the right panel *are* forbidden — observer holds neither `history.read`
 *     nor `event.read`).
 *   - Historie under expert (the regression from slice 010, Ziel 2: `listSpeakers`, a Nebenabfrage,
 *     used to be bundled into the same `Promise.all` as the corpus read it shares no permission
 *     with, and a denied Nebenabfrage rejected the whole group — the timeline could never open even
 *     though expert can read every question and its history fine).
 *   - Beantwortung and Historie under podium (test gap 8b, acceptance criterion 1): the whole-view
 *     gestalteter Zustand for a role denied the Hauptabfrage outright, not just scoped like observer.
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

/**
 * Toasts (`components/Toast.tsx`) render as `role="status"` inside the shell's one
 * `aria-live="polite"` stack (`ToastProvider`) — scoped to that container, not to `role="status"`
 * alone: minor 5 (review round 2) gives every gestaltete Zustand the same role so a screen reader
 * announces it too, and an unscoped selector would find those instead of an actual toast.
 *
 * Nit 11a: `expect(...).toHaveCount(0)` resolves the instant the count reads zero — it does not
 * wait out its own timeout to see whether a toast is still on its way in. The in-process demo API
 * (`apps/web/src/api/index.ts`) settles every read on a microtask, well within a frame, so one
 * settled repaint (`requestAnimationFrame`, twice — Chromium can coalesce a single one with work
 * already queued) is enough of a wait to be honest, without the flakiness `networkidle` risks
 * against Vite's own always-open HMR socket.
 */
async function expectNoErrorToast(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await expect(page.locator('[aria-live="polite"] [role="status"]')).toHaveCount(0);
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
  await expect(forbidden).toContainText('This role has no read permission for this view');
  await expectNoErrorToast(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-stage-expert-en.png') });
});

test('Bühne unter expert bleibt im gewöhnlichen Layout, auch wenn "Nur Bühne" gespeichert ist', async ({
  page,
}) => {
  /**
   * Minor 4 (review round 2): a stored "Nur Bühne" choice (`hv-stage-only-v1`) is a fact about the
   * device, not about whether this role may currently read the stage — no role that is denied
   * `stage.read` ever derives "Nur Bühne" on its own (`stageOnlyByRights` needs `question.deliver`,
   * and the only role that holds it, podium, always holds `stage.read` too), so this can only be
   * observed by forcing the stored choice ahead of the visit, before the app boots.
   */
  await page.addInitScript(() => {
    window.localStorage.setItem('hv-stage-only-v1', '1');
  });
  await page.goto('/');
  await waitForCorpus(page);

  await asRole(page, 'expert');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);

  // The fullscreen "Nur Bühne" overlay, and every counter/toggle it would have carried, stays off
  // — a role that cannot read the stage gets the ordinary layout's gestalteter Zustand instead of
  // a fullscreen device with nothing real to show.
  await expect(page.getByTestId('stage-only')).toHaveCount(0);
  const forbidden = page.getByTestId('stage-forbidden');
  await expect(forbidden).toBeVisible();
  await expect(page.getByTestId('stage-counter-delivered')).toHaveCount(0);
  await expect(page.getByTestId('stage-counter-open')).toHaveCount(0);
  await expect(page.getByTestId('stage-contrast-toggle')).toHaveCount(0);
  await expect(page.getByTestId('stage-only-toggle')).toHaveCount(0);

  // The keyboard shortcuts of a device that has nothing to act on are refused outright — a click
  // on the gestaltete Zustand's own text first moves focus off the nav link `nav-stage` just
  // activated (an `<a>`, itself an interactive target the handler already ignores) so this
  // actually exercises the new `forbidden` guard, not the pre-existing interactive-target one.
  await forbidden.click();
  await page.keyboard.press('Space');
  await expectNoErrorToast(page);
  await expect(page.getByTestId('stage-current')).toHaveCount(0);

  await checkAxe(page, 'stage (expert, no read permission, stored "Nur Bühne")');
});

test('Erfassung unter observer zeigt den Zustand "keine Leseberechtigung"', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Blocker (review round 2, also Codex P1): observer holds neither `speaker.read` nor
  // `contribution.read`. `listContributions` (the Hauptabfrage) used to run only once a
  // `speakerId` existed, and `speakerId` is only ever derived from a successful `listSpeakers` —
  // so a role denied both never triggered the Hauptabfrage's own 403 at all and fell through to
  // the ordinary "no contribution chosen" empty desk, with the read-only hint on top of it (wrong:
  // a role that cannot read the desk is not "read only" on it, it cannot see it).
  await asRole(page, 'observer');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  const forbidden = page.getByTestId('capture-forbidden');
  await expect(forbidden).toBeVisible();
  await expect(forbidden).toContainText('In dieser Rolle keine Leseberechtigung für diese Ansicht');
  await expect(page.getByTestId('capture-readonly-hint')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'capture (observer, no read permission)');
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

  /**
   * Major (review round 2): `getQuestion` and `getQuestionHistory` used to share one
   * `Promise.all` — observer holds no `history.read`, so every row click rejected as a whole and
   * the detail stayed on "Keine Einzelfrage gewählt" with no feedback at all. The question must
   * show regardless, and the refused state stands where its history would be.
   */
  await rows.first().click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answers-detail-number')).not.toBeEmpty();
  const historyForbidden = page.getByTestId('answers-history-forbidden');
  await expect(historyForbidden).toBeVisible();
  await expect(historyForbidden).toContainText('Diese Rolle darf den Verlauf dieser Einzelfrage nicht lesen.');

  await expectNoErrorToast(page);
  await checkAxe(page, 'answers (observer, delivered/closed only, question detail open)');

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010b-answers-observer-de.png') });

  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(historyForbidden).toContainText('This role may not read the course of this question.');
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
  // Minor 3 (review round 2): the "Die letzten n Ereignisse" count line belongs to real data — it
  // must not linger, stale, next to the refused state.
  await expect(page.getByText(/Die letzten \d+ Ereignisse/)).toHaveCount(0);
  await expectNoErrorToast(page);
  await checkAxe(page, 'history (observer, Ereignisstrom forbidden)');

  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(streamForbidden).toContainText('This role has no read permission for the event stream');
  await page.getByTestId('history-tab-question').click();
  await expect(timelineForbidden).toBeVisible();
  await expect(timelineForbidden).toContainText(
    'This role has no read permission for the history of this question',
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

  /**
   * Test gap 8a (review round 2): "Namen aus listSpeakers fehlen" (docs/slices/010b-lesepfade-
   * oberflaeche.md Ziel 5). `speakerNames` (the Nebenabfrage's own result) feeds exactly one
   * place: `eventSubject()` (eventSummary.ts), read only by the "Ereignisstrom" tab's subject
   * column — the "Vorgangshistorie" tab open above uses `eventSummary()` instead, which never
   * reads it (`SpeakerRegistered`'s own name comes from `event.payload.displayName`, embedded in
   * the event itself, not looked up). `event.read` — the Ereignisstrom's own Hauptabfrage — is
   * held by no role that lacks `speaker.read` either (`event.read`: admin only; admin holds every
   * permission, docs/slices/010-lesepfade-leserechte.md Festlegung 4): under today's grants there
   * is no role for which "the names are missing but the events show" is a state that exists on
   * screen anywhere to assert on. What is real and testable is the total absence this Nebenabfrage
   * denial shares with `event.read`'s own denial — checked here.
   */
  await page.getByTestId('history-tab-stream').click();
  await expect(page.getByTestId('history-stream-forbidden')).toBeVisible();
  await expect(page.getByTestId('history-stream')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'history (expert, Vorgangshistorie opens; listSpeakers denied as a Nebenabfrage)');
});

test('Beantwortung unter podium zeigt den Zustand "keine Leseberechtigung"', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Test gap 8b (review round 2, acceptance criterion 1): podium holds neither `question.read` nor
  // `question.read.delivered` at all — `listQuestions` (the Hauptabfrage) refuses outright, unlike
  // observer's scoped grant.
  await asRole(page, 'podium');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  const forbidden = page.getByTestId('answers-forbidden');
  await expect(forbidden).toBeVisible();
  await expect(forbidden).toContainText('In dieser Rolle keine Leseberechtigung für diese Ansicht');
  // Minor 6 (review round 2): the right pane does not go on inviting a click into a backlog that
  // does not exist for this role.
  await expect(page.getByTestId('answers-detail')).toHaveCount(0);
  await expect(page.getByText('Wählen Sie links eine Einzelfrage')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'answers (podium, no read permission)');
});

test('Historie unter podium zeigt den Zustand "keine Leseberechtigung"', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Test gap 8b: podium holds neither `question.read` nor `question.read.delivered` — the whole
  // view's Hauptabfrage (`listQuestions`) refuses, unlike observer's scoped grant (Ziel 3).
  await asRole(page, 'podium');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);

  const forbidden = page.getByTestId('history-forbidden');
  await expect(forbidden).toBeVisible();
  await expect(forbidden).toContainText('In dieser Rolle keine Leseberechtigung für diese Ansicht');
  await expect(page.getByTestId('history-result')).toHaveCount(0);

  await expectNoErrorToast(page);
  await checkAxe(page, 'history (podium, no read permission, whole view)');
});
