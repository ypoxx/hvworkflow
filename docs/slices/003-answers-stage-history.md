# 003 — Beantwortung (Expert Track), Freigabe, Bühne, Historie & Suche

**Status:** rework
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

- **`question.approve` never appears in `_actions`.** `actionsFor()` in `packages/domain/src/api.ts`
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

Reviewed at commit `ab111bd` (interface diff `f13ab48..0babf20`, domain fix `e542c21` already applied on
top and verified real: `pnpm --filter @hv/domain test` → 38/38 passing, and
`packages/domain/src/__tests__/api.test.ts:88` asserts `(await api.getQuestion(q.id))._actions` contains
`'question.approve'`, the capability-without-payload case). Verified independently against spec, rules and
diff; the slice file's own "## Evidence" section was not used as a source of truth.

1. **MAJOR** — `apps/web/src/features/answers/rights.ts:14,22-26` and its call site
   `apps/web/src/features/answers/QuestionDetail.tsx:28,165` call the domain's decision point `can()`
   directly from the interface (`import { can } from '@hv/domain'`) to gate the "Freigeben" button. This
   was a documented workaround for a real bug in `actionsFor()` — that bug is now fixed
   (`packages/domain/src/transitions.ts`'s `R-GUARD-04` treats a payload-less call as the capability
   question, per `e542c21`), so `question.approve` now appears in `question._actions` for every actor who
   may approve, exactly like every other action. The workaround is now dead weight that violates AGENTS.md
   rule 6 ("The interface uses the `HvApi` interface... talks to `HvApi` only") and rule 4's spirit (a
   second, parallel decision point besides `_actions`). **Fix:** delete `rights.ts` (or reduce it to the
   pure `latestVersion()` helper with no domain import), and in `QuestionDetail.tsx` replace
   `mayApprove = mayApproveLatest(actor, question)` with `mayApprove = may.includes('question.approve')`,
   gated on `_actions` like every other button. Drop the `actor` prop from `QuestionDetailProps` if nothing
   else in the component needs it.

2. **MAJOR** — Approval block does not implement the "erloschen" (expired) state that Goal A explicitly
   specifies: *"If a newer version exists the block shows 'Freigabe erloschen durch Version 3' (status is
   `answer_drafted` then — do not invent this in the interface, read it from the record)."* The current
   code only distinguishes "sealed" vs. "not sealed" (`apps/web/src/features/answers/lib.ts:52-56`,
   `sealedApproval()`) and when not sealed falls back to a generic status badge
   (`apps/web/src/features/answers/QuestionDetail.tsx:332-363`, the `approval-block` div) with no mention
   of which version voided the approval. There is no i18n key for this at all — confirmed absent from both
   `apps/web/src/i18n/de.ts` and `en.ts` (the `// --- 003` blocks were diffed key-for-key: 141/141, no
   "erloschen"/"expired" key exists in either). The e2e spec (`apps/web/e2e/003-answers-stage.spec.ts`)
   never exercises this path either, so nothing catches the gap. **Fix:** in `QuestionDetail.tsx`, when
   `question.approval !== undefined` but `sealedApproval(question)` is `undefined` (i.e. a newer answer
   version exists), render a distinct message reading the invalidating version from the record
   (`question.answers[question.answers.length - 1].version`, which is exactly what `sealedApproval`
   already computes against) instead of the plain status badge fallback; add the matching DE/EN key pair
   (e.g. `answers.approval.expired`) to the `// --- 003` i18n blocks.

3. **MINOR** — Goal A's detail spec reads *"question text with speaker and contribution link"*; the
   contribution link is entirely absent. `question.contributionId` is a required field on every `Question`
   (`packages/domain/src/types.ts:157`) but is never read anywhere in
   `apps/web/src/features/answers/QuestionDetail.tsx` or elsewhere in the `answers` feature (confirmed by
   `grep -rn "contributionId" apps/web/src/features/answers` → no matches). The question text is shown
   (`QuestionDetail.tsx:293-296`) with speaker (`answers.detail.speaker` key-value) but nothing lets a
   reader jump to or view the originating Redebeitrag. **Fix:** add a link/button in the detail header or
   the key-value grid that opens the contribution (e.g. via `api.getContribution(question.contributionId)`
   in a small popover/dialog, or a link into `/capture` filtered to that contribution) — reusing whatever
   pattern the `capture` feature already has for showing a contribution's text.

