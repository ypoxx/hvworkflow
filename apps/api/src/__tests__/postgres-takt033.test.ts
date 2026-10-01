/**
 * takt-033: the per-app chain cache against a real Postgres. Every request goes to the SAME, previously warmed
 * app, so a manipulation after the cache was filled is what is being tested (postgres027 covers fresh apps).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import {
  CORPUS_LOAD, createInMemoryEventStore, createInProcessApi, seedEvents, SYSTEM_ACTOR, type DomainEvent, type NewEvent,
} from '@hv/domain';
import { createApp, type CreateAppOptions } from '../app.ts';
import { actorIdForIdentity, type OidcFlow } from '../auth/oidc.ts';
import { createAuthStore } from '../auth/store.ts';
import { createChainCache } from '../persistence/chainCache.ts';
import { runMigrations } from '../persistence/migrations.ts';
import { loadPostgresSnapshotCached } from '../persistence/postgres.ts';
import { ACTOR } from './helpers.ts';

const databaseUrl = process.env['TEST_DATABASE_URL'];
const runtimeUrl = process.env['TEST_RUNTIME_DATABASE_URL'];
const runtimeRole = runtimeUrl === undefined ? undefined : new URL(runtimeUrl).username;
const at = '2027-04-20T10:00:00.000Z';
const now = new Date('2027-04-20T10:15:00.000Z');
const actor = { id: 'fixture', role: 'admin' as const };
const meetingId = 'hv-2027';
const issuer = 'https://idp.example.invalid/realms/hv';
const sessionActorId = actorIdForIdentity(issuer, 'synthetic-user');
/** The fixed stderr line of open question 1 (b); it carries no content. */
const HISTORY_LINE = 'HV-Tool API: stored event history changed or was shortened; the valid chain was accepted.';
const SPEAKERS = 20;

let schema: string;
let owner: Pool;
let poolA: Pool;
let poolB: Pool;

interface ChainInfo { hashed: number; cachedSeq: number | undefined; rowsRead: number }

function scopedPool(connectionString: string | undefined, name: string, max = 5): Pool {
  return new Pool({ connectionString, options: `-c search_path=${schema}`, max, application_name: `${schema}_${name}` });
}

function speaker(index: number, prefix = 'Synthetische Person'): NewEvent {
  return {
    id: `speaker-${prefix.length}-${index}`, type: 'SpeakerRegistered', at, actor,
    subjectId: `speaker-${prefix.length}-${index}`, personId: `person-${prefix.length}-${index}`, meetingId,
    payload: { number: index, round: 1, position: index, pii: { keyId: meetingId, displayName: `${prefix} ${index}` } },
  } as NewEvent;
}

/** Meeting, start, 20 speakers (seq 3..22) and one role assignment for the session actor (seq 23). */
async function fixtureEvents(): Promise<readonly DomainEvent[]> {
  const store = createInMemoryEventStore();
  store.append([
    { id: 'create-2027', type: 'MeetingCreated', at, actor, subjectId: meetingId, meetingId,
      payload: { title: 'Synthetische HV', date: '2027-04-20', agendaItems: [], units: [] } },
    { id: 'start-2027', type: 'MeetingStarted', at, actor, subjectId: meetingId, meetingId, payload: {} },
  ] as NewEvent[]);
  store.append(Array.from({ length: SPEAKERS }, (_, index) => speaker(index + 1)));
  const domain = createInProcessApi({ store, actor: () => SYSTEM_ACTOR, meetingId, clock: () => new Date(at),
    idGenerator: () => 'assignment-1' });
  await domain.assignRole({ subjectId: sessionActorId, role: 'moderation' });
  return store.all();
}

