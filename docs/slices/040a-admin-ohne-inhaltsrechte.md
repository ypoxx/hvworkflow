# Scheibe 040a — Administration im Kern, Teil 1: Administration ohne Inhaltsrechte

**Status:** spec (30.09.2026; Teil 1 von 4 der geteilten Scheibe 040, Zuschnitt aller Teile im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 0,75 AStd · Plan 040: 03.11.2026 (W6); 040a hat keinen Vertragsschritt und darf früher starten, wenn der Orchestrator es einplant (Eigentümerfrage 1) · Lanes: core; service (nur Tests); e2e (nur Testakteure); docs-legal (nur Vermerk im Rechtekonzept); docs-sicherheit
**Rolle:** implementierer-backend; Review in frischem Kontext mit Perspektive Security/Admin (Rechte, Wahrheitstabelle); Lesebefund der Spec vor dem Bau; nie gebündelt (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue Regel. Angewandt werden R-PERM-01, R-PERM-02 (deny by default) und R-GUARD-06 (bleibt personengebunden). Dazu AGENTS.md R2, R3, R4, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` §5/040 (Zeile 625–630: „deny by default“, „Wahrheitstabellen-Diff für admin-Rechte“), §10 E8, E25
- `docs/rollen-und-rechtekonzept.md` Kopfvermerk Scheibe 025 („Die Inhalts- und Override-Rechte der Administration werden erst in 040 neu geordnet“), §3 Punkt 4 (deny by default), §4 („Administration ist Rechteverwaltung, nicht Inhaltsbearbeitung“), §5 Tabelle („Administration: Rechte, keine Inhalte“)
- Bedrohungsmodell SG6, SG9, T-G1-E-04, T-G1-E-01, MF-01, MF-07, BF-09
- Spec 043a (Zuschnittsregel 1, Tabelle „Vertragszeilen der Umsetzungsscheiben“, Eigentümerfrage 5, Hinweis an 044 zur Ausschlussliste von admin)
- Spec 029b, Abschnitt „Erstvergabe vor der Beta“ (Auftrag an 040: Betreiber-Bootstrap, hier in 040c)

**Depends on:** 025, 026, 028 (gemergt; Code auf `a3ba94b`)
**Perspektive:** Security/Admin · **Glossar: neue Begriffe:** nein

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
| **040a** (diese Spec) | Administration ohne Inhaltsrechte | `ROLE_PERMISSIONS.admin` wird eine ausdrückliche Liste ohne Schreibrechte auf Wortmeldungen, Redebeiträge und Einzelfragen; neuer Wahrheitstabellen-Abschnitt; Testakteure umstellen | keiner | hoch · 0,75 |
| **040b** | Stammdaten und Bühnenplätze | `replaceMeetingAgendaItems`, `replaceMeetingUnits`, `listMeetingStageSeats`, `replaceMeetingStageSeats`; `Classification.seatId` und `Question.seatId`; `counts.byUnit`/`bySeat`; Einheit „AR-Büro“ und vier Standardplätze im Seed; R-ADM-01, R-ADM-02 | ja (Architekt, erster Commit) | hoch · 1,5 |
| **040c** | Jahrgang, Erstinbetriebnahme, Nummernkreise | `createMeeting` mit Klonen und Erstellerzuordnung; Betreiber-Bootstrap (Kommandozeile) für den ersten Jahrgang und den Erst-Admin; Nummernkreise je Erfassungsplatz mit Aussparen bei der Fragenummer; R-ADM-05 | ja | hoch · 1,5 |
| **040d** | Konfigurationsfreeze, Override, Start | `freezeMeetingConfig` mit Hash (RFC 8785), `overrideMeetingConfig` mit Pflichtgrund, `startMeeting`; Rollenzuordnung nach dem Freeze nur per Override; Vertretungsregeln; keine Selbstzuordnung; R-ADM-03, R-ADM-04, R-ADM-06, R-ADM-07, R-MTG-08 | ja | hoch · 1,75 |

Summe rund 5,5 AStd statt 2,5. Die Planschätzung enthielt weder den Bootstrap aus 029b noch das Umstellen der
Testakteure, die heute admin als Allzweck-Schreiber nutzen (Befund), noch Vertragsschritt, Web-Adapter und i18n-Schlüssel
je Teil. Zuschnitt und Budget brauchen das Go des Eigentümers (Eigentümerfrage 1).

**Reihenfolge a → b → c → d, streng seriell.** Alle vier Teile berühren die Lane core (Wahrheitstabelle ist ein Snapshot,
Plan §5.1). 040a kommt zuerst:
- Es schließt T-G1-E-04 (Administration als Inhaltskonto) ohne Vertragsänderung.
- 040b bis 040d schreiben ihre neuen Tests danach gleich mit den fachlich zuständigen Akteuren. Andersherum müssten Tests
  aus b bis d, die admin als Schreiber nutzen, in a noch einmal umgestellt werden.
- Mit der ausdrücklichen Liste erhält admin die neuen Rechte aus b bis d nicht mehr still über
  `PERMISSIONS.filter(…)`. Jeder Teil vergibt sein Recht sichtbar, und der Wahrheitstabellen-Diff zeigt es.

**Allowlist.** Die sechs Einträge mit `slice` 040 laufen am 25.11.2026 ab. 040b entfernt vier davon
(`replaceMeetingAgendaItems`, `replaceMeetingUnits`, `listMeetingStageSeats`, `replaceMeetingStageSeats`), 040c
`createMeeting` und 040d `freezeMeetingConfig`. Die Teile entfernen Einträge der Planzeile 040, wie 035b den Eintrag
`streamEvents` mit `slice` 035 entfernt hat. Alle Teile müssen vor dem 25.11. gemergt sein, sonst wird
`packages/contract/scripts/check.mjs` (d) rot.

**Abnehmer.** 041 (Admin-Oberfläche) braucht b, c und d. 047 braucht die Bühnenplätze mit Person und Gerät (b). 053
braucht `counts.byUnit`/`bySeat` (b). 068 braucht die Nummernkreise (c). 044 profitiert von a: `question.refuse.*` fällt
nicht mehr über die Ableitung an admin (Hinweis unten).

### Vertragsschritt und Eigentümerfrage 5 aus 043a

043a legt fest (Zuschnittsregel 1): Ein reiner Vertragsstand erweitert kein bestehendes Anfrageschema. Neue Eingaben
kommen entweder als neue, vorab erklärte Operation oder als Vertragszeile der Umsetzungsscheibe, die der Architekt als
**ersten Commit** dieser Scheibe schreibt, **additiv** (nur optionale Felder; eine fachliche Pflicht erzwingt ein Guard mit
409). Ob Anfragezeilen so in die Umsetzungsscheiben wandern, ist Eigentümerfrage 5 von 043a und **noch nicht
beantwortet**. 040 funktioniert in beiden Fällen:

| | mit Go auf 043a-Frage 5 (erwartet) | ohne Go |
|---|---|---|
| Wer schreibt den Vertrag | der Architekt, als ersten Commit von 040b, 040c und 040d; die Planzeile 040 erhält die Lane contract | der Architekt, als eigener Vertragsschritt (Takt mit Mini-Spec des Orchestrators) unmittelbar **vor** 040b, 040c bzw. 040d |
| Neue Operationen (`listMeetingCaptureRanges`, `replaceMeetingCaptureRanges`, `overrideMeetingConfig`, `startMeeting`) | im selben Zweig mit dem Code, ohne Allowlist-Eintrag | vorab erklärt, Allowlist-Eintrag mit `slice` 040c bzw. 040d und `expires` 2026-11-25; der Teil entfernt ihn |
| Neue Ereignistypen und Antwortfelder (`Event.type`, Nutzlastschemas, `Meeting.configOverriddenAt`) | wie oben | im Vertragsschritt (Antwortseite, additiv; kein Dienst liefert sie vor dem Teil) |
| `Classification.seatId` (Erweiterung eines bestehenden Anfrageschemas) | erster Commit von 040b | **nicht** im Vertragsschritt (Regel 1). 040b projiziert `seatId` aus dem Altfeld `stageAssignment` für die vier Standardplätze; eine Klassifizierung auf einen eigenen Platz wartet auf die Scheibe, die das Feld dann trägt (Planzeile: 043, sonst 056). Die Tests mit `seatId` in der Eingabe (040b Test 6) entfallen dann und stehen im Bericht |

Der Unterschied betrifft nur, wer wann `packages/contract/**` schreibt. Kern, Dienst und Tests der Teile bleiben gleich.

### Gemeinsame Entscheidungen für alle Teile

1. **Rechte als Daten, ausdrücklich.** `ROLE_PERMISSIONS.admin` ist ab 040a eine Liste. Jeder spätere Teil fügt sein Recht
   dort sichtbar hinzu. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` und dem Demo-Rollenwechsel (AGENTS.md R4); wo ein
   Teil „die Administrationsrolle“ braucht (Bootstrap, 040c), leitet er sie aus den Daten ab.
2. **Stammdaten sind Ereignisse** mit ganzer Liste je Änderung (`AgendaItemsReplaced`, `UnitsReplaced`,
   `StageSeatsReplaced`, `CaptureRangesReplaced`). Jedes erhöht `Meeting.version` (das ETag von `getMeetingById`).
3. **Regel-ids.** Frei und geprüft am 30.09.2026 (Suche über `packages/`, `apps/`, `docs/`): R-ADM-01..07 (im Code
   unbelegt; im Vertrag nur als Beschreibung „R-ADM-01..04 (slice 040)“, R-ADM-03 dort schon als „Stammdatenänderung
   nach Freeze“) und R-MTG-08 (R-MTG-07 ist für 087 reserviert). Der Plan nennt R-ADM-01..04; die Nummern 05 bis 07 sind
   die nächsten freien, weil der Zuschnitt drei eigenständige Regeln mehr zeigt. Kein neuer R-GUARD: die nächste freie
   Nummer wäre R-GUARD-12 (R-GUARD-08/-09 für 044, R-GUARD-10 für 059, R-GUARD-11 für 043a/044).

   | Regel | Teil | Inhalt |
   |---|---|---|
   | R-ADM-01 | 040b | Die Konfiguration eines geschlossenen Jahrgangs ist unveränderlich (409): Stammdaten ab 040b, Nummernkreise ab 040c, Freeze und Override ab 040d; die Beschreibung im Regelregister nennt von Anfang an alle drei |
   | R-ADM-02 | 040b | Stammdaten, auf die etwas zeigt, bleiben (Entfernen eines referenzierten TOP, Fachbereichs oder Bühnenplatzes → 409) |
   | R-ADM-05 | 040c | Die Nummernkreis-Zugehörigkeit einer vergebenen Fragenummer ändert sich nie (409) |
   | R-ADM-03 | 040d | Nach dem Freeze ändert nur der Override die Konfiguration; der normale Weg antwortet 409 |
   | R-ADM-04 | 040d | Freeze genau einmal; Override nur bei eingefrorener Konfiguration und mit nicht leerem Grund (409) |
   | R-ADM-06 | 040d | Vertretung: Ziel hält die Rolle aktiv, höchstens zwei aktive Vertretungen, keine Selbstvertretung (409) |
   | R-ADM-07 | 040d | Keine Selbstzuordnung einer Rolle (409) |
   | R-MTG-08 | 040d | Ein Jahrgang startet nur mit eingefrorener Konfiguration (409) |

4. **Oberfläche kommt mit 041.** 040b bis 040d ändern keine Ansicht. Sie ergänzen nur die i18n-Schlüssel, die die
   erschöpfenden Zuordnungen `ACTION_KEYS`, `EVENT_KEYS` (`apps/web/src/i18n/labels.ts`) und `eventSummary.ts` für neue
   Rechte und Ereignistypen erzwingen, jeweils mit `parity.test.ts`.

## Befund (Ist-Stand, gelesen auf `a3ba94b`)

- `packages/domain/src/permissions.ts:74`: `admin` erhält **alle** `PERMISSIONS` außer `agenda.manage`,
  `admin.roles.manage`, `question.identity.reveal`, `contribution.claim`, `question.claim` und danach ausdrücklich
  `agenda.manage` und `admin.roles.manage`. admin hält damit 17 Schreibrechte auf Inhalte und Abläufe:
  `speaker.register`, `speaker.reorder`, `speaker.update`, `contribution.capture`, `question.capture`,
  `question.classify`, `question.assign`, `answer.draft`, `question.submit_review`, `question.approve`,
  `question.legal.clear`, `question.return`, `question.stage`, `question.deliver`, `question.close`,
  `question.withdraw`, `question.merge`. Dazu alle sieben Leserechte und `demo.seed`.
- Folge der Ableitung: **Jedes neue Recht in `PERMISSIONS` fällt still an admin.** Genau das nennt das Rechtekonzept §3
  Punkt 4 als häufigsten Rechte-Bug. 043a musste deshalb für 044 eine Ausschlussliste verlangen.
- `packages/domain/policy-truth-table.md:163-184`: 22 admin-Zeilen mit 73 ✓ in den 14 Schreibspalten
  (q.capture … q.merge). Die Rechte `speaker.*` und `contribution.capture` stehen in keinem Abschnitt der Tabelle; ihr
  Wegfall wäre heute unsichtbar.
- Bedrohungsmodell: T-G1-E-04 und BF-09 offen, „geplant in Scheibe 040“ (`docs/sicherheit/bedrohungsmodell.md:212, 499`).
- **Tests nutzen admin als Allzweck-Schreiber.** Grobe Zählung der Fundstellen von „admin“: `packages/domain/src/__tests__/api.test.ts`
  (52, Standardakteur `actors.admin`, Zeile 28), `apps/api/src/__tests__/stream035.test.ts` (117),
  `limits034a.test.ts` (25, `registerSpeaker` als `ACTOR.admin`), `access-log033a.test.ts` (24), `negative.test.ts`
  (26), weitere in `meeting025`, `person-roles026`, `read-rights`, `postgres-*`; e2e: `090-eingaben-je-akteur`,
  `010b`, `010c`, `010d`, `003-answers-stage`, `020-rueckbau-passung` (Negativfall „admin has question.deliver too“,
  Zeile 547), `024-ereignis-umschlag`, `031-http-betriebsart`. Nicht jede Fundstelle schreibt; die Umstellung betrifft nur
  Schreibvorgänge.
- `packages/domain/src/seed.ts:50`: `SYSTEM_ACTOR` hat die Rolle admin. Der Seed schreibt Ereignisse direkt
  (`NewEvent[]`), nicht über `can()`; die automatische Aussaat im Dienst ruft `seedDemo` und braucht nur `demo.seed`.
- `apps/web/src/api/index.ts:151-160`: Die Demo sät als admin (`demo.seed`); Standardperson der Demo ist die Erfassung
  (`apps/web/src/api/actor.ts:37`).
- `packages/domain/src/__tests__/api.test.ts:745`: „admin drafts and approves: 409 R-GUARD-06 — no role bypasses the
  guard“. Nach 040a antwortet admin dort mit 403. Die Aussage des Tests (kein Akteur umgeht den Guard) trägt weiter der
  Fall mit `legal` (Zeile 734) und die Tabellenprobe in `transitions.test.ts:97`, die `resolveTransition` ohne Rechte
  prüft.

## Ziel

admin verwaltet Rechte und Stammdaten und liest; admin schreibt keine Inhalte und bewegt keinen Vorgang.
`ROLE_PERMISSIONS.admin` ist die ausdrückliche Liste:

```
speaker.read, contribution.read, question.read, question.read.delivered, stage.read, history.read, event.read,
agenda.manage, admin.roles.manage, demo.seed
```

- Lesen bleibt unverändert (Eigentümerfrage 2: Lesen einschränken wäre eine eigene Entscheidung).
- `agenda.manage` bleibt: Tagesordnung steuern ist Ablaufsteuerung, kein Inhalt, und admin ist heute der einzige Halter.
  Eine Verlagerung an die Versammlungsleitung ist eine Tabellenzeile (Eigentümerfrage 3).
- `demo.seed` bleibt (nur Demo; 042 begrenzt es auf den Übungsmodus).
- Die Rechte aus 040b bis 040d fügen die Teile selbst hinzu.

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

**Role × Status × Action** (`policy-truth-table.md`, Abschnitt 1): In allen 22 admin-Zeilen werden die 73 ✓ der Spalten
q.capture, q.claim, q.classify, q.assign, answer.draft, q.submit_review, q.approve, q.legal.clear, q.return, q.stage,
q.deliver, q.close, q.withdraw, q.merge zu `·`. q.read (✓ in allen Zeilen) und q.read.delivered (✓ nur in delivered und
closed) bleiben. Beispiel:

```
- | admin | in_review | ✓ | · | · | · | ✓ | · | ✓ | ✓ | ✓ | · | · | · | ✓ | · | ✓ | · |
+ | admin | in_review | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | · |
- | admin | delivered | ✓ | · | · | · | · | · | · | · | ✓ | · | · | ✓ | ✓ | · | ✓ | ✓ |
+ | admin | delivered | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✓ | ✓ |
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

- Kein Vertrag, keine Operation, kein Ereignistyp, kein i18n-Schlüssel, keine Ansicht.
- Keine Einschränkung der Leserechte von admin (Eigentümerfrage 2, Alternative a).
- Kein „Administration schickt eine Frage überall hin“ mit herausgehobenem Auditeintrag (Rechtekonzept §4). Das wäre ein
  neues Recht mit eigener Übergangszeile und eigener Scheibe (Eigentümerfrage 2, Alternative b).
- Keine Änderung an anderen Rollenbündeln, an `READ_SCOPES`, `READ_PERMISSIONS`, der Übergangstabelle oder den Guards.
- Keine Änderung an `SYSTEM_ACTOR` oder am Seed.
- Nichts aus 040b bis 040d.

## Files allowed

Kern:

- `packages/domain/src/permissions.ts` (nur das Bündel der Administration als ausdrückliche Liste und sein Kommentar)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `packages/domain/src/__tests__/transitions.test.ts` (nur: neuer erzeugter Abschnitt „Role × Wortmeldung, Erfassung und Demo“)
- `packages/domain/src/__tests__/admin040a.test.ts` (neu)

Bestehende Tests (nur Akteurwechsel: ein Schreibvorgang, den heute admin ausführt, läuft mit der fachlich zuständigen
Rolle; eine Erwartung „admin darf“ wird „admin erhält 403 R-PERM-01“; jede andere Änderung ist ein Befund):

- `packages/domain/src/__tests__/*.test.ts`
- `apps/api/src/__tests__/*.test.ts`
- `apps/api/src/__tests__/helpers.ts` (nur Testakteure)
- `apps/web/e2e/*.spec.ts`
- `apps/web/e2e/support/*.ts` (nur Testakteure)

Nachweis und Dokumente:

- `docs/evidence/040a-admin-ohne-schreibaktionen.png` (neu)
- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 040a“ wie bei 025, 026, 028)
- `docs/sicherheit/bedrohungsmodell.md` (nur T-G1-E-04, BF-09, der Nachweis von MF-07 und die Zeile 040 der Zuordnungstabelle)
- `docs/folgeliste.md`
- `docs/slices/040a-admin-ohne-inhaltsrechte.md`

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/**`, `packages/domain/src/types.ts`, `packages/domain/src/transitions.ts`,
`packages/domain/src/api.ts`, `packages/domain/src/seed.ts`, `packages/domain/src/rules.ts`, `docs/legal-trace.md`,
`apps/api/src/**` außer den Testdateien, `apps/web/src/**`, `docs/adr/**`, `docs/entscheidungsregister.md`,
`docs/produktplan-beta.md`. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“.

## Vor dem Bau prüfen

1. Steht `permissions.ts:74` noch wie im Befund? Hat inzwischen eine Scheibe `PERMISSIONS` erweitert (etwa 044 mit
   `question.refuse.*`), gilt: Das neue Recht kommt **nicht** in die Liste von admin, es sei denn, dessen Spec vergibt es
   dort ausdrücklich. Melden.
2. Welche Tests schlagen nach der Änderung fehl? Die Liste (Datei, Testname, alter Akteur, neuer Akteur) gehört in den
   Bericht. Fällt ein Test in einer Datei außerhalb von „Files allowed“ um: anhalten und melden.
3. Nutzt die HTTP-Harness der e2e-Läufe (`scripts/e2e-http-031.mjs`, Lane infra) admin zum Schreiben? Wenn ja: anhalten
   und melden, die Datei liegt nicht in dieser Scheibe.
4. Stützt sich eine Oberflächenstelle darauf, dass admin schreibt (etwa ein e2e-Ablauf, der als admin eine Frage bewegt)?
   Die Oberfläche rendert nur `_actions`; ein solcher Test wird auf die zuständige Rolle umgestellt.

## Tests zuerst (rot, dann grün)

`packages/domain/src/__tests__/admin040a.test.ts`:

1. **Genaue Liste.** Die Menge `ROLE_PERMISSIONS.admin` ist genau die zehn Rechte aus „Ziel“.
2. **Deny by default.** Für jedes Recht in `PERMISSIONS`, das nicht in der Liste steht, liefert
   `hasPermission({role: admin}, p)` `allow: false` mit R-PERM-01 bzw. R-PERM-02 (nach `READ_PERMISSION_LIST`).
3. **Schreiben als admin, Domäne.** Auf dem Seed (Demo-Identität) antworten als admin mit 403 und `ruleId` R-PERM-01, und
   `store.lastSeq()` bleibt gleich: `registerSpeaker`, `reorderSpeakers`, `updateSpeaker`, `captureContribution`,
   `captureMeetingContribution`, `captureQuestions`, `classifyQuestion`, `assignQuestion`, `draftAnswer`,
   `submitForReview`, `approveQuestion`, `clearQuestionLegally`, `returnQuestion`, `stageQuestion`, `deliverQuestion`,
   `closeQuestion`, `withdrawQuestion`, `mergeQuestion`. Je Aufruf eine Frage im passenden Status, damit nicht die Tabelle
   (409) antwortet, sondern das Recht. Wo die Domäne vor `can()` die Eingabe prüft (422, Beschreibung von R-PERM-01), wird
   eine gültige Eingabe gesendet.
4. **`_actions` leer.** Für jede Frage des Seeds ist `actionsFor(admin, q)` leer; `getQuestion` als admin liefert
   `_actions: []`.
5. **Lesen bleibt.** Als admin 200 bzw. Ergebnis: `listSpeakers`, `listContributions`, `listQuestions`,
   `getQuestionHistory`, `getStage`, `listEvents`.
6. **Verwaltung bleibt.** Als admin: `openAgendaItem` auf einem laufenden Jahrgang, `assignRole` und `revokeRole`,
   `seedDemo` gelingen.
7. **Vier Augen unverändert.** `legal` entwirft und gibt dieselbe Version rechtlich frei → 409 R-GUARD-06 (bestehender
   Test bleibt grün); `resolveTransition` mit admin als Akteur auf eigener Version → R-GUARD-06 (bestehende Probe bleibt).

`apps/api/src/__tests__/` (in der bestehenden Datei `negative.test.ts` oder `read-rights.test.ts`, Wahl im Bericht):

8. HTTP als admin: `POST /v1/speakers`, `POST /v1/questions/{id}/answers`, `POST /v1/questions/{id}/approvals`,
   `POST /v1/questions/{id}/delivery` → 403 `application/problem+json` mit `ruleId` R-PERM-01; `GET /v1/questions` → 200.

`transitions.test.ts`: Der erzeugte Abschnitt „Role × Wortmeldung, Erfassung und Demo“ steht in
`policy-truth-table.md` genau wie oben.

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):
- Die Ableitung `...PERMISSIONS.filter(…)` wiederhergestellt → Test 1, Test 3 und der Tabellen-Snapshot rot.
- `answer.draft` in die Liste von admin → Test 1, Test 3, Tabellen-Snapshot rot.
- `event.read` aus der Liste entfernt → Test 1 und Test 5 rot.

## Akzeptanzkriterium

1. Die Tests 1–8 sind grün, die drei Mutationsproben rot belegt.
2. `git diff -- packages/domain/policy-truth-table.md` zeigt genau den Diff aus „Wahrheitstabellen-Diff“: 73 ✓ → `·` in
   admin-Zeilen und den neuen Abschnitt; sonst nichts.
3. `pnpm --filter @hv/web e2e` (Projekt in-process) ist grün; das Projekt http läuft in der PR-CI grün.
4. Screenshot `docs/evidence/040a-admin-ohne-schreibaktionen.png`: Demo als Administration auf der Beantwortung mit einer
   Frage in Prüfung; keine Freigabe-, Entwurfs- oder Rückgabeaktion sichtbar.
5. `pnpm gates` (mit Postgres-Variablen wie in CI) ist grün, einschließlich `slice-scope` auf `claude/slice-040a-…`. Der
   Schluss der Ausgabe steht einmal im Bericht.

## Nachweise

- Liste der umgestellten Tests (Vor-dem-Bau-Punkt 2).
- Diff der Wahrheitstabelle (wörtlich).
- Ergebnis der Mutationsproben.
- Screenshot wie oben.
- Schluss von `pnpm gates` mit Commit-Hash.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Rolle, Recht, Identität, Schutzklasse
- [x] Administration
- [ ] Vertrag, Ereignis, Konfiguration
- [ ] Persistenz
- [x] Oberfläche (nur sichtbar weniger Aktionen für die Administration; kein Code der Oberfläche)

Perspektive: Security/Admin (6.5, 6.8) · Nachweise: Tests 1–8, Mutationsproben, Wahrheitstabellen-Diff, Screenshot ·
Offene Entscheidung: Eigentümerfrage 2 (Umfang der Administration), E25 unberührt

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Bedrohungen:**
  - **T-G1-E-04** (Administration als Inhaltskonto): geschlossen für Schreibrechte. admin kann weder erfassen noch
    entwerfen, freigeben, auf die Bühne stellen oder vorlesen.
  - **SG6** (Rechtezuordnung) und **SG9** (Integrität der Wahrheitstabelle): Die Liste ist ausdrücklich, jede Änderung
    erscheint im Tabellen-Diff.
  - **MF-07** (Selbstfreigabe über Rollenwechsel): Der Weg über admin entfällt; R-GUARD-06 bleibt personengebunden.
  - **MF-01** (Rechteerhöhung über die Rollenzuordnung): **bleibt offen** bis 040d. admin kann sich heute selbst
    `approver` zuordnen und freigeben. 040d verbietet die Selbstzuordnung (R-ADM-07) und verlangt nach dem Freeze Override
    mit Grund; bis dahin erkennt man den Vorgang am Ereignis `RoleAssigned` mit `actor.id` = `payload.subjectId`.
  - **T-G1-E-01** (Umgehung der Oberfläche): Test 8 ruft die Operationen direkt auf.
- **Missbrauchsfälle mit Erkennung:**

  | Missbrauch | Abwehr | Erkennung, Nachweis |
  |---|---|---|
  | admin entwirft und gibt frei, ohne Rollenwechsel | kein `answer.draft`, kein `question.approve` | Test 3; verweigerter Versuch als 403 mit R-PERM-01 im Zugriffslog (033a) |
  | Neues Recht fällt still an admin (Ableitung) | ausdrückliche Liste | Test 1 mit Mutationsprobe; Tabellen-Snapshot |
  | admin ordnet sich `approver` zu und gibt frei | in 040a nicht verhindert | Ereignis `RoleAssigned` mit Akteur = Subjekt (Historie, `listEvents`); 040d R-ADM-07 |
  | admin schickt als Podium „vorgelesen“ | kein `question.deliver` | Test 3 und Test 8 |

- **Invarianten:** admin hält kein Recht, das einen Wortmeldungs-, Redebeitrags- oder Fragestatus ändert oder Text
  schreibt. Die Liste ist die einzige Quelle; `PERMISSIONS` vergibt nichts.
- **Fehlerfall:** Ein Betreiber, der sich am HV-Tag auf admin als Rückfallkonto für Inhalte verlässt, hat diesen Weg nicht
  mehr. Der Rückfall sind zwei Vertretungen je Rolle (040d) und Rollenzuordnung mit Grund, nicht ein Allzweckkonto.
  Das Runbook (070) nennt das.
- **Demo:** Die Administration sieht in der Demo keine Schreibaktionen mehr; Seed und Rollenwechsel funktionieren wie
  bisher.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. `ROLE_PERMISSIONS.admin` ist eine Liste ohne `PERMISSIONS`-Ableitung. Prüfen: `git diff -- packages/domain/src/permissions.ts`.
2. Kein anderes Bündel ändert sich. Prüfen: der Tabellen-Diff zeigt nur admin-Zeilen und den neuen Abschnitt.
3. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (Tor role-literals grün).
4. Keine Testabschwächung: jede umgestellte Erwartung wechselt nur den Akteur oder wird eine 403-Erwartung für admin.

## Offene Eigentümerfragen (für alle vier Teile)

Keine blockiert die Specs. Frage 1 braucht vor dem ersten Bau ein ausdrückliches Go; die übrigen sind auf Standard
gebaut, mit den genannten Kosten einer späteren Änderung.

1. **Zuschnitt, Budget, Reihenfolge, Plananpassungen (Go nötig).** Standard: vier Teile a → b → c → d, rund 5,5 AStd
   statt 2,5, alle hoch. Mit Go ändert der Orchestrator den Plan-Eintrag 040 (Teilungsvermerk, Lanes: contract für b bis d,
   falls 043a-Frage 5 freigegeben ist; web-api für b bis d, weil `HvApi` wächst und `apps/web/src/api/http.ts` es umsetzt;
   web-shell und web-history für die erzwungenen i18n-Schlüssel; docs-legal, docs-sicherheit, docs-datenschutz,
   docs-betrieb) und rechnet den Kalender neu (041 rückt um etwa einen Bautag). 040a darf vor dem 03.11. laufen. Ohne Go
   wird 040 in dieser Form nicht gebaut, und der Architekt legt einen neuen Zuschnitt vor.
2. **Umfang der Administration (Rechtekonzept §4).** Standard: admin verliert alle 17 Schreibrechte auf Inhalte und
   Abläufe; Lesen, `agenda.manage` und `demo.seed` bleiben; kein „überall hinschicken“.
   - Alternative a: admin verliert auch das Lesen von Inhalten (Need-to-know; nur `event.read` für das Audit bleibt).
     Rund 0,5 AStd (Tabellenzeilen, Tests, die als admin lesen).
   - Alternative b: admin erhält ein eigenes Recht „Vorgang umleiten“ mit herausgehobenem Auditeintrag, wie das
     Rechtekonzept §4 es als praktisch nötig beschreibt. Eigene Scheibe, rund 1,5 AStd (Recht, Übergangszeile, Ereignis,
     Oberfläche).
   - Wer entscheidet: Eigentümer mit Projektleitung; Recht sollte die Alternative b sehen.
3. **Start des Jahrgangs (040d).** Standard: Start nur mit eingefrorener Konfiguration (R-MTG-08), durch Halter von
   `agenda.manage` (heute nur admin). Alternative: Start ohne Freeze erlaubt, nur Hinweis; < 0,25 AStd. Verlagerung von
   `agenda.manage` und Start an die Versammlungsleitung (`moderation`): eine Tabellenzeile, 0,25 AStd mit Tests.
4. **Rollenzuordnung nach dem Freeze (040d).** Standard: Eine neue Zuordnung nach dem Freeze geht nur über den Override
   mit Grund (R-ADM-03); Entzug ist immer frei und nie eingefroren; niemand ordnet sich selbst eine Rolle zu (R-ADM-07).
   Alternative: Zuordnungen bleiben nach dem Freeze frei, nur ein Alarm (085) meldet sie; < 0,25 AStd. Hintergrund: MF-01
   und E8 (Tabelle ist Wahrheit; ein späterer IdP-Abgleich müsste nach dem Freeze ebenfalls über den Override laufen).
5. **Nummernkreise (040c).** Standard: reserviert werden nur Fragenummern (F-n) je Erfassungsplatz. Alternative: auch
   Wortmeldungsnummern; additives Feld `series`, rund 0,5 AStd. Wer entscheidet: Projektleitung (welche Nummern stehen auf
   den Papiervordrucken?).

Die offene Eigentümerfrage 5 aus 043a ist keine neue Frage; der Abschnitt „Vertragsschritt und Eigentümerfrage 5 aus
043a“ beschreibt beide Wege.

## Hinweise an Folgescheiben

- **044:** `question.refuse.propose` und `question.refuse.approve` fallen nach 040a nicht mehr an admin; die
  Ausschlussliste, die 043a verlangt, ist durch die ausdrückliche Liste erledigt. 044 prüft das mit einer Zeile im
  Tabellen-Diff.
- **070 (Runbook):** admin ist kein Rückfallkonto für Inhalte.
- **085:** Alarmvorschlag „`RoleAssigned` mit Akteur = Subjekt“ gilt bis 040d.

## Bericht (nach Bau ausfüllen)

```
Slice: 040a-admin-ohne-inhaltsrechte
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

**Umgestellte Tests.**

**Wahrheitstabellen-Diff.**

**Mutationsproben (Ergebnis).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
