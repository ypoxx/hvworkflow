import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
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

/** Default of the per-query timer (slice 034a): above `statement_timeout` (5 s), below the request timeout. */
export const DEFAULT_QUERY_TIMEOUT_MS = 6_000;

/**
 * Raised by the service's own per-query timer (slice 034a). `pg@8.23.0` reports its `query_timeout` as a
 * plain `Error("Query read timeout")` without code or class, and message texts are never compared, so the
 * driver's option stays unset and this class is the tag.
 */
export class QueryTimeoutError extends Error {
  constructor() {
    super('Postgres query timed out.');
    this.name = 'QueryTimeoutError';
  }
}

/** SQLSTATE of `lock_timeout` (55P03) and `statement_timeout` (57014): the persistence is busy. */
function isBusyCode(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined;
  return code === '55P03' || code === '57014';
}

/**
 * Messages crossing the HTTP boundary must never include a DB diagnostic or an event payload. `busy` is
 * set from the SQLSTATE or from `QueryTimeoutError` (`instanceof`), never from a message text;
 * `queryTimeout` says the service's own timer fired, so the connection has to be discarded.
 */
export class PostgresPersistenceError extends Error {
  readonly busy: boolean;
  readonly queryTimeout: boolean;

  constructor(cause?: unknown) {
    super('Postgres persistence is unavailable.');
    this.name = 'PostgresPersistenceError';
    this.queryTimeout = cause instanceof QueryTimeoutError;
    this.busy = this.queryTimeout || isBusyCode(cause);
  }
}

/** Whether the connection that ran into this error must not go back to the pool. */
export function mustDiscardConnection(error: unknown): boolean {
  return error instanceof QueryTimeoutError || (error instanceof PostgresPersistenceError && error.queryTimeout);
}

/** Whether the error means "persistence busy" (503) rather than "unavailable" (500). */
export function isPersistenceBusy(error: unknown): boolean {
  return error instanceof QueryTimeoutError || isBusyCode(error) ||
    (error instanceof PostgresPersistenceError && error.busy);
}

type Queryable = Pick<Pool | PoolClient, 'query'>;

/**
 * One query with its own timer. The pending driver promise is swallowed after the timer won, so a late
 * rejection is not an unhandled one; the caller discards the connection (`client.release(error)`).
 */
export async function timedQuery<R extends QueryResultRow = QueryResultRow>(
  target: Queryable, timeoutMs: number, text: string, values?: unknown[],
): Promise<QueryResult<R>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = (target.query as (t: string, v?: unknown[]) => Promise<QueryResult<R>>)
    .call(target, text, values);
  pending.catch(() => undefined);
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new QueryTimeoutError()), timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * A query on a pooled connection of its own, with the timer; after a timer expiry the connection is
 * destroyed instead of returned (the hanging statement dies with it).
 */
export async function pooledQuery<R extends QueryResultRow = QueryResultRow>(
  pool: Pool, timeoutMs: number, text: string, values?: unknown[],
): Promise<QueryResult<R>> {
  const client = await pool.connect();
  let result: QueryResult<R>;
  try {
    result = await timedQuery<R>(client, timeoutMs, text, values);
  } catch (error) {
    client.release(mustDiscardConnection(error) ? (error as Error) : undefined);
    throw error;
  }
  client.release();
  return result;
}

/**
 * A view of the pool for helpers that open a connection and query it themselves (`getMigrationStatus`,
 * `assertRuntimePrivileges`): every query on it runs under the service's timer, and a connection on which the
 * timer fired is destroyed on `release()` instead of returned to the pool.
 */
