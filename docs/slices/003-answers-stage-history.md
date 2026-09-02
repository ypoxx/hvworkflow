# 003 — Beantwortung (Expert Track), Freigabe, Bühne, Historie & Suche

**Status:** review
**Role:** Implementierer Oberfläche (Sonnet)
**Rule ids:** AGENTS.md rules 4, 5, 6, 9, 10; domain R-TRANS-02…R-TRANS-12, R-GUARD-04

## Goal

The afternoon: the answer backlog under pressure, the approval bound to a text version, and the
podium.

### A. Beantwortung (`/answers`, `src/features/answers/`)

- **Work list** (left, ~40%): filter chips by status (all non-terminal statuses with counts), track,
  answering unit, agenda item; free-text search (`q`); sort by number or age. Virtualised or paged
  so 800 rows stay fast (simple windowing is fine). Row: number, speaker, first 90 chars, status
  badge, track badge, unit short name, age ("vor 12 min").
- **Detail** (right): question text with speaker and contribution link; classification summary;
  **answer versions** as a vertical list (version, author, time, sources), latest expanded;
  **editor** for a new version (textarea + sources input) shown only if `answer.draft` in
  `_actions`; buttons from `_actions` only: "Zuweisen" (unit select), "Zur Prüfung geben",
  "Freigeben Version n" (approves the *latest* version; disabled with a hint if none),
  "Zurückgeben" (dialog with reason), "Auf die Bühne", "Zusammenführen" (dialog: pick target by
  number), "Zurückziehen" (reason).
- Approval is displayed as a sealed block: "Freigegeben Version 2 von Legal Clearing, 14:02". If a
  newer version exists the block shows "Freigabe erloschen durch Version 3" (status is
  `answer_drafted` then — do not invent this in the interface, read it from the record).
- Every write sends `ifMatch: etagOf(question.version)`; on 412 toast + refetch; on 403/409 show
  `detail` and `ruleId`.

### B. Bühne (`/stage`, `src/features/stage/`)

Large-type podium view for the person reading: current question (number, speaker, the question
text at ~28px), the **approved answer text** below at ~24px (podium track: "Freie Beantwortung"
placeholder), stage assignment badge (Vorstandsvorsitz / CFO / AR-Vorsitz), and the queue on the
right (next 8 with numbers). Buttons only from `_actions`: **"Vorgelesen, weiter"** (deliver, then
the next becomes current) and **"Antwort zurückgeben"** (reason dialog). Keyboard: `Space` = weiter,
`R` = zurückgeben. Counters: vorgelesen / offen. Must render instantly with 800 questions.
A "Nur Bühne" toggle hides navigation and header (full-screen podium mode).

### C. Historie & Suche (`/history`, `src/features/history/`)

Search over all questions (`api.listQuestions({q})`), result list, and for a selected question the
**Vorgangshistorie** from `api.getQuestionHistory(id)`: a timeline of events with time, actor
display name, event label in house vocabulary, and payload summary (reason, version, unit).
Also an "Ereignisstrom" tab showing the last 200 events of the meeting (`api.listEvents`).

## Non-goals

No Vorabfragen, no refusal path, no notary, no publications.

## Files allowed

`apps/web/src/features/answers/**`, `apps/web/src/features/stage/**`, `apps/web/src/features/history/**`,
`apps/web/src/app/routes.tsx` (wire pages), `apps/web/src/i18n/*.ts` (add keys), `docs/evidence/003-*`.

## Acceptance criterion

`pnpm gates` green. As Fachbereich: draft an answer on an assigned question, submit. As Legal:
approve version 1. As Freigabe: send to stage. As Podium: read out, next. History shows all
events. Screenshots `docs/evidence/003-answers.png`, `003-stage.png`, `003-history.png`.

## Evidence

Screenshots at 1440×900, produced by the run below:
`docs/evidence/003-answers.png`, `003-stage.png`, `003-stage-only.png`, `003-history.png`.

### `pnpm gates` (exit 0)

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  37 passed (37)
packages/domain test:    Start at  21:13:10
packages/domain test:    Duration  1.67s (transform 285ms, setup 0ms, import 615ms, tests 1.49s, environment 1ms)
packages/domain test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  19 passed (19)
apps/api test:    Start at  21:13:12
apps/api test:    Duration  1.07s (transform 687ms, setup 0ms, import 1.61s, tests 676ms, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow/.claude/worktrees/agent-a31949b65eef9eee3
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/.claude/worktrees/agent-a31949b65eef9eee3/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1676 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-8jqRRKum.css                        33.64 kB │ gzip:   7.60 kB
dist/assets/index-B2FRENyG.js                        394.51 kB │ gzip: 117.66 kB │ map: 1,716.94 kB

✓ built in 1.03s
```

Earlier in the same run: `redocly lint` clean, `tsc -b` clean in all four packages, `oxlint`
without errors (warnings only, all of the `react(set-state-in-effect)` kind that the existing
`src/api/useApiVersion.ts` also carries), `packages/domain` 37 tests passed.

### `E2E_PORT=4183 pnpm --filter @hv/web e2e`

```
> @hv/web@0.0.0 e2e /home/user/hvworkflow/.claude/worktrees/agent-a31949b65eef9eee3/apps/web
> playwright test

Running 2 tests using 2 workers

  ✓  2 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.6s)
  ✓  1 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (42.8s)

  2 passed (45.2s)
