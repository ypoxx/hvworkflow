/**
 * Scheibe 055b — Antwortformat: Renderer und Editor (docs/slices/055b-antwortformat-editor.md).
 *
 * The answer field with the house format (bold, italic, highlight, bulleted list) in the writing mode and in the
 * Beantwortung; paste and drop from Word and browsers without an HTML sink and without any fetch (A2b, Codex P1 on
 * #156); the one renderer on the podium, in the focus view and in the history. The roles are only switched here; every
 * button the tests press is one `_actions` offers (AGENTS.md R4).
 *
 * `in-process` (A1–A6, A2b): every test starts with a fresh demo state (own browser context), so `--repeat-each=3` is
 * independent. `http` (H1 only, after 054 and before 080 and abnahme): end state after this file — one question of
 * Finanzen has one more version with `FORMAT_055B_HTTP_ANSWER` and a `body` (a bold and a highlighted word); nothing
 * else changed.
 */
import type { Locator, Page, Request } from '@playwright/test';
import { CORPUS_DEMO } from '@hv/domain';
import { checkAxe } from './support/axe';
import { FORMAT_055B_HTTP_ANSWER } from './support/e2e-texts';
import { evidence } from './support/evidence';
import { expect, test } from './support/http-guard';
import { asRole } from './support/roles';
import {
  BROWSER_SAMPLE_055B,
  GOOGLE_DOCS_SAMPLE_055B,
  LIBREOFFICE_SAMPLE_055B,
  MARKER_055B,
  PLAIN_THREE_LINES_055B,
  SENTINEL_HOST_055B,
  SENTINEL_SAMPLE_055B,
  SENTINEL_URL_055B,
  WORD_PLAIN_055B,
  WORD_SAMPLE_055B,
} from './support/word-sample-055b';

test.use({ viewport: { width: 1440, height: 900 } });

const isHttp = (): boolean => test.info().project.name === 'http';

/** The walker, loaded from the dev server like `API_MODULE` in 090 (in-process only). */
const WALKER_MODULE = '/src/features/answers/domToBody.ts';
const EXPERT_UNIT_ID = 'unit-fin';
/** The only elements the field may hold (decision 5). */
const FIELD_TAGS = ['p', 'ul', 'li', 'b', 'i', 'span'];

/** A formatted answer as the clipboard of a word processor would carry it: bold, highlight, a list of two. */
const FORMAT_HTML =
  '<p>Die <b>Dividende</b> steigt <span style="background:yellow">deutlich</span>.</p><ul><li>Erster Punkt</li><li>Zweiter Punkt</li></ul>';
/** The same wording with one more mark (italic): a new version that changes only the formatting. */
const FORMAT_HTML_MORE =
  '<p>Die <b>Dividende</b> steigt <span style="background:yellow">deutlich</span>.</p><ul><li><i>Erster</i> Punkt</li><li>Zweiter Punkt</li></ul>';
const FORMAT_PLAIN = 'Die Dividende steigt deutlich.\nErster Punkt\nZweiter Punkt';

async function waitForCorpus(page: Page): Promise<void> {
  const count = page.getByTestId('header-counter-questions');
  await expect.poll(async () => Number((await count.innerText()).replace(/\D/g, '')), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(CORPUS_DEMO.questions);
}

async function clearToasts(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^(Meldung schließen|Close the message)$/ });
  for (let open = await close.count(); open > 0; open = await close.count()) await close.first().click();
}

async function setLang(page: Page, lang: 'de' | 'en'): Promise<void> {
  await page.getByTestId(`lang-option-${lang}`).click();
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
}

const editor = (page: Page): Locator => page.getByTestId('focus-editor');
const rows = (page: Page): Locator => page.getByTestId('focus-row');

