import type { Pool, QueryResult, QueryResultRow } from 'pg';
import { DEFAULT_QUERY_TIMEOUT_MS, mustDiscardConnection, pooledQuery, timedQuery } from '../persistence/postgres.ts';
import { equalSecret, LOGIN_LIFETIME_MS, opaqueToken, protect, reveal,
  SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, tokenHash } from './sessions.ts';

export interface AuthStore {
  createLoginState(input: { state: string; browserCorrelation: string; nonce: string;
    pkceVerifier: string; returnTo: string; now: Date }): Promise<void>;
  consumeLoginState(input: { state: string; browserCorrelation: string; now: Date }):
    Promise<{ nonce: string; pkceVerifier: string; returnTo: string } | null>;
  createSession(input: { actorId: string; refreshToken?: string; now: Date }):
    Promise<{ token: string; csrfToken: string; expiresAt: Date; idleExpiresAt: Date }>;
  readSession(token: string, now: Date, slideIdle?: boolean): Promise<{ actorId: string; csrfToken: string;
    refreshToken?: string; expiresAt: Date; idleExpiresAt: Date } | null>;
  verifyCsrf(token: string, submitted: string, now: Date): Promise<boolean>;
  revokeSession(token: string): Promise<boolean>;
  blockSubject(actorId: string, now: Date): Promise<void>;
  isSubjectBlocked(actorId: string): Promise<boolean>;
}

interface LoginRow { secret_cipher: Buffer; return_to: string }
interface SessionRow {
  actor_id: string; csrf_cipher: Buffer; refresh_cipher: Buffer | null;
  expires_at: Date; idle_expires_at: Date;
}

export interface AuthStoreOptions {
  /** Per-query timer in ms (slice 034a); tests lower it, the service uses the default of 6 000 ms. */
  queryTimeoutMs?: number;
}

const PURGE_FAILED = 'HV-Tool API: login state purge failed.';

/**
 * No session or login secret is stored in clear; every query is durable across service processes and runs
 * under the service's own query timer (slice 034a), so a hung connection ends in an error, not a wait.
 */
