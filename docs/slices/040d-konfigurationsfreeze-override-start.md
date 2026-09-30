# Scheibe 040d — Administration im Kern, Teil 4: Konfigurationsfreeze, Override, Start

**Status:** spec (30.09.2026; überarbeitet nach dem Lesebefund zu `4fac838` und der Nachprüfung zu `bccba04`; Teil 4 von 4 der geteilten Scheibe 040; Zuschnitt, gemeinsame Entscheidungen und Eigentümerfragen in `docs/slices/040a-admin-ohne-inhaltsrechte.md`)
**Risikoklasse:** hoch · 2 AStd · Plan 040: 03.11.2026 (W6) · Lanes: contract (Architekt, erster Commit); core; service; web-api (nur neue `HvApi`-Methoden in `http.ts` und die Einträge im Live-Puffer `liveStore.ts`); web-shell (nur erzwungene i18n-Schlüssel); web-history (nur `eventSummary.ts`); docs-legal (Kopfvermerk Rechtekonzept); docs-sicherheit; docs-datenschutz; docs-plan (nur Glossar)
**Rolle:** architekt (Vertragsschritt, erster Commit); implementierer-backend. Review in frischem Kontext mit Perspektive Security/Admin (Freeze, Override, Rechteerhöhung) und Legal (Nachweis „wer durfte was am HV-Tag“); Lesebefund der Spec vor dem Bau; nie gebündelt (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** neu R-ADM-03 (nach dem Freeze nur Override), R-ADM-04 (Freeze einmal; Override nur eingefroren und mit Grund), R-ADM-06 (Vertretung), R-MTG-08 (Start nur eingefroren), R-MTG-09 (kein Start, solange ein anderer Jahrgang läuft). Angewandt: R-ADM-01, R-ADM-02, R-ADM-05, R-ADM-07 und R-ADM-08 (aus 040a), R-MTG-02, R-PERM-01, R-IDEM-01, R-GUARD-06. Dazu AGENTS.md R2, R4, R5, R6, R7, R8, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` §5/040 („Konfigurationsfreeze (Ereignis ConfigFrozen mit Hash über Rechtetabelle, Übergangstabelle, Stammdaten; Änderung danach nur mit admin.override und Grund)“, „Rollenzuordnung mit Ablauf und zwei Vertretungen“, „Meeting-Lebenszyklus-Aktionen“; Nachweise „Stammdatenänderung nach Freeze → 409 R-ADM-03“, „override erzeugt Ereignis mit Grund“), §10 E8, E25, Risiko-Tabelle Zeile 1232 (zwei Vertretungen)
- `docs/rollen-und-rechtekonzept.md` §3 Punkt 3 („Eingefrorener Snapshot je HV-Jahrgang … gehasht … wer am HV-Tag was durfte“), §4, §5 („mindestens zwei benannte Vertreter“)
- `docs/qualitaetsleitplanken-produktreife.md` 6.8 („Jede Änderung ist ein Ereignis mit Autor, Grund und Zeit; Freeze wird erzwungen; Rückkehr zum Vorzustand ohne Auditverlust“)
- takt-019 (Start-Aktion in 040; Schlussaktion eigene Spec), Spec 023 (`freezeMeetingConfig` vorab erklärt, `Meeting.configHash`), Spec 043a (Hashdefinition nach RFC 8785 für `RefusalGround.hash`; Lücken „Start-Aktion“, „Grund für admin.override“)
- Bedrohungsmodell SG4, SG6, SG9, MF-01, MF-07, T-G1-E-04, T-G1-R-01, T-G2-R-01, T-G3-E-03, T-G1-T-02

**Depends on:** 040c (gemergt, bevor dieser Bau beginnt); 025, 026, 028 (gemergt)
**Perspektive:** Security/Admin, Legal · **Glossar: neue Begriffe:** ja: „Konfigurationsfreeze“ (configuration freeze) und „Änderung nach Freeze“ (configuration override)

## Befund (Ist-Stand, gelesen auf `a3ba94b`, ergänzt um den erwarteten Stand nach 040a–c)

- **Vertrag:** `freezeMeetingConfig` (`POST /meetings/{meetingId}/config-freeze`, `admin.config.freeze`, `IfMatch`
  optional, 200 `ConfigFreeze`) ist vorab erklärt (Allowlist `slice` 040). `Meeting.configFrozenAt` und
  `Meeting.configHash` stehen mit `dependentRequired` als Paar. `Event.type` enthält `ConfigFrozen`, die Nutzlast ist offen
  (Spec 023: „`Meeting.configHash` hat erst mit der Nutzlast von `ConfigFrozen` (040) eine gebundene Quelle“). `Action`
  enthält `admin.config.freeze` und `admin.override`. Es gibt keine Override- und keine Start-Operation.
- **Kern:** `ConfigFrozen` ist kein Domänen-Ereignistyp. `MEETING_TRANSITIONS` (`transitions.ts:795-798`) hat die Zeile
  R-MTG-02 `preparation → running`; `resolveMeetingLifecycle` wird im Kern nur von `reduce` benutzt
  (`state.ts:142-148`). Der Seed schreibt `MeetingStarted` ohne Freeze.
- **Rollenzuordnung (026):** `assignRole` prüft Subject, Rolle, Einheit, Person, Ablauf und Doppelung
  (`api.ts:718-747`). `deputyForSubjectId` wird nur auf Form geprüft: keine Prüfung des Ziels, keine Selbstvertretung.
  Der Vertrag beschreibt das Feld als „one of the two deputies“ (`openapi.yaml:2391`), das Rechtekonzept §5 (Zeile 205)
  als „mindestens zwei“; das widerspricht sich (Eigentümerfrage 5 in 040a). Nach 040a sind Selbstzuordnung (R-ADM-07)
  und Entzug der letzten Verwaltungsrolle (R-ADM-08) gesperrt.
- **Alias:** Der Alias ist der laufende Jahrgang mit dem jüngsten Datum (`api.ts:295-304`). Ein zweiter gestarteter
  Jahrgang mit späterem Datum übernimmt den Alias für alle Clients, die noch die Aliaspfade nutzen.
- **Kanonische Form:** `canonicalJson` (`packages/domain/src/envelope.ts:72-89`) sortiert Schlüssel nach UTF-16-Codeeinheiten,
  lässt `undefined` weg, serialisiert Zeichenketten und endliche Zahlen mit `JSON.stringify`. Für den Wertebereich
  „Objekte, Arrays, Zeichenketten, ganze Zahlen, Wahrheitswerte“ ist das die Ausgabe nach RFC 8785 (JCS). SHA-256 über
  `@noble/hashes` ist im Kern vorhanden.
- **Nach 040a–c:** admin hält eine ausdrückliche Liste; die Stammdaten TOPs, Fachbereiche, Plätze und Nummernkreise
  ändern sich nur über `replace…`-Operationen mit je einem Ereignis.

## Ziel und Entscheidungen vor Bau

Vor der HV friert die Administration die Konfiguration eines Jahrgangs ein. Das Ereignis enthält die wirksame
Rechtetabelle, die Übergangstabellen, die Stammdaten und die aktiven Rollenzuordnungen als Schnappschuss mit Hash. Danach
ändert nur noch der Override die Konfiguration, mit Pflichtgrund, als Ereignis und mit neuem Hash. Der Jahrgang startet
erst mit eingefrorener Konfiguration.

### 1. Schnappschuss und Hash (Definition)

**`configHash`** = SHA-256, hexadezimal in Kleinbuchstaben, über die UTF-8-Bytes der kanonischen Form nach **RFC 8785
(JSON Canonicalization Scheme)** des Schnappschusses. Der Kern bildet die kanonische Form mit `canonicalJson`
(`envelope.ts`); Test 2 belegt die Gleichheit mit RFC 8785 für den Wertebereich des Schnappschusses. Der Schnappschuss
enthält **kein** `null`, keine Gleitkommazahl und kein `undefined`; ein optionales Feld fehlt, statt `null` zu sein.

Schnappschuss, `hashVersion` 1:

```
{
  "hashVersion": 1,
  "meetingId": "<Meeting.id>",
  "rights": {
    "rolePermissions":   { "<Role>": ["<Permission>", …], … },        // jede Rolle aus ROLE_PERMISSIONS
    "unitBoundReadRoles": ["<Role>", …],                              // Bündel mit unitBoundRead
    "readScopes":        { "<Permission>": { "statuses": ["<QuestionStatus>", …], "extends": "<Permission>" } },
    "readPermissions":   { "<ReadMethod>": ["<Permission>", …] },      // READ_PERMISSIONS
    "overrideScopePermission": { "<Scope>": "<Permission>" }            // OVERRIDE_SCOPE_PERMISSION
  },
  "transitions": {
    "question": [ { "ruleId", "action", "from": [..], "to": "<Status>" | "<computed>", "guards": ["<ruleId>", …] } ],
    "speaker":  [ { "ruleId", "from", "to", "guards": [..] } ],
    "meeting":  [ { "ruleId", "event", "from", "to", "guards": [..] } ],
    "agenda":   [ { "ruleId", "event" } ],
    "legalGateByTrack": { "<Track>": true | false },
    "terminalStatuses": ["<QuestionStatus>", …]
  },
  "masterData": {
    "meeting":       { "title", "date", "format", "legalEntity"?, "pseudonymiseForUnits" },
    "agendaItems":   [ { "id", "number", "title" } ],
    "units":         [ { "id", "name", "shortName"? } ],
    "stageSeats":    [ { "id", "label", "position"?, "personId"?, "deviceId"? } ],
    "captureRanges": [ { "id", "label", "from", "to" } ]
  },
  "roleGrants": [ { "assignmentId", "subjectId", "role", "unitId"?, "expiresAt"?, "deputyForSubjectId"? } ]
}
```

Ordnung (JCS sortiert nur Objektschlüssel, Arrays sind hier festgelegt):
- **Arrays von Zeichenketten:** aufsteigend nach UTF-16-Codeeinheiten (JavaScript-Standard-`sort()`), auch `from`,
  `guards` und `statuses`.
- **Arrays von Objekten:** `question` nach `ruleId`, dann `action`; `speaker` nach `ruleId`, `from`, `to`; `meeting`
  nach `ruleId`, dann `event`; `agenda` nach `ruleId`; `agendaItems` nach `number`, dann `id`; `units`, `stageSeats`
  nach `id`; `captureRanges` nach `from`, dann `id`; `roleGrants` nach `assignmentId`.

Was abgedeckt ist und was nicht:
- **Rechte:** das ganze `ROLE_PERMISSIONS` einschließlich `unitBoundRead`, `READ_SCOPES`, `READ_PERMISSIONS` und die
  Datentabelle der Override-Bereiche `OVERRIDE_SCOPE_PERMISSION`.
- **Übergänge:** jede Zeile aus `TRANSITIONS`, `SPEAKER_TRANSITIONS`, `MEETING_TRANSITIONS`, `AGENDA_TRANSITIONS` mit
  den Regel-ids ihrer Guards; `LEGAL_GATE_BY_TRACK`; `TERMINAL_STATUSES`.
- **Nicht abgedeckt:** der Rumpf einer Guard-Funktion, die Bedingung `allowed` einer Tagesordnungszeile und ein
  berechnetes Ziel. Ein berechnetes Ziel steht als wörtliches `"<computed>"` (heute R-TRANS-06). Beschreibungen und
  `legalRef` sind Dokumentation und nicht abgedeckt. Ebenfalls nicht abgedeckt: die Zuordnung „Operation → Recht“ im
  Kern (`operationPermission` und die `requirePermission`-Aufrufe in `api.ts`) und der Sonderfall von R-PERM-03 in
  `hasPermission` (Fachkraft mit Zuordnung ohne Einheit liest keine Fragen, `permissions.ts`). Das Verhalten der
  Funktionen belegen Tests und die Git-Historie; die Grenze steht im Vertrag und im Bericht.
- **Stammdaten:** Titel, Datum, Format, Rechtsträger, `pseudonymiseForUnits` (Meeting-Konfiguration aus 026); TOPs **ohne** Fortschrittszeiten (Fortschritt ist Ablauf, keine
  Konfiguration); Fachbereiche; Plätze mit Person und Gerät; Nummernkreise.
- **Rollenzuordnungen:** die im Augenblick des Freeze aktiven (nicht entzogen; ohne Ablauf oder mit Ablauf nach
  `recordedAt` des Freeze). `personId` der Zuordnung ist nicht enthalten (das Subject genügt, Datensparsamkeit).
- **Nicht enthalten:** Wortmeldungen, Redebeiträge, Fragen, Zähler, Versionen, Übernahmen.

**Wohlgeformte Zeichenketten.** RFC 8785 und `JSON.stringify` stimmen nur für wohlgeformtes UTF-16 überein. Jede
Zeichenkette im Schnappschuss stammt aus einer Eingabe, die ein einzelnes Surrogat mit 422 abweist (040b, 040c und der
Override hier), oder aus Code-Daten. Der Anspruch „gleich RFC 8785“ gilt deshalb für wohlgeformte Zeichenketten, und
nur solche erreichen den Schnappschuss.

Gespeichert wird der **ganze Schnappschuss im Ereignis**, nicht nur der Hash. So bleibt „wer durfte was am HV-Tag“
Monate später lesbar, und der Vergleich zum Vorjahr ist ein Diff zweier Schnappschüsse (Rechtekonzept §3 Punkt 3). Die
Größe liegt bei wenigen Kilobyte.

**Nachrechnen nur am Original.** `EventRead` entfernt jedes `personId` rekursiv, auch in
`snapshot.masterData.stageSeats`. Aus `listEvents`, dem Strom oder einem Export der Leseprojektion lässt sich
`configHash` deshalb nicht nachrechnen, sobald ein Platz eine Person trägt; das gelingt nur am gespeicherten Original
(wie `sourceHash`, Spec 026). Vertrag (`ConfigSnapshot`, `freezeMeetingConfig`) und Bericht sagen das ausdrücklich. Ein
personenfreier Hash wäre die Alternative; verworfen, weil „wer saß auf welchem Platz“ zur eingefrorenen Konfiguration
gehört (047 filtert die Bühne danach).

**Prüfung:** `verifyConfigEvent(e)` rechnet den Hash des gespeicherten Schnappschusses nach und vergleicht mit
`configHash`; die Hash-Kette des Logs (024) schützt das Ereignis selbst. `configDrift(state)` vergleicht den Schnappschuss,
den der Kern jetzt bilden würde, mit dem zuletzt gespeicherten und meldet je Abschnitt eine Abweichung: `rights`,
`transitions`, `masterData`, dazu die Zuordnungen, die im gespeicherten Schnappschuss fehlen (entzogene oder abgelaufene
Zuordnungen sind erwartet und keine Abweichung). Ursache einer Abweichung in `rights` oder `transitions` ist ein Release
während des Freeze. `configDrift` ist in 040d eine Kernfunktion mit Test; Anzeige (041) und Bereitschaftsprüfung (070)
folgen dort.

**Versionen:** Ändert eine spätere Scheibe den Umfang (etwa 047 mit `podiumVisibility`), steigt `hashVersion`. Ein altes
Ereignis prüft man immer gegen seinen eigenen gespeicherten Schnappschuss.

### 2. Ereignisse und Projektion

- `ConfigFrozen` `{ hashVersion, configHash, snapshot }`, `subjectId` = `meetingId`.
- `ConfigOverridden` `{ hashVersion, scope, reason, previousConfigHash, configHash, snapshot, changeType }`,
  `subjectId` = `meetingId`. `changeType` ist der Typ des Änderungsereignisses desselben Befehls; beide tragen dieselbe
  `commandId` (028).
- Projektion: `Meeting.configFrozenAt` = `recordedAt` des `ConfigFrozen`; `Meeting.configHash` = Hash des jüngsten
  `ConfigFrozen` oder `ConfigOverridden`; neu `Meeting.configOverriddenAt` = `recordedAt` des jüngsten `ConfigOverridden`.
  Jedes der beiden Ereignisse erhöht `Meeting.version`. Stromthema `meeting`.
- Aufbewahrungsklasse `record`. Begründung (für DSFA V12, E16): Die Ereignisse belegen, wer am HV-Tag welche Rechte
  hatte (Rechtekonzept §3 Punkt 3, §6 „wer konnte am HV-Tag welche unveröffentlichte Antwort sehen?“); sie enthalten nur
  pseudonyme Subjects, Personen-ids der Plätze und Gerätekennungen, keine Klarnamen. Die Frist folgt der Klasse `record`
  aus E16. `reason` des Override ist Freitext der Administration ohne Personendaten (Vertragsbeschreibung, wie
  `RoleRevokedPayload.reason`; ein Schema kann Freitext nicht prüfen).

### 3. Operationen

| Operation | Recht | Prüfungen, in dieser Reihenfolge | Wirkung |
|---|---|---|---|
| `freezeMeetingConfig` (`POST /meetings/{id}/config-freeze`, vorab erklärt) | `admin.config.freeze` | 403; 409 R-ADM-01 (geschlossen); 409 R-ADM-04 (schon eingefroren); 412 bei veraltetem `If-Match` | `ConfigFrozen`; Antwort `ConfigFreeze` |
| `overrideMeetingConfig` (`POST /meetings/{id}/config-overrides`, neu) | `admin.override` **und** das Recht des Bereichs: `agendaItems` → `agenda.manage`, `units` → `admin.units.manage`, `stageSeats` → `admin.seats.manage`, `captureRanges` → `admin.meetings.manage`, `roleAssignment` → `admin.roles.manage` | 403; 409 R-ADM-01; 409 R-ADM-04 (nicht eingefroren, oder `reason` nach Trimmen leer); danach dieselben Prüfungen wie der normale Weg (422, R-ADM-02, R-ADM-05, R-ADM-06, R-ADM-07); 428/412 | ein Befehl: Änderungsereignis (`AgendaItemsReplaced`, `UnitsReplaced`, `StageSeatsReplaced`, `CaptureRangesReplaced` oder `RoleAssigned`) und `ConfigOverridden`; Antwort `ConfigFreeze` mit neuem Hash |
| `startMeeting` (`POST /meetings/{id}/opening`, neu) | `agenda.manage` | 403; 409 R-MTG-02 (nicht `preparation`); 409 R-MTG-08 (nicht eingefroren); 409 R-MTG-09 (irgendein anderer Jahrgang läuft); 428/412 | `MeetingStarted`; Antwort `Meeting` |

- Der Bereichsschlüssel und das zugehörige Recht stehen als Datentabelle im Kern (etwa
  `OVERRIDE_SCOPE_PERMISSION`), nicht als Verzweigung.
- Der Override umgeht keine Stimmigkeitsregel: Ein referenzierter Fachbereich bleibt auch nach dem Freeze
  (R-ADM-02). Der Override ist kein Weg, Daten zu löschen.
- „Rückkehr zum Vorzustand ohne Auditverlust“ (6.8): ein zweiter Override mit der alten Liste; beide stehen im Log.
- Alle drei sind über `Idempotency-Key` wiederholbar (R-IDEM-01). Die Wiederholung eines Override prüft **beide** Rechte
  erneut (Bereichstabelle in `authorizeReplay`); fehlt eines inzwischen, antwortet sie 403 ohne Ereignis.
- **Ein Befehl heißt ein Aufruf von `append`.** Änderungsereignis und `ConfigOverridden` werden in einem Aufruf
  geschrieben, also atomar und mit aufeinanderfolgenden `seq`; Test 6 prüft das.
- `reason` und jede Zeichenkette in `items` müssen wohlgeformtes UTF-16 sein, sonst 422.
- `HvApi`: `freezeMeetingConfig(meetingId, opts)`, `overrideMeetingConfig(meetingId, input, opts)`,
  `startMeeting(meetingId, opts)` (Gemeinsame Entscheidung 5 in 040a: jeder Jahrgang, über eine auf `meetingId`
  eingegrenzte Instanz im Kern). `apps/web/src/api/http.ts` setzt sie um; im Live-Puffer (`liveStore.ts`) kommen die drei
  in `WRITE_METHODS` (keine neue Lesemethode).

### 4. Nach dem Freeze

- **409 R-ADM-03** auf dem normalen Weg für `replaceMeetingAgendaItems`, `replaceMeetingUnits`,
  `replaceMeetingStageSeats`, `replaceMeetingCaptureRanges` und `assignRole`. Die Antwort nennt `overrideMeetingConfig`.
- **Frei bleiben:** `revokeRole` (ein Entzug wird vom Freeze nie blockiert, er verringert Rechte; nur R-ADM-08 aus 040a
  gilt weiter), Tagesordnungsfortschritt,
  der Start, der ganze Fragen-, Wortmeldungs- und Erfassungsablauf, das Anlegen anderer Jahrgänge.
- Ein Entzug nach dem Freeze ändert `configHash` nicht; `configDrift` meldet ihn nicht als Abweichung (Ziel 1).
- **Wiederherstellung (040c) in einem eingefrorenen Jahrgang.** Sie fügt eine Zuordnung hinzu, also eine
  Konfigurationsänderung. Damit die Invariante „nach dem Freeze keine Änderung ohne `ConfigOverridden`“ auch für den
  Betreiberweg gilt, liefert `recoveryEvents` in einem eingefrorenen Jahrgang **zwei** Ereignisse in einem `append`:
  `RoleAssigned` und `ConfigOverridden` mit `scope: roleAssignment`, `reason` (der Grund der Wiederherstellung),
  `previousConfigHash`, neuem `configHash`, Schnappschuss und `changeType: RoleAssigned`, beide mit Akteur `system` und
  Befehlsoperation `operatorRecovery`. Das Recht `admin.override` prüft dieser Weg nicht; er ist der auditierte
  Betreiberweg mit Datenbankzugang (040c). `packages/domain/src/bootstrap.ts` wird dafür erweitert.
- Eigentümerfrage 4 in 040a (Zuordnungen nach dem Freeze nur per Override) ist auf Standard gebaut.

### 5. Rollenzuordnung: Vertretungen

Gilt vor und nach dem Freeze, für `assignRole` und den Override-Bereich `roleAssignment`:
- **R-ADM-06:** Ist `deputyForSubjectId` gesetzt, (a) hält das Ziel im Jahrgang eine aktive Zuordnung derselben Rolle und
  (b) sind Vertretung und Ziel verschiedene Subjects. Sonst 409 R-ADM-06. **Keine Obergrenze** (Standard der
  Eigentümerfrage 5 in 040a, wie Rechtekonzept §5 „mindestens zwei“); der Vertragstext „one of the two deputies“ wird
  auf „a deputy (at least two recommended)“ berichtigt. Eine Vertretung hält die Rolle vollständig; R-GUARD-06 vergleicht
  weiter Personen, sodass keine Vertretung die Vier-Augen-Prüfung umgeht (MF-07). Der Entzug des Ziels entzieht die
  Vertretungen nicht.
- **R-ADM-07** (aus 040a) gilt auch im Override-Bereich `roleAssignment`.

### 6. Start

- `MEETING_TRANSITIONS` erhält an der Zeile R-MTG-02 `MeetingStarted` den Guard **R-MTG-08** „Konfiguration ist
  eingefroren“ (`configFrozenAt` gesetzt). Status-Logik bleibt in der Tabelle (AGENTS.md R5).
- **Nur der Befehlsweg prüft den Guard.** `reduce` prüft weiter nur `from → to`. Sonst ließe sich kein bestehendes Log
  mehr laden: Der Seed und alle Testaufbauten seit 025 schreiben `MeetingStarted` ohne Freeze. `resolveMeetingLifecycle`
  erhält dafür eine ausdrückliche Option; Test 9 belegt beide Wege.
- **R-MTG-09**, ebenfalls ein Guard der Startzeile und nur im Befehlsweg: Läuft **irgendein** anderer Jahrgang,
  antwortet der Start 409. Grund: Der Alias ist der jüngste laufende Jahrgang, gleich welcher Rechtsträger
  (`api.ts:295-304`); ein zweiter laufender Jahrgang mit späterem Datum übernähme ihn und leitete die Arbeit aller Clients
  auf Aliaspfaden um — am HV-Tag ein Ausfall durch einen einzigen Klick. ADR 0011 modelliert genau eine Gesellschaft; ein
  zweiter Rechtsträger ist B-Liste. Eine Unterscheidung nach `legalEntity` würde den Alias nicht schützen.
- **Datenquelle des Guards.** Der Start läuft in der auf `meetingId` eingegrenzten Instanz, deren Projektion nur den
  eigenen Jahrgang kennt. R-MTG-09 liest den Status der **anderen** Jahrgänge deshalb aus dem globalen Store
  (`MeetingCreated`, `MeetingStarted`, `MeetingClosed` je `meetingId`), nie aus der eingegrenzten Projektion.
- Wer startet: Halter von `agenda.manage` (heute nur admin; Eigentümerfrage 3 in 040a). Keine Schlussaktion (takt-019).

### 7. Rechte

`admin.config.freeze` und `admin.override` kommen in `PERMISSIONS` und in die Liste der Administration. Der
Abschnitt „Role × Administration“ der Wahrheitstabelle erhält zwei Spalten (✓ nur bei admin). `agenda.manage` bleibt,
wie es ist.

## Vertragsschritt (Architekt, erster Commit; additiv, 043a Regel 1)

Version: die nächste freie Patch-Stufe beim Baustart.

- **Neue Operationen**
  - `overrideMeetingConfig` mit Rumpf `ConfigOverride`: `required: [reason, scope]`, `additionalProperties: false`;
    `reason` 1–500; `scope` `enum: [agendaItems, units, stageSeats, captureRanges, roleAssignment]`; `items` (Array) für
    die vier Listenbereiche, typisiert je Bereich über `if`/`then` (`AgendaItemInput`, `UnitInput`, `StageSeatInput`,
    `CaptureRangeInput`, gleiche Obergrenzen wie die `replace…`-Operationen); `assignment` (`RoleAssignmentCreate`) nur
    für `roleAssignment`; das jeweils andere Feld ist verboten. Parameter `IdempotencyKey`, `CsrfToken`,
    `IfMatchRequired`. Antwort 200 `ConfigFreeze` mit `ETag`. 409 nennt R-ADM-01/02/04/05/06/07.
  - `startMeeting` ohne Rumpf, Parameter wie oben, Antwort 200 `Meeting` mit `ETag`; 409 nennt R-MTG-02, R-MTG-08 und
    R-MTG-09.
  - Antwortlisten wie `replaceMeetingStageSeats` beim Baustart plus 428.
  - Ohne Go auf 043a-Frage 5: beide vorab erklärt mit Allowlist-Eintrag `slice` 040d, Ablauf 2026-11-25 (040a).
- **Antwortseite (additiv):**
  - `Event.type` + `ConfigOverridden`. Nutzlastschemas `ConfigSnapshot`, `ConfigFrozenPayload` und
    `ConfigOverriddenPayload`, gebunden in `Event` und `EventRead` (`required: [subjectId]`). In `EventRead` gilt
    `payload.snapshot.masterData.stageSeats.items.personId: false`.
  - `Meeting.configOverriddenAt`; `ConfigFreeze.hashVersion` und `ConfigFreeze.configOverriddenAt` (optional).
- **Beschreibungen:**
  - `freezeMeetingConfig`, `Meeting.configHash` und `ConfigSnapshot`: die Definition aus Ziel 1 wörtlich (RFC 8785,
    UTF-8, Kleinbuchstaben-Hex, Ordnung der Arrays, was abgedeckt ist und was nicht).
  - Die fünf gesperrten Schreibwege nennen R-ADM-03; `revokeRole` sagt „vom Freeze nie gesperrt; R-ADM-08“; `assignRole`
    nennt R-ADM-06 und R-ADM-07; `RoleAssignment.deputyForSubjectId` und `RoleAssignmentCreate.deputyForSubjectId`:
    „a deputy (at least two recommended)“ statt „one of the two deputies“.
  - `ConfigSnapshot` und `freezeMeetingConfig`: Nachrechnen nur am gespeicherten Original, nicht aus `EventRead` (Ziel 1).
  - `startMeeting`: R-MTG-02, R-MTG-08, R-MTG-09.
  - `Problem.ruleId`: R-ADM-01..09 mit Inhalt, R-MTG-08, R-MTG-09.
- **Allowlist:** Eintrag `freezeMeetingConfig` entfernen. Danach steht kein Eintrag mit `slice` 040 mehr darin.
- **CHANGELOG**, **Typen** wie üblich.

## Nicht-Ziele

- Keine Oberfläche, keine Hash-Anzeige (041); keine Bereitschaftsprüfung auf Abweichung (070); kein Alarm (085).
- Keine öffentliche Schlussaktion des Jahrgangs; kein Aufheben des Freeze (nur Override).
- Keine Vier-Augen-Pflicht für den Override (nicht im Plan; Missbrauchsfall mit Erkennung unten).
- Kein Einfrieren von Entzügen, Tagesordnungsfortschritt oder Fragenablauf.
- Kein Freeze im Seed: Der Demo-Jahrgang bleibt „laufend, nicht eingefroren“ (Altbestand aus 025).
- Keine Meeting-Konfigurationswerte wie `podiumVisibility` (047), `notes` (046), `presubmittedEnabled` (068); sie
  treten mit `hashVersion` 2 in den Schnappschuss.
- Kein IdP-Abgleich der Rollen (E8).

## Files allowed

Vertrag (Architekt, erster Commit):

- `packages/contract/openapi.yaml`
- `packages/contract/CHANGELOG.md`
- `packages/contract/package.json` (nur das Versionsfeld)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/allowlist.json` (nur den Eintrag für den Freeze entfernen)

Kern:

- `packages/domain/src/types.ts`
- `packages/domain/src/events.ts`
- `packages/domain/src/envelope.ts` (nur die Liste der Ereignistypen)
- `packages/domain/src/state.ts`
- `packages/domain/src/api.ts`
- `packages/domain/src/permissions.ts` (nur die zwei Rechte in der Liste der Administration)
- `packages/domain/src/transitions.ts` (nur Guards R-MTG-08 und R-MTG-09 an der Startzeile und die Option in der Auflösung des Lebenszyklus)
- `packages/domain/src/rules.ts` (nur R-ADM-03, R-ADM-04, R-ADM-06, R-MTG-08, R-MTG-09)
- `packages/domain/src/stream.ts` (nur Themen und Subjekte je Ereignistyp)
- `packages/domain/src/index.ts` (nur Exporte)
- `packages/domain/src/configFreeze.ts` (neu: Schnappschuss, Hash, Prüfung, Abweichung)
- `packages/domain/src/bootstrap.ts` (nur: Wiederherstellung in einem eingefrorenen Jahrgang schreibt zusätzlich das Override-Ereignis)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `packages/domain/src/__tests__/config040d.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur zwei neue Spalten im Abschnitt „Role × Administration“)
- `packages/domain/src/__tests__/meeting025.test.ts` (nur Aufrufe der Lebenszyklus-Auflösung)
- `packages/domain/src/__tests__/person-roles026.test.ts` (nur Fälle, die R-ADM-06 jetzt abweist)
- `packages/domain/src/__tests__/stream035.test.ts` (nur die Liste aller Ereignistypen und die Erwartungen an Themen je Ereignistyp)
- `docs/legal-trace.md` (nur regeneriert)

Dienst:

- `apps/api/src/app.ts` (nur die drei Routen)
- `apps/api/src/__tests__/config040d.test.ts` (neu)
- `apps/api/src/__tests__/person-roles026.test.ts` (nur Fälle, die R-ADM-06 jetzt abweist)
- `apps/api/src/__tests__/stream035.test.ts`, `apps/api/src/__tests__/access-log033a.test.ts`, `apps/api/src/__tests__/limits034a.test.ts`, `apps/api/src/__tests__/metrics033b.test.ts`, `apps/api/src/__tests__/postgres-stream035.test.ts`, `apps/api/src/__tests__/postgres-stream035a.test.ts`, `apps/api/src/__tests__/postgres-takt033.test.ts`, `apps/api/src/__tests__/auth-029b.test.ts`, `apps/api/src/__tests__/idempotency028.test.ts` (nur Testaufbauten mit Rollenzuordnung, die R-ADM-06 oder R-ADM-03 jetzt abweist)
- `apps/api/src/__tests__/contract-043a.test.ts` (nur die Versionszeile, falls 043a gemergt ist)
- `apps/api/src/__tests__/contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-016-contract.test.ts` (nur die Versionszeile, falls die Minor-Stufe wechselt)

Web (nur was die Schnittstelle des Kerns und die erschöpfenden Zuordnungen erzwingen):

- `apps/web/src/api/http.ts` (nur die neuen Methoden)
- `apps/web/src/api/http.test.ts` (nur Tests der neuen Methoden)
- `apps/web/src/api/liveStore.ts` (nur Einträge in den Schreibmethoden)
- `apps/web/src/api/index.ts` (nur falls die Verdrahtung der neuen Methoden es verlangt)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur zwei Aktions- und zwei Ereignisschlüssel)
- `apps/web/src/i18n/labels.ts` (nur Einträge in den Zuordnungen der Aktionen und Ereignisse)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)
- `apps/web/src/features/history/eventSummary.ts` (nur zwei leere Fälle)

Dokumente:

- `docs/rollen-und-rechtekonzept.md` (nur Kopfvermerk „Scheibe 040d“)
- `docs/sicherheit/bedrohungsmodell.md` (nur MF-01, T-G1-E-04, SG6 und die Zeile 040 der Zuordnungstabelle)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V12: eingefrorener Schnappschuss der Zuordnungen und Plätze, Begründung der Aufbewahrungsklasse)
- `docs/glossar.md` (nur die Zeilen „Konfigurationsfreeze“ und „Änderung nach Freeze“)
- `docs/folgeliste.md`
- `docs/slices/040d-konfigurationsfreeze-override-start.md`

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/domain/src/seed.ts`, `packages/domain/src/store.ts`, `apps/api/src/persistence/**`, `apps/api/migrations/**`,
`apps/api/src/actor.ts`, `apps/web/src/features/**` außer `eventSummary.ts`, `apps/web/src/app/**`, `docs/adr/**`,
`docs/entscheidungsregister.md`, `docs/produktplan-beta.md`. Dieser Abschnitt steht bewusst außerhalb von „Files
allowed“.

## Vor dem Bau prüfen

1. 040a–c sind gemergt; die Allowlist enthält von 040 nur noch `freezeMeetingConfig`. Sonst anhalten.
2. Liefert `canonicalJson` für alle Werte des Schnappschusses dieselbe Ausgabe wie RFC 8785 (Schlüsselordnung nach
   UTF-16-Codeeinheiten, Escape-Regeln von `JSON.stringify`, ganze Zahlen)? Test 2 vor dem ersten Hash.
3. Sind die `ruleId`s in `TRANSITIONS` eindeutig? Wenn nicht, gilt die Ordnung `ruleId`, `action`, dann `to`; melden.
4. Welche bestehenden Tests vergeben Vertretungen ohne aktive Zielzuordnung (R-ADM-06) oder ordnen nach einem Freeze
   normal zu (R-ADM-03)? Erwartet: höchstens die in „Files allowed“ genannten Dateien mit `assignRole`. Liste in den
   Bericht; liegt einer außerhalb: anhalten.
5. Nutzt irgendein Code außer `reduce` die Lebenszyklus-Auflösung? Die neue Option darf das Verhalten dort nicht ändern.
6. Zeilenangaben weichen ab: melden.

## Tests zuerst (rot, dann grün)

Kern (`config040d.test.ts`):

1. **Hash, Goldwert:** Die Schnappschussfunktion nimmt Rechte- und Übergangstabellen als Parameter (Standard: die
   echten). Mit kleinen Testtabellen (zwei Rollen, zwei Übergänge, ein berechnetes Ziel) und einem festen Jahrgang ergibt
   sie eine kanonische Zeichenkette und einen Hash, die beide wörtlich im Test stehen; so bricht der Goldwert nicht bei
   jeder künftigen Rechteänderung. Vertauschte Objektschlüssel und vertauschte Listen (Fachbereiche, Plätze, Zuordnungen)
   ergeben denselben Hash. Ein zweiter Fall mit den echten Tabellen prüft nur, dass jede Rolle und jede Regel-id vorkommt.
2. **RFC 8785:** `canonicalJson` liefert für Proben aus dem Wertebereich die erwartete JCS-Ausgabe: Schlüssel „z“ vor „ä“
   (Codeeinheiten), Steuerzeichen als `\u00xx` bzw. `\n`, ganze Zahlen ohne Exponent.
3. **Freeze:** `ConfigFrozen` mit `hashVersion` 1 und `configHash` = SHA-256 der kanonischen Form des gespeicherten
   Schnappschusses; der Schnappschuss enthält jede Rolle, jede Regel-id der vier Tabellen, die Stammdaten ohne
   Fortschrittszeiten und genau die aktiven Zuordnungen (eine entzogene und eine abgelaufene fehlen);
   `Meeting.configFrozenAt`/`configHash` gesetzt, `version` +1.
4. **Freeze-Negativfälle:** zweiter Freeze → 409 R-ADM-04; geschlossener Jahrgang → 409 R-ADM-01; jede Rolle ohne
   `admin.config.freeze` → 403 R-PERM-01; kein Ereignis.
5. **Nach dem Freeze:** die vier `replace…`-Operationen und `assignRole` → 409 R-ADM-03 ohne Ereignis; `revokeRole` → 200;
   `openAgendaItem` auf einem laufenden Jahrgang und `classifyQuestion` gelingen.
6. **Override je Bereich** (fünf Fälle): ein Aufruf von `append` schreibt Änderungsereignis und `ConfigOverridden` mit
   gleicher `commandId` und aufeinanderfolgenden `seq` (n, n+1); `reason` getrimmt gespeichert; `previousConfigHash` = alter Hash; `configHash` = unabhängig nachgerechneter
   Hash des neuen Schnappschusses; `Meeting.configHash` neu, `configFrozenAt` unverändert, `configOverriddenAt` gesetzt.
7. **Override-Negativfälle:** nicht eingefroren → 409 R-ADM-04; `reason: '   '` → 409 R-ADM-04; geschlossen → 409
   R-ADM-01; Rolle ohne `admin.override` → 403; Entfernen eines referenzierten Fachbereichs per Override → 409 R-ADM-02;
   Bereich `roleAssignment` mit eigenem Subject → 409 R-ADM-07. Die Datentabelle der Bereichsrechte ist genau die aus
   Ziel 3.
8. **Start:** `preparation` und eingefroren → `running`, `MeetingStarted`; nicht eingefroren → 409 R-MTG-08; schon
   `running` → 409 R-MTG-02; ohne `agenda.manage` → 403; ein anderer Jahrgang läuft → 409 R-MTG-09
   und der Alias bleibt, auch bei anderem `legalEntity`; nach `MeetingClosed` des anderen gelingt der Start.
   Der Guard liest den anderen Jahrgang aus dem globalen Store, obwohl der Start in der eingegrenzten Instanz läuft.
9. **Projektion ohne Guard:** Der Seed (mit `MeetingStarted` ohne Freeze) und ein Log aus `meeting025.test.ts` laden
   unverändert.
10. **Vertretungen:** Vertretung für ein Subject ohne aktive Zuordnung derselben Rolle → 409 R-ADM-06; Selbstvertretung →
    409 R-ADM-06; drei Vertretungen gelingen (keine Obergrenze).
11. **Override-Wiederholung:** Ein Override mit `Idempotency-Key`, danach verliert der Akteur seine Zuordnung (Entzug durch
    ein zweites Verwaltungskonto); die Wiederholung → 403, kein zweites Ereignis. Die Wiederholungsprüfung liest beide
    Rechte aus der Bereichstabelle.
11b. **Wiederherstellung nach dem Freeze:** `recoveryEvents` auf einem eingefrorenen Jahrgang ohne nutzbare
    Verwaltungsrolle liefert `RoleAssigned` und `ConfigOverridden` (`scope: roleAssignment`, Grund, alter und neuer Hash)
    in einem `append` mit aufeinanderfolgenden `seq`; `Meeting.configHash` ist danach der neue Hash; ohne Freeze nur
    `RoleAssigned`.
11a. **Surrogate:** `reason` mit einzelnem Surrogat → 422, kein Ereignis.
12. **Prüfung und Abweichung:** `verifyConfigEvent` ist wahr für das gespeicherte Ereignis und falsch für eine Kopie mit
    geändertem Schnappschuss; `configDrift` nach einem Entzug meldet keine Abweichung; mit einer übergebenen, veränderten
    Rechtetabelle meldet es `rights`.
13. **Wiederholung:** Freeze, Override und Start mit gleichem `Idempotency-Key` liefern das erste Ergebnis ohne zweites
    Ereignis.
14. **Strom und Maskierung:** `ConfigFrozen` in `listEvents` (admin) ohne `personId` in `snapshot.masterData.stageSeats`;
    ein Leser ohne `event.read` erhält ein `change` mit Thema `meeting`.

Dienst (`apps/api/src/__tests__/config040d.test.ts`):

15. `POST …/config-freeze` → 200 `ConfigFreeze` mit `ETag`; `POST …/config-overrides` → 200; `POST …/opening` → 200; ohne
    `If-Match` auf Override und Start → 428; `PUT …/units` nach dem Freeze → 409 `application/problem+json` mit `ruleId`
    R-ADM-03; ein Override-Rumpf mit unbekanntem Feld oder mit `items` bei `roleAssignment` → 422.
16. **Vertrag:** Kein Allowlist-Eintrag mit `slice` 040; `ConfigOverride.additionalProperties` ist `false`; `Event.type`
    enthält `ConfigOverridden`; ein `EventRead` mit `payload.snapshot.masterData.stageSeats[0].personId` ist ungültig;
    `Problem.ruleId` nennt R-ADM-01..09, R-MTG-08 und R-MTG-09.

**Wahrheitstabellen-Diff (vor dem Bau):** Abschnitt „Role × Administration“ erhält die Spalten `admin.config.freeze` und
`admin.override`, ✓ nur in der Zeile admin. Sonst keine Änderung.

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):
- R-ADM-03 in `replaceMeetingUnits` übersprungen → Test 5 rot.
- Leerer Grund angenommen → Test 7 rot.
- Entzogene Zuordnungen im Schnappschuss → Test 3 rot.
- Fachbereiche im Schnappschuss nicht sortiert → Test 1 rot.
- R-MTG-09 entfernt → Test 8 rot.
- Wiederholung des Override prüft nur `admin.override` → Test 11 rot (über eine übergebene Bereichstabelle im Test).
- R-MTG-08 auch in `reduce` geprüft → Test 9 rot.

