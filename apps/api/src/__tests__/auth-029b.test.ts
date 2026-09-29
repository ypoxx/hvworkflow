import { createHash, createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actorIdForIdentity, createOidcFlow, safeReturnTo } from '../auth/oidc.ts';
import { sessionTokenFromCookie } from '../actor.ts';
import { createInMemoryEventStore, createInProcessApi, SYSTEM_ACTOR, type NewEvent } from '@hv/domain';
import type { AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { createApp } from '../app.ts';
import { req } from './helpers.ts';

describe('Scheibe 029b: OIDC identity boundary', () => {
  it('namespaces the pseudonymous actor by the validated issuer', () => {
    const first = actorIdForIdentity('https://idp.example.invalid/realms/one', 'synthetic-user');
    const second = actorIdForIdentity('https://idp.example.invalid/realms/two', 'synthetic-user');
    expect(first).toMatch(/^oidc_[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain('synthetic-user');
    expect(first).not.toBe(second);
    expect(first).toBe(actorIdForIdentity('https://idp.example.invalid/realms/one', 'synthetic-user'));
  });

  it('keeps only a relative application path after login', () => {
    expect(safeReturnTo('/v1/meeting')).toBe('/v1/meeting');
    for (const candidate of ['https://evil.invalid/', '//evil.invalid/', '/\\evil.invalid/', 'javascript:alert(1)', 'meeting']) {
      expect(safeReturnTo(candidate)).toBe('/');
    }
  });

  it('rejects a return path longer than the contract limit', () => {
    expect(() => safeReturnTo(`/${'a'.repeat(512)}`)).toThrow();
  });
});

describe('Scheibe 029b: cookie trust boundary', () => {
  const token = 'a'.repeat(43);
  it('accepts exactly one correctly shaped session cookie', () => {
    expect(sessionTokenFromCookie(`other=x; hv_session=${token}`)).toBe(token);
    expect(sessionTokenFromCookie(`hv_session=${token}; hv_session=${'b'.repeat(43)}`)).toBeNull();
    expect(sessionTokenFromCookie('hv_session=short')).toBeNull();
  });
});

describe('Scheibe 029b: OIDC configuration boundary', () => {
  const base = {
    clientId: 'hv-beta', clientSecret: 'synthetic-secret',
    redirectUri: 'https://hv.example.invalid/auth/callback',
  };

  it('rejects unencrypted non-local issuers before discovery', () => {
    expect(typeof createOidcFlow).toBe('function');
    expect(() => createOidcFlow({ ...base, issuer: 'http://idp.example.invalid/realms/hv' })).toThrow(/issuer/i);
  });

  it('rejects a callback URI outside the local service origin', () => {
    expect(typeof createOidcFlow).toBe('function');
    expect(() => createOidcFlow({ ...base, issuer: 'https://idp.example.invalid/realms/hv',
      redirectUri: 'https://elsewhere.invalid/auth/callback', serviceOrigin: 'https://hv.example.invalid' })).toThrow(/redirect/i);
  });

  it('refuses a fully configured OIDC service without Postgres', () => {
    expect(() => createApp({ demoEnabled: false, oidcIssuer: 'https://idp.example.invalid/realms/hv',
      oidcClientId: base.clientId, oidcClientSecret: base.clientSecret, oidcRedirectUri: base.redirectUri,
      authKey: Buffer.alloc(32, 7) })).toThrow(/Postgres/);
  });
});

describe('Scheibe 029b: optional DSFA notice link', () => {
  const notice = { version: 'synthetic-1', text: { de: 'Testhinweis.', en: 'Test notice.' } };

  it.each(['not a URI', '/relative', 'javascript:alert(1)'])(
    'omits an unsafe or malformed optional link: %s', async (dataProtectionSummaryUrl) => {
      const app = createApp({ demoEnabled: false,
        transparencyNotice: { ...notice, dataProtectionSummaryUrl } });
      const response = await req(app, 'GET', '/auth/transparency-notice');
      expect(response.status).toBe(200);
      expect(await response.json()).not.toHaveProperty('dataProtectionSummaryUrl');
    },
  );

  it('retains a valid HTTPS summary link', async () => {
    const dataProtectionSummaryUrl = 'https://example.test/dsfa-summary';
    const app = createApp({ demoEnabled: false,
      transparencyNotice: { ...notice, dataProtectionSummaryUrl } });
    const response = await req(app, 'GET', '/auth/transparency-notice');
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty('dataProtectionSummaryUrl', dataProtectionSummaryUrl);
  });
});

const at = new Date('2027-04-20T10:00:00.000Z');

async function authFixture(withNotice = true, providerRefreshToken?: string) {
  const actorId = actorIdForIdentity('https://idp.example.invalid/realms/hv', 'synthetic-user');
  const events = createInMemoryEventStore();
  const meeting: NewEvent[] = [{ id: 'm1', type: 'MeetingCreated', at: at.toISOString(), actor: SYSTEM_ACTOR,
    subjectId: 'hv-2027', meetingId: 'hv-2027', payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] } }];
  events.append(meeting);
  const domain = createInProcessApi({ store: events, actor: () => SYSTEM_ACTOR, meetingId: 'hv-2027',
    clock: () => at, idGenerator: () => 'assignment-1' });
  await domain.assignRole({ subjectId: actorId, role: 'moderation' });
  const logins = new Map<string, { browserCorrelation: string; nonce: string; pkceVerifier: string; returnTo: string }>();
  const sessions = new Map<string, { actorId: string; csrfToken: string }>();
  let retainedRefreshToken: string | undefined;
  const authStore: AuthStore = {
    async createLoginState(input) { logins.set(input.state, input); },
    async consumeLoginState({ state, browserCorrelation }) {
      const found = logins.get(state);
      if (!found || found.browserCorrelation !== browserCorrelation) return null;
      logins.delete(state);
      return found;
    },
    async createSession(input) {
      retainedRefreshToken = input.refreshToken;
      const token = 's'.repeat(43);
      const csrfToken = 'c'.repeat(43);
      sessions.set(token, { actorId: input.actorId, csrfToken });
      return { token, csrfToken, expiresAt: new Date(at.getTime() + 14 * 60 * 60_000),
        idleExpiresAt: new Date(at.getTime() + 30 * 60_000) };
    },
    async readSession(token) {
      const session = sessions.get(token);
      return session ? { ...session, expiresAt: new Date(at.getTime() + 14 * 60 * 60_000),
        idleExpiresAt: new Date(at.getTime() + 30 * 60_000) } : null;
    },
    async verifyCsrf(token, submitted) { return sessions.get(token)?.csrfToken === submitted; },
    async revokeSession(token) { return sessions.delete(token); },
    async blockSubject() {},
    async isSubjectBlocked() { return false; },
  };
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
    async complete() { return { issuer: 'https://idp.example.invalid/realms/hv', subject: 'synthetic-user',
      ...(providerRefreshToken === undefined ? {} : { refreshToken: providerRefreshToken }) }; },
  };
  const app = createApp({ demoEnabled: false, oidcIssuer: 'https://idp.example.invalid/realms/hv',
    oidcFlow, authStore, authEvents: async () => events.all(), clock: () => at,
    persistence: { load: () => [...events.all()], save: () => {} },
    ...(withNotice ? { transparencyNotice: { version: 'synthetic-1',
      text: { de: 'Ungeprüfter Testhinweis.', en: 'Unreviewed test notice.' } } } : {}) });
  return { app, events, actorId, domain, retainedRefreshToken: () => retainedRefreshToken };
}

