# 024 — Ereignis-Umschlag v2

**Status:** gebaut · Review R1 geschlossen · PR-P2 nachgearbeitet · erneute CI offen
**Risikoklasse:** hoch · 2,5 AStd · M2 · Lanes: core, service, web-api, web-shell, i18n, e2e
**Rolle:** Architekt (Umschlag-Design) und Implementierer-Backend; unabhängiges Review mit Security- und Datenschutzperspektive
**Rule ids:** AGENTS.md Regeln 1, 2, 6, 7, 8, 10 und 12; ADR 0002, 0009, 0011
**Quellen-IDs:** Produktplan 5.4 Scheibe 024; Vertrag 0.3.0 `Event`, `PiiEnvelope`, `OccurredAtSource`, `RetentionClass`
**Depends on:** 015, 023, 080 (gemergt)
**Perspektive:** Integrität des Ereignislogs und Trennung der maßgeblichen Serverzeit von Angaben der Quelle
**Bedrohungs-IDs (Bedrohungsmodell Abschnitt 6):** schließt im Umfang dieser Scheibe T-G2-S-02, T-G2-T-01 und T-G1-T-07; berührt T-G1-T-02, T-G2-I-01 und T-G2-R-01. **Missbrauchsfall:** MF-04 (Abschnitt 7).
**Glossar: neue Begriffe:** nein

## Bedrohungen, Erkennung und Nachweise

| ID | Beitrag dieser Scheibe | Test |
|---|---|---|
| T-G2-S-02, T-G2-T-01 | V2-Kette, Struktur- und Versionsprüfung vor jeder Projektion; nachträglich veränderte Zeilen lassen den Start mit der ersten betroffenen `seq` scheitern. | `packages/domain/src/__tests__/envelope.test.ts`: „rejects a mutated persisted event“, „rejects gaps, swapped events“ und „accepts only a complete legacy prefix“; `apps/api/src/__tests__/eventLog024.test.ts`: ungültige Zeile und beschädigte Kette. |
| T-G1-T-07 | `recordedAt` kommt aus der injizierten Uhr; eine spätere Quellenzeit wird abgelehnt. | `envelope.test.ts`: „keeps a device time separate“ und „carries the write idempotency key … injected clock“. |
| T-G1-T-02 | Der Umschlag setzt eigene Felder aus benannten Werten; die Payload-Bereinigung bleibt außerhalb von 024. | `envelope.test.ts`: „stamps a portable hash chain“; vollständige Payload-Abwehr bleibt nach Bedrohungsmodell offen. |
| T-G2-I-01 | `payload.pii` durchläuft den Codec-Port; der Beta-Codec ist ausdrücklich nur identisch. Keine Verschlüsselung oder Pseudonymisierung in 024. | `envelope.test.ts`: „encodes only payload.pii“. |
| T-G2-R-01, MF-04 | Ein Hash-, Vorgänger-, Sequenz- oder Versionsfehler ist ein Startfehler mit `seq`; JSONL-Strukturfehler nennen die physische Zeile. | `envelope.test.ts`: Manipulations-, Lücken- und Versionsfälle; `eventLog024.test.ts`: defekte JSONL-Zeilen und Neustart. |

**MF-04-Erkennung und Empfänger:** Schwelle ist ein einziger Integritätsfehler. Der Start des Dienstes scheitert vor der Projektion und nennt nur `seq` beziehungsweise Zeile, keine Nutzdaten. Im Dev-Betrieb empfängt die ausführende Betriebsperson den Startfehler und eskaliert einen Manipulationsverdacht an Security; bei möglichem Personenbezug wird Datenschutz einbezogen. Sofortmaßnahme: Log unverändert sichern, keinen Neu-Hash und keine automatische Reparatur ausführen, Restore und externen Hash-Anker vergleichen. Für Staging muss 037 den fehlgeschlagenen Start/Health-Check an den Betriebsdienst alarmieren; ein automatisierter Alarm ist mit 024 noch nicht vorhanden. Ein vollständiges Neu-Hashen der Kette bleibt bis zum externen Anker aus 051/081 ein Restrisiko (RR-01).

## Ziel

