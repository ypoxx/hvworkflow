# Scheibe 040c — Administration im Kern, Teil 3: Jahrgang, Erstinbetriebnahme, Nummernkreise

**Status:** spec (30.09.2026; überarbeitet nach dem Lesebefund zu `4fac838` und der Nachprüfung zu `bccba04`; Teil 3 von 4 der geteilten Scheibe 040; Zuschnitt, gemeinsame Entscheidungen und Eigentümerfragen in `docs/slices/040a-admin-ohne-inhaltsrechte.md`)
**Risikoklasse:** hoch · 2 AStd · Plan 040: 03.11.2026 (W6) · Lanes: contract (Architekt, erster Commit); core; service (Routen und Kommandozeile); web-api (nur neue `HvApi`-Methoden in `http.ts` und die Einträge im Live-Puffer `liveStore.ts`); manifests (nur ein Skript in `apps/api/package.json`); web-shell (nur erzwungene i18n-Schlüssel); web-history (nur `eventSummary.ts`); docs-betrieb; docs-plan (nur Glossar)
**Rolle:** architekt (Vertragsschritt, erster Commit); implementierer-backend. Review in frischem Kontext mit Perspektive Security/Admin (Erst-Admin, Rechteerhöhung) und Betrieb (Kommandozeile gegen Postgres); Lesebefund der Spec vor dem Bau; nie gebündelt (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** neu R-ADM-05 (Nummernkreis-Zugehörigkeit vergebener Nummern ändert sich nie), R-ADM-09 (ein Notzugang aus der Wiederherstellung legt keinen Jahrgang an). Angewandt: R-ADM-01 (aus 040b, hier auch für Nummernkreise), R-ADM-07 und R-ADM-08 (aus 040a), R-MTG-01, R-PERM-01, R-IDEM-01. Dazu AGENTS.md R2, R4, R6, R7, R8, R11, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` §5/040 („Jahrgang anlegen/klonen“, „Nummernkreise je Erfassungsplatz als Meeting-Daten (für den Papierpfad)“), §5/068 (Nachweis „Nummer außerhalb des Kreises → 422“), §5/070 (Runbook: Papierpfad mit Nummernkreisen), B14
- `docs/anforderungen-recherche.md:264, 373, 491` (MUSS: Papier-Fallback mit vorab reservierten Nummernkreisen je Erfassungsplatz)
- Spec 029b, Abschnitt „Erstvergabe vor der Beta“ („Scheibe 040 muss vor dem internen Betastart einen einmaligen, auditierbaren Betreiber-Bootstrap für Jahrgang und Erst-Admin … festlegen und implementieren“)
- Spec 023 (`createMeeting` vorab erklärt), Spec 043a (Lücke „Nummernkreise je Erfassungsplatz“), ADR 0011, ADR 0004, ADR 0015
- Bedrohungsmodell SG6, SG4, MF-01, T-G2-E-01, T-G3-E-03, T-G1-R-01; Register E8, E11

**Depends on:** 040b (gemergt, bevor dieser Bau beginnt); 025, 026, 027, 029b (gemergt)
**Perspektive:** Security/Admin, Betrieb · **Glossar: neue Begriffe:** ja: „Nummernkreis“ (capture number range, `CaptureRange`) und „Erfassungsplatz“ (capture station)

## Befund (Ist-Stand, gelesen auf `a3ba94b`)

- **`createMeeting`** ist vorab erklärt (`POST /meetings`, `admin.meetings.manage`, `MeetingCreate` mit
  `cloneFromMeetingId`; Allowlist `slice` 040). Der Kern hat keinen Weg, einen Jahrgang anzulegen: Nur der Seed und
  Testaufbauten schreiben `MeetingCreated`.
- **`append`** (`packages/domain/src/api.ts:601-617`) setzt für jedes Ereignis außer `MeetingCreated` die `meetingId`
  des geladenen Jahrgangs. Ein zweites Ereignis im **neuen** Jahrgang im selben Befehl ist heute nicht möglich.
- **Aktor beim Anlegen:** In der Sitzung ergibt `sessionActorFromEvents` (`apps/api/src/actor.ts:86-117`) den Akteur aus
  der ältesten aktiven Zuordnung über alle Jahrgänge. Ein neuer Jahrgang hat keine Zuordnung;
  `resolveMeetingActor` (`packages/domain/src/stream.ts:208-213`) lehnt dort jeden zuordnungsgebundenen Akteur ab.
  **Ohne Erstellerzuordnung könnte niemand den neuen Jahrgang verwalten.**
- **Erster Jahrgang überhaupt:** Ohne Jahrgang gibt es keine Zuordnung, ohne Zuordnung keinen Akteur. 029b hat das mit
  einer Testaufbau-Hilfe überbrückt und die Inbetriebnahme bis 040 gesperrt.
- **Kommandozeilen-Vorbild:** `apps/api/src/auth/subject-block-cli.ts` (Postgres, `assertRuntimePrivileges`, feste
  Ausgabe ohne Kennung und ohne Datenbankdiagnose). Die Schreibsperre des Dienstes ist
  `pg_advisory_xact_lock(27027, 1)` als Literal in `apps/api/src/app.ts:630`. `insertPostgresEvents` und
  `loadPostgresSnapshot` sind exportiert (`apps/api/src/persistence/postgres.ts`).
- **Fragenummer:** `captureQuestions` vergibt `F-${base + i + 1}` mit `base = state.questions.size` (`api.ts:909-918`).
- **Nummernkreise:** weder im Vertrag noch im Kern. Die Papierquelle (`Contribution.source: paper`, R-MTG-03) steht seit
  0.3.0/0.3.2; 068 soll Papiernummern gegen „reservierte Nummernkreise je Erfassungsplatz aus 040“ prüfen.

## Ziel und Entscheidungen vor Bau

Die Administration legt einen Jahrgang an oder klont ihn vom Vorjahr und verwaltet ihn danach selbst. Der Plattformbetreiber
legt den allerersten Jahrgang mit dem Erst-Admin einmal per Kommandozeile an. Für den Papierpfad reserviert die
Administration Fragenummern je Erfassungsplatz; die Systemnummerierung spart sie aus.

1. **`createMeeting`** (`POST /v1/meetings`, global), Recht `admin.meetings.manage`:
   - Prüfungen: `title` nach Trimmen nicht leer (422); `date` ein gültiges Datum (422); `cloneFromMeetingId` unbekannt →
     404.
   - Ein Befehl schreibt `MeetingCreated` mit `lifecycleVersion: 2` (Status `preparation`, Version 1), `format` (Standard
     `presence`) und, beim Klonen, `clonedFromMeetingId`.
   - **Klonen kopiert** TOPs (`id`, `number`, `title`, ohne Fortschritt), Fachbereiche und Bühnenplätze (`id`, `label`,
     `position`) **ohne** `personId` und `deviceId`: Personen und Geräte wechseln von Jahr zu Jahr, und eine Übernahme wäre
     unnötiger Personenbezug. Die ids bleiben gleich, damit der Vergleich zum Vorjahr ein Diff ist (Rechtekonzept §3
     Punkt 3). **Nicht kopiert:** Nummernkreise (sie gehören zum Druck des Jahrgangs), Freeze, Rollenzuordnungen,
     Wortmeldungen, Redebeiträge, Fragen, Ereignisse.
   - **Erstellerzuordnung.** Ist der Akteur zuordnungsgebunden (Sitzung), schreibt derselbe Befehl im neuen Jahrgang
     `RoleAssigned` für `actor.id` mit der Rolle, unter der er `admin.meetings.manage` gerade hält (`actor.role`, kein
     Rollenname im Code), ohne Einheit. Die Demo-Identität (nicht zuordnungsgebunden) erhält keine Zuordnung.
   - **Die Erstellerzuordnung hebt keine Grenze auf.** Maßgeblich ist die Zuordnung, unter der der Akteur gerade handelt:
     die älteste aktive Zuordnung seines Subjects über alle nicht geschlossenen Jahrgänge, dieselbe Auswahl wie
     `sessionActorFromEvents` (`apps/api/src/actor.ts:112-114`), im Kern aus dem Store bestimmt. Die neue Zuordnung
     übernimmt deren `expiresAt` unverändert. `deputyForSubjectId` wird **nicht** übernommen: Die vertretene Person hat
     im neuen Jahrgang keine Zuordnung, eine Vertretung dort wäre nach R-ADM-06 (040d) ungültig. Stammt diese Zuordnung aus der Wiederherstellung
     (Befehlsoperation `operatorRecovery`), antwortet `createMeeting` mit **409 R-ADM-09**, ohne Ereignis: Ein
     befristeter Notzugang darf sich nicht über einen neuen Jahrgang verlängern. So verleiht die Erstellerzuordnung nichts
     Neues, weder Rolle noch Dauer.
   - Beide Ereignisse tragen die `meetingId` des neuen Jahrgangs. `append` erhält dafür einen eng begrenzten Weg (nur für
     diesen Befehl), belegt durch Test 3.
   - Antwort 201 `Meeting` mit `ETag`; Projektion von `Meeting.format` und `Meeting.clonedFromMeetingId`.
   - **Wiederholung mit globalem Geltungsbereich.** `idempotent()` sucht heute nur Ereignisse des Alias-Jahrgangs
     (`api.ts:565-569`, `event.meetingId === meetingId`). Der neue Jahrgang ist nie der Alias, also fände eine Wiederholung
     ihr erstes Ergebnis nicht und legte einen zweiten Jahrgang an. Für `createMeeting` sucht die Wiederholung deshalb über
     **alle** Jahrgänge: gleiche Akteur-id, gleicher `Idempotency-Key`, Befehlsoperation `createMeeting`. Die
     Rekonstruktion liefert den damals angelegten Jahrgang. Test 10 mit Mutationsprobe.
   - Zeichenketten (`title`, `legalEntity`) müssen wohlgeformtes UTF-16 sein, sonst 422 (wie 040b).
2. **Betreiber-Bootstrap (029b).**
   - **Kern:** eine reine Funktion in `packages/domain/src/bootstrap.ts`, etwa
     `bootstrapEvents({ title, date, format?, adminSubjectId, operatorRef }, { existing, newId, now })`. Sie liefert
     `MeetingCreated` (`lifecycleVersion: 2`) und `RoleAssigned` für `adminSubjectId`, beide mit Akteur `SYSTEM_ACTOR` und
     der Befehlsoperation `operatorBootstrap`.
   - **Betreiberkennung:** `operatorRef` (pseudonym, Regeln wie `subjectId`, keine E-Mail, kein Klarname) steht in der
     Nutzlast beider Ereignisse. So nennt das Log, welche Betreiberkennung den Bootstrap ausgeführt hat; die Zuordnung der
     Kennung zu einer Person führt das Protokoll im Tagesbericht.
   - **Ablauf der Erstzuordnung:** keiner. Sie endet mit dem Schluss des Jahrgangs (wie jede Zuordnung ohne `expiresAt`).
     Die Verwaltung trägt die Erstellerzuordnung in den nächsten Jahrgang (Betriebsregel unten).
   - Die Rolle wird **aus den Daten abgeleitet**: die eine Rolle in `ROLE_PERMISSIONS`, die `admin.roles.manage` und
     `admin.meetings.manage` hält. Ist es nicht genau eine, bricht die Funktion ab (kein Rollenname, AGENTS.md R4).
   - **Einmalig:** Enthält `existing` irgendein `MeetingCreated`, bricht sie ab und liefert nichts.
   - `adminSubjectId` wird wie in `assignRole` geprüft (pseudonym, ohne `@` und Leerraum, höchstens 128 Zeichen).
   - **Wiederherstellung (auditiert, 040a R-ADM-08):** dieselbe Datei bietet eine zweite reine Funktion, etwa
     `recoveryEvents({ meetingId, adminSubjectId, operatorRef, expiresAt, reason }, { existing, newId, now })`. Sie
     liefert genau ein `RoleAssigned` (Akteur `SYSTEM_ACTOR`, Befehlsoperation `operatorRecovery`, Rolle wie beim
     Bootstrap abgeleitet) und bricht ab, wenn der Jahrgang fehlt oder geschlossen ist oder wenn **irgendein nicht
     geschlossener Jahrgang** noch eine **tragfähige** Zuordnung einer Verwaltungsrolle hat. Tragfähig heißt wie bei
     R-ADM-08 (040a): nicht entzogen, ohne Ablauf oder mit Ablauf frühestens 24 Stunden nach `now`, und das Subject ist
     **nicht** gesperrt; gesperrt heißt: in `auth_subject_blocks` aus 029b. Damit hilft die Wiederherstellung
     auch im typischen Fall, in dem das Subject der einzigen Verwaltung verloren und gesperrt ist, die Zuordnung aber
     aktiv bleibt. Die Funktion erhält die gesperrten Subjects als Parameter; die Kommandozeile liest sie in derselben
     Transaktion. `expiresAt` ist Pflicht und liegt höchstens 14 Tage nach `now`; `reason` (1–500, keine
     Personendaten) steht in der Nutzlast. Die befristete Zuordnung ist ein Notzugang: Die Person ordnet damit eine
     reguläre Verwaltungsrolle einem anderen Subject zu (R-ADM-07) und lässt den Notzugang ablaufen. Einen anderen
     Wiederherstellungsweg gibt es nicht, insbesondere keinen über HTTP.
   - **Geltungsbereich über alle nicht geschlossenen Jahrgänge.** Grund ist die globale Rollenauflösung der Sitzung:
     `sessionActorFromEvents` wählt die älteste aktive Zuordnung über alle nicht geschlossenen Jahrgänge
     (`apps/api/src/actor.ts:108-114`), und jahrgangsbezogene Routen wie `POST /v1/meetings/:meetingId/role-assignments`
     (`apps/api/src/app.ts:993-996`) nutzen diesen Akteur. Eine Verwaltung in Jahrgang A kann also auch in Jahrgang B
     Rollen zuordnen, und ein Notzugang wirkte umgekehrt auf jeden Jahrgang. Solange irgendwo eine tragfähige,
     ungesperrte Verwaltung besteht, ist niemand ausgesperrt; die Wiederherstellung wird dann verweigert. Der
     Missbrauchsfall dazu steht unten.
   - **Nach dem Freeze** (ab 040d) schreibt die Wiederherstellung in einem eingefrorenen Jahrgang zusätzlich
     `ConfigOverridden`; das legt 040d fest.
   - **Kommandozeile** `apps/api/src/admin/bootstrap-cli.ts`, Aufrufe
     `bootstrap --title "…" --date JJJJ-MM-TT --subject oidc_<actor-id> --operator <kennung>` und
     `recover --meeting <id> --subject oidc_<actor-id> --operator <kennung> --expires <ISO-Zeit> --reason "…"`
     (Format des Subjects wie `subject-block-cli.ts`), gestartet wie die übrigen Betreiberwerkzeuge des Dienstes (heute
     `tsx`, vgl. das Skript `db:migrate` in `apps/api/package.json`); ein Skript `admin:bootstrap` kommt dazu. Ablauf:
     - `assertRuntimePrivileges`;
     - eine Transaktion mit derselben Schreibsperre wie der Dienst. Die Sperrschlüssel wandern aus dem Literal in
       `app.ts:630` in ein kleines eigenes Modul `apps/api/src/writeLock.ts`, das Dienst und Kommandozeile importieren;
       die Kommandozeile importiert `app.ts` nicht (sie soll den Dienst nicht aufbauen);
     - geprüfte Kette laden, Ereignisse über die Kernfunktion bilden und über denselben Umschlag- und Hashweg wie der
       Dienst anhängen (`envelope.ts`, `insertPostgresEvents`), nie mit selbst gebauten Hashwerten;
     - COMMIT.
   - Ausgabe genau eine Zeile: „Bootstrap completed.“ bzw. „Recovery completed.“ (Code 0), „Bootstrap refused: a meeting
     already exists.“ bzw. „Recovery refused.“ (Code 2), „Bootstrap failed.“ bzw. „Recovery failed.“ (Code 1). Kein
     Subject, keine Betreiberkennung, keine Datenbankdiagnose in der Ausgabe.
   - Nur mit Postgres. Die JSONL-Datei ist ein Entwicklungsadapter (T-G2-E-02); dort sät die Demo.
   - `docs/betrieb/erstinbetriebnahme.md`: wer den Bootstrap ausführt (Plattformbetreiber, nach dem Go des Eigentümers,
     R11), Voraussetzungen (Migrationen, Keycloak-Subject aus 088), wie das Werkzeug im Laufzeitabbild gestartet wird,
     Schritte, erwartete Ausgabe, Vorgehen bei „refused“, Protokoll im Tagesbericht (Datum, ausführende Person,
     Betreiberkennung, Commit, Ausgabezeile). Dazu die **Betriebsregeln** aus 040a: den nächsten Jahrgang anlegen, bevor der
     laufende schließt; die Verwaltungsrolle mit Vertretung und ohne kurzen Ablauf vergeben; Wiederherstellung nur mit Go
     des Eigentümers und Protokoll.
3. **Nummernkreise je Erfassungsplatz.**
   - Neue Operationen `listMeetingCaptureRanges` (`GET /meetings/{meetingId}/capture-ranges`, jeder angemeldete Akteur)
     und `replaceMeetingCaptureRanges` (`PUT`, Recht `admin.meetings.manage`, `If-Match` Pflicht, weil die Operation neu
     ist).
   - `CaptureRange { id, label, from, to }`: ein reservierter Block von Fragenummern (F-n) für einen Erfassungsplatz;
     `label` benennt den Platz, zum Beispiel „Erfassung 1“. Keine Bindung an Gerät oder Person in 040c.
   - Ereignis `CaptureRangesReplaced { captureRanges: [...] }`, `subjectId` = `meetingId`, erhöht `Meeting.version`,
     Stromthema `meeting`.
   - 422: `from > to`, `from < 1`, `to > 999999`, Überlappung zweier Kreise, doppelte `id`, `label` leer oder länger als 100
     Zeichen, mehr als 50 Kreise.
   - 409 R-ADM-01: geschlossener Jahrgang.
   - 409 **R-ADM-05**: Für jede schon vergebene Fragenummer n bleibt gleich, in welchem Kreis sie liegt (oder dass sie in
     keinem liegt). Ein neuer Kreis darf also keine vergebene Systemnummer umschließen, und ein Kreis mit vergebenen
     Papiernummern (ab 068) darf sie nicht verlieren.
   - **Systemnummerierung:** Die nächste Nummer ist die kleinste Zahl n, die größer ist als die höchste vergebene Nummer
     **außerhalb** aller Kreise (0, wenn keine) und in keinem Kreis liegt. Ohne Kreise ergibt das genau die heutigen Nummern
     (Test 8). Papiernummern (068) liegen in Kreisen und verschieben die Systemfolge nicht.
4. **Rechte:** `admin.meetings.manage` kommt in `PERMISSIONS` und in die Liste der Administration.
5. **`HvApi`:** `createMeeting(input, opts)` (global), `listMeetingCaptureRanges(meetingId)`,
   `replaceMeetingCaptureRanges(meetingId, items, opts)` (Gemeinsame Entscheidung 5 in 040a: jeder Jahrgang, über eine
   auf `meetingId` eingegrenzte Instanz im Kern). `apps/web/src/api/http.ts` setzt sie um. Im Live-Puffer
   (`liveStore.ts`) kommt `listMeetingCaptureRanges` in `READ_TOPICS` (Thema `meeting`) und `WATERMARKS.version`;
   `createMeeting` und `replaceMeetingCaptureRanges` kommen in `WRITE_METHODS`. `label` der Nummernkreise muss
   wohlgeformtes UTF-16 sein, sonst 422.

## Vertragsschritt (Architekt, erster Commit; additiv, 043a Regel 1)

Version: die nächste freie Patch-Stufe beim Baustart.

- **`createMeeting`**: Beschreibung geschärft (Klonumfang mit und ohne `personId`/`deviceId`, nicht kopierte Teile,
  Erstellerzuordnung, 404 für unbekannte Quelle). Der Rumpf `MeetingCreate` bleibt unverändert.
- **Neue Operationen** `listMeetingCaptureRanges` und `replaceMeetingCaptureRanges` mit `CaptureRange` und
  `CaptureRangeInput` (`id?`, `label`, `from`, `to`; `additionalProperties: false`), Parameter `IdempotencyKey`,
  `CsrfToken`, `IfMatchRequired`; Antworten wie `replaceMeetingStageSeats` beim Baustart plus 428. Ohne Go auf
  043a-Frage 5: vorab erklärt mit Allowlist-Eintrag `slice` 040c, Ablauf 2026-11-25 (040a, Tabelle).
- **`Event.type`**: `CaptureRangesReplaced` mit gebundener Nutzlast. Beschreibung von `Event`: `MeetingCreated` trägt
  optional `format`, `clonedFromMeetingId`, `stageSeats`, `operatorRef`. `RoleAssignedPayload` erhält die optionalen
  Antwortfelder `operatorRef` und `reason` für die Befehlsoperationen `operatorBootstrap` und `operatorRecovery`
  (heute steht dort `reason: false`; der Architekt fasst das als Bedingung: `reason` nur bei `operatorRecovery`).
- **`createMeeting`**: Die Beschreibung nennt den globalen Geltungsbereich des `Idempotency-Key`.
- **`Problem.ruleId`**: R-ADM-05, R-ADM-09; `createMeeting` dokumentiert 409 (R-ADM-09).
- **Allowlist:** Eintrag `createMeeting` entfernen.
- **CHANGELOG** und **Typen** wie üblich. Die Kommandozeile ist keine HTTP-Operation und steht nicht im Vertrag.

## Nicht-Ziele

- Keine Oberfläche (041).
- Keine öffentliche Schlussaktion des Jahrgangs (takt-019: eigene Spec); kein Start (040d).
- Keine Papiererfassung mit Nummer und keine Prüfung „Nummer außerhalb des Kreises“ (068).
- Keine Bindung eines Kreises an Gerät oder Person; keine Wortmeldungsnummern (Eigentümerfrage 6 in 040a).
- Kein Ändern von Titel, Datum oder Format eines bestehenden Jahrgangs.
- Kein Bootstrap über HTTP, keine Umgebungsvariable, die beim Start schreibt.
- Kein Übertragen von Rollenzuordnungen beim Klonen.

## Files allowed

Vertrag (Architekt, erster Commit):

- `packages/contract/openapi.yaml`
- `packages/contract/CHANGELOG.md`
- `packages/contract/package.json` (nur das Versionsfeld)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/allowlist.json` (nur Eintrag für das Anlegen des Jahrgangs entfernen)

Kern:

- `packages/domain/src/types.ts`
- `packages/domain/src/events.ts`
- `packages/domain/src/envelope.ts` (nur die Liste der Ereignistypen)
- `packages/domain/src/state.ts`
- `packages/domain/src/api.ts`
- `packages/domain/src/permissions.ts` (nur das neue Recht in der Liste der Administration)
- `packages/domain/src/rules.ts` (nur R-ADM-05, R-ADM-09)
- `packages/domain/src/stream.ts` (nur Themen und Subjekte je Ereignistyp)
- `packages/domain/src/index.ts` (nur Exporte)
- `packages/domain/src/bootstrap.ts` (neu)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `packages/domain/src/__tests__/meeting040c.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur neue Spalte im Abschnitt „Role × Administration“)
- `packages/domain/src/__tests__/stream035.test.ts` (nur die Liste aller Ereignistypen und die Erwartungen an Themen je Ereignistyp)
- `docs/legal-trace.md` (nur regeneriert)

Dienst:

- `apps/api/src/app.ts` (nur die drei Routen und der Import der Sperrschlüssel aus dem neuen Modul)
- `apps/api/src/writeLock.ts` (neu: nur die Sperrschlüssel der Schreibtransaktion)
- `apps/api/src/admin/bootstrap-cli.ts` (neu)
- `apps/api/src/__tests__/meeting040c.test.ts` (neu)
- `apps/api/src/__tests__/postgres-bootstrap040c.test.ts` (neu)
- `apps/api/src/__tests__/contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-016-contract.test.ts` (nur die Versionszeile, falls die Minor-Stufe wechselt)
- `apps/api/src/__tests__/contract-043a.test.ts` (nur die Versionszeile, falls 043a gemergt ist)
- `apps/api/package.json` (nur das Skript für das Betreiberwerkzeug)

Web (nur was die Schnittstelle des Kerns und die erschöpfenden Zuordnungen erzwingen):

- `apps/web/src/api/http.ts` (nur die neuen Methoden)
- `apps/web/src/api/http.test.ts` (nur Tests der neuen Methoden)
- `apps/web/src/api/liveStore.ts` (nur Einträge in den Lesethemen, den Schreibmethoden und dem Versionszähler)
- `apps/web/src/api/index.ts` (nur falls die Verdrahtung der neuen Methoden es verlangt)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur ein Aktions- und ein Ereignisschlüssel)
- `apps/web/src/i18n/labels.ts` (nur Einträge in den Zuordnungen der Aktionen und Ereignisse)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)
- `apps/web/src/features/history/eventSummary.ts` (nur ein leerer Fall)

Dokumente:

- `docs/betrieb/erstinbetriebnahme.md` (neu)
- `docs/glossar.md` (nur die Zeilen „Nummernkreis“ und „Erfassungsplatz“)
- `docs/folgeliste.md`
- `docs/slices/040c-jahrgang-erstinbetriebnahme-nummernkreise.md`

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/domain/src/transitions.ts`, `packages/domain/src/seed.ts`, `packages/domain/src/store.ts`,
`apps/api/src/persistence/**`, `apps/api/migrations/**`, `apps/api/src/actor.ts`, `apps/web/src/features/**` außer
`eventSummary.ts`, `apps/web/src/app/**`, `scripts/**`, `docs/adr/**`, `docs/entscheidungsregister.md`,
`docs/produktplan-beta.md`, die Allowlist-Einträge außer dem genannten. Dieser Abschnitt steht bewusst außerhalb von
„Files allowed“.

## Vor dem Bau prüfen

1. 040b ist gemergt (Plätze, `StageSeatsReplaced`, R-ADM-01). Sonst anhalten.
2. Welcher Akteur prüft `createMeeting` in der Sitzung? Erwartet: derselbe wie für `listMeetings` (älteste aktive
   Zuordnung). Weicht es ab: melden, bevor Test 3 geschrieben wird.
3. Lässt sich der Bootstrap mit `loadPostgresSnapshot`, dem Umschlag aus `envelope.ts` und `insertPostgresEvents` bauen,
   ohne `apps/api/src/persistence/**` zu ändern? Wenn nein: anhalten und melden (Lane persist gehört nicht zu dieser
   Scheibe).
4. Gibt es außer `captureQuestions` eine Stelle, die Fragenummern bildet oder aus `questions.size` ableitet? Alle Stellen
   folgen derselben Funktion.
5. Liest `sessionActorFromEvents` ein `RoleAssigned` mit Akteur `system` im neuen Jahrgang als gültige Zuordnung des
   Subjects? Beleg in Test 13.
6. **Laufzeit des Werkzeugs:** Wie startet `subject-block-cli.ts` im Laufzeitabbild (037) — über `tsx` wie `start` und
   `db:migrate`, oder anders? Das Betreiberwerkzeug startet genauso; die Antwort steht in `erstinbetriebnahme.md`. Ist im
   Abbild kein Weg vorhanden: anhalten und melden.
7. Gilt der globale Wiederholungsschlüssel für `createMeeting` ohne Änderung an den übrigen Operationen? Die Änderung an
   `idempotent()` bleibt auf `createMeeting` begrenzt.

## Tests zuerst (rot, dann grün)

Kern (`meeting040c.test.ts`):

1. **Anlegen:** `createMeeting({title, date})` → Status `preparation`, Version 1, leere Listen, `format: presence`;
   `MeetingCreated` mit `lifecycleVersion: 2`.
2. **Klonen:** Quelle mit geöffnetem TOP, Plätzen mit `personId`/`deviceId` und einem Nummernkreis → Ziel mit gleichen
   TOP-ids ohne Fortschritt, gleichen Fachbereichen, Plätzen ohne `personId` und `deviceId`, ohne Nummernkreise,
   `clonedFromMeetingId` gesetzt; die Quelle ist unverändert. Unbekannte Quelle → 404, kein Ereignis.
3. **Erstellerzuordnung:** Ein zuordnungsgebundener Akteur (admin in Jahrgang A) legt B an → im selben Befehl
   `RoleAssigned` für `actor.id` mit derselben Rolle; beide Ereignisse tragen `meetingId` B (nicht den Alias-Jahrgang);
   danach gelingt `assignRole` in B als dieser Akteur. Demo-Identität → kein `RoleAssigned`.
4. **Rechte:** Jede Rolle ohne `admin.meetings.manage` → 403 R-PERM-01, kein Ereignis.
5. **Bootstrap-Funktion:** leeres Log → genau `MeetingCreated` und `RoleAssigned` (Akteur `system`, Subject wie
   übergeben, abgeleitete Rolle); Log mit einem Jahrgang → Abbruch ohne Ereignis; Subject mit `@` → Abbruch.
6. **Abgeleitete Rolle:** Die Ableitung (als reine Funktion über eine übergebene Tabelle) liefert für
   `ROLE_PERMISSIONS` genau eine Rolle; für eine Testtabelle mit zwei passenden Rollen und für eine ohne passende Rolle
   bricht sie ab.
7. **Nummernkreise:** Ersetzen gelingt; 422 bei Überlappung, `from > to`, doppelter `id`; 409 R-ADM-01 auf einem
   geschlossenen Jahrgang; 409 R-ADM-05, wenn ein Kreis eine vergebene Nummer umschließt; Verschieben eines Kreises ohne
   vergebene Nummer darin gelingt.
8. **Nummerierung:** Mit vier vergebenen Fragen und dem Kreis 5–9 erhalten die nächsten zwei Fragen F-0010 und F-0011.
   Auf dem Seed ohne Kreise sind alle Nummern gleich wie vorher (Vergleich mit einer Referenzfolge im Test).
9. **Rechte Nummernkreise:** nur `admin.meetings.manage`; `listMeetingCaptureRanges` für jeden angemeldeten Akteur.
10. **Wiederholung, global:** `createMeeting` mit gleichem `Idempotency-Key` liefert denselben Jahrgang und kein zweites
    `MeetingCreated`, auch wenn inzwischen ein anderer Jahrgang der Alias ist; mit anderem Akteur gilt der Schlüssel nicht.
10a. **Betreiberkennung und Wiederherstellung:** `bootstrapEvents` schreibt `operatorRef` in beide Nutzlasten und kein
    `expiresAt`; `recoveryEvents` bricht ab, solange eine tragfähige Verwaltungsrolle besteht, **auch wenn sie in einem
    anderen nicht geschlossenen Jahrgang liegt**; eine Zuordnung, die in weniger als 24 Stunden abläuft, zählt nicht; mit
    derselben Zuordnung, deren Subject in den übergebenen gesperrten Subjects steht, gelingt sie; bei geschlossenem Jahrgang, ohne
    `expiresAt` und bei `expiresAt` mehr als 14 Tage nach `now`; sonst genau ein `RoleAssigned` mit Akteur `system`,
    `operatorRef`, `reason` und `expiresAt`.
10b. **Surrogate:** `title: '\uDC00'` in `createMeeting` und `label` mit einzelnem Surrogat in
    `replaceMeetingCaptureRanges` → 422, kein Ereignis.
10d. **Erstellerzuordnung ohne Grenzaufhebung:** Handelt der Akteur unter einer Zuordnung mit `expiresAt` und
    `deputyForSubjectId`, trägt die neue Zuordnung dasselbe `expiresAt` und kein `deputyForSubjectId`; handelt er unter einer Zuordnung aus `operatorRecovery`
    → 409 R-ADM-09, kein Ereignis.
10c. **Anderer Jahrgang:** `replaceMeetingCaptureRanges` auf einem Jahrgang in `preparation`, während ein anderer läuft,
    schreibt mit dessen `meetingId`.

Dienst:

11. `POST /v1/meetings` → 201 mit `ETag` und gültigem `Meeting`; Klonen über HTTP; 403 als `observer` mit `ruleId`; 404
    bei unbekannter Quelle; 422 bei leerem `title`.
12. `GET`/`PUT /v1/meetings/{id}/capture-ranges`: 200; ohne `If-Match` 428; veraltet 412; 409 mit `ruleId` R-ADM-05.
13. **Postgres** (`postgres-bootstrap040c.test.ts`, läuft in CI mit Postgres): Kernablauf der Kommandozeile auf leerer
    Datenbank → zwei Ereignisse, die Kette ist beim nächsten Laden gültig, eine Sitzung des Subjects löst im neuen
    Jahrgang die abgeleitete Rolle auf; zweiter Lauf → Code 2, Ereigniszahl unverändert; keine Ausgabezeile enthält das
    Subject oder die Betreiberkennung. Wiederherstellung: nach dem Entzug aller Verwaltungsrollen im Testaufbau (über
    Ablauf, weil R-ADM-08 den letzten Entzug sperrt, und über einen Eintrag in `auth_subject_blocks` für eine noch aktive
    Zuordnung) → „Recovery completed.“, danach löst die Sitzung die befristete
    Rolle auf; ein zweiter Lauf → Code 2.
14. **Vertrag:** Die Allowlist enthält `createMeeting` nicht mehr; die zwei neuen Operationen verlangen `If-Match`; das
    Abdeckungstor meldet alle drei als ausgeübt.

`transitions.test.ts`: Der Abschnitt „Role × Administration“ erhält die Spalte `admin.meetings.manage` (✓ nur bei admin).

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):
- Einmal-Prüfung im Bootstrap entfernt → Test 5 und Test 13 rot.
- Nummerierung ohne Kreise (`base + i + 1`) → Test 8 rot.
- R-ADM-05 entfernt → Test 7 rot.
- Erstellerzuordnung mit der `meetingId` des Alias-Jahrgangs → Test 3 rot.
- Wiederholungssuche für `createMeeting` auf den Alias-Jahrgang begrenzt (heutiges Verhalten) → Test 10 rot.
- Wiederherstellung ohne Prüfung „keine tragfähige Verwaltungsrolle“ → Test 10a rot.
- Wiederherstellung prüft nur den genannten Jahrgang (Prüfung je Jahrgang wiederhergestellt) → Test 10a rot.
- Erstellerzuordnung ohne `expiresAt` (heutiger Entwurf) → Test 10d rot.
- Prüfung R-ADM-09 entfernt → Test 10d rot.

