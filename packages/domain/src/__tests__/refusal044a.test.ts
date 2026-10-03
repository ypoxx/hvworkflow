/**
 * Scheibe 044a: refusal paths A and B (Verweigerungspfad A "kein Auskunftsanspruch", B "Verweigerung
 * trotz Anspruchs") in the core — catalogue with hash, rights, R-TRANS-15/16, the guards R-GUARD-08,
 * -09, -11, -12, -13, -14, the justification in the `pii` part and its masking on every read path.
 * Built on the default ("auf Standard gebaut"): ADR 0012 is proposed and not read by Recht (E15).
 * Every call goes through `createInProcessApi` with an injected clock; after every rejected call the
 * store's last sequence number is unchanged.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiProblem, createInProcessApi, etagOf, type HvApi } from '../api.js';
import { canonicalJson } from '../envelope.js';
import type { DomainEvent, NewEvent, ReadEvent } from '../events.js';
import { REFUSAL_JUSTIFICATION_READ, ROLE_PERMISSIONS } from '../permissions.js';
import { REFUSAL_GROUNDS } from '../refusalGrounds.js';
import { seedEvents } from '../seed.js';
import { createInMemoryEventStore, type EventStore } from '../store.js';
import { maskEvent } from '../stream.js';
import { PERMISSIONS, type Actor, type Question, type RefusalProposal, type Role, type Track } from '../types.js';

const A = {
  admin: { id: 'admin', role: 'admin' },
  moderation: { id: 'moderation', role: 'moderation' },
  capture: { id: 'capture', role: 'capture' },
  coordination: { id: 'coordination', role: 'coordination' },
  expert: { id: 'expert', role: 'expert' },
  legal: { id: 'legal', role: 'legal' },
  legal2: { id: 'legal-2', role: 'legal' },
  approver: { id: 'approver', role: 'approver' },
  approver2: { id: 'approver-2', role: 'approver' },
  podium: { id: 'podium', role: 'podium' },
  observer: { id: 'observer', role: 'observer' },
} as const satisfies Record<string, Actor>;

const SECRET = 'GEHEIMBEGRUENDUNG';
const WORDING = 'VERWEIGERUNGSWORTLAUTX';
const NOTE = 'VERMERKMARKER';
const PATH_B: RefusalProposal = {
  answerKind: 'refusal_with_ground',
  text: `  ${WORDING} Zu dieser Frage gibt der Vorstand keine Auskunft.  `,
  refusalGroundId: 'aktg-131-3-nr1',
  refusalJustification: `  ${SECRET}: Offenlegung schadet der Gesellschaft.  `,
};
const PATH_A: RefusalProposal = {
  answerKind: 'refusal_no_claim',
  text: 'Die Frage betrifft keinen Tagesordnungspunkt.',
  refusalJustification: `${SECRET}: kein TOP-Bezug erkennbar.`,
};
const JUSTIFICATION_B = `${SECRET}: Offenlegung schadet der Gesellschaft.`;

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

async function problemOf(p: Promise<unknown>): Promise<ApiProblem> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiProblem) return e;
    throw e;
  }
  throw new Error('expected an ApiProblem');
}

/** A rejected call: the problem, and no event was written. */
async function rejected(run: () => Promise<unknown>): Promise<ApiProblem> {
  const before = store.lastSeq();
  const p = await problemOf(run());
  expect(store.lastSeq()).toBe(before);
  return p;
}

/** No `detail` may carry the wording or the justification. */
function expectCleanDetail(p: ApiProblem): void {
  expect(p.detail).not.toContain(SECRET);
  expect(p.detail).not.toContain(WORDING);
  expect(p.detail).not.toContain('Tagesordnungspunkt');
}

const questionOf = async (id: string, actor: Actor = A.admin): Promise<Question> => {
  const before = current;
  as(actor);
  try { return await api.getQuestion(id); } finally { as(before); }
};

async function captured(): Promise<Question> {
  as(A.moderation);
  const speaker = await api.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf((await api.getMeeting()).speakerListVersion) });
  as(A.capture);
  const contribution = await api.captureContribution({ speakerId: speaker.id, text: 'Warum?' }, { ifMatch: etagOf(speaker.version) });
  const [question] = await api.captureQuestions(contribution.id, [{ text: 'Warum?', span: { start: 0, end: 6 } }], { ifMatch: etagOf(contribution.version) });
  return question!;
}

async function classified(track: Track): Promise<Question> {
  const question = await captured();
  as(A.coordination);
  return api.classifyQuestion(question.id, { track }, { ifMatch: etagOf(question.version) });
}

async function assigned(): Promise<Question> {
  const question = await classified('expert_track');
  as(A.coordination);
  return api.assignQuestion(question.id, 'unit-fin', { ifMatch: etagOf(question.version) });
}

async function propose(q: Question, actor: Actor, input: RefusalProposal = PATH_B, idempotencyKey?: string): Promise<Question> {
  as(actor);
  return api.proposeRefusal(q.id, input, { ifMatch: etagOf(q.version), ...(idempotencyKey !== undefined ? { idempotencyKey } : {}) });
}

const latestVersion = (q: Question): number => q.answers[q.answers.length - 1]!.version;

async function clear(q: Question, actor: Actor = A.legal2, note?: string): Promise<Question> {
  as(actor);
  return api.clearQuestionLegally(q.id, { answerVersion: latestVersion(q), ...(note !== undefined ? { note } : {}) }, { ifMatch: etagOf(q.version) });
}

