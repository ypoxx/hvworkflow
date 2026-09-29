# Scheibe 033a — Serverzeit-Header, Health, NTP-Status, Korrelations-ID und Zugriffslog

**Status:** spec
**Risikoklasse:** hoch · 1,25 AStd · 26.10.2026 (W5) · Lanes: service, infra, docs-adr, docs-datenschutz, docs-sicherheit
**Rolle:** Implementierer-Backend; unabhängiges Review in frischem Kontext mit Perspektive Datenschutz/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-05, SC-06, SC-11, SP-2, SP-5, SP-6) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel und keine Änderung an `ROLE_PERMISSIONS` oder der Übergangstabelle; AGENTS.md R4 (Rechte), R6 (Vertrag zuerst), R7 (nur anhängen), R8 (Zeit aus der injizierten Uhr), R11 (keine echten Daten)
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/033a (Teil 1 der am 29.09.2026 geteilten Scheibe 033); ADR 0013, ADR 0011 (Serverzeit), ADR 0015 (Vertragsversion); DSFA-Vorentwurf Zeilen „Technisches Zugriffslog“ und V10; Bedrohungsmodell Abschnitt 6 Zeile 033; Leitplanken 6.6 und 6.7
**Depends on:** 023, 027, 029b (alle gemergt); baut auf dem Integrationsstand `93a786d` auf. Offene Takte takt-023 (Vertrag 0.3.8, `app.ts`) und takt-024 (Postgres-Grenze je Route in `app.ts`) sind vor dem Bau zu prüfen (siehe „Vor dem Bau prüfen“).
**Perspektive:** Datenschutz/Betrieb · **Glossar: neue Begriffe:** nein (Zugriffslog, Vorgangshistorie, Auswertungskatalog stehen in ADR 0013)

## Warum geteilt

Der Planeintrag 033 bündelte sieben Teile (Zugriffslog, `/healthz`, NTP-Status, `/metrics` mit fünf Kennzahlen, Allowlist-Tor, Auswertungskatalog, Verfahren aus ADR 0013). Das sind zwei getrennt prüfbare Datenschutzflächen: ein **Protokoll je Anfrage** mit pseudonymem Personenbezug (033a) und **Aggregate ohne Personenbezug** mit eigenem Tor und CI-Artefakt (033b). Zusammen liegen sie über einer Agentenschicht, und ein Review mit Perspektive Datenschutz müsste zwei verschiedene Fragen in einem Diff prüfen. 033a enthält alles, was an der Anfragegrenze in `app.ts`/`server.ts` sitzt; 033b fügt eine Route, eine reine Kernfunktion und ein Tor hinzu. 032 braucht nur den Header aus 033a, 034 und 037 hängen an 033b.

## Ziel und Entscheidungen vor Bau

Offene Punkte sind auf Standard gebaut und als solche markiert; eine abweichende Entscheidung des Eigentümers ist Konfiguration oder eine Folgescheibe, keine stille Änderung im Bau.

