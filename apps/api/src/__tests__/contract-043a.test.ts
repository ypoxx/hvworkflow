/**
 * Scheibe 043a: contract 0.4.0, part 1 of the contract package 043 — removal of the fields deprecated
 * since 0.2.0, `SpeakerUpdate.reason`, the five documented status gaps of review 012 point 18, the
 * shared `InternalError` and the contract form of a refusal (Verweigerung, ADR 0012 model A).
 * Tests 1–14 of the spec (`docs/slices/043a-vertrag-bereinigung-verweigerung.md`, "Tests zuerst"),
 * against the loaded `openapiDoc` and, where the spec says so, over `req()`. Neither core nor service
 * change with 0.4.0; the three refusal operations stay unserved until slice 044.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import type { DomainEvent } from '@hv/domain';
import type { App } from '../app.ts';
import { createApp } from '../app.ts';
import { ACTOR, OPERATIONS_0_2, UNDOCUMENTED_STATUS_EXCEPTIONS, req } from './helpers.ts';
import { allOperationIds, documentedStatuses, expectValid, openapiDoc, operations, paramsFor } from '../contractSchema.ts';

const schemas = openapiDoc.components.schemas;

// One schema validator per component, compiled against the whole document (same settings as the service).
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(openapiDoc, 'openapi');
const validators = new Map<string, ValidateFunction>();
function validSchema(name: string, value: unknown): boolean {
  let validate = validators.get(name);
  if (validate === undefined) {
    validate = ajv.compile({ $ref: `openapi#/components/schemas/${name}` });
    validators.set(name, validate);
  }
  return validate(value);
}

function responseOf(operationId: string, status: string): Record<string, unknown> {
  const op = operations[operationId]!;
  return openapiDoc.paths[op.path][op.method].responses[status] as Record<string, unknown>;
}

function requestBodySchemaOf(operationId: string): Record<string, unknown> {
  const op = operations[operationId]!;
  const schema = openapiDoc.paths[op.path][op.method].requestBody.content['application/json'].schema as Record<string, unknown>;
  const ref = schema['$ref'] as string | undefined;
  return ref === undefined ? schema : schemas[ref.split('/').pop()!];
}

const sortedKeys = (value: unknown): string[] => Object.keys(value as object).sort();

describe('Scheibe 043a: contract 0.4.0 — removals and the speaker reason', () => {
  it('1: info.version is 0.4.0 or a later 0.4 patch (0.4.1 since slice 040b)', () => {
    expect(openapiDoc.info.version).toMatch(/^0\.4\.\d+$/);
  });

  it('2: Speaker, SpeakerRegistration and SpeakerUpdate carry neither kind nor requestedMinutes', () => {
    for (const name of ['Speaker', 'SpeakerRegistration', 'SpeakerUpdate']) {
      expect(schemas[name].properties, name).not.toHaveProperty('kind');
      expect(schemas[name].properties, name).not.toHaveProperty('requestedMinutes');
      expect(schemas[name].required ?? [], name).not.toContain('kind');
    }
  });

  it('3a: SpeakerUpdate is exactly {status, round, reason}, reason is the enum [follow_up], updateSpeaker documents 409', () => {
    expect(sortedKeys(schemas.SpeakerUpdate.properties)).toEqual(['reason', 'round', 'status']);
    expect(schemas.SpeakerUpdate.properties.reason.enum).toEqual(['follow_up']);
    expect(documentedStatuses('updateSpeaker')).toContain('409');
    const conflict = responseOf('updateSpeaker', '409');
    expect(conflict['description']).toMatch(/R-SPK-00/);
    expect(conflict['description']).toMatch(/R-SPK-GUARD-01/);
  });
});

describe('Scheibe 043a: speaker reason and an ignored kind over HTTP', () => {
  let app: App;
  let stored: readonly DomainEvent[] = [];

  beforeAll(async () => {
    app = createApp({ demoEnabled: true, persistence: { load: () => undefined, save: (all) => { stored = all; } } });
    const res = await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 20, seed: 43 } });
    expect(res.status).toBe(200);
  });

  async function speakerListTag(): Promise<string> {
    return (await req(app, 'GET', '/v1/speakers', { actor: ACTOR.moderation })).headers.get('ETag')!;
  }

  async function registerSpeaker(body: Record<string, unknown>): Promise<Response> {
    return req(app, 'POST', '/v1/speakers', { actor: ACTOR.moderation, headers: { 'If-Match': await speakerListTag() }, body });
  }

  async function patchSpeaker(id: string, version: number, body: Record<string, unknown>): Promise<Response> {
    return req(app, 'PATCH', `/v1/speakers/${id}`, { actor: ACTOR.moderation, headers: { 'If-Match': `"v${version}"` }, body });
  }

  /** A fresh speaker moved through waiting → speaking → finished. */
  async function finishedSpeaker(name: string): Promise<{ id: string; version: number }> {
    let speaker = await (await registerSpeaker({ displayName: name })).json();
    for (const status of ['speaking', 'finished']) {
      const res = await patchSpeaker(speaker.id, speaker.version, { status });
      expect(res.status).toBe(200);
      speaker = await res.json();
    }
    expect(speaker.status).toBe('finished');
    return speaker;
  }

  it('3b: a reason outside the enum is a 422', async () => {
    const speaker = await finishedSpeaker('Grundprobe');
    const res = await patchSpeaker(speaker.id, speaker.version, { status: 'waiting', reason: 'x' });
    expect(res.status).toBe(422);
    expect((await res.json()).detail).toContain('reason');
  });

  it('3c: finished → waiting with reason follow_up is a 200 (R-SPK-05)', async () => {
    const speaker = await finishedSpeaker('Nachfrage');
    const res = await patchSpeaker(speaker.id, speaker.version, { status: 'waiting', reason: 'follow_up' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expectValid('updateSpeaker', 200, body);
    expect(body.status).toBe('waiting');
  });

  it('3d: finished → waiting without a reason is a 409 with ruleId R-SPK-GUARD-01', async () => {
    const speaker = await finishedSpeaker('Ohne Grund');
    const res = await patchSpeaker(speaker.id, speaker.version, { status: 'waiting' });
    expect(res.status).toBe(409);
    const problem = await res.json();
    expectValid('updateSpeaker', 409, problem, 'application/problem+json');
    expect(problem.ruleId).toBe('R-SPK-GUARD-01');
  });

  it('11: a removed kind is ignored — 201, and neither the response nor the event SpeakerRegistered carries it', async () => {
    const res = await registerSpeaker({ displayName: 'Art egal', kind: 'space-alien' });
    expect(res.status).toBe(201);
    const speaker = await res.json();
    expectValid('registerSpeaker', 201, speaker);
    expect(speaker).not.toHaveProperty('kind');

    const feed = await (await req(app, 'GET', '/v1/events?limit=5000', { actor: ACTOR.admin })).json();
    const read = (feed.items as { type: string; subjectId: string; payload: Record<string, unknown> }[])
      .find((event) => event.type === 'SpeakerRegistered' && event.subjectId === speaker.id);
    expect(read).toBeDefined();
    expect(read!.payload).not.toHaveProperty('kind');
    expect(JSON.stringify(read)).not.toContain('space-alien');

    // The stored original, not only the masked read projection (R7: nothing unchecked reaches the log).
    const original = stored.find((event) => event.type === 'SpeakerRegistered' && event.subjectId === speaker.id);
    expect(original).toBeDefined();
    expect(JSON.stringify(original)).not.toContain('space-alien');
  });
});

