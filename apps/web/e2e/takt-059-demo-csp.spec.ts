/**
 * Takt-059 — Content-Security-Policy and no source maps for the public demo (docs/slices/takt-059-demo-csp.md; threat model
 * BF-06, BF-25; reviewer checklist SP-4).
 *
 * Runs only in the project `demo-build` (`E2E_DEMO_BUILD=1`, `playwright.config.ts`): the demo mode built with `vite build`
 * and served by `vite preview`. Never the dev server, which injects inline scripts (React refresh, HMR client) and would
 * need `'unsafe-inline'`. `vite preview` sends no CSP of its own, so every document response here gets the header values
 * Netlify sends for `/*`, read from `netlify.toml` (one source, nothing copied into this file).
 *
 * D1 walks the core views with the role switcher (Rollenwechsel), the language switch (Sprachwechsel), the keyboard
 *    shortcuts dialog (Tastaturkürzel), one submitted form (a Wortmeldung) and the highlight of the answer field (toolbar in
 *    Beantwortung, Ctrl+Shift+H in the Schreibmodus), which must be painted; it requires zero `securitypolicyviolation`
 *    events and zero console errors.
 * D2 proves that the policy is in force: an inline script and a `<style>` element inserted through `page.evaluate` take no
 *    effect and cause exactly one violation each, and string evaluation (`eval`) is refused with exactly one more. It also
 *    reads the policy text: the four `'none'` directives are there, and nothing but `'self'`/`'none'` except the one
 *    relaxation `style-src-attr 'unsafe-inline'`.
 * D3 proves that the build holds no `.map` file and no `sourceMappingURL` comment.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { CORPUS_DEMO } from '@hv/domain';
import type { ConsoleMessage, Locator, Page } from '@playwright/test';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

// `support/node-fs.d.ts` (not a file of this takt) declares only what earlier files need; D3 also lists a directory.
declare module 'node:fs' {
  interface Dirent { readonly name: string; readonly parentPath: string; isFile(): boolean }
  export function readdirSync(path: string, options: { recursive: true; withFileTypes: true }): Dirent[];
}

test.use({ viewport: { width: 1440, height: 900 } });

/** Synthetic texts for the writes of D1 (AGENTS.md R11); each highlighted word occurs once in its field. */
const SPEAKER_NAME = 'Probe Neunundfünfzig';
const HIGHLIGHT_ANSWERS = 'Gelbprobe';
const HIGHLIGHT_WRITING = 'Schreibprobe';

/**
 * The header values of the `[[headers]]` table whose `for` is `"/*"`. A deliberately small reader for the shape of
 * `netlify.toml`, not a TOML parser: inside a `[[headers]]` table it accepts only `key = "value"` lines without escapes and
 * fails on anything else, so a policy it cannot read never turns into a run without a policy.
 */
function netlifyHeaders(): Readonly<Record<string, string>> {
  const file = `${test.info().project.testDir}/../../../netlify.toml`;
  const blocks: { for?: string; values: Record<string, string> }[] = [];
  let table = '';
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const header = /^\[\[?([^[\]]+)\]\]?$/.exec(line);
    if (header) {
      table = header[1] ?? '';
      if (line === '[[headers]]') blocks.push({ values: {} });
      continue;
    }
    if (table !== 'headers' && table !== 'headers.values') continue;
    const pair = /^([A-Za-z][A-Za-z0-9-]*)\s*=\s*"([^"\\]*)"$/.exec(line);
    const block = blocks.at(-1);
    if (!pair || !block || (table === 'headers' && pair[1] !== 'for')) {
      throw new Error(`netlify.toml: line in [[headers]] not understood: ${line}`);
    }
    const [, key = '', value = ''] = pair;
    if (table === 'headers') block.for = value;
    else block.values[key] = value;
  }
  const matching = blocks.filter((block) => block.for === '/*');
  if (matching.length !== 1 || !matching[0]) throw new Error(`netlify.toml: expected one [[headers]] for "/*", found ${matching.length}.`);
  return matching[0].values;
}

function netlifyCsp(): string {
  const csp = netlifyHeaders()['Content-Security-Policy'];
  if (!csp) throw new Error('netlify.toml: the [[headers]] table for "/*" has no Content-Security-Policy.');
  return csp;
}

