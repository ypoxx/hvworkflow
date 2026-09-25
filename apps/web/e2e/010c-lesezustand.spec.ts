/**
 * Slice 010c — Lesezustand je Ladevorgang (docs/slices/010c-lesezustand-je-ladevorgang.md).
 *
 * The class: a read state (ready, refused, failed) did not belong to the load that produced it. After
 * a switch from a refused role to one that may read, "keine Leseberechtigung" stood on when the new
 * role's first read failed with an ordinary error; an answer that was still on its way for the
 * previous actor could land in the gap between the actor switch and the `version` bump; the capture
 * desk read the Wortmeldung lookup's status of the previous key. Takt-008's N1–N3 are the same class
 * for write locks and focus markers.
 *
 * Every test here was run red against the code before the change (`452e89e`); the Bericht quotes it.
 * The patches wrap one `HvApi` method in the running in-process API, exactly as
 * `010b-lesepfade.spec.ts` does (dev server only, own port per worktree).
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
  /** The app's own module instances, resolved once by `installHarness` (CI finding on 62f347b). */
  __modules: Record<string, unknown>;
  /** Outcomes of the writes `unrelatedEvent` started, by number. */
  __writes: string[];
  /** `installHarness`'s own progress: `loading`, `ready`, or `failed: …` (slice 010d, Ziel 5). */
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
  // The only dynamic `import()` of the file, once per page and while it is idle (see installHarness).
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

/** Exactly one toast, and it stays one after the view has settled. */
async function expectOneToast(page: Page): Promise<void> {
  await expect(toasts(page)).toHaveCount(1);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(toasts(page)).toHaveCount(1);
}

/** The element that holds focus right now, by test id (`BODY` when focus fell to the body). */
async function focusedTestId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body) return 'BODY';
    return active.getAttribute('data-testid') ?? active.tagName;
  });
}

/** Presses Tab until the element with `testId` has focus — real keyboard focus, as in 013. */
async function tabTo(page: Page, testId: string, maxSteps = 60): Promise<void> {
  for (let step = 0; step < maxSteps; step++) {
    await page.keyboard.press('Tab');
    if ((await focusedTestId(page)) === testId) return;
  }
  throw new Error(`Tab did not reach ${testId}`);
}

/**
 * Installs the harness once per page: call log, held calls, the unpatched methods — and the app's
 * two module instances the helpers work on (`__modules`).
 *
 * CI finding on 62f347b ("Resulting promise was garbage collected" in `unrelatedEvent`): every
 * helper used to `await import(...)` the app's modules inside its `page.evaluate`, a few hundred
 * times per run. That error means the promise the evaluate awaited was still pending and no longer
 * reachable from anything that could settle it; the only awaited promises of `unrelatedEvent` that
 * were not already settled were its two dynamic imports (the write itself settles in the same task:
 * the in-process `registerSpeaker` appends synchronously). The helpers now resolve the modules once
 * here, at an idle moment right after the corpus is loaded, and every later evaluate is
 * import-free; `unrelatedEvent` awaits nothing in the page at all.
 *
 * Slice 010d, Ziel 5: nor does this one. The evaluate starts the two imports and returns at once;
 * the imports report into `__harness`, which the test polls — no evaluate of this file waits on a
 * pending promise in the page any more, and a failed import shows as its own message.
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
          w.__writes = [];
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
 * `match`) is refused with a 500 — `afterMs` later, if given; every call is counted in
 * `__calls[method]` (its first argument, `null` when there is none).
 */
