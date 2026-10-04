/**
 * Scheibe 054, Test 7: the writing mode, rendered statically. The field holds the text the page gives it (prefilled
 * with the latest version, empty with the refusal hint when the latest version is a refusal — `newDraft`); saving is
 * locked (`aria-disabled`) without a change; the reading time carries its seconds; the keys are named; the action bar
 * follows `focusActions`; the notice of a newer version stands when `rebase` is set.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerVersion, Permission, Question } from '@hv/domain';
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

function render(q: Question, opts: { text?: string; rebase?: boolean } = {}): string {
  const draft = newDraft('u-1', q);
  const text = opts.text ?? draft.text;
  return renderToStaticMarkup(
    <WritingMode
      question={q}
      text={text}
      sources={draft.sources}
      dirty={isDirty({ ...draft, text })}
      busy={false}
      rebase={opts.rebase ?? false}
      stale={false}
      dialogOpen={false}
      onText={() => undefined}
      onSources={() => undefined}
      onAction={() => undefined}
      onClose={() => undefined}
      onRebase={() => undefined}
      onStaleReload={() => undefined}
    />,
  );
}

const buttonTag = (html: string, id: string): string => html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '';

describe('WritingMode (Test 7)', () => {
  it('the field is prefilled with the latest version; the question stands above it', () => {
    const html = render(question());
    const latest = version(1).text.replace('.', '\\.');
    expect(html).toMatch(new RegExp(`<textarea[^>]*data-testid="focus-editor"[^>]*>${latest}</textarea>`));
    expect(html.indexOf('data-testid="focus-writing-question"')).toBeLessThan(html.indexOf('data-testid="focus-editor"'));
    expect(html).not.toContain('focus-refusal-hint');
  });

  it('empty with the refusal hint when the latest version is a refusal', () => {
    const html = render(question({ answers: [version(1, { answerKind: 'refusal_no_claim', text: 'Kein Bezug' })] }));
    expect(html).toMatch(/<textarea[^>]*data-testid="focus-editor"[^>]*><\/textarea>/);
    expect(html).toContain('data-testid="focus-refusal-hint"');
    expect(html).toContain(de('answers.refusal.editorHint'));
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

  it('the reading time carries its seconds', () => {
    const html = render(question(), { text: 'eins zwei drei' });
    expect(html).toMatch(/data-testid="focus-reading-time"[^>]*data-seconds="2"/);
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
