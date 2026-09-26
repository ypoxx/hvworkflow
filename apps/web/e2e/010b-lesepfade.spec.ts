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
import { CORPUS_DEMO } from '@hv/domain';
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;


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
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

/**
 * Toasts (`components/Toast.tsx`) render as `role="status"` inside the shell's one
 * `aria-live="polite"` stack (`ToastProvider`) — scoped to that container, not to `role="status"`
 * alone: minor 5 (review round 2) gives every gestaltete Zustand the same role (a status message;
 * whether a screen reader announces it is not guaranteed, nit 6 of review round 3), and an unscoped
 * selector would find those instead of an actual toast.
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

/**
 * Review round 3: the demo API runs in-process (ADR 0002), so there is no network request to
 * intercept or count. Vite's dev server hands `page.evaluate` the very module instance the app
 * imported, so a test can wrap one `HvApi` method in place — to count its calls, hold its answer
 * back, or fail it with a 500 — and the app's next call goes through the wrapper.
 *
 * Nit D (review round 4): Patch nur gegen `vite` dev, nicht gegen einen Build; eigener Port je
 * Worktree (E2E_PORT). A production bundle has no `/src/api/index.ts` to import, and two worktrees
 * sharing one dev server would patch each other's module.
 */
const API_MODULE = '/src/api/index.ts';
/** The demo actor store — only the tests use it, to switch the actor without the header (review
 *  round 4, B: the "Nur Bühne" overlay covers the role switcher). */
const ACTOR_MODULE = '/src/api/actor.ts';

/** The shell's toast stack (see `expectNoErrorToast` above for why it is scoped this way). */
const toasts = (page: Page) => page.locator('[aria-live="polite"] [role="status"]');

async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
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

// ---------------------------------------------------------------------------------------------
// Review round 3 (Nachprüfung Opus 5.5 auf 7f542b6) and Codex on 7f542b6. Each test below was run
// red against 7f542b6 before its fix (the Bericht, "Nacharbeit Runde 3", quotes both runs).
// ---------------------------------------------------------------------------------------------

type Wrapped = Record<string, (...args: unknown[]) => Promise<unknown>>;
interface Probe {
  __calls: unknown[];
  __fail: boolean;
}

test('Runde 3 (1): Erfassung fragt listContributions nicht ungefiltert nach, ein 500 bringt einen Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Every call's filter is recorded; `__fail` turns every call into a 500 (not a read refusal).
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const w = window as unknown as Probe;
    w.__calls = [];
    w.__fail = false;
    const original = api['listContributions']!.bind(api);
    api['listContributions'] = (...args: unknown[]) => {
      w.__calls.push(args[0] ?? null);
      return w.__fail
        ? Promise.reject({ status: 500, title: 'Testfehler', detail: 'Runde 3, absichtlich' })
        : original(...args);
    };
  }, API_MODULE);

  // moderation and capture both hold `speaker.read` and `contribution.read`: the desk resolves a
  // Wortmeldung under either, and switching between them only bumps `version`.
  await asRole(page, 'moderation');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as Probe).__calls.some((call) => call !== null && typeof call === 'object'),
      ),
    )
    .toBe(true);
  await settle(page);
  await expect(toasts(page)).toHaveCount(0);

  await page.evaluate(() => {
    const w = window as unknown as Probe;
    w.__calls = [];
    w.__fail = true;
  });
  await asRole(page, 'capture');
  await expect.poll(() => page.evaluate(() => (window as unknown as Probe).__calls.length)).toBeGreaterThan(0);
  await settle(page);

  // A Wortmeldung is resolved, so no unfiltered call of the whole corpus is needed any more …
  const calls = await page.evaluate(() => (window as unknown as Probe).__calls);
  expect(calls.filter((call) => call === null)).toEqual([]);
  // … and one failed load is one toast, not two.
  await expect(toasts(page)).toHaveCount(1);
});

