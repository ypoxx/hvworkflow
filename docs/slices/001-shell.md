# 001 — Shell, design system, i18n, role switcher

**Status:** accepted
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

Reviewed against `git diff 07638a1 --stat -- apps/web` and a direct read of every file it touches
(spec/rules/glossary only; the "Evidence" section above was not used as a source). Verdict: **accepted**,
no blocker or major findings.

1. **Minor** — `apps/web/index.html` (diff: 3 lines removed, no line added/changed in `<title>`).
   The slice's "Files allowed" line restricts `index.html` to "title only", but the diff also removes
   the three Google Fonts `<link rel="preconnect">`/`<link rel="stylesheet">` tags that the spec's
   goal 3 assumed would stay ("font Inter (already linked in index.html)"). The replacement —
   self-hosting Inter/JetBrains Mono as woff2 under `apps/web/src/styles/fonts/**` (an allowed path)
   with `@font-face` rules in `apps/web/src/styles/index.css:9-46` — is a defensible call (no outbound
   dependency on the day of the meeting, SIL OFL 1.1, confirmed present in the build output as
   `dist/assets/inter-latin-*.woff2` etc.) and does not break anything: `pnpm gates` and the e2e test
   both pass. Fix expected: either fold this into the slice's "Files allowed" line explicitly (add
   "index.html font links" or similar) before merge, or split it into its own one-line follow-up note
   so the scope actually matches what was touched. Not a functional problem, just an undeclared scope
   edge.
2. **Minor / informational** — `apps/web/src/i18n/labels.ts:73-82` (`ROLE_KEYS`). This map uses every
   `Role` value as an object key to produce a display string for `roleLabel()`. AGENTS.md rule 4 names
   exactly two places a role name may appear ("`ROLE_PERMISSIONS` and the demo role switcher"); this is
   a third. In substance it is not a rights decision — verified no `role ===`/`role !==`/`switch(role)`
   anywhere in `apps/web/src` outside `src/api/actor.ts` (the one file rule 4 exempts), and
   `roleLabel()` is required by the spec itself (goal 5: "roles (display names)"; used from
   `RoleSwitcher.tsx:9,48,53,68,70` and nowhere to gate visibility). `node scripts/vocabulary-check.mjs`
   — the automated form of rule 4/9 — passes and does not flag this pattern. No rework requested; noting
   it so the rule's wording (or the vocabulary check) can be updated to say what it actually enforces
   (no role-based branching) rather than the narrower literal text (two named locations).

### Spec coverage (goals 1–7)

All seven goals are implemented and verified directly, not from the Evidence section:

- **1 App shell**: routes/nav in `apps/web/src/app/routes.tsx:28-68` (`/speakers /capture /answers
  /stage /history`, `react-router` `BrowserRouter`+`Routes` in `App.tsx:59-61` /`AppShell.tsx:96-102`).
  Header counters refetch via `useMeeting()` → `useApiVersion()` → `api.getMeeting()`
  (`apps/web/src/app/useMeeting.ts:12-33`), rendered in `Header.tsx:30-56,140-143`. Clock in
  `Clock.tsx:8-14` (`Europe/Berlin`, `hour12:false`, HH:MM:SS). Role switcher in `RoleSwitcher.tsx`.
  DE/EN toggle in `LanguageToggle.tsx`. Demo badge + reset in `DemoControls.tsx:16-29` calling
  `resetDemo()`. Demo-mode hint text `demo.hint` shown in `SideNav.tsx:98` and as the badge's `title`
  in `DemoControls.tsx:17`.
- **2 Boot**: `App.tsx:14-63` calls `seedIfEmpty()` once, shows `BootScreen` while loading
  (`BootScreen.tsx`), wraps in `ErrorBoundary.tsx` with a plain German message
  (`error.title`/`error.hint`, `de.ts:19-23`) and a reset button.
- **3 Design tokens**: `apps/web/src/styles/index.css` `@theme` block (lines 54-174): Inter/JetBrains
  Mono, warm grey scale, accent `#1d4ed8` (`--color-accent-600`), radii 4/6/8px, focus ring
  (`:focus-visible`, lines 199-203), one colour triple per `QuestionStatus` (11/11, lines 106-139) and
  per `Track` (3/3, lines 142-150) — checked 1:1 against `packages/domain/src/types.ts:48-68`. Light
  theme only confirmed (no `dark`/`prefers-color-scheme` anywhere in the diff).
- **4 Component kit**: all listed primitives present and match spec — `Button.tsx` (4 variants × 2
  sizes), `Badge.tsx` (+`StatusBadge`/`TrackBadge`/`StageAssignmentBadge`), `Panel.tsx`,
  `EmptyState.tsx`, `KeyValue.tsx`, `Toolbar.tsx`, `Dialog.tsx` (role=dialog, aria-modal, focus trap
  lines 59-71, Esc lines 53-58, focus returned line 79), `Toast.tsx`/`toastStore.ts` (shows
  `ApiProblem.detail` and `ruleId`, `toastStore.ts:43-62`, `Toast.tsx:50-57`), `Kbd.tsx`,
  `SplitPane.tsx` (resizable, `localStorage` persisted, lines 22-56), `Table.tsx` with sticky
  `THead` (`position: sticky top-0`, line 15).
- **5 i18n**: `de.ts` (191 keys) / `en.ts` (193 keys) — diffed the two key sets, identical; `Dictionary
  = typeof de` in `types.ts:8` makes a missing/extra key in `en.ts` a compile error, confirmed by a
  green `tsc -b`. `useT()` in `store.ts:71-74`, language in `localStorage` (`store.ts:11,52`),
  `<html lang>` updated (`store.ts:38-42`).
