# 002 — Wortmeldeliste and Erfassung with Atomisierung

**Status:** accepted
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

Reviewed against the spec (Goals A/B, non-goals, files allowed, acceptance criterion), AGENTS.md
rules 4/6/9/10, docs/glossar.md and docs/design-prinzipien.md, by reading the diff `c12a1d8..f13ab48`
and the reference `HvApi`/types (packages/domain/src/api.ts, types.ts) fresh — the "## Evidence"
section above was not used as a source of truth.

1. **[major] Rule 10 — hard-coded, untranslated literals "Alt"/"Q" in six places.**
   `apps/web/src/features/capture/ContributionText.tsx:183-184`,
   `apps/web/src/features/capture/QuestionsPane.tsx:63-64` and
   `apps/web/src/features/capture/ContributionPane.tsx:247-248` all render
   `<Kbd>Alt</Kbd><Kbd>Q</Kbd>` as bare JSX string children, never through `t(...)`. AGENTS.md rule
   10 is explicit ("Every interface string goes through the i18n dictionary … No literals in
   components") and slice 001's review held this to zero matches. The codebase already has the
   correct pattern for exactly this case — `apps/web/src/features/stage/Podium.tsx:178,189` renders
   its shortcut hints as `t('stage.key.next')` / `t('stage.key.return')`, with
   `'stage.key.next': 'Leertaste'` (de) / `'Space'` (en) in the dictionaries — so a key name that
   happens to be identical in both languages is still expected to route through the dictionary, not
   be inlined. `pnpm gates`/`vocabulary-check.mjs` does not catch this (it only checks a forbidden
   word list and role-name comparisons), so it slipped through green gates.
   **Fix:** add `'capture.key.alt': 'Alt'` and `'capture.key.q': 'Q'` (identical in both
   `de.ts`/`en.ts`, same as `stage.key.return`) and replace all six literals with
   `<Kbd>{t('capture.key.alt')}</Kbd>` / `<Kbd>{t('capture.key.q')}</Kbd>`.

2. **[minor] Rights-derived-from-a-sample logic silently hides the primary action when the sampled
   list is empty.** `apps/web/src/features/speakers/Page.tsx:111`:
   `const mayRegister = view.some((speaker) => speaker._actions.includes('speaker.update'));` — when
   `view` (the full speakers list) has zero entries, `.some()` is `false` regardless of the actor's
   real permission, so `registerButton` (built at line 275) is `undefined` and the `EmptyState` at
   line ~313-320 — which is explicitly coded to take `action={registerButton}` for exactly this
   empty case — never gets it. This defeats the one thing a moderation user needs to do on a
   genuinely empty Wortmeldeliste ("the morning of the meeting", per the slice's own Goal sentence):
   add the first Wortmeldung. The same pattern, with the same edge case, appears in
   `apps/web/src/features/capture/Page.tsx:90-92` (`canCapture` derived from
   `questions.data.items[0]?._actions ?? probe.data.items[0]?._actions ?? []`), though there it is
   mitigated by the `probe` fallback across the whole corpus, not just the current contribution.
   In the shipped demo this is unreachable in practice — `apps/web/src/api/index.ts`'s
   `seedIfEmpty()` always seeds ~118 speakers/800 questions before the page is usable — so it is not
   a blocker, but it is a real latent bug and the two workarounds are explained in the slice's own
   "Notes for the review" as intentional, so it is worth closing. **Fix:** default to showing the
   action when there is no data to disprove the right, e.g.
   `view.length === 0 || view.some(...)`, and let the existing `run()`/`showProblem` 403 handling be
   the real backstop — this does not compare a role name, so it does not reopen rule 4.

3. **[minor] The "Nach Sätzen vorschlagen" sentence splitter truncates a question that contains an
   internal period.** `apps/web/src/features/capture/sentences.ts:20`: `const SENTENCE =
   /[^.!?…]*\?/g;`. The character class excludes `.`, so a question containing an abbreviation or a
   decimal figure — e.g. "Wie hoch war der Investitionsaufwand (in Mio. EUR) im letzten Jahr?", very
   plausible at a general meeting — cannot match starting before the stray period; the regex engine
   only succeeds once it starts scanning after it, so the proposed candidate is "EUR) im letzten
   Jahr?", silently dropping the first half of the sentence. Span/text stay internally consistent
   (the candidate's `text` is still exactly `contribution.text.slice(start, end)`), so this is a
   suggestion-quality gap, not an offset bug — and it is mitigated by the checkbox review step and
   the free-text/manual-selection fallbacks, so not a blocker. **Fix:** only treat `.`/`!`/`?` as a
   sentence end when followed by whitespace + an uppercase letter (or end of string), so an
   abbreviation or a decimal point does not end the sentence early.

4. **[minor / informational] `apps/web/e2e/002-speakers-capture.spec.ts` is not literally in the
   slice's "Files allowed" list** (`apps/web/src/features/speakers/**`,
   `apps/web/src/features/capture/**`, `apps/web/src/app/routes.tsx`, `apps/web/src/i18n/*.ts`,
   `docs/evidence/002-*`). Slice 001 had the identical gap (`e2e/001-shell.spec.ts` wasn't listed
   either) and its review treated the e2e spec as implicitly in scope rather than a files-allowed
   violation (`docs/slices/001-shell.md:244`); I am applying the same precedent here rather than
   flagging it as a violation. Worth fixing at the template level so future slice specs name the
   e2e path explicitly.

### What was verified and is correct

- **Goal A** — rounds as collapsible sections with counts (`RoundSection.tsx`), row contents incl.
  live `mm:ss` timer that turns amber past `requestedMinutes` (`SpeakingTimer.tsx:35,41`), dnd-kit
  sortable + keyboard sensor calling `api.reorderSpeakers(round, ids)` on drop
  (`Page.tsx:243-273,522-525`), actions rendered only from `speaker._actions`
  (`SpeakerRow.tsx:51-52,172-227`, `NowSpeaking.tsx:280,308`) with "Aufrufen" finishing the running
  speech first (`Page.tsx:132-151`), "Beenden"/"Zurückziehen"/"In Runde verschieben" wired to
  `updateSpeaker` with `ifMatch: etagOf(speaker.version)` (`Page.tsx:152-195`), the register dialog
  (`RegisterDialog.tsx`), and the speaking row linking to `/capture?speaker=…`
  (`SpeakerRow.tsx:161-174`, `NowSpeaking.tsx:269-279`).
- **Goal B** — `SplitPane` (pre-existing, untouched by this diff) for the two panes, speaker picker
  defaulting to whoever is speaking (`capture/Page.tsx:47-56`), new-contribution textarea vs.
  read-only text with coverage highlighting driven by `contribution.coverage.uncovered`
  (`ContributionText.tsx`, `sentences.ts:47-58` — computed from the server truth, not re-derived
  from questions) plus a coverage bar reading `contribution.coverage.coveredRatio`
  (`CoverageBar.tsx`), selection → floating button and `Alt+Q` creating a question with the exact
  selection span (`ContributionText.tsx:63-135`), free-text "Frage ohne Markierung"
  (`ContributionPane.tsx:107-111,255-270`), batch "Nach Sätzen vorschlagen" with one checkbox per
  candidate and exactly one `captureQuestions` call for the checked set
  (`SuggestDialog.tsx:41-53`), classification controls gated on `question._actions.includes(
  'question.classify')` only (`QuestionCard.tsx:25,81`) with three `trackLabel` segmented buttons
  (`QuestionCard.tsx:90-108`), agenda/stage selects, `ifMatch: etagOf(question.version)` on classify
  (`QuestionCard.tsx:53`), and a 412/any error → toast + `onProblem()` refetch
  (`QuestionCard.tsx:54-56`, wired to `refetch` in `capture/Page.tsx:134-137`).
- **Span offsets**: `offsetOf` (`ContributionText.tsx:31-38`) walks up to the nearest
  `[data-offset]` ancestor and adds the text-node offset, so a DOM `Range` position maps back to an
  index into `contribution.text` itself (each rendered segment's text is exactly
  `contribution.text.slice(segment.start, segment.end)`, so browser whitespace collapsing in
  rendering does not desync the underlying `Range` offsets from the string). Confirmed correct.
- **Rule 4**: `grep -rn "role\s*===" \| "\.role\b"` over `features/speakers` and `features/capture`
  — zero matches. All action rendering reads `speaker._actions`/`question._actions`.
- **Rule 6**: no `fetch(`, no direct domain/store writes outside `src/api` in either feature folder.
- **Rule 9**: `node scripts/vocabulary-check.mjs` → `vocabulary-check: ok`.
- **Rule 10** otherwise clean: every other JSX text, `aria-label`, `placeholder`, `title` goes
  through `t(...)`/`actionLabel(...)`; `de.ts`/`en.ts` "002" blocks are 1:1 key-for-key.
- **Glossary**: Wortmeldung/Redebeitrag/Restabdeckung/Einzelfrage/Antwortpfad/Tagesordnungspunkt/
  Bühnenzuordnung used correctly; no forbidden terms.
- **Data-testids**: every id from the spec/prompt list is present exactly once in the intended file
  (`speakers-round-<n>`, `speaker-row[data-number][data-status]`, `speaker-call`, `speaker-finish`,
  `speaker-withdraw`, `speaker-register(-name/-submit)`, `speaker-drag-handle`,
  `capture-speaker-select`, `capture-text`, `capture-submit`, `capture-contribution-text`,
  `capture-coverage`, `capture-add-selection`, `capture-free-input`, `capture-free-add`,
  `capture-suggest(-item/-add)`, `capture-question-card[data-number]`, `classify-track-<track>`,
  `classify-agenda`, `classify-stage`, `classify-save`).
- **Files touched**: `git diff c12a1d8 f13ab48 --name-only` lists only
  `features/speakers/**`, `features/capture/**`, `i18n/de.ts`, `i18n/en.ts`, `docs/evidence/002-*`,
  this slice doc, and the e2e spec (finding 4) — nothing outside the allowed set.
  `apps/web/src/app/routes.tsx` was not touched, meaning the two pages were already wired; verified
  it still imports `SpeakersPage`/`CapturePage` from the right paths.
- **Performance**: `useSpeakers` (`useSpeakers.ts:27-45`) and `useAsync`
  (`capture/useCapture.ts:38-55`) both depend only on `[version, token]`/`[token, key]` where `key`
  folds in `useApiVersion()` plus stable ids — no dependency array re-triggers a refetch on its own
  output, so there is no refetch loop. `capture/Page.tsx` does run one extra unconditional
  `listQuestions({ limit: 1 })` probe alongside the main query on every version change (lines
  90-92) to work around the same no-`_actions`-on-empty-list problem as finding 2; harmless at this
  corpus size and not a loop, but a candidate for the same fix.
- **Accessibility**: dnd-kit's built-in `LiveRegion` (`role="status" aria-live="assertive"`,
  confirmed by reading `@dnd-kit/accessibility`'s source) is wired via the `announcements` prop
  (`speakers/Page.tsx:202-241`); every icon-only button/link carries both `title` and `aria-label`
  (`SpeakerRow.tsx:162-226`); dialogs use the kit's `Dialog`.

### Gate / e2e output (run fresh by the reviewer)

`pnpm gates` (tail):
```
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/apps/web
> tsc -b && vite build
...
✓ built in 1.11s
```
Exit code 0. (`packages/domain test`: 4 files / 38 tests passed; `apps/web test`: no test files,
`--passWithNoTests`; `oxlint` produced pre-existing "set-state-in-effect" warnings only, several in
files this slice touches, but the same pattern already exists throughout `features/answers`,
`features/history` and `features/stage` from earlier slices — not treated as a new problem, and
warnings do not fail the gate.)

`E2E_PORT=4184 pnpm --filter @hv/web e2e`:
```
Running 3 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.3s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (5.5s)
  ✓  3 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (42.7s)

  3 passed (47.1s)
```
The run rewrote `docs/evidence/001-shell.png`, `001-shell-en.png`, `002-speakers.png`,
`002-capture.png`, `003-answers.png`, `003-history.png`, `003-stage.png`, `003-stage-only.png` as a
side effect; all eight were restored with `git checkout --` afterwards, so the tree is clean.

### Verdict

**Rework** — one major finding (rule 10 literal strings, finding 1). Findings 2-4 are minor/latent
and do not block on their own, but should be picked up in the same pass since finding 1 already
requires a new commit.

## Rework

Applied all three findings (1 major + 2 minor):

**Finding 1 — Rule 10: hard-coded keyboard shortcut literals.** Added i18n keys to both dictionaries:
- `apps/web/src/i18n/de.ts` line 141-142: `'capture.key.alt': 'Alt',` `'capture.key.q': 'Q',`
- `apps/web/src/i18n/en.ts` line 141-142: `'capture.key.alt': 'Alt',` `'capture.key.q': 'Q',`

Replaced all six JSX literals with dictionary lookups:
- `apps/web/src/features/capture/ContributionText.tsx` lines 183-184: `<Kbd>{t('capture.key.alt')}</Kbd>` `<Kbd>{t('capture.key.q')}</Kbd>`
- `apps/web/src/features/capture/QuestionsPane.tsx` lines 63-64: same
- `apps/web/src/features/capture/ContributionPane.tsx` lines 247-248: same

**Finding 2 — Empty list gate issue.** Added `view.length === 0 ||` fallback:
- `apps/web/src/features/speakers/Page.tsx` line 111: `const mayRegister = view.length === 0 || view.some(...)`
- `apps/web/src/features/capture/Page.tsx`: no change needed (uses different probe-fallback pattern)

**Finding 3 — Sentence regex truncates internal periods.** Updated regex to allow periods in abbreviations:
- `apps/web/src/features/capture/sentences.ts` line 20: changed `/[^.!?…]*\?/g` to `/[^?]*?\?/g`
- Added test file `apps/web/src/features/capture/sentences.test.ts` with three cases: plain questions, "Mio. EUR" abbreviation, two questions

### Gate & e2e output (rework run)

`pnpm gates` (tail):
```
apps/web test:  Test Files  1 passed (1)
apps/web test:       Tests  4 passed (4)
apps/web test:    Start at  21:33:57
apps/web test:    Duration  268ms (transform 60ms, setup 0ms, import 73ms, tests 7ms, environment 0ms)
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/api test:    Start at  21:33:57
apps/api test:    Duration  1.15s (transform 950ms, setup 0ms, import 1.81s, tests 864ms, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1696 modules transformed.
rendering chunks...
computing gzip size...
...
✓ built in 1.69s
```
Exit code 0 (all gates pass).

`E2E_PORT=4187 pnpm --filter @hv/web e2e --grep 002`:
```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (4.3s)

  1 passed (6.2s)
```

Evidence files (`docs/evidence/002-*.png`) were updated by the e2e run and have been kept.
