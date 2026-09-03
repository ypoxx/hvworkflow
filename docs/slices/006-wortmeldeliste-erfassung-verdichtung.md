# 006 — Wortmeldeliste und Erfassung: Priorisierung, Zeitbudget, Marker, Verdichtung

**Status:** spec
**Role:** Implementierer Oberfläche (Sonnet 5)
**Rule ids:** AGENTS.md rules 4, 6, 9, 10; docs/design-prinzipien.md 1, 2, 5, 7
**Depends on:** 005 (ProgressBar, ProgressRing, SourceIcon, TrackBadge glyphs, StageAssignmentBadge initials)

## Goal

### A. Wortmeldeliste (`src/features/speakers/`)

1. **Zeitbudget sichtbar.** In "Am Mikrofon" a `ProgressRing` (elapsed / requestedMinutes) next to
   the mm:ss timer; tone `accent` until the budget, `warn` after. The ring carries
   `data-testid="speaker-timer-ring"` with `aria-valuenow`.
2. **Rundenfortschritt.** Each `RoundSection` header shows a `ProgressBar` finished/total and the
   text "12 von 29 beendet" (i18n with params); `data-testid="round-progress-<n>"`.
3. **Handlungsrelevante Zeilen zuerst ins Auge.** Finished speakers: text ink-500, no "beendet"
   badge, a 14px `Check` icon in the Stand column; withdrawn: ink-400 and `Minus` icon; waiting:
   normal weight, the position number in mono ink-900; the speaking row: accent-50 background with
   a 3px accent bar on the left. The Stand column keeps its width; the badge component stays for
   "spricht" (accent tone) and "wartet" (muted text, no badge).
4. **Art als Icon plus Kurzlabel.** `User` (Aktionär/-in), `Briefcase` (Vertretung), `Users`
   (Vereinigung), 14px, label unchanged. Organisation stays next to the name.

### B. Erfassung (`src/features/capture/`)

5. **Nummerierte Marker.** In `ContributionText`, every covered span is prefixed with a superscript
   marker (number = index of the question in the card list, 1-based, 10px mono in a 16px accent-100
   circle) `data-testid="capture-marker-<n>"`. Hovering a question card highlights its span
   (accent-100 → accent-200) and hovering a span highlights the card (2px accent outline); shared
   `hoveredQuestionId` in `useCapture`. Keyboard: focusing a card triggers the same highlight.
6. **Klassifizierung einklappen.** A card whose question is beyond `captured` shows one summary line:
   TrackBadge (with glyph), agenda item "TOP 2", StageAssignmentBadge initials, and a ghost button
   "Ändern" (`data-testid="card-classification-toggle"`) that expands the existing controls. Cards in
   status `captured` show the controls expanded as today. All classify-* testids stay in the DOM when
   expanded.
7. **Quelle als Icon.** The contribution header shows `SourceIcon` instead of the text badge; the time
   badge stays.
8. Coverage bar: use the shared `ProgressBar` (keeps `capture-coverage` text with the percentage).

## Non-goals

No changes to the answering screens, the shell or the kit (if a kit piece is missing, compose it
locally in the feature folder and report it).

## Files allowed

`apps/web/src/features/speakers/**`, `apps/web/src/features/capture/**`, i18n `de.ts`/`en.ts`
(new keys inside the existing `// --- 002 speakers & capture ---` block), `apps/web/e2e/002-speakers-capture.spec.ts`
(extend: ring visible, marker count equals card count, toggle expands), `docs/evidence/006-*`, this file.

## Acceptance criterion

`pnpm gates` green; `E2E_PORT=<port> pnpm --filter @hv/web e2e` all specs green, including
`abnahme.spec.ts` (it classifies a captured card, which stays expanded). Screenshots
`docs/evidence/006-speakers.png` and `006-capture.png` (capture with at least five cards and markers).

## Evidence

## Review findings
