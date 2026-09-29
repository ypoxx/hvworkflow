/**
 * Start-up rules for the access log (slice 033a) and the metrics token (033b). Since slice 034b the rules live in
 * the configuration schema (`config/`); these functions stay as thin wrappers so their callers and tests keep
 * their meaning. Every message is a fixed sentence; no variable value is ever printed.
 */
import { readAccessLog, readMetricsTokenValue, type AccessLogConfig } from '../config/groups.ts';
import { createReader } from '../config/reader.ts';

export type ObservabilityConfig = AccessLogConfig;
export { REFUSE_DIR, REFUSE_KEY, REFUSE_METRICS_TOKEN, REFUSE_RETENTION } from '../config/sentences.ts';

/**
 * Slice 033b: unset (or empty) means `/metrics` answers 401 to everybody; a token that is set but too
 * short is a configuration error and stops the start, rather than silently closing the endpoint.
 */
export function readMetricsToken(env: NodeJS.ProcessEnv): string | undefined {
  const reader = createReader(env);
  const token = readMetricsTokenValue(reader);
  if (reader.errors.length > 0) throw new Error(reader.errors[0]);
  return token;
}

export function readObservabilityConfig(env: NodeJS.ProcessEnv): ObservabilityConfig {
  const reader = createReader(env);
  const config = readAccessLog(reader, env['HV_DEMO'] === '1');
  if (config === undefined || reader.errors.length > 0) throw new Error(reader.errors[0]);
  return config;
}
