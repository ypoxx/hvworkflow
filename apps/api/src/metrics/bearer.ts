/**
 * Bearer check of `GET /metrics` (slice 033b, T-G1-I-10). The scraper is not an actor: no session, no
 * `can()`. Both sides are hashed to equal-length SHA-256 digests before `timingSafeEqual`, so neither
 * the token length nor the position of a first differing byte is observable. A token shorter than
 * 32 characters counts as not configured: every call is then refused (closed, never open).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export const MIN_METRICS_TOKEN_LENGTH = 32;

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

export function isUsableMetricsToken(token: string | undefined): token is string {
  return token !== undefined && token.length >= MIN_METRICS_TOKEN_LENGTH;
}

export function createBearerCheck(token: string | undefined): (authorization: string | undefined) => boolean {
  const expected = isUsableMetricsToken(token) ? digest(token) : undefined;
  return (authorization) => {
    if (expected === undefined || authorization === undefined) return false;
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) return false;
    return timingSafeEqual(digest(match[1]!), expected);
  };
}
