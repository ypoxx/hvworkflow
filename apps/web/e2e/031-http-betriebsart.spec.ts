/**
 * Slice 031a — the HTTP mode of the interface against the real service (Hono, Postgres, Keycloak test realm).
 * H1–H3 need no sign-in and run everywhere; H4–H9 carry `@idp` and need the Keycloak realm (CI only, the local mode
 * `E2E_HTTP_IDP=none` filters them out). `page.route` doubles of this suite: `030-anmeldung.spec.ts`; G1 here (a 429 on the
 * transparency notice); takt-039 H11 (holds one read of the stage) and, with H12a, the answer 503 on `/v1/stream` that keeps
 * both tests in the polling fallback they drive (slice 036b); and H14 (the 503 on `/v1/stream` behind the connection
 * indicator, slice 036b, m5). H13 has none: it measures the real stream.
 *
 * H8 and H9 write only on Wortmeldungen and a Redebeitrag they create themselves. H11 (takt-039) reads out the question
 * that is on stage and so closes one question of the corpus: `abnahme` then needs one "Vorgelesen, weiter" less on its way
 * to its own question. H12 lifts and moves a Wortmeldung and cancels with Esc, so nothing is written. Passwords, cookies
 * and tokens are read from state files and never printed.
 */
import { request } from '@playwright/test';
import type { BrowserContext, Locator, Page, Response, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkAxe } from './support/axe';
import {
  DSFA_SUMMARY_URL, H13_CONTRIBUTION_TEXT, H13_QUESTION, H13_SPEAKER_NAME, H8_CONTRIBUTION_TEXT, H8_OTHER_WRITER_QUESTION,
  H8_SPEAKER_NAME, H8_UNCONFIRMED_QUESTION, NOTICE_DE, NOTICE_EN,
} from './support/e2e-texts';
import { expect, test } from './support/http-guard';
import { liftWithKeyboard } from './support/keyboard-drag';

// Synthetic name, distinct from H8 so that the two tests never find each other's entry.
const H9_SPEAKER_NAME = 'Synthetische Testperson Omega';
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

/**
 * Slice 036b: answers the stream 503 with `Retry-After`, as the service does at its limit. Tests that drive the refresh
 * through the 30 s poll use it, because the poll rests while a stream is open (036b decision 5).
 */
async function refuseStream(page: Page, retryAfter: string): Promise<void> {
  await page.route('**/v1/stream*', (route) => route.fulfill({
    status: 503, headers: { 'Retry-After': retryAfter }, contentType: 'application/problem+json',
    body: JSON.stringify({ status: 503, title: 'Service Unavailable', detail: 'synthetic' }),
  }));
}

