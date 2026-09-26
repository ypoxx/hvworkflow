/**
 * Contract coverage for the operations the acceptance sentence (`acceptance.test.ts`) does not
 * exercise: master data, the speaker list, contributions, filtered question listing, the podium
 * view, the event feed, and the remaining question transitions (return, withdraw, merge). Every
 * response is checked against its schema in `packages/contract/openapi.yaml` with `expectValid`,
 * so together with `acceptance.test.ts` and `negative.test.ts` every operationId has a test.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
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

    const round = updated.round as number;
    const roundSpeakerIds = (speakers as { id: string; round: number }[])
      .filter((s) => s.round === round)
      .map((s) => s.id);
    const reorderRes = await req(app, 'PUT', '/v1/speakers/order', {
      actor: ACTOR.moderation,
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
 * 412 — an `If-Match` parameter (optimistic locking in `packages/domain/src/api.ts`).
 */
function generatedStatuses(operationId: string): number[] {
  const op = operations[operationId]!;
  const node = openapiDoc.paths[op.path][op.method] as { security?: Record<string, unknown>[]; requestBody?: unknown };
  const params = paramsFor(operationId);
  const statuses: number[] = [];
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
  it('no operation lacks a generated status (422/401/404/412)', () => {
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
