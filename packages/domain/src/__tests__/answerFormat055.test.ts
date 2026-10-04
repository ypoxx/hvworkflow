/**
 * Scheibe 055, Tests 1–5 and 4a: the answer format in the core (ADR 0005), pure functions without clock or I/O.
 * Rule ids in the test names: ADR-0005-N1 … N10 (normalisation), ADR-0005-P (plain-text projection), ADR-0005-L
 * (derivation of a document from the text of an old version). They are rules of the core from ADR 0005, not
 * entries of the rule register.
 */
import { describe, expect, it } from 'vitest';
import {
  ANSWER_BODY_FIELDS,
  ANSWER_BODY_LIMITS,
  ANSWER_MARKS,
  AnswerFormatError,
  answerBodyFromText,
  answerPlainText,
  checkAnswerBodyInput,
  normalizeAnswerBodyForRead,
  normalizeAnswerBodyForWrite,
  projectAnswerBody,
  sanitizeAnswerText,
  type AnswerBody,
  type AnswerInline,
} from '../answerFormat.js';
import { maskEvent } from '../stream.js';
import type { DomainEvent } from '../events.js';
import { GEN_CASES, GEN_SEED, genBodyInput, seededRandom } from './support/answerBodyGen.js';

const write = (input: unknown): AnswerBody => normalizeAnswerBodyForWrite(input);
const read = (input: unknown): AnswerBody | null => normalizeAnswerBodyForRead(input);
const para = (...content: { text: string; marks?: string[] }[]) => ({ type: 'paragraph', content });
const P = (...content: AnswerInline[]) => ({ type: 'paragraph' as const, content });
const body = (...blocks: AnswerBody['blocks']): AnswerBody => ({ language: 'de', blocks });

function writeError(input: unknown): AnswerFormatError {
  try {
    write(input);
  } catch (e) {
    if (e instanceof AnswerFormatError) return e;
    throw e;
  }
  throw new Error('expected an AnswerFormatError');
}

const MARK_ORDER: readonly string[] = ANSWER_MARKS;
const FORBIDDEN_IN_TEXT = /[\p{Cc}\p{Cf}\p{Cs}]|(?! )\p{White_Space}/u;
const FORBIDDEN_IN_PLAIN = /[\p{Cf}\p{Cs}]|(?![ \n])[\p{White_Space}\p{Cc}]/u;

/** Structure check of the stored form, in the test (the check against the contract schema is H5 in the service). */
function structureProblem(b: unknown): string | undefined {
  if (typeof b !== 'object' || b === null || Array.isArray(b)) return 'not an object';
  const doc = b as Record<string, unknown>;
  if (Object.keys(doc).sort().join() !== 'blocks,language') return 'keys of the document';
  if (doc['language'] !== 'de') return 'language';
  const blocks = doc['blocks'];
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > ANSWER_BODY_LIMITS.blocks) return 'blocks';
  const runsProblem = (runs: unknown): string | undefined => {
    if (!Array.isArray(runs) || runs.length < 1 || runs.length > ANSWER_BODY_LIMITS.runs) return 'runs';
    let previous: string | undefined;
    for (const [i, run] of runs.entries()) {
      const r = run as Record<string, unknown>;
      const keys = Object.keys(r).sort().join();
      if (keys !== 'text' && keys !== 'marks,text') return 'keys of a run';
      const text = r['text'];
      if (typeof text !== 'string' || text.length === 0) return 'empty run';
      if (FORBIDDEN_IN_TEXT.test(text)) return `forbidden character in ${JSON.stringify(text)}`;
      if (text !== text.normalize('NFC')) return 'run not in NFC';
      if (/ {2}/.test(text)) return 'double space';
      if (i === 0 && text.startsWith(' ')) return 'leading space';
      if (i === runs.length - 1 && text.endsWith(' ')) return 'trailing space';
      if (i > 0 && text.startsWith(' ') && (runs[i - 1] as { text: string }).text.endsWith(' ')) return 'space across runs';
      const marks = r['marks'];
      if (marks !== undefined) {
        if (!Array.isArray(marks) || marks.length === 0) return 'empty marks';
        if (!marks.every((m) => MARK_ORDER.includes(m as string))) return 'mark outside the whitelist';
        const sorted = [...new Set(marks as string[])].sort((x, y) => MARK_ORDER.indexOf(x) - MARK_ORDER.indexOf(y));
        if (sorted.join() !== (marks as string[]).join()) return 'marks not canonical';
        if (text.trim().length === 0) return 'marks on white space';
      }
      const key = ((marks as string[] | undefined) ?? []).join();
      if (previous === key) return 'adjacent runs with the same marks';
      previous = key;
    }
    return undefined;
  };
  let previousType: unknown;
  for (const block of blocks) {
    const bl = block as Record<string, unknown>;
    if (bl['type'] === 'paragraph') {
      if (Object.keys(bl).sort().join() !== 'content,type') return 'keys of a paragraph';
      const p = runsProblem(bl['content']);
      if (p) return p;
    } else if (bl['type'] === 'list') {
      if (Object.keys(bl).sort().join() !== 'items,type') return 'keys of a list';
      if (previousType === 'list') return 'adjacent lists';
      const items = bl['items'];
      if (!Array.isArray(items) || items.length < 1 || items.length > ANSWER_BODY_LIMITS.items) return 'items';
      for (const item of items) {
        const p = runsProblem(item);
        if (p) return p;
      }
    } else {
      return 'block type outside the whitelist';
    }
    previousType = bl['type'];
  }
  return undefined;
}