export function createAuthStore(pool: Pool, encryptionKey: Buffer, options: AuthStoreOptions = {}): AuthStore {
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) {
    throw new Error('A 32-byte auth encryption key is required.');
  }
  const key = Buffer.from(encryptionKey);
  const timeoutMs = options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  const query = <R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> =>
    pooledQuery<R>(pool, timeoutMs, text, values);
  let lastPurgeFailureMinute: number | undefined;
  return {
    async createLoginState({ state, browserCorrelation, nonce, pkceVerifier, returnTo, now }) {
      const expiresAt = new Date(now.getTime() + LOGIN_LIFETIME_MS);
      const cipher = protect(JSON.stringify({ nonce, pkceVerifier }), key);
      // Best-effort clean-up before the insert (slice 034a): the runtime role may only call this bounded
      // function (no DELETE right). A failure must not block sign-in; stderr gets one fixed line a minute.
      try {
        await query('SELECT auth_purge_login_states($1::timestamptz)', [now]);
      } catch {
        const minute = Math.floor(now.getTime() / 60_000);
        if (lastPurgeFailureMinute !== minute) {
          lastPurgeFailureMinute = minute;
          console.error(PURGE_FAILED);
        }
      }
      await query(
        `INSERT INTO auth_login_states
          (state_hash, browser_hash, secret_cipher, return_to, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tokenHash(state), tokenHash(browserCorrelation), cipher, returnTo, now, expiresAt],
      );
    },
    async consumeLoginState({ state, browserCorrelation, now }) {
      // A foreign browser never consumes the valid browser's one-time state.
      const result = await query<LoginRow>(
        `UPDATE auth_login_states SET consumed_at = $3
         WHERE state_hash = $1 AND browser_hash = $2 AND consumed_at IS NULL AND expires_at > $3
         RETURNING secret_cipher, return_to`,
        [tokenHash(state), tokenHash(browserCorrelation), now],
      );
      const row = result.rows[0];
      if (!row) return null;
      let value: unknown;
      try { value = JSON.parse(reveal(row.secret_cipher, key)); } catch { throw new Error('Protected auth value is invalid.'); }
      if (!value || typeof value !== 'object' || !('nonce' in value) || !('pkceVerifier' in value) ||
          typeof value.nonce !== 'string' || typeof value.pkceVerifier !== 'string') {
        throw new Error('Protected auth value is invalid.');
      }
      return { nonce: value.nonce, pkceVerifier: value.pkceVerifier, returnTo: row.return_to };
    },
    async createSession({ actorId, refreshToken, now }) {
      const token = opaqueToken();
      const csrfToken = opaqueToken();
      const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
      const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
      const result = await query(
        `INSERT INTO auth_sessions
          (session_hash, actor_id, csrf_cipher, refresh_cipher, created_at, expires_at, idle_expires_at)
         SELECT $1, $2, $3, $4, $5, $6, $7
         WHERE NOT EXISTS (SELECT 1 FROM auth_subject_blocks WHERE actor_id = $2)
         RETURNING session_hash`,
        [tokenHash(token), actorId, protect(csrfToken, key),
          refreshToken === undefined ? null : protect(refreshToken, key), now, expiresAt, idleExpiresAt],
      );
      if (result.rowCount !== 1) throw new Error('Auth subject is blocked.');
      return { token, csrfToken, expiresAt, idleExpiresAt };
    },
    async readSession(token, now, slideIdle = true) {
      const current = `s.session_hash = $1 AND s.revoked_at IS NULL
           AND s.expires_at > $2 AND s.idle_expires_at > $2
           AND NOT EXISTS (SELECT 1 FROM auth_subject_blocks AS b WHERE b.actor_id = s.actor_id)`;
      const result = await query<SessionRow>(
        slideIdle ? `UPDATE auth_sessions AS s
         SET idle_expires_at = LEAST(s.expires_at, $2::timestamptz + INTERVAL '30 minutes')
         WHERE ${current}
         RETURNING s.actor_id, s.csrf_cipher, s.refresh_cipher, s.expires_at, s.idle_expires_at`
          : `SELECT s.actor_id, s.csrf_cipher, s.refresh_cipher, s.expires_at, s.idle_expires_at
             FROM auth_sessions AS s WHERE ${current}`,
        [tokenHash(token), now],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { actorId: row.actor_id, csrfToken: reveal(row.csrf_cipher, key),
        ...(row.refresh_cipher === null ? {} : { refreshToken: reveal(row.refresh_cipher, key) }),
        expiresAt: row.expires_at, idleExpiresAt: row.idle_expires_at };
    },
    async verifyCsrf(token, submitted, now) {
      if (!submitted) return false;
      const result = await query<Pick<SessionRow, 'csrf_cipher'>>(
        `SELECT s.csrf_cipher FROM auth_sessions AS s
         WHERE s.session_hash = $1 AND s.revoked_at IS NULL
           AND s.expires_at > $2 AND s.idle_expires_at > $2
           AND NOT EXISTS (SELECT 1 FROM auth_subject_blocks AS b WHERE b.actor_id = s.actor_id)`,
        [tokenHash(token), now],
      );
      const row = result.rows[0];
      return row !== undefined && equalSecret(reveal(row.csrf_cipher, key), submitted);
    },
    async revokeSession(token) {
      const client = await pool.connect();
      let discard: Error | undefined;
      try {
        await timedQuery(client, timeoutMs, 'BEGIN');
        const hash = tokenHash(token);
        const result = await timedQuery(client, timeoutMs,
          `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP
           WHERE session_hash = $1 AND revoked_at IS NULL RETURNING session_hash`, [hash],
        );
        if (result.rowCount === 1) {
          await timedQuery(client, timeoutMs, 'INSERT INTO auth_logout_ids (session_hash) VALUES ($1) ON CONFLICT DO NOTHING', [hash]);
        }
        await timedQuery(client, timeoutMs, 'COMMIT');
        return result.rowCount === 1;
      } catch (error) {
        // A hung connection must not queue a ROLLBACK behind the hanging statement: it dies with the connection.
        // `/auth/logout` is exempt from the request timeout, so the ROLLBACK itself runs under the query timer and a
        // failed or hanging ROLLBACK discards the connection (Codex P1 on #75).
        if (mustDiscardConnection(error)) discard = error as Error;
        else {
          await timedQuery(client, timeoutMs, 'ROLLBACK').catch((rollbackError: unknown) => {
            discard = rollbackError instanceof Error ? rollbackError : new Error('ROLLBACK failed.');
          });
        }
        throw error;
      } finally {
        client.release(discard);
      }
    },
    async blockSubject(actorId, now) {
      await query(
        'INSERT INTO auth_subject_blocks (actor_id, blocked_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [actorId, now],
      );
    },
    async isSubjectBlocked(actorId) {
      const result = await query('SELECT 1 FROM auth_subject_blocks WHERE actor_id = $1', [actorId]);
      return result.rowCount !== 0;
    },
  };
}
