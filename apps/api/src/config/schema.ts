/**
 * The one configuration schema of the service (slice 034b). `readServiceConfig(env)` validates every variable
 * the service reads, before a socket is opened, and returns a typed, frozen object or throws a `ConfigError` with
 * one fixed sentence per violation (`sentences.ts`; never a value). zod validates each variable, the rules across
 * variables are plain checks over the validated values.
 *
 * The defaults are those of slice 034a; nothing here changes one. The Migration CLI is not part of the schema.
 */
import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';
import type { Actor } from '@hv/domain';
import { parseActorHeader } from '../actor.ts';
import { DEFAULT_LIMITS } from '../limits/config.ts';
import { canonicalCidrList } from './cidr.ts';
import { readAccessLog, readMetricsTokenValue, readNtp, type AccessLogConfig } from './groups.ts';
import { normalizeOrigin } from './origins.ts';
import { createReader, type Env, type Reader } from './reader.ts';
import { ConfigError } from './sentences.ts';

export { ConfigError } from './sentences.ts';

/** Variables of tools that share the environment (CI, the migration CLI): known, never reported. */
export const TOOL_VARIABLES = ['HV_MIGRATION_DATABASE_URL', 'HV_DB_RUNTIME_ROLE', 'HV_REQUIRE_POSTGRES_TESTS', 'HV_WEB_MODE'] as const;

const LIMIT_VARIABLES = [
  ['HV_REQUEST_TIMEOUT_MS', 'requestTimeoutMs', 7_000, 60_000],
  ['HV_RATE_LIMIT_WRITES_PER_MIN', 'writePerSubject', 1, 10_000],
  ['HV_RATE_LIMIT_READS_PER_MIN', 'readPerSubject', 60, 100_000],
  ['HV_RATE_LIMIT_ANON_PER_MIN', 'anonymousPerSource', 10, 100_000],
  ['HV_RATE_LIMIT_LOGIN_PER_MIN', 'loginPerSource', 1, 10_000],
  ['HV_RATE_LIMIT_LOGIN_GLOBAL_PER_MIN', 'loginTotal', 10, 100_000],
  ['HV_RATE_LIMIT_PROBES_PER_MIN', 'probePerSource', 10, 100_000],
  ['HV_RATE_LIMIT_PREFLIGHT_PER_MIN', 'preflightPerSource', 10, 100_000],
  ['HV_DB_STATEMENT_TIMEOUT_MS', 'statementTimeoutMs', 500, 60_000],
  ['HV_DB_LOCK_TIMEOUT_MS', 'lockTimeoutMs', 100, 60_000],
  ['HV_DB_QUERY_TIMEOUT_MS', 'queryTimeoutMs', 1_000, 60_000],
  ['HV_DB_IDLE_TX_TIMEOUT_MS', 'idleInTransactionTimeoutMs', 1_000, 600_000],
] as const;

type LimitKey = (typeof LIMIT_VARIABLES)[number][1];
export type ConfiguredLimits = Readonly<Record<LimitKey, number>>;

/** Every variable of the schema; `.env.example` lists exactly these (drift test). */
export const CONFIG_VARIABLES = [
  'PORT', 'HV_DEMO', 'HV_DATABASE_URL', 'HV_EVENT_LOG', 'HV_DB_TLS',
  'HV_OIDC_ISSUER', 'HV_OIDC_CLIENT_ID', 'HV_OIDC_CLIENT_SECRET', 'HV_OIDC_REDIRECT_URI', 'HV_AUTH_ENCRYPTION_KEY',
  'HV_TRANSPARENCY_NOTICE_VERSION', 'HV_TRANSPARENCY_NOTICE_DE', 'HV_TRANSPARENCY_NOTICE_EN', 'HV_DSFA_SUMMARY_URL',
  'HV_SEED_ACTOR', 'HV_ACCESS_LOG_DIR', 'HV_ACCESS_LOG_HASH_KEY', 'HV_ACCESS_LOG_RETENTION_DAYS',
  'HV_NTP_SERVERS', 'HV_CLOCK_MAX_DRIFT_MS', 'HV_METRICS_TOKEN', 'HV_CORS_ORIGINS', 'HV_TRUSTED_PROXY_CIDRS',
  ...LIMIT_VARIABLES.map(([name]) => name),
] as const;