1. Jeder neue Schreibvorgang erzeugt einen vollständigen v2-Umschlag: `schemaVersion: 2`, `prevHash`, `hash`, `recordedAt`, `occurredAt`, `occurredAtSource`, `retentionClass`, `legalHold: false` und die bestehenden Felder. `at` bleibt gleich `recordedAt`. Das Akteur-Objekt im Ereignis enthält keine `displayName`-Eigenschaft. `idempotencyKey`, `causationId`, `personId` und `meetingId` werden übernommen, wenn der Schreibweg sie kennt. `meetingId` wird erst mit 025/028 verpflichtend; der Vertrag 0.3.0 lässt es hier absichtlich optional.
2. `recordedAt` stammt aus der für den Schreibweg injizierten Uhr. Für Quelle `server` ist `occurredAt` derselbe Zeitpunkt. Für `device`, `paper` oder `transcript` bleibt die angegebene Zeit separat; eine Angabe nach `recordedAt` wird mit einem fachlichen Fehler abgelehnt. Der Kern nutzt keine eigene Systemuhr. Die Demo-Uhr ist die injizierte Browser-Uhr, der Dienst nutzt seine injizierte Server-Uhr.
3. `hash` ist der SHA-256-Wert des vollständigen Ereignisses ohne `hash` als kanonisches UTF-8-JSON mit rekursiv lexikografisch sortierten Objekt-Schlüsseln, unveränderter Array-Reihenfolge und ohne `undefined`-Eigenschaften. Hex-Zeichen sind klein. Das erste Ereignis hat `prevHash: ''`; danach ist `prevHash` der Vorgänger-Hash. Beim Laden prüft der Speicher die lückenlose globale `seq`, den Vorgänger, den Hash und die Zeitinvarianten, bevor ein Ereignis projiziert wird. Ein Fehler nennt die erste betroffene `seq` und lässt den Start scheitern. Der Hash wird synchron mit einer browser- und nodefähigen SHA-256-Implementierung berechnet; keine asynchrone Änderung des `EventStore`-Ports.
4. Ein kleiner PII-Codec-Port verarbeitet nur `payload.pii` und erhält den Schlüsselbezeichner je Jahrgang. Die Beta-Implementierung ist ein Identitäts-Codec; sie gibt das Feld samt `keyId` unverändert zurück. Der Port lässt später einen verschlüsselnden Codec zu. Die heutige `SpeakerRegistered.payload.displayName` bleibt bis 026 als synthetischer Demo-Bestand bestehen; 024 behauptet noch keine Pseudonymisierung.
5. Nur der JSONL-Dev-Adapter liest v1-Zeilen: Beim Laden werden sie deterministisch im Speicher zu v2 normalisiert und mit den nachfolgenden v2-Zeilen als eine Kette geprüft. Die vorhandenen JSONL-Zeilen werden nicht umgeschrieben; neue Zeilen sind v2. Ein historisches v1-Ereignis ohne Hash kann vor dem ersten v2-Ereignis nicht nachträglich auf Manipulation geprüft werden. Ungültige JSONL-Daten führen zu einem Ladefehler mit Zeilennummer beziehungsweise `seq`.
6. Der Browser übernimmt kein altes `localStorage`-Protokoll. Erkennt der Demo-Adapter ein v1-Protokoll, zeigt der Boot-Vorgang einen verständlichen Reset-Hinweis auf Deutsch und Englisch mit ausdrücklich betätigter Reset-Aktion. Er löscht den alten Bestand nicht automatisch. Danach lädt der synthetische Korpus neu. Ein korruptes v2-Protokoll wird nicht stillschweigend als leerer Bestand behandelt.

## Nicht-Ziele

- Kein Postgres-Adapter, keine Migration, keine globale `meetingId`-Pflicht (025/027/028).
- Keine persistierte Idempotenz oder neue If-Match-Pflicht (028).
- Keine Personentabelle und kein Entfernen von Klarnamen aus bestehenden Payloads (026).
- Keine Änderung am OpenAPI-Vertrag, an der Ereignis-Zustandstabelle oder an produktiven Beständen.
- Keine Echtdaten, Zugangsdaten oder Bereitstellung.

## Files allowed

