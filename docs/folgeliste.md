# Folgeliste — gesammelte Kleinbefunde

**Zweck:** Minor- und Nit-Befunde aus Reviews und Codex (P2 und kleiner), die nach dem schlanken Review-Modus
(AGENTS.md Regel 3, Entscheidung des Eigentümers vom 25.09.2026) nicht in der Scheibe nachgearbeitet werden. Ein
gebündelter Debug- und Review-Durchgang arbeitet die Liste später ab. Blocker, Major, P0/P1 sowie jeder Befund zu
Sicherheit, Recht oder Datenschutz gehören **nicht** hierher, sie werden in der Scheibe behoben.

**Format:** eine Zeile je Punkt: Herkunft (Scheibe, Runde) · Datei:Zeile · Befund in einem Satz · Vorschlag.

## Oberfläche: Lade- und Schreibränder (Kandidat 010e)

- 010d R1 Befund 5 · `features/history/Page.tsx` · Historie zeigt nach erstem Ladefehler „Kein Treffer“ / „Noch keine
  Ereignisse“ und nutzt `answers.list.loading` · gestalteter Ladefehler mit eigenen `history.*`-Schlüsseln.
- 010d R2 N3 · `features/answers/WorkList.tsx` · kein Beschäftigt-Signal beim erneuten Versuch; Zähler „0 von 0“ im
  Fehlerzustand · `aria-busy` am Knopf, Zähler ausblenden.
- 010d R3 minor · `features/answers/Page.tsx:150-166` · verlässt man eine Frage während einer langsamen
  Speicherantwort und kehrt zurück, leert der späte Erfolg den neu getippten Text · nur leeren, wenn der Editor noch
  den gespeicherten Text enthält.
- 010d R3 nit · `features/answers/WorkList.tsx:339-353` · Wiederholungsmarke `retriedAt` überlebt einen
  Rollenwechsel · Marke an den Akteur binden.
- 010d Bericht · `features/answers/Page.tsx` · andere Ablehnungen (403/409/5xx) für eine nicht mehr gezeigte Frage
  zeigen den Servertext · i18n-Text mit Fragennummer wie beim 412.
- 010d Bericht · `features/stage/Page.tsx:515` · Skelett `stage-deciding` trägt `aria-label` ohne Rolle (axe serious,
  sobald der Ladezustand geprüft wird) · `role="status"` wie in 010d.
- 010c · `features/history/Page.tsx` · zwei Toasts, wenn beide Hauptabrufe scheitern · einen Toast je Durchgang.
- takt-008 Bericht offen 2 · `features/answers/`, `features/stage/` · Knöpfe außerhalb der sechs Aktionen nutzen noch
  `disabled={busy}` (Fokus fällt nach Aktion auf BODY) · Muster aus takt-008 übernehmen.
- takt-008 Bericht offen 3 · `features/capture/ContributionPane.tsx` · `capture-submit` hat zwei gesperrte Erscheinungen
  (leer: nativ gesperrt; beim Schreiben: `aria-disabled`) · vereinheitlichen.
- 090 Bau · `apps/web/src/app/RoleSwitcher.tsx` · nach der Wahl eines Eintrags fällt der Fokus auf `BODY` (der
  gewählte Menüpunkt wird ausgehängt) · Fokus auf den Auslöser des Umschalters zurückgeben, e2e dazu.

## Tests

- 021c Hotfix Review minor · `apps/api/src/__tests__/legal-clearance.test.ts` · der HTTP-Regressionstest prüft nach 422 derzeit nur die Frageversion; `legalClearance` und Ereigniszahl zusätzlich je Request prüfen (der Domänentest deckt beides bereits ab).
- 010c CI-Korrektur minor · `apps/web/e2e/010c-lesezustand.spec.ts:118` · ein `import()` mit `await` bleibt in
  `installHarness` (in 010d auf Abfrage umgestellt, prüfen ob erledigt) · ggf. streichen.
- 090 R2 nit · `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (`expectCleared`) · Prüfung von `#main` per
  `not.toContainText` sieht keine Feldwerte und fügt nichts hinzu · streichen oder auf Feldwerte umstellen.

## Dienst: Anmeldung (vor oder mit 029)

- 029a R1 minor 3 · `apps/api/src/actor.ts:1-5` · Dateikopf nennt die Datei noch „demo authentication adapter“, sie
  enthält jetzt Port und Adapterwahl · Kommentar anpassen.
