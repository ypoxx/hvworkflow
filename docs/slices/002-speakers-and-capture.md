# 002 — Wortmeldeliste and Erfassung with Atomisierung

**Status:** review
**Role:** Implementierer Oberfläche (Sonnet)
**Rule ids:** AGENTS.md rules 4, 6, 9, 10; domain R-TRANS-01; contract `speakers`, `contributions`, `questions`

## Goal

The morning of the meeting: the speakers list and the capture desk.

### A. Wortmeldeliste (`/speakers`, `src/features/speakers/`)

- Rounds as sections (Runde 1…n), the current round expanded, others collapsible with counts.
- Each speaker row: number, name, organisation, kind badge, requested minutes, status
  (wartet / spricht / beendet / zurückgezogen), question count, elapsed speaking time for the
  speaking one (live, mm:ss, turns amber after requested minutes).
- **Drag-and-drop reordering** inside a round with `@dnd-kit/sortable`; on drop call
  `api.reorderSpeakers(round, ids)`. Keyboard reordering (dnd-kit keyboard sensor) must work.
- Actions come only from `speaker._actions`: "Aufrufen" (status → speaking; finishes the previous
  speaking one first), "Beenden", "Zurückziehen", "In Runde verschieben".
- "Wortmeldung aufnehmen" dialog: name, organisation, kind, round, minutes → `api.registerSpeaker`.
- Row of the speaking speaker links to the capture page with that speaker preselected.

### B. Erfassung (`/capture`, `src/features/capture/`)

Split pane. **Left:** the contribution text (Redebeitrag). A speaker picker at the top (defaults to
the speaking one). Textarea to capture a new contribution (`api.captureContribution`) or select an
existing one of this speaker. Once a contribution exists, the text is rendered read-only with
**coverage highlighting**: captured spans tinted, uncovered text plain; a bar "Restabdeckung 62 %".
**Right:** the questions of this contribution (`api.listQuestions({contributionId})`) as cards with
number, text, status badge, and the classification controls.

**Atomisation flow:** the user selects text in the left pane → a floating "Als Einzelfrage
erfassen" button (or shortcut `Alt+Q`) → creates a question with `span` = the selection via
`api.captureQuestions(contributionId, [{text, span}])`. Also a "Frage ohne Markierung hinzufügen"
input for questions that are not literally in the text. Support a **batch mode**: paste/split —
button "Nach Sätzen vorschlagen" that proposes one candidate per question sentence (ends with `?`)
in the uncovered text, each with a checkbox, then captures the checked ones in one call.

**Classification** on each card, only when `question._actions` contains `question.classify`:
track (three segmented buttons with the house names), agenda item select, stage assignment select →
`api.classifyQuestion(id, …, { ifMatch })`. On 412 show a toast and refetch.

Every list refetches on `useApiVersion()` changes.

## Non-goals

No answer drafting, no stage (slice 003). No transcript ingest.

## Files allowed

`apps/web/src/features/speakers/**`, `apps/web/src/features/capture/**`, `apps/web/src/app/routes.tsx`
(wire the two pages), `apps/web/src/i18n/*.ts` (add keys), `docs/evidence/002-*`.

## Acceptance criterion

`pnpm gates` green. With the seeded corpus: reorder two speakers by drag, call the next speaker,
open capture for them, capture a seven-question contribution by selecting text, see the coverage
bar rise, classify one question to Expert Track. Screenshots `docs/evidence/002-speakers.png` and
`docs/evidence/002-capture.png`.

## Evidence

`pnpm gates` — green. Tail of the run:

```
packages/domain test:    Duration  1.65s (transform 498ms, setup 0ms, import 801ms, tests 1.42s, environment 1ms)
packages/domain test: Done
apps/api test$ vitest run
apps/web test$ vitest run --passWithNoTests
apps/api test:  RUN  v4.1.11 /home/user/hvworkflow/.claude/worktrees/agent-ab2ae8485ade0ea0c/apps/api
apps/web test:  RUN  v4.1.11 /home/user/hvworkflow/.claude/worktrees/agent-ab2ae8485ade0ea0c/apps/web
apps/web test: No test files found, exiting with code 0
apps/web test: include: src/**/*.{test,spec}.{ts,tsx}
apps/web test: exclude:  **/node_modules/**, **/.git/**
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  19 passed (19)
apps/api test:    Start at  21:12:24
apps/api test:    Duration  1.10s (transform 550ms, setup 0ms, import 1.56s, tests 704ms, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow/.claude/worktrees/agent-ab2ae8485ade0ea0c
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/.claude/worktrees/agent-ab2ae8485ade0ea0c/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1686 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-BPCRt7h4.css                        32.16 kB │ gzip:   7.34 kB
dist/assets/index-DfsXnUKn.js                        429.65 kB │ gzip: 131.22 kB │ map: 1,892.51 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

✓ built in 993ms
```

`E2E_PORT=4182 pnpm --filter @hv/web e2e`:

```

> @hv/web@0.0.0 e2e /home/user/hvworkflow/.claude/worktrees/agent-ab2ae8485ade0ea0c/apps/web
> playwright test


Running 2 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (3.5s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (6.1s)

  2 passed (8.2s)
```

`apps/web/e2e/002-speakers-capture.spec.ts` walks the acceptance criterion end to end: reorder two
Wortmeldungen of round 3 with the keyboard (dnd-kit keyboard sensor, waiting on the live-region
announcement), call the next speaker (the running speech is ended first), take a new Wortmeldung —
then, as the capture desk, capture a Redebeitrag with seven questions, atomise it by marking a
passage, by `Alt+Q` and by the batch proposal (five candidates in one `captureQuestions` call), watch
the Restabdeckung rise from 0 % to 78 %, add one question without a marked passage, and classify the
first Einzelfrage into Pfad C · Expert Track.

Screenshots at 1440×900: `docs/evidence/002-speakers.png` (Am Mikrofon, Als Nächstes, the rounds with
the open round 3) and `docs/evidence/002-capture.png` (Redebeitrag with coverage highlighting,
Restabdeckung 78 %, eight Einzelfragen, the first one classified).

Notes for the review:

- `speaker.register` and `contribution.capture` belong to no existing resource, so the contract
  carries no `_actions` list for them. The interface reads the desk's rights off the resources it has
  already loaded — `speaker.update` from `speaker._actions` for taking a Wortmeldung,
  `question.capture` from `question._actions` for capturing a Redebeitrag — which are held by exactly
  the same permission bundles. Both places carry a comment.
- `reorderSpeakers` and `captureQuestions` send no `If-Match`: the order belongs to the round, and a
  `Contribution` has no version in the contract. Every write on a versioned resource
  (`updateSpeaker`, `classifyQuestion`) sends `{ ifMatch: etagOf(resource.version) }`.
- The component kit has no input, select or textarea. Both feature folders compose their own from the
  kit's tokens (`features/*/fields.tsx`); they belong in `src/components` in a later slice.
- Running the whole e2e suite rewrites `docs/evidence/001-*.png` as well, because slice 001 takes its
  screenshot on `/speakers`, which is no longer a placeholder. Those two files were restored to their
  committed state; slice 001 should refresh them when its evidence is next reviewed.

## Review findings

(filled by the reviewer)