export function withQueryTimers(pool: Pool, timeoutMs: number): Pool {
  return {
    connect: async () => {
      const client = await pool.connect();
      let expired: Error | undefined;
      return new Proxy(client, {
        get(target, property) {
          if (property === 'query') {
            return async (...args: unknown[]) => {
              try {
                return await timedQuery(target, timeoutMs, args[0] as string, args[1] as unknown[] | undefined);
              } catch (error) {
                if (mustDiscardConnection(error)) expired = error as Error;
                throw error;
              }
            };
          }
          if (property === 'release') return (error?: Error | boolean) => target.release(error ?? expired);
          const value = Reflect.get(target, property) as unknown;
          return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}

/** Runs any promise against the per-query timer (for helpers that open their own connection). */
export async function withQueryTimer<T>(run: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  run.catch(() => undefined);
  try {
    return await Promise.race([
      run,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new QueryTimeoutError()), timeoutMs); }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
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
       WHERE n.nspname = current_schema() AND c.relname IN
         ('events', 'persons', 'schema_migrations', 'auth_login_states', 'auth_sessions',
          'auth_logout_ids', 'auth_subject_blocks')`);
    if (requireTables && privileges.rows.length !== 7) throw new PostgresPersistenceError();
    for (const row of privileges.rows) {
      const expectedSelect = row.relname !== 'auth_logout_ids';
      const expectedInsert = row.relname !== 'schema_migrations';
      const expectedUpdate = false;
      if (row.can_select !== expectedSelect || row.can_insert !== expectedInsert || row.can_update !== expectedUpdate || row.can_delete ||
          row.can_truncate || row.can_references || row.can_trigger || row.owner_member) {
        throw new PostgresPersistenceError();
      }
    }
    const columns = await client.query<{ relname: string; attname: string; can_update: boolean }>(
      `SELECT c.relname, a.attname,
         has_column_privilege(current_user, c.oid, a.attname, 'UPDATE') AS can_update
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE n.nspname = current_schema() AND c.relname IN ('auth_login_states', 'auth_sessions')`,
    );
    if (requireTables && columns.rows.length === 0) throw new PostgresPersistenceError();
    const writable = new Set(['auth_login_states.consumed_at', 'auth_sessions.idle_expires_at',
      'auth_sessions.revoked_at']);
    for (const row of columns.rows) {
      if (row.can_update !== writable.has(`${row.relname}.${row.attname}`)) {
        throw new PostgresPersistenceError();
      }
    }
    // Slice 034a (SC-08): the one named exception to "no DELETE" is EXECUTE on the bounded purge function.
    // Without `requireTables` (readiness before the migration) an absent function is not an error.
    const purge = await client.query<{ can_execute: boolean }>(
      `SELECT has_function_privilege(current_user, p.oid, 'EXECUTE') AS can_execute
       FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = current_schema() AND p.proname = 'auth_purge_login_states'`,
    );
    if (purge.rows.length > 1 || (requireTables && purge.rows.length !== 1) ||
        purge.rows.some((row) => !row.can_execute)) {
      throw new PostgresPersistenceError();
    }
  } catch (error) {
    // Keep the cause class only (`busy`, `queryTimeout`), never its text: a timer or lock timeout is a 503.
    throw error instanceof PostgresPersistenceError ? error : new PostgresPersistenceError(error);
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
export async function loadPostgresSnapshot(
  client: PoolClient, queryTimeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<PostgresSnapshot> {
  let eventRows: EventDbRow[];
  let personRows: PersonDbRow[];
  try {
    const eventResult = await timedQuery<EventDbRow>(client, queryTimeoutMs,
      'SELECT seq, id, meeting_id, hash, prev_hash, envelope FROM events ORDER BY seq',
    );
    const personResult = await timedQuery<PersonDbRow>(client, queryTimeoutMs,
      'SELECT meeting_id, person_id, display_name, organisation, key_id, source_seq FROM persons ORDER BY meeting_id, person_id',
    );
    eventRows = eventResult.rows;
    personRows = personResult.rows;
  } catch (error) {
    throw new PostgresPersistenceError(error);
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
export async function insertPostgresEvents(
  client: PoolClient, events: readonly DomainEvent[], queryTimeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<void> {
  for (const event of events) {
    try {
      assertEventShape(event);
      await timedQuery(client, queryTimeoutMs,
        'INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [event.seq, event.id, event.meetingId ?? null, event.hash, event.prevHash, JSON.stringify(event)],
      );
    } catch (error) {
      if (error instanceof PostgresIntegrityError) throw error;
      throw new PostgresPersistenceError(error);
    }
    const person = personFromEvent(event);
    if (person) {
      try {
        await timedQuery(client, queryTimeoutMs,
          'INSERT INTO persons (meeting_id, person_id, display_name, organisation, key_id, source_seq) VALUES ($1, $2, $3, $4, $5, $6)',
          [person.meetingId, person.personId, person.displayName, person.organisation ?? null,
            person.keyId, person.sourceSeq],
        );
      } catch (error) {
        throw new PostgresPersistenceError(error);
      }
    }
  }
}