async function signIn(app: ReturnType<typeof createApp>): Promise<string> {
  const login = await req(app, 'GET', '/auth/login');
  const state = new URL(login.headers.get('Location')!).searchParams.get('state');
  const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
  const callback = await req(app, 'GET', `/auth/callback?code=synthetic-code&state=${state}`,
    { headers: { Cookie: correlation } });
  return callback.headers.getSetCookie().find((line) => line.startsWith('hv_session='))!.split(';')[0]!;
}

describe('Scheibe 029b: browser-bound sign-in', () => {
  it('discards an unused IdP refresh token instead of retaining a credential after logout', async () => {
    const { app, retainedRefreshToken } = await authFixture(true, 'synthetic-secret-refresh');
    await signIn(app);
    expect(retainedRefreshToken()).toBeUndefined();
  });

  it('does not start sign-in before a readable DE/EN transparency notice is configured', async () => {
    const { app } = await authFixture(false);
    expect((await req(app, 'GET', '/auth/transparency-notice')).status).toBe(404);
    expect((await req(app, 'GET', '/auth/login')).status).toBe(503);
  });

  it('rejects a callback from another browser and allows the initiating browser only once', async () => {
    const { app } = await authFixture();
    const incomplete = await req(app, 'GET', '/auth/callback');
    expect(incomplete.status).toBe(400);
    const login = await req(app, 'GET', '/auth/login?returnTo=%2Fv1%2Fmeeting');
    expect(login.status).toBe(302);
    const state = new URL(login.headers.get('Location')!).searchParams.get('state');
    const cookie = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
    const callback = `/auth/callback?code=synthetic-code&state=${state}`;
    const rejected = await req(app, 'GET', callback);
    expect(rejected.status).toBe(400);
    expect(rejected.headers.getSetCookie()).toContain(
      'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax');
    const success = await req(app, 'GET', callback, { headers: { Cookie: cookie } });
    expect(success.status).toBe(302);
    expect(success.headers.get('Location')).toBe('/v1/meeting');
    expect(success.headers.getSetCookie()).toHaveLength(2);
    expect((await req(app, 'GET', callback, { headers: { Cookie: cookie } })).status).toBe(400);
  });

  it('derives the actor from current grants on /auth/me and ignores X-Actor', async () => {
    const { app, actorId } = await authFixture();
    const sessionCookie = await signIn(app);
    const me = await req(app, 'GET', '/auth/me',
      { headers: { Cookie: sessionCookie, 'X-Actor': 'attacker:admin' } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ scheme: 'session', subjectId: actorId,
      actor: { id: actorId, role: 'moderation' }, roles: ['moderation'] });
  });

  it('serves the two-language notice and requires CSRF before a workflow mutation', async () => {
    const { app, events } = await authFixture();
    const notice = await req(app, 'GET', '/auth/transparency-notice');
    expect(notice.status).toBe(200);
    expect(await notice.json()).toMatchObject({ text: { de: expect.any(String), en: expect.any(String) } });
    const cookie = await signIn(app);
    const before = events.lastSeq();
    const rejected = await req(app, 'POST', '/v1/speakers',
      { headers: { Cookie: cookie }, body: { displayName: 'Nur synthetisch' } });
    expect(rejected.status).toBe(403);
    expect(await rejected.json()).toMatchObject({ ruleId: 'R-AUTH-01' });
    expect(events.lastSeq()).toBe(before);
  });

  it('revokes a signed-in role on the next request and logs out only once', async () => {
    const { app, domain } = await authFixture();
    const cookie = await signIn(app);
    const me = await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } });
    const csrfToken = (await me.json() as { csrfToken: string }).csrfToken;
    expect((await req(app, 'POST', '/auth/logout', { headers: { Cookie: cookie } })).status).toBe(422);
    expect((await req(app, 'POST', '/auth/logout', { headers: { Cookie: cookie, 'X-CSRF-Token': 'wrong' } })).status).toBe(403);
    const logout = await req(app, 'POST', '/auth/logout', { headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken } });
    expect(logout.status).toBe(204);
    expect(logout.headers.getSetCookie()).toHaveLength(1);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(401);

    const otherCookie = await signIn(app);
    await domain.revokeRole('assignment-1');
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: otherCookie } })).status).toBe(403);
  });

  it('lets a session without any active role learn of it and log out, while everything else stays refused (takt-023)', async () => {
    const { app, domain } = await authFixture();
    const cookie = await signIn(app);
    await domain.revokeRole('assignment-1');
    const me = await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(403);
    expect(me.headers.get('Cache-Control')).toBe('no-store');
    expect(me.headers.get('Content-Type')).toContain('application/problem+json');
    const csrfToken = (await me.json() as { csrfToken: string }).csrfToken;
    expect(csrfToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    // The role resolution still refuses every business call of this session.
    expect((await req(app, 'GET', '/v1/meeting', { headers: { Cookie: cookie } })).status).toBe(403);
    expect((await req(app, 'POST', '/v1/speakers',
      { headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken }, body: { displayName: 'Nur synthetisch' } })).status).toBe(403);
    expect((await req(app, 'POST', '/auth/logout', { headers: { Cookie: cookie } })).status).toBe(422);
    expect((await req(app, 'POST', '/auth/logout', { headers: { Cookie: cookie, 'X-CSRF-Token': 'wrong' } })).status).toBe(403);
    expect((await req(app, 'POST', '/auth/logout', { headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken } })).status).toBe(204);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it('gives /auth/me and /auth/logout no exemption without a valid session (takt-023)', async () => {
    const { app } = await authFixture();
    expect((await req(app, 'GET', '/auth/me')).status).toBe(401);
    expect((await req(app, 'POST', '/auth/logout', { headers: { 'X-CSRF-Token': 'c'.repeat(43) } })).status).toBe(401);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: `hv_session=${'x'.repeat(43)}` } })).status).toBe(401);
  });
});

