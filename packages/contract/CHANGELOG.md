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
fields marked "Pflicht ab 0.3.1" mandatory. Reworked before the merge after the Opus review and two
Codex findings (24.09.2026): request schemas of existing operations are back to their 0.2.1 shape
(see "Compatibility" under Changed), `X-CSRF-Token` declared, `ReadinessCheckCode` instead of free
text, 404 on the alias operations with the current-meeting rule, 409 on `registerSpeaker` and
`captureContribution`. Invariant sweep after Codex round 5 (24.09.2026): invariants that were prose
are now schema — `dependentRequired` pairs, `oneOf` variants, required checks, `EventActor` for
events (see Added and Deprecated).

Decisions of the architect (Festlegungen, reasoning in `docs/slices/023-vertrag-0-3-0-fundament.md`):
(a) meeting scope is expressed at the collection: canonical `/meetings/{meetingId}/…` for the ten
collection operations, items with a global id stay where they are, the un-prefixed collection paths
are the alias for the current meeting until 0.5 and are `deprecated` now; `/events` and `/stream` are
global, `/stream` with a `meetingId` filter (`/events` gets it in 0.4.0). (b) Envelope fields lie flat on `Event`, mirroring the persistence
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
  aliases (shared through `components/parameters`, `SpeakerOrder`, `QuestionList`) — except
  `captureMeetingContribution`, whose body `MeetingContributionCapture` is the superset with the paper
  path and the sender's time statement (see the envelope entry below).
- **`meetingId`** (optional, "Pflicht ab 0.3.1, Scheibe 028") on `Speaker`, `Contribution`, `Question`
  and `Event`; `meetingId` query filter on `streamEvents` (on `listEvents` with 0.4.0, slice 043: the
  unchanged service would accept and ignore it today).
- **Agenda progress** (025, permission `agenda.manage`): `openAgendaItem`, `openVoting`, `closeVoting`
  under `/meetings/{meetingId}/agenda-items/{agendaItemId}/…`; event types `AgendaItemOpened`,
  `VotingOpened`, `VotingClosed` with `AgendaItemEventPayload`; `AgendaItem.openedAt`,
  `votingOpenedAt`, `votingClosedAt`.
- **Administration** (040): `replaceMeetingAgendaItems` (`AgendaItemInput`), `replaceMeetingUnits`
  (`UnitInput`, `admin.units.manage`), `listMeetingStageSeats`/`replaceMeetingStageSeats`
  (`StageSeat`, `StageSeatInput` with `personId` and `deviceId` per seat, `admin.seats.manage`, ADR
  0006), `freezeMeetingConfig` (`ConfigFreeze`, event `ConfigFrozen`, `admin.config.freeze`);
  `Question.seatId` on the response (`Classification.seatId` follows in 0.4.0, slice 043, because the
  unchanged service would drop it silently today); rule ids R-ADM-01..04 named in `Problem.ruleId`.
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
  `Event.at` stays and equals `recordedAt`. Sender statements enter only through
  `MeetingContributionCapture.occurredAt`/`occurredAtSource` (device | paper | transcript; both or
  neither, `dependentRequired` in both directions) on `captureMeetingContribution`;
  `Contribution.occurredAt`, `occurredAtSource` on the response; `paper` added to `Contribution.source`
  (response) and `MeetingContributionCapture.source` — `ContributionCapture`, the alias body, is
  unchanged (025).
- **Realtime** (035, ADR 0014): `GET /stream` (`streamEvents`, `text/event-stream`, `after`,
  `meetingId`, header `Last-Event-ID`).
- **Sign-in through the BFF** (029, ADR 0004): security scheme `session` (cookie `hv_session`),
  `GET /auth/login` (`login`, 302), `GET /auth/callback` (`completeLogin`, 302/400), `POST /auth/logout`
  (`logout`, 204), `GET /auth/me` (`getSession`, `Session` with roles from the assignment table,
  `idpGroups` as suggestion, `csrfToken`), `GET /auth/transparency-notice` (`getTransparencyNotice`,
  `TransparencyNotice` with `text.de`/`text.en`, `version`, `dataProtectionSummaryUrl`; text is
  configuration, review pending E15). Global `security` becomes `demoActor` or `session`. Header
  parameter `X-CSRF-Token` (`components/parameters/CsrfToken`; optional in 0.3.0, enforced under
  `session` by 029; the name is the convention frameworks and the OWASP cheat sheet use) declared on
  all 34 state-changing operations, `logout` included.
