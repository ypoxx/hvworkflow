/**
 * Takt-050 (docs/slices/takt-050-010b-runde4.md): loading the app's modules in a test without an evaluate that waits
 * on the dynamic import.
 *
 * CI runs 37347756649 (job 111890560965, commit d17bcbf) and 37360163818 (job 111933081379, commit e1be691) failed
 * `010b-lesepfade.spec.ts` "Runde 4 (B)" with `page.evaluate: Resulting promise was garbage collected.` at its second
 * evaluate, whose only awaited promise was `import('/src/api/actor.ts')`. The four blocks below pin the mechanism and
 * the remedy (`support/app-modules.ts`). Garbage collection is forced through CDP (`HeapProfiler.collectGarbage`),
 * never through a time span or a browser flag. In-process project only; not one of the shared files.
 */
import { expect, test } from './support/http-guard';
import { ACTOR_MODULE, loadAppModules } from './support/app-modules';
import type { AppModulesWindow } from './support/app-modules';
import type { Page } from '@playwright/test';

/** One full garbage collection of the page's heap, through the DevTools protocol. */
async function collectGarbage(page: Page): Promise<void> {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('HeapProfiler.collectGarbage');
  } finally {
    await session.detach();
  }
}

/** A promise that rejects after `ms`, so a test that expects a settle never hangs for the whole test timeout. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`not settled within ${ms} ms`)), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

test('T1 Ursache: ein Evaluate, das auf ein offenes, unerreichbares Promise wartet, endet mit "garbage collected"', async ({
  page,
}) => {
  await page.setContent('<p>takt-050</p>');
  // Stand-in for a dynamic import the CI browser dropped without settling it (CI runs 37347756649 and 37360163818,
  // takt-050): the V8 inspector holds the awaited promise only weakly, so once nothing else reaches it, the next
  // collection takes it and Playwright reports "Resulting promise was garbage collected".
  const pending = page.evaluate(async () => {
    // A flag only, not the promise: the test collects once the evaluate is really running in the page (Playwright may
    // still be resolving the execution context when `evaluate` returns its promise).
    (window as unknown as { __t1Started?: boolean }).__t1Started = true;
    await new Promise(() => {});
  });
  // Observed, so the rejection never counts as unhandled while the collection runs.
  const outcome = pending.then(
    () => 'resolved',
    (error: unknown) => String(error),
  );
  await expect.poll(() => page.evaluate(() => (window as unknown as { __t1Started?: boolean }).__t1Started)).toBe(true);
  await collectGarbage(page);
  expect(await within(outcome, 5_000)).toMatch(/Resulting promise was garbage collected/);
});

test('T2 Prinzip: dasselbe offene Promise an window bleibt ein Zustand, kein Bereinigungsfehler', async ({ page }) => {
  await page.setContent('<p>takt-050</p>');
  const returned = await page.evaluate(() => {
    const w = window as unknown as AppModulesWindow;
    w.__appModules = { state: 'loading', modules: {}, pending: new Promise<void>(() => {}) };
  });
  expect(returned).toBeUndefined();
  await collectGarbage(page);
  expect(await page.evaluate(() => (window as unknown as AppModulesWindow).__appModules?.state)).toBe('loading');
});

test('T3 Hilfe, Gutfall: dieselbe Modulinstanz wie die App, ein zweiter Aufruf lädt nicht neu', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await loadAppModules(page);

  expect(
    await page.evaluate(
      (url) =>
        typeof (
          (window as unknown as AppModulesWindow).__appModules!.modules[url] as { setActor?: unknown } | undefined
        )?.setActor,
      ACTOR_MODULE,
    ),
  ).toBe('function');

  // Synchronous: the switch goes through the module the test loaded; the header shows it, so it is the app's instance.
  await page.evaluate((url) => {
    const mod = (window as unknown as AppModulesWindow).__appModules!.modules[url] as {
      DEMO_ACTORS: readonly { role: string }[];
      setActor: (actor: unknown) => void;
    };
    mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === 'podium'));
  }, ACTOR_MODULE);
  await expect(page.getByTestId('role-switcher')).toContainText('Podium');

  // A second call finds every URL loaded and leaves the stored promise untouched (no new import).
  await page.evaluate(() => {
    const w = window as unknown as AppModulesWindow & { __firstPending?: Promise<void> };
    w.__firstPending = w.__appModules!.pending;
  });
  await loadAppModules(page);
  expect(
    await page.evaluate(() => {
      const w = window as unknown as AppModulesWindow & { __firstPending?: Promise<void> };
      return w.__appModules!.pending === w.__firstPending;
    }),
  ).toBe(true);
});

test('T4 Hilfe, hängender Import: benannte loading-Meldung statt "garbage collected", in unter 5 s', async ({
  page,
}) => {
  // Never answered: the import stays pending for as long as the page lives.
  await page.route('**/takt-050-haengt.ts', () => {});
  await page.goto('/');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });

  const started = Date.now();
  const outcome = loadAppModules(page, ['/takt-050-haengt.ts'], { timeoutMs: 1_500 }).then(
    () => 'resolved',
    (error: unknown) => String(error),
  );
  // Collect only once the helper's evaluate has installed the pending import (Codex P2 on #165, as T1
  // waits for its flag): otherwise the collection could run before the import starts and prove nothing.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as AppModulesWindow).__appModules?.state), { timeout: 1_000 })
    .toBe('loading');
  await collectGarbage(page);
  const message = await within(outcome, 5_000);
  const elapsed = Date.now() - started;

  expect(message).toContain('/takt-050-haengt.ts');
  expect(message).toContain('loading');
  expect(message).not.toMatch(/garbage collected/);
  expect(elapsed).toBeLessThan(5_000);
});