async function failOnce(
  page: Page,
  method: string,
  match?: Record<string, unknown>,
  afterMs = 0,
): Promise<void> {
  await installHarness(page);
  await page.evaluate(
    async ([url, name, wanted, later]) => {
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
          const fault = { status: 500, title: 'Testfehler', detail: '010c, absichtlich' };
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
 * at that moment — and only the hand-over to the page waits (the latency patch of Codex P2-B in
 * 010b). Otherwise the call does not reach the API at all until the test runs or refuses it.
 */
async function holdCalls(page: Page, method: string, answerNow: boolean): Promise<void> {
  await installHarness(page);
  await page.evaluate(
    async ([url, name, now]) => {
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
    async ([url, name]) => {
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
        detail: '010c, absichtlich',
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

/**
 * An event from somebody else: a new Wortmeldung, registered by the administration persona, which
 * bumps `version` for every view. The actor is swapped and restored in the same task, around the
 * synchronous part of the write — the view never sees an actor change (same identity before and
 * after), only the new event.
 */
async function unrelatedEvent(page: Page, name: string): Promise<void> {
  await installHarness(page);
  // Synchronous on purpose: the evaluate awaits nothing in the page, the outcome is polled below.
  const index = await page.evaluate(
    ([actorUrl, displayName]) => {
      const w = window as unknown as Harness;
      const mod = w.__modules[actorUrl!] as {
        DEMO_ACTORS: readonly { id: string }[];
        getActor: () => unknown;
        setActor: (actor: unknown) => void;
      };
      const before = mod.getActor();
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.id === 'u-admin'));
      let written: Promise<unknown>;
      try {
        written = w.__original['registerSpeaker']!({ displayName, kind: 'shareholder' });
      } finally {
        mod.setActor(before);
      }
      const at = w.__writes.push('pending') - 1;
      written.then(
        () => (w.__writes[at] = 'ok'),
        // Slice 010d, Ziel 5: a refusal without a body (`null`, `undefined`) is reported, not thrown on.
        (error: unknown) =>
          (w.__writes[at] = `failed: ${(error as { detail?: string } | null)?.detail ?? String(error)}`),
      );
      return at;
    },
    [ACTOR_MODULE, name],
  );
  await expect
    .poll(() => page.evaluate((at) => (window as unknown as Harness).__writes[at], index))
    .toBe('ok');
}

/** Every call of `method` answers `ms` later (computed at call time, handed over late). */
async function delayCalls(page: Page, method: string, ms: number): Promise<void> {
  await installHarness(page);
  await page.evaluate(
    async ([url, name, wait]) => {
      const { api } = ((window as unknown as Harness).__modules[url as string]) as { api: Wrapped };
      const w = window as unknown as Harness;
      const original = w.__original[name as string]!;
      api[name as string] = (...args: unknown[]) => {
        const answer = original(...args);
        answer.catch(() => undefined);
        return new Promise((resolve, reject) => {
          window.setTimeout(() => void answer.then(resolve, reject), wait as number);
        });
      };
    },
    [API_MODULE, method, ms] as const,
  );
}

/** "Vorgelesen" from somebody else, on the unpatched API, for the question now on stage. */
async function deliverCurrentElsewhere(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as Harness;
    const stage = (await w.__original['getStage']!()) as {
      current: { id: string; version: number } | null;
    };
    if (stage.current === null) throw new Error('nothing on stage');
    await w.__original['deliverQuestion']!(stage.current.id, { ifMatch: `"v${stage.current.version}"` });
  });
}

/** Reads out every staged question but one, on the unpatched API, so the next "weiter" empties the stage. */
async function leaveOneOnStage(page: Page): Promise<void> {
  await installHarness(page);
  await page.evaluate(async () => {
    const w = window as unknown as Harness;
    for (;;) {
      const stage = (await w.__original['getStage']!()) as {
        current: { id: string; version: number } | null;
        queue: unknown[];
      };
      if (stage.current === null) throw new Error('nothing on stage');
      if (stage.queue.length === 0) return;
      await w.__original['deliverQuestion']!(stage.current.id, {
        ifMatch: `"v${stage.current.version}"`,
      });
    }
  });
}

/** Switches the demo actor without the header — the call the role switcher makes. */
async function switchActor(page: Page, role: string): Promise<void> {
  await page.evaluate(
    async ([url, wanted]) => {
      const mod = ((window as unknown as Harness).__modules[url!]) as {
        DEMO_ACTORS: readonly { role: string }[];
        setActor: (actor: unknown) => void;
      };
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
    },
    [ACTOR_MODULE, role],
  );
}

/** Opens the stage in the ordinary layout (the stored "Nur Bühne" choice always wins, 020). */
async function openStage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-current-number')).toBeVisible();
}

// ---------------------------------------------------------------------------------------------
// Ziele 1–3: refused role → role that may read, the new role's first read fails with a 500.
// ---------------------------------------------------------------------------------------------

test('010c Ziel 1: Beantwortung — podium → expert, erste Liste mit 500: kein "keine Leseberechtigung", ein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await expect(page.getByTestId('answers-forbidden')).toBeVisible();

  await failOnce(page, 'listQuestions', { limit: 2000 });
  await asRole(page, 'expert');

  await expectOneToast(page);
  await expect(page.getByTestId('answers-forbidden')).toHaveCount(0);
  // Review round 1, finding 8 (Regel 2): the evidence — toast visible, no refusal.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: evidence('010c-beantwortung-erster-abruf-500.png') });
  await checkAxe(page, 'answers (010c, failed first read after a refused role)');
});

test('010c Ziel 2: Historie, Zeitleiste — observer → admin, erster Verlauf mit 500: kein "keine Leseberechtigung", ein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'observer');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  const results = page.getByTestId('history-result');
  await expect(results.first()).toBeVisible();
  await results.first().click();
  await expect(page.getByTestId('history-timeline-forbidden')).toBeVisible();

  await failOnce(page, 'getQuestionHistory');
  await asRole(page, 'admin');

  await expectOneToast(page);
  await expect(page.getByTestId('history-timeline-forbidden')).toHaveCount(0);
  await checkAxe(page, 'history timeline (010c, failed first read after a refused role)');
});