- **Platform** (033, ADR 0013): `GET /healthz` (`getHealth`, `Health`), `GET /readyz` (`getReadiness`,
  `Readiness` 200/503 with `ReadinessCheckCode` per failed check — a code, never free text, because the
  endpoint is public), `GET /metrics` (`getMetrics`, Prometheus text, security scheme
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
- Current meeting behind the alias paths defined (review 023): the meeting in status `running` with
  the latest `date` (several running: latest `date`, ties: latest `MeetingCreated`); none running:
  the latest `date` regardless of status; no meeting at all: `404` — now documented on all ten alias
  operations (`getMeeting` produces it today before the first seed; the others from 025).
- `409 Conflict` documented on `registerSpeaker` and `captureContribution` (the alias paths), so the
  R-MTG rules of 025 (no capture after the debate closed) need no further contract cycle; the
  canonical counterparts share the handler.
- **Invariants as schema (Codex round 5).** `EventActor` for `Event.actor` (`id`, `role`, `personId`;
  `displayName` deprecated, see Deprecated) — `Actor` stays for projections (answer versions,
  approvals, role assignments, the session). On `Event`: `dependentRequired` `occurredAt` ↔
  `occurredAtSource`, `hash` ↔ `prevHash`, `schemaVersion` → the v2 envelope of slice 024 (`prevHash`,
  `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`, `retentionClass`, `legalHold`; `meetingId`
  is left out because the core carries it only from 025 and 0.3.1 requires it anyway), and
  `dependentSchemas`: an event with `schemaVersion` carries no `actor.displayName`. `Session` is a
  `oneOf` of `DemoSession` (`scheme: demoActor`, exactly one role, no `csrfToken`, no `expiresAt`)
  and `SignedInSession` (`scheme: session`; `subjectId`, `roles` (≥ 1), `expiresAt`, `csrfToken`
  required) with a `discriminator` on `scheme`. `Readiness.checks` has exactly the required
  properties `clock`, `db`, `migrations` (027 precedes 033; `additionalProperties: false` replaces
  `propertyNames`); each is a `ReadinessCheck` (`ok` without `code`, `fail` with `code`); the 200
  binds every check to `ok`, the 503 at least one to `fail`. Today's events (all 0.2 shape, all with
  `actor.displayName`) stay valid.

### Changed

- Parameters of `listSpeakers`, `listContributions`, `listQuestions`, `listEvents` moved to
  `components/parameters` (same names, schemas and defaults); the `reorderSpeakers` body is the named
  schema `SpeakerOrder`; the `listQuestions` 200 is the shared response `QuestionList`. Wire format
  unchanged.
- `Meeting.status` references `MeetingStatus` (same three values).
- **Compatibility — what a 0.2 client sees from the unchanged service after this release** (review
  023; the rule "clients must ignore unknown enum values and unknown optional fields" is now in
  `info.description`). Request schemas of the 29 existing operations are *unchanged*: the rework moved
  `source: paper`, `occurredAt`, `occurredAtSource` to `MeetingContributionCapture`
  (`captureMeetingContribution` only), `Classification.seatId` and the `listEvents` `meetingId` filter
  to 0.4.0 (slice 043), because the service validates requests against the contract and each of them
  had taken effect immediately (`paper` was written to the log, `seatId` and `meetingId` were silently
  dropped). What remains and is visible today: (1) response enums widened — `Action` +8
  (`contribution.claim`, `question.claim`, `agenda.manage`, `admin.meetings.manage`,
  `admin.units.manage`, `admin.seats.manage`, `admin.roles.manage`, `admin.config.freeze`),
  `Event.type` +10 (`ContributionClaimed`, `ContributionReleased`, `QuestionClaimed`,
  `QuestionReleased`, `AgendaItemOpened`, `VotingOpened`, `VotingClosed`, `RoleAssigned`,
  `RoleRevoked`, `ConfigFrozen`), `Contribution.source` +`paper` — none produced by the service yet;
  (2) optional response fields added everywhere (never set by the service yet); (3) the optional
  header parameter `X-CSRF-Token` on the 16 existing state-changing operations (ignored by today's
  service; a plain string, so no request can newly fail on it); (4) documented but not yet produced:
  `404` on the alias operations other than `getMeeting`, `409` on `registerSpeaker` and
  `captureContribution`, the response header `X-Server-Time` (optional, sent from 033).
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
- `EventActor.displayName` — veraltet seit 0.3.0, entfällt mit Scheibe 024 (envelope v2): every
  event of today's service carries it (the demo actors of the seed), so it stays allowed on events
  without `schemaVersion`; an event with `schemaVersion` must not carry it (`dependentSchemas` on
  `Event`), so it leaves the wire with 024; the property leaves the schema with 0.5 (ADR 0009/0011,
  ADR 0015; Codex round 5).
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
