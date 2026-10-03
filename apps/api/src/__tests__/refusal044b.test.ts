/**
 * Scheibe 044b: refusal paths A and B (Verweigerungspfad A "kein Auskunftsanspruch", B "Verweigerung trotz
 * Anspruchs") over HTTP. The three routes only pass through; rights, table and guards decide in the core (044a).
 * These tests prove over the service what 044a proved in the core: every rejection with status and rule id and
 * without an event, the justification (Begründung) and the legal clearer's remark (Vermerk) on no read path
 * outside the reader circle, the access log with exactly its eight keys, and validator and core counting
 * lengths alike (code points). Built on the default ("auf Standard gebaut", owner's go 03.10.2026).
 *
 * Setup: a fresh app per `it` with its own seed (`POST /v1/demo/seed`), an injected clock that moves 1.5 s per
 * request (so no subject reaches the 60 writes of one minute window; a 429 is a setup error and fails the call),
 * an in-memory access-log sink. Every response — JSON, problem, every SSE block — goes through the response hook
 * (SG2) for the calling actor.
 */
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  REFUSAL_GROUNDS, SYSTEM_ACTOR, codePointLength, createInMemoryEventStore, createInProcessApi, etagOf, seedEvents,
  type Actor, type DomainEvent, type NewEvent,
} from '@hv/domain';
import { createApp, type App, type CreateAppOptions } from '../app.ts';
import { expectValid } from '../contractSchema.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { req, UNDOCUMENTED_STATUS_EXCEPTIONS } from './helpers.ts';
import { mustOpen, type SseBlock, type StreamReader } from './stream-reader035.ts';

const ucs2length = (createRequire(import.meta.url)('ajv/dist/runtime/ucs2length') as { default: (s: string) => number }).default;

// ---- actors ------------------------------------------------------------------------------------------------------
// Ids that occur in no `RoleAssigned` of the seed (pre-build check 3, asserted in test 4): the demo header's role
// is then the actor's role, and one id can act as `legal` and later as `approver`.
const ACT = {
  admin: 'adm44b:admin',
  moderation: 'mod44b:moderation',
  capture: 'cap44b:capture',
  coordination: 'coo44b:coordination',
  expert: 'exp44b:expert',
  legal: 'leg44b:legal',
  legal2: 'leg2-44b:legal',
  approver: 'app44b:approver',
  approver2: 'app2-44b:approver',
  podium: 'pod44b:podium',
  observer: 'obs44b:observer',
} as const;
const NINE_ROLES = [ACT.admin, ACT.moderation, ACT.capture, ACT.coordination, ACT.expert, ACT.legal, ACT.approver, ACT.podium, ACT.observer];
/** The reader circle of the justification, written down here independently of the core (044a, SG2). */
const JUSTIFICATION_READERS = new Set(['legal', 'coordination', 'approver']);
const roleOf = (actor: string | undefined): string | undefined => actor?.split(':')[1];

const T0 = Date.parse('2027-04-20T12:00:00.000Z');
const STEP_MS = 1_500;
const KEY = Buffer.alloc(32, 44);
const EIGHT_KEYS = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];
const RULE_ID = /R-[A-Z]+-\d{2}/;

// ---- markers and the response hook (SG2) ----------------------------------------------------------------------------
const markers = { text: new Set<string>(), just: new Set<string>(), never: new Set<string>() };
let markerCount = 0;
interface Markers { text: string; just: string; note: string }
/** Unique markers per call; the trailing `X` keeps `M1X` from matching inside `M10X`. */
function newMarkers(): Markers {
  const n = ++markerCount;
  const m = { text: `WORTLAUT${n}X`, just: `BEGRUENDUNG${n}X`, note: `VERMERK${n}X` };
  markers.text.add(m.text);
  markers.just.add(m.just);
  markers.never.add(m.note);
  return m;
}

const DETAIL = /"detail"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
/**
 * The response hook: the justification marker only for the reader circle, the remark marker and the key
 * `legalClearerIds` never, and no marker in any `detail`. Throws (the test fails) on the first hit.
 */
function hook(role: string | undefined, raw: string, where: string): void {
  const circle = role !== undefined && JUSTIFICATION_READERS.has(role);
  if (!circle) {
    for (const m of markers.just) if (raw.includes(m)) throw new Error(`hook: justification marker ${m} reached ${role ?? 'no actor'} (${where})`);
  }
  for (const m of markers.never) if (raw.includes(m)) throw new Error(`hook: marker ${m} must never appear (${where})`);
  if (raw.includes('legalClearerIds')) throw new Error(`hook: legalClearerIds in a response (${where})`);
  for (const match of raw.matchAll(DETAIL)) {
    const detail = match[1]!;
    for (const m of [...markers.text, ...markers.just, ...markers.never]) {
      if (detail.includes(m)) throw new Error(`hook: marker ${m} in a detail (${where})`);
    }
  }
}

// ---- harness -----------------------------------------------------------------------------------------------------------
interface Line { v: number; ts: string; requestId: string; subjectHash: string | null; operationId: string | null; status: number; latencyMs: number; seq: number | null }
interface H {
  app: App;
  clock: { now: Date };
  step: number;
  sink: ReturnType<typeof createMemorySink>;
  lines(): Line[];
  meetingId: string;
}
interface Answer { version: number; text: string; answerKind?: string; refusalGroundId?: string; refusalGroundHash?: string;
  refusalJustification?: string; sources?: string[] }
interface Q { id: string; version: number; status: string; answers: Answer[]; _actions: string[];
  legalClearance?: { answerVersion?: number }; approval?: { answerVersion: number } }
interface Ev { seq: number; type: string; subjectId: string; payload: Record<string, unknown> & { answer?: Record<string, unknown> } }
interface Problem { status: number; ruleId?: string; detail?: string }

const tracked: { reader: StreamReader; role: string | undefined }[] = [];
beforeEach(() => {
  markers.text.clear();
  markers.just.clear();
  markers.never.clear();
});
afterEach(async () => {
  const open = tracked.splice(0);
  await Promise.all(open.map(({ reader }) => reader.cancel()));
  // Every SSE block any test received, through the hook for its reader.
  for (const { reader, role } of open) for (const block of reader.blocks) hook(role, block.raw, `SSE ${block.event ?? 'block'} for ${role}`);
});

async function world(extra: Partial<CreateAppOptions> = {}, options: { seed?: boolean; step?: number; start?: number } = {}): Promise<H> {
  const sink = createMemorySink();
  const clock = { now: new Date(options.start ?? T0) };
  const app = createApp({ demoEnabled: true, clock: () => clock.now, accessLog: { sink, hashKey: KEY }, ...extra });
  const h: H = { app, clock, step: options.step ?? STEP_MS, sink, lines: () => sink.lines.map((l) => JSON.parse(l) as Line), meetingId: '' };
  if (options.seed ?? true) {
    expect((await call(h, ACT.admin, 'POST', '/v1/demo/seed', { body: { questions: 30, seed: 7 } })).status).toBe(200);
  }
  h.meetingId = (await json<{ id: string }>(await call(h, ACT.admin, 'GET', '/v1/meeting'))).id;
  return h;
}

