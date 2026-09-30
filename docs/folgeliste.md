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
- ~~024 · `apps/api/src/http.ts` · leerer `Idempotency-Key:` besteht die Header-Prüfung (Domäne lehnt `""` inzwischen mit
  422 ab, 028) · Header-Schema `minLength: 1` bzw. Test.~~ → erledigt in **034a** (`IdempotencyKey` mit `minLength: 1`, Vertrag 0.3.10).
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
- 027 nit · ~~`postgres:16` per Digest pinnen~~ → erledigt in **031a** (beide Jobs); TLS standardmäßig aus (037); kein Owner-Trigger gegen UPDATE (038).
- ~~028 · `claim.personId` an alle Leser~~ → behoben in **takt-027** (#67, `4daa317`; Datenschutz hält den Merge, AGENTS.md R3; Codex P1 auf #66).
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
- 029b nit · `CURRENT_TIMESTAMP` statt injizierter Uhr in `auth/store.ts`/`0002_auth.up.sql`; ~~Keycloak-Image per Tag~~ (→ erledigt in **031a**, Tag und Digest);
  `subject-block-cli.ts` ohne Rechenhilfe aus Issuer+`sub`.
- ~~030 · `apps/web/e2e/030-anmeldung.spec.ts` · überspringt sich ohne `HV_WEB_MODE=http`; kein HTTP-Build in CI~~ →
  erledigt in **031a** (Projekt `http`, Job `e2e-http`; der Nachweis des Jobs steht mit dem grünen PR-Lauf).
- ~~030 · `apps/web/src/api/http.test.ts` · „zwei Aufrufe → verschiedene Idempotenzschlüssel“ nicht geprüft; 401 mitten
  in der Sitzung nur als Unit-Test.~~ → erledigt in **031a** (Unit-Test; 401 mitten in der Sitzung: H6, nur in der PR-CI).
- 031a Bau · `apps/web/vite.config.ts` · Proxy-Standard `HV_API_ORIGIN` `http://localhost:3000` passt nicht zu `PORT`
  8787 des Dienstes · Standard angleichen (Produktcode, Web-Scheibe); Beobachtung beim Bau: der Proxy setzt `Host` auf den
  Zielhost, nicht auf den Vite-Ursprung.
- 031a Bau · `apps/api/src/server.ts` · `serve` ohne `hostname` bindet an alle Schnittstellen · Bindeadresse
  konfigurierbar machen (mit 037).
- 031a Bau · `apps/api/src/app.ts` (`/auth/callback`) · eine Person ohne aktive Rolle bekommt keine Sitzung (403 vor dem
  Cookie), die Seite „Keine aktive Rolle“ (takt-023) ist so nie erreichbar; die Spec 031a (H7) ging vom Gegenteil aus ·
  Absicht klären, Spec H7 oder Dienst anpassen (H7 prüft heute „kein Cookie, `/auth/me` 401“). Produktfrage: eine Person
  ohne Rolle landet nach der Keycloak-Anmeldung auf einem rohen 403-JSON-Dokument des Dienstes, und die Keycloak-SSO-Sitzung
  bleibt bestehen (die nächste Anmeldung geht ohne Formular wieder dorthin) · gestaltete Fehlerseite oder Weiterleitung zur
  Seite „Keine aktive Rolle“, Abmelden beim IdP klären.
- **Erledigt durch takt-030 (Schreibvorgänge; H8 lädt die Liste nicht mehr von Hand neu; H6 lädt weiter neu, Nit 12 und das Neuladen der Erfassungsseite in H8 bleiben offen)** · 031a Review major (Produktcode, **eigener Takt vor 031b**) · `apps/web/src/api/http.ts:146-152`, `:207-216`,
  `features/speakers/Page.tsx:149-163` · im HTTP-Modus löst ein eigener erfolgreicher Schreibvorgang kein Neuladen aus: Liste
  und ETag bleiben bis zu 30 s (Polling) veraltet, der nächste eigene Schreibvorgang läuft in 412; H6 und H8 laden deshalb
  von Hand neu · nach jedem eigenen Schreibvorgang die Version erhöhen (wie der In-Process-Speicher). Nit 12 gehört dazu: H6
  prüft den Weg `onUnauthorized` einer laufenden Seite nicht (nur Neuladen nach der Sperre); mit dem Takt ein Test, der ohne
  Neuladen auf den Wechsel zur Anmeldung wartet.
- takt-030 Review minor · `apps/web/src/api/http.test.ts:212-225` · Test (a) prüft „nicht vor der Antwort“ nur synchron, die Reihenfolge ETag → Hörer bei einer 204-Antwort ist nicht eigens getestet · Test ergänzen.
- takt-030 Review minor (vorbestehend) · `apps/web/src/api/http.ts:110-116` · eine 2xx-Antwort mit nicht lesbarem Rumpf setzt `writeEtag`, lehnt dann ab und benachrichtigt nicht: Fehlermeldung und bis zu 30 s alte Ansicht, obwohl der Dienst angenommen hat · als angenommen behandeln und benachrichtigen, oder begründen.
- takt-030 Review nit · `apps/web/src/api/http.ts:224` · die Polling-Schleife ruft Hörer ohne try/catch, ein werfender Hörer stoppt die übrigen · `notifyListeners()` wiederverwenden.
- takt-030 offen · `apps/web/e2e/031-http-betriebsart.spec.ts` H8 · das Neuladen der Erfassungsseite nach dem eigenen Redebeitrag ist vermutlich überflüssig; entfernen, sobald ein CI-Lauf zeigt, dass das freie Feld ohne Neuladen erscheint und das 412 bestehen bleibt.
- 031a Bau · H8 · das 30-s-Polling der Seite hätte den 412 verhindern können; behoben: die Seite gilt für das Polling als
  verborgen (`visibilityState` per `addInitScript`), kein Wiederholen nötig.
- 031a Bau · Dienst (`viewSpeaker`) · Rollen ohne `question.identity.reveal` sehen nur „Redner N“; H8 nimmt die Kennung aus
  der Antwort der Registrierung statt aus einer Suche nach dem Namen.
- 030 nit · Auth-Fehlertexte fest `'de'`; HTTP-Build bündelt `CORPUS_DEMO` statisch; `Idempotency-Key` auch an Logout.
- Nachprüfung e2e · `apps/web/e2e/003-answers-stage.spec.ts:44` · ein Test mit zehn axe-Läufen und Screenshots braucht
  auf langsamer Maschine > 90 s · teilen oder `test.slow()`. → eigener kleiner Takt (Teilung an der Seitengrenze, je Test < 60 s, kein `test.slow()`), nicht Teil von
  031a/031b (Lesebefund zu 031, 30.09.2026); danach Kandidat für die Portierung in beide Betriebsarten.
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

- 033a R1 nit · `apps/api/src/observability/config.ts` · Rechte des Log-Verzeichnisses nicht geprüft (Dateien 0600) ·
  **erledigt mit 034b** (`config/groups.ts`: lstat, kein Symlink, `(mode & 0o027) === 0`; Eigentümer bleibt 037).
- 034b Review nit · `apps/api/src/config/schema.ts` · die letzte Komponente von `HV_EVENT_LOG` wird nicht aufgelöst (nur
  Demo) · `realpath` der Datei, wenn sie existiert.
- 034b Review nit · `apps/api/src/config/groups.ts` · `mode & 0o027` erfasst ACLs nicht · im Betrieb (037) ACLs auf dem
  Log-Verzeichnis ausschließen oder prüfen.

- takt-028 Nachprüfung minor · `apps/web/src/api/index.ts`, `BootScreen.tsx` · älterer Text „Demo event log is not an
  array.“ erscheint unübersetzt über `error.message` (R10) · wie `DemoLogParseError` über das Wörterbuch.

- takt-029 R1 nit · `apps/api/src/app.ts` (`/auth/me`) · DB-Fehler beim Laden der Rollen liefert 500 statt 503
  (Verfügbarkeit, keine Sitzung entsteht) · wie im Callback in 503 „unavailable“ umwandeln, mit Test.

- 033b R1 nit · `apps/api/src/app.ts` (`readEventsForMetrics`) · dupliziert den Snapshot-Helfer der Fachlesung · einen
  gemeinsamen Helfer herausziehen.
- 033b R1 nit · `apps/api/src/persistence/postgres.ts` · der Kennzahlen-Snapshot lädt `persons` mit, obwohl nur gezählt
  wird (für die volle Kettenprüfung nötig) · Begründung als Kommentar oder Kettenprüfung ohne Personenfelder.
- 033b R1 nit · `scripts/metrics-allowlist-check.mjs` · Personenbezugsbegriffe nur englisch (`bearbeiter`, `nutzer`,
  `mitarbeiter`, `redner` fehlen); Schutz wirkt über die Label-Whitelist · Liste per Spec-Änderung erweitern.
- 033b R1 nit · `apps/api/src/metrics/prometheus.ts` · `catalogJson as never` ohne Laufzeitprüfung · kleine Prüfung beim
  Laden.
- ~~033b R1 nit (vorbestehend, SC-10) · `.github/workflows/gates.yml` · zweites `actions/upload-artifact@v4` (evidence)
  ungepinnt~~ → erledigt in **031a** (voller Hash v4.6.2; dort auch `actions/checkout` und `actions/setup-node` im Job `gates`).
- 033b Codex P2 · `packages/domain/src/indicators.ts` / Fachbereichsprüfung in `api.ts` · ein konfigurierter Fachbereich
  mit der ID `unassigned` fällt in `hv_open_questions` mit den nicht zugewiesenen Fragen zusammen · `unassigned` als
  reservierte ID in der Fachbereichsprüfung ablehnen (mit 040, `replaceMeetingUnits`).

- 031a Codex P2 (#80) / Review N1 · `scripts/e2e-http-031.mjs` (~398) · SIGINT/SIGTERM oder die Gesamtfrist gewinnt das
  `Promise.race`, `body()` läuft weiter; ein Abbruch mitten in `startKeycloak()` oder `CREATE DATABASE` kann Container
  oder Testdatenbank nach dem Aufräumen anlegen · laufenden Startschritt abbrechen bzw. `body()` vor dem Aufräumen
  abwarten (nur lokal relevant; in CI räumt das Runner-Ende ab).
- 031a Review N2 · `scripts/e2e-http-031.mjs` · SIGKILL der Playwright-Prozessgruppe ohne Gnadenfrist · erst SIGTERM,
  kurze Frist, dann SIGKILL.
- 031a Review G1 · `apps/web/e2e/031-http-betriebsart.spec.ts` G1 · `test.fail` kann einen Fehlschlag aus anderem Grund
  als erwartet verdecken · erwartete Fehlermeldung ausdrücklich prüfen.
- 034b nit · Startzeile des Dienstes · IPv6-Adressen der Proxy-Quelle nicht in kanonischer Form ausgegeben · kanonisch
  ausgeben.
- takt-033b Review minor · `apps/web/src/api/useApiVersion.ts`, `App.tsx` · nach Rückkehr in einen Hintergrund-Tab bleibt
  die Ansicht bis zum nächsten 30-s-Takt alt (früher sofortiges Neuladen über den `/auth/me`-Refresh) · Polling-Hörer
  beim Sichtbarwerden einmal auslösen (`http.ts`).
- takt-033b Review minor · `apps/web/e2e/031-http-betriebsart.spec.ts` H10 · Probe nach dem Sichtbarkeitswechsel nicht
  geprüft; `networkidle` als Wartebedingung ist eine Heuristik · beide Zählungen am Ende prüfen, auf Produktsignal warten.

## Dienst: Kettenprüfung (aus takt-033)

- takt-033 Review nit 6 · `apps/api/src/persistence/postgres.ts` (`PROBE_SQL`) · die warme Digest-Abfrage liest je
  Anfrage alle Zeilen mit `envelope::text` (22–25 ms bei 2138 Ereignissen unter Last, linear mit der Loggröße) ·
  Digest je Zeile in einer Spalte speichern (Migration) oder den Präfix-Digest in Postgres materialisieren; erst mit
  Messung ab ca. 10.000 Ereignissen. (Seit dem Codex-P1-Fix heißt die Abfrage `CHAIN_SQL`.)
- takt-033 Nachprüfung Codex P1 minor · `apps/api/src/persistence/postgres.ts` (`ChainLoad.rowsRead`) · die Doku sagt
  „alle auf dem vollen Pfad“; nach einer abweichenden Probe zählt `rowsRead` zusätzlich die Suffixzeilen aus `CHAIN_SQL` ·
  Doku-Zeile anpassen.
- takt-033 Nachprüfung Codex P1 nit · `apps/api/src/persistence/postgres.ts` (`CHAIN_SQL`) · bei Digest- oder
  Lückenabweichung werden neuere Zeilen zweimal gelesen (`CHAIN_SQL`, dann `loadFull`) · nur Kosten im Seltenfall; mit
  dem Digest-Punkt oben zusammen betrachten.
- takt-033 Nachprüfung Codex P1 nit · Postgres-Tests takt-033 · pg-Warnung „Calling client.query() when the client is
  already executing a query“ (alter wie neuer Stand) · Ursache vor pg@9 klären.

## Sicherheit und Datenschutz aus der Nachprüfung — nicht Folgeliste, eingeplant

Nach dem Kopf dieser Datei gehören Befunde zu Sicherheit, Recht und Datenschutz nicht auf die Folgeliste (Codex P1 auf
#66). Sie sind eingeplant: **takt-028** (gebündelter Sicherheits- und Datenschutz-Takt, vor 033b) bzw. **034** (Grenzen
und Timeouts). Der Datenschutzbefund `claim.personId` (028) ist in **takt-027** behoben.

- ~~021c/takt-016 · `openapi.yaml` `LegalClearanceRequest.note`, `lateEntryReason` · kein `maxLength` (SP-2) · mit 034.~~
  → erledigt in **034a** (Vertrag 0.3.10: `maxLength` und `maxItems` für alle Freitext- und Listenfelder der Anfrageschemas)
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
- ~~027 · `apps/api/src/server.ts` · kein `statement_timeout`/`lock_timeout`/`idle_in_transaction_session_timeout` ·
  Pool-Timeouts setzen (vor Generalprobe).~~
  → erledigt in **034a** (`apps/api/src/limits/poolOptions.ts`, Werte 5 s, 3 s, 15 s)
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
- 033a R1 minor (Verfügbarkeit) · `apps/api/src/observability/accessLog.ts` · synchrones Schreiben je Anfrage; ein
  hängender Datenträger blockiert die Event-Loop · lokaler Datenträger als Betriebsvorgabe oder gepufferter Strom.
  → **037**
- 034a · Vertragsgrenzen (`maxLength`, `maxItems` der Anfrageschemas) · der Demo-Pfad im Browser validiert nicht gegen den
  Vertrag und nimmt längere Texte an; die Domäne prüft nur Kennungen ≤ 128 und `revokeRole.reason` ≤ 500 · Kernprüfung
  derselben Grenzen in der Domäne (fachliche Abweichung ohne Sicherheitsfolge, Demo nur lokal).
  → **043**
- takt-032 R1 minor 4 · `apps/web/src/api/http.ts` setzt `lastWriteEtag()` vor dem Lesen des Rumpfs; `ClassifyDialog`
  (schreibt auf die Frage) ist beim Erfassen nicht gesperrt · Fix in `http.ts`, Sperre im Dialog.
- takt-032 R1 minor 7 · `speakers/Page.tsx` `run` · ein Schreiben, das während eines anderen läuft, wird ohne Hinweis
  verworfen · kurzer Hinweis oder Warteschlange.
- takt-032 R1 nit 9 · `apps/web/src/features/capture/Page.tsx:170-176` · beim Wechsel des Redebeitrags stehen kurz die
  Karten des vorigen da (vorbestehend) · `contributionId` der Fragelesung im Paar speichern.
- takt-032 R2 minor · `apps/web/src/features/speakers/Page.tsx:85/299/389` · solange `isListStale` gilt (nach eigenem
  `updateSpeaker` bis zur neueren Liste, meist 0,5–1 s), scheitern Umsortieren und Anmelden still (Ablage springt zurück,
  Dialog bleibt ohne Hinweis offen) · Sperre sichtbar machen (Ziehen aus, Knopf `aria-disabled`, Rundensignal) oder Hinweis.
- takt-032 R2 nit · `capture/Page.tsx:224-226`, `speakers/Page.tsx` · `shownRef`/`latest` im passiven Effekt; zwischen
  Commit und Effekt kann `base` kurz veralten → normales 412 mit Banner · Ref im Layout-Effekt oder beim Landen setzen.
- takt-032 Codex P2 · `apps/web/src/features/capture/Page.tsx:218` · schlägt die automatische Aktualisierung der Wortmeldeliste nach `captureContribution` fehl, hebt `status === 'error'` die Sperre `speakerLocked` auf und erlaubt ein Schreiben mit veralteter Sprecherversion (412) · Sperre bis zu einer erfolgreichen Aktualisierung halten.
- takt-035 (Review): `docs/slices/031a-e2e-http-harness-anmeldung.md` Zeile 29 sagt noch „Vite-Entwicklungsserver“ (außerhalb Files allowed von 035); bei Gelegenheit auf „Produktions-Build hinter `vite preview`“ berichtigen.
- takt-035 (Review): Die H1-Zusicherung „Seite ist der Build“ prüft `modulepreload`-Links nicht (harmlos: sie stehen nur im Build und zeigen auf `/assets/`).