async function approveRefusal(q: Question, actor: Actor = A.approver): Promise<Question> {
  as(actor);
  return api.approveRefusal(q.id, latestVersion(q), { ifMatch: etagOf(q.version) });
}

/** Path B proposed by `legal`, cleared by `legal-2`, approved by `approver`. */
async function approvedRefusal(input: RefusalProposal = PATH_B, proposer: Actor = A.legal): Promise<Question> {
  const proposed = await propose(await assigned(), proposer, input);
  return approveRefusal(await clear(proposed));
}

async function staged(input: RefusalProposal = PATH_B): Promise<Question> {
  const approved = await approvedRefusal(input);
  as(A.moderation);
  return api.stageQuestion(approved.id, { ifMatch: etagOf(approved.version) });
}

async function delivered(input: RefusalProposal = PATH_B): Promise<Question> {
  const onStage = await staged(input);
  as(A.podium);
  return api.deliverQuestion(onStage.id);
}

/** An answer drafted by `expert`, handed to legal clearing. */
async function answerInReview(): Promise<Question> {
  const q = await assigned();
  as(A.expert);
  const drafted = await api.draftAnswer(q.id, { text: 'Belastbare Antwort.' }, { ifMatch: etagOf(q.version) });
  return api.submitForReview(q.id, { ifMatch: etagOf(drafted.version) });
}

const storedEvents = (subjectId: string, type: DomainEvent['type']): DomainEvent[] =>
  store.all().filter((e) => e.subjectId === subjectId && e.type === type);

/** A subscriber with a fixed reader: the shared API evaluates the switched `current` per delivery. */
const subscribeAs = (reader: Actor, into: ReadEvent[]): (() => void) =>
  createInProcessApi({ store, actor: () => reader, clock: () => new Date(time) }).subscribe((events) => into.push(...events));

const hasJustification = (q: Question): boolean => q.answers.some((a) => 'refusalJustification' in a);

/** Lone surrogates make a string ill-formed UTF-16. */
const wellFormed = (s: string): boolean => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const sha256Hex = (text: string): string => hex(sha256(new TextEncoder().encode(text)));

describe('Scheibe 044a, Test 1: catalogue', () => {
  it('seven unique entries, every legalRef AktG / unverified / without docHash', () => {
    expect(REFUSAL_GROUNDS).toHaveLength(7);
    expect(new Set(REFUSAL_GROUNDS.map((g) => g.id)).size).toBe(7);
    for (const g of REFUSAL_GROUNDS) {
      expect(g.legalRef.source).toBe('AktG');
      expect(g.legalRef.verified).toBe(false);
      expect(g.legalRef.docHash).toBeNull();
      expect(g.legalRef.docVersion).toBeNull();
    }
  });

  it('hash = SHA-256 over canonicalJson of the entry without hash; aktg-131-3-nr1 against a hand-written RFC 8785 string', () => {
    for (const g of REFUSAL_GROUNDS) {
      const { hash, ...entry } = g;
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(sha256Hex(canonicalJson(entry)));
    }
    const handWritten =
      '{"id":"aktg-131-3-nr1","legalRef":{"citation":"§ 131 Abs. 3 Satz 1 Nr. 1 AktG. Gliederung und Wortlaut nicht ' +
      'aus einer Quelle im Repositorium belegt; Bezug nur docs/anforderungen-recherche.md:24, :64; Entwurf der Umsetzung, ' +
      'ungeprüft (E15)","docHash":null,"docVersion":null,"source":"AktG","verified":false},"stageText":"Zu dieser Frage ' +
      'gibt der Vorstand keine Auskunft, weil die Erteilung der Auskunft nach vernünftiger kaufmännischer Beurteilung ' +
      'geeignet ist, der Gesellschaft oder einem verbundenen Unternehmen einen nicht unerheblichen Nachteil zuzufügen.",' +
      '"title":"Nach vernünftiger kaufmännischer Beurteilung nicht unerheblicher Nachteil für die Gesellschaft oder ein ' +
      'verbundenes Unternehmen"}';
    const nr1 = REFUSAL_GROUNDS.find((g) => g.id === 'aktg-131-3-nr1')!;
    expect(nr1.hash).toBe(sha256Hex(handWritten));
  });

  it('the list [id, hash] is pinned: every change of an entry shows in the diff', () => {
    expect(REFUSAL_GROUNDS.map((g) => [g.id, g.hash])).toMatchInlineSnapshot(`
      [
        [
          "aktg-131-3-nr1",
          "4095dbd79a9411f5bdd3b843a8270d85d5f15995750ac439bceaea657bab7bf1",
        ],
        [
          "aktg-131-3-nr2",
          "801e8e0a3efce151cccf7420b04266bce98c82eecec4fca341bc550de3059fc0",
        ],
        [
          "aktg-131-3-nr3",
          "8b8942bbb57949548a6844e8bbfded1f5742aab04d3f794f4777fac9389eee70",
        ],
        [
          "aktg-131-3-nr4",
          "057df1cc86690f588d3479bf50fb956994fa76940a38ea72ef222c080c3515d9",
        ],
        [
          "aktg-131-3-nr5",
          "94a4578749dd45a3bcc7cab51441eb4324a6781187e155f3306fdebf97a64608",
        ],
        [
          "aktg-131-3-nr6",
          "7297fa2a8f1522cfa81f492bde7598ec9ce1807335e44892480e9914360f9a2c",
        ],
        [
          "aktg-131-3-nr7",
          "6983fe609856e5872d6e3f085a4dcdd1b139fc30f2f7c8486acaae216f9f41b1",
        ],
      ]
    `);
  });

  it('every string is well-formed UTF-16', () => {
    for (const g of REFUSAL_GROUNDS) {
      for (const s of [g.id, g.title, g.stageText, g.legalRef.citation, g.legalRef.source, g.hash]) expect(wellFormed(s), s).toBe(true);
    }
  });

  it('list, entries and every legalRef are frozen', () => {
    expect(Object.isFrozen(REFUSAL_GROUNDS)).toBe(true);
    for (const g of REFUSAL_GROUNDS) {
      expect(Object.isFrozen(g)).toBe(true);
      expect(Object.isFrozen(g.legalRef)).toBe(true);
    }
  });
});

