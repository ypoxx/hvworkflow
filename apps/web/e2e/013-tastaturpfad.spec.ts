/**
 * Slice 013 — Barrierefreiheit und Tastaturpfad als Tor, goal 2: five core scenes, each finished
 * without a mouse — only Tab, Shift+Tab, Enter, Space, Escape, arrow keys and the product's own
 * shortcuts. `.click()` is used only for the demo's own role switcher (AGENTS.md rule 4, not a
 * Kernszene) and for plain page navigation (`nav-*` links, status filter chips) — getting to a view
 * is not one of the five scenes goal 2 names; every scene's own action (registering, reordering,
 * capturing, drafting, approving, reading out) is real keyboard input, verified with real `Tab`
 * key presses (not `element.focus()`, which Chromium's `:focus-visible` heuristic does not treat as
 * keyboard-sourced) so the visible-focus assertions below are honest.
 *
 * Every step asserts the focused element carries a visible ring (design-prinzipien.md D8 — the
 * computed `outline` from the product's global `:focus-visible` rule, or a `box-shadow`, never
 * "none"), and that closing a dialog returns focus to the element that opened it (goal 2).
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

/** Confirmations belong on screen, not in the evidence: clear the stack before a screenshot. */
async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /Meldung schließen|Close the message/ });
  for (let open = await close.count(); open > 0; open = await close.count()) {
    await close.first().click();
  }
}

const SEEDED_QUESTIONS = 800;

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

interface FocusSnapshot {
  testId: string | null;
  role: string | null;
  tag: string;
  outlineStyle: string;
  outlineWidth: string;
  boxShadow: string;
  /** The nearest ancestor round section's own testid (`speakers-round-N`) — several `data-testid`s
   *  in this product repeat once per row/round, so a plain id match can land on the wrong instance. */
  roundTestId: string | null;
  /** The nearest ancestor Wortmeldung row's own `data-status` — `speaker.reorder` (and so the drag
   *  handle) is not limited to `waiting` rows, so the id alone does not say "the first waiting one". */
  rowStatus: string | null;
}

async function focusSnapshot(page: Page): Promise<FocusSnapshot> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) {
      return {
        testId: null,
        role: null,
        tag: 'BODY',
        outlineStyle: 'none',
        outlineWidth: '0px',
        boxShadow: 'none',
        roundTestId: null,
        rowStatus: null,
      };
    }
    const style = getComputedStyle(el);
    return {
      testId: el.getAttribute('data-testid'),
      role: el.getAttribute('role'),
      tag: el.tagName,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      roundTestId: el.closest('[data-testid^="speakers-round-"]')?.getAttribute('data-testid') ?? null,
      rowStatus: el.closest('[data-testid="speaker-row"]')?.getAttribute('data-status') ?? null,
    };
  });
}

/** D8: the focused element right now has a visible ring, and (if given) is the expected one.
 *  Polling on the snapshot itself first (rather than `page.getByTestId(id).toBeFocused()`) rides out
 *  the brief re-render some views do right after navigation (e.g. the stage view's rights-derived
 *  buttons) without assuming the `data-testid` is unique page-wide — several of ours (the drag
 *  handle, one per row) are not. */
async function assertFocusVisible(
  page: Page,
  expected?: { testId?: string; role?: string },
): Promise<void> {
  if (expected?.testId !== undefined) {
    await expect
      .poll(async () => (await focusSnapshot(page)).testId, { timeout: 5_000 })
      .toBe(expected.testId);
  }
  const snap = await focusSnapshot(page);
  const hasOutline = snap.outlineStyle !== 'none' && snap.outlineWidth !== '0px';
  const hasRing = hasOutline || snap.boxShadow !== 'none';
  expect(hasRing, `focus not visible: ${JSON.stringify(snap)}`).toBe(true);
  if (expected?.testId !== undefined) expect(snap.testId, JSON.stringify(snap)).toBe(expected.testId);
  if (expected?.role !== undefined) expect(snap.role, JSON.stringify(snap)).toBe(expected.role);
}