describe('Scheibe 043a: documented statuses and InternalError', () => {
  it('4: every 0.2 operation documents 401; listQuestions, returnQuestion, withdrawQuestion document 422; no exception is left', () => {
    for (const operationId of OPERATIONS_0_2) expect(documentedStatuses(operationId), operationId).toContain('401');
    for (const operationId of ['listQuestions', 'returnQuestion', 'withdrawQuestion']) {
      expect(documentedStatuses(operationId), operationId).toContain('422');
    }
    expect(UNDOCUMENTED_STATUS_EXCEPTIONS).toEqual({});
  });

  it('5a: every operation documents 500 with InternalError, outside /v1 included', () => {
    const missing = allOperationIds.filter((operationId) =>
      responseOf(operationId, '500')?.['$ref'] !== '#/components/responses/InternalError');
    expect(missing).toEqual([]);
    for (const operationId of ['getHealth', 'getReadiness', 'getMetrics', 'login', 'completeLogin', 'logout', 'getSession', 'getTransparencyNotice']) {
      expect(documentedStatuses(operationId), operationId).toContain('500');
    }
  });

  it('5b: InternalError is a 500 problem with X-Server-Time and names the four detail texts', () => {
    const internal = openapiDoc.components.responses.InternalError;
    expect(internal.headers).toHaveProperty('X-Server-Time');
    expect(internal.headers).not.toHaveProperty('Retry-After');
    expect(internal.content['application/problem+json'].schema.allOf[1].properties.status.const).toBe(500);
    for (const detail of ['Event seq N: integrity check failed.', 'Persistence outcome is unknown.',
      'Persistence is unavailable.', 'An unexpected error occurred.']) {
      expect(internal.description).toContain(detail);
    }
  });

  it('the service still produces exactly these four detail texts (the description is not a wish)', () => {
    const app = readFileSync(new URL('../app.ts', import.meta.url), 'utf8');
    const responses = readFileSync(new URL('../limits/responses.ts', import.meta.url), 'utf8');
    const problem = readFileSync(new URL('../problem.ts', import.meta.url), 'utf8');
    expect(app).toContain('integrity check failed.');
    expect(app).toContain("'Persistence is unavailable.'");
    expect(responses).toContain("'Persistence outcome is unknown.'");
    expect(problem).toContain("'An unexpected error occurred.'");
  });
});