test('Runde 3 (2) / Codex (a): Beantwortung — der Verlauf gehört zur gewählten Einzelfrage', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');

  // The first question opened gets a lapsed approval appended to its real history; every later
  // question's history is held back and never arrives, so what the detail shows for it can only
  // come from its own (unknown) history — never from the previous question's.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const original = api['getQuestionHistory']!.bind(api);
    let first: unknown;
    api['getQuestionHistory'] = (id: unknown) => {
      if (first === undefined) first = id;
      if (id !== first) return new Promise(() => undefined);
      return original(id).then((events) => [
        ...(events as unknown[]),
        {
          seq: Number.MAX_SAFE_INTEGER,
          type: 'AnswerDrafted',
          at: '2026-06-01T10:00:00.000Z',
          payload: { questionId: id, answer: { version: 2 }, invalidatedApprovalOfVersion: 1 },
        },
      ]);
    };
  }, API_MODULE);

  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  // "zugewiesen" (`assigned`): no answer yet, so no approval of its own that would hide a lapsed one.
  await page.getByRole('group', { name: 'Stand' }).getByRole('button', { name: /^zugewiesen/ }).click();
  const fresh = page.locator('[data-testid="answers-row"][data-status="assigned"]');
  await expect(fresh.nth(1)).toBeVisible();

  await fresh.nth(0).click();
  await expect(page.getByTestId('approval-lapsed')).toBeVisible();

  const second = await fresh.nth(1).getAttribute('data-number');
  await fresh.nth(1).click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(second ?? '');
  await settle(page);
  await expect(page.getByTestId('approval-lapsed')).toHaveCount(0);
});

test('Runde 3 (2): Beantwortung — scheitern Einzelfrage und Verlauf beide, erscheint ein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();

  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const fail = () => Promise.reject({ status: 500, title: 'Testfehler', detail: 'Runde 3, absichtlich' });
    api['getQuestion'] = fail;
    api['getQuestionHistory'] = fail;
  }, API_MODULE);

  await rows.first().click();
  await expect(toasts(page).first()).toBeVisible();
  await settle(page);
  await expect(toasts(page)).toHaveCount(1);
});

test('Codex (b): Beantwortung — Rollenwechsel ohne Leserecht bei offener Einzelfrage bringt keinen Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();

  // podium holds neither `question.read` nor `question.read.delivered`: the list refuses with
  // R-PERM-02, but the open question's own `getQuestion` answers with the masked 404, which is no
  // read refusal and would become a toast on top of the gestaltete Zustand.
  await asRole(page, 'podium');
  await expect(page.getByTestId('answers-forbidden')).toBeVisible();
  await expectNoErrorToast(page);
  await expect(page.getByTestId('answers-detail')).toHaveCount(0);
});

test('Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await page.getByTestId('history-tab-stream').click();

  const countLine = page.getByText(/Die letzten \d+ Ereignisse/);
  await expect(page.getByTestId('history-event').first()).toBeVisible();
  await expect(countLine).toBeVisible();

  // observer holds no `event.read`: the count of the previous role must go with the stream.
  await asRole(page, 'observer');
  await expect(page.getByTestId('history-stream-forbidden')).toBeVisible();
  await expect(countLine).toHaveCount(0);
  await expect(page.getByTestId('history-event')).toHaveCount(0);

  // Back to admin: `streamLastSeq` was rewound, so the unchanged log is read again, not skipped.
  await asRole(page, 'admin');
  await expect(page.getByTestId('history-stream')).toBeVisible();
  await expect(page.getByTestId('history-event').first()).toBeVisible();
  await expect(countLine).toBeVisible();
  await expect(countLine).not.toHaveText(/Die letzten 0 Ereignisse/);
  await expectNoErrorToast(page);
});

test('Runde 3 (4): Bühne — ein gespeichertes "Nur Bühne" blitzt nicht auf, bevor getStage antwortet', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hv-stage-only-v1', '1');
    // Records whether the fullscreen overlay was ever in the DOM, however briefly.
    const w = window as unknown as { __sawStageOnly: boolean };
    w.__sawStageOnly = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="stage-only"]') !== null) w.__sawStageOnly = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/');
  await waitForCorpus(page);

  // `getStage` answers one and a half seconds late — long enough to see what stands meanwhile.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const original = api['getStage']!.bind(api);
    api['getStage'] = (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        window.setTimeout(() => void original(...args).then(resolve, reject), 1500);
      });
  }, API_MODULE);

  await asRole(page, 'expert');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-deciding')).toBeVisible();
  await expect(page.getByTestId('stage-counter-delivered')).toHaveCount(0);

  await expect(page.getByTestId('stage-forbidden')).toBeVisible();
  await expect(page.getByTestId('stage-only')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __sawStageOnly: boolean }).__sawStageOnly)).toBe(
    false,
  );
  await expectNoErrorToast(page);
});