- `docs/slices/024-ereignis-umschlag-v2.md` und `docs/produktplan-beta.md` (nur die Lanes der 024-Zeile)
- `packages/domain/src/events.ts`, `packages/domain/src/store.ts`, `packages/domain/src/api.ts`, `packages/domain/src/seed.ts`, `packages/domain/src/index.ts`, neue `packages/domain/src/envelope.ts`, `packages/domain/src/piiCodec.ts` und fokussierte Tests unter `packages/domain/src/__tests__/`
- `packages/domain/package.json` und `pnpm-lock.yaml` nur für eine synchrone, browserfähige SHA-256-Abhängigkeit
- `apps/api/src/eventLog.ts` und fokussierte Tests unter `apps/api/src/__tests__/`
- `apps/web/src/api/index.ts`, `apps/web/src/app/App.tsx`, `apps/web/src/app/BootScreen.tsx`, `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts`, `apps/web/e2e/024-ereignis-umschlag.spec.ts` und `apps/web/e2e/020-rueckbau-passung.spec.ts` (nur die Fixture `EMPTY_MEETING_LOG` auf v2 umstellen)
- `apps/web/src/i18n/parity.test.ts` ausschließlich für den Kommentar und die drei Gesamtzahl-Erwartungen von 460 auf 463 wegen der drei neuen `boot.legacy.*`-Schlüsselpaare
- `docs/evidence/024-*.png` für den sichtbaren Reset-Hinweis

Die erweiterten Lanes beheben eine Lücke in Plan 5.4: JSONL-Replay liegt im Dienst, der Reset-Hinweis in Web-Shell und i18n. Die Planzeile wird vor dem Bau entsprechend berichtigt.
Die bestehende 020-E2E-Fixture legt ein v1-Protokoll ab und erwartet einen normalen Start. Mit Ziel 6 wäre das ein Reset-Fall. Die Fixture wird deshalb in derselben Scheibe zu v2; die neuen 024-E2E-Tests prüfen den v1-Reset ausdrücklich. Andere 020-Szenarien bleiben unverändert.
Der Paritätstest fixiert die bisherige Gesamtzahl 460. Die drei zweisprachigen Reset-Hinweis-Schlüssel erhöhen sie auf 463; nur diese mechanische Erwartungsanpassung ist für das i18n-Tor zulässig.

## Akzeptanzkriterium

1. Die neuen Tests laufen zuerst rot und danach grün. Sie prüfen kanonische Schlüsselreihenfolge und Unicode, Genesis und Kette, Manipulation/Lücke/Vertauschung mit Fehler-`seq`, getrennte Zeiten sowie Zukunftsabwehr, optionalen PII-Codec, Replay eines reinen und gemischten JSONL-Logs und den Reset-Hinweis im Browser.
2. Ein HTTP-Ereignis ist stets v2 und entspricht dem vorhandenen Vertrag. Der Dev-Adapter schreibt nur neue v2-Zeilen; ein Neustart projiziert denselben Stand.
3. Der i18n-Paritätstest prüft 463 Schlüssel in Deutsch und Englisch. `pnpm gates` ist grün; der Bericht nennt Commit und wörtlichen Schluss. Die vollständige e2e-Suite ist grün; Screenshot des Reset-Hinweises liegt in `docs/evidence/`.
4. Das unabhängige Review nennt offene Integritäts-, Security- oder Datenschutzbefunde; diese werden vor Merge geschlossen.
5. Für JSONL wird jede Zeile vor dem Cast auf gemeinsame Pflichtfelder geprüft. Als v1 gilt nur ein vollständiges Ereignis ohne v2-Felder mit fehlender Version oder Version 1; unbekannte Versionen und Halb-Umschläge brechen mit Zeile beziehungsweise `seq` ab.
6. Auch der Browser bietet Reset nur für ein vollständiges v1-Protokoll ohne v2-Felder an; ein manipulierter v2-Umschlag führt zum Startfehler. JSONL-v2 mit `actor.displayName` scheitert selbst bei neu berechnetem, konsistentem Hash.

## Nachweise

Roter/grüner Testlauf, Hash-Testvektoren, JSONL-Neustart, Browser-Screenshot DE/EN, vollständige e2e-Suite, `pnpm gates`-Schluss, unabhängiges Review.

## Arbeitsweise

Tests zuerst. Jeder Commit nennt „Scheibe 024“ und endet mit `[skip netlify]`. Kein Deploy. Nur die oben erlaubten Dateien.

