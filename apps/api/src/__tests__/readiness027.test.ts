import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createApp } from '../app.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { req } from './helpers.ts';

const fixedTime = new Date('2026-09-27T10:00:00.000Z');
const ok = { status: 'ok' as const };

describe('slice 027 readiness contract', () => {
  it('serves exact /readyz without an actor and leaves business routes protected', async () => {
    const app = createApp({
      demoEnabled: true,
      clock: () => fixedTime,
      readiness: {
        clock: async () => ok,
        db: async () => ok,
        migrations: async () => ok,
      },
    });

    const ready = await req(app, 'GET', '/readyz');
    expect(ready.status).toBe(200);
    expect(ready.headers.get('X-Server-Time')).toBe(fixedTime.toISOString());
    expect(await ready.json()).toEqual({
      status: 'ready',
      checks: { clock: ok, db: ok, migrations: ok },
      serverTime: fixedTime.toISOString(),
    });
    expect((await req(app, 'GET', '/v1/meetings')).status).toBe(401);
    expect((await app.request('/v1/readyz')).status).toBe(401);
  });

  it('reports an unconfigured clock truthfully with only the contract code', async () => {
    const app = createApp({
      demoEnabled: true,
      clock: () => fixedTime,
      readiness: {
        clock: async () => ({ status: 'fail', code: 'not_configured' }),
        db: async () => ok,
        migrations: async () => ok,
      },
    });

    const response = await req(app, 'GET', '/readyz');
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Server-Time')).toBe(fixedTime.toISOString());
    expect(await response.json()).toEqual({
      status: 'not_ready',
      checks: {
        clock: { status: 'fail', code: 'not_configured' },
        db: ok,
        migrations: ok,
      },
      serverTime: fixedTime.toISOString(),
    });
  });

  it('reduces a driver failure to a fixed code without leaking credentials to response or logs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const app = createApp({
        demoEnabled: true,
        clock: () => fixedTime,
        readiness: {
          clock: async () => ok,
          db: async () => { throw new Error('postgres://secret:password@private-host.example/db'); },
          migrations: async () => ok,
        },
      });

      const response = await req(app, 'GET', '/readyz');
      const body = JSON.stringify(await response.json());
      expect(response.status).toBe(503);
      expect(body).toContain('unreachable');
      expect(body).not.toMatch(/secret|password|private-host/);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|password|private-host/);
    } finally {
      log.mockRestore();
    }
  });

  it('times out a hanging DB probe and answers /readyz within a bounded interval', async () => {
    const app = createApp({ demoEnabled: true, clock: () => fixedTime,
      readiness: {
        clock: async () => ok,
        db: () => new Promise<never>(() => undefined),
        migrations: async () => ok,
      },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    try {
      const response = await Promise.race([
        req(app, 'GET', '/readyz'),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('/readyz did not bound the DB probe')), 5_000);
        }),
      ]);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        status: 'not_ready', checks: { db: { status: 'fail', code: 'timeout' } },
      });
      expect(performance.now() - started).toBeLessThan(5_000);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, 6_000);

  it.skipIf(process.env['TEST_DATABASE_URL'] === undefined || process.env['TEST_RUNTIME_DATABASE_URL'] === undefined)(
    'reports a real pending migration through /readyz with the runtime login', async () => {
      const ownerUrl = process.env['TEST_DATABASE_URL'];
      const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
      const schema = `hv027_ready_${randomUUID().replaceAll('-', '')}`;
      const admin = new Pool({ connectionString: ownerUrl });
      const owner = new Pool({ connectionString: ownerUrl, options: `-c search_path=${schema}` });
      const runtime = new Pool({ connectionString: runtimeUrl, options: `-c search_path=${schema}` });
      try {
        await admin.query(`CREATE SCHEMA ${schema}`);
        await runMigrations(owner, { direction: 'up', runtimeRole: new URL(runtimeUrl!).username });
        await runMigrations(owner, { direction: 'down' });
        const response = await req(createApp({ demoEnabled: true, postgres: runtime, clock: () => fixedTime }),
          'GET', '/readyz');
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          checks: { db: { status: 'ok' }, migrations: { status: 'fail', code: 'migrations_pending' } },
        });
      } finally {
        await Promise.all([runtime.end(), owner.end()]);
        await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        await admin.end();
      }
    },
  );

  it.skipIf(process.env['TEST_DATABASE_URL'] === undefined)('reports a stopped real Postgres pool as unavailable', async () => {
    const pool = new Pool({ connectionString: process.env['TEST_DATABASE_URL'] });
    await pool.query('SELECT 1');
    await pool.end();
    const app = createApp({ demoEnabled: true, postgres: pool, clock: () => fixedTime });
    const response = await req(app, 'GET', '/readyz');
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: 'not_ready',
      checks: { db: { status: 'fail', code: 'unreachable' } },
    });
  });
});
