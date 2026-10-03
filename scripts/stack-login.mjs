/**
 * Slice 037a, S13: signs a test person in to the running local stack through the real Keycloak form, checks that the
 * interface stands in German with the speakers list (Wortmeldeliste) of the demo corpus and takes the screenshot
 * `docs/evidence/037a-stack-angemeldet.png`. Then the negative case: `norole` signs in and gets no session (the
 * callback answers 403), checked without a screenshot.
 *
 *   pnpm stack:login [-- --person <key>] [-- --no-screenshot]
 *
 * Needs `pnpm install` (Playwright from apps/web) and a Chromium (`pnpm --filter @hv/web exec playwright install
 * chromium`, or PW_CHROMIUM_PATH for a Chromium of your own). The password comes from the state directory and is never printed; no trace, no
 * video, no report. On a failure only the name of the stage reaches stderr.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PERSONS } from './lib/demo-persons.mjs';
import { ROOT, StackRefusal, assertLocalDocker, formatFailure, formatSmokeLine, readState, secretsOf, startOutput } from './stack.mjs';

export const SCREENSHOT = 'docs/evidence/037a-stack-angemeldet.png';

export function parseLoginArgs(argv) {
  const tokens = argv.filter((token) => token !== '--');
  const args = { person: 'moderation', screenshot: true };
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === '--person') args.person = tokens[++i];
    else if (tokens[i] === '--no-screenshot') args.screenshot = false;
    else throw new StackRefusal('stack:login nimmt nur --person <key> und --no-screenshot.');
  }
  const person = PERSONS.find((entry) => entry.key === args.person);
  if (!person || person.role === undefined) throw new StackRefusal('--person braucht eine Testperson mit Rolle.');
  return args;
}

let stage = 'Argumente';

async function signIn(page, person) {
  await page.goto('/auth/login?returnTo=%2Fspeakers');
  await page.locator('#username').fill(person.username);
  await page.locator('#password').fill(person.password);
  await page.locator('#kc-login').click();
}

async function main(argv) {
  const args = parseLoginArgs(argv);
  stage = 'Voraussetzungen';
  await assertLocalDocker();
  stage = 'Zustand';
  const found = readState();
  if (!found) throw new StackRefusal('Keine Installation gefunden. Zuerst pnpm stack:up.');
  const { state } = found;
  const say = startOutput({ secrets: secretsOf(state) });
  stage = 'Playwright laden';
  const { chromium } = createRequire(pathToFileURL(join(ROOT, 'apps/web/package.json')))('@playwright/test');
  // PW_CHROMIUM_PATH points at a Chromium of your own; otherwise Playwright's own (`playwright install chromium`).
  const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
  stage = 'Browser starten';
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const baseURL = `http://localhost:${state.webPort}`;
    const context = await browser.newContext({ baseURL, locale: 'de-DE', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    stage = `Anmeldung ${args.person}`;
    await signIn(page, state.persons[args.person]);
    await page.getByTestId('session-role').waitFor({ state: 'visible', timeout: 60_000 });
    stage = 'Wortmeldeliste';
    await page.locator('[data-testid="speaker-row"]').first().waitFor({ state: 'visible', timeout: 60_000 });
    const rows = await page.locator('[data-testid="speaker-row"]').count();
    const lang = await page.evaluate(() => document.documentElement.lang);
    const ok = rows > 0 && lang === 'de';
    say(formatSmokeLine(`Anmeldung ${args.person} über Keycloak; Oberfläche auf Deutsch mit der Wortmeldeliste (${rows} Zeilen)`, ok));
    if (!ok) throw new StackRefusal('Die Oberfläche steht nicht auf Deutsch mit der Wortmeldeliste.');
    if (args.screenshot) {
      stage = 'Screenshot';
      const file = join(ROOT, SCREENSHOT);
      mkdirSync(dirname(file), { recursive: true });
      await page.screenshot({ path: file });
      say(`Screenshot: ${SCREENSHOT}`);
    }
    await context.close();

    stage = 'Anmeldung norole';
    const negative = await browser.newContext({ baseURL, locale: 'de-DE' });
    const other = await negative.newPage();
    const callback = other.waitForResponse((response) => new URL(response.url()).pathname === '/auth/callback', { timeout: 60_000 });
    await signIn(other, state.persons.norole);
    const status = (await callback).status();
    const session = (await negative.cookies()).some((cookie) => cookie.name === 'hv_session');
    const me = (await other.request.get('/auth/me')).status();
    const refused = status === 403 && !session && me === 401;
    say(formatSmokeLine(`norole: Rückruf ${status}, keine Sitzung, /auth/me ${me}, keine Arbeitsansicht`, refused));
    if (!refused) throw new StackRefusal('norole hat eine Sitzung bekommen.');
    await negative.close();
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(formatFailure(stage, error));
    process.exitCode = 1;
  });
}
