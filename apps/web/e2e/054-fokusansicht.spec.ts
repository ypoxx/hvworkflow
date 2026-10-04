/**
 * Scheibe 054 — Fokusansicht der Beantworter (docs/slices/054-fokusansicht.md).
 *
 * "Meine Fragen" on `/my` (Alt+6): the questions the expert may draft and forward now, oldest first, without filters,
 * agenda item or clock time. A double click or Enter opens the writing mode (Schreibmodus), Ctrl+Enter saves, Escape
 * leaves and keeps the text; "Weiterleiten" hands the answer to the next step and the next question stands there;
 * "An anderen Fachbereich weiterleiten" opens the dialog of 053. Every button is taken from `_actions` (AGENTS.md R4);
 * the roles are only switched here. The expert is bound to Finanzen in both projects (decision 2a: in-process through
 * the demo's role assignment, in `http` through the harness), so every row of the list carries `unit-fin`.
 *
 * Runs in both projects. `in-process`: every test starts with a fresh demo state (own browser context), so
 * `--repeat-each=3` is independent. `http`: the database persists across files (path order: after 053, before 080 and
 * abnahme). End state after this file in `http`:
 *   - F2: one question of Finanzen that was `assigned` is `answer_drafted` with one version `FOCUS_054_ANSWER`;
 *   - F4: one question of Finanzen that was `answer_drafted` (no return reason, no refusal) was `in_review` and is
 *     `answer_drafted` again after legal returned it, with the return reason `FOCUS_054_RETURN_REASON`;
 *   - F5: one question of Finanzen that was `assigned` lies with "AR-Büro", status `assigned`, with one
 *     `QuestionForwarded` (reason `wrong_unit`);
 *   - F7: one question of "Operations" that was `assigned` lies with Finanzen, status `assigned`, with one
 *     `QuestionForwarded` (reason `capacity`);
 *   - F1, F3, F6, F8 write nothing; the podium is unchanged.
 * `080-sprecher-zustand.spec.ts` touches only speakers; `abnahme.spec.ts` captures, assigns and answers a question of its
 * own and needs no existing question of Finanzen, only the unit itself. The questions are never fixed numbers:
 * `findMine` picks the first row in the wanted status.
 */
import type { Locator, Page } from '@playwright/test';
import { CORPUS_DEMO } from '@hv/domain';
import { checkAxe } from './support/axe';
import { FOCUS_054_ANSWER, FOCUS_054_RETURN_REASON, FOCUS_054_UNSAVED } from './support/e2e-texts';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

/**
 * Units as the unit filter and the forward dialog name them (`shortName`). Source: `SEED_UNITS` in
 * packages/domain/src/seed.ts — "Finanzen und Controlling" (`unit-fin`, the unit the expert is bound to: in-process by
 * `DEMO_BINDINGS` in apps/web/src/api/actor.ts, in `http` by the harness), "Büro des Aufsichtsratsvorsitzenden"
 * (`unit-ar`, no open question in the seed; 053 S4 forwards there, nobody reads on there), "Operations und Technik"
 * (`unit-ops`, the source of F7).
 */
const EXPERT_UNIT = 'Finanzen';
const EXPERT_UNIT_ID = 'unit-fin';
const TARGET_UNIT = 'AR-Büro';
const TARGET_UNIT_ID = 'unit-ar';
const SOURCE_UNIT = 'Operations';
const SOURCE_UNIT_ID = 'unit-ops';
void TARGET_UNIT_ID; // named for the reader; the dialog is driven by the label

/** Measured on the seed with the binding (Test 12): seven questions of Finanzen in `assigned` or `answer_drafted`. */
const MINE_IN_PROCESS = 7;

type Status = 'assigned' | 'answer_drafted';

test.use({ viewport: { width: 1440, height: 900 } });

const isHttp = (): boolean => test.info().project.name === 'http';

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

/** Confirmations belong on screen, not in the evidence: clear the stack before a screenshot (both languages). */
async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^(Meldung schließen|Close the message)$/ });
  for (let open = await close.count(); open > 0; open = await close.count()) await close.first().click();
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

