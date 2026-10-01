/**
 * Scheibe 033b: `GET /metrics` (Prometheus text), bearer gate, catalog-bound output, result cache,
 * access log line and the technical counter `hv_auth_no_active_role_total`.
 * Threat ids: T-G1-I-10 (no metrics without the token), T-G3-I-03 / T-G3-I-04 (no person, no label
 * outside the catalog), T-G2-D-03 (cache, one computation), T-G1-I-01/SC-03 (no content).
 * Synthetic token and data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createInMemoryEventStore, createInProcessApi, SYSTEM_ACTOR, type NewEvent } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import { actorIdForIdentity, type OidcFlow } from '../auth/oidc.ts';
import type { AuthStore } from '../auth/store.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { readMetricsToken, REFUSE_METRICS_TOKEN } from '../observability/config.ts';
import { catalog } from '../metrics/prometheus.ts';
import { ACTOR, req } from './helpers.ts';

const TOKEN = 'synthetic-metrics-token-0123456789abcdef'; // 40 chars, no real secret
const SAME_LENGTH = 'synthetic-metrics-token-0123456789abcdeX';
const fixed = new Date('2031-05-06T07:08:09.000Z');
const SYNTHETIC_ACTOR = 'synthetic-actor-4711';
const MARKER = 'MARKER-Fragetext-darf-nie-erscheinen';
const bearer = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}` });

afterEach(() => { vi.restoreAllMocks(); });

function fakePool() {
  const calls = { connect: 0, query: 0 };
  const client = { query: async () => { calls.query += 1; return { rows: [] }; }, release() {} };
  const pool = { connect: async () => { calls.connect += 1; return client; },
    query: async () => { calls.query += 1; return { rows: [] }; }, on() {} } as unknown as Pool;
  return { pool, calls };
}

async function seeded(extra: Parameters<typeof createApp>[0] = {}) {
  const sink = createMemorySink();
  let now = fixed;
  const app = createApp({ demoEnabled: true, clock: () => now, metricsToken: TOKEN,
    accessLog: { sink, hashKey: Buffer.alloc(32, 9) }, ...extra });
  const admin = `${SYNTHETIC_ACTOR}:admin`;
  expect((await req(app, 'POST', '/v1/demo/seed', { actor: admin, body: { questions: 30, seed: 3 } })).status).toBe(200);
  return { app, sink, advance(ms: number) { now = new Date(now.getTime() + ms); } };
}

/** Capture one contribution and one question through the API; the write tags come from the responses. */
/** Scheibe 040a: the writer is a capture actor; the administration captures nothing any more. */
async function addQuestion(app: App, writer: string, contributionText: string, questionText: string) {
  const list = await req(app, 'GET', '/v1/speakers', { actor: writer });
  const speakers = await list.json() as { id: string; displayName: string; personId: string; version: number }[];
  const made = await req(app, 'POST', '/v1/contributions', { actor: writer,
    headers: { 'If-Match': `"v${speakers[0]!.version}"` }, body: { speakerId: speakers[0]!.id, text: contributionText } });
  expect(made.status).toBe(201);
  const contribution = await made.json() as { id: string };
  const captured = await req(app, 'POST', `/v1/contributions/${contribution.id}/questions`, { actor: writer,
    headers: { 'If-Match': made.headers.get('ETag')! }, body: { questions: [{ text: questionText }] } });
  expect(captured.status).toBe(201);
  return speakers;
}

