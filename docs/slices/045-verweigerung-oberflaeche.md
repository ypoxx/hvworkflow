# Scheibe 045 — Verweigerung in Beantwortung, Bühne und Historie

**Status:** spec (03.10.2026; gelesen auf `8705a1c`: 043a, 040b, 044a und 044b gemergt, Vertrag 0.4.2; Lesebefund zu `fa340f2` eingearbeitet: 0 blocker, 9 major, 6 minor, 3 nit, Abschnitt „Review findings“; erste Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041 zugeschnitten, Eigentümer 03.10.2026, Register E57)
**Risikoklasse:** hoch · 3,5 AStd (Spanne 3,2–4,0; Plan 045: 2; Zuschnitt 045b vorbereitet, Abschnitt „Aufwand“) · Plan 045: 09.11.2026 (W7), tatsächlich direkt nach 044b als erste Oberflächenscheibe der Freigabe-Demo · Lanes: web-answers, web-stage, web-history; web-api (nur ein neuer Lese-Hook); e2e (eigene Datei, im Projekt `http` eingereiht); docs (Glossar, Nachweise)
**Rolle:** web-implementer; Review in frischem Kontext mit den Perspektiven **Legal** (Wortlaut, Vermerk „ungeprüft“, Bühne), **Datenschutz** (Begründung nur, wo der Kern sie liefert; Eingaben je Akteur und je Frage) und **UX/Barrierefreiheit** (D1–D10). Lesebefund der Spec vor dem Bau (Klasse hoch, siehe „Warum hoch“); nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue fachliche Regel. Sichtbar gemacht und in der Oberfläche belegt: R-TRANS-15, R-TRANS-16, R-GUARD-08, R-GUARD-09, R-GUARD-11, R-GUARD-12, R-GUARD-14, R-TRANS-03 (Entwurf über einer Verweigerung), R-TRANS-06 (Rückgabe). Dazu AGENTS.md R2, R3, R4, R6, R9, R10, R12; `docs/design-prinzipien.md` D1–D10
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 045 und §11 „Freigabe-Demo“; `docs/slices/044a-verweigerung-kern.md` §1, §6, §7 und „Hinweise an Folgescheiben: 045“; `docs/slices/044b-verweigerung-dienst.md` „Hinweise an Folgescheiben: 045“; ADR 0012 (vorgeschlagen, von Recht nicht gelesen); Register E15, E21, E25, E56, E57; Rechtekonzept Zeilen 13, 60–61, 173; Glossar Zeilen 19–22 (Antwortpfade A/B/C); Scheiben 021c (Mechanik der Rechtsfreigabe), 010d und 090 (Daten und Eingaben je Akteur), takt-008 (Fokus nach Aktion), 031b (gemeinsame e2e-Dateien)
**Depends on:** 044a (gemergt `83bc7e2`), 044b (gemergt `799cca5`), 036b (gemergt)
**Perspektive:** Legal, Datenschutz, UX · **Glossar: neue Begriffe:** ja (Verweigerung · kein Auskunftsanspruch, Verweigerung · Grund aus Katalog, Verweigerungsgrund, Formulierungsbaustein)

## Warum hoch

Der Plan führt 045 als „mittel“. Die Leitplanken (§4) setzen jede Änderung an **Verweigerung** und an
**personenbezogenen Daten** auf hoch, und bei unklarer Zuordnung gilt hoch. Diese Scheibe löst beides aus:

- **Rechtlich wirksamer Wortlaut.** Der Text, den das Podium im Saal vorliest, entsteht hier aus einem Formulierungsbaustein,
  den Recht nicht geprüft hat (E15, alle Katalogeinträge `verified: false`). Der Vermerk „ungeprüft“ muss sichtbar sein und
  darf nie in den Wortlaut geraten. Ein Fehler an dieser Stelle ist ein Rechtsbefund, kein Darstellungsfehler.
- **Begründung (SG2, DSFA V7).** Die Begründung kann den Aktionär betreffen. Der Kern maskiert sie (044a §6). Die Oberfläche
  darf sie aber weder aus einem Zwischenstand einer anderen Person oder Frage anzeigen noch im Dialog über einen
  Akteur- oder Fragewechsel halten (090), noch über den Rückgabegrund nach außen tragen lassen (044a Eigentümerfrage 4,
  offener Unterpunkt).

Die Freigabe-Demo-Regel (AGENTS.md R3) erspart nur Oberflächenscheiben **mittleren** Risikos den Lesebefund. Für 045 gilt
deshalb: Lesebefund der Spec vor dem Bau (erledigt zu `fa340f2`), ein Review nach dem Bau. Herabstufen auf mittel darf nur
ein Mensch (Eigentümerfrage 1).

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
  sie, der Vermerk `note` der Rechtsfreigabe ist in keinem Lesepfad mehr sichtbar. `question.return` halten `moderation`,
  `legal`, `approver`, `podium`; `coordination` nicht.
- **Oberfläche.** Die Aktionsschlüssel `action.question.refuse.propose` („Verweigerung vorschlagen“) und
  `action.question.refuse.approve` („Verweigerung freigeben“) stehen in `shell.{de,en}.ts` und `labels.ts:70-71`. Sonst kennt
  keine Ansicht die Verweigerung:
  - `answers/QuestionDetail.tsx` zeigt jede Version als gewöhnliche Antwort und bietet keine Verweigerung an;
  - `answers/Page.tsx`: `run(permission, write, onDone?)` meldet jede Abweisung außer 412 per `showProblem` als Toast,
    412 als „Stand veraltet“ über dem Detail (`setStaleFor`); ein offener Dialog bleibt bei 412 offen;
  - `stage/Podium.tsx` zeigt den Text der freigegebenen Version als „Antwort“ ohne Kennzeichen; die Rückgabe (Taste `R`)
    gilt nur der aktuellen Frage, die Vorschau einer Warteschlangenzeile ist nur lesend;
  - `history/eventSummary.ts` nennt jedes `AnswerDrafted` „Antwortentwurf erstellt“; `history/Page.tsx:548` bildet den
    `SummaryContext`;
  - die beiden Rückgabedialoge (`answers/Page.tsx` mit `ReasonDialog`, `stage/Page.tsx`) haben keinen Hinweis.
- **Namenskollision.** Das Glossar (Zeilen 20–22) belegt „Pfad A/B/C“ für die Antwortpfade (`podium`, `fast_track`,
  `expert_track`). 044a nennt die Verweigerungsarten „Verweigerungspfad A/B“. In der Oberfläche wäre „Pfad A“ doppeldeutig;
  diese Scheibe benennt die Verweigerungsarten deshalb nach Inhalt (Entscheidung 2).
- **Seed.** Keine Verweigerung im Korpus (044a ließ ihn unverändert). Jede Ansicht dieser Scheibe wird im e2e erst erzeugt.
- **i18n.** Paritätstest (f): 524 Schlüssel je Sprache (`apps/web/src/i18n/parity.test.ts:164-171`).
- **e2e `http`.** Gemeinsame Dateien stehen in `SHARED_SPECS` (`apps/web/playwright.config.ts`); die Reihenfolge pinnt
  `scripts/e2e-http-031.test.mjs:26-29`. Jede Datei beginnt mit dem Datenbankstand ihrer Vorgänger. Der Schritt läuft in
  `.github/workflows/gates.yml:226` mit `timeout-minutes: 9` (Job 15).

**Kein Vertrags-, Kern- oder Dienstschritt nötig.** Alles, was die Oberfläche braucht, liefert Vertrag 0.4.2. Stellt der Bau
fest, dass ein Feld fehlt (etwa `refusalGround` in der Ereignisantwort über HTTP), hält er an und meldet es; er ändert weder
`packages/contract` noch `packages/domain` noch `apps/api` (AGENTS.md R6).

## Ziel und Entscheidungen vor Bau

Wer eine Verweigerung vorschlagen darf, schlägt sie im Beantwortungsdetail vor (Art der Verweigerung, Grund, Wortlaut für die
Bühne, Begründung). Recht gibt sie wie jede Version rechtlich frei, die Freigabe gibt sie frei, die Bühne zeigt sie mit
Kennzeichen, die Historie nennt Vorschlag und Freigabe. Jede Schaltfläche folgt `_actions`; kein Code vergleicht einen
Rollennamen (R4). Was der Kern nicht liefert, zeigt die Oberfläche nicht und leitet es nicht her.

Alle Punkte unten sind **auf Standard gebaut**, wo nicht anders gesagt; ein späterer Wechsel kostet die genannten Beträge.

### 1. Katalog lesen (`apps/web/src/api/useRefusalGrounds.ts`, neu)

- Ein Hook liest `api.listRefusalGrounds()` einmal je Akteur (010d: Daten gehören dem Akteur, neu bei Wechsel über
  `actor.id`, nie über die Rolle) und hält `{ status: 'loading' | 'ready' | 'failed', grounds }`. Kein Neuladen auf
  Stromereignisse (`READ_TOPICS.listRefusalGrounds` ist leer und bleibt es). Kein Toast bei `failed`.
- Reine Hilfen in `apps/web/src/features/answers/refusal.ts` (neu, ohne React), von Beantwortung, Bühne und Historie
  importiert:
  - `refusalKindOf(version)` → `'answer' | 'refusal_no_claim' | 'refusal_with_ground'` (fehlt `answerKind`: `answer`);
  - `latestIsRefusal(question)`;
  - `carriesJustification(question)`: irgendeine Version im gelesenen Datensatz trägt `refusalJustification` (Entscheidung 4);
  - `groundStatus(version, grounds, catalogueStatus)` → `{ entry?: RefusalGround, unverified: boolean, changed: boolean }`,
    **ausfallsicher**:

    | Katalog | Eintrag mit `id === refusalGroundId` | `entry` | `unverified` | `changed` |
    |---|---|---|---|---|
    | `ready` | vorhanden, `hash` gleich | Eintrag | `legalRef.verified === false` | `false` |
    | `ready` | vorhanden, `hash` anders | Eintrag | `legalRef.verified === false` | `true` |
    | `ready` | fehlt | — | `true` | `true` |
    | `loading` oder `failed` | (nicht geprüft) | — | `true` | `false` |

    Ohne `entry` zeigt jede Ansicht statt des Titels die `refusalGroundId` in Mono mit `answers.refusal.ground.unknown`
    und dem Badge „ungeprüft“. „Geändert“ wird nur gegen einen geladenen Katalog behauptet;
  - `nextRefusalForm(form, event)` → neuer Formularzustand für die Ereignisse „Art gewählt“, „Grund gewählt“, „Text
    getippt“ (Entscheidung 3, Vorbefüllen und `fromTemplate`);
  - `buildRefusalProposal(form)` → `RefusalProposal` (Entscheidung 3);
  - `refusalProblemKey(error)` → Schlüssel der Meldung im Dialog oder `undefined` (Entscheidung 3).