type TokenFault = 'none' | 'signature' | 'issuer' | 'audience' | 'expired' | 'nonce' | 'alg-none' | 'alg-hs256';

/** A local synthetic provider exercises discovery, JWKS and the actual code/PKCE exchange. */
async function startSyntheticProvider() {
  const signing = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rogue = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const secret = randomBytes(32).toString('base64url');
  const subject = `synthetic-${randomBytes(8).toString('hex')}`;
  const clientId = `hv-beta-${randomBytes(8).toString('hex')}`;
  const codes = new Map<string, { challenge: string; nonce: string; redirectUri: string; fault: TokenFault }>();
  let issuer = '';
  let fault: TokenFault = 'none';
  const json = (response: import('node:http').ServerResponse, status: number, value: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', issuer);
      if (url.pathname === '/.well-known/openid-configuration') {
        json(response, 200, { issuer, authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
          response_types_supported: ['code'], subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_post'],
          code_challenge_methods_supported: ['S256'] });
        return;
      }
      if (url.pathname === '/jwks') {
        json(response, 200, { keys: [{ ...signing.publicKey.export({ format: 'jwk' }),
          kid: 'runtime-key', use: 'sig', alg: 'RS256' }] });
        return;
      }
      if (url.pathname === '/authorize') {
        const code = randomBytes(24).toString('base64url');
        codes.set(code, { challenge: url.searchParams.get('code_challenge') ?? '',
          nonce: url.searchParams.get('nonce') ?? '', redirectUri: url.searchParams.get('redirect_uri') ?? '', fault });
        const location = new URL(url.searchParams.get('redirect_uri')!);
        location.searchParams.set('code', code);
        location.searchParams.set('state', url.searchParams.get('state') ?? '');
        response.writeHead(302, { Location: location.href });
        response.end();
        return;
      }
      if (url.pathname === '/token' && request.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));
        const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
        const code = form.get('code') ?? '';
        const issued = codes.get(code);
        codes.delete(code);
        const challenge = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
        if (!issued || form.get('client_id') !== clientId || form.get('client_secret') !== secret ||
            form.get('redirect_uri') !== issued.redirectUri || challenge !== issued.challenge) {
          json(response, 400, { error: 'invalid_grant' });
          return;
        }
        const now = Math.floor(Date.now() / 1000);
        const claims = { iss: issued.fault === 'issuer' ? `${issuer}/other` : issuer,
          aud: issued.fault === 'audience' ? 'another-client' : clientId, sub: subject,
          iat: now, exp: issued.fault === 'expired' ? now - 60 : now + 300,
          nonce: issued.fault === 'nonce' ? 'another-nonce' : issued.nonce };
        const alg = issued.fault === 'alg-none' ? 'none' : issued.fault === 'alg-hs256' ? 'HS256' : 'RS256';
        const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT', kid: 'runtime-key' })).toString('base64url');
        const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
        const signed = `${header}.${body}`;
        // takt-029: `none` carries no signature; HS256 is keyed with the client secret (algorithm confusion).
        const signature = alg === 'none' ? '' : alg === 'HS256'
          ? createHmac('sha256', secret).update(signed).digest('base64url')
          : sign('RSA-SHA256', Buffer.from(signed),
            issued.fault === 'signature' ? rogue.privateKey : signing.privateKey).toString('base64url');
        json(response, 200, { access_token: randomBytes(24).toString('base64url'), token_type: 'Bearer',
          expires_in: 300, id_token: `${signed}.${signature}` });
        return;
      }
      json(response, 404, { error: 'not_found' });
    } catch {
      json(response, 500, { error: 'synthetic_provider_failure' });
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    issuer, subject, clientId, secret,
    setFault(value: TokenFault) { fault = value; },
    async callback(flow: OidcFlow, state: string, nonce: string, verifier: string): Promise<URL> {
      const authorization = await flow.authorizationUrl({ state, nonce, pkceVerifier: verifier });
      const request = new URL(authorization);
      expect(request.searchParams.get('code_challenge_method')).toBe('S256');
      expect(request.searchParams.get('state')).toBe(state);
      expect(request.searchParams.get('nonce')).toBe(nonce);
      const response = await fetch(authorization, { redirect: 'manual' });
      expect(response.status).toBe(302);
      return new URL(response.headers.get('Location')!);
    },
    async close() { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); },
  };
}

