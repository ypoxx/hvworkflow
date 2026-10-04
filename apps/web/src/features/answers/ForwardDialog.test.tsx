/**
 * Scheibe 053, Test 6: the dialog "An anderen Fachbereich weiterleiten", rendered statically like 045's Test 6. The
 * kit's `Dialog` renders into a portal, which a static render cannot do; it is replaced by a frame that renders title,
 * description, children and footer in place (the dialog itself is unchanged). Cases with a chosen target or reason
 * render with `initialForm`, which the pages never pass.
 *
 * What it proves: no target and no reason preselected; the current unit is not offered; the four closed reasons with
 * their labels; no text field anywhere (048 decision 4); the note on who reads afterwards is a `role="note"` linked to
 * the choice; submitting stays locked until both are chosen; the dialog's own messages are alerts with the rule id.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Unit } from '@hv/domain';
import { actionLabel, translate } from '../../i18n';
import { forwardReasonLabel } from '../../i18n/labels';
import type { TKey } from '../../i18n';

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

const { ForwardDialog, ForwardProblem } = await import('./ForwardDialog');
const { EMPTY_FORWARD_FORM } = await import('./forward');
type ForwardForm = import('./forward').ForwardForm;

const de = (key: TKey) => translate('de', key);
const t = (key: TKey) => translate('de', key);

const UNITS: readonly Unit[] = [
  { id: 'unit-fin', name: 'Finanzen und Controlling', shortName: 'Finanzen' },
  { id: 'unit-ops', name: 'Operations und Technik', shortName: 'Operations' },
  { id: 'unit-ar', name: 'Büro des Aufsichtsrats', shortName: 'AR-Büro' },
];

function render(form: ForwardForm = EMPTY_FORWARD_FORM, current: string | null = 'unit-ops'): string {
  const unitId = current ?? undefined;
  return renderToStaticMarkup(
    <ForwardDialog
      question={{ number: 'F-0111', ...(unitId !== undefined ? { unitId } : {}) }}
      units={UNITS}
      busy={false}
      onClose={() => undefined}
      onSubmit={() => undefined}
      initialForm={form}
    />,
  );
}
/** The text of the element carrying `data-testid` (a static render puts plain text between its tags). */
const textOf = (html: string, testId: string): string | undefined =>
  html.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`))?.[1];
/** One attribute of a tag, read without writing the attribute literally into this file. */
const attr = (tag: string, name: string): string | undefined => tag.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
const submitTag = (html: string): string => html.match(/<button[^>]*data-testid="forward-submit"[^>]*>/)?.[0] ?? '';
const blocked = (html: string): boolean => submitTag(html).includes('aria-disabled="true"');
function optionValues(html: string): string[] {
  const start = html.indexOf('data-testid="forward-unit"');
  const select = start < 0 ? '' : html.slice(start, html.indexOf('</select>', start));
  return [...select.matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) => match[1] ?? '');
}

describe('ForwardDialog (Test 6)', () => {
  it('title and submit name the step in the house wording', () => {
    const html = render();
    expect(attr(html.match(/<div[^>]*role="dialog"[^>]*>/)?.[0] ?? '', 'aria-label')).toBe(actionLabel(t, 'question.forward'));
    expect(html).toContain(de('answers.forward.body'));
    expect(submitTag(html)).not.toBe('');
  });

  it('submitting is locked without a target and without a reason', () => {
    expect(blocked(render())).toBe(true);
    expect(blocked(render({ unitId: 'unit-ar', reasonCode: undefined }))).toBe(true);
    expect(blocked(render({ unitId: undefined, reasonCode: 'capacity' }))).toBe(true);
    expect(blocked(render({ unitId: 'unit-ar', reasonCode: 'capacity' }))).toBe(false);
  });

  it('the current unit is shown as text and is not among the targets; no target is preselected', () => {
    const html = render();
    expect(html).toContain(de('answers.detail.unit'));
    expect(textOf(html, 'forward-current-unit')).toBe(UNITS[1]?.shortName);
    expect(optionValues(html)).toEqual(['', 'unit-fin', 'unit-ar']);
    // Only the placeholder (value "") is selected; no unit is.
    expect(html).not.toMatch(/<option[^>]*value="unit-[^"]*"[^>]*selected/);
    expect(html).toMatch(/<option value="" selected="">/);
    expect(html).toContain(de('answers.forward.unit.placeholder'));
  });

  it('without a current unit every unit is offered and "keine" stands as the current one', () => {
    const html = render(EMPTY_FORWARD_FORM, null);
    expect(optionValues(html)).toEqual(['', 'unit-fin', 'unit-ops', 'unit-ar']);
    expect(html).toContain(de('common.none'));
  });

  it('four reasons with the labels of forwardReasonLabel, none checked', () => {
    const html = render();
    for (const code of ['wrong_unit', 'expertise_elsewhere', 'capacity', 'other']) {
      expect(html).toContain(`data-testid="forward-reason-${code}"`);
      expect(html).toContain(forwardReasonLabel(t, code));
    }
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    expect(html).not.toContain('checked=""');
  });

  it('a chosen reason is checked, a chosen target selected', () => {
    const html = render({ unitId: 'unit-ar', reasonCode: 'expertise_elsewhere' });
    expect(html).toMatch(/<input[^>]*checked=""[^>]*data-testid="forward-reason-expertise_elsewhere"|data-testid="forward-reason-expertise_elsewhere"[^>]*checked=""/);
    expect(html).toMatch(/<option[^>]*value="unit-ar"[^>]*selected=""|<option[^>]*selected=""[^>]*value="unit-ar"/);
  });

  it('has no textarea and no text input — not even for "Sonstiges"', () => {
    for (const html of [render(), render({ unitId: 'unit-ar', reasonCode: 'other' })]) {
      expect(html).not.toContain('<textarea');
      expect(html).not.toMatch(/<input(?![^>]*type="radio")[^>]*>/);
    }
  });

  it('the note on who reads afterwards is a role="note" linked to the choice by aria-describedby', () => {
    const html = render();
    const noteTag = html.match(/<p[^>]*role="note"[^>]*>/)?.[0] ?? '';
    const id = noteTag.match(/ id="([^"]+)"/)?.[1] ?? '';
    expect(id).not.toBe('');
    expect(html).toContain(de('answers.forward.readers'));
    const select = html.match(/<select[^>]*data-testid="forward-unit"[^>]*>/)?.[0] ?? '';
    expect(select).toContain(`aria-describedby="${id}"`);
    const group = html.match(/<div[^>]*role="radiogroup"[^>]*>/)?.[0] ?? '';
    expect(group).toContain(`aria-describedby="${id}"`);
  });

  it('its own messages are alerts; guard15 names its rule id', () => {
    const guard = renderToStaticMarkup(<ForwardProblem problem="guard15" />);
    expect(guard).toContain('role="alert"');
    expect(guard).toContain('data-testid="forward-problem"');
    expect(guard).toContain(de('answers.forward.error.guard15'));
    expect(guard).toContain('R-GUARD-15');
    const invalid = renderToStaticMarkup(<ForwardProblem problem="invalid" />);
    expect(invalid).toContain('role="alert"');
    expect(invalid).toContain(de('answers.forward.error.invalid'));
  });
});
