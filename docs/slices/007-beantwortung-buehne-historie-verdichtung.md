# 007 — Beantwortung, Bühne, Historie: Verteilung, Dringlichkeit, Änderungen, Durchlaufzeiten

**Status:** accepted
**Role:** Implementierer Oberfläche (Sonnet 5)
**Rule ids:** AGENTS.md rules 4, 5, 6, 9, 10; docs/design-prinzipien.md 1, 4, 5, 10
**Depends on:** 005 (ProcessStrip, Sparkline, StaleBanner, statusTone, glyphs, stage tokens)

## Goal

### A. Beantwortung (`src/features/answers/`)

1. **Statusverteilung als Filter.** Replace the status chip row with a `ProcessStrip` whose segments
   are the eleven statuses in workflow order (terminal ones last, tone from `statusTone`), fed from
   the counts the list already computes, `onSelect` toggles the status filter, `selected` mirrors
   it, `testIdPrefix="answers-filter-status"` so the existing testids `answers-filter-status-<status>`
   remain. Track/unit/agenda selects and the search stay in one compact row below.
2. **Dringlichkeit am Zeilenrand.** Each row gets a 3px left bar: none under 15 minutes since
   `createdAt`, amber 15–45, red-700 tint beyond 45 minutes; only for non-terminal statuses.
   `data-testid="answers-row-urgency"` with `data-level="0|1|2"`. Age text stays.
3. **Änderungen zwischen Versionen.** For every answer version n>1 a ghost toggle
   "Änderung gegenüber Version n-1" (`data-testid="answer-diff-toggle"`) renders a word-level diff:
   removed words struck through in red-700/10, added words underlined in green-700/10. Implement
   `wordDiff(a, b)` in `lib.ts` (LCS on whitespace tokens, ≤ 60 lines) with three unit tests in
   `lib.test.ts` (identical, insertion, replacement).
