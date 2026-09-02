import { describe, it, expect } from 'vitest';
import { suggestQuestions, segmentsOf } from './sentences';

describe('suggestQuestions', () => {
  it('plain: suggest simple questions ending with question mark', () => {
    const text = 'Ist die Antwort korrekt? Ist sie vollständig?';
    const uncovered = [{ start: 0, end: text.length }];
    const candidates = suggestQuestions(text, uncovered);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      text: 'Ist die Antwort korrekt?',
      start: 0,
      end: 24,
    });
    expect(candidates[1]).toEqual({
      text: 'Ist sie vollständig?',
      start: 25,
      end: 45,
    });
  });

  it('internal "Mio. EUR": handle abbreviations without breaking sentences', () => {
    const text =
      'Wie hoch war der Investitionsaufwand (in Mio. EUR) im letzten Jahr?';
    const uncovered = [{ start: 0, end: text.length }];
    const candidates = suggestQuestions(text, uncovered);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      text: 'Wie hoch war der Investitionsaufwand (in Mio. EUR) im letzten Jahr?',
      start: 0,
      end: text.length,
    });
  });

  it('two questions: suggest multiple questions separated by question marks', () => {
    const text = 'Wann beginnt die Sitzung? Was kommt danach?';
    const uncovered = [{ start: 0, end: text.length }];
    const candidates = suggestQuestions(text, uncovered);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      text: 'Wann beginnt die Sitzung?',
      start: 0,
      end: 25,
    });
    expect(candidates[1]).toEqual({
      text: 'Was kommt danach?',
      start: 26,
      end: 43,
    });
  });
});

describe('suggestQuestions on a dictated speech', () => {
  it('starts each candidate after the previous sentence or connective, keeps abbreviations and ordinals', () => {
    const text =
      'Sehr geehrte Damen und Herren, ich danke dem Vorstand für den Bericht. Meine erste Frage: ' +
      'Wie hoch war der Aufwand (in Mio. EUR) im 3. Quartal? Zweitens: Wann rechnet die Gesellschaft, z. B. bis Nr. 4, mit einer Entscheidung? Vielen Dank.';
    const candidates = suggestQuestions(text, [{ start: 0, end: text.length }]);
    expect(candidates.map((c) => c.text)).toEqual([
      'Wie hoch war der Aufwand (in Mio. EUR) im 3. Quartal?',
      'Wann rechnet die Gesellschaft, z. B. bis Nr. 4, mit einer Entscheidung?',
    ]);
    for (const c of candidates) expect(text.slice(c.start, c.end)).toBe(c.text);
  });
  it('only proposes inside uncovered spans', () => {
    const text = 'Erste Frage? Zweite Frage bitte?';
    const candidates = suggestQuestions(text, [{ start: 13, end: text.length }]);
    expect(candidates.map((c) => c.text)).toEqual(['Zweite Frage bitte?']);
  });
});

describe('segmentsOf', () => {
  it('compute coverage segments for highlighting', () => {
    const textLength = 20;
    const uncovered = [
      { start: 2, end: 5 },
      { start: 10, end: 15 },
    ];
    const segments = segmentsOf(textLength, uncovered);

    expect(segments).toEqual([
      { start: 0, end: 2, covered: true },
      { start: 2, end: 5, covered: false },
      { start: 5, end: 10, covered: true },
      { start: 10, end: 15, covered: false },
      { start: 15, end: 20, covered: true },
    ]);
  });
});
