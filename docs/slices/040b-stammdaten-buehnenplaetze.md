# Scheibe 040b — Administration im Kern, Teil 2: Stammdaten und Bühnenplätze

**Status:** spec (30.09.2026; überarbeitet nach dem Lesebefund zu `4fac838` und der Nachprüfung zu `bccba04`; Teil 2 von 4 der geteilten Scheibe 040; Zuschnitt, gemeinsame Entscheidungen und Eigentümerfragen in `docs/slices/040a-admin-ohne-inhaltsrechte.md`)
**Risikoklasse:** hoch · 1,5 AStd · Plan 040: 03.11.2026 (W6) · Lanes: contract (Architekt, erster Commit; siehe „Vertragsschritt“); core; service; web-api (nur neue `HvApi`-Methoden in `http.ts` und die Einträge im Live-Puffer `liveStore.ts`); web-shell (nur erzwungene i18n-Schlüssel); web-history (nur `eventSummary.ts`); docs-datenschutz; docs-plan (nur Glossarzeile)
**Rolle:** architekt (Vertragsschritt, erster Commit); implementierer-backend (Kern, Dienst, Web-Adapter, zweiter und folgende Commits). Review in frischem Kontext mit Perspektive Security/Admin und Vertrag (6.4); Lesebefund der Spec vor dem Bau; nie gebündelt (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** neu R-ADM-01 (Konfiguration eines geschlossenen Jahrgangs unveränderlich; die Registerbeschreibung nennt schon Nummernkreise, Freeze und Override aus 040c/040d), R-ADM-02 (referenzierte Stammdaten bleiben). Angewandt: R-PERM-01, R-PERM-02, R-IDEM-01. Dazu AGENTS.md R2, R4, R5, R6, R7, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` §5/040 (Fachbereiche, TOPs, Bühnenplätze mit Person und Gerätekennung, Einheit „AR-Büro“, `counts.byUnit`/`bySeat`), §3 Zeile 200 (Bühnenplatzliste je Jahrgang, ADR 0006), Zeile 220 und Register E46 (AR-Büro), E7 (Bühnenplätze als Grundlage für `podiumVisibility`, 047)
- ADR 0006 (Bühnenplatzliste statt Enum), ADR 0015, ADR 0002, ADR 0009
- Spec 023 (Vertrag 0.3.0: Operationen und Schemas mit „slice 040“), Spec 043a (Regel 1, Tabellenzeile `Classification.seatId`), Spec 040a (Zuschnitt)
- Bedrohungsmodell SG6, T-G1-I-01, T-G1-E-01, T-G1-E-05, T-G1-T-02, T-G1-T-03
- DSFA-Vorentwurf V4, V8, V12

**Depends on:** 040a (gemergt, bevor dieser Bau beginnt); 025, 026, 028 (gemergt)
**Perspektive:** Security/Admin, Vertrag · **Glossar: neue Begriffe:** nein; die Zeile „Bühnenplatz“ erhält ihre Code-Spalte (`StageSeat`, `seatId`)

## Befund (Ist-Stand, gelesen auf `a3ba94b`)

- **Vertrag 0.3.12 hat alles Nötige als Form, der Kern nichts davon.**
  - Vorab erklärt (Allowlist, `slice` 040, Ablauf 25.11.2026): `replaceMeetingAgendaItems` (`agenda.manage`),
    `replaceMeetingUnits` (`admin.units.manage`), `listMeetingStageSeats`, `replaceMeetingStageSeats`
    (`admin.seats.manage`). Schemas `AgendaItemInput`, `UnitInput`, `StageSeat`, `StageSeatInput` stehen.
  - `Question.seatId` steht auf der Antwortseite (seit 0.3.0), mit `if`/`then`: sind `stageAssignment` und `seatId` beide
    da, sind sie gleich. `Classification` hat **kein** `seatId` (bewusst, Review 023).
  - `Meeting.counts.byUnit` und `bySeat` stehen im Vertrag („slice 040“), der Kern projiziert sie nicht
    (`packages/domain/src/state.ts:61-80`, Domänentyp `Meeting.counts` ohne beide).
  - Die Rechte `admin.units.manage` und `admin.seats.manage` stehen im Vertrag (`Action`), nicht in `PERMISSIONS`
    (`packages/domain/src/types.ts:33-64`).
  - Es gibt **keinen Ereignistyp** für eine Stammdatenänderung (`Event.type`; Spec 023, Offen: „die Typen müssen … in den
    Vertrag“).
- **Kern:** Kein Bühnenplatz, kein `seatId`. `QuestionClassified` trägt nur `stageAssignment` (Enum der vier Werte,
  `state.ts:344-345`). `MeetingCreated` trägt TOPs und Fachbereiche (`events.ts:43-54`), sonst ändert nichts die
  Stammdaten.
- **Seed:** acht Fachbereiche ohne AR-Büro (`seed.ts:38-47`); die Fragen tragen `stageAssignment` aus
  `STAGE_ASSIGNMENTS`.
- **Personentabelle:** `state.persons` enthält die Personen der Wortmeldungen (Aktionäre), nicht die Podiumsmitglieder.
  `assignRole` prüft `personId` gegen diese Tabelle (`api.ts:731-732`).
- **Erschöpfende Zuordnungen im Web:** `ACTION_KEYS` und `EVENT_KEYS` (`apps/web/src/i18n/labels.ts:52, 98`) und der
  `switch` in `apps/web/src/features/history/eventSummary.ts` brechen die Typprüfung bei jedem neuen Recht bzw.
  Ereignistyp. `parity.test.ts:161` zählt 515 Schlüssel.
- **Wiederholung:** `operationPermission` und `legacyEventType` (`api.ts:458-476`) steuern die Rekonstruktion eines
  wiederholten Schreibvorgangs (R-IDEM-01); `EVENT_TYPES` (`envelope.ts:5`) prüft den Typ beim Laden.
- **If-Match:** Die vier Operationen verwenden `IfMatch` (optional), nicht `IfMatchRequired`.

## Ziel und Entscheidungen vor Bau

Die Administration pflegt TOPs, Fachbereiche und Bühnenplätze eines Jahrgangs als ganze Listen. Jede Änderung ist ein
Ereignis. Die Klassifizierung setzt einen Bühnenplatz aus dieser Liste. Kopf und Steuerung lesen offene Fragen je
Fachbereich und Bühnenfragen je Platz aus `Meeting.counts`.

1. **Drei Ereignistypen mit ganzer Liste**, `subjectId` = `meetingId`, jedes erhöht `Meeting.version`:
   - `AgendaItemsReplaced` `{ agendaItems: [{ id, number, title }] }`. Ein TOP mit gleicher `id` behält seine
     Fortschrittszeiten (`openedAt`, `votingOpenedAt`, `votingClosedAt`) in der Projektion.
   - `UnitsReplaced` `{ units: [{ id, name, shortName? }] }`.
   - `StageSeatsReplaced` `{ stageSeats: [{ id, label, position?, personId?, deviceId? }] }`.
   - `MeetingCreated` erhält das optionale Feld `stageSeats` (gleiche Form) für den Seed und das Klonen (040c). Fehlt es
     (alle bisherigen Logs), ist die Platzliste leer.
   - Stromthema `meeting`, Subjekt der Jahrgang (`EVENT_TOPICS`, `EVENT_SUBJECTS` in `stream.ts`).
2. **Operationen** (alle je Jahrgang, `meetingId` im Pfad):

   | Operation | Recht | Prüfungen | Wirkung |
   |---|---|---|---|
   | `replaceMeetingAgendaItems` | `agenda.manage` | 422: doppelte `id`, doppelte `number`; 409 R-ADM-01; 409 R-ADM-02: ein entfallender TOP hat eine Frage (`agendaItemId`) oder einen Fortschritt (`openedAt`) | `AgendaItemsReplaced`; Antwort nach `number` sortiert |
   | `replaceMeetingUnits` | `admin.units.manage` | 422: doppelte `id`; 409 R-ADM-01; 409 R-ADM-02: ein entfallender Fachbereich ist `unitId` einer Frage oder einer aktiven Rollenzuordnung (nicht entzogen, nicht abgelaufen) | `UnitsReplaced` |
   | `listMeetingStageSeats` | jeder angemeldete Akteur (Stammdaten) | — | nach `position`, dann `id`; `personId` und `deviceId` **nur** für Halter von `admin.seats.manage` (über `can()`), sonst fehlen beide |
   | `replaceMeetingStageSeats` | `admin.seats.manage` | 422: doppelte `id`, doppelte `position`, doppelte `deviceId`, `personId`/`deviceId` nicht pseudonym (enthält `@` oder Leerraum; wie `subjectId` in `api.ts:722-723`); 409 R-ADM-01; 409 R-ADM-02: ein entfallender Platz ist `seatId` einer Frage (ausdrücklich oder abgeleitet) | `StageSeatsReplaced` |

   - **R-ADM-01 je Schicht.** Die Regel sitzt im Kern und antwortet dort 409, wenn der Akteur den Jahrgang noch
     erreicht: die Demo-Identität (nicht zuordnungsgebunden) und Kern-Tests mit synthetischem Akteur. Über HTTP mit einer
     Sitzung kommt es nicht so weit: `sessionActorFromEvents` (`apps/api/src/actor.ts:104-111`) und die eingegrenzte
     Akteurauflösung (`resolveMeetingActor`) verwerfen jede Zuordnung eines geschlossenen Jahrgangs, also antwortet der
     Dienst **403** (keine aktive Zuordnung), bevor R-ADM-01 greift. Beides ist gewollt und dokumentiert: Die 403 ist die
     beobachtbare Antwort für Anwender, R-ADM-01 die Absicherung im Kern für jeden anderen Weg (Demo, Betreiberwerkzeuge,
     künftige Adapter).
   - Ein Eintrag ohne `id` erhält eine Server-id. Umbenennen (gleiche `id`) ist immer erlaubt.
   - `personId` am Platz wird **nicht** gegen `state.persons` geprüft: Podiumsmitglieder stehen nicht in der
     Personentabelle der Wortmeldungen (Befund). 047 löst den Platz aus Rollenzuordnung und Platz auf.
   - ETag jeder Antwort ist die neue `Meeting.version`. `If-Match` ist laut Vertrag optional; wird es gesendet, prüft der
     Kern es (412). Pflicht wird es mit dem Vertragszyklus 0.5 (Folgeliste; die Operationen sind vorab erklärt und dürfen
     nach Regel 1 nicht verengt werden).
   - Jede Operation ist über `Idempotency-Key` wiederholbar (R-IDEM-01); `operationPermission` und `legacyEventType`
     erhalten die neuen Einträge.
   - `HvApi` erhält die Methoden mit `meetingId` als erstem Parameter (Gemeinsame Entscheidung 5 in 040a):
     `replaceMeetingAgendaItems(meetingId, items, opts)`, `replaceMeetingUnits(meetingId, items, opts)`,
     `listMeetingStageSeats(meetingId)`, `replaceMeetingStageSeats(meetingId, items, opts)`, gleichnamig mit den
     Vertragsoperationen. Sie wirken auf jeden Jahrgang, nicht nur auf den Alias: Der Kern führt den Schreibvorgang über
     eine auf `meetingId` eingegrenzte Instanz auf demselben Store aus, weil `append` sonst Ereignisse eines anderen
     Jahrgangs abweist (`api.ts:601-609`). Die Instanz wird je `meetingId` einmal erzeugt und zwischengespeichert (jede
     meldet sich mit `store.subscribe` an, `api.ts:314`); 040b baut diesen Zwischenspeicher, 040c und 040d nutzen ihn. Der Demo-Adapter ist der Kern selbst (`apps/web/src/api/index.ts` bleibt
     unverändert, wenn die Verdrahtung keine neue Methode braucht); `apps/web/src/api/http.ts` setzt sie über den Vertrag
     um (ADR 0002).
   - **Live-Puffer** (`apps/web/src/api/liveStore.ts`): `listMeetingStageSeats` kommt in `READ_TOPICS` (Thema `meeting`)
     und in `WATERMARKS.version`; die drei Schreibmethoden kommen in `WRITE_METHODS`. Sonst bricht die Typprüfung, und
     `liveStore.test.ts` (p) prüft die Vollständigkeit.
   - **Zeichenketten:** `title`, `name`, `shortName`, `label`, `personId`, `deviceId` und jede `id` müssen wohlgeformtes
     UTF-16 sein (kein einzelnes Surrogat), sonst 422. So bleibt jede Zeichenkette, die später in den Schnappschuss des
     Freeze eingeht (040d), im Geltungsbereich von RFC 8785.
3. **Bühnenplatz an der Frage.**
   - `Classification.seatId` (optional, Vertragszeile von 040b). Muss ein Platz des Jahrgangs sein, sonst 422. Werden
     `seatId` und `stageAssignment` beide gesendet, müssen sie gleich sein, sonst 422.
   - `stageAssignment` allein bleibt wie heute (Enum, ohne Listenprüfung), damit bestehende Clients und Logs gültig
     bleiben, bis 0.5 das Feld streicht.
   - Nutzlast `QuestionClassified`: `seatId`, wenn gesendet; `stageAssignment`, wenn gesendet.
   - Projektion: `Question.seatId` = Nutzlast-`seatId`, sonst Nutzlast-`stageAssignment`. `Question.stageAssignment` =
     Nutzlast-`stageAssignment`, sonst `seatId`, wenn es einer der vier Enum-Werte ist, sonst fehlt es. So hält jede Antwort
     die `if`/`then`-Bedingung des Vertrags. Eine neue Klassifizierung ohne Platz löscht beide (wie heute
     `stageAssignment`, `state.ts:345`).
4. **Zähler** (`refreshCounts`, ein Durchlauf):
   - `byUnit`: für **jeden** Fachbereich des Jahrgangs ein Schlüssel (auch 0) mit der Zahl offener Fragen mit dieser
     `unitId`. „Offen“ wie `counts.open` (`state.ts:71`).
   - `bySeat`: für **jeden** Platz ein Schlüssel (auch 0) mit der Zahl der Fragen auf der Bühne (`isOnStage`) mit diesem
     `seatId`.
   - Eine Frage, deren `unitId` oder `seatId` in keiner Liste steht (Altbestand mit abgeleitetem `seatId` ohne Platz),
     zählt in keinem Schlüssel. Die Summe kann deshalb kleiner als `open` bzw. `staged` sein; der Vertrag sagt das.
   - Die Zähler sind Aggregate je Fachbereich und Platz, keine Kennzahl je Person (6.6, V15).
5. **Seed.**
   - Neuer Fachbereich `{ id: 'unit-ar', name: 'Büro des Aufsichtsratsvorsitzenden', shortName: 'AR-Büro' }` (E46).
     Kein Thema des Korpus nutzt ihn; die Verteilung der Fragen bleibt gleich.
   - Vier Standardplätze im `MeetingCreated`: `id` = die vier Werte von `STAGE_ASSIGNMENTS`, Beschriftung
     „Aufsichtsratsvorsitz“, „Vorstandsvorsitz“, „Finanzvorstand“, „Vorstandsmitglied“, `position` 1–4, ohne `personId` und
     `deviceId` (synthetisch, keine Personen). Die Beschriftungen sind Stammdaten-Inhalt in der Inhaltssprache `de`, keine
     Oberflächentexte.
6. **Rechte.** `admin.units.manage` und `admin.seats.manage` kommen in `PERMISSIONS` und ausdrücklich in die Liste von
   admin (040a). Sonst erhält sie niemand.
7. **Personenbezug.** `StageSeat.personId` ist ein Schlüssel der Personentabelle (ADR 0009); `deviceId` ist eine
   technische Kennung des Podiumsgeräts. Beide lesen nur Halter von `admin.seats.manage` in `listMeetingStageSeats`.
   Im `EventRead` entfernt `maskEvent` jedes `personId` rekursiv (`MASKED_KEYS`, `stream.ts:169`); `deviceId` sehen nur
   Halter von `event.read` (admin). DSFA: neue Zeile „Bühnenplatzliste“.

## Vertragsschritt (Architekt, erster Commit; additiv, 043a Regel 1)

Version: die nächste freie Patch-Stufe beim Baustart (heute 0.3.13; nach 043a 0.4.1). Alles additiv; kein Pflichtfeld in
einem bestehenden Anfrageschema. Die Versionszeilen in `apps/api/src/__tests__/contract.test.ts`,
`takt-019-contract.test.ts`, `takt-016-contract.test.ts` (Muster der Minor-Stufe) und, falls 043a gemergt ist,
`contract-043a.test.ts` folgen im selben Commit.

- **Anfragezeile** `Classification.seatId` (`type: string, maxLength: 128`), Beschreibung wie Ziel 3. Die Beschreibung von
  `Classification.stageAssignment` („arrives with 0.4.0 (slice 043, ahead of 040)“) wird berichtigt. Ohne Go auf
  043a-Frage 5 entfällt diese Zeile (Tabelle in 040a).
- **`Event.type`**: `AgendaItemsReplaced`, `UnitsReplaced`, `StageSeatsReplaced` (additive Enum-Werte). Nutzlastschemas
  `AgendaItemsReplacedPayload`, `UnitsReplacedPayload`, `StageSeatsReplacedPayload`, gebunden in `Event` und `EventRead`
  (`allOf` mit `if`/`then`, `required: [subjectId]`). In `EventRead` gilt für `payload.stageSeats.items.personId`:
  `false`. Die Beschreibung von `Event` nennt das optionale `stageSeats` an `MeetingCreated`.
- **`MeetingCreated` in `EventRead` binden (Datenschutz).** `MeetingCreated` trägt ab 040b optional `stageSeats` in
  derselben Form (Seed; ab 040c das Klonen). `EventRead.payload` lässt sonst alles zu. Der Vertragsschritt bindet deshalb
  in `EventRead` für `type: MeetingCreated` ein Nutzlastschema mit `stageSeats.items.properties.personId: false`, wie bei
  `StageSeatsReplaced`. So steht die Maskierungsregel für Plätze an einer Stelle, für beide Ereignistypen. (040c klont
  Plätze ohne `personId`; die Bindung schützt auch dann, wenn sich das ändert.)
- **Beschreibungen:**
  - `listMeetingStageSeats` und `StageSeat`: `personId`/`deviceId` nur für Halter von `admin.seats.manage`.
  - Die drei `replace…`-Operationen: 422-Fälle, R-ADM-01, R-ADM-02; R-ADM-03 bleibt „ab 040d“. Die 409 mit R-ADM-01
    sieht nur ein Akteur, der den geschlossenen Jahrgang noch erreicht (Demo); mit Sitzung antwortet der Dienst 403
    (keine aktive Zuordnung). 403 ist an allen drei Operationen schon dokumentiert; die Beschreibung sagt das.
  - `Meeting.counts.byUnit`/`bySeat`: jeder Fachbereich bzw. Platz als Schlüssel, Summe kann kleiner sein.
  - `Problem.ruleId`: R-ADM-01 und R-ADM-02 mit Inhalt; „R-ADM-01..09 und R-MTG-08/09 (slice 040)“.
- **Allowlist:** die vier Einträge entfernen (`replaceMeetingAgendaItems`, `replaceMeetingUnits`,
  `listMeetingStageSeats`, `replaceMeetingStageSeats`). `createMeeting` und `freezeMeetingConfig` bleiben.
- **CHANGELOG** `## [<Version>]` mit `### Added` (Anfragezeile, Ereignistypen, Nutzlasten) und `### Changed`
  (Beschreibungen, Allowlist); **Typen** mit `pnpm contract:types`.
- **Antworten:** Liegt 043a schon vor (0.4.0), dokumentieren die vier Operationen die Antworten so, wie sie der
  Vertragstest „every status the generic layer can produce is documented“ dann verlangt (500 `InternalError`).

## Nicht-Ziele

- Keine Oberfläche (041). Keine Anzeige von Platzbeschriftungen in der Historie (`eventSummary.ts` erhält nur leere Fälle
  für die drei neuen Typen).
- Kein `podiumVisibility`, kein Filter der Bühne nach Platz, keine Auflösung des Geräts (047, 056, 058).
- Kein Jahrgang anlegen oder klonen, keine Nummernkreise (040c). Kein Freeze, kein Override, kein Start (040d); R-ADM-03
  prüft erst 040d.
- Keine Änderung an `assignRole`, `revokeRole` oder der Personentabelle.
- Kein `IfMatchRequired` an den vier vorab erklärten Operationen (Regel 1; Folgeliste für 0.5).
- Keine Streichung von `StageAssignment` oder `stageAssignment` (0.5).

## Files allowed

Vertrag (Architekt, erster Commit):

- `packages/contract/openapi.yaml`
- `packages/contract/CHANGELOG.md`
- `packages/contract/package.json` (nur das Versionsfeld)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/allowlist.json` (nur die vier genannten Einträge entfernen)

Kern:

- `packages/domain/src/types.ts`
- `packages/domain/src/events.ts`
- `packages/domain/src/envelope.ts` (nur die Liste der Ereignistypen)
- `packages/domain/src/state.ts`
- `packages/domain/src/api.ts`
- `packages/domain/src/permissions.ts` (nur die zwei Rechte in der Liste der Administration)
- `packages/domain/src/rules.ts` (nur R-ADM-01, R-ADM-02; die Beschreibung von R-ADM-01 nennt die 403 über HTTP)
- `packages/domain/src/stream.ts` (nur Themen und Subjekte je Ereignistyp)
- `packages/domain/src/seed.ts` (nur AR-Büro und Standardplätze)
- `packages/domain/src/index.ts` (nur Exporte)
- `packages/domain/src/masterData.ts` (neu, optional: Prüfungen der Listen)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `packages/domain/src/__tests__/master-data040b.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur neuer Abschnitt „Role × Administration“)
- `packages/domain/src/__tests__/seed.test.ts` (nur Erwartungen an Fachbereiche und Plätze)
- `packages/domain/src/__tests__/stream035.test.ts` (nur die Liste aller Ereignistypen und die Erwartungen an Themen je Ereignistyp)
- `docs/legal-trace.md` (nur regeneriert)

