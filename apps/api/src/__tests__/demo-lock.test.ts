/**
 * Slice 029a (BF-01, ADR 0004): the demo lock of the service. Without `HV_DEMO=1` there is no sign-in
 * path yet, so the service fails closed — every `/v1` call is a 401 and the `X-Actor` header is not
 * read at all. `HV_DEMO=1` together with an OIDC issuer refuses to start, so an environment with real
 * sign-ins can never accept the demo header. Responses go through `req()`, which checks status and
 * body against `packages/contract/openapi.yaml`.
 */
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { expectValidProblem } from '../contractSchema.ts';
import { ACTOR, req } from './helpers.ts';

const ISSUER = 'https://idp.example.invalid/realms/hv';

describe('demo lock (slice 029a, BF-01)', () => {
  it('401 without demo: a valid X-Actor on a read path is not accepted', async () => {
    const app = createApp({ demoEnabled: false });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    const problem = await res.json();
    expectValidProblem(problem);
    expect(problem.status).toBe(401);
    expect(problem.detail).toContain('HV_DEMO');
  });

  it('401 without demo: a valid X-Actor on a write path is not accepted', async () => {
    const app = createApp({ demoEnabled: false });
    const res = await req(app, 'POST', '/v1/speakers', {
      actor: ACTOR.admin,
      body: { displayName: 'Probe' },
    });
    expect(res.status).toBe(401);
    const problem = await res.json();
    expectValidProblem(problem);
    expect(problem.status).toBe(401);
  });

  it('401 without demo does not read the header: a malformed X-Actor gets the same answer, not a parse error', async () => {
    const app = createApp({ demoEnabled: false });
    const valid = await (await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin })).json();
    const malformed = await (await req(app, 'GET', '/v1/meeting', { actor: 'no-role-here' })).json();
    const missing = await (await req(app, 'GET', '/v1/meeting')).json();
    expect(malformed.detail).toBe(valid.detail);
    expect(missing.detail).toBe(valid.detail);
    expect(valid.detail).not.toContain('no-role-here');
  });

  it('createApp refuses to start with demo mode and an OIDC issuer, naming both variables', () => {
    expect(() => createApp({ demoEnabled: true, oidcIssuer: ISSUER })).toThrow(/HV_DEMO.*HV_OIDC_ISSUER|HV_OIDC_ISSUER.*HV_DEMO/);
    // Review 029a, minor 1/2: a blank or empty issuer is still a set issuer (fail closed).
    expect(() => createApp({ demoEnabled: true, oidcIssuer: '  ' })).toThrow(/Refusing to start/);
    expect(() => createApp({ demoEnabled: true, oidcIssuer: '' })).toThrow(/Refusing to start/);
  });

  it('createApp starts with an OIDC issuer when demo mode is off', () => {
    expect(() => createApp({ demoEnabled: false, oidcIssuer: ISSUER })).not.toThrow();
  });

  it('demo mode is unchanged: a valid X-Actor reads the meeting with 200', async () => {
    const app = createApp({ demoEnabled: true, seedOnStart: true });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(200);
  });
});
