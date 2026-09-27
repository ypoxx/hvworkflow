/**
 * The HTTP surface of the HV-Tool: every path of `packages/contract/openapi.yaml` under `/v1`,
 * implemented over `createInProcessApi` from `@hv/domain` (AGENTS.md rule 6 — the contract comes
 * first, the interface uses `HvApi`, and here the server is just another `HvApi` caller reached
 * over HTTP). No business logic lives in this file: every handler maps a request to one `HvApi`
 * call and maps the result (or the `ApiProblem` it throws) back to a response. `validateOperation`
 * (see `validate.ts`) checks every request against the contract's own schemas first, so a
 * wrongly-typed or contract-violating request never reaches the domain (rework review blockers 1/2).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import {
  ApiProblem,
  createInMemoryEventStore,
  createInProcessApi,
  etagOf,
  seedEvents,
  systemClock,
  SYSTEM_ACTOR,
  type Actor,
  type DomainEvent,
  type AnswerDraft,
  type Classification,
  type ContributionCapture,
  type HvApi,
  type LegalClearanceRequest,
  type MeetingContributionCapture,
  type Persistence,
  type Question,
  type QuestionCapture,
  type QuestionFilter,
  type QuestionStatus,
  type Role,
  type RoleAssignmentCreate,
  type Speaker,
  type SpeakerRegistration,
  type SpeakerUpdate,
  type Track,
} from '@hv/domain';
import { parseActorHeader, selectAuthAdapter, sessionActorFromEvents, sessionTokenFromCookie } from './actor.ts';
import { actorIdForIdentity, createOidcFlow, safeReturnTo, type OidcFlow } from './auth/oidc.ts';
import { createAuthStore, type AuthStore } from './auth/store.ts';
import { createFileEventLog } from './eventLog.ts';
import { requireParam, writeOptions } from './http.ts';
import { problemResponse } from './problem.ts';
import { getMigrationStatus } from './persistence/migrations.ts';
import { assertRuntimePrivileges, insertPostgresEvents, loadPostgresSnapshot, PostgresIntegrityError } from './persistence/postgres.ts';
import { getValidatedBody, getValidatedQuery, validateOperation, type Variables } from './validate.ts';

export interface CreateAppOptions {
  /** Defaults to `process.env.HV_DEMO === '1'` — kept overridable so tests need not touch env vars. */
  demoEnabled?: boolean;
  /**
   * Defaults to `process.env.HV_OIDC_ISSUER` (slice 029a). Set together with demo mode, `createApp`
   * throws: the demo header must never be accepted where real sign-ins exist (ADR 0004).
   */
  oidcIssuer?: string;
  /** Synthetic test provider; production uses a discovered openid-client configuration. */
  oidcFlow?: OidcFlow;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcRedirectUri?: string;
  /** 32-byte AES-GCM key. Required whenever the production OIDC adapter is enabled. */
  authKey?: Buffer;
  /** Test-only store/event ports; the running service uses Postgres. */
  authStore?: AuthStore;
  authEvents?: () => Promise<readonly DomainEvent[]>;
  transparencyNotice?: { version: string; text: { de: string; en: string }; dataProtectionSummaryUrl?: string };
  /** Defaults to `process.env.HV_EVENT_LOG`. Append-only JSON-lines file (AGENTS.md rule 7). */
  eventLogPath?: string;
  /** Overrides `eventLogPath` — lets tests inject an in-memory `Persistence` without touching disk. */
  persistence?: Persistence;
  clock?: () => Date;
  idGenerator?: () => string;
  /**
   * Seed the synthetic demo corpus once at startup when demo mode is on and the store is still
   * empty (rework review major 5 — makes `pnpm --filter @hv/api dev` reproducible on its own). Off
   * by default so constructing an app for a test never has this side effect; `server.ts` turns it on.
   */
  seedOnStart?: boolean;
  /**
   * Actor the demo auto-seed (`seedOnStart`) runs as. Falls back to `HV_SEED_ACTOR` (env var, same
   * `"<id>:<role>"` format as the `X-Actor` header) and finally to the synthetic system actor
   * `packages/domain/src/seed.ts` defines. Never a role-name literal here — the only places a `Role`
   * may appear as a string are `ROLE_PERMISSIONS`, the seed corpus and the demo role switcher
   * (AGENTS.md rule 4; `scripts/role-literal-check.mjs`, slice 012).
   */
  seedActor?: Actor;
  /** Transactional Postgres source of truth for the service; JSONL remains the dev adapter. */
  postgres?: Pool;
  /** Slice 027: readiness probes are injected so the server can check real DB/migration state. */
  readiness?: {
    clock: () => Promise<ReadinessCheck>;
    db: () => Promise<ReadinessCheck>;
    migrations: () => Promise<ReadinessCheck>;
  };
}

type ReadinessCheck =
  | { status: 'ok' }
  | { status: 'fail'; code: 'not_configured' | 'unreachable' | 'timeout' | 'migrations_pending' | 'clock_unsynced' | 'clock_drift' };

