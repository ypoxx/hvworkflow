# takt-017 — Buchstabensuffixe im Plan-Graphen erkennen

**Status:** geplant · **Risikoklasse:** niedrig · **Lane:** infra
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

1. Zuerst roter Test: Eine Fixture mit `080 → 080b → 084` wird vollständig gelesen; `080b` ist eine vorhandene Abhängigkeit. `--merged 080b` berücksichtigt den suffigierten Eintrag. Eine doppelte oder fehlende suffigierte ID wird wie jede andere ID beanstandet.
2. Danach grüner Test mit gezielter Parseränderung. Ein unabhängiger Lane-Konflikt bleibt unter `--strict` rot; die echten Kollisionen des Produktplans werden ausdrücklich als Warnungen berichtet.
3. `pnpm gates` auf einem sauberen Commit grün. Der Bericht nennt den Commit und zitiert den wörtlichen Schluss. Ein unabhängiges Review sieht Spec und Diff.

## Bericht

(nach dem Test- und Gate-Lauf)
