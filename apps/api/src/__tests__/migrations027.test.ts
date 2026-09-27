import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createInMemoryEventStore, type DomainEvent, type NewEvent } from '@hv/domain';
import { runMigrations } from '../persistence/migrations.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
let admin: Pool;
let owner: Pool;
let schema: string;

async function tableNames(): Promise<string[]> {
  const result = await owner.query<{ table_name: string }>(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY table_name',
  );
  return result.rows.map((row) => row.table_name);
}

function meetingEvent(): DomainEvent {
  return createInMemoryEventStore().append([{
    id: 'migration-meeting', type: 'MeetingCreated', at: '2027-04-20T10:00:00.000Z',
    actor: { id: 'fixture', role: 'admin' }, subjectId: 'hv-2027', meetingId: 'hv-2027',
    payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] },
  } as NewEvent])[0]!;
}

describe.skipIf(databaseUrl === undefined)('Scheibe 027: migrations and grants', () => {
  beforeEach(async () => {
    schema = `hv027_mig_${randomUUID().replaceAll('-', '')}`;
    admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`CREATE SCHEMA ${schema}`);
    owner = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
  });

  afterEach(async () => {
    await owner?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  it('migrates an empty disposable database up and down, then up again', async () => {
    await runMigrations(owner, { direction: 'up' });
    expect(await tableNames()).toEqual(expect.arrayContaining(['events', 'persons', 'schema_migrations']));
    const migration = await owner.query<{ version: number }>('SELECT version FROM schema_migrations');
    expect(migration.rows.length).toBeGreaterThan(0);
    const columns = await owner.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name IN ('events', 'persons')`,
    );
    expect(columns.rows.filter((row) => row.table_name === 'events').map((row) => row.column_name))
      .toEqual(expect.arrayContaining(['seq', 'id', 'meeting_id', 'hash', 'prev_hash', 'envelope']));
    expect(columns.rows.filter((row) => row.table_name === 'persons').map((row) => row.column_name))
      .toEqual(expect.arrayContaining(['meeting_id', 'person_id', 'display_name', 'organisation', 'key_id', 'source_seq']));

    await runMigrations(owner, { direction: 'down' });
    expect(await tableNames()).not.toContain('events');
    expect(await tableNames()).not.toContain('persons');
    await runMigrations(owner, { direction: 'up' });
    expect(await tableNames()).toContain('events');
  });

  it('refuses a destructive down migration after events exist and preserves every byte of the row', async () => {
    await runMigrations(owner, { direction: 'up' });
    const event = meetingEvent();
    await owner.query(
      'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
      [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)],
    );
    const before = await owner.query('SELECT * FROM events ORDER BY seq');
    await expect(runMigrations(owner, { direction: 'down' })).rejects.toThrow();
    const after = await owner.query('SELECT * FROM events ORDER BY seq');
    expect(after.rows).toEqual(before.rows);
    expect(await tableNames()).toContain('events');
  });

  it('refuses an unknown future schema version rather than serving or overwriting it', async () => {
    await runMigrations(owner, { direction: 'up' });
    await owner.query('INSERT INTO schema_migrations (version) VALUES ($1)', [999999]);
    await expect(runMigrations(owner, { direction: 'up' })).rejects.toThrow();
    expect(await tableNames()).toContain('events');
  });

  it.skipIf(runtimeUrl === undefined)('denies UPDATE, DELETE, TRUNCATE and DDL to the runtime login', async () => {
    await runMigrations(owner, { direction: 'up' });
    const runtime = new Pool({ connectionString: runtimeUrl, options: `-c search_path=${schema}` });
    try {
      const event = meetingEvent();
      await runtime.query(
        'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId, event.hash, event.prevHash, JSON.stringify(event)],
      );
      expect((await runtime.query('SELECT seq FROM events')).rows).toEqual([{ seq: 1 }]);
      expect((await runtime.query('SELECT * FROM persons')).rows).toEqual([]);
      expect((await runtime.query('SELECT * FROM schema_migrations')).rows.length).toBeGreaterThan(0);
      for (const sql of [
        `UPDATE events SET id = 'changed' WHERE seq = 1`,
        'DELETE FROM events WHERE seq = 1',
        'TRUNCATE events',
        `INSERT INTO persons (meeting_id, person_id, display_name, key_id, source_seq)
         VALUES ('hv-2027', 'p-1', 'Testperson', 'hv-2027', 1)`,
      ]) {
        // The last INSERT is deliberately permitted; the subsequent mutations must be denied.
        if (sql.startsWith('INSERT')) { await runtime.query(sql); continue; }
        await expect(runtime.query(sql)).rejects.toMatchObject({ code: '42501' });
      }
      for (const sql of [
        `UPDATE persons SET display_name = 'changed' WHERE person_id = 'p-1'`,
        `DELETE FROM persons WHERE person_id = 'p-1'`,
        'TRUNCATE persons',
        'CREATE TABLE forbidden_by_runtime (id integer)',
      ]) await expect(runtime.query(sql)).rejects.toMatchObject({ code: '42501' });
      expect((await runtime.query('SELECT id FROM events')).rows).toEqual([{ id: event.id }]);
    } finally {
      await runtime.end();
    }
  });
});
