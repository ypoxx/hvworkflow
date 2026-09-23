/**
 * Slice 020 — Rückbau und Passung. Walks the S-Punkte of the project lead's feedback
 * (docs/feedback/2026-09-quickview-projektleitung.md #3, #9, #10, #13, #17, #21, #23, #26, #28, #32)
 * against the seeded corpus of 800 questions, one behaviour per point, plus axe on the five changed
 * views and the three empty states this slice is responsible for.
 */
import { project, seedEvents } from '@hv/domain';
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { DomainEvent } from '@hv/domain';
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

/** Confirmations belong on screen, not in the evidence: clear the stack before a screenshot. */
async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /Meldung schließen|Close the message/ });
  for (let open = await close.count(); open > 0; open = await close.count()) {
    await close.first().click();
  }
}

/** The number inside a counter cell — these mix a label and a value in one element's text. */
async function digitsOf(page: Page, testId: string): Promise<number> {
  return Number((await page.getByTestId(testId).innerText()).replace(/\D/g, ''));
}

/** The append-only event log this device persists to (`apps/web/src/api/index.ts`) — its length is
 *  the one true "did anything get written" signal, independent of what any view happens to show. */
async function eventLogLength(page: Page): Promise<number> {
  return page.evaluate(() => {
    try {
      const raw = window.localStorage.getItem('hv-demo-events-v1');
      return raw === null ? 0 : (JSON.parse(raw) as unknown[]).length;
    } catch {
      return -1;
    }
  });
}

/**
 * Minor (review round 2): `saveLog` (`src/api/index.ts:32`) debounces the write to `localStorage` by
 * 150ms after the last event, so reading `eventLogLength` right away can observe a stale count —
 * either side of the debounce window. Samples twice, 220ms apart (comfortably past the debounce),
 * and only trusts the count once it reads the same both times.
 */
async function stableEventLogLength(page: Page): Promise<number> {
  let previous = await eventLogLength(page);
  for (;;) {
    await page.waitForTimeout(220);
    const current = await eventLogLength(page);
    if (current === previous) return current;
    previous = current;
  }
}

/** The previewed question's own `status`, read directly off the projected domain state — not off
 *  whatever a view happens to render for it — so B1's "no state change" claim is not only "the
 *  counters and the current card look the same" but "this exact question truly did not move". */
async function questionStatus(page: Page, number: string): Promise<string | undefined> {
  const raw = await page.evaluate(() => window.localStorage.getItem('hv-demo-events-v1'));
  if (raw === null) return undefined;
  const events = JSON.parse(raw) as DomainEvent[];
  const state = project(events);
  for (const question of state.questions.values()) {
    if (question.number === number) return question.status;
  }
  return undefined;
}

/** The queue's own order, by number — a stable fingerprint that a delivered/returned question would
 *  disturb (it would leave the list, shifting everything behind it). */
async function queueNumbers(page: Page): Promise<string[]> {
  return page.getByTestId('stage-queue-item').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-number') ?? ''),
  );
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

/**
 * Named exception AX-020-01 (review round 1, sharpened in round 2) and the two-pass method itself
 * ((a) every rule except colour, no exclusions; (b) colour alone, scoped to named pre-existing
 * selectors) now live in one place, `apps/web/e2e/support/axe.ts` and its
 * `apps/web/e2e/support/axe-exceptions.json` (slice 013, follow-up 1 from this slice's review) — this
 * spec reads them from there instead of keeping its own copy. Slice 013 also narrowed the
 * `.mt-1.text-2xs.text-ink-500` entry, which used to also match `AnswerEditor.tsx:69`,
 * `Timeline.tsx:132` and `speakers/fields.tsx:32`, to CoverageBar's own container; see the exception's
 * `location`/`reason` fields in `axe-exceptions.json`.
 */
const assertNoSeriousViolations = checkAxe;

test.use({ viewport: { width: 1440, height: 900 } });

