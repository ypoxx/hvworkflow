/**
 * Slice 010d — Ansichtsdaten gehören dem Schlüssel des Akteurs (docs/slices/010d-ansichtsdaten-je-akteur.md).
 *
 * 010c tied every read state to the key of its load. Three places of the same family were left:
 * (a) the previous role's data — with its `_actions` — stayed on screen and could be used after a
 * role switch until the new role had answered (Ziel 1, principle 9: what is not allowed is not
 * offered); (b) the Beantwortung showed "Kein Treffer … Auswahl zurücksetzen" when its first read
 * failed (Ziel 2, D6); (c) the outcome of an older write — "Stand veraltet", closing the dialog,
 * emptying the draft — reached the question shown by then (Ziel 3).
 *
 * Every test here was run red against the code before the change (`e303cc1`); the Bericht quotes it.
 * The patches wrap one `HvApi` method in the running in-process API, as in `010c-lesezustand.spec.ts`
 * (dev server only, own port per worktree).
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { checkAxe } from './support/axe';

const SEEDED_QUESTIONS = 800;

/** Evidence belongs to the repository, not to the test run: `testDir` is `apps/web/e2e`. */
const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;
const API_MODULE = '/src/api/index.ts';
const ACTOR_MODULE = '/src/api/actor.ts';

type Wrapped = Record<string, (...args: unknown[]) => Promise<unknown>>;

/** The test's own handle on the patched API, kept on `window` between `evaluate` calls. */
interface Held {
  args: unknown[];
  answer: Promise<unknown> | null;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}
interface Harness {
  __calls: Record<string, unknown[]>;
  __held: Record<string, Held[]>;
  __original: Wrapped;
  /** The app's own module instances, resolved once per page by `installHarness`. */
  __modules: Record<string, unknown>;
  /** `installHarness`'s own progress: `loading`, `ready`, or `failed: …`. */
  __harness: string;
}

test.use({ viewport: { width: 1440, height: 900 } });

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
  await installHarness(page);
}

/** Two settled repaints (see `expectNoErrorToast` in 010b-lesepfade.spec.ts for why two). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** The shell's toast stack, scoped to its live region (a gestalteter Zustand is `role="status"` too). */
const toasts = (page: Page): Locator => page.locator('[aria-live="polite"] [role="status"]');

/**
 * Installs the harness once per page: call log, held calls, the unpatched methods and the app's two
 * module instances (`__modules`).
 *
 * Slice 010d, Ziel 5: the evaluate awaits nothing in the page. It starts the two dynamic imports and
 * returns at once; the imports report into `__harness`, which the test polls. The page therefore
 * never holds a pending promise for Playwright to wait on — the shape of the CI finding on 62f347b
 * ("Resulting promise was garbage collected") cannot occur here, and a failed import shows up as
 * its own message instead of a timeout.
 */
async function installHarness(page: Page): Promise<void> {
  await page.evaluate(
    ([apiUrl, actorUrl]) => {
      const w = window as unknown as Harness;
      if (w.__harness !== undefined) return;
      w.__harness = 'loading';
      void Promise.all([import(/* @vite-ignore */ apiUrl!), import(/* @vite-ignore */ actorUrl!)]).then(
        ([apiModule, actorModule]) => {
          const { api } = apiModule as { api: Wrapped };
          w.__modules = { [apiUrl!]: apiModule, [actorUrl!]: actorModule };
          w.__calls = {};
          w.__held = {};
          w.__original = {};
          for (const name of Object.keys(api)) {
            if (typeof api[name] === 'function') w.__original[name] = api[name]!.bind(api);
          }
          w.__harness = 'ready';
        },
        (error: unknown) => {
          w.__harness = `failed: ${String(error)}`;
        },
      );
    },
    [API_MODULE, ACTOR_MODULE],
  );
  await expect.poll(() => page.evaluate(() => (window as unknown as Harness).__harness)).toBe('ready');
}

/**
 * The next call of `method` whose first argument has every field of `match` (any call without
 * `match`) is refused with a 500 — `afterMs` later, if given; every call is counted.
 */
