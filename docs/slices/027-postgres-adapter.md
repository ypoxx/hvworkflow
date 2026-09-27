# Scheibe 027 — Postgres nur anhängend, Migrationstor und Rebuild

**Status:** implementiert und unabhängig geprüft · **Lanes:** persist, service, infra
**Risikoklasse:** hoch
**Rolle:** Implementierer-Backend; unabhängiges Review in frischem Kontext mit Perspektive Betrieb, Konsistenz und Security
**Grundlage:** AGENTS.md R1–R12; `docs/produktplan-beta.md` §5.4/027; ADR 0001, 0003, 0009, 0011, 0013; Vertrag 0.3.4; Scheibe 026 ist mit PR #54 (`cb0f2bb`) integriert.

## Architekturentscheidung vor Bau

Der heutige `EventStore` und `Persistence.load/save` sind synchron; der Browser benötigt das für die Demo. Ein normaler Postgres-Treiber bestätigt Schreibvorgänge asynchron. Deshalb wird **kein** asynchroner Datenbankaufruf in den synchronen `save`-Port gepresst und kein Erfolg vor dem Commit zurückgegeben. Der Dienst bekommt eine asynchrone Anfragegrenze: Nach Authentifizierung lädt er für jede Postgres-Anfrage einen frischen Ereignis-Snapshot und baut daraus einen anfragelokalen In-Memory-Store samt `HvApi`. Der bestehende JSONL- und Browserpfad bleiben unverändert. `app.ts` nutzt im Postgres-Modus keine globalen `domain`-/`scopedDomains`-Projektionen über Anfragen hinweg.

Bei einem Schreibaufruf lautet die verbindliche Reihenfolge: `BEGIN` mit `READ COMMITTED` → transaktionsgebundener Advisory-Lock für das **globale** Log → Ereignisse geordnet laden und Kette prüfen → anfragelokalen Store/Projektion erzeugen → bestehende Domain-Operation ausführen → nur neue, bereits im Store gestempelte Ereignisse und abgeleitete Personenzeilen mit parametrisiertem SQL einfügen → `COMMIT` → erst dann 2xx und Benachrichtigung. Der `save`-Adapter puffert innerhalb der Anfrage nur die neuen Ereignisse; er behauptet keinen Datenbank-Commit. Anfragelokale Store-Listener dienen allein der internen Projektion und veröffentlichen nichts nach außen. Fehler oder eine Nicht-2xx-Antwort bewirken `ROLLBACK`, der anfragelokale Stand wird verworfen und keine neue Ereignisfolge veröffentlicht. Ein zweiter Prozess liest **nach** dem Lock unter `READ COMMITTED` den zuletzt bestätigten Tail, sodass er weder `seq` noch `prevHash` aus einem veralteten Snapshot vergibt. Lesen nutzt einen frischen, konsistenten DB-Snapshot; ein außerhalb der Dienstrolle verändertes Ereignis stoppt das Laden mit der betroffenen `seq`.

Der Dienst bewahrt die bisherige Idempotenz **innerhalb eines Prozesses** über Anfragen hinweg, ohne einen Cacheeintrag vor DB-Commit freizugeben; die persistente und prozessübergreifende Wiederholung folgt in 028. Die 026-Regel zum Rollenablauf bleibt maßgeblich (P2 in `docs/folgeliste.md`). Zwei Schreiber erhalten in 027 eine lückenlose, unveränderte Ereigniskette; Pflicht-`If-Match`, 412-Konfliktmodell und dauerhafte Idempotenz sind weiterhin Ziel von 028. Diese Grenze steht im Bericht und darf nicht als bereits geschlossen gelten.

## Ziel und Datenmodell

