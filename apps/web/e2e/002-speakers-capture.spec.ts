/**
 * Slice 002 — Wortmeldeliste and Erfassung. Walks the acceptance criterion of
 * docs/slices/002-speakers-and-capture.md with the seeded corpus: reorder two Wortmeldungen with
 * the keyboard, call the next speaker, capture their Redebeitrag, atomise it into seven
 * Einzelfragen (selection, `Alt+Q`, batch by sentence), watch the Restabdeckung rise, and classify
 * one question into the Expert Track.
 */
import { CORPUS_DEMO } from '@hv/domain';
import { checkAxe } from './support/axe';
import {
  SPEECH_CLOSING, SPEECH_OPENING, SPEECH_QUESTIONS, SPEAKER_002_FREE_QUESTION, SPEAKER_002_NAME,
} from './support/e2e-texts';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { liftWithKeyboard } from './support/keyboard-drag';
import { asRole, expectNotBusy, expectRoleLabel } from './support/roles';
import type { Page } from '@playwright/test';

/** A synthetic speech with exactly seven questions of record (texts in `support/e2e-texts.ts`, checked against the access log). */
const SPEECH = [SPEECH_OPENING, ...SPEECH_QUESTIONS, SPEECH_CLOSING].join(' ');

/** Mark a passage of the Redebeitrag the way a person would with the mouse. */
async function markPassage(page: Page, passage: string): Promise<void> {
  await page.evaluate((needle) => {
    const container = document.querySelector('[data-testid="capture-contribution-text"]');
    if (container === null) throw new Error('the contribution text is not on the page');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const index = (node.nodeValue ?? '').indexOf(needle);
      if (index < 0) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    throw new Error(`passage not found: ${needle}`);
  }, passage);
  await expect(page.getByTestId('capture-add-selection')).toBeVisible();
}

/** The capture pane marks itself busy while a write of questions runs (takt-032); cards and coverage land with its end. */
const capturePane = (page: Page) => page.getByTestId('capture-contribution-pane');

const coverageOf = async (page: Page): Promise<number> =>
  Number((await page.getByTestId('capture-coverage').innerText()).replace(/\D/g, ''));

test.use({ viewport: { width: 1440, height: 900 } });