Dienst:

- `apps/api/src/app.ts` (nur die vier Routen)
- `apps/api/src/__tests__/master-data040b.test.ts` (neu)
- `apps/api/src/__tests__/contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-016-contract.test.ts` (nur die Versionszeile, falls die Minor-Stufe wechselt)
- `apps/api/src/__tests__/contract-043a.test.ts` (nur die Versionszeile und die Eigenschaftsliste der Klassifizierung, falls 043a gemergt ist)

Web (nur was die Schnittstelle des Kerns und die erschöpfenden Zuordnungen erzwingen):

- `apps/web/src/api/http.ts` (nur die neuen Methoden)
- `apps/web/src/api/http.test.ts` (nur Tests der neuen Methoden)
- `apps/web/src/api/liveStore.ts` (nur Einträge in den Lesethemen, den Schreibmethoden und dem Versionszähler)
- `apps/web/src/api/index.ts` (nur falls die Verdrahtung der neuen Methoden es verlangt)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur zwei Aktions- und drei Ereignisschlüssel)
- `apps/web/src/i18n/labels.ts` (nur Einträge in den Zuordnungen der Aktionen und Ereignisse)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)
- `apps/web/src/features/history/eventSummary.ts` (nur drei leere Fälle)

Dokumente:

- `docs/glossar.md` (nur Code-Spalte der Zeile „Bühnenplatz“)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur neue Zeile „Bühnenplatzliste“ in der Verarbeitungstabelle)
- `docs/folgeliste.md`
- `docs/slices/040b-stammdaten-buehnenplaetze.md`

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/domain/src/transitions.ts`, `packages/domain/src/store.ts`, `apps/api/src/persistence/**`,
`apps/api/migrations/**`, `apps/web/src/features/**` außer `eventSummary.ts`, `apps/web/src/components/**`,
`apps/web/src/app/**`, `docs/adr/**`, `docs/entscheidungsregister.md`, `docs/produktplan-beta.md`, die Allowlist-Einträge
`createMeeting` und `freezeMeetingConfig`. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. 040a ist gemergt; `ROLE_PERMISSIONS.admin` ist eine Liste. Sonst anhalten.
2. Vertragsstand und Allowlist: Welche Version, wie viele Einträge? Ist 043a gemergt, gelten dessen Tests (etwa Test 10
   „`Classification` = `{track, agendaItemId, stageAssignment}`“ in `contract-043a.test.ts`); diese Zeile wird mit
   `seatId` erweitert und im Bericht genannt. Ist 043a-Frage 5 nicht freigegeben: Weg „ohne Go“ aus 040a.
3. Löscht eine neue Klassifizierung ohne `stageAssignment` heute das alte (`state.ts:344-345`)? Das Verhalten gilt dann
   für beide Felder.
4. Gibt es Tests mit festen Hashes oder Zählungen des Seeds (Ereignisanzahl, Kettenhash, Fachbereichszahl), die das neue
   `MeetingCreated` ändert? Liste in den Bericht; liegt eine davon außerhalb von „Files allowed“: anhalten und melden.
5. Hält der Validator für `PUT` mit Array-Rumpf `maxItems` (200/200/50) ein? Beleg durch einen Test.
6. Zeilenangaben weichen ab: melden.

## Tests zuerst (rot, dann grün)

Kern (`master-data040b.test.ts`, Demo-Identität bzw. Rollenzuordnungen wie in `person-roles026.test.ts`):

1. **TOPs:** neue Liste → `AgendaItemsReplaced` mit ganzer Liste, Server-ids, `Meeting.version` +1; ein geöffneter TOP mit
   gleicher `id` behält `openedAt`. 422 bei doppelter `id` und doppelter `number`.
2. **R-ADM-02 TOPs:** Entfernen eines TOP mit Frage → 409 R-ADM-02, kein Ereignis; Entfernen eines geöffneten TOP ohne
   Frage → 409 R-ADM-02.
3. **Fachbereiche:** Ersetzen gelingt; Entfernen eines Fachbereichs mit zugewiesener Frage → 409 R-ADM-02; mit aktiver
   Rollenzuordnung (`unitId`) → 409 R-ADM-02; nach `revokeRole` gelingt es.
4. **Plätze:** Ersetzen gelingt; 422 bei doppelter `id`, `position`, `deviceId` und bei `personId: 'a@b'`; Entfernen eines
   Platzes, den eine Frage trägt (auch abgeleitet aus `stageAssignment`) → 409 R-ADM-02.
5. **Lesen der Plätze:** Als admin mit `personId` und `deviceId`; als `coordination`, `podium` und `observer` ohne beide
   Felder, sonst gleich.
6. **Klassifizierung:** `seatId` eines eigenen Platzes → `Question.seatId` gesetzt, `stageAssignment` fehlt; `seatId: 'ceo'`
   → beide `'ceo'`; `seatId` und `stageAssignment` verschieden → 422; unbekannter Platz → 422; nur `stageAssignment` →
   `seatId` abgeleitet. Jede Antwort ist gültig gegen das Vertragsschema `Question` (Ajv, `if`/`then`).
   Klassifizierung in einem Jahrgang, der nicht der Alias ist, prüft gegen dessen Plätze.
7. **Zähler:** Auf dem Seed hat `byUnit` genau die neun Fachbereiche als Schlüssel (AR-Büro mit 0) und `bySeat` genau die
   vier Plätze; die Werte stimmen mit einer unabhängigen Zählung im Test überein. Nach `assignQuestion` bzw.
   `stageQuestion` ändern sich die Werte um 1.
8. **R-ADM-01 (Kern):** Auf einem Jahrgang mit `MeetingClosed` (synthetisches Ereignis wie in `meeting025.test.ts`)
   antworten alle drei `replace…` für die Demo-Identität mit 409 R-ADM-01, ohne Ereignis.
9. **Rechte:** `replaceMeetingUnits` und `replaceMeetingStageSeats` als `moderation`, `coordination`, `expert`, `approver`, `podium`,
   `observer` → 403 R-PERM-01; `replaceMeetingAgendaItems` als jede Rolle ohne `agenda.manage` → 403 R-PERM-01; als admin 200.
10. **Seed:** `unit-ar` und die vier Standardplätze sind da; jede klassifizierte Frage mit `stageAssignment` hat dasselbe
    `seatId`.
11. **Wiederholung:** Derselbe `Idempotency-Key` nach einer späteren zweiten Änderung liefert das Ergebnis der ersten
    (R-IDEM-01), je Operation einmal.
12. **Anderer Jahrgang:** `replaceMeetingUnits` auf einem Jahrgang in `preparation`, während ein anderer läuft (Alias),
    schreibt das Ereignis mit dessen `meetingId` und ändert den Alias nicht. Nach drei Schreibvorgängen auf denselben
    Jahrgang ist genau eine zusätzliche Anmeldung am Store entstanden (Zwischenspeicher, kein Leck).
13. **Surrogate:** `label: '\uD800'` (einzelnes Surrogat) in `replaceMeetingStageSeats` → 422, kein Ereignis; ebenso
    `name` bei Fachbereichen und `title` bei TOPs.
14. **Strom und Maskierung:** `StageSeatsReplaced` erscheint in `listEvents` (admin) ohne `personId` in
    `payload.stageSeats`; ein Leser ohne `event.read` erhält nur ein `change` mit Thema `meeting`.

Dienst (`apps/api/src/__tests__/master-data040b.test.ts`, über `req()`):

15. `PUT /v1/meetings/{id}/agenda-items`, `…/units`, `…/stage-seats` und `GET …/stage-seats`: 200, `ETag` = neue
    Version, Antwort gültig gegen den Vertrag; 412 bei veraltetem `If-Match`; 422 bei `maxItems + 1`; 403 als `observer`
    mit `ruleId`; 404 für einen unbekannten Jahrgang. **Geschlossener Jahrgang mit Sitzung:** Ein Subject mit
    Verwaltungsrolle in einem Jahrgang, der danach `MeetingClosed` erhält, schreibt `PUT …/units` → 403 (keine aktive
    Zuordnung), kein Ereignis; mit dem Demo-Kopf im Demo-Betrieb → 409 R-ADM-01.
16. Vertrag: `Classification` hat genau `{track, agendaItemId, stageAssignment, seatId}`; `Event.type` enthält die drei
    Typen; `EventRead` mit `payload.stageSeats[0].personId` ist ungültig, sowohl für `type: StageSeatsReplaced` als auch
    für `type: MeetingCreated` (Negativprobe mit Ajv); ohne `personId` ist beides gültig; die Allowlist enthält die vier Einträge nicht
    mehr; das Abdeckungstor meldet sie als ausgeübt.

`transitions.test.ts`: neuer erzeugter Abschnitt **„Role × Administration“**:

| Role | admin.units.manage | admin.seats.manage |
|---|---|---|
| moderation | · | · |
| capture | · | · |
| coordination | · | · |
| expert | · | · |
| legal | · | · |
| approver | · | · |
| podium | · | · |
| admin | ✓ | ✓ |
| observer | · | · |

Sonst ändert sich die Wahrheitstabelle nicht (Diff im Bericht).

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):
- Maskierung von `personId`/`deviceId` in `listMeetingStageSeats` entfernt → Test 5 rot.
- Prüfung der aktiven Rollenzuordnung in R-ADM-02 entfernt → Test 3 rot.
- `bySeat` zählt alle Fragen statt `isOnStage` → Test 7 rot.
- Gleichheitsprüfung `seatId`/`stageAssignment` entfernt → Test 6 rot.
- Eingegrenzte Instanz je Aufruf neu erzeugt → Test 12 rot.

## Akzeptanzkriterium

1. `pnpm contract:lint` grün ohne neue Meldung; `pnpm contract:types` erzeugt den eingecheckten Stand; `check.mjs` meldet
   (a)–(d) `ok` mit der neuen Version und der um vier kleineren Zahl vorab erklärter Operationen.
2. Tests 1–16 grün, die fünf Mutationsproben rot belegt; Wahrheitstabellen-Diff genau wie oben.
3. `pnpm gates` (mit Postgres-Variablen wie in CI) grün, einschließlich `slice-scope` auf `claude/slice-040b-…`; der
   Schluss der Ausgabe steht einmal im Bericht.
4. Kein Screenshot: Keine Ansicht ändert sich; die neuen i18n-Schlüssel erscheinen erst mit 041 bzw. in der Historie nur
   als Ereignisbezeichnung.

## Nachweise

- Auszug `check.mjs` und Typen-Diff (`Classification`, `Event`, `Meeting.counts`).
- Wahrheitstabellen-Diff, Ergebnis der Mutationsproben, Liste der Seed-abhängigen Tests (Vor-dem-Bau-Punkt 4).
- Schluss von `pnpm gates` mit Commit-Hash.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Vertrag, Ereignis, Konfiguration
- [x] Rolle, Recht, Identität, Schutzklasse
- [x] Administration
- [x] personenbezogene oder vertrauliche Daten (`personId`, `deviceId` am Platz)
- [ ] Persistenz, Migration (neue Ereignistypen ohne Migration; `events.envelope` ist `jsonb` ohne Typprüfung)
- [ ] Oberfläche

Perspektive: Security/Admin (6.5, 6.8), Vertrag (6.4), Datenschutz (6.6) · Nachweise: Tests 1–16, Mutationsproben ·
Offene Entscheidung: E46 (auf Standard gebaut: Einheit AR-Büro), E7 (Grundlage, Schalter in 047)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Bedrohungen:**
  - **T-G1-I-01** (Lesen ohne Recht): `personId` und `deviceId` der Plätze nur für `admin.seats.manage`; im Ereignis
    `personId` maskiert.
  - **T-G1-E-05** (Kontext vom Client): Platz, Person und Gerät liegen im Dienst; kein Client nennt seinen Platz. 047
    baut darauf.
  - **T-G1-T-02** (unbekannte Felder im Log): Der Kern schreibt nur die benannten Felder jedes Eintrags ins Ereignis.
  - **T-G1-T-03** (verlorene Änderung): `If-Match` wird geprüft, wenn gesendet; ohne `If-Match` gewinnt der letzte
    Schreiber. Bekannte Grenze bis 0.5 (Folgeliste); jede Fassung bleibt als Ereignis erhalten.
  - **SG6** (Rechtezuordnung): zwei neue Rechte, nur admin, im Tabellen-Diff.
- **Missbrauchsfälle mit Erkennung:**

  | Missbrauch | Abwehr | Erkennung, Nachweis |
  |---|---|---|
  | Fachbereich entfernen, um eine Fachkraft aus ihren Fragen zu drängen | R-ADM-02 (Frage oder aktive Zuordnung) | Test 3; Ereignis `UnitsReplaced` mit Akteur |
  | Platz einer anderen Person oder einem fremden Gerät zuordnen, damit dort Fragen erscheinen | nur `admin.seats.manage`; ab 040d nach dem Freeze nur per Override mit Grund | `StageSeatsReplaced` in Historie und `listEvents`; Freeze-Hash ändert sich (040d, 041) |
  | Gerätekennungen auslesen, um ein Podiumsgerät nachzuahmen | Lesen nur mit `admin.seats.manage` | Test 5 |
  | TOP mit Fragen entfernen, um sie aus der Steuerung zu nehmen | R-ADM-02 | Test 2 |

- **Invarianten:** Jede Stammdatenänderung ist ein Ereignis mit Akteur und Zeit (6.8; einen Grund verlangt erst der
  Override in 040d, weil die Rümpfe Listen sind). Referenzierte Stammdaten bleiben. `Question.seatId` und
  `stageAssignment` widersprechen sich nie.
- **Fehlerfälle:** Ein veralteter Client, der nur `stageAssignment` kennt, arbeitet weiter. Ein Jahrgang ohne Plätze
  (Altbestand) klassifiziert mit `stageAssignment` wie bisher.
- **Betrieb:** keine Migration; neue Ereignistypen laufen durch dieselbe Kette.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. Die beiden neuen Rechte hält nur admin (Tabellen-Diff).
2. Die Rechte werden im Kern über `requirePermission`/`can()` geprüft, nie über einen Rollennamen.
3. `personId`/`deviceId` fehlen in jeder Antwort an Nicht-Halter (Test 5) und `personId` in jedem `EventRead` (Test 14).
4. Keine Anfrageerweiterung außer `Classification.seatId` (Test 16).
5. Vier Allowlist-Einträge entfernt, nicht mehr (Diff).

## Offene Eigentümerfragen

Siehe `docs/slices/040a-admin-ohne-inhaltsrechte.md`, Frage 1; 043a-Frage 5 mit beiden Wegen dort.

**Stand 03.10.2026:** auf Standard gebaut (Go des Eigentümers 03.10.2026, E57): 043a-Frage 5 freigegeben, also Weg
„mit Go“ (Anfragezeile `Classification.seatId` im Vertragsschritt, Test 6 vollständig); 040-Teilung und Budget für
040b; E46 (AR-Büro) auf Standard. 040c und 040d sind zurückgestellt.

## Hinweise an Folgescheiben

- **043a:** Kommt 040b zuerst, erweitert 043a Test 10 um `seatId` und berichtigt `Classification.stageAssignment` nicht
  noch einmal.
- **047:** `personId` am Platz ist ein pseudonymer Schlüssel ohne Prüfung gegen `state.persons`; die Auflösung
  „Gerät → Platz → Person“ und ihr Abgleich mit der Rollenzuordnung liegen bei 047.
- **053:** `counts.byUnit`/`bySeat` enthalten jeden Fachbereich und Platz als Schlüssel.
- **056:** Platzbeschriftung in der Historie (`eventSummary.ts`) und Filter der Bühne nach Platz.
- **0.5:** `If-Match` Pflicht an den vier Operationen; `StageAssignment` streichen.

## Bericht (nach Bau ausfüllen)

```
Slice: 040b-stammdaten-buehnenplaetze
Done:
Evidence:
Open:
Touched:
```

**Vor dem Bau prüfen (Ergebnisse).** Geprüft vom Architekten am 03.10.2026 auf `88fa9be` (Integrationszweig mit 043a).
1. 040a ist gemergt; `ROLE_PERMISSIONS.admin` ist eine ausdrückliche Liste (`permissions.ts:78-91`). Weiter.
2. Vertrag 0.4.0 (043a gemergt), Allowlist 9 Einträge (6 × `slice` 040, 3 × `slice` 044). 040b nimmt nach 043a Regel 1 die
   nächste freie Patch-Stufe: **0.4.1** (die Spec nennt das selbst: „nach 043a 0.4.1“). Die vier vorab erklärten
   Operationen sind unverändert vorhanden, dokumentieren 500 `InternalError` schon (043a) und verwenden weiter `IfMatch`
   (optional). Nach dem Vertragsschritt: 0.4.1, 5 Einträge. 043a-Frage 5 ist freigegeben (E57): `contract-043a.test.ts`
   Test 10 lautet jetzt `Classification` = `{agendaItemId, seatId, stageAssignment, track}`; Test 1 prüft `^0\.4\.\d+$`.
   `takt-016-contract.test.ts` prüft schon `^0\.(?:3|4)\.` und bleibt unverändert (Minor-Stufe wechselt nicht).
3. Ja: `state.ts:344-345` setzt `stageAssignment` aus der Nutzlast oder löscht es. Das Verhalten gilt für beide Felder.
4. Keine Seed-abhängigen festen Hashes oder Zählungen gefunden, die das neue `MeetingCreated` oder `unit-ar` ändern
   (gesucht: Fachbereichszahl, Ereignisanzahl, Kettenhash, `counts`-Gleichheit). Der einzige feste Hash
   (`security028.test.ts:53`) hängt an einem synthetischen Eingabeereignis, nicht am Seed. `contract.test.ts:159` prüft
   nur `units.length > 0`. Die volle Bestätigung liefert `pnpm gates` des Implementierers.
5. Ja: Der generische Validator (`apps/api/src/validate.ts`, `requestBodyValidator`) prüft auch Array-Rümpfe; Probe mit
   Ajv gegen 0.4.1: 200/200/50 Einträge gültig, 201/201/51 ungültig (`maxItems`). Der HTTP-Beleg ist Test 15.
6. Zeilen verschoben, ohne Folgen für „Files allowed“ oder Verhalten: `operationPermission`/`legacyEventType` jetzt
   `api.ts:489-497` (Spec 458-476); `store.subscribe` `api.ts:345` (314); Abweisung fremder `meetingId` `api.ts:638`
   (601-609); `subjectId`-Prüfung `api.ts:782-785` (722-723); `sessionActorFromEvents` `actor.ts:86` (104-111);
   `MASKED_KEYS` unverändert `stream.ts:169`.

**Signaturen der neuen `HvApi`-Methoden.**

**Wahrheitstabellen-Diff.**

**Mutationsproben (Ergebnis).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings

**Lesebefund der Spec (30.09.2026, zu `4fac838`):** eingearbeitet in 040b: Major 1 (`liveStore.ts`), Major 2
(`stream035.test.ts` mit Ereignistypliste), Major 3 (`contract-043a.test.ts`), Major 6 (`meetingId` an jeder Methode,
Test 12), Minor 16 (Surrogate → 422, Test 13), Nit 28 (Versionszeilen im Vertragsschritt).

**Nachprüfung (30.09.2026, zu `bccba04`):** eingearbeitet in 040b: N8 (eingegrenzte Instanz je `meetingId`
zwischengespeichert, Test 12 mit Mutationsprobe), N9 (Regel-id-Bereich R-ADM-01..09 und R-MTG-08/09 im Vertragsschritt,
Tests neu durchnummeriert 1–16, Verweise angeglichen).

**Codex-Befund zu #115 (zwei P2):** eingearbeitet: R-ADM-01 je Schicht (Kern 409, HTTP mit Sitzung 403 ohne aktive
Zuordnung; Vertragsbeschreibung, Tests 8 und 15); `MeetingCreated` in `EventRead` mit `stageSeats.items.personId: false`
gebunden, Negativprobe in Test 16. 040c braucht keine eigene Zeile: Die Bindung steht hier, und 040c klont ohne `personId`.
