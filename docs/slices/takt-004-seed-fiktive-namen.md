# takt-004 — Seed: fiktive Vereinsnamen, Screenshot des Fragenpakets neu

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: core (nur `seed.ts`; 012 gemergt,
keine laufende Scheibe hält core), docs-feedback
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5 baut (Screenshot mit Legende, wie in 014); Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 11, 12
**Quellen-IDs:** Review 014 Runde 1 Befund 10 und Runde 2 Punkt 11 (echte Vereinsnamen im Seed und im Screenshot an
die Projektleitung), N5 (Marke 28 verdeckt eine Ziffer); Fälligkeit: Versand des Fragenpakets am 02.10.2026

## Ziel

1. `packages/domain/src/seed.ts`, `ASSOCIATIONS`: die vier Einträge durch vier erkennbar fiktive ersetzen:
   `'Aktionärsverein Nordlicht'`, `'Schutzgemeinschaft Musterstadt'`, `'Anlegerkreis am Elbufer'`,
   `'Verein kritischer Kleinanleger Beispielstadt'`. Gleiche Anzahl, gleiche Reihenfolge, damit die Zufallsfolge des
   Seeds unverändert bleibt.
2. `LAST_NAMES`: `'Quandt'` durch `'Quednau'` ersetzen (gleiche Stelle; ein bekannter Familienname im
   Aktionärskontext ist keine synthetische Person).
3. Ein Test in `packages/domain` prüft, dass keiner der alten fünf Namen im erzeugten Korpus vorkommt und dass die
   Anzahl der Wortmeldungen und Einzelfragen gleich bleibt (Zahlen aus dem heutigen Seed).
4. `docs/feedback/2026-10-fragenpaket-wortmeldeliste.png` neu erzeugen, gleiche Ansicht (Wortmeldeliste, Rolle
   Moderation), jetzt auf dem Stand nach 020 (Uhr HH:MM, Griff sichtbar, Hinweis im Rundenkopf). Jedes sichtbare
   Bedienelement und jeder neue Hinweis bekommt eine Nummer; die Nummern laufen lückenlos 1..N; keine Marke verdeckt
   Text (N5). Die Legende im Anhang von `docs/feedback/2026-10-fragenpaket-woche-1.md` wird aus derselben
   Markierungsliste erzeugt und beschreibt, was das Bild zeigt (Hausvokabular, ohne Entwicklerbegriffe); Stellen im
   Fragenpaket, die die Zahl der Nummern nennen, werden angepasst. Frage 1 selbst bleibt unverändert. Die Erzeugungsskripte liegen im Scratch unter
   `/tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/shot014/` (`shot.mjs`,
   `generate-legend.mjs`); sie bleiben dort.
5. Playwright-Bilder unter `docs/evidence/` ändern sich durch die Namen möglicherweise: nicht committen (die
   Nachweisbilder der alten Scheiben bleiben der alte Stand).

## Nicht-Ziele

Keine anderen Seed-Änderungen (Korpus 28/230 ist 080), keine Oberflächenänderung, keine Änderung an den Fragen des
Fragenpakets außer den Zahl-Nennungen.

## Files allowed

`packages/domain/src/seed.ts`, ein Test unter `packages/domain/src/__tests__/`, die PNG, Anhang/Legende und die
Zahl-Nennungen im Fragenpaket, diese Datei (Bericht).

## Nachweis

Tail von `pnpm gates`; alle Playwright-Szenarien grün; `git grep -n "DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt"` ohne
Treffer; die neue PNG und der Befehl, mit dem sie erzeugt wurde.

## Bericht

(vom Bauenden)

## Review findings

(vom Reviewer)
