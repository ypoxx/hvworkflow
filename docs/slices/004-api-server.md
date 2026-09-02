# 004 — HTTP server (Hono) over the domain

**Status:** rework
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

## Review findings

Reviewer: adversarial review of slice 004 (spec + diff only, no implementer narrative).
Base for the diff: `07638a1`. All commands below were run by the reviewer from the repository root.

**Verdict: rework** (3 blockers, 3 majors).

What is solid, verified independently: all **29** operationIds of `packages/contract/openapi.yaml` are
implemented at the exact path and method under `/v1` with the right status codes (201 on
`registerSpeaker`/`captureContribution`/`captureQuestions`, 200 elsewhere); all 29 have at least one
test whose response body is validated against the contract schema, and that validation is real (a
deliberately wrong body is rejected on `required`, `enum` and `format: date-time`); `ETag: "v<n>"` is
set on every speaker and question response; `If-Match` and `Idempotency-Key` are forwarded on every
write through one helper (`apps/api/src/http.ts:49`); errors are `application/problem+json` and carry
the domain `ruleId` (403 → `R-PERM-01`, 409 → `R-TRANS-00`/`R-GUARD-04`); no role name and no status
literal appears anywhere in `apps/api/src` outside the tests; `HV_EVENT_LOG` is genuinely append-only
(restart verified: file byte-identical, previous content stays an unchanged prefix, second seed → 409).

### Blockers

1. **blocker — no request-body validation; contract-violating data is written into the append-only
   log.** `apps/api/src/app.ts:96` (`registerSpeaker`) and `apps/api/src/app.ts:112`
   (`updateSpeaker`) cast the parsed body (`readJson<T>` → `Partial<T>`) straight to the domain type
   and forward it unchecked. Observed against a running server:
   `POST /v1/speakers {"displayName":"Bogus Kind 2","kind":"space-alien"}` → **201** with
   `"kind":"space-alien"`; `PATCH /v1/speakers/{id} {"status":"teleported"}` → **200** with
   `"status":"teleported"`. Both violate the contract's `Speaker.kind` / `SpeakerStatus` enums, and
   afterwards the server's own `GET /v1/speakers` response fails
   `expectValid('listSpeakers', 200, …)` (`schemaPath: #/components/schemas/SpeakerStatus/enum`).
   Worse, the bad values are appended to `HV_EVENT_LOG` as events, where rule 7 makes them
   unremovable — one malformed client request permanently corrupts the projection for every consumer.
   *Fix:* validate each request body against that operation's `requestBody` schema in the contract
   before calling `HvApi`, and answer `422` on failure. The Ajv loader already exists in
   `apps/api/src/__tests__/schema.ts:22`; promote it to `apps/api/src/contractSchema.ts` and use it
   from a small middleware in `app.ts`. This is contract conformance, not business logic, so it
   belongs in the HTTP layer and does not conflict with rules 5/6.

2. **blocker — wrongly-typed fields answer 500 instead of the contract's 422.**
   `apps/api/src/http.ts:38` returns whatever JSON arrived, and the handlers pass it on
   (`apps/api/src/app.ts:193`, `:207`, `:224`, `:124`, `:132`); the domain then calls `.trim()` on a
   non-string and the `TypeError` falls into `problemBody` (`apps/api/src/problem.ts:86`). Observed:
   `POST /v1/questions/{id}/answers {"text":123}` → **500**;
   `POST /v1/questions/{id}/returns {"reason":123}` → **500**;
   `POST /v1/questions/{id}/withdrawal {"reason":123}` → **500**;
   `POST /v1/contributions {"speakerId":"…","text":123}` → **500**;
   `POST /v1/contributions/{id}/questions {"questions":[{"text":123}]}` → **500**
   (server log: 5 × `Unexpected error in @hv/api`). The contract declares `422` for every one of
   these operations and no `500` anywhere. *Fix:* the same request-schema validation as finding 1.