/**
 * The one relaxation against `'self'`/`'none'` (review of takt-059, orchestrator's decision): the highlight of the answer
 * field is the browser's `execCommand('hiliteColor')`, which writes a `style` attribute. Style attributes run no script,
 * `url()` in them still meets `img-src`/`font-src 'self'`, `<style>` elements stay blocked (D2).
 */
const RELAXATIONS: Readonly<Record<string, readonly string[]>> = { 'style-src-attr': ["'unsafe-inline'"] };

interface Violation { directive: string; blocked: string }
interface Findings { violations: Violation[]; errors: string[] }

/**
 * `vite preview` answers the browser's own `/favicon.ico` request with 404 (no SPA fallback for a path with an extension);
 * Netlify answers it with 200 through the `/*` rule, and the interface never asks for it. Exactly that message is no finding.
 */
function isFavicon404(message: ConsoleMessage): boolean {
  return message.location().url.endsWith('/favicon.ico') &&
    message.text().startsWith('Failed to load resource: the server responded with a status of 404');
}

/** Collects CSP violations (through a binding, so nothing is lost on a reload) and console errors of the page. */
async function watch(page: Page): Promise<Findings> {
  const violations: Violation[] = [];
  const errors: string[] = [];
  await page.exposeBinding('__takt059Violation', (_source, violation: Violation) => { violations.push(violation); });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __takt059Violation: (violation: Violation) => void }).__takt059Violation;
      report({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  });
  page.on('console', (message) => { if (message.type() === 'error' && !isFavicon404(message)) errors.push(message.text()); });
  page.on('pageerror', (error) => { errors.push(`pageerror: ${error.message}`); });
  return { violations, errors };
}

test.beforeEach(async ({ page }) => {
  const headers = Object.entries(netlifyHeaders()).map(([name, value]) => [name.toLowerCase(), value] as const);
  // As Netlify does for `/*`; documents only, because the policy of a page comes from its document response.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), ...Object.fromEntries(headers) } });
  });
});

/**
 * Lets late reports arrive before a check: two animation frames and a task turn in the page (a violation event is a queued
 * task, its binding call reaches the test before the answer to this evaluation), then up to 300 ms that any report ends.
 */
async function settle(page: Page, findings: Findings): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }));
  const until = Date.now() + 300;
  await expect.poll(() => findings.violations.length + findings.errors.length > 0 || Date.now() >= until, { intervals: [50] })
    .toBe(true);
}

/** The highlighted word carries the highlight's `style` attribute and the browser really paints it (not transparent). */
async function expectHighlightPainted(field: Locator, word: string): Promise<void> {
  const span = field.locator('span[style*="background-color"]').filter({ hasText: word });
  await expect(span).toHaveText(word);
  await expect.poll(() => span.evaluate((el) => getComputedStyle(el).backgroundColor), { message: `painted background of ${word}` })
    .not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
}

const heading = (page: Page, title: string) => page.getByRole('heading', { level: 1, name: title, exact: true });

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

/** Opens a view through the navigation and waits for its title; a refused read state must not be what it shows. */
async function openView(page: Page, navTestId: string, path: string, title: string, forbiddenTestId?: string): Promise<void> {
  await page.getByTestId(navTestId).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(heading(page, title)).toBeVisible();
  if (forbiddenTestId !== undefined) await expect(page.getByTestId(forbiddenTestId)).toHaveCount(0);
}

