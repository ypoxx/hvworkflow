import { createHash } from 'node:crypto';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { assertEventShape, sealVerifiedLog, verifiedEventCount, type DomainEvent, type VerifiedEventLog } from '@hv/domain';
import { createEntry, decide, extendEntry, type ChainCache, type ChainCacheEntry, type ChainDecision } from './chainCache.ts';

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
  /** Sealed by the domain (`sealVerifiedLog`): verified, frozen, and loaded by the store without a second check. */
  events: VerifiedEventLog;
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

/**
 * An event row as text (takt-033): the envelope arrives as `envelope::text` and is parsed here, so the row digest
 * is computed over exactly the bytes the event was parsed from (the driver's jsonb parser is `JSON.parse` as well).
 */
interface EventDbRow {
  seq: string;
  id: string;
  meeting_id: string | null;
  hash: string;
  prev_hash: string;
  envelope: string;
}

// The output alias `seq` is text: every ORDER BY and WHERE below names `events.seq` (the bigint) explicitly.
const EVENT_COLUMNS = 'events.seq::text AS seq, id, meeting_id, hash, prev_hash, envelope::text AS envelope';
const PERSONS_SQL = 'SELECT meeting_id, person_id, display_name, organisation, key_id, source_seq FROM persons ORDER BY meeting_id, person_id';

/**
 * Injective row encoding shared by Postgres and Node: every column checked by the loader, each as
 * `<UTF-8 byte length>:<text>` or `N` for NULL, in a fixed order; the row digest is sha256 over it.
 */
const ROW_FIELDS = ['seq::text', 'id', 'meeting_id', 'hash', 'prev_hash', 'envelope::text'] as const;
const ROW_DIGEST_SQL = `sha256(convert_to(${ROW_FIELDS.map((field) =>
  `coalesce(octet_length(convert_to(${field}, 'UTF8'))::text || ':' || ${field}, 'N')`).join(' || ')}, 'UTF8'))`;

function encodeField(value: string | null): string {
  return value === null ? 'N' : `${Buffer.byteLength(value, 'utf8')}:${value}`;
}