interface CallOptions { body?: unknown; headers?: Record<string, string> }
/** `req()` (contract check, coverage) plus the clock step and the response hook for the calling actor. */
async function call(h: H, actor: string | undefined, method: string, path: string, opts: CallOptions = {}): Promise<Response> {
  h.clock.now = new Date(h.clock.now.getTime() + h.step);
  const res = await req(h.app, method, path, { ...(actor !== undefined ? { actor } : {}), ...opts });
  if (res.status === 429) throw new Error(`429 on ${method} ${path}: a test setup error, never an expected result`);
  if (!(res.headers.get('content-type') ?? '').startsWith('text/event-stream')) hook(roleOf(actor), await res.clone().text(), `${method} ${path} as ${actor}`);
  return res;
}
async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
async function ok<T>(res: Promise<Response>): Promise<T> {
  const r = await res;
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return json<T>(r);
}

/** Highest seq, paged as admin until the empty page (the seed has more events than one default page). */
async function headSeq(h: H): Promise<number> {
  let after = 0;
  for (;;) {
    const page = await ok<{ items: Ev[] }>(call(h, ACT.admin, 'GET', `/v1/events?after=${after}&limit=5000`));
    if (page.items.length === 0) return after;
    after = page.items.at(-1)!.seq;
  }
}
/** Every event with `seq > after`, paged as admin. */
async function scanEvents(h: H, after: number): Promise<Ev[]> {
  const out: Ev[] = [];
  for (;;) {
    const page = await ok<{ items: Ev[] }>(call(h, ACT.admin, 'GET', `/v1/events?after=${after}&limit=5000`));
    if (page.items.length === 0) return out;
    out.push(...page.items);
    after = page.items.at(-1)!.seq;
  }
}

/** A rejected call: the expected problem, the head unchanged and the call's access-log line with `seq: null`. */
async function rejected(h: H, status: number, ruleId: string | undefined, actor: string | undefined, method: string, path: string, opts: CallOptions = {}): Promise<Problem> {
  const before = await headSeq(h);
  const mark = h.sink.lines.length;
  const res = await call(h, actor, method, path, opts);
  const line = JSON.parse(h.sink.lines[mark]!) as Line;
  const problem = await json<Problem>(res);
  expect(res.status, JSON.stringify(problem)).toBe(status);
  if (ruleId !== undefined) expect(problem.ruleId, JSON.stringify(problem)).toBe(ruleId);
  expect(line.seq).toBeNull();
  expect(line.status).toBe(status);
  expect(await headSeq(h)).toBe(before);
  return problem;
}

const ifMatch = (q: { version: number }): Record<string, string> => ({ 'If-Match': `"v${q.version}"` });
const latest = (q: Q): number => q.answers.at(-1)!.version;
const hasJustification = (q: Q): boolean => q.answers.some((a) => 'refusalJustification' in a);

async function question(h: H, id: string, actor: string = ACT.admin): Promise<Q> {
  return ok<Q>(call(h, actor, 'GET', `/v1/questions/${id}`));
}
async function captured(h: H, text = 'Warum steigen die Kosten der Synthese?'): Promise<Q> {
  const speakers = await ok<{ id: string; version: number }[]>(call(h, ACT.capture, 'GET', '/v1/speakers'));
  const speaker = speakers[0]!;
  const made = await call(h, ACT.capture, 'POST', '/v1/contributions', { headers: ifMatch(speaker), body: { speakerId: speaker.id, text } });
  expect(made.status).toBe(201);
  const contribution = await json<{ id: string }>(made);
  const res = await call(h, ACT.capture, 'POST', `/v1/contributions/${contribution.id}/questions`,
    { headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text }] } });
  expect(res.status).toBe(201);
  return (await json<Q[]>(res))[0]!;
}
async function classified(h: H, track: 'expert_track' | 'podium'): Promise<Q> {
  const q = await captured(h);
  return ok<Q>(call(h, ACT.coordination, 'POST', `/v1/questions/${q.id}/classification`, { headers: ifMatch(q), body: { track } }));
}
async function assigned(h: H): Promise<Q> {
  const q = await classified(h, 'expert_track');
  return ok<Q>(call(h, ACT.coordination, 'POST', `/v1/questions/${q.id}/assignment`, { headers: ifMatch(q), body: { unitId: 'unit-fin' } }));
}
const pathB = (m: Markers): Record<string, unknown> => ({ answerKind: 'refusal_with_ground',
  text: `${m.text} Zu dieser Frage gibt der Vorstand keine Auskunft.`, refusalGroundId: 'aktg-131-3-nr1',
  refusalJustification: `${m.just}: Offenlegung schadet der Gesellschaft.` });
const pathA = (m: Markers): Record<string, unknown> => ({ answerKind: 'refusal_no_claim',
  text: `${m.text} Die Frage betrifft keinen Tagesordnungspunkt.`, refusalJustification: `${m.just}: kein TOP-Bezug erkennbar.` });

function propose(h: H, q: Q, actor: string, body: unknown, headers: Record<string, string> = ifMatch(q)): Promise<Response> {
  return call(h, actor, 'POST', `/v1/questions/${q.id}/refusals`, { headers, body });
}
async function proposed(h: H, q: Q, actor: string, body: unknown): Promise<Q> {
  return ok<Q>(propose(h, q, actor, body));
}
async function cleared(h: H, q: Q, actor: string = ACT.legal2, note?: string): Promise<Q> {
  return ok<Q>(call(h, actor, 'POST', `/v1/questions/${q.id}/legal-clearances`,
    { headers: ifMatch(q), body: { answerVersion: latest(q), ...(note !== undefined ? { note } : {}) } }));
}
function approveRefusal(h: H, q: Q, actor: string = ACT.approver, answerVersion = latest(q), headers: Record<string, string> = ifMatch(q)): Promise<Response> {
  return call(h, actor, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers, body: { answerVersion } });
}
async function staged(h: H, q: Q): Promise<Q> {
  return ok<Q>(call(h, ACT.moderation, 'POST', `/v1/questions/${q.id}/staging`, { headers: ifMatch(q) }));
}
async function delivered(h: H, q: Q): Promise<Q> {
  return ok<Q>(call(h, ACT.podium, 'POST', `/v1/questions/${q.id}/delivery`, { headers: ifMatch(q) }));
}
async function approvedRefusal(h: H, body: unknown, proposer: string = ACT.legal): Promise<Q> {
  const q = await cleared(h, await proposed(h, await assigned(h), proposer, body));
  return ok<Q>(approveRefusal(h, q));
}
async function answerInReview(h: H): Promise<Q> {
  const q = await assigned(h);
  const drafted = await ok<Q>(call(h, ACT.expert, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(q), body: { text: 'Belastbare Antwort.' } }));
  return ok<Q>(call(h, ACT.expert, 'POST', `/v1/questions/${q.id}/review-submissions`, { headers: ifMatch(drafted) }));
}
async function seedQuestionIn(h: H, status: string): Promise<Q> {
  const { items } = await ok<{ items: Q[] }>(call(h, ACT.admin, 'GET', `/v1/questions?status=${status}&limit=1`));
  expect(items.length, status).toBeGreaterThan(0);
  return items[0]!;
}
async function openStream(h: H, actor: string, after: number): Promise<StreamReader> {
  const reader = await mustOpen(h.app, '/v1/stream', { 'X-Actor': actor, 'Last-Event-ID': String(after) });
  tracked.push({ reader, role: roleOf(actor) });
  return reader;
}
const isEventFrame = (seq: number) => (b: SseBlock): boolean => b.event === 'event' && (b.data as { seq: number }).seq === seq;