describe('Scheibe 029b: real OIDC code flow against a synthetic local provider', () => {
  let provider: Awaited<ReturnType<typeof startSyntheticProvider>>;
  const state = () => randomBytes(32).toString('base64url');
  const nonce = () => randomBytes(32).toString('base64url');
  const verifier = () => randomBytes(32).toString('base64url');
  const flow = () => createOidcFlow({ issuer: provider.issuer, clientId: provider.clientId,
    clientSecret: provider.secret, redirectUri: `${provider.issuer}/auth/callback` });

  beforeAll(async () => { provider = await startSyntheticProvider(); });
  afterAll(async () => { await provider?.close(); });

  it('discovers the issuer and verifies a signed authorization code with S256 PKCE', async () => {
    provider.setFault('none');
    const current = flow();
    const values = { state: state(), nonce: nonce(), pkceVerifier: verifier() };
    const callback = await provider.callback(current, values.state, values.nonce, values.pkceVerifier);
    expect(await current.complete({ search: callback.search, ...values }))
      .toMatchObject({ issuer: provider.issuer, subject: provider.subject });
    await expect(current.complete({ search: callback.search, ...values })).rejects.toThrow();
  });

  it.each(['signature', 'issuer', 'audience', 'expired', 'nonce', 'alg-none', 'alg-hs256'] as const)(
    'rejects an ID token with invalid %s', async (fault) => {
      provider.setFault(fault);
      const current = flow();
      const values = { state: state(), nonce: nonce(), pkceVerifier: verifier() };
      const callback = await provider.callback(current, values.state, values.nonce, values.pkceVerifier);
      await expect(current.complete({ search: callback.search, ...values })).rejects.toThrow();
    },
  );

  it('rejects a mismatched callback state before issuing a session', async () => {
    provider.setFault('none');
    const current = flow();
    const values = { state: state(), nonce: nonce(), pkceVerifier: verifier() };
    const callback = await provider.callback(current, values.state, values.nonce, values.pkceVerifier);
    await expect(current.complete({ search: callback.search, ...values, state: state() })).rejects.toThrow();
  });

  it('rejects a wrong PKCE verifier and an unknown authorization code', async () => {
    provider.setFault('none');
    const current = flow();
    const values = { state: state(), nonce: nonce(), pkceVerifier: verifier() };
    const callback = await provider.callback(current, values.state, values.nonce, values.pkceVerifier);
    await expect(current.complete({ search: callback.search, ...values, pkceVerifier: verifier() })).rejects.toThrow();
    const unknown = new URL(callback.href);
    unknown.searchParams.set('code', state());
    await expect(current.complete({ search: unknown.search, ...values })).rejects.toThrow();
  });
});
