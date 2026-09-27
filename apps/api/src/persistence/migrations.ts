import { readFile } from 'node:fs/promises';
import type { Pool, PoolClient } from 'pg';

const migrations = [
  { version: 1, name: '0001_event_log' },
  { version: 2, name: '0002_auth' },
] as const;

const latestVersion = migrations.at(-1)!.version;

export interface MigrationStatus {
  currentVersion: number;
  latestVersion: number;
  pending: boolean;
}

export interface MigrationOptions {
  direction: 'up' | 'down';
  /** The separate login used by the running service, never the migration owner. */
  runtimeRole?: string;
}

function quoteIdentifier(value: string): string {
  if (!value || value.includes('\0') || Buffer.byteLength(value, 'utf8') > 63) {
    throw new Error('Invalid PostgreSQL identifier in migration configuration.');
  }
  return `"${value.replaceAll('"', '""')}"`;
}

async function currentSchema(client: PoolClient): Promise<{ name: string; quoted: string }> {
  const result = await client.query<{ schema_name: string | null }>(
    'SELECT current_schema() AS schema_name',
  );
  const name = result.rows[0]?.schema_name;
  if (!name) throw new Error('Migration search_path has no writable schema.');
  return { name, quoted: quoteIdentifier(name) };
}

async function tableExists(client: PoolClient, schema: string, table: string): Promise<boolean> {
  const result = await client.query<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_catalog.pg_class AS c
       JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind IN ('r', 'p')
     ) AS present`,
    [schema, table],
  );
  return result.rows[0]?.present === true;
}

async function appliedVersions(client: PoolClient, schema: { name: string; quoted: string }): Promise<number[]> {
  if (!await tableExists(client, schema.name, 'schema_migrations')) return [];
  const result = await client.query<{ version: number }>(
    `SELECT version FROM ${schema.quoted}.schema_migrations ORDER BY version`,
  );
  const versions = result.rows.map((row) => row.version);
  for (const version of versions) {
    if (!migrations.some((migration) => migration.version === version)) {
      throw new Error(`Unknown migration version ${version}.`);
    }
  }
  for (let index = 0; index < versions.length; index += 1) {
    if (versions[index] !== migrations[index]?.version) {
      throw new Error('Migration history is incomplete.');
    }
  }
  return versions;
}

async function assertSchemaConsistent(
  client: PoolClient,
  schema: { name: string; quoted: string },
  versions: readonly number[],
): Promise<void> {
  const [events, persons] = await Promise.all([
    tableExists(client, schema.name, 'events'),
    tableExists(client, schema.name, 'persons'),
  ]);
  if (versions.includes(1) !== (events && persons) || events !== persons) {
    throw new Error('Migration schema and history disagree.');
  }
  const authTables = await Promise.all(['auth_login_states', 'auth_sessions', 'auth_logout_ids',
    'auth_subject_blocks'].map((table) => tableExists(client, schema.name, table)));
  if (authTables.some((present) => present !== versions.includes(2))) {
    throw new Error('Auth migration schema and history disagree.');
  }
}

async function readMigration(name: string, direction: 'up' | 'down', schema: string): Promise<string> {
  const url = new URL(`../../migrations/${name}.${direction}.sql`, import.meta.url);
  const sql = await readFile(url, 'utf8');
  return sql.replaceAll('{{schema}}', schema);
}

async function grantRuntimeAccess(
  client: PoolClient,
  schema: { name: string; quoted: string },
  runtimeRole: string,
): Promise<void> {
  const quotedRole = quoteIdentifier(runtimeRole);
  const role = await client.query<{
    oid: number; rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean;
  }>(
    'SELECT oid, rolsuper, rolcreaterole, rolcreatedb FROM pg_catalog.pg_roles WHERE rolname = $1',
    [runtimeRole],
  );
  const owner = await client.query<{ owner_oid: number }>(
    'SELECT nspowner AS owner_oid FROM pg_catalog.pg_namespace WHERE nspname = $1',
    [schema.name],
  );
  if (!role.rows[0] || !owner.rows[0]) throw new Error('Configured runtime database role is unavailable.');
  const inherited = await client.query<{ member: boolean }>(
    "SELECT pg_has_role($1::oid, $2::oid, 'MEMBER') AS member",
    [role.rows[0].oid, owner.rows[0].owner_oid],
  );
  if (role.rows[0].rolsuper || role.rows[0].rolcreaterole || role.rows[0].rolcreatedb
    || inherited.rows[0]?.member) {
    throw new Error('Runtime database role must not own or inherit the migration schema.');
  }

  await client.query(`REVOKE CREATE ON SCHEMA ${schema.quoted} FROM PUBLIC`);
  await client.query(`GRANT USAGE ON SCHEMA ${schema.quoted} TO ${quotedRole}`);
  for (const table of ['events', 'persons', 'schema_migrations', 'auth_login_states',
    'auth_sessions', 'auth_logout_ids', 'auth_subject_blocks']) {
    await client.query(`REVOKE ALL ON TABLE ${schema.quoted}.${table} FROM PUBLIC`);
    await client.query(`REVOKE ALL ON TABLE ${schema.quoted}.${table} FROM ${quotedRole}`);
  }
  await client.query(
    `GRANT SELECT, INSERT ON TABLE ${schema.quoted}.events, ${schema.quoted}.persons TO ${quotedRole}`,
  );
  await client.query(`GRANT SELECT ON TABLE ${schema.quoted}.schema_migrations TO ${quotedRole}`);
  await client.query(
    `GRANT SELECT, INSERT, UPDATE ON TABLE ${schema.quoted}.auth_login_states,
       ${schema.quoted}.auth_sessions TO ${quotedRole}`,
  );
  await client.query(
    `GRANT INSERT ON TABLE ${schema.quoted}.auth_logout_ids TO ${quotedRole}`,
  );
  await client.query(`GRANT SELECT, INSERT ON TABLE ${schema.quoted}.auth_subject_blocks TO ${quotedRole}`);

  const privileges = await client.query<{
    can_create: boolean; can_update_events: boolean; can_delete_events: boolean;
    can_truncate_events: boolean; can_update_persons: boolean; can_delete_persons: boolean;
    can_truncate_persons: boolean; can_insert_migrations: boolean;
    can_update_migrations: boolean; can_delete_migrations: boolean;
    can_truncate_migrations: boolean;
  }>(
    `SELECT
       has_schema_privilege($1, $2, 'CREATE') AS can_create,
       has_table_privilege($1, $3, 'UPDATE') AS can_update_events,
       has_table_privilege($1, $3, 'DELETE') AS can_delete_events,
       has_table_privilege($1, $3, 'TRUNCATE') AS can_truncate_events,
       has_table_privilege($1, $4, 'UPDATE') AS can_update_persons,
       has_table_privilege($1, $4, 'DELETE') AS can_delete_persons,
       has_table_privilege($1, $4, 'TRUNCATE') AS can_truncate_persons,
       has_table_privilege($1, $5, 'INSERT') AS can_insert_migrations,
       has_table_privilege($1, $5, 'UPDATE') AS can_update_migrations,
       has_table_privilege($1, $5, 'DELETE') AS can_delete_migrations,
       has_table_privilege($1, $5, 'TRUNCATE') AS can_truncate_migrations`,
    [
      runtimeRole, schema.name, `${schema.quoted}.events`, `${schema.quoted}.persons`,
      `${schema.quoted}.schema_migrations`,
    ],
  );
  if (Object.values(privileges.rows[0] ?? {}).some(Boolean)) {
    throw new Error('Runtime database role has forbidden schema or table privileges.');
  }
}

/** A read-only status check for the readiness probe. Unknown or inconsistent state is an error. */
export async function getMigrationStatus(pool: Pool): Promise<MigrationStatus> {
  const client = await pool.connect();
  try {
    const schema = await currentSchema(client);
    const versions = await appliedVersions(client, schema);
    await assertSchemaConsistent(client, schema, versions);
    const currentVersion = versions.at(-1) ?? 0;
    return { currentVersion, latestVersion, pending: currentVersion < latestVersion };
  } finally {
    client.release();
  }
}

/** Run versioned SQL only through the migration login. Every step is atomic in the selected schema. */
export async function runMigrations(pool: Pool, options: MigrationOptions): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const schema = await currentSchema(client);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hv-migration:${schema.name}`]);

    if (options.direction === 'up') {
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${schema.quoted}.schema_migrations (
           version integer PRIMARY KEY,
           applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      );
    }
    const versions = await appliedVersions(client, schema);
    await assertSchemaConsistent(client, schema, versions);

    if (options.direction === 'up') {
      for (const migration of migrations) {
        if (versions.includes(migration.version)) continue;
        await client.query(await readMigration(migration.name, 'up', schema.quoted));
        await client.query(
          `INSERT INTO ${schema.quoted}.schema_migrations (version) VALUES ($1)`,
          [migration.version],
        );
      }
      const runtimeRole = options.runtimeRole ?? process.env['HV_DB_RUNTIME_ROLE'];
      if (runtimeRole) await grantRuntimeAccess(client, schema, runtimeRole);
    } else if (options.direction === 'down') {
      for (const migration of [...migrations].reverse()) {
        if (!versions.includes(migration.version)) continue;
        // Lock before checking: another writer cannot insert between the emptiness check and DROP.
        const tables = migration.version === 2
          ? ['auth_login_states', 'auth_sessions', 'auth_logout_ids', 'auth_subject_blocks']
          : ['events', 'persons'];
        await client.query(`LOCK TABLE ${tables.map((table) => `${schema.quoted}.${table}`).join(', ')} IN ACCESS EXCLUSIVE MODE`);
        const contents = await client.query<{ populated: boolean }>(
          `SELECT ${tables.map((table) => `EXISTS (SELECT 1 FROM ${schema.quoted}.${table})`).join(' OR ')} AS populated`,
        );
        if (contents.rows[0]?.populated) {
          throw new Error('Refusing destructive down migration while data is populated.');
        }
        await client.query(await readMigration(migration.name, 'down', schema.quoted));
        await client.query(
          `DELETE FROM ${schema.quoted}.schema_migrations WHERE version = $1`,
          [migration.version],
        );
      }
    } else {
      throw new Error('Unknown migration direction.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
