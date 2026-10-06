/**
 * Scheibe 041 — Verwaltung /admin, erster Schnitt (docs/slices/041-admin-oberflaeche.md).
 *
 * The administration sets up the managed General Meeting on one page: header with state and version, role assignments
 * with answering unit and expiry, answering units, agenda and podium seats per entry (each write one whole-list
 * replacement with `If-Match`), role cards from the rights table. Every refusal of the service shows in the open dialog
 * with its rule id. Roles are switched only through `asRole` (AGENTS.md R4: test helpers may name roles).
 *
 * Runs in both projects. `in-process`: every test starts with a fresh demo state (own browser context). `http`: the
 * database persists across files (path order: after 031, before 045). This file leaves the state as it found it
 * (decision 11): it adds its own entries and removes them again, revokes every assignment it makes, and its refused
 * attempts change nothing; it renames no seed entry. Its one lasting trace is one revoked assignment of the synthetic
 * subject id `e2e-041-pruefung`. The second test compares units, agenda and seats with the start of the file, before and
 * after its own round trip.
 * Screenshots and the language switch run in `in-process` only (the evidence lives there; `http` saves the time).
 */
import { CORPUS_DEMO } from '@hv/domain';
import type { Locator, Page } from '@playwright/test';
import { checkAxe } from './support/axe';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';

/** Synthetic texts of this file (no real names, R11). */
const SUBJECT = 'e2e-041-pruefung';
const REVOKE_REASON = 'Synthetischer Grund der Prüfung 041';
const UNIT_NAME = 'E2E 041 Prüfbereich';
const UNIT_RENAMED = 'E2E 041 Prüfbereich neu';
const AGENDA_TITLE = 'E2E 041 Prüfpunkt';
const SEAT_LABEL = 'E2E 041 Prüfplatz';
const SEAT_DEVICE = 'geraet-041';
/** The unit with open questions and the expert's active assignment (seed `unit-fin`, short name "Finanzen"). */
const FIN = 'Finanzen';
const FIN_ID = 'unit-fin';

test.use({ viewport: { width: 1440, height: 900 } });

const isHttp = (): boolean => test.info().project.name === 'http';

/** What the file found at its start, for the comparison at its end (`http`: one database for the whole file). */
const start: { units?: string[]; agenda?: string[]; seats?: string[] } = {};

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

async function shot(page: Page, name: string): Promise<void> {
  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence(name) });
}

async function toAdmin(page: Page): Promise<void> {
  if (!/\/admin$/.test(page.url())) await page.getByTestId('nav-admin').click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('admin-meeting-version')).toBeVisible();
}

async function version(page: Page): Promise<number> {
  return Number(await page.getByTestId('admin-meeting-version').innerText());
}

async function openTab(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId(testId)).toHaveAttribute('aria-selected', 'true');
}

const dialog = (page: Page) => page.getByRole('dialog');
const problem = (page: Page) => page.getByTestId('admin-problem');
/** A master-data row by its name (the action cell carries the row's hooks). */
const entryCell = (page: Page, name: string): Locator => page.locator(`[data-testid="admin-row"][data-name="${name}"]`);
const entryRow = (page: Page, name: string): Locator => page.locator('tr').filter({ has: entryCell(page, name) });
const roleRow = (page: Page, subject: string): Locator =>
  page.locator('tr').filter({ has: page.getByTestId('admin-role-subject').getByText(subject, { exact: true }) });

/** The names of the rows of the open master-data tab, once the list has loaded. */
async function names(page: Page): Promise<string[]> {
  await expect(page.getByTestId('admin-loading')).toHaveCount(0);
  return page.getByTestId('admin-row').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-name') ?? ''));
}

/** Tomorrow's date in Berlin as the `datetime-local` input wants it. */
function tomorrowBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + 86_400_000));
}

/** Saves the open entry dialog and waits until it is gone and the version moved by one. */
async function saveEntry(page: Page, before: number): Promise<void> {
  await page.getByTestId('admin-entry-submit').click();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(() => version(page)).toBe(before + 1);
}

async function snapshot(page: Page): Promise<{ units: string[]; agenda: string[]; seats: string[] }> {
  await openTab(page, 'admin-tab-units');
  const units = await names(page);
  await openTab(page, 'admin-tab-agenda');
  const agenda = await names(page);
  await openTab(page, 'admin-tab-seats');
  const seats = await names(page);
  return { units, agenda, seats };
}

