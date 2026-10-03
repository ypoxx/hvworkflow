# Scheibe 045 — Verweigerung in Beantwortung, Bühne und Historie

**Status:** spec (03.10.2026; gelesen auf `8705a1c`: 043a, 040b, 044a und 044b gemergt, Vertrag 0.4.2; erste Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041 zugeschnitten, Eigentümer 03.10.2026, Register E57)
**Risikoklasse:** hoch · 3,0 AStd (Spanne 2,75–3,4; Plan 045: 2) · Plan 045: 09.11.2026 (W7), tatsächlich direkt nach 044b als erste Oberflächenscheibe der Freigabe-Demo · Lanes: web-answers, web-stage, web-history; web-api (nur ein neuer Lese-Hook); e2e (eigene Datei, im Projekt `http` eingereiht); docs (Glossar, Nachweise)
**Rolle:** web-implementer; Review in frischem Kontext mit den Perspektiven **Legal** (Wortlaut, Vermerk „ungeprüft“, Bühne), **Datenschutz** (Begründung nur, wo der Kern sie liefert; Eingaben je Akteur) und **UX/Barrierefreiheit** (D1–D10). Lesebefund der Spec vor dem Bau (Klasse hoch, siehe „Warum hoch“); nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel. Sichtbar gemacht und in der Oberfläche belegt: R-TRANS-15, R-TRANS-16, R-GUARD-08, R-GUARD-09, R-GUARD-11, R-GUARD-12, R-GUARD-14, R-TRANS-03 (Entwurf über einer Verweigerung), R-TRANS-06 (Rückgabe). Dazu AGENTS.md R2, R3, R4, R6, R9, R10, R12; `docs/design-prinzipien.md` D1–D10
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 045 und §11 „Freigabe-Demo“; `docs/slices/044a-verweigerung-kern.md` §1, §6, §7 und „Hinweise an Folgescheiben: 045“; `docs/slices/044b-verweigerung-dienst.md` „Hinweise an Folgescheiben: 045“; ADR 0012 (vorgeschlagen, von Recht nicht gelesen); Register E15, E21, E25, E56, E57; Rechtekonzept Zeilen 13, 60–61, 173; Scheiben 021c (Mechanik der Rechtsfreigabe), 010d und 090 (Daten und Eingaben je Akteur), takt-008 (Fokus nach Aktion), 031b (gemeinsame e2e-Dateien)
**Depends on:** 044a (gemergt `83bc7e2`), 044b (gemergt `799cca5`), 036b (gemergt)
**Perspektive:** Legal, Datenschutz, UX · **Glossar: neue Begriffe:** ja (Verweigerungsgrund, Verweigerungspfad A/B, Formulierungsbaustein)

## Warum hoch

Der Plan führt 045 als „mittel“. Die Leitplanken (§4) setzen jede Änderung an **Verweigerung** und an
**personenbezogenen Daten** auf hoch, und bei unklarer Zuordnung gilt hoch. Diese Scheibe löst beides aus:

- **Rechtlich wirksamer Wortlaut.** Der Text, den das Podium im Saal vorliest, entsteht hier aus einem Formulierungsbaustein,
  den Recht nicht geprüft hat (E15, alle Katalogeinträge `verified: false`). Der Vermerk „ungeprüft“ muss sichtbar sein und
  darf nie in den Wortlaut geraten. Ein Fehler an dieser Stelle ist ein Rechtsbefund, kein Darstellungsfehler.
- **Begründung (SG2, DSFA V7).** Die Begründung kann den Aktionär betreffen. Der Kern maskiert sie (044a §6). Die Oberfläche
  darf sie aber weder aus einem Zwischenstand einer anderen Person anzeigen noch im Dialog über einen Akteurwechsel halten
  (090), noch über den Rückgabegrund nach außen tragen lassen (044a Eigentümerfrage 4, offener Unterpunkt).

Die Freigabe-Demo-Regel (AGENTS.md R3) erspart nur Oberflächenscheiben **mittleren** Risikos den Lesebefund. Für 045 gilt
deshalb: Lesebefund der Spec vor dem Bau, ein Review nach dem Bau. Herabstufen auf mittel darf nur ein Mensch
(Eigentümerfrage 1).

## Befund (Ist-Stand, gelesen auf `8705a1c`)

- **Kern und Dienst fertig.** `HvApi` hat `listRefusalGrounds`, `proposeRefusal(id, RefusalProposal, opts)` und
  `approveRefusal(id, answerVersion, opts)` (`packages/domain/src/api.ts:140-145`), über HTTP montiert (044b). Der HTTP-Client
  ruft die drei Routen schon (`apps/web/src/api/http.ts:653-655`); `liveStore.ts` führt `listRefusalGrounds` mit leerer
  Themenliste (Zeile 60) und die zwei Schreibvorgänge in `WRITE_METHODS` (Zeile 95).
- **Typen.** `AnswerVersion` trägt `answerKind?`, `refusalGroundId?`, `refusalGroundHash?`, `refusalJustification?`
  (`packages/domain/src/types.ts:273-290`); fehlt `answerKind`, ist es eine Antwort. `RefusalGround` = `{ id, title,
  stageText, legalRef: { source, citation, docVersion, docHash, verified }, hash }`, Export über `@hv/domain`.
  `AnswerDrafted.payload.answer.refusalGround` ist der Schnappschuss `{ title, stageText, legalRef }` im Ereignis
  (`events.ts:113-121`); `QuestionApproved` trägt nur `answerVersion`, auch bei einer Verweigerung.
- **Rechte (044a).** `question.refuse.propose`: `legal`, `coordination`. `question.refuse.approve`: `approver`. Begründung
  lesen nur Halter eines der beiden (`REFUSAL_JUSTIFICATION_READ`); `getStage` liefert sie nie, kein Ereignis-Lesepfad liefert
  sie, der Vermerk `note` der Rechtsfreigabe ist in keinem Lesepfad mehr sichtbar.