1. **`X-Server-Time` auf jeder Antwort.** Eine äußerste Middleware (vor CORS, Auth und Postgres-Grenze) setzt nach `await next()` den Header aus der injizierten Uhr (`options.clock ?? systemClock`), RFC 3339 UTC. Das gilt für 2xx, 3xx (`/auth/callback`), 4xx, 5xx, `notFound`, `onError` und die von der Postgres-Grenze ersetzte Antwort (`c.res = problemResponse(...)`). Hat ein Handler den Header schon gesetzt (`/readyz`: Header und `serverTime` im Body aus **einer** Uhrlesung), bleibt er unverändert. Die bisherigen Einzelsetzungen (`authResponseHeaders`, `onError` für `/auth/*`, `/readyz`, Transparenzhinweis) dürfen entfallen, sofern die Tests unverändert grün bleiben. Die Zeit einer Anfrage (`Date`-Header des Clients) wird nie gelesen. CORS im Demo-Modus erhält `X-Server-Time` in `exposeHeaders`, damit 032 den Offset im Vite-Dev-Server lesen kann. Keine Vertragsänderung: der Header ist seit 0.3.0 auf jeder Antwort deklariert und optional.
2. **`GET /healthz`** (Liveness, `getHealth`): ohne Anmeldung, exakter Pfadvergleich in der Auth-Ausnahme wie bei `/readyz`, Antwort `200 {"status":"ok"}` ohne weitere Felder, keine Abhängigkeit von Datenbank, Uhr oder NTP; kein 503 in 033a (Liveness heißt „der Prozess antwortet“). Der Eintrag `getHealth` wird aus `packages/contract/allowlist.json` entfernt (Ausnahme zur Lane-Regel „Feld `slice` = eigene Nummer“: der Eintrag trägt `033`, die Teilung weist ihn 033a zu).
3. **NTP-Status in `/readyz`.** Neuer Port `apps/api/src/clock/ntp.ts`: minimaler SNTP-v4-Client über `node:dgram`, **keine neue Abhängigkeit** (Standard; SC-10). Konfiguration `HV_NTP_SERVERS` (kommagetrennt `host[:port]`), `HV_CLOCK_MAX_DRIFT_MS` (Standard 1000, erlaubt 50–60000). Ablauf: Server der Reihe nach, je Server höchstens 1500 ms (unter den 2000 ms von `safeCheck`); gültig ist nur eine Antwort mit Modus 4, Stratum 1–15, Leap-Indikator ≠ 3, passender Absenderadresse und -port und einem Originate-Zeitstempel gleich dem eigenen Transmit-Zeitstempel (gegen untergeschobene Antworten). Offset = ((t2 − t1) + (t3 − t4)) / 2 mit t1/t4 aus der injizierten Uhr. Abbildung auf die vorhandenen Codes: kein `HV_NTP_SERVERS` → `not_configured` (heutiges Verhalten); keine Antwort in der Frist → `timeout`; ungültige oder unsynchronisierte Antwort, DNS- oder Socketfehler → `clock_unsynced`; |Offset| > Grenze → `clock_drift`; sonst `ok`. Kein Hostname, keine IP und kein Offsetwert im Body (`ReadinessCheck` ist geschlossen). **Zwischenspeicher 30 s** mit genau einer laufenden Abfrage: `/readyz` ist öffentlich, beliebig viele Aufrufe lösen höchstens eine NTP-Abfrage je 30 s aus. Der Dienst korrigiert seine Uhr nicht selbst (Nicht-Ziel); `/readyz` meldet nur. Verdrahtung: neue Option `clockHealth?: () => Promise<ReadinessCheck>` in `CreateAppOptions`, genutzt von den Standardprüfungen; `server.ts` baut den Port aus der Umgebung. Die bestehende Option `readiness` (Tests) bleibt.
4. **Korrelations-ID.** Je Anfrage erzeugt der Dienst eine ID (`crypto.randomUUID()`), unabhängig von jedem Client-Header; ein eingehender `X-Request-Id` wird nicht übernommen (Standard: keine vom Client gewählten Werte im Log; ein vorgeschalteter Proxy kommt mit 037). Die ID steht im Zugriffslog, im Fehlerlog und in Problem-Details als `instance: "urn:hv:request:<id>"` (Feld existiert im Vertrag, keine Vertragsänderung). Kein neuer Antwortheader (er wäre nicht vertraglich deklariert).
5. **Zugriffslog (Ebene 2 aus ADR 0013).** Genau eine JSON-Zeile je Anfrage mit **exakt** diesen Schlüsseln: `v` (1), `ts` (Antwortzeit aus der injizierten Uhr), `requestId`, `subjectHash` (Zeichenkette oder `null`), `operationId` (Zeichenkette oder `null`), `status` (Ganzzahl), `latencyMs` (Ganzzahl), `seq` (höchste in dieser Anfrage bestätigte `seq` oder `null`). Nie: Pfad, Query, Header, Body, Fragetext, Klarname, IP-Adresse, User-Agent, Fehlermeldung. `operationId` kommt aus dem Vertrag (Methode + getroffene Route), `null` bei unbekannter Route; die Ermittlung gilt auch für Routen ohne `validateOperation` (Alias-GETs, `/readyz`, `/healthz`, `/auth/*`). `subjectHash` = base64url(HMAC-SHA-256(Schlüssel, `actor.id`)) nur für Anfragen, die die Authentifizierung bestanden haben; sonst `null`. `seq`: im Postgres-Pfad die höchste `seq` der nach `COMMIT` eingefügten Ereignisse, im JSONL-/In-Memory-Pfad die höchste neu angehängte `seq` der Anfrage; ohne neues Ereignis und bei Rollback `null`. Die Latenz misst eine injizierte monotone Quelle (`monotonic?: () => number`); `server.ts` verdrahtet `performance.now()` mit `// now-ok:`-Kommentar (dort erlaubt), ohne Injektion fällt `app.ts` auf Differenzen der injizierten Uhr zurück. Geschrieben wird im `finally` der äußersten Middleware, also auch bei geworfenem Fehler.
6. **Eigene Senke und Aufbewahrung.** Port `AccessLogSink` mit zwei Adaptern: `memory` (Tests) und `file`: Verzeichnis `HV_ACCESS_LOG_DIR`, je UTC-Tag der injizierten Uhr eine Datei `access-YYYY-MM-DD.jsonl`, Modus 0600, Anhängen mit `O_APPEND`. `HV_ACCESS_LOG_RETENTION_DAYS` (Standard 30, erlaubt 1–365; E16). Die Datei des Tages D wird gelöscht, sobald heute > D + Aufbewahrung ist (Einträge bleiben mindestens die volle Frist erhalten); geprüft beim Start und beim ersten Schreiben eines neuen Tages. Gelöscht werden nur reguläre Dateien, die exakt dem Muster entsprechen (`lstat`, keine Symlinks, keine fremden Dateien). Die Senke ist getrennt vom Prozesslog (stdout/stderr) und von der Vorgangshistorie. **Nicht abschaltbar:** außerhalb von `HV_DEMO=1` verweigert der Start ohne gültiges, beschreibbares `HV_ACCESS_LOG_DIR` oder ohne `HV_ACCESS_LOG_HASH_KEY` (mindestens 32 Byte, base64) mit einem festen Satz ohne Wert. Im Demo-Modus ohne Verzeichnis nutzt der Dienst eine verworfene Senke, der Schlüssel ist dann je Prozess zufällig (synthetische Daten, keine Verknüpfung über Neustarts). Die Prüfung liegt in einer testbaren Funktion `apps/api/src/observability/config.ts` (034 übernimmt sie in das zod-Schema). **Schreibfehler der Senke:** die Anfrage wird trotzdem beantwortet (Standard „fail-open“: die HV-Verfügbarkeit geht vor dem technischen Log), je Minute höchstens eine feste stderr-Zeile ohne Inhalt; Alarmierung folgt in 037 (offen, im Bericht nennen).
7. **Fehlerlog ohne Nutzdaten.** `problem.ts` schreibt bei unerwarteten Fehlern statt des vollständigen Fehlerobjekts genau eine JSON-Zeile `{"log":"error","ts","requestId","errorClass"}` über `console.error` (damit die bestehenden Spies in `postgres027.test.ts` und `readiness027.test.ts` ihre Bedeutung behalten); keine Meldung, kein Stack mit Meldungszeile, keine Treiberdetails. Der Aufrufer erhält weiter den festen 500-Text.
8. **Verfahren „Auswertung des Zugriffslogs nur zu zweit“** als neuer Abschnitt in ADR 0013 (Status bleibt „vorgeschlagen“, Nachweis-Abschnitt ergänzt): Anlass (Störung, Sicherheitsvorfall, Betroffenenauskunft), zwei benannte Personen aus getrennten Funktionen (Betrieb und eine vom Eigentümer benannte Kontrollperson, Standard: DSB oder Stellvertretung; Betriebsrat nach E13), schriftlicher Zweck und Frist vor dem Zugriff, gemeinsamer Zugriff nur auf die für den Zweck nötigen Tagesdateien, keine Rückführung eines `subjectHash` auf eine Person ohne diesen Vorgang, Protokoll außerhalb des Repositoriums in der Betriebsakte des Eigentümers. Bis 047 ist das Verfahren **organisatorisch**; die technische Sperre (`AuditAccessGranted`, 403 ohne zweite Freigabe) liefert 047. Keine Kennzahl und kein Werkzeug in 033a wertet das Log aus.
9. **DSFA-Vorentwurf:** Zeilen „Technisches Zugriffslog“ und V10 beschreiben die Aufbewahrung des `subjectHash`: nur im Zugriffslog, gelöscht mit der Tagesdatei nach der Frist; pseudonymes Datum im Sinne der DSGVO, weil der Schlüssel in der Plattform liegt und die Actor-ID über die Rollenzuordnung einer Person zugeordnet werden kann; Schlüsselwechsel macht alte Werte unverknüpfbar (Standard: kein automatischer Wechsel in der Beta, Wechsel ist eine Betriebsentscheidung); kein Klartext-Subject, keine E-Mail, keine IP-Adresse. Rechtsgrundlage bleibt „zu prüfen“ (E14/E15).

