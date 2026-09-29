/**
 * Scheibe 034b: the configuration schema, `.env.example`, trusted-proxy source and the start line.
 * T-Q-T-04, T-G2-E-02, T-G2-S-01, T-G1-D-01 (table in docs/slices/034b-konfigurationsschema-cors.md).
 * CORS behaviour is in `cors034b.test.ts`. Time comes from injected clocks only (AGENTS.md rule 8).
 */
import { spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { appOptionsOf } from '../config/appOptions.ts';
import { CONFIG_VARIABLES, ConfigError, readServiceConfig } from '../config/schema.ts';
import { formatStartLine, formatUnknownVariables } from '../config/startLine.ts';
import { DEFAULT_LIMITS } from '../limits/config.ts';
import { createForwardedResolver } from '../limits/source.ts';
import { readObservabilityConfig } from '../observability/config.ts';
import { ACTOR } from './helpers.ts';

const REFUSE = 'HV-Tool API: refusing to start:';
const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..', '..');
const keyB64 = Buffer.alloc(32, 9).toString('base64');
const authKey = Buffer.alloc(32, 7).toString('base64url');

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hv-cfg034b-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

type Env = Record<string, string | undefined>;
const service = (extra: Env = {}): Env => ({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: keyB64, ...extra });
const signIn = (extra: Env = {}): Env => service({
  HV_DATABASE_URL: 'postgres://runtime@db.example/hv',
  HV_OIDC_ISSUER: 'https://idp.example/realms/hv', HV_OIDC_CLIENT_ID: 'hv-web',
  HV_OIDC_CLIENT_SECRET: 'MARKER-client-secret', HV_OIDC_REDIRECT_URI: 'https://hv.example/auth/callback',
  HV_AUTH_ENCRYPTION_KEY: authKey,
  HV_TRANSPARENCY_NOTICE_VERSION: 'v1', HV_TRANSPARENCY_NOTICE_DE: 'Hinweis', HV_TRANSPARENCY_NOTICE_EN: 'Notice',
  ...extra });

function sentences(env: Env): string[] {
  try { readServiceConfig(env); } catch (error) {
    if (error instanceof ConfigError) return [...error.sentences];
    throw error;
  }
  return [];
}
const only = (env: Env, name: string): string[] => sentences(env).filter((line) => line.includes(` ${name} `));

describe('Scheibe 034b: defaults and shape (T-Q-T-04)', () => {
  it('gives the 034a defaults unchanged and a frozen object', () => {
    const config = readServiceConfig(service());
    expect(config.port).toBe(8787);
    expect(config.demo).toBe(false);
    expect(config.limits).toEqual({ requestTimeoutMs: 10_000, queryTimeoutMs: 6_000, lockTimeoutMs: 3_000,
      statementTimeoutMs: 5_000, idleInTransactionTimeoutMs: 15_000, writePerSubject: 60, readPerSubject: 1_200,
      anonymousPerSource: 600, loginPerSource: 120, probePerSource: 600, preflightPerSource: 1_200, loginTotal: 600 });
    for (const [name, value] of Object.entries(config.limits)) {
      expect((DEFAULT_LIMITS as unknown as Record<string, number>)[name], name).toBe(value);
    }
    expect(config.corsOrigins).toEqual([]);
    expect(config.trustedProxyCidrs).toEqual([]);
    expect(config.persistence).toBe('none');
    expect(config.auth).toBe('none');
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.limits)).toBe(true);
  });

  it('starts in demo mode without anything else and defaults the CORS origin to the Vite dev server', () => {
    const config = readServiceConfig({ HV_DEMO: '1' });
    expect(config.demo).toBe(true);
    expect(config.corsOrigins).toEqual(['http://localhost:5173']);
    expect(config.accessLog.dir).toBeUndefined();
  });

  it('treats HV_DEMO=0 and any other value than 1 as an error (used to mean "off")', () => {
    for (const bad of ['0', 'true', 'yes', ' 1', '2']) {
      expect(sentences({ HV_DEMO: bad }), bad).toContain(`${REFUSE} HV_DEMO must be 1 or unset.`);
    }
  });

  it('keeps the three 033a sentences word for word', () => {
    expect(sentences({ HV_ACCESS_LOG_HASH_KEY: keyB64 })).toEqual([`${REFUSE} HV_ACCESS_LOG_DIR must name a writable directory.`]);
    expect(sentences({ HV_ACCESS_LOG_DIR: dir })).toEqual([`${REFUSE} HV_ACCESS_LOG_HASH_KEY must be base64 and at least 32 bytes.`]);
    expect(sentences(service({ HV_ACCESS_LOG_RETENTION_DAYS: '0' })))
      .toEqual([`${REFUSE} HV_ACCESS_LOG_RETENTION_DAYS must be an integer from 1 to 365.`]);
  });

  it('collects every violation, one fixed sentence each, and names no value', () => {
    const list = sentences({ HV_DEMO: 'MARKER-demo', PORT: 'MARKER-port', HV_DB_TLS: 'MARKER-tls' });
    expect(list).toEqual(expect.arrayContaining([
      `${REFUSE} HV_DEMO must be 1 or unset.`, `${REFUSE} PORT must be an integer from 1 to 65535.`,
      `${REFUSE} HV_DB_TLS must be 0 or 1.`]));
    expect(list.join('\n')).not.toContain('MARKER');
  });

  it('refuses HV_DB_TLS=yes and accepts 0 and 1', () => {
    expect(only(service({ HV_DB_TLS: 'yes' }), 'HV_DB_TLS')).toHaveLength(1);
    expect(sentences(service({ HV_DB_TLS: '0' }))).toEqual([]);
    expect(sentences(service({ HV_DB_TLS: '1' }))).toEqual([]);
    expect(readServiceConfig(service({ HV_DB_TLS: '1' })).dbTls).toBe(true);
  });
});