describe('Scheibe 033b: T-G1-I-10 no metrics without the token', () => {
  it('answers 401 without Authorization, with a wrong token, with a token of the same length', async () => {
    const { app } = await seeded();
    for (const headers of [{}, bearer('wrong'), bearer(SAME_LENGTH), { Authorization: TOKEN }, { Authorization: `Basic ${TOKEN}` }]) {
      const res = await req(app, 'GET', '/metrics', { headers });
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toContain('application/problem+json');
    }
  });

  it('answers 401 for every call without a configured token, also with a plausible header', async () => {
    const app = createApp({ demoEnabled: true, clock: () => fixed });
    for (const headers of [{}, bearer(TOKEN), bearer('')]) {
      expect((await req(app, 'GET', '/metrics', { headers })).status).toBe(401);
    }
  });

  it('treats a token shorter than 32 characters as not configured', async () => {
    const short = 'short-synthetic-token';
    const app = createApp({ demoEnabled: true, clock: () => fixed, metricsToken: short });
    expect((await req(app, 'GET', '/metrics', { headers: bearer(short) })).status).toBe(401);
  });

  it('does not ask the store before the token is checked (401 cases), and once for a valid call', async () => {
    const { pool, calls } = fakePool();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, metricsToken: TOKEN });
    for (const headers of [{}, bearer('wrong'), bearer(SAME_LENGTH)]) {
      expect((await req(app, 'GET', '/metrics', { headers })).status).toBe(401);
    }
    expect(calls).toEqual({ connect: 0, query: 0 });
    expect((await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) })).status).toBe(200);
    expect(calls.connect).toBe(1);
  });

  it('does not open /v1 or /auth to the metrics token, and /metrics ignores X-Actor', async () => {
    const { app } = await seeded();
    expect((await app.request('/v1/meeting', { headers: bearer(TOKEN) })).status).toBe(401);
    expect((await app.request('/metrics', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(401);
  });

  it('writes the token into no access log line and no process log line', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { app, sink } = await seeded();
    await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) });
    await req(app, 'GET', '/metrics', { headers: bearer(SAME_LENGTH) });
    const everything = [...sink.lines, ...errors.mock.calls.flat(), ...logs.mock.calls.flat()].join('\n');
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain(SAME_LENGTH);
  });

  it('logs getMetrics with subjectHash null for 200 and 401 (the scraper is no actor)', async () => {
    const { app, sink } = await seeded();
    sink.lines.length = 0;
    await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) });
    await req(app, 'GET', '/metrics');
    const lines = sink.lines.map((l) => JSON.parse(l) as { operationId: string; status: number; subjectHash: string | null });
    expect(lines.map((l) => [l.operationId, l.status, l.subjectHash])).toEqual([['getMetrics', 200, null], ['getMetrics', 401, null]]);
  });
});

describe('Scheibe 033b: a failed scan is not cached (cache.ts)', () => {
  it('answers 500 when connect throws once, and reconnects on the next call with an unchanged clock', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { pool: healthy, calls } = fakePool();
    let failures = 1;
    const pool = { ...(healthy as unknown as Record<string, unknown>),
      connect: async () => {
        if (failures-- > 0) throw new Error('connection terminated: host=db.internal password=hunter2');
        return (healthy as unknown as { connect: () => Promise<unknown> }).connect();
      } } as unknown as Pool;
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, metricsToken: TOKEN });
    const first = await app.request('/metrics', { headers: bearer(TOKEN) });
    expect(first.status).toBe(500);
    expect(await first.text()).not.toContain('hunter2');
    const second = await app.request('/metrics', { headers: bearer(TOKEN) });
    expect(second.status).toBe(200);
    expect(calls.connect).toBe(1);
  });
});

describe('Scheibe 033b: HV_METRICS_TOKEN at start', () => {
  it('is optional, but refuses a set value shorter than 32 characters with a fixed sentence', () => {
    expect(readMetricsToken({})).toBeUndefined();
    expect(readMetricsToken({ HV_METRICS_TOKEN: '' })).toBeUndefined();
    expect(readMetricsToken({ HV_METRICS_TOKEN: TOKEN })).toBe(TOKEN);
    expect(() => readMetricsToken({ HV_METRICS_TOKEN: 'short-synthetic' })).toThrow(REFUSE_METRICS_TOKEN);
    expect(REFUSE_METRICS_TOKEN).not.toContain('short-synthetic');
  });
});