// ---- tests ---------------------------------------------------------------------------------------------------------------
describe('Scheibe 044b, Test 1: routes are mounted', () => {
  it('listRefusalGrounds: every role of the seed reads seven entries equal to the catalogue; 401 without actor', async () => {
    const h = await world();
    for (const actor of NINE_ROLES) {
      const grounds = await ok<{ id: string; hash: string }[]>(call(h, actor, 'GET', '/v1/refusal-grounds'));
      expect(grounds, actor).toHaveLength(7);
      expect(grounds.map((g) => [g.id, g.hash])).toEqual(REFUSAL_GROUNDS.map((g) => [g.id, g.hash]));
    }
    expect((await call(h, undefined, 'GET', '/v1/refusal-grounds')).status).toBe(401);
  });

  it('proposeRefusal path B (legal) and path A (coordination): 200, in_review, ETag', async () => {
    const h = await world();
    const m = newMarkers();
    const resB = await propose(h, await assigned(h), ACT.legal, pathB(m));
    expect(resB.status).toBe(200);
    const b = await json<Q>(resB);
    expect(resB.headers.get('ETag')).toBe(`"v${b.version}"`);
    expect(b.status).toBe('in_review');
    expect(b.answers.at(-1)).toMatchObject({ answerKind: 'refusal_with_ground', refusalGroundId: 'aktg-131-3-nr1',
      refusalGroundHash: REFUSAL_GROUNDS.find((g) => g.id === 'aktg-131-3-nr1')!.hash });
    const resA = await propose(h, await assigned(h), ACT.coordination, pathA(m));
    expect(resA.status).toBe(200);
    const a = await json<Q>(resA);
    expect(a.status).toBe('in_review');
    expect(a.answers.at(-1)!.answerKind).toBe('refusal_no_claim');
    expect('refusalGroundId' in a.answers.at(-1)!).toBe(false);
    expect('refusalGroundHash' in a.answers.at(-1)!).toBe(false);
  });

  it('approveRefusal after a clearance by a second person, by a third: 200, approved', async () => {
    const h = await world();
    const q = await cleared(h, await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers())));
    const res = await approveRefusal(h, q);
    expect(res.status).toBe(200);
    expect((await json<Q>(res)).status).toBe('approved');
  });
});

describe('Scheibe 044b, Test 2: 401', () => {
  it('both writes without X-Actor', async () => {
    const h = await world();
    const q = await assigned(h);
    await rejected(h, 401, undefined, undefined, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: pathB(newMarkers()) });
    await rejected(h, 401, undefined, undefined, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: ifMatch(q), body: { answerVersion: 1 } });
  });
});

describe('Scheibe 044b, Test 3: 403 and 404', () => {
  it('proposeRefusal without the right: 403 R-PERM-01; podium 404', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    for (const actor of [ACT.expert, ACT.approver, ACT.moderation, ACT.capture, ACT.admin]) {
      await rejected(h, 403, 'R-PERM-01', actor, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: pathB(m) });
    }
    await rejected(h, 404, undefined, ACT.podium, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: pathB(m) });
  });

  it('approveRefusal without the right: 403 R-PERM-01; podium 404', async () => {
    const h = await world();
    const q = await cleared(h, await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers())));
    for (const actor of [ACT.legal, ACT.coordination, ACT.expert, ACT.admin]) {
      await rejected(h, 403, 'R-PERM-01', actor, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: ifMatch(q), body: { answerVersion: latest(q) } });
    }
    await rejected(h, 404, undefined, ACT.podium, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: ifMatch(q), body: { answerVersion: latest(q) } });
  });

  it('observer: 403 on a delivered question, 404 on another status; unknown id 404 for both', async () => {
    const h = await world();
    const m = newMarkers();
    const done = await seedQuestionIn(h, 'delivered');
    const open = await seedQuestionIn(h, 'in_review');
    for (const [q, status] of [[done, 403], [open, 404]] as const) {
      await rejected(h, status, status === 403 ? 'R-PERM-01' : undefined, ACT.observer, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: pathB(m) });
      await rejected(h, status, status === 403 ? 'R-PERM-01' : undefined, ACT.observer, 'POST', `/v1/questions/${q.id}/refusal-approvals`, { headers: ifMatch(q), body: { answerVersion: 1 } });
    }
    await rejected(h, 404, undefined, ACT.legal, 'POST', '/v1/questions/q-unknown-44b/refusals', { headers: { 'If-Match': '"v1"' }, body: pathB(m) });
    await rejected(h, 404, undefined, ACT.approver, 'POST', '/v1/questions/q-unknown-44b/refusal-approvals', { headers: { 'If-Match': '"v1"' }, body: { answerVersion: 1 } });
  });
});

