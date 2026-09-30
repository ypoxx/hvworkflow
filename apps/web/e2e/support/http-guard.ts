/**
 * Slice 031a (decision 9): the 429 guard of the HTTP project. Only the limits per person are raised in the test
 * service; every other limit stays at its default, so a 429 in this suite means the defaults were hit, and that
 * must fail the test instead of hiding behind a retry.
 *
 * Every file of the `http` project imports `test` and `expect` from here, never from `@playwright/test`
 * (`scripts/e2e-http-031.test.mjs` checks it). The fixture is automatic: it hangs on the context's `response` event
 * and, after the test, fails on the first 429 with the path only, never headers or body. In the `in-process`
 * project there is no service, so it never fires.
 */
import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ rateLimitGuard: undefined }>({
  rateLimitGuard: [async ({ context }, use) => {
    const limited: string[] = [];
    context.on('response', (response) => {
      if (response.status() === 429) limited.push(new URL(response.url()).pathname);
    });
    await use(undefined);
    if (limited.length > 0) {
      throw new Error(`The service answered 429 (rate limit) on: ${[...new Set(limited)].join(', ')}`);
    }
  }, { auto: true }],
});

export { expect };