## Akzeptanzkriterium

1. `pnpm contract:lint` grün ohne neue Meldung; `pnpm contract:types` ohne Diff beim zweiten Lauf; `check.mjs` (a)–(d)
   `ok`.
2. Tests 1–14 (mit 10a–10d) grün, neun Mutationsproben rot belegt; Wahrheitstabellen-Diff nur die neue Spalte.
3. Ein Trockenlauf der Kommandozeile gegen die CI-Datenbank (Test 13) ist im Bericht mit Ausgabezeile belegt.
4. `pnpm gates` (mit Postgres-Variablen wie in CI) grün, einschließlich `slice-scope` auf `claude/slice-040c-…`; Schluss der
   Ausgabe einmal im Bericht.
5. Kein Screenshot (keine Ansicht ändert sich).

## Nachweise

- Auszug `check.mjs`, Typen-Diff (`CaptureRange`, `Event`).
- Ausgabe von Test 13 (beide Läufe), Wahrheitstabellen-Diff, Mutationsproben.
- Schluss von `pnpm gates` mit Commit-Hash.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Vertrag, Ereignis, Konfiguration
- [x] Rolle, Recht, Identität (Erst-Admin, Erstellerzuordnung)
- [x] Administration
- [x] Betrieb, Wiederherstellung (Kommandozeile gegen Produktivpersistenz)
- [x] Dokumentation (Erstinbetriebnahme)
- [ ] Oberfläche

