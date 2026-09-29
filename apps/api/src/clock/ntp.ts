/**
 * Minimal SNTPv4 client for the clock check of `/readyz` (slice 033a, ADR 0011). No dependency:
 * `node:dgram` and `node:dns`. The service only reports; it never corrects the system clock.
 *
 * Time budget: one round takes at most 1800 ms (below the fixed 2000 ms `safeCheck` in `app.ts`, so
 * this port answers and not the timeout). Servers are asked one after another, each with a slot of
 * 600 ms; the next one starts when the slot ends or the answer was invalid. A silent first server
 * therefore never eats the whole budget. When the budget ends, every socket is closed; a later reply
 * is dropped, evaluated by nobody and cached nowhere.
 *
 * The request's transmit field is 64 random bits, not the time: it is echoed back as the originate
 * field, which ties a reply to this request without revealing the local clock. t1 and t4 come from
 * the injected clock (AGENTS.md rule 8). The result of a finished round (error codes too) is cached
 * for 30 s and at most one round runs at a time: `/readyz` is public, so any number of calls may
 * trigger at most one outbound round per 30 s (T-G1-D-04).
 */
import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { lookup as dnsLookup } from 'node:dns/promises';
import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

export type ClockCheck =
  | { status: 'ok' }
  | { status: 'fail'; code: 'not_configured' | 'timeout' | 'clock_unsynced' | 'clock_drift' };

export interface NtpServer { host: string; port: number }

export interface NtpClockOptions {
  servers: readonly NtpServer[];
  maxDriftMs: number;
  clock: () => Date;
  /** Test seam for DNS failures; defaults to `dns.lookup`. */
  lookup?: (host: string) => Promise<{ address: string; family: number }>;
}

const BUDGET_MS = 1800;
const SLOT_MS = 600;
const CACHE_MS = 30_000;
const NTP_EPOCH_OFFSET_S = 2_208_988_800;

type Outcome = { kind: 'valid'; offsetMs: number } | { kind: 'silent' } | { kind: 'invalid' };

function readNtpMs(packet: Buffer, at: number): number {
  const seconds = packet.readUInt32BE(at);
  const fraction = packet.readUInt32BE(at + 4);
  return (seconds - NTP_EPOCH_OFFSET_S) * 1000 + (fraction / 2 ** 32) * 1000;
}

async function ask(server: NtpServer, clock: () => Date, slot: Promise<'slot'>,
  lookup: NonNullable<NtpClockOptions['lookup']>): Promise<Outcome> {
  let socket: Socket | undefined;
  try {
    const target = await Promise.race([lookup(server.host), slot]);
    if (target === 'slot') return { kind: 'silent' };
    const nonce = randomBytes(8);
    const request = Buffer.alloc(48);
    request[0] = (0 << 6) | (4 << 3) | 3; // LI 0, version 4, mode 3 (client)
    nonce.copy(request, 40);
    socket = createSocket(target.family === 6 ? 'udp6' : 'udp4');
    const open = socket;
    const t1 = clock().getTime();
    const answer = new Promise<Outcome>((resolve) => {
      open.on('error', () => resolve({ kind: 'invalid' }));
      open.on('message', (message: Buffer, from: RemoteInfo) => {
        const t4 = clock().getTime();
        if (from.address !== target.address || from.port !== server.port) { resolve({ kind: 'invalid' }); return; }
        if (message.length < 48) { resolve({ kind: 'invalid' }); return; }
        const leap = message[0]! >> 6;
        const mode = message[0]! & 7;
        const stratum = message[1]!;
        if (mode !== 4 || leap === 3 || stratum < 1 || stratum > 15 ||
            !message.subarray(24, 32).equals(nonce) || message.readUInt32BE(40) === 0) {
          resolve({ kind: 'invalid' });
          return;
        }
        const t2 = readNtpMs(message, 32);
        const t3 = readNtpMs(message, 40);
        resolve({ kind: 'valid', offsetMs: ((t2 - t1) + (t3 - t4)) / 2 });
      });
    });
    const sent = new Promise<Outcome>((resolve) => {
      open.send(request, server.port, target.address, (error) => { if (error) resolve({ kind: 'invalid' }); });
    });
    return await Promise.race([answer, sent, slot.then((): Outcome => ({ kind: 'silent' }))]);
  } catch {
    // DNS and socket errors: never pass the error (it can name the host) on.
    return { kind: 'invalid' };
  } finally {
    try { socket?.close(); } catch { /* already closed */ }
  }
}