test('Runde 3 (5): Bühne — podium mit aktueller Frage, Wechsel zu expert, Leertaste liefert nichts aus', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  // The ordinary shell, so the role switcher stays reachable (as in 013e).
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();

  // The server refuses a delivery by expert anyway (R-PERM-01), so the delivered count alone would
  // stay the same even without the fix; what the fix prevents is the attempt itself — counted here
  // — and the error toast its refusal would raise.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const w = window as unknown as Probe;
    w.__calls = [];
    const original = api['deliverQuestion']!.bind(api);
    api['deliverQuestion'] = (...args: unknown[]) => {
      w.__calls.push(args[0] ?? null);
      return original(...args);
    };
  }, API_MODULE);

  await asRole(page, 'expert');
  const forbidden = page.getByTestId('stage-forbidden');
  await expect(forbidden).toBeVisible();
  // Off the nav/role-switcher controls, so the shortcut handler actually sees the key.
  await forbidden.click();
  await page.keyboard.press('Space');
  await settle(page);

  expect(await page.evaluate(() => (window as unknown as Probe).__calls.length)).toBe(0);
  await expectNoErrorToast(page);
  await expect(page.getByTestId('stage-current')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Review round 4 (Nachprüfung auf 4f0d231) and Codex on 4f0d231. Run red against 4f0d231 first;
// the Bericht, "Nacharbeit Runde 4", quotes both runs.
// ---------------------------------------------------------------------------------------------

test('Codex P2-1 (4f0d231): Erfassung fragt vom ersten Aufruf an nicht ungefiltert, wenn es Wortmeldungen gibt', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  // Away from the desk first, so the patch below is in place before the desk mounts afresh
  // (no `?speaker`) — every call from the very first one is recorded.
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const w = window as unknown as Probe;
    w.__calls = [];
    const original = api['listContributions']!.bind(api);
    api['listContributions'] = (...args: unknown[]) => {
      w.__calls.push(args[0] ?? null);
      return original(...args);
    };
  }, API_MODULE);

  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as Probe).__calls.some((call) => call !== null && typeof call === 'object'),
      ),
    )
    .toBe(true);
  await settle(page);
  // moderation can read the Wortmeldungen, so the desk resolves one — the unfiltered probe for
  // "may this role read Erfassung at all?" is never needed.
  const calls = await page.evaluate(() => (window as unknown as Probe).__calls);
  expect(calls.filter((call) => call === null)).toEqual([]);
  await expectNoErrorToast(page);
});

test('Codex P2-2 (4f0d231): Historie — Rollenwechsel ohne Leserecht bei gewählter Frage bringt keinen Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  const results = page.getByTestId('history-result');
  await expect(results.first()).toBeVisible();
  await results.first().click();
  await expect(page.getByTestId('history-timeline')).toBeVisible();

  // podium: the list refuses with R-PERM-02, the selected question's `getQuestionHistory` answers
  // with the masked 404 — which must not become a toast on top of the gestaltete Zustand.
  await asRole(page, 'podium');
  await expect(page.getByTestId('history-forbidden')).toBeVisible();
  await expectNoErrorToast(page);
});