## Nicht-Ziele

Kein `/metrics`, keine Kennzahl, kein Allowlist-Tor, kein Auswertungskatalog (033b). Keine technische Vier-Augen-Sperre und kein Ereignis `AuditAccessGranted` (047). Kein Rate-Limit, kein Body-Limit, keine Sicherheitsheader, kein zod-Konfigurationsschema und keine `.env.example` (034). Keine Alarmierung, kein Log-Versand an eine Plattform, kein Container (037). Keine Korrektur der Systemuhr durch den Dienst, kein Drift-Hinweis im Web (032). Keine Änderung an Vorgangshistorie, Ereignisumschlag, Rechten oder Übergängen. Keine Auswertungsoberfläche für das Zugriffslog. Kein Übernehmen eines Client-`X-Request-Id`. Keine Vertragsänderung (Ausnahme nur nach „Vor dem Bau prüfen“, Punkt 2).

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 033a | Test (Datei) |
|---|---|---|
| T-G2-I-02 | muss schließen (Anteil 033a; Secrets aus der Plattform bleiben 037) | unerwarteter Fehler mit Marker in der Meldung: weder Antwort noch Zugriffslog noch Fehlerlog enthalten den Marker, Fehlerlog-Zeile hat exakt `log`, `ts`, `requestId`, `errorClass` (`access-log033a.test.ts`); provozierter Postgres-Treiberfehler mit Geheimnis wie in 027: Geheimnis in keiner Log-Zeile (`postgres-access-log033a.test.ts`) |
| T-G1-R-01 | berührt | Schreibaufruf erzeugt genau eine Zeile mit `requestId`, `subjectHash`, `operationId`, `status`, `latencyMs`, `seq` = neue `seq`; Lesen und 409 mit `seq: null` (`access-log033a.test.ts`, Postgres-Variante in `postgres-access-log033a.test.ts`) |
| T-G3-I-04 | berührt | Sitzungsakteur aus dem OIDC-Pfad (Test-Stores wie in `auth-029b.test.ts`): `subjectHash` ≠ Actor-ID, enthält weder `oidc_` noch `sub` noch E-Mail; gleicher Schlüssel → gleicher Hash, anderer Schlüssel → anderer Hash (`access-log033a.test.ts`) |
| T-G2-D-01 | berührt | gefälschter NTP-Server auf `127.0.0.1` (dgram im Test): `ok`, `clock_drift`, `clock_unsynced` (Leap 3, Stratum 0, falscher Originate-Zeitstempel, fremder Absenderport), `timeout`, `not_configured`; `/readyz` 200 nur bei allen `ok` (`ntp033a.test.ts`) |
| T-G1-T-07 | berührt | `X-Server-Time` gleich der injizierten Uhr auf 200, 201, 302, 401, 403, 404, 409, 412, 422, 500, `/healthz`, `/readyz`; ein gesendeter `Date`-Header ändert nichts (`platform033a.test.ts`) |
| T-G1-I-05 | berührt | `X-Actor` mit CR/LF und JSON-Fragment, Pfad mit Marker, Query mit Marker: jede Log-Zeile ist gültiges JSON mit der exakten Schlüsselmenge, genau eine Zeile je Anfrage, kein Client-String im Log (`access-log033a.test.ts`) |
| **T-G1-D-04 (neu)** | schließen | öffentliche Probe löst ausgehende Abfragen aus: 100 `/readyz`-Aufrufe in 30 s erzeugen genau eine NTP-Abfrage, nach Ablauf eine weitere (`ntp033a.test.ts`); neue Zeile im Bedrohungsmodell |
| **T-G2-D-04 (neu)** | schließen (Alarm 037) | Senke nicht beschreibbar: Anfrage wird beantwortet, eine feste stderr-Zeile ohne Inhalt; Start ohne beschreibbares Verzeichnis oder ohne Schlüssel außerhalb der Demo verweigert (`access-log033a.test.ts` über `config.ts`); neue Zeile im Bedrohungsmodell |

