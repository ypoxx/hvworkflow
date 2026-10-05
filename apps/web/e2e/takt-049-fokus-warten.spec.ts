/**
 * takt-049 — the waiting helper of "Meine Fragen" reads atomically (docs/slices/takt-049-fokus-f6-wackler.md).
 *
 * No app: fixed DOM states set by `page.setContent` that copy the test ids of `FocusList` and the focus page. The
 * state changes through `page.evaluate` at a fixed point, never over a span of time, so both blocks are deterministic.
 * Runs in the `in-process` project only (not in `SHARED_SPECS`).
 */
import type { Page } from '@playwright/test';
import { errors } from '@playwright/test';
import { focusListLanded, readFocusList, waitForMine } from './support/focus-list';
import { expect, test } from './support/http-guard';

const UNIT = 'unit-fin';
const SKELETON = '<div data-testid="focus-list" data-state="loading"></div>';
const EMPTY = '<div data-testid="focus-empty" role="status">Keine Fragen</div>';
const FORBIDDEN = '<div data-testid="focus-forbidden" role="status">Keine Leseberechtigung</div>';
const list = (state: string, units: readonly string[]): string =>
  `<ul data-testid="focus-list" data-state="${state}">${
    units.map((unit) => `<li data-testid="focus-row" data-unit="${unit}">Frage</li>`).join('')
  }</ul>`;

/** The one transition of a role without own questions: the skeleton leaves, the notice comes, no `focus-list` again. */
async function swapSkeletonForNotice(page: Page): Promise<void> {
  await page.evaluate((html) => {
    const skeleton = document.querySelector('[data-testid="focus-list"]');
    if (skeleton === null) throw new Error('skeleton missing');
    skeleton.outerHTML = html;
  }, EMPTY);
}

test.describe('takt-049 focus list waiting', () => {
  /**
   * T1 — the cause. 054 F6 timed out in CI runs 37337216828 (job 111855623850) and 37343908853 (job 111877576800):
   * steps 1–3 of the old reading saw the skeleton, then the swap came, and step 4 (`getAttribute`) waited for an element
   * that a ready, empty state never renders. Green when that failure happens; the own 2 s bound stands in for the poll.
   */
  test('T1 the old four-step reading hangs when the swap falls between count and getAttribute', async ({ page }) => {
    await page.setContent(SKELETON);
    expect(await page.getByTestId('focus-forbidden').isVisible()).toBe(false); // step 1
    expect(await page.getByTestId('focus-empty').isVisible()).toBe(false); // step 2
    const focusList = page.getByTestId('focus-list');
    expect(await focusList.count()).toBe(1); // step 3
    await swapSkeletonForNotice(page);
    const step4 = await focusList.getAttribute('data-state', { timeout: 2_000 }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(step4).toBeInstanceOf(errors.TimeoutError);
    await expect(page.getByTestId('focus-empty')).toBeVisible();
  });

  /** T2 — the correction: one reading at the same point lands on the notice. */
  test.describe('T2 the atomic reading', () => {
    const cases: ReadonlyArray<{ name: string; html: string; landed: boolean }> = [
      { name: 'notice', html: EMPTY, landed: true },
      { name: 'no read permission', html: FORBIDDEN, landed: true },
      { name: 'own rows', html: list('ready', [UNIT, UNIT]), landed: true },
      { name: 'a foreign row', html: list('ready', [UNIT, 'unit-ops']), landed: false },
      { name: 'ready without rows', html: list('ready', []), landed: false },
      { name: 'failed', html: list('failed', []), landed: false },
      { name: 'hidden notice', html: EMPTY.replace('role="status"', 'role="status" style="display:none"'), landed: false },
    ];

    test('skeleton', async ({ page }) => {
      await page.setContent(SKELETON);
      const snapshot = await readFocusList(page);
      expect(snapshot.listState).toBe('loading');
      expect(focusListLanded(snapshot, UNIT)).toBe(false);
    });

    test('bad order: skeleton, then the swap of T1, then read', async ({ page }) => {
      await page.setContent(SKELETON);
      await swapSkeletonForNotice(page);
      const snapshot = await readFocusList(page);
      expect(snapshot).toEqual({ forbidden: false, empty: true, listState: null, units: [] });
      expect(focusListLanded(snapshot, UNIT)).toBe(true);
    });

    for (const { name, html, landed } of cases) {
      test(name, async ({ page }) => {
        await page.setContent(html);
        expect(focusListLanded(await readFocusList(page), UNIT)).toBe(landed);
      });
    }

    test('waitForMine returns within 2 s after the swap', async ({ page }) => {
      await page.setContent(SKELETON);
      await swapSkeletonForNotice(page);
      const started = performance.now();
      await waitForMine(page, UNIT);
      expect(performance.now() - started).toBeLessThan(2_000);
    });
  });
});