describe('Scheibe 034b: the schema reads every variable it lists', () => {
  it('touches each name of CONFIG_VARIABLES, and no other name of the environment', () => {
    const seen = new Set<string>();
    const values = signIn({ HV_NTP_SERVERS: 'a.example' });
    const env = new Proxy(values, { get: (target, name) => { if (typeof name === 'string') seen.add(name); return target[name as string]; } });
    readServiceConfig(env);
    expect([...seen].filter((name) => /^(HV_|PORT$)/.test(name)).sort()).toEqual([...CONFIG_VARIABLES].sort());
  });
});

describe('Scheibe 034b: numeric ranges and time order (T-Q-T-04, T-G1-D-01)', () => {
  const ranges: [string, number, number][] = [
    ['PORT', 1, 65_535], ['HV_REQUEST_TIMEOUT_MS', 7_000, 60_000], ['HV_RATE_LIMIT_WRITES_PER_MIN', 1, 10_000],
    ['HV_RATE_LIMIT_READS_PER_MIN', 60, 100_000], ['HV_RATE_LIMIT_ANON_PER_MIN', 10, 100_000],
    ['HV_RATE_LIMIT_LOGIN_PER_MIN', 1, 10_000], ['HV_RATE_LIMIT_LOGIN_GLOBAL_PER_MIN', 10, 100_000],
    ['HV_RATE_LIMIT_PROBES_PER_MIN', 10, 100_000], ['HV_RATE_LIMIT_PREFLIGHT_PER_MIN', 10, 100_000],
    ['HV_DB_STATEMENT_TIMEOUT_MS', 500, 60_000], ['HV_DB_LOCK_TIMEOUT_MS', 100, 60_000],
    ['HV_DB_QUERY_TIMEOUT_MS', 1_000, 60_000], ['HV_DB_IDLE_TX_TIMEOUT_MS', 1_000, 600_000],
  ];

  it.each(ranges)('%s: refuses below %i and above %i with a sentence that names the variable, not the value', (name, min, max) => {
    for (const bad of [String(min - 1), String(max + 1), 'abc', '1.5', '-1', `${max}0000`]) {
      const found = only(service({ [name]: bad }), name);
      expect(found, `${name}=${bad}`).toHaveLength(1);
      expect(found[0]).toBe(`${REFUSE} ${name} must be an integer from ${min} to ${max}.`);
      if (bad === 'abc') expect(found[0]).not.toContain(bad);
    }
  });

  it.each(ranges)('%s: accepts the two bounds', (name, min, max) => {
    // Pairs are checked as a chain, so only the variable under test moves; a bound that breaks the chain is
    // exercised with its neighbours in the order test below.
    if (name.startsWith('HV_DB_') || name === 'HV_REQUEST_TIMEOUT_MS') return;
    for (const value of [min, max]) expect(only(service({ [name]: String(value) }), name)).toEqual([]);
  });

  it('refuses HV_REQUEST_TIMEOUT_MS=6000 (below the /readyz budget of 3 x 2 000 ms) and accepts 7000', () => {
    expect(only(service({ HV_REQUEST_TIMEOUT_MS: '6000' }), 'HV_REQUEST_TIMEOUT_MS')).toHaveLength(1);
    expect(sentences(service({ HV_REQUEST_TIMEOUT_MS: '7000' }))).toEqual([]);
    expect(readServiceConfig(service({ HV_REQUEST_TIMEOUT_MS: '7000' })).limits.requestTimeoutMs).toBe(7_000);
  });

  it('refuses the five time limits in the wrong order: lock < statement < query < request < idle', () => {
    expect(sentences(service({ HV_DB_LOCK_TIMEOUT_MS: '6000', HV_DB_STATEMENT_TIMEOUT_MS: '5000' })))
      .toContain(`${REFUSE} HV_DB_LOCK_TIMEOUT_MS must be less than HV_DB_STATEMENT_TIMEOUT_MS.`);
    expect(sentences(service({ HV_DB_STATEMENT_TIMEOUT_MS: '6000' })))
      .toContain(`${REFUSE} HV_DB_STATEMENT_TIMEOUT_MS must be less than HV_DB_QUERY_TIMEOUT_MS.`);
    expect(sentences(service({ HV_DB_QUERY_TIMEOUT_MS: '10000' })))
      .toContain(`${REFUSE} HV_DB_QUERY_TIMEOUT_MS must be less than HV_REQUEST_TIMEOUT_MS.`);
    expect(sentences(service({ HV_REQUEST_TIMEOUT_MS: '15000' })))
      .toContain(`${REFUSE} HV_REQUEST_TIMEOUT_MS must be less than HV_DB_IDLE_TX_TIMEOUT_MS.`);
    const moved = readServiceConfig(service({ HV_DB_LOCK_TIMEOUT_MS: '100', HV_DB_STATEMENT_TIMEOUT_MS: '500',
      HV_DB_QUERY_TIMEOUT_MS: '1000', HV_REQUEST_TIMEOUT_MS: '7000', HV_DB_IDLE_TX_TIMEOUT_MS: '7001' }));
    expect(moved.limits).toMatchObject({ lockTimeoutMs: 100, statementTimeoutMs: 500, queryTimeoutMs: 1_000,
      requestTimeoutMs: 7_000, idleInTransactionTimeoutMs: 7_001 });
  });
});

