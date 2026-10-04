/**
 * Scheibe 055, Test 2 and H5: a seeded generator of answer documents in the open input form (`AnswerBodyInput`),
 * without a dependency (SC-10: no `fast-check`). The same seed gives the same cases in the core test (idempotency,
 * structure) and in the service test (the outputs against the contract schema with Ajv).
 *
 * The pieces cover what Word and browsers put on the clipboard and what breaks naive normalisers: unknown block
 * types and marks, duplicate marks, every kind of white space, control and format characters (bidi, zero width, tag
 * characters), empty runs, combining characters, decomposed umlauts, Hangul jamo and surrogate pairs, spread over
 * run boundaries. `broken: true` adds lone surrogates and surrogate pairs split across two runs, which only the read
 * variant accepts.
 */

export interface GenInline { text: string; marks?: string[] }
export interface GenBlock { type: string; content?: GenInline[]; items?: GenInline[][] }
export interface GenBody { language?: 'de'; blocks: GenBlock[] }

/** mulberry32, the generator the seed corpus uses as well: small, fast, deterministic. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BLOCK_TYPES = ['paragraph', 'paragraph', 'list', 'list', 'heading', 'quote', 'table', 'h2', 'ol'];
const MARKS = ['bold', 'italic', 'highlight', 'bold', 'underline', 'strike', 'font-family:Arial', 'x'];
const PIECES = [
  'Umsatz', 'stieg', 'um', '3 %', 'Größe', 'Ä', 'ß', 'Vorstand', '<script>alert(1)</script>', '<b onclick=x>',
  ' ', '  ', '\t', '\n', '\r\n', '\u0085', '\u00A0', '\u2028', '\u2029', '\u3000', '\u2003',
  '\u0000', '\u001B', '\u007F', '\u009B', '\u0007',
  '\u00AD', '\u200B', '\u200C', '\u200D', '\u200E', '\u202A', '\u202E', '\u2060', '\u2066', '\u2069', '\uFEFF', '\u{E0041}',
  'a\u0308', 'o\u0308', '\u0301', '\u0308', 'e', '\u1100', '\u1161', '\u11A8', '\u1100\u1161',
  '\u{1F600}', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', '\uFE0F', '',
];
const BROKEN = ['\uD800', '\uDC00', '\uDBFF'];

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function genText(rand: () => number, broken: boolean): string {
  const n = Math.floor(rand() * 6);
  let s = '';
  for (let i = 0; i < n; i += 1) s += broken && rand() < 0.08 ? pick(rand, BROKEN) : pick(rand, PIECES);
  return s;
}

function genRuns(rand: () => number, broken: boolean): GenInline[] {
  const n = Math.floor(rand() * 6);
  const runs: GenInline[] = [];
  for (let i = 0; i < n; i += 1) {
    const text = genText(rand, broken);
    const m = Math.floor(rand() * 4);
    const marks: string[] = [];
    for (let j = 0; j < m; j += 1) marks.push(pick(rand, MARKS));
    runs.push(rand() < 0.3 ? { text } : { text, marks });
  }
  if (broken && runs.length >= 2 && rand() < 0.3) {
    // A surrogate pair split across a run boundary: each half is a lone surrogate in its run.
    runs[0] = { ...runs[0]!, text: `${runs[0]!.text}\uD83D` };
    runs[1] = { ...runs[1]!, text: `\uDE00${runs[1]!.text}` };
  }
  return runs;
}

/** One document in the input form; valid against `AnswerBodyInput` (shape and sizes), the content anything. */
export function genBodyInput(rand: () => number, options: { broken?: boolean } = {}): GenBody {
  const broken = options.broken === true;
  const n = 1 + Math.floor(rand() * 5);
  const blocks: GenBlock[] = [];
  for (let i = 0; i < n; i += 1) {
    const block: GenBlock = { type: pick(rand, BLOCK_TYPES) };
    if (rand() < 0.75) block.content = genRuns(rand, broken);
    if (rand() < 0.5) {
      const items: GenInline[][] = [];
      const k = Math.floor(rand() * 4);
      for (let j = 0; j < k; j += 1) items.push(genRuns(rand, broken));
      block.items = items;
    }
    blocks.push(block);
  }
  return rand() < 0.5 ? { blocks } : { language: 'de', blocks };
}

/** The fixed seed and number of cases of Test 2 and H5 (spec 055: 500 cases). */
export const GEN_SEED = 55_055;
export const GEN_CASES = 500;
