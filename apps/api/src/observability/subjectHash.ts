/**
 * Pseudonym of an actor for the access log: base64url(HMAC-SHA-256(key, actor id)). It is
 * pseudonymous, not anonymous (ADR 0013): whoever holds the key or can match `seq` against the
 * event history can link it back to the actor id. Both ways are covered by the "only together"
 * procedure of ADR 0013.
 */
import { createHmac } from 'node:crypto';

export function createSubjectHasher(key: Buffer): (actorId: string) => string {
  return (actorId) => createHmac('sha256', key).update(actorId).digest('base64url');
}