describe('Scheibe 044b, Test 4: 409 with rule id, no event', () => {
  it('R-TRANS-00: proposal from staged and delivered; approveRefusal from answer_drafted', async () => {
    const h = await world();
    const m = newMarkers();
    const onStage = await staged(h, await approvedRefusal(h, pathB(m)));
    await rejected(h, 409, 'R-TRANS-00', ACT.legal, 'POST', `/v1/questions/${onStage.id}/refusals`, { headers: ifMatch(onStage), body: pathB(m) });
    const read = await delivered(h, onStage);
    await rejected(h, 409, 'R-TRANS-00', ACT.legal, 'POST', `/v1/questions/${read.id}/refusals`, { headers: ifMatch(read), body: pathB(m) });
    const p = await proposed(h, await assigned(h), ACT.legal, pathB(m));
    const returned = await ok<Q>(call(h, ACT.admin, 'POST', `/v1/questions/${p.id}/returns`, { headers: ifMatch(p), body: { reason: 'Bitte prüfen.' } }));
    expect(returned.status).toBe('answer_drafted');
    await rejected(h, 409, 'R-TRANS-00', ACT.approver, 'POST', `/v1/questions/${p.id}/refusal-approvals`, { headers: ifMatch(returned), body: { answerVersion: latest(returned) } });
  });

  it('R-GUARD-03: proposal on a podium question in classified', async () => {
    const h = await world();
    const q = await classified(h, 'podium');
    await rejected(h, 409, 'R-GUARD-03', ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: pathB(newMarkers()) });
  });

  it('R-GUARD-09: path B without ground, without justification, with a blank one; path A without justification', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    const { refusalGroundId: _g, ...withoutGround } = pathB(m);
    const { refusalJustification: _j, ...withoutJustification } = pathB(m);
    const { refusalJustification: _a, ...pathAWithout } = pathA(m);
    for (const body of [withoutGround, withoutJustification, { ...pathB(m), refusalJustification: '   ' }, pathAWithout]) {
      await rejected(h, 409, 'R-GUARD-09', ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body });
    }
  });

  it('R-GUARD-08 before R-GUARD-14: approveRefusal without legal clearance', async () => {
    const h = await world();
    const p = await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers()));
    await rejected(h, 409, 'R-GUARD-08', ACT.approver, 'POST', `/v1/questions/${p.id}/refusal-approvals`, { headers: ifMatch(p), body: { answerVersion: latest(p) } });
  });

  it('R-GUARD-06: the proposer clears legally; the proposer id as approver approves', async () => {
    const h = await world();
    const p = await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers()));
    await rejected(h, 409, 'R-GUARD-06', ACT.legal, 'POST', `/v1/questions/${p.id}/legal-clearances`, { headers: ifMatch(p), body: { answerVersion: latest(p) } });
    const c = await cleared(h, p);
    const proposerAsApprover = `${ACT.legal.split(':')[0]}:approver`;
    await rejected(h, 409, 'R-GUARD-06', proposerAsApprover, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: ifMatch(c), body: { answerVersion: latest(c) } });
  });

  it('R-GUARD-14 with a repeated clearance: S clears, K clears again, S as approver 409, a third subject 200', async () => {
    const h = await world();
    // Pre-build check 3: none of these ids has a grant in the seeded meeting, so the header's role applies.
    const assignments = await ok<{ subjectId: string }[]>(call(h, ACT.admin, 'GET', `/v1/meetings/${h.meetingId}/role-assignments`));
    const ids = new Set(Object.values(ACT).map((a) => a.split(':')[0]!).concat(['s44b', 'k44b', 't44b']));
    expect(assignments.filter((a) => ids.has(a.subjectId))).toEqual([]);
    const p = await proposed(h, await assigned(h), ACT.coordination, pathB(newMarkers()));
    const byS = await cleared(h, p, 's44b:legal');
    const byK = await cleared(h, byS, 'k44b:legal');
    await rejected(h, 409, 'R-GUARD-14', 's44b:approver', 'POST', `/v1/questions/${byK.id}/refusal-approvals`, { headers: ifMatch(byK), body: { answerVersion: latest(byK) } });
    const res = await approveRefusal(h, byK, 't44b:approver');
    expect(res.status).toBe(200);
    expect((await json<Q>(res)).status).toBe('approved');
  });

  it('R-GUARD-12: approveQuestion on a refusal version; submitForReview after a return', async () => {
    const h = await world();
    const c = await cleared(h, await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers())));
    await rejected(h, 409, 'R-GUARD-12', ACT.approver, 'POST', `/v1/questions/${c.id}/approvals`, { headers: ifMatch(c), body: { answerVersion: latest(c) } });
    const returned = await ok<Q>(call(h, ACT.admin, 'POST', `/v1/questions/${c.id}/returns`, { headers: ifMatch(c), body: { reason: 'Bitte prüfen.' } }));
    await rejected(h, 409, 'R-GUARD-12', ACT.expert, 'POST', `/v1/questions/${c.id}/review-submissions`, { headers: ifMatch(returned) });
  });

  it('R-GUARD-13: approveRefusal on an answer version after the clearance', async () => {
    const h = await world();
    const c = await cleared(h, await answerInReview(h), ACT.legal);
    await rejected(h, 409, 'R-GUARD-13', ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: ifMatch(c), body: { answerVersion: latest(c) } });
  });

  it('R-GUARD-04: refusal v2 cleared, approveRefusal with answerVersion 1', async () => {
    const h = await world();
    const q = await assigned(h);
    const drafted = await ok<Q>(call(h, ACT.expert, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(q), body: { text: 'Antwort v1.' } }));
    const c = await cleared(h, await proposed(h, drafted, ACT.legal, pathB(newMarkers())));
    expect(latest(c)).toBe(2);
    await rejected(h, 409, 'R-GUARD-04', ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: ifMatch(c), body: { answerVersion: 1 } });
  });

  it('R-GUARD-11: a prepared log with an outdated ground hash, cleared: 409, no approve action', async () => {
    // Pre-build check 4: the events come from a core store (seed, then an `AnswerDrafted` with an outdated
    // `refusalGroundHash`, stamped into the chain by the store); `persistence.load` hands them to the app.
    const store = createInMemoryEventStore();
    let time = T0;
    let current: Actor = SYSTEM_ACTOR;
    const as = (actor: string): void => { const [id, role] = actor.split(':'); current = { id: id!, role: role as Actor['role'] }; };
    const core = createInProcessApi({ store, actor: () => current, clock: () => new Date((time += 1000)), seeder: seedEvents });
    as(ACT.admin);
    await core.seedDemo({ questions: 30, seed: 7 });
    const meetingId = (await core.getMeeting()).id;
    as(ACT.moderation);
    const speaker = await core.registerSpeaker({ displayName: 'Testperson' }, { ifMatch: etagOf((await core.getMeeting()).speakerListVersion) });
    as(ACT.capture);
    const contribution = await core.captureContribution({ speakerId: speaker.id, text: 'Warum?' }, { ifMatch: etagOf(speaker.version) });
    const [capturedQ] = await core.captureQuestions(contribution.id, [{ text: 'Warum?', span: { start: 0, end: 6 } }], { ifMatch: etagOf(contribution.version) });
    as(ACT.coordination);
    const classifiedQ = await core.classifyQuestion(capturedQ!.id, { track: 'expert_track' }, { ifMatch: etagOf(capturedQ!.version) });
    await core.assignQuestion(classifiedQ.id, 'unit-fin', { ifMatch: etagOf(classifiedQ.version) });
    const at = new Date((time += 1000)).toISOString();
    const legal = { id: 'old-legal', role: 'legal' as const };
    store.append([{
      id: `old-${capturedQ!.id}`, type: 'AnswerDrafted', at, actor: legal, subjectId: capturedQ!.id, meetingId,
      payload: {
        answer: { version: 1, text: 'Alter Wortlaut.', createdAt: at, createdBy: legal, answerKind: 'refusal_with_ground',
          refusalGroundId: 'aktg-131-3-nr1', refusalGroundHash: '0'.repeat(64),
          refusalGround: { title: 'Alter Titel', stageText: 'Alter Baustein.', legalRef: REFUSAL_GROUNDS[0]!.legalRef } },
        pii: { keyId: meetingId, refusalJustification: 'Alte Begründung.' },
        toStatus: 'in_review',
      },
    } as NewEvent]);
    const events: readonly DomainEvent[] = [...store.all()];
    const h = await world({ persistence: { load: () => events, save: () => undefined } }, { seed: false, start: time + 3_600_000 });
    const old = await question(h, capturedQ!.id, ACT.legal);
    expect(old.status).toBe('in_review');
    const c = await cleared(h, old);
    await rejected(h, 409, 'R-GUARD-11', ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: ifMatch(c), body: { answerVersion: latest(c) } });
    expect((await question(h, c.id, ACT.approver))._actions).not.toContain('question.refuse.approve');
  });
});

