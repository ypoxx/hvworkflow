/**
 * Slice 013 — Barrierefreiheit und Tastaturpfad als Tor, goal 2: five core scenes, each finished
 * without a mouse — only Tab, Shift+Tab, Enter, Space, Escape, arrow keys and the product's own
 * shortcuts (Alt+1…5 to navigate, `featureRegistry.ts`/slice 082). Every step asserts the focused
 * element carries a visible ring (design-prinzipien.md D8 — the computed `outline` from the
 * product's global `:focus-visible` rule, or a `box-shadow`, never "none"), and that closing a
 * dialog returns focus to the element that opened it (goal 2) — after both Escape *and* a real
 * submit, not only Escape (review round 1, major 1).
 *
 * What is still a click, honestly, and why:
 *   - the demo's own role switcher (AGENTS.md rule 4 — not a Kernszene, the one place a role name
 *     may appear);
 *   - in scene (b) and in the dedicated "known-bad" test below, registering and calling a *second*
 *     Wortmeldung as a prerequisite (not the scene under test — scene (a) already proves that same
 *     registration is itself fully keyboard-operable).
 * Everything else — page navigation, the status filter chips, dismissing a confirmation toast,
 * typing into a field already reached by Tab — is real keyboard input: `Alt+1`…`Alt+5` (never a
 * click on a `nav-*` link), Tab/Enter on the filter chips, waiting a toast out
 * (`waitForToastsGone`, never a click on its close button), and `page.keyboard.type()` once Tab has
 * put the caret in the field (not `.fill()`, which does not dispatch real key events).
 *
 * `.focus()` (not a click) only ever finds the button/field a real `Tab` walk (`tabToTestId`,
 * `tabUntil`) has already proven reachable, or — in the dedicated "known-bad" test, which checks
 * *where* focus lands, not whether it is visible — positions directly on a button whose own
 * reachability is already proven by the scene it is copied from.
 */
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { Locator, Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

/** `Toast.tsx`'s own `DISMISS_AFTER_MS` (9s) — waiting a toast out, never clicking its close
 *  button, keeps the scene itself click-free (review round 1, minor 4). Scoped to the toast
 *  stack's own live region so it never matches the drag-and-drop announcer (`role="status"` too,
 *  see 013a), which this file does not raise toasts near. */
async function waitForToastsGone(page: Page): Promise<void> {
  await expect(page.locator('[aria-live="polite"] [role="status"]')).toHaveCount(0, {
    timeout: 10_000,
  });
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
  // Review round 1, major 1: focus-return after a dialog *submit*, not only after Escape (above).
  // Dialog.tsx's own cleanup effect restores focus to whatever opened it regardless of how the
  // dialog closed — this is the same mechanism, exercised the other way.
  await assertFocusVisible(page, { testId: 'speaker-register' });

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

  // Review round 1, point 6: "In Runde verschieben" (MoveDialog.tsx, touched for an axe fix in the
  // first round, never itself opened by any spec until now) — from the very row just reordered,
  // still focused on its drag handle: Tab twice (speaker-call, then speaker-move), Enter opens it,
  // axe on the open dialog, Escape closes it and returns focus to the button that opened it.
  const stepsToMove = await tabUntil(
    page,
    (snap) =>
      snap.testId === 'speaker-move' &&
      snap.roundTestId === 'speakers-round-3' &&
      snap.rowStatus === 'waiting',
    { maxSteps: 10 },
  );
  console.log(`[013a] Tab presses from the drag handle to "speaker-move": ${stepsToMove}`);
  await assertFocusVisible(page, { testId: 'speaker-move' });
  await page.keyboard.press('Enter');
  const moveDialog = page.getByRole('dialog');
  await expect(moveDialog).toBeVisible();
  await checkAxe(page, 'speakers (Verschieben-Dialog offen)');
  await page.keyboard.press('Escape');
  await expect(moveDialog).toBeHidden();
  await assertFocusVisible(page, { testId: 'speaker-move' });
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

  // Setup, not the scene under test: a Wortmeldung has to be at the microphone first (see the file
  // header for why this stays a click).
  await asRole(page, 'moderation');
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill('Zerlegung Testperson');
  await page.getByTestId('speaker-register-submit').click();
  const speakerRow = page
    .locator('[data-testid="speaker-row"]')
    .filter({ hasText: 'Zerlegung Testperson' });
  await speakerRow.getByTestId('speaker-call').click();

  await asRole(page, 'capture');
  // Alt+2 (featureRegistry.ts, slice 082) — the product's own shortcut, not a click on `nav-capture`.
  await page.keyboard.press('Alt+2');
  await expect(page).toHaveURL(/\/capture$/);

  // Typing the speech is real keyboard input once Tab has put the caret in the field — `type()`,
  // not `.fill()` (review round 1, minor 4).
  const stepsToText = await tabToTestId(page, 'capture-text', 40);
  console.log(`[013b] Tab presses to "capture-text": ${stepsToText}`);
  await assertFocusVisible(page, { testId: 'capture-text' });
  await page.keyboard.type(SPEECH);

  await tabToTestId(page, 'capture-submit', 10);
  await assertFocusVisible(page, { testId: 'capture-submit' });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('capture-contribution-text')).toBeVisible();
  // Review round 1, major 2: `capture-submit` is one of the known-bad "focus lost after an action"
  // steps this slice's own test surfaced (`disabled={writing}`, same shape as `disabled={busy}`
  // elsewhere) — not asserted here as if it worked; see the dedicated `test.fail()` below and the
  // Bericht "Offen".

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
  // Review round 1, major 1: focus-return after this dialog's *submit* too, not only Escape.
  await assertFocusVisible(page, { testId: 'capture-suggest' });
  await expect(page.getByTestId('capture-question-card')).toHaveCount(QUESTIONS.length);

  // An eighth question, added purely by typing and Enter — again no selection, no mouse.
  await tabToTestId(page, 'capture-free-input', 30);
  await assertFocusVisible(page, { testId: 'capture-free-input' });
  await page.keyboard.type('Wie viele Stimmrechte waren bei Abstimmung vertreten?');
  await tabToTestId(page, 'capture-free-add', 5);
  await assertFocusVisible(page, { testId: 'capture-free-add' });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('capture-question-card')).toHaveCount(QUESTIONS.length + 1);
  // Also known-bad (`disabled={free.trim() === ''}` clears and disables the button the instant it
  // succeeds) — see the dedicated test below, not asserted here.
});

