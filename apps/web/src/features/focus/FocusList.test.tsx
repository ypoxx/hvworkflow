/**
 * Scheibe 054, Test 5: the list of "Meine Fragen", rendered statically. A listbox with the active row, the attributes
 * the e2e waits on, the wording over two lines, "Zurückgegeben" only with a return reason, the age from `relativeAge`;
 * no agenda item, no clock time, no filter or search; the states loading, failed and empty.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerVersion, Question } from '@hv/domain';
import { translate } from '../../i18n';
import type { TKey } from '../../i18n';
import { relativeAge } from '../answers/lib';
import { FocusList } from './FocusList';
import type { FocusListState } from './FocusList';

const NOW = Date.parse('2026-06-15T10:30:00.000Z');
const de = (key: TKey, params?: Record<string, string | number>) => translate('de', key, params);

function question(over: Partial<Question> = {}): Question {
  return {
    id: 'q-1', number: 'F-0101', contributionId: 'c-1', speakerId: 's-1', speakerDisplayName: 'Redner 15',
    text: 'Wie hoch ist die Dividende?', status: 'assigned', unitId: 'unit-fin', agendaItemId: 'top-2', answers: [], version: 3,
    createdAt: '2026-06-15T10:18:00.000Z', updatedAt: '2026-06-15T10:18:00.000Z', _actions: ['answer.draft', 'question.forward'],
    ...over,
  };
}

const refusal: AnswerVersion = {
  version: 1, text: 'Verweigert', createdAt: '2026-06-15T10:20:00.000Z', createdBy: { id: 'u-1', role: 'legal' }, answerKind: 'refusal_no_claim',
};

const ITEMS: readonly Question[] = [
  question(),
  question({ id: 'q-2', number: 'F-0102', status: 'answer_drafted', returnReason: 'Bitte Zahl prüfen', createdAt: '2026-06-15T10:20:00.000Z' }),
  question({ id: 'q-3', number: 'F-0103', status: 'answer_drafted', answers: [refusal], createdAt: '2026-06-15T10:21:00.000Z' }),
];

function render(items: readonly Question[], state: FocusListState = 'ready', selectedId: string | null = 'q-2'): string {
  return renderToStaticMarkup(
    <FocusList items={items} state={state} selectedId={selectedId} now={NOW} onSelect={() => undefined} onOpen={() => undefined} onRetry={() => undefined} />,
  );
}

const rows = (html: string): string[] => html.match(/<div[^>]*data-testid="focus-row"[^>]*>/g) ?? [];

describe('FocusList (Test 5)', () => {
  it('is a listbox with aria-activedescendant on the chosen row', () => {
    const html = render(ITEMS);
    expect(html).toMatch(/<div[^>]*data-testid="focus-list"[^>]*data-state="ready"[^>]*role="listbox"[^>]*tabindex="0"/);
    expect(html).toContain('aria-activedescendant="focus-row-q-2"');
    const labelAttribute = 'aria-label';
    expect(html).toContain(`${labelAttribute}="${de('focus.list.label')}"`);
  });

  it('every row carries number, status, unit, created, and data-returned only with a return reason', () => {
    const all = rows(render(ITEMS));
    expect(all).toHaveLength(3);
    expect(all[0]).toContain('data-number="F-0101"');
    expect(all[0]).toContain('data-status="assigned"');
    expect(all[0]).toContain('data-unit="unit-fin"');
    expect(all[0]).toContain('data-created="2026-06-15T10:18:00.000Z"');
    expect(all[0]).toContain('role="option"');
    expect(all[0]).not.toContain('data-returned');
    expect(all[1]).toContain('data-returned="true"');
    expect(all[1]).toContain('aria-selected="true"');
    for (const row of all) expect(row).toContain('select-none');
  });

  it('the wording over two lines, "Zurückgegeben" and the refusal badge only where they apply', () => {
    const html = render(ITEMS);
    expect(html.match(/data-testid="focus-row-text"[^>]*class="[^"]*line-clamp-2/g)).toHaveLength(3);
    expect(html.match(/data-testid="focus-row-returned"/g)).toHaveLength(1);
    expect(html).toContain(de('answers.detail.returned'));
    expect(html.match(/data-testid="focus-row-refusal"/g)).toHaveLength(1);
  });

  it('no agenda item, no clock time, the age from relativeAge; no filter or search', () => {
    const html = render(ITEMS);
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(text).not.toMatch(/\d{2}:\d{2}/);
    expect(text).not.toContain('TOP');
    expect(html).toContain(relativeAge((key, params) => de(key, params), ITEMS[0]!.createdAt, NOW));
    expect(html).toContain('vor 12 min');
    expect(html).not.toMatch(/answers-filter|answers-search|type="search"|<select/);
    expect(html).toContain(de('focus.list.count', { n: 3 }));
    // The speaker's name stands in the detail, never beside the text in the list.
    expect(html).not.toContain('Redner 15');
  });

  it('states: loading (skeleton), failed (retry), empty (focus-empty)', () => {
    const loading = render([], 'loading', null);
    expect(loading).toMatch(/data-testid="focus-list"[^>]*data-state="loading"/);
    expect(loading).toContain('aria-busy="true"');
    const failed = render([], 'failed', null);
    expect(failed).toMatch(/data-testid="focus-list"[^>]*data-state="failed"/);
    expect(failed).toContain(de('common.retry'));
    const empty = render([], 'ready', null);
    expect(empty).toMatch(/data-testid="focus-empty"[^>]*role="status"/);
    expect(empty).toContain(de('focus.empty.title'));
    expect(empty).toContain(de('focus.empty.body'));
    expect(empty).not.toContain('role="listbox"');
  });
});