Perspektive: Security/Admin (6.5, 6.8), Betrieb (6.7), Vertrag (6.4) · Nachweise: Tests 1–14, Mutationsproben,
Trockenlauf · Offene Entscheidung: E8 (Tabelle ist Wahrheit, unverändert), E11 (Keycloak-Subject aus 088), Eigentümerfrage 6
in 040a

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Bedrohungen:**
  - **MF-01** (Rechteerhöhung über die Rollenzuordnung): Die Erstellerzuordnung überträgt nur die eigene Rolle. Der
    Bootstrap ist einmalig und nur mit Datenbankzugang ausführbar.
  - **T-G2-E-01** (Dienstrolle mit zu viel Recht): Die Kommandozeile nutzt die Laufzeitrolle (nur INSERT und SELECT) und
    schreibt über denselben Hashweg. Wer sie ausführen kann, hat diesen Zugang ohnehin; sie verleiht kein neues Recht.
  - **SG4** (Integrität des Logs): Bootstrap-Ereignisse stehen in der Kette, mit Akteur `system`, Serverzeit und
    Befehlsoperation `operatorBootstrap`.
  - **T-G3-E-03** (IdP-Gruppe wird Rolle): Der Erst-Admin kommt aus einem ausdrücklichen Subject, nicht aus einer Gruppe.
  - **T-G1-R-01** (Abstreiten): Wer den Bootstrap ausgeführt hat, steht im Protokoll des Tagesberichts; das Ereignis
    nennt `system`.