/** Filters to a status by Tab/Enter (review round 1, minor 4 — no click on the chip), then reaches
 *  the answers desk's own keyboard path by Tab (`WorkList.tsx`'s `role="listbox"`/
 *  `aria-activedescendant`) and arrows onto its first row — never a click on the row itself. */
async function selectFirstRowByKeyboard(page: Page, status: string): Promise<void> {
  const stepsToFilter = await tabToTestId(page, `answers-filter-status-${status}`, 60);
  console.log(`[013c/d] Tab presses to the "${status}" filter chip: ${stepsToFilter}`);
  await assertFocusVisible(page, { testId: `answers-filter-status-${status}` });
  await page.keyboard.press('Enter');

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
  // Alt+3 (featureRegistry.ts) — not a click on `nav-answers`.
  await page.keyboard.press('Alt+3');
  await expect(page).toHaveURL(/\/answers$/);

  await selectFirstRowByKeyboard(page, 'assigned');

  await tabToTestId(page, 'answer-editor', 15);
  await assertFocusVisible(page, { testId: 'answer-editor' });
  await page.keyboard.type(
    'Die Ausschüttungsquote lag im Berichtsjahr bei 47 Prozent des bereinigten Konzernergebnisses.',
  );

  await tabToTestId(page, 'answer-sources', 5);
  await assertFocusVisible(page, { testId: 'answer-sources' });
  await page.keyboard.type('Geschäftsbericht, Seite 42');

  await tabToTestId(page, 'answer-submit-draft', 10);
  await assertFocusVisible(page, { testId: 'answer-submit-draft' });
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="answer-version"][data-version="1"]')).toBeVisible();
  // Review round 1, major 2: `answer-submit-draft` is one of the known-bad steps — focus is not
  // asserted here (it would fail); see the dedicated `test.fail()` test and the Bericht "Offen".
  // The confirmation toast this raises (`answers/Page.tsx`'s shared `run()`) is waited out, not
  // clicked, before the next Tab search needs a clean run (review round 1, major 2 + minor 4).
  await waitForToastsGone(page);

  await tabToTestId(page, 'answer-submit-review', 60);
  await assertFocusVisible(page, { testId: 'answer-submit-review' });
  // Evidence (goal 2, acceptance criterion 1): the visible focus ring, in the Beantwortung.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('013-fokus-beantwortung.png') });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('approval-block')).toContainText('Legal Clearing');
  // `answer-submit-review` is also known-bad — see the dedicated test below.
});