describe('Scheibe 044b, Test 5: 412, 428 and a malformed If-Match', () => {
  it('both operations: stale 412, missing 428, "abc" 422 (from the core, after right and existence)', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    const propose422 = await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: { 'If-Match': 'abc' }, body: pathB(m) });
    expect(propose422.detail).toMatch(/If-Match/);
    await rejected(h, 412, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: { 'If-Match': `"v${q.version - 1}"` }, body: pathB(m) });
    await rejected(h, 428, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: {}, body: pathB(m) });
    // A non-holder with a malformed If-Match still gets 403: the format is checked in the core after the right.
    await rejected(h, 403, 'R-PERM-01', ACT.expert, 'POST', `/v1/questions/${q.id}/refusals`, { headers: { 'If-Match': 'abc' }, body: pathB(m) });

    const c = await cleared(h, await proposed(h, q, ACT.legal, pathB(m)));
    const body = { answerVersion: latest(c) };
    await rejected(h, 412, undefined, ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: { 'If-Match': `"v${c.version - 1}"` }, body });
    await rejected(h, 428, undefined, ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: {}, body });
    const approve422 = await rejected(h, 422, undefined, ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: { 'If-Match': 'abc' }, body });
    expect(approve422.detail).toMatch(/If-Match/);
  });
});

describe('Scheibe 044b, Test 6: 422 of the validator and of the core', () => {
  it('proposeRefusal: every contract violation of the body is a 422 without the value in detail', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    const b = pathB(m);
    const cases: [string, unknown][] = [
      ["answerKind 'answer'", { ...b, answerKind: 'answer' }],
      ['unknown answerKind', { ...b, answerKind: 'refusal_maybe' }],
      ['answerKind not a string', { ...b, answerKind: 5 }],
      ['empty text', { ...b, text: '' }],
      ['text not a string', { ...b, text: 42 }],
      ['text with 20001 characters', { ...b, text: `${m.text}${'x'.repeat(20001 - m.text.length)}` }],
      ['empty justification', { ...b, refusalJustification: '' }],
      ['justification with 4001 characters', { ...b, refusalJustification: `${m.just}${'x'.repeat(4001 - m.just.length)}` }],
      ['justification not a string', { ...b, refusalJustification: 42 }],
      ['ground id with 129 characters', { ...b, refusalGroundId: 'x'.repeat(129) }],
      ['ground id not a string', { ...b, refusalGroundId: 42 }],
      ['sources not an array', { ...b, sources: 'q1' }],
      ['sources with 51 items', { ...b, sources: Array.from({ length: 51 }, (_, i) => `q${i}`) }],
      ['a source with 2001 characters', { ...b, sources: ['x'.repeat(2001)] }],
      ['a source as a number', { ...b, sources: [1] }],
      ['path A with a ground', { ...pathA(m), refusalGroundId: 'aktg-131-3-nr1' }],
      ['an unknown field', { ...b, extra: m.text }],
    ];
    for (const [name, body] of cases) {
      const p = await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body });
      expect(p.detail ?? '', name).not.toContain('xxxxxxxx');
    }
  });

  it('approveRefusal: answerVersion 0, as a string, missing; an extra field', async () => {
    const h = await world();
    const c = await cleared(h, await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers())));
    for (const body of [{ answerVersion: 0 }, { answerVersion: '1' }, {}, { answerVersion: 1, extra: true }]) {
      await rejected(h, 422, undefined, ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: ifMatch(c), body });
    }
  });

  it('the limits pass: text 20000, justification 4000, sources 50 × 2000 ASCII', async () => {
    const h = await world();
    const m = newMarkers();
    const b = pathB(m);
    expect((await proposed(h, await assigned(h), ACT.legal, { ...b, text: 'x'.repeat(20000) })).status).toBe('in_review');
    expect((await proposed(h, await assigned(h), ACT.legal, { ...b, refusalJustification: 'x'.repeat(4000) })).status).toBe('in_review');
    const sources = Array.from({ length: 50 }, (_, i) => `${i}`.padEnd(2000, 'x'));
    expect((await proposed(h, await assigned(h), ACT.legal, { ...b, sources })).answers.at(-1)!.sources).toEqual(sources);
  });

  it('422 of the core: blank text, unknown ground (detail names only the id), empty ground id', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: { ...pathB(m), text: '   ' } });
    const unknown = await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: { ...pathB(m), refusalGroundId: 'aktg-131-3-nr99' } });
    expect(unknown.detail).toBe('Refusal ground aktg-131-3-nr99 is not in the catalogue.');
    await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: { ...pathB(m), refusalGroundId: '' } });
  });

  it('empty justification: "" 422 (validator), "   " 409 R-GUARD-09', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: { ...pathB(m), refusalJustification: '' } });
    await rejected(h, 409, 'R-GUARD-09', ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: { ...pathB(m), refusalJustification: '   ' } });
  });
});

describe('Scheibe 044b, Test 7: lengths in code points (Codex P2 on #131)', () => {
  const EMOJI = '\u{1F600}';
  it('codePointLength counts like Ajv ucs2length', () => {
    for (const s of ['', 'abc', 'Größe', EMOJI, EMOJI.repeat(4000), `ab\uD800`, `\uDC00x`, '\uDE00\uD83D']) {
      expect(codePointLength(s), JSON.stringify(s)).toBe(ucs2length(s));
    }
  });

  it('over HTTP: justification 4000/4001, text 20000/20001, a source 2000/2001 emoji, ground id 129 emoji', async () => {
    const h = await world();
    const m = newMarkers();
    const b = pathB(m);
    expect((await proposed(h, await assigned(h), ACT.legal, { ...b, refusalJustification: EMOJI.repeat(4000) })).status).toBe('in_review');
    expect((await proposed(h, await assigned(h), ACT.legal, { ...b, text: EMOJI.repeat(20000) })).status).toBe('in_review');
    expect((await proposed(h, await assigned(h), ACT.legal, { ...b, sources: [EMOJI.repeat(2000)] })).status).toBe('in_review');
    const q = await assigned(h);
    for (const body of [{ ...b, refusalJustification: EMOJI.repeat(4001) }, { ...b, text: EMOJI.repeat(20001) },
      { ...b, sources: [EMOJI.repeat(2001)] }, { ...b, refusalGroundId: EMOJI.repeat(129) }]) {
      await rejected(h, 422, undefined, ACT.legal, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body });
    }
  });
});

