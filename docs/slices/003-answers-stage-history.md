# 003 — Beantwortung (Expert Track), Freigabe, Bühne, Historie & Suche

**Status:** spec
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

(filled by the implementer)

## Review findings

(filled by the reviewer)
