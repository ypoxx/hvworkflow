/**
 * The variable groups that slice 033 introduced (access log, clock check, metrics token), as functions over a
 * `Reader`. `readServiceConfig` uses them; `readObservabilityConfig`, `parseNtpEnv` and `readMetricsToken` stay
 * as thin wrappers so the 033 tests keep their meaning (slice 034b, decision 6).
 */
import { randomBytes } from 'node:crypto';
import { accessSync, constants, lstatSync, statSync } from 'node:fs';
import { isIP } from 'node:net';
import { z } from 'zod';
import type { NtpServer } from '../clock/ntp.ts';
import type { Reader } from './reader.ts';
import { REFUSE_DIR, REFUSE_DIR_RIGHTS, REFUSE_KEY } from './sentences.ts';

export interface AccessLogConfig {
  /** Undefined only in demo mode without a directory: the sink discards. */
  dir: string | undefined;
  hashKey: Buffer;
  retentionDays: number;
}

function writableDirectory(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false;
    accessSync(path, constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** No write for the group, nothing for others (0700 and 0750 pass), and no symlink. No owner comparison: 037. */
function rightsAreNarrow(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return stat.isDirectory() && (stat.mode & 0o027) === 0;
  } catch {
    return false;
  }
}

function validHashKey(raw: string): boolean {
  const key = Buffer.from(raw, 'base64');
  // Buffer.from is lenient; the canonical re-encoding must match, ignoring padding.
  const strip = (text: string): string => text.replace(/=+$/, '');
  return key.length >= 32 && strip(key.toString('base64')) === strip(raw);
}

/** `HV_ACCESS_LOG_DIR`, `_HASH_KEY`, `_RETENTION_DAYS`: outside demo mode the access log cannot be switched off. */
export function readAccessLog(reader: Reader, demo: boolean): AccessLogConfig | undefined {
  const before = reader.errors.length;
  const rawDir = reader.raw('HV_ACCESS_LOG_DIR');
  let dir: string | undefined;
  if (rawDir === undefined) {
    if (!demo) { reader.errors.push(REFUSE_DIR); reader.failed.add('HV_ACCESS_LOG_DIR'); }
  } else if (rawDir === '' || !writableDirectory(rawDir)) {
    reader.errors.push(REFUSE_DIR);
    reader.failed.add('HV_ACCESS_LOG_DIR');
  } else if (!rightsAreNarrow(rawDir)) {
    reader.errors.push(REFUSE_DIR_RIGHTS);
    reader.failed.add('HV_ACCESS_LOG_DIR');
  } else {
    dir = rawDir;
  }

  let hashKey: Buffer | undefined;
  if (reader.raw('HV_ACCESS_LOG_HASH_KEY') === undefined) {
    if (demo) hashKey = randomBytes(32); // synthetic data only: a per-process key means no linkage across restarts
    else { reader.errors.push(REFUSE_KEY); reader.failed.add('HV_ACCESS_LOG_HASH_KEY'); }
  } else {
    const parsed = z.string().refine(validHashKey).transform((raw) => Buffer.from(raw, 'base64'));
    hashKey = reader.read('HV_ACCESS_LOG_HASH_KEY', parsed, 'must be base64 and at least 32 bytes', { emptyIsError: true });
  }

  const retention = z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().min(1).max(365));
  const retentionDays = reader.read('HV_ACCESS_LOG_RETENTION_DAYS', retention, 'must be an integer from 1 to 365',
    { emptyIsError: true });
  if (reader.errors.length > before || hashKey === undefined) return undefined;
  return { dir, hashKey, retentionDays: retentionDays ?? 30 };
}

/** Up to three `host[:port]` or `[v6]:port` entries. Undefined when any entry is malformed. */
function parseNtpServers(raw: string): NtpServer[] | undefined {
  const entries = raw.split(',').map((part) => part.trim());
  if (entries.length > 3) return undefined;
  const servers: NtpServer[] = [];
  for (const entry of entries) {
    const bracket = /^\[([0-9A-Fa-f:.]+)\](?::(\d{1,5}))?$/.exec(entry);
    const plain = /^([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(\d{1,5}))?$/.exec(entry);
    const host = bracket?.[1] ?? plain?.[1];
    const portText = bracket !== null ? bracket[2] : plain?.[3];
    if (host === undefined || (bracket !== null && isIP(host) !== 6)) return undefined;
    const port = portText === undefined ? 123 : Number(portText);
    if (port < 1 || port > 65_535) return undefined;
    servers.push({ host, port });
  }
  return servers;
}

/** `HV_NTP_SERVERS` (up to three `host[:port]`, `[v6]:port`) and `HV_CLOCK_MAX_DRIFT_MS` (50..60000, default 1000). */
export function readNtp(reader: Reader): { servers: NtpServer[]; maxDriftMs: number } | undefined {
  const drift = z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().min(50).max(60_000));
  const maxDriftMs = reader.read('HV_CLOCK_MAX_DRIFT_MS', drift, 'must be an integer from 50 to 60000', { emptyIsError: true });
  const raw = reader.raw('HV_NTP_SERVERS');
  if (raw === undefined || raw.trim() === '') return undefined;
  const list = z.string().transform(parseNtpServers).pipe(z.custom<NtpServer[]>((value) => Array.isArray(value)));
  const servers = reader.read('HV_NTP_SERVERS', list, 'must list one to three host[:port] entries');
  return servers === undefined ? undefined : { servers, maxDriftMs: maxDriftMs ?? 1000 };
}

/** Unset (or empty): `/metrics` answers 401 to everybody. Set but shorter than 32 characters: the start is refused. */
export function readMetricsTokenValue(reader: Reader): string | undefined {
  return reader.read('HV_METRICS_TOKEN', z.string().min(32), 'must be at least 32 characters when set');
}