describe('Scheibe 044a, Test 2: rights', () => {
  it('propose only legal and coordination, approve only approver; admin neither', () => {
    for (const [role, bundle] of Object.entries(ROLE_PERMISSIONS) as [Role, readonly string[]][]) {
      expect(bundle.includes('question.refuse.propose'), role).toBe(['legal', 'coordination'].includes(role));
      expect(bundle.includes('question.refuse.approve'), role).toBe(['approver'].includes(role));
    }
    expect(ROLE_PERMISSIONS.admin.some((p) => p.startsWith('question.refuse.'))).toBe(false);
  });

  it('PERMISSIONS lists both right after question.legal.clear; the reader circle is exactly the two', () => {
    const i = PERMISSIONS.indexOf('question.legal.clear');
    expect(PERMISSIONS.slice(i + 1, i + 3)).toEqual(['question.refuse.propose', 'question.refuse.approve']);
    expect([...REFUSAL_JUSTIFICATION_READ]).toEqual(['question.refuse.propose', 'question.refuse.approve']);
  });
});

describe('Scheibe 044a, Test 3/4: proposal', () => {
  it('3: path B from assigned goes to in_review; event with toStatus, snapshot and pii; projection without snapshot', async () => {
    const q = await assigned();
    const proposed = await propose(q, A.legal);
    expect(proposed.status).toBe('in_review');
    const version = proposed.answers.at(-1)!;
    const ground = REFUSAL_GROUNDS.find((g) => g.id === 'aktg-131-3-nr1')!;
    expect(version).toMatchObject({
      version: 1, answerKind: 'refusal_with_ground', refusalGroundId: 'aktg-131-3-nr1', refusalGroundHash: ground.hash,
      refusalJustification: JUSTIFICATION_B, text: `${WORDING} Zu dieser Frage gibt der Vorstand keine Auskunft.`,
      createdBy: { id: 'legal', role: 'legal' },
    });
    expect('refusalGround' in version).toBe(false);

    const [event] = storedEvents(q.id, 'AnswerDrafted');
    const payload = event!.payload as Record<string, unknown> & { answer: Record<string, unknown> };
    expect(payload['toStatus']).toBe('in_review');
    expect(payload['pii']).toEqual({ keyId: meetingId, refusalJustification: JUSTIFICATION_B });
    expect('refusalJustification' in payload.answer).toBe(false);
    const snapshot = payload.answer['refusalGround'] as Record<string, unknown>;
    expect(snapshot).toEqual({ title: ground.title, stageText: ground.stageText, legalRef: ground.legalRef });
    expect(sha256Hex(canonicalJson({ id: payload.answer['refusalGroundId'], ...snapshot }))).toBe(payload.answer['refusalGroundHash']);
  });

  it('3: proposed from approved, the approval is invalidated', async () => {
    const inReview = await answerInReview();
    const cleared = await clear(inReview, A.legal);
    as(A.approver);
    const approved = await api.approveQuestion(cleared.id, 1, { ifMatch: etagOf(cleared.version) });
    expect(approved.status).toBe('approved');
    const proposed = await propose(approved, A.legal2);
    expect(proposed.status).toBe('in_review');
    expect(proposed.approval).toBeUndefined();
    const event = storedEvents(approved.id, 'AnswerDrafted').at(-1)!;
    expect((event.payload as { invalidatedApprovalOfVersion?: number }).invalidatedApprovalOfVersion).toBe(1);
  });

  it('4: path A by coordination: refusal_no_claim without ground or hash, in_review', async () => {
    const proposed = await propose(await assigned(), A.coordination, PATH_A);
    expect(proposed.status).toBe('in_review');
    const version = proposed.answers.at(-1)!;
    expect(version.answerKind).toBe('refusal_no_claim');
    expect(version.refusalGroundId).toBeUndefined();
    expect(version.refusalGroundHash).toBeUndefined();
    expect(version.refusalJustification).toBe(PATH_A.refusalJustification);
  });
});

describe('Scheibe 044a, Test 5: R-GUARD-09 (409, no event)', () => {
  const cases: [string, RefusalProposal][] = [
    ['path B without ground', { answerKind: 'refusal_with_ground', text: PATH_B.text, refusalJustification: PATH_B.refusalJustification! }],
    ['path B with a blank justification', { ...PATH_B, refusalJustification: '   ' }],
    ['path B without justification', { answerKind: 'refusal_with_ground', text: PATH_B.text, refusalGroundId: 'aktg-131-3-nr1' }],
    ['path A without justification', { answerKind: 'refusal_no_claim', text: PATH_A.text }],
  ];
  for (const [name, input] of cases) {
    it(name, async () => {
      const q = await assigned();
      const p = await rejected(() => propose(q, A.legal, input));
      expect(p.status).toBe(409);
      expect(p.ruleId).toBe('R-GUARD-09');
      expectCleanDetail(p);
    });
  }
});