/** As in 054: the list has landed for the expert (ready, every row of Finanzen). */
async function waitForMine(page: Page): Promise<void> {
  await expect.poll(async () => {
    const list = page.getByTestId('focus-list');
    if ((await list.count()) === 0 || (await list.getAttribute('data-state')) !== 'ready') return false;
    const units = await rows(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-unit')));
    return units.length > 0 && units.every((unit) => unit === EXPERT_UNIT_ID);
  }, { timeout: 15_000 }).toBe(true);
}

/** The `findMine` motion of 054: as the expert on `/my`, the first own row in one of `statuses`; returns its number. */
async function findMine(page: Page, statuses: readonly string[]): Promise<string> {
  await asRole(page, 'expert');
  if (!/\/my$/.test(page.url())) await page.getByTestId('nav-focus').click();
  await expect(page).toHaveURL(/\/my$/);
  await waitForMine(page);
  for (const status of statuses) {
    const candidates = page.locator(`[data-testid="focus-row"][data-status="${status}"][data-unit="${EXPERT_UNIT_ID}"]:not([data-returned])`);
    for (let i = 0; i < (await candidates.count()); i++) {
      const candidate = candidates.nth(i);
      if ((await candidate.getByTestId('focus-row-refusal').count()) > 0) continue;
      const number = (await candidate.getAttribute('data-number')) ?? '';
      await candidate.click();
      await expect(page.getByTestId('focus-detail-number')).toHaveText(number);
      return number;
    }
  }
  throw new Error(`No question of Finanzen in ${statuses.join('/')} in "Meine Fragen".`);
}

/** Opens the writing mode of the chosen question; the field holds the focus. */
async function openWriting(page: Page, number: string): Promise<void> {
  await page.locator(`[data-testid="focus-row"][data-number="${number}"]`).dblclick();
  await expect(page.getByTestId('focus-writing')).toBeVisible();
  await expect(editor(page)).toBeFocused();
}

async function clearField(page: Page, field: Locator): Promise<void> {
  await field.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await expect(field).toHaveText('');
}

/** A synthetic paste or drop with a `DataTransfer`, as the clipboard of the operating system would deliver it. */
async function transfer(page: Page, testId: string, data: Readonly<Record<string, string>>, kind: 'paste' | 'drop'): Promise<void> {
  await page.evaluate(({ testId: id, data: items, kind: how }) => {
    const field = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (field === null) throw new Error(`no field ${id}`);
    field.focus();
    const dt = new DataTransfer();
    for (const [type, value] of Object.entries(items)) dt.setData(type, value);
    if (how === 'paste') {
      field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    } else {
      const box = field.getBoundingClientRect();
      field.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, clientX: box.right - 4, clientY: box.bottom - 4, bubbles: true, cancelable: true }));
    }
  }, { testId, data, kind });
}

/** Every element tag in the field, every comment, and whether any element carries a URL attribute. */
async function fieldShape(page: Page, testId: string): Promise<{ tags: string[]; comments: number; urlAttributes: number }> {
  return page.evaluate((id) => {
    const field = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const tags = [...new Set([...field.querySelectorAll('*')].map((el) => el.tagName.toLowerCase()))].sort();
    let comments = 0;
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) comments += 1;
    const urlAttributes = field.querySelectorAll('[src], [href], [srcset], [poster], [data], [background]').length;
    return { tags, comments, urlAttributes };
  }, testId);
}

/** The caret: the text of its node, its offset, and whether the field holds the focus. */
async function caretOf(page: Page, testId: string): Promise<{ html: string; text: string; offset: number; focused: boolean }> {
  return page.evaluate((id) => {
    const field = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const selection = document.getSelection();
    return {
      html: field.innerHTML,
      text: selection?.anchorNode?.textContent ?? '',
      offset: selection?.anchorOffset ?? -1,
      focused: document.activeElement === field,
    };
  }, testId);
}

/** Selects one word inside the field (the keyboard path of selecting is shown once in A1). */
async function selectWord(page: Page, testId: string, word: string): Promise<void> {
  await page.evaluate(({ id, w }) => {
    const field = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const at = node.data.indexOf(w);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + w.length);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    throw new Error(`no word ${w}`);
  }, { id: testId, w: word });
}

const marker = (page: Page): Promise<unknown> => page.evaluate((name) => (window as unknown as Record<string, unknown>)[name], MARKER_055B);

/** Two animation frames in the page: rendering after a change has happened. */
async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function expectFormattedLatest(locator: Locator): Promise<void> {
  await expect(locator.locator('strong').first()).toBeVisible();
  await expect(locator.locator('mark').first()).toBeVisible();
  await expect(locator.locator('ul > li')).toHaveCount(2);
  await expect(locator.locator('[data-answer-text="true"]').first()).toHaveAttribute('lang', 'de');
}