test('010c Ziel 2: Historie, Ereignisstrom — observer → admin, erster Abruf mit 500: kein "keine Leseberechtigung", ein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'observer');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await page.getByTestId('history-tab-stream').click();
  await expect(page.getByTestId('history-stream-forbidden')).toBeVisible();

  await failOnce(page, 'listEvents');
  await asRole(page, 'admin');

  await expectOneToast(page);
  await expect(page.getByTestId('history-stream-forbidden')).toHaveCount(0);
});

test('010c Ziel 2 (dieselbe Klasse): Historie, Hauptabfrage — podium → admin, beide Listen mit 500: kein "keine Leseberechtigung"', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'podium');
  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('history-forbidden')).toBeVisible();

  // Both reads of the Hauptabfrage fail once: the corpus (limit 2000) and the result list (limit
  // 200). Two failed reads are two toasts — one each, never a refusal.
  await installHarness(page);
  await page.evaluate(async (url) => {
    const { api } = ((window as unknown as Harness).__modules[url]) as { api: Wrapped };
    const w = window as unknown as Harness;
    const original = w.__original['listQuestions']!;
    const failed = new Set<unknown>();
    api['listQuestions'] = (...args: unknown[]) => {
      const limit = (args[0] as { limit?: number } | undefined)?.limit;
      if ((limit === 2000 || limit === 200) && !failed.has(limit)) {
        failed.add(limit);
        return Promise.reject({ status: 500, title: 'Testfehler', detail: '010c, absichtlich' });
      }
      return original(...args);
    };
  }, API_MODULE);
  await asRole(page, 'admin');

  await expect(toasts(page)).toHaveCount(2);
  await settle(page);
  await expect(page.getByTestId('history-forbidden')).toHaveCount(0);
});

test('010c Ziel 3: Erfassung — observer → moderation, erster Abruf mit 500: kein ungefilterter Abruf, ein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'observer');
  await page.getByTestId('nav-capture').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByTestId('capture-forbidden')).toBeVisible();

  // Every `listContributions` is counted; the first one after the switch fails with a 500.
  await failOnce(page, 'listContributions');
  await asRole(page, 'moderation');

  await expectOneToast(page);
  await expect(page.getByTestId('capture-forbidden')).toHaveCount(0);
  const calls = await page.evaluate(() => (window as unknown as Harness).__calls['listContributions']!);
  // moderation can read the Wortmeldungen, so the desk resolves one: the unfiltered probe ("may this
  // role read Erfassung at all?") must not run on the previous key's refused lookup.
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.filter((call) => call === null)).toEqual([]);
  await checkAxe(page, 'capture (010c, failed first read after a refused role)');
});

// ---------------------------------------------------------------------------------------------
// Ziel 4: Wortmeldeliste and Bühne.
// ---------------------------------------------------------------------------------------------

test('010c Ziel 4: Wortmeldeliste — eine Verweigerung, die noch für die vorige Rolle unterwegs ist, wird nicht übernommen', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'moderation');
  await page.getByTestId('nav-speakers').click();
  await expect(page).toHaveURL(/\/speakers$/);
  await expect(page.getByTestId('speaker-register')).toBeVisible();

  await holdCalls(page, 'listSpeakers', true);
  // podium's own `listSpeakers` (a refusal) is now on its way, held ...
  await switchActor(page, 'podium');
  await expect.poll(() => callCount(page, 'listSpeakers')).toBeGreaterThan(0);

  // ... and arrives in the very task in which the actor becomes moderation again — in the gap
  // before the `version` bump that would cancel its load. A MutationObserver records whether the
  // refusal shows at any moment after.
  await page.evaluate(async (url) => {
    const mod = ((window as unknown as Harness).__modules[url]) as {
      DEMO_ACTORS: readonly { role: string }[];
      setActor: (actor: unknown) => void;
    };
    const w = window as unknown as Harness & { __sawForbidden: boolean };
    w.__sawForbidden = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="speakers-forbidden"]') !== null) w.__sawForbidden = true;
    }).observe(document, { childList: true, subtree: true });
    for (const call of w.__held['listSpeakers']!.splice(0)) void call.answer!.then(call.resolve, call.reject);
    mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === 'moderation'));
  }, ACTOR_MODULE);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __sawForbidden: boolean }).__sawForbidden)).toBe(false);

  // moderation's own answer is released last.
  await releaseAll(page, 'listSpeakers');
  await expect(page.getByTestId('speaker-register')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __sawForbidden: boolean }).__sawForbidden)).toBe(false);
  await expect(toasts(page)).toHaveCount(0);
});

