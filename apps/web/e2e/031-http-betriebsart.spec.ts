/**
 * Slice 031a — the HTTP mode of the interface against the real service (Hono, Postgres, Keycloak test realm).
 * H1–H3 need no sign-in and run everywhere; H4–H8 carry `@idp` and need the Keycloak realm (CI only, the local mode
 * `E2E_HTTP_IDP=none` filters them out). The only `page.route` double of this suite lives in `030-anmeldung.spec.ts`.
 *
 * Nothing here changes questions or Wortmeldungen of the corpus; H8 writes, and only on a Wortmeldung and a
 * Redebeitrag it creates itself. Passwords, cookies and tokens are read from state files and never printed.
 */
import { request } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkAxe } from './support/axe';
import {
  DSFA_SUMMARY_URL, H8_CONTRIBUTION_TEXT, H8_OTHER_WRITER_QUESTION, H8_SPEAKER_NAME, H8_UNCONFIRMED_QUESTION,
  NOTICE_DE, NOTICE_EN,
} from './support/e2e-texts';
import { expect, test } from './support/http-guard';

const stateDir = process.env['E2E_HTTP_STATE_DIR'] ?? '';
const httpPort = Number(process.env['E2E_HTTP_PORT'] ?? 4174);
const origin = `http://localhost:${httpPort}`;
const noState = { cookies: [], origins: [] };
const statePath = (key: string): string => `${stateDir}/state-${key}.json`;

const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

type Credentials = Record<string, { username: string; password: string }>;
const credentialsOf = (key: string): { username: string; password: string } => {
  const person = (JSON.parse(readFileSync(`${stateDir}/credentials.json`, 'utf8')) as Credentials)[key];
  if (!person) throw new Error(`No credentials for ${key}.`);
  return person;
};

async function signInThroughForm(page: Page, key: string): Promise<void> {
  const person = credentialsOf(key);
  await page.locator('#username').fill(person.username);
  await page.locator('#password').fill(person.password);
  await page.locator('#kc-login').click();
}

/** A context created by hand is not covered by the guard fixture; it reports its own 429 (path only). */
function watchLimits(context: BrowserContext): () => void {
  const limited: string[] = [];
  context.on('response', (response) => {
    if (response.status() === 429) limited.push(new URL(response.url()).pathname);
  });
  return () => expect(limited, 'paths answered with 429').toEqual([]);
}

const sessionCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((cookie) => cookie.name === 'hv_session');

test.describe('H1–H3: the interface before any sign-in', () => {
  test.use({ storageState: noState });

  test('H1: the sign-in page comes from the real service, in the empty state', async ({ page }) => {
    await page.goto('/speakers?round=2');
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByText(NOTICE_DE)).toBeVisible();
    await expect(page.getByText(NOTICE_EN)).toBeVisible();
    await expect(page.getByRole('link', { name: /Datenschutz-Folgenabschätzung/ })).toHaveAttribute('href', DSFA_SUMMARY_URL);
    await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/auth/login?returnTo=%2Fspeakers%3Fround%3D2');
    await expect(page.getByTestId('role-switcher')).toHaveCount(0);
    await expect(page.getByTestId('demo-reset')).toHaveCount(0);
    await checkAxe(page, 'HTTP mode sign-in (German, real service)');
  });

  test('H2: an old demo log is ignored in HTTP mode', async ({ page }) => {
    const legacy = JSON.stringify([{
      seq: 1, id: 'legacy-1', type: 'MeetingCreated', at: '2026-09-23T12:00:00.000Z',
      actor: { id: 'test-actor', role: 'admin' }, subjectId: 'legacy-meeting', payload: {},
    }]);
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem('031-legacy-fixture')) {
        localStorage.setItem('hv-demo-events-v1', value);
        sessionStorage.setItem('031-legacy-fixture', '1');
      }
    }, legacy);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Altes Demoprotokoll' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Zurücksetzen und Demo neu aufbauen' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('hv-demo-events-v1'))).toBe(legacy);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-http-altes-demoprotokoll.png') });
  });

  test('H3: same origin through the proxy, no CORS answer, the service headers arrive', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/auth/me'),
      page.goto('/'),
    ]);
    expect(new URL(response.url()).origin).toBe(origin);
    const headers = await response.allHeaders();
    expect(headers['access-control-allow-origin']).toBeUndefined();
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['x-server-time']).toBeTruthy();
  });

  test('G1: a 429 answered by the service turns the test red (the guard)', async ({ page }) => {
    // The guard fails the test after its body; `test.fail()` turns that expected failure into a pass. Without the guard
    // this test would end green and therefore fail.
    test.fail();
    await page.route('**/auth/transparency-notice', (route) => route.fulfill({
      status: 429, contentType: 'application/problem+json',
      body: JSON.stringify({ status: 429, title: 'Too Many Requests', detail: 'synthetic' }),
    }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  });
});