3. **blocker — an `Idempotency-Key` replay bypasses the permission check and hands the replaying
   actor another actor's `_actions`.** `apps/api/src/http.ts:49` forwards the raw header as the
   domain's cache key, and `packages/domain/src/api.ts:205` wraps the *entire* write — permission
   check included — in `idempotent()`. Observed on a running server: `cap:capture` classifies with
   `Idempotency-Key: K1` → 200; then **`obs:observer`** replays the identical request with `K1` →
   **200** with the full question body and
   `_actions: ["question.capture","question.classify","question.withdraw","question.merge","question.read"]`
   — actions the observer must never see. The same key replayed by the observer on a *different*
   endpoint (`POST /v1/questions/{id}/withdrawal`) also returns **200** with the cached
   classification body: the cache is scoped neither to the actor nor to the request. Rule 4 says the
   interface renders exactly what `_actions` allows, so an observer's UI would offer write actions.
   *Fix (in scope for this slice):* scope the key before forwarding it, e.g.
   `idempotencyKey: `${actor.id}|${c.req.method} ${new URL(c.req.url).pathname}|${key}`` in
   `writeOptions`, so a replay can only ever be the same actor replaying the same request; and raise
   a domain follow-up so `idempotent()` runs *after* the permission check.

### Major

4. **major — the test suite never sends a wrongly-typed or out-of-enum body, which is why findings
   1–3 went unnoticed.** `apps/api/src/__tests__/negative.test.ts:278` and `:293` only cover blank
   strings; there is no 404 test anywhere although the contract declares `404` on 15 operations; and
   the replay test (`negative.test.ts:301`) replays with the *same* actor only. Only one error body
   in the whole suite is schema-validated (`negative.test.ts:272`); 401/403/409/422 bodies are
   checked field-by-field instead. *Fix:* add cases for a wrong-typed body (expect 422), an
   out-of-enum `kind`/`status` (expect 422), a 404 for an unknown question/speaker/contribution, a
   cross-actor replay (expect 403, not a cached 200), and run `expectValid(…, 'application/problem+json')`
   on every problem response.

5. **major — the acceptance criterion is not reproducible as written.**
   `pnpm --filter @hv/api dev` starts with an empty store and `HV_DEMO` unset
   (`apps/api/src/app.ts:48`; `apps/api/package.json` `"dev": "tsx src/server.ts"`), so
   `curl -H 'X-Actor: u1:capture' localhost:8787/v1/questions?limit=2` returns
   `{"items":[],"total":0}` — no `_actions` at all. Reproduced on port 8791. It only works after
   `HV_DEMO=1` plus a separate `POST /v1/demo/seed`. *Fix:* set `HV_DEMO=1` in the `dev` script and
   seed an empty store on start when demo mode is on, or amend the acceptance criterion in this spec
   to the two-step sequence.