describe('Scheibe 034b: rules across variables (T-Q-T-04)', () => {
  it('refuses Postgres together with the JSONL log', () => {
    const log = join(dir, 'events.jsonl');
    expect(sentences({ HV_DEMO: '1', HV_DATABASE_URL: 'postgres://u@h/d', HV_EVENT_LOG: log }))
      .toContain(`${REFUSE} HV_EVENT_LOG must not be set together with HV_DATABASE_URL.`);
  });

  it('refuses HV_DEMO=1 together with HV_OIDC_ISSUER (ADR 0004)', () => {
    expect(sentences({ HV_DEMO: '1', HV_OIDC_ISSUER: 'https://idp.example/realms/hv' }))
      .toContain(`${REFUSE} HV_DEMO must not be 1 together with HV_OIDC_ISSUER.`);
  });

  it('demands the whole sign-in configuration as soon as one variable is set', () => {
    const list = sentences(service({ HV_OIDC_ISSUER: 'https://idp.example/realms/hv' }));
    for (const name of ['HV_OIDC_CLIENT_ID', 'HV_OIDC_CLIENT_SECRET', 'HV_OIDC_REDIRECT_URI', 'HV_AUTH_ENCRYPTION_KEY',
      'HV_DATABASE_URL', 'HV_TRANSPARENCY_NOTICE_VERSION', 'HV_TRANSPARENCY_NOTICE_DE', 'HV_TRANSPARENCY_NOTICE_EN']) {
      expect(list, name).toContain(`${REFUSE} ${name} must be set when sign-in is configured.`);
    }
    expect(list).not.toContain(`${REFUSE} HV_OIDC_ISSUER must be set when sign-in is configured.`);
    // A typo in one name must not silently leave the service with 401s: the encryption key alone is enough to trigger it.
    expect(sentences(service({ HV_AUTH_ENCRYPTION_KEY: authKey }))).toContain(
      `${REFUSE} HV_OIDC_ISSUER must be set when sign-in is configured.`);
  });

  it('accepts the complete sign-in configuration and none at all (with the old warning path)', () => {
    const config = readServiceConfig(signIn());
    expect(config.auth).toBe('oidc');
    expect(config.persistence).toBe('postgres');
    expect(config.oidc?.issuer).toBe('https://idp.example/realms/hv');
    expect(readServiceConfig(service()).auth).toBe('none');
    expect(readServiceConfig(service()).oidc).toBeUndefined();
  });

  it('accepts http only for the loopback hosts localhost and 127.0.0.1 in issuer and redirect URI', () => {
    for (const host of ['localhost:8080', '127.0.0.1:8080']) {
      const env = signIn({ HV_OIDC_ISSUER: `http://${host}/realms/hv`, HV_OIDC_REDIRECT_URI: `http://${host}/auth/callback` });
      expect(sentences(env), host).toEqual([]);
    }
    for (const bad of ['http://idp.example/realms/hv', 'http://[::1]:8080/realms/hv', 'http://localhost.example/x',
      'https://user:MARKER-pw@idp.example/realms/hv', 'ftp://idp.example/x', 'not a url', 'http://0.0.0.0/x']) {
      const found = only(signIn({ HV_OIDC_ISSUER: bad }), 'HV_OIDC_ISSUER');
      expect(found, bad).toEqual([`${REFUSE} HV_OIDC_ISSUER must be an https URL (http only for localhost or 127.0.0.1) without credentials.`]);
    }
    expect(only(signIn({ HV_OIDC_REDIRECT_URI: 'http://hv.example/auth/callback' }), 'HV_OIDC_REDIRECT_URI')).toHaveLength(1);
    expect(sentences(signIn({ HV_OIDC_ISSUER: 'https://user:MARKER-pw@idp.example/realms/hv' })).join('\n')).not.toContain('MARKER');
  });

  it('requires the encryption key to be base64url of exactly 32 bytes', () => {
    for (const bad of ['short', Buffer.alloc(31, 1).toString('base64url'), Buffer.alloc(33, 1).toString('base64url'),
      `${authKey}=`, `${authKey.slice(0, 42)}+`]) {
      expect(only(signIn({ HV_AUTH_ENCRYPTION_KEY: bad }), 'HV_AUTH_ENCRYPTION_KEY'), bad).toHaveLength(1);
    }
  });

  it('checks the seed actor and the summary link', () => {
    expect(sentences({ HV_DEMO: '1', HV_SEED_ACTOR: 'nobody' })).toContain(`${REFUSE} HV_SEED_ACTOR must be "<id>:<role>" with a known role.`);
    expect(readServiceConfig({ HV_DEMO: '1', HV_SEED_ACTOR: ACTOR.admin }).seedActor).toEqual({ id: 'admin', role: 'admin' });
    expect(only(signIn({ HV_DSFA_SUMMARY_URL: 'https://user:pw@x.example/' }), 'HV_DSFA_SUMMARY_URL')).toHaveLength(1);
    expect(sentences(signIn({ HV_DSFA_SUMMARY_URL: 'https://hv.example/dsfa' }))).toEqual([]);
  });

  it('reads the NTP and metrics variables through the schema', () => {
    expect(readServiceConfig(service({ HV_NTP_SERVERS: 'a.example:1234', HV_CLOCK_MAX_DRIFT_MS: '50' })).ntp)
      .toEqual({ servers: [{ host: 'a.example', port: 1234 }], maxDriftMs: 50 });
    expect(sentences(service({ HV_NTP_SERVERS: 'bad host' }))).toEqual([
      `${REFUSE} HV_NTP_SERVERS must list one to three host[:port] entries.`]);
    expect(sentences(service({ HV_METRICS_TOKEN: 'short' }))).toEqual([
      `${REFUSE} HV_METRICS_TOKEN must be at least 32 characters when set.`]);
    expect(readServiceConfig(service({ HV_METRICS_TOKEN: 'x'.repeat(32) })).metricsToken).toBe('x'.repeat(32));
    expect(readServiceConfig(service({ HV_METRICS_TOKEN: '' })).metricsToken).toBeUndefined();
  });

  it('keeps the 033a wrapper working and lets it check the directory rights', () => {
    expect(readObservabilityConfig({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: keyB64 }).dir).toBe(dir);
    chmodSync(dir, 0o777);
    expect(() => readObservabilityConfig({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: keyB64 })).toThrow(
      `${REFUSE} HV_ACCESS_LOG_DIR must not be writable by group or accessible by others.`);
  });
});

