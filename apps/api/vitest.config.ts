import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 20000,
    // Operation-coverage gate (slice 023, goal 5): every operationId exercised or allowlisted.
    globalSetup: ['src/__tests__/operation-coverage.setup.ts'],
  },
});