describe('Scheibe 044a, Test 6: 422 (no event)', () => {
  const bad = (patch: Record<string, unknown>, base: RefusalProposal = PATH_B): RefusalProposal => ({ ...base, ...patch }) as unknown as RefusalProposal;
  const cases: [string, RefusalProposal][] = [
    ["answerKind 'answer'", bad({ answerKind: 'answer' })],
    ['unknown answerKind', bad({ answerKind: 'refusal_maybe' })],
    ['answerKind not a string', bad({ answerKind: 5 })],
    ['empty text', bad({ text: '   ' })],
    ['text not a string', bad({ text: 42 })],
    ['text with 20001 characters', bad({ text: 'x'.repeat(20001) })],
    ['justification with 4001 characters', bad({ refusalJustification: 'x'.repeat(4001) })],
    ['justification not a string', bad({ refusalJustification: 42 })],
    ['ground id with 129 characters', bad({ refusalGroundId: 'x'.repeat(129) })],
    ['ground id not a string', bad({ refusalGroundId: 42 })],
    ['sources not an array of strings', bad({ sources: [1] })],
    ['sources not an array', bad({ sources: 'q1' })],
    ['path A with a ground', bad({ refusalGroundId: 'aktg-131-3-nr1' }, PATH_A)],
    ['path B with an unknown ground', bad({ refusalGroundId: 'aktg-131-3-nr99' })],
  ];
  for (const [name, input] of cases) {
    it(name, async () => {
      const q = await assigned();
      const p = await rejected(() => propose(q, A.legal, input));
      expect(p.status).toBe(422);
      expectCleanDetail(p);
    });
  }

  it('the unknown ground is named by id only', async () => {
    const q = await assigned();
    const p = await rejected(() => propose(q, A.legal, bad({ refusalGroundId: 'aktg-131-3-nr99' })));
    expect(p.detail).toContain('aktg-131-3-nr99');
  });

  it('the limits themselves pass: text 20000, justification 4000', async () => {
    expect((await propose(await assigned(), A.legal, bad({ text: 'x'.repeat(20000) }))).status).toBe('in_review');
    expect((await propose(await assigned(), A.legal, bad({ refusalJustification: 'x'.repeat(4000) }))).status).toBe('in_review');
  });
});

describe('Scheibe 044a, Test 7: rights on the operations', () => {
  it('proposeRefusal without question.refuse.propose: 403 R-PERM-01; podium (no read right) 404 per Festlegung 3', async () => {
    for (const actor of [A.expert, A.approver, A.moderation, A.capture, A.admin]) {
      const q = await assigned();
      const p = await rejected(() => propose(q, actor));
      expect(p.status, actor.role).toBe(403);
      expect(p.ruleId, actor.role).toBe('R-PERM-01');
    }
    const q = await assigned();
    expect((await rejected(() => propose(q, A.podium))).status).toBe(404);
  });

  it('approveRefusal without question.refuse.approve: 403 R-PERM-01', async () => {
    for (const actor of [A.legal, A.coordination, A.admin]) {
      const cleared = await clear(await propose(await assigned(), A.legal));
      const p = await rejected(() => approveRefusal(cleared, actor));
      expect(p.status, actor.role).toBe(403);
      expect(p.ruleId, actor.role).toBe('R-PERM-01');
    }
  });
});

describe('Scheibe 044a, Test 8: table', () => {
  it('podium question in classified: 409 R-GUARD-03', async () => {
    const q = await classified('podium');
    const p = await rejected(() => propose(q, A.legal));
    expect(p).toMatchObject({ status: 409, ruleId: 'R-GUARD-03' });
  });

  it('from captured, staged and delivered: 409 R-TRANS-00', async () => {
    const fromCaptured = await captured();
    expect(await rejected(() => propose(fromCaptured, A.legal))).toMatchObject({ status: 409, ruleId: 'R-TRANS-00' });
    const fromStaged = await staged();
    expect(await rejected(() => propose(fromStaged, A.legal))).toMatchObject({ status: 409, ruleId: 'R-TRANS-00' });
    const fromDelivered = await delivered();
    expect(await rejected(() => propose(fromDelivered, A.legal))).toMatchObject({ status: 409, ruleId: 'R-TRANS-00' });
  });
});

describe('Scheibe 044a, Test 9: R-GUARD-08', () => {
  it('approveRefusal without legal clearance: 409 R-GUARD-08', async () => {
    const proposed = await propose(await assigned(), A.legal);
    expect(await rejected(() => approveRefusal(proposed))).toMatchObject({ status: 409, ruleId: 'R-GUARD-08' });
  });

  it('a clearance of answer v1 does not carry over to refusal v2', async () => {
    const cleared = await clear(await answerInReview(), A.legal);
    expect(cleared.legalClearance?.answerVersion).toBe(1);
    const proposed = await propose(cleared, A.legal);
    expect(proposed.legalClearance).toBeUndefined();
    expect(await rejected(() => approveRefusal(proposed))).toMatchObject({ status: 409, ruleId: 'R-GUARD-08' });
  });

  it('cleared by a second person, approved by a third: approved, QuestionApproved { answerVersion }', async () => {
    const approved = await approvedRefusal();
    expect(approved.status).toBe('approved');
    expect(approved.approval).toMatchObject({ answerVersion: 1, approvedBy: { id: 'approver' } });
    expect(storedEvents(approved.id, 'QuestionApproved').at(-1)!.payload).toEqual({ answerVersion: 1 });
  });
});

