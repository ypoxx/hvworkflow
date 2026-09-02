/**
 * Loads `packages/contract/openapi.yaml` (the single source of truth, AGENTS.md rule 6) once and
 * compiles Ajv validators from it — for the test suite (response bodies) and, since the rework
 * review (blocker 1/2), for the server itself: every request body, query parameter and the
 * `Idempotency-Key`/`If-Match` headers are checked against the contract's own schemas before a
 * request ever reaches `HvApi`, so a malformed or contract-violating request never reaches the
 * domain or the append-only event log.
 *
 * OpenAPI 3.1 schemas are JSON Schema 2020-12 (`Ajv2020`); the document also carries OpenAPI
 * keywords Ajv does not know (`example`, `discriminator`, ...), so `strict` is off.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const contractPath = require.resolve('@hv/contract/openapi.yaml');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openapiDoc: any = parse(readFileSync(contractPath, 'utf8'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(openapiDoc, 'openapi');

export function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Plain JSON Pointer (RFC 6901) navigation of the raw document — no `$ref` following mid-path. */
export function resolvePointer(ref: string): unknown {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported external $ref "${ref}".`);
  let node: unknown = openapiDoc;
  for (const raw of ref.slice(2).split('/')) {
    const segment = unescapePointerSegment(raw);
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

/** Follows `.$ref` repeatedly until it reaches a node that is not itself a bare reference. */
function derefFully(node: unknown): unknown {
  let current = node;
  let guard = 0;
  while (current && typeof current === 'object' && '$ref' in (current as Record<string, unknown>)) {
    current = resolvePointer((current as { $ref: string }).$ref);
    if (++guard > 20) throw new Error('Circular $ref while resolving the contract.');
  }
  return current;
}

interface Operation {
  path: string;
  method: string;
}

/** operationId -> {path, method}, derived from the document so it can never drift from it. */
export const operations: Record<string, Operation> = {};
for (const [p, methods] of Object.entries(openapiDoc.paths as Record<string, Record<string, unknown>>)) {
  for (const [method, op] of Object.entries(methods)) {
    if (method === 'parameters') continue;
    const operationId = (op as { operationId?: string }).operationId;
    if (operationId) operations[operationId] = { path: p, method };
  }
}
export const allOperationIds: readonly string[] = Object.keys(operations);

function operationOf(operationId: string): Operation {
  const op = operations[operationId];
  if (!op) throw new Error(`Unknown operationId "${operationId}" — not in packages/contract/openapi.yaml.`);
  return op;
}

/**
 * Many responses (and this rework's parameters) in the contract are themselves `$ref`s to a shared
 * object (e.g. every question-changing operation's `200` is `#/components/responses/QuestionUpdated`,
 * every `403` is `#/components/responses/Forbidden`). A JSON Pointer walk does not follow that kind
 * of reference mid-path — it is plain structural navigation, not schema `$ref` resolution — so every
 * pointer builder below resolves such a node's own `$ref` first and builds the pointer from wherever
 * it actually points, so nested schema `$ref`s (e.g. `#/components/schemas/Question`) still resolve
 * against the whole document when Ajv compiles them.
 */
function responseBasePointer(op: Operation, status: number | string): string {
  const responses = (openapiDoc.paths[op.path][op.method] as { responses: Record<string, unknown> }).responses;
  const node = responses[String(status)];
  if (node && typeof node === 'object' && '$ref' in node) {
    return `openapi${(node as { $ref: string }).$ref}`;
  }
  return `openapi#/paths/${escapePointer(op.path)}/${op.method}/responses/${status}`;
}

const validatorCache = new Map<string, ValidateFunction>();
function compileRef(cacheKey: string, ref: string): ValidateFunction {
  const cached = validatorCache.get(cacheKey);
  if (cached) return cached;
  const validate = ajv.compile({ $ref: ref });
  validatorCache.set(cacheKey, validate);
  return validate;
}

/** Compile (and cache) the validator for one operation's response body schema. */
function responseValidator(operationId: string, status: number | string, contentType: string): ValidateFunction {
  const op = operationOf(operationId);
  const ref = `${responseBasePointer(op, status)}/content/${escapePointer(contentType)}/schema`;
  return compileRef(`res:${operationId}:${status}:${contentType}`, ref);
}

/** Assert that `body` matches the response schema the contract declares for this operation/status. */
export function expectValid(
  operationId: string,
  status: number | string,
  body: unknown,
  contentType = 'application/json',
): void {
  const validate = responseValidator(operationId, status, contentType);
  if (!validate(body)) {
    throw new Error(
      `Response body for "${operationId}" (${status}) does not match its contract schema:\n` +
        `${JSON.stringify(validate.errors, null, 2)}\n\nBody: ${JSON.stringify(body, null, 2)}`,
    );
  }
}

