# takt-019 — Vertragsbrücke für den HV-Lebenszyklus vor 025

**Status:** geplant · **Risikoklasse:** mittel · **Lanes:** contract, service (nur Vertragstest), docs-plan
**Regeln:** AGENTS.md R1, R2, R3, R6, R7, R12; ADR 0011 und 0015; R-MTG-01..06 werden erst in 025 umgesetzt
**Ausgangspunkt:** Der Eigentümer hat am 27.09.2026 entschieden, den Vertrag vor 025 additiv zu ergänzen. `MeetingStatus` verspricht `preparation → running → closed`, aber Vertrag 0.3.2 kennt nur `MeetingCreated` und `DebateClosed` als Ereignisse des Jahrgangs. `DebateClosed` beendet die Generaldebatte und ist nicht der Schluss des Jahrgangs. Die heutige Projektion setzt schon bei `MeetingCreated` auf `running`; 025 wird das ändern.

## Ziel

1. Vertrag 0.3.3 ergänzt `MeetingStarted` und `MeetingClosed` als additive `Event.type`-Werte. Bei beiden ist `subjectId` die `meetingId`; der maßgebliche Zeitpunkt ist `recordedAt` (`at` als Kompatibilitätsalias). Beide Payloads sind leere Objekte. `MeetingCreated` beginnt ab 025 in `preparation`, `MeetingStarted` projiziert `running`, `MeetingClosed` projiziert `closed`. `DebateClosed` bleibt davon getrennt und setzt nur `Meeting.debateClosedAt`.
2. Diese Brücke führt keine neue öffentliche Operation ein. 025 validiert und projiziert die Ereignisse in R-MTG-01..06 und prüft Lebenszyklus-Übergänge mit synthetischen v2-Ereignissen. Die Start-Aktion wird in 040 und der bewachte Debattenschluss mit Restantenliste in 087 öffentlich; eine öffentliche Jahrgangs-Schlussaktion braucht vor ihrer Einführung eine eigene Spec und Vertragsergänzung. Der Vertrag behauptet keine heute schon erreichbare Schaltfläche.
3. `info.version`, Paketversion, CHANGELOG und generierte Typen werden 0.3.3. Die Pflichtfelder und das Pflicht-`If-Match` aus 028 rücken auf 0.3.4. Die Planstellen zu 023, 025, 028 und der Vertragsrisiko-Zeile nennen diese Reihenfolge wahrheitsgemäß.

## Nicht-Ziele

Keine Kern-Projektion oder Status-Transition in diesem Takt, keine neue Route, keine Rechte- oder Oberflächenänderung, kein vorgezogener Debattenschluss, keine Änderung an 029/029b und kein Deployment. Der 025-Bau darf erst nach dieser Vertragsbrücke beginnen.

## Files allowed

- `docs/slices/takt-019-meeting-lebenszyklus-vertrag.md`
- `packages/contract/openapi.yaml`
- `packages/contract/src/types.ts` (generiert)
- `packages/contract/CHANGELOG.md`
- `packages/contract/package.json`
- `apps/api/src/__tests__/takt-019-contract.test.ts`
- `apps/api/src/__tests__/takt-016-contract.test.ts` (nur alte exakte Versions-Assertion entkoppeln)
- `docs/produktplan-beta.md` (nur Zeilen zu 023, takt-016, 025, 028, neue takt-019-Zeilen und Vertragsrisiko-Zeile)

## Tests zuerst und Akzeptanz

1. Ein fokussierter Vertragstest ist vor dem Edit von `openapi.yaml` rot: 0.3.3 fehlt, beide Ereignistypen fehlen, ihr `subjectId` und leerer Payload sind nicht gebunden. Danach ist er grün. `DebateClosed` darf eine HV nicht als `closed` beschreiben; Beschreibung und Test halten die Unterscheidung fest.
2. Keine Operation kommt hinzu; die Allowlist und 66 operationIds bleiben unverändert. Es werden keine Pflichtfelder in bestehenden Antworten oder Requests eingeführt. `pnpm contract:types` wird wiederholbar ausgeführt, `pnpm contract:lint` und `pnpm gates` bestehen.
3. Der Plan nennt 0.3.3 für diese Brücke, 0.3.4 für 028 und die Grenzen der öffentlichen Aktionen. Der Bericht nennt den sauberen Gate-Commit und enthält den wörtlichen Schluss von `pnpm gates`. Unabhängiges Review sieht Spec und Diff.

## Bericht

Slice: takt-019-meeting-lebenszyklus-vertrag

Done: Vertrag 0.3.3 enthält `MeetingStarted` und `MeetingClosed` mit `subjectId` und leerem Payload. `DebateClosed` bleibt vom Jahrgangsschluss getrennt. Der Plan setzt 028 auf 0.3.4; keine Operation kam hinzu.

Evidence: Der neue Vertragstest war zuerst 3/3 rot (Version und zwei Ereignisse), danach zusammen mit dem älteren Brückentest 7/7 grün. `pnpm contract:types` regenerierte die Typen; `pnpm contract:lint` bestand mit fünf bestehenden Warnungen. `node scripts/slice-scope.mjs --takt 019 --base 60d8081d6d69a3c5635252db22d8664780a54bd1` bestätigte 8/8 erlaubte Dateien. `pnpm gates` auf sauberem Commit `cd7fccc` bestand; Schluss wörtlich:

```text
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 721ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow-024/.claude/state/last-test-run (clean tree) at commit cd7fccc, tree b1048d5c10db…
```

Open: 025 implementiert Projektion und R-MTG. Eine öffentliche Jahrgangs-Schlussaktion braucht später eine eigene Spec und Vertragsänderung. Die Planzeile 040 nennt bisher allgemein „Lebenszyklus-Aktionen“; das unabhängige Review hat diese Unschärfe als nicht blockierenden Folgebefund notiert, außerhalb dieses Dateiumfangs. Kein Deployment.

Touched: `docs/slices/takt-019-meeting-lebenszyklus-vertrag.md`, `packages/contract/openapi.yaml`, `packages/contract/src/types.ts`, `packages/contract/CHANGELOG.md`, `packages/contract/package.json`, `apps/api/src/__tests__/takt-019-contract.test.ts`, `apps/api/src/__tests__/takt-016-contract.test.ts`, `docs/produktplan-beta.md`.

## Review findings

Unabhängiger frischer Review von `60d8081…cd7fccc`: keine Blocker/Major- oder Security-/Legal-/Privacy-Befunde; die Unschärfe der späteren 040-Planzeile ist unter „Open“ vermerkt.