async function round(options: NtpClockOptions): Promise<ClockCheck> {
  const lookup = options.lookup ?? (async (host: string) => dnsLookup(host));
  const timers: ReturnType<typeof setTimeout>[] = [];
  const after = (ms: number): Promise<'slot'> => new Promise((resolve) => { timers.push(setTimeout(() => resolve('slot'), ms)); });
  const budget = after(BUDGET_MS);
  let silent = false;
  try {
    for (const server of options.servers) {
      const slot = Promise.race([after(SLOT_MS), budget]);
      const outcome = await ask(server, options.clock, slot, lookup);
      if (outcome.kind === 'valid') {
        return Math.abs(outcome.offsetMs) > options.maxDriftMs
          ? { status: 'fail', code: 'clock_drift' } : { status: 'ok' };
      }
      if (outcome.kind === 'silent') silent = true;
    }
    return { status: 'fail', code: silent ? 'timeout' : 'clock_unsynced' };
  } finally {
    for (const timer of timers) clearTimeout(timer);
  }
}

export function createNtpClockCheck(options: NtpClockOptions): () => Promise<ClockCheck> {
  if (options.servers.length === 0) return async () => ({ status: 'fail', code: 'not_configured' });
  let cached: { at: number; result: ClockCheck } | undefined;
  let running: Promise<ClockCheck> | undefined;
  return () => {
    // A clock that stepped backwards makes the age negative: treat that as expired, not as fresh forever.
    const age = cached === undefined ? -1 : options.clock().getTime() - cached.at;
    if (cached !== undefined && age >= 0 && age < CACHE_MS) return Promise.resolve(cached.result);
    if (running !== undefined) return running;
    running = round(options).then((result) => {
      cached = { at: options.clock().getTime(), result };
      return result;
    }).finally(() => { running = undefined; });
    return running;
  };
}

const REFUSE = 'HV-Tool API: refusing to start:';

/** `HV_NTP_SERVERS` (up to three `host[:port]`, `[v6]:port`) and `HV_CLOCK_MAX_DRIFT_MS` (50..60000, default 1000). */
export function parseNtpEnv(env: NodeJS.ProcessEnv): { servers: NtpServer[]; maxDriftMs: number } | undefined {
  const raw = env['HV_NTP_SERVERS'];
  const driftRaw = env['HV_CLOCK_MAX_DRIFT_MS'];
  let maxDriftMs = 1000;
  if (driftRaw !== undefined) {
    if (!/^\d{1,5}$/.test(driftRaw) || Number(driftRaw) < 50 || Number(driftRaw) > 60_000) {
      throw new Error(`${REFUSE} HV_CLOCK_MAX_DRIFT_MS must be an integer from 50 to 60000.`);
    }
    maxDriftMs = Number(driftRaw);
  }
  if (raw === undefined || raw.trim() === '') return undefined;
  const entries = raw.split(',').map((part) => part.trim());
  const fail = (): never => { throw new Error(`${REFUSE} HV_NTP_SERVERS must list one to three host[:port] entries.`); };
  if (entries.length > 3) fail();
  const servers = entries.map((entry): NtpServer => {
    const bracket = /^\[([0-9A-Fa-f:.]+)\](?::(\d{1,5}))?$/.exec(entry);
    const plain = /^([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?$/.exec(entry);
    const host = bracket?.[1] ?? plain?.[1];
    const portText = bracket !== null ? bracket[2] : plain?.[3];
    if (host === undefined || (bracket !== null && isIP(host) !== 6)) return fail();
    const port = portText === undefined ? 123 : Number(portText);
    if (port < 1 || port > 65_535) return fail();
    return { host, port };
  });
  return { servers, maxDriftMs };
}
