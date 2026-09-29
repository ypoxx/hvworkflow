/**
 * Scheibe 033a: `X-Server-Time` on every response (T-G1-T-07) and `GET /healthz` (Liveness).
 * The header comes from the injected clock, never from a request header (AGENTS.md rule 8).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
import type { AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { ACTOR, req } from './helpers.ts';

const fixed = new Date('2031-05-06T07:08:09.000Z');
const FIXED = fixed.toISOString();

describe('Scheibe 033a: X-Server-Time on every response (T-G1-T-07)', () => {
  let app: App;
  beforeAll(async () => {
    app = createApp({ demoEnabled: true, clock: () => fixed });
    const seeded = await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 30, seed: 3 } });
    expect(seeded.status).toBe(200);
  });

  const call = (path: string, init: RequestInit = {}, actor: string | null = ACTOR.admin): Promise<Response> =>
    Promise.resolve(app.request(path, { ...init, headers: { ...(actor ? { 'X-Actor': actor } : {}),
      ...(init.headers as Record<string, string> | undefined) } }));

  async function speakerTag(): Promise<string> {
    return (await call('/v1/speakers', {}, ACTOR.moderation)).headers.get('ETag')!;
  }

  async function capturedQuestion(): Promise<{ id: string; version: number }> {
    const list = await call('/v1/questions?status=captured&limit=1');
    return (await list.json() as { items: { id: string; version: number }[] }).items[0]!;
  }

  it('is the injected clock on 200', async () => {
    const res = await call('/v1/meeting');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Server-Time')).toBe(FIXED);
  });

  it('is the injected clock on 201', async () => {
    const res = await call('/v1/speakers', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'If-Match': await speakerTag() },
      body: JSON.stringify({ displayName: 'Nur synthetisch', round: 1 }) }, ACTOR.moderation);
    expect(res.status).toBe(201);
    expect(res.headers.get('X-Server-Time')).toBe(FIXED);
  });

  it('is the injected clock on 401, 403, 404, 409, 412 and 422', async () => {
    const q = await capturedQuestion();
    const jsonHeaders = { 'Content-Type': 'application/json' };
    const cases: [number, Response][] = [
      [401, await call('/v1/questions', {}, null)],
      [403, await call('/v1/speakers', { method: 'POST', headers: { ...jsonHeaders, 'If-Match': await speakerTag() },
        body: JSON.stringify({ displayName: 'Nur synthetisch', round: 1 }) }, ACTOR.observer)],
      [404, await call('/v1/no-such-route')],
      [409, await call(`/v1/questions/${q.id}/approvals`, { method: 'POST',
        headers: { ...jsonHeaders, 'If-Match': `"v${q.version}"` }, body: JSON.stringify({ answerVersion: 1 }) }, ACTOR.approver)],
      [412, await call(`/v1/questions/${q.id}/classification`, { method: 'POST',
        headers: { ...jsonHeaders, 'If-Match': '"v999"' }, body: JSON.stringify({ track: 'podium' }) }, 'coord:coordination')],
      [422, await call('/v1/questions?limit=abc')],
    ];
    for (const [status, res] of cases) {
      expect(res.status, `status ${status}`).toBe(status);
      expect(res.headers.get('X-Server-Time'), `status ${status}`).toBe(FIXED);
    }
  });

  it('is the injected clock on 500 from onError, without leaking the message', async () => {
    const failing = createApp({ demoEnabled: true, clock: () => fixed,
      persistence: { load: () => undefined, save: () => { throw new Error('disk exploded MARKER-500'); } } });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const res = await failing.request('/v1/demo/seed', { method: 'POST',
        headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: '{}' });
      expect(res.status).toBe(500);
      expect(res.headers.get('X-Server-Time')).toBe(FIXED);
      expect(await res.text()).not.toContain('MARKER-500');
    } finally {
      spy.mockRestore();
    }
  });

  it('is the injected clock on 302 (/auth/login)', async () => {
    const authStore = { async createLoginState() {} } as unknown as AuthStore;
    const oidcFlow: OidcFlow = {
      async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
      async complete() { throw new Error('unused'); },
    };
    const signIn = createApp({ demoEnabled: false, oidcIssuer: 'https://idp.example.invalid/realms/hv', oidcFlow,
      authStore, authEvents: async () => [], clock: () => fixed,
      transparencyNotice: { version: 'v1', text: { de: 'Hinweis.', en: 'Notice.' } } });
    const res = await req(signIn, 'GET', '/auth/login');
    expect(res.status).toBe(302);
    expect(res.headers.get('X-Server-Time')).toBe(FIXED);
  });

  it('ignores a client Date header', async () => {
    const res = await call('/v1/meeting', { headers: { Date: 'Mon, 01 Jan 1990 00:00:00 GMT' } });
    expect(res.headers.get('X-Server-Time')).toBe(FIXED);
    const notFound = await call('/nope', { headers: { Date: 'Mon, 01 Jan 1990 00:00:00 GMT' } }, null);
    expect(notFound.headers.get('X-Server-Time')).toBe(FIXED);
  });

  it('exposes X-Server-Time to the Vite dev server in demo mode (032)', async () => {
    const res = await call('/v1/meeting', { headers: { Origin: 'http://localhost:5173' } });
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-Server-Time');
  });

  it('keeps one clock reading for header and body on /readyz', async () => {
    let reads = 0;
    const ticking = createApp({ demoEnabled: true, clock: () => new Date(fixed.getTime() + (reads++) * 1000),
      readiness: { clock: async () => ({ status: 'ok' }), db: async () => ({ status: 'ok' }),
        migrations: async () => ({ status: 'ok' }) } });
    const res = await req(ticking, 'GET', '/readyz');
    const body = await res.json() as { serverTime: string };
    expect(res.headers.get('X-Server-Time')).toBe(body.serverTime);
  });
});

describe('Scheibe 033a: GET /healthz (liveness)', () => {
  const app = createApp({ demoEnabled: true, clock: () => fixed });

  it('answers 200 {"status":"ok"} without any actor', async () => {
    const res = await req(app, 'GET', '/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    expect(res.headers.get('X-Server-Time')).toBe(FIXED);
  });

  it('answers 200 even with an invalid X-Actor header', async () => {
    const res = await req(app, 'GET', '/healthz', { actor: 'no-role-here' });
    expect(res.status).toBe(200);
  });

  it('is an exact-path exemption: neighbours still need an actor or do not exist', async () => {
    expect((await app.request('/healthz/')).status).toBe(401);
    expect((await app.request('/healthzx')).status).toBe(401);
    expect((await app.request('/v1/healthz', { headers: { 'X-Actor': ACTOR.admin } })).status).toBe(404);
    expect((await req(app, 'GET', '/v1/questions')).status).toBe(401);
  });

  it('does not depend on the database or NTP', async () => {
    const broken = createApp({ demoEnabled: false, clock: () => fixed,
      readiness: { clock: async () => { throw new Error('x'); }, db: async () => { throw new Error('x'); },
        migrations: async () => { throw new Error('x'); } } });
    const res = await broken.request('/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
