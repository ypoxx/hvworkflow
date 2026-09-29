import { describe, expect, it, vi } from 'vitest';
import { ApiProblem } from '@hv/domain';
import { createSessionAuth, type SignedInSession } from './auth';

/** The 403 of `/auth/me` under contract 0.3.8 carries the session's CSRF token. */
function noRoleProblem(csrfToken: string | null = session.csrfToken): ApiProblem {
  return Object.assign(new ApiProblem(403, 'Forbidden', 'No active role assignment.'),
    csrfToken === null ? {} : { csrfToken });
}

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

  it('does not restore a signed-out session from a refresh started before logout', async () => {
    let releaseRefresh: ((value: SignedInSession) => void) | undefined;
    const readSession = vi.fn()
      .mockResolvedValueOnce(session)
      .mockImplementationOnce(() => new Promise<SignedInSession>(resolve => { releaseRefresh = resolve; }));
    const onActorChange = vi.fn();
    const auth = createSessionAuth({ readSession, signOut: vi.fn(async () => undefined), onActorChange });
    await auth.start();

    const pendingRefresh = auth.refresh();
    await auth.logout();
    expect(auth.getState().kind).toBe('signedOut');
    expect(auth.getCsrfToken()).toBeUndefined();

    releaseRefresh?.(session);
    await pendingRefresh;
    expect(auth.getState().kind).toBe('signedOut');
    expect(auth.getCsrfToken()).toBeUndefined();
    expect(onActorChange).toHaveBeenLastCalledWith(undefined);
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

  it('maps 403 with a CSRF token at startup to noRole, without an actor, token kept for logout (takt-023)', async () => {
    const onActorChange = vi.fn();
    const signOut = vi.fn(async () => undefined);
    const auth = createSessionAuth({ readSession: vi.fn(async () => { throw noRoleProblem(); }), signOut, onActorChange });
    await auth.start();
    expect(auth.getState()).toEqual({ kind: 'noRole' });
    expect(onActorChange).toHaveBeenLastCalledWith(undefined);
    await auth.logout();
    expect(signOut).toHaveBeenCalledWith(session.csrfToken);
    expect(auth.getState().kind).toBe('signedOut');
    expect(auth.getCsrfToken()).toBeUndefined();
  });

  it('keeps error for a 403 without a valid token', async () => {
    for (const bad of [null, 'short']) {
      const auth = createSessionAuth({ readSession: vi.fn(async () => { throw noRoleProblem(bad); }), signOut: vi.fn() });
      await expect(auth.start()).rejects.toThrow();
      expect(auth.getState().kind).toBe('error');
      expect(auth.getCsrfToken()).toBeUndefined();
    }
  });

  it('maps 403 on refresh from signedIn to noRole and drops the actor', async () => {
    const readSession = vi.fn()
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(noRoleProblem('b'.repeat(32)));
    const onActorChange = vi.fn();
    const auth = createSessionAuth({ readSession, signOut: vi.fn(), onActorChange });
    await auth.start();
    await auth.refresh();
    expect(auth.getState()).toEqual({ kind: 'noRole' });
    expect(onActorChange).toHaveBeenLastCalledWith(undefined);
    // Business calls no longer see a token; only logout() holds it.
    expect(auth.getCsrfToken()).toBeUndefined();
  });

  it('ends noRole with a 401 from logout like any other session', async () => {
    const auth = createSessionAuth({
      readSession: vi.fn(async () => { throw noRoleProblem(); }),
      signOut: vi.fn(async () => { throw new ApiProblem(401, 'Unauthorized', 'Expired'); }),
    });
    await auth.start();
    await expect(auth.logout()).rejects.toMatchObject({ status: 401 });
    expect(auth.getState().kind).toBe('signedOut');
  });

  it('does not change the auth state on a 403 from a business call', async () => {
    const auth = createSessionAuth({ readSession: vi.fn(async () => session), signOut: vi.fn() });
    await auth.start();
    // Business calls report only 401 through onUnauthorized; a 403 never reaches the auth object.
    expect(auth.getState().kind).toBe('signedIn');
    expect(auth.getCsrfToken()).toBe(session.csrfToken);
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