test.describe('H1–H3: the interface before any sign-in', () => {
  test.use({ storageState: noState });

  test('H1: the sign-in page comes from the real service, in the empty state', async ({ page }) => {
    // Takt-035: the served page is the production build, not the dev server (which would double mount effects).
    const html = await (await page.request.get('/')).text();
    expect(html, 'no dev client in the served page').not.toContain('/@vite/client');
    expect(html, 'no React refresh preamble in the served page').not.toContain('/@react-refresh');
    const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1]);
    expect(scripts.length, 'the page loads a script').toBeGreaterThan(0);
    for (const src of scripts) expect(src, 'script served from the build output').toMatch(/^\/assets\//);
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
      // The own write refreshes the list by itself (takt-030); the test checks the status of the answer only, never the body.
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
      await expect(moderation.getByText(H8_SPEAKER_NAME).first()).toBeVisible({ timeout: 5_000 });

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
      // The own write refreshes the desk by itself (takt-030); the reload stays until a CI run shows the free field mounts
      // without it and the ETag of the page is still the one before the second writer (folgeliste, takt-030).
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

test.describe('H9 @idp: an own write shows without a reload', () => {
  test.use({ storageState: statePath('moderation') });

  test('H9 @idp: a created Wortmeldung appears in the list without reload and without the 30 s poll', async ({ page }) => {
    await page.goto('/speakers');
    await expect(page.getByTestId('speaker-register')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('speaker-register').click();
    await page.getByTestId('speaker-register-name').fill(H9_SPEAKER_NAME);
    const registered = page.waitForResponse((candidate) => candidate.request().method() === 'POST' &&
      new URL(candidate.url()).pathname === '/v1/speakers');
    await page.getByTestId('speaker-register-submit').click();
    expect((await registered).status()).toBe(201);
    // No reload, no goto: the interface has to refresh itself, far below the 30 s of the poll.
    await expect(page.getByText(H9_SPEAKER_NAME).first()).toBeVisible({ timeout: 5_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-h9-eigene-schreibvorgaenge.png') });
  });
});

test.describe('H10 @idp: mounting a view loads once (takt-033b)', () => {
  test.use({ storageState: statePath('moderation') });

  test('H10 @idp: one GET /v1/stage and one probe per mount, none after a visibility change', async ({ page }) => {
    const stageReads: string[] = [];
    const probes: string[] = [];
    // The http project serves a production build (takt-035, H1 asserts it), where StrictMode does not double the
    // mount effects: exactly one request per mount. The old bug (a bump after mount) would give 2.
    page.on('request', (request) => {
      if (request.method() !== 'GET') return;
      const url = new URL(request.url());
      if (url.pathname === '/v1/stage') stageReads.push(url.pathname);
      if (url.pathname === '/v1/questions' && url.searchParams.get('limit') === '1') probes.push(url.search);
    });
    const reads = traceReads(page);
    await page.goto('/stage');
    await expect(page.getByTestId('stage-only-toggle')).toBeVisible({ timeout: 60_000 });
    // Playwright counts the open stream (036b) as in flight, so `networkidle` never comes: wait for quiet `/v1` reads instead.
    await quiet(reads, 500);
    expect(stageReads, 'GET /v1/stage after the mount').toHaveLength(1);
    expect(probes, 'GET /v1/questions?limit=1 after the mount').toHaveLength(1);

    // A session refresh without an actor change must not reload the views.
    const me = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/auth/me');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await me;
    await quiet(reads, 500);
    expect(stageReads, 'GET /v1/stage after the visibility change').toHaveLength(1);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-h10-einhaengen-ein-abruf.png') });
  });
});

test.describe('H11 @idp: "Vorgelesen, weiter" acts while the stage is being read again (takt-039)', () => {
  test.use({ storageState: statePath('podium') });

  test('H11 @idp: a press during a running GET /v1/stage writes the drawn question and the number moves on', async ({ page }) => {
    // The 30 s poll (`http.ts`) is driven by the installed clock, not waited for.
    await page.clock.install();
    // 036b decision 5: the poll rests while the stream is open; this test drives the refresh through the poll, so it runs in the fallback.
    await refuseStream(page, '30');
    const firstRead = page.waitForResponse((candidate) => candidate.request().method() === 'GET' &&
      new URL(candidate.url()).pathname === '/v1/stage');
    await page.goto('/stage');
    const drawn = ((await (await firstRead).json()) as { current: { id: string; number: string } | null }).current;
    expect(drawn, 'a question is on stage').not.toBeNull();
    const number = page.getByTestId('stage-current-number');
    await expect(number).toHaveText(drawn!.number, { timeout: 60_000 });

    const deliveries: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/delivery')) {
        deliveries.push(new URL(request.url()).pathname);
      }
    });
    // Hold the next read of the stage: the one the poll starts. Only that one; the read after the own write passes.
    // The route is registered (awaited) before the clock moves, or the poll's read could leave unintercepted (review).
    let hold: (route: Route) => void = () => undefined;
    const held = new Promise<Route>((resolve) => { hold = resolve; });
    await page.route('**/v1/stage', (route) => hold(route), { times: 1 });
    await page.clock.fastForward('00:30');
    const read = await held;

    // Befund 1, Punkt 3: the read is on its way, the podium still shows its question and a free button.
    await expect(number).toHaveText(drawn!.number);
    const next = page.getByTestId('stage-next');
    await expect(next).not.toHaveAttribute('aria-disabled', 'true');
    await next.click();
    await read.continue();
    await expect(number).not.toHaveText(drawn!.number);
    expect(deliveries, 'POST …/delivery of the drawn question').toEqual([`/v1/questions/${drawn!.id}/delivery`]);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-h11-buehne-waehrend-lesung.png') });
  });
});

/** The scrolling ancestor of an element (the shell's `main`), as a box in viewport coordinates. */
async function scrollBox(row: Locator): Promise<{ top: number; bottom: number; scrollTop: number }> {
  return row.evaluate((element) => {
    let box: HTMLElement | null = element.parentElement;
    while (box !== null && !(box.scrollHeight > box.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(box).overflowY))) {
      box = box.parentElement;
    }
    const scroller = box ?? document.documentElement;
    const rect = scroller.getBoundingClientRect();
    return { top: rect.top, bottom: Math.min(rect.bottom, window.innerHeight), scrollTop: scroller.scrollTop };
  });
}

/** Middle of a row in viewport coordinates. */
async function middleOf(row: Locator): Promise<number> {
  return row.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
}

/**
 * Lift the second-to-last waiting Wortmeldung of round 3 with the space bar (as in 002) and return what is needed for one
 * step down: the announcer, the position and count from the lift announcement, and where the target row lies. The corpus
 * state here is the one 002, 021b, 021c, H8 and H9 leave behind, so the position is read, not assumed.
 */
async function liftSecondToLast(page: Page): Promise<{
  announcer: Locator; position: number; count: number; targetMiddle: number; box: { top: number; bottom: number; scrollTop: number };
}> {
  await page.goto('/speakers');
  const round = page.getByTestId('speakers-round-3');
  await expect(round).toBeVisible({ timeout: 60_000 });
  const waiting = round.locator('[data-testid="speaker-row"][data-status="waiting"]');
  await expect(waiting.nth(1)).toBeVisible();
  const total = await waiting.count();
  const lifted = waiting.nth(total - 2);
  const target = waiting.nth(total - 1);
  const announcer = page.locator('[role="status"][aria-live="assertive"]');
  const number = (await lifted.getAttribute('data-number')) ?? '';
  await lifted.getByTestId('speaker-drag-handle').focus();
  // The lift is announced ("angehoben, Position p von n"), and dnd-kit follows at once with the row over itself ("steht
  // auf Position p von n"): both name the same position. The helper hands over once the sensor listens for the arrows.
  const announced = await liftWithKeyboard(page, announcer, number);
  const [, position, count] = announced.match(/Position (\d+) von (\d+)/) ?? [];
  const box = await scrollBox(target);
  return { announcer, position: Number(position), count: Number(count), targetMiddle: await middleOf(target), box };
}

test.describe('H12 @idp: moving a Wortmeldung with the keyboard (takt-039, decides the cause of 002)', () => {
  test.use({ storageState: statePath('moderation') });

  test.describe('H12a: after a refresh of the list, target in the upper half', () => {
    // A tall window keeps the target in the upper half of the scrolling area, so that (a) sees the refresh alone and not
    // the scroll branch of the keyboard sensor that (b) looks at (spec, Befund 2).
    test.use({ viewport: { width: 1440, height: 2000 } });

    test('H12a @idp: the 30 s poll lands between lifting and ArrowDown, the arrow still moves', async ({ page }) => {
      await page.clock.install();
      // 036b decision 5: the poll rests while the stream is open; this test drives the refresh through the poll, so it runs in the fallback.
      await refuseStream(page, '30');
      const { announcer, position, count, targetMiddle, box } = await liftSecondToLast(page);
      console.log(`[H12a] lifted at ${position}/${count}; target middle ${targetMiddle.toFixed(0)}, box ${box.top.toFixed(0)}–${box.bottom.toFixed(0)}, scrollTop ${box.scrollTop}`);
      expect(targetMiddle, 'target in the upper half of the scrolling area').toBeLessThan((box.top + box.bottom) / 2);

      // The poll refreshes the list: `readStableSpeakerList` reads meeting, speakers, meeting. Its end is the answer of
      // the meeting read that starts after the answer of the speakers read.
      const refreshed = new Promise<Response>((resolve) => {
        let speakersAnswered = false;
        let closingRead: unknown = null;
        page.on('response', (response) => {
          const path = new URL(response.url()).pathname;
          if (response.request().method() !== 'GET') return;
          if (path === '/v1/speakers') speakersAnswered = true;
          else if (path === '/v1/meeting' && response.request() === closingRead) resolve(response);
        });
        page.on('request', (request) => {
          if (speakersAnswered && closingRead === null && request.method() === 'GET' &&
            new URL(request.url()).pathname === '/v1/meeting') closingRead = request;
        });
      });
      await page.clock.fastForward('00:30');
      await (await refreshed).finished();

      await page.keyboard.press('ArrowDown');
      try {
        await expect(announcer).toContainText(`steht auf Position ${position + 1} von ${count}`);
      } finally {
        const after = await scrollBox(page.getByTestId('speakers-round-3'));
        console.log(`[H12a] after ArrowDown: scrollTop ${after.scrollTop}; announcer "${await announcer.innerText()}"`);
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('031-h12-umsortieren-nach-auffrischung.png') });
      await page.keyboard.press('Escape');
      await expect(announcer).toContainText('Verschieben abgebrochen');
    });
  });

  test.describe('H12b: without a refresh, target in the lower half', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('H12b @idp: ArrowDown moves to a target in the lower half of the scrolling area', async ({ page }) => {
      const { announcer, position, count, targetMiddle, box } = await liftSecondToLast(page);
      console.log(`[H12b] lifted at ${position}/${count}; target middle ${targetMiddle.toFixed(0)}, box ${box.top.toFixed(0)}–${box.bottom.toFixed(0)}, scrollTop ${box.scrollTop}`);
      expect(targetMiddle, 'target in the lower half of the scrolling area').toBeGreaterThan((box.top + box.bottom) / 2);

      await page.keyboard.press('ArrowDown');
      try {
        await expect(announcer).toContainText(`steht auf Position ${position + 1} von ${count}`);
      } finally {
        const after = await scrollBox(page.getByTestId('speakers-round-3'));
        console.log(`[H12b] after ArrowDown: scrollTop ${after.scrollTop}; announcer "${await announcer.innerText()}"`);
      }
      await page.keyboard.press('Escape');
      await expect(announcer).toContainText('Verschieben abgebrochen');
    });
  });
});


