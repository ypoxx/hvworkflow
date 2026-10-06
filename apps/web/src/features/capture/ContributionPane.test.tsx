/**
 * takt-032 (Ziel 2): while a write on the chosen Redebeitrag runs, the pane says so and locks every
 * way to capture with `aria-disabled` (takt-008: focus stays). Rendered statically.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Contribution } from '@hv/domain';
import { setLang, translate, type Lang } from '../../i18n';
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

  it('a Wortmeldung waiting for its new version locks only the input for a further Redebeitrag', () => {
    const html = renderToStaticMarkup(
      <ContributionPane {...props({ submitBusy: true, contribution: undefined, contributions: [] })} />,
    );
    expect(tag(html, 'capture-contribution-pane')).toContain('data-busy="true"');
    expect(tag(html, 'capture-submit')).toContain('aria-disabled="true"');
    const open = renderToStaticMarkup(<ContributionPane {...props({ submitBusy: true })} />);
    expect(tag(open, 'capture-free-add')).not.toContain('aria-disabled="true"');
    expect(tag(open, 'capture-suggest')).not.toContain('aria-disabled="true"');
  });
});

/* Scheibe 046, W3: the button "Nachfrage zu …" with its key, and the chip of a set reference. */
describe.each(['de', 'en'] as Lang[])('ContributionPane follow-up reference (%s)', (lang) => {
  afterEach(() => setLang('de'));
  const ref = { parentQuestionId: 'q-12', number: 'F-0012', relation: 'clarification' as const };

  it('with canCapture: the button with Alt+B; no chip without a reference', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<ContributionPane {...props({ reference: null, onOpenFollowUp: () => undefined, onClearReference: () => undefined })} />);
    expect(tag(html, 'capture-follow-up-open')).toBeDefined();
    expect(html).toContain(translate(lang, 'capture.followUp.open'));
    expect(html).toContain(translate(lang, 'capture.key.b'));
    expect(html).not.toContain('data-testid="capture-follow-up-chip"');
  });

  it('a set reference shows the chip with kind and number and "Bezug entfernen"', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<ContributionPane {...props({ reference: ref, onOpenFollowUp: () => undefined, onClearReference: () => undefined })} />);
    expect(tag(html, 'capture-follow-up-chip')).toBeDefined();
    expect(html).toContain(translate(lang, 'capture.relation.clarification.to', { number: 'F-0012' }));
    expect(tag(html, 'capture-follow-up-remove')).toContain(`aria-label="${translate(lang, 'capture.followUp.remove')}"`); // i18n-ok: expected markup in a test, not a rendered text
  });

  it('without canCapture neither button nor chip', () => {
    setLang(lang);
    const html = renderToStaticMarkup(<ContributionPane {...props({ canCapture: false, reference: ref, onOpenFollowUp: () => undefined, onClearReference: () => undefined })} />);
    expect(html).not.toContain('data-testid="capture-follow-up-open"');
    expect(html).not.toContain('data-testid="capture-follow-up-chip"');
  });
});

