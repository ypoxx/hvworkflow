import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginPage, safeReturnTo, safeSummaryUrl } from './LoginPage';

const notice = {
  version: 'v1',
  text: { de: 'Hinweis zum Datenschutz', en: 'Privacy notice' },
  dataProtectionSummaryUrl: 'https://example.org/dsfa',
};

describe('login page', () => {
  it('shows both languages and a safe DSFA link before sign-in', () => {
    const html = renderToStaticMarkup(<LoginPage notice={notice} returnTo="/speakers" onLogin={() => undefined} />);
    expect(html).toContain('Hinweis zum Datenschutz');
    expect(html).toContain('Privacy notice');
    expect(html).toContain('https://example.org/dsfa');
    expect(html).toContain('href="/auth/login?returnTo=%2Fspeakers"');
  });

  it('does not offer sign-in without a complete notice', () => {
    const html = renderToStaticMarkup(<LoginPage notice={null} returnTo="/" onLogin={() => undefined} />);
    expect(html).not.toContain('/auth/login?');
  });

  it('shows the bilingual fallback for malformed and incomplete notice responses', () => {
    for (const payload of [
      { version: 'v1', text: { de: 'Hinweis' } },
      { version: 'v1' },
      { text: { de: 'Hinweis', en: 'Notice' } },
    ]) {
      const html = renderToStaticMarkup(<LoginPage notice={payload as unknown as typeof notice} returnTo="/" onLogin={() => undefined} />);
      expect(html).toContain('Der Transparenzhinweis fehlt oder ist unvollständig.');
      expect(html).toContain('the privacy notice is missing or incomplete.');
      expect(html).not.toContain('/auth/login?');
    }
  });

  it('accepts only local return paths and safe summary links', () => {
    expect(safeReturnTo('/speakers?round=2')).toBe('/speakers?round=2');
    expect(safeReturnTo('//evil.example/path')).toBe('/');
    expect(safeReturnTo('https://evil.example/path')).toBe('/');
    expect(safeReturnTo('/\\evil.example/path')).toBe('/');
    expect(safeSummaryUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeSummaryUrl('https://example.org/dsfa')).toBe('https://example.org/dsfa');
  });
});
