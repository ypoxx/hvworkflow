/**
 * Slice 031a (decision 13): the setup project of the HTTP suite. It signs the eight persons that hold a role in
 * through the real Keycloak form and keeps one browser state per person under `E2E_HTTP_STATE_DIR` (directory 0700,
 * files 0600, outside the repository). The passwords come from a file in that directory that only the harness wrote;
 * nothing here prints, traces or asserts on a password, cookie or token.
 */
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test as setup } from '../support/http-guard';

/** One state per person; `revoke` belongs to H6 alone. `norole` has no state on purpose (H7 signs in itself). */
const SETUP_PERSONS = [
  'moderation', 'capture', 'coordination', 'expert', 'legal', 'approver', 'podium', 'revoke',
] as const;

const stateDir = process.env['E2E_HTTP_STATE_DIR'];

setup.describe('sign in through the Keycloak form', () => {
  setup.describe.configure({ mode: 'serial' });
  for (const key of SETUP_PERSONS) {
    setup(`sign in ${key}`, async ({ page, context }) => {
      if (!stateDir) throw new Error('E2E_HTTP_STATE_DIR is required.');
      const credentials = JSON.parse(readFileSync(`${stateDir}/credentials.json`, 'utf8')) as
        Record<string, { username: string; password: string }>;
      const person = credentials[key];
      if (!person) throw new Error(`No credentials for ${key}.`);
      await page.goto('/auth/login?returnTo=%2F');
      await page.locator('#username').fill(person.username);
      await page.locator('#password').fill(person.password);
      await page.locator('#kc-login').click();
      await expect(page.getByTestId('session-role')).toBeVisible({ timeout: 60_000 });
      const file = `${stateDir}/state-${key}.json`;
      writeFileSync(file, JSON.stringify(await context.storageState()), { mode: 0o600 });
      chmodSync(file, 0o600);
    });
  }
});
