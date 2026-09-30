/**
 * Contract coverage for the operations the acceptance sentence (`acceptance.test.ts`) does not
 * exercise: master data, the speaker list, contributions, filtered question listing, the podium
 * view, the event feed, and the remaining question transitions (return, withdraw, merge). Every
 * response is checked against its schema in `packages/contract/openapi.yaml` with `expectValid`,
 * so together with `acceptance.test.ts` and `negative.test.ts` every operationId has a test.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
import { createInMemoryEventStore } from '@hv/domain';
import { ACTOR, OPERATIONS_0_2, UNDOCUMENTED_STATUS_EXCEPTIONS, req } from './helpers.ts';
import {
  allOperationIds,
  documentedStatuses,
  expectValid,
  openapiDoc,
  operations,
  paramsFor,
  resolvePointer,
} from '../contractSchema.ts';

interface QuestionLike {
  id: string;
  version: number;
  status: string;
}

interface CookieSchema {
  $ref?: string;
  pattern?: string;
  oneOf?: CookieSchema[];
}

function matchesCookieLine(schema: CookieSchema, line: string): boolean {
  if (schema.$ref) return matchesCookieLine(resolvePointer(schema.$ref) as CookieSchema, line);
  if (schema.oneOf) return schema.oneOf.filter((branch) => matchesCookieLine(branch, line)).length === 1;
  return schema.pattern !== undefined && new RegExp(schema.pattern).test(line);
}

function matchesCookieResponse(header: { schema: CookieSchema; 'x-required-cookie-lines': string[] },
  lines: readonly string[]): boolean {
  const names = header['x-required-cookie-lines'];
  return lines.length === names.length &&
    lines.every((line) => matchesCookieLine(header.schema, line)) &&
    names.every((name) => lines.filter((line) => line.startsWith(`${name}=`)).length === 1);
}

describe('Scheibe 029b: browser-bound OIDC correlation cookies', () => {
  const loginHeaders = openapiDoc.paths['/auth/login'].get.responses['302'].headers;
  const callbackHeaders = openapiDoc.paths['/auth/callback'].get.responses['302'].headers;
  const stateValue = 'A'.repeat(43);
  const sessionValue = 'B'.repeat(43);
  const stateLine = `hv_auth_state=${stateValue}; Max-Age=300; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax`;
  const clearStateLine = 'hv_auth_state=; Max-Age=0; Path=/auth/callback; HttpOnly; Secure; SameSite=Lax';
  const sessionLine = `hv_session=${sessionValue}; Max-Age=50400; Path=/; HttpOnly; Secure; SameSite=Lax`;

  it('declares exactly one short-lived host-bound correlation cookie on login', () => {
    const cookie = loginHeaders['Set-Cookie'];
    expect(cookie?.required).toBe(true);
    expect(cookie?.['x-required-cookie-lines']).toEqual(['hv_auth_state']);
    expect(matchesCookieResponse(cookie, [stateLine])).toBe(true);
    expect(matchesCookieResponse(cookie, [stateLine, stateLine])).toBe(false);
    for (const invalid of [
      sessionLine,
      stateLine.replace('Secure; ', ''),
      stateLine.replace('Path=/auth/callback', 'Path=/'),
      `${stateLine}; Domain=example.test`,
      stateLine.replace('Max-Age=300', 'Max-Age=301'),
    ]) expect(matchesCookieLine(cookie.schema as CookieSchema, invalid), invalid).toBe(false);
  });

  it('declares separate callback Set-Cookie lines for one live session and clearing the correlation cookie', () => {
    const cookie = callbackHeaders['Set-Cookie'];
    expect(cookie?.required).toBe(true);
    expect(cookie?.['x-required-cookie-lines']).toEqual(['hv_session', 'hv_auth_state']);
    expect(matchesCookieResponse(cookie, [sessionLine, clearStateLine])).toBe(true);
    expect(matchesCookieResponse(cookie, [sessionLine])).toBe(false);
    expect(matchesCookieResponse(cookie, [sessionLine, sessionLine])).toBe(false);
    expect(matchesCookieResponse(cookie, [sessionLine, stateLine])).toBe(false);
    expect(matchesCookieLine(cookie.schema as CookieSchema, stateLine)).toBe(false);
    expect(matchesCookieLine(cookie.schema as CookieSchema,
      clearStateLine.replace('Path=/auth/callback', 'Path=/'))).toBe(false);
    expect(new Set(cookie['x-required-cookie-lines']).size).toBe(2);
  });
});

describe('Scheibe 028: mandatory version contract', () => {
  it('requires the 0.3.6 fields and per-operation If-Match without changing array responses', () => {
    expect(openapiDoc.info.version).toBe('0.3.11');
    const schemas = openapiDoc.components.schemas;
    expect(schemas.Meeting.required).toEqual(expect.arrayContaining(['version', 'speakerListVersion']));
    expect(schemas.Speaker.required).toContain('meetingId');
    expect(schemas.Contribution.required).toEqual(expect.arrayContaining(['meetingId', 'version']));
    expect(schemas.Question.required).toContain('meetingId');
    expect(schemas.Event.required).toEqual(expect.arrayContaining([
      'schemaVersion', 'meetingId', 'prevHash', 'hash', 'recordedAt', 'occurredAt',
      'occurredAtSource', 'retentionClass', 'legalHold',
    ]));

    for (const operationId of [
      'registerSpeaker', 'registerMeetingSpeaker', 'reorderSpeakers', 'reorderMeetingSpeakers',
      'updateSpeaker', 'captureContribution', 'captureMeetingContribution', 'captureQuestions',
      'claimContribution', 'releaseContribution', 'classifyQuestion', 'assignQuestion',
      'draftAnswer', 'submitForReview', 'approveQuestion', 'clearQuestionLegally',
      'returnQuestion', 'stageQuestion', 'closeQuestion', 'withdrawQuestion', 'mergeQuestion',
      'claimQuestion', 'releaseQuestion',
    ]) {
      const op = operations[operationId]!;
      const definition = openapiDoc.paths[op.path][op.method];
      const params = definition.parameters ?? [];
      expect(params.some((candidate: { $ref?: string; name?: string; required?: boolean }) => {
        const parameter = candidate.$ref ? resolvePointer(candidate.$ref) as { name: string; required?: boolean } : candidate;
        return parameter.name === 'If-Match' && parameter.required === true;
      }), operationId).toBe(true);
      expect(definition.responses['428'], operationId).toBeDefined();
    }
    const delivery = operations['deliverQuestion']!;
    const deliveryParams = openapiDoc.paths[delivery.path][delivery.method].parameters ?? [];
    expect(deliveryParams.some((candidate: { $ref?: string; name?: string; required?: boolean }) => {
      const parameter = candidate.$ref ? resolvePointer(candidate.$ref) as { name: string; required?: boolean } : candidate;
      return parameter.name === 'If-Match' && parameter.required === true;
    })).toBe(false);
  });
});

async function firstQuestion(app: App, status: string): Promise<QuestionLike> {
  const res = await req(app, 'GET', `/v1/questions?status=${status}&limit=1`, { actor: ACTOR.admin });
  const { items } = (await res.json()) as { items: QuestionLike[] };
  expect(items.length).toBeGreaterThan(0);
  return items[0]!;
}

describe('contract: the operations the acceptance sentence does not reach', () => {
  let app: App;

  beforeAll(async () => {
    app = createApp({ demoEnabled: true });
    const res = await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 300, seed: 11 } });
    expect(res.status).toBe(200);
  });

  it('the contract still has at least the 29 operations this suite was written against', () => {
    // A sanity check only. The real gate "every operationId is exercised by a test or pre-declared in
    // packages/contract/allowlist.json" runs after the whole suite, in the Vitest globalSetup
    // `operation-coverage.setup.ts` (slice 023, goal 5), over the hits `req()` records in helpers.ts.
    expect(allOperationIds.length).toBeGreaterThanOrEqual(29);
  });

  it('listAgendaItems / listUnits — meeting master data', async () => {
    const agendaRes = await req(app, 'GET', '/v1/agenda-items', { actor: ACTOR.admin });
    const agenda = await agendaRes.json();
    expectValid('listAgendaItems', 200, agenda);
    expect(agenda.length).toBeGreaterThan(0);

    const unitsRes = await req(app, 'GET', '/v1/units', { actor: ACTOR.admin });
    const units = await unitsRes.json();
    expectValid('listUnits', 200, units);
    expect(units.length).toBeGreaterThan(0);
  });

  it('listSpeakers / getSpeaker / updateSpeaker / reorderSpeakers', async () => {
    const listRes = await req(app, 'GET', '/v1/speakers', { actor: ACTOR.moderation });
    const speakers = await listRes.json();
    expectValid('listSpeakers', 200, speakers);
    expect(speakers.length).toBeGreaterThan(1);
    const first = speakers[0];

    const getRes = await req(app, 'GET', `/v1/speakers/${first.id}`, { actor: ACTOR.moderation });
    expect(getRes.status).toBe(200);
    const speaker = await getRes.json();
    expectValid('getSpeaker', 200, speaker);
    expect(getRes.headers.get('ETag')).toBe(`"v${speaker.version}"`);

    const patchRes = await req(app, 'PATCH', `/v1/speakers/${first.id}`, {
      actor: ACTOR.moderation,
      headers: { 'If-Match': getRes.headers.get('ETag')! },
      body: { requestedMinutes: 7 },
    });
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expectValid('updateSpeaker', 200, updated);
    // Slice 080: the deprecated field is still accepted by the contract (0.3.x) but the core ignores it.
    expect(updated).not.toHaveProperty('requestedMinutes');
    // takt-015 Ziel 1: no effective field is left after the cut, so no event is written and the
    // version stays the one If-Match named.
    expect(updated.version).toBe(speaker.version);

    const round = updated.round as number;
    const roundSpeakerIds = (speakers as { id: string; round: number }[])
      .filter((s) => s.round === round)
      .map((s) => s.id);
    const reorderRes = await req(app, 'PUT', '/v1/speakers/order', {
      actor: ACTOR.moderation,
      headers: { 'If-Match': listRes.headers.get('ETag')! },
      body: { round, speakerIds: [...roundSpeakerIds].reverse() },
    });
    expect(reorderRes.status).toBe(200);
    expectValid('reorderSpeakers', 200, await reorderRes.json());
  });

  it('listContributions / getContribution', async () => {
    const listRes = await req(app, 'GET', '/v1/contributions', { actor: ACTOR.capture });
    const contributions = await listRes.json();
    expectValid('listContributions', 200, contributions);
    expect(contributions.length).toBeGreaterThan(0);

    const getRes = await req(app, 'GET', `/v1/contributions/${contributions[0].id}`, { actor: ACTOR.capture });
    expect(getRes.status).toBe(200);
    expectValid('getContribution', 200, await getRes.json());

    const filteredRes = await req(app, 'GET', `/v1/contributions?speakerId=${contributions[0].speakerId}`, {
      actor: ACTOR.capture,
    });
    const filtered = await filteredRes.json();
    expectValid('listContributions', 200, filtered);
    expect(filtered.every((c: { speakerId: string }) => c.speakerId === contributions[0].speakerId)).toBe(true);
  });

  it('listQuestions with comma-separated status filter, getStage, listEvents', async () => {
    const qRes = await req(app, 'GET', '/v1/questions?limit=5&status=captured,classified', { actor: ACTOR.capture });
    expect(qRes.status).toBe(200);
    const list = await qRes.json();
    expectValid('listQuestions', 200, list);
    expect(list.items.length).toBeGreaterThan(0);
    for (const item of list.items) expect(['captured', 'classified']).toContain(item.status);

    const stageRes = await req(app, 'GET', '/v1/stage', { actor: ACTOR.podium });
    expect(stageRes.status).toBe(200);
    expectValid('getStage', 200, await stageRes.json());

    const eventsRes = await req(app, 'GET', '/v1/events?after=0&limit=10', { actor: ACTOR.admin });
    expect(eventsRes.status).toBe(200);
    const events = await eventsRes.json();
    expectValid('listEvents', 200, events);
    expect(events.items.length).toBeLessThanOrEqual(10);
  });

  it('returnQuestion — legal sends a question back for rework', async () => {
    const q = await firstQuestion(app, 'in_review');
    const res = await req(app, 'POST', `/v1/questions/${q.id}/returns`, {
      actor: ACTOR.legal,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { reason: 'Bitte Quelle ergänzen.' },
    });
    expect(res.status).toBe(200);
    const returned = await res.json();
    expectValid('returnQuestion', 200, returned);
    expect(returned.returnReason).toBe('Bitte Quelle ergänzen.');
  });

  it('withdrawQuestion — moderation withdraws a captured question', async () => {
    const q = await firstQuestion(app, 'captured');
    const res = await req(app, 'POST', `/v1/questions/${q.id}/withdrawal`, {
      actor: ACTOR.moderation,
      headers: { 'If-Match': `"v${q.version}"` },
      body: { reason: 'Aktionärin hat die Frage zurückgezogen.' },
    });
    expect(res.status).toBe(200);
    const withdrawn = await res.json();
    expectValid('withdrawQuestion', 200, withdrawn);
    expect(withdrawn.status).toBe('withdrawn');
  });

  it('mergeQuestion — capture merges a duplicate into another question', async () => {
    const listRes = await req(app, 'GET', '/v1/questions?status=captured&limit=2', { actor: ACTOR.admin });
    const { items } = (await listRes.json()) as { items: QuestionLike[] };
    expect(items.length).toBeGreaterThanOrEqual(2);
    const [into, duplicate] = items as [QuestionLike, QuestionLike];
    const res = await req(app, 'POST', `/v1/questions/${duplicate.id}/merge`, {
      actor: ACTOR.capture,
      headers: { 'If-Match': `"v${duplicate.version}"` },
      body: { intoQuestionId: into.id },
    });
    expect(res.status).toBe(200);
    const merged = await res.json();
    expectValid('mergeQuestion', 200, merged);
    expect(merged.status).toBe('merged');
    expect(merged.mergedIntoId).toBe(into.id);
  });
});

// ---- response reconciliation (slice 023, goal 5 with the architect's addendum; Codex on 2779e0b) ----

type Schema = Record<string, unknown>;

/** Follows `$ref` until a schema that is not a bare reference (plain JSON Pointer into the document). */
function deref(node: unknown): Schema {
  let current = node as Schema;
  for (let guard = 0; current !== undefined && typeof current['$ref'] === 'string'; guard++) {
    if (guard > 20) throw new Error('Circular $ref in the contract.');
    current = resolvePointer(current['$ref'] as string) as Schema;
  }
  return current;
}

