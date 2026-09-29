/**
 * Scheibe 033a: technical access log (ADR 0013 level 2) — one JSON line per request, no payload data.
 * T-G1-R-01, T-G3-I-04, T-G1-I-05, T-G2-I-02, T-G2-D-04, retention (E16), correlation id, `instance`.
 */
import { createHmac } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryEventStore, createInProcessApi, SYSTEM_ACTOR, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import type { App } from '../app.ts';
import { actorIdForIdentity, type OidcFlow } from '../auth/oidc.ts';
import type { AuthStore } from '../auth/store.ts';
import { createFileSink, createMemorySink, type AccessLogSink } from '../observability/accessLog.ts';
import { readObservabilityConfig } from '../observability/config.ts';
import { ACTOR, req } from './helpers.ts';

const fixed = new Date('2031-05-06T07:08:09.000Z');
const KEY = Buffer.alloc(32, 1);
const EXACT_KEYS = ['latencyMs', 'operationId', 'requestId', 'seq', 'status', 'subjectHash', 'ts', 'v'];
const hashOf = (key: Buffer, id: string): string => createHmac('sha256', key).update(id).digest('base64url');

interface Line { v: number; ts: string; requestId: string; subjectHash: string | null; operationId: string | null;
  status: number; latencyMs: number; seq: number | null }
const parse = (lines: string[]): Line[] => lines.map((l) => JSON.parse(l) as Line);

/** A demo app over a seeded synthetic meeting; the seeding request itself is not part of the log under test. */
async function fixture(extra: Parameters<typeof createApp>[0] = {}, seed = true) {
  const sink = createMemorySink();
  let saved = 0;
  const app = createApp({ demoEnabled: true, clock: () => fixed, accessLog: { sink, hashKey: KEY },
    persistence: { load: () => undefined, save: (all: readonly DomainEvent[]) => { saved = all.length; } },
    ...extra });
  if (seed) {
    const res = await app.request('/v1/demo/seed', { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: 20, seed: 2 }) });
    expect(res.status).toBe(200);
    sink.lines.length = 0;
  }
  return { app, sink, lines: () => parse(sink.lines), lastSaved: () => saved };
}