describe('Scheibe 034b: paths and directory rights (T-G2-E-02)', () => {
  it('accepts an event log only in demo mode, absolute, in an existing writable directory, outside the access-log directory', () => {
    const log = join(dir, 'events.jsonl');
    expect(readServiceConfig({ HV_DEMO: '1', HV_EVENT_LOG: log }).persistence).toBe('jsonl');
    expect(sentences(service({ HV_EVENT_LOG: log }))).toContain(`${REFUSE} HV_EVENT_LOG requires HV_DEMO=1.`);
    for (const relative of ['events.jsonl', './events.jsonl', '../events.jsonl']) {
      expect(sentences({ HV_DEMO: '1', HV_EVENT_LOG: relative }), relative)
        .toContain(`${REFUSE} HV_EVENT_LOG must be an absolute path in an existing writable directory.`);
    }
    expect(sentences({ HV_DEMO: '1', HV_EVENT_LOG: join(dir, 'missing', 'events.jsonl') }))
      .toContain(`${REFUSE} HV_EVENT_LOG must be an absolute path in an existing writable directory.`);
    expect(sentences({ HV_DEMO: '1', HV_EVENT_LOG: '' }))
      .toContain(`${REFUSE} HV_EVENT_LOG must be an absolute path in an existing writable directory.`);
    const inside = join(dir, 'access');
    mkdirSync(inside, { mode: 0o700 });
    expect(sentences({ HV_DEMO: '1', HV_ACCESS_LOG_DIR: inside, HV_EVENT_LOG: join(inside, 'events.jsonl') }))
      .toContain(`${REFUSE} HV_EVENT_LOG must not be inside HV_ACCESS_LOG_DIR.`);
    expect(sentences({ HV_DEMO: '1', HV_ACCESS_LOG_DIR: inside, HV_EVENT_LOG: join(inside, 'sub', '..', 'events.jsonl') }))
      .toContain(`${REFUSE} HV_EVENT_LOG must not be inside HV_ACCESS_LOG_DIR.`);
    expect(sentences({ HV_DEMO: '1', HV_ACCESS_LOG_DIR: inside, HV_EVENT_LOG: join(dir, 'events.jsonl') })).toEqual([]);
  });

  const rights = `${REFUSE} HV_ACCESS_LOG_DIR must not be writable by group or accessible by others.`;
  it('accepts a log directory with mode 0700 and 0750', () => {
    for (const mode of [0o700, 0o750]) {
      const target = join(dir, `ok-${mode.toString(8)}`);
      mkdirSync(target);
      chmodSync(target, mode);
      expect(sentences(service({ HV_ACCESS_LOG_DIR: target })), mode.toString(8)).toEqual([]);
    }
  });

  it('refuses 0770, 0755, 0777 and a symlink to a directory with the rights sentence', () => {
    for (const mode of [0o770, 0o755, 0o777]) {
      const target = join(dir, `bad-${mode.toString(8)}`);
      mkdirSync(target);
      chmodSync(target, mode);
      expect(sentences(service({ HV_ACCESS_LOG_DIR: target })), mode.toString(8)).toEqual([rights]);
    }
    const real = join(dir, 'real');
    mkdirSync(real, { mode: 0o700 });
    const link = join(dir, 'link');
    symlinkSync(real, link);
    expect(sentences(service({ HV_ACCESS_LOG_DIR: link }))).toEqual([rights]);
    // In demo mode a given directory is checked as well.
    expect(sentences({ HV_DEMO: '1', HV_ACCESS_LOG_DIR: link })).toEqual([rights]);
  });

  it('still refuses a plain file or a missing directory with the 033a sentence', () => {
    const file = join(dir, 'plain.txt');
    writeFileSync(file, '');
    expect(sentences(service({ HV_ACCESS_LOG_DIR: file }))).toEqual([`${REFUSE} HV_ACCESS_LOG_DIR must name a writable directory.`]);
  });
});