describe('Scheibe 055, Test 1: N1–N9, one case each with the exact stored form', () => {
  it('ADR-0005-N1 a: heading becomes a paragraph; table with items one paragraph per item; list with content and items one list', () => {
    expect(write({ blocks: [{ type: 'heading', content: [{ text: 'Titel' }] }] })).toEqual(body(P({ text: 'Titel' })));
    expect(write({ blocks: [{ type: 'table', items: [[{ text: 'A' }], [{ text: 'B' }]] }] }))
      .toEqual(body(P({ text: 'A' }), P({ text: 'B' })));
    expect(write({ blocks: [{ type: 'list', content: [{ text: 'Eins' }], items: [[{ text: 'Zwei' }], [{ text: 'Drei' }]] }] }))
      .toEqual(body({ type: 'list', items: [[{ text: 'Eins' }], [{ text: 'Zwei' }], [{ text: 'Drei' }]] }));
    expect(write({ blocks: [{ type: 'paragraph', content: [{ text: 'X' }], items: [[{ text: 'Y' }]] }] }))
      .toEqual(body(P({ text: 'X' }), P({ text: 'Y' })));
  });

  it('ADR-0005-N2 b: forbidden mark is removed (ADR 0005), the text stays literal; duplicates once, canonical order', () => {
    expect(write({ blocks: [para({ text: 'unter', marks: ['underline'] }, { text: ' strich', marks: ['strike'] },
      { text: ' Arial', marks: ['font-family:Arial'] })] })).toEqual(body(P({ text: 'unter strich Arial' })));
    expect(write({ blocks: [para({ text: 'x', marks: ['italic', 'bold', 'bold'] })] }))
      .toEqual(body(P({ text: 'x', marks: ['bold', 'italic'] })));
    expect(write({ blocks: [para({ text: 'y', marks: ['highlight', 'underline', 'italic'] })] }))
      .toEqual(body(P({ text: 'y', marks: ['italic', 'highlight'] })));
  });

  it('ADR-0005-N3 c: White_Space becomes U+0020 (tab, LF, U+0085, U+00A0, U+2028, U+3000)', () => {
    for (const ws of ['\t', '\n', '\u0085', ' ', ' ', '　']) {
      expect(write({ blocks: [para({ text: `a${ws}b` })] }), JSON.stringify(ws)).toEqual(body(P({ text: 'a b' })));
    }
  });

  it('ADR-0005-N3 c: Cc removed (U+0000, U+001B, U+007F, U+009B)', () => {
    for (const cc of ['\u0000', '\u001B', '\u007F', '\u009B']) {
      expect(write({ blocks: [para({ text: `a${cc}b` })] }), JSON.stringify(cc)).toEqual(body(P({ text: 'ab' })));
    }
  });

  it('ADR-0005-N3 c: Cf removed (U+00AD, U+200B, U+200D, U+202E, U+2066, U+FEFF, U+E0041)', () => {
    for (const cf of ['­', '​', '‍', '‮', '⁦', '﻿', '\u{E0041}']) {
      expect(write({ blocks: [para({ text: `a${cf}b` })] }), JSON.stringify(cf)).toEqual(body(P({ text: 'ab' })));
    }
  });

  it('ADR-0005-N3 c: a lone surrogate is 422 when writing and U+FFFD when reading', () => {
    const input = { blocks: [para({ text: 'a\uD800b' })] };
    const e = writeError(input);
    expect(e.status).toBe(422);
    expect(e.message).not.toContain('a\uD800b');
    expect(read(input)).toEqual(body(P({ text: 'a�b' })));
  });

  it('ADR-0005-N3 c: NFC exact; a combining mark at a run boundary stays split, P composes', () => {
    expect(write({ blocks: [para({ text: 'ä' })] })).toEqual(body(P({ text: 'ä' })));
    expect(write({ blocks: [para({ text: '가' })] })).toEqual(body(P({ text: '가' })));
    const split = write({ blocks: [para({ text: 'e', marks: ['bold'] }, { text: '́x' })] });
    expect(split).toEqual(body(P({ text: 'e', marks: ['bold'] }, { text: '́x' })));
    expect(answerPlainText(split)).toBe('éx');
  });

  it('ADR-0005-N3 c: a family emoji joined with ZWJ becomes three emoji (documented, Nit 6); variation selectors stay', () => {
    expect(write({ blocks: [para({ text: '\u{1F468}‍\u{1F469}‍\u{1F467}' })] }))
      .toEqual(body(P({ text: '\u{1F468}\u{1F469}\u{1F467}' })));
    expect(write({ blocks: [para({ text: '❤️' })] })).toEqual(body(P({ text: '❤️' })));
  });

  it('ADR-0005-N4 d: white space across run boundaries, the space stays in the earlier run', () => {
    expect(write({ blocks: [para({ text: 'Hallo ' }, { text: ' Welt ', marks: ['bold'] }, { text: '  ' })] }))
      .toEqual(body(P({ text: 'Hallo ' }, { text: 'Welt', marks: ['bold'] })));
    expect(write({ blocks: [para({ text: 'a' }, { text: ' ', marks: ['bold'] }, { text: 'b' })] }))
      .toEqual(body(P({ text: 'a b' })));
    expect(write({ blocks: [para({ text: 'a ' }, { text: ' b', marks: ['italic'] })] }))
      .toEqual(body(P({ text: 'a ' }, { text: 'b', marks: ['italic'] })));
    expect(write({ blocks: [para({ text: '  ', marks: ['bold'] }, { text: ' x \t ' }, { text: ' ', marks: ['italic'] })] }))
      .toEqual(body(P({ text: 'x' })));
  });

  it('ADR-0005-N5 e: empty runs fall away, runs with the same marks merge', () => {
    expect(write({ blocks: [para({ text: '' }, { text: 'a', marks: ['bold'] }, { text: '', marks: ['italic'] },
      { text: 'b', marks: ['bold', 'bold'] }, { text: 'c' })] }))
      .toEqual(body(P({ text: 'ab', marks: ['bold'] }, { text: 'c' })));
  });

  it('ADR-0005-N6 f: empty paragraphs, empty items and an empty list fall away', () => {
    expect(write({ blocks: [para(), para({ text: ' ​ ' }), para({ text: 'Text' }),
      { type: 'list', items: [[], [{ text: '' }], [{ text: 'Punkt' }]] }, { type: 'list', items: [[{ text: '\t' }]] }] }))
      .toEqual(body(P({ text: 'Text' }), { type: 'list', items: [[{ text: 'Punkt' }]] }));
  });

  it('ADR-0005-N7 g: two adjacent lists become one, lists separated by a paragraph stay two', () => {
    expect(write({ blocks: [{ type: 'list', items: [[{ text: 'a' }]] }, { type: 'ol', items: [[{ text: '' }]] },
      { type: 'list', items: [[{ text: 'b' }]] }] }))
      .toEqual(body({ type: 'list', items: [[{ text: 'a' }], [{ text: 'b' }]] }));
    expect(write({ blocks: [{ type: 'list', items: [[{ text: 'a' }]] }, para({ text: 'x' }), { type: 'list', items: [[{ text: 'b' }]] }] }))
      .toEqual(body({ type: 'list', items: [[{ text: 'a' }]] }, P({ text: 'x' }), { type: 'list', items: [[{ text: 'b' }]] }));
  });

  it('ADR-0005-N8 h: language missing means de; another value is 422 when writing', () => {
    expect(write({ blocks: [para({ text: 'a' })] }).language).toBe('de');
    expect(writeError({ language: 'en', blocks: [para({ text: 'a' })] }).status).toBe(422);
  });

  it('ADR-0005-N9 i: 20001 code points of plain text are 422, 20000 pass (pairs count once)', () => {
    const emoji = '\u{1F600}';
    expect(answerPlainText(write({ blocks: [para({ text: emoji.repeat(20000) })] }))).toBe(emoji.repeat(20000));
    expect(writeError({ blocks: [para({ text: emoji.repeat(20001) })] }).status).toBe(422);
    // Separators count: two paragraphs of 9999 plus "\n\n" are 20000.
    expect(() => write({ blocks: [para({ text: 'x'.repeat(9999) }), para({ text: 'y'.repeat(9999) })] })).not.toThrow();
    expect(writeError({ blocks: [para({ text: 'x'.repeat(9999) }), para({ text: 'y'.repeat(10000) })] }).status).toBe(422);
  });

  it('ADR-0005-N9 i: 10000 one-character paragraphs through the read variant and L pass; 2000 input blocks pass the write variant; nothing throws', () => {
    const tenThousand = { language: 'de', blocks: Array.from({ length: 10000 }, () => ({ type: 'paragraph', content: [{ text: 'x' }] })) };
    const r = read(tenThousand);
    expect(r?.blocks).toHaveLength(10000);
    expect(structureProblem(r)).toBeUndefined();
    const l = answerBodyFromText(Array.from({ length: 10000 }, () => 'x').join('\n'));
    expect(l?.blocks).toHaveLength(10000);
    const w = write({ blocks: Array.from({ length: 2000 }, () => para({ text: 'x' })) });
    expect(w.blocks).toHaveLength(2000);
    expect(checkAnswerBodyInput({ blocks: Array.from({ length: 2001 }, () => para({ text: 'x' })) })).toBeDefined();
    expect(() => read({ language: 'de', blocks: Array.from({ length: 12000 }, () => ({ type: 'paragraph', content: [{ text: 'x' }] })) })).not.toThrow();
  });

  it('ADR-0005-N10: nothing left after N1–N7 is 422 "Answer text is required."', () => {
    const e = writeError({ blocks: [para({ text: ' ​\u0000 ' }), { type: 'list', items: [[]] }] });
    expect(e.status).toBe(422);
    expect(e.message).toBe('Answer text is required.');
    expect(read({ language: 'de', blocks: [para({ text: '​' })] })).toBeNull();
  });
});