/**
 * Presses real `Tab` key events (Chromium only marks focus as `:focus-visible` after genuine
 * keyboard input — a scripted `element.focus()` does not count) until the given predicate matches
 * the newly focused element, or gives up after `maxSteps`. Returns the number of presses used, which
 * the tests log — evidence that the target really sits in the page's tab order, not just that some
 * element eventually matched.
 */
async function tabUntil(
  page: Page,
  match: (snap: FocusSnapshot) => boolean,
  options: { maxSteps?: number; shift?: boolean } = {},
): Promise<number> {
  const maxSteps = options.maxSteps ?? 60;
  const key = options.shift === true ? 'Shift+Tab' : 'Tab';
  for (let step = 0; step < maxSteps; step++) {
    await page.keyboard.press(key);
    const snap = await focusSnapshot(page);
    if (match(snap)) return step + 1;
  }
  const finalSnap = await focusSnapshot(page);
  throw new Error(
    `tabUntil: not reached within ${maxSteps} ${key} presses (ended at ${JSON.stringify(finalSnap)})`,
  );
}

async function tabToTestId(page: Page, testId: string, maxSteps = 60): Promise<number> {
  return tabUntil(page, (snap) => snap.testId === testId, { maxSteps });
}

test.use({ viewport: { width: 1440, height: 900 } });

test('013a: Wortmeldung per Tastatur anlegen und mit Pfeiltasten umsortieren', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');

  // Setup (a click, not the scene itself, AGENTS.md rule 4): closing the role menu drops focus to
  // <body> (its own button unmounts) — the next Tab starts a real, honest walk of this page's own
  // tab order, exactly the way a person arriving at the keyboard would.
  const stepsToRegister = await tabToTestId(page, 'speaker-register');
  console.log(`[013a] Tab presses from a fresh page to "speaker-register": ${stepsToRegister}`);
  await assertFocusVisible(page, { testId: 'speaker-register' });

  // Escape closes without submitting, and focus lands back on the button that opened it (goal 2).
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Dialog.tsx auto-focuses the panel's first focusable element, which is its own close (X) button
  // (the header renders it before the form) — a real, visible focus stop in its own right, and one
  // Tab press away from the name field this scene actually needs.
  await assertFocusVisible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await assertFocusVisible(page, { testId: 'speaker-register' });

  // Reopen and actually register this time: Tab from the close button to the name field, type,
  // Enter submits the single-field form.
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await assertFocusVisible(page);
  await tabToTestId(page, 'speaker-register-name', 3);
  await assertFocusVisible(page, { testId: 'speaker-register-name' });
  const name = 'Tastatur Testperson';
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();

  const round = page.getByTestId('speakers-round-3');
  await expect(round.getByText(name)).toBeVisible();

  // Umsortieren: the existing dnd-kit keyboard sensor — Space lifts, an arrow key moves, Space drops.
  const waiting = round.locator('[data-testid="speaker-row"][data-status="waiting"]');
  const firstBefore = (await waiting.nth(0).getAttribute('data-number')) ?? '';
  const secondBefore = (await waiting.nth(1).getAttribute('data-number')) ?? '';
  expect(firstBefore).not.toEqual(secondBefore);

  // `speaker-drag-handle` repeats once per row across every round on the page, and `speaker.reorder`
  // (SpeakerRow.tsx) is not limited to `waiting` rows either — scoped to round 3's own first
  // *waiting* row, or an earlier round's, or round 3's own speaking/finished row's, handle would
  // match first and this would reorder the wrong queue entirely.
  const stepsToHandle = await tabUntil(
    page,
    (snap) =>
      snap.testId === 'speaker-drag-handle' &&
      snap.roundTestId === 'speakers-round-3' &&
      snap.rowStatus === 'waiting',
    { maxSteps: 120 },
  );
  console.log(`[013a] Tab presses to round 3's first waiting row's drag handle: ${stepsToHandle}`);
  await assertFocusVisible(page, { testId: 'speaker-drag-handle' });
  const focusedNumber = await page.evaluate(
    () =>
      (document.activeElement as HTMLElement | null)
        ?.closest('[data-testid="speaker-row"]')
        ?.getAttribute('data-number') ?? null,
  );
  expect(focusedNumber).toBe(firstBefore);

  const announcer = page.locator('[role="status"][aria-live="assertive"]');
  await page.keyboard.press('Space');
  await expect(announcer).toContainText(`Wortmeldung ${firstBefore}`);
  const lifted = await announcer.innerText();
  await page.keyboard.press('ArrowDown');
  await expect(announcer).not.toHaveText(lifted);
  await page.keyboard.press('Space');
  await expect(announcer).toContainText('abgelegt');
  await assertFocusVisible(page);

  await expect(waiting.nth(0)).toHaveAttribute('data-number', secondBefore);
  await expect(waiting.nth(1)).toHaveAttribute('data-number', firstBefore);
});

