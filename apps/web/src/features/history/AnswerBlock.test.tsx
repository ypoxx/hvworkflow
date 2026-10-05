/**
 * Scheibe 055b, Test 6 (history): the answer block of the history shows the latest version of the chosen question
 * through the one renderer — the same markup as on the podium and in the Beantwortung — under "Antwort, Version n";
 * a refusal as latest version carries its badge; without a version there is no block.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerVersion } from '@hv/domain';
import { AnswerText } from '../../components';
import { translate } from '../../i18n';
import { AnswerBlock } from './AnswerBlock';

const at = '2027-04-20T10:00:00.000Z';
const FORMATTED: AnswerVersion = {
  version: 2, text: 'Die Dividende steigt.\n\neins\nzwei', createdAt: at, createdBy: { id: 'u', role: 'expert' },
  body: {
    language: 'de',
    blocks: [
      { type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold'] }, { text: ' steigt.' }] },
      { type: 'list', items: [[{ text: 'eins', marks: ['highlight'] }], [{ text: 'zwei' }]] },
    ],
  },
};
const OLD: AnswerVersion = { version: 1, text: 'Alte Fassung.', createdAt: at, createdBy: { id: 'u', role: 'expert' } };
const answerPart = (html: string): string | undefined =>
  html.match(/<div[^>]*data-answer-text="true"[^>]*>([\s\S]*?)<\/div>/)?.[1]; // i18n-ok: expected markup in a test, not a rendered text

describe('AnswerBlock (Scheibe 055b, Test 6)', () => {
  it('the latest version through the renderer, under "Antwort, Version n"', () => {
    const html = renderToStaticMarkup(<AnswerBlock question={{ answers: [OLD, FORMATTED] }} />);
    expect(html).toContain('data-testid="history-answer"');
    expect(html).toContain(translate('de', 'history.answer.title', { version: 2 }));
    expect(answerPart(html)).toBe(answerPart(renderToStaticMarkup(<AnswerText answer={FORMATTED} />)));
    expect(html).not.toContain('Alte Fassung.');
    expect(html).not.toContain(translate('de', 'answers.refusal.badge'));
  });

  it('a refusal as latest version carries the badge; its justification is never shown', () => {
    const refusal: AnswerVersion = { ...OLD, version: 3, answerKind: 'refusal_no_claim', text: 'Keine Auskunft.', refusalJustification: 'GEHEIM 055b' };
    const html = renderToStaticMarkup(<AnswerBlock question={{ answers: [FORMATTED, refusal] }} />);
    expect(html).toContain(translate('de', 'answers.refusal.badge'));
    expect(html).toContain('Keine Auskunft.');
    expect(html).not.toContain('GEHEIM 055b');
  });

  it('no block without a version or without a question', () => {
    expect(renderToStaticMarkup(<AnswerBlock question={{ answers: [] }} />)).toBe('');
    expect(renderToStaticMarkup(<AnswerBlock question={null} />)).toBe('');
  });
});
