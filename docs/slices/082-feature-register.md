# 082 — Feature-Register für Routen, Navigation, Kürzel und Hilfe

**Status:** spec
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

(vom Mechaniker)

## Review findings

(vom Reviewer)
