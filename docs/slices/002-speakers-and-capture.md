# 002 — Wortmeldeliste and Erfassung with Atomisierung

**Status:** spec
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

(filled by the implementer)

## Review findings

(filled by the reviewer)