- **Missbrauchsfälle mit Erkennung:**

  | Missbrauch | Abwehr | Erkennung, Nachweis |
  |---|---|---|
  | Bootstrap später erneut, um sich Admin zu geben | Einmal-Prüfung auf `MeetingCreated` | Test 5, Test 13; `RoleAssigned` mit Befehlsoperation `operatorBootstrap` nach dem ersten Jahrgang kann es nicht geben; jedes `operatorRecovery` meldet ein Alarmvorschlag an 085 |
  | Wiederherstellung missbrauchen, um sich neben einer bestehenden Verwaltung einen Zugang zu geben | nur, wenn **kein** nicht geschlossener Jahrgang eine tragfähige, ungesperrte Verwaltungsrolle hat (die Sitzung löst Rollen global auf, ein Notzugang wirkt auf jeden Jahrgang); befristet höchstens 14 Tage; nur mit Datenbankzugang. **Restrisiko:** Wer Datenbankzugang hat und alle Verwaltungs-Subjects sperren kann, kann danach wiederherstellen; beides sind Betreiberhandlungen mit eigenem Protokoll | Test 10a, Test 13; `RoleAssigned` mit `operatorRecovery`, `operatorRef` und Grund; Protokoll im Tagesbericht |
  | Jahrgang anlegen, um darin eine fremde Rolle zu erhalten | nur die eigene Rolle wird übertragen; weitere Zuordnungen laufen über `assignRole` (seit 040a ohne Selbstzuordnung, R-ADM-07); Ablauf und Vertretung der eigenen Zuordnung werden übernommen; ein Notzugang legt keinen Jahrgang an (R-ADM-09) | Test 3; `RoleAssigned` in der Historie |
  | Personen und Geräte des Vorjahres still übernehmen | Klonen ohne `personId`/`deviceId` | Test 2 |
  | Nummernkreis nachträglich über vergebene Nummern legen, um Papier- und Systemvorgänge zu vermischen | R-ADM-05 | Test 7; `CaptureRangesReplaced` mit Akteur |

