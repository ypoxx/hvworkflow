# 001 — Shell, design system, i18n, role switcher

**Status:** spec
**Role:** Implementierer Oberfläche (Sonnet)
**Rule ids:** AGENTS.md rules 4, 6, 9, 10; ADR 0001, ADR 0002

## Goal

The frame everything else lives in. It must look like a professional, calm control-room tool of
2026 — not a ticket system, not a dashboard toy. Dense but airy, keyboard-friendly, fast.

1. **App shell** (`src/app/`): left navigation by phase — Wortmeldungen, Erfassung, Beantwortung,
   Bühne, Historie & Suche (routes `/speakers`, `/capture`, `/answers`, `/stage`, `/history`) using
   `react-router` (declarative `BrowserRouter` + `Routes`). Header: meeting title, live counters
   from `api.getMeeting()` (Wortmeldungen, Fragen, offen, Bühne), a clock (HH:MM:SS, Europe/Berlin),
   the **role switcher**, language toggle DE/EN, a discreet "Demo" badge with a reset action
   (`resetDemo()`), and a "Demo-Betriebsart — synthetische Daten, nur dieses Gerät" hint.
2. **Boot**: on start call `seedIfEmpty()` from `src/api`, show a short loading state, then render.
   Wrap in an error boundary with a plain German message and a reset button.
3. **Design tokens** in `src/styles/index.css` via Tailwind v4 `@theme`: font Inter (already linked
   in index.html), mono JetBrains Mono for numbers/ids; neutral grey scale with one accent (deep
   blue `#1d4ed8`-ish) and semantic status colours; radius 6px; 8px spacing grid; focus rings visible.
   **Light theme only.** Provide status colour tokens for every `QuestionStatus` and each `Track`.
4. **Component kit** in `src/components/`: `Button` (primary/secondary/ghost/danger, sizes), `Badge`
   (status, track, stage assignment), `Panel`, `EmptyState`, `KeyValue`, `Toolbar`, `Dialog`
   (accessible: role=dialog, focus trap, Esc), `Toast` for errors (shows `ApiProblem.detail` and
   `ruleId`), `Kbd`, `SplitPane` (resizable, remembers width in localStorage), `Table` primitives
   with sticky header.
5. **i18n** in `src/i18n/`: typed dictionary `de` and `en` (en-US wording), `useT()` hook, language
   persisted in localStorage, `<html lang>` updated. Include all labels for statuses, tracks, stage
   assignments, roles (display names), phases, header, common actions (Speichern, Abbrechen,
   Zurückgeben …). German is the reference; English must be complete (typecheck enforces same keys).
6. **Status/track labels**: `src/i18n/labels.ts` exporting `statusLabel(status)`, `trackLabel(track)`,
   `stageAssignmentLabel()`, `actionLabel(permission)` — used by all later slices.
7. Each route renders a placeholder page component (title + EmptyState) that later slices replace.

## Non-goals

No business screens (slices 002/003). No dark theme. No animation library. No CSS-in-JS.

## Files allowed

`apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/i18n/**`, `apps/web/src/styles/**`,
`apps/web/src/features/*/Page.tsx` placeholders, `apps/web/index.html` (title only), `docs/evidence/001-*`.
Do not touch `src/api/**` (owned by the architect) except to import from it.

## Acceptance criterion

`pnpm gates` green. Start the preview, switch role to "Podium": header shows the persona; switch
language to EN: every visible string changes. Counters show 800+ questions after seeding.
Screenshot `docs/evidence/001-shell.png` (1440×900) via Playwright.

## Evidence

(filled by the implementer)

## Review findings

(filled by the reviewer)
