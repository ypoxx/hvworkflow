/**
 * Scheibe 061 (part B), W7: the control desk never reads the device clock. Every age comes from the service or is
 * `max(0, asOf − timestamp)` of the same reading (spec decision 10). The test reads the sources of this folder through
 * Vite's raw import (the web project has no Node types); tests are excluded, because they build fixed dates.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['./*.ts', './*.tsx', '!./*.test.ts', '!./*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const PATTERNS: readonly RegExp[] = [
  /Date\.now\s*\(/,
  /Date\[\s*['"`]now['"`]\s*\]/,
  /new\s+Date\s*\(\s*\)/,
  /new\s+Date\b(?!\s*\()/,
  /(?<!new\s+)\bDate\s*\(\s*\)/,
  /performance\.now\s*\(/,
  /performance\[\s*['"`]now['"`]\s*\]/,
];

describe('W7 no device clock in features/cockpit', () => {
  it('no file of the folder reads the clock of the device', () => {
    const files = Object.entries(SOURCES);
    expect(files.map(([name]) => name)).toContain('./CockpitView.tsx');
    expect(files.length).toBeGreaterThan(3);
    for (const [name, source] of files) {
      for (const pattern of PATTERNS) expect(`${name}: ${pattern.test(source) ? pattern.source : 'clean'}`).toBe(`${name}: clean`);
    }
  });
});
