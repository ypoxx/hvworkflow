/**
 * Slice 090 — Eingaben gehören dem Akteur (docs/slices/090-eingaben-je-akteur.md).
 *
 * 010d tied loaded data to the actor. This file checks the other direction: text a person typed
 * must not outlive an actor change. Each case follows the same pattern — role A types, the actor
 * changes to B (and back to A where A is the only one who sees the field) — and expects the field
 * empty or its dialog closed on both sides: nothing of A is shown to B, and nothing is restored
 * for A either (no per-actor draft store, that is Z.365 / 060).
 *
 * Per the Nachtrag des Architekten the fix is per field, not a rebuild of the routes. The cases for
 * fields 010d already clears stay as regression guards; the cases for fields that leaked were run
 * red against the code before the change (the Bericht quotes them).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { checkAxe } from './support/axe';

const SEEDED_QUESTIONS = 800;

test.use({ viewport: { width: 1440, height: 900 } });

async function asRole(page: Page, role: string): Promise<void> {
  await page.getByTestId('role-switcher').click();
  await page.getByTestId(`role-option-${role}`).click();
  await expect(page.getByTestId(`role-option-${role}`)).toBeHidden();
}

const ACTOR_MODULE = '/src/api/actor.ts';

/**
 * Switches the demo actor without the header — the call the role switcher makes. Needed while a
 * modal dialog is open: its backdrop covers the header, so the switcher cannot be clicked, but a
 * second person at the device (or an OIDC re-login) changes the actor all the same. As in
 * `010d-ansichtsdaten.spec.ts`, the import is started and its outcome polled; the page never holds a
 * pending promise for Playwright.
 */
async function switchActor(page: Page, role: string): Promise<void> {
  await page.evaluate(
    ([url, wanted]) => {
      const w = window as unknown as { __switch090?: string };
      w.__switch090 = 'pending';
      void import(/* @vite-ignore */ url!).then(
        (mod: { DEMO_ACTORS: readonly { role: string }[]; setActor: (actor: unknown) => void }) => {
          mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
          w.__switch090 = 'done';
        },
        (error: unknown) => {
          w.__switch090 = `failed: ${String(error)}`;
        },
      );
    },
    [ACTOR_MODULE, role],
  );
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __switch090?: string }).__switch090))
    .toBe('done');
}

async function waitForCorpus(page: Page): Promise<void> {
  const questions = page.getByTestId('header-counter-questions');
  await expect(questions).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => Number((await questions.innerText()).replace(/\D/g, '')), { timeout: 90_000 })
    .toBeGreaterThanOrEqual(SEEDED_QUESTIONS);
}

/** The value of a field if it is on screen, `null` if it is not — polled, never read once. */
/**
 * Codex P1 on PR #38: a dialog that empties its field in an effect after opening can still paint
 * the previous actor's text for one frame. A MutationObserver callback runs before that effect's
 * paint, so it sees any field that is inserted carrying the secret.
 */
async function watchForSecret(page: Page, secret: string): Promise<void> {
  await page.evaluate((needle) => {
    const w = window as unknown as { __secretSeen?: boolean };
    w.__secretSeen = false;
    const scan = (): void => {
      for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
        if (el.value.includes(needle)) w.__secretSeen = true;
      }
    };
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  }, secret);
}

async function secretSeen(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __secretSeen?: boolean }).__secretSeen === true);
}

async function valueOrAbsent(page: Page, testId: string): Promise<string | null> {
  const field = page.getByTestId(testId);
  if ((await field.count()) === 0) return null;
  return field.inputValue();
}

/**
 * Cleared, not just hidden: the field is either gone or empty, and stays so once the view has
 * settled. Before 090 a field a role *also* sees kept the previous person's text in view.
 */
async function expectCleared(page: Page, testId: string, secret: string): Promise<void> {
  await expect.poll(() => valueOrAbsent(page, testId)).not.toBe(secret);
  await page.waitForTimeout(300);
  expect(['', null]).toContain(await valueOrAbsent(page, testId));
  await expect(page.locator('#main')).not.toContainText(secret);
}

const API_MODULE = '/src/api/index.ts';

