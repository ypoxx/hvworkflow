import { expect, test } from '@playwright/test';
import type { HvApi, Speaker } from '@hv/domain';

test('Erfassung zeigt 412 sichtbar und behält eine nicht bestätigte Einzelfrage', async ({ page }) => {
  const evidence = `${test.info().project.testDir}/../../../docs/evidence/028-capture-stale.png`;
  await page.goto('/');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-capture').click();
  await page.getByTestId('nav-capture').click();
  const free = page.getByTestId('capture-free-input');
  if (await page.getByTestId('capture-text').isVisible()) {
    await page.getByTestId('capture-text').fill('Erster Wortlaut für den Konflikttest.');
    await page.getByTestId('capture-submit').click();
  }
  await expect(free).toBeVisible();

  await page.evaluate(async () => {
    const url = '/src/api/index.ts';
    const { api } = (await import(/* @vite-ignore */ url)) as { api: HvApi };
    const original = api.captureQuestions.bind(api);
    let first = true;
    api.captureQuestions = async (...args) => {
      if (first) {
        first = false;
        throw { status: 412, title: 'Precondition failed', detail: 'Another writer changed this contribution.' };
      }
      return original(...args);
    };
  });

  const draft = 'Nicht bestätigte Frage nach gleichzeitigem Schreiben?';
  await free.fill(draft);
  await free.press('Enter');
  await expect(page.getByTestId('capture-stale-banner')).toBeVisible();
  await expect(free).toHaveValue(draft);
  await expect(page.getByTestId('capture-stale-banner')).toContainText('Laden Sie Redebeitrag und Einzelfragen neu');
  await page.screenshot({ path: evidence });
  await page.getByTestId('capture-stale-banner').getByRole('button').click();
  await expect(free).toHaveValue(draft);
  await expect(page.getByTestId('capture-stale-banner')).toHaveCount(0);
  await expect(free).toBeFocused();
});

test('Wortmeldung sendet die angezeigte Listen-Version bei Registrierung', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await page.getByTestId('role-switcher').click();
  await page.getByTestId('role-option-moderation').click();
  await page.getByTestId('nav-speakers').click();
  await expect(page.getByTestId('speaker-register')).toBeVisible();

  const expected = await page.evaluate(async () => {
    const url = '/src/api/index.ts';
    const { api } = (await import(/* @vite-ignore */ url)) as { api: HvApi };
    const meeting = await api.getMeeting();
    const original = api.registerSpeaker.bind(api);
    (window as typeof window & { registrationIfMatch: string | undefined }).registrationIfMatch = undefined;
    api.registerSpeaker = async (input, opts) => {
      (window as typeof window & { registrationIfMatch: string | undefined }).registrationIfMatch = opts?.ifMatch;
      return original(input, opts);
    };
    return `"v${meeting.speakerListVersion}"`;
  });

  await page.getByTestId('speaker-register').click();
  await page.getByTestId('speaker-register-name').fill('Konflikt Testperson');
  await page.getByTestId('speaker-register-submit').click();
  await expect(page.getByText('Konflikt Testperson')).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { registrationIfMatch?: string }).registrationIfMatch)).toBe(expected);
});

test('Wortmeldeliste wiederholt einen Lesevorgang bei versetzter Listen-Version', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/features/speakers/useSpeakers.ts';
    const module = (await import(/* @vite-ignore */ moduleUrl)) as {
      readStableSpeakerList?: (client: HvApi) => Promise<{ speakers: readonly Speaker[]; version: number }>;
    };
    const before = [{ id: 'a', position: 1 }, { id: 'b', position: 2 }] as unknown as Speaker[];
    const after = [{ id: 'b', position: 1 }, { id: 'a', position: 2 }] as unknown as Speaker[];
    let meetingReads = 0;
    let listReads = 0;
    const client = {
      getMeeting: async () => ({ speakerListVersion: ++meetingReads === 1 ? 1 : 2 }),
      listSpeakers: async () => (++listReads === 1 ? before : after),
    } as HvApi;
    const snapshot = await module.readStableSpeakerList!(client);
    return { ids: snapshot.speakers.map((speaker) => speaker.id), version: snapshot.version, listReads };
  });
  expect(result).toEqual({ ids: ['b', 'a'], version: 2, listReads: 2 });
});

test('Verschieben berechnet die Zielreihenfolge nach einem fremden Sortieren neu', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const moduleUrl = '/src/features/speakers/useSpeakers.ts';
    const module = (await import(/* @vite-ignore */ moduleUrl)) as {
      moveSpeakerToRound?: (client: HvApi, speaker: Speaker, round: number) => Promise<void>;
    };
    const moved = { id: 'a', round: 1, position: 1, version: 1,
      _actions: ['speaker.reorder'] } as unknown as Speaker;
    let list = [{ id: 'b', round: 2, position: 1 }, { id: 'c', round: 2, position: 2 }] as unknown as Speaker[];
    let version = 1;
    let submitted: { ids: string[]; ifMatch?: string } | null = null;
    const client = {
      updateSpeaker: async () => {
        version = 2;
        // A second operator changes the target round before this move composes its order.
        list = [{ id: 'c', round: 2, position: 1 }, { id: 'b', round: 2, position: 2 },
          { ...moved, round: 2, position: 3 }] as unknown as Speaker[];
        return moved;
      },
      getMeeting: async () => ({ speakerListVersion: version }),
      listSpeakers: async () => list,
      reorderSpeakers: async (_round: number, ids: string[], opts?: { ifMatch?: string }) => {
        submitted = { ids, ifMatch: opts?.ifMatch ?? '' };
        return list;
      },
    } as unknown as HvApi;
    await module.moveSpeakerToRound!(client, moved, 2);
    return submitted;
  });
  expect(result).toEqual({ ids: ['c', 'b', 'a'], ifMatch: '"v2"' });
});
