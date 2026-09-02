/**
 * Binds `contractSchema.ts` (framework-agnostic) to Hono: one middleware per operation that checks
 * the request — header parameters (`Idempotency-Key` length, ...), query parameters (types, enums,
 * `minimum`/`maximum` — rejected rather than clamped), and the request body — against the contract's
 * own schemas *before* any handler runs, so a wrongly-typed or contract-violating request never
 * reaches `HvApi` or the append-only event log (rework review blockers 1/2, minors 7/8/9).
 */
import type { Context, Next } from 'hono';
import { ApiProblem } from '@hv/domain';
import { describeErrors, paramsFor, requestBodyValidator, validateParam } from './contractSchema.ts';
import { readJson } from './http.ts';

export interface Variables {
  validatedBody?: unknown;
  validatedQuery?: Record<string, unknown>;
}

/** The request body, already checked against the operation's `requestBody` schema. */
export function getValidatedBody<T>(c: Context<{ Variables: Variables }>): T {
  return c.get('validatedBody') as T;
}

/** Query parameters present on the request, coerced to their contract type (number, array, ...). */
export function getValidatedQuery(c: Context<{ Variables: Variables }>): Record<string, unknown> {
  return c.get('validatedQuery') ?? {};
}

/** One middleware per `operationId`, wired onto its route in `app.ts` ahead of the handler. */
export function validateOperation(operationId: string) {
  return async (c: Context<{ Variables: Variables }>, next: Next): Promise<void> => {
    const query: Record<string, unknown> = {};
    for (const spec of paramsFor(operationId)) {
      if (spec.in !== 'query' && spec.in !== 'header') continue;
      const raw = spec.in === 'query' ? c.req.query(spec.name) : c.req.header(spec.name);
      if (raw === undefined) continue;
      const { value, errors } = validateParam(spec, raw);
      if (errors) {
        throw new ApiProblem(422, 'Unprocessable', `${spec.in} parameter "${spec.name}": ${describeErrors(errors)}`);
      }
      if (spec.in === 'query') query[spec.name] = value;
    }
    c.set('validatedQuery', query);

    const bodyValidator = requestBodyValidator(operationId);
    if (bodyValidator) {
      const raw = await readJson(c);
      if (!bodyValidator(raw)) {
        throw new ApiProblem(422, 'Unprocessable', `Request body: ${describeErrors(bodyValidator.errors)}`);
      }
      c.set('validatedBody', raw);
    }
    await next();
  };
}
