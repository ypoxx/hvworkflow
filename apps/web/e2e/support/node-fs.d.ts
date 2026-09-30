/**
 * Slice 013: `apps/web/tsconfig.app.json` (outside this slice's "Files allowed" — it is not one of
 * the files this spec may touch) has no Node types at all; every other e2e spec only ever touches
 * DOM/Playwright APIs, which the project's `lib`/`types` already cover. `support/axe.ts` is the one
 * exception — it reads `axe-exceptions.json` from disk once, synchronously, at import time. Adding
 * `@types/node` project-wide is a dependency change well outside this slice's file list; this
 * declares only the Node functions the e2e files actually call, scoped to this directory.
 *
 * Slice 031a adds what the HTTP project needs: the environment, reading and writing small state files with
 * their rights, and starting one child process (H6: the subject block command).
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, options: { mode: number }): void;
  export function chmodSync(path: string, mode: number): void;
  export function mkdirSync(path: string, options: { recursive: boolean; mode: number }): void;
}

declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: readonly string[],
    options: { env: Record<string, string>; stdio: 'ignore'; timeout: number },
  ): void;
}

declare const process: {
  readonly env: Record<string, string | undefined>;
  readonly execPath: string;
};
