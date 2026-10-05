# Scheibe 046 — Nachfragen-Threads (Vertrag, Kern, Dienst, Erfassung, Historie)

**Status:** spec (05.10.2026; gelesen auf `c5990c8`, Vertrag 0.4.4; erster Teil der geteilten Planzeile 046, Zuschnitt im Abschnitt „Teilung und Zuschnitt“; Oberflächenkette der Freigabe-Demo nach Register E57: … 055b → 059 → **046** → 060 → 061 → 041; auf Standard gebaut, E30 offen, E4 betrifft erst 046d). Klasse hoch: Lesebefund der Spec in frischem Kontext vor dem Bau.
**Risikoklasse:** hoch · 2,5 AStd (Spanne 2,0–3,25; Plan 046: mittel · 2 AStd für alle vier Themen der Planzeile; Begründung in „Warum hoch“ und „Aufwand“) · Plan 046: 28.10.2026 (W5), tatsächlich in der Kette E57 nach 059 · Lanes: contract (erster Commit, Architekt); core; service; web-api (nur `http.ts`); web-capture; web-history; web-shell (nur der Ereignisname); e2e; docs (Glossar, DSFA Zeile V3, Bedrohungsmodell)
**Bedrohungsmodell:** berührt T-G1-I-01 (Lesepfade: eine Verknüpfung darf keine Frage außerhalb des Leseumfangs offenlegen), T-G1-E-01 (Schreibvorgang ohne Oberfläche); neuer Missbrauchsfall MF-15 (Abschnitt „Missbrauchsfälle“)
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code, AGENTS.md R6); danach implementierer-backend (Kern, Dienst) und implementierer-oberfläche (Erfassung, Historie, e2e). Design-Kritik D1–D10 vor dem Review. Review in frischem Kontext mit den Perspektiven **Legal** (Nachfrage als Beleg zum Nachfragerecht, keine still entschiedene Rechtsfrage), **Security/Datenschutz** (Lesepfade, keine Auskunft über die Existenz fremder Fragen, keine Personendaten im neuen Ereignis) und **Vertrag** (Anfragefeld, Filter, gebundenes Nutzlastschema, Validator und Kern im Gleichlauf). Nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** neu R-LINK-01 (Bezugsfrage liegt im selben Jahrgang und ist für die erfassende Person lesbar), R-LINK-02 (ein Bezug entsteht nur mit der Erfassung, höchstens einmal je Einzelfrage, und ändert sich nie). Angewandt: R-PERM-01 (`question.capture`), R-PERM-03 (Leseumfang im Filter und in der Ansicht), R-IDEM-01. Keine neue R-TRANS- oder R-GUARD-Nummer: Eine Verknüpfung ändert keinen Status (Entscheidung 3). R-TRANS-18 ff. und R-GUARD-16 ff. bleiben frei; 046b und 046c vergeben beim Schreiben ihrer Specs die dann nächste freie Nummer (043a, „Regel-ids für Folgescheiben“). Dazu AGENTS.md R2, R3, R4, R5, R6, R7, R8, R9, R10, R12
**Quellen-IDs:**
- `docs/produktplan-beta.md` Eintrag 046 (Zeile 692–697), Eintrag 043 (Zeile 686–691), §11 (Freigabe-Demo, Kette E57)
- Register E4 (Notizfeld, Standard aus; betrifft 046d), E30 (Zurückstellen und Korrektur; betrifft 046b und 046c), E57
- ADR 0012 (Modell A: „Nebenaspekte sind Kennzeichen, keine Zustände“, `followUp` als Thread mit `parentQuestionId` und `relation follow_up | clarification`, Verknüpfung nur im selben Jahrgang); ADR 0009 (`pii`-Umschlag); ADR 0015 (Vertragsversionierung); ADR 0002 (Demo im Browser)
- `docs/anforderungen-recherche.md:70` (MUSS: Nachfrage-Threads über alle Antworten), `:256` (MUSS: harte Verknüpfung zur Ursprungsantwort), `:480` (Fehlerbild 8: Nachfragen ohne Verknüpfung), `:195` (getrennte Objekttypen); `docs/ist-analyse-und-schnittstellen.md:129-130` (Nachfragen fehlen im heutigen Prozessbild), `:277` (Begriff)
- Spec 043a (Tabelle „Anfragefelder“, Zeile `QuestionCapture.parentQuestionId`, `relation` → 046, Regel 1; „Regel-ids für Folgescheiben“); Spec 048 (Muster: Vertragsschritt, gebundenes Nutzlastschema, Tests H/P/W); Spec 055b (Muster: eigene e2e-Datei im Projekt `http`)
- DSFA-Vorentwurf Zeile V3 (Einzelfrage mit „Bezug“), V9 (Vorgangshistorie), V17 (Notiz, nur 046d)

**Depends on:** 025 (gemergt, Jahrgang je Projektion), 043a (gemergt, Regel 1: das Anfragefeld kommt als erster Commit dieser Scheibe), 055b (gemergt `f4e0278`, Stand von Erfassung und Historie). **Nicht** 043b: nie geschrieben; 046 bringt seinen Vertragsschritt selbst mit, wie 048 und 055
**Perspektive:** Legal, Security, Datenschutz, Vertrag, UX · **Glossar: neue Begriffe:** ja („Nachfrage“ `follow_up`, „Klarstellung“ `clarification`, „Bezugsfrage“ `parentQuestionId`)

## Warum hoch

Der Plan führt 046 als „mittel“. Die Leitplanken (§4) nennen Audit, rechtlich relevante Zeit, personenbezogene Daten,
Rechte und Konfiguration als Hoch-Auslöser; bei unklarer Zuordnung gilt hoch. Für die ganze Planzeile ist das eindeutig:
Das Notizfeld ist ein neues personenbezogenes Freitextfeld hinter einer Konfiguration (046d), die Korrektur hat eine
Frist aus `VotingOpened` und ist die Berichtigungspflicht (046c), das Zurückstellen bringt ein neues Recht und eine neue
Zeile (046b).

Für den hier ausgearbeiteten Teil (Threads) ist die Lage knapper, aber nicht klar mittel:

- **Nachweis:** Die Verknüpfung ist der Beleg, dass eine Wortmeldung eine Nachfrage zu einer gegebenen Antwort war.
  Fehlt sie, ist die Zulässigkeit der Nachfrage „weder prüfbar noch belegbar“ (`docs/anforderungen-recherche.md:480`). Sie
  steht unveränderlich im Protokoll (R7); ein falscher Bezug lässt sich nicht löschen. Das ist ein Audit-Auslöser.
- **Lesepfade:** Ein Thread zeigt Fragen nebeneinander, die verschiedene Leser verschieden weit sehen dürfen (gebundene
  Fachkraft, Beobachtung, Podium). Eine falsch gebaute Thread-Ansicht legt Wortlaut oder Existenz einer fremden Frage offen.
  Das berührt R-PERM-03 und T-G1-I-01.
- **Vertrag und Ereignis:** neues Anfragefeld, neues Antwortfeld, neuer Filter, neuer Ereignistyp, der für immer in
  `EVENT_TYPES` bleibt.

Kein neues Recht, keine neue Zeile, kein Personenfeld: Der Wahrheitstabellen-Diff ist leer (Abschnitt unten). Eine
Herabstufung auf mittel entscheidet nur der Eigentümer (Eigentümerfrage 1); ohne sie gilt hoch mit Lesebefund vor dem Bau.

## Teilung und Zuschnitt

Die Planzeile 046 (mittel, 2 AStd) bündelt vier Themen mit getrennten Risiken: Threads, Zurückstellen, Korrektur offen
und Notizfeld. Zusammen sind sie rund 8,5 AStd und viermal Klasse hoch, weit über einem Agententag. Die Teilung folgt
dem Ziel des Eigentümers, der Freigabe-Demo: Was in der Demo sichtbar und wertvoll ist, kommt zuerst; was den Datenschutz
erweitert, kommt zuletzt und erst nach der Antwort auf E4.

| Teil | Thema | Inhalt | Vertrag | Klasse · AStd | Wann |
|---|---|---|---|---|---|
| **046** (diese Spec) | Nachfragen-Threads | `parentQuestionId` und `relation` beim Erfassen, Ereignis `QuestionLinked`, Filter `parentQuestionId`, Thread in Erfassung und Historie, e2e in-process und `http`, Screenshots | erster Commit, nächste freie Patch-Stufe (heute 0.4.5) | hoch · 2,5 | **zuerst**, in der Kette E57 nach 059 |
| **046b** (Skizze unten) | Zurückstellen | Kennzeichen `deferral` mit Pflichtgrund als Code und Wiedervorlage, neues Recht, Zeile(n) in `transitions.ts`, Anzeige in Steuerung und Fokus | eigene Patch-Stufe | hoch · 1,75 | nach 046; vor 060, wenn die Demo es zeigen soll |
| **046c** (Skizze unten) | Korrektur offen | Kennzeichen `correctionOpen` aus `delivered` mit Fehlerklasse, geschlossen durch neue freigegebene Version und erneutes Vorlesen, Frist aus `VotingOpened` des TOP | eigene Patch-Stufe | hoch · 2,5 | nach 046b; Perspektive Legal; E30 |
| **046d** (Skizze unten) | Notizfeld hinter Konfiguration | Schalter `notes` je Jahrgang (Standard aus), `QuestionNoteAdded` mit Text nur im `pii`-Teil, eigener Datenbereich, nie Export, nie Bühne | eigene Patch-Stufe | hoch · 2,0 | zuletzt; **erst nach Antwort auf E4** oder ausdrücklichem Go und mit Vermerk zur DSFA-Zeile V17 |