/** A synthetic speech with exactly seven questions of record (the same fixture 002/abnahme use). */
const QUESTIONS = [
  'Wie hoch war der Investitionsaufwand im abgelaufenen Geschäftsjahr?',
  'Welche Rückstellungen hat die Gesellschaft für die anhängigen Verfahren gebildet?',
  'Wie entwickelt sich die Eigenkapitalquote im laufenden Geschäftsjahr?',
  'Welche Maßnahmen ergreift der Vorstand gegen den Rückgang der operativen Marge?',
  'Wann rechnet die Gesellschaft mit einer Entscheidung der Kartellbehörde?',
  'Wie viele Stellen sind im Zuge des Sparprogramms bereits entfallen?',
  'Welche Dividende schlägt der Vorstand für das kommende Geschäftsjahr vor?',
];
const SPEECH = [
  'Sehr geehrte Damen und Herren, ich danke dem Vorstand für den Bericht zur Lage der Gesellschaft.',
  ...QUESTIONS,
  'Ich danke Ihnen für die Beantwortung.',
].join(' ');

test('013b: Redebeitrag erfassen und mit der Tastatur in Einzelfragen zerlegen', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);

  // Setup, not the scene under test: a Wortmeldung has to be at the microphone first.
  await asRole(page, 'moderation');
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill('Zerlegung Testperson');
  await page.getByTestId('speaker-register-submit').click();
  const speakerRow = page
    .locator('[data-testid="speaker-row"]')
    .filter({ hasText: 'Zerlegung Testperson' });
  await speakerRow.getByTestId('speaker-call').click();

  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  // Typing the speech itself is data entry, not a navigation gesture — reaching the field by Tab,
  // then `.fill()` on the already-focused element, is the same distinction the four Alt-Specs draw.
  const stepsToText = await tabToTestId(page, 'capture-text', 40);
  console.log(`[013b] Tab presses to "capture-text": ${stepsToText}`);
  await assertFocusVisible(page, { testId: 'capture-text' });
  await page.getByTestId('capture-text').fill(SPEECH);

  await tabToTestId(page, 'capture-submit', 10);
  await assertFocusVisible(page, { testId: 'capture-submit' });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('capture-contribution-text')).toBeVisible();

  // Zerlegen ohne Maus: the batch dialog needs no text selection at all — Tab/Shift+Tab/Enter/Escape.
  await tabToTestId(page, 'capture-suggest', 20);
  await assertFocusVisible(page, { testId: 'capture-suggest' });
  await page.keyboard.press('Enter');
  const suggestDialog = page.getByRole('dialog');
  await expect(suggestDialog).toBeVisible();
  await expect(page.getByTestId('capture-suggest-item')).toHaveCount(QUESTIONS.length);

  // Shift+Tab from the dialog's own auto-focused first control wraps to its last one (the trap in
  // components/Dialog.tsx) — proof the "Shift+Tab" key genuinely does something here, not just "Tab".
  await page.keyboard.press('Shift+Tab');
  await assertFocusVisible(page);
  const wrapped = await focusSnapshot(page);
  expect(wrapped.tag).toBe('BUTTON');

  await tabToTestId(page, 'capture-suggest-add', 15);
  await assertFocusVisible(page, { testId: 'capture-suggest-add' });
  await page.keyboard.press('Enter');
  await expect(suggestDialog).toBeHidden();
  await expect(page.getByTestId('capture-question-card')).toHaveCount(QUESTIONS.length);

  // An eighth question, added purely by typing and Enter — again no selection, no mouse.
  await tabToTestId(page, 'capture-free-input', 30);
  await assertFocusVisible(page, { testId: 'capture-free-input' });
  await page.getByTestId('capture-free-input').fill('Wie viele Stimmrechte waren bei Abstimmung vertreten?');
  await tabToTestId(page, 'capture-free-add', 5);
  await assertFocusVisible(page, { testId: 'capture-free-add' });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('capture-question-card')).toHaveCount(QUESTIONS.length + 1);
});