/**
 * Whether a query or header value — always a string on the wire, coerced by `coerceParamValue` in
 * `contractSchema.ts` — can fail the schema `validateOperation` checks it against: a non-string type
 * (a non-numeric `limit`), an enum, a pattern, a length or range bound, a format, or an array whose
 * items can fail. A plain `{ type: string }` accepts every string and never yields a 422.
 */
function canReject(node: unknown): boolean {
  const schema = deref(node);
  if (schema === undefined) return false;
  if (schema['type'] === 'array') {
    return 'minItems' in schema || 'maxItems' in schema || canReject(schema['items']);
  }
  if (schema['type'] !== undefined && schema['type'] !== 'string') return true;
  const constraining = ['enum', 'const', 'pattern', 'minLength', 'maxLength', 'format', 'minimum', 'maximum',
    'exclusiveMinimum', 'exclusiveMaximum', 'allOf', 'anyOf', 'oneOf', 'not'];
  return constraining.some((keyword) => keyword in schema);
}

/**
 * The statuses the service's generic layer can produce for an operation, derived only from contract
 * properties (table in the slice report "Antwort-Abgleich"):
 * 422 — a query/header parameter that can fail its schema, or a request body (`validate.ts`, invalid
 *       JSON in `http.ts`);
 * 401 — a non-empty `security` (`actor.ts`, `app.ts`; the session and bearer schemes from 029/033);
 * 404 — a path parameter (domain lookups, `NotFound`);
 * 412 — an `If-Match` parameter (optimistic locking in `packages/domain/src/api.ts`);
 * 408, 429 — every operation (request timeout and quotas, slice 034a; the time budget is exempt on the
 *       sign-in paths, but the contract documents it uniformly);
 * 413 — every operation that takes a body (`POST`, `PUT`, `PATCH`; the body limit needs no `requestBody`);
 * 503 — every operation under `/v1` (`PersistenceBusy`, slice 034a).
 */