test('010c Ziel 4: Bühne — expert → admin, erster Abruf mit 500: kein "keine Leseberechtigung", ein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'expert');
  await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
  await page.getByTestId('nav-stage').click();
  await expect(page).toHaveURL(/\/stage$/);
  await expect(page.getByTestId('stage-forbidden')).toBeVisible();

  await failOnce(page, 'getStage');
  await asRole(page, 'admin');

  await expectOneToast(page);
  await expect(page.getByTestId('stage-forbidden')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Review round 1, finding 4: a refusal belongs to the actor. The same role, only a new `version`,
// and that load fails with a plain 500: the refusal stands, and the failure still shows a toast.
// ---------------------------------------------------------------------------------------------

interface SameRole {
  name: string;
  role: string;
  nav: string;
  forbidden: string;
  /** The reads that fail once, as `[method, match]`; the toast count is one per failed read. */
  fail: readonly [string, Record<string, unknown> | undefined][];
  before?: (page: Page) => Promise<void>;
}

const SAME_ROLE: readonly SameRole[] = [
  {
    name: 'Beantwortung',
    role: 'podium',
    nav: 'nav-answers',
    forbidden: 'answers-forbidden',
    fail: [['listQuestions', { limit: 2000 }]],
  },
  {
    name: 'Historie',
    role: 'podium',
    nav: 'nav-history',
    forbidden: 'history-forbidden',
    fail: [
      ['listQuestions', { limit: 2000 }],
      ['listQuestions', { limit: 200 }],
    ],
  },
  {
    name: 'Wortmeldeliste',
    role: 'podium',
    nav: 'nav-speakers',
    forbidden: 'speakers-forbidden',
    fail: [['listSpeakers', undefined]],
  },
  {
    name: 'Erfassung',
    role: 'podium',
    nav: 'nav-capture',
    forbidden: 'capture-forbidden',
    fail: [['listContributions', undefined]],
  },
  {
    name: 'Bühne',
    role: 'expert',
    nav: 'nav-stage',
    forbidden: 'stage-forbidden',
    fail: [['getStage', undefined]],
    before: async (page) => {
      await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
    },
  },
];

for (const view of SAME_ROLE) {
  test(`010c Befund 4: ${view.name} — dieselbe Rolle, auf eine Verweigerung folgt ein 500: die Verweigerung bleibt, ein Toast`, async ({
    page,
  }) => {
    await page.goto('/');
    await waitForCorpus(page);
    await asRole(page, view.role);
    await view.before?.(page);
    await page.getByTestId(view.nav).click();
    await expect(page.getByTestId(view.forbidden)).toBeVisible();

    // Each named read fails once; several reads of one method are counted apart by their match.
    await installHarness(page);
    await page.evaluate(
      async ([url, fails]) => {
        const { api } = ((window as unknown as Harness).__modules[url as string]) as { api: Wrapped };
        const w = window as unknown as Harness;
        const pending = [...(fails as [string, Record<string, unknown> | null][])];
        for (const name of new Set(pending.map(([method]) => method))) {
          const original = w.__original[name]!;
          api[name] = (...args: unknown[]) => {
            const first = args[0] as Record<string, unknown> | undefined;
            const at = pending.findIndex(
              ([method, wanted]) =>
                method === name &&
                (wanted === null ||
                  (typeof first === 'object' &&
                    first !== null &&
                    Object.entries(wanted).every(([k, v]) => first[k] === v))),
            );
            if (at >= 0) {
              pending.splice(at, 1);
              return Promise.reject({ status: 500, title: 'Testfehler', detail: '010c, absichtlich' });
            }
            return original(...args);
          };
        }
      },
      [API_MODULE, view.fail.map(([method, match]) => [method, match ?? null])] as const,
    );
    await unrelatedEvent(page, `Testperson 010c ${view.name}`);

    await expect(toasts(page)).toHaveCount(view.fail.length);
    await page.waitForTimeout(300);
    await settle(page);
    await expect(toasts(page)).toHaveCount(view.fail.length);
    await expect(page.getByTestId(view.forbidden)).toBeVisible();
  });
}

// ---------------------------------------------------------------------------------------------
// Ziel 5: Beantwortung with a server-side filter and a role switch.
// ---------------------------------------------------------------------------------------------

test('010c Ziel 5: Beantwortung — Suche aktiv, Wechsel zu observer bei offener, nicht vorgelesener Frage: kein Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-assigned').click();
  const row = page.locator('[data-testid="answers-row"][data-status="assigned"]').first();
  const number = (await row.getAttribute('data-number'))!;
  await row.click();
  const detail = page.getByTestId('answers-detail');
  await expect(detail).toBeVisible();

  // A server-side filter: the list no longer says what it leaves out (010b, Codex P2-A).
  await page.getByTestId('answers-search').fill(number);
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toBeVisible();

  // observer's filtered list leaves the question out; its `getQuestion`/`getQuestionHistory`
  // answer with the masked 404.
  // Slice 090: the switch empties the search, so observer types it again (`searchAgainAfterSwitch`).
  await asRole(page, 'observer');
  await searchAgainAfterSwitch(page, number);
  await typeSearchAndExpectDetailRead(page, number);
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toHaveCount(0);
  await expect(detail).toHaveCount(0);
  await page.waitForTimeout(300);
  await settle(page);
  await expect(toasts(page)).toHaveCount(0);
  await expect(page.getByTestId('answers-forbidden')).toHaveCount(0);
});