test('Runde 4 (A): Bühne — nach einem 500 von getStage wirkt "Vorgelesen, weiter" auf die angezeigte Frage', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  // admin may deliver, and may write something unrelated to the stage (a Wortmeldung) below.
  await asRole(page, 'admin');
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  const currentNumber = page.getByTestId('stage-current-number');
  await expect(currentNumber).toBeVisible();

  // The next `getStage` fails once with a 500; every `deliverQuestion` is counted.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const w = window as unknown as Probe;
    w.__calls = [];
    const originalStage = api['getStage']!.bind(api);
    let failed = false;
    api['getStage'] = (...args: unknown[]) => {
      if (failed) return originalStage(...args);
      failed = true;
      return Promise.reject({ status: 500, title: 'Testfehler', detail: 'Runde 4, absichtlich' });
    };
    const originalDeliver = api['deliverQuestion']!.bind(api);
    api['deliverQuestion'] = (...args: unknown[]) => {
      w.__calls.push(args[0] ?? null);
      return originalDeliver(...args);
    };
  }, API_MODULE);

  // A new event bumps `version` for the same actor, and that reload fails. Review round 5: this
  // used to be a role switch podium → admin; since Codex P2-B on 948a721 an actor change drops the
  // previous actor's record on purpose, so the failed reload is now caused by an ordinary event.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    await api['registerSpeaker']!({ displayName: 'Testperson Runde 5' });
  }, API_MODULE);
  await expect(toasts(page)).toHaveCount(1);
  await expect(currentNumber).toBeVisible();

  await page.getByTestId('stage-next').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as Probe).__calls.length)).toBe(1);
});

test('Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" zeigt nicht das Overlay der vorigen Rolle', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('hv-stage-only-v1', '1');
  });
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-only')).toBeVisible();

  // `getStage` answers one and a half seconds late from now on.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const original = api['getStage']!.bind(api);
    api['getStage'] = (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        window.setTimeout(() => void original(...args).then(resolve, reject), 1500);
      });
  }, API_MODULE);

  // The overlay covers the header's role switcher, so the actor is switched through the demo
  // actor store directly — the same call the switcher makes. Nit 4 (review round 5): a
  // MutationObserver, armed in the same task as the switch, records whether the overlay is still in
  // the DOM at any later mutation — `toBeVisible` on the skeleton alone would not see a short flash.
  await page.evaluate(async (url) => {
    const mod = (await import(/* @vite-ignore */ url)) as {
      DEMO_ACTORS: readonly { role: string }[];
      setActor: (actor: unknown) => void;
    };
    const w = window as unknown as { __overlayAfterSwitch: boolean };
    w.__overlayAfterSwitch = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="stage-only"]') !== null) w.__overlayAfterSwitch = true;
    }).observe(document, { childList: true, subtree: true, attributes: true });
    mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === 'expert'));
  }, ACTOR_MODULE);

  await expect(page.getByTestId('stage-deciding')).toBeVisible();
  await expect(page.getByTestId('stage-only')).toHaveCount(0);
  await expect(page.getByTestId('stage-forbidden')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { __overlayAfterSwitch: boolean }).__overlayAfterSwitch),
  ).toBe(false);
  await expectNoErrorToast(page);
});

// ---------------------------------------------------------------------------------------------
// Review round 5 (Nachprüfung auf 948a721) and Codex on 948a721. Run red against 948a721 first;
// the Bericht, "Nacharbeit Runde 5", quotes both runs.
// ---------------------------------------------------------------------------------------------

/** Switches the demo actor in the running app without the header — the call the switcher makes. */
async function switchActor(page: Page, role: string): Promise<void> {
  await page.evaluate(
    async ([url, wanted]) => {
      const mod = (await import(/* @vite-ignore */ url!)) as {
        DEMO_ACTORS: readonly { role: string }[];
        setActor: (actor: unknown) => void;
      };
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
    },
    [ACTOR_MODULE, role],
  );
}

test('Codex P2-A (948a721): Beantwortung — Wechsel zu observer bei offener, nicht vorgelesener Frage', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  // "zugewiesen" (`assigned`): not delivered, so outside observer's `question.read.delivered`.
  await page.getByRole('group', { name: 'Stand' }).getByRole('button', { name: /^zugewiesen/ }).click();
  const row = page.locator('[data-testid="answers-row"][data-status="assigned"]').first();
  await row.click();
  const detail = page.getByTestId('answers-detail');
  await expect(detail).toBeVisible();
  // admin's own steps for this question — the `_actions` that must not outlive the switch.
  await expect(detail.getByRole('toolbar')).toBeVisible();

  // observer's list succeeds (scoped), but no longer contains the open question; its
  // `getQuestion`/`getQuestionHistory` answer with the masked 404.
  await asRole(page, 'observer');
  await expect(page.getByTestId('answers-forbidden')).toHaveCount(0);
  await expectNoErrorToast(page);
  await expect(detail).toHaveCount(0);
  await expect(page.getByRole('toolbar', { name: 'Schritte zu dieser Einzelfrage' })).toHaveCount(0);
});

