# takt-005 — Doku-Nachträge: E-Mail-Adresse aus dem Bericht von 012, Patch-Stufe in ADR 0015, Lanes von 010 im Plan

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-slices, docs-adr, docs-plan
(nur `docs/produktplan-beta.md`; 018 hält `docs/agentische-entwicklung-plan.md`, nicht den Produktplan)
**Rolle/Modell:** Mechaniker · Haiku 4.5; Review Sonnet 5
**Rule ids:** AGENTS.md Regeln 1, 2, 11, 12
**Quellen-IDs:** Review 016 Runde 2 („Außerhalb von 016 gemeldet"); 016 hat denselben Wert in
`scripts/audit-exceptions.json` bereits durch die Rolle ersetzt; Fable-Prüfung der Spec 010 Befunde 7 und 12

## Ziel

1. `docs/slices/012-architektur-sicherheitstore.md`, Abschnitt Bericht (heute Zeile 271): im Satz
   „covered by the one entry in `scripts/audit-exceptions.json` (owner `…`, expires `2026-12-31`)" wird der Wert von
   `owner` durch den Wert ersetzt, der nach 016 in `scripts/audit-exceptions.json` steht (Rolle „Umsetzer"; aus der
   Datei lesen, nicht raten). Sonst ändert sich nichts an der Zeile.
2. Nachweis, dass im Arbeitsbaum keine E-Mail-Adresse einer Person mehr steht:
   `git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- . ':!pnpm-lock.yaml' ':!**/node_modules/**'`
   im Bericht, jede verbleibende Fundstelle einzeln begründet (z. B. `noreply@anthropic.com` in Commit-Vorlagen,
   Beispieladressen `@example.…`). Eine weitere persönliche Adresse wird nicht still entfernt, sondern im Bericht
   gemeldet.
3. `docs/adr/0015-vertragsversionierung.md`, Abschnitt Entscheidung, am Ende der Aufzählung eine Zeile in der Form
   der Vorschläge ohne Planstütze (takt-003, N6): „Vorschlag (nicht im Plan): Ein Vertragszyklus des Architekten hebt
   die Minor-Stufe (0.2.0, 0.3.0, 0.4.0); eine additive Einzeländerung innerhalb eines Zyklus hebt die Patch-Stufe
   (0.2.1 in 010, 0.3.1 in 028)." Status und Datum des ADR bleiben.
4. `docs/produktplan-beta.md`, Abschnitt 5.2, Kopfzeile der Scheibe 010: `Lanes: core` wird zu
   `Lanes: core, contract, service, web-speakers, web-capture, web-answers, web-stage, web-history, e2e` (so wie die
   Spec `docs/slices/010-lesepfade-leserechte.md` sie braucht). Sonst ändert sich nichts an der Zeile. Danach
   `node scripts/plan-graph.mjs` und `node scripts/plan-graph.mjs --calendar` ausführen; die Ausgabe steht im
   Bericht (neue Lane-Warnungen sind Befunde, keine Fehler).

## Nicht-Ziele

Keine Änderung an der Git-Historie (die Adresse bleibt in `76e572e` und in den 016-Commits; ein Umschreiben der
Historie entscheidet der Eigentümer). Keine anderen Wortlautänderungen im Bericht von 012.

## Files allowed

`docs/slices/012-architektur-sicherheitstore.md` (eine Zeile), `docs/adr/0015-vertragsversionierung.md` (eine Zeile),
`docs/produktplan-beta.md` (eine Zeile), diese Datei (`docs/slices/takt-005-email-aus-012.md`, Bericht).

## Akzeptanzkriterium

1. `git diff --stat` zeigt genau vier Dateien; in 012-Spec, ADR 0015 und Produktplan je genau eine geänderte oder neue Zeile.
2. Der `git grep` aus Ziel 2 im Bericht, wörtlich.
3. `pnpm gates` grün (Tail wörtlich im Bericht).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-005-email-012` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-005" und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Mechaniker)

## Review findings

(vom Reviewer)