- **Oberfläche.** Die Aktionsschlüssel `action.question.refuse.propose` („Verweigerung vorschlagen“) und
  `action.question.refuse.approve` („Verweigerung freigeben“) stehen in `shell.{de,en}.ts` und `labels.ts:70-71`. Sonst kennt
  keine Ansicht die Verweigerung:
  - `answers/QuestionDetail.tsx` zeigt jede Version als gewöhnliche Antwort und bietet keine Verweigerung an;
  - `stage/Podium.tsx` zeigt den Text der freigegebenen Version als „Antwort“ ohne Kennzeichen;
  - `history/eventSummary.ts` nennt jedes `AnswerDrafted` „Antwortentwurf erstellt“;
  - die beiden Rückgabedialoge (`answers/Page.tsx` mit `ReasonDialog`, `stage/Page.tsx`) haben keinen Hinweis.
- **Seed.** Keine Verweigerung im Korpus (044a ließ ihn unverändert). Jede Ansicht dieser Scheibe wird im e2e erst erzeugt.
- **i18n.** Paritätstest (f): 524 Schlüssel je Sprache (`apps/web/src/i18n/parity.test.ts:105-112`).
- **e2e `http`.** Gemeinsame Dateien stehen in `SHARED_SPECS` (`apps/web/playwright.config.ts`); die Reihenfolge pinnt
  `scripts/e2e-http-031.test.mjs:26-29`. Jede Datei beginnt mit dem Datenbankstand ihrer Vorgänger.

**Kein Vertrags-, Kern- oder Dienstschritt nötig.** Alles, was die Oberfläche braucht, liefert Vertrag 0.4.2. Stellt der Bau
fest, dass ein Feld fehlt (etwa `refusalGround` in der Ereignisantwort über HTTP), hält er an und meldet es; er ändert weder
`packages/contract` noch `packages/domain` noch `apps/api` (AGENTS.md R6).

## Ziel und Entscheidungen vor Bau

Wer eine Verweigerung vorschlagen darf, schlägt sie im Beantwortungsdetail vor (Pfad A oder B, Grund, Wortlaut für die
Bühne, Begründung). Recht gibt sie wie jede Version rechtlich frei, die Freigabe gibt sie frei, die Bühne zeigt sie mit
Kennzeichen, die Historie nennt Vorschlag und Freigabe. Jede Schaltfläche folgt `_actions`; kein Code vergleicht einen
Rollennamen (R4). Was der Kern nicht liefert, zeigt die Oberfläche nicht und leitet es nicht her.

Alle Punkte unten sind **auf Standard gebaut**, wo nicht anders gesagt; ein späterer Wechsel kostet die genannten Beträge.

### 1. Katalog lesen (`apps/web/src/api/useRefusalGrounds.ts`, neu)

- Ein Hook liest `api.listRefusalGrounds()` einmal je Akteur (010d: Daten gehören dem Akteur, neu bei Wechsel über
  `actor.id`, nie über die Rolle) und hält `{ status: 'loading' | 'ready' | 'failed', grounds }`. Kein Neuladen auf
  Stromereignisse (`READ_TOPICS.listRefusalGrounds` ist leer und bleibt es).
- Reine Hilfen in `apps/web/src/features/answers/refusal.ts` (neu, ohne React), von Beantwortung und Bühne importiert:
  - `refusalKindOf(version)` → `'answer' | 'refusal_no_claim' | 'refusal_with_ground'` (fehlt `answerKind`: `answer`);
  - `latestIsRefusal(question)`;
  - `groundStatus(version, grounds)` → `{ entry?: RefusalGround, unverified: boolean, changed: boolean }`. `unverified` =
    `entry.legalRef.verified === false`; `changed` = Eintrag fehlt oder `entry.hash !== version.refusalGroundHash`;
  - `nextRefusalText(current, previousStageText, nextStageText)` → Feldinhalt nach einer Grundwahl (Abschnitt 2);
  - `buildRefusalProposal(form)` → `RefusalProposal` (Abschnitt 2);
  - `refusalProblemKey(error)` → Schlüssel der Meldung im Dialog oder `undefined` (Abschnitt 2).
- Ist der Katalog nicht lesbar (`failed`) oder fehlt ein Eintrag, zeigt jede Ansicht statt des Titels die `refusalGroundId`
  in Mono mit dem Hinweis `answers.refusal.ground.unknown`. Kein Toast; die Frage bleibt bedienbar.

### 2. Dialog „Verweigerung vorschlagen“ (`apps/web/src/features/answers/RefusalDialog.tsx`, neu)

- **Angebot.** In `QuestionDetail.tsx` eine Schaltfläche mit `actionLabel(t, 'question.refuse.propose')`, nur wenn
  `question._actions` `question.refuse.propose` enthält. Sie ist **sekundär**: Die primäre Aktion (D2) bleibt der nächste
  Schritt der Frage (Rechtsfreigabe, Freigabe, Prüfung). Neues `DetailAction` `{ kind: 'open-refusal' }`.
- **Aufbau** (Dialog `size="lg"`, Muster D: Titel, Erklärungssatz, Eingaben, rechts unten Abbrechen/Primär). Titel =
  Aktionsschlüssel; Erklärungssatz `answers.refusal.body` (neue Version, direkt in die Prüfung, danach Rechtsfreigabe und
  Freigabe durch eine dritte Person). Felder in dieser Reihenfolge:
  1. **Verweigerungspfad**, Pflichtauswahl als Radiogruppe ohne Vorauswahl: Pfad A „kein Auskunftsanspruch“, Pfad B
     „Verweigerung trotz Anspruchs, Grund aus dem Katalog“.
  2. **Verweigerungsgrund**, nur bei Pfad B: Auswahlliste aus dem Katalog, Optionstext = `title` vollständig (die gesetzliche
     Bedingung steht im Titel, 044a §1; sie muss vor der Wahl lesbar sein). Unter der Auswahl der gewählte Titel noch einmal
     vollständig, das Badge **„ungeprüft“** (Tönung warning, aus `legalRef.verified`, nie hart kodiert) und die `citation`
     klein unter dem Label `answers.refusal.ground.citation`.
  3. **Wortlaut für die Bühne** (`text`, Pflicht, `maxLength` 20000). Bei Pfad B füllt die Wahl eines Grundes das Feld mit
     `stageText` vor, aber nur, wenn das Feld leer ist oder noch genau den vorigen Baustein enthält; Getipptes wird nie
     überschrieben. Bei Pfad A kein Vorbefüllen.
  4. **Begründung (intern)** (`refusalJustification`, Pflicht für beide Pfade, R-GUARD-09, `maxLength` 4000). Hilfetext
     `answers.refusal.justification.help`: nur, was für die Entscheidung nötig ist; keine Namen Dritter; sichtbar nur für
     Personen, die Verweigerungen vorschlagen oder freigeben dürfen; nie auf der Bühne.