const OIDC_VARIABLES = ['HV_OIDC_ISSUER', 'HV_OIDC_CLIENT_ID', 'HV_OIDC_CLIENT_SECRET', 'HV_OIDC_REDIRECT_URI',
  'HV_AUTH_ENCRYPTION_KEY'] as const;
const NOTICE_VARIABLES = ['HV_TRANSPARENCY_NOTICE_VERSION', 'HV_TRANSPARENCY_NOTICE_DE', 'HV_TRANSPARENCY_NOTICE_EN'] as const;
/** Adjacent pairs must be strictly increasing (slice 034a, decision 8). */
const TIME_ORDER = ['HV_DB_LOCK_TIMEOUT_MS', 'HV_DB_STATEMENT_TIMEOUT_MS', 'HV_DB_QUERY_TIMEOUT_MS', 'HV_REQUEST_TIMEOUT_MS',
  'HV_DB_IDLE_TX_TIMEOUT_MS'] as const;

export interface ServiceConfig {
  readonly port: number;
  readonly demo: boolean;
  readonly dbTls: boolean;
  readonly databaseUrl?: string;
  readonly eventLog?: string;
  readonly persistence: 'postgres' | 'jsonl' | 'none';
  readonly auth: 'oidc' | 'none';
  readonly oidc?: { readonly issuer: string; readonly clientId: string; readonly clientSecret: string; readonly redirectUri: string };
  readonly authKey?: Buffer;
  readonly transparencyNotice?: { readonly version: string; readonly text: { readonly de: string; readonly en: string };
    readonly dataProtectionSummaryUrl?: string };
  readonly seedActor?: Actor;
  readonly accessLog: AccessLogConfig;
  readonly ntp?: { readonly servers: readonly { host: string; port: number }[]; readonly maxDriftMs: number };
  readonly metricsToken?: string;
  readonly corsOrigins: readonly string[];
  readonly trustedProxyCidrs: readonly string[];
  readonly limits: ConfiguredLimits;
  /** Names (never values) of `HV_` variables the schema does not know. */
  readonly unknownVariables: readonly string[];
}

const int = (min: number, max: number) => z.string().regex(/^\d{1,7}$/).transform(Number).pipe(z.number().min(min).max(max));
const HTTPS_OR_LOOPBACK = 'must be an https URL (http only for localhost or 127.0.0.1) without credentials';

/** The same hosts `createOidcFlow` accepts for plain http: exactly `localhost` and `127.0.0.1`, no `[::1]`. */
function httpsOrLoopback(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.username !== '' || url.password !== '') return false;
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