**Warum Threads zuerst.** Sie sind in der Erfassung und in der Historie sichtbar, ohne eine neue Rolle oder Ansicht. Ein
Demo-Satz trägt sie: „Diese Wortmeldung ist eine Nachfrage zu F-0012; die Historie zeigt beide Fragen im Zusammenhang.“
Sie brauchen keine offene Entscheidung des Eigentümers (E30 betrifft 046b/c, E4 betrifft 046d) und kein neues Recht.

**Warum Zurückstellen vor Korrektur.** Das Zurückstellen ist kleiner und zeigt sich in Steuerung (053) und Fokus (054),
die die Demo ohnehin vorführt. Die Korrektur ist rechtlich schwerer (Berichtigungspflicht, Frist, zweites Vorlesen), braucht
die Perspektive Legal und berührt die Bühne. Tauscht der Eigentümer die Reihenfolge, ändert das keine Spec.

**Warum das Notizfeld zuletzt.** Es ist die einzige Funktion der Planzeile, die den Datenschutz erweitert. Der Standard aus
E4 ist „aus“, die DSFA-Zeile V17 sagt „zu prüfen, bevor eingeschaltet wird“. Ohne Antwort auf E4 bliebe ein gebautes Feld
in der Demo ohnehin aus; ein früher Bau kostet Wartung ohne sichtbaren Nutzen.

**Warum kein Schnitt Kern / Oberfläche in 046.** Der Kern ist klein (ein Ereignis, ein Filter, zwei Regeln, kein Recht),
der Nutzen liegt ganz in der Oberfläche. Ein Kern ohne Oberfläche wäre in der Demo unsichtbar und bräuchte einen zweiten
Review derselben Lesepfade.

## Befund (Ist-Stand, gelesen auf `c5990c8`)

- **Vertrag 0.4.4**, 71 Operationen. `QuestionCapture` (`openapi.yaml:3346-3351`) kennt nur `text` und `span`; `Question`
  (`:3300-3345`) hat kein Feld für einen Bezug. `Event.type` kennt kein `QuestionLinked`. `listQuestions` und
  `listMeetingQuestions` filtern nach Status, Pfad, Einheit, Redner, Redebeitrag, TOP, Volltext; nicht nach einem Bezug.
  `allowlist.json`: zwei Einträge, beide `slice` 040.
- **043b fehlt.** 043a ordnet `QuestionCapture.parentQuestionId`/`relation` dieser Scheibe als erstes Commit zu (Tabelle
  „Anfragefelder“, Regel 1, additiv). Das neue Antwortfeld, der Filter und der Ereignistyp standen im nie geschriebenen 043b;
  046 bringt sie mit (Planabweichung vom Zuschnitt aus 043a, wie bei 048 und 055; Hinweis an den Orchestrator).
- **Erfassung im Kern** (`api.ts:1187-1219`): `captureQuestions` prüft `question.capture`, den Redebeitrag, Text und Spanne,
  dann `If-Match` gegen die Version des Redebeitrags und hängt je Einzelfrage ein `QuestionCaptured` an, in einem `append`.
  Die Nummer ist `F-` plus laufende Zahl der Projektion. Die Antwort ist die Liste der Ansichten; das `ETag` ist die neue
  Version des Redebeitrags (`api.ts:718`).
- **Wiederholung** (`api.ts:600-660`): Für `captureQuestions` erkennt der Kern die Ereignisse des ursprünglichen Befehls an
  `QuestionCaptured` mit derselben `contributionId` (`api.ts:609`) und baut daraus die Antwort. Ein zusätzliches Ereignis
  desselben Befehls darf diese Zuordnung nicht stören (Vor-dem-Bau-Punkt 3).
- **Projektion je Jahrgang** (`api.ts:359-404`): Eine Kern-Instanz mit `meetingId` sieht nur Ereignisse dieses Jahrgangs.
  Eine Frage eines anderen Jahrgangs steht nicht in `state.questions`; dieselbe Subject-id in zwei Jahrgängen ist zulässig
  (`meeting025.test.ts:129`). „Nur innerhalb desselben Jahrgangs“ folgt daraus fast von selbst, muss aber im Reduzierer
  gegen ein gefälschtes Protokoll gehalten werden (R-LINK-02).
- **Leseumfang.** `listQuestions` filtert mit `can(actor(), 'question.read', q)` (`api.ts:1312`), `getQuestion` antwortet
  404 ohne Leserecht (`api.ts:1318-1323`). Erfassung, Moderation, Koordination, Recht, Freigabe und Administration lesen
  alle Fragen; die gebundene Fachkraft nur die ihres Fachbereichs; Beobachtung nur `delivered` und `closed`; Podium keine
  (nur `stage.read`). Jede Rolle mit `question.capture` liest heute alle Fragen.
- **Volltextsuche** (`api.ts:820-829`) durchsucht auch `number`; ein Suchfeld „F-0012“ findet die Frage.
- **Strom** (`stream.ts:39-136`): `EVENT_TOPICS` und `EVENT_SUBJECTS` sind über `EventType` typisiert, ein neuer Typ
  erzwingt Einträge. `SCOPE_EXIT_EVENTS` nennt Ereignisse, nach denen eine Frage den Leseumfang verlassen kann.
- **Umschlag** (`envelope.ts:5-16`): `EVENT_TYPES`; ein unbekannter Typ besteht das Laden nicht. Aufbewahrungsklasse ohne
  Angabe `working` (`envelope.ts:147`); auch `QuestionCaptured` steht so im Code, obwohl die DSFA-Zeile V3 `record` nennt.
  Der Widerspruch besteht schon (Spec 048, Eigentümerfrage 9) und wird hier nicht entschieden.
- **Oberfläche Erfassung.** Alle Erfassungswege (Markieren mit `Alt+Q`, freie Eingabe, Vorschlag) laufen über
  `captureQuestions` in `features/capture/Page.tsx:272-305`; dort lässt sich ein Bezug an jede Einzelfrage eines Aufrufs
  hängen, ohne die drei Wege einzeln anzufassen. Die rechte Spalte (`QuestionsPane.tsx`, `QuestionCard.tsx`) zeigt die
  Einzelfragen des gewählten Redebeitrags. `Alt+Q` ist die einzige Alt-Taste der Erfassung (`ContributionText.tsx:146-158`).
- **Oberfläche Historie** (`features/history/Page.tsx`): Suche, Detail einer Frage mit Antwortblock (055b) und Zeitleiste
  aus `getQuestionHistory`; `eventSummary.ts` fasst jedes Ereignis zusammen. Ereignisnamen: `labels.ts:~121`
  (`Record<EventType, TKey>`), Texte in `shell.de.ts`/`shell.en.ts`. Paritätstest: 621 Schlüssel je Sprache
  (`parity.test.ts:183-185`).
- **Regelregister** (`rules.ts`): Regeln, die weder Zeile noch Guard der Tabelle sind, stehen dort (R-PERM, R-ADM,
  R-MTG, R-IDEM, R-CLAIM); `docs/legal-trace.md` ist generiert. Keine Regel R-LINK-nn vorhanden.
- **e2e.** `SHARED_SPECS` (`playwright.config.ts:38-42`) und `SHARED_FILES`/`HTTP_ORDER` (`scripts/e2e-http-031.test.mjs:26-31`)
  enden mit 055b, 080, abnahme. takt-046 hat die Grenzen des Schritts `e2e-http` angehoben und eine Dauerzeile eingeführt.
- **Seed** enthält keine Nachfrage; er bleibt unverändert (Standard 5).

## Ziel und Entscheidungen vor Bau

Beim Erfassen einer Einzelfrage kann die erfassende Person angeben, dass sie eine **Nachfrage** oder eine **Klarstellung**
zu einer schon erfassten Einzelfrage desselben Jahrgangs ist („Nachfrage zu F-0012“). Der Bezug steht als eigenes,
unveränderliches Ereignis `QuestionLinked` im Protokoll und als Feld an der Frage. Erfassung und Historie zeigen den
Thread: die Bezugsfrage und die Nachfragen zu einer Frage, jeweils nur, soweit die lesende Person sie lesen darf. **Auf
Standard gebaut:** die Entscheidungen unten tragen ihren Standard; offene Punkte stehen als Eigentümerfragen.

### 1. Datenmodell (Vertrag, `types.ts`)

- `QUESTION_RELATIONS = ['follow_up', 'clarification'] as const`, `QuestionRelation`.
  - `follow_up` = **Nachfrage**: Der Redner fragt zu einer gegebenen oder angekündigten Antwort weiter (Nachfragerecht).
  - `clarification` = **Klarstellung**: Der Redner bittet, eine Antwort oder Frage klarzustellen (Verständnisfrage).
  - Bezeichnungen nach Eigentümerfrage 4; die Codes stehen fest (Vertrag).
- `QuestionRecord` und `Question`: optional `parentQuestionId: string` und `relation: QuestionRelation`, **beide oder
  keines** (Vertrag: `dependentRequired` in beide Richtungen). Keine Kopie von Nummer oder Wortlaut der Bezugsfrage (Entscheidung 7).
- `QuestionCapture`: optional `parentQuestionId` (1–128 Zeichen) und `relation`, beide oder keines.
- `QuestionFilter`: optional `parentQuestionId` (1–128 Zeichen).

### 2. Erfassung mit Bezug (`captureQuestions`)

- Jede Einzelfrage eines Aufrufs kann einen eigenen Bezug tragen; Einzelfragen ohne Bezug bleiben wie heute.
- **Prüfreihenfolge** (alle Prüfungen vor `If-Match`, wie die heutigen Text- und Spannenprüfungen): Recht
  `question.capture` (403) → Redebeitrag (404) → je Einzelfrage Text, Spanne, **Paar `parentQuestionId`/`relation`** (422 ohne
  Regel-id: nur eines von beiden, unbekannte Relation, leere oder zu lange id) → je Einzelfrage **R-LINK-01** (422) →
  `If-Match` (428/412) → Anhängen.