## Akzeptanzkriterium

1. `pnpm contract:lint` grün ohne neue Meldung; `pnpm contract:types` ohne Diff beim zweiten Lauf; `check.mjs` (a)–(d)
   `ok`, (d) ohne Eintrag mit `slice` 040.
2. Tests 1–16 (mit 11a, 11b) grün, sieben Mutationsproben rot belegt; Wahrheitstabellen-Diff genau wie oben.
3. Die Planbelege sind erfüllt: „Stammdatenänderung nach Freeze → 409 R-ADM-03“ (Tests 5, 15), „override erzeugt Ereignis
   mit Grund“ (Test 6), „Wahrheitstabellen-Diff für admin-Rechte“ (040a–d).
4. `pnpm gates` (mit Postgres-Variablen wie in CI) grün, einschließlich `slice-scope` auf `claude/slice-040d-…`; Schluss der
   Ausgabe einmal im Bericht.
5. Kein Screenshot (keine Ansicht ändert sich; die Hash-Anzeige kommt mit 041).

## Nachweise

- Goldwert aus Test 1 (kanonische Zeichenkette gekürzt, Hash vollständig).
- Auszug `check.mjs`, Typen-Diff (`ConfigOverride`, `ConfigSnapshot`, `Meeting`, `Event`).
- Wahrheitstabellen-Diff, Mutationsproben, Liste der angepassten 026-Tests (Vor-dem-Bau-Punkt 4).
- Schluss von `pnpm gates` mit Commit-Hash.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Fachregel, Status (Start-Guard)
- [x] Vertrag, Ereignis, Konfiguration
- [x] Rolle, Recht, Identität, Schutzklasse
- [x] Administration (Freeze, Override)
- [x] personenbezogene Daten (Subjects und Plätze im Schnappschuss)
- [ ] Persistenz, Migration (keine Migration)
- [ ] Oberfläche

