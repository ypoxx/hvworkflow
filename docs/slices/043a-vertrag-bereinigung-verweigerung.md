# Scheibe 043a — Vertragspaket 0.4.0, Teil 1: Bereinigung und Verweigerung

**Status:** spec (30.09.2026; überarbeitet nach dem Lesebefund zu `6552a1e`: 12 major, 11 minor, 3 nit; Teil 1 der geteilten Scheibe 043, Zuschnitt aller Teile im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 1,5 AStd · 23.10.2026 (W4) laut Plan; Baustart frühestens nach Auswertung von Feedback-Runde 2, vorher nur mit Go des Eigentümers (Eigentümerfrage 1) · Lanes: contract; web-api (nur Aufhebung der lokalen Sperre für `reason`); service nur Vertragstests
**Rolle:** architect (Vertrag, CHANGELOG, Allowlist, Verweise im Register ohne Statuswechsel; erster Commit). web-implementer für die Aufhebung in `apps/web/src/api/http.ts` (zweiter Commit, nach dem Vertrag). Review in frischem Kontext mit Perspektive Vertrag (6.4), Legal (Verweigerung) und Security (Maskierung der Begründung, SG2). Vor dem Bau liest ein frischer Kontext die Spec erneut. Das Review wird nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue Regel im Kern. Dokumentiert werden R-SPK-00..05 und R-SPK-GUARD-01 (409 auf `updateSpeaker`) sowie R-PERM-01 und R-PERM-02. Für 044 reserviert und nur im Vertragstext genannt: R-GUARD-08 („Verweigerung nur mit Rechtsfreigabe-Ereignis“) und R-GUARD-09 (Grundpflicht für Pfad B); angewandt werden R-GUARD-06 und R-GUARD-07. Dazu AGENTS.md R1, R2, R4, R6, R7, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` §5.5/043, §3 „Zustandsmodell und Verweigerung“, §10 (E15, E21, E25), §11 Etappe C, Lane-Tabelle §5.1 (Zeile 286)
- ADR 0012 (Modell A), ADR 0015, ADR 0001, ADR 0002, ADR 0013
- Spec 080 (Nachtrag R1, „Open“)
- `docs/folgeliste.md`: 029a nit 6, 080 → 043, 035b „kein 500“, takt-040 nit 5, 035a nit `no-unused-components`, 034a „→ 043“
- Review 012 Punkt 18; Review 023 (keine Erweiterung bestehender Anfrageschemas durch einen reinen Vertragsstand)
- Bedrohungsmodell SG2, T-G1-I-01, T-G1-I-02, T-G1-I-04, T-G1-I-09, T-G1-E-02, T-G1-E-03, T-G1-E-04, MF-07
- Lesebefund zu Spec 043a (30.09.2026)

**Depends on:** 023, 014, 080 (alle gemergt); Vertrag 0.3.12 auf `ca94899`
**Perspektive:** Vertrag, Legal, Security · **Glossar: neue Begriffe:** nein. „Verweigerungsgrund“ (refusal ground) bleibt Arbeitsbegriff in Spec und Vertrag. Die Glossarzeile kommt mit 045, dem ersten Oberflächentext

## Teilung und Zuschnitt

Die Planzeile 043 nennt rund 40 Einzelpunkte: Schemas, Operationen, Rechte, Ereignisse, einen Systemakteur. Für 2 AStd
und einen einzigen Review ist das zu groß. Nach dem Vorbild von 035a/035b und 033a/033b wird 043 geteilt. Diese Spec
beschreibt Teil a vollständig. Die Teile b bis d stehen hier nur als Zuschnitt. Ihre Specs schreibt der Architekt, sobald
die Antworten vorliegen, auf denen sie aufbauen (Feedback-Runde 2 am 09.10., Entscheidungsstunde am 16.10.). Eigene
Stub-Dateien wären bis dahin veraltet. Die Planzeile bleibt unverändert, bis der Eigentümer den Zuschnitt freigibt
(Eigentümerfragen 2 und 5); danach ergänzt der Orchestrator den Teilungsvermerk.

### Drei Regeln für den Zuschnitt

1. **Ein reiner Vertragsstand erweitert kein bestehendes Anfrageschema.** Der Vertrag sagt das selbst in
   `info.description`, Absatz „Compatibility“ (Review 023). Der Dienst prüft jede Anfrage gegen `openapi.yaml`. Der
   Validator entfernt dabei keine Felder: Ist die Prüfung bestanden, reicht er den rohen Body weiter
   (`apps/api/src/validate.ts:47-52`). Ein neu dokumentiertes Feld würde also ab dem Merge als gültig bestätigt und käme
   beim Kern an. Der Kern kennt es noch nicht und verwirft es stillschweigend, weil er nur benannte Felder schreibt. Der
   Vertrag würde dann eine Wirkung versprechen, die es nicht gibt. Neue Eingaben kommen deshalb auf einem von zwei Wegen:
   - als **neue, vorab erklärte Operation** mit Allowlist-Eintrag in einem 043-Teil;
   - als **Vertragszeile der Umsetzungsscheibe**, die der Architekt im ersten Commit dieser Scheibe schreibt, vor jedem
     Code (AGENTS.md R6; Vorbild 035a).

   Die Tabelle unten nennt diese Zeilen. Eine solche Zeile muss **additiv** sein: nur optionale Felder oder Parameter.
   Braucht die Fachregel ein Pflichtfeld, erzwingt es der Guard der Umsetzungsscheibe mit 409 und Regel-id, nicht das
   Schema. Ein neues Pflichtfeld in einem bestehenden Anfrageschema wäre nicht additiv und bräuchte 0.5.0 und einen
   ADR-Verweis (ADR 0015).
2. **Vorab erklärt wird nur, was einen eingeplanten Abnehmer hat.** Ein Allowlist-Eintrag läuft ab, und dann wird
   `packages/contract/scripts/check.mjs`, Prüfung (d), rot. Eine Operation für eine zurückgestellte Scheibe (047, 049,
   056, 057, 058 und andere, Plan §11) würde entweder ablaufen oder ein künstlich fernes Ablaufdatum brauchen. Beides
   widerspricht ADR 0015 („keine tote Operation“).
3. **Ein Recht kommt mit der Operation, die es prüft.** Ein reiner Bezeichner ohne Operation ist seit 0.3.0 möglich
   (deny by default). Dieser Zuschnitt vermeidet ihn trotzdem, damit jedes neue `Action` einen Abnehmer hat.

### Teile, Reihenfolge, Aufwand

| Teil | Version | Thema | Inhalt aus der Planzeile 043 | Abnehmer | Klasse · AStd | Wann |
|---|---|---|---|---|---|---|
| **043a** (diese Spec) | 0.4.0 | Bereinigung und Verweigerung | Die nicht additiven Punkte: `kind`/`requestedMinutes` gestrichen, `SpeakerUpdate.reason` mit Enum, 401/422/500 nachgetragen. Dazu die Felder `answerKind`, `refusalGroundId`, `refusalGroundHash` und `refusalJustification` auf `AnswerVersion`, der Grundkatalog-Endpunkt, die Operationen „Verweigerung vorschlagen“ und „Verweigerung freigeben“, die Rechte `question.refuse.propose` und `question.refuse.approve` | 044, 045; offene Punkte aus 080, 029a, 035b, takt-040 | hoch · 1,5 | nach Feedback-Runde 2 (Eigentümerfrage 1) |
| **043b** | 0.4.x | Fragenfelder für Steuerung, Fokus, Format und Prüfung | Operation `forward` mit `question.forward` und `QuestionForwarded`; `accountable` und `language` auf `Question` (Antwortseite); Antwortformat `AnswerBody` (Blockdokument plus `text`) als Antwortfeld; Prüfliste je Pfad als Daten (Leseoperation); `parentQuestionId`/`relation` sowie die Kennzeichen `deferred`, `correctionOpen`, `followUp` als Antwortfelder mit ihren neuen Operationen; `note` hinter Konfiguration (Feld, Operation, `QuestionNoteAdded`); `cockpit.read` | 048, 053, 054, 055, 059, 061, 046 | hoch · 1,5 | nach dem 09.10., vor dem Bau von 048 |
| **043c** | 0.4.x | Partnerschnittstellen | `ingest/speech-segments` (Form nach E3a) mit `ingest.write` und `SegmentIngested`; Abonnements und Webhooks mit Signaturkopf und gebundenen Nutzlastschemas, auch `AnswerDrafted` mit den Verweigerungsfeldern; `answer-suggestions` mit `SuggestionRecorded`; Sicherheitsschema für Systemakteure (Client-Credentials oder mTLS) | 064, 065, 066 (Etappe D) | hoch · 1,5 | nach dem 16.10. (Ansprechperson E3a), parallel zu C |
| **043d** | 0.4.x | Rechtliches Protokoll, Bühne, Benachrichtigung | Verfahrensereignisse mit `procedure.record`; Export `record.json`/`record.html` mit `export.dossier` und `ExportCreated`, einschließlich der Entscheidung, ob die Begründung einer Verweigerung in die Niederschrift-Anlage gehört (Standard: nein); `NotificationRaised`/`NotificationAcknowledged`; `RemainderListConfirmed` mit `debate.close` und der Operation zum Debattenschluss; **nur die Antwort-Entität** `Delivery` (die Eingabe `versionHash`/`mode`/`deviationNote` kommt als Zeile von 049); `AnswerBundle` mit `round.assemble`; neue Operation zum Setzen von `confidentiality` (047); Rückgängig-Operation und Abdeckungsfelder für das Zusammenführen (069); Aktienregister-Lookup; Systemakteur `canary` mit Kennzeichen `synthetic` | 050, 051, 085, 087, 049, 057, 047, 069, 067, 086 | hoch · 2 (bei Bedarf wieder teilen) | erst, wenn die Abnehmer eingeplant sind (größtenteils zurückgestellt bis nach der zweiten Demo) |

Die Papierquelle steht seit 0.3.0 im Vertrag und fehlt deshalb in 043d. Die Vorabfragen-Quelle ist eine Eingabe und
kommt als Zeile von 068. Der getStage-Filter ist ein Query-Parameter einer bestehenden Operation und kommt als Zeile von
056/057.

Summe rund 6,5 AStd statt 2 AStd laut Plan. Die Planschätzung deckte die Vertragsprosa, nicht die Vertragstests und den
Review je Teil. Die Klasse steigt von mittel auf hoch: Leitplanken §4 nennen „Verweigerung“ und „Rechte“ als
Hoch-Auslöser. Das ist eine Hochstufung; das Herabstufungstor ist nicht berührt. Zuschnitt, Budget und Klasse brauchen
das Go des Eigentümers (Eigentümerfrage 2).

**Versionsstufen und ADR 0015 (Abweichung, benannt).** ADR 0015 schlägt vor: „Ein Vertragszyklus des Architekten hebt
die Minor-Stufe; eine additive Einzeländerung innerhalb eines Zyklus hebt die Patch-Stufe“. Hier wird **ein** Zyklus
(0.4) in vier Teile geschnitten. Nur Teil a hebt die Minor-Stufe, b bis d heben die Patch-Stufe, obwohl jeder ein eigener
Architektenschritt ist. Begründung: Nur Teil a ist nicht additiv. Eine Minor-Stufe je Teil würde 0.5 vor der
Alias-Streichung verbrauchen, die ADR 0015 und der Vertrag für 0.5 ankündigen. Die Abweichung geht mit ADR 0015 an
Prüfpunkt 1 (Annahme). Der Architekt ergänzt ADR 0015 nur, wenn der Eigentümer das verlangt.

**Warum diese Reihenfolge.** Etappe C beginnt mit 043, 040, 041, 044, 045 (Plan §11).
- 040 und 041 brauchen nichts aus der Planzeile 043. Ihre Admin-Operationen stehen seit 0.3.0 im Vertrag und in der
  Allowlist (`slice` 040). Was 040 zusätzlich braucht, erweitert bestehende Anfragen oder ist im Plan gar nicht 043
  zugeordnet. Das kommt nach Regel 1 als Vertragszeile von 040 (Tabelle unten; Eigentümerfrage 5).
- 044 und 045 brauchen die Verweigerung im Vertrag. Deshalb steht sie in Teil a.
- 0.4.0 ist die einzige nicht additive Stufe (ADR 0015). Sie muss vor jedem additiven 0.4.x-Teil kommen, sonst wäre die
  Minor-Stufe schon verbraucht. Deshalb trägt Teil a auch die Streichungen und Nachträge.
- 043b folgt den Abnehmern 048 bis 046 in der Reihenfolge von Etappe C. 043c bedient Etappe D, die nach 043 parallel
  laufen darf (Plan §11), sobald E3a beantwortet ist. 043d wartet auf die Einplanung seiner Abnehmer.

### Schon in 0.3.x vorhanden (wird nicht doppelt erklärt)

| Punkt der Planzeile 043 | steht seit | Fundstelle |
|---|---|---|
| Recht `agenda.manage` | 0.3.0 (023) | `Action` |
| Recht `question.identity.reveal` (Aktienregister-Lookup und Aufdecken bauen darauf auf) | 0.3.0, Nachtrag Codex | `Action` |
| `admin.override`, `question.read.protected`, `event.read.personal` (nicht in 043, aber für 043d relevant) | 0.3.0 | `Action` |
| Papierquelle: `Contribution.source` `paper`, `OccurredAtSource` `paper`/`transcript`/`device`, `lateEntry`, `lateEntryReason` | 0.3.0 und 0.3.2 (takt-016) | `Contribution`, `MeetingContributionCapture` |
| Zeit des Debattenschlusses: `Meeting.debateClosedAt`, Ereignis `DebateClosed` | 0.3.2 (takt-016) | `Meeting`, `Event.type` |
| Ereignisstrom für angemeldete Leser: `GET /stream` | 0.3.11 (035a) | `streamEvents`; 043c ergänzt nur Webhooks für Nachbarn |
| Bühnenplätze als Liste, `Question.seatId`, `counts.byUnit`/`bySeat`, Vertretungen und Ablauf der Rollenzuordnung | 0.3.0 | `StageSeat`, `Question`, `Meeting.counts`, `RoleAssignment` |
| Umschlag mit `causationId` und `idempotencyKey` (Delivery und Webhooks bauen darauf auf) | 0.3.0 | `Event` |

### Vertragszeilen der Umsetzungsscheiben (Regel 1)

Diese Punkte erweitern ein bestehendes Anfrageschema. Sie kommen nicht in einen 043-Teil, sondern als erster Commit der
genannten Scheibe. Deren Spec nennt dann `packages/contract/**` in „Files allowed“, und der Architekt schreibt diesen
Commit. Version ist jeweils die nächste freie Patch-Stufe beim Merge. **Jede Zeile ist additiv:** optionale Felder oder
Parameter; eine fachliche Pflicht erzwingt der Guard der Scheibe mit 409 und Regel-id. Das ist eine Planabweichung
(Eigentümerfrage 5).

| Feld oder Parameter | bestehende Operation | Umsetzungsscheibe | Pflicht über Guard? | Bemerkung |
|---|---|---|---|---|
| `Classification.seatId` | `classifyQuestion` | 040 | nein | Die Beschreibung von `Classification.stageAssignment` nannte bisher 043; 043a berichtigt den Text |
| Start-Aktion des Jahrgangs, Nummernkreise je Erfassungsplatz, Grund für `admin.override` | neu bzw. Admin-Operationen | 040 | Grund: ja (409) | im Plan nicht 043 zugeordnet (Planzeile 040, takt-019 Ziel 2) |
| `SpeakerOrder.reason` | `reorderSpeakers`, `reorderMeetingSpeakers` | 080c | ja, ab Runde 2 (409) | Plan 080c sagt „Vertrag 0.4.0 aus 043“ |
| `QuestionCapture.parentQuestionId`, `relation` | `captureQuestions` | 046 | nein | |
| `accountable` und `language` als Eingabe, falls nicht über eigene Operation | `classifyQuestion` | 048 | nein (Standard: Bühnenplatz bzw. `de`) | 043b entscheidet: eigene Operation oder diese Zeile |
| `AnswerDraft.body` (Blockdokument) | `draftAnswer` | 055 | nein (`text` bleibt Pflicht) | 043b liefert das Schema `AnswerBody` und das Antwortfeld |
| Prüfpunkte der Rechtsfreigabe | `clearQuestionLegally` | 059 | ja, R-GUARD-10 (409) | 043b liefert die Leseoperation der Prüfliste |
| Body von „Vorgelesen“ (`versionHash`, `mode`, `deviationNote`, `occurredAt`) | `deliverQuestion` | 049 | `deviationNote` bei `mode: deviation`: ja (409) | 043d liefert nur die Antwort-Entität `Delivery` |
| Query `seat`, `bundleId`, `strategy` | `getStage`, `getMeetingStage` | 056, 057 | nein | |
| `source` `submitted` mit Frist und `madeAccessible` | `captureMeetingContribution` | 068 | Frist: ja (409) | |

**Regel-ids für Folgescheiben:** Der Plan nennt R-TRANS-13 für das Weiterleiten und R-TRANS-14..16 für die Kennzeichen.
Im Code sind R-TRANS-13 und R-TRANS-14 schon vergeben (`packages/domain/src/transitions.ts:578, 596`). Jede Folgespec
vergibt deshalb **die nächste freie Nummer zum Zeitpunkt, an dem sie geschrieben wird** (heute wäre das R-TRANS-15), nicht
die Nummer aus dem Plan. Die veralteten Verweise stehen an diesen Stellen: ADR 0012:53, Register E5, Plan Zeilen 198,
674, 686, 1083 und Eintrag 069. 043a trägt sie als Folgelisten-Eintrag ein und vergibt selbst keine Nummer.

## Befund (Ist-Stand, gelesen auf `ca94899`)

- **Vertrag 0.3.12**, 66 Operationen. Allowlist: sechs Einträge, alle `slice` 040, Ablauf 25.11.2026.
- **`kind` und `requestedMinutes`** sind veraltet seit 0.2.0. Sie stehen noch in `Speaker`, `SpeakerRegistration`
  (beide) und `SpeakerUpdate` (`requestedMinutes`). Der Kern kennt sie seit 080 nicht mehr (`packages/domain/src/types.ts`
  ohne beide Felder). `registerSpeaker` und `updateSpeaker` schreiben nur benannte Felder ins Ereignis
  (`packages/domain/src/api.ts:804-828` und 843-873), ein weiter gesendetes `kind` erreicht das Log also nicht.
  - Tests, die die Felder noch senden oder prüfen: `apps/api/src/__tests__/negative.test.ts:172, 190, 240-249, 254, 285`
    und `apps/api/src/__tests__/contract.test.ts:175-186`.
  - Die Web-Oberfläche sendet keines der beiden Felder.
- **`SpeakerUpdate.reason`** (`'follow_up'`, R-SPK-05 mit R-SPK-GUARD-01). Der Kern kennt den Grund seit 080
  (Domänentyp `packages/domain/src/types.ts:301-306`). Der Validator lässt ihn heute durch, weil `SpeakerUpdate` Zusatzfelder
  nicht verbietet. Im Vertrag steht er nicht.
  - Der Web-Client im Dienstmodus **sperrt `reason` lokal**: `apps/web/src/api/http.ts:621-625` antwortet ohne Anfrage mit
    422 und `http.unsupported`. Festgeschrieben ist das in `apps/web/src/api/http.test.ts:192-196` und 311-319.
  - Folge: R-SPK-05 ist im Dienstmodus über die Oberfläche nicht erreichbar, auch wenn der Vertrag den Grund
    aufnimmt. Heute sendet keine Oberflächenstelle `follow_up` (keine Fundstelle außerhalb der Tests). Die Aufhebung ist
    trotzdem Teil von 043a: Die Sperre verweist ausdrücklich auf „einen späteren Vertrag“, und das ist 0.4.0.
  - Der Schlüssel `http.unsupported` (`apps/web/src/i18n/shell.de.ts:27`, `shell.en.ts:29`) wird danach nicht mehr
    verwendet.
- **Fünf undokumentierte Status aus Review 012 Punkt 18** stehen als Ausnahme in
  `apps/api/src/__tests__/helpers.ts:80-99` (`UNDOCUMENTED_STATUS_EXCEPTIONS`):
  - 401 auf den 29 Operationen aus 0.2 (`OPERATIONS_0_2`, Zeilen 58-67);
  - 422 auf `listQuestions`, `returnQuestion` und `withdrawQuestion`;
  - 409 auf `updateSpeaker`.

  Der Test „the exception list names only … statuses the contract does not document“ (`contract.test.ts:359-366`) wird
  rot, sobald der Vertrag einen dieser Status dokumentiert und die Ausnahme bleibt. Vertrag und Ausnahmeliste ändern sich
  also im selben Commit.
- **500:** Keine Operation dokumentiert 500 (Folgeliste 035b). Der Dienst antwortet mit genau vier `detail`-Texten:
  - `Event seq N: integrity check failed.` (`apps/api/src/app.ts:688`, verletzte Kette);
  - `Persistence outcome is unknown.` (Zeitgeber während COMMIT; der Client liest vor einem erneuten Schreiben);
  - `Persistence is unavailable.` (`app.ts:697`);
  - `An unexpected error occurred.` (`apps/api/src/problem.ts:37`, globales `onError`).

  `onError` gilt global, also auch für `/metrics`: Ein fehlgeschlagener Scan antwortet mit 500
  (`apps/api/src/__tests__/metrics033b.test.ts:122-133`).
- **Verweigerung:** Weder im Vertrag noch im Kern gibt es `answerKind`, einen Grundkatalog oder die Rechte
  `question.refuse.*`.
  - Lesepfade, über die eine Antwortversion heute läuft: `Question.answers` (`getQuestion`, `listQuestions`,
    `listMeetingQuestions`, jede schreibende Operation mit `QuestionUpdated`), `StageView` (`getStage`,
    `getMeetingStage`), die `AnswerDrafted`-Nutzlast in `getQuestionHistory` (`api.ts:1047`, alle Halter von
    `history.read`), `listEvents`, `streamEvents` (`event`-Nachrichten), später der Export (043d).
  - `maskEvent` (`packages/domain/src/stream.ts:169-188`) maskiert statisch über `MASKED_KEYS` und kennt den Leser
    nicht. Er kann also nicht nach Recht maskieren.
  - `ROLE_PERMISSIONS.admin` ist „alle `PERMISSIONS` außer einer Liste“ (`packages/domain/src/permissions.ts:74`) und
    hält deshalb auch `question.legal.clear`.
- **Bekannter Präzedenzfall, richtig gelesen:** Die Anmerkung der Rechtsfreigabe steht in
  `QuestionLegalClearedPayload.note` und ist für jeden Leser der Historie sichtbar. `LegalClearance` (Antwortseite der
  Frage) trägt sie nicht. Für die Begründung einer Verweigerung ist das **kein** Vorbild, sie ist strenger zu schützen
  (SG2).
- **Beschreibungen, die 0.4.0 berichtigt:**
  - `components/responses/Unauthorized` nennt 401 auf 0.2-Operationen noch undokumentiert.
  - `components/responses/StreamUnavailable` sagt „both causes“, `RetryAfter` zählt drei (takt-040 nit 5).
  - `Classification.stageAssignment` nennt `seatId` mit 043.
  - `Role` sagt, das Bündel von `coordination` „arrives with slice 021“; es ist gebaut.
  - `info.description`, Absatz „Compatibility“, spricht vom 0.3.x-Zyklus.
- **Veraltete Kommentare im Kern** (nicht in dieser Scheibe änderbar): `packages/domain/src/types.ts:304` („Domain only
  until contract 0.4.0“) und `packages/domain/src/api.ts:860-867` („fields the contract still accepts“).

## Ziel und Entscheidungen vor Bau

Vertrag 0.4.0 enthält die nicht additiven Punkte und die Vertragsform der Verweigerung (ADR 0012, Modell A). Der Kern
und der Dienst ändern sich nicht. Nur Vertragstests, die Ausnahmeliste und die lokale Sperre im Web-Client folgen.

### 1. Streichungen und Einengungen (nicht additiv, ADR 0015)

- `Speaker.kind`, `Speaker.requestedMinutes`, `SpeakerRegistration.kind`, `SpeakerRegistration.requestedMinutes` und
  `SpeakerUpdate.requestedMinutes` werden gestrichen, ebenso der Kommentar zu `kind` über `Speaker.required`.
  - Ein Client, der die Felder weiter sendet, erhält keine 422. Der Validator lässt das unbekannte Feld durch, und der
    Kern verwirft es, weil er nur benannte Felder schreibt (Befund).
  - Kein `additionalProperties: false` an bestehenden Schemas: Das würde ältere Clients ohne Not brechen.
- `SpeakerUpdate.reason`: `{ type: string, enum: [follow_up] }`.
  - Beschreibung: Pflicht für `finished → waiting` (R-SPK-05, Guard R-SPK-GUARD-01, sonst 409). Bei jedem anderen
    Übergang wird der Grund verworfen und nicht geschrieben. Ein anderer Wert ist 422.
  - Das engt ein, was der Validator bisher angenommen hat, und gehört deshalb in 0.4.0.
- **Aufhebung der lokalen Sperre (web-api, zweiter Commit):** `updateSpeaker` in `apps/web/src/api/http.ts` sendet
  `reason` an den Dienst wie jedes andere Feld. Die beiden Tests in `http.test.ts` prüfen dann den gesendeten Body mit
  `reason: 'follow_up'`; das Ergebnis heißt `'success'` statt `'local_reject'` (`WriteOutcome`, `http.ts:44`). Der
  JSDoc-Satz in `http.ts:27` („the speaker reopen reason“) entfällt. Wird `http.unsupported` danach nirgends mehr
  verwendet, entfällt der Schlüssel in beiden Sprachdateien.

### 2. Nachträge dokumentierter Status (Antwortseite, additiv, aber im selben Schritt)

- `'401': { $ref: '#/components/responses/Unauthorized' }` auf allen 29 Operationen aus `OPERATIONS_0_2`.
- `'422'` (`Unprocessable`) auf `listQuestions`, `returnQuestion` und `withdrawQuestion`.
- `'409'` (`Conflict`) auf `updateSpeaker`. Die Beschreibung nennt R-SPK-00 (keine Zeile) und R-SPK-GUARD-01 (Grund fehlt
  bei R-SPK-05).
- Neue gemeinsame Antwort `InternalError`: 500, `application/problem+json`, `Problem` mit `status: 500`, Kopf
  `X-Server-Time`.
  - Die Beschreibung nennt die vier `detail`-Texte aus dem Befund wörtlich. Bei `Persistence outcome is unknown.` liest
    der Client, bevor er erneut schreibt. `Retry-After` gibt es bei keiner der vier.
  - **`seq` im `detail` ist offengelegt und bleibt:** Die globale Folgenummer ist kein Geheimnis. Jeder Leser erhält sie
    ohnehin als `id` der `change`- und `cursor`-Nachrichten auf `/stream` (R-PERM-04). Die Beschreibung sagt das. Sonst
    stehen im `detail` kein Stack, keine Verbindungsdaten und keine internen Kennungen.
  - `InternalError` wird auf **jeder Operation** dokumentiert: unter `/v1` wie auch auf `getMetrics`, `getHealth`,
    `getReadiness` und den `/auth/*`-Operationen (Vorbild 034a mit 503 `PersistenceBusy`). Begründung: `onError`
    (`apps/api/src/app.ts:716`) gilt global. Jede Route, auch `/healthz` und `/readyz`, antwortet bei einer unerwarteten
    Ausnahme mit 500 `An unexpected error occurred.`. Eine Ausnahme je Route gibt es nicht.
- `UNDOCUMENTED_STATUS_EXCEPTIONS` wird dadurch leer (`{}`). Export, Typ und Prüfung bleiben, damit eine künftige
  Ausnahme wieder begründet eingetragen werden kann. Der Kommentar nennt 0.4.0 als Ende der fünf Lücken.

### 3. Verweigerung als Antwortart (ADR 0012 Modell A; auf Standard gebaut, siehe „Standards“)

**Schemas**

- `AnswerKind`: `enum: [answer, refusal_no_claim, refusal_with_ground]`.
  - `refusal_no_claim` ist Verweigerungspfad A („kein Auskunftsanspruch“).
  - `refusal_with_ground` ist Verweigerungspfad B („Verweigerung trotz Anspruchs“, mit Grund aus dem Katalog).
  - Die Beschreibung grenzt beide Pfade von den Antwortpfaden A/B/C (`Track`) ab.
- `AnswerVersion` erhält vier **optionale** Antwortfelder. `required` bleibt `[version, text, createdAt, createdBy]`.
  - `answerKind` (`AnswerKind`); fehlt es, gilt `answer`.
  - `refusalGroundId` (string, maxLength 128).
  - `refusalGroundHash` (`Sha256Hex`): der Wert von `RefusalGround.hash` des gewählten Eintrags **beim Vorschlag**. Das
    ist der **Audit-Pfad des Katalogs** (Entscheidung und Definition unten).
  - `refusalJustification` (string): die Begründung, eine Rechtseinschätzung (SG2). Maskiert nach der Regel unten.
  - Invarianten (Antwortseite, `if`/`then`):
    - Ist `answerKind` `answer` oder fehlt es, erscheint keines der drei `refusal*`-Felder.
    - Bei `refusal_with_ground` sind `refusalGroundId` und `refusalGroundHash` Pflicht. `refusalJustification` bleibt
      wegen der Maskierung optional.
    - Bei `refusal_no_claim` erscheinen weder `refusalGroundId` noch `refusalGroundHash`. Ob Pfad A eine Begründung
      braucht, ist die offene Frage an Recht (E15, ADR 0012).
- `LegalRef`, gleich dem Domänentyp `packages/domain/src/rules.ts:36-45`:
  - `required: [source, citation, docVersion, docHash, verified]`;
  - `source`: string ohne Enum. Die Beschreibung verweist auf die geschlossene Liste `LegalSource`, damit eine neue Quelle
    keinen Vertragszyklus kostet;
  - `citation`: string;
  - `docVersion` und `docHash`: `type: [string, 'null']`;
  - `verified`: boolean.
  - **Bewusste Erweiterung gegenüber dem Domänentyp:** Im Kern sind `docHash` heute das Literal `null` und `verified`
    das Literal `false`. Der Vertrag erlaubt string bzw. `true`, weil die Rechtsprüfung (076) genau diese Werte setzt.
    Ohne die Erweiterung bräuchte 076 einen Vertragszyklus.
- `RefusalGround`: `required: [id, title, stageText, legalRef, hash]`.
  - `id`: maxLength 128.
  - `title`.
  - `stageText`: Formulierungsbaustein für die Bühne.
  - `legalRef`: `LegalRef`.
  - `hash`: `Sha256Hex`. **Definition:** SHA-256, hexadezimal in Kleinbuchstaben, über die UTF-8-Bytes der
    kanonischen Form nach RFC 8785 (JSON Canonicalization Scheme) des `RefusalGround`-Eintrags **ohne** das Feld `hash`
    selbst. Die Definition ist also nicht zirkulär.
  - Die Texte sind Inhalt in der Inhaltssprache des Jahrgangs (E21: `de`), keine Oberflächentexte. Das Kennzeichen
    „ungeprüft“ leitet die Oberfläche aus `legalRef.verified === false` ab (045, i18n).
- `RefusalProposal`, der Body der neuen Operation: `required: [answerKind, text]`, **`additionalProperties: false`**.
  - `answerKind`: `enum: [refusal_no_claim, refusal_with_ground]`, **ohne** `answer`.
  - `text`: 1–20000. Der Wortlaut für die Bühne; die Oberfläche füllt ihn aus `stageText` vor.
  - `refusalGroundId`: maxLength 128.
  - `refusalJustification`: 1–4000.
  - `sources`: wie in `AnswerDraft`.
  - `if answerKind = refusal_no_claim then not required [refusalGroundId]`: Ein Grund bei Pfad A ist ein
    Kategorienfehler und antwortet mit 422 vom Validator. Will Recht für Pfad A Gründe zulassen (E15), fällt diese
    Bedingung weg. Das wäre eine Erweiterung, mit Umsetzung in einer Patch-Stufe.
  - **Keine bedingte Pflicht für Pfad B im Schema.** Fehlen bei `refusal_with_ground` Grund oder Begründung, antwortet
    der Guard R-GUARD-09 mit 409 (Plan 044), nicht der Validator mit 422.
  - Ein unbekanntes `refusalGroundId` ist 422. 044 bestätigt das oder meldet einen Befund.
- Body von `approveRefusal`: `{ answerVersion }` wie bei `approveQuestion`, mit `additionalProperties: false`.

**Operationen**, alle neu und vorab erklärt (Allowlist, `slice` 044):

| operationId | Methode und Pfad | Body | Recht (ab 044) | Wirkung (ab 044) | Antworten |
|---|---|---|---|---|---|
| `listRefusalGrounds` | `GET /refusal-grounds` (global, ohne Jahrgang) | — | lesbar für Halter von `question.read`, `question.read.delivered` oder `stage.read`, also für jeden, der eine Verweigerung sehen darf, **ausdrücklich auch der Beobachter** (`question.read.delivered`). Das ist vertretbar: Der Katalog ist allgemeiner Inhalt (Titel, Formulierungsbaustein, Normzitat) und keine Rechtseinschätzung zu einer Frage. SG2 (`docs/sicherheit/bedrohungsmodell.md:85`) schützt die Begründung der einzelnen Verweigerung, nicht den Katalog | Katalog aus `packages/domain/src/refusalGrounds.ts` (044), jeder Eintrag mit `hash` | 200 (Array aus `RefusalGround`), 401, 403, 408, 429, 500, 503 |
| `proposeRefusal` | `POST /questions/{questionId}/refusals` | `RefusalProposal` | `question.refuse.propose` | Eine neue, unveränderliche Antwortversion mit `answerKind` ≠ `answer`, geschrieben als `AnswerDrafted`. Kein neuer Ereignistyp: Eine Verweigerung ist technisch eine Antwortversion (ADR 0012). Der Übergang folgt der Tabelle aus 044 | wie `draftAnswer` plus 401 und 500. Die 409-Beschreibung nennt R-GUARD-09 und die Übergangszeilen aus 044 |
| `approveRefusal` | `POST /questions/{questionId}/refusal-approvals` | `{ answerVersion }` | `question.refuse.approve` | Geschrieben als `QuestionApproved`, gebunden an die Version. Ab 044 ist `approveQuestion` auf einer Verweigerungsversion 409, `approveRefusal` auf einer Antwortversion ebenfalls 409 | wie `approveQuestion` plus 401 und 500. Die 409-Beschreibung nennt R-GUARD-06 (Vier-Augen), R-GUARD-08 (Rechtsfreigabe-Ereignis) und die Zeile aus 044 |

Parameter der beiden schreibenden Operationen: `IdempotencyKey`, `CsrfToken`, `IfMatchRequired`, wie bei `draftAnswer`.
Vorlage der Antwortliste ist `clearQuestionLegally` (hat 401), dazu 500. Das prüft der Test „every status the generic
layer can produce is documented“ (`contract.test.ts:347-357`).

**Warum eigene Operationen, statt `draftAnswer` und `approveQuestion` zu erweitern:**
- (a) Regel 1 des Zuschnitts. Felder in `AnswerDraft` kämen heute beim Kern an und würden verworfen. Eine Verweigerung sähe
  dann aus wie eine Antwort. Genau das verbietet ADR 0012 („aus einer Verweigerung wird nie eine Antwort“).
- (b) Ein Recht, eine Operation. `_actions` und die Wahrheitstabelle (Rolle × Status × Aktion) bilden
  `question.refuse.propose` und `question.refuse.approve` ohne Fallunterscheidung ab.

Die Alternative (bestehende Operationen, Recht nach Antwortart) spart 044 etwa 0,25 AStd Dienst- und Adaptercode. Dafür
bekäme die Verweigerung bis 044 einen stillen Annahmepfad.

**Audit-Pfad des Katalogs (Entscheidung): `refusalGroundHash` auf der Antwortversion statt eines Katalogs je Jahrgang.**
- Der Katalog ist Code-Datum (`refusalGrounds.ts`) und ändert sich mit der Rechtsprüfung (076).
- Ohne Festhalten ließe sich später nicht belegen, welcher Wortlaut und welches Zitat bei der Freigabe galten.
- Ein optionales Antwortfeld mit dem Hash des Eintrags ist additiv-sicher. Es macht jede Verweigerung gegen eine
  Katalogfassung prüfbar und braucht keinen neuen Pfad.
- **Wann der Nachweis entsteht:** Der Hash wird **beim Vorschlag** festgehalten. Bei der Freigabe (`approveRefusal`)
  prüft 044 ihn gegen den **aktuellen** Katalog. Hat sich der Eintrag seit dem Vorschlag geändert, antwortet
  `approveRefusal` mit 409. Die Regel-id ist **R-GUARD-11** (hier reserviert: R-GUARD-10 ist im Plan für die Prüfliste aus 059 vergeben, R-GUARD-08/-09 sind belegt). Die Verweigerung muss
  dann neu vorgeschlagen werden, und die Freigabe gilt nie einem Wortlaut, den niemand vorgeschlagen hat.
- **Wo alte Einträge wiederzufinden sind:**
  - Primär enthält die `AnswerDrafted`-Nutzlast von `proposeRefusal` additiv einen Schnappschuss `answer.refusalGround`
    mit `title`, `stageText` und `legalRef` des Eintrags beim Vorschlag. Beschrieben ist er in der `Event`-Beschreibung
    von 043a; gebunden wird er im Nutzlastschema von 043c, geschrieben von 044. Daraus lässt sich der Hash jederzeit neu
    berechnen.
  - Sekundär bleibt die Git-Historie von `packages/domain/src/refusalGrounds.ts`.
- `text` und `refusalJustification` der Version schützt die Hash-Kette der Ereignisse: `hash`/`prevHash` im
  gespeicherten Original, in `EventRead` als `sourceHash`. Der Katalog-Hash deckt nur den Katalogeintrag ab.
- Kosten jetzt: 0 AStd Vertrag über diese Spec hinaus. 044 berechnet Hash, Schnappschuss und Freigabeprüfung, etwa
  0,5 AStd.
- Verworfen: `GET /meetings/{meetingId}/refusal-grounds`. Das kostet rund 0,5 AStd mehr (Katalog in den
  Jahrgangsstammdaten, Kopplung an den Konfigurationsfreeze aus 040) und belegt trotzdem nicht, welcher Eintrag der
  einzelnen Verweigerung zugrunde lag.

**Maskierung der Begründung (`refusalJustification`, SG2), gebaut in 044, festgelegt hier.**
- Leserkreis: nur Halter von `question.refuse.propose` oder `question.refuse.approve`, nach Standard also `legal`,
  `coordination` und `approver`.
  - **Nicht** über `question.legal.clear`, sonst läse admin mit (`permissions.ts:74`).
  - **admin ist ausdrücklich ausgeschlossen** (Rechtekonzept §4, `docs/rollen-und-rechtekonzept.md:173`: „Administration ist Rechteverwaltung, nicht Inhaltsbearbeitung“; §5, Tabelle Zeile 202: „Administration: Rechte, keine Inhalte“). 044 nimmt
    `question.refuse.*` in die Ausschlussliste von admin auf.
- Die Regel gilt für **jeden Lesepfad**, und der Vertrag nennt sie an jeder Stelle:
  - `Question.answers`: `getQuestion`, `listQuestions`, `listMeetingQuestions` und jede Antwort `QuestionUpdated`. Das Feld
    fehlt für andere Leser.
  - `StageView` (`getStage`, `getMeetingStage`): fehlt immer. Das Podium hält kein `refuse.*`.
  - `EventRead` (`getQuestionHistory`, `listEvents`, `event`-Nachrichten von `streamEvents`): **fehlt immer, für jeden
    Leser.** Im Schema steht `payload.answer.properties.refusalJustification: false`, wie `createdBy.personId: false`. Diese
    Maskierung ist statisch, weil `maskEvent` den Leser nicht kennt. Berechtigte Leser sehen die Begründung über
    `Question.answers`.
  - Export (043d): Standard nein; 043d entscheidet mit Perspektive Legal.
- Das gespeicherte Original-Ereignis trägt die Begründung (Append-only, R7) und ist über die Hash-Kette geschützt. Die
  Begründung verlässt den Dienst nur über `Question.answers` an Halter von `refuse.*`.
- **Suche:** `listQuestions` mit `q` durchsucht heute `answers[].text` (`packages/domain/src/api.ts:702`). 044 darf
  `refusalJustification` nie in diesen Suchtext aufnehmen. Sonst verriete ein Treffer die Begründung (T-G1-I-04).
- `refusalGroundId`, `refusalGroundHash` und `text` werden nicht maskiert: Der Grund ist Katalogdatum, `text` ist der
  Wortlaut für die Bühne.
- Die Beschreibung von `Event` nennt die Verweigerungsfelder der `AnswerDrafted`-Nutzlast (`answer.answerKind`,
  `answer.refusalGroundId`, `answer.refusalGroundHash`, Schnappschuss `answer.refusalGround`; `answer.refusalJustification`
  nur im gespeicherten Original). Ein
  gebundenes Nutzlastschema für `AnswerDrafted` folgt mit 043c (Webhooks).

**Rechte.** `Action` erhält `question.refuse.propose` und `question.refuse.approve`. Beschreibung: „Since 0.4.0
(identifiers only; granted in `ROLE_PERMISSIONS` by slice 044, deny by default until then; never granted to admin)“.
Standard nach E25 und ADR 0012: propose bei `legal` und `coordination`, approve bei `approver`. `_actions` einer Frage
enthält sie ab 044 nach Tabelle und Guards (R-GUARD-08, R-GUARD-09).

### 4. Beschreibungen

- `info.version` 0.4.0.
- Absatz „Compatibility“: Der 0.3.x-Zyklus ist abgeschlossen. 0.4.0 ist die nicht additive Stufe mit den Streichungen
  aus Ziel 1. Innerhalb von 0.4.x gelten dieselben additiven Regeln wie bisher. Dazu der Satz aus Regel 1: Eine spätere
  Anfragezeile ist optional, eine Pflicht erzwingt ein Guard. Die Aliaspfade, `StageAssignment` und
  `EventActor.displayName` bleiben bis 0.5.
- Neuer Absatz „Refusal (since 0.4.0, slice 043a; behaviour from slice 044)“: Modell A, eigene Operationen, Audit-Hash
  und die Maskierungsregel mit allen Lesepfaden.
- `Unauthorized`, `StreamUnavailable`, `Classification.stageAssignment` (`seatId` kommt mit dem Vertragsschritt von
  040) und `Role` (`coordination` seit 021 gebaut) werden berichtigt.

### 5. CHANGELOG, Allowlist, Typen, Register

- **`packages/contract/CHANGELOG.md`:** `## [0.4.0] - <Merge-Datum>` mit diesen Unterabschnitten, je Punkt mit der
  umsetzenden Scheibe:
  - `### Removed`: Ziel 1, mit Verweis auf ADR 0015 und die Veraltung in 0.2.0;
  - `### Changed`: Einengung von `reason`, Beschreibungen;
  - `### Added`: Status, `InternalError`, Verweigerung.

  Dazu der Vermerk „auf Standard gebaut“ aus dem Abschnitt „Standards“.
- **`packages/contract/allowlist.json`:** drei neue Einträge `listRefusalGrounds`, `proposeRefusal` und
  `approveRefusal`.
  - Je `slice` `044` und `expires` `2026-11-27` (Plan 044: 06.11.2026 plus drei Wochen, wie 040 mit 03.11. zu 25.11.).
  - `reason` nennt Scheibe und Recht.
  - Die sechs Einträge von 040 bleiben unverändert.
- **Typen:** `pnpm contract:types` regeneriert `packages/contract/src/types.ts`. Der Diff gehört als Auszug in den Bericht.
- **`docs/entscheidungsregister.md`** (durch den Orchestrator mit dem Merge):
  - **Kein Statuswechsel.** Nach der Registerregel wechselt der Status nur „mit dem Merge der genannten Scheibe“.
    043a ist in keiner Zeile genannt: E15 nennt 011, 044, 052, 076; E21 nennt 055; E25 nennt 021, 059
    (`entscheidungsregister.md:50, 56, 60`). „(Vertragsform)“ ist keine der vier festen Statusformen, und den Standard
    von E21 baut 043a nicht. Die Statuswechsel kommen mit 044.
  - Erlaubt ist nur ein Verweis in einer Textspalte: „Betroffene Scheibe(n)“ von E15 und E25 erhält „043a (Vertragsform)“,
    und Zeile S6 (ADR 0012) erhält in ihrer Textspalte den Verweis auf 043a.
  - Keine andere Zeile, keine Statusspalte.

## Versionierung und Tore (ADR 0015)

- **Vertragstor** (`packages/contract/scripts/check.mjs`, in `pnpm -r test`):
  - (a) `info.version` = `package.json`-Version = 0.4.0.
  - (b) CHANGELOG-Abschnitt `## [0.4.0]`.
  - (c) Gegenüber der Merge-Basis mit dem Integrationszweig ist 0.4.0 > 0.3.12. In CI gilt `CONTRACT_GATE_STRICT=1`,
    dort ist ein Überspringen rot.
  - (d) Allowlist: wohlgeformt, jede `operationId` existiert, **kein Eintrag abgelaufen**. Am 27.11.2026 wird (d) rot,
    wenn 044 die drei Einträge bis dahin nicht entfernt hat. Das erzwingt die Entscheidung „bauen oder aus dem Vertrag
    nehmen“.
- **Was das Tor nicht sieht:** Ob eine Änderung nicht additiv ist, erkennt es nicht; es prüft nur „höher“. Die nicht
  additive Natur belegen:
  - der Minor-Sprung;
  - der Abschnitt `### Removed` mit ADR-Verweis;
  - der Reviewer, der die Streichliste gegen den Diff abgleicht (jede Streichung muss seit mindestens einem Zyklus
    veraltet sein);
  - die Tests 2 und 10 mit ihren Mutationsproben.
- **Abdeckungstor** (`apps/api/src/__tests__/operation-coverage.setup.ts`): Die drei neuen Operationen sind vorab erklärt
  und werden nicht ausgeübt. Im Dienst sind sie nicht montiert, ein Aufruf endet im 404 des Fallbacks. Das Tor meldet
  einen Fehler, wenn eine vorab erklärte Operation doch ausgeübt wird.
- **Demo und Dienst bleiben gleich (ADR 0002):** 043a ändert weder `HvApi` noch Domänentypen. Beide Betriebsarten führen
  denselben Kern aus.
  - Laufzeitwirkung im Dienst hat nur der Validator: `kind` und `requestedMinutes` werden nicht mehr geprüft (ignoriert
    statt 422), `reason` wird gegen das Enum geprüft (anderer Wert 422 statt Verwerfen im Kern).
  - Im Web-Client (Dienstmodus) fällt die lokale Sperre für `reason`. Damit ist R-SPK-05 in beiden Betriebsarten gleich
    erreichbar.
  - Die Demo im Browser validiert nicht gegen den Vertrag (bekannte, hingenommene Abweichung, Folgeliste 034a). Bei
    `finished → waiting` mit falschem Grund antwortet sie im Kern mit 409 R-SPK-GUARD-01, bei anderen Übergängen
    verwirft sie den Grund. Fachlich ist das gleich: Kein ungeprüfter Grund landet im Log.
  - Die neuen Operationen gibt es in beiden Betriebsarten erst mit 044. 044 erweitert `HvApi`, den In-Process-Adapter
    und `apps/web/src/api/http.ts` gemeinsam.

## Nicht-Ziele

- Kein Kern- und kein Dienstcode. Keine Änderung an `ROLE_PERMISSIONS`, `PERMISSIONS`, `READ_PERMISSIONS`,
  `MASKED_KEYS`, der Übergangstabelle, dem Regelregister oder der Wahrheitstabelle.
- Im Web nur die Aufhebung der lokalen Sperre (Ziel 1), kein Oberflächentext außer der Streichung des unbenutzten
  Schlüssels.
- Nichts aus 043b–d (Zuschnitt oben). Keine Vertragszeile einer Umsetzungsscheibe, auch nicht `Classification.seatId`.
- Keine Erweiterung eines bestehenden Anfrageschemas. Die einzige Änderung an bestehenden Anfrageschemas ist die
  Streichung und Einengung aus Ziel 1.
- Keine Streichung von Aliaspfaden, `StageAssignment` oder `EventActor.displayName` (bis 0.5).
- Kein neuer Ereignistyp, keine Änderung an `StreamTopic`.
- Die vier `no-unused-components`-Meldungen für die `Stream*`-Schemas (Folgeliste 035a) bleiben hingenommen. OpenAPI 3.1
  kann SSE-Nachrichten nicht anders ausdrücken.
- Grenzen der Anfrageschemas im Kern der Demo (Folgeliste 034a, dort „→ 043“): Das ist Domänencode, kein Vertrag. 043a
  lenkt den Eintrag auf „Takt core“ um.
- Keine Änderung an ADR 0015 oder ADR 0012 (Abweichung und Verweise gehen an Prüfpunkt 1 bzw. auf die Folgeliste).

## Files allowed

Vertrag (Architekt, erster Commit, vor jedem anderen Schritt):

- `packages/contract/openapi.yaml`
- `packages/contract/CHANGELOG.md` (Abschnitt 0.4.0)
- `packages/contract/package.json` (nur `version`)
- `packages/contract/src/types.ts` (nur regeneriert mit `pnpm contract:types`)
- `packages/contract/allowlist.json` (nur die drei neuen Einträge mit `slice` 044)

Vertragstests (nur so weit, wie der Vertrag sie mitzieht):

- `apps/api/src/__tests__/contract-043a.test.ts` (neu)
- `apps/api/src/__tests__/helpers.ts` (nur `UNDOCUMENTED_STATUS_EXCEPTIONS` und sein Kommentar)
- `apps/api/src/__tests__/contract.test.ts` (nur die Versionszeile und der Block `requestedMinutes` in Zeilen 175-186)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-016-contract.test.ts` (nur die Versionsprüfung; sie verlangt heute eine Version 0.3.x und wird mit 0.4.0 rot; Nachtrag aus der Spec von 040, 30.09.2026)
- `apps/api/src/__tests__/negative.test.ts` (nur die `kind`-Stellen)

Web-Client (web-implementer, zweiter Commit, nach dem Vertrag):

- `apps/web/src/api/http.ts` (nur die lokale Sperre in `updateSpeaker` und der JSDoc-Satz in Zeile 27)
- `apps/web/src/api/http.test.ts` (nur die beiden Tests zur Sperre, Zeilen 192-196 und 311-319)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur Streichung von `http.unsupported`, falls
  unbenutzt)

Dokumente:

- `docs/slices/043a-vertrag-bereinigung-verweigerung.md` (diese Spec: Bericht, Review findings)
- `docs/folgeliste.md` (nur: die von 043a erledigten Einträge abhaken, 034a „→ 043“ umlenken, die drei neuen Einträge aus
  „Folgelisten-Einträge“ unten, neue nicht blockierende Befunde)
- `docs/entscheidungsregister.md` (nur durch den Orchestrator mit dem Merge und nur Textspalten: „043a“ in „Betroffene
  Scheibe(n)“ von E15 und E25 und der Verweis in S6; keine Statusspalte, siehe Ziel 5)
- `docs/produktplan-beta.md` (nur nach dem Merge durch den Orchestrator und nur so weit, wie der Eigentümer die Fragen 2
  und 5 freigegeben hat: Teilungsvermerk im Eintrag 043, Vermerke aus Eigentümerfrage 5, Stand-Zeile Etappe C)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/domain/**` (auch `permissions.ts`, `transitions.ts`, `rules.ts`, `types.ts`, `stream.ts`, der künftige
`refusalGrounds.ts`), `packages/domain/policy-truth-table.md`, `docs/legal-trace.md`, `apps/api/src/**` außer den oben
genannten Testdateien, `apps/web/**` außer den vier oben genannten Dateien, `docs/adr/**`, die sechs Allowlist-Einträge
von 040. Dieser Abschnitt steht bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt
liest.

## Vor dem Bau prüfen

1. **Stand des Integrationszweigs.** Steht er noch auf Vertrag 0.3.12 mit sechs Allowlist-Einträgen?
   - Ist inzwischen ein anderer Vertragsstand gemergt (etwa ein Takt oder der Vertragsschritt von 040), baut 043a darauf
     auf. 043a bleibt 0.4.0, solange 0.4.0 frei ist. Ist 0.4.0 schon vergeben: anhalten und melden.
   - Die erwartete Zahl in Akzeptanzkriterium 3 ist „Einträge beim Baustart + 3“. Heute sind das 9.
2. `UNDOCUMENTED_STATUS_EXCEPTIONS` enthält genau die fünf Lücken aus dem Befund. Weicht die Liste ab, gilt der Code;
   melden.
3. `registerSpeaker` und `updateSpeaker` schreiben nur benannte Felder (`api.ts:804-828` und 843-873). Ist das nicht so:
   anhalten. Dann könnte ein ungeprüftes `kind` ins Log gelangen (R7), und das wäre ein Blocker für Ziel 1.
4. Ein PATCH mit leerem Body `{}` auf `/v1/speakers/{id}` antwortet 200 ohne Ereignis und ohne neue Version (takt-015).
   Das ist der Ersatz für den `requestedMinutes`-Block in `contract.test.ts`. Ist es anders, den Block mit dem
   tatsächlichen Verhalten neu fassen und im Bericht nennen.
5. Fängt eine Route mit eigenem `servers`-Eintrag Fehler selbst ab, sodass `onError` sie nicht erreicht? Dann bleibt 500
   trotzdem dokumentiert (Ziel 2): die Antwort ist nur unwahrscheinlicher, nicht ausgeschlossen. Befund in den Bericht.
6. Wird `http.unsupported` außer in `http.ts:624` noch verwendet? Wenn ja, bleibt der Schlüssel.
7. Weichen Zeilenangaben ab: melden und anhalten.

## Tests zuerst (rot, dann grün)

`contract-043a.test.ts`, gegen das geladene `openapiDoc` und über `req()`:

1. `info.version` ist 0.4.0.
2. `Speaker`, `SpeakerRegistration` und `SpeakerUpdate` haben weder `kind` noch `requestedMinutes`.
3. `SpeakerUpdate`:
   - `properties` ist genau `{status, round, reason}`, und `reason` hat das Enum `[follow_up]`;
   - `updateSpeaker` dokumentiert 409;
   - HTTP: PATCH mit `reason: 'x'` → 422;
   - `finished → waiting` mit `reason: 'follow_up'` → 200;
   - `finished → waiting` ohne Grund → 409 mit `ruleId` **R-SPK-GUARD-01** (Guard `isFollowUp`, `packages/domain/src/transitions.ts:674-675`, an der Zeile R-SPK-05).
4. Jede Operation aus `OPERATIONS_0_2` dokumentiert 401. `listQuestions`, `returnQuestion` und `withdrawQuestion`
   dokumentieren 422. `UNDOCUMENTED_STATUS_EXCEPTIONS` ist leer.
5. `InternalError`:
   - jede Operation dokumentiert 500 mit `InternalError`, auch `getHealth`, `getReadiness`, `getMetrics` und `/auth/*`;
   - die Beschreibung enthält die vier `detail`-Texte aus dem Befund.
6. `AnswerKind` hat genau die drei Werte, und `AnswerVersion.required` ist unverändert. Ajv-Prüfung der Antwortseite,
   **ausgehend von einer vollständigen gültigen `AnswerVersion`** (`version`, `text`, `createdAt`, gültiger `createdBy`).
   Jede Probe ändert nur die `refusal*`-Felder:
   - Grundfall ohne `answerKind`: gültig;
   - `answerKind: 'answer'` plus `refusalGroundId: 'g'`: ungültig;
   - `refusal_with_ground` mit `refusalGroundId` und `refusalGroundHash`, ohne Begründung: gültig;
   - `refusal_with_ground` ohne `refusalGroundHash`: ungültig;
   - `refusal_with_ground` ohne `refusalGroundId`: ungültig;
   - `answer` mit `refusalJustification`: ungültig;
   - `answer` mit `refusalGroundHash`: ungültig;
   - `refusal_no_claim` mit `refusalGroundId`: ungültig;
   - `refusal_no_claim` nur mit `refusalJustification`: gültig.
7. `RefusalProposal`:
   - `answerKind` hat kein `answer`, und `additionalProperties` ist `false`;
   - `{answerKind: 'refusal_with_ground', text: 'x'}` ist **gültig** (Grund und Begründung erzwingt der Guard mit 409,
     nicht das Schema);
   - `{answerKind: 'answer', text: 'x'}` ist ungültig;
   - `{answerKind: 'refusal_no_claim', text: 'x', refusalGroundId: 'g'}` ist ungültig;
   - ein unbekanntes Feld ist ungültig.
8. Die drei Operationen:
   - `listRefusalGrounds`, `proposeRefusal` und `approveRefusal` existieren mit den Pfaden und Antworten aus Ziel 3;
   - jede steht in `allowlist.json` mit `slice` `044` und `expires` `2026-11-27`;
   - der Body von `approveRefusal` hat `additionalProperties: false`.
9. `Action` enthält `question.refuse.propose` und `question.refuse.approve`.
10. **Keine stille Erweiterung (Regel 1).** Exakte Eigenschaftslisten:
    - `AnswerDraft` = `{text, sources}`;
    - Body von `approveQuestion` = `{answerVersion}`;
    - `Classification` = `{track, agendaItemId, stageAssignment}`;
    - `SpeakerRegistration` = `{displayName, organisation, round}`.
11. HTTP: `POST /v1/speakers` mit `kind: 'space-alien'` → 201. Weder die Antwort noch das Ereignis `SpeakerRegistered`
    (gelesen über `listEvents` als admin) tragen `kind`.
12. `LegalRef`:
    - `required` ist genau `[source, citation, docVersion, docHash, verified]`;
    - `{…, docVersion: null, docHash: null, verified: false}` ist gültig;
    - ohne `docHash` ist es ungültig.
13. `EventRead`:
    - `payload.answer.properties.refusalJustification` ist `false`;
    - ein `EventRead` mit `payload.answer.refusalJustification` ist ungültig.
14. `RefusalGround.required` enthält `hash`, und `AnswerVersion.properties.refusalGroundHash` verweist auf `Sha256Hex`. Die
    Beschreibung von `RefusalGround.hash` nennt RFC 8785, UTF-8, Kleinbuchstaben-Hex und „ohne `hash`“.

**Mutationsproben** (im Bericht mit dem Ergebnis „rot“ belegt, danach zurückgesetzt):
- `kind` wieder in `SpeakerRegistration` → Test 2 und Test 10 rot.
- `answerKind` in `AnswerDraft` → Test 10 rot.
- `if`/`then` aus `AnswerVersion` entfernt → Test 6 rot.
- `refusalJustification: false` aus `EventRead` entfernt → Test 13 rot.

**Anpassungen an bestehenden Tests:**
- `negative.test.ts`: Die `kind`-Hälfte des 422-Tests (Zeilen 240-249) entfällt, die `status`-Hälfte bleibt; der Fall
  wandert als Test 11 hierher. In den übrigen Bodies entfällt `kind: 'shareholder'`.
- `contract.test.ts`: Der Block der Zeilen 175-186 sendet `{}` statt `{ requestedMinutes: 7 }` (Vor-dem-Bau-Punkt 4), und
  der Kommentar nennt 0.4.0.
- `http.test.ts`:
  - Der erste Test (Zeilen 192-196) prüft den gesendeten Body mit `reason: 'follow_up'` (eine Anfrage, Methode PATCH).
  - Der zweite Test (Zeilen 311-319) erwartet `['local_reject', 'success']` und genau eine Anfrage. Der CSRF-Teil
    ohne Sitzung bleibt `local_reject`.

## Akzeptanzkriterium

1. `pnpm contract:lint` ist grün. Erlaubt sind nur die sechs heute bekannten `no-unused-components`-Meldungen (die vier
   `Stream*`-Schemas aus 035a sowie `Event` und `oidc`, Stand `ca94899`); keine neue kommt hinzu.
2. `pnpm contract:types` erzeugt den eingecheckten Stand. Ein zweiter Lauf ergibt keinen Diff.
3. `check.mjs` meldet (a)–(d) `ok`, darunter `(c) … version 0.3.12 -> 0.4.0` und `(d) … N pre-declared operation(s)` mit
   N aus Vor-dem-Bau-Punkt 1 (heute 9).
4. Grün sind: die Tests 1–14 und die vier Mutationsproben (rot belegt), `contract.test.ts`, `negative.test.ts`,
   `http.test.ts` und das Abdeckungstor.
5. `git diff` gegen die Merge-Basis zeigt Änderungen nur in den Dateien aus „Files allowed“. Kein bestehendes
   Anfrageschema hat ein neues Feld (Test 10).
6. `pnpm gates` (mit Postgres-Variablen wie in CI) ist grün, einschließlich `slice-scope` auf dem Zweig
   `claude/slice-043a-…`. Der Schluss der Ausgabe steht einmal im Bericht.

## Nachweise

- Ausgabe von `pnpm contract:lint` und `check.mjs` (Auszug).
- Typen-Diff: `git diff --stat` und die Hunks von `packages/contract/src/types.ts` für `AnswerKind`, `AnswerVersion`,
  `LegalRef`, `RefusalGround`, `RefusalProposal`, `Speaker*`, `Action`, `EventRead`.
- CHANGELOG-Abschnitt 0.4.0 (Pfad und Überschrift).
- Allowlist-Diff mit drei Zeilen, Ablauf 2026-11-27.
- Ergebnis der vier Mutationsproben.
- Schluss von `pnpm gates` mit Commit-Hash.
- Kein Screenshot: Keine Oberfläche ändert sich sichtbar. Die Aufhebung im Client hat keinen Oberflächenpfad.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch (Hochstufung gegenüber Plan „mittel“)

Ausgelöst:
- [x] Vertrag, Ereignis, Konfiguration
- [x] Rolle, Recht, Schutzklasse (zwei neue Bezeichner; Maskierungsregel für SG2 über alle Lesepfade)
- [x] Fachregel (Verweigerung, Form)
- [ ] Persistenz (kein neues Ereignis, keine Migration)
- [ ] Oberfläche

Perspektive(n): Vertrag (6.4), Legal, Security (6.5) · Nachweise: Tests 1–14, Mutationsproben, Tore · Offene Entscheidung:
E15, E21, E25, ADR 0012 (Standards unten)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** Die Scheibe legt die Vertragsform der Verweigerung fest (Leitplanken §4: „Freigabe, Verweigerung“). Sie
  führt zwei Rechtebezeichner ein, legt eine Maskierungsregel für eine Rechtseinschätzung fest und ist die erste nicht
  additive Vertragsstufe seit 0.2.0.
- **Rechte-Diff vor dem Bau: leer.** `ROLE_PERMISSIONS` und die Wahrheitstabelle bleiben unverändert, beide neuen
  Bezeichner sind bis 044 deny by default. Vorschau für 044 (nicht Teil dieser Scheibe): propose an `legal` und
  `coordination`, approve an `approver`, **ausdrücklich nicht an `admin`**.
- **Bedrohungen, die 043a berührt** (SG2, T-G1-I-01, T-G1-I-02, T-G1-I-04, T-G1-I-09, T-G1-E-02, T-G1-E-03, T-G1-E-04,
  MF-07):
  - **SG2** (Rechtseinschätzungen): Die Begründung ist neu im Vertrag. 043a legt die Maskierung für alle Lesepfade fest,
    044 setzt sie durch.
  - **T-G1-I-01** (Lesen ohne Recht): Historie, `listEvents` und Strom liefern die Begründung nie (Schema-`false`).
  - **T-G1-E-02** (Selbstfreigabe) und **MF-07** (Selbstfreigabe über Rollenwechsel oder Vertretung): `approveRefusal`
    unterliegt R-GUARD-06, die 409-Beschreibung nennt es.
  - **T-G1-E-03** (Rechtstor umgehen): R-GUARD-08 vor jeder Freigabe einer Verweigerung; kein Eilpfad.
  - **T-G1-I-02** (Massenlesen über `listEvents`): Die Begründung fehlt in jedem `EventRead` (Schema-`false`).
  - **T-G1-I-09** (SSE als eigene Leseschnittstelle): `event`-Nachrichten sind `EventRead`, dasselbe Schema-`false`.
  - **T-G1-E-04** (Administration als Inhaltskonto): admin erhält weder `refuse.*` noch den Leserkreis der Begründung.
  - **T-G1-I-04** (Ableitung über Suche): `refusalJustification` kommt nie in den Suchtext von `listQuestions`
    (`api.ts:702`, Hinweis an 044).
- **Missbrauchsfälle, mit Erkennung:**

  | Missbrauch | Abwehr | Erkennung, Nachweis |
  |---|---|---|
  | Verweigerung über `draftAnswer` eingeschleust, mit `answerKind` im Body, am Recht `question.refuse.propose` vorbei | `AnswerDraft` hat kein `answerKind` (Regel 1, Test 10); ab 044 schreibt `draftAnswer` immer `answer` | Test 10 mit Mutationsprobe; 044: Negativtest „`draftAnswer` mit `answerKind: refusal_*` erzeugt keine Verweigerung“ |
  | Begründung über die Historie gelesen (`getQuestionHistory` mit `history.read`, ohne `refuse.*`) | `EventRead` verbietet das Feld (Test 13) | 044: Negativtest für einen Halter von `history.read` ohne `refuse.*` |
  | Begründung über `listEvents` oder `/stream` gelesen (admin mit `event.read`) | dasselbe Schema-`false` | 044: Negativtests `listEvents` und `/stream` als admin |
  | Begründung als admin über `getQuestion` gelesen | Leserkreis ohne `question.legal.clear`; admin ausgeschlossen | 044: Negativtest admin → Feld fehlt |
  | Selbstfreigabe der eigenen Verweigerung, auch über Vertretung | R-GUARD-06 an `approveRefusal` | 044: Vier-Augen-Negativtest; verweigerter Versuch als 409 mit Regel-id im Zugriffslog (033a) |
  | Verweigerung freigegeben ohne Rechtsfreigabe-Ereignis (T-G1-E-03) | R-GUARD-08 an `approveRefusal` (409), kein Eilpfad | 044: Negativtest `approveRefusal` ohne `QuestionLegalCleared` für diese Version → 409 R-GUARD-08; verweigerter Versuch mit Regel-id im Zugriffslog (033a) |
  | Begründung über die Suche erschlossen (`listQuestions?q=…`, T-G1-I-04) | `refusalJustification` nie im Suchtext | 044: Negativtest „Suchbegriff nur aus der Begründung → kein Treffer“ |
  | Grund später im Katalog geändert, alte Verweigerung verweist auf neuen Text | `refusalGroundHash` beim Vorschlag, Prüfung gegen den aktuellen Katalog bei der Freigabe (409), Schnappschuss im Ereignis | 044: Test „Hash der Version ≠ Hash des geänderten Eintrags“ |

- **Kompatibilität:**
  - Wer `kind` oder `requestedMinutes` sendet, bricht nicht; die Felder werden ignoriert.
  - Wer `kind` oder `requestedMinutes` in Antworten erwartet, bekommt sie seit 080 ohnehin nicht mehr.
  - Wer `reason` mit einem anderen Wert als `follow_up` sendet, bekommt jetzt 422. Heute sendet kein Client `reason`: Die
    Web-Oberfläche hat keine Stelle dafür, und der HTTP-Client sperrte das Feld bisher lokal.
  - Partner (ADR 0008) gibt es noch keine; die Zwei-Zyklen-Regel gilt ab 043c.
- **Invarianten:**
  - keine Anfrageerweiterung ohne Umsetzung (Test 10);
  - keine Verweigerung als bloßes Feld einer Antwort (eigene Operationen);
  - keine Begründung in einem Ereignis an irgendeinen Leser (Test 13);
  - keine Begründung an Leser ohne `refuse.*` (Beschreibung; Umsetzung und Negativtests in 044).
- **Fehlerfälle:**
  - Eine abgelaufene Allowlist macht `check.mjs` (d) rot. Das ist gewollt.
  - Ein vergessener Nachtrag in der Ausnahmeliste macht `contract.test.ts` rot. Deshalb ändern sich beide im selben
    Commit.
- **Doku- und Betriebswirkung:** keine Betriebsänderung. `docs/integration/` gibt es noch nicht (064); der CHANGELOG ist
  die Partnerdoku.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. **Kein neues Recht ist vergeben.** Prüfen: `git diff -- packages/domain` ist leer.
2. **Ein ignoriertes `kind` erreicht das Log nicht** (Befund, Vor-dem-Bau-Punkt 3, Test 11).
3. **Die Begründung einer Verweigerung (SG2):**
   - ist in `EventRead` per Schema ausgeschlossen (Test 13);
   - erscheint in `Question.answers` nur für Halter von `refuse.*` und nie in `StageView`, beides beschrieben an jeder
     Operation;
   - steht nie in `required`;
   - wird nicht über `question.legal.clear` gelesen, und admin ist ausgeschlossen.
4. **Die drei neuen Operationen sind im Dienst nicht erreichbar** (nicht montiert; Allowlist; kein Treffer im
   Abdeckungstor).
5. **`InternalError`** nennt genau die vier `detail`-Texte. `seq` ist offengelegt und begründet. Kein Stack, keine
   Verbindungsdaten, keine anderen internen Kennungen.
6. **Die Aufhebung im Web-Client** sendet nur `reason` mit. Die CSRF-Sperre ohne Sitzung bleibt, der Test dazu bleibt
   unverändert.

## Standards (auf Standard gebaut; Vermerk mit Datum im CHANGELOG und im Bericht, im Register nur als Verweis ohne Statuswechsel)

Die Antworten aus Feedback-Runde 2 (09.10.) und der Entscheidungsstunde (16.10.) stehen aus. **043a baut auf E25 und
E15, die beide in Feedback-Runde 2 zur Antwort stehen** (E25 fällig 09.10.; von E15 nur Satzung und GO bis 09.10., Katalog und Pfad A bis 15.01.2027). Die in der
Planzeile 043 genannten Punkte E2, E3a, E4, E6, E7 und E17 liegen dagegen in 043b–d. Deshalb baut 043a standardmäßig erst
nach der Auswertung von Runde 2 (Eigentümerfrage 1). Vermerk im CHANGELOG: „auf Standard gebaut am <Merge-Datum> in 043a
(Vertragsform)“. Das Register ändert keinen Status (Ziel 5).

| Standard | Quelle | Was 043a daraus baut | Kosten einer späteren Änderung |
|---|---|---|---|
| Verweigerung als Antwortart, elf Zustände bleiben (Modell A) | ADR 0012 (vorgeschlagen, Annahme Prüfpunkt 4 mit Recht); Plan §3; Register S6 | `AnswerKind`, Felder auf `AnswerVersion`, eigene Operationen, kein neuer Zustand | Wechsel auf Modell B: 2,5 AStd im Kern (Plan) plus rund 0,5 AStd Vertrag (neue Zustände in `QuestionStatus`, die Operationen bleiben) |
| Grundkatalog als Daten, jeder Grund `verified: false`, „ungeprüft“ sichtbar; offen, ob Pfad A Grund oder Begründung braucht | E15; ADR 0012 | `LegalRef` wie `rules.ts`; Pfad A ohne Grund (422 bei Grund); Pfad B über Guard statt Schema; `refusalGroundHash` | Begründungspflicht für Pfad A: 0 AStd Vertrag (Guard in 044, eine Zeile). Gründe für Pfad A zulassen: `if`/`then` streichen, < 0,25 AStd Vertrag. Katalogpflege: Daten (076) |
| Freigabe durch `approver`, Recht empfiehlt; Vorschlag durch `legal` und `coordination` | E25; ADR 0012 | nur die Bezeichner `question.refuse.propose`/`approve` und der Leserkreis der Begründung; die Vergabe folgt in 044 | eine Tabellenzeile, 0,5 AStd (E25); Vertrag 0, außer der Leserkreis ändert sich (Beschreibung, < 0,25 AStd) |
| Inhaltssprache `de`, keine Kopplung | E21 | `RefusalGround.title`/`stageText` einsprachig als Inhalt | zweite Sprache: optionales Feld je Text, additiv, < 0,5 AStd Vertrag |
| Begründung ist Rechtseinschätzung: nur `refuse.*`-Halter, nie im Ereignis-Lesepfad, nie admin | Bedrohungsmodell SG2; Rechtekonzept §4 | Maskierungsregel an allen Lesepfaden, `EventRead`-Schema-`false` | Leserkreis erweitern: Beschreibung, 0 AStd Vertrag, Tests in 044. Die Begründung wieder in die Historie aufnehmen: Schema-`false` streichen, < 0,25 AStd |

## Offene Eigentümerfragen

Keine blockiert die Spec. Fragen 1, 2 und 5 brauchen vor dem Bau ein ausdrückliches Go.

1. **Baustart (Go nötig).** Standard: 043a baut **nach** Feedback-Runde 2, also nicht vor dem 09.10.; der früheste Start
   nach `scripts/plan-graph.mjs` ist der 12.10.2026. Grund: 043a baut auf E25 (fällig 09.10.) und E15. Bei E15 ist nur der Teil „Satzung und Geschäftsordnung“ am 09.10.
   fällig. Der Teil zu Katalog und Pfad A ist bis 15.01.2027 erbeten, Frist 29.01.2027 (`entscheidungsregister.md:50`).
   Er bleibt also auch nach Runde 2 auf Standard gebaut.
   Früher nur, wenn der Eigentümer ausdrücklich Go gibt. Eine spätere abweichende Antwort kostet dann die Beträge aus
   „Standards“.
2. **Zuschnitt, Budget und Klasse (Go nötig).** Die Planzeile 043 (2 AStd, mittel) wird vier Teile mit rund 6,5 AStd,
   jeder hoch. Mit dem Go ändert der Orchestrator auch die Lanes der Plan-Einträge 043 (`web-api`, `service-tests`) und
   044 (`service`, `web-api`), siehe Frage 5. Ohne Go bleibt es bei der Planzeile; dann wird 043a in dieser Form nicht gebaut, und der Architekt meldet
   sich mit einem neuen Zuschnitt.
3. **Leserkreis der Begründung.** Standard: nur Halter von `question.refuse.propose` oder `question.refuse.approve`
   (`legal`, `coordination`, `approver`); nie admin; nie in Historie, `listEvents`, Strom oder Bühne.
   - Alternative a: auch Halter von `question.legal.clear` ohne admin. Das braucht ein eigenes Leserecht, rund 0,5 AStd.
   - Alternative b: alle Leser der Frage.
   - Recht sollte das bestätigen (E15, E25).
4. **ADR 0012 Modell A.** Liegt seit 011 bei Recht. Standard A; die Kosten eines Wechsels stehen in der Tabelle oben. Dazu
   die Teilfrage aus E15: Braucht Pfad A eine Begründung, und darf er einen Grund tragen (Standard: keine Pflicht, kein
   Grund, 422)? Das Rechtekonzept §4 nennt als Invariante „Keine Verweigerung ohne zugeordneten Grund und
   Begründung“; ADR 0012 hält genau diesen Widerspruch zu Pfad A offen. Soll Pfad A einen Grund tragen, fällt die
   `if`/`then`-Bedingung in `RefusalProposal` und `AnswerVersion` weg (< 0,25 AStd Vertrag); eine Begründungspflicht setzt
   ein Guard in 044.
5. **Anfragefelder wandern aus den Vertragspaketen in die Umsetzungsscheiben (Go nötig, Planabweichung).** Nach Regel 1
   schreibt der Architekt jede Erweiterung eines bestehenden Anfrageschemas im ersten Commit der Umsetzungsscheibe, nicht
   in einem 043-Teil. Jede solche Zeile ist additiv (optional; Pflicht über Guard). Mit Go ändert der Orchestrator:
   - Plan §5.1, Lane-Tabelle Zeile 286 (`contract`): „028 und 080 ändern den Vertrag in engem Rahmen“ wird zu „028, 080
     sowie 040, 046, 048, 049, 055, 056, 057, 059, 068, 080c ändern den Vertrag in engem Rahmen, je eine additive
     Anfragezeile durch den Architekten vor dem Code“;
   - die Plan-Einträge **040** (`Classification.seatId`, Start-Aktion, Nummernkreise, override-Grund; Lane contract
     ergänzen), **080c** („Vertrag 0.4.0 aus 043“ wird „eigene Vertragszeile“), **046** (`parentQuestionId`/`relation`),
     **048** (`accountable`/`language` als Eingabe, falls nicht als Operation), **049** (Body von „Vorgelesen“), **055**
     (`AnswerDraft.body`), **056** und **057** (Query-Parameter von getStage), **059** (Prüfpunkte an
     `clearQuestionLegally`), **068** (`source: submitted`);
   - bei jeder dieser Scheiben kommt die Lane `contract` in die Kopfzeile, und `packages/contract/**` gehört in ihre
     „Files allowed“;
   - der Plan-Eintrag **044** erhält die Lanes `service` (Routen montieren, Allowlist-Einträge entfernen) und `web-api`
     (`HvApi`/`http.ts`);
   - der Plan-Eintrag **043** erhält in der Kopfzeile die Lanes `web-api` und `service-tests` (Aufhebung der Sperre,
     Vertragstests dieser Spec).

   Ohne Go gilt die Planzeile. Dann muss jeder 043-Teil seine Anfragefelder zusammen mit der Umsetzung liefern, und die
   Teile b bis d werden zu gemischten Scheiben mit Kerncode.

## Hinweise an Folgescheiben

**044:**
- `ROLE_PERMISSIONS.admin` nimmt alle `PERMISSIONS` außer einer Liste (`permissions.ts:74`). `question.refuse.*` kommt in
  diese Ausschlussliste; der Wahrheitstabellen-Diff zeigt es.
- Die Begründung wird über die beiden `refuse.*`-Rechte gelesen, nicht über `question.legal.clear`.
- **Maskierung:**
  - `MASKED_KEYS`/`maskEvent` (`stream.ts:169-188`) maskieren statisch und kennen den Leser nicht. Deshalb nimmt 044
    `refusalJustification` in `MASKED_KEYS` auf: Im `EventRead` fehlt das Feld für jeden Leser.
  - Die Maskierung nach Recht geschieht nur in der Projektion der Frage (`Question.answers`, `StageView`).
  - Pflicht-Negativtests: ein Halter von `history.read` ohne `refuse.*` (`getQuestionHistory`); `listEvents` als admin;
    `/stream` (`event`-Nachricht) als admin; `getQuestion` als admin, Podium und Beobachter; `getStage` als Podium.
- 044 montiert die drei Routen im Dienst und entfernt die drei Allowlist-Einträge (`slice` 044). Dafür braucht die
  Spec von 044 die Lane service, wie 040 über takt-011.
- 044 erweitert `HvApi`, den In-Process-Adapter und `apps/web/src/api/http.ts` gemeinsam.
- `RefusalGround.hash` und `refusalGroundHash`: SHA-256, Kleinbuchstaben-Hex, über RFC 8785 (JCS) des Eintrags ohne
  `hash`, UTF-8. Dazu der Schnappschuss `answer.refusalGround` (`title`, `stageText`, `legalRef`) in der
  `AnswerDrafted`-Nutzlast. Guard: `approveRefusal` antwortet mit 409, wenn der Hash der Version nicht mehr dem aktuellen
  Katalogeintrag entspricht (R-GUARD-11, oben reserviert; Test).
- Die Suche (`listQuestions` mit `q`, `api.ts:702`) indexiert `refusalJustification` nie; Negativtest.
- **`question.submit_review` hält nur `expert`** (`permissions.ts:60`). Wer eine Verweigerung vorschlägt (`legal`,
  `coordination`), kann sie heute nicht zur Prüfung geben. 044 entscheidet eines von beiden, mit Tabellenzeile und Test:
  - `proposeRefusal` führt direkt nach `in_review`;
  - oder die Vorschlagenden erhalten `question.submit_review`.
- **Engpass bei nur einer Juristin (E40):** R-GUARD-06 (`approverIsNotCreator`) gilt auch für die Rechtsfreigabe
  (R-TRANS-13). Schlägt `legal` die Verweigerung selbst vor, muss eine zweite Person mit `question.legal.clear` freigeben.
  044 nennt das im Bericht und in der Rollenkarte. Mit einer einzigen Juristin blockiert der Pfad; ein Eilpfad ist
  ausgeschlossen (E25).
- **Verweigerung im Antwortpfad `podium`:** Podiumsfragen ohne Antwort werden in `classified` rechtlich freigegeben
  (R-TRANS-14). 044 legt fest, ob und ab welchem Status `proposeRefusal` auf einer Podiumsfrage zulässig ist (eigene
  Zeile, Test).

**045:** „ungeprüft“ aus `legalRef.verified`, Katalog über `listRefusalGrounds`; Glossarzeile „Verweigerungsgrund“.

**040:** Vertragszeile `Classification.seatId` und die übrigen 040-Vertragspunkte (Tabelle oben) als erster Commit mit dem
Architekten, sofern Eigentümerfrage 5 freigegeben ist. Version: die nächste freie Patch-Stufe nach 0.4.0.

**043c:** gebundenes Nutzlastschema für `AnswerDrafted` mit den Verweigerungsfeldern (ohne `refusalJustification`).

**043d:** Entscheidung „Begründung in der Niederschrift-Anlage?“ mit Perspektive Legal (Standard nein).

**046, 048 und alle weiteren:** Regel-ids nach der nächsten freien Nummer zum Zeitpunkt der Spec.

## Folgelisten-Einträge, die 043a anlegt

1. Veraltete Regel-id-Verweise R-TRANS-13..16: ADR 0012:53, Register E5, Plan Zeilen 198, 674, 686, 1083 und Eintrag 069.
   Ziel: die jeweilige Folgespec vergibt die nächste freie Nummer; Doku-Takt gleicht die Verweise an.
2. Veraltete Kommentare im Kern: `packages/domain/src/types.ts:304` („Domain only until contract 0.4.0“) und
   `packages/domain/src/api.ts:860-867` („fields the contract still accepts“). Ziel: 044 oder der nächste Takt core.
3. 034a „→ 043“ (Grenzen der Anfrageschemas im Kern der Demo), umgelenkt auf „Takt core“.

## Bericht (nach Bau ausfüllen)

```
Slice: 043a-vertrag-bereinigung-verweigerung
Done:
Evidence:
Open:
Touched:
```

**Baustart:** auf Standard gebaut, Go des Eigentümers 03.10.2026 (Eigentümerfragen 1, 2 und 5 mit den Standards dieser
Spec beantwortet). Vertragscommit durch den Architekten auf `claude/slice-043a-vertrag`, Basis `acb7f45`.

**Vor dem Bau prüfen (Ergebnisse, gelesen auf `acb7f45`).**
1. Integrationszweig auf Vertrag 0.3.12, 66 Operationen, sechs Allowlist-Einträge (alle `slice` 040). 0.4.0 ist frei.
   Seit `ca94899` gemergt: 040a (`c000567`, Kern und Tests, kein Vertrag), Specs 040a–d und 044a, takt-041 (`a1d9607`,
   nur `apps/api/package.json` und Lockfile: hono 4.13.7+; kein Einfluss auf Vertrag, Validator oder Tests dieser
   Scheibe, der volle API-Lauf ist grün). Erwartete Zahl in Akzeptanzkriterium 3: 6 + 3 = 9.
2. `UNDOCUMENTED_STATUS_EXCEPTIONS` enthielt genau die fünf Lücken (401 auf den 29 Operationen aus `OPERATIONS_0_2`,
   422 auf `listQuestions`/`returnQuestion`/`withdrawQuestion`, 409 auf `updateSpeaker`). Keine Abweichung.
3. `registerSpeaker` und `updateSpeaker` schreiben nur benannte Felder (heute `api.ts:870-894` und `909-939`). Kein
   Blocker.
4. PATCH mit `{}` antwortet 200 ohne Ereignis und ohne neue Version (takt-015); der Block in `contract.test.ts` sendet
   jetzt `{}` und bleibt sonst gleich.
5. `/readyz` fängt Fehler der drei Prüfungen selbst ab (`safeCheck`, Antwort 503 mit Code), `/auth/login` wandelt
   Fehler des Identitätsanbieters und des Auth-Speichers in 503 um; `/metrics` und die übrigen Routen fangen nicht ab.
   Eine Ausnahme außerhalb dieser Blöcke erreicht überall `onError` (`app.ts:716`). 500 bleibt auf jeder Operation
   dokumentiert (Ziel 2), auf `/readyz` und `/auth/login` nur unwahrscheinlicher.
6. `http.unsupported` wird nur in `apps/web/src/api/http.ts:624` verwendet (dazu die beiden Sprachdateien). Der
   Schlüssel entfällt mit dem zweiten Commit.
7. Zeilenangaben: In den Dateien aus „Files allowed“ stimmen alle Angaben (`contract.test.ts:175-186`, die
   `kind`-Stellen in `negative.test.ts`, `helpers.ts`, `http.ts:27, 44, 621-625`, `http.test.ts:192-196, 311-319`,
   `shell.de.ts:27`, `shell.en.ts:29`). Abweichend, nur verschoben durch 040a, Inhalt unverändert: `api.ts` (+66 Zeilen:
   `registerSpeaker` 870, `updateSpeaker` 909, Kommentar 925, Suchtext 733) und `permissions.ts` (`admin` ab Zeile 78).
   **Inhaltlich überholt durch 040a:** `ROLE_PERMISSIONS.admin` ist keine Ableitung „alle außer einer Liste“ mehr,
   sondern eine ausdrückliche Liste ohne `question.legal.clear`. Die Regel „nie admin“ bleibt richtig; der Hinweis an
   044, `question.refuse.*` in eine Ausschlussliste aufzunehmen, ist gegenstandslos (044a sagt das ebenso). Gemeldet,
   nicht angehalten: keine dieser Stellen liegt in „Files allowed“, der Befund trägt sonst unverändert.

**Mutationsproben (Ergebnis).** Gegen Vertrag 0.3.12 (`acb7f45`) sind 17 von 19 Tests in `contract-043a.test.ts` rot.
Mit 0.4.0 grün; jede Probe danach zurückgesetzt (Datei byte-gleich):
- `kind` wieder in `SpeakerRegistration` → Tests 2, 10 und 11 rot.
- `answerKind` in `AnswerDraft` → Test 10 rot.
- `if`/`then` aus `AnswerVersion` entfernt → Test 6 rot.
- `refusalJustification: false` aus `EventRead` entfernt → Test 13 rot.

**Typen-Diff (Auszug).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings

**Lesebefund der Spec (30.09.2026, zu `6552a1e`):** 0 blocker, 12 major, 11 minor, 3 nit. Alle in dieser Fassung
eingearbeitet:
- Major 1–2: Maskierung über alle Lesepfade, Leserkreis ohne `question.legal.clear`, admin ausgeschlossen.
- Major 3: Aufhebung der Sperre im Web-Client.
- Major 4: vier 500-Texte, `seq` begründet, 500 auf `/metrics`.
- Major 5: `LegalRef` wie `rules.ts`.
- Major 6: E25/E15 genannt; Baustart nur mit Go.
- Major 7: Registervermerke.
- Major 8: Eigentümerfrage 5.
- Major 9: Regel „additiv, Pflicht über Guard“.
- Major 10: Bedrohungen und Missbrauchsfälle.
- Major 11: Test 6 von einer gültigen Version aus, Mutationsproben.
- Major 12: `refusalGroundHash`.
- Minor und nit: wie oben in den jeweiligen Abschnitten.

**Nachprüfung (30.09.2026, zu `3a6d054`):** Major 1–6 und 8–11 erledigt. Offen waren Major 7 und 12 sowie mehrere Minor.
In dieser Fassung behoben:
- Major 7: kein Statuswechsel im Register, nur Verweise in Textspalten.
- Major 12: Hash nach RFC 8785 ohne `hash`, Schnappschuss im Ereignis, Prüfung bei der Freigabe (409), Hash-Kette für
  `text` und Begründung.
- Security-Minor: T-G1-I-02, T-G1-I-09, T-G1-E-04 und T-G1-I-04; Suchhinweis; Missbrauchszeile R-GUARD-08; Beobachter
  liest den Katalog; Widerspruch „Hash-Nachweis“ behoben.
- Übrige Minor und Nit: `'success'`; 500 überall; `LegalRef`-Erweiterung benannt; Fristen von E15; Lanes 043/044;
  Test 6 ergänzt; `createdBy.personId`; Rechtekonzept §4/§5; Guard-Zeile zitiert.