- **Alles oder nichts:** Scheitert eine Einzelfrage, entsteht kein Ereignis, auch nicht für die übrigen.
- **Ein `append`**, in dieser Reihenfolge: je Einzelfrage `QuestionCaptured`, bei Bezug unmittelbar danach ihr
  `QuestionLinked`. So ist die Erfassung mit Bezug atomar; kein Zwischenstand „Frage ohne ihren Bezug“ ist lesbar.
- Die Antwort ist wie heute die Liste der Ansichten, jetzt mit `parentQuestionId` und `relation`; das `ETag` bleibt die
  Version des Redebeitrags.
- **Kein Statuskriterium** an der Bezugsfrage (Standard 2): Auch eine noch nicht beantwortete, eine zurückgezogene oder eine
  zusammengeführte Frage kann Bezugsfrage sein. Begründung: Eine Nachfrage kann sich auf eine Vorabantwort oder eine
  angekündigte Antwort beziehen; eine Statusbedingung wäre Statuslogik außerhalb der Tabelle (AGENTS.md R5) und eine still
  entschiedene Rechtsfrage (Leitplanken 6.1, Blocker). Ob eine Nachfrage nur zu vorgelesenen Antworten zulässig ist, ist
  Eigentümerfrage 2.
- Eine Bezugsfrage aus demselben Redebeitrag oder vom selben Redner ist zulässig (Recherche `:70`: „über alle Antworten,
  nicht nur über die eigene Frage“, und umgekehrt).

### 3. R-LINK-01 — Bezugsfrage im selben Jahrgang und lesbar (`rules.ts`, Art `Guard`)

- Erfüllt, wenn die Bezugsfrage in der Projektion des Jahrgangs der Erfassung steht (`state.questions`) **und**
  `can(actor, 'question.read', parent)` erlaubt.
- Verletzt → **422** mit Regel-id `R-LINK-01` und **einer** gleichlautenden Meldung für alle drei Fälle (unbekannte id,
  Frage eines anderen Jahrgangs, nicht lesbar). So verrät die Antwort nicht, ob es eine Frage mit dieser id gibt
  (MF-15). 422 statt 409, weil die Eingabe auf nichts Gültiges zeigt (wie der unbekannte Fachbereich in 048).
- Der Fall „nicht lesbar“ ist mit den heutigen Rollen nicht herstellbar (jede Rolle mit `question.capture` liest alle
  Fragen); die Prüfung schützt eine spätere Rolle mit Erfassungsrecht und engem Leseumfang. Ein Kommentar im Code nennt das.
- **Warum nicht in `transitions.ts`.** ADR 0012 sagt „Guard oder Zeile in `transitions.ts`“. Ein Guard hängt dort an einer
  Statuszeile; die Erfassung hat keine (sie erzeugt eine Frage, sie überführt keine). Eine künstliche Zeile „Erfassen“ wäre
  neue Statuslogik. Deshalb steht R-LINK-01 wie R-ADM-01/02 im Regelregister von `rules.ts` und wird in `api.ts` geprüft.
  Abweichung vom Wortlaut des ADR, kein Widerspruch zum Sinn (Hinweis an den Orchestrator: ADR-Nachtrag beim nächsten
  Doku-Takt).
- `legalRef`: `source: 'Recherche'`; `citation`: `docs/anforderungen-recherche.md:256` („harte Verknüpfung zur
  Ursprungsantwort“) und `:70` („Nachfrage-Threads über alle Antworten“); **Teilweise:** keine eigene Warteschlange, keine
  verkürzte Frist, keine Angemessenheitsgrenzen, keine Prüfschritte „echte Nachfrage oder neue Frage?“; **Ableitung (Spec 046):**
  Jahrgangsgrenze aus ADR 0012; Lesbarkeit und eine gleichlautende Ablehnung aus T-G1-I-01. „Auf Standard gebaut (E30 offen).“
  `docVersion: null`, `docHash: null`, `verified: false`.

### 4. R-LINK-02 — Bezug nur bei Erfassung, einmal, unveränderlich (`rules.ts`, Art `Guard`)

- Der Kern schreibt `QuestionLinked` nur im Befehl `captureQuestions` und nur unmittelbar nach dem `QuestionCaptured`
  derselben Frage. Es gibt keine Operation zum Ändern oder Lösen eines Bezugs (Nicht-Ziel; Eigentümerfrage 3).
- Der **Reduzierer** hält die Regel auch gegen ein gefälschtes oder fehlerhaftes Protokoll: Er übernimmt ein
  `QuestionLinked` nur, wenn (a) die Frage existiert, (b) sie noch keinen Bezug hat, (c) die Bezugsfrage in derselben
  Projektion existiert und (d) Bezugsfrage und Frage verschieden sind. Sonst lässt er das Ereignis ohne Wirkung (kein Wurf:
  Laden und Kettenprüfung eines gespeicherten Protokolls dürfen daran nicht scheitern, R7).
- Folge: Ein Thread ist zyklenfrei, weil eine neue Frage nie Vorfahr einer älteren werden kann.
- `legalRef`: `source: 'Leitplanken'`; `citation`: AGENTS.md R7 (Ereignisse nur anhängen) und
  `docs/anforderungen-recherche.md:295` („Korrekturen nur als kompensierende Events“); **Ableitung (Spec 046):** ein
  falscher Bezug wird nicht umgeschrieben, sondern durch Zurückziehen und Neuerfassen ersetzt (R-TRANS-11). Nicht belegt.
  `verified: false`.

### 5. Ereignis `QuestionLinked` (`events.ts`, `envelope.ts`)

```ts
export type QuestionLinked = Base<'QuestionLinked', { parentQuestionId: string; relation: QuestionRelation }>;
```

- `subjectId` = die neue Einzelfrage (Kind); `meetingId` = Jahrgang der Erfassung; Akteur wie beim `QuestionCaptured`.
- **Nutzlast genau** `{ parentQuestionId, relation }`; kein `pii`-Teil, kein Freitext, keine Nummer, kein Wortlaut. Die
  Invariante des Umschlags (Personendaten nur im `pii`-Teil, seit 026) bleibt gewahrt.
- Aufbewahrungsklasse: wie `QuestionCaptured` (heute `working` durch den Standard des Umschlags). Der Widerspruch zu V3
  (`record`) betrifft beide gleich und bleibt bei der offenen Frage aus Spec 048 (Eigentümerfrage 9 dort).
- `EVENT_TYPES` erhält `QuestionLinked` nach `QuestionCaptured`; ein gespeicherter Typ bleibt für immer ladbar.

### 6. Projektion (`state.ts`)

- Fall `QuestionLinked` nach R-LINK-02: setzt `parentQuestionId` und `relation` am Kind und ruft `touch` für das Kind (Version
  und `updatedAt` wie bei jedem Ereignis der Frage; nach einer Erfassung mit Bezug steht das Kind also auf Version 2).
- **Die Bezugsfrage bleibt unberührt:** keine Version, kein `updatedAt`, kein Zähler. Wer gerade die Antwort der
  Bezugsfrage bearbeitet, bekommt durch eine neue Nachfrage keinen 412 (Entscheidung „Eltern-ETag stabil“, Test 1).
- Keine Liste der Kinder an der Bezugsfrage in der Projektion; die Kinder liefert der Filter (Entscheidung 7).
- Zähler (`counts`), Kennzahlen und Restabdeckung ändern sich nicht. Eine „Nachfragequote“ ist Nicht-Ziel.

### 7. Lesepfade

- **Ansicht der Frage** (`getQuestion`, `listQuestions`, `getStage`, Antworten der Schreiboperationen): `parentQuestionId`
  und `relation` stehen an jeder Frage, die die lesende Person lesen darf. Sie sind Tatsachen der Nachfrage selbst.
  `parentQuestionId` ist eine zufällige id ohne Inhalt; **Nummer und Wortlaut der Bezugsfrage stehen nie an der
  Nachfrage.** Wer die Bezugsfrage lesen will, ruft `getQuestion(parentQuestionId)` und erhält ohne Leserecht 404 wie heute.
  Damit sieht etwa die Beobachtung an einer vorgelesenen Nachfrage nur, dass es eine Bezugsfrage gibt, nicht welche.
- **Filter `parentQuestionId`** an `listQuestions` und `listMeetingQuestions`: liefert die **direkten** Nachfragen und
  Klarstellungen dieser Frage, gefiltert mit demselben Leseumfang wie jede Liste (`can(..., 'question.read', ...)`),
  sortiert und paginiert wie heute. Eine unbekannte oder nicht lesbare Bezugsfrage ergibt eine leere Liste mit `total: 0`,
  nie 404 oder 422 (keine Auskunft über die Existenz). Kombinierbar mit allen übrigen Filtern.
- **Historie:** `getQuestionHistory(kind)` enthält `QuestionLinked` mit seiner Nutzlast; die Historie der Bezugsfrage nicht
  (das Ereignis gehört dem Kind). `EventRead` zeigt die Nutzlast ungemaskt (keine Personendaten); gebunden an das neue Schema
  `QuestionLinkedPayload` (Vertragsschritt).
- **Strom** (`stream.ts`): `EVENT_TOPICS.QuestionLinked = ['questions']` (Zähler ändern sich nicht);
  `EVENT_SUBJECTS.QuestionLinked` = Kind **und** Bezugsfrage, damit eine Person, die gerade die Bezugsfrage liest, ein
  Änderungssignal erhält und ihren Thread neu lädt (eine harmlose Obermenge wie bei `QuestionMerged`; die Bezugsfrage selbst
  ändert sich nicht). `visibleMessages` filtert wie immer nach Lesbarkeit; nicht in `SCOPE_EXIT_EVENTS` (der Leseumfang
  ändert sich nicht).
- **Bühne:** `getStage` liefert die beiden Felder mit (Ansicht der Frage); die Bühnenansicht zeigt in 046 nichts Neues
  (Eigentümerfrage 7).