describe('Scheibe 044a, Test 10: four eyes and separation', () => {
  it('the proposer does not clear legally: 409 R-GUARD-06', async () => {
    const proposed = await propose(await assigned(), A.legal);
    expect(await rejected(() => clear(proposed, A.legal))).toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
  });

  it('the proposer id in the approver role does not approve: 409 R-GUARD-06', async () => {
    const cleared = await clear(await propose(await assigned(), A.legal));
    expect(await rejected(() => approveRefusal(cleared, { id: 'legal', role: 'approver' }))).toMatchObject({ status: 409, ruleId: 'R-GUARD-06' });
  });

  for (const variant of ['revoked', 'expired'] as const) {
    it(`R-GUARD-14: the legal clearer approves after the legal assignment ${variant}: 409; another approver: approved`, async () => {
      const proposed = await propose(await assigned(), A.coordination);
      as(A.admin);
      const legalGrant = await api.assignRole({ subjectId: 'subject-s', role: 'legal',
        ...(variant === 'expired' ? { expiresAt: new Date(time + 600_000).toISOString() } : {}) });
      if (variant === 'expired') await api.assignRole({ subjectId: 'subject-s', role: 'approver' });
      const cleared = await clear(proposed, { id: 'subject-s', role: 'legal', assignmentScoped: true });
      expect(cleared.legalClearance?.clearedBy.id).toBe('subject-s');
      as(A.admin);
      if (variant === 'revoked') {
        await api.revokeRole(legalGrant.id, 'Rollenwechsel');
        await api.assignRole({ subjectId: 'subject-s', role: 'approver' });
      } else {
        time += 3_600_000;
      }
      const sessionS: Actor = { id: 'subject-s', role: 'approver', assignmentScoped: true };
      expect(await rejected(() => approveRefusal(cleared, sessionS))).toMatchObject({ status: 409, ruleId: 'R-GUARD-14' });
      expect((await approveRefusal(cleared, A.approver2)).status).toBe('approved');
    });
  }
});

describe('Scheibe 044a, Test 11: R-GUARD-04/12/13', () => {
  it('approveQuestion on a refusal version: 409 R-GUARD-12', async () => {
    const cleared = await clear(await propose(await assigned(), A.legal));
    as(A.approver);
    expect(await rejected(() => api.approveQuestion(cleared.id, 1, { ifMatch: etagOf(cleared.version) }))).toMatchObject({ status: 409, ruleId: 'R-GUARD-12' });
  });

  it('approveRefusal on an answer version: 409 R-GUARD-13', async () => {
    const cleared = await clear(await answerInReview(), A.legal);
    expect(await rejected(() => approveRefusal(cleared))).toMatchObject({ status: 409, ruleId: 'R-GUARD-13' });
  });

  it('refusal v2 cleared, approveRefusal(1): 409 R-GUARD-04', async () => {
    const q = await assigned();
    as(A.expert);
    const drafted = await api.draftAnswer(q.id, { text: 'Antwort v1.' }, { ifMatch: etagOf(q.version) });
    const cleared = await clear(await propose(drafted, A.legal));
    expect(latestVersion(cleared)).toBe(2);
    as(A.approver);
    expect(await rejected(() => api.approveRefusal(cleared.id, 1, { ifMatch: etagOf(cleared.version) }))).toMatchObject({ status: 409, ruleId: 'R-GUARD-04' });
  });
});

describe('Scheibe 044a, Test 12: R-GUARD-11', () => {
  /** What an earlier catalogue would have written: a path-B proposal with another hash or id. */
  function appendOldProposal(q: Question, refusalGroundId: string, refusalGroundHash: string): void {
    const at = new Date((time += 1000)).toISOString();
    store.append([{
      id: `old-${refusalGroundId}-${q.id}`, type: 'AnswerDrafted', at, actor: { id: 'legal', role: 'legal' }, subjectId: q.id, meetingId,
      payload: {
        answer: { version: 1, text: 'Alter Wortlaut.', createdAt: at, createdBy: { id: 'legal', role: 'legal' },
          answerKind: 'refusal_with_ground', refusalGroundId, refusalGroundHash,
          refusalGround: { title: 'Alter Titel', stageText: 'Alter Baustein.', legalRef: REFUSAL_GROUNDS[0]!.legalRef } },
        pii: { keyId: meetingId, refusalJustification: 'Alte Begründung.' },
        toStatus: 'in_review',
      },
    } as NewEvent]);
  }

  for (const [name, id, hash] of [
    ['changed entry (hash differs)', 'aktg-131-3-nr1', '0'.repeat(64)],
    ['removed entry (id unknown)', 'aktg-131-3-nr99', REFUSAL_GROUNDS[0]!.hash],
  ] as const) {
    it(`${name}: 409 R-GUARD-11, no approve action; a fresh proposal can be approved`, async () => {
      const q = await assigned();
      appendOldProposal(q, id, hash);
      const old = await questionOf(q.id, A.legal);
      expect(old.status).toBe('in_review');
      const cleared = await clear(old);
      expect(await rejected(() => approveRefusal(cleared))).toMatchObject({ status: 409, ruleId: 'R-GUARD-11' });
      expect((await questionOf(q.id, A.approver))._actions).not.toContain('question.refuse.approve');

      const fresh = await propose(cleared, A.legal);
      expect(fresh.answers.at(-1)!.refusalGroundHash).toBe(REFUSAL_GROUNDS[0]!.hash);
      expect((await approveRefusal(await clear(fresh))).status).toBe('approved');
    });
  }
});

