/**
 * takt-049 (docs/slices/takt-049-fokus-f6-wackler.md): one atomic reading of "Meine Fragen" (focus view of 054).
 *
 * Why one `page.evaluate`: the old predicate read the page in four Playwright calls (`isVisible`, `isVisible`, `count`,
 * `getAttribute`). `getAttribute` waits for its element, and the config sets no `actionTimeout`. For a role without own
 * questions the skeleton (`focus-list`, `data-state="loading"`) is replaced by the notice `focus-empty`, which renders no
 * `focus-list` any more; when that swap fell between `count()` and `getAttribute`, the callback hung and `expect.poll`
 * never called it again (054 F6 red in CI runs 37337216828 and 37343908853). A single read has no gap the swap can fall
 * into.
 */
import type { Page } from '@playwright/test';
import { expect } from './http-guard';

export interface FocusListSnapshot {
  forbidden: boolean;
  empty: boolean;
  listState: 'loading' | 'ready' | 'failed' | null;
  units: string[];
}

/** The page state in one step: notices (present and visible, as `isVisible`), list state and the units of its rows. */
export async function readFocusList(page: Page): Promise<FocusListSnapshot> {
  return page.evaluate(() => {
    const visible = (testId: string): boolean => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      return el !== null && el.checkVisibility();
    };
    const list = document.querySelector('[data-testid="focus-list"]');
    const state = list?.getAttribute('data-state') ?? null;
    const listState = state === 'loading' || state === 'ready' || state === 'failed' ? state : null;
    const units = list === null
      ? []
      : Array.from(list.querySelectorAll('[data-testid="focus-row"]'), (row) => row.getAttribute('data-unit') ?? '');
    return { forbidden: visible('focus-forbidden'), empty: visible('focus-empty'), listState, units };
  });
}

/** Pure: the list has landed for the acting person (a notice stands, or it is ready and every row is of `unitId`). */
export function focusListLanded(snapshot: FocusListSnapshot, unitId: string): boolean {
  if (snapshot.forbidden || snapshot.empty) return true;
  return snapshot.listState === 'ready' && snapshot.units.length > 0 && snapshot.units.every((unit) => unit === unitId);
}

/**
 * After a switch of person the list arrives later than the page (lesson of 045, CI run 37152696332, and 053 review 7):
 * rows are taken only after this. The 15 s are those of 054 (no new margin).
 */
export async function waitForMine(page: Page, unitId: string): Promise<void> {
  await expect.poll(async () => focusListLanded(await readFocusList(page), unitId), { timeout: 15_000 }).toBe(true);
}