1. Postgres ist im Dienstmodus mit gesetzter DB-Konfiguration die Quelle der Wahrheit. `events` hat global lückenlose `seq` ohne PostgreSQL-Sequence/Identity, eine eindeutige Ereignis-ID, indexierte `meeting_id`, Hash und Vorgängerhash sowie den **vollständigen Ereignis-Umschlag als JSONB**. Der JSONB-Wert erhält alle optionalen v2-Felder und die ursprünglichen Zeit-Strings; aus typisierten Indexspalten allein wird kein Ereignis rekonstruiert. Bei jedem Laden werden `seq`, ID, `meeting_id`, Hash und Vorgängerhash der Indexspalten mit dem JSONB-Umschlag verglichen; keine abweichende Indexspalte darf eine Kettenprüfung umgehen. Nach Neustart werden `verifyEventChain` und die Jahrgangsprojektionen vor dem Bedienen von Fachanfragen ausgeführt. JSONL bleibt nur Entwicklungsadapter.
2. `persons` ist eine getrennte, je Jahrgang geschlüsselte, **aus bestätigten `SpeakerRegistered`-Ereignissen rekonstruierbare Projektion**: `(meeting_id, person_id)`, Klarname, optionale Organisation, `key_id`, Quell-`seq`. Die Zeile wird in derselben Transaktion wie das Quellereignis eingefügt; der Dienst gleicht Personen-Snapshot und Ereignisse beim Start und bei frischen Reads ab und nutzt die Tabelle für seine Namensauflösung. Fehlende, zusätzliche oder abweichende Zeilen führen zu einem Integritätsfehler und blockieren Fachzugriff; die Dienstrolle versucht keine Reparatur. Rebuild/Repair aus Ereignissen bleibt eine explizite Migration mit Migrationsrolle. Die Ereignisse bleiben die Autorität. In 026 liegen Klarnamen zusätzlich im ausdrücklich markierten `payload.pii`; der Beta-Identitätscodec verschlüsselt sie nicht. 027 behauptet daher keine Verschlüsselung oder namenfreie DB. Die spätere Krypto-/Aufbewahrungsentscheidung E16 bleibt offen.
3. Schema-Eigentümer und Laufzeitrolle sind getrennt. Die Laufzeitrolle erhält nur `SELECT`/`INSERT` auf `events` und `persons` sowie `SELECT` auf `schema_migrations`, kein `UPDATE`, `DELETE`, `TRUNCATE`, DDL, Eigentum oder geerbte Eigentümerrechte. Migrationen laufen ausschließlich mit einer separaten Migrationsrolle. SQL-Werte werden parametrisiert; Postgres-Fehler werden **vor** dem generischen HTTP-Fehlerhandler zu einem festen, nicht sensitiven Servicefehler normalisiert. Zugangsdaten und Treiberfehler gelangen weder in Problem-Details noch in Logs oder Testscreenshots. TLS-Konfiguration ist Teil des Anschlussports; Hosting/AVV und echte Credentials folgen E10/037 und werden hier nicht vorausgesetzt.
4. Ein versioniertes Migrationswerkzeug prüft den Stand vor Fachanfragen. Vorwärts- und Rückwärtslauf werden in CI gegen eine leere und eine **wegwerfbare gefüllte** Testdatenbank geprüft. Ein destruktiver Rückwärtslauf gegen gefüllte `events` wird abgewiesen; betriebliche Rückkehr erfolgt später per Backup/Restore aus 038, nie durch Löschen des Logs mit der Dienstrolle. Ein ausstehender oder unbekannter Migrationsstand blockiert Fachanfragen und macht den Dienst unbereit.
5. Der bereits in Vertrag 0.3.4 deklarierte öffentliche `GET /readyz` wird von 033 auf 027 vorgezogen. Vertrag 0.3.5 erlaubt additiv `not_configured` auch für `clock` (der allgemeine Code existiert schon); Changelog und generierte Typen werden mitgezogen. Er liefert exakt `clock`, `db`, `migrations`, `X-Server-Time`, 200 nur wenn alle Prüfungen `ok` sind, sonst 503 mit den erlaubten **Codes**, ohne Fehlertext oder Hostnamen. DB und Migrationsstand werden echt geprüft; ein injizierbarer Clock-Health-Port liefert bis zur NTP-Umsetzung in 033 im realen Server ehrlich `not_configured` statt eines erfundenen `ok`. Tests dürfen einen definiert gesunden Clock-Port injizieren, um DB-Fehler isoliert zu belegen. `/readyz` umgeht nur für diesen exakten Pfad die Authentifizierung; Fachrouten bleiben geschützt. Für Postgres-Integrationsprüfungen ist der bestehende Demo-Actor mit `HV_DEMO=1` und ausschließlich synthetischem Seed zulässig; dieser Seed muss in denselben Postgres-Store gelangen oder explizit deaktiviert sein, nie in ein getrenntes globales In-Memory-Log. `getHealth` und `getMetrics` bleiben in 033. Produktplan und Allowlist übertragen `getReadiness` ausdrücklich von 033 auf 027; danach entfernt 027 seinen eigenen Eintrag.

