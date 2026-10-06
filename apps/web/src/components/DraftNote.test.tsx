/**
 * Scheibe 060, U8: the three lines of the draft buffer — "in diesem Browser zwischengespeichert", "wiederhergestellt",
 * "nicht möglich". Time in mono, no live region on the kept line, its help through `aria-describedby` (nit N4).
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setLang, translate } from '../i18n';
import { DraftNote } from './DraftNote';

const AT = new Date(2027, 3, 20, 10, 5, 7).getTime();

describe('DraftNote (U8)', () => {
  it('kept: the text, the time with seconds in mono, no aria-live, described by the help sentence', () => {
    setLang('de');
    const html = renderToStaticMarkup(<DraftNote kind="kept" time={AT} />);
    expect(html).toContain('data-testid="draft-kept"');
    expect(html).toContain('<span class="font-mono">10:05:07</span>');
    expect(html).not.toContain('aria-live');
    const describedBy = html.match(/data-testid="draft-kept"[^>]*aria-describedby="([^"]+)"/)?.[1] ?? 'none';
    expect(html).toMatch(new RegExp(`id="${describedBy}"[^>]*>${translate('de', 'common.draft.keptHelp')}<`));
    expect(html).toContain(translate('de', 'common.draft.kept', { time: '' }).split(' · ')[0]);
  });

  it('restored: the text and the time in mono', () => {
    const html = renderToStaticMarkup(<DraftNote kind="restored" time={AT} />);
    expect(html).toContain('data-testid="draft-restored"');
    expect(html).toContain('<span class="font-mono">10:05</span>');
    expect(html).toContain(translate('de', 'common.draft.restored', { time: '' }).trim().split(' ')[0]);
  });

  it('unavailable: the fixed sentence, in both languages', () => {
    expect(renderToStaticMarkup(<DraftNote kind="unavailable" />)).toContain(translate('de', 'common.draft.unavailable'));
    setLang('en');
    expect(renderToStaticMarkup(<DraftNote kind="unavailable" />)).toContain(translate('en', 'common.draft.unavailable'));
    setLang('de');
  });
});
