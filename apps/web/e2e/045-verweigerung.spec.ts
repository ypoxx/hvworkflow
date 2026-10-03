/**
 * Scheibe 045 — Verweigerung in Beantwortung, Bühne und Historie (docs/slices/045-verweigerung-oberflaeche.md).
 *
 * A refusal (Verweigerung) is proposed in the answer detail, legally cleared, approved, put on the podium, shown there
 * with its marker, and named in the history; the justification (Begründung) is seen only by those whose record carries
 * it, never on the podium. Every button is taken from `_actions` (AGENTS.md R4); the roles are only switched here.
 *
 * Runs in both projects. `in-process`: every test starts with a fresh demo state (own browser context), so
 * `--repeat-each=3` is independent. `http`: the database persists across files (path order: after 031, before 080 and
 * abnahme). End state after this file in `http`:
 *   - question of E1: returned to `answer_drafted` (the refusal as its latest version, return reason "e2e 045"), NOT on
 *     the podium; the podium carries exactly the questions it carried before the file, in the same order (E1 compares
 *     `stage-queue` before and after);
 *   - question of E3: `in_review` with a refusal "kein Auskunftsanspruch";
 *   - E4b, E6, E7 and E9 write nothing.
 * The questions are never fixed numbers: `findRefusableQuestion` picks the first `assigned` one that offers the
 * proposal. `abnahme.spec.ts` captures its own questions and `080-sprecher-zustand.spec.ts` touches only speakers, so
 * neither needs an exclusion (pre-build check 4).
 */
import { CORPUS_DEMO } from '@hv/domain';
import type { Page } from '@playwright/test';
import { checkAxe } from './support/axe';
import {
  REFUSAL_045_JUSTIFICATION as JUSTIFICATION,
  REFUSAL_045_NO_CLAIM_JUSTIFICATION as NO_CLAIM_JUSTIFICATION,
  REFUSAL_045_NO_CLAIM_WORDING as NO_CLAIM_WORDING,
  REFUSAL_045_RETURN_REASON as RETURN_REASON,
  REFUSAL_045_UNSENT_JUSTIFICATION as UNSENT_JUSTIFICATION,
  REFUSAL_045_UNSENT_WORDING as UNSENT_WORDING,
} from './support/e2e-texts';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

/**
 * The unit of the expert test person, as the unit filter names it (`shortName`): `unit-fin` "Finanzen" — the demo
 * persona `u-exp-fin` (apps/web/src/api/actor.ts) and the http person `expert` bound to `unit-fin`
 * (scripts/e2e-http-031.mjs, PERSONS). Pre-build check 7: four `assigned` text-track questions there.
 */
const EXPERT_UNIT = 'Finanzen';

/** The marker beside the wording field (`answers.refusal.text.marker`), de and en. */
const MARKER = /Formulierungsbaustein, ungeprüft \(E15\)|Template wording, unverified \(E15\)/;

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

async function toAnswers(page: Page): Promise<void> {
  if (!/\/answers$/.test(page.url())) await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
}

/** Opens a question by number at the answer desk, with every filter reset — the same motion at every desk. */
async function openInAnswers(page: Page, number: string): Promise<void> {
  await toAnswers(page);
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-unit').selectOption({ index: 0 });
  await page.getByTestId('answers-search').fill(number);
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-number', number);
  await row.click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
}

/**
 * The one helper of this file (review finding N1a): as `role`, the first `assigned` question whose detail offers
 * "Verweigerung vorschlagen", whose latest version is not a refusal and whose number is not excluded. Never a fixed
 * number (pattern of 021c-rechtsfreigabe.spec.ts).
 */
