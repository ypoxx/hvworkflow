import { describe, expect, it } from 'vitest';
import { createInMemoryEventStore, createInProcessApi, SYSTEM_ACTOR, type NewEvent } from '@hv/domain';
import { actorIdForIdentity, type OidcFlow } from '../auth/oidc.ts';
import type { AuthStore } from '../auth/store.ts';
import { createApp } from '../app.ts';
import { req } from './helpers.ts';

// Slice takt-029: negative sign-in tests (HTTP level), 503 on persistence faults, no idle extension
// for a session without an active role. Synthetic data only.
const start = new Date('2027-04-20T10:00:00.000Z');
const ISSUER_ONE = 'https://idp.example.invalid/realms/one';
const ISSUER_TWO = 'https://idp.example.invalid/realms/two';
const min = 60_000;

interface Options {
  issuer?: string;
  subject?: string;
  grantFor?: string[]; // actor ids that receive a moderation role
  blocked?: boolean;
  faults?: { events?: boolean; createSession?: boolean };
}

async function fixture(options: Options = {}) {
  const issuer = options.issuer ?? ISSUER_ONE;
  const subject = options.subject ?? 'synthetic-user';
  let now = start;
  const actorId = actorIdForIdentity(issuer, subject);
  const events = createInMemoryEventStore();
  const meeting: NewEvent[] = [{ id: 'm1', type: 'MeetingCreated', at: start.toISOString(), actor: SYSTEM_ACTOR,
    subjectId: 'hv-2027', meetingId: 'hv-2027', payload: { title: 'HV 2027', date: '2027-04-20', agendaItems: [], units: [] } }];
  events.append(meeting);
  let counter = 0;
  const domain = createInProcessApi({ store: events, actor: () => SYSTEM_ACTOR, meetingId: 'hv-2027',
    clock: () => start, idGenerator: () => `assignment-${++counter}` });
  for (const id of options.grantFor ?? [actorId]) await domain.assignRole({ subjectId: id, role: 'moderation' });
  const logins = new Map<string, { browserCorrelation: string; nonce: string; pkceVerifier: string; returnTo: string }>();
  const sessions = new Map<string, { actorId: string; csrfToken: string; idle: Date }>();
  const created: string[] = [];
  const authStore: AuthStore = {
    async createLoginState(input) { logins.set(input.state, input); },
    async consumeLoginState({ state, browserCorrelation }) {
      const found = logins.get(state);
      if (!found || found.browserCorrelation !== browserCorrelation) return null;
      logins.delete(state);
      return found;
    },
    async createSession(input) {
      if (options.faults?.createSession) throw new Error('connection terminated');
      if (options.blocked) throw new Error('Auth subject is blocked.');
      const token = 's'.repeat(43);
      const csrfToken = 'c'.repeat(43);
      sessions.set(token, { actorId: input.actorId, csrfToken, idle: new Date(input.now.getTime() + 30 * min) });
      created.push(token);
      return { token, csrfToken, expiresAt: new Date(input.now.getTime() + 14 * 60 * min),
        idleExpiresAt: new Date(input.now.getTime() + 30 * min) };
    },
    async readSession(token, at, slideIdle = true) {
      const found = sessions.get(token);
      if (!found || found.idle <= at) return null;
      if (slideIdle) found.idle = new Date(at.getTime() + 30 * min);
      return { actorId: found.actorId, csrfToken: found.csrfToken,
        expiresAt: new Date(start.getTime() + 14 * 60 * min), idleExpiresAt: found.idle };
    },
    async verifyCsrf(token, submitted) { return sessions.get(token)?.csrfToken === submitted; },
    async revokeSession(token) { return sessions.delete(token); },
    async blockSubject() {},
    async isSubjectBlocked() { return options.blocked === true; },
  };
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `${issuer}/authorize?state=${state}`; },
    async complete() { return { issuer, subject }; },
  };
  const app = createApp({ demoEnabled: false, oidcIssuer: issuer, oidcFlow, authStore,
    authEvents: async () => {
      if (options.faults?.events) throw new Error('connection terminated');
      return events.all();
    },
    clock: () => now, persistence: { load: () => [...events.all()], save: () => {} },
    transparencyNotice: { version: 'synthetic-1', text: { de: 'Testhinweis.', en: 'Test notice.' } } });
  return { app, domain, actorId, sessions, created, advance(ms: number) { now = new Date(now.getTime() + ms); } };
}

