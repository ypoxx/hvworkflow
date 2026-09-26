/**
 * takt-009 — Kontrast der Regelzeile im Toast.
 *
 * Trigger (goal 2 of the spec): a question is merged into itself. `question.merge` (R-TRANS-12,
 * `packages/domain/src/transitions.ts`) carries its own guard, R-GUARD-05
 * (`notMergingIntoSelf`, "A question cannot be merged into itself."). The guard itself evaluates
 * only the *payload* (`intoQuestionId === q.id`), never a read permission, so the refusal fires for
 * every role that may merge at all, on every run, independent of the seeded corpus' exact contents
 * — only that at least one `classified` question exists, which the demo corpus
 * (`CORPUS_DEMO`, `packages/domain/src/seed.ts`) always provides. The interface reaches it without any test hook:
 * open a `classified` question's own "Zusammenführen" dialog and type that same question's own
 * number (read off its own row, `data-number`) as the merge target — `MergeDialog.onResolve`
 * (`ActionDialogs.tsx`) resolves a number to an id through `HvApi.listQuestions`, exactly the way a
 * person mistyping the wrong number would, and `api.mergeQuestion(question.id, targetId, …)`
 * (`Page.tsx`) then sends `id === intoQuestionId`.
 *
 * Rework after review (minor 2, slice 010 now in the base): the *rule line on screen* is not
 * as read-independent as the guard itself. `transition()` (`packages/domain/src/api.ts`,
 * Festlegung 8, slice 010) only puts the reason and the rule id on the 409 when the actor can also
 * read the question (`can(actor, 'question.read', q).allow`); otherwise the problem is the generic
 * "Transition not allowed." with no rule id at all, and this test's `ruleLine` assertion would fail
 * loudly rather than pass silently if that changed. `capture` (admin also holds `question.merge`,
 * `ROLE_PERMISSIONS`, `packages/domain/src/permissions.ts`) holds `question.read` unscoped, so it
 * sees the real reason and rule id on every question regardless of status — the trigger below still
 * needs no read right beyond what `capture` already has for everything on this desk, but it is no
 * longer accurate to call the rule *line* read-independent in general, only the guard.
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
import { CORPUS_DEMO } from '@hv/domain';
import { expect, test } from '@playwright/test';
import { checkAxe } from './support/axe';
import type { Page } from '@playwright/test';

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;


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
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
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

  // Evidence (AGENTS.md rule 2, Codex P1): the rule line, on screen, at readable contrast.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('takt-009-toast.png') });

  // No exception for the toast (goal 2): the whole page, with the toast and the still-open merge
  // dialog behind it, must be free of serious/critical findings, `color-contrast` included.
  await checkAxe(page, 'toast (Regelzeile, Selbst-Zusammenführung abgelehnt)');

  // minor 1 (review): `checkAxe` runs two full passes; proof the toast was still the thing on
  // screen throughout both, not something that auto-dismissed (`DISMISS_AFTER_MS`, 9s) mid-check.
  await expect(ruleLine).toBeVisible();
});
