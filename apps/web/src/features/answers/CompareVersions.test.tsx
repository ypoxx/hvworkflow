/**
 * Scheibe 060, U5: "Fassungen vergleichen", rendered statically. Both columns, version and time in mono, exactly one
 * primary action, the hint under "übernehmen", the title as focus target (`tabIndex=-1`), the word diff closed and computed
 * only while open (nit N2); the left column renders the input form through `previewAnswer` (nit N1); texts from the
 * dictionary in both languages; Escape returns without leaving the writing mode (`defaultPrevented`).
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnswerBodyInput, AnswerVersion } from '@hv/domain';
import { setLang, translate } from '../../i18n';
import { shouldLeaveWriting } from '../focus/focus';
import { CompareVersions, compareKeyDown } from './CompareVersions';
import * as lib from './lib';

vi.mock('./lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib')>();
  return { ...actual, wordDiff: vi.fn(actual.wordDiff) };
});

const theirs = (n: number, over: Partial<AnswerVersion> = {}): AnswerVersion => ({
  version: n, text: `Fremde Fassung ${n}.`, createdAt: '2027-04-20T10:05:00.000Z',
  createdBy: { id: 'u-legal-1', role: 'legal', displayName: 'Recht Eins' }, sources: ['GB S. 9'], ...over,
});
const mineBody: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: [{ text: 'Meine ' }, { text: 'Fassung', marks: ['bold'] }] }, { type: 'paragraph', content: [] }] };

function render(version = theirs(2), opts: { diffOpen?: boolean } = {}): string {
  return renderToStaticMarkup(
    <CompareVersions
      mine={{ body: mineBody, sources: 'GB S. 4' }}
      theirs={version}
      autoFocus
      onKeepMine={() => undefined}
      onTakeTheirs={() => undefined}
      onBack={() => undefined}
      {...(opts.diffOpen !== undefined ? { initialDiffOpen: opts.diffOpen } : {})}
    />,
  );
}
const tag = (html: string, id: string): string => html.match(new RegExp(`<[a-z0-9]+[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? '';

describe('CompareVersions (U5)', () => {
  it('both columns, the title as focus target, version and time in mono, the hint under "übernehmen"', () => {
    setLang('de');
    const html = render();
    expect(tag(html, 'compare-title')).toContain('tabindex="-1"');
    expect(html).toContain(translate('de', 'answers.compare.title'));
    expect(html).toContain(translate('de', 'answers.compare.intro', { version: 2 }));
    expect(html).toContain('data-testid="compare-mine"');
    expect(html).toContain('data-testid="compare-theirs"');
    expect(html).toMatch(/data-testid="compare-theirs-head"[\s\S]*?<span class="font-mono[^"]*">2<\/span>/);
    expect(html).toMatch(/data-testid="compare-theirs-head"[\s\S]*?<span class="font-mono[^"]*">[0-9]{2}:[0-9]{2}<\/span>/);
    expect(html).toContain('Recht Eins');
    expect(html).toContain(translate('de', 'answers.compare.takeTheirsHint'));
    expect(html).toContain(translate('de', 'answers.compare.keepMine'));
    expect(html).toContain(translate('de', 'answers.compare.takeTheirs', { version: 2 }));
    expect(html).toContain(translate('de', 'answers.compare.back'));
    expect(html).not.toContain('dangerouslySetInnerHTML');
  });

  it('exactly one primary action: "Mit meiner Fassung weiter"', () => {
    const html = render();
    expect((html.match(/bg-accent-600/g) ?? []).length).toBe(1);
    expect(tag(html, 'compare-keep-mine')).toMatch(/bg-accent-600/);
  });

  it('the left column renders the input form through previewAnswer (runs without marks, an empty paragraph)', () => {
    const html = render();
    const [first, second] = ['Meine', 'Fassung'];
    expect(html).toMatch(new RegExp(`data-testid="compare-mine"[\\s\\S]*?<p>${first} <strong>${second}</strong></p>`));
    expect(html).toContain('GB S. 4');
    expect(html).toContain('GB S. 9');
  });

  it('the right column renders the version it is given; the number in the sentence follows', () => {
    const html = render(theirs(3, { text: 'Version drei.' }));
    expect(html).toContain(translate('de', 'answers.compare.intro', { version: 3 }));
    expect(html).toContain('Version drei.');
    expect(html).toContain(translate('de', 'answers.compare.takeTheirs', { version: 3 }));
  });

  it('a refusal as the shown version: empty right column with the hint of today', () => {
    const html = render(theirs(2, { answerKind: 'refusal_no_claim', text: 'Keine Auskunft.' }));
    expect(html).toContain(translate('de', 'answers.refusal.editorHint'));
    expect(html).not.toMatch(/data-testid="compare-theirs"[\s\S]*?Keine Auskunft\./);
  });

  it('English texts from the dictionary', () => {
    setLang('en');
    const html = render();
    expect(html).toContain(translate('en', 'answers.compare.title'));
    expect(html).toContain(translate('en', 'answers.compare.keepMine'));
    expect(html).toContain(translate('en', 'answers.compare.diff'));
    setLang('de');
  });

  it('the diff: closed by default and not computed; open → computed once', () => {
    const spy = vi.mocked(lib.wordDiff);
    spy.mockClear();
    const closed = render();
    expect(tag(closed, 'compare-diff')).not.toContain(' open');
    expect(spy).not.toHaveBeenCalled();
    render(theirs(2), { diffOpen: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Escape: back without a decision, defaultPrevented so the writing mode stays', () => {
    const onBack = vi.fn();
    const event = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    compareKeyDown(event, onBack);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(shouldLeaveWriting({ key: event.key, defaultPrevented: event.defaultPrevented, dialogOpen: false })).toBe(false);
    const other = { key: 'a', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    compareKeyDown(other, onBack);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(other.defaultPrevented).toBe(false);
  });
});
