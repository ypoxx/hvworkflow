# takt-017 — Buchstabensuffixe im Plan-Graphen erkennen

**Status:** review · **Risikoklasse:** niedrig · **Lane:** infra
**Regeln:** AGENTS.md R1, R2, R12; Plan §5.1 (Abhängigkeiten und Lanes)
**Ausgangspunkt:** Der Produktplan enthält 021a–c, 029b und 080b/c. `plan-graph.mjs` liest bisher nur dreistellige IDs und übersieht dadurch echte Abhängigkeiten und Terminkollisionen.

## Ziel

Der Plan-Graph erkennt IDs aus drei Ziffern mit genau einem optionalen Kleinbuchstaben als vollwertige Scheiben. Abhängigkeiten, Zyklen, Reihenfolge, Lane-Warnungen und `--merged` behandeln sie wie dreistellige IDs. Der echte Plan zeigt seine bisherigen Kollisionen offen an. Die Korrektur der Termine und des 029/029b-Umfangs ist eine gesonderte Planentscheidung und gehört nicht zu diesem Parser-Takt.

## Nicht-Ziele

Keine Änderung des Produktplans, keine Neudefinition von `--strict`, keine Unterdrückung von Warnungen, keine Implementierung der Scheibe 084, kein Deployment.

## Files allowed

- `docs/slices/takt-017-plan-graph-alpha.md`
- `scripts/plan-graph.mjs`
- `scripts/plan-graph.test.mjs`
- `scripts/fixtures/plan-graph/alpha-splits.md`

## Akzeptanz

1. Zuerst roter Test: Eine Fixture mit `080 → 080b → 084` wird vollständig gelesen; `080b` ist eine vorhandene Abhängigkeit. `--merged 080b` berücksichtigt den suffigierten Eintrag. Eine doppelte oder fehlende suffigierte ID wird wie jede andere ID beanstandet. Fehlerhafte Suffixe (`080B`, `080bb`) werden auch ohne abhängige Scheibe nicht still übersprungen.
2. Danach grüner Test mit gezielter Parseränderung. Ein unabhängiger Lane-Konflikt bleibt unter `--strict` rot; die echten Kollisionen des Produktplans werden ausdrücklich als Warnungen berichtet.
3. `pnpm gates` auf einem sauberen Commit grün. Der Bericht nennt den Commit und zitiert den wörtlichen Schluss. Ein unabhängiges Review sieht Spec und Diff.

## Bericht

```
Slice: takt-017-plan-graph-alpha
Done: Plan-Graph liest dreistellige IDs mit optionalem Kleinbuchstaben.
      Echte Abhängigkeiten und 9 bestehende Lane-Kollisionen werden sichtbar;
      der Produktplan wurde nicht umdatiert.
Evidence: Tests zuerst: plan-graph.test.mjs 3 neu rot/11 grün; danach
      14/14 grün. Codex-P1 zu ungültigen Suffixen: eigener Test zunächst
      rot (14/15 grün), nach Korrektur 15/15 grün. `node scripts/plan-graph.mjs` erkennt 88 Scheiben,
      0 fehlende Abhängigkeiten, 0 Zyklen, 0 Reihenfolgeprobleme,
      9 Lane-Warnungen. `pnpm gates` Exit 0 auf Commit eb057e1;
      wörtlicher Schluss:
      - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
      ✓ built in 421ms
      mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow-024/.claude/state/last-test-run (clean tree) at commit eb057e1, tree 1b06ebd226e6…
Open: Die 9 historischen Lane-Kollisionen und der 029/029b-Umfang
      bleiben eine gesonderte Planentscheidung. Unabhängiges Review
      war ohne wesentliche Findings; Codex-P1 wurde behoben, enger
      Recheck und PR-CI stehen aus. Keine Oberfläche geändert.
Touched: docs/slices/takt-017-plan-graph-alpha.md,
      scripts/plan-graph.mjs, scripts/plan-graph.test.mjs,
      scripts/fixtures/plan-graph/alpha-splits.md.
```
