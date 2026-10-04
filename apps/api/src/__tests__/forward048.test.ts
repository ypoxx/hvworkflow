/**
 * Scheibe 048: forward a question to another answering unit (An anderen Fachbereich weiterleiten) over HTTP.
 * The route only passes through; rights (`question.forward` in ROLE_PERMISSIONS, unit binding R-PERM-03), the
 * row R-TRANS-17 and the guards R-GUARD-03/-15 decide in the core. These tests prove over the service: the
 * write with a new ETag and the event with its closed reason code (H1), 401/403/404 (H2, H3), the validator
 * before the right and the core's unit check (H4), the conflicts (H5), If-Match (H6), the replay (H7), the bound
 * expert through a role assignment (H8) and the access log of a rejected forward (H9).
 * Built on the default ("auf Standard gebaut", E5 open; owner's go 04.10.2026).
 *
 * Setup: a fresh app per `it` with its own seed (`POST /v1/demo/seed`), an injected clock that moves 1.5 s per
 * request, an in-memory access-log sink. Every call goes through `req()`, which checks the response against the
 * contract (the bound `QuestionForwardedPayload` in `EventRead` included) and records the operation's coverage.
 */
import { describe, expect, it } from 'vitest';
import { createApp, type App } from '../app.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { req } from './helpers.ts';

// Ids that occur in no `RoleAssigned` of the seed: the demo header's role is the actor's role. The three
// bound experts get their unit through the role-assignment route in H8 (pre-build check 3).
const ACT = {
  admin: 'adm48:admin',
  capture: 'cap48:capture',
  coordination: 'coo48:coordination',
  expert: 'exp48:expert',
  legal: 'leg48:legal',
  approver: 'app48:approver',
  podium: 'pod48:podium',
  fin: 'exp48fin:expert',
  hr: 'exp48hr:expert',
  esg: 'exp48esg:expert',
} as const;

const T0 = Date.parse('2027-04-20T12:00:00.000Z');
const STEP_MS = 1_500;
const HASHER_BYTES = Buffer.alloc(32, 48);
const EIGHT_KEYS = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];

interface Line { v: number; ts: string; requestId: string; subjectHash: string | null; operationId: string | null; status: number; latencyMs: number; seq: number | null }
interface H { app: App; clock: { now: Date }; sink: ReturnType<typeof createMemorySink>; meetingId: string }
interface Q { id: string; version: number; status: string; unitId?: string; _actions: string[] }
interface Ev { seq: number; type: string; subjectId: string; payload: Record<string, unknown> }
interface Problem { status: number; ruleId?: string; detail?: string }
interface CallOptions { body?: unknown; headers?: Record<string, string> }

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
const lines = (h: H): Line[] => h.sink.lines.map((l) => JSON.parse(l) as Line);

/** A rejected call: the expected problem, the head unchanged and the call's access-log line with `seq: null`. */
async function rejected(h: H, status: number, ruleId: string | undefined, actor: string | undefined, path: string, opts: CallOptions): Promise<Problem> {
  const before = await headSeq(h);
  const mark = h.sink.lines.length;
  const res = await call(h, actor, 'POST', path, opts);
  const line = JSON.parse(h.sink.lines[mark]!) as Line;
  const problem = (await res.json()) as Problem;
  expect(res.status, JSON.stringify(problem)).toBe(status);
  if (ruleId !== undefined) expect(problem.ruleId, JSON.stringify(problem)).toBe(ruleId);
  expect(line).toMatchObject({ operationId: 'forwardQuestion', status, seq: null });
  expect(await headSeq(h)).toBe(before);
  return problem;
}

const ifMatch = (q: { version: number }): Record<string, string> => ({ 'If-Match': `"v${q.version}"` });
const forwardPath = (q: { id: string }): string => `/v1/questions/${encodeURIComponent(q.id)}/forwards`;
function forward(h: H, q: Q, actor: string, body: unknown, headers: Record<string, string> = ifMatch(q)): Promise<Response> {
  return call(h, actor, 'POST', forwardPath(q), { headers, body });
}