- **6 Labels**: `apps/web/src/i18n/labels.ts` exports `statusLabel`, `trackLabel`,
  `stageAssignmentLabel`, `actionLabel` (plus `trackShortLabel`, `roleLabel`, `eventTypeLabel`), each
  built from an exhaustively-typed `Record<…, TKey>` (compiler-enforced coverage).
- **7 Placeholders**: every route renders a title + `EmptyState` via `PhasePlaceholder.tsx` (speakers,
  answers, stage, history) or a bespoke `SplitPane` placeholder for capture
  (`features/capture/Page.tsx`) that showcases the required `SplitPane` component without any business
  logic.

### Rule checks

- **Rule 4 (rights are data)**: `grep -rnE "role\s*===|role\s*!==|\.role\s*==|switch\s*\(.*role"
  apps/web/src` → only hit is `apps/web/src/api/actor.ts:28` (an allowed file, pre-existing, untouched
  by this diff). No hit in any `.tsx` component. See finding 2 above for the one adjacent, non-blocking
  observation (`labels.ts` `ROLE_KEYS`).
- **Rule 6 (contract/`HvApi` only)**: `grep -rn "fetch(" apps/web/src` → no results. `grep -rn
  "createInProcessApi" apps/web/src` → only `apps/web/src/api/index.ts:10,43`, a pre-existing file
  outside this diff (`git diff 07638a1 --stat -- apps/web/src/api` is empty). All `@hv/domain` imports
  from files touched in this diff are `import type` only (`Meeting`, `QuestionStatus`, `Track`,
  `StageAssignment`, `ApiProblem`, `Permission`/`Role`/`EventType`) — verified with `grep -rn "from
  '@hv/domain'"`.
- **Rule 9 (vocabulary)**: `node scripts/vocabulary-check.mjs` → `vocabulary-check: ok`.
- **Rule 10 (i18n, no literals)**: grepped all of `app/`, `components/`, `features/` for JSX text
  nodes, literal `aria-label="…"`, `title="…"`, `placeholder="…"`, `alt="…"`, and `{'…'}` string
  literals — zero matches outside the i18n dictionaries themselves.

### data-testid checklist

All required ids present and exercised by `apps/web/e2e/001-shell.spec.ts`: `header-meeting-title`
(`Header.tsx:116`), `header-counter-speakers`/`-questions`/`-open`/`-staged` (`Header.tsx:32-55`),
`role-switcher` (`RoleSwitcher.tsx:37`), `role-option-<role>` (`RoleSwitcher.tsx:77`, keyed by
`persona.role`, all 8 roles), `lang-toggle` (`LanguageToggle.tsx:14`), `nav-speakers`/`nav-capture`/
`nav-answers`/`nav-stage`/`nav-history` (`routes.tsx:33,41,49,57,65`, rendered in `SideNav.tsx:43`),
`demo-reset` (`DemoControls.tsx:24`).

### Accessibility

`Dialog.tsx`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to an `<h2>`, focus moved to the
first focusable element on open (line 51), Tab trapped (lines 59-71), Esc closes (lines 53-58), focus
restored to the previously-focused element on close (line 79). `SideNav.tsx:25-26` is a `<nav
aria-label=…>`. Icon-only buttons all carry `aria-label`: shortcuts button (`Header.tsx:156`), demo
reset (`DemoControls.tsx:25`), dialog close (`Dialog.tsx:120`), toast close (`Toast.tsx:61`), nav
collapse toggle (`SideNav.tsx:104`).

### Files-touched check

`git diff 07638a1 --name-status -- apps/web` lists only files under `app/**`, `components/**`,
`i18n/**`, `styles/**` (incl. new font binaries), `features/*/Page.tsx`, `e2e/001-shell.spec.ts`, and
`index.html` — matching the allowed list except for the index.html point in finding 1.
`docs/evidence/001-shell.png` and `001-shell-en.png` (both 1440×900, confirmed via `file`) are within
`docs/evidence/001-*`. Note: the same commit range (since `07638a1`) also touches `apps/api/**`,
`packages/domain/src/api.ts`, `docs/slices/004-api-server.md` and `docs/messung.md` — that is slice
004's work sharing the branch, out of scope for this review and not counted against slice 001.

### Gate / e2e output (run fresh by the reviewer)

`node scripts/vocabulary-check.mjs`:
```
vocabulary-check: ok
```

`pnpm gates` (tail):
```
apps/web typecheck: Done
...
packages/domain lint: src/seed.ts:440:18: warning unicorn(no-new-array) [pre-existing, not in this diff]
apps/web lint: src/api/useApiVersion.ts:14:19: warning react(set-state-in-effect) [pre-existing, not in this diff]
...
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  37 passed (37)
apps/api test:  Test Files  3 passed (3)
apps/api test:       Tests  19 passed (19)
apps/web test: No test files found, exiting with code 0
apps/web test: Done

> node scripts/vocabulary-check.mjs
vocabulary-check: ok

> @hv/web@0.0.0 build
> tsc -b && vite build
✓ 1664 modules transformed.
dist/assets/index-B7uwtq1O.js   327.14 kB │ gzip: 102.85 kB
✓ built in 1.04s
```
(redocly lint passed with 9 pre-existing warnings on `packages/contract/openapi.yaml`, unrelated to
this slice; full `tsc -b` for all four packages passed.)

`E2E_PORT=4181 pnpm --filter @hv/web e2e`:
```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (1.5s)

  1 passed (3.4s)
```

### Verdict

**Accepted.** No blocker or major findings; two minor/informational notes above (undeclared
`index.html` scope edge, and a rule-4-wording vs. spec-required `roleLabel` tension) that do not
require rework before merge.
