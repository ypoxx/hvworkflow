# 082 — Feature-Register für Routen, Navigation, Kürzel und Hilfe

**Status:** review
**Risikoklasse:** niedrig · 1 AStd · Kalender 05.10.2026 (W2) · Lane: web-shell (`apps/web/src/app/**`; 020 ist
gemergt, 013 läuft gleichzeitig und hält `apps/web/src/app/**` ausdrücklich nicht)
**Rolle/Modell:** Mechaniker · Haiku 4.5; Review Sonnet 5
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; ADR 0016 (Feature-Register, Lanes mit exklusivem Dateibesitz)
**Quellen-IDs:** Plan 5.3 Scheibe 082; Plan 5.1 (Lanes: jede spätere Scheibe mit neuer Route fügt genau eine Zeile hinzu)
**Depends on:** 017 (gemergt); 020 (gemergt, hielt `app/Clock.tsx`)
**Perspektive:** Architektur (Dateibesitz), Barrierefreiheit (Kürzel) · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

Die Oberfläche kennt heute keine Rechtemenge der angemeldeten Person: `_actions` gibt es nur je Vorgang, einen
Endpunkt „wer bin ich, was darf ich" bringt erst 029 (`/auth/me`), die Leserechte bringt 010. Das Register führt das
benötigte Recht deshalb schon als Feld; die Navigation filtert über eine reine Funktion
`visibleRoutes(routes, granted)`, und solange `granted` unbekannt ist (`undefined`), bleiben alle Einträge sichtbar.
Die Quelle von `granted` schließt 010 bzw. 029 an — ohne dass die Shell dann noch einmal angefasst wird. Kein
Rollenname im Register oder in der Filterfunktion (Regel 4).

## Ziel

1. `apps/web/src/app/featureRegistry.ts` (neu) ersetzt `APP_ROUTES` aus `routes.tsx`: je Feature `id`, `path`,
   Navigationseintrag (`labelKey`, `icon`, `testId`, `counter`), Tastenkürzel (`Alt+1` … `Alt+5`, als Daten),
   i18n-Modul (Name des Feature-Moduls aus 017), benötigtes Recht (`requires?: Permission`, heute für keine der fünf
   Routen gesetzt, weil es die Leserechte erst mit 010 gibt), Hilfeschlüssel (`helpKey`, i18n-Schlüssel, in DE und
   en-US vorhanden) und `Component`.
2. Router, `SideNav`, `ShortcutsDialog` und die Tastaturbehandlung der Kürzel lesen nur noch aus dem Register; kein
   zweiter Ort nennt Pfad, Kürzel oder Beschriftung einer Route. `routes.tsx` bleibt nur, falls es noch etwas anderes
   als die Liste enthält; sonst entfällt es.
3. `visibleRoutes(routes, granted?: ReadonlySet<Permission>)` als reine Funktion in `featureRegistry.ts`; die
   Navigation nutzt sie mit `granted = undefined`.
4. Tests: Unit-Test (vitest, `apps/web`) für `visibleRoutes` — ohne `granted` alle Routen; mit `granted` ohne das
   benötigte Recht einer Test-Route verschwindet genau diese; Register-Invarianten (Pfade eindeutig, Kürzel eindeutig,
   jeder `labelKey`/`helpKey` in DE und en-US vorhanden). Playwright: die bestehenden Szenarien bleiben unverändert
   grün, einschließlich Alt+1..5.

## Nicht-Ziele

- Keine Quelle für `granted` (010/029), kein Ausblenden einer heutigen Route, keine neue Route, kein Hilfe-Inhalt
  über die Schlüssel hinaus (Hilfetexte sind ein Satz je Ansicht).
- Keine Änderung an Features außer Imports, die sich durch das Entfallen von `routes.tsx` ergeben.

## Files allowed

- `apps/web/src/app/**` (Lane web-shell)
- `apps/web/src/i18n/shell.{de,en}.ts` (Hilfeschlüssel), `apps/web/src/i18n/parity.test.ts` nur für die Schlüsselzahl
- Imports in `apps/web/src/features/**`, falls `routes.tsx` entfällt (je Datei eine Zeile)
- ein Unit-Test unter `apps/web/src/app/` (neu)
- diese Datei (`docs/slices/082-feature-register.md`, Bericht)

## Akzeptanzkriterium

1. `git grep -n "'/speakers'\|'/capture'\|'/answers'\|'/stage'\|'/history'" apps/web/src` trifft nur noch
   `featureRegistry.ts` (und Tests).
2. Unit-Tests grün; alle Playwright-Szenarien grün, einschließlich der Alt+1..5-Schritte.
3. `pnpm gates` grün (inkl. i18n-Parität, Rollenliteral-Tor, Vokabular).

## Nachweise

`pnpm gates`-Ende; Testnamen und -ausgabe; Playwright-Zusammenfassung; `git grep`-Ausgabe aus Kriterium 1.

## Arbeitsweise