Aufbewahrung (E16): Datei D bleibt bei heute = D + 30, wird bei D + 31 gelöscht; fremde Datei und Symlink mit passendem Namen bleiben (`access-log033a.test.ts`, injizierte Uhr, temporäres Verzeichnis).

**Missbrauchsfall (SC-06), MF-02 aus dem Bedrohungsmodell:** Eine Person im Betrieb will aus dem Zugriffslog die Arbeitsgeschwindigkeit einer Kollegin ablesen. Das Log trägt nur den `subjectHash`; die Rückführung auf eine Person braucht den Schlüssel aus der Plattform und die Rollenzuordnung, und das Verfahren verlangt zwei Personen, Zweck und Frist. **Erkennung:** bis 047 nur organisatorisch (Protokoll in der Betriebsakte); das ist eine ehrliche Grenze und steht im Bericht unter „Open“. Kein Werkzeug in 033a erleichtert die Auswertung.

## Files allowed

- `docs/slices/033a-serverzeit-health-zugriffslog.md`
- `apps/api/src/app.ts` (äußerste Middleware, `/healthz`, Auth-Ausnahme exakt `/healthz`, `clockHealth`/`monotonic`/`accessLog`-Optionen, `seq`-Übergabe aus Postgres-Grenze und In-Memory-Pfad, `instance` in Problem-Antworten, CORS `exposeHeaders`)
- `apps/api/src/server.ts` (nur Konfiguration aus der Umgebung, Startverweigerung, NTP-Port, `performance.now()` mit `now-ok`)
- `apps/api/src/problem.ts` (nur Fehlerlog ohne Nutzdaten und optionales `instance`)
- `apps/api/src/validate.ts` (nur falls die `operationId` dort in den Kontext geschrieben wird)
- `apps/api/src/contractSchema.ts` (nur ein Export für die Laufzeit-Zuordnung Methode + Route → `operationId`, falls nötig)
- `apps/api/src/observability/**` (neu: Anfragekontext, Zugriffslog-Port und Adapter, Subject-Hash, Aufbewahrung, Konfigurationsprüfung, Fehlerlog)
- `apps/api/src/clock/**` (neu: SNTP-Port)
- `apps/api/src/__tests__/platform033a.test.ts`
- `apps/api/src/__tests__/access-log033a.test.ts`
- `apps/api/src/__tests__/ntp033a.test.ts`
- `apps/api/src/__tests__/postgres-access-log033a.test.ts`
- `apps/api/src/__tests__/read-rights.test.ts` (nur `instance` in der Normalisierung des Vergleichs verborgen/unbekannt ausblenden)
- `apps/api/src/__tests__/readiness027.test.ts` (nur falls die neue Option `clockHealth` eine Anpassung der Standardprüfung verlangt; keine Abschwächung)
- `packages/contract/allowlist.json` (nur Eintrag `getHealth` entfernen)
- `packages/contract/openapi.yaml`, `packages/contract/CHANGELOG.md`, `packages/contract/package.json`, `packages/contract/src/types.ts`, `apps/api/src/__tests__/contract.test.ts`, `apps/api/src/__tests__/takt-019-contract.test.ts` (nur im Ausnahmefall aus „Vor dem Bau prüfen“, Punkt 2: Version = dann aktueller Stand + 1 Patch, Typen generiert, die beiden Tests nur in ihrer festen Versionsaussage)
- `scripts/keycloak-ci-029b.mjs` (nur `HV_ACCESS_LOG_DIR` als temporäres Verzeichnis, zur Laufzeit erzeugter `HV_ACCESS_LOG_HASH_KEY`, Kommentar zu 033, und eine Prüfung, dass die Log-Dateien nach dem Browserlauf weder Client-Secret, Token, Cookie-Wert noch Actor-ID enthalten)
- `.github/workflows/gates.yml` (nur `postgres-access-log033a.test.ts` in den Postgres-Schritt aufnehmen)
- `docs/adr/0013-zwei-protokollebenen.md` (nur Abschnitt „Verfahren: Auswertung nur zu zweit“ und Nachweis-Zeile)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeilen „Technisches Zugriffslog“ und V10 zur Aufbewahrung des `subjectHash`)
- `docs/sicherheit/bedrohungsmodell.md` (nur Status und Nachweise der oben genannten IDs, zwei neue Zeilen T-G1-D-04 und T-G2-D-04, Abschnitt-6-Zeile 033 auf 033a/033b)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde dieser Scheibe)