const toasts = (page: Page): Locator => page.locator('[aria-live="polite"] [role="status"]');
const dialog = (page: Page) => page.getByRole('dialog');
/** The page's own heading (the shell carries a second level-1 heading, the meeting title). */
const pageTitle = (page: Page) => page.getByRole('heading', { level: 1, name: /^(Meine Fragen|My questions)$/ });
const rows = (page: Page) => page.getByTestId('focus-row');
const row = (page: Page, number: string) => page.locator(`[data-testid="focus-row"][data-number="${number}"]`);
const detailNumber = (page: Page) => page.getByTestId('focus-detail-number');
const editor = (page: Page) => page.getByTestId('focus-editor');

async function toFocus(page: Page): Promise<void> {
  if (!/\/my$/.test(page.url())) await page.getByTestId('nav-focus').click();
  await expect(page).toHaveURL(/\/my$/);
}

/**
 * The list has landed for the acting person: it is ready (or the page says there is nothing, or nothing to read), and
 * every row carries the expert's unit. After a switch of person the list arrives later than the page (lesson of 045,
 * CI run 37152696332, and 053 review 7): rows are taken only after this.
 */
async function waitForMine(page: Page): Promise<void> {
  await expect.poll(async () => {
    if (await page.getByTestId('focus-forbidden').isVisible()) return true;
    if (await page.getByTestId('focus-empty').isVisible()) return true;
    const list = page.getByTestId('focus-list');
    if ((await list.count()) === 0 || (await list.getAttribute('data-state')) !== 'ready') return false;
    const units = await rows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-unit')));
    return units.length > 0 && units.every((unit) => unit === EXPERT_UNIT_ID);
  }, { timeout: 15_000 }).toBe(true);
}

/**
 * The one finder of this file: as the expert, on `/my`, the first row in `status` of the expert's unit without a return
 * reason, without a refusal badge and not excluded; it is chosen and its detail shown. Returns its number and the number
 * of the question that stands there once it has left the list (the next row, else the previous).
 */
async function findMine(
  page: Page,
  opts: { status: Status; exclude?: readonly string[] },
): Promise<{ number: string; next: string | undefined }> {
  await asRole(page, 'expert');
  await toFocus(page);
  await waitForMine(page);
  const all = await rows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-number') ?? ''));
  const exclude = opts.exclude ?? [];
  const candidates = page.locator(
    `[data-testid="focus-row"][data-status="${opts.status}"][data-unit="${EXPERT_UNIT_ID}"]:not([data-returned])`,
  );
  for (let i = 0; i < (await candidates.count()); i++) {
    const candidate = candidates.nth(i);
    const number = (await candidate.getAttribute('data-number')) ?? '';
    if (exclude.includes(number) || (await candidate.getByTestId('focus-row-refusal').count()) > 0) continue;
    await candidate.click();
    await expect(detailNumber(page)).toHaveText(number);
    const index = all.indexOf(number);
    return { number, next: all[index + 1] ?? all[index - 1] };
  }
  throw new Error(`No ${opts.status} question of ${EXPERT_UNIT} without a return reason in "Meine Fragen".`);
}

async function expectForwardEmpty(page: Page): Promise<void> {
  await expect(page.getByTestId('forward-unit')).toHaveValue('');
  for (const code of ['wrong_unit', 'expertise_elsewhere', 'capacity', 'other']) {
    await expect(page.getByTestId(`forward-reason-${code}`)).not.toBeChecked();
  }
  await expect(page.getByTestId('forward-submit')).toHaveAttribute('aria-disabled', 'true');
}

