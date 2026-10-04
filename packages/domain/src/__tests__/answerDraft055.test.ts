/**
 * Scheibe 055, K1–K13: the answer document through `createInProcessApi` with an injected clock (AGENTS.md R8).
 * R-TRANS-03 (answer version, now with a block document), R-GUARD-04 (approval bound to the version; a format change
 * alone is a new version), R-IDEM-01 (a retry with the same key returns the first result), R-PERM-01; the
 * normalisation rules ADR-0005-N1 … N10, the projection ADR-0005-P and the derivation ADR-0005-L. After every rejected
 * call the store's last sequence number is unchanged.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { answerBodyFromText, answerPlainText, type AnswerBody, type AnswerInline } from '../answerFormat.js';
import type { DomainEvent, NewEvent } from '../events.js';
import { CORPUS_DEMO, seedEvents } from '../seed.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import type { Actor, AnswerDraft, Question, RefusalProposal } from '../types.js';

const A = {
  admin: { id: 'admin', role: 'admin' },
  moderation: { id: 'moderation', role: 'moderation' },
  capture: { id: 'capture', role: 'capture' },
  coordination: { id: 'coordination', role: 'coordination' },
  expert: { id: 'expert', role: 'expert' },
  legal: { id: 'legal', role: 'legal' },
  approver: { id: 'approver', role: 'approver' },
} as const satisfies Record<string, Actor>;

const P = (...content: AnswerInline[]) => ({ type: 'paragraph' as const, content });
const doc = (...blocks: AnswerBody['blocks']): AnswerBody => ({ language: 'de', blocks });

let time: number;
let current: Actor;
let api: HvApi;
let store: EventStore;
let meetingId: string;
const as = (actor: Actor) => { current = actor; };

beforeEach(async () => {
  store = createInMemoryEventStore();
  time = Date.parse('2027-04-20T12:00:00.000Z');
  current = A.admin;
  api = createInProcessApi({ store, actor: () => current, clock: () => new Date((time += 1000)), seeder: seedEvents });
  await api.seedDemo({ questions: 30, seed: 7 });
  meetingId = (await api.getMeeting()).id;
});

async function rejected(run: () => Promise<unknown>): Promise<ApiProblem> {
  const before = store.lastSeq();
  try {
    await run();
  } catch (e) {
    expect(store.lastSeq()).toBe(before);
    if (e instanceof ApiProblem) return e;
    throw e;
  }
  throw new Error('expected an ApiProblem');
}

const questionOf = async (id: string): Promise<Question> => {
  const before = current;
  as(A.admin);
  try { return await api.getQuestion(id); } finally { as(before); }
};

async function assigned(): Promise<Question> {
  as(A.moderation);
  const speaker = await api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
  as(A.capture);
  const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Warum?' }, { ifMatch: etagOf(speaker.version) });
  const [question] = await api.captureQuestions(contribution.id, [{ text: 'Warum?', span: { start: 0, end: 6 } }], { ifMatch: etagOf(contribution.version) });
  as(A.coordination);
  const classified = await api.classifyQuestion(question!.id, { track: 'expert_track' }, { ifMatch: etagOf(question!.version) });
  return api.assignQuestion(classified.id, 'unit-fin', { ifMatch: etagOf(classified.version) });
}

async function draft(q: Question, input: AnswerDraft, actor: Actor = A.expert, idempotencyKey?: string): Promise<Question> {
  as(actor);
  return api.draftAnswer(q.id, input, { ifMatch: etagOf(q.version), ...(idempotencyKey !== undefined ? { idempotencyKey } : {}) });
}

const lastEvent = (subjectId: string, type: DomainEvent['type']): DomainEvent =>
  store.all().filter((e) => e.subjectId === subjectId && e.type === type).at(-1)!;
const answerPayload = (e: DomainEvent): Record<string, unknown> => (e.payload as { answer: Record<string, unknown> }).answer;
const latest = (q: Question) => q.answers[q.answers.length - 1]!;

const FORMATTED = {
  blocks: [
    { type: 'paragraph', content: [{ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold'] }, { text: ' um 3 %.' }] },
    { type: 'list', items: [[{ text: 'Segment A', marks: ['highlight'] }], [{ text: 'Segment B' }]] },
  ],
};
const FORMATTED_STORED = doc(
  P({ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold'] }, { text: ' um 3 %.' }),
  { type: 'list', items: [[{ text: 'Segment A', marks: ['highlight'] }], [{ text: 'Segment B' }]] },
);
const FORMATTED_TEXT = 'Der Umsatz stieg um 3 %.\n\nSegment A\nSegment B';

describe('Scheibe 055, K1: without body unchanged for text without control or format characters, already in NFC', () => {
  it('R-TRANS-03: the event is the pre-055 form (no body); the version in Question carries body from L', async () => {
    const q = await draft(await assigned(), { text: '  Erste Zeile.\nZweite Zeile.  ', sources: ['GB 2026'] });
    const event = lastEvent(q.id, 'AnswerDrafted');
    expect(Object.keys(event.payload as object)).toEqual(['answer']);
    expect(answerPayload(event)).toEqual({ version: 1, text: 'Erste Zeile.\nZweite Zeile.', createdAt: expect.any(String),
      createdBy: { id: 'expert', role: 'expert' }, sources: ['GB 2026'] });
    expect(latest(q).body).toEqual(doc(P({ text: 'Erste Zeile.' }), P({ text: 'Zweite Zeile.' })));
    expect(latest(q).text).toBe('Erste Zeile.\nZweite Zeile.');
  });
});

describe('Scheibe 055, K2: with body', () => {
  it('ADR-0005-P: the event carries text = P(normalised) and body (stored form); a different submitted text is not stored', async () => {
    const q = await draft(await assigned(), { text: 'ABWEICHENDER TEXT', body: FORMATTED } as AnswerDraft);
    const answer = answerPayload(lastEvent(q.id, 'AnswerDrafted'));
    expect(answer['text']).toBe(FORMATTED_TEXT);
    expect(answer['body']).toEqual(FORMATTED_STORED);
    expect(JSON.stringify(store.all().slice(-2))).not.toContain('ABWEICHENDER');
    expect(latest(q).body).toEqual(FORMATTED_STORED);
    expect(latest(q).text).toBe(FORMATTED_TEXT);
    expect(latest(q).text).toBe(answerPlainText(latest(q).body!));
  });

  it('text " " with a valid body passes (Lesebefund Minor 1)', async () => {
    const q = await draft(await assigned(), { text: ' ', body: FORMATTED } as AnswerDraft);
    expect(latest(q).text).toBe(FORMATTED_TEXT);
    expect(q.status).toBe('answer_drafted');
  });
});

describe('Scheibe 055, K3: forbidden mark removed over the API (ADR 0005, demo path)', () => {
  it('ADR-0005-N2: marks [underline] give a run without mark, the text the same', async () => {
    const q = await draft(await assigned(), { text: 'x', body: { blocks: [{ type: 'heading', content: [{ text: 'Unterstrichen', marks: ['underline'] }] }] } } as AnswerDraft);
    expect(latest(q).body).toEqual(doc(P({ text: 'Unterstrichen' })));
    expect(answerPayload(lastEvent(q.id, 'AnswerDrafted'))['body']).toEqual(doc(P({ text: 'Unterstrichen' })));
  });
});

describe('Scheibe 055, K4: negative cases before 403/409, no event', () => {
  it('ADR-0005-N10: body without text after N6 is 422 "Answer text is required.", status unchanged', async () => {
    const q = await assigned();
    const p = await rejected(() => draft(q, { text: 'x', body: { blocks: [{ type: 'paragraph', content: [{ text: ' ​ ' }] }] } } as AnswerDraft));
    expect(p.status).toBe(422);
    expect(p.detail).toBe('Answer text is required.');
    expect((await questionOf(q.id)).status).toBe('assigned');
  });

  it('ADR-0005-N9 and N8: plain text over 20000 code points and language en are 422', async () => {
    const q = await assigned();
    const long = { blocks: [{ type: 'paragraph', content: [{ text: 'x'.repeat(15000) }] }, { type: 'paragraph', content: [{ text: 'y'.repeat(5000) }] }] };
    expect((await rejected(() => draft(q, { text: 'x', body: long } as AnswerDraft))).status).toBe(422);
    expect((await rejected(() => draft(q, { text: 'x', body: { language: 'en', blocks: FORMATTED.blocks } } as unknown as AnswerDraft))).status).toBe(422);
  });

  it('R-PERM-01: an actor without answer.draft gets 422 with an invalid body (like the validator) and 403 with a valid one', async () => {
    const q = await assigned();
    expect((await rejected(() => draft(q, { text: 'x', body: { blocks: [] } } as AnswerDraft, A.approver))).status).toBe(422);
    const forbidden = await rejected(() => draft(q, { text: 'x', body: FORMATTED } as AnswerDraft, A.approver));
    expect(forbidden.status).toBe(403);
    expect(forbidden.ruleId).toBe('R-PERM-01');
  });

  it('the submitted text must still meet its contract form with body: empty is 422', async () => {
    const q = await assigned();
    expect((await rejected(() => draft(q, { text: '', body: FORMATTED } as AnswerDraft))).status).toBe(422);
    expect((await rejected(() => draft(q, { text: 'x'.repeat(20001), body: FORMATTED } as AnswerDraft))).status).toBe(422);
  });
});

describe('Scheibe 055, K5: R-GUARD-04, a format change alone is a new version', () => {
  it('approved version 1, version 2 with the same plain text and one more mark: approval voided, status answer_drafted', async () => {
    const plainBody = { blocks: [{ type: 'paragraph', content: [{ text: 'Der Umsatz stieg.' }] }] };
    const v1 = await draft(await assigned(), { text: 'x', body: plainBody } as AnswerDraft);
    as(A.expert);
    const submitted = await api.submitForReview(v1.id, { ifMatch: etagOf(v1.version) });
    as(A.approver);
    const approved = await api.approveQuestion(v1.id, 1, { ifMatch: etagOf(submitted.version) });
    expect(approved.approval?.answerVersion).toBe(1);
    const markedBody = { blocks: [{ type: 'paragraph', content: [{ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold'] }, { text: '.' }] }] };
    const v2 = await draft(approved, { text: 'x', body: markedBody } as AnswerDraft);
    expect(latest(v1).text).toBe('Der Umsatz stieg.');
    expect(latest(v2).text).toBe(latest(v1).text);
    expect(latest(v2).body).toEqual(doc(P({ text: 'Der Umsatz ' }, { text: 'stieg', marks: ['bold'] }, { text: '.' })));
    expect(v2.answers).toHaveLength(2);
    expect((lastEvent(v2.id, 'AnswerDrafted').payload as { invalidatedApprovalOfVersion?: number }).invalidatedApprovalOfVersion).toBe(1);
    expect(v2.approval).toBeUndefined();
    expect(v2.status).toBe('answer_drafted');
  });
});

describe('Scheibe 055, K6: forwarding carries no content (decision 6)', () => {
  it('after draftAnswer with body, submitForReview and forwardQuestion leave the latest version unchanged; neither event carries body', async () => {
    const drafted = await draft(await assigned(), { text: 'x', body: FORMATTED } as AnswerDraft);
    as(A.coordination);
    const forwarded = await api.forwardQuestion(drafted.id, { unitId: 'unit-hr', reasonCode: 'capacity' }, { ifMatch: etagOf(drafted.version) });
    expect(latest(forwarded)).toEqual(latest(drafted));
    as(A.expert);
    const submitted = await api.submitForReview(drafted.id, { ifMatch: etagOf(forwarded.version) });
    expect(latest(submitted).body).toEqual(FORMATTED_STORED);
    expect(latest(submitted).text).toBe(FORMATTED_TEXT);
    for (const type of ['QuestionForwarded', 'QuestionSubmittedForReview'] as const) {
      expect(JSON.stringify(lastEvent(drafted.id, type).payload)).not.toContain('body');
    }
  });
});

describe('Scheibe 055, K7: old events readable, the projection never throws', () => {
  const at = '2027-04-20T11:00:00.000Z';
  const old = (q: Question, version: number, answer: Record<string, unknown>): NewEvent => ({
    id: `old-${q.id}-${version}`, type: 'AnswerDrafted', at, actor: { id: 'expert', role: 'expert' }, subjectId: q.id, meetingId,
    payload: { answer: { version, createdAt: at, createdBy: { id: 'expert', role: 'expert' }, ...answer } },
  } as unknown as NewEvent);
  const rebuilt = () => createInProcessApi({ store, actor: () => A.admin, clock: () => new Date(time) });

  it('a–d: pre-055 form, 600 lines, a withdrawn mark with an empty paragraph, stored language en', async () => {
    const q = await assigned();
    const lines = Array.from({ length: 600 }, (_, i) => `Zeile ${i + 1}`).join('\n');
    store.append([
      old(q, 1, { text: 'Alter Text.' }),
      old(q, 2, { text: lines }),
      old(q, 3, { text: 'Fett und unterstrichen', body: { language: 'de', blocks: [
        { type: 'paragraph', content: [{ text: 'Fett', marks: ['bold'] }, { text: ' und unterstrichen', marks: ['underline'] }] },
        { type: 'paragraph', content: [] }] } }),
      old(q, 4, { text: 'Englisch markiert', body: { language: 'en', blocks: [{ type: 'paragraph', content: [{ text: 'Englisch markiert' }] }] } }),
    ]);
    const seqAfter = store.lastSeq();
    for (const reader of [api, rebuilt()]) {
      const got = await reader.getQuestion(q.id);
      expect(got.answers.map((a) => a.version)).toEqual([1, 2, 3, 4]);
      expect(got.answers[0]!.body).toEqual(doc(P({ text: 'Alter Text.' })));
      expect(got.answers[1]!.body!.blocks).toHaveLength(600);
      expect(got.answers[1]!.text).toBe(lines);
      expect(got.answers[2]!.body).toEqual(doc(P({ text: 'Fett', marks: ['bold'] }, { text: ' und unterstrichen' })));
      expect(got.answers[3]!.body).toEqual(doc(P({ text: 'Englisch markiert' })));
    }
    expect(store.lastSeq()).toBe(seqAfter);
  });

  it('e: the strictest case (unknown block type, mark as number, empty runs, Cf, lone surrogate); 12000 blocks fall back to L; blocks as an object fall back to L', async () => {
    const q = await assigned();
    const big = Array.from({ length: 12000 }, (_, i) => ({ type: 'paragraph', content: [{ text: `${i % 10}` }] }));
    store.append([
      old(q, 1, { text: 'Zitat a�b', body: { language: 'de', blocks: [
        { type: 'blockquote', content: [{ text: '' }, { text: 'Zi​tat', marks: [7, 'italic'] }, { text: ' a\uD800b' }] }] } }),
      old(q, 2, { text: 'Kurz.', body: { language: 'de', blocks: big } }),
      old(q, 3, { text: 'Objekt statt Liste.', body: { language: 'de', blocks: { 0: { type: 'paragraph' } } } }),
    ]);
    for (const reader of [api, rebuilt()]) {
      const got = await reader.getQuestion(q.id);
      expect(got.answers[0]!.body).toEqual(doc(P({ text: 'Zitat', marks: ['italic'] }, { text: ' a�b' })));
      expect(got.answers[0]!.text).toBe('Zitat a�b');
      expect(got.answers[1]!.body).toEqual(doc(P({ text: 'Kurz.' })));
      expect(got.answers[2]!.body).toEqual(doc(P({ text: 'Objekt statt Liste.' })));
    }
  });

  it('no new version and no approval lost by reading a withdrawn mark', async () => {
    const q = await draft(await assigned(), { text: 'Antwort.' });
    as(A.expert);
    const submitted = await api.submitForReview(q.id, { ifMatch: etagOf(q.version) });
    as(A.approver);
    await api.approveQuestion(q.id, 1, { ifMatch: etagOf(submitted.version) });
    const seq = store.lastSeq();
    const got = await rebuilt().getQuestion(q.id);
    expect(got.approval?.answerVersion).toBe(1);
    expect(got.answers).toHaveLength(1);
    expect(got.answers[0]!.body).toEqual(doc(P({ text: 'Antwort.' })));
    expect(store.lastSeq()).toBe(seq);
  });

  it('f (Codex P1): a stored body with one valid and one unusable block shows L(text), no word missing', async () => {
    const q = await assigned();
    store.append([old(q, 1, { text: 'Erster Satz.\n\nZweiter Satz.', body: { language: 'de', blocks: [
      { type: 'paragraph', content: [{ text: 'Erster Satz.' }] }, { type: 'paragraph', content: [{ marks: ['bold'] }] }] } })]);
    const got = await questionOf(q.id);
    expect(got.answers[0]!.body).toEqual(doc(P({ text: 'Erster Satz.' }), P({ text: 'Zweiter Satz.' })));
  });

  it('g (Codex P2): an old event without body with text "a\\rb" gives two paragraphs', async () => {
    const q = await assigned();
    store.append([old(q, 1, { text: 'a\rb' })]);
    expect((await questionOf(q.id)).answers[0]!.body).toEqual(doc(P({ text: 'a' }), P({ text: 'b' })));
  });
});

describe('Scheibe 055, K8: a refusal carries no stored body', () => {
  it('proposeRefusal writes no body; the version carries body from L; the justification is not in the body', async () => {
    const q = await assigned();
    as(A.legal);
    const proposal: RefusalProposal = { answerKind: 'refusal_with_ground', text: 'Keine Auskunft.\nSiehe § 131.', refusalGroundId: 'aktg-131-3-nr1',
      refusalJustification: 'BEGRUENDUNGSMARKER schadet.' };
    const got = await api.proposeRefusal(q.id, proposal, { ifMatch: etagOf(q.version) });
    expect(answerPayload(lastEvent(q.id, 'AnswerDrafted'))).not.toHaveProperty('body');
    expect(latest(got).body).toEqual(doc(P({ text: 'Keine Auskunft.' }), P({ text: 'Siehe § 131.' })));
    expect(JSON.stringify(latest(got).body)).not.toContain('BEGRUENDUNGSMARKER');
  });
});

describe('Scheibe 055, K9: search', () => {
  it('q finds a word of a bold run (through text)', async () => {
    const q = await draft(await assigned(), { text: 'x', body: { blocks: [{ type: 'paragraph', content: [{ text: 'Sonder' }, { text: 'abschreibungsfett', marks: ['bold'] }] }] } } as AnswerDraft);
    as(A.admin);
    const found = await api.listQuestions({ q: 'sonderabschreibungsfett' });
    expect(found.items.map((item) => item.id)).toContain(q.id);
  });
});

describe('Scheibe 055, K10: seed', () => {
  it('CORPUS_DEMO has no event with answer.body; every seeded version carries body from L', async () => {
    const demoStore = createInMemoryEventStore();
    const demo = createInProcessApi({ store: demoStore, actor: () => A.admin, clock: () => new Date(time), seeder: seedEvents });
    await demo.seedDemo({ questions: CORPUS_DEMO.questions, seed: CORPUS_DEMO.seed, roundSizes: CORPUS_DEMO.roundSizes });
    const drafted = demoStore.all().filter((e) => e.type === 'AnswerDrafted');
    expect(drafted.length).toBeGreaterThan(0);
    for (const e of drafted) expect(answerPayload(e)).not.toHaveProperty('body');
    const { items } = await demo.listQuestions({ limit: 1000 });
    let versions = 0;
    for (const q of items) {
      for (const a of q.answers) {
        versions += 1;
        expect(a.body).toEqual(answerBodyFromText(a.text));
      }
    }
    expect(versions).toBeGreaterThan(0);
  });
});

describe('Scheibe 055, K11: character filter in the plain text (M1, decision 2a)', () => {
  it('draftAnswer without body removes U+202E and U+200B; only U+200B is 422; a lone surrogate is 422', async () => {
    const q = await draft(await assigned(), { text: 'Umsatz‮ stieg​ um 3 %' });
    expect(answerPayload(lastEvent(q.id, 'AnswerDrafted'))['text']).toBe('Umsatz stieg um 3 %');
    const p = await rejected(() => draft(q, { text: '​' }));
    expect(p.status).toBe(422);
    expect(p.detail).toBe('Answer text is required.');
    expect((await rejected(() => draft(q, { text: 'a\uD800' }))).status).toBe(422);
  });
});

describe('Scheibe 055, K12: character filter in proposeRefusal (wording and justification)', () => {
  const base: RefusalProposal = { answerKind: 'refusal_with_ground', text: 'Umsatz‮ stieg​ um 3 %', refusalGroundId: 'aktg-131-3-nr1',
    refusalJustification: 'Grund‮ mit​ Zeichen' };
  const propose = async (input: RefusalProposal): Promise<Question> => {
    const q = await assigned();
    as(A.legal);
    return api.proposeRefusal(q.id, input, { ifMatch: etagOf(q.version) });
  };

  it('wording and justification are stored filtered', async () => {
    const got = await propose(base);
    const event = lastEvent(got.id, 'AnswerDrafted');
    expect(answerPayload(event)['text']).toBe('Umsatz stieg um 3 %');
    expect((event.payload as { pii: { refusalJustification: string } }).pii.refusalJustification).toBe('Grund mit Zeichen');
  });

  it('a justification of only U+200B is 409 R-GUARD-09; a lone surrogate is 422; no event', async () => {
    const q = await assigned();
    as(A.legal);
    const blank = await rejected(() => api.proposeRefusal(q.id, { ...base, refusalJustification: '​' }, { ifMatch: etagOf(q.version) }));
    expect(blank.status).toBe(409);
    expect(blank.ruleId).toBe('R-GUARD-09');
    expect((await rejected(() => api.proposeRefusal(q.id, { ...base, refusalJustification: 'a\uD800' }, { ifMatch: etagOf(q.version) }))).status).toBe(422);
    expect((await rejected(() => api.proposeRefusal(q.id, { ...base, text: 'a\uDC00' }, { ifMatch: etagOf(q.version) }))).status).toBe(422);
    expect((await rejected(() => api.proposeRefusal(q.id, { ...base, text: '​‮' }, { ifMatch: etagOf(q.version) }))).status).toBe(422);
  });

  it('4000 raw code points with format characters pass (length before the filter)', async () => {
    const got = await propose({ ...base, refusalJustification: `${'x'.repeat(3990)}${'​'.repeat(10)}` });
    expect((lastEvent(got.id, 'AnswerDrafted').payload as { pii: { refusalJustification: string } }).pii.refusalJustification).toBe('x'.repeat(3990));
    expect(got.status).toBe('in_review');
  });
});

describe('Scheibe 055, K13: golden test of the derivation ADR-0005-L (Lesebefund Minor 9, Recht)', () => {
  const golden: [string, AnswerBody][] = [
    ['Der Vorstand bestätigt die Zahl von 4,2 Mio. EUR.', doc(P({ text: 'Der Vorstand bestätigt die Zahl von 4,2 Mio. EUR.' }))],
    ['Erster Satz.  \n\nZweiter Absatz mit Leerzeichen am Ende.   \nDritte Zeile.\n',
      doc(P({ text: 'Erster Satz.' }), P({ text: 'Zweiter Absatz mit Leerzeichen am Ende.' }), P({ text: 'Dritte Zeile.' }))],
    ['3 %\tWachstum im Segment B.', doc(P({ text: '3 % Wachstum im Segment B.' }))],
  ];
  it('three fixed old events give a literal body; the wording without white space equals the stored text', async () => {
    const q = await assigned();
    const at = '2027-04-20T11:00:00.000Z';
    store.append(golden.map(([text], i) => ({
      id: `golden-${i}`, type: 'AnswerDrafted', at, actor: { id: 'expert', role: 'expert' }, subjectId: q.id, meetingId,
      payload: { answer: { version: i + 1, text, createdAt: at, createdBy: { id: 'expert', role: 'expert' } } },
    } as unknown as NewEvent)));
    const got = await questionOf(q.id);
    const squeeze = (s: string) => s.replace(/\s/gu, '');
    for (const [i, [text, expected]] of golden.entries()) {
      expect(got.answers[i]!.body).toEqual(expected);
      expect(got.answers[i]!.text).toBe(text);
      expect(squeeze(answerPlainText(got.answers[i]!.body!))).toBe(squeeze(text));
    }
  });
});

describe('Scheibe 055, pre-build check 5: R-IDEM-01 with a different body', () => {
  it('a retry with the same key and another body returns the first result, no new event', async () => {
    const q = await assigned();
    const first = await draft(q, { text: 'x', body: FORMATTED } as AnswerDraft, A.expert, 'idem-055');
    const seq = store.lastSeq();
    const again = await draft(q, { text: 'x', body: { blocks: [{ type: 'paragraph', content: [{ text: 'Ganz anders.' }] }] } } as AnswerDraft, A.expert, 'idem-055');
    expect(store.lastSeq()).toBe(seq);
    expect(again.answers).toEqual(first.answers);
    expect(latest(again).body).toEqual(FORMATTED_STORED);
  });
});