async function failOnce(
  page: Page,
  method: string,
  match?: Record<string, unknown>,
  afterMs = 0,
): Promise<void> {
  await page.evaluate(
    ([url, name, wanted, later]) => {
      const { api } = ((window as unknown as Harness).__modules[url as string]) as { api: Wrapped };
      const w = window as unknown as Harness;
      const original = w.__original[name as string]!;
      const calls: unknown[] = [];
      w.__calls[name as string] = calls;
      let failed = false;
      api[name as string] = (...args: unknown[]) => {
        calls.push(args[0] ?? null);
        const first = args[0] as Record<string, unknown> | undefined;
        const fits =
          wanted === null ||
          (typeof first === 'object' &&
            first !== null &&
            Object.entries(wanted as Record<string, unknown>).every(([k, v]) => first[k] === v));
        if (!failed && fits) {
          failed = true;
          const fault = { status: 500, title: 'Testfehler', detail: '010d, absichtlich' };
          if (later === 0) return Promise.reject(fault);
          return new Promise((_, reject) => window.setTimeout(() => reject(fault), later as number));
        }
        return original(...args);
      };
    },
    [API_MODULE, method, match ?? null, afterMs] as const,
  );
}

/**
 * Every call of `method` is held back. `answerNow`: the API answers at once — for the actor current
 * at that moment — and only the hand-over to the page waits. Otherwise the call does not reach the
 * API at all until the test runs or refuses it.
 */
async function holdCalls(page: Page, method: string, answerNow: boolean): Promise<void> {
  await page.evaluate(
    ([url, name, now]) => {
      const { api } = ((window as unknown as Harness).__modules[url as string]) as { api: Wrapped };
      const w = window as unknown as Harness;
      const original = w.__original[name as string]!;
      const held: Held[] = [];
      w.__held[name as string] = held;
      w.__calls[name as string] = [];
      api[name as string] = (...args: unknown[]) => {
        w.__calls[name as string]!.push(args[0] ?? null);
        const answer = now === true ? original(...args) : null;
        // Handled on release — this only keeps a held refusal from counting as unhandled.
        answer?.catch(() => undefined);
        return new Promise((resolve, reject) => {
          held.push({ args, answer, resolve, reject });
        });
      };
    },
    [API_MODULE, method, answerNow] as const,
  );
}

/** Hands every held answer of `method` to the page (the `answerNow` kind), then stops holding. */
async function releaseAll(page: Page, method: string): Promise<void> {
  await page.evaluate(
    ([url, name]) => {
      const { api } = ((window as unknown as Harness).__modules[url!]) as { api: Wrapped };
      const w = window as unknown as Harness;
      api[name!] = w.__original[name!]!;
      for (const call of w.__held[name!]!.splice(0)) {
        void call.answer!.then(call.resolve, call.reject);
      }
    },
    [API_MODULE, method],
  );
}

/** Refuses the held call number `index` of `method` with `status` (a 412 is "someone else wrote first"). */
async function refuseHeld(page: Page, method: string, index: number, status: number): Promise<void> {
  await page.evaluate(
    ([name, at, code]) => {
      const w = window as unknown as Harness;
      w.__held[name as string]![at as number]!.reject({
        status: code,
        title: 'Testfehler',
        detail: '010d, absichtlich',
      });
    },
    [method, index, status] as const,
  );
}

/** Runs the held call number `index` of `method` against the API after all, and hands its answer on. */
async function runHeld(page: Page, method: string, index: number): Promise<void> {
  await page.evaluate(
    ([name, at]) => {
      const w = window as unknown as Harness;
      const call = w.__held[name as string]![at as number]!;
      void w.__original[name as string]!(...call.args).then(call.resolve, call.reject);
    },
    [method, index] as const,
  );
}

async function callCount(page: Page, method: string): Promise<number> {
  return page.evaluate((name) => (window as unknown as Harness).__calls[name]?.length ?? 0, method);
}

/** Switches the demo actor without the header — the call the role switcher makes. */
async function switchActor(page: Page, role: string): Promise<void> {
  await page.evaluate(
    ([url, wanted]) => {
      const mod = ((window as unknown as Harness).__modules[url!]) as {
        DEMO_ACTORS: readonly { role: string }[];
        setActor: (actor: unknown) => void;
      };
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
    },
    [ACTOR_MODULE, role],
  );
}

/**
 * An event from somebody else: a new Wortmeldung, registered by the administration persona, which
 * bumps `version` for every view. The actor is swapped and restored in the same task — the view
 * never sees an actor change, only the new event. Synchronous: the evaluate awaits nothing in the
 * page; the outcome is polled.
 */
