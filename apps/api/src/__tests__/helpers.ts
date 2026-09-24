/**
 * Tiny `fetch`-shaped request helper for driving `app.request()` (Hono's in-process test client).
 *
 * Slice 012, point 7: every response of every call made through `req()` — in every `*.test.ts` file
 * under this directory — is checked against `packages/contract/openapi.yaml` before the response is
 * handed back to the caller: the status code must be one the contract documents for the matched
 * operation, and the body must match that status's schema (the shared `Problem` schema for 4xx).
 * `res.clone()` keeps the body readable for the caller's own `await res.json()` afterwards.
 *
 * The contract has a handful of gaps this uncovers. Per the slice's spec, the contract and the
 * service are *not* changed to close them here (that is 019, contract 0.2.0); each gap gets one
 * reasoned exception below instead of silently skipping validation.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { inject } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';
import type { App } from '../app.ts';
import {
  documentedStatuses,
  escapePointer,
  expectValid,
  expectValidProblem,
  matchOperationId,
  openapiDoc,
  operations,
  resolvePointer,
} from '../contractSchema.ts';

/**
 * Operation-coverage gate (slice 023, goal 5): every `operationId` a test reaches through `req()` is
 * appended to a per-process hit file; `operation-coverage.setup.ts` (Vitest `globalSetup`) folds the
 * files of all workers after the run and checks the contract against them and the allowlist. The
 * directory comes from that setup through `provide()`/`inject()` — the only channel from the main
 * process into isolated workers. Appends are O_APPEND-atomic for lines this short, so one file per
 * process is enough even under the threads pool.
 *
 * Review 023, point 2: a hit is recorded only for a *documented 2xx/3xx* response — never for an
 * excepted 401, never for a 4xx/5xx, and therefore never for the 404 the not-found fallback in
 * `app.ts` returns for a route the server does not mount (that 404 is a valid problem and many
 * operations document 404, so it used to count as "exercised" although nothing was).
 */
function recordOperationHit(operationId: string): void {
  const dir = inject('operationCoverageDir') as string | undefined;
  if (dir === undefined) return; // not running under apps/api/vitest.config.ts — nothing to record into
  appendFileSync(join(dir, `${process.pid}.log`), `${operationId}\n`);
}

