# Scheibe 044a — Verweigerungspfad A und B im Kern, Teil 1: Regeln, Rechte, Katalog, Maskierung

**Status:** spec (01.10.2026; gelesen auf `c000567`; überarbeitet nach dem Lesebefund zu `0dcbe39`: 0 blocker, 9 major, Minor; Teil 1 der geteilten Scheibe 044, Zuschnitt im Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 3,25 AStd (Teil a; Summe a+b 4,25 statt 2,5 laut Plan) · Plan 044: 06.11.2026 (W6); frühestens nach dem Merge von 043a (Vertrag 0.4.0), nach 040b in der Lane core (040c/d zurückgestellt, Eigentümer 03.10.2026; sie setzen später auf 044a auf); Go zu den Eigentümerfragen 1, 2 und 3b am 03.10.2026 erteilt, auf Standard gebaut · Lanes: contract (nur Beschreibungen, erster Commit); core; web-api (nur `HvApi` im HTTP-Client und Live-Puffer); web-shell (nur zwei Aktionsschlüssel); docs-legal (Kopfvermerk Rechtekonzept); docs-sicherheit; docs-datenschutz (nur Zeile V7)
**Rolle:** architect für den Vertragsschritt (erster Commit, nur Beschreibungen, AGENTS.md R6); danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Legal** (Verweigerung, Rechtstor, Grundkatalog), **Security** (Maskierung, Vier-Augen, SG2) und **Datenschutz** (Begründung im `pii`-Teil, DSFA V7, E14). Zusätzlich die Stichprobe des Architekten in eigenem frischem Kontext mit Perspektive Legal (Plan §6, Zeile 997). Lesebefund der Spec vor dem Bau; nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu R-TRANS-15 (Verweigerung vorschlagen), R-TRANS-16 (Verweigerung freigeben), R-GUARD-08 (Verweigerung nur mit Rechtsfreigabe-Ereignis), R-GUARD-09 (Grund- und Begründungspflicht), R-GUARD-11 (Katalogeintrag unverändert seit dem Vorschlag), R-GUARD-12 (Antwortversion für Antwortoperationen), R-GUARD-13 (Verweigerungsversion für die Verweigerungsfreigabe), R-GUARD-14 (Freigebende ≠ rechtlich Freigebende). Angewandt: R-GUARD-01, R-GUARD-03, R-GUARD-04, R-GUARD-06, R-GUARD-07, R-TRANS-00, R-TRANS-06, R-TRANS-07, R-TRANS-09, R-TRANS-13, R-PERM-01, R-PERM-02. Dazu AGENTS.md R2, R3, R4, R5, R7, R8, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 044 (Zeile 691–696), §3 „Zustandsmodell und Verweigerung“ (Zeile 215), §4 Zeile 249 (ADR 0012 „geht vor 044 an Recht“), §5 Abdeckung Zeilen 269 und 275 (Ist-Delta hoch 1, Recherche MUSS Recht Z.63/64), §6 Zeile 997 (Stichprobe des Architekten)
- ADR 0012 (Modell A, vorgeschlagen), ADR 0001, ADR 0002, ADR 0009 (`pii`-Umschlag mit `keyId`), ADR 0011, ADR 0013, ADR 0015
- Spec 043a (Vertrag 0.4.0: `AnswerKind`, `RefusalGround`, `RefusalProposal`, `listRefusalGrounds`, `proposeRefusal`, `approveRefusal`, `refusalGroundHash`, Maskierungsregel, R-GUARD-11, Regel 1 des Zuschnitts, „Hinweise an Folgescheiben: 044“, „Folgelisten-Einträge, die 043a anlegt“ 1 und 2)
- Spec 040a (admin als ausdrückliche Liste; „Hinweise an Folgescheiben: 044“), Spec 040d (Konfigurationsfreeze mit Übergangs- und Rechtetabelle im Schnappschuss)
- `docs/anforderungen-recherche.md:24, 63, 64`; `docs/rollen-und-rechtekonzept.md` §2.4 Zeile 121, §4 Zeile 171 und 175
- Register E14, E15, E25, E37, E40, S6, „o. Nr. 2“ (Anzeigegruppen)
- Bedrohungsmodell SG2, T-G1-I-01, T-G1-I-02, T-G1-I-04, T-G1-I-09, T-G1-E-01, T-G1-E-02, T-G1-E-03, T-G1-E-04, MF-01, MF-07; DSFA-Vorentwurf Zeile V7
- `packages/domain/src/indicators.ts:61-67` (Kennzahl `questionsInLegalReviewOver10m`)
- Lesebefund zu Spec 044a (01.10.2026, zu `0dcbe39`)

**Depends on:** 043a (gemergt, Vertrag 0.4.0), 040a (gemergt in `c000567`), 021c, 011 (gemergt). Seriell nach 040b in der Lane core (Wahrheitstabelle ist ein Snapshot, Plan §5.1). 040c und 040d sind zurückgestellt (Eigentümer 03.10.2026, Freigabe-Demo) und setzen später auf 044a auf; fachlich hängt 044a nicht an 040b–d
**Perspektive:** Legal, Security, Datenschutz · **Glossar: neue Begriffe:** nein („Verweigerung“ steht im Glossar; „Verweigerungsgrund“ kommt mit 045, wie 043a festlegt)

## Teilung und Zuschnitt

Die Planzeile 044 (2,5 AStd, hoch) nennt Antwortart, Katalog, zwei Rechte, zwei Guards, Vier-Augen, Formulierungsbaustein,
Export und die Nachweise für ADR 0012. Seit dem Plan ist Arbeit hinzugekommen:
- 043a verlangt einen Katalog-Hash mit Prüfung bei der Freigabe (R-GUARD-11), einen Schnappschuss im Ereignis und die
  Maskierung der Begründung auf **jedem** Lesepfad.
- 043a erklärt drei Operationen vorab; 044 muss sie montieren, `HvApi` und den HTTP-Client erweitern und die drei
  Allowlist-Einträge vor dem 27.11.2026 entfernen.
- Seit 040a halten nur noch fachliche Rollen Schreibrechte. Daraus folgen zwei weitere Fragen: Wer gibt eine
  Verweigerung zur Prüfung (nur `expert` hält `question.submit_review`), und wie wird ausgeschlossen, dass eine
  Verweigerung über die Antwortoperationen freigegeben wird?
- Der Lesebefund zu `0dcbe39` verlangt zusätzlich: Trennung von Rechtsfreigabe und Freigabe (R-GUARD-14), Maskierung des
  Rechtsfreigabe-Vermerks, die Begründung im `pii`-Teil und die Kennzahl der Rechtsprüfung.

Geschätzt sind das rund 4,25 AStd statt 2,5. Für einen einzigen Review mit drei Perspektiven ist das zu viel. Nach dem
Vorbild von 035a/035b (Kern, dann Dienst) wird 044 deshalb geteilt, **ein PR je Spec** (R12):

| Teil | Thema | Inhalt | Vertrag | Klasse · AStd |
|---|---|---|---|---|
| **044a** (diese Spec) | Regeln, Rechte, Katalog, Maskierung im Kern | `refusalGrounds.ts` mit Hash; Rechte; R-TRANS-15/16; R-GUARD-08/09/11/12/13/14; Projektion; Begründung im `pii`-Teil; Maskierung in Projektion, Bühne, Ereignis-Lesepfad und Suche; Vermerk der Rechtsfreigabe maskiert; Kennzahl der Rechtsprüfung; `HvApi` mit drei Methoden im Kern, im HTTP-Client und im Live-Puffer; Aufbewahrungsklasse `record` für Verweigerungsereignisse; Wahrheitstabelle mit neuem Abschnitt; Regelregister; Kopfvermerk Rechtekonzept; Bedrohungsmodell; DSFA V7 | erster Commit: nur Beschreibungen in `openapi.yaml`, nächste freie Patch-Stufe nach 0.4.0 (Abschnitt „Vertragsschritt“) | hoch · 3,25 |
| **044b** | Dienst und HTTP-Nachweis | Drei Routen in `apps/api/src/app.ts` montieren; die drei Allowlist-Einträge mit `slice` 044 im selben Commit entfernen (wie 035b); HTTP-Tests für 401/403/404/409/412/422, Idempotenz und `If-Match`; Maskierung über HTTP auf `getQuestion`, `listQuestions`, `listMeetingQuestions`, `getQuestionHistory`, `listEvents`, `/stream` und `getStage`; Postgres-Lauf: Vorschlag und Freigabe überstehen Neustart und Kettenprüfung; Zugriffslog mit Regel-id; gegebenenfalls Kennzahlen-Allowlist | nur `allowlist.json` (drei Einträge entfernen) | hoch · 1 |

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
Doku-Lanes sowie contract für den Vertragsschritt im ersten Commit. 044b braucht service und contract (nur Allowlist). Das hat 043a schon angekündigt (Eigentümerfrage 5 dort: „Plan-Eintrag 044
erhält die Lanes service und web-api“).

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
  - **R-GUARD-06 vergleicht nur mit dem Ersteller der Version** (`transitions.ts:158-162`). Dass die rechtlich Freigebende
    und die Freigebende verschiedene Personen sind, erzwingt heute keine Regel. Ein Subject mit einer Zuordnung `legal`,
    die abläuft oder entzogen wird, und einer späteren Zuordnung `approver` kann dieselbe Version erst rechtlich freigeben
    und dann freigeben.
  - Belegt sind R-TRANS-00..14 und R-GUARD-01..07. Frei sind R-TRANS-15 und höher sowie R-GUARD-12 und höher. Reserviert
    sind R-GUARD-08/-09 (044), R-GUARD-10 (059) und R-GUARD-11 (043a/044). Der Plan nennt R-TRANS-15/16 noch für 046
    (Zeile 674) und R-TRANS-17 für 069 (Zeile 867). Nach 043a („Regel-ids für Folgescheiben“) vergibt jede Folgespec die
    nächste freie Nummer; diese Spec nimmt R-TRANS-15 und 16 sowie R-GUARD-12 bis 14.
- **Projektion** (`packages/domain/src/state.ts:357-367`): `AnswerDrafted` setzt den Status fest auf `answer_drafted`
  und löscht `approval`, `legalClearance` und `returnReason`. Eine Verweigerung, die als `AnswerDrafted` geschrieben wird
  (043a: kein neuer Ereignistyp), landete also in `answer_drafted`. Dort hielte sie nur `expert` mit
  `question.submit_review` weiter. Vorbild für die Lösung ist `QuestionReturned`: Das Ereignis trägt `toStatus` aus der
  Tabelle (`state.ts:394-406`).
- **Kennzahl der Rechtsprüfung** (`indicators.ts:61-67`): `inReviewSince` wird nur bei `QuestionSubmittedForReview` und
  bei `QuestionReturned` mit `toStatus: 'in_review'` gesetzt. Eine Verweigerung, die über `AnswerDrafted` nach
  `in_review` kommt, würde in `questionsInLegalReviewOver10m` nie gezählt, oder ab einem veralteten Zeitpunkt.
- **Lesepfade einer Antwortversion:**
  - `viewQuestion` (`api.ts:399-410`) gibt `answers` ungefiltert aus. Das gilt für `getQuestion`, `listQuestions`,
    `listMeetingQuestions`, jede schreibende Antwort und die historische Antwort bei Wiederholung
    (`api.ts:566, 573`).
  - `getStage` (`api.ts:1250-1264`) nutzt dieselbe Funktion. `approver` und `moderation` halten `stage.read`.
  - `getQuestionHistory`, `listEvents`, `subscribe` und `/stream` geben `maskEvent` aus (`stream.ts:169-188`). Das maskiert
    statisch nach Schlüsselnamen (`MASKED_KEYS`: `displayName`, `organisation`, `pii`, `personId`) und kennt den Leser
    nicht.
  - Die Suche (`questionMatches`, `api.ts:721-737`) durchsucht `answers[].text`.
- **Vermerk der Rechtsfreigabe:** `QuestionLegalCleared.note` (`events.ts:98`) steht im Ereignis und ist für jeden Halter von
  `history.read` und `event.read` lesbar. Die Projektion `LegalClearance` trägt ihn nicht. Keine Ansicht der Oberfläche
  zeigt ihn (Suche nach `.note` in `apps/web/src`: kein Treffer).
- **`pii`-Umschlag** (ADR 0009): `payload.pii` mit `keyId` geht beim Anhängen durch den Codec (`envelope.ts:96-104`, heute
  `identityPiiCodec`). Der Reducer liest ihn direkt (`state.ts:186`, `SpeakerRegistered`). `maskEvent` entfernt `pii`
  rekursiv. Ein späterer echter Codec macht Crypto-Shredding je Jahrgang möglich (ADR 0009).
- **Antwortversion** (`types.ts:235-241`): `version`, `text`, `createdAt`, `createdBy`, `sources`. `draftAnswer` schreibt nur
  benannte Felder (`api.ts:1139-1155`).
- **Hash-Werkzeug:** `canonicalJson` und SHA-256 über `@noble/hashes` (`envelope.ts:1, 72-94`). `canonicalJson` gibt für
  Objekte, Zeichenketten, `null` und Wahrheitswerte die Form nach RFC 8785 aus (040d, Befund). Es läuft synchron in Node
  und im Browser.
- **`LegalRef`** (`rules.ts:36-45`): `docHash: null` und `verified: false` sind Literale. `LegalSource` kennt `'AktG'`; der
  Kommentar in `rules.ts:24-26` hält es für 044 frei (veraltet, sobald 044a baut; Folgenotiz unten).
- **Oberfläche:** `ACTION_KEYS` (`apps/web/src/i18n/labels.ts:52`) ist `Record<Permission, TKey>`. Zwei neue Rechte
  erzwingen zwei Schlüssel in beiden Sprachen. Keine Ansicht rendert `_actions` generisch, jede prüft ein einzelnes Recht
  (etwa `QuestionDetail.tsx:250`). Neue Rechte bleiben also unsichtbar, bis 045 sie verwendet.
- **Tests mit genauen `_actions`-Listen:** `packages/domain/src/__tests__/api.test.ts`, `idempotency028.test.ts`,
  `apps/api/src/__tests__/acceptance.test.ts`. Für `legal` und `coordination` kommt dort `question.refuse.propose` hinzu.
- **Veraltete Kommentare im Kern** (043a, Folgelisten-Eintrag 2): `packages/domain/src/types.ts:304` („Domain only until
  contract 0.4.0“) und `packages/domain/src/api.ts:925` („fields the contract still accepts“).
- **Recherche und Rechtekonzept:**
  - `docs/anforderungen-recherche.md:63` (MUSS): „(A) kein Auskunftsanspruch **mit Untergründen**; (B) Verweigerung trotz
    Anspruchs mit Zwangszuordnung zum gesetzlichen Katalog … **Beide brauchen Begründung und Freigabe**“.
  - `:64` (MUSS): Verweigerungsgründe vollständig als Auswahlliste, einschließlich des Sondergrunds für Finanzinstitute;
    ein leeres Feld darf nicht speicherbar sein.
  - Rechtekonzept §4 (Zeile 171): „Keine Verweigerung ohne zugeordneten Grund und Begründung. Der Zustand ist ohne diese
    Felder nicht speicherbar.“
  - ADR 0012 hält diesen Punkt für Pfad A offen und nennt als Standard von 044 „Begründung nur für Pfad B“. Vertrag 0.4.0
    (043a) verbietet einen Grund bei Pfad A (422).
  - **Folge:** Pfad A ohne Grund erfüllt Rechtekonzept §4 und Recherche Z.63 („mit Untergründen“) **nicht**. Diese Spec
    verdeckt das nicht, sondern macht es zur Go/No-go-Frage vor dem Bau (Eigentümerfrage 3b).

## Ziel und Entscheidungen vor Bau

Eine Verweigerung ist eine unveränderliche Antwortversion mit `answerKind` `refusal_no_claim` (Verweigerungspfad A, „kein
Auskunftsanspruch“) oder `refusal_with_ground` (Verweigerungspfad B, „Verweigerung trotz Anspruchs“, mit Grund aus dem
Katalog). Sie läuft durch `in_review → approved → staged → delivered`. Dabei gelten:
- Vier-Augen gegenüber der Erstellerin (R-GUARD-06), auch bei der Rechtsfreigabe;
- Trennung von Rechtsfreigabe und Freigabe (R-GUARD-14);
- das Rechtstor vor der Bühne (R-GUARD-07);
- dazu R-GUARD-08, R-GUARD-09 und R-GUARD-11.

Aus einer Verweigerung wird nie eine Antwort, aus einer Antwort nie eine Verweigerung (R-GUARD-12, R-GUARD-13). Die
Begründung liegt im `pii`-Teil des Ereignisses und ist nur für Halter von `question.refuse.*` lesbar. Der Vermerk der
Rechtsfreigabe ist in keinem Lesepfad mehr sichtbar. **Auf Standard gebaut:** ADR 0012 ist von Recht nicht gelesen
(Eigentümerfrage 1).

### 1. Grundkatalog (`packages/domain/src/refusalGrounds.ts`, neu)

- Typ `RefusalGroundEntry` = `{ id, title, stageText, legalRef: LegalRef }`. Typ `RefusalGround` = Eintrag plus `hash`.
  Export `REFUSAL_GROUNDS: readonly RefusalGround[]`.
- **Tief eingefroren:** Liste, jeder Eintrag **und** jedes `legalRef` mit `Object.freeze` (eine kleine `deepFreeze`-Hilfe
  im Modul). `listRefusalGrounds` gibt eine **tiefe Kopie** zurück (`structuredClone`), nie den Katalog selbst (Test 19).
- **Hash** (Definition aus 043a, wörtlich): SHA-256, Kleinbuchstaben-Hex, über die UTF-8-Bytes der kanonischen Form nach
  RFC 8785 des Eintrags **ohne** `hash`. Berechnet wird er beim Laden des Moduls mit `canonicalJson` aus `envelope.ts`.
  Der Wertebereich ist Objekte, Zeichenketten, `null` und Wahrheitswerte; dafür stimmt `canonicalJson` mit RFC 8785
  überein. Die Zeichenketten sind Code-Daten und wohlgeformt (Test 1).
- **Einträge**, alle Pfad B, Inhaltssprache `de` (E21). Für jeden gilt:
  - `legalRef = { source: 'AktG', citation, docVersion: null, docHash: null, verified: false }`;
  - `citation` = „§ 131 Abs. 3 Satz 1 Nr. N AktG. Gliederung und Wortlaut nicht aus einer Quelle im Repositorium belegt;
    Bezug nur docs/anforderungen-recherche.md:24, :64; Entwurf der Umsetzung, ungeprüft (E15)“. Das folgt der
    Ehrlichkeitsregel aus `rules.ts:5-16`: Kein Zitat wird als belegt ausgegeben, was nicht belegt ist.
  - **Gesetzliche Bedingungen stehen im Titel**, weil der Eintrag nur `title`, `stageText` und `legalRef` kennt (Vertrag
    0.4.0). Wer den Grund wählt, sieht die Bedingung. Der Baustein für die Bühne behauptet keine Tatsache, die nicht unter
    dieser Bedingung steht.

  | id | title | stageText (Formulierungsbaustein, Entwurf, ungeprüft) |
  |---|---|---|
  | `aktg-131-3-nr1` | Nach vernünftiger kaufmännischer Beurteilung nicht unerheblicher Nachteil für die Gesellschaft oder ein verbundenes Unternehmen | Zu dieser Frage gibt der Vorstand keine Auskunft, weil die Erteilung der Auskunft nach vernünftiger kaufmännischer Beurteilung geeignet ist, der Gesellschaft oder einem verbundenen Unternehmen einen nicht unerheblichen Nachteil zuzufügen. |
  | `aktg-131-3-nr2` | Steuerliche Wertansätze oder Höhe einzelner Steuern | Die Frage betrifft steuerliche Wertansätze oder die Höhe einzelner Steuern; hierzu gibt der Vorstand keine Auskunft. |
  | `aktg-131-3-nr3` | Unterschied zwischen Bilanzansatz und höherem Wert — nur, wenn nicht die Hauptversammlung den Jahresabschluss feststellt | Zum Unterschied zwischen dem Wert, mit dem Gegenstände in der Jahresbilanz angesetzt sind, und einem höheren Wert dieser Gegenstände gibt der Vorstand keine Auskunft. |
  | `aktg-131-3-nr4` | Bilanzierungs- und Bewertungsmethoden — nur, soweit die Angabe im Anhang für ein den tatsächlichen Verhältnissen entsprechendes Bild ausreicht, und nur, wenn nicht die Hauptversammlung den Jahresabschluss feststellt | Über die Bilanzierungs- und Bewertungsmethoden gibt der Vorstand keine weitere Auskunft, weil ihre Angabe im Anhang ausreicht, um ein den tatsächlichen Verhältnissen entsprechendes Bild der Vermögens-, Finanz- und Ertragslage der Gesellschaft zu vermitteln. |
  | `aktg-131-3-nr5` | Strafbarkeit des Vorstands | Zu dieser Frage gibt der Vorstand keine Auskunft, weil er sich durch die Erteilung der Auskunft strafbar machen würde. |
  | `aktg-131-3-nr6` | Nur Kredit-, Finanzdienstleistungs- und Wertpapierinstitute: angewandte Bilanzierungs- und Bewertungsmethoden und vorgenommene Verrechnungen, die in Jahresabschluss, Lagebericht, Konzernabschluss oder Konzernlagebericht nicht angegeben werden müssen | Angaben über angewandte Bilanzierungs- und Bewertungsmethoden und vorgenommene Verrechnungen, die im Jahresabschluss, Lagebericht, Konzernabschluss oder Konzernlagebericht nicht gemacht zu werden brauchen, macht der Vorstand auch hier nicht. |
  | `aktg-131-3-nr7` | Auskunft auf der Internetseite — nur, wenn sie seit mindestens sieben Tagen vor Beginn und in der Hauptversammlung durchgehend zugänglich ist | Die erbetene Auskunft ist auf der Internetseite der Gesellschaft seit mindestens sieben Tagen vor Beginn der Hauptversammlung und während der Hauptversammlung durchgehend zugänglich; der Vorstand verweist darauf. |

  Ob Wortlaut, Nummerierung, Bedingungen und Bausteine tragen, prüft Recht (E15, 076; Eigentümerfrage 1). Bis dahin zeigt
  die Oberfläche „ungeprüft“ (045). Ob die Liste vollständig ist (Recherche Z.64), ist ausdrücklich **nicht** belegt.
- **Pfad A** trägt keinen Katalogeintrag (Vertrag 0.4.0: `refusalGroundId` bei `refusal_no_claim` ist 422). Die
  „Untergründe“ aus Recherche Z.63 (nicht erforderlich, kein TOP-Bezug, keine Legitimation, verspätet) baut 044a nicht.
  Das ist eine benannte, nicht erfüllte Anforderung (Eigentümerfrage 3b, Go/No-go vor dem Bau; Zielscheibe 044c).

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
| **R-TRANS-16** | `question.refuse.approve` | `in_review` | `approved` | R-GUARD-01, R-GUARD-13, R-GUARD-04, R-GUARD-06, R-GUARD-08, R-GUARD-14, R-GUARD-11 (Reihenfolge nach dem Nachtrag des Orchestrators, 03.10.2026) |
| R-TRANS-04 (geändert) | `question.submit_review` | unverändert | unverändert | + R-GUARD-12 |
| R-TRANS-05 (geändert) | `question.approve` | unverändert | unverändert | + R-GUARD-12 (vor R-GUARD-04) |

Entscheidungen dazu:

- **Der Vorschlag führt direkt nach `in_review`** (Frage aus 043a, „Hinweise an 044“). Die andere Möglichkeit wäre
  `question.submit_review` für `legal` und `coordination`. Dann dürften beide auch fremde Antwortentwürfe zur Prüfung
  geben, was die Rollen verwischt. Ein Zwischenschritt „zur Prüfung geben“ prüft bei einer Verweigerung nichts: Ihr Inhalt
  ist schon die Rechtseinschätzung.
- **Umsetzung ohne neuen Ereignistyp:** `proposeRefusal` schreibt **ein** `AnswerDrafted`, dessen Nutzlast zusätzlich
  `toStatus` aus der Tabelle trägt (Vorbild `QuestionReturned`).
  - Der Reducer setzt `q.status = payload.toStatus`, aber **nur**, wenn der Wert in `QUESTION_STATUSES` steht. Fehlt er
    oder ist er unbekannt, gilt `answer_drafted` wie bisher (Test 18).
  - Die Tabelle bleibt die einzige Quelle des Zielstatus (AGENTS.md R5): `build` erhält `to` aus `resolveTransition` und
    schreibt genau diesen Wert.
- **Kennzahl der Rechtsprüfung** (`indicators.ts`): Ein `AnswerDrafted` mit `toStatus === 'in_review'` setzt
  `inReviewSince` wie `QuestionSubmittedForReview` (Test 26). Ein erneuter Vorschlag aus `in_review` (neue Version)
  setzt `inReviewSince` neu; die 10-Minuten-Uhr beginnt also mit jeder neuen Version von vorn. Das ist gewollt: Die
  Rechtsprüfung gilt der neuen Version.
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
    kostet eine Bedingung, < 0,25 AStd (Eigentümerfrage 3a).

  Fehlt etwas, antwortet der Guard 409 mit R-GUARD-09, ohne Ereignis. Die `citation` im `legalRef` sagt ausdrücklich:
  „Begründungspflicht für beide Pfade erfüllt; **nicht erfüllt** gegenüber Rechtekonzept §4 (Zeile 171) und Recherche
  Z.63: Pfad A trägt keinen zugeordneten Grund und keine Untergründe (Vertrag 0.4.0; Eigentümerfrage 3b, Zielscheibe
  044c)“.
- **R-GUARD-11 `refusalGroundUnchanged`:** Ist die letzte Version `refusal_with_ground`, dann gibt es in `REFUSAL_GROUNDS`
  einen Eintrag mit `id === refusalGroundId`, und dessen `hash === refusalGroundHash`. Für Pfad A und für Antworten ist
  der Guard wahr. Er liest den Katalog als Daten-Import wie `LEGAL_GATE_BY_TRACK`; der Katalog wird nicht injiziert. Die
  Projektion hängt nie vom aktuellen Katalog ab (R7, Wiederaufbau): Der Guard wirkt nur zum Zeitpunkt des Befehls.
- **R-GUARD-12 `latestIsAnswer`:** Es gibt eine letzte Version, und sie hat kein `answerKind` oder `answerKind ===
  'answer'`. **Ohne Version ist der Guard falsch.** Steht an R-TRANS-04 und R-TRANS-05; dort prüft R-GUARD-01 den Fall
  ohne Version schon vorher, die Antwort bleibt also R-GUARD-01.
- **R-GUARD-13 `latestIsRefusal`:** Die letzte Version hat `answerKind` `refusal_no_claim` oder `refusal_with_ground`.
  Ohne Version falsch. Steht an R-TRANS-16.
- **R-GUARD-14 `approverIsNotLegalClearer`:** `q.legalClearance !== undefined` und `q.legalClearance.clearedBy.id !==
  ctx.actor.id`. Steht an R-TRANS-16. Damit sind Erstellerin, rechtlich Freigebende und Freigebende einer Verweigerung
  **drei verschiedene Akteur-ids**. Das schließt den Weg „ein Subject klärt rechtlich als `legal`, verliert die Zuordnung
  und gibt als `approver` frei“. Eine Person mit zwei Subjects bleibt Restrisiko neben MF-01. R-GUARD-14 gilt in 044a nur
  für Verweigerungen; ob die Antwortfreigabe R-TRANS-05 dieselbe Trennung erhält, ist Eigentümerfrage 8.

  **Nachtrag des Orchestrators (03.10.2026, nach dem Review):**
  - Die Definition bleibt die der Spec: `q.legalClearance !== undefined` und keine Akteur-id, die die aktuelle Version
    rechtlich freigegeben hat, gleicht `ctx.actor.id`. Die Reihenfolge in R-TRANS-16 wird **R-GUARD-08 vor R-GUARD-14**
    (Tabelle oben), weil die bisherige Reihenfolge Test 9 widersprach (eine fehlende Rechtsfreigabe soll R-GUARD-08
    melden). Fällt R-GUARD-08 aus der Zeile, hält R-GUARD-14 die Freigabe ohne Rechtsfreigabe weiter auf.
  - Mehrfache Rechtsfreigabe (Review-Befund 1, Variante b): Eine wiederholte Rechtsfreigabe derselben Version ersetzte
    `legalClearance.clearedBy`; S klärte v1, K klärte v1 erneut, S gab nach Rollenwechsel frei. Die Projektion hält deshalb
    alle Akteur-ids der Rechtsfreigaben der aktuellen Version (`QuestionRecord.legalClearerIds`, intern, nie in einer
    Ansicht; ein neues `AnswerDrafted` und die Rückgabe nach `classified` leeren sie), und R-GUARD-14 vergleicht mit allen.
    R-TRANS-13 bleibt unverändert.

Getrennte Guards statt eines, weil `ruleRegister()` (`rules.ts:435-443`) Guards nach Regel-id entdoppelt. Eine id mit
zwei `check`-Funktionen verlöre eine davon aus Register und Szenariotest.

### 5. Operationen im Kern (`HvApi`, `createInProcessApi`)

- **`listRefusalGrounds(): Promise<RefusalGround[]>`:** `requireReadPermission('listRefusalGrounds')`. Ergebnis ist eine
  tiefe Kopie von `REFUSAL_GROUNDS` mit `hash`, global und ohne Jahrgang (043a).
- **`proposeRefusal(id, input: RefusalProposal, opts?): Promise<Question>`**, Reihenfolge wie bei `draftAnswer` und
  `classifyQuestion`:
  1. Eingabeprüfung mit 422, vor `transition()`. Die Demo prüft nicht gegen den Vertrag (Folgeliste 034a), deshalb prüft
     der Kern selbst, mit den Grenzen aus 0.4.0:
     - `answerKind` ist keine Zeichenkette oder nicht `refusal_no_claim`/`refusal_with_ground`;
     - `text` ist keine Zeichenkette, `text.trim()` ist leer oder `text` ist länger als 20000 Zeichen;
     - `refusalJustification` ist gesetzt, aber keine Zeichenkette oder länger als 4000 Zeichen;
     - `refusalGroundId` ist gesetzt, aber keine Zeichenkette oder länger als 128 Zeichen;
     - `sources` ist gesetzt, aber kein Array aus Zeichenketten;
     - Pfad A trägt `refusalGroundId`;
     - Pfad B nennt ein `refusalGroundId`, das nicht im Katalog steht (043a: „unbekannt ist 422“, hiermit bestätigt).

     Der Katalog ist allgemein lesbar; die Prüfung verrät nichts über Fragen. Fehlende Begründung oder fehlender Grund
     sind keine 422, sondern R-GUARD-09 (409, 043a). Dass Validator und Kern hier verschiedene Status liefern, beschreibt
     der Vertragsschritt dieser Scheibe an `proposeRefusal`.
  2. `transition(id, 'question.refuse.propose', opts, input, build)`: 404 bzw. 403 R-PERM-01, `If-Match` (412 bei
     veralteter Version, kein Ereignis; Test 23), Tabelle (R-TRANS-00, R-GUARD-03, R-GUARD-09).
  3. `build` schreibt `AnswerDrafted` mit dieser Nutzlast:
     - `answer`, aus benannten Feldern: `version` = `answers.length + 1`, `text` getrimmt, `createdAt` = `now()` (R8),
       `createdBy` = `{ id, role }`, `sources` falls gesetzt, `answerKind`;
     - nur bei Pfad B in `answer`: `refusalGroundId`, `refusalGroundHash` (Hash des Eintrags **jetzt**) und der
       Schnappschuss `refusalGround: { title, stageText, legalRef }`;
     - **`pii: { keyId: <meetingId>, refusalJustification }`** mit getrimmter Begründung, wie `SpeakerRegistered`
       (`api.ts:886`). Die Begründung steht **nicht** in `answer`;
     - `invalidatedApprovalOfVersion`, falls eine Freigabe bestand;
     - `toStatus: to`;
     - auf dem Ereignis (Umschlag, nicht Nutzlast): **`retentionClass: 'record'`**. `append` (`api.ts:642-646`) übernimmt
       das Feld aus `build`; ohne Angabe setzt `stampEvent` `working` (`envelope.ts:146`).
- **`approveRefusal(id, answerVersion, opts?): Promise<Question>`:** `transition(id, 'question.refuse.approve', opts,
  { answerVersion }, …)` schreibt `QuestionApproved { answerVersion }` wie `approveQuestion`, ebenfalls mit `retentionClass: 'record'`. Guards
  siehe Tabelle.
- **Aufbewahrungsklasse (DSFA V7, ADR 0009):** Die DSFA nennt für V7 die Klasse `record`; der Code schreibt heute für jedes
  Ereignis außer `IdempotencyRecorded` `working`. Richtig ist `record`: Eine Verweigerung ist Nachweis für Niederschrift
  und Anfechtung (§ 131 Abs. 5, §§ 243 ff. AktG, DSFA V9). 044a setzt `record` deshalb auf die beiden Ereignisse, die nur
  eine Verweigerung erzeugt (`AnswerDrafted` aus `proposeRefusal`, `QuestionApproved` aus `approveRefusal`; Test 28,
  Mutationsprobe 18). `draftAnswer`, `approveQuestion` und `clearQuestionLegally` bleiben unverändert `working`, obwohl die
  DSFA für V5 und V6 ebenfalls `record` nennt. Diese Lücke ist benannt und gehört zu Eigentümerfrage 9 (DSB); Ziel ist eine
  Aufbewahrungsklasse je Ereignistyp als Datentabelle in einem eigenen Takt core vor dem Pilot. Die Rechtsfreigabe einer
  Verweigerung (`QuestionLegalCleared`) bleibt dort ebenfalls `working`, weil `clearQuestionLegally` die Antwortart nicht
  unterscheidet; der Takt schließt das mit.
- **`draftAnswer` bleibt bei benannten Feldern.** `answerKind` und `refusal*` im Eingabeobjekt werden nicht übernommen.
  Eine Antwortversion trägt kein `answerKind` (fehlt = `answer`, Vertrag 0.4.0). Das erfüllt die Zeile von 043a „ab 044
  schreibt `draftAnswer` immer `answer`“ ohne neues Feld in jedem Antwortereignis. Der Korpus und die Ereignis-Fixtures
  bleiben dadurch unverändert.
- **Projektion:** Der Reducer übernimmt `answer` **ohne** `refusalGround` in `q.answers` und ergänzt die Version um
  `refusalJustification` aus `payload.pii` (wie `state.ts:186`). Der Schnappschuss steht nur im Ereignis (Audit-Pfad,
  043a); `AnswerVersion` im Vertrag kennt kein solches Feld.
- **Idempotenz:** `idempotent('question.refuse.propose:<id>' …)`. Die historische Antwort läuft über den Zweig
  `operation.startsWith('question.')` (`api.ts:569-574`) und damit über dieselbe maskierende `viewQuestion` mit dem
  **aktuellen** Leser.

### 6. Maskierung (SG2; Regel aus 043a, gebaut und verschärft hier)

- **`viewQuestion`:** Für **jede** Version in `answers`, nicht nur die letzte, entfällt `refusalJustification`, außer
  `REFUSAL_JUSTIFICATION_READ.some((p) => can(actor(), p).allow)`.
  - `can` wird **ohne Frage** aufgerufen. Mit Frage würde die Übergangstabelle mitentscheiden, und `approver` sähe die
    Begründung nur dann, wenn eine Freigabe gerade möglich ist (Mutationsprobe 1).
  - Weil jede schreibende Operation ihre Antwort über `viewQuestion` bildet, gilt die Regel auch für die Antwort auf
    `returnQuestion`, `deliverQuestion`, `stageQuestion` und alle übrigen Schreibvorgänge (Test 14).
- **`getStage`:** `refusalJustification` entfällt **immer**, auch für `approver` und `moderation`. Umsetzung als Option von
  `viewQuestion` (etwa `{ stage: true }`), nicht als zweite Kopie der Ansicht.
- **Ereignis-Lesepfad:** Die Begründung liegt im `pii`-Teil, den `maskEvent` schon entfernt. Zusätzlich erhält
  `MASKED_KEYS` (`stream.ts:169`) `refusalJustification` (doppelte Sicherung, falls ein künftiger Schreiber sie
  außerhalb von `pii` ablegt). Der Vermerk `note` kommt **nicht** in `MASKED_KEYS`, weil diese Liste rekursiv in jeder
  Nutzlast wirkt; `maskEvent` entfernt ihn nur bei `QuestionLegalCleared` (nächster Punkt). Damit fehlen Begründung und
  Vermerk der Rechtsfreigabe in jedem `EventRead` für jeden Leser: `getQuestionHistory`, `listEvents`, `subscribe` und `/stream`. Der Schnappschuss `refusalGround` bleibt
  sichtbar (Katalogdatum).
- **Vermerk der Rechtsfreigabe (`QuestionLegalCleared.note`), sichere Voreinstellung:** Er wird für alle
  Rechtsfreigaben maskiert, nicht nur für Verweigerungen; `maskEvent` kennt die Antwortart nicht. Umsetzung **eng**, nach
  dem Vorbild des Sonderfalls `IdempotencyRecorded` in `maskEvent` (`stream.ts:187`): `if (event.type ===
  'QuestionLegalCleared') delete payload.note`, mit Code-Kommentar zum Grund (Seitenkanal der Begründung, SG2). Ein
  `note` in einer anderen Nutzlast (etwa der Notiz aus 046) bleibt davon unberührt; dort entscheidet die jeweilige
  Scheibe. Die Projektion `LegalClearance` erhält ihn **nicht**. Der Vermerk bleibt nur im gespeicherten Original (R7). `note` kommt sonst in keiner
  Nutzlast vor (`events.ts`). Eine Lesefreigabe für Berechtigte ist Eigentümerfrage 4.
- **Suche:** `questionMatches` nimmt `refusalJustification` nicht in den Suchtext auf. Der Wortlaut `text` bleibt
  durchsuchbar.
- **Fehlermeldungen:** Kein `detail` einer 409, 412 oder 422 enthält Text, Begründung oder Vermerk. Das 422 bei
  unbekanntem Grund nennt nur die id.
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
Frage: Textpfad `expert_track`.
- Version 1 ist eine Antwort von `e` (`expert`).
- Version 2 ist `refusal_with_ground` von `l` (`legal`), Grund `aktg-131-3-nr1` mit aktuellem Hash.
- Zeile „in_review, frei“: Status `in_review`, `legalClearance = { answerVersion: 2, clearedBy: k }`.
- Zeile „in_review, offen“: Status `in_review`, ohne Rechtsfreigabe.
- Zeile „answer_drafted“: Status `answer_drafted` (zurückgegebene Verweigerung), `legalClearance` wie „frei“.
- Akteur `x` (≠ `e`, `l`, `k`); Nutzlast für die beiden Freigaben `{ answerVersion: 2 }`.

| Role | Fall | q.refuse.propose | q.refuse.approve | q.approve | q.submit_review | q.legal.clear | answer.draft |
|---|---|---|---|---|---|---|---|
| moderation | in_review, frei | · | · | · | · | · | · |
| moderation | in_review, offen | · | · | · | · | · | · |
| moderation | answer_drafted | · | · | · | · | · | · |
| capture | in_review, frei | · | · | · | · | · | · |
| capture | in_review, offen | · | · | · | · | · | · |
| capture | answer_drafted | · | · | · | · | · | · |
| coordination | in_review, frei | ✓ | · | · | · | · | · |
| coordination | in_review, offen | ✓ | · | · | · | · | · |
| coordination | answer_drafted | ✓ | · | · | · | · | · |
| expert | in_review, frei | · | · | · | · | · | ✓ |
| expert | in_review, offen | · | · | · | · | · | ✓ |
| expert | answer_drafted | · | · | · | · | · | ✓ |
| legal | in_review, frei | ✓ | · | · | · | ✓ | ✓ |
| legal | in_review, offen | ✓ | · | · | · | ✓ | ✓ |
| legal | answer_drafted | ✓ | · | · | · | · | ✓ |
| approver | in_review, frei | · | ✓ | · | · | · | · |
| approver | in_review, offen | · | · | · | · | · | · |
| approver | answer_drafted | · | · | · | · | · | · |
| podium | in_review, frei | · | · | · | · | · | · |
| podium | in_review, offen | · | · | · | · | · | · |
| podium | answer_drafted | · | · | · | · | · | · |
| admin | in_review, frei | · | · | · | · | · | · |
| admin | in_review, offen | · | · | · | · | · | · |
| admin | answer_drafted | · | · | · | · | · | · |
| observer | in_review, frei | · | · | · | · | · | · |
| observer | in_review, offen | · | · | · | · | · | · |
| observer | answer_drafted | · | · | · | · | · | · |

Was der Abschnitt belegt:
- `q.approve` ist auf einer Verweigerung für niemanden möglich (R-GUARD-12).
- `q.refuse.approve` gibt es nur für `approver`, nur in `in_review` und nur nach der Rechtsfreigabe dieser Version
  (R-GUARD-08).
- Eine zurückgegebene Verweigerung kann `expert` nicht wieder zur Prüfung geben (`q.submit_review` · in
  `answer_drafted`, R-GUARD-12).
- admin hält nichts davon (T-G1-E-04).

R-GUARD-14 ist in dieser Tabelle immer erfüllt (Akteur `x` ≠ `k`); den verletzten Fall belegen Test 10 und der
Guard-Szenariotest.

Die Tabellen „Role × Leserecht“, „Role × Agenda“, „Role × Identität und Rollenverwaltung“ und „Role × Wortmeldung,
Erfassung und Demo“ bleiben unverändert. Der Bericht nennt den Diff wörtlich.

## Missbrauchsfälle, Erkennung und Zusammenspiel mit Freeze, Ablauf und Korrektur

Lehre aus 040: Für jeden neuen Mechanismus stehen die Missbrauchsfälle und das Zusammenspiel hier **vor** dem Bau.
- „Freeze“ ist der Konfigurationsfreeze aus 040d. Sein Schnappschuss enthält Rechte- und Übergangstabelle.
- „Ablauf“ meint Rollenzuordnungen mit `expiresAt` oder Entzug, die Übernahme (028) und die Allowlist.
- „Korrektur“ meint die Rückgabe aus `delivered` (R-TRANS-06) und später `correctionOpen` (046).

### Guards R-GUARD-08, R-GUARD-09, R-GUARD-12, R-GUARD-13, R-GUARD-14 und Vier-Augen

| Missbrauch oder Fehlgebrauch | Abwehr | Erkennung, Nachweis |
|---|---|---|
| Verweigerung über `draftAnswer` eingeschleust (`answerKind` im Body), am Recht `question.refuse.propose` vorbei | `draftAnswer` schreibt nur benannte Felder; Vertrag: `AnswerDraft` ohne `answerKind` (043a, Test 10) | Test 16; 044b: derselbe Fall über HTTP |
| Verweigerung über `approveQuestion` freigegeben, am Recht `question.refuse.approve` vorbei | R-GUARD-12 an R-TRANS-05 | Test 11; Abschnitt „Role × Verweigerung“ |
| Antwort über `approveRefusal` freigegeben | R-GUARD-13 | Test 11; Mutationsprobe 13 |
| Ältere Version freigegeben, während eine neuere vorliegt | R-GUARD-04 | Test 11 |
| Zurückgegebene Verweigerung von `expert` erneut zur Prüfung gegeben | R-GUARD-12 an R-TRANS-04 | Test 21; Abschnitt „Role × Verweigerung“, Zeile `answer_drafted` |
| Verweigerung freigegeben ohne Rechtsfreigabe (T-G1-E-03), auch bei abgeschalteter Pfadzeile | R-GUARD-08, unabhängig von `LEGAL_GATE_BY_TRACK` | Test 9; abgewiesener Versuch als 409 mit Regel-id im Zugriffslog (033a, ab 044b über HTTP) |
| Selbstfreigabe: Vorschlagende gibt rechtlich frei oder gibt frei, auch nach Rollenwechsel mit demselben Subject (T-G1-E-02, MF-07) | R-GUARD-06 an R-TRANS-13 und R-TRANS-16 vergleicht die Akteur-id | Test 10; Mutationsprobe 12 |
| Dasselbe Subject klärt rechtlich (`legal`) und gibt danach frei (`approver`), etwa nach Ablauf oder Entzug der `legal`-Zuordnung | R-GUARD-14 an R-TRANS-16 | Test 10; Mutationsprobe 14 |
| Eine Person mit zwei Subjects übernimmt zwei der drei Schritte | nicht technisch abwehrbar (Restrisiko, neben MF-01) | `RoleAssigned` je Subject in `listEvents`; Alarmvorschlag an 085 aus 040a („Zuordnung eines Freigabe- oder Rechtsrechts“) |
| „Kein Kommentar“ als Begründung oder leere Begründung (Recherche Z.64) | R-GUARD-09 trimmt; leer ist 409 | Test 5. Ein inhaltsleerer, nicht leerer Text („k. A.“) ist nicht abwehrbar; dafür sorgen Rechtsfreigabe und Freigabe durch zwei weitere, verschiedene Personen (R-GUARD-06, R-GUARD-14) |
| Verweigerung als Antwort verkleidet: `legal` oder `expert` schreibt „dazu keine Angaben“ in eine normale Antwort, ohne Grund und ohne `refuse.approve` | nicht technisch abwehrbar (Inhalt); die Antwort braucht trotzdem Rechtsfreigabe und Freigabe | Restrisiko, benannt; Prüfliste je Pfad (059) und Soll-Ist (049) sind die Folgekontrollen |
| `expert` verdrängt eine vorgeschlagene Verweigerung durch einen neuen Antwortentwurf (R-TRANS-03 aus `in_review`) | erlaubt (neueste Version gilt); die Antwort braucht erneut Rechtsfreigabe und Freigabe | Ereignisse `AnswerDrafted` mit Akteur und Antwortart in der Historie; Test 22; Eigentümerfrage 6 |
| Massenhaft Verweigerungen vorschlagen, um Fragen zu verzögern | jede braucht Rechtsfreigabe und Freigabe durch zwei andere Personen | Historie je Frage; Kennzahl `questionsInLegalReviewOver10m` zählt Vorschläge mit (Test 26); Kennzahl „Verweigerungen je Pfad“ als Vorschlag an 053/087, nie je Person (6.6) |
| Verweigerung bleibt in der Rechtsprüfung liegen, ohne dass die Betriebsauswertung es zeigt | `indicators.ts` setzt `inReviewSince` beim Vorschlag | Test 26 |

**Zusammenspiel:**
- **Freeze:** Rechte und Übergänge stehen im Freeze-Schnappschuss (040d). Eine spätere Änderung der Guards (etwa R-GUARD-08
  entfernt) kommt nur mit einem Deploy. Ein neuer Freeze bzw. Override zeigt dann einen anderen Hash und eine andere
  Build-Kennung. Ist 040d vor 044a gemergt, ändert 044a den Inhalt jedes **künftigen** Schnappschusses. Ein schon
  eingefrorener Jahrgang behält seinen Schnappschuss; der Unterschied ist bewusst und erkennbar (Test 20).
- **Ablauf:**
  - Eine Rechtsfreigabe bleibt gültig, wenn die Zuordnung der Juristin danach abläuft; das Ereignis ist eine Tatsache.
    R-GUARD-14 vergleicht die Akteur-id der Rechtsfreigabe, nicht die Rolle; ein Rollenwechsel desselben Subjects hebt
    die Trennung also nicht auf.
  - Wer seine Zuordnung verloren hat, kann weder vorschlagen noch freigeben (Akteur-Auflösung, 029b).
  - Die Übernahme (028) blockiert keinen Vorschlag; sie ist nur Anzeige.
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
| Katalog zur Laufzeit verändert (etwa über ein zurückgegebenes Objekt aus `listRefusalGrounds` oder einen Import im Browser) | tief eingefroren; `listRefusalGrounds` gibt eine tiefe Kopie | Test 1 und Test 19 (Änderung auch an `legalRef`) |
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

### Maskierung der Begründung und des Vermerks

| Missbrauch oder Fehlgebrauch | Abwehr | Erkennung, Nachweis |
|---|---|---|
| Begründung über `getQuestion`/`listQuestions` gelesen als admin, `moderation`, `capture`, `expert` oder `observer` (T-G1-I-01, T-G1-E-04) | `viewQuestion` mit `REFUSAL_JUSTIFICATION_READ` | Test 14 |
| Begründung über die Antwort eines Schreibvorgangs gelesen (admin gibt zurück, `podium` liest vor) | jede Schreibantwort geht durch `viewQuestion` | Test 14 (`returnQuestion` als admin, `deliverQuestion` als `podium`) |
| Begründung über die Historie gelesen (`history.read` ohne `refuse.*`) | `pii` und `MASKED_KEYS` | Test 14 |
| Begründung über `listEvents` oder `subscribe` gelesen, admin mit `event.read` (T-G1-I-02, T-G1-I-09) | dieselbe Maskierung; dasselbe gilt für `/stream` | Test 14; 044b über HTTP und SSE |
| Begründung über die Bühne gelesen (`approver` und `moderation` halten `stage.read`, `podium` sowieso) | `getStage` maskiert immer | Test 14 |
| Begründung über die Suche erschlossen (T-G1-I-04) | nie im Suchtext | Test 15 |
| Begründung über eine Wiederholung mit gleichem Idempotenzschlüssel gelesen | Schlüssel gilt je Akteur (`api.ts:599`); die historische Antwort maskiert nach aktuellem Leser | Test 14 (Wiederholung) |
| Begründung einer älteren, durch eine Antwort verdrängten Verweigerung gelesen | Maskierung gilt für jede Version | Test 14 |
| Rechtseinschätzung im Vermerk der Rechtsfreigabe (`QuestionLegalCleared.note`) als Seitenkanal der Begründung | `maskEvent` entfernt `note` bei `QuestionLegalCleared`, nicht in der Projektion | Test 24; Mutationsprobe 15 |
| Begründung im Zugriffslog oder in einer Fehlermeldung | Zugriffslog ohne Nutzdaten (ADR 0013); kein `detail` mit Text | Test 5, Test 6 und Test 23 prüfen `detail` |

**Zusammenspiel:**
- **Freeze:** Der Leserkreis ist Rechtedatum und steht damit im Schnappschuss (040d).
- **Ablauf:** Rechte gelten zum Zeitpunkt des Lesens. Wer `legal` verliert, sieht die Begründung beim nächsten Abruf nicht
  mehr. Der Strom liefert ohnehin nur Änderungssignale bzw. maskierte Ereignisse (R-PERM-04).
- **Korrektur:** Verdrängte Versionen bleiben maskiert (Zeile oben). Das gespeicherte Original behält Begründung und
  Vermerk (Append-only, R7). Ein späterer echter `pii`-Codec (073) kann die Begründung je Jahrgang unlesbar machen, ohne
  ein Ereignis zu ändern (ADR 0009).

## Datenschutz (DSFA-Vorentwurf, Zeile V7)

- **Felder:** `answerKind`, `refusalGroundId`, `refusalGroundHash`, Schnappschuss, `text`, `refusalJustification`;
  Ersteller, rechtlich Freigebende und Freigebende als Akteur-id; Klarnamen nur über die Personentabelle (026).
- **Betroffene:** Die Begründung kann den Aktionär persönlich betreffen. Gerade bei Pfad A (keine Legitimation, verspätet,
  kein Auskunftsanspruch) ist sie eine Aussage über den Fragesteller. Sie ist deshalb als personenbezogenes Datum zu
  behandeln, nicht als bloße Rechtseinschätzung.
- **Ablage:** Die Begründung liegt im `pii`-Teil des Ereignisses (`payload.pii` mit `keyId` des Jahrgangs, ADR 0009),
  nicht im Klartext von `answer`. Damit greifen später Codec, Schlüsselverwahrung und Crypto-Shredding je Jahrgang, und
  `maskEvent` entfernt sie in jedem Ereignis-Lesepfad.
- **Empfänger:**
  - die Begründung: nur Halter von `question.refuse.*` (`legal`, `coordination`, `approver`);
  - Antwortart, Grund und Wortlaut: alle Leser der Frage, die Bühne ab `staged`, der Beobachter ab `delivered`;
  - der Vermerk der Rechtsfreigabe: niemand über einen Lesepfad (nur gespeichertes Original).
- **Aufbewahrung:** `retentionClass: 'record'` auf `AnswerDrafted` (Verweigerung) und `QuestionApproved` (aus
  `approveRefusal`), gesetzt in `api.ts` und belegt durch Test 28; `legalHold` wie jedes Ereignis (`false`). Die Lücke bei
  den übrigen Antwortereignissen (V5, V6) und bei der Rechtsfreigabe ist benannt (Entscheidung 5, Eigentümerfrage 9).
- **Datensparsamkeit:** Die Dialoghilfe in 045 sagt „nur, was für die Entscheidung nötig ist; keine Namen Dritter“.
- **Offene Frage an den DSB (E14, Eigentümerfrage 9):** Umfang der Betroffenenauskunft (Art. 15 DSGVO) für Begründungen,
  Rechtsgrundlage für Pfad-A-Begründungen über den Aktionär, Aufbewahrung. Ein Umschreiben des Nachweises ist
  ausgeschlossen (R7).
- **V7 wird ergänzt, nicht geglättet:**
  - Die Schutzmaßnahme „Kein Zustand ohne Grund speicherbar“ bleibt stehen und erhält den Zusatz: „für Pfad B umgesetzt
    (R-GUARD-09); für Pfad A **nicht erfüllt**: kein zugeordneter Grund (Vertrag 0.4.0), Begründung Pflicht; offen bis
    Eigentümerfrage 3b / 044c“.
  - Empfänger der Begründung, ausdrücklich in zwei Änderungen: **Podium entfällt** als Empfänger (es sieht nur Antwortart,
    Grund und Wortlaut, nie die Begründung), **Koordination kommt hinzu** (`coordination` hält
    `question.refuse.propose`). Neu: „Begründung: Recht, Koordination, Freigabe; Podium: nur Wortlaut, Antwortart und
    Grund ab `staged`“.
  - Ablage der Begründung im `pii`-Teil; Verweis auf E14.

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6, 043a Regel 1)

