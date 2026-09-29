import { ApiProblem, type Actor } from '@hv/domain';
import type { components } from '../../../../packages/contract/src/types';

export type SignedInSession = components['schemas']['SignedInSession'];

export type AuthState =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; actor: Actor }
  | { kind: 'noRole' }
  | { kind: 'error' };

export interface SessionTransport {
  readSession(): Promise<components['schemas']['Session']>;
  signOut(csrfToken: string): Promise<void>;
  onActorChange?(actor: Actor | undefined): void;
}

function hasConfirmedActor(value: unknown): value is Actor {
  if (!value || typeof value !== 'object') return false;
  const actor = value as Record<string, unknown>;
  return typeof actor['id'] === 'string' && actor['id'].trim() !== '' &&
    typeof actor['role'] === 'string' && actor['role'].trim() !== '';
}

/** Contract 0.3.8: the 403 of `/auth/me` carries the CSRF token that only sign-out may use. */
function noRoleToken(error: unknown): string | undefined {
  if (!(error instanceof ApiProblem) || error.status !== 403) return undefined;
  const token = (error as { csrfToken?: unknown }).csrfToken;
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,}$/.test(token) ? token : undefined;
}

/** The browser retains only the active actor and CSRF token, never a provider credential. */
export function createSessionAuth(transport: SessionTransport) {
  let state: AuthState = { kind: 'checking' };
  let csrfToken: string | undefined;
  /** Held in `noRole` only: usable for sign-out, invisible to business calls (`getCsrfToken`). */
  let logoutOnlyToken: string | undefined;
  let sessionRevision = 0;
  const listeners = new Set<() => void>();

  function publish(next: AuthState): void {
    state = next;
    for (const listener of listeners) listener();
  }

  function onUnauthorized(): void {
    sessionRevision += 1;
    if (state.kind === 'signedOut') return;
    csrfToken = undefined;
    logoutOnlyToken = undefined;
    transport.onActorChange?.(undefined);
    publish({ kind: 'signedOut' });
  }

  async function refresh(): Promise<void> {
    const requestRevision = sessionRevision;
    try {
      const session = await transport.readSession();
      if (requestRevision !== sessionRevision) return;
      if (session.scheme !== 'session' || !/^[A-Za-z0-9_-]{32,}$/.test(session.csrfToken) ||
        !hasConfirmedActor(session.actor) || !Array.isArray(session.roles) ||
        !session.roles.includes(session.actor.role)) {
        throw new Error('Invalid HTTP session response.');
      }
      csrfToken = session.csrfToken;
      logoutOnlyToken = undefined;
      transport.onActorChange?.(session.actor);
      publish({ kind: 'signedIn', actor: session.actor });
    } catch (error) {
      if (requestRevision !== sessionRevision) return;
      if (error instanceof ApiProblem && error.status === 401) {
        onUnauthorized();
        return;
      }
      const noRoleCsrf = noRoleToken(error);
      if (noRoleCsrf !== undefined) {
        // No actor any more; the token stays only so that `logout()` can send it.
        sessionRevision += 1;
        csrfToken = undefined;
        logoutOnlyToken = noRoleCsrf;
        transport.onActorChange?.(undefined);
        publish({ kind: 'noRole' });
        return;
      }
      if (state.kind !== 'signedIn' && state.kind !== 'noRole') publish({ kind: 'error' });
      throw error;
    }
  }

  async function logout(): Promise<void> {
    const token = state.kind === 'signedIn' ? csrfToken : state.kind === 'noRole' ? logoutOnlyToken : undefined;
    if (!token) return;
    try {
      await transport.signOut(token);
    } catch (error) {
      if (error instanceof ApiProblem && error.status === 401) onUnauthorized();
      throw error;
    }
    onUnauthorized();
  }

  return {
    getState: (): AuthState => state,
    getCsrfToken: (): string | undefined => csrfToken,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: refresh,
    refresh,
    logout,
    onUnauthorized,
  };
}

export type SessionAuth = ReturnType<typeof createSessionAuth>;
