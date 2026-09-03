# 007 — Beantwortung, Bühne, Historie: Verteilung, Dringlichkeit, Änderungen, Durchlaufzeiten

**Status:** review
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
