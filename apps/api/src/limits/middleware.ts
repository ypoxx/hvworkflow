/**
 * The middleware of the request boundary (slice 034a). `app.ts` only wires them, in this order:
 * security headers, CORS (with the preflight counter), request timeout, source layer, body limit,
 * (actor and errors), subject limits, routes. A refused request costs neither a session read nor a
 * database connection nor the global write lock. No wall clock: counters use the injected clock, the
 * request timeout an ordinary timer.
 */
import type { Context, MiddlewareHandler, Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { currentRequest } from '../observability/context.ts';
import { BODY_LIMIT_BYTES, type LimitsConfig } from './config.ts';
import { createWindowCounter, type HitResult } from './counters.ts';
import { payloadTooLarge, requestTimeout, tooManyRequests } from './responses.ts';
import type { Notices } from './stderr.ts';

// ---- security headers ----------------------------------------------------------------------------------------

/**
 * Exactly these values, set after `await next()` on every response of the application when the header is
 * still missing (so the existing `no-store` of the sign-in paths stays a single header). The CSP concerns the
 * service's own answers (JSON, problem details, redirects): it serves no HTML; the CSP of the web document is
 * slice 037.
 */
export const SECURITY_HEADERS: readonly (readonly [string, string])[] = [
  ['Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"],
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'no-referrer'],
  ['Cross-Origin-Resource-Policy', 'same-origin'],
  ['Cross-Origin-Opener-Policy', 'same-origin'],
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['Cache-Control', 'no-store'],
];

export function createSecurityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } finally {
      const missing = SECURITY_HEADERS.filter(([name]) => !c.res.headers.has(name));
      if (missing.length > 0) {
        try {
          for (const [name, value] of missing) c.res.headers.set(name, value);
        } catch {
          // A response with immutable headers (a fetched or redirected Response): copy it, then set.
          c.res = new Response(c.res.body, c.res);
          for (const [name, value] of missing) c.res.headers.set(name, value);
        }
      }
    }
  };
}

// ---- request timeout ---------------------------------------------------------------------------------------------

/**
 * The sign-in paths have bounds of their own (OIDC deadline, Postgres timeouts): a 408 there could discard the
 * cookie answer while the callback still creates the session, or let a logout succeed without its cookie.
 */
const TIMEOUT_EXEMPT = new Set(['/auth/login', '/auth/callback', '/auth/logout']);

/**
 * One timer per request. When it runs out, the request context gets the phase `timedOut` and the answer is
 * 408, unless the Postgres boundary already entered `committing`: then the middleware waits for the end of
 * the COMMIT and returns its result. The handler that is still running is not cancelled; the boundary checks
 * the phase before it commits, so a 408 in the Postgres path means nothing was committed. The check and the
 * `committing` mark happen in one synchronous step there, on the same event loop as this timer.
 */
export function createRequestTimeout(timeoutMs: number): MiddlewareHandler {
  return async (c, next) => {
    if (TIMEOUT_EXEMPT.has(c.req.path)) {
      await next();
      return;
    }
    const context = currentRequest();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const downstream = next();
    const expired = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
    const winner = await Promise.race([downstream.then(() => 'done' as const), expired]);
    if (timer !== undefined) clearTimeout(timer);
    if (winner === 'done') return;
    if (context?.phase === 'committing') {
      await downstream;
      return;
    }
    if (context !== undefined) context.phase = 'timedOut';
    // A late error of the abandoned handler must not become an unhandled rejection.
    downstream.catch(() => undefined);
    c.res = requestTimeout();
  };
}

// ---- rate limits ----------------------------------------------------------------------------------------------------

export interface RateLimitDeps {
  clock: () => Date;
  limits: LimitsConfig;
  notices: Notices;
}

type SourceKind = 'anonymous' | 'sign-in start' | 'probe' | 'preflight';

/**
 * Answers 429 and applies the protocol exception (decision 11): the first refusal of a key in a window is
 * logged like any request, later ones are counted in a fixed stderr summary and not written one by one.
 */
function refuse(context: ReturnType<typeof currentRequest>, deps: RateLimitDeps, kind: SourceKind,
  result: { firstRejection: boolean; retryAfterSeconds: number }): Response {
  if (context !== undefined && !result.firstRejection) {
    context.suppressLog = true;
    deps.notices.suppressed(kind);
  }
  return tooManyRequests(result.retryAfterSeconds);
}

/**
 * CORS in front of the preflight counter: an `OPTIONS` request is checked against its own counter first,
 * so a preflight flood cannot exhaust any other counter and a refused preflight costs nothing else. Every
 * other request goes to `cors` unchanged (which sets the CORS headers of allowed origins on every response).
 */