test.describe.serial('H4/H5 @idp: sign in through the Keycloak form, then sign out', () => {
  let context: BrowserContext;
  let page: Page;
  let assertNoLimit: () => void;
  let oldCookie = '';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ baseURL: origin, storageState: noState });
    assertNoLimit = watchLimits(context);
    page = await context.newPage();
  });
  test.afterAll(async () => { await context.close(); });

  test('H4 @idp: sign in as capture from /speakers?round=2 and return exactly there', async () => {
    await page.goto('/speakers?round=2');
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    await page.getByRole('link', { name: 'Anmelden' }).click();
    await page.locator('#username').waitFor();
    await signInThroughForm(page, 'capture');
    await page.waitForURL(`${origin}/speakers?round=2`);
    await expect(page.getByTestId('session-role')).toContainText('Erfassung');
    await expect(page.getByTestId('role-switcher')).toHaveCount(0);
    await expect(page.getByTestId('demo-reset')).toHaveCount(0);
    await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('hv-demo')))).toEqual([]);

    const cookie = await sessionCookie(context);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    expect((await context.cookies()).some((entry) => entry.name === 'hv_auth_state')).toBe(false);
    oldCookie = cookie?.value ?? '';
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-http-angemeldet.png') });
    assertNoLimit();
  });

  test('H5 @idp: sign-out sends the CSRF token, shows the sign-in page, and the old cookie is dead', async () => {
    expect(oldCookie).not.toBe('');
    const logout = page.waitForRequest((candidate) => new URL(candidate.url()).pathname === '/auth/logout');
    await page.getByRole('button', { name: 'Abmelden' }).click();
    const token = (await logout).headers()['x-csrf-token'] ?? '';
    // A boolean, so that a failing check never prints the token itself.
    expect(/^[A-Za-z0-9_-]{43}$/.test(token)).toBe(true);
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    const stale = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `hv_session=${oldCookie}` } });
    try {
      expect((await stale.get('/auth/me')).status()).toBe(401);
    } finally {
      await stale.dispose();
    }
    assertNoLimit();
  });
});

test.describe('H6 @idp: a blocked subject loses the session in the middle of it', () => {
  test.use({ storageState: statePath('revoke') });

  test('H6 @idp: the subject block takes effect without a restart', async ({ page }) => {
    const grant = JSON.parse(readFileSync(`${stateDir}/revoke.json`, 'utf8')) as { databaseUrl: string; actorId: string };
    await page.goto('/speakers');
    await expect(page.getByTestId('session-role')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 60_000 });

    const root = `${test.info().project.testDir}/../../..`;
    try {
      execFileSync(process.execPath, ['--import', `${root}/apps/api/node_modules/tsx/dist/loader.mjs`,
        `${root}/apps/api/src/auth/subject-block-cli.ts`, grant.actorId], {
        env: { PATH: process.env['PATH'] ?? '', HV_DATABASE_URL: grant.databaseUrl }, stdio: 'ignore', timeout: 60_000,
      });
    } catch {
      // The error of the child would name the actor id in its command line; keep it out of the report.
      throw new Error('The subject block command failed.');
    }

    expect((await page.request.get('/auth/me')).status()).toBe(401);
    // The page may already have left the app by itself (the 30 s poll ends in `onUnauthorized`), so nothing is clicked:
    // a reload asks the service again, and the answer must be the sign-in page whichever way the page got there. This does
    // not prove the `onUnauthorized` path of a running page; see the product entry "eigener Takt vor 031b" in docs/folgeliste.md.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('session-role')).toHaveCount(0);
    await expect(page.getByTestId('header-counter-questions')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-http-401.png') });
  });
});

test.describe('H7 @idp: a person without an active role', () => {
  test.use({ storageState: noState });

  // Spec decision 12 expects the page "Keine aktive Rolle" here. The service does not create a session for a person
  // without an active role: `/auth/callback` answers 403 (`R-PERM-01`) before any cookie is set (apps/api/src/app.ts,
  // the call of `sessionActorFromEvents` in the callback). The page appears only when a role is lost mid-session,
  // and no test may write role events past the service. This test therefore proves what is real: no session at all.
  test('H7 @idp: sign-in of a person without a role ends in 403 and creates no session', async ({ page, context }) => {
    await page.goto('/auth/login?returnTo=%2F');
    await page.locator('#username').waitFor();
    const callback = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/auth/callback');
    await signInThroughForm(page, 'norole');
    expect((await callback).status()).toBe(403);
    expect(await sessionCookie(context)).toBeUndefined();
    expect((await page.request.get('/auth/me')).status()).toBe(401);
  });
});

