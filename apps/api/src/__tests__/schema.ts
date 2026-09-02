/**
 * Loads `packages/contract/openapi.yaml` (the single source of truth, AGENTS.md rule 6) once and
 * compiles Ajv validators for each operation's response schema, so every contract test asserts
 * against the contract itself rather than a hand-copied expectation.
 *
 * OpenAPI 3.1 schemas are JSON Schema 2020-12 (`Ajv2020`); the document also carries OpenAPI
 * keywords Ajv does not know (`example`, `discriminator`, ...), so `strict` is off.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const contractPath = require.resolve('@hv/contract/openapi.yaml');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openapiDoc: any = parse(readFileSync(contractPath, 'utf8'));

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(openapiDoc, 'openapi');

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
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

/**
 * Many responses in the contract are themselves `$ref`s to a shared response object (e.g. every
 * question-changing operation's `200` is `#/components/responses/QuestionUpdated`, every `403` is
 * `#/components/responses/Forbidden`). A JSON Pointer walk does not follow that kind of reference
 * mid-path — it is plain structural navigation, not schema `$ref` resolution — so this resolves the
 * response node's own `$ref` first and builds the pointer from wherever it actually points.
 */
function responseBasePointer(op: Operation, status: number | string): string {
  const responses = (openapiDoc.paths[op.path][op.method] as { responses: Record<string, unknown> }).responses;
  const node = responses[String(status)];
  if (node && typeof node === 'object' && '$ref' in node) {
    return `openapi${(node as { $ref: string }).$ref}`; // '#/components/...' -> 'openapi#/components/...'
  }
  return `openapi#/paths/${escapePointer(op.path)}/${op.method}/responses/${status}`;
}

const validatorCache = new Map<string, ValidateFunction>();

/** Compile (and cache) the validator for one operation's response body schema. */
function responseValidator(operationId: string, status: number | string, contentType: string): ValidateFunction {
  const cacheKey = `${operationId}:${status}:${contentType}`;
  const cached = validatorCache.get(cacheKey);
  if (cached) return cached;
  const op = operations[operationId];
  if (!op) throw new Error(`Unknown operationId "${operationId}" — not in packages/contract/openapi.yaml.`);
  const ref = `${responseBasePointer(op, status)}/content/${escapePointer(contentType)}/schema`;
  const validate = ajv.compile({ $ref: ref });
  validatorCache.set(cacheKey, validate);
  return validate;
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
