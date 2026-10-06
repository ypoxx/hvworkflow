/**
 * Scheibe 046, W4: the card of an Einzelfrage carries a neutral badge for its relation. With the referenced id
 * the card resolves the number through `api.getQuestion` ("Nachfrage zu F-0012"); without the id (masked for this
 * reader) it fetches nothing and shows only the relation, as after a 404. Without a relation there is no badge.
 * Rendered statically; the resolution itself is the pure part (`parentToResolve`, `referenceBadgeText`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Question } from '@hv/domain';
import { setLang, translate, type Lang } from '../../i18n';
import { PENDING_NUMBER, QuestionCard, parentToResolve, referenceBadgeText } from './QuestionCard';

const base: Question = {
  id: 'q2', number: 'F-0031', text: 'Und warum?', status: 'captured', meetingId: 'm', contributionId: 'c', speakerId: 's',
  answers: [], version: 2, createdAt: '2027-04-20T10:00:00.000Z', updatedAt: '2027-04-20T10:00:00.000Z', _actions: [],
};
const render = (question: Question) => renderToStaticMarkup(
  <QuestionCard question={question} onClassify={() => undefined} hoveredQuestionId={null} onHoverQuestion={() => undefined} />);

afterEach(() => setLang('de'));

describe.each(['de', 'en'] as Lang[])('W4 QuestionCard reference badge (%s)', (lang) => {
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(lang, key, params); // i18n-ok: a type expression in a test, not a rendered text

  it('"Nachfrage zu F-…" / "Klarstellung zu F-…" once the number is resolved; only the relation without it or after a 404', () => {
    expect(referenceBadgeText(t, 'follow_up', 'F-0012')).toBe(t('capture.relation.follow_up.to', { number: 'F-0012' }));
    expect(referenceBadgeText(t, 'clarification', 'F-0012')).toBe(t('capture.relation.clarification.to', { number: 'F-0012' }));
    expect(referenceBadgeText(t, 'follow_up', null)).toBe(t('capture.relation.follow_up'));
    expect(referenceBadgeText(t, 'clarification', undefined)).toBe(t('capture.relation.clarification'));
  });

  it('a masked reference is never fetched and shows the relation alone; a visible one is fetched by its id', () => {
    setLang(lang);
    expect(parentToResolve({ ...base, relation: 'follow_up' })).toBeUndefined();
    expect(parentToResolve({ ...base, relation: 'follow_up', parentQuestionId: 'q1' })).toBe('q1');
    const html = render({ ...base, relation: 'clarification' });
    expect(html).toContain('data-testid="capture-question-reference"');
    expect(html).toContain(t('capture.relation.clarification'));
  });

  it('without a relation there is no badge', () => {
    setLang(lang);
    expect(parentToResolve(base)).toBeUndefined();
    expect(render(base)).not.toContain('data-testid="capture-question-reference"');
  });
});

/* Design minor 5: the badge keeps its width while the number loads (a placeholder in the number's place). */
describe('W4 QuestionCard badge width while loading', () => {
  it('a visible reference renders the "to" label with a placeholder number until it is resolved', () => {
    setLang('de');
    const html = render({ ...base, relation: 'follow_up', parentQuestionId: 'q1' });
    expect(html).toContain(translate('de', 'capture.relation.follow_up.to', { number: PENDING_NUMBER }));
    expect(html).toContain('aria-busy="true"');
  });
});