async function findRefusableQuestion(
  page: Page,
  role: string,
  opts?: { unitName?: string; exclude?: readonly string[] },
): Promise<string> {
  await asRole(page, role);
  await toAnswers(page);
  await page.getByTestId('answers-search').fill('');
  await page.getByTestId('answers-filter-status-all').click();
  await page.getByTestId('answers-filter-status-assigned').click();
  await expect(page.getByTestId('answers-filter-status-assigned')).toHaveAttribute('aria-pressed', 'true');
  const unit = page.getByTestId('answers-filter-unit');
  if (opts?.unitName !== undefined) await unit.selectOption({ label: opts.unitName });
  else await unit.selectOption({ index: 0 });
  const rows = page.getByTestId('answers-row');
  await expect(rows.first()).toBeVisible();
  const exclude = opts?.exclude ?? [];
  for (let i = 0; i < Math.min(await rows.count(), 20); i++) {
    const row = rows.nth(i);
    const number = (await row.getAttribute('data-number')) ?? '';
    if (exclude.includes(number) || (await row.getByTestId('answers-row-refusal').count()) > 0) continue;
    await row.click();
    // The selected question is read on its own in `http`; its actions are known once its number shows in the detail.
    await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
    if (await page.getByTestId('answer-refuse').isVisible()) return number;
  }
  throw new Error(`No refusable assigned question for ${role}.`);
}

const dialog = (page: Page) => page.getByRole('dialog');

async function openRefusalDialog(page: Page): Promise<void> {
  await page.getByTestId('answer-refuse').click();
  await expect(page.getByTestId('answer-refuse-submit')).toBeVisible();
}

/** "Grund aus Katalog" with the first ground: the template lands in the field, the marker beside it. */
async function chooseFirstGround(page: Page): Promise<string> {
  await page.getByTestId('answer-refuse-kind-refusal_with_ground').check();
  const ground = page.getByTestId('answer-refuse-ground');
  await expect(ground).toBeVisible();
  await ground.selectOption({ index: 1 });
  const title = (await ground.locator('option:checked').innerText()).trim();
  await expect(page.getByTestId('answer-refuse-text')).not.toHaveValue('');
  return title;
}

async function stageNumbers(page: Page): Promise<string[]> {
  const current = page.getByTestId('stage-current-number');
  const numbers: string[] = [];
  if ((await current.count()) > 0) numbers.push(`current:${(await current.innerText()).trim()}`);
  const next = page.getByTestId('stage-next-preview');
  if ((await next.count()) > 0) numbers.push(`next:${(await next.locator('span.font-mono').first().innerText()).trim()}`);
  for (const item of await page.getByTestId('stage-queue-item').all()) numbers.push(`queue:${await item.getAttribute('data-number')}`);
  const remaining = page.getByTestId('stage-queue-remaining');
  if ((await remaining.count()) > 0) numbers.push(`remaining:${(await remaining.innerText()).trim()}`);
  return numbers;
}