export interface ReqOptions {
  actor?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Status codes the contract does not document for the given operation, but that the service
 * legitimately returns today. `'*'` applies to every operation. Every entry is a deliberate,
 * reasoned exception (never a silent gap) — closing them is tracked for slice 019 (contract 0.2.0).
 */
const UNDOCUMENTED_STATUS_EXCEPTIONS: Record<string, number[]> = {
  // The `X-Actor` header is the demo stand-in for authentication (contract security scheme
  // `demoActor`) and can be missing, malformed or name an unknown role — a 401 in any operation. The
  // contract documents `401` only on the three operations that arrive with the `session` and
  // `metricsBearer` schemes in 0.3.0 (`logout`, `getSession`, `getMetrics`); on every other operation
  // it stays undocumented until 0.4.0 (slice 043, review 012 point 18).
  '*': [401],
  // GET /v1/questions (listQuestions) rejects an out-of-range `limit` or an out-of-enum `status`
  // with 422 (`validateOperation`, `apps/api/src/validate.ts`), but the contract's `listQuestions`
  // only documents `200` — query-parameter validation errors have no response block at all.
  listQuestions: [422],
  // POST /v1/questions/{questionId}/returns (returnQuestion) rejects a wrongly-typed `reason` with
  // 422, but the contract only documents 200/403/404/409/412 for this operation.
  returnQuestion: [422],
  // POST /v1/questions/{questionId}/withdrawal (withdrawQuestion) rejects a wrongly-typed `reason`
  // with 422, but the contract only documents 200/403/404/409/412 for this operation.
  withdrawQuestion: [422],
};

function isExceptedStatus(operationId: string, status: number): boolean {
  if (UNDOCUMENTED_STATUS_EXCEPTIONS['*']?.includes(status)) return true;
  return UNDOCUMENTED_STATUS_EXCEPTIONS[operationId]?.includes(status) ?? false;
}

/**
 * Read a response body for validation by its media type (Codex on PR #25): an event stream never
 * ends, so it is never buffered here (the caller reads or cancels it); JSON (`application/json`,
 * `application/problem+json`) is parsed; any other type (`text/plain` for `/metrics`) is validated as
 * the raw string. Always on a clone, so the caller can still read the body.
 */
async function readBodyFor(res: Response, contentType: string): Promise<unknown> {
  if (contentType === 'text/event-stream') return undefined;
  const text = await res.clone().text();
  if (text === '') return undefined;
  const isJson = contentType === 'application/json' || contentType.endsWith('+json');
  return isJson ? JSON.parse(text) : text;
}

/**
 * The base URL an operation is served under: its path item's own `servers` entry (`/` for
 * `/healthz`, `/readyz`, `/metrics`, `/auth/*`) or the document's default (`/v1`), without a
 * trailing slash. Review 023, point 6: `matchOperationId` strips `/v1` blindly and ignores per-path
 * `servers`, so `/v1/healthz` and `/healthz` both match `getHealth` and `/speakers` matches
 * `listSpeakers` — a request under the wrong base is a test bug, not an exercised operation.
 */
function baseUrlOf(operationId: string): string {
  const op = operations[operationId]!;
  const pathItem = openapiDoc.paths[op.path] as { servers?: { url: string }[] };
  const servers = pathItem.servers ?? (openapiDoc.servers as { url: string }[]);
  return (servers[0]?.url ?? '').replace(/\/$/, '');
}

function assertUnderDeclaredBaseUrl(operationId: string, method: string, pathname: string): void {
  const base = baseUrlOf(operationId);
  const underBase = base === '' ? !pathname.startsWith('/v1/') : pathname.startsWith(`${base}/`);
  if (!underBase) {
    throw new Error(
      `${method} ${pathname}: "${operationId}" is served under "${base || '/'}" (its servers entry in ` +
        'packages/contract/openapi.yaml), not under this prefix — call it there.',
    );
  }
}

/** JSON Pointer (into the document) of the response object for this operation and status, `$ref` followed once. */
function responsePointerOf(operationId: string, status: number): string {
  const op = operations[operationId]!;
  const responses = (openapiDoc.paths[op.path][op.method] as { responses: Record<string, unknown> }).responses;
  const node = responses[String(status)] as Record<string, unknown> | undefined;
  if (node !== undefined && '$ref' in node) return node['$ref'] as string;
  return `#/paths/${escapePointer(op.path)}/${op.method}/responses/${status}`;
}

/** The (possibly `$ref`-ed) response object the contract declares for this operation and status. */
function responseObjectOf(operationId: string, status: number): Record<string, unknown> | undefined {
  return resolvePointer(responsePointerOf(operationId, status)) as Record<string, unknown> | undefined;
}

// Header schemas are compiled here rather than in `contractSchema.ts` (outside this slice's files);
// the same document, the same Ajv settings.
const headerAjv = new Ajv2020({ strict: false, allErrors: true });
addFormats(headerAjv);
headerAjv.addSchema(openapiDoc, 'openapi');
const headerValidators = new Map<string, ValidateFunction>();
function headerValidator(schemaPointer: string): ValidateFunction {
  let validate = headerValidators.get(schemaPointer);
  if (validate === undefined) {
    validate = headerAjv.compile({ $ref: `openapi${schemaPointer}` });
    headerValidators.set(schemaPointer, validate);
  }
  return validate;
}

/** The session cookie's name, from the contract's `session` security scheme (`hv_session`). */
const SESSION_COOKIE = (openapiDoc.components.securitySchemes.session as { name: string }).name;

/**
 * Codex on 8ef3ad2 and on 50cc738: a response that lacks a header the contract marks `required: true`
 * for its status (`ETag` on the 0.3.0 writes, `Location`, `Set-Cookie` and `Cache-Control` on the
 * sign-in path), or sends a declared header whose value does not match its schema (a `Location` off
 * the origin, a cookie without `HttpOnly`, an `ETag` that is no entity-tag), breaks the contract as
 * much as a wrong body does: the test fails and the call is never a coverage hit. Optional headers
 * are validated when present.
 *
 * Codex on 929d0d7 (SECURITY): `Headers.get('set-cookie')` joins several `Set-Cookie` lines with
 * ", ", so a pattern checked on the joined value is satisfied by the first cookie while a second one
 * — applied last by the browser — goes unchecked. Every `Set-Cookie` line is therefore read on its
 * own (`getSetCookie()`) and validated alone; a response carries at most one session cookie; and a
 * response whose contract declares no `Set-Cookie` sets no cookie at all. Every other header in the
 * contract is either single-valued with a schema that a comma-joined duplicate cannot match
 * (`Location` as `SameOriginPath` has no whitespace, `ETag` no second quote, `X-Server-Time` is one
 * date-time) or a list header where joining is the defined meaning (`Cache-Control`, RFC 9110 5.3).
 */
function assertResponseHeaders(operationId: string, method: string, pathname: string, res: Response): void {
  const where = `${method} ${pathname} ("${operationId}") returned ${res.status}`;
  const base = responsePointerOf(operationId, res.status);
  const headers = (resolvePointer(base) as Record<string, unknown> | undefined)?.['headers'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  const setCookies = res.headers.getSetCookie();
  const declaresSetCookie = Object.keys(headers ?? {}).some((name) => name.toLowerCase() === 'set-cookie');
  if (setCookies.length > 0 && !declaresSetCookie) {
    throw new Error(`${where} with a cookie (${setCookies.join(' | ')}), but the contract does not declare "Set-Cookie" for this status.`);
  }
  for (const [name, raw] of Object.entries(headers ?? {})) {
    const pointer = '$ref' in raw ? (raw['$ref'] as string) : `${base}/headers/${escapePointer(name)}`;
    const header = resolvePointer(pointer) as { required?: boolean };
    const isSetCookie = name.toLowerCase() === 'set-cookie';
    const joined = res.headers.get(name);
    const values = isSetCookie ? setCookies : joined === null ? [] : [joined];
    if (values.length === 0) {
      if (header.required === true) {
        throw new Error(`${where} without the response header "${name}", which the contract marks as required for this status.`);
      }
      continue;
    }
    const validate = headerValidator(`${pointer}/schema`);
    for (const value of values) {
      if (!validate(value)) {
        throw new Error(
          `${where} with response header "${name}: ${value}", which does not match its contract schema:\n` +
            JSON.stringify(validate.errors, null, 2),
        );
      }
    }
  }
  // After the per-line check, so a malformed line is reported as such; two well-formed session
  // cookies are still one too many (the browser keeps the last).
  const sessionCookies = setCookies.filter((line) => line.trimStart().startsWith(`${SESSION_COOKIE}=`));
  if (sessionCookies.length > 1) {
    throw new Error(`${where} with more than one "${SESSION_COOKIE}" cookie (${sessionCookies.length}); the contract allows exactly one per response.`);
  }
}

async function assertMatchesContract(method: string, path: string, res: Response): Promise<void> {
  const pathname = (path.split('?')[0] ?? path);
  const operationId = matchOperationId(method, pathname);
  if (operationId === undefined) {
    throw new Error(
      `${method} ${pathname}: no operation in packages/contract/openapi.yaml matches this route; every ` +
        'route the test suite exercises must be in the contract (AGENTS.md rule 6).',
    );
  }
  assertUnderDeclaredBaseUrl(operationId, method, pathname);

  const status = res.status;
  const contentType = (res.headers.get('content-type') ?? 'application/json').split(';')[0]!.trim().toLowerCase();
  const body = await readBodyFor(res, contentType);

  if (isExceptedStatus(operationId, status)) {
    // Every exception above is an error path (401/422): still hold it to the shared Problem shape.
    // Never a coverage hit: an excepted status proves nothing about the operation.
    expectValidProblem(body);
    return;
  }

  const documented = documentedStatuses(operationId);
  if (!documented.includes(String(status))) {
    throw new Error(
      `${method} ${pathname} ("${operationId}") returned undocumented status ${status} ` +
        `(contract documents: ${documented.join(', ') || '(none)'}). Add a reasoned exception in ` +
        'helpers.ts (UNDOCUMENTED_STATUS_EXCEPTIONS) or fix the contract/service.',
    );
  }
  if (responseObjectOf(operationId, status)?.['content'] === undefined) {
    // A documented response without `content` (204, 302): the body must be empty, nothing to validate.
    if (body !== undefined) {
      throw new Error(`${method} ${pathname} ("${operationId}") returned ${status} with a body, but the contract declares none.`);
    }
  } else if (contentType === 'text/event-stream') {
    // Not buffered (see readBodyFor): what the contract can check here is the declared media type.
    const content = responseObjectOf(operationId, status)?.['content'] as Record<string, unknown>;
    if (!(contentType in content)) {
      throw new Error(
        `${method} ${pathname} ("${operationId}") returned ${contentType}, but the contract declares ` +
          `${Object.keys(content).join(', ')} for ${status}.`,
      );
    }
  } else {
    expectValid(operationId, status, body, contentType);
  }
  assertResponseHeaders(operationId, method, pathname, res);
  // Only a documented success counts as exercising the operation (review 023, point 2).
  if (status >= 200 && status < 400) recordOperationHit(operationId);
}

export async function req(app: App, method: string, path: string, opts: ReqOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.actor !== undefined) headers['X-Actor'] = opts.actor;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(path, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  await assertMatchesContract(method, path, res);
  return res;
}

export const ACTOR = {
  admin: 'admin:admin',
  moderation: 'mod:moderation',
  capture: 'cap:capture',
  expert: 'exp:expert',
  legal: 'leg:legal',
  approver: 'app:approver',
  podium: 'pod:podium',
  observer: 'obs:observer',
} as const;
