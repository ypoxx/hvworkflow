/**
 * Scheibe 034b: CORS allowlist from configuration (T-G1-T-05, MF-11). Time comes from an injected clock.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../app.ts';
import type { AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { appOptionsOf } from '../config/appOptions.ts';
import { normalizeOrigin } from '../config/origins.ts';
import { readServiceConfig } from '../config/schema.ts';
import { ACTOR } from './helpers.ts';

const T0 = Date.parse('2027-04-20T10:00:15.000Z');
const ORIGIN = 'https://app.example';
const ACAO = 'Access-Control-Allow-Origin';
const LOG_DIR = mkdtempSync(join(tmpdir(), 'hv-cors034b-'));
afterAll(() => { rmSync(LOG_DIR, { recursive: true, force: true }); });
const LOG = { HV_ACCESS_LOG_DIR: LOG_DIR, HV_ACCESS_LOG_HASH_KEY: Buffer.alloc(32, 9).toString('base64') };

/** An app built from configuration variables, the way the process start builds it. */
function appFor(env: Record<string, string>, over: Parameters<typeof createApp>[0] = {}): App {
  const config = readServiceConfig({ ...LOG, ...env });
  return createApp({ ...appOptionsOf(config), clock: () => new Date(T0), sourceOf: () => 'source-a',
    persistence: { load: () => undefined, save: () => undefined }, ...over });
}
const service = (extra: Record<string, string> = {}): App => appFor({ HV_CORS_ORIGINS: ORIGIN, ...extra });
const accessControl = (res: Response): string[] => [...res.headers.keys()].filter((name) => name.startsWith('access-control-'));