test.describe('055b in-process', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(isHttp(), 'in-process only; H1 is the http case');
    await page.goto('/');
    await waitForCorpus(page);
  });

  test('A1 Schreibmodus mit Werkzeugleiste und Kürzeln @screenshot', async ({ page }) => {
    test.setTimeout(150_000);
    const number = await findMine(page, ['assigned', 'answer_drafted']);
    await openWriting(page, number);
    const field = editor(page);
    await clearField(page, field);

    await page.keyboard.type('Die Dividende steigt deutlich');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Erster Punkt');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Zweiter Punkt');

    await test.step('Ctrl+Shift+L: the last two lines become a list of two', async () => {
      await page.keyboard.press('Shift+ArrowUp');
      await page.keyboard.press('Shift+Home');
      await page.keyboard.press('Control+Shift+L');
      await expect(field.locator('ul > li')).toHaveCount(2);
      await expect(page.getByTestId('format-list')).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('a word selected with the keyboard, Ctrl+B: bold, the toggle pressed', async () => {
      await page.keyboard.press('Control+Home');
      await page.keyboard.press('End');
      await page.keyboard.press('Control+Shift+ArrowLeft');
      expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('deutlich');
      await page.keyboard.press('Control+b');
      await expect(field.locator('b')).toHaveText('deutlich');
      await expect(page.getByTestId('format-bold')).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('another word, Ctrl+Shift+H: highlighted', async () => {
      await selectWord(page, 'focus-editor', 'Dividende');
      await page.keyboard.press('Control+Shift+H');
      await expect(field.locator('span[style*="background-color"]')).toHaveText('Dividende');
      await expect(page.getByTestId('format-highlight')).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('Ctrl+U changes nothing', async () => {
      const before = await field.innerHTML();
      await page.keyboard.press('Control+u');
      expect(await field.innerHTML()).toBe(before);
      expect((await fieldShape(page, 'focus-editor')).tags.every((tag) => FIELD_TAGS.includes(tag))).toBe(true);
    });

    await test.step('the toolbar by keyboard only: one tab stop, arrow, space; the focus returns to the field', async () => {
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Control+Shift+ArrowLeft');
      expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('Punkt');
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByTestId('format-bold')).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('format-italic')).toBeFocused();
      await expect(page.getByTestId('format-italic')).toHaveAttribute('tabindex', '0');
      await expect(page.getByTestId('format-bold')).toHaveAttribute('tabindex', '-1');
      await page.keyboard.press('Space');
      await expect(field).toBeFocused();
      await expect(field.locator('li i')).toHaveText('Punkt');
    });

    await test.step('screenshots in both languages; the field keeps its content and lang="de"', async () => {
      await page.keyboard.press('End');
      await clearToasts(page);
      await checkAxe(page, '055b writing mode DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('055b-editor-de.png') });
      const html = await field.innerHTML();
      await setLang(page, 'en');
      expect(await field.innerHTML()).toBe(html);
      await expect(field).toHaveAttribute('lang', 'de');
      await expect(page.getByRole('toolbar', { name: 'House format' })).toBeVisible();
      await clearToasts(page);
      await checkAxe(page, '055b writing mode EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('055b-editor-en.png') });
      await setLang(page, 'de');
    });

    await test.step('Ctrl+Enter saves: focus, caret and content stay, also after one\'s own version came over the stream', async () => {
      await field.focus();
      await page.keyboard.press('Control+End');
      const before = await caretOf(page, 'focus-editor');
      expect(before.focused).toBe(true);
      await page.keyboard.press('Control+Enter');
      await expect(page.getByTestId('focus-save')).toHaveAttribute('aria-disabled', 'true');
      expect(await caretOf(page, 'focus-editor')).toEqual(before);
      // One's own version is back from the stream when the record offers the next step.
      await expect(page.getByTestId('focus-writing-submit')).toBeVisible();
      await twoFrames(page);
      expect(await caretOf(page, 'focus-editor')).toEqual(before);
      await expect(page.getByTestId('focus-save')).toHaveAttribute('aria-disabled', 'true');
    });

    await test.step('Escape: focus-latest shows strong, mark, a list of two, lang="de"', async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('focus-writing')).toHaveCount(0);
      const latest = page.getByTestId('focus-latest');
      await expectFormattedLatest(latest);
      await expect(latest.locator('strong')).toHaveText('deutlich');
      await expect(latest.locator('mark')).toHaveText('Dividende');
      await checkAxe(page, '055b focus detail with a formatted version');
    });

    await test.step('D9: the walker on 20 000 characters stays under 16 ms', async () => {
      const timing = await page.evaluate(async (mod) => {
        const m = (await import(/* @vite-ignore */ mod)) as typeof import('../src/features/answers/domToBody');
        const run = (n: number) => ({ text: `Satz ${n} mit einigen Worten zur Dividende und zum Ausblick des Konzerns. `.padEnd(100, 'x') });
        const blocks = Array.from({ length: 100 }, (_, i) => ({
          type: 'paragraph',
          content: [run(i), { ...run(i + 1), marks: i % 3 === 0 ? ['bold'] : i % 3 === 1 ? ['highlight'] : ['italic'] }],
        }));
        const host = document.createElement('div');
        host.replaceChildren(...m.bodyToDom(document, { blocks }));
        const chars = host.textContent?.length ?? 0;
        const times: number[] = [];
        for (let i = 0; i < 25; i++) {
          const start = performance.now();
          m.domToBodyInput(host);
          times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        return { chars, median: times[12]!, max: times[24]! };
      }, WALKER_MODULE);
      console.log(`[D9] walker over ${timing.chars} characters: median ${timing.median.toFixed(2)} ms, max ${timing.max.toFixed(2)} ms`);
      expect(timing.chars).toBeGreaterThanOrEqual(20_000);
      expect(timing.median).toBeLessThan(16);
    });
  });

  test('A2 Einfügen aus Word, inert (paste, drop, nur Text)', async ({ page }) => {
    test.setTimeout(120_000);
    const number = await findMine(page, ['assigned', 'answer_drafted']);
    await openWriting(page, number);
    const field = editor(page);

    const checkWord = async (how: string): Promise<void> => {
      await expect(field).toContainText('Fettes Wort', { timeout: 5_000 });
      expect(await marker(page), `${how}: nothing ran`).toBeUndefined();
      const shape = await fieldShape(page, 'focus-editor');
      expect(shape.tags.every((tag) => FIELD_TAGS.includes(tag)), `${how}: ${shape.tags.join(',')}`).toBe(true);
      expect(shape.comments).toBe(0);
      expect(shape.urlAttributes).toBe(0);
      await expect(field.locator('b')).toHaveText('Fettes Wort');
      await expect(field.locator('i')).toHaveText('kursiver Teil');
      await expect(field.locator('span[style*="background-color"]')).toHaveText('markierter Teil');
      await expect(field).toContainText('und unterstrichen.');
      await expect(field.locator('p')).toHaveCount(4);
      const text = (await field.textContent()) ?? '';
      expect(text).not.toContain('VERBORGEN-055B');
      expect(text).not.toContain('\u00B7');
      expect(text).not.toContain('geheim');
      const caret = await caretOf(page, 'focus-editor');
      expect(caret.text.endsWith('Sichtbarer Schluss.')).toBe(true);
      expect(caret.offset).toBe(caret.text.length);
    };

    await test.step('paste with text/html and text/plain', async () => {
      await clearField(page, field);
      await transfer(page, 'focus-editor', { 'text/html': WORD_SAMPLE_055B, 'text/plain': WORD_PLAIN_055B }, 'paste');
      await checkWord('paste');
    });

    await test.step('drop with the same sample', async () => {
      await clearField(page, field);
      await transfer(page, 'focus-editor', { 'text/html': WORD_SAMPLE_055B, 'text/plain': WORD_PLAIN_055B }, 'drop');
      await checkWord('drop');
    });

    await test.step('text/plain only: three lines, three paragraphs', async () => {
      await clearField(page, field);
      await transfer(page, 'focus-editor', { 'text/plain': PLAIN_THREE_LINES_055B }, 'paste');
      await expect(field.locator('p')).toHaveCount(3);
      await expect(field.locator('p').nth(2)).toHaveText('Dritte Zeile');
      expect((await fieldShape(page, 'focus-editor')).tags).toEqual(['p']);
    });

    await test.step('a paste in the middle continues the paragraph; the caret stands after the inserted text', async () => {
      await selectWord(page, 'focus-editor', 'Zweite');
      await transfer(page, 'focus-editor', { 'text/html': '<b>Neue</b>' }, 'paste');
      await expect(field.locator('p').nth(1)).toHaveText('Neue Zeile');
      const caret = await caretOf(page, 'focus-editor');
      expect(caret.text).toBe('Neue');
      expect(caret.offset).toBe(4);
    });

    await test.step('saved, focus-latest shows only strong, em, mark and p', async () => {
      await clearField(page, field);
      await transfer(page, 'focus-editor', { 'text/html': WORD_SAMPLE_055B, 'text/plain': WORD_PLAIN_055B }, 'paste');
      await checkWord('paste before saving');
      await page.keyboard.press('Control+Enter');
      await expect(page.getByTestId('focus-save')).toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape');
      const latest = page.getByTestId('focus-latest').locator('[data-answer-text="true"]');
      await expect(latest).toContainText('Sichtbarer Schluss.');
      const tags = await latest.evaluate((root) => [...new Set([...root.querySelectorAll('*')].map((el) => el.tagName.toLowerCase()))].sort());
      expect(tags).toEqual(['em', 'mark', 'p', 'strong']);
      await expect(latest).not.toContainText('VERBORGEN-055B');
      expect(await marker(page)).toBeUndefined();
    });
  });

  test('A2b Einfügen lädt nichts nach (Pflicht, Codex P1 auf #156)', async ({ page, context }) => {
    test.setTimeout(120_000);
    const seen: string[] = [];
    const count = (request: Request): void => {
      if (request.url().includes(SENTINEL_HOST_055B)) seen.push(request.url());
    };
    await context.route(`**/*${SENTINEL_HOST_055B}*/**`, (route) => route.abort());
    page.on('request', count);
    context.on('request', count);
    const sentinelSeen = (): number => new Set(seen).size;

    const number = await findMine(page, ['assigned', 'answer_drafted']);
    await openWriting(page, number);
    const field = editor(page);

    const settle = async (): Promise<void> => {
      await page.waitForLoadState('networkidle');
      await twoFrames(page);
    };

    for (const kind of ['paste', 'drop'] as const) {
      await test.step(`${kind}: no request to the sentinel host, no URL attribute in the field`, async () => {
        await clearField(page, field);
        await transfer(page, 'focus-editor', { 'text/html': SENTINEL_SAMPLE_055B, 'text/plain': 'Waechter fett 055b' }, kind);
        await expect.poll(() => field.locator('b').first().textContent()).toBe('Waechter fett 055b');
        await settle();
        expect(seen, `${kind}: requests to the sentinel`).toEqual([]);
        const shape = await fieldShape(page, 'focus-editor');
        expect(shape.urlAttributes).toBe(0);
        expect(shape.tags.every((tag) => FIELD_TAGS.includes(tag))).toBe(true);
      });
    }

    await test.step('saved and rendered once: still no request', async () => {
      await page.keyboard.press('Control+Enter');
      await expect(page.getByTestId('focus-save')).toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('focus-latest')).toContainText('Waechter fett 055b');
      await settle();
      expect(seen).toEqual([]);
    });

    await test.step('control: an img with the sentinel URL in the live document is counted once', async () => {
      await page.evaluate((url) => {
        const img = document.createElement('img');
        img.src = `${url}/control.png`;
        img.alt = '';
        img.style.display = 'none';
        document.body.append(img);
      }, SENTINEL_URL_055B);
      await expect.poll(sentinelSeen).toBe(1);
      await settle();
      expect(sentinelSeen()).toBe(1);
      console.log(`[A2b] sentinel requests during and after paste and drop: 0; control: ${sentinelSeen()} (${[...new Set(seen)].join(', ')})`);
    });
  });

  test('A3 Walker gegen echtes DOM (Word, Google Docs, Browser, LibreOffice)', async ({ page }) => {
    const results = await page.evaluate(async ({ mod, samples }) => {
      const m = (await import(/* @vite-ignore */ mod)) as typeof import('../src/features/answers/domToBody');
      return samples.map((html) => m.domToBodyInput(new DOMParser().parseFromString(html, 'text/html')));
    }, { mod: WALKER_MODULE, samples: [WORD_SAMPLE_055B, GOOGLE_DOCS_SAMPLE_055B, BROWSER_SAMPLE_055B, LIBREOFFICE_SAMPLE_055B] });

    expect(results[0]).toEqual({
      blocks: [
        {
          type: 'paragraph',
          content: [
            { text: 'Fettes Wort', marks: ['bold'] },
            { text: ' und ' },
            { text: 'kursiver Teil', marks: ['italic'] },
            { text: ' und ' },
            { text: 'markierter Teil', marks: ['highlight'] },
            { text: ' und ' },
            { text: 'unterstrichen', marks: ['underline'] },
            { text: '.' },
          ],
        },
        { type: 'paragraph', content: [{ text: 'Erster Punkt' }] },
        { type: 'paragraph', content: [{ text: 'Zweiter Punkt' }] },
        { type: 'paragraph', content: [{ text: 'Sichtbarer Schluss.' }] },
      ],
    });
    expect(results[1]).toEqual({
      blocks: [
        { type: 'paragraph', content: [{ text: 'Fett', marks: ['bold'] }, { text: ' und normal und ' }, { text: 'gelb', marks: ['highlight'] }] },
        { type: 'list', items: [[{ text: 'kursiver Punkt', marks: ['italic'] }]] },
      ],
    });
    expect(results[2]).toEqual({
      blocks: [
        { type: 'heading', content: [{ text: 'Überschrift' }] },
        { type: 'paragraph', content: [{ text: 'Text mit Verweis und ' }, { text: 'stark', marks: ['bold'] }, { text: '.' }] },
        { type: 'table', content: [{ text: 'Zelle' }] },
      ],
    });
    expect(results[3]).toEqual({
      blocks: [
        { type: 'paragraph', content: [{ text: 'Fett', marks: ['bold'] }, { text: ' ' }, { text: 'gelb', marks: ['highlight'] }, { text: ' ' }, { text: 'kursiv', marks: ['italic'] }] },
        { type: 'list', items: [[{ text: 'Eins' }], [{ text: 'Zwei' }]] },
      ],
    });
  });

  test('A4 und A5 Ganzer Weg bis zur Bühne und in die Historie @screenshot', async ({ page }) => {
    test.setTimeout(240_000);
    const number = await findMine(page, ['assigned']);

    await test.step('A4: a formatted answer saved in the focus view', async () => {
      await openWriting(page, number);
      await clearField(page, editor(page));
      await transfer(page, 'focus-editor', { 'text/html': FORMAT_HTML, 'text/plain': FORMAT_PLAIN }, 'paste');
      await expect(editor(page).locator('ul > li')).toHaveCount(2);
      await page.keyboard.press('Control+Enter');
      await expect(page.getByTestId('focus-writing-submit')).toBeVisible();
      await page.keyboard.press('Escape');
      await expectFormattedLatest(page.getByTestId('focus-latest'));
    });

    await test.step('A4: in the Beantwortung a new version with one more mark only: "Nur die Auszeichnung"', async () => {
      await page.getByTestId('nav-answers').click();
      await page.getByTestId('answers-search').fill(number);
      const row = page.getByTestId('answers-row').first();
      await expect(row).toHaveAttribute('data-number', number);
      await row.click();
      await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
      // takt-048: the field starts with version 1 (no placeholder); everything is selected before the paste replaces it.
      const field = page.getByTestId('answer-editor');
      await expect(page.getByTestId('answer-editor-placeholder')).toHaveCount(0);
      await expect(field.locator('ul > li')).toHaveCount(2);
      await expect(field.locator('li i')).toHaveCount(0);
      await field.focus();
      await page.keyboard.press('Control+A');
      await transfer(page, 'answer-editor', { 'text/html': FORMAT_HTML_MORE, 'text/plain': FORMAT_PLAIN }, 'paste');
      await expect(field.locator('li i')).toHaveText('Erster');
      await expect(field.locator('ul > li')).toHaveCount(2);
      await page.getByTestId('answer-submit-draft').click();
      const second = page.locator('[data-testid="answer-version"][data-version="2"]');
      await expect(second).toBeVisible();
      // After saving the field shows version 2 (its base is what was sent) and saving is locked.
      await expect(field.locator('li i')).toHaveText('Erster');
      await expect(page.getByTestId('answer-submit-draft')).toHaveAttribute('aria-disabled', 'true');
      await second.getByTestId('answer-diff-toggle').click();
      await expect(second.getByTestId('answer-diff-format-only')).toBeVisible();
      await expect(second.getByTestId('answer-diff')).toHaveCount(0);
      await expect(second.locator('[data-answer-text="true"] em')).toHaveText('Erster');
    });

    await test.step('A4: forwarded, cleared by legal, approved, staged', async () => {
      await page.getByTestId('answer-submit-review').click();
      await expect(page.getByTestId('approval-block')).toContainText('Legal Clearing');
      const openAs = async (role: string): Promise<void> => {
        await asRole(page, role);
        await page.getByTestId('answers-search').fill(number);
        const row = page.getByTestId('answers-row').first();
        await expect(row).toHaveAttribute('data-number', number);
        await row.click();
        await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
      };
      await openAs('legal');
      await page.getByTestId('answer-legal-clear').click();
      await expect(page.getByTestId('legal-clearance-block')).toContainText('Rechtlich freigegeben');
      await openAs('approver');
      await page.getByTestId('answer-approve').click();
      await expect(page.getByTestId('approval-block')).toContainText('Version 2');
      await page.getByTestId('answer-stage').click();
      await expect(page.getByTestId('answers-detail')).toContainText('auf der Bühne');
    });

    await test.step('A4: on the podium the preview from the queue and the current answer show the format', async () => {
      await page.evaluate(() => localStorage.setItem('hv-stage-only-v1', '0'));
      await asRole(page, 'podium');
      await page.getByTestId('nav-stage').click();
      await expect(page).toHaveURL(/\/stage$/);
      const current = page.getByTestId('stage-current-number');
      await expect(current).toBeVisible();
      const queued = page.locator(`[data-testid="stage-queue-item"][data-number="${number}"]`);
      let previewed = false;
      for (let round = 0; round < 150 && (await current.innerText()) !== number; round++) {
        if (!previewed && (await queued.count()) > 0) {
          await queued.locator('button').click();
          const preview = page.getByTestId('stage-preview-answer');
          await expectFormattedLatest(preview);
          await expect(preview.locator('strong')).toHaveText('Dividende');
          await expect(preview.locator('mark')).toHaveText('deutlich');
          await page.keyboard.press('Escape');
          await expect(page.getByTestId('stage-preview')).toHaveCount(0);
          previewed = true;
        }
        const before = await current.innerText();
        await page.getByTestId('stage-next').click();
        await expect(current).not.toHaveText(before);
      }
      expect(previewed).toBe(true);
      await expect(current).toHaveText(number);
      const answer = page.getByTestId('stage-answer');
      await expect(answer).toHaveAttribute('data-prepared', 'true');
      await expectFormattedLatest(answer);
      await checkAxe(page, '055b stage with a formatted answer');
    });

    const stageShot = async (name: string): Promise<void> => {
      await page.getByTestId('stage-only-toggle').click();
      const overlay = page.getByTestId('stage-only');
      await expect(overlay).toBeVisible();
      const contrast = page.getByTestId('stage-contrast-toggle');
      if (!/stage-contrast/.test((await overlay.getAttribute('class')) ?? '')) await contrast.click();
      await expect(overlay).toHaveClass(/stage-contrast/);
      await expectFormattedLatest(page.getByTestId('stage-answer'));
      await page.mouse.move(700, 120);
      await clearToasts(page);
      await checkAxe(page, `055b stage, contrast (${name})`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence(name) });
      await contrast.click();
      await page.getByTestId('stage-only-toggle').click();
      await expect(overlay).toHaveCount(0);
    };

    await test.step('A4: screenshots of the podium on the dark ground, German and English (answer stays lang="de")', async () => {
      await stageShot('055b-buehne-de.png');
      await setLang(page, 'en');
      await expect(page.getByTestId('stage-answer').locator('[data-answer-text="true"]')).toHaveAttribute('lang', 'de');
      await stageShot('055b-buehne-en.png');
      await setLang(page, 'de');
    });

    await test.step('A5: the history shows "Antwort, Version 2" above the timeline, formatted as on the podium', async () => {
      await asRole(page, 'moderation');
      await page.getByTestId('nav-history').click();
      await expect(page).toHaveURL(/\/history$/);
      await page.getByTestId('history-search').fill(number);
      const result = page.getByTestId('history-result').filter({ hasText: number }).first();
      await expect(result).toBeVisible();
      await result.click();
      const block = page.getByTestId('history-answer');
      await expect(block).toBeVisible();
      await expect(block).toContainText('Antwort, Version 2');
      await expectFormattedLatest(block);
      await expect(block.locator('em')).toHaveText('Erster');
      await expect(page.getByTestId('history-timeline')).toBeVisible();
      const blockBox = await block.boundingBox();
      const timelineBox = await page.getByTestId('history-timeline').boundingBox();
      expect((blockBox?.y ?? 0) < (timelineBox?.y ?? 0)).toBe(true);
      await clearToasts(page);
      await checkAxe(page, '055b history DE');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('055b-historie-de.png') });
      await setLang(page, 'en');
      await expect(block).toContainText('Answer, version 2');
      await expect(block.locator('[data-answer-text="true"]')).toHaveAttribute('lang', 'de');
      await clearToasts(page);
      await checkAxe(page, '055b history EN');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: evidence('055b-historie-en.png') });
      await setLang(page, 'de');
    });
  });

  test('A6 Daten je Akteur (090): ein formatierter Entwurf geht mit dem Akteurwechsel', async ({ page }) => {
    const secret = 'Vertraulicher formatierter Entwurf 055b';
    await page.goto('/answers');
    await waitForCorpus(page);
    await asRole(page, 'expert');
    await page.getByTestId('answers-filter-status-all').click();
    await page.getByTestId('answers-filter-status-assigned').click();
    const row = page.getByTestId('answers-row').first();
    await expect(row).toHaveAttribute('data-status', 'assigned');
    await row.click();
    const number = await page.getByTestId('answers-detail-number').innerText();
    const field = page.getByTestId('answer-editor');
    await field.focus();
    await page.keyboard.type(secret);
    await page.keyboard.press('Control+Shift+ArrowLeft');
    await page.keyboard.press('Control+b');
    await expect(field.locator('b')).toHaveText('055b');

    await asRole(page, 'legal');
    await expect(page.locator('#main')).not.toContainText(secret);
    await asRole(page, 'expert');
    if ((await page.getByTestId('answers-detail-number').count()) === 0) {
      await page.getByTestId('answers-filter-status-all').click();
      await page.getByTestId('answers-filter-status-assigned').click();
      await page.locator(`[data-testid="answers-row"][data-number="${number}"]`).click();
    }
    await expect(page.getByTestId('answers-detail-number')).toHaveText(number);
    await expect(field).toBeVisible();
    await expect(field).toHaveText('');
    await expect(field.locator('b')).toHaveCount(0);
    await expect(page.locator('#main')).not.toContainText(secret);
  });
});