/**
 * Records the arguments of every `listQuestions` call in the running in-process API (dev server
 * only, as in 010c/010d). Started without awaiting anything in the page; the outcome is polled.
 */
async function recordListQuestions(page: Page): Promise<void> {
  await page.evaluate((url) => {
    const w = window as unknown as { __list090?: unknown[]; __rec090?: string };
    if (w.__rec090 !== undefined) return;
    w.__rec090 = 'pending';
    void import(/* @vite-ignore */ url).then(
      (mod: { api: Record<string, (...args: unknown[]) => Promise<unknown>> }) => {
        const original = mod.api['listQuestions']!.bind(mod.api);
        w.__list090 = [];
        mod.api['listQuestions'] = (...args: unknown[]) => {
          w.__list090!.push(args[0] ?? null);
          return original(...args);
        };
        w.__rec090 = 'ready';
      },
      (error: unknown) => {
        w.__rec090 = `failed: ${String(error)}`;
      },
    );
  }, API_MODULE);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __rec090?: string }).__rec090))
    .toBe('ready');
}

/** The `q` of every recorded `listQuestions` call from index `from` on (`null` for none). */
async function searchesFrom(page: Page, from: number): Promise<(string | null)[]> {
  return page.evaluate(
    (start) =>
      ((window as unknown as { __list090: ({ q?: string } | null)[] }).__list090 ?? [])
        .slice(start)
        .map((args) => args?.q ?? null),
    from,
  );
}

async function listCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __list090: unknown[] }).__list090.length);
}

/** The capture desk with the Redebeitrag form open for the preselected Wortmeldung. */
async function captureForm(page: Page): Promise<void> {
  await page.goto('/capture');
  await waitForCorpus(page);
  const text = page.getByTestId('capture-text');
  const compose = page.getByTestId('capture-contribution-new');
  await expect(text.or(compose)).toBeVisible();
  if (!(await text.isVisible())) await compose.click();
  await expect(text).toBeVisible();
}

/** The Beantwortung as `role`, one question of `status` selected. */
async function answersWith(page: Page, role: string, status: string): Promise<void> {
  await page.goto('/answers');
  await waitForCorpus(page);
  await asRole(page, role);
  await selectFirst(page, status);
}

async function selectFirst(page: Page, status: string): Promise<void> {
  await page.getByTestId(`answers-filter-status-${status}`).click();
  const row = page.getByTestId('answers-row').first();
  await expect(row).toHaveAttribute('data-status', status);
  await row.click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
}

test('090: Erfassung, Redebeitrag (draft) — capture tippt, Wechsel zu observer und zurück: leer', async ({
  page,
}) => {
  await captureForm(page);
  await page.getByTestId('capture-text').fill('Vertraulicher Redebeitrag der vorigen Person.');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'capture-text')).not.toBe(
    'Vertraulicher Redebeitrag der vorigen Person.',
  );
  await expect(page.locator('#main')).not.toContainText(
    'Vertraulicher Redebeitrag',
  );

  await asRole(page, 'capture');
  const text = page.getByTestId('capture-text');
  const compose = page.getByTestId('capture-contribution-new');
  await expect(text.or(compose)).toBeVisible();
  if (!(await text.isVisible())) await compose.click();
  await expect.poll(() => valueOrAbsent(page, 'capture-text')).toBe('');
  await checkAxe(page, 'capture (090, after a role switch and back)');
});

test('090: Erfassung, freie Einzelfrage (free) — capture tippt, Wechsel zu observer und zurück: leer', async ({
  page,
}) => {
  await captureForm(page);
  await page.getByTestId('capture-text').fill('Ein Redebeitrag, damit das Feld für freie Fragen erscheint.');
  await page.getByTestId('capture-submit').click();
  const free = page.getByTestId('capture-free-input');
  await expect(free).toBeVisible();
  await free.fill('Vertrauliche Frage der vorigen Person?');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'capture-free-input')).not.toBe(
    'Vertrauliche Frage der vorigen Person?',
  );

  await asRole(page, 'capture');
  await expect(free).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'capture-free-input')).toBe('');
});

