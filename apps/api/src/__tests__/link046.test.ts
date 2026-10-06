/**
 * Scheibe 046: follow-up threads (Nachfragen-Threads) over HTTP. The capture route and the list routes only
 * pass through; the validator checks the extended `QuestionCapture` (pair, enum, length in code points) and the
 * filter `parentQuestionId` before the core, the core decides R-LINK-01 and writes `QuestionLinked`. These tests
 * prove over the service: the capture with a reference and the read payload `{ relation }` (H1), the validator's
 * 422 (H2), R-LINK-01 without the id (H3), the filter on both list routes (H4), the replay (H5), the access log
 * of a rejected capture (H6) and the stage view without the reference (H7).
 * Built on the defaults ("auf Standard gebaut (Spec 046)").
 *
 * Setup: a fresh app per `it` with its own seed (`POST /v1/demo/seed`), an injected clock that moves 1.5 s per
 * request, an in-memory access-log sink. Every call goes through `req()`, which checks the response against the
 * contract (the bound `QuestionLinkedPayload` in `EventRead` included).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp, type App } from '../app.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { req } from './helpers.ts';

// Ids that occur in no `RoleAssigned` of the seed: the demo header's role is the actor's role.
const ACT = {
  admin: 'adm46:admin',
  capture: 'cap46:capture',
  moderation: 'mod46:moderation',
  coordination: 'coo46:coordination',
  expert: 'exp46:expert',
  legal: 'leg46:legal',
  approver: 'app46:approver',
  podium: 'pod46:podium',
} as const;

const T0 = Date.parse('2027-04-20T12:00:00.000Z');
const STEP_MS = 1_500;
const HASHER_BYTES = Buffer.alloc(32, 46);
const EIGHT_KEYS = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];
const PARENT_TEXT = 'BEZUGSFRAGE46H Wie hoch ist die Quote?';
const ASTRAL = '\u{1F600}';

interface Line { v: number; ts: string; requestId: string; subjectHash: string | null; operationId: string | null; status: number; latencyMs: number; seq: number | null }
interface H { app: App; clock: { now: Date }; sink: ReturnType<typeof createMemorySink>; meetingId: string }
interface Q { id: string; number: string; version: number; status: string; parentQuestionId?: string; relation?: string; parentAnswerVersion?: number; answers: { version: number }[] }
interface Ev { seq: number; type: string; subjectId: string; payload: Record<string, unknown> }
interface Problem { status: number; ruleId?: string; detail?: string }
interface CallOptions { body?: unknown; headers?: Record<string, string> }
interface Made { id: string; etag: string }

async function world(): Promise<H> {
  const sink = createMemorySink();
  const clock = { now: new Date(T0) };
  const app = createApp({ demoEnabled: true, clock: () => clock.now, accessLog: { sink, hashKey: HASHER_BYTES } });
  const h: H = { app, clock, sink, meetingId: '' };
  expect((await call(h, ACT.admin, 'POST', '/v1/demo/seed', { body: { questions: 30, seed: 7 } })).status).toBe(200);
  h.meetingId = (await ok<{ id: string }>(call(h, ACT.admin, 'GET', '/v1/meeting'))).id;
  return h;
}
async function call(h: H, actor: string | undefined, method: string, path: string, opts: CallOptions = {}): Promise<Response> {
  h.clock.now = new Date(h.clock.now.getTime() + STEP_MS);
  const res = await req(h.app, method, path, { ...(actor !== undefined ? { actor } : {}), ...opts });
  if (res.status === 429) throw new Error(`429 on ${method} ${path}: a test setup error, never an expected result`);
  return res;
}
async function ok<T>(res: Promise<Response>): Promise<T> {
  const r = await res;
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return (await r.json()) as T;
}
async function scanEvents(h: H, after: number): Promise<Ev[]> {
  const out: Ev[] = [];
  for (;;) {
    const page = await ok<{ items: Ev[] }>(call(h, ACT.admin, 'GET', `/v1/events?after=${after}&limit=5000`));
    if (page.items.length === 0) return out;
    out.push(...page.items);
    after = page.items.at(-1)!.seq;
  }
}
const headSeq = async (h: H): Promise<number> => (await scanEvents(h, 0)).at(-1)?.seq ?? 0;
const ifMatch = (q: { version: number }): Record<string, string> => ({ 'If-Match': `"v${q.version}"` });

async function contribution(h: H, text = 'Nachfrage zur Quote: warum gerade jetzt?'): Promise<Made> {
  const speakers = await ok<{ id: string; version: number }[]>(call(h, ACT.capture, 'GET', '/v1/speakers'));
  const made = await call(h, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speakers[0]!), body: { speakerId: speakers[0]!.id, text } });
  expect(made.status).toBe(201);
  return { id: ((await made.json()) as { id: string }).id, etag: made.headers.get('ETag')! };
}
function capture(h: H, c: Made, questions: unknown[], headers: Record<string, string> = {}): Promise<Response> {
  return call(h, ACT.capture, 'POST', `/v1/contributions/${c.id}/questions`, { headers: { 'If-Match': c.etag, ...headers }, body: { questions } });
}
async function captured(h: H, text = PARENT_TEXT): Promise<Q> {
  const res = await capture(h, await contribution(h, text), [{ text }]);
  expect(res.status).toBe(201);
  return ((await res.json()) as Q[])[0]!;
}
async function followUp(h: H, parentId: string, relation = 'follow_up'): Promise<Q> {
  const res = await capture(h, await contribution(h), [{ text: 'Und warum?', parentQuestionId: parentId, relation }]);
  expect(res.status, await res.clone().text()).toBe(201);
  return ((await res.json()) as Q[])[0]!;
}
const post = (h: H, actor: string, q: Q, step: string, body?: unknown): Promise<Q> =>
  ok<Q>(call(h, actor, 'POST', `/v1/questions/${q.id}/${step}`, { headers: ifMatch(q), ...(body !== undefined ? { body } : {}) }));
async function staged(h: H, q: Q): Promise<Q> {
  let x = await post(h, ACT.coordination, q, 'classification', { track: 'expert_track' });
  x = await post(h, ACT.coordination, x, 'assignment', { unitId: 'unit-fin' });
  x = await post(h, ACT.expert, x, 'answers', { text: 'Belastbare Antwort.' });
  x = await post(h, ACT.expert, x, 'review-submissions');
  x = await post(h, ACT.legal, x, 'legal-clearances', { answerVersion: x.answers.at(-1)!.version });
  x = await post(h, ACT.approver, x, 'approvals', { answerVersion: x.answers.at(-1)!.version });
  return post(h, ACT.moderation, x, 'staging');
}
const delivered = async (h: H, q: Q): Promise<Q> => post(h, ACT.podium, await staged(h, q), 'delivery');

/** A rejected capture: the expected problem, the head unchanged and the call's access-log line with `seq: null`. */
async function rejected(h: H, status: number, ruleId: string | undefined, questions: unknown[]): Promise<{ problem: Problem; line: Line }> {
  const c = await contribution(h);
  const before = await headSeq(h);
  const mark = h.sink.lines.length;
  const res = await capture(h, c, questions);
  const line = JSON.parse(h.sink.lines[mark]!) as Line;
  const problem = (await res.json()) as Problem;
  expect(res.status, JSON.stringify(problem)).toBe(status);
  expect(problem.ruleId, JSON.stringify(problem)).toBe(ruleId);
  expect(line).toMatchObject({ operationId: 'captureQuestions', status, seq: null });
  expect(await headSeq(h)).toBe(before);
  return { problem, line };
}