async function unrelatedEvent(page: Page, name: string): Promise<void> {
  const index = await page.evaluate(
    ([actorUrl, displayName]) => {
      const w = window as unknown as Harness & { __writes?: string[] };
      const mod = w.__modules[actorUrl!] as {
        DEMO_ACTORS: readonly { id: string }[];
        getActor: () => unknown;
        setActor: (actor: unknown) => void;
      };
      const writes = (w.__writes ??= []);
      const before = mod.getActor();
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.id === 'u-admin'));
      let written: Promise<unknown>;
      try {
        written = w.__original['registerSpeaker']!({ displayName, kind: 'shareholder' });
      } finally {
        mod.setActor(before);
      }
      const at = writes.push('pending') - 1;
      written.then(
        () => (writes[at] = 'ok'),
        (error: unknown) =>
          (writes[at] = `failed: ${(error as { detail?: string } | null)?.detail ?? String(error)}`),
      );
      return at;
    },
    [ACTOR_MODULE, name],
  );
  await expect
    .poll(() => page.evaluate((at) => (window as unknown as { __writes: string[] }).__writes[at], index))
    .toBe('ok');
}

/** None of `testIds` is in the page — not hidden, not greyed out: absent (principle 9). */
async function expectAbsent(page: Page, testIds: readonly string[]): Promise<void> {
  for (const id of testIds) await expect(page.getByTestId(id), id).toHaveCount(0);
}

/** The Beantwortung with legal, filtered to "in Prüfung": every row there offers "Freigeben". */
async function answersInReviewAsLegal(page: Page): Promise<void> {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'legal');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-in_review').click();
  await expect(page.getByTestId('answers-row').first()).toBeVisible();
}

const SPEAKER_ACTIONS = [
  'speaker-register',
  'speaker-call',
  'speaker-call-next',
  'speaker-finish',
  'speaker-withdraw',
  'speaker-move',
  'speaker-drag-handle',
] as const;

const CAPTURE_ACTIONS = [
  'capture-contribution-new',
  'capture-free-input',
  'capture-free-add',
  'capture-suggest',
  'capture-add-selection',
  'capture-classify-open',
  'capture-text',
  'capture-submit',
] as const;

const ANSWER_ACTIONS = [
  'answer-withdraw',
  'answer-merge',
  'answer-assign',
  'answer-return',
  'answer-submit-review',
  'answer-approve',
  'answer-stage',
  'answer-editor',
  'answer-submit-draft',
] as const;

// ---------------------------------------------------------------------------------------------
// Ziel 1: until the new role's first answer, nothing of the previous role is offered.
// ---------------------------------------------------------------------------------------------

test('010d Ziel 1: Wortmeldeliste — moderation → capture, Liste zurückgehalten: keine Zeile und kein Aktionsknopf der vorigen Rolle', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);
  await expect(page.getByTestId('speaker-register')).toBeVisible();
  await expect(page.getByTestId('speaker-move').first()).toBeVisible();

  await holdCalls(page, 'listSpeakers', true);
  await switchActor(page, 'capture');
  await expect.poll(() => callCount(page, 'listSpeakers')).toBeGreaterThan(0);

  await expectAbsent(page, [...SPEAKER_ACTIONS, 'speaker-row', 'speakers-readonly-hint']);
  await expect(page.getByText('Wortmeldeliste wird geladen')).toBeVisible();

  // capture's own answer: its rows, read-only, without a single step.
  await releaseAll(page, 'listSpeakers');
  await expect(page.getByTestId('speaker-row').first()).toBeVisible();
  await expect(page.getByTestId('speakers-readonly-hint')).toBeVisible();
  await expectAbsent(page, SPEAKER_ACTIONS);
  await expect(toasts(page)).toHaveCount(0);
  await checkAxe(page, 'speakers (010d, role switch)');
});

test('010d Ziel 1: Wortmeldeliste — ein Dialog der vorigen Rolle schließt mit dem Rollenwechsel', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('nav-speakers').click();
  await expect(page.getByTestId('speaker-register')).toBeVisible();
  await page.getByTestId('speaker-register').click();
  await expect(page.getByTestId('speaker-register-name')).toBeVisible();

  await holdCalls(page, 'listSpeakers', true);
  await switchActor(page, 'capture');
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);
  await releaseAll(page, 'listSpeakers');
  await expect(page.getByTestId('speakers-readonly-hint')).toBeVisible();
  await expect(page.getByTestId('speaker-register-name')).toHaveCount(0);
});