test('090: Antwortentwurf — expert tippt, Wechsel zu legal und zurück: leer', async ({ page }) => {
  await answersWith(page, 'expert', 'assigned');
  const number = await page.getByTestId('answers-detail-number').innerText();
  await page.getByTestId('answer-editor').fill('Vertraulicher Antwortentwurf der vorigen Person.');
  await page.getByTestId('answer-sources').fill('Vertrauliche Quelle');

  await asRole(page, 'legal');
  await expect.poll(() => valueOrAbsent(page, 'answer-editor')).not.toBe(
    'Vertraulicher Antwortentwurf der vorigen Person.',
  );

  await asRole(page, 'expert');
  // The same question again, whether or not the selection survived the switch.
  if ((await page.getByTestId('answers-detail-number').count()) === 0) {
    await selectFirst(page, 'assigned');
  }
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await expect(page.getByTestId('answer-editor')).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'answer-editor')).toBe('');
  await expect.poll(() => valueOrAbsent(page, 'answer-sources')).toBe('');
  await checkAxe(page, 'answers (090, after a role switch and back)');
});

test('090: Begründung der Rückgabe — legal tippt, Wechsel zu approver und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await answersWith(page, 'legal', 'in_review');
  await page.getByTestId('answer-return').click();
  await page.getByTestId('answer-return-reason').fill('Vertrauliche Begründung der vorigen Person.');

  await switchActor(page, 'approver');
  await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);

  await asRole(page, 'legal');
  await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);
  if ((await page.getByTestId('answer-return').count()) === 0) await selectFirst(page, 'in_review');
  await page.getByTestId('answer-return').click();
  await expect.poll(() => valueOrAbsent(page, 'answer-return-reason')).toBe('');
});

test('090: Wortmeldung registrieren (Name) — moderation tippt, Wechsel zu capture und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await page.goto('/speakers');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill('Vertraulicher Name');

  await switchActor(page, 'capture');
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);

  await asRole(page, 'moderation');
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);
  await page.getByTestId('speaker-register').click();
  await expect.poll(() => valueOrAbsent(page, 'speaker-register-name')).toBe('');
});

test('090: Suche der Historie — admin tippt, Wechsel zu observer und zurück: leer', async ({ page }) => {
  await page.goto('/history');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  const search = page.getByTestId('history-search');
  await expect(search).toBeVisible();
  await search.fill('Vertraulicher Suchbegriff');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'history-search')).not.toBe('Vertraulicher Suchbegriff');

  await asRole(page, 'admin');
  await expect(search).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'history-search')).toBe('');
  await checkAxe(page, 'history (090, after a role switch and back)');
});

test('090: Suche der Beantwortung — admin tippt, Wechsel zu observer und zurück: leer', async ({ page }) => {
  await page.goto('/answers');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  const search = page.getByTestId('answers-search');
  await expect(search).toBeVisible();
  await search.fill('Vertraulicher Suchbegriff');

  await asRole(page, 'observer');
  await expect.poll(() => valueOrAbsent(page, 'answers-search')).not.toBe('Vertraulicher Suchbegriff');

  await asRole(page, 'admin');
  await expect(search).toBeVisible();
  await expect.poll(() => valueOrAbsent(page, 'answers-search')).toBe('');
  await checkAxe(page, 'answers (090, search after a role switch and back)');
});

test('090: Nummer im Zusammenführen-Dialog — capture tippt, Wechsel zu moderation und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await answersWith(page, 'capture', 'assigned');
  await page.getByTestId('answer-merge').click();
  await page.getByTestId('answer-merge-target').fill('F-0001');

  await switchActor(page, 'moderation');
  await expect(page.getByTestId('answer-merge-target')).toHaveCount(0);

  await switchActor(page, 'capture');
  await expect(page.getByTestId('answer-merge-target')).toHaveCount(0);
  if ((await page.getByTestId('answer-merge').count()) === 0) await selectFirst(page, 'assigned');
  await page.getByTestId('answer-merge').click();
  await expect.poll(() => valueOrAbsent(page, 'answer-merge-target')).toBe('');
});