describe('Scheibe 034b: unknown HV_ variables', () => {
  it('lists unknown HV_ names, never the tool variables, never values', () => {
    const config = readServiceConfig(service({ HV_TYPO_VARIABLE: 'MARKER-value', HV_MIGRATION_DATABASE_URL: 'x',
      HV_DB_RUNTIME_ROLE: 'x', HV_REQUIRE_POSTGRES_TESTS: '1', HV_WEB_MODE: 'x', OTHER: 'y' }));
    expect(config.unknownVariables).toEqual(['HV_TYPO_VARIABLE']);
    const line = formatUnknownVariables(config.unknownVariables);
    expect(line).toBe('HV-Tool API: ignoring unknown variables: HV_TYPO_VARIABLE.');
    expect(line).not.toContain('MARKER');
    expect(formatUnknownVariables([])).toBeUndefined();
  });
});

describe('Scheibe 034b: trusted proxy list (T-G1-D-01)', () => {
  it('refuses 0.0.0.0/0, ::/0, any /0, more than 16 blocks, and malformed blocks', () => {
    const list = (n: number): string => Array.from({ length: n }, (_, i) => `10.${i}.0.0/16`).join(',');
    for (const bad of ['0.0.0.0/0', '::/0', '10.0.0.0/0', '10.0.0.0/33', '::1/129', '10.0.0.1', '10.0.0.0/x', 'a.b.c.d/8',
      '10.0.0.0/08x', '10.0.0.0/8,', ',10.0.0.0/8', list(17), '10.0.0.0/8, 0.0.0.0/0']) {
      const found = only(service({ HV_TRUSTED_PROXY_CIDRS: bad }), 'HV_TRUSTED_PROXY_CIDRS');
      expect(found, bad).toEqual([`${REFUSE} HV_TRUSTED_PROXY_CIDRS must list at most 16 IPv4 or IPv6 CIDR blocks, none of them /0.`]);
    }
    expect(readServiceConfig(service({ HV_TRUSTED_PROXY_CIDRS: list(16) })).trustedProxyCidrs).toHaveLength(16);
    expect(readServiceConfig(service({ HV_TRUSTED_PROXY_CIDRS: '10.0.0.0/8, 2001:db8::/32' })).trustedProxyCidrs)
      .toEqual(['10.0.0.0/8', '2001:db8::/32']);
  });

  const resolve = (cidrs: string[]) => createForwardedResolver(cidrs);
  it('uses the rightmost address that is not a trusted proxy, when the peer is a trusted proxy', () => {
    const r = resolve(['10.0.0.0/8', '2001:db8::/32']);
    expect(r('10.0.0.1', '6.6.6.6, 198.51.100.7')).toBe('198.51.100.7');
    expect(r('10.0.0.1', '198.51.100.7, 10.0.0.2')).toBe('198.51.100.7');
    expect(r('10.0.0.1', '6.6.6.6, 198.51.100.7, 10.0.0.3, 10.0.0.2')).toBe('198.51.100.7');
    expect(r('2001:db8::1', '2001:4860::1, 2001:db8::2')).toBe('2001:4860::1');
    expect(r('::ffff:10.0.0.1', '198.51.100.7')).toBe('198.51.100.7');
  });

  it('falls back to the connection address for an empty, malformed or all-trusted header', () => {
    const r = resolve(['10.0.0.0/8']);
    expect(r('10.0.0.1', undefined)).toBe('10.0.0.1');
    expect(r('10.0.0.1', '')).toBe('10.0.0.1');
    expect(r('10.0.0.1', ' , ')).toBe('10.0.0.1');
    expect(r('10.0.0.1', 'garbage')).toBe('10.0.0.1');
    expect(r('10.0.0.1', '198.51.100.7, garbage')).toBe('10.0.0.1');
    expect(r('10.0.0.1', '10.0.0.2, 10.0.0.3')).toBe('10.0.0.1');
  });

  it('ignores the header when the peer is not a trusted proxy, or when no block is configured', () => {
    expect(resolve(['10.0.0.0/8'])('203.0.113.9', '198.51.100.7')).toBe('203.0.113.9');
    expect(resolve(['10.0.0.0/8'])(undefined, '198.51.100.7')).toBeUndefined();
    expect(resolve([])('10.0.0.1', '198.51.100.7')).toBe('10.0.0.1');
  });

  /** Anonymous requests count per source: with a limit of 2 the third request of one source is refused. */
  async function anonymousStatuses(over: { trusted?: string[]; peer: string | undefined; forwarded: string[] }): Promise<number[]> {
    const time = { ms: Date.parse('2027-04-20T10:00:15.000Z') };
    const app = createApp({ demoEnabled: true, clock: () => new Date(time.ms), limits: { anonymousPerSource: 2 },
      ...(over.trusted !== undefined ? { trustedProxyCidrs: over.trusted } : {}),
      sourceOf: () => over.peer });
    const statuses: number[] = [];
    for (const forwarded of over.forwarded) {
      statuses.push((await app.request('/v1/meeting', { headers: { 'X-Forwarded-For': forwarded } })).status);
    }
    return statuses;
  }

  it('counts a request from a trusted proxy under the client at the right of the header, not under a forged left entry', async () => {
    // Same client behind the proxy, a different forged prefix each time: one source, the third is refused.
    expect(await anonymousStatuses({ trusted: ['10.0.0.0/8'], peer: '10.0.0.1',
      forwarded: ['1.1.1.1, 198.51.100.7', '2.2.2.2, 198.51.100.7', '3.3.3.3, 198.51.100.7'] })).toEqual([401, 401, 429]);
    // Three different clients behind the proxy: three sources, none refused.
    expect(await anonymousStatuses({ trusted: ['10.0.0.0/8'], peer: '10.0.0.1',
      forwarded: ['198.51.100.7', '198.51.100.8', '198.51.100.9'] })).toEqual([401, 401, 401]);
  });

  it('counts a DIRECT connection with a forged X-Forwarded-For under the connection address', async () => {
    expect(await anonymousStatuses({ trusted: ['10.0.0.0/8'], peer: '203.0.113.9',
      forwarded: ['198.51.100.1', '198.51.100.2', '198.51.100.3'] })).toEqual([401, 401, 429]);
    // No list configured (the default): the header never counts.
    expect(await anonymousStatuses({ peer: '203.0.113.9',
      forwarded: ['198.51.100.1', '198.51.100.2', '198.51.100.3'] })).toEqual([401, 401, 429]);
  });

  it('takes the connection address of the Node server when no test source is injected', async () => {
    const time = { ms: Date.parse('2027-04-20T10:00:15.000Z') };
    const app = createApp({ demoEnabled: true, clock: () => new Date(time.ms), limits: { anonymousPerSource: 2 },
      trustedProxyCidrs: ['10.0.0.0/8'] });
    const via = (peer: string, forwarded: string) => app.request('/v1/meeting', { headers: { 'X-Forwarded-For': forwarded } },
      { incoming: { socket: { remoteAddress: peer } } });
    expect([(await via('203.0.113.9', 'a1')).status, (await via('203.0.113.9', '198.51.100.1')).status,
      (await via('203.0.113.9', '198.51.100.2')).status]).toEqual([401, 401, 429]);
    expect([(await via('10.0.0.1', '198.51.100.1')).status, (await via('10.0.0.1', '5.5.5.5, 198.51.100.2')).status,
      (await via('10.0.0.1', '6.6.6.6, 198.51.100.1')).status]).toEqual([401, 401, 401]);
  });
});

