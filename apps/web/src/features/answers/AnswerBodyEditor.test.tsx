/**
 * Scheibe 055b, Test 9: the answer field (Feld) with its toolbar, rendered statically. The placeholder stands, hidden
 * from assistive technology, only while the field is empty; the field is a multi-line textbox with its label, its two
 * descriptions and `lang="de"`; the toolbar has four toggles with one tab stop; two sizes.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerBody } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey } from '../../i18n';
import { AnswerBodyEditor } from './AnswerBodyEditor';

const de = (key: TKey) => translate('de', key);
const DOC: AnswerBody = { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold'] }] }] };

function render(initial: AnswerBody | null, size: 'large' | 'compact' = 'large'): string {
  return renderToStaticMarkup(
    <AnswerBodyEditor
      testId="answer-editor"
      initial={initial}
      generation={0}
      labelId="label-1"
      describedBy="extra-1"
      size={size}
      onChange={() => undefined}
    />,
  );
}
const fieldTag = (html: string): string => html.match(/<div[^>]*data-testid="answer-editor"[^>]*>/)?.[0] ?? '';

describe('AnswerBodyEditor (Test 9)', () => {
  it('empty: the placeholder is visible and aria-hidden, the field carries aria-placeholder', () => {
    const html = render(null);
    expect(html).toMatch(new RegExp(`<span[^>]*aria-hidden="true"[^>]*data-testid="answer-editor-placeholder"[^>]*>${de('answers.editor.placeholder')}</span>`));
    expect(fieldTag(html)).toContain(`aria-placeholder="${de('answers.editor.placeholder')}"`); // i18n-ok: expected markup in a test, not a rendered text
  });

  it('with content: no placeholder (the content itself is built in the browser by bodyToDom, e2e A1)', () => {
    const html = render(DOC);
    expect(html).not.toContain('answer-editor-placeholder');
    expect(fieldTag(html)).not.toContain('aria-placeholder');
  });

  it('the field: textbox, multi-line, labelled, described by keys, hint and the caller, lang de, spellcheck, editable', () => {
    const tag = fieldTag(render(null));
    expect(tag).toContain('role="textbox"');
    expect(tag).toContain('aria-multiline="true"');
    expect(tag).toContain('aria-labelledby="label-1"');
    expect(tag).toMatch(/aria-describedby="[^"]*-keys [^"]*-hint extra-1"/);
    expect(tag).toContain('lang="de"');
    expect(tag).toMatch(/spellcheck="true"/i);
    expect(tag).toMatch(/contenteditable="true"/i);
  });

  it('the toolbar: four toggles, aria-pressed false, exactly one with tabindex 0, controls the field, keys named', () => {
    const html = render(null);
    const toolbar = html.match(/<div[^>]*role="toolbar"[^>]*>/)?.[0] ?? '';
    expect(toolbar).toContain(`aria-label="${de('answers.format.toolbar')}"`); // i18n-ok: expected markup in a test, not a rendered text
    const fieldId = fieldTag(html).match(/ id="([^"]+)"/)?.[1] ?? 'none';
    expect(toolbar).toContain(`aria-controls="${fieldId}"`);
    const buttons = ['format-bold', 'format-italic', 'format-highlight', 'format-list'].map(
      (id) => html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '',
    );
    for (const button of buttons) {
      expect(button).toContain('aria-pressed="false"');
      expect(button).toMatch(/aria-keyshortcuts="[^"]+"/);
      expect(button).toMatch(/aria-label="[^"]+"/);
    }
    expect(buttons.filter((b) => b.includes('tabindex="0"')).length).toBe(1);
    expect(buttons.filter((b) => b.includes('tabindex="-1"')).length).toBe(3);
    expect(html).toContain(de('answers.format.hint'));
    expect(html).toContain(de('answers.format.keys'));
    expect(html.indexOf('role="toolbar"')).toBeLessThan(html.indexOf('data-testid="answer-editor"'));
  });

  it('two sizes', () => {
    expect(fieldTag(render(null, 'large'))).toContain('text-[15px]');
    expect(fieldTag(render(null, 'compact'))).toContain('text-[13px]');
  });
});