## Sicherheit und Missbrauchsfall vor Bau

**Betroffene Bedrohungen:** T-G2-T-02/T-03 (abgelehnter oder nur teilweise bestätigter Schreibvorgang), T-G2-T-01 und T-G2-R-01 (Manipulation und Wiederanlauf), T-G2-D-01/D-02 (DB/Migration unbereit), T-G2-E-01 (übermächtige Dienstrolle), T-G2-I-02 (Treiberfehler mit Inhalt), T-G2-S-01 (DB-Zugang). Nachweise: Rollback-/Neustarttest, Zwei-Prozess-`seq`/Hash-Test, echte Grant-Negativtests, 503-Readiness ohne Diagnosedaten. T-G2-S-01 und T-G2-I-02 bleiben bis 034/037 bzw. 033 teilweise offen; der externe Hash-Anker und Restore-Drill folgen in 038/051. Die T-G2-D-03-Last des vollständigen Log-Scans wird gemessen und in 071 weiter behandelt.

**MF-04, Datenbankmanipulation:** Ein privilegierter DB-Zugang ändert eine alte Ereigniszeile. Beim nächsten Start oder frischen Snapshot stoppt `verifyEventChain` mit `seq`; der Dienst liefert keinen fachlichen Stand aus einer gebrochenen Kette. Signal ist nur Integritätsfehler/`seq`, ohne Payload; Empfänger ist der technische Betrieb. Ein Superuser, der die gesamte Kette neu berechnet, bleibt bis zum externen Hash-Anker aus 038/051 eine offene Grenze.

## Nicht-Ziele

Keine echte Anmeldung (029b), kein persistentes Idempotenzregister oder Pflicht-`If-Match` (028), kein SSE-Adapter (035), kein Produktions-Deploy oder echte Personendaten, kein Backup-/Restore-Drill (038), keine Aufbewahrungs-/Kryptoentscheidung E16, kein NTP-Adapter oder Betriebsmetriken (033), keine Optimierung durch einen unbewiesenen prozessübergreifenden Cache.

## Files allowed

- `docs/slices/027-postgres-adapter.md`
- `docs/produktplan-beta.md` (nur Zuordnung von `/readyz` zwischen 027 und 033, ausdrückliche Ausnahme für diesen Allowlist-Eintrag und Verschiebung der 028-Vertragsversion auf 0.3.6)
- `docs/adr/0003-persistenz-ereignislog.md` (nur die transaktionale Anfragegrenze und Personenprojektion präzisieren)
- `apps/api/src/persistence/**` (neuer Postgres-, Migrations- und Readiness-Port samt Tests)
- `apps/api/migrations/**` (versionierte SQL-Migrationen und Rollen-Grants)
- `apps/api/src/app.ts` (nur anfragelokaler Postgres-Modus, Idempotenzcache nach Commit, `/readyz`)
- `apps/api/src/server.ts` (nur asynchrone DB-Initialisierung, Konfiguration und Readiness)
- `apps/api/src/problem.ts` (nur feste Sanitization von Postgres-Fehlern, falls der Fehlerpfad es benötigt)
- `apps/api/src/__tests__/postgres027.test.ts`
- `apps/api/src/__tests__/migrations027.test.ts`
- `apps/api/src/__tests__/readiness027.test.ts`
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur bisherige Versionsassertion von 0.3.4 auf 0.3.5 nach dem bewusst gebumpten Vertrag)
- `apps/api/src/__tests__/helpers.ts` (nur Operation-Coverage für `getReadiness`)
- `apps/api/package.json` (nur Treiber und Test-/Migrationsskripte)
- `pnpm-lock.yaml` (nur aus dem vorgenannten Manifest generiert)
- `package.json` (nur ein dediziertes Postgres-CI-Skript, falls benötigt)
- `.github/workflows/gates.yml` (nur Postgres-Service, Migration/Grant-/Integrationsgate für 027)
- `packages/domain/src/api.ts` (nur injizierbarer, bis Commit isolierter In-Process-Idempotenzcache, Personen-Snapshot-Port und Export der bestehenden Default-Clock-Injektionsstelle für `/readyz`)
- `packages/domain/src/__tests__/person-roles026.test.ts` (nur Regression der Namensauflösung mit Personen-Snapshot, falls nötig)
- `packages/domain/src/__tests__/api.test.ts` (nur Regression der Idempotenzcache-Injektion, falls nötig)
- `packages/contract/allowlist.json` (nur `getReadiness` von 033 auf 027 vorziehen und nach Implementierung entfernen)
- `packages/contract/openapi.yaml` (nur additive Clock-Code-Erlaubnis und beschreibende Zuordnung von `getReadiness` zu 027, Version 0.3.5)
- `packages/contract/package.json` (nur Version 0.3.5)
- `packages/contract/CHANGELOG.md` (nur Eintrag für 0.3.5)
- `packages/contract/src/types.ts` (nur aus Vertragsänderung generiert)