// ---- slice 036b: the stream in a second browser, and the connection indicator ----------------------------------------

interface TracedRequest { method: string; path: string; params: string; at: number }

/** Records the reads of a page on `/v1` (the stream itself excluded): method, path, the names of the query parameters. */
function traceReads(page: Page): { list: TracedRequest[]; lastAt: () => number } {
  const list: TracedRequest[] = [];
  let lastAt = Date.now();
  page.on('request', (candidate) => {
    const url = new URL(candidate.url());
    if (!url.pathname.startsWith('/v1/') || url.pathname === '/v1/stream') return;
    lastAt = Date.now();
    list.push({ method: candidate.method(), path: url.pathname, params: [...url.searchParams.keys()].join(','), at: lastAt });
  });
  return { list, lastAt: () => lastAt };
}

/** Waits until the page has sent no read for `ms` (at most 15 s). */
async function quiet(trace: { lastAt: () => number }, ms: number): Promise<void> {
  const until = Date.now() + 15_000;
  while (Date.now() - trace.lastAt() < ms) {
    if (Date.now() > until) throw new Error('The page did not come to rest.');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The GET list of a window as a table for the report (no query values, SC-11). */
function printTable(label: string, from: number, reads: readonly TracedRequest[]): void {
  console.log(`[H13] ${label}: ${reads.length} request(s) in A`);
  console.log('[H13] | method | path | query parameters | +ms |');
  for (const entry of reads) console.log(`[H13] | ${entry.method} | ${entry.path} | ${entry.params || '-'} | ${entry.at - from} |`);
}

/** The key of a read: path plus parameter names and values, as the live store keys it (values stay out of the output). */
const readKey = (entry: TracedRequest): string => `${entry.method} ${entry.path}?${entry.params}`;

test.describe('H13 @idp: a second browser sees a change in under 2 s (slice 036b)', () => {
  test('H13 @idp: A sees what B writes in under 2 s and reads only the touched keys', async ({ browser }) => {
    const aContext = await browser.newContext({ baseURL: origin, storageState: statePath('capture') });
    const bContext = await browser.newContext({ baseURL: origin, storageState: statePath('moderation') });
    const limitsA = watchLimits(aContext);
    const limitsB = watchLimits(bContext);
    const cookieOf = (key: string): string =>
      (JSON.parse(readFileSync(statePath(key), 'utf8')) as { cookies: { name: string; value: string }[] })
        .cookies.find((entry) => entry.name === 'hv_session')?.value ?? '';
    const captureApi = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `hv_session=${cookieOf('capture')}` } });
    const coordinationApi = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Cookie: `hv_session=${cookieOf('coordination')}` } });
    const csrfOf = async (api: typeof captureApi): Promise<string> =>
      ((await (await api.get('/auth/me')).json()) as { csrfToken: string }).csrfToken;
    const writeHeaders = (csrf: string, etag: string) => ({
      'Content-Type': 'application/json', 'If-Match': etag, 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID(),
    });
    try {
      const a = await aContext.newPage();
      const b = await bContext.newPage();
      const streamOpen = a.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/v1/stream' && candidate.status() === 200);
      await a.goto('/speakers');
      await streamOpen;
      await expect(a.getByTestId('speaker-row').first()).toBeVisible({ timeout: 60_000 });
      await b.goto('/speakers');
      await expect(b.getByTestId('speaker-register')).toBeVisible({ timeout: 60_000 });
      const trace = traceReads(a);
      await quiet(trace, 1_500);

      // Step 1a: B registers a Wortmeldung; A (capture, `speaker.read`) sees the row.
      await b.getByTestId('speaker-register').click();
      await b.getByTestId('speaker-register-name').fill(H13_SPEAKER_NAME);
      const registered = b.waitForResponse((candidate) => candidate.request().method() === 'POST' &&
        new URL(candidate.url()).pathname === '/v1/speakers');
      await b.getByTestId('speaker-register-submit').click();
      const registration = await registered;
      const registeredAt = Date.now();
      expect(registration.status()).toBe(201);
      const created = (await registration.json()) as { id: string; number: string | number };
      const rowInA = a.locator(`[data-testid="speaker-row"][data-number="${String(created.number)}"]`);
      await expect(rowInA).toBeVisible({ timeout: 5_000 });
      const registerMs = Date.now() - registeredAt;
      await quiet(trace, 1_000);
      const registerWindow = trace.list.filter((entry) => entry.at >= registeredAt);

      // Step 1b: B calls it; A sees it at the microphone. Calling may first end a running speech (one write more).
      const rowInB = b.locator(`[data-testid="speaker-row"][data-number="${String(created.number)}"]`);
      const patches: string[] = [];
      b.on('request', (candidate) => {
        if (candidate.method() === 'PATCH' && new URL(candidate.url()).pathname.startsWith('/v1/speakers/')) patches.push(candidate.url());
      });
      const calledResponse = b.waitForResponse((candidate) => candidate.request().method() === 'PATCH' &&
        new URL(candidate.url()).pathname === `/v1/speakers/${created.id}`);
      const callStart = Date.now();
      await rowInB.getByTestId('speaker-call').click();
      expect((await calledResponse).status()).toBe(200);
      const calledAt = Date.now();
      await expect(rowInA).toHaveAttribute('data-status', 'speaking', { timeout: 5_000 });
      const callMs = Date.now() - calledAt;
      await quiet(trace, 1_000);
      const callWindow = trace.list.filter((entry) => entry.at >= callStart);

      console.log(`[H13] delivery: registration ${registerMs} ms, call ${callMs} ms (from the write's answer in B to the view in A)`);
      printTable('step 1a (registration)', registeredAt, registerWindow);
      printTable(`step 1b (call, ${patches.length} write(s))`, callStart, callWindow);
      expect(registerMs, 'registration visible in A').toBeLessThan(2_000);
      expect(callMs, 'call visible in A').toBeLessThan(2_000);
      const forbidden = ['/v1/questions', '/v1/contributions', '/v1/stage'];
      for (const [label, window, writes] of [['registration', registerWindow, 1], ['call', callWindow, patches.length]] as const) {
        const gets = window.filter((entry) => entry.method === 'GET');
        expect(gets.filter((entry) => forbidden.includes(entry.path)).map(readKey), `${label}: no read outside the touched keys`).toEqual([]);
        const perKey = new Map<string, number>();
        for (const entry of gets) perKey.set(readKey(entry), (perKey.get(readKey(entry)) ?? 0) + 1);
        // One read per touched key and per write (the live store reads once per batch; a call may be two writes).
        for (const [key, count] of perKey) expect(count, `${label}: reads of ${key}`).toBeLessThanOrEqual(writes);
      }

      // Step 2: a question of its own (capture, third context), then coordination classifies exactly that one.
      const captureCsrf = await csrfOf(captureApi);
      const speaker = (await (await captureApi.get(`/v1/speakers/${created.id}`)).json()) as { version: number };
      // takt-044: the capture invalidates A's speaker list; that read must land before the classification window opens.
      // Registered before the writes so that a fast delivery is not missed (`quiet` alone measures from A's last read).
      // Settled to a boolean at once, so an earlier failing step leaves no unhandled rejection behind.
      const captureSeenInA = a.waitForResponse(async (candidate) => {
        if (candidate.request().method() !== 'GET' || new URL(candidate.url()).pathname !== '/v1/speakers' || candidate.status() !== 200) return false;
        const rows = (await candidate.json()) as { id: string; questionCount?: number }[];
        return rows.some((row) => row.id === created.id && (row.questionCount ?? 0) >= 1);
      }, { timeout: 5_000 }).then(() => true, () => false);
      const contribution = await captureApi.post('/v1/contributions', {
        headers: writeHeaders(captureCsrf, `"v${speaker.version}"`),
        data: JSON.stringify({ speakerId: created.id, text: H13_CONTRIBUTION_TEXT, source: 'manual' }),
      });
      expect(contribution.status()).toBe(201);
      const written = (await contribution.json()) as { id: string; version: number };
      const captured = await captureApi.post(`/v1/contributions/${written.id}/questions`, {
        headers: writeHeaders(captureCsrf, `"v${written.version}"`),
        data: JSON.stringify({ questions: [{ text: H13_QUESTION }] }),
      });
      expect(captured.status()).toBe(201);
      const question = ((await captured.json()) as { id: string; version: number }[])[0]!;
      if (!(await captureSeenInA)) throw new Error('A hat die Erfassung nicht gelesen');
      await quiet(trace, 1_500);

      const classifyStart = Date.now();
      const classified = await coordinationApi.post(`/v1/questions/${question.id}/classification`, {
        headers: writeHeaders(await csrfOf(coordinationApi), `"v${question.version}"`),
        data: JSON.stringify({ track: 'fast_track' }),
      });
      expect(classified.status()).toBe(200);
      // A reacts to the counters (meeting) if at all; give it the time of a delivery, then wait for rest.
      await a.waitForRequest((candidate) => new URL(candidate.url()).pathname === '/v1/meeting', { timeout: 3_000 }).catch(() => undefined);
      await quiet(trace, 1_000);
      const classifyWindow = trace.list.filter((entry) => entry.at >= classifyStart);
      printTable('step 2 (classification)', classifyStart, classifyWindow);
      expect(classifyWindow.filter((entry) => entry.method === 'GET' && ['/v1/speakers', '/v1/contributions'].includes(entry.path))
        .map(readKey), 'no speaker or contribution read after a classification').toEqual([]);

      await a.evaluate(() => document.fonts.ready);
      await a.screenshot({ path: evidence('031-h13-zweiter-browser.png') });
      limitsA();
      limitsB();
    } finally {
      await captureApi.dispose();
      await coordinationApi.dispose();
      await aContext.close();
      await bContext.close();
    }
  });
});

test.describe('H14 @idp: the connection indicator (slice 036b)', () => {
  test.use({ storageState: statePath('capture') });

  test('H14 @idp: a refused stream shows the fallback, the released one hides the indicator', async ({ page }) => {
    // The second documented `page.route` double of this suite for 036b (m5): the service answers the stream 503.
    await refuseStream(page, '1');
    await page.goto('/speakers');
    const indicator = page.getByTestId('connection-status');
    await expect(indicator).toHaveAttribute('data-phase', 'polling', { timeout: 60_000 });
    await expect(indicator).toContainText('Rückfall');
    await expect(indicator).toContainText('Stand von');
    await expect(indicator).toHaveAttribute('role', 'status');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('031-h14-verbindungsanzeige.png') });

    const opened = page.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/v1/stream' && candidate.status() === 200);
    await page.unroute('**/v1/stream*');
    await opened;
    await expect(indicator).toHaveAttribute('data-phase', 'live', { timeout: 10_000 });
    await expect(indicator).toHaveText('');
  });
});
