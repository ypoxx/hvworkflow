/**
 * takt-009 — Kontrast der Regelzeile im Toast.
 *
 * Trigger (goal 2 of the spec): a question is merged into itself. `question.merge` (R-TRANS-12,
 * `packages/domain/src/transitions.ts`) carries its own guard, R-GUARD-05
 * (`notMergingIntoSelf`, "A question cannot be merged into itself."). The guard evaluates the
 * *payload* (`intoQuestionId === q.id`), never the read side of any permission, so it refuses the
 * write for every role that may merge at all, on every run, independent of the seeded corpus'
 * exact contents — only that at least one `classified` question exists, which the 800-question
 * corpus (`packages/domain/src/seed.ts`) always provides. The interface reaches it without any
 * test hook: open a `classified` question's own "Zusammenführen" dialog and type that same
 * question's own number (read off its own row, `data-number`) as the merge target —
 * `MergeDialog.onResolve` (`ActionDialogs.tsx`) resolves a number to an id through
 * `HvApi.listQuestions`, exactly the way a person mistyping the wrong number would, and
 * `api.mergeQuestion(question.id, targetId, …)` (`Page.tsx`) then sends `id === intoQuestionId`.
 * `capture` is one of the two roles the merge action is bundled for (`ROLE_PERMISSIONS`,
 * `packages/domain/src/permissions.ts`), the same role slices 013b/020 already use at this desk.
 *
 * Candidates checked and set aside:
 *   - A stale `answerVersion` on `question.approve` (R-GUARD-04) — `QuestionDetail.tsx` always
 *     sends `latest` itself (`onAction({ kind: 'approve', version: latest })`); the interface has
 *     no path that submits a version other than the one it just read, so this guard cannot be
 *     provoked deterministically through the UI alone.
 *   - A stale `If-Match` (412, two writers) — `AnswersPage.run()` (`Page.tsx`) treats a 412
 *     specially (`setStale(true)`) and explicitly does *not* raise a toast for it ("keep the toast
 *     for every other refusal"); it also carries no `ruleId`. Not this slice's trigger by design.
 *   - An empty reason on withdraw/return — the dialog's own submit button stays `disabled` while
 *     the field is empty, so the request never reaches the server from the interface.
 *
 * `checkAxe` is the shared gate from slice 013 (`support/axe.ts`); no exception is added for the
 * toast — the whole point of this slice is that none is needed once the token is right.
 */
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { Page } from '@playwright/test';

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

test.use({ viewport: { width: 1440, height: 900 } });

test('takt-009: Regelzeile im Toast bei verweigerter Selbst-Zusammenführung — Kontrast und axe', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'capture');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  // A `classified` question: R-TRANS-12 allows `question.merge` from this status, and `capture`
  // holds the permission (permissions.ts) — mayMerge, and so the button below, comes from
  // `_actions` alone (AGENTS.md rule 4), never from comparing the role name here.
  await page.getByTestId('answers-filter-status-classified').click();
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-status', 'classified');
  const number = await row.getAttribute('data-number');
  expect(number).not.toBeNull();
  await row.click();

  await page.getByTestId('answer-merge').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByTestId('answer-merge-target').fill(number ?? '');
  await page.getByTestId('answer-merge-submit').click();

  // R-GUARD-05 refuses the write; `showProblem` (`toastStore.ts`) raises a danger toast that names
  // the rule — the line this slice is about.
  const toast = page.locator('[aria-live="polite"] [role="status"]').first();
  await expect(toast).toBeVisible();
  const ruleLine = toast.locator('p.font-mono');
  await expect(ruleLine).toBeVisible();
  await expect(ruleLine).toContainText('R-GUARD-05');

  // No exception for the toast (goal 2): the whole page, with the toast and the still-open merge
  // dialog behind it, must be free of serious/critical findings, `color-contrast` included.
  await checkAxe(page, 'toast (Regelzeile, Selbst-Zusammenführung abgelehnt)');
});