### 8. Dienst (`apps/api/src/app.ts`)

- `captureQuestions`: keine Codeänderung außer dem Typ; der Validator prüft das erweiterte Schema aus dem Vertrag (Paar,
  Enum, Länge) vor dem Kern. R-LINK-01 meldet der Kern.
- `questionFilter` (`app.ts:948`) reicht `parentQuestionId` an den Kern durch; der Validator prüft die Länge.
- Keine neue Route, kein Allowlist-Eintrag, keine Migration (das Ereignis ist eine Zeile wie jede andere).

### 9. Oberfläche Erfassung (`features/capture`)

- **Schaltfläche „Nachfrage zu …“** im Kopf des Redebeitrags (nur wenn `canCapture`, sonst fehlt sie; Prinzip 9), dazu die
  Taste `Alt+N` (Vor-dem-Bau-Punkt 6). Sie öffnet den Dialog **„Bezug setzen“** (480 px, Muster der vorhandenen Dialoge):
  - Auswahl der Art: „Nachfrage“ (vorgewählt) oder „Klarstellung“ (Radiogruppe).
  - Suchfeld „Nummer oder Stichwort“, Treffer über `listQuestions({ q, limit: 8 })` mit 250 ms Verzögerung; jede Zeile zeigt
    Nummer (Mono), Auszug des Wortlauts und Status-Badge. Pfeiltasten und Enter wählen; Escape schließt und gibt den Fokus an
    die Schaltfläche zurück.
  - Zustände: leer (Hinweis „Nummer wie F-0012 oder ein Stichwort eingeben“), lädt (Skeleton-Zeilen), keine Treffer,
    Fehler (Grund, „Erneut versuchen“).
  - Primäraktion „Bezug setzen“, sekundär „Abbrechen“.
- **Chip über dem Text** des Redebeitrags: „Nachfrage zu F-0012“ bzw. „Klarstellung zu F-0012“ mit Schaltfläche „Bezug
  entfernen“ (×). Der Chip gilt **für den nächsten Erfassungsaufruf** dieses Redebeitrags (Markieren mit `Alt+Q`, freie
  Eingabe oder Vorschlag) und für **jede** Einzelfrage dieses Aufrufs. Nach einem erfolgreichen Aufruf verschwindet er; nach
  einem Fehler (412, 422, Netz) bleibt er stehen. Wechsel des Redebeitrags oder der Person (`actorId`) entfernt ihn.
  - **Warum einmalig (Standard 3):** Ein Bezug lässt sich nicht ändern (R-LINK-02). Ein Chip, der stehen bliebe, würde
    vergessene Bezüge an alle weiteren Fragen hängen. Die einmalige Geltung macht den Fehler unwahrscheinlich; der Chip macht
    ihn vor dem Erfassen sichtbar.
- Die Ergänzung der Einzelfragen um den Bezug geschieht an **einer** Stelle: in `Page.tsx` `captureQuestions`, über eine
  reine Hilfsfunktion `withReference(items, reference)` in `followUp.ts`.
- **Karte der Einzelfrage** (`QuestionCard.tsx`): bei `parentQuestionId` ein Badge „Nachfrage zu F-0012“ bzw. „Klarstellung
  zu F-0012“; die Nummer löst die Karte über `getQuestion(parentQuestionId)` auf (je Bezugsfrage einmal je Ladevorgang).
  Bei 404 steht „Nachfrage zu einer nicht sichtbaren Frage“; der Fall tritt in der Erfassung heute nicht auf, die Karte
  zeigt ihn trotzdem richtig.
- Keine Statusfarbe für den Bezug (Prinzip 4): neutrales Badge mit Symbol (Vorschlag: `CornerDownRight` aus lucide).

### 10. Oberfläche Historie (`features/history`)

- **Block „Bezug“** im Detail einer Frage, über der Zeitleiste und unter dem Antwortblock (`ThreadBlock.tsx`):
  - Zeile **Bezugsfrage**, wenn die Frage einen Bezug hat: „Nachfrage zu F-0012“ (bzw. „Klarstellung zu …“), Auszug,
    Status-Badge; ein Klick öffnet die Bezugsfrage in der Historie. Ohne Leserecht (404): „Bezugsfrage nicht sichtbar“, ohne
    Nummer, ohne Link.
  - Liste **„Nachfragen und Klarstellungen (n)“** aus `listQuestions({ parentQuestionId: id })`: je Zeile Nummer, Art, Auszug,
    Status-Badge, Klick öffnet die Frage. Nur direkte Nachfragen; eine Nachfrage auf eine Nachfrage erscheint an ihrer
    eigenen Bezugsfrage.
  - Hat eine Frage weder Bezug noch Nachfragen, fehlt der Block ganz (kein leerer Kasten). Ladezustand: Skeleton in fester
    Höhe (nichts springt, Prinzip 8). Fehler: Grund und „Erneut versuchen“.
- **Zeitleiste:** `eventSummary.ts` fasst `QuestionLinked` zusammen: „Als Nachfrage zu F-0012 erfasst“ bzw. „Als
  Klarstellung zu F-0012 erfasst“; kennt die Zusammenfassung die Nummer nicht (Bezugsfrage nicht lesbar oder nicht geladen),
  steht „Als Nachfrage erfasst“. Ein unbekannter Relationscode erscheint als Code.
- `labels.ts`: Ereignisname `event.QuestionLinked`, Bezeichnungen je Relation (`Record<QuestionRelation, TKey>`).

### 11. Datenschutz und Sicherheit

- Kein neues personenbezogenes Feld: Die Nutzlast ist eine id und ein Code. Die DSFA-Zeile V3 nennt den „Bezug“ schon; sie
  erhält nur den Vermerk „Bezug zur Bezugsfrage bei Nachfrage oder Klarstellung (046)“.
- Kein neuer Leser: Jede Frage bleibt nur für die lesbar, die sie heute lesen. Der Thread zeigt Nachbarfragen nur über die
  vorhandenen Lesepfade.
- Kein Existenzorakel: gleichlautende 422 bei R-LINK-01, leere Liste beim Filter, 404 bei `getQuestion`.
- Kein Fragetext in Zugriffslog oder Fehlermeldung (V10): die 422-Meldung nennt die Regel, nicht die id.

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

**Leer.** Kein neues Recht, keine neue Zeile, kein neuer Guard in `transitions.ts`, keine Änderung an `ROLE_PERMISSIONS`.
`packages/domain/policy-truth-table.md` bleibt byte-gleich (Akzeptanzkriterium 2). `docs/legal-trace.md` erhält genau zwei
Zeilen (R-LINK-01, R-LINK-02).

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6)

Additiv; keine neue Operation; kein Feld wird Pflicht; kein bestehendes Anfrageschema wird verengt.

- **Version:** nächste freie Patch-Stufe beim Merge (heute 0.4.5; ist 059 vorher gemergt, die dann nächste).
  `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.5]` in `CHANGELOG.md` mit `### Added` und `### Changed`
  und dem Vermerk „auf Standard gebaut (E30 offen)“.
- **Schema `QuestionRelation`:** `type: string`, `enum: [follow_up, clarification]`, Beschreibung je Wert (Nachfrage,
  Klarstellung); ausdrücklich ohne Freitext.
- **`QuestionCapture`:** `parentQuestionId: { type: string, minLength: 1, maxLength: 128 }`, `relation: { $ref: QuestionRelation }`,
  `dependentRequired: { parentQuestionId: [relation], relation: [parentQuestionId] }`; Beschreibung: Bezugsfrage desselben
  Jahrgangs, R-LINK-01, unveränderlich (R-LINK-02).
- **`Question`:** dieselben zwei Felder (ohne Längenangabe), dieselbe `dependentRequired`-Bindung; Beschreibung: „Since 0.4.5
  (slice 046)“, nie Nummer oder Wortlaut der Bezugsfrage.
- **Parameter `ParentQuestionIdFilter`** (`in: query`, `name: parentQuestionId`, `string`, 1–128) an `listQuestions` und
  `listMeetingQuestions`; Beschreibung: direkte Nachfragen, Leseumfang wie die Liste, unbekannte id ergibt eine leere Liste.
- **`captureQuestions`:** Beschreibung ergänzt um `422` R-LINK-01 (eine Meldung für unbekannt, anderer Jahrgang, nicht
  lesbar), „alles oder nichts“ und die Ereignisfolge `QuestionCaptured`, `QuestionLinked`.
- **`Event.type`:** `QuestionLinked` nach `QuestionCaptured`.
- **Gebundenes Nutzlastschema `QuestionLinkedPayload`:** `additionalProperties: false`, `required: [parentQuestionId, relation]`;
  in `EventRead` per `if`/`then` an `type: QuestionLinked` gebunden, nach dem Muster von `QuestionForwardedPayload`.