/** Ziel 5's setup: admin opens an undelivered question, then a search that still shows it. */
async function openAssignedAndSearch(page: Page): Promise<string> {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-assigned').click();
  const row = page.locator('[data-testid="answers-row"][data-status="assigned"]').first();
  const number = (await row.getAttribute('data-number'))!;
  await row.click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
  await page.getByTestId('answers-search').fill(number);
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toBeVisible();
  // Let the debounced search settle before anything else happens.
  await page.waitForTimeout(400);
  await settle(page);
  return number;
}

/**
 * Slice 090: an actor change empties the search of the Beantwortung. Before observer types it
 * again, the switch's own loads have to be over — observer's complete list hides the selection and
 * its detail reads are settled — so that nothing armed afterwards is taken by them.
 */
async function searchAgainAfterSwitch(page: Page, number: string): Promise<void> {
  await expect(page.getByTestId('answers-search')).toHaveValue('');
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toHaveCount(0);
  await expect(page.getByTestId('answers-detail')).toHaveCount(0);
  await page.waitForTimeout(400);
  await settle(page);
  await expect(toasts(page)).toHaveCount(0);
}

/**
 * Slice 090 (review R1, finding 3): observer types the search again, and the test proves the filter
 * is back in force before it checks anything. Without it observer's list is complete and hides the
 * selection: no detail read runs, so "kein Toast" would hold without testing the masked 404 at
 * all. With it the list is incomplete again, and the detail reads (answered with the masked 404)
 * run — counted here: none while the search is empty, at least one once it is typed.
 */
async function typeSearchAndExpectDetailRead(page: Page, number: string): Promise<void> {
  await installHarness(page);
  await page.evaluate(
    ([url, name]) => {
      const { api } = ((window as unknown as Harness).__modules[url as string]) as { api: Wrapped };
      const w = window as unknown as Harness;
      const original = w.__original[name as string]!;
      w.__calls[name as string] = [];
      api[name as string] = (...args: unknown[]) => {
        w.__calls[name as string]!.push(args[0] ?? null);
        return original(...args);
      };
    },
    [API_MODULE, 'getQuestion'] as const,
  );
  await page.waitForTimeout(400);
  await settle(page);
  expect(await callCount(page, 'getQuestion')).toBe(0);
  await page.getByTestId('answers-search').fill(number);
  await expect.poll(() => callCount(page, 'getQuestion')).toBeGreaterThan(0);
  await restoreCounted(page, 'getQuestion');
}

async function restoreCounted(page: Page, method: string): Promise<void> {
  await page.evaluate(
    ([url, name]) => {
      const { api } = ((window as unknown as Harness).__modules[url as string]) as { api: Wrapped };
      api[name as string] = (window as unknown as Harness).__original[name as string]!;
    },
    [API_MODULE, method] as const,
  );
}

test('010c Runde 2 (N1): Beantwortung — Suche aktiv, Wechsel zu observer, danach zwei fremde Ereignisse: kein Toast', async ({
  page,
}) => {
  const number = await openAssignedAndSearch(page);
  // Slice 090: the switch empties the search, so observer types it again.
  await asRole(page, 'observer');
  await searchAgainAfterSwitch(page, number);
  await typeSearchAndExpectDetailRead(page, number);
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toHaveCount(0);
  await expect(page.getByTestId('answers-detail')).toHaveCount(0);

  // The masked 404 of a selection observer cannot read is no fault — not now, not on later events.
  for (const name of ['Testperson 010c N1 a', 'Testperson 010c N1 b']) {
    await unrelatedEvent(page, name);
    await page.waitForTimeout(300);
    await settle(page);
    await expect(toasts(page)).toHaveCount(0);
  }
});

test('010c Runde 2: Beantwortung — Suche aktiv, Wechsel zu observer, erste Detailabfrage mit 500: ein Toast', async ({
  page,
}) => {
  const number = await openAssignedAndSearch(page);
  // A real fault in the first detail read of observer's filtered list is shown, even though the
  // selection was made by another actor and the filtered list leaves it out; only the masked 404
  // is swallowed. Slice 090: the switch empties the search (typed text belongs to its actor), so
  // this is no longer the very first load after the switch — observer types the search again, and
  // the fault is armed for the first detail read of that filtered list.
  await asRole(page, 'observer');
  await searchAgainAfterSwitch(page, number);
  await failOnce(page, 'getQuestion');
  await page.getByTestId('answers-search').fill(number);
  await expectOneToast(page);
});

/**
 * Review round 3, R3-1: the gate used to keep only the first failure of a pass. With the list
 * answering last (600 ms late), the masked 404 of one detail read arriving first hid the 500 of the
 * other one arriving after it (150 ms late) — no toast at all. Both orders are covered.
 */
