import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectionStatusView } from './ConnectionStatus';
import { INITIAL_CONNECTION, type ConnectionPhase } from '../api/connection';
import { translate, type Lang, type Translate } from '../i18n';

const tFor = (lang: Lang): Translate => (key, params) => translate(lang, key, params);
// 12:34:56 in Berlin (summer time, UTC+2).
const AS_OF = Date.UTC(2026, 8, 30, 10, 34, 56);
const render = (phase: ConnectionPhase, lang: Lang, demo = false, asOf: number | null = AS_OF) =>
  renderToStaticMarkup(<ConnectionStatusView state={{ ...INITIAL_CONNECTION, phase, asOf: asOf ?? undefined }} demo={demo} t={tFor(lang)} />);

describe('connection indicator (slice 036b)', () => {
  const texts: [ConnectionPhase, string, string][] = [
    ['connecting', 'Verbindung wird aufgebaut', 'Connecting'],
    ['reconnecting', 'Verbindung wird wiederhergestellt', 'Reconnecting'],
    ['polling', 'Rückfall: Aktualisierung alle 30 Sekunden', 'Fallback: updating every 30 seconds'],
    ['offline', 'Keine Verbindung', 'No connection'],
  ];

  it.each(texts)('shows %s in German and English with the time of the data, as a polite status', (phase, de, en) => {
    const german = render(phase, 'de');
    expect(german).toContain(de);
    expect(german).toContain('Stand von 12:34:56');
    expect(german).toContain('role="status"');
    expect(german).toContain('aria-live="polite"');
    // Not colour alone: an icon and the text carry the state.
    expect(german).toContain('<svg');
    const english = render(phase, 'en');
    expect(english).toContain(en);
    expect(english).toContain('As of 12:34:56');
  });

  it('leaves out the time when there is none yet', () => {
    expect(render('connecting', 'de', false, null)).not.toContain('Stand von');
  });

  it('shows nothing while live or idle, only the empty status region', () => {
    for (const phase of ['live', 'idle'] as const) {
      const html = render(phase, 'de');
      expect(html).toContain('role="status"');
      for (const [, de] of texts) expect(html).not.toContain(de);
      expect(html).not.toContain('Stand von');
    }
  });

  it('renders nothing at all in the demo', () => {
    for (const [phase] of texts) expect(render(phase, 'de', true)).toBe('');
  });
});