describe('Scheibe 044a, Test 13: whole chain', () => {
  for (const [name, input] of [['path B', PATH_B], ['path A', PATH_A]] as const) {
    it(`${name}: propose → clear → approve → stage → deliver → close`, async () => {
      const onStage = await staged(input);
      expect(onStage.status).toBe('staged');
      as(A.podium);
      const read = await api.deliverQuestion(onStage.id);
      expect(read.status).toBe('delivered');
      expect(storedEvents(onStage.id, 'QuestionDelivered').at(-1)!.payload).toEqual({ answerVersion: 1 });
      const closed = await api.closeQuestion(onStage.id, { ifMatch: etagOf(read.version) });
      expect(closed.status).toBe('closed');
    });
  }
});

describe('Scheibe 044a, Test 14: masking of the justification', () => {
  it('getQuestion: legal, coordination, approver see it (approver also without clearance); others do not', async () => {
    const proposed = await propose(await assigned(), A.legal);
    for (const actor of [A.legal, A.coordination, A.approver]) {
      expect((await questionOf(proposed.id, actor)).answers[0]!.refusalJustification, actor.role).toBe(JUSTIFICATION_B);
    }
    // The approver cannot approve now (no clearance) and still reads it: `can()` without the question.
    expect((await questionOf(proposed.id, A.approver))._actions).not.toContain('question.refuse.approve');
    for (const actor of [A.admin, A.moderation, A.capture, A.expert]) {
      expect(hasJustification(await questionOf(proposed.id, actor)), actor.role).toBe(false);
    }
    as(A.admin);
    const listed = (await api.listQuestions({ limit: 1000 })).items.find((item) => item.id === proposed.id)!;
    expect(hasJustification(listed)).toBe(false);
  });

  it('observer after delivered; write answers of returnQuestion (admin) and deliverQuestion (podium)', async () => {
    const proposed = await propose(await assigned(), A.legal);
    as(A.admin);
    const returned = await api.returnQuestion(proposed.id, 'Bitte prüfen', { ifMatch: etagOf(proposed.version) });
    expect(returned.status).toBe('answer_drafted');
    expect(hasJustification(returned)).toBe(false);

    const onStage = await staged();
    as(A.podium);
    const read = await api.deliverQuestion(onStage.id);
    expect(hasJustification(read)).toBe(false);
    expect(hasJustification(await questionOf(onStage.id, A.observer))).toBe(false);
  });

  it('getStage masks always, also for approver', async () => {
    await staged();
    for (const actor of [A.approver, A.podium]) {
      as(actor);
      const stage = await api.getStage();
      const all = [stage.current, ...stage.queue].filter((q): q is Question => q !== null);
      expect(all.length).toBeGreaterThan(0);
      expect(all.some(hasJustification), actor.role).toBe(false);
    }
  });

  it('a version displaced by a newer answer stays masked for moderation, visible for legal', async () => {
    const proposed = await propose(await assigned(), A.legal);
    as(A.expert);
    const drafted = await api.draftAnswer(proposed.id, { text: 'Doch eine Antwort.' }, { ifMatch: etagOf(proposed.version) });
    expect(drafted.answers).toHaveLength(2);
    expect(hasJustification(await questionOf(proposed.id, A.moderation))).toBe(false);
    expect((await questionOf(proposed.id, A.legal)).answers[0]!.refusalJustification).toBe(JUSTIFICATION_B);
  });

  it('event read paths: history (legal), listEvents (admin), subscribe (legal, admin) carry neither pii nor the justification', async () => {
    const received: ReadEvent[] = [];
    const legalReceived: ReadEvent[] = [];
    const offAdmin = subscribeAs(A.admin, received);
    const offLegal = subscribeAs(A.legal, legalReceived);
    const proposed = await propose(await assigned(), A.legal);
    offAdmin();
    offLegal();
    expect(legalReceived).toEqual([]); // legal holds no event.read: change signals only

    as(A.legal);
    const history = await api.getQuestionHistory(proposed.id);
    as(A.admin);
    const listed = (await api.listEvents(0, 100_000)).items;
    for (const source of [history, listed, received]) {
      const drafted = source.filter((e) => e.type === 'AnswerDrafted' && e.subjectId === proposed.id);
      expect(drafted).toHaveLength(1);
      const payload = drafted[0]!.payload as Record<string, unknown> & { answer: Record<string, unknown> };
      expect('pii' in payload).toBe(false);
      expect('refusalJustification' in payload.answer).toBe(false);
      expect(payload.answer['refusalGround']).toBeDefined();
      expect(JSON.stringify(drafted[0])).not.toContain(SECRET);
    }
  });

  it('idempotent replay as legal returns the historical answer with justification, no new event', async () => {
    const q = await assigned();
    const first = await propose(q, A.legal, PATH_B, 'refusal-key-1');
    const before = store.lastSeq();
    const again = await propose(q, A.legal, PATH_B, 'refusal-key-1');
    expect(store.lastSeq()).toBe(before);
    expect(again.answers[0]!.refusalJustification).toBe(JUSTIFICATION_B);
    expect(again).toEqual(first);
  });
});

describe('Scheibe 044a, Test 15: search', () => {
  it('a word only in the justification finds nothing, a word of the wording finds the question', async () => {
    await propose(await assigned(), A.legal);
    as(A.legal);
    expect((await api.listQuestions({ q: SECRET })).total).toBe(0);
    expect((await api.listQuestions({ q: WORDING })).total).toBe(1);
  });
});