/** The concrete app type (with its `Variables`), so tests can type `let app: App` without repeating it. */
export type App = Hono<{ Variables: Variables }>;

interface PostgresRequest {
  store: ReturnType<typeof createInMemoryEventStore>;
  domain: HvApi;
  scoped: Map<string, HvApi>;
  persons: ReadonlyMap<string, readonly { personId: string; displayName: string; organisation?: string }[]>;
}

/**
 * `HV_SEED_ACTOR` shares `parseActorHeader`'s `"<id>:<role>"` format, but its errors must say so —
 * review rework round 1, minor 9: a malformed value used to be reported as a problem with "the
 * X-Actor header", which is confusing outside an HTTP request. This is startup-time configuration
 * (`seedOnStart`), not a request, so it throws a plain `Error`, not the HTTP-shaped `ApiProblem`.
 */
function parseSeedActorEnv(raw: string): Actor {
  try {
    return parseActorHeader(raw);
  } catch (err) {
    const detail = err instanceof ApiProblem ? err.detail.replaceAll('X-Actor header', 'HV_SEED_ACTOR') : String(err);
    throw new Error(`Invalid HV_SEED_ACTOR: ${detail}`);
  }
}

function browserCorrelation(header: string | undefined): string | null {
  const values = header?.split(';').map((part) => part.trim())
    .filter((part) => part.startsWith('hv_auth_state=')) ?? [];
  if (values.length !== 1) return null;
  const value = values[0]!.slice('hv_auth_state='.length);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function createApp(options: CreateAppOptions = {}): App {
  const demoEnabled = options.demoEnabled ?? process.env['HV_DEMO'] === '1';
  const oidcIssuer = options.oidcIssuer ?? process.env['HV_OIDC_ISSUER'];
  const authKeyRaw = process.env['HV_AUTH_ENCRYPTION_KEY'];
  const authKey = options.authKey ?? (authKeyRaw ? Buffer.from(authKeyRaw, 'base64url') : undefined);
  const clock = options.clock ?? systemClock;
  const authStore = options.authStore ?? (options.postgres && authKey
    ? createAuthStore(options.postgres, authKey) : undefined);
  const clientId = options.oidcClientId ?? process.env['HV_OIDC_CLIENT_ID'];
  const clientSecret = options.oidcClientSecret ?? process.env['HV_OIDC_CLIENT_SECRET'];
  const redirectUri = options.oidcRedirectUri ?? process.env['HV_OIDC_REDIRECT_URI'];
  if (!demoEnabled && oidcIssuer?.trim() && clientId && clientSecret && redirectUri && authKey &&
      !options.postgres && !options.authStore) {
    throw new Error('OIDC sign-in requires Postgres persistence.');
  }
  const oidcFlow = options.oidcFlow ?? (oidcIssuer?.trim() && clientId && clientSecret && redirectUri
    ? createOidcFlow({ issuer: oidcIssuer, clientId, clientSecret, redirectUri, clock }) : undefined);
  const authEvents = options.authEvents ?? (options.postgres ? async (): Promise<readonly DomainEvent[]> => {
    const client = await options.postgres!.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshot = await loadPostgresSnapshot(client);
      await client.query('COMMIT');
      return snapshot.events;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Connection is discarded by the pool. */ }
      throw error;
    } finally {
      client.release();
    }
  } : undefined);
  const sessionReady = !demoEnabled && authStore !== undefined && oidcFlow !== undefined && authEvents !== undefined;
  const authenticate = selectAuthAdapter({
    demoEnabled,
    oidcIssuer,
    ...(sessionReady ? { sessionCookie: async (readHeader) => {
      const token = sessionTokenFromCookie(readHeader('Cookie'));
      if (!token) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
      const session = await authStore.readSession(token, clock(), false);
      if (!session) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
      return sessionActorFromEvents(await authEvents(), session.actorId, clock()).actor;
    } } : {}),
  });
  const eventLogPath = options.eventLogPath ?? process.env['HV_EVENT_LOG'];
  const persistence = options.persistence ?? (eventLogPath !== undefined ? createFileEventLog(eventLogPath) : undefined);
  if (options.postgres && persistence) throw new Error('Configure only one service persistence source.');
  const store = createInMemoryEventStore(persistence);
  const actorStorage = new AsyncLocalStorage<Actor>();
  const requestStorage = new AsyncLocalStorage<PostgresRequest>();

  const currentActor = (): Actor => {
    const actor = actorStorage.getStore();
    if (!actor) throw new ApiProblem(401, 'Unauthorized', 'The X-Actor header is required.');
    return actor;
  };

  const memoryDomain: HvApi = createInProcessApi({
    store,
    actor: currentActor,
    ...(options.clock !== undefined ? { clock: options.clock } : {}),
    ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
    seeder: seedEvents,
  });
  const domain: HvApi = new Proxy(memoryDomain, {
    get(target, property, receiver) {
      return Reflect.get(requestStorage.getStore()?.domain ?? target, property, receiver);
    },
  });

  // A scoped projection is shared across requests for the same meeting. It follows the global
  // event log but applies only that meeting's events; the actor still comes from this request.
  const scopedDomains = new Map<string, HvApi>();
  const meetingDomain = async (meetingId: string): Promise<HvApi> => {
    const request = requestStorage.getStore();
    if (request) {
      let scoped = request.scoped.get(meetingId);
      if (!scoped) {
        await request.domain.getMeetingById(meetingId);
        scoped = createInProcessApi({
          store: request.store, meetingId, actor: currentActor,
          personSnapshots: request.persons,
          ...(options.clock !== undefined ? { clock: options.clock } : {}),
          ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
        });
        request.scoped.set(meetingId, scoped);
      }
      return scoped;
    }
    let scoped = scopedDomains.get(meetingId);
    if (!scoped) {
      await domain.getMeetingById(meetingId);
      scoped = createInProcessApi({
        store, meetingId,
        actor: currentActor,
        ...(options.clock !== undefined ? { clock: options.clock } : {}),
        ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
      });
      scopedDomains.set(meetingId, scoped);
    }
    return scoped;
  };

  if (options.seedOnStart && demoEnabled && options.postgres === undefined && store.lastSeq() === 0) {
    // `seedDemo` (packages/domain) does no real async I/O (AGENTS.md: "no framework, no I/O"), so the
    // store is already populated by the time this synchronous function returns even though the
    // promise below is not awaited here; `actorStorage.run` supplies the actor `seedDemo` needs
    // outside of any HTTP request.
    const seedActor: Actor =
      options.seedActor ??
      (process.env['HV_SEED_ACTOR'] !== undefined ? parseSeedActorEnv(process.env['HV_SEED_ACTOR']) : undefined) ??
      SYSTEM_ACTOR;
    actorStorage.run(seedActor, () => {
      domain
        .seedDemo({})
        .then((meeting) => {
          // eslint-disable-next-line no-console
          console.log(`HV-Tool API: demo mode — seeded ${meeting.counts.questions} sample questions.`);
        })
        .catch((err: unknown) => {
          console.error('HV-Tool API: demo auto-seed failed:', err);
        });
    });
  }

  const app = new Hono<{ Variables: Variables }>();

  // ---- CORS (dev only) -------------------------------------------------------------------------
  // The contract is same-origin (openapi.yaml: `servers: /v1`); this exists only so the Vite dev
  // server (apps/web, default port 5173) can reach a demo-mode server across origins.
  if (demoEnabled) {
    app.use(
      '/v1/*',
      cors({
        origin: 'http://localhost:5173',
        allowHeaders: ['X-Actor', 'If-Match', 'Idempotency-Key', 'Content-Type'],
        exposeHeaders: ['ETag'],
      }),
    );
  }

  // ---- actor + errors -------------------------------------------------------------------------
  app.use('*', async (c, next) => {
    if (c.req.path === '/readyz' || c.req.path === '/auth/login' ||
        c.req.path === '/auth/callback' || c.req.path === '/auth/transparency-notice') {
      await next();
      return;
    }
    // The adapter decides whether any header is read at all (slice 029a: without demo, none is).
    const actor = await authenticate((name) => c.req.header(name));
    if (sessionReady) {
      const token = sessionTokenFromCookie(c.req.header('Cookie'))!;
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
      const csrfRequired = (mutation && c.req.path.startsWith('/v1/')) || c.req.path === '/auth/logout';
      if (csrfRequired) {
        const csrf = c.req.header('X-CSRF-Token');
        if (c.req.path === '/auth/logout' && !csrf) {
          throw new ApiProblem(422, 'Unprocessable', 'X-CSRF-Token is required.', 'R-AUTH-01');
        }
        if (!csrf || !await authStore!.verifyCsrf(token, csrf, clock())) {
          throw new ApiProblem(403, 'Forbidden', 'CSRF token is invalid.', 'R-AUTH-01');
        }
      }
      // Re-read only after CSRF validation; a rejected write cannot extend its idle window.
      if (!await authStore!.readSession(token, clock())) {
        throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
      }
    }
    await actorStorage.run(actor, () => next());
  });
  app.use('/v1/*', async (c, next) => {
    const pool = options.postgres;
    if (!pool) {
      await next();
      return;
    }
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method);
    let client: PoolClient | undefined;
    let started = false;
    try {
      if ((await getMigrationStatus(pool)).pending) {
        return problemResponse(new ApiProblem(503, 'Service Unavailable', 'Migrations are pending.'));
      }
      await assertRuntimePrivileges(pool);
      client = await pool.connect();
      await client.query(write ? 'BEGIN ISOLATION LEVEL READ COMMITTED' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      started = true;
      if (write) await client.query('SELECT pg_advisory_xact_lock($1, $2)', [27027, 1]);
      const snapshot = await loadPostgresSnapshot(client);
      let pendingEvents = snapshot.events.slice(snapshot.events.length);
      const requestStore = createInMemoryEventStore({
        load: () => snapshot.events,
        save: (all) => { pendingEvents = all.slice(snapshot.events.length); },
      });
      const persons = new Map<string, { personId: string; displayName: string; organisation?: string }[]>();
      for (const row of snapshot.persons) {
        const list = persons.get(row.meetingId) ?? [];
        list.push({ personId: row.personId, displayName: row.displayName,
          ...(row.organisation !== undefined ? { organisation: row.organisation } : {}) });
        persons.set(row.meetingId, list);
      }
      const activeDomain = createInProcessApi({
        store: requestStore, actor: currentActor, personSnapshots: persons,
        ...(options.clock !== undefined ? { clock: options.clock } : {}),
        ...(options.idGenerator !== undefined ? { idGenerator: options.idGenerator } : {}),
        seeder: seedEvents,
      });
      await requestStorage.run({ store: requestStore, domain: activeDomain, scoped: new Map(), persons }, () => next());
      if (c.res.status >= 400) {
        await client.query('ROLLBACK');
      } else {
        if (pendingEvents.length > 0) await insertPostgresEvents(client, pendingEvents);
        await client.query('COMMIT');
      }
      started = false;
    } catch (error) {
      if (started && client) {
        try { await client.query('ROLLBACK'); } catch { /* Failed transaction is discarded with the connection. */ }
      }
      const detail = error instanceof PostgresIntegrityError
        ? `Event seq ${error.seq}: integrity check failed.` : 'Persistence is unavailable.';
      // A handler may already have finalized a success response before persistence failed.
      // Hono ignores a returned middleware response at that point, so replace it explicitly.
      c.res = problemResponse(new ApiProblem(500, 'Internal Server Error', detail));
      return;
    } finally {
      client?.release();
    }
  });
  app.onError((err, c) => {
    const response = problemResponse(err);
    if (c.req.path.startsWith('/auth/')) {
      response.headers.set('X-Server-Time', clock().toISOString());
      response.headers.set('Cache-Control', 'no-store');
      if (c.req.path === '/auth/callback') {
        response.headers.append('Set-Cookie',
          'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax');
      }
    }
    return response;
  });
  app.notFound(() => problemResponse(new ApiProblem(404, 'Not found', 'No such route.')));

  app.get('/readyz', async (c) => {
    const serverTime = (options.clock ?? systemClock)().toISOString();
    const defaultChecks = {
      clock: async (): Promise<ReadinessCheck> => ({ status: 'fail', code: 'not_configured' }),
      db: async (): Promise<ReadinessCheck> => {
        if (options.postgres) {
          await assertRuntimePrivileges(options.postgres, false);
          await options.postgres.query('SELECT 1');
          return { status: 'ok' };
        }
        if (eventLogPath) {
          try {
            await access(eventLogPath, constants.R_OK | constants.W_OK);
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              await access(dirname(eventLogPath), constants.R_OK | constants.W_OK);
            } else {
              throw error;
            }
          }
          return { status: 'ok' };
        }
        return persistence ? { status: 'ok' } : { status: 'fail', code: 'not_configured' };
      },
      migrations: async (): Promise<ReadinessCheck> => {
        if (options.postgres) {
          return (await getMigrationStatus(options.postgres)).pending
            ? { status: 'fail', code: 'migrations_pending' } : { status: 'ok' };
        }
        return persistence ? { status: 'ok' } : { status: 'fail', code: 'not_configured' };
      },
    };
    const probes = options.readiness ?? defaultChecks;
    const safeCheck = async (run: () => Promise<ReadinessCheck>, failureCode: 'timeout' | 'unreachable'): Promise<ReadinessCheck> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          run(),
          new Promise<ReadinessCheck>((resolve) => {
            timer = setTimeout(() => resolve({ status: 'fail', code: 'timeout' }), 2_000);
          }),
        ]);
      } catch {
        // Driver failures may contain credentials, SQL and host names. Do not pass the error on.
        return { status: 'fail', code: failureCode };
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const checks = {
      clock: await safeCheck(probes.clock, 'timeout'),
      db: await safeCheck(probes.db, 'unreachable'),
      migrations: await safeCheck(probes.migrations, 'unreachable'),
    };
    const ready = Object.values(checks).every((check) => check.status === 'ok');
    c.header('X-Server-Time', serverTime);
    return c.json({ status: ready ? 'ready' : 'not_ready', checks, serverTime }, ready ? 200 : 503);
  });

  // ---- browser sign-in -----------------------------------------------------------------------
  const authResponseHeaders = (c: Context): void => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Server-Time', clock().toISOString());
  };
  app.get('/auth/login', validateOperation('login'), async (c) => {
    if (!sessionReady) throw new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    const returnTo = safeReturnTo(c.req.query('returnTo'));
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const pkceVerifier = randomBytes(32).toString('base64url');
    const correlation = randomBytes(32).toString('base64url');
    let location: string;
    try {
      location = await oidcFlow!.authorizationUrl({ state, nonce, pkceVerifier });
      await authStore!.createLoginState({ state, browserCorrelation: correlation, nonce, pkceVerifier,
        returnTo, now: clock() });
    } catch {
      throw new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    }
    authResponseHeaders(c);
    const response = c.redirect(location, 302);
    response.headers.append('Set-Cookie',
      `hv_auth_state=${correlation}; Max-Age=300; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax`);
    return response;
  });

  app.get('/auth/callback', validateOperation('completeLogin'), async (c) => {
    if (!sessionReady) throw new ApiProblem(503, 'Service Unavailable', 'Sign-in is unavailable.');
    const params = new URL(c.req.url).searchParams;
    const codes = params.getAll('code');
    const states = params.getAll('state');
    const correlation = browserCorrelation(c.req.header('Cookie'));
    if (codes.length !== 1 || states.length !== 1 || !codes[0] || codes[0].length > 2048 ||
        !states[0] || !/^[A-Za-z0-9_-]{43}$/.test(states[0]) || !correlation || params.has('error')) {
      throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    }
    const pending = await authStore!.consumeLoginState({ state: states[0],
      browserCorrelation: correlation, now: clock() });
    if (!pending) throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    let identity: Awaited<ReturnType<OidcFlow['complete']>>;
    try {
      identity = await oidcFlow!.complete({ search: params.toString(), state: states[0],
        nonce: pending.nonce, pkceVerifier: pending.pkceVerifier });
    } catch {
      throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    }
    if (identity.issuer !== oidcIssuer) throw new ApiProblem(400, 'Bad Request', 'Invalid sign-in response.');
    const actorId = actorIdForIdentity(identity.issuer, identity.subject);
    if (await authStore!.isSubjectBlocked(actorId)) {
      throw new ApiProblem(403, 'Forbidden', 'Sign-in is unavailable for this subject.');
    }
    sessionActorFromEvents(await authEvents!(), actorId, clock());
    let session: Awaited<ReturnType<AuthStore['createSession']>>;
    try {
      session = await authStore!.createSession({ actorId, now: clock(),
        ...(identity.refreshToken !== undefined ? { refreshToken: identity.refreshToken } : {}) });
    } catch {
      throw new ApiProblem(403, 'Forbidden', 'Sign-in is unavailable for this subject.');
    }
    authResponseHeaders(c);
    const response = c.redirect(pending.returnTo, 302);
    response.headers.append('Set-Cookie',
      `hv_session=${session.token}; Max-Age=50400; Path=/; HttpOnly; Secure; SameSite=Lax`);
    response.headers.append('Set-Cookie',
      'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax');
    return response;
  });

  app.get('/auth/me', validateOperation('getSession'), async (c) => {
    authResponseHeaders(c);
    const actor = currentActor();
    if (demoEnabled) return c.json({ scheme: 'demoActor', actor: { id: actor.id, role: actor.role },
      subjectId: actor.id, roles: [actor.role] });
    const token = sessionTokenFromCookie(c.req.header('Cookie'));
    const session = token && await authStore!.readSession(token, clock(), false);
    if (!session) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    const resolved = sessionActorFromEvents(await authEvents!(), session.actorId, clock());
    return c.json({ scheme: 'session', actor: { id: resolved.actor.id, role: resolved.actor.role },
      subjectId: session.actorId, roles: resolved.roles,
      ...(resolved.actor.personId !== undefined ? { personId: resolved.actor.personId } : {}),
      expiresAt: session.expiresAt.toISOString(), csrfToken: session.csrfToken });
  });

  app.post('/auth/logout', validateOperation('logout'), async (c) => {
    if (!sessionReady) throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    const token = sessionTokenFromCookie(c.req.header('Cookie'));
    if (!token || !await authStore!.revokeSession(token)) {
      throw new ApiProblem(401, 'Unauthorized', 'A valid session is required.');
    }
    authResponseHeaders(c);
    const response = c.body(null, 204);
    response.headers.append('Set-Cookie', 'hv_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
    return response;
  });

  app.get('/auth/transparency-notice', validateOperation('getTransparencyNotice'), async (c) => {
    const version = process.env['HV_TRANSPARENCY_NOTICE_VERSION'];
    const de = process.env['HV_TRANSPARENCY_NOTICE_DE'];
    const en = process.env['HV_TRANSPARENCY_NOTICE_EN'];
    const configured = options.transparencyNotice ?? (version && de && en
      ? { version, text: { de, en },
        ...(process.env['HV_DSFA_SUMMARY_URL'] ? { dataProtectionSummaryUrl: process.env['HV_DSFA_SUMMARY_URL'] } : {}) }
      : undefined);
    if (!configured) throw new ApiProblem(404, 'Not found', 'Transparency notice is unavailable.');
    c.header('X-Server-Time', clock().toISOString());
    return c.json(configured);
  });

  const etag = (c: Context, resource: { version: number }): void => {
    c.header('ETag', etagOf(resource.version));
  };
  // A replay returns the original commit's list tag; a GET uses today's projected list tag.
  const speakerListEtag = async (c: Context, scoped: HvApi, afterWrite = false): Promise<void> => {
    const committedTag = afterWrite ? scoped.lastWriteEtag() : undefined;
    if (committedTag !== undefined) {
      c.header('ETag', committedTag);
      return;
    }
    const meeting = await scoped.getMeeting();
    etag(c, { version: meeting.speakerListVersion });
  };
  const questionFilter = (query: Record<string, unknown>): QuestionFilter => ({
    ...((query['status'] as QuestionStatus[] | undefined)?.length ? { status: query['status'] as QuestionStatus[] } : {}),
    ...(query['track'] !== undefined ? { track: query['track'] as Track } : {}),
    ...(query['unitId'] !== undefined ? { unitId: query['unitId'] as string } : {}),
    ...(query['speakerId'] !== undefined ? { speakerId: query['speakerId'] as string } : {}),
    ...(query['contributionId'] !== undefined ? { contributionId: query['contributionId'] as string } : {}),
    ...(query['agendaItemId'] !== undefined ? { agendaItemId: query['agendaItemId'] as string } : {}),
    ...(query['q'] !== undefined ? { q: query['q'] as string } : {}),
    ...(query['limit'] !== undefined ? { limit: query['limit'] as number } : {}),
    ...(query['offset'] !== undefined ? { offset: query['offset'] as number } : {}),
  });

  // ---- meeting ----------------------------------------------------------------------------------
  app.get('/v1/meetings', validateOperation('listMeetings'), async (c) => {
    const status = getValidatedQuery(c)['status'] as Awaited<ReturnType<HvApi['getMeeting']>>['status'] | undefined;
    return c.json(await domain.listMeetings(status));
  });
  app.get('/v1/meetings/:meetingId', validateOperation('getMeetingById'), async (c) => {
    const meeting = await domain.getMeetingById(requireParam(c, 'meetingId'));
    etag(c, { version: meeting.version ?? 1 });
    return c.json(meeting);
  });
  app.get('/v1/meetings/:meetingId/agenda-items', validateOperation('listMeetingAgendaItems'), async (c) =>
    c.json(await domain.listMeetingAgendaItems(requireParam(c, 'meetingId'))));
  app.get('/v1/meetings/:meetingId/units', validateOperation('listMeetingUnits'), async (c) =>
    c.json(await domain.listMeetingUnits(requireParam(c, 'meetingId'))));
  const agendaResult = async (c: Context, action: 'openAgendaItem' | 'openVoting' | 'closeVoting'): Promise<Response> => {
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const item = await scoped[action](requireParam(c, 'agendaItemId'), writeOptions(c));
    const meeting = await scoped.getMeeting();
    etag(c, { version: meeting.version ?? 1 });
    return c.json(item);
  };
  app.post('/v1/meetings/:meetingId/agenda-items/:agendaItemId/opening', validateOperation('openAgendaItem'),
    (c) => agendaResult(c, 'openAgendaItem'));
  app.post('/v1/meetings/:meetingId/agenda-items/:agendaItemId/voting/opening', validateOperation('openVoting'),
    (c) => agendaResult(c, 'openVoting'));
  app.post('/v1/meetings/:meetingId/agenda-items/:agendaItemId/voting/closure', validateOperation('closeVoting'),
    (c) => agendaResult(c, 'closeVoting'));

  app.get('/v1/meetings/:meetingId/role-assignments', validateOperation('listRoleAssignments'), async (c) => {
    const query = getValidatedQuery(c);
    return c.json(await (await meetingDomain(requireParam(c, 'meetingId'))).listRoleAssignments({
      ...(query['subjectId'] !== undefined ? { subjectId: query['subjectId'] as string } : {}),
      ...(query['role'] !== undefined ? { role: query['role'] as Role } : {}),
    }));
  });
  app.post('/v1/meetings/:meetingId/role-assignments', validateOperation('assignRole'), async (c) => {
    const assignment = await (await meetingDomain(requireParam(c, 'meetingId')))
      .assignRole(getValidatedBody<RoleAssignmentCreate>(c), writeOptions(c));
    return c.json(assignment, 201);
  });
  app.post('/v1/meetings/:meetingId/role-assignments/:assignmentId/revocation',
    validateOperation('revokeRole'), async (c) => {
      const body = getValidatedBody<{ reason?: string } | undefined>(c);
      const assignment = await (await meetingDomain(requireParam(c, 'meetingId')))
        .revokeRole(requireParam(c, 'assignmentId'), body?.reason, writeOptions(c));
      return c.json(assignment);
    });

  app.get('/v1/meetings/:meetingId/speakers', validateOperation('listMeetingSpeakers'), async (c) => {
    const query = getValidatedQuery(c);
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const speakers = await scoped.listSpeakers({
      ...(query['round'] !== undefined ? { round: query['round'] as number } : {}),
      ...(query['status'] !== undefined ? { status: query['status'] as Speaker['status'] } : {}),
    });
    await speakerListEtag(c, scoped);
    return c.json(speakers);
  });
  app.post('/v1/meetings/:meetingId/speakers', validateOperation('registerMeetingSpeaker'), async (c) => {
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const speaker = await scoped.registerSpeaker(getValidatedBody<SpeakerRegistration>(c), writeOptions(c));
    await speakerListEtag(c, scoped, true);
    return c.json(speaker, 201);
  });
  app.put('/v1/meetings/:meetingId/speakers/order', validateOperation('reorderMeetingSpeakers'), async (c) => {
    const body = getValidatedBody<{ round: number; speakerIds: string[] }>(c);
    const scoped = await meetingDomain(requireParam(c, 'meetingId'));
    const speakers = await scoped.reorderSpeakers(body.round, body.speakerIds, writeOptions(c));
    await speakerListEtag(c, scoped, true);
    return c.json(speakers);
  });
  app.get('/v1/meetings/:meetingId/contributions', validateOperation('listMeetingContributions'), async (c) => {
    const speakerId = getValidatedQuery(c)['speakerId'] as string | undefined;
    return c.json(await (await meetingDomain(requireParam(c, 'meetingId')))
      .listContributions(speakerId !== undefined ? { speakerId } : {}));
  });
  app.post('/v1/meetings/:meetingId/contributions', validateOperation('captureMeetingContribution'), async (c) => {
    const contribution = await (await meetingDomain(requireParam(c, 'meetingId')))
      .captureMeetingContribution(getValidatedBody<MeetingContributionCapture>(c), writeOptions(c));
    etag(c, contribution);
    return c.json(contribution, 201);
  });
  app.get('/v1/meetings/:meetingId/questions', validateOperation('listMeetingQuestions'), async (c) => {
    return c.json(await (await meetingDomain(requireParam(c, 'meetingId')))
      .listQuestions(questionFilter(getValidatedQuery(c))));
  });
  app.get('/v1/meetings/:meetingId/stage', validateOperation('getMeetingStage'), async (c) =>
    c.json(await (await meetingDomain(requireParam(c, 'meetingId'))).getStage()));

  app.get('/v1/meeting', async (c) => c.json(await domain.getMeeting()));
  app.get('/v1/agenda-items', async (c) => c.json(await domain.listAgendaItems()));
  app.get('/v1/units', async (c) => c.json(await domain.listUnits()));

  // ---- speakers -----------------------------------------------------------------------------------
  app.get('/v1/speakers', validateOperation('listSpeakers'), async (c) => {
    const query = getValidatedQuery(c);
    const round = query['round'] as number | undefined;
    const status = query['status'] as Speaker['status'] | undefined;
    const filter = {
      ...(round !== undefined ? { round } : {}),
      ...(status !== undefined ? { status } : {}),
    };
    const speakers = await domain.listSpeakers(filter);
    await speakerListEtag(c, domain);
    return c.json(speakers);
  });
  app.post('/v1/speakers', validateOperation('registerSpeaker'), async (c) => {
    const body = getValidatedBody<SpeakerRegistration>(c);
    const speaker = await domain.registerSpeaker(body, writeOptions(c));
    await speakerListEtag(c, domain, true);
    return c.json(speaker, 201);
  });
  app.put('/v1/speakers/order', validateOperation('reorderSpeakers'), async (c) => {
    const body = getValidatedBody<{ round: number; speakerIds: string[] }>(c);
    const speakers = await domain.reorderSpeakers(body.round, body.speakerIds, writeOptions(c));
    await speakerListEtag(c, domain, true);
    return c.json(speakers);
  });
  app.get('/v1/speakers/:speakerId', validateOperation('getSpeaker'), async (c) => {
    const speaker = await domain.getSpeaker(requireParam(c, 'speakerId'));
    etag(c, speaker);
    return c.json(speaker);
  });
  app.patch('/v1/speakers/:speakerId', validateOperation('updateSpeaker'), async (c) => {
    const body = getValidatedBody<SpeakerUpdate>(c);
    const speaker = await domain.updateSpeaker(requireParam(c, 'speakerId'), body, writeOptions(c));
    etag(c, speaker);
    return c.json(speaker);
  });

  // ---- contributions --------------------------------------------------------------------------
  app.get('/v1/contributions', validateOperation('listContributions'), async (c) => {
    const speakerId = getValidatedQuery(c)['speakerId'] as string | undefined;
    return c.json(await domain.listContributions(speakerId !== undefined ? { speakerId } : {}));
  });
  app.post('/v1/contributions', validateOperation('captureContribution'), async (c) => {
    const body = getValidatedBody<ContributionCapture>(c);
    const contribution = await domain.captureContribution(body, writeOptions(c));
    etag(c, contribution);
    return c.json(contribution, 201);
  });
  app.get('/v1/contributions/:contributionId', validateOperation('getContribution'), async (c) => {
    const contribution = await domain.getContribution(requireParam(c, 'contributionId'));
    etag(c, contribution);
    return c.json(contribution);
  });
  app.post('/v1/contributions/:contributionId/questions', validateOperation('captureQuestions'), async (c) => {
    const body = getValidatedBody<{ questions: QuestionCapture[] }>(c);
    const contributionId = requireParam(c, 'contributionId');
    const questions = await domain.captureQuestions(contributionId, body.questions, writeOptions(c));
    c.header('ETag', domain.lastWriteEtag() ?? etagOf((await domain.getContribution(contributionId)).version));
    return c.json(questions, 201);
  });
  app.post('/v1/contributions/:contributionId/claim', validateOperation('claimContribution'), async (c) => {
    const contribution = await domain.claimContribution(requireParam(c, 'contributionId'), writeOptions(c));
    etag(c, contribution);
    return c.json(contribution);
  });
  app.post('/v1/contributions/:contributionId/release', validateOperation('releaseContribution'), async (c) => {
    const contribution = await domain.releaseContribution(requireParam(c, 'contributionId'), writeOptions(c));
    etag(c, contribution);
    return c.json(contribution);
  });

  // ---- questions ----------------------------------------------------------------------------------
  app.get('/v1/questions', validateOperation('listQuestions'), async (c) => {
    return c.json(await domain.listQuestions(questionFilter(getValidatedQuery(c))));
  });
  app.get('/v1/questions/:questionId', validateOperation('getQuestion'), async (c) => {
    const question = await domain.getQuestion(requireParam(c, 'questionId'));
    etag(c, question);
    return c.json(question);
  });
  app.get('/v1/questions/:questionId/history', validateOperation('getQuestionHistory'), async (c) => {
    return c.json(await domain.getQuestionHistory(requireParam(c, 'questionId')));
  });

  const questionResult = (c: Context, question: Question): Response => {
    etag(c, question);
    return c.json(question);
  };

  app.post('/v1/questions/:questionId/classification', validateOperation('classifyQuestion'), async (c) => {
    const body = getValidatedBody<Classification>(c);
    const question = await domain.classifyQuestion(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/assignment', validateOperation('assignQuestion'), async (c) => {
    const body = getValidatedBody<{ unitId: string }>(c);
    const question = await domain.assignQuestion(requireParam(c, 'questionId'), body.unitId, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/answers', validateOperation('draftAnswer'), async (c) => {
    const body = getValidatedBody<AnswerDraft>(c);
    const question = await domain.draftAnswer(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/review-submissions', validateOperation('submitForReview'), async (c) => {
    const question = await domain.submitForReview(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/approvals', validateOperation('approveQuestion'), async (c) => {
    const body = getValidatedBody<{ answerVersion: number }>(c);
    const question = await domain.approveQuestion(requireParam(c, 'questionId'), body.answerVersion, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/legal-clearances', validateOperation('clearQuestionLegally'), async (c) => {
    const body = getValidatedBody<LegalClearanceRequest>(c);
    const question = await domain.clearQuestionLegally(requireParam(c, 'questionId'), body, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/returns', validateOperation('returnQuestion'), async (c) => {
    const body = getValidatedBody<{ reason: string }>(c);
    const question = await domain.returnQuestion(requireParam(c, 'questionId'), body.reason, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/staging', validateOperation('stageQuestion'), async (c) => {
    const question = await domain.stageQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/delivery', validateOperation('deliverQuestion'), async (c) => {
    const question = await domain.deliverQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/closure', validateOperation('closeQuestion'), async (c) => {
    const question = await domain.closeQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/withdrawal', validateOperation('withdrawQuestion'), async (c) => {
    const body = getValidatedBody<{ reason: string }>(c);
    const question = await domain.withdrawQuestion(requireParam(c, 'questionId'), body.reason, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/merge', validateOperation('mergeQuestion'), async (c) => {
    const body = getValidatedBody<{ intoQuestionId: string }>(c);
    const question = await domain.mergeQuestion(requireParam(c, 'questionId'), body.intoQuestionId, writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/claim', validateOperation('claimQuestion'), async (c) => {
    const question = await domain.claimQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });
  app.post('/v1/questions/:questionId/release', validateOperation('releaseQuestion'), async (c) => {
    const question = await domain.releaseQuestion(requireParam(c, 'questionId'), writeOptions(c));
    return questionResult(c, question);
  });

  // ---- stage / events / demo -----------------------------------------------------------------
  app.get('/v1/stage', async (c) => c.json(await domain.getStage()));
  app.get('/v1/events', validateOperation('listEvents'), async (c) => {
    const query = getValidatedQuery(c);
    return c.json(await domain.listEvents(query['after'] as number | undefined, query['limit'] as number | undefined));
  });
  app.post('/v1/demo/seed', validateOperation('seedDemo'), async (c) => {
    if (!demoEnabled) {
      throw new ApiProblem(403, 'Forbidden', 'Demo endpoints are disabled. Set HV_DEMO=1 to enable them.');
    }
    const body = getValidatedBody<{ questions?: number; seed?: number }>(c);
    const seedOptions = {
      ...(body.questions !== undefined ? { questions: body.questions } : {}),
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
    };
    return c.json(await domain.seedDemo(seedOptions));
  });

  // GET /v1/stream (SSE) is not implemented: optional per the slice spec (polling /v1/events is the
  // contract minimum) and left out of this pass under time pressure — see the slice's Open section.

  return app;
}