test('020: Rückbau und Passung — points 1–9, axe on the five views', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Point #3/#9 ("Nur Bühne" default, m2's "derive once" and its admin negative case) has its own,
  // dedicated test below — the derivation only ever runs once per mount (m2), so it needs a fresh
  // page per role to observe honestly, which does not fit this continuous walk-through. This test
  // starts from an explicit, conscious choice instead (the same override 003/abnahme use, m8) so
  // the sections below are decoupled from whichever role's derivation happened to run first.
  await asRole(page, 'podium');
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  const overlay = page.getByTestId('stage-only');
  await expect(overlay).toHaveCount(0);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();

  /* =========================================================================================
   * Point #10 — the queue is clickable (and Enter-able), opens a read-only preview, changes no
   * state, and "noch n" counts exactly the questions still to come after the current one.
   * M5 (review round 1): "noch n" is checked against the header's own staged count (an
   * independent source, not the same rendered array), and the previewed question's status is
   * checked via the queue's own fingerprint and the event log length, not only the current card.
   * ========================================================================================= */
  const currentNumber = page.getByTestId('stage-current-number');
  const currentBefore = await currentNumber.innerText();
  const deliveredBefore = await digitsOf(page, 'stage-counter-delivered');
  const openCounterBefore = await digitsOf(page, 'header-counter-open');
  const stagedCounterBefore = await digitsOf(page, 'header-counter-staged');
  const eventsBefore = await stableEventLogLength(page);
  const queueBefore = await queueNumbers(page);

  const remaining = await digitsOf(page, 'stage-queue-remaining');
  // Independent cross-check (M5): every staged question except the one currently on stage is, by
  // definition, "still to come" — this reads the header's own staged total, not the queue's own
  // rendered rows, so a bug that miscounts the same array both ways would not go unnoticed.
  expect(remaining).toBe(stagedCounterBefore - 1);
  const visibleQueueRows = await page.getByTestId('stage-queue-item').count();
  const moreEl = page.getByTestId('stage-queue-more');
  const more = (await moreEl.count()) > 0 ? Number((await moreEl.innerText()).replace(/\D/g, '')) : 0;
  // 1 (the "Als Nächstes" card) + the compact rows shown + whatever "und n weitere" still hides.
  expect(remaining).toBe(1 + visibleQueueRows + more);

  await page.getByTestId('stage-next-preview').click();
  const preview = page.getByTestId('stage-preview');
  await expect(preview).toBeVisible();
  const previewedNumber = await page.getByTestId('stage-preview-number').innerText();
  await expect(page.getByTestId('stage-preview-number')).not.toBeEmpty();
  await expect(page.getByTestId('stage-preview-text')).not.toBeEmpty();
  await expect(page.getByTestId('stage-preview-answer')).not.toBeEmpty();
  // M6: the one-line "read only" note is the dialog's own description, next to its title.
  await expect(page.getByRole('dialog', { name: 'Vorschau' })).toContainText('Nur ansehen');
  const previewedStatusBefore = await questionStatus(page, previewedNumber);
  expect(previewedStatusBefore).toBeDefined();

  /* =========================================================================================
   * B1 (review round 1, blocker) — the preview is a dialog and must own the keyboard exactly like
   * the return dialog already does: clicking inside it, then Space and R, must neither deliver the
   * current question nor open the return dialog underneath it.
   * ========================================================================================= */
  await page.getByTestId('stage-preview-text').click();
  await page.keyboard.press('Space');
  await page.keyboard.press('r');
  await expect(preview).toBeVisible(); // still open — neither key was swallowed by it closing
  await expect(page.getByTestId('stage-return-reason')).toHaveCount(0); // no return dialog opened
  await expect(currentNumber).toHaveText(currentBefore);
  expect(await digitsOf(page, 'stage-counter-delivered')).toBe(deliveredBefore);
  expect(await stableEventLogLength(page)).toBe(eventsBefore);
  // Minor (review round 2): not only "the counters look the same" — the previewed question's own
  // `status`, read directly off the projected event log, truly did not move either.
  expect(await questionStatus(page, previewedNumber)).toBe(previewedStatusBefore);

  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  // No state change whatsoever from the preview itself either: same current question, same
  // counters, same queue fingerprint, same "noch n", not one extra event on the log.
  await expect(currentNumber).toHaveText(currentBefore);
  expect(await digitsOf(page, 'stage-counter-delivered')).toBe(deliveredBefore);
  expect(await digitsOf(page, 'stage-queue-remaining')).toBe(remaining);
  expect(await digitsOf(page, 'header-counter-open')).toBe(openCounterBefore);
  expect(await digitsOf(page, 'header-counter-staged')).toBe(stagedCounterBefore);
  expect(await queueNumbers(page)).toEqual(queueBefore);
  expect(await questionStatus(page, previewedNumber)).toBe(previewedStatusBefore);
  expect(await stableEventLogLength(page)).toBe(eventsBefore);

  // The keyboard path: a compact row also opens the preview on Enter, unchanged in every way.
  // D8 (documented in the Bericht): closing with Escape returns focus to the row that opened it,
  // so the immediately following Space re-opens the same preview rather than delivering anything.
  if (visibleQueueRows > 0) {
    // The `<li>` itself is not focusable — the `<button>` filling it is (Podium.tsx's `QueueItem`).
    const row = page.getByTestId('stage-queue-item').first().locator('button');
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(preview).toBeVisible();
    await expect(currentNumber).toHaveText(currentBefore);
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
    await expect(row).toBeFocused();
    await page.keyboard.press('Space');
    await expect(preview).toBeVisible();
    expect(await digitsOf(page, 'stage-counter-delivered')).toBe(deliveredBefore);
    await page.keyboard.press('Escape');
    await expect(preview).toBeHidden();
  }

  // Reopen for the evidence shot: the required screenshot shows the preview open (point #10).
  await page.getByTestId('stage-next-preview').click();
  await expect(preview).toBeVisible();
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-stage-de.png') });
  await assertNoSeriousViolations(page, 'stage (podium, with preview)');
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  /* =========================================================================================
   * Point #13 — the clock: HH:MM only, small and muted, no more than one repaint a minute.
   * ========================================================================================= */
  const clock = page.getByTestId('clock-time');
  await expect(clock).toBeVisible();
  await expect(clock).toHaveText(/^\d{2}:\d{2}$/);
  const clockStyle = await clock.evaluate((el) => ({
    fontSize: getComputedStyle(el).fontSize,
    color: getComputedStyle(el).color,
    fontWeight: getComputedStyle(el).fontWeight,
  }));
  console.log(`[020] clock: font-size=${clockStyle.fontSize} weight=${clockStyle.fontWeight} color=${clockStyle.color}`);
  expect(Number.parseFloat(clockStyle.fontSize)).toBeLessThanOrEqual(12);
  expect(Number.parseFloat(clockStyle.fontWeight)).toBeLessThanOrEqual(500);
  // m7 (review round 1): "höchstens einmal je Minute" itself is proven deterministically, with a
  // mocked clock, in the dedicated test below — a 2.5s real-time sample here flaked at a minute
  // boundary in CI (PR #13).

  /* =========================================================================================
   * Point #17 — the Wortmeldeliste's drag handle is visible without hovering it, and the "drag to
   * reorder" hint sits in every round's own head, not only once above the whole list.
   * ========================================================================================= */
  await asRole(page, 'moderation');
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);

  const round = page.getByTestId('speakers-round-3');
  await expect(round).toBeVisible();
  const handle = round.getByTestId('speaker-drag-handle').first();
  await expect(handle).toBeVisible(); // never hovered — this is the resting state
  const handleStyle = await handle.evaluate((el) => getComputedStyle(el).cursor);
  expect(handleStyle).toBe('grab');
  await expect(page.getByTestId('round-drag-hint-3')).toBeVisible();
  await expect(page.getByTestId('round-drag-hint-3')).toContainText('Griff');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-speakers-de.png') });
  await page.locator('header[role="banner"]').screenshot({ path: evidence('020-header-de.png') });
  await assertNoSeriousViolations(page, 'speakers (moderation)');

  /* =========================================================================================
   * Point #26 (Wortmeldeliste) — a role without any speaker write right sees a read-only hint
   * instead of a page that silently offers no buttons at all.
   * ========================================================================================= */
  await asRole(page, 'expert'); // no speaker.* permission in this role's bundle
  await expect(page.getByTestId('speakers-readonly-hint')).toBeVisible();
  await expect(page.getByTestId('speakers-readonly-hint')).toHaveText('In dieser Rolle nur lesen');
  await expect(page.getByTestId('speaker-drag-handle').first()).toHaveCount(0);

  /* =========================================================================================
   * Point #21/#23 — the capture card shows number, wording and status only; classification lives
   * behind the explicit "Klassifizieren" dialog, reachable only with the right, and the
   * Tagesordnungspunkt is not asked anywhere in this desk any more.
   * ========================================================================================= */
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  const firstCard = page.getByTestId('capture-question-card').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard).not.toContainText('Pfad');
  await expect(firstCard).not.toContainText('TOP');
  await expect(page.getByTestId('classify-agenda')).toHaveCount(0);

  const openClassify = firstCard.getByTestId('capture-classify-open');
  await expect(openClassify).toBeVisible();
  await openClassify.click();
  const classifyDialog = page.getByRole('dialog', { name: 'Klassifizieren' });
  await expect(classifyDialog).toBeVisible();
  await expect(page.getByTestId('classify-track-expert_track')).toBeVisible();
  await expect(page.getByTestId('classify-stage')).toBeVisible();
  // Point #23: the dialog that classifies never asks for a Tagesordnungspunkt either.
  await expect(page.getByTestId('classify-agenda')).toHaveCount(0);
  await expect(classifyDialog).not.toContainText('Tagesordnungspunkt');
  await page.keyboard.press('Escape');
  await expect(classifyDialog).toBeHidden();

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-capture-de.png') });
  await assertNoSeriousViolations(page, 'capture (capture desk)');

  /* =========================================================================================
   * M1 (review round 1) — re-classifying a question that already carries a Tagesordnungspunkt
   * must not erase it, even though this dialog never edits TOP (point #23); Save stays disabled
   * until something actually changes.
   * ========================================================================================= */
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-classified').click();
  await expect(page.getByTestId('answers-row').first()).toHaveAttribute('data-status', 'classified');
  await page.getByTestId('answers-row').first().click();
  const topNumber = await page.getByTestId('answers-detail-number').innerText();
  const contributionHref = await page.getByTestId('answers-detail-contribution').getAttribute('href');
  expect(contributionHref).not.toBeNull();

  const topEventText = async (): Promise<string | undefined> => {
    await page.getByTestId('nav-history').click();
    await expect(page).toHaveURL(/\/history$/);
    await page.getByTestId('history-search').fill(topNumber);
    await page.getByTestId('history-result').filter({ hasText: topNumber }).first().click();
    const classified = page
      .getByTestId('history-timeline')
      .locator('[data-testid="history-event"][data-type="QuestionClassified"]')
      .last();
    await expect(classified).toBeVisible();
    return (await classified.innerText()).match(/Tagesordnungspunkt \d+/)?.[0];
  };
  const originalTop = await topEventText();
  expect(originalTop).toBeDefined(); // the seeder always sets one on classify

  await page.goto(contributionHref!);
  await waitForCorpus(page);
  await expect(page).toHaveURL(/\/capture\?speaker=/);
  let topCard = page.locator(`[data-testid="capture-question-card"][data-number="${topNumber}"]`);
  // The desk shows one Redebeitrag at a time; try every one of this Wortmeldung's contributions
  // until the target question turns up.
  const contributionSelect = page.getByTestId('capture-contribution-select');
  if ((await topCard.count()) === 0 && (await contributionSelect.count()) > 0) {
    const optionCount = await contributionSelect.locator('option').count();
    for (let i = 0; i < optionCount && (await topCard.count()) === 0; i++) {
      await contributionSelect.selectOption({ index: i });
    }
  }
  await expect(topCard).toBeVisible();
  await topCard.getByTestId('capture-classify-open').click();
  const reclassifyDialog = page.getByRole('dialog', { name: 'Klassifizieren' });
  await expect(reclassifyDialog).toBeVisible();
  await expect(page.getByTestId('classify-save')).toBeDisabled(); // no change yet (M1)

  const podiumPressed = await page.getByTestId('classify-track-podium').getAttribute('aria-pressed');
  const otherTrack = podiumPressed === 'true' ? 'expert_track' : 'podium';
  await page.getByTestId(`classify-track-${otherTrack}`).click();
  await expect(page.getByTestId('classify-save')).toBeEnabled();
  await page.getByTestId('classify-save').click();
  await expect(reclassifyDialog).toBeHidden();

  const newTop = await topEventText();
  expect(newTop).toBe(originalTop); // M1: the TOP survived the re-classification

  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  /* =========================================================================================
   * Point #21 (continued) + #26 (Erfassung) — without `question.classify` the action is simply
   * absent (never disabled), and a role without any capture right sees the same read-only hint.
   * ========================================================================================= */
  await asRole(page, 'expert'); // no question.classify, no question.capture / contribution.capture
  await expect(page.getByTestId('capture-classify-open')).toHaveCount(0);
  await expect(page.getByTestId('capture-readonly-hint')).toBeVisible();
  await expect(page.getByTestId('capture-readonly-hint')).toHaveText('In dieser Rolle nur lesen');

  /* =========================================================================================
   * Point #26 (Beantwortung) + #10 (leerer Zustand: Filter ohne Treffer) + #28 + #32.
   * ========================================================================================= */
  await asRole(page, 'observer'); // question.read only: no editing action on any question
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  // m3 (review round 1): the hint is suppressed for a question at rest (delivered/terminal) — the
  // default row is any status, so pick a deliberately non-terminal one for this check.
  await page.getByTestId('answers-filter-status-assigned').click();
  await expect(page.getByTestId('answers-row').first()).toHaveAttribute('data-status', 'assigned');
  await page.getByTestId('answers-row').first().click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answers-readonly-hint')).toBeVisible();
  await expect(page.getByTestId('answers-readonly-hint')).toHaveText('In dieser Rolle nur lesen');

  // m3: a question at rest explains itself through the status badge, with no hint underneath.
  await page.getByTestId('answers-filter-status-closed').click();
  await expect(page.getByTestId('answers-row').first()).toHaveAttribute('data-status', 'closed');
  await page.getByTestId('answers-row').first().click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answers-readonly-hint')).toHaveCount(0);

  // Leerer Zustand: a search text that matches nothing in an 800-question corpus.
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-search').fill('kein-treffer-020-rueckbau');
  await expect(page.getByText('Kein Treffer')).toBeVisible();
  await page.getByTestId('answers-search').fill('');
  await expect(page.getByTestId('answers-row').first()).toBeVisible();

  await asRole(page, 'expert');
  await page.getByTestId('answers-filter-status-answer_drafted').click();
  await expect(page.getByTestId('answers-row').first()).toHaveAttribute('data-status', 'answer_drafted');
  await page.getByTestId('answers-row').first().click();
  const detail = page.getByTestId('answers-detail');
  await expect(detail).toBeVisible();

  // Point #28: neither Tagesordnungspunkt nor Erfassungszeit are shown here any more.
  await expect(detail).not.toContainText('Tagesordnungspunkt');
  await expect(detail).not.toContainText('Erfasst');

  // Point #32: the action is labelled "Weiterleiten", the operation underneath is unchanged.
  const submitReview = page.getByTestId('answer-submit-review');
  await expect(submitReview).toBeVisible();
  await expect(submitReview).toHaveText('Weiterleiten');

  const forwardedNumber = await page.getByTestId('answers-detail-number').innerText();

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-answers-de.png') });
  await assertNoSeriousViolations(page, 'answers (expert, answer_drafted question)');

  await submitReview.click();
  await expect(detail).toContainText('im Legal Clearing');

  // The history shows the same event under the same, house-vocabulary label (E5: display only).
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await page.getByTestId('history-search').fill(forwardedNumber);
  await page.getByTestId('history-result').filter({ hasText: forwardedNumber }).first().click();
  const timeline = page.getByTestId('history-timeline');
  await expect(timeline).toBeVisible();
  await expect(
    timeline.locator('[data-testid="history-event"][data-type="QuestionSubmittedForReview"]'),
  ).toContainText('Weitergeleitet');

  /* =========================================================================================
   * en-US pass: the same five views, in English — a language switch changes every visible
   * string, header included (already proven end to end in 001-shell.spec.ts); here it is enough
   * to prove the slice's own new and changed strings follow.
   * ========================================================================================= */
  await page.getByTestId('lang-toggle').click();
  await page.getByTestId('lang-option-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Back to the answers desk for a fresh `answer_drafted` question — the one used above has
  // already moved on to "im Legal Clearing" / "in legal clearing".
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-answer_drafted').click();
  await expect(page.getByTestId('answers-row').first()).toHaveAttribute(
    'data-status',
    'answer_drafted',
  );
  await page.getByTestId('answers-row').first().click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answer-submit-review')).toHaveText('Forward');
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-answers-en.png') });

  await asRole(page, 'moderation');
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);
  await expect(page.getByTestId('clock-time')).toHaveText(/^\d{2}:\d{2}$/);
  await expect(page.getByTestId(`round-drag-hint-3`)).toContainText('handle');
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-speakers-en.png') });
  await page.locator('header[role="banner"]').screenshot({ path: evidence('020-header-en.png') });

  await asRole(page, 'expert');
  await expect(page.getByTestId('speakers-readonly-hint')).toHaveText('Read only in this role');

  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByTestId('capture-classify-open')).toHaveCount(0);
  await expect(page.getByTestId('capture-readonly-hint')).toHaveText('Read only in this role');

  await asRole(page, 'capture');
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-capture-en.png') });

  await asRole(page, 'podium');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-only')).toHaveCount(0); // the earlier, conscious choice held
  await page.getByTestId('stage-next-preview').click();
  await expect(page.getByTestId('stage-preview')).toBeVisible();
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-stage-en.png') });
});

