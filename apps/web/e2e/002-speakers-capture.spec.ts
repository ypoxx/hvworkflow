/**
 * Slice 002 — Wortmeldeliste and Erfassung. Walks the acceptance criterion of
 * docs/slices/002-speakers-and-capture.md with the seeded corpus: reorder two Wortmeldungen with
 * the keyboard, call the next speaker, capture their Redebeitrag, atomise it into seven
 * Einzelfragen (selection, `Alt+Q`, batch by sentence), watch the Restabdeckung rise, and classify
 * one question into the Expert Track.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const SEEDED_QUESTIONS = 800;

/** A synthetic speech with exactly seven questions of record. */
const QUESTIONS = [
  'Wie hoch war der Investitionsaufwand im abgelaufenen Geschäftsjahr?',
  'Welche Rückstellungen hat die Gesellschaft für die anhängigen Verfahren gebildet?',
  'Wie entwickelt sich die Eigenkapitalquote im laufenden Geschäftsjahr?',
  'Welche Maßnahmen ergreift der Vorstand gegen den Rückgang der operativen Marge?',
  'Wann rechnet die Gesellschaft mit einer Entscheidung der Kartellbehörde?',
  'Wie viele Stellen sind im Zuge des Sparprogramms bereits entfallen?',
  'Welche Dividende schlägt der Vorstand für das kommende Geschäftsjahr vor?',
];
const SPEECH = [
  'Sehr geehrte Damen und Herren, ich danke dem Vorstand für den Bericht zur Lage der Gesellschaft.',
  ...QUESTIONS,
  'Ich danke Ihnen für die Beantwortung.',
].join(' ');

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
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);

  // The meeting office is the desk that owns the Wortmeldeliste.
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-moderation').click();
  await expect(page.getByTestId('role-switcher')).toContainText('Versammlungsbüro');

  const round = page.getByTestId('speakers-round-3');
  await expect(round).toBeVisible();
  const waiting = round.locator('[data-testid="speaker-row"][data-status="waiting"]');
  await expect(waiting.first()).toBeVisible();

  const firstBefore = (await waiting.nth(0).getAttribute('data-number')) ?? '';
  const secondBefore = (await waiting.nth(1).getAttribute('data-number')) ?? '';
  expect(firstBefore).not.toEqual(secondBefore);

  // Reordering with the keyboard: lift, move one down, drop (dnd-kit keyboard sensor). The steps
  // wait on the announcement, which is the same signal a screen reader gets.
  const announcer = page.locator('[role="status"][aria-live="assertive"]');
  await waiting.nth(0).getByTestId('speaker-drag-handle').focus();
  await page.keyboard.press('Space');
  await expect(announcer).toContainText(`Wortmeldung ${firstBefore}`);
  const lifted = await announcer.innerText();
  await page.keyboard.press('ArrowDown');
  await expect(announcer).not.toHaveText(lifted);
  await page.keyboard.press('Space');
  await expect(announcer).toContainText('abgelegt');

  await expect(waiting.nth(0)).toHaveAttribute('data-number', secondBefore);
  await expect(waiting.nth(1)).toHaveAttribute('data-number', firstBefore);

  // Calling the next speaker ends the running speech and opens the microphone for this one.
  const called = (await waiting.nth(0).getAttribute('data-number')) ?? '';
  await waiting.nth(0).getByTestId('speaker-call').click();
  await expect(
    round.locator('[data-testid="speaker-row"][data-status="speaking"]'),
  ).toHaveAttribute('data-number', called);
  await expect(round.locator('[data-testid="speaker-row"][data-status="speaking"]')).toHaveCount(1);

  // Slice 006: the time-budget ring next to "Am Mikrofon"'s mm:ss timer, and the round's own
  // finished/total progress next to its header.
  const timerRing = page.getByTestId('speaker-timer-ring');
  await expect(timerRing).toBeVisible();
  await expect(timerRing).toHaveAttribute('aria-valuenow', /^\d+$/);
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
  await page.getByTestId('speaker-register-name').fill('Henrike Baumgart');
  await page.getByTestId('speaker-register-submit').click();
  await expect(round.getByText('Henrike Baumgart')).toBeVisible();

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('002-speakers.png') });
  await page.screenshot({ path: evidence('006-speakers.png') });

  /* ---- the capture desk ---- */
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-capture').click();
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  // Whoever is at the microphone is preselected — the Wortmeldung that was just called.
  const selected = await page.getByTestId('capture-speaker-select').evaluate((node) => {
    const select = node as HTMLSelectElement;
    return select.options[select.selectedIndex]?.text ?? '';
  });
  expect(selected).toContain(`Nr. ${called}`);

  await page.getByTestId('capture-text').fill(SPEECH);
  await page.getByTestId('capture-submit').click();

  const text = page.getByTestId('capture-contribution-text');
  await expect(text).toBeVisible();
  await expect(text).toContainText('Sehr geehrte Damen und Herren');
  expect(await coverageOf(page)).toBe(0);

  // One question by marking the passage and pressing the floating action …
  await markPassage(page, QUESTIONS[0]!);
  await page.getByTestId('capture-add-selection').click();
  await expect(page.getByTestId('capture-question-card')).toHaveCount(1);
  const afterFirst = await coverageOf(page);
  expect(afterFirst).toBeGreaterThan(0);

  // … one with the keyboard shortcut …
  await markPassage(page, QUESTIONS[1]!);
  await page.keyboard.press('Alt+q');
  await expect(page.getByTestId('capture-question-card')).toHaveCount(2);

  // … and the remaining five in one call through the batch proposal.
  await page.getByTestId('capture-suggest').click();
  await expect(page.getByTestId('capture-suggest-item')).toHaveCount(5);
  await page.getByTestId('capture-suggest-add').click();
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
    .fill('Wie viele Stimmrechte waren bei Abstimmung vertreten?');
  await page.getByTestId('capture-free-add').click();
  await expect(page.getByTestId('capture-question-card')).toHaveCount(8);

  // Classification: Pfad C, Expert Track.
  const card = page.getByTestId('capture-question-card').first();
  await card.getByTestId('classify-track-expert_track').click();
  await card.getByTestId('classify-agenda').selectOption({ index: 1 });
  await card.getByTestId('classify-stage').selectOption('cfo');
  await card.getByTestId('classify-save').click();

  await expect(card).toContainText('Pfad C');
  await expect(card).toContainText('klassifiziert');

  // Slice 006: nothing jumps under the desk's cursor — the card that was open while still
  // `captured` stays open now that it is `classified` (design principle 8).
  await expect(card.getByTestId('classify-save')).toBeVisible();

  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('002-capture.png') });
  await page.screenshot({ path: evidence('006-capture.png') });

  // A fresh mount of that same, now-classified question starts collapsed to a summary line
  // instead — leaving the desk unmounts and remounts this route, the same way switching between
  // "Wortmeldungen" and "Erfassung" does all afternoon.
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  const remounted = page.getByTestId('capture-question-card').first();
  await expect(remounted).toContainText('klassifiziert');
  await expect(remounted.getByTestId('classify-track-expert_track')).toBeHidden();
  const toggle = remounted.getByTestId('card-classification-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(remounted.getByTestId('classify-track-expert_track')).toBeVisible();
});