test('010d Ziel 1: Erfassung — capture → moderation, Lesevorgänge zurückgehalten: kein Erfassungs- oder Einordnungsknopf der vorigen Rolle', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'capture');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  // The desk offers capture's own steps: a new Redebeitrag, or the tools on an existing one.
  await expect(page.getByTestId('capture-free-input').or(page.getByTestId('capture-text'))).toBeVisible();

  for (const method of ['listSpeakers', 'listContributions', 'listQuestions']) {
    await holdCalls(page, method, true);
  }
  await switchActor(page, 'moderation');
  await expect.poll(() => callCount(page, 'listQuestions')).toBeGreaterThan(0);

  await expectAbsent(page, [...CAPTURE_ACTIONS, 'capture-question-card', 'capture-readonly-hint']);

  for (const method of ['listSpeakers', 'listContributions', 'listQuestions']) {
    await releaseAll(page, method);
  }
  // moderation reads the desk, but captures nothing.
  await expect(page.getByTestId('capture-speaker-select')).toBeVisible();
  await settle(page);
  await expectAbsent(page, CAPTURE_ACTIONS);
  await expect(toasts(page)).toHaveCount(0);
  await checkAxe(page, 'capture (010d, role switch)');
});

test('010d Ziel 1: Beantwortung — legal → expert, Liste und Einzelfrage zurückgehalten: kein "Freigeben", keine Zeile der vorigen Rolle', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  await page.getByTestId('answers-row').first().click();
  await expect(page.getByTestId('answer-approve')).toBeVisible();

  for (const method of ['listQuestions', 'getQuestion', 'getQuestionHistory']) {
    await holdCalls(page, method, true);
  }
  await switchActor(page, 'expert');
  await expect.poll(() => callCount(page, 'listQuestions')).toBeGreaterThan(0);

  await expectAbsent(page, [...ANSWER_ACTIONS, 'answers-row', 'answers-detail', 'answers-readonly-hint']);
  await expect(page.locator('[aria-label="Bestand wird geladen …"][aria-busy="true"]')).toBeVisible();
  await expect(page.getByText('Einzelfrage wird geladen …')).toBeVisible();

  for (const method of ['listQuestions', 'getQuestion', 'getQuestionHistory']) {
    await releaseAll(page, method);
  }
  // expert's own record: the question, but no "Freigeben".
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answers-row').first()).toBeVisible();
  await expect(page.getByTestId('answer-approve')).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(0);
  await checkAxe(page, 'answers (010d, role switch)');
});

test('010d Ziel 1: Beantwortung — langsame Liste: die Einzelfrage der neuen Rolle erscheint mit deren Schritten, keine Zeile der vorigen', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  const row = page.getByTestId('answers-row').first();
  const number = (await row.getAttribute('data-number'))!;
  await row.click();
  await expect(page.getByTestId('answer-approve')).toBeVisible();

  // Only the list is held; expert's own `getQuestion` answers first.
  await holdCalls(page, 'listQuestions', true);
  await switchActor(page, 'expert');
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await expect(page.getByTestId('answer-editor')).toBeVisible();
  await expect(page.getByTestId('answer-approve')).toHaveCount(0);
  await expect(page.getByTestId('answers-row')).toHaveCount(0);

  await releaseAll(page, 'listQuestions');
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toBeVisible();
  await expect(page.getByTestId('answer-approve')).toHaveCount(0);
});

test('010d Ziel 1: Beantwortung — ein Dialog der vorigen Rolle schließt mit dem Rollenwechsel', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  await page.getByTestId('answers-row').first().click();
  await page.getByTestId('answer-return').click();
  await expect(page.getByTestId('answer-return-reason')).toBeVisible();

  await switchActor(page, 'expert');
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answer-return-reason')).toHaveCount(0);
});