Perspektive: Security/Admin (6.5, 6.8), Legal (Nachweis), Datenschutz (6.6) · Nachweise: Tests 1–16, Mutationsproben,
Goldwert · Offene Entscheidung: E8 (Tabelle ist Wahrheit), E25 (Vertretungen), Eigentümerfragen 3, 4 und 5 in 040a

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Bedrohungen:**
  - **MF-01** (Rechteerhöhung über die Rollenzuordnung): R-ADM-07 (040a) verhindert die Selbstzuordnung. Nach dem Freeze
    braucht jede neue Zuordnung Override mit Grund und ändert den Hash sichtbar. Zwei zusammenwirkende Administrationskonten
    bleiben möglich; Erkennung unten.
  - **T-G1-E-04** (Administration als Inhaltskonto): Der Override ändert nur Konfiguration, nie einen Vorgang.
  - **SG6/SG9** (Rechtezuordnung, Integrität der Tabellen): Der Schnappschuss hält die wirksame Tabelle fest,
    `configDrift` erkennt ein Release während des Freeze.
  - **SG4, T-G2-R-01** (Log-Integrität, Änderung am Speicher ohne Spur): Schnappschuss und Hash stehen in der Kette; eine
    Änderung in der Datenbank bricht die Kette (024) oder den Selbstvergleich (`verifyConfigEvent`).
  - **T-G1-R-01** (Abstreiten): Override mit Akteur, Zeit und Grund.
  - **T-G1-T-02** (unbekannte Felder): `ConfigOverride` mit `additionalProperties: false`.
  - **T-G3-E-03** und **E8:** Die Zuordnungstabelle bleibt die Wahrheit; ein künftiger IdP-Abgleich schreibt nach dem
    Freeze nur über den Override.
  - **MF-07:** Vertretungen halten die Rolle voll; R-GUARD-06 bleibt personengebunden.
