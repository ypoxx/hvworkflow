/**
 * Scheibe 053 — Steuerungsansicht der Koordination (docs/slices/053-steuerungsansicht.md).
 *
 * The coordination steers on its own page: the distribution (Verteilung) above — open per answering unit and on the
 * podium per seat, totals from the service — and below the work list and one question with its next steering step:
 * classify, assign, forward to another answering unit, and as a side step propose a refusal. Every button is taken
 * from `_actions` (AGENTS.md R4); the roles are only switched here.
 *
 * Runs in both projects. `in-process`: every test starts with a fresh demo state (own browser context), so
 * `--repeat-each=3` is independent. `http`: the database persists across files (path order: after 045, before 080 and
 * abnahme). End state after this file in `http`:
 *   - S2: one question that was `captured` is `classified` (`expert_track`, seat Finanzvorstand);
 *   - S3: one `classified` text-track question without a unit is `assigned` to "Operations";
 *   - S4: one `assigned` question of "Operations" lies with "AR-Büro", status `assigned`, with one `QuestionForwarded`
 *     (reason `expertise_elsewhere`);
 *   - (S2b runs in-process only and writes nothing in `http`);
 *   - no question of "Finanzen" (the unit of the expert test person) is touched; the podium is unchanged; S1, S5–S10
 *     write nothing.
 * `080-sprecher-zustand.spec.ts` touches only speakers; `abnahme.spec.ts` captures and classifies its own questions and
 * needs only one `classified` row for its timing (seed 7, S2 +1, S3 −1). The questions are never fixed numbers:
 * `findSteerable` picks the first that offers the wanted button, never one of `EXPERT_UNIT`.
 */
import { CORPUS_DEMO } from '@hv/domain';
import type { Locator, Page } from '@playwright/test';
import { checkAxe } from './support/axe';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

/**
 * Units as the unit filter names them (`shortName`, 045). Source: `SEED_UNITS` in packages/domain/src/seed.ts —
 * "Operations und Technik" (`unit-ops`), "Büro des Aufsichtsratsvorsitzenden" (`unit-ar`, no open question in the seed
 * and touched by no earlier file of the `http` order), "Finanzen und Controlling" (`unit-fin`, the expert test
 * person's unit: only ever excluded).
 */
const SOURCE_UNIT = 'Operations';
const SOURCE_UNIT_ID = 'unit-ops';
const TARGET_UNIT = 'AR-Büro';
const TARGET_UNIT_ID = 'unit-ar';
const EXPERT_UNIT = 'Finanzen';
const EXPERT_UNIT_ID = 'unit-fin';
void EXPERT_UNIT; // named for the reader; rows are excluded by its id

/** The open statuses `counts.byUnit` counts (all but delivered, closed, withdrawn, merged; 040b). */
const OPEN_STATUSES = ['captured', 'classified', 'assigned', 'answer_drafted', 'in_review', 'approved', 'staged'] as const;

type SteeringButton = 'steering-classify' | 'steering-assign' | 'steering-forward' | 'steering-refuse';
type Status = (typeof OPEN_STATUSES)[number];

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

async function toSteering(page: Page): Promise<void> {
  if (!/\/steering$/.test(page.url())) await page.getByTestId('nav-steering').click();
  await expect(page).toHaveURL(/\/steering$/);
}

const dialog = (page: Page) => page.getByRole('dialog');
/** The page's own heading (the shell carries a second level-1 heading, the meeting title). */
const pageTitle = (page: Page) => page.getByRole('heading', { level: 1, name: /^(Steuerung|Steering)$/ });
const rows = (page: Page) => page.getByTestId('answers-row');
const detail = (page: Page) => page.getByTestId('steering-detail');
const unitCell = (page: Page, unitId: string) => page.locator(`[data-testid="steering-unit-cell"][data-unit="${unitId}"]`);
const noUnitCell = (page: Page) => page.getByTestId('steering-unit-none');

