# 004 — HTTP server (Hono) over the domain

**Status:** review
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

### `pnpm --filter @hv/api typecheck`

```
> @hv/api@0.1.0 typecheck /home/user/hvworkflow/apps/api
> tsc -p tsconfig.json --noEmit
```
(clean exit, no diagnostics)

### `pnpm --filter @hv/api lint`

```
> @hv/api@0.1.0 lint /home/user/hvworkflow/apps/api
> oxlint src
```
(clean exit, no findings)

### `pnpm --filter @hv/api test`

```
> @hv/api@0.1.0 test /home/user/hvworkflow/apps/api
> vitest run

 RUN  v4.1.11 /home/user/hvworkflow/apps/api

 Test Files  3 passed (3)
      Tests  19 passed (19)
   Start at  20:19:05
   Duration  1.18s (transform 850ms, setup 0ms, import 1.84s, tests 932ms, environment 0ms)
```

Test files: `contract.test.ts` (8 tests: every operationId not reached by the acceptance sentence —
`listAgendaItems`, `listUnits`, `listSpeakers`/`getSpeaker`/`updateSpeaker`/`reorderSpeakers`,
`listContributions`/`getContribution`, `listQuestions`/`getStage`/`listEvents`, `returnQuestion`,
`withdrawQuestion`, `mergeQuestion`), `acceptance.test.ts` (1 test: the full spine over HTTP with 800
seeded questions — register speaker → capture contribution → capture 7 questions → classify → assign
→ draft → submit → approve (incl. a 409 on the wrong `answerVersion`) → stage → deliver → close →
history), `negative.test.ts` (10 tests: 401 missing/malformed/unknown-role header, 403 observer
classifying + demo seed disabled, 409 wrong transition, 412 stale `If-Match` + unchanged state, 422
blank text / missing display name, idempotent replay with unchanged `/v1/events` `lastSeq`). Every
response body is validated against its operation's schema in `packages/contract/openapi.yaml` via
`Ajv2020` (`src/__tests__/schema.ts` resolves the contract's own `$ref` indirections, e.g.
`#/components/responses/QuestionUpdated`, before compiling).

### `pnpm gates` (repo root)

```
Scope: 4 of 5 workspace projects
packages/contract typecheck: Done
packages/domain typecheck: Done
apps/api typecheck: Done
apps/web typecheck: Done
Scope: 4 of 5 workspace projects
packages/contract lint: Done
packages/domain lint: src/seed.ts:440:18: warning unicorn(no-new-array) — pre-existing, outside apps/api
apps/api lint: Done
apps/web lint: src/api/useApiVersion.ts:14:19: warning react(set-state-in-effect) — pre-existing, outside apps/api
Scope: 4 of 5 workspace projects
packages/domain test:  Test Files  4 passed (4) / Tests  35 passed (35)
apps/api test:  Test Files  3 passed (3) / Tests  19 passed (19)
apps/web test: No test files found, exiting with code 0

> hvworkflow@0.1.0 vocabulary
vocabulary-check: ok

> @hv/web@0.0.0 build
✓ 1664 modules transformed.
✓ built in 1.08s
```
Exit code 0. `redocly lint` reports 9 pre-existing warnings on `packages/contract/openapi.yaml`
(missing 4XX on pure-GET master-data endpoints, the unused `oidc` security scheme) — informational
only (`redocly lint` does not fail the gate on warnings), predates this slice, and `packages/contract`
is outside the files allowed for this slice.

### Manual server check (acceptance criterion)

```
$ cd apps/api && HV_DEMO=1 PORT=8787 pnpm exec tsx src/server.ts &
HV-Tool API listening on http://localhost:8787

$ curl -s -X POST -H 'X-Actor: admin:admin' http://localhost:8787/v1/demo/seed
{"id":"hv-2026","title":"Ordentliche Hauptversammlung 2026","date":"2026-09-02","status":"running",
 "currentRound":4,"counts":{"speakers":118,"questions":800,"open":325,"staged":100,"delivered":475},
 "legalEntity":"Beispiel AG (synthetische Demodaten)"}

$ curl -s -H 'X-Actor: u1:capture' 'http://localhost:8787/v1/questions?limit=2'
{"items":[{"id":"fr-0006q","number":"F-0001", ... ,"status":"closed","version":5,
 "_actions":["question.capture","question.read"]},
 {"id":"fr-0006w","number":"F-0002", ... ,"status":"delivered","version":8,
 "_actions":["question.capture","question.withdraw","question.read"]}],"total":800}
```
`_actions` present on every question, as required.

Also verified manually: `HV_EVENT_LOG=events.jsonl` — after seeding, the file holds one line per
event (142 lines for a 5-question seed); a restart with the same path reloads them (a second seed
attempt correctly returns 409 "event log is not empty"), and the file's line count is unchanged after
the restart (append-only: the persistence adapter tracks how many lines it already wrote and only
ever appends the tail of the store's log, never rewriting existing lines).

## Open

- `GET /v1/stream` (SSE) is **not implemented**. Per the spec this is optional when time is short;
  polling `GET /v1/events` (implemented, tested) is the contract minimum and is what `apps/api`
  offers today. Flagging for a follow-up slice if the interface needs push updates from the server.
- Domain gap (not fixed here — outside `apps/api/**`, and rule 6 keeps all business logic in
  `packages/domain`): `classifyQuestion` in `packages/domain/src/api.ts` does not validate that
  `input.track` is present, even though the contract marks `Classification.track` required and lists
  `422` for this operation. A request with a missing `track` currently succeeds with `200` and
  produces a question whose `track` is `undefined` rather than failing with `422`. Recommend adding a
  presence check next to the existing `422` checks in `registerSpeaker`/`captureContribution`.
- The HTTP layer does not itself enforce the contract's declared `minimum`/`maximum` bounds on
  `limit`/`offset`/`round`/`after` query parameters (e.g. `limit=99999` is silently clamped to the
  code's own bounds rather than rejected with `422`); this mirrors the domain, which also does not
  bound them. Not fixed, to keep all validation logic in one place per rule 6 — flagging in case a
  future slice wants contract-level query validation.