test('010d Ziel 1: Historie — admin → observer, Hauptabfrage und Verlauf zurückgehalten: kein Treffer und kein Verlauf der vorigen Rolle', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await page.getByTestId('history-result').first().click();
  await expect(page.getByTestId('history-event').first()).toBeVisible();

  for (const method of ['listQuestions', 'getQuestionHistory']) {
    await holdCalls(page, method, true);
  }
  await switchActor(page, 'observer');
  await expect.poll(() => callCount(page, 'listQuestions')).toBeGreaterThan(0);

  await expectAbsent(page, ['history-result', 'history-timeline', 'history-event', 'history-kpi']);
  await expect(page.locator('[aria-label="Bestand wird durchsucht …"][aria-busy="true"]')).toBeVisible();
  await expect(page.locator('[aria-label="Bestand wird geladen …"][aria-busy="true"]')).toBeVisible();

  for (const method of ['listQuestions', 'getQuestionHistory']) {
    await releaseAll(page, method);
  }
  await expect(page.getByTestId('history-result').first()).toBeVisible();
  await expect(page.getByTestId('history-event')).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(0);
  await checkAxe(page, 'history (010d, role switch)');
});

test('010d Ziel 1: Historie, Ereignisstrom — admin → observer, Abruf zurückgehalten: kein Ereignis der vorigen Rolle', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-history').click();
  await page.getByTestId('history-tab-stream').click();
  await expect(page.getByTestId('history-event').first()).toBeVisible();

  await holdCalls(page, 'listEvents', true);
  await switchActor(page, 'observer');
  await expect.poll(() => callCount(page, 'listEvents')).toBeGreaterThan(0);
  await expectAbsent(page, ['history-stream', 'history-event']);
  await expect(page.locator('[aria-label="Bestand wird geladen …"][aria-busy="true"]')).toBeVisible();

  await releaseAll(page, 'listEvents');
  await expect(page.getByTestId('history-stream-forbidden')).toBeVisible();
  await expectAbsent(page, ['history-stream', 'history-event']);
  await expect(toasts(page)).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Ziel 2: a failed list without data is a gestalteter Fehlerzustand, never "Kein Treffer".
// ---------------------------------------------------------------------------------------------

test('010d Ziel 2: Beantwortung — erster Abruf mit 500: Fehlerzustand, kein "Kein Treffer", erneut versuchen lädt', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'expert');
  await failOnce(page, 'listQuestions', { limit: 2000 });
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);

  const failed = page.getByTestId('answers-list-error');
  await expect(failed).toBeVisible();
  await expect(failed).toContainText('Die Einzelfragen konnten nicht geladen werden');
  await expect(page.getByText('Kein Treffer')).toHaveCount(0);
  await expect(page.getByText('Keine Einzelfrage gewählt')).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010d-beantwortung-ladefehler.png') });
  await checkAxe(page, 'answers (010d, failed first read)');

  await failed.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByTestId('answers-row').first()).toBeVisible();
  await expect(failed).toHaveCount(0);
});

test('010d Ziel 2: Beantwortung — Rollenwechsel, erster Abruf der neuen Rolle mit 500: Fehlerzustand statt der Zeilen der vorigen Rolle', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  await failOnce(page, 'listQuestions', { limit: 2000 });
  await switchActor(page, 'expert');

  await expect(page.getByTestId('answers-list-error')).toBeVisible();
  await expect(page.getByTestId('answers-row')).toHaveCount(0);
  await expect(page.getByText('Kein Treffer')).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(1);
});

for (const [first, second] of [
  ['listQuestions', 'getQuestion'],
  ['getQuestion', 'listQuestions'],
] as const) {
  test(`010d Ziel 2: Beantwortung — Rollenwechsel mit Auswahl, ${first} scheitert vor ${second}: Fehlerzustand, nichts der vorigen Rolle`, async ({
    page,
  }) => {
    await answersInReviewAsLegal(page);
    await page.getByTestId('answers-row').first().click();
    await expect(page.getByTestId('answer-approve')).toBeVisible();

    await failOnce(page, first, first === 'listQuestions' ? { limit: 2000 } : undefined, 100);
    await failOnce(page, second, second === 'listQuestions' ? { limit: 2000 } : undefined, 300);
    await switchActor(page, 'expert');

    await expect(page.getByTestId('answers-list-error')).toBeVisible();
    await expect(toasts(page)).toHaveCount(2);
    await page.waitForTimeout(300);
    await settle(page);
    await expect(toasts(page)).toHaveCount(2);
    await expectAbsent(page, [...ANSWER_ACTIONS, 'answers-row', 'answers-detail']);
    await expect(page.getByText('Kein Treffer')).toHaveCount(0);
  });
}