## Bericht

Slice: 024-ereignis-umschlag-v2
Done: Der v2-Umschlag, die Hash-Kette, getrennte Zeiten, JSONL-Replay und der ausdrückliche Demo-Reset sind umgesetzt. Die drei Befunde des unabhängigen Reviews und beide P2-Fälle des PR-Reviews sind mit Regressionstests geschlossen. Die Branch-Historie enthält den von Gitleaks beanstandeten synthetischen Testwert nicht mehr.
Evidence: `pnpm gates` auf sauberem Commit `2069ed5` grün (wörtlicher Schluss unten); volle lokale Chrome-E2E-Suite 123/123 grün, axe ohne serious/critical; `docs/evidence/024-reset-de.png` und `docs/evidence/024-reset-en.png`.
Open: Erneute PR-CI auf der bereinigten Branch-Historie steht aus; kein Deploy. Der automatische Betriebsalarm für MF-04 folgt in 037.
Touched: `packages/domain/src/{events,store,api,index,envelope,piiCodec}.ts`, `packages/domain/src/__tests__/envelope.test.ts`, `packages/domain/package.json`, `apps/api/src/{eventLog.ts,__tests__/eventLog024.test.ts}`, `apps/web/src/{api/index.ts,app/App.tsx,app/BootScreen.tsx,i18n/shell.de.ts,i18n/shell.en.ts,i18n/parity.test.ts}`, `apps/web/e2e/{020-rueckbau-passung,024-ereignis-umschlag}.spec.ts`, `docs/evidence/024-reset-{de,en}.png`, `docs/produktplan-beta.md`, diese Spec und `pnpm-lock.yaml`.

Wörtlicher Schluss von `pnpm gates` (Node 24, Commit `2069ed5`):

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 393ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow-024/.claude/state/last-test-run (clean tree) at commit 2069ed5, tree 493bec107c99…
```

## Review findings

- **R1 Hauptbefund, SP-6/SC-06:** Hochrisiko-Spec ohne verbindliche Bedrohungs-IDs und MF-04-Signal/Empfänger. IDs, Testzuordnung und der noch offene automatische Betriebsalarm sind oben dokumentiert.
- **R1 Hauptbefund, JSONL-Struktur:** Syntaktisch gültige Zeilen ohne `actor`, `id`, `type` oder `subjectId` konnten als Ereignisse gelesen werden. Der Dev-Adapter prüft jetzt gemeinsame Pflichtfelder je physischer Zeile; Negativtests decken fehlende und unbekannte Felder ab.
- **R1 Blocker, Versions-Downgrade:** `schemaVersion !== 2` wurde pauschal als v1 neu gehasht. Nur vollständige v1-Zeilen ohne v2-Felder mit fehlender Version oder Version 1 werden jetzt upgecastet; unbekannte Versionen und Halb-Umschläge scheitern. Regressionsfälle stehen in `envelope.test.ts`.
- **Enge unabhängige Nachprüfung:** alle drei Befunde geschlossen; Domain 10/10 und API 3/3 fokussierte Tests grün. Kein Push, PR oder Deploy aus dem Bau-Worktree.
- **PR-Review P2, Browser-Downgrade:** Ein v2-Ereignis mit fehlender oder geänderter `schemaVersion` wurde als Altbestand mit Reset-Aktion gezeigt. `isLegacyEventShape` erlaubt die Reset-Aktion nur für vollständige v1-Zeilen ohne v2-Felder; die neuen 024-E2E-Fälle prüfen beide Manipulationen als Integritätsfehler.
- **PR-Review P2, Datenschutz im JSONL-Replay:** Ein v2-Ereignis mit `actor.displayName` und konsistent neu berechnetem Hash wurde projiziert. Die Kettenprüfung verwirft das Feld jetzt ausdrücklich; der neue `eventLog024.test.ts`-Fall prüft den Ladefehler mit `seq`.
- **PR-CI gitleaks:** Der längere synthetische Idempotenz-Testwert löste die generische Schlüsselerkennung aus. Die Fixture nutzt nun `x`; die Branch-Historie wird vor erneutem Push ab der Integrationsbasis neu aufgebaut, damit der alte Testwert in keinem PR-Commit steht.
