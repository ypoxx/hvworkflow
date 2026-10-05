/**
 * Takt-050 (docs/slices/takt-050-010b-runde4.md): loads the app's own modules into a test page once, without any
 * `page.evaluate` waiting in the page on the dynamic import.
 *
 * Why: Playwright sends `page.evaluate` as `Runtime.callFunctionOn` with `awaitPromise: true`, and the V8 inspector
 * holds the promise it awaits only weakly. When a collection takes that promise while it is still pending, Playwright
 * reports "Resulting promise was garbage collected." A pending promise nothing can reach can never settle, so the
 * message means: the evaluate would never have ended. CI runs 37347756649 (job 111890560965) and 37360163818
 * (job 111933081379) failed 010b "Runde 4 (B)" exactly so, while its evaluate awaited only `import('/src/api/actor.ts')`
 * — the CI browser most likely dropped the import without settling it. Slice 010c met the same class on 62f347b and
 * fixed it with its own `installHarness` (start the imports, return, poll); this helper is the shared form of that fix.
 *
 * How: one synchronous evaluate starts `Promise.all(urls.map(import))` and hangs that promise on `window`, so the page
 * itself keeps it reachable and it cannot be collected; the outcome is written to `__appModules.state`, which the test
 * polls. An import that never settles therefore shows as the named `loading` message below, not as "garbage
 * collected". No retry (as in 010c): a second attempt would hide whether the import really hangs.
 *
 * Rule (takt-050, Ziel 3): an evaluate never waits in the page on an `api` call across an actor switch. The live store
 * leaves such a read pending on purpose and without a reference (`apps/web/src/api/liveStore.ts:14–19`), so the
 * evaluate would end with the very same "garbage collected" message. Start the call in a synchronous evaluate, put its
 * outcome on `window`, and poll it.
 *
 * Only against the Vite dev server (in-process project): a production build has no `/src/...` modules to import.
 */
import { expect } from './http-guard';
import type { Page } from '@playwright/test';

/** The in-process `HvApi` instance of the app (`apps/web/src/api/index.ts`). */
export const API_MODULE = '/src/api/index.ts';
/** The demo actor store (`apps/web/src/api/actor.ts`). */
export const ACTOR_MODULE = '/src/api/actor.ts';

export interface AppModulesWindow {
  __appModules?: {
    state: 'loading' | 'ready' | `failed: ${string}`;
    /** Module namespaces by URL, filled once every import of the call has settled. */
    modules: Record<string, unknown>;
    /** The import chain itself — held here so the page keeps it reachable. */
    pending: Promise<void>;
  };
}

/**
 * Loads `urls` once per page into `window.__appModules.modules`. Idempotent: when every URL is already there, the
 * evaluate returns at once and nothing is imported again.
 */
export async function loadAppModules(
  page: Page,
  urls: readonly string[] = [API_MODULE, ACTOR_MODULE],
  options?: { timeoutMs?: number },
): Promise<void> {
  await page.evaluate((wanted) => {
    const w = window as unknown as AppModulesWindow;
    const existing = w.__appModules;
    if (existing !== undefined && wanted.every((url) => url in existing.modules)) return;
    const modules = existing?.modules ?? {};
    const record: NonNullable<AppModulesWindow['__appModules']> = {
      state: 'loading',
      modules,
      pending: Promise.resolve(),
    };
    record.pending = Promise.all(wanted.map((url) => import(/* @vite-ignore */ url) as Promise<unknown>)).then(
      (namespaces) => {
        namespaces.forEach((namespace, index) => {
          modules[wanted[index]!] = namespace;
        });
        record.state = 'ready';
      },
      (error: unknown) => {
        record.state = `failed: ${String(error)}`;
      },
    );
    w.__appModules = record;
    // Returns undefined, never the promise: nothing in the page is awaited by the inspector.
  }, urls);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as AppModulesWindow).__appModules?.state), {
      timeout: options?.timeoutMs ?? 10_000,
      message:
        `app modules ${urls.join(', ')} not ready; state 'loading' means the dynamic import never settled ` +
        '(takt-050, support/app-modules.ts)',
    })
    .toBe('ready');
}