describe('Scheibe 044a, Test 16: draftAnswer stays an answer', () => {
  it('refusal fields in the draft body are dropped; no pii; submit_review still works', async () => {
    const q = await assigned();
    as(A.expert);
    const drafted = await api.draftAnswer(q.id, { text: 'Antwort.', answerKind: 'refusal_with_ground',
      refusalGroundId: 'aktg-131-3-nr1', refusalJustification: SECRET } as never, { ifMatch: etagOf(q.version) });
    const version = drafted.answers[0]!;
    expect(version.answerKind).toBeUndefined();
    expect(version.refusalGroundId).toBeUndefined();
    expect(version.refusalJustification).toBeUndefined();
    const event = storedEvents(q.id, 'AnswerDrafted')[0]!;
    expect('pii' in (event.payload as object)).toBe(false);
    expect(JSON.stringify(event)).not.toContain(SECRET);
    expect((await api.submitForReview(q.id, { ifMatch: etagOf(drafted.version) })).status).toBe('in_review');
  });
});

describe('Scheibe 044a, Test 17: _actions', () => {
  it('legal: propose on a text question in assigned, not on a podium question', async () => {
    as(A.legal);
    const text = await assigned();
    expect((await questionOf(text.id, A.legal))._actions).toContain('question.refuse.propose');
    const podium = await classified('podium');
    expect((await questionOf(podium.id, A.legal))._actions).not.toContain('question.refuse.propose');
  });

  it('approver: refuse.approve and not approve on a cleared refusal; neither without clearance', async () => {
    const proposed = await propose(await assigned(), A.legal);
    const open = (await questionOf(proposed.id, A.approver))._actions;
    expect(open).not.toContain('question.refuse.approve');
    expect(open).not.toContain('question.approve');
    await clear(proposed);
    const cleared = (await questionOf(proposed.id, A.approver))._actions;
    expect(cleared).toContain('question.refuse.approve');
    expect(cleared).not.toContain('question.approve');
  });

  it('admin holds no question.refuse.* on any seed question or refusal', async () => {
    const proposed = await clear(await propose(await assigned(), A.legal));
    as(A.admin);
    const { items } = await api.listQuestions({ limit: 1000 });
    expect(items.length).toBeGreaterThan(1);
    expect(items.some((q) => q.id === proposed.id)).toBe(true);
    for (const q of items) expect(q._actions.filter((a) => a.startsWith('question.refuse.'))).toEqual([]);
  });
});

describe('Scheibe 044a, Test 18: rebuild', () => {
  it('a second API on the same store gives the same question', async () => {
    const proposed = await propose(await assigned(), A.legal);
    const rebuilt = createInProcessApi({ store, actor: () => A.legal, clock: () => new Date(time) });
    const again = await rebuilt.getQuestion(proposed.id);
    expect(again.status).toBe('in_review');
    expect(again.version).toBe(proposed.version);
    expect(again.answers).toEqual(proposed.answers);
  });

  it('AnswerDrafted without toStatus → answer_drafted; toStatus "bogus" → answer_drafted', async () => {
    for (const toStatus of [undefined, 'bogus']) {
      const q = await assigned();
      const at = new Date((time += 1000)).toISOString();
      store.append([{ id: `direct-${q.id}`, type: 'AnswerDrafted', at, actor: { id: 'expert', role: 'expert' }, subjectId: q.id, meetingId,
        payload: { answer: { version: 1, text: 'Direkt.', createdAt: at, createdBy: { id: 'expert', role: 'expert' } },
          ...(toStatus !== undefined ? { toStatus } : {}) } } as NewEvent]);
      expect((await questionOf(q.id)).status).toBe('answer_drafted');
      const rebuilt = createInProcessApi({ store, actor: () => A.admin, clock: () => new Date(time) });
      expect((await rebuilt.getQuestion(q.id)).status).toBe('answer_drafted');
    }
  });
});