- **Typen:** `pnpm contract:types`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.4 -> 0.4.5`; Versionszeilen in
  `contract.test.ts` und `takt-019-contract.test.ts`; Zahl der Operationen unverändert 71.
- **Rücknahme nach dem Merge** ist brechend (Enum-Wert, Ereignistyp; 0.5.0 nach ADR 0015); `QuestionLinked` bleibt in
  `EVENT_TYPES`. Deshalb der Lesebefund vor dem Bau.

## Nicht-Ziele

- Kein Zurückstellen (046b), keine Korrektur offen (046c), kein Notizfeld und kein Konfigurationsschalter (046d).
- Kein Ändern oder Lösen eines Bezugs, keine Operation `linkQuestion` (Eigentümerfrage 3); ein falscher Bezug wird durch
  Zurückziehen (R-TRANS-11) und Neuerfassen ersetzt.
- Keine Statusbedingung an der Bezugsfrage (Eigentümerfrage 2); keine Angemessenheitsgrenzen je Aktionär oder je Antwort,
  keine Beschränkungsanordnung (Recherche `:70`, Folgeliste); keine eigene Warteschlange oder verkürzte Frist für Nachfragen
  (Recherche `:256`).
- Keine Anzeige auf der Bühne (Eigentümerfrage 7), keine Anzeige in Steuerung (053), Fokus (054) oder Beantwortung.
- Keine Kennzahl, kein Zähler, keine „Nachfragequote“ (Kennzahlen-Allowlist unverändert).
- Keine Umschreibung von Bezügen bei Zusammenführen (R-TRANS-12) oder Zurückziehen; der Bezug bleibt, die Historie zeigt den
  Status der Bezugsfrage.
- Keine Erweiterung der Volltextsuche um die Relation; kein Export (051).
- Keine Änderung an Seed, Rechten, Übergängen, Maskierung, Zugriffslog, Persistenzschicht, Migrationen.

## Files allowed

Vertrag (erster Commit, Architekt):

- `packages/contract/openapi.yaml` (nur QuestionRelation, die zwei Felder in QuestionCapture und Question, ParentQuestionIdFilter an zwei Listen, Beschreibung von captureQuestions, Event.type-Eintrag, QuestionLinkedPayload und seine Bindung in EventRead, info.version)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/CHANGELOG.md` (nur der neue Abschnitt)
- `packages/contract/package.json` (nur Version)

Kern:

- `packages/domain/src/types.ts` (nur QUESTION_RELATIONS, QuestionRelation, QuestionRecord, QuestionCapture, QuestionFilter)
- `packages/domain/src/events.ts` (nur QuestionLinked und die Union)
- `packages/domain/src/envelope.ts` (nur EVENT_TYPES)
- `packages/domain/src/state.ts` (nur der Fall QuestionLinked)
- `packages/domain/src/stream.ts` (nur EVENT_TOPICS und EVENT_SUBJECTS)
- `packages/domain/src/api.ts` (nur captureQuestions, questionMatches und, falls Vor-dem-Bau-Punkt 3 es verlangt, die Wiederholungszuordnung von captureQuestions)
- `packages/domain/src/rules.ts` (nur R-LINK-01 und R-LINK-02)
- `docs/legal-trace.md` (generiert)
- `packages/domain/src/__tests__/link046.test.ts` (neu)
- `packages/domain/src/__tests__/stream035.test.ts` (nur QuestionLinked in den Erwartungen zu EVENT_TOPICS und EVENT_SUBJECTS)

Dienst:

- `apps/api/src/app.ts` (nur questionFilter und der Typimport)
- `apps/api/src/__tests__/link046.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-link046.test.ts` (neu, mit Postgres)
- `apps/api/src/__tests__/contract.test.ts` (nur Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur Versionszeile)

Oberfläche:

- `apps/web/src/api/http.ts` (nur parentQuestionId in der Abfrage von listQuestions)
- `apps/web/src/api/http.test.ts`
- `apps/web/src/features/capture/followUp.ts` (neu), `apps/web/src/features/capture/followUp.test.ts` (neu)
- `apps/web/src/features/capture/FollowUpDialog.tsx` (neu), `apps/web/src/features/capture/FollowUpDialog.test.tsx` (neu)
- `apps/web/src/features/capture/Page.tsx` (nur Bezugszustand, Alt+N, Anwendung in captureQuestions, Zurücksetzen)
- `apps/web/src/features/capture/ContributionPane.tsx` (nur Schaltfläche und Chip), `apps/web/src/features/capture/ContributionPane.test.tsx`
- `apps/web/src/features/capture/QuestionCard.tsx`, `apps/web/src/features/capture/QuestionCard.test.tsx` (neu)
- `apps/web/src/features/history/ThreadBlock.tsx` (neu), `apps/web/src/features/history/ThreadBlock.test.tsx` (neu)
- `apps/web/src/features/history/Page.tsx` (nur das Einsetzen des Blocks und das Öffnen einer Frage aus ihm)
- `apps/web/src/features/history/eventSummary.ts`, `apps/web/src/features/history/eventSummary.test.ts`
- `apps/web/src/i18n/labels.ts` (nur Ereignisname und Bezeichnungen je Relation)
- `apps/web/src/i18n/capture.de.ts`, `apps/web/src/i18n/capture.en.ts`
- `apps/web/src/i18n/history.de.ts`, `apps/web/src/i18n/history.en.ts`
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (nur der Ereignisname)
- `apps/web/src/i18n/parity.test.ts` (nur die Zahl)

e2e und Nachweise:

- `apps/web/e2e/046-nachfragen.spec.ts` (neu)
- `apps/web/e2e/support/e2e-texts.ts` (nur die Konstanten dieser Scheibe und ihre Einträge in WRITTEN_TEXTS)
- `apps/web/playwright.config.ts` (nur SHARED_SPECS: die neue Datei nach 055b)
- `scripts/e2e-http-031.test.mjs` (nur SHARED_FILES und HTTP_ORDER: die neue Datei zwischen 055b und 080)
- `docs/evidence/046-*.png`

Dokumente:

- `docs/glossar.md` (nur drei Zeilen: Nachfrage, Klarstellung, Bezugsfrage)
- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile V3)
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeile 046 in „Weitere Scheiben mit Sicherheitsbezug“ und MF-15)
- `docs/folgeliste.md` (nur Einträge aus „Hinweise an den Orchestrator“ und nicht blockierende Befunde)
- `docs/slices/046-nachfragen-threads.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator mit dem Merge: Stand-Zeile, Planzeilen 046b–046d)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

Diese Liste steht bewusst außerhalb von „Files allowed“ und ohne Pfad-Auszeichnung: packages/domain/src/permissions.ts,
packages/domain/src/transitions.ts, packages/domain/policy-truth-table.md, packages/domain/src/seed.ts,
packages/domain/src/indicators.ts, packages/contract/allowlist.json, packages/contract/scripts, apps/api/src/persistence,
apps/api/migrations, apps/api/src/metrics, apps/api/src/validate.ts, apps/web/src/features außer capture und history,
apps/web/src/api/liveStore.ts, .github/workflows, docs/adr.

## Vor dem Bau prüfen

1. Vertrag noch 0.4.4 oder höher ohne `QuestionLinked`, `QuestionRelation`, `ParentQuestionIdFilter`; R-LINK-01/02 frei.
   Sonst anhalten und melden.
2. Wird 059 vorher gemergt: Version, CHANGELOG-Abschnitt und Paritätszahl auf den neuen Stand setzen; keine weiteren Folgen.
3. **Wiederholung von `captureQuestions`** (`api.ts:600-660`): Liefert eine Wiederholung mit demselben `Idempotency-Key`
   nach einem Aufruf mit Bezug dieselbe Antwort (mit Bezugsfeldern) und hängt nichts an? Wenn die Zuordnung `QuestionLinked`
   nicht erwartet, nur dort anpassen (Files allowed) und im Bericht nennen.
4. Gibt es einen Test, der das Enum `Event.type` gegen `EVENT_TYPES` oder die Ereignisnamen in `labels.ts` abgleicht, oder
   der die Schlüssel von `QuestionCapture` zählt? Dann ist er Scope-Befund, nicht stille Änderung.
5. `eventSummary.ts` mit `default`-Zweig? Dann erzwingt die Typprüfung den Fall nicht; Test W5 belegt ihn trotzdem.
6. `Alt+N` in Erfassung, Shell und Browsern frei (`ContributionText.tsx:146-158`, `AppShell.tsx`, `RoleSwitcher.tsx`)? Sonst
   eine freie Alt-Taste wählen und im Bericht nennen.
7. Laufzeit des Schritts `e2e-http` aus den letzten drei grünen Läufen notieren (Dauerzeile aus takt-046).
8. Weichen Zeilenangaben ab: melden, nicht raten.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/link046.test.ts`; Seed mit injizierter Uhr; Erfassung als Akteur mit Rolle
`capture`; zweiter Jahrgang wie in `meeting025.test.ts:88-160`; gebundene Fachkräfte über `assignRole` wie in
`forward048.test.ts`):

1. **Erfassung mit Nachfrage.** Ein Aufruf mit einer Einzelfrage und Bezug `follow_up` auf eine Seed-Frage: genau ein
   `QuestionCaptured` und unmittelbar danach (nächste `seq`, derselbe Befehl) genau ein `QuestionLinked`; Nutzlast genau die
   Schlüssel `parentQuestionId`, `relation`; kein `pii`; `meetingId` gleich; Ansicht mit beiden Feldern, Version 2. Die
   Bezugsfrage hat danach dieselbe Version und dasselbe `updatedAt` wie vorher (Eltern-ETag stabil).
2. **Gemischter Aufruf.** Drei Einzelfragen, zwei mit Bezug (`follow_up`, `clarification` auf verschiedene Bezugsfragen), eine
   ohne: Reihenfolge Captured(1), Linked(1), Captured(2), Linked(2), Captured(3); die dritte Ansicht hat keinen der beiden
   Schlüssel (nicht `undefined`, sondern fehlend).
3. **Ohne Bezug wie bisher.** Ereignisse und Antwort byte-gleich zum Verhalten vor der Scheibe (Vergleich mit einem Lauf ohne
   die Felder).
4. **422 Form, alles oder nichts.** Nur `parentQuestionId`; nur `relation`; Relation `'duplicate'`; `parentQuestionId` leer
   und mit 129 Code-Punkten; ein Aufruf mit einer gültigen und einer ungültigen Einzelfrage: jeweils 422, **kein** Ereignis.
5. **R-LINK-01.** Unbekannte id; id einer Frage des anderen Jahrgangs; jeweils 422 mit `ruleId` `R-LINK-01`, kein Ereignis.
   Beide Problem-Antworten sind bis auf `instance` gleich (kein Existenzorakel). Kollidierende Subject-id in beiden
   Jahrgängen: der Bezug zeigt auf die Frage des eigenen Jahrgangs.
