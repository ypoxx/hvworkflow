/**
 * CIDR blocks of the trusted proxies (slice 034b, decision 8). Parsing is strict; matching uses `net.BlockList`.
 * `/0` is refused for every address: a block that trusts the whole internet lets a client choose its own source.
 */
import { BlockList, isIPv4, isIPv6 } from 'node:net';

export const MAX_TRUSTED_PROXY_BLOCKS = 16;

interface Cidr { address: string; prefix: number; family: 'ipv4' | 'ipv6' }

const MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** The IPv4 form of an IPv4-mapped IPv6 address, so both spellings of one peer match one block. */
export function unmap(address: string): string {
  const mapped = MAPPED.exec(address);
  return mapped?.[1] !== undefined && isIPv4(mapped[1]) ? mapped[1] : address;
}

export function parseCidr(text: string): Cidr | undefined {
  const match = /^([0-9a-fA-F:.]+)\/(\d{1,3})$/.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  const prefix = Number(match[2]);
  if (isIPv4(match[1]) && prefix >= 1 && prefix <= 32) return { address: match[1], prefix, family: 'ipv4' };
  if (isIPv6(match[1]) && prefix >= 1 && prefix <= 128) return { address: match[1], prefix, family: 'ipv6' };
  return undefined;
}

/** True when every entry is a valid block, there are at most 16, and none is `/0`. */
export function validCidrList(entries: readonly string[]): boolean {
  return entries.length <= MAX_TRUSTED_PROXY_BLOCKS && entries.every((entry) => parseCidr(entry) !== undefined);
}

/** A predicate over textual addresses (IPv4 or IPv6); anything that is no address is not trusted. */
export function createTrustMatcher(cidrs: readonly string[]): (address: string) => boolean {
  const list = new BlockList();
  for (const text of cidrs) {
    const cidr = parseCidr(text);
    if (cidr === undefined) throw new Error('Invalid trusted proxy block.');
    list.addSubnet(cidr.address, cidr.prefix, cidr.family);
  }
  return (address) => {
    const bare = unmap(address.trim().replace(/%.*$/, ''));
    if (isIPv4(bare)) return list.check(bare, 'ipv4');
    if (isIPv6(bare)) return list.check(bare, 'ipv6');
    return false;
  };
}
