/**
 * Scheibe 055b, Test 5: the re-export of the core's answer format for the interface. A preview only, never an
 * authority: `previewText` is what the write variant's plain text would be for every input the write variant accepts,
 * and the preview never throws where the write variant would answer 422 (the core decides, the door shows it).
 */
import { describe, expect, it } from 'vitest';
import { answerPlainText, normalizeAnswerBodyForWrite } from '@hv/domain';
import type { AnswerBody, AnswerBodyInput } from '@hv/domain';
import { answerBodyOf, previewAnswer, previewText, sameBody } from './answerFormat';

const INPUT: AnswerBodyInput = {
  blocks: [
    { type: 'paragraph', content: [{ text: 'Die ' }, { text: 'Dividende', marks: ['bold', 'underline'] }, { text: ' steigt\u202E.' }] },
    { type: 'list', items: [[{ text: 'erstens', marks: ['highlight'] }], [{ text: ' zweitens ' }]] },
    { type: 'heading', content: [{ text: 'Schluss', marks: ['italic', 'strike'] }] },
  ],
};

describe('answerFormat re-export (Test 5)', () => {
  it('previewText equals the plain text of the write variant (list, marks, U+202E, unknown marks)', () => {
    expect(previewText(INPUT)).toBe(answerPlainText(normalizeAnswerBodyForWrite(INPUT)));
    expect(previewText(INPUT)).toBe('Die Dividende steigt.\n\nerstens\nzweitens\n\nSchluss');
  });

  it('previewAnswer equals the write variant for an accepted input', () => {
    expect(previewAnswer(INPUT)).toEqual(normalizeAnswerBodyForWrite(INPUT));
  });

  it('null and white space only give null and an empty text', () => {
    expect(previewAnswer(null)).toBeNull();
    expect(previewText(null)).toBe('');
    const blank: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: [{ text: '  \u00A0 ' }] }] };
    expect(previewAnswer(blank)).toBeNull();
    expect(previewText(blank)).toBe('');
  });

  it('a lone surrogate does not throw in the preview (the core answers 422 when writing)', () => {
    const lone: AnswerBodyInput = { blocks: [{ type: 'paragraph', content: [{ text: 'a\uD800b' }] }] };
    expect(() => normalizeAnswerBodyForWrite(lone)).toThrow();
    expect(() => previewText(lone)).not.toThrow();
    expect(previewText(lone)).toBe('a�b');
  });

  it('answerBodyOf takes the body, without one L from the text', () => {
    const body: AnswerBody = { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'A', marks: ['bold'] }] }] };
    expect(answerBodyOf({ body, text: 'A' })).toBe(body);
    expect(answerBodyOf({ text: 'eins\r\nzwei' })).toEqual({
      language: 'de',
      blocks: [{ type: 'paragraph', content: [{ text: 'eins' }] }, { type: 'paragraph', content: [{ text: 'zwei' }] }],
    });
    expect(answerBodyOf({ text: '   ' })).toBeNull();
  });

  it('sameBody compares the stored form deeply; marks count, absent and empty marks are the same', () => {
    const a: AnswerBody = { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'A' }] }] };
    const b: AnswerBody = { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'A', marks: [] }] }] };
    const bold: AnswerBody = { language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'A', marks: ['bold'] }] }] };
    const list: AnswerBody = { language: 'de', blocks: [{ type: 'list', items: [[{ text: 'A' }]] }] };
    expect(sameBody(a, b)).toBe(true);
    expect(sameBody(a, structuredClone(a))).toBe(true);
    expect(sameBody(a, bold)).toBe(false);
    expect(sameBody(a, list)).toBe(false);
    expect(sameBody(null, null)).toBe(true);
    expect(sameBody(a, null)).toBe(false);
    expect(sameBody(undefined, null)).toBe(true);
  });
});