6. **R-LINK-02 im Reduzierer.** Ein Protokoll mit (a) einem zweiten `QuestionLinked` für dasselbe Kind, (b) einem
   `QuestionLinked` auf eine Bezugsfrage eines anderen Jahrgangs, (c) einem `QuestionLinked` auf sich selbst, (d) einem
   `QuestionLinked` für eine unbekannte Frage: Laden mit Kettenprüfung gelingt; die Projektion hält jeweils den ersten bzw.
   keinen Bezug; nichts wirft.
7. **Kette.** Nachfrage auf eine Nachfrage ist erlaubt; der Filter auf die oberste Frage liefert nur die direkte Nachfrage.
8. **Filter und Leseumfang.** `listQuestions({ parentQuestionId })` als Erfassung: alle Kinder, nach Nummer sortiert, `total`
   stimmt; als gebundene Fachkraft `unit-fin`: nur Kinder ihres Fachbereichs (ein Kind wird dazu an `unit-hr` zugewiesen);
   als Beobachtung: nur vorgelesene Kinder; unbekannte id: leere Liste, `total: 0`; kombiniert mit `status`.
9. **Ansichten.** Beobachtung liest eine vorgelesene Nachfrage mit `parentQuestionId`, `getQuestion(parentQuestionId)` ist
   für sie 404, solange die Bezugsfrage nicht vorgelesen ist; keine Nummer oder kein Wortlaut der Bezugsfrage steht irgendwo in
   der Ansicht der Nachfrage. `getStage` liefert eine Nachfrage auf der Bühne mit beiden Feldern.
10. **Historie.** `getQuestionHistory(kind)` enthält `QuestionLinked` mit Nutzlast; `getQuestionHistory(bezugsfrage)` nicht.
11. **Wiederholung.** Gleicher `Idempotency-Key`, gleicher Rumpf: gleiche Antwort mit Bezugsfeldern, je Kind genau ein
    `QuestionLinked`. Gleicher Schlüssel mit anderem Bezug: Verhalten nach R-IDEM-01 wie heute.
12. **If-Match.** Ohne: 428; veraltet: 412; jeweils kein Ereignis, auch kein `QuestionLinked`.
13. **Rechte.** Moderation, Koordination, Recht, Freigabe, Administration (ohne `question.capture`): 403 R-PERM-01;
    Podium, Beobachtung: wie heute. Kein Ereignis.
14. **Zusammenführen und Zurückziehen danach.** Bezugsfrage nach dem Bezug zusammengeführt bzw. zurückgezogen: das Kind behält
    `parentQuestionId`; eine zusammengeführte oder zurückgezogene Frage kann Bezugsfrage einer neuen Erfassung sein (kein
    Statuskriterium, Standard 2).
15. **Strom.** `EVENT_TOPICS.QuestionLinked` ist `['questions']`; `EVENT_SUBJECTS` nennt Kind und Bezugsfrage; nicht in
    `SCOPE_EXIT_EVENTS`; ein Abonnent, der nur die Bezugsfrage lesen darf, erhält ein Signal; eine gebundene Fachkraft, die keine
    der beiden lesen darf, erhält keines.
16. **Register und Tabellen.** R-LINK-01 und R-LINK-02 im Register mit `verified: false`; Schnappschuss von `legal-trace.md`
    mit genau zwei neuen Zeilen; Schnappschuss von `policy-truth-table.md` unverändert.
17. **Umschlag.** Ein Protokoll mit `QuestionLinked` besteht Stempeln und Laden mit Kettenprüfung; ein Typ mit Tippfehler nicht.

**Dienst ohne Postgres** (`apps/api/src/__tests__/link046.test.ts`; `createApp({ demoEnabled: true, clock, accessLog })`,
Seed über `POST /v1/demo/seed`, jede Antwort gegen den Vertrag geprüft):

- **H1** 201 mit Bezug; Antwort mit beiden Feldern; `ETag` des Redebeitrags; `/v1/events` als admin zeigt `QuestionLinked` mit
  genau der gebundenen Nutzlast.
- **H2** 422 des Validators: Paar unvollständig (beide Richtungen), unbekannte Relation, 129 Zeichen; kein Ereignis.
- **H3** 422 des Kerns R-LINK-01 für unbekannte id; Problem mit `ruleId`; die Meldung enthält die id nicht.
- **H4** `GET /v1/questions?parentQuestionId=…` und `GET /v1/meetings/{id}/questions?parentQuestionId=…`: direkte Kinder;
  unbekannte id: leere Liste; 129 Zeichen: 422.
- **H5** Wiederholung mit gleichem Schlüssel: gleiche Antwort, ein `QuestionLinked`.
- **H6** Zugriffslog eines abgewiesenen Aufrufs: acht Schlüssel, `operationId` `captureQuestions`, `status` 422, `seq` `null`;
  kein Fragetext.

**Dienst mit Postgres** (`apps/api/src/__tests__/postgres-link046.test.ts`; ohne `TEST_DATABASE_URL` übersprungen, in CI
ausgeführt):

- **P1** Erfassung mit Bezug übersteht Neustart mit Kettenprüfung; danach stimmen Bezug, Version des Kinds und der
  unveränderte Stand der Bezugsfrage; der Filter liefert das Kind.
- **P2** Ein mit R-LINK-01 abgewiesener Aufruf schreibt keine Ereigniszeile und genau eine Zugriffslogzeile mit `seq` `null`.

**Oberfläche (Einheit):**

- **W1** `followUp.test.ts`: `withReference` hängt den Bezug an jede Einzelfrage, lässt ohne Bezug alles unverändert, verändert
  die Eingabe nicht.
- **W2** `FollowUpDialog.test.tsx`: Suche nach Nummer und Stichwort (verzögert), Auswahl mit Pfeilen und Enter, Relation
  vorgewählt „Nachfrage“, Escape gibt den Fokus zurück; leer, lädt, keine Treffer, Fehler mit „Erneut versuchen“; DE und EN.
- **W3** `ContributionPane.test.tsx`: Chip mit Art und Nummer; „Bezug entfernen“; ohne `canCapture` fehlen Schaltfläche und
  Chip. Seitenebene (Test in `ContributionPane.test.tsx` oder über `followUp.ts`): nach erfolgreichem Aufruf ist der Chip weg,
  nach 412 steht er noch; Wechsel des Redebeitrags oder der Person entfernt ihn.
- **W4** `QuestionCard.test.tsx`: Badge „Nachfrage zu F-…“/„Klarstellung zu F-…“; bei 404 der neutrale Text; ohne Bezug kein
  Badge.
- **W5** `ThreadBlock.test.tsx` und `eventSummary.test.ts`: Bezugsfrage und Kinder; Bezugsfrage 404; ohne Bezug und ohne Kinder
  kein Block; Ladezustand ohne Höhensprung; Fehler; Zusammenfassung von `QuestionLinked` mit und ohne bekannte Nummer, beide
  Relationen, unbekannter Code; DE und EN.
- **W6** `http.test.ts`: `listQuestions` sendet `parentQuestionId`; `captureQuestions` reicht beide Felder im Rumpf durch.
- **W7** Paritätstest mit der neuen Zahl.

**e2e** (`apps/web/e2e/046-nachfragen.spec.ts`, gemeinsam für die Projekte in-process und `http`, Muster 031b: `test` aus
`support/http-guard`, Rollen über `asRole`, Nachweise über `support/evidence`):

- **E1 Erfassung.** Als Erfassung: Redner wählen, Redebeitrag mit dem Text aus `e2e-texts.ts` schreiben; die Nummer einer
  Bezugsfrage **lesen**, nicht fest verdrahten (erste Einzelfrage eines anderen Redebeitrags derselben Seite oder ein
  Suchtreffer); `Alt+N`, Nummer suchen, „Klarstellung“ wählen, „Bezug setzen“; Chip sichtbar; Satz markieren, `Alt+Q`; die neue
  Karte zeigt „Klarstellung zu F-…“, der Chip ist weg; eine zweite Einzelfrage ohne Bezug hat kein Badge.
- **E2 Historie.** Die neue Einzelfrage öffnen: Block „Bezug“ mit der Bezugsfrage; Klick öffnet die Bezugsfrage, deren Block
  die neue Einzelfrage unter „Nachfragen und Klarstellungen“ führt; die Zeitleiste der neuen Frage zeigt die Zusammenfassung.
- **E3 Tastatur und axe.** `Alt+N` öffnet den Dialog mit Fokus im Suchfeld, Escape gibt ihn an die Schaltfläche zurück; axe
  ohne serious/critical auf der Erfassung mit offenem Dialog und auf der Historie mit Block.
- **E4 Screenshots (nur in-process, DE und EN):** `docs/evidence/046-erfassung-de.png` und `docs/evidence/046-erfassung-en.png`
  (Erfassung mit Chip und Karte mit Badge), `docs/evidence/046-historie-de.png` und `docs/evidence/046-historie-en.png`
  (Historie mit Block „Bezug“ und Liste der Nachfragen). Synthetische Daten aus dem Seed, keine Zugangsdaten im Bild (R11).
- **Projekt `http`:** E1 und E2 laufen gegen Hono, Postgres und Keycloak als Erfassung (Standardperson des Projekts); keine
  Screenshots aus `http`. Ein schlanker Fall: Mehrzeit des Schritts gegen Vor-dem-Bau-Punkt 7 im Bericht.

**Mutationsproben** (je einmal lokal rot belegen, dann zurücknehmen): R-LINK-01 auslassen (Test 5 und H3 rot); im Reduzierer
einen zweiten Bezug übernehmen (Test 6 rot); `touch` auch für die Bezugsfrage (Test 1 rot); Bezugsfrage aus
`EVENT_SUBJECTS.QuestionLinked` entfernen (Test 15 rot); Chip nach Erfolg nicht zurücksetzen (W3 rot).