function rowDigest(row: EventDbRow): string {
  const text = [row.seq, row.id, row.meeting_id, row.hash, row.prev_hash, row.envelope].map(encodeField).join('');
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * One statement, so one snapshot: row count, highest seq, and the digest over all rows up to the checkpoint
 * (sha256 over the concatenated row digests in seq order; the same as `prefixDigest` in `chainCache.ts`).
 */
const PROBE_SQL = `SELECT count(*)::text AS count, coalesce(max(seq), 0)::text AS max_seq,
  encode(sha256(coalesce(string_agg(${ROW_DIGEST_SQL}, ''::bytea ORDER BY events.seq) FILTER (WHERE events.seq <= $1), ''::bytea)), 'hex') AS digest
  FROM events`;

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

/** Row checks of every loaded event (shape, index columns against the envelope, seq without gaps from `firstSeq`). */
function parseEventRows(rows: readonly EventDbRow[], firstSeq: number): { events: DomainEvent[]; digests: string[] } {
  const events: DomainEvent[] = [];
  const digests: string[] = [];
  for (const [index, row] of rows.entries()) {
    const seq = firstSeq + index;
    try {
      const envelope: unknown = JSON.parse(row.envelope);
      assertEventShape(envelope);
      const event = envelope;
      if (safeSeq(row.seq) !== seq || event.seq !== seq || row.id !== event.id ||
          row.meeting_id !== (event.meetingId ?? null) || row.hash !== event.hash ||
          row.prev_hash !== event.prevHash) {
        throw new PostgresIntegrityError(seq);
      }
      events.push(event);
      digests.push(rowDigest(row));
    } catch {
      throw new PostgresIntegrityError(seq);
    }
  }
  return { events, digests };
}

/** Seal (verify and freeze) through the domain; returns the log and how many events were hashed doing so. */
function sealChecked(prefix: VerifiedEventLog | undefined, suffix: DomainEvent[]): { log: VerifiedEventLog; hashed: number } {
  const before = verifiedEventCount();
  try {
    return { log: sealVerifiedLog(prefix, suffix), hashed: verifiedEventCount() - before };
  } catch (error) {
    const match = error instanceof Error ? /Event seq (\d+)/.exec(error.message) : null;
    throw new PostgresIntegrityError(match ? Number(match[1]) : (prefix?.length ?? 0) + 1);
  }
}

function addExpectedPersons(target: Map<string, PersonRow>, events: readonly DomainEvent[]): Map<string, PersonRow> {
  for (const event of events) {
    const person = personFromEvent(event);
    if (person) target.set(`${person.meetingId}\0${person.personId}`, person);
  }
  return target;
}

/** Every stored person row must be exactly one expected row, and every expected row must be stored. */
function comparePersons(expected: ReadonlyMap<string, PersonRow>, personRows: readonly PersonDbRow[]): PersonRow[] {
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
  return persons;
}

interface FullLoad extends PostgresSnapshot {
  rowsRead: number;
  rowDigests: string[];
  expected: Map<string, PersonRow>;
  hashed: number;
}

async function loadFull(client: PoolClient, queryTimeoutMs: number): Promise<FullLoad> {
  let eventRows: EventDbRow[];
  let personRows: PersonDbRow[];
  try {
    eventRows = (await timedQuery<EventDbRow>(client, queryTimeoutMs, `SELECT ${EVENT_COLUMNS} FROM events ORDER BY events.seq`)).rows;
    personRows = (await timedQuery<PersonDbRow>(client, queryTimeoutMs, PERSONS_SQL)).rows;
  } catch (error) {
    throw new PostgresPersistenceError(error);
  }
  const { events, digests } = parseEventRows(eventRows, 1);
  const { log, hashed } = sealChecked(undefined, events);
  const expected = addExpectedPersons(new Map(), log);
  const persons = comparePersons(expected, personRows);
  return { events: log, persons, rowsRead: eventRows.length, rowDigests: digests, expected, hashed };
}

/**
 * Load a fresh snapshot on the caller's transaction-bound client and check all of it (the full path). The caller
 * chooses the read transaction isolation level; it must keep both SELECTs on one consistent snapshot.
 */
export async function loadPostgresSnapshot(
  client: PoolClient, queryTimeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<PostgresSnapshot> {
  const { events, persons } = await loadFull(client, queryTimeoutMs);
  return { events, persons };
}

export interface ChainLoad {
  snapshot: PostgresSnapshot;
  /** Events whose hash was recomputed by this load (0 on a warm read without new events). */
  hashed: number;
  /** Event rows this load read into the service (k on a warm read with k new events; all on a full load). */
  rowsRead: number;
  /**
   * The cached history no longer matches the database (prefix changed, or rows vanished) and the full check still
   * found a valid chain: a restore or a rewrite. Open owner question 1, default (b): accepted, reported by the caller.
   */
  historyChanged: boolean;
}

/**
 * takt-033: the snapshot through the per-app chain cache. Reads the cache before the first statement it sends, so
 * the transaction's snapshot is never older than the entry it starts from (callers must not have read `events` in
 * this transaction before). Incremental only when the database reports an unchanged, gap-free prefix at the cached
 * end (`decide`); then only newer rows are read and hashed, and all person rows are compared as before. Any deviation
 * runs the full path; an integrity error there empties the cache and propagates unchanged. The cache moves only
 * from database data verified here, by compare-and-swap; the caller's own new events never enter it directly.
 */
export async function loadPostgresSnapshotCached(
  client: PoolClient, cache: ChainCache, queryTimeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<ChainLoad> {
  const base = cache.current();
  let decision: ChainDecision = { kind: 'full', reason: 'empty' };
  if (base !== undefined) {
    const end = base.checkpoints.at(-1)!;
    let probe: { count: string; max_seq: string; digest: string } | undefined;
    try {
      probe = (await timedQuery<{ count: string; max_seq: string; digest: string }>(client, queryTimeoutMs, PROBE_SQL,
        [end.seq])).rows[0];
    } catch (error) {
      throw new PostgresPersistenceError(error);
    }
    decision = probe === undefined ? { kind: 'full', reason: 'digest' }
      : decide(base, { count: Number(probe.count), maxSeq: Number(probe.max_seq), checkpointSeq: end.seq, digest: probe.digest });
    if (decision.kind === 'incremental') {
      const incremental = await loadSuffix(client, cache, base, Number(probe!.max_seq), queryTimeoutMs);
      if (incremental !== undefined) return incremental;
    }
  }
  let full: FullLoad;
  try {
    full = await loadFull(client, queryTimeoutMs);
  } catch (error) {
    if (error instanceof PostgresIntegrityError) cache.invalidate();
    throw error;
  }
  cache.compareAndSet(base, createEntry(full.events, full.rowDigests, full.expected));
  return {
    snapshot: { events: full.events, persons: full.persons },
    hashed: full.hashed,
    rowsRead: full.rowsRead,
    historyChanged: base !== undefined && (
      (decision.kind === 'full' && (decision.reason === 'shortened' || decision.reason === 'digest')) ||
      // Review finding 2: the probe may have passed (a write under READ COMMITTED sees each statement on a new
      // snapshot) and the prefix vanished or changed before the next statement. Judge the verified result itself.
      !continuesCachedEnd(full.events, base)),
  };
}

/** Whether a verified log still contains the cached end unchanged (same hash at the cached end seq). */
function continuesCachedEnd(log: VerifiedEventLog, base: ChainCacheEntry): boolean {
  const end = base.checkpoints.at(-1)!;
  return log.length >= end.seq && (end.seq === 0 || log[end.seq - 1]?.hash === end.lastHash);
}

/** The incremental path; `undefined` means "deviation, check in full" (never an answer from unchecked data). */
async function loadSuffix(
  client: PoolClient, cache: ChainCache, base: ChainCacheEntry, maxSeq: number, queryTimeoutMs: number,
): Promise<ChainLoad | undefined> {
  let eventRows: EventDbRow[];
  let personRows: PersonDbRow[];
  try {
    eventRows = (await timedQuery<EventDbRow>(client, queryTimeoutMs,
      `SELECT ${EVENT_COLUMNS} FROM events WHERE events.seq > $1 ORDER BY events.seq`, [base.log.length])).rows;
    personRows = (await timedQuery<PersonDbRow>(client, queryTimeoutMs, PERSONS_SQL)).rows;
  } catch (error) {
    throw new PostgresPersistenceError(error);
  }
  try {
    const { events, digests } = parseEventRows(eventRows, base.log.length + 1);
    const { log, hashed } = events.length === 0 ? { log: base.log, hashed: 0 } : sealChecked(base.log, events);
    // Under READ COMMITTED (writes) the suffix is a later statement than the probe; fewer rows means rows vanished.
    if (log.length < maxSeq) return undefined;
    const expected = events.some((event) => event.type === 'SpeakerRegistered')
      ? addExpectedPersons(new Map(base.persons), events) : base.persons;
    const persons = comparePersons(expected, personRows);
    if (events.length > 0) {
      const next = extendEntry(base, log, [...base.rowDigests, ...digests], expected);
      cache.compareAndSet(base, next);
    }
    return { snapshot: { events: log, persons }, hashed, rowsRead: eventRows.length, historyChanged: false };
  } catch (error) {
    if (error instanceof PostgresIntegrityError) return undefined;
    throw error;
  }
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
