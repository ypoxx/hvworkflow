/**
 * Slice 012, point 5: the demo auto-seed (`seedOnStart`, only used by `server.ts`) no longer runs as
 * a hardcoded `role: 'admin'` literal (AGENTS.md rule 4). The actor comes from `options.seedActor`,
 * else `HV_SEED_ACTOR` (env, `"<id>:<role>"`), else the system actor `packages/domain/src/seed.ts`
 * exports — and still goes through the one decision point (`can()`/`hasPermission`), so a
 * misconfigured actor without `demo.seed` fails closed instead of silently bypassing rights.
 *
 * `seedDemo` has no real async I/O (see `app.ts`), so the store is already populated by the time
 * `createApp()` returns — no need to await or poll.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { ACTOR, req } from './helpers.ts';

describe('demo auto-seed actor configuration', () => {
  afterEach(() => {
    delete process.env['HV_SEED_ACTOR'];
  });

  it('defaults to the system actor from packages/domain/src/seed.ts and seeds successfully', async () => {
    const app = createApp({ demoEnabled: true, seedOnStart: true });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(200);
    expect((await res.json()).counts.questions).toBeGreaterThan(0);
  });

  it('honours HV_SEED_ACTOR when options.seedActor is not given', async () => {
    process.env['HV_SEED_ACTOR'] = 'seed-bot:admin';
    const app = createApp({ demoEnabled: true, seedOnStart: true });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(200);
    expect((await res.json()).counts.questions).toBeGreaterThan(0);
  });

  it('options.seedActor takes precedence over HV_SEED_ACTOR', async () => {
    process.env['HV_SEED_ACTOR'] = 'ignored:observer'; // would fail permission if this one won
    const app = createApp({ demoEnabled: true, seedOnStart: true, seedActor: { id: 'explicit', role: 'admin' } });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(200);
    expect((await res.json()).counts.questions).toBeGreaterThan(0);
  });

  it('a seed actor without demo.seed fails closed (rights are data, AGENTS.md rule 4) — no meeting appears', async () => {
    const app = createApp({ demoEnabled: true, seedOnStart: true, seedActor: { id: 'nobody', role: 'observer' } });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(404); // "No meeting exists yet." — the auto-seed was denied, not skipped silently
  });

  // Review rework round 1, minor 9: `seed-bot:admin` above behaves exactly like the default
  // (`SYSTEM_ACTOR`, also role `admin`), so it never actually exercised the env-var *parsing* path
  // against a differently-permissioned or malformed value. These three do.

  it('HV_SEED_ACTOR with a role lacking demo.seed also fails closed — no meeting appears', async () => {
    process.env['HV_SEED_ACTOR'] = 'x:observer';
    const app = createApp({ demoEnabled: true, seedOnStart: true });
    const res = await req(app, 'GET', '/v1/meeting', { actor: ACTOR.admin });
    expect(res.status).toBe(404);
  });

  it('a malformed HV_SEED_ACTOR (no ":<role>") makes createApp throw, naming HV_SEED_ACTOR, not X-Actor', () => {
    process.env['HV_SEED_ACTOR'] = 'garbage';
    expect(() => createApp({ demoEnabled: true, seedOnStart: true })).toThrow(/HV_SEED_ACTOR/);
    expect(() => createApp({ demoEnabled: true, seedOnStart: true })).not.toThrow(/X-Actor/);
  });

  it('an HV_SEED_ACTOR with an unknown role makes createApp throw, naming HV_SEED_ACTOR, not X-Actor', () => {
    process.env['HV_SEED_ACTOR'] = 'x:root';
    expect(() => createApp({ demoEnabled: true, seedOnStart: true })).toThrow(/HV_SEED_ACTOR/);
    expect(() => createApp({ demoEnabled: true, seedOnStart: true })).not.toThrow(/X-Actor/);
  });
});
