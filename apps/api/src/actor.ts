/**
 * The demo authentication adapter (contract security scheme `demoActor`): the header carries
 * `<actorId>:<role>` in place of an OIDC claim set. Nothing else in the system would change if this
 * file were replaced by a real OIDC adapter — `HvApi` and the domain stay the same (ADR 0002).
 */
import { ApiProblem, ROLE_PERMISSIONS, emptyState, reduce, type Actor, type DomainEvent, type Role, type RoleAssignment, type State } from '@hv/domain';

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
export type AuthAdapter = (readHeader: (name: string) => string | undefined) => Promise<Actor>;

export interface AuthOptions {
  demoEnabled: boolean;
  oidcIssuer: string | undefined;
  sessionCookie?: AuthAdapter;
}

/** Demo only: the `X-Actor` header carries the actor (contract security scheme `demoActor`). */
const demoHeader: AuthAdapter = async (readHeader) => parseActorHeader(readHeader('X-Actor'));

/**
 * No sign-in path configured: fail closed. The request's headers are deliberately not read — not even
 * to validate them — so a caller cannot learn anything from, or be trusted through, `X-Actor`.
 */
const noSignIn: AuthAdapter = async () => {
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
  // Any defined issuer counts, even an empty or blank one: a value lost during deployment is a
  // configuration error, and the lock has to fail closed rather than fall back to demo mode.
  if (options.demoEnabled && options.oidcIssuer !== undefined) {
    throw new Error(
      'Refusing to start: HV_DEMO=1 and HV_OIDC_ISSUER are both set. Demo mode trusts the X-Actor header and must never run next to a real sign-in; unset one of them.',
    );
  }
  return options.demoEnabled ? demoHeader : options.sessionCookie ?? noSignIn;
}

/** A duplicate or malformed cookie is never a valid session credential. */
export function sessionTokenFromCookie(header: string | undefined): string | null {
  if (header === undefined) return null;
  const values = header.split(';').map((part) => part.trim())
    .filter((part) => part.startsWith('hv_session='));
  if (values.length !== 1) return null;
  const value = values[0]!.slice('hv_session='.length);
  return /^[A-Za-z0-9_-]{43,}$/.test(value) ? value : null;
}

/** Resolve current grants from all meeting projections; a session never supplies its own role. */
export function sessionActorFromEvents(events: readonly DomainEvent[], subjectId: string, now: Date): {
  actor: Actor; roles: Role[];
} {
  const states = new Map<string, State>();
  for (const event of events) {
    if (!event.meetingId) continue;
    let state = states.get(event.meetingId);
    if (!state) {
      state = emptyState();
      states.set(event.meetingId, state);
    }
    reduce(state, event);
  }
  const current: { seq: number; assignment: RoleAssignment }[] = [];
  for (const event of events) {
    if (event.type !== 'RoleAssigned' || !event.meetingId) continue;
    const state = states.get(event.meetingId);
    const assignment = state?.roleAssignments.get(event.subjectId);
    if (!assignment || assignment.subjectId !== subjectId || assignment.revokedAt ||
        (assignment.expiresAt !== undefined && Date.parse(assignment.expiresAt) <= now.getTime()) ||
        !state?.meeting || state.meeting.status === 'closed') continue;
    current.push({ seq: event.seq, assignment });
  }
  current.sort((a, b) => a.seq - b.seq || a.assignment.meetingId.localeCompare(b.assignment.meetingId));
  const selected = current[0]?.assignment;
  if (!selected) throw new ApiProblem(403, 'Forbidden', 'No active role assignment.', 'R-PERM-01');
  return {
    actor: { id: subjectId, role: selected.role, assignmentScoped: true,
      ...(selected.personId !== undefined ? { personId: selected.personId } : {}),
      ...(selected.unitId !== undefined ? { unitId: selected.unitId } : {}) },
    roles: [...new Set(current.map(({ assignment }) => assignment.role))],
  };
}