async function captured(h: H, text = 'Wie entwickelt sich die Synthesequote?'): Promise<Q> {
  const speakers = await ok<{ id: string; version: number }[]>(call(h, ACT.capture, 'GET', '/v1/speakers'));
  const speaker = speakers[0]!;
  const made = await call(h, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speaker), body: { speakerId: speaker.id, text } });
  expect(made.status).toBe(201);
  const contribution = (await made.json()) as { id: string };
  const res = await call(h, ACT.capture, 'POST', `/v1/contributions/${contribution.id}/questions`,
    { headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text }] } });
  expect(res.status).toBe(201);
  return ((await res.json()) as Q[])[0]!;
}
async function assigned(h: H, unitId = 'unit-fin'): Promise<Q> {
  const q = await captured(h);
  const classified = await ok<Q>(call(h, ACT.coordination, 'POST', `/v1/questions/${q.id}/classification`, { headers: ifMatch(q), body: { track: 'expert_track' } }));
  return ok<Q>(call(h, ACT.coordination, 'POST', `/v1/questions/${q.id}/assignment`, { headers: ifMatch(classified), body: { unitId } }));
}
async function seedQuestionIn(h: H, status: string): Promise<Q> {
  const { items } = await ok<{ items: Q[] }>(call(h, ACT.admin, 'GET', `/v1/questions?status=${status}&limit=1`));
  expect(items.length, status).toBeGreaterThan(0);
  return items[0]!;
}
async function bind(h: H, actor: string, unitId: string): Promise<void> {
  const subjectId = actor.split(':')[0]!;
  const res = await call(h, ACT.admin, 'POST', `/v1/meetings/${h.meetingId}/role-assignments`, { body: { subjectId, role: 'expert', unitId } });
  expect(res.status, await res.clone().text()).toBe(201);
}