test('013d: Freigeben mit der Tastatur', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'legal');
  await page.keyboard.press('Alt+3');
  await expect(page).toHaveURL(/\/answers$/);

  await selectFirstRowByKeyboard(page, 'in_review');

  await tabToTestId(page, 'answer-approve', 15);
  await assertFocusVisible(page, { testId: 'answer-approve' });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('approval-block')).toContainText('Freigegeben');
  // `answer-approve` is also known-bad — see the dedicated test below.
});

test('013e: Auf der Bühne "Vorgelesen, weiter" mit der Tastatur', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  // The stored "Nur Bühne" preference always wins over the role default (020) — the ordinary shell
  // is what this scene needs, exactly like 003/abnahme already set up for the same reason.
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.keyboard.press('Alt+4');
  await expect(page).toHaveURL(/\/stage$/);

  const currentNumber = page.getByTestId('stage-current-number');
  await expect(currentNumber).toBeVisible();
  const before = await currentNumber.innerText();

  // "Vorgelesen, weiter": Tab onto the button, then the house's own shortcut key — Space — which is
  // also the button's native keyboard-activation key.
  const steps = await tabToTestId(page, 'stage-next', 30);
  console.log(`[013e] Tab presses from the stage view to "stage-next": ${steps}`);
  await assertFocusVisible(page, { testId: 'stage-next' });
  // Evidence (goal 2, acceptance criterion 1): the visible focus ring, on the Bühne.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('013-fokus-buehne.png') });
  await page.keyboard.press('Space');
  await expect(currentNumber).not.toHaveText(before);
  // `stage-next` is also known-bad (the finding that started this list) — see the dedicated test.
});

/**
 * Review round 1, major 2: a real product defect this slice's own keyboard-path test surfaced —
 * `disabled={busy}` (and the identically-shaped `disabled={writing}`/`disabled={free.trim() === ''}`)
 * blurs the just-activated button to `<body>` the instant the guard flips true (a disabled element
 * cannot hold focus, a native browser rule), and nothing moves focus back once it re-enables. Fixing
 * it needs feature-file edits beyond Ziel 1's "small axe fixes" allowance (`Podium.tsx`/`Page.tsx` for
 * stage, `AnswerEditor.tsx`/`Page.tsx` for answers, `ContributionPane.tsx` for capture) — recorded
 * here as a characterisation test: each of the six actions asserts the known-bad state exactly
 * (focus lands on `BODY`). Fixing any single action therefore turns this test red at once, and
 * takt-008 flips exactly that line to the correct expectation (review round 2: one `test.fail()` over
 * six soft checks hid partial fixes, Codex on PR #19; checking `testId !== null` instead of `BODY`
 * would have missed a fix that moves focus to an element without a testid, Opus). `expect.soft` so
 * every action is reported in one run. Positioning is `.focus()`, not a fresh Tab walk — this test is
 * about *where* focus lands after the action, not about reachability (already proven by the scenes
 * above). Setup uses mouse clicks and `.fill()` (register, call, filter chips, row selection): they
 * only prepare state and are not part of any keyboard path under test.
 */