describe('Scheibe 034b: origin normalisation', () => {
  it('lower-cases scheme and host and drops the default port', () => {
    expect(normalizeOrigin('HTTPS://App.Example:443')).toBe('https://app.example');
    expect(normalizeOrigin('http://LOCALHOST:80')).toBe('http://localhost');
    expect(normalizeOrigin('https://app.example:8443')).toBe('https://app.example:8443');
    expect(normalizeOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('refuses paths, queries, credentials, wildcards, null, other schemes and blanks', () => {
    for (const bad of ['https://app.example/', 'https://app.example/x', 'https://app.example?x=1', 'https://app.example#f',
      'https://user@app.example', 'https://*.example', '*', 'null', '', ' ', 'ftp://app.example', 'app.example',
      'https://app.example:99999', 'https://', 'https://app .example']) {
      expect(normalizeOrigin(bad), bad).toBeUndefined();
    }
  });

  it('applies the configuration rules: at most 10, https only outside demo, no blank entry', () => {
    const line = 'HV-Tool API: refusing to start: HV_CORS_ORIGINS must list at most 10 exact origins (scheme://host[:port], no wildcard, https only outside demo mode).';
    const errors = (env: Record<string, string>): string[] => {
      try { readServiceConfig({ ...LOG, ...env }); } catch (e) {
        return [...(e as { sentences: string[] }).sentences].filter((s) => s.includes('HV_CORS_ORIGINS'));
      }
      return [];
    };
    const many = (n: number) => Array.from({ length: n }, (_, i) => `https://a${i}.example`).join(',');
    for (const bad of ['*', 'null', 'https://app.example/x', 'https://*.example', 'http://app.example', many(11), `${ORIGIN},`, ',']) {
      expect(errors({ HV_CORS_ORIGINS: bad }), bad).toEqual([line]);
    }
    expect(errors({ HV_CORS_ORIGINS: many(10) })).toEqual([]);
    expect(errors({ HV_DEMO: '1', HV_CORS_ORIGINS: 'http://localhost:5174' })).toEqual([]);
    expect(readServiceConfig({ HV_DEMO: '1', HV_CORS_ORIGINS: 'http://localhost:5174, HTTP://Localhost:5175' }).corsOrigins)
      .toEqual(['http://localhost:5174', 'http://localhost:5175']);
    expect(readServiceConfig({ ...LOG, HV_CORS_ORIGINS: 'https://App.Example:443,https://app.example' }).corsOrigins).toEqual(['https://app.example']);
  });
});

describe('Scheibe 034b: CORS for a listed origin (T-G1-T-05)', () => {
  it('sets Allow-Origin to the origin and Allow-Credentials outside demo mode, on /v1 and /auth', async () => {
    const app = service();
    for (const path of ['/v1/meeting', '/auth/me']) {
      const res = await app.request(path, { headers: { Origin: ORIGIN } });
      expect(res.headers.get(ACAO), path).toBe(ORIGIN);
      expect(res.headers.get('Access-Control-Allow-Credentials'), path).toBe('true');
      expect(res.headers.get('Vary'), path).toContain('Origin');
      expect(res.headers.get('Access-Control-Expose-Headers'), path).toBe('ETag,X-Server-Time,Retry-After');
    }
  });

  it('answers a preflight with the fixed methods, headers (no X-Actor outside demo) and max age', async () => {
    const res = await service().request('/v1/speakers', { method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    expect(res.status).toBe(204);
    expect(res.headers.get(ACAO)).toBe(ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,PUT,PATCH,OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type,If-Match,Idempotency-Key,X-CSRF-Token');
    expect(res.headers.get('Access-Control-Allow-Headers')).not.toContain('X-Actor');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('600');
    const auth = await service().request('/auth/logout', { method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    expect(auth.headers.get(ACAO)).toBe(ORIGIN);
  });

  it('matches the origin exactly after normalisation: the listed default port counts as the origin', async () => {
    const app = service({ HV_CORS_ORIGINS: 'https://App.Example:443' });
    expect((await app.request('/v1/meeting', { headers: { Origin: ORIGIN } })).headers.get(ACAO)).toBe(ORIGIN);
    expect((await app.request('/v1/meeting', { headers: { Origin: 'https://app.example:8443' } })).headers.get(ACAO)).toBeNull();
  });
});

describe('Scheibe 034b: CORS refuses everything else (T-G1-T-05, MF-11)', () => {
  const foreign = ['https://evil.example', 'null', 'https://app.example/x', 'https://app.example:8443', 'http://app.example',
    'https://app.example.evil.example', 'https://sub.app.example', '*'];

  it('gives an unlisted origin no Access-Control header at all, also on a preflight', async () => {
    const app = service();
    for (const origin of foreign) {
      const get = await app.request('/v1/meeting', { headers: { Origin: origin } });
      expect(accessControl(get), origin).toEqual([]);
      const preflight = await app.request('/v1/speakers', { method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
      expect(accessControl(preflight), `preflight ${origin}`).toEqual([]);
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('Vary')).toContain('Origin');
    }
    expect(accessControl(await app.request('/v1/meeting'))).toEqual([]);
  });

  it('adds no CORS middleware when the variable is absent outside demo mode (same origin)', async () => {
    const app = appFor({});
    const res = await app.request('/v1/meeting', { headers: { Origin: ORIGIN } });
    expect(accessControl(res)).toEqual([]);
    const preflight = await app.request('/v1/speakers', { method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    expect(accessControl(preflight)).toEqual([]);
    expect(preflight.status).not.toBe(204);
  });
});

describe('Scheibe 034b: CORS in demo mode (T-G1-T-05)', () => {
  it('allows only http://localhost:5173 when the variable is absent, with X-Actor and without credentials', async () => {
    const app = appFor({ HV_DEMO: '1' });
    const res = await app.request('/v1/meeting', { headers: { Origin: 'http://localhost:5173', 'X-Actor': ACTOR.admin } });
    expect(res.headers.get(ACAO)).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect((await app.request('/v1/meeting', { headers: { Origin: 'http://localhost:5174' } })).headers.get(ACAO)).toBeNull();
    const preflight = await app.request('/v1/speakers', { method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' } });
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type,If-Match,Idempotency-Key,X-CSRF-Token,X-Actor');
    expect(preflight.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect(preflight.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
  });

  it('uses HV_CORS_ORIGINS in demo mode instead of the default', async () => {
    const app = appFor({ HV_DEMO: '1', HV_CORS_ORIGINS: 'http://localhost:5174' });
    expect((await app.request('/v1/meeting', { headers: { Origin: 'http://localhost:5174' } })).headers.get(ACAO)).toBe('http://localhost:5174');
    expect((await app.request('/v1/meeting', { headers: { Origin: 'http://localhost:5173' } })).headers.get(ACAO)).toBeNull();
  });
});

describe('Scheibe 034b: preflight counter and limit answers (034a point 1)', () => {
  it('counts preflights on their own counter: the anonymous limit stays untouched, the 11th preflight is 429 with CORS headers', async () => {
    const app = service({ HV_RATE_LIMIT_PREFLIGHT_PER_MIN: '10', HV_RATE_LIMIT_ANON_PER_MIN: '10' });
    const preflight = () => app.request('/v1/speakers', { method: 'OPTIONS',
      headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' } });
    for (let i = 0; i < 10; i += 1) expect((await preflight()).status).toBe(204);
    const limited = await preflight();
    expect(limited.status).toBe(429);
    expect(limited.headers.get(ACAO)).toBe(ORIGIN);
    expect(limited.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
    // Ten preflights did not use up the anonymous counter of ten.
    for (let i = 0; i < 10; i += 1) expect((await app.request('/v1/meeting', { headers: { Origin: ORIGIN } })).status).toBe(401);
    const anonymous = await app.request('/v1/meeting', { headers: { Origin: ORIGIN } });
    expect(anonymous.status).toBe(429);
    expect(anonymous.headers.get(ACAO)).toBe(ORIGIN);
  });

  it('carries the CORS headers of a listed origin on 413 and 429 answers, and none for a foreign origin', async () => {
    const app = service();
    const big = JSON.stringify({ speakerId: 's', text: 'a'.repeat(262_200) });
    const post = (origin: string) => app.request('/v1/contributions', { method: 'POST', body: big,
      headers: { 'Content-Type': 'application/json', Origin: origin, 'Content-Length': String(big.length) } });
    const tooLarge = await post(ORIGIN);
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.headers.get(ACAO)).toBe(ORIGIN);
    expect(accessControl(await post('https://evil.example'))).toEqual([]);
  });

  /** A sign-in that stalls: the provider answers late. Sign-in start is on `/auth/*`, inside the CORS scope. */
  function stalledSignIn(limits: { requestTimeoutMs: number; oidcTimeoutMs: number }): App {
    // The provider stalls on sign-in start (503 above the OIDC limit); the session store stalls on a read (408 on /v1;
    // the sign-in routes themselves are exempt from the request timeout, 034a).
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const flow: OidcFlow = { authorizationUrl: async () => { await sleep(400); return 'https://idp.example/authorize'; },
      complete: async () => ({ issuer: 'https://idp.example', subject: 'x' }) };
    const authStore = { createLoginState: async () => undefined,
      readSession: async () => { await sleep(400); return null; } } as unknown as AuthStore;
    return createApp({ demoEnabled: false, corsOrigins: [ORIGIN], clock: () => new Date(T0), sourceOf: () => 'source-a',
      oidcFlow: flow, authStore, authEvents: async () => [], limits,
      transparencyNotice: { version: 'v1', text: { de: 'Hinweis', en: 'Notice' } } });
  }

  it('carries the CORS headers of a listed origin on a 408 and on a 503, and none for a foreign origin', async () => {
    const timedOut = await stalledSignIn({ requestTimeoutMs: 50, oidcTimeoutMs: 2_000 })
      .request('/v1/meeting', { headers: { Origin: ORIGIN, Cookie: `hv_session=${'x'.repeat(43)}` } });
    expect(timedOut.status).toBe(408);
    expect(timedOut.headers.get(ACAO)).toBe(ORIGIN);
    expect(timedOut.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    const unavailable = await stalledSignIn({ requestTimeoutMs: 10_000, oidcTimeoutMs: 100 })
      .request('/auth/login', { headers: { Origin: ORIGIN } });
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get(ACAO)).toBe(ORIGIN);
    expect(accessControl(await stalledSignIn({ requestTimeoutMs: 10_000, oidcTimeoutMs: 100 })
      .request('/auth/login', { headers: { Origin: 'https://evil.example' } }))).toEqual([]);
  });
});