6. **major — work outside the files allowed by this slice.** Allowed are `apps/api/**`,
   `pnpm-lock.yaml` and this spec, but commit `aa55218` ("fix(domain): Klassifizierung prueft Pfad,
   TOP und Buehnenzuordnung (422)") changes `packages/domain/src/api.ts` and
   `packages/domain/src/__tests__/api.test.ts` — exactly the change this slice's own "Open" section
   recommends. AGENTS.md rule 1: work outside the allowed files is a finding, not initiative. *Fix:*
   move it to its own slice with its own spec, or record it under the slice that owns
   `packages/domain`. (If it was authored by a different session, attribute it there — the reviewer
   can only see the commit.)

### Minor

7. **minor — query parameters are silently clamped, never rejected.** `apps/api/src/http.ts:72`
   clamps: `limit=0` → 1 item, `limit=-3` → 1 item, `limit=99999` → accepted, `limit=abc` → default.
   `?status=nonsense` (`app.ts:144`) returns `200 {"items":[],"total":0}`, and `?status=` on
   `/v1/speakers` (`app.ts:89`) and `?track=` (`app.ts:148`) are unchecked casts. The contract sets
   `minimum`/`maximum` and enum types on all of these. *Fix:* validate query parameters against the
   contract's parameter schemas and answer `422`.

8. **minor — `Idempotency-Key` `maxLength: 128` is not enforced.**
   `packages/contract/openapi.yaml:486` sets the bound; `apps/api/src/http.ts:51` forwards a key of
   any length, and every distinct key becomes a permanent entry in the domain's in-memory map.

9. **minor — two writes answer with the wrong status code for a malformed body.**
   `PUT /v1/speakers/order {"round":1,"speakerIds":"x"}` → **404** (the string is iterated per
   character and `requireSpeaker('x')` fails) where the contract declares `422`; `app.ts:102` passes
   `body.speakerIds ?? []` unchecked. `POST /v1/questions/{id}/approvals {"answerVersion":"one"}` →
   **409** where the contract declares `422` (`app.ts:202`). Both disappear with finding 1's fix.

10. **minor — test-only packages are declared as runtime dependencies.** `ajv`, `ajv-formats`,
    `yaml` and `@hv/contract` sit under `dependencies` in `apps/api/package.json` but are used only
    by `apps/api/src/__tests__/schema.ts`. Move them to `devDependencies` so the portable service
    does not ship them. (If finding 1 is fixed by validating against the contract at runtime, `ajv`
    and `yaml` become genuine runtime dependencies — then keep them and note why.)

11. **minor — no production entry point for a "portable Node service".** `apps/api/package.json` has
    `dev` (tsx) and a `build` that is just `tsc --noEmit`; `main` points at `./src/server.ts` and
    there is no `start` script, so the service cannot be started without `tsx`. Add an emitting build
    or a `start` script relying on Node's type stripping.

12. **minor — the event log is not robust on load.** `apps/api/src/eventLog.ts:117` `JSON.parse`s
    every line and lets a truncated or corrupt final line throw, making the server unstartable; the
    matching `save()` (`:127`) is a non-atomic `appendFileSync` without `fsync`. Catch the parse
    error, name the offending line, and skip or quarantine it.

13. **minor — `GET /v1/stream` (SSE) is absent** (`apps/api/src/app.ts:254`), so `HvApi.subscribe()`
    (`packages/domain/src/api.ts:101`) has no HTTP equivalent and an HTTP adapter for `apps/web` must
    poll `/v1/events`. The spec makes it optional and the contract has no `/stream` path, so this is
    informational — but it needs its own slice before the interface expects push updates.

14. **minor — no CORS handling.** The contract declares a same-origin server
    (`packages/contract/openapi.yaml:24`), so the vite dev server needs a proxy; without one the
    custom `X-Actor` header triggers a preflight that nothing answers, and the interface switch from
    the in-process adapter fails in dev.

15. **minor — the "Open" section of this spec is stale.** It states that `classifyQuestion` does not
    validate `track` and returns 200 for a missing one. Verified false in the current tree:
    `packages/domain/src/api.ts:392` validates it, and the running server answers
    `422 {"detail":"track must be podium, fast_track or expert_track."}`. Remove the item.

### Observed test output

`pnpm --filter @hv/api test`:

```
> @hv/api@0.1.0 test /home/user/hvworkflow/apps/api
> vitest run

 RUN  v4.1.11 /home/user/hvworkflow/apps/api

 Test Files  3 passed (3)
      Tests  19 passed (19)
   Start at  20:25:08
   Duration  1.17s (transform 923ms, setup 0ms, import 2.00s, tests 745ms, environment 0ms)
```

`pnpm gates` — **first run exited 1**, on `apps/web`, not on `apps/api`:

```
apps/web test:  FAIL  e2e/001-shell.spec.ts [ e2e/001-shell.spec.ts ]
apps/web test: Error: Playwright Test did not expect test.use() to be called here.
apps/web test:  Test Files  2 failed (2)
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @hv/web@0.0.0 test: `vitest run --passWithNoTests`
GATES_EXIT=1
```

A re-run after `apps/web/vitest.config.ts` appeared (slice 001, concurrent session) exited 0:

```
apps/api typecheck: Done
apps/api lint: Done
packages/domain test:  Test Files  4 passed (4) / Tests  36 passed (36)
apps/api test:  Test Files  3 passed (3) / Tests  19 passed (19)
apps/web test: No test files found, exiting with code 0
vocabulary-check: ok
✓ built in 1.01s
GATES_EXIT=0
```

So the gate is green and the failure was never caused by `apps/api`; it is recorded here only because
the acceptance criterion names `pnpm gates` and the first run was red.