test.describe('takt-059 CSP of the demo build', () => {
  test('D1 core views, role switch, language switch, shortcuts dialog, one form and the highlight: zero violations, zero console errors @screenshot', async ({ page }) => {
    const findings = await watch(page);
    const clean = async (where: string): Promise<void> => {
      await settle(page, findings);
      expect(findings.violations, `CSP violations up to ${where}`).toEqual([]);
      expect(findings.errors, `console errors up to ${where}`).toEqual([]);
    };

    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy']).toBe(netlifyCsp());
    // Wortmeldungen as the capture desk, the demo's first person.
    await expect(page).toHaveURL(/\/speakers$/);
    await waitForCorpus(page);
    await expect(page.getByTestId('speaker-row').first()).toBeVisible();
    await expect(heading(page, 'Wortmeldungen')).toBeVisible();
    await clean('speakers');
    await openView(page, 'nav-capture', '/capture', 'Erfassung', 'capture-forbidden');
    await openView(page, 'nav-history', '/history', 'Historie & Suche', 'history-forbidden');
    await clean('capture, history');

    await asRole(page, 'coordination');
    await openView(page, 'nav-steering', '/steering', 'Steuerung', 'steering-forbidden');
    await openView(page, 'nav-cockpit', '/cockpit', 'Leitstand');
    await expect(page.getByTestId('cockpit-page')).toBeVisible();
    await clean('steering, cockpit');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: evidence('takt-059-demo-csp.png') });
    await openView(page, 'nav-answers', '/answers', 'Beantwortung');

    // Beantwortung with an open question, so the editor renders; a word highlighted through the toolbar is painted.
    await asRole(page, 'expert');
    await page.getByTestId('answers-filter-status-assigned').click();
    await page.getByTestId('answers-row').first().click();
    await expect(page.getByTestId('answers-detail')).toBeVisible();
    const drafted = (await page.getByTestId('answers-detail-number').innerText()).trim();
    const answerField = page.getByTestId('answer-editor');
    await answerField.focus();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(` ${HIGHLIGHT_ANSWERS}`);
    await page.keyboard.press('Control+Shift+ArrowLeft');
    await page.getByTestId('format-highlight').click();
    await expectHighlightPainted(answerField, HIGHLIGHT_ANSWERS);
    await clean('answers, highlight from the toolbar');

    // Meine Fragen: the Schreibmodus (writing mode) of another own assigned question (the draft above would carry its
    // highlight to the end of the field), Ctrl+Shift+H, then Escape (the text stays an unsaved draft, nothing is written).
    await openView(page, 'nav-focus', '/my', 'Meine Fragen', 'focus-forbidden');
    const own = page.locator(`[data-testid="focus-row"][data-status="assigned"]:not([data-returned]):not([data-number="${drafted}"])`)
      .filter({ hasNot: page.getByTestId('focus-row-refusal') }).first();
    await own.dblclick();
    await expect(page.getByTestId('focus-writing')).toBeVisible();
    const writingField = page.getByTestId('focus-editor');
    await expect(writingField).toBeFocused();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(` ${HIGHLIGHT_WRITING}`);
    await page.keyboard.press('Control+Shift+ArrowLeft');
    await page.keyboard.press('Control+Shift+H');
    await expectHighlightPainted(writingField, HIGHLIGHT_WRITING);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('focus-writing')).toHaveCount(0);
    await clean('my questions, Ctrl+Shift+H in the writing mode');

    // The expert does not read the stage; the podium does, and the view turns from its refused state into the stage.
    await page.getByTestId('nav-stage').click();
    await expect(page).toHaveURL(/\/stage$/);
    await asRole(page, 'podium');
    await expect(heading(page, 'Bühne')).toBeVisible();
    await expect(page.getByTestId('stage-forbidden')).toHaveCount(0);
    await clean('stage');

    await asRole(page, 'admin');
    await openView(page, 'nav-admin', '/admin', 'Verwaltung');
    await clean('admin');

    await page.getByTestId('lang-option-en').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(heading(page, 'Administration')).toBeVisible();
    await openView(page, 'nav-cockpit', '/cockpit', 'Cockpit');
    await page.getByTestId('lang-option-de').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await clean('language switch');

    await page.getByRole('button', { name: 'Tastaturkürzel' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await clean('shortcuts dialog');

    // One form sent under `form-action 'none'`: the interface handles every submit itself, nothing navigates.
    await asRole(page, 'moderation');
    await openView(page, 'nav-speakers', '/speakers', 'Wortmeldungen');
    await page.getByTestId('speaker-register').click();
    await page.getByTestId('speaker-register-name').fill(SPEAKER_NAME);
    await page.getByTestId('speaker-register-submit').click();
    await expect(page.getByText(SPEAKER_NAME)).toBeVisible();
    await expect(page).toHaveURL(/\/speakers$/);
    await clean('speaker registration');
  });

  test('D2 the policy is in force: inline script, style element and eval are refused, one violation each; the text holds', async ({ page }) => {
    // The text itself: no unsafe source and no foreign host may slip into the policy unnoticed, the one relaxation is exactly
    // `RELAXATIONS`, and the four directives without a fallback to `default-src` (or with `'none'` by intent) are present.
    const parts = netlifyCsp().split(';').map((part) => part.trim()).filter((part) => part !== '');
    const directives = new Map(parts.map((part) => {
      const [name = '', ...sources] = part.split(/\s+/);
      return [name, sources] as const;
    }));
    expect(directives.size, 'no directive twice').toBe(parts.length);
    for (const [name, sources] of directives) {
      const relaxed = RELAXATIONS[name];
      if (relaxed !== undefined) expect(sources, name).toEqual(relaxed);
      else expect(sources.filter((source) => source !== "'self'" && source !== "'none'"), name).toEqual([]);
    }
    for (const name of ['frame-ancestors', 'base-uri', 'form-action', 'object-src']) expect(directives.get(name), name).toEqual(["'none'"]);
    expect(directives.get('script-src'), 'script-src').toEqual(["'self'"]);
    expect(directives.get('style-src'), 'style-src').toEqual(["'self'"]);

    const { violations, errors } = await watch(page);
    await page.goto('/speakers');
    await waitForCorpus(page);
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);

    const inlineRan = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__takt059Inline = true;';
      document.head.append(script);
      return (window as unknown as { __takt059Inline?: boolean }).__takt059Inline === true;
    });
    expect(inlineRan, 'the inline script ran').toBe(false);
    await expect.poll(() => violations.length).toBe(1);
    expect(violations[0]).toEqual({ directive: 'script-src-elem', blocked: 'inline' });
    // The browser reports the refusal on the console as well: the console check of D1 would see it too.
    await expect.poll(() => errors.filter((error) => error.includes('Content Security Policy')).length).toBe(1);

    // A `<style>` element stays blocked (`style-src 'self'`); only style attributes are relaxed.
    const styleApplied = await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = ':root { --takt059-probe: applied; }';
      document.head.append(style);
      return getComputedStyle(document.documentElement).getPropertyValue('--takt059-probe').trim() !== '';
    });
    expect(styleApplied, 'the style element took effect').toBe(false);
    await expect.poll(() => violations.length).toBe(2);
    expect(violations[1]).toEqual({ directive: 'style-src-elem', blocked: 'inline' });

    // DevTools lets string evaluation through while its own evaluation runs (`allowUnsafeEvalBlockedByCSP`), so the eval
    // runs in a timer task of the page, after `page.evaluate` has returned.
    const evalResult = await page.evaluate(() => new Promise<string>((resolve) => {
      setTimeout(() => {
        try {
          // eslint-disable-next-line no-eval -- the refused string evaluation is what this step proves
          resolve(String((0, eval)('1 + 1')));
        } catch (error) {
          resolve(error instanceof EvalError ? 'refused' : `other error: ${String(error)}`);
        }
      }, 0);
    }));
    expect(evalResult).toBe('refused');
    await expect.poll(() => violations.length).toBe(3);
    expect(violations[2]).toEqual({ directive: 'script-src', blocked: 'eval' });
  });

  test('D3 the demo build holds no source map and no sourceMappingURL comment', async () => {
    const root = process.env['E2E_DEMO_BUILD_DIR'];
    if (!root) throw new Error('E2E_DEMO_BUILD_DIR is not set: run with E2E_DEMO_BUILD=1 (playwright.config.ts).');
    // The build always lies in the fixed leaf `web-build` below the directory (playwright.config.ts).
    const dir = `${root}/web-build`;
    const files = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => `${entry.parentPath}/${entry.name}`);
    // Not vacuous: the build is there, with its document and at least one script.
    expect(files.some((file) => file.endsWith('/index.html'))).toBe(true);
    expect(files.filter((file) => file.endsWith('.js')).length).toBeGreaterThan(0);
    expect(files.filter((file) => file.endsWith('.map')), '.map files').toEqual([]);
    const withComment = files
      .filter((file) => /\.(js|css|html)$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes('sourceMappingURL'));
    expect(withComment, 'files with a sourceMappingURL comment').toEqual([]);
  });
});