Der Kern schreibt neue Nutzlastfelder und ändert, was ein Ereignis-Leser sieht. Deshalb kommt der Vertrag zuerst, im
ersten Commit dieser Scheibe, **nur additiv und nur in Beschreibungen** (kein neues Schema-Feld, keine neue Pflicht, kein
neues Anfragefeld):

- **Version:** die nächste freie Patch-Stufe nach 0.4.0 beim Merge (heute erwartet 0.4.1). `info.version`,
  `packages/contract/package.json` und ein Abschnitt `## [0.4.x]` in `packages/contract/CHANGELOG.md` (`### Changed`:
  Beschreibungen; Vermerk „auf Standard gebaut“).
- **`Event`-Beschreibung, Nutzlast `AnswerDrafted`:** `toStatus` (Zielstatus aus der Übergangstabelle, nur bei
  `proposeRefusal`, Wert aus `QuestionStatus`); `pii` mit `keyId` und `refusalJustification` (die Begründung steht nur
  dort, nie in `answer`; 043a nannte bisher `answer.refusalJustification` „nur im gespeicherten Original“, das wird
  berichtigt); `retentionClass: record` bei Verweigerungen.
- **`EventRead`-Beschreibung:** `pii` fehlt wie bisher; `QuestionLegalCleared.note` fehlt in jedem Ereignis-Lesepfad
  (`getQuestionHistory`, `listEvents`, `streamEvents`), für jeden Leser. Kein `false` im Schema: Die Maskierung ist an den
  Ereignistyp gebunden, nicht an den Schlüssel (Nachprüfung m2); die Probe über HTTP folgt in 044b.