```

`apps/web/e2e/003-answers-stage.spec.ts` walks the acceptance criterion with the role switcher:
Fachbereich drafts version 1 on an assigned question and hands it to clearing, Recht approves
exactly version 1 (and returns a second question with a reason), Freigabe puts it on the podium,
Podium reads out by click and by space bar and switches to "Nur Bühne", and the history shows the
seven events of that question plus the event stream of the meeting.

### Notes for the reviewer

- **`question.approve` never appears in `_actions`** — *resolved in the rework below: the domain
  guard was fixed and `rights.ts` is gone.* `actionsFor()` in `packages/domain/src/api.ts`
  evaluates every transition with an empty payload, so guard R-GUARD-04 (`approvalIsLatest`) can
  never pass and the approval step would be invisible to everyone — the domain test in
  `packages/domain/src/__tests__/api.test.ts:85` pins that behaviour. Since `packages/domain` is
  outside the files allowed here, `apps/web/src/features/answers/rights.ts` asks the domain's own
  decision point `can(actor, 'question.approve', question, { answerVersion: latest })` for that one
  button, with the payload the button will send. No role name is compared, and the answer is the
  one the server gives. The fix belongs in `actionsFor`.
- Every other action is gated on `_actions` alone; every write sends `ifMatch: etagOf(version)` and
  refetches list and question on any refusal (412 included).
- The work list fetches once per version and per server-side filter with `limit: 2000` and renders
  only the rows in the viewport; status counts come from that same list.

## Review findings

(filled by the reviewer)

## Rework

Round 1 after the review, on top of the merge with `claude/dax-shareholder-meeting-workflow-0s934z`
(which brings the domain fix: guard R-GUARD-04 answers the capability question when it is asked
without a payload, so `question.approve` now appears in `_actions` — `pnpm --filter @hv/domain test`
→ 38 passed).

1. **MAJOR, `can()` in the interface — done.** `apps/web/src/features/answers/rights.ts` is deleted.
   "Freigeben" is gated on `question._actions.includes('question.approve')` like every other button,
   and `latestVersion()` (a pure read of the record) moved into `features/answers/lib.ts`. The only
   values the three feature folders still import from `@hv/domain` are `etagOf` and the constant
   lists `QUESTION_STATUSES` / `TERMINAL_STATUSES` / `TRACKS`; everything else is `import type`.
2. **MAJOR, "Freigabe erloschen" — done.** `lapsedApproval()` in `features/answers/lib.ts` reads the
   state off the event log: no `approval` on the record, an `AnswerDrafted` event carrying
   `invalidatedApprovalOfVersion`, and no `QuestionApproved` after it. The detail loads the history
   of the open question lazily (one `api.getQuestionHistory` per selection, in the same `Promise.all`
   as `getQuestion`) and shows a muted block `approval-lapsed`: "Freigabe der Version {previous}
   erloschen durch Version {current}" (`answers.approval.lapsed`, DE/EN). Nothing is inferred from
   the status. Evidence: `docs/evidence/003-approval-lapsed.png`.
3. **MINOR, link to the Redebeitrag — done.** The detail's Wortmeldung field carries a link
   `answers-detail-contribution` → `/capture?speaker=<question.speakerId>`, which the capture desk
   reads as its preselected Wortmeldung (`answers.detail.contributionLink`, DE/EN).

Also in this round: after a deliberate act (row selected, filter changed, search cleared) the work
list now reveals the open question once the list that act produced has arrived — a plain refetch
still never moves the scroll position.

### `pnpm gates` (exit 0)

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  38 passed (38)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow/.claude/worktrees/agent-a31949b65eef9eee3
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/.claude/worktrees/agent-a31949b65eef9eee3/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1695 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-BhQ1UYbP.css                        36.70 kB │ gzip:   8.06 kB
dist/assets/index-CsPaxkco.js                        502.74 kB │ gzip: 147.77 kB │ map: 2,073.67 kB

✓ built in 1.18s
```

### `E2E_PORT=4183 pnpm --filter @hv/web e2e --grep 003` (exit 0)

```
> @hv/web@0.0.0 e2e /home/user/hvworkflow/.claude/worktrees/agent-a31949b65eef9eee3/apps/web
> playwright test --grep 003

Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (43.3s)

  1 passed (45.4s)
```

The spec now also asserts the link to the Redebeitrag and walks the lapsed approval: as Fachbereich
a new version is drafted on an approved question (never the one that has to reach the podium), the
`approval-lapsed` block appears and the seal is gone. Screenshots regenerated on the merged corpus:
`003-answers.png`, `003-stage.png`, `003-stage-only.png`, `003-history.png`, and the new
`003-approval-lapsed.png`. `001-*` and `002-*` evidence was not touched (the run was filtered
with `--grep 003`).