describe('Scheibe 033b: output is exactly the catalog (T-G3-I-03, T-G3-I-04, SC-03)', () => {
  it('serves text/plain 0.0.4 with the catalog families in order and labels within the catalog', async () => {
    const { app } = await seeded();
    const res = await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(res.headers.get('X-Server-Time')).toBe(fixed.toISOString());
    const body = await res.text();
    const types = [...body.matchAll(/^# TYPE (\S+) (\S+)$/gm)].map((m) => [m[1], m[2]]);
    expect(types).toEqual(catalog.metrics.map((m) => [m.name, m.type]));
    const helps = [...body.matchAll(/^# HELP (\S+) /gm)].map((m) => m[1]);
    expect(helps).toEqual(catalog.metrics.map((m) => m.name));
    for (const line of body.split('\n').filter((l) => l !== '' && !l.startsWith('#'))) {
      const match = /^([a-z0-9_]+)(?:\{([^}]*)\})?\s(\d+)$/.exec(line);
      expect(match, line).not.toBeNull();
      const metric = catalog.metrics.find((m) => m.name === match![1])!;
      expect(metric, line).toBeDefined();
      const labels = [...(match![2] ?? '').matchAll(/([a-z_]+)="/g)].map((m) => m[1]);
      expect(labels).toEqual(metric.labels);
    }
    const allLabels = new Set(catalog.metrics.flatMap((m) => m.labels));
    expect([...allLabels].sort()).toEqual(['meeting_id', 'unit_id']);
    expect(body).toMatch(/^hv_open_questions\{meeting_id="[^"]+",unit_id="unassigned"\} \d+$/m);
  });

  it('contains no actor id, personId, subject id, display name or question text', async () => {
    const { app } = await seeded();
    const admin = `${SYNTHETIC_ACTOR}:admin`;
    const speakers = await addQuestion(app, `${SYNTHETIC_ACTOR}:capture`, `${MARKER} eins zwei drei`, MARKER);
    const events = await (await req(app, 'GET', '/v1/events?limit=1000', { actor: admin })).json() as
      { items: { type: string; actor: { id: string }; subjectId: string; personId?: string }[] };
    const body = await (await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) })).text();
    expect(body).not.toContain(MARKER);
    expect(body).not.toContain(SYNTHETIC_ACTOR);
    for (const person of new Set(events.items.flatMap((e) => (e.personId ? [e.personId] : [])))) expect(body).not.toContain(person);
    for (const speaker of speakers) {
      expect(body).not.toContain(speaker.displayName);
      expect(body).not.toContain(speaker.id);
      expect(body).not.toContain(speaker.personId);
    }
    const questionIds = events.items.filter((e) => e.type === 'QuestionCaptured').map((e) => e.subjectId);
    expect(questionIds.length).toBeGreaterThan(30);
    for (const questionId of questionIds) expect(body).not.toContain(questionId);
    for (const actorId of new Set(events.items.map((e) => e.actor.id))) expect(body).not.toContain(actorId);
  });

  it('shows only HELP and TYPE for families 1 to 4 without a running meeting, but events and counter', async () => {
    const { pool } = fakePool();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, metricsToken: TOKEN });
    const body = await (await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) })).text();
    const samples = body.split('\n').filter((l) => l !== '' && !l.startsWith('#'));
    expect(samples).toEqual(['hv_events_last_1m 0', 'hv_auth_no_active_role_total 0']);
  });
});

describe('Scheibe 033b: T-G2-D-03 result cache with one computation', () => {
  it('answers 20 queries within 10 s from one scan of the store', async () => {
    const { pool, calls } = fakePool();
    let now = fixed;
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => now, metricsToken: TOKEN });
    const call = () => app.request('/metrics', { headers: bearer(TOKEN) });
    await Promise.all(Array.from({ length: 10 }, call));
    for (let i = 0; i < 10; i += 1) { now = new Date(now.getTime() + 900); await call(); }
    expect(calls.connect).toBe(1);
    now = new Date(fixed.getTime() + 10_000);
    await call();
    expect(calls.connect).toBe(2);
  });

  it('shows a new question only after the window (values are cached, the log is not the source)', async () => {
    const { app, advance } = await seeded();
    const writer = `${SYNTHETIC_ACTOR}:capture`;
    const value = async (): Promise<number> => Number(/^hv_questions_captured_last_5m\{[^}]*\} (\d+)$/m
      .exec(await (await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) })).text())![1]);
    const before = await value();
    await addQuestion(app, writer, 'Synthetischer Text', 'Synthetisch');
    advance(9_000);
    expect(await value()).toBe(before);
    advance(1_000);
    expect(await value()).toBe(before + 1);
  });
});

