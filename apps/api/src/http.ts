/**
 * Small HTTP-layer helpers shared by every route in `app.ts`. No business logic lives here — only
 * translating a Hono `Context` into the plain values `HvApi` expects and back (AGENTS.md rule 6).
 */
import type { Context } from 'hono';
import { ApiProblem, type WriteOptions } from '@hv/domain';

/** Parse the JSON body, tolerating an absent one (several writes have no required body). */
export async function readJson<T>(c: Context): Promise<Partial<T>> {
  const text = await c.req.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text) as Partial<T>;
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

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Reads an integer query parameter, clamped to `[min, max]` when given. Invalid values fall back. */
export function intQuery(c: Context, name: string, opts?: { min?: number; max?: number }): number | undefined {
  const n = toInt(c.req.query(name));
  if (n === undefined) return undefined;
  const min = opts?.min ?? Number.NEGATIVE_INFINITY;
  const max = opts?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, n));
}
