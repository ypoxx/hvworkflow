/**
 * Regression for slice 035a (e2e-http on PR #102): in the service mode of the e2e harness (Postgres,
 * session sign-in, grants from the log), the podium delivers and closes the current stage question
 * and the stage advances. The stream bookkeeping of the in-process projection (the "before"
 * snapshot for R-PERM-04) must never fail a write or skip the reduction of the projection.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { CORPUS_DEMO, SYSTEM_ACTOR, createInMemoryEventStore, createInProcessApi, seedEvents, type Role } from '@hv/domain';
import { createApp, type App } from '../app.ts';
import type { AuthStore } from '../auth/store.ts';
import type { OidcFlow } from '../auth/oidc.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { insertPostgresEvents } from '../persistence/postgres.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const at = new Date('2027-04-20T10:15:00.000Z');
const PEOPLE: readonly { key: string; role: Role; unitId?: string }[] = [
  { key: 'moderation', role: 'moderation' }, { key: 'capture', role: 'capture' }, { key: 'coordination', role: 'coordination' },
  { key: 'expert', role: 'expert', unitId: 'unit-fin' }, { key: 'legal', role: 'legal' }, { key: 'approver', role: 'approver' },
  { key: 'podium', role: 'podium' },
];
const token = (key: string): string => `${key}${'t'.repeat(48 - key.length)}`;
const csrf = (key: string): string => `c${token(key)}`;
let schema: string;
let owner: Pool;
let runtime: Pool;

function pool(connectionString: string): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3 });
}

/** The harness bootstrap of `scripts/e2e-http-031.mjs`: demo corpus plus one grant per person. */
async function bootstrap(): Promise<void> {
  const store = createInMemoryEventStore();
  let id = 0;
  const domain = createInProcessApi({ store, actor: () => SYSTEM_ACTOR, clock: () => at, idGenerator: () => `boot-${++id}`, seeder: seedEvents });
  await domain.seedDemo({ questions: CORPUS_DEMO.questions, roundSizes: CORPUS_DEMO.roundSizes, seed: CORPUS_DEMO.seed });
  for (const person of PEOPLE) {
    await domain.assignRole({ subjectId: `subject-${person.key}`, role: person.role, ...(person.unitId !== undefined ? { unitId: person.unitId } : {}) });
  }
  const client = await owner.connect();
  try {
    await client.query('BEGIN');
    await insertPostgresEvents(client, store.all(), 60_000);
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

function sessionApp(): App {
  const sessions = new Map(PEOPLE.map((p) => [token(p.key), { actorId: `subject-${p.key}`, csrfToken: csrf(p.key) }]));
  const later = (ms: number): Date => new Date(at.getTime() + ms);
  const authStore: AuthStore = {
    async createLoginState() {},
    async consumeLoginState() { return null; },
    async createSession() { throw new Error('not used'); },
    async readSession(value) {
      const s = sessions.get(value);
      return s ? { ...s, expiresAt: later(14 * 3_600_000), idleExpiresAt: later(1_800_000) } : null;
    },
    async verifyCsrf(value, submitted) { return sessions.get(value)?.csrfToken === submitted; },
    async revokeSession(value) { return sessions.delete(value); },
    async blockSubject() {},
    async isSubjectBlocked() { return false; },
  };
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
    async complete() { return { issuer: 'https://idp.example.invalid/realms/hv', subject: 'unused' }; },
  };
  let id = 0;
  return createApp({ demoEnabled: false, oidcIssuer: 'https://idp.example.invalid/realms/hv', oidcFlow, authStore,
    postgres: runtime, clock: () => at, idGenerator: () => `req-${++id}` });
}

async function call(app: App, who: string, method: string, path: string, headers: Record<string, string> = {}, body?: unknown): Promise<Response> {
  return app.request(path, { method, headers: { Cookie: `hv_session=${token(who)}`,
    ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrf(who), 'Idempotency-Key': randomUUID() }), ...headers,
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function ok<T>(response: Promise<Response>): Promise<T> {
  const r = await response;
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return await r.json() as T;
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 035a: stage in the service mode (e2e-http regression)', () => {
  beforeEach(async () => {
    schema = `hv035a_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = pool(databaseUrl!);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    runtime = pool(runtimeUrl!);
    await bootstrap();
  });
  afterEach(async () => {
    await Promise.all([runtime?.end(), owner?.end()]);
    if (schema) {
      const admin = new Pool({ connectionString: databaseUrl });
      try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
    }
  });

  it('podium delivers and closes the current stage question with session sign-in; the stage advances', async () => {
    const app = sessionApp();
    type Q = { id: string; version: number; number: string; _actions: string[] };
    const approved = (await ok<{ items: Q[] }>(call(app, 'approver', 'GET', '/v1/questions?status=approved&limit=1'))).items[0]!;
    await ok(call(app, 'approver', 'POST', `/v1/questions/${approved.id}/staging`, { 'If-Match': `"v${approved.version}"` }));
    const stage = await ok<{ current: Q | null }>(call(app, 'podium', 'GET', '/v1/stage'));
    const current = stage.current!;
    expect(current._actions).toContain('question.deliver');
    const delivered = await ok<Q>(call(app, 'podium', 'POST', `/v1/questions/${current.id}/delivery`, { 'If-Match': `"v${current.version}"` }));
    expect(delivered._actions).toContain('question.close');
    await ok(call(app, 'podium', 'POST', `/v1/questions/${current.id}/closure`, { 'If-Match': `"v${delivered.version}"` }));
    const after = await ok<{ current: Q | null }>(call(app, 'podium', 'GET', '/v1/stage'));
    expect(after.current?.id).not.toBe(current.id);
    expect((await ok<{ status: string }>(call(app, 'moderation', 'GET', `/v1/questions/${current.id}`))).status).toBe('closed');
  }, 60_000);
});
