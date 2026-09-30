# Scheibe 043a — Vertragspaket 0.4.0, Teil 1: Bereinigung und Verweigerung

**Status:** spec (30.09.2026; Teil 1 der geteilten Scheibe 043, Zuschnitt aller Teile im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 1,25 AStd · 23.10.2026 (W4) laut Plan; Bau vorgezogen, siehe Eigentümerfrage 1 · Lanes: contract; service nur Vertragstests
**Rolle:** architect (Vertrag, CHANGELOG, Allowlist; kein Anwendungscode). Review in frischem Kontext mit Perspektive Vertrag (6.4) und Legal (Verweigerung) sowie Security (Maskierung der Begründung). Vor dem Bau liest ein frischer Kontext die Spec. Das Review wird nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue Regel im Kern. Dokumentiert werden R-SPK-00..05, R-SPK-GUARD-01 (409 auf `updateSpeaker`), R-PERM-01, R-PERM-02. Für 044 reserviert und nur im Vertragstext genannt: R-GUARD-08, R-GUARD-09. Dazu AGENTS.md R1, R2, R4, R6, R7, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5.5/043, §3 „Zustandsmodell und Verweigerung“, §10 (E15, E25), §11 Etappe C; ADR 0012 (Modell A), ADR 0015, ADR 0001, ADR 0002; Spec 080 (Nachtrag R1, „Open“); `docs/folgeliste.md` (029a nit 6, 080 → 043, 035b „kein 500“, takt-040 nit 5, 035a nit `no-unused-components`); Review 012 Punkt 18; Review 023 (keine Erweiterung bestehender Anfrageschemas durch einen reinen Vertragsstand)
**Depends on:** 023, 014, 080 (alle gemergt); Vertrag 0.3.12 auf `ca94899`
**Perspektive:** Vertrag, Legal, Security · **Glossar: neue Begriffe:** nein. „Verweigerungsgrund“ (refusal ground) bleibt Arbeitsbegriff in Spec und Vertrag. Die Glossarzeile kommt mit 045, dem ersten Oberflächentext

## Teilung und Zuschnitt

Die Planzeile 043 nennt rund 40 Einzelpunkte: Schemas, Operationen, Rechte, Ereignisse, einen Systemakteur. Für 2 AStd
und einen einzigen Review ist das zu groß. Nach dem Vorbild von 035a/035b und 033a/033b wird 043 geteilt. Diese Spec
beschreibt Teil a vollständig. Die Teile b bis d stehen hier nur als Zuschnitt. Ihre Specs schreibt der Architekt, sobald
die Antworten vorliegen, auf denen sie aufbauen (Feedback-Runde 2 am 09.10., Entscheidungsstunde am 16.10.). Eigene
Stub-Dateien wären bis dahin veraltet. Die Planzeile bleibt unverändert; nach dem Merge ergänzt der Orchestrator den
Teilungsvermerk.

### Drei Regeln für den Zuschnitt

1. **Ein reiner Vertragsstand erweitert kein bestehendes Anfrageschema.** Der Vertrag sagt es selbst in
   `info.description`, Absatz „Compatibility“ (Review 023). Der Dienst prüft jede Anfrage gegen `openapi.yaml`. Ein
   neues Feld in einem bestehenden Anfrageschema würde also sofort angenommen und bis zur Umsetzung stillschweigend
   verworfen. Neue Eingaben kommen deshalb entweder als **neue, vorab erklärte Operation** mit Allowlist-Eintrag in einen
   043-Teil, oder als **Vertragszeile der Umsetzungsscheibe**: Der Architekt schreibt sie dann im ersten Commit dieser
   Scheibe, vor jedem Code (AGENTS.md R6; Vorbild 035a). Die Tabelle unten nennt diese Zeilen.
2. **Vorab erklärt wird nur, was einen eingeplanten Abnehmer hat.** Eine Allowlist-Zeile läuft ab, und dann wird das Tor
   rot. Eine Operation für eine zurückgestellte Scheibe (047, 049, 056, 057, 058 und andere, Plan §11) würde entweder
   ablaufen oder ein künstlich fernes Ablaufdatum brauchen. Beides widerspricht ADR 0015 („keine tote Operation“).
3. **Ein Recht kommt mit der Operation, die es prüft.** Ein reiner Bezeichner ohne Operation ist seit 0.3.0 möglich
   (deny by default). Dieser Zuschnitt vermeidet ihn trotzdem, damit jedes neue `Action` einen Abnehmer hat.

### Teile, Reihenfolge, Aufwand

| Teil | Version | Thema | Inhalt aus der Planzeile 043 | Abnehmer | Klasse · AStd | Wann |
|---|---|---|---|---|---|---|
| **043a** (diese Spec) | 0.4.0 | Bereinigung und Verweigerung | Die nicht additiven Punkte: `kind`/`requestedMinutes` gestrichen, `SpeakerUpdate.reason` mit Enum, 401/422/500 nachgetragen. Dazu `answerKind` und `refusalGroundId` auf `AnswerVersion`, Grundkatalog-Endpunkt, Operationen „Verweigerung vorschlagen“ und „Verweigerung freigeben“, Rechte `question.refuse.propose` und `question.refuse.approve` | 044, 045; Schulden aus 080, 029a, 035b, takt-040 | hoch · 1,25 | jetzt, als erster Schritt von Etappe C |
| **043b** | 0.4.x | Fragenfelder für Steuerung, Fokus, Format und Prüfung | Operation `forward` mit `question.forward` und `QuestionForwarded`; `accountable` und `language` auf `Question`; Antwortformat (Blockdokument plus `text`) als Antwortfeld; Prüfliste je Pfad als Daten (Leseoperation); `parentQuestionId`/`relation` sowie die Kennzeichen `deferred`, `correctionOpen`, `followUp` als Antwortfelder mit ihren Operationen; `note` hinter Konfiguration; `cockpit.read` | 048, 053, 054, 055, 059, 061, 046 | hoch · 1,5 | nach dem 09.10., vor dem Bau von 048 |
| **043c** | 0.4.x | Partnerschnittstellen | `ingest/speech-segments` (Form nach E3a) mit `ingest.write` und `SegmentIngested`; Abonnements und Webhooks mit Signaturkopf und Nutzlast; `answer-suggestions` mit `SuggestionRecorded`; Sicherheitsschema für Systemakteure (Client-Credentials oder mTLS) | 064, 065, 066 (Etappe D) | hoch · 1,5 | nach dem 16.10. (Ansprechperson E3a), parallel zu C |
| **043d** | 0.4.x | Rechtliches Protokoll, Bühne, Benachrichtigung | Verfahrensereignisse mit `procedure.record`; Export `record.json`/`record.html` mit `export.dossier` und `ExportCreated`; `NotificationRaised`/`NotificationAcknowledged`; `RemainderListConfirmed` mit `debate.close` und der Operation zum Debattenschluss; Delivery-Entität (`versionHash`, `mode`, `deviationNote`); `AnswerBundle` mit `round.assemble`; getStage-Filter; `confidentiality`; Aktienregister-Lookup; Vorabfragen- und Papierquelle; Systemakteur `canary` mit Kennzeichen `synthetic` | 050, 051, 085, 087, 049, 057, 047, 056, 067, 068, 086 | hoch · 2 (bei Bedarf wieder teilen) | erst, wenn die Abnehmer eingeplant sind (größtenteils zurückgestellt bis nach der zweiten Demo) |

Summe rund 6,25 AStd statt 2 AStd laut Plan. Die Planschätzung deckte die Vertragsprosa, nicht die Vertragstests und den
Review je Teil. Die Klasse steigt von mittel auf hoch: Leitplanken §4 nennen „Verweigerung“ und „Rechte“ als Hoch-Auslöser.
Das ist eine Hochstufung; das Herabstufungstor ist nicht berührt.

**Warum diese Reihenfolge.** Etappe C beginnt mit 043, 040, 041, 044, 045 (Plan §11).
- 040 und 041 brauchen nichts aus der Planzeile 043. Ihre Admin-Operationen stehen seit 0.3.0 im Vertrag und in der
  Allowlist (`slice` 040). Was 040 zusätzlich braucht, erweitert bestehende Anfragen oder ist im Plan gar nicht 043
  zugeordnet. Das kommt nach Regel 1 als Vertragszeile von 040 (Tabelle unten).
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
genannten Scheibe. Ihre Spec nennt dann `packages/contract/**` in „Files allowed“, mit dem Architekten als Autor dieses
Commits. Version ist jeweils die nächste freie Patch-Stufe beim Merge.

| Feld oder Parameter | bestehende Operation | Umsetzungsscheibe | Bemerkung |
|---|---|---|---|
| `Classification.seatId` | `classifyQuestion` | 040 | Die Beschreibung von `Classification.stageAssignment` nannte bisher 043; 043a berichtigt den Text |
| Start-Aktion des Jahrgangs, Nummernkreise je Erfassungsplatz, Grund für `admin.override` | neu bzw. Admin-Operationen | 040 | im Plan nicht 043 zugeordnet (Planzeile 040, takt-019 Ziel 2) |
| `SpeakerOrder.reason` | `reorderSpeakers`, `reorderMeetingSpeakers` | 080c | Plan 080c sagt „Vertrag 0.4.0 aus 043“; ohne Kern wäre das Feld eine stille Annahme |
| `QuestionCapture.parentQuestionId`, `relation` | `captureQuestions` | 046 | |
| `accountable` beim Klassifizieren, falls nicht über eigene Operation | `classifyQuestion` | 048 | 043b entscheidet: eigene Operation oder diese Zeile |
| `AnswerDraft.body` (Blockdokument) | `draftAnswer` | 055 | 043b liefert das Schema `AnswerBody` und das Antwortfeld |
| Prüfpunkte der Rechtsfreigabe | `clearQuestionLegally` | 059 | 043b liefert die Leseoperation der Prüfliste |
| Body von „Vorgelesen“ (`versionHash`, `mode`, `deviationNote`, `occurredAt`) | `deliverQuestion` | 049 | |
| Query `seat`, `bundleId`, `strategy` | `getStage`, `getMeetingStage` | 056, 057 | |
| `source` `submitted` mit Frist und `madeAccessible` | `captureMeetingContribution` | 068 | |

**Befund für 046 und 048:** Der Plan nennt R-TRANS-13 für das Weiterleiten und R-TRANS-14..16 für die Kennzeichen. Im
Code sind R-TRANS-13 und R-TRANS-14 schon vergeben (`packages/domain/src/transitions.ts:578, 596`). Die Specs von 046
und 048 vergeben die nächsten freien Nummern ab R-TRANS-15. 043a vergibt keine.

## Befund (Ist-Stand, gelesen auf `ca94899`)

- **Vertrag 0.3.12**, 66 Operationen. Allowlist: sechs Einträge, alle `slice` 040, Ablauf 25.11.2026.
- **`kind` und `requestedMinutes`** sind veraltet seit 0.2.0. Sie stehen noch in `Speaker`, `SpeakerRegistration`
  (beide) und `SpeakerUpdate` (`requestedMinutes`). Der Kern kennt sie seit 080 nicht mehr (`packages/domain/src/types.ts`
  ohne beide Felder). `registerSpeaker` schreibt nur benannte Felder ins Ereignis (`packages/domain/src/api.ts:804-828`).
  Ein weiter gesendetes `kind` erreicht also das Log nicht. Tests, die die Felder noch senden oder prüfen:
  `apps/api/src/__tests__/negative.test.ts:172, 190, 240-249, 254, 285` und `apps/api/src/__tests__/contract.test.ts:175-186`.
  Die Web-Oberfläche sendet keines der Felder.
- **`SpeakerUpdate.reason`** (`'follow_up'`, R-SPK-05 mit R-SPK-GUARD-01) ist seit 080 über HTTP erreichbar, steht aber
  nicht im Vertrag. Der Domänentyp: `packages/domain/src/types.ts:301-306`.
- **Fünf undokumentierte Status aus Review 012 Punkt 18** stehen als Ausnahme in
  `apps/api/src/__tests__/helpers.ts:80-99` (`UNDOCUMENTED_STATUS_EXCEPTIONS`): 401 auf den 29 Operationen aus 0.2
  (`OPERATIONS_0_2`, Zeilen 58-67), 422 auf `listQuestions`, `returnQuestion`, `withdrawQuestion` und 409 auf
  `updateSpeaker`. Der Test „the exception list names only … statuses the contract does not document“
  (`contract.test.ts:359-366`) wird rot, sobald der Vertrag einen dieser Status dokumentiert und die Ausnahme bleibt.
  Vertrag und Ausnahmeliste ändern sich also im selben Commit.
- **500:** Keine Operation dokumentiert 500 (Folgeliste 035b). Eine verletzte Kette antwortet mit 500 als Problem-Details.
- **Verweigerung:** Weder im Vertrag noch im Kern gibt es `answerKind`, einen Grundkatalog oder die Rechte
  `question.refuse.*`. `ROLE_PERMISSIONS.admin` ist „alle `PERMISSIONS` außer einer Liste“
  (`packages/domain/src/permissions.ts:74`). Das betrifft 044, nicht diese Scheibe (Hinweis unten).
- **Beschreibungen, die 0.4.0 berichtigt:** `components/responses/Unauthorized` (nennt 401 auf 0.2-Operationen noch
  undokumentiert). `components/responses/StreamUnavailable` („both causes“, `RetryAfter` zählt drei; takt-040 nit 5).
  `Classification.stageAssignment` (nennt `seatId` mit 043). `Role` (Bündel von `coordination` „arrives with slice 021“;
  gebaut). `info.description`, Absatz „Compatibility“ (spricht vom 0.3.x-Zyklus).

## Ziel und Entscheidungen vor Bau

Vertrag 0.4.0 enthält die nicht additiven Punkte und die Vertragsform der Verweigerung (ADR 0012, Modell A). Kern,
Dienst und Web ändern sich nicht. Nur Vertragstests und die Ausnahmeliste folgen.

### 1. Streichungen und Einengungen (nicht additiv, ADR 0015)

- `Speaker.kind`, `Speaker.requestedMinutes`, `SpeakerRegistration.kind`, `SpeakerRegistration.requestedMinutes` und
  `SpeakerUpdate.requestedMinutes` werden gestrichen, ebenso der Kommentar zu `kind` über `Speaker.required`. Ein Client,
  der sie weiter sendet, erhält keine 422. Das Feld wird ignoriert wie jedes unbekannte Feld (kein
  `additionalProperties: false`, sonst brächen ältere Clients ohne Not).
- `SpeakerUpdate.reason`: `{ type: string, enum: [follow_up] }`. Beschreibung: Pflicht für `finished → waiting`
  (R-SPK-05, Guard R-SPK-GUARD-01). Bei jedem anderen Übergang wird es verworfen und nicht geschrieben. Ein anderer Wert
  ist 422. Das engt bisher Angenommenes ein und ist deshalb 0.4.0.

### 2. Nachträge dokumentierter Status (Antwortseite, additiv, aber im selben Schritt)

- `'401': { $ref: '#/components/responses/Unauthorized' }` auf allen 29 Operationen aus `OPERATIONS_0_2`.
- `'422'` (`Unprocessable`) auf `listQuestions`, `returnQuestion`, `withdrawQuestion`.
- `'409'` (`Conflict`) auf `updateSpeaker`, mit Satz zu R-SPK-00..05 und R-SPK-GUARD-01 in der Beschreibung.
- Neue gemeinsame Antwort `InternalError` (500, `application/problem+json`, `Problem` mit `status: 500`, Kopf
  `X-Server-Time`). Sie wird auf **jeder Operation unter `/v1`** dokumentiert, nach dem Vorbild von 034a (503
  `PersistenceBusy`). Die Beschreibung nennt den bekannten Fall (Kette verletzt, 035b) und sagt: keine Einzelheiten im
  Text. Die Operationen mit eigenem `servers`-Eintrag (`/healthz`, `/readyz`, `/metrics`, `/auth/*`) bleiben ohne 500.
  Sie haben eigene Fehlerwege. Der Architekt prüft sie beim Bau einzeln; stellt er dort 500 fest, nimmt er sie auf und
  vermerkt es im Bericht.
- `UNDOCUMENTED_STATUS_EXCEPTIONS` wird dadurch leer (`{}`). Export, Typ und Prüfung bleiben, damit eine künftige
  Ausnahme wieder begründet eingetragen werden kann. Der Kommentar nennt 0.4.0 als Ende der fünf Lücken.

### 3. Verweigerung als Antwortart (ADR 0012 Modell A; auf Standard gebaut, siehe „Standards“)

Schemas:

- `AnswerKind`: `enum: [answer, refusal_no_claim, refusal_with_ground]`. `refusal_no_claim` ist Verweigerungspfad A
  („kein Auskunftsanspruch“), `refusal_with_ground` ist Verweigerungspfad B („Verweigerung trotz Anspruchs“, mit Grund
  aus dem Katalog). Die Beschreibung grenzt beide Pfade von den Antwortpfaden A/B/C (`Track`) ab.
- `AnswerVersion` erhält drei **optionale** Antwortfelder. `required` bleibt `[version, text, createdAt, createdBy]`.
  - `answerKind` (`AnswerKind`); fehlt es, gilt `answer`.
  - `refusalGroundId` (string).
  - `refusalJustification` (string). Das ist die Begründung, eine Rechtseinschätzung (SG2).
  - **Maskierung (Beschreibung, gebaut in 044):** `refusalJustification` erscheint nur für Leser, die
    `question.refuse.propose`, `question.refuse.approve` oder `question.legal.clear` halten. Allen anderen fehlt das
    Feld, wie die Notiz der Rechtsfreigabe, die in `LegalClearance` gar nicht erscheint. `refusalGroundId` und `text`
    sind nicht maskiert. Der Grund ist Katalogdatum; `text` ist der Wortlaut für die Bühne. Eigentümerfrage 3.
  - Invarianten (Antwortseite, `if`/`then`): Ist `answerKind` `answer` oder fehlt es, erscheinen weder
    `refusalGroundId` noch `refusalJustification`. Bei `refusal_with_ground` ist `refusalGroundId` Pflicht.
    `refusalJustification` bleibt wegen der Maskierung optional. Für `refusal_no_claim` gilt keine weitere Pflicht; ob
    Pfad A Grund oder Begründung braucht, ist die offene Frage an Recht (E15, ADR 0012).
- `LegalRef`: `{ source: string, citation: string, docVersion?: string, docHash?: string, verified: boolean }`.
  `source` ist ein string ohne Enum. Die Beschreibung verweist auf die geschlossene Liste in
  `packages/domain/src/rules.ts` (`LegalSource`), damit eine neue Quelle keinen Vertragszyklus kostet.
- `RefusalGround`: `required: [id, title, stageText, legalRef]`, Felder `id` (maxLength 128), `title`, `stageText`
  (Formulierungsbaustein für die Bühne) und `legalRef` (`LegalRef`). Die Texte sind Inhalt in der Inhaltssprache des
  Jahrgangs (E21: `de`), keine Oberflächentexte. Das Kennzeichen „ungeprüft“ leitet die Oberfläche aus
  `legalRef.verified === false` ab (045, i18n).
- `RefusalProposal` (Body der neuen Operation): `required: [answerKind, text]`.
  - `answerKind`: `enum: [refusal_no_claim, refusal_with_ground]`, **ohne** `answer`.
  - `text`: 1–20000. Der Wortlaut für die Bühne; die Oberfläche füllt ihn aus `stageText` vor.
  - `refusalGroundId`: maxLength 128.
  - `refusalJustification`: 1–4000.
  - `sources`: wie in `AnswerDraft`.
  - **Keine bedingte Pflicht im Schema:** Fehlen bei Pfad B Grund oder Begründung, antwortet der Guard R-GUARD-09 mit
    409 (Plan 044), nicht der Validator mit 422. Ein unbekanntes `refusalGroundId` ist 422. 044 bestätigt das oder
    meldet einen Befund.

Operationen, alle neu und vorab erklärt (Allowlist, `slice` 044):

| operationId | Methode und Pfad | Body | Recht (ab 044) | Wirkung (ab 044) | Antworten |
|---|---|---|---|---|---|
| `listRefusalGrounds` | `GET /refusal-grounds` (global, ohne Jahrgang) | — | lesbar für Halter von `question.read`, `question.read.delivered` oder `stage.read`, also für jeden, der eine Verweigerung sehen darf | Katalog aus `packages/domain/src/refusalGrounds.ts` (044) | 200 (Array aus `RefusalGround`), 401, 403, 408, 429, 500, 503 |
| `proposeRefusal` | `POST /questions/{questionId}/refusals` | `RefusalProposal` | `question.refuse.propose` | neue, unveränderliche Antwortversion mit `answerKind` ≠ `answer`, geschrieben als `AnswerDrafted`. Kein neuer Ereignistyp: eine Verweigerung ist technisch eine Antwortversion (ADR 0012). Übergang nach der Tabelle aus 044 | wie `draftAnswer` plus 401 und 500 |
| `approveRefusal` | `POST /questions/{questionId}/refusal-approvals` | `{ answerVersion }` wie `approveQuestion` | `question.refuse.approve` | geschrieben als `QuestionApproved`, gebunden an die Version. Ab 044 ist `approveQuestion` auf einer Verweigerungsversion 409 und `approveRefusal` auf einer Antwortversion 409 | wie `approveQuestion` plus 401 und 500 |

Parameter der beiden schreibenden Operationen: `IdempotencyKey`, `CsrfToken`, `IfMatchRequired`, wie bei `draftAnswer`.
Vorlage der Antwortliste ist `clearQuestionLegally` (hat 401) plus 500. Der Test „every status the generic layer can
produce is documented“ (`contract.test.ts:347-357`) prüft das.

**Warum eigene Operationen statt `draftAnswer` und `approveQuestion` zu erweitern:** (a) Regel 1 des Zuschnitts. Felder
in `AnswerDraft` würden heute angenommen und still verworfen, eine Verweigerung sähe dann aus wie eine Antwort. Genau das
verbietet ADR 0012 („aus einer Verweigerung wird nie eine Antwort“). (b) Ein Recht, eine Operation: `_actions` und die
Wahrheitstabelle (Rolle × Status × Aktion) bilden `question.refuse.propose` und `question.refuse.approve` ohne
Fallunterscheidung ab. Die Alternative (bestehende Operationen, Recht nach Antwortart) kostet 044 etwa 0,25 AStd weniger
Dienst- und Adaptercode. Dafür bekäme die Verweigerung bis 044 einen stillen Annahmepfad.

`Action` erhält `question.refuse.propose` und `question.refuse.approve`. Beschreibung: „Since 0.4.0 (identifiers only;
granted in `ROLE_PERMISSIONS` by slice 044, deny by default until then)“. Standard laut E25/ADR 0012: propose bei
`legal` und `coordination`, approve bei `approver`. `_actions` einer Frage enthält sie ab 044 nach Tabelle und Guards
(R-GUARD-08, R-GUARD-09).

### 4. Beschreibungen

- `info.version` 0.4.0. Absatz „Compatibility“: Der 0.3.x-Zyklus ist abgeschlossen. 0.4.0 ist die nicht additive Stufe
  mit den Streichungen aus Ziel 1. Innerhalb von 0.4.x gelten dieselben additiven Regeln wie bisher. Die Aliaspfade,
  `StageAssignment` und `EventActor.displayName` bleiben bis 0.5.
- Neuer Absatz „Refusal (since 0.4.0, slice 043a; behaviour from slice 044)“: Modell A in drei Sätzen, Maskierung der
  Begründung, eigene Operationen.
- `Unauthorized`, `StreamUnavailable`, `Classification.stageAssignment` (`seatId` kommt mit dem Vertragsschritt von
  040) und `Role` (`coordination` seit 021 gebaut) werden berichtigt.

### 5. CHANGELOG, Allowlist, Typen

- `packages/contract/CHANGELOG.md`: `## [0.4.0] - <Merge-Datum>` mit den Unterabschnitten `### Removed` (Ziel 1, mit
  Verweis auf ADR 0015 und die Veraltung in 0.2.0), `### Changed` (Einengung `reason`, Beschreibungen), `### Added`
  (Status, `InternalError`, Verweigerung), dazu je Punkt die umsetzende Scheibe. Dazu der Satz „auf Standard gebaut“
  aus dem Abschnitt „Standards“.
- `packages/contract/allowlist.json`: drei neue Einträge `listRefusalGrounds`, `proposeRefusal`, `approveRefusal`, je
  `slice` `044`, `expires` `2026-11-27` (Plan 044: 06.11.2026 plus drei Wochen, wie 040 mit 03.11. zu 25.11.), `reason`
  mit Scheibe und Recht. Die sechs Einträge von 040 bleiben unverändert.
- `pnpm contract:types` regeneriert `packages/contract/src/types.ts`. Der Diff gehört als Auszug in den Bericht.

## Versionierung und Tore (ADR 0015)

- **Vertragstor** (`packages/contract/scripts/check.mjs`, in `pnpm -r test`):
  - (a) `info.version` = `package.json`-Version = 0.4.0.
  - (b) CHANGELOG-Abschnitt `## [0.4.0]`.
  - (c) Gegenüber der Merge-Basis mit dem Integrationszweig ist 0.4.0 > 0.3.12. In CI gilt `CONTRACT_GATE_STRICT=1`,
    dort ist ein Überspringen rot.
  - (d) Allowlist: wohlgeformt, jede `operationId` existiert, keine abgelaufen.
- **Was das Tor nicht sieht:** Ob eine Änderung nicht additiv ist, erkennt das Tor nicht; es prüft nur „höher“. Die nicht
  additive Natur belegen drei Dinge: der Minor-Sprung, der Abschnitt `### Removed` mit ADR-Verweis und die Prüfung des
  Reviewers. Er gleicht die Streichliste gegen den Diff ab, jede Streichung muss seit mindestens einem Zyklus veraltet
  sein. Der Vertragstest 043a sichert die Streichungen zusätzlich ab (Test 2).
- **Abdeckungstor** (`apps/api/src/__tests__/operation-coverage.setup.ts`): Die drei neuen Operationen sind vorab erklärt
  und werden nicht ausgeübt. Im Dienst sind sie nicht montiert, ein Aufruf endet im 404 des Fallbacks. Ablauf 27.11.2026:
  Ist 044 bis dahin nicht gebaut, wird das Tor rot und erzwingt die Entscheidung „bauen oder aus dem Vertrag nehmen“.
- **Demo und Dienst bleiben gleich (ADR 0002):** 043a ändert weder `HvApi` noch Domänentypen. Beide Betriebsarten
  führen denselben Kern aus.
  - Laufzeitwirkung hat 043a nur im Validator des Dienstes. `kind` und `requestedMinutes` werden nicht mehr geprüft
    (ignoriert statt 422), `reason` wird gegen das Enum geprüft (anderer Wert 422 statt Verwerfen im Kern).
  - Die Demo im Browser validiert nicht gegen den Vertrag (bekannte, hingenommene Abweichung, Folgeliste 034a). Sie
    verwirft ein falsches `reason` im Kern bzw. antwortet mit R-SPK-00/409. Fachlich ist das gleich: kein Grund landet
    im Log.
  - Die neuen Operationen gibt es in beiden Betriebsarten erst mit 044. 044 erweitert `HvApi`, den In-Process-Adapter und
    `apps/web/src/api/http.ts` gemeinsam.

## Nicht-Ziele

- Kein Anwendungscode: kein Kern, keine Route, kein Web. Keine Änderung an `ROLE_PERMISSIONS`, `PERMISSIONS`,
  `READ_PERMISSIONS`, Übergangstabelle, Regelregister oder Wahrheitstabelle.
- Nichts aus 043b–d (Zuschnitt oben). Keine Vertragszeile einer Umsetzungsscheibe, auch nicht `Classification.seatId`.
- Keine Erweiterung eines bestehenden Anfrageschemas. Die einzige Änderung an Anfrageschemas ist die Streichung und
  Einengung aus Ziel 1.
- Keine Streichung von Aliaspfaden, `StageAssignment` oder `EventActor.displayName` (bis 0.5).
- Kein neuer Ereignistyp, keine Änderung an `StreamTopic`.
- Die vier `no-unused-components`-Meldungen für die `Stream*`-Schemas (Folgeliste 035a) bleiben hingenommen. OpenAPI 3.1
  kann SSE-Nachrichten nicht anders ausdrücken.
- Grenzen der Anfrageschemas im Kern der Demo (Folgeliste 034a, dort „→ 043“): Das ist Domänencode, kein Vertrag. Es
  gehört in einen Takt der Lane core und bleibt auf der Folgeliste, mit neuem Ziel „Takt core“.
- Kein Eintrag im Entscheidungsregister. „Auf Standard gebaut“ setzt dort 044, das den Standard in Code gießt.

## Files allowed

Vertrag (Architekt, vor jedem anderen Schritt):

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
- `apps/api/src/__tests__/negative.test.ts` (nur die `kind`-Stellen)

Dokumente:

- `docs/slices/043a-vertrag-bereinigung-verweigerung.md` (diese Spec: Bericht, Review findings)
- `docs/folgeliste.md` (nur: die von 043a erledigten Einträge abhaken, 034a „→ 043“ umlenken, neue nicht blockierende Befunde)
- `docs/produktplan-beta.md` (nur nach dem Merge durch den Orchestrator: Teilungsvermerk im Eintrag 043, Vermerk
  `Classification.seatId` im Eintrag 040, Stand-Zeile Etappe C)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/domain/**` (auch `permissions.ts`, `transitions.ts`, `rules.ts`, `types.ts`, der künftige `refusalGrounds.ts`),
`packages/domain/policy-truth-table.md`, `docs/legal-trace.md`, `apps/api/src/**` außer den oben genannten Testdateien,
`apps/web/**`, `docs/entscheidungsregister.md`, `docs/adr/**`, die sechs Allowlist-Einträge von 040. Dieser Abschnitt steht
bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. Der Integrationszweig steht noch auf Vertrag 0.3.12. Ist inzwischen ein anderer Vertragsstand gemergt (etwa ein Takt
   oder der Vertragsschritt von 040), baut 043a darauf auf. 043a bleibt 0.4.0, solange 0.4.0 frei ist. Ist 0.4.0 schon
   vergeben: anhalten und melden.
2. `UNDOCUMENTED_STATUS_EXCEPTIONS` enthält genau die fünf Lücken aus dem Befund. Weicht die Liste ab, gilt der Code;
   melden.
3. `registerSpeaker` und `updateSpeaker` schreiben nur benannte Felder (`api.ts:804-828` und 843-873). Sonst anhalten:
   dann könnte ein ungeprüftes `kind` ins Log gelangen (R7), und das wäre ein Blocker für Ziel 1.
4. Ein PATCH mit leerem Body `{}` auf `/v1/speakers/{id}` antwortet 200 ohne Ereignis und ohne neue Version (takt-015).
   Das ist der Ersatz für den `requestedMinutes`-Block in `contract.test.ts`. Ist es anders, den Block mit dem
   tatsächlichen Verhalten neu fassen und im Bericht nennen.
5. Welche Operationen mit eigenem `servers`-Eintrag können 500 liefern (Ziel 2)? Befund in den Bericht.
6. Weichen Zeilenangaben ab: melden und anhalten.

## Tests zuerst (rot, dann grün; `contract-043a.test.ts`, gegen das geladene `openapiDoc`)

1. `info.version` ist 0.4.0.
2. `Speaker`, `SpeakerRegistration` und `SpeakerUpdate` haben weder `kind` noch `requestedMinutes`.
3. `SpeakerUpdate.reason` hat das Enum `[follow_up]`. `updateSpeaker` dokumentiert 409.
   HTTP: PATCH mit `reason: 'x'` → 422. `finished → waiting` mit `reason: 'follow_up'` → 200.
   `finished → waiting` ohne Grund → 409 mit `ruleId` R-SPK-GUARD-01 oder der Regel-id, die der Kern heute meldet.
4. Jede Operation aus `OPERATIONS_0_2` dokumentiert 401. `listQuestions`, `returnQuestion` und `withdrawQuestion`
   dokumentieren 422. `UNDOCUMENTED_STATUS_EXCEPTIONS` ist leer.
5. Jede Operation ohne eigenen `servers`-Eintrag dokumentiert 500 mit `InternalError`.
6. `AnswerKind` hat genau die drei Werte. `AnswerVersion.required` ist unverändert. Ajv-Prüfung der Antwortseite:
   - `{answerKind: 'answer', refusalGroundId: 'g'}` ist ungültig.
   - `{answerKind: 'refusal_with_ground'}` ohne `refusalGroundId` ist ungültig.
   - Eine Version ohne `answerKind` ist gültig.
7. `RefusalProposal`:
   - `answerKind` ohne `answer`.
   - `{answerKind: 'refusal_with_ground', text: 'x'}` ist **gültig**. Grund und Begründung erzwingt der Guard (409),
     nicht das Schema.
   - `{answerKind: 'answer', text: 'x'}` ist ungültig.
8. `listRefusalGrounds`, `proposeRefusal` und `approveRefusal` existieren mit den Pfaden und Antworten aus Ziel 3. Jede
   steht in `allowlist.json` mit `slice` `044` und `expires` `2026-11-27`.
9. `Action` enthält `question.refuse.propose` und `question.refuse.approve`.
10. **Keine stille Erweiterung (Regel 1):**
    - `AnswerDraft.properties` hat genau `text` und `sources`.
    - Der Body von `approveQuestion` hat genau `answerVersion`.
    - `Classification.properties` hat genau `track`, `agendaItemId` und `stageAssignment`.
    - `SpeakerRegistration.properties` hat genau `displayName`, `organisation` und `round`.
11. HTTP: `POST /v1/speakers` mit `kind: 'space-alien'` → 201. Die Antwort trägt kein `kind`. Das Ereignis
    `SpeakerRegistered` trägt kein `kind` (gelesen über `listEvents` als admin).

`negative.test.ts` verliert die `kind`-Hälfte des 422-Tests (Zeilen 240-249). Die `status`-Hälfte bleibt, der Fall wandert
als Test 11 hierher. In den übrigen Bodies entfällt `kind: 'shareholder'`. In `contract.test.ts` sendet der Block der
Zeilen 175-186 `{}` statt `{ requestedMinutes: 7 }` (Vor-dem-Bau-Punkt 4), der Kommentar nennt 0.4.0.

## Akzeptanzkriterium

1. `pnpm contract:lint` ist grün. Erlaubt sind nur die vier bekannten `no-unused-components`-Meldungen aus 035a.
2. `pnpm contract:types` erzeugt den eingecheckten Stand. Ein zweiter Lauf ergibt keinen Diff.
3. `check.mjs` meldet (a)–(d) `ok`, darunter `(c) … version 0.3.12 -> 0.4.0` und `(d) … 9 pre-declared operation(s)`.
4. Die Tests 1–11 sind grün. `contract.test.ts`, `negative.test.ts` und das Abdeckungstor sind grün.
5. `git diff` gegen die Merge-Basis zeigt Änderungen nur in den Dateien aus „Files allowed“. Kein bestehendes
   Anfrageschema hat ein neues Feld (Test 10).
6. `pnpm gates` (mit Postgres-Variablen wie in CI) ist grün, einschließlich `slice-scope` auf dem Zweig
   `claude/slice-043a-…`. Der Schluss der Ausgabe steht einmal im Bericht.

## Nachweise

- Ausgabe von `pnpm contract:lint` und `check.mjs` (Auszug).
- Typen-Diff: `git diff --stat` und die Hunks von `packages/contract/src/types.ts` für `AnswerKind`, `AnswerVersion`,
  `RefusalGround`, `RefusalProposal`, `Speaker*`, `Action`.
- CHANGELOG-Abschnitt 0.4.0 (Pfad und Überschrift).
- Allowlist-Diff mit drei Zeilen, Ablauf 2026-11-27.
- Schluss von `pnpm gates` mit Commit-Hash.
- Kein Screenshot: keine Oberfläche berührt.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch (Hochstufung gegenüber Plan „mittel“)
Ausgelöst: [x] Vertrag, Ereignis, Konfiguration [x] Rolle, Recht (zwei neue Bezeichner, Maskierungsregel der Begründung)
[x] Fachregel (Verweigerung, Form) [ ] Persistenz (kein neues Ereignis, keine Migration) [ ] Oberfläche
Perspektive(n): Vertrag (6.4), Legal, Security (6.5) · Nachweise: Tests 1–11, Tore · Offene Entscheidung: E15, E25, ADR 0012 (Standards unten)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** Die Scheibe legt die Vertragsform der Verweigerung fest (Leitplanken §4: „Freigabe, Verweigerung“). Sie
  führt zwei Rechtebezeichner ein und schreibt eine Maskierungsregel für eine Rechtseinschätzung fest. Sie ist die erste
  nicht additive Vertragsstufe seit 0.2.0.
- **Rechte-Diff vor dem Bau:** leer. `ROLE_PERMISSIONS` und die Wahrheitstabelle bleiben unverändert, beide neuen
  Bezeichner sind bis 044 deny by default. Vorschau für 044 (nicht Teil dieser Scheibe): propose an `legal` und
  `coordination`, approve an `approver`, **ausdrücklich nicht an `admin`**. Siehe „Hinweise an Folgescheiben“.
- **Kompatibilität:**
  - Wer `kind` oder `requestedMinutes` sendet, bricht nicht; die Felder werden ignoriert.
  - Wer `kind` oder `requestedMinutes` in Antworten erwartet, bekommt sie seit 080 ohnehin nicht mehr.
  - Wer `reason` mit einem anderen Wert als `follow_up` sendet, bekommt jetzt 422. Heute gibt es keinen solchen Client:
    die Web-Oberfläche sendet `reason` nur für R-SPK-05.
  - Partner (ADR 0008) gibt es noch keine; die Zwei-Zyklen-Regel gilt ab 043c.
- **Invarianten:** keine Anfrageerweiterung ohne Umsetzung (Test 10). Keine Verweigerung als bloßes Feld einer Antwort
  (eigene Operationen). Keine Begründung an Leser ohne Rechtsbezug (Beschreibung; Umsetzung und Negativtest in 044).
- **Fehlerfälle:**
  - Eine abgelaufene Allowlist macht das Tor rot. Das ist gewollt.
  - Ein vergessener Nachtrag in der Ausnahmeliste macht `contract.test.ts` rot. Deshalb ändern sich beide im selben
    Commit.
- **Doku- und Betriebswirkung:** keine Betriebsänderung. `docs/integration/` gibt es noch nicht (064). Der CHANGELOG ist
  die Partnerdoku.

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. Kein neues Recht ist vergeben. Prüfen: `git diff -- packages/domain` ist leer.
2. Ein ignoriertes `kind` erreicht das Log nicht (Befund, Vor-dem-Bau-Punkt 3, Test 11).
3. Die Begründung einer Verweigerung (SG2) ist im Vertrag als maskiert beschrieben. Kein Schema erzwingt sie in einer
   Antwort an Podium oder Beobachter (`refusalJustification` nie in `required`).
4. Die drei neuen Operationen sind im Dienst nicht erreichbar (nicht montiert; Allowlist; kein Treffer im Abdeckungstor).
5. `InternalError` beschreibt keinen Stack und keine internen Kennungen im `detail`.

## Standards (auf Standard gebaut; Vermerk mit Datum im CHANGELOG und im Bericht)

Die Antworten aus Feedback-Runde 2 (09.10.) und der Entscheidungsstunde (16.10.) stehen aus. 043a baut nur auf
Standards, die **keine** dieser beiden Runden betreffen. Die in der Planzeile 043 genannten offenen Punkte E2, E3a, E4,
E6, E7 und E17 liegen alle in 043b–d. Vermerk: „auf Standard gebaut am <Merge-Datum> in 043a (Vertragsform)“.

| Standard | Quelle | Was 043a daraus baut | Kosten einer späteren Änderung |
|---|---|---|---|
| Verweigerung als Antwortart, elf Zustände bleiben (Modell A) | ADR 0012 (vorgeschlagen, Annahme Prüfpunkt 4 mit Recht); Plan §3 | `AnswerKind`, Felder auf `AnswerVersion`, eigene Operationen, kein neuer Zustand | Wechsel auf Modell B: 2,5 AStd im Kern (Plan) plus rund 0,5 AStd Vertrag (neue Zustände in `QuestionStatus`, die Operationen bleiben) |
| Grundkatalog als Daten, jeder Grund `verified: false`, „ungeprüft“ sichtbar; offen, ob Pfad A Grund oder Begründung braucht | E15; ADR 0012 | `LegalRef.verified`, keine Pflicht für Pfad A im Schema, Pfad B über Guard statt Schema | Pflicht für Pfad A: 0 AStd Vertrag (Guard in 044, eine Zeile); Katalogpflege: Daten (076) |
| Freigabe durch `approver`, Recht empfiehlt; Vorschlag durch `legal` und `coordination` | E25; ADR 0012 | nur die Bezeichner `question.refuse.propose`/`approve`; Vergabe in 044 | eine Tabellenzeile, 0,5 AStd (E25); Vertrag 0 |
| Inhaltssprache `de`, keine Kopplung | E21 | `RefusalGround.title`/`stageText` einsprachig als Inhalt | zweite Sprache: optionales Feld je Text, additiv, < 0,5 AStd Vertrag |
| Begründung ist Rechtseinschätzung und maskiert | Bedrohungsmodell SG2; Vorbild `LegalClearance` ohne Notiz | Maskierungsregel in der Beschreibung | Maskierung aufheben: Beschreibung, 0 AStd Vertrag, ein Test in 044 |

## Offene Eigentümerfragen

Keine blockiert den Bau von 043a.

1. **Bau vor dem 12.10.** `scripts/plan-graph.mjs` führt für 043 den frühesten Start 12.10.2026 („nach Feedback-Runde 2“).
   Standard: 043a darf vorher bauen. Die Scheibe berührt keine Frage der Runde 2 (Abschnitt „Standards“). 043b–d halten
   den Termin. Die Tabelle in `plan-graph.mjs` bleibt; die Stand-Zeile nennt die Abweichung.
2. **Zuschnitt und Hochstufung.** Die Planzeile 043 (2 AStd, mittel) wird vier Teile mit rund 6,25 AStd, jeder hoch.
   Standard: so bauen. Der Mehraufwand fällt größtenteils mit 043d erst nach der zweiten Demo an.
3. **Maskierung der Begründung.** Standard: nur Halter von `question.refuse.propose`, `question.refuse.approve` und
   `question.legal.clear` sehen `refusalJustification`. Alternative: alle Leser der Frage. Dann ist die Begründung auch für
   Podium und Beobachter sichtbar; Recht sollte das bestätigen (E15, E25).
4. **ADR 0012 Modell A.** Liegt seit 011 bei Recht. Standard A; Kosten des Wechsels in der Tabelle oben.

## Hinweise an Folgescheiben

- **044:**
  - `ROLE_PERMISSIONS.admin` nimmt alle `PERMISSIONS` außer einer Liste (`permissions.ts:74`). Werden
    `question.refuse.*` in `PERMISSIONS` aufgenommen, muss 044 sie dort ausschließen. Sonst erhielte admin
    Verweigerungsrechte, und der Wahrheitstabellen-Diff zeigt das.
  - 044 montiert die drei Routen im Dienst und entfernt die drei Allowlist-Einträge (`slice` 044). Wie bei 040 (takt-011)
    braucht 044 dafür die Lane service in seiner Spec.
  - 044 erweitert `HvApi`, den In-Process-Adapter und `apps/web/src/api/http.ts` gemeinsam.
  - Negativtest: Podium und Beobachter sehen keine `refusalJustification`.
- **045:** „ungeprüft“ aus `legalRef.verified`, Katalog über `listRefusalGrounds`; Glossarzeile „Verweigerungsgrund“.
- **040:** Vertragszeile `Classification.seatId` und die übrigen 040-Vertragspunkte (Tabelle oben) als erster Commit mit
  Architekt. Version: nächste freie Patch-Stufe nach 0.4.0.
- **046, 048:** Regel-ids ab R-TRANS-15 (Befund oben).

## Bericht (nach Bau ausfüllen)

```
Slice: 043a-vertrag-bereinigung-verweigerung
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

**Typen-Diff (Auszug).**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
