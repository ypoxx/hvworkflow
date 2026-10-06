/**
 * Scheibe 060 — Entwurfspuffer der Antwortansichten und Fassungsvergleich (docs/slices/060-entwurfspuffer-praesenz.md).
 *
 * The unsaved answer draft of the Beantwortung and of the writing mode lives in this browser (IndexedDB, per actor and
 * meeting, 14 h) and comes back after a reload, a closed tab, a lost connection and a new sign-in of the same person; it
 * never reaches another person (role switch, sign-out, no role, `forbidden`). A newer foreign version over changed text
 * opens "Fassungen vergleichen" instead of being overwritten (412 and live).
 *
 * Runs in both projects (E1, E2, E3, E5, E8); E4, E6, E9 only `in-process` (they reach into the running API or the object
 * store with the module's own constants), E5b and E7 only `http`. Roles are switched only here (test helpers may,
 * AGENTS.md R4); which question is taken is read off `_actions` through the buttons the views offer.
 *
 * End state in `http` (path order: after 055b, before 080 and abnahme): E1, E3 and E8 each write versions to
 * `answer_drafted` questions of Finanzen (status stays `answer_drafted`); E7 writes one version as legal and one as the
 * expert to one such question. Nothing else changes; 080 touches only speakers and abnahme brings its own question.
 */
import type { Browser, Locator, Page } from '@playwright/test';
import { CORPUS_DEMO } from '@hv/domain';
import { BUFFER_DATABASE, BUFFER_OBJECT_STORE } from '../src/api/draftBuffer';
import { checkAxe } from './support/axe';
import {
  DRAFT_060_COMPARE_MINE, DRAFT_060_OFFLINE, DRAFT_060_OTHER, DRAFT_060_SAVED, DRAFT_060_TYPED,
} from './support/e2e-texts';
import { evidence } from './support/evidence';
import { waitForMine } from './support/focus-list';
import { expect, test } from './support/http-guard';
import { asRole, newContextAs } from './support/roles';

test.use({ viewport: { width: 1440, height: 900 } });

const API_MODULE = '/src/api/index.ts';
const EXPERT_UNIT_ID = 'unit-fin';
const isHttp = (): boolean => test.info().project.name === 'http';
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^(Meldung schließen|Close the message)$/ });
  for (let open = await close.count(); open > 0; open = await close.count()) await close.first().click();
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

/** Every row of the object store, read with the module's own constants (no second literal, decision 1). */
async function readBuffer(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(([database, objectStore]) => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const open = indexedDB.open(database!);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(objectStore!)) open.result.createObjectStore(objectStore!, { keyPath: 'id' });
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(objectStore!)) { db.close(); resolve([]); return; }
      const request = db.transaction(objectStore!, 'readonly').objectStore(objectStore!).getAll();
      request.onsuccess = () => { db.close(); resolve(request.result as Record<string, unknown>[]); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  }), [BUFFER_DATABASE, BUFFER_OBJECT_STORE] as const);
}

async function writeBuffer(page: Page, row: Record<string, unknown>): Promise<void> {
  await page.evaluate(([database, objectStore, value]) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(database as string);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(objectStore as string, 'readwrite');
      tx.objectStore(objectStore as string).put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), [BUFFER_DATABASE, BUFFER_OBJECT_STORE, row] as const);
}

/** Counts the calls of one `HvApi` method in the running in-process API. */
async function countCalls(page: Page, method: string): Promise<void> {
  await page.evaluate(([url, name]) => import(/* @vite-ignore */ url!).then((module: { api: Record<string, (...args: unknown[]) => unknown> }) => {
    const w = window as unknown as { __s060: Record<string, number> };
    w.__s060 = { ...(w.__s060 ?? {}), [name!]: 0 };
    const original = module.api[name!]!.bind(module.api);
    module.api[name!] = (...args: unknown[]) => {
      w.__s060[name!] = (w.__s060[name!] ?? 0) + 1;
      return original(...args);
    };
  }), [API_MODULE, method]);
}
const callsOf = (page: Page, method: string): Promise<number> =>
  page.evaluate((name) => (window as unknown as { __s060: Record<string, number> }).__s060[name] ?? 0, method);

