/**
 * Scheibe 046, W5: the block "Bezug" in the history. The referenced question with number, excerpt and status and,
 * only when the field stands, "bezieht sich auf die vorgelesene Antwortversion N"; a masked reference as "Nachfrage
 * zu einer nicht sichtbaren Frage", without number, link or fetch; the direct follow-ups and clarifications; no block
 * without relation and without children; a loading state of fixed height; an error with "Erneut versuchen".
 * Rendered statically through the view; what the block fetches is the pure part (`threadReads`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Question } from '@hv/domain';
import { setLang, translate, type Lang } from '../../i18n';
import { ThreadBlockView, threadReads, type ThreadBlockViewProps } from './ThreadBlock';

const q = (over: Partial<Question>): Question => ({
  id: 'q', number: 'F-0001', text: 'Text', status: 'captured', meetingId: 'm', contributionId: 'c', speakerId: 's',
  answers: [], version: 1, createdAt: '2027-04-20T10:00:00.000Z', updatedAt: '2027-04-20T10:00:00.000Z', _actions: [], ...over,
});
const PARENT = q({ id: 'p', number: 'F-0012', text: 'Wie hoch ist die Quote?', status: 'delivered' });
const CHILD = q({ id: 'k', number: 'F-0031', text: 'Und warum?', relation: 'follow_up', parentQuestionId: 'p', parentAnswerVersion: 2 });

function props(over: Partial<ThreadBlockViewProps>): ThreadBlockViewProps {
  return { question: CHILD, parent: { kind: 'ready', value: PARENT }, children: { kind: 'ready', value: [] }, onOpen: () => undefined, onRetry: () => undefined, ...over };
}

afterEach(() => setLang('de'));

describe.each(['de', 'en'] as Lang[])('W5 ThreadBlock (%s)', (lang) => {
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params); // i18n-ok: a type expression in a test, not a rendered text

  it('the parent with relation, number, excerpt, status and the read-out answer version in mono', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<ThreadBlockView {...props({})} />);
    expect(html).toContain('data-testid="history-thread"');
    expect(html).toContain(t('history.thread.title'));
    expect(html).toContain(t('capture.relation.follow_up.to', { number: 'F-0012' }));
    expect(html).toContain('Wie hoch ist die Quote?');
    expect(html).toContain(t('status.delivered'));
    expect(html).toContain(t('history.thread.answerVersion'));
    expect(html).toMatch(/font-mono[^>]*>2</);
    expect(html).toContain('data-testid="history-thread-parent"');
  });

  it('without parentAnswerVersion no addition at all', () => {
    setLang(lang);
    const { parentAnswerVersion: _drop, ...noVersion } = CHILD;
    const html = renderToStaticMarkup(<ThreadBlockView {...props({ question: noVersion })} />);
    expect(html).not.toContain(t('history.thread.answerVersion'));
  });

  it('a masked reference: "nicht sichtbare Frage", no number, no link; nothing is fetched for it', () => {
    setLang(lang);
    const { parentQuestionId: _id, parentAnswerVersion: _v, ...masked } = CHILD;
    expect(threadReads(masked)).toEqual({ parentId: undefined, childrenOf: 'k' });
    const html = renderToStaticMarkup(<ThreadBlockView {...props({ question: masked, parent: { kind: 'none' } })} />);
    expect(html).toContain(t('history.thread.hidden.follow_up'));
    expect(html).not.toContain('F-0012');
    expect(html).not.toContain('data-testid="history-thread-parent"');
    const clar = renderToStaticMarkup(<ThreadBlockView {...props({ question: { ...masked, relation: 'clarification' }, parent: { kind: 'none' } })} />);
    expect(clar).toContain(t('history.thread.hidden.clarification'));
  });

  it('the children: count, number, kind, excerpt, status, each opens its question', () => {
    setLang(lang);
    const kids = [q({ id: 'k1', number: 'F-0040', text: 'Erste Nachfrage?', relation: 'follow_up' }),
      q({ id: 'k2', number: 'F-0041', text: 'Eine Klarstellung?', relation: 'clarification', status: 'classified' })];
    const html = renderToStaticMarkup(<ThreadBlockView {...props({ question: PARENT, parent: { kind: 'none' }, children: { kind: 'ready', value: kids } })} />);
    expect(html).toContain(t('history.thread.children', { count: 2 }));
    expect(html.match(/data-testid="history-thread-child"/g)).toHaveLength(2);
    expect(html).toContain('F-0040');
    expect(html).toContain(t('capture.relation.clarification'));
    expect(html).toContain('Eine Klarstellung?');
    expect(html).toContain(t('status.classified'));
    expect(threadReads(PARENT)).toEqual({ parentId: undefined, childrenOf: 'p' });
    expect(threadReads(CHILD)).toEqual({ parentId: 'p', childrenOf: 'k' });
  });

  it('no relation and no children: no block, but only once the children are known', () => {
    setLang(lang);
    expect(renderToStaticMarkup(<ThreadBlockView {...props({ question: PARENT, parent: { kind: 'none' } })} />)).toBe('');
  });

  it('design D6: on the parent side, loading shows a skeleton and an error shows reason and retry (never "no follow-ups")', () => {
    setLang(lang);
    const loading = renderToStaticMarkup(<ThreadBlockView {...props({ question: PARENT, parent: { kind: 'none' }, children: { kind: 'loading' } })} />);
    expect(loading).toContain('data-testid="history-thread-loading"');
    expect(loading).toContain(t('history.thread.loading'));
    expect(loading).not.toContain('bg-ink-50 ');
    expect(loading).toMatch(/bg-ink-(1\d\d|2\d\d)/);
    const error = renderToStaticMarkup(<ThreadBlockView {...props({ question: PARENT, parent: { kind: 'none' }, children: { kind: 'error' } })} />);
    expect(error).toContain(t('history.thread.error'));
    expect(error).toContain('data-testid="history-thread-retry"');
  });

  it('loading: a skeleton of fixed height with a status text; error: reason and retry', () => {
    setLang(lang);
    const loading = renderToStaticMarkup(<ThreadBlockView {...props({ parent: { kind: 'loading' }, children: { kind: 'loading' } })} />);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain(t('history.thread.loading'));
    expect(loading).toMatch(/data-testid="history-thread-loading"[^>]*class="[^"]*h-\d+/);
    const error = renderToStaticMarkup(<ThreadBlockView {...props({ children: { kind: 'error' } })} />);
    expect(error).toContain(t('history.thread.error'));
    expect(error).toContain('data-testid="history-thread-retry"');
    expect(error).toContain(t('common.retry'));
  });
});