function generatedStatuses(operationId: string): number[] {
  const op = operations[operationId]!;
  const node = openapiDoc.paths[op.path][op.method] as { security?: Record<string, unknown>[]; requestBody?: unknown };
  const params = paramsFor(operationId);
  const statuses: number[] = [408, 429];
  if (['post', 'put', 'patch'].includes(op.method)) statuses.push(413);
  const pathItem = openapiDoc.paths[op.path] as { servers?: unknown };
  if (pathItem.servers === undefined) statuses.push(503);
  const rejectable = params.some(
    (p) => (p.in === 'query' || p.in === 'header') && canReject(resolvePointer(p.schemaPointer.slice('openapi'.length))),
  );
  if (rejectable || node.requestBody !== undefined) statuses.push(422);
  const security = node.security ?? (openapiDoc.security as Record<string, unknown>[]);
  if (security.length > 0 && security.every((requirement) => Object.keys(requirement).length > 0)) statuses.push(401);
  if (params.some((p) => p.in === 'path')) statuses.push(404);
  if (params.some((p) => p.name === 'If-Match')) statuses.push(412);
  return statuses;
}

describe('contract: every status the generic layer can produce is documented or a reasoned exception', () => {
  it('no operation lacks a generated status (422/401/404/412/408/413/429/503)', () => {
    const gaps: string[] = [];
    for (const operationId of allOperationIds) {
      const documented = documentedStatuses(operationId);
      const excepted = UNDOCUMENTED_STATUS_EXCEPTIONS[operationId] ?? [];
      const missing = generatedStatuses(operationId).filter((s) => !documented.includes(String(s)) && !excepted.includes(s));
      if (missing.length > 0) gaps.push(`${operationId}: ${missing.join(', ')} (documents ${documented.join(', ')})`);
    }
    expect(gaps, `operations whose contract lacks a status the service can produce:\n${gaps.join('\n')}`).toEqual([]);
  });

  it('the exception list names only 0.2 operations and only statuses the contract does not document', () => {
    const stale: string[] = [];
    for (const [operationId, statuses] of Object.entries(UNDOCUMENTED_STATUS_EXCEPTIONS)) {
      if (!OPERATIONS_0_2.includes(operationId) || !allOperationIds.includes(operationId)) stale.push(`${operationId}: not a 0.2 operation`);
      else for (const s of statuses) if (documentedStatuses(operationId).includes(String(s))) stale.push(`${operationId}: ${s} is documented now`);
    }
    expect(stale).toEqual([]);
  });
});

