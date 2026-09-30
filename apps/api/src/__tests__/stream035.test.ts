/**
 * Slice 035b, tests 12–23c and the real-server test: the SSE service over the in-memory persistence
 * (no Postgres). Visibility per reader comes from the domain (035a, R-PERM-04); these tests prove
 * the service around it: opening, limits, reservation, resumption without gap, the handover from
 * catch-up to live, rights and session checks per batch and heartbeat, backpressure, the access log,
 * the meeting filter and the distributor's own continuity check.
 *
 * Two apps: the demo header (`X-Actor`, tests only; no session check) and the session sign-in with a
 * test `authStore` whose grants come from the same log the app writes (`persistence.save`).
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { serve } from '@hono/node-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CORPUS_DEMO, SYSTEM_ACTOR, createInMemoryEventStore, createInProcessApi, seedEvents,
  type DomainEvent, type NewEvent, type Role,
} from '@hv/domain';
import { createApp, type App, type CreateAppOptions } from '../app.ts';
import type { AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { SESSION_IDLE_MS } from '../auth/sessions.ts';
import { DEFAULT_STREAM_LIMITS, STREAM_LIFETIME_MS, type StreamLimits } from '../limits/config.ts';
import { req } from './helpers.ts';
import { createSessionChecker } from '../stream/sessionCheck.ts';
import { StreamReader, eventually, idOf, mustOpen, openStream, sleep, type SseBlock } from './stream-reader035.ts';

// Test 23 (m8): the distributor's store listener only schedules. The spy passes every call through and
// keeps the stack, so a call made synchronously inside `store.append` (a listener doing work) shows.
const visibleCalls = vi.hoisted(() => ({ stacks: [] as string[] }));
vi.mock('@hv/domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hv/domain')>();
  return {
    ...actual,
    visibleMessages: (...args: Parameters<typeof actual.visibleMessages>) => {
      visibleCalls.stacks.push(new Error('trace').stack ?? '');
      return actual.visibleMessages(...args);
    },
  };
});

// Codex P1 on #107: count the frames the service builds (a passthrough spy on the frame builder).
const frameCalls = vi.hoisted(() => ({ count: 0 }));
vi.mock('../stream/sse.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../stream/sse.ts')>();
  return {
    ...actual,
    messageFrame: (...args: Parameters<typeof actual.messageFrame>) => {
      frameCalls.count += 1;
      return actual.messageFrame(...args);
    },
  };
});

const at0 = new Date('2027-04-20T10:15:00.000Z');
const MEETING = 'hv-2027';
const OTHER = 'hv-2026';
const ISSUER = 'https://idp.example.invalid/realms/hv';

interface Person { key: string; role: Role; unitId?: string; meetingId?: string; expiresInMs?: number }
const PEOPLE: readonly Person[] = [
  { key: 'admin', role: 'admin' }, { key: 'moderation', role: 'moderation' }, { key: 'capture', role: 'capture' },
  { key: 'expert', role: 'expert', unitId: 'unit-fin' }, { key: 'podium', role: 'podium' },
  // Two grants in one meeting: the oldest active one decides the actor (capture), revoking it narrows to moderation.
  { key: 'multi', role: 'capture' }, { key: 'multi', role: 'moderation' },
  { key: 'temp', role: 'capture', expiresInMs: 10 * 60_000 },
  { key: 'admin2', role: 'admin', meetingId: OTHER },
  // Review 035b minor 5 (b): an expert whose grant moves to another unit (revoke and new grant in one batch).
  { key: 'unitswap', role: 'expert', unitId: 'unit-fin' },
];
const subject = (key: string): string => `subject-${key}`;
const token = (key: string, n = 1): string => `tok_${key}_${n}_`.padEnd(48, 'x');
const csrf = (key: string, n = 1): string => `c${token(key, n)}`;

/** The demo corpus, the grants above and a second meeting (older date, so the alias stays on hv-2027). */
let corpusCache: { events: DomainEvent[]; assignments: Map<string, string[]> } | undefined;
async function corpus(): Promise<{ events: DomainEvent[]; assignments: Map<string, string[]> }> {
  if (corpusCache) return corpusCache;
  const store = createInMemoryEventStore();
  let id = 0;
  const idGenerator = (): string => `boot-${++id}`;
  const domain = createInProcessApi({ store, actor: () => SYSTEM_ACTOR, clock: () => at0, idGenerator, seeder: seedEvents });
  await domain.seedDemo({ questions: CORPUS_DEMO.questions, roundSizes: CORPUS_DEMO.roundSizes, seed: CORPUS_DEMO.seed });
  const meeting: NewEvent = { id: 'm-2026', type: 'MeetingCreated', at: at0.toISOString(), actor: SYSTEM_ACTOR,
    subjectId: OTHER, meetingId: OTHER, payload: { title: 'HV 2026', date: '2026-04-20', agendaItems: [], units: [] } } as NewEvent;
  const assignments = new Map<string, string[]>();
  for (const person of PEOPLE.filter((p) => p.meetingId === undefined)) {
    const assignment = await domain.assignRole({ subjectId: subject(person.key), role: person.role,
      ...(person.unitId !== undefined ? { unitId: person.unitId } : {}),
      ...(person.expiresInMs !== undefined ? { expiresAt: new Date(at0.getTime() + person.expiresInMs).toISOString() } : {}) });
    assignments.set(person.key, [...(assignments.get(person.key) ?? []), assignment.id]);
  }
  store.append([meeting]);
  const other = createInProcessApi({ store, actor: () => SYSTEM_ACTOR, clock: () => at0, idGenerator, meetingId: OTHER });
  for (const person of PEOPLE.filter((p) => p.meetingId === OTHER)) {
    const assignment = await other.assignRole({ subjectId: subject(person.key), role: person.role });
    assignments.set(person.key, [...(assignments.get(person.key) ?? []), assignment.id]);
  }
  corpusCache = { events: [...store.all()], assignments };
  return corpusCache;
}

interface Harness {
  app: App;
  log: () => readonly DomainEvent[];
  head: () => number;
  clock: { now: Date; advance(ms: number): void };
  /** Session mode only. */
  sessions: Map<string, { actorId: string; csrfToken: string }>;
  blocked: Set<string>;
  idleExpired: Set<string>;
  readSessionCalls: { token: string; slideIdle: boolean }[];
  /** The session check throws for this token (the stream's own check; other sessions still pass). */
  failReadSession: { token?: string };
  /** The session check for this token waits for `until` (a gate the test controls). */
  hang: { token?: string; until?: Promise<void> };
  hooks: {
    load?: ((log: readonly DomainEvent[]) => readonly DomainEvent[]) | undefined;
    handover?: (() => Promise<void>) | undefined;
    reloads: number;
    reloadStarts: number[];
    appliedHead: number;
    windows: { kind: string; phase: string; occasion?: string }[];
  };
  accessLines: string[];
}

const apps: App[] = [];
const readers: StreamReader[] = [];
afterEach(async () => {
  await Promise.all(readers.splice(0).map((r) => r.cancel()));
  apps.splice(0);
});
const track = (reader: StreamReader): StreamReader => { readers.push(reader); return reader; };

