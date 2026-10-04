# Changelog — @hv/contract

All notable changes to `packages/contract/openapi.yaml` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the contract is versioned by
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) as decided in ADR 0015
(Vertragsversionierung — "Versionierung nach ADR 0015, vorgeschlagen"). The gate
`packages/contract/scripts/check.mjs` (run by `pnpm -r test`, therefore by `pnpm gates`) refuses a
contract change without a version bump and a section here, and refuses an expired entry in
`packages/contract/allowlist.json` (pre-declared, not yet implemented operations).

Each entry names the slice that implements it in core, seed, web or e2e.

## [0.4.4] - 2026-10-04

Additive patch step of the 0.4 cycle, after 0.4.3 of slice 048. The contract step of Scheibe 055 (Antwortformat,
part a: contract, core, service), written by the architect as the first commit of that slice, before its core code
(AGENTS.md rule 6). Nine new schemas, two new optional fields and one binding on the read path; no new operation,
no new `Action`, no new `Event.type`, no new required field in a request. The contract form "block document plus
`text`" that 043a assigned to 043b, which was never written. Built on the defaults: "auf Standard gebaut (E6, E21
offen)".

### Added

- **`AnswerBodyInput`**, **`AnswerBlockInput`**, **`AnswerInlineInput`** (Scheibe 055): the open input form of an
  answer document. Block type and mark are bounded strings, not enums: the core applies the whitelist (ADR 0005,
  rules N1 to N10), so an unknown mark becomes plain text over HTTP and in the demo alike instead of a `422`.
- **`AnswerBody`**, **`AnswerBlock`**, **`AnswerParagraph`**, **`AnswerList`**, **`AnswerInline`**,
  **`AnswerMark`** (Scheibe 055): the closed, normalised stored form. Blocks `paragraph` and `list`, marks `bold`,
  `italic`, `highlight`, `language` only `de` (E21). The structural limits (10000 blocks, 10000 items, 20000 runs)
  follow from the text limit of 20000 code points.
- **`AnswerDraft.body`** (Scheibe 055): optional `AnswerBodyInput`. With it the service stores as `text` the
  plain-text projection of the normalised document; the submitted `text` stays required and is then neither
  checked nor stored.
- **`AnswerVersion.body`** (Scheibe 055): optional `AnswerBody`, on every version from 0.4.4; derived from `text`
  for versions without a stored document (before 0.4.4, refusals).
- **`EventRead.payload.answer.body`** (Scheibe 055): bound to the closed `AnswerBody`; the `Event` description
  names `AnswerDrafted.answer.body` as the stored form.

### Changed

- **`draftAnswer`** and **`proposeRefusal`** (Scheibe 055, ADR 0005 decision 2a): the service removes control and
  format characters (Unicode `Cc` except tab, line feed, carriage return, where vertical tab, form feed and next
  line become a line feed; every `Cf`) from `text` and from each entry of `sources` and applies NFC before trimming;
  `proposeRefusal` does the same with `refusalJustification` before its checks (empty afterwards counts as missing,
  `409` R-GUARD-09 on path B). A lone surrogate in any of these fields is now `422`. The length
  limits still apply to the raw value. A text without such characters and already in NFC is stored exactly as
  before.

## [0.4.3] - 2026-10-04