function httpOrHttpsWithoutCredentials(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

function base64urlKey(raw: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(raw) && Buffer.from(raw, 'base64url').toString('base64url') === raw;
}

/** An absolute path whose parent directory exists and can be written. */
function writableParent(raw: string): boolean {
  if (!isAbsolute(raw)) return false;
  try {
    const parent = dirname(resolve(raw));
    if (!statSync(parent).isDirectory()) return false;
    accessSync(parent, constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function realOrResolved(path: string): string {
  try { return realpathSync(path); } catch { return resolve(path); }
}

function insideDirectory(file: string, directory: string): boolean {
  const target = resolve(file);
  const resolvedFile = resolve(realOrResolved(dirname(target)), basename(target));
  const rel = relative(realOrResolved(directory), resolvedFile);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function readCors(reader: Reader, demo: boolean): string[] {
  const raw = reader.raw('HV_CORS_ORIGINS');
  if (raw === undefined || raw === '') return demo ? ['http://localhost:5173'] : [];
  const rule = 'must list at most 10 exact origins (scheme://host[:port], no wildcard, https only outside demo mode)';
  const normalised = raw.split(',').map((entry) => normalizeOrigin(entry.trim()));
  const list = normalised.filter((entry): entry is string => entry !== undefined);
  if (normalised.length > 10 || list.length !== normalised.length || (!demo && list.some((origin) => !origin.startsWith('https:')))) {
    reader.fail('HV_CORS_ORIGINS', rule);
    return [];
  }
  return [...new Set(list)];
}

function readProxies(reader: Reader): string[] {
  const raw = reader.raw('HV_TRUSTED_PROXY_CIDRS');
  if (raw === undefined || raw.trim() === '') return [];
  const entries = raw.split(',').map((entry) => entry.trim());
  const blocks = canonicalCidrList(entries);
  if (blocks === undefined) {
    reader.fail('HV_TRUSTED_PROXY_CIDRS', 'must list at most 16 CIDR blocks without host bits, IPv4 from /8 and IPv6 from /32');
    return [];
  }
  return blocks;
}

const freeze = <T extends object>(value: T): T => Object.freeze(value);

export function readServiceConfig(env: Env): ServiceConfig {
  const reader = createReader(env);
  const { errors } = reader;

  const demoValue = reader.read('HV_DEMO', z.literal('1'), 'must be 1 or unset');
  const demo = demoValue === '1';
  const port = reader.read('PORT', int(1, 65_535), 'must be an integer from 1 to 65535') ?? 8787;
  const databaseUrl = reader.read('HV_DATABASE_URL', z.string().regex(/^postgres(?:ql)?:\/\/\S+$/i),
    'must be a postgres:// or postgresql:// URL');
  const dbTls = reader.read('HV_DB_TLS', z.enum(['0', '1']), 'must be 0 or 1') === '1';

  const eventLog = reader.read('HV_EVENT_LOG', z.string().refine(writableParent),
    'must be an absolute path in an existing writable directory', { emptyIsError: true });

  const issuer = reader.read('HV_OIDC_ISSUER', z.string().refine(httpsOrLoopback), HTTPS_OR_LOOPBACK);
  const notBlank = z.string().refine((value) => value.trim() !== '');
  const clientId = reader.read('HV_OIDC_CLIENT_ID', notBlank, 'must not be blank');
  const clientSecret = reader.read('HV_OIDC_CLIENT_SECRET', notBlank, 'must not be blank');
  const redirectUri = reader.read('HV_OIDC_REDIRECT_URI', z.string().refine(httpsOrLoopback), HTTPS_OR_LOOPBACK);
  const authKey = reader.read('HV_AUTH_ENCRYPTION_KEY',
    z.string().refine(base64urlKey).transform((raw) => Buffer.from(raw, 'base64url')), 'must be base64url of exactly 32 bytes');
  const noticeVersion = reader.read('HV_TRANSPARENCY_NOTICE_VERSION', notBlank, 'must not be blank');
  const noticeDe = reader.read('HV_TRANSPARENCY_NOTICE_DE', notBlank, 'must not be blank');
  const noticeEn = reader.read('HV_TRANSPARENCY_NOTICE_EN', notBlank, 'must not be blank');
  const summaryUrl = reader.read('HV_DSFA_SUMMARY_URL', z.string().refine(httpOrHttpsWithoutCredentials),
    'must be an http or https URL without credentials');

  const seedActor = reader.read('HV_SEED_ACTOR', z.string().transform((raw, ctx): Actor => {
    try { return parseActorHeader(raw); } catch { ctx.addIssue({ code: 'custom', message: 'invalid' }); return z.NEVER; }
  }), 'must be "<id>:<role>" with a known role', { emptyIsError: true });

  const accessLog = readAccessLog(reader, demo);
  const ntp = readNtp(reader);
  const metricsToken = readMetricsTokenValue(reader);

  const values: Record<string, number> = {};
  for (const [name, key, min, max] of LIMIT_VARIABLES) {
    values[name] = reader.read(name, int(min, max), `must be an integer from ${min} to ${max}`) ?? DEFAULT_LIMITS[key];
  }
  for (let i = 0; i + 1 < TIME_ORDER.length; i += 1) {
    const [a, b] = [TIME_ORDER[i]!, TIME_ORDER[i + 1]!];
    if (!reader.failed.has(a) && !reader.failed.has(b) && values[a]! >= values[b]!) reader.fail(a, `must be less than ${b}`);
  }

  const corsOrigins = readCors(reader, demo);
  const trustedProxyCidrs = readProxies(reader);

  // ---- rules across variables ------------------------------------------------------------------------------
  if (reader.present('HV_DATABASE_URL') && reader.raw('HV_EVENT_LOG') !== undefined) {
    reader.fail('HV_EVENT_LOG', 'must not be set together with HV_DATABASE_URL');
  }
  if (reader.raw('HV_EVENT_LOG') !== undefined && !demo) reader.fail('HV_EVENT_LOG', 'requires HV_DEMO=1');
  if (eventLog !== undefined && accessLog?.dir !== undefined && insideDirectory(eventLog, accessLog.dir)) {
    reader.fail('HV_EVENT_LOG', 'must not be inside HV_ACCESS_LOG_DIR');
  }
  if (demo && reader.present('HV_OIDC_ISSUER')) reader.fail('HV_DEMO', 'must not be 1 together with HV_OIDC_ISSUER');
  // Sign-in is all or nothing: one variable set means the rest must be there (a typo must not leave the service
  // running with nothing but 401 answers).
  if (OIDC_VARIABLES.some((name) => reader.present(name))) {
    for (const name of [...OIDC_VARIABLES, 'HV_DATABASE_URL', ...NOTICE_VARIABLES]) {
      if (!reader.present(name)) reader.fail(name, 'must be set when sign-in is configured');
    }
  }

  const known = new Set<string>([...CONFIG_VARIABLES, ...TOOL_VARIABLES]);
  const unknownVariables = Object.keys(env).filter((name) => /^HV_[A-Za-z0-9_]*$/.test(name) && !known.has(name)).sort();

  if (errors.length > 0 || accessLog === undefined) throw new ConfigError(errors);

  const hasOidc = issuer !== undefined && clientId !== undefined && clientSecret !== undefined && redirectUri !== undefined &&
    authKey !== undefined;
  const notice = noticeVersion !== undefined && noticeDe !== undefined && noticeEn !== undefined
    ? freeze({ version: noticeVersion, text: freeze({ de: noticeDe, en: noticeEn }),
      ...(summaryUrl !== undefined ? { dataProtectionSummaryUrl: summaryUrl } : {}) })
    : undefined;
  const persistence = databaseUrl !== undefined ? 'postgres' : eventLog !== undefined ? 'jsonl' : 'none';
  return freeze({
    port, demo, dbTls,
    ...(databaseUrl !== undefined ? { databaseUrl } : {}),
    ...(eventLog !== undefined ? { eventLog } : {}),
    persistence,
    auth: hasOidc ? 'oidc' : 'none',
    ...(hasOidc ? { oidc: freeze({ issuer, clientId, clientSecret, redirectUri }), authKey } : {}),
    ...(notice !== undefined ? { transparencyNotice: notice } : {}),
    ...(seedActor !== undefined ? { seedActor } : {}),
    accessLog: freeze(accessLog),
    ...(ntp !== undefined ? { ntp: freeze(ntp) } : {}),
    ...(metricsToken !== undefined ? { metricsToken } : {}),
    corsOrigins: freeze(corsOrigins),
    trustedProxyCidrs: freeze(trustedProxyCidrs),
    limits: freeze(Object.fromEntries(LIMIT_VARIABLES.map(([name, key]) => [key, values[name]!])) as ConfiguredLimits),
    unknownVariables: freeze(unknownVariables),
  } as ServiceConfig);
}
