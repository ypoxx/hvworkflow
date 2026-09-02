# 004 — HTTP server (Hono) over the domain

**Status:** spec
**Role:** Implementierer Backend (Sonnet)
**Rule ids:** AGENTS.md rules 5, 6, 7, 8; contract conventions (Idempotency-Key, If-Match/ETag, RFC 9457)

## Goal

`apps/api`: a portable Node service implementing every path of `packages/contract/openapi.yaml`
over `createInProcessApi` from `@hv/domain`. Proves that interface and server share one core.

- Hono app (`src/app.ts`) exported for tests, `src/server.ts` starts it with `@hono/node-server`
  on `PORT` (default 8787). In-memory event store; optional `HV_EVENT_LOG=path.jsonl` appends every
  event to a JSON-lines file and reloads it at start (append-only, never rewritten).
- Actor from header `X-Actor` (`<id>:<role>`); missing → 401 problem. Map to `Actor`.
- Map `ApiProblem` → `application/problem+json` with its status; unknown errors → 500 problem
  without stack.
- `If-Match` → `WriteOptions.ifMatch`; `Idempotency-Key` → `idempotencyKey`; responses of question
  and speaker resources set `ETag: "v<version>"`.
- Query parsing for `GET /v1/questions` (status as comma list), `GET /v1/events?after=&limit=`.
- `POST /v1/demo/seed` only when `HV_DEMO=1`.
- `GET /v1/stream` (SSE) pushing each new event — optional if time is short; polling `events` is the
  contract minimum.
- **Contract tests** (vitest + `app.request()`): every operationId gets at least one test; responses
  are validated against the OpenAPI schemas with `ajv` (load yaml with `yaml`); the acceptance
  sentence runs through HTTP; 412/403/409/422 cases; idempotent replay.

## Files allowed

`apps/api/**`, `pnpm-workspace.yaml` untouched (apps/* already included), root `package.json` only
if a script is needed, `pnpm-lock.yaml`.

## Acceptance criterion

`pnpm gates` green including `apps/api` tests. `pnpm --filter @hv/api dev` then
`curl -H 'X-Actor: u1:capture' localhost:8787/v1/questions?limit=2` returns JSON with `_actions`.

## Evidence / Review findings

(filled in)