/**
 * Point #3/#9 + m2 (review round 1) — "Nur Bühne" is derived from the actor's rights exactly once
 * per mount, never from a role name. Each role below therefore gets its own fresh page: within one
 * mount, only the first role's derivation runs (m2, "derive once"), so a second role switch in the
 * same session would just inherit whatever the first one decided — not what any of these three
 * checks are about.
 */
test('020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Deliver, return, close, read only: derives "Nur Bühne".
  await asRole(page, 'podium');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();
  await expect(page.getByTestId('stage-only')).toBeVisible();
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-stage-nur-buehne-default-de.png') });

  // m2's negative case: admin has `question.deliver` too, but also every drafting/classifying/
  // capturing/approving action — the probe question (any status) reveals `question.capture`,
  // which is enough on its own to keep the ordinary layout. A fresh navigation (not just a role
  // switch, m2 "derive once") is needed to see this role's own derivation — but not to `/stage`
  // itself, whose "Nur Bühne" overlay from the previous section would otherwise cover the very
  // role switcher this needs next.
  await page.goto('/speakers');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();
  await expect(page.getByTestId('stage-only')).toHaveCount(0);

  // A role with drafting rights and no `question.deliver` at all never gets the default either.
  await page.goto('/speakers');
  await waitForCorpus(page);
  await asRole(page, 'expert');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();
  await expect(page.getByTestId('stage-only')).toHaveCount(0);
});

