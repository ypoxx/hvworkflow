/**
 * takt-039 (cause of the red 002 in `http`): lifting a row with the space bar in a dnd-kit list, then handing over only
 * once the drag answers the arrow keys.
 *
 * dnd-kit's keyboard sensor starts the drag — and with it the lift announcement — synchronously, but adds its keydown
 * listener only in `setTimeout(() => this.listeners.add('keydown', …))` (`@dnd-kit/core` 6.3.1, `dist/core.esm.js:1158`).
 * An arrow key pressed after the announcement and before that timer has run is lost without a trace (no move, no
 * "abgebrochen"), which is what 002 showed on a cold, busy CI page. The wait below is not a wait on time: once the
 * announcement is visible, the sensor's timer is already set, and a timer set afterwards with the same delay runs after it
 * (timers of equal delay run in the order they were set). When it has run, the listener is in place.
 * `039-tastatur-anheben.spec.ts` proves both halves in-process with every timer of the page one second late.
 */
import { expect } from './http-guard';
import type { Locator, Page } from '@playwright/test';

/** Space on the focused drag handle; resolves with the lift announcement once the sensor listens for the arrow keys. */
export async function liftWithKeyboard(page: Page, announcer: Locator, number: string): Promise<string> {
  await page.keyboard.press('Space');
  await expect(announcer).toContainText(`Wortmeldung ${number}`);
  const lifted = await announcer.innerText();
  await page.evaluate(() => new Promise<void>((resolve) => { window.setTimeout(resolve, 0); }));
  return lifted;
}
