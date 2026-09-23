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
import type { App } from '../app.ts';
import { documentedStatuses, expectValid, expectValidProblem, matchOperationId } from '../contractSchema.ts';

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
  // contract documents no `401` anywhere (see `packages/contract/openapi.yaml`, security scheme
  // `demoActor`): there is no per-operation response block for it, and no shared default response.
  '*': [401],
  // GET /v1/meeting/getMeeting: before the first `seedDemo`/write, no meeting exists yet and the
  // handler reports 404 (`packages/domain/src/api.ts`, `getMeeting`), but the contract only
  // documents `200` for this operation.
  getMeeting: [404],
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

/** Every response this suite provokes is JSON (`c.json()` or the shared `problemResponse`, never empty). */
async function readJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  return text === '' ? undefined : JSON.parse(text);
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

  const status = res.status;
  const contentType = (res.headers.get('content-type') ?? 'application/json').split(';')[0]!.trim();
  const body = await readJsonBody(res.clone());

  if (isExceptedStatus(operationId, status)) {
    // Every exception above is an error path (401/404/422): still hold it to the shared Problem shape.
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
  expectValid(operationId, status, body, contentType);
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