test.describe.serial('041 Verwaltung', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/speakers');
    await waitForCorpus(page);
  });

  test('E1 Überblick, E2 Zuordnen und Entziehen, E3 abgelehnte Zuordnung, E7 Tastatur @screenshot', async ({ page }) => {
    test.setTimeout(180_000);
    await asRole(page, 'admin');
    await toAdmin(page);
    if (isHttp()) Object.assign(start, await snapshot(page));
    await openTab(page, 'admin-tab-roles');

    await test.step('E1: header with title and version in mono; the roles tab first with rows; axe; DE/EN', async () => {
      await expect(page.getByTestId('admin-meeting')).toContainText(/Hauptversammlung/);
      await expect(page.getByTestId('admin-meeting-version')).toHaveClass(/font-mono/);
      await expect(page.getByRole('tab')).toHaveCount(6);
      await expect(page.getByTestId('admin-tab-roles')).toHaveAttribute('aria-selected', 'true');
      const rows = page.getByTestId('admin-role-subject');
      await expect(rows.first()).toBeVisible();
      // in-process: the start assignment of the demo; http: at least the nine assignments of the bootstrap.
      expect(await rows.count()).toBeGreaterThanOrEqual(isHttp() ? 9 : 1);
      if (!isHttp()) await expect(rows.getByText('u-exp-fin', { exact: true })).toBeVisible();
      await checkAxe(page, '041 admin roles DE');
      if (!isHttp()) {
        await shot(page, '041-rollen-de.png');
        await setLang(page, 'en');
        await expect(page.getByTestId('admin-tab-roles')).toHaveText('Role assignments');
        await checkAxe(page, '041 admin roles EN');
        await shot(page, '041-rollen-en.png');
        await setLang(page, 'de');
      }
    });

    await test.step('E7: "Rolle zuordnen" with Enter, Escape closes, the focus is back on the primary action', async () => {
      await page.getByTestId('admin-assign-open').focus();
      await page.keyboard.press('Enter');
      await expect(dialog(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
      await expect(page.getByTestId('admin-assign-open')).toBeFocused();
    });

    await test.step('E2: assign a unit-bound role with Finanzen and an expiry; the row is active with the expiry in mono', async () => {
      await page.getByTestId('admin-assign-open').click();
      await expect(page.getByTestId('admin-assign-submit')).toHaveAttribute('aria-disabled', 'true');
      await page.getByTestId('admin-assign-subject').fill(SUBJECT);
      await page.getByTestId('admin-assign-role').selectOption('expert');
      await expect(dialog(page)).toContainText('Diese Rolle liest nur Fragen ihres Fachbereichs');
      await page.getByTestId('admin-assign-unit').selectOption({ label: FIN });
      await page.getByTestId('admin-assign-expires').fill(`${tomorrowBerlin()}T18:00`);
      await page.getByTestId('admin-assign-submit').click();
      await expect(dialog(page)).toBeHidden();
      const row = roleRow(page, SUBJECT);
      await expect(row.getByTestId('admin-role-state')).toHaveAttribute('data-state', 'active');
      await expect(row.getByTestId('admin-role-expires')).toContainText('18:00');
      await expect(row.getByTestId('admin-role-expires')).toHaveClass(/font-mono/);
      await expect(row).toContainText(FIN);
      await expect(page.getByTestId('admin-assign-open')).toBeFocused();
    });

    await test.step('E2: revoke with a reason; gone from "only active", shown as revoked with the switch', async () => {
      await roleRow(page, SUBJECT).getByTestId('admin-revoke').click();
      await expect(dialog(page)).toContainText(SUBJECT);
      await page.getByTestId('admin-revoke-reason').fill(REVOKE_REASON);
      await page.getByTestId('admin-revoke-submit').click();
      await expect(dialog(page)).toBeHidden();
      await expect(roleRow(page, SUBJECT)).toHaveCount(0);
      await page.getByTestId('admin-roles-show-inactive').check();
      await expect(roleRow(page, SUBJECT).getByTestId('admin-role-state')).toHaveAttribute('data-state', 'revoked');
      await page.getByTestId('admin-roles-show-inactive').uncheck();
    });

    await test.step('E3: a refused assignment change keeps the dialog with text and rule id; nothing changes', async () => {
      const before = await version(page);
      if (isHttp()) {
        // The only row of the role that manages roles: revoking it would leave none (R-ADM-08).
        const cell = page.locator('[data-testid="admin-role-cell"][data-role="admin"]');
        await expect(cell).toHaveCount(1);
        const row = page.locator('tr').filter({ has: cell });
        await row.getByTestId('admin-revoke').click();
        await page.getByTestId('admin-revoke-submit').click();
        await expect(problem(page)).toContainText('R-ADM-08');
        await expect(problem(page)).toContainText('Die letzte gültige Zuordnung mit Rechteverwaltung bleibt.');
        await expect(dialog(page)).toBeVisible();
        await page.getByRole('button', { name: 'Abbrechen' }).click();
        await expect(row.getByTestId('admin-role-state')).toHaveAttribute('data-state', 'active');
      } else {
        // Assigning a role to one's own subject id (the demo persona's id) is refused by the core (R-ADM-07).
        await page.getByTestId('admin-assign-open').click();
        await page.getByTestId('admin-assign-subject').fill('u-admin');
        await page.getByTestId('admin-assign-role').selectOption('observer');
        await page.getByTestId('admin-assign-submit').click();
        await expect(problem(page)).toContainText('R-ADM-07');
        await expect(problem(page)).toContainText('Niemand ordnet sich selbst eine Rolle zu.');
        await expect(page.getByTestId('admin-assign-subject')).toHaveValue('u-admin');
        await page.getByTestId('admin-assign-cancel').click();
        await expect(dialog(page)).toBeHidden();
      }
      expect(await version(page)).toBe(before);
    });
  });

  test('E3 Fachbereich mit Bezug entfernen (R-ADM-02), E4 Stammdaten hin und zurück, E7 Fokus nach dem Speichern @screenshot', async ({ page }) => {
    test.setTimeout(240_000);
    await asRole(page, 'admin');
    await toAdmin(page);
    const before = await snapshot(page);
    // http: the first test changes no master data, so this is the state the file found.
    if (isHttp()) expect(before).toEqual(start);

    await test.step('E3: removing Finanzen is refused with R-ADM-02 in the dialog; list and version stay', async () => {
      await openTab(page, 'admin-tab-units');
      const units = await names(page);
      const v = await version(page);
      const languages = isHttp() ? (['de'] as const) : (['de', 'en'] as const);
      for (const lang of languages) {
        if (lang === 'en') await setLang(page, 'en');
        await entryCell(page, FIN).getByTestId('admin-row-remove').click();
        await page.getByTestId('admin-remove-submit').click();
        await expect(problem(page)).toContainText('R-ADM-02');
        await expect(problem(page)).toHaveAttribute('data-rule', 'R-ADM-02');
        if (lang === 'de') await checkAxe(page, '041 admin remove refused DE');
        if (!isHttp()) await shot(page, `041-abgelehnt-${lang}.png`);
        await page.getByTestId('admin-remove-cancel').click();
        await expect(dialog(page)).toBeHidden();
      }
      if (!isHttp()) await setLang(page, 'de');
      expect(await names(page)).toEqual(units);
      expect(await version(page)).toBe(v);
      await expect(entryCell(page, FIN)).toHaveAttribute('data-id', FIN_ID);
    });

    await test.step('E4: add a unit (open 0), version + 1; rename it (focus back on its edit button); remove it', async () => {
      const units = await names(page);
      let v = await version(page);
      await page.getByTestId('admin-units-add').click();
      await page.getByTestId('admin-entry-name').fill(UNIT_NAME);
      await saveEntry(page, v);
      v += 1;
      await expect(entryRow(page, UNIT_NAME).getByTestId('admin-unit-open')).toHaveText('0');
      await expect(page.getByTestId('admin-units-add')).toBeFocused();
      if (!isHttp()) {
        await shot(page, '041-fachbereiche-de.png');
        await setLang(page, 'en');
        await expect(page.getByTestId('admin-units-add')).toHaveText('Add answering unit');
        await shot(page, '041-fachbereiche-en.png');
        await setLang(page, 'de');
      }
      await entryCell(page, UNIT_NAME).getByTestId('admin-row-edit').click();
      await expect(page.getByTestId('admin-entry-name')).toHaveValue(UNIT_NAME);
      await page.getByTestId('admin-entry-name').fill(UNIT_RENAMED);
      await saveEntry(page, v);
      v += 1;
      await expect(entryCell(page, UNIT_RENAMED).getByTestId('admin-row-edit')).toBeFocused();
      await entryCell(page, UNIT_RENAMED).getByTestId('admin-row-remove').click();
      await page.getByTestId('admin-remove-submit').click();
      await expect(dialog(page)).toBeHidden();
      await expect.poll(() => version(page)).toBe(v + 1);
      await expect(entryCell(page, UNIT_RENAMED)).toHaveCount(0);
      expect(await names(page)).toEqual(units);
      await expect(page.getByTestId('admin-units-add')).toBeFocused();
    });

    await test.step('E4: add an agenda item with the prefilled next number, then remove it', async () => {
      await openTab(page, 'admin-tab-agenda');
      const agenda = await names(page);
      const numbers = agenda.map((name) => Number(name.split(' ')[0]));
      const v = await version(page);
      await page.getByTestId('admin-agenda-add').click();
      await expect(page.getByTestId('admin-entry-number')).toHaveValue(String(Math.max(0, ...numbers) + 1));
      await page.getByTestId('admin-entry-title').fill(AGENDA_TITLE);
      await saveEntry(page, v);
      const name = `${Math.max(0, ...numbers) + 1} ${AGENDA_TITLE}`;
      await expect(entryCell(page, name)).toHaveCount(1);
      await entryCell(page, name).getByTestId('admin-row-remove').click();
      await page.getByTestId('admin-remove-submit').click();
      await expect(dialog(page)).toBeHidden();
      await expect(entryCell(page, name)).toHaveCount(0);
      expect(await names(page)).toEqual(agenda);
    });

    await test.step('E4: add a podium seat with a device, then remove it', async () => {
      await openTab(page, 'admin-tab-seats');
      const seats = await names(page);
      const v = await version(page);
      await page.getByTestId('admin-seats-add').click();
      await page.getByTestId('admin-entry-label').fill(SEAT_LABEL);
      await page.getByTestId('admin-entry-deviceId').fill(SEAT_DEVICE);
      await saveEntry(page, v);
      await expect(entryRow(page, SEAT_LABEL)).toContainText(SEAT_DEVICE);
      await entryCell(page, SEAT_LABEL).getByTestId('admin-row-remove').click();
      await page.getByTestId('admin-remove-submit').click();
      await expect(dialog(page)).toBeHidden();
      await expect(entryCell(page, SEAT_LABEL)).toHaveCount(0);
      expect(await names(page)).toEqual(seats);
    });

    expect(await snapshot(page)).toEqual(before);
  });

  test('E5 Rollenkarten per Tastatur @screenshot', async ({ page }) => {
    await asRole(page, 'admin');
    await toAdmin(page);
    await openTab(page, 'admin-tab-roles');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('admin-tab-role-cards')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('admin-tab-role-cards')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('admin-role-cards-list')).toBeFocused();
    const card = page.getByTestId('admin-role-card');

    const goTo = async (role: string): Promise<void> => {
      for (let i = 0; i < 12 && (await card.getAttribute('data-role')) !== role; i++) await page.keyboard.press('ArrowDown');
      await expect(card).toHaveAttribute('data-role', role);
    };
    await goTo('coordination');
    await expect(card).toContainText('An anderen Fachbereich weiterleiten');
    await expect(page.locator('[data-testid="admin-role-card-option"][data-role="coordination"]')).toHaveAttribute('aria-selected', 'true');
    await goTo('expert');
    await expect(page.getByTestId('admin-role-card-unit-bound')).toHaveText('Liest nur Einzelfragen des zugeordneten Fachbereichs.');
    await page.keyboard.press('Home');
    await expect(page.getByTestId('admin-role-card-option').first()).toHaveAttribute('aria-selected', 'true');
    await goTo('coordination');
    await checkAxe(page, '041 admin role cards DE');
    if (!isHttp()) {
      await shot(page, '041-rollenkarten-de.png');
      await setLang(page, 'en');
      await expect(card).toContainText('Forward to another answering unit');
      await checkAxe(page, '041 admin role cards EN');
      await shot(page, '041-rollenkarten-en.png');
      await setLang(page, 'de');
    }
  });

  test('E6 Gesperrt ohne das Recht @screenshot', async ({ page }) => {
    await asRole(page, 'capture');
    await page.getByTestId('nav-admin').click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId('admin-forbidden')).toBeVisible();
    await expect(page.getByTestId('admin-forbidden')).toContainText('Rollen zuordnen');
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await checkAxe(page, '041 admin locked DE');
    if (!isHttp()) await shot(page, '041-gesperrt-de.png');
  });

  test('090: a change of actor closes an open dialog (in-process)', async ({ page }) => {
    test.skip(isHttp(), 'The demo actor is switched under the dialog; the http project has no switcher.');
    await asRole(page, 'admin');
    await toAdmin(page);
    await page.getByTestId('admin-assign-open').click();
    await page.getByTestId('admin-assign-subject').fill('kennung-090');
    await page.evaluate(async (url) => {
      const mod = (await import(/* @vite-ignore */ url)) as {
        DEMO_ACTORS: readonly { id: string }[];
        setActor: (actor: unknown) => void;
      };
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.id === 'u-cap-1'));
    }, '/src/api/actor.ts');
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId('admin-forbidden')).toBeVisible();
  });
});
