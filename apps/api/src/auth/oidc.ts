import { createHash } from 'node:crypto';
import { ApiProblem } from '@hv/domain';
import * as client from 'openid-client';

const SAME_ORIGIN_PATH = /^\/(?![/\\])[^\\\x00-\x20\x7f]*$/;

/** Bind every role assignment to the exact validated OIDC issuer as well as its subject. */
export function actorIdForIdentity(issuer: string, subject: string): string {
  if (!issuer || !subject) throw new Error('A validated issuer and subject are required.');
  return `oidc_${createHash('sha256').update(issuer).update('\0').update(subject).digest('base64url')}`;
}

/** The application's Location header must never become an off-origin redirect. */
export function safeReturnTo(value: string | undefined): string {
  if (value === undefined) return '/';
  if (value.length > 512) throw new ApiProblem(422, 'Unprocessable', 'returnTo exceeds 512 characters.');
  return SAME_ORIGIN_PATH.test(value) ? value : '/';
}

export interface OidcFlow {
  authorizationUrl(input: { state: string; nonce: string; pkceVerifier: string }): Promise<string>;
  complete(input: { search: string; state: string; nonce: string; pkceVerifier: string }): Promise<{
    issuer: string; subject: string; refreshToken?: string;
  }>;
}

export interface OidcFlowOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  serviceOrigin?: string;
  clock?: () => Date;
}

/** One configured issuer and one registered callback; caller controls state persistence. */
export function createOidcFlow(options: OidcFlowOptions): OidcFlow {
  let issuer: URL;
  let redirect: URL;
  try {
    issuer = new URL(options.issuer);
    redirect = new URL(options.redirectUri);
  } catch {
    throw new Error('Invalid OIDC issuer or redirect URI.');
  }
  const local = (url: URL): boolean => url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (issuer.protocol !== 'https:' && !(issuer.protocol === 'http:' && local(issuer))) {
    throw new Error('OIDC issuer must use HTTPS outside localhost.');
  }
  if (redirect.protocol !== 'https:' && !(redirect.protocol === 'http:' && local(redirect))) {
    throw new Error('OIDC redirect URI must use HTTPS outside localhost.');
  }
  if (redirect.pathname !== '/auth/callback' || redirect.search || redirect.hash ||
      (options.serviceOrigin !== undefined && redirect.origin !== options.serviceOrigin)) {
    throw new Error('OIDC redirect URI must be the configured service callback.');
  }
  if (!options.clientId || !options.clientSecret) throw new Error('OIDC client credentials are required.');

  let discovery: Promise<client.Configuration> | undefined;
  const configuration = (): Promise<client.Configuration> => {
    const skewSeconds = options.clock === undefined ? 0 :
      Math.round((options.clock().getTime() - new Date().getTime()) / 1000);
    discovery ??= client.discovery(issuer, options.clientId,
      { client_secret: options.clientSecret, id_token_signed_response_alg: 'RS256',
        [client.clockSkew]: skewSeconds, [client.clockTolerance]: 30 },
      client.ClientSecretPost(options.clientSecret),
      { execute: issuer.protocol === 'http:'
        ? [client.allowInsecureRequests, client.enableNonRepudiationChecks]
        : [client.enableNonRepudiationChecks], timeout: 3 }).then((result) => {
      if (result.serverMetadata().issuer !== options.issuer) throw new Error('OIDC issuer mismatch.');
      return result;
    }).catch((error: unknown) => {
      discovery = undefined;
      throw error;
    });
    return discovery;
  };

  return {
    async authorizationUrl({ state, nonce, pkceVerifier }) {
      const config = await configuration();
      const challenge = await client.calculatePKCECodeChallenge(pkceVerifier);
      return client.buildAuthorizationUrl(config, {
        redirect_uri: redirect.href, scope: 'openid', response_type: 'code', state, nonce,
        code_challenge: challenge, code_challenge_method: 'S256',
      }).href;
    },
    async complete({ search, state, nonce, pkceVerifier }) {
      const config = await configuration();
      const callback = new URL(redirect.href);
      callback.search = search;
      const tokens = await client.authorizationCodeGrant(config, callback, {
        expectedState: state, expectedNonce: nonce, pkceCodeVerifier: pkceVerifier, idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims || claims.iss !== options.issuer || !claims.sub ||
          (Array.isArray(claims.aud) ? !claims.aud.includes(options.clientId) : claims.aud !== options.clientId) ||
          typeof claims.exp !== 'number') {
        throw new Error('OIDC ID token validation failed.');
      }
      return { issuer: claims.iss, subject: claims.sub,
        ...(tokens.refresh_token !== undefined ? { refreshToken: tokens.refresh_token } : {}) };
    },
  };
}