test('090: Begründung der Rückgabe auf der Bühne — podium tippt, Wechsel zu approver und zurück: Dialog zu, Feld leer', async ({
  page,
}) => {
  await page.goto('/stage');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  await page.getByTestId('stage-return').click();
  await page.getByTestId('stage-return-reason').fill('Vertrauliche Begründung am Pult.');

  await switchActor(page, 'approver');

  await expect(page.getByTestId('stage-return')).toBeVisible();
  await expect(page.getByTestId('stage-return-reason')).toHaveCount(0);

  await switchActor(page, 'podium');
  await expect(page.getByTestId('stage-return')).toBeVisible();
  await expect(page.getByTestId('stage-return-reason')).toHaveCount(0);
  await page.getByTestId('stage-return').click();
  await expect.poll(() => valueOrAbsent(page, 'stage-return-reason')).toBe('');
});

/*
 * Review R1, finding 2: a switch to a role without the field unmounts it and hides any leak. Each
 * field is therefore also switched to a role that sees the same field (in the demo mostly admin).
 */

const DRAFT = 'GEHEIM-DRAFT Redebeitrag der vorigen Person.';
const FREE = 'GEHEIM-DRAFT Frage der vorigen Person?';

/** The capture desk with a Redebeitrag for the preselected Wortmeldung and `free` typed. */
async function captureFree(page: Page): Promise<void> {
  await captureForm(page);
  await page.getByTestId('capture-text').fill('Ein Redebeitrag, damit das Feld für freie Fragen erscheint.');
  await page.getByTestId('capture-submit').click();
  await expect(page.getByTestId('capture-free-input')).toBeVisible();
  await page.getByTestId('capture-free-input').fill(FREE);
}

test('090 R1: Erfassung, Redebeitrag (draft) — capture tippt, Wechsel zu admin (sieht die Erfassung auch): leer', async ({
  page,
}) => {
  await captureForm(page);
  await page.getByTestId('capture-text').fill(DRAFT);
  await asRole(page, 'admin');
  await expect(page.getByTestId('capture-speaker-select')).toBeVisible();
  await expectCleared(page, 'capture-text', DRAFT);
});

test('090 R1: Erfassung, Redebeitrag (draft) — capture tippt, Wechsel zu moderation und zurück: leer', async ({
  page,
}) => {
  await captureForm(page);
  await page.getByTestId('capture-text').fill(DRAFT);
  await asRole(page, 'moderation');
  await expect(page.getByTestId('capture-speaker-select')).toBeVisible();
  await expectCleared(page, 'capture-text', DRAFT);
  await asRole(page, 'capture');
  await expect(page.getByTestId('capture-speaker-select')).toBeVisible();
  await expectCleared(page, 'capture-text', DRAFT);
});

test('090 R1: Erfassung, freie Einzelfrage (free) — capture tippt, Wechsel zu admin (sieht die Erfassung auch): leer', async ({
  page,
}) => {
  await captureFree(page);
  await asRole(page, 'admin');
  await expect(page.getByTestId('capture-free-input')).toBeVisible();
  await expectCleared(page, 'capture-free-input', FREE);
});

test('090 R1: Erfassung, freie Einzelfrage (free) — capture tippt, Wechsel zu moderation und zurück: leer', async ({
  page,
}) => {
  await captureFree(page);
  await asRole(page, 'moderation');
  await expect(page.getByTestId('capture-speaker-select')).toBeVisible();
  await expectCleared(page, 'capture-free-input', FREE);
  await asRole(page, 'capture');
  await expect(page.getByTestId('capture-free-input')).toBeVisible();
  await expectCleared(page, 'capture-free-input', FREE);
});

test('090 R1: Antwortentwurf — expert tippt, Wechsel zu admin (darf auch entwerfen): leer', async ({ page }) => {
  await answersWith(page, 'expert', 'assigned');
  const number = await page.getByTestId('answers-detail-number').innerText();
  await page.getByTestId('answer-editor').fill(DRAFT);
  await page.getByTestId('answer-sources').fill('GEHEIM-QUELLE');

  await asRole(page, 'admin');
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await expect(page.getByTestId('answer-editor')).toBeVisible();
  await expectCleared(page, 'answer-editor', DRAFT);
  await expectCleared(page, 'answer-sources', 'GEHEIM-QUELLE');
});