async function callback(app: ReturnType<typeof createApp>) {
  const login = await req(app, 'GET', '/auth/login');
  const state = new URL(login.headers.get('Location')!).searchParams.get('state');
  const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
  return req(app, 'GET', `/auth/callback?code=synthetic-code&state=${state}`, { headers: { Cookie: correlation } });
}
const sessionCookie = (response: Response) =>
  response.headers.getSetCookie().find((line) => line.startsWith('hv_session='));
const clearsCorrelation = (response: Response) => response.headers.getSetCookie().includes(
  'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax');

describe('takt-029 goal 1: sign-in refusals over HTTP', () => {
  it('(b) refuses a blocked subject: 403, no session, no cookie', async () => {
    const { app, created } = await fixture({ blocked: true });
    const response = await callback(app);
    expect(response.status).toBe(403);
    expect(sessionCookie(response)).toBeUndefined();
    expect(created).toHaveLength(0);
  });

  it('(c) refuses a subject without an active assignment: 403, no session', async () => {
    const { app, created } = await fixture({ grantFor: [] });
    const response = await callback(app);
    expect(response.status).toBe(403);
    expect(sessionCookie(response)).toBeUndefined();
    expect(created).toHaveLength(0);
  });

  it('(d) the same sub under two issuers is two actors and no role carries over', async () => {
    const one = await fixture({ issuer: ISSUER_ONE });
    const oneCookie = sessionCookie(await callback(one.app))!.split(';')[0]!;
    const oneMe = await (await req(one.app, 'GET', '/auth/me', { headers: { Cookie: oneCookie } })).json() as { subjectId: string };
    // Issuer two holds the grant of issuer one's actor only: the same subject gets nothing.
    const two = await fixture({ issuer: ISSUER_TWO, grantFor: [one.actorId] });
    const refused = await callback(two.app);
    expect(refused.status).toBe(403);
    expect(sessionCookie(refused)).toBeUndefined();
    // With its own grant issuer two signs in, under a different actor id.
    const own = await fixture({ issuer: ISSUER_TWO });
    const twoCookie = sessionCookie(await callback(own.app))!.split(';')[0]!;
    const twoMe = await (await req(own.app, 'GET', '/auth/me', { headers: { Cookie: twoCookie } })).json() as { subjectId: string };
    expect(oneMe.subjectId).toBe(one.actorId);
    expect(twoMe.subjectId).toBe(own.actorId);
    expect(twoMe.subjectId).not.toBe(oneMe.subjectId);
  });
});

describe('takt-029 goal 2: persistence faults in the callback answer 503', () => {
  it.each([['loading the auth events', { events: true }], ['writing the session', { createSession: true }]] as const)(
    'answers 503 without session when %s fails', async (_name, faults) => {
      const { app, created } = await fixture({ faults });
      const response = await callback(app);
      expect(response.status).toBe(503);
      expect(sessionCookie(response)).toBeUndefined();
      expect(clearsCorrelation(response)).toBe(true);
      expect(created).toHaveLength(0);
      expect(await response.json()).toMatchObject({ detail: 'Sign-in is unavailable.' });
    });
});

describe('takt-029 goal 3: a session without a role does not extend its idle window', () => {
  it('expires 30 minutes after its last useful use, however often /auth/me is asked', async () => {
    const { app, domain, advance } = await fixture();
    const cookie = sessionCookie(await callback(app))!.split(';')[0]!;
    await domain.revokeRole('assignment-1');
    advance(20 * min);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(403);
    advance(15 * min);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(401);
  });

  it('still extends the idle window for a session with a role', async () => {
    const { app, advance } = await fixture();
    const cookie = sessionCookie(await callback(app))!.split(';')[0]!;
    advance(20 * min);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(200);
    advance(20 * min);
    expect((await req(app, 'GET', '/auth/me', { headers: { Cookie: cookie } })).status).toBe(200);
  });
});
