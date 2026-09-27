import { Pool } from 'pg';
import { runMigrations } from './migrations.ts';

const direction = process.argv[2];
const url = process.env['HV_MIGRATION_DATABASE_URL'];
const runtimeRole = process.env['HV_DB_RUNTIME_ROLE'];

if ((direction !== 'up' && direction !== 'down') || !url || (direction === 'up' && !runtimeRole)) {
  console.error('Usage: HV_MIGRATION_DATABASE_URL=... HV_DB_RUNTIME_ROLE=... pnpm --filter @hv/api db:migrate up|down');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2_000,
    ...(process.env['HV_DB_TLS'] === '1' ? { ssl: { rejectUnauthorized: true } } : {}) });
  try {
    await runMigrations(pool, { direction, ...(runtimeRole ? { runtimeRole } : {}) });
    console.log(`Postgres migration ${direction} completed.`);
  } catch {
    // Database errors may include hostnames, SQL, or credentials. Operational logs stay fixed.
    console.error('Postgres migration failed.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
