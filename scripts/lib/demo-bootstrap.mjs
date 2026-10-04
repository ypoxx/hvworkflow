/**
 * The bootstrap of the demo corpus and the role assignments (slice 031a built it in `scripts/e2e-http-031.mjs`, slice
 * 037a moved it here with `persons` as a parameter). It writes past the administration path, as the migration owner,
 * and is meant only for an empty event log: the e2e harness (a fresh database per run) and the one-off fill of the
 * local stack (`scripts/stack-seed.mjs`, which refuses a non-empty log).
 *
 * The TypeScript of the service and the domain is imported lazily, so this file loads without the tsx loader; calling
 * `bootstrap` needs it.
 */
import { randomUUID } from 'node:crypto';

/** The corpus of the demo, then one role assignment per person, stamped by an in-memory core and written in one transaction. */
export async function bootstrap({ Pool, ownerUrl, issuer, users, persons }) {
  const { actorIdForIdentity } = await import('../../apps/api/src/auth/oidc.ts');
  const { insertPostgresEvents } = await import('../../apps/api/src/persistence/postgres.ts');
  const { CORPUS_DEMO, SYSTEM_ACTOR, createInMemoryEventStore, createInProcessApi, seedEvents } =
    await import('../../packages/domain/src/index.ts');
  const store = createInMemoryEventStore();
  const domain = createInProcessApi({ store, actor: () => SYSTEM_ACTOR, clock: () => new Date(),
    idGenerator: randomUUID, seeder: seedEvents });
  await domain.seedDemo({ questions: CORPUS_DEMO.questions, roundSizes: CORPUS_DEMO.roundSizes, seed: CORPUS_DEMO.seed });
  const actorIds = {};
  for (const person of persons) {
    actorIds[person.key] = actorIdForIdentity(issuer, users[person.key].id);
    if (person.role === undefined) continue;
    await domain.assignRole({ subjectId: actorIds[person.key], role: person.role,
      ...(person.unitId !== undefined ? { unitId: person.unitId } : {}) });
  }
  const owner = new Pool({ connectionString: ownerUrl, connectionTimeoutMillis: 5_000, max: 1 });
  const db = await owner.connect();
  try {
    await db.query('BEGIN');
    await insertPostgresEvents(db, store.all(), 60_000);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
    await owner.end();
  }
  return actorIds;
}