## Tests zuerst und Akzeptanz

1. Vor Implementierung laufen fokussierte Tests rot: zwei unabhängige Dienstinstanzen schreiben nach demselben Tail; der zweite wartet nachweislich auf den Advisory-Lock und liest anschließend unter `READ COMMITTED` den neuen Tail; `seq` und Hash-Kette bleiben nach Commit/Neustart lückenlos. Ein durch Constraint-/Verbindungsfehler gescheiterter Commit ändert weder DB noch sichtbare Projektion oder Idempotenzcache. Dienstrolle darf `UPDATE`/`DELETE` auf `events` und `persons` nicht ausführen; Migrationsrolle ist getrennt. Personentabelle und Sprecheransicht stimmen nach Rebuild überein; fehlende, zusätzliche und geänderte Personenzeilen blockieren. Ein manipuliertes gespeichertes Ereignis oder eine abweichende Indexspalte verhindert Fachzugriff und nennt nur `seq`. Ein provozierter Treiberfehler erscheint weder in Problem-Details noch im Log. Der bestehende JSONL-/Demo-Pfad bleibt grün.
2. Leere und gefüllte wegwerfbare DB durchlaufen die dokumentierten Vorwärts-/Rückwärtsprüfungen; destruktiver Down-Lauf auf gefülltem Log wird ohne Datenverlust abgewiesen. Eine 10 000-Ereignis-Rekonstruktion bleibt unter fünf Minuten, gemessen im CI-Service-Container und im Bericht beziffert. `/readyz` ist ohne Actor erreichbar, liefert mit gesund injiziertem Clock-Port 200 bei gesunder DB/Migration und 503 mit `db`/`migrations`-Code bei Ausfall/Rückstand; keine Diagnosedaten. Fachroute ohne Actor bleibt 401.
3. Tests und Vertrag zuerst; danach Implementierung. `pnpm gates` auf sauberem Commit, dedizierte echte Postgres-CI-Tests und vollständige E2E-Suite bei Browser-Verfügbarkeit. Unabhängiges Review in frischem Kontext mit Betrieb-/Security-Perspektive; Blocker/Major sowie jede Security-/Privacy-Frage vor Merge klären. Bericht nach AGENTS.md mit wörtlichem Gate-Schluss, Rebuild-Zeit, Bedrohungs-ID→Test, offener 028/033/038-Grenze und Dateiliste. Jeder Commit nennt „Scheibe 027“ und endet `[skip netlify]`; PR-Titel ebenfalls `[skip netlify]`. Kein Deploy.

## Bericht

Slice: 027-postgres-adapter

Done: Der Dienst liest pro Anfrage einen frischen Postgres-Snapshot und bestätigt Schreibantworten erst nach dem Commit. Ein globaler Advisory-Lock serialisiert Schreiber; Ereignisumschlag, Indexspalten, Hash-Kette und Personenprojektion werden beim Laden geprüft. Migrationswerkzeug, getrennte Laufzeitrolle und `/readyz` mit begrenzter Prüfzeit sind umgesetzt. Das unabhängige Review fand zwei P1-Befunde zu übermächtiger Laufzeitrolle und hängender Readiness; beide wurden behoben und eng nachgeprüft. Das PR-Review fand danach einen jahrgangsübergreifenden Idempotenzkonflikt; ein roter Regressionstest, ein Postgres-HTTP-Test und kollisionsfreie Tupelkodierung schließen ihn einschließlich Trennzeichen im Schlüssel.

