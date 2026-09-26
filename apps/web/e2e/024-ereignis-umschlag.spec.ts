import { expect, test } from '@playwright/test';

const evidence = (name: string): string =>
  `${test.info().project.testDir}/../../../docs/evidence/${name}`;

test('024: old demo log requires an explicit reset in German and English', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('024-legacy-fixture')) {
      localStorage.setItem('hv-demo-events-v1', JSON.stringify([{
        seq: 1, id: 'legacy-1', type: 'MeetingCreated', at: '2026-09-23T12:00:00.000Z',
        actor: { id: 'test-actor', role: 'admin' }, subjectId: 'legacy-meeting', payload: {},
      }]));
      sessionStorage.setItem('024-legacy-fixture', '1');
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Altes Demoprotokoll' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hv-demo-events-v1'))).not.toBeNull();
  await page.screenshot({ path: evidence('024-reset-de.png') });

  await page.evaluate(() => localStorage.setItem('hv-lang-v1', 'en'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Old demo log' })).toBeVisible();
  await page.screenshot({ path: evidence('024-reset-en.png') });
  await page.getByRole('button', { name: 'Reset and rebuild demo' }).click();
  await expect(page.getByTestId('header-counter-questions')).toBeVisible({ timeout: 90_000 });
  await expect.poll(async () => page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('hv-demo-events-v1') ?? '[]') as { schemaVersion?: number }[];
    return log.length > 0 && log.every((event) => event.schemaVersion === 2);
  })).toBe(true);
});

test('024: corrupt v2 log does not silently reseed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hv-demo-events-v1', JSON.stringify([{ seq: 1, schemaVersion: 2, hash: 'bad' }]));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Das Werkzeug konnte nicht starten' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hv-demo-events-v1'))).not.toBeNull();
});

for (const [name, schemaVersion] of [['missing', null], ['changed', 3]] as const) {
  test(`024: ${name} v2 schemaVersion is an integrity failure, not a reset offer`, async ({ page }) => {
    await page.addInitScript((version) => {
      const at = '2026-09-23T12:00:00.000Z';
      localStorage.setItem('hv-demo-events-v1', JSON.stringify([{
        seq: 1, id: 'event-1', type: 'MeetingCreated', at,
        actor: { id: 'test-actor', role: 'admin' }, subjectId: 'meeting-1', payload: {},
        ...(version !== null ? { schemaVersion: version } : {}),
        prevHash: '', hash: '0'.repeat(64), recordedAt: at, occurredAt: at,
        occurredAtSource: 'server', retentionClass: 'working', legalHold: false,
      }]));
    }, schemaVersion);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Das Werkzeug konnte nicht starten' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zurücksetzen und Demo neu aufbauen' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('hv-demo-events-v1'))).not.toBeNull();
  });
}
