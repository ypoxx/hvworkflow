/**
 * Slice 013: `apps/web/tsconfig.app.json` (outside this slice's "Files allowed" — it is not one of
 * the files this spec may touch) has no Node types at all; every other e2e spec only ever touches
 * DOM/Playwright APIs, which the project's `lib`/`types` already cover. `support/axe.ts` is the one
 * exception — it reads `axe-exceptions.json` from disk once, synchronously, at import time. Adding
 * `@types/node` project-wide is a dependency change well outside this slice's file list; this
 * declares only the one Node function that file actually calls, scoped to this directory.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
