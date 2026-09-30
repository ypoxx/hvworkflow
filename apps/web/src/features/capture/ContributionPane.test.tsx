/**
 * takt-032 (Ziel 2): while a write on the chosen Redebeitrag runs, the pane says so and locks every
 * way to capture with `aria-disabled` (takt-008: focus stays). Rendered statically.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Contribution } from '@hv/domain';
import { ContributionPane } from './ContributionPane';
import type { ContributionPaneProps } from './ContributionPane';

const contribution: Contribution = {
  id: 'c1', version: 2, speakerId: 's1', text: 'Eine Frage zur Dividende. Eine zweite Frage.',
  capturedAt: '2026-09-30T08:00:00.000Z', source: 'manual', questionIds: [],
  coverage: { coveredRatio: 0, uncovered: [{ start: 0, end: 20 }] },
};

function props(over: Partial<ContributionPaneProps>): ContributionPaneProps {
  return {
    speakers: [], speakerId: 's1', onSelectSpeaker: () => undefined, contributions: [contribution], contribution,
    onSelectContribution: () => undefined, loading: false, failed: false, onRetry: () => undefined, stale: false,
    onReloadStale: () => undefined, canCapture: true, writing: false, busy: false,
    onWrite: async () => true, onCaptureQuestions: async () => true, onOpenSuggest: () => undefined,
    questions: [], hoveredQuestionId: null, onHoverQuestion: () => undefined,
    ...over,
  };
}

const tag = (html: string, testId: string): string => {
  const found = html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`));
  expect(found, testId).not.toBeNull();
  return found![0];
};

describe('ContributionPane busy', () => {
  it('signals busy at the pane and locks free entry and suggestion with aria-disabled', () => {
    const html = renderToStaticMarkup(<ContributionPane {...props({ busy: true })} />);
    const pane = tag(html, 'capture-contribution-pane');
    expect(pane).toContain('data-busy="true"');
    expect(pane).toContain('aria-busy="true"');
    for (const id of ['capture-free-add', 'capture-suggest']) {
      expect(tag(html, id), id).toContain('aria-disabled="true"');
    }
  });

  it('locks the submit button of a new Redebeitrag the same way', () => {
    const html = renderToStaticMarkup(
      <ContributionPane {...props({ busy: true, contribution: undefined, contributions: [] })} />,
    );
    expect(tag(html, 'capture-contribution-pane')).toContain('data-busy="true"');
    expect(tag(html, 'capture-submit')).toContain('aria-disabled="true"');
  });

  it('is as before without a running write', () => {
    const html = renderToStaticMarkup(<ContributionPane {...props({})} />);
    const pane = tag(html, 'capture-contribution-pane');
    expect(pane).not.toContain('data-busy="true"');
    expect(pane).not.toContain('aria-busy="true"');
    for (const id of ['capture-free-add', 'capture-suggest']) {
      expect(tag(html, id), id).not.toContain('aria-disabled="true"');
    }
  });
});