- **Vermerk am Baustein (044a, Architekten-Stichprobe L3; bindend).** Solange das Textfeld aus einem Baustein vorbefüllt ist
  und nicht leer, steht **neben dem Textfeld**, außerhalb des `<textarea>`, der Vermerk `answers.refusal.text.marker`
  („Formulierungsbaustein, ungeprüft (E15)“), mit `aria-describedby` am Feld verknüpft. Der Vermerk gelangt **nie** in
  `text`: `buildRefusalProposal` nimmt nur den Feldinhalt, getrimmt. Wird das Feld geleert oder Pfad A gewählt, verschwindet
  der Vermerk. Ist der Baustein bearbeitet, bleibt der Vermerk (der Text stammt weiter aus einem ungeprüften Baustein).
- **Absenden** (`actionLabel(t, 'question.refuse.propose')`, primär) ist gesperrt (`aria-disabled`, takt-008), solange
  kein Pfad gewählt ist, bei Pfad B kein Grund gewählt ist, `text.trim()` leer ist oder die Begründung nach Trimmen leer ist.
  `buildRefusalProposal`:
  - Pfad A: `{ answerKind: 'refusal_no_claim', text, refusalJustification }`, **ohne** `refusalGroundId` (sonst 422);
  - Pfad B: zusätzlich `refusalGroundId`;
  - Felder getrimmt, optionale Felder nur gesetzt, wenn vorhanden (`exactOptionalPropertyTypes`).
  Der Schreibvorgang läuft über den vorhandenen `run`-Pfad der Seite (Idempotenz, `If-Match` mit dem `etagOf` der Frage,
  Sperre gegen Doppelklick, Neulesen), wie `draftAnswer`.
- **Meldungen** (044a „Hinweise 045“, 044b „Hinweise 045“). Die Meldung steht im Dialog (`role="alert"`), die Eingaben bleiben
  erhalten, damit die Person korrigieren kann:
  - 409 mit `ruleId` R-GUARD-09 → `answers.refusal.error.groundRequired` mit der Regel-id (Schlüssel `toast.rule`, D5). Die
    Demo meldet so auch eine Begründung, die erst nach Trimmen leer ist;
  - 422 → `answers.refusal.error.invalid` (Eingabe: Länge, unbekannter Grund; der Dienst meldet auch eine leere Begründung
    als 422);
  - jede andere Abweisung (412, 403, 409 mit anderer Regel) geht wie heute an `showProblem` und schließt den Dialog nicht
    unbemerkt: 412 zeigt „Stand veraltet“ wie jeder Schreibvorgang der Seite.
