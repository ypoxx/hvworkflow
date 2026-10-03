/**
 * Scheibe 045, Test 6: the dialog "Verweigerung vorschlagen", rendered statically like `Podium.test.tsx`.
 * A static render cannot choose anything, so the cases with a chosen kind or ground render with
 * `initialForm`, built through `nextRefusalForm` — the same state path as the interface. The kit's
 * `Dialog` renders into a portal, which a static render cannot do; it is replaced here by a frame that
 * renders title, body and footer in place (the dialog itself is unchanged).
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RefusalGround } from '@hv/domain';
import { translate } from '../../i18n';

vi.mock('../../components', async (original) => ({
  ...(await original<typeof import('../../components')>()),
  Dialog: ({ title, description, footer, children }: { title: string; description?: string; footer?: ReactNode; children?: ReactNode }) => (
    <div role="dialog" aria-label={title}>
      <p>{description}</p>
      {children}
      <div data-frame="footer">{footer}</div>
    </div>
  ),
}));

const { RefusalDialog, RefusalProblem } = await import('./RefusalDialog');
const { EMPTY_REFUSAL_FORM, nextRefusalForm } = await import('./refusal');
type RefusalForm = import('./refusal').RefusalForm;

const de = (key: Parameters<typeof translate>[1]) => translate('de', key);

function ground(id: string, verified: boolean): RefusalGround {
  return {
    id, title: `Titel ${id} mit Bedingung`, stageText: `Baustein ${id}.`,
    legalRef: { source: 'AktG', citation: `Zitat ${id}`, docVersion: '1', docHash: null, verified }, hash: `h-${id}`,
  } as RefusalGround;
}
const UNVERIFIED = [ground('g1', false)];
const VERIFIED = [ground('g1', true)];

type Catalogue = { status: 'loading' | 'ready' | 'failed'; grounds: readonly RefusalGround[] };
const ready = (grounds: readonly RefusalGround[]): Catalogue => ({ status: 'ready', grounds });

function render(form: RefusalForm, catalogue: Catalogue = ready(UNVERIFIED)): string {
  return renderToStaticMarkup(
    <RefusalDialog catalogue={catalogue} busy={false} onClose={() => undefined} onSubmit={() => undefined} initialForm={form} />,
  );
}
const submitTag = (html: string): string => html.match(/<button[^>]*data-testid="answer-refuse-submit"[^>]*>/)?.[0] ?? '';
const blocked = (html: string): boolean => submitTag(html).includes('aria-disabled="true"');

function steps(catalogue: readonly RefusalGround[], ...events: Parameters<typeof nextRefusalForm>[1][]): RefusalForm {
  return events.reduce((form, event) => nextRefusalForm(form, event, catalogue), EMPTY_REFUSAL_FORM);
}
const withGround = (grounds: readonly RefusalGround[]) =>
  steps(grounds, { type: 'kind', kind: 'refusal_with_ground' }, { type: 'ground', groundId: 'g1' }, { type: 'justification', justification: 'Begründung' });

describe('RefusalDialog (Test 6)', () => {
  it('submitting is blocked without a kind; the radio group has no preselection', () => {
    const html = render(EMPTY_REFUSAL_FORM);
    expect(submitTag(html)).not.toBe('');
    expect(blocked(html)).toBe(true);
    expect(html).not.toContain('checked=""');
    expect(html).toContain(de('answers.refusal.kind.noClaim'));
    expect(html).toContain(de('answers.refusal.kind.withGround'));
  });

  it('refusal_with_ground without a ground is blocked', () => {
    const form = steps(UNVERIFIED, { type: 'kind', kind: 'refusal_with_ground' }, { type: 'text', text: 'W' }, { type: 'justification', justification: 'B' });
    expect(blocked(render(form))).toBe(true);
  });

  it('without a justification it is blocked; with it free', () => {
    const noJustification = steps(UNVERIFIED, { type: 'kind', kind: 'refusal_with_ground' }, { type: 'ground', groundId: 'g1' });
    expect(blocked(render(noJustification))).toBe(true);
    expect(blocked(render(withGround(UNVERIFIED)))).toBe(false);
  });

  it('the marker stands outside the textarea and is linked by aria-describedby', () => {
    const html = render(withGround(UNVERIFIED));
    const textarea = html.match(/<textarea[^>]*data-testid="answer-refuse-text"[^>]*>([^<]*)<\/textarea>/);
    expect(textarea).not.toBeNull();
    expect(textarea![1]).toBe('Baustein g1.');
    expect(textarea![1]).not.toContain(de('answers.refusal.text.marker'));
    const marker = html.match(/<p[^>]*id="([^"]+)"[^>]*data-testid="answer-refuse-marker"[^>]*>([^<]*)</);
    expect(marker).not.toBeNull();
    expect(marker![2]).toBe(de('answers.refusal.text.marker'));
    expect(textarea![0]).toMatch(new RegExp(`aria-describedby="[^"]*${marker![1]}[^"]*"`));
  });

  it('badge "ungeprüft" and marker with verified: false; neither with verified: true', () => {
    const unverified = render(withGround(UNVERIFIED));
    expect(unverified).toContain('data-testid="answer-refuse-ground-unverified"');
    expect(unverified).toContain('data-testid="answer-refuse-marker"');
    expect(unverified).toContain('Zitat g1');
    const verified = render(withGround(VERIFIED), ready(VERIFIED));
    expect(verified).not.toContain('data-testid="answer-refuse-ground-unverified"');
    expect(verified).not.toContain('data-testid="answer-refuse-marker"');
  });

  it('catalogue loading → loading line; failed → message; refusal_no_claim stays fully usable', () => {
    const groundKind = steps([], { type: 'kind', kind: 'refusal_with_ground' });
    const loading = render(groundKind, { status: 'loading', grounds: [] });
    expect(loading).toContain('data-testid="answer-refuse-ground-loading"');
    expect(loading).toContain(de('answers.refusal.ground.loading'));
    const failed = render(groundKind, { status: 'failed', grounds: [] });
    expect(failed).toMatch(/<p[^>]*role="status"[^>]*data-testid="answer-refuse-ground-failed"/);

    const noClaim = steps([], { type: 'kind', kind: 'refusal_no_claim' }, { type: 'text', text: 'Wortlaut' }, { type: 'justification', justification: 'B' });
    for (const status of ['loading', 'failed'] as const) {
      const html = render(noClaim, { status, grounds: [] });
      expect(html).not.toContain('data-testid="answer-refuse-ground-loading"');
      expect(html).not.toContain('data-testid="answer-refuse-ground"');
      expect(blocked(html)).toBe(false);
    }
  });

  it('refusal_no_claim shows no ground field and no prefill', () => {
    const html = render(steps(UNVERIFIED, { type: 'kind', kind: 'refusal_no_claim' }));
    expect(html).not.toContain('data-testid="answer-refuse-ground"');
    expect(html).not.toContain('data-testid="answer-refuse-marker"');
  });

  it('the messages for 409 R-GUARD-09 and 422 carry role="alert"; the rule id is named', () => {
    const guard = renderToStaticMarkup(<RefusalProblem problem="answers.refusal.error.guard09" />);
    expect(guard).toMatch(/role="alert"/);
    expect(guard).toContain(de('answers.refusal.error.guard09'));
    expect(guard).toContain('R-GUARD-09');
    const invalid = renderToStaticMarkup(<RefusalProblem problem="answers.refusal.error.invalid" />);
    expect(invalid).toMatch(/role="alert"/);
    expect(invalid).toContain(de('answers.refusal.error.invalid'));
  });
});
