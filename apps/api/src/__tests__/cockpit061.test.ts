/**
 * Scheibe 061, part A (service and catalogue): `GET /v1/meetings/{meetingId}/cockpit`, the report
 * `leitstand` in the evaluation catalogue and `/metrics` unchanged (docs/slices/061-leitstand.md,
 * tests A1–A3, A5–A7; A4 runs on Postgres in `postgres-cockpit061.test.ts`).
 * Threat ids: R-PERM-02, MF-17 / T-G1-I-01 (only the contract's leaf paths), T-G2-D-03.
 * Synthetic corpus only.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COCKPIT_REPORT, computeIndicators, createInMemoryEventStore, createInProcessApi, CORPUS_DEMO, seedEvents, SYSTEM_ACTOR,
  type Cockpit, type DomainEvent,
} from '@hv/domain';
import { createApp } from '../app.ts';
import { openapiDoc, resolvePointer } from '../contractSchema.ts';
import { renderMetrics } from '../metrics/prometheus.ts';
import catalogJson from '../metrics/catalog.json' with { type: 'json' };
import { ACTOR, req } from './helpers.ts';

const fixed = new Date('2031-05-06T07:08:09.000Z');
const COORDINATION = 'coord-061:coordination';
const HOLDERS = [ACTOR.moderation, COORDINATION, ACTOR.admin] as const;

/** A seeded service whose saved log the test can read back (same store, same clock). */
async function seeded() {
  let saved: readonly DomainEvent[] = [];
  let now = fixed;
  const app = createApp({ demoEnabled: true, clock: () => now,
    persistence: { load: () => saved, save: (all) => { saved = all; } } });
  expect((await req(app, 'POST', '/v1/demo/seed', { actor: ACTOR.admin, body: { questions: 230, seed: 2027 } })).status).toBe(200);
  const meetingId = saved.find((e) => e.type === 'MeetingCreated')!.subjectId;
  return { app, meetingId, events: () => saved, advance(ms: number) { now = new Date(now.getTime() + ms); }, now: () => now };
}

/* ---------- leaf paths of a schema and of a value (A7) ---------- */

type Schema = { $ref?: string; type?: string | string[]; properties?: Record<string, Schema>; additionalProperties?: boolean | Schema;
  items?: Schema };
const resolve = (schema: Schema): Schema => (schema.$ref !== undefined ? resolve(resolvePointer(schema.$ref) as Schema) : schema);

/** Every leaf path the schema allows: `.name` for a property, `[]` for an array item, `.*` for a map value. */
function schemaLeaves(input: Schema, prefix: string): string[] {
  const schema = resolve(input);
  if (schema.properties !== undefined) {
    return Object.entries(schema.properties).flatMap(([name, sub]) => schemaLeaves(sub, prefix === '' ? name : `${prefix}.${name}`));
  }
  if (typeof schema.additionalProperties === 'object') return schemaLeaves(schema.additionalProperties, `${prefix}.*`);
  if (schema.items !== undefined) {
    const item = resolve(schema.items);
    return item.properties !== undefined || typeof item.additionalProperties === 'object'
      ? schemaLeaves(item, `${prefix}[]`) : [`${prefix}[]`];
  }
  return [prefix];
}

/** Every leaf path a value takes, read against the schema; a key the schema does not know yields `?name`. */
function valueLeaves(value: unknown, input: Schema, prefix: string): string[] {
  const schema = resolve(input);
  if (Array.isArray(value)) {
    const item = resolve(schema.items ?? {});
    const nested = item.properties !== undefined || typeof item.additionalProperties === 'object';
    return nested ? value.flatMap((entry) => valueLeaves(entry, item, `${prefix}[]`)) : value.length > 0 ? [`${prefix}[]`] : [];
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, sub]) => {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (schema.properties?.[key] !== undefined) return valueLeaves(sub, schema.properties[key]!, path);
      if (typeof schema.additionalProperties === 'object') return valueLeaves(sub, schema.additionalProperties, `${prefix}.*`);
      return [`?${path}`];
    });
  }
  return [prefix];
}

const COCKPIT_SCHEMA: Schema = { $ref: '#/components/schemas/Cockpit' };

