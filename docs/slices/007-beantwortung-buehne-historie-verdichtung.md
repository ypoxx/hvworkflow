# 007 — Beantwortung, Bühne, Historie: Verteilung, Dringlichkeit, Änderungen, Durchlaufzeiten

**Status:** spec
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

## Review findings
