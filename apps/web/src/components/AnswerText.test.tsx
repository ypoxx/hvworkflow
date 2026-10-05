/**
 * Scheibe 055b, Test 1: the one renderer of an answer (ADR 0005 "ein Renderer"), rendered statically. Its own,
 * narrower whitelist; React elements and text nodes only; `lang` only from its own list; the fallback without a body;
 * and the source rule (h): no component reads `payload.answer.body` of an event.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerBody, AnswerVersion } from '@hv/domain';
import { AnswerText } from './AnswerText';

type Shown = Pick<AnswerVersion, 'body' | 'text'>;
const render = (answer: Shown, className?: string): string =>
  renderToStaticMarkup(<AnswerText answer={answer} {...(className !== undefined ? { className } : {})} />);
const withBody = (body: unknown, text = 'x'): Shown => ({ body: body as AnswerBody, text });

const DOC: AnswerBody = {
  language: 'de',
  blocks: [
    { type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold', 'italic', 'highlight'] }, { text: ' steigt.' }] },
    { type: 'list', items: [[{ text: 'erstens', marks: ['bold'] }], [{ text: 'zweitens', marks: ['highlight'] }]] },
  ],
};

describe('AnswerText (Test 1)', () => {
  it('(a) paragraph → <p>, list → <ul> with one <li> per item', () => {
    const html = render({ body: DOC, text: '' });
    expect(html.match(/<p[ >]/g)?.length).toBe(1);
    expect(html).toMatch(/<ul[^>]*><li[^>]*><strong>erstens<\/strong><\/li><li[^>]*>/);
    expect(html.match(/<li[ >]/g)?.length).toBe(2);
  });

  it('(b) marks → strong > em > mark, the mark with the two warning tokens', () => {
    const html = render({ body: DOC, text: '' });
    expect(html).toContain('<strong><em><mark style="background-color:var(--color-tone-warning-bg);color:var(--color-tone-warning-fg)">Dividende</mark></em></strong>');
  });

  it('(c) an unknown block type (forced) becomes <p>; an unknown mark falls away, its text stays', () => {
    const html = render(withBody({ language: 'de', blocks: [{ type: 'heading', content: [{ text: 'Titel', marks: ['underline'] }] }] }));
    expect(html).toMatch(/<p[^>]*>Titel<\/p>/);
    expect(html).not.toContain('<h');
    expect(html).not.toContain('<u');
  });

  it('(d) markup in the text is escaped; no <script, no onclick', () => {
    const html = render(withBody({
      language: 'de',
      blocks: [{ type: 'paragraph', content: [{ text: '<script>alert(1)</script> <b onclick="x()">b</b>' }] }],
    }));
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/<[^>]*onclick/);
    expect(html).not.toContain('<b ');
  });

  it('(e) lang="de" at the root; another value (forced) gives no lang', () => {
    expect(render({ body: DOC, text: '' })).toMatch(/^<div[^>]*lang="de"/);
    for (const language of ['en', 'x" onload="alert(1)', '']) {
      const html = render(withBody({ ...DOC, language }));
      expect(html).not.toContain('lang=');
      expect(html).not.toContain('onload');
    }
  });

  it('(f) without a body: the text with whitespace-pre-wrap, without lang', () => {
    const html = render({ text: 'eins\nzwei <i>' });
    expect(html).toMatch(/<p class="[^"]*whitespace-pre-wrap[^"]*">eins\nzwei &lt;i&gt;<\/p>/);
    expect(html).not.toContain('lang=');
  });

  it('(g) no font family and no font size at the root; the class passes through', () => {
    const html = render({ body: DOC, text: '' }, 'custom-class');
    const root = html.match(/^<div[^>]*>/)?.[0] ?? '';
    expect(root).toContain('custom-class');
    expect(root).not.toMatch(/font-|text-\[|text-(xs|sm|base|lg|xl|2xs)/);
    expect(root).not.toContain('style=');
  });

  it('(h) source: no file under features/** or components/** reads payload.answer…body', () => {
    // Vite reads the sources at test time (no Node types in this project, slice 013); eager, as raw text.
    const sources = {
      ...import.meta.glob<string>('../features/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
      ...import.meta.glob<string>('./*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
    };
    const files = Object.keys(sources).filter((file) => !/\.test\.tsx?$/.test(file));
    expect(files.length).toBeGreaterThan(20);
    const hits = files.filter((file) => /payload\s*(\?\.|\.)\s*answer\s*(\?\.|\.)\s*body|payload\.answer[\s\S]{0,40}\.body/.test(sources[file] ?? ''));
    expect(hits).toEqual([]);
  });
});
