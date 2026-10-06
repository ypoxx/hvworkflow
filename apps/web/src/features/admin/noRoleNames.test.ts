/**
 * Scheibe 041, Test 8 (AGENTS.md R4): rights are data. Every non-test source file of the Verwaltung and the role-card
 * module is read as text; no key of `ROLE_PERMISSIONS` may stand there as a string literal (single, double or back
 * quotes), and no `role ===`/`!==` compares with a literal. The role names come from the data, not from this test.
 */
import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '@hv/domain';

const ROLES = Object.keys(ROLE_PERMISSIONS);

/** The sources as text, through Vite (the web package has no Node types; same way as AnswerText.test.tsx). */
const SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries({
    ...import.meta.glob<string>('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
    ...import.meta.glob<string>('../../api/roleCards.ts', { query: '?raw', import: 'default', eager: true }),
  }).filter(([path]) => !/\.test\.tsx?$/.test(path)),
);

/** Comments may explain the rule in words; only code counts. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const FILES = Object.keys(SOURCES);

describe('no role name in the code of the view (R4)', () => {
  it('scans the expected files', () => {
    expect(ROLES.length).toBeGreaterThan(0);
    expect(FILES).toContain('./Page.tsx');
    expect(FILES).toContain('../../api/roleCards.ts');
    expect(FILES.length).toBeGreaterThan(10);
    expect(FILES.every((file) => !/\.test\.tsx?$/.test(file))).toBe(true);
  });

  it.each(FILES)('%s', (file) => {
    const text = code(SOURCES[file] ?? '');
    for (const role of ROLES) {
      for (const quote of ["'", '"', '`']) {
        expect(text.includes(`${quote}${role}${quote}`), `${role} as a ${quote} literal`).toBe(false);
      }
    }
    expect(text).not.toMatch(/\brole\s*(===|!==|==|!=)\s*['"`]/);
    expect(text).not.toMatch(/['"`]\s*(===|!==|==|!=)\s*[\w.]*\brole\b/);
  });
});
