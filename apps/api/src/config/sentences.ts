/**
 * The fixed sentences of a refused start (slice 034b). Form: `HV-Tool API: refusing to start: <VARIABLE> <rule>.`
 * A sentence names the variable and the rule, never a value (not even a shortened one): a configuration
 * value can be a secret, a path or a URL with credentials.
 */
export const REFUSE = 'HV-Tool API: refusing to start:';

export const sentence = (variable: string, rule: string): string => `${REFUSE} ${variable} ${rule}.`;

// The three sentences of slice 033a stay word for word the same.
export const REFUSE_DIR = sentence('HV_ACCESS_LOG_DIR', 'must name a writable directory');
export const REFUSE_KEY = sentence('HV_ACCESS_LOG_HASH_KEY', 'must be base64 and at least 32 bytes');
export const REFUSE_RETENTION = sentence('HV_ACCESS_LOG_RETENTION_DAYS', 'must be an integer from 1 to 365');
export const REFUSE_METRICS_TOKEN = sentence('HV_METRICS_TOKEN', 'must be at least 32 characters when set');
export const REFUSE_DIR_RIGHTS = sentence('HV_ACCESS_LOG_DIR', 'must not be writable by group or accessible by others');

/** Thrown by `readServiceConfig`; `message` joins the sentences, one per line. */
export class ConfigError extends Error {
  readonly sentences: readonly string[];
  constructor(sentences: readonly string[]) {
    super(sentences.join('\n'));
    this.name = 'ConfigError';
    this.sentences = sentences;
  }
}
