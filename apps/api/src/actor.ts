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
