/**
 * Maps `ApiProblem` (thrown by the domain, see `packages/domain/src/api.ts`) to an RFC 9457
 * `application/problem+json` response. Anything else is an unexpected error: logged server-side,
 * returned as a bare 500 problem without a stack trace to the caller.
 */
import { ApiProblem } from '@hv/domain';

export function problemBody(err: unknown): { type: string; title: string; status: number; detail: string; ruleId?: string } {
  if (err instanceof ApiProblem) return err.toProblem();
  console.error('Unexpected error in @hv/api', err);
  return {
    type: 'urn:hv:problem:500',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred.',
  };
}

/** Build the raw problem+json `Response`. A plain `Response` is a valid Hono handler return value. */
export function problemResponse(err: unknown): Response {
  const problem = problemBody(err);
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