- 029a R1 minor 4 · `apps/api/src/server.ts:17` · Log-Hinweis wertet `HV_DEMO` selbst aus statt die Wahl aus
  `createApp` zu übernehmen · gewählten Adapternamen zurückgeben und loggen (spätestens mit 029).
- 029a R1 nit 6 · `packages/contract/openapi.yaml` · 401 für `seedDemo`, `getMeeting`, `registerSpeaker` nicht
  dokumentiert (Ausnahme `UNDOCUMENTED_STATUS_EXCEPTIONS`) · 043.

## Sprecher und Zustandstabelle (aus 080)

R1 minor 3, 4, 5 und nit 6 (leerer PATCH, legalRef R-SPK-01, Tests 412-vor-409 und Wiederholung, EN-Spaltenkopf):
erledigt in takt-015.

- 080 Spec Nicht-Ziel · `apps/web/src/features/speakers/SpeakerRow.tsx` · Knopfwahl nach Status statt aus `_actions`
  (Regel 4/5) · je Wortmeldung erlaubte Übergänge als Aktionen ausgeben.
- 080 Spec Nicht-Ziel · `packages/domain/src/transitions.ts` · kein Guard „nur ein Mikrofon offen“ auf R-SPK-01 (die
  Oberfläche beendet die laufende Rede zuerst) · Guard mit Regel-id.
- 080 → 043 · `packages/contract/openapi.yaml` · `SpeakerUpdate.reason` und 409 für `updateSpeaker` aufnehmen, Ausnahme
  in `apps/api/src/__tests__/helpers.ts` streichen, `kind`/`requestedMinutes` löschen.
- 080b R1 minor · `apps/web/src/api/index.ts` (`STORAGE_KEY` `hv-demo-events-v1`) · ein Browser mit gespeichertem
  Alt-Korpus (800) behält ihn bis „Demo zurücksetzen“ · Schlüssel versionieren (`-v2`).
- 080b R1 nit · `apps/web/e2e/abnahme.spec.ts:7` · Zitat „bei 800 Fragen im Bestand“ neben CORPUS_DEMO verwirrt ·
  als Zitat kennzeichnen oder Abnahmesatz in `docs/erste-version-und-offene-fragen.md` nachziehen.

## Rollen (aus 021a/021b)

- 021b R1 minor 2 · `apps/web/src/features/capture/Page.tsx` · Koordination sieht „In dieser Rolle nur lesen“ neben
  „Klassifizieren“ (Hinweis nur aus `question.capture` abgeleitet) · Hinweis aus allen `_actions` der Seite ableiten.
- 021b Spec · `packages/domain/src/seed.ts` · historische Klassifizierungen im Demo-Korpus tragen die Erfassung als
  Akteur · mit dem nächsten Seed-Umbau auf die Koordination umstellen (Fingerabdruck neu begründen).
- 021a Bau · `packages/domain/src/api.ts` (Schreibweg) · `actor()` wird für Rechteprüfung, Guard und `append` getrennt
  gelesen · Akteur einmal je Aufruf binden.
- 021a R1 nit · `packages/domain/src/transitions.ts` · Erstellerin, die eine ältere fremde Version freigibt, erhält
  R-GUARD-04 statt R-GUARD-06 · nur zur Kenntnis.

## Idempotenz nach Rollenablauf (in 028 erledigt)

- 026 Codex-PR-Review P2 · Scheibe 028 legt im Vertrag und in R-IDEM-01 fest und testet: Ein Retry mit demselben Idempotenzschlüssel erhält nach Ablauf oder Entzug der Rolle 403. Die heutige Berechtigung wird vor dem historischen Ergebnis geprüft; eine alte Antwort und alte `_actions` werden nicht ausgeliefert.

## Antwort-ETag bei gleichzeitigen Demo-Anfragen

- 028 unabhängiges Review P2 · `packages/domain/src/api.ts:987`, `apps/api/src/app.ts:358` · `lastWriteEtag()` liegt beim In-Memory-/JSONL-Dienst auf der gemeinsam genutzten Domain-Instanz; bei gleichzeitig abgewickelten HTTP-Anfragen kann die Antwort den ETag eines anderen Schreibens tragen · den Schreibstand als Teil des jeweiligen Aufrufergebnisses zurückgeben und einen gezielten Konkurrenztest ergänzen.