describe('Scheibe 034b: configured limits take effect (T-G1-D-01)', () => {
  it('HV_RATE_LIMIT_WRITES_PER_MIN=2 refuses the third write with 429', async () => {
    const config = readServiceConfig({ HV_DEMO: '1', HV_RATE_LIMIT_WRITES_PER_MIN: '2' });
    const time = { ms: Date.parse('2027-04-20T10:00:15.000Z') };
    const app = createApp({ ...appOptionsOf(config), clock: () => new Date(time.ms), sourceOf: () => 'source-a',
      persistence: { load: () => undefined, save: () => undefined } });
    const write = () => app.request('/v1/demo/seed', { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: 1, seed: 1 }) });
    const statuses = [(await write()).status, (await write()).status, (await write()).status];
    expect(statuses[0]).toBe(200);
    expect(statuses[2]).toBe(429);
    expect(statuses[1]).not.toBe(429);
  });

  it('passes every configured value on explicitly', () => {
    const config = readServiceConfig(signIn({ HV_CORS_ORIGINS: 'https://app.example', HV_TRUSTED_PROXY_CIDRS: '10.0.0.0/8',
      HV_METRICS_TOKEN: 'm'.repeat(32), HV_RATE_LIMIT_READS_PER_MIN: '77', HV_SEED_ACTOR: undefined }));
    const options = appOptionsOf(config);
    expect(options).toMatchObject({ demoEnabled: false, oidcIssuer: 'https://idp.example/realms/hv', oidcClientId: 'hv-web',
      oidcClientSecret: 'MARKER-client-secret', oidcRedirectUri: 'https://hv.example/auth/callback',
      corsOrigins: ['https://app.example'], trustedProxyCidrs: ['10.0.0.0/8'], metricsToken: 'm'.repeat(32),
      transparencyNotice: { version: 'v1', text: { de: 'Hinweis', en: 'Notice' } } });
    expect(options.authKey?.length).toBe(32);
    expect(options.limits).toMatchObject({ readPerSubject: 77 });
    expect(options).not.toHaveProperty('eventLogPath');
    expect(options).not.toHaveProperty('seedActor');
  });
});