/** Batched owner INSERTs of events and their person rows (setup, outside any measurement). */
async function insertEvents(events: readonly DomainEvent[]): Promise<void> {
  for (let offset = 0; offset < events.length; offset += 500) {
    const batch = events.slice(offset, offset + 500);
    const values = batch.flatMap((event) => [event.seq, event.id, event.meetingId, event.hash, event.prevHash,
      JSON.stringify(event)]);
    await owner.query(`INSERT INTO events (seq, id, meeting_id, hash, prev_hash, envelope) VALUES ${batch.map((_, index) =>
      `(${[1, 2, 3, 4, 5, 6].map((column) => `$${index * 6 + column}${column === 6 ? '::jsonb' : ''}`).join(', ')})`).join(', ')}`,
    values);
    const people = batch.filter((event) => event.type === 'SpeakerRegistered');
    if (people.length === 0) continue;
    const personValues = people.flatMap((event) => {
      const payload = event.payload as { pii?: { displayName: string; organisation?: string; keyId: string }; displayName?: string };
      return [event.meetingId, event.personId ?? event.subjectId, payload.pii?.displayName ?? payload.displayName,
        payload.pii?.organisation ?? null, payload.pii?.keyId ?? event.meetingId, event.seq];
    });
    await owner.query(`INSERT INTO persons (meeting_id, person_id, display_name, organisation, key_id, source_seq)
      VALUES ${people.map((_, index) => `(${[1, 2, 3, 4, 5, 6].map((column) => `$${index * 6 + column}`).join(', ')})`).join(', ')}`,
    personValues);
  }
}

async function storedEvents(): Promise<DomainEvent[]> {
  return (await owner.query<{ envelope: DomainEvent }>('SELECT envelope FROM events ORDER BY seq')).rows.map((row) => row.envelope);
}

/** Stamp new events onto the stored chain (as the service would) without inserting them. */
async function stampNext(events: NewEvent[], base?: readonly DomainEvent[]): Promise<DomainEvent[]> {
  const stored = base ?? await storedEvents();
  return createInMemoryEventStore({ load: () => [...stored], save: () => undefined }).append(events);
}

async function maxSeq(): Promise<number> {
  return Number((await owner.query<{ max: string }>('SELECT coalesce(max(seq), 0)::text AS max FROM events')).rows[0]!.max);
}

function app(pool: Pool, infos: ChainInfo[] = [], extra: Partial<CreateAppOptions> = {}) {
  let id = 0;
  return createApp({ demoEnabled: true, postgres: pool, clock: () => now, idGenerator: () => `gen-${++id}`,
    testHooks: { chain: (info) => { infos.push(info); } }, ...extra });
}

type TestApp = ReturnType<typeof app>;

async function speakers(instance: TestApp): Promise<Response> {
  return instance.request(`/v1/meetings/${meetingId}/speakers`, { headers: { 'X-Actor': ACTOR.admin } });
}

async function warm(instance: TestApp, infos: ChainInfo[]): Promise<void> {
  expect((await speakers(instance)).status).toBe(200);
  expect((await speakers(instance)).status).toBe(200);
  // The second request found the cache filled and hashed nothing again.
  expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: await maxSeq() });
}

async function expectIntegrityFailure(response: Response, seq: number, secrets: string[] = []): Promise<void> {
  expect(response.status).toBeGreaterThanOrEqual(500);
  const body = await response.text();
  expect(body).toMatch(new RegExp(`seq ${seq}\\b`, 'i'));
  for (const secret of ['Synthetische HV', 'Synthetische Person', ...secrets]) expect(body).not.toContain(secret);
}