describe('Scheibe 043a: refusal as a kind of answer (ADR 0012 model A)', () => {
  const baseVersion = {
    version: 2,
    text: 'Zu dieser Frage erteilt der Vorstand keine Auskunft.',
    createdAt: '2026-10-03T09:00:00Z',
    createdBy: { id: 'leg', role: 'legal' },
  };
  const hash = 'a'.repeat(64);

  it('6: AnswerKind has exactly three values, AnswerVersion.required is unchanged, invariants hold', () => {
    expect(schemas.AnswerKind.enum).toEqual(['answer', 'refusal_no_claim', 'refusal_with_ground']);
    expect(schemas.AnswerVersion.required).toEqual(['version', 'text', 'createdAt', 'createdBy']);
    const cases: [string, Record<string, unknown>, boolean][] = [
      ['no answerKind', {}, true],
      ['answer with refusalGroundId', { answerKind: 'answer', refusalGroundId: 'g' }, false],
      ['path B with ground and hash, no justification', { answerKind: 'refusal_with_ground', refusalGroundId: 'g', refusalGroundHash: hash }, true],
      ['path B without refusalGroundHash', { answerKind: 'refusal_with_ground', refusalGroundId: 'g' }, false],
      ['path B without refusalGroundId', { answerKind: 'refusal_with_ground', refusalGroundHash: hash }, false],
      ['answer with refusalJustification', { answerKind: 'answer', refusalJustification: 'j' }, false],
      ['answer with refusalGroundHash', { answerKind: 'answer', refusalGroundHash: hash }, false],
      ['path A with refusalGroundId', { answerKind: 'refusal_no_claim', refusalGroundId: 'g' }, false],
      ['path A with refusalJustification only', { answerKind: 'refusal_no_claim', refusalJustification: 'j' }, true],
    ];
    for (const [name, refusal, valid] of cases) {
      expect(validSchema('AnswerVersion', { ...baseVersion, ...refusal }), name).toBe(valid);
    }
  });

  it('7: RefusalProposal is closed, has no answer kind, leaves path B to the guard and rejects a ground on path A', () => {
    expect(schemas.RefusalProposal.properties.answerKind.enum).not.toContain('answer');
    expect(schemas.RefusalProposal.additionalProperties).toBe(false);
    expect(validSchema('RefusalProposal', { answerKind: 'refusal_with_ground', text: 'x' })).toBe(true);
    expect(validSchema('RefusalProposal', { answerKind: 'answer', text: 'x' })).toBe(false);
    expect(validSchema('RefusalProposal', { answerKind: 'refusal_no_claim', text: 'x', refusalGroundId: 'g' })).toBe(false);
    expect(validSchema('RefusalProposal', { answerKind: 'refusal_no_claim', text: 'x', unknown: true })).toBe(false);
  });

  it('8: the three operations exist with their paths and responses, are pre-declared for 044, approveRefusal is closed', () => {
    const plus = (operationId: string, extra: string[]) => [...new Set([...documentedStatuses(operationId), ...extra])].sort();
    expect(operations['listRefusalGrounds']).toMatchObject({ path: '/refusal-grounds', method: 'get' });
    expect(documentedStatuses('listRefusalGrounds').sort()).toEqual(['200', '401', '403', '408', '429', '500', '503']);
    expect(responseOf('listRefusalGrounds', '200')).toMatchObject({
      content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RefusalGround' } } } },
    });
    expect(operations['proposeRefusal']).toMatchObject({ path: '/questions/{questionId}/refusals', method: 'post' });
    expect(documentedStatuses('proposeRefusal').sort()).toEqual(plus('draftAnswer', ['401', '500']));
    expect(operations['approveRefusal']).toMatchObject({ path: '/questions/{questionId}/refusal-approvals', method: 'post' });
    expect(documentedStatuses('approveRefusal').sort()).toEqual(plus('approveQuestion', ['401', '500']));
    for (const operationId of ['proposeRefusal', 'approveRefusal']) {
      const headers = paramsFor(operationId).filter((p) => p.in === 'header').map((p) => p.name).sort();
      expect(headers, operationId).toEqual(['Idempotency-Key', 'If-Match', 'X-CSRF-Token']);
    }
    expect(responseOf('proposeRefusal', '409')['description']).toMatch(/R-GUARD-09/);
    for (const rule of ['R-GUARD-06', 'R-GUARD-08', 'R-GUARD-11']) {
      expect(responseOf('approveRefusal', '409')['description']).toMatch(rule);
    }
    expect(requestBodySchemaOf('proposeRefusal')).toBe(schemas.RefusalProposal);
    const approval = requestBodySchemaOf('approveRefusal');
    expect(approval['additionalProperties']).toBe(false);
    expect(sortedKeys(approval['properties'])).toEqual(['answerVersion']);

    const allowlist = JSON.parse(readFileSync(new URL('../../../../packages/contract/allowlist.json', import.meta.url), 'utf8')) as
      { operationId: string; slice: string; expires: string }[];
    for (const operationId of ['listRefusalGrounds', 'proposeRefusal', 'approveRefusal']) {
      expect(allowlist.find((entry) => entry.operationId === operationId), operationId)
        .toMatchObject({ slice: '044', expires: '2026-11-27' });
    }
  });

  it('9: Action carries question.refuse.propose and question.refuse.approve', () => {
    expect(schemas.Action.enum).toEqual(expect.arrayContaining(['question.refuse.propose', 'question.refuse.approve']));
  });

  it('10: no silent widening of an existing request schema (rule 1 of the split)', () => {
    expect(sortedKeys(schemas.AnswerDraft.properties)).toEqual(['sources', 'text']);
    expect(sortedKeys(requestBodySchemaOf('approveQuestion')['properties'])).toEqual(['answerVersion']);
    // `seatId` is the contract line of slice 040b (0.4.1), written with that slice's implementation.
    expect(sortedKeys(schemas.Classification.properties)).toEqual(['agendaItemId', 'seatId', 'stageAssignment', 'track']);
    expect(sortedKeys(schemas.SpeakerRegistration.properties)).toEqual(['displayName', 'organisation', 'round']);
  });

  it('12: LegalRef has the domain form, null allowed for docVersion and docHash, docHash required', () => {
    expect(schemas.LegalRef.required).toEqual(['source', 'citation', 'docVersion', 'docHash', 'verified']);
    const ref = { source: 'AktG', citation: '§ 131 Abs. 3 AktG', docVersion: null, docHash: null, verified: false };
    expect(validSchema('LegalRef', ref)).toBe(true);
    const { docHash: _omitted, ...withoutHash } = ref;
    expect(validSchema('LegalRef', withoutHash)).toBe(false);
  });

  it('13: EventRead never carries payload.answer.refusalJustification', () => {
    expect(schemas.EventRead.properties.payload.properties.answer.properties.refusalJustification).toBe(false);
    const event = {
      seq: 7,
      id: 'e-7',
      type: 'AnswerDrafted',
      at: '2026-10-03T09:00:00Z',
      actor: { id: 'leg', role: 'legal' },
      subjectId: 'q-1',
      payload: { answer: { version: 2, text: 'Keine Auskunft.', answerKind: 'refusal_no_claim' } },
      redacted: true,
      sourceHash: '0'.repeat(64),
    };
    expectValid('listEvents', 200, { items: [event], lastSeq: 7 });
    const leaking = { ...event, payload: { answer: { ...event.payload.answer, refusalJustification: 'Rechtseinschätzung' } } };
    expect(() => expectValid('listEvents', 200, { items: [leaking], lastSeq: 7 })).toThrow();
  });

  it('14: RefusalGround requires hash; refusalGroundHash is a Sha256Hex; the hash definition is spelled out', () => {
    expect(schemas.RefusalGround.required).toContain('hash');
    expect(schemas.AnswerVersion.properties.refusalGroundHash.allOf).toEqual([{ $ref: '#/components/schemas/Sha256Hex' }]);
    const definition = schemas.RefusalGround.properties.hash.description as string;
    expect(definition).toMatch(/RFC 8785/);
    expect(definition).toMatch(/UTF-8/);
    expect(definition).toMatch(/lower-case hex/);
    expect(definition).toMatch(/without the field `hash`/);
  });
});
