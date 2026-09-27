import type { Pool, PoolClient } from 'pg';
import { assertEventShape, verifyEventChain, type DomainEvent } from '@hv/domain';

/** The per-meeting identity projection stored beside, and reconstructed from, the event log. */
export interface PersonRow {
  meetingId: string;
  personId: string;
  displayName: string;
  organisation?: string;
  keyId: string;
  sourceSeq: number;
}

export interface PostgresSnapshot {
  events: DomainEvent[];
  persons: PersonRow[];
}

/** Messages crossing the HTTP boundary must never include a DB diagnostic or an event payload. */
export class PostgresPersistenceError extends Error {
  constructor() {
    super('Postgres persistence is unavailable.');
    this.name = 'PostgresPersistenceError';
  }
}

export class PostgresIntegrityError extends Error {
  readonly seq: number;

  constructor(seq: number) {
    super(`Event seq ${seq}: integrity check failed.`);
    this.name = 'PostgresIntegrityError';
    this.seq = seq;
  }
}

interface EventDbRow {
  seq: string | number;
  id: string;
  meeting_id: string | null;
  hash: string;
  prev_hash: string;
  envelope: unknown;
}

interface PersonDbRow {
  meeting_id: string;
  person_id: string;
  display_name: string;
  organisation: string | null;
  key_id: string;
  source_seq: string | number;
}

function safeSeq(value: string | number): number | undefined {
  const seq = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(seq) && seq > 0 ? seq : undefined;
}

/** Refuse a service login that can mutate old facts or own the schema. */
export async function assertRuntimePrivileges(pool: Pool, requireTables = true): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const role = await client.query<{
      rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean;
      schema_owner_member: boolean; schema_create: boolean; database_create: boolean;
    }>(`SELECT r.rolsuper, r.rolcreaterole, r.rolcreatedb,
       pg_has_role(r.oid, n.nspowner, 'MEMBER') AS schema_owner_member,
       has_schema_privilege(r.oid, n.oid, 'CREATE') AS schema_create,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS database_create
       FROM pg_catalog.pg_roles r
       JOIN pg_catalog.pg_namespace n ON n.nspname = current_schema()
       WHERE r.rolname = current_user`);
    const flags = role.rows[0];
    if (!flags || Object.values(flags).some(Boolean)) throw new PostgresPersistenceError();

    const privileges = await client.query<{
      relname: string; can_select: boolean; can_insert: boolean; can_update: boolean;
      can_delete: boolean; can_truncate: boolean; can_references: boolean; can_trigger: boolean;
      owner_member: boolean;
    }>(`SELECT c.relname,
       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
       has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_references,
       has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger,
       pg_has_role(r.oid, c.relowner, 'MEMBER') AS owner_member
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_roles r ON r.rolname = current_user
       WHERE n.nspname = current_schema() AND c.relname IN ('events', 'persons', 'schema_migrations')`);
    if (requireTables && privileges.rows.length !== 3) throw new PostgresPersistenceError();
    for (const row of privileges.rows) {
      const expectedInsert = row.relname !== 'schema_migrations';
      if (!row.can_select || row.can_insert !== expectedInsert || row.can_update || row.can_delete ||
          row.can_truncate || row.can_references || row.can_trigger || row.owner_member) {
        throw new PostgresPersistenceError();
      }
    }
  } catch {
    throw new PostgresPersistenceError();
  } finally {
    client?.release();
  }
}

function personFromEvent(event: DomainEvent): PersonRow | undefined {
  if (event.type !== 'SpeakerRegistered') return undefined;
  const meetingId = event.meetingId;
  const personId = event.personId ?? event.subjectId;
  const displayName = event.payload.pii?.displayName ?? event.payload.displayName;
  const organisation = event.payload.pii?.organisation ?? event.payload.organisation;
  const keyId = event.payload.pii?.keyId ?? meetingId;
  if (!meetingId || !personId || !displayName || !keyId ||
      typeof meetingId !== 'string' || typeof personId !== 'string' ||
      typeof displayName !== 'string' || typeof keyId !== 'string' ||
      (organisation !== undefined && typeof organisation !== 'string')) {
    throw new PostgresIntegrityError(event.seq);
  }
  return {
    meetingId, personId, displayName, keyId, sourceSeq: event.seq,
    ...(organisation === undefined ? {} : { organisation }),
  };
}