for (const [late, masked] of [
  ['getQuestion', 'getQuestionHistory'],
  ['getQuestionHistory', 'getQuestion'],
] as const) {
  test(`010c Runde 3 (R3-1): Beantwortung — Liste zuletzt, ${late} 500 nach dem 404 von ${masked}, Wechsel zu observer: ein Toast`, async ({
    page,
  }) => {
    const number = await openAssignedAndSearch(page);
    // Slice 090: the switch empties the search, so observer types it again; the delays are armed
    // for the loads of that filtered list, the first after the switch that shows the selection.
    await asRole(page, 'observer');
    await searchAgainAfterSwitch(page, number);
    await delayCalls(page, 'listQuestions', 600);
    await failOnce(page, late, undefined, 150);
    await page.getByTestId('answers-search').fill(number);
    await page.waitForTimeout(800);
    await expectOneToast(page);
    // Slice 010d, Ziel 4 (nit of round 4): the one toast is the 500, not the masked 404.
    await expect(toasts(page)).toContainText('Testfehler');
  });
}

test('010c Ziel 5 (Gegenprobe): Beantwortung — Suche ohne die offene Frage, dieselbe Rolle, Detail mit 500: der Toast bleibt', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  const rows = page.getByTestId('answers-row');
  const number = (await rows.nth(0).getAttribute('data-number'))!;
  const other = (await rows.nth(1).getAttribute('data-number'))!;
  await rows.nth(0).click();
  await expect(page.getByTestId('answers-detail-number')).toHaveText(number);

  // A search that leaves the open question out, with no role switch: a filtered list proves nothing
  // about a missing row, so a real fault of the detail read (on the next reload) still shows.
  await page.getByTestId('answers-search').fill(other);
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toHaveCount(0);
  await failOnce(page, 'getQuestion');
  await unrelatedEvent(page, 'Testperson 010c Gegenprobe');
  await expectOneToast(page);
});

test('010c Befund 1: Beantwortung — nach dem Wechsel liest die neue Rolle die Auswahl, dann Suche ohne sie: ein 500 zeigt einen Toast', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  const rows = page.getByTestId('answers-row');
  const number = (await rows.nth(0).getAttribute('data-number'))!;
  const other = (await rows.nth(1).getAttribute('data-number'))!;
  await rows.nth(0).click();
  const detailNumber = page.getByTestId('answers-detail-number');
  await expect(detailNumber).toHaveText(number);

  // moderation may read the selection: after its first list answer the selection is its own.
  await asRole(page, 'moderation');
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toBeVisible();
  await expect(detailNumber).toHaveText(number);
  await settle(page);

  // A search that leaves the selection out, then a real fault of its detail read on the next load.
  await page.getByTestId('answers-search').fill(other);
  await expect(page.locator(`[data-testid="answers-row"][data-number="${number}"]`)).toHaveCount(0);
  await failOnce(page, 'getQuestion');
  await unrelatedEvent(page, 'Testperson 010c Befund 1');
  await expectOneToast(page);
});

/**
 * Review round 1, finding 3: the detail reads of the Beantwortung. The previous actor's answer is
 * held and handed over in the very task in which the actor switches back — in the gap before the
 * `version` bump. A MutationObserver records whether it reached the screen.
 */
async function releaseInGap(page: Page, method: string, role: string, testId: string, watch: 'removed' | 'added'): Promise<void> {
  await page.evaluate(
    async ([url, name, wanted, id, mode]) => {
      const mod = ((window as unknown as Harness).__modules[url!]) as {
        DEMO_ACTORS: readonly { role: string }[];
        setActor: (actor: unknown) => void;
      };
      const w = window as unknown as Harness & { __saw: boolean };
      w.__saw = false;
      const selector = `[data-testid="${id}"]`;
      new MutationObserver((records) => {
        if (mode === 'added') {
          if (document.querySelector(selector) !== null) w.__saw = true;
          return;
        }
        for (const record of records) {
          for (const node of record.removedNodes) {
            if (node instanceof Element && (node.matches(selector) || node.querySelector(selector) !== null)) {
              w.__saw = true;
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
      for (const call of w.__held[name!]!.splice(0)) void call.answer!.then(call.resolve, call.reject);
      mod.setActor(mod.DEMO_ACTORS.find((actor) => actor.role === wanted));
    },
    [ACTOR_MODULE, method, role, testId, watch],
  );
  await page.waitForTimeout(300);
}

const sawIt = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __saw: boolean }).__saw);

test('010c Befund 3: Beantwortung — eine Einzelfrage, die noch für die vorige Rolle unterwegs ist, wird nicht übernommen', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'legal');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-in_review').click();
  await page.getByTestId('answers-row').first().click();
  const approve = page.getByTestId('answer-approve');
  await expect(approve).toBeVisible();

  // expert's own `getQuestion` (no "Freigeben" among its `_actions`) is held ...
  await holdCalls(page, 'getQuestion', true);
  await switchActor(page, 'expert');
  await expect.poll(() => callCount(page, 'getQuestion')).toBeGreaterThan(0);
  // ... and handed over as the actor becomes legal again.
  await releaseInGap(page, 'getQuestion', 'legal', 'answer-approve', 'removed');
  expect(await sawIt(page)).toBe(false);

  await releaseAll(page, 'getQuestion');
  await expect(approve).toBeVisible();
  expect(await sawIt(page)).toBe(false);
  await expect(toasts(page)).toHaveCount(0);
});