No other findings: no role-name comparisons in `apps/web/src/features/**` (rule 4), no re-implemented
status/transition logic outside the domain (rule 5), no `fetch(` and no other domain-bypassing calls
besides finding 1 (rule 6), `node scripts/vocabulary-check.mjs` → `vocabulary-check: ok` (rule 9), and no
hard-coded user-visible strings were found in JSX/attributes across `answers/`, `stage/`, `history/` (rule
10; every literal checked routes through `t(...)`). All required `data-testid`s are present and correctly
wired (`answers-filter-status-<status>`, `answers-filter-track-<track>`, `answers-search`, `answers-row`
with `data-number`/`data-status`, `answers-detail`, `answers-detail-number`, `answer-editor`,
`answer-sources`, `answer-submit-draft`, `answer-submit-review`, `answer-approve`, `answer-return`,
`answer-return-reason`, `answer-return-submit`, `answer-stage`, `answer-assign`, `answer-assign-unit`,
`answer-assign-submit`, `answer-merge`, `answer-withdraw`, `approval-block`, `answer-version` with
`data-version`, `stage-current`, `stage-current-number`, `stage-current-text`, `stage-answer`,
`stage-assignment`, `stage-queue`, `stage-queue-item` with `data-number`, `stage-next`, `stage-return`,
`stage-return-reason`, `stage-return-submit`, `stage-only-toggle`, `stage-counter-delivered`,
`stage-counter-open`, `history-search`, `history-result` with `data-number`, `history-timeline`,
`history-event` with `data-type`, `history-tab-stream`). Files touched stay within the allowed list
(`apps/web/src/features/{answers,stage,history}/**`, the `// --- 003` i18n blocks, `e2e/003-*`,
`docs/evidence/003-*`, this slice doc — `apps/web/src/app/routes.tsx` was not touched because it was
already wired). `apps/web/src/features/stage/Page.tsx` uses `api.getStage()` (a single server-computed
call), not a client-side scan of `listQuestions()` over all 800 questions, and every list/detail/stage
effect is keyed off `useApiVersion()` plus an explicit `reload()`/`nonce`, with no feedback-loop
dependencies; keyboard handlers (`stage/Page.tsx`'s `Space`/`R`, `app/AppShell.tsx`'s `Alt+N`) are attached
and removed via `useEffect` cleanup. Every write (`answers/Page.tsx`'s `run()`, `stage/Page.tsx`'s
`deliver()`/`returnAnswer()`) sends `ifMatch: etagOf(version)` and calls `showProblem` + `reload()` on
refusal, including 412; `showProblem` (pre-existing, `apps/web/src/components/toastStore.ts`) surfaces
`detail` and `ruleId` from the `ApiProblem` shape for 403/409 as required. Podium type sizes meet the
minimums (`text-[28px]` for the question in `stage/Podium.tsx:136`, `text-[24px]` for the answer at
`:158`); the podium answer text is gated through `approvedAnswer()` (`stage/lib.ts:18-23`), which mirrors
`R-GUARD-04` and only returns text for the version the approval is actually bound to, falling back to the
podium-track placeholder otherwise; the queue is capped at 8 (`StageQueue`, `Podium.tsx:202`); "Nur Bühne"
is persisted in `localStorage` and rendered as a `fixed inset-0 z-40` overlay above the shell
(`stage/Page.tsx:288-304`) since the shell itself is not touched.

### Verdict: rework

Blocking findings: #1 and #2 above (both MAJOR). #3 is MINOR and does not by itself block acceptance, but
should be fixed in the same pass.

### Gate output observed

`pnpm gates` (exit 0):

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  38 passed (38)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/web test: No test files found, exiting with code 0

> node scripts/vocabulary-check.mjs
vocabulary-check: ok

> @hv/web@0.0.0 build
tsc -b && vite build
✓ 1696 modules transformed.
✓ built in 1.25s
```

(oxlint reported only the pre-existing `react(set-state-in-effect)` warning class, same kind already
carried by `src/api/useApiVersion.ts` before this slice — no new lint errors.)

`E2E_PORT=4185 pnpm --filter @hv/web e2e --grep 003`:

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (42.3s)

  1 passed (44.7s)
```

`docs/evidence/003-*.png` were regenerated by that run and restored afterwards
(`git checkout -- docs/evidence/003-answers.png docs/evidence/003-history.png docs/evidence/003-stage-only.png docs/evidence/003-stage.png`)
so the working tree matches what was reviewed; `docs/evidence/001-*.png` and `002-*.png` were not touched
by this review's runs.