// ---- Scheibe 034a: security headers on every response (T-G1-I-06, T-G1-T-06) -------------------------------------

describe('034a security headers', () => {
  const EXPECTED: Record<string, string> = {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000',
    'Cache-Control': 'no-store',
  };
  const expectHeaders = (res: Response, label: string): void => {
    for (const [name, value] of Object.entries(EXPECTED)) {
      // `Headers.get` joins duplicates with ", ": an exact match also proves the header is set once.
      expect(res.headers.get(name), `${label}: ${name}`).toBe(value);
    }
  };
  const idp = 'https://idp.example.invalid/realms/hv';
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('carries all eight headers with their exact values on 200, 201, 401, 404, 422, 408, 413, 429 and 503', async () => {
    let now = Date.parse('2027-04-20T10:00:15.000Z');
    const slow = async () => { await sleep(150); return { status: 'ok' as const }; };
    const ok = async () => ({ status: 'ok' as const });
    const app = createApp({ demoEnabled: true, clock: () => new Date(now), sourceOf: () => 'probe-source',
      limits: { requestTimeoutMs: 60, readPerSubject: 3 }, readiness: { clock: slow, db: ok, migrations: ok } });
    const seed = await app.request('/v1/demo/seed', { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: 3, seed: 1 }) });
    expectHeaders(seed, '200 seed');
    now += 60_000;
    const tag = (await app.request('/v1/speakers', { headers: { 'X-Actor': ACTOR.moderation } })).headers.get('ETag')!;
    expectHeaders(await app.request('/healthz'), '200 /healthz');
    const created = await app.request('/v1/speakers', { method: 'POST', body: JSON.stringify({ displayName: 'Testperson' }),
      headers: { 'X-Actor': ACTOR.moderation, 'Content-Type': 'application/json', 'If-Match': tag } });
    expect(created.status).toBe(201);
    expectHeaders(created, '201');
    const unauthorized = await app.request('/v1/speakers');
    expect(unauthorized.status).toBe(401);
    expectHeaders(unauthorized, '401');
    const missing = await app.request('/v1/nothing-here', { headers: { 'X-Actor': ACTOR.moderation } });
    expect(missing.status).toBe(404);
    expectHeaders(missing, '404 notFound');
    const invalid = await app.request('/v1/speakers', { method: 'POST', body: JSON.stringify({}),
      headers: { 'X-Actor': ACTOR.moderation, 'Content-Type': 'application/json', 'If-Match': tag } });
    expect(invalid.status).toBe(422);
    expectHeaders(invalid, '422');
    const timeout = await app.request('/readyz');
    expect(timeout.status).toBe(408);
    expectHeaders(timeout, '408');
    const large = await app.request('/v1/contributions', { method: 'POST', body: 'x',
      headers: { 'X-Actor': ACTOR.capture, 'Content-Type': 'application/json', 'Content-Length': '262145' } });
    expect(large.status).toBe(413);
    expectHeaders(large, '413');
    // the reads above: 3 allowed (limit 3), the next one of the same subject is refused
    await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.moderation } });
    const limited = await app.request('/v1/meeting', { headers: { 'X-Actor': ACTOR.moderation } });
    expect(limited.status).toBe(429);
    expectHeaders(limited, '429');
    await sleep(200); // the slow readiness check of the 408 above ends; nothing more to see
    const notReady = createApp({ demoEnabled: true, readiness: { clock: ok, db: async () => ({ status: 'fail', code: 'unreachable' }), migrations: ok } });
    const unavailable = await notReady.request('/readyz');
    expect(unavailable.status).toBe(503);
    expectHeaders(unavailable, '503 /readyz');
    expectHeaders(await app.request('/healthz'), '200 /healthz (again)');
  });

  it('carries them on 500 (onError), on `/readyz` 200, and on a redirect with exactly one no-store on the sign-in path (302)', async () => {
    const failing = createApp({ demoEnabled: true, persistence: { load: () => undefined, save: () => { throw new Error('disk full'); } } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await failing.request('/v1/demo/seed', { method: 'POST',
      headers: { 'X-Actor': ACTOR.admin, 'Content-Type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(500);
    expectHeaders(res, '500');
    const ok = async () => ({ status: 'ok' as const });
    const ready = createApp({ demoEnabled: true, readiness: { clock: ok, db: ok, migrations: ok } });
    const readyz = await ready.request('/readyz');
    expect(readyz.status).toBe(200);
    expectHeaders(readyz, '200 /readyz');

    const events = createInMemoryEventStore();
    const login = createApp({ demoEnabled: false, oidcIssuer: idp,
      oidcFlow: { authorizationUrl: async ({ state }) => `${idp}/authorize?state=${state}`, complete: async () => ({ issuer: idp, subject: 's' }) },
      authStore: { createLoginState: async () => undefined, consumeLoginState: async () => null,
        createSession: async () => { throw new Error('unused'); }, readSession: async () => null, verifyCsrf: async () => false,
        revokeSession: async () => false, blockSubject: async () => undefined, isSubjectBlocked: async () => false },
      authEvents: async () => events.all(), persistence: { load: () => [], save: () => undefined },
      transparencyNotice: { version: 'v1', text: { de: 'Hinweis', en: 'Notice' } } });
    const redirect = await login.request('/auth/login');
    expect(redirect.status).toBe(302);
    expectHeaders(redirect, '302 /auth/login');
    expect(redirect.headers.get('Cache-Control')).toBe('no-store'); // once, not "no-store, no-store"
    const failed = await login.request('/auth/callback');
    expect(failed.status).toBe(400);
    expectHeaders(failed, '400 /auth/callback');
    const metrics = await login.request('/metrics');
    expect(metrics.status).toBe(401);
    expectHeaders(metrics, '401 /metrics');
  });

  it('an allowed origin also gets its CORS headers on 429, and Retry-After is listed as exposed', async () => {
    const app = createApp({ demoEnabled: true, sourceOf: () => 's', limits: { anonymousPerSource: 1 } });
    const headers = { Origin: 'http://localhost:5173' };
    await app.request('/v1/meeting', { headers });
    const limited = await app.request('/v1/meeting', { headers });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(limited.headers.get('Access-Control-Expose-Headers')).toContain('Retry-After');
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1);
    expectHeaders(limited, '429 with CORS');
  });
});