test.describe('H8 @idp: two writers, a real 412 through the ETag', () => {
  test.use({ storageState: statePath('capture') });

  test('H8 @idp: a stale write is answered 412 and the unconfirmed text stays', async ({ page, browser }) => {
    const moderationContext = await browser.newContext({ baseURL: origin, storageState: statePath('moderation') });
    const assertNoLimit = watchLimits(moderationContext);
    const state = JSON.parse(readFileSync(statePath('capture'), 'utf8')) as { cookies: { name: string; value: string }[] };
    const cookie = state.cookies.find((entry) => entry.name === 'hv_session')?.value ?? '';
    const other = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `hv_session=${cookie}` } });
    try {
      const me = await other.get('/auth/me');
      expect(me.status()).toBe(200);
      const csrf = ((await me.json()) as { csrfToken: string }).csrfToken;

      // 1. The meeting office registers a new Wortmeldung through the interface.
      const moderation = await moderationContext.newPage();
      await moderation.goto('/speakers');
      await expect(moderation.getByTestId('speaker-register')).toBeVisible({ timeout: 60_000 });
      await moderation.getByTestId('speaker-register').click();
      await moderation.getByTestId('speaker-register-name').fill(H8_SPEAKER_NAME);
      // HTTP mode has no push (product entry "eigener Takt vor 031b", docs/folgeliste.md): an own write does not refresh the list before the next 30 s poll, so the test
      // checks the answer of the service (status only, never the body) and then reloads the page.
      const registered = moderation.waitForResponse((candidate) => candidate.request().method() === 'POST' &&
        new URL(candidate.url()).pathname === '/v1/speakers');
      await moderation.getByTestId('speaker-register-submit').click();
      const registration = await registered;
      expect(registration.status(), `HTTP status of the registration (${registration.status()})`).toBe(201);
      // The id comes from the answer of the registration: the list read with the capture session shows only "Redner N",
      // because that role may not reveal names (`question.identity.reveal`), so it cannot be searched by name.
      const created = (await registration.json()) as { id?: unknown };
      expect(typeof created.id, 'the registration answer carries an id').toBe('string');
      const speakerId = created.id as string;
      await moderation.reload();
      await expect(moderation.getByText(H8_SPEAKER_NAME).first()).toBeVisible({ timeout: 30_000 });

      // 2. Capture writes the Redebeitrag of that Wortmeldung first and opens it.
      // The 30 s poll of the page must not fire between the 201 of the second writer and the Enter key below: a hidden page
      // does not poll (`http.ts`). Deterministic instead of a small window (folgeliste, 031a review).
      await page.addInitScript(() => {
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
      });
      await page.goto(`/capture?speaker=${speakerId}`);
      await page.getByTestId('capture-text').fill(H8_CONTRIBUTION_TEXT);
      const captured = page.waitForResponse((candidate) => candidate.request().method() === 'POST' &&
        new URL(candidate.url()).pathname === '/v1/contributions');
      await page.getByTestId('capture-submit').click();
      const capture = (await captured).status();
      expect(capture, `HTTP status of the Redebeitrag (${capture})`).toBe(201);
      // Same reason as above: the desk shows the new Redebeitrag only after a reload in HTTP mode.
      await page.reload();
      const free = page.getByTestId('capture-free-input');
      await expect(free).toBeVisible({ timeout: 30_000 });

      // 3. The second writer is the same capture session: it adds a question with the valid ETag.
      const contributions = (await (await other.get(`/v1/contributions?speakerId=${speakerId}`)).json()) as
        { id: string; version: number }[];
      expect(contributions).toHaveLength(1);
      const accepted = await other.post(`/v1/contributions/${contributions[0]!.id}/questions`, {
        headers: { 'Content-Type': 'application/json', 'If-Match': `"v${contributions[0]!.version}"`,
          'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
        data: JSON.stringify({ questions: [{ text: H8_OTHER_WRITER_QUESTION }] }),
      });
      expect(accepted.status()).toBe(201);

      // 4. The page still holds the old ETag: its write is refused, the banner shows, the text stays.
      const refused = page.waitForResponse((candidate) => candidate.request().method() === 'POST' &&
        new URL(candidate.url()).pathname.endsWith('/questions'));
      await free.fill(H8_UNCONFIRMED_QUESTION);
      await free.press('Enter');
      expect((await refused).status()).toBe(412);
      await expect(page.getByTestId('capture-stale-banner')).toBeVisible();
      await expect(free).toHaveValue(H8_UNCONFIRMED_QUESTION);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('031-http-412.png') });
      assertNoLimit();
    } finally {
      await other.dispose();
      await moderationContext.close();
    }
  });
});

test.describe('H10 @idp: mounting a view loads once (takt-033b)', () => {
  test.use({ storageState: statePath('moderation') });

  test('H10 @idp: one GET /v1/stage and one probe on mount, none after a visibility change', async ({ page }) => {
    const stageReads: string[] = [];
    const probes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') return;
      const url = new URL(request.url());
      if (url.pathname === '/v1/stage') stageReads.push(url.pathname);
      if (url.pathname === '/v1/questions' && url.searchParams.get('limit') === '1') probes.push(url.search);
    });
    await page.goto('/stage');
    await expect(page.getByTestId('stage-only-toggle')).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState('networkidle');
    expect(stageReads, 'GET /v1/stage after the mount').toHaveLength(1);
    expect(probes, 'GET /v1/questions?limit=1 after the mount').toHaveLength(1);

    // A session refresh without an actor change must not reload the views.
    const me = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/auth/me');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await me;
    await page.waitForLoadState('networkidle');
    expect(stageReads, 'GET /v1/stage after the visibility change').toHaveLength(1);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-h10-einhaengen-ein-abruf.png') });
  });
});