test('010c Befund 3: Beantwortung — eine Verlaufsverweigerung der vorigen Rolle wird nicht übernommen', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  // "vorgelesen": observer may read the question, but not its history.
  await page.getByTestId('answers-filter-status-delivered').click();
  await page.getByTestId('answers-row').first().click();
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await expect(page.getByTestId('answers-history-forbidden')).toHaveCount(0);

  // observer's own `getQuestionHistory` (a refusal) is held ...
  await holdCalls(page, 'getQuestionHistory', true);
  await switchActor(page, 'observer');
  await expect.poll(() => callCount(page, 'getQuestionHistory')).toBeGreaterThan(0);
  // ... and handed over as the actor becomes admin again.
  await releaseInGap(page, 'getQuestionHistory', 'admin', 'answers-history-forbidden', 'added');
  expect(await sawIt(page)).toBe(false);

  await releaseAll(page, 'getQuestionHistory');
  await expect(page.getByTestId('answers-detail')).toBeVisible();
  await settle(page);
  expect(await sawIt(page)).toBe(false);
  await expect(page.getByTestId('answers-history-forbidden')).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Ziel 6: takt-008's N1–N3, the same class for write locks and focus markers.
// ---------------------------------------------------------------------------------------------

test('010c Ziel 6 (N1): Beantwortung — nach einem 412 auf "Freigeben" fällt der Fokus nicht auf BODY', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'legal');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-in_review').click();
  await page.getByTestId('answers-row').first().click();
  await expect(page.getByTestId('answer-approve')).toBeVisible();

  // Somebody else approves first: the write reaches the record, and this page is told 412.
  await installHarness(page);
  await page.evaluate(async (url) => {
    const { api } = ((window as unknown as Harness).__modules[url]) as { api: Wrapped };
    const w = window as unknown as Harness;
    api['approveQuestion'] = async (...args: unknown[]) => {
      await w.__original['approveQuestion']!(...args);
      api['approveQuestion'] = w.__original['approveQuestion']!;
      throw { status: 412, title: 'Testfehler', detail: '010c, absichtlich' };
    };
  }, API_MODULE);

  // The page reads the question back 300 ms late: the refusal is on screen before the record is.
  await delayCalls(page, 'getQuestion', 300);
  await tabTo(page, 'answer-approve', 30);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('stale-banner')).toBeVisible();
  await expect(page.getByTestId('approval-block')).toContainText('Freigegeben');
  await expect(page.getByTestId('answer-approve')).toHaveCount(0);
  await settle(page);
  expect(await focusedTestId(page)).toBe('approval-block');
});

test('010c Ziel 6 (N1): Bühne — nach einem 412 auf "Vorgelesen, weiter" fällt der Fokus nicht auf BODY', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await leaveOneOnStage(page);
  await openStage(page);

  // Somebody else reads the last question out first: the write reaches the record, this page gets 412.
  await page.evaluate(async (url) => {
    const { api } = ((window as unknown as Harness).__modules[url]) as { api: Wrapped };
    const w = window as unknown as Harness;
    api['deliverQuestion'] = async (...args: unknown[]) => {
      await w.__original['deliverQuestion']!(...args);
      api['deliverQuestion'] = w.__original['deliverQuestion']!;
      throw { status: 412, title: 'Testfehler', detail: '010c, absichtlich' };
    };
  }, API_MODULE);

  // The stage reads back 300 ms late: the refusal is on screen before the record is.
  await delayCalls(page, 'getStage', 300);
  await tabTo(page, 'stage-next', 30);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('stage-next')).toHaveCount(0);
  await expect(page.getByTestId('stage-current-number')).toHaveCount(0);
  await settle(page);
  expect(await focusedTestId(page)).toBe('stage-current');
});