/** A session-mode app (real Postgres auth store, synthetic IdP) and a signed-in session cookie for the role holder. */
async function sessionApp(pool: Pool, infos: ChainInfo[]): Promise<{ first: TestApp; cookie: string }> {
  const oidcFlow: OidcFlow = {
    async authorizationUrl({ state }) { return `https://idp.example.invalid/authorize?state=${state}`; },
    async complete() { return { issuer, subject: 'synthetic-user' }; },
  };
  const first = createApp({ demoEnabled: false, oidcIssuer: issuer, oidcFlow, authStore: createAuthStore(pool, randomBytes(32)),
    postgres: pool, clock: () => now, testHooks: { chain: (info) => { infos.push(info); } },
    transparencyNotice: { version: 'synthetic-1', text: { de: 'Testhinweis.', en: 'Test notice.' } } });
  const login = await first.request('/auth/login');
  const state = new URL(login.headers.get('Location')!).searchParams.get('state');
  const correlation = login.headers.getSetCookie().find((line) => line.startsWith('hv_auth_state='))!.split(';')[0]!;
  const callback = await first.request(`/auth/callback?code=synthetic-code&state=${state}`, { headers: { Cookie: correlation } });
  const cookie = callback.headers.getSetCookie().find((line) => line.startsWith('hv_session='))!.split(';')[0]!;
  return { first, cookie };
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
};

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('takt-033: chain cache on Postgres', () => {
  let end: number;

  beforeEach(async () => {
    schema = `hv033_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl, 'owner', 3);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    poolA = scopedPool(runtimeUrl, 'a');
    poolB = scopedPool(runtimeUrl, 'b');
    const fixture = await fixtureEvents();
    await insertEvents(fixture);
    end = fixture.length;
  });

  afterEach(async () => {
    await Promise.all([poolA?.end(), poolB?.end()]);
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
    vi.restoreAllMocks();
  });

  const tamper = (seq: string) => [
    ['envelope', `UPDATE events SET envelope = jsonb_set(envelope, '{subjectId}', '"tampered"') WHERE seq = ${seq}`],
    ['seq', `UPDATE events SET seq = 1000 + seq WHERE seq = ${seq}`],
    ['id', `UPDATE events SET id = 'different-index-id' WHERE seq = ${seq}`],
    ['meeting_id', `UPDATE events SET meeting_id = 'different-meeting' WHERE seq = ${seq}`],
    ['hash', `UPDATE events SET hash = repeat('0', 64) WHERE seq = ${seq}`],
    ['prev_hash', `UPDATE events SET prev_hash = repeat('0', 64) WHERE seq = ${seq}`],
  ] as const;

  it.each(tamper('2'))('refuses the next read of a warm app after the %s of an old row (seq 2) changed', async (_label, sql) => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    await owner.query(sql);
    await expectIntegrityFailure(await speakers(instance), 2, ['different-index-id', 'different-meeting']);
    // No "carry on with the cache" after an error: the next request checks in full and fails again.
    await expectIntegrityFailure(await speakers(instance), 2);
  });

  it.each(tamper('23'))('refuses the next read of a warm app after the %s of the row at the cached seq changed', async (_label, sql) => {
    expect(end).toBe(23);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    await owner.query(sql);
    await expectIntegrityFailure(await speakers(instance), 23, ['different-index-id', 'different-meeting']);
  });

  it('checks a shortened log in full, accepts a valid one with a fixed line and lowers the cache to the new seq', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    await owner.query('DELETE FROM persons WHERE source_seq > 12');
    await owner.query('DELETE FROM events WHERE seq > 12');
    const read = await speakers(instance);
    expect(read.status).toBe(200);
    expect(await read.json()).toHaveLength(10);
    expect(infos.at(-1)).toMatchObject({ hashed: 12, cachedSeq: 12 });
    const lines = errors.mock.calls.map((call) => call.join(' '));
    expect(lines).toEqual([HISTORY_LINE]);
    // The cache now ends at 12: one new event costs exactly one hash.
    await insertEvents(await stampNext([speaker(99, 'Nachgetragen')]));
    expect((await speakers(instance)).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 1, cachedSeq: 13 });
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('refuses a warm read when a row in the middle is missing (gap)', async () => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    await owner.query('DELETE FROM persons WHERE source_seq = 10');
    await owner.query('DELETE FROM events WHERE seq = 10');
    await expectIntegrityFailure(await speakers(instance), 10);
  });

  it('answers from the new chain, never from the cache, after an older database was restored and extended differently', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const kept = (await storedEvents()).slice(0, 12);
    await owner.query('DELETE FROM persons WHERE source_seq > 12');
    await owner.query('DELETE FROM events WHERE seq > 12');
    const replacement = await stampNext(Array.from({ length: 14 }, (_, index) => speaker(index + 1, 'Andere Person')), kept);
    await insertEvents(replacement);
    expect(await maxSeq()).toBe(26);
    const read = await speakers(instance);
    expect(read.status).toBe(200);
    const body = JSON.stringify(await read.json());
    expect(infos.at(-1)).toMatchObject({ hashed: 26, cachedSeq: 26 });
    expect(await (await speakers(instance)).json()).toHaveLength(24);
    expect(body).not.toContain('speaker-19-11');
    expect(body).toContain('speaker-13-14');
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE]);
  });

  it.each([
    ['missing', 'DELETE FROM persons WHERE person_id = $1'],
    ['changed', `UPDATE persons SET display_name = 'Falscher Name' WHERE person_id = $1`],
    ['extra', `INSERT INTO persons (meeting_id, person_id, display_name, key_id, source_seq)
      VALUES ('hv-2027', $1, 'Zusätzliche Person', 'hv-2027', 1)`],
  ])('refuses a warm read on a %s person row', async (caseName, sql) => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    await owner.query(sql, [caseName === 'extra' ? 'unexpected-person' : 'person-19-5']);
    const response = await speakers(instance);
    expect(response.status).toBeGreaterThanOrEqual(500);
    const body = await response.text();
    for (const secret of ['Synthetische Person', 'Falscher Name', 'Zusätzliche Person']) expect(body).not.toContain(secret);
  });

  it('refuses a warm read when a new event breaks the chain, naming its seq', async () => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const [next] = await stampNext([speaker(50, 'Gebrochen')]);
    await insertEvents([{ ...next!, subjectId: 'tampered-after-hash' } as DomainEvent]);
    await expectIntegrityFailure(await speakers(instance), 24, ['tampered-after-hash', 'Gebrochen']);
    // And with a valid event but a wrong predecessor link.
    await owner.query('DELETE FROM persons WHERE source_seq = 24');
    await owner.query('DELETE FROM events WHERE seq = 24');
    const relinked = { ...next!, prevHash: '0'.repeat(64) } as DomainEvent;
    await insertEvents([relinked]);
    await expectIntegrityFailure(await speakers(instance), 24);
  });

  it('hashes nothing on a warm read, exactly k on k new events and everything on the first, cold read', async () => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    expect((await speakers(instance)).status).toBe(200);
    expect(infos).toMatchObject([{ hashed: 23, cachedSeq: 23, rowsRead: 23 }]);
    await insertEvents(await stampNext([speaker(31, 'Neu'), speaker(32, 'Neu'), speaker(33, 'Neu')]));
    expect((await speakers(instance)).status).toBe(200);
    expect(infos.at(-1)).toEqual({ hashed: 3, cachedSeq: 26, rowsRead: 3 });
    const read = await speakers(instance);
    expect(await read.json()).toHaveLength(23);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 26 });
  });

  it('keeps own writes out of the cache until a later read loads them from the database', async () => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const tag = (await speakers(instance)).headers.get('ETag')!;
    const written = await instance.request(`/v1/meetings/${meetingId}/speakers`, {
      method: 'POST', headers: { 'X-Actor': ACTOR.moderation, 'Content-Type': 'application/json', 'If-Match': tag },
      body: JSON.stringify({ displayName: 'Eigene Schreibung', round: 1 }),
    });
    expect(written.status).toBe(201);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 23 });
    expect((await speakers(instance)).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 1, cachedSeq: 24 });
  });

  it('removes a revoked role on the next session request of the first instance (no stale actor from the cache)', async () => {
    const infos: ChainInfo[] = [];
    const { first, cookie } = await sessionApp(poolA, infos);
    const meeting = () => first.request('/v1/meeting', { headers: { Cookie: cookie } });
    expect((await meeting()).status).toBe(200);
    expect((await meeting()).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 23 });

    const revoked = await app(poolB).request(`/v1/meetings/${meetingId}/role-assignments/assignment-1/revocation`, {
      method: 'POST', headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Synthetischer Entzug' }),
    });
    expect(revoked.status).toBe(200);
    expect(await maxSeq()).toBe(24);

    expect((await meeting()).status).toBe(403);
    expect((await first.request('/auth/me', { headers: { Cookie: cookie } })).status).toBe(403);
  });

  it('fails the auth lookup closed after an old row changed under a warm cache (review finding 4)', async () => {
    const infos: ChainInfo[] = [];
    const { first, cookie } = await sessionApp(poolA, infos);
    const me = () => first.request('/auth/me', { headers: { Cookie: cookie } });
    expect((await me()).status).toBe(200);
    expect((await me()).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 23 });
    await owner.query(`UPDATE events SET envelope = jsonb_set(envelope, '{subjectId}', '"tampered"') WHERE seq = 2`);
    const refused = await me();
    expect(refused.status).toBeGreaterThanOrEqual(500);
    const body = await refused.text();
    for (const secret of ['Synthetische HV', 'Synthetische Person', 'tampered', 'moderation']) expect(body).not.toContain(secret);
    expect((await first.request('/v1/meeting', { headers: { Cookie: cookie } })).status).toBeGreaterThanOrEqual(500);
  });

  it('refuses a write under READ COMMITTED after an old row changed under a warm cache, naming seq 2 (review finding 4)', async () => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const tag = (await speakers(instance)).headers.get('ETag')!;
    await owner.query(`UPDATE events SET id = 'different-index-id' WHERE seq = 2`);
    const written = await instance.request(`/v1/meetings/${meetingId}/speakers`, {
      method: 'POST', headers: { 'X-Actor': ACTOR.moderation, 'Content-Type': 'application/json', 'If-Match': tag },
      body: JSON.stringify({ displayName: 'Nie gespeichert', round: 1 }),
    });
    await expectIntegrityFailure(written, 2, ['different-index-id', 'Nie gespeichert']);
    expect(await maxSeq()).toBe(end);
  });

  /**
   * Codex P1 on PR #88: runs `change` on the owner connection once, right before the statement that reads the
   * suffix rows (`events.seq > $1`) on a runtime connection of `pool`. With a separate digest probe, that is the gap
   * between probe and suffix under READ COMMITTED; with one statement, the change lands before both.
   */
  function changeBeforeSuffixRead(pool: Pool, change: () => Promise<void>): { fired: () => number } {
    let armed = true;
    let fired = 0;
    const patched = new WeakSet<object>();
    pool.on('acquire', (client) => {
      if (patched.has(client)) return;
      patched.add(client);
      const original = client.query.bind(client) as (...args: unknown[]) => unknown;
      (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
        if (armed && typeof args[0] === 'string' && args[0].includes('events.seq > $1')) {
          armed = false;
          fired++;
          return change().then(() => original(...args));
        }
        return original(...args);
      };
    });
    return { fired: () => fired };
  }

  const postSpeaker = (instance: TestApp, displayName: string, tag: string) => instance.request(`/v1/meetings/${meetingId}/speakers`, {
    method: 'POST', headers: { 'X-Actor': ACTOR.moderation, 'Content-Type': 'application/json', 'If-Match': tag },
    body: JSON.stringify({ displayName, round: 1 }),
  });

  it('does not stamp oldEnd+1 when the last row vanishes between cache warm and the write read (Codex P1, PR #88)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const tag = (await speakers(instance)).headers.get('ETag')!;
    // seq 23 is the role assignment (no person row, not part of the speaker list version), so the person rows and
    // the ETag stay valid for the shorter chain.
    const hook = changeBeforeSuffixRead(poolA, async () => { await owner.query(`DELETE FROM events WHERE seq = ${end}`); });
    const written = await postSpeaker(instance, 'Nach Kuerzung', tag);
    expect(hook.fired()).toBe(1);
    // Full path on the shortened chain: the new event continues seq 22, nothing lands on the old end.
    expect(written.status).toBe(201);
    expect(infos.at(-1)).toMatchObject({ hashed: end - 1, cachedSeq: end - 1 });
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE]);
    const stored = await storedEvents();
    expect(stored.map((event) => event.seq)).toEqual(Array.from({ length: end }, (_, index) => index + 1));
    expect(stored[end - 1]!.prevHash).toBe(stored[end - 2]!.hash);
    expect((await speakers(app(poolB))).status).toBe(200);
  });

  it('does not stamp oldEnd+1 onto the old hash when the last row is replaced between cache warm and the write read (Codex P1, PR #88)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const tag = (await speakers(instance)).headers.get('ETag')!;
    const before = await storedEvents();
    // A different, validly chained role assignment at seq 23 (other id): same speaker list, other hash.
    const rewrite = createInMemoryEventStore({ load: () => before.slice(0, end - 1), save: () => undefined });
    await createInProcessApi({ store: rewrite, actor: () => SYSTEM_ACTOR, meetingId, clock: () => new Date(at),
      idGenerator: () => 'assignment-2' }).assignRole({ subjectId: sessionActorId, role: 'moderation' });
    const replacement = rewrite.all().slice(end - 1);
    expect(replacement.map((event) => event.seq)).toEqual([end]);
    expect(replacement[0]!.hash).not.toBe(before[end - 1]!.hash);
    const hook = changeBeforeSuffixRead(poolA, async () => {
      await owner.query(`DELETE FROM events WHERE seq = ${end}`);
      await insertEvents(replacement);
    });
    const written = await postSpeaker(instance, 'Nach Ersatz', tag);
    expect(hook.fired()).toBe(1);
    expect(written.status).toBe(201);
    expect(infos.at(-1)).toMatchObject({ hashed: end, cachedSeq: end });
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE]);
    const stored = await storedEvents();
    expect(stored).toHaveLength(end + 1);
    // The new event continues the replaced row, never the cached (old) hash at seq 23.
    expect(stored[end]!.prevHash).toBe(replacement[0]!.hash);
    expect((await speakers(app(poolB))).status).toBe(200);
  });

  it('keeps the database and service digests equal for emoji, newline, backslash and quotes, also after a jsonb round trip (review finding 3)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await insertEvents(await stampNext([speaker(70, 'Grüße 🎉 "zitiert" \\ Rück\nzeile \u00e9\u0301 \ud83d\udc68\u200d\ud83d\udc69')]));
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 24 });
    await owner.query('UPDATE events SET envelope = envelope::text::jsonb');
    expect((await speakers(instance)).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 24 });
    expect(errors).not.toHaveBeenCalled();
  });

  it('writes the history line once per streak and the repeats as one count (review finding 3)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    // Content-equivalent rewrite: `1` -> `1.0` keeps the canonical JSON and so the hash (the chain stays valid) but
    // changes the stored text, so the database digest no longer matches. A new spelling each time keeps it going,
    // like a database whose digest never matches the service's.
    for (const spelling of ['1.0', '1.00', '1.000']) {
      await owner.query(`UPDATE events SET envelope = jsonb_set(envelope, '{payload,number}', $1::jsonb) WHERE seq = 3`, [spelling]);
      expect((await speakers(instance)).status).toBe(200);
      expect(infos.at(-1)).toMatchObject({ hashed: 23, cachedSeq: 23 });
    }
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE]);
    expect((await speakers(instance)).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: 23 });
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE,
      'HV-Tool API: the event history line repeated 2 more times.']);
  });

  it('writes the repeat count during a streak that does not end: after five minutes of the app clock (review nit a)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let clockNow = now.getTime();
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos, { clock: () => new Date(clockNow) });
    await warm(instance, infos);
    const spell = async (spelling: string) => {
      await owner.query(`UPDATE events SET envelope = jsonb_set(envelope, '{payload,number}', $1::jsonb) WHERE seq = 3`, [spelling]);
      expect((await speakers(instance)).status).toBe(200);
      expect(infos.at(-1)).toMatchObject({ hashed: 23 });
    };
    await spell('1.0');
    await spell('1.00');
    await spell('1.000');
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE]);
    clockNow += 5 * 60_000;
    await spell('1.0000');
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE,
      'HV-Tool API: the event history line repeated 3 more times.']);
    // The streak goes on; the count starts again and is written when the streak ends.
    await spell('1.00000');
    expect((await speakers(instance)).status).toBe(200);
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE,
      'HV-Tool API: the event history line repeated 3 more times.',
      'HV-Tool API: the event history line repeated 1 more times.']);
  });

  it('writes the repeat count every 100 repeats during a streak that does not end (review nit a)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    for (let zeros = 1; zeros <= 101; zeros++) {
      await owner.query(`UPDATE events SET envelope = jsonb_set(envelope, '{payload,number}', $1::jsonb) WHERE seq = 3`,
        [`1.${'0'.repeat(zeros)}`]);
      expect((await speakers(instance)).status).toBe(200);
    }
    expect(errors.mock.calls.map((call) => call.join(' '))).toEqual([HISTORY_LINE,
      'HV-Tool API: the event history line repeated 100 more times.']);
  }, 120_000);

  it('serves 20 parallel reads and 5 writes on a warm app correctly and ends with the cache at the database seq', async () => {
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    await warm(instance, infos);
    const write = async (index: number): Promise<Response> => {
      const tag = (await speakers(instance)).headers.get('ETag')!;
      return instance.request(`/v1/meetings/${meetingId}/speakers`, {
        method: 'POST', headers: { 'X-Actor': ACTOR.moderation, 'Content-Type': 'application/json', 'If-Match': tag,
          'Idempotency-Key': `parallel-${index}` },
        body: JSON.stringify({ displayName: `Parallel ${index}`, round: 1 }),
      });
    };
    const reads = Array.from({ length: 20 }, () => speakers(instance));
    const writes = Array.from({ length: 5 }, (_, index) => write(index));
    const [readResults, writeResults] = await Promise.all([Promise.all(reads), Promise.all(writes)]);
    for (const response of readResults) {
      expect(response.status).toBe(200);
      const list = await response.json() as unknown[];
      expect(list.length).toBeGreaterThanOrEqual(SPEAKERS);
      expect(list.length).toBeLessThanOrEqual(SPEAKERS + 5);
    }
    const statuses = writeResults.map((response) => response.status);
    for (const status of statuses) expect([201, 412]).toContain(status);
    const committed = statuses.filter((status) => status === 201).length;
    expect(committed).toBeGreaterThanOrEqual(1);
    expect(await maxSeq()).toBe(end + committed);
    const after = await speakers(instance);
    expect(await after.json()).toHaveLength(SPEAKERS + committed);
    expect(infos.at(-1)?.cachedSeq).toBe(await maxSeq());
    expect((await speakers(instance)).status).toBe(200);
    expect(infos.at(-1)).toMatchObject({ hashed: 0, cachedSeq: end + committed });
  });
});

describe.skipIf(databaseUrl === undefined || runtimeUrl === undefined)('takt-033: budget on a 2000+ event log', () => {
  beforeEach(async () => {
    schema = `hv033b_${randomUUID().replaceAll('-', '')}`;
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.end(); }
    owner = scopedPool(databaseUrl, 'owner', 3);
    await runMigrations(owner, { direction: 'up', ...(runtimeRole ? { runtimeRole } : {}) });
    poolA = scopedPool(runtimeUrl, 'a');
    poolB = scopedPool(runtimeUrl, 'b');
  });

  afterEach(async () => {
    await Promise.all([poolA?.end(), poolB?.end()]);
    await owner?.end();
    const admin = new Pool({ connectionString: databaseUrl });
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.end(); }
  });

  /**
   * Amended by the architect after the security review (finding 1, see the spec): the hard gate is the deterministic
   * part plus the loader's own warm/cold ratio from interleaved pairs. Whole-request medians, the absolute 100 ms and
   * the breakdown are logged as evidence, not asserted: they include the projection (a non-goal) and are load-bound.
   */
  it('hashes 0 / k / all, reads exactly k rows warm, and keeps the loader warm/cold ratio at most 0.5', async () => {
    const corpus = createInMemoryEventStore().append(seedEvents({ ...CORPUS_LOAD, questions: 250, roundSizes: [30, 24, 18, 12],
      now: new Date(at), actor: SYSTEM_ACTOR }));
    expect(corpus.length).toBeGreaterThanOrEqual(2000);
    await insertEvents(corpus);
    const stage = (instance: TestApp) => instance.request('/v1/stage', { headers: { 'X-Actor': ACTOR.admin } });
    const newSpeakers = (from: number, base: readonly DomainEvent[]) => stampNext(Array.from({ length: 3 }, (_, index): NewEvent => ({
      id: `budget-speaker-${from + index}`, type: 'SpeakerRegistered', at, actor, subjectId: `budget-speaker-${from + index}`,
      personId: `budget-person-${from + index}`, meetingId: corpus.at(-1)!.meetingId!,
      payload: { number: 900 + from + index, round: 1, position: 900 + from + index,
        pii: { keyId: corpus.at(-1)!.meetingId!, displayName: `Budget ${from + index}` } },
    }) as NewEvent), base);

    // (a) deterministic, through the test hook of the whole request.
    const infos: ChainInfo[] = [];
    const instance = app(poolA, infos);
    expect((await stage(instance)).status).toBe(200);
    expect(infos.at(-1)).toEqual({ hashed: corpus.length, cachedSeq: corpus.length, rowsRead: corpus.length });
    expect((await stage(instance)).status).toBe(200);
    expect(infos.at(-1)).toEqual({ hashed: 0, cachedSeq: corpus.length, rowsRead: 0 });
    const firstExtra = await newSpeakers(0, corpus);
    await insertEvents(firstExtra);
    expect((await stage(instance)).status).toBe(200);
    expect(infos.at(-1)).toEqual({ hashed: 3, cachedSeq: corpus.length + 3, rowsRead: 3 });

    // (a) rows: the loader itself, on its own cache, in a read transaction like the request's.
    const load = async (cache: ReturnType<typeof createChainCache>) => {
      const client = await poolA.connect();
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const result = await loadPostgresSnapshotCached(client, cache);
        await client.query('COMMIT');
        return result;
      } finally {
        client.release();
      }
    };
    const cache = createChainCache();
    expect(await load(cache)).toMatchObject({ hashed: corpus.length + 3, rowsRead: corpus.length + 3 });
    expect(await load(cache)).toMatchObject({ hashed: 0, rowsRead: 0 });
    await insertEvents(await newSpeakers(3, [...corpus, ...firstExtra]));
    expect(await load(cache)).toMatchObject({ hashed: 3, rowsRead: 3 });
    const warmSnapshot = await load(cache);
    expect(warmSnapshot).toMatchObject({ hashed: 0, rowsRead: 0 });

    // (b) loader ratio from 30 interleaved cold/warm pairs (median of the per-pair ratios): hard gate.
    const ratios: number[] = [];
    const loaderCold: number[] = [];
    const loaderWarm: number[] = [];
    for (let pair = 0; pair < 30; pair++) {
      let started = performance.now();
      await load(createChainCache());
      const cold = performance.now() - started;
      started = performance.now();
      await load(cache);
      const warm = performance.now() - started;
      loaderCold.push(cold);
      loaderWarm.push(warm);
      ratios.push(warm / cold);
    }

    // (d) evidence only: whole-request medians (interleaved), full SELECT alone, projection alone.
    const requestCold: number[] = [];
    const requestWarm: number[] = [];
    for (let pair = 0; pair < 20; pair++) {
      let started = performance.now();
      expect((await stage(app(poolA))).status).toBe(200);
      requestCold.push(performance.now() - started);
      started = performance.now();
      expect((await stage(instance)).status).toBe(200);
      requestWarm.push(performance.now() - started);
    }
    const selectOnly: number[] = [];
    const projection: number[] = [];
    for (let run = 0; run < 15; run++) {
      let started = performance.now();
      await poolA.query('SELECT events.seq::text AS seq, id, meeting_id, hash, prev_hash, envelope::text AS envelope FROM events ORDER BY events.seq');
      selectOnly.push(performance.now() - started);
      started = performance.now();
      const store = createInMemoryEventStore({ load: () => warmSnapshot.snapshot.events, save: () => undefined });
      await createInProcessApi({ store, actor: () => actor, clock: () => now }).getStage();
      projection.push(performance.now() - started);
    }
    const f = (value: number) => value.toFixed(1);
    console.info(`takt-033: ${corpus.length + 6} events; loader median cold ${f(median(loaderCold))} ms, warm ` +
      `${f(median(loaderWarm))} ms (digest probe + suffix + persons), median pair ratio ${median(ratios).toFixed(3)}; ` +
      `GET /v1/stage median cold ${f(median(requestCold))} ms, warm ${f(median(requestWarm))} ms ` +
      `(absolute target < 100 ms: ${median(requestWarm) < 100 ? 'met' : 'missed'}); full SELECT alone ` +
      `${f(median(selectOnly))} ms; projection alone ${f(median(projection))} ms`);
    expect(median(ratios)).toBeLessThanOrEqual(0.5);
  }, 240_000);
});
