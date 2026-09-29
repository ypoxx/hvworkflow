/**
 * The options `createApp` receives from the configuration (slice 034b, decision 6): every value explicitly, so
 * the `process.env` fallbacks in `app.ts` (a library default for tests) are never the source at process start.
 * Sinks, the NTP check and the Postgres pool are built by `server.ts`, which owns the side effects.
 */
import type { CreateAppOptions } from '../app.ts';
import type { ServiceConfig } from './schema.ts';

export function appOptionsOf(config: ServiceConfig): CreateAppOptions {
  return {
    demoEnabled: config.demo,
    limits: { ...config.limits },
    corsOrigins: [...config.corsOrigins],
    trustedProxyCidrs: [...config.trustedProxyCidrs],
    ...(config.oidc !== undefined ? { oidcIssuer: config.oidc.issuer, oidcClientId: config.oidc.clientId,
      oidcClientSecret: config.oidc.clientSecret, oidcRedirectUri: config.oidc.redirectUri } : {}),
    ...(config.authKey !== undefined ? { authKey: config.authKey } : {}),
    ...(config.transparencyNotice !== undefined ? { transparencyNotice: {
      version: config.transparencyNotice.version, text: { ...config.transparencyNotice.text },
      ...(config.transparencyNotice.dataProtectionSummaryUrl !== undefined
        ? { dataProtectionSummaryUrl: config.transparencyNotice.dataProtectionSummaryUrl } : {}) } } : {}),
    ...(config.eventLog !== undefined ? { eventLogPath: config.eventLog } : {}),
    ...(config.seedActor !== undefined ? { seedActor: { ...config.seedActor } } : {}),
    ...(config.metricsToken !== undefined ? { metricsToken: config.metricsToken } : {}),
  };
}
