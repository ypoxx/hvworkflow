/**
 * Start-up rules for the access log (slice 033a). Outside demo mode the service refuses to start
 * without a writable log directory and a hash key: the access log cannot be switched off (ADR 0013).
 * Every message is a fixed sentence; no variable value is ever printed. 034 folds this function into
 * its zod configuration schema.
 */
import { randomBytes } from 'node:crypto';
import { accessSync, constants, statSync } from 'node:fs';

export interface ObservabilityConfig {
  /** Undefined only in demo mode without a directory: the sink discards. */
  dir: string | undefined;
  hashKey: Buffer;
  retentionDays: number;
}

const REFUSE = 'HV-Tool API: refusing to start:';
export const REFUSE_DIR = `${REFUSE} HV_ACCESS_LOG_DIR must name a writable directory.`;
export const REFUSE_KEY = `${REFUSE} HV_ACCESS_LOG_HASH_KEY must be base64 and at least 32 bytes.`;
export const REFUSE_RETENTION = `${REFUSE} HV_ACCESS_LOG_RETENTION_DAYS must be an integer from 1 to 365.`;

export const REFUSE_METRICS_TOKEN = `${REFUSE} HV_METRICS_TOKEN must be at least 32 characters when set.`;

/**
 * Slice 033b: unset (or empty) means `/metrics` answers 401 to everybody; a token that is set but too
 * short is a configuration error and stops the start, rather than silently closing the endpoint.
 */
export function readMetricsToken(env: NodeJS.ProcessEnv): string | undefined {
  const token = env['HV_METRICS_TOKEN'];
  if (token === undefined || token === '') return undefined;
  if (token.length < 32) throw new Error(REFUSE_METRICS_TOKEN);
  return token;
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

export function readObservabilityConfig(env: NodeJS.ProcessEnv): ObservabilityConfig {
  const demo = env['HV_DEMO'] === '1';
  const dir = env['HV_ACCESS_LOG_DIR'];
  const keyRaw = env['HV_ACCESS_LOG_HASH_KEY'];
  const retentionRaw = env['HV_ACCESS_LOG_RETENTION_DAYS'];

  if (dir === undefined || dir === '') {
    if (!demo || dir === '') throw new Error(REFUSE_DIR);
  } else if (!writableDirectory(dir)) {
    throw new Error(REFUSE_DIR);
  }

  let hashKey: Buffer;
  if (keyRaw === undefined) {
    if (!demo) throw new Error(REFUSE_KEY);
    // Synthetic data only: a per-process key means no linkage across restarts.
    hashKey = randomBytes(32);
  } else {
    hashKey = Buffer.from(keyRaw, 'base64');
    // Buffer.from is lenient; the canonical re-encoding must match, ignoring padding.
    const canonical = hashKey.toString('base64');
    const strip = (s: string): string => s.replace(/=+$/, '');
    if (hashKey.length < 32 || strip(canonical) !== strip(keyRaw)) throw new Error(REFUSE_KEY);
  }

  let retentionDays = 30;
  if (retentionRaw !== undefined) {
    if (!/^\d{1,3}$/.test(retentionRaw)) throw new Error(REFUSE_RETENTION);
    retentionDays = Number(retentionRaw);
    if (retentionDays < 1 || retentionDays > 365) throw new Error(REFUSE_RETENTION);
  }
  return { dir: dir === '' ? undefined : dir, hashKey, retentionDays };
}
