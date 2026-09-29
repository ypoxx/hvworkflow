/**
 * Scheibe 034a: limits, timeouts and the rate-limit layers of the request boundary.
 * T-G1-D-01, T-G1-D-05, T-G2-D-04, T-G3-D-02, T-G3-D-01 (see the table in the slice spec). The Postgres part
 * (pool timeouts, 503/500 mapping, 408 without a committed event) is in `postgres-limits034a.test.ts`; the
 * header probe (T-G1-I-06) is the block "034a security headers" in `contract.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryEventStore, createInProcessApi, SYSTEM_ACTOR, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp, type App, type CreateAppOptions } from '../app.ts';
import { actorIdForIdentity, type OidcFlow } from '../auth/oidc.ts';
import type { AuthStore } from '../auth/store.ts';
import { expectValidProblem, requestBodyValidator } from '../contractSchema.ts';
import { DEFAULT_LIMITS, READINESS_CHECK_TIMEOUT_MS } from '../limits/config.ts';
import { createWindowCounter } from '../limits/counters.ts';
import { createSourceKeyer, normalizeSource } from '../limits/source.ts';
import { getMigrationStatus } from '../persistence/migrations.ts';
import { QueryTimeoutError, withQueryTimers } from '../persistence/postgres.ts';
import { postgresPoolOptions } from '../limits/poolOptions.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { ACTOR, req } from './helpers.ts';

const KEY = Buffer.alloc(32, 3);
const T0 = Date.parse('2027-04-20T10:00:15.000Z'); // 15 s into a counting window
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Line { subjectHash: string | null; operationId: string | null; status: number }

/** A demo app over a seeded synthetic meeting with a movable injected clock and one fixed source. */
async function harness(over: Partial<CreateAppOptions> = {}, opts: { seed?: boolean } = {}) {
  const sink = createMemorySink();
  const time = { ms: T0 };
  let events: readonly DomainEvent[] = [];
  const app = createApp({ demoEnabled: true, clock: () => new Date(time.ms), sourceOf: () => 'source-a',
    accessLog: { sink, hashKey: KEY },
    persistence: { load: () => undefined, save: (all: readonly DomainEvent[]) => { events = all; } },
    ...over });
  if (opts.seed !== false) {
    const res = await app.request('/v1/demo/seed', { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: 5, seed: 2 }) });
    expect(res.status).toBe(200);
    time.ms += 60_000; // a fresh window: the seeding call does not count in the tests below
    sink.lines.length = 0;
  }
  return { app, sink, time, eventCount: () => events.length,
    lines: (): Line[] => sink.lines.map((line) => JSON.parse(line) as Line) };
}

async function speakerTag(app: App, actor = ACTOR.moderation): Promise<string> {
  return (await app.request('/v1/speakers', { headers: { 'X-Actor': actor } })).headers.get('ETag')!;
}

async function registerSpeaker(app: App, actor: string, tag: string, name: string, key?: string): Promise<Response> {
  return await app.request('/v1/speakers', { method: 'POST', body: JSON.stringify({ displayName: name }),
    headers: { 'X-Actor': actor, 'Content-Type': 'application/json', 'If-Match': tag,
      ...(key === undefined ? {} : { 'Idempotency-Key': key }) } });
}

let stderr: string[];
beforeEach(() => {
  stderr = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { stderr.push(args.map(String).join(' ')); });
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => { stderr.push(args.map(String).join(' ')); });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Scheibe 034a: window counters (pure, injected clock)', () => {
  it('allows `limit` hits per key, rejects the next, and reports the first rejection once', () => {
    let ms = T0;
    const counter = createWindowCounter({ limit: 3, clock: () => new Date(ms) });
    expect([1, 2, 3].map(() => counter.hit('a').allowed)).toEqual([true, true, true]);
    const fourth = counter.hit('a');
    expect(fourth).toMatchObject({ allowed: false, firstRejection: true });
    expect(counter.hit('a')).toMatchObject({ allowed: false, firstRejection: false });
    expect(counter.hit('b').allowed).toBe(true);
    ms += 45_000; // next window: fresh counts, the first rejection is reported again
    expect(counter.hit('a').allowed).toBe(true);
  });

  it('gives Retry-After as whole seconds to the window end, 1 to 60', () => {
    const at = (offsetMs: number) => {
      const counter = createWindowCounter({ limit: 0, clock: () => new Date(Date.parse('2027-04-20T10:00:00.000Z') + offsetMs) });
      return counter.hit('a').retryAfterSeconds;
    };
    expect(at(15_000)).toBe(45);
    expect(at(0)).toBe(60);
    expect(at(59_999)).toBe(1);
    expect(at(59_000)).toBe(1);
    expect(at(14_400)).toBe(46);
  });

  it('holds at most 10 000 keys per window; the 10 001st shares one overflow key; the table is empty next window', () => {
    let ms = T0;
    const full = vi.fn();
    const counter = createWindowCounter({ limit: 2, clock: () => new Date(ms), onTableFull: full });
    for (let i = 0; i < 10_000; i += 1) expect(counter.hit(`k${i}`).allowed).toBe(true);
    expect(counter.size()).toBe(10_000);
    expect(full).not.toHaveBeenCalled();
    // Known keys keep their own counter; new keys share the overflow key and its limit.
    expect(counter.hit('k0').allowed).toBe(true);
    expect(counter.hit('k0').allowed).toBe(false);
    expect(counter.hit('new-1')).toMatchObject({ allowed: true, overflow: true });
    expect(counter.hit('new-2')).toMatchObject({ allowed: true, overflow: true });
    expect(counter.hit('new-3')).toMatchObject({ allowed: false, overflow: true, firstRejection: true });
    expect(full).toHaveBeenCalledTimes(1);
    expect(counter.size()).toBe(10_001);
    ms += 60_000;
    expect(counter.hit('new-3').allowed).toBe(true);
    expect(counter.size()).toBe(1);
  });
});

