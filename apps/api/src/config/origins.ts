/**
 * CORS origins (slice 034b, decision 7): `scheme://host[:port]`, nothing else. Comparison is exact after
 * normalisation (scheme and host in lower case, default port removed), so one function serves the
 * configuration and every request's `Origin` header.
 */
const SHAPE = /^https?:\/\/[^/?#@*\s\\]+$/i;

/** The normalised origin, or undefined for a path, query, fragment, credentials, wildcard, `null` or another scheme. */
export function normalizeOrigin(raw: string): string | undefined {
  if (!SHAPE.test(raw)) return undefined;
  try {
    const origin = new URL(raw).origin;
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
}
