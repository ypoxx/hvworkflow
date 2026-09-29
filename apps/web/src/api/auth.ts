import { ApiProblem, type Actor } from '@hv/domain';
import type { components } from '../../../../packages/contract/src/types';

export type SignedInSession = components['schemas']['SignedInSession'];

export type AuthState =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; actor: Actor }
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

/** The browser retains only the active actor and CSRF token, never a provider credential. */
export function createSessionAuth(transport: SessionTransport) {
  let state: AuthState = { kind: 'checking' };
  let csrfToken: string | undefined;
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
      transport.onActorChange?.(session.actor);
      publish({ kind: 'signedIn', actor: session.actor });
    } catch (error) {
      if (requestRevision !== sessionRevision) return;
      if (error instanceof ApiProblem && error.status === 401) {
        onUnauthorized();
        return;
      }
      if (state.kind !== 'signedIn') publish({ kind: 'error' });
      throw error;
    }
  }

  async function logout(): Promise<void> {
    if (state.kind !== 'signedIn' || !csrfToken) return;
    try {
      await transport.signOut(csrfToken);
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