describe('Scheibe 055, Test 2: ADR-0005-N10 idempotency, property-based with a seeded generator (500 cases)', () => {
  it('write variant: normalize(normalize(x)) equals normalize(x); output structurally valid; L(P(b)) valid; P without removed characters', () => {
    const rand = seededRandom(GEN_SEED);
    let accepted = 0;
    for (let i = 0; i < GEN_CASES; i += 1) {
      const input = genBodyInput(rand);
      expect(checkAnswerBodyInput(input), `case ${i}`).toBeUndefined();
      let once: AnswerBody;
      try {
        once = write(input);
      } catch (e) {
        expect(e, `case ${i}`).toBeInstanceOf(AnswerFormatError);
        expect((e as AnswerFormatError).message).toBe('Answer text is required.');
        continue;
      }
      accepted += 1;
      expect(structureProblem(once), `case ${i}: ${JSON.stringify(input)}`).toBeUndefined();
      expect(write(once), `case ${i}`).toEqual(once);
      expect(read(once), `case ${i}`).toEqual(once);
      const plain = answerPlainText(once);
      expect(FORBIDDEN_IN_PLAIN.test(plain), `case ${i}: ${JSON.stringify(plain)}`).toBe(false);
      expect(plain).toBe(plain.normalize('NFC'));
      const derived = answerBodyFromText(plain);
      expect(structureProblem(derived), `case ${i}`).toBeUndefined();
      expect(read(derived)).toEqual(derived);
    }
    expect(accepted).toBeGreaterThan(GEN_CASES / 2);
  });

  it('read variant (with lone surrogates and split pairs): never throws, idempotent, structurally valid', () => {
    const rand = seededRandom(GEN_SEED + 1);
    for (let i = 0; i < GEN_CASES; i += 1) {
      const input = genBodyInput(rand, { broken: true });
      const once = read(input);
      if (once === null) continue;
      expect(structureProblem(once), `case ${i}: ${JSON.stringify(input)}`).toBeUndefined();
      expect(read(once), `case ${i}`).toEqual(once);
      expect(write(once), `case ${i}`).toEqual(once);
    }
  });
});