async function toStage(page: Page): Promise<void> {
  if (!/\/stage$/.test(page.url())) await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current')).toBeVisible();
  // A role that may only read out starts in "Nur Bühne" (fullscreen, no header); this file needs the header
  // (language, role), so it leaves that mode. Queue, preview and keys are the same in both layouts.
  const only = page.getByTestId('stage-only-toggle');
  if ((await only.count()) > 0 && (await only.getAttribute('aria-pressed')) === 'true') {
    await only.click();
    await expect(only).toHaveAttribute('aria-pressed', 'false');
  }
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

/** The justification is nowhere in the DOM (text or attribute), not only invisible. */
async function expectNotInDom(page: Page, sentence: string): Promise<void> {
  expect(await page.content()).not.toContain(sentence);
}

test.describe.serial('045 Verweigerung in Beantwortung, Bühne und Historie', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/answers');
    await waitForCorpus(page);
  });

  test('E1 Grund aus Katalog, ganzer Weg (mit E2, E4a, E5, E8) @screenshot', async ({ page }) => {
    test.setTimeout(240_000);
    let number = '';
    let title = '';
    let version = '';

    await test.step('E1: coordination proposes a refusal with a ground from the catalogue', async () => {
      number = await findRefusableQuestion(page, 'coordination', { unitName: EXPERT_UNIT });
      await openRefusalDialog(page);
      const submit = page.getByTestId('answer-refuse-submit');
      await expect(submit).toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByTestId('answer-refuse-kind-refusal_no_claim')).not.toBeChecked();
      await expect(page.getByTestId('answer-refuse-kind-refusal_with_ground')).not.toBeChecked();
      await page.getByTestId('answer-refuse-kind-refusal_with_ground').check();
      await expect(submit).toHaveAttribute('aria-disabled', 'true');

      title = await chooseFirstGround(page);
      const text = page.getByTestId('answer-refuse-text');
      const value = await text.inputValue();
      expect(value).not.toMatch(MARKER);
      await expect(page.getByTestId('answer-refuse-marker')).toHaveText(MARKER);
      await expect(page.getByTestId('answer-refuse-ground-unverified')).toBeVisible();
      await expect(page.getByTestId('answer-refuse-ground-info')).toContainText(title);
      await expect(submit).toHaveAttribute('aria-disabled', 'true');
      await page.getByTestId('answer-refuse-justification').fill(JUSTIFICATION);
      await expect(submit).not.toHaveAttribute('aria-disabled', 'true');

      await clearToasts(page);
      await checkAxe(page, '045 refusal dialog DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('045-dialog-de.png') });

      // The language toggle sits behind the modal backdrop: close, switch, open again — every opening starts empty.
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await setLang(page, 'en');
      await openRefusalDialog(page);
      await expect(page.getByTestId('answer-refuse-text')).toHaveValue('');
      await chooseFirstGround(page);
      await page.getByTestId('answer-refuse-justification').fill(JUSTIFICATION);
      await expect(page.getByTestId('answer-refuse-marker')).toHaveText('Template wording, unverified (E15)');
      await checkAxe(page, '045 refusal dialog EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('045-dialog-en.png') });

      await submit.click();
      await expect(dialog(page)).toHaveCount(0);
      const latest = page.getByTestId('answer-version').last();
      await expect(latest).toContainText('Refusal · ground from catalogue');
      version = (await latest.getAttribute('data-version')) ?? '';
      await expect(latest.getByTestId('answer-refusal-ground')).toContainText(title);
      await expect(latest.getByTestId('answer-refusal-justification')).toContainText(JUSTIFICATION);
      await expect(latest.getByTestId('answer-version-toggle')).toBeFocused();
      await expect(page.getByTestId('approval-block')).toContainText(/legal clearing/i);
      await setLang(page, 'de');
    });

    await test.step('E5 (proposal): the history names the proposal with the ground from the snapshot', async () => {
      await page.getByTestId('nav-history').click();
      await page.getByTestId('history-search').fill(number);
      await page.getByTestId('history-result').filter({ hasText: number }).first().click();
      const proposed = page.locator('[data-testid="history-event"][data-type="AnswerDrafted"]').last();
      await expect(proposed).toContainText('Verweigerung vorgeschlagen');
      await expect(proposed).toContainText(`Verweigerung · Grund aus Katalog: ${title}`);
      await expectNotInDom(page, JUSTIFICATION);
    });

    await test.step('E2 (expert part, in_review between proposal and legal clearance): look only, write nothing', async () => {
      await asRole(page, 'expert');
      await openInAnswers(page, number);
      await expect(page.getByTestId('answer-refuse')).toHaveCount(0);
      await expect(page.getByTestId('answer-refusal-justification')).toHaveCount(0);
      await expectNotInDom(page, JUSTIFICATION);
      await expect(page.getByTestId('answer-editor')).toBeVisible();
      await expect(page.getByTestId('answer-editor-refusal-hint')).toContainText('verdrängt die Verweigerung');
      await page.getByTestId('nav-history').click();
      await page.getByTestId('history-search').fill(number);
      await page.getByTestId('history-result').filter({ hasText: number }).first().click();
      await expect(page.getByTestId('history-timeline')).toBeVisible();
      await expectNotInDom(page, JUSTIFICATION);
    });

    await test.step('E1: approval needs the legal clearance first (R-GUARD-12)', async () => {
      await asRole(page, 'approver');
      await openInAnswers(page, number);
      await expect(page.getByTestId('answer-refuse-approve')).toHaveCount(0);
      await asRole(page, 'legal');
      await openInAnswers(page, number);
      await page.getByTestId('answer-legal-clear').click();
      await expect(page.getByTestId('legal-clearance-block')).toBeVisible();
    });

    let queueBefore: string[] = [];
    await test.step('E1: approver approves the refusal and puts it on the podium (E8 detail)', async () => {
      await asRole(page, 'approver');
      await openInAnswers(page, number);
      const approve = page.getByTestId('answer-refuse-approve');
      await expect(approve).toHaveText(`Verweigerung freigeben (Version ${version})`);
      await expect(page.getByTestId('answer-approve')).toHaveCount(0);
      await expect(page.getByTestId('answer-refusal-justification')).toContainText(JUSTIFICATION);
      await approve.click();
      await expect(page.getByTestId('approval-block')).toContainText(`Version ${version}`);
      await clearToasts(page);
      await checkAxe(page, '045 refusal detail DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('045-detail-de.png') });
      await setLang(page, 'en');
      await expect(page.getByTestId('answer-version').last()).toContainText('Refusal · ground from catalogue');
      await checkAxe(page, '045 refusal detail EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('045-detail-en.png') });
      await setLang(page, 'de');

      await toStage(page);
      queueBefore = await stageNumbers(page);
      await openInAnswers(page, number);
      await page.getByTestId('answer-stage').click();
      await expect(page.getByTestId('answers-detail')).toContainText('auf der Bühne');
    });

    await test.step('E1: the podium shows the marker, the ground and the wording; never the justification', async () => {
      await asRole(page, 'podium');
      await toStage(page);
      await clearToasts(page);
      const next = page.getByTestId('stage-next-preview');
      const inQueue = page.locator(`[data-testid="stage-queue-item"][data-number="${number}"]`);
      if ((await inQueue.count()) > 0) {
        await expect(inQueue.getByTestId('stage-queue-refusal')).toBeVisible();
      } else {
        await expect(next).toContainText(number);
        await expect(next.getByTestId('stage-refusal-marker')).toBeVisible();
      }
      const openPreview = async (): Promise<void> => {
        if ((await inQueue.count()) > 0) await inQueue.getByRole('button').click();
        else await next.click();
        await expect(page.getByTestId('stage-preview-number')).toHaveText(number);
      };
      await openPreview();
      const preview = page.getByTestId('stage-preview');
      await expect(preview.getByTestId('stage-refusal-marker')).toContainText('Auskunft wird verweigert');
      await expect(preview.getByTestId('stage-refusal-ground')).toContainText(`Grund: ${title}`);
      await expect(preview.getByTestId('stage-refusal-ground')).toContainText('ungeprüft');
      await expect(page.getByTestId('stage-preview-answer')).not.toHaveText('');
      await expectNotInDom(page, JUSTIFICATION);
      await checkAxe(page, '045 podium preview DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('045-buehne-de.png') });
      await page.keyboard.press('Escape');
      await setLang(page, 'en');
      await openPreview();
      await expect(page.getByTestId('stage-preview').getByTestId('stage-refusal-marker')).toContainText('Information is refused');
      await expectNotInDom(page, JUSTIFICATION);
      await checkAxe(page, '045 podium preview EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('045-buehne-en.png') });
      await page.keyboard.press('Escape');
      await setLang(page, 'de');
    });

    await test.step('E2 (after staging): approver sees the justification only in the answer view; moderation nowhere', async () => {
      await asRole(page, 'approver');
      await toStage(page);
      await expectNotInDom(page, JUSTIFICATION);
      await openInAnswers(page, number);
      await expect(page.getByTestId('answer-refusal-justification')).toContainText(JUSTIFICATION);

      await asRole(page, 'moderation');
      await openInAnswers(page, number);
      await expect(page.getByTestId('answer-refuse')).toHaveCount(0);
      await expectNotInDom(page, JUSTIFICATION);
      await page.getByTestId('nav-history').click();
      await page.getByTestId('history-search').fill(number);
      await page.getByTestId('history-result').filter({ hasText: number }).first().click();
      await expect(page.getByTestId('history-timeline')).toBeVisible();
      await expectNotInDom(page, JUSTIFICATION);
      await toStage(page);
      await expectNotInDom(page, JUSTIFICATION);
    });

    await test.step('E5 (approval): "Verweigerung freigegeben" in the history', async () => {
      await asRole(page, 'approver');
      await page.getByTestId('nav-history').click();
      await page.getByTestId('history-search').fill(number);
      await page.getByTestId('history-result').filter({ hasText: number }).first().click();
      const timeline = page.getByTestId('history-timeline');
      await expect(timeline.locator('[data-testid="history-event"][data-type="QuestionApproved"]').last())
        .toContainText('Verweigerung freigegeben');
      await expect(timeline.locator('[data-testid="history-event"][data-type="AnswerDrafted"]').last())
        .toContainText(`Verweigerung · Grund aus Katalog: ${title}`);
      await expectNotInDom(page, JUSTIFICATION);
    });

    await test.step('E4a (podium, in-process only): R on the refusal shows the warning, though the podium has no justification', async () => {
      // Skipped in `http`: reading out the questions ahead would change the database state that
      // 080-sprecher-zustand.spec.ts and abnahme.spec.ts build on. Test 13 (stage/lib.test.ts) proves the rule there.
      if (isHttp()) return;
      await asRole(page, 'podium');
      await toStage(page);
      for (let i = 0; i < 20; i++) {
        if ((await page.getByTestId('stage-current-number').innerText()).trim() === number) break;
        const before = (await page.getByTestId('stage-current-number').innerText()).trim();
        await page.getByTestId('stage-next').click();
        await expect(page.getByTestId('stage-current-number')).not.toHaveText(before);
      }
      await expect(page.getByTestId('stage-current-number')).toHaveText(number);
      await expect(page.getByTestId('stage-current').getByTestId('stage-refusal-marker')).toContainText('Auskunft wird verweigert');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('r');
      await expect(page.getByTestId('stage-return-reason-note')).toContainText('Keine Begründung in den Rückgabegrund');
      await expect(page.getByTestId('stage-return-reason')).toHaveAttribute('aria-describedby', /.+/);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('stage-return-reason')).toHaveCount(0);
      await expect(page.getByTestId('stage-current-number')).toHaveText(number);
    });

    await test.step('E4a (answer view, both projects): return with the warning; the question leaves the podium', async () => {
      await asRole(page, 'approver');
      await openInAnswers(page, number);
      await page.getByTestId('answer-return').click();
      await expect(page.getByTestId('answer-return-reason-note')).toContainText('Keine Begründung in den Rückgabegrund');
      await page.getByTestId('answer-return-reason').fill(RETURN_REASON);
      await page.getByTestId('answer-return-submit').click();
      await expect(page.getByTestId('answers-detail')).toContainText(RETURN_REASON);
      await toStage(page);
      await expect(page.locator(`[data-testid="stage-queue-item"][data-number="${number}"]`)).toHaveCount(0);
      await expect(page.getByTestId('stage-current')).not.toContainText(number);
      if (isHttp()) expect(await stageNumbers(page)).toEqual(queueBefore);
    });
  });

  test('E3 Kein Auskunftsanspruch: kein Grund, Wechsel nach Vorbefüllen, eigener Wortlaut', async ({ page }) => {
    test.setTimeout(120_000);
    await findRefusableQuestion(page, 'legal');
    await openRefusalDialog(page);
    const submit = page.getByTestId('answer-refuse-submit');
    const text = page.getByTestId('answer-refuse-text');
    const marker = page.getByTestId('answer-refuse-marker');

    await page.getByTestId('answer-refuse-kind-refusal_no_claim').check();
    await expect(page.getByTestId('answer-refuse-ground')).toHaveCount(0);
    await expect(text).toHaveValue('');
    await expect(marker).toHaveCount(0);
    await page.getByTestId('answer-refuse-justification').fill(NO_CLAIM_JUSTIFICATION);
    await expect(submit).toHaveAttribute('aria-disabled', 'true');

    // Switch after a prefill: an untouched template leaves with the ground.
    await chooseFirstGround(page);
    await expect(marker).toBeVisible();
    await page.getByTestId('answer-refuse-kind-refusal_no_claim').check();
    await expect(text).toHaveValue('');
    await expect(marker).toHaveCount(0);

    // An edited template stays, with its marker.
    await page.getByTestId('answer-refuse-kind-refusal_with_ground').check();
    await expect(text).not.toHaveValue('');
    await text.press('End');
    await text.pressSequentially(' Ergänzt');
    const edited = await text.inputValue();
    await page.getByTestId('answer-refuse-kind-refusal_no_claim').check();
    await expect(text).toHaveValue(edited);
    await expect(marker).toBeVisible();
    await text.fill('');
    await expect(marker).toHaveCount(0);

    await page.getByTestId('answer-refuse-justification').fill('');
    await text.fill(NO_CLAIM_WORDING);
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('answer-refuse-justification').fill(NO_CLAIM_JUSTIFICATION);
    await expect(submit).not.toHaveAttribute('aria-disabled', 'true');
    await submit.click();
    await expect(dialog(page)).toHaveCount(0);
    const latest = page.getByTestId('answer-version').last();
    await expect(latest).toContainText('Verweigerung · kein Auskunftsanspruch');
    await expect(latest).toContainText(NO_CLAIM_WORDING);
    await expect(latest.getByTestId('answer-refusal-ground')).toHaveCount(0);
  });

  test('E4b Kein Hinweis ohne Begründung im Datensatz (schreibt nichts)', async ({ page }) => {
    await asRole(page, 'legal');
    await toAnswers(page);
    await page.getByTestId('answers-filter-status-all').click();
    await page.getByTestId('answers-filter-status-in_review').click();
    const rows = page.getByTestId('answers-row');
    await expect(rows.first()).toBeVisible();
    let found = false;
    for (let i = 0; i < Math.min(await rows.count(), 20); i++) {
      const row = rows.nth(i);
      if ((await row.getByTestId('answers-row-refusal').count()) > 0) continue;
      const number = (await row.getAttribute('data-number')) ?? '';
      await row.click();
      await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
      if (!(await page.getByTestId('answer-return').isVisible())) continue;
      if ((await page.getByTestId('answer-refusal-justification').count()) > 0) continue;
      found = true;
      break;
    }
    expect(found).toBe(true);
    await page.getByTestId('answer-return').click();
    await expect(page.getByTestId('answer-return-reason')).toBeVisible();
    await expect(page.getByTestId('answer-return-reason-note')).toHaveCount(0);
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);

    if (isHttp()) return; // the podium part reads the current question of the shared database: in-process only
    await asRole(page, 'podium');
    await toStage(page);
    await expect(page.getByTestId('stage-current').getByTestId('stage-refusal-marker')).toHaveCount(0);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('r');
    await expect(page.getByTestId('stage-return-reason')).toBeVisible();
    await expect(page.getByTestId('stage-return-reason-note')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('stage-return-reason')).toHaveCount(0);
  });

  test('E6 Eingaben je Akteur (090): ein Akteurwechsel schließt den Dialog und verwirft die Eingaben', async ({ page }) => {
    test.setTimeout(120_000);
    const number = await findRefusableQuestion(page, 'legal');
    await openRefusalDialog(page);
    await page.getByTestId('answer-refuse-text').fill(UNSENT_WORDING);
    await page.getByTestId('answer-refuse-justification').fill(UNSENT_JUSTIFICATION);

    // A role with the right, a role without it, and back. After the first switch the dialog is gone; from then on a
    // MutationObserver watches that no field ever comes back carrying the old text (090).
    await switchWhileOpen(page, 'coordination');
    await expect(page.getByTestId('answer-refuse-submit')).toHaveCount(0);
    await expectNotInDom(page, UNSENT_WORDING);
    await expectNotInDom(page, UNSENT_JUSTIFICATION);
    await watchForTexts(page, [UNSENT_WORDING, UNSENT_JUSTIFICATION]);
    for (const role of ['moderation', 'legal']) {
      await switchWhileOpen(page, role);
      await expect(page.getByTestId('answer-refuse-submit')).toHaveCount(0);
      await expectNotInDom(page, UNSENT_WORDING);
      await expectNotInDom(page, UNSENT_JUSTIFICATION);
    }
    await openInAnswers(page, number);
    await openRefusalDialog(page);
    await expect(page.getByTestId('answer-refuse-text')).toHaveValue('');
    await expect(page.getByTestId('answer-refuse-justification')).toHaveValue('');
    if (!isHttp()) expect(await textsSeen(page)).toBe(false);
    await page.keyboard.press('Escape');
  });

  test('E7 Tastatur (D8): der Dialog ganz mit der Tastatur, Absenden fokussiert und aktiv, nicht ausgelöst', async ({ page }) => {
    await findRefusableQuestion(page, 'legal');
    await page.getByTestId('answer-refuse').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('answer-refuse-submit')).toBeVisible();

    const noClaim = page.getByTestId('answer-refuse-kind-refusal_no_claim');
    const withGround = page.getByTestId('answer-refuse-kind-refusal_with_ground');
    for (let i = 0; i < 6 && !(await noClaim.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(noClaim).toBeFocused();
    await page.keyboard.press('Space');
    await expect(noClaim).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(withGround).toBeChecked();
    await expect(withGround).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(noClaim).toBeChecked();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('answer-refuse-text')).toBeFocused();
    await page.keyboard.type(UNSENT_WORDING);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('answer-refuse-justification')).toBeFocused();
    await page.keyboard.type(UNSENT_JUSTIFICATION);
    const submit = page.getByTestId('answer-refuse-submit');
    for (let i = 0; i < 4 && !(await submit.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(submit).toBeFocused();
    await expect(submit).not.toHaveAttribute('aria-disabled', 'true');
    // The focus is visible: the browser draws a ring on the focused submit button.
    expect(await submit.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('answer-refuse-submit')).toHaveCount(0);
    await expect(page.getByTestId('answer-version')).toHaveCount(0);
  });

  test('E9 Eingaben je Frage: jede Frage, jedes Öffnen beginnt leer', async ({ page }) => {
    test.setTimeout(120_000);
    const x = await findRefusableQuestion(page, 'legal');
    await openRefusalDialog(page);
    await chooseFirstGround(page);
    await page.getByTestId('answer-refuse-justification').fill(UNSENT_JUSTIFICATION);
    await expect(page.getByTestId('answer-refuse-marker')).toBeVisible();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog(page)).toHaveCount(0);

    const y = await findRefusableQuestion(page, 'legal', { exclude: [x] });
    expect(y).not.toBe(x);
    const expectEmpty = async (): Promise<void> => {
      await openRefusalDialog(page);
      await expect(page.getByTestId('answer-refuse-kind-refusal_no_claim')).not.toBeChecked();
      await expect(page.getByTestId('answer-refuse-kind-refusal_with_ground')).not.toBeChecked();
      await expect(page.getByTestId('answer-refuse-text')).toHaveValue('');
      await expect(page.getByTestId('answer-refuse-justification')).toHaveValue('');
      await expect(page.getByTestId('answer-refuse-marker')).toHaveCount(0);
      await page.getByRole('button', { name: 'Abbrechen' }).click();
    };
    await expectEmpty();
    await openInAnswers(page, x);
    await expectEmpty();
  });
});

// ---- E6 helpers ------------------------------------------------------------------------------------------------------

const ACTOR_MODULE = '/src/api/actor.ts';

/**
 * A change of actor while the dialog is open. `in-process`: the call the demo switcher makes (its button is behind the
 * modal backdrop), started without awaiting in the page and polled, as in 090. `http`: a person is a session; the switch
 * replaces the session and reloads (`asRole`), which closes every dialog of the previous person by itself.
 */
async function switchWhileOpen(page: Page, role: string): Promise<void> {
  if (isHttp()) {
    await asRole(page, role);
    return;
  }
  await page.evaluate(
    ([url, wanted]) => {
      const w = window as unknown as { __switch045?: string };
      w.__switch045 = 'pending';
      void import(/* @vite-ignore */ url!).then(
        (mod: { DEMO_ACTORS: readonly { role: string }[]; setActor: (actor: unknown) => void }) => {
          mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
          w.__switch045 = 'done';
        },
        (error: unknown) => {
          w.__switch045 = `failed: ${String(error)}`;
        },
      );
    },
    [ACTOR_MODULE, role],
  );
  await expect.poll(() => page.evaluate(() => (window as unknown as { __switch045?: string }).__switch045)).toBe('done');
}

/** 090: a MutationObserver sees any field inserted with an old text before it is painted. */
async function watchForTexts(page: Page, needles: readonly string[]): Promise<void> {
  if (isHttp()) return; // the http switch reloads into a new document; the DOM checks cover it there
  await page.evaluate((list) => {
    const w = window as unknown as { __seen045?: boolean };
    w.__seen045 = false;
    const scan = (): void => {
      for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
        if (list.some((needle) => el.value.includes(needle))) w.__seen045 = true;
      }
    };
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }, needles);
}

async function textsSeen(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __seen045?: boolean }).__seen045 === true);
}