test('010c Ziel 6 (N2): Beantwortung — der Fehler eines älteren Schreibens gibt die Sperre eines neueren nicht frei', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'legal');
  await page.getByTestId('nav-answers').click();
  await expect(page).toHaveURL(/\/answers$/);
  await page.getByTestId('answers-filter-status-in_review').click();
  const rows = page.getByTestId('answers-row');
  const approve = page.getByTestId('answer-approve');
  const detailNumber = page.getByTestId('answers-detail-number');

  await holdCalls(page, 'approveQuestion', false);
  // A: "Freigeben" on the first question — held.
  await rows.nth(0).click();
  await expect(detailNumber).toHaveText((await rows.nth(0).getAttribute('data-number'))!);
  await approve.click();
  await expect(approve).toHaveAttribute('aria-disabled', 'true');

  // Another question: its own lock, free — then B: "Freigeben" on it, held as well.
  const second = (await rows.nth(1).getAttribute('data-number'))!;
  await rows.nth(1).click();
  await expect(detailNumber).toHaveText(second);
  await expect(approve).toHaveAttribute('aria-disabled', 'false');
  await approve.click();
  await expect(approve).toHaveAttribute('aria-disabled', 'true');
  expect(await callCount(page, 'approveQuestion')).toBe(2);

  // A fails. B is still on its way, so its lock must hold.
  await refuseHeld(page, 'approveQuestion', 0, 500);
  await expectOneToast(page);
  await expect(approve).toHaveAttribute('aria-disabled', 'true');

  await runHeld(page, 'approveQuestion', 1);
  await expect(page.getByTestId('approval-block')).toContainText('Freigegeben');
});

test('010c Ziel 6 (N2): Bühne — der Fehler eines älteren "Vorgelesen" gibt die Sperre eines neueren nicht frei', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await openStage(page);
  const next = page.getByTestId('stage-next');
  const currentNumber = page.getByTestId('stage-current-number');

  await holdCalls(page, 'deliverQuestion', false);
  // A: "Vorgelesen, weiter" on X — held.
  const first = await currentNumber.innerText();
  await next.click();
  await expect(next).toHaveAttribute('aria-disabled', 'true');

  // Somebody else reads X out; the stage moves on to Y and the lock on X is over.
  await deliverCurrentElsewhere(page);
  await expect(currentNumber).not.toHaveText(first);
  await expect(next).toHaveAttribute('aria-disabled', 'false');

  // B: "Vorgelesen, weiter" on Y — held. Then A is refused with 412.
  await next.click();
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await refuseHeld(page, 'deliverQuestion', 0, 412);
  await expectOneToast(page);
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  expect(await callCount(page, 'deliverQuestion')).toBe(2);
});

test('010c Ziel 6 (N2): Bühne — ein gescheitertes Nachlesen gibt die Sperre eines laufenden "Vorgelesen" nicht frei', async ({
  page,
}) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await openStage(page);
  const next = page.getByTestId('stage-next');

  await holdCalls(page, 'deliverQuestion', false);
  await next.click();
  await expect(next).toHaveAttribute('aria-disabled', 'true');

  // While the write is on its way, somebody else's event makes the stage read again — and that read fails.
  await failOnce(page, 'getStage');
  await unrelatedEvent(page, 'Testperson 010c Nachlesen');
  await expectOneToast(page);
  await expect(next).toHaveAttribute('aria-disabled', 'true');

  await runHeld(page, 'deliverQuestion', 0);
  await expect(next).toHaveAttribute('aria-disabled', 'false');
});

test('010c Ziel 6 (N3): Bühne — ein Druck ohne Schreiben lenkt den Fokus später nicht um', async ({ page }) => {
  await page.goto('/');
  await waitForCorpus(page);
  await asRole(page, 'admin');
  await leaveOneOnStage(page);
  await openStage(page);
  await tabTo(page, 'stage-next', 30);

  // Every `getStage` is answered by the API at once but handed over only on release; every
  // `deliverQuestion` of the page is counted.
  await holdCalls(page, 'getStage', true);
  await page.evaluate(async (url) => {
    const { api } = ((window as unknown as Harness).__modules[url]) as { api: Wrapped };
    const w = window as unknown as Harness;
    w.__calls['deliverQuestion'] = [];
    api['deliverQuestion'] = (...args: unknown[]) => {
      w.__calls['deliverQuestion']!.push(args[0] ?? null);
      return w.__original['deliverQuestion']!(...args);
    };
  }, API_MODULE);

  // An event from somebody else: the stage reads again (held), and until that answer is in there is
  // no record to act on — "Vorgelesen, weiter" writes nothing.
  await unrelatedEvent(page, 'Testperson 010c N3');
  await expect.poll(() => callCount(page, 'getStage')).toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await callCount(page, 'deliverQuestion')).toBe(0);

  // Somebody else reads the last question out; the button leaves with it. That press wrote nothing,
  // so it does not own this focus move.
  await deliverCurrentElsewhere(page);
  await expect.poll(() => callCount(page, 'getStage')).toBeGreaterThan(1);
  await releaseAll(page, 'getStage');
  await expect(page.getByTestId('stage-next')).toHaveCount(0);
  await settle(page);
  expect(await focusedTestId(page)).not.toBe('stage-current');
  expect(await callCount(page, 'deliverQuestion')).toBe(0);
});