/** Filters to a status (a click — navigation, not the scene), then reaches the answers desk's own
 *  keyboard path by Tab (`WorkList.tsx`'s `role="listbox"`/`aria-activedescendant`) and arrows onto
 *  its first row — never a click on the row itself. */
async function selectFirstRowByKeyboard(page: Page, status: string): Promise<void> {
  await page.getByTestId(`answers-filter-status-${status}`).click();
  const steps = await tabUntil(page, (snap) => snap.role === 'listbox', { maxSteps: 40 });
  console.log(`[013c/d] Tab presses from the "${status}" filter chip to the listbox: ${steps}`);
  await assertFocusVisible(page, { role: 'listbox' });
  await page.keyboard.press('ArrowDown');
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-status', status);
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('answers-detail')).toBeVisible();
}

test('013c: Antwort entwerfen und mit der Tastatur weiterleiten', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'expert');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  await selectFirstRowByKeyboard(page, 'assigned');

  await tabToTestId(page, 'answer-editor', 15);
  await assertFocusVisible(page, { testId: 'answer-editor' });
  await page
    .getByTestId('answer-editor')
    .fill('Die Ausschüttungsquote lag im Berichtsjahr bei 47 Prozent des bereinigten Konzernergebnisses.');

  await tabToTestId(page, 'answer-sources', 5);
  await assertFocusVisible(page, { testId: 'answer-sources' });
  await page.getByTestId('answer-sources').fill('Geschäftsbericht, Seite 42');

  await tabToTestId(page, 'answer-submit-draft', 10);
  await assertFocusVisible(page, { testId: 'answer-submit-draft' });
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="answer-version"][data-version="1"]')).toBeVisible();

  // Clearing the confirmation toast is itself a click (evidence tidying, not the scene) — it drops
  // focus to <body> the same way the role switcher does, so the following Tab search needs the same
  // generous, full-page budget as a fresh page load, not the short one a same-panel Tab hop needs.
  await clearToasts(page);
  await tabToTestId(page, 'answer-submit-review', 60);
  await assertFocusVisible(page, { testId: 'answer-submit-review' });
  // Evidence (goal 2, acceptance criterion 1): the visible focus ring, in the Beantwortung.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('013-fokus-beantwortung.png') });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('approval-block')).toContainText('Legal Clearing');
});

test('013d: Freigeben mit der Tastatur', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'legal');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  await selectFirstRowByKeyboard(page, 'in_review');

  await tabToTestId(page, 'answer-approve', 15);
  await assertFocusVisible(page, { testId: 'answer-approve' });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('approval-block')).toContainText('Freigegeben');
});

