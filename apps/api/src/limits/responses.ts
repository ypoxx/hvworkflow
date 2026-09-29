/**
 * The responses of the request boundary (slice 034a, decision 10): problem details with a fixed title and
 * detail (never the value of a limit or the source), `instance` from the request context, and no `ruleId`
 * (no domain rule is involved). `Retry-After` is a whole number of seconds.
 */
import { ApiProblem } from '@hv/domain';
import { problemResponse } from '../problem.ts';

export const RETRY_AFTER_BUSY_SECONDS = 2;
export const RETRY_AFTER_MIGRATION_SECONDS = 30;

export function tooManyRequests(retryAfterSeconds: number): Response {
  return problemResponse(new ApiProblem(429, 'Too Many Requests', 'Too many requests. Try again later.'),
    { 'Retry-After': String(retryAfterSeconds) });
}

export function requestTimeout(): Response {
  return problemResponse(new ApiProblem(408, 'Request Timeout', 'The request took too long.'));
}

export function payloadTooLarge(): Response {
  return problemResponse(new ApiProblem(413, 'Payload Too Large', 'The request body is too large.'));
}

export function persistenceBusy(detail: 'Persistence is busy.' | 'Migrations are pending.'): Response {
  const seconds = detail === 'Persistence is busy.' ? RETRY_AFTER_BUSY_SECONDS : RETRY_AFTER_MIGRATION_SECONDS;
  return problemResponse(new ApiProblem(503, 'Service Unavailable', detail), { 'Retry-After': String(seconds) });
}

/** A commit whose result the service did not see: the write may or may not be durable. No `Retry-After`. */
export function outcomeUnknown(): Response {
  return problemResponse(new ApiProblem(500, 'Internal Server Error', 'Persistence outcome is unknown.'));
}
