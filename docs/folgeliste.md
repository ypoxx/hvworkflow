# Folgeliste — gesammelte Kleinbefunde

**Zweck:** Minor- und Nit-Befunde aus Reviews und Codex (P2 und kleiner), die nach dem schlanken Review-Modus
(AGENTS.md Regel 3, Entscheidung des Eigentümers vom 25.09.2026) nicht in der Scheibe nachgearbeitet werden. Ein
gebündelter Debug- und Review-Durchgang arbeitet die Liste später ab. Blocker, Major, P0/P1 sowie jeder Befund zu
Sicherheit, Recht oder Datenschutz gehören **nicht** hierher, sie werden in der Scheibe behoben.

**Format:** eine Zeile je Punkt: Herkunft (Scheibe, Runde) · Datei:Zeile · Befund in einem Satz · Vorschlag.

## Vor Rollout: Sicherheit und Leistung (eigene Takte, keine Kleinbefunde)

Diese Punkte stehen hier nur, damit sie nicht verloren gehen. Sie sind **keine** Folgelisten-Nits und werden vor jedem Rollout
in eine geteilte Umgebung als eigene Takte gebaut (Übergabe 06.10.2026).

- **`listEvents` ohne Akteurschutz: in Arbeit als takt-056 (#177), nicht aufgeschoben** · `apps/web/src/api/liveStore.ts` ·
  eine vor Akteurwechsel oder `clear` angeforderte Ereignisseite konnte die neue Person erreichen (gleiches Muster wie Codex P1
  auf #168). Nach Codex P1 auf #176 als Sicherheitsbefund sofort gebaut: `listEvents` über `guarded()`, Test zuerst rot. Diese
  Zeile entfällt mit dem Merge von #177.
- **Zwischenspeicher des Leitstands (vor Rollout)** · W10 auf dem CI-Läufer 57,7 ms gegen das Ziel 50 ms · Eintrag im Abschnitt
  „Leitstand (aus 061)“ (Lauf 37468958219).
- **`source-map-js` 1.2.2 (vor Ablauf der Ausnahme)** · nach 2026-10-07T14:08Z anheben, Ausnahme 1241209 entfernen, bevor sie am
  2026-10-14 abläuft · Eintrag „takt-051 Folge“ im Abschnitt „Skripte“.

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
- ~~010c CI-Korrektur minor · `apps/web/e2e/010c-lesezustand.spec.ts:118` · ein `import()` mit `await` bleibt in
  `installHarness` (in 010d auf Abfrage umgestellt, prüfen ob erledigt) · ggf. streichen.~~ → erledigt in **010d**
  (Ziel 5: `installHarness` startet die Importe und fragt den Zustand ab; geprüft in takt-050).
- 090 R2 nit · `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (`expectCleared`) · Prüfung von `#main` per
  `not.toContainText` sieht keine Feldwerte und fügt nichts hinzu · streichen oder auf Feldwerte umstellen.
- takt-049 · `apps/web/playwright.config.ts` · kein `actionTimeout`: Jede wartende Locator-Aktion in einem
  `expect.poll`-Rückruf kann über die Poll-Grenze hinaus hängen, und der Poll ruft dann nicht erneut auf · ein globales
  `actionTimeout` (z. B. 10 s) prüfen, dabei alle Dateien laufen lassen.
- takt-049 · `apps/web/e2e/045-verweigerung.spec.ts:160` · `count()` und danach `getAttribute('aria-pressed')`
  (gleiche Form, außerhalb eines Polls, der Umschalter bleibt stehen) · bei Gelegenheit auf eine atomare Lesung
  umstellen.
- takt-050 · `apps/web/e2e/028-konflikte.spec.ts:20, 55, 77, 98` · `await import(...)` im Evaluate (gleiche Klasse wie
  010b R4B) · auf `support/app-modules.ts` umstellen, Evaluates synchron.
- takt-050 · `apps/web/e2e/053-steuerung.spec.ts:317` · `await import(...)` und danach `await` auf `listQuestions` und
  `assignQuestion` im Evaluate · Hilfe nutzen, Ausgang an `window`, abfragen.
- takt-050 · `apps/web/e2e/055b-antwortformat.spec.ts:307, 462` · `await import('…/domToBody')` im Evaluate · Hilfe mit
  eigener URL nutzen.
- takt-050 · `apps/web/e2e/takt-037-vorschlagsauswahl.spec.ts:56` · `await import(...)` und `await` auf App-Aufrufe im
  Evaluate · wie 053.
- takt-050 · `apps/web/e2e/010c-lesezustand.spec.ts:118–160` · eigenes `installHarness` mit gleichem Zweck, das Promise
  hängt nicht an `window` · auf die gemeinsame Hilfe umstellen.
- takt-050 · `apps/web/playwright.config.ts:27–28` und `.github/workflows/gates.yml:152` · lokal Chromium 141 (fest
  abgelegt), in CI Headless Shell 151 (Revision 1234): Browserabhängige Wackler lassen sich lokal nicht nachstellen ·
  Revision 1234 lokal bereitstellen oder CI auf denselben Browser festlegen (Eigentümer, Netzrichtlinie).

- takt-049 Review (Sonnet, 05.10.2026) minor · `apps/web/e2e/support/focus-list.ts:28` · `readFocusList` ruft `checkVisibility()` ohne
  Optionen: `visibility:hidden` und Nullgröße zählen als sichtbar (Playwright wertet beides als versteckt) ·
  `{ visibilityProperty: true }` und eine Prüfung der Box.
- takt-049 Review (Sonnet, 05.10.2026) minor · `apps/web/e2e/support/focus-list.ts` (T1) · der Test belegt das Verhalten von Playwright,
  nicht `waitForMine` selbst; kein eingecheckter Test bricht, wenn `waitForMine` zurückgedreht wird · einen Test, der an der
  Lesefunktion scheitert.
- takt-049 Review (Sonnet, 05.10.2026) nit · `apps/web/e2e/support/focus-list.ts` · Zeilen werden nur innerhalb von `focus-list` gelesen
  (gleichwertig, nur vermerkt); die 2-s-Grenze misst mit `performance.now`.
- ~~054 F6 · `apps/web/e2e/054-fokusansicht.spec.ts` (in-process F6 „coordination: the notice, no rows“) · `waitForMine` lief nach 15 s
  in den Timeout (#159, Job 111855623850, Commit `7928053`, Artefakt des Laufs 37337216828)~~ → erledigt in **takt-049** (atomare Lesung; Ursache war die zeilenweise Lesung der Liste).
- 010b Runde 4 (Lauf 37347756649, Job 111890560965, Commit `d17bcbf`, 05.10.2026) · `apps/web/e2e/010b-lesepfade.spec.ts:802` (Runde 4 B,
  Bühne, Rollenwechsel bei „Nur Bühne“) · `page.evaluate: Resulting promise was garbage collected`, bisher einmalig · → erledigt in
  **takt-050** (#165 `924266a`); `evaluate` nicht über Navigation oder Rollenwechsel hinweg offen halten.
- takt-050 Review (Sonnet, 05.10.2026) minor · `apps/web/e2e/support/app-modules.ts:74-81` (mit #165) · die Pollmeldung nennt immer
  „state 'loading' means the dynamic import never settled“, auch bei Zustand `failed: …` · neutral formulieren oder bei `failed` früh
  mit dem Fehlertext abbrechen.
- takt-050 Review minor · `apps/web/e2e/support/app-modules.ts:52-56` · nach `failed` startet ein zweiter Aufruf von `loadAppModules`
  einen neuen Import (impliziter Neuversuch über Aufrufe) · einen Satz Kommentar oder `failed` festhalten.
- takt-050 Review nit · `apps/web/e2e/010b-lesepfade.spec.ts:809` (R4A) · der Poll auf `expect.any(Number)` zeigt ein `failed: …` nur als
  Zeitüberschreitung (der empfangene Wert steht in der Meldung).
- Doku 06.10.2026 · Job `e2e-http` (`scripts/e2e-http-031.mjs`, `.github/workflows/`) · mit 060 und 061 liegt die Laufzeit bei
  7:24–7:35, also über der Warnschwelle 6:30 und unter der Grenze 12:00 · die Entscheidung „Job teilen“ aus takt-046 ist fällig;
  eigener Takt vor der nächsten Scheibe mit neuer `e2e-http`-Datei.


## Dienst: Anmeldung (vor oder mit 029)

- 029a R1 minor 3 · `apps/api/src/actor.ts:1-5` · Dateikopf nennt die Datei noch „demo authentication adapter“, sie
  enthält jetzt Port und Adapterwahl · Kommentar anpassen.
- 029a R1 minor 4 · `apps/api/src/server.ts:17` · Log-Hinweis wertet `HV_DEMO` selbst aus statt die Wahl aus
  `createApp` zu übernehmen · gewählten Adapternamen zurückgeben und loggen (spätestens mit 029).
- ~~029a R1 nit 6 · `packages/contract/openapi.yaml` · 401 für `seedDemo`, `getMeeting`, `registerSpeaker` nicht
  dokumentiert (Ausnahme `UNDOCUMENTED_STATUS_EXCEPTIONS`) · 043.~~ → erledigt in **043a** (Vertrag 0.4.0, Ausnahmeliste leer).

## Sprecher und Zustandstabelle (aus 080)

R1 minor 3, 4, 5 und nit 6 (leerer PATCH, legalRef R-SPK-01, Tests 412-vor-409 und Wiederholung, EN-Spaltenkopf):
erledigt in takt-015.

- 080 Spec Nicht-Ziel · `apps/web/src/features/speakers/SpeakerRow.tsx` · Knopfwahl nach Status statt aus `_actions`
  (Regel 4/5) · je Wortmeldung erlaubte Übergänge als Aktionen ausgeben.
- 080 Spec Nicht-Ziel · `packages/domain/src/transitions.ts` · kein Guard „nur ein Mikrofon offen“ auf R-SPK-01 (die
  Oberfläche beendet die laufende Rede zuerst) · Guard mit Regel-id.
- ~~080 → 043 · `packages/contract/openapi.yaml` · `SpeakerUpdate.reason` und 409 für `updateSpeaker` aufnehmen, Ausnahme
  in `apps/api/src/__tests__/helpers.ts` streichen, `kind`/`requestedMinutes` löschen.~~ → erledigt in **043a** (Vertrag 0.4.0).
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

## Strom-Domäne (aus 035a)

- 035a Bau · `packages/domain/src/events.ts:150` · der Kommentar zu `ReadEvent` nennt `maskEvent (api.ts)`, die
  Funktion liegt seit 035a in `stream.ts` · Verweis bei der nächsten Änderung an `events.ts` anpassen.
- 035a Bau · `packages/domain/src/api.ts` (`idempotent`) · kein Befehl auf eine Frage erzeugt heute `IdempotencyRecorded`
  mit der Frage als `subjectId` (jeder Fragenbefehl hängt ein Ereignis an); Test 2b deckt den Fall über ein direkt
  angehängtes Ereignis ab · bei einem künftigen No-op-Befehl den 2b-Lauf auf den echten Befehl umstellen.
- 035a Review nit 5 · `packages/domain/src/stream.ts` (`ChangeBuilder.build`), `openapi.yaml` `StreamChange.meetingId` ·
  der Vertrag sagt „when it is one“, der Code setzt `meetingId` nur, wenn alle beitragenden Ereignisse eines Stapels zu
  einem Jahrgang gehören; die Lücke „Stapel über zwei Jahrgänge“ ist nicht beschrieben · Wortlaut in Vertrag und Kommentar angleichen.
- 035a Review nit 6 · `packages/domain/src/stream.ts` (`EVENT_SUBJECTS.IdempotencyRecorded`) · ein Beobachter erhält für
  `IdempotencyRecorded` auf einer vorgelesenen Frage deren Kennung (die Historie ändert sich, Bauklärung C1) · bewusst
  hinnehmen oder im Test 11 ausdrücklich festhalten.
- 035a Review nit 7 · `packages/contract/CHANGELOG.md` (0.3.11) · Einordnung der Versionsstufe (Patch) trotz geänderter
  Semantik der vorab erklärten, nie ausgelieferten Operation · Begründung im CHANGELOG ergänzen oder Stufe prüfen.

- 035a Nachprüfung minor 1 · `packages/domain/src/api.ts` (catch um `snapshotBefore` im Projektions-Hörer) · ein Fehler
  im Vorher-Abzug wird still verschluckt; die Sicht wird dann nur nach „nachher“ beurteilt (enger, nie weiter), aber
  ohne Spur · Fehler über `onIntegrityError` oder einen Diagnose-Haken melden, das Verschlucken behalten.
- 035a Nachprüfung minor 2 · `packages/domain/src/api.ts` (catch um `visibleMessages` in `subscribe`) · ein Fehler dort
  liefert still `[]` statt der Ereignisse (schließt nach innen, nie mehr Daten) · vor dem nackten Signal melden.
- 035a Nachprüfung nit 4 · `apps/api/src/__tests__/postgres-stream035a.test.ts` (Kopf) · der Test ist ein Happy-Path-Pin;
  die Ursache des damaligen `e2e-http`-Rots war die Basis (takt-039), nicht 035a · im Kopf vermerken.

## Strom-Dienst (aus 035b)

- ~~035b Bau · `packages/contract/openapi.yaml` (`streamEvents`, Abschnitt „Rights per message“) · der Satz „gap-free in
  `seq`“ gilt nur ohne `meetingId`-Filter; gebaut: mit Filter kommt jedes Ereignis dieses Jahrgangs nach dem Cursor genau
  einmal und aufsteigend, `id` bleibt global (Lücken = Ereignisse anderer Jahrgänge), Ereignisse ohne Jahrgang gehören
  nicht zum Filter; der Kopf rückt über `cursor` mit dem Heartbeat nach · Wortlaut im nächsten 0.3.x-Vertragsstand angleichen;
  vor dem Bau von 036b beheben (Review 035b minor 7).~~ → erledigt in **takt-040** (Vertrag 0.3.12, Absatz „`meetingId` filter“).
- ~~035b Bau · `packages/contract/openapi.yaml` (`components/headers/RetryAfter`) · die Beschreibung nennt nur die Werte
  für 429 und `PersistenceBusy`; `StreamUnavailable` sendet immer 30 (Stromgrenze, Migrationen offen, Persistenz beschäftigt),
  auch die stromeigenen 429 senden 30; im Schema 1–60 · Beschreibung ergänzen.~~ → erledigt in **takt-040** (Vertrag 0.3.12).
- ~~035b Bau · `packages/contract/openapi.yaml` · keine Operation dokumentiert 500; ein Öffnen bei verletzter Kette antwortet
  wie jede Fachanfrage 500 (Test 25 liest es deshalb über `app.request`, nicht über `req()`) · mit 0.4.0 (043) klären.~~ → erledigt in **043a** (500 `InternalError` an jeder Operation).
- 035b Bau · `apps/api/src/server.ts:58` · die `serverOptions` sind nicht exportiert; der Test mit echtem Server wiederholt
  die drei Zahlen · bei der nächsten Änderung an `server.ts` als Konstante exportieren und im Test verwenden.
- 035b Bau · Spec 035b „Befund“ und m5 · `req()` (`helpers.ts`) puffert eine SSE-Antwort nicht und kehrt mit den Köpfen
  zurück; der Test-Leser öffnet deshalb über `req()`, so zählt das Abdeckungstor `streamEvents` · Spec-Wortlaut angleichen.
- 035b Bau · Spec 035b Test 12 · „Migrationen offen → 503“ ist ohne Postgres nicht herstellbar; der Fall steht in
  `postgres-stream035.test.ts` („12 (Postgres)“) · hinnehmen.
- 035b Nachprüfung nit · `apps/api/src/stream/route.ts` (`overLimit`) · die Bytes einer `change`-Nachricht zählen in der
  Warteschlange als JSON-Länge + 64, im laufenden Stapel als echte Rahmenbytes · beide Stellen auf die Rahmenbytes vereinheitlichen.
- 035b Nachprüfung nit · `apps/api/src/__tests__/stream035.test.ts` (R8b) · der Test sichert nur den Abzug der
  Nachrichtenzahl, nicht den der Bytes im laufenden Stapel · Variante mit gesenkter `backlogBytes` ergänzen.
- 035b Nachprüfung minor · `apps/api/src/__tests__/postgres-stream035.test.ts` (24, 24b) · die Tests sind an die Phase
  des 1-s-Takts des Verteilers gebunden; ein Mutant, der jeden zweiten Takt auslässt, bleibt grün (24 mit 128 ms, 24b mit
  1846 ms) · Messung in der ungünstigsten Phase mit Schranke `reloadTickMs + spacingMs + Marge` gehört zum B11-Nachweis
  im Lasttest 071.
- 035b Nachprüfung minor · `apps/api/src/__tests__/postgres-stream035.test.ts` (28) · im vollen Lauf unter Last zählte eine
  von rund 200 Stichproben eine belegte Verbindung (Gates-Lauf auf 8983814, Wiederholung grün); vermutlich ein Backend im
  Übergang „active → idle“ nach der Antwort · Stichprobe nur werten, wenn derselbe Backend-Zustand zweimal hintereinander besteht.
- 035b Nachprüfung minor · `apps/api/src/stream/route.ts` (Prüfung `hub.loaded()` nach `ensureFresh()`) · die Zeile ist
  ungetestet; die Mikrotask-Lücke zwischen `ensureFresh` und Akteurauflösung ließ sich mit den vorhandenen Hooks nicht
  deterministisch erzeugen, eine Mutante ohne die Zeile überlebt · Hook an dieser Stelle ergänzen und testen.
- 035b Gates-Lauf · `apps/api/src/__tests__/postgres-limits034a.test.ts` („query hangs past the service timer“, „COMMIT
  phase hangs“) · lokal einmal rot unter Last (Last ≈ 5 auf 4 Kernen, 8983814), allein dreimal grün, in CI bisher grün ·
  Zeitfenster der 034a-Tests unter Last prüfen.
- ~~takt-040 Review nit 5 · `packages/contract/openapi.yaml` (`components/responses/StreamUnavailable`) · sagt „one response
  for both causes“, `RetryAfter` zählt drei Ursachen · Zählung bei der nächsten Vertragsänderung angleichen.~~ → erledigt in **043a** (Vertrag 0.4.0).
- 035a Vertrag nit · `packages/contract/openapi.yaml` · `contract:lint` meldet vier `no-unused-components` für die
  `Stream*`-Schemas, die nur über `x-sse-messages` verwendet werden; OpenAPI 3.1 kann SSE-Nachrichten nicht anders
  ausdrücken · hinnehmen, bei 0.4.0 (043) erneut prüfen.

## Bühne und Wortmeldeliste (aus takt-039)

- ~~takt-039 Befund 2 · `apps/web/e2e/002-speakers-capture.spec.ts:84` · Umsortieren per Tastatur: ArrowDown blieb im
  Projekt `http` ohne Wirkung („Position 6 von 7“).~~ → erledigt in **takt-039**: dnd-kit hängt den Keydown-Hörer erst
  per `setTimeout` an (`@dnd-kit/core` 6.3.1, `core.esm.js:1158`); `liftWithKeyboard` (`e2e/support/keyboard-drag.ts`)
  in 002, 013a und H12, Nachweis `039-tastatur-anheben.spec.ts`.
- takt-039 Review minor 3 · `apps/web/src/features/stage/lib.test.ts:199-206` · Test (c) ist eine Tautologie
  (`shownQuestion(null)` ist `null`); der Schutz nach Akteurwechsel (`setStage(null)` im Render, `Page.tsx`) ist damit
  nicht geprüft · Komponenten- oder e2e-Test, der nach einem Akteurwechsel keinen Druck auf den vorigen Datensatz zulässt.
- takt-039 Review minor 4 · `apps/web/src/features/stage/Podium.test.tsx:53-66` · der Test ruft `nextPress` direkt statt
  des gerenderten `onClick`; dass der Knopf `nextPress` mit der gezeichneten Frage verdrahtet, prüft er nicht · Weitergabe
  über gerenderte Props prüfen (ohne neue Testabhängigkeit) oder e2e-Zusicherung auf die Frage-ID im `POST …/delivery`.
- takt-039 Review minor 6 · `apps/web/e2e/031-http-betriebsart.spec.ts:507` · die Vorbedingung von H12b („Ziel in der
  unteren Hälfte“) hängt vom Korpusstand ab, den 002, 021b, 021c, H8 und H9 hinterlassen · Lage des Ziels im Test
  herstellen (Scrollposition setzen) statt vorauszusetzen.
- takt-039 Nachprüfung minor 7 · `apps/web/src/features/stage/Page.tsx:476-479` · nach einer Ablehnung (412/409) bleibt der
  Rückgabedialog auf der Frage in der alten Version offen; ein erneutes Absenden scheitert wieder · Dialog schließen oder
  „Frage hat sich geändert, bitte neu öffnen“ zeigen, nie still auffrischen.
- takt-039 Nachprüfung nit · `apps/web/src/features/stage/lib.test.ts:242` · der Kommentar nennt `qb`, das im Test nicht
  vorkommt · Kommentar kürzen oder `qb` als gezeichnete Frage wirklich verwenden.
- takt-039 Nachprüfung nit (geerbt) · `apps/web/e2e/010c-lesezustand.spec.ts:95` · `expectOneToast` wartet mit
  `waitForTimeout(300)` · auf ein Produktsignal umstellen (gebündelt mit den übrigen `waitForTimeout` der Datei).
- takt-039 Review nit 8 · `apps/web/src/features/stage/Page.tsx:236-242` · der Kommentar zur `writing`-Bereinigung im
  `useLayoutEffect` versprach mehr, als der Code sichert · in takt-039 entschärft (nur Kommentar); erledigt.

## Live-Store (aus 036a)

- 036a Bauhinweis · `apps/web/src/api/liveStore.ts` · der In-Process-`subscribe` meldet `[]` ohne `change`, wenn für den Leser nichts Lesbares geändert wurde; nach Entscheidung 3 leert das den ganzen Puffer (Verhalten wie vor 036a, aber unnötige Abrufe) · im Demo-Adapter nur melden, wenn es etwas zu melden gibt, oder einen leeren Aufruf als „nichts“ kennzeichnen.
- 036a Nachprüfung nit 3 · `apps/web/src/api/liveStore.ts` · ein abgelaufener Eintrag ohne Claim bleibt im Speicher, bis
  er gelesen oder verdrängt wird (höchstens 200 Einträge); ausgeliefert wird er nie · optionales Aufräumen in `keep`/`read`.
- 036a Review minor 5 · `apps/web/src/features/speakers/*` (mehrstufige Abläufe, z. B. `moveSpeakerToRound`) · wird ein
  Lesezugriff nach einem strukturellen Akteurwechsel zurückgehalten (Entscheidung 4, unerledigtes Promise), bleibt die
  Busy-Referenz des Ablaufs bis zum Neu-Einhängen gesetzt · den Ablauf an den Akteur binden und beim Akteurwechsel freigeben.
- 036a Review nit 11 · `apps/web/src/api/liveStore.ts` · der Themenweg (`change`/`event` → gezielte Invalidierung) ist nur
  durch Unit-Tests belegt, kein e2e prüft ihn gegen den echten Adapter · mit 036b (H11) e2e-Nachweis ergänzen.
- 036a Bauhinweis · `apps/web/src/api/index.ts` · bei 401 läuft `clear()` zweimal (HTTP-`onUnauthorized`, dann `onActorChange(undefined)`), die Hörer laufen zweimal; harmlos, die Hülle hängt im selben Stapel aus · einen der beiden Aufrufe weglassen oder `clear()` bei leerem Puffer ohne Hörer-Aufruf.
- 036a Review nit 9 · `apps/web/src/api/liveStore.ts` (Wasserzeichen-Prüfungen bei Auslieferung, Aufnahme und
  `mark = undefined` in `clearAll`) · doppelt abgesichert und ungepinnt, die Invalidierung durch `raiseMark` verdeckt sie
  · direkten Test ergänzen oder die redundanten Prüfungen streichen.
- 036a Review nit 10 · `apps/web/src/api/liveStore.ts` (Verdrängung) · FIFO statt nach letzter Nutzung; ein ständig
  gelesener `getMeeting`-Eintrag wird als ältester verdrängt · spec-konform, kostet nur Abrufe; bei Bedarf LRU.
- 036a Review nit 12 · `apps/web/src/api/index.ts`, `liveStore.ts` · `clear('logout')` ruft die Hörer, `useApiVersion`
  zählt zusätzlich den Akteur `undefined`; bei 401 läuft `clear` doppelt · harmlos, die Shell hängt ab.

## Strom-Client (aus 036b)

- 036b Bau · `apps/web/src/api/http.ts` (N5) · die Invalidierung nach der ersten `cursor`-Nachricht trifft Listenlesungen
  eines Themas ganz, auch solche nach dem Senden der Stromanfrage (nur zu viel) · epochgebundene Invalidierung als API in
  `liveStore.ts` (036a-Datei).
- 036b Review minor 4 · `apps/web/src/api/http.test.ts` · `end {unavailable}` und der Weg offline/online haben keinen
  Unit-Test · je einen Test ergänzen.
- 036b Review minor 5 · `apps/web/src/app/ConnectionStatus.tsx` · der Live-Bereich sagt „Stand von“ außerhalb von `live` bei
  jeder Lesung neu an · nur die Phase in `aria-live`, die Zeit außerhalb.
- 036b Review minor 7 · `apps/web/e2e/031-http-betriebsart.spec.ts` (H13 Schritt 1a) · das Trace-Fenster beginnt erst nach
  der Antwort in B · vor dem Klick beginnen.
- 036b Review minor 8 · `apps/web/src/api/http.ts` · der Neuaufbau nach `end {rotate}` ist synchron (alle Ströme eines
  Prozesses gleichzeitig) · 0–2 s Zufallsanteil, ggf. volles Jitter.
- 036b Review nit 9 · `apps/web/src/api/http.ts` · `hiddenTimer` wird in `endForSession` nicht geräumt, `detachEnvironment`
  wird nie gerufen · räumen bzw. beim Schließen lösen.
- 036b Review nit 10 · `apps/web/src/api/index.ts`, `http.ts` · ein 401 beim Öffnen leert den Live-Store dreimal
  (`onStreamEnd`, `onUnauthorized`, `onActorChange(undefined)`) · auf einen Aufruf zusammenführen.
- 036b Nachprüfung · `scripts/e2e-http-031.test.mjs:229` · die Strukturprüfung nennt nur die H8-Namen, nicht die H13-Texte
  (der Zugriffslog-Scan selbst deckt sie über `WRITTEN_TEXTS` ab) · H13-Texte in die Prüfung aufnehmen (Datei nicht in 036b).
- 036b Codex P2 · `apps/web/src/api/http.ts` (`onOnline`, `connection.ts`) · ein offener Strom, der offline → online
  übersteht, bleibt in `reconnecting`, obwohl Daten ankommen (`synced` stellt `live` nicht wieder her) · `synced` bei
  offenem Strom auf `live` führen oder bei `online` mit offenem Strom `opened` melden.
- 036b Nachprüfung · `apps/web/src/api/http.ts` (`closeStream`, `openStream`) · nach einem Akteurwechsel oder `noRole`
  während einer Pause zeigt die Anzeige `idle` statt `polling`, bis der behaltene Wiederholversuch fällig ist (Zeitverhalten
  unberührt) · beim Behalten des Wiederholversuchs die Phase erneut melden.
- 036b Bau · `apps/web/src/app/ConnectionStatus.tsx` · „Verbindung wird aufgebaut“ erscheint bei jedem Laden kurz und
  wird vom Statusbereich angesagt · `connecting` erst nach 1–2 s zeigen.

## Historie (aus takt-038)

- takt-038 Review minor 1 · `apps/web/src/features/history/Page.tsx:189-192` (`moreResults`, `olderRows`) · die Seitenzahl
  wird aus dem Zustand abgeleitet, der Zustand selbst aber nie zurückgesetzt; nach Rückkehr zum selben Akteur oder zur
  selben Suche kommen die weiteren Seiten wieder (neu gelesen unter dem richtigen Schlüssel, kein Datenleck), Ziel 1
  verlangt „verwerfen“ · beim Wechsel von `pagingKey`/`actorId` zurücksetzen, Muster wie `queryActorId` (`Page.tsx:180`).
- takt-038 Review minor 2 · `apps/web/src/features/history/lib.ts:176` · die Sprungregel aus Ziel 2 ist ungetestet
  (Mutante `if (false)` überlebt, weil die Fenstergrenze dasselbe Ergebnis erzeugt); weitere Wächter (`:82`, `:88`,
  `:181`, `:183`, `:138`) ungepinnt · in (c2) die Aufruffolge prüfen (`calls[1]` = `{after: head − 5000, limit}`).
- takt-038 Review minor 3 · `apps/web/src/features/history/lib.ts:173-179` · im Sprungpfad wird die erste Seite verworfen
  und neu gelesen (bis 10 000 statt 5 000 Ereignisse) · den Teil mit `seq > head − windowLimit` behalten und dort
  weiterblättern.
- takt-038 Review minor 4 · `apps/web/src/features/history/lib.ts:86-93` · Lücken an Seitengrenzen werden nur über die
  Anzahl erkannt; ein Tausch bei gleichem `total` zwischen dem Lesen von Seite n und n+1 bleibt unbemerkt · Seite n+1 mit
  einer Überlappung von einem Eintrag lesen und die Überlappungs-`id` prüfen, ohne Vertragsänderung.
- takt-038 Review minor 5 · `apps/web/src/features/history/Page.tsx:372-429` · die Verdrahtung (Neu-Lesen mit
  `pageCount`, Rückfall auf Seite 1, `sameList`) ist ungetestet, kein e2e berührt `history-results-load-more`,
  `history-results-back-to-first` oder `history-stream-older` · ein In-Process-e2e-Schritt „Weitere laden“ → 230 von 230.
- takt-038 Review nit 6 · `apps/web/src/features/history/lib.ts:138`, `:183` · nach einer kurzen Seite springt der Cursor
  auf den Kopf; kürzt ein Dienst `limit` unter `pageSize`, fehlen Ereignisse dauerhaft (heute nicht möglich) · Annahme
  im Code kommentieren.
- takt-038 Review nit 7 · `apps/web/src/features/history/lib.ts:175` · eine Rücksicherung, deren `lastSeq` schon wieder
  über dem alten Cursor liegt, wird nicht erkannt · mit dem `reset` aus 035b im Client (036b) verbinden.
- ~~takt-038 Review nit 8 · `apps/web/src/i18n/parity.test.ts:161` · Testtitel nennt noch 507 statt 510 · anpassen.~~ → erledigt in **036b** (Titel und Pin auf 515).
- takt-038 Review nit 9 · `docs/evidence/takt-038-historie-weitere.png` · zeigt den Zustand nach dem Klick, nicht den Knopf
  selbst · bei Gelegenheit ein zweites Bild vor dem Klick.

## Betriebspaket (aus 037a)

- 037a S17 (frischer Agent, 03.10.2026, `docs/evidence/037a-installation-befolgt.txt`) · `docs/betrieb/installation.md`,
  `scripts/stack.mjs` · fünf kleine Verbesserungen: (1) Zertifikatsabbruch beim Bau nennt `HV_STACK_BUILD_CA` direkt,
  Proxy-Hinweis schon in §2/§3; (2) pnpm-Warnung „node_modules missing“ als harmlos erklären; (3) Registries nennen
  (Docker Hub, quay.io) für Firmen-Firewalls, eigene Fehlersuche-Zeile für eine gesperrte Registry; (4) `stack:login` ohne
  `pnpm install`: Meldung „Playwright laden“ mit Abhilfe; (5) `stack:smoke`/`probe` ohne laufenden Stack: klarer Satz
  statt Diagnoseblock. Keine sachlich falsche Angabe gefunden.

- 037a Bau · `apps/api/src/persistence/migrations.ts` (über `migrate-cli.ts`) · pg 8.23 meldet bei jedem Migrationslauf
  „DeprecationWarning: Calling client.query() when the client is already executing a query“ (auch im Protokoll des
  Einmaldienstes `migrate`) · Abfragen dort strikt nacheinander awaiten, bevor pg 9 das entfernt.
- ~~037a Bau · `scripts/stack.mjs` (Stufe „Stack starten“) · ein nicht ladbares Basis-Image (gesperrter Registry-Host,
  Rate-Limit) zeigt sich nur als Stufenname, ohne das betroffene Image · vor `up` jedes nicht lokal vorhandene Image
  einzeln laden und bei Fehler den Image-Namen (kein Wert) im festen Satz nennen.~~ → erledigt im Nachtrag nach CI zu **037a** (Diagnose mit der Meldung von Compose).
- 037a Review · `deploy/compose/compose.yaml` · nach einem Neustart von Keycloak meldet der Stack sich gesund, obwohl Dienst
  und Web kein Ziel mehr haben (Healthchecks laufen im Container, nicht durch den Proxy) · Healthcheck des Webs durch den
  Proxy auf `/auth/transparency-notice`, `depends_on.restart: true` für api und web, oder `resolver` in nginx.
- 037a Review · `scripts/stack.mjs` (`stackContext`, `readState`) · `stack:reset` scheitert an einer beschädigten
  `state.json` (JSON-Fehler), und `assertOutsideRepository` wirft keinen `StackRefusal` (nur der Stufenname erscheint) ·
  `reset` ohne lesbaren Zustand mit dem leeren Ersatzverzeichnis fahren, die Prüfung in einen festen Satz übersetzen.
- 037a Review · `scripts/stack.test.mjs` (S10 „formatters … never carry a secret“) · der Test kann nicht scheitern, weil
  die Formatierer die Secrets gar nicht bekommen · Formatierer mit einem Zustand aufrufen, der die Marker enthält und
  ausgegeben werden könnte, oder den Test umbenennen.
- 037a Review · `scripts/stack.mjs` (Rauchtest S12.2) · der Test erkennt nicht, ob die 413 von nginx oder vom Dienst kam ·
  Körper oder `Server`-Header der Antwort prüfen (nginx-Fehlerseite gegen problem+json des Dienstes).
- 037a Review · `deploy/docker/nginx.conf` · Präfix-Locations `/v1/` und `/auth/` sowie `location /v1/stream` statt
  `location = /v1/stream` · exakte Location für den Strom, Präfixe wie der Vite-Proxy dokumentieren.
- ~~037a Review · `scripts/stack-login.mjs` · fester Chromium-Pfad der Arbeitsumgebung~~ → erledigt in **037a**
  (`PW_CHROMIUM_PATH` oder Playwrights eigenes Chromium).
- 037a Review · `deploy/compose/compose.yaml` · keine Ressourcengrenzen (Speicher, CPU, PIDs) für die Dienste ·
  `mem_limit`, `cpus`, `pids_limit` mit Werten aus einem gemessenen Lauf.
- ~~037a Nachweis (PR #148, Lauf 37222611650) · Sonde `postgres-restart` in `scripts/stack.mjs` · der Neustart dauerte 0,4 s, der Watcher sah weder den schlechten noch den wiederhergestellten Zustand; die Sonde belegt damit nichts · Beobachtung vor dem Neustart dichter takten oder den Neustart künstlich verlängern, Wartezeit gehört zu 037b. **Zum zweiten Mal rot** (PR #154, Lauf 37239065778; Wiederholung grün, nicht Ursache der Scheibe) · die Zeitlücke der Sonde ist damit kein Zufall mehr → **eigener Takt vor 037b** (Neustart verlängern oder Beobachtung dichter takten).~~ → erledigt in **takt-045** (stop, Ausfall gesehen, start statt `restart`).
- 037a Vorschlag (takt-045, U2) · `apps/api/src/persistence/` · entnommener `pg`-Client ohne `error`-Zuhörer stürzt den Prozess beim Postgres-Stopp ab, nachgestellt mit pg 8.23; ob der Dienst einen Client zwischen zwei Abfragen hält, ist zu prüfen · eigene Scheibe, Klasse mittel.
- 037a Review · `docs/evidence/037a-stack-protokoll.txt` · das Protokoll entstand auf „938ffbe + Arbeitsstand“, nicht auf
  einem benannten Commit · bei der nächsten Wiederholung (mit erreichbarem quay.io) auf einem benannten Commit neu aufnehmen.

- takt-045 Review (Opus, 05.10.2026) minor 1 · `scripts/stack.mjs:718,793` · ein misslungener Start (`startCode` ≠ 0) lässt Postgres
  gestoppt, die Installationsseite nennt nur Strg+C · Hinweis `pnpm stack:up` oder feste Zeile bei `startCode` ≠ 0. **Offen.**
- takt-045 Review minor 2 · `scripts/stack.mjs:780-791` · wirft `observePostgresRestart`, fehlen die Zeile S16.1 und der
  Zustand des Dienstes · `try/finally` um den Aufruf. **Offen.**
- takt-045 Review minor 3 · `scripts/stack.test.mjs` · Tests fehlen für: Wächter endet früh, `startPostgres` wirft, langer Stopp
  (> 45 s) startet sofort. **Offen.**
- takt-045 Review minor 4 · `scripts/stack.mjs:716-720` · ein Fehler von `startPostgres` im `finally` verdrängt den Fehler des
  Stopps · beide melden oder den ersten Fehler behalten. **Offen.**
- takt-045 Review nit · `scripts/stack.mjs` (Label der ersten `check`-Zeile) · geändert, obwohl die Spec „bleibt“ sagt;
  `scripts/stack.test.mjs:928-929` (Test 4) kodiert `1_004_000` hart; der 45-s-Timer nach DOWN wird nicht gelöscht.


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
- ~~takt-039 Review minor 7 · **Recht/Audit** · `apps/web/src/features/stage/Page.tsx` (`returnAnswer`) · die Rückgabe
  wirkte auf die zuletzt gezeichnete Frage statt auf die, für die der Dialog geöffnet wurde.~~
  → erledigt in **takt-039** (Frage beim Öffnen festgehalten, `returnTargetOf`/`returnWrite` in `stage/lib.ts`, Dialog
  nennt die Nummer; Nachweis in der Spec)
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
- takt-032 Nachprüfung Codex P1 minor · `speakers/Page.tsx:315-318/420-421`, `capture/Page.tsx:289-290` · die Verdrahtung
  der Antwortmarke ist nur über reine Funktionen getestet · Komponententest mit verspäteter Antwort durch die Seite.
- takt-032 Nachprüfung Codex P1 nit · `versionOfEtag` (capture, speakers) · koppelt den Client an das interne Tag-Format
  `"v<n>"`; ein Formatwechsel des Dienstes schaltet die Marke still ab (412 nach eigenem Schreiben) · Vertragstest auf das
  Tag-Format oder Version im Antwortrumpf.
- takt-032 Nachprüfung Codex P1 nit · schwaches `W/"vN"` würde als `If-Match` zurückgeschickt, die Domäne vergleicht
  strikt (`packages/domain/src/api.ts:458`) · vorbestehend, heute ohne Folge (kein Dienst sendet schwache Tags).
- takt-035 (Review): `docs/slices/031a-e2e-http-harness-anmeldung.md` Zeile 29 sagt noch „Vite-Entwicklungsserver“ (außerhalb Files allowed von 035); bei Gelegenheit auf „Produktions-Build hinter `vite preview`“ berichtigen.
- takt-035 (Review): Die H1-Zusicherung „Seite ist der Build“ prüft `modulepreload`-Links nicht (harmlos: sie stehen nur im Build und zeigen auf `/assets/`).
- takt-037 Review minor 1 · `apps/web/src/features/capture/SuggestDialog.test.tsx` · die Tests prüfen nur die reinen
  Modellfunktionen, nicht die Verdrahtung (`useState`-Initialisierer, `[open]`-Effekt, `keys`-Memo); ein Rücksetzen per
  Effekt auf `candidates` bliebe unentdeckt · Komponententest: öffnen, abwählen, mit inhaltsgleichem neuem `uncovered`
  neu rendern, abgewählt bleibt; schließen, öffnen, alle angehakt.
- takt-037 Review minor 2 · `SuggestDialog.tsx:19-26` (`candidateKeys`) · verschwindet der erste von zwei gleichen Sätzen,
  erbt der verbleibende dessen Zustand (Schlüssel nach Vorkommen) · hinnehmen mit Code-Kommentar oder Position einbeziehen.
- takt-037 Review minor 3 · `SuggestDialog.tsx:40-44` (`setChecked`) · veraltete Schlüssel fallen erst beim nächsten Klick
  weg; ein verschwundener und wiederkehrender Kandidat kommt vorher abgewählt zurück · beim Neuaufbau der Schlüssel bereinigen.
- 031b Review minor 1 · `apps/web/e2e/support/roles.ts:88-91` (`expectNotBusy`), `002-speakers-capture.spec.ts` · beweist
  „kein Schreiben läuft“, nicht „Schreiben fertig“; `coverageOf` liest ungepollt · Produkttest, dass `data-busy` während
  des Schreibens erscheint, oder `expect.poll` für die Abdeckung.
- 031b Review minor 2 · `apps/web/playwright.config.ts:32-41`, `scripts/e2e-http-031.test.mjs` · die gemeinsamen Dateien
  hängen still vom Datenbankzustand ihrer Vorgänger ab (021c braucht eine Frage in Prüfung, `abnahme` höchstens 130
  Bühnenrunden) · Vorbedingung am Dateianfang mit klarer Fehlermeldung prüfen.
- 031b Review minor 4 · `apps/web/e2e/support/roles.ts:62-65` · `asRole` im Projekt `in-process` akzeptiert beide
  Sprachbezeichnungen · kein Fehler, `expectRoleLabel` deckt die Sprache ab; bei Gelegenheit vereinheitlichen.
- 031b Review nit 6 · `apps/web/e2e/030-anmeldung.spec.ts` · baut einen eigenen Nachweispfad statt `support/evidence.ts` ·
  vereinheitlichen.
- 040a Bau · `apps/web/src/features/history/lib.ts` (`isAdministrativeRole`), `lib.test.ts`, `Timeline.test.tsx` · die
  Spec verlangt `hasPermission`/`ROLE_PERMISSIONS` aus `@hv/domain` in der Historie; das Architekturtor meldet dafür drei
  weitere Warnungen `web-features-i18n-domain-types-only` (11 → 14, nicht blockierend) · beim Aufräumen der Regel (012)
  eine Wertfunktion „Rolle verwaltet Rechte“ über `apps/web/src/api/**` bereitstellen oder die Regel für reine
  Rechtedaten ausnehmen.
- 040a Gates-Lauf · `apps/api/src/__tests__/postgres-limits034a.test.ts` („a COMMIT that is already on its way wins over
  the timer“) · einmal 408 statt 201 im vollen Gates-Lauf (040a, `9ca8a95`), allein 3/3 grün · das Rennen zwischen COMMIT
  und Zeitgeber klären, nicht als Flake abtun; unter Last schon bei 035b gesehen („query hangs past the service timer“,
  „COMMIT phase hangs“, siehe oben).
- 040a Bau · `apps/api/src/actor.ts` · auf den gemeinsamen Helfer `sessionAssignmentFor` umstellen; lag außerhalb von
  „Files allowed“, die Gleichheit sichert bisher nur ein Test.
- 040a Nachprüfung minor · `apps/api/src/__tests__/admin040a.test.ts:52` · der Äquivalenztest vergleicht nur die Rolle,
  nicht `id` und `meetingId`; die Randfälle `expiresAt == now` und eine Versammlung ohne `MeetingCreated` fehlen.
- 040a Nachprüfung minor (Leistung) · R-ADM-08 · baut die Projektion für jede verwaltende Zuweisung neu auf (O(k·N)) ·
  die Auswahl je Subjekt einmal berechnen.
- 040a Review minor (im Bericht benannt) · Maskierung der Schreibantwort für eine künftige Rolle ohne
  `question.identity.reveal` ist nicht mehr festgehalten (postgres027); beim `api.test` „409 detail“ wechselte die Leserhälfte
  die Operation · beides wieder festhalten.

## Vertrag 0.4.0 (aus 043a)

- 043a · Veraltete Regel-id-Verweise R-TRANS-13..16: ADR 0012:53, Register E5, Plan Zeilen 198, 674, 686, 1083 und
  Eintrag 069 · die jeweilige Folgespec vergibt die nächste freie Nummer; ein Doku-Takt gleicht die Verweise an.
- 043a · Veraltete Kommentare im Kern: `packages/domain/src/types.ts:304` („Domain only until contract 0.4.0“) und
  `packages/domain/src/api.ts` (`registerSpeaker`/`updateSpeaker`, „fields the contract still accepts“) · 044 oder der
  nächste Takt core.
- 043a · 034a „→ 043“ (Grenzen der Anfrageschemas im Kern der Demo) · umgelenkt auf „Takt core“.
- 043a Bau · `apps/web/src/i18n/shell.de.ts`, `shell.en.ts` (`http.unsupported`) · Schlüssel ungenutzt; Streichen
  braucht `apps/web/src/i18n/parity.test.ts:162-169` (517 → 516) · nächster Takt web.
- 043a Review nit 6 (Sicherheitshärtung, eingeplant für 044a) · `openapi.yaml` `StageView` · „refusalJustification
  always absent“ nur in Prosa · in 044a `refusalJustification: false` im Schema oder der Negativtest „getStage als podium“.

## Stammdaten und Bühnenplätze (aus 040b)

- 040b Spec (Zeilen 78-80, T-G1-T-03) · `If-Match` an den vier Stammdaten-Operationen wird mit Vertrag 0.5 Pflicht
  (`IfMatchRequired`), und `StageAssignment`/`stageAssignment` entfällt · Vertragszyklus 0.5.
- 040b Review · R-ADM-01 liest `meeting.status` in `api.ts` (`masterDataWrite`) außerhalb von `transitions.ts` · ein
  Lebenszyklus-Guard in der Tabelle folgt; 040d (Freeze, R-ADM-03) nutzt ihn mit.
- 040b Review (nur zur Kenntnis) · Demo-Pfad: ein unbekannter Jahrgang antwortet 404 vor der Rechteprüfung (403); die
  Jahrgänge sind ohnehin über `listMeetings` lesbar.
- 040b Review · der Zwischenspeicher der eingegrenzten Instanzen (`scopedInstances`, `api.ts`) wird nie geräumt (ab 040c
  mit angelegten Jahrgängen relevant); `listMeetingStageSeats` auf der Alias-Instanz projiziert den Jahrgang je Aufruf aus
  dem ganzen Log neu · 040c.
- 040b Review · `lastWriteEtag` ist je Instanz geteilt; bei gleichzeitigen Schreibvorgängen auf derselben Instanz kann das
  ETag des anderen gelesen werden (bestehendes Muster, vgl. „Antwort-ETag bei gleichzeitigen Demo-Anfragen“).
- 040b Review · eine leere `id` in `AgendaItemInput`/`UnitInput`/`StageSeatInput` ergibt im Kern 422, der Vertrag
  dokumentiert das nicht · `minLength: 1` mit Vertrag 0.5.
- 040b Bau · `apps/api/src/__tests__/postgres-limits034a.test.ts` („a query that hangs past the service timer before the
  COMMIT answers 503“) schlug einmal unter Last (≈ 4,5) im vollen Gates-Lauf fehl, einzeln 3/3 grün · zeitkritisch,
  Spielraum prüfen.
- 044a Review (nit 9) · Veraltete Zeilenverweise: `citation`s von R-GUARD-04/06 und R-TRANS-03/05/13 nennen
  `docs/rollen-und-rechtekonzept.md:109, :156, :163` (seit 040a und dem Kopfvermerk 044a verschoben, jetzt :119, :168, :175);
  dazu der veraltete Kommentar `packages/domain/src/rules.ts:24-26` („No rule in this slice cites 'AktG' … (044)“) ·
  Doku-Takt core, Regelregister neu erzeugen.
- 044a Review (nit 10) · Ändert sich der Katalog zwischen erstem Aufruf und Wiederholung von `proposeRefusal` mit
  gleichem Idempotenzschlüssel, antwortet die Eingabeprüfung (unbekannter Grund, 422) vor der historischen Antwort ·
  Takt core: Wiederholung vor der Eingabeprüfung erkennen oder dokumentieren.
- 044b Bau (Entscheidung 3) · `packages/domain/src/api.ts` · die übrigen Längenprüfungen des Kerns zählen mit `.length`
  UTF-16-Einheiten statt Code-Punkte wie der Validator: `reason` 500 bei Rückgabe und Rücknahme, `subjectId` und
  `deputyForSubjectId` 128, `Idempotency-Key` 128 (nur strenger, nie großzügiger als der Vertrag) · Takt core: auf
  `codePointLength` umstellen, wie `checkRefusalProposal` seit 044b; deckt auch Codex P2 auf #131 (044a, maxLength zählt nach JSON Schema 2020-12 Codepunkte) ab, ein Bündel für alle Kernprüfungen.
- 044b Bau (Vor-dem-Bau-Punkt 5, Lesebefund nit 22) · Postgres-Pfad · ein einzelnes Surrogat (`"\ud800"`) in einem
  Textfeld besteht Validator und Kern, jsonb lehnt es beim Insert ab, der Dienst antwortet 500 (kein Leck, kein Ereignis,
  gilt für jedes Textfeld) · Takt service: vor dem Insert als 422 abweisen oder im Vertrag ausschließen.
- Hinweis an 051 (Datenschutz; kein offener Befund, weil es noch keinen Export gibt; aus dem Bau 044a) · die Projektion
  hält `refusalJustification` im Klartext (aus `payload.pii`) · der Export `exports/record` aus 051 muss die Begründung
  maskieren wie `maskEvent` je Leser; 051 nimmt einen Negativtest „Begründung nie im Export“ auf (vgl. Hinweis an 051 in
  `docs/slices/044a-verweigerung-kern.md`).

## Zeitkritische Postgres-Tests (aus takt-042)

- takt-042 Spec (Nicht-Ziele) · `apps/api/src/__tests__/postgres-limits034a.test.ts` („408 in the Postgres path: …“ und
  T-G2-D-01 „a write that waits longer than lock_timeout …“) · beide werden rot, wenn parallele Prozesse dieselbe
  Datenbank teilen (datenbankweiter Advisory-Lock 27027/1) · eigener Takt: der 408-Test bekommt einen
  Synchronisationspunkt „wartet auf die Sperre“ (`pg_locks`), T-G2-D-01 eine eigene Datenbank oder eine ausdrückliche
  exklusive Vorbedingung; ergänzt den Eintrag „040a Gates-Lauf“ oben.
- takt-042 Spec (Nicht-Ziele) · `apps/api/src/persistence/migrations.ts:76-84` (`tableExists` in `assertSchemaConsistent`,
  `Promise.all` auf einem Client) · `pg` warnt „client.query() when the client is already executing a query“ (künftig ein
  Fehler) · die Abfragen nacheinander oder in einer Abfrage über `information_schema.tables` stellen.
- takt-042 Review minor (#135) · `apps/api/src/__tests__/postgres-stream035.test.ts` (Test 28) · zählt die Verbindungen von
  `runtime2` (Sitzungsablage des Tests) nicht mehr mit · die bewusste Verengung im Test kommentieren.
- takt-042 Review minor (#135) · `postgres-stream035.test.ts`, `postgres-limits034a.test.ts` · die Schwellen von
  `eventually` (20 s bzw. 15 s) können unter Extremlast knapp werden · Spielraum prüfen, nicht blind verlängern.
- takt-042 Review minor (#135) · `postgres-limits034a.test.ts` · das Literal `200` (Anfrage-Timer) steht doppelt · eine
  Konstante für Grenze und `advanceTimersByTime`.
- takt-042 Review minor (#135) · `postgres-limits034a.test.ts` (Vorprüfungen der 034a-Tests) · Lint-Hinweis
  `unicorn/prefer-string-starts-ends-with` · `startsWith`/`endsWith` verwenden.

## Verweigerung in der Oberfläche (aus 045)

- 045 Review minor M2 · `apps/web/src/features/answers/refusal.ts:195` (`refusalProblemHandler`) · 409/422 werden auch dann im Dialog behandelt, wenn er nicht mehr gezeigt wird · nur bei `stillShown()` im Dialog behandeln, sonst als Hinweis (Toast); einen Fall in Test 11 ergänzen.
- 045 Review minor M3 · `apps/web/src/features/answers/WorkList.tsx:199` · der Auszug schrumpft neben der Marke auf „W..“ · dem Auszug `min-w-0 flex-1` geben oder die Marke unter den Sprechernamen setzen.
- 045 Review minor M4 · `apps/web/src/features/answers/RefusalDialog.tsx` · die Verdrahtung `onSubmit` → `refusalProblemHandler` → Hinweis im Dialog ist nicht getestet · Komponententest (Prop `initialProblem` oder jsdom).
- 045 Review minor M5 · `apps/web/src/features/stage/Podium.test.tsx` · `StageQueue` mit einer Verweigerung als „nächste“ und im Rest ist nicht abgedeckt · Test für Kennzeichen und Marke ergänzen.
- 045 Review nit N7 · Bühne und Katalogtext · „nicht im geladenen Katalog“ erscheint auch während des Ladens und nach einem Fehler; die Grund-ID steht nicht in Mono auf der Bühne · Text je Ladezustand trennen, ID in Mono.
- 045 Review nit N8 · Vorbelegung des Dialogs · ein Text nur aus Leerzeichen gilt als leer · Vorbelegung vor dem Vergleich trimmen.
- 045 Review nit N9 · `RefusalDialog.tsx:123` · die Radiogruppe in einem `fieldset` wird doppelt angesagt · Rolle oder Gruppierung nur einmal setzen.
- 045 Review nit N10 · `RefusalDialog.tsx` · Absenden ist über der Längengrenze ohne Hinweis gesperrt (D6) · Hinweis mit Zählung zeigen.
- 045 Review nit N11 · e2e-http E1 · prüft den Zustand „in Prüfung“ nicht direkt · Zustand ausdrücklich zusichern.
- ~~H13 (`031-http-betriebsart.spec.ts:684`, 036b) · Zeitabhängigkeit: ein später Sprecher-Lesezugriff aus dem Erfassungsschritt fiel in PR #139 ins Klassifizierungsfenster (Lauf 37155605584, Wiederholung grün), ein zweites Mal rot auf PR #149 (Lauf 37224478746); zwei Fälle, also kein Zufall mehr · in Schritt 2 vor `quiet(trace, 1_500)` auf den Sprecher-Lesezugriff von A warten (eigener Takt).~~ → erledigt in **takt-044** (Schritt 2 wartet vor `quiet` auf A's `GET /v1/speakers` mit der erfassten Einzelfrage; dritter Fall: Lauf 37235698670 auf #153).
- takt-044 Review minor · `apps/web/e2e/031-http-betriebsart.spec.ts` (H13 Schritt 2) · die 5-s-Frist des Wartens auf A's `GET /v1/speakers` beginnt bei der Registrierung und umfasst die drei Erfassungsanfragen · scheitert der Schritt je an der Frist, die Frist erst nach dem Fragen-POST neu starten.

## Weiterleiten an einen anderen Fachbereich (aus 048)

- 048 Hinweis Orchestrator · `apps/api/src/metrics/catalog.json` · die Quelle von `hv_open_questions` nennt nur „QuestionAssigned“;
  die Kennzahl folgt `QuestionForwarded` schon über die Projektion · Quellentext um `QuestionForwarded` ergänzen.
- 048 Hinweis Orchestrator · Leitstand (061) · kein Zähler „Weiterleitungen je Frage“ (Hin und Her, MF-14) · aggregiert je Frage
  anzeigen, nie je Person.
- 048 Hinweis Orchestrator · `docs/rollen-und-rechtekonzept.md` §2.1 (Zeile 62) und §2.4 (Zeile 119–122) · `question.forward` steht dort
  für das allgemeine Weiterleiten mit rechteabhängigem Zielstatus; im Code heißt es seit 048 nur „an einen anderen Fachbereich“ · mit
  052 auf `question.assign`, `question.submit_review`, `question.return` umschreiben.
- 048 Hinweis Orchestrator · `_actions` einer gebundenen Fachkraft ohne Einheit · auf einer Frage ohne Fachbereich steht theoretisch
  `question.forward`, obwohl sie die Frage nie lesen kann (ohne Wirkung, jeder Versuch 404, Test 8c) · `actionsFor` für gebundene Leser
  ohne Leserecht leer lassen.
- 048 Bau · `apps/web/src/features/history/eventSummary.ts` · der Kopfkommentar sagt, ein neuer Ereignistyp lasse die Datei nicht
  übersetzen; der `switch` hat weder `default` noch eine `never`-Prüfung, die Typprüfung erzwingt den Fall also nicht (W1 belegt
  `QuestionForwarded` trotzdem) · `const _exhaustive: never = event` nach dem `switch` oder Kommentar berichtigen.
- 048 Bau · `apps/web/src/i18n/index.ts` · `forwardReasonLabel` (labels.ts) ist nicht über den Einstiegspunkt exportiert, weil
  `index.ts` außerhalb der Files allowed lag; `eventSummary.ts` importiert direkt aus `i18n/labels` · mit 054 (Dialog) in `index.ts`
  aufnehmen und den Import umstellen.
- 048 Bau · `packages/domain/src/rules.ts` R-PERM-01 · die Aufzählung der Schreibvorgänge mit Eingabeprüfung vor `can()` nennt seit
  048 `forwardQuestion`, aber nicht `proposeRefusal` (044a prüft ebenso vorher, 422) · Text ergänzen.
- 048 Review · `packages/domain/src/rules.ts:141` R-PERM-01 · die Liste nennt `proposeRefusal` nicht · ergänzen (doppelt zum Eintrag oben, Review bestätigt).
- 048 Review · `packages/domain/src/transitions.ts:856` · der Kommentar zu `TRANSITION_ACTIONS` („change the status“) passt nicht zu R-TRANS-13/14/17 · „resolved through the transition table“.
- 048 Review · Vertrag `QuestionForwardedPayload.fromUnitId` · ohne `minLength: 1` · bei der nächsten Vertragsstufe ergänzen.
- 048 Review · Präfix `history.forward.reason.*` · liegt im Modul `history`, obwohl 054 die Bezeichnungen im Dialog nutzt · neu entscheiden, wenn 054 `forwardReasonLabel` exportiert.
- 048 Review · HTTP-Test der Code-Punkt-Grenze von `unitId` · 128 astrale Zeichen (Kern 422 „does not exist“) und 129 (Validator 422) über den Dienst · Test ergänzen.
- 048 Review · `docs/sicherheit/bedrohungsmodell.md` Zeile 048 · nennt `transitions.test.ts` (R-TRANS-17, R-GUARD-15) nicht · Nachweis ergänzen.
- 048 Review · Idempotenz-Reihenfolge · `forwardQuestion` und `assignQuestion` prüfen den Fachbereich vor der Wiederholung, eine Wiederholung nach erneutem Weiterleiten und Entfernen antwortet 422 (Test 9b) · Wiederholung vor der Fachbereichsprüfung, für beide Operationen zusammen.
- 048 Spec-Nachprüfung N4 · Abschnitt „Warum hoch“ und Checkliste · `legalClearance.clearedBy` (Akteur-id und Rolle der Rechtsfreigabe in der Sicht) nicht ausdrücklich genannt · beim nächsten Anfassen der Spec benennen.
- 048 Spec-Nachprüfung N5 · Abschnitt 6 · nennt nicht, dass `QuestionForwarded` in `SCOPE_EXIT_EVENTS` Inhaber von `stage.read` zum Neuaufsetzen des Nachlaufs zwingt (`stream.ts:412`) · ergänzen.
- 048 Spec-Nachprüfung N7 · „Entscheidung 4“ · der Unterpunkt (Code gegen Anspruch) ist nicht benannt · ergänzen.
- 048 Spec-Nachprüfung N8 · Verweis auf `Event.type` · Zeilen `openapi.yaml:3676-3711` statt 3675-3710 · berichtigen.
- 048 Lesebefund m2 · bereits oben („`_actions` einer gebundenen Fachkraft ohne Einheit“) · kein zweiter Eintrag.

## Steuerung (aus 053)

- 053 Hinweis Orchestrator · Quelle der Rechtemenge · `visibleRoutes` wird nirgends mit einer Menge gerufen, `/steering` steht
  deshalb für jede Rolle in der Navigation (S5 sichert das bewusst zu) · Vertragsfeld `permissions` an `GET /auth/me` und
  In-Process-Ableitung aus `can()`, eigene Scheibe (Eigentümerfrage 3A; betrifft auch 054, 059, 061).
- 053 Hinweis Orchestrator · Klassifizieren über das Enum `STAGE_ASSIGNMENTS` · ein Bühnenplatz, den die Administration mit
  anderer id anlegt, ist im Dialog nicht wählbar · Dialog auf die Bühnenplätze der Stammdaten mit `seatId` (Eigentümerfrage 6).
- 053 Hinweis Orchestrator · `AssignDialog` wählt den aktuellen oder ersten Fachbereich vor · beim Zuweisen erweitert das den
  Leserkreis per Standard wie beim Weiterleiten · Vorauswahl mit Datenschutzblick prüfen (Eigentümerfrage 2).
- 053 Bau · `apps/web/src/features/steering/Page.tsx` Fokus nach Klassifizieren · `ClassifyDialog` meldet keinen Erfolg, nur
  `onClose`; die Seite merkt sich deshalb bei jedem Schließen die gelesene Version und setzt den Fokus, sobald eine neuere kommt
  (nach Abbrechen auch bei einem fremden Schreibvorgang auf derselben Frage, bis zur nächsten Auswahl) · `onSaved` in
  `ClassifyDialog` (Lane capture), dann nur nach Erfolg.
- 053 Bau · `scripts/e2e-http-031.test.mjs` · der Testtitel „lists the seven files“ stimmt seit 045 nicht (jetzt neun); 053
  durfte nur `SHARED_FILES` und `HTTP_ORDER` ändern · Titel ohne Zahl.
- 053 Bau · `ForwardProblem` · die Meldung zu 422 trägt keine Regel-id, weil der Kern bei 422 keine setzt (wie 045 bei
  `answers.refusal.error.invalid`) · mit einer Regel-id für Eingabeprüfungen nachziehen, falls der Vertrag eine bekommt.
- 053 Bau · e2e S6 im Projekt `http` · der Akteurwechsel lädt die Seite neu, der offene Dialog fällt dort durch das Neuladen,
  nicht durch den Schlüssel; die Zusicherung „erneut öffnen ist leer“ gilt in beiden Projekten · in-process belegt den Schlüssel.
- 053 Review 4 · Verteilung · Nullen in Grau 300 haben etwa 1,6:1 Kontrast (Vorgabe D4; axe legt Einzelzeichen unter
  „incomplete“), und die Bühnenplatzzellen tragen kein `aria-label` · Entscheidung Eigentümer/Gestaltung, Bezeichnung ergänzen.
- 053 Review 6 · Test der Statusunabhängigkeit · steht in `steering.test.ts` mit Teil-Datensätzen · nach
  `SteeringDetail.test.tsx` mit echten `Question`-Datensätzen verlegen.
- 053 Review 7 · e2e `findSteerable` ohne `unitName` · wartet nicht auf die ungefilterte Liste · wie beim Fachbereich auf das
  Eintreffen warten.
- 053 Review 8 · Drill-down · „15 offen“ zeigt mit Status „alle“ 24 Zeilen · Voreinstellung „offen“ oder Hinweis, als
  Eigentümerfrage.
- 053 Review 9 · `counts.byUnit` · für gebundene Fachkräfte sichtbar (Entwurf 040b) · zur nächsten Datenschutzprüfung.

## Fokusansicht (aus 054)

- takt-043 Review minor 1 · `features/focus/Page.tsx` (und gleich in 053 `features/steering/Page.tsx`) · „An anderen Fachbereich
  weiterleiten“ in Reihenfolge D (Strom vor der POST-Antwort): der Dialog wechselt auf die nächste Einzelfrage und bleibt offen,
  weil `stillShown()` falsch ist · Dialog der Schreibtür schließen, sobald die Auswahl die Frage verlässt, für die er geöffnet wurde
  (eigene Scheibe, beide Seiten).
- takt-043 Review minor 2 · `focus.test.ts` Test 10 · die realistischen Zwischenstände (X v4 gewählt mit mine [Y]; X v4 gezeigt
  bei selectedId Y) fehlen; heute `question: null` · Schritte `shown(X4,'q-x',[Y])` und `shown(X4,'q-y',[Y])` mit `wait` ergänzen.
- takt-043 Review nit 3 · `Page.tsx` · `armHandOver` vor `run`; kehrt `run` früh zurück (Schreiben läuft), bleibt der Fokus
  scharf bis zur nächsten Bewegung · heute durch busy/aria-disabled verhindert; bei Änderung an `useWriteDoor` erst nach Annahme
  scharf machen.
- ~~054 Bau · Entwurfstext beim Verlassen von „Meine Fragen“ durch einen fremden Schreibvorgang · der ungespeicherte Text fällt
  mit Toast `focus.write.gone` · Entwurfspuffer mit 060.~~ Erledigt in 060 (`focus.write.goneKept`, e2e E9).
- 054 Bau · `apps/web/src/app/ShortcutsDialog.tsx` · die Kürzelliste kennt Strg+Enter und Escape des Schreibmodus nicht ·
  Zeilen ergänzen (Lane web-shell).
- 054 Bau · `apps/web/src/features/focus/Page.tsx` Fokus nach der Übergabe · wird nach der letzten Einzelfrage der Liste (leere
  Liste) verworfen; der Fokus fällt dann auf `body` · Fokusziel im Hinweis `focus-empty` vorsehen.
- ~~054 Review 5 · ungespeicherter Text beim Verlassen von `/my` (Navigation weg von der Seite) geht still verloren · mit dem
  Entwurfspuffer 060.~~ Erledigt in 060 (Wiederherstellen beim nächsten Öffnen des Schreibmodus, e2e E2).
- 054 Review 6 · Escape während einer IME-Komposition verlässt den Schreibmodus · `isComposing` auch in `shouldLeaveWriting`.
- 054 Review 7 · Verweigerungsbadge in Liste (`danger`) und Detail/Steuerung (`warning`) uneinheitlich · einen Ton festlegen.
- 054 Review 8 · `DEMO_BINDINGS` ohne Grund (`reason`) und bei jedem Start erneut versucht (409 übergangen) · Grund mitgeben,
  Versuch nur nach dem Säen oder bei fehlender Zuordnung.
- 054 Bau · e2e F1–F8 als `test.describe.serial` · scheitert ein Fall, laufen die folgenden nicht; die roten Läufe vor dem
  Bau zeigen deshalb nur F1 rot · unabhängige Fälle aus der Serie lösen, wo der Endzustand im Projekt `http` es erlaubt.
- 054 Bau · `focus054.test.ts` · die Spec nannte für alle Personen außer Podium 230 lesbare Einzelfragen; die Beobachtung liest
  nach 010 nur Vorgelesenes (130) · Zahl in der Spec berichtigt im Bericht.
- 054 Nachprüfung minor · `apps/web/src/features/focus/Page.tsx` (`handedOver` ruft `settleFocus` synchron) · der Aufruf läuft vor dem Commit von React; bei derselben Einzelfrage mit neuerer Version kann das Fokusziel noch im Schreibmodus liegen und mit ihm verschwinden · `queueMicrotask` oder nur dann, wenn `writingId` schon `null` war.

## Antwortformat (aus 055)

- ~~**Voraussetzung 055b**~~ **erledigt in 055 (Codex P1 auf #152)** · `packages/domain/src/state.ts` (Fall `AnswerDrafted`) · `body`
  einer Version war in jeder Sicht dasselbe Objekt wie in der Projektion (wie `sources`) · jetzt tief eingefroren (`body`) bzw.
  kopiert und eingefroren (`sources`); Test in `answerDraft055.test.ts`.
- 055 Bau · `apps/web/src/api/http.test.ts` · der Fall „`draftAnswer` reicht `body` durch“ ist vor der Änderung nicht rot, weil
  `http.ts` die Eingabe schon unverändert sendet und `endpointCases` untypisiert ist · bei 055b einen typisierten Fall ergänzen.

## Kontrast der Nullzähler (aus takt-048)

- takt-048 Spec, Nicht-Ziel · `components/ProcessStrip.tsx:188/192` · Nullen in Grau 300 (1,7:1) im Modus ohne
  `compact`/`dense`; heute in keiner Ansicht sichtbar · bei der nächsten Nutzung des Modus auf Grau 600.
- takt-048 Spec, Frage 2 · `features/speakers/SpeakerRow.tsx:176` · Fragenzahl 0 der Wortmeldeliste in Grau 300 (1,7:1) ·
  Grau 600 wie die Verteilung (Sammelgang, Screenshot ergänzen).

## Antwortformat in der Oberfläche (aus 055b)

- 055b Bau, Vor-dem-Bau-Punkte 2 und 4 · `features/answers/editorCommands.ts`, `AnswerBodyEditor.tsx` · Kürzel
  (Strg/Cmd+B, I, U, Umschalt+H, Umschalt+L) und der Schutz des Rückgängig sind nur in Chromium geprüft; Firefox und WebKit
  sind im Container nicht installiert (nicht geprüft; bekannt: Firefox Strg+Umschalt+H öffnet die Chronik, Safari
  Cmd+Umschalt+H/L sind Menübefehle) · in einem Lauf mit Firefox/WebKit nachprüfen, sonst Eigentümerfrage 3.
- 055b Bau · `features/answers/AnswerBodyEditor.tsx` · `insertUnorderedList` erzeugt in Chromium `<p><ul>…</ul></p>` im Feld,
  und die erste getippte Zeile eines leeren Felds steht als Text direkt im Feld; der Walker liest beides richtig, nur der
  Abstand weicht bis zum nächsten Neuaufbau ab · beim Neuaufbau von 055c mit normalisieren.
- 055b Spec, Folgekandidaten · `features/answers/QuestionDetail.tsx` (`AnswerDiff`), `AnswerEditor.tsx`, `domToBody.ts` ·
  Diff der Marken statt nur des Hinweises „Nur Auszeichnung“; ~~Vorbelegen der Beantwortung mit der letzten Version
  (Eigentümerfrage 4)~~ erledigt mit takt-048; Hinweis „wird beim Speichern Text“ für nicht darstellbare Kandidaten
  (Unterstreichung, Überschrift) · Sammelgang.
- takt-048 Spec, Nicht-Ziel · `features/focus/focus.ts` (`draftBase`, `newDraft`, `isDirty`, `writingOutcome`, `FocusDraft`) ·
  die Beantwortung importiert die Entwurfshelfer aus `focus/` · Helfer nach `features/answers/` (oder ein gemeinsames Modul)
  verschieben, `FocusDraft` neutral benennen.
- takt-048 Spec, Frage 1 · `packages/domain/src/api.ts` `draftAnswer` · der Kern legt auch eine wortgleiche Version an und hebt
  damit Freigabe und Rechtsfreigabe auf; nur die Oberfläche sperrt · eigene Scheibe (Risikoklasse hoch): Guard an R-TRANS-03
  mit 409 und Regel-id, Vertrag vorab.
- takt-048 Bau · `features/answers/draft.ts` (`normalSources`) · die Normalisierung der Quellen steht ein zweites Mal neben
  `focus.ts` (dort nicht exportiert, `focus/**` war gesperrt) · beim Verschieben der Helfer zusammenlegen.
- 055b Review Minor 7 · `apps/web/e2e/055b-antwortformat.spec.ts` · der Schutz des Rückgängig nach einem Einfügen
  (`UndoBudget`) ist nur als Einheitstest belegt, kein e2e-Fall tippt, fügt ein und drückt Strg+Z/Strg+Umschalt+Z · einen
  Fall in Chromium ergänzen (zusammen mit 055c, das das einstufige Rückgängig bringt).
- 055b Review Nit 9 · `AnswerBodyEditor.tsx:373-374` · `aria-placeholder` steht in der Oberflächensprache auf einem Element mit `lang="de"`;
  ein englischer Platzhalter wird deutsch ausgesprochen · Platzhalter nur im `aria-hidden`-Span plus `aria-describedby` ohne `lang`.
- 055b Review Nit 10 · Spec-Kopf und `answers.format.keys` · Kürzelhinweis nennt nur Strg/Ctrl, nicht Cmd auf macOS · Text ergänzen.
- 055b Review Nit 11 · `054-fokusansicht.spec.ts` · `toHaveText` normalisiert Leerraum (etwas lockerer als `toHaveValue`); H1 prüft
  `aria-disabled` direkt nach Strg+Enter mit wenig Aussagekraft (Neuladen deckt es) · bei Gelegenheit schärfen.
- 055b Bau · `apps/web/src/api/http.test.ts` · der typisierte Fall „`draftAnswer` reicht `body` durch“ (Folgepunkt aus 055)
  liegt außerhalb der erlaubten Dateien von 055b · in einer Scheibe mit `api/**` nachziehen.

- takt-048 Review (Opus, 05.10.2026) minor · `features/answers/QuestionDetail.tsx:328-348,796` · der eigene neue Stand kommt vor
  `draftResetToken`: der Rebase-Hinweis „neuere Antwortversion“ blitzt kurz beim eigenen Speichern auf (`afterSave` läuft vor
  `onRecord`, wenn `latest` = gesendet) · Reihenfolge ändern oder den eigenen Stand erkennen.
- takt-048 Review nit · `features/answers/QuestionDetail.tsx:822` · `version = answers.length + 1` statt `latest.version + 1`.
- takt-048 Review nit · `features/answers/draft.ts:76` · `discard` und `onRecord` erhöhen `generation` um 2.
- takt-048 Design-Kritik (05.10.2026) D2 · `QuestionDetail.tsx:435` · ohne anderen Schritt ist der einzige primäre Knopf ein
  gesperrter „Entwurf speichern“ über vorbelegtem Text; kein Screenshot · Zustand prüfen, Screenshot ergänzen.
- takt-048 Design-Kritik D6/D7 · `i18n/answers.de.ts:65`, `i18n/focus.de.ts:24` (`answers.editor.rebase`, `focus.write.rebase`) · „Ihr Text ist nicht
  gespeichert.“ sagt nicht, dass „Neu laden“ den Text verwirft · beide Stellen im selben Wortlaut ändern.
- takt-048 Design-Kritik D6 Nachweis · `docs/evidence/` · keine Screenshots von Rebase-Hinweis, geändertem Zustand und
  Verweigerung leer · bei Gelegenheit ergänzen.
- takt-048 Design-Kritik D4/D5 Nachweis · `docs/evidence/` · Nullzähler nur in der Fachbereichszelle im Normalzustand belegt; nicht
  „Ohne Fachbereich“, Bühnenplatz, Hover und aktiv · ergänzen (zusammen mit `SpeakerRow.tsx:176`, siehe „Kontrast der Nullzähler“).
- takt-048 Design-Kritik nit D10 · `features/answers/QuestionDetail.tsx` (Versionskarte) · der vorbelegte Text steht doppelt unter der Karte.
- takt-048 Design-Kritik nit D3/D7 · `features/answers/QuestionDetail.tsx:435` (gesperrter Knopf) · `ink-400` auf `ink-50` ≈ 2,3:1 · Ton prüfen.


## Nachfragen-Threads (aus 046)

- 046 Bau, Vor-dem-Bau-Punkt 4 · `packages/domain/src/events.ts` (`ReadEvent`), `packages/domain/src/__tests__/api.test.ts:500/513` ·
  die Leseform `{ relation }` für `QuestionLinked` im Typ `ReadEvent` ist zurückgestellt, weil `api.test.ts` (außerhalb der
  erlaubten Dateien) `ReadEvent[]` einem `DomainEvent[]` zuweist; heute eigener Typ `QuestionLinkedReadPayload` · `api.test.ts`
  auf `ReadEvent[][]` umstellen, dann `ReadEvent` einengen.
- 046 Bau · `packages/domain/src/stream.ts` (`snapshotBefore`) · kopiert das Merkfeld `lastReduced` (Regel e von R-LINK-02),
  über die Spec-Liste „nur EVENT_TOPICS, EVENT_SUBJECTS, maskEvent“ hinaus; angenommene Scope-Abweichung (Auftrag des
  Orchestrators, Nachprüfung Minor 4) · keine Arbeit, nur Vermerk.
- 046 Review · `apps/web/src/features/capture/FollowUpDialog.tsx` (`RELATIONS`) · dupliziert `QUESTION_RELATIONS` der Domäne
  (Laufzeitimport aus `@hv/domain` verletzt die Regel „features nur Typen“) · gemeinsame Liste in `i18n/labels.ts` oder Typ-Ableitung.
- 046 Design-Kritik · `FollowUpDialog.tsx`, `ThreadBlock.tsx` · Fehlertexte „Die Suche ist gerade nicht möglich“ und „Der Bezug
  konnte nicht geladen werden“ nennen keinen Grund (Prinzip 5) · Grund aus dem Problem (Status, Netz) anzeigen.
- 046 Design-Kritik · `ThreadBlock.tsx` · Blockbeschriftungen in 11 px (`text-2xs`); die Zahl in „Nachfragen und Klarstellungen (n)“
  steht nicht in Mono · Sammelgang Typografie.
- 046 Design-Kritik · `ContributionPane.tsx` (Chip, Ton accent) gegen `QuestionCard.tsx` (Badge, Ton neutral) · zwei Töne für
  denselben Bezug · einheitlichen Ton festlegen.
- 046 Design-Kritik · `features/history/Page.tsx` · nach dem Öffnen einer Frage aus dem Block „Bezug“ bleibt die linke Trefferliste
  auf der alten Suche; Auswahl und Liste laufen auseinander · Liste mitführen oder Treffer markieren.
- 046 Design-Kritik · `components/Dialog.tsx` · nur feste Größen; „Bezug setzen“ ist 512 px statt der spezifizierten 480 px ·
  bei der nächsten Dialog-Überarbeitung eine Größe ergänzen oder die Spec angleichen.
- 046 Design-Nachprüfung (06.10.2026) minor P8 · `features/capture/FollowUpDialog.tsx:146` · die Bestätigungszeile erscheint erst
  nach der Wahl, die Fußzeile springt um rund 35 px · Höhe reservieren.
- 046 Design-Nachprüfung minor P8 · `features/history/ThreadBlock.tsx:45,50-56` · das Gerüst blinkt rund 130 px hoch bei Fragen
  ohne Bezug und ohne Nachfragen (HTTP: eine Runde) · Gerüst erst nach 200 ms zeigen oder einzeilig.
- 046 Spec, Hinweis an den Orchestrator · Aufbewahrungsklasse von `QuestionCaptured`/`QuestionLinked`: `working` im Code,
  `record` in DSFA-Zeile V3 · **Frage an die DSB über den Eigentümer** (Übergabe 06.10.2026), kein Code-Befund; nach der Antwort
  Code oder DSFA angleichen.

## Verwaltung (aus 041)

- 041 Bau (Eigentümerfrage 5) · `scripts/lib/demo-persons.mjs`, `scripts/stack*.mjs` · das lokale Paket hat keine Person mit
  Verwaltungsrolle; die zehnte Person lebt nur im Harness von `e2e-http` · Person `admin` im geteilten Verzeichnis mit
  Zustandsübernahme für bestehende lokale Stände und Zeile auf der Installationsseite (Lane infra, rund 0,3 AStd).
- 041 Bau (Eigentümerfrage 6) · `apps/web/src/api/roleCards.ts` · die Rollenkarten lesen die Rechtetabelle des Web-Builds,
  nicht die wirksame des Dienstes · Endpunkt oder Feld mit der wirksamen Tabelle (Vertragsschritt, zusammen mit 089b).
- 041 Befund (Kern) · `packages/domain/src/api.ts` `assignRole` · ohne `expiresAt` setzt der Kern kein Ablaufdatum, der
  Vertrag sagt „Standard: Ende der Hauptversammlung“; die Oberfläche zeigt nur „Ende der Hauptversammlung“ · Vertragstext
  und Projektion angleichen (Lane core).
- 041 Bau · `apps/web/src/features/admin/Page.test.tsx` · Test 7 der Spec verlangte Testing Library; das Web-Paket hat keine
  DOM-Testumgebung, und eine neue Abhängigkeit liegt außerhalb der erlaubten Dateien · Komponenten statisch gerendert,
  Klick- und Tastenverhalten als reine Funktionen getestet, der Bedienweg in `e2e/041-verwaltung.spec.ts`; eine
  DOM-Testumgebung (jsdom oder happy-dom) als eigene Scheibe der Lane web-api erwägen.
- 041 Bau · `apps/web/src/components/Dialog.tsx` · D3 verlangt Dialoge mit 480 px; das Bauteil kennt nur 384/512/672 px
  (`sm`/`md`/`lg`), die Verwaltung nutzt `md` · Größe in einer Bauteil-Scheibe ergänzen oder die Vorgabe auf 512 px setzen.
- 041 Review minor 4 · `apps/web/e2e/041-verwaltung.spec.ts` · das Aufräumen im Projekt `http` ist nicht ausfallsicher:
  scheitert ein Schritt nach dem Anlegen, bleiben Fachbereich, TOP, Platz oder Zuordnung für die Folgedateien stehen ·
  `afterAll` mit eigenem Kontext der Verwaltungsperson, der eigene Einträge (Präfix „E2E 041“, Kennung
  `e2e-041-pruefung`) entfernt bzw. entzieht.
- 041 Review minor 5 · `features/admin/problems.ts` · ein 409 ohne Regel-id zeigt auch in den Stammdaten-Dialogen den Text
  der Rollenzuordnung („Diese Kennung hat die Rolle schon …“) · eigener Schlüssel je Dialogart oder neutraler Text.
- 041 Review nit 7 · `features/admin/noRoleNames.test.ts` · der Quelltest findet einen Rollennamen als ungequoteten
  Objektschlüssel nicht (`{ admin: … }`) · Muster `\b<rolle>\s*:` ergänzen.
- 041 Review nit 8 · `features/admin/AdminLayout.tsx` · `aria-controls` der nicht gewählten Tabs zeigt auf nicht
  gerenderte Panels; das Tabpanel hat kein `tabIndex` (bei Tabs ohne fokussierbaren Inhalt, z. B. Hauptversammlungen) ·
  alle Panels gerendert und versteckt oder `aria-controls` nur am gewählten Tab; `tabIndex={0}` am Panel.
- 041 Codex P2 (#166) · `features/admin/Page.tsx` · „jetzt“ für den Anzeigezustand der Zuordnungen wird nur mit jeder Antwort
  gelesen; läuft eine Zuordnung bei offener Seite ohne neues Ereignis ab (Demo im Browser), bleibt sie als aktiv mit Entziehen
  stehen · Aktualisierung zum nächsten Ablaufzeitpunkt planen.
- 041 Review nit 9 · Spec-Bericht 041, „Vor dem Bau prüfen“ 4 · die Aussage zu Konstanten mit SECRET/TOKEN/KEY/PASSWORD
  im Namen ist ungenau formuliert · auf die Konstanten dieser Scheibe beschränken und so benennen.
- 041 Nachprüfung minor · `apps/web/src/api/liveStorePairing.test.ts` (Test 2) · bedingte Zusicherung (`if version === 1 … else`) ·
  deterministisches Szenario.
- 041 Nachprüfung minor · `apps/web/e2e/041-verwaltung.spec.ts` · der Skip bei `E2E_HTTP=1` hat keinen Skripttest · Test ergänzen.
- 041 Design-Kritik (06.10.2026) D1/D7 · `i18n/admin.de.ts:139-140`, `admin.en.ts:138` · Ablehnungstexte zu R-ADM-07/08 ohne nächsten
  Schritt, „Rechteverwaltung“ ist Jargon, EN unidiomatisch · nächsten Schritt nennen, Wortlaut glätten.
- 041 Design-Kritik D1 · `admin.de.ts:111,137` · der Text zu R-ADM-02 ist für alle Listen gleich und nennt den TOP auch beim
  Fachbereich; Dialogtitel „Eintrag entfernen“ generisch · Text und Titel je Liste.
- 041 Design-Kritik D7/D1 · `AssignDialog.tsx:305`, `shell.de.ts:182`, `shell.en.ts:184` · drei Bezeichnungen für „Zuordnen“; DE- und
  EN-Dialogtitel unterscheiden sich · eine Bezeichnung.
- 041 Design-Kritik D7 · `admin.de.ts:20,49-50,112,115-116` · „der Dienst“ als Fachwort in Texten; der gesperrte Zustand nennt keine
  Handlung · Alltagssprache, Handlung nennen.
- 041 Design-Kritik D6 · `MasterDataTab.tsx:101` · fehlender Kurzname „keine Angabe“ sieht aus wie ein echter Wert · als Leerwert
  kennzeichnen.
- 041 Design-Kritik D6 · `AssignDialog.tsx:402`, `parts.tsx:183` · eine ungültige Uhrzeit tauscht nur den Hinweistext · Fehlerzustand
  am Feld.
- 041 Design-Kritik D2 · `RemoveDialog.tsx:35-44`, `RevokeDialog.tsx:95` · der rote Primärknopf bleibt nach einer Ablehnung aktiv ·
  nach Ablehnung sperren oder auf „Schließen“ umstellen.
- 041 Design-Kritik D4 · `AdminLayout.tsx:38`, `MeetingsTab.tsx:222`, `MasterDataTab.tsx:52-53` · Akzentblau als Statusfarbe ·
  Statustöne des Bauteilsatzes.
- 041 Design-Kritik D3/Kontrast · `parts.tsx:177,183,205`, `RolesTab.tsx:169` · 11 px unter der Skala; `.hv-label` in ink-500 hat
  etwa 3,9:1 für Formularlabels · Skala und Ton anheben.
- 041 Design-Kritik D5 · `RolesTab.tsx:178-184`, `MeetingsTab.tsx:220` · Zeiten in Mono, aber linksbündig · rechtsbündig.
- 041 Design-Kritik D8 · `RoleCardsTab.tsx:64` · `aria-live` auf der ganzen Rollenkarte · nur auf die Änderungsmeldung.
- 041 Design-Kritik nits · `cx` mischt Klassen nicht (`MasterDataTab.tsx:103`, `parts.tsx:296`); rohe Rechte-ids in den Rollenkarten
  (`RoleCardsTab.tsx:48`); EN-Titel des gesperrten Zustands (`admin.en.ts:17`); gestrichelte Leerbox als gesperrter Zustand;
  Screenshots fehlen für mehrere Zustände · im Sammelgang.
- takt-041 Review nit · `docs/slices/takt-041-hono-sicherheitspatch.md` · die Spec sagt „Patch-/Minor“, gemeint und gebaut ist nur
  Patch · Wortlaut berichtigen.

## Leitstand (aus 061)

- 061 Spec, Hinweis an Folgescheiben · `apps/web/src/features/answers/lib.ts:147-152` (`urgencyLevel`, 15/45 min) und
  `packages/domain/src/cockpit.ts` (`COCKPIT_THRESHOLDS.oldestOpenSeconds`) · die Schwellen stehen nach 061 zweimal · ein Takt
  stellt `urgencyLevel` auf die Kernkonstante um (Beantwortung war nicht in den „Files allowed“ von 061).
- 061 Teil B Bau · `apps/web/src/api/cockpit061.test.ts` (W10) · `getCockpit` bei 800 lag bei Lastmittel 10 auf vier Kernen allein
  bei p90 43 ms, in der parallel laufenden Web-Suite bei 73–93 ms; bei Lastmittel 2,4 allein 20,1 ms, in der vollen Suite 30,3 ms.
  Die harte Grenze trägt deshalb wie `timing053` einen Aufschlag (100 ms), das Ziel 50 ms steht je Messreihe im Log · im CI-Log
  nachsehen; liegt es dort über 50 ms, den Zwischenspeicher aus Vor-dem-Bau-Punkt 5 der Spec 061 bauen
  (`createSingleFlightCache`, Filter nach `can()` danach).
- 061 Teil B CI (Lauf 37468958219) · W10 · `getCockpit` beste Reihe 57,7 ms auf dem CI-Läufer (Paket-Suiten parallel), also über dem Ziel 50 ms; der Stolperdraht schreibt seither einen Warnhinweis · **vor Rollout** den Zwischenspeicher aus Vor-dem-Bau-Punkt 5 der Spec 061 bauen (T-G2-D-03), danach Warnhinweis wieder als Fehler.
- 061 Teil B Bau · `packages/domain/src/seed.ts` (Uhr des Seeds, `Math.min(clock, o.now)`) · der Demo-Seed staucht fast alle
  Ereignisse auf den Seed-Zeitpunkt: im Leitstand steht der Zulauf als eine Säule, alle Uhrzeiten eines Fadens sind gleich, die
  „Danach die ältesten“ springen von 74 auf 22 min · Seed über den Nachmittag verteilen (eigener Takt; Golden von 061 und 033b
  neu, weil `/metrics` den Seed liest). → als **takt-052** in PR #173 (Seed-Zeiten über 90 min verteilt), noch offen.
- 061 Teil B Review R8 · `features/cockpit/Page.tsx` (`useCockpit`, `useApiVersion`) · ein Wechsel der Person startet den Feed neu
  (eine Lesung) und zählt zugleich `useApiVersion` hoch (zweite Lesung) · die Versionszählung beim Personenwechsel im Leitstand
  übergehen oder den Feed die erste Lesung selbst auslösen lassen.
- 061 Teil B Review R9 · `features/cockpit/feed.ts` (`tick`) · bei verborgenem Tab läuft das Intervall weiter und tut nichts · das
  Intervall bei `hidden` anhalten und beim Zeigen neu starten (spart Weckrufe, keine fachliche Wirkung).
- 061 Teil B Review R12 · `features/cockpit/lib.ts` (`unitRows`, `Selection.unit`) · `none` ist ein Platzhalter im selben Raum wie
  Fachbereichs-ids; ein Fachbereich mit der id `none` wäre nicht unterscheidbar · eigener Schalter (`list=unassigned`) oder eine
  Prüfung der ids in der Verwaltung (041).
- 061 Teil B Review R13 · `apps/web/e2e/061-leitstand.spec.ts` (S3) · im Projekt `http` liegt meist keine Einzelfrage länger als 10 min
  im Legal Clearing; der Faden-Teil von S3 läuft dann nicht (nur Zeilenzahl 0 und Escape) · mit dem Seed-Takt eine wartende
  Einzelfrage im Harness anlegen oder den Faden in `http` über die älteste offene prüfen.
- 061 Teil B Design-Kritik D14 · `apps/web/src/app/Header.tsx` · bei 1280 px schneidet die Kopfzeile den Titel der HV ab („Ordentliche
  Hauptversammlung …“) · Shell, außerhalb dieser Scheibe; mit 089b oder einem Shell-Takt.
- 061 Teil B Design-Kritik D17 · `apps/web/src/components/Panel.tsx` (Haarlinienschatten) · D4 sagt „keine Schatten außer bei
  Dialogen“, das Bauteil (und mit ihm der Leitstand) trägt einen 1-px-Schatten · Konvention des Bauteilsatzes, im Design-Takt
  entscheiden (Schatten streichen oder D4 um die Haarlinie ergänzen).
- 061 Teil A Bau · `packages/domain/src/cockpit.ts` (`computeCockpit`) · eine Einzelfrage, die nach `now` erfasst wurde, und
  ihre eigenen Ereignisse nach `now` (Uhr zurückgestellt) zählen im Leitstand nirgends, in `computeIndicators` aber weiter im
  Bestand („offen“, Rückstand je Fachbereich, älteste offene mit Alter 0); die Gleichheit K3 gilt nur ohne solche Ereignisse · in
  071 oder 086 entscheiden, ob `/metrics` dieselbe Zeitgrenze bekommt (Golden neu, eigener Commit).
- 061 Teil A Nachprüfung (06.10.2026) minor · `docs/slices/061-leitstand.md:641-642` (K8) · der Wortlaut „Ereignis nach asOf zählt
  nirgends“ ist weiter als der Vertrag (nur eigene Frage-Ereignisse und Erfassungen nach `asOf`) · an den Vertrag angleichen.
- 061 Teil A Nachprüfung minor · `packages/domain/src/cockpit.ts:83` · Ereignisse der Versammlungsebene nach `asOf` zählen
  (`meetingStatus`, `debateClosedAt`, Fachbereichsliste bei zurückgestellter Uhr) · zusammen mit `/metrics` in 071 oder 086 entscheiden.
- 061 Teil B Design-Nachprüfung nit · `features/cockpit/Page.tsx` (`useCockpit`) · die Einrückung von `startCockpitFeed` ist
  verrutscht · kosmetisch, beim nächsten Anfassen.
- 061 Review Nit 7 · `indicators.ts` (`NOT_OPEN_STATUSES`), `state.ts` (`refreshCounts`, Liste inline), `types.ts`
  (`CockpitOpenStatus`) · drei Definitionen von „offen“ · später eine Konsistenzprüfung (Test, der alle drei gegeneinander hält)
  oder eine gemeinsame Quelle.
- 061 Review Nit 8 · `indicators.ts` (`withinWindow`) · exportiert, aber außerhalb der Datei ungenutzt · Export entfernen oder
  in `cockpit.ts` verwenden.
- 061 Review Nit 9 · Vertrag `Cockpit.openByUnit` (`maxProperties: 200`) und `CockpitOldestRef.status` · veraltete
  Fachbereichs-ids aus dem Log behalten einen Schlüssel und zählen gegen die Grenze; `status` ließe sich auf die offenen Status
  verengen · mit der nächsten Vertragsänderung am Leitstand.
- 061 Review Nit 10 · Commitfolge und Branch · das Golden kam vor dem Vertragsschritt (die Spec nennt den Vertragsschritt als
  ersten Commit; der Auftrag verlangte das Golden zuerst), der Branch heißt `claude/slice-061-leitstand` statt
  `claude/slice-061-kern` · nur festgehalten, keine Änderung.
- 061 Review Nit 11 · `scripts/metrics-allowlist-check.mjs` Regel (g) · `derived:` und `meta:` nehmen jeden Text an; der eigentliche
  Riegel ist A7 (Blattpfade aus dem Vertrag) · eine Begründungspflicht mit Mindestlänge oder geschlossene `meta:`-Liste prüfen.
- takt-052 Spec, Variante B · `packages/domain/src/seed.ts` (`seedEvents`) · der Faden einer Seed-Frage zeigt an jeder Station
  dieselbe Uhrzeit (die Lebensläufe werden mit gestaucht) · Lebenslauf je Frage über Minuten nach der Erfassung verteilen; die
  Log-Reihenfolge (`seq`) ändert sich, daher eigene Spec mit Wirkungsanalyse (`docs/slices/takt-052-seed-zeiten.md`, Bewertung).
- takt-052 Spec, bewusstes Nicht-Ziel · Leitstand-Zulauf · nach einer Stunde Vorführung ist der Zulauf leer (kein neuer Zulauf
  ohne Erfassung, kein Zeitgeber) · nur bei Bedarf eine eigene Scheibe (`docs/slices/takt-052-seed-zeiten.md`, Nicht-Ziele).

- takt-055 Review (06.10.2026) minor · `scripts/stack.test.mjs` · der Test prüft nur `plan.env`, nicht dass die Umgebung den
  Build-Aufruf erreicht · Prüfung, dass `plan.build` mit `{ env: plan.env }` läuft (oder Quellprüfung).
- takt-055 Codex P1 (#175) · `scripts/stack.mjs` `upPlan` · `BUILDX_BAKE_ENTITLEMENTS_FS=0` schaltet die Bake-Dateisystemprüfung
  für den Stack ab, weil Compose v5 die Freigabe `--allow=fs.read` nicht durchreicht · dauerhafte Lösung prüfen (Secret-Quelle
  ohne Lesefreigabe außerhalb des Kontexts, oder Compose-Schalter, sobald es einen gibt).

- Doku-Pass 06.10. Codex P2 (#176) · `docs/produktplan-beta.md` (041b) · 041b hängt im Plan nur an den Sammelknoten 040 und 041,
  nicht an 040c/040d (Specs noch im Status „spec“); plan-graph sieht die Abhängigkeit als erfüllt · eigene Planknoten für
  040c/040d anlegen oder 041b ausdrücklich bis zu deren Merge sperren.

## Skripte

- 043a/044a Doku · `scripts/downgrade-check.mjs:73` (`/^(\d{3})-.*\.md$/`) und `:28` (`BULLET_RE` mit `\d{3}`) · Specs mit
  Buchstaben (043a, 044a, 064a …) fallen aus der Prüfung; eine zu niedrig eingestufte Teil-Spec fällt nicht auf · Muster
  um `[a-z]?` erweitern und Teil-Specs gegen den Plan-Eintrag der Stammscheibe prüfen (ergänzt den Eintrag takt-021 Codex P1).
- Vorschlag (04.10.2026, #148 geschlossen wegen eines Gitleaks-Fehlalarms in einem Commit) · Ablauf vor dem Push · lokaler Gitleaks-Lauf über die Commits des Zweigs; das Programm fehlt im Container · Bereitstellung klären (Binärdatei im Bauabbild oder Pre-push-Skript), bis dahin gilt die Regel: Speichernamen als Modulkonstanten, nie als JSX-Literal.
- takt-046 Review (Sonnet, 05.10.2026) nit · `scripts/e2e-http-031.mjs:182` (`clock`) · rundet ab: bei 390_001 ms steht „6:30 … warning
  above 6:30“ · Kommentar oder aufrunden.
- takt-046 Review nit · `scripts/e2e-http-031.mjs:188-190` (`formatDuration`) · leere `stages` ergeben „stages: “ (praktisch
  unerreichbar) · festen Text „none“.
- takt-046 Review nit · `scripts/e2e-http-031.test.mjs:555-558` · die Regex prüft nicht die Reihenfolge von Aufräumen und Zeile im `finally`.
- takt-047 Nachprüfung (05.10.2026) minor · `scripts/release-age.mjs:7` (`PATTERN_ENTRY`) · breite Stämme wie `hono*` und `@a/*` sind
  erlaubt (Spec: mindestens 3 Zeichen oder ein voller Scope) · engere Regel.
- takt-047 Nachprüfung minor · `scripts/release-age.mjs:53` · Zeilen im Ausnahmeblock, die nur aus NBSP oder VT bestehen, werden
  übersprungen (verbirgt keinen Eintrag) · als unbekannte Zeile melden.
- takt-051 Folge · `pnpm-lock.yaml`, `scripts/audit-exceptions.json` · nach 2026-10-07T14:08Z `source-map-js` auf 1.2.2 anheben (ohne `minimumReleaseAgeExclude`) und Ausnahme 1241209 entfernen; Ausnahme läuft 2026-10-14 ab.


## Seed-Zeiten (aus takt-052, PR #173 offen)

Gelten erst nach dem Merge von PR #173; bis dahin stehen die Zeilen nicht im Integrationszweig.

- takt-052 Review (06.10.2026) minor · `packages/domain/src/seed.ts:671` (`place`) · Ereignisse vor der ersten Rede werden nicht auf
  `now − SEED_SPREAD_MS` gekappt; mit großen `roundSizes` (etwa `[400,400,300,100]`) ändert der stabile Sort die Reihenfolge ·
  `min(raw, now − SEED_SPREAD_MS)` oder Assert; heute nicht erreichbar (der Vertrag nimmt keine `roundSizes`).
- takt-052 Review minor · `packages/domain/src/__tests__/seed.test.ts:70` · der Test „ordered“ kann nicht scheitern (der Seed sortiert am
  Ende); die Reihenfolge schützt nur der Fingerabdruck · Test: F-Nummern steigen mit der Logposition, je Subjekt Erzeugungsreihenfolge.
- takt-052 Review minor · `seed-fictitious-names.test.ts:57` · die Maske verdeckt alle `at`, auch die unveränderten Vor-Rede-Zeiten ·
  Test für `now − 6,5 h + raw` oder nur Ereignisse nach der ersten Rede maskieren.
- takt-052 Review nits · `seed.ts:623/637` Platzhalter-`createdAt`; T5 ohne `roundSizes: []` · im Sammelgang.

## Entwurfspuffer und Fassungsvergleich (aus 060 Bau)

- 060 Bau · `apps/web/src/components/Button.tsx` · ein gesperrter Knopf (`aria-disabled`) trägt `pointer-events: none`; der zweite
  Klick eines echten Doppelklicks trifft deshalb den Rahmen darunter, und der Fokus verlässt den Speichern-Knopf (E8 prüft den
  Fokus darum nicht) · Sperre ohne `pointer-events: none` (Klick im Handler schlucken, wie heute schon) und E8 um den Fokus ergänzen.
- 060 Bau · Spec Entscheidung 2 / U1 nennt „Blocktyp `script`“ als Beispiel einer Ablehnung durch `checkAnswerBodyInput`; der Kern
  nimmt jeden Blocktyp bis 32 Zeichen an und bildet ihn auf einen Absatz ab (N1). Abgelehnt wird der manipulierte Eintrag erst
  durch den Schlüssel `html` im Block; ein Block `script` ohne fremde Schlüssel erscheint als Absatz mit Klartext (keine Senke) ·
  Spec-Wortlaut bei Gelegenheit berichtigen; keine engere eigene Regel (der Dienst würde den Entwurf annehmen).
- 060 Bau · Entscheidung 9 · der zweite Klick eines Doppelklicks auf „Mit meiner Fassung weiter“ landet dort, wo nun „Entwurf
  speichern“ steht; Speichern übergeht deshalb jeden Klick mit `detail > 1` (der erste Klick hat gehandelt) · Layout so ändern,
  dass unter den Entscheidungsknöpfen das Feld liegt.
- 060 Bau · Speichern, während schon weitergetippt wurde: der Eintrag behält bis zur nächsten Eingabe die alte Basisversion; ein
  Neuladen genau dazwischen zeigt das Band „Vergleichen“ gegen die eigene neue Version · nach dem Speichern mit verändertem Rest
  den Eintrag mit der neuen Basis neu schreiben.
- 060 Bau · Persona-Wechsel in der Demo erreicht den Puffer über den Lesepfad (`getActor` des Live-Speichers ruft `notice()`);
  `actor.ts` bietet kein Abonnement · bei der nächsten Scheibe an `actor.ts` ein `subscribe` anbieten und dort verdrahten.
- 060 Review nit 11 · die Doppelklick-Sperre (`detail > 1`) schluckt auch einen bewussten zweiten Klick auf eine andere Aktion
  an derselben Stelle · nach der Layoutänderung (Feld unter den Entscheidungen) entfernen.
- 060 Review nit 12 · E5 (http) belegt nicht, dass der Speicher **vor** der Abmeldeanfrage leer ist (nur danach); die Reihenfolge
  belegt U1 · im Double der Abmeldeanfrage den Objektspeicher lesen.
- 060 Design-Kritik minor 7 · die Spalten des Vergleichs sind in der geteilten Ansicht eng (Umbruch nach Fensterbreite, nicht
  nach Breite des Detailbereichs) · Container-Breakpoint erwägen.
- 060 Design-Kritik D5 · die Uhrzeit im Hinweis `focus.write.goneKept` steht nicht in Mono und ohne Datum (bei Ablauf am Folgetag
  missverständlich) · Datum ergänzen, Zeit in Mono (Toast mit Teilen).
- 060 Review nit · „wiederhergestellt“ zeigt HH:MM, „zwischengespeichert“ HH:MM:SS · eine Form festlegen.
- 060 Review nit · Uhrzeitformatierung an drei Stellen (`DraftNote`, `focus/Page.tsx`, `clockTime`) mit der Zeitzone des Geräts,
  während der Kopf „Ortszeit Berlin“ zeigt · eine gemeinsame Formatierung mit der Zeitzone der Versammlung.
- 060 Bau (CI-Lauf 37458349373) · Speichern offline im HTTP-Betrieb: die Schreibtür liest nach der Ablehnung neu, offline scheitert
  auch das, und `useBacklog` zeigt danach keine Frage mehr (das Feld verschwindet; der Text bleibt im Puffer und kommt beim
  nächsten Öffnen wieder) · bei einem gescheiterten Neuladen die zuletzt gezeigte Frage stehen lassen (Lane web-answers, 010d).
- 060 Re-Check · `rolesChanged()` bleibt für die ganze Sitzung gesetzt; spätere Abgänge aus dem Schreibmodus löschen Entwürfe auch für
  Fragen, die aus anderen Gründen gegangen sind · Merker nach der Prüfung zurücksetzen oder aus dem Datensatz der gehenden Frage
  entscheiden.
- 060 Re-Check · die gemerkten fehlgeschlagenen Akteur-ids erholen sich in der Sitzung nie · bekanntes Verhalten, passend zum
  ebenso bleibenden Zustand `unavailable`.
- ~~060 Re-Check · `apps/web/src/api/draftBuffer.ts` `startedIn === epoch ? await store.getAll() : []` · der zweite Zweig ist tot
  (die Epoche kann sich vor dem Aufruf nicht ändern) · entfernen.~~ Erledigt mit der Behebung von Codex P2 (#170).
- ~~060 Bau (CI-Läufe 37460605618, 37463402183) · **Demo verliert eine gespeicherte Antwortversion bei Neuladen innerhalb von
  150 ms** · `apps/web/src/api/index.ts` `saveLog` schreibt das Ereignislog entprellt (150 ms) in localStorage; ein Neuladen oder
  Schließen in diesem Fenster verliert jedes Ereignis seitdem (nachgestellt: `draftAnswer`, sofort `location.reload()` → Version fehlt).
  Vor 060 vorhanden, nur Demo (HTTP speichert im Dienst). E1 wartet seit 060 auf das Log · Log bei `pagehide` sofort schreiben (oder
  Schreiben nicht entprellen); Entscheidung an den Orchestrator, `index.ts` liegt dafür außerhalb der Dateien von 060.~~
  → erledigt in **takt-053** (#171 `84fbfe3`: das Demo-Protokoll wird beim Verlassen sofort geschrieben).

- takt-054 Bau (06.10.2026, zu prüfen) · `features/capture/ContributionPane.tsx:390` · bei einer Wortmeldung ohne Redebeitrag
  ersetzt das Gerüst das offene Eingabeformular bei jedem Neuladen von listContributions (Versionssprung, z. B. durch SSE),
  der Fokus im Textfeld geht dabei verloren (Verhalten vor takt-054 genauso, über status === 'loading') · Gerüst nur zeigen,
  solange noch nie für diese Wortmeldung geantwortet wurde.
- takt-054 Review minor 1 · `features/capture/Page.tsx` (`deskLoading`) · hängt das Lesen der Fragen eines Redebeitrags,
  zeigt die Erfassung das Gerüst ohne erneuten Versuch bis zum nächsten Neuladen · bei Fehler oder Zeitüberschreitung,
  solange `freshest` gesetzt und `shown` undefined ist, die Karte mit „Erneut versuchen“ zeigen.
- takt-054 Review nit 5 · `features/capture/deskLoading.test.ts` · zwei Tabellenzeilen fehlen: `landed = null, freshest = c1`
  und `settled = false, shown = c1` · ergänzen.
