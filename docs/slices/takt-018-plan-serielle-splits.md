# takt-018 — Serielle Scheiben-Splits im Plan-Graphen

**Status:** geplant · **Risikoklasse:** mittel · **Lanes:** infra, docs-plan
**Regeln:** AGENTS.md R1, R2, R12; Produktplan §5.1 und §8.3
**Ausgangspunkt:** Der Parser aus takt-017 erkennt jetzt 080b/c und 021a/b/c. Er meldet neun Lane-Kollisionen, obwohl 080→080b und 021a→021b→021c explizit serielle Arbeit am selben Tag sind. Der alte Sammelpunkt 021 wird fälschlich als zusätzliche Scheibe gezählt. 080c und 032 sind dagegen unabhängig und teilen am 27.10. die Lane web-speakers.

## Ziel

1. Zwei Scheiben am selben Kalendertag mit gemeinsamer Lane gelten nur dann als seriell, wenn eine im Abhängigkeitsgraphen unmittelbar oder mittelbar von der anderen abhängt. Der bestehende Reihenfolge-Check muss dafür weiterhin gelten. Unabhängige Scheiben mit gemeinsamer Lane bleiben unter `--strict` rot.
2. Der historische Sammelpunkt 021 wird als historische Prosa bewahrt und nicht länger als eigenständige Scheibe gezählt. Seine echten Nachfolger sind 021a, 021b und 021c; 021c hängt explizit von 021b ab. Fachliche Abhängigkeiten, die noch den abgeschafften Sammelpunkt 021 nennen, zeigen auf den letzten Teil 021c.
3. Die unabhängige 080c wird auf den 30.10.2026 (W5) gesetzt; dort ist die Lane web-speakers frei. Sonstige Plantermine bleiben unverändert.

## Nicht-Ziele

Keine Entscheidung zum widersprüchlichen Umfang oder Termin von 029/029b; keine Anpassung der Beta-Kriterien oder von 084; keine automatische Neuplanung; keine Umgehung des strengen Gates und kein Deployment. Die verbleibende 029/029b-Warnung wird ausdrücklich berichtet.

## Files allowed

- `docs/slices/takt-018-plan-serielle-splits.md`
- `scripts/plan-graph.mjs`
- `scripts/plan-graph.test.mjs`
- `scripts/fixtures/plan-graph/serial-same-day.md`
- `docs/produktplan-beta.md` (nur historischer 021-Block, die exakten 021-Abhängigkeitszeilen, die 021c-Abhängigkeit und das Datum von 080c)

## Akzeptanz

1. Test zuerst rot: Eine Fixture mit expliziter gleichdatiger Kette und gemeinsamer Lane scheitert heute an `--strict`; nach der Korrektur besteht sie. Die bestehende unabhängige Lane-Kollision bleibt unter `--strict` rot.
2. Der echte Plan enthält keine eigenständige Scheibe 021 mehr, keine Abhängigkeit auf 021, aber die drei Teil-Scheiben. `node scripts/plan-graph.mjs` meldet 87 Scheiben, keine fehlende Abhängigkeit, keinen Zyklus und kein Reihenfolgeproblem; von den neun bisherigen Warnungen bleibt genau 029/029b. `--strict` gegen den echten Plan bleibt deshalb bewusst rot.
3. `pnpm gates` besteht auf einem sauberen Commit. Der Bericht nennt dessen Commit und den wörtlichen Schluss. Unabhängiges Review prüft Spec und Diff.

## Bericht

Slice: takt-018-plan-serielle-splits

Done: Gleichdatige Scheiben mit expliziter Abhängigkeitskette gelten als serielle Lane-Nutzung. Der historische Sammelpunkt 021 bleibt lesbar, wird aber nicht mehr als aktive Scheibe gezählt; die Abhängigkeiten zeigen auf 021c. 080c liegt am 30.10.2026.

Evidence: Test zuerst rot (vier Warnungen in der neuen Fixture), danach `node --test scripts/plan-graph.test.mjs` mit 16/16 grün; `node scripts/plan-graph.mjs` mit 87 Scheiben, 0 fehlenden Abhängigkeiten, 0 Zyklen, 0 Reihenfolgefehlern und genau einer Warnung; `node scripts/slice-scope.mjs --takt 018 --base 3311c00de17cb2543bee23d240d9d3950ca17e1c` bestätigt 5/5 Dateien. `pnpm gates` auf Commit `8cce56f` endete wörtlich:

```text
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 434ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow-024/.claude/state/last-test-run (clean tree) at commit 8cce56f, tree f20717b58f9e…
```

Open: `node scripts/plan-graph.mjs --strict` bleibt wegen der unabhängigen Lane-Kollision 029/029b rot. Deren Umfang und Termin werden erst nach der offenen Beta-Entscheidung festgelegt. Der automatische PR-Review meldete P2: `--calendar` legt serielle, gleichdatig dokumentierte Scheiben wegen seiner tagesweisen Neuplanung auf Folgetage. Das gehört nach AGENTS.md R3 in einen späteren gebündelten Folgelisten-Pass; `docs/folgeliste.md` liegt außerhalb von „Files allowed“ dieser Scheibe. Kein Deployment.

Touched: `docs/slices/takt-018-plan-serielle-splits.md`, `scripts/plan-graph.mjs`, `scripts/plan-graph.test.mjs`, `scripts/fixtures/plan-graph/serial-same-day.md`, `docs/produktplan-beta.md`.
