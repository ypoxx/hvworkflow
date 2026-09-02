/**
 * Small HTTP-layer helpers shared by every route in `app.ts`. No business logic lives here — only
 * translating a Hono `Context` into the plain values `HvApi` expects and back (AGENTS.md rule 6).
 * Request-shape checking against the contract lives in `validate.ts` / `contractSchema.ts`.
 */
import type { Context } from 'hono';
import { ApiProblem, type WriteOptions } from '@hv/domain';

/** Parse the JSON body, tolerating an absent one (several writes have no required body). Shape is
 * checked separately, against the contract's own schema, by `validateOperation` (`validate.ts`). */
export async function readJson(c: Context): Promise<unknown> {
  const text = await c.req.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiProblem(422, 'Unprocessable', 'Request body is not valid JSON.');
  }
}

/** `If-Match` / `Idempotency-Key` headers, in the shape every `HvApi` write accepts. */
export function writeOptions(c: Context): WriteOptions {
  const ifMatch = c.req.header('If-Match');
  const idempotencyKey = c.req.header('Idempotency-Key');
  return {
    ...(ifMatch !== undefined ? { ifMatch } : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  };
}

/** A required path parameter. Routes only reach here when the pattern matched, so it is always set. */
export function requireParam(c: Context, name: string): string {
  const value = c.req.param(name);
  if (value === undefined) throw new ApiProblem(400, 'Bad Request', `Missing path parameter "${name}".`);
  return value;
}