- **Invarianten:** Kein Jahrgang ohne verwaltende Rolle nach dem Anlegen in der Sitzung. Der Bootstrap schreibt höchstens
  einmal je Datenbank. Eine Fragenummer wechselt nie ihren Kreis.
- **Fehlerfälle:** Bricht die Kommandozeile nach BEGIN ab, wird nichts geschrieben (eine Transaktion). Ein zweiter
  Betreiberlauf endet mit Code 2.
- **Betrieb:** neue Betriebsdoku; das Runbook (070) verweist darauf; 088 liefert das Subject.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. Kein Rollenname im Kern oder in der Kommandozeile (Tor role-literals); die Bootstrap-Rolle ist aus den Daten abgeleitet.
2. Die Kommandozeile hat keine HTTP-Route und wird vom Dienst nicht geladen.
3. Ausgabe ohne Subject und ohne Datenbankdiagnose.
4. Erstellerzuordnung nur mit `actor.role` und nur für zuordnungsgebundene Akteure.
5. Ein Allowlist-Eintrag entfernt, nicht mehr.

## Offene Eigentümerfragen

Siehe `docs/slices/040a-admin-ohne-inhaltsrechte.md`, Fragen 1 und 6.

## Hinweise an Folgescheiben

- **068:** Papiernummern liegen in einem Kreis; die Prüfung „Nummer außerhalb des Kreises → 422“ und das Vergeben der
  Papiernummer liegen dort. R-ADM-05 schützt die Zuordnung danach.
