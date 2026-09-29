/**
 * Maps `ApiProblem` (thrown by the domain, see `packages/domain/src/api.ts`) to an RFC 9457
 * `application/problem+json` response. Anything else is an unexpected error: logged server-side as
 * one content-free line, returned as a bare 500 problem without a stack trace to the caller.
 * Every problem carries `instance: urn:hv:request:<id>` — the service-generated correlation id of
 * the request (slice 033a), the same id the access log line carries.
 */
import { ApiProblem } from '@hv/domain';
import { currentRequest } from './observability/context.ts';

type Problem = { type: string; title: string; status: number; detail: string; ruleId?: string; instance?: string };

/**
 * Only the class name, and only if it is a plain identifier: an error message can hold a connection
 * string, a query or a person's text (T-G2-I-02), and a driver may put anything into `name`.
 */
function errorClassOf(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : typeof err;
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) ? name : 'Error';
}

export function problemBody(err: unknown): Problem {
  const context = currentRequest();
  const instance = context !== undefined ? { instance: `urn:hv:request:${context.requestId}` } : {};
  if (err instanceof ApiProblem) return { ...err.toProblem(), ...instance };
  // Deliberately no message, no stack, no driver details: exactly these four keys.
  console.error(JSON.stringify({
    log: 'error',
    ts: context?.clock().toISOString() ?? null,
    requestId: context?.requestId ?? null,
    errorClass: errorClassOf(err),
  }));
  return {
    type: 'urn:hv:problem:500',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred.',
    ...instance,
  };
}

/**
 * Build the raw problem+json `Response`. A plain `Response` is a valid Hono handler return value.
 * `headers` adds response headers of the boundary (`Retry-After`, slice 034a) next to the content type.
 */
export function problemResponse(err: unknown, headers: Record<string, string> = {}): Response {
  const problem = problemBody(err);
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}
