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

/** Display names of the roles in both languages, as the session display shows them (`shell.de.ts`, `shell.en.ts`). */
const ROLE_LABELS: Readonly<Record<string, RegExp>> = {
  moderation: /^(Versammlungsbüro|Meeting office)$/,
  capture: /^(Erfassung|Capture desk)$/,
  coordination: /^(Koordination|Coordination)$/,
  expert: /^(Fachbereich|Expert)$/,
  legal: /^(Recht|Legal)$/,
  approver: /^(Freigabe|Approver)$/,
  podium: /^Podium$/,
};

export async function asRole(page: Page, role: string): Promise<void> {
  if (test.info().project.name !== 'http') {
    await page.getByTestId('role-switcher').click();
    await page.getByTestId(`role-option-${role}`).click();
    await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
    return;
  }
  const stateDir = process.env['E2E_HTTP_STATE_DIR'];
  if (!stateDir) throw new Error('E2E_HTTP_STATE_DIR is required.');
  const label = ROLE_LABELS[role];
  if (!label) throw new Error(`No display name known for role ${role}.`);
  const state = JSON.parse(readFileSync(`${stateDir}/state-${role}.json`, 'utf8')) as
    { cookies: Parameters<ReturnType<Page['context']>['addCookies']>[0] };
  const context = page.context();
  await context.clearCookies();
  await context.addCookies(state.cookies);
  await page.reload();
  await expect(page.getByTestId('session-role')).toHaveText(label, { timeout: 60_000 });
}