async function countOf(cell: Locator): Promise<number> {
  return Number(await cell.getAttribute('data-count'));
}

/** Every row of the list carries this attribute value — the service-side filter has landed (lesson of 045). */
async function expectEveryRow(page: Page, attribute: 'data-unit' | 'data-status', value: string): Promise<void> {
  await expect.poll(async () => {
    const values = await rows(page).evaluateAll((els, name) => els.map((el) => el.getAttribute(name)), attribute);
    return values.length > 0 && values.every((entry) => entry === value);
  }).toBe(true);
}

/** Opens a question by number on the steering page, with every filter reset. */
async function openInSteering(page: Page, number: string): Promise<void> {
  await toSteering(page);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-unit').selectOption({ index: 0 });
  await page.getByTestId('answers-search').fill(number);
  const row = rows(page).first();
  await expect(row).toHaveAttribute('data-number', number);
  await row.click();
  await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
}

/**
 * The one finder of this file: as `role`, on `/steering`, the first row in `status` (and in `unitName`, if given)
 * whose detail offers `button`, whose number is not excluded and which is not in the expert's unit. The unit filter
 * works in the service: the rows are taken only once every one carries the chosen unit (045, CI run 37152696332).
 */
async function findSteerable(
  page: Page,
  role: string,
  opts: { status: Status; button: SteeringButton; unitName?: string; exclude?: readonly string[] },
): Promise<string> {
  await asRole(page, role);
  await toSteering(page);
  await page.getByTestId('answers-search').fill('');
  await page.getByTestId('answers-filter-status-all').click();
  const unit = page.getByTestId('answers-filter-unit');
  let unitId: string | undefined;
  if (opts.unitName !== undefined) [unitId] = await unit.selectOption({ label: opts.unitName });
  else await unit.selectOption({ index: 0 });
  await expect(rows(page).first()).toBeVisible();
  if (unitId !== undefined) await expectEveryRow(page, 'data-unit', unitId);
  await page.getByTestId(`answers-filter-status-${opts.status}`).click();
  await expectEveryRow(page, 'data-status', opts.status);
  const exclude = opts.exclude ?? [];
  for (let i = 0; i < Math.min(await rows(page).count(), 20); i++) {
    const row = rows(page).nth(i);
    const number = (await row.getAttribute('data-number')) ?? '';
    if (exclude.includes(number) || (await row.getAttribute('data-unit')) === EXPERT_UNIT_ID) continue;
    if (unitId !== undefined) expect(await row.getAttribute('data-unit')).toBe(unitId);
    await row.click();
    // The selected question is read on its own in `http`; its actions are known once its number shows.
    await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
    if (await page.getByTestId(opts.button).isVisible()) return number;
  }
  throw new Error(`No ${opts.status} question offering ${opts.button} for ${role}.`);
}

/** The number at the end of a status segment's text ("zugewiesen 4"); a segment that is not rendered counts 0. */
async function segmentCount(page: Page, status: Status): Promise<number> {
  const segment = page.getByTestId(`answers-filter-status-${status}`);
  if ((await segment.count()) === 0) return 0;
  const text = (await segment.textContent()) ?? '';
  return Number(text.match(/(\d+)\s*$/)?.[1] ?? 0);
}

async function headerNumber(page: Page, testId: string): Promise<number> {
  return Number(((await page.getByTestId(testId).textContent()) ?? '').replace(/\D/g, ''));
}

/** Switches the demo actor without the header while a modal covers it (as 090 does); `in-process` only. */
async function switchActorUnderDialog(page: Page, role: string): Promise<void> {
  await page.evaluate(
    ([url, wanted]) => {
      const w = window as unknown as { __switch053?: string };
      w.__switch053 = 'pending';
      void import(/* @vite-ignore */ url!).then(
        (mod: { DEMO_ACTORS: readonly { role: string }[]; setActor: (actor: unknown) => void }) => {
          mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
          w.__switch053 = 'done';
        },
        (error: unknown) => {
          w.__switch053 = `failed: ${String(error)}`;
        },
      );
    },
    ['/src/api/actor.ts', role],
  );
  await expect.poll(() => page.evaluate(() => (window as unknown as { __switch053?: string }).__switch053)).toBe('done');
}

