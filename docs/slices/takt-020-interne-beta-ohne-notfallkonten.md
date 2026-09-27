# takt-020 — Interne Beta mit echter Anmeldung, Notfallkonten danach

**Status:** geplant · **Risikoklasse:** mittel · **Lanes:** docs-plan, docs-register, infra (nur Planprüfung)
**Regeln:** AGENTS.md R1, R2, R3, R11, R12; B1, B14, ADR 0004, E11
**Entscheidung:** Der Eigentümer hat am 27.09.2026 festgelegt: Für den zunächst intern testbaren synthetischen Beta-Bereich sind Notfallkonten nicht nötig. Die Beta dient der Fortführungsentscheidung. Die Funktion bleibt ausdrücklich als späterer Ausbau sichtbar; ihr Fundament wird durch den Actor-Port, Ereignisse zur Rollenzuordnung und die von Rollen unabhängige Rechteprüfung angelegt.

## Ziel

1. B1 für den **internen Beta-Start** verlangt echte OIDC-Anmeldung gegen den Keycloak-Testrealm, sichere Dienstsitzung mit Subject-Sperre bei Geräteverlust, CSRF- und Demo-Verriegelung, Negativtests und Screenshot. Bei IdP-Ausfall kann sich niemand neu anmelden; das ist ein benannter Einschränkungs- und Testbefund, kein stiller Ersatz durch `X-Actor`. Notfallkonten mit Alarm und Ausfalltest bleiben für die spätere Fortführungsphase in 029.
2. Der Produktplan trennt 029b (Beta, 21.10.2026) und 029 (nach Beta-Entscheidung, frühestens 15.03.2027) auch im Kalender und in Abhängigkeiten. 030, 088, 064, 065, 072, 074 und 077 hängen für ihre Beta-Nachweise von 029b statt 029 ab. Der Chaos-Katalog meldet den IdP-Ausfall vor 029 als begrenzte Verfügbarkeit und testet keine fiktive Notfallanmeldung. `node scripts/plan-graph.mjs --strict` wird dadurch grün.
3. Plan und E11 nennen die bereits reservierten Grundlagen: `Actor`-Adapter-Port, `RoleAssigned`/`RoleRevoked` je Jahrgang, Rechte über `can()`, Subject-Sperre aus 029b und Alarmereignis-/Benachrichtigungs-Port aus 085. Keine Notfallkonto-Route, kein Geheimnis und keine UI-Schaltfläche wird als vorhanden bezeichnet. B14 und Runbook führen die spätere Prozedur als Entwurf, nicht als geübten Beta-Nachweis.

## Nicht-Ziele

Keine Auth-Implementierung in diesem Takt, kein produktiver Konzern-IdP, kein Notfallkonto, keine neue Umgehung von OIDC, keine Änderung an Rechten oder Vertrag, kein Deployment. 029b und 026 implementieren ihre eigenen Specs später tests-first.

## Files allowed

- `docs/slices/takt-020-interne-beta-ohne-notfallkonten.md`
- `docs/produktplan-beta.md` (nur B1/B14; Architektur-/ADR-/M2-/M5-/B-Listen-/Risikotext und Wochenübersicht zu Identität und Notfallkonten; 026, 029, 029b, 030, 064, 065, 070, 072, 074, 077, 079, 085, 088 und deren exakte Abhängigkeiten; Abschnitt 11 Beta-Pfad)
- `docs/entscheidungsregister.md` (nur E11 und seine direkten Referenzen)
- `docs/adr/0004-identitaet-oidc-bff.md` (nur Beta-Grenze, Adapter-Zeitpunkt und getrennte Nachweise gemäß E11)
- `scripts/plan-graph.mjs` (nur frühester Start für 029 nach der Fortführungsentscheidung)
- `scripts/plan-graph.test.mjs` (nur fokussierter Test des echten Plans unter `--strict` und 029-Kalendergrenze)

## Tests zuerst und Akzeptanz

1. Zuerst ein fokussierter Plan-Graph-Test, der `--strict` auf dem echten Plan ausführt und wegen 029/029b rot ist. Nach der Planentscheidung besteht er: keine fehlende Abhängigkeit, kein Zyklus, kein Reihenfolgefehler und keine Lane-Warnung. Ein zweiter roter Kalendertest verlangt für 029 einen berechneten Start frühestens am 15.03.2027; die Wochenübersicht W4 nennt 029b statt 029.
2. B1 ist intern ohne Notfallkonto erfüllbar und nennt den IdP-Ausfall als Einschränkung. Die Subject-Sperre aus 029b deckt den verlorenen Podiumsrechner in B15 und 078 ab. 029 ist ausdrücklich nach der Beta-Entscheidung und bleibt mit Eigentümer, Datum, Scheduler-Grenze, Test und reservierten Attributen erhalten. Keine vor der Beta liegende Scheibe hängt noch von 029 ab. E11, B14 und ADR 0004 widersprechen dieser Grenze nicht.
3. `pnpm gates` besteht auf sauberem Commit. Bericht nennt den Commit und den wörtlichen Schluss. Unabhängiges Review prüft Plan, Entscheidung und Diff. Kein Deploy.

## Bericht

Slice: takt-020-interne-beta-ohne-notfallkonten
Done: Die Eigentümerentscheidung vom 27.09. ist in B1, B14, E11 und im Beta-Pfad erfasst. 029b enthält sichere Anmeldung und die Subject-Sperre für verlorene Geräte; 029 enthält erst nach der Fortführungsentscheidung die zwei Notfallkonten mit Alarm. Vor-Beta-Abhängigkeiten auf 029 sind beseitigt. Der strikte Plan-Graph hat 87 Scheiben, 0 fehlende Abhängigkeiten, 0 Zyklen, 0 Reihenfolgefehler und 0 Lane-Warnungen.
Evidence: Fokussierter Test zuerst rot wegen 029/029b, danach 17/17 Skripttests grün. Unabhängiges Review: zwei Planhinweise zu B15 und Files allowed wurden behoben und eng nachgeprüft; keine P0/P1-, Security-, Legal- oder Privacy-Befunde. `pnpm gates` auf sauberem Commit `04a7e18` (Node 24, pnpm 10.33.0) endete wörtlich:

```text
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 726ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow/.claude/state/last-test-run (clean tree) at commit 04a7e18, tree 74c2e84e0fa8…
```

Open: Die Anmeldung, Subject-Sperre, das Runbook und die Chaos-Probe sind hier geplant, noch nicht implementiert. Notfallkonten und Ausfall-Alarm folgen in 029 nach der Fortführungsentscheidung. Kein Deployment.
Touched: `docs/slices/takt-020-interne-beta-ohne-notfallkonten.md`, `docs/produktplan-beta.md`, `docs/entscheidungsregister.md`, `scripts/plan-graph.test.mjs`.
