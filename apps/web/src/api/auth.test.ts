import { describe, expect, it, vi } from 'vitest';
import { ApiProblem } from '@hv/domain';
import { createSessionAuth, type SignedInSession } from './auth';

const session: SignedInSession = {
  scheme: 'session',
  actor: { id: 'subject-1', role: 'capture', displayName: 'Erfassung' },
  subjectId: 'subject-1',
  roles: ['capture'],
  csrfToken: 'a'.repeat(32),
  expiresAt: '2026-09-29T00:00:00.000Z',
};

describe('HTTP session auth', () => {
  it('reads the session at startup and holds the CSRF token in memory', async () => {
    const readSession = vi.fn(async () => session);
    const auth = createSessionAuth({ readSession, signOut: vi.fn(async () => undefined) });
    await auth.start();
    expect(readSession).toHaveBeenCalledOnce();
    expect(auth.getState()).toMatchObject({ kind: 'signedIn', actor: session.actor });
    expect(auth.getCsrfToken()).toBe(session.csrfToken);
  });

  it('handles a 401 once and allows a later login', async () => {
    const auth = createSessionAuth({ readSession: vi.fn(async () => session), signOut: vi.fn() });
    const listener = vi.fn();
    auth.subscribe(listener);
    await auth.start();
    auth.onUnauthorized();
    auth.onUnauthorized();
    expect(auth.getState().kind).toBe('signedOut');
    expect(auth.getCsrfToken()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    await auth.refresh();
    expect(auth.getState().kind).toBe('signedIn');
  });

  it('does not treat a failed logout request as completed', async () => {
    const signOut = vi.fn(async () => { throw new Error('offline'); });
    const auth = createSessionAuth({ readSession: vi.fn(async () => session), signOut });
    await auth.start();
    await expect(auth.logout()).rejects.toThrow();
    expect(auth.getState().kind).toBe('signedIn');
    expect(auth.getCsrfToken()).toBe(session.csrfToken);
    expect(signOut).toHaveBeenCalledWith(session.csrfToken);
  });

  it('clears the session only after a confirmed logout', async () => {
    const auth = createSessionAuth({ readSession: vi.fn(async () => session), signOut: vi.fn(async () => undefined) });
    await auth.start();
    await auth.logout();
    expect(auth.getState().kind).toBe('signedOut');
    expect(auth.getCsrfToken()).toBeUndefined();
  });

  it('rejects a demo-header identity and malformed CSRF data in HTTP mode', async () => {
    for (const payload of [
      { scheme: 'demoActor', actor: session.actor },
      { ...session, csrfToken: 'short' },
      { ...session, actor: { ...session.actor, role: undefined } },
    ]) {
      const auth = createSessionAuth({ readSession: vi.fn(async () => payload as SignedInSession), signOut: vi.fn() });
      await expect(auth.start()).rejects.toThrow();
      expect(auth.getState().kind).toBe('error');
      expect(auth.getCsrfToken()).toBeUndefined();
    }
  });

  it('ends the local session when logout receives 401', async () => {
    const auth = createSessionAuth({
      readSession: vi.fn(async () => session),
      signOut: vi.fn(async () => { throw new ApiProblem(401, 'Unauthorized', 'Expired'); }),
    });
    await auth.start();
    await expect(auth.logout()).rejects.toMatchObject({ status: 401 });
    expect(auth.getState().kind).toBe('signedOut');
    expect(auth.getCsrfToken()).toBeUndefined();
  });
});