describe('Scheibe 034b: start line and secrets (T-G2-S-01)', () => {
  it('writes one fixed line: mode, persistence, sign-in, CORS origins, proxy blocks', () => {
    expect(formatStartLine(readServiceConfig({ HV_DEMO: '1' })))
      .toBe('HV-Tool API: start mode=demo persistence=none auth=none cors=http://localhost:5173 trusted-proxies=none');
    expect(formatStartLine(readServiceConfig(signIn({ HV_CORS_ORIGINS: 'https://a.example,https://b.example:8443',
      HV_TRUSTED_PROXY_CIDRS: '10.0.0.0/8,2001:db8::/32' }))))
      .toBe('HV-Tool API: start mode=service persistence=postgres auth=oidc cors=https://a.example,https://b.example:8443 trusted-proxies=10.0.0.0/8,2001:db8::/32');
    expect(formatStartLine(readServiceConfig(service()))).toBe(
      'HV-Tool API: start mode=service persistence=none auth=none cors=none trusted-proxies=none');
    expect(formatStartLine(readServiceConfig({ HV_DEMO: '1', HV_EVENT_LOG: join(dir, 'e.jsonl') }))).toContain('persistence=jsonl');
  });

  const markers = ['MARKER-client-secret', 'MARKER-auth-key', 'MARKER-hash-key', 'MARKER-metrics-token', 'MARKER-db-password'];
  it('carries no secret, no path, no URL of the environment in the start line, the sentences or the unknown-variable line', () => {
    const good = signIn({ HV_DATABASE_URL: 'postgres://runtime:MARKER-db-password@db.example/hv',
      HV_ACCESS_LOG_HASH_KEY: Buffer.from('MARKER-hash-key'.padEnd(32, 'x')).toString('base64'),
      HV_METRICS_TOKEN: `MARKER-metrics-token${'x'.repeat(20)}`, HV_TYPO: 'MARKER-typo' });
    const config = readServiceConfig(good);
    const outputs = [formatStartLine(config), formatUnknownVariables(config.unknownVariables) ?? ''];
    const bad = { ...good, HV_OIDC_REDIRECT_URI: 'http://MARKER-client-secret.example/x', HV_AUTH_ENCRYPTION_KEY: 'MARKER-auth-key',
      HV_DB_TLS: 'MARKER-client-secret', PORT: 'MARKER-hash-key', HV_METRICS_TOKEN: 'MARKER-metrics-token',
      HV_CORS_ORIGINS: '*MARKER-db-password', HV_TRUSTED_PROXY_CIDRS: 'MARKER-db-password' };
    outputs.push(...sentences(bad));
    expect(sentences(bad).length).toBeGreaterThan(4);
    for (const output of outputs) for (const marker of markers) expect(output, marker).not.toContain(marker);
    expect(outputs.join('\n')).not.toContain('postgres://');
    expect(outputs.join('\n')).not.toContain(dir);
  });
});