## Akzeptanzkriterium

1. Tests 1–17, H1–H6, P1–P2, W1–W7 und E1–E3 vor der Änderung rot (Ausgabe im Bericht), danach grün; die fünf
   Mutationsproben rot belegt.
2. `packages/domain/policy-truth-table.md` unverändert; `docs/legal-trace.md` um genau zwei Zeilen (R-LINK-01, R-LINK-02).
3. Vertrag 0.4.5 (oder die nächste freie Stufe): `contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`; Zahl der
   Operationen 71; `allowlist.json` unverändert; das neue Nutzlastschema ist geschlossen und ohne Freitext.
4. Kein Rollenname außerhalb von `ROLE_PERMISSIONS` (`pnpm role-literals`); keine Statuslogik außerhalb der Tabelle (die
   Prüfungen lesen keinen Status); kein Literal in Komponenten (`pnpm i18n-literals`); `pnpm vocabulary` grün; Paritätstest mit
   neuer Zahl.
5. Screenshots `docs/evidence/046-*.png` (vier Dateien, DE und EN) eingecheckt; Design-Kritik D1–D10 ohne Blocker.
6. `pnpm slice-scope` grün auf `claude/slice-046-…`.
7. `pnpm gates` mit Postgres-Variablen wie in CI grün auf einem sauberen Baucommit; Schluss einmal wörtlich im Bericht. Die Jobs
   `gates` und `e2e-http` der PR-CI grün auf dem letzten Commit (Lauf-ID im Bericht).

## Nachweise

- Rote Testausgabe vor der Änderung; Schluss von `pnpm gates` mit Commit-Hash; Ergebnis der Mutationsproben.
- Diff von `docs/legal-trace.md` im PR; Beleg, dass `policy-truth-table.md` unverändert ist.
- Auszug: eine `QuestionLinked`-Zeile aus `/v1/events`, eine Zugriffslogzeile aus H6.
- `docs/evidence/046-erfassung-de.png`, `docs/evidence/046-erfassung-en.png`, `docs/evidence/046-historie-de.png`,
  `docs/evidence/046-historie-en.png`.
- Grüne PR-CI mit Lauf-ID für P1–P2 und das Projekt `http`; Dauer des Schritts `e2e-http`.

## Qualitätswirkung

Reifestufe: demo (Freigabe-Demo), Vertrag und Kern auf Pilotniveau · Risikoklasse: hoch
Ausgelöst: [x] Fachregel [x] Vertrag, Ereignis [ ] Persistenz, Migration (nur eine weitere Ereigniszeile, keine Migration)
[ ] Rolle, Recht (kein neues Recht; Lesepfade geprüft) [ ] personenbezogene Daten (keine neuen; Lesepfade geprüft)
[ ] Betrieb [ ] Administration [x] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI [x] Dokumentation (Glossar, DSFA V3,
Bedrohungsmodell)
Perspektiven: Legal, Security, Datenschutz, Vertrag, UX · Nachweise: oben · Offene Entscheidung: E30 (betrifft 046b/c), E4
(betrifft 046d); für 046 selbst keine.

Checks: 6.1 (Regel-ID mit `legalRef`, Positiv- und Negativtest je Regel, Pflichtdaten im Kern), 6.3 (Transaktionsgrenze: ein
`append`; 412 sichtbar; Wiederholung idempotent; Aufbewahrungsklasse benannt), 6.4 (Vertrag zuerst, Changelog, Problem-Details
mit Regel-id), 6.5 (deny by default unverändert; kein Existenzorakel; Missbrauchsfall MF-15), 6.6 (kein neues Personenfeld;
DSFA V3), 6.9 (Zustände, Tastatur, axe, DE/EN), 6.12 (kein neues Konzept außer Bezug; eine Hilfsfunktion statt drei
Änderungen an den Erfassungswegen).

## Missbrauchsfälle (MF-15, neu im Bedrohungsmodell)

**MF-15 Bezug als Existenzorakel oder als Umweg zum Lesen** (046; verwandt T-G1-I-01).
- *Angriff 1:* Eine Person mit Erfassungsrecht probiert ids durch, um zu erfahren, ob es eine Frage gibt (etwa in einem
  anderen Jahrgang). *Abwehr:* R-LINK-01 antwortet für unbekannt, fremder Jahrgang und nicht lesbar gleich; der Filter liefert
  eine leere Liste. *Erkennung:* Häufung von 422 mit R-LINK-01 je `subjectHash` im Zugriffslog (V10), Auswertung nur zu zweit.
- *Angriff 2:* Über den Thread einer lesbaren Frage den Wortlaut einer nicht lesbaren Nachbarfrage sehen. *Abwehr:* Die
  Ansicht trägt nur die id, nie Nummer oder Wortlaut; Bezugsfrage und Kinder kommen über die vorhandenen Lesepfade mit
  R-PERM-03 (Tests 8, 9). *Erkennung:* keine eigene; Abdeckung durch die Negativtests.
- *Angriff 3:* Einen falschen Bezug setzen, um eine Frage als „bloße Nachfrage“ abzuwerten. *Abwehr:* Der Bezug ist
  sichtbar, unveränderlich und mit Akteur protokolliert; Korrektur nur durch Zurückziehen mit Grund und Neuerfassen.
  *Erkennung:* Historie beider Fragen.

## Aufwand

| Teil | AStd |
|---|---|
| Vertragsschritt (Architekt) mit Changelog und Typen | 0,3 |
| Kern: Typen, Ereignis, Reduzierer, `captureQuestions`, Filter, Register, Strom | 0,5 |
| Kerntests 1–17 und Mutationsproben | 0,4 |
| Dienst: Filter, H1–H6, P1–P2 | 0,3 |
| Erfassung: Dialog, Chip, Karte, Alt+N, Tests | 0,5 |
| Historie: Block, Zusammenfassung, Tests | 0,3 |
| e2e mit vier Screenshots, Einreihung in `http` | 0,2 |
| **Summe** | **2,5** (Spanne 2,0–3,25) |

Die Planzeile 046 nennt 2 AStd für alle vier Teile. Mit der Teilung ergeben sich rund 8,75 AStd (046 2,5; 046b 1,75; 046c
2,5; 046d 2,0). Die Differenz kommt aus Vertrag, Oberfläche und e2e, die der Plan für 046 nicht eingerechnet hat, und aus
Klasse hoch für alle vier Teile. Gemessene Bauzeiten der letzten Scheiben lagen weit unter Plan (048: 0,4 h gegen 3,0 AStd);
die Planung bleibt trotzdem bei AStd, die Messung führt `docs/messung.md`.

## Standards (auf Standard gebaut)

1. **Klasse hoch** für 046 (Eigentümerfrage 1).
2. **Kein Statuskriterium** an der Bezugsfrage (Eigentümerfrage 2).
3. **Bezug nur bei der Erfassung, einmalig, unveränderlich;** der Chip gilt für einen Aufruf (Eigentümerfrage 3).
4. **Bezeichnungen** „Nachfrage“/„Follow-up question“ und „Klarstellung“/„Clarification“; „Bezugsfrage“/„Referenced question“
   (Eigentümerfrage 4).
5. **Seed unverändert;** die Demo erzeugt den Thread live in der Erfassung (Eigentümerfrage 5).
6. **Reihenfolge der Teile** 046 → 046b → 046c → 046d; 046d erst nach Antwort auf E4 (Eigentümerfrage 6).
7. **Keine Anzeige auf der Bühne** in 046 (Eigentümerfrage 7).
8. **Keine Angemessenheitsgrenzen** (Eigentümerfrage 8).
9. **Notizfeld bleibt aus** (E4); kein Schalter in 046.

## Offene Eigentümerfragen

1. **Klasse.** 046 trägt kein neues Recht und kein Personenfeld, aber einen unveränderlichen Nachweis und neue Lesepfade.
   Bleibt hoch (Standard, Lesebefund vor dem Bau), oder Herabstufung auf mittel (Zeile „Herabstufung freigegeben von …“)?
2. **Nachfrage nur zu vorgelesenen Antworten?** Standard: keine Statusbedingung. Mit Bedingung entsteht eine Prüfung gegen den
   Status der Bezugsfrage, die als Guard in der Tabelle stehen müsste (rund +0,5 AStd, Klasse hoch, Perspektive Legal; Frage an
   Recht über E15).
3. **Bezug nachträglich setzen oder lösen?** Standard: nein; ein falscher Bezug wird durch Zurückziehen und Neuerfassen
   ersetzt. Mit „ja“: eigene Operation mit Recht und Ereignis (etwa `QuestionUnlinked` als kompensierendes Ereignis), rund
   1–1,25 AStd, eigene Spec.
4. **Bezeichnungen** in der Oberfläche: „Nachfrage“ und „Klarstellung“ (Standard)? Oder ein anderes Hauswort für
   `clarification` (etwa „Rückfrage“; Achtung: „Rückfrage“ ist in E4 das Notizfeld)?
5. **Thread im Seed?** Standard: nein (Korpus aus einer Quelle, 080b; Zählerstände der e2e). Mit „ja“: zwei Seed-Nachfragen,
   rund 0,25 AStd, Folgen für Zähler- und Abnahmetests.
6. **Teilung und Reihenfolge.** 046 zuerst, dann 046b (Zurückstellen), 046c (Korrektur offen), 046d (Notiz) erst nach E4.
   Tauschen 046b und 046c, wenn die Korrektur für die Demo wichtiger ist?
7. **Bühne.** Soll das Podium „Nachfrage zu F-…“ mit der Bezugsantwort sehen? Standard: nicht in 046; Kandidat für 056 oder
   eine kleine Folgescheibe (rund 0,5 AStd, Perspektive UX, Bühne ist kritischer Bildschirm).