- **Missbrauchsfälle mit Erkennung:**

  | Missbrauch | Abwehr | Erkennung, Nachweis |
  |---|---|---|
  | admin ordnet sich am HV-Tag selbst `approver` zu | R-ADM-07 (040a); nach dem Freeze zusätzlich R-ADM-03 | 040a Test 7, hier Test 7; verweigerter Versuch mit Regel-id im Zugriffslog (033a) |
  | admin entzieht am HV-Tag nach dem Freeze reihenweise die Rollen von Freigabe, Recht oder Podium (Sabotage) | Entzug bleibt frei (ein Entzug darf nie blockiert werden); R-ADM-08 schützt nur die Verwaltungsrolle; ein Grund wird empfohlen, nicht erzwungen | `RoleRevoked` einer Zuordnung, deren Rolle `question.approve`, `question.legal.clear` oder `question.deliver` hält, nach dem Freeze → Alarmvorschlag an 085; Grund und Akteur im Log. **Restrisiko:** Bis zur Reaktion fehlt die Rolle; Wiederherstellung per Override mit Grund durch ein zweites Verwaltungskonto und über Vertretungen. Eine Vier-Augen-Pflicht für den Entzug ist nicht gebaut |
  | ein zweiter Jahrgang wird am HV-Tag gestartet und übernimmt den Alias (Ausfall) | R-MTG-09: kein Start, solange irgendein anderer Jahrgang läuft | Test 8; verweigerter Start mit R-MTG-09 im Zugriffslog; Alarmvorschlag an 085 für jeden verweigerten oder gelungenen Start am HV-Tag |
  | Betreiber stellt nach dem Freeze still eine Verwaltung wieder her | Wiederherstellung schreibt `ConfigOverridden` mit Grund und neuem Hash | Test 11b; Hash im Kopf (041); Alarmvorschlag an 085 für jedes `operatorRecovery` |
  | zwei admins ordnen einander `approver` zu | nach dem Freeze nur per Override mit Grund | `ConfigOverridden` mit `scope: roleAssignment`, Grund und neuem Hash; Hash im Kopf (041); Alarmvorschlag an 085 „Override mit Bereich roleAssignment“ |
  | Stammdaten nach dem Freeze still ändern | R-ADM-03 | Test 5; Planbeleg |
  | Override ohne echten Grund („x“) | nur nicht leer erzwungen; Inhalt ist Verantwortung der Person | Grund steht im Log und im Export (051); Auswertung zu zweit (Rechtekonzept §6) |
  | Release ändert Rechte während des Freeze | Schnappschuss im Ereignis | `configDrift` meldet `rights` (Test 12); Anzeige 041, Prüfung 070 |
  | Freeze umgehen, indem man ohne Freeze startet | R-MTG-08 | Test 8 |
  | Entzug einer kompromittierten Rolle durch den Freeze blockiert | Entzug nie eingefroren | Test 5 |

