# Scheibe 044a — Verweigerungspfad A und B im Kern, Teil 1: Regeln, Rechte, Katalog, Maskierung

**Status:** spec (01.10.2026; gelesen auf `c000567`; Teil 1 der geteilten Scheibe 044, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 2,5 AStd (Teil a; Summe a+b 3,75 statt 2,5 laut Plan) · Plan 044: 06.11.2026 (W6); frühestens nach dem Merge von 043a (Vertrag 0.4.0) und nach 040b–d in der Lane core · Lanes: core; web-api (nur `HvApi` im HTTP-Client und Live-Puffer); web-shell (nur zwei Aktionsschlüssel); docs-legal (Kopfvermerk Rechtekonzept); docs-sicherheit; docs-datenschutz (nur Zeile V7)
**Rolle:** implementierer-backend. Review in frischem Kontext mit Perspektive **Legal** (Verweigerung, Rechtstor, Grundkatalog) und **Security** (Maskierung der Begründung, SG2). Zusätzlich die Stichprobe des Architekten in eigenem frischem Kontext mit Perspektive Legal (Plan §6, Zeile 997). Lesebefund der Spec vor dem Bau; nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu R-TRANS-15 (Verweigerung vorschlagen), R-TRANS-16 (Verweigerung freigeben), R-GUARD-08 (Verweigerung nur mit Rechtsfreigabe-Ereignis), R-GUARD-09 (Grund- und Begründungspflicht), R-GUARD-11 (Katalogeintrag unverändert seit dem Vorschlag), R-GUARD-12 (Antwortversion für Antwortoperationen), R-GUARD-13 (Verweigerungsversion für die Verweigerungsfreigabe). Angewandt: R-GUARD-01, R-GUARD-03, R-GUARD-04, R-GUARD-06, R-GUARD-07, R-TRANS-00, R-TRANS-06, R-TRANS-07, R-TRANS-09, R-TRANS-13, R-PERM-01, R-PERM-02. Dazu AGENTS.md R2, R3, R4, R5, R7, R8, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 044 (Zeile 691–696), §3 „Zustandsmodell und Verweigerung“ (Zeile 215), §4 Zeile 249 (ADR 0012 „geht vor 044 an Recht“), §5 Abdeckung Zeilen 269 und 275 (Ist-Delta hoch 1, Recherche MUSS Recht Z.63/64), §6 Zeile 997 (Stichprobe des Architekten)
- ADR 0012 (Modell A, vorgeschlagen), ADR 0001, ADR 0002, ADR 0011, ADR 0015
- Spec 043a (Vertrag 0.4.0: `AnswerKind`, `RefusalGround`, `RefusalProposal`, `listRefusalGrounds`, `proposeRefusal`, `approveRefusal`, `refusalGroundHash`, Maskierungsregel, R-GUARD-11, Regel 1 des Zuschnitts, „Hinweise an Folgescheiben: 044“)
- Spec 040a (admin als ausdrückliche Liste; „Hinweise an Folgescheiben: 044“), Spec 040d (Konfigurationsfreeze mit Übergangs- und Rechtetabelle im Schnappschuss)
- `docs/anforderungen-recherche.md:24, 63, 64`; `docs/rollen-und-rechtekonzept.md` §2.4 Zeile 121, §4 Zeile 171 und 173
- Register E15, E25, E37, E40, S6, „o. Nr. 2“ (Anzeigegruppen)
- Bedrohungsmodell SG2, T-G1-I-01, T-G1-I-02, T-G1-I-04, T-G1-I-09, T-G1-E-01, T-G1-E-02, T-G1-E-03, T-G1-E-04, MF-01, MF-07; DSFA-Vorentwurf Zeile V7
- `docs/folgeliste.md`: 043a-Einträge 1 und 2 (Regel-id-Verweise, veraltete Kommentare im Kern)

**Depends on:** 043a (gemergt, Vertrag 0.4.0), 040a (gemergt in `c000567`), 021c, 011 (gemergt). Seriell nach 040b–d in der Lane core (Wahrheitstabelle ist ein Snapshot, Plan §5.1); fachlich hängt 044a nicht an 040b–d
**Perspektive:** Legal, Security · **Glossar: neue Begriffe:** nein („Verweigerung“ steht im Glossar; „Verweigerungsgrund“ kommt mit 045, wie 043a festlegt)

## Teilung und Zuschnitt

Die Planzeile 044 (2,5 AStd, hoch) nennt Antwortart, Katalog, zwei Rechte, zwei Guards, Vier-Augen, Formulierungsbaustein,
Export und die Nachweise für ADR 0012. Seit dem Plan sind drei Dinge hinzugekommen, die Arbeit kosten:
- 043a verlangt einen Katalog-Hash mit Prüfung bei der Freigabe (R-GUARD-11), einen Schnappschuss im Ereignis und die
  Maskierung der Begründung auf **jedem** Lesepfad.
- 043a erklärt drei Operationen vorab; 044 muss sie montieren, `HvApi` und den HTTP-Client erweitern und die drei
  Allowlist-Einträge vor dem 27.11.2026 entfernen.
- Seit 040a halten nur noch fachliche Rollen Schreibrechte. Daraus folgen zwei weitere Fragen: Wer gibt eine
  Verweigerung zur Prüfung (nur `expert` hält `question.submit_review`), und wie wird ausgeschlossen, dass eine
  Verweigerung über die Antwortoperationen freigegeben wird?

Geschätzt sind das rund 3,75 AStd statt 2,5. Für einen einzigen Review mit Perspektive Legal und Security ist das zu viel.
Nach dem Vorbild von 035a/035b (Kern, dann Dienst) wird 044 deshalb geteilt, **ein PR je Spec** (R12):

| Teil | Thema | Inhalt | Vertrag | Klasse · AStd |
|---|---|---|---|---|
| **044a** (diese Spec) | Regeln, Rechte, Katalog, Maskierung im Kern | `refusalGrounds.ts` mit Hash; Rechte; R-TRANS-15/16; R-GUARD-08/09/11/12/13; Projektion; Maskierung in Projektion, Bühne, Ereignis-Lesepfad und Suche; `HvApi` mit drei Methoden im Kern, im HTTP-Client und im Live-Puffer; Wahrheitstabelle mit neuem Abschnitt; Regelregister; Kopfvermerk Rechtekonzept; Bedrohungsmodell; DSFA V7 | keine Änderung (0.4.0 aus 043a deckt alles) | hoch · 2,5 |
| **044b** | Dienst und HTTP-Nachweis | Drei Routen in `apps/api/src/app.ts` montieren; die drei Allowlist-Einträge mit `slice` 044 im selben Commit entfernen (wie 035b); HTTP-Tests für 401/403/404/409/412/422, Idempotenz und `If-Match`; Maskierung über HTTP auf `getQuestion`, `listQuestions`, `listMeetingQuestions`, `getQuestionHistory`, `listEvents`, `/stream` und `getStage`; Postgres-Lauf: Vorschlag und Freigabe überstehen Neustart und Kettenprüfung; Zugriffslog mit Regel-id; gegebenenfalls Kennzahlen-Allowlist | nur `allowlist.json` (drei Einträge entfernen) | hoch · 1,25 |

**Reihenfolge a → b.** 044b kann erst bauen, wenn der Kern die Operationen kennt. Zwischen den beiden Merges sind die
Operationen im Dienst nicht montiert (404 des Fallbacks), in der Demo aber über `HvApi` erreichbar. Keine Oberfläche ruft
sie vor 045 auf. **Termin:** 044b muss vor dem **27.11.2026** gemergt sein, sonst wird
`packages/contract/scripts/check.mjs` (d) rot. Ist das absehbar nicht zu halten, verlängert der Architekt die drei
`expires` in einem eigenen Takt mit Begründung (Vorbild 040a, Abschnitt „Allowlist“).

**Die Spec von 044b** schreibt der Architekt nach dem Go zum Zuschnitt (Eigentümerfrage 2) als eigenen PR. Ihr Inhalt
steht in der Tabelle oben und im Abschnitt „Hinweise an Folgescheiben“. **Ohne Go** werden 044a und 044b eine Scheibe 044
mit der Summe beider Dateilisten und einem Review. Dann ist nur diese Datei umzubenennen und um die Liste aus 044b zu
ergänzen.

**Lanes.** Die Planzeile nennt nur `core`. 044a braucht zusätzlich web-api (`HvApi` wächst, `http.ts` und `liveStore.ts`
müssen es umsetzen, Typprüfung), web-shell (`ACTION_KEYS` ist eine erschöpfende Zuordnung über `Permission`) und die drei
Doku-Lanes. 044b braucht service und contract (nur Allowlist). Das hat 043a schon angekündigt (Eigentümerfrage 5 dort:
„Plan-Eintrag 044 erhält die Lanes service und web-api“).

## Befund (Ist-Stand, gelesen auf `c000567`)

- **Vertrag 0.3.12.** `refus` kommt zweimal vor, beide Male nur in Beschreibungen. 043a ist eine Spec und noch nicht gebaut.
  Ohne 0.4.0 kennt der Vertrag `question.refuse.*` im Enum `Action` nicht. Jede Antwort mit einem solchen `_actions`-Eintrag
  bestünde dann die Antwortprüfung der Vertragstests nicht. **043a ist harte Voraussetzung.**
- **Rechte** (`packages/domain/src/permissions.ts`):
  - `PERMISSIONS` (`types.ts:33-63`) kennt `question.refuse.*` nicht.
  - admin ist seit 040a eine ausdrückliche Liste (`permissions.ts:78-91`). Ein neues Recht fällt nicht mehr still an admin.
    Die Ausschlussliste, die 043a noch verlangte, ist damit erledigt (040a, „Hinweise an Folgescheiben“).
  - `question.submit_review` hält nur `expert` (`permissions.ts:60`). `legal` hält `answer.draft`, `question.legal.clear`,
    `question.return` und `question.claim`. `coordination` hält kein Schreibrecht auf Antworten. `approver` hält
    `question.approve`.
- **Übergänge** (`packages/domain/src/transitions.ts`):
  - R-TRANS-03 (`answer.draft`): aus `classified`, `assigned`, `answer_drafted`, `in_review` und `approved` nach
    `answer_drafted`, Guard R-GUARD-03 (Textpfad).
  - R-TRANS-04 (`question.submit_review`): `answer_drafted → in_review`.
  - R-TRANS-05 (`question.approve`): `in_review → approved`, Guards R-GUARD-01, R-GUARD-04 und R-GUARD-06.
  - R-TRANS-13 (`question.legal.clear`): in `in_review`, Guards R-GUARD-01 und R-GUARD-06.
  - R-TRANS-07 (`question.stage`): `approved → staged`, Guard R-GUARD-07. Für Textpfade verlangt dieser Guard eine
    Rechtsfreigabe derselben Version wie die Freigabe. Er hängt an `LEGAL_GATE_BY_TRACK` (Zeile 46).
  - Belegt sind R-TRANS-00..14 und R-GUARD-01..07. Frei sind R-TRANS-15 und höher sowie R-GUARD-12 und höher. Reserviert
    sind R-GUARD-08/-09 (044), R-GUARD-10 (059) und R-GUARD-11 (043a/044). Der Plan nennt R-TRANS-15/16 noch für 046 und
    R-TRANS-17 für 069. Nach 043a vergibt jede Folgespec die nächste freie Nummer; diese Spec nimmt R-TRANS-15 und 16
    (Folgeliste 043a, Eintrag 1, ergänzt um 069).
- **Projektion** (`packages/domain/src/state.ts:357-367`): `AnswerDrafted` setzt den Status fest auf `answer_drafted`
  und löscht `approval`, `legalClearance` und `returnReason`. Eine Verweigerung, die als `AnswerDrafted` geschrieben wird
  (043a: kein neuer Ereignistyp), landete also in `answer_drafted`. Dort hielte sie nur `expert` mit
  `question.submit_review` weiter. Vorbild für die Lösung ist `QuestionReturned`: Das Ereignis trägt `toStatus` aus der
  Tabelle (`state.ts:394-406`).
- **Lesepfade einer Antwortversion:**
  - `viewQuestion` (`api.ts:399-410`) gibt `answers` ungefiltert aus. Das gilt für `getQuestion`, `listQuestions`,
    `listMeetingQuestions`, jede schreibende Antwort und die historische Antwort bei Wiederholung
    (`api.ts:566, 573`).
  - `getStage` (`api.ts:1250-1264`) nutzt dieselbe Funktion. `approver` und `moderation` halten `stage.read`.
  - `getQuestionHistory`, `listEvents`, `subscribe` und `/stream` geben `maskEvent` aus (`stream.ts:169-188`). Das maskiert
    statisch nach Schlüsselnamen (`MASKED_KEYS`) und kennt den Leser nicht.
  - Die Suche (`questionMatches`, `api.ts:721-737`) durchsucht `answers[].text`.
- **Antwortversion** (`types.ts:235-241`): `version`, `text`, `createdAt`, `createdBy`, `sources`. `draftAnswer` schreibt nur
  benannte Felder (`api.ts:1139-1155`).
- **Hash-Werkzeug:** `canonicalJson` und SHA-256 über `@noble/hashes` (`envelope.ts:1, 72-94`). `canonicalJson` gibt für
  Objekte, Zeichenketten, `null` und Wahrheitswerte die Form nach RFC 8785 aus (040d, Befund). Es läuft synchron in Node
  und im Browser.
- **`LegalRef`** (`rules.ts:36-45`): `docHash: null` und `verified: false` sind Literale. `LegalSource` kennt `'AktG'`; der
  Kommentar in `rules.ts:24-26` hält es für 044 frei.
- **Oberfläche:** `ACTION_KEYS` (`apps/web/src/i18n/labels.ts:52`) ist `Record<Permission, TKey>`. Zwei neue Rechte
  erzwingen zwei Schlüssel in beiden Sprachen. Keine Ansicht rendert `_actions` generisch, jede prüft ein einzelnes Recht
  (etwa `QuestionDetail.tsx:250`). Neue Rechte bleiben also unsichtbar, bis 045 sie verwendet.
- **Tests mit genauen `_actions`-Listen:** `packages/domain/src/__tests__/api.test.ts`, `idempotency028.test.ts`,
  `apps/api/src/__tests__/acceptance.test.ts`. Für `legal` und `coordination` kommt dort `question.refuse.propose` hinzu.
- **Recherche:**
  - `docs/anforderungen-recherche.md:63` (MUSS): „(A) kein Auskunftsanspruch mit Untergründen; (B) Verweigerung trotz
    Anspruchs mit Zwangszuordnung zum gesetzlichen Katalog … **Beide brauchen Begründung und Freigabe**“.
  - `:64` (MUSS): Verweigerungsgründe vollständig als Auswahlliste, einschließlich des Sondergrunds für Finanzinstitute;
    ein leeres Feld darf nicht speicherbar sein.
  - Rechtekonzept §4 (Zeile 171): „Keine Verweigerung ohne zugeordneten Grund und Begründung“.
  - ADR 0012 hält genau diesen Punkt für Pfad A offen und nennt als Standard von 044 „Begründung nur für Pfad B“.
    Diese Spec weicht davon ab (Entscheidung 4, Eigentümerfrage 3).

## Ziel und Entscheidungen vor Bau

Eine Verweigerung ist eine unveränderliche Antwortversion mit `answerKind` `refusal_no_claim` (Verweigerungspfad A, „kein
Auskunftsanspruch“) oder `refusal_with_ground` (Verweigerungspfad B, „Verweigerung trotz Anspruchs“, mit Grund aus dem
Katalog). Sie läuft durch `in_review → approved → staged → delivered`. Dabei gelten Vier-Augen (R-GUARD-06), das Rechtstor
vor der Bühne (R-GUARD-07) und dazu R-GUARD-08, R-GUARD-09 und R-GUARD-11. Aus einer Verweigerung wird nie eine Antwort,
aus einer Antwort nie eine Verweigerung (R-GUARD-12, R-GUARD-13). Die Begründung lesen nur Halter von `question.refuse.*`.
**Auf Standard gebaut:** ADR 0012 ist von Recht nicht gelesen (Eigentümerfrage 1).

### 1. Grundkatalog (`packages/domain/src/refusalGrounds.ts`, neu)

- Typ `RefusalGroundEntry` = `{ id, title, stageText, legalRef: LegalRef }`. Typ `RefusalGround` = Eintrag plus `hash`.
  Export `REFUSAL_GROUNDS: readonly RefusalGround[]`, eingefroren (`Object.freeze` je Eintrag und Liste) wie
  `LEGAL_GATE_BY_TRACK`.
- **Hash** (Definition aus 043a, wörtlich): SHA-256, Kleinbuchstaben-Hex, über die UTF-8-Bytes der kanonischen Form nach
  RFC 8785 des Eintrags **ohne** `hash`. Berechnet wird er beim Laden des Moduls mit `canonicalJson` aus `envelope.ts`.
  Der Wertebereich ist Objekte, Zeichenketten, `null` und Wahrheitswerte; dafür stimmt `canonicalJson` mit RFC 8785
  überein. Die Zeichenketten sind Code-Daten und wohlgeformt (Test 1).
- **Einträge**, alle Pfad B, Inhaltssprache `de` (E21). Für jeden gilt:
  - `legalRef = { source: 'AktG', citation, docVersion: null, docHash: null, verified: false }`;
  - `citation` = „§ 131 Abs. 3 Satz 1 Nr. N AktG. Gliederung und Wortlaut nicht aus einer Quelle im Repositorium belegt;
    Bezug nur docs/anforderungen-recherche.md:24, :64; ungeprüft (E15)“. Das folgt der Ehrlichkeitsregel aus
    `rules.ts:5-16`: Kein Zitat wird als belegt ausgegeben, was nicht belegt ist.

  | id | title | stageText (Formulierungsbaustein) |
  |---|---|---|
  | `aktg-131-3-nr1` | Nicht unerheblicher Nachteil für die Gesellschaft | Zu dieser Frage gibt der Vorstand keine Auskunft, weil sie nach vernünftiger kaufmännischer Beurteilung geeignet wäre, der Gesellschaft oder einem verbundenen Unternehmen einen nicht unerheblichen Nachteil zuzufügen. |
  | `aktg-131-3-nr2` | Steuerliche Wertansätze oder Höhe einzelner Steuern | Zu steuerlichen Wertansätzen und zur Höhe einzelner Steuern gibt der Vorstand keine Auskunft. |
  | `aktg-131-3-nr3` | Stille Reserven | Zum Unterschied zwischen Buchwert und höherem Wert einzelner Gegenstände gibt der Vorstand keine Auskunft. |
  | `aktg-131-3-nr4` | Bilanzierungs- und Bewertungsmethoden | Zu den Bilanzierungs- und Bewertungsmethoden verweist der Vorstand auf die Angaben im Anhang und gibt darüber hinaus keine Auskunft. |
  | `aktg-131-3-nr5` | Strafbarkeit | Zu dieser Frage gibt der Vorstand keine Auskunft, weil er sich mit der Auskunft strafbar machen würde. |
  | `aktg-131-3-nr6` | Sondergrund für Kredit- und Finanzinstitute | Zu dieser Frage gibt der Vorstand keine Auskunft, weil die Angaben nach den für Institute geltenden Vorschriften nicht gemacht werden müssen. |
  | `aktg-131-3-nr7` | Auskunft auf der Internetseite zugänglich | Die Auskunft ist seit mindestens sieben Tagen vor der Hauptversammlung auf der Internetseite der Gesellschaft zugänglich; der Vorstand verweist darauf. |

  Die Liste deckt Recherche Z.64 ab (vollständig, mit Sondergrund für Institute). Ob Wortlaut, Nummerierung und die
  Bausteine tragen, prüft Recht (E15, 076). Bis dahin zeigt die Oberfläche „ungeprüft“ (045).
- **Unterscheidung zu Pfad A.** Pfad A trägt keinen Katalogeintrag (Vertrag 0.4.0: `refusalGroundId` bei
  `refusal_no_claim` ist 422). Die „Untergründe“ aus Recherche Z.63 (nicht erforderlich, kein TOP-Bezug, keine
  Legitimation, verspätet) baut 044 nicht (Nicht-Ziel; Eigentümerfrage 3b).

### 2. Rechte (`packages/domain/src/permissions.ts`, `types.ts`)

- `PERMISSIONS` erhält `question.refuse.propose` und `question.refuse.approve`, **unmittelbar nach `question.legal.clear`**.
  Die Stelle bestimmt die Spaltenreihenfolge der Wahrheitstabelle.
- `ROLE_PERMISSIONS`: `legal` und `coordination` erhalten `question.refuse.propose`, `approver` erhält
  `question.refuse.approve` (E25, ADR 0012). **Keine andere Rolle**, insbesondere nicht admin: Dessen Liste bleibt
  unverändert (040a).
- **Leserkreis der Begründung als Daten:** `REFUSAL_JUSTIFICATION_READ: readonly Permission[] =
  ['question.refuse.propose', 'question.refuse.approve']` in `permissions.ts`. Wer eines davon hält, liest die Begründung
  (043a, Leserkreis). Nicht über `question.legal.clear`.
- `READ_PERMISSIONS` erhält `listRefusalGrounds: ['question.read', 'question.read.delivered', 'stage.read']` (043a). Alle
  drei stehen schon in `READ_PERMISSION_LIST`; die Tabelle „Role × Leserecht“ ändert sich nicht.

### 3. Übergangstabelle (Wahrheitstabellen-Diff unten)

| Regel | Aktion | von | nach | Guards |
|---|---|---|---|---|
| **R-TRANS-15** | `question.refuse.propose` | `classified`, `assigned`, `answer_drafted`, `in_review`, `approved` | `in_review` | R-GUARD-03 (Textpfad), R-GUARD-09 |
| **R-TRANS-16** | `question.refuse.approve` | `in_review` | `approved` | R-GUARD-01, R-GUARD-13, R-GUARD-04, R-GUARD-06, R-GUARD-08, R-GUARD-11 |
| R-TRANS-04 (geändert) | `question.submit_review` | unverändert | unverändert | + R-GUARD-12 |
| R-TRANS-05 (geändert) | `question.approve` | unverändert | unverändert | + R-GUARD-12 (vor R-GUARD-04) |

Entscheidungen dazu:

- **Der Vorschlag führt direkt nach `in_review`** (Frage aus 043a, „Hinweise an 044“). Die andere Möglichkeit wäre
  `question.submit_review` für `legal` und `coordination`. Dann dürften beide auch fremde Antwortentwürfe zur Prüfung
  geben, was die Rollen verwischt. Ein Zwischenschritt „zur Prüfung geben“ prüft bei einer Verweigerung nichts: Ihr Inhalt
  ist schon die Rechtseinschätzung.
- **Umsetzung ohne neuen Ereignistyp:** `proposeRefusal` schreibt **ein** `AnswerDrafted`, dessen Nutzlast zusätzlich
  `toStatus` aus der Tabelle trägt (Vorbild `QuestionReturned`). Der Reducer setzt `q.status = payload.toStatus ??
  'answer_drafted'`. Alte Ereignisse ohne `toStatus` bleiben gleich (Test 18). Die Tabelle bleibt die einzige Quelle des
  Zielstatus (AGENTS.md R5): `build` erhält `to` aus `resolveTransition` und schreibt genau diesen Wert.
- **Nur Textpfade (R-GUARD-03).** Eine Podiumsfrage (`podium`) hat keine Antwortversion. Ihre Rechtsfreigabe ist
  versionslos (R-TRANS-14), und R-GUARD-07 prüft für sie nur „es gibt eine Freigabe“. Eine Verweigerung dort bräuchte
  eigene Zeilen für das Rechtstor. Standard: Die Koordination klassifiziert die Frage zuerst auf einen Textpfad um
  (R-TRANS-01 aus `classified`), dann wird verweigert. Eigentümerfrage 5.
- **Nicht aus `staged`, `delivered` oder terminalen Status.** Eine Frage auf der Bühne wird zuerst zurückgegeben
  (R-TRANS-06). Eine Korrektur nach dem Vorlesen läuft heute über die Rückgabe aus `delivered` (R-TRANS-06) und eine neue
  Version. Das Kennzeichen `correctionOpen` kommt mit 046.
- **R-TRANS-03 bleibt unverändert.** Ein neuer Antwortentwurf über einer Verweigerung ist eine neue, höhere Version, keine
  Umwandlung. Die Verweigerungsversion bleibt im Log und in `answers` stehen. Die neue Antwort braucht erneut Rechtsfreigabe
  und Freigabe. Missbrauchsfall siehe unten, Eigentümerfrage 6.
- **R-TRANS-13 bleibt unverändert.** Die Rechtsfreigabe einer Verweigerungsversion ist eine normale Rechtsfreigabe dieser
  Version. Vier-Augen gilt (R-GUARD-06): Wer die Verweigerung vorgeschlagen hat, gibt sie nicht rechtlich frei.
- **Rückgabe (R-TRANS-06)** aus `in_review` oder `approved` führt eine Verweigerung nach `answer_drafted`. Von dort geht
  es nur weiter über einen neuen Vorschlag (neue Version) oder einen neuen Antwortentwurf. `question.submit_review` auf
  der zurückgegebenen Verweigerung ist 409 R-GUARD-12, `approveRefusal` aus `answer_drafted` ist 409 R-TRANS-00.

### 4. Guards (Definitionen; `check(q, payload, ctx)`)

„Letzte Version“ ist `q.answers[q.answers.length - 1]`. Eine Version ohne `answerKind` gilt als `answer` (Vertrag 0.4.0).

- **R-GUARD-08 `refusalLegallyCleared`:** `q.legalClearance?.answerVersion === letzte.version`. Hängt **nicht** an
  `LEGAL_GATE_BY_TRACK`. Ohne Nutzlast gilt dieselbe Prüfung, `_actions` zeigt die Freigabe also erst nach der
  Rechtsfreigabe. Warum zusätzlich zu R-GUARD-07: R-GUARD-07 greift erst beim Stellen auf die Bühne und folgt der
  Pfadtabelle. Würde ein Pfad dort einmal abgeschaltet, liefe eine Verweigerung ohne Recht durch. R-GUARD-08 verlangt die
  Rechtsfreigabe schon vor der Freigabe der Verweigerung und für jeden Pfad (B6, „kein Eilpfad“, E25).
- **R-GUARD-09 `refusalGroundAndJustification`:** Ohne Nutzlast (`_actions`) ist der Guard wahr, denn er ist immer
  erfüllbar: Der Katalog ist nie leer (Test 1), Pfad A braucht keinen Grund. Mit Nutzlast:
  - `refusal_with_ground`: `refusalGroundId` ist eine nicht leere Zeichenkette, **und** `refusalJustification.trim()`
    ist nicht leer;
  - `refusal_no_claim`: `refusalJustification.trim()` ist nicht leer. Das ist die Abweichung vom Satz in ADR 0012. Grund:
    Recherche Z.63 (MUSS, „Beide brauchen Begründung und Freigabe“) und Rechtekonzept §4. Zurück auf den ADR-Wortlaut
    kostet eine Bedingung, < 0,25 AStd (Eigentümerfrage 3).

  Fehlt etwas, antwortet der Guard 409 mit R-GUARD-09, ohne Ereignis.
- **R-GUARD-11 `refusalGroundUnchanged`:** Ist die letzte Version `refusal_with_ground`, dann gibt es in `REFUSAL_GROUNDS`
  einen Eintrag mit `id === refusalGroundId`, und dessen `hash === refusalGroundHash`. Für Pfad A und für Antworten ist
  der Guard wahr. Er liest den Katalog als Daten-Import wie `LEGAL_GATE_BY_TRACK`; der Katalog wird nicht injiziert. Die
  Projektion hängt nie vom aktuellen Katalog ab (R7, Wiederaufbau): Der Guard wirkt nur zum Zeitpunkt des Befehls.
- **R-GUARD-12 `latestIsAnswer`:** Die letzte Version hat kein `answerKind` oder `answerKind === 'answer'`. Steht an
  R-TRANS-04 und R-TRANS-05.
- **R-GUARD-13 `latestIsRefusal`:** Die letzte Version hat `answerKind` `refusal_no_claim` oder `refusal_with_ground`.
  Steht an R-TRANS-16.

Zwei Guards statt eines, weil `ruleRegister()` (`rules.ts:435-443`) Guards nach Regel-id entdoppelt. Eine id mit zwei
`check`-Funktionen verlöre eine davon aus Register und Szenariotest.

### 5. Operationen im Kern (`HvApi`, `createInProcessApi`)

- **`listRefusalGrounds(): Promise<RefusalGround[]>`:** `requireReadPermission('listRefusalGrounds')`. Ergebnis ist eine
  Kopie von `REFUSAL_GROUNDS` mit `hash`, global und ohne Jahrgang (043a).
- **`proposeRefusal(id, input: RefusalProposal, opts?): Promise<Question>`**, Reihenfolge wie bei `draftAnswer` und
  `classifyQuestion`:
  1. Eingabeprüfung mit 422, vor `transition()`. Die Demo prüft nicht gegen den Vertrag (Folgeliste 034a), deshalb prüft
     der Kern selbst:
     - `answerKind` ist nicht `refusal_no_claim` oder `refusal_with_ground`;
     - `text.trim()` ist leer;
     - Pfad A trägt `refusalGroundId`;
     - Pfad B nennt ein `refusalGroundId`, das nicht im Katalog steht (043a: „unbekannt ist 422“, hiermit bestätigt).

     Der Katalog ist allgemein lesbar; die Prüfung verrät nichts über Fragen.
  2. `transition(id, 'question.refuse.propose', opts, input, build)`: 404 bzw. 403 R-PERM-01, `If-Match`, Tabelle (R-TRANS-00,
     R-GUARD-03, R-GUARD-09).
  3. `build` schreibt `AnswerDrafted` mit dieser Nutzlast:
     - `answer`, aus benannten Feldern: `version` = `answers.length + 1`, `text` getrimmt, `createdAt` = `now()` (R8),
       `createdBy` = `{ id, role }`, `sources` falls gesetzt, `answerKind`;
     - nur bei Pfad B: `refusalGroundId`, `refusalGroundHash` (Hash des Eintrags **jetzt**) und der Schnappschuss
       `refusalGround: { title, stageText, legalRef }`;
     - `refusalJustification` getrimmt;
     - `invalidatedApprovalOfVersion`, falls eine Freigabe bestand;
     - `toStatus: to`.
- **`approveRefusal(id, answerVersion, opts?): Promise<Question>`:** `transition(id, 'question.refuse.approve', opts,
  { answerVersion }, …)` schreibt `QuestionApproved { answerVersion }` wie `approveQuestion`. Guards siehe Tabelle.
- **`draftAnswer` bleibt bei benannten Feldern.** `answerKind` und `refusal*` im Eingabeobjekt werden nicht übernommen.
  Eine Antwortversion trägt kein `answerKind` (fehlt = `answer`, Vertrag 0.4.0). Das erfüllt die Zeile von 043a „ab 044
  schreibt `draftAnswer` immer `answer`“ ohne neues Feld in jedem Antwortereignis. Der Korpus und die Ereignis-Fixtures
  bleiben dadurch unverändert.
- **Projektion:** Der Reducer übernimmt `answer` **ohne** `refusalGround` in `q.answers`. Der Schnappschuss steht nur im
  Ereignis (Audit-Pfad, 043a); `AnswerVersion` im Vertrag kennt kein solches Feld.
- **Idempotenz:** `idempotent('question.refuse.propose:<id>' …)`. Die historische Antwort läuft über den Zweig
  `operation.startsWith('question.')` (`api.ts:569-574`) und damit über dieselbe maskierende `viewQuestion` mit dem
  **aktuellen** Leser.

### 6. Maskierung der Begründung (SG2; Regel aus 043a, gebaut hier)

- **`viewQuestion`:** Für **jede** Version in `answers`, nicht nur die letzte, entfällt `refusalJustification`, außer
  `REFUSAL_JUSTIFICATION_READ.some((p) => can(actor(), p).allow)`.
  - `can` wird **ohne Frage** aufgerufen. Mit Frage würde die Übergangstabelle mitentscheiden, und `approver` sähe die
    Begründung nur dann, wenn eine Freigabe gerade möglich ist (Mutationsprobe 1).
  - Eine Begründung in einer älteren, verdrängten Version bleibt genauso maskiert.
- **`getStage`:** `refusalJustification` entfällt **immer**, auch für `approver` und `moderation`. Umsetzung als Option von
  `viewQuestion` (etwa `{ stage: true }`), nicht als zweite Kopie der Ansicht.
- **Ereignis-Lesepfad:** `MASKED_KEYS` (`stream.ts:169`) erhält `refusalJustification`. Damit fehlt das Feld in jedem
  `EventRead` für jeden Leser: `getQuestionHistory`, `listEvents`, `subscribe` und `/stream`. Der Schnappschuss
  `refusalGround` bleibt sichtbar (Katalogdatum).
- **Suche:** `questionMatches` nimmt `refusalJustification` nicht in den Suchtext auf. Der Wortlaut `text` bleibt
  durchsuchbar.
- **Fehlermeldungen:** Kein `detail` einer 409 oder 422 enthält Text oder Begründung. Das 422 bei unbekanntem Grund
  nennt nur die id.
- **Nicht maskiert:** `answerKind`, `refusalGroundId`, `refusalGroundHash`, `text` (043a).

### 7. Oberfläche und HTTP-Client (nur, was die Typprüfung erzwingt)

- `apps/web/src/api/http.ts`: drei Methoden gegen die Pfade aus 0.4.0:
  - `GET /refusal-grounds`;
  - `POST /questions/{questionId}/refusals` mit `write` (Idempotenz, CSRF, `If-Match`), wie `draftAnswer`;
  - `POST /questions/{questionId}/refusal-approvals` mit Body `{ answerVersion }`.
- `apps/web/src/api/liveStore.ts`: `proposeRefusal` und `approveRefusal` in `WRITE_METHODS`. `listRefusalGrounds` wird
  durchgereicht oder in `READ_TOPICS` mit leerer Themenliste eingetragen, je nachdem, was die Vollständigkeitsprüfung (p)
  in `liveStore.test.ts` verlangt (Vor-dem-Bau-Punkt 6).
- `labels.ts`: `ACTION_KEYS` erhält zwei Einträge. Dazu die Schlüssel `action.question.refuse.propose` („Verweigerung
  vorschlagen“ / „Propose refusal“) und `action.question.refuse.approve` („Verweigerung freigeben“ / „Approve refusal“) in
  `shell.de.ts`/`shell.en.ts`. Die deutschen Texte stehen schon im Rechtekonzept (Zeilen 58-59).
- Keine Ansicht ändert sich. Kein Screenshot (Abschnitt „Nachweise“).

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

Gezählt auf `c000567`. Mergen 040b–d vorher Änderungen an Bündeln, zählt der Bericht neu. Die Aussagen über die 044-Spalten
bleiben gleich.

**Abschnitt 1, Role × Status × Action.** Jede Zeile erhält zwei Spalten **nach `q.legal.clear`**: `q.refuse.propose` und
`q.refuse.approve`. Textlich ändert sich damit jede der 198 Zeilen; inhaltlich gilt:
- `q.refuse.propose` ist **✓ in genau 10 Zellen**: `coordination` und `legal`, jeweils in den Textpfad-Zeilen
  `classified`, `assigned`, `answer_drafted`, `in_review` und `approved`. Die Podiumszeilen bleiben `·` (R-GUARD-03).
- `q.refuse.approve` ist **in allen Zeilen `·`**. Die repräsentative Frage trägt eine Antwortversion, also schlägt
  R-GUARD-13 fehl. Sichtbar wird das Recht im neuen Abschnitt unten.
- **Keine bestehende Zelle ändert sich.** R-GUARD-12 ist für die repräsentative Antwortversion erfüllt.

```
- | legal | in_review | · | ✓ | · | · | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | ✓ | · |
+ | legal | in_review | · | ✓ | · | · | ✓ | · | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | ✓ | · |
- | coordination | classified | · | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | ✓ | · |
+ | coordination | classified | · | · | ✓ | ✓ | · | · | · | · | ✓ | · | · | · | · | · | · | · | ✓ | · |
- | approver | in_review | · | · | · | · | · | · | ✓ | · | ✓ | · | · | · | · | · | ✓ | · |
+ | approver | in_review | · | · | · | · | · | · | ✓ | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
```

**Neuer Abschnitt „Role × Verweigerung“**, erzeugt vom selben Test mit derselben `can()`-Entscheidung. Repräsentative
Frage: Textpfad `expert_track`, Status `in_review`.
- Version 1 ist eine Antwort von `e` (`expert`).
- Version 2 ist `refusal_with_ground` von `l` (`legal`), Grund `aktg-131-3-nr1` mit aktuellem Hash.
- Zeile „frei“: `legalClearance = { answerVersion: 2, clearedBy: k }`. Zeile „offen“: ohne Rechtsfreigabe.
- Akteur `x`; Nutzlast für die beiden Freigaben `{ answerVersion: 2 }`.

| Role | Rechtsfreigabe | q.refuse.propose | q.refuse.approve | q.approve | q.submit_review | q.legal.clear | answer.draft |
|---|---|---|---|---|---|---|---|
| moderation | frei | · | · | · | · | · | · |
| moderation | offen | · | · | · | · | · | · |
| capture | frei | · | · | · | · | · | · |
| capture | offen | · | · | · | · | · | · |
| coordination | frei | ✓ | · | · | · | · | · |
| coordination | offen | ✓ | · | · | · | · | · |
| expert | frei | · | · | · | · | · | ✓ |
| expert | offen | · | · | · | · | · | ✓ |
| legal | frei | ✓ | · | · | · | ✓ | ✓ |
| legal | offen | ✓ | · | · | · | ✓ | ✓ |
| approver | frei | · | ✓ | · | · | · | · |
| approver | offen | · | · | · | · | · | · |
| podium | frei | · | · | · | · | · | · |
| podium | offen | · | · | · | · | · | · |
| admin | frei | · | · | · | · | · | · |
| admin | offen | · | · | · | · | · | · |
| observer | frei | · | · | · | · | · | · |
| observer | offen | · | · | · | · | · | · |

Was der Abschnitt belegt:
- `q.approve` ist auf einer Verweigerung für niemanden möglich (R-GUARD-12).
- `q.refuse.approve` gibt es nur für `approver` und nur nach der Rechtsfreigabe dieser Version (R-GUARD-08).
- admin hält nichts davon (T-G1-E-04).

Die Tabellen „Role × Leserecht“, „Role × Agenda“, „Role × Identität und Rollenverwaltung“ und „Role × Wortmeldung,
Erfassung und Demo“ bleiben unverändert. Der Bericht nennt den Diff wörtlich.

## Missbrauchsfälle, Erkennung und Zusammenspiel mit Freeze, Ablauf und Korrektur

Lehre aus 040: Für jeden neuen Mechanismus stehen die Missbrauchsfälle und das Zusammenspiel hier **vor** dem Bau.
- „Freeze“ ist der Konfigurationsfreeze aus 040d. Sein Schnappschuss enthält Rechte- und Übergangstabelle.
- „Ablauf“ meint Rollenzuordnungen mit `expiresAt`, die Übernahme (028) und die Allowlist.
- „Korrektur“ meint die Rückgabe aus `delivered` (R-TRANS-06) und später `correctionOpen` (046).

### Guards R-GUARD-08, R-GUARD-09, R-GUARD-12, R-GUARD-13 und Vier-Augen

| Missbrauch oder Fehlgebrauch | Abwehr | Erkennung, Nachweis |
|---|---|---|
| Verweigerung über `draftAnswer` eingeschleust (`answerKind` im Body), am Recht `question.refuse.propose` vorbei | `draftAnswer` schreibt nur benannte Felder; Vertrag: `AnswerDraft` ohne `answerKind` (043a, Test 10) | Test 16; 044b: derselbe Fall über HTTP |
| Verweigerung über `approveQuestion` freigegeben, am Recht `question.refuse.approve` vorbei | R-GUARD-12 an R-TRANS-05 | Test 11; Abschnitt „Role × Verweigerung“ |
| Antwort über `approveRefusal` freigegeben | R-GUARD-13 | Test 11 |
| Zurückgegebene Verweigerung von `expert` erneut zur Prüfung gegeben | R-GUARD-12 an R-TRANS-04 | Test 21 |
| Verweigerung freigegeben ohne Rechtsfreigabe (T-G1-E-03), auch bei abgeschalteter Pfadzeile | R-GUARD-08, unabhängig von `LEGAL_GATE_BY_TRACK` | Test 9; abgewiesener Versuch als 409 mit Regel-id im Zugriffslog (033a, ab 044b über HTTP) |
| Selbstfreigabe: Vorschlagende gibt rechtlich frei oder gibt frei, auch nach Rollenwechsel mit demselben Subject (T-G1-E-02, MF-07) | R-GUARD-06 an R-TRANS-13 und R-TRANS-16 vergleicht die Akteur-id | Test 10 |
| Eine Person mit zwei Subjects schlägt vor und gibt frei | nicht technisch abwehrbar (MF-01, Restrisiko) | `RoleAssigned` je Subject in `listEvents`; Alarmvorschlag an 085 aus 040a („Zuordnung eines Freigabe- oder Rechtsrechts“) |
| „Kein Kommentar“ als Begründung oder leere Begründung (Recherche Z.64) | R-GUARD-09 trimmt; leer ist 409 | Test 5. Ein inhaltsleerer, nicht leerer Text („k. A.“) ist nicht abwehrbar; dafür sorgen Freigabe und Rechtsfreigabe durch zwei weitere Personen |
| Verweigerung als Antwort verkleidet: `legal` oder `expert` schreibt „dazu keine Angaben“ in eine normale Antwort, ohne Grund und ohne `refuse.approve` | nicht technisch abwehrbar (Inhalt); die Antwort braucht trotzdem Rechtsfreigabe und Freigabe | Restrisiko, benannt; Prüfliste je Pfad (059) und Soll-Ist (049) sind die Folgekontrollen |
| `expert` verdrängt eine vorgeschlagene Verweigerung durch einen neuen Antwortentwurf (R-TRANS-03 aus `in_review`) | erlaubt (neueste Version gilt); die Antwort braucht erneut Rechtsfreigabe und Freigabe | Ereignisse `AnswerDrafted` mit Akteur und Antwortart in der Historie; Test 22; Eigentümerfrage 6 |
| Massenhaft Verweigerungen vorschlagen, um Fragen zu verzögern | jede braucht Rechtsfreigabe und Freigabe durch zwei andere Personen | Historie je Frage; Zähler je Status (053); Kennzahl „Verweigerungen je Pfad“ als Vorschlag an 053/087, nie je Person (6.6) |

**Zusammenspiel:**
- **Freeze:** Rechte und Übergänge stehen im Freeze-Schnappschuss (040d). Eine spätere Änderung der Guards (etwa R-GUARD-08
  entfernt) kommt nur mit einem Deploy. Ein neuer Freeze bzw. Override zeigt dann einen anderen Hash und eine andere
  Build-Kennung. Ist 040d vor 044a gemergt, ändert 044a den Inhalt jedes **künftigen** Schnappschusses. Ein schon
  eingefrorener Jahrgang behält seinen Schnappschuss; der Unterschied ist bewusst und erkennbar (Test 20).
- **Ablauf:** Eine Rechtsfreigabe bleibt gültig, wenn die Zuordnung der Juristin danach abläuft; das Ereignis ist eine
  Tatsache. Wer seine Zuordnung verloren hat, kann weder vorschlagen noch freigeben (Akteur-Auflösung, 029b). Die
  Übernahme (028) blockiert keinen Vorschlag; sie ist nur Anzeige.
- **Korrektur:**
  - Rückgabe aus `delivered` nach `answer_drafted`: Die vorgelesene Verweigerung bleibt im Log. `QuestionDelivered`
    nennt ihre Version (R-TRANS-09). Erst eine neue Version (Antwort oder Verweigerung) bringt die Frage wieder nach
    `in_review`. Der Reducer löscht dabei die alte Rechtsfreigabe (`state.ts:363`); einen Weg mit veralteter
    Rechtsfreigabe gibt es nicht (Test 21).
  - Mit 046 (`correctionOpen`): Das Kennzeichen sitzt auf der Frage, nicht auf der Version. 046 prüft, ob seine Zeilen
    den Vorschlag als neue Version zulassen (Hinweis an 046).

### Katalog-Hash R-GUARD-11

| Missbrauch oder Fehlgebrauch | Abwehr | Erkennung, Nachweis |
|---|---|---|
| Wortlaut oder Zitat eines Grundes wird nach dem Vorschlag geändert; die Freigabe gälte einem Text, den niemand vorgeschlagen hat | R-GUARD-11: Hash der Version ≠ aktueller Hash → 409; neu vorschlagen | Test 12; `_actions` ohne `question.refuse.approve` für `approver` |
| Eintrag wird aus dem Katalog entfernt | R-GUARD-11: kein Eintrag → 409 | Test 12 |
| Katalogänderung ohne sichtbare Spur im Repositorium | Die Liste der Hashes ist im Test festgeschrieben (Inline-Snapshot); jede Änderung am Eintrag macht ihn rot und erscheint im Diff | Test 1 mit Mutationsprobe |
| Nachträglich wird behauptet, bei der Freigabe habe ein anderer Wortlaut gegolten | Schnappschuss `refusalGround` im Ereignis; `sha256(JCS({ id, ...Schnappschuss }))` = `refusalGroundHash` | Test 3 rechnet nach; die Hash-Kette der Ereignisse schützt Schnappschuss, Text und Begründung (ADR 0011) |
| Ein Fehler im Hash-Code lässt R-GUARD-11 immer bestehen | unabhängige Nachrechnung im Test mit einer erwarteten kanonischen Zeichenkette | Test 1, Mutationsprobe 6 |

**Zusammenspiel:**
- **Freeze:** Der Katalog ist globales Code-Datum und steht **nicht** im Freeze-Schnappschuss (043a verwarf einen Katalog je
  Jahrgang). Ein Deploy mit geändertem Katalog während der HV sperrt die Freigabe aller offenen Pfad-B-Vorschläge mit
  geändertem Eintrag. Sie müssen neu vorgeschlagen werden. Das ist fachlich richtig, kostet am HV-Tag aber Zeit.
  - Abwehr: Freeze-Kalender des Runbooks (B14, 070): kein Katalog-Deploy zwischen Freeze und Debattenschluss.
  - Erkennung: 409 R-GUARD-11 im Zugriffslog; Build-Kennung im Schnappschuss (040d).
  - Ob der Katalog-Digest zusätzlich in den Schnappschuss gehört: Eigentümerfrage 7.
- **Ablauf:** Nicht berührt. Die Allowlist-Einträge laufen am 27.11.2026 ab (044b).
- **Korrektur:** Eine vorgelesene Verweigerung behält Hash und Schnappschuss, auch wenn der Katalog sich später ändert.
  Der Guard wirkt nur bei der Freigabe. Eine Korrektur schlägt neu vor und hält den dann gültigen Eintrag fest.

### Maskierung der Begründung

| Missbrauch oder Fehlgebrauch | Abwehr | Erkennung, Nachweis |
|---|---|---|
| Begründung über `getQuestion`/`listQuestions` gelesen als admin, `moderation`, `capture`, `expert` oder `observer` (T-G1-I-01, T-G1-E-04) | `viewQuestion` mit `REFUSAL_JUSTIFICATION_READ` | Test 14 |
| Begründung über die Historie gelesen (`history.read` ohne `refuse.*`) | `MASKED_KEYS` | Test 14 |
| Begründung über `listEvents` oder `subscribe` gelesen, admin mit `event.read` (T-G1-I-02, T-G1-I-09) | `MASKED_KEYS`; dasselbe gilt für `/stream` | Test 14; 044b über HTTP und SSE |
| Begründung über die Bühne gelesen (`approver` und `moderation` halten `stage.read`, `podium` sowieso) | `getStage` maskiert immer | Test 14 |
| Begründung über die Suche erschlossen (T-G1-I-04) | nie im Suchtext | Test 15 |
| Begründung über eine Wiederholung mit gleichem Idempotenzschlüssel gelesen | Schlüssel gilt je Akteur (`api.ts:599`); die historische Antwort maskiert nach aktuellem Leser | Test 14 (Wiederholung) |
| Begründung einer älteren, durch eine Antwort verdrängten Verweigerung gelesen | Maskierung gilt für jede Version | Test 14 |
| Rechtseinschätzung landet im Vermerk der Rechtsfreigabe (`QuestionLegalCleared.note`), den jeder Halter von `history.read` sieht | nicht abgewehrt (bestehendes Verhalten, 043a „Präzedenzfall“) | Restrisiko, benannt; Hinweis an 045 (Dialog: „keine Begründung in den Vermerk“) und an 059; Eigentümerfrage 4 |
| Begründung im Zugriffslog oder in einer Fehlermeldung | Zugriffslog ohne Nutzdaten (ADR 0013); kein `detail` mit Text | Test 5 und Test 6 prüfen `detail` |

**Zusammenspiel:**
- **Freeze:** Der Leserkreis ist Rechtedatum und steht damit im Schnappschuss (040d).
- **Ablauf:** Rechte gelten zum Zeitpunkt des Lesens. Wer `legal` verliert, sieht die Begründung beim nächsten Abruf nicht
  mehr. Der Strom liefert ohnehin nur Änderungssignale bzw. maskierte Ereignisse (R-PERM-04).
- **Korrektur:** Verdrängte Versionen bleiben maskiert (Zeile oben). Das gespeicherte Original behält die Begründung
  (Append-only, R7).

## Datenschutz (DSFA-Vorentwurf, Zeile V7)

- **Felder:** `answerKind`, `refusalGroundId`, `refusalGroundHash`, Schnappschuss, `text`, `refusalJustification`;
  Ersteller und Freigebende als Akteur-id; Klarnamen nur über die Personentabelle (026).
- **Empfänger:**
  - die Begründung: nur Halter von `question.refuse.*` (`legal`, `coordination`, `approver`);
  - Antwortart, Grund und Wortlaut: alle Leser der Frage, die Bühne ab `staged`, der Beobachter ab `delivered`.
- **Aufbewahrung:** Klasse `record` wie die Antwortversion. Die Begründung liegt im gespeicherten Ereignis im Klartext,
  wie der Antworttext, nicht im `pii`-Umschlag.
- **Datensparsamkeit:**
  - Die Begründung ist eine Rechtseinschätzung zur Frage, keine Angabe über Personen. Die Dialoghilfe in 045 sagt „keine
    Namen von Aktionären oder Dritten“.
  - Ob eine Begründung, die doch Personendaten enthält, unter die Betroffenenauskunft fällt, ist ein offener Punkt für den
    DSB (E14). Ein Umschreiben des Nachweises ist ausgeschlossen (R7).
- **V7 wird berichtigt:** Statt „Kein Zustand ohne Grund speicherbar“ steht dort: Pfad B nicht ohne Grund, kein Pfad ohne
  Begründung. Statt „Recht, Freigabe, Podium“: die Empfänger wie oben.

## Nicht-Ziele

- Kein Vertragsschritt. 0.4.0 aus 043a deckt Schemas, Operationen und Rechte. Ein Feld, das 0.4.0 nicht kennt, ist ein
  Befund: anhalten und melden, nicht still ergänzen.
- Keine Dienstroute, keine Allowlist-Änderung, keine HTTP-Tests der neuen Operationen (044b).
- Keine Oberfläche: kein Dialog, kein Kennzeichen, kein „ungeprüft“-Abzeichen, keine Historienzeile „Verweigerung
  vorgeschlagen“ (045). Nur die zwei Aktionsschlüssel, die die Typprüfung erzwingt.
- Kein Export, keine Markierung in der Niederschrift-Anlage (051; Begründung im Export: 043d, Standard nein).
- Kein gebundenes Nutzlastschema für `AnswerDrafted` (043c). 043c nimmt `toStatus` und `refusalGround` auf (Hinweis).
- Keine Untergründe für Pfad A, kein Katalog für Pfad A (Eigentümerfrage 3b).
- Kein Modell B, keine neuen Zustände, keine Anzeigegruppen (Register „o. Nr. 2“).
- Keine Kennzeichen `deferred`, `correctionOpen`, `followUp` (046); keine Prüfliste (059, R-GUARD-10); kein Alarm (085).
- Keine Verweigerung auf Podiumsfragen (Eigentümerfrage 5).
- Kein Beispiel einer Verweigerung im Seed (045 entscheidet über Demodaten).
- Keine Zähldefinition für Verweigerungen (053/087).
- Keine Änderung an ADR 0012 (der Vermerk „auf Standard gebaut“ steht in den Regeltexten, im Rechtekonzept, im Register
  und im Bericht).

## Files allowed

Kern:

- `packages/domain/src/refusalGrounds.ts` (neu)
- `packages/domain/src/types.ts` (nur: `AnswerKind`, die vier optionalen Felder an `AnswerVersion`, `RefusalProposal`, die zwei Einträge in `PERMISSIONS`, der Eintrag `listRefusalGrounds` in `READ_PERMISSIONS`; dazu der veraltete Kommentar aus Folgeliste 043a, Eintrag 2)
- `packages/domain/src/permissions.ts` (nur die Bündel von `legal`, `coordination`, `approver` und `REFUSAL_JUSTIFICATION_READ`)
- `packages/domain/src/transitions.ts` (nur R-TRANS-15, R-TRANS-16, die fünf Guards und R-GUARD-12 an R-TRANS-04 und R-TRANS-05)
- `packages/domain/src/events.ts` (nur die Nutzlast von `AnswerDrafted`: `toStatus`, Schnappschuss, Verweigerungsfelder)
- `packages/domain/src/state.ts` (nur der Fall `AnswerDrafted`: `toStatus`, Schnappschuss nicht in die Projektion)
- `packages/domain/src/api.ts` (nur: `HvApi` um drei Methoden, ihre Umsetzung, die Maskierung in `viewQuestion` und `getStage`; dazu der veraltete Kommentar aus Folgeliste 043a, Eintrag 2)
- `packages/domain/src/stream.ts` (nur `MASKED_KEYS`)
- `packages/domain/src/index.ts` (nur Export des Katalogs)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `docs/legal-trace.md` (nur regeneriert)

Tests im Kern:

- `packages/domain/src/__tests__/refusal044a.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur: `GUARD_SCENARIOS` für die fünf Guards, Regeltests für R-TRANS-15/16, neuer Abschnitt „Role × Verweigerung“)
- `packages/domain/src/__tests__/*.test.ts` (nur Erwartungen an `_actions`, an Rechtelisten und an Zählungen von Regeln oder Rechten, die sich durch diese Spec ändern; jede andere Änderung ist ein Befund)
- `apps/api/src/__tests__/*.test.ts` (dieselbe Einschränkung; keine neuen Tests der Operationen, die kommen mit 044b)

HTTP-Client, Live-Puffer und Oberfläche (nur Typprüfung):

- `apps/web/src/api/http.ts` (nur die drei Methoden)
- `apps/web/src/api/http.test.ts` (nur Tests der drei Methoden: Methode, Pfad, Body, Schreibkopfzeilen)
- `apps/web/src/api/liveStore.ts` (nur die Einträge der drei Methoden)
- `apps/web/src/api/liveStore.test.ts` (nur, falls die Vollständigkeitsprüfung eine Liste führt)
- `apps/web/src/i18n/labels.ts` (nur zwei Einträge in `ACTION_KEYS`)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur die zwei Aktionsschlüssel)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)

Dokumente:

- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 044a“ wie bei 025, 026, 028, 040a: Vergabe der zwei Rechte, Leserkreis der Begründung, Vorschlag direkt in die Prüfung, Begründungspflicht für beide Pfade, auf Standard gebaut)
- `docs/sicherheit/bedrohungsmodell.md` (nur: Fundstelle von SG2; Zeile 044 in „Weitere Scheiben mit Sicherheitsbezug“; Nachweise an T-G1-E-03 und MF-07; ein Missbrauchsfall „Verweigerung ohne Rechtsprüfung oder mit geändertem Grund“ in Abschnitt 7)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V7)
- `docs/folgeliste.md` (nur: 043a-Einträge 1 und 2 abhaken bzw. ergänzen, neue nicht blockierende Befunde)
- `docs/slices/044a-verweigerung-kern.md` (diese Spec: Bericht, Review findings)
- `docs/entscheidungsregister.md` (nur durch den Orchestrator mit dem Merge: E15 auf „auf Standard gebaut am <Datum> in 044a“, „Betroffene Scheibe(n)“ von E15 und E25 um „044a“, Textspalte von S6 um den Verweis)
- `docs/produktplan-beta.md` (nur durch den Orchestrator und nur nach dem Go zu Eigentümerfrage 2: Teilungsvermerk im Eintrag 044, Lanes, Kalender)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/**` (auch `allowlist.json`; die Einträge entfernt 044b), `apps/api/src/**` außer den Testdateien,
`apps/web/src/features/**`, `apps/web/e2e/**`, `packages/domain/src/seed.ts`, `packages/domain/src/rules.ts` (das Register
entsteht aus den Tabellen; braucht es doch eine Änderung, ist das ein Befund), `docs/adr/**`, `docs/glossar.md`. Dieser
Abschnitt steht bewusst außerhalb von „Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **043a gemergt?** Auf dem Integrationszweig muss stehen:
   - Vertrag 0.4.0 mit `AnswerKind`, den vier Feldern an `AnswerVersion`, `RefusalGround` (mit `hash`), `RefusalProposal`
     (ohne `answer`, `additionalProperties: false`) und den drei Operationen;
   - `Action` mit beiden Rechten;
   - drei Allowlist-Einträge mit `slice` 044.

   Fehlt das: anhalten. Weicht eine Form ab (etwa ein Pflichtfeld im Schema statt im Guard): melden; die Spec folgt dem
   Vertrag.
2. **040b–d:** Welche sind gemergt? Ist admin weiter ohne `question.refuse.*`? Die Zahlen im Wahrheitstabellen-Diff neu
   zählen (198 Zeilen in Abschnitt 1 heute).
3. **Regel-ids:** Sind R-TRANS-15/16 und R-GUARD-12/13 noch frei? Sonst die nächsten freien nehmen und im Bericht nennen.
   R-GUARD-08, -09 und -11 bleiben.
4. **046 gemergt?** Wenn ja: Gibt es neue Zeilen aus `delivered` oder Kennzeichen auf der Frage? Das Zusammenspiel mit
   Vorschlag und Freigabe beschreibt der Bericht und testet es. Bei einem Widerspruch: anhalten.
5. **ADR 0012 bei Recht?** Stand von Eigentümerfrage 1 in den Bericht. Liegt eine Antwort von Recht vor, die dieser Spec
   widerspricht: anhalten, der Architekt passt die Spec an.
6. **Live-Puffer:** Was verlangt die Vollständigkeitsprüfung (p) in `liveStore.test.ts` für eine neue Lesemethode ohne
   Thema?
7. **`_actions`-Erwartungen:** Liste der Tests, deren genaue `_actions`-Liste sich ändert (Datei, Testname), in den
   Bericht.
8. **`canonicalJson` = RFC 8785** für die Katalogwerte, einschließlich `null`: Test 1 belegt das mit einer von Hand
   geschriebenen kanonischen Zeichenkette für einen Eintrag.
9. **040d gemergt?** Wenn ja: Test 20 (Schnappschuss enthält die neuen Zeilen und Rechte). Wenn nein: Test 20 entfällt;
   der Bericht vermerkt den Übergang an 040d.

## Tests zuerst (rot, dann grün)

`packages/domain/src/__tests__/refusal044a.test.ts`; alle Aufrufe über `createInProcessApi` mit injizierter Uhr; nach
jedem abgewiesenen Aufruf bleibt `store.lastSeq()` gleich:

1. **Katalog:**
   - sieben Einträge mit eindeutiger `id`;
   - jeder `legalRef` mit `source: 'AktG'`, `verified: false`, `docHash: null`;
   - `hash` = SHA-256 über `canonicalJson` des Eintrags ohne `hash`. Für `aktg-131-3-nr1` wird zusätzlich gegen eine von
     Hand geschriebene kanonische Zeichenkette verglichen (RFC 8785);
   - die Liste `[id, hash]` steht als Inline-Snapshot fest;
   - jede Zeichenkette ist wohlgeformtes UTF-16;
   - Liste und Einträge sind eingefroren.
2. **Rechte:**
   - `question.refuse.propose` halten genau die Bündel von `legal` und `coordination`, `question.refuse.approve` genau
     das von `approver`; geprüft mit einer Schleife über `ROLE_PERMISSIONS`;
   - admin hält keines;
   - `PERMISSIONS` führt beide direkt nach `question.legal.clear`;
   - `REFUSAL_JUSTIFICATION_READ` ist genau diese zwei.
3. **Pfad B, Vorschlag:**
   - `legal` schlägt auf einer Frage in `assigned` (Textpfad) mit Grund `aktg-131-3-nr1` vor;
   - die Frage geht nach `in_review` mit neuer Version: `answerKind`, Grund, Hash = Katalog-Hash, Begründung getrimmt;
   - das Ereignis `AnswerDrafted` trägt `toStatus: 'in_review'` und den Schnappschuss;
   - `sha256(canonicalJson({ id, ...Schnappschuss }))` ist gleich `refusalGroundHash`;
   - die Projektion trägt keinen Schnappschuss;
   - aus `approved` vorgeschlagen: `invalidatedApprovalOfVersion` ist gesetzt, die Freigabe entfällt.
4. **Pfad A, Vorschlag:** `coordination` mit Begründung → `refusal_no_claim`, weder Grund noch Hash, Status `in_review`.
5. **R-GUARD-09:** jeweils 409 R-GUARD-09:
   - Pfad B ohne `refusalGroundId`;
   - Pfad B mit Begründung `"   "`;
   - Pfad B ohne Begründung;
   - Pfad A ohne Begründung.

   `detail` enthält weder Text noch Begründung.
6. **422:** jeweils 422, `detail` ohne Text:
   - `answerKind: 'answer'`;
   - unbekannter `answerKind`;
   - leerer `text`;
   - Pfad A mit `refusalGroundId`;
   - Pfad B mit unbekanntem `refusalGroundId`.
7. **Rechte an den Operationen:**
   - `proposeRefusal` als `expert`, `approver`, `moderation`, `capture`, `podium` und admin → 403 R-PERM-01;
   - `approveRefusal` als `legal`, `coordination` und admin → 403 R-PERM-01.
8. **Tabelle:**
   - Vorschlag auf einer Podiumsfrage in `classified` → 409 R-GUARD-03;
   - aus `captured`, `staged` und `delivered` → 409 R-TRANS-00.
9. **R-GUARD-08:**
   - `approveRefusal` ohne Rechtsfreigabe → 409 R-GUARD-08;
   - Antwort v1 rechtlich freigegeben, dann Verweigerung v2 vorgeschlagen → `approveRefusal(2)` ist 409 R-GUARD-08 (der
     Reducer hat die Rechtsfreigabe von v1 gelöscht);
   - nach `clearQuestionLegally(v2)` durch eine zweite Person → `approved`, Ereignis `QuestionApproved { answerVersion: 2 }`.
10. **Vier-Augen:**
    - `legal` L1 schlägt vor, L1 gibt rechtlich frei → 409 R-GUARD-06;
    - ein Akteur mit derselben id wie die Vorschlagende in der Rolle `approver` → `approveRefusal` 409 R-GUARD-06.
11. **R-GUARD-12/13:**
    - `approveQuestion` auf einer Verweigerungsversion → 409 R-GUARD-12;
    - `approveRefusal` auf einer Antwortversion → 409 R-GUARD-13.
12. **R-GUARD-11:** Ein Vorschlag mit veraltetem Hash wird simuliert, indem ein `AnswerDrafted` direkt an den Store
    angehängt wird, wie es ein früherer Katalog geschrieben hätte. Danach Rechtsfreigabe; `approveRefusal` → 409 R-GUARD-11,
    `_actions` von `approver` ohne `question.refuse.approve`. Dasselbe mit einer `refusalGroundId`, die nicht im Katalog
    steht. Ein frischer Vorschlag mit aktuellem Hash lässt sich danach freigeben.
13. **Ganze Kette Pfad B und Pfad A:** Vorschlag → Rechtsfreigabe → Freigabe → `stageQuestion` (`moderation`, R-GUARD-07
    erfüllt) → `deliverQuestion` (`podium`) mit `QuestionDelivered.answerVersion` = Verweigerungsversion →
    `closeQuestion`.
14. **Maskierung:**
    - `getQuestion` als `legal`, `coordination` und `approver`: `refusalJustification` vorhanden;
    - als admin, `moderation`, `capture`, `expert` (gleiche Einheit) und `observer` (nach `delivered`): fehlt;
    - `approver` auf einer Verweigerung in `in_review` **ohne** Rechtsfreigabe (Freigabe also nicht möglich): vorhanden;
    - `getStage` als `approver` und als `podium` (nach `staged`): fehlt;
    - `listQuestions` als admin: fehlt;
    - eine durch einen neuen Antwortentwurf verdrängte Verweigerungsversion: für `moderation` maskiert, für `legal`
      sichtbar;
    - `getQuestionHistory` als `legal`, `listEvents` als admin, `subscribe` als `legal`: `payload.answer` ohne
      `refusalJustification`, mit Schnappschuss;
    - Wiederholung von `proposeRefusal` mit gleichem Idempotenzschlüssel als `legal`: historische Antwort mit Begründung,
      kein neues Ereignis.
15. **Suche:** `listQuestions({ q })` als `legal` mit einem Wort, das nur in der Begründung steht → 0 Treffer; mit einem
    Wort aus `text` → 1 Treffer.
16. **`draftAnswer` bleibt Antwort:** Eingabe mit `answerKind: 'refusal_with_ground'`, `refusalGroundId` und
    `refusalJustification` → die Version trägt keines dieser Felder; R-GUARD-12 gilt weiter als Antwort.
17. **`_actions`:**
    - `legal` auf einer Textfrage in `assigned` enthält `question.refuse.propose`, auf einer Podiumsfrage nicht;
    - `approver` auf einer rechtlich freigegebenen Verweigerung in `in_review` enthält `question.refuse.approve` und nicht
      `question.approve`, ohne Rechtsfreigabe keines von beiden;
    - admin enthält auf keiner Frage des Seeds und keiner Verweigerung ein `question.refuse.*`.
18. **Wiederaufbau:**
    - eine zweite `createInProcessApi` auf demselben Store ergibt dieselbe Frage (Status `in_review`, Version,
      Begründung für `legal`);
    - ein `AnswerDrafted` ohne `toStatus` führt weiter nach `answer_drafted` (Regression).
19. **`listRefusalGrounds`:**
    - gelingt für alle neun Rollen des Seeds (jede hält eines der drei Leserechte); sieben Einträge mit `hash`;
    - eine Rolle ohne Bündel → 403 R-PERM-02;
    - das Ergebnis ist eine Kopie (Änderung am Ergebnis ändert den Katalog nicht).
20. **Freeze** (nur wenn 040d gemergt ist): Der Schnappschuss eines Freeze nach 044a enthält R-TRANS-15/16 und die
    Rechtevergabe. Sein Hash unterscheidet sich vom Hash desselben Jahrgangs mit den Tabellen vor 044a (berechnet im Test
    über die Hash-Funktion von 040d).
21. **Rückgabe und Korrektur:**
    - Verweigerung in `approved` → `returnQuestion` (`approver`) → `answer_drafted`;
    - danach `approveRefusal` → 409 R-TRANS-00 und `submitForReview` (`expert`) → 409 R-GUARD-12;
    - `proposeRefusal` → `in_review` mit Version + 1;
    - aus `delivered` zurückgegeben: dieselbe Folge; `QuestionDelivered` der ersten Verweigerung bleibt im Log.
22. **Verdrängen durch eine Antwort:** `expert` entwirft aus `in_review` über einer Verweigerung → `answer_drafted`. Die
    Rechtsfreigabe entfällt. Die Verweigerungsversion bleibt in `answers`.

`packages/domain/src/__tests__/transitions.test.ts`:

23. `GUARD_SCENARIOS` für R-GUARD-08, -09, -11, -12 und -13 (erfüllt und verletzt). Regeltests für R-TRANS-15 und
    R-TRANS-16 (bestehende Prüfung „jede Regel-id hat einen Test“). Der neue Abschnitt „Role × Verweigerung“ ist genau die
    Tabelle aus „Wahrheitstabellen-Diff“.

`apps/web/src/api/http.test.ts`:

24. Die drei Methoden senden Methode, Pfad und Body nach 0.4.0. Die beiden schreibenden senden `Idempotency-Key`, CSRF und
    `If-Match` wie `draftAnswer`.

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):

1. Maskierung in `viewQuestion` mit `can(actor(), p, q)` statt `can(actor(), p)` → Test 14 (Fall „ohne Rechtsfreigabe“) rot.
2. `refusalJustification` aus `MASKED_KEYS` entfernt → Test 14 (Ereignisse) rot.
3. Begründung in den Suchtext aufgenommen → Test 15 rot.
4. R-GUARD-08 aus R-TRANS-16 entfernt → Test 9 und der Abschnitt „Role × Verweigerung“ rot.
5. R-GUARD-12 aus R-TRANS-05 entfernt → Test 11 und der Abschnitt rot.
6. R-GUARD-11 prüft immer wahr, oder der Hash wird ohne Sortierung berechnet → Test 12 bzw. Test 1 rot.
7. `question.refuse.propose` an admin → Test 2, Test 17 und Abschnitt 1 der Wahrheitstabelle rot.
8. R-GUARD-09 ohne `trim()` → Test 5 rot.
9. `getStage` maskiert nicht → Test 14 (Bühne als `approver`) rot.
10. Reducer ignoriert `toStatus` → Test 3 und Test 18 rot.
11. Begründungspflicht für Pfad A entfernt → Test 5 (letzter Fall) rot.

## Akzeptanzkriterium

1. Die Tests 1–24 sind grün (Test 20 nur, wenn 040d gemergt ist), die elf Mutationsproben rot belegt.
2. `git diff -- packages/domain/policy-truth-table.md` zeigt genau den Diff aus „Wahrheitstabellen-Diff“: zwei neue
   Spalten, 10 ✓ in `q.refuse.propose`, keine ✓ in `q.refuse.approve`, keine geänderte bestehende Zelle, neuer
   Abschnitt „Role × Verweigerung“.
3. `docs/legal-trace.md` enthält R-TRANS-15, R-TRANS-16, R-GUARD-08, -09, -11, -12 und -13. Jede `citation` trägt den
   Vermerk „auf Standard gebaut (ADR 0012 vorgeschlagen, von Recht nicht gelesen)“, solange Eigentümerfrage 1 offen ist.
   `verified` ist `false`.
4. `git diff` gegen die Merge-Basis zeigt Änderungen nur in „Files allowed“. `packages/contract/**` ist unverändert.
5. `pnpm gates` (mit Postgres-Variablen wie in CI) ist grün, einschließlich `slice-scope` auf `claude/slice-044a-…`. Der
   Schluss der Ausgabe steht einmal im Bericht. Das Projekt http der e2e-Suite läuft in der PR-CI grün (keine
   Oberflächenänderung erwartet).

## Nachweise

- Diff der Wahrheitstabelle (wörtlich, beide Abschnitte).
- Auszug aus `docs/legal-trace.md` für die sieben neuen Regeln.
- Hash-Snapshot des Katalogs (Test 1).
- Ergebnis der Mutationsproben.
- Liste der geänderten `_actions`-Erwartungen (Vor-dem-Bau-Punkt 7).
- Schluss von `pnpm gates` mit Commit-Hash.
- **Kein Screenshot:** Keine Ansicht ändert sich. Die zwei Aktionsschlüssel werden erst mit 045 gerendert. Screenshots von
  Dialog und Bühne verlangt 045.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Fachregel, Status (zwei Zeilen, fünf Guards, Ziel `in_review` über `toStatus`)
- [x] Rolle, Recht, Schutzklasse (zwei Rechte, Leserkreis der Begründung)
- [x] personenbezogene oder vertrauliche Daten (Rechtseinschätzung, SG2; DSFA V7)
- [x] Vertrag, Ereignis (keine Vertragsänderung; neue Felder in der `AnswerDrafted`-Nutzlast, beschrieben in 0.4.0, gebunden in 043c)
- [ ] Persistenz, Migration (kein neuer Ereignistyp, keine Migration; alte Ereignisse bleiben gültig, Test 18)
- [ ] Oberfläche (nur zwei Schlüssel, nicht gerendert)

Perspektive(n): Legal, Security (6.5), Datenschutz (6.6) · Nachweise: Tests 1–24, Mutationsproben, Wahrheitstabellen-Diff,
Regelregister · Offene Entscheidung: E15 (Katalog, Pfad A), E25 (Freigabe, Leserkreis), E40 (eine Juristin), ADR 0012
(Eigentümerfrage 1)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** Verweigerung, Freigabe, Rechte und eine Rechtseinschätzung als neues geschütztes Datum (Leitplanken §4).
  Höchstes rechtliches Risiko im Plan (Eintrag 044).
- **Bedrohungen** (Bedrohungsmodell):
  - **SG2:** Leserkreis, Bühne, Ereignis-Lesepfad und Suche sind geregelt (Entscheidung 6).
  - **T-G1-E-02** und **MF-07:** R-GUARD-06 an Rechtsfreigabe und Freigabe der Verweigerung.
  - **T-G1-E-03:** R-GUARD-08 unabhängig von der Pfadtabelle; kein Eilpfad.
  - **T-G1-E-04:** admin hält weder `refuse.*` noch den Leserkreis.
  - **T-G1-I-01, T-G1-I-02, T-G1-I-09:** `viewQuestion` und `MASKED_KEYS`.
  - **T-G1-I-04:** die Suche indexiert die Begründung nicht.
  - **T-G1-E-01** (Umgehung der Oberfläche): Alle Prüfungen sitzen im Kern; die HTTP-Probe folgt in 044b.
- **Invarianten:**
  - Eine Verweigerung erreicht `approved` nur mit `question.refuse.approve`, Vier-Augen und Rechtsfreigabe genau dieser
    Version. Eine Antwort erreicht `approved` nie über `question.refuse.approve`, eine Verweigerung nie über
    `question.approve`.
  - Pfad B hat immer einen Katalogeintrag, dessen Hash bei der Freigabe noch gilt. Kein Pfad ist ohne Begründung
    speicherbar.
  - Die Begründung steht in keinem `EventRead`, in keiner Bühnenansicht und in keinem Suchtext. In `Question.answers`
    steht sie nur für Halter von `refuse.*`.
  - Der Zielstatus stammt aus der Tabelle; der Reducer übernimmt ihn nur.
- **Fehler- und Wiederherstellungsfall:**
  - Ein Katalog-Deploy während der HV sperrt die Freigabe offener Pfad-B-Vorschläge (R-GUARD-11). Die Wiederherstellung
    ist ein neuer Vorschlag mit dem aktuellen Eintrag (Test 12, letzter Satz). Das Runbook nennt den Freeze-Kalender.
  - Wiederaufbau aus dem Log ergibt denselben Stand (Test 18).
- **Kapazität (E37, E40):**
  - Schlägt die Koordination vor, reicht **eine** Juristin: Sie gibt rechtlich frei, `approver` gibt frei.
  - Schlägt `legal` selbst vor, muss eine **zweite** Person mit `question.legal.clear` rechtlich freigeben (R-GUARD-06).
    Mit nur einer Juristin blockiert dieser Weg. Einen Eilpfad gibt es nicht (E25).
  - Der Bericht nennt das, ebenso die Rollenkarte (062).
- **Zwischenstand bis 045:** Keine Oberfläche erzeugt eine Verweigerung. Legt ein HTTP-Client nach 044b eine an, zeigt die
  Beantwortung die Version ohne Kennzeichen. Freigeben kann sie dort niemand: `question.approve` fehlt in `_actions`
  (R-GUARD-12). Hingenommen, weil 045 unmittelbar folgt (Plan 09.11.2026) und in der Beta außer der Oberfläche kein
  Client existiert.
- **Demo und Dienst (ADR 0002):** Beide führen denselben Kern aus. In der Demo sind die Operationen ab 044a über `HvApi`
  erreichbar, im Dienst ab 044b. Die Demo prüft nicht gegen den Vertrag (034a); der Kern prüft die 422-Fälle selbst
  (Entscheidung 5).

## Sicherheits-Checkliste (Antworten für den Reviewer)

1. Nur `legal`, `coordination` und `approver` erhalten ein neues Recht. Prüfen: `git diff -- packages/domain/src/permissions.ts`
   und Abschnitt 1 der Wahrheitstabelle.
2. Die Maskierung ruft `can()` ohne Frage auf und gilt für jede Version. Prüfen: Test 14 und Mutationsprobe 1.
3. `MASKED_KEYS` enthält `refusalJustification`; `getStage` maskiert immer.
4. R-GUARD-08 liest `legalClearance.answerVersion` der **letzten** Version, nicht irgendeine Rechtsfreigabe.
5. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (Tor role-literals grün). Kein Status-Literal außerhalb der Tabelle;
   der Reducer übernimmt `toStatus` aus dem Ereignis.
6. Keine Testabschwächung: Jede geänderte `_actions`-Erwartung fügt genau `question.refuse.propose` bzw.
   `question.refuse.approve` hinzu.

## Standards (auf Standard gebaut)

| Standard | Quelle | Was 044a baut | Kosten einer späteren Änderung |
|---|---|---|---|
| Modell A: Verweigerung als Antwortart, elf Zustände | ADR 0012 (vorgeschlagen, nicht von Recht gelesen) | R-TRANS-15/16, R-GUARD-12/13 | Modell B: 2,5 AStd Kern (Plan) plus rund 0,5 AStd Vertrag |
| Vorschlag führt direkt nach `in_review` | diese Spec (Frage aus 043a) | `toStatus` in `AnswerDrafted` | Vorschlagende erhalten `question.submit_review` und der Vorschlag endet in `answer_drafted`: 0,5 AStd mit Tabellen-Diff |
| Begründungspflicht für **beide** Pfade, Grundpflicht nur Pfad B | Recherche Z.63, Rechtekonzept §4; Abweichung vom Satz in ADR 0012 | R-GUARD-09 | Pfad A ohne Pflicht: eine Bedingung, < 0,25 AStd |
| Katalog: sieben Gründe § 131 Abs. 3, alle `verified: false` | E15, Recherche Z.64 | `refusalGrounds.ts` | Datenpflege (076); jede Änderung macht offene Pfad-B-Vorschläge neu vorschlagspflichtig (R-GUARD-11) |
| Propose bei `legal` und `coordination`, Approve bei `approver` | E25, ADR 0012 | `ROLE_PERMISSIONS` | eine Tabellenzeile, 0,5 AStd mit Diff |
| Leserkreis der Begründung: Halter von `refuse.*`, nie admin, nie Ereignis, Bühne oder Suche | 043a, SG2 | Entscheidung 6 | Leserkreis erweitern: Daten plus Tests, 0,25 AStd |
| Nur Textpfade | diese Spec | R-GUARD-03 an R-TRANS-15 | Podiumsfragen zulassen: 0,5 AStd (Eigentümerfrage 5) |
| Antwortentwurf darf eine Verweigerung verdrängen | ADR 0012 (neueste Version gilt) | R-TRANS-03 unverändert | Guard „kein Entwurf über Verweigerung ohne Rückgabe“: < 0,25 AStd |

## Offene Eigentümerfragen

Keine blockiert die Spec. Fragen 1 und 2 brauchen vor dem Bau ein ausdrückliches Go bzw. einen Stand. Die übrigen sind auf
Standard gebaut, mit den genannten Kosten.

1. **ADR 0012 an Recht vor dem Bau (offener Punkt Eigentümer/Recht).** Plan §3 (Zeile 215), §4 (Zeile 249), ADR 0012 und
   Register E15 verlangen, dass ADR 0012 mit dem Regelregister (Vorabzug nach 011) bei Recht liegt, **bevor** 044 baut.
   Der Stand ist im Repositorium nicht belegt (Register Zeile 139: „beim Eigentümer, Stand unbekannt“).
   - Bitte an den Eigentümer, bis zum Baustart von 044a (Plan: 06.11.2026): (a) den Vorabzug mit ADR 0012, dieser Spec
     (Abschnitte „Ziel“, „Standards“ und Frage 3) und dem Katalog an Recht geben, falls noch nicht geschehen; (b) den Stand
     melden.
   - Ohne Antwort von Recht baut 044a **auf Standard**. Der Vermerk „auf Standard gebaut (ADR 0012 vorgeschlagen, von Recht
     nicht gelesen)“ steht dann an vier Stellen: in der `citation` der sieben neuen Regeln (also in
     `docs/legal-trace.md`), im Kopfvermerk des Rechtekonzepts, im Register (E15) und im Bericht.
   - Die Annahme des ADR bleibt Prüfpunkt 4 (Umsetzer und Recht). Ein späterer Wechsel kostet die Beträge aus „Standards“.
2. **Zuschnitt 044a/044b, Budget, Lanes (Go nötig).** Standard: zwei Teile, 2,5 + 1,25 = 3,75 AStd statt 2,5, beide hoch,
   seriell, ein PR je Spec. Mit Go ändert der Orchestrator:
   - Plan-Eintrag 044: Teilungsvermerk; Lanes core, web-api, web-shell, service, contract (nur Allowlist), docs-legal,
     docs-sicherheit, docs-datenschutz;
   - den Kalender: 045 rückt um etwa einen Bautag.

   Ohne Go: eine Scheibe 044 mit beiden Dateilisten und einem Review (Abschnitt „Teilung und Zuschnitt“).
3. **Pfad A (Recht, E15).**
   - **3a. Begründungspflicht.** Standard: Pflicht auch für Pfad A (Recherche Z.63, Rechtekonzept §4). Das weicht vom Satz
     in ADR 0012 ab. Alternative: Pflicht nur für Pfad B, < 0,25 AStd.
   - **3b. Untergründe** (nicht erforderlich, kein TOP-Bezug, keine Legitimation, verspätet; Recherche Z.63). Standard:
     keine. Alternative: Katalog mit Pfadangabe, `refusalGroundId` auch für Pfad A. Das kostet einen additiven
     Vertragsschritt (die `if`/`then`-Bedingung in `RefusalProposal` und `AnswerVersion` fällt) und Katalogdaten, rund
     0,75 AStd.
4. **Leserkreis und Vermerk der Rechtsfreigabe (Recht, E25).** Der Leserkreis bleibt Standard aus 043a (Frage 3 dort).
   Neu ist ein Restrisiko: Den Vermerk `note` der Rechtsfreigabe einer Verweigerung sieht jeder Halter von `history.read`.
   - Standard: unverändert; Hinweis im Dialog (045).
   - Alternative a: `note` immer maskieren (für alle Rechtsfreigaben), < 0,25 AStd.
   - Alternative b: `note` nur über die Projektion der Frage an Halter von `refuse.*` bzw. `question.legal.clear`, rund
     0,5 AStd mit Vertragsbeschreibung.
5. **Verweigerung auf Podiumsfragen.** Standard: nicht zulässig; vorher auf einen Textpfad umklassifizieren. Alternative:
   eigene Zeile aus `classified` für `podium` mit versionsgebundener Rechtsfreigabe, rund 0,5 AStd mit Tabellen-Diff.
   Recht und Projektleitung.
6. **Antwortentwurf über einer vorgeschlagenen Verweigerung.** Standard: erlaubt (neueste Version gilt; erneute
   Rechtsfreigabe nötig). Alternative: Guard „erst Rückgabe“, < 0,25 AStd.
7. **Katalog im Konfigurationsfreeze (040d).** Standard: nein; die Build-Kennung im Schnappschuss zeigt einen Deploy, und
   der Freeze-Kalender verbietet Katalogänderungen während der HV. Alternative: Katalog-Digest im Schnappschuss, rund
   0,25 AStd in 040d. Eigentümer mit Betrieb.

## Hinweise an Folgescheiben

**044b** (Spec nach Go zu Frage 2):
- Die drei Routen in `apps/api/src/app.ts` nach dem Muster von `draftAnswer`/`approveQuestion` montieren, mit
  `guarded('<operationId>')`.
- Die drei Allowlist-Einträge mit `slice` 044 im selben Commit entfernen. Das Abdeckungstor verlangt dann die Ausübung.
- HTTP-Tests:
  - 401, 403 R-PERM-01, 404, 409 (R-GUARD-06/-08/-09/-11/-12/-13, R-TRANS-00), 412, 422 (Validator und Kern);
  - Idempotenz und `If-Match`;
  - Maskierung auf allen sieben Lesepfaden, einschließlich der `event`-Nachricht von `/stream` als admin;
  - `draftAnswer` mit `answerKind` im Body erzeugt keine Verweigerung.
- Postgres-Lauf: Vorschlag, Rechtsfreigabe und Freigabe überstehen einen Neustart mit Kettenprüfung.
- Zugriffslog: abgewiesene Versuche mit Regel-id, ohne Nutzdaten.
- Prüfen, ob die Kennzahlen-Allowlist (033b) Einträge je Operation führt.
- Termin: vor dem 27.11.2026 gemergt.

**045:**
- Der Dialog füllt `text` aus `stageText` vor.
- „Ungeprüft“ leitet sich aus `legalRef.verified` ab.
- Ein Hinweis „Grund im Katalog geändert, bitte neu vorschlagen“ erscheint, wenn `approver` die Freigabe in `_actions`
  fehlt und der Hash der Version nicht dem aktuellen Katalogeintrag entspricht.
- Dialoghilfe: „keine Namen“ und „keine Begründung in den Vermerk der Rechtsfreigabe“ (Frage 4).
- Die Planzeile 045 verlangt „Pfad B ohne Grund → Aktion fehlt in `_actions`“. Das lässt sich nicht so bauen:
  `_actions` gilt je Frage, nicht je Pfad. R-GUARD-09 ist ohne Nutzlast immer erfüllbar. Den Fall prüft der Kern beim
  Absenden (409). 045 testet stattdessen: Absenden ohne Grund → Meldung mit R-GUARD-09, und die Absende-Schaltfläche ist
  ohne Grund gesperrt.
- Historie: Antwortart am Ereignis `AnswerDrafted` sichtbar machen.
- Glossarzeile „Verweigerungsgrund“.

**043c:** Das gebundene Nutzlastschema von `AnswerDrafted` nimmt `toStatus` und `refusalGround` auf, ohne
`refusalJustification`.

**046:** Prüfen, ob die Zeilen für `correctionOpen` und Rückgabe einen Vorschlag als neue Version zulassen. Regel-ids ab
R-TRANS-17 (R-TRANS-15/16 vergibt diese Spec).

**069:** Der Plan nennt R-TRANS-17 für „unmerge“. Die Folgespec vergibt die nächste freie Nummer (Folgeliste 043a,
Eintrag 1).

**051 und 043d:** Verweigerungen mit Antwortart und Grund markieren; die Begründung nach 043d (Standard: nicht im Export).

**053 und 087:** Zähldefinition für Verweigerungen je Pfad, aggregiert, nie je Person.

**059:** Prüfliste je Pfad; R-GUARD-10 an `clearQuestionLegally`. Die Prüfliste einer Verweigerung prüft, ob die
Begründung zum Grund passt.

**062 (Rollenkarte):** Kapazitätshinweis aus „Wirkung und Risiko“.

**070 (Runbook):** Freeze-Kalender: kein Katalog-Deploy zwischen Freeze und Debattenschluss; Wiederherstellung durch neuen
Vorschlag.

**076:** Katalogeinträge prüfen und auf `verified: true` setzen. Jede Änderung eines Eintrags ändert seinen Hash (R-GUARD-11)
und den Inline-Snapshot aus Test 1.

## Bericht (nach Bau ausfüllen)

```
Slice: 044a-verweigerung-kern
Done:
Evidence:
Open:
Touched:
```

**Stand Eigentümerfrage 1 (ADR 0012 bei Recht):**

**Vor dem Bau prüfen (Ergebnisse).**
1.
2.
3.
4.
5.
6.
7.
8.
9.

**Wahrheitstabellen-Diff (wörtlich).**

**Regelregister (Auszug `docs/legal-trace.md`).**

**Katalog-Hashes (Test 1).**

**Mutationsproben (Ergebnis).**
1.
2.
3.
4.
5.
6.
7.
8.
9.
10.
11.

**Geänderte `_actions`-Erwartungen.**

**`pnpm gates` (Schluss, Commit):**

```
```

## Review findings