describe('A1 200 for coordination, valid against the contract, with X-Server-Time', () => {
  it('answers the figures of the meeting', async () => {
    const { app, meetingId } = await seeded();
    const res = await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`, { actor: COORDINATION });
    expect(res.status).toBe(200); // `req` validates the body against the contract schema
    expect(res.headers.get('X-Server-Time')).toBe(fixed.toISOString());
    const body = await res.json() as Cockpit;
    expect(body.meetingId).toBe(meetingId);
    expect(body.asOf).toBe(fixed.toISOString());
    expect(body.totals.captured).toBe(CORPUS_DEMO.questions);
    expect(body.inflow.bins).toHaveLength(12);
  });
});

describe('A2 refusals', () => {
  it('403 R-PERM-02 for expert and observer, 401 without actor, 404 for an unknown meeting', async () => {
    const { app, meetingId } = await seeded();
    for (const actor of [ACTOR.expert, ACTOR.observer]) {
      const res = await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`, { actor });
      expect(res.status, actor).toBe(403);
      const problem = await res.json() as { ruleId?: string; totals?: unknown };
      expect(problem.ruleId).toBe('R-PERM-02');
      expect(problem.totals).toBeUndefined();
    }
    expect((await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`)).status).toBe(401);
    expect((await req(app, 'GET', '/v1/meetings/hv-1999/cockpit', { actor: COORDINATION })).status).toBe(404);
  });
});

describe('A3 the HTTP answer equals getCockpit in-process', () => {
  it('for the same store and the same clock, also after the clock moves', async () => {
    const service = await seeded();
    for (const step of [0, 600_000]) {
      service.advance(step);
      const res = await req(service.app, 'GET', `/v1/meetings/${service.meetingId}/cockpit`, { actor: COORDINATION });
      const store = createInMemoryEventStore({ load: () => service.events(), save: () => undefined });
      const inProcess = createInProcessApi({ store, meetingId: service.meetingId, clock: service.now,
        actor: () => ({ id: 'coord-061', role: 'coordination' }) });
      expect(await res.json()).toEqual(await inProcess.getCockpit());
    }
  });
});

describe('A5 /metrics unchanged (golden fixture committed before indicators.ts changed)', () => {
  it('renderMetrics for the seed at a fixed clock equals metrics-golden-061.txt', () => {
    const store = createInMemoryEventStore();
    store.append(seedEvents({ ...CORPUS_DEMO, now: fixed, actor: SYSTEM_ACTOR }));
    const text = [120_000, 900_000]
      .map((ms) => renderMetrics(computeIndicators(store.all(), new Date(fixed.getTime() + ms)), 0)).join('');
    const golden = readFileSync(new URL('./fixtures/metrics-golden-061.txt', import.meta.url), 'utf8');
    expect(text).toBe(golden);
  });
});

describe('A6 the report in catalog.json equals COCKPIT_REPORT', () => {
  it('fields, aggregation, minimum group size, permission and operation', () => {
    const reports = (catalogJson as { reports?: unknown[] }).reports;
    const report = reports?.find((r) => (r as { id: string }).id === 'leitstand');
    expect(report).toEqual(JSON.parse(JSON.stringify(COCKPIT_REPORT)));
    expect(openapiDoc.paths['/meetings/{meetingId}/cockpit'].get.operationId).toBe(COCKPIT_REPORT.operationId);
    expect(openapiDoc.components.schemas.Action.enum).toContain(COCKPIT_REPORT.permission);
  });
});

describe('A7 allowlist from the contract', () => {
  it('the leaf paths of Cockpit equal the report fields; every answer of the three holders stays inside them', async () => {
    const allowed = schemaLeaves(COCKPIT_SCHEMA, '');
    expect([...allowed].sort()).toEqual(COCKPIT_REPORT.fields.map((f) => f.path).sort());
    expect(allowed).toContain('inflow.binSeconds');
    expect(allowed).toContain('legalReview.items[].reviewAgeSeconds');
    expect(allowed).not.toContain('oldestOpen.items[].reviewAgeSeconds');
    const { app, meetingId, advance } = await seeded();
    advance(900_000); // so legal clearing over 10 minutes has references
    for (const actor of HOLDERS) {
      const body = await (await req(app, 'GET', `/v1/meetings/${meetingId}/cockpit`, { actor })).json();
      const paths = new Set(valueLeaves(body, COCKPIT_SCHEMA, ''));
      expect([...paths].filter((path) => !allowed.includes(path)), actor).toEqual([]);
      expect(paths.has('legalReview.items[].reviewAgeSeconds'), actor).toBe(true);
    }
  });
});