describe('Scheibe 044b, Test 8: idempotency', () => {
  it('the same key and body twice: same version and ETag, no event, the replay carries the justification; stale If-Match is no 412', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    const headers = { ...ifMatch(q), 'Idempotency-Key': 'refusal-44b-1' };
    const first = await propose(h, q, ACT.legal, pathB(m), headers);
    expect(first.status).toBe(200);
    const firstBody = await json<Q>(first);
    const before = await headSeq(h);
    const again = await propose(h, q, ACT.legal, pathB(m), headers);
    expect(again.status).toBe(200);
    const againBody = await json<Q>(again);
    expect(await headSeq(h)).toBe(before);
    expect(again.headers.get('ETag')).toBe(first.headers.get('ETag'));
    expect(latest(againBody)).toBe(latest(firstBody));
    expect(againBody.answers.at(-1)!.refusalJustification).toBe(`${m.just}: Offenlegung schadet der Gesellschaft.`);

    // The same key from another actor is no replay (keys are per actor): a new proposal.
    const other = await propose(h, firstBody, ACT.legal2, pathB(m), { ...ifMatch(firstBody), 'Idempotency-Key': 'refusal-44b-1' });
    expect(other.status).toBe(200);
    expect(latest(await json<Q>(other))).toBe(latest(firstBody) + 1);
  });

  it('approveRefusal twice with the same key: one approval, one QuestionApproved', async () => {
    const h = await world();
    const c = await cleared(h, await proposed(h, await assigned(h), ACT.legal, pathB(newMarkers())));
    const head = await headSeq(h);
    const headers = { ...ifMatch(c), 'Idempotency-Key': 'approve-44b-1' };
    expect((await approveRefusal(h, c, ACT.approver, latest(c), headers)).status).toBe(200);
    expect((await approveRefusal(h, c, ACT.approver, latest(c), headers)).status).toBe(200);
    const approvals = (await scanEvents(h, head)).filter((e) => e.type === 'QuestionApproved' && e.subjectId === c.id);
    expect(approvals).toHaveLength(1);
  });
});

describe('Scheibe 044b, Test 9: masking of the justification over HTTP', () => {
  it('getQuestion, lists, history, events, stream, stage, write answers and search', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    const head = await headSeq(h);
    const adminStream = await openStream(h, ACT.admin, head);
    const legalStream = await openStream(h, ACT.legal, head);
    const p = await proposed(h, q, ACT.legal, pathB(m));

    // getQuestion: the circle reads it, everyone else does not.
    for (const actor of [ACT.legal, ACT.coordination, ACT.approver]) {
      expect((await question(h, p.id, actor)).answers.at(-1)!.refusalJustification, actor).toBe(`${m.just}: Offenlegung schadet der Gesellschaft.`);
    }
    for (const actor of [ACT.admin, ACT.moderation, ACT.capture, ACT.expert]) expect(hasJustification(await question(h, p.id, actor)), actor).toBe(false);

    // Lists.
    for (const [actor, visible] of [[ACT.admin, false], [ACT.moderation, false], [ACT.legal, true]] as const) {
      for (const path of ['/v1/questions?limit=2000', `/v1/meetings/${h.meetingId}/questions?limit=2000`]) {
        const { items } = await ok<{ items: Q[] }>(call(h, actor, 'GET', path));
        const item = items.find((i) => i.id === p.id);
        expect(item, `${path} ${actor}`).toBeDefined();
        expect(hasJustification(item!), `${path} ${actor}`).toBe(visible);
      }
    }

    // History (legal, admin) and the event feed (admin): positive control, no pii, no justification.
    const scanned = await scanEvents(h, head);
    for (const [name, source] of [
      ['history legal', await ok<Ev[]>(call(h, ACT.legal, 'GET', `/v1/questions/${p.id}/history`))],
      ['history admin', await ok<Ev[]>(call(h, ACT.admin, 'GET', `/v1/questions/${p.id}/history`))],
      ['events admin', scanned],
    ] as const) {
      const drafted = source.filter((e) => e.type === 'AnswerDrafted' && e.subjectId === p.id && e.payload.answer?.['answerKind'] !== undefined);
      expect(drafted, name).toHaveLength(1);
      expect('pii' in drafted[0]!.payload, name).toBe(false);
      expect(JSON.stringify(drafted[0]), name).not.toContain('refusalJustification');
      expect(JSON.stringify(drafted[0]), name).not.toContain(m.just);
      expect(drafted[0]!.payload.answer!['refusalGround'], name).toBeDefined();
      expect(drafted[0]!.payload['toStatus'], name).toBe('in_review');
    }
    const draftedSeq = scanned.find((e) => e.type === 'AnswerDrafted' && e.subjectId === p.id)!.seq;

    // Stream: admin receives the event frame of this AnswerDrafted; legal only change frames.
    const frame = await adminStream.until(isEventFrame(draftedSeq), 5_000);
    expect('pii' in (frame.data as Ev).payload).toBe(false);
    expect(frame.raw).not.toContain('refusalJustification');
    await legalStream.until((b) => b.event === 'change' && ((b.data as { subjects?: string[] }).subjects ?? []).includes(p.id), 5_000);
    expect(legalStream.blocks.filter((b) => b.event === 'event')).toEqual([]);

    // Search as legal: a word only in the justification finds nothing, a word of the wording finds it.
    expect((await ok<{ total: number }>(call(h, ACT.legal, 'GET', `/v1/questions?q=${m.just}`))).total).toBe(0);
    expect((await ok<{ total: number }>(call(h, ACT.legal, 'GET', `/v1/questions?q=${m.text}`))).total).toBe(1);

    // Clear, approve, stage (write answer of moderation), both stage routes.
    const approved = await ok<Q>(approveRefusal(h, await cleared(h, p)));
    const onStage = await staged(h, approved);
    expect(hasJustification(onStage)).toBe(false);
    for (const actor of [ACT.approver, ACT.moderation, ACT.podium]) {
      for (const path of ['/v1/stage', `/v1/meetings/${h.meetingId}/stage`]) {
        const stage = await ok<{ current: Q | null; queue: Q[] }>(call(h, actor, 'GET', path));
        const all = [stage.current, ...stage.queue].filter((x): x is Q => x !== null);
        expect(all.some((x) => x.id === p.id), `${path} ${actor}`).toBe(true);
        expect(all.some(hasJustification), `${path} ${actor}`).toBe(false);
      }
    }
    // Deliver and close (podium), observer after delivered.
    const read = await delivered(h, onStage);
    expect(hasJustification(read)).toBe(false);
    expect(hasJustification(await question(h, p.id, ACT.observer))).toBe(false);
    const closed = await ok<Q>(call(h, ACT.podium, 'POST', `/v1/questions/${p.id}/closure`, { headers: ifMatch(read) }));
    expect(hasJustification(closed)).toBe(false);

    // returnQuestion as admin on a proposed refusal.
    const r = await proposed(h, await assigned(h), ACT.legal, pathB(m));
    const returned = await ok<Q>(call(h, ACT.admin, 'POST', `/v1/questions/${r.id}/returns`, { headers: ifMatch(r), body: { reason: 'Bitte prüfen.' } }));
    expect(hasJustification(returned)).toBe(false);

    // Question B: a refusal displaced by a later answer draft (expert), then submitted.
    const b = await proposed(h, await assigned(h), ACT.legal, pathB(m));
    const drafted = await ok<Q>(call(h, ACT.expert, 'POST', `/v1/questions/${b.id}/answers`, { headers: ifMatch(b), body: { text: 'Doch eine Antwort.' } }));
    expect(drafted.answers).toHaveLength(2);
    expect(hasJustification(drafted)).toBe(false);
    const submitted = await ok<Q>(call(h, ACT.expert, 'POST', `/v1/questions/${b.id}/review-submissions`, { headers: ifMatch(drafted) }));
    expect(hasJustification(submitted)).toBe(false);
    expect(hasJustification(await question(h, b.id, ACT.moderation))).toBe(false);
    expect((await question(h, b.id, ACT.legal)).answers[0]!.refusalJustification).toBe(`${m.just}: Offenlegung schadet der Gesellschaft.`);

    // claim, release and withdraw by every role that holds them (read from `_actions`, no role name in the check).
    for (const actor of NINE_ROLES) {
      const current = await call(h, actor, 'GET', `/v1/questions/${b.id}`);
      if (current.status !== 200) continue;
      const view = await json<Q>(current);
      if (!view._actions.includes('question.claim')) continue;
      const claimed = await ok<Q>(call(h, actor, 'POST', `/v1/questions/${b.id}/claim`, { headers: ifMatch(view) }));
      expect(hasJustification(claimed), actor).toBe(JUSTIFICATION_READERS.has(roleOf(actor)!));
      const released = await ok<Q>(call(h, actor, 'POST', `/v1/questions/${b.id}/release`, { headers: ifMatch(claimed) }));
      expect(hasJustification(released), actor).toBe(JUSTIFICATION_READERS.has(roleOf(actor)!));
    }
    let withdrawals = 0;
    for (const actor of NINE_ROLES) {
      const target = await proposed(h, await assigned(h), ACT.legal, pathB(m));
      const view = await call(h, actor, 'GET', `/v1/questions/${target.id}`);
      if (view.status !== 200 || !(await json<Q>(view))._actions.includes('question.withdraw')) continue;
      const withdrawn = await ok<Q>(call(h, actor, 'POST', `/v1/questions/${target.id}/withdrawal`, { headers: ifMatch(target), body: { reason: 'Zurückgezogen.' } }));
      expect(hasJustification(withdrawn), actor).toBe(JUSTIFICATION_READERS.has(roleOf(actor)!));
      withdrawals += 1;
    }
    expect(withdrawals).toBeGreaterThan(0);
  });
});

