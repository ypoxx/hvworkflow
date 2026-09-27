import { Pool } from 'pg';
import { assertRuntimePrivileges } from '../persistence/postgres.ts';

const actorId = process.argv[2];
const databaseUrl = process.env['HV_DATABASE_URL'];

if (!databaseUrl || !actorId || !/^oidc_[A-Za-z0-9_-]{43}$/.test(actorId)) {
  console.error('Usage: HV_DATABASE_URL=... tsx src/auth/subject-block-cli.ts oidc_<actor-id>');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000,
    ...(process.env['HV_DB_TLS'] === '1' ? { ssl: { rejectUnauthorized: true } } : {}) });
  try {
    await assertRuntimePrivileges(pool);
    await pool.query('INSERT INTO auth_subject_blocks (actor_id, blocked_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [actorId, new Date()]);
    console.log('Auth subject blocked.');
  } catch {
    // Neither database diagnostics nor the actor id belong in operational output.
    console.error('Auth subject block failed.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