## Nachprüfung der Codex-Scheiben 021c–030 (29.09.2026)

Quelle: frische Reviewer je Scheibe, Bericht `docs/bautage/2026-09-27-29.md`. Blocker/major sind in takt-023..025
behoben oder als harte Vorbedingung in 034 geführt; hier nur minor/nit.

- 021c · `packages/domain/src/api.ts` (`clearQuestionLegally`) · Versionsbindung R-GUARD-04 im Build-Callback statt als
  Guard der Tabellenzeile R-TRANS-13 (fehlt in legal-trace/Wahrheitstabelle) · Guard in `transitions.ts` anhängen.
- 021c · `transitions.ts` R-TRANS-13 · kein Guard gegen erneute Rechtsfreigabe derselben Version; e2e 010c sichert die
  Wiederholbarkeit sogar zu · Architektenfrage, sonst Guard.
- 021c · R-TRANS-05/13 · `approver` kann vor Recht freigeben, danach ist R-TRANS-13 unerreichbar (Bedienfalle) · E25
  entscheiden: R-TRANS-13 auch aus `approved` oder Freigabe setzt Rechtsfreigabe voraus.
- 021c · `apps/api/src/__tests__/legal-clearance.test.ts` · kein 404-Test auf der neuen Route · ergänzen.
- 024 · `apps/api/src/http.ts` · leerer `Idempotency-Key:` besteht die Header-Prüfung (Domäne lehnt `""` inzwischen mit
  422 ab, 028) · Header-Schema `minLength: 1` bzw. Test.
- 024 · `apps/web/src/api/index.ts` · „Erneut versuchen“ bei korruptem Demo-Log wirkungslos · Hinweis oder bestätigter
  Reset (Produktentscheid).
- 024 nit · `EVENT_TYPES` mit `satisfies Record<EventType, true>`; Downgrade des ganzen Logs bei RR-01 vermerken;
  `canonicalJson`-Sortierregel (UTF-16) in ADR 0011; Negativtest `legalHold: true` / `at !== recordedAt`.
- takt-016 · `apps/api/src/__tests__/takt-016-contract.test.ts` · `DebateClosed` ohne `subjectId` nicht getestet.
- takt-019 · Vertragstest · Negativtest `DebateClosed` mit Payload fehlt; Planzeile 040 „Lebenszyklus-Aktionen“ unscharf.
- takt-018 · `scripts/plan-graph.test.mjs` · kein Negativtest „gleichdatig, gleiche Lane, Kette daneben“;
  `produktplan-beta.md` historischer 021-Block ohne Leerzeile (Markdown-Rendering); `--calendar`-P2 aus dem Bericht.
- takt-020 · `docs/entscheidungsregister.md` E11 · Sitzungsrichtlinie (14 h, Leerlauf, Sperrliste) nicht mehr im
  Registertext · ein Satz in E11; ADR 0004 steht noch auf „vorgeschlagen“.
- 025 · `packages/domain/src/state.ts` · Anfangsstatus `lifecycleVersion === 2 ? 'preparation' : 'running'` außerhalb
  der Tabelle (R5); nicht jede Zeile von `MEETING_TRANSITIONS`/`AGENDA_TRANSITIONS` getestet · Tabellenzeile + Tests.
- 025 · `apps/api/src/__tests__/meeting025.test.ts` · HTTP-Negativtests der Agenda-Routen (401/403/412/409/404) fehlen.
- 025 · `api.ts` (`agendaProgress`) · 409 vor 412 bei veraltetem `If-Match` auf geöffnetem Punkt · festlegen und testen.
- 025 · `state.ts` (`DebateClosed`) · zweites Ereignis verschiebt `debateClosedAt` · vor 087: nur das erste gilt.
- 025 · `store.ts`, `api.ts` · O(N)-Duplikatprüfung und Voll-Replay je Aufruf · mit 071.
- 025 nit · `listMeetings` wirft TypeError statt definiertem Fehler bei Log ohne Projektion.
- 026 · `api.ts` · Admin kann eigene letzte Admin-Zuordnung entziehen (Aussperrung), kein Test; `assignRole` bei
  geschlossenem Jahrgang erlaubt, ohne Spec-Aussage.
- 026 · `api.ts` (`actor()`) · Demo-Rückfall „ohne Zuordnung = behauptete Rolle“ · mit 029b außerhalb Demo geschlossen;
  prüfen und Test, dass der Pfad nur im Demo-Modus existiert.