describe('Scheibe 034a: source of a request', () => {
  it('counts an IPv4-mapped IPv6 address as IPv4 and shortens IPv6 to the /64 prefix', () => {
    expect(normalizeSource('::ffff:10.1.2.3')).toBe('10.1.2.3');
    expect(normalizeSource('10.1.2.3')).toBe('10.1.2.3');
    expect(normalizeSource('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe(normalizeSource('2001:db8:1:2::1'));
    expect(normalizeSource('2001:db8:1:2::1')).not.toBe(normalizeSource('2001:db8:1:3::1'));
    expect(normalizeSource('fe80::1%eth0')).toBe(normalizeSource('fe80::2'));
    expect(normalizeSource(undefined)).toBe('unbekannt');
    expect(normalizeSource('')).toBe('unbekannt');
  });

  it('keys are keyed hashes: stable within a keyer, different between keyers, never the address', () => {
    const one = createSourceKeyer(Buffer.alloc(32, 1));
    const two = createSourceKeyer(Buffer.alloc(32, 2));
    expect(one('10.1.2.3')).toBe(one('::ffff:10.1.2.3'));
    expect(one('10.1.2.3')).not.toBe(two('10.1.2.3'));
    expect(one('10.1.2.3')).not.toContain('10.1.2.3');
  });
});

describe('Scheibe 034a: fixed values and the order of the time limits', () => {
  it('orders lock < statement < query timer < request timeout < idle-in-transaction; readiness stays under the request timeout', () => {
    const l = DEFAULT_LIMITS;
    expect(l).toMatchObject({ lockTimeoutMs: 3_000, statementTimeoutMs: 5_000, queryTimeoutMs: 6_000,
      requestTimeoutMs: 10_000, idleInTransactionTimeoutMs: 15_000, oidcTimeoutMs: 5_000 });
    expect(l.lockTimeoutMs).toBeLessThan(l.statementTimeoutMs);
    expect(l.statementTimeoutMs).toBeLessThan(l.queryTimeoutMs);
    expect(l.queryTimeoutMs).toBeLessThan(l.requestTimeoutMs);
    expect(l.requestTimeoutMs).toBeLessThan(l.idleInTransactionTimeoutMs);
    expect(3 * READINESS_CHECK_TIMEOUT_MS).toBeLessThan(l.requestTimeoutMs);
    expect(l).toMatchObject({ writePerSubject: 60, readPerSubject: 1_200, anonymousPerSource: 600, loginPerSource: 120,
      loginTotal: 600, probePerSource: 600, preflightPerSource: 1_200 });
  });
});

describe('Scheibe 034a: limits per subject (T-G1-D-01, T-G3-D-02)', () => {
  it('answers the 61st write of a subject in a window with 429 and the rest of the window, without an event or a key', async () => {
    const { app, eventCount, time } = await harness();
    // 59 stale writes (412) and one accepted write: each counts, whatever the answer.
    for (let i = 0; i < 59; i += 1) {
      expect((await registerSpeaker(app, ACTOR.admin, '"v999"', 'x')).status).toBe(412);
    }
    const tag = await speakerTag(app, ACTOR.moderation);
    const ok = await req(app, 'POST', '/v1/speakers', { actor: ACTOR.moderation,
      headers: { 'If-Match': tag, 'Idempotency-Key': 'key-1' }, body: { displayName: 'Erste' } });
    expect(ok.status).toBe(201);
    // the moderation subject has its own counter; admin used 59, so its 60th and 61st decide
    expect((await registerSpeaker(app, ACTOR.admin, '"v999"', 'x')).status).toBe(412);
    const before = eventCount();
    const limited = await req(app, 'POST', '/v1/speakers', { actor: ACTOR.admin,
      headers: { 'If-Match': await speakerTag(app), 'Idempotency-Key': 'key-2' }, body: { displayName: 'Zweite' } });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('45');
    const problem = await limited.json();
    expectValidProblem(problem);
    expect(problem).not.toHaveProperty('ruleId');
    expect(eventCount()).toBe(before);
    time.ms += 60_000; // the next window: the same key was never consumed
    const again = await req(app, 'POST', '/v1/speakers', { actor: ACTOR.admin,
      headers: { 'If-Match': await speakerTag(app), 'Idempotency-Key': 'key-2' }, body: { displayName: 'Andere Person' } });
    expect(again.status).toBe(201);
    expect(eventCount()).toBe(before + 1);
  });

  it('counts per subject, independent of the role: another subject and another role are untouched', async () => {
    const { app } = await harness({ limits: { writePerSubject: 2 } });
    for (let i = 0; i < 2; i += 1) expect((await registerSpeaker(app, ACTOR.admin, '"v999"', 'x')).status).toBe(412);
    expect((await registerSpeaker(app, ACTOR.admin, '"v999"', 'x')).status).toBe(429);
    // the counter belongs to the actor id, not the role: the same id under another role is still limited
    expect((await registerSpeaker(app, 'admin:moderation', '"v999"', 'x')).status).toBe(429);
    expect((await registerSpeaker(app, ACTOR.moderation, '"v999"', 'x')).status).toBe(412);
    expect((await registerSpeaker(app, ACTOR.capture, '"v999"', 'x')).status).toBe(403);
  });

  it('answers the 1 201st read of a subject with 429; reads and writes have separate counters', async () => {
    const { app } = await harness();
    for (let i = 0; i < 1_200; i += 1) {
      const res = await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } });
      if (res.status !== 200) throw new Error(`read ${i + 1} answered ${res.status}`);
    }
    const limited = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('45');
    expect((await registerSpeaker(app, ACTOR.admin, '"v999"', 'x')).status).toBe(412);
    expect((await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.moderation } })).status).toBe(200);
  });

  it('logs every rejection of a subject individually (no protocol exception)', async () => {
    const { app, lines } = await harness({ limits: { writePerSubject: 1 } });
    for (let i = 0; i < 4; i += 1) await registerSpeaker(app, ACTOR.admin, '"v999"', 'x');
    const rows = lines();
    expect(rows.map((row) => row.status)).toEqual([412, 429, 429, 429]);
    expect(rows[1]!.subjectHash).toBeTruthy();
  });
});