function expectedPersons(events: readonly DomainEvent[]): Map<string, PersonRow> {
  const result = new Map<string, PersonRow>();
  for (const event of events) {
    const person = personFromEvent(event);
    if (person) result.set(`${person.meetingId}\0${person.personId}`, person);
  }
  return result;
}

/**
 * Load a fresh snapshot on the caller's transaction-bound client. The caller chooses the read
 * transaction isolation level; it must keep both SELECTs on one consistent snapshot.
 */
export async function loadPostgresSnapshot(client: PoolClient): Promise<PostgresSnapshot> {
  let eventRows: EventDbRow[];
  let personRows: PersonDbRow[];
  try {
    const eventResult = await client.query<EventDbRow>(
      'SELECT seq, id, meeting_id, hash, prev_hash, envelope FROM events ORDER BY seq',
    );
    const personResult = await client.query<PersonDbRow>(
      'SELECT meeting_id, person_id, display_name, organisation, key_id, source_seq FROM persons ORDER BY meeting_id, person_id',
    );
    eventRows = eventResult.rows;
    personRows = personResult.rows;
  } catch {
    throw new PostgresPersistenceError();
  }

  const events: DomainEvent[] = [];
  for (const [index, row] of eventRows.entries()) {
    const seq = index + 1;
    try {
      assertEventShape(row.envelope);
      const event = row.envelope;
      if (safeSeq(row.seq) !== seq || event.seq !== seq || row.id !== event.id ||
          row.meeting_id !== (event.meetingId ?? null) || row.hash !== event.hash ||
          row.prev_hash !== event.prevHash) {
        throw new PostgresIntegrityError(seq);
      }
      events.push(event);
    } catch {
      throw new PostgresIntegrityError(seq);
    }
  }
  try {
    verifyEventChain(events);
  } catch (error) {
    const match = error instanceof Error ? /Event seq (\d+)/.exec(error.message) : null;
    throw new PostgresIntegrityError(match ? Number(match[1]) : 1);
  }

  const expected = expectedPersons(events);
  const persons: PersonRow[] = [];
  const seen = new Set<string>();
  for (const row of personRows) {
    const key = `${row.meeting_id}\0${row.person_id}`;
    const person = expected.get(key);
    const seq = person?.sourceSeq ?? safeSeq(row.source_seq) ?? 1;
    if (!person || seen.has(key) || safeSeq(row.source_seq) !== person.sourceSeq ||
        row.display_name !== person.displayName || row.organisation !== (person.organisation ?? null) ||
        row.key_id !== person.keyId) {
      throw new PostgresIntegrityError(seq);
    }
    seen.add(key);
    persons.push(person);
  }
  for (const [key, person] of expected) {
    if (!seen.has(key)) throw new PostgresIntegrityError(person.sourceSeq);
  }
  return { events, persons };
}

/** Insert only the already stamped suffix; the caller commits or rolls back its transaction. */
export async function insertPostgresEvents(client: PoolClient, events: readonly DomainEvent[]): Promise<void> {
  for (const event of events) {
    try {
      assertEventShape(event);
      await client.query(
        'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId ?? null, event.hash, event.prevHash, JSON.stringify(event)],
      );
    } catch (error) {
      if (error instanceof PostgresIntegrityError) throw error;
      throw new PostgresPersistenceError();
    }
    const person = personFromEvent(event);
    if (person) {
      try {
        await client.query(
          'INSERT INTO persons (meeting_id, person_id, display_name, organisation, key_id, source_seq) VALUES ($1, $2, $3, $4, $5, $6)',
          [person.meetingId, person.personId, person.displayName, person.organisation ?? null,
            person.keyId, person.sourceSeq],
        );
      } catch {
        throw new PostgresPersistenceError();
      }
    }
  }
}