- 027 · `postgres027.test.ts`, `migrations027.test.ts` · `describe.skipIf` ohne DB still grün · CI-Schalter
  `HV_REQUIRE_POSTGRES_TESTS=1`, der Überspringen zum Fehler macht; Laufzeitrolle explizit übergeben.
- 027 · `app.ts` Readiness · unbekannter Migrationsstand → `unreachable`/500 statt `migrations_pending`/503.
- 027 nit · `postgres:16` per Digest pinnen; TLS standardmäßig aus (037); kein Owner-Trigger gegen UPDATE (038).
- ~~028 · `claim.personId` an alle Leser~~ → behoben in **takt-027** (Datenschutz hält den Merge, AGENTS.md R3; Codex P1 auf #66).
- 028 · `envelope.ts` · Ersatzkennung `legacy-unscoped` auch bei neuen Schreibvorgängen ohne `meetingId` · nur im
  Hochzieh-Pfad, sonst Fehler.
- 028 · Tests · anderer Jahrgang, Rollenablauf, Postgres-Rollback nach angehängtem Ereignis, gleicher Schlüssel über
  zwei Prozesse.
- 028 · `api.ts` (`idempotent`/`replayValue`) · Vollscan je Schreibvorgang · Index mit 071.
- 028 nit · ungültiger `If-Match` bei optionalen Operationen 412 statt 422, `IfMatchRequired` ohne `pattern`;
  Claim ruft `touch()` (setzt `updatedAt`); keine Claim-Anzeige in der Oberfläche.
- 029b · `apps/api/src/actor.ts` vs. `packages/domain/src/api.ts` · Regeln „aktive Zuordnung“ doppelt · gemeinsamer
  Domain-Helfer.
- 029b · MF-08 (Zähler verworfener `X-Actor`-Versuche) fehlt · in 033.
- 029b nit · `CURRENT_TIMESTAMP` statt injizierter Uhr in `auth/store.ts`/`0002_auth.up.sql`; Keycloak-Image per Tag;
  `subject-block-cli.ts` ohne Rechenhilfe aus Issuer+`sub`.
- 030 · `apps/web/e2e/030-anmeldung.spec.ts` · überspringt sich ohne `HV_WEB_MODE=http`; kein HTTP-Build in CI ·
  in 031 verdrahten.
- 030 · `apps/web/src/api/http.test.ts` · „zwei Aufrufe → verschiedene Idempotenzschlüssel“ nicht geprüft; 401 mitten
  in der Sitzung nur als Unit-Test.
- 030 nit · Auth-Fehlertexte fest `'de'`; HTTP-Build bündelt `CORPUS_DEMO` statisch; `Idempotency-Key` auch an Logout.
- Nachprüfung e2e · `apps/web/e2e/003-answers-stage.spec.ts:44` · ein Test mit zehn axe-Läufen und Screenshots braucht
  auf langsamer Maschine > 90 s · teilen oder `test.slow()`.
- takt-024 R1 · `apps/api/src/__tests__/postgres-takt024.test.ts` · nur lesende Aliasroute durch die Grenze geprüft; kein
  statischer Check „jede `/v1`-Route beginnt mit `guarded(`“; Proxy-Guard wirft einfachen `Error` ohne Betriebssignal;
  `ROLLBACK` im `finally` nach `COMMIT`.
- takt-025 R1 · `packages/domain/src/__tests__/idempotency028.test.ts` · Test (c) läuft über den `commandOperation`-Pfad;
  operationsspezifische Zweige von `legacyMatch` (`captureQuestions`, Agenda) ungetestet.
- takt-026 R1 · `apps/api/src/auth/sessions.ts` · IV-Länge 12 als nackte Zahl (`GCM_IV_BYTES`); Test „gekürzter Tag“
  prüft nur die Längenprüfung.
- takt-023 R1 · `apps/api/src/__tests__/auth-029b.test.ts` · 403-Body nicht gegen `NoActiveRole` validiert,
  `X-Server-Time` ungeprüft; `apps/web/src/api/auth.test.ts` Test 1(d) prüft faktisch nichts (Fachaufruf-403 fehlt).
- takt-023 R1 · `docs/slices/030-http-web-anmeldung.md` · Missbrauchsfall ohne Erkennung/Signal/Empfänger (SC-06).
- takt-023 nit · `logout`-Beschreibung im Vertrag ohne „keine Rolle nötig“; `noRole` fragt nicht neu ab (bewusst).
- takt-021 Codex P1 · `scripts/downgrade-check.mjs` · prüft nur nummerierte Specs, keine `takt-*`-Specs; eine falsch
  niedrig eingestufte Takt-Spec (Secrets, Deployment) fällt nicht auf · Takt-Specs einbeziehen.
- takt-025 Codex P2 · `packages/domain/src/api.ts` (`legacyMatch`) · `registerSpeaker` passt pauschal (`return true`);
  mehrere zusammenhängende `SpeakerRegistered` mit gleichem Alt-Schlüssel stammen zwingend aus mehreren Befehlen und
  müssten 409 `R-IDEM-01` liefern statt das erste Ergebnis zu wiederholen (betrifft nur Alt-Ereignisse vor 028) · je
  Operation die erwartete Ereigniszahl prüfen.
- takt-023 Codex P1 (Ausnahme) · 033a/033b · Erkennungssignal für den Rollenverlust-Missbrauchsfall (aggregierte
  `403 NoActiveRole` auf `/auth/me` und `403` auf `/v1`) muss mit 033a/033b entstehen; Ausnahme läuft mit Merge von
  033b ab, spätestens 27.10.2026 · in Spec 033b als Kennzahl aufnehmen.

- takt-027 R1 nit · `packages/domain/src/api.ts` `viewClaim` · Parametertyp von Hand statt `Claim` aus `types.ts`;
  Idempotenz-Wiederholung, Listen und Bühne nicht eigens auf fehlende `personId` getestet.

## Sicherheit und Datenschutz aus der Nachprüfung — nicht Folgeliste, eingeplant

Nach dem Kopf dieser Datei gehören Befunde zu Sicherheit, Recht und Datenschutz nicht auf die Folgeliste (Codex P1 auf
#66). Sie sind eingeplant: **takt-028** (gebündelter Sicherheits- und Datenschutz-Takt, vor 033b) bzw. **034** (Grenzen
und Timeouts). Der Datenschutzbefund `claim.personId` (028) ist in **takt-027** behoben.

- 021c/takt-016 · `openapi.yaml` `LegalClearanceRequest.note`, `lateEntryReason` · kein `maxLength` (SP-2) · mit 034.
  → **034**
- 024 · `packages/domain/src/envelope.ts` (`stampEvent`) · `...rest` ungefiltert in Umschlag und Hash (SC-07) ·
  Umschlag per Whitelist, optionale Felder auf Typ/Länge prüfen.
  → **takt-028**
- 024 · `apps/api/src/eventLog.ts`, `apps/web/src/api/index.ts`, `BootScreen.tsx` · `JSON.parse`-Fehlertext kann
  Auszug der Rohzeile zeigen (SC-11) · festen Text abbilden.
  → **takt-028**
- 026 · `api.ts` (`assignRole`) · `deputyForSubjectId` ohne Pseudonym-Prüfung, `revokeRole.reason` ohne Länge (PII im Log).
  → **takt-028**
- 026 · `api.ts` (`maskEvent`) · nicht rekursiv (verschachtelte Akteure in Payloads); wirft bei fehlendem `hash`
  (SSE-Listener, 035) · rekursive Maske mit Test, definierter Fehler.
  → **takt-028**
- 027 · `apps/api/src/server.ts` · kein `statement_timeout`/`lock_timeout`/`idle_in_transaction_session_timeout` ·
  Pool-Timeouts setzen (vor Generalprobe).
  → **034**
- 029b · `auth-029b.test.ts` · Negativtests `alg: none`/HS256, HTTP-Callback eines gesperrten Subjects → 403, ohne
  Zuordnung → 403, gleiches `sub` unter zwei Issuern ohne übertragene Rolle.
  → **takt-028**
- 029b · `app.ts` Callback · DB-Fehler → 500 statt vertraglich 503.
  → **takt-028**
- takt-023 R1 · `apps/api/src/app.ts` `/auth/me` · Sitzung ohne Rolle schiebt mit jedem Abruf das Leerlauffenster
  (`slideIdle`) · für diesen Fall `slideIdle=false`.
  → **takt-028**
- takt-027 R1 minor · `packages/contract/openapi.yaml` `Claim.personId` · ohne Beschreibung („in Antworten nie befüllt,
  nur im Ereignis“)
  → **takt-028**
