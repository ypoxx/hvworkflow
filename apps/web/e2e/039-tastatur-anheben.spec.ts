/**
 * takt-039 — the cause of the red 002 in the `http` project, reproduced in-process. dnd-kit's keyboard sensor announces
 * the lift synchronously but attaches its keydown listener only in a `setTimeout` (`@dnd-kit/core` 6.3.1,
 * `dist/core.esm.js:1158`). An arrow key pressed after the announcement but before that timer has run is lost without a
 * trace: no move, no "abgebrochen", the drag stays active. Here every timer of the page is late by the same second (the
 * order of timers with the same delay stays as it is), so the window is wide open; `liftWithKeyboard` must still hand
 * over a drag that answers the arrow.
 */
import { expect, test } from './support/http-guard';
import { liftWithKeyboard } from './support/keyboard-drag';
import { asRole } from './support/roles';

test.use({ viewport: { width: 1440, height: 900 } });

test('takt-039: ArrowDown right after the lift moves, even when the page runs its timers late', async ({ page }) => {
  await page.goto('/speakers');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await asRole(page, 'moderation');
  const round = page.getByTestId('speakers-round-3');
  const waiting = round.locator('[data-testid="speaker-row"][data-status="waiting"]');
  await expect(waiting.nth(1)).toBeVisible();
  const first = (await waiting.nth(0).getAttribute('data-number')) ?? '';
  const announcer = page.locator('[role="status"][aria-live="assertive"]');
  await waiting.nth(0).getByTestId('speaker-drag-handle').focus();

  // A busy page: every timer fires one second late, in the order it was set.
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) =>
      original(handler, (delay ?? 0) + 1000, ...rest)) as typeof window.setTimeout;
  });

  const lifted = await liftWithKeyboard(page, announcer, first);
  await page.keyboard.press('ArrowDown');
  await expect(announcer).not.toHaveText(lifted);
  await expect(announcer).toContainText('steht auf Position 7 von 7');
  await page.keyboard.press('Escape');
  await expect(announcer).toContainText('Verschieben abgebrochen');
});