test('Codex P2-A (948a721): Historie — Wechsel zu observer bei gewählter, nicht vorgelesener Frage', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  const results = page.getByTestId('history-result');
  await expect(results.first()).toBeVisible();
  const words = await historyResultStatusWords(page);
  const index = words.findIndex((word) => word !== 'vorgelesen' && word !== 'abgeschlossen');
  expect(index).toBeGreaterThanOrEqual(0);
  await results.nth(index).click();
  await expect(page.getByTestId('history-timeline')).toBeVisible();

  await asRole(page, 'observer');
  await expect(page.getByTestId('history-forbidden')).toHaveCount(0);
  await expectNoErrorToast(page);
  await expect(page.getByTestId('history-timeline')).toHaveCount(0);
  await expect(page.getByTestId('history-timeline-forbidden')).toHaveCount(0);
});

test('Codex P2-B (948a721): Bühne — eine Antwort, die noch für die vorige Rolle unterwegs ist, wird nicht übernommen', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();

  // Latency patch: every `getStage` is answered by the API at once — for the actor current at
  // that moment — but handed to the page only when the test releases it.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const w = window as unknown as { __held: (() => void)[]; __release: () => void };
    w.__held = [];
    w.__release = () => {
      for (const deliver of w.__held.splice(0)) deliver();
    };
    const original = api['getStage']!.bind(api);
    api['getStage'] = (...args: unknown[]) => {
      const answer = original(...args);
      // Handled later, on release — this only keeps a held refusal from counting as unhandled.
      answer.catch(() => undefined);
      return new Promise((resolve, reject) => {
        w.__held.push(() => void answer.then(resolve, reject));
      });
    };
  }, API_MODULE);

  // podium's own `getStage` is now on its way (held) ...
  await asRole(page, 'podium');
  await expect(page.getByTestId('stage-deciding')).toBeVisible();

  // ... and arrives in the very task in which the actor becomes expert, which may not read the
  // stage. A MutationObserver records whether podium's question shows at any moment after.
  await page.evaluate(async (url) => {
    const mod = (await import(/* @vite-ignore */ url)) as {
      DEMO_ACTORS: readonly { role: string }[];
      setActor: (actor: unknown) => void;
    };
    const w = window as unknown as { __release: () => void; __sawStale: boolean };
    w.__sawStale = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="stage-current"]') !== null) w.__sawStale = true;
    }).observe(document, { childList: true, subtree: true });
    w.__release();
    mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === 'expert'));
  }, ACTOR_MODULE);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __sawStale: boolean }).__sawStale)).toBe(false);

  // expert's own answer (a refusal) is released last.
  await page.evaluate(() => (window as unknown as { __release: () => void }).__release());
  await expect(page.getByTestId('stage-forbidden')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sawStale: boolean }).__sawStale)).toBe(false);
  await expectNoErrorToast(page);
});

test('Runde 5 (1): Erfassung — der Zustand "keine Leseberechtigung" flackert bei Latenz nicht', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'observer');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByTestId('capture-forbidden')).toBeVisible();

  // The Wortmeldung lookup answers 300 ms late from now on.
  await page.evaluate(async (url) => {
    const { api } = (await import(/* @vite-ignore */ url)) as { api: Wrapped };
    const original = api['listSpeakers']!.bind(api);
    api['listSpeakers'] = (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        window.setTimeout(() => void original(...args).then(resolve, reject), 300);
      });
  }, API_MODULE);

  // Records every removal of the gestaltete Zustand from the DOM, however brief.
  await page.evaluate(() => {
    const w = window as unknown as { __lostForbidden: number };
    w.__lostForbidden = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (
            node instanceof Element &&
            (node.matches('[data-testid="capture-forbidden"]') ||
              node.querySelector('[data-testid="capture-forbidden"]') !== null)
          ) {
            w.__lostForbidden += 1;
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });

  // podium may read neither Wortmeldungen nor Redebeiträge either: a version jump, same verdict.
  await switchActor(page, 'podium');
  await page.waitForTimeout(1000);
  await expect(page.getByTestId('capture-forbidden')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __lostForbidden: number }).__lostForbidden)).toBe(0);
});