describe('Scheibe 055, Test 3: no open string in the output', () => {
  it('every block type is paragraph or list and every mark in ANSWER_MARKS (generator cases)', () => {
    const rand = seededRandom(GEN_SEED);
    for (let i = 0; i < GEN_CASES; i += 1) {
      const out = read(genBodyInput(rand));
      if (out === null) continue;
      for (const block of out.blocks) {
        expect(['paragraph', 'list']).toContain(block.type);
        const runs = block.type === 'paragraph' ? block.content : block.items.flat();
        for (const run of runs) for (const mark of run.marks ?? []) expect(ANSWER_MARKS).toContain(mark);
      }
    }
  });

  it('markup stays literal text in a run (no markup in the core)', () => {
    expect(write({ blocks: [para({ text: '<script>alert(1)</script>' }, { text: ' <b onclick=x>fett</b>', marks: ['bold'] })] }))
      .toEqual(body(P({ text: '<script>alert(1)</script>' }, { text: ' <b onclick=x>fett</b>', marks: ['bold'] })));
  });

  it('Nit 5: no key of the document is removed by the event masking (maskEvent keeps the whole body)', () => {
    expect([...ANSWER_BODY_FIELDS].sort()).toEqual(['blocks', 'content', 'items', 'language', 'marks', 'text', 'type']);
    const doc = body(P({ text: 'a', marks: ['bold'] }, { text: 'b' }), { type: 'list', items: [[{ text: 'c', marks: ['italic', 'highlight'] }]] });
    const event = {
      seq: 1, id: 'e1', hash: 'a'.repeat(64), type: 'AnswerDrafted', at: '2027-04-20T12:00:00.000Z', actor: { id: 'x', role: 'expert' }, subjectId: 'q1',
      payload: { answer: { version: 1, text: answerPlainText(doc), createdAt: '2027-04-20T12:00:00.000Z', createdBy: { id: 'x', role: 'expert' }, body: doc } },
    } as unknown as DomainEvent;
    const masked = maskEvent(event) as unknown as { payload: { answer: { body: unknown } } };
    expect(masked.payload.answer.body).toEqual(doc);
  });
});