describe('Scheibe 044b, Test 10: the remark of the legal clearance', () => {
  it('on an answer and on a refusal: in no response, not in history, events or stream', async () => {
    const h = await world();
    const m = newMarkers();
    const answer = await answerInReview(h);
    const refusal = await proposed(h, await assigned(h), ACT.legal, pathB(m));
    for (const [q, clearer] of [[answer, ACT.legal], [refusal, ACT.legal2]] as const) {
      const head = await headSeq(h);
      const stream = await openStream(h, ACT.admin, head);
      const c = await cleared(h, q, clearer, `${m.note} Rechtliche Würdigung.`);
      expect(JSON.stringify(c)).not.toContain(m.note);
      const scanned = (await scanEvents(h, head)).filter((e) => e.type === 'QuestionLegalCleared' && e.subjectId === q.id);
      const history = (await ok<Ev[]>(call(h, ACT.legal, 'GET', `/v1/questions/${q.id}/history`))).filter((e) => e.type === 'QuestionLegalCleared');
      expect(scanned).toHaveLength(1);
      expect(history.length).toBeGreaterThan(0);
      for (const e of [...scanned, ...history]) expect('note' in e.payload).toBe(false);
      const frame = await stream.until(isEventFrame(scanned[0]!.seq), 5_000);
      expect('note' in (frame.data as Ev).payload).toBe(false);
      expect(JSON.stringify(await question(h, q.id, ACT.legal))).not.toContain(m.note);
    }
  });
});

describe('Scheibe 044b, Test 11: the response hook works', () => {
  it('after a repeated clearance every read path for every role passes the hook', async () => {
    const h = await world();
    const m = newMarkers();
    const p = await proposed(h, await assigned(h), ACT.coordination, pathB(m));
    const byS = await cleared(h, p, 's44b:legal', `${m.note} eins`);
    const head = await headSeq(h);
    const byK = await cleared(h, byS, 'k44b:legal', `${m.note} zwei`);
    for (const actor of NINE_ROLES) {
      for (const path of [`/v1/questions/${byK.id}`, '/v1/questions?limit=2000', '/v1/stage', `/v1/meetings/${h.meetingId}/stage`,
        `/v1/questions/${byK.id}/history`]) {
        expect([200, 403, 404], `${path} ${actor}`).toContain((await call(h, actor, 'GET', path)).status);
      }
      const stream = await openStream(h, actor, head);
      expect(await stream.nextMessage(5_000), actor).not.toBeNull();
    }
    expect((await scanEvents(h, head)).some((e) => e.type === 'QuestionLegalCleared' && e.subjectId === byK.id)).toBe(true);
  });

  it('control probe: a constructed body with a marker turns the hook red', () => {
    const m = newMarkers();
    expect(() => hook('moderation', JSON.stringify({ answers: [{ refusalJustification: m.just }] }), 'probe')).toThrow(/justification marker/);
    expect(() => hook('legal', JSON.stringify({ answers: [{ refusalJustification: m.just }] }), 'probe')).not.toThrow();
    expect(() => hook('legal', JSON.stringify({ payload: { note: m.note } }), 'probe')).toThrow(/must never appear/);
    expect(() => hook('approver', JSON.stringify({ legalClearerIds: ['a'] }), 'probe')).toThrow(/legalClearerIds/);
    expect(() => hook('legal', JSON.stringify({ status: 409, detail: `rejected ${m.text}` }), 'probe')).toThrow(/in a detail/);
  });
});