test.describe('055b http', () => {
  test('H1 formatierte Version über den Dienst, nach dem Neuladen gleich', async ({ page }) => {
    test.skip(!isHttp(), 'http only');
    test.setTimeout(120_000);
    await page.goto('/my');
    const number = await findMine(page, ['answer_drafted', 'assigned']);
    await openWriting(page, number);
    const field = editor(page);
    await clearField(page, field);
    await page.keyboard.type(FORMAT_055B_HTTP_ANSWER);
    await selectWord(page, 'focus-editor', 'Dividende');
    await page.getByTestId('format-bold').click();
    await selectWord(page, 'focus-editor', 'deutlich');
    await page.getByTestId('format-highlight').click();
    await expect(field.locator('b')).toHaveText('Dividende');
    await expect(field.locator('span[style*="background-color"]')).toHaveText('deutlich');
    await field.focus();
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('focus-save')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    const latest = page.getByTestId('focus-latest');
    await expect(latest).toContainText(FORMAT_055B_HTTP_ANSWER);
    await page.reload();
    await waitForMine(page);
    await page.locator(`[data-testid="focus-row"][data-number="${number}"]`).click();
    await expect(page.getByTestId('focus-detail-number')).toHaveText(number);
    await expect(latest).toContainText(FORMAT_055B_HTTP_ANSWER);
    await expect(latest.locator('strong')).toHaveText('Dividende');
    await expect(latest.locator('mark')).toHaveText('deutlich');
    await expect(latest.locator('[data-answer-text="true"]')).toHaveAttribute('lang', 'de');
  });
});