test(
  '013-bekannt: Fokus nach Aktion — Charakterisierung, der Fokus landet heute auf BODY (takt-008)',
  {
    annotation: {
      type: 'issue',
      description:
        'Fokus nach Aktion: disabled={busy} entzieht dem Knopf den Fokus — Folge-Kleinänderung takt-008',
    },
  },
  async ({ page }) => {
    await page.goto('/');
    await waitForCorpus(page);

    await asRole(page, 'moderation');
    await page.getByTestId('speaker-register').click();
    await page.getByTestId('speaker-register-name').fill('Fokus Testperson 013');
    await page.getByTestId('speaker-register-submit').click();
    const speakerRow = page
      .locator('[data-testid="speaker-row"]')
      .filter({ hasText: 'Fokus Testperson 013' });
    await speakerRow.getByTestId('speaker-call').click();

    await asRole(page, 'capture');
    await page.keyboard.press('Alt+2');
    await expect(page).toHaveURL(/\/capture$/);
    const textarea = page.getByTestId('capture-text');
    await textarea.focus();
    await page.keyboard.type('Sehr geehrte Damen und Herren. Wie hoch war der Umsatz? Vielen Dank.');
    const submit = page.getByTestId('capture-submit');
    await submit.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('capture-contribution-text')).toBeVisible();
    expect.soft((await focusSnapshot(page)).tag, 'Fokus nach capture-submit (bekannter Fehler, takt-008 dreht diese Zeile um)').toBe('BODY');

    const freeInput = page.getByTestId('capture-free-input');
    await freeInput.focus();
    await page.keyboard.type('Wie viele Stimmrechte waren vertreten?');
    const freeAdd = page.getByTestId('capture-free-add');
    await freeAdd.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('capture-question-card')).toHaveCount(1);
    expect.soft((await focusSnapshot(page)).tag, 'Fokus nach capture-free-add (bekannter Fehler, takt-008 dreht diese Zeile um)').toBe('BODY');

    await asRole(page, 'expert');
    await page.keyboard.press('Alt+3');
    await expect(page).toHaveURL(/\/answers$/);
    await page.getByTestId('answers-filter-status-assigned').click();
    await expect(page.getByTestId('answers-row').first()).toHaveAttribute('data-status', 'assigned');
    await page.getByTestId('answers-row').first().click();
    const editor = page.getByTestId('answer-editor');
    await editor.focus();
    await page.keyboard.type('Antworttext für den Fokustest.');
    const submitDraft = page.getByTestId('answer-submit-draft');
    await submitDraft.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="answer-version"][data-version="1"]')).toBeVisible();
    expect.soft((await focusSnapshot(page)).tag, 'Fokus nach answer-submit-draft (bekannter Fehler, takt-008 dreht diese Zeile um)').toBe('BODY');

    await waitForToastsGone(page);
    const submitReview = page.getByTestId('answer-submit-review');
    await submitReview.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('approval-block')).toContainText('Legal Clearing');
    expect.soft((await focusSnapshot(page)).tag, 'Fokus nach answer-submit-review (bekannter Fehler, takt-008 dreht diese Zeile um)').toBe('BODY');

    await waitForToastsGone(page);
    await asRole(page, 'legal');
    await page.keyboard.press('Alt+3');
    await page.getByTestId('answers-filter-status-in_review').click();
    await expect(page.getByTestId('answers-row').first()).toHaveAttribute('data-status', 'in_review');
    await page.getByTestId('answers-row').first().click();
    const approve = page.getByTestId('answer-approve');
    await approve.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('approval-block')).toContainText('Freigegeben');
    expect.soft((await focusSnapshot(page)).tag, 'Fokus nach answer-approve (bekannter Fehler, takt-008 dreht diese Zeile um)').toBe('BODY');

    await waitForToastsGone(page);
    await asRole(page, 'podium');
    await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
    await page.keyboard.press('Alt+4');
    await expect(page).toHaveURL(/\/stage$/);
    const currentNumber = page.getByTestId('stage-current-number');
    await expect(currentNumber).toBeVisible();
    const before = await currentNumber.innerText();
    const nextButton = page.getByTestId('stage-next');
    await nextButton.focus();
    await page.keyboard.press('Space');
    await expect(currentNumber).not.toHaveText(before);
    expect.soft((await focusSnapshot(page)).tag, 'Fokus nach stage-next (bekannter Fehler, takt-008 dreht diese Zeile um)').toBe('BODY');
  },
);

async function motionOf(
  locator: Locator,
): Promise<{ transitionDuration: string; animationDuration: string }> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { transitionDuration: style.transitionDuration, animationDuration: style.animationDuration };
  });
}

/** The first (and, for every element this file checks, only distinct) duration in a possibly
 *  comma-separated list, in seconds. */
function firstSeconds(value: string): number {
  const first = value.split(',')[0]?.trim() ?? value;
  return first.endsWith('ms') ? Number.parseFloat(first) / 1000 : Number.parseFloat(first);
}

/** Every component of a (possibly comma-separated) duration list must be ≤ 0.01s (goal 3). */
function assertNoMotion(
  label: string,
  motion: { transitionDuration: string; animationDuration: string },
): void {
  for (const [prop, value] of Object.entries(motion)) {
    for (const part of value.split(',')) {
      const seconds = firstSeconds(part);
      expect(seconds, `${label} ${prop}: "${value}"`).toBeLessThanOrEqual(0.01);
    }
  }
}

