/**
 * Scheibe 055 over HTTP (without Postgres): the answer document through the service. The route only passes through
 * (no route change); the validator checks `AnswerDraft.body` against the open input form `AnswerBodyInput`, the core
 * applies the whitelist (ADR 0005, N1–N10), responses and event reads carry the closed stored form `AnswerBody`.
 * H1–H6 and Test 6 (the limits of the core in step with the contract); H5 checks the outputs of the seeded generator
 * of the core test against the contract schema with Ajv, because only the service loads the schema.
 *
 * Setup: a fresh app per `it` with its own seed, an injected clock that moves 1.5 s per request. Every call goes
 * through `req()`, which checks the response against the contract (`AnswerVersion.body` and the bound
 * `EventRead.payload.answer.body` included).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  ANSWER_BODY_FIELDS, ANSWER_BODY_LIMITS, ANSWER_INPUT_LIMITS, ANSWER_LANGUAGES, ANSWER_MARKS, ANSWER_TEXT_MAX_LENGTH,
  normalizeAnswerBodyForRead, normalizeAnswerBodyForWrite, AnswerFormatError,
} from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { expectValid, openapiDoc } from '../contractSchema.ts';
import { req } from './helpers.ts';
import { GEN_CASES, GEN_SEED, genBodyInput, seededRandom } from '../../../../packages/domain/src/__tests__/support/answerBodyGen.ts';

const ACT = {
  admin: 'adm55:admin',
  capture: 'cap55:capture',
  coordination: 'coo55:coordination',
  legal: 'leg55:legal',
} as const;
const T0 = Date.parse('2027-04-20T12:00:00.000Z');
const STEP_MS = 1_500;

interface H { app: App; clock: { now: Date } }
interface Q { id: string; version: number; status: string; answers: { version: number; text: string; body?: unknown }[] }
interface Ev { seq: number; type: string; subjectId: string; payload: Record<string, unknown> }

// A validator of the stored form straight from the contract document, the same compiler options as the service.
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(openapiDoc, 'openapi');
const validBody = ajv.compile({ $ref: 'openapi#/components/schemas/AnswerBody' });
const schemas = openapiDoc.components.schemas;

async function world(): Promise<H> {
  const clock = { now: new Date(T0) };
  const h: H = { app: createApp({ demoEnabled: true, clock: () => clock.now }), clock };
  expect((await call(h, ACT.admin, 'POST', '/v1/demo/seed', { body: { questions: 30, seed: 7 } })).status).toBe(200);
  return h;
}
async function call(h: H, actor: string, method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Response> {
  h.clock.now = new Date(h.clock.now.getTime() + STEP_MS);
  const res = await req(h.app, method, path, { actor, ...opts });
  if (res.status === 429) throw new Error(`429 on ${method} ${path}: a test setup error`);
  return res;
}
async function ok<T>(res: Promise<Response>): Promise<T> {
  const r = await res;
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return (await r.json()) as T;
}
const ifMatch = (q: { version: number }): Record<string, string> => ({ 'If-Match': `"v${q.version}"` });
async function assigned(h: H): Promise<Q> {
  const speakers = await ok<{ id: string; version: number }[]>(call(h, ACT.capture, 'GET', '/v1/speakers'));
  const made = await call(h, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speakers[0]!), body: { speakerId: speakers[0]!.id, text: 'Warum?' } });
  expect(made.status).toBe(201);
  const contribution = (await made.json()) as { id: string };
  const res = await call(h, ACT.capture, 'POST', `/v1/contributions/${contribution.id}/questions`,
    { headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text: 'Warum?' }] } });
  const q = ((await res.json()) as Q[])[0]!;
  const classified = await ok<Q>(call(h, ACT.coordination, 'POST', `/v1/questions/${q.id}/classification`, { headers: ifMatch(q), body: { track: 'expert_track' } }));
  return ok<Q>(call(h, ACT.coordination, 'POST', `/v1/questions/${q.id}/assignment`, { headers: ifMatch(classified), body: { unitId: 'unit-fin' } }));
}
const answers = (h: H, q: Q, body: unknown): Promise<Response> =>
  call(h, ACT.legal, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(q), body });
async function scanEvents(h: H): Promise<Ev[]> {
  const out: Ev[] = [];
  let after = 0;
  for (;;) {
    const page = await ok<{ items: Ev[] }>(call(h, ACT.admin, 'GET', `/v1/events?after=${after}&limit=5000`));
    if (page.items.length === 0) return out;
    out.push(...page.items);
    after = page.items.at(-1)!.seq;
  }
}

const FORMATTED = {
  language: 'de',
  blocks: [
    { type: 'paragraph', content: [{ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold'] }, { text: ' um 3 %.' }] },
    { type: 'list', items: [[{ text: 'Segment A', marks: ['highlight', 'italic'] }], [{ text: 'Segment B' }]] },
  ],
};

describe('Scheibe 055, H1: draftAnswer with body', () => {
  it('200; Question.answers[n].body validates against AnswerBody; the response validates against the contract', async () => {
    const h = await world();
    const res = await answers(h, await assigned(h), { text: 'x', body: FORMATTED });
    expect(res.status).toBe(200);
    const q = (await res.json()) as Q;
    const latest = q.answers.at(-1)!;
    expect(validBody(latest.body), JSON.stringify(validBody.errors)).toBe(true);
    expect(latest.text).toBe('Der Umsatz stieg um 3 %.\n\nSegment A\nSegment B');
    expect(latest.body).toEqual({ language: 'de', blocks: [
      { type: 'paragraph', content: [{ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold'] }, { text: ' um 3 %.' }] },
      { type: 'list', items: [[{ text: 'Segment A', marks: ['italic', 'highlight'] }], [{ text: 'Segment B' }]] }] });
    expectValid('draftAnswer', 200, q);
  });
});

describe('Scheibe 055, H2: validator 422 without input text in the message; bounded message (Minor 6)', () => {
  const run = (marks: unknown) => ({ type: 'paragraph', content: [{ text: 'GEHEIMTEXT', marks }] });
  const cases: [string, unknown][] = [
    ['blocks missing', { language: 'de' }],
    ['mark with 33 characters', { blocks: [run(['m'.repeat(33)])] }],
    ['additional key in a run', { blocks: [{ type: 'paragraph', content: [{ text: 'GEHEIMTEXT', colour: 'GEHEIMTEXT' }] }] }],
    ['language en', { language: 'en', blocks: [run(['bold'])] }],
    ['2001 blocks', { blocks: Array.from({ length: 2001 }, () => run(['bold'])) }],
  ];
  for (const [name, body] of cases) {
    it(`${name}: 422, no event, no input text in the detail`, async () => {
      const h = await world();
      const q = await assigned(h);
      const before = (await scanEvents(h)).length;
      const res = await answers(h, q, { text: 'GEHEIMTEXT', body });
      const problem = (await res.json()) as { detail: string };
      expect(res.status, JSON.stringify(problem)).toBe(422);
      expect(problem.detail).not.toContain('GEHEIMTEXT');
      expect((await scanEvents(h)).length).toBe(before);
    });
  }

  it('2000 faulty runs: at most 20 single errors plus the rest count, detail under 4 KiB', async () => {
    const h = await world();
    const q = await assigned(h);
    const content = Array.from({ length: 2000 }, () => ({ text: 'GEHEIMTEXT', colour: 1 }));
    const res = await answers(h, q, { text: 'x', body: { blocks: [{ type: 'paragraph', content }] } });
    expect(res.status).toBe(422);
    const { detail } = (await res.json()) as { detail: string };
    expect(detail.split('; ').filter((part) => part.startsWith('/')).length).toBeLessThanOrEqual(20);
    expect(detail).toMatch(/and \d+ more/);
    expect(new TextEncoder().encode(detail).length).toBeLessThan(4096);
    expect(detail).not.toContain('GEHEIMTEXT');
  });
});

describe('Scheibe 055, H3: unknown block type and mark over HTTP (same as the demo, K3)', () => {
  it('200, heading becomes a paragraph, underline is removed, the text stays', async () => {
    const h = await world();
    const q = await ok<Q>(answers(h, await assigned(h), { text: 'x', body: { blocks: [{ type: 'heading', content: [{ text: 'Unterstrichen', marks: ['underline'] }] }] } }));
    expect(q.answers.at(-1)!.body).toEqual({ language: 'de', blocks: [{ type: 'paragraph', content: [{ text: 'Unterstrichen' }] }] });
  });
});

describe('Scheibe 055, H4: the closed read path of events', () => {
  it('getQuestionHistory and listEvents: AnswerDrafted with payload.answer.body validates against EventRead, a pre-055 one too', async () => {
    const h = await world();
    const q = await ok<Q>(answers(h, await assigned(h), { text: 'x', body: FORMATTED }));
    const history = await ok<Ev[]>(call(h, ACT.admin, 'GET', `/v1/questions/${q.id}/history`));
    const drafted = history.filter((e) => e.type === 'AnswerDrafted');
    expect(drafted).toHaveLength(1);
    expect((drafted[0]!.payload['answer'] as { body?: unknown }).body).toEqual(q.answers.at(-1)!.body);
    const all = await scanEvents(h);
    const withBody = all.filter((e) => e.type === 'AnswerDrafted' && (e.payload['answer'] as { body?: unknown }).body !== undefined);
    const withoutBody = all.filter((e) => e.type === 'AnswerDrafted' && (e.payload['answer'] as { body?: unknown }).body === undefined);
    expect(withBody).toHaveLength(1);
    expect(withoutBody.length).toBeGreaterThan(0);
    // `req` has validated every page against `EventRead`; this proves the binding is closed, not open.
    const broken = { ...withBody[0]!, payload: { ...withBody[0]!.payload,
      answer: { ...(withBody[0]!.payload['answer'] as object), body: { language: 'de', blocks: [{ type: 'heading', content: [{ text: 'x' }] }] } } } };
    expect(() => expectValid('listEvents', 200, { items: [broken], lastSeq: broken.seq })).toThrow();
    expect(() => expectValid('listEvents', 200, { items: [withBody[0], withoutBody[0]], lastSeq: withBody[0]!.seq })).not.toThrow();
  });
});

describe('Scheibe 055, H5 and Test 6: the core in step with the contract', () => {
  it('Test 6: every limit and enum of answerFormat.ts equals the contract', () => {
    const input = schemas.AnswerBodyInput;
    const block = schemas.AnswerBlockInput;
    const inline = schemas.AnswerInlineInput;
    expect(ANSWER_INPUT_LIMITS).toEqual({
      blocks: input.properties.blocks.maxItems,
      blockType: block.properties.type.maxLength,
      content: block.properties.content.maxItems,
      items: block.properties.items.maxItems,
      itemRuns: block.properties.items.items.maxItems,
      runText: inline.properties.text.maxLength,
      marks: inline.properties.marks.maxItems,
      mark: inline.properties.marks.items.maxLength,
    });
    expect(input.properties.blocks.minItems).toBe(1);
    expect(block.properties.type.minLength).toBe(1);
    expect(inline.properties.marks.items.minLength).toBe(1);
    expect(input.properties.language.enum).toEqual([...ANSWER_LANGUAGES]);
    expect(input.required).toEqual(['blocks']);
    expect(block.required).toEqual(['type']);
    expect(inline.required).toEqual(['text']);
    for (const s of [input, block, inline, schemas.AnswerBody, schemas.AnswerParagraph, schemas.AnswerList, schemas.AnswerInline]) {
      expect(s.additionalProperties).toBe(false);
    }
    expect(schemas.AnswerMark.enum).toEqual([...ANSWER_MARKS]);
    expect(schemas.AnswerBody.properties.language.enum).toEqual([...ANSWER_LANGUAGES]);
    expect(ANSWER_BODY_LIMITS).toEqual({
      blocks: schemas.AnswerBody.properties.blocks.maxItems,
      items: schemas.AnswerList.properties.items.maxItems,
      runs: schemas.AnswerParagraph.properties.content.maxItems,
      runText: schemas.AnswerInline.properties.text.maxLength,
      marks: schemas.AnswerInline.properties.marks.maxItems,
    });
    expect(schemas.AnswerList.properties.items.items.maxItems).toBe(ANSWER_BODY_LIMITS.runs);
    expect(schemas.AnswerDraft.properties.text.maxLength).toBe(ANSWER_TEXT_MAX_LENGTH);
  });

  it('Nit 5: no key of the document is in MASKED_KEYS of stream.ts', () => {
    const source = readFileSync(fileURLToPath(new URL('../../../../packages/domain/src/stream.ts', import.meta.url)), 'utf8');
    const match = /const MASKED_KEYS[^=]*=\s*new Set\(\[([^\]]*)\]\)/.exec(source);
    expect(match).not.toBeNull();
    const masked = [...match![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(masked.length).toBeGreaterThan(0);
    expect(ANSWER_BODY_FIELDS.filter((key) => masked.includes(key))).toEqual([]);
  });

  it('H5: the outputs of the seeded generator (same seed as Test 2) validate against AnswerBody', () => {
    const rand = seededRandom(GEN_SEED);
    let checked = 0;
    for (let i = 0; i < GEN_CASES; i += 1) {
      const input = genBodyInput(rand);
      for (const out of [normalizeAnswerBodyForRead(input), (() => {
        try { return normalizeAnswerBodyForWrite(input); } catch (e) { if (e instanceof AnswerFormatError) return null; throw e; }
      })()]) {
        if (out === null) continue;
        checked += 1;
        expect(validBody(out), `case ${i}: ${JSON.stringify(validBody.errors)}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(GEN_CASES);
    const broken = seededRandom(GEN_SEED + 1);
    for (let i = 0; i < GEN_CASES; i += 1) {
      const out = normalizeAnswerBodyForRead(genBodyInput(broken, { broken: true }));
      if (out !== null) expect(validBody(out), `broken case ${i}`).toBe(true);
    }
  });

  it('H5: 10000 one-character paragraphs through the read variant validate against AnswerBody', () => {
    const out = normalizeAnswerBodyForRead({ language: 'de', blocks: Array.from({ length: 10000 }, () => ({ type: 'paragraph', content: [{ text: 'x' }] })) });
    expect(validBody(out)).toBe(true);
  });
});

describe('Scheibe 055, H6 and pre-build check 6: size of the request', () => {
  const marks = [['bold'], ['italic', 'highlight'], ['bold', 'italic', 'highlight']];
  const atLimit = (piece: string) => ({
    text: 'x',
    body: { language: 'de', blocks: [{ type: 'paragraph', content: Array.from({ length: 2000 }, (_, i) => ({ text: piece, marks: marks[i % 3] })) }] },
  });
  const post = (app: App, q: Q, raw: string) => app.request(`/v1/questions/${q.id}/answers`, {
    method: 'POST', body: raw, headers: { 'X-Actor': ACT.legal, 'Content-Type': 'application/json', 'If-Match': `"v${q.version}"` } });

  it('a body at the limit (20000 code points in 2000 runs with marks) fits under 256 KiB and passes', async () => {
    const h = await world();
    for (const piece of ['abcdefghij', '\u{1F600}'.repeat(10)]) {
      const q = await assigned(h);
      const raw = JSON.stringify(atLimit(piece));
      const bytes = new TextEncoder().encode(raw).length;
      expect(bytes).toBeLessThan(262_144);
      process.stdout.write(`055 pre-build check 6: body at the limit (${piece.length === 10 ? 'ASCII' : 'emoji'}) = ${bytes} bytes\n`);
      const res = await post(h.app, q, raw);
      expect(res.status, await res.clone().text()).toBe(200);
    }
  });

  it('a request over 256 KiB with body is 413 before the validator', async () => {
    const h = await world();
    const q = await assigned(h);
    const big = { text: 'x', body: { blocks: [{ type: 'paragraph', content: Array.from({ length: 2000 }, () => ({ text: 'y'.repeat(140) })) }] } };
    const raw = JSON.stringify(big);
    expect(new TextEncoder().encode(raw).length).toBeGreaterThan(262_144);
    expect((await post(h.app, q, raw)).status).toBe(413);
  });
});