- **Invarianten:** Nach dem Freeze gibt es keine Konfigurationsänderung ohne `ConfigOverridden` mit Grund, auch nicht über
  die Wiederherstellung des Betreibers. Jeder
  gespeicherte Hash lässt sich aus dem gespeicherten Schnappschuss nachrechnen. Ein Entzug ist immer möglich. Kein Start
  ohne Freeze über den Befehlsweg.
- **Fehlerfälle:** Ein Freeze auf veraltetem Stand (anderes Admin-Fenster) antwortet 412, wenn `If-Match` gesendet wird.
  Override und Start verlangen `If-Match`.
- **Betrieb und Doku:** 041 zeigt den Hash; 070 nimmt „Freeze vor der HV, Override nur mit Grund, Abweichung prüfen“ ins
  Runbook; 077 (Freeze-Fenster der Auslieferung) ist davon getrennt.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. Die Hashdefinition im Code entspricht Ziel 1 wörtlich (Ordnung, Umfang, `"<computed>"`, keine `null`).
2. Die fünf gesperrten Schreibwege prüfen R-ADM-03 im Kern, nicht im Dienst.
3. Der Override prüft zwei Rechte über eine Datentabelle und durchläuft alle Prüfungen des normalen Wegs.
4. `revokeRole` hat keinen Freeze-Zweig.
5. R-MTG-08 steht in der Tabelle; `reduce` prüft ihn nicht (Test 9).
6. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (Tor role-literals).
7. `personId` fehlt im `EventRead` des Schnappschusses (Test 14); der Vertrag sagt, dass der Hash nur am Original
   nachrechenbar ist.
