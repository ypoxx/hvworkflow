import { describe, expect, it } from 'vitest';
import { parseDemoLog } from './index';

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
});
