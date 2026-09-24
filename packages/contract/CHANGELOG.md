# Changelog — @hv/contract

All notable changes to `packages/contract/openapi.yaml` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the contract is versioned by
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as decided in ADR 0015
(Vertragsversionierung — "Versionierung nach ADR 0015, vorgeschlagen"). The gate
`packages/contract/scripts/check.mjs` (run by `pnpm -r test`, therefore by `pnpm gates`) refuses a
contract change without a version bump and a section here, and refuses an expired entry in
`packages/contract/allowlist.json` (pre-declared, not yet implemented operations).

Each entry names the slice that implements it in core, seed, web or e2e.

## [0.3.0] - 2026-09-24

Slice 023 (Architekt), contract only: the foundation package for M2 (Plan 5.4). Additive: nothing
removed, nothing becomes required, all existing tests stay green. 29 → 65 operations; the 36 new ones
are pre-declared in `allowlist.json` (expiry 2026-11-25 = end of M2 + 14 days) and implemented by
025, 026, 028, 029, 033, 035 and 040. `If-Match` stays optional; 0.3.1 (slice 028) makes it and the
fields marked "Pflicht ab 0.3.1" mandatory.

Decisions of the architect (Festlegungen, reasoning in `docs/slices/023-vertrag-0-3-0-fundament.md`):
(a) meeting scope is expressed at the collection: canonical `/meetings/{meetingId}/…` for the ten
collection operations, items with a global id stay where they are, the un-prefixed collection paths
are the alias for the current meeting until 0.5 and are `deprecated` now; `/events` and `/stream` are
global with a `meetingId` filter. (b) Envelope fields lie flat on `Event`, mirroring the persistence
columns (Plan 3). (c) The transparency notice is `GET /auth/transparency-notice`, `security: []`.
(d) New permission identifiers: `contribution.claim`, `question.claim`, `agenda.manage`,
`admin.meetings.manage`, `admin.units.manage`, `admin.seats.manage`, `admin.roles.manage`,
`admin.config.freeze`. (e) Without credential: `/healthz`, `/readyz`, `/auth/login`, `/auth/callback`,
`/auth/transparency-notice`; `/metrics` behind the `metricsBearer` token; global `security` is
`demoActor` or `session`; `oidc` is `x-deprecated`.

### Added

