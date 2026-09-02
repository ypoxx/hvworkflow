/**
 * The Abnahmesatz of docs/erste-version-und-offene-fragen.md §1, walked end to end by the people who
 * actually do it, against the seeded corpus of 800 questions — not a demo of twelve:
 *
 *   Eine Person, die das Werkzeug nie gesehen hat, erfasst aus einem Redebeitrag sieben Einzelfragen,
 *   klassifiziert sie, schickt sie in die Beantwortung, eine zweite Person beantwortet und gibt frei,
 *   und der Vorstand liest sie am Podiumsgerät vor und schließt sie ab — bei 800 Fragen im Bestand.
 *
 * One Wortmeldung is registered and called to the microphone (Versammlungsbüro), its Redebeitrag is
 * captured and atomised into seven Einzelfragen and the first is classified (Erfassung), assigned to
 * an answering unit (Erfassung), answered and handed to Legal Clearing (Fachbereich), approved at
 * exactly version 1 (Legal Clearing), put on the podium (Freigabe), read out (Podium) — and the
 * history proves every one of those steps afterwards.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

const SEEDED_QUESTIONS = 800;

/** A synthetic speech with exactly seven questions of record (same corpus as slice 002). */
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

const ANSWER_TEXT =
  'Die Ausschüttungsquote lag im Berichtsjahr bei 47 Prozent des bereinigten Konzernergebnisses. ' +
  'Die Einzelheiten sind im Geschäftsbericht auf Seite 42 dargestellt.';

/**
 * The corpus of 800 already carries roughly a hundred questions with status "staged" (the seed's
 * own statusFor() distribution). Staging assigns the next position of an append-only counter
 * (R-TRANS-07/08, packages/domain/src/api.ts), so a freshly staged question always lands behind all
 * of them in the podium queue — never within the first couple of dozen presses. The bound below is
 * sized for that reality, not for a demo of twelve.
 */
const MAX_STAGE_ROUNDS = 130;

test.use({ viewport: { width: 1440, height: 900 } });

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

/** Confirmations belong on screen, not in the evidence: clear the stack before a screenshot. */
async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: 'Meldung schließen' });
  for (let open = await close.count(); open > 0; open = await close.count()) {
    await close.first().click();
  }
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

/** Search by number and open the one row it turns up — the same motion at every desk. */
async function findAndOpen(page: Page, number: string): Promise<void> {
  await page.getByTestId('answers-search').fill(number);
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-number', number);
  await row.click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
}