Weitere Dateien sind Scope-Befunde: erst Spec klären, nicht still ausweichen.

## Vor dem Bau prüfen

1. `git log --oneline origin/claude/dax-shareholder-meeting-workflow-0s934z`: Sind takt-023 (Rollenverlust, Vertrag 0.3.8, `app.ts`), takt-024 (`guarded(operationId)` statt `app.use('/v1/*')`, Proxy wirft ohne Postgres-Grenze) und takt-026 gemergt? Auf den dann aktuellen Kopf aufsetzen. Mit takt-024 muss die `seq`-Übergabe in `postgresBoundary` sitzen; die äußerste Middleware bleibt `app.use('*')` vor allem anderen. Zeilenangaben dieser Spec beziehen sich auf `93a786d`.
2. Vertragsversion: `grep -n "^  version:" packages/contract/openapi.yaml` (heute 0.3.7, nach takt-023 0.3.8). Eine Vertragsänderung ist **nicht** geplant. Stellt sich eine als nötig heraus, ist sie additiv, erhält Version = aktueller Stand + 1 Patch, Changelog, `package.json`, `pnpm contract:types`, und die festen Versionsaussagen in `contract.test.ts` und `takt-019-contract.test.ts` werden nachgezogen; der Bericht begründet sie.
3. `packages/contract/allowlist.json` enthält `getHealth` mit `slice: "033"`: entfernen; die Operation-Coverage (`operation-coverage.setup.ts`) muss danach `getHealth` über `req()` sehen.
4. Hono: Ein Test beweist, dass die äußerste Middleware die Ergebnisse von `onError`, `notFound` und die ersetzte Antwort der Postgres-Grenze sieht (Header und Log-Zeile vorhanden).
5. `pnpm now-check`: kein `performance.now()`, `Date.now()` oder `new Date()` außerhalb von `server.ts`; die Aufbewahrung rechnet mit der injizierten Uhr.
6. Alle Tests, die Problem-Bodies vollständig vergleichen: `grep -rn "toEqual(" apps/api/src/__tests__ | grep -i problem` und `read-rights.test.ts:246-249`; nur dort `instance` ausblenden, sonst Scope-Befund.
7. Tests mit Spies auf `console.error` (`postgres027.test.ts:204`, `readiness027.test.ts:62`) bleiben unverändert grün und prüfen weiterhin den tatsächlichen Fehlerlogweg.
8. `grep -rn "readiness:" apps/api/src/__tests__`: bestehende Injektionen der drei Prüfungen bleiben gültig; `clockHealth` ergänzt nur die Standardprüfung.

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `platform033a.test.ts` (Header auf allen genannten Status, `/healthz` 200 ohne Actor, `/healthz` mit ungültigem `X-Actor` trotzdem 200, `/v1/questions` ohne Actor weiter 401), `access-log033a.test.ts` (exakte Schlüsselmenge; **Log-Zeile ohne Fragetext trotz Body**: `captureQuestions` und `captureContribution` mit synthetischem Marker-Text im Body, 201 und 422, der Marker steht in keiner Log-Zeile; eine Zeile je Anfrage auch bei 404 und 500; Aufbewahrung; Senkenfehler; Startverweigerung über `config.ts`; `instance` in Problem-Details trägt dieselbe `requestId` wie die Log-Zeile), `ntp033a.test.ts` (alle Codes, Zwischenspeicher, keine Hostnamen im Body).
2. Postgres in CI: `postgres-access-log033a.test.ts` belegt `seq` nach Commit, `seq: null` nach Rollback, und den Treiberfehler ohne Geheimnis in Log oder Antwort. Keycloak-Lauf in CI bleibt grün und prüft die Log-Dateien auf Geheimnisse.
3. Operation-Coverage ohne `getHealth` in der Allowlist grün; `pnpm gates` auf sauberem Baucommit grün, wörtlicher Schluss im Bericht; vollständige E2E-Suite, soweit ein Browser verfügbar ist (keine Oberflächenänderung, kein Screenshot nötig). `curl -si localhost:8787/healthz` und `curl -s localhost:8787/readyz` gegen `pnpm --filter @hv/api dev` mit und ohne `HV_NTP_SERVERS` auf einen lokalen Test-NTP-Server als Ausgabe im Bericht.
4. Unabhängiges Review in frischem Kontext mit Perspektive Datenschutz/Betrieb; Blocker/Major sowie jede Datenschutz- oder Sicherheitsfrage vor Merge, übrige Befunde in `docs/folgeliste.md`. PR-CI auf dem letzten Commit grün. Jeder Commit nennt „Scheibe 033a“ und endet `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss, Testnamen je Bedrohungs-ID, `curl`-Ausgaben von `/healthz` und `/readyz`, Beispielzeile des Zugriffslogs aus einem Testlauf mit synthetischem Akteur, Keycloak-CI-Schritt grün.

## Bericht (nach Bau ausfüllen)

```
Slice: 033a-serverzeit-health-zugriffslog
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; Postgres- und Keycloak-CI-Lauf; curl /healthz, /readyz
Bedrohungs-ID → Test: <je Zeile der Tabelle oben>
Open: Vier-Augen-Sperre technisch erst 047; Senkenfehler ohne Alarm bis 037; Konfigurationsschema 034; E13, E16
Touched: <Dateiliste>
```

## Review findings

folgt