export function createPreflightGuard(deps: RateLimitDeps, sourceOf: (c: Context) => string,
  cors: MiddlewareHandler): MiddlewareHandler {
  const counter = createWindowCounter({ limit: deps.limits.preflightPerSource, clock: deps.clock,
    maxKeys: deps.limits.maxKeys, onTableFull: () => deps.notices.once('HV-Tool API: rate limit key table full.') });
  return async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      deps.notices.tick();
      const result = counter.hit(sourceOf(c));
      if (!result.allowed) return refuse(currentRequest(), deps, 'preflight', result);
    }
    return cors(c, next);
  };
}

/**
 * The source layer, in front of the body limit and the authentication (decision 3): three counters per source,
 * each refusing with 429 before any session read or database access.
 *  - probes: exactly `/healthz` and `/readyz` count only here;
 *  - sign-in start: every `GET /auth/login`, per source and over all sources, whatever cookie or `X-Actor` it
 *    carries;
 *  - anonymous: every other request without sign-in material counts before authentication. A request WITH
 *    material passes on (workplaces behind one address keep working); when it ends without a subject (401) or
 *    as a 413, it counts afterwards, and an exhausted source gets 429 instead, so a forged but well-formed
 *    cookie does not get around the limit.
 */
export function createSourceLayer(deps: RateLimitDeps, sourceOf: (c: Context) => string,
  hasSignInMaterial: (c: Context) => boolean): MiddlewareHandler {
  const { clock, limits, notices } = deps;
  const onTableFull = (): void => notices.once('HV-Tool API: rate limit key table full.');
  const make = (limit: number) => createWindowCounter({ limit, clock, maxKeys: limits.maxKeys, onTableFull });
  const probes = make(limits.probePerSource);
  const anonymous = make(limits.anonymousPerSource);
  const loginPerSource = make(limits.loginPerSource);
  const loginTotal = createWindowCounter({ limit: limits.loginTotal, clock, maxKeys: 1 });

  return async (c: Context, next: Next) => {
    notices.tick();
    const context = currentRequest();
    const path = c.req.path;
    const source = sourceOf(c);
    let countLater = false;
    if (path === '/healthz' || path === '/readyz') {
      const result = probes.hit(source);
      if (!result.allowed) return refuse(context, deps, 'probe', result);
    } else if (path === '/auth/login' && (c.req.method === 'GET' || c.req.method === 'HEAD')) {
      const bySource = loginPerSource.hit(source);
      const overall = loginTotal.hit('all');
      if (!bySource.allowed || !overall.allowed) {
        notices.once('HV-Tool API: sign-in start limit reached.');
        return refuse(context, deps, 'sign-in start', {
          firstRejection: (!bySource.allowed && bySource.firstRejection) || (!overall.allowed && overall.firstRejection),
          retryAfterSeconds: Math.max(bySource.retryAfterSeconds, overall.retryAfterSeconds),
        });
      }
    } else if (hasSignInMaterial(c)) {
      countLater = true;
    } else {
      const result = anonymous.hit(source);
      if (!result.allowed) return refuse(context, deps, 'anonymous', result);
    }
    await next();
    if (countLater && context?.subjectHash === null && (c.res.status === 401 || c.res.status === 413)) {
      const result = anonymous.hit(source);
      if (!result.allowed) c.res = refuse(context, deps, 'anonymous', result);
    }
  };
}

/** The body limit of 256 KiB (413). The source layer in front of it counts every 413. */
export function createBodyLimit(): MiddlewareHandler {
  return bodyLimit({ maxSize: BODY_LIMIT_BYTES, onError: () => payloadTooLarge() });
}

/**
 * Quotas per subject (decision 2), behind the actor stage and in front of `guarded`: a refused write leaves no
 * event and no idempotency entry. The key is the `subjectHash` of the access log (an HMAC of the actor id),
 * never the actor id, and no role decides anything here. `/auth/logout` is outside `/v1` and never counted.
 */
export function createSubjectLimits(deps: RateLimitDeps): MiddlewareHandler {
  const { clock, limits, notices } = deps;
  const onTableFull = (): void => notices.once('HV-Tool API: rate limit key table full.');
  const writes = createWindowCounter({ limit: limits.writePerSubject, clock, maxKeys: limits.maxKeys, onTableFull });
  const reads = createWindowCounter({ limit: limits.readPerSubject, clock, maxKeys: limits.maxKeys, onTableFull });
  return async (c, next) => {
    const subject = currentRequest()?.subjectHash;
    if (subject === null || subject === undefined || !c.req.path.startsWith('/v1/')) {
      await next();
      return;
    }
    const method = c.req.method;
    const write = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    const read = method === 'GET' || method === 'HEAD';
    if (!write && !read) {
      await next();
      return;
    }
    const result: HitResult = (write ? writes : reads).hit(subject);
    if (result.allowed) {
      await next();
      return;
    }
    notices.once(write ? 'HV-Tool API: write rate limit reached.' : 'HV-Tool API: read rate limit reached.');
    // Every refusal of a subject is logged individually (only source keys use the protocol exception).
    return tooManyRequests(result.retryAfterSeconds);
  };
}
