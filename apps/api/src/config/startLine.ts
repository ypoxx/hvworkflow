/**
 * The lines the process start writes about its configuration (slice 034b, decision 5 and 9). Both carry names and
 * settings that are no secrets, nothing else: no path, no URL, no key, no value of an unknown variable.
 */
import type { ServiceConfig } from './schema.ts';

const list = (items: readonly string[]): string => (items.length === 0 ? 'none' : items.join(','));

/** One fixed line after a successful start: mode, persistence, sign-in, CORS origins, trusted proxy blocks. */
export function formatStartLine(config: ServiceConfig): string {
  return `HV-Tool API: start mode=${config.demo ? 'demo' : 'service'} persistence=${config.persistence} auth=${config.auth} ` +
    `cors=${list(config.corsOrigins)} trusted-proxies=${list(config.trustedProxyCidrs)}`;
}

export function formatUnknownVariables(names: readonly string[]): string | undefined {
  return names.length === 0 ? undefined : `HV-Tool API: ignoring unknown variables: ${names.join(', ')}.`;
}
