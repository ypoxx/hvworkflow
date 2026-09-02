import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

/**
 * Vitest owns the unit tests under `src/`, Playwright owns `e2e/`. Both runners match
 * `*.spec.ts` by default, so without this narrowing `pnpm test` would try to execute the
 * end-to-end specs and fail on `test.use()`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }),
);
