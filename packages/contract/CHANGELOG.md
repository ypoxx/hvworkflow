# Changelog — @hv/contract

All notable changes to `packages/contract/openapi.yaml` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the contract is versioned by
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as decided in ADR 0015
(Vertragsversionierung — "Versionierung nach ADR 0015, vorgeschlagen"). The gate
`packages/contract/scripts/check.mjs` (run by `pnpm -r test`, therefore by `pnpm gates`) refuses a
contract change without a version bump and a section here, and refuses an expired entry in
`packages/contract/allowlist.json` (pre-declared, not yet implemented operations).

Each entry names the slice that implements it in core, seed, web or e2e.

## [0.2.1] - 2026-09-23

Slice 010 (Implementierer-Backend), contract only for this entry: additive within the 0.2 cycle. An
additive enum value and the documentation of a new rule id are a patch release, not a minor one
(compare 0.3.1 in slice 028); 0.3.0 is reserved for the next contract package (slice 023).

### Added

- `question.read.delivered` in `Action`: a scoped alternative to `question.read` for the observer
  role, restricted to `delivered`/`closed` (R-PERM-03, `READ_SCOPES` in
  `packages/domain/src/permissions.ts`) for `listQuestions`/`getQuestion`, enforced from slice 010.
- Rule id **R-PERM-03** (Leseumfang überschritten) documented in `Problem.ruleId` and the `Forbidden`
  response, next to R-PERM-01/R-PERM-02.
- Core, service and role grants for all read permissions declared since 0.2.0 (`speaker.read`,
  `contribution.read`, `question.read`, `question.read.delivered`, `stage.read`, `history.read`,
  `event.read`): slice 010.

## [0.2.0] - 2026-09-23

Slice 019 (Architekt), contract only. Additive: nothing removed, nothing becomes required, all
existing tests stay green. Core, seed, web and e2e follow in 010, 021 and 080.

### Added

- `info.description` names the versioning rule (ADR 0015, proposed), this changelog, the allowlist
  and the gate.
- Role `coordination` in `Role` — working name (Arbeitsname), displayed as "Koordination", final name
  pending register entry E1. Permission bundle: slice 021.
- Read permissions in `Action` (Rechtebezeichner): `speaker.read`, `contribution.read`, `stage.read`,
  `history.read`, `event.read`, next to the existing `question.read`. The enum description states that
  a permission is granted exclusively in `ROLE_PERMISSIONS` (AGENTS.md rule 4). Enforcement on the
  read paths: slice 010.
- Permission `question.legal.clear` in `Action`; event type `QuestionLegalCleared` in `Event.type`
  with payload schema `QuestionLegalClearedPayload` (`questionId`, `answerVersion`, optional `note`),
  bound to the event type with `if`/`then` so every other event type keeps its open payload. No new
  operation; the clearing operation comes through the allowlist when 021 needs it. Emitter: slice 021.
- `403 Forbidden` documented on all twelve read operations (`getMeeting`, `listAgendaItems`,
  `listUnits`, `listSpeakers`, `getSpeaker`, `listContributions`, `getContribution`, `listQuestions`,
  `getQuestion`, `getQuestionHistory`, `getStage`, `listEvents`). Rule ids in `Problem.ruleId` and
  the `Forbidden` response: R-PERM-01 write permission missing (Schreibrecht fehlt), R-PERM-02 read
  permission missing (Leserecht fehlt). Today the server never returns 403 on a read; slice 010 does.
- `packages/contract/allowlist.json`: pre-declared, not yet implemented operations as
  `{ operationId, reason, slice, expires }` (`expires` = `YYYY-MM-DD`); empty (`[]`) today.
- `packages/contract/scripts/check.mjs` as the package `test` script: (a) `info.version` equals the
  package version, (b) this file has a section for exactly that version, (c) a changed `openapi.yaml`
  against the merge base with the integration branch requires a higher version (skipped with a note
  when git or the ref is unavailable), (d) the allowlist is well-formed, every `operationId` exists in
  the contract and no entry is expired.

### Deprecated

- `Speaker.kind`, `Speaker.requestedMinutes`, `SpeakerRegistration.kind`,
  `SpeakerRegistration.requestedMinutes`, `SpeakerUpdate.requestedMinutes` — veraltet seit 0.2.0,
  entfällt in 080 (Feedback #15). `kind` is no longer in `required` on `Speaker` and
  `SpeakerRegistration`; enum and value ranges stay so the existing 422 tests keep their meaning.
  Removal: slice 080.

## [0.1.0] - 2026-09-02

Initial contract (Fundament, slices 001–007): 29 operations over `/v1` — meeting master data (3),
speakers list (5), contributions (3), questions and their workflow (15), podium view (1), event feed
(1), demo seed (1); roles `moderation`, `capture`, `expert`, `legal`, `approver`, `podium`, `admin`,
`observer`; 18 permission identifiers; 17 event types; RFC 9457 problems with `ruleId`;
`Idempotency-Key`, `ETag`/`If-Match`; `_actions` on every question.
