import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoLogParseError, parseDemoLog } from './index';
import { BootFailure } from '../app/BootScreen';
import { setLang } from '../i18n';
import { createElement } from 'react';

describe('takt-028: demo log parse errors carry no raw content', () => {
  it('maps a JSON syntax error to a fixed text without the raw excerpt', () => {
    let message = '';
    try { parseDemoLog('[{"name":"RAW-MARKER-Erika", oops'); } catch (error) { message = (error as Error).message; }
    expect(message).toBe('Demo event log is not valid JSON.');
    expect(message).not.toContain('RAW-MARKER');
  });
  it('still rejects a non-array and accepts an empty array', () => {
    expect(() => parseDemoLog('{"a":1}')).toThrow('Demo event log is not an array.');
    expect(parseDemoLog('[]')).toEqual([]);
  });
  it('shows the boot failure for an unreadable log in the chosen language, not the English literal', () => {
    const render = () => renderToStaticMarkup(createElement(BootFailure,
      { error: new DemoLogParseError(), legacy: false, onRetry: () => undefined, onReset: () => undefined }));
    setLang('de');
    expect(render()).toContain('kein gültiges JSON');
    expect(render()).not.toContain('is not valid JSON');
    setLang('en');
    expect(render()).toContain('The stored demo event log is not valid JSON.');
    setLang('de');
  });
});