8. **Angemessenheitsgrenzen** je Aktionär oder je Antwort (Recherche `:70`): Standard keine in der Beta; später als
   Konfiguration mit Ereignis (rund 1,5 AStd, Administration, Klasse hoch).
9. **E4 Notizfeld** (Feedback-Runde 2, 09.10.2026): bleibt Standard „aus“; 046d wird erst nach Antwort oder ausdrücklichem Go
   gebaut, und das Einschalten setzt die Prüfung der DSFA-Zeile V17 voraus.
10. **E30 Zurückstellen und Korrektur** (Recht, vor 046b/046c): Standards in den Skizzen unten (Grund als Code ohne Freitext,
    Fehlerklassen, Frist aus `VotingOpened`); die Specs 046b/046c übernehmen die Antwort.

## Skizze 046b — Zurückstellen (nicht ausgearbeitet, nicht Teil der Files allowed)

- **Ziel:** Eine Frage in Bearbeitung lässt sich mit Pflichtgrund und Wiedervorlage zurückstellen; zurückgestellt ist ein
  Kennzeichen, kein Zustand (ADR 0012). Recherche `:238`: „nie still“, „ohne Wiedervorlage praktisch identisch mit vergessen“.
- **Ereignisse:** `QuestionDeferred { reasonCode, resubmitAt }` und `QuestionResumed {}`; `reasonCode` geschlossen
  (Vorschlag: `awaiting_information`, `awaiting_other_unit`, `legal_check`, `sequencing`, `other`), **kein Freitext**
  (Invariante des Umschlags, wie 048). `resubmitAt` liegt nach der injizierten Uhr in der Zukunft.
- **Projektion und Ansicht:** `deferral { reasonCode, resubmitAt, deferredAt }` an der Frage; „Wiedervorlage fällig“ rechnet die
  Ansicht mit der injizierten Uhr (R8), nie mit `Date.now()`.
- **Regeln:** zwei Zeilen in `transitions.ts` mit Status unverändert (Muster R-TRANS-17), nächste freie Nummern beim Schreiben:
  `question.defer` aus `classified`, `assigned`, `answer_drafted`, `in_review`, `approved` mit Guard „noch nicht zurückgestellt“
  und `question.resume` mit Guard „zurückgestellt“. Offene Frage: sperrt das Kennzeichen „Auf die Bühne“ (Guard an R-TRANS-07/08)?
  Standard ja.
- **Recht:** neu `question.defer` (Standard `coordination`, `approver`; nicht admin), Wahrheitstabellen-Diff in der Spec.
- **Oberfläche:** Aktion und Badge in Steuerung (053) und Fokus (054), Zeile in der Historie. Screenshots DE/EN.
- **Klasse hoch · rund 1,75 AStd.**

## Skizze 046c — Korrektur offen (nicht ausgearbeitet, nicht Teil der Files allowed)

- **Ziel:** Eine vorgelesene Antwort, die unrichtig war, bekommt das Kennzeichen „Korrektur offen“, das nicht durch Zeitablauf
  verfällt; harte Frist ist der Abstimmungsbeginn zum betroffenen TOP (Recherche `:80`).
- **Zeile:** `question.correction.open` aus `delivered` nach `answer_drafted` (Textpfade) bzw. `classified` (Podiumspfad), wie
  R-TRANS-06 aus `delivered`, mit Pflichtangabe. Nächste freie Nummer beim Schreiben.
- **Ereignisse:** `QuestionCorrectionOpened { errorClass, correctedAnswerVersion?, agendaItemId?, toStatus, pii?: { keyId, note } }`;
  `errorClass` geschlossen (Vorschlag: `wrong_figure`, `incomplete`, `misleading`, `other`; Recherche: „Fehlerklassen statt eines
  Sammeltopfs“); freier Text nur optional im `pii`-Teil. `QuestionCorrectionClosed { answerVersion }` hängt der Kern im selben
  Befehl wie `QuestionDelivered` an, wenn eine **neue freigegebene Version** (größer als `correctedAnswerVersion`) vorgelesen
  wird; beim Podiumspfad genügt das erneute Vorlesen. Test aus dem Plan: Korrektur nach Vorlesen erzeugt eine neue Version und
  ein zweites `QuestionDelivered`.
- **Frist:** `agendaItemId` der Frage; steht für diesen TOP `votingOpenedAt` nach dem Öffnen der Korrektur, zeigt die Ansicht
  „Frist verstrichen“; das Kennzeichen bleibt bis zum Schließen. Ohne TOP: Standard „erstes `VotingOpened` irgendeines TOP nach
  dem Öffnen“ (Frage an Recht über E30). Alarm an Halter von `question.legal.clear` erst mit 085.
- **Recht:** neu `question.correction.open` (Standard `legal`, `approver`), Wahrheitstabellen-Diff.
- **Oberfläche:** Aktion in der Historie oder Beantwortung, Badge in Steuerung, dezenter Hinweis „Korrektur“ auf der Bühne
  (Recherche `:251`: Hinweisstreifen, kein Austausch unter den Augen des Vorlesenden). Perspektive Legal, Design-Kritik.
- **Klasse hoch · rund 2,5 AStd.**

## Skizze 046d — Notizfeld hinter Konfiguration (nicht ausgearbeitet, nicht Teil der Files allowed)

- **Voraussetzung:** Antwort auf E4 oder ausdrückliches Go des Eigentümers; Vermerk zur DSFA-Zeile V17 („zu prüfen, bevor
  eingeschaltet wird“). Ohne beides wird 046d nicht gebaut.
- **Schalter:** `notes: off | on` je Jahrgang, **Standard aus**; Ereignis `MeetingNotesConfigured { notes }` (Subject: Jahrgang),
  neues Recht für die Administration (Vorschlag `admin.notes.configure`), Änderung nur mit Grund, sichtbar im Jahrgang. Der
  Schalter ist Konfiguration, keine Fach- oder Sicherheitsregel (Leitplanken 6.8).
- **Notiz:** `QuestionNoteAdded { noteId, pii: { keyId, text } }`; Text nur im `pii`-Teil (ADR 0009, Crypto-Shredding),
  Aufbewahrungsklasse `working`; Länge begrenzt (Vorschlag 1000 Code-Punkte); bei `notes=off` **409** mit eigener Regel-id
  (Test aus dem Plan). Lesen und Schreiben über eigene Rechte (Vorschlag `question.note.read`/`question.note.write` für
  Koordination, gebundene Fachkraft, Recht, Freigabe).
- **Eigener Datenbereich:** eigene Projektion je Frage, nie an `QuestionRecord`, nie in `Question`, `StageView`, Volltextsuche,
  Export (051, Negativtest) oder Bühne; eigene Operationen `GET`/`POST /questions/{id}/notes`; `EventRead` entfernt den `pii`-Teil
  wie heute; der Strom sendet nur ein Änderungssignal ohne Inhalt. Kein Chat (E4).
- **Klasse hoch · rund 2,0 AStd;** Perspektive Datenschutz; DSFA-Zeile V17 und Auswertungskatalog in der Spec.

## Hinweise an den Orchestrator

- **Planzeile 046 teilen:** 046 (diese Spec, hoch · 2,5 AStd, Lanes contract, core, service, web-api, web-capture, web-history,
  web-shell, e2e, docs), dazu neue Planzeilen 046b (hoch · 1,75), 046c (hoch · 2,5) und 046d (hoch · 2,0, Abhängigkeit E4) in
  `docs/produktplan-beta.md` §5.5, damit `plan-graph` sie kennt; Kette E57 im Register entsprechend ergänzen (046b vor 060 nur,
  wenn die Demo es zeigen soll).
- **Planabweichung vom Zuschnitt aus 043a:** Antwortfeld, Filter und Ereignistyp kommen mit 046, nicht mit 043b (wie 048, 055).
- **Veraltete Regel-ids:** Plan Zeile 694 und ADR 0012 nennen R-TRANS-14..16 für die Kennzeichen; belegt sind sie seit 021c/044a.
  046 vergibt R-LINK-01/02; 046b/046c nehmen die nächste freie R-TRANS-/R-GUARD-Nummer. Doku-Takt gleicht Plan und ADR an
  (043a, Folgelisten-Eintrag 1).
- **ADR 0012, Wortlaut „Guard oder Zeile in `transitions.ts`“:** für den Bezug im Regelregister statt in der Tabelle
  (Entscheidung 3); Nachtrag beim nächsten Doku-Takt.
- **Folgeliste:** Aufbewahrungsklasse von `QuestionCaptured`/`QuestionLinked` (`working` im Code, `record` in V3) zur Frage an den
  DSB legen (wie 048, Eigentümerfrage 9 dort); Angemessenheitsgrenzen (Eigentümerfrage 8); Thread auf der Bühne (Eigentümerfrage 7).
- **Demo-Skript:** nach dem Merge eine Szene „Nachfrage zu F-n“ in der Erfassung (Minute 3–6) und den Block in der Historie
  (Minute 10–11) aufnehmen; „Nachfragen“ aus „Was bewusst nicht gezeigt wird“ streichen.

## Bericht (nach Bau ausfüllen)

```
Slice: 046-nachfragen-threads
Done: <drei Zeilen>
Evidence: <Schluss von `pnpm gates` mit Commit-Hash>, docs/evidence/046-erfassung-de.png, docs/evidence/046-erfassung-en.png,
          docs/evidence/046-historie-de.png, docs/evidence/046-historie-en.png; PR-CI gates und e2e-http: Lauf-ID
Rot vor Grün: <Testausgabe vor der Änderung>
Mutationsproben: <fünf Ergebnisse>
Vertrag: <Version, check.mjs (a)–(d)>
Laufzeit e2e-http: <Dauer vorher/nachher>
Vor-dem-Bau-Punkte: <Ergebnis je Punkt 1–8>
Open: <was nicht erledigt ist, mit Grund>
Touched: <Dateiliste>
```

## Review findings

(leer bis zum Lesebefund)