8. Die Wiederholung eines Override prüft beide Rechte (Test 11).
9. R-MTG-09 steht als Guard an der Startzeile, nur im Befehlsweg.

## Offene Eigentümerfragen

Siehe `docs/slices/040a-admin-ohne-inhaltsrechte.md`, Fragen 1, 3, 4 und 5.

## Hinweise an Folgescheiben

- **041:** zeigt `Meeting.configHash`, `configFrozenAt`, `configOverriddenAt`; Override-Dialog mit Pflichtgrund;
  Playwright „Jahrgang anlegen → Freeze → Änderung abgelehnt“.
- **047:** `podiumVisibility` und weitere Meeting-Konfiguration erhöhen `hashVersion`.
- **051:** Export nimmt `ConfigFrozen`/`ConfigOverridden` mit Grund auf.
- **070:** Runbook „Freeze, Override, Abweichung“.
- **085:** Alarmvorschläge: jeder `ConfigOverridden`, besonders `scope: roleAssignment`; Abweichung aus `configDrift`.

## Bericht (nach Bau ausfüllen)

```
Slice: 040d-konfigurationsfreeze-override-start
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
6.

**Goldwert (Test 1).**

**Wahrheitstabellen-Diff.**

**Mutationsproben (Ergebnis).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings

**Lesebefund der Spec (30.09.2026, zu `4fac838`):** eingearbeitet in 040d: Major 1 (`liveStore.ts`), Major 2
(`stream035.test.ts`), Major 3 (`contract-043a.test.ts`), Major 6 (`meetingId`), Major 8 (R-MTG-09, Missbrauchszeile),
Major 10 (Massenentzug, Restrisiko), Major 11 (keine Obergrenze, Vertragstext berichtigt), Major 5 (R-ADM-07 nach 040a
verlegt), Minor 14 (`overrideScopePermission`, `pseudonymiseForUnits`, benannte Lücken), Minor 15 (Nachrechnen nur am
Original), Minor 16 (wohlgeformte Zeichenketten, 422), Minor 17 (Aufbewahrungsklasse, `reason` ohne Personendaten),
Minor 18 (Wiederholung prüft beide Rechte, Test 11), Minor 19 (ein `append`, Test 6), Minor 24 (weitere Testdateien mit
`assignRole` benannt).

**Nachprüfung (30.09.2026, zu `bccba04`):** eingearbeitet in 040d: N3 (R-MTG-09: kein Start, solange irgendein anderer
Jahrgang läuft; Test 8, Missbrauchszeile), N4 (Wiederherstellung nach dem Freeze schreibt `ConfigOverridden`; §4,
Invariante, Test 11b), N8 (Guard liest andere Jahrgänge aus dem globalen Store), N9 (Regel-id-Bereiche R-ADM-01..09,
R-MTG-08/09; `startMeeting` nennt R-MTG-09).