describe('Scheibe 033b: hv_auth_no_active_role_total (Spec 030, Ziel 8)', () => {
  const min = 60_000;
  async function sessionFixture() {
    const issuer = 'https://idp.example.invalid/realms/one';
    const actorId = actorIdForIdentity(issuer, 'synthetic-user');
    const events = createInMemoryEventStore();
    events.append([{ id: 'm1', type: 'MeetingCreated', at: fixed.toISOString(), actor: SYSTEM_ACTOR,
      subjectId: 'hv-2031', meetingId: 'hv-2031', payload: { title: 'HV 2031', date: '2031-05-06', agendaItems: [], units: [] } }] as NewEvent[]);
    let n = 0;
    const domain = createInProcessApi({ store: events, actor: () => SYSTEM_ACTOR, meetingId: 'hv-2031',
      clock: () => fixed, idGenerator: () => `assignment-${++n}` });
    await domain.assignRole({ subjectId: actorId, role: 'moderation' });
    const sessions = new Map<string, { actorId: string; csrfToken: string }>();
    const authStore: AuthStore = {
      async createLoginState() {}, async consumeLoginState() { return null; },
      async createSession(input) {
        sessions.set('s'.repeat(43), { actorId: input.actorId, csrfToken: 'c'.repeat(43) });
        return { token: 's'.repeat(43), csrfToken: 'c'.repeat(43), expiresAt: new Date(fixed.getTime() + 60 * min),
          idleExpiresAt: new Date(fixed.getTime() + 30 * min) };
      },
      async readSession(token) {
        const found = sessions.get(token);
        return found ? { actorId: found.actorId, csrfToken: found.csrfToken,
          expiresAt: new Date(fixed.getTime() + 60 * min), idleExpiresAt: new Date(fixed.getTime() + 30 * min) } : null;
      },
      async verifyCsrf() { return true; }, async revokeSession() { return true; }, async blockSubject() {},
      async isSubjectBlocked() { return false; },
    };
    const oidcFlow: OidcFlow = { async authorizationUrl() { return `${issuer}/authorize`; },
      async complete() { return { issuer, subject: 'synthetic-user' }; } };
    const app = createApp({ demoEnabled: false, oidcIssuer: issuer, oidcFlow, authStore, metricsToken: TOKEN,
      authEvents: async () => events.all(), clock: () => fixed,
      persistence: { load: () => [...events.all()], save: () => {} },
      transparencyNotice: { version: 'synthetic-1', text: { de: 'Testhinweis.', en: 'Test notice.' } } });
    await authStore.createSession({ actorId, now: fixed });
    return { app, domain, actorId, cookie: `hv_session=${'s'.repeat(43)}` };
  }
  const counter = async (app: App): Promise<number> => Number(/^hv_auth_no_active_role_total (\d+)$/m
    .exec(await (await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) })).text())![1]);

  it('counts each 403 of a session without an active role, on /auth/me and on /v1', async () => {
    const { app, domain, cookie, actorId } = await sessionFixture();
    expect(await counter(app)).toBe(0);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(200);
    expect(await counter(app)).toBe(0);
    await domain.revokeRole('assignment-1');
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(403);
    expect((await app.request('/v1/meeting', { headers: { Cookie: cookie } })).status).toBe(403);
    expect(await counter(app)).toBe(2);
    const body = await (await req(app, 'GET', '/metrics', { headers: bearer(TOKEN) })).text();
    expect(body).not.toContain(actorId);
    expect(body).not.toContain('synthetic-user');
    expect(body).not.toMatch(/^hv_auth_no_active_role_total\{/m);
  });

  it('counts only /auth/me and /v1/ paths: a role-less session on /foo leaves the counter unchanged', async () => {
    const { app, domain, cookie } = await sessionFixture();
    await domain.revokeRole('assignment-1');
    expect((await app.request('/foo', { headers: { Cookie: cookie } })).status).toBe(403);
    expect((await app.request('/v1x', { headers: { Cookie: cookie } })).status).toBe(403);
    expect(await counter(app)).toBe(0);
    expect((await app.request('/v1/meeting', { headers: { Cookie: cookie } })).status).toBe(403);
    expect(await counter(app)).toBe(1);
  });

  it('does not count an unauthenticated 401 or a plain 200', async () => {
    const { app, cookie } = await sessionFixture();
    await app.request('/v1/meeting');
    await app.request('/v1/meeting', { headers: { Cookie: cookie } });
    expect(await counter(app)).toBe(0);
  });
});