/**
 * E6: the next `draftAnswer` first writes a differing version of the same question (the same person in a "second
 * window", so `If-Match` still fits), then refuses with 412 — the record moved under the click.
 */
async function conflictOnNextSave(page: Page, otherText: string): Promise<void> {
  await page.evaluate(([url, text]) => import(/* @vite-ignore */ url!).then((module: {
    api: { draftAnswer: (id: string, input: unknown, options?: unknown) => Promise<unknown> };
  }) => {
    const original = module.api.draftAnswer.bind(module.api);
    let armed = true;
    module.api.draftAnswer = async (id, input, options) => {
      if (!armed) return original(id, input, options);
      armed = false;
      await original(id, { text, body: { blocks: [{ type: 'paragraph', content: [{ text }] }] } }, options);
      throw { status: 412, title: 'Precondition failed', detail: 'Another writer changed this question.' };
    };
  }), [API_MODULE, otherText]);
}

const field = (page: Page): Locator => page.getByTestId('answer-editor');
const save = (page: Page): Locator => page.getByTestId('answer-submit-draft');
const versions = (page: Page): Locator => page.getByTestId('answer-version');
const kept = (page: Page): Locator => page.getByTestId('draft-kept');
const restored = (page: Page): Locator => page.getByTestId('draft-restored');
const editor = (page: Page): Locator => page.getByTestId('focus-editor');
const squash = (text: string): string => text.replace(/\s+/g, '');

async function appendText(target: Locator, page: Page, text: string): Promise<void> {
  await target.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
}

async function toAnswers(page: Page): Promise<void> {
  if (!/\/answers$/.test(page.url())) await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
}

/** As the expert in the Beantwortung: the first `answer_drafted` row with a latest version (no refusal) and the field. */
async function pickDrafted(page: Page, exclude: readonly string[] = []): Promise<string> {
  await asRole(page, 'expert');
  await toAnswers(page);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-status-answer_drafted').click();
  await expect(page.getByTestId('answers-filter-status-answer_drafted')).toHaveAttribute('aria-pressed', 'true');
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  for (let i = 0; i < Math.min(await rows.count(), 25); i++) {
    const row = rows.nth(i);
    if ((await row.getByTestId('answers-row-refusal').count()) > 0) continue;
    const number = (await row.getAttribute('data-number')) ?? '';
    if (exclude.includes(number)) continue;
    await row.click();
    await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
    if ((await field(page).count()) > 0 && (await versions(page).count()) > 0 &&
      (await page.getByTestId('answer-editor-refusal-hint').count()) === 0) return number;
  }
  throw new Error('No answer_drafted question of the expert with a version.');
}

/** Opens a question by number in the Beantwortung, every filter reset (after a reload the selection is gone). */
async function openInAnswers(page: Page, number: string): Promise<void> {
  await toAnswers(page);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-search').fill(number);
  const first = page.getByTestId('answers-row').first();
  await expect(first).toHaveAttribute('data-number', number);
  await first.click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
}

/** As the expert on `/my`: the first row without a return reason or refusal; returns its number, writing mode open. */
async function openWriting(page: Page, number?: string, status?: string): Promise<string> {
  await asRole(page, 'expert');
  if (!/\/my$/.test(page.url())) await page.getByTestId('nav-focus').click();
  await expect(page).toHaveURL(/\/my$/);
  await waitForMine(page, EXPERT_UNIT_ID);
  const candidates = number !== undefined
    ? page.locator(`[data-testid="focus-row"][data-number="${number}"]`)
    : page.locator(`[data-testid="focus-row"][data-unit="${EXPERT_UNIT_ID}"]${status !== undefined ? `[data-status="${status}"]` : ''}:not([data-returned])`);
  for (let i = 0; i < (await candidates.count()); i++) {
    const candidate = candidates.nth(i);
    if ((await candidate.getByTestId('focus-row-refusal').count()) > 0) continue;
    const found = (await candidate.getAttribute('data-number')) ?? '';
    await candidate.click();
    await expect(page.getByTestId('focus-detail-number')).toHaveText(found);
    await candidate.dblclick();
    await expect(editor(page)).toBeFocused();
    return found;
  }
  throw new Error('No question of the expert in "Meine Fragen".');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/speakers');
  await waitForCorpus(page);
});