- **`proposeRefusal`, Antwort 409:** R-GUARD-09 umfasst Pfad B ohne Grund **und** jede Verweigerung (Pfad A und B) ohne
  nicht leere Begründung. **Antwort 422:** Form und Länge (Validator und Kern), unbekanntes `refusalGroundId` (Kern).
- **`approveRefusal`, Antwort 409:** ergänzt um R-GUARD-04, R-GUARD-12/13 und R-GUARD-14.
- **Typen:** `pnpm contract:types` regeneriert `packages/contract/src/types.ts`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.0 -> 0.4.x`. Versionsprüfungen
  in den Vertragstests (`apps/api/src/__tests__/contract*.test.ts`, `takt-0*-contract.test.ts`) ziehen nur ihre
  Versionszeile nach.
- Ist beim Baustart schon eine andere 0.4.x-Stufe gemergt, nimmt dieser Schritt die nächste. Ist 043a nicht gemergt:
  anhalten (Vor-dem-Bau-Punkt 1).

## Nicht-Ziele

- Keine Formänderung am Vertrag. Der Vertragsschritt im ersten Commit ändert nur Beschreibungen (Abschnitt
  „Vertragsschritt“). Ein Feld, das 0.4.0 nicht kennt und dort nicht steht, ist ein Befund: anhalten und melden, nicht
  still ergänzen.
- Keine Dienstroute, keine Allowlist-Änderung, keine HTTP-Tests der neuen Operationen (044b).
- Keine Oberfläche: kein Dialog, kein Kennzeichen, kein „ungeprüft“-Abzeichen, keine Historienzeile „Verweigerung
  vorgeschlagen“ (045). Nur die zwei Aktionsschlüssel, die die Typprüfung erzwingt.
- Kein Export, keine Markierung von Verweigerungen im Export. Die Planzeile 044 nennt „Export markiert Verweigerungen“; im
  Code gibt es noch keinen Export (`exports/record` kommt mit 051). Das ist eine **ausdrückliche Verschiebung nach 051**,
  Teil des Go zu Eigentümerfrage 2 und der Planänderung für die Einträge 044 und 051 (Begründung im Export: 043d, Standard
  nein).
- Kein gebundenes Nutzlastschema für `AnswerDrafted` (043c).
- Keine Untergründe für Pfad A, kein Katalog für Pfad A (Eigentümerfrage 3b; Zielscheibe 044c).
- Kein Modell B, keine neuen Zustände, keine Anzeigegruppen (Register „o. Nr. 2“).
- Keine Kennzeichen `deferred`, `correctionOpen`, `followUp` (046); keine Prüfliste (059, R-GUARD-10); kein Alarm (085).
- Keine Verweigerung auf Podiumsfragen (Eigentümerfrage 5).
- Keine Trennung von Rechtsfreigabe und Freigabe für Antworten (Eigentümerfrage 8).
- Kein Beispiel einer Verweigerung im Seed (045 entscheidet über Demodaten).
- Keine Zähldefinition für Verweigerungen (053/087).
- Kein echter `pii`-Codec (073).
- Keine Änderung an ADR 0012 (der Vermerk „auf Standard gebaut“ steht in den Regeltexten, im Rechtekonzept, im Register
  und im Bericht).

## Files allowed

Vertrag (Architekt, erster Commit, nur Beschreibungen):

- `packages/contract/openapi.yaml` (nur Beschreibungen und `info.version`, Abschnitt „Vertragsschritt“)
- `packages/contract/CHANGELOG.md` (nur der neue Abschnitt)
- `packages/contract/package.json` (nur `version`)
- `packages/contract/src/types.ts` (nur regeneriert mit `pnpm contract:types`)

Kern:

- `packages/domain/src/refusalGrounds.ts` (neu)
- `packages/domain/src/types.ts` (nur: `AnswerKind`, die vier optionalen Felder an `AnswerVersion`, `RefusalProposal`, die zwei Einträge in `PERMISSIONS`, der Eintrag `listRefusalGrounds` in `READ_PERMISSIONS`; dazu der veraltete Kommentar in Zeile 304)
- `packages/domain/src/permissions.ts` (nur die Bündel von `legal`, `coordination`, `approver` und `REFUSAL_JUSTIFICATION_READ`)
- `packages/domain/src/transitions.ts` (nur R-TRANS-15, R-TRANS-16, die sechs Guards und R-GUARD-12 an R-TRANS-04 und R-TRANS-05)
- `packages/domain/src/events.ts` (nur die Nutzlast von `AnswerDrafted`: `toStatus`, `pii`, Schnappschuss, Verweigerungsfelder)
- `packages/domain/src/state.ts` (nur der Fall `AnswerDrafted`: `toStatus` mit Prüfung gegen `QUESTION_STATUSES`, Begründung aus `pii`, Schnappschuss nicht in die Projektion)
- `packages/domain/src/indicators.ts` (nur: `AnswerDrafted` mit `toStatus === 'in_review'` setzt `inReviewSince`)
- `packages/domain/src/api.ts` (nur: `HvApi` um drei Methoden, ihre Umsetzung, die Maskierung in `viewQuestion` und `getStage`; dazu der veraltete Kommentar in Zeile 925)
- `packages/domain/src/stream.ts` (nur: `refusalJustification` in `MASKED_KEYS` und das Entfernen von `note` bei `QuestionLegalCleared` in `maskEvent`)
- `packages/domain/src/index.ts` (nur Export des Katalogs)
- `packages/domain/policy-truth-table.md` (nur regeneriert)
- `docs/legal-trace.md` (nur regeneriert)

Tests im Kern:

- `packages/domain/src/__tests__/refusal044a.test.ts` (neu)
- `packages/domain/src/__tests__/transitions.test.ts` (nur: `GUARD_SCENARIOS` für die sechs Guards, Regeltests für R-TRANS-15/16, neuer Abschnitt „Role × Verweigerung“)
- `packages/domain/src/__tests__/indicators*.test.ts` (nur der neue Fall aus Test 26)
- `packages/domain/src/__tests__/*.test.ts` (nur Erwartungen an `_actions`, an Rechtelisten, an den maskierten Vermerk `note` und an Zählungen von Regeln oder Rechten, die sich durch diese Spec ändern; jede andere Änderung ist ein Befund)
- `apps/api/src/__tests__/*.test.ts` (dieselbe Einschränkung, dazu die Versionszeilen der Vertragstests; keine neuen Tests der Operationen, die kommen mit 044b)

HTTP-Client, Live-Puffer und Oberfläche (nur Typprüfung):

- `apps/web/src/api/http.ts` (nur die drei Methoden)
- `apps/web/src/api/http.test.ts` (nur Tests der drei Methoden: Methode, Pfad, Body, Schreibkopfzeilen)
- `apps/web/src/api/liveStore.ts` (nur die Einträge der drei Methoden)
- `apps/web/src/api/liveStore.test.ts` (nur, falls die Vollständigkeitsprüfung eine Liste führt)
- `apps/web/src/i18n/labels.ts` (nur zwei Einträge in `ACTION_KEYS`)
- `apps/web/src/i18n/shell.de.ts` und `apps/web/src/i18n/shell.en.ts` (nur die zwei Aktionsschlüssel)
- `apps/web/src/i18n/parity.test.ts` (nur Zahl und Kommentar)

Dokumente:

- `docs/rollen-und-rechtekonzept.md` (nur ein Kopfvermerk „Scheibe 044a“ wie bei 025, 026, 028, 040a: Vergabe der zwei Rechte, Leserkreis der Begründung, drei verschiedene Personen bei der Verweigerung, Vorschlag direkt in die Prüfung, Begründungspflicht für beide Pfade, Invariante „kein Grund ohne Zuordnung“ für Pfad A nicht erfüllt, auf Standard gebaut)
- `docs/sicherheit/bedrohungsmodell.md` (nur: Fundstelle von SG2; Zeile 044 in „Weitere Scheiben mit Sicherheitsbezug“; Nachweise an T-G1-E-03 und MF-07; Restrisiko „zwei Subjects einer Person“ bei MF-01; ein Missbrauchsfall „Verweigerung ohne Rechtsprüfung oder mit geändertem Grund“ in Abschnitt 7)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V7 und ein offener Punkt für den DSB in Abschnitt 5)
- `docs/folgeliste.md` (nur: neue nicht blockierende Befunde aus dem Bau; keine Sicherheits-, Datenschutz- oder Rechtspunkte)
- `docs/slices/044a-verweigerung-kern.md` (diese Spec: Bericht, Review findings)
- `docs/entscheidungsregister.md` (nur durch den Orchestrator mit dem Merge: E15 auf „auf Standard gebaut am <Datum> in 044a“, „Betroffene Scheibe(n)“ von E14, E15 und E25 um „044a“, Textspalte von S6 um den Verweis)
- `docs/produktplan-beta.md` (nur durch den Orchestrator und nur nach dem Go zu Eigentümerfrage 2: Teilungsvermerk im Eintrag 044, Lanes, Kalender)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/allowlist.json` (die Einträge entfernt 044b), `packages/contract/scripts/**`, `apps/api/src/**` außer den Testdateien,
`apps/web/src/features/**`, `apps/web/e2e/**`, `packages/domain/src/seed.ts`, `packages/domain/src/rules.ts` (das Register
entsteht aus den Tabellen; braucht es doch eine Änderung, ist das ein Befund), `packages/domain/src/piiCodec.ts`,
`packages/domain/src/envelope.ts`, `docs/adr/**`, `docs/glossar.md`. Dieser Abschnitt steht bewusst außerhalb von „Files
allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

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
3. **Regel-ids:** Sind R-TRANS-15/16 und R-GUARD-12/13/14 noch frei? Sonst die nächsten freien nehmen und im Bericht
   nennen. R-GUARD-08, -09 und -11 bleiben.
4. **046 gemergt?** Wenn ja: Gibt es neue Zeilen aus `delivered` oder Kennzeichen auf der Frage? Das Zusammenspiel mit
   Vorschlag und Freigabe beschreibt der Bericht und testet es. Bei einem Widerspruch: anhalten.
5. **Eigentümerfragen 1, 2 und 3b:** Stand in den Bericht. Ohne Go zu 2 und 3b: nicht bauen. Liegt eine Antwort von Recht
   vor, die dieser Spec widerspricht: anhalten, der Architekt passt die Spec an.
6. **Live-Puffer:** Was verlangt die Vollständigkeitsprüfung (p) in `liveStore.test.ts` für eine neue Lesemethode ohne
   Thema?
7. **`_actions`- und `note`-Erwartungen:** Liste der Tests, deren genaue `_actions`-Liste sich ändert oder die `note` in
   einem Ereignis erwarten (Datei, Testname), in den Bericht.
8. **`canonicalJson` = RFC 8785** für die Katalogwerte, einschließlich `null`: Test 1 belegt das mit einer von Hand
   geschriebenen kanonischen Zeichenkette für einen Eintrag.
9. **040d gemergt?** Wenn ja: Test 20 (Schnappschuss enthält die neuen Zeilen und Rechte). Wenn nein: Test 20 entfällt;
   der Bericht vermerkt den Übergang an 040d.
10. **`pii` im Reducer:** Liest der Reducer `payload.pii` weiterhin ohne Decodierung (`state.ts:186`, `identityPiiCodec`)?
    Ist inzwischen ein echter Codec eingebaut (073): anhalten und melden.
11. **Kennzahlentest:** In welcher Datei steht der Test von `indicators.ts`? Der neue Fall gehört dorthin.

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
   - Liste, Einträge und jedes `legalRef` sind eingefroren (`Object.isFrozen`).
2. **Rechte:**
   - `question.refuse.propose` halten genau die Bündel von `legal` und `coordination`, `question.refuse.approve` genau
     das von `approver`; geprüft mit einer Schleife über `ROLE_PERMISSIONS`;
   - admin hält keines;
   - `PERMISSIONS` führt beide direkt nach `question.legal.clear`;
   - `REFUSAL_JUSTIFICATION_READ` ist genau diese zwei.
3. **Pfad B, Vorschlag:**
   - `legal` schlägt auf einer Frage in `assigned` (Textpfad) mit Grund `aktg-131-3-nr1` vor;
   - die Frage geht nach `in_review` mit neuer Version: `answerKind`, Grund, Hash = Katalog-Hash, Begründung getrimmt;
   - das gespeicherte Ereignis `AnswerDrafted` trägt `toStatus: 'in_review'`, den Schnappschuss und
     `pii: { keyId: <meetingId>, refusalJustification }`; `answer` trägt **keine** Begründung;
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
   - `answerKind: 'answer'`; unbekannter `answerKind`; `answerKind` keine Zeichenkette;
   - leerer `text`; `text` keine Zeichenkette; `text` mit 20001 Zeichen (20000 gelingt);
   - `refusalJustification` mit 4001 Zeichen (4000 gelingt); `refusalJustification` keine Zeichenkette;
   - `refusalGroundId` mit 129 Zeichen; `refusalGroundId` keine Zeichenkette;
   - `sources` kein Array aus Zeichenketten;
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
   - nach `clearQuestionLegally(v2)` durch eine zweite Person → `approveRefusal(2)` durch eine dritte → `approved`,
     Ereignis `QuestionApproved { answerVersion: 2 }`.
10. **Vier-Augen und Trennung:**
    - `legal` L1 schlägt vor, L1 gibt rechtlich frei → 409 R-GUARD-06;
    - ein Akteur mit derselben id wie die Vorschlagende in der Rolle `approver` → `approveRefusal` 409 R-GUARD-06;
    - **R-GUARD-14:** `coordination` C schlägt vor; Subject S klärt als `legal` rechtlich; S verliert die Zuordnung
      `legal` (Entzug; als zweite Variante Ablauf über die injizierte Uhr) und erhält `approver`; `approveRefusal` als S
      → 409 R-GUARD-14; als anderes Subject mit `approver` → `approved`.
11. **R-GUARD-04/12/13:**
    - `approveQuestion` auf einer Verweigerungsversion → 409 R-GUARD-12;
    - `approveRefusal` auf einer Antwortversion → 409 R-GUARD-13;
    - Verweigerung v2 rechtlich freigegeben, `approveRefusal(1)` → 409 R-GUARD-04.
12. **R-GUARD-11:** Ein Vorschlag mit veraltetem Hash wird simuliert, indem ein `AnswerDrafted` direkt an den Store
    angehängt wird, wie es ein früherer Katalog geschrieben hätte. Danach Rechtsfreigabe; `approveRefusal` → 409 R-GUARD-11,
    `_actions` von `approver` ohne `question.refuse.approve`. Dasselbe mit einer `refusalGroundId`, die nicht im Katalog
    steht. Ein frischer Vorschlag mit aktuellem Hash lässt sich danach freigeben.
13. **Ganze Kette Pfad B und Pfad A:** Vorschlag → Rechtsfreigabe → Freigabe → `stageQuestion` (`moderation`, R-GUARD-07
    erfüllt) → `deliverQuestion` (`podium`) mit `QuestionDelivered.answerVersion` = Verweigerungsversion →
    `closeQuestion`.
14. **Maskierung der Begründung:**
    - `getQuestion` als `legal`, `coordination` und `approver`: `refusalJustification` vorhanden;
    - als admin, `moderation`, `capture`, `expert` (gleiche Einheit) und `observer` (nach `delivered`): fehlt;
    - `approver` auf einer Verweigerung in `in_review` **ohne** Rechtsfreigabe (Freigabe also nicht möglich): vorhanden;
    - **Schreibantworten:** die Antwort von `returnQuestion` als admin und die Antwort von `deliverQuestion` als `podium`
      tragen in keiner Version `refusalJustification`;
    - `getStage` als `approver` und als `podium` (nach `staged`): fehlt;
    - `listQuestions` als admin: fehlt;
    - eine durch einen neuen Antwortentwurf verdrängte Verweigerungsversion: für `moderation` maskiert, für `legal`
      sichtbar;
    - `getQuestionHistory` als `legal`, `listEvents` als admin, `subscribe` als `legal`: weder `payload.pii` noch
      `payload.answer.refusalJustification`; Schnappschuss vorhanden;
    - Wiederholung von `proposeRefusal` mit gleichem Idempotenzschlüssel als `legal`: historische Antwort mit Begründung,
      kein neues Ereignis.
15. **Suche:** `listQuestions({ q })` als `legal` mit einem Wort, das nur in der Begründung steht → 0 Treffer; mit einem
    Wort aus `text` → 1 Treffer.
16. **`draftAnswer` bleibt Antwort:** Eingabe mit `answerKind: 'refusal_with_ground'`, `refusalGroundId` und
    `refusalJustification` → die Version trägt keines dieser Felder, das Ereignis hat kein `pii`; R-GUARD-12 gilt weiter
    als Antwort.
17. **`_actions`:**
    - `legal` auf einer Textfrage in `assigned` enthält `question.refuse.propose`, auf einer Podiumsfrage nicht;
    - `approver` auf einer rechtlich freigegebenen Verweigerung in `in_review` enthält `question.refuse.approve` und nicht
      `question.approve`, ohne Rechtsfreigabe keines von beiden;
    - admin enthält auf keiner Frage des Seeds und keiner Verweigerung ein `question.refuse.*`.
18. **Wiederaufbau:**
    - eine zweite `createInProcessApi` auf demselben Store ergibt dieselbe Frage (Status `in_review`, Version,
      Begründung für `legal`);
    - ein `AnswerDrafted` ohne `toStatus` führt weiter nach `answer_drafted` (Regression);
    - ein direkt angehängtes `AnswerDrafted` mit `toStatus: 'bogus'` führt nach `answer_drafted`.
19. **`listRefusalGrounds`:**
    - gelingt für alle neun Rollen des Seeds (jede hält eines der drei Leserechte); sieben Einträge mit `hash`;
    - eine Rolle ohne Bündel → 403 R-PERM-02;
    - das Ergebnis ist eine tiefe Kopie: Änderungen an `title` **und** an `legalRef.citation` eines Ergebnisses ändern
      weder den Katalog noch das nächste Ergebnis.
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
23. **`If-Match`:** `proposeRefusal` und `approveRefusal` mit veralteter Version → 412, kein Ereignis, `detail` ohne Text.
24. **Vermerk der Rechtsfreigabe:** `clearQuestionLegally` mit `note` (Antwort und Verweigerung) → das gespeicherte
    Ereignis trägt `note`; `getQuestionHistory` als `legal`, `listEvents` als admin und `subscribe` liefern es ohne
    `note`; `getQuestion` trägt keinen Vermerk. **Gegenprobe (Enge):** `maskEvent` auf ein konstruiertes Ereignis eines
    anderen Typs mit `payload.note` lässt `note` stehen.

`packages/domain/src/__tests__/transitions.test.ts`:

25. `GUARD_SCENARIOS` für R-GUARD-08, -09, -11, -12, -13 und -14 (erfüllt und verletzt; R-GUARD-12 und -13 auch ohne
    Version). Regeltests für R-TRANS-15 und R-TRANS-16 (bestehende Prüfung „jede Regel-id hat einen Test“). Der neue
    Abschnitt „Role × Verweigerung“ ist genau die Tabelle aus „Wahrheitstabellen-Diff“.

Test von `indicators.ts` (Datei nach Vor-dem-Bau-Punkt 11):

26. Ein Vorschlag bei t0 auf einem laufenden Jahrgang: bei t0 + 11 min zählt `questionsInLegalReviewOver10m` die Frage,
    bei t0 + 9 min nicht. Eine Frage, die vorher schon einmal in `in_review` war (alter `QuestionSubmittedForReview`),
    zählt ab dem Vorschlag, nicht ab dem alten Zeitpunkt. Ein zweiter Vorschlag aus `in_review` bei t0 + 8 min: bei
    t0 + 11 min zählt die Frage nicht, bei t0 + 19 min zählt sie (die Uhr beginnt neu).

`apps/web/src/api/http.test.ts`:

27. Die drei Methoden senden Methode, Pfad und Body nach 0.4.0. Die beiden schreibenden senden `Idempotency-Key`, CSRF und
    `If-Match` wie `draftAnswer`.

`packages/domain/src/__tests__/refusal044a.test.ts` (Fortsetzung):

28. **Aufbewahrungsklasse:** Das gespeicherte `AnswerDrafted` aus `proposeRefusal` (Pfad A und B) und das
    `QuestionApproved` aus `approveRefusal` tragen `retentionClass: 'record'`; `AnswerDrafted` aus `draftAnswer` und
    `QuestionApproved` aus `approveQuestion` tragen weiter `working` (Enge der Änderung).

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):

1. Maskierung in `viewQuestion` mit `can(actor(), p, q)` statt `can(actor(), p)` → Test 14 (Fall „ohne Rechtsfreigabe“) rot.
2. `refusalJustification` in `answer` statt in `pii` geschrieben und aus `MASKED_KEYS` entfernt → Test 3 und Test 14
   (Ereignisse) rot.
3. Begründung in den Suchtext aufgenommen → Test 15 rot.
4. R-GUARD-08 aus R-TRANS-16 entfernt → Test 9 und der Abschnitt „Role × Verweigerung“ rot.
5. R-GUARD-12 aus R-TRANS-05 entfernt → Test 11 und der Abschnitt rot.
6. R-GUARD-11 prüft immer wahr, oder der Hash wird ohne Sortierung berechnet → Test 12 bzw. Test 1 rot.
7. `question.refuse.propose` an admin → Test 2, Test 17 und Abschnitt 1 der Wahrheitstabelle rot.
8. R-GUARD-09 ohne `trim()` → Test 5 rot.
9. `getStage` maskiert nicht → Test 14 (Bühne als `approver`) rot.
10. Reducer ignoriert `toStatus` oder übernimmt jeden Wert → Test 3 bzw. Test 18 rot.
11. Begründungspflicht für Pfad A entfernt → Test 5 (letzter Fall) rot.
12. R-GUARD-06 aus R-TRANS-16 entfernt → Test 10 (zweiter Fall) rot.
13. R-GUARD-13 aus R-TRANS-16 entfernt → Test 11 (zweiter Fall) rot.
14. R-GUARD-14 aus R-TRANS-16 entfernt → Test 10 (R-GUARD-14) rot.
15. Das Entfernen von `note` in `maskEvent` gestrichen → Test 24 rot; `note` stattdessen in `MASKED_KEYS` (rekursiv) → Test 24 (Gegenprobe) rot.
16. `inReviewSince` bei `AnswerDrafted` nicht gesetzt → Test 26 rot.
17. Katalog nur flach eingefroren oder flach kopiert → Test 1 bzw. Test 19 rot.
18. `retentionClass: 'record'` in `proposeRefusal` oder `approveRefusal` weggelassen → Test 28 rot.

## Akzeptanzkriterium

1. Die Tests 1–28 sind grün (Test 20 nur, wenn 040d gemergt ist), die 18 Mutationsproben rot belegt.
2. `git diff -- packages/domain/policy-truth-table.md` zeigt genau den Diff aus „Wahrheitstabellen-Diff“: zwei neue
   Spalten, 10 ✓ in `q.refuse.propose`, keine ✓ in `q.refuse.approve`, keine geänderte bestehende Zelle, neuer
   Abschnitt „Role × Verweigerung“ mit 27 Zeilen.
3. `docs/legal-trace.md` enthält R-TRANS-15, R-TRANS-16, R-GUARD-08, -09, -11, -12, -13 und -14. Jede `citation` trägt den
   Vermerk „auf Standard gebaut (ADR 0012 vorgeschlagen, von Recht nicht gelesen)“, solange Eigentümerfrage 1 offen ist.
   Die `citation` von R-GUARD-09 nennt die Lücke gegenüber Rechtekonzept §4 und Recherche Z.63 als „nicht erfüllt“.
   `verified` ist `false`.
4. `git diff` gegen die Merge-Basis zeigt Änderungen nur in „Files allowed“. `packages/contract/**` ist unverändert.
5. `pnpm gates` (mit Postgres-Variablen wie in CI) ist grün, einschließlich `slice-scope` auf `claude/slice-044a-…`. Der
   Schluss der Ausgabe steht einmal im Bericht. Das Projekt http der e2e-Suite läuft in der PR-CI grün (keine
   Oberflächenänderung erwartet).

## Nachweise

- Diff der Wahrheitstabelle (wörtlich, beide Abschnitte).
- Auszug aus `docs/legal-trace.md` für die acht neuen Regeln.
- Hash-Snapshot des Katalogs (Test 1).
- Ein gespeichertes `AnswerDrafted` einer Verweigerung (Test 3) und dasselbe Ereignis als `EventRead` (Test 14), als Auszug.
- Ergebnis der Mutationsproben.
- Liste der geänderten `_actions`- und `note`-Erwartungen (Vor-dem-Bau-Punkt 7).
- Schluss von `pnpm gates` mit Commit-Hash.
- **Kein Screenshot:** Keine Ansicht ändert sich. Die zwei Aktionsschlüssel werden erst mit 045 gerendert. Screenshots von
  Dialog und Bühne verlangt 045.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Fachregel, Status (zwei Zeilen, sechs Guards, Ziel `in_review` über `toStatus`)
- [x] Rolle, Recht, Schutzklasse (zwei Rechte, Leserkreis der Begründung, Trennung Rechtsfreigabe/Freigabe)
- [x] personenbezogene oder vertrauliche Daten (Begründung im `pii`-Teil, Vermerk maskiert; SG2; DSFA V7; E14)
- [x] Vertrag, Ereignis (Patch-Stufe nach 0.4.0, nur Beschreibungen, erster Commit: `toStatus` und `pii` in `AnswerDrafted`, `note` fehlt in `EventRead`, R-GUARD-09 für beide Pfade; Bindung des Nutzlastschemas mit 043c)
- [x] Betrieb (Kennzahl `questionsInLegalReviewOver10m`)
- [ ] Persistenz, Migration (kein neuer Ereignistyp, keine Migration; alte Ereignisse bleiben gültig, Test 18)
- [ ] Oberfläche (nur zwei Schlüssel, nicht gerendert)

Perspektive(n): Legal, Security (6.5), Datenschutz (6.6) · Nachweise: Tests 1–28, Mutationsproben, Wahrheitstabellen-Diff,
Regelregister · Offene Entscheidung: E14 (DSB), E15 (Katalog, Pfad A), E25 (Freigabe, Leserkreis), E40 (eine Juristin),
ADR 0012 (Eigentümerfrage 1)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** Verweigerung, Freigabe, Rechte und eine personenbezogene Rechtseinschätzung als neues geschütztes Datum
  (Leitplanken §4). Höchstes rechtliches Risiko im Plan (Eintrag 044).
- **Bedrohungen** (Bedrohungsmodell):
  - **SG2:** Leserkreis, Schreibantworten, Bühne, Ereignis-Lesepfad, Vermerk und Suche sind geregelt (Entscheidung 6).
  - **T-G1-E-02** und **MF-07:** R-GUARD-06 an Rechtsfreigabe und Freigabe der Verweigerung; R-GUARD-14 trennt
    Rechtsfreigabe und Freigabe.
  - **MF-01:** Eine Person mit zwei Subjects bleibt Restrisiko (Abschnitt 7 des Bedrohungsmodells erhält den Satz).
  - **T-G1-E-03:** R-GUARD-08 unabhängig von der Pfadtabelle; kein Eilpfad.
  - **T-G1-E-04:** admin hält weder `refuse.*` noch den Leserkreis.
  - **T-G1-I-01, T-G1-I-02, T-G1-I-09:** `viewQuestion`, `pii` und `MASKED_KEYS`.
  - **T-G1-I-04:** die Suche indexiert die Begründung nicht.
  - **T-G1-E-01** (Umgehung der Oberfläche): Alle Prüfungen sitzen im Kern; die HTTP-Probe folgt in 044b.
- **Invarianten:**
  - Eine Verweigerung erreicht `approved` nur mit `question.refuse.approve`, Rechtsfreigabe genau dieser Version und drei
    verschiedenen Akteur-ids für Erstellung, Rechtsfreigabe und Freigabe. Eine Antwort erreicht `approved` nie über
    `question.refuse.approve`, eine Verweigerung nie über `question.approve`.
  - Pfad B hat immer einen Katalogeintrag, dessen Hash bei der Freigabe noch gilt. Kein Pfad ist ohne Begründung
    speicherbar. Pfad A hat keinen zugeordneten Grund (benannte Lücke).
  - Die Begründung steht in keinem `EventRead`, in keiner Bühnenansicht, in keiner Schreibantwort an Nichtberechtigte und
    in keinem Suchtext. In `Question.answers` steht sie nur für Halter von `refuse.*`. Der Vermerk der Rechtsfreigabe steht
    in keinem Lesepfad.
  - Der Zielstatus stammt aus der Tabelle; der Reducer übernimmt ihn nur, und nur aus `QUESTION_STATUSES`.
- **Fehler- und Wiederherstellungsfall:**
  - Ein Katalog-Deploy während der HV sperrt die Freigabe offener Pfad-B-Vorschläge (R-GUARD-11). Die Wiederherstellung
    ist ein neuer Vorschlag mit dem aktuellen Eintrag (Test 12, letzter Satz). Das Runbook nennt den Freeze-Kalender.
  - Wiederaufbau aus dem Log ergibt denselben Stand (Test 18).
- **Kapazität (E37, E40):**
  - Eine Verweigerung braucht **drei verschiedene Personen**: Vorschlag, Rechtsfreigabe, Freigabe.
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
2. Die Maskierung ruft `can()` ohne Frage auf und gilt für jede Version und jede Schreibantwort. Prüfen: Test 14 und
   Mutationsprobe 1.
3. Die Begründung steht im gespeicherten Ereignis nur unter `payload.pii`; `MASKED_KEYS` enthält `refusalJustification`;
   `maskEvent` entfernt `note` nur bei `QuestionLegalCleared`; `getStage` maskiert immer.
4. R-GUARD-08 liest `legalClearance.answerVersion` der **letzten** Version; R-GUARD-14 vergleicht
   `legalClearance.clearedBy.id` mit dem Akteur.
5. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (Tor role-literals grün). Kein Status-Literal außerhalb der Tabelle;
   der Reducer übernimmt `toStatus` aus dem Ereignis und prüft gegen `QUESTION_STATUSES`.
6. Keine Testabschwächung: Jede geänderte `_actions`-Erwartung fügt genau `question.refuse.propose` bzw.
   `question.refuse.approve` hinzu; jede geänderte `note`-Erwartung erwartet das Fehlen des Vermerks.

## Standards (auf Standard gebaut)

| Standard | Quelle | Was 044a baut | Kosten einer späteren Änderung |
|---|---|---|---|
| Modell A: Verweigerung als Antwortart, elf Zustände | ADR 0012 (vorgeschlagen, nicht von Recht gelesen) | R-TRANS-15/16, R-GUARD-12/13 | Modell B: 2,5 AStd Kern (Plan) plus rund 0,5 AStd Vertrag |
| Vorschlag führt direkt nach `in_review` | diese Spec (Frage aus 043a) | `toStatus` in `AnswerDrafted`; Kennzahl | Vorschlagende erhalten `question.submit_review` und der Vorschlag endet in `answer_drafted`: 0,5 AStd mit Tabellen-Diff |
| Begründungspflicht für **beide** Pfade, Grundpflicht nur Pfad B | Recherche Z.63, Rechtekonzept §4; Abweichung vom Satz in ADR 0012 | R-GUARD-09 | Pfad A ohne Pflicht: eine Bedingung, < 0,25 AStd |
| Pfad A ohne Grund und ohne Untergründe | Vertrag 0.4.0; **nicht erfüllt** gegenüber Rechtekonzept §4 und Recherche Z.63 | nichts (Lücke benannt) | Untergründe: 044c, rund 0,75 AStd (Vertrag, Katalog, Guard) |
| Katalog: sieben Gründe § 131 Abs. 3, Bedingungen im Titel, alle `verified: false` | E15, Recherche Z.64 | `refusalGrounds.ts` | Datenpflege (076); jede Änderung macht offene Pfad-B-Vorschläge neu vorschlagspflichtig (R-GUARD-11) |
| Propose bei `legal` und `coordination`, Approve bei `approver` | E25, ADR 0012 | `ROLE_PERMISSIONS` | eine Tabellenzeile, 0,5 AStd mit Diff |
| Rechtsfreigabe und Freigabe durch verschiedene Personen (nur Verweigerung) | Lesebefund; Rechtekonzept §4 (Vier-Augen) | R-GUARD-14 | auch für Antworten: eine Guard-Zeile an R-TRANS-05, 0,25 AStd mit Diff (Eigentümerfrage 8) |
| Begründung im `pii`-Teil | ADR 0009; DSFA V7 | `payload.pii.refusalJustification` | Klartext in `answer`: < 0,25 AStd, verliert Crypto-Shredding |
| Leserkreis der Begründung: Halter von `refuse.*`, nie admin, nie Ereignis, Bühne oder Suche | 043a, SG2 | Entscheidung 6 | Leserkreis erweitern: Daten plus Tests, 0,25 AStd |
| Vermerk der Rechtsfreigabe in keinem Lesepfad | Lesebefund (Seitenkanal der Begründung) | `maskEvent` entfernt `note` bei `QuestionLegalCleared` | wieder sichtbar (Risiko hingenommen): < 0,25 AStd; Projektion für Berechtigte: 0,5 AStd |
| Nur Textpfade | diese Spec | R-GUARD-03 an R-TRANS-15 | Podiumsfragen zulassen: 0,5 AStd (Eigentümerfrage 5) |
| Antwortentwurf darf eine Verweigerung verdrängen | ADR 0012 (neueste Version gilt) | R-TRANS-03 unverändert | Guard „kein Entwurf über Verweigerung ohne Rückgabe“: < 0,25 AStd |

## Offene Eigentümerfragen

Keine blockiert die Spec. **Vor dem Bau** brauchen die Fragen 1 (Stand), 2 (Go) und 3b (Go/No-go) eine Antwort. Die übrigen
sind auf Standard gebaut, mit den genannten Kosten.

1. **ADR 0012 und der Katalog an Recht vor dem Bau (offener Punkt Eigentümer/Recht).** Plan §3 (Zeile 215), §4 (Zeile
   249), ADR 0012 und Register E15 verlangen, dass ADR 0012 mit dem Regelregister (Vorabzug nach 011) bei Recht liegt,
   **bevor** 044 baut. Der Stand ist im Repositorium nicht belegt (Register Zeile 139: „beim Eigentümer, Stand unbekannt“).
   - Bitte an den Eigentümer, bis zum Baustart von 044a (Plan: 06.11.2026): (a) den Vorabzug mit ADR 0012, dieser Spec
     (Abschnitte „Ziel“, „Standards“, Fragen 3 und 8) und dem Katalog an Recht geben, falls noch nicht geschehen; (b) den
     Stand melden.
   - **Fragen an Recht in diesem Vorabzug:**
     - Wortlaut, Nummerierung, Bedingungen und Formulierungsbausteine der sieben Katalogeinträge; Vollständigkeit
       (Recherche Z.64).
     - **§ 131 Abs. 3 Satz 2 AktG:** Ist der Katalog abschließend, darf also aus keinem anderen Grund verweigert werden?
       Dann wäre Pfad B nur mit Katalogeintrag richtig modelliert.
     - **§ 131 Abs. 4 AktG:** Wie wirkt eine einem Aktionär außerhalb der HV gegebene Auskunft auf die Verweigerung
       gegenüber einem anderen (Gleichbehandlung)? Braucht der Vorschlag einen Hinweis oder eine Prüfung?
     - **(a) Bedeutung von „Begründung“:** interne Rechtseinschätzung für Freigabe und Nachweis, oder der Grund, der dem
       Aktionär im Saal genannt wird? Standard: interne Einschätzung, nur `refuse.*`; was der Aktionär hört, ist `text`.
     - **Formulierung der Bausteine (Architekten-Stichprobe L3):** Behauptung einer Tatsache oder Verweis auf die Norm,
       besonders bei Nr. 4 und Nr. 5.
     - **Nr. 6 (Architekten-Stichprobe L6):** Die Bedingung „nur Kredit-, Finanzdienstleistungs- und Wertpapierinstitute“
       steht nur im Titel; trägt der Baustein die Institutsbedingung stillschweigend richtig?
     - **(b) Wer verweigert rechtlich:** Ist die Freigabe durch `approver` die Entscheidung des Vorstands über die
       Verweigerung? Wie bei Fragen, die der Aufsichtsratsvorsitzende beantwortet (Bühnenplatz AR)?
   - Ohne Antwort von Recht baut 044a **auf Standard**. Der Vermerk „auf Standard gebaut (ADR 0012 vorgeschlagen, von Recht
     nicht gelesen)“ steht dann an vier Stellen: in der `citation` der acht neuen Regeln (also in `docs/legal-trace.md`),
     im Kopfvermerk des Rechtekonzepts, im Register (E15) und im Bericht.
   - Die Annahme des ADR bleibt Prüfpunkt 4 (Umsetzer und Recht). Ein späterer Wechsel kostet die Beträge aus „Standards“.
2. **Zuschnitt 044a/044b, Budget, Lanes, Export (Go nötig).** Standard: zwei Teile, 3,25 + 1 = 4,25 AStd statt 2,5, beide
   hoch, seriell, ein PR je Spec. Mit Go ändert der Orchestrator:
   - Plan-Eintrag 044: Teilungsvermerk; Lanes core, web-api, web-shell, service, contract, docs-legal, docs-sicherheit,
     docs-datenschutz; **„Export markiert Verweigerungen“ wird gestrichen** und nach 051 verschoben (im Code gibt es noch
     keinen Export);
   - Plan-Eintrag 051: Ziel ergänzt um „Verweigerungen mit Antwortart, Grund-id und Titel aus dem Schnappschuss markieren,
     nie die Begründung (§ 131 Abs. 5, nur Pfad B)“, Nachweis „Test Export markiert Verweigerung Pfad A und B, Begründung
     fehlt“, Aufwand +0,25 AStd (1,5 → 1,75);
   - den Kalender: 045 rückt um etwa einen bis zwei Bautage.

   Ohne Go: eine Scheibe 044 mit beiden Dateilisten und einem Review (Abschnitt „Teilung und Zuschnitt“).
3. **Pfad A (Recht, E15).**
   - **3a. Begründungspflicht.** Standard: Pflicht auch für Pfad A (Recherche Z.63, Rechtekonzept §4). Das weicht vom Satz
     in ADR 0012 ab. Alternative: Pflicht nur für Pfad B, < 0,25 AStd.
   - **3b. Grund und Untergründe für Pfad A (Go/No-go vor dem Bau).** Pfad A ohne zugeordneten Grund erfüllt
     Rechtekonzept §4 („Keine Verweigerung ohne zugeordneten Grund“) und Recherche Z.63 („mit Untergründen“) nicht.
     - **Go (Standard):** 044a baut wie beschrieben, die Lücke steht als „nicht erfüllt“ in der `citation` von R-GUARD-09,
       im Rechtekonzept-Vermerk und in DSFA V7. Die Untergründe kommen mit **044c** (additiver Vertragsschritt: die
       `if`/`then`-Bedingung in `RefusalProposal` und `AnswerVersion` fällt; Katalog mit Pfadangabe; R-GUARD-09 verlangt
       den Grund auch für Pfad A), rund 0,75 AStd, nach der Antwort von Recht und vor dem Pilot.
     - **No-go:** 044a wartet, bis Recht die Untergründe benennt; dann werden 044a und 044c zusammen gebaut (+0,75 AStd in
       044a, plus Vertragsschritt durch den Architekten als ersten Commit).
4. **Vermerk der Rechtsfreigabe (Recht, E25; Security).** Standard (sicher): `note` ist für alle Rechtsfreigaben in keinem
   Lesepfad sichtbar.
   - Alternative a: wie bisher für alle Halter von `history.read` sichtbar. **Hingenommenes Risiko:** Der Vermerk kann die
     Begründung einer Verweigerung an Leser ohne `refuse.*` tragen. < 0,25 AStd.
   - Alternative b: Vermerk über die Projektion der Frage nur an Halter von `refuse.*` bzw. `question.legal.clear`, rund
     0,5 AStd mit Vertragsbeschreibung.
   - Der Leserkreis der Begründung selbst bleibt Standard aus 043a (Frage 3 dort).
   - **Offener Unterpunkt (Review, 03.10.2026):** Auch ein Rückgabegrund (`QuestionReturned.reason`, `returnReason`) an einer
     Verweigerung kann die Begründung zitieren; er ist für alle Leser der Frage und der Historie sichtbar (bestehend, SG2).
     Standard: keine Codeänderung, Warnhinweis im Rückgabedialog (045); ob er maskiert werden soll, entscheidet der
     Eigentümer mit Recht.
5. **Verweigerung auf Podiumsfragen.** Standard: nicht zulässig; vorher auf einen Textpfad umklassifizieren. Alternative:
   eigene Zeile aus `classified` für `podium` mit versionsgebundener Rechtsfreigabe, rund 0,5 AStd mit Tabellen-Diff.
   Recht und Projektleitung.
6. **Antwortentwurf über einer vorgeschlagenen Verweigerung.** Standard: erlaubt (neueste Version gilt; erneute
   Rechtsfreigabe nötig). Alternative: Guard „erst Rückgabe“, < 0,25 AStd.
7. **Katalog im Konfigurationsfreeze (040d).** Standard: nein; die Build-Kennung im Schnappschuss zeigt einen Deploy, und
   der Freeze-Kalender verbietet Katalogänderungen während der HV. Alternative: Katalog-Digest im Schnappschuss, rund
   0,25 AStd in 040d. Eigentümer mit Betrieb.
8. **Trennung von Rechtsfreigabe und Freigabe auch für Antworten.** Standard: R-GUARD-14 nur an R-TRANS-16
   (Verweigerung). Alternative: derselbe Guard an R-TRANS-05, 0,25 AStd mit Tabellen-Diff; schließt denselben Weg für
   Antworten. Eigentümer mit Recht (E25).
9. **DSB (E14).** Ist die Begründung personenbezogen, insbesondere bei Pfad A? Umfang der Betroffenenauskunft,
   Rechtsgrundlage, Aufbewahrung. Standard: als personenbezogen behandelt (`pii`-Teil, enger Leserkreis, `record`).
   Dazu die benannte Lücke: Antwortversionen, Antwortfreigaben und Rechtsfreigaben werden heute als `working` gespeichert,
   die DSFA nennt für V5 und V6 `record`. Standard: 044a ändert nur die Verweigerungsereignisse; die übrigen folgen mit
   einer Aufbewahrungsklasse je Ereignistyp in einem Takt core vor dem Pilot. Alternative: in 044a mit erledigen, rund
   0,25 AStd (dann mit Fixture-Änderungen).

## Hinweise an Folgescheiben

**044b** (Spec nach Go zu Frage 2):
- Die drei Routen in `apps/api/src/app.ts` nach dem Muster von `draftAnswer`/`approveQuestion` montieren, mit
  `guarded('<operationId>')`.
- Die drei Allowlist-Einträge mit `slice` 044 im selben Commit entfernen. Das Abdeckungstor verlangt dann die Ausübung.
- Die Vertragsbeschreibungen kommen mit 044a; 044b prüft sie über HTTP (Maskierung von `note` und `pii`, 409/422).
- HTTP-Tests:
  - 401, 403 R-PERM-01, 404, 409 (R-GUARD-04/-06/-08/-09/-11/-12/-13/-14, R-TRANS-00), 412, 422 (Validator und Kern);
  - Idempotenz und `If-Match`;
  - Maskierung auf allen sieben Lesepfaden und in Schreibantworten, einschließlich der `event`-Nachricht von `/stream`
    als admin; `note` fehlt;
  - `draftAnswer` mit `answerKind` im Body erzeugt keine Verweigerung.
- Postgres-Lauf: Vorschlag, Rechtsfreigabe und Freigabe überstehen einen Neustart mit Kettenprüfung; die Begründung liegt
  in der Spalte `payload` unter `pii`.
- Zugriffslog: abgewiesene Versuche mit Regel-id, ohne Nutzdaten.
- Prüfen, ob die Kennzahlen-Allowlist (033b) Einträge je Operation führt.
- Termin: vor dem 27.11.2026 gemergt.

**044c** (nur bei Go zu Frage 3b, nach der Antwort von Recht): Untergründe für Pfad A, additiver Vertragsschritt, Katalog mit
Pfadangabe, Grundpflicht für Pfad A in R-GUARD-09, DSFA V7 und Rechtekonzept-Vermerk auf „erfüllt“.

**045:**
- Der Dialog füllt `text` aus `stageText` vor und zeigt die Bedingung aus `title` sichtbar an.
- „Ungeprüft“ leitet sich aus `legalRef.verified` ab.
- Ein Hinweis „Grund im Katalog geändert, bitte neu vorschlagen“ erscheint, wenn `approver` die Freigabe in `_actions`
  fehlt und der Hash der Version nicht dem aktuellen Katalogeintrag entspricht.
- Dialoghilfe: „nur, was für die Entscheidung nötig ist; keine Namen Dritter“.
- Die Planzeile 045 verlangt „Pfad B ohne Grund → Aktion fehlt in `_actions`“. Das lässt sich nicht so bauen:
  `_actions` gilt je Frage, nicht je Pfad. R-GUARD-09 ist ohne Nutzlast immer erfüllbar. Den Fall prüft der Kern beim
  Absenden (409). 045 testet stattdessen: Absenden ohne Grund → Meldung mit R-GUARD-09, und die Absende-Schaltfläche ist
  ohne Grund gesperrt. Die Meldungen unterscheiden 422 (Eingabe) und 409 (R-GUARD-09).
- Historie: Antwortart am Ereignis `AnswerDrafted` sichtbar machen („Verweigerung vorgeschlagen“ statt „Antwortentwurf“);
  das Fehlen des Vermerks der Rechtsfreigabe ist gewollt.
- Glossarzeile „Verweigerungsgrund“.
- Rückgabedialog (Review, SG2): Hinweis „keine Begründung in den Rückgabegrund“, weil der Rückgabegrund für alle Leser der
  Frage sichtbar ist (Eigentümerfrage 4, offener Unterpunkt).
- Vorbefüllen aus `stageText` (Architekten-Stichprobe L3) nur mit einem sichtbaren Vermerk „Formulierungsbaustein,
  ungeprüft (E15)“ neben dem Textfeld; der Vermerk gelangt nie in `text`.

**043c:** Das gebundene Nutzlastschema von `AnswerDrafted` nimmt `toStatus` und `refusalGround` auf; `pii` wie bei
`SpeakerRegistered`; nie `refusalJustification` außerhalb von `pii`.

**046:** Prüfen, ob die Zeilen für `correctionOpen` und Rückgabe einen Vorschlag als neue Version zulassen. Regel-ids ab
R-TRANS-17 (R-TRANS-15/16 vergibt diese Spec), Guards ab R-GUARD-15.

**051 (Niederschrift-Anlage, § 131 Abs. 5 AktG; übernimmt „Export markiert Verweigerungen“ aus Plan 044, Eigentümerfrage 2):** Nur Pfad B löst den Protokollierungsweg aus (Recherche Z.63). In die
Anlage gehören bei einer Verweigerung nach Pfad B: Frage, `refusalGroundId` und `title` des Schnappschusses, Zeitpunkt des
Vorlesens. **Nie** die Begründung (043d, Standard nein). Ob ein Protokollierungsverlangen des Aktionärs (050) Voraussetzung
ist, klärt 051 mit Perspektive Legal. Für Pfad A trägt die Anlage nur die Antwortart.

**053 und 087:** Zähldefinition für Verweigerungen je Pfad, aggregiert, nie je Person.

**059:** Prüfliste je Pfad; R-GUARD-10 an `clearQuestionLegally`. Die Prüfliste einer Verweigerung prüft, ob die
Begründung zum Grund passt und ob die Bedingung im Titel erfüllt ist.

**062 (Rollenkarte):** Kapazitätshinweis aus „Wirkung und Risiko“ (drei Personen je Verweigerung).

**069:** Der Plan nennt R-TRANS-17 für „unmerge“ (Zeile 867). Die Folgespec vergibt die nächste freie Nummer.

**070 (Runbook):** Freeze-Kalender: kein Katalog-Deploy zwischen Freeze und Debattenschluss; Wiederherstellung durch neuen
Vorschlag.

**073 (Codec):** `payload.pii.refusalJustification` gehört zu den Feldern, die der echte Codec verschlüsselt. Der Reducer
(`state.ts`, Fall `AnswerDrafted`) liest die Begründung heute ohne Decodierung; mit einem echten Codec muss er
`pii.refusalJustification` decodieren, und Projektion und Wiederholung (`replayValue` in `api.ts`, historische Antwort)
müssen einen geschredderten Schlüssel beachten (Begründung fehlt, kein Fehler, keine Rekonstruktion aus anderen Feldern).

**076:** Katalogeinträge prüfen und auf `verified: true` setzen. Jede Änderung eines Eintrags ändert seinen Hash (R-GUARD-11)
und den Inline-Snapshot aus Test 1.

**Folgenotizen (Doku, kein Sicherheits-, Datenschutz- oder Rechtspunkt):** Nach dem Merge veraltet sind
`docs/adr/0012-zustandsmodell-und-verweigerung.md:53` (R-TRANS-14..16 für Kennzeichen), `docs/produktplan-beta.md:198, 674,
686, 1083` und Eintrag 069 (alte Regel-ids) sowie der Kommentar `packages/domain/src/rules.ts:24-26` („No rule in this
slice cites 'AktG' … (044)“). Ein Doku-Takt gleicht sie an.

## Bericht (nach Bau ausfüllen)

```
Slice: 044a-verweigerung-kern
Done: Katalog (sieben Gründe, Hash, tief eingefroren), zwei Rechte und Leserkreis als Daten, R-TRANS-15/16 mit
      R-GUARD-08/09/11/12/13/14 (R-GUARD-12 auch an R-TRANS-04/05), proposeRefusal/approveRefusal/listRefusalGrounds in
      Kern, HTTP-Client und Live-Puffer; Begründung nur in payload.pii, maskiert in Projektion, Bühne, Ereignis-Lesepfad,
      Suche; Vermerk der Rechtsfreigabe maskiert; Kennzahl der Rechtsprüfung; retentionClass record. Auf Standard gebaut.
Evidence: pnpm gates grün auf e278899 (Schluss unten, mit Postgres-Variablen, 0 übersprungen); Tests 1–19, 21–28 grün
      (Test 20 entfällt, 040d nicht gemergt); 18 Mutationsproben rot belegt (unten); kein Screenshot (keine Ansicht ändert sich).
Open: Test 20 an 040d; HTTP-Montage, Allowlist und HTTP-Proben an 044b (vor 27.11.2026); Pfad A ohne Grund und Untergründe
      (nicht erfüllt, 044c); Aufbewahrungsklasse der übrigen Antwortereignisse und der Rechtsfreigabe (Eigentümerfrage 9).
Touched: packages/domain/src/{refusalGrounds.ts (neu), types.ts, permissions.ts, transitions.ts, events.ts, state.ts,
      indicators.ts, api.ts, stream.ts, index.ts}; packages/domain/src/__tests__/{refusal044a.test.ts (neu),
      transitions.test.ts, indicators033b.test.ts, api.test.ts}; packages/domain/policy-truth-table.md; docs/legal-trace.md;
      apps/web/src/api/{http.ts, http.test.ts, liveStore.ts}; apps/web/src/i18n/{labels.ts, shell.de.ts, shell.en.ts,
      parity.test.ts}; docs/rollen-und-rechtekonzept.md; docs/sicherheit/bedrohungsmodell.md;
      docs/datenschutz/dsfa-vorentwurf.md; dieser Bericht
```

**Abweichungen vom Wortlaut der Spec (Bau, 03.10.2026):**
1. **R-GUARD-14 ist ohne Rechtsfreigabe erfüllt** (`legalClearance === undefined || clearedBy.id !== actor.id`), statt
   „`legalClearance !== undefined` und …“. Grund: Mit der wörtlichen Definition und der Reihenfolge der Tabelle
   (R-GUARD-14 vor R-GUARD-08) antwortete Test 9 mit R-GUARD-14 statt R-GUARD-08, und Mutationsprobe 4 machte den
   Abschnitt „Role × Verweigerung“ nicht rot (R-GUARD-14 hätte die Zeile „in_review, offen“ weiter gesperrt). Die
   Konjunktion an R-TRANS-16 ist unverändert: R-GUARD-08 verlangt die Rechtsfreigabe in derselben Zeile; Reihenfolge wie
   in der Spec. Die `citation` von R-GUARD-14 nennt das.
2. **Test 7, `podium`:** `proposeRefusal` als `podium` antwortet **404**, nicht 403. `podium` hält weder `question.read`
   noch `question.refuse.propose`; Festlegung 3 (Scheibe 010, `requireQuestionFor`) meldet dann 404. Bestehendes
   Verhalten, nicht geändert; der Test prüft 404.
3. **`approveRefusal`** prüft zusätzlich `answerVersion` als positive ganze Zahl (422), weil R-GUARD-04 ohne Version die
   Fähigkeitsfrage bejaht und die Demo nicht gegen den Vertrag prüft. Innerhalb „ihre Umsetzung“.
4. **Test 14, `subscribe` als `legal`:** `legal` hält kein `event.read` und erhält nur Änderungssignale ohne Ereignis;
   das prüft der Test, und zusätzlich einen Abonnenten mit `event.read` (admin) auf maskierte Ereignisse. Abonnenten
   laufen als eigene Instanz mit festem Leser, weil `subscribe` den umgeschalteten Demo-Akteur je Zustellung liest.
5. **Tiefe Kopie** über `copyRefusalGrounds()` (Eintrag und `legalRef` kopiert) statt `structuredClone`; gleiche Wirkung
   für die Eintragsform, belegt durch Test 19 und Mutationsprobe 17. `index.ts` exportiert das Modul
   (`REFUSAL_GROUNDS`, Typen, `refusalGroundHash`, `copyRefusalGrounds`).
6. **`refusalGroundId: ''`** auf Pfad B ist 422 (nicht im Katalog), nicht R-GUARD-09; der Vertrag kennt kein `minLength`.
7. **Zeilenverweise:** Der Kopfvermerk verschiebt `docs/rollen-und-rechtekonzept.md` um zwei Zeilen; die neuen
   `citation`s nennen die neuen Zeilen (60, 61, 123, 168-169, 173, 175). Bestehende `citation`s anderer Regeln
   (R-GUARD-04/06, R-TRANS-03/05/13: :109, :156, :163) waren schon vorher verschoben und bleiben unverändert (außerhalb
   des Umfangs; Hinweis an den Orchestrator).

**Missbrauchsfälle, Kapazität:** wie in der Spec; drei verschiedene Akteur-ids je Verweigerung (Test 10), mit nur einer
Juristin blockiert der Weg „`legal` schlägt selbst vor“ (R-GUARD-06), der Weg über die Koordination nicht.

**Stand Eigentümerfragen 1, 2 und 3b:** Go zu 1, 2 und 3b am 03.10.2026, auf Standard gebaut. Zu 1: ADR 0012 und
Katalog sind von Recht nicht gelesen; der Vermerk „auf Standard gebaut (ADR 0012 vorgeschlagen, von Recht nicht
gelesen)“ gilt. Zu 2: Zuschnitt 044a/044b. Zu 3b: Go (Standard), Pfad A ohne Grund und Untergründe, Lücke benannt,
Zielscheibe 044c.

**Vor-dem-Bau-Ergebnisse (Architekt)** (03.10.2026, auf Basis `6146251`, nach 043a #125 und 040b #130):
1. **043a gemergt (`88fa9be`).** Vertrag hat `AnswerKind`, die vier Felder an `AnswerVersion`, `RefusalGround` mit
   `hash`, `RefusalProposal` (ohne `answer`, `additionalProperties: false`), die drei Operationen, `Action` mit beiden
   Rechten; `allowlist.json` führt `listRefusalGrounds`, `proposeRefusal`, `approveRefusal` mit `slice` 044 und
   `expires` 2026-11-27 (neben `createMeeting`/`freezeMeetingConfig` für 040; fünf Einträge). Keine Formabweichung.
   **Vertragsstand vor diesem Schritt: 0.4.1 (040b), nicht 0.4.0.** Der Vertragsschritt nimmt deshalb **0.4.2**.
2. **040b gemergt, 040c/040d nicht** (zurückgestellt). admin hält **14** Rechte (040a plus `admin.units.manage`,
   `admin.seats.manage`), keines davon `question.refuse.*`; `admin040a.test.ts` Test 1/2 rechnet mit
   `PERMISSIONS.length - 14` und bleibt ohne Änderung gültig. Wahrheitstabelle Abschnitt 1: weiterhin **198 Zeilen**,
   dieselben 16 Aktionsspalten; die drei Beispielzeilen des Diffs stimmen wörtlich (Zeilen 55, 105, 127). 040b hat
   einen Abschnitt „Role × Administration“ angefügt (fest `admin.units.manage`, `admin.seats.manage`); er bleibt
   unverändert, ebenso wie die vier anderen Zusatzabschnitte. `Classification.seatId`, `Meeting.counts.byUnit/bySeat`
   und R-ADM-01/02 berühren weder Files allowed noch einen Test dieser Spec.
3. **Regel-ids frei.** In Code und Vertrag belegt: R-TRANS-00..14, R-GUARD-01..07. Keine Spec nach `c000567`
   (037a, 040b, 064a, 064b, 065a, takt-041) vergibt R-TRANS-15/16 oder R-GUARD-12..14. Es bleibt bei der Spec.
4. **046 nicht gemergt** (keine Spec im Repositorium). Kein Zusammenspiel zu prüfen.
5. **Eigentümerfragen:** siehe oben (Go 03.10.2026).
6. **Live-Puffer:** `READ_TOPICS` ist `satisfies Record<BufferedRead, …>`, `BufferedRead` umfasst jede `get…`/`list…`-
   Methode von `HvApi` außer `listEvents`. `listRefusalGrounds` **muss** dort stehen (sonst Typfehler); Test (p)
   (`liveStore.test.ts:661`) leitet die Liste aus `Object.keys(createInProcessApi(…))` ab und verlangt keine
   Änderung an der Testdatei. Leere Themenliste `[]` ist typgültig (Katalog ist Code-Datum, keine Invalidierung).
   `proposeRefusal`/`approveRefusal` erzwingt `WRITE_METHODS` ebenfalls per Typ.
7. **`_actions`- und `note`-Erwartungen:** genaue `_actions`-Listen stehen nur in `api.test.ts:119`, `:262`,
   `acceptance.test.ts:192` (alle leer oder `observer`, ändern sich nicht) und `idempotency028.test.ts:124`
   (vergleicht mit `getQuestion`, ändert sich nicht). **Ändern muss sich** die genaue Rechteliste
   `api.test.ts:671-674` („coordination holds exactly …“: + `question.refuse.propose`). `note` in Ereignissen:
   `security028.test.ts:84` (prüft nur Namen und `personId`, nicht `note`; bleibt grün), `legal-clearance.test.ts:37`
   und `limits034a.test.ts:266` (HTTP-Eingaben, nicht Lesepfad). Kein Test erwartet heute `note` in einem `EventRead`.
8. **`canonicalJson`** (`envelope.ts:73-90`): `null` → `null`, Zeichenketten über `JSON.stringify`, Schlüssel nach
   Code-Einheiten sortiert, `undefined`-Schlüssel entfallen; für den Wertebereich des Katalogs = RFC 8785. `digest`
   ist nicht exportiert; `refusalGrounds.ts` rechnet SHA-256 selbst über `@noble/hashes` (wie `envelope.ts:1`),
   ohne `envelope.ts` zu ändern.
9. **040d nicht gemergt:** Test 20 entfällt; Übergang an 040d (dessen Schnappschuss enthält dann R-TRANS-15/16).
10. **`pii` im Reducer** weiter ohne Decodierung (`state.ts:235`, `p.pii?.displayName`); nur `identityPiiCodec`
    (`store.ts:26`, `envelope.ts:113`). Kein echter Codec.
11. **Kennzahlentest:** `packages/domain/src/__tests__/indicators033b.test.ts` (passt auf das Muster
    `indicators*.test.ts` der Files allowed).

**Zeilenverweise, Stand `6146251`** (Befund und Entscheidungen nennen die Zeilen von `c000567`): `types.ts`
`PERMISSIONS` 33-67 (`question.legal.clear` 54), `READ_PERMISSIONS` 80-90, `AnswerVersion` 258-264, veralteter
Kommentar 329 (statt 304); `permissions.ts` admin 78-93 (statt 78-91), `expert` 60, `legal` 61; `transitions.ts`
R-GUARD-06 137-163 (Prüfung 158-162), `LEGAL_GATE_BY_TRACK` 46; `state.ts` `SpeakerRegistered`/`pii` 229-238 (statt 186),
`AnswerDrafted` 414-424 (statt 357-367), `QuestionReturned` 451-463 (statt 394-406); `indicators.ts` 61-68;
`api.ts` `viewQuestion` 414-425 (statt 399-410), historische Antwort 589-594 (statt 566-574), Idempotenz je Akteur
630 (statt 599), `append` 664-680 (statt 642-646; `...e` übernimmt `retentionClass` aus `build`), `questionMatches`
753-770 (statt 721-737), `SpeakerRegistered` mit `keyId` 1050 (statt 886), veralteter Kommentar 1089 (statt 925),
`draftAnswer` 1314-1330 (statt 1139-1155), `getStage` 1425-1438 (statt 1250-1264); `stream.ts` `MASKED_KEYS` 176
(statt 169), `maskEvent` 187-196, Sonderfall `IdempotencyRecorded` 194 (statt 187); `events.ts`
`QuestionLegalCleared.note` 105 (statt 98); `envelope.ts` `canonicalJson` 73-96, `piiPayload` 97-104, Standard
`working` 147 (statt 146); `rules.ts` `ruleRegister` 468-476 (statt 435-443), `LegalRef` 36-45 und Kommentar 24-26
unverändert; `labels.ts` `ACTION_KEYS` 52 unverändert; `QuestionDetail.tsx` (`apps/web/src/features/answers/`)
`_actions` ab 246.

**Hinweise des Architekten an den Bau:**
- Der Vertragsschritt (erster Commit) hebt `info.version` auf 0.4.2 und zieht, wie 040b in `58f3600`, die zwei
  festen Versionszeilen `apps/api/src/__tests__/contract.test.ts:90` und `takt-019-contract.test.ts:8` nach (Files
  allowed: „dazu die Versionszeilen der Vertragstests“), damit der Commit grün bleibt.
- Akzeptanzkriterium 4 („`packages/contract/**` ist unverändert“) gilt für die Commits **nach** dem Vertragsschritt;
  der Vertragscommit selbst ändert `openapi.yaml`, `CHANGELOG.md`, `package.json` und `src/types.ts` (Files allowed,
  Abschnitt „Vertragsschritt“). Keine Scope-Änderung.
- `parity.test.ts` zählt heute 522 Schlüssel je Sprache; mit den zwei Aktionsschlüsseln 524.

**Wahrheitstabellen-Diff (wörtlich).** Abschnitt 1: 198 Zeilen, zwei Spalten nach `q.legal.clear`; `q.refuse.propose`
✓ in genau 10 Zellen (`coordination` und `legal` × `classified`, `assigned`, `answer_drafted`, `in_review`, `approved`,
nur Textpfad), `q.refuse.approve` in keiner Zeile; keine bestehende Zelle geändert (maschinell verglichen); die übrigen
fünf Zusatzabschnitte unverändert. Die drei Beispielzeilen der Spec, wörtlich aus `git diff`:

```
-| coordination | classified | · | · | ✓ | ✓ | · | · | · | · | · | · | · | · | · | · | ✓ | · |
-| legal | in_review | · | ✓ | · | · | ✓ | · | · | ✓ | ✓ | · | · | · | · | · | ✓ | · |
-| approver | in_review | · | · | · | · | · | · | ✓ | · | ✓ | · | · | · | · | · | ✓ | · |
+| coordination | classified | · | · | ✓ | ✓ | · | · | · | · | ✓ | · | · | · | · | · | · | · | ✓ | · |
+| legal | in_review | · | ✓ | · | · | ✓ | · | · | ✓ | ✓ | · | ✓ | · | · | · | · | · | ✓ | · |
+| approver | in_review | · | · | · | · | · | · | ✓ | · | · | · | ✓ | · | · | · | · | · | ✓ | · |
```

Neuer Abschnitt „Role × Verweigerung“: 27 Zeilen, Zelle für Zelle gleich der Tabelle der Spec (✓ nur: `coordination`
propose in allen drei Fällen; `expert` answer.draft in allen drei; `legal` propose in allen drei, legal.clear in beiden
`in_review`-Fällen, answer.draft in allen drei; `approver` refuse.approve nur „in_review, frei“).

**Regelregister (Auszug `docs/legal-trace.md`).** Acht neue Zeilen, alle `geprüft: nein`, jede `citation` endet mit
„Auf Standard gebaut (ADR 0012 vorgeschlagen, von Recht nicht gelesen).“:

| Regel-ID | Art | Quelle | Fundstelle (Anfang) |
|---|---|---|---|
| R-GUARD-08 | Guard | Recherche | docs/anforderungen-recherche.md:63 („Beide brauchen Begründung und Freigabe“); unabhängig von LEGAL_GATE_BY_TRACK |
| R-GUARD-09 | Guard | Rechtekonzept | docs/rollen-und-rechtekonzept.md:173 und Recherche :63-64; „Nicht erfüllt gegenüber Rechtekonzept §4 (Zeile 173) und Recherche Z.63: Pfad A trägt keinen zugeordneten Grund und keine Untergründe (Vertrag 0.4.0; Eigentümerfrage 3b, Zielscheibe 044c)“ |
| R-GUARD-11 | Guard | Recherche | docs/anforderungen-recherche.md:64 (Beweislast); Hash der Version = Hash des aktuellen Eintrags |
| R-GUARD-12 | Guard | Recherche | docs/anforderungen-recherche.md:24 (zwei Rechtsfolgen); ohne Version falsch |
| R-GUARD-13 | Guard | Recherche | docs/anforderungen-recherche.md:24; ohne Version falsch |
| R-GUARD-14 | Guard | Rechtekonzept | docs/rollen-und-rechtekonzept.md:168-169 und :123; Restrisiko zwei Subjects, Eigentümerfrage 8 |
| R-TRANS-15 | Übergang | Recherche | docs/anforderungen-recherche.md:63 und :24; Recht aus Rechtekonzept :60; direkt nach `in_review` |
| R-TRANS-16 | Übergang | Rechtekonzept | docs/rollen-und-rechtekonzept.md:123 und :61; kein eigener Zustand `refused` (Modell A) |

**Katalog-Hashes (Test 1).** `aktg-131-3-nr1` zusätzlich gegen eine von Hand geschriebene RFC-8785-Zeichenkette geprüft.

```
aktg-131-3-nr1  4095dbd79a9411f5bdd3b843a8270d85d5f15995750ac439bceaea657bab7bf1
aktg-131-3-nr2  801e8e0a3efce151cccf7420b04266bce98c82eecec4fca341bc550de3059fc0
aktg-131-3-nr3  8b8942bbb57949548a6844e8bbfded1f5742aab04d3f794f4777fac9389eee70
aktg-131-3-nr4  057df1cc86690f588d3479bf50fb956994fa76940a38ea72ef222c080c3515d9
aktg-131-3-nr5  94a4578749dd45a3bcc7cab51441eb4324a6781187e155f3306fdebf97a64608
aktg-131-3-nr6  7297fa2a8f1522cfa81f492bde7598ec9ce1807335e44892480e9914360f9a2c
aktg-131-3-nr7  6983fe609856e5872d6e3f085a4dcdd1b139fc30f2f7c8486acaae216f9f41b1
```

**Gespeichertes Ereignis und `EventRead` einer Verweigerung (Auszug).** Synthetischer Lauf (Seed, Pfad B, `legal`);
Titel, Baustein und Zitat gekürzt, Umschlagfelder ausgelassen. Gespeichert:

```
"payload": {
  "answer": { "version": 1, "text": "Zu dieser Frage gibt der Vorstand keine Auskunft.",
    "createdBy": { "id": "legal", "role": "legal" }, "answerKind": "refusal_with_ground",
    "refusalGroundId": "aktg-131-3-nr1",
    "refusalGroundHash": "4095dbd79a9411f5bdd3b843a8270d85d5f15995750ac439bceaea657bab7bf1",
    "refusalGround": { "title": "Nach vernünftiger kaufmännisch…", "stageText": "Zu dieser Frage gibt der Vorst…",
      "legalRef": { "source": "AktG", "citation": "§ 131 Abs. 3 Satz 1 Nr. 1 AktG. Gliederu…", "docVersion": null,
        "docHash": null, "verified": false } } },
  "pii": { "keyId": "hv-2027", "refusalJustification": "Synthetische Begründung." },
  "toStatus": "in_review" },
"retentionClass": "record", "legalHold": false
```

Dasselbe Ereignis als `EventRead` (`maskEvent`): `payload.answer` unverändert mit Schnappschuss, `toStatus: "in_review"`,
**kein `pii`**, keine `refusalJustification`; `"redacted": true`, `sourceHash` gesetzt.

**Mutationsproben (Ergebnis).** Jede Probe einzeln eingesetzt, Testdateien laufen gelassen, danach zurückgesetzt
(Diffstat vorher und nachher gleich). „rot“ nennt die rot gewordenen Tests.
1. `can(actor(), p, q)` in `viewQuestion` → rot: Test 14 „getQuestion … (approver also without clearance)“.
2. Begründung in `answer` statt `pii`, aus `MASKED_KEYS` entfernt → rot: Test 3 (Pfad B, Ereignis) und Test 14 (Ereignis-Lesepfade).
3. Begründung im Suchtext → rot: Test 15.
4. R-GUARD-08 aus R-TRANS-16 → rot: Test 9 (zwei Fälle), Wahrheitstabelle (Abschnitt „Role × Verweigerung“), dazu
   Test 14/17 (`_actions` des approver ohne Rechtsfreigabe) und „GUARD_SCENARIOS has no stale entry“.
5. R-GUARD-12 aus R-TRANS-05 → rot: Test 11 (R-GUARD-12), Wahrheitstabelle, Test 17, Regeltest R-TRANS-16.
6. R-GUARD-11 immer wahr → rot: Test 12 (beide Fälle). Hash ohne Sortierung (`JSON.stringify`) → rot: Test 1 (Hash,
   Inline-Snapshot) und Test 3 (Nachrechnung).
7. `question.refuse.propose` an admin → rot: Test 2, Test 17 (admin), Wahrheitstabelle Abschnitt 1, dazu Test 7 und Test 14
   (admin liest dann die Begründung).
8. R-GUARD-09 ohne `trim()` → rot: Test 5 (leere Begründung `"   "`).
9. `getStage` ohne Maskierung → rot: Test 14 (Bühne).
10. Reducer ignoriert `toStatus` → rot: Test 3 und 29 weitere (Kette, Freigaben); Reducer übernimmt jeden Wert → rot: Test 18 (`bogus`).
11. Begründungspflicht für Pfad A entfernt → rot: Test 5 (letzter Fall).
12. R-GUARD-06 aus R-TRANS-16 → rot: Test 10 (zweiter Fall).
13. R-GUARD-13 aus R-TRANS-16 → rot: Test 11 (zweiter Fall).
14. R-GUARD-14 aus R-TRANS-16 → rot: Test 10 (R-GUARD-14, Entzug und Ablauf).
15. Entfernen von `note` gestrichen → rot: Test 24; `note` in `MASKED_KEYS` → rot: Test 24 (Gegenprobe).
16. `inReviewSince` bei `AnswerDrafted` nicht gesetzt → rot: Test 26.
17. Nur flach eingefroren → rot: Test 1 (eingefroren); flach kopiert → rot: Test 19.
18. `retentionClass` in `proposeRefusal` weggelassen → rot: Test 28; in `approveRefusal` weggelassen → rot: Test 28.

**Geänderte `_actions`- und `note`-Erwartungen.** Nur `packages/domain/src/__tests__/api.test.ts` › „coordination holds
exactly classify, assign and the four read grants of the spec“: + `question.refuse.propose`. Keine andere `_actions`-Liste
und keine `note`-Erwartung musste sich ändern (wie im Vor-dem-Bau-Punkt 7 vorhergesagt). Weitere bestehende Tests:
`transitions.test.ts` (Regeltest-Fixture für R-TRANS-16, Szenarien, neuer Abschnitt), `indicators033b.test.ts` (Test 26),
`parity.test.ts` (522 → 524), `http.test.ts` (drei Methoden, Schreibkopfzeilen).

**Rot vor Grün:** erster Lauf ohne Umsetzung: `refusal044a`/`transitions` rot (Modul fehlt), Test 26 (0 statt 1),
Koordinationsliste; nach Katalog und Rechten 66 Tests rot (Verhalten); `http.test.ts` 5 rot; danach grün.

**`pnpm gates` (Schluss, Commit):** gelaufen auf `e278899` mit `TEST_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`,
`HV_DB_RUNTIME_ROLE` (lokales Postgres 16), Exit 0. Auszug der Zusammenfassungen:

```
packages/domain test:  Test Files  19 passed (19)
packages/domain test:       Tests  380 passed (380)
apps/web test:  Test Files  24 passed (24)
apps/web test:       Tests  493 passed (493)
apps/api test:  Test Files  42 passed (42)
apps/api test:       Tests  621 passed (621)
vocabulary-check: ok
slice-scope: 33 changed file(s), all within "docs/slices/044a-verweigerung-kern.md"'s "Files allowed" list (71 pattern(s)).
metrics-allowlist: 6 metrics, all within the allowlist.
plan-graph: ok.
# tests 275
# pass 275
# fail 0
```

Schluss, wörtlich:

```
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.48s
mark-test-run: wrote /home/user/wt/s044a/.claude/state/last-test-run (clean tree) at commit e278899, tree 54800815c633…
```

## Review findings

**Lesebefund der Spec (01.10.2026, zu `0dcbe39`):** 0 blocker, 9 major, Minor. Eingearbeitet in dieser Fassung:
- Major 1 (Betrieb): `indicators.ts` setzt `inReviewSince` bei `AnswerDrafted` mit `toStatus: 'in_review'`; Test 26,
  Mutationsprobe 16.
- Major 2 (Legal/Security): R-GUARD-14 (Freigebende ≠ rechtlich Freigebende) an R-TRANS-16; Test 10, Mutationsprobe 14;
  Restrisiko „zwei Subjects“ neben MF-01; Antworten als Eigentümerfrage 8.
- Major 3 (Security): `note` bei `QuestionLegalCleared` in `maskEvent` entfernt (Nachprüfung m2: eng statt rekursiv), nicht in der Projektion; Test 24; bisheriges Verhalten als Alternative a mit
  „hingenommenes Risiko“ (Eigentümerfrage 4).
- Major 4 (Datenschutz): Begründung unter `payload.pii`; Satz „keine Angabe über Personen“ berichtigt; E14 als
  Eigentümerfrage 9.
- Major 5 (Legal): Bedingungen in Titeln und Bausteinen; „deckt Recherche Z.64 ab“ gestrichen; § 131 Abs. 3 Satz 2 und
  Abs. 4 in Eigentümerfrage 1.
- Major 6 (Legal): Eigentümerfrage 3b als Go/No-go vor dem Bau; Lücke als „nicht erfüllt“ in R-GUARD-09; Zielscheibe 044c;
  DSFA V7 ergänzt statt geglättet.
- Major 7 (Legal): Hinweis an 051 (§ 131 Abs. 5, nur Pfad B, nie die Begründung); Fragen (a) und (b) in Eigentümerfrage 1.
- Major 8: Perspektive Datenschutz in Rolle und Perspektive.
- Major 9 (Security): Test 14 prüft die Antworten von `returnQuestion` (admin) und `deliverQuestion` (`podium`).
- Minor 10–12: Test 11 mit R-GUARD-04; Mutationsproben 12 und 13; tiefes Einfrieren und tiefe Kopie (Test 1, Test 19,
  Mutationsprobe 17); Typ- und Längenprüfung in Test 6.
- Klarstellungen 13, 15–19: Test 23 (412); `toStatus` als benannte Ausnahme im Nicht-Ziel, Prüfung gegen
  `QUESTION_STATUSES` (Test 18); Verweise mit Datei und Zeile; R-GUARD-12/13 ohne Version falsch; Zeile `answer_drafted`
  im Abschnitt „Role × Verweigerung“; Rechtekonzept Zeile 175.
- Als Hinweis bzw. Folgenotiz übernommen: 14 (Vertragsbeschreibung und 422/409-Aufteilung → 044b, 045), 19 (veraltete
  Stellen in Plan, ADR 0012 und `rules.ts`), 20 (Historienzeile → 045).

**Nachprüfung (01.10.2026, zu `bf8bbda`):** alle 9 major erledigt, kein neuer blocker oder major. Eingearbeitet:
- m1 (Legal): Titel von Nr. 1 nennt „nach vernünftiger kaufmännischer Beurteilung“.
- m2 (Security): `note` nicht mehr über `MASKED_KEYS` (rekursiv), sondern nur bei `QuestionLegalCleared` in `maskEvent`;
  Gegenprobe in Test 24; Files allowed angepasst.
- m3: Ein erneuter Vorschlag aus `in_review` startet die 10-Minuten-Uhr neu (Entscheidung und Test 26).
- m4 (Datenschutz): DSFA V7 nennt beide Änderungen ausdrücklich (Podium entfällt, Koordination kommt hinzu).
- m5: Tests in Reihenfolge nummeriert.

**Codex-Review PR #120 (zu `461c497`), eingearbeitet:**
- P1 (Vertrag zuerst, R6): Vertragsschritt als erster Commit von 044a (nur Beschreibungen, Patch-Stufe nach 0.4.0, Typen
  regeneriert); Ausnahme im Nicht-Ziel und Vertragspunkt in 044b gestrichen; Files allowed ergänzt.
- P2 (DSFA): `retentionClass: 'record'` auf `AnswerDrafted` (Verweigerung) und `QuestionApproved` (aus `approveRefusal`)
  in `api.ts`; Test 28, Mutationsprobe 18; Lücke bei V5/V6 und Rechtsfreigabe benannt (Eigentümerfrage 9).
- P2 (Umfang): Exportmarkierung ausdrücklich nach 051 verschoben, in Eigentümerfrage 2 und in der Planänderung für 044
  und 051 (+0,25 AStd dort).
