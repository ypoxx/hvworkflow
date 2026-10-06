/**
 * Scheibe 046, W2: the body of the dialog "Bezug setzen", rendered statically in German and English: the
 * relation preselected as "Nachfrage", the search field "Nummer oder Stichwort", and the four states empty
 * (hint), loading (skeleton rows), no hits and error with "Erneut versuchen"; each hit with its number in mono,
 * an excerpt and its status badge, the active row marked for assistive technology. The delayed search and the
 * arrows are the pure model of followUp.test.ts; focus on open and Escape are e2e E3 (the dialog is a portal).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Question } from '@hv/domain';
import { setLang, translate, type Lang } from '../../i18n';
import { FollowUpPanel, type FollowUpPanelProps } from './FollowUpDialog';

const hit = (n: number, text: string): Question => ({
  id: `q${n}`, number: `F-00${n}`, text, status: 'delivered', meetingId: 'm', contributionId: 'c', speakerId: 's',
  answers: [], version: 1, createdAt: '2027-04-20T10:00:00.000Z', updatedAt: '2027-04-20T10:00:00.000Z', _actions: [],
});

function props(over: Partial<FollowUpPanelProps>): FollowUpPanelProps {
  return {
    relation: 'follow_up', onRelation: () => undefined, query: '', onQuery: () => undefined, state: { kind: 'empty' },
    active: -1, chosenId: null, onChoose: () => undefined, onKeyDown: () => undefined, onRetry: () => undefined,
    ...over,
  };
}

afterEach(() => setLang('de'));

describe.each(['de', 'en'] as Lang[])('W2 FollowUpPanel (%s)', (lang) => {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);

  it('relation preselected "Nachfrage", search field labelled, empty state with the hint', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<FollowUpPanel {...props({})} />);
    const radio = (code: string): string => html.match(new RegExp(`<input[^>]*value="${code}"[^>]*>`))![0];
    expect(radio('follow_up')).toContain('checked=""');
    expect(radio('clarification')).not.toContain('checked=""');
    expect(html).toContain(t('capture.relation.follow_up'));
    expect(html).toContain(t('capture.relation.clarification'));
    expect(html).toContain(t('capture.followUp.search'));
    expect(html).toContain(t('capture.followUp.hint'));
    expect(html).toContain('data-testid="capture-follow-up-search"');
  });

  it('loading: skeleton rows with a status text, no hits', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<FollowUpPanel {...props({ query: 'F-0012', state: { kind: 'loading', query: 'F-0012' } })} />);
    expect(html).toContain(t('capture.followUp.loading'));
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-testid="capture-follow-up-hit"');
  });

  it('hits: number in mono, excerpt, status badge; the active row is aria-selected; the chosen row is marked', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<FollowUpPanel {...props({ query: 'Quote', active: 1, chosenId: 'q12',
      state: { kind: 'results', query: 'Quote', items: [hit(12, 'Wie hoch ist die Quote?'), hit(13, 'Und die Dividende?')] } })} />);
    expect(html.match(/data-testid="capture-follow-up-hit"/g)).toHaveLength(2);
    expect(html).toMatch(/font-mono[^>]*>F-0012</); // i18n-ok: expected markup in a test, not a rendered text
    expect(html).toContain('Wie hoch ist die Quote?');
    expect(html).toContain(translate(lang, 'status.delivered'));
    expect(html).toMatch(/aria-selected="true"[^>]*data-number="F-0013"|data-number="F-0013"[^>]*aria-selected="true"/);
    expect(html).toMatch(/data-chosen="true"[^>]*data-number="F-0012"|data-number="F-0012"[^>]*data-chosen="true"/);
  });

  it('no hits and error with "Erneut versuchen"', () => {
    setLang(lang);
    expect(renderToStaticMarkup(<FollowUpPanel {...props({ query: 'x', state: { kind: 'none', query: 'x' } })} />))
      .toContain(t('capture.followUp.none'));
    const error = renderToStaticMarkup(<FollowUpPanel {...props({ query: 'x', state: { kind: 'error', query: 'x' } })} />);
    expect(error).toContain(t('capture.followUp.error'));
    expect(error).toContain(t('common.retry'));
    expect(error).toContain('data-testid="capture-follow-up-retry"');
  });
});
