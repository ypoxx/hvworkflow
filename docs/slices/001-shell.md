# 001 — Shell, design system, i18n, role switcher

**Status:** review
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

Umgesetzt am 2026-09-02. `pnpm gates` grün, `pnpm --filter @hv/web e2e` grün, beide Screenshots in
`docs/evidence/` (1440×900).

**`pnpm gates` (Ende der Ausgabe):**

```
apps/web test: Done
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  19 passed (19)
apps/api test:    Start at  20:30:03
apps/api test:    Duration  1.03s (transform 733ms, setup 0ms, import 1.61s, tests 633ms, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/hvworkflow
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> @hv/web@0.0.0 build /home/user/hvworkflow/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1664 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.73 kB │ gzip:   0.39 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-Cm0N7-wI.css                        28.33 kB │ gzip:   6.74 kB
dist/assets/index-DQ0swW01.js                        326.93 kB │ gzip: 102.80 kB │ map: 1,540.87 kB

✓ built in 1.05s
```

Frühere Zeilen desselben Laufs: `redocly lint` ohne Befund, `tsc -b` für alle vier Pakete,
`oxlint` ohne Fehler (zwei Warnungen in bestehenden Dateien: `packages/domain/src/seed.ts`,
`apps/web/src/api/useApiVersion.ts`), `packages/domain` 36 Tests grün, `apps/api` 19 Tests grün.

**`pnpm --filter @hv/web e2e`:**

```
> @hv/web@0.0.0 e2e /home/user/hvworkflow/apps/web
> playwright test


Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (13.8s)

  1 passed (16.0s)
```

**Screenshots:** `docs/evidence/001-shell.png` (Deutsch, Rolle Podium) und
`docs/evidence/001-shell-en.png` (Englisch). Beide 1440×900, aus demselben Testlauf.

**Was der Test nachweist:** `/` leitet auf `/speakers`; die Kopfzähler stehen nach dem Seeding auf
800 Einzelfragen aus 118 Wortmeldungen (offen 325, Bühne 100); alle geforderten `data-testid`
sind vorhanden; Rollenwechsel auf Podium wird im Kopf angezeigt; nach dem Sprachwechsel steht
`<html lang="en">`, der Kopftitel wechselt von „Runde 4" auf „Round 4", die Navigation von
„Wortmeldungen" auf „Requests to speak", der Zähler von „Offen" auf „Open".

**Umsetzung in Stichworten:**

- `src/app/routes.tsx` ist die einzige Routentabelle: Pfad, Label-Schlüssel, Icon, `data-testid`
  und der Kopfzähler je Phase. Navigation, Tastaturkürzel und Router lesen daraus; spätere Scheiben
  tauschen nur `Component`.
- `src/i18n/`: `de.ts` ist die Referenz, `en.ts` ist als `Dictionary` typisiert — ein fehlender
  Schlüssel ist ein Compilerfehler. `useT()` liefert `t(key, params?)`; die Sprache liegt in einem
  Modul-Store (localStorage, setzt `<html lang>` und `document.title`).
- `src/i18n/labels.ts`: `statusLabel`, `trackLabel`, `trackShortLabel`, `stageAssignmentLabel`,
  `actionLabel`, `roleLabel`, `eventTypeLabel` — vollständige Abdeckung aller elf Status, drei
  Antwortpfade, vier Bühnenzuordnungen, achtzehn Rechte, acht Rollen und siebzehn Ereignisarten.
- Rechte als Daten: `RoleSwitcher.tsx` ist die einzige Datei der Oberfläche, die Personas auflistet
  (aus `src/api/actor.ts`); es gibt keinen Rollenvergleich, `vocabulary-check` bestätigt das.
- Farben: warme neutrale Graustufen, ein Akzentblau (`#1d4ed8`), je ein Tint-Tripel pro
  `QuestionStatus` und pro `Track` als `@theme`-Token in `src/styles/index.css`.
- Inter und JetBrains Mono liegen als woff2 (latin, latin-ext, SIL OFL 1.1) unter
  `src/styles/fonts/` und werden mitgebaut, damit die Typografie am Tag der Hauptversammlung nicht
  von einer ausgehenden Verbindung zu einem Font-CDN abhängt.

## Review findings

(filled by the reviewer)