test('090 R1: Begründung der Rückgabe — legal tippt, Wechsel zu admin (darf auch zurückgeben): Dialog zu, neu geöffnet leer', async ({
  page,
}) => {
  await answersWith(page, 'legal', 'in_review');
  await page.getByTestId('answer-return').click();
  await page.getByTestId('answer-return-reason').fill(DRAFT);

  await switchActor(page, 'admin');
  await expect(page.getByTestId('answer-return')).toBeVisible();
  await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);
  await watchForSecret(page, DRAFT);
  await page.getByTestId('answer-return').click();
  await expect.poll(() => valueOrAbsent(page, 'answer-return-reason')).toBe('');
  expect(await secretSeen(page)).toBe(false);
});

test('090 R1: Wortmeldung registrieren (Name) — moderation tippt, Wechsel zu admin (darf auch registrieren): Dialog zu, neu geöffnet leer', async ({
  page,
}) => {
  await page.goto('/speakers');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill(DRAFT);

  await switchActor(page, 'admin');
  await expect(page.getByTestId('speaker-register')).toBeVisible();
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);
  await watchForSecret(page, DRAFT);
  await page.getByTestId('speaker-register').click();
  await expect.poll(() => valueOrAbsent(page, 'speaker-register-name')).toBe('');
  expect(await secretSeen(page)).toBe(false);
});

test('090 R1: Nummer im Zusammenführen-Dialog — capture tippt, Wechsel zu admin (darf auch zusammenführen): Dialog zu, neu geöffnet leer', async ({
  page,
}) => {
  await answersWith(page, 'capture', 'assigned');
  await page.getByTestId('answer-merge').click();
  await page.getByTestId('answer-merge-target').fill('F-0001');

  await switchActor(page, 'admin');
  await expect(page.getByTestId('answer-merge')).toBeVisible();
  await expect(page.getByTestId('answer-merge-target')).toHaveCount(0);
  await watchForSecret(page, 'F-0001');
  await page.getByTestId('answer-merge').click();
  await expect.poll(() => valueOrAbsent(page, 'answer-merge-target')).toBe('');
  expect(await secretSeen(page)).toBe(false);
});

test('090 R1: Begründung der Rückgabe auf der Bühne — podium tippt, Wechsel zu admin (darf auch zurückgeben): Dialog zu, neu geöffnet leer', async ({
  page,
}) => {
  await page.goto('/stage');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  await page.getByTestId('stage-return').click();
  await page.getByTestId('stage-return-reason').fill(DRAFT);

  await switchActor(page, 'admin');
  await expect(page.getByTestId('stage-return')).toBeVisible();
  await expect(page.getByTestId('stage-return-reason')).toHaveCount(0);
  await watchForSecret(page, DRAFT);
  await page.getByTestId('stage-return').click();
  await expect.poll(() => valueOrAbsent(page, 'stage-return-reason')).toBe('');
  expect(await secretSeen(page)).toBe(false);
});

for (const [view, field] of [
  ['answers', 'answers-search'],
  ['history', 'history-search'],
] as const) {
  test(`090 R1: Suche (${view}) — admin tippt, Wechsel zu moderation (sieht die Ansicht auch): leer, kein Abruf mit dem Begriff`, async ({
    page,
  }) => {
    await page.goto(`/${view}`);
    await waitForCorpus(page);
    await asRole(page, 'admin');
    await recordListQuestions(page);
    const search = page.getByTestId(field);
    await expect(search).toBeVisible();
    await search.fill('GEHEIM');
    // The term has reached the API once, debounced: the recording works.
    await expect.poll(() => searchesFrom(page, 0)).toContain('GEHEIM');
    await page.waitForTimeout(300);
    const before = await listCalls(page);

    await asRole(page, 'moderation');
    await expect(search).toBeVisible();
    await expectCleared(page, field, 'GEHEIM');
    // Review R1, finding 6: the reads after the switch carry no term of the previous person.
    await expect.poll(async () => (await searchesFrom(page, before)).length).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    expect(await searchesFrom(page, before)).not.toContain('GEHEIM');
  });
}