describe('Scheibe 044b, Test 12: response check', () => {
  it('refusal versions pass the contract check without an exception', async () => {
    expect(UNDOCUMENTED_STATUS_EXCEPTIONS).toEqual({});
    const h = await world();
    const m = newMarkers();
    expectValid('proposeRefusal', 200, await proposed(h, await assigned(h), ACT.legal, pathB(m)));
    expectValid('proposeRefusal', 200, await proposed(h, await assigned(h), ACT.coordination, pathA(m)));
  });
});

describe('Scheibe 044b, Test 13: draftAnswer with refusal fields stays an answer (decision 4)', () => {
  it('200, no refusal field, no pii; approver gets question.approve, never question.refuse.approve; approveRefusal 409 R-GUARD-13', async () => {
    const h = await world();
    const m = newMarkers();
    const secret = `NIEMALS${markerCount}X`;
    markers.never.add(secret);
    const q = await assigned(h);
    const head = await headSeq(h);
    const res = await call(h, ACT.expert, 'POST', `/v1/questions/${q.id}/answers`, { headers: ifMatch(q),
      body: { text: `${m.text} Antwort.`, answerKind: 'refusal_with_ground', refusalGroundId: 'aktg-131-3-nr1', refusalJustification: secret } });
    expect(res.status).toBe(200);
    const drafted = await json<Q>(res);
    const version = drafted.answers.at(-1)!;
    for (const key of ['answerKind', 'refusalGroundId', 'refusalGroundHash', 'refusalJustification', 'refusalGround']) expect(key in version, key).toBe(false);
    const events = (await scanEvents(h, head)).filter((e) => e.type === 'AnswerDrafted' && e.subjectId === q.id);
    expect(events).toHaveLength(1);
    expect('pii' in events[0]!.payload).toBe(false);
    expect(JSON.stringify(await question(h, q.id, ACT.legal))).not.toContain(secret);
    const submitted = await ok<Q>(call(h, ACT.expert, 'POST', `/v1/questions/${q.id}/review-submissions`, { headers: ifMatch(drafted) }));
    const c = await cleared(h, submitted, ACT.legal);
    const actions = (await question(h, q.id, ACT.approver))._actions;
    expect(actions).toContain('question.approve');
    expect(actions).not.toContain('question.refuse.approve');
    await rejected(h, 409, 'R-GUARD-13', ACT.approver, 'POST', `/v1/questions/${c.id}/refusal-approvals`, { headers: ifMatch(c), body: { answerVersion: latest(c) } });
  });
});

describe('Scheibe 044b, Test 14: the whole chain over HTTP', () => {
  for (const [name, path] of [['path B', pathB], ['path A', pathA]] as const) {
    it(`${name}: propose → clear → approve → stage → deliver → close`, async () => {
      const h = await world();
      const approved = await approvedRefusal(h, path(newMarkers()), name === 'path A' ? ACT.coordination : ACT.legal);
      expect(approved.status).toBe('approved');
      const onStage = await staged(h, approved);
      expect(onStage.status).toBe('staged');
      const head = await headSeq(h);
      const read = await delivered(h, onStage);
      expect(read.status).toBe('delivered');
      const delivery = (await scanEvents(h, head)).find((e) => e.type === 'QuestionDelivered' && e.subjectId === read.id)!;
      expect(delivery.payload['answerVersion']).toBe(latest(approved));
      const closed = await ok<Q>(call(h, ACT.podium, 'POST', `/v1/questions/${read.id}/closure`, { headers: ifMatch(read) }));
      expect(closed.status).toBe('closed');
    });
  }
});

describe('Scheibe 044b, Test 15: access log unchanged, detection by operationId and status', () => {
  it('eight keys, 409 and 403 lines with seq null, a 200 with seq; no marker and no rule id in a line', async () => {
    const h = await world();
    const m = newMarkers();
    const q = await assigned(h);
    h.sink.lines.length = 0;
    await rejected(h, 403, 'R-PERM-01', ACT.expert, 'POST', `/v1/questions/${q.id}/refusals`, { headers: ifMatch(q), body: pathB(m) });
    const p = await proposed(h, q, ACT.legal, pathB(m));
    await rejected(h, 409, 'R-GUARD-08', ACT.approver, 'POST', `/v1/questions/${p.id}/refusal-approvals`, { headers: ifMatch(p), body: { answerVersion: latest(p) } });
    await cleared(h, p, ACT.legal2, `${m.note} Würdigung.`);
    const lines = h.lines();
    const refusalLines = lines.filter((l) => l.operationId === 'proposeRefusal' || l.operationId === 'approveRefusal');
    expect(refusalLines.length).toBe(3);
    for (const line of lines) expect(Object.keys(line).sort()).toEqual(EIGHT_KEYS);
    expect(refusalLines).toEqual([
      expect.objectContaining({ operationId: 'proposeRefusal', status: 403, seq: null }),
      expect.objectContaining({ operationId: 'proposeRefusal', status: 200, seq: expect.any(Number) }),
      expect.objectContaining({ operationId: 'approveRefusal', status: 409, seq: null }),
    ]);
    for (const raw of h.sink.lines) {
      expect(raw).not.toMatch(RULE_ID);
      for (const marker of [m.text, m.just, m.note]) expect(raw).not.toContain(marker);
    }
  });
});

describe('Scheibe 044b, Test 16: metric against a baseline', () => {
  it('hv_questions_in_legal_review_over_10m: +1 at t0 + 11 min, equal at t0 + 9 min', async () => {
    const TOKEN = 'synthetic-metrics-token-044b-0123456789ab';
    const trial = await world({ metricsToken: TOKEN }, { step: 0 });
    const control = await world({ metricsToken: TOKEN }, { step: 0 });
    const qTrial = await assigned(trial);
    await assigned(control);
    const t0 = trial.clock.now.getTime();
    control.clock.now = new Date(t0);
    await proposed(trial, qTrial, ACT.legal, pathB(newMarkers()));
    const value = async (h: H, at: number): Promise<number> => {
      h.clock.now = new Date(at);
      const res = await req(h.app, 'GET', '/metrics', { headers: { Authorization: `Bearer ${TOKEN}` } });
      expect(res.status).toBe(200);
      const line = (await res.text()).split('\n').find((l) => l.startsWith('hv_questions_in_legal_review_over_10m{'))!;
      return Number(line.split(' ').at(-1));
    };
    expect(await value(trial, t0 + 9 * 60_000)).toBe(await value(control, t0 + 9 * 60_000));
    expect(await value(trial, t0 + 11 * 60_000)).toBe((await value(control, t0 + 11 * 60_000)) + 1);
  });
});