describe('Scheibe 034b: .env.example (drift)', () => {
  const text = readFileSync(join(apiRoot, '.env.example'), 'utf8');
  /** A variable line is `NAME=value` or `# NAME=value` (an optional variable shown commented out). */
  const keysOf = (source: string): string[] => [...source.matchAll(/^#? ?([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]!);

  it('lists every variable of the schema exactly once, and nothing else', () => {
    const keys = keysOf(text);
    expect([...new Set(keys)].sort()).toEqual([...CONFIG_VARIABLES].sort());
    expect(keys).toHaveLength(new Set(keys).size);
  });

  it('turns red when a variable is missing from the file or from the schema', () => {
    const withoutOne = text.replace(/^#? ?HV_METRICS_TOKEN=.*$/m, '');
    expect([...new Set(keysOf(withoutOne))].sort()).not.toEqual([...CONFIG_VARIABLES].sort());
    const withExtra = `${text}\nHV_NOT_IN_SCHEMA=1\n`;
    expect([...new Set(keysOf(withExtra))].sort()).not.toEqual([...CONFIG_VARIABLES].sort());
  });

  it('holds no secret value: secrets are empty, and the file, taken as an environment, needs only the two log variables', () => {
    const env: Env = {};
    for (const match of text.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)) env[match[1]!] = match[2]!;
    for (const secret of ['HV_OIDC_CLIENT_SECRET', 'HV_AUTH_ENCRYPTION_KEY', 'HV_ACCESS_LOG_HASH_KEY', 'HV_METRICS_TOKEN']) {
      expect(env[secret] ?? '', secret).toBe('');
    }
    expect(sentences({ ...env, HV_ACCESS_LOG_DIR: undefined, HV_ACCESS_LOG_HASH_KEY: undefined })).toEqual([
      `${REFUSE} HV_ACCESS_LOG_DIR must name a writable directory.`,
      `${REFUSE} HV_ACCESS_LOG_HASH_KEY must be base64 and at least 32 bytes.`]);
    expect(sentences({ ...env, HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: keyB64 })).toEqual([]);
  });

  it('describes each variable with a comment line above it', () => {
    const lines = text.split('\n');
    for (const key of CONFIG_VARIABLES) {
      const index = lines.findIndex((line) => new RegExp(`^#? ?${key}=`).test(line));
      expect(index, key).toBeGreaterThan(0);
      expect(lines[index - 1], key).toMatch(/^# \S/);
    }
  });
});

describe('Scheibe 034b: process start (T-Q-T-04, MF-08)', () => {
  const tsx = join(apiRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  const entry = join(apiRoot, 'src', 'server.ts');
  const childEnv = (extra: Env): NodeJS.ProcessEnv => {
    const base: NodeJS.ProcessEnv = { PATH: process.env['PATH'], HOME: process.env['HOME'] };
    for (const [name, value] of Object.entries(extra)) if (value !== undefined) base[name] = value;
    return base;
  };

  function run(extra: Env): Promise<{ code: number | null; stderr: string; stdout: string }> {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ['--import', tsx, entry], { env: childEnv(extra), cwd: apiRoot });
      let stderr = ''; let stdout = '';
      child.stderr.on('data', (chunk: Buffer) => { stderr += String(chunk); });
      child.stdout.on('data', (chunk: Buffer) => { stdout += String(chunk); });
      child.on('close', (code) => resolve({ code, stderr, stdout }));
    });
  }

  it('refuses with exit 1 and the fixed sentences: only HV_OIDC_ISSUER set, no value on stderr', async () => {
    const result = await run({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: keyB64,
      HV_OIDC_ISSUER: 'https://idp.example/MARKER-issuer-path' });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(`${REFUSE} HV_OIDC_CLIENT_ID must be set when sign-in is configured.`);
    expect(result.stderr).toContain(`${REFUSE} HV_DATABASE_URL must be set when sign-in is configured.`);
    expect(result.stderr).not.toContain('MARKER');
    expect(result.stdout).not.toContain('listening');
  }, 30_000);

  it('refuses without demo and without an access log with the 033a sentence, and a group-writable directory with the rights sentence', async () => {
    const none = await run({});
    expect(none.code).toBe(1);
    expect(none.stderr).toContain(`${REFUSE} HV_ACCESS_LOG_DIR must name a writable directory.`);
    chmodSync(dir, 0o755);
    const open = await run({ HV_ACCESS_LOG_DIR: dir, HV_ACCESS_LOG_HASH_KEY: keyB64 });
    expect(open.code).toBe(1);
    expect(open.stderr).toContain(`${REFUSE} HV_ACCESS_LOG_DIR must not be writable by group or accessible by others.`);
  }, 30_000);

  it('starts in demo mode, writes the start line with mode demo and the unknown-variable line, then listens', async () => {
    const port = await new Promise<number>((resolve) => {
      const probe = createServer().listen(0, '127.0.0.1', () => {
        const { port: free } = probe.address() as { port: number };
        probe.close(() => resolve(free));
      });
    });
    const child = spawn(process.execPath, ['--import', tsx, entry],
      { env: childEnv({ HV_DEMO: '1', PORT: String(port), HV_TYPO_VARIABLE: 'MARKER-x' }), cwd: apiRoot });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += String(chunk); });
    try {
      const deadline = Date.now() + 20_000; // now-ok: a real-time wait for a child process, not domain time
      while (!stdout.includes('HV-Tool API: start ') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
      expect(stdout).toContain('HV-Tool API: start mode=demo persistence=none auth=none cors=http://localhost:5173 trusted-proxies=none');
      expect(stdout + stderr).toContain('HV-Tool API: ignoring unknown variables: HV_TYPO_VARIABLE.');
      expect(stdout + stderr).not.toContain('MARKER');
    } finally {
      child.kill();
    }
  }, 40_000);
});