test('010d Ziel 2 (Gegenprobe): Beantwortung — dieselbe Rolle, ein Abruf mit 500 bei vorhandenen Zeilen: die Zeilen bleiben', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  const rows = await page.getByTestId('answers-row').count();
  await failOnce(page, 'listQuestions', { limit: 2000 });
  // A reload of the same actor: the toast says it failed, the rows it already had stand.
  await unrelatedEvent(page, 'Testperson 010d Gegenprobe');
  await expect(toasts(page)).toHaveCount(1);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(page.getByTestId('answers-row')).toHaveCount(rows);
  await expect(page.getByTestId('answers-list-error')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Ziel 3: the outcome of a write applies only to its own question, for its own actor.
// ---------------------------------------------------------------------------------------------

test('010d Ziel 3: Beantwortung — 412 auf A nach dem Wechsel zu B: kein "Stand veraltet" über B, ein Toast', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  const rows = page.getByTestId('answers-row');
  const detailNumber = page.getByTestId('answers-detail-number');
  await holdCalls(page, 'approveQuestion', false);

  await rows.nth(0).click();
  await page.getByTestId('answer-approve').click();
  const second = (await rows.nth(1).getAttribute('data-number'))!;
  await rows.nth(1).click();
  await expect(detailNumber).toHaveText(second);

  await refuseHeld(page, 'approveQuestion', 0, 412);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
  await expect(detailNumber).toHaveText(second);
  // A's refusal is still reported — as a toast, since A is no longer on screen.
  await expect(toasts(page)).toHaveCount(1);
  await expect(toasts(page)).toContainText('Testfehler');
});

test('010d Ziel 3: Beantwortung — Erfolg auf A nach dem Wechsel zu B: der Dialog auf B bleibt offen', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  const rows = page.getByTestId('answers-row');
  await holdCalls(page, 'approveQuestion', false);

  await rows.nth(0).click();
  await page.getByTestId('answer-approve').click();
  const second = (await rows.nth(1).getAttribute('data-number'))!;
  await rows.nth(1).click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(second);
  await page.getByTestId('answer-return').click();
  const reason = page.getByTestId('answer-return-reason');
  await reason.fill('Bitte die Quelle nachtragen.');

  await runHeld(page, 'approveQuestion', 0);
  await expect(toasts(page)).toHaveCount(1);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(reason).toBeVisible();
  await expect(reason).toHaveValue('Bitte die Quelle nachtragen.');
});

test('010d Ziel 3: Beantwortung — Erfolg eines Entwurfs auf A nach dem Wechsel zu B: der Entwurf auf B bleibt', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  const rows = page.getByTestId('answers-row');
  const editor = page.getByTestId('answer-editor');
  await holdCalls(page, 'draftAnswer', false);

  await rows.nth(0).click();
  await editor.fill('Entwurf zu A.');
  await page.getByTestId('answer-submit-draft').click();
  await expect.poll(() => callCount(page, 'draftAnswer')).toBe(1);

  const second = (await rows.nth(1).getAttribute('data-number'))!;
  await rows.nth(1).click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(second);
  await editor.fill('Entwurf zu B, noch nicht gespeichert.');

  await runHeld(page, 'draftAnswer', 0);
  await expect(toasts(page)).toHaveCount(1);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(editor).toHaveValue('Entwurf zu B, noch nicht gespeichert.');
});

test('010d Ziel 3: Beantwortung — 412 auf A nach einem Rollenwechsel, A bleibt gezeigt: kein "Stand veraltet" der vorigen Rolle', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  const row = page.getByTestId('answers-row').first();
  const number = (await row.getAttribute('data-number'))!;
  await holdCalls(page, 'approveQuestion', false);
  await row.click();
  await page.getByTestId('answer-approve').click();

  await switchActor(page, 'admin');
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await refuseHeld(page, 'approveQuestion', 0, 412);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(page.getByTestId('stale-banner')).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(1);
});

test('010d Ziel 3 (Gegenprobe): Beantwortung — 412 auf der gezeigten Frage: "Stand veraltet" steht über ihr, kein Toast', async ({
  page,
}) => {
  await answersInReviewAsLegal(page);
  await holdCalls(page, 'approveQuestion', false);
  await page.getByTestId('answers-row').first().click();
  await page.getByTestId('answer-approve').click();
  await refuseHeld(page, 'approveQuestion', 0, 412);
  await expect(page.getByTestId('stale-banner')).toBeVisible();
  await page.waitForTimeout(300);
  await settle(page);
  await expect(toasts(page)).toHaveCount(0);
});