describe('Scheibe 048: forwardQuestion over HTTP', () => {
  it('H1 200 as coordination: status stays, unit changes, new ETag; /v1/events as admin shows QuestionForwarded with the code', async () => {
    const h = await world();
    const q = await assigned(h);
    const head = await headSeq(h);
    const res = await forward(h, q, ACT.coordination, { unitId: 'unit-hr', reasonCode: 'expertise_elsewhere' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Q;
    expect(body).toMatchObject({ id: q.id, status: 'assigned', unitId: 'unit-hr' });
    expect(body.version).toBeGreaterThan(q.version);
    expect(res.headers.get('ETag')).toBe(`"v${body.version}"`);
    expect(res.headers.get('ETag')).not.toBe(`"v${q.version}"`);
    expect(JSON.stringify(body)).not.toContain('reasonCode');
    const events = await scanEvents(h, head);
    expect(events.map((e) => e.type)).toEqual(['QuestionForwarded']);
    expect(events[0]).toMatchObject({ subjectId: q.id, payload: { unitId: 'unit-hr', fromUnitId: 'unit-fin', reasonCode: 'expertise_elsewhere' } });
    expect(Object.keys(events[0]!.payload).sort()).toEqual(['fromUnitId', 'reasonCode', 'unitId']);
  });

  it('H2 401 without an actor', async () => {
    const h = await world();
    const q = await assigned(h);
    await rejected(h, 401, undefined, undefined, forwardPath(q), { headers: ifMatch(q), body: { unitId: 'unit-hr', reasonCode: 'wrong_unit' } });
  });

  it('H3 403 R-PERM-01 as approver, legal, admin; 404 as podium and for an unknown id', async () => {
    const h = await world();
    const q = await assigned(h);
    const body = { unitId: 'unit-hr', reasonCode: 'wrong_unit' };
    for (const actor of [ACT.approver, ACT.legal, ACT.admin]) {
      await rejected(h, 403, 'R-PERM-01', actor, forwardPath(q), { headers: ifMatch(q), body });
    }
    await rejected(h, 404, undefined, ACT.podium, forwardPath(q), { headers: ifMatch(q), body });
    await rejected(h, 404, undefined, ACT.coordination, forwardPath({ id: 'q-unbekannt-48' }), { headers: ifMatch(q), body });
  });

  it('H4 422: the validator (before the right) on code, form and extra fields; the core on an unknown unit', async () => {
    const h = await world();
    const q = await assigned(h);
    const invalid: unknown[] = [
      { unitId: 'unit-hr' },
      { unitId: 'unit-hr', reasonCode: 'misc' },
      { unitId: 'unit-hr', reasonCode: 'Die Kollegin ist krank' },
      { reasonCode: 'wrong_unit' },
      { unitId: '', reasonCode: 'wrong_unit' },
      { unitId: 'x'.repeat(129), reasonCode: 'wrong_unit' },
      { unitId: 'unit-hr', reasonCode: 'other', reason: 'Freitext' },
    ];
    for (const body of invalid) {
      const p = await rejected(h, 422, undefined, ACT.coordination, forwardPath(q), { headers: ifMatch(q), body });
      expect(p.detail ?? '').not.toContain('Kollegin');
      // Validator before right: an actor without `question.forward` gets the same 422, not 403.
      await rejected(h, 422, undefined, ACT.approver, forwardPath(q), { headers: ifMatch(q), body });
    }
    const p = await rejected(h, 422, undefined, ACT.coordination, forwardPath(q), { headers: ifMatch(q), body: { unitId: 'unit-missing', reasonCode: 'wrong_unit' } });
    expect(p.detail).toMatch(/unit-missing does not exist/);
  });

  it('H5 409 R-TRANS-00 from approved; 409 R-GUARD-15 to the current unit', async () => {
    const h = await world();
    const approved = await seedQuestionIn(h, 'approved');
    await rejected(h, 409, 'R-TRANS-00', ACT.coordination, forwardPath(approved), { headers: ifMatch(approved), body: { unitId: 'unit-hr', reasonCode: 'capacity' } });
    const q = await assigned(h, 'unit-fin');
    await rejected(h, 409, 'R-GUARD-15', ACT.coordination, forwardPath(q), { headers: ifMatch(q), body: { unitId: 'unit-fin', reasonCode: 'capacity' } });
  });

  it('H6 428 without If-Match, 412 with a stale one', async () => {
    const h = await world();
    const q = await assigned(h);
    const body = { unitId: 'unit-hr', reasonCode: 'other' };
    await rejected(h, 428, undefined, ACT.coordination, forwardPath(q), { headers: {}, body });
    await rejected(h, 412, undefined, ACT.coordination, forwardPath(q), { headers: { 'If-Match': `"v${q.version - 1}"` }, body });
  });

  it('H7 replay with the same key: the same answer, one event', async () => {
    const h = await world();
    const q = await assigned(h);
    const headers = { ...ifMatch(q), 'Idempotency-Key': 'fwd48-h7' };
    const body = { unitId: 'unit-esg', reasonCode: 'wrong_unit' };
    const head = await headSeq(h);
    const first = await forward(h, q, ACT.coordination, body, headers);
    expect(first.status).toBe(200);
    const again = await forward(h, q, ACT.coordination, body, headers);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(await first.json());
    expect(again.headers.get('ETag')).toBe(first.headers.get('ETag'));
    expect((await scanEvents(h, head)).filter((e) => e.type === 'QuestionForwarded')).toHaveLength(1);
  });

  it('H8 bound expert through the role assignment: forward out of the own unit 200 with empty _actions, then 404; a third unit 404', async () => {
    const h = await world();
    await bind(h, ACT.fin, 'unit-fin');
    await bind(h, ACT.hr, 'unit-hr');
    await bind(h, ACT.esg, 'unit-esg');
    const q = await assigned(h, 'unit-fin');
    expect((await ok<Q>(call(h, ACT.fin, 'GET', `/v1/questions/${q.id}`)))._actions).toContain('question.forward');
    expect((await call(h, ACT.esg, 'GET', `/v1/questions/${q.id}`)).status).toBe(404);
    const res = await forward(h, q, ACT.fin, { unitId: 'unit-hr', reasonCode: 'wrong_unit' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Q;
    expect(body).toMatchObject({ status: 'assigned', unitId: 'unit-hr', _actions: [] });
    expect((await call(h, ACT.fin, 'GET', `/v1/questions/${q.id}`)).status).toBe(404);
    const asHr = await ok<Q>(call(h, ACT.hr, 'GET', `/v1/questions/${q.id}`));
    expect(asHr._actions).toContain('question.forward');
    await rejected(h, 404, undefined, ACT.esg, forwardPath(q), { headers: ifMatch(asHr), body: { unitId: 'unit-esg', reasonCode: 'capacity' } });
  });

  it('H9 access log of a rejected forward: eight keys, operationId forwardQuestion, status 409, seq null', async () => {
    const h = await world();
    const q = await assigned(h, 'unit-fin');
    const mark = h.sink.lines.length;
    const res = await forward(h, q, ACT.coordination, { unitId: 'unit-fin', reasonCode: 'other' });
    expect(res.status).toBe(409);
    const own = lines(h).slice(mark);
    expect(own).toHaveLength(1);
    expect(Object.keys(own[0]!).sort()).toEqual(EIGHT_KEYS);
    expect(own[0]).toMatchObject({ v: 1, operationId: 'forwardQuestion', status: 409, seq: null });
    expect(JSON.stringify(own[0])).not.toContain('R-GUARD-15');
  });
});