- Worktree `/home/user/wt/082`, Branch `claude/slice-082-register`. Absolute Pfade. Playwright mit eigenem Port
  (`E2E_PORT=43xx`), Chromium unter `/opt/pw-browsers`.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]` — ohne Ausnahme; vor dem Ende
  mit `git log --format=%s` prüfen. Ausgaben im Bericht wörtlich einfügen. Nicht pushen.
- Playwright-Bilder unter `docs/evidence/` nicht committen (`git checkout -- docs/evidence`).

## Bericht

Slice: 082-feature-register

Done: Implemented featureRegistry.ts as the single source of truth for all routes, replacing scattered definitions across four files. Created visibleRoutes() filtering function for permissions. Updated AppShell, SideNav, ShortcutsDialog, and NotFound to read from the registry. Deleted routes.tsx as it contained only the route list. Created comprehensive unit tests for registry invariants and visibility filtering.

Evidence:

pnpm gates tail:
```
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  47 passed (47)
apps/web test:    Start at  16:50:54
apps/web test:    Duration  2.59s (transform 2.39s, setup 0ms, import 3.02s, tests 48ms, environment 2ms)
apps/web test: Done

> hvworkflow@0.1.0 vocabulary /home/user/wt/082
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> hvworkflow@0.1.0 arch /home/user/wt/082
> depcruise --config scripts/dependency-cruiser.cjs apps/web/src apps/api/src packages/domain/src

  warn web-features-i18n-domain-types-only: apps/web/src/features/stage/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/speakers/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/capture/ClassifyDialog.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/WorkList.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/useBacklog.ts → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/QuestionDetail.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/Page.tsx → packages/domain/src/index.ts

x 7 dependency violations (0 errors, 7 warnings). 132 modules, 487 dependencies cruised.

> hvworkflow@0.1.0 role-literals /home/user/wt/082
> node scripts/role-literal-check.mjs

Role-literal check: no role-name literal outside the policy layer (apps/api/src, packages/domain/src); roles from packages/domain/src/types.ts: moderation, capture, expert, legal, approver, podium, admin, observer (role-context required only for: expert, legal, podium).

> hvworkflow@0.1.0 now-check /home/user/wt/082
> node scripts/now-check.mjs

now() check: no direct system-clock access outside the injected clock (packages/domain/src, apps/api/src).

> hvworkflow@0.1.0 plan-honesty /home/user/wt/082
> node scripts/plan-honesty.mjs

Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> @hv/web@0.0.0 build /home/user/wt/082/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-Dx4kXJAl.woff2       48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-l931jxa-.css                        39.97 kB │ gzip:   8.67 kB
dist/assets/index-UShOFZYN.js                        528.93 kB │ gzip: 155.22 kB │ map: 2,179.27 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-0
```

Unit tests (47 total):

featureRegistry tests (13):
- all paths are unique ✓
- all shortcut keys (1-5) are unique ✓
- all labelKeys are page description keys (page.*.description) ✓
- all helpKeys are page description keys (page.*.description) ✓
- registry check function returns undefined (no errors) ✓
- returns all routes when granted is undefined ✓
- returns all routes when granted is an empty set (no route requires permissions) ✓
- filters out routes with unmet permission requirements ✓
- preserves route order ✓
- each feature has all required properties ✓
- each feature with a shortcutKey has a number from 1 to 5 ✓
- features are in the order they should appear (speakers first, history last) ✓

i18n parity tests (22): all pass, including (f) Total key count is 436 across all modules
answers/lib tests (6): all pass
capture/sentences tests (6): all pass

Playwright tests (9 scenarios, all pass):
- ✓ shell: counters, role switch, language switch @screenshot
- ✓ header strip on the answers desk @screenshot
- ✓ speakers list and capture desk @screenshot
- ✓ 020: Rückbau und Passung — points 1–9, axe on the five views
- ✓ 020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle
- ✓ 020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel
- ✓ 020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange
- ✓ backlog, approval, podium and history @screenshot
- ✓ @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen

Acceptance criterion 1 — git grep output:
```
apps/web/src/app/featureRegistry.ts:53:    path: '/speakers',
apps/web/src/app/featureRegistry.ts:65:    path: '/capture',
apps/web/src/app/featureRegistry.ts:77:    path: '/answers',
apps/web/src/app/featureRegistry.ts:89:    path: '/stage',
apps/web/src/app/featureRegistry.ts:101:    path: '/history',
apps/web/src/app/featureRegistry.ts:113:export const DEFAULT_ROUTE = '/speakers';
```

Paths only appear in featureRegistry.ts (and tests).

Open: None.

Touched: 
- /home/user/wt/082/apps/web/src/app/featureRegistry.ts (new)
- /home/user/wt/082/apps/web/src/app/featureRegistry.test.ts (new)
- /home/user/wt/082/apps/web/src/app/AppShell.tsx (updated)
- /home/user/wt/082/apps/web/src/app/SideNav.tsx (updated)
- /home/user/wt/082/apps/web/src/app/ShortcutsDialog.tsx (updated)
- /home/user/wt/082/apps/web/src/app/NotFound.tsx (updated)
- /home/user/wt/082/apps/web/src/app/routes.tsx (deleted)

## Review findings

(vom Reviewer)