test.describe.serial('060 Entwurfspuffer und Fassungsvergleich', () => {
  test('E1 Neuladen: der Entwurf kommt wieder, Speichern legt genau eine Version an @screenshot', async ({ page }) => {
    test.setTimeout(150_000);
    const number = await pickDrafted(page);
    const before = await versions(page).count();
    await appendText(field(page), page, ` ${DRAFT_060_TYPED}`);
    await expect(kept(page)).toBeVisible();
    await expect(kept(page).locator('.font-mono')).toHaveText(/^\d\d:\d\d:\d\d$/);
    await page.reload();
    await waitForCorpus(page);
    await openInAnswers(page, number);
    await expect(field(page)).toContainText(DRAFT_060_TYPED);
    await expect(restored(page)).toBeVisible();
    await expect(save(page)).toHaveAttribute('aria-disabled', 'false');
    for (const lang of ['de', 'en'] as const) {
      await setLang(page, lang);
      await clearToasts(page);
      await save(page).scrollIntoViewIfNeeded();
      await checkAxe(page, `060 answers restored ${lang.toUpperCase()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence(`060-wiederhergestellt-${lang}.png`) });
    }
    await setLang(page, 'de');
    await save(page).click();
    await expect(versions(page)).toHaveCount(before + 1);
    await expect(kept(page)).toHaveCount(0);
    await page.reload();
    await waitForCorpus(page);
    await openInAnswers(page, number);
    await expect(versions(page)).toHaveCount(before + 1);
    await expect(restored(page)).toHaveCount(0);
    const latest = squash(await versions(page).last().locator('[data-answer-text="true"]').innerText());
    await expect.poll(async () => squash(await field(page).innerText())).toBe(latest);
  });

  test('E2 Schreibmodus und neuer Tab: der Text steht wieder im Schreibmodus', async ({ page, context }) => {
    test.setTimeout(150_000);
    const number = await openWriting(page);
    await page.keyboard.press('Control+End');
    await page.keyboard.type(` ${DRAFT_060_TYPED}`);
    await expect(kept(page)).toBeVisible();
    await page.close();
    const next = await context.newPage();
    await next.goto('/my');
    await waitForCorpus(next);
    await openWriting(next, number);
    await expect(editor(next)).toContainText(DRAFT_060_TYPED);
    await expect(restored(next)).toBeVisible();
  });

  test('E3 Verbindungsabbruch beim Tippen: der Puffer schreibt weiter, nach erneuter Anmeldung ist der Text da', async ({ page, context }) => {
    test.setTimeout(180_000);
    const number = await pickDrafted(page);
    if (!isHttp()) await countCalls(page, 'draftAnswer');
    const before = await versions(page).count();
    await appendText(field(page), page, ` ${DRAFT_060_TYPED.slice(0, 12)}`);
    await context.setOffline(true);
    await page.keyboard.type(`${DRAFT_060_TYPED.slice(12)} ${DRAFT_060_OFFLINE}`);
    await expect(kept(page)).toBeVisible();
    await expect.poll(async () => JSON.stringify(await readBuffer(page))).toContain(DRAFT_060_OFFLINE);
    if (isHttp()) {
      await save(page).click();
      await expect(page.locator('[aria-live] [role="status"]').first()).toBeVisible();
      await expect(field(page)).toContainText(DRAFT_060_OFFLINE);
      await expect(save(page)).toHaveAttribute('aria-disabled', 'false');
      await context.setOffline(false);
      // A new sign-in of the same person: the session cookie is gone, then the harness's state signs in again.
      await context.clearCookies();
      await page.reload();
      await asRole(page, 'expert');
      await openInAnswers(page, number);
      await expect(field(page)).toContainText(DRAFT_060_OFFLINE);
      await expect(restored(page)).toBeVisible();
    }
    await context.setOffline(false);
    await page.reload();
    await waitForCorpus(page);
    await openInAnswers(page, number);
    await expect(field(page)).toContainText(`${DRAFT_060_TYPED} ${DRAFT_060_OFFLINE}`);
    if (!isHttp()) await countCalls(page, 'draftAnswer');
    await save(page).click();
    await expect(versions(page)).toHaveCount(before + 1);
    if (!isHttp()) expect(await callsOf(page, 'draftAnswer')).toBe(1);
  });

  test('E4 Inhalt des Eintrags; manipulierte und veraltete Einträge werden verworfen', async ({ page }) => {
    test.skip(isHttp(), 'reaches into the object store of the demo');
    test.setTimeout(150_000);
    const number = await pickDrafted(page);
    const questionText = (await page.locator('[data-testid="answers-detail"] p.text-\\[16px\\]').first().innerText()).trim();
    await appendText(field(page), page, ` ${DRAFT_060_TYPED}`);
    await expect(kept(page)).toBeVisible();
    const rows = await readBuffer(page);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(Object.keys(row).sort()).toEqual(
      ['baseVersion', 'body', 'changedAt', 'id', 'meetingId', 'ownerId', 'questionId', 'schema', 'sources'].sort(),
    );
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain(number);
    expect(serialised).not.toContain(questionText);
    expect(serialised).not.toContain('Fachbereich Finanzen');

    const latestVersion = Number(await versions(page).last().getAttribute('data-version'));
    const reloadAndOpen = async (): Promise<void> => {
      await page.reload();
      await waitForCorpus(page);
      await openInAnswers(page, number);
    };
    // A manipulated entry (a script block with markup in a key `html`): not restored, deleted.
    await writeBuffer(page, { ...row, body: { blocks: [{ type: 'script', content: [{ text: DRAFT_060_OTHER }], html: '<img src=x onerror=alert(1)>' }] } });
    await reloadAndOpen();
    await expect(restored(page)).toHaveCount(0);
    await expect(field(page)).not.toContainText(DRAFT_060_OTHER);
    await expect.poll(async () => (await readBuffer(page)).length).toBe(0);
    // A valid entry with a base from the future: not restored, deleted.
    await writeBuffer(page, { ...row, baseVersion: latestVersion + 5 });
    await reloadAndOpen();
    await expect(restored(page)).toHaveCount(0);
    await expect.poll(async () => (await readBuffer(page)).length).toBe(0);
    // An entry with the unchanged wording of the latest version: saving stays locked.
    const latestText = (await versions(page).last().locator('[data-answer-text="true"]').innerText()).trim();
    await writeBuffer(page, { ...row, baseVersion: latestVersion, body: { blocks: [{ type: 'paragraph', content: [{ text: latestText }] }] } });
    await reloadAndOpen();
    await expect(restored(page)).toHaveCount(0);
    await expect(save(page)).toHaveAttribute('aria-disabled', 'true');
  });

  test('E5 Akteurwechsel und Abmelden: kein Entwurf erreicht eine andere Person', async ({ page }) => {
    test.setTimeout(180_000);
    const number = await pickDrafted(page);
    await appendText(field(page), page, ` ${DRAFT_060_TYPED}`);
    await expect(kept(page)).toBeVisible();
    if (!isHttp()) {
      // The demo start (`seedIfEmpty` switches to the administration and back) deletes nothing.
      await page.reload();
      await waitForCorpus(page);
      await expect.poll(async () => (await readBuffer(page)).length).toBe(1);
      await asRole(page, 'coordination');
      await expect.poll(async () => (await readBuffer(page)).length).toBe(0);
      await asRole(page, 'expert');
      await page.reload();
      await waitForCorpus(page);
      await openInAnswers(page, number);
      await expect(restored(page)).toHaveCount(0);
      await expect(page.locator('#main')).not.toContainText(DRAFT_060_TYPED);
      return;
    }
    // The sign-out request is answered by a double: the real session of the expert's state file stays valid for the
    // later steps and files (a real sign-out would end it on the service). The buffer is cleared before the request leaves.
    await page.route('**/auth/logout', (route) => route.fulfill({ status: 204 }), { times: 1 });
    await page.getByRole('button', { name: /^(Abmelden|Sign out)$/ }).click();
    await expect(page.getByRole('heading', { name: /^(Anmelden|Sign in)$/ })).toBeVisible();
    expect(await readBuffer(page)).toEqual([]);
    await asRole(page, 'expert');
    await openInAnswers(page, number);
    await appendText(field(page), page, ` ${DRAFT_060_TYPED}`);
    await expect(kept(page)).toBeVisible();
    await asRole(page, 'legal');
    await expect.poll(async () => (await readBuffer(page)).length).toBe(0);
  });

  test('E5b Ohne Rolle und entzogener Strom leeren den Puffer, ein 401 nicht', async ({ page }) => {
    test.skip(!isHttp(), 'session states exist only in http');
    test.setTimeout(180_000);
    const number = await pickDrafted(page);
    const keep = async (): Promise<void> => {
      await openInAnswers(page, number);
      await appendText(field(page), page, ` ${DRAFT_060_TYPED}`);
      await expect(kept(page)).toBeVisible();
      expect((await readBuffer(page)).length).toBeGreaterThan(0);
    };
    // (a) `/auth/me` answers "no active role" (403 with the sign-out token, contract 0.3.8).
    await keep();
    await page.route('**/auth/me', (route) => route.fulfill({
      status: 403, contentType: 'application/problem+json',
      body: JSON.stringify({ status: 403, title: 'Forbidden', detail: 'synthetic', csrfToken: 'c'.repeat(43) }),
    }));
    await page.reload();
    await expect(page.getByRole('heading', { name: /^(Keine aktive Rolle|No active role)$/ })).toBeVisible();
    await expect.poll(async () => (await readBuffer(page)).length).toBe(0);
    await page.unroute('**/auth/me');
    await page.reload();
    await waitForCorpus(page);
    // (b) the stream ends with `forbidden`.
    await keep();
    await page.route('**/v1/stream*', (route) => route.fulfill({
      status: 200, contentType: 'text/event-stream', body: 'event: end\ndata: {"reason":"forbidden"}\n\n',
    }));
    await page.reload();
    await expect.poll(async () => (await readBuffer(page)).length, { timeout: 20_000 }).toBe(0);
    await page.unroute('**/v1/stream*');
    await page.reload();
    await waitForCorpus(page);
    // (c) counter-check: a read answered 401, then a new sign-in of the same person — the entry is still there.
    await keep();
    await page.route('**/v1/questions*', (route) => route.fulfill({
      status: 401, contentType: 'application/problem+json', body: JSON.stringify({ status: 401, title: 'Unauthorized', detail: 'synthetic' }),
    }), { times: 1 });
    await page.getByTestId('answers-search').fill(`${number} `);
    await expect(page.getByRole('heading', { name: /^(Anmelden|Sign in)$/ })).toBeVisible();
    expect((await readBuffer(page)).length).toBeGreaterThan(0);
    await asRole(page, 'expert');
    await openInAnswers(page, number);
    await expect(restored(page)).toBeVisible();
    await page.getByRole('button', { name: /^(Eingabe verwerfen|Discard the input)$/ }).click();
  });

  test('E6 Fassungsvergleich nach 412 @screenshot', async ({ page }) => {
    test.skip(isHttp(), 'wraps the running in-process API');
    test.setTimeout(180_000);
    await pickDrafted(page);
    await appendText(field(page), page, ` ${DRAFT_060_COMPARE_MINE}`);
    await conflictOnNextSave(page, DRAFT_060_OTHER);
    await save(page).click();
    const title = page.getByTestId('compare-title');
    await expect(title).toBeFocused();
    await expect(page.getByTestId('stale-banner')).toHaveCount(0);
    await expect(page.getByTestId('compare-mine')).toContainText(DRAFT_060_COMPARE_MINE);
    await expect(page.getByTestId('compare-theirs')).toContainText(DRAFT_060_OTHER);
    for (const lang of ['de', 'en'] as const) {
      await setLang(page, lang);
      await clearToasts(page);
      // The evidence shows both columns and the decisions below them, the primary one included.
      await page.getByTestId('compare-keep-mine').scrollIntoViewIfNeeded();
      await checkAxe(page, `060 compare ${lang.toUpperCase()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence(`060-vergleich-${lang}.png`) });
    }
    await setLang(page, 'de');
    await page.getByTestId('compare-take-theirs').click();
    await expect(page.getByTestId('compare-title')).toHaveCount(0);
    await expect(field(page)).toContainText(DRAFT_060_OTHER);
    await expect(field(page)).toBeFocused();
    await expect.poll(async () => (await readBuffer(page)).length).toBe(0);

    // Second round: keep my text, then save it as the next version.
    const count = await versions(page).count();
    await appendText(field(page), page, ` ${DRAFT_060_COMPARE_MINE}`);
    await conflictOnNextSave(page, `${DRAFT_060_OTHER} 2`);
    await save(page).click();
    await expect(page.getByTestId('compare-title')).toBeFocused();
    await page.getByTestId('compare-keep-mine').click();
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toContainText(DRAFT_060_COMPARE_MINE);
    await expect(page.getByTestId('answer-editor-rebase')).toHaveCount(0);
    await save(page).click();
    await expect(versions(page)).toHaveCount(count + 2);
    await expect(versions(page).last()).toContainText(DRAFT_060_COMPARE_MINE);

    // Escape in the writing mode returns to the text without leaving the writing mode.
    await openWriting(page);
    await page.keyboard.press('Control+End');
    await page.keyboard.type(` ${DRAFT_060_COMPARE_MINE}`);
    await conflictOnNextSave(page, `${DRAFT_060_OTHER} 3`);
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('compare-title')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('compare-title')).toHaveCount(0);
    await expect(page.getByTestId('focus-writing')).toBeVisible();
    await expect(page.getByTestId('focus-rebase')).toBeVisible();
  });

  test('E7 Live-Vergleich: eine fremde Version während des Schreibens', async ({ page, browser }) => {
    test.skip(!isHttp(), 'a second signed-in browser exists only in http');
    test.setTimeout(180_000);
    const number = await pickDrafted(page);
    await appendText(field(page), page, ` ${DRAFT_060_COMPARE_MINE}`);
    const before = await versions(page).count();
    const legal = await newContextAs(browser as Browser, 'legal');
    const other = await legal.newPage();
    const writeAsLegal = async (text: string): Promise<void> => {
      await other.goto('/answers');
      await waitForCorpus(other);
      await openInAnswers(other, number);
      await appendText(other.getByTestId('answer-editor'), other, ` ${text}`);
      await other.getByTestId('answer-submit-draft').click();
      await expect(other.getByTestId('draft-kept')).toHaveCount(0);
    };
    try {
      await writeAsLegal(DRAFT_060_OTHER);
      await expect(page.getByTestId('answer-editor-rebase')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('answer-editor-rebase').getByRole('button')).toHaveText(/^(Vergleichen|Compare)$/);
      await expect(field(page)).toBeFocused();
      await save(page).click();
      await expect(page.getByTestId('compare-title')).toBeFocused();
      await expect(versions(page)).toHaveCount(before + 1);
      await writeAsLegal(`${DRAFT_060_OTHER} 2`);
      await expect(page.getByTestId('compare-theirs')).toContainText(`${DRAFT_060_OTHER} 2`, { timeout: 30_000 });
      await expect(page.getByTestId('compare-title')).toBeFocused();
      await page.getByTestId('compare-keep-mine').click();
      await expect(page.getByTestId('answer-editor-rebase')).toHaveCount(0);
      await save(page).click();
      await expect(versions(page)).toHaveCount(before + 3);
    } finally {
      await legal.close();
    }
  });

  test('E8 Doppelklick: genau eine neue Version; der Vergleich schreibt nie', async ({ page }) => {
    test.setTimeout(150_000);
    await pickDrafted(page);
    const before = await versions(page).count();
    await appendText(field(page), page, ` ${DRAFT_060_SAVED}`);
    await save(page).dblclick();
    await expect(versions(page)).toHaveCount(before + 1);
    // Not asserted: the focus on the button. The locked button carries `pointer-events: none` (Button.tsx), so the second
    // click of a real double click lands on the frame below it and the focus leaves (finding in docs/folgeliste.md).
    await page.waitForTimeout(500);
    await expect(versions(page)).toHaveCount(before + 1);
    if (isHttp()) return;
    await countCalls(page, 'draftAnswer');
    await appendText(field(page), page, ` ${DRAFT_060_COMPARE_MINE}`);
    await conflictOnNextSave(page, DRAFT_060_OTHER);
    await save(page).click();
    await expect(page.getByTestId('compare-title')).toBeFocused();
    const writes = await callsOf(page, 'draftAnswer');
    await page.getByTestId('compare-keep-mine').dblclick();
    await expect(page.getByTestId('compare-title')).toHaveCount(0);
    expect(await callsOf(page, 'draftAnswer')).toBe(writes);
    const text = await field(page).innerText();
    expect(text.split(DRAFT_060_COMPARE_MINE).length - 1).toBe(1);
  });

  test('E9 Verlassen mit Text: der Hinweis nennt, bis wann der Text bleibt; zurück kommt er wieder', async ({ page }) => {
    test.skip(isHttp(), 'hands the question on through the demo');
    test.setTimeout(180_000);
    const number = await openWriting(page, undefined, 'answer_drafted');
    await page.keyboard.press('Control+End');
    await page.keyboard.type(` ${DRAFT_060_TYPED}`);
    await expect(kept(page)).toBeVisible();
    // Another step takes the question out of "Meine Fragen": it is handed to legal through the API (another window).
    await page.evaluate(([url, id]) => import(/* @vite-ignore */ url!).then(async (module: {
      api: {
        listQuestions: (f: unknown) => Promise<{ items: { id: string; number: string; version: number }[] }>;
        submitForReview: (id: string, o: unknown) => Promise<unknown>;
      };
    }) => {
      const page = await module.api.listQuestions({ q: id, limit: 5 });
      const q = page.items.find((item) => item.number === id)!;
      await module.api.submitForReview(q.id, { ifMatch: `"v${q.version}"` });
    }), [API_MODULE, number]);
    await expect(page.getByText(new RegExp(`${escape(number)} liegt nicht mehr bei Ihnen\\. Ihr ungespeicherter Text bleibt auf diesem Gerät bis \\d\\d:\\d\\d erhalten\\.`))).toBeVisible();
    await expect(page.getByTestId('focus-writing')).toHaveCount(0);
    expect((await readBuffer(page)).length).toBe(1);
    // Legal returns it (a permitted role). The demo persona is swapped only around the one synchronous call, so no view
    // renders as legal in between: a rendered persona switch would delete the expert's entry (purgeOthers, decision 4).
    await page.evaluate(([url, actorUrl, wanted]) => Promise.all([import(/* @vite-ignore */ url!), import(/* @vite-ignore */ actorUrl!)])
      .then(async ([index, actorModule]: [
        { api: { listQuestions: (f: unknown) => Promise<{ items: { id: string; number: string; version: number }[] }>;
          returnQuestion: (id: string, reason: string, o: unknown) => Promise<unknown> } },
        { DEMO_ACTORS: readonly { id: string; role: string }[]; getActor: () => unknown; setActor: (a: unknown) => void },
      ]) => {
        const listed = await index.api.listQuestions({ q: wanted, limit: 5 });
        const q = listed.items.find((item) => item.number === wanted)!;
        const me = actorModule.getActor();
        actorModule.setActor(actorModule.DEMO_ACTORS.find((a) => a.role === 'legal'));
        const done = index.api.returnQuestion(q.id, 'e2e 060', { ifMatch: `"v${q.version}"` });
        actorModule.setActor(me);
        await done;
      }), [API_MODULE, '/src/api/actor.ts', number]);
    await openWriting(page, number);
    await expect(editor(page)).toContainText(DRAFT_060_TYPED);
    await expect(restored(page)).toBeVisible();
  });
});
