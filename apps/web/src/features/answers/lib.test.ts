/**
 * `wordDiff` — the word-level diff behind "Änderung gegenüber Version n-1" (slice 007, point 3).
 */
import { describe, expect, it } from 'vitest';
import { wordDiff } from './lib';

describe('wordDiff', () => {
  it('identical texts yield only equal parts', () => {
    const text = 'Die Ausschüttungsquote lag bei 47 Prozent.';
    expect(wordDiff(text, text)).toEqual([{ type: 'equal', text }]);
  });

  it('an insertion adds a part without touching what was already there', () => {
    const a = 'Die Quote lag bei 47 Prozent.';
    const b = 'Die Quote lag bei 47 Prozent. Beleg: Geschäftsbericht Seite 42.';
    expect(wordDiff(a, b)).toEqual([
      { type: 'equal', text: 'Die Quote lag bei 47 Prozent.' },
      { type: 'added', text: 'Beleg: Geschäftsbericht Seite 42.' },
    ]);
  });

  it('a replacement removes the old words and adds the new ones', () => {
    const a = 'Die Quote lag bei 40 Prozent.';
    const b = 'Die Quote lag bei 47 Prozent.';
    expect(wordDiff(a, b)).toEqual([
      { type: 'equal', text: 'Die Quote lag bei' },
      { type: 'removed', text: '40' },
      { type: 'added', text: '47' },
      { type: 'equal', text: 'Prozent.' },
    ]);
  });
});