test('speakers list and capture desk @screenshot', async ({ page }) => {
  await page.goto('/speakers');

  // The corpus is seeded on first start; the counter is the proof that it is there.
  const counter = page.getByTestId('header-counter-questions');
  await expect(counter).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await counter.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);

  // The meeting office is the desk that owns the Wortmeldeliste.
  await asRole(page, 'moderation');
  await expectRoleLabel(page, 'moderation', 'de');

  const round = page.getByTestId('speakers-round-3');
  await expect(round).toBeVisible();
  const waiting = round.locator('[data-testid="speaker-row"][data-status="waiting"]');
  await expect(waiting.first()).toBeVisible();
  await checkAxe(page, 'speakers (moderation, Wortmeldeliste)');

  const firstBefore = (await waiting.nth(0).getAttribute('data-number')) ?? '';
  const secondBefore = (await waiting.nth(1).getAttribute('data-number')) ?? '';
  expect(firstBefore).not.toEqual(secondBefore);

  // Reordering with the keyboard: lift, move one down, drop (dnd-kit keyboard sensor). The steps
  // wait on the announcement, which is the same signal a screen reader gets; the lift hands over
  // only once the sensor listens for the arrow keys (takt-039, `support/keyboard-drag.ts`).
  const announcer = page.locator('[role="status"][aria-live="assertive"]');
  await waiting.nth(0).getByTestId('speaker-drag-handle').focus();
  const lifted = await liftWithKeyboard(page, announcer, firstBefore);
  await page.keyboard.press('ArrowDown');
  await expect(announcer).not.toHaveText(lifted);
  // A reorder raises the version of every Wortmeldung of the round. The round is locked while it is written (takt-032:
  // `data-busy` on `speakers-round-N`); the next step waits for the lock to end. In `in-process` that passes at once.
  await page.keyboard.press('Space');
  await expect(announcer).toContainText('abgelegt');
  await expectNotBusy(round);

  await expect(waiting.nth(0)).toHaveAttribute('data-number', secondBefore);
  await expect(waiting.nth(1)).toHaveAttribute('data-number', firstBefore);

  // Calling the next speaker ends the running speech and opens the microphone for this one.
  const called = (await waiting.nth(0).getAttribute('data-number')) ?? '';
  await waiting.nth(0).getByTestId('speaker-call').click();
  await expect(
    round.locator('[data-testid="speaker-row"][data-status="speaking"]'),
  ).toHaveAttribute('data-number', called);
  await expect(round.locator('[data-testid="speaker-row"][data-status="speaking"]')).toHaveCount(1);

  // Slice 080 removed the speaking-time ring (feedback #15); the round's own finished/total
  // progress next to its header stays.
  await expect(page.getByTestId('speaker-timer-ring')).toHaveCount(0);
  await expect(round.getByTestId('round-progress-3')).toBeVisible();

  // R6 (006 rework, architect finding 1): the identity column must win real width instead of
  // leftover space, or a name like "Vera Rehberg" is cut off behind the ring/timer/Fragen/action
  // blocks that follow it — scrollWidth > clientWidth is exactly what that truncation looks like.
  const nowName = page.getByTestId('speaker-now-name');
  await expect(nowName).toBeVisible();
  const nameMetrics = await nowName.evaluate((el) => ({
    text: el.textContent,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  console.log(
    `[006 rework] "Am Mikrofon" name "${nameMetrics.text}": scrollWidth=${nameMetrics.scrollWidth} clientWidth=${nameMetrics.clientWidth}`,
  );
  expect(nameMetrics.scrollWidth).toBeLessThanOrEqual(nameMetrics.clientWidth);

  // A Wortmeldung that comes in while the meeting runs.
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill(SPEAKER_002_NAME);
  await checkAxe(page, 'speakers (Wortmeldung registrieren, dialog open)');
  await page.getByTestId('speaker-register-submit').click();
  await expect(round.getByText(SPEAKER_002_NAME)).toBeVisible();

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('002-speakers.png') });
  await page.screenshot({ path: evidence('006-speakers.png') });

  /* ---- the capture desk ---- */
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  // Whoever is at the microphone is preselected — the Wortmeldung that was just called.
  // The list of Wortmeldungen arrives from the service in `http`; the select shows the chosen one once it has.
  const selectedText = () => page.getByTestId('capture-speaker-select').evaluate((node) => {
    const select = node as HTMLSelectElement;
    return select.options[select.selectedIndex]?.text ?? '';
  });
  await expect.poll(selectedText).toContain(`Nr. ${called}`);
  await checkAxe(page, 'capture (Erfassung, kein Redebeitrag erfasst)');

  await page.getByTestId('capture-text').fill(SPEECH);
  await page.getByTestId('capture-submit').click();

  const text = page.getByTestId('capture-contribution-text');
  await expect(text).toBeVisible();
  await expect(text).toContainText('Sehr geehrte Damen und Herren');
  expect(await coverageOf(page)).toBe(0);

  // One question by marking the passage and pressing the floating action …
  await markPassage(page, SPEECH_QUESTIONS[0]!);
  await page.getByTestId('capture-add-selection').click();
  await expectNotBusy(capturePane(page));

  await expect(page.getByTestId('capture-question-card')).toHaveCount(1);
  const afterFirst = await coverageOf(page);
  expect(afterFirst).toBeGreaterThan(0);

  // … one with the keyboard shortcut …
  await markPassage(page, SPEECH_QUESTIONS[1]!);
  await page.keyboard.press('Alt+q');
  await expectNotBusy(capturePane(page));

  await expect(page.getByTestId('capture-question-card')).toHaveCount(2);

  // … and the remaining five in one call through the batch proposal.
  await page.getByTestId('capture-suggest').click();
  await expect(page.getByTestId('capture-suggest-item')).toHaveCount(5);
  await checkAxe(page, 'capture (Vorschlagsdialog offen)');
  await page.getByTestId('capture-suggest-add').click();
  await expectNotBusy(capturePane(page));

  await expect(page.getByTestId('capture-question-card')).toHaveCount(7);

  // Slice 006: every one of the seven spans just captured carries its own numbered marker in the
  // Redebeitrag, so the marker count matches the card count exactly.
  await expect(page.locator('[data-testid^="capture-marker-"]')).toHaveCount(7);

  // Everything but the greeting and the closing sentence is now covered.
  const afterAll = await coverageOf(page);
  expect(afterAll).toBeGreaterThan(afterFirst);
  expect(afterAll).toBeGreaterThan(70);

  // A question without a marked passage still belongs to this Redebeitrag.
  await page
    .getByTestId('capture-free-input')
    .fill(SPEAKER_002_FREE_QUESTION);
  await page.getByTestId('capture-free-add').click();
  await expectNotBusy(capturePane(page));

  await expect(page.getByTestId('capture-question-card')).toHaveCount(8);

  // Classification (point #21, slice 020): reached only through the explicit "Klassifizieren"
  // action, in a dialog — the card itself carries no track, agenda or stage field any more.
  // Slice 021b: classifying is the Koordination's right now, so the desk changes hands for this step.
  await asRole(page, 'coordination');
  await expect(page.getByTestId('capture-question-card')).toHaveCount(8);
  const card = page.getByTestId('capture-question-card').first();
  await card.getByTestId('capture-classify-open').click();
  await page.getByTestId('classify-track-expert_track').click();
  await page.getByTestId('classify-stage').selectOption('cfo');
  await checkAxe(page, 'capture (Klassifizieren-Dialog offen)');
  await page.getByTestId('classify-save').click();
  await expect(page.getByTestId('classify-save')).toBeHidden();

  await expect(card).toContainText('klassifiziert');
  await expect(card).not.toContainText('Pfad C');

  await page.evaluate(() => document.fonts.ready);
  await checkAxe(page, 'capture (Erfassungskarte klassifiziert)');
  await page.screenshot({ path: evidence('002-capture.png') });
  await page.screenshot({ path: evidence('006-capture.png') });

  // A fresh mount of that same, now-classified question still shows only number, wording and
  // status — leaving the desk unmounts and remounts this route, the same way switching between
  // "Wortmeldungen" and "Erfassung" does all afternoon. "Klassifizieren" is still reachable
  // (re-classifying is allowed up to `assigned`) and reopens with the earlier choice in place.
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  const remounted = page.getByTestId('capture-question-card').first();
  await expect(remounted).toContainText('klassifiziert');
  await remounted.getByTestId('capture-classify-open').click();
  await expect(page.getByTestId('classify-track-expert_track')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await checkAxe(page, 'capture (Klassifizieren-Dialog erneut geöffnet)');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('classify-save')).toBeHidden();
});
