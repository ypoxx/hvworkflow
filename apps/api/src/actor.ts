/**
 * The demo authentication adapter (contract security scheme `demoActor`): the header carries
 * `<actorId>:<role>` in place of an OIDC claim set. Nothing else in the system would change if this
 * file were replaced by a real OIDC adapter — `HvApi` and the domain stay the same (ADR 0002).
 */
import { ApiProblem, ROLE_PERMISSIONS, type Actor, type Role } from '@hv/domain';

const VALID_ROLES = new Set(Object.keys(ROLE_PERMISSIONS) as Role[]);

/** Parse the `X-Actor` header. Throws a 401 `ApiProblem` when missing, malformed, or an unknown role. */
export function parseActorHeader(header: string | undefined): Actor {
  if (header === undefined || header.trim() === '') {
    throw new ApiProblem(401, 'Unauthorized', 'The X-Actor header is required (format "<id>:<role>").');
  }
  const sep = header.indexOf(':');
  const id = sep === -1 ? header : header.slice(0, sep);
  const role = sep === -1 ? '' : header.slice(sep + 1);
  if (id.trim() === '' || role.trim() === '') {
    throw new ApiProblem(
      401,
      'Unauthorized',
      `Malformed X-Actor header "${header}"; expected "<id>:<role>".`,
    );
  }
  if (!VALID_ROLES.has(role as Role)) {
    throw new ApiProblem(401, 'Unauthorized', `Unknown role "${role}" in X-Actor header.`);
  }
  return { id, role: role as Role };
}

/**
 * The authentication port (slice 029a, BF-01, ADR 0004): one adapter per request resolves the actor
 * or throws a 401 `ApiProblem`. `selectAuthAdapter` is the single place that picks the adapter from
 * the startup options; slice 029 adds `sessionCookie` (OIDC) and `localBreakGlass` here.
 */
export type AuthAdapter = (readHeader: (name: string) => string | undefined) => Actor;

export interface AuthOptions {
  demoEnabled: boolean;
  oidcIssuer: string | undefined;
}

/** Demo only: the `X-Actor` header carries the actor (contract security scheme `demoActor`). */
const demoHeader: AuthAdapter = (readHeader) => parseActorHeader(readHeader('X-Actor'));

/**
 * No sign-in path configured: fail closed. The request's headers are deliberately not read — not even
 * to validate them — so a caller cannot learn anything from, or be trusted through, `X-Actor`.
 */
const noSignIn: AuthAdapter = () => {
  throw new ApiProblem(
    401,
    'Unauthorized',
    'No sign-in path is configured: the X-Actor header is accepted only in demo mode (HV_DEMO=1), and no other sign-in is set up.',
  );
};

/**
 * Pick the adapter for this process. Demo mode together with an OIDC issuer refuses to start (the
 * lock of ADR 0004): an environment with real sign-ins must never accept the demo header. This is
 * startup configuration, so it throws a plain `Error`, not an HTTP-shaped `ApiProblem`.
 */
export function selectAuthAdapter(options: AuthOptions): AuthAdapter {
  const issuer = options.oidcIssuer?.trim() ?? '';
  if (options.demoEnabled && issuer !== '') {
    throw new Error(
      'Refusing to start: HV_DEMO=1 and HV_OIDC_ISSUER are both set. Demo mode trusts the X-Actor header and must never run next to a real sign-in; unset one of them.',
    );
  }
  return options.demoEnabled ? demoHeader : noSignIn;
}