describe('Scheibe 055, Test 4: ADR-0005-P and ADR-0005-L', () => {
  it('P: paragraphs with \\n\\n, items with \\n, no bullet, result in NFC', () => {
    const doc = body(P({ text: 'Erster ' }, { text: 'Absatz', marks: ['bold'] }), { type: 'list', items: [[{ text: 'eins' }], [{ text: 'zwei' }]] },
      P({ text: 'e' }, { text: '́', marks: ['italic'] }));
    expect(answerPlainText(doc)).toBe('Erster Absatz\n\neins\nzwei\n\né');
  });

  it('L: three lines with an empty line become three paragraphs without marks, language de', () => {
    expect(answerBodyFromText('Eins\n\nZwei\nDrei')).toEqual(body(P({ text: 'Eins' }), P({ text: 'Zwei' }), P({ text: 'Drei' })));
  });

  it('L: only white space gives null; lines split at CR LF, CR and LF (Codex P2)', () => {
    expect(answerBodyFromText(' \n\t\r\n ')).toBeNull();
    expect(answerBodyFromText('a\r\nb\rc\nd')).toEqual(body(P({ text: 'a' }), P({ text: 'b' }), P({ text: 'c' }), P({ text: 'd' })));
  });

  it('L: 10000 lines of one character give 10000 paragraphs and do not throw; a text over the run limit gives null', () => {
    expect(answerBodyFromText(Array.from({ length: 10000 }, () => 'y').join('\n'))?.blocks).toHaveLength(10000);
    expect(answerBodyFromText('z'.repeat(20001))).toBeNull();
  });

  it('projectAnswerBody: a stored body whose plain text differs from the stored text falls back to L (Codex P1)', () => {
    const stored = { language: 'de', blocks: [para({ text: 'Gültig' }), { type: 'paragraph', content: 'kaputt' }] };
    expect(projectAnswerBody(stored, 'Gültig\n\nNoch ein Satz')).toEqual(body(P({ text: 'Gültig' }), P({ text: 'Noch ein Satz' })));
    // A dropped mark does not change the plain text and keeps the stored structure.
    expect(projectAnswerBody({ language: 'de', blocks: [para({ text: 'a', marks: ['underline'] })] }, 'a')).toEqual(body(P({ text: 'a' })));
    expect(projectAnswerBody(undefined, 'x\ny')).toEqual(body(P({ text: 'x' }), P({ text: 'y' })));
    expect(projectAnswerBody(undefined, '   ')).toBeUndefined();
  });
});