describe('Scheibe 034a: body limit 256 KiB (413)', () => {
  const overhead = '{"speakerId":"s","text":""}'.length;
  const bodyOf = (bytes: number): string => `{"speakerId":"s","text":"${'a'.repeat(bytes - overhead)}"}`;
  const post = (app: App, body: BodyInit, headers: Record<string, string> = {}, extra: RequestInit = {}) =>
    app.request('/v1/contributions', { method: 'POST', body, ...extra,
      headers: { 'X-Actor': ACTOR.capture, 'Content-Type': 'application/json', ...headers } });
  const streamOf = (text: string): ReadableStream<Uint8Array> => new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });

  it('answers 413 for 262 145 bytes with a Content-Length header and without one, and writes no error line', async () => {
    const { app, lines } = await harness();
    const big = bodyOf(262_145);
    expect(new TextEncoder().encode(big).length).toBe(262_145);
    const withLength = await post(app, big, { 'Content-Length': String(big.length) });
    expect(withLength.status).toBe(413);
    const chunked = await post(app, streamOf(big), {}, { duplex: 'half' } as RequestInit);
    expect(chunked.status).toBe(413);
    for (const res of [withLength, chunked]) {
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');
      expectValidProblem(await res.json());
    }
    expect(lines().map((line) => line.status)).toEqual([413, 413]);
    expect(stderr.filter((line) => line.includes('"log":"error"'))).toEqual([]);
  });

  it('accepts exactly 262 144 bytes (no 413; the text limit answers 422 instead)', async () => {
    const { app } = await harness();
    const exact = bodyOf(262_144);
    expect(new TextEncoder().encode(exact).length).toBe(262_144);
    expect((await post(app, exact, { 'Content-Length': String(exact.length) })).status).toBe(422);
    expect((await post(app, streamOf(exact), {}, { duplex: 'half' } as RequestInit)).status).toBe(422);
  });

  it('answers 422 for a text of 60 001 characters and accepts one of 60 000 on the schema', async () => {
    const { app } = await harness();
    const long = await post(app, JSON.stringify({ speakerId: 's', text: 'a'.repeat(60_001) }));
    expect(long.status).toBe(422);
    expect((await long.json() as { detail: string }).detail).toMatch(/60000/);
    const validate = requestBodyValidator('captureContribution')!;
    expect(validate({ speakerId: 's', text: 'a'.repeat(60_000) })).toBe(true);
  });

  it('answers 422 for a search text of 201 characters', async () => {
    const { app } = await harness();
    const res = await app.request(`/v1/questions?q=${'a'.repeat(201)}`, { headers: { 'X-Actor': ACTOR.admin } });
    expect(res.status).toBe(422);
    expect((await app.request(`/v1/questions?q=${'a'.repeat(200)}`, { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
  });
});

describe('Scheibe 034a: length and list limits of the request schemas (one field per row of the table)', () => {
  const s = (n: number): string => 'a'.repeat(n);
  const cases: [string, string, unknown, unknown][] = [
    ['clearQuestionLegally', 'note 500', { answerVersion: 1, note: s(500) }, { answerVersion: 1, note: s(501) }],
    ['captureMeetingContribution', 'lateEntryReason 500', { speakerId: 's', text: 't', lateEntryReason: s(500) }, { speakerId: 's', text: 't', lateEntryReason: s(501) }],
    ['revokeRole', 'reason 500', { reason: s(500) }, { reason: s(501) }],
    ['returnQuestion', 'reason 500', { reason: s(500) }, { reason: s(501) }],
    ['withdrawQuestion', 'reason 500', { reason: s(500) }, { reason: s(501) }],
    ['captureContribution', 'text 60000', { speakerId: 's', text: s(60_000) }, { speakerId: 's', text: s(60_001) }],
    ['captureMeetingContribution', 'text 60000', { speakerId: 's', text: s(60_000) }, { speakerId: 's', text: s(60_001) }],
    ['captureQuestions', 'question text 4000', { questions: [{ text: s(4_000) }] }, { questions: [{ text: s(4_001) }] }],
    ['captureQuestions', 'questions 200 items', { questions: Array.from({ length: 200 }, () => ({ text: 't' })) },
      { questions: Array.from({ length: 201 }, () => ({ text: 't' })) }],
    ['draftAnswer', 'answer text 20000', { text: s(20_000) }, { text: s(20_001) }],
    ['draftAnswer', 'sources 50 items', { text: 't', sources: Array.from({ length: 50 }, () => 's') }, { text: 't', sources: Array.from({ length: 51 }, () => 's') }],
    ['draftAnswer', 'source entry 2000', { text: 't', sources: [s(2_000)] }, { text: 't', sources: [s(2_001)] }],
    ['registerSpeaker', 'displayName 200', { displayName: s(200) }, { displayName: s(201) }],
    ['registerSpeaker', 'organisation 200', { displayName: 'n', organisation: s(200) }, { displayName: 'n', organisation: s(201) }],
    ['createMeeting', 'title 200', { title: s(200), date: '2027-04-20' }, { title: s(201), date: '2027-04-20' }],
    ['createMeeting', 'legalEntity 200', { title: 't', date: '2027-04-20', legalEntity: s(200) }, { title: 't', date: '2027-04-20', legalEntity: s(201) }],
    ['createMeeting', 'cloneFromMeetingId 128', { title: 't', date: '2027-04-20', cloneFromMeetingId: s(128) }, { title: 't', date: '2027-04-20', cloneFromMeetingId: s(129) }],
    ['replaceMeetingUnits', 'unit name 200', [{ name: s(200) }], [{ name: s(201) }]],
    ['replaceMeetingUnits', 'unit shortName 32', [{ name: 'n', shortName: s(32) }], [{ name: 'n', shortName: s(33) }]],
    ['replaceMeetingUnits', 'unit id 128', [{ name: 'n', id: s(128) }], [{ name: 'n', id: s(129) }]],
    ['replaceMeetingUnits', 'units 200 items', Array.from({ length: 200 }, () => ({ name: 'n' })), Array.from({ length: 201 }, () => ({ name: 'n' }))],
    ['replaceMeetingAgendaItems', 'agenda title 500', [{ number: 1, title: s(500) }], [{ number: 1, title: s(501) }]],
    ['replaceMeetingAgendaItems', 'agenda id 128', [{ number: 1, title: 't', id: s(128) }], [{ number: 1, title: 't', id: s(129) }]],
    ['replaceMeetingAgendaItems', 'agenda 200 items', Array.from({ length: 200 }, (_, i) => ({ number: i + 1, title: 't' })), Array.from({ length: 201 }, (_, i) => ({ number: i + 1, title: 't' }))],
    ['replaceMeetingStageSeats', 'seat label 100', [{ label: s(100) }], [{ label: s(101) }]],
    ['replaceMeetingStageSeats', 'seat id 128', [{ label: 'l', id: s(128) }], [{ label: 'l', id: s(129) }]],
    ['replaceMeetingStageSeats', 'seat personId 128', [{ label: 'l', personId: s(128) }], [{ label: 'l', personId: s(129) }]],
    ['replaceMeetingStageSeats', 'seat deviceId 128', [{ label: 'l', deviceId: s(128) }], [{ label: 'l', deviceId: s(129) }]],
    ['replaceMeetingStageSeats', 'seats 50 items', Array.from({ length: 50 }, () => ({ label: 'l' })), Array.from({ length: 51 }, () => ({ label: 'l' }))],
    ['captureContribution', 'speakerId 128', { speakerId: s(128), text: 't' }, { speakerId: s(129), text: 't' }],
    ['captureMeetingContribution', 'speakerId 128', { speakerId: s(128), text: 't' }, { speakerId: s(129), text: 't' }],
    ['classifyQuestion', 'agendaItemId 128', { track: 'podium', agendaItemId: s(128) }, { track: 'podium', agendaItemId: s(129) }],
    ['assignQuestion', 'unitId 128', { unitId: s(128) }, { unitId: s(129) }],
    ['mergeQuestion', 'intoQuestionId 128', { intoQuestionId: s(128) }, { intoQuestionId: s(129) }],
    ['assignRole', 'personId 128', { subjectId: 'oidc_x', role: 'moderation', personId: s(128) }, { subjectId: 'oidc_x', role: 'moderation', personId: s(129) }],
    ['assignRole', 'unitId 128', { subjectId: 'oidc_x', role: 'expert', unitId: s(128) }, { subjectId: 'oidc_x', role: 'expert', unitId: s(129) }],
    ['reorderSpeakers', 'speakerIds entry 128', { round: 1, speakerIds: [s(128)] }, { round: 1, speakerIds: [s(129)] }],
    ['reorderSpeakers', 'speakerIds 2000 items', { round: 1, speakerIds: Array.from({ length: 2_000 }, () => 's') }, { round: 1, speakerIds: Array.from({ length: 2_001 }, () => 's') }],
  ];

  it.each(cases)('%s: %s — the limit passes, one more is refused', (operationId, _label, good, bad) => {
    const validate = requestBodyValidator(operationId);
    expect(validate, `${operationId} has a request body schema`).toBeDefined();
    expect(validate!(good), JSON.stringify(validate!.errors)).toBe(true);
    expect(validate!(bad)).toBe(false);
  });
});

describe('Scheibe 034a: request timeout (408)', () => {
  it('answers 408 for a request that exceeds the time budget, logs one line, and a late finish changes neither', async () => {
    const slow = async () => { await sleep(200); return { status: 'ok' as const }; };
    const { app, sink } = await harness({ limits: { requestTimeoutMs: 50 },
      readiness: { clock: slow, db: async () => ({ status: 'ok' }), migrations: async () => ({ status: 'ok' }) } }, { seed: false });
    const started = performance.now();
    const res = await req(app, 'GET', '/readyz');
    expect(performance.now() - started).toBeLessThan(180);
    expect(res.status).toBe(408);
    expect(res.headers.get('Retry-After')).toBeNull();
    const problem = await res.json();
    expectValidProblem(problem);
    expect(problem).not.toHaveProperty('ruleId');
    await sleep(300);
    const lines = sink.lines.map((line) => JSON.parse(line) as Line);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ status: 408, operationId: 'getReadiness' });
  });

  it('a request within its budget is not touched', async () => {
    const { app } = await harness({ limits: { requestTimeoutMs: 500 } });
    expect((await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
  });
});

describe('Scheibe 034a: sources without a session, sign-in starts, probes and preflights', () => {
  const noteLine = (text: string): number => stderr.filter((line) => line === text).length;

  it('answers request 601 of a source without sign-in material with 429; 602 to 700 write no log line; one summary line per minute (T-G2-D-04)', async () => {
    const { app, lines, time } = await harness();
    for (let i = 0; i < 600; i += 1) {
      const res = await app.request('/v1/meeting');
      if (res.status !== 401) throw new Error(`request ${i + 1} answered ${res.status}`);
    }
    const first = await req(app, 'GET', '/v1/meeting');
    expect(first.status).toBe(429);
    expect(first.headers.get('Retry-After')).toBe('45');
    expect(lines()).toHaveLength(601);
    for (let i = 602; i <= 700; i += 1) expect((await app.request('/v1/meeting')).status).toBe(429);
    expect(lines()).toHaveLength(601); // the first rejection was logged, the 99 repeats were not
    expect(lines().at(-1)).toMatchObject({ status: 429, subjectHash: null });
    expect(stderr.filter((line) => line.includes('repeated rejections'))).toEqual([]);
    time.ms += 60_000;
    expect((await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
    expect(stderr.filter((line) => line.includes('repeated rejections'))).toEqual([
      'HV-Tool API: anonymous rate limit reached; 99 repeated rejections not logged individually.']);
    // the summary is written once, not again for the same minute
    expect((await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
    expect(stderr.filter((line) => line.includes('repeated rejections'))).toHaveLength(1);
  });

  it('a request with a valid X-Actor is never counted against the source', async () => {
    const { app } = await harness({ limits: { anonymousPerSource: 2 } });
    for (let i = 0; i < 10; i += 1) expect((await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
    expect((await app.request('/v1/meeting')).status).toBe(401);
    expect((await app.request('/v1/meeting')).status).toBe(401);
    expect((await app.request('/v1/meeting')).status).toBe(429);
    expect((await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(200);
  });

  it('counts a request 413 against the source without sign-in material and answers 429 from request 601 on', async () => {
    const { app, lines } = await harness();
    const oversize = () => app.request('/v1/contributions', { method: 'POST', body: 'x',
      headers: { 'Content-Length': '262145', 'Content-Type': 'application/json' } });
    for (let i = 0; i < 600; i += 1) expect((await oversize()).status).toBe(413);
    const first = await oversize();
    expect(first.status).toBe(429);
    expect(first.headers.get('Retry-After')).toMatch(/^[1-9][0-9]?$/);
    expect(lines()).toHaveLength(601);
    for (let i = 0; i < 99; i += 1) expect((await oversize()).status).toBe(429);
    expect(lines()).toHaveLength(601);
  });

  it('keeps a source separate for probes and other requests, and probes do not exhaust the rest (and the reverse)', async () => {
    const { app } = await harness();
    for (let i = 0; i < 600; i += 1) expect((await app.request('/healthz')).status).toBe(200);
    expect((await req(app, 'GET', '/healthz')).status).toBe(429);
    expect((await app.request('/v1/meeting')).status).toBe(401);
    expect((await app.request('/auth/transparency-notice')).status).toBe(404);
    for (let i = 0; i < 598; i += 1) await app.request('/v1/meeting');
    expect((await app.request('/v1/meeting')).status).toBe(429);
    expect((await app.request('/readyz')).status).toBe(429); // /readyz shares the probe counter with /healthz
    const other = await harness({ sourceOf: () => 'source-b' }, { seed: false });
    expect((await other.app.request('/healthz')).status).toBe(200);
  });

  it('answers the 1 201st CORS preflight of a source with 429 and leaves the other counters alone', async () => {
    const { app } = await harness();
    const preflight = () => app.request('/v1/meetings', { method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
    for (let i = 0; i < 1_200; i += 1) expect((await preflight()).status).toBe(204);
    expect((await preflight()).status).toBe(429);
    expect((await app.request('/healthz')).status).toBe(200);
    expect((await app.request('/v1/meeting')).status).toBe(401);
  });

  it('a 429 of an allowed origin carries the CORS headers and Retry-After is exposed', async () => {
    const { app } = await harness({ limits: { readPerSubject: 1 } });
    const headers = { 'X-Actor': ACTOR.admin, Origin: 'http://localhost:5173' };
    expect((await app.request('/v1/meeting', { headers })).status).toBe(200);
    const limited = await app.request('/v1/meeting', { headers });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(limited.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
    expect(limited.headers.get('Retry-After')).toBe('45');
  });

  it('never writes the source into a log line, stderr, or a response', async () => {
    const marker = 'MARKER-203.0.113.77';
    const { app, sink } = await harness({ sourceOf: () => marker, limits: { anonymousPerSource: 2, loginPerSource: 1 } });
    const bodies: string[] = [];
    for (let i = 0; i < 6; i += 1) bodies.push(await (await app.request('/v1/meeting')).text());
    bodies.push(await (await app.request('/auth/login')).text(), await (await app.request('/auth/login')).text());
    const everything = [...sink.lines, ...stderr, ...bodies].join('\n');
    expect(everything).not.toContain(marker);
    expect(everything).not.toContain('203.0.113.77');
    expect(stderr.length).toBeGreaterThan(0); // the fixed sign-in start line was written, and it names no source
  });

  it('writes each fixed stderr line at most once per minute, without source or subject', async () => {
    const { app, time } = await harness({ limits: { writePerSubject: 1, readPerSubject: 1, loginPerSource: 1 } });
    for (let i = 0; i < 5; i += 1) await registerSpeaker(app, ACTOR.admin, '"v999"', 'x');
    for (let i = 0; i < 5; i += 1) await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.moderation } });
    for (let i = 0; i < 5; i += 1) await app.request('/auth/login');
    expect(noteLine('HV-Tool API: write rate limit reached.')).toBe(1);
    expect(noteLine('HV-Tool API: read rate limit reached.')).toBe(1);
    expect(noteLine('HV-Tool API: sign-in start limit reached.')).toBe(1);
    time.ms += 60_000;
    for (let i = 0; i < 3; i += 1) await registerSpeaker(app, ACTOR.admin, '"v999"', 'x');
    expect(noteLine('HV-Tool API: write rate limit reached.')).toBe(2);
  });

  it('a source table full of keys makes new sources share one overflow key; the fixed line is written once', async () => {
    let n = 0;
    const { app } = await harness({ sourceOf: () => `source-${n}`, limits: { maxKeys: 3, anonymousPerSource: 1 } }, { seed: false });
    for (n = 0; n < 3; n += 1) expect((await app.request('/v1/meeting')).status).toBe(401);
    n = 10; // new sources beyond the table: the overflow key has the same limit and is shared
    expect((await app.request('/v1/meeting')).status).toBe(401);
    n = 11;
    expect((await app.request('/v1/meeting')).status).toBe(429);
    n = 12;
    expect((await app.request('/v1/meeting')).status).toBe(429);
    n = 0; // a known source keeps its own counter
    expect((await app.request('/v1/meeting')).status).toBe(429);
    expect(noteLine('HV-Tool API: rate limit key table full.')).toBe(1);
  });
});

// ---- sign-in paths ----------------------------------------------------------------------------------------

const issuer = 'https://idp.example.invalid/realms/hv';
const meetingAt = '2027-04-20T10:00:00.000Z';

/** A session-ready service over an in-memory store; counters show what reached the store. */
function sessionFixture(over: Partial<CreateAppOptions> = {}, hooks: { exchangeMs?: number; revokeMs?: number } = {}) {
  const actorId = actorIdForIdentity(issuer, 'synthetic-user');
  const events = createInMemoryEventStore();
  events.append([{ id: 'm1', type: 'MeetingCreated', at: meetingAt, actor: SYSTEM_ACTOR, subjectId: 'hv-2027',
    meetingId: 'hv-2027', payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] } } as NewEvent]);
  const domain = createInProcessApi({ store: events, actor: () => SYSTEM_ACTOR, meetingId: 'hv-2027',
    clock: () => new Date(meetingAt), idGenerator: () => 'assignment-1' });
  const counts = { loginStates: 0, sessions: 0 };
  const logins = new Map<string, { browserCorrelation: string; nonce: string; pkceVerifier: string; returnTo: string }>();
  const sessions = new Map<string, { actorId: string; csrfToken: string }>();
  const authStore: AuthStore = {
    async createLoginState(input) { counts.loginStates += 1; logins.set(input.state, input); },
    async consumeLoginState({ state, browserCorrelation }) {
      const found = logins.get(state);
      if (!found || found.browserCorrelation !== browserCorrelation) return null;
      logins.delete(state);
      return found;
    },
    async createSession(input) {
      counts.sessions += 1;
      const token = 's'.repeat(43);
      const csrfToken = 'c'.repeat(43);
      sessions.set(token, { actorId: input.actorId, csrfToken });
      return { token, csrfToken, expiresAt: new Date(Date.parse(meetingAt) + 14 * 3_600_000),
        idleExpiresAt: new Date(Date.parse(meetingAt) + 30 * 60_000) };
    },
    async readSession(token) {
      const session = sessions.get(token);
      return session ? { ...session, expiresAt: new Date(Date.parse(meetingAt) + 14 * 3_600_000),
        idleExpiresAt: new Date(Date.parse(meetingAt) + 30 * 60_000) } : null;
    },
    async verifyCsrf(token, submitted) { return sessions.get(token)?.csrfToken === submitted; },
    async revokeSession(token) { if (hooks.revokeMs) await sleep(hooks.revokeMs); return sessions.delete(token); },
    async blockSubject() {},
    async isSubjectBlocked() { return false; },
  };
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `${issuer}/authorize?state=${state}`; },
    async complete() {
      if (hooks.exchangeMs) await sleep(hooks.exchangeMs);
      return { issuer, subject: 'synthetic-user' };
    },
  };
  const sink = createMemorySink();
  const time = { ms: T0 };
  const seedDomain = domain.assignRole({ subjectId: actorId, role: 'moderation' });
  const app = createApp({ demoEnabled: false, oidcIssuer: issuer, oidcFlow, authStore,
    authEvents: async () => events.all(), clock: () => new Date(time.ms), sourceOf: () => 'source-a',
    accessLog: { sink, hashKey: KEY },
    persistence: { load: () => [...events.all()], save: () => {} },
    transparencyNotice: { version: 'synthetic-1', text: { de: 'Testhinweis.', en: 'Test notice.' } }, ...over });
  return { app, counts, sink, time, ready: seedDomain,
    lines: (): Line[] => sink.lines.map((line) => JSON.parse(line) as Line) };
}

async function signIn(app: App): Promise<string> {
  const login = await app.request('/auth/login');
  const state = new URL(login.headers.get('Location')!).searchParams.get('state');
  const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
  const callback = await app.request(`/auth/callback?code=synthetic-code&state=${state}`, { headers: { Cookie: correlation } });
  return callback.headers.getSetCookie().find((line) => line.startsWith('hv_session='))!.split(';')[0]!;
}

const forged = `hv_session=${'x'.repeat(43)}`;

describe('Scheibe 034a: sign-in start and requests with forged session material (T-G1-D-05, T-G2-D-04)', () => {
  it('answers the 121st /auth/login of a source with 429, also with a forged cookie and X-Actor; the store is not called again', async () => {
    const f = sessionFixture();
    await f.ready;
    for (let i = 0; i < 120; i += 1) {
      const res = await f.app.request('/auth/login', i % 2 === 0 ? {} : { headers: { Cookie: forged, 'X-Actor': 'a:admin' } });
      if (res.status !== 302) throw new Error(`login ${i + 1} answered ${res.status}`);
    }
    expect(f.counts.loginStates).toBe(120);
    const limited = await req(f.app, 'GET', '/auth/login', { headers: { Cookie: forged } });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('45');
    expect((await f.app.request('/auth/login', { headers: { 'X-Actor': 'a:admin' } })).status).toBe(429);
    expect(f.counts.loginStates).toBe(120);
    expect(stderr).toContain('HV-Tool API: sign-in start limit reached.');
  });

  it('answers the 601st sign-in start over many sources with 429 (total)', async () => {
    let n = 0;
    const f = sessionFixture({ sourceOf: () => `source-${n}` });
    await f.ready;
    for (n = 0; n < 600; n += 1) {
      const res = await f.app.request('/auth/login');
      if (res.status !== 302) throw new Error(`login ${n + 1} answered ${res.status}`);
    }
    n = 600;
    expect((await f.app.request('/auth/login')).status).toBe(429);
    expect(f.counts.loginStates).toBe(600);
  });

  it('a flood with a forged cookie: 401 up to request 600, 429 from 601 on, then no further log lines', async () => {
    const f = sessionFixture();
    await f.ready;
    const flood = () => f.app.request('/v1/meeting', { headers: { Cookie: forged } });
    for (let i = 0; i < 600; i += 1) {
      const res = await flood();
      if (res.status !== 401) throw new Error(`request ${i + 1} answered ${res.status}`);
    }
    const first = await flood();
    expect(first.status).toBe(429);
    expect(first.headers.get('Retry-After')).toBe('45');
    expect(f.lines()).toHaveLength(601);
    for (let i = 0; i < 99; i += 1) expect((await flood()).status).toBe(429);
    expect(f.lines()).toHaveLength(601);
    expect(f.lines().at(-1)).toMatchObject({ status: 429, subjectHash: null });
  });

  it('a 413 with a forged cookie counts against the source; from request 601 on the answer is 429', async () => {
    const f = sessionFixture();
    await f.ready;
    const oversize = () => f.app.request('/v1/contributions', { method: 'POST', body: 'x',
      headers: { Cookie: forged, 'Content-Length': '262145', 'Content-Type': 'application/json' } });
    for (let i = 0; i < 600; i += 1) expect((await oversize()).status).toBe(413);
    expect((await oversize()).status).toBe(429);
    for (let i = 0; i < 99; i += 1) expect((await oversize()).status).toBe(429);
    expect(f.lines()).toHaveLength(601);
  });

  it('a request with a valid session stays possible from an exhausted source, and is logged', async () => {
    const f = sessionFixture({ limits: { anonymousPerSource: 2 } });
    await f.ready;
    const cookie = await signIn(f.app);
    for (let i = 0; i < 3; i += 1) await f.app.request('/v1/meeting', { headers: { Cookie: forged } });
    expect((await f.app.request('/v1/meeting', { headers: { Cookie: forged } })).status).toBe(429);
    const before = f.lines().length;
    const ok = await f.app.request('/auth/me', { headers: { Cookie: cookie } });
    expect(ok.status).toBe(200);
    expect(f.lines().length).toBe(before + 1);
    expect(f.lines().at(-1)).toMatchObject({ status: 200 });
    expect(f.lines().at(-1)!.subjectHash).toBeTruthy();
  });

  it('a subject at its write limit can still sign out (`/auth/logout` never answers 429)', async () => {
    const f = sessionFixture({ limits: { writePerSubject: 1 } });
    await f.ready;
    const cookie = await signIn(f.app);
    const me = await (await f.app.request('/auth/me', { headers: { Cookie: cookie } })).json() as { csrfToken: string };
    const write = () => f.app.request('/v1/speakers', { method: 'POST', body: JSON.stringify({ displayName: 'x' }),
      headers: { Cookie: cookie, 'X-CSRF-Token': me.csrfToken, 'Content-Type': 'application/json', 'If-Match': '"v999"' } });
    await write();
    expect((await write()).status).toBe(429);
    const out = await req(f.app, 'POST', '/auth/logout', { headers: { Cookie: cookie, 'X-CSRF-Token': me.csrfToken } });
    expect(out.status).toBe(204);
  });
});

describe('Scheibe 034a: sign-in paths keep their own upper bounds (T-G3-D-01)', () => {
  it('a slow token exchange above the request timeout but below the OIDC limit still yields the session cookie, no 408', async () => {
    const f = sessionFixture({ limits: { requestTimeoutMs: 50, oidcTimeoutMs: 2_000 } }, { exchangeMs: 200 });
    await f.ready;
    const login = await f.app.request('/auth/login');
    const state = new URL(login.headers.get('Location')!).searchParams.get('state');
    const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
    const callback = await req(f.app, 'GET', `/auth/callback?code=synthetic-code&state=${state}`, { headers: { Cookie: correlation } });
    expect(callback.status).toBe(302);
    expect(callback.headers.getSetCookie().some((line) => line.startsWith('hv_session='))).toBe(true);
    expect(f.counts.sessions).toBe(1);
  });

  it('a token exchange above the OIDC limit answers 503 and creates no session', async () => {
    const f = sessionFixture({ limits: { oidcTimeoutMs: 100 } }, { exchangeMs: 400 });
    await f.ready;
    const login = await f.app.request('/auth/login');
    const state = new URL(login.headers.get('Location')!).searchParams.get('state');
    const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
    const callback = await req(f.app, 'GET', `/auth/callback?code=synthetic-code&state=${state}`, { headers: { Cookie: correlation } });
    expect(callback.status).toBe(503);
    expect((await callback.json() as { detail: string }).detail).toBe('Sign-in is unavailable.');
    await sleep(500);
    expect(f.counts.sessions).toBe(0);
  });

  it('a slow authorization URL above the OIDC limit answers 503 and stores no login state', async () => {
    const slowFlow: OidcFlow = { authorizationUrl: async () => { await sleep(400); return `${issuer}/authorize`; },
      complete: async () => ({ issuer, subject: 'x' }) };
    const f = sessionFixture({ oidcFlow: slowFlow, limits: { oidcTimeoutMs: 100 } });
    await f.ready;
    const res = await req(f.app, 'GET', '/auth/login');
    expect(res.status).toBe(503);
    expect(f.counts.loginStates).toBe(0);
  });

  it('/auth/logout with a slow store answers 204, not 408', async () => {
    const f = sessionFixture({ limits: { requestTimeoutMs: 50 } }, { revokeMs: 200 });
    await f.ready;
    const cookie = await signIn(f.app);
    const me = await (await f.app.request('/auth/me', { headers: { Cookie: cookie } })).json() as { csrfToken: string };
    const out = await req(f.app, 'POST', '/auth/logout', { headers: { Cookie: cookie, 'X-CSRF-Token': me.csrfToken } });
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie()).toHaveLength(1);
  });
});

describe('Scheibe 034a (Nachbesserung): every answer to forged session material counts against the source', () => {
  const stateCookie = `hv_auth_state=${'A'.repeat(43)}`;
  const csrf = 'wrong-token';

  it('logout without CSRF (422) and with a wrong CSRF (403): counted, and 429 from request 6 on', async () => {
    for (const headers of [{ Cookie: forged }, { Cookie: forged, 'X-CSRF-Token': csrf }]) {
      const f = sessionFixture({ limits: { anonymousPerSource: 5 } });
      await f.ready;
      const call = () => f.app.request('/auth/logout', { method: 'POST', headers });
      const expected = 'X-CSRF-Token' in headers ? 403 : 422;
      for (let i = 0; i < 5; i += 1) expect((await call()).status).toBe(expected);
      const limited = await req(f.app, 'POST', '/auth/logout', { headers });
      expect(limited.status).toBe(429);
      expect(limited.headers.get('Retry-After')).toBe('45');
    }
  });

  it('callback with a correlation cookie and a forged session cookie (400): counted, 429 from request 6 on', async () => {
    const f = sessionFixture({ limits: { anonymousPerSource: 5 } });
    await f.ready;
    const call = () => f.app.request('/auth/callback', { headers: { Cookie: `${stateCookie}; ${forged}` } });
    for (let i = 0; i < 5; i += 1) expect((await call()).status).toBe(400);
    expect((await call()).status).toBe(429);
  });

  it('a 200 to the transparency notice is never replaced, but it is counted', async () => {
    const f = sessionFixture({ limits: { anonymousPerSource: 5 } });
    await f.ready;
    const call = () => f.app.request('/auth/transparency-notice', { headers: { Cookie: forged } });
    for (let i = 0; i < 8; i += 1) expect((await call()).status).toBe(200); // exhausted after 5, status unchanged
    // the eight answers used the shared counter: the next failing request of the source is refused at once
    expect((await f.app.request('/v1/meeting', { headers: { Cookie: forged } })).status).toBe(429);
  });

  it('a successful callback (302 with the session cookie) is never replaced by 429 when the source is exhausted', async () => {
    const f = sessionFixture({ limits: { anonymousPerSource: 2 } });
    await f.ready;
    const login = await f.app.request('/auth/login');
    const state = new URL(login.headers.get('Location')!).searchParams.get('state');
    const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
    for (let i = 0; i < 4; i += 1) await f.app.request('/v1/meeting', { headers: { Cookie: forged } });
    expect((await f.app.request('/v1/meeting', { headers: { Cookie: forged } })).status).toBe(429);
    const callback = await f.app.request(`/auth/callback?code=synthetic-code&state=${state}`,
      { headers: { Cookie: `${correlation}; ${forged}` } });
    expect(callback.status).toBe(302);
    expect(callback.headers.getSetCookie().some((line) => line.startsWith('hv_session='))).toBe(true);
    expect(f.counts.sessions).toBe(1);
  });
});

describe('Scheibe 034a (Nachbesserung): the total sign-in counter counts only calls the source may make', () => {
  it('700 calls of source A do not block source B', async () => {
    let source = 'source-a';
    const f = sessionFixture({ sourceOf: () => source });
    await f.ready;
    for (let i = 0; i < 700; i += 1) await f.app.request('/auth/login');
    expect((await f.app.request('/auth/login')).status).toBe(429);
    source = 'source-b';
    expect((await f.app.request('/auth/login')).status).toBe(302);
  });
});

describe('Scheibe 034a (Nachbesserung): timers on the pre-checks, pool options, preflight CORS, early exit', () => {
  it('a hanging pre-check query ends in QueryTimeoutError and destroys its connection', async () => {
    const released: unknown[] = [];
    const client = { query: () => new Promise(() => undefined), release: (error?: unknown) => { released.push(error); } };
    const pool = { connect: async () => client } as never;
    await expect(getMigrationStatus(withQueryTimers(pool, 50))).rejects.toBeInstanceOf(QueryTimeoutError);
    expect(released).toHaveLength(1);
    expect(released[0]).toBeInstanceOf(QueryTimeoutError);
  });

  it('the pool options set TCP keep-alive and the connection check interval, and keep a test search_path', () => {
    const options = postgresPoolOptions({ connectionString: 'postgres://u:p@localhost/db' });
    expect(options.keepAlive).toBe(true);
    expect(options.options).toBe('-c client_connection_check_interval=1000');
    expect(postgresPoolOptions({ connectionString: 'x', extra: { options: '-c search_path=s' } }).options)
      .toBe('-c client_connection_check_interval=1000 -c search_path=s');
  });

  it('a refused CORS preflight carries the CORS headers of the allowed origin', async () => {
    const { app } = await harness({ limits: { preflightPerSource: 1 } });
    const preflight = () => app.request('/v1/meetings', { method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' } });
    expect((await preflight()).status).toBe(204);
    const limited = await preflight();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(limited.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
    expect(limited.headers.get('Retry-After')).toBe('45');
  });
});