test('@abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);

  /* ---------- Versammlungsbüro: a Wortmeldung comes in and is called to the microphone ---------- */
  await asRole(page, 'moderation');
  await expect(page).toHaveURL(/\/speakers$/);

  const speakerName = 'Abnahme Testperson';
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill(speakerName);
  await page.getByTestId('speaker-register-submit').click();

  const speakerRow = page.locator('[data-testid="speaker-row"]').filter({ hasText: speakerName });
  await expect(speakerRow).toBeVisible();
  const speakerNumber = (await speakerRow.getAttribute('data-number')) ?? '';
  expect(speakerNumber).not.toEqual('');

  await speakerRow.getByTestId('speaker-call').click();
  await expect(speakerRow).toHaveAttribute('data-status', 'speaking');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('abnahme-01-wortmeldung.png') });

  /* ---------- Erfassung: capture the Redebeitrag, atomise into seven, classify the first ---------- */
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);

  // Whoever is at the microphone is preselected.
  const selectedOption = await page.getByTestId('capture-speaker-select').evaluate((node) => {
    const select = node as HTMLSelectElement;
    return select.options[select.selectedIndex]?.text ?? '';
  });
  expect(selectedOption).toContain(speakerName);

  await page.getByTestId('capture-text').fill(SPEECH);
  await page.getByTestId('capture-submit').click();
  await expect(page.getByTestId('capture-contribution-text')).toBeVisible();

  // Batch atomisation: propose one Einzelfrage per question sentence, tick all seven, add them.
  await page.getByTestId('capture-suggest').click();
  const suggestItems = page.getByTestId('capture-suggest-item');
  await expect(suggestItems).toHaveCount(QUESTIONS.length);
  const suggestCount = await suggestItems.count();
  for (let index = 0; index < suggestCount; index++) {
    await suggestItems.nth(index).check();
  }
  await page.getByTestId('capture-suggest-add').click();

  const cards = page.getByTestId('capture-question-card');
  await expect(cards).toHaveCount(QUESTIONS.length);

  const coverage = Number(
    (await page.getByTestId('capture-coverage').innerText()).replace(/\D/g, ''),
  );
  expect(coverage).toBeGreaterThan(50);

  // Classify the first card: Pfad C, Expert Track, one agenda item, one podium assignment.
  const card = cards.first();
  await card.getByTestId('classify-track-expert_track').click();
  await card.getByTestId('classify-agenda').selectOption({ index: 1 });
  await card.getByTestId('classify-stage').selectOption('cfo');
  await card.getByTestId('classify-save').click();
  await expect(card).toContainText('klassifiziert');

  const questionNumber = (await card.getAttribute('data-number')) ?? '';
  expect(questionNumber).not.toEqual('');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('abnahme-02-erfassung.png') });

  /* ---------- Erfassung, still: assign the question to an answering unit on /answers ---------- */
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await expect(page.getByTestId('answers-row').first()).toBeVisible();

  // Timing (soft): how long the list takes to settle after a status filter click, at 800+ rows.
  const answersFilterStart = await page.evaluate(() => performance.now());
  await page.getByTestId('answers-filter-status-classified').click();
  await expect(page.getByTestId('answers-row').first()).toHaveAttribute(
    'data-status',
    'classified',
  );
  const answersFilterEnd = await page.evaluate(() => performance.now());
  const answersFilterMs = answersFilterEnd - answersFilterStart;
  console.log(`[timing] /answers list after status filter click: ${answersFilterMs.toFixed(1)} ms`);
  expect(answersFilterMs).toBeLessThan(1500);
  await page.getByTestId('answers-filter-status-all').click();

  await findAndOpen(page, questionNumber);
  await page.getByTestId('answer-assign').click();
  await page.getByTestId('answer-assign-unit').selectOption({ index: 0 });
  await page.getByTestId('answer-assign-submit').click();
  await expect(page.getByTestId('answers-detail')).toContainText('zugewiesen');

  /* ---------- Fachbereich: draft an answer and hand it to Legal Clearing ---------- */
  await asRole(page, 'expert');
  await findAndOpen(page, questionNumber);

  await page.getByTestId('answer-editor').fill(ANSWER_TEXT);
  await page.getByTestId('answer-submit-draft').click();
  await expect(page.locator('[data-testid="answer-version"][data-version="1"]')).toBeVisible();
  await page.getByTestId('answer-submit-review').click();
  await expect(page.getByTestId('approval-block')).toContainText('Legal Clearing');

  /* ---------- Legal Clearing: approve exactly the latest version ---------- */
  await asRole(page, 'legal');
  await findAndOpen(page, questionNumber);

  const approve = page.getByTestId('answer-approve');
  await expect(approve).toBeVisible();
  await approve.click();

  const approvalBlock = page.getByTestId('approval-block');
  await expect(approvalBlock).toBeVisible();
  await expect(approvalBlock).toContainText('1');
  await expect(approvalBlock).toContainText('Version 1');

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('abnahme-03-beantwortung.png') });

  /* ---------- Freigabe: onto the podium ---------- */
  await asRole(page, 'approver');
  await findAndOpen(page, questionNumber);
  await page.getByTestId('answer-stage').click();
  await expect(page.getByTestId('answers-detail')).toContainText('auf der Bühne');

  /* ---------- Podium: read out our question ---------- */
  await asRole(page, 'podium');

  const stageNavStart = await page.evaluate(() => performance.now());
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();
  const stageNavEnd = await page.evaluate(() => performance.now());
  const stageNavMs = stageNavEnd - stageNavStart;
  console.log(`[timing] /stage view after navigation: ${stageNavMs.toFixed(1)} ms`);
  expect(stageNavMs).toBeLessThan(1500);

  // The visible queue only ever renders its first eight rows (StageQueue caps the list), and the
  // corpus already carries roughly a hundred questions staged ahead of a freshly staged one — so
  // our number is neither the current one nor among those eight yet. Its place in the (unbounded)
  // queue is what the loop below proves, one "vorgelesen, weiter" at a time, the same motion the
  // board uses all afternoon.
  const currentNumber = page.getByTestId('stage-current-number');
  let rounds = 0;
  let current = await currentNumber.innerText();
  while (current !== questionNumber && rounds < MAX_STAGE_ROUNDS) {
    await page.getByTestId('stage-next').click();
    await expect(currentNumber).not.toHaveText(current);
    current = await currentNumber.innerText();
    rounds += 1;
  }
  console.log(`[timing] stage-next presses to reach ${questionNumber}: ${rounds}`);
  expect(current).toBe(questionNumber);

  const answerBlock = page.getByTestId('stage-answer');
  await expect(answerBlock).toHaveAttribute('data-prepared', 'true');
  await expect(answerBlock).toContainText(ANSWER_TEXT);

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('abnahme-04-buehne.png') });

  // Read out: deliver (and, since the podium role may also close, straight into "abgeschlossen").
  await page.getByTestId('stage-next').click();

  /* ---------- Historie: every step of this one question is on the record ---------- */
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);

  await page.getByTestId('history-search').fill(questionNumber);
  const result = page.getByTestId('history-result').filter({ hasText: questionNumber }).first();
  await expect(result).toBeVisible();
  await result.click();

  const timeline = page.getByTestId('history-timeline');
  await expect(timeline).toBeVisible();
  for (const type of [
    'QuestionCaptured',
    'QuestionClassified',
    'QuestionAssigned',
    'AnswerDrafted',
    'QuestionSubmittedForReview',
    'QuestionApproved',
    'QuestionStaged',
    'QuestionDelivered',
  ]) {
    await expect(
      timeline.locator(`[data-testid="history-event"][data-type="${type}"]`),
    ).toHaveCount(1);
  }

  await clearToasts(page);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('abnahme-05-historie.png') });
});