/**
 * The three elements 013f/013g both check, and why each one is a genuine, independently-styled
 * transition — not an assumption. `speaker-row` (`SpeakerRow.tsx`) was the first candidate for
 * "Liste" and turned out to be a dead end worth recording (review round 1, minor 5, "say so instead
 * of implying a check"): dnd-kit's `useSortable` puts its own inline `style` on that `<li>` (for the
 * drag transform), which — being inline — wins over the class-based `transition-colors duration-100`
 * for the `transition` shorthand entirely; at rest its `transitionProperty` is only `"transform"`,
 * `transitionDuration` `"0s"`, so a reduced-motion assertion on it would have passed for the wrong
 * reason (nothing to reduce in the first place). `answers-row` (`WorkList.tsx`), a plain `<div>` with
 * no such inline style, genuinely reports `transition-property: color, background-color, …` and
 * `transition-duration: 0.1s` at rest — confirmed below by the very fact that the un-reduced control
 * (013g) needs no `page.emulateMedia` to see > 0.01s. Neither element uses a CSS keyframe animation,
 * so `animationDuration` is always `"0s"` for both — 013f still asserts it (never implying a false
 * "no animation, so skip it"), but it passes for the same, honest reason every time: there is no
 * animation to reduce here, only a transition.
 */
interface MotionTargets {
  /** Captured immediately, on `/answers` — by the time this function returns, the page has
   *  navigated on to `/speakers` for the dialog, and a `Locator` for `answers-row` would silently
   *  find nothing there (Playwright locators re-query the *current* page, they do not hold a
   *  reference), so the list's own reading cannot be deferred like the other two can. */
  listMotion: { transitionDuration: string; animationDuration: string };
  toggle: Locator;
  dialogButton: Locator;
}

async function motionTargets(page: Page): Promise<MotionTargets> {
  await page.goto('/answers');
  await waitForCorpus(page);
  const list = page.locator('[data-testid="answers-row"]').first();
  await expect(list).toBeVisible();
  const listMotion = await motionOf(list);

  // The register dialog needs the moderation role and the speakers list; navigating there is not a
  // click on a `nav-*` link, this is deliberate cross-page reuse of the one dialog every Button in
  // the product shares its transition classes with (goal 3 lists "u. a. Dialog" as one of three).
  // The language toggle sits in the global header, present on every route — reading it here, after
  // the navigation, is equally valid and keeps one `Locator` (not a pre-navigation snapshot) that
  // the caller can still freely re-query.
  await asRole(page, 'moderation');
  await page.keyboard.press('Alt+1');
  await expect(page).toHaveURL(/\/speakers$/);
  const toggle = page.locator('[data-testid="lang-toggle"] button').first();
  await expect(toggle).toBeVisible();

  await page.getByTestId('speaker-register').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // "Dialog" stands for a Button inside it (the footer's "Abbrechen"): the panel itself
  // (components/Dialog.tsx) has no transition of its own — it appears/disappears outright, no fade
  // or slide — named honestly here and in the Bericht, not implied to be the panel.
  const dialogButton = dialog.getByRole('button', { name: 'Abbrechen' });
  await expect(dialogButton).toBeVisible();

  return { listMotion, toggle, dialogButton };
}

test('013f: prefers-reduced-motion — Übergänge und Animationen sind abgeschaltet', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { listMotion, toggle, dialogButton } = await motionTargets(page);

  // Liste: an Einzelfrage row (WorkList.tsx) normally transitions its background 100ms on hover.
  assertNoMotion('Liste (Beantwortung-Zeile)', listMotion);

  // Umschalter: the language toggle's own buttons transition their text colour (default duration,
  // no explicit `duration-100` — a second, independently-styled case from the list row above).
  assertNoMotion('Umschalter (Sprache)', await motionOf(toggle));

  // Dialog: see motionTargets() for why this is a Button inside the dialog, not the panel.
  assertNoMotion('Dialog (Abbrechen-Knopf)', await motionOf(dialogButton));

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('013g: Kontrolllauf ohne reduced motion — dieselben drei Elemente haben wirklich einen Übergang', async ({
  page,
}) => {
  // No `emulateMedia` here: the default media state (no `prefers-reduced-motion`) is what makes
  // 013f's assertion meaningful — without this control, a component that never had a transition at
  // all would pass 013f for the wrong reason. Only `transitionDuration` is checked: none of the
  // three elements below uses a CSS keyframe animation, so their `animationDuration` is always
  // "0s" — trivially ≤ 0.01s in both runs and not a check of anything the reduced-motion rule does
  // (see motionTargets() for the one candidate, a Wortmeldung row, that turned out to have neither).
  const { listMotion, toggle, dialogButton } = await motionTargets(page);

  expect(firstSeconds(listMotion.transitionDuration)).toBeGreaterThan(0.01);
  expect(firstSeconds((await motionOf(toggle)).transitionDuration)).toBeGreaterThan(0.01);
  expect(firstSeconds((await motionOf(dialogButton)).transitionDuration)).toBeGreaterThan(0.01);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