describe('Scheibe 044a, Test 19: listRefusalGrounds', () => {
  it('works for all nine roles; seven entries with hash', async () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
      as({ id: `reader-${role}`, role });
      const grounds = await api.listRefusalGrounds();
      expect(grounds, role).toHaveLength(7);
      for (const g of grounds) expect(g.hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('a role without bundle: 403 R-PERM-02', async () => {
    as({ id: 'nobody', role: 'nobody' as Role });
    expect(await problemOf(api.listRefusalGrounds())).toMatchObject({ status: 403, ruleId: 'R-PERM-02' });
  });

  it('returns a deep copy: changing title and legalRef.citation changes neither catalogue nor the next result', async () => {
    as(A.observer);
    const first = await api.listRefusalGrounds();
    const original = { title: REFUSAL_GROUNDS[0]!.title, citation: REFUSAL_GROUNDS[0]!.legalRef.citation };
    (first[0] as { title: string }).title = 'verändert';
    (first[0]!.legalRef as { citation: string }).citation = 'verändert';
    expect(REFUSAL_GROUNDS[0]!.title).toBe(original.title);
    expect(REFUSAL_GROUNDS[0]!.legalRef.citation).toBe(original.citation);
    const second = await api.listRefusalGrounds();
    expect(second[0]!.title).toBe(original.title);
    expect(second[0]!.legalRef.citation).toBe(original.citation);
  });
});

describe('Scheibe 044a, Test 21: return and correction', () => {
  async function afterReturn(q: Question): Promise<void> {
    expect(q.status).toBe('answer_drafted');
    expect(await rejected(() => approveRefusal(q))).toMatchObject({ status: 409, ruleId: 'R-TRANS-00' });
    as(A.expert);
    expect(await rejected(() => api.submitForReview(q.id, { ifMatch: etagOf(q.version) }))).toMatchObject({ status: 409, ruleId: 'R-GUARD-12' });
    const again = await propose(q, A.legal);
    expect(again.status).toBe('in_review');
    expect(again.answers).toHaveLength(q.answers.length + 1);
    expect(again.legalClearance).toBeUndefined();
  }

  it('from approved', async () => {
    const approved = await approvedRefusal();
    as(A.approver);
    await afterReturn(await api.returnQuestion(approved.id, 'Nachschärfen', { ifMatch: etagOf(approved.version) }));
  });

  it('from delivered; the QuestionDelivered of the first refusal stays in the log', async () => {
    const read = await delivered();
    as(A.approver);
    await afterReturn(await api.returnQuestion(read.id, 'Korrektur nach dem Vorlesen', { ifMatch: etagOf(read.version) }));
    expect(storedEvents(read.id, 'QuestionDelivered')).toHaveLength(1);
  });
});

describe('Scheibe 044a, Test 22: displaced by an answer', () => {
  it('expert drafts over a cleared refusal: answer_drafted, clearance gone, refusal version stays', async () => {
    const cleared = await clear(await propose(await assigned(), A.legal));
    as(A.expert);
    const drafted = await api.draftAnswer(cleared.id, { text: 'Antwort statt Verweigerung.' }, { ifMatch: etagOf(cleared.version) });
    expect(drafted.status).toBe('answer_drafted');
    expect(drafted.legalClearance).toBeUndefined();
    expect(drafted.answers[0]!.answerKind).toBe('refusal_with_ground');
    expect(drafted.answers[1]!.answerKind).toBeUndefined();
  });
});

describe('Scheibe 044a, Test 23: If-Match', () => {
  it('stale versions: 412, no event, clean detail', async () => {
    const q = await assigned();
    as(A.legal);
    const p1 = await rejected(() => api.proposeRefusal(q.id, PATH_B, { ifMatch: etagOf(q.version - 1) }));
    expect(p1.status).toBe(412);
    expectCleanDetail(p1);
    const cleared = await clear(await propose(q, A.legal));
    as(A.approver);
    const p2 = await rejected(() => api.approveRefusal(cleared.id, 1, { ifMatch: etagOf(cleared.version - 1) }));
    expect(p2.status).toBe(412);
    expectCleanDetail(p2);
  });
});

describe('Scheibe 044a, Test 24: note of the legal clearance', () => {
  it('stored with note; history, listEvents and subscribe without; the question carries none', async () => {
    const received: ReadEvent[] = [];
    const off = subscribeAs(A.admin, received);
    const answer = await clear(await answerInReview(), A.legal, `${NOTE} Vermerk Antwort`);
    const refusal = await clear(await propose(await assigned(), A.legal), A.legal2, `${NOTE} Vermerk Verweigerung`);
    off();
    for (const q of [answer, refusal]) {
      const stored = storedEvents(q.id, 'QuestionLegalCleared')[0]!;
      expect((stored.payload as { note?: string }).note).toContain(NOTE);
      expect(JSON.stringify(await questionOf(q.id, A.legal))).not.toContain(NOTE);
      as(A.legal);
      const history = (await api.getQuestionHistory(q.id)).filter((e) => e.type === 'QuestionLegalCleared');
      as(A.admin);
      const listed = (await api.listEvents(0, 100_000)).items.filter((e) => e.type === 'QuestionLegalCleared' && e.subjectId === q.id);
      const streamed = received.filter((e) => e.type === 'QuestionLegalCleared' && e.subjectId === q.id);
      for (const source of [history, listed, streamed]) {
        expect(source).toHaveLength(1);
        expect('note' in (source[0]!.payload as object)).toBe(false);
      }
    }
  });

  it('counter-check (narrow): maskEvent keeps a note in another event type', () => {
    const event = { seq: 1, id: 'n1', type: 'QuestionWithdrawn', at: '2027-04-20T12:00:00.000Z', actor: { id: 'x', role: 'moderation' },
      subjectId: 'q', payload: { reason: 'r', note: 'bleibt' }, hash: 'h' } as unknown as DomainEvent;
    expect((maskEvent(event).payload as { note?: string }).note).toBe('bleibt');
  });
});

describe('Scheibe 044a, Test 28: retention class', () => {
  it('refusal AnswerDrafted (A and B) and QuestionApproved from approveRefusal are record; draftAnswer and approveQuestion stay working', async () => {
    const b = await approvedRefusal(PATH_B);
    const a = await approvedRefusal(PATH_A, A.coordination);
    for (const q of [a, b]) {
      expect(storedEvents(q.id, 'AnswerDrafted')[0]!.retentionClass).toBe('record');
      expect(storedEvents(q.id, 'QuestionApproved')[0]!.retentionClass).toBe('record');
    }
    const cleared = await clear(await answerInReview(), A.legal);
    as(A.approver);
    await api.approveQuestion(cleared.id, 1, { ifMatch: etagOf(cleared.version) });
    expect(storedEvents(cleared.id, 'AnswerDrafted')[0]!.retentionClass).toBe('working');
    expect(storedEvents(cleared.id, 'QuestionApproved')[0]!.retentionClass).toBe('working');
  });
});
