/**
 * Scheibe 061 on Postgres (test A4): `GET /v1/meetings/{meetingId}/cockpit` reads the request's
 * REPEATABLE READ READ ONLY snapshot (takt-024) without the write lock and appends nothing; pending
 * migrations answer `503 PersistenceBusy` like every other read; the access log names the operation and
 * carries no answer content. Runs in CI's Postgres step; skipped without `TEST_DATABASE_URL`.
 * Synthetic data only.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, type Cockpit, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import { createMemorySink } from '../observability/accessLog.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { req } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const meetingId = 'hv-2027';
const actor = { id: 'fixture-061', role: 'admin' as const };
const at = '2027-04-20T10:00:00.000Z';
const fixed = new Date('2027-04-20T10:20:00.000Z');
const COORDINATION = 'coord-061:coordination';
let owner: Pool;
let runtime: Pool;
let schema: string;

const scopedPool = (connectionString: string | undefined, name: string): Pool =>
  new Pool({ connectionString, options: `-c search_path=${schema}`, max: 3, application_name: `${schema}_${name}` });

function fixtureEvents(): readonly DomainEvent[] {
  return createInMemoryEventStore().append([
    { id: 'create', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [{ id: 'u-fin', name: 'Finanzen' }] } },
    { id: 'start', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
    { id: 'cap-1', type: 'QuestionCaptured', at: '2027-04-20T10:01:00.000Z', actor, subjectId: 'fr-1', meetingId,
      payload: { number: 'F-1', contributionId: 'rb-1', speakerId: 'sp-1', text: 'MARKER-Fragetext' } },
    { id: 'cls-1', type: 'QuestionClassified', at: '2027-04-20T10:02:00.000Z', actor, subjectId: 'fr-1', meetingId,
      payload: { track: 'expert_track' } },
    { id: 'asg-1', type: 'QuestionAssigned', at: '2027-04-20T10:03:00.000Z', actor, subjectId: 'fr-1', meetingId,
      payload: { unitId: 'u-fin' } },
    { id: 'drf-1', type: 'AnswerDrafted', at: '2027-04-20T10:04:00.000Z', actor, subjectId: 'fr-1', meetingId,
      payload: { answer: { version: 1, text: 'MARKER-Antwort', createdAt: '2027-04-20T10:04:00.000Z', createdBy: actor } } },
    { id: 'sub-1', type: 'QuestionSubmittedForReview', at: '2027-04-20T10:05:00.000Z', actor, subjectId: 'fr-1', meetingId,
      payload: { answerVersion: 1 } },
    { id: 'cap-2', type: 'QuestionCaptured', at: '2027-04-20T10:18:00.000Z', actor, subjectId: 'fr-2', meetingId,
      payload: { number: 'F-2', contributionId: 'rb-1', speakerId: 'sp-1', text: 'MARKER-Fragetext-2' } },
  ] as NewEvent[]);
}

/** The runtime pool, recording every statement a call sends. */
function recording() {
  const statements: string[] = [];
  const pool = {
    connect: async () => {
      const client = await runtime.connect();
      const original = client.query.bind(client) as (...args: unknown[]) => Promise<unknown>;
      (client as unknown as { query: unknown }).query = (sql: unknown, ...rest: unknown[]) => {
        statements.push(typeof sql === 'string' ? sql : String((sql as { text?: string }).text));
        return original(sql, ...rest);
      };
      return client;
    },
    query: (...args: unknown[]) => (runtime.query as (...a: unknown[]) => unknown)(...args),
    on: () => undefined,
  } as unknown as Pool;
  return { pool, statements };
}

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 061: A4 the control desk on Postgres', () => {
  beforeEach(async () => {
    schema = `hv061c_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl, 'owner');
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    runtime = scopedPool(runtimeUrl, 'runtime');
    for (const event of fixtureEvents()) {
      await owner.query('INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)]);
    }
  });

  afterEach(async () => {
    await runtime?.end();
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  it('200 from the read-only snapshot without the write lock; nothing appended; access log without content', async () => {
    const { pool, statements } = recording();
    const sink = createMemorySink();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, accessLog: { sink, hashKey: Buffer.alloc(32, 6) } });
    const res = await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`, { actor: COORDINATION });
    expect(res.status).toBe(200);
    const body = await res.json() as Cockpit;
    expect(body.totals).toEqual({ captured: 2, open: 2, staged: 0, answered: 0 });
    expect(body.openByUnit).toEqual({ 'u-fin': 1 });
    expect(body.openUnassigned).toBe(1);
    expect(body.oldestOpen.ageSeconds).toBe(19 * 60);
    expect(body.inflow.last5m).toBe(1);
    expect(body.legalReview.over10m).toBe(1);
    expect(body.legalReview.items).toEqual([{ id: 'fr-1', number: 'F-1', status: 'in_review', unitId: 'u-fin',
      ageSeconds: 19 * 60, statusAgeSeconds: 15 * 60, reviewAgeSeconds: 15 * 60 }]);
    expect(JSON.stringify(body)).not.toContain('MARKER');
    const begins = statements.filter((s) => s.startsWith('BEGIN'));
    // Every transaction of the call (sign-in lookup, the request snapshot) is read-only; no write transaction.
    expect(begins.length).toBeGreaterThan(0);
    expect(begins.every((s) => s === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')).toBe(true);
    expect(statements.join('\n').toLowerCase()).not.toContain('advisory');
    expect(Number((await owner.query<{ n: string }>('SELECT count(*)::text AS n FROM events')).rows[0]!.n)).toBe(8);
    const lines = sink.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    const line = lines.find((entry) => entry['operationId'] === 'getMeetingCockpit');
    expect(line).toBeDefined();
    expect(line!['status']).toBe(200);
    expect(typeof line!['subjectHash']).toBe('string');
    expect(JSON.stringify(line)).not.toMatch(/MARKER|F-1|fr-1|u-fin|legalReview|totals/);
  });

  it('403 R-PERM-02 for an actor without cockpit.read, also on Postgres', async () => {
    const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => fixed });
    const res = await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`, { actor: 'obs-061:observer' });
    expect(res.status).toBe(403);
    expect((await res.json() as { ruleId?: string }).ruleId).toBe('R-PERM-02');
  });

  it('migrations pending answer 503 PersistenceBusy with Retry-After, like every other read', async () => {
    const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => fixed });
    await owner.query(`DROP INDEX ${schema}.auth_login_states_expires_idx`);
    await owner.query(`DROP FUNCTION ${schema}.auth_purge_login_states(timestamptz)`);
    await owner.query('DELETE FROM schema_migrations WHERE version = 3');
    const res = await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`, { actor: COORDINATION });
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(await res.json()).toMatchObject({ status: 503, detail: 'Migrations are pending.' });
  });
});