/**
 * m7 (review round 1) — the clock's "at most once a minute" is deterministic here (`page.clock`),
 * not a real-time sample: it flaked in CI exactly at a minute boundary (PR #13). Its own, small
 * test, so a mocked clock never touches the corpus-seeding/preview/dialog timers of the main test.
 */
test('020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel', async ({
  page,
}) => {
  // 08:15:30 UTC = 10:15:30 Europe/Berlin in September (CEST, UTC+2) — the clock reads the hall's
  // wall clock (Clock.tsx's own `timeZone: 'Europe/Berlin'`), not this test runner's local time.
  await page.clock.install({ time: new Date('2026-09-23T08:15:30.000Z') });
  await page.goto('/');
  await waitForCorpus(page);

  const clock = page.getByTestId('clock-time');
  const initial = await clock.innerText();
  expect(initial).toBe('10:15');

  // Jump to a moment still well inside the same minute (10:15:50) — margin on both sides of the
  // fake clock's own rounding, deliberately away from the exact boundary.
  await page.clock.pauseAt(new Date('2026-09-23T08:15:50.000Z'));
  await expect(clock).toHaveText(initial);

  // Jump past the minute change to 10:16:20 — one repaint, aligned to the minute, and no more.
  await page.clock.pauseAt(new Date('2026-09-23T08:16:20.000Z'));
  await expect(clock).toHaveText('10:16');
});

