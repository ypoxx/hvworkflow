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
      end: 25,
    });
    expect(candidates[1]).toEqual({
      text: 'Ist sie vollständig?',
      start: 26,
      end: 46,
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

  it('two questions: suggest multiple questions separated by period and uppercase', () => {
    const text = 'Wann beginnt die Sitzung? Der CEO eröffnet um 10 Uhr. Was kommt danach?';
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
      start: 56,
      end: 73,
    });
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