/**
 * Every error response in the contract (401 is undeclared per-operation, but 403/404/409/412/422 all
 * are) shares the one `Problem` schema (RFC 9457). Validating against it directly — rather than via
 * a specific operation/status pair — covers 401 too and is the more direct assertion for any of them.
 */
export function expectValidProblem(body: unknown): void {
  const validate = compileRef('schema:Problem', 'openapi#/components/schemas/Problem');
  if (!validate(body)) {
    throw new Error(
      `Problem body does not match the contract's Problem schema:\n` +
        `${JSON.stringify(validate.errors, null, 2)}\n\nBody: ${JSON.stringify(body, null, 2)}`,
    );
  }
}

/** Turn Ajv errors into one readable sentence for a problem `detail` (path + message per error). */
export function describeErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return 'Validation failed.';
  return errors.map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`.trim()).join('; ');
}

// ---- request bodies ---------------------------------------------------------------------------

function requestBodyPointer(op: Operation): string | undefined {
  const opNode = openapiDoc.paths[op.path][op.method] as { requestBody?: unknown };
  const rb = opNode.requestBody;
  if (!rb) return undefined;
  if (typeof rb === 'object' && rb !== null && '$ref' in rb) return `openapi${(rb as { $ref: string }).$ref}`;
  return `openapi#/paths/${escapePointer(op.path)}/${op.method}/requestBody`;
}

/** The validator for an operation's request body, or `undefined` if the contract declares none. */
export function requestBodyValidator(operationId: string, contentType = 'application/json'): ValidateFunction | undefined {
  const op = operationOf(operationId);
  const base = requestBodyPointer(op);
  if (!base) return undefined;
  const ref = `${base}/content/${escapePointer(contentType)}/schema`;
  return compileRef(`req:${operationId}:${contentType}`, ref);
}

// ---- parameters (query + header) --------------------------------------------------------------

export interface ParamSpec {
  name: string;
  in: string;
  schemaPointer: string;
}

/** Every parameter (path-item-level and operation-level, `$ref`s resolved) declared for an operation. */
export function paramsFor(operationId: string): ParamSpec[] {
  const op = operationOf(operationId);
  const pathItem = openapiDoc.paths[op.path] as { parameters?: unknown[] };
  const opNode = openapiDoc.paths[op.path][op.method] as { parameters?: unknown[] };
  const raw: { node: Record<string, unknown>; pointer: string }[] = [
    ...(pathItem.parameters ?? []).map((node, i) => ({
      node: node as Record<string, unknown>,
      pointer: `openapi#/paths/${escapePointer(op.path)}/parameters/${i}`,
    })),
    ...(opNode.parameters ?? []).map((node, i) => ({
      node: node as Record<string, unknown>,
      pointer: `openapi#/paths/${escapePointer(op.path)}/${op.method}/parameters/${i}`,
    })),
  ];
  return raw.map(({ node, pointer }) => {
    if ('$ref' in node) {
      const ref = node['$ref'] as string;
      const resolved = resolvePointer(ref) as { name: string; in: string };
      return { name: resolved.name, in: resolved.in, schemaPointer: `openapi${ref}/schema` };
    }
    return { name: node['name'] as string, in: node['in'] as string, schemaPointer: `${pointer}/schema` };
  });
}

function paramValidator(schemaPointer: string): ValidateFunction {
  return compileRef(`param:${schemaPointer}`, schemaPointer);
}

/** The (still possibly-`$ref`) schema a parameter pointer resolves to, fully dereferenced. */
function schemaAtPointer(schemaPointer: string): Record<string, unknown> | undefined {
  const hash = schemaPointer.indexOf('#');
  return derefFully(resolvePointer(schemaPointer.slice(hash))) as Record<string, unknown> | undefined;
}

/** Coerce a raw header/query string to the JSON type the contract declares, for Ajv to check. */
export function coerceParamValue(raw: string, schemaPointer: string): unknown {
  const schema = schemaAtPointer(schemaPointer);
  const type = schema?.['type'];
  if (type === 'integer' || type === 'number') {
    const trimmed = raw.trim();
    if (trimmed === '' || Number.isNaN(Number(trimmed))) return raw; // let Ajv report the type mismatch
    return Number(trimmed);
  }
  if (type === 'array') {
    // Every array query parameter in the contract is `style: form, explode: false` (comma-separated).
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return raw;
}

/** Validate one query or header value against its contract schema; returns the coerced value. */
export function validateParam(spec: ParamSpec, raw: string): { value: unknown; errors: ErrorObject[] | null } {
  const value = coerceParamValue(raw, spec.schemaPointer);
  const validate = paramValidator(spec.schemaPointer);
  const ok = validate(value);
  return { value, errors: ok ? null : (validate.errors ?? null) };
}
