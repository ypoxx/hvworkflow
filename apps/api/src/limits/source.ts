/**
 * The source of a request (slice 034a, decision 3): the peer of the TCP connection, normalised, then a
 * keyed hash. The address itself never leaves this module: not into the access log, the error log,
 * stderr, `/metrics` or a file (ADR 0013). Behind a trusted proxy slice 034b supplies the evaluated
 * `X-Forwarded-For`; until then the connection address counts.
 */
import { createHmac } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';

const UNKNOWN = 'unbekannt';

/** Expands an IPv6 address to eight 16-bit groups (lower case, no zone). */
function groupsOf(address: string): string[] {
  const [head = '', tail = ''] = address.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const fill = address.includes('::') ? Array<string>(8 - headGroups.length - tailGroups.length).fill('0') : [];
  return [...headGroups, ...fill, ...tailGroups].map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''));
}

/**
 * IPv4 stays as it is, an IPv4-mapped IPv6 address counts as IPv4, any other IPv6 address is cut to its
 * /64 prefix (one subscriber, one key). Anything that is no address is kept as an opaque string (tests);
 * no address at all is "unbekannt".
 */
export function normalizeSource(address: string | undefined): string {
  if (address === undefined || address.trim() === '') return UNKNOWN;
  const bare = address.trim().replace(/%.*$/, '');
  if (isIPv4(bare)) return bare;
  if (isIPv6(bare)) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(bare);
    if (mapped?.[1] !== undefined && isIPv4(mapped[1])) return mapped[1];
    return `${groupsOf(bare).slice(0, 4).join(':')}::/64`;
  }
  return bare;
}

/** A keyer with a random-per-process secret: the same source gives the same key inside one process only. */
export function createSourceKeyer(secret: Buffer): (address: string | undefined) => string {
  return (address) => createHmac('sha256', secret).update(normalizeSource(address)).digest('base64url');
}