/** Tab until `target` holds the focus (at most `max` presses). */
async function tabTo(page: Page, target: Locator, max = 12): Promise<void> {
  for (let i = 0; i < max && !(await target.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

/** Opens a question by number at the answer desk, with every filter reset (as 045). */
async function openInAnswers(page: Page, number: string): Promise<void> {
  if (!/\/answers$/.test(page.url())) await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-unit').selectOption({ index: 0 });
  await page.getByTestId('answers-search').fill(number);
  const first = page.getByTestId('answers-row').first();
  await expect(first).toHaveAttribute('data-number', number);
  await first.click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
}

test.describe.serial('054 Fokusansicht der Beantworter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/speakers');
    await waitForCorpus(page);
  });

  test('F1 Liste, Alt+6, Rechte als Daten @screenshot', async ({ page }) => {
    test.setTimeout(150_000);
    await asRole(page, 'expert');
    await expect(page).toHaveURL(/\/speakers$/);
    await page.keyboard.press('Alt+6');
    await expect(page).toHaveURL(/\/my$/);
    await expect(pageTitle(page)).toHaveText('Meine Fragen');
    await waitForMine(page);

    await test.step('every row is mine: assigned or drafted, Finanzen, oldest first', async () => {
      const facts = await rows(page).evaluateAll((els) =>
        els.map((el) => ({
          status: el.getAttribute('data-status'),
          unit: el.getAttribute('data-unit'),
          created: el.getAttribute('data-created') ?? '',
          number: el.getAttribute('data-number') ?? '',
        })),
      );
      if (isHttp()) expect(facts.length).toBeGreaterThanOrEqual(3);
      else expect(facts).toHaveLength(MINE_IN_PROCESS);
      for (const fact of facts) {
        expect(['assigned', 'answer_drafted']).toContain(fact.status);
        expect(fact.unit).toBe(EXPERT_UNIT_ID);
      }
      for (let i = 1; i < facts.length; i++) {
        const [a, b] = [facts[i - 1]!, facts[i]!];
        expect(a.created <= b.created).toBe(true);
        if (a.created === b.created) expect(a.number.localeCompare(b.number)).toBeLessThan(0);
      }
    });

    await test.step('no filters, no agenda item, no clock time; two lines of wording; the age in the house words', async () => {
      await expect(page.locator('[data-testid^="answers-filter"]')).toHaveCount(0);
      await expect(page.getByTestId('answers-search')).toHaveCount(0);
      const text = await page.getByTestId('focus-list').innerText();
      expect(text).not.toMatch(/\d{1,2}:\d{2}/);
      expect(text).not.toMatch(/\bTOP\b/);
      const clamps = await page.getByTestId('focus-row-text').evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).getPropertyValue('-webkit-line-clamp')),
      );
      expect(clamps.length).toBeGreaterThan(0);
      for (const clamp of clamps) expect(clamp).toBe('2');
      for (const age of await page.getByTestId('focus-row-age').allInnerTexts()) {
        expect(age).toMatch(/^(eben|vor \d+ (min|Std\.|Tg\.))$/);
      }
    });

    await test.step('the first row is chosen; the detail shows it with exactly one primary action', async () => {
      const first = rows(page).first();
      await expect(first).toHaveAttribute('aria-selected', 'true');
      await expect(detailNumber(page)).toHaveText((await first.getAttribute('data-number')) ?? '');
      await expect(page.getByTestId('focus-detail').locator('[data-primary="true"]')).toHaveCount(1);
      await expect(page.getByTestId('nav-focus')).toBeVisible();
    });

    await test.step('screenshots and axe in both languages', async () => {
      await clearToasts(page);
      await checkAxe(page, '054 focus page DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('054-fokus-de.png') });
      await setLang(page, 'en');
      await expect(pageTitle(page)).toHaveText('My questions');
      await clearToasts(page);
      await checkAxe(page, '054 focus page EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('054-fokus-en.png') });
      await setLang(page, 'de');
    });
  });

  test('F2 Doppelklick → Schreibmodus → speichern @screenshot', async ({ page }) => {
    test.setTimeout(150_000);
    const { number } = await findMine(page, { status: 'assigned' });
    const rowId = (await row(page, number).getAttribute('id')) ?? '';

    await row(page, number).dblclick();
    await expect(page.getByTestId('focus-writing')).toBeVisible();
    await expect(page.getByTestId('focus-list')).toHaveCount(0);
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveValue('');

    await editor(page).fill(FOCUS_054_ANSWER);
    await expect(page.getByTestId('focus-reading-time')).toHaveText(/^Vorlesezeit ca\. \d+:\d{2} min$/);
    expect(Number(await page.getByTestId('focus-reading-time').getAttribute('data-seconds'))).toBeGreaterThan(0);
    await expect(page.getByTestId('focus-save')).toHaveAttribute('data-primary', 'true');

    await test.step('screenshots and axe in both languages; the language switch of the shell stays, the text too', async () => {
      await clearToasts(page);
      await checkAxe(page, '054 writing mode DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('054-schreibmodus-de.png') });
      await setLang(page, 'en');
      await expect(editor(page)).toHaveValue(FOCUS_054_ANSWER);
      await expect(page.getByTestId('focus-writing')).toContainText('Writing mode');
      await clearToasts(page);
      await checkAxe(page, '054 writing mode EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('054-schreibmodus-en.png') });
      await setLang(page, 'de');
    });

    await test.step('Ctrl+Enter saves; the writing mode stays, now offering Weiterleiten', async () => {
      await editor(page).focus();
      await page.keyboard.press('Control+Enter');
      await expect(toasts(page).filter({ hasText: 'Übernommen' }).first()).toBeVisible();
      await expect(page.getByTestId('focus-writing-submit')).toBeVisible();
      await expect(page.getByTestId('focus-writing-submit')).toHaveAttribute('data-primary', 'true');
      await expect(page.getByTestId('focus-save')).toHaveAttribute('aria-disabled', 'true');
      await expect(editor(page)).toHaveValue(FOCUS_054_ANSWER);
    });

    await test.step('Escape leaves: the list holds the focus on this question; the detail shows the saved version', async () => {
      await editor(page).focus();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('focus-writing')).toHaveCount(0);
      await expect(page.getByTestId('focus-list')).toBeFocused();
      await expect(page.getByTestId('focus-list')).toHaveAttribute('aria-activedescendant', rowId);
      await expect(detailNumber(page)).toHaveText(number);
      await expect(page.getByTestId('focus-latest')).toContainText(FOCUS_054_ANSWER);
      await expect(page.getByTestId('focus-detail')).toContainText('Antwortentwurf');
      await expect(row(page, number)).toHaveAttribute('data-status', 'answer_drafted');
    });
  });

  test('F3 Tastatur: Enter, Escape, Dialog über dem Schreibmodus (schreibt nichts)', async ({ page }) => {
    test.setTimeout(120_000);
    await asRole(page, 'expert');
    await page.keyboard.press('Alt+6');
    await expect(page).toHaveURL(/\/my$/);
    await waitForMine(page);
    const list = page.getByTestId('focus-list');

    await pageTitle(page).click();
    await tabTo(page, list);
    await expect(list).toHaveCSS('outline-style', /solid|auto/);
    const second = rows(page).nth(1);
    const number = (await second.getAttribute('data-number')) ?? '';
    const status = (await second.getAttribute('data-status')) ?? '';
    await page.keyboard.press('ArrowDown');
    await expect(detailNumber(page)).toHaveText(number);

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('focus-writing')).toBeVisible();
    await expect(editor(page)).toBeFocused();
    const base = await editor(page).inputValue();
    await page.keyboard.type(` ${FOCUS_054_UNSAVED}`);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('focus-writing')).toHaveCount(0);
    await expect(list).toBeFocused();
    await expect(page.getByTestId('focus-draft-unsaved')).toBeVisible();
    await expect(page.getByTestId('focus-write')).toHaveAttribute('data-primary', 'true');
    await expect(page.getByTestId('focus-write')).toHaveText('Entwurf fortsetzen');
    await expect(page.getByTestId('focus-submit')).toHaveCount(0);
    await expect(page.getByTestId('focus-forward')).toHaveCount(0);

    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveValue(`${base} ${FOCUS_054_UNSAVED}`);
    await editor(page).fill(base);
    const forward = page.getByTestId('focus-writing-forward');
    await expect(forward).toBeVisible();
    await tabTo(page, forward);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('forward-submit')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId('focus-writing')).toBeVisible();
    await expect(forward).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('focus-writing')).toHaveCount(0);
    // Nothing was written: the question stands as before.
    await expect(row(page, number)).toHaveAttribute('data-status', status);
    await expect(page.getByTestId('focus-draft-unsaved')).toHaveCount(0);
  });

  test('F4 Weiterleiten → nächste Einzelfrage; Rückgabegrund prominent', async ({ page }) => {
    test.setTimeout(180_000);
    const { number, next } = await findMine(page, { status: 'answer_drafted' });
    const submit = page.getByTestId('focus-submit');
    await expect(submit).toHaveAttribute('data-primary', 'true');
    await expect(submit).toHaveText('Weiterleiten');

    await test.step('Weiterleiten: the question leaves the list, the next one stands there with the focus', async () => {
      await submit.click();
      await expect(toasts(page).filter({ hasText: `Einzelfrage ${number}: Weiterleiten` }).first()).toBeVisible();
      await expect(row(page, number)).toHaveCount(0);
      if (next !== undefined) await expect(detailNumber(page)).toHaveText(next);
      await expect.poll(() =>
        page.evaluate(() => document.querySelector('[data-testid="focus-detail"]')?.contains(document.activeElement) ?? false),
      ).toBe(true);
    });

    await test.step('legal returns it with a reason', async () => {
      await asRole(page, 'legal');
      await openInAnswers(page, number);
      await page.getByTestId('answer-return').click();
      await page.getByTestId('answer-return-reason').fill(FOCUS_054_RETURN_REASON);
      await page.getByTestId('answer-return-submit').click();
      await expect(page.getByTestId('answers-detail')).toContainText(FOCUS_054_RETURN_REASON);
    });

    await test.step('back with the expert: marked in the list, the return reason first in the detail', async () => {
      await asRole(page, 'expert');
      await toFocus(page);
      await waitForMine(page);
      await expect(row(page, number).getByTestId('focus-row-returned')).toBeVisible();
      await row(page, number).click();
      await expect(detailNumber(page)).toHaveText(number);
      const note = page.getByTestId('focus-returned');
      await expect(note).toHaveAttribute('role', 'note');
      await expect(note).toContainText(FOCUS_054_RETURN_REASON);
      const noteBox = await note.boundingBox();
      const textBox = await page.getByTestId('focus-detail-text').boundingBox();
      expect(noteBox !== null && textBox !== null && noteBox.y < textBox.y).toBe(true);
    });
  });

  test('F5 An anderen Fachbereich weiterleiten @screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    const { number, next } = await findMine(page, { status: 'assigned' });
    const forward = page.getByTestId('focus-forward');
    await expect(forward).not.toHaveAttribute('data-primary', 'true');
    await expect(page.getByTestId('focus-write')).toHaveAttribute('data-primary', 'true');

    await test.step('the dialog of 053: nothing preselected, the own unit not offered, the note on who reads', async () => {
      await forward.click();
      await expect(dialog(page)).toContainText('An anderen Fachbereich weiterleiten');
      await expect(page.getByTestId('forward-current-unit')).toHaveText(EXPERT_UNIT);
      const options = await page.getByTestId('forward-unit').locator('option').allTextContents();
      expect(options).not.toContain(EXPERT_UNIT);
      expect(options).toContain(TARGET_UNIT);
      await expectForwardEmpty(page);
      await expect(page.getByTestId('forward-readers')).toBeVisible();
      await expect(dialog(page).locator('textarea, input:not([type="radio"])')).toHaveCount(0);
      await clearToasts(page);
      await checkAxe(page, '054 forward dialog DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('054-weiterleiten-de.png') });
    });

    await test.step('English: close, switch, open again (starts empty), choose', async () => {
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await setLang(page, 'en');
      await forward.click();
      await expectForwardEmpty(page);
      await page.getByTestId('forward-unit').selectOption({ label: TARGET_UNIT });
      await page.getByTestId('forward-reason-wrong_unit').check();
      await expect(page.getByTestId('forward-submit')).not.toHaveAttribute('aria-disabled', 'true');
      await clearToasts(page);
      await checkAxe(page, '054 forward dialog EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('054-weiterleiten-en.png') });
    });

    await test.step('forward: the question leaves the list, the next one stands there, no refusal toast', async () => {
      await page.getByTestId('forward-submit').click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(toasts(page).filter({ hasText: 'Applied' }).first()).toBeVisible();
      await expect(row(page, number)).toHaveCount(0);
      if (next !== undefined) await expect(detailNumber(page)).toHaveText(next);
      // The detail read of the forwarded question answers 404 (048); the complete list leaves it out, so it is swallowed.
      await page.waitForTimeout(500);
      await expect(toasts(page).filter({ hasText: /Aktion nicht möglich|Action not possible/ })).toHaveCount(0);
      await setLang(page, 'de');
    });

    await test.step('the history (coordination) names the forward with the change of unit and the reason', async () => {
      await asRole(page, 'coordination');
      await page.getByTestId('nav-history').click();
      await page.getByTestId('history-search').fill(number);
      await page.getByTestId('history-result').filter({ hasText: number }).first().click();
      const forwarded = page.locator('[data-testid="history-event"][data-type="QuestionForwarded"]').last();
      await expect(forwarded).toContainText('An anderen Fachbereich weitergeleitet');
      await expect(forwarded).toContainText(`${EXPERT_UNIT} → ${TARGET_UNIT}`);
      await expect(forwarded).toContainText('Grund: Falscher Fachbereich');
    });
  });

  test('F6 Lesehinweis, Rechte als Daten (schreibt nichts)', async ({ page }) => {
    test.setTimeout(120_000);
    for (const role of ['coordination', 'legal']) {
      await test.step(`${role}: the notice, no rows`, async () => {
        await asRole(page, role);
        await toFocus(page);
        await waitForMine(page);
        await expect(page.getByTestId('focus-empty')).toBeVisible();
        await expect(rows(page)).toHaveCount(0);
        await expect(page.getByTestId('nav-focus')).toBeVisible();
      });
    }
    await test.step('podium: its own read state, no list', async () => {
      await asRole(page, 'podium');
      await page.goto('/my');
      await expect(page.getByTestId('focus-forbidden')).toBeVisible();
      await expect(page.getByTestId('focus-list')).toHaveCount(0);
      await expect(page.getByTestId('nav-focus')).toBeVisible();
    });
  });

  test('F7 Zulauf aus der Steuerung: letzter Weiterleitungsgrund', async ({ page }) => {
    test.setTimeout(180_000);
    let number = '';
    await test.step('coordination forwards an assigned question of Operations to Finanzen', async () => {
      await asRole(page, 'coordination');
      await page.getByTestId('nav-steering').click();
      await expect(page).toHaveURL(/\/steering$/);
      await page.getByTestId('answers-filter-status-all').click();
      const [unitId] = await page.getByTestId('answers-filter-unit').selectOption({ label: SOURCE_UNIT });
      expect(unitId).toBe(SOURCE_UNIT_ID);
      const steeringRows = page.getByTestId('answers-row');
      await expect(steeringRows.first()).toBeVisible();
      // The unit filter works in the service: rows are taken only once every one carries the unit (045).
      await expect.poll(async () => {
        const units = await steeringRows.evaluateAll((els) => els.map((el) => el.getAttribute('data-unit')));
        return units.length > 0 && units.every((unit) => unit === SOURCE_UNIT_ID);
      }).toBe(true);
      await page.getByTestId('answers-filter-status-assigned').click();
      await expect.poll(async () => {
        const statuses = await steeringRows.evaluateAll((els) => els.map((el) => el.getAttribute('data-status')));
        return statuses.length > 0 && statuses.every((status) => status === 'assigned');
      }).toBe(true);
      const first = steeringRows.first();
      number = (await first.getAttribute('data-number')) ?? '';
      await first.click();
      await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
      await page.getByTestId('steering-forward').click();
      await page.getByTestId('forward-unit').selectOption({ label: EXPERT_UNIT });
      await page.getByTestId('forward-reason-capacity').check();
      await page.getByTestId('forward-submit').click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.getByTestId('steering-detail-unit')).toHaveText(EXPERT_UNIT);
    });

    await test.step('the expert finds it among "Meine Fragen" with where it came from and why', async () => {
      await asRole(page, 'expert');
      await toFocus(page);
      await waitForMine(page);
      await expect(row(page, number)).toHaveAttribute('data-unit', EXPERT_UNIT_ID);
      await row(page, number).click();
      await expect(detailNumber(page)).toHaveText(number);
      const forwarded = page.getByTestId('focus-forwarded');
      await expect(forwarded).toContainText(SOURCE_UNIT);
      await expect(forwarded).toContainText('Auslastung');
    });
  });

  test('F8 Eingaben je Akteur (schreibt nichts)', async ({ page }) => {
    test.setTimeout(120_000);
    // Brings its own precondition: any row of "Meine Fragen" will do (it writes nothing), so it does not depend on F7
    // leaving an `assigned` question behind in `http`.
    await asRole(page, 'expert');
    await toFocus(page);
    await waitForMine(page);
    const number = (await rows(page).first().getAttribute('data-number')) ?? '';
    await row(page, number).click();
    await expect(detailNumber(page)).toHaveText(number);
    await row(page, number).dblclick();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type(FOCUS_054_UNSAVED);
    await expect(editor(page)).toHaveValue(new RegExp(FOCUS_054_UNSAVED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    await asRole(page, 'coordination');
    await asRole(page, 'expert');
    await toFocus(page);
    await waitForMine(page);
    await expect(page.getByTestId('focus-writing')).toHaveCount(0);
    await row(page, number).click();
    await expect(detailNumber(page)).toHaveText(number);
    await expect(page.getByTestId('focus-draft-unsaved')).toHaveCount(0);
    await row(page, number).dblclick();
    await expect(editor(page)).toBeVisible();
    await expect(editor(page)).not.toHaveValue(new RegExp(FOCUS_054_UNSAVED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('focus-writing')).toHaveCount(0);
  });
});