Additive patch step of the 0.4 cycle, after 0.4.2 of slice 044a/044b. The contract step of Scheibe 048
(Weiterleiten an einen anderen Fachbereich), written by the architect as the first commit of that slice, before
its core code (AGENTS.md rule 6). **One new operation**; no existing request schema is widened or narrowed, no
field becomes required. A deviation from the cut of 043a (043b was never written and no longer carries
`forward`), not rule 1 of 043a. No allowlist entry: route and route test follow in the same pull request.
Built on the defaults: "auf Standard gebaut (E5 offen)" (owner's go to build on 04.10.2026).

### Added

- **`forwardQuestion`** (Scheibe 048): `POST /questions/{questionId}/forwards` with `Idempotency-Key`,
  `X-CSRF-Token` and required `If-Match`, responses as `assignQuestion`. Moves a question to another answering
  unit with a reason code; status, answer versions, legal clearing, approval and claim stay (row R-TRANS-17).
  `409` R-TRANS-00, R-GUARD-03, R-GUARD-15; `422` for form, length, unknown reason code and unknown unit.
- **`ForwardRequest`** (Scheibe 048): closed body `{ unitId, reasonCode }`, `unitId` 1 to 128 characters.
- **`ForwardReasonCode`** (Scheibe 048): closed enum `wrong_unit`, `expertise_elsewhere`, `capacity`, `other`;
  no free text, no personal data.
- **`QuestionForwardedPayload`** (Scheibe 048): closed payload `{ unitId, fromUnitId?, reasonCode }`, bound in
  `EventRead` to `type: QuestionForwarded` with `if`/`then`.
- **`Action`** (Scheibe 048): `question.forward`, after `question.assign`; granted by slice 048 to coordination
  and expert, never to admin.
- **`Event.type`** (Scheibe 048): `QuestionForwarded`, after `QuestionAssigned`.

## [0.4.2] - 2026-10-03

Additive patch step of the 0.4 cycle (rule 1 of slice 043a: the next free patch level, after 0.4.1 of slice
040b). The contract line of Scheibe 044a (Verweigerungspfad A und B im Kern, Teil 1: Regeln, Rechte, Katalog,
Maskierung), written by the architect as the first commit of that slice, before its core code. **Descriptions
only:** no schema gains or loses a property, no field becomes required, no request is widened or narrowed, no
operation is added; the three refusal operations stay pre-declared in `allowlist.json` until slice 044b mounts
them. Built on the defaults: "auf Standard gebaut" (Go des Eigentümers zu den Fragen 1, 2 und 3b der Spec 044a
am 03.10.2026; ADR 0012 proposed and not read by legal, E15, E25).

### Changed

- **`Event`** (Scheibe 044a): the `AnswerDrafted` payload of `proposeRefusal` carries `toStatus` (target status
  from the transition table, a `QuestionStatus`; without it, or with an unknown value, the projection keeps
  `answer_drafted`) and the justification only under `payload.pii` (`pii.refusalJustification` with
  `pii.keyId`), never in `answer`. This corrects the 0.4.0 wording ("`answer.refusalJustification` exists only
  in the stored original"). The refusal events (`AnswerDrafted` of `proposeRefusal`, `QuestionApproved` of
  `approveRefusal`) carry `retentionClass` `record`; every other answer event keeps `working` for now.
- **`EventRead`** and **`QuestionLegalClearedPayload.note`** (Scheibe 044a, SG2): `payload.pii` stays absent;
  `note` of a `QuestionLegalCleared` is absent from every event read path, for every reader and every legal
  clearance. The removal is bound to the event type, not to the key, so the schema carries no `note: false`;
  slice 044b proves it over HTTP.
- **`proposeRefusal`** (Scheibe 044a): the proposal leads straight to `in_review` (R-TRANS-15, text tracks
  only); `409` R-GUARD-09 covers path B without a ground and every refusal, path A and B, without a non-blank
  justification (default: justification required on both paths); `409` R-GUARD-03 on the podium track; `422`
  for form and length (validator and core) and for an unknown `refusalGroundId` (core only).
- **`approveRefusal`** (Scheibe 044a): `409` also names R-GUARD-04, R-GUARD-12/R-GUARD-13, R-GUARD-14 (approver
  is not the legal clearer) and R-TRANS-00 (row R-TRANS-16, `in_review` to `approved`).
- **`info.description`** ("Refusal"): the stored original keeps the justification only in `payload.pii`.

## [0.4.1] - 2026-10-03

Additive patch step of the 0.4 cycle (rule 1 of slice 043a: the next free patch level after 0.4.0). The contract
line of Scheibe 040b (Administration im Kern, Teil 2: Stammdaten und Bühnenplätze), written by the architect as
the first commit of that slice, before its core and service code. Built on the defaults: "auf Standard gebaut
(Go des Eigentümers 03.10.2026)" (E57: 043a question 5 and the 040 split with the budget for 040b). The four
master-data operations pre-declared since 0.3.0 are served from slice 040b; core, service and web adapter follow
in the later commits of that slice. No request schema gains a required field; no operation is narrowed (the
four operations keep the optional `IfMatch`; required from 0.5).

### Added

- **`Classification.seatId`** (Scheibe 040b; `type: string, maxLength: 128`, optional): the podium seat
  (Bühnenplatz) from the seat list of the question's meeting, otherwise `422`; with `stageAssignment` both must be
  equal, otherwise `422`. `stageAssignment` alone works as before. The only request widening of this release.
- **`Event.type`**: `AgendaItemsReplaced`, `UnitsReplaced`, `StageSeatsReplaced` (Scheibe 040b; additive enum
  values). Each names the meeting in `subjectId`, carries the whole list and raises `Meeting.version`.
- **Payload schemas** `AgendaItemsReplacedPayload`, `UnitsReplacedPayload`, `StageSeatsReplacedPayload`, bound
  per type in `Event` (nested `if`/`then`/`else`) and `EventRead` (`allOf`), each with `required: [subjectId]`.
- **`StageSeatRead`** and **`MeetingCreatedReadPayload`** (Scheibe 040b, privacy): in `EventRead` no seat carries
  `personId`, neither in `StageSeatsReplaced` nor in the optional `stageSeats` of `MeetingCreated` (seed; cloning
  from slice 040c). The masking rule for seats stands in one place (`StageSeatRead`, `personId: false`).

### Changed

- **Descriptions** (Scheibe 040b): `replaceMeetingAgendaItems`, `replaceMeetingUnits`, `replaceMeetingStageSeats`
  (the event each emits, the `422` cases including well-formed UTF-16, `409` R-ADM-02 "referenced master data
  stays", `409` R-ADM-01 "configuration of a closed meeting is immutable" only for an actor that still reaches the
  closed meeting such as the demo identity, while a session gets the documented `403` first because no
  assignment of a closed meeting is active; R-ADM-03 from slice 040d; optional `If-Match` checked when sent;
  replay with `Idempotency-Key`); `listMeetingStageSeats` and `StageSeat` (`personId` and `deviceId` only for
  holders of `admin.seats.manage`; order by `position`, then `id`); `Meeting.counts.byUnit`/`bySeat` (every unit
  or seat is a key, also with 0; the sum can be smaller than `open` or `staged`); `Question.seatId` (set from
  `Classification.seatId`, otherwise from `stageAssignment`); `Classification.stageAssignment` (successor
  `seatId` is here now); `Event` (the three payloads, optional `stageSeats` on `MeetingCreated`);
  `Problem.ruleId` (R-ADM-01 and R-ADM-02 with their content; the range R-ADM-01..09 and R-MTG-08/09 belongs to
  slice 040).
- **`allowlist.json`** (Scheibe 040b): the entries `replaceMeetingAgendaItems`, `replaceMeetingUnits`,
  `listMeetingStageSeats` and `replaceMeetingStageSeats` are removed (nine entries become five); `createMeeting`
  and `freezeMeetingConfig` stay (slices 040c and 040d).

## [0.4.0] - 2026-10-03

The one non-additive step of the 0.4 cycle (ADR 0015, vorgeschlagen): it removes fields deprecated since 0.2.0
and narrows one request field, so the minor version rises. Everything else in this release is additive. All of it
is Scheibe 043a (Teil 1 des Vertragspakets 043). Built on the defaults of ADR 0012, E15 and E25: "auf Standard
gebaut in 043a (Vertragsform), Go des Eigentümers 03.10.2026". The decision register changes no status; the
status changes come with slice 044. Neither core nor service change with this release; the three new operations
are pre-declared in `allowlist.json` (slice 044, expiry 2026-11-27) and not served before slice 044.

### Removed

- **`Speaker.kind`, `Speaker.requestedMinutes`, `SpeakerRegistration.kind`, `SpeakerRegistration.requestedMinutes`,
  `SpeakerUpdate.requestedMinutes`** (Scheibe 043a; deprecated since 0.2.0, Feedback #15; the core has ignored them
  since Scheibe 080). Removal one cycle after the deprecation, as ADR 0015 requires. No existing schema forbids
  unknown properties (no `additionalProperties: false` added), so a client that still sends one of the fields is
  not rejected: the service validator lets the unknown field pass and the core writes only named fields, so the
  value never reaches the event log. Responses have not carried the fields since 080.

### Changed

- **`SpeakerUpdate.reason`** (Scheibe 043a; served since Scheibe 080): now in the contract as
  `{ type: string, enum: [follow_up] }`. Required for `finished → waiting` (R-SPK-05; without it `409`
  R-SPK-GUARD-01), dropped and never written on any other change. A narrowing: before 0.4.0 the validator let any
  value pass and the core refused or dropped it; now any other value is a `422`. The web client's local block of
  `reason` in service mode is lifted in the second commit of 043a (`apps/web/src/api/http.ts`).
- **Descriptions** (Scheibe 043a): `info.description` "Compatibility" (the 0.3.x cycle is closed; 0.4.0 is the
  non-additive step; within 0.4.x the additive rules stay; a later request field arrives as the contract line of
  the implementing slice, always optional, a guard enforces a duty with `409`); `Unauthorized` and `Unprocessable`
  (the five gaps of review 012 point 18 are closed); `StreamUnavailable` (three causes, as `RetryAfter` counts them,
  takt-040 nit 5); `Classification.stageAssignment` (`seatId` comes with the contract line of 040, not with 0.4.0);
  `Role` (`coordination` has been built since 021); the `meetingId` filter of `listEvents` and the `seat` parameter
  of `getMeetingStage` come as contract lines of their implementing slices, not "with 0.4.0"; `Problem.ruleId` names
  the speaker rules; `updateSpeaker` gets a description.

### Added

- **Documented statuses** (Scheibe 043a, review 012 point 18): `401` (`Unauthorized`) on all 29 operations of 0.2;
  `422` (`Unprocessable`) on `listQuestions`, `returnQuestion` and `withdrawQuestion`; `409` on `updateSpeaker`
  with R-SPK-00 (no row) and R-SPK-GUARD-01. All of them were served before; the test helper's exception list
  `UNDOCUMENTED_STATUS_EXCEPTIONS` is empty now.
- **`InternalError`** (Scheibe 043a, follow-up list 035b): `500`, `application/problem+json`, documented on every
  operation, inside and outside `/v1` (`getHealth`, `getReadiness`, `getMetrics`, `/auth/*` included), because the
  service's global `onError` answers any unexpected exception of any route this way. The description names the four
  fixed `detail` texts ("Event seq N: integrity check failed.", "Persistence outcome is unknown.", "Persistence is
  unavailable.", "An unexpected error occurred."); none carries `Retry-After`; the `seq` is disclosed on purpose
  (every reader receives it as the `id` of `change` and `cursor` messages on `/stream`).
- **Refusal as a kind of answer** (Scheibe 043a, ADR 0012 model A; behaviour from Scheibe 044):
  - `AnswerKind` (`answer`, `refusal_no_claim` = refusal path A, `refusal_with_ground` = refusal path B).
  - Four optional response fields on `AnswerVersion`: `answerKind` (absent = `answer`), `refusalGroundId`,
    `refusalGroundHash` (`Sha256Hex`, the catalogue entry's `hash` at the proposal — the audit path of the
    catalogue; an approval against a changed entry is `409` R-GUARD-11 from 044) and `refusalJustification`
    (a legal assessment, SG2). `required` is unchanged. Invariants as `if`/`then`: an answer carries no `refusal*`
    field; path B carries ground and hash; path A carries neither.
  - `LegalRef` (form of the domain type, deliberately wider: `docHash` string, `verified: true` for 076),
    `RefusalGround` (`hash` = SHA-256 over RFC 8785 of the entry without `hash`), `RefusalProposal` (closed;
    `answerKind` without `answer`; a ground on path A is a `422`; path B's ground and justification are enforced by
    the guard R-GUARD-09 of 044 with `409`, not by the schema) and `RefusalApproval` (closed `{ answerVersion }`).
  - Pre-declared operations (allowlist, slice 044, expiry 2026-11-27): `listRefusalGrounds`
    (`GET /refusal-grounds`, readable with `question.read`, `question.read.delivered` or `stage.read`),
    `proposeRefusal` (`POST /questions/{questionId}/refusals`, written as `AnswerDrafted`, no new event type) and
    `approveRefusal` (`POST /questions/{questionId}/refusal-approvals`, written as `QuestionApproved`; `409` names
    R-GUARD-06, R-GUARD-08 and R-GUARD-11). Separate operations rather than new fields on `draftAnswer` and
    `approveQuestion`: those request schemas stay unchanged, so a refusal can never slip in as an answer.
  - `Action` +2: `question.refuse.propose`, `question.refuse.approve` (identifiers only; granted by slice 044, deny
    by default until then; never granted to admin).
  - Masking rule for `refusalJustification`, named at every read path: on `Question.answers` only for holders of
    `question.refuse.*` (never through `question.legal.clear`, never admin); never in `StageView`; never in
    `EventRead` (`payload.answer.refusalJustification: false`, for every reader of `getQuestionHistory`,
    `listEvents` and `/stream`); never matched by the full-text search. The `Event` description names the refusal
    fields of the `AnswerDrafted` payload and the snapshot `answer.refusalGround`; a bound payload schema follows
    with 043c.

## [0.3.12] - 2026-09-30

### Changed

- **takt-040: wording of `streamEvents` (`GET /stream`) and of the shared `RetryAfter` header aligned with the
  service built in Scheibe 035b.** Descriptions only; no schema, parameter, response or operation changes, so
  under ADR 0015 (vorgeschlagen) this is a patch release. No client behaviour that 0.3.11 allowed becomes
  invalid; the text now names what the service already does (035b, "Bauklärung" 1 and 2):
  - `meetingId` filter: "gap-free in `seq`" holds only without a filter. With a filter a reader with `event.read`
    receives every event of that meeting after the cursor exactly once and in ascending order, gap-free within
    the meeting; every other reader receives `change` messages for that meeting's events only (R-PERM-04); `id`
    stays the global `seq` (between two `event` messages, gaps are other meetings' events; for `change` readers
    the `id`s can also skip same-meeting events they may not read or that were merged into one `change`, whose
    `id` is the last covered `seq`); events without a meeting are not sent under a
    filter, also not to readers with `event.read`; the head moves on through the `cursor` message (after the catch-up and with the heartbeat); the
    catch-up limit of 1000 counts the global range.
  - `Retry-After`: on `/stream` 30 on every `503` `StreamUnavailable` (global stream limit,
    migrations pending, persistence busy at open) and on the stream's own `429` (too many open streams); a `429`
    from a read quota keeps the window rule. An `end` message, including `end` `unavailable`, carries no
    `Retry-After`; the SSE `retry` value (3000 ms) or the client's own backoff applies.

## [0.3.11] - 2026-09-30

### Changed

- **Scheibe 035a: semantics of the pre-declared operation `streamEvents` (`GET /stream`) replaced.** The
  operation was pre-declared in 0.3.0 (Scheibe 023), is listed in `allowlist.json` and was never served,
  so no client depends on its old semantics; under ADR 0015 (vorgeschlagen) this is a patch release. Changes
  against 0.3.0:
  - `after` is its own parameter `StreamAfter` (`minimum: 0`, `maximum: 9007199254740991`) **without
    `default`**: without `after` and without `Last-Event-ID` the stream starts at the head. The shared
    `After` parameter (`default: 0`) is unchanged and stays for `/events`.
  - `Last-Event-ID` is bounded: pattern `^[0-9]{1,16}$`, `maxLength: 16`, and at most
    9007199254740991 (a value above is a 422). It still wins over `after`.
  - New message kinds besides `event` (`EventRead`, now for readers with `event.read` only): `change`
    (`StreamChange`), `cursor` (`StreamCursor`), `reset` (`StreamReset`) and `end` (`StreamEnd` with the
    fixed reasons `session`, `forbidden`, `roles_changed`, `rotate`, `unavailable`). `reset` and `end`
    carry **no** SSE `id`. The first line is `retry: 3000`. The messages are listed in `x-sse-messages`
    of the `200` response.
  - Rights per message after the new rule R-PERM-04 (Scheibe 035a): readers without `event.read` receive
    content-free change signals with topics and readable ids only, instead of no stream at all.
  - Cursor and catch-up rules: `cursor` first on a stream without cursor, after a catch-up and with the
    heartbeat; catch-up of at most 1000 events, otherwise `reset`; a cursor beyond the head is `reset`;
    after `reset` the client reconnects without a cursor, and an `EventSource` client needs a new
    instance without `Last-Event-ID`.
  - Responses: `404` (unknown `meetingId`) is new; `429` names the limit of open streams per session or
    subject (`Retry-After` required); the `503` is the new response `StreamUnavailable` (`Retry-After`
    required) for both the global stream limit and a busy or not ready persistence, instead of
    `PersistenceBusy`.

### Added

- Schemas `StreamTopic`, `StreamChange`, `StreamCursor`, `StreamReset`, `StreamEnd`; parameter
  `StreamAfter`; response `StreamUnavailable`; the paragraph "Stream (since 0.3.11, slice 035a)" in
  `info.description`. The description of `EventRead` names the `event` message of `/stream`.
- The `streamEvents` entry stays in `allowlist.json` until Scheibe 035b serves the operation; 035a builds
  the visibility functions in the domain only and does not exercise the operation.

## [0.3.10] - 2026-09-29

### Added

- Scheibe 034a: the shared responses `RequestTimeout` (408), `PayloadTooLarge` (413), `TooManyRequests`
  (429) and `PersistenceBusy` (503), and the header `RetryAfter` (integer, 1 to 60, required on 429 and
  on `PersistenceBusy`). `408` and `429` are documented on every operation, `413` on every `POST`, `PUT`
  and `PATCH` operation (the body limit of 262 144 bytes applies to any body, also where no
  `requestBody` is declared), `503` `PersistenceBusy` on every operation under `/v1`. The existing
  `ServiceUnavailable` of the operations without credential is unchanged.
- `info.description`: the paragraph "Limits (since 0.3.10, slice 034a)" with the limits, the security
  headers on every response, the meaning of `500` "Persistence outcome is unknown." and the
  double-click convention: one `Idempotency-Key` per user intention, reused on repeat after 408, 429,
  503, 5xx or network error, never for a second intention.
- Why `408` (and not `503`/`504`) for a request that exceeds the time budget: the product plan and the
  security checklist name 408, RFC 9110 lets the client repeat it, and `503` stays reserved for an
  overloaded persistence.

### Changed

- **Narrower request schemas (not additive).** Length and list limits were added to request schemas:
  `maxLength` 500 for `note`, `lateEntryReason` and the `reason` of `revokeRole`, `returnQuestion` and
  `withdrawQuestion`; 60000 for contribution `text`; 4000 for question `text` (`maxItems` 200 in
  `captureQuestions`); 20000 for answer draft `text` (`sources` `maxItems` 50, each 2000); 200 for
  names, titles of a meeting and the search `q`; 500 for agenda item titles; 100 for seat labels; 32 for
  `UnitInput.shortName`; 128 for identifiers; `maxItems` 2000 for `SpeakerOrder.speakerIds` and 200
  (seats 50) for the `replaceMeeting*` lists. `Idempotency-Key` gets `minLength: 1`. A request over a
  limit is a 422 now, where the service accepted it before. Every limit lies far above real input.
  Whether narrowing a request schema is a patch step under ADR 0015 (vorgeschlagen) is the open owner
  question E55 (same question as 0.3.4 and 0.3.6); the default applied here is a patch, as a security
  correction (Scheibe 034a, SP-2).

## [0.3.9] - 2026-09-29

### Changed

- Scheibe 033b (additive, description only): `getMetrics` now says what the endpoint really serves: five
  business indicators and one technical count without labels (`hv_auth_no_active_role_total`), none per
  person; without a configured token every call is answered 401. No schema, status or parameter changes.
  The `getMetrics` entry leaves `allowlist.json`, because the operation is now served.

## [0.3.8] - 2026-09-29

### Changed

- Scheibe takt-023 (additive): the 403 of `GET /auth/me` (valid session, no active role) gets its own
  response `NoActiveRole`: problem+json with the required `csrfToken`, `Cache-Control: no-store` and
  `X-Server-Time`, so a client that learns of the role loss at startup can still sign out.
  `POST /auth/logout` no longer resolves roles; it checks session and CSRF only. No other operation changes.

## [0.3.7] - 2026-09-28

### Changed

- Scheibe 029b binds the OIDC callback to the browser that started login. The `/auth/login` 302
  now declares one short-lived, host-only `hv_auth_state` correlation cookie. The successful
  `/auth/callback` 302 declares two separate `Set-Cookie` lines: exactly one live `hv_session`
  and one clearing `hv_auth_state` scoped to `/auth/callback`. The per-line schemas and
  `x-required-cookie-lines` metadata make the required names and multiplicity testable.
- Failed `/auth/callback` responses (400, 403 and 503) also clear `hv_auth_state` on a separate
  cookie line, so a failed sign-in leaves no browser correlation value behind.
- The five auth operations are now covered by HTTP tests and removed from the pre-declared allowlist.
- `/auth/me` now documents 403 when a valid session has lost every active role assignment; the
  signed-in subject remains known, while the current grant is absent.
- Sign-in and callback return 503 until a versioned DE/EN transparency notice is configured and
  readable before login.

## [0.3.6] - 2026-09-27

### Changed

- Scheibe 028 makes `If-Match` mandatory for speaker, contribution and question writes except
  `deliverQuestion`: missing yields 428 and stale yields 412. The list ETag covers the entire
  meeting's speaker list; capture uses the speaker version, and atomisation uses the contribution
  version. `Meeting.version`, `Meeting.speakerListVersion`, `Contribution.version`, the resource
  `meetingId` fields and the nine persisted event envelope fields documented in the 028 spec are
  now required.
- This is an intentional **beta contract break within 0.3.x**, not an additive patch. The product
  plan schedules it for 0.3.6 and `docs/slices/028-idempotenz-konflikte.md` defines the migration
  window before external partner use. ADR 0015's Semver rule would otherwise require a major
  version; any proven 0.3.5 partner must receive a separate compatibility decision.
- A confirmed idempotent replay survives restart and returns the original business result only
  after checking current rights. Identity masking and `_actions` reflect the current actor.

### Added

- Claim/release for contributions and questions, stored as append-only events, with a ten-minute
  soft expiry. `IdempotencyRecorded` receipts make successful no-op commands durable. Optional
  `Event.commandId`, `commandOperation` and `commandResource` bind events of one command without
  storing request bodies or personal content.

## [0.3.5] - 2026-09-27

### Changed

- Slice 027 implements the pre-declared `getReadiness` operation. The `clock` check may now
  return `not_configured` while its NTP adapter is pending in slice 033. The code was already
  defined for other checks; the response remains limited to status and allowed codes.
- Slice 028's planned mandatory fields and `If-Match` requirement move to 0.3.6. No slice 028
  field becomes mandatory in this patch.

## [0.3.4] - 2026-09-27

### Changed

- Slice 026 (ADR 0009, 0013 and 0015): `getQuestionHistory`, `listEvents` and SSE now return
  `EventRead`, a redacted projection of the unchanged stored `Event`. It retains the global `seq`
  but omits `personId`, `payload.pii`, historical clear-name fields, `hash` and `prevHash`.
  `sourceHash` identifies the complete stored original and cannot be recomputed from the redacted
  JSON. This is an intentional response compatibility boundary before beta: clients that consumed
  personal data or recomputed the hash from the HTTP event must adapt to `EventRead`.
- Slice 028's planned mandatory fields and `If-Match` requirement move from 0.3.4 to 0.3.5.
  No slice 028 field becomes mandatory in this patch.

## [0.3.3] - 2026-09-27

### Added

- takt-019 for slice 025: additive `MeetingStarted` and `MeetingClosed` event types. Each names the
  meeting in `subjectId` and has an empty payload. Starting with slice 025, `MeetingCreated`
  projects `preparation`, `MeetingStarted` projects `running`, and `MeetingClosed` projects `closed`.
  `DebateClosed` remains a separate fact about the general debate and does not close the meeting.
  No public operation is added by this contract-only bridge.

### Changed

- The mandatory fields and If-Match requirement of slice 028 move from 0.3.3 to 0.3.4. Existing
  request and response fields remain optional in this patch.

## [0.3.2] - 2026-09-26

### Added

- takt-016 for slice 025: optional `Meeting.debateClosedAt`, `Contribution.lateEntry`, and
  `MeetingContributionCapture.lateEntryReason`; the latter is accepted only on the canonical
  meeting capture operation and rejects an empty string. R-MTG-03 in 025 decides when the reason
  is required and when `lateEntry` is true.
- `DebateClosed` in `Event.type`, with the meeting as `subjectId`. Slice 025 can prove the rule with
  a synthetic closed-debate event and the real HTTP capture route. A public closing operation waits
  for the remainder-list guard in slice 087.

### Changed

- `Meeting.version` is projected from slice 025 so the already required ETag of `getMeetingById`
  can be returned. It remains optional in the schema.
- The mandatory fields and If-Match requirement planned for slice 028 move from 0.3.2 to 0.3.3;
  this patch introduces no new required field or operation.

## [0.3.1] - 2026-09-26

Slice 021c (Rechtsfreigabe und Rechtstor): additive legal clearance operation
`POST /questions/{questionId}/legal-clearances` (`clearQuestionLegally`) with optional
`answerVersion` and `note`, the `Question.legalClearance` projection, and an optional
`QuestionLegalClearedPayload.answerVersion` for the podium track. The operation uses the
same If-Match and Idempotency-Key conventions as `approveQuestion`. The mandatory fields
and If-Match requirement planned for slice 028 move to 0.3.2.

## [0.3.0] - 2026-09-24

Slice 023 (Architekt), contract only: the foundation package for M2 (Plan 5.4). Additive: nothing
removed, nothing becomes required, all existing tests stay green. 29 → 65 operations; the 36 new ones
are pre-declared in `allowlist.json` (expiry 2026-11-25 = end of M2 + 14 days) and implemented by
025, 026, 028, 029, 033, 035 and 040. `If-Match` stays optional; 0.3.2 (slice 028) makes it and the
fields marked "Pflicht ab 0.3.2" mandatory. Reworked before the merge after the Opus review and two
Codex findings (24.09.2026): request schemas of existing operations are back to their 0.2.1 shape
(see "Compatibility" under Changed), `X-CSRF-Token` declared, `ReadinessCheckCode` instead of free
text, 404 on the alias operations with the current-meeting rule, 409 on `registerSpeaker` and
`captureContribution`. Invariant sweep after Codex round 5 (24.09.2026): invariants that were prose
are now schema — `dependentRequired` pairs, `oneOf` variants, required checks, `EventActor` for
events, one payload per role event, `Problem.status` bound to the HTTP status, required `ETag` and
`Location` where promised (see Added and Deprecated).

Decisions of the architect (Festlegungen, reasoning in `docs/slices/023-vertrag-0-3-0-fundament.md`):
(a) meeting scope is expressed at the collection: canonical `/meetings/{meetingId}/…` for the ten
collection operations, items with a global id stay where they are, the un-prefixed collection paths
are the alias for the current meeting until 0.5 and are `deprecated` now; `/events` and `/stream` are
global, `/stream` with a `meetingId` filter (`/events` gets it in 0.4.0). (b) Envelope fields lie flat on `Event`, mirroring the persistence
columns (Plan 3). (c) The transparency notice is `GET /auth/transparency-notice`, `security: []`.
(d) New permission identifiers: `contribution.claim`, `question.claim`, `agenda.manage`,
`admin.meetings.manage`, `admin.units.manage`, `admin.seats.manage`, `admin.roles.manage`,
`admin.config.freeze`; after Codex on 50cc738 also `question.identity.reveal` (026), `admin.override`
(040), `question.read.protected` and `event.read.personal` (047). (e) Without credential: `/healthz`, `/readyz`, `/auth/login`, `/auth/callback`,
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
- **`meetingId`** (optional, "Pflicht ab 0.3.2, Scheibe 028") on `Speaker`, `Contribution`, `Question`
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
  `RoleAssignedPayload` (optional `unitId`) and `RoleRevokedPayload`; `Actor.personId`.
- **Claim/release** (028, register E36): `claimContribution`, `releaseContribution`,
  `claimQuestion`, `releaseQuestion` (`POST …/claim`, `POST …/release`); `Claim` on `Contribution`
  and `Question`; events `ContributionClaimed`, `ContributionReleased`, `QuestionClaimed`,
  `QuestionReleased`; `Contribution.version` ("Pflicht ab 0.3.2, Scheibe 028") and
  `Contribution._actions`; response `ContributionUpdated`.
- **Event envelope v2** (024, ADR 0011), all optional on `Event`: `schemaVersion`, `idempotencyKey`,
  `causationId`, `prevHash`, `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`
  (`OccurredAtSource`: server | device | paper | transcript), `retentionClass` (`RetentionClass`:
  record | working | technical, E16), `legalHold`, `personId`; `payload.pii` (`PiiEnvelope` with
  required `keyId`, ADR 0009). "Pflicht ab 0.3.2, Scheibe 028": `schemaVersion`, `meetingId`,
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
- **Invariants as schema (Codex round 5).** Every schema and operation new in 0.3.0 was swept for
  prose invariants; what JSON Schema can express is now schema (the list of places checked is in the
  report of slice 023). `EventActor` for `Event.actor` (`id`, `role`, `personId`; `displayName`
  deprecated, see Deprecated) — `Actor` stays for projections (answer versions, approvals, role
  assignments, the session). On `Event`: `dependentRequired` `occurredAt` ↔ `occurredAtSource`,
  `hash` ↔ `prevHash`, `schemaVersion` → the v2 envelope of slice 024 (`prevHash`, `hash`,
  `recordedAt`, `occurredAt`, `occurredAtSource`, `retentionClass`, `legalHold`; `meetingId` is left
  out because the core carries it only from 025 and 0.3.2 requires it anyway), and
  `dependentSchemas`: an event with `schemaVersion` carries no `actor.displayName`. Pairs on
  projections: `Contribution` `occurredAt` ↔ `occurredAtSource`; `Meeting` `configFrozenAt` ↔
  `configHash`; `AgendaItem` `votingOpenedAt` → `openedAt` (as `openVoting` states: `409` when the
  item is not open), `votingClosedAt` → `votingOpenedAt`; `RoleAssignment` `revokedAt` ↔
  `revokedBy`; `Question` `stageAssignment` and `seatId` name the same default seat when both are
  present. `Session` is a `oneOf` of `DemoSession` (`scheme: demoActor`, exactly one role, no
  `csrfToken`, no `expiresAt`) and `SignedInSession` (`scheme: session`; `subjectId`, `roles` (≥ 1),
  `expiresAt`, `csrfToken` required) with a `discriminator` on `scheme`. `Readiness.checks` has
  exactly the required properties `clock`, `db`, `migrations` (027 precedes 033;
  `additionalProperties: false` replaces `propertyNames`); each is a `ReadinessCheck` (`ok` without
  `code`, `fail` with `code`); the 200 binds every check to `ok`, the 503 at least one to `fail`.
  Event payloads: `AgendaItemEventPayload.number` required; `RoleAssignmentEventPayload` split into
  `RoleAssignedPayload` (now with `deputyForSubjectId`, which `RoleAssignment` projects) and
  `RoleRevokedPayload` (`reason`), each forbidding the other's fields. Every problem response binds
  `Problem.status` to its HTTP status (`const`; shared responses and the `completeLogin` 400).
  Header `ETagRequired` (`required: true`) on the new operations that promise an ETag
  (`createMeeting`, `getMeetingById`, the three `replace…` operations, `freezeMeetingConfig`,
  `AgendaItemUpdated`, `ContributionUpdated`); `Location` required on both 302.
  `TransparencyNotice.version`, `text.de`, `text.en` non-empty. Nothing narrows a request of an
  existing operation; the narrowed responses of existing operations (problem `status`, `Event`,
  `Question`) are exactly what today's service sends — the whole API suite and a live probe validate
  them. Deliberately prose, because JSON Schema cannot compare two values, inspect free text or bind
  a header to one security scheme: `at` = `recordedAt`; `occurredAt` = `recordedAt` for source
  `server`; `legalHold` false in the beta; `Claim.expiresAt` after `claimedAt`; the order of the
  agenda instants; `DemoSession.roles` = `[actor.role]`; `X-CSRF-Token` required under `session`
  only; no personal data in `RoleRevokedPayload.reason`, in problem `detail` on the operations
  without credential, and in payloads outside `pii` (the seed's `SpeakerRegistered.displayName`
  pseudonym stays until slice 026).
- Last small round (Opus recheck and Codex on 8ef3ad2, 24.09.2026), all additive against today's
  service: `Readiness.checks` narrows the codes per check (`clock`: `clock_unsynced`, `clock_drift`,
  `timeout`; `db`: `not_configured`, `unreachable`, `timeout`; `migrations`: `migrations_pending`,
  `not_configured`, `unreachable`, `timeout`) and both `ReadinessCheck` variants are closed
  (`additionalProperties: false`), so `/readyz` carries no free text. `Event`: every v2 envelope
  field (`hash`, `prevHash`, `recordedAt`, `occurredAt`, `occurredAtSource`, `retentionClass`,
  `legalHold`) requires `schemaVersion`, whose minimum is now `2` (no v1 event on the wire); the
  agenda and role events require `subjectId`. `Contribution.occurredAtSource` is
  `device | paper | transcript` (never `server`), as in `MeetingContributionCapture`. Optional `ETag`
  (= `Contribution.version`) on the `getContribution` 200 and the `captureMeetingContribution` 201.
  `DemoSession` declares `subjectId` (= `actor.id`) and forbids `idpGroups` and `personId`.
  `completeLogin` 302 requires `Set-Cookie` (`hv_session=…`). `logout` takes the new parameter
  `CsrfTokenRequired` (`X-CSRF-Token`, `required: true`), because `session` is its only scheme. The
  contract test helper now fails a response that lacks a header marked `required: true` and does not
  count it as exercised. None of these responses or requests is produced or accepted by the 0.2.1
  service today (live probe: 2329 seed events, none with `schemaVersion`, all valid).
- Security sweep (Codex on 50cc738, 24.09.2026; table in the slice report): `completeLogin` 302
  `Location` is a `SameOriginPath` (new schema: starts with one `/`, never `//` or `/\`, no
  backslash, whitespace or control character; the same rule the service applies to `returnTo`, which
  stays unvalidated because a foreign value is ignored, not rejected); its `Set-Cookie` needs a value
  of at least 32 cookie octets plus `HttpOnly`, `Secure` and `SameSite=Lax|Strict` in any order and
  no `Max-Age=0`; `logout` 204 requires a clearing `Set-Cookie` (`hv_session=` empty, `Max-Age=0`);
  new header `CacheControlNoStore` (required `no-store`) on `login` 302, `completeLogin` 302,
  `logout` 204 and `getSession` 200. `Action` +4: `question.identity.reveal`, `admin.override`,
  `question.read.protected`, `event.read.personal`. New schemas `Sha256Hex` (`Event.hash`,
  `Meeting.configHash`, `ConfigFreeze.configHash`; `Event.prevHash` is the same or empty) and
  `SubjectId` (1–255 characters, no `@`, no whitespace: every subject id of `RoleAssignment`,
  `RoleAssignmentCreate`, the role payloads and both session variants). `SignedInSession.csrfToken`
  at least 32 base64url characters; `Event.idempotencyKey` 1–128 characters like the header; `ETag`
  and `ETagRequired` bound to the entity-tag syntax (today's service sends `"v<n>"`, checked by the
  whole API suite). The contract test helper validates the value of every declared response header
  that is present, not only the presence of the required ones.
- Cookie scope and chain genesis (Codex on f611116, 24.09.2026): the `completeLogin` cookie also
  requires `Path=/` (a cookie set from `/auth/callback` without it would stay under `/auth` and never
  reach `/v1`) and forbids any other `Path`, any `Domain` (host-only) and a second `SameSite` other
  than `Lax`/`Strict`; forbidden attribute names match in any case. The `logout` clearing cookie
  requires the same scope (`Path=/`, no `Domain`), because a browser only replaces a cookie with the
  same name, path and domain. `Event.seq` has `minimum: 1`; in a v2 envelope (`schemaVersion`
  present) `prevHash` is `""` exactly at `seq` 1 and a `Sha256Hex` from `seq` 2 on
  (`dependentSchemas.schemaVersion`, so today's events without an envelope are untouched — live probe
  2329 events, `seq` 1..2329).
- Several `Set-Cookie` lines (Codex on 929d0d7, SECURITY): exactly one `hv_session` cookie per
  response on `completeLogin` and `logout`, stated in both descriptions. The schema describes one
  header line and must be applied to every line on its own (`Headers.getSetCookie()`), never to the
  comma-joined value. Safety net in both patterns: no comma, no second `hv_session=` and no `Expires`
  (lifetime only through `Max-Age`; `Expires` is the only attribute whose value holds a comma). The
  contract test helper validates every `Set-Cookie` line separately, allows at most one session
  cookie per response and rejects any cookie on a response whose contract declares no `Set-Cookie`.
- Response reconciliation (Codex on 2779e0b; architect's addendum to slice 023): every status the
  service's generic layer produces from a contract property is documented — 422 for a request body
  or a query/header parameter that can fail its schema, 401 for a non-empty `security`, 404 for a
  path parameter, 412 for `If-Match`. Added (responses only, nothing removed, no request schema
  changed): `401` on the 28 operations new in 0.3.0 with actor security that lacked it; `422` on
  `streamEvents`, `listMeetings`, `listMeetingSpeakers`, `listMeetingQuestions`,
  `listRoleAssignments`, `claimContribution`, `releaseContribution`, `claimQuestion`,
  `releaseQuestion`, `openAgendaItem`, `openVoting`, `closeVoting`, `revokeRole`,
  `freezeMeetingConfig`, `login` (`returnTo` over 512 characters; a foreign target stays ignored) and
  `logout` (empty `X-CSRF-Token`), and — additively on 0.2 operations, the status today's service
  already returns — on `listSpeakers`, `assignQuestion`, `submitForReview`, `stageQuestion`,
  `deliverQuestion`, `closeQuestion`, `mergeQuestion`, `listEvents` and `seedDemo` (mostly an
  `Idempotency-Key` over 128 characters or an out-of-range query value). The five gaps of review 012
  point 18 (401 on the 0.2 operations; 422 on `listQuestions`, `returnQuestion`, `withdrawQuestion`)
  stay reasoned exceptions for 0.4.0 (slice 043). A test in `apps/api/src/__tests__/contract.test.ts`
  enforces the rule for every operation against the one exception list in the test helper.

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
  dropped). What remains and is visible today: (1) response enums widened — `Action` +12
  (`contribution.claim`, `question.claim`, `agenda.manage`, `admin.meetings.manage`,
  `admin.units.manage`, `admin.seats.manage`, `admin.roles.manage`, `admin.config.freeze`, and after
  Codex on 50cc738 `question.identity.reveal`, `admin.override`, `question.read.protected`,
  `event.read.personal`),
  `Event.type` +10 (`ContributionClaimed`, `ContributionReleased`, `QuestionClaimed`,
  `QuestionReleased`, `AgendaItemOpened`, `VotingOpened`, `VotingClosed`, `RoleAssigned`,
  `RoleRevoked`, `ConfigFrozen`), `Contribution.source` +`paper` — none produced by the service yet;
  (2) optional response fields added everywhere (never set by the service yet); (3) the optional
  header parameter `X-CSRF-Token` on the 16 existing state-changing operations (ignored by today's
  service; a plain string, so no request can newly fail on it); (4) documented but not yet produced:
  `404` on the alias operations other than `getMeeting`, `409` on `registerSpeaker` and
  `captureContribution`, the response header `X-Server-Time` (optional, sent from 033).
- `contract:lint` (redocly recommended) reports 5 warnings, all accepted and structural: `login` and
  `completeLogin` have no 2xx (they redirect), `getHealth` and `getReadiness` have no 4xx (probes
  have none), `oidc` is unused (deprecated, kept for 0.2 readers). The sixth, "`login` has no 4xx",
  went away with its `422` (Codex on 2779e0b).

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
(compare 0.3.2 in slice 028); 0.3.0 is reserved for the next contract package (slice 023).

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