describe('Scheibe 046: follow-up references over HTTP', () => {
  it('H1 201 with reference: all three fields, the contribution ETag; /v1/events shows QuestionLinked with { relation } only', async () => {
    const h = await world();
    const parent = await delivered(h, await captured(h));
    const c = await contribution(h);
    const head = await headSeq(h);
    const res = await capture(h, c, [{ text: 'Warum gerade jetzt?', parentQuestionId: parent.id, relation: 'follow_up' }]);
    expect(res.status).toBe(201);
    const [child] = (await res.json()) as Q[];
    expect(child).toMatchObject({ parentQuestionId: parent.id, relation: 'follow_up', parentAnswerVersion: 1, version: 2 });
    const contributionAfter = await ok<{ version: number }>(call(h, ACT.capture, 'GET', `/v1/contributions/${c.id}`));
    expect(res.headers.get('ETag')).toBe(`"v${contributionAfter.version}"`);
    const events = await scanEvents(h, head);
    expect(events.map((e) => e.type)).toEqual(['QuestionCaptured', 'QuestionLinked']);
    expect(events[1]).toMatchObject({ subjectId: child!.id });
    expect(events[1]!.payload).toEqual({ relation: 'follow_up' });
    expect(JSON.stringify(events[1])).not.toContain(parent.id);
  });

  it('H2 422 of the validator: incomplete pair (both directions), unknown relation, 129 code points; no event', async () => {
    const h = await world();
    const parent = await captured(h);
    for (const item of [
      { text: 'X?', parentQuestionId: parent.id },
      { text: 'X?', relation: 'follow_up' },
      { text: 'X?', parentQuestionId: parent.id, relation: 'duplicate' },
      { text: 'X?', parentQuestionId: ASTRAL.repeat(129), relation: 'follow_up' },
      { text: 'X?', parentQuestionId: '', relation: 'follow_up' },
    ]) {
      await rejected(h, 422, undefined, [item]);
    }
  });

  it('H3 422 of the core R-LINK-01 for an unknown id; the problem never names the id', async () => {
    const h = await world();
    const { problem } = await rejected(h, 422, 'R-LINK-01', [{ text: 'X?', parentQuestionId: 'unknown-046-h3', relation: 'clarification' }]);
    expect(JSON.stringify(problem)).not.toContain('unknown-046-h3');
    // 128 code points outside the BMP pass the validator and end in the same rule.
    await rejected(h, 422, 'R-LINK-01', [{ text: 'X?', parentQuestionId: ASTRAL.repeat(128), relation: 'follow_up' }]);
  });

  it('H4 both list routes: direct children; unknown id: empty; empty value and 129 code points: 422', async () => {
    const h = await world();
    const parent = await captured(h);
    const child = await followUp(h, parent.id);
    await followUp(h, child.id, 'clarification');
    for (const base of ['/v1/questions', `/v1/meetings/${h.meetingId}/questions`]) {
      const list = await ok<{ items: Q[]; total: number }>(call(h, ACT.capture, 'GET', `${base}?parentQuestionId=${encodeURIComponent(parent.id)}`));
      expect(list.items.map((q) => q.id), base).toEqual([child.id]);
      expect(list.total).toBe(1);
      expect(await ok<{ items: Q[]; total: number }>(call(h, ACT.capture, 'GET', `${base}?parentQuestionId=unknown-046`)))
        .toMatchObject({ items: [], total: 0 });
      expect((await call(h, ACT.capture, 'GET', `${base}?parentQuestionId=`)).status, base).toBe(422);
      expect((await call(h, ACT.capture, 'GET', `${base}?parentQuestionId=${encodeURIComponent(ASTRAL.repeat(129))}`)).status, base).toBe(422);
      const all = await ok<{ total: number }>(call(h, ACT.capture, 'GET', base));
      expect(all.total).toBeGreaterThan(3);
    }
  });

  it('H5 replay with the same key: the same answer, one QuestionLinked', async () => {
    const h = await world();
    const parent = await captured(h);
    const c = await contribution(h);
    const body = [{ text: 'Nachgefragt?', parentQuestionId: parent.id, relation: 'follow_up' }];
    const first = await capture(h, c, body, { 'Idempotency-Key': 'cap-046-h5' });
    expect(first.status).toBe(201);
    const head = await headSeq(h);
    const again = await capture(h, c, body, { 'Idempotency-Key': 'cap-046-h5' });
    expect(again.status).toBe(201);
    const [a, b] = [(await first.json()) as Q[], (await again.json()) as Q[]];
    expect(b).toEqual(a);
    expect(await headSeq(h)).toBe(head);
    expect((await scanEvents(h, 0)).filter((e) => e.type === 'QuestionLinked' && e.subjectId === a[0]!.id)).toHaveLength(1);
  });

  it('H6 the access log of a rejected capture: eight keys, captureQuestions, 422, seq null; no question text, no parent id', async () => {
    const h = await world();
    const parent = await captured(h);
    const { line } = await rejected(h, 422, undefined, [{ text: 'GEHEIMTEXT46 X?', parentQuestionId: parent.id }]);
    expect(Object.keys(line).sort()).toEqual(EIGHT_KEYS);
    const raw = h.sink.lines.join('\n');
    expect(raw).not.toContain('GEHEIMTEXT46');
    expect(raw).not.toContain(parent.id);
  });

  it('H7 the stage view with a follow-up on the stage: neither parentQuestionId nor parentAnswerVersion', async () => {
    const h = await world();
    const parent = await delivered(h, await captured(h));
    const child = await staged(h, await followUp(h, parent.id));
    expect(child.parentQuestionId).toBe(parent.id);
    for (const actor of [ACT.moderation, ACT.podium]) {
      const stage = await ok<{ current: Q | null; queue: Q[] }>(call(h, actor, 'GET', `/v1/meetings/${h.meetingId}/stage`));
      const all = [stage.current, ...stage.queue].filter((q): q is Q => q !== null);
      expect(all.some((q) => q.id === child.id), actor).toBe(true);
      for (const q of all) {
        expect(Object.hasOwn(q, 'parentQuestionId')).toBe(false);
        expect(Object.hasOwn(q, 'parentAnswerVersion')).toBe(false);
      }
      expect(JSON.stringify(stage)).not.toContain(parent.id);
    }
  });
});

/* Test 16 of the core, the part that reads files (the domain package may not import node:fs, arch gate). */
describe('Scheibe 046, Test 16: rule ids in the production code and legal-trace', () => {
  const file = (path: string): string => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
  it('the literals R-LINK-01 (api.ts) and R-LINK-02 (state.ts); docs/legal-trace.md has exactly two R-LINK lines', () => {
    expect(file('packages/domain/src/api.ts')).toContain("'R-LINK-01'");
    expect(file('packages/domain/src/state.ts')).toContain("'R-LINK-02'");
    expect(file('docs/legal-trace.md').split('\n').filter((line) => line.startsWith('| R-LINK-'))).toHaveLength(2);
  });
});