- **Meetings (Jahrgang)**: `GET /meetings` (`listMeetings`, 025), `POST /meetings` (`createMeeting`,
  clone via `cloneFromMeetingId`, 040), `GET /meetings/{meetingId}` (`getMeetingById`, 025).
  `Meeting.format` (`MeetingFormat`: presence | hybrid | virtual, default presence, register E20 "auf
  Standard gebaut"), `Meeting.version` (ETag for administration writes, 040), `clonedFromMeetingId`,
  `configFrozenAt`, `configHash` (040), `counts.byUnit`, `counts.bySeat` (040); `MeetingStatus` as a
  named schema (same values). `MeetingCreate`.
- **Canonical collection paths** (025): `listMeetingAgendaItems`, `listMeetingUnits`,
  `listMeetingSpeakers`, `registerMeetingSpeaker`, `reorderMeetingSpeakers`,
  `listMeetingContributions`, `captureMeetingContribution`, `listMeetingQuestions`,
  `getMeetingStage` under `/meetings/{meetingId}/…`, same parameters, bodies and responses as their
  aliases (shared through `components/parameters`, `SpeakerOrder`, `QuestionList`).
- **`meetingId`** (optional, "Pflicht ab 0.3.1, Scheibe 028") on `Speaker`, `Contribution`, `Question`
  and `Event`; `meetingId` query filter on `listEvents`.
- **Agenda progress** (025, permission `agenda.manage`): `openAgendaItem`, `openVoting`, `closeVoting`
  under `/meetings/{meetingId}/agenda-items/{agendaItemId}/…`; event types `AgendaItemOpened`,
  `VotingOpened`, `VotingClosed` with `AgendaItemEventPayload`; `AgendaItem.openedAt`,
  `votingOpenedAt`, `votingClosedAt`.
- **Administration** (040): `replaceMeetingAgendaItems` (`AgendaItemInput`), `replaceMeetingUnits`
  (`UnitInput`, `admin.units.manage`), `listMeetingStageSeats`/`replaceMeetingStageSeats`
  (`StageSeat`, `StageSeatInput` with `personId` and `deviceId` per seat, `admin.seats.manage`, ADR
  0006), `freezeMeetingConfig` (`ConfigFreeze`, event `ConfigFrozen`, `admin.config.freeze`);
  `Question.seatId`, `Classification.seatId`; rule ids R-ADM-01..04 named in `Problem.ruleId`.
- **Role assignments** (026, ADR 0004, `admin.roles.manage`): `listRoleAssignments`, `assignRole`,
  `revokeRole`; `RoleAssignment`, `RoleAssignmentCreate`; events `RoleAssigned`/`RoleRevoked` with
  `RoleAssignmentEventPayload` (optional `unitId`); `Actor.personId`.
- **Claim/release** (028, register E36): `claimContribution`, `releaseContribution`,
  `claimQuestion`, `releaseQuestion` (`POST …/claim`, `POST …/release`); `Claim` on `Contribution`
  and `Question`; events `ContributionClaimed`, `ContributionReleased`, `QuestionClaimed`,
  `QuestionReleased`; `Contribution.version` ("Pflicht ab 0.3.1, Scheibe 028") and
  `Contribution._actions`; response `ContributionUpdated`.
- **Event envelope v2** (024, ADR 0011), all optional on `Event`: `schemaVersion`, `idempotencyKey`,
  `causationId`, `prevHash`, `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`
  (`OccurredAtSource`: server | device | paper | transcript), `retentionClass` (`RetentionClass`:
  record | working | technical, E16), `legalHold`, `personId`; `payload.pii` (`PiiEnvelope` with
  required `keyId`, ADR 0009). "Pflicht ab 0.3.1, Scheibe 028": `schemaVersion`, `meetingId`,
  `prevHash`, `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`, `retentionClass`, `legalHold`.
  `Event.at` stays and equals `recordedAt`. Sender statements enter through `ContributionCapture.
  occurredAt`/`occurredAtSource` (device | paper | transcript); `Contribution.occurredAt`,
  `occurredAtSource`; `paper` added to `source` on `Contribution` and `ContributionCapture` (025).
- **Realtime** (035, ADR 0014): `GET /stream` (`streamEvents`, `text/event-stream`, `after`,
  `meetingId`, header `Last-Event-ID`).
- **Sign-in through the BFF** (029, ADR 0004): security scheme `session` (cookie `hv_session`),
  `GET /auth/login` (`login`, 302), `GET /auth/callback` (`completeLogin`, 302/400), `POST /auth/logout`
  (`logout`, 204), `GET /auth/me` (`getSession`, `Session` with roles from the assignment table,
  `idpGroups` as suggestion, `csrfToken`), `GET /auth/transparency-notice` (`getTransparencyNotice`,
  `TransparencyNotice` with `text.de`/`text.en`, `version`, `dataProtectionSummaryUrl`; text is
  configuration, review pending E15). Global `security` becomes `demoActor` or `session`.
- **Platform** (033, ADR 0013): `GET /healthz` (`getHealth`, `Health`), `GET /readyz` (`getReadiness`,
  `Readiness` 200/503), `GET /metrics` (`getMetrics`, Prometheus text, security scheme
  `metricsBearer`). Header `X-Server-Time` in `components/headers`, referenced by every response
  (033; consumed by 032). Response `Unauthorized` (401) on `logout`, `getSession`, `getMetrics` only —
  the 401 gap of the existing operations is one of the five gaps of review 012 point 18 and stays
  with 043. Response `ServiceUnavailable` (503).
- **Permission identifiers** in `Action` (granted only in `ROLE_PERMISSIONS` by the implementing
  slice): `contribution.claim`, `question.claim` (028), `agenda.manage` (025),
  `admin.meetings.manage`, `admin.units.manage`, `admin.seats.manage`, `admin.config.freeze` (040),
  `admin.roles.manage` (026).
- `x-legal-notice` corrected (audit A3, pulled from 011): the contract cites no statute; rules carry
  `legalRef` from slice 011, collected in `docs/legal-trace.md`, all `verified: false` (E15).
- `info.description` names the meeting scope, the alias rule, the authentication model and the
  operation-coverage gate of the API test suite (`apps/api/src/__tests__/operation-coverage.setup.ts`,
  slice 023: every `operationId` exercised by a test or pre-declared; no pre-declared one exercised).

### Changed

- Parameters of `listSpeakers`, `listContributions`, `listQuestions`, `listEvents` moved to
  `components/parameters` (same names, schemas and defaults); the `reorderSpeakers` body is the named
  schema `SpeakerOrder`; the `listQuestions` 200 is the shared response `QuestionList`. Wire format
  unchanged.
- `Meeting.status` references `MeetingStatus` (same three values).
- `contract:lint` (redocly recommended) reports 6 warnings, all accepted and structural: `login` and
  `completeLogin` have no 2xx (they redirect), `login`, `getHealth`, `getReadiness` have no 4xx
  (probes and a redirect have none), `oidc` is unused (deprecated, kept for 0.2 readers).

### Deprecated

- The un-prefixed collection operations as alias for the current meeting — veraltet seit 0.3.0,
  entfallen mit Vertrag 0.5 (Plan 3 "Jahrgang und Tagesordnung"; no slice in Plan 5 names the
  removal yet): `getMeeting`, `listAgendaItems`, `listUnits`, `listSpeakers`, `registerSpeaker`,
  `reorderSpeakers`, `listContributions`, `captureContribution`, `listQuestions`, `getStage`. Served
  unchanged until then; the canonical form is named in each description.
- `StageAssignment`, `Question.stageAssignment`, `Classification.stageAssignment` — veraltet seit
  0.3.0, entfallen mit Vertrag 0.5 (ADR 0006): replaced by `StageSeat`/`seatId`; the four enum values
  are the ids of the default seats (040), so a value equals the `seatId` of that seat.
- Security scheme `oidc` — `x-deprecated: true` (a security scheme has no `deprecated` field),
  veraltet seit 0.3.0, entfällt mit Vertrag 0.5: contradicts ADR 0004 (no token in the browser).

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