async function harness(options: { session?: boolean; streamLimits?: Partial<StreamLimits>; extra?: Partial<CreateAppOptions>;
  sessionsPerPerson?: number; events?: DomainEvent[] } = {}): Promise<Harness> {
  const events = options.events ?? (await corpus()).events;
  let log: readonly DomainEvent[] = events;
  const clock = { now: new Date(at0), advance(ms: number) { this.now = new Date(this.now.getTime() + ms); } };
  const sessions = new Map<string, { actorId: string; csrfToken: string }>();
  const keys = [...new Set(PEOPLE.map((p) => p.key)), 'late', 'nobody'];
  for (const key of keys) {
    for (let n = 1; n <= (options.sessionsPerPerson ?? 3); n++) sessions.set(token(key, n), { actorId: subject(key), csrfToken: csrf(key, n) });
  }
  const blocked = new Set<string>();
  const idleExpired = new Set<string>();
  const readSessionCalls: { token: string; slideIdle: boolean }[] = [];
  const failReadSession: { token?: string } = {};
  const hang: { token?: string; until?: Promise<void> } = {};
  const later = (ms: number): Date => new Date(clock.now.getTime() + ms);
  const authStore: AuthStore = {
    async createLoginState() {},
    async consumeLoginState() { return null; },
    async createSession() { throw new Error('not used'); },
    async readSession(value, _now, slideIdle = true) {
      readSessionCalls.push({ token: value, slideIdle });
      if (failReadSession.token === value) throw new Error('synthetic session store failure');
      if (hang.token === value && hang.until) await hang.until;
      const s = sessions.get(value);
      if (!s || blocked.has(s.actorId) || idleExpired.has(value)) return null;
      return { ...s, expiresAt: later(14 * 3_600_000), idleExpiresAt: later(1_800_000) };
    },
    async verifyCsrf(value, submitted) { return sessions.get(value)?.csrfToken === submitted; },
    async revokeSession(value) { return sessions.delete(value); },
    async blockSubject(actorId) { blocked.add(actorId); },
    async isSubjectBlocked(actorId) { return blocked.has(actorId); },
  };
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
    async complete() { return { issuer: ISSUER, subject: 'unused' }; },
  };
  const hooks: Harness['hooks'] = { reloads: 0, reloadStarts: [], appliedHead: 0, windows: [] };
  const accessLines: string[] = [];
  let id = 0;
  const app = createApp({
    ...(options.session
      ? { demoEnabled: false, oidcIssuer: ISSUER, oidcFlow, authStore, authEvents: async () => log }
      : { demoEnabled: true }),
    persistence: { load: () => events, save: (all) => { log = [...all]; } },
    clock: () => clock.now,
    idGenerator: () => `req-${++id}-${randomUUID().slice(0, 8)}`,
    accessLog: { sink: { write: (line: string) => { accessLines.push(line); } }, hashKey: Buffer.alloc(32, 7) },
    ...(options.streamLimits !== undefined ? { streamLimits: options.streamLimits } : {}),
    testHooks: {
      streamLoad: (loaded) => (hooks.load ? hooks.load(loaded) : loaded),
      streamHandover: async () => { if (hooks.handover) await hooks.handover(); },
      streamWindow: (kind, phase, occasion) => {
        hooks.windows.push({ kind, phase, ...(occasion !== undefined ? { occasion } : {}) });
        if (kind === 'reload' && phase === 'end') hooks.reloads += 1;
        if (kind === 'reload' && phase === 'start') hooks.reloadStarts.push(performance.now());
      },
      streamApplied: (head) => { hooks.appliedHead = head; },
    },
    ...options.extra,
  });
  apps.push(app);
  return { app, log: () => log, head: () => log.length, clock, sessions, blocked, idleExpired, readSessionCalls,
    failReadSession, hang, hooks, accessLines };
}

const asSession = (key: string, n = 1): Record<string, string> => ({ Cookie: `hv_session=${token(key, n)}` });
const asDemo = (actor: string): Record<string, string> => ({ 'X-Actor': actor });