/* ===============================================================================================
 * A second, small session with a freshly crafted, genuinely empty meeting (`seedEvents` with
 * `questions: 0` — same seeder the demo itself uses, just parameterised down to zero individual
 * questions; ~118 Wortmeldungen are registered, nothing is ever captured). No 800-question corpus
 * to wait on, no hundred already-staged questions to drain: this is the direct, honest way to reach
 * "Erfassung ohne Redebeitrag" and "Bühne ohne Warteschlange" without touching the shared corpus
 * (design-prinzipien.md #6, "gestalteter Leerzustand").
 * ============================================================================================= */
const EMPTY_MEETING_LOG = JSON.stringify(
  seedEvents({
    questions: 0,
    seed: 20,
    now: new Date('2026-09-23T12:00:00.000Z'),
    actor: { id: 'u-admin', role: 'admin' },
  }).map((event, index) => ({ ...event, seq: index + 1 })),
);

test('020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange', async ({
  page,
}) => {
  await page.addInitScript((json: string) => {
    try {
      window.localStorage.setItem('hv-demo-events-v1', json);
    } catch {
      /* the app then simply seeds its own 800-question corpus instead */
    }
  }, EMPTY_MEETING_LOG);
  await page.goto('/');

  // No 90s wait here: the meeting is already seeded (with zero questions), so the boot screen's
  // own seed-if-empty check finds work already done and skips straight to the speakers list.
  await expect
    .poll(
      async () =>
        Number(
          (await page.getByTestId('header-counter-questions').innerText()).replace(/\D/g, ''),
        ),
      { timeout: 15_000 },
    )
    .toBe(0);

  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByText('Noch kein Redebeitrag erfasst')).toBeVisible();
  // M3 (review round 1): an empty desk has no question to read `_actions` off, so the read-only
  // hint must stay silent rather than default to "no right" for every role, capture included.
  await expect(page.getByTestId('capture-readonly-hint')).toHaveCount(0);
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-capture-empty-de.png') });
  await assertNoSeriousViolations(page, 'capture (leerer Zustand)');

  await asRole(page, 'podium');
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByText('Die Bühne ist frei')).toBeVisible();
  await expect(page.getByTestId('stage-queue-item')).toHaveCount(0);
  await expect(page.getByTestId('stage-next-preview')).toHaveCount(0);
  await expect(page.getByText('Danach liegt nichts mehr auf der Bühne.')).toBeVisible();
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('020-stage-empty-de.png') });
  await assertNoSeriousViolations(page, 'stage (leerer Zustand)');
});