async function openForward(page: Page): Promise<void> {
  await page.getByTestId('steering-forward').click();
  await expect(page.getByTestId('forward-submit')).toBeVisible();
}

async function expectForwardEmpty(page: Page): Promise<void> {
  await expect(page.getByTestId('forward-unit')).toHaveValue('');
  for (const code of ['wrong_unit', 'expertise_elsewhere', 'capacity', 'other']) {
    await expect(page.getByTestId(`forward-reason-${code}`)).not.toBeChecked();
  }
  await expect(page.getByTestId('forward-submit')).toHaveAttribute('aria-disabled', 'true');
}

test.describe.serial('053 Steuerungsansicht der Koordination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/steering');
    await waitForCorpus(page);
  });

  test('S1 Verteilung gegen die Zähler, Drill-down gegen die Liste (mit S8) @screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    await asRole(page, 'coordination');
    await toSteering(page);
    const cells = page.getByTestId('steering-unit-cell');
    await expect(cells.first()).toBeVisible();
    await expect(page.getByTestId('steering-seat-cell').first()).toBeVisible();

    await test.step('every cell shows exactly its data-count; the sums stay within the header counters', async () => {
      let units = 0;
      for (const cell of await cells.all()) {
        const count = await countOf(cell);
        await expect(cell).toContainText(String(count));
        units += count;
      }
      const none = await countOf(noUnitCell(page));
      await expect(noUnitCell(page)).toContainText(String(none));
      let seats = 0;
      for (const cell of await page.getByTestId('steering-seat-cell').all()) {
        const count = await countOf(cell);
        await expect(cell).toContainText(String(count));
        seats += count;
      }
      expect(units).toBeLessThanOrEqual(await headerNumber(page, 'header-counter-open'));
      expect(units + none).toBe(await headerNumber(page, 'header-counter-open'));
      expect(seats).toBeLessThanOrEqual(await headerNumber(page, 'header-counter-staged'));
    });

    await test.step('drill-down: the unit cell filters the list, and its open rows add up to the cell', async () => {
      const cell = unitCell(page, SOURCE_UNIT_ID);
      const expected = await countOf(cell);
      await cell.click();
      await expect(page.getByTestId('answers-filter-unit')).toHaveValue(SOURCE_UNIT_ID);
      await expect(page.getByTestId('answers-filter-unit').locator('option:checked')).toHaveText(SOURCE_UNIT);
      await expect(cell).toHaveAttribute('aria-pressed', 'true');
      await expectEveryRow(page, 'data-unit', SOURCE_UNIT_ID);
      await expect.poll(async () => {
        let sum = 0;
        for (const status of OPEN_STATUSES) sum += await segmentCount(page, status);
        return sum;
      }).toBe(expected);
    });

    await test.step('one question with exactly one primary action; screenshots and axe in both languages', async () => {
      // An assigned row: its next step (forward) is the one primary action the evidence shows.
      const row = page.locator('[data-testid="answers-row"][data-status="assigned"]').first();
      const number = (await row.getAttribute('data-number')) ?? '';
      await row.click();
      await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
      await expect(detail(page).locator('[data-primary="true"]')).toHaveCount(1);
      await clearToasts(page);
      await checkAxe(page, '053 steering page DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('053-steuerung-de.png') });
      await setLang(page, 'en');
      await expect(pageTitle(page)).toHaveText('Steering');
      await expect(page.getByText('Open per answering unit')).toBeVisible();
      await clearToasts(page);
      await checkAxe(page, '053 steering page EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('053-steuerung-en.png') });
      await setLang(page, 'de');
    });
  });

  test('S2 Klassifizieren (mit S8)', async ({ page }) => {
    test.setTimeout(120_000);
    const number = await findSteerable(page, 'coordination', { status: 'captured', button: 'steering-classify' });
    await expect(page.getByTestId('steering-classify')).toHaveAttribute('data-primary', 'true');
    const noneBefore = await countOf(noUnitCell(page));
    const seatsBefore = await page.getByTestId('steering-seat-cell').evaluateAll((els) => els.map((el) => el.getAttribute('data-count')));

    const fillClassify = async (): Promise<void> => {
      await page.getByTestId('steering-classify').click();
      await page.getByTestId('classify-track-expert_track').click();
      await page.getByTestId('classify-stage').selectOption('cfo');
    };
    await fillClassify();
    await clearToasts(page);
    await checkAxe(page, '053 classify dialog DE');
    // S8 in English too: the language toggle is behind the backdrop — close, switch, open again.
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await setLang(page, 'en');
    await fillClassify();
    await clearToasts(page);
    await checkAxe(page, '053 classify dialog EN');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await setLang(page, 'de');
    await fillClassify();
    await page.getByTestId('classify-save').click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
    await expect(detail(page)).toContainText('klassifiziert');
    await expect(detail(page)).toContainText('Pfad C'); // the track badge (short label of expert_track)
    await expect(page.getByTestId('steering-detail-seat')).toHaveText('Finanzvorstand');
    // The question still has no unit and is not on the podium: neither strip moves.
    await expect.poll(() => countOf(noUnitCell(page))).toBe(noneBefore);
    expect(await page.getByTestId('steering-seat-cell').evaluateAll((els) => els.map((el) => el.getAttribute('data-count')))).toEqual(seatsBefore);
    // takt-008: the focus goes to the primary action of the new version.
    await expect(detail(page).locator('[data-primary="true"]')).toBeFocused();
  });

  test('S2b Fokus bleibt, wo die Person arbeitet: fremder Schreibvorgang bei Fokus im Suchfeld (schreibt eine Zuweisung)', async ({ page }) => {
    // Review 053, minor 3a/3c. In-process only: the write that does not come from this page is made through the demo's
    // own HvApi module, which only the dev server serves; in `http` this file must not leave an extra write behind.
    test.skip(isHttp(), 'the foreign write goes through the demo module of the dev server');
    test.setTimeout(120_000);
    const number = await findSteerable(page, 'coordination', { status: 'classified', button: 'steering-assign' });
    // A cancelled classify dialog arms nothing a later write could use (3c) …
    await page.getByTestId('steering-classify').click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    // … and a version that arrives while the person types in the search field leaves the focus there (3a).
    const search = page.getByTestId('answers-search');
    await search.focus();
    await expect(search).toBeFocused();
    const outcome = await page.evaluate(async ([url, wanted, unitId]) => {
      const mod = (await import(/* @vite-ignore */ url!)) as {
        api: {
          listQuestions: (f: { q: string; limit: number }) => Promise<{ items: { id: string; number: string; version: number }[] }>;
          assignQuestion: (id: string, unit: string, o: { ifMatch: string }) => Promise<unknown>;
        };
      };
      const found = (await mod.api.listQuestions({ q: wanted!, limit: 50 })).items.find((item) => item.number === wanted);
      if (found === undefined) return 'not found';
      await mod.api.assignQuestion(found.id, unitId!, { ifMatch: `"v${found.version}"` });
      return 'written';
    }, ['/src/api/index.ts', number, SOURCE_UNIT_ID]);
    expect(outcome).toBe('written');
    await expect(page.getByTestId('steering-detail-unit')).toHaveText(SOURCE_UNIT);
    await expect(detail(page)).toContainText('zugewiesen');
    await expect(search).toBeFocused();
  });

  test('S3 Zuweisen', async ({ page }) => {
    test.setTimeout(120_000);
    const number = await findSteerable(page, 'coordination', { status: 'classified', button: 'steering-assign' });
    await expect(page.getByTestId('steering-assign')).toHaveAttribute('data-primary', 'true');
    await expect(page.getByTestId('steering-classify')).toBeVisible();
    await expect(page.getByTestId('steering-classify')).not.toHaveAttribute('data-primary', 'true');
    await expect(page.getByTestId('steering-refuse')).toBeVisible();
    await expect(page.getByTestId('steering-forward')).toHaveCount(0);
    const sourceBefore = await countOf(unitCell(page, SOURCE_UNIT_ID));
    const noneBefore = await countOf(noUnitCell(page));

    await page.getByTestId('steering-assign').click();
    await page.getByTestId('answer-assign-unit').selectOption(SOURCE_UNIT_ID);
    await page.getByTestId('answer-assign-submit').click();
    await expect(dialog(page)).toHaveCount(0);

    await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
    await expect(page.getByTestId('steering-detail-unit')).toHaveText(SOURCE_UNIT);
    await expect(detail(page)).toContainText('zugewiesen');
    // Live over the stream: the unit gains one, "Ohne Fachbereich" loses one.
    await expect.poll(() => countOf(unitCell(page, SOURCE_UNIT_ID))).toBe(sourceBefore + 1);
    await expect.poll(() => countOf(noUnitCell(page))).toBe(noneBefore - 1);
    await expect(detail(page).locator('[data-primary="true"]')).toBeFocused();
  });

  test('S4 An anderen Fachbereich weiterleiten (mit S8) @screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    const number = await findSteerable(page, 'coordination', {
      status: 'assigned',
      button: 'steering-forward',
      unitName: SOURCE_UNIT,
    });
    await expect(page.getByTestId('steering-forward')).toHaveAttribute('data-primary', 'true');
    await expect(page.getByTestId('steering-assign')).toHaveCount(0);
    const sourceBefore = await countOf(unitCell(page, SOURCE_UNIT_ID));
    const targetBefore = await countOf(unitCell(page, TARGET_UNIT_ID));

    await test.step('the dialog: nothing preselected, the source not offered, locked until both are chosen', async () => {
      await openForward(page);
      const submit = page.getByTestId('forward-submit');
      await expectForwardEmpty(page);
      // Acceptance criterion 3: the German image shows the dialog as it opens — the note on who reads afterwards, and
      // neither target nor reason preselected. The English image below shows it with both chosen.
      await clearToasts(page);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('053-weiterleiten-de.png') });
      const options = await page.getByTestId('forward-unit').locator('option').allTextContents();
      expect(options).not.toContain(SOURCE_UNIT);
      expect(options).toContain(TARGET_UNIT);
      await page.getByTestId('forward-unit').selectOption({ label: TARGET_UNIT });
      await expect(submit).toHaveAttribute('aria-disabled', 'true');
      await page.getByTestId('forward-unit').selectOption('');
      await page.getByTestId('forward-reason-expertise_elsewhere').check();
      await expect(submit).toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByTestId('forward-readers')).toBeVisible();
      await expect(dialog(page).locator('textarea, input:not([type="radio"])')).toHaveCount(0);
      await page.getByTestId('forward-unit').selectOption({ label: TARGET_UNIT });
      await expect(page.getByTestId('forward-reason-expertise_elsewhere')).toBeChecked();
      await expect(submit).not.toHaveAttribute('aria-disabled', 'true');
      await clearToasts(page);
      await checkAxe(page, '053 forward dialog DE');
    });

    await test.step('English: the language toggle is behind the backdrop — close, switch, open again (starts empty)', async () => {
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await setLang(page, 'en');
      await openForward(page);
      await expectForwardEmpty(page);
      await page.getByTestId('forward-unit').selectOption({ label: TARGET_UNIT });
      await page.getByTestId('forward-reason-expertise_elsewhere').check();
      await expect(page.getByTestId('forward-readers')).toHaveText(
        'Afterwards the target answering unit reads the question with its return reason and history.',
      );
      await clearToasts(page);
      await checkAxe(page, '053 forward dialog EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('053-weiterleiten-en.png') });
    });

    await test.step('forward: the unit changes, the status stays, focus and cells follow', async () => {
      await page.getByTestId('forward-submit').click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.getByTestId('steering-detail-number')).toHaveText(number);
      await expect(page.getByTestId('steering-detail-unit')).toHaveText(TARGET_UNIT);
      await expect(detail(page)).toContainText('assigned');
      await expect(detail(page).locator('[data-primary="true"]')).toBeFocused();
      await expect.poll(() => countOf(unitCell(page, SOURCE_UNIT_ID))).toBe(sourceBefore - 1);
      await expect.poll(() => countOf(unitCell(page, TARGET_UNIT_ID))).toBe(targetBefore + 1);
      await setLang(page, 'de');
    });

    await test.step('the history names the forward with the change of unit and the reason', async () => {
      await page.getByTestId('nav-history').click();
      await page.getByTestId('history-search').fill(number);
      await page.getByTestId('history-result').filter({ hasText: number }).first().click();
      const forwarded = page.locator('[data-testid="history-event"][data-type="QuestionForwarded"]').last();
      await expect(forwarded).toContainText('An anderen Fachbereich weitergeleitet');
      await expect(forwarded).toContainText(`${SOURCE_UNIT} → ${TARGET_UNIT}`);
      await expect(forwarded).toContainText('Grund: Fachwissen liegt in einem anderen Fachbereich');
    });
  });

  test('S5 Rechte als Daten (schreibt nichts)', async ({ page }) => {
    test.setTimeout(180_000);
    await test.step('capture: the list, but no steering button', async () => {
      await asRole(page, 'capture');
      await toSteering(page);
      await expect(page.getByTestId('nav-steering')).toBeVisible();
      await page.getByTestId('answers-filter-status-all').click();
      await rows(page).first().click();
      await expect(page.getByTestId('steering-detail-number')).toBeVisible();
      for (const id of ['steering-classify', 'steering-assign', 'steering-forward', 'steering-refuse']) {
        await expect(page.getByTestId(id)).toHaveCount(0);
      }
      await expect(page.getByTestId('steering-actions')).toHaveCount(0);
    });

    await test.step('approver: assign on a classified text-track question, never classify or forward', async () => {
      await findSteerable(page, 'approver', { status: 'classified', button: 'steering-assign' });
      await expect(page.getByTestId('nav-steering')).toBeVisible();
      await expect(page.getByTestId('steering-classify')).toHaveCount(0);
      await expect(page.getByTestId('steering-forward')).toHaveCount(0);
      await findSteerable(page, 'approver', { status: 'assigned', button: 'steering-assign' });
      await expect(page.getByTestId('steering-forward')).toHaveCount(0);
    });

    await test.step('podium: its own read state, no list, no distribution', async () => {
      await asRole(page, 'podium');
      await page.goto('/steering');
      await expect(page.getByTestId('steering-forbidden')).toBeVisible();
      await expect(page.getByTestId('nav-steering')).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
      await expect(page.getByTestId('steering-distribution')).toHaveCount(0);
      await expect(page.getByTestId('answers-forbidden')).toHaveCount(0);
    });
  });

  test('S6 Eingaben je Akteur und je Frage (schreibt nichts)', async ({ page }) => {
    test.setTimeout(180_000);
    const x = await findSteerable(page, 'coordination', { status: 'assigned', button: 'steering-forward' });
    await openForward(page);
    await page.getByTestId('forward-unit').selectOption({ index: 1 });
    await page.getByTestId('forward-reason-capacity').check();

    if (isHttp()) {
      // A person is a session: the switch reloads, and the open dialog with it.
      await asRole(page, 'capture');
    } else {
      // The backdrop covers the header; another person takes the device all the same (090).
      await switchActorUnderDialog(page, 'capture');
    }
    await expect(dialog(page)).toHaveCount(0);
    await asRole(page, 'coordination');
    await openInSteering(page, x);
    await openForward(page);
    await expectForwardEmpty(page);

    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    const y = await findSteerable(page, 'coordination', { status: 'assigned', button: 'steering-forward', exclude: [x] });
    await openForward(page);
    await expectForwardEmpty(page);
    await page.keyboard.press('Escape');
    await openInSteering(page, x);
    await openForward(page);
    await expectForwardEmpty(page);
    await page.keyboard.press('Escape');
    expect(y).not.toBe(x);
  });

  test('S7 Tastatur: Zelle per Tab und Enter, Dialog ganz per Tastatur (schreibt nichts)', async ({ page }) => {
    test.setTimeout(120_000);
    await asRole(page, 'coordination');
    await toSteering(page);
    const first = page.getByTestId('steering-unit-cell').first();
    await expect(first).toBeVisible();
    const firstUnit = (await first.getAttribute('data-unit')) ?? '';

    await pageTitle(page).click();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await expect(first).toHaveCSS('outline-style', /solid|auto/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('answers-filter-unit')).toHaveValue(firstUnit);
    await expect(first).toHaveAttribute('aria-pressed', 'true');

    await findSteerable(page, 'coordination', { status: 'assigned', button: 'steering-forward' });
    await page.getByTestId('steering-forward').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('forward-submit')).toBeVisible();
    // The kit's dialog starts on its close button; Tab reaches the choice of unit next.
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('forward-unit')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('forward-unit')).not.toHaveValue('');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('forward-reason-wrong_unit')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('forward-reason-expertise_elsewhere')).toBeChecked();
    const submit = page.getByTestId('forward-submit');
    for (let i = 0; i < 6 && !(await submit.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
    await expect(submit).not.toHaveAttribute('aria-disabled', 'true');
    // Not pressed: Escape closes without writing (045 E7).
    const before = await page.getByTestId('steering-detail-unit').textContent();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByTestId('steering-detail-unit')).toHaveText(before ?? '');
  });

  test('S9 Verweigerung vorschlagen aus der Steuerung (schreibt nichts)', async ({ page }) => {
    test.setTimeout(120_000);
    await findSteerable(page, 'coordination', { status: 'assigned', button: 'steering-refuse' });
    const refuse = page.getByTestId('steering-refuse');
    await expect(refuse).not.toHaveAttribute('data-primary', 'true');
    await refuse.click();
    await expect(dialog(page)).toContainText('Verweigerung vorschlagen');
    await expect(page.getByTestId('answer-refuse-kind-refusal_no_claim')).not.toBeChecked();
    await expect(page.getByTestId('answer-refuse-kind-refusal_with_ground')).not.toBeChecked();
    await expect(page.getByTestId('answer-refuse-submit')).toHaveAttribute('aria-disabled', 'true');
    await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test('S10 Zeit (weich): Statusfilter und Drill-down', async ({ page }) => {
    test.setTimeout(120_000);
    await asRole(page, 'coordination');
    await toSteering(page);
    await expect(rows(page).first()).toBeVisible();

    let started = Date.now();
    await page.getByTestId('answers-filter-status-classified').click();
    await expectEveryRow(page, 'data-status', 'classified');
    const statusMs = Date.now() - started;

    await page.getByTestId('answers-filter-status-all').click();
    started = Date.now();
    await unitCell(page, SOURCE_UNIT_ID).click();
    await expectEveryRow(page, 'data-unit', SOURCE_UNIT_ID);
    const drillMs = Date.now() - started;

    console.log(`[timing] 053 steering status filter ${statusMs} ms, drill-down ${drillMs} ms (${test.info().project.name}, 230)`);
    expect(statusMs).toBeLessThan(1500);
    expect(drillMs).toBeLessThan(1500);
  });
});
