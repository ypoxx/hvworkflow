/**
 * CIDR blocks of the trusted proxies (slice 034b, decision 8). Parsing is strict; matching uses `net.BlockList`.
 * `/0` is refused for every address: a block that trusts the whole internet lets a client choose its own source.
 */
import { BlockList, isIPv4, isIPv6 } from 'node:net';

export const MAX_TRUSTED_PROXY_BLOCKS = 16;

interface Cidr {
  address: string;
  prefix: number;
  family: 'ipv4' | 'ipv6';
  /** The spelling that goes into logs and the start line: an IPv4-mapped block is shown as its IPv4 block. */
  canonical: string;
}

/** Shortest blocks accepted (review 034b): a shorter one lets a client pick its own source or nearly the whole address space. */
const MIN_PREFIX = { ipv4: 8, ipv6: 32 } as const;

const MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** The IPv4 form of an IPv4-mapped IPv6 address, so both spellings of one peer match one block. */
export function unmap(address: string): string {
  const mapped = MAPPED.exec(address);
  return mapped?.[1] !== undefined && isIPv4(mapped[1]) ? mapped[1] : address;
}

function ipv4Bytes(address: string): number[] {
  return address.split('.').map(Number);
}

/** Sixteen bytes of an IPv6 address (`::` and an embedded dotted IPv4 tail expanded). Input must pass `isIPv6`. */
function ipv6Bytes(address: string): number[] {
  let text = address.toLowerCase();
  const tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (tail?.[1] !== undefined) {
    const [a = 0, b = 0, c = 0, d = 0] = ipv4Bytes(tail[1]);
    text = `${text.slice(0, -tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = '', rest = ''] = text.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const restGroups = rest === '' ? [] : rest.split(':');
  const fill = text.includes('::') ? Array<string>(8 - headGroups.length - restGroups.length).fill('0') : [];
  return [...headGroups, ...fill, ...restGroups].flatMap((group) => {
    const value = Number.parseInt(group, 16);
    return [value >> 8, value & 255];
  });
}

/** True when the first `prefix` bits of both byte arrays are equal. */
function samePrefix(a: readonly number[], b: readonly number[], prefix: number): boolean {
  for (let bit = 0; bit < prefix; bit += 1) {
    const mask = 0x80 >> (bit % 8);
    if ((a[bit >> 3]! & mask) !== (b[bit >> 3]! & mask)) return false;
  }
  return true;
}

/** True when every bit after `prefix` is zero (a block names a network, not a host). */
function noHostBits(bytes: readonly number[], prefix: number): boolean {
  for (let bit = prefix; bit < bytes.length * 8; bit += 1) {
    if ((bytes[bit >> 3]! & (0x80 >> (bit % 8))) !== 0) return false;
  }
  return true;
}

const MAPPED_RANGE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0];

function v4Cidr(bytes: readonly number[], prefix: number): Cidr | undefined {
  if (prefix < MIN_PREFIX.ipv4 || prefix > 32 || !noHostBits(bytes, prefix)) return undefined;
  const address = bytes.join('.');
  return { address, prefix, family: 'ipv4', canonical: `${address}/${prefix}` };
}

/**
 * One block, strictly: IPv4 from /8, IPv6 from /32, no host bits. A block inside `::ffff:0:0/96` is read as its IPv4
 * equivalent (prefix minus 96) and gets the IPv4 rules; an IPv6 block that would contain the whole mapped range is refused,
 * because `net.BlockList` matches IPv4 peers against it.
 */
export function parseCidr(text: string): Cidr | undefined {
  const match = /^([0-9a-fA-F:.]+)\/(\d{1,3})$/.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  const address = match[1];
  const prefix = Number(match[2]);
  if (isIPv4(address)) return v4Cidr(ipv4Bytes(address), prefix);
  if (!isIPv6(address) || prefix < MIN_PREFIX.ipv6 || prefix > 128) return undefined;
  const bytes = ipv6Bytes(address);
  if (prefix >= 96 && samePrefix(bytes, MAPPED_RANGE, 96)) return v4Cidr(bytes.slice(12), prefix - 96);
  if (prefix < 96 && samePrefix(bytes, MAPPED_RANGE, prefix)) return undefined;
  if (!noHostBits(bytes, prefix)) return undefined;
  return { address, prefix, family: 'ipv6', canonical: text };
}

/** The canonical spelling of each block, or undefined when there are more than 16 or any block is refused. */
export function canonicalCidrList(entries: readonly string[]): string[] | undefined {
  if (entries.length > MAX_TRUSTED_PROXY_BLOCKS) return undefined;
  const parsed = entries.map(parseCidr);
  return parsed.every((cidr) => cidr !== undefined) ? parsed.map((cidr) => cidr!.canonical) : undefined;
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