test('013e: Auf der Bühne "Vorgelesen, weiter" mit der Tastatur', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  // The stored "Nur Bühne" preference always wins over the role default (020) — the ordinary shell
  // is what this scene needs, exactly like 003/abnahme already set up for the same reason.
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);

  const currentNumber = page.getByTestId('stage-current-number');
  await expect(currentNumber).toBeVisible();
  const before = await currentNumber.innerText();

  // "Vorgelesen, weiter": Tab onto the button, then the house's own shortcut key — Space — which is
  // also the button's native keyboard-activation key. Clearing any confirmation toast (a click, not
  // the scene) happens before the last Tab, not after, so it cannot steal focus back off the button.
  await clearToasts(page);
  const steps = await tabToTestId(page, 'stage-next', 30);
  console.log(`[013e] Tab presses from the stage view to "stage-next": ${steps}`);
  await assertFocusVisible(page, { testId: 'stage-next' });
  // Evidence (goal 2, acceptance criterion 1): the visible focus ring, on the Bühne.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('013-fokus-buehne.png') });
  await page.keyboard.press('Space');
  await expect(currentNumber).not.toHaveText(before);

  // Finding, not fixed here (goal 2 grants this file no source-editing permission beyond Ziel 1's
  // axe fixes — see the Bericht "Offen"): `disabled={busy}` (Podium.tsx/Page.tsx) blurs the
  // just-activated button to <body> the instant the request starts — a disabled element cannot hold
  // focus, a native browser rule — and nothing moves focus back once the button re-enables. The same
  // `disabled={busy}` pattern recurs on every write action in the product (answer-submit-draft,
  // answer-submit-review, answer-approve, …), so this is evidence for a dedicated slice, not an
  // in-place edit smuggled into this one.
  const afterDeliverFocus = await focusSnapshot(page);
  console.log(`[013e] focus after "Vorgelesen, weiter": ${JSON.stringify(afterDeliverFocus)}`);
});

async function motionOf(
  locator: Locator,
): Promise<{ transitionDuration: string; animationDuration: string }> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { transitionDuration: style.transitionDuration, animationDuration: style.animationDuration };
  });
}

/** Every component of a (possibly comma-separated) duration list must be ≤ 0.01s (goal 3). */
function assertNoMotion(
  label: string,
  motion: { transitionDuration: string; animationDuration: string },
): void {
  for (const [prop, value] of Object.entries(motion)) {
    for (const part of value.split(',')) {
      const trimmed = part.trim();
      const seconds = trimmed.endsWith('ms')
        ? Number.parseFloat(trimmed) / 1000
        : Number.parseFloat(trimmed);
      expect(seconds, `${label} ${prop}: "${value}"`).toBeLessThanOrEqual(0.01);
    }
  }
}

test('013f: prefers-reduced-motion — Übergänge und Animationen sind abgeschaltet', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation'); // the default demo actor cannot open the register dialog

  // Liste: a Wortmeldung row normally transitions its background 100ms on hover/focus.
  const row = page.locator('[data-testid="speaker-row"]').first();
  await expect(row).toBeVisible();
  assertNoMotion('Liste (Wortmeldung-Zeile)', await motionOf(row));

  // Umschalter: the language toggle's own buttons transition their text colour (default duration,
  // no explicit `duration-100` — a second, independently-styled case from the list row above).
  const langOption = page.locator('[data-testid="lang-toggle"] button').first();
  await expect(langOption).toBeVisible();
  assertNoMotion('Umschalter (Sprache)', await motionOf(langOption));

  // Dialog: every Button (dialog footer included) carries the same `transition-colors duration-100`.
  await page.getByTestId('speaker-register').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const cancelButton = dialog.getByRole('button', { name: 'Abbrechen' });
  await expect(cancelButton).toBeVisible();
  assertNoMotion('Dialog (Abbrechen-Knopf)', await motionOf(cancelButton));
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