4. **Konflikt sichtbar.** On a 412 show `StaleBanner` above the detail ("Stand wurde inzwischen
   geändert, Ansicht neu geladen", `data-testid="stale-banner"`) and refetch; keep the toast for
   403/409.

### B. Bühne (`src/features/stage/`)

5. **Lesbarkeit.** Answer text colour `--color-stage-text`, weight 500; question 28px stays.
6. **Kontrastmodus.** In "Nur Bühne" mode a toggle "Kontrast" (`data-testid="stage-contrast-toggle"`)
   applies the `.stage-contrast` scope from 005 to the overlay; persisted in localStorage
   (`hv-stage-contrast-v1`).
7. **Nächste Frage vorbereiten.** The first queue item becomes a larger card "Als Nächstes"
   (`data-testid="stage-next-preview"`) with full question text (18px), speaker, StageAssignmentBadge
   initials and TrackBadge glyph; the remaining queue items show initials and glyph before the text.

### C. Historie (`src/features/history/`)

8. **Durchlaufzeiten.** Between two events show the elapsed time right-aligned in mono
   (`+9 s`, `+2 min 10 s`, `+1 h 05 min`), `data-testid="history-duration"`. Above the timeline a KPI
   line (`data-testid="history-kpi"`): "Erfassung → Vorlesen 1 h 12 min" (or "läuft"), "Versionen 2",
   "Rückgaben 1". Values derived from the events only (rule 5: no status logic).
9. **Lastkurve.** In the "Ereignisstrom" tab a `Sparkline` of events per five-minute bucket over the
   last two hours above the list, with a small caption "Ereignisse je 5 Minuten, letzte 2 Stunden";
   `data-testid="history-sparkline"`.

## Non-goals

No new endpoints. No change to the kit (compose locally if something is missing and report it).

## Files allowed

`apps/web/src/features/answers/**`, `stage/**`, `history/**`, i18n `de.ts`/`en.ts` (new keys inside
the existing `// --- 003 answers, stage, history ---` block), `apps/web/e2e/003-answers-stage.spec.ts`
(extend: strip filter click, urgency attribute present, diff toggle after a second version, contrast
toggle, KPI line, sparkline present), `docs/evidence/007-*`, this file.

## Acceptance criterion

`pnpm gates` green; `E2E_PORT=<port> pnpm --filter @hv/web e2e` all specs green including
`abnahme.spec.ts` (it clicks `answers-filter-status-*` and reads `stage-current-number`). Screenshots
`docs/evidence/007-answers.png`, `007-stage.png`, `007-stage-contrast.png`, `007-history.png`.

## Evidence

`pnpm gates` (tail):

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/web test:  Test Files  2 passed (2)
apps/web test:       Tests  9 passed (9)

> hvworkflow@0.1.0 vocabulary
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1701 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/index-LYnt_rAy.css                        37.94 kB │ gzip:   8.30 kB
dist/assets/index-BJRJuUE2.js                        516.82 kB │ gzip: 152.05 kB │ map: 2,123.09 kB
✓ built in 993ms
```

`apps/web/src/features/answers/lib.test.ts` (the new `wordDiff` unit tests, 3 of the 9 `apps/web` tests
above): identical texts, an insertion, a replacement — all pass.

`E2E_PORT=4193 pnpm --filter @hv/web e2e` (tail):

```
Running 5 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.4s)
  ✓  3 [chromium] › e2e/001-shell.spec.ts:76:1 › header strip on the answers desk @screenshot (1.3s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (5.6s)
[timing] /answers list after status filter click: 144.5 ms
[timing] /stage view after navigation: 130.3 ms
[timing] stage-next presses to reach F-0801: 9
  ✓  5 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (35.5s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (43.4s)

  5 passed (49.2s)
```

`003-answers-stage.spec.ts` was extended with: a `ProcessStrip` segment click narrowing the list to
one status (and checking every visible row's `data-status`); `answers-row-urgency`'s `data-level`
attribute; the `answer-diff-toggle` after drafting a second version, opened and checked for both a
struck-through and an underlined word; the `stage-contrast-toggle` inside "Nur Bühne" flipping the
`stage-contrast` class on and off; the `stage-next-preview` card; `history-kpi` and a per-event
`history-duration`; and `history-sparkline` in the "Ereignisstrom" tab.

Screenshots: `docs/evidence/007-answers.png` (ProcessStrip + urgency bars + an open version diff),
`007-stage.png` (the "Als Nächstes" preview card in the queue), `007-stage-contrast.png` (Kontrastmodus:
black ground, near-white text, one light accent), `007-history.png` (KPI line and per-event durations
on the Vorgangshistorie tab).

## Review findings

### Review of the UI improvement round (adversarial review, slices 005–007 together)

Checked against the spec's nine numbered points, AGENTS.md rules 4/5/6/9/10 and
docs/design-prinzipien.md, on the merged state, plus my own `pnpm gates` and
`E2E_PORT=4195 pnpm --filter @hv/web e2e` run (both green, output in the review report). I
regenerated every screenshot myself and restored the evidence afterwards.

**Points 1–9: all implemented.** Statusverteilung as a filtering `ProcessStrip` with all eleven
statuses, terminal ones last, tones from `statusTone`, `answers-filter-status-*` preserved
(`features/answers/WorkList.tsx:245-256,343-361`); urgency bar with `data-level`
(`WorkList.tsx:117-122,146-173`, thresholds in `lib.ts:112-117`); word diff with the three required
unit tests (`lib.ts:130-176` — 47 lines, LCS over whitespace tokens; `lib.test.ts`), memoised per
version pair and only rendered when the toggle is open (`QuestionDetail.tsx:32,167-185`); 412 →
`StaleBanner` + refetch, toast kept for everything else (`Page.tsx:68-77,169-190`); stage text in
`--color-stage-text` at weight 500 (`Podium.tsx:583-588`); contrast toggle persisted in
`hv-stage-contrast-v1` with a `try`/`catch` around `localStorage` (`stage/Page.tsx:34-40,176-186`);
"Als Nächstes" preview plus initials/glyph queue rows (`Podium.tsx:464-514`); per-event durations and
the KPI line derived from events only (`history/lib.ts:29-82`, `Timeline.tsx:16-42,86-91`); the
five-minute Lastkurve with its caption (`history/lib.ts:84-99`, `Timeline.tsx:130-133`).

**Rule 5:** the history KPIs really are read off the log — `historyKpi` switches on
`QuestionCaptured`/`QuestionDelivered`/`AnswerDrafted`/`QuestionReturned` and never looks at a status
(`history/lib.ts:58-82`); no component in this slice decides an allowed action from `status` (podium
and detail both gate on `_actions`). **Rule 6:** no `fetch(`; only `etagOf` and constant lists come
from `@hv/domain`. **Performance:** the work list stays windowed, so urgency and age are computed for
~25 rendered rows, not 800 (`WorkList.tsx:261-263`), and `loadCurve` runs once per fetch, not per
render — but see R10 for what that fetch now costs. **wordDiff edge cases** hold up: `('','')` → `[]`,
`('', b)` → one `added` part, insertion-only and replacement covered by the tests.

9. **major — `apps/web/src/styles/index.css:184-190` (the `.stage-contrast` scope) applied at
   `features/stage/Page.tsx:344`.** Kontrastmodus is only half a theme. It re-points five tokens
   (`--color-canvas`, `--color-surface`, `--color-stage-text`, `--color-accent-500`, `--color-ink-500`),
   so everything inside the scope that uses `--color-ink-600…900`, `--color-sunken` or `--color-line`
   keeps its light-theme value on the black ground. In this slice's own evidence
   (`docs/evidence/007-stage-contrast.png`, which I regenerated) the whole queue column is the
   casualty: the question text of every queue row (`Podium.tsx:507`, `text-ink-700` #4a4844 on #0b0f19
   ≈ 2.2:1 contrast) is effectively unreadable, the "Als Nächstes" card (`Podium.tsx:469`, `bg-sunken`
   + `text-ink-900`) is a white block inside the black frame, and the `tone-outline` assignment badge
   (`Podium.tsx:552`, ink-600 on transparent) disappears. Slice 005 point 9 promised "text #f8fafc" and
   design principle 10 asks for maximum contrast on this device. Fix: in `.stage-contrast`, re-point the
   neutral ramp the podium actually renders with — `--color-ink-900/800/700/600`, `--color-sunken`,
   `--color-line`, `--color-line-strong` — five to seven more lines, no new tokens and no component
   change. (The return dialog is safe: `Dialog` portals to `document.body`, outside the scope.)
10. **minor — `apps/web/src/features/history/Page.tsx:156-173`.** The "Ereignisstrom" tab now reads the
    *whole* log (`api.listEvents(0, lastSeq)`) instead of the last 200, and the effect depends on
    `[version, tab]`, so every write anywhere in the tool refetches all of it while the tab is open. I
    measured the seeded corpus with `seedEvents({ questions: 800 })`: **5 688 events, 5 473 of them
    inside the two-hour window**. In-process (ADR 0002 demo) that is a few milliseconds, but across the
    HTTP adapter it is a multi-megabyte response per event. Fix: bound the read the curve needs too —
    e.g. `listEvents(Math.max(0, lastSeq - CURVE_SCAN_LIMIT), CURVE_SCAN_LIMIT)` with a documented cap,
    or keep the curve out of the `version` dependency so it is computed once per tab visit.
11. **minor — `apps/web/src/features/answers/WorkList.tsx:146-148`.** Point 2 says "only for
    non-terminal statuses" and the code reads that as `TERMINAL_STATUSES` = closed/withdrawn/merged —
    but the domain's own "open" figure excludes `delivered` as well
    (`packages/domain/src/state.ts:55`). A question that has already been read out therefore still
    carries the red "over 45 minutes" bar (visible in `docs/evidence/007-answers.png`, e.g. row
    F-0008), although nobody is waiting on it. This is the same drift the 005 rework fixed for "Offen".
    Fix: derive the bar from the domain's open predicate (export it as a constant list from
    `@hv/domain`, which rule 6 allows) instead of from `TERMINAL_STATUSES`.
12. **minor (rule 10) — `apps/web/src/features/history/lib.ts:35-37`.** `"h"`, `"min"` and `"s"` are
    user-visible strings assembled in code instead of coming from the dictionary; every other unit in
    the tool goes through i18n (`time.minutes`, `speakers.minutes`). Fix: three keys in the
    `// --- 003 answers, stage, history ---` block and a `Translate` parameter for `formatSpan` — or, if
    the units really are meant to be language-invariant, say so in the doc comment so the next reader
    does not have to guess.

**Verdict: rework** — because of R9 (major). R10–R12 are minors and may travel with it.

## Rework

### Rework round (Implementierer Oberfläche, Sonnet 5), single pass over 005/006/007

- **R9 (major)** — `styles/index.css`, `.stage-contrast`: re-pointed the rest of the neutral ramp
  the podium actually renders with — `--color-ink-900/800/700/600/400/300/50`, `--color-sunken`,
  `--color-line`, `--color-line-strong` — alongside the five tokens already there. Verified with a
  Playwright colour probe in `e2e/003-answers-stage.spec.ts` (`getComputedStyle` on the queue
  item's question text, the "Als Nächstes" card, and the current question's `tone-outline`
  assignment badge), printed to the test output and asserted against the new values: queue text
  `rgb(203, 213, 225)` on the black ground (≈13:1, was ≈2.2:1), the "Als Nächstes" card
  `background: rgb(19, 26, 44)` / `text: rgb(248, 250, 252)` (a dark card with light text, not the
  white block it was), the assignment badge `rgb(148, 163, 184)` (light-on-transparent, legible,
  was ink-600's dark grey). `docs/evidence/007-stage-contrast.png` regenerated from that same run.
  `TrackBadge`'s own tint tokens (`tone-track-*`) were left alone: each is a filled chip with its
  own background, already ≥ 4.5:1 internally regardless of the ground it sits on.
- **Architect finding** — `features/answers/WorkList.tsx`: the status `ProcessStrip` now renders
  with `compact`, so a zero-count status keeps its (zero-width) bar segment but drops its label —
  the bar itself is unchanged.
- **R11 (minor)** — `features/answers/WorkList.tsx`: urgency now reads a local
  `NO_URGENCY_STATUSES = ['delivered', ...TERMINAL_STATUSES]` (comment pointing at
  `packages/domain/src/state.ts:55`, the domain's own "open" predicate) instead of
  `TERMINAL_STATUSES` alone — a delivered question no longer carries the red urgency bar.
- **R10 (minor)** — `features/history/Page.tsx`: the stream tab now reads
  `listEvents(Math.max(0, lastSeq - STREAM_SCAN_LIMIT), STREAM_SCAN_LIMIT)` (`STREAM_SCAN_LIMIT =
  5000`, `lib.ts`) instead of the whole log, and skips that read entirely when a cheap
  `listEvents(0, 1)` shows the tail `seq` has not moved — which is exactly what a `version` bump
  from an actor switch alone looks like (`api/useApiVersion.ts`). The Lastkurve (`curve`) is
  recomputed in that same branch, so it too is bucketed once per fetched tail, not on every render.
- **R12 (minor)** — `features/history/lib.ts`: `formatSpan`/`eventGap`/`elapsedSpan` now take a
  `Translate` and read `time.unit.h`/`time.unit.min`/`time.unit.s` from the dictionary (identical
  "h"/"min"/"s" values in `de.ts` and `en.ts`, in the `// --- 003 answers, stage, history ---`
  block) instead of assembling the unit letters in code; `Timeline.tsx`'s two call sites pass `t`.

Evidence (from the shared rework run across 005/006/007 — `pnpm gates` tail):

```
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  25 passed (25)
apps/web test:  Test Files  2 passed (2)
apps/web test:       Tests  9 passed (9)

> hvworkflow@0.1.0 vocabulary
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build
> tsc -b && vite build

dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/index-BC8cI4Qz.css                        39.09 kB │ gzip:   8.51 kB
dist/assets/index-CCi1ZcpM.js                        525.03 kB │ gzip: 154.02 kB │ map: 2,152.33 kB
✓ built in 953ms
```

`E2E_PORT=4196 pnpm --filter @hv/web e2e` (tail, all five green):

```
  ✓  2 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.2s)
[006 rework] "Am Mikrofon" name "Vera Rehberg": scrollWidth=105 clientWidth=105
[005 rework] header counters pill width: 458.7px
  ✓  3 [chromium] › e2e/001-shell.spec.ts:75:1 › header strip on the answers desk @screenshot (1.4s)
  ✓  1 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (6.5s)
[timing] /answers list after status filter click: 129.5 ms
[timing] /stage view after navigation: 136.7 ms
[timing] stage-next presses to reach F-0801: 9
  ✓  5 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (34.9s)
[007 rework] stage-contrast queue item text colour: rgb(203, 213, 225)
[007 rework] stage-contrast "Als Nächstes" card: background=rgb(19, 26, 44) text=rgb(248, 250, 252)
[007 rework] stage-contrast assignment badge colour: rgb(148, 163, 184)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (43.8s)

  5 passed (49.4s)
```

Screenshots regenerated: `docs/evidence/007-answers.png`, `007-stage.png`, `007-stage-contrast.png`,
`007-history.png`.

Touched: `styles/index.css`, `features/answers/WorkList.tsx`, `features/history/Page.tsx`,
`features/history/Timeline.tsx`, `features/history/lib.ts`, `i18n/de.ts`, `i18n/en.ts`,
`e2e/003-answers-stage.spec.ts`.
