/**
 * Scheibe 033b on Postgres: `/metrics` loads its own read-only snapshot (REPEATABLE READ READ ONLY,
 * no advisory lock, chain check like every business read) and answers a damaged chain with a bare
 * 500 that carries no diagnostic data (T-G2-D-03, T-G1-I-10). Runs in CI's Postgres step; skipped
 * without `TEST_DATABASE_URL`. Synthetic data and a synthetic token only.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { createApp } from '../app.ts';
import { runMigrations } from '../persistence/migrations.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const TOKEN = 'synthetic-metrics-token-0123456789abcdef';
const meetingId = 'hv-2027';
const actor = { id: 'fixture', role: 'admin' as const };
const at = '2027-04-20T10:00:00.000Z';
const fixed = new Date('2027-04-20T10:05:00.000Z');
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
    { id: 'cap', type: 'QuestionCaptured', at: '2027-04-20T10:03:20.000Z', actor, subjectId: 'fr-1', meetingId,
      payload: { number: 'F-1', contributionId: 'rb-1', speakerId: 'sp-1', text: 'MARKER-Fragetext' } },
  ] as NewEvent[]);
}

/** The runtime pool, recording every statement a `/metrics` call sends. */
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

const call = (app: ReturnType<typeof createApp>) => app.request('/metrics', { headers: { Authorization: `Bearer ${TOKEN}` } });

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('Scheibe 033b: /metrics on Postgres', () => {
  beforeEach(async () => {
    schema = `hv033bm_${randomUUID().replaceAll('-', '')}`;
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
    vi.restoreAllMocks();
    await runtime?.end();
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  it('reads one REPEATABLE READ READ ONLY snapshot without an advisory lock and serves the values', async () => {
    const { pool, statements } = recording();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, metricsToken: TOKEN });
    const response = await call(app);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(`hv_open_question_oldest_age_seconds{meeting_id="${meetingId}"} 100`);
    expect(body).toContain(`hv_questions_captured_last_5m{meeting_id="${meetingId}"} 1`);
    expect(body).toContain(`hv_open_questions{meeting_id="${meetingId}",unit_id="unassigned"} 1`);
    expect(body).toContain(`hv_open_questions{meeting_id="${meetingId}",unit_id="u-fin"} 0`);
    expect(body).not.toContain('MARKER');
    expect(statements[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(statements.join('\n').toLowerCase()).not.toContain('advisory');
    expect(statements.at(-1)).toBe('COMMIT');
    // The scraper appends nothing: the log is unchanged.
    expect(Number((await owner.query<{ n: string }>('SELECT count(*)::text AS n FROM events')).rows[0]!.n)).toBe(3);
  });

  it('does not touch the database for a call without the token', async () => {
    const { pool, statements } = recording();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, metricsToken: TOKEN });
    expect((await app.request('/metrics')).status).toBe(401);
    expect((await app.request('/metrics', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    expect(statements).toEqual([]);
  });

  it('answers 20 calls within the window from one snapshot', async () => {
    const { pool, statements } = recording();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixed, metricsToken: TOKEN });
    await Promise.all(Array.from({ length: 20 }, () => call(app)));
    expect(statements.filter((s) => s.startsWith('BEGIN'))).toHaveLength(1);
  });

  it.each([
    ['envelope', `UPDATE events SET envelope = jsonb_set(envelope, '{subjectId}', '"tampered"') WHERE seq = 2`],
    ['index hash', `UPDATE events SET hash = repeat('0', 64) WHERE seq = 2`],
  ])('answers a corrupt stored %s with a bare 500 and no indicator', async (_label, sql) => {
    await owner.query(sql);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp({ demoEnabled: true, postgres: runtime, clock: () => fixed, metricsToken: TOKEN });
    const response = await call(app);
    expect(response.status).toBe(500);
    // Exactly one fixed error line with the error class; no seq, no driver text (problem.ts format).
    expect(errorLog.mock.calls).toHaveLength(1);
    const line = JSON.parse(String(errorLog.mock.calls[0]![0])) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(['errorClass', 'log', 'requestId', 'ts']);
    expect(line['errorClass']).toBe('PostgresIntegrityError');
    expect(JSON.stringify(line)).not.toMatch(/seq|tampered|MARKER/i);
    const body = await response.text();
    expect(body).not.toContain('hv_');
    expect(body).not.toMatch(/seq \d/i);
    expect(body).not.toContain('tampered');
    expect(body).not.toContain('Synthetische HV');
    expect(body).not.toContain('MARKER');
  });
});