describe('Scheibe 055, Test 4a: sanitizeAnswerText (decision 2a)', () => {
  it('removes U+202E, U+200B, U+0007; keeps \\n and tab; NFC; trim', () => {
    expect(sanitizeAnswerText('  Um‮satz​\u0007\n\tstieg ä  ')).toBe('Umsatz\n\tstieg ä');
    expect(sanitizeAnswerText('a\r\nb\rc')).toBe('a\r\nb\rc');
  });

  it('a lone surrogate is an error; only U+200B gives an empty string', () => {
    expect(() => sanitizeAnswerText('a\uD800')).toThrow(AnswerFormatError);
    expect(sanitizeAnswerText('​')).toBe('');
  });

  it('a text without such characters is returned as the same string', () => {
    const t = 'Der Umsatz stieg um 3 %.\n\nGröße: 5 \u{1F600}';
    expect(sanitizeAnswerText(t)).toBe(t);
  });
});

describe('Scheibe 055, Test 5: checkAnswerBodyInput (shape and sizes like the contract)', () => {
  const ok = { blocks: [para({ text: 'GEHEIM', marks: ['bold'] })] };
  const cases: [string, unknown][] = [
    ['missing blocks', { language: 'de' }],
    ['empty blocks', { blocks: [] }],
    ['block without type', { blocks: [{ content: [{ text: 'GEHEIM' }] }] }],
    ['type with 33 characters', { blocks: [{ type: 'GEHEIM'.padEnd(33, 'x'), content: [{ text: 'GEHEIM' }] }] }],
    ['mark as a number', { blocks: [para({ text: 'GEHEIM', marks: [7 as unknown as string] })] }],
    ['17 marks', { blocks: [para({ text: 'GEHEIM', marks: Array.from({ length: 17 }, () => 'bold') })] }],
    ['additional key', { blocks: [{ type: 'paragraph', content: [{ text: 'GEHEIM', colour: 'GEHEIM' }] }] }],
    ['language en', { language: 'en', blocks: ok.blocks }],
    ['not an object', 'GEHEIM'],
    ['run text not a string', { blocks: [para({ text: 5 as unknown as string })] }],
    ['items not an array of arrays', { blocks: [{ type: 'list', items: [{ text: 'GEHEIM' }] }] }],
  ];
  for (const [name, input] of cases) {
    it(`${name}: one message without input text`, () => {
      const message = checkAnswerBodyInput(input);
      expect(message).toBeTypeOf('string');
      expect(message).not.toContain('GEHEIM');
      expect(writeError(input).status).toBe(422);
    });
  }
  it('a valid input gives undefined', () => {
    expect(checkAnswerBodyInput(ok)).toBeUndefined();
    expect(checkAnswerBodyInput({ language: 'de', blocks: [{ type: 'x', items: [[{ text: '' }]] }] })).toBeUndefined();
  });
});