### 2. Namen der Verweigerungsarten (nach Inhalt, nie „Pfad A/B“)

In der ganzen Oberfläche (Dialog, Versionskarte, Arbeitsliste, Historie, Bühne) und im Glossar:

| `answerKind` | de | en |
|---|---|---|
| `refusal_no_claim` | Verweigerung · kein Auskunftsanspruch | Refusal · no right to information |
| `refusal_with_ground` | Verweigerung · Grund aus Katalog | Refusal · ground from catalogue |

Grund: „Pfad A/B/C“ sind im Glossar die Antwortpfade; „Pfad A“ hieße in derselben Ansicht zweierlei. In Code, Tests und
Spec bleiben die Vertragswerte (`refusal_no_claim`, `refusal_with_ground`); „Verweigerungspfad A/B“ aus 044a erscheint in
keinem Oberflächentext.

### 3. Dialog „Verweigerung vorschlagen“ (`apps/web/src/features/answers/RefusalDialog.tsx`, neu)

- **Angebot.** In `QuestionDetail.tsx` eine Schaltfläche mit `actionLabel(t, 'question.refuse.propose')`, nur wenn
  `question._actions` `question.refuse.propose` enthält (`data-testid="answer-refuse"`). Sie ist **sekundär**: Die primäre Aktion (D2) bleibt der nächste
  Schritt der Frage (Rechtsfreigabe, Freigabe, Prüfung). Neues `DetailAction` `{ kind: 'open-refusal' }`; `OpenDialog` in
  `Page.tsx` erhält `'refusal'`.
