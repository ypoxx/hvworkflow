/**
 * Scheibe 054, Test 7, moved onto the answer field of 055b (Test 8): the writing mode, rendered statically. The field
 * is a multi-line textbox with label, keys, the hint "font and size come from the view" and `lang="de"`; its content is
 * built in the browser from the draft (`newDraft`: the latest version, empty with the refusal hint when the latest
 * version is a refusal; e2e A1); the toolbar has four toggles and one tab stop; saving is locked (`aria-disabled`)
 * without a change; the reading time comes from the preview; the action bar follows `focusActions`; the notice of a
 * newer version stands when `rebase` is set.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerBodyInput, AnswerVersion, Permission, Question } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey } from '../../i18n';
import { isDirty, newDraft } from './focus';
import { WritingMode } from './WritingMode';

const de = (key: TKey) => translate('de', key);
const EXPERT: Permission[] = ['answer.draft', 'question.submit_review', 'question.forward', 'question.read'];

function question(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1', number: 'F-0111', contributionId: 'c-1', speakerId: 's-1', speakerDisplayName: 'Redner 15',
    text: 'Wie hoch ist die Dividende?', status: 'answer_drafted', unitId: 'unit-fin', answers: [version(1)], version: 3,
    createdAt: '2026-06-15T10:00:00.000Z', updatedAt: '2026-06-15T10:00:00.000Z', _actions: EXPERT, ...over,
  };
}

function version(n: number, over: Partial<AnswerVersion> = {}): AnswerVersion {
  return { version: n, text: 'Die Dividende beträgt 1,20 Euro je Aktie.', createdAt: '2026-06-15T10:05:00.000Z', createdBy: { id: 'u-1', role: 'expert' }, ...over };
}

const plain = (text: string): AnswerBodyInput => ({ blocks: [{ type: 'paragraph', content: [{ text }] }] });

function render(q: Question, opts: { text?: string; body?: AnswerBodyInput | null; rebase?: boolean } = {}): string {
  const draft = newDraft('u-1', q);
  const body = opts.body !== undefined ? opts.body : opts.text !== undefined ? plain(opts.text) : draft.body;
  return renderToStaticMarkup(
    <WritingMode
      question={q}
      body={body}
      generation={draft.generation}
      sources={draft.sources}
      dirty={isDirty({ ...draft, body })}
      busy={false}
      rebase={opts.rebase ?? false}
      stale={false}
      dialogOpen={false}
      onBody={() => undefined}
      onSources={() => undefined}
      onAction={() => undefined}
      onClose={() => undefined}
      onRebase={() => undefined}
      onStaleReload={() => undefined}
    />,
  );
}

const fieldTag = (html: string): string => html.match(/<div[^>]*data-testid="focus-editor"[^>]*>/)?.[0] ?? '';
const buttonTag = (html: string, id: string): string => html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '';

describe('WritingMode (Test 7)', () => {
  it('the field starts from the latest version (no placeholder); the question stands above it', () => {
    const html = render(question());
    expect(newDraft('u-1', question()).body).toEqual({ language: 'de', ...plain(version(1).text) });
    expect(html).not.toContain('focus-editor-placeholder');
    expect(html.indexOf('data-testid="focus-writing-question"')).toBeLessThan(html.indexOf('data-testid="focus-editor"'));
    expect(html).not.toContain('focus-refusal-hint');
  });

  it('empty with the placeholder and the refusal hint when the latest version is a refusal', () => {
    const html = render(question({ answers: [version(1, { answerKind: 'refusal_no_claim', text: 'Kein Bezug' })] }));
    expect(html).toContain('data-testid="focus-editor-placeholder"');
    expect(html).toContain('data-testid="focus-refusal-hint"');
    expect(html).toContain(de('answers.refusal.editorHint'));
  });

  it('the field: textbox, multi-line, labelled by the answer label, described by both key lines and the hint, lang de', () => {
    const html = render(question());
    const tag = fieldTag(html);
    expect(tag).toContain('role="textbox"');
    expect(tag).toContain('aria-multiline="true"');
    expect(tag).toContain('lang="de"');
    const labelId = tag.match(/aria-labelledby="([^"]+)"/)?.[1] ?? 'none';
    expect(html).toMatch(new RegExp(`id="${labelId}"[^>]*>${de('answers.editor.label')}<`));
    const described = (tag.match(/aria-describedby="([^"]+)"/)?.[1] ?? '').split(' ');
    const textOf = (id: string): string => html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`))?.[1] ?? '';
    const texts = described.map(textOf);
    expect(texts).toContain(de('answers.format.keys'));
    expect(texts).toContain(de('answers.format.hint'));
    expect(texts).toContain(de('focus.write.keys'));
  });

  it('the toolbar: four toggles, none pressed, exactly one tab stop', () => {
    const html = render(question());
    const buttons = ['format-bold', 'format-italic', 'format-highlight', 'format-list'].map(
      (id) => html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '',
    );
    expect(buttons.every((b) => b.includes('aria-pressed="false"'))).toBe(true);
    expect(buttons.filter((b) => b.includes('tabindex="0"')).length).toBe(1);
  });

  it('without a change: save locked, Weiterleiten primary, forward secondary, the keys named', () => {
    const html = render(question());
    expect(buttonTag(html, 'focus-save')).toContain('aria-disabled="true"');
    expect(buttonTag(html, 'focus-save')).not.toContain('data-primary');
    expect(buttonTag(html, 'focus-writing-submit')).toContain('data-primary="true"');
    expect(buttonTag(html, 'focus-writing-forward')).not.toContain('data-primary');
    expect(html).toContain('data-testid="focus-writing-close"');
    expect(html).toContain(de('focus.write.keys'));
    expect((html.match(/data-primary="true"/g) ?? []).length).toBe(1);
  });

  it('with a change: save primary and open, no hand-over', () => {
    const html = render(question(), { text: 'Ein neuer Text.' });
    expect(buttonTag(html, 'focus-save')).toContain('data-primary="true"');
    expect(buttonTag(html, 'focus-save')).toContain('aria-disabled="false"');
    expect(html).not.toContain('focus-writing-submit');
    expect(html).not.toContain('focus-writing-forward');
  });

  it('the reading time carries its seconds, from the preview (a list counts no bullet)', () => {
    const html = render(question(), { text: 'eins zwei drei' });
    expect(html).toMatch(/data-testid="focus-reading-time"[^>]*data-seconds="2"/);
    const words = Array.from({ length: 131 }, (_, i) => `w${i}`);
    const list: AnswerBodyInput = { blocks: [{ type: 'list', items: words.map((w) => [{ text: ` ${w} `, marks: ['bold'] }]) }] };
    expect(render(question(), { body: list })).toMatch(/data-testid="focus-reading-time"[^>]*data-seconds="61"/);
  });

  it('a mark alone makes the draft dirty: save open', () => {
    const bold: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: [{ text: version(1).text, marks: ['bold'] }] }] };
    expect(buttonTag(render(question(), { body: bold }), 'focus-save')).toContain('aria-disabled="false"');
  });

  it('the notice of a newer version when rebase is set', () => {
    expect(render(question(), { text: 'mein Text', rebase: true })).toContain(de('focus.write.rebase'));
    expect(render(question())).not.toContain(de('focus.write.rebase'));
  });

  it('the approval hint only with an approval (R-GUARD-04)', () => {
    expect(render(question())).not.toContain('focus-approval-hint');
    const approved = question({ approval: { answerVersion: 1, approvedAt: '2026-06-15T10:10:00.000Z', approvedBy: { id: 'u-2', role: 'approver' } } });
    expect(render(approved)).toContain(de('answers.editor.hint'));
  });
});