- **Eingaben je Akteur (090, Codex P1 auf #38).** Der Dialog trägt `key={`${actorId}:refusal`}`; ein Akteurwechsel baut ihn
  neu auf und verwirft Pfad, Grund, Wortlaut und Begründung synchron.
- **Nach dem Erfolg** schließt der Dialog; der Fokus geht auf die neue Versionskarte (takt-008: nie auf `<body>`).
- **Kein Angebot auf Podiumsfragen.** R-GUARD-03 hält es aus `_actions`; die Oberfläche prüft den Pfad nicht selbst.

### 3. Verweigerung im Beantwortungsdetail (`QuestionDetail.tsx`, `WorkList.tsx`)

- **Versionskarte.** Eine Verweigerungsversion trägt neben dem Versionsbadge das Badge `answers.refusal.kind.noClaim`
  bzw. `answers.refusal.kind.withGround` (Tönung danger, nur als Badge, D4). Aufgeklappt:
  - der Wortlaut unter dem Label `answers.refusal.text.label`;
  - bei Pfad B der Grund (Titel aus dem Katalog über `refusalGroundId`) mit Badge „ungeprüft“, wenn `unverified`;
  - bei `changed` auf der **letzten** Version der Hinweis `answers.refusal.ground.changed` („Grund im Katalog seit dem
    Vorschlag geändert; bitte neu vorschlagen“). Er ist eine Tatsache, kein Recht; R-GUARD-11 hält die Freigabe ohnehin auf;
  - die Begründung unter `answers.refusal.justification.label` **nur, wenn `refusalJustification` im gelesenen Datensatz
    steht**. Die Oberfläche fragt dafür nie ein Recht oder eine Rolle ab; der Kern entscheidet (044a §6).
- **Freigabe der Verweigerung.** Schaltfläche `answers.refusal.approve.label` („Verweigerung freigeben (Version n)“), nur wenn
  `_actions` `question.refuse.approve` enthält. Mechanik wie „Freigeben“: `{ kind: 'refuse_approve', version }`,
  `api.approveRefusal(id, version, opts)` über `run`, Fokus danach auf den Freigabeblock (takt-008, `stepTaken`).
  In der Kette der primären Aktion steht sie an der Stelle von `approve` (beide schließen sich über R-GUARD-12/13 aus).
- **Antwortentwurf über einer Verweigerung** (R-TRANS-03 unverändert, 044a Eigentümerfrage 6 Standard): Der Editor bleibt
  angeboten, wo `_actions` `answer.draft` enthält; ist die letzte Version eine Verweigerung, steht über ihm der Hinweis
  `answers.refusal.editorHint` (ein neuer Entwurf verdrängt die Verweigerung und braucht erneut Rechtsfreigabe und Freigabe).
- **Arbeitsliste.** Eine Zeile, deren letzte Version eine Verweigerung ist, trägt das kleine Badge `answers.refusal.badge`
  („Verweigerung“) neben dem Status. Keine neue Filterachse (Nicht-Ziel).
- **Kein Vermerk der Rechtsfreigabe.** Sein Fehlen ist gewollt (044a §6); nichts ersetzt ihn.

### 4. Rückgabedialoge (SG2; 044a Eigentümerfrage 4, offener Unterpunkt; bindend)

Ist die letzte Version der Frage eine Verweigerung, zeigt der Rückgabedialog über dem Feld den Hinweis
`answers.return.refusalWarning` („Keine Begründung in den Rückgabegrund: Er ist für alle sichtbar, die die Frage lesen“),
`role="note"`, mit dem Feld über `aria-describedby` verknüpft. Das gilt für **beide** Rückgabedialoge: Beantwortung
(`ReasonDialog` erhält eine optionale Eigenschaft `note`) und Bühne (`stage/Page.tsx`, Taste `R`). Bei einer gewöhnlichen
Antwort erscheint der Hinweis nicht (D1: ein Hinweis, der immer steht, wird überlesen). Keine Prüfung des Inhalts, keine
Maskierung (Eigentümer mit Recht).

### 5. Bühne (`stage/Podium.tsx`, `stage/lib.ts`)

- Ist die freigegebene Version (`approvedAnswer`) eine Verweigerung, zeigt die Bühne in der Zeile des Labels `stage.answer.label`
  das Kennzeichen `stage.refusal.marker` („Auskunft wird verweigert“, Badge danger, aus zwei Metern lesbar, D10) und bei
  Pfad B die Zeile `stage.refusal.ground` (Grund: Titel) mit Badge „ungeprüft“, wenn `unverified`. Darunter in Bühnengröße
  (24 px) der Wortlaut `text`, der vorgelesen wird. Dasselbe in der Vorschau der nächsten Frage (kleiner) und als Badge
  `answers.refusal.badge` in den Zeilen der Warteschlange.
- **Begründung auf der Bühne nie**, auch nicht, wenn ein Objekt sie trüge: `Podium.tsx` liest das Feld
  `refusalJustification` nicht (Test, Abschnitt „Tests zuerst“). Der Kern liefert es dort ohnehin für niemanden.
- Bedienung unverändert: Leertaste „Vorgelesen, weiter“, `R` zurückgeben (D7, D10). Keine neue Taste.

### 6. Historie (`history/eventSummary.ts`, `history/Timeline.tsx`, `i18n/labels.ts`)

- **`AnswerDrafted` mit `answerKind` einer Verweigerung:** Bezeichnung `event.AnswerDrafted.refusal` („Verweigerung
  vorgeschlagen“) statt „Antwortentwurf erstellt“; Zusammenfassung: Version, dann `history.payload.refusal.noClaim` bzw.
  `history.payload.refusal.withGround` mit dem **Titel aus dem Schnappschuss** `payload.answer.refusalGround.title`
  (Katalogdatum zum Zeitpunkt des Vorschlags; nie der aktuelle Katalog, die Historie bleibt so, wie es war).
- **`QuestionApproved` einer Verweigerungsversion:** Bezeichnung `event.QuestionApproved.refusal` („Verweigerung
  freigegeben“), aber **nur**, wenn das `AnswerDrafted` derselben Frage und Version mit Verweigerungsart in den geladenen
  Ereignissen steht (`SummaryContext` erhält eine Abbildung `refusalVersions`, gebildet aus den geladenen Ereignissen).
  Fehlt es (Paginierung, takt-038), bleibt die gewöhnliche Bezeichnung mit Version. Die Oberfläche behauptet nichts, was
  nicht im Log steht.
- `QuestionLegalCleared` unverändert (Vermerk fehlt gewollt). Eine Begründung erscheint in keiner Zeile; `eventSummary`
  liest `payload.pii` nicht (Test mit einem Ereignis, das `pii` trüge).

### 7. Sprache und Inhalte

- Katalogtitel, Bausteine und `citation` sind Inhaltsdaten in Deutsch (E21) und erscheinen auch in der englischen Oberfläche
  deutsch. Alle Beschriftungen, Badges, Vermerke und Meldungen gehen durch das Wörterbuch (R10).
- Hausvokabular (R9, D6, `docs/glossar.md`): Verweigerung, Verweigerungspfad A/B, Verweigerungsgrund, Formulierungsbaustein,
  Begründung, Rechtsfreigabe, Freigabe, Bühne, Einzelfrage. Keine Rollennamen in Texten; der Leserkreis der Begründung wird
  über die Tätigkeit beschrieben („wer Verweigerungen vorschlagen oder freigeben darf“).
- **Glossar** (`docs/glossar.md`, drei Zeilen nach „Verweigerung“): Verweigerungspfad A/B (`answerKind`), Verweigerungsgrund
  (`refusalGroundId`, Katalog `packages/domain/src/refusalGrounds.ts`), Formulierungsbaustein (`stageText`, ungeprüft bis
  076).

### 8. i18n-Schlüssel (28 je Sprache; Paritätstest (f) 524 → 552)

| Modul | Schlüssel | de | en |
|---|---|---|---|
| answers | `answers.refusal.body` | Die Verweigerung wird eine neue Version und geht direkt in die Prüfung. Danach braucht sie die Rechtsfreigabe und die Freigabe durch eine dritte Person. | The refusal becomes a new version and goes straight to review. It then needs legal clearance and approval by a third person. |
| answers | `answers.refusal.path.label` | Verweigerungspfad | Refusal path |
| answers | `answers.refusal.path.noClaim` | Pfad A: kein Auskunftsanspruch | Path A: no right to information |
| answers | `answers.refusal.path.withGround` | Pfad B: Verweigerung trotz Anspruchs, Grund aus dem Katalog | Path B: refusal despite a right, ground from the catalogue |
| answers | `answers.refusal.ground.label` | Verweigerungsgrund | Refusal ground |
| answers | `answers.refusal.ground.placeholder` | Grund wählen | Choose a ground |
| answers | `answers.refusal.ground.unverified` | ungeprüft | unverified |
| answers | `answers.refusal.ground.citation` | Rechtsbezug | Legal reference |
| answers | `answers.refusal.ground.unknown` | Grund {id} nicht im Katalog | Ground {id} not in the catalogue |
| answers | `answers.refusal.ground.changed` | Grund im Katalog seit dem Vorschlag geändert; bitte neu vorschlagen. | Ground changed in the catalogue since the proposal; please propose again. |
| answers | `answers.refusal.text.label` | Wortlaut für die Bühne | Wording for the podium |
| answers | `answers.refusal.text.marker` | Formulierungsbaustein, ungeprüft (E15) | Template wording, unverified (E15) |
| answers | `answers.refusal.justification.label` | Begründung (intern) | Justification (internal) |
| answers | `answers.refusal.justification.help` | Nur, was für die Entscheidung nötig ist; keine Namen Dritter. Sichtbar nur für alle, die Verweigerungen vorschlagen oder freigeben dürfen; nie auf der Bühne. | Only what the decision needs; no names of third parties. Visible only to those who may propose or approve refusals; never on the podium. |
| answers | `answers.refusal.error.groundRequired` | Grund und Begründung sind Pflicht. | A ground and a justification are required. |
| answers | `answers.refusal.error.invalid` | Eingabe ungültig: zu lang oder Grund unbekannt. | Invalid input: too long or unknown ground. |
| answers | `answers.refusal.kind.noClaim` | Verweigerung · Pfad A | Refusal · path A |
| answers | `answers.refusal.kind.withGround` | Verweigerung · Pfad B | Refusal · path B |
| answers | `answers.refusal.approve.label` | Verweigerung freigeben (Version {version}) | Approve refusal (version {version}) |
| answers | `answers.refusal.editorHint` | Ein neuer Antwortentwurf verdrängt die Verweigerung und braucht erneut Rechtsfreigabe und Freigabe. | A new answer draft supersedes the refusal and needs legal clearance and approval again. |
| answers | `answers.refusal.badge` | Verweigerung | Refusal |
| answers | `answers.return.refusalWarning` | Keine Begründung in den Rückgabegrund: Er ist für alle sichtbar, die die Frage lesen. | No justification in the return reason: everyone who reads the question can see it. |
| stage | `stage.refusal.marker` | Auskunft wird verweigert | Information is refused |
| stage | `stage.refusal.ground` | Grund: {title} | Ground: {title} |
| history | `history.payload.refusal.noClaim` | Pfad A, kein Auskunftsanspruch | Path A, no right to information |
| history | `history.payload.refusal.withGround` | Pfad B, Grund: {title} | Path B, ground: {title} |
| shell | `event.AnswerDrafted.refusal` | Verweigerung vorgeschlagen | Refusal proposed |
| shell | `event.QuestionApproved.refusal` | Verweigerung freigegeben | Refusal approved |

Die Bühne nutzt `answers.refusal.badge`, `answers.refusal.ground.unverified` und `answers.return.refusalWarning` mit (wie sie
heute `answers.approval.sealed` nutzt). Die Texte darf der Bau glätten; die Zahl der Schlüssel ändert er nur mit Begründung
im Bericht (Paritätstest nennt die exakte Zahl).

## Nicht-Ziele

- Keine Änderung an `packages/contract`, `packages/domain`, `apps/api`, Seed, Rechten, Übergangstabelle oder Maskierung.
- Keine Untergründe für Pfad A (044c), keine Prüfliste je Pfad (059), kein Export und keine Niederschrift-Anlage (051),
  keine Zähler je Pfad (053, 087), kein `correctionOpen` (046), keine Rechtsfreigabe-Sicht (059).
- Keine Freigabe der Verweigerung auf Podiumsfragen (044a Eigentümerfrage 5, Standard nein).
- Kein Filter „nur Verweigerungen“ in der Arbeitsliste, keine Suche nach Grund.
- Keine Lesefreigabe des Rechtsfreigabe-Vermerks (044a Eigentümerfrage 4).
- Keine 422 für `draftAnswer` mit Verweigerungsfeldern (044b Eigentümerfrage 2, Standard 200).
- Keine Änderung an den bestehenden Szenarien außer der Reihenfolge im Projekt `http`; keine Zusicherung wird geschwächt.
- Keine Politur aus `docs/folgeliste.md`.

## Files allowed

- `apps/web/src/api/useRefusalGrounds.ts` (neu), `apps/web/src/api/useRefusalGrounds.test.ts` (neu)
- `apps/web/src/features/answers/refusal.ts` (neu), `apps/web/src/features/answers/refusal.test.ts` (neu)
- `apps/web/src/features/answers/RefusalDialog.tsx` (neu), `apps/web/src/features/answers/RefusalDialog.test.tsx` (neu)
- `apps/web/src/features/answers/{ActionDialogs,QuestionDetail,Page,WorkList,AnswerEditor}.tsx`,
  `apps/web/src/features/answers/{lib,lib.test}.ts`, `apps/web/src/features/answers/QuestionDetail.test.tsx` (neu)
- `apps/web/src/features/stage/{Page,Podium,Podium.test}.tsx`, `apps/web/src/features/stage/{lib,lib.test}.ts`
- `apps/web/src/features/history/{eventSummary,eventSummary.test,lib}.ts`, `apps/web/src/features/history/{Timeline,Timeline.test}.tsx`
- `apps/web/src/i18n/{answers.de,answers.en,stage.de,stage.en,history.de,history.en,shell.de,shell.en,labels,parity.test}.ts`
- `apps/web/e2e/045-verweigerung.spec.ts` (neu), `apps/web/e2e/support/e2e-texts.ts` (nur neue Texte)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`: die neue Datei eintragen)
- `scripts/e2e-http-031.test.mjs` (nur `SHARED_FILES` und `HTTP_ORDER`: die neue Datei an ihrer Pfadstelle)
- `docs/evidence/045-*.png`
- `docs/glossar.md` (nur die drei Zeilen aus Abschnitt 7)
- `docs/slices/045-verweigerung-oberflaeche.md`

## Ausdrücklich nicht erlaubt

`packages/**`, `apps/api/**`, `apps/web/src/api/{http,liveStore,actor}.ts`, `apps/web/src/components/**` (ein fehlendes
Bauteil wird in der Ansicht gebaut oder gemeldet), fremde e2e-Dateien, `docs/produktplan-beta.md` (Hinweise an den
Orchestrator unten), `docs/folgeliste.md` außer über das Review.

## Vor dem Bau prüfen

1. `api.listRefusalGrounds()` ist im Projekt `in-process` für `podium` (nur `stage.read`) lesbar; sonst zeigt die Bühne die
   id (Abschnitt 1), und der Bericht nennt es.
2. Ein `getQuestionHistory` über HTTP liefert `payload.answer.refusalGround` und `answerKind` (044b, Maskierung lässt sie
   stehen). Fehlt etwas: anhalten und melden (kein Vertragsschritt in dieser Scheibe).
3. Die Bühnen-Seite liest Fragen über `getStage`, die Beantwortung über `getQuestion`/`listQuestions`; beide tragen
   `answers` mit `answerKind`. Prüfen, ob `listQuestions` die Versionen in der Arbeitsliste enthält; sonst entfällt das
   Badge dort (Abschnitt 3) und der Bericht nennt es.
4. Welche Fragen `abnahme.spec.ts` und `080-sprecher-zustand.spec.ts` im Projekt `http` verwenden. Die neue Datei läuft im
   Projekt `http` zwischen `031-http-betriebsart.spec.ts` und `080-sprecher-zustand.spec.ts` und darf keine Frage verändern,
   auf die die Nachfolger bauen.
5. Ob die Testpersonen im Projekt `http` für `coordination`, `legal`, `approver` und `podium` verschiedene Akteur-ids haben
   (Vier-Augen und R-GUARD-14 brauchen drei verschiedene ids; `support/roles.ts`, Setup 031a).

## Tests zuerst (rot, dann grün)

Jeder Test steht vor der Änderung und ist rot (Ausgabe im Bericht), danach grün.

**Unit (Vitest)**

1. `refusal.test.ts`, `refusalKindOf`/`latestIsRefusal`: ohne `answerKind` → `answer`; beide Verweigerungsarten erkannt;
   keine Version → nicht Verweigerung.
2. `refusal.test.ts`, `groundStatus`: passender Hash → `changed: false`; anderer Hash oder fehlender Eintrag → `changed:
   true`; `verified: false` → `unverified: true`; ein Katalog mit `verified: true` → `unverified: false` (Badge folgt dem
   Datum, nicht einer Konstante).
3. `refusal.test.ts`, `buildRefusalProposal`: Pfad A ohne `refusalGroundId`, auch wenn im Formular noch ein Grund gewählt war;
   Pfad B mit id; Text und Begründung getrimmt; **der Vermerk „Formulierungsbaustein, ungeprüft (E15)“ steht in keinem Feld**
   (de und en geprüft); keine Schlüssel mit `undefined`.
4. `refusal.test.ts`, Vorbefüllen: leeres Feld → Baustein; Feld = voriger Baustein, neuer Grund → neuer Baustein; getippter
   Text → unverändert; Pfad A → kein Baustein.
5. `refusal.test.ts`, `refusalProblemKey`: 409 R-GUARD-09 → `groundRequired`; 422 → `invalid`; 409 R-GUARD-11, 412, 403 →
   `undefined` (Weg über `showProblem`).
6. `RefusalDialog.test.tsx` (statisch gerendert wie `Podium.test.tsx`): Absenden gesperrt ohne Pfad; Pfad B ohne Grund
   gesperrt; ohne Begründung gesperrt; der Vermerk steht außerhalb des `<textarea>` und ist über `aria-describedby`
   verknüpft; Badge „ungeprüft“ bei `verified: false`.
7. `Podium.test.tsx`: Kennzeichen und Grund bei einer freigegebenen Verweigerung; **ein Datensatz mit
   `refusalJustification` rendert den Begründungstext nicht**; bei einer gewöhnlichen Antwort kein Kennzeichen.
8. `eventSummary.test.ts`: `AnswerDrafted` Pfad B → „Verweigerung vorgeschlagen“ mit Titel aus dem Schnappschuss, auch wenn
   der aktuelle Katalog einen anderen Titel hätte; Pfad A ohne Grund; `QuestionApproved` mit passendem Vorschlag im Kontext →
   „Verweigerung freigegeben“, ohne ihn → gewöhnliche Bezeichnung; ein Ereignis mit `pii.refusalJustification` erscheint in
   keiner Zusammenfassung.
9. `QuestionDetail.test.tsx` (statisch gerendert): primäre Aktion bei `question.refuse.approve` ist die Freigabe der Verweigerung; die
   Schaltfläche „Verweigerung vorschlagen“ ist nie primär.
10. `useRefusalGrounds.test.ts`: lädt einmal je Akteur, lädt neu nach Akteurwechsel (Vergleich über `id`), `failed` bei
    Abweisung ohne Toast.
11. `parity.test.ts` (f): 552 je Sprache.

**Playwright, `apps/web/e2e/045-verweigerung.spec.ts`, Projekte `in-process` und `http`**

Die Datei wählt Fragen über ihren Zustand (Filter und `_actions`, Muster `021c-rechtsfreigabe.spec.ts`), nie über eine feste
Nummer, und nur Fragen, auf die keine Nachfolgedatei baut (Vor-dem-Bau-Punkt 4). Rollen nur über `support/roles.ts`.

- **E1 Pfad B, ganzer Weg @screenshot.** `coordination` öffnet eine Textpfad-Frage mit `question.refuse.propose`: Dialog;
  Absenden gesperrt ohne Pfad und bei Pfad B ohne Grund; Grund wählen → Wortlaut = `stageText`, Vermerk sichtbar neben dem
  Feld und **nicht** im Feldwert, Badge „ungeprüft“; Begründung tippen (eindeutiger Testsatz); Screenshot Dialog de/en;
  absenden → Status „in Prüfung“, Versionskarte mit „Verweigerung · Pfad B“, Grund und Begründung, Fokus auf der Karte.
  `legal`: „Freigeben“ fehlt, Rechtsfreigabe vorhanden; rechtlich freigeben. `approver`: **vor** der Rechtsfreigabe fehlt
  „Verweigerung freigeben“ (vorher in derselben Datei geprüft), danach vorhanden; „Freigeben“ fehlt durchgehend (R-GUARD-12);
  Begründung im Detail sichtbar; freigeben; Screenshot Detail de/en; auf die Bühne stellen. `podium`: Bühne mit Kennzeichen,
  Grund, Wortlaut; Screenshot Bühne de/en; Begründungssatz **nicht** im DOM der Bühne.
- **E2 Leserkreis.** `approver` auf der Bühne: Begründungssatz nicht im DOM (`getStage` maskiert immer), im
  Beantwortungsdetail derselben Frage sichtbar. `moderation` (liest Frage, Historie und Bühne, hält kein `refuse.*`):
  Begründungssatz weder im Detail noch in der Historie noch auf der Bühne; keine Schaltfläche „Verweigerung vorschlagen“.
  `expert`: keine Schaltfläche, kein Begründungssatz.
- **E3 Pfad A.** Kein Feld Verweigerungsgrund, kein Vorbefüllen, kein Vermerk; Absenden gesperrt ohne Wortlaut oder ohne
  Begründung; absenden → „Verweigerung · Pfad A“.
- **E4 Rückgabedialog.** Auf einer Verweigerung in Prüfung zeigt der Rückgabedialog der Beantwortung den Hinweis; auf einer
  gewöhnlichen Antwort nicht. Auf der Bühne (Taste `R`) bei der gestellten Verweigerung ebenso.
- **E5 Historie.** Zeilen „Verweigerung vorgeschlagen“ (mit Grund aus dem Schnappschuss) und „Verweigerung freigegeben“;
  kein Begründungssatz auf der Seite.
- **E6 Eingaben je Akteur (090).** `legal` tippt Wortlaut und Begründung, Wechsel zu einer Rolle mit und einer ohne das
  Recht und zurück: Dialog geschlossen, kein Feld trägt den alten Text (MutationObserver-Muster aus 090).
- **E7 Tastatur (D8).** Dialog vollständig mit Tastatur: Tab zur Radiogruppe, Pfeile, Auswahl, Felder, Enter auf Absenden;
  Fokus sichtbar; Escape schließt ohne Schreiben.
- **E8 axe** ohne serious/critical auf Dialog, Detail und Bühne, de und en.

Im Projekt `http` laufen E1–E7 genauso; die Screenshots gehen dort in das Ausgabeverzeichnis (`support/evidence.ts`). Der
Nachweis für `http` ist der CI-Lauf `e2e-http` (E56: Artefaktname, Lauf-ID, Artefakt-ID, Digest im Abschnitt „Nachweise“);
lokal mit `E2E_HTTP_IDP=none` läuft die Datei nicht (sie braucht Anmeldungen).

Prüfziel aus dem Plan („Pfad B ohne Grund → Aktion fehlt in `_actions`“) ist so nicht baubar: `_actions` gilt je Frage,
R-GUARD-09 ist ohne Nutzlast immer erfüllbar (044a „Hinweise 045“). Ersetzt durch Test 5, Test 6 und E1 (gesperrtes Absenden,
Meldung mit R-GUARD-09 bzw. 422).

## Akzeptanzkriterium

1. Tests 1–11 und E1–E8 vor der Änderung rot (Ausgabe im Bericht), danach grün; E1–E8 im Projekt `in-process` auch mit
   `--repeat-each=3`.
2. Volle Playwright-Suite `in-process` grün (Anzahl nennen), axe ohne serious/critical. Projekt `http` grün im CI-Lauf
   `e2e-http` des PR (Nachweis nach E56).
3. Sechs Screenshots in `docs/evidence/`: `045-dialog-de.png`, `045-dialog-en.png`, `045-detail-de.png`, `045-detail-en.png`,
   `045-buehne-de.png`, `045-buehne-en.png`. Auf dem Dialog-Screenshot sind Vermerk und Badge „ungeprüft“ lesbar; auf dem
   Bühnen-Screenshot steht kein Begründungstext.
4. Kein Rollenname in einem Vergleich in `apps/web/src` (`pnpm role-literals`, `pnpm vocabulary`); kein Literal in
   Komponenten (`pnpm i18n-literals`); Paritätstest 552.
5. `git diff --stat` des Baus berührt nur „Files allowed“ (`pnpm slice-scope` grün auf dem Branch `claude/slice-045-…`).
6. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Nachweise

- Ausgabe der roten Tests vor der Änderung, Schluss von `pnpm gates`, Playwright-Zahlen.
- `docs/evidence/045-*.png` (sechs Dateien, Akzeptanzkriterium 3).
- CI-Lauf `e2e-http`: Artefaktname, Lauf-ID, Artefakt-ID, Digest (E56).
- Design-Kritik D1–D10 als Tabelle im Bericht (je Zeile ja/nein mit einem Satz), insbesondere D2 (eine primäre Aktion im
  Dialog und im Detail), D4 (Danger nur als Badge), D6 (leer, laden, Fehler des Katalogs), D10 (Bühne aus zwei Metern).

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: hoch
Ausgelöst: [x] Fachregel, Status (nur Anzeige) [ ] Vertrag, Ereignis, Konfiguration [ ] Persistenz, Migration, Nebenläufigkeit
[ ] Rolle, Recht, Identität, Schutzklasse (nur `_actions`, keine Änderung) [x] personenbezogene oder vertrauliche Daten
[ ] Betrieb, Wiederherstellung [ ] Administration [x] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI, Agenten
[x] Dokumentation, Schulung (Glossar)
Perspektive(n): Legal, Datenschutz, UX · Nachweise: oben · Offene Entscheidung: E15 (Katalog ungeprüft, Standard „ungeprüft“
sichtbar), E25 (Standard aus 044a)

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| Baustein wirkt geprüft, Vermerk fehlt oder gerät in den Wortlaut | Vermerk außerhalb des Felds, `buildRefusalProposal` nimmt nur den Feldinhalt | Test 3, Test 6, E1, Screenshot |
| Begründung einer berechtigten Person bleibt nach Wechsel sichtbar | Daten je Akteur (010d), Dialog mit Akteur-Schlüssel (090) | E2, E6 |
| Begründung auf der Bühne | Kern maskiert; `Podium.tsx` liest das Feld nicht | Test 7, E1, E2 |
| Begründung im Rückgabegrund | Hinweis in beiden Rückgabedialogen | E4 |
| Oberfläche bietet eine Freigabe an, die der Kern abweist | nur `_actions`; Hinweis bei geändertem Katalog | E1 (vor/nach Rechtsfreigabe), Test 2 |
| Historie behauptet eine freigegebene Verweigerung ohne Beleg | Bezeichnung nur mit dem Vorschlag im geladenen Log | Test 8 |
| Katalog nicht lesbar | id in Mono, kein Toast, Frage bedienbar | Test 10, D6 |

## Aufwand

Ehrlich geschätzt **3,0 AStd** (Spanne 2,75–3,4) statt 2 laut Plan:

| Teil | AStd |
|---|---|
| Hilfen `refusal.ts`, Hook, Unit-Tests 1–5, 10 | 0,4 |
| `RefusalDialog` mit Vorbefüllen, Vermerk, Sperren, Meldungen, Akteur-Schlüssel; Verdrahtung in `Page`/`QuestionDetail` | 0,7 |
| Versionskarte, Freigabe der Verweigerung, Editor-Hinweis, Arbeitslisten-Badge, zwei Rückgabedialoge | 0,35 |
| Bühne (aktuell, Vorschau, Warteschlange) mit Test 7 | 0,3 |
| Historie mit Test 8 | 0,25 |
| i18n 28 Schlüssel je Sprache, Parität, Glossar | 0,15 |
| e2e E1–E8 in beiden Projekten, Einreihung `http`, Reihenfolge-Pin | 0,6 |
| Screenshots, axe, Design-Kritik, `pnpm gates`, Bericht, CI-Nachweis | 0,25 |

Läuft der Bau über 3,4 AStd, committet er nach Beantwortung und Rückgabedialogen einen Zwischenstand und meldet; der Rest
(Bühne, Historie) wird dann 045b, ohne neue Spec-Runde (Zuschnitt hier vorab festgelegt).

## Standards (auf Standard gebaut)

| Standard | Was 045 baut | Kosten einer späteren Änderung |
|---|---|---|
| Vorschlagen ist sekundär, nie primär | Kette der primären Aktion unverändert, Freigabe der Verweigerung ersetzt `approve` | < 0,1 AStd |
| Pfadwahl ohne Vorauswahl | Radiogruppe leer | < 0,1 AStd |
| Vorbefüllen nur Pfad B, nie über Getipptes | `nextRefusalText` | < 0,1 AStd |
| Vermerk bleibt nach Bearbeiten des Bausteins | Anzeige solange Feld nicht leer | < 0,1 AStd |
| „Ungeprüft“ auch auf der Bühne | Badge am Grund auf der Bühne | < 0,1 AStd (Eigentümer mit Recht) |
| Hinweis im Rückgabedialog nur bei Verweigerung | Bedingung `latestIsRefusal` | < 0,1 AStd |
| Katalogtexte deutsch auch in en (E21) | keine Übersetzung der Inhalte | Übersetzung braucht Katalogfelder je Sprache: Vertrag und Kern, rund 0,5 AStd |
| „Verweigerung freigegeben“ nur mit Beleg im geladenen Log | `refusalVersions` im Kontext | Ereignisfeld `answerKind` an `QuestionApproved`: Vertrag und Kern, rund 0,5 AStd |

## Offene Eigentümerfragen

Keine blockiert den Bau.

1. **Risikoklasse.** Standard: hoch nach Leitplanken §4 (Verweigerung, personenbezogene Daten); damit Lesebefund der Spec vor
   dem Bau. Herabstufen auf mittel (Plan) darf nur der Eigentümer; dann trägt die Spec die Zeile „Herabstufung freigegeben
   von … am …“ im Kopf, und der Lesebefund entfällt nach der Freigabe-Demo-Regel. Kostenwirkung: rund 0,3 AStd Lesebefund.

## Hinweise an den Orchestrator

- Plan-Eintrag 045 (§5): Risikoklasse „mittel“ → „hoch“ (Spec höher als Plan, kein Herabstufungsfall), Aufwand 2 → 3,0 AStd,
  Lane web-history ergänzen, Nachweis „Pfad B ohne Grund → Aktion fehlt in `_actions`“ durch „Absenden gesperrt, Meldung
  R-GUARD-09 bzw. 422“ ersetzen (044a „Hinweise 045“). Nicht Teil dieser Spec-Änderung.
- Die Folgescheiben der Kette (048, 053, 054, 055, 059) setzen auf `features/answers/refusal.ts` auf: 053 zählt Verweigerungen
  je Pfad über `refusalKindOf`, 059 hängt die Prüfliste je Pfad an denselben Dialog- und Detailaufbau.

## Hinweise an Folgescheiben

- **059:** Prüfliste einer Verweigerung (Begründung passt zum Grund, Bedingung im Titel erfüllt) neben dem Grund in der
  Versionskarte; derselbe Badge „ungeprüft“.
- **046:** `correctionOpen` und Rückgabe aus `delivered`: der Rückgabedialog der Bühne trägt den Hinweis schon.
- **053/087:** Zähldefinition je Pfad aus `refusalKindOf`, aggregiert, nie je Person.
- **076:** Mit `verified: true` verschwinden Badge und Vermerk ohne Codeänderung (Test 2).
- **044c:** Pfad A mit Untergründen: die Radiogruppe erhält bei Pfad A eine Auswahl; `buildRefusalProposal` und Test 3 ändern
  sich.

## Bericht (nach Bau ausfüllen)

```
Slice: 045-verweigerung-oberflaeche
Done:
Evidence:
Open:
Touched:
```

## Review findings