- **Zustand je Akteur und je Frage (090, Codex P1 auf #38; Lesebefund 3).** Der Dialog wird **nur gerendert, solange er offen
  ist** (`{dialog === 'refusal' && question !== null && <RefusalDialog key={`${actorId}:${question.id}:refusal`} … />}`).
  Jedes Öffnen montiert ihn neu, also beginnt jedes Öffnen leer, synchron, ohne Effekt (kein Aufblitzen alter Eingaben).
  Ein Akteur- oder Fragewechsel ändert den Schlüssel und verwirft alle Eingaben. Erhalten bleiben Eingaben **nur** über eine
  Abweisung hinweg, solange der Dialog offen bleibt (409 R-GUARD-09, 422).
- **Aufbau** (Dialog `size="lg"`, Muster D: Titel, Erklärungssatz, Eingaben, rechts unten Abbrechen/Primär). Titel =
  Aktionsschlüssel; Erklärungssatz `answers.refusal.body`. Felder in dieser Reihenfolge:
  1. **Art der Verweigerung** (`answers.refusal.kind.label`), Pflichtauswahl als Radiogruppe ohne Vorauswahl, Beschriftungen
     `answers.refusal.kind.noClaim` und `answers.refusal.kind.withGround` (Entscheidung 2).
  2. **Verweigerungsgrund**, nur bei `refusal_with_ground`. Nach Katalogzustand (Lesebefund 12):
     - `loading`: an der Stelle der Auswahl eine Zeile in Feldhöhe mit `answers.refusal.ground.loading` (Prinzip 8: nichts springt);
     - `failed`: `answers.refusal.ground.failed` (`role="status"`); Absenden bleibt für diese Art gesperrt;
       `refusal_no_claim` bleibt voll bedienbar;
     - `ready`: Auswahlliste, Platzhalter `answers.refusal.ground.placeholder`, Optionstext = `title` vollständig (die
       gesetzliche Bedingung steht im Titel, 044a §1). Unter der Auswahl der gewählte Titel noch einmal vollständig, das Badge
       **„ungeprüft“** (Tönung warning) **nur bei `legalRef.verified === false`**, und die `citation` klein unter dem Label
       `answers.refusal.ground.citation`.
  3. **Wortlaut für die Bühne** (`text`, Pflicht, höchstens 20000 Codepunkte, Label `answers.refusal.text.label`).
  4. **Begründung (intern)** (`refusalJustification`, Pflicht für beide Arten, R-GUARD-09, höchstens 4000 Codepunkte, Label
     `answers.refusal.justification.label`). Hilfetext `answers.refusal.justification.help`.
  - **Längen in Codepunkten (Codex P2, Nachtrag Orchestrator).** Kein natives `maxLength` auf beiden Feldern: es zählt
    UTF-16-Einheiten und sperrt gültige Eingaben mit Zeichen außerhalb der BMP (Emoji) bei etwa der halben Vertragslänge.
    Die Grenze prüft eine reine Funktion in `features/answers/refusal.ts` mit `[...value].length`, derselben Zählung wie `codePointLength`
    in `packages/domain/src/api.ts`; über der Grenze ist Absenden gesperrt. Test 5 deckt die Grenze: 4000 Emoji in der
    Begründung erlauben Absenden, 4001 sperren es; dasselbe für 20000/20001 im Wortlaut über die reine Funktion.
- **Vorbefüllen und `fromTemplate` (Lesebefund 1; bindend).** Der Formularzustand trägt `{ kind, groundId, text,
  justification, lastTemplate, fromTemplate }`; `nextRefusalForm` setzt ihn so:
  - **Grund gewählt:** Ist `text` leer oder gleich `lastTemplate`, wird `text = stageText`, `lastTemplate = stageText`,
    `fromTemplate = true`. Sonst bleibt `text` unverändert (Getipptes wird nie überschrieben).
  - **Wechsel zu `refusal_no_claim`:** Ist `text` genau gleich `lastTemplate`, wird `text` geleert, `fromTemplate = false`,
    `lastTemplate` gelöscht. Ist der Text bearbeitet, bleibt er **mit** `fromTemplate = true` (er stammt weiter aus einem
    Baustein). `groundId` bleibt im Zustand, wird aber nie gesendet.
  - **Text getippt:** `fromTemplate` bleibt, wie es ist; **nur ein leeres Feld** setzt `fromTemplate = false` und löscht
    `lastTemplate`.
  - **Wechsel zurück zu `refusal_with_ground`** mit gewähltem Grund und leerem Feld: Vorbefüllen wie oben.
- **Vermerk am Baustein (044a, Architekten-Stichprobe L3; bindend).** Sichtbar genau dann, wenn `fromTemplate` und
  `text.trim() !== ''` **und** der Baustein, aus dem der Text stammt, `legalRef.verified === false` trägt (Lesebefund 10;
  ist die Herkunft nicht mehr bestimmbar, etwa nach Wechsel der Art, gilt ausfallsicher „ungeprüft“). Er steht **neben dem
  Textfeld**, außerhalb des `<textarea>`, Text `answers.refusal.text.marker` („Formulierungsbaustein, ungeprüft (E15)“), mit
  `aria-describedby` am Feld verknüpft. Er gelangt **nie** in `text`: `buildRefusalProposal` nimmt nur den Feldinhalt,
  getrimmt. Zum Kürzel „(E15)“ im Text siehe Entscheidung 9.
- **Absenden** (`actionLabel(t, 'question.refuse.propose')`, primär) ist gesperrt (`aria-disabled`, takt-008), solange keine
  Art gewählt ist; bei `refusal_with_ground` der Katalog nicht `ready` oder kein Grund gewählt ist; `text.trim()` leer ist;
  die Begründung nach Trimmen leer ist. `buildRefusalProposal`:
  - `refusal_no_claim`: `{ answerKind: 'refusal_no_claim', text, refusalJustification }`, **ohne** `refusalGroundId` (sonst
    422), auch wenn im Zustand noch ein Grund steht;
  - `refusal_with_ground`: zusätzlich `refusalGroundId`;
  - Felder getrimmt, optionale Felder nur gesetzt, wenn vorhanden (`exactOptionalPropertyTypes`).
- **Schreiben über `run` mit `onProblem` (Lesebefund 4).** `run` in `answers/Page.tsx` erhält einen optionalen vierten
  Parameter `onProblem?: (error: unknown, stillShown: () => boolean) => boolean`. Er wird im `catch` **vor** der bisherigen Behandlung gerufen; gibt er
  `true` zurück, ist die Abweisung behandelt: **kein Toast, kein „Stand veraltet“**; die Sperre fällt und `reload()` läuft wie
  bisher. Alle bisherigen Aufrufer übergeben nichts und verhalten sich unverändert. Der Verweigerungsdialog übergibt:
  - 409 mit `ruleId` R-GUARD-09 → `true`; Meldung im Dialog `answers.refusal.error.guard09` mit Regel-id (`toast.rule`, D5),
    `role="alert"`; Eingaben bleiben. Die Demo meldet so auch eine Begründung, die erst nach Trimmen leer ist;
  - 422 → `true`; Meldung `answers.refusal.error.invalid`, `role="alert"`; Eingaben bleiben. Der Dienst meldet auch eine
    leere Begründung als 422 (044b „Hinweise 045“);
  - 412 → schließt den Dialog und gibt `false` zurück: Es folgt die vorhandene 412-Behandlung („Stand veraltet“ über dem
    Detail bzw. Toast mit Nummer). Der Rückruf schließt **nur**, wenn die Frage des Schreibvorgangs noch gezeigt wird: `run`
    übergibt dem Rückruf dafür ihr `stillShown()` (Signatur `onProblem?: (error: unknown, stillShown: () => boolean) =>
    boolean`), und der Rückruf ruft `if (stillShown()) setDialog(null)`; dieselbe Prüfung, die `run` heute vor
    `setDialog(null)` im Erfolgspfad und vor `setStaleFor` macht (010d, Ziel 3);
  - alles andere (403, 409 mit anderer Regel, Netz) → `false`: Toast wie heute; der Dialog bleibt offen.
  Idempotenz, `If-Match` (`etagOf(question.version)`), Sperre gegen Doppelklick und Neulesen laufen wie bei `draftAnswer`.
- **Nach dem Erfolg** schließt der Dialog (vorhandener Pfad in `run`); der Fokus geht auf die neue Versionskarte
  (Entscheidung 5, Fokusziel `'version'`).
- **Kein Angebot auf Podiumsfragen.** R-GUARD-03 hält es aus `_actions`; die Oberfläche prüft den Antwortpfad nicht selbst.

### 4. Rückgabedialoge (SG2; 044a Eigentümerfrage 4, offener Unterpunkt; Lesebefund 15)

Trägt **irgendeine Version** im gelesenen Datensatz der Frage, auf die der Dialog wirkt, eine `refusalJustification`
(`carriesJustification`), zeigt der Rückgabedialog über dem Feld den Hinweis `answers.return.refusalWarning`,
`role="note"`, mit dem Feld über `aria-describedby` verknüpft. Umsetzung: `ReasonDialog` erhält eine optionale Eigenschaft
`note`.

**Bühne, andere Regel (Entscheidung des Orchestrators, 03.10.2026):** Der Rückgabedialog in `stage/Page.tsx` zeigt denselben
Hinweis bei **jeder Verweigerung**, gleich welcher Art: wenn die freigegebene Version (`approvedAnswer`) der Frage, auf die
er wirkt, `refusalKindOf(...) !== 'answer'` hat. Grund: `getStage` entfernt die Begründung für jeden Leser (044a §6), die
Regel der Beantwortung griffe dort nie, und wer auf der Bühne zurückgibt (`approver`, `moderation`, `podium`), kann die
Begründung aus der Beantwortung kennen. Umsetzung als reine Hilfe `stageReturnNeedsWarning(question)` in `stage/lib.ts`.

Folgen, ausdrücklich gewollt:
- In der Beantwortung sieht den Hinweis nicht, wer die Begründung nicht lesen kann (etwa `moderation`); er kann sie dort
  auch nicht weitertragen. Auf der Bühne sieht ihn jeder, der bei einer Verweigerung zurückgibt.
- Bei einer gewöhnlichen Antwort erscheint der Hinweis in keinem der beiden Dialoge (D1: ein Hinweis, der immer steht, wird
  überlesen).
Keine Prüfung des Inhalts, keine Maskierung des Rückgabegrunds (Eigentümer mit Recht).

### 5. Verweigerung im Beantwortungsdetail (`QuestionDetail.tsx`, `WorkList.tsx`)

- **Versionskarte.** Eine Verweigerungsversion trägt neben dem Versionsbadge das Badge `answers.refusal.kind.noClaim` bzw.
  `answers.refusal.kind.withGround` (Tönung danger, nur als Badge, D4). Aufgeklappt:
  - der Wortlaut unter `answers.refusal.text.label`;
  - bei `refusal_with_ground` der Grund nach `groundStatus` (Titel oder id mit `ground.unknown`), Badge „ungeprüft“, wenn
    `unverified`;
  - bei `changed` auf der **letzten** Version der Hinweis `answers.refusal.ground.changed`. Er ist eine Tatsache, kein Recht;
    R-GUARD-11 hält die Freigabe ohnehin auf;
  - die Begründung unter `answers.refusal.justification.label` **nur, wenn `refusalJustification` im gelesenen Datensatz
    steht**. Die Oberfläche fragt dafür nie ein Recht oder eine Rolle ab; der Kern entscheidet (044a §6).
- **Freigabe der Verweigerung.** Schaltfläche `answers.refusal.approve.label`, nur wenn `_actions` `question.refuse.approve`
  enthält. `{ kind: 'refuse_approve', version }`, `api.approveRefusal(id, version, opts)` über `run`. In der Kette der
  primären Aktion steht sie an der Stelle von `approve` (beide schließen sich über R-GUARD-12/13 aus).
- **Fokus nach Aktion (takt-008; Lesebefund 14).** `stepTaken.target` erhält den Wert `'version'`
  (`'approval' | 'legal' | 'version'`). Der Effekt prüft in dieser Reihenfolge:
  1. `'legal'` und neuer Datensatz → Rechtsfreigabeblock (unverändert);
  2. `'version'` und neuer Datensatz → Versionskarte der neuen letzten Version (Kopfzeilen-Schaltfläche der Karte; die
     Karte ist aufgeklappt, `latest` wird wie heute in `open` aufgenommen);
  3. sonst Fokus auf `<body>` → Freigabeblock (unverändert; „Verweigerung freigeben“ nutzt `'approval'`).
  `'version'` setzt die Seite beim Öffnen des Verweigerungsdialogs nicht; gesetzt wird es im Erfolgspfad
  (`onDone` von `run`), über eine Rückmeldung an `QuestionDetail` (Eigenschaft oder Zähler, wie `draftResetToken`).
- **Antwortentwurf über einer Verweigerung** (R-TRANS-03 unverändert, 044a Eigentümerfrage 6 Standard): Der Editor bleibt
  angeboten, wo `_actions` `answer.draft` enthält; ist die letzte Version eine Verweigerung, steht über ihm
  `answers.refusal.editorHint`.
- **Arbeitsliste.** Eine Zeile, deren letzte Version eine Verweigerung ist, trägt das kleine Badge `answers.refusal.badge`
  neben dem Status (nur, wenn die Listeneinträge Versionen tragen; Vor-dem-Bau-Punkt 3). Keine neue Filterachse.
- **Kein Vermerk der Rechtsfreigabe.** Sein Fehlen ist gewollt (044a §6); nichts ersetzt ihn.

### 6. Bühne (`stage/Podium.tsx`, `stage/lib.ts`)

- Ist die freigegebene Version (`approvedAnswer`) eine Verweigerung, zeigt die Bühne in der Zeile von `stage.answer.label`
  **ein Kennzeichen je Art** (Lesebefund 7), Badge danger, aus zwei Metern lesbar (D10):
  - `refusal_no_claim` → `stage.refusal.marker.noClaim` („Kein Auskunftsanspruch“);
  - `refusal_with_ground` → `stage.refusal.marker.withGround` („Auskunft wird verweigert“), darunter `stage.refusal.ground`
    (Grund: Titel, oder id nach `groundStatus`) mit Badge „ungeprüft“, wenn `unverified`.
  Darunter in Bühnengröße (24 px) der Wortlaut `text`, der vorgelesen wird. Dieselben Kennzeichen in der Vorschau
  (`stage-next-preview`, Vorschaudialog) und das Badge `answers.refusal.badge` in den Zeilen der Warteschlange.
- **Begründung auf der Bühne nie**, auch nicht, wenn ein Objekt sie trüge: `Podium.tsx` liest das Feld
  `refusalJustification` nicht (Test 7). Der Kern liefert es dort ohnehin für niemanden.
- Bedienung unverändert: Leertaste „Vorgelesen, weiter“, `R` zurückgeben (D7, D10). Keine neue Taste.

### 7. Historie (`history/eventSummary.ts`, `history/Timeline.tsx`, `history/Page.tsx`, `i18n/labels.ts`)

- **`AnswerDrafted` mit Verweigerungsart:** Bezeichnung `event.AnswerDrafted.refusal` („Verweigerung vorgeschlagen“) statt
  „Antwortentwurf erstellt“; Zusammenfassung: Version, dann `history.payload.refusal.noClaim` bzw.
  `history.payload.refusal.withGround` mit dem **Titel aus dem Schnappschuss** `payload.answer.refusalGround.title`
  (Katalogdatum zum Zeitpunkt des Vorschlags; nie der aktuelle Katalog).
- **`QuestionApproved` einer Verweigerungsversion:** Bezeichnung `event.QuestionApproved.refusal` („Verweigerung
  freigegeben“), aber **nur**, wenn das `AnswerDrafted` derselben Frage und Version mit Verweigerungsart in den geladenen
  Ereignissen steht. `SummaryContext` erhält `refusalVersions: ReadonlySet<string>` (Schlüssel `<subjectId>:<version>`),
  gebildet in `history/Page.tsx` aus den geladenen Ereignissen. Fehlt der Vorschlag (Paginierung, takt-038), bleibt die
  gewöhnliche Bezeichnung mit Version.
- **Bezeichnungsfunktion.** `labels.ts` erhält `eventLabel(t, event, context)` (wählt die Verweigerungsbezeichnung oder fällt
  auf `eventTypeLabel` zurück); `i18n/index.ts` exportiert sie zusätzlich. `Timeline.tsx` nutzt sie.
- `QuestionLegalCleared` unverändert (Vermerk fehlt gewollt). Eine Begründung erscheint in keiner Zeile; `eventSummary`
  liest `payload.pii` nicht (Test 8).

### 8. Sprache, Inhalte, Glossar

- Katalogtitel, Bausteine und `citation` sind Inhaltsdaten in Deutsch (E21) und erscheinen auch in der englischen Oberfläche
  deutsch. Alle Beschriftungen, Badges, Vermerke und Meldungen gehen durch das Wörterbuch (R10).
- Hausvokabular (R9, D6): Verweigerung · kein Auskunftsanspruch, Verweigerung · Grund aus Katalog, Verweigerungsgrund,
  Formulierungsbaustein, Begründung, Rechtsfreigabe, Freigabe, Bühne, Einzelfrage. Keine Rollennamen in Texten; der
  Leserkreis der Begründung wird über die Tätigkeit beschrieben.
- **Glossar** (`docs/glossar.md`, vier Zeilen nach „Verweigerung“):
  - „Verweigerung · kein Auskunftsanspruch“ / „Refusal · no right to information“ / `answerKind: refusal_no_claim` /
    verboten: „Pfad A“ (ist der Antwortpfad `podium`, Zeile 20), „Verweigerungspfad A“ in der Oberfläche;
  - „Verweigerung · Grund aus Katalog“ / „Refusal · ground from catalogue“ / `answerKind: refusal_with_ground` / verboten:
    „Pfad B“ (ist `fast_track`, Zeile 21), „Verweigerungspfad B“ in der Oberfläche;
  - „Verweigerungsgrund“ / „Refusal ground“ / `refusalGroundId`, Katalog `packages/domain/src/refusalGrounds.ts`;
  - „Formulierungsbaustein“ / „Template wording“ / `stageText`, ungeprüft bis 076 (E15).

### 9. Kürzel „(E15)“ im Vermerk (Lesebefund 18)

Der Vermerk lautet wörtlich „Formulierungsbaustein, ungeprüft (E15)“, weil 044a („Hinweise 045“, Architekten-Stichprobe L3)
ihn so vorgibt. „E15“ ist die Registernummer der offenen Rechtsprüfung des Katalogs; sie lässt Recht und Review die Stelle
zurückverfolgen. Für die Person am Pult ist das Kürzel ohne Bedeutung, schadet aber nicht und fällt mit 076 weg (dann ist
`verified: true`, der Vermerk erscheint nicht). **Entscheidung: bleibt im Text, in de und en.** Alternative: ohne Kürzel,
< 0,1 AStd, braucht eine Änderung des 044a-Wortlauts durch den Orchestrator.

### 10. i18n-Schlüssel (29 je Sprache; Paritätstest (f) 524 → 553)

| Modul | Schlüssel | de | en |
|---|---|---|---|
| answers | `answers.refusal.body` | Die Verweigerung wird eine neue Version und geht direkt in die Prüfung. Danach braucht sie die Rechtsfreigabe und die Freigabe durch eine dritte Person. | The refusal becomes a new version and goes straight to review. It then needs legal clearance and approval by a third person. |
| answers | `answers.refusal.kind.label` | Art der Verweigerung | Kind of refusal |
| answers | `answers.refusal.kind.noClaim` | Verweigerung · kein Auskunftsanspruch | Refusal · no right to information |
| answers | `answers.refusal.kind.withGround` | Verweigerung · Grund aus Katalog | Refusal · ground from catalogue |
| answers | `answers.refusal.ground.label` | Verweigerungsgrund | Refusal ground |
| answers | `answers.refusal.ground.placeholder` | Grund wählen | Choose a ground |
| answers | `answers.refusal.ground.loading` | Katalog der Gründe wird geladen … | Loading the catalogue of grounds … |
| answers | `answers.refusal.ground.failed` | Katalog der Gründe nicht lesbar. Eine Verweigerung mit Grund aus Katalog ist gerade nicht möglich; „kein Auskunftsanspruch“ bleibt möglich. | The catalogue of grounds cannot be read. A refusal with a ground from the catalogue is not possible right now; “no right to information” remains possible. |
| answers | `answers.refusal.ground.unverified` | ungeprüft | unverified |
| answers | `answers.refusal.ground.citation` | Rechtsbezug | Legal reference |
| answers | `answers.refusal.ground.unknown` | Grund {id} nicht im geladenen Katalog | Ground {id} not in the loaded catalogue |
| answers | `answers.refusal.ground.changed` | Grund im Katalog seit dem Vorschlag geändert; bitte neu vorschlagen. | Ground changed in the catalogue since the proposal; please propose again. |
| answers | `answers.refusal.text.label` | Wortlaut für die Bühne | Wording for the podium |
| answers | `answers.refusal.text.marker` | Formulierungsbaustein, ungeprüft (E15) | Template wording, unverified (E15) |
| answers | `answers.refusal.justification.label` | Begründung (intern) | Justification (internal) |
| answers | `answers.refusal.justification.help` | Nur, was für die Entscheidung nötig ist; keine Namen Dritter. Sichtbar nur für alle, die Verweigerungen vorschlagen oder freigeben dürfen; nie auf der Bühne. | Only what the decision needs; no names of third parties. Visible only to those who may propose or approve refusals; never on the podium. |
| answers | `answers.refusal.error.guard09` | Begründung fehlt. Bei „Grund aus Katalog“ ist auch der Grund Pflicht. | Justification missing. With “ground from catalogue” a ground is required too. |
| answers | `answers.refusal.error.invalid` | Eingabe abgewiesen: Pflichtfeld leer, Text zu lang oder Grund nicht im Katalog. | Input rejected: required field empty, text too long or ground not in the catalogue. |
| answers | `answers.refusal.approve.label` | Verweigerung freigeben (Version {version}) | Approve refusal (version {version}) |
| answers | `answers.refusal.editorHint` | Ein neuer Antwortentwurf verdrängt die Verweigerung und braucht erneut Rechtsfreigabe und Freigabe. | A new answer draft supersedes the refusal and needs legal clearance and approval again. |
| answers | `answers.refusal.badge` | Verweigerung | Refusal |
| answers | `answers.return.refusalWarning` | Keine Begründung in den Rückgabegrund: Er ist für alle sichtbar, die die Frage lesen. | No justification in the return reason: everyone who reads the question can see it. |
| stage | `stage.refusal.marker.noClaim` | Kein Auskunftsanspruch | No right to information |
| stage | `stage.refusal.marker.withGround` | Auskunft wird verweigert | Information is refused |
| stage | `stage.refusal.ground` | Grund: {title} | Ground: {title} |
| history | `history.payload.refusal.noClaim` | Verweigerung · kein Auskunftsanspruch | Refusal · no right to information |
| history | `history.payload.refusal.withGround` | Verweigerung · Grund aus Katalog: {title} | Refusal · ground from catalogue: {title} |
| shell | `event.AnswerDrafted.refusal` | Verweigerung vorgeschlagen | Refusal proposed |
| shell | `event.QuestionApproved.refusal` | Verweigerung freigegeben | Refusal approved |

Summe: answers 22, stage 3, history 2, shell 2 = **29**. Die Bühne nutzt `answers.refusal.badge`,
`answers.refusal.ground.unverified` und `answers.refusal.ground.unknown` mit (wie sie heute `answers.approval.sealed` nutzt).
Die Texte darf der Bau glätten; die Zahl ändert er nur mit Begründung im Bericht.

## Nicht-Ziele

- Keine Änderung an `packages/contract`, `packages/domain`, `apps/api`, Seed, Rechten, Übergangstabelle oder Maskierung.
- Keine Änderung an `.github/workflows/**` (auch nicht am Timeout von `e2e-http`; Vor-dem-Bau-Punkt 6).
- Keine Untergründe für `refusal_no_claim` (044c), keine Prüfliste (059), kein Export und keine Niederschrift-Anlage (051),
  keine Zähler (053, 087), kein `correctionOpen` (046), keine Rechtsfreigabe-Sicht (059).
- Keine Verweigerung auf Podiumsfragen (044a Eigentümerfrage 5, Standard nein).
- Kein Filter „nur Verweigerungen“ in der Arbeitsliste, keine Suche nach Grund.
- Keine Lesefreigabe des Rechtsfreigabe-Vermerks (044a Eigentümerfrage 4).
- Keine 422 für `draftAnswer` mit Verweigerungsfeldern (044b Eigentümerfrage 2, Standard 200).
- Keine Änderung an bestehenden Szenarien außer der Reihenfolge im Projekt `http`; keine Zusicherung wird geschwächt.
- Keine Politur aus `docs/folgeliste.md`.

## Files allowed

- `apps/web/src/api/useRefusalGrounds.ts` (neu), `apps/web/src/api/useRefusalGrounds.test.ts` (neu)
- `apps/web/src/features/answers/refusal.ts` (neu), `apps/web/src/features/answers/refusal.test.ts` (neu)
- `apps/web/src/features/answers/RefusalDialog.tsx` (neu), `apps/web/src/features/answers/RefusalDialog.test.tsx` (neu)
- `apps/web/src/features/answers/QuestionDetail.test.tsx` (neu)
- `apps/web/src/features/answers/{ActionDialogs,QuestionDetail,Page,WorkList,AnswerEditor}.tsx`,
  `apps/web/src/features/answers/{lib,lib.test}.ts` (in `Page.tsx` außer der Verdrahtung nur der optionale Parameter
  `onProblem` von `run`)
- `apps/web/src/features/stage/{Page,Podium,Podium.test}.tsx`, `apps/web/src/features/stage/{lib,lib.test}.ts`
- `apps/web/src/features/history/{eventSummary,eventSummary.test}.ts`, `apps/web/src/features/history/{Timeline,Timeline.test}.tsx`
- `apps/web/src/features/history/Page.tsx` (nur `refusalVersions` im `SummaryContext`)
- `apps/web/src/i18n/{answers.de,answers.en,stage.de,stage.en,history.de,history.en,shell.de,shell.en,labels,parity.test}.ts`
- `apps/web/src/i18n/index.ts` (nur der Export von `eventLabel`)
- `apps/web/e2e/045-verweigerung.spec.ts` (neu), `apps/web/e2e/support/e2e-texts.ts` (nur neue Texte)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`: die neue Datei eintragen)
- `scripts/e2e-http-031.test.mjs` (nur `SHARED_FILES` und `HTTP_ORDER`: die neue Datei an ihrer Pfadstelle)
- `docs/evidence/045-*.png`
- `docs/glossar.md` (nur die vier Zeilen aus Entscheidung 8)
- `docs/slices/045-verweigerung-oberflaeche.md`

## Ausdrücklich nicht erlaubt

`packages/**`, `apps/api/**`, `apps/web/src/api/{http,liveStore,actor}.ts`, `apps/web/src/components/**` (ein fehlendes
Bauteil wird in der Ansicht gebaut oder gemeldet), `.github/**`, fremde e2e-Dateien, `docs/produktplan-beta.md` (Hinweise an
den Orchestrator unten), `docs/folgeliste.md` außer über das Review.

## Vor dem Bau prüfen

1. `api.listRefusalGrounds()` ist im Projekt `in-process` für `podium` (nur `stage.read`) lesbar; sonst zeigt die Bühne die
   id (Entscheidung 1), und der Bericht nennt es.
2. Ein `getQuestionHistory` über HTTP liefert `payload.answer.refusalGround` und `answerKind` (044b, Maskierung lässt sie
   stehen). Fehlt etwas: anhalten und melden (kein Vertragsschritt in dieser Scheibe).
3. Ob `listQuestions` die Versionen in der Arbeitsliste enthält; sonst entfällt das Badge dort (Entscheidung 5), und der
   Bericht nennt es.
4. Welche Fragen `abnahme.spec.ts` und `080-sprecher-zustand.spec.ts` im Projekt `http` verwenden, und wie viele
   Textpfad-Fragen im Seed in `assigned` mit `question.refuse.propose` für `coordination` bzw. `legal` verfügbar sind. Die
   Datei braucht je Lauf zwei (E1, E3); im Projekt `in-process` mit `--repeat-each=3` beginnt jede Wiederholung mit frischem
   Demo-Zustand (eigener Browser-Kontext).
5. Ob die Testpersonen im Projekt `http` für `coordination`, `legal`, `approver` und `podium` verschiedene Akteur-ids haben
   (Vier-Augen und R-GUARD-14 brauchen drei verschiedene ids; `support/roles.ts`, Setup 031a).
6. **Laufzeit `e2e-http` (Lesebefund 8).** Die Dauer des Schritts `scripts/e2e-http-031.mjs` (Timeout 9 min) aus den letzten
   drei grünen Läufen von `e2e-http` lesen (`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`, Felder `steps[].started_at`
   und `completed_at`) und die Mehrzeit der neuen Datei schätzen: Zahl der Rollenwechsel × gemessene Wechselzeit (Zeilen
   `[timing] switch to …` im Log) plus rund 1 s je Schreibschritt. **Liegt Ist plus Schätzung über 9 min, anhalten und
   melden**; der Bau ändert den Workflow nicht. Ist und Schätzung stehen im Bericht.
7. Welcher Einheit die Expert-Testperson in beiden Projekten zugeordnet ist (Seed bzw. Setup 031a; Name als Konstante
   `EXPERT_UNIT` für `findRefusableQuestion`) und ob dort eine Textpfad-Frage in `assigned` liegt, die keine Nachfolgedatei
   nutzt. Fehlt sie im Projekt `http`, anhalten und melden. Bestätigen, dass `answer.draft` für `expert` auf einer
   `in_review`-Frage der eigenen Einheit in `_actions` steht, **ohne** vorherige Inanspruchnahme (`question.claim` ist kein
   Guard von R-TRANS-03); stimmt das nicht, prüft E2 nur Schaltfläche und Begründung und meldet die Abweichung.

## Tests zuerst (rot, dann grün)

Jeder Test steht vor der Änderung und ist rot (Ausgabe im Bericht), danach grün.

**Unit (Vitest)**

1. `refusal.test.ts`, `refusalKindOf`/`latestIsRefusal`/`carriesJustification`: ohne `answerKind` → `answer`; beide Arten
   erkannt; keine Version → nicht Verweigerung; Begründung an einer älteren Version → `carriesJustification` wahr.
2. `refusal.test.ts`, `groundStatus` mit allen vier Zeilen der Tabelle aus Entscheidung 1: `ready` gleicher Hash, `ready`
   anderer Hash, `ready` fehlender Eintrag (`unverified` und `changed` wahr), `loading` und `failed` (`unverified` wahr,
   `changed` falsch); dazu `ready` mit `verified: true` → `unverified` falsch.
3. `refusal.test.ts`, `buildRefusalProposal`: `refusal_no_claim` ohne `refusalGroundId`, auch wenn im Zustand ein Grund
   steht; `refusal_with_ground` mit id; Text und Begründung getrimmt; **der Vermerk steht in keinem Feld** (de und en
   geprüft); keine Schlüssel mit `undefined`.
4. `refusal.test.ts`, `nextRefusalForm`: leeres Feld + Grund → Baustein, `fromTemplate` wahr; Feld = voriger Baustein + neuer
   Grund → neuer Baustein; getippter Text + Grund → unverändert; **unveränderter Baustein + Wechsel zu `refusal_no_claim` →
   Feld leer, `fromTemplate` falsch**; **bearbeiteter Baustein + Wechsel zu `refusal_no_claim` → Text bleibt, `fromTemplate`
   wahr**; Feld geleert → `fromTemplate` falsch; Wechsel zurück mit leerem Feld → erneut vorbefüllt.
5. `refusal.test.ts`, `refusalProblemKey`: 409 R-GUARD-09 → `guard09`; 422 → `invalid`; 409 R-GUARD-11, 412, 403 →
   `undefined`.
6. `RefusalDialog.test.tsx` (statisch gerendert wie `Podium.test.tsx`). Weil ein statisches Rendern nichts auswählen kann,
   erhält `RefusalDialog` eine optionale Eigenschaft **`initialForm?: RefusalForm`** (nur für Tests; die Seite übergibt sie
   nie, Standard ist das leere Formular; Kommentar am Prop). Die Fälle mit gewähltem Grund, Vorbefüllung und Vermerk rendern
   mit `initialForm` aus `nextRefusalForm` (also über denselben Zustandsweg wie die Oberfläche). Fälle: Absenden gesperrt ohne Art; `refusal_with_ground`
   ohne Grund gesperrt; ohne Begründung gesperrt; der Vermerk steht außerhalb des `<textarea>` und ist über
   `aria-describedby` verknüpft; Badge und Vermerk bei `verified: false`; **mit einem Katalog `verified: true` weder Badge
   noch Vermerk** (Lesebefund 10); Katalog `loading` → Ladezeile, `failed` → Meldung, und in beiden Fällen ist
   `refusal_no_claim` vollständig ausfüllbar und absendbar (Lesebefund 12); Meldungen 409/422 mit `role="alert"`.
7. `Podium.test.tsx`: Kennzeichen `marker.noClaim` bei `refusal_no_claim`, `marker.withGround` mit Grund bei
   `refusal_with_ground`; **ein Datensatz mit `refusalJustification` rendert den Begründungstext nicht**; bei einer
   gewöhnlichen Antwort kein Kennzeichen.
8. `eventSummary.test.ts`: `AnswerDrafted` `refusal_with_ground` → „Verweigerung vorgeschlagen“ mit Titel aus dem
   Schnappschuss, auch wenn der aktuelle Katalog einen anderen hätte; `refusal_no_claim` ohne Grund; `QuestionApproved` mit
   passendem Eintrag in `refusalVersions` → „Verweigerung freigegeben“, ohne ihn → gewöhnliche Bezeichnung; ein Ereignis mit
   `pii.refusalJustification` erscheint in keiner Zusammenfassung.
9. `QuestionDetail.test.tsx` (statisch gerendert): primäre Aktion bei `question.refuse.approve` ist die Freigabe der
   Verweigerung; „Verweigerung vorschlagen“ ist nie primär; Begründung nur gerendert, wenn sie im Datensatz steht.
10. `useRefusalGrounds.test.ts`: lädt einmal je Akteur, lädt neu nach Akteurwechsel (Vergleich über `id`), `failed` bei
    Abweisung ohne Toast.
11. `lib.test.ts` oder `refusal.test.ts`, `onProblem` in `run` (über eine herausgelöste reine Hilfe, etwa
    `settleProblem(error, onProblem)` → `'handled' | 'stale' | 'toast'`): 409 R-GUARD-09 und 422 mit Dialog → `handled`, **kein
    Toast**; 412 → `stale`; 403 → `toast`; ohne `onProblem` unverändertes Verhalten.
12. `parity.test.ts` (f): 553 je Sprache.
13. `stage/lib.test.ts`, `stageReturnNeedsWarning`: freigegebene Version `refusal_no_claim` → wahr; `refusal_with_ground` → wahr;
    jeweils **ohne** `refusalJustification` im Datensatz (wie `getStage` ihn liefert); gewöhnliche Antwort → falsch; Podiumsfrage
    ohne Version → falsch.

**Playwright, `apps/web/e2e/045-verweigerung.spec.ts`, Projekte `in-process` und `http`**

**Aufbau und Isolation (Lesebefund 9).**
- Die Datei ist ein `test.describe.serial('045 …')`-Block. Jeder Test bringt seine Vorbedingung selbst mit; kein Test
  verlässt sich auf den Browser-Zustand eines anderen. Gemeinsam ist nur eine Hilfe in der Datei,
  **`findRefusableQuestion(page, role, opts?: { unitName?: string; exclude?: readonly string[] })`** (überall diese eine
  Signatur): wechselt per `asRole(page, role)`, filtert `answers-filter-status-assigned`; ist `opts.unitName` gesetzt, wählt
  er zusätzlich im Einheitenfilter `answers-filter-unit` die Einheit mit diesem Namen (die Einheit der Expert-Testperson aus
  Vor-dem-Bau-Punkt 7, als Konstante in der Datei mit Quelle). Dann wählt er die erste Zeile, deren Detail `answer-refuse`
  zeigt, deren letzte Version keine Verweigerung ist und deren Nummer nicht in `opts.exclude` und nicht in der
  Ausschlussliste aus Vor-dem-Bau-Punkt 4 steht (Muster `021c-rechtsfreigabe.spec.ts`), und gibt die Nummer zurück. Nie eine
  feste Nummer.
- Im Projekt `in-process` beginnt jeder Test mit frischem Demo-Zustand; `--repeat-each=3` ist damit unabhängig.
- Im Projekt `http` bleibt die Datenbank über Dateien hinweg bestehen. **Endzustand nach der Datei**, als Kommentar am
  Dateikopf und im Bericht:
  - Frage aus E1: zurückgegeben nach `answer_drafted` (Verweigerung als letzte Version, Rückgabegrund „e2e 045“), **nicht auf
    der Bühne**; die Bühne trägt danach genau die Fragen, die sie vor der Datei trug, in derselben Reihenfolge (E1 prüft das
    über `stage-queue` vor und nach);
  - Frage aus E3: `in_review` mit einer Verweigerung „kein Auskunftsanspruch“;
  - E4b, E6, E7, E9 schreiben nichts.
  Die CI startet `e2e-http` mit frischer Datenbank, also einmal je Lauf; `--repeat-each` gilt nur lokal für `in-process`.

**Fälle**

- **E1 Grund aus Katalog, ganzer Weg @screenshot** (ein Test mit `test.step`s). `coordination` öffnet die Frage aus
  `findRefusableQuestion(page, 'coordination', { unitName: EXPERT_UNIT })` (eigene Einheit der Expert-Testperson, für den
  Expert-Teil von E2): Dialog; Absenden gesperrt ohne Art und bei „Grund aus Katalog“ ohne Grund; Grund wählen →
  Wortlaut = `stageText`, Vermerk neben dem Feld und **nicht** im Feldwert, Badge „ungeprüft“; Begründung tippen (eindeutiger
  Testsatz); Screenshot Dialog de/en; absenden → Status „in Prüfung“, Versionskarte mit „Verweigerung · Grund aus Katalog“,
  Grund und Begründung, **Fokus auf der Versionskarte**. Jetzt der **Expert-Teil von E2** (Status `in_review`, letzte
  Version die Verweigerung). `approver`: „Verweigerung freigeben“ fehlt (keine Rechtsfreigabe).
  `legal`: rechtlich freigeben. `approver`: „Verweigerung freigeben (Version n)“ vorhanden, „Freigeben“
  fehlt (R-GUARD-12); Begründung im Detail sichtbar; freigeben; Screenshot Detail de/en; Warteschlange der Bühne merken; auf
  die Bühne stellen. `podium`: die Frage erscheint in der Warteschlange mit Badge; Vorschau öffnen → Kennzeichen „Auskunft
  wird verweigert“, Grund, Wortlaut; Screenshot Bühne de/en (Vorschau oder aktuelle Frage, je nachdem, wo sie steht);
  Begründungssatz **nicht** im DOM der Bühne. Abschluss: E4a.
- **E2 Leserkreis** (im selben Test wie E1; zwei Stellen).
  - **Expert-Teil, zwischen Vorschlag und Rechtsfreigabe** (Nachprüfung N1): Die Frage ist `in_review`, die letzte Version
    ist die Verweigerung; R-TRANS-03 erlaubt `answer.draft` dort (aus `staged` nicht, transitions.ts:396-398). `expert`:
    zuerst zusichern, dass die Frage in der Arbeitsliste steht und ihr Detail öffnet (sonst prüfte der Fall nichts), dann
    keine Schaltfläche „Verweigerung vorschlagen“, kein Begründungssatz im Detail und in der Historie, und der Antwort-Editor
    ist da mit `answers.refusal.editorHint`. **Nur ansehen, nichts schreiben:** kein Entwurf, kein Inanspruchnehmen.
    `question.claim` ist **keine** Vorbedingung von `answer.draft` (R-TRANS-03 hat nur den Guard `isTextTrack`; die
    Inanspruchnahme ist Anwesenheitsanzeige, `api.ts:1251-1277`, und die Oberfläche ruft `claimQuestion` nicht); der Editor
    steht also allein aus `_actions`, und der Datenbankstand bleibt für die folgenden Schritte unverändert.
  - **Nach dem Stellen, vor E4a:** `approver` auf der Bühne: Begründungssatz nicht im DOM; im Beantwortungsdetail derselben
    Frage sichtbar. `moderation`: Begründungssatz weder im Detail noch in der Historie noch auf der Bühne; keine Schaltfläche
    „Verweigerung vorschlagen“.
  **Nicht als e2e geprüft, weil durch die Wahrheitstabelle belegt** (`packages/domain/policy-truth-table.md`, Abschnitt
  „Role × Verweigerung“): `legal` hält nie `question.approve`, „Freigeben“ fehlt dort also immer; die Zeile aus der ersten
  Fassung entfällt.
- **E3 Kein Auskunftsanspruch** (eigener Test). Kein Feld Verweigerungsgrund, kein Vorbefüllen, kein Vermerk; Absenden
  gesperrt ohne Wortlaut oder ohne Begründung; **Wechsel nach Vorbefüllen**: erst „Grund aus Katalog“ mit Grund (Baustein im
  Feld), dann „kein Auskunftsanspruch“ → Feld leer, Vermerk weg; erneut mit Baustein, ein Wort anhängen, dann Wechsel →
  Text bleibt, Vermerk bleibt; Feld leeren → Vermerk weg; eigenen Wortlaut tippen, absenden → „Verweigerung · kein
  Auskunftsanspruch“, Bühnenkennzeichen nicht geprüft (bleibt in Prüfung).
- **E4a Rückgabe mit Hinweis** (Abschluss von E1).
  - **Bühne, nur Projekt `in-process`:** `podium` liest die Fragen vor der Verweigerung vor („Vorgelesen, weiter“), bis sie die
    aktuelle Frage ist; Taste `R` → Hinweis `answers.return.refusalWarning` sichtbar, obwohl die Bühne keine Begründung trägt;
    Escape, nichts geschrieben. Im Projekt `http` übersprungen (`test.skip` mit Grund im Code): Vorlesen fremder Fragen änderte
    den Datenbankstand, auf den `080-sprecher-zustand.spec.ts` und `abnahme.spec.ts` bauen. Dort belegt Test 13 die Regel.
  - **Beantwortung, beide Projekte:** `approver` öffnet die gestellte Verweigerung, Rückgabe: Hinweis sichtbar; Grund
    „e2e 045“; zurückgeben → die Frage verlässt die Bühne (im Projekt `http` Warteschlange gleich der gemerkten).
- **E4b Kein Hinweis ohne Begründung im Datensatz** (eigener Test, schreibt nichts). Rückgabedialog der Beantwortung auf einer
  gewöhnlichen Antwort (`legal`): kein Hinweis; Abbrechen. Im Projekt `in-process` zusätzlich der Rückgabedialog der Bühne
  (`podium`, Taste `R`) auf der aktuellen, gewöhnlichen Frage: kein Hinweis; Escape.
- **E5 Historie** (im Test von E1, nach dem Vorschlag und nach der Freigabe). Zeilen „Verweigerung vorgeschlagen“ mit Grund aus
  dem Schnappschuss und „Verweigerung freigegeben“; kein Begründungssatz auf der Seite.
- **E6 Eingaben je Akteur (090).** `legal` öffnet den Dialog, tippt Wortlaut und Begründung, Wechsel zu einer Rolle mit und
  einer ohne das Recht und zurück: Dialog geschlossen, kein Feld trägt den alten Text (MutationObserver-Muster aus 090).
- **E7 Tastatur (D8).** Dialog vollständig mit Tastatur gegen eine Frage aus `findRefusableQuestion(page, 'legal')`: Tab zur
  Radiogruppe, Pfeile, Auswahl, Felder, Tab bis Absenden; **Absenden hat den Fokus und ist aktiv, wird aber nicht ausgelöst**
  (kein Enter, E7 schreibt nichts). Fokus sichtbar; Escape schließt ohne Schreiben. Das Auslösen per Tastatur ist natives
  Verhalten eines `<button type="submit">` im Formular; der Absendepfad selbst ist durch E1 und Test 5 belegt (Codex P2,
  Nachtrag Orchestrator).
- **E8 axe** ohne serious/critical auf Dialog, Detail und Bühne, de und en (innerhalb von E1).
- **E9 Eingaben je Frage (Lesebefund 3).** `legal`: Dialog auf Frage X öffnen, Art, Grund, Wortlaut, Begründung setzen,
  Abbrechen mit X; Frage Y wählen, Dialog öffnen → **alle Felder leer, keine Art gewählt, kein Vermerk**; zurück zu X, Dialog
  öffnen → ebenfalls leer.

Im Projekt `http` laufen E1–E9 genauso; die Screenshots gehen dort in das Ausgabeverzeichnis (`support/evidence.ts`).
Lokal mit `E2E_HTTP_IDP=none` läuft die Datei nicht (sie braucht Anmeldungen).

**Ersetztes Prüfziel des Plans.** „Pfad B ohne Grund → Aktion fehlt in `_actions`“ ist so nicht baubar: `_actions` gilt je
Frage, R-GUARD-09 ist ohne Nutzlast immer erfüllbar (044a „Hinweise 045“). Ersetzt durch: gesperrtes Absenden ohne Grund
(Test 6, E1) und die Meldungen für 409 R-GUARD-09 und 422 im Dialog ohne zusätzlichen Toast (Test 5, Test 6, Test 11). Die
Meldungen selbst sind im e2e nicht erreichbar, weil die Oberfläche unvollständige Eingaben nicht absendet; sie sind deshalb
auf Unit-Ebene belegt (Lesebefund 11).

## Akzeptanzkriterium

1. Tests 1–13 und E1–E9 vor der Änderung rot (Ausgabe im Bericht), danach grün; E1–E9 im Projekt `in-process` auch mit
   `--repeat-each=3`.
2. Volle Playwright-Suite `in-process` grün (Anzahl nennen), axe ohne serious/critical. Projekt `http` grün im CI-Lauf
   `e2e-http` des PR.
3. Sechs Screenshots in `docs/evidence/` aus dem Projekt `in-process`: `045-dialog-de.png`, `045-dialog-en.png`,
   `045-detail-de.png`, `045-detail-en.png`, `045-buehne-de.png`, `045-buehne-en.png`. Auf dem Dialog-Screenshot sind
   Vermerk und Badge „ungeprüft“ lesbar; auf dem Bühnen-Screenshot steht kein Begründungstext.
4. Kein Rollenname in einem Vergleich in `apps/web/src` (`pnpm role-literals`, `pnpm vocabulary`); kein Literal in
   Komponenten (`pnpm i18n-literals`); Paritätstest 553; kein Oberflächentext enthält „Pfad A“ oder „Pfad B“ für eine
   Verweigerung.
5. `pnpm slice-scope` grün auf dem Branch `claude/slice-045-…`.
6. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Nachweise

- Ausgabe der roten Tests vor der Änderung, Schluss von `pnpm gates`, Playwright-Zahlen.
- `docs/evidence/045-*.png` (sechs Dateien aus `in-process`, Akzeptanzkriterium 3). Das ist der Bildnachweis.
- **Projekt `http`** (Lesebefund 8): der grüne CI-Lauf `e2e-http` des PR, mit **Lauf-ID** und dem **Schluss des Logs**, in
  dem die Zeilen der Fälle aus `045-verweigerung.spec.ts` stehen. Kein Artefakt nötig, keine Workflow-Änderung.
- Laufzeitmessung aus Vor-dem-Bau-Punkt 6 (Ist, Schätzung, tatsächliche Dauer im PR-Lauf).
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
| Baustein wirkt geprüft, Vermerk fehlt oder gerät in den Wortlaut | Vermerk außerhalb des Felds, `fromTemplate`, `buildRefusalProposal` nimmt nur den Feldinhalt | Test 3, 4, 6, E1, E3, Screenshot |
| Baustein bleibt nach Wechsel zu „kein Auskunftsanspruch“ unbemerkt stehen | unveränderter Baustein wird geleert, bearbeiteter behält den Vermerk | Test 4, E3 |
| Katalog nicht geladen, Grund wirkt geprüft oder „geändert“ | `groundStatus` ausfallsicher | Test 2, Test 6 |
| Begründung einer berechtigten Person bleibt nach Wechsel sichtbar | Daten je Akteur (010d), Dialog nur offen montiert mit Schlüssel aus Akteur und Frage | E2, E6, E9 |
| Begründung auf der Bühne | Kern maskiert; `Podium.tsx` liest das Feld nicht | Test 7, E1, E2 |
| Begründung im Rückgabegrund | Beantwortung: Hinweis, wo die Begründung im Datensatz steht; Bühne: Hinweis bei jeder Verweigerung | Test 13, E4a, E4b |
| Fehlermeldung doppelt (Dialog und Toast) | `onProblem` | Test 11 |
| Oberfläche bietet eine Freigabe an, die der Kern abweist | nur `_actions`; Hinweis bei geändertem Katalog | E1 (vor/nach Rechtsfreigabe), Test 2 |
| Historie behauptet eine freigegebene Verweigerung ohne Beleg | Bezeichnung nur mit dem Vorschlag im geladenen Log | Test 8 |
| e2e hinterlässt eine gestellte Verweigerung für die Nachfolger im Projekt `http` | E4a gibt sie zurück, Warteschlange vor/nach verglichen | E1, E4a |
| `e2e-http` überschreitet 9 min | Messung vor dem Bau, Halt bei Überschreitung | Vor-dem-Bau-Punkt 6 |

## Aufwand

Ehrlich geschätzt **3,5 AStd** (Spanne 3,2–4,0) statt 2 laut Plan; nach dem Lesebefund um 0,5 AStd höher:

| Teil | AStd |
|---|---|
| Hilfen `refusal.ts` (`groundStatus` ausfallsicher, `nextRefusalForm`), Hook, Unit-Tests 1–5, 10 | 0,5 |
| `RefusalDialog` mit Vorbefüllen, `fromTemplate`, Vermerk, Katalogzuständen, Sperren; `run` mit `onProblem`, Test 11; Verdrahtung, Fokusziel `'version'` | 0,85 |
| Versionskarte, Freigabe der Verweigerung, Editor-Hinweis, Arbeitslisten-Badge, Rückgabehinweis | 0,35 |
| Bühne (zwei Kennzeichen, Vorschau, Warteschlange, Rückgabehinweis) mit Test 7 und 13 | 0,35 |
| Historie (`refusalVersions`, `eventLabel`) mit Test 8 | 0,25 |
| i18n 29 Schlüssel je Sprache, Parität, Glossar | 0,15 |
| e2e E1–E9 in beiden Projekten, Isolation und Endzustand, Einreihung `http`, Reihenfolge-Pin, Laufzeitmessung | 0,8 |
| Screenshots, axe, Design-Kritik, `pnpm gates`, Bericht, CI-Nachweis | 0,25 |

**Zuschnitt 045b (vorbereitet).** Zeichnet sich ab, dass der Bau über 4,0 AStd geht, committet er nach Entscheidung 1–5
(Katalog, Dialog, Detail, Rückgabe) mit den zugehörigen Unit-Tests und E1 bis zur Freigabe (ohne Bühne), E3, E4b, E6, E7, E9
einen Zwischenstand und meldet. 045b umfasst dann Bühne (Entscheidung 6, Test 7), Historie (Entscheidung 7, Test 8), E1 ab
„auf die Bühne stellen“, E2 (Bühnenteil), E4a, E5 und die Bühnen-Screenshots; Files allowed wie hier, ohne neue Spec-Runde.

## Standards (auf Standard gebaut)

| Standard | Was 045 baut | Kosten einer späteren Änderung |
|---|---|---|
| Vorschlagen ist sekundär, nie primär | Kette der primären Aktion unverändert, Freigabe der Verweigerung ersetzt `approve` | < 0,1 AStd |
| Art ohne Vorauswahl | Radiogruppe leer | < 0,1 AStd |
| Namen nach Inhalt statt „Pfad A/B“ | Entscheidung 2 | Textänderung, < 0,1 AStd |
| Vorbefüllen nur bei Grund aus Katalog, nie über Getipptes; unveränderter Baustein fällt beim Wechsel weg | `nextRefusalForm` | < 0,1 AStd |
| Vermerk bleibt nach Bearbeiten des Bausteins, nur bei `verified === false` | `fromTemplate` | < 0,1 AStd |
| „Ungeprüft“ auch auf der Bühne | Badge am Grund auf der Bühne | < 0,1 AStd (Eigentümer mit Recht) |
| Rückgabehinweis in der Beantwortung nur, wo die Begründung im Datensatz steht; auf der Bühne bei jeder Verweigerung (Orchestrator 03.10.2026) | `carriesJustification`, `stageReturnNeedsWarning` | Beantwortung auch bei jeder Verweigerung: < 0,1 AStd |
| Kürzel „(E15)“ bleibt im Vermerk | Entscheidung 9 | < 0,1 AStd |
| Katalogtexte deutsch auch in en (E21) | keine Übersetzung der Inhalte | Katalogfelder je Sprache: Vertrag und Kern, rund 0,5 AStd |
| „Verweigerung freigegeben“ nur mit Beleg im geladenen Log | `refusalVersions` | Ereignisfeld `answerKind` an `QuestionApproved`: Vertrag und Kern, rund 0,5 AStd |

## Offene Eigentümerfragen

Keine blockiert den Bau.

1. **Risikoklasse.** Standard: hoch nach Leitplanken §4 (Verweigerung, personenbezogene Daten); der Lesebefund vor dem Bau
   ist erledigt. Herabstufen auf mittel (Plan) darf nur der Eigentümer; dann trägt die Spec die Zeile „Herabstufung
   freigegeben von … am …“ im Kopf. Wirkung jetzt nur noch auf die Review-Perspektiven, nicht auf den Aufwand.

## Hinweise an den Orchestrator

- Plan-Eintrag 045 (§5): Risikoklasse „mittel“ → „hoch“ (Spec höher als Plan, kein Herabstufungsfall), Aufwand 2 → 3,5 AStd,
  Lane web-history ergänzen, Nachweis „Pfad B ohne Grund → Aktion fehlt in `_actions`“ durch „Absenden gesperrt, Meldung
  R-GUARD-09 bzw. 422 im Dialog“ ersetzen, Ziel „Pflichtauswahl Pfad A/B“ durch die Namen aus Entscheidung 2. Nicht Teil
  dieser Spec-Änderung.
- 044a verwendet „Verweigerungspfad A/B“; ein Doku-Takt kann in 044a, ADR 0012 und Rechtekonzept auf die Namen aus
  Entscheidung 2 verweisen.
- Die Folgescheiben der Kette setzen auf `features/answers/refusal.ts` auf: 053 zählt Verweigerungen je Art über
  `refusalKindOf`, 059 hängt die Prüfliste an denselben Dialog- und Detailaufbau.

## Hinweise an Folgescheiben

- **059:** Prüfliste einer Verweigerung (Begründung passt zum Grund, Bedingung im Titel erfüllt) neben dem Grund in der
  Versionskarte; derselbe Badge „ungeprüft“.
- **046:** `correctionOpen` und Rückgabe aus `delivered`: der Rückgabehinweis folgt `carriesJustification`.
- **053/087:** Zähldefinition je Art aus `refusalKindOf`, aggregiert, nie je Person.
- **076:** Mit `verified: true` verschwinden Badge und Vermerk ohne Codeänderung (Test 2, Test 6).
- **044c:** Untergründe für „kein Auskunftsanspruch“: die Radiogruppe erhält dort eine Auswahl; `buildRefusalProposal`,
  `nextRefusalForm` und Test 3, 4 ändern sich.

## Bericht (nach Bau ausfüllen)

```
Slice: 045-verweigerung-oberflaeche
Done: Verweigerung vorschlagen (Dialog mit Art, Grund, Wortlaut, Begründung; Vorbefüllen, Vermerk neben dem Feld),
      Versionskarte, Freigabe der Verweigerung, Editor-Hinweis, Arbeitslisten-Badge, Rückgabehinweis (Beantwortung und
      Bühne), Bühnenkennzeichen je Art, Historie „Verweigerung vorgeschlagen/freigegeben“; 29 Schlüssel je Sprache, Glossar.
Evidence: siehe „Nachweise des Baus“ unten; docs/evidence/045-{dialog,detail,buehne}-{de,en}.png
Open: Lauf-ID e2e-http folgt aus dem PR (Platzhalter unten); E4b ist vor der Änderung grün (prüft nur ein Fehlen).
Touched: siehe Bericht an den Orchestrator (Dateiliste = Files allowed, nichts darüber hinaus)
```

### Nachweise des Baus

**Vor-dem-Bau-Prüfungen** (auf `5cbe438`):

1. `listRefusalGrounds()` für `podium` im Projekt `in-process` lesbar: 7 Einträge, alle `verified: false`.
2. `getQuestionHistory` über HTTP liefert `payload.answer.refusalGround` und `answerKind` (belegt durch
   `apps/api/src/__tests__/refusal044b.test.ts`, Zeilen 647–656). Kein Halt.
3. `listQuestions` trägt `answers` je Eintrag: Arbeitslisten-Badge gebaut (am Ende der Textzelle, direkt neben dem Status;
   die Statusspalte ist 116 px breit und trägt nur ein Badge).
4. `abnahme.spec.ts` erfasst eigene Fragen, `080-sprecher-zustand.spec.ts` berührt nur Wortmeldungen: keine Ausschlussliste
   nötig. Im Seed 15 Textpfad-Fragen in `assigned`, alle mit `question.refuse.propose` für `coordination` und `legal`; in
   der Einheit „Finanzen“ (`unit-fin`) vier. 021c verbraucht eine Frage in `in_review`, nicht `assigned`.
5. Projekt `http`: neun synthetische Personen mit je eigener id (`scripts/e2e-http-031.mjs`, `PERSONS`); `in-process`:
   `u-coord-1`, `u-legal-1`, `u-appr-1`, `u-podium` verschieden.
6. Laufzeit `e2e-http`, Schritt „End-to-end http project …“ der letzten drei grünen Läufe mit echtem Lauf:
   37144751699 2:57, 37143017388 3:43, 37142695432 3:26 (Ist höchstens 3:43 von 9:00; Gesamtgrenze der Harness 8:00).
   Die Zeilen `[timing] switch to …` waren nicht lesbar (Log-Download leitet auf einen Blob-Host um, den der
   verfügbare Client nicht aufruft). Schätzung der Mehrzeit: rund 19 Rollenwechsel × höchstens 3 s + 6 Schreibschritte ×
   1 s + Navigation und axe rund 60 s ≈ 2–2,5 min; Ist plus Schätzung ≈ 6,2 min < 8 min < 9 min. Kein Halt.
   Tatsächliche Dauer im PR-Lauf: (folgt aus dem CI-Lauf des PR).
7. Expert-Testperson: `u-exp-fin` (Demo) bzw. Person `expert` mit `unit-fin` (http); Filtername `Finanzen`
   (`EXPERT_UNIT`). Auf einer `in_review`-Frage der Einheit nach einem Verweigerungsvorschlag stehen für `expert`
   `question.claim`, `answer.draft`, `question.read` in `_actions`, ohne vorherige Inanspruchnahme. Kein Halt, E2 wie
   spezifiziert.

**Abweichungen vom Wortlaut der Spec (Bau):**

- Test 6 rendert `RefusalDialog` statisch; der `Dialog` des Bausatzes rendert über ein Portal, das statisch nicht geht.
  Der Test ersetzt ihn per `vi.mock` durch einen Rahmen an Ort und Stelle; `RefusalDialog` selbst ist unverändert. Die
  Meldungen 409/422 rendert der Test über die exportierte Komponente `RefusalProblem` (dieselbe, die der Dialog zeigt).
- Der Hook nimmt die Lesefunktion als Parameter (`useRefusalGrounds(load)`), damit der Test das API-Modul nicht lädt;
  die Seiten übergeben `api.listRefusalGrounds`.
- Rückgabedialog der Bühne: `ReturnTarget` bleibt unverändert (ein bestehender Test pinnt seine Form); der Hinweis wird
  beim Öffnen aus derselben Frage ermittelt und daneben gehalten.
- E4b ist vor der Änderung grün: Der Fall sichert nur das Fehlen eines Hinweises zu, den es vor 045 nicht gab.

**Rote Tests vor der Änderung** (Unit, Auszug): `Test Files 8 failed | 1 passed (9)`, `Tests 17 failed | 74 passed (91)`;
`refusal.test.ts`, `RefusalDialog.test.tsx`, `useRefusalGrounds.test.ts`: „Cannot find module“; Parität „expected 524 to be
553“. e2e `in-process`, je Fall einzeln gegen den Stand ohne Änderung: E1, E3, E6, E7, E9 rot („No refusable assigned
question for …“), E4b grün (siehe oben).

**Grün nach der Änderung:** Vitest `apps/web` 28 Dateien, 555 Tests. Playwright `045-verweigerung.spec.ts` `in-process`
6 passed; mit `--repeat-each=3` 18 passed (2.2m). Volle Suite `in-process` 139 passed (6.9m), axe ohne serious/critical.

**`pnpm gates`:** (folgt)

**Projekt `http`:** CI-Lauf `e2e-http` des PR, Lauf-ID: (Platzhalter, trägt der Orchestrator nach).

**Design-Kritik D1–D10** (Checkliste `docs/design-prinzipien.md`)

| D | ja/nein | Satz |
|---|---|---|
| D1 | ja | Dialog: Titel = Aktion, ein Erklärungssatz, vier Felder in fester Reihenfolge; Versionskarte nennt die Art als Badge neben der Version. |
| D2 | ja | Im Detail eine primäre Aktion (Rechtsfreigabe, Freigabe bzw. „Verweigerung freigeben“, Prüfung); „Verweigerung vorschlagen“ ist nie primär (Test 9); im Dialog nur Absenden primär. |
| D3 | ja | Dialog `lg` im Muster D, Felder auf 16-px-Abständen; das Listen-Badge sitzt am Ende der Textzelle, die Spalten bleiben unverändert. |
| D4 | ja | Danger nur als Badge (Art, Bühnenkennzeichen, Listen- und Warteschlangen-Badge), „ungeprüft“ als Warning-Badge; keine Flächen. |
| D5 | ja | Grund-id in Mono, Versionen wie bisher in Mono. |
| D6 | ja | Katalog laden (Zeile in Feldhöhe), Fehler (`role="status"`, „kein Auskunftsanspruch“ bleibt möglich), leer (Platzhalter); Meldungen 409/422 im Dialog mit Regel-id. |
| D7 | ja | 29 Schlüssel je Sprache (Parität 553), Arten nach Inhalt statt „Pfad A/B“; `pnpm i18n-literals` und `pnpm vocabulary` grün. Katalogtexte deutsch auch in en (E21). |
| D8 | ja | E7: Dialog per Tab, Leertaste und Pfeilen; Absenden fokussiert, aktiv, `:focus-visible`; Escape schließt ohne Schreiben. |
| D9 | ja | Je Zeile eine Prüfung der letzten Version (O(1)); keine neue Abfrage je Zeile; nicht eigens gemessen. |
| D10 | ja | Bühne aus zwei Metern: ein Kennzeichen je Art in 18 px halbfett, Grund darunter, Wortlaut 24 px; ruhige Badges statt Flächen, keine neue Taste. |

## Review findings

**Lesebefund** (frischer Kontext, zu `fa340f2`): 0 blocker, 9 major, 6 minor, 3 nit. Alle eingearbeitet, keiner auf die
Folgeliste (Vorgabe des Orchestrators, 03.10.2026). Entscheidungen des Orchestrators, wo es eine Wahl gab, sind übernommen:

| Nr. | Klasse | Kern | Eingearbeitet in |
|---|---|---|---|
| 1 | major [L] | Wechsel zu „kein Auskunftsanspruch“ nach Vorbefüllen | Entscheidung 3 (`fromTemplate`), Test 4, E3 |
| 2 | major [L] | `groundStatus` ausfallsicher, `changed` nur gegen geladenen Katalog | Entscheidung 1 (Tabelle), Test 2 |
| 3 | major [P][L] | Dialog je Frage zurücksetzen | Entscheidung 3 (nur offen montiert, Schlüssel `${actorId}:${question.id}:refusal`), E9 |
| 4 | major | Meldungen ohne zusätzlichen Toast, 412 schließt | Entscheidung 3 (`onProblem`), Test 11 |
| 5 | major | fehlende Dateien in Files allowed | `history/Page.tsx`, `i18n/index.ts` mit engen Klammern |
| 6 | major [L] | Namen nach Inhalt statt „Pfad A/B“ | Entscheidung 2, 8, i18n, Glossar |
| 7 | major [L] | ein Bühnenkennzeichen je Art | Entscheidung 6, Test 7, Parität 553 |
| 8 | major | Nachweis `http` und Laufzeit | „Nachweise“, Vor-dem-Bau-Punkt 6 |
| 9 | major | e2e-Aufbau, Isolation, Endzustand | „Aufbau und Isolation“, E4a |
| 10 | minor | Vermerk folgt `verified === false` | Entscheidung 3, Test 6 |
| 11 | minor | Meldungstexte; e2e erreicht die Meldungen nicht | i18n `error.guard09`, `error.invalid`; „Ersetztes Prüfziel“ |
| 12 | minor | Lade- und Fehlerzustand des Katalogs im Dialog | Entscheidung 3, zwei Schlüssel, Test 6 |
| 13 | minor | Aufwand | 3,5 AStd (3,2–4,0), Zuschnitt 045b vorbereitet |
| 14 | minor | Fokusziel `'version'` mit Reihenfolge | Entscheidung 5 |
| 15 | minor | Rückgabehinweis nach Begründung im Datensatz | Entscheidung 4 |
| 16 | nit | Zeilenverweis Paritätstest | Befund: `parity.test.ts:164-171` |
| 17 | nit | zwei Rollenzeilen ohne Prüfwert (`legal` „Freigeben fehlt“, `expert`) | E2: `expert` gegen eine Frage der eigenen Einheit mit Vorbedingung; `legal`-Zeile als Invariante der Wahrheitstabelle gestrichen; Vor-dem-Bau-Punkt 7 |
| 18 | nit | Kürzel „(E15)“ | Entscheidung 9 |
| N1 | major (Nachprüfung) | Expert-Teil von E2 lief auf `staged`, wo R-TRANS-03 kein `answer.draft` erlaubt | Expert-Teil zwischen Vorschlag und Rechtsfreigabe (`in_review`); `question.claim` geprüft: keine Vorbedingung, Expert sieht nur an; E2, Vor-dem-Bau-Punkt 7 |
| N1a | Nachprüfung | eine Signatur für `findRefusableQuestion` | `findRefusableQuestion(page, role, opts?: { unitName, exclude })`, Einheit über `answers-filter-unit` und `EXPERT_UNIT` |
| N1b | Nachprüfung | Test 6: wie das statische Rendern einen gewählten Grund erhält | Prop `initialForm` (nur Tests), Zustand aus `nextRefusalForm` |
| N1c | Nachprüfung | `stillShown` im 412-Pfad von `onProblem` | `run` übergibt `stillShown`; Rückruf schließt nur, wenn die Frage noch gezeigt wird |

**Nachtrag des Orchestrators zu Befund 15 (03.10.2026):** Der Rückgabedialog der Bühne zeigt den Hinweis bei jeder
Verweigerung (Entscheidung 4, Test 13, E4a); das Restrisiko aus der vorigen Fassung entfällt. Mehraufwand < 0,1 AStd, im
Aufwand enthalten (Bühne 0,3 → 0,35, Abschluss 0,3 → 0,25; Summe bleibt 3,5 in der Spanne 3,2–4,0).