- **070:** Runbook verweist auf `docs/betrieb/erstinbetriebnahme.md` und auf die Nummernkreise.
- **085:** Alarmvorschläge: jedes `RoleAssigned` mit Befehlsoperation `operatorRecovery`; Anlegen eines Jahrgangs. Die Erstellerzuordnung (Akteur = Subjekt, gleiche Rolle) ist kein Alarmfall.
- **088:** liefert das Subject des Erst-Admins; die Checkliste nennt den Bootstrap.

## Bericht (nach Bau ausfüllen)

```
Slice: 040c-jahrgang-erstinbetriebnahme-nummernkreise
Done:
Evidence:
Open:
Touched:
```

**Vor dem Bau prüfen (Ergebnisse).**
1.
2.
3.
4.
5.

**Namen der neuen `HvApi`-Methoden.**

**Trockenlauf der Kommandozeile (Ausgabe).**

**Mutationsproben (Ergebnis).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings

**Lesebefund der Spec (30.09.2026, zu `4fac838`):** eingearbeitet in 040c: Major 1 (`liveStore.ts`), Major 2
(`stream035.test.ts`), Major 3 (`contract-043a.test.ts`), Major 6 (`meetingId`, Test 10c), Major 7 (globaler
Wiederholungsschlüssel, Test 10 mit Mutationsprobe), Major 9 (auditierte Wiederherstellung, Betriebsregeln), Minor 16
(Surrogate, Test 10b), Minor 20 (`operatorRef`, kein Ablauf der Erstzuordnung, befristete Wiederherstellung), Minor 21
(`writeLock.ts` statt Import aus `app.ts`, Prüfung der Laufzeit), Nit 27 (Ausnahme der Erstellerzuordnung).

**Nachprüfung (30.09.2026, zu `bccba04`):** eingearbeitet in 040c: N2 (Erstellerzuordnung übernimmt Ablauf und
Vertretung; Notzugang legt keinen Jahrgang an, R-ADM-09; Test 10d mit zwei Mutationsproben), N5 (Wiederherstellung auch,
wenn jede aktive Verwaltungsrolle einem gesperrten Subject gehört), N7 (Geltungsbereich zunächst je Jahrgang, nach der
letzten Nachprüfung zu `a1395b7` über alle nicht geschlossenen Jahrgänge wegen der globalen Rollenauflösung; Missbrauchszeile
mit Restrisiko), N9 (Verweis auf 040a).

**Letzte Nachprüfung (30.09.2026, zu `a1395b7`):** eingearbeitet: Wiederherstellung nur, wenn kein nicht geschlossener
Jahrgang eine tragfähige, ungesperrte Verwaltungsrolle hat (globale Rollenauflösung, `actor.ts:108-114`, `app.ts:993-996`),
Test 10a und Mutationsprobe; Erstellerzuordnung ohne `deputyForSubjectId` (Test 10d).