/** A write in session mode (cookie, CSRF, idempotency key) or demo mode (header). */
async function call(h: Harness, who: string, method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  const identity = who.includes(':') ? asDemo(who) : { ...asSession(who), ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrf(who) }) };
  return h.app.request(path, { method, headers: { ...identity,
    ...(method === 'GET' ? {} : { 'Idempotency-Key': randomUUID() }), ...headers,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function ok<T>(response: Promise<Response>): Promise<T> {
  const r = await response;
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return await r.json() as T;
}
let fillers = 0;
/** One `RoleAssigned` for a fresh subject: an event every `event.read` reader sees, invisible to others. */
async function assignFiller(h: Harness, who: string, meetingId = MEETING): Promise<{ id: string }> {
  return ok(call(h, who, 'POST', `/v1/meetings/${meetingId}/role-assignments`, {}, { subjectId: `filler-${++fillers}`, role: 'observer' }));
}
/** A speaker registration: visible to every reader with `speaker.read` (topic `speakers`, the speaker's id). */
async function registerSpeaker(h: Harness, who: string): Promise<{ id: string }> {
  const list = await call(h, who, 'GET', `/v1/meetings/${MEETING}/speakers`);
  expect(list.status).toBe(200);
  return ok(call(h, who, 'POST', `/v1/meetings/${MEETING}/speakers`, { 'If-Match': list.headers.get('ETag')! }, { displayName: `Synthetische Person ${++fillers}` }));
}
type Q = { id: string; version: number; status: string; unitId?: string };
async function questionIn(h: Harness, status: string, unitId?: string): Promise<Q> {
  const list = await ok<{ items: Q[] }>(call(h, 'admin', 'GET', `/v1/questions?status=${status}&limit=200`));
  const found = list.items.find((q) => unitId === undefined || q.unitId === unitId);
  if (!found) throw new Error(`no question in ${status}`);
  return found;
}
async function questionWrite(h: Harness, q: Q, action: string, body?: unknown): Promise<Q> {
  return ok(call(h, 'admin', 'POST', `/v1/questions/${q.id}/${action}`, { 'If-Match': `"v${q.version}"` }, body));
}
async function revokeGrant(h: Harness, key: string, index = 0, meetingId = MEETING): Promise<void> {
  const { assignments } = await corpus();
  await ok(call(h, 'admin', 'POST', `/v1/meetings/${meetingId}/role-assignments/${assignments.get(key)![index]}/revocation`, {}, { reason: 'Test' }));
}
const isEvent = (b: SseBlock): boolean => b.event === 'event';
const kinds = (blocks: readonly SseBlock[]): string[] => blocks.map((b) => b.event ?? '');

describe('Scheibe 035b: SSE stream without Postgres', () => {
  // ---- 12 ---------------------------------------------------------------------------------------------------------
  it('12 opens with 200, the headers of decision 7, `retry: 3000` first, then the heartbeat', async () => {
    expect(DEFAULT_STREAM_LIMITS.heartbeatMs).toBe(15_000);
    const h = await harness({ streamLimits: { heartbeatMs: 200 } });
    const opened = await openStream(h.app, '/v1/stream', asDemo('admin:admin'));
    expect(opened.res.status).toBe(200);
    expect(opened.res.headers.get('Content-Type')).toBe('text/event-stream; charset=utf-8');
    expect(opened.res.headers.get('Cache-Control')).toBe('no-store, no-transform');
    expect(opened.res.headers.get('X-Accel-Buffering')).toBe('no');
    expect(opened.res.headers.get('Content-Encoding')).toBeNull();
    expect(opened.res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(opened.res.headers.get('X-Server-Time')).not.toBeNull();
    const reader = track(opened.reader!);
    const first = await reader.next();
    expect(first?.raw).toBe('retry: 3000');
    await reader.until((b) => b.comment !== undefined, 1_000);
  });

  it('12 error cases: 401, 403 R-PERM-01, 422 for Last-Event-ID, 404 meeting, CORS preflight with Last-Event-ID', async () => {
    const h = await harness({ session: true, extra: { corsOrigins: ['https://hv.example.test'] } });
    expect((await req(h.app, 'GET', '/v1/stream')).status).toBe(401);
    const forbidden = await req(h.app, 'GET', '/v1/stream', { headers: asSession('nobody') });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ ruleId: 'R-PERM-01' });
    expect((await req(h.app, 'GET', '/v1/stream', { headers: { ...asSession('admin'), 'Last-Event-ID': 'abc' } })).status).toBe(422);
    expect((await req(h.app, 'GET', '/v1/stream', { headers: { ...asSession('admin'), 'Last-Event-ID': '9007199254740992' } })).status).toBe(422);
    expect((await req(h.app, 'GET', '/v1/stream?meetingId=hv-1999', { headers: asSession('admin') })).status).toBe(404);
    const preflight = await h.app.request('/v1/stream', { method: 'OPTIONS', headers: { Origin: 'https://hv.example.test',
      'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'last-event-id' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://hv.example.test');
    expect(preflight.headers.get('Access-Control-Allow-Headers') ?? '').toMatch(/Last-Event-ID/i);
  });

  it('12 demo header: a meeting filter without an actor of the reader in that meeting is 403 R-PERM-01', async () => {
    const h = await harness();
    const { assignments } = await corpus();
    await ok(call(h, 'admin:admin', 'POST', `/v1/meetings/${MEETING}/role-assignments/${assignments.get('capture')![0]}/revocation`, {}, { reason: 'Test' }));
    const res = await req(h.app, 'GET', `/v1/stream?meetingId=${MEETING}`, { headers: asDemo(`${subject('capture')}:capture`) });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ruleId: 'R-PERM-01' });
  });

  // ---- 13 ---------------------------------------------------------------------------------------------------------
  it('13 reconnect with Last-Event-ID, with after, with both: exactly the missed events, no double; other meetings too', async () => {
    const h = await harness({ session: true });
    const head = h.head();
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    expect(idOf((await reader.nextMessage())!)).toBe(head);
    for (let i = 0; i < 3; i++) await assignFiller(h, 'admin');
    const live = await reader.messagesUntil((b) => isEvent(b) && idOf(b) === head + 3);
    expect(live.map(idOf)).toEqual([head + 1, head + 2, head + 3]);
    await reader.cancel();
    const k = head + 3;
    await assignFiller(h, 'admin');
    await assignFiller(h, 'admin2', OTHER); // a meeting without an own grant of `admin` (M5)
    await assignFiller(h, 'admin');
    const m = h.head();
    expect(m).toBe(k + 3);
    const expectResume = async (headers: Record<string, string>, path = '/v1/stream'): Promise<void> => {
      const again = track(await mustOpen(h.app, path, { ...asSession('admin'), ...headers }));
      const blocks = await again.messagesUntil((b) => b.event === 'cursor');
      if (Object.keys(headers).length > 0 && path === '/v1/stream') {
        console.log(`035b test 13 raw: ${again.blocks.map((b) => b.raw.replaceAll('\n', ' | ').slice(0, 120)).join(' || ')}`);
      }
      expect(kinds(blocks)).toEqual(['event', 'event', 'event', 'cursor']);
      expect(blocks.slice(0, 3).map(idOf)).toEqual([k + 1, k + 2, k + 3]);
      expect(blocks.slice(0, 3).map((b) => (b.data as { seq: number }).seq)).toEqual([k + 1, k + 2, k + 3]);
      expect((blocks[1]!.data as { meetingId: string }).meetingId).toBe(OTHER);
      expect(idOf(blocks[3]!)).toBe(m);
      await again.cancel();
    };
    await expectResume({ 'Last-Event-ID': String(k) });
    await expectResume({}, `/v1/stream?after=${k}`);
    await expectResume({ 'Last-Event-ID': String(k) }, '/v1/stream?after=0');
  }, 30_000);

  it('13a commit during the handover: admin gets …H, H+1, H+2 without gap or double; capture one covering change', async () => {
    const h = await harness({ session: true });
    const runHandover = async (who: string, cursor: 'with' | 'without'): Promise<{ blocks: SseBlock[]; H: number; speakers: string[] }> => {
      let release!: () => void;
      let reached!: () => void;
      const reachedP = new Promise<void>((resolve) => { reached = resolve; });
      h.hooks.handover = () => { h.hooks.handover = undefined; reached(); return new Promise<void>((resolve) => { release = resolve; }); };
      const H = h.head();
      const opening = mustOpen(h.app, '/v1/stream', { ...asSession(who), ...(cursor === 'with' ? { 'Last-Event-ID': String(H - 2) } : {}) });
      await reachedP;
      const a = await registerSpeaker(h, 'admin');
      const b = await registerSpeaker(h, 'admin');
      await eventually(() => h.hooks.appliedHead === H + 2, 3_000, 'distributor applied both');
      release();
      const reader = track(await opening);
      const blocks = await reader.during(800);
      return { blocks, H, speakers: [a.id, b.id] };
    };
    const admin = await runHandover('admin', 'with');
    expect(kinds(admin.blocks)).toEqual(['event', 'event', 'cursor', 'event', 'event']);
    expect(admin.blocks.map(idOf)).toEqual([admin.H - 1, admin.H, admin.H, admin.H + 1, admin.H + 2]);
    const capture = await runHandover('capture', 'with');
    const changes = capture.blocks.filter((b) => b.event === 'change');
    const live = changes.filter((b) => (b.data as { replay?: true }).replay === undefined);
    expect(live).toHaveLength(1);
    expect(idOf(live[0]!)).toBeGreaterThan(capture.H);
    expect(idOf(live[0]!)).toBe(capture.H + 2);
    expect((live[0]!.data as { topics: string[] }).topics).toContain('speakers');
    expect((live[0]!.data as { subjects: string[] }).subjects).toEqual(expect.arrayContaining(capture.speakers));
    const fresh = await runHandover('admin', 'without');
    expect(kinds(fresh.blocks)).toEqual(['cursor', 'event', 'event']);
    expect(fresh.blocks.map(idOf)).toEqual([fresh.H, fresh.H + 1, fresh.H + 2]);
  }, 30_000);

  it('13b `cursor` right after opening without cursor and right after a completed catch-up', async () => {
    const h = await harness({ session: true });
    const head = h.head();
    const plain = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    expect((await plain.next())?.retry).toBe(3000);
    const first = (await plain.next())!;
    expect(first.event).toBe('cursor');
    expect(idOf(first)).toBe(head);
    expect(first.data).toEqual({ seq: head });
    const resumed = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin'), 'Last-Event-ID': String(head - 2) }));
    const blocks = await resumed.messagesUntil((b) => b.event === 'cursor');
    expect(kinds(blocks)).toEqual(['event', 'event', 'cursor']);
    expect(blocks.map(idOf)).toEqual([head - 1, head, head]);
  });

  it('13c after `reset` a reconnect without cursor gets `cursor` with the head at once, no second reset', async () => {
    const h = await harness({ session: true });
    const head = h.head();
    const beyond = track(await mustOpen(h.app, '/v1/stream', { ...asSession('capture'), 'Last-Event-ID': String(head + 5) }));
    const rest = await beyond.rest();
    expect(kinds(rest)).toEqual(['reset']);
    expect(rest[0]!.id).toBeUndefined();
    expect(rest[0]!.data).toEqual({ lastSeq: head });
    const again = track(await mustOpen(h.app, '/v1/stream', asSession('capture')));
    const next = (await again.nextMessage())!;
    expect(next.event).toBe('cursor');
    expect(idOf(next)).toBe(head);
    expect(await again.during(300)).toEqual([]);
  });

  // ---- 14 ---------------------------------------------------------------------------------------------------------
  it('14 readers without event.read after a disconnect: replay change or reset (podium, moderation, expert, capture)', async () => {
    const h = await harness({ session: true });
    const resumeAfter = async (who: string, write: () => Promise<unknown>): Promise<SseBlock[]> => {
      const cursor = h.head();
      await write();
      const reader = track(await mustOpen(h.app, '/v1/stream', { ...asSession(who), 'Last-Event-ID': String(cursor) }));
      const out = await reader.messagesUntil((b) => b.event === 'cursor' || b.event === 'reset');
      await reader.cancel();
      return out;
    };
    // podium: a question is put on the stage -> reset (every stage.read reader is item-bound for `stage`).
    const approved = await questionIn(h, 'approved');
    const staged = await resumeAfter('podium', () => questionWrite(h, approved, 'staging'));
    expect(kinds(staged)).toEqual(['reset']);
    // moderation: another question on the stage -> reset; only a classification -> change with replay: true.
    const approved2 = await questionIn(h, 'approved');
    expect(kinds(await resumeAfter('moderation', () => questionWrite(h, approved2, 'staging')))).toEqual(['reset']);
    const captured = await questionIn(h, 'captured');
    const classified = await resumeAfter('moderation', () => questionWrite(h, captured, 'classification', { track: 'expert_track' }));
    expect(kinds(classified)).toEqual(['change', 'cursor']);
    expect(classified[0]!.data).toMatchObject({ replay: true, topics: expect.arrayContaining(['questions']), subjects: [captured.id] });
    // expert (unit-fin): a question of the unit is assigned away -> reset (M3).
    const mine = await questionIn(h, 'assigned', 'unit-fin');
    expect(kinds(await resumeAfter('expert', () => questionWrite(h, mine, 'assignment', { unitId: 'unit-ops' })))).toEqual(['reset']);
    // capture: a speaker registration -> one change with replay: true.
    const speakers = await resumeAfter('capture', () => registerSpeaker(h, 'admin'));
    expect(kinds(speakers)).toEqual(['change', 'cursor']);
    expect(speakers[0]!.data).toMatchObject({ replay: true, topics: expect.arrayContaining(['speakers']) });
    expect(idOf(speakers[0]!)).toBe(h.head());
  }, 30_000);

  // ---- 15 ---------------------------------------------------------------------------------------------------------
  it('15 cursor beyond the head and a range over 1000 events answer `reset` without id; the stream closes', async () => {
    const h = await harness({ session: true });
    const head = h.head();
    expect(head).toBeGreaterThan(1_001);
    for (const cursor of [head + 1, head - 1_001]) {
      const reader = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin'), 'Last-Event-ID': String(cursor) }));
      const rest = await reader.rest();
      expect(kinds(rest)).toEqual(['reset']);
      expect(rest[0]!.id).toBeUndefined();
      expect(reader.closed).toBe(true);
    }
    // Exactly 1000 is still a catch-up.
    const edge = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin'), 'Last-Event-ID': String(head - 1_000) }));
    const blocks = await edge.messagesUntil((b) => b.event === 'cursor', 10_000);
    expect(blocks.filter(isEvent)).toHaveLength(1_000);
  }, 30_000);

  // ---- 16 ---------------------------------------------------------------------------------------------------------
  it('16 RoleRevoked ends with forbidden and delivers nothing of that batch', async () => {
    const h = await harness({ session: true });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('capture')));
    await reader.nextMessage();
    await revokeGrant(h, 'capture');
    const rest = await reader.rest();
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'forbidden' });
    expect(rest[0]!.id).toBeUndefined();
  });

  it('16 a narrowed grant ends with roles_changed; so does RoleAssigned in a second meeting (M4)', async () => {
    const h = await harness({ session: true });
    const multi = track(await mustOpen(h.app, '/v1/stream', asSession('multi')));
    await multi.nextMessage();
    await revokeGrant(h, 'multi', 0); // the older capture grant: moderation decides from now on
    const rest = await multi.rest();
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'roles_changed' });
    const capture = track(await mustOpen(h.app, '/v1/stream', asSession('capture')));
    await capture.nextMessage();
    await ok(call(h, 'admin2', 'POST', `/v1/meetings/${OTHER}/role-assignments`, {}, { subjectId: subject('capture'), role: 'observer' }));
    const second = await capture.rest();
    expect(kinds(second)).toEqual(['end']);
    expect(second[0]!.data).toEqual({ reason: 'roles_changed' });
  });

  it('16 an expired grant (injected clock) ends with forbidden at the next heartbeat', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 150 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('temp')));
    await reader.nextMessage();
    await sleep(400);
    expect(reader.closed).toBe(false);
    h.clock.advance(11 * 60_000);
    const rest = await reader.rest(2_000);
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'forbidden' });
  });

  // ---- 17 ---------------------------------------------------------------------------------------------------------
  it('17 sign-out, subject block and idle expiry end with session before the next delivery; checks only with slideIdle false', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 200 } });
    // Sign-out, then a visible batch.
    const out = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await out.nextMessage();
    const opened = h.readSessionCalls.length;
    h.sessions.delete(token('admin'));
    await assignFiller(h, 'admin2', OTHER);
    const rest = await out.rest();
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'session' });
    expect(h.readSessionCalls.slice(opened).filter((c) => c.token === token('admin')).every((c) => !c.slideIdle)).toBe(true);
    // Subject block.
    const blockedReader = track(await mustOpen(h.app, '/v1/stream', asSession('moderation')));
    await blockedReader.nextMessage();
    h.blocked.add(subject('moderation'));
    const blockedRest = await blockedReader.rest(2_000);
    expect(kinds(blockedRest)).toEqual(['end']);
    expect(blockedRest[0]!.data).toEqual({ reason: 'session' });
    // Idle expiry, noticed at the heartbeat.
    const idle = track(await mustOpen(h.app, '/v1/stream', asSession('podium')));
    await idle.nextMessage();
    h.idleExpired.add(token('podium'));
    const idleRest = await idle.rest(2_000);
    expect(kinds(idleRest)).toEqual(['end']);
    expect(idleRest[0]!.data).toEqual({ reason: 'session' });
  });

  it('17 three streams of one session and one batch: exactly one session check; two batches: two checks', async () => {
    const h = await harness({ session: true });
    const streams = [];
    for (let i = 0; i < 3; i++) {
      const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin', 2)));
      await reader.nextMessage();
      streams.push(reader);
    }
    // Batch checks only: a staggered heartbeat of one of the streams may check in between (its own occasion).
    const mine = (): number => h.hooks.windows.filter((w) => w.kind === 'session' && w.phase === 'start' && w.occasion?.startsWith('b:')).length;
    const before = mine();
    await assignFiller(h, 'admin2', OTHER);
    for (const reader of streams) await reader.until(isEvent);
    expect(mine() - before).toBe(1);
    await sleep(300);
    await assignFiller(h, 'admin2', OTHER);
    for (const reader of streams) await reader.until(isEvent);
    expect(mine() - before).toBe(2);
    expect(h.readSessionCalls.filter((c) => c.token === token('admin', 2)).slice(-2).every((c) => !c.slideIdle)).toBe(true);
  });

  it('17 sign-out between two batches (under 1 s): the second batch is not delivered, end session', async () => {
    const h = await harness({ session: true });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await reader.nextMessage();
    await assignFiller(h, 'admin2', OTHER);
    const first = await reader.until(isEvent);
    h.sessions.delete(token('admin'));
    await assignFiller(h, 'admin2', OTHER);
    const rest = await reader.rest();
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'session' });
    expect(idOf(first)).toBe(h.head() - 1);
  });

  it('17 a failing session check ends with unavailable (fail closed)', async () => {
    const h = await harness({ session: true });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await reader.nextMessage();
    h.failReadSession.token = token('admin');
    await assignFiller(h, 'admin2', OTHER);
    const rest = await reader.rest();
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'unavailable' });
  });

  // ---- 18 ---------------------------------------------------------------------------------------------------------
  it('18 limits: fourth stream of a session 429, seventh of a subject 429, global limit 503 StreamUnavailable', async () => {
    const h = await harness({ session: true });
    for (let i = 0; i < 3; i++) track(await mustOpen(h.app, '/v1/stream', asSession('admin', 1)));
    const fourth = await req(h.app, 'GET', '/v1/stream', { headers: asSession('admin', 1) });
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get('Retry-After')).toBe('30');
    for (let i = 0; i < 3; i++) track(await mustOpen(h.app, '/v1/stream', asSession('admin', 2)));
    const seventh = await req(h.app, 'GET', '/v1/stream', { headers: asSession('admin', 3) });
    expect(seventh.status).toBe(429);
    expect(seventh.headers.get('Retry-After')).toBe('30');
    const small = await harness({ session: true, streamLimits: { perProcess: 2 } });
    track(await mustOpen(small.app, '/v1/stream', asSession('admin')));
    track(await mustOpen(small.app, '/v1/stream', asSession('capture')));
    const third = await req(small.app, 'GET', '/v1/stream', { headers: asSession('moderation') });
    expect(third.status).toBe(503);
    expect(third.headers.get('Retry-After')).toBe('30');
    expect(await third.json()).toMatchObject({ status: 503 });
  });

  it('18 ten parallel opens of one session: exactly 3 x 200 and 7 x 429; a slot is free after abort; errors hold none', async () => {
    const h = await harness({ session: true });
    const results = await Promise.all(Array.from({ length: 10 }, () => openStream(h.app, '/v1/stream', asSession('capture'))));
    for (const r of results) if (r.reader) track(r.reader);
    expect(results.filter((r) => r.res.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.res.status === 429)).toHaveLength(7);
    await results.find((r) => r.reader)!.reader!.cancel();
    track(await mustOpen(h.app, '/v1/stream', asSession('capture')));
    // Client abort through the request signal frees the slot too.
    const controller = new AbortController();
    const aborted = await h.app.request('/v1/stream', { headers: asSession('podium'), signal: controller.signal });
    expect(aborted.status).toBe(200);
    for (let i = 0; i < 2; i++) track(await mustOpen(h.app, '/v1/stream', asSession('podium')));
    controller.abort();
    await sleep(20);
    track(await mustOpen(h.app, '/v1/stream', asSession('podium')));
    // Errors before 200 hold no slot.
    for (let i = 0; i < 4; i++) expect((await req(h.app, 'GET', '/v1/stream?meetingId=hv-1999', { headers: asSession('moderation') })).status).toBe(404);
    for (let i = 0; i < 3; i++) track(await mustOpen(h.app, '/v1/stream', asSession('moderation')));
  });

  // ---- 19 ---------------------------------------------------------------------------------------------------------
  it('19 the lifetime (lowered) ends the stream with rotate', async () => {
    const h = await harness({ streamLimits: { lifetimeMs: 300 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', asDemo('admin:admin')));
    const rest = await reader.rest(2_000);
    expect(kinds(rest)).toEqual(['cursor', 'end']);
    expect(rest[1]!.data).toEqual({ reason: 'rotate' });
  });

  // ---- 20 ---------------------------------------------------------------------------------------------------------
  it('20 a catch-up of 1000 events reaches a slow reader completely and in order, without a close', async () => {
    const h = await harness();
    const head = h.head();
    const reader = track(await mustOpen(h.app, '/v1/stream', { ...asDemo('admin:admin'), 'Last-Event-ID': String(head - 1_000) }, { pauseMs: 1 }));
    const blocks = await reader.messagesUntil((b) => b.event === 'cursor', 20_000);
    const events = blocks.filter(isEvent);
    expect(events.map(idOf)).toEqual(Array.from({ length: 1_000 }, (_, i) => head - 999 + i));
    expect(reader.closed).toBe(false);
  }, 30_000);

  it('20 live backlog: change messages are merged; only events over the limit close the connection', async () => {
    const h = await harness({ session: true, streamLimits: { backlogMessages: 5 } });
    // A reader that reads nothing for now: every message stays queued.
    const stalledCapture = await req(h.app, 'GET', '/v1/stream', { headers: asSession('capture') });
    const stalledAdmin = await req(h.app, 'GET', '/v1/stream', { headers: asSession('admin') });
    expect(stalledCapture.status).toBe(200);
    expect(stalledAdmin.status).toBe(200);
    const speakers: string[] = [];
    for (let i = 0; i < 8; i++) {
      speakers.push((await registerSpeaker(h, 'admin')).id);
      await sleep(30);
    }
    await sleep(400);
    const capture = track(new StreamReader(stalledCapture));
    const captured = await capture.during(600);
    expect(capture.closed).toBe(false);
    const changes = captured.filter((b) => b.event === 'change');
    expect(changes.length).toBeLessThanOrEqual(2);
    expect(changes.flatMap((b) => (b.data as { subjects?: string[] }).subjects ?? [])).toEqual(expect.arrayContaining(speakers));
    const admin = track(new StreamReader(stalledAdmin));
    await admin.rest(2_000);
    expect(admin.closed).toBe(true);
  }, 30_000);

  // ---- 21 ---------------------------------------------------------------------------------------------------------
  it('21 one access log line per stream (50 messages): streamEvents, no content, no id, no token', async () => {
    const h = await harness({ session: true });
    const head = h.head();
    const reader = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin'), 'Last-Event-ID': String(head - 49) }));
    const blocks = await reader.messagesUntil((b) => b.event === 'cursor');
    expect(blocks).toHaveLength(50);
    await reader.cancel();
    const lines = h.accessLines.filter((line) => (JSON.parse(line) as { operationId: string }).operationId === 'streamEvents');
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v']);
    expect(line).toMatchObject({ status: 200, seq: null });
    expect(lines[0]).not.toContain(token('admin'));
    expect(lines[0]).not.toContain(subject('admin'));
    expect(lines[0]).not.toContain(MEETING);
  });

  // ---- 22 ---------------------------------------------------------------------------------------------------------
  it('22 meeting filter: only events of that meeting, the id stays global; the heartbeat carries the moved head', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 200 } });
    const reader = track(await mustOpen(h.app, `/v1/stream?meetingId=${MEETING}`, asSession('admin')));
    await reader.nextMessage();
    await assignFiller(h, 'admin2', OTHER);
    // The head moved on through an event this stream does not carry: `cursor` with the heartbeat.
    const moved = await reader.until((b) => b.event === 'cursor', 2_000);
    expect(idOf(moved)).toBe(h.head());
    await assignFiller(h, 'admin');
    const next = await reader.until(isEvent);
    expect(idOf(next)).toBe(h.head());
    expect((next.data as { meetingId: string }).meetingId).toBe(MEETING);
    expect(reader.blocks.filter(isEvent)).toHaveLength(1);
    // A meeting the reader holds no grant in: 403.
    expect((await req(h.app, 'GET', `/v1/stream?meetingId=${OTHER}`, { headers: asSession('capture') })).status).toBe(403);
  });

  // ---- 23 ---------------------------------------------------------------------------------------------------------
  it('23 an event without hash in a batch ends every stream with unavailable (m6)', async () => {
    const h = await harness();
    const a = track(await mustOpen(h.app, '/v1/stream', asDemo('admin:admin')));
    const b = track(await mustOpen(h.app, '/v1/stream', asDemo(`${subject('capture')}:capture`)));
    await a.nextMessage();
    await b.nextMessage();
    const cut = h.head();
    h.hooks.load = (log) => log.map((e) => (e.seq > cut ? { ...e, hash: '' } : e));
    await assignFiller(h, 'admin:admin');
    for (const reader of [a, b]) {
      const rest = await reader.rest();
      expect(rest.at(-1)!.data).toEqual({ reason: 'unavailable' });
      expect(rest.filter(isEvent)).toHaveLength(0);
    }
  });

  it('23 the store.subscribe trigger does no work in the listener (m8)', async () => {
    const h = await harness();
    const reader = track(await mustOpen(h.app, '/v1/stream', asDemo('admin:admin')));
    await reader.nextMessage();
    visibleCalls.stacks.length = 0;
    await assignFiller(h, 'admin:admin');
    await reader.until(isEvent);
    expect(visibleCalls.stacks.length).toBeGreaterThan(0);
    // No call ran inside the store's append (the listener only schedules a reload).
    expect(visibleCalls.stacks.filter((stack) => /\bappend\b/.test(stack))).toEqual([]);
  });

  it('23a freshness on open: RoleAssigned just committed, last reload over 1 s ago -> 200, no 403', async () => {
    const h = await harness({ session: true });
    track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await ok(call(h, 'admin', 'POST', `/v1/meetings/${MEETING}/role-assignments`, {}, { subjectId: subject('late'), role: 'capture' }));
    h.clock.advance(1_500);
    const opened = await openStream(h.app, '/v1/stream', asSession('late'));
    expect(opened.res.status).toBe(200);
    track(opened.reader!);
  });

  it('23b continuity without Postgres: a shortened or replaced verified log resets every stream; rebuild from the new head', async () => {
    const h = await harness({ session: true });
    const a = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    const b = track(await mustOpen(h.app, '/v1/stream', asSession('capture')));
    await a.nextMessage();
    await b.nextMessage();
    const cut = h.head() - 3;
    h.hooks.load = (log) => log.slice(0, cut);
    await assignFiller(h, 'admin');
    for (const reader of [a, b]) {
      const rest = await reader.rest();
      expect(kinds(rest)).toEqual(['reset']);
      expect(rest[0]!.data).toEqual({ lastSeq: cut });
      expect(rest[0]!.id).toBeUndefined();
    }
    const again = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    const cursor = (await again.nextMessage())!;
    expect(idOf(cursor)).toBe(cut);
    await again.cancel();
    // A valid other chain of the same length: the hash at lastSeq differs -> reset again.
    const real = h.log();
    const altStore = createInMemoryEventStore({ load: () => real.slice(0, cut - 1), save: () => {} });
    altStore.append([{ id: 'alt-1', type: 'RoleAssigned', at: at0.toISOString(), actor: SYSTEM_ACTOR, subjectId: 'alt-assignment',
      meetingId: MEETING, payload: { assignmentId: 'alt-assignment', subjectId: 'alt-subject', role: 'observer' } } as unknown as NewEvent]);
    const alt = [...altStore.all()];
    expect(alt).toHaveLength(cut);
    const c = track(await mustOpen(h.app, '/v1/stream', asSession('admin', 2)));
    await c.nextMessage();
    h.hooks.load = () => alt;
    await assignFiller(h, 'admin');
    const rest = await c.rest();
    expect(kinds(rest)).toEqual(['reset']);
    expect(rest[0]!.data).toEqual({ lastSeq: cut });
  });

  it('23c the stream lifetime (25 min) lies below SESSION_IDLE_MS (M7)', () => {
    expect(STREAM_LIFETIME_MS).toBe(25 * 60_000);
    expect(STREAM_LIFETIME_MS).toBeLessThan(SESSION_IDLE_MS);
  });

  // ---- review of 035b (fresh context) ------------------------------------------------------------------------------
  it('R1 a stalled catch-up: sign-out and subject block end it with session before any further event (major 1)', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 150 } });
    const stalled = await req(h.app, 'GET', '/v1/stream', { headers: { ...asSession('admin'), 'Last-Event-ID': String(h.head() - 1_000) } });
    expect(stalled.status).toBe(200);
    await sleep(200);
    h.sessions.delete(token('admin'));
    h.blocked.add(subject('admin'));
    await sleep(500);
    const reader = track(new StreamReader(stalled));
    const rest = await reader.rest(3_000);
    expect(rest.filter(isEvent)).toHaveLength(0);
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'session' });
  });

  it('R1 a stalled catch-up: an expired grant (injected clock) ends it with forbidden before the catch-up (major 1)', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 150 } });
    const stalled = await req(h.app, 'GET', '/v1/stream', { headers: { ...asSession('temp'), 'Last-Event-ID': String(h.head() - 500) } });
    expect(stalled.status).toBe(200);
    await sleep(100);
    h.clock.advance(11 * 60_000);
    await sleep(500);
    const rest = await track(new StreamReader(stalled)).rest(3_000);
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'forbidden' });
  });

  it('R1 a stalled catch-up still rotates, and the slot is free again (major 1)', async () => {
    const h = await harness({ session: true, streamLimits: { lifetimeMs: 600, perSession: 1 } });
    const stalled = await req(h.app, 'GET', '/v1/stream', { headers: { ...asSession('admin'), 'Last-Event-ID': String(h.head() - 1_000) } });
    expect(stalled.status).toBe(200);
    await sleep(1_000);
    const next = await openStream(h.app, '/v1/stream', asSession('admin'));
    if (next.reader) track(next.reader);
    expect(next.res.status).toBe(200);
    const rest = await track(new StreamReader(stalled)).rest(3_000);
    expect(rest.filter(isEvent)).toHaveLength(0);
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'rotate' });
  });

  it('R2 a grant that expires while batches wait for a slow reader: end forbidden before the queued batch (minor 3)', async () => {
    const h = await harness({ session: true });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('temp')));
    await reader.nextMessage();
    reader.hold();
    for (let i = 0; i < 3; i++) {
      const target = h.head() + 1;
      await registerSpeaker(h, 'admin');
      await eventually(() => h.hooks.appliedHead === target, 3_000, 'batch applied');
      await sleep(300);
    }
    h.clock.advance(11 * 60_000);
    reader.resume();
    const rest = await reader.rest(3_000);
    expect(rest.filter((b) => b.event === 'change').length).toBeLessThan(3);
    expect(rest.at(-1)!.event).toBe('end');
    expect(rest.at(-1)!.data).toEqual({ reason: 'forbidden' });
  });

  it('R3 a cursor beyond the head forces at most the spaced reloads, not one per open (minor 4)', async () => {
    const h = await harness({ session: true });
    track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await sleep(400);
    const before = h.hooks.reloads;
    for (let i = 0; i < 10; i++) {
      const opened = await openStream(h.app, '/v1/stream', { ...asSession('capture'), 'Last-Event-ID': String(h.head() + 5) });
      expect(kinds(await track(opened.reader!).rest())).toEqual(['reset']);
    }
    expect(h.hooks.reloads - before).toBeLessThanOrEqual(2);
  });

  it('R4a the route itself answers 403 R-PERM-01 when the reader has no actor in any meeting (demo header, empty log)', async () => {
    const h = await harness({ events: [] });
    const res = await req(h.app, 'GET', '/v1/stream', { headers: asDemo('admin:admin') });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ruleId: 'R-PERM-01' });
  });

  it('R4b another unit (Fachbereich) of the same role ends with roles_changed', async () => {
    const h = await harness({ session: true });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('unitswap')));
    await reader.nextMessage();
    // Revocation and new grant must land in one batch (else the gap between them is `forbidden`): the distributor's
    // view is frozen while both are written, then a filler write triggers the reload that applies all three.
    const frozen = h.head();
    h.hooks.load = (log) => log.slice(0, frozen);
    await revokeGrant(h, 'unitswap', 0);
    await ok(call(h, 'admin', 'POST', `/v1/meetings/${MEETING}/role-assignments`, {}, { subjectId: subject('unitswap'), role: 'expert', unitId: 'unit-ops' }));
    h.hooks.load = undefined;
    await assignFiller(h, 'admin');
    const rest = await reader.rest();
    expect(kinds(rest)).toEqual(['end']);
    expect(rest[0]!.data).toEqual({ reason: 'roles_changed' });
  });

  it('R4c the byte limit of the backlog (lowered) closes a stalled connection below the message limit', async () => {
    const h = await harness({ session: true, streamLimits: { backlogBytes: 2_000 } });
    const stalled = await req(h.app, 'GET', '/v1/stream', { headers: asSession('admin') });
    expect(stalled.status).toBe(200);
    for (let i = 0; i < 8; i++) await assignFiller(h, 'admin');
    await sleep(400);
    const reader = track(new StreamReader(stalled));
    await reader.rest(2_000);
    expect(reader.closed).toBe(true);
    expect(reader.blocks.filter(isEvent).length).toBeLessThan(8);
  });

  it('R6 the session checker reads nothing for a queued check whose callers have all gone (minor 6)', async () => {
    const checker = createSessionChecker({ concurrency: 1 });
    let releaseFirst!: (valid: boolean) => void;
    const first = checker.check('b:1', 'k1', () => new Promise<boolean>((resolve) => { releaseFirst = resolve; }));
    let reads = 0;
    let alive = true;
    const second = checker.check('b:1', 'k2', async () => { reads += 1; return true; }, () => alive);
    alive = false;
    await eventually(() => typeof releaseFirst === 'function', 1_000, 'first read started');
    releaseFirst(true);
    await first;
    await second;
    expect(reads).toBe(0);
  });

  it('R6b a caller that joins a queued check and stays gets a real read, not a dropped answer (re-check nit)', async () => {
    const checker = createSessionChecker({ concurrency: 1 });
    let releaseFirst!: (valid: boolean) => void;
    const first = checker.check('b:1', 'k1', () => new Promise<boolean>((resolve) => { releaseFirst = resolve; }));
    let reads = 0;
    let gone = true;
    void checker.check('b:1', 'k2', async () => { reads += 1; return true; }, () => !gone);
    const joiner = checker.check('b:1', 'k2', async () => { reads += 1; return true; }, () => true);
    // A third check that hangs: a joiner that had to queue anew would wait behind it.
    void checker.check('b:1', 'k3', () => new Promise<boolean>(() => undefined));
    await eventually(() => typeof releaseFirst === 'function', 1_000, 'first read started');
    releaseFirst(true);
    await first;
    expect(await Promise.race([joiner, sleep(300).then(() => 'waiting' as const)])).toBe(true);
    expect(reads).toBe(1);
  });

  it('R1d a live batch stalled mid-write: sign-out ends it with session, the rest of the batch is not sent (re-check major)', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 150 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await reader.nextMessage();
    await sleep(50);
    // Freeze the distributor's view so that the writes form one batch.
    const frozen = h.head();
    h.hooks.load = (log) => log.slice(0, frozen);
    reader.hold();
    for (let i = 0; i < 6; i++) await assignFiller(h, 'admin2', OTHER);
    h.hooks.load = undefined;
    await assignFiller(h, 'admin2', OTHER);
    await eventually(() => h.hooks.appliedHead === h.head(), 3_000, 'batch applied');
    await sleep(100);
    const before = reader.blocks.filter(isEvent).length;
    h.sessions.delete(token('admin'));
    await sleep(1_000);
    reader.resume();
    const rest = await reader.rest(3_000);
    // At most the one frame already handed to the transport before the sign-out, then the end.
    expect(reader.blocks.filter(isEvent).length - before).toBeLessThanOrEqual(1);
    expect(rest.at(-1)!.data).toEqual({ reason: 'session' });
  });

  it('R1e catch-up gated per frame: a check that is still running holds the next frame (re-check minor)', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 150 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin'), 'Last-Event-ID': String(h.head() - 1_000) }, { pauseMs: 2 }));
    await eventually(() => reader.blocks.filter(isEvent).length >= 5, 3_000, 'first catch-up frames');
    reader.hold();
    let openGate!: () => void;
    h.hang.until = new Promise<void>((resolve) => { openGate = resolve; });
    h.hang.token = token('admin');
    await sleep(50);
    const before = reader.blocks.filter(isEvent).length;
    h.sessions.delete(token('admin'));
    await sleep(400); // a heartbeat starts a check that now hangs at the gate
    reader.resume();
    await sleep(300);
    openGate();
    const rest = await reader.rest(3_000);
    expect(reader.blocks.filter(isEvent).length - before).toBeLessThanOrEqual(1);
    expect(rest.at(-1)!.data).toEqual({ reason: 'session' });
  });

  it('R3b opens that find the distributor idle keep the spacing between reloads (re-check minor)', async () => {
    const h = await harness({ session: true });
    for (let i = 0; i < 6; i++) {
      const opened = await openStream(h.app, '/v1/stream', { ...asSession('capture'), 'Last-Event-ID': String(h.head() + 5) });
      expect(kinds(await track(opened.reader!).rest())).toEqual(['reset']);
    }
    const starts = h.hooks.reloadStarts;
    expect(starts.length).toBeGreaterThan(1);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(200);
  });

  it('R1f a live batch stalled mid-write while the heartbeat check hangs: no further frame before end session (live per-frame wait)', async () => {
    const h = await harness({ session: true, streamLimits: { heartbeatMs: 150 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await reader.nextMessage();
    await sleep(50);
    const frozen = h.head();
    h.hooks.load = (log) => log.slice(0, frozen);
    reader.hold();
    for (let i = 0; i < 6; i++) await assignFiller(h, 'admin2', OTHER);
    h.hooks.load = undefined;
    await assignFiller(h, 'admin2', OTHER);
    await eventually(() => h.hooks.appliedHead === h.head(), 3_000, 'batch applied');
    await sleep(100); // the batch's own session check has passed; the first frame waits in the transport
    let openGate!: () => void;
    h.hang.until = new Promise<void>((resolve) => { openGate = resolve; });
    h.hang.token = token('admin');
    const before = reader.blocks.filter(isEvent).length;
    h.sessions.delete(token('admin'));
    await sleep(400); // a heartbeat starts the direct check, which hangs at the gate
    reader.resume();
    await sleep(300);
    openGate();
    const rest = await reader.rest(3_000);
    expect(reader.blocks.filter(isEvent).length - before).toBeLessThanOrEqual(1);
    expect(rest.at(-1)!.data).toEqual({ reason: 'session' });
  });

  it('R1g an end the reader never takes: the stream is aborted after the drain time (no socket piles up)', async () => {
    const h = await harness({ session: true, streamLimits: { lifetimeMs: 200, endDrainMs: 300 } });
    const stalled = await req(h.app, 'GET', '/v1/stream', { headers: asSession('admin') });
    expect(stalled.status).toBe(200);
    await sleep(1_000);
    const reader = track(new StreamReader(stalled));
    await reader.rest(2_000);
    expect(reader.closed).toBe(true);
    // Aborted: the queued `end` was dropped with the stream instead of waiting for a reader forever.
    expect(reader.blocks.some((b) => b.event === 'end')).toBe(false);
  });

  it('R6c a check dropped because its only caller died: a caller joining at that moment gets a real read', async () => {
    const checker = createSessionChecker({ concurrency: 1 });
    let releaseFirst!: (valid: boolean) => void;
    const first = checker.check('b:1', 'k1', () => new Promise<boolean>((resolve) => { releaseFirst = resolve; }));
    let reads = 0;
    const read = async (): Promise<boolean> => { reads += 1; return true; };
    let fresh: Promise<boolean> | undefined;
    // The only caller has died; at the moment the check asks, a fresh caller for the same key arrives.
    const dead = checker.check('b:1', 'k2', read, () => {
      fresh ??= checker.check('b:1', 'k2', read, () => true);
      return false;
    });
    await eventually(() => typeof releaseFirst === 'function', 1_000, 'first read started');
    releaseFirst(true);
    await first;
    expect(await dead).toBe(false);
    expect(fresh).toBeDefined();
    expect(await fresh).toBe(true);
    expect(reads).toBe(1);
  });

  it('R7 the catch-up builds its frames one at a time: a stalled reader of 1000 events holds at most 2 built frames (Codex P1)', async () => {
    const h = await harness({ session: true });
    frameCalls.count = 0;
    const stalled = await req(h.app, 'GET', '/v1/stream', { headers: { ...asSession('admin'), 'Last-Event-ID': String(h.head() - 1_000) } });
    expect(stalled.status).toBe(200);
    await sleep(300);
    expect(frameCalls.count).toBeLessThanOrEqual(2);
    const reader = track(new StreamReader(stalled));
    const blocks = await reader.messagesUntil((b) => b.event === 'cursor', 10_000);
    expect(blocks.filter(isEvent)).toHaveLength(1_000);
  }, 20_000);

  it('R8 the backlog limit counts the batch being written: in flight at the limit, one more batch closes (Codex P2)', async () => {
    const h = await harness({ session: true, streamLimits: { backlogMessages: 5 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await reader.nextMessage();
    await sleep(50);
    reader.hold();
    const batchOf = async (n: number): Promise<void> => {
      const frozen = h.head();
      h.hooks.load = (log) => log.slice(0, frozen);
      for (let i = 0; i < n - 1; i++) await assignFiller(h, 'admin2', OTHER);
      h.hooks.load = undefined;
      await assignFiller(h, 'admin2', OTHER);
      await eventually(() => h.hooks.appliedHead === h.head(), 3_000, 'batch applied');
      await sleep(300);
    };
    await batchOf(5); // at the limit, not over it: taken, then stuck in flight behind the held reader
    expect(reader.closed).toBe(false);
    await batchOf(3); // queued 3 plus at least 3 unsent in flight: over 5
    reader.resume();
    await reader.rest(2_000);
    expect(reader.closed).toBe(true);
    expect(reader.blocks.filter(isEvent).length).toBeLessThan(8);
  });

  it('R9 every catch-up and live event frame is masked like listEvents (redacted, sourceHash, no person, hash or command fields)', async () => {
    const h = await harness({ session: true });
    const from = h.head() - 300;
    // Writes through the service: their events carry command fields and person references in the stored original.
    await registerSpeaker(h, 'admin');
    await assignFiller(h, 'admin');
    const head = h.head();
    const stored = h.log().slice(from, head);
    // The stored originals carry what must never leave; otherwise the test would prove nothing.
    expect(stored.every((e) => typeof e.hash === 'string' && e.hash !== '' && typeof e.prevHash === 'string')).toBe(true);
    expect(stored.some((e) => e.commandId !== undefined || e.personId !== undefined)).toBe(true);
    const reader = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin'), 'Last-Event-ID': String(from) }));
    const catchUp = (await reader.messagesUntil((b) => b.event === 'cursor', 5_000)).filter(isEvent);
    expect(catchUp).toHaveLength(head - from);
    await registerSpeaker(h, 'admin');
    const live = await reader.until(isEvent);
    for (const block of [...catchUp, live]) {
      const e = block.data as Record<string, unknown> & { actor: Record<string, unknown> };
      expect(e['redacted']).toBe(true);
      expect(typeof e['sourceHash']).toBe('string');
      for (const key of ['personId', 'hash', 'prevHash', 'commandId', 'commandOperation', 'commandResource']) expect(e).not.toHaveProperty(key);
      expect(e.actor).not.toHaveProperty('displayName');
      expect(e.actor).not.toHaveProperty('personId');
    }
  });

  it('R8b the in-flight count goes down as frames go out: mid-batch and after it, a batch within the limit keeps the stream open', async () => {
    const h = await harness({ session: true, streamLimits: { backlogMessages: 5 } });
    const reader = track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    await reader.nextMessage();
    await sleep(50);
    const batchOf = async (n: number): Promise<void> => {
      const frozen = h.head();
      h.hooks.load = (log) => log.slice(0, frozen);
      for (let i = 0; i < n - 1; i++) await assignFiller(h, 'admin2', OTHER);
      h.hooks.load = undefined;
      await assignFiller(h, 'admin2', OTHER);
      await eventually(() => h.hooks.appliedHead === h.head(), 3_000, 'batch applied');
      await sleep(300);
    };
    reader.holdAt(4); // four of five taken: one frame of the batch is still in flight
    await batchOf(5);
    await batchOf(3); // 1 in flight + 3 queued = 4: within the limit
    expect(reader.closed).toBe(false);
    reader.resume();
    await eventually(() => reader.blocks.filter(isEvent).length === 8, 3_000, 'all eight events');
    await batchOf(4); // everything written: 4 is within the limit
    await eventually(() => reader.blocks.filter(isEvent).length === 12, 3_000, 'four more events');
    expect(reader.closed).toBe(false);
  });

  it('R10 a catch-up event without hash: the earlier events go out, then end unavailable, no frame for that event', async () => {
    const h = await harness({ session: true });
    track(await mustOpen(h.app, '/v1/stream', asSession('admin')));
    const broken = h.head() - 5;
    h.hooks.load = (log) => log.map((e) => (e.seq === broken ? { ...e, hash: '' } : e));
    const target = h.head() + 1;
    await assignFiller(h, 'admin');
    await eventually(() => h.hooks.appliedHead === target, 3_000, 'distributor took the log');
    const reader = track(await mustOpen(h.app, '/v1/stream', { ...asSession('admin', 2), 'Last-Event-ID': String(broken - 3) }));
    const rest = await reader.rest(3_000);
    expect(rest.filter(isEvent).map(idOf)).toEqual([broken - 2, broken - 1]);
    expect(rest.at(-1)!.event).toBe('end');
    expect(rest.at(-1)!.data).toEqual({ reason: 'unavailable' });
  });

  // ---- real server ---------------------------------------------------------------------------------------------
  it('real server: a stream stays open beyond 30 s with the serverOptions of server.ts and receives heartbeats', async () => {
    const h = await harness({ streamLimits: { heartbeatMs: 5_000 } });
    // The same three numbers as server.ts (not exported there; server.ts stays unchanged, a finding of 035b).
    const server = serve({ fetch: h.app.fetch, port: 0,
      serverOptions: { headersTimeout: 10_000, requestTimeout: 30_000, connectionsCheckingInterval: 5_000 } });
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const result = await new Promise<{ beats: number; ended: boolean }>((resolve) => {
        let beats = 0;
        let ended = false;
        const request = http.get({ port, path: '/v1/stream', headers: asDemo('admin:admin') }, (res) => {
          res.on('data', (chunk: Buffer) => { beats += chunk.toString().split('\n').filter((l) => l.startsWith(':')).length; });
          res.on('end', () => { ended = true; });
          res.on('error', () => { ended = true; });
        });
        request.on('error', () => { ended = true; });
        setTimeout(() => { request.destroy(); resolve({ beats, ended }); }, 33_000);
      });
      expect(result.ended).toBe(false);
      expect(result.beats).toBeGreaterThanOrEqual(5);
    } finally {
      server.close();
    }
  }, 45_000);
});
