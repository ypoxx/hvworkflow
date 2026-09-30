/**
 * Slice 031b: the one way the shared e2e files change the acting person. Role names appear only here and in the tests
 * that name the role they want (AGENTS.md R4: test helpers may).
 *
 * `in-process`: the demo role switcher, as before. `http`: there is no switcher; a person is a session. The helper
 * replaces the cookies of the page's context with those of the wanted role from the state `http-setup` wrote, reloads,
 * and waits until the session display names that role. The route stays where it was; a test that depends on interface
 * state across the switch (an open dialog, a filter, a selection) restores it explicitly afterwards, in both projects.
 */
import { readFileSync } from 'node:fs';
import { expect, test } from './http-guard';
import type { Page } from '@playwright/test';

type Lang = 'de' | 'en';

/** Display names of the roles as the shell shows them (`shell.de.ts`, `shell.en.ts`). */
const ROLE_LABELS: Readonly<Record<string, Readonly<Record<Lang, string>>>> = {
  moderation: { de: 'Versammlungsbüro', en: 'Meeting office' },
  capture: { de: 'Erfassung', en: 'Capture desk' },
  coordination: { de: 'Koordination', en: 'Coordination' },
  expert: { de: 'Fachbereich', en: 'Expert' },
  legal: { de: 'Recht', en: 'Legal' },
  approver: { de: 'Freigabe', en: 'Approver' },
  podium: { de: 'Podium', en: 'Podium' },
};

const isHttp = (): boolean => test.info().project.name === 'http';

function labelsOf(role: string): Readonly<Record<Lang, string>> {
  const labels = ROLE_LABELS[role];
  if (!labels) throw new Error(`No display name known for role ${role}.`);
  return labels;
}

/** Where the shell shows the acting role: the demo switcher in `in-process`, the session display in `http`. */
const roleDisplay = (page: Page) => page.getByTestId(isHttp() ? 'session-role' : 'role-switcher');

/**
 * The shell names the role in the one language the test expects (exact, not either of the two). Used after a switch
 * and after a language change, so the role stays proven in both projects.
 */
export async function expectRoleLabel(page: Page, role: string, lang: Lang): Promise<void> {
  const label = labelsOf(role)[lang];
  if (isHttp()) await expect(roleDisplay(page)).toHaveText(label);
  else await expect(roleDisplay(page)).toContainText(label);
}

export async function asRole(page: Page, role: string): Promise<void> {
  const labels = labelsOf(role);
  // The switch itself does not know the language of the page; either display name proves the role. Tests that care
  // about the language call `expectRoleLabel` with the one they expect.
  const either = new RegExp(`^(${labels.de}|${labels.en})$`);
  if (!isHttp()) {
    await page.getByTestId('role-switcher').click();
    await page.getByTestId(`role-option-${role}`).click();
    await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
    await expect(page.getByTestId('role-switcher')).toContainText(new RegExp(`(${labels.de}|${labels.en})`));
    return;
  }
  const stateDir = process.env['E2E_HTTP_STATE_DIR'];
  if (!stateDir) throw new Error('E2E_HTTP_STATE_DIR is required.');
  const file = `${stateDir}/state-${role}.json`;
  let state: { cookies: Parameters<ReturnType<Page['context']>['addCookies']>[0] };
  try {
    state = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // The parse error can echo characters of the file, which holds a session cookie: name the file only.
    throw new Error(`The state file for role ${role} could not be read or parsed (${file}).`);
  }
  const started = Date.now();
  const context = page.context();
  await context.clearCookies();
  await context.addCookies(state.cookies);
  await page.reload();
  await expect(page.getByTestId('session-role')).toHaveText(either);
  // The session display comes before the data. The next steps of the tests wait 5 s for lists; the header counter is the
  // first data signal of every page, so the switch is over once it shows. 60 s is the wait of the sign-in setup and of
  // H4/H6 for the same signal on a cold page (031a), not a new allowance.
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 60_000 });
  console.log(`[timing] switch to ${role} (http, reload until the first data): ${Date.now() - started} ms`);
}

/**
 * Own writes in the `http` project: a write raises the version of its resource, and the page takes the version for its next
 * write from a list it re-reads after the write (takt-030). A second write, or a read of a value that another list carries,
 * before that re-read is refused with 412 or shows the old value. So the step waits for the write and then for the given reads
 * (GET, in this order after the write). In `in-process` the store is synchronous and nothing waits. `reads` are path names.
 */
export async function afterOwnWrite(
  page: Page, act: () => Promise<void>, write: { method: string; path: RegExp }, reads: readonly string[],
): Promise<void> {
  if (!isHttp()) {
    await act();
    return;
  }
  const traffic: { method: string; path: string }[] = [];
  const record = (response: { request(): { method(): string }; url(): string }): void => {
    traffic.push({ method: response.request().method(), path: new URL(response.url()).pathname });
  };
  page.on('response', record);
  try {
    await act();
    await expect.poll(() => {
      const at = traffic.findIndex((entry) => entry.method === write.method && write.path.test(entry.path));
      return at >= 0 && reads.every((path) => traffic.some((entry, index) => index > at && entry.method === 'GET' && entry.path === path));
    }, { message: `the write ${write.method} ${write.path} and the re-read of ${reads.join(', ')}`, timeout: 15_000 }).toBe(true);
  } finally {
    page.off('response', record);
  }
}