Evidence: `pnpm gates` auf sauberem Commit `7f3a2b1` (Exit 0), wörtlicher Schluss:

```text
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 424ms
mark-test-run: wrote /Users/alex/Documents/Codex/2026-09-26/prior-conversation-with-codex-conversation-role/work/hvworkflow-024/.claude/state/last-test-run (clean tree) at commit 7f3a2b1, tree 13dcfbb1a690…
```

Die echte Postgres-CI prüfte Migrationen, Grants und 18 Integrationstests; der 10.000-Ereignisse-Rebuild dauerte im CI-Service-Container 2.573,1 ms (Grenze fünf Minuten). Die vollständige lokale Chromium-E2E-Suite bestand mit 123/123 Tests. Der explizite Scope-Check meldete alle 24 geänderten Dateien innerhalb „Files allowed“; die Liste wurde nach dem ersten Spec-Commit für den Versions-Test und die Uhr-Injektionsstelle präzisiert. Für diese Backend-Scheibe ist kein Interface-Screenshot erforderlich.

Bedrohungs-ID → Test: T-G2-T-02/T-03 → Rollback, zwei unabhängige Schreiber und lückenlose Hash-Kette in `postgres027.test.ts`. T-G2-T-01/T-G2-R-01 → beschädigte Umschläge, Indexspalten und Personenzeilen sowie Rebuild in `postgres027.test.ts`. T-G2-D-01/D-02 → ausstehende Migration, ausgefallene DB und Timeout in `readiness027.test.ts`; Vorwärts-/Rückwärtslauf in `migrations027.test.ts`. T-G2-E-01 → Laufzeit-Grants und Ablehnung des Owner-Pools in `migrations027.test.ts` und `postgres027.test.ts`. T-G2-I-02 → provozierter DB-Fehler ohne Inhalt in Antwort oder Dienst-Log in `postgres027.test.ts`. T-G2-S-01 → getrennte Laufzeitrolle und Konfiguration in `server.ts`; echte Secrets, TLS und Hosting-Härtung folgen in 034/037. T-G2-D-03 → gemessener 10.000-Ereignisse-Rebuild; Lastoptimierung folgt in 071.

Open: 028 ergänzt Pflicht-`If-Match`, persistente Idempotenz und Claim/Lease; bis dahin gilt die Wiederholungsgarantie nur innerhalb eines Dienstprozesses. 033 ergänzt NTP, Health und Metriken; ohne konfigurierten Clock-Health-Port meldet `/readyz` ehrlich `not_configured`. 038 führt den Restore-Drill und den externen Hash-Anker aus; eine vollständig neu berechnete Kette durch einen Superuser ist bis dahin nicht erkennbar. E16 (Krypto/Aufbewahrung) sowie echte Zugänge und AVV bleiben offen. Der P2-Hinweis aus dem Review: Der Readiness-Timeout begrenzt die Antwortzeit, bricht eine hängende SQL-Abfrage aber noch nicht ab; die Pool-Auslastung bei wiederholten hängenden Probes gehört in die gebündelte Nacharbeit. Kein Deploy.

Touched: `.github/workflows/gates.yml`; `apps/api/migrations/0001_event_log.{up,down}.sql`; `apps/api/package.json`; `apps/api/src/{app.ts,server.ts,persistence/{postgres.ts,migrations.ts,migrate-cli.ts},__tests__/{postgres027.test.ts,migrations027.test.ts,readiness027.test.ts,takt-019-contract.test.ts}}`; `docs/adr/0003-persistenz-ereignislog.md`, `docs/produktplan-beta.md`, diese Spec; `packages/contract/{CHANGELOG.md,allowlist.json,openapi.yaml,package.json,src/types.ts}`; `packages/domain/src/api.ts`, `packages/domain/src/__tests__/api.test.ts`; `pnpm-lock.yaml`.
