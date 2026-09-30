# Scheibe 040a — Administration im Kern, Teil 1: Administration ohne Inhaltsrechte

**Status:** spec (30.09.2026; überarbeitet nach dem Lesebefund zu `4fac838` und der Nachprüfung zu `bccba04`; Teil 1 von 4 der geteilten Scheibe 040, Zuschnitt aller Teile im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 1,5 AStd · Plan 040: 03.11.2026 (W6); 040a hat keinen Vertragsschritt und darf früher starten, wenn der Orchestrator es einplant (Eigentümerfrage 1) · Lanes: core; service (nur Tests); e2e (nur die genannten Testumbauten); web-stage (nur Verlegen einer reinen Funktion mit Test); web-history (Hervorhebung administrativer Ereignisse); web-shell (nur zwei i18n-Schlüssel und `parity.test.ts`); docs-legal (nur Vermerk im Rechtekonzept); docs-sicherheit
**Rolle:** implementierer-backend; Review in frischem Kontext mit Perspektive Security/Admin (Rechte, Wahrheitstabelle) und Legal (Rechtekonzept §4); Lesebefund der Spec vor dem Bau; nie gebündelt (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** neu R-ADM-07 (keine Selbstzuordnung einer Rolle), R-ADM-08 (die letzte tragfähige Verwaltungsrolle eines nicht geschlossenen Jahrgangs ist nicht entziehbar). Angewandt: R-PERM-01, R-PERM-02, R-GUARD-06. Dazu AGENTS.md R2, R3, R4, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` §5/040 (Zeile 625–630: „deny by default“, „Wahrheitstabellen-Diff für admin-Rechte“), §10 E8, E25
- `docs/rollen-und-rechtekonzept.md` Kopfvermerk Scheibe 025 („Die Inhalts- und Override-Rechte der Administration werden erst in 040 neu geordnet“), §3 Punkt 4 (deny by default), §4 Zeile 173 („Administration ist Rechteverwaltung, nicht Inhaltsbearbeitung. Dass die Administration eine Frage überall hinschicken kann, ist praktisch nötig und bleibt — aber jede administrative Aktion auf Inhalte erzeugt einen herausgehobenen Auditeintrag und ist im Verlauf der Frage sichtbar“), §5 Tabelle („Administration: Rechte, keine Inhalte“), §5 Zeile 205 („mindestens zwei benannte Vertreter“)
- Bedrohungsmodell SG6, SG9, T-G1-E-04, T-G1-E-01, MF-01, MF-07, BF-09
- Spec 043a (Zuschnittsregel 1, Tabelle „Vertragszeilen der Umsetzungsscheiben“, Eigentümerfrage 5, Hinweis an 044 zur Ausschlussliste von admin)
- Spec 029b, Abschnitt „Erstvergabe vor der Beta“ (Auftrag an 040: Betreiber-Bootstrap, hier in 040c)
- Lesebefund zu Spec 040a–d (30.09.2026, zu `4fac838`)

**Depends on:** 025, 026, 028 (gemergt; Code auf `a3ba94b`)
**Perspektive:** Security/Admin, Legal · **Glossar: neue Begriffe:** nein

## Teilung und Zuschnitt

Die Planzeile 040 (2,5 AStd, hoch) nennt Jahrgang anlegen und klonen, Fachbereiche, TOPs, Bühnenplätze mit Person und
Gerät, Personen einer Einheit, Einheit „AR-Büro“ im Seed, `counts.byUnit`/`bySeat`, Rollenzuordnung mit Ablauf und zwei
Vertretungen, Lebenszyklus-Aktionen, Nummernkreise je Erfassungsplatz, Konfigurationsfreeze mit Hash und
`admin.override`, deny by default, das Montieren von sechs vorab erklärten Operationen und das Entfernen ihrer
Allowlist-Einträge. Dazu kommen zwei Aufträge, die andere Scheiben an 040 gegeben haben: das Neuordnen der
Administrationsrechte (Rechtekonzept, Kopfvermerk 025) und der Betreiber-Bootstrap für den ersten Jahrgang mit
Erst-Admin (029b). Das ist mehr als ein Review. Nach dem Vorbild von 035a/b und 043a wird 040 in vier Teile geschnitten.
Jede Spec ist vollständig; diese hier trägt zusätzlich Zuschnitt, gemeinsame Entscheidungen und alle Eigentümerfragen.

| Teil | Thema | Inhalt | Vertragsschritt | Klasse · AStd |
|---|---|---|---|---|
| **040a** (diese Spec) | Administration ohne Inhaltsrechte | `ROLE_PERMISSIONS.admin` wird eine ausdrückliche Liste: Lesen, Weiterleiten (`question.assign`, `question.return`), Verwaltung; ohne Schreibrechte auf Inhalte; keine Selbstzuordnung (R-ADM-07); letzte Verwaltungsrolle nicht entziehbar (R-ADM-08); Hervorhebung administrativer Ereignisse in der Historie (Rechtekonzept §4); neuer Wahrheitstabellen-Abschnitt; Testumbauten | keiner (R-ADM-07/08 nutzen das schon dokumentierte 409 an `assignRole`/`revokeRole`) | hoch · 1,5 |
| **040b** | Stammdaten und Bühnenplätze | `replaceMeetingAgendaItems`, `replaceMeetingUnits`, `listMeetingStageSeats`, `replaceMeetingStageSeats`; `Classification.seatId` und `Question.seatId`; `counts.byUnit`/`bySeat`; Einheit „AR-Büro“ und vier Standardplätze im Seed; R-ADM-01, R-ADM-02 | ja (Architekt, erster Commit) | hoch · 1,5 |
| **040c** | Jahrgang, Erstinbetriebnahme, Nummernkreise | `createMeeting` mit Klonen, Erstellerzuordnung und globalem Wiederholungsschlüssel; Betreiber-Bootstrap und auditierter Wiederherstellungsweg (Kommandozeile); Nummernkreise je Erfassungsplatz mit Aussparen bei der Fragenummer; R-ADM-05, R-ADM-09 | ja | hoch · 2 |
| **040d** | Konfigurationsfreeze, Override, Start | `freezeMeetingConfig` mit Hash (RFC 8785), `overrideMeetingConfig` mit Pflichtgrund, `startMeeting`; Rollenzuordnung nach dem Freeze nur per Override; Vertretungsregel; R-ADM-03, R-ADM-04, R-ADM-06, R-ADM-10, R-MTG-08, R-MTG-09; Rechtezuordnung der Operationen als Daten und Build-Kennung im Schnappschuss | ja | hoch · 2,5 |

Summe rund 7,5 AStd statt 2,5. Die Planschätzung enthielt weder den Bootstrap aus 029b noch den Wiederherstellungsweg,
das Umstellen der Testakteure, die heute admin als Allzweck-Schreiber nutzen (Befund), noch Vertragsschritt,
Web-Adapter, Live-Puffer und i18n-Schlüssel je Teil. Zuschnitt und Budget brauchen das Go des Eigentümers
(Eigentümerfrage 1).

**Reihenfolge a → b → c → d, streng seriell.** Alle vier Teile berühren die Lane core (Wahrheitstabelle ist ein Snapshot,
Plan §5.1). 040a kommt zuerst:
- Es schließt die Inhaltsschreibrechte von T-G1-E-04 und den Selbstzuordnungsweg von MF-01 ohne Vertragsänderung.
- 040b bis 040d schreiben ihre neuen Tests danach gleich mit den fachlich zuständigen Akteuren.
- Mit der ausdrücklichen Liste erhält admin die neuen Rechte aus b bis d nicht mehr still über
  `PERMISSIONS.filter(…)`. Jeder Teil vergibt sein Recht sichtbar, und der Wahrheitstabellen-Diff zeigt es.

**Allowlist.** Die sechs Einträge mit `slice` 040 laufen am 25.11.2026 ab. 040b entfernt vier davon
(`replaceMeetingAgendaItems`, `replaceMeetingUnits`, `listMeetingStageSeats`, `replaceMeetingStageSeats`), 040c
`createMeeting` und 040d `freezeMeetingConfig`. Die Teile entfernen Einträge der Planzeile 040, wie 035b den Eintrag
`streamEvents` mit `slice` 035 entfernt hat. Alle Teile müssen vor dem 25.11. gemergt sein, sonst wird
`packages/contract/scripts/check.mjs` (d) rot. **Rückfall:** Ist absehbar, dass ein Teil den Termin verfehlt, verlängert der
Orchestrator die betroffenen `expires` in einem eigenen Takt mit Begründung im `reason` und Vermerk im Tagesbericht; der
Architekt schreibt diesen Takt, weil `allowlist.json` in der Lane contract liegt.

**Abnehmer.** 041 (Admin-Oberfläche) braucht b, c und d, und zwar für einen beliebigen Jahrgang, nicht nur den laufenden
(Gemeinsame Entscheidung 5). 047 braucht die Bühnenplätze mit Person und Gerät (b). 053 braucht `counts.byUnit`/`bySeat`
(b). 068 braucht die Nummernkreise (c). 044 profitiert von a: `question.refuse.*` fällt nicht mehr über die Ableitung an
admin.

**„Personen einer Einheit zuordnen“** (Planzeile 040) ist mit `assignRole.unitId` seit 026 gebaut (Rollenzuordnung mit
optionaler Einheit; eine Fachkraft ohne Einheit liest keine Fragen). 040 baut dafür nichts Neues; die Oberfläche dazu ist
Teil von 041.

### Vertragsschritt und Eigentümerfrage 5 aus 043a

043a legt fest (Zuschnittsregel 1): Ein reiner Vertragsstand erweitert kein bestehendes Anfrageschema. Neue Eingaben
kommen entweder als neue, vorab erklärte Operation oder als Vertragszeile der Umsetzungsscheibe, die der Architekt als
**ersten Commit** dieser Scheibe schreibt, **additiv** (nur optionale Felder; eine fachliche Pflicht erzwingt ein Guard mit
409). Ob Anfragezeilen so in die Umsetzungsscheiben wandern, ist Eigentümerfrage 5 von 043a und **noch nicht
beantwortet**. 040 funktioniert in beiden Fällen:

| | mit Go auf 043a-Frage 5 (erwartet) | ohne Go |
|---|---|---|
| Wer schreibt den Vertrag | der Architekt, als ersten Commit von 040b, 040c und 040d; die Planzeile 040 erhält die Lane contract | der Architekt, als eigener Vertragsschritt (Takt mit Mini-Spec des Orchestrators) unmittelbar **vor** 040b, 040c bzw. 040d |
| Wer ändert `allowlist.json` | der Architekt im ersten Commit des Teils: er entfernt die Einträge mit `slice` 040, die der Teil ausübt; neue Operationen erhalten keinen Eintrag | der vorgezogene Vertragsschritt fügt je neue Operation einen Eintrag hinzu (`slice` 040c bzw. 040d, `expires` 2026-11-25); der Teil selbst entfernt diese und seine 040-Einträge im Commit mit dem ersten Test der Route (wie 035b) |
| Neue Operationen (`listMeetingCaptureRanges`, `replaceMeetingCaptureRanges`, `overrideMeetingConfig`, `startMeeting`) | im selben Zweig mit dem Code | vorab erklärt, siehe oben |
| Neue Ereignistypen und Antwortfelder (`Event.type`, Nutzlastschemas, `Meeting.configOverriddenAt`) | wie oben | im Vertragsschritt (Antwortseite, additiv; kein Dienst liefert sie vor dem Teil) |
| `Classification.seatId` (Erweiterung eines bestehenden Anfrageschemas) | erster Commit von 040b | **nicht** im Vertragsschritt (Regel 1). 040b projiziert `seatId` aus dem Altfeld `stageAssignment` für die vier Standardplätze; eine Klassifizierung auf einen eigenen Platz wartet auf die Scheibe, die das Feld dann trägt (Planzeile: 043, sonst 056). Die Tests mit `seatId` in der Eingabe (040b Test 6) entfallen dann und stehen im Bericht |

040a ändert `allowlist.json` in keinem der beiden Fälle. Der Unterschied betrifft nur, wer wann `packages/contract/**`
schreibt. Kern, Dienst und Tests der Teile bleiben gleich.

### Gemeinsame Entscheidungen für alle Teile

1. **Rechte als Daten, ausdrücklich.** `ROLE_PERMISSIONS.admin` ist ab 040a eine Liste. Jeder spätere Teil fügt sein Recht
   dort sichtbar hinzu. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` und dem Demo-Rollenwechsel (AGENTS.md R4); wo ein
   Teil „die Verwaltungsrolle“ braucht (R-ADM-08, Bootstrap), leitet er sie aus den Daten ab: jede Rolle, deren Bündel
   `admin.roles.manage` hält.
2. **Stammdaten sind Ereignisse** mit ganzer Liste je Änderung (`AgendaItemsReplaced`, `UnitsReplaced`,
   `StageSeatsReplaced`, `CaptureRangesReplaced`). Jedes erhöht `Meeting.version` (das ETag von `getMeetingById`).
3. **Regel-ids.** Frei und geprüft am 30.09.2026 (Suche über `packages/`, `apps/`, `docs/`): R-ADM-01..10 (im Code
   unbelegt; im Vertrag nur als Beschreibung „R-ADM-01..04 (slice 040)“, R-ADM-03 dort schon als „Stammdatenänderung
   nach Freeze“), R-MTG-08 und R-MTG-09 (R-MTG-07 ist für 087 reserviert). Der Plan nennt R-ADM-01..04; die Nummern 05
   bis 10 sind die nächsten freien, weil Zuschnitt, Lesebefund, Nachprüfungen und der Codex-Befund sechs eigenständige
   Regeln mehr zeigen. Kein neuer
   R-GUARD: die nächste freie Nummer wäre R-GUARD-12 (R-GUARD-08/-09 sind für 044 belegt, R-GUARD-10 für 059, R-GUARD-11
   für 043a/044).

   | Regel | Teil | Inhalt |
   |---|---|---|
   | R-ADM-07 | 040a | Keine Selbstzuordnung einer Rolle (409) |
   | R-ADM-08 | 040a | Die letzte tragfähige Zuordnung einer Verwaltungsrolle (ohne Ablauf oder Ablauf ≥ 24 h) in einem Jahrgang in `preparation` oder `running` ist nicht entziehbar (409) |
   | R-ADM-01 | 040b | Die Konfiguration eines geschlossenen Jahrgangs ist unveränderlich (409): Stammdaten ab 040b, Nummernkreise ab 040c, Freeze und Override ab 040d; die Beschreibung im Regelregister nennt von Anfang an alle drei |
   | R-ADM-02 | 040b | Stammdaten, auf die etwas zeigt, bleiben (Entfernen eines referenzierten TOP, Fachbereichs oder Bühnenplatzes → 409) |
   | R-ADM-05 | 040c | Die Nummernkreis-Zugehörigkeit einer vergebenen Fragenummer ändert sich nie (409) |
   | R-ADM-09 | 040c | Ein Notzugang aus der Wiederherstellung legt keinen Jahrgang an (409) |
   | R-ADM-03 | 040d | Nach dem Freeze ändert nur der Override die Konfiguration; der normale Weg antwortet 409 |
   | R-ADM-04 | 040d | Freeze genau einmal; Override nur bei eingefrorener Konfiguration und mit nicht leerem Grund (409) |
   | R-ADM-06 | 040d | Vertretung: Ziel hält die Rolle aktiv, keine Selbstvertretung (409); keine Obergrenze |
   | R-ADM-10 | 040d | Freeze nur, wenn jede Rolle mit aktiver Inhaberschaft mindestens zwei tragfähige Vertretungen hat (409; Rechtekonzept §5) |
   | R-MTG-08 | 040d | Ein Jahrgang startet nur mit eingefrorener Konfiguration (409) |
   | R-MTG-09 | 040d | Ein Jahrgang startet nicht, solange irgendein anderer Jahrgang läuft (409; der Alias folgt dem jüngsten laufenden Jahrgang, ADR 0011 kennt eine Gesellschaft) |

4. **Oberfläche kommt mit 041.** 040b bis 040d ändern keine Ansicht. Sie ergänzen nur, was erschöpfende Zuordnungen im
   Web erzwingen: `ACTION_KEYS`, `EVENT_KEYS` (`apps/web/src/i18n/labels.ts`), den `switch` in `eventSummary.ts`, jeweils
   mit `parity.test.ts`, und im Live-Puffer `apps/web/src/api/liveStore.ts` die Einträge in `READ_TOPICS`,
   `WRITE_METHODS` und `WATERMARKS.version` (`liveStore.test.ts` (p) prüft die Vollständigkeit).
5. **Jahrgangsbezogene `HvApi`-Methoden nehmen `meetingId`** als ersten Parameter, wie `getMeetingById` und
   `listMeetingAgendaItems`. Grund: 041 muss den nächsten Jahrgang einrichten und einfrieren, während der laufende
   Jahrgang der Alias ist. Weil `append` Ereignisse eines anderen als des Alias-Jahrgangs abweist
   (`packages/domain/src/api.ts:601-609`), führt der Kern jeden solchen Schreibvorgang über eine je Jahrgang
   eingegrenzte Instanz auf demselben Store aus (dieselbe Konstruktion wie `meetingDomain` in `apps/api/src/app.ts:407`,
   nur im Kern). Die Instanz wird je `meetingId` **einmal** erzeugt und zwischengespeichert, nicht je Aufruf: Jede
   Instanz meldet sich mit `store.subscribe` an (`api.ts:314`), neue Instanzen je Aufruf wären ein Leck. Ein Test zählt die
   Anmeldungen nach mehreren Aufrufen. Prüfungen, die andere Jahrgänge brauchen (R-MTG-09, `createMeeting`-Wiederholung,
   Erstellerzuordnung), lesen den globalen Store, nie die eingegrenzte Projektion. Der Demo-Adapter (`apps/web/src/api/index.ts`, unveränderte Verdrahtung) und `apps/web/src/api/http.ts`
   setzen dieselbe Signatur um.

## Befund (Ist-Stand, gelesen auf `a3ba94b`)

- `packages/domain/src/permissions.ts:74`: `admin` erhält **alle** `PERMISSIONS` außer `agenda.manage`,
  `admin.roles.manage`, `question.identity.reveal`, `contribution.claim`, `question.claim` und danach ausdrücklich
  `agenda.manage` und `admin.roles.manage`. admin hält damit 17 Schreibrechte auf Wortmeldungen, Redebeiträge und
  Einzelfragen: `speaker.register`, `speaker.reorder`, `speaker.update`, `contribution.capture`, `question.capture`,
  `question.classify`, `question.assign`, `answer.draft`, `question.submit_review`, `question.approve`,
  `question.legal.clear`, `question.return`, `question.stage`, `question.deliver`, `question.close`,
  `question.withdraw`, `question.merge`. Dazu alle sieben Leserechte und `demo.seed`.
- Folge der Ableitung: **Jedes neue Recht in `PERMISSIONS` fällt still an admin.** Genau das nennt das Rechtekonzept §3
  Punkt 4 als häufigsten Rechte-Bug.
- `packages/domain/policy-truth-table.md:163-184`: 22 admin-Zeilen mit 73 ✓ in den 14 Schreibspalten. Je Spalte: q.capture
  22, q.claim 0, q.classify 4, q.assign 2, answer.draft 5, q.submit_review 1, q.approve 1, q.legal.clear 2, q.return 8,
  q.stage 0, q.deliver 2, q.close 2, q.withdraw 16, q.merge 8. Die Rechte `speaker.*` und `contribution.capture` stehen in
  keinem Abschnitt der Tabelle; ihr Wegfall wäre heute unsichtbar.
- **Selbstzuordnung:** `assignRole` (`api.ts:718-747`) erlaubt `subjectId` = eigene Akteur-id. Die Sitzung wählt die
  älteste aktive Zuordnung (`apps/api/src/actor.ts:112-114`). admin kann sich also `approver` zuordnen, die eigene
  admin-Zuordnung entziehen und danach als `approver` freigeben. `assignRole` dokumentiert 409 schon
  (`packages/contract/openapi.yaml:1244`), ebenso `revokeRole` („409 when already revoked“).
- **Aussperren:** `revokeRole` (`api.ts:750-761`) entzieht auch die letzte Zuordnung mit `admin.roles.manage`. Danach kann
  niemand im Jahrgang mehr Rollen zuordnen; der Bootstrap aus 040c greift nur bei leerer Datenbank.
- Bedrohungsmodell: T-G1-E-04 und BF-09 offen, „geplant in Scheibe 040“ (`docs/sicherheit/bedrohungsmodell.md:212, 499`).
- **Tests nutzen admin als Allzweck-Schreiber.** Grobe Zählung der Fundstellen von „admin“:
  `packages/domain/src/__tests__/api.test.ts` (52, Standardakteur `actors.admin`, Zeile 28),
  `apps/api/src/__tests__/stream035.test.ts` (117), `limits034a.test.ts` (25, `registerSpeaker` als `ACTOR.admin`),
  `access-log033a.test.ts` (24), `negative.test.ts` (26), weitere in `meeting025`, `person-roles026`, `read-rights`,
  `postgres-*`. Nicht jede Fundstelle schreibt; die Umstellung betrifft nur Schreibvorgänge, die admin danach nicht mehr
  darf.
- **e2e, wo ein reiner Akteurwechsel nicht reicht** (Umbauten in „Ziel“, Punkt 4):
  - `apps/web/e2e/090-eingaben-je-akteur.spec.ts:371-480`: sieben Tests „090 R1“ wechseln zu admin, weil admin dieselbe
    Eingabe auch sieht bzw. dasselbe Recht hält. Sie schützen vor Text, der auf einem geteilten Gerät nach dem
    Personenwechsel stehen bleibt (Datenschutz).
  - `apps/web/e2e/010b-lesepfade.spec.ts:743-780` („Runde 4 (A)“): admin liefert aus und schreibt nebenher eine
    Wortmeldung.
  - `apps/web/e2e/020-rueckbau-passung.spec.ts:547-561`: Negativfall m2 „admin has `question.deliver` too, but also every
    drafting …“. Nach 040a hält admin `question.deliver` nicht mehr; der Fall würde still inhaltsleer.
- `packages/domain/src/seed.ts:50`: `SYSTEM_ACTOR` hat die Rolle admin. Der Seed schreibt Ereignisse direkt, nicht über
  `can()`; die automatische Aussaat braucht nur `demo.seed`.
- `apps/web/src/api/index.ts:151-160`: Die Demo sät als admin (`demo.seed`).
- `packages/domain/src/__tests__/api.test.ts:745`: „admin drafts and approves: 409 R-GUARD-06“. Nach 040a antwortet admin
  dort mit 403. Die Aussage (kein Akteur umgeht den Guard) trägt weiter der Fall mit `legal` (Zeile 734) und die
  Tabellenprobe in `transitions.test.ts:97`.

## Ziel

admin verwaltet Rechte und Stammdaten, liest und leitet Vorgänge weiter; admin schreibt keine Inhalte und führt keinen
fachlichen Arbeitsschritt aus. Das setzt Rechtekonzept §4 **vollständig** um: Inhaltsbearbeitung nein, „eine Frage überall
hinschicken“ ja, und jede administrative Aktion ist im Verlauf der Frage **hervorgehoben** sichtbar (Punkt 5). Das Streichen der
Inhaltsrechte ist keine Eigentümerentscheidung mehr, sondern Umsetzung des Rechtekonzepts, des Kopfvermerks 025 und von
T-G1-E-04/BF-09. Das Zurückziehen einer Frage (`question.withdraw`) ist kein Weiterleiten: Es nimmt die Frage eines
Aktionärs aus der Beantwortung, auch nach dem Vorlesen. Es entfällt für admin (Eigentümerfrage 2c).

1. **Liste.** `ROLE_PERMISSIONS.admin`:

   ```
   speaker.read, contribution.read, question.read, question.read.delivered, stage.read, history.read, event.read,
   question.assign, question.return,
   agenda.manage, admin.roles.manage, demo.seed
   ```

   - **Weiterleiten bleibt:** `question.assign` (an einen Fachbereich) und `question.return` (zurück in die Bearbeitung).
     Jeder dieser Schritte ist ein Ereignis mit `actor.role`, das in der
     Vorgangshistorie jeder Frage für alle Halter von `history.read` sichtbar ist (`EventRead.actor.role`) und dort
     hervorgehoben wird (Punkt 5).
   - **Entfällt (15 Rechte):** `speaker.register`, `speaker.reorder`, `speaker.update`, `contribution.capture`,
     `question.capture`, `question.classify`, `answer.draft`, `question.submit_review`, `question.approve`,
     `question.legal.clear`, `question.stage`, `question.deliver`, `question.close`, `question.withdraw`,
     `question.merge`. Die Rückkehr von `question.withdraw` wäre eine Zeile (Eigentümerfrage 2c).
   - Lesen bleibt unverändert (Eigentümerfrage 2a). `agenda.manage` bleibt (Ablaufsteuerung, einziger Halter;
     Eigentümerfrage 3). `demo.seed` bleibt (nur Demo; 042 begrenzt es).
   - Die Rechte aus 040b bis 040d fügen die Teile selbst hinzu.
2. **R-ADM-07, keine Selbstzuordnung.** `assignRole` mit `subjectId` = Akteur-id → 409 R-ADM-07, kein Ereignis. Gilt
   für jede Rolle, auch in der Demo. Nicht betroffen: die Erstellerzuordnung aus 040c (kein `assignRole`; sie überträgt
   nur die eigene Rolle) und der Bootstrap (Akteur `system`, anderes Subject).
3. **R-ADM-08, kein Aussperren.** `revokeRole` einer Zuordnung, deren Rolle `admin.roles.manage` hält, antwortet 409
   R-ADM-08, wenn sie im Jahrgang (Status `preparation` oder `running`) die letzte **tragfähige** solche Zuordnung ist.
   Tragfähig ist eine Zuordnung, die nicht entzogen ist und entweder keinen Ablauf hat oder frühestens 24 Stunden nach
   `now` abläuft. Eine Zuordnung, die bald abläuft, zählt also nicht als Rückhalt; so verhindert die Regel auch, dass die
   letzte dauerhafte Verwaltungsrolle zugunsten einer auslaufenden entzogen wird. Die Verwaltungsrolle wird aus den Daten abgeleitet (Gemeinsame Entscheidung 1).
   - **Grenze, benannt:** Ablauf (`expiresAt`) und Jahrgangsschluss beenden Zuordnungen ohne `revokeRole`; R-ADM-08
     verhindert das nicht, die 24-Stunden-Spanne verschiebt es nur. Deshalb gilt die Betriebsregel „den nächsten Jahrgang anlegen, bevor der laufende schließt“
     (die Erstellerzuordnung aus 040c trägt die Verwaltung hinüber) und „die Verwaltungsrolle ohne Ablauf oder mit
     Vertretung vergeben“. Beide stehen in `docs/betrieb/erstinbetriebnahme.md` (040c) und im Runbook (070).
   - **Wiederherstellung:** Der einzige Weg zurück ist der auditierte Betreiberweg aus 040c (Kommandozeile, nur mit
     Datenbankzugang, nur wenn kein nicht geschlossener Jahrgang eine tragfähige, ungesperrte Verwaltungsrolle hat (die
     Sitzung löst Rollen global auf); gesperrt heißt: Subject aus 029b gesperrt; befristete Zuordnung mit Akteur `system` und Betreiberkennung). Einen Weg über HTTP gibt
     es nicht.
4. **Testumbauten, die mehr als einen Akteurwechsel brauchen** (die Schutzwirkung jedes Tests bleibt; eine Abschwächung
   nennt der Bericht mit Datei und Testname):
   - **090 R1** (sieben Tests, `090-eingaben-je-akteur.spec.ts:371-480`). Jeder Test muss nach dem Wechsel das Feld
     **sichtbar und leer** sehen; ein fehlendes Feld zählt nicht (genau die schwache Form, die R1 ausgeschlossen hat).
     `expectCleared` wird dafür nicht gelockert.
     - Redebeitrag und freie Einzelfrage (Zeilen 371, 394): Die Felder erscheinen nur mit `question.capture`
       (`ContributionPane.tsx:137, 210`; `capture/Page.tsx:192`), das nach 040a nur `capture` hält. Der Wechsel geht
       **dauerhaft** (`setActor`, nicht nur für einen Tick) zu einer zweiten, synthetischen Person derselben Rolle,
       `{ id: 'u-cap-2', role: 'capture', displayName: 'Erfassung 2' }`; danach ist das Feld sichtbar und leer. Kein
       Rückfall auf `moderation` (sie sieht das Feld nicht).
     - Wortmeldung registrieren (Zeile 444): ebenso dauerhaft zu `{ id: 'u-mod-2', role: 'moderation', displayName:
       'Versammlungsbüro 2' }`; der Dialog ist neu geöffnet sichtbar und leer.
     - Antwortentwurf (Zeile 415): Wechsel zu `legal` (hält `answer.draft` und sieht das Formular); Feld sichtbar und leer.
     - Zusammenführen (Zeile 462): Wechsel zu `moderation`, die `question.merge` hält (`permissions.ts:30`), wenn der
       Dialog dort erscheint; sonst dauerhaft zu `u-cap-2`. Dialog sichtbar und leer.
     - Rückgabe (Zeilen 428, 478): admin behält `question.return`; die Tests bleiben unverändert.
     - `setActor` (`apps/web/src/api/actor.ts:42-51`) nimmt jedes `Actor`-Objekt, nicht nur Einträge aus
       `DEMO_ACTORS`; im Demo-Betrieb prüft der Kern eine nicht zuordnungsgebundene Identität nicht gegen eine Liste.
       Gespeichert wird nur die Rolle; nach einem Neuladen steht wieder die Demo-Person dieser Rolle da. Die Tests laden
       nicht neu, also ist keine Änderung am Code nötig. Vor dem Bau prüfen (Punkt 5): Das Leeren hängt an der Person
       (`actorKey` in `liveStore.ts:134` enthält die id); zeigt der Probelauf etwas anderes, ist die kleinste Änderung ein
       Eintrag `u-cap-2`/`u-mod-2` in `DEMO_ACTORS` (Lane web-api, dann Scope-Befund mit Nachtrag der Spec).
   - **`unrelatedEvent`** (`010c-lesezustand.spec.ts:311`) schreibt heute als admin eine Wortmeldung. Nach 040a schreibt
     es als synthetische `{ id: 'u-mod-2', role: 'moderation' }` (synchroner Wechsel bleibt, weil es nur um einen
     fremden Schreibvorgang geht, nicht um eine Anzeige); die Aufrufe in Zeilen 914 und 923 bleiben unverändert und
     erben die Umstellung.
   - **Runde 4 (A)** (`010b-lesepfade.spec.ts:743-780`): `podium` liefert aus; den fremden Schreibvorgang nebenher löst
     dieselbe synthetische `u-mod-2` aus.
   - **020 m2** (`020-rueckbau-passung.spec.ts:547-561`): Kein Demo-Akteur hält nach 040a `question.deliver` zusammen mit
     Arbeitsaktionen. Die reine Funktion `stageOnlyByRights` (`apps/web/src/features/stage/Page.tsx:84`) zieht
     unverändert nach `apps/web/src/features/stage/lib.ts` um; `lib.test.ts` prüft sie mit künstlichen Aktionslisten
     (`deliver` allein → ja; `deliver` mit `question.capture` → nein; ohne `deliver` → nein). Der e2e-Block entfällt; der
     Bericht nennt das als Verlagerung, nicht als Abschwächung.

5. **Hervorhebung administrativer Ereignisse in der Historie (Rechtekonzept §4).** Heute zeigt die Historie je Ereignis
   nur `displayName` oder die Akteur-id, nicht die Rolle (`apps/web/src/features/history/Timeline.tsx:85-86, 161-162`);
   der verlangte „herausgehobene Auditeintrag“ fehlt also. 040a ergänzt:
   - eine reine Funktion in `apps/web/src/features/history/lib.ts`, etwa `isAdministrativeRole(role)`, die über
     `hasPermission` aus den Rechtedaten (`ROLE_PERMISSIONS`, `@hv/domain`) prüft, ob die Rolle `admin.roles.manage`
     hält. Kein Rollenname als Literal (AGENTS.md R4). Sie dient nur der Anzeige, nie einer Berechtigung;
   - in beiden Darstellungen von `Timeline.tsx` (Zeile und Tabelle) neben dem Akteur ein sichtbares Abzeichen
     „Administration“ (de) / „Administration“ (en), Schlüssel `history.actor.administrative` in
     `apps/web/src/i18n/history.de.ts` und `history.en.ts`, dazu ein Schlüssel für den zugänglichen Namen
     (`history.actor.administrative.label`, etwa „Aktion der Administration“ / „Action by the administration“);
     `parity.test.ts` +2. Das Abzeichen hat Text, nicht nur Farbe (Barrierefreiheit), und `data-testid="history-admin-badge"`;
   - kein neues Ereignisfeld: `EventRead.actor.role` trägt die Rolle schon. Ein zusätzliches Kennzeichen
     `administrative: true` am Ereignis ist Eigentümerfrage 2b (Standard: nein).
   - Die Hervorhebung gilt für jedes Ereignis einer Rolle mit `admin.roles.manage`, also auch für künftige
     Verwaltungshandlungen, und für den Akteur `system` (Rolle admin) aus Seed und Bootstrap. Das ist gewollt: Auch
     Systemhandlungen sind keine fachliche Arbeit.

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

**Role × Status × Action** (`policy-truth-table.md`, Abschnitt 1): In den 22 admin-Zeilen werden **63 ✓** zu `·`, in den
Spalten q.capture (22), q.classify (4), answer.draft (5), q.submit_review (1), q.approve (1), q.legal.clear (2),
q.deliver (2), q.close (2), q.withdraw (16), q.merge (8). Unverändert bleiben q.assign (2), q.return (8), q.read (✓ in
allen Zeilen) und q.read.delivered (✓ nur in delivered und closed); q.claim und q.stage waren schon leer. Beispiel:

```
- | admin | in_review | ✓ | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | · | · | ✓ | · | ✓ | · |
+ | admin | in_review | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
- | admin | delivered | ✓ | · | · | · | · | · | · | · | ✓ | · | · | ✓ | ✓ | · | ✓ | ✓ |
+ | admin | delivered | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | ✓ |
```

Keine Zeile einer anderen Rolle ändert sich. **Role × Leserecht**, **Role × Agenda** und **Role × Identität und
Rollenverwaltung** bleiben unverändert.

**Neuer Abschnitt „Role × Wortmeldung, Erfassung und Demo“** (vom selben Test erzeugt), damit der Wegfall sichtbar ist:

| Role | speaker.register | speaker.reorder | speaker.update | contribution.capture | contribution.claim | demo.seed |
|---|---|---|---|---|---|---|
| moderation | ✓ | ✓ | ✓ | · | · | · |
| capture | · | · | · | ✓ | ✓ | · |
| coordination | · | · | · | · | · | · |
| expert | · | · | · | · | · | · |
| legal | · | · | · | · | · | · |
| approver | · | · | · | · | · | · |
| podium | · | · | · | · | · | · |
| admin | · | · | · | · | · | ✓ |
| observer | · | · | · | · | · | · |

Vorher stand admin hier auf `✓ ✓ ✓ ✓ · ✓`. Der Bericht nennt den Diff beider Abschnitte wörtlich.

## Nicht-Ziele

- Kein Vertrag, keine Operation, kein Ereignistyp. Oberfläche nur: Hervorhebung in der Historie (Punkt 5), zwei
  i18n-Schlüssel.
- Keine Einschränkung der Leserechte von admin (Eigentümerfrage 2a).
- Kein eigenes Ereignisfeld für administrative Handlungen (Eigentümerfrage 2b).
- Keine Änderung an anderen Rollenbündeln, an `READ_SCOPES`, `READ_PERMISSIONS`, der Übergangstabelle oder den Guards.
- Keine Änderung an `SYSTEM_ACTOR` oder am Seed.
- Kein Wiederherstellungsweg in dieser Scheibe (040c).
- Nichts aus 040b bis 040d.

## Files allowed

Kern:

- `packages/domain/src/permissions.ts` (nur das Bündel der Administration als ausdrückliche Liste und sein Kommentar)
- `packages/domain/src/api.ts` (nur R-ADM-07 in der Rollenzuordnung und R-ADM-08 im Entzug)
- `packages/domain/src/rules.ts` (nur R-ADM-07, R-ADM-08)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `packages/domain/src/__tests__/transitions.test.ts` (nur: neuer erzeugter Abschnitt „Role × Wortmeldung, Erfassung und Demo“)
- `packages/domain/src/__tests__/admin040a.test.ts` (neu)
- `docs/legal-trace.md` (nur regeneriert)

Bestehende Tests (nur Akteurwechsel: ein Schreibvorgang, den heute admin ausführt und danach nicht mehr darf, läuft mit
der fachlich zuständigen Rolle; eine Erwartung „admin darf“ wird „admin erhält 403 R-PERM-01“; eine Selbstzuordnung oder
ein Entzug der letzten Verwaltungsrolle im Testaufbau wird auf ein anderes Subject umgestellt; dazu die in „Ziel“,
Punkt 4 genannten Umbauten; jede andere Änderung ist ein Befund):

- `packages/domain/src/__tests__/*.test.ts`
- `apps/api/src/__tests__/*.test.ts`
- `apps/api/src/__tests__/helpers.ts` (nur Testakteure)
- `apps/web/e2e/*.spec.ts`
- `apps/web/e2e/support/*.ts` (nur Testakteure und der synchrone Akteurwechsel)

Oberfläche:

- `apps/web/src/features/stage/Page.tsx` (nur Import der verlegten Funktion)
- `apps/web/src/features/stage/lib.ts` (nur die verlegte Funktion)
- `apps/web/src/features/stage/lib.test.ts` (nur Tests der verlegten Funktion)
- `apps/web/src/features/history/Timeline.tsx` (nur das Abzeichen in beiden Darstellungen)
- `apps/web/src/features/history/lib.ts` (nur die Funktion der Hervorhebung)
- `apps/web/src/features/history/lib.test.ts` (nur Tests der Funktion)
- `apps/web/src/features/history/Timeline.test.tsx` (neu: Abzeichen sichtbar bzw. nicht vorhanden)
- `apps/web/src/i18n/history.de.ts` und `apps/web/src/i18n/history.en.ts` (nur die zwei Schlüssel)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)

Nachweis und Dokumente:

- `docs/evidence/040a-admin-ohne-schreibaktionen.png` (neu)
- `docs/evidence/040a-historie-administration-de.png` und `docs/evidence/040a-historie-administration-en.png` (neu)
- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 040a“ wie bei 025, 026, 028; er nennt: Inhaltsrechte entfallen, Weiterleiten bleibt, administrative Ereignisse sind in der Historie hervorgehoben (§4), Zurückziehen entfällt (2c))
- `docs/sicherheit/bedrohungsmodell.md` (nur T-G1-E-04, BF-09, MF-01, der Nachweis von MF-07 und die Zeile 040 der Zuordnungstabelle)
- `docs/folgeliste.md`
- `docs/slices/040a-admin-ohne-inhaltsrechte.md`

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/**`, `packages/domain/src/types.ts`, `packages/domain/src/transitions.ts`,
`packages/domain/src/seed.ts`, `apps/api/src/**` außer den Testdateien, `apps/web/src/**` außer den Dateien unter
„Oberfläche“, `scripts/**`, `docs/adr/**`, `docs/entscheidungsregister.md`, `docs/produktplan-beta.md`. Dieser Abschnitt
steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. Steht `permissions.ts:74` noch wie im Befund? Hat inzwischen eine Scheibe `PERMISSIONS` erweitert (etwa 044 mit
   `question.refuse.*`), gilt: Das neue Recht kommt **nicht** in die Liste von admin, es sei denn, dessen Spec vergibt es
   dort ausdrücklich. Melden.
2. Welche Tests schlagen nach der Änderung fehl? Die Liste (Datei, Testname, alter Akteur, neuer Akteur bzw. Umbau)
   gehört in den Bericht. Fällt ein Test in einer Datei außerhalb von „Files allowed“ um: anhalten und melden.
3. Nutzt die HTTP-Harness der e2e-Läufe (`scripts/e2e-http-031.mjs`, Lane infra) admin zum Schreiben oder ordnet sie ein
   Subject sich selbst zu? Wenn ja: anhalten und melden.
4. Ordnet ein Testaufbau (Dienst oder Postgres) ein Subject sich selbst zu (R-ADM-07) oder entzieht die letzte
   Verwaltungsrolle (R-ADM-08)? Liste in den Bericht.
5. Hängt das Leeren der Eingaben in 090 R1 an der Akteur-id (Person) oder an der Rolle? Nur im ersten Fall trägt der
   Wechsel zu einer zweiten Person derselben Rolle. Sonst anhalten und melden.
6. Sieht admin nach 040a die Erfassungsansicht noch (Zeilen 371, 394)? Ergebnis in den Bericht.

## Tests zuerst (rot, dann grün)

`packages/domain/src/__tests__/admin040a.test.ts`:

1. **Genaue Liste.** Die Menge `ROLE_PERMISSIONS.admin` ist genau die 12 Rechte aus „Ziel“.
2. **Deny by default.** Für jedes Recht in `PERMISSIONS`, das nicht in der Liste steht, liefert
   `hasPermission({role: admin}, p)` `allow: false` mit R-PERM-01 bzw. R-PERM-02 (nach `READ_PERMISSION_LIST`).
3. **Schreiben als admin, Domäne.** Auf dem Seed antworten als admin mit 403 und `ruleId` R-PERM-01, und `store.lastSeq()`
   bleibt gleich: `registerSpeaker`, `reorderSpeakers`, `updateSpeaker`, `captureContribution`,
   `captureMeetingContribution`, `captureQuestions`, `classifyQuestion`, `draftAnswer`, `submitForReview`,
   `approveQuestion`, `clearQuestionLegally`, `stageQuestion`, `deliverQuestion`, `closeQuestion`, `withdrawQuestion`,
   `mergeQuestion`. Je
   Aufruf eine Frage im passenden Status und eine gültige Eingabe, damit das Recht antwortet, nicht Tabelle oder Validierung.
4. **Weiterleiten als admin.** `assignQuestion` und `returnQuestion` gelingen; das Ereignis trägt
   `actor.role` admin und erscheint in `getQuestionHistory` für einen Halter von `history.read` (etwa `coordination`).
5. **`_actions`.** Für jede Frage des Seeds enthält `actionsFor(admin, q)` höchstens `question.assign`,
   `question.return`, `question.read`, `question.read.delivered`.
6. **Lesen und Verwaltung bleiben.** Als admin: `listSpeakers`, `listContributions`, `listQuestions`,
   `getQuestionHistory`, `getStage`, `listEvents`; `openAgendaItem` auf einem laufenden Jahrgang, `assignRole` für ein
   anderes Subject, `revokeRole` einer nicht letzten Zuordnung, `seedDemo`.
7. **R-ADM-07.** `assignRole` mit dem eigenen Subject → 409 R-ADM-07, kein Ereignis; für jede Rolle mit
   `admin.roles.manage` und als Demo-Identität.
8. **R-ADM-08.** Zwei tragfähige Zuordnungen mit Verwaltungsrolle: die erste zu entziehen gelingt, die zweite → 409
   R-ADM-08, kein Ereignis. Eine abgelaufene Zuordnung und eine, die in weniger als 24 Stunden abläuft, zählen nicht als
   Rückhalt: Neben einer solchen ist die dauerhafte Zuordnung die letzte tragfähige → 409. In einem geschlossenen Jahrgang
   greift die Regel nicht.
9. **Vier Augen unverändert.** `legal` entwirft und gibt dieselbe Version rechtlich frei → 409 R-GUARD-06; die Probe in
   `transitions.test.ts:97` bleibt.

`apps/api/src/__tests__/` (in `negative.test.ts` oder `read-rights.test.ts`, Wahl im Bericht):

10. HTTP als admin: `POST /v1/speakers`, `POST /v1/questions/{id}/answers`, `POST /v1/questions/{id}/approvals`,
    `POST /v1/questions/{id}/delivery` → 403 mit `ruleId` R-PERM-01; `GET /v1/questions` → 200; Selbstzuordnung über
    `POST /v1/meetings/{id}/role-assignments` → 409 mit `ruleId` R-ADM-07.

`apps/web/src/features/stage/lib.test.ts`:

11. `stageOnlyByRights` wie in „Ziel“, Punkt 4.

`apps/web/src/features/history/lib.test.ts` und `Timeline.test.tsx`:

12. `isAdministrativeRole` ist wahr genau für die Rollen, deren Bündel `admin.roles.manage` hält (Vergleich mit einer
    Schleife über `ROLE_PERMISSIONS` im Test, nicht mit einer Namensliste).
13. `Timeline` mit einem Ereignis von admin (Rückgabe) und einem von `legal`: genau ein `history-admin-badge`, sichtbarer Text
    „Administration“, zugänglicher Name gesetzt; in der englischen Fassung der englische Text.

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):
- Die Ableitung `...PERMISSIONS.filter(…)` wiederhergestellt → Test 1, Test 3 und der Tabellen-Snapshot rot.
- `answer.draft` in die Liste von admin → Test 1, Test 3, Tabellen-Snapshot rot.
- `question.return` aus der Liste entfernt → Test 1 und Test 4 rot.
- Prüfung R-ADM-07 entfernt → Test 7 und Test 10 rot.
- R-ADM-08 zählt abgelaufene oder bald ablaufende Zuordnungen mit → Test 8 rot.
- `question.withdraw` wieder in der Liste → Test 1, Test 3, Tabellen-Snapshot rot.
- Abzeichen in der Tabellendarstellung entfernt oder `isAdministrativeRole` immer falsch → Test 13 bzw. Test 12 rot.

## Akzeptanzkriterium

1. Die Tests 1–13 sind grün, die sieben Mutationsproben rot belegt.
2. `git diff -- packages/domain/policy-truth-table.md` zeigt genau den Diff aus „Wahrheitstabellen-Diff“: 63 ✓ → `·` in
   admin-Zeilen und den neuen Abschnitt; sonst nichts.
3. `pnpm --filter @hv/web e2e` (Projekt in-process) ist grün; das Projekt http läuft in der PR-CI grün. Die Liste der
   umgebauten e2e-Tests steht im Bericht, jede Abschwächung benannt.
4. Screenshot `docs/evidence/040a-admin-ohne-schreibaktionen.png`: Demo als Administration auf der Beantwortung mit einer
   Frage in Prüfung; sichtbar ist höchstens die Rückgabe, keine Freigabe-, Entwurfs- oder Zurückziehen-Aktion.
5. Screenshots `docs/evidence/040a-historie-administration-de.png` und `…-en.png`: Historie einer Frage, die admin
   zurückgegeben hat; das Abzeichen steht sichtbar am Ereignis der Administration, nicht an den übrigen.
6. `pnpm gates` (mit Postgres-Variablen wie in CI) ist grün, einschließlich `slice-scope` auf `claude/slice-040a-…`. Der
   Schluss der Ausgabe steht einmal im Bericht.

## Nachweise

- Liste der umgestellten Tests (Vor-dem-Bau-Punkte 2 und 4).
- Diff der Wahrheitstabelle (wörtlich).
- Ergebnis der Mutationsproben.
- Screenshots wie oben (drei).
- Schluss von `pnpm gates` mit Commit-Hash.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Rolle, Recht, Identität, Schutzklasse
- [x] Administration
- [x] Fachregel (R-ADM-07, R-ADM-08)
- [ ] Vertrag, Ereignis, Konfiguration (die 409 an `assignRole`/`revokeRole` sind schon dokumentiert)
- [ ] Persistenz
- [x] Oberfläche (weniger Aktionen für die Administration; Abzeichen „Administration“ in der Historie; eine reine Funktion zieht um)

Perspektive: Security/Admin (6.5, 6.8), Legal (Rechtekonzept §4) · Nachweise: Tests 1–13, Mutationsproben,
Wahrheitstabellen-Diff, Screenshot · Offene Entscheidung: Eigentümerfragen 2a, 2b, 2c; E25 unberührt

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Bedrohungen:**
  - **T-G1-E-04** (Administration als Inhaltskonto): Der Inhaltsteil ist geschlossen. admin kann weder erfassen noch
    entwerfen, freigeben, auf die Bühne stellen oder vorlesen. Das Weiterleiten (Zuweisen, Zurückgeben) bleibt nach Rechtekonzept §4
    und ist in der Historie mit Rolle sichtbar; die Hervorhebung steht in der Historie (Punkt 5). Über die Rollenzuordnung ist der Weg durch R-ADM-07 für eine einzelne Person
    geschlossen; zwei zusammenwirkende Verwaltungskonten bleiben ein Restrisiko (MF-01).
  - **MF-01** (Rechteerhöhung über die Rollenzuordnung): Eine Person kann sich keine Rolle mehr selbst geben und sich
    damit auch nicht über „`approver` zuordnen, eigene admin-Zuordnung entziehen, freigeben“ (`actor.ts:112-114`) zur
    Freigeberin machen. **Offen bleiben:** zwei Verwaltungskonten, die einander Rollen geben, und eine Person mit zwei
    Subjects. Beides erkennt man am Ereignis `RoleAssigned`; nach dem Freeze verlangt 040d den Override mit Grund.
  - **SG6** (Rechtezuordnung) und **SG9** (Integrität der Wahrheitstabelle): Die Liste ist ausdrücklich, jede Änderung
    erscheint im Tabellen-Diff. R-ADM-08 verhindert, dass ein Jahrgang durch Entzug ohne Verwaltung dasteht.
  - **MF-07** (Selbstfreigabe über Rollenwechsel): Der Weg über admin entfällt; R-GUARD-06 bleibt personengebunden.
  - **T-G1-E-01** (Umgehung der Oberfläche): Test 10 ruft die Operationen direkt auf.
- **Missbrauchsfälle mit Erkennung:**

  | Missbrauch | Abwehr | Erkennung, Nachweis |
  |---|---|---|
  | admin entwirft und gibt frei, ohne Rollenwechsel | kein `answer.draft`, kein `question.approve` | Test 3; verweigerter Versuch als 403 mit R-PERM-01 im Zugriffslog (033a) |
  | Neues Recht fällt still an admin (Ableitung) | ausdrückliche Liste | Test 1 mit Mutationsprobe; Tabellen-Snapshot |
  | admin ordnet sich `approver` zu, entzieht die eigene admin-Zuordnung und gibt frei | R-ADM-07 | Test 7, Test 10; verweigerter Versuch mit R-ADM-07 im Zugriffslog |
  | zwei admins geben einander `approver` | vor dem Freeze nicht verhindert; nach dem Freeze Override mit Grund (040d) | Ereignis `RoleAssigned` in `listEvents`; Alarmvorschlag an 085 „Zuordnung eines Freigabe- oder Rechtsrechts“ |
  | admin leitet eine Frage an einen fremden Fachbereich oder gibt sie immer wieder zurück, um die Beantwortung zu verzögern | erlaubt (§4); die Rückgabe verlangt einen Grund (bestehende Regel); Zurückziehen hält admin nicht mehr (2c) | Ereignis mit `actor.role` admin und Grund in der Historie der Frage, dort mit Abzeichen „Administration“ hervorgehoben (Test 13) |
  | admin entzieht die letzte Verwaltungsrolle und sperrt den Jahrgang | R-ADM-08 | Test 8 |
  | admin liefert als Podium „vorgelesen“ | kein `question.deliver` | Test 3 und Test 10 |

- **Invarianten:** admin hält kein Recht, das Text schreibt oder einen fachlichen Arbeitsschritt ausführt; nur
  Weiterleiten. Die Liste ist die einzige Quelle; `PERMISSIONS` vergibt nichts. Niemand ordnet sich selbst eine Rolle zu.
  Ein nicht geschlossener Jahrgang behält mindestens eine tragfähige Verwaltungsrolle, solange sie nicht abläuft.
- **Fehlerfall:** Wer sich am HV-Tag auf admin als Rückfallkonto für Inhalte verlässt, hat diesen Weg nicht mehr. Der
  Rückfall sind Vertretungen je Rolle (040d) und Rollenzuordnung durch ein zweites Verwaltungskonto. Das Runbook (070)
  nennt das.
- **Demo:** Die Administration sieht in der Demo nur noch Weiterleitungsaktionen; Seed und Rollenwechsel funktionieren
  wie bisher.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. `ROLE_PERMISSIONS.admin` ist eine Liste ohne `PERMISSIONS`-Ableitung. Prüfen: `git diff -- packages/domain/src/permissions.ts`.
2. Kein anderes Bündel ändert sich. Prüfen: der Tabellen-Diff zeigt nur admin-Zeilen und den neuen Abschnitt.
3. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (Tor role-literals grün); R-ADM-08 leitet die Verwaltungsrolle aus
   den Daten ab.
4. Keine Testabschwächung ohne Nennung: jede umgestellte Erwartung wechselt den Akteur, wird eine 403- bzw. 409-Erwartung
   oder ist einer der benannten Umbauten.

## Offene Eigentümerfragen (für alle vier Teile)

Keine blockiert die Specs. Frage 1 braucht vor dem ersten Bau ein ausdrückliches Go; die übrigen sind auf Standard
gebaut, mit den genannten Kosten einer späteren Änderung.

1. **Zuschnitt, Budget, Reihenfolge, Plananpassungen (Go nötig).** Standard: vier Teile a → b → c → d, rund 7,5 AStd
   statt 2,5 (a 1,5, b 1,5, c 2, d 2,5), alle hoch. Mit Go ändert der Orchestrator den Plan-Eintrag 040
   (Teilungsvermerk, Lanes: contract für b bis d, falls 043a-Frage 5 freigegeben ist; web-api für b bis d, weil `HvApi`
   wächst und `http.ts` und `liveStore.ts` es umsetzen; web-shell und web-history für die erzwungenen i18n-Schlüssel;
   web-stage für 040a; manifests für ein Skript in 040c; docs-legal, docs-sicherheit, docs-datenschutz, docs-betrieb)
   und rechnet den Kalender neu (041 rückt um etwa einen bis zwei Bautage). 040a darf vor dem 03.11. laufen. Ohne Go wird
   040 in dieser Form nicht gebaut, und der Architekt legt einen neuen Zuschnitt vor.
2. **Umfang der Administration (Rechtekonzept §4).** Entschieden und nicht Gegenstand der Frage: admin schreibt keine
   Inhalte und behält das Weiterleiten (`question.assign`, `question.return`). Offen sind nur:
   - **2a. Lesen einschränken?** Standard: admin liest weiter alles, was es heute liest. Alternative: admin verliert das
     Lesen von Inhalten (Need-to-know); nur `event.read` für das Audit bleibt. Rund 0,5 AStd (Tabellenzeilen, Tests, die
     als admin lesen). Wer entscheidet: Eigentümer mit Projektleitung; DSB sieht es mit (E14).
   - **2c. Zurückziehen durch admin?** `question.withdraw` nimmt eine Aktionärsfrage aus der Beantwortung, auch nach dem
     Vorlesen (`delivered`); das ist eine fachliche Entscheidung, kein Weiterleiten. Standard: admin verliert
     `question.withdraw`. Alternativen: (a) zurück wie heute, eine Tabellenzeile, < 0,25 AStd; (b) Zurückziehen nur vor
     dem Vorlesen, als statusgebundenes Recht wie `READ_SCOPES`, rund 0,5 AStd mit Tabellen-Diff. Wer entscheidet:
     Eigentümer mit Recht.
   - **2b. Zusätzlich ein Ereigniskennzeichen?** Die Hervorhebung nach §4 baut 040a in der Historie aus
     `actor.role` (Ziel, Punkt 5). Offen ist nur, ob das Ereignis zusätzlich `administrative: true` tragen soll, etwa für
     Export (051) und Nachbarsysteme. Standard: nein. Alternative: additives Umschlag- oder Nutzlastfeld, rund 0,5 AStd
     (Vertrag und Kern). Wer entscheidet: Eigentümer mit Recht.
3. **Start des Jahrgangs (040d).** Standard: Start nur mit eingefrorener Konfiguration (R-MTG-08) und nicht, solange ein
   anderer Jahrgang läuft (R-MTG-09), durch Halter von `agenda.manage` (heute nur admin).
   Alternative zu R-MTG-08: Start ohne Freeze erlaubt, nur Hinweis; < 0,25 AStd. Verlagerung von `agenda.manage` und
   Start an die Versammlungsleitung (`moderation`): eine Tabellenzeile, 0,25 AStd mit Tests.
4. **Rollenzuordnung nach dem Freeze (040d).** Standard: Eine neue Zuordnung nach dem Freeze geht nur über den Override
   mit Grund (R-ADM-03); Entzug ist immer frei und nie eingefroren (Ausnahme R-ADM-08). Alternative: Zuordnungen bleiben
   nach dem Freeze frei, nur ein Alarm (085) meldet sie; < 0,25 AStd. Hintergrund: MF-01 und E8 (Tabelle ist Wahrheit; ein
   späterer IdP-Abgleich müsste nach dem Freeze ebenfalls über den Override laufen).
5. **Vertretungen je Rolle (040d).** Rechtekonzept §5 (Zeilen 204-206) und der Plan verlangen mindestens zwei benannte
   Vertreter je Rolle; der Vertrag sagt „one of the two deputies“ (`openapi.yaml:2391`, wird in 040d berichtigt).
   Standard, gebaut: **Freeze nur mit mindestens zwei tragfähigen Vertretungen je Rolle mit aktiver Inhaberschaft**
   (R-ADM-10, 409), **keine Obergrenze**. Offen ist nur eine Lockerung: (a) Warnung statt Abweisung (der Freeze gelingt,
   `ConfigFrozen` nennt die Lücken), < 0,25 AStd; (b) eine Obergrenze (etwa zwei), < 0,25 AStd. Wer entscheidet:
   Eigentümer mit Projektleitung (E25).
6. **Nummernkreise (040c).** Standard: reserviert werden nur Fragenummern (F-n) je Erfassungsplatz. Alternative: auch
   Wortmeldungsnummern; additives Feld `series`, rund 0,5 AStd. Wer entscheidet: Projektleitung (welche Nummern stehen auf
   den Papiervordrucken?).

Die offene Eigentümerfrage 5 aus 043a ist keine neue Frage; der Abschnitt „Vertragsschritt und Eigentümerfrage 5 aus
043a“ beschreibt beide Wege.

## Hinweise an Folgescheiben

- **044:** `question.refuse.propose` und `question.refuse.approve` fallen nach 040a nicht mehr an admin; die
  Ausschlussliste, die 043a verlangt, ist durch die ausdrückliche Liste erledigt. 044 prüft das mit einer Zeile im
  Tabellen-Diff.
- **070 (Runbook):** admin ist kein Rückfallkonto für Inhalte; „nächsten Jahrgang vor dem Schluss anlegen“;
  Verwaltungsrolle ohne Ablauf oder mit Vertretung.
- **085:** Alarmvorschlag „`RoleAssigned` mit einem Freigabe- oder Rechtsrecht“; der frühere Vorschlag „Akteur =
  Subjekt“ entfällt, weil R-ADM-07 es verhindert. Die Erstellerzuordnung aus 040c (Akteur = Subjekt, gleiche Rolle) und
  der Bootstrap (Akteur `system`) sind ausdrücklich keine Alarmfälle dieser Regel.

## Bericht (nach Bau ausfüllen)

```
Slice: 040a-admin-ohne-inhaltsrechte
Done: ROLE_PERMISSIONS.admin ist eine ausdrückliche Liste mit 12 Rechten (Lesen, question.assign, question.return,
  agenda.manage, admin.roles.manage, demo.seed); 63 ✓ entfallen, neuer Tabellenabschnitt. R-ADM-07 (keine
  Selbstzuordnung) und R-ADM-08 (letzte tragfähige Verwaltungsrolle, 24-h-Spanne) in api.ts und im Regelregister.
  Historie: Abzeichen „Administration“ aus den Rechtedaten in Zeitleiste und Ereignisstrom; Testumbauten nach Spec.
Evidence: pnpm gates grün auf fed4b6f (Schluss unten); in-process e2e 133/133 grün auf fed4b6f;
  docs/evidence/040a-admin-ohne-schreibaktionen.png, 040a-historie-administration-de.png, -en.png
Open: http-Projekt (Keycloak) läuft in der PR-CI; drei neue Warnungen des Architekturtors (nicht blockierend,
  docs/folgeliste.md); Eigentümerfragen 1, 2a, 2b, 2c bleiben wie in der Spec.
Touched: siehe Liste unten
```

**Vor dem Bau prüfen (Ergebnisse).**
1. `permissions.ts:74` stand wie im Befund (Ableitung über `PERMISSIONS.filter(…)` plus `agenda.manage`,
   `admin.roles.manage`). `PERMISSIONS` war seit dem Befund nicht erweitert (30 Rechte, kein `question.refuse.*`).
2. Umgestellte Tests: siehe „Umgestellte Tests“. Kein Test außerhalb von „Files allowed“ fiel um.
3. `scripts/e2e-http-031.mjs` nutzt admin nicht: `PERSONS` enthält keine Administration; der Bootstrap ordnet als
   `SYSTEM_ACTOR` (id `system`) Rollen an andere Subjects zu (`actorIdForIdentity`), keine Selbstzuordnung.
4. Kein Testaufbau (Domäne, Dienst, Postgres, Strom) ordnet ein Subject sich selbst zu oder entzieht die letzte
   Verwaltungsrolle: nach der Änderung schlug kein bestehender Test mit R-ADM-07 oder R-ADM-08 fehl. Der Entzug in
   `postgres-takt033.test.ts` (`assignment-1`) und in `stream035.test.ts` (`revokeGrant`) betrifft keine letzte
   Verwaltungsrolle und bleibt unverändert als admin.
5. Das Leeren hängt an der Person: `ContributionPane.tsx:108-115` und `capture/Page.tsx:235-239` vergleichen
   `useActor().id`, die Wortmeldeliste und die Bühne sind mit `key={actorId}` gebunden, `actorKey` (`liveStore.ts:134`)
   enthält alle Felder. Der Wechsel zu `u-cap-2`/`u-mod-2` trägt; kein Eintrag in `DEMO_ACTORS` nötig (e2e grün).
   Hinweis: `u-cap-2` ist zugleich die Seed-Person „Erfassung 2“ (`seed.ts:53`, gleiche Rolle, gleicher Name); das
   ändert nichts, es bleibt eine zweite Person der Erfassung.
6. admin sieht die Erfassungsansicht weiter (Leserechte `speaker.read`, `contribution.read`, `question.read`), aber
   ohne Eingabefelder: `capture-text` und `capture-free-input` erscheinen nur mit `question.capture`. Deshalb der
   Umbau auf `u-cap-2`.

**Umgestellte Tests (mit Umbauten und Abschwächungen).** Keine Abschwächung; eine Verlagerung (020 m2).

Domäne (`packages/domain/src/__tests__/`):
- `api.test.ts` › „R-IDEM-01: the same actor key stays separate across meetings…“ und „…delimiters cannot alias
  another log scope“: admin → moderation (registerSpeaker); die Trennzeichen-Strings folgen der Akteur-id
  (`hv|admin|…` → `hv|mod|…`), damit der Aliasversuch dieselbe Form behält.
- `api.test.ts` › „409 detail (Festlegung 8)“: Leser-Hälfte admin/`deliverQuestion` → approver/`stageQuestion` (mit
  If-Match). Grund: nach 040a hält keine Rolle `question.deliver` zusammen mit `question.read`; die Aussage (Leser
  erhält R-TRANS-00 mit Stand, Nicht-Leser den generischen 409) bleibt.
- `api.test.ts` › „admin drafts and approves: 409 R-GUARD-06“ → „admin drafts: 403 R-PERM-01“ (wie in der Spec
  vorgesehen; Guard-Aussage trägt der legal-Fall, `transitions.test.ts` und Test 9).
- `envelope.test.ts` › „carries the write idempotency key…“: Aussaat als admin, registerSpeaker als moderation.
- `meeting025.test.ts` › „does not write an unscoped event…“, „keeps pre-lifecycle logs usable…“, „isolates writes,
  F-n counters…“: registerSpeaker als moderation, captureContribution/captureQuestions als capture.
- `transitions.test.ts`: neuer erzeugter Abschnitt „Role × Wortmeldung, Erfassung und Demo“.

Dienst (`apps/api/src/__tests__/`):
- `idempotency028.test.ts` › „checks the question version before the state guard for %s“: je Zeile die zuständige
  Rolle (classification coordination, answers/review-submissions expert, approvals/staging approver,
  legal-clearances legal, closure podium, withdrawal/merge moderation; assignment/returns bleiben admin).
- `meeting025.test.ts` › „exercises all canonical readers, speaker writes…“: Sprecher moderation, Beitrag capture.
- `read-rights.test.ts` › „404 precedence: podium may still deliverQuestion…“: Aufbau classify als coordination,
  staging als approver.
- `limits034a.test.ts` (Block „limits per subject“): zweites Schreib-Subject `mod2:moderation` statt admin; „dieselbe
  id unter anderer Rolle“ als `mod2:approver` statt `admin:moderation` (gleiche Aussage: Zähler je id).
- `metrics033b.test.ts` › „contains no actor id…“, „shows a new question only after the window“: Schreiber
  `${SYNTHETIC_ACTOR}:capture`, Ereignisse weiter als admin gelesen.
- `postgres027.test.ts`, `postgres-takt033.test.ts`, `postgres-takt024.test.ts`, `postgres-limits034a.test.ts`,
  `postgres-access-log033a.test.ts`: Sprecher-POSTs als moderation (12 Stellen). In `postgres027.test.ts` › „rolls back
  a failed insert…“ prüfte die letzte Erwartung die Maskierung in der Schreibantwort eines Schreibers ohne
  `question.identity.reveal`; einen solchen Schreiber gibt es nach 040a nicht mehr (moderation hält das Recht). Die
  Schreibantwort trägt jetzt den Klarnamen, die Maskierung wird auf dem Lesepfad als admin geprüft („Redner 1“) —
  Aussage erhalten, Ort gewechselt.
- `stream035.test.ts`: `PEOPLE` um `approver` und `coordination` ergänzt; `registerSpeaker(h, …)` als moderation (7
  Stellen); `questionWrite` nimmt den Schreiber (staging approver, classification coordination).
- `negative.test.ts`: neuer Test 10 (Wahl: `negative.test.ts`).

e2e (`apps/web/e2e/`):
- `090-eingaben-je-akteur.spec.ts` (090 R1): Redebeitrag und freie Einzelfrage dauerhaft zu `u-cap-2`, Wortmeldung
  dauerhaft zu `u-mod-2` (neuer Helfer `switchToPerson`, prüft `getActor().id`), Antwortentwurf zu legal,
  Zusammenführen zu moderation (Dialog erscheint dort). `expectCleared` unverändert; zusätzlich `expectVisibleAndEmpty`
  (Feld sichtbar und leer; beim Redebeitrag nach Neuöffnen des Formulars, mit `watchForSecret`). Rückgaben (428, 478)
  unverändert.
- `010c-lesezustand.spec.ts`: `unrelatedEvent` schreibt als `u-mod-2` (synchroner Wechsel wie zuvor). Zusätzlich, von
  der Spec nicht benannt, aber reine Akteurwechsel: die sechs Bühnenfälle „Ziel 6 (N1)“, „Ziel 6 (N2)“ ×2, „Ziel 6 (N3)“,
  „takt-039 minor 7“ ×2 lesen als podium statt admin vor (admin hält `question.deliver` nicht mehr).
- `010d-ansichtsdaten.spec.ts` (von der Spec nicht benannt, Akteurwechsel): `elsewhere` nimmt den Schreiber;
  registerSpeaker als `u-mod-2`, returnQuestion weiter als admin, submitForReview als Fachbereich (`u-exp-fin`).
- `010b-lesepfade.spec.ts` › „Runde 4 (A)“: podium liefert aus; der fremde Schreibvorgang als `u-mod-2`, synchron
  getauscht und zurückgesetzt.
- `020-rueckbau-passung.spec.ts` › m2: Block entfällt, Regel als Unit-Test in `features/stage/lib.test.ts`
  (Verlagerung, keine Abschwächung).
- neu `040a-administration.spec.ts`: Beantwortung als admin (nur Rückgabe) und Historie DE/EN mit Abzeichen.

**Wahrheitstabellen-Diff.** 63 ✓ → `·` nur in den 22 admin-Zeilen (q.capture 22, q.classify 4, answer.draft 5,
q.submit_review 1, q.approve 1, q.legal.clear 2, q.deliver 2, q.close 2, q.withdraw 16, q.merge 8), dazu der neue
Abschnitt; sonst nichts.

```diff
@@ -163,22 +163,22 @@ one answer version; podium-track rows are marked separately.
-| admin | captured | ✓ | · | ✓ | · | · | · | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | captured (podium) | ✓ | · | ✓ | · | · | · | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | classified | ✓ | · | ✓ | ✓ | ✓ | · | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | classified (podium) | ✓ | · | ✓ | · | · | · | · | ✓ | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | assigned | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | assigned (podium) | ✓ | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | answer_drafted | ✓ | · | · | · | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | answer_drafted (podium) | ✓ | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ | ✓ | · |
-| admin | in_review | ✓ | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | · | · | ✓ | · | ✓ | · |
-| admin | in_review (podium) | ✓ | · | · | · | · | · | · | · | ✓ | · | · | · | ✓ | · | ✓ | · |
-| admin | approved | ✓ | · | · | · | ✓ | · | · | · | ✓ | · | · | · | ✓ | · | ✓ | · |
-| admin | approved (podium) | ✓ | · | · | · | · | · | · | · | ✓ | · | · | · | ✓ | · | ✓ | · |
-| admin | staged | ✓ | · | · | · | · | · | · | · | ✓ | · | ✓ | · | ✓ | · | ✓ | · |
-| admin | staged (podium) | ✓ | · | · | · | · | · | · | · | ✓ | · | ✓ | · | ✓ | · | ✓ | · |
-| admin | delivered | ✓ | · | · | · | · | · | · | · | ✓ | · | · | ✓ | ✓ | · | ✓ | ✓ |
-| admin | delivered (podium) | ✓ | · | · | · | · | · | · | · | ✓ | · | · | ✓ | ✓ | · | ✓ | ✓ |
-| admin | closed | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ |
-| admin | closed (podium) | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ |
-| admin | withdrawn | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
-| admin | withdrawn (podium) | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
-| admin | merged | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
-| admin | merged (podium) | ✓ | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | captured | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | captured (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | classified | · | · | · | ✓ | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | classified (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | assigned | · | · | · | ✓ | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | assigned (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | answer_drafted | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | answer_drafted (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | in_review | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
+| admin | in_review (podium) | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
+| admin | approved | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
+| admin | approved (podium) | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
+| admin | staged | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
+| admin | staged (podium) | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
+| admin | delivered | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | ✓ |
+| admin | delivered (podium) | · | · | · | · | · | · | · | · | ✓ | · | · | · | · | · | ✓ | ✓ |
+| admin | closed | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ |
+| admin | closed (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ |
+| admin | withdrawn | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | withdrawn (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | merged | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+| admin | merged (podium) | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
@@ -256,0 +257,17 @@ role management is limited to administration. Both are independent of question s
+
+# Policy truth table — Role × Wortmeldung, Erfassung und Demo
+
+Scheibe 040a: rights on speaker requests, contribution capture and the demo seed; independent of
+question status. The administration holds none of the writing ones.
+
+| Role | speaker.register | speaker.reorder | speaker.update | contribution.capture | contribution.claim | demo.seed |
+|---|---|---|---|---|---|---|
+| moderation | ✓ | ✓ | ✓ | · | · | · |
+| capture | · | · | · | ✓ | ✓ | · |
+| coordination | · | · | · | · | · | · |
+| expert | · | · | · | · | · | · |
+| legal | · | · | · | · | · | · |
+| approver | · | · | · | · | · | · |
+| podium | · | · | · | · | · | · |
+| admin | · | · | · | · | · | ✓ |
+| observer | · | · | · | · | · | · |
```

**Mutationsproben (Ergebnis).** Alle auf `fed4b6f` angewendet, Tests laufen gelassen, mit `git checkout` zurückgesetzt.
- Ableitung `...PERMISSIONS.filter(…)` wiederhergestellt → rot: Tabellen-Snapshot, Test 1, 2, 3, 5; Test 10 (HTTP).
- `answer.draft` in die Liste → rot: Tabellen-Snapshot, Test 1, 2, 3, 5.
- `question.return` entfernt → rot: Tabellen-Snapshot, Test 1, 4, 5.
- Prüfung R-ADM-07 entfernt → rot: Test 7 (beide), Test 10.
- R-ADM-08 zählt abgelaufene und bald ablaufende Zuordnungen mit → rot: Test 8 „an expired assignment and one
  expiring in under 24 hours are no backing“.
- `question.withdraw` in die Liste → rot: Tabellen-Snapshot, Test 1, 2, 3, 5.
- Abzeichen in der Tabellendarstellung entfernt → rot: Test 13 „stream table“ (de, en); `isAdministrativeRole` immer
  falsch → rot: Test 12 und Test 13 (alle vier Darstellungen).

Rot vor dem Bau (Tests zuerst): `admin040a.test.ts` 10 rot / 5 grün (die grünen sind Erhaltungstests: 4, 6, 8
„nicht verwaltende Rolle“, 8 „geschlossener Jahrgang“, 9); `stage/lib.test.ts` 3 rot (`stageOnlyByRights is not a
function`); `history/lib.test.ts` 2 rot, `Timeline.test.tsx` 6 rot; Test 10 rot in den Mutationsproben 1 und 4.

**Bauentscheidungen.**
- R-ADM-07 prüft nach Rechte- und Eingabeprüfung, vor der Duplikatprüfung; Vergleich `input.subjectId === actor().id`
  (für Sitzungen die aufgelöste Identität).
- R-ADM-08: eine Zuordnung, die selbst nicht tragfähig ist (bald ablaufend), ist nie „die letzte tragfähige“ und darf
  gehen; genau 24 h Ablauf zählt als tragfähig („frühestens 24 Stunden nach now“). Status aus `Meeting['status']` in
  `['preparation', 'running']`; Verwaltungsrolle aus `ROLE_PERMISSIONS[role].includes('admin.roles.manage')`.
- Regelregister: beide als `Guard`, Quelle `Leitplanken` mit Verweis auf die Regeltabelle dieser Spec (Zeilen 102/103),
  keine erfundene Norm.
- Abzeichen: eigenes `span` mit den Klassen des Kits (`hv-badge tone-warning`), `role="note"`, `aria-label` und `title`
  mit dem Label-Schlüssel; `Badge` aus `components/` reicht `data-testid`/`aria-label` nicht durch und liegt außerhalb
  der erlaubten Dateien. In der Tabellendarstellung umschließt ein Flex-`span` Akteur und Abzeichen.
- `WORK_ACTIONS` zieht mit `stageOnlyByRights` nach `stage/lib.ts` (nur dort genutzt), unverändert.
- Architekturtor: drei neue Warnungen `web-features-i18n-domain-types-only` (Wertimport aus `@hv/domain` in
  `history/lib.ts` und zwei Testdateien, von der Spec verlangt); nicht blockierend, in `docs/folgeliste.md`.

**`pnpm gates` (Schluss, Commit):** gelaufen auf `fed4b6f` (sauberer Baum), mit `TEST_DATABASE_URL`,
`TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE` wie in CI. Zusammenfassung aus demselben Lauf: domain 276/276, web
484/484, api 587/587 (39 Dateien, operation-coverage ok), slice-scope „43 changed file(s), all within … Files allowed“.

```
✓ 1730 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-DiRcK_jR.css                        42.35 kB │ gzip:   9.10 kB
dist/assets/index-FPfXZyJ_.js                        647.06 kB │ gzip: 190.34 kB │ map: 2,750.58 kB
✓ built in 2.05s
mark-test-run: wrote /home/user/wt/s040a/.claude/state/last-test-run (clean tree) at commit fed4b6f, tree 32e4f6e81f2d…
```

**Touched.** `packages/domain/src/{permissions,api,rules}.ts`, `packages/domain/policy-truth-table.md`,
`packages/domain/src/__tests__/{admin040a (neu),transitions,api,envelope,meeting025}.test.ts`, `docs/legal-trace.md`;
`apps/api/src/__tests__/{negative,idempotency028,meeting025,read-rights,limits034a,metrics033b,stream035,postgres027,
postgres-takt033,postgres-takt024,postgres-limits034a,postgres-access-log033a}.test.ts`;
`apps/web/e2e/{040a-administration (neu),090-eingaben-je-akteur,010b-lesepfade,010c-lesezustand,010d-ansichtsdaten,
020-rueckbau-passung}.spec.ts`; `apps/web/src/features/stage/{Page.tsx,lib.ts,lib.test.ts}`,
`apps/web/src/features/history/{Timeline.tsx,Timeline.test.tsx (neu),lib.ts,lib.test.ts}`,
`apps/web/src/i18n/{history.de.ts,history.en.ts,parity.test.ts}`; `docs/evidence/040a-*.png` (drei, neu);
`docs/rollen-und-rechtekonzept.md`, `docs/sicherheit/bedrohungsmodell.md`, `docs/folgeliste.md`, diese Spec.

## Review findings

**Lesebefund der Spec (30.09.2026, zu `4fac838`):** 0 blocker, 13 major, 11 minor, 3 nit. Eingearbeitet in 040a:
Major 4 (Testumbauten 090 R1, 010b Runde 4, 020 m2), Major 5 (R-ADM-07 in 040a, MF-01 berichtigt), Major 6
(Gemeinsame Entscheidung 5: `meetingId`), Major 9 (R-ADM-08, Betriebsregel, Wiederherstellung in 040c), Major 11
(Eigentümerfrage 5 statt Obergrenze), Major 12 (Weiterleiten bleibt, Diff 47 statt 73, Eigentümerfrage 2 neu gefasst),
Major 13 (Personen einer Einheit), Major 1 (Gemeinsame Entscheidung 4), Minor 22 (Rückfall Allowlist), Minor 23
(Schätzung), Minor 25 (Allowlist je Weg), Nit 26, Nit 27. Die übrigen Punkte stehen in 040b–d.

**Nachprüfung (30.09.2026, zu `bccba04`):** 10 von 13 major erledigt; neu N1–N10. Eingearbeitet in 040a: N1 (090 R1 mit
dauerhaftem Wechsel zu synthetischen Personen derselben Rolle, Feld sichtbar und leer, kein Rückfall auf `moderation`;
`unrelatedEvent` und Zeilen 914/923 benannt; `setActor` ohne Codeänderung), N6 (`question.withdraw` entfällt,
Eigentümerfrage 2c, Diff 63, §4 „teilweise“), N10 (R-ADM-08 mit 24-Stunden-Spanne), Verweis auf die Wiederherstellung
bei gesperrten Subjects (N5, gebaut in 040c).

**Letzte Nachprüfung (30.09.2026, zu `a1395b7`):** eingearbeitet in 040a: „tragfähig“ statt „aktiv“ in Kopf und
Invariante, Budget 6,75 AStd, Verweis `permissions.ts:30` für den Zusammenführen-Test, Wiederherstellung über alle nicht
geschlossenen Jahrgänge (Umsetzung in 040c).

**Codex-Befund zu `3f04fa2` (P1-3, P1-2 für die Eigentümerfragen):** eingearbeitet: Hervorhebung administrativer Ereignisse
in der Historie aus den Rechtedaten (Ziel, Punkt 5; Tests 12–13; Screenshots DE/EN; Mutationsprobe); §4 damit erfüllt;
Eigentümerfrage 2b auf das zusätzliche Ereigniskennzeichen verkleinert; Eigentümerfrage 5 fragt nur noch nach einer
Lockerung von R-ADM-10; Budget 7,5 AStd.