describe('Scheibe 033a: shape of a line (T-G1-R-01)', () => {
  it('writes exactly the eight keys, with values from the injected clock and monotonic source', async () => {
    let t = 100;
    const { app, lines } = await fixture({ monotonic: () => (t += 7) });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(200);
    expect(lines()).toHaveLength(1);
    const line = lines()[0]!;
    expect(Object.keys(line).sort()).toEqual(EXACT_KEYS);
    expect(line).toMatchObject({ v: 1, ts: fixed.toISOString(), operationId: 'getMeeting', status: 200,
      latencyMs: 7, seq: null, subjectHash: hashOf(KEY, 'admin') });
    expect(line.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('logs the new seq of a write and null for a read and for a 409', async () => {
    const { app, lines, lastSaved } = await fixture();
    const tag = (await req(app, 'GET', '/v1/speakers', { actor: ACTOR.moderation })).headers.get('ETag')!;
    const created = await req(app, 'POST', '/v1/speakers', { actor: ACTOR.moderation, headers: { 'If-Match': tag },
      body: { displayName: 'Nur synthetisch' } });
    expect(created.status).toBe(201);
    const write = lines().at(-1)!;
    expect(write).toMatchObject({ operationId: 'registerSpeaker', status: 201 });
    expect(write.seq).toBe(lastSaved());
    expect(write.seq).toBeGreaterThan(0);
    expect(lines()[0]).toMatchObject({ operationId: 'listSpeakers', seq: null });

    const question = await app.request('/v1/questions/nope/approvals', { method: 'POST',
      headers: { 'X-Actor': ACTOR.approver, 'Content-Type': 'application/json', 'If-Match': '"v1"' },
      body: JSON.stringify({ answerVersion: 1 }) });
    expect(question.status).toBe(404);
    expect(lines().at(-1)).toMatchObject({ operationId: 'approveQuestion', status: 404, seq: null });
  });

  it('logs seq null on a 409 after a seeded corpus', async () => {
    const { app, lines } = await fixture();
    const list = await req(app, 'GET', '/v1/questions?status=captured&limit=1', { actor: ACTOR.admin });
    const q = (await list.json() as { items: { id: string; version: number }[] }).items[0]!;
    const res = await req(app, 'POST', `/v1/questions/${q.id}/approvals`, { actor: ACTOR.approver,
      headers: { 'If-Match': `"v${q.version}"` }, body: { answerVersion: 1 } });
    expect(res.status).toBe(409);
    expect(lines().at(-1)).toMatchObject({ operationId: 'approveQuestion', status: 409, seq: null });
  });

  it('writes nothing to disk by default, even with HV_ACCESS_LOG_DIR set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hv-al-default-'));
    vi.stubEnv('HV_ACCESS_LOG_DIR', dir);
    try {
      const app = createApp({ demoEnabled: true, clock: () => fixed });
      await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes one line per request, also for 404 and for an unexpected 500', async () => {
    const { app, lines } = await fixture();
    const failing = await fixture({ persistence: { load: () => undefined, save: () => { throw new Error('boom'); } } }, false);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect((await app.request('/v1/no-such-route', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(404);
      expect(lines()).toHaveLength(1);
      expect(lines()[0]).toMatchObject({ status: 404, operationId: null });
      const res = await failing.app.request('/v1/demo/seed', { method: 'POST',
        headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: '{}' });
      expect(res.status).toBe(500);
      expect(failing.lines()).toHaveLength(1);
      expect(failing.lines()[0]).toMatchObject({ status: 500, operationId: 'seedDemo', seq: null });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Scheibe 033a: no payload data in the line (MF-09 proof, T-G1-I-05)', () => {
  it('keeps question and contribution text out of every line, for 201 and 422', async () => {
    const MARKER = 'MARKER-Fragetext-4711';
    const { app, sink } = await fixture();
    const tag = (await req(app, 'GET', '/v1/speakers', { actor: ACTOR.moderation })).headers.get('ETag')!;
    const speaker = await (await req(app, 'POST', '/v1/speakers', { actor: ACTOR.moderation, headers: { 'If-Match': tag },
      body: { displayName: 'Nur synthetisch' } })).json() as { id: string; version: number };
    const contribution = await req(app, 'POST', '/v1/contributions', { actor: ACTOR.capture,
      headers: { 'If-Match': `"v${speaker.version}"` }, body: { speakerId: speaker.id, text: `Frage? ${MARKER}?` } });
    expect(contribution.status).toBe(201);
    const c = await contribution.json() as { id: string; version: number };
    const questions = await req(app, 'POST', `/v1/contributions/${c.id}/questions`, { actor: ACTOR.capture,
      headers: { 'If-Match': `"v${c.version}"` }, body: { questions: [{ text: MARKER }] } });
    expect(questions.status).toBe(201);
    const bad1 = await app.request('/v1/contributions', { method: 'POST',
      headers: { 'X-Actor': ACTOR.capture, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: MARKER }) });
    const bad2 = await app.request(`/v1/contributions/${c.id}/questions`, { method: 'POST',
      headers: { 'X-Actor': ACTOR.capture, 'Content-Type': 'application/json', 'If-Match': '"v1"' },
      body: JSON.stringify({ questions: [{ text: MARKER, span: 'kaputt' }] }) });
    expect(bad1.status).toBe(422);
    expect(bad2.status).toBe(422);
    expect(sink.lines.length).toBeGreaterThanOrEqual(6);
    expect(sink.lines.join('\n')).not.toContain(MARKER);
    expect(sink.lines.join('\n')).not.toContain('Nur synthetisch');
    expect(sink.lines.some((l) => (JSON.parse(l) as Line).status === 422)).toBe(true);
  });

  it('survives hostile client strings: valid JSON, exact keys, one line each, nothing echoed', async () => {
    const { app, sink } = await fixture();
    const hostile = 'evil","operationId":"x","status":200}{"MARKER-hdr":"\\';
    const calls = [
      app.request('/v1/meeting', { headers: { 'X-Actor': hostile } }),
      app.request('/v1/speakers/%0d%0a%E2%80%A8%7B%22x%22:1%7DMARKER-path', { headers: { 'X-Actor': ACTOR.admin } }),
      app.request('/v1/questions?q=MARKER-query%0d%0a%7B%7D', { headers: { 'X-Actor': ACTOR.admin,
        'User-Agent': 'MARKER-agent', 'X-Request-Id': 'MARKER-rid' } }),
      app.request('/MARKER-root/%22%7D', { headers: { 'X-Actor': ACTOR.admin } }),
    ];
    await Promise.all(calls);
    expect(sink.lines).toHaveLength(4);
    for (const raw of sink.lines) {
      expect(raw).not.toContain('\n');
      expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual(EXACT_KEYS);
    }
    expect(sink.lines.join('')).not.toMatch(/MARKER|evil/);
  });

  it('maps a request to an operation only under the base URL its servers entry declares (T-G1-I-05)', async () => {
    const { app, lines } = await fixture();
    const get = (path: string) => app.request(path, { headers: { 'X-Actor': ACTOR.admin } });
    expect((await get('/v1/healthz')).status).toBe(404);
    expect(lines().at(-1)).toMatchObject({ operationId: null, status: 404 });
    expect((await get('/healthz')).status).toBe(200);
    expect(lines().at(-1)).toMatchObject({ operationId: 'getHealth', subjectHash: null });
    expect((await get('/speakers')).status).toBe(404);
    expect(lines().at(-1)).toMatchObject({ operationId: null });
    expect((await get('/v1/speakers')).status).toBe(200);
    expect(lines().at(-1)).toMatchObject({ operationId: 'listSpeakers' });
    await get('/readyz');
    expect(lines().at(-1)).toMatchObject({ operationId: 'getReadiness' });
    await get('/auth/transparency-notice');
    expect(lines().at(-1)).toMatchObject({ operationId: 'getTransparencyNotice' });
    await get('/v1/meeting');
    expect(lines().at(-1)).toMatchObject({ operationId: 'getMeeting' });
  });
});

describe('Scheibe 033a: correlation id and problem `instance`', () => {
  it('puts the same service-generated id into `instance` and the line, and ignores X-Request-Id', async () => {
    const { app, lines } = await fixture();
    const res = await app.request('/v1/no-such-route', { headers: { 'X-Actor': ACTOR.admin,
      'X-Request-Id': 'client-chosen-id' } });
    const problem = await res.json() as { instance: string };
    const line = lines()[0]!;
    expect(problem.instance).toBe(`urn:hv:request:${line.requestId}`);
    expect(line.requestId).not.toContain('client-chosen-id');
    expect(res.headers.get('X-Request-Id')).toBeNull();
    const second = await app.request('/v1/no-such-route', { headers: { 'X-Actor': ACTOR.admin } });
    expect((await second.json() as { instance: string }).instance).not.toBe(problem.instance);
  });
});

describe('Scheibe 033a: unexpected errors leave no payload (T-G2-I-02)', () => {
  it('reduces the error log to four keys and keeps the message out of response, access log and error log', async () => {
    const MARKER = 'MARKER-secret-in-message-0815';
    const { app, lines } = await fixture({ persistence: { load: () => undefined,
      save: () => { throw new Error(`postgres://user:${MARKER}@host/db`); } } }, false);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const res = await app.request('/v1/demo/seed', { method: 'POST',
        headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: '{}' });
      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).not.toContain(MARKER);
      const logged = spy.mock.calls.flat().map((x) => (typeof x === 'string' ? x : JSON.stringify(x, Object.getOwnPropertyNames(x as object))));
      expect(logged.join('\n')).not.toContain(MARKER);
      expect(JSON.stringify(lines())).not.toContain(MARKER);
      const errorLines = spy.mock.calls.map((call) => call[0]).filter((x): x is string => typeof x === 'string')
        .map((x) => JSON.parse(x) as Record<string, unknown>).filter((x) => x['log'] === 'error');
      expect(errorLines).toHaveLength(1);
      expect(Object.keys(errorLines[0]!).sort()).toEqual(['errorClass', 'log', 'requestId', 'ts']);
      expect(errorLines[0]).toMatchObject({ requestId: lines()[0]!.requestId, ts: fixed.toISOString(), errorClass: 'Error' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Scheibe 033a: subject hash (T-G3-I-04)', () => {
  it('is an HMAC of the actor id: stable per key, different per key, null without an actor', async () => {
    const one = await fixture();
    const other = createMemorySink();
    const second = createApp({ demoEnabled: true, clock: () => fixed, accessLog: { sink: other, hashKey: Buffer.alloc(32, 2) } });
    await req(one.app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    await req(one.app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    await req(second, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    const [a, b] = one.lines();
    expect(a!.subjectHash).toBe(b!.subjectHash);
    expect(a!.subjectHash).not.toBe('admin');
    expect(a!.subjectHash).not.toBe(parse(other.lines)[0]!.subjectHash);
    await one.app.request('/v1/meeting', { headers: { 'X-Actor': 'no-role' } });
    await one.app.request('/v1/meeting');
    expect(one.lines().at(-1)!.subjectHash).toBeNull();
    expect(one.lines().at(-2)!.subjectHash).toBeNull();
  });
});

const at = new Date('2027-04-20T10:00:00.000Z');
const SUBJECT = 'synthetic-user-sub-9931';
const ISSUER = 'https://idp.example.invalid/realms/hv';

async function sessionFixture() {
  const actorId = actorIdForIdentity(ISSUER, SUBJECT);
  const events = createInMemoryEventStore();
  const meeting: NewEvent[] = [{ id: 'm1', type: 'MeetingCreated', at: at.toISOString(), actor: SYSTEM_ACTOR,
    subjectId: 'hv-2027', meetingId: 'hv-2027', payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] } }];
  events.append(meeting);
  const domain = createInProcessApi({ store: events, actor: () => SYSTEM_ACTOR, meetingId: 'hv-2027',
    clock: () => at, idGenerator: () => 'assignment-1' });
  await domain.assignRole({ subjectId: actorId, role: 'moderation' });
  const sessions = new Map<string, { actorId: string; csrfToken: string }>();
  const token = 's'.repeat(43);
  const csrf = 'c'.repeat(43);
  sessions.set(token, { actorId, csrfToken: csrf });
  const expiry = { expiresAt: new Date(at.getTime() + 3_600_000), idleExpiresAt: new Date(at.getTime() + 1_800_000) };
  const authStore: AuthStore = {
    async createLoginState() {}, async consumeLoginState() { return null; },
    async createSession() { throw new Error('unused'); },
    async readSession(t) { const s = sessions.get(t); return s ? { ...s, ...expiry } : null; },
    async verifyCsrf(t, submitted) { return sessions.get(t)?.csrfToken === submitted; },
    async revokeSession(t) { return sessions.delete(t); },
    async blockSubject() {}, async isSubjectBlocked() { return false; },
  };
  const oidcFlow: OidcFlow = { async authorizationUrl() { return 'https://idp.example.invalid/a'; },
    async complete() { throw new Error('unused'); } };
  const sink = createMemorySink();
  const app: App = createApp({ demoEnabled: false, oidcIssuer: ISSUER, oidcFlow, authStore,
    authEvents: async () => events.all(), clock: () => at, accessLog: { sink, hashKey: KEY },
    persistence: { load: () => [...events.all()], save: () => {} } });
  return { app, sink, actorId, token, csrf, sessions };
}

describe('Scheibe 033a: session actors in the line (T-G3-I-04)', () => {
  it('hashes the actor id: no oidc_ prefix, no subject, no e-mail; a wrong CSRF token still logs the hash; an expired session logs null', async () => {
    const { app, sink, actorId, token, csrf, sessions } = await sessionFixture();
    const cookie = `hv_session=${token}`;
    const ok = await app.request('/v1/meeting', { headers: { Cookie: cookie } });
    expect(ok.status).toBe(200);
    const badCsrf = await app.request('/v1/speakers', { method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': 'wrong', 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Nur synthetisch' }) });
    expect(badCsrf.status).toBe(403);
    const noCsrf = await app.request('/v1/speakers', { method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: 'Nur synthetisch' }) });
    expect(noCsrf.status).toBe(403);
    const me = await app.request('/auth/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);
    const logoutBadCsrf = await app.request('/auth/logout', { method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': 'wrong' } });
    expect(logoutBadCsrf.status).toBe(403);
    sessions.delete(token);
    const expired = await app.request('/v1/meeting', { headers: { Cookie: cookie } });
    expect(expired.status).toBe(401);
    void csrf;

    const lines = parse(sink.lines);
    expect(lines).toHaveLength(6);
    const expected = hashOf(KEY, actorId);
    expect(lines[0]!.subjectHash).toBe(expected);
    expect(lines[1]).toMatchObject({ status: 403, subjectHash: expected, operationId: 'registerSpeaker' });
    expect(lines[2]).toMatchObject({ status: 403, subjectHash: expected });
    expect(lines[3]).toMatchObject({ operationId: 'getSession', status: 200, subjectHash: expected });
    expect(lines[4]).toMatchObject({ operationId: 'logout', status: 403, subjectHash: expected });
    expect(lines[5]).toMatchObject({ status: 401, subjectHash: null });
    const all = sink.lines.join('\n');
    for (const forbidden of ['oidc_', SUBJECT, actorId, 'example', token]) expect(all).not.toContain(forbidden);
    expect(expected).not.toBe(actorId);
  });
});

describe('Scheibe 033a: file sink and retention (E16)', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hv-al-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });
  const name = (day: string): string => `access-${day}.jsonl`;

  it('appends one file per UTC day of the injected clock with mode 0600', () => {
    let now = new Date('2031-05-06T23:59:59.000Z');
    const sink = createFileSink({ dir, retentionDays: 30, clock: () => now });
    sink.write('{"a":1}', now);
    sink.write('{"a":2}', now);
    now = new Date('2031-05-07T00:00:00.000Z');
    sink.write('{"a":3}', now);
    expect(readdirSync(dir).sort()).toEqual([name('2031-05-06'), name('2031-05-07')]);
    expect(readFileSync(join(dir, name('2031-05-06')), 'utf8')).toBe('{"a":1}\n{"a":2}\n');
    expect(statSync(join(dir, name('2031-05-06'))).mode & 0o777).toBe(0o600);
  });

  it('keeps day D at D+30, deletes it at D+31, leaves foreign files and symlinks alone', () => {
    writeFileSync(join(dir, name('2031-01-01')), 'x\n');
    writeFileSync(join(dir, name('2031-01-02')), 'x\n');
    writeFileSync(join(dir, 'notes.txt'), 'keep');
    writeFileSync(join(dir, name('2031-01-01') + '.bak'), 'keep');
    mkdirSync(join(dir, name('2030-12-31')));
    const outside = join(dir, 'target.txt');
    writeFileSync(outside, 'keep');
    symlinkSync(outside, join(dir, name('2030-01-01')));
    // 2031-01-31 = 2031-01-01 + 30 days: still kept.
    createFileSink({ dir, retentionDays: 30, clock: () => new Date('2031-01-31T12:00:00.000Z') });
    expect(existsSync(join(dir, name('2031-01-01')))).toBe(true);
    // 2031-02-01 = D + 31: day 2031-01-01 is gone, 2031-01-02 (D+30) stays.
    createFileSink({ dir, retentionDays: 30, clock: () => new Date('2031-02-01T00:00:00.000Z') });
    expect(existsSync(join(dir, name('2031-01-01')))).toBe(false);
    expect(existsSync(join(dir, name('2031-01-02')))).toBe(true);
    for (const kept of ['notes.txt', name('2031-01-01') + '.bak', name('2030-12-31'), name('2030-01-01'), 'target.txt']) {
      expect(() => lstatSync(join(dir, kept)), kept).not.toThrow();
    }
    expect(lstatSync(join(dir, name('2030-01-01'))).isSymbolicLink()).toBe(true);
    expect(readFileSync(outside, 'utf8')).toBe('keep');
  });

  it('runs the sweep at the first write of a new day', () => {
    let now = new Date('2031-01-31T12:00:00.000Z');
    writeFileSync(join(dir, name('2031-01-01')), 'x\n');
    const sink = createFileSink({ dir, retentionDays: 30, clock: () => now });
    expect(existsSync(join(dir, name('2031-01-01')))).toBe(true);
    now = new Date('2031-02-01T00:00:01.000Z');
    sink.write('{"a":1}', now);
    expect(existsSync(join(dir, name('2031-01-01')))).toBe(false);
  });

  it('is what createApp writes through when configured', async () => {
    const sink = createFileSink({ dir, retentionDays: 30, clock: () => fixed });
    const app = createApp({ demoEnabled: true, clock: () => fixed, accessLog: { sink, hashKey: KEY } });
    await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    const file = join(dir, name('2031-05-06'));
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(1);
  });
});

describe('Scheibe 033a: sink failure is fail-open (T-G2-D-04)', () => {
  it('answers the request, and writes at most one fixed stderr line per minute without content', async () => {
    let now = new Date('2031-05-06T07:00:00.000Z');
    let failing = false;
    const broken: AccessLogSink = { write() { if (failing) throw new Error('ENOSPC MARKER-disk /secret/path'); } };
    const app = createApp({ demoEnabled: true, clock: () => now, accessLog: { sink: broken, hashKey: KEY } });
    await app.request('/v1/demo/seed', { method: 'POST', headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: 5, seed: 1 }) });
    failing = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      for (let i = 0; i < 3; i += 1) expect((await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin })).status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      const text = String(spy.mock.calls[0]![0]);
      expect(text).toBe('HV-Tool API: access log sink unavailable.');
      now = new Date('2031-05-06T07:01:00.000Z');
      await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.flat().join('')).not.toMatch(/MARKER|secret/);
    } finally {
      spy.mockRestore();
    }
  });

  it('answers when the directory does not exist', async () => {
    const missing = join(tmpdir(), `hv-al-missing-${Date.now().toString(36)}`, 'nested');
    const sink = createFileSink({ dir: missing, retentionDays: 30, clock: () => fixed });
    const app = createApp({ demoEnabled: true, clock: () => fixed, accessLog: { sink, hashKey: KEY } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const seeded = await app.request('/v1/demo/seed', { method: 'POST',
        headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: 5, seed: 1 }) });
      expect(seeded.status).toBe(200);
      expect((await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin })).status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Scheibe 033a: start refusal without an access log (T-G2-D-04)', () => {
  const key = Buffer.alloc(32, 9).toString('base64');
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hv-al-cfg-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('refuses outside demo mode without a directory, with a fixed sentence and no value', () => {
    expect(() => readObservabilityConfig({ HV_ACCESS_LOG_HASH_KEY: key })).toThrow(
      'HV-Tool API: refusing to start: HV_ACCESS_LOG_DIR must name a writable directory.');
  });

  it('refuses a directory that is not writable or not a directory, without echoing it', () => {
    const missing = join(dir, 'MARKER-missing');
    let message = '';
    try { readObservabilityConfig({ HV_ACCESS_LOG_DIR: missing, HV_ACCESS_LOG_HASH_KEY: key }); } catch (e) { message = String(e); }
    expect(message).toContain('HV_ACCESS_LOG_DIR must name a writable directory');
    expect(message).not.toContain('MARKER');
    const file = join(dir, 'plain.txt');
    writeFileSync(file, '');
    expect(() => readObservabilityConfig({ HV_ACCESS_LOG_DIR: file, HV_ACCESS_LOG_HASH_KEY: key })).toThrow(/writable directory/);
  });

  it('refuses a missing, malformed or short key', () => {
    for (const bad of [undefined, '', '%%%not-base64%%%', Buffer.alloc(31, 1).toString('base64')]) {
      const env = { HV_ACCESS_LOG_DIR: dir, ...(bad !== undefined ? { HV_ACCESS_LOG_HASH_KEY: bad } : {}) };
      expect(() => readObservabilityConfig(env)).toThrow(
        'HV-Tool API: refusing to start: HV_ACCESS_LOG_HASH_KEY must be base64 and at least 32 bytes.');
    }
  });

  it('refuses a retention outside 1..365 and defaults to 30', () => {
    for (const bad of ['0', '366', 'abc', '1.5', '']) {
      expect(() => readObservabilityConfig({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: key,
        HV_ACCESS_LOG_RETENTION_DAYS: bad })).toThrow(/HV_ACCESS_LOG_RETENTION_DAYS/);
    }
    expect(readObservabilityConfig({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: key }).retentionDays).toBe(30);
    expect(readObservabilityConfig({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: key,
      HV_ACCESS_LOG_RETENTION_DAYS: '365' }).retentionDays).toBe(365);
  });

  it('accepts the full configuration', () => {
    const config = readObservabilityConfig({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: key });
    expect(config.dir).toBe(dir);
    expect(config.hashKey.equals(Buffer.alloc(32, 9))).toBe(true);
  });

  it('lets demo mode run without directory and key: discarded sink, random key per process', () => {
    const a = readObservabilityConfig({ HV_DEMO: '1' });
    const b = readObservabilityConfig({ HV_DEMO: '1' });
    expect(a.dir).toBeUndefined();
    expect(a.hashKey.length).toBeGreaterThanOrEqual(32);
    expect(a.hashKey.equals(b.hashKey)).toBe(false);
  });

  it('still validates what demo mode is given', () => {
    expect(() => readObservabilityConfig({ HV_DEMO: '1', HV_ACCESS_LOG_HASH_KEY: 'short' })).toThrow(/HV_ACCESS_LOG_HASH_KEY/);
    expect(() => readObservabilityConfig({ HV_DEMO: '1', HV_ACCESS_LOG_DIR: join(dir, 'nope') })).toThrow(/HV_ACCESS_LOG_DIR/);
  });
});
