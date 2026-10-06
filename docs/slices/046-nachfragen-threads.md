# Scheibe 046 — Nachfragen-Threads (Vertrag, Kern, Dienst, Erfassung, Historie)

**Status:** spec, überarbeitet nach Lesebefund (05.10.2026: 1 blocker, 6 major, 11 minor, 4 nit; Umsetzung je Befund im Abschnitt „Review findings“); gelesen auf `c5990c8`, Vertrag 0.4.4; erster Teil der geteilten Planzeile 046, Zuschnitt im Abschnitt „Teilung und Zuschnitt“; Oberflächenkette der Freigabe-Demo nach Register E57: … 055b → 059 → **046** → 060 → 061 → 041; auf Standard gebaut, E30 offen, E4 betrifft erst 046d). Klasse hoch: Lesebefund der Spec in frischem Kontext vor dem Bau.
**Risikoklasse:** hoch · 3,0 AStd (Spanne 2,5–3,75; Plan 046: mittel · 2 AStd für alle vier Themen der Planzeile; Begründung in „Warum hoch“ und „Aufwand“) · Plan 046: 28.10.2026 (W5), tatsächlich in der Kette E57 nach 059 · Lanes: contract (erster Commit, Architekt); core; service; web-api (nur `http.ts`); web-capture; web-history; web-shell (nur der Ereignisname); e2e; docs (Glossar, DSFA Zeile V3, Bedrohungsmodell)
**Bedrohungsmodell:** berührt T-G1-I-01 (Lesepfade: eine Verknüpfung darf weder Inhalt noch id einer Frage außerhalb des Leseumfangs offenlegen; Leitplanken 6.5, SC-03), T-G1-I-09 (Strom: Signal nur an Leser des Kinds), T-G1-E-01 (Schreibvorgang ohne Oberfläche); neuer Missbrauchsfall MF-15 (Abschnitt „Missbrauchsfälle“)
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
und Notizfeld. Zusammen sind sie rund 9,25 AStd und viermal Klasse hoch, weit über einem Agententag. Die Teilung folgt
dem Ziel des Eigentümers, der Freigabe-Demo: Was in der Demo sichtbar und wertvoll ist, kommt zuerst; was den Datenschutz
erweitert, kommt zuletzt und erst nach der Antwort auf E4.

| Teil | Thema | Inhalt | Vertrag | Klasse · AStd | Wann |
|---|---|---|---|---|---|
| **046** (diese Spec) | Nachfragen-Threads | `parentQuestionId` und `relation` beim Erfassen, Ereignis `QuestionLinked`, Filter `parentQuestionId`, `parentAnswerVersion` (vom Kern abgeleitet), Maskierung nach Lesbarkeit der Bezugsfrage, Thread in Erfassung und Historie, e2e in-process und `http`, Screenshots | erster Commit, nächste freie Patch-Stufe (heute 0.4.5) | hoch · 3,0 | **zuerst**, in der Kette E57 nach 059 |
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
  aus `getQuestionHistory`; `eventSummary.ts` fasst jedes Ereignis zusammen. Ereignisnamen: `labels.ts:105`
  (`EVENT_KEYS: Record<EventType, TKey>`), Texte in `shell.de.ts`/`shell.en.ts`. Paritätstest: 621 Schlüssel je Sprache
  (`parity.test.ts:183-185`).
- **Regelregister** (`rules.ts`): Regeln, die weder Zeile noch Guard der Tabelle sind, stehen dort (R-PERM, R-ADM,
  R-MTG, R-IDEM, R-CLAIM); `docs/legal-trace.md` ist generiert. Keine Regel R-LINK-nn vorhanden.
- **e2e.** `SHARED_SPECS` (`playwright.config.ts:38-42`) und `SHARED_FILES`/`HTTP_ORDER` (`scripts/e2e-http-031.test.mjs:26-31`)
  enden mit 055b, 080, abnahme. takt-046 hat die Grenzen des Schritts `e2e-http` angehoben und eine Dauerzeile eingeführt.
- **Ids sind nicht inhaltsleer.** Der Seed vergibt fortlaufende ids (`seed.ts:388`: Präfix plus Zähler in Basis 36); auch
  im Dienst ist eine id ein dauerhafter, vergleichbarer Schlüssel. Eine id einer nicht lesbaren Frage ist deshalb eine
  „ableitbare ID eines geschützten Vorgangs“ (Leitplanken 6.5, SC-03) und darf einem Leser ohne Leserecht nicht erscheinen
  (Entscheidung 7, Lesebefund B1).
- **Wortmeldung und Nachfrage.** `SpeakerReopenReason` kennt schon `'follow_up'` (R-SPK-05: eine beendete Wortmeldung geht nur
  mit dem Grund „Nachfrage“ zurück auf wartend, `types.ts:132-133`). Das ist die Rednerseite; die Relation `follow_up` dieser
  Scheibe ist die Frageseite. Beide bleiben getrennt, keine automatische Kopplung (Nicht-Ziel); das Glossar nennt beide Codes
  in der Zeile „Nachfrage“.
- **Lastkurve der Historie** (`features/history/lib.ts:304-320`, `loadCurve`) zählt Ereignisse je fünf Minuten. Eine Erfassung
  mit Bezug zählt dort zweifach (`QuestionCaptured` und `QuestionLinked`). Hingenommen: die Kurve zeigt Last im
  Ereignisprotokoll, nicht Fragen; `lib.ts` bleibt unberührt (Lesebefund 17).
- **Seed** enthält keine Nachfrage; er bleibt unverändert (Standard 5).

## Ziel und Entscheidungen vor Bau

Beim Erfassen einer Einzelfrage kann die erfassende Person angeben, dass sie eine **Nachfrage** oder eine **Klarstellung**
zu einer schon erfassten Einzelfrage desselben Jahrgangs ist („Nachfrage zu F-0012“). Der Bezug steht als eigenes,
unveränderliches Ereignis `QuestionLinked` im Protokoll und als Feld an der Frage. Erfassung und Historie zeigen den
Thread: die Bezugsfrage (mit der Antwortversion, auf die sich die Nachfrage bezog) und die Nachfragen zu einer Frage,
jeweils nur, soweit die lesende Person sie lesen darf; wer die Bezugsfrage nicht lesen darf, sieht nur die Art des Bezugs. **Auf
Standard gebaut:** die Entscheidungen unten tragen ihren Standard; offene Punkte stehen als Eigentümerfragen.

### 1. Datenmodell (Vertrag, `types.ts`)

- `QUESTION_RELATIONS = ['follow_up', 'clarification'] as const`, `QuestionRelation`.
  - `follow_up` = **Nachfrage**: Der Redner fragt zu einer gegebenen oder angekündigten Antwort weiter (Nachfragerecht).
  - `clarification` = **Klarstellung**: Der Redner bittet, eine Antwort oder Frage klarzustellen (Verständnisfrage).
  - Bezeichnungen nach Eigentümerfrage 4; die Codes stehen fest (Vertrag).
- `QuestionRecord` (Projektion, ungemaskt): optional `parentQuestionId: string`, `relation: QuestionRelation` und
  `parentAnswerVersion: number` (Entscheidung 2a); dazu das **interne** Feld `deliveredAnswerVersion?: number` (zuletzt
  vorgelesene Antwortversion, Entscheidung 2a), das wie `legalClearerIds` nie in einer Ansicht steht (`viewQuestion` entfernt
  es).
- `Question` (Ansicht, je Leser gemaskt, Entscheidung 7): dieselben drei Felder, aber `parentQuestionId` und
  `parentAnswerVersion` **nur, wenn die lesende Person die Bezugsfrage lesen darf**; `relation` darf allein stehen. Deshalb
  bindet der Vertrag nur in eine Richtung: `dependentRequired: { parentQuestionId: [relation], parentAnswerVersion:
  [parentQuestionId] }` (Lesebefund B1).
- `QuestionCapture`: optional `parentQuestionId` (1–128 Code-Punkte) und `relation`, **beide oder keines**
  (`dependentRequired` in beide Richtungen; das ist die Eingabe, keine Ansicht). Kein `parentAnswerVersion` in der Eingabe:
  der Kern leitet ihn ab.
- `QuestionFilter`: optional `parentQuestionId`.

### 2. Erfassung mit Bezug (`captureQuestions`)

- Jede Einzelfrage eines Aufrufs kann einen eigenen Bezug tragen; Einzelfragen ohne Bezug bleiben wie heute.
- **Prüfreihenfolge** (alle Prüfungen vor `If-Match`, wie die heutigen Text- und Spannenprüfungen): Recht
  `question.capture` (403) → Redebeitrag (404) → je Einzelfrage Text, Spanne, **Paar `parentQuestionId`/`relation`** (422 ohne
  Regel-id: nur eines von beiden, unbekannte Relation, leere id oder mehr als 128 Code-Punkte, gezählt wie der Validator, also
  nach Code-Punkten, nicht UTF-16-Einheiten) → je Einzelfrage **R-LINK-01** (422) → `If-Match` (428/412) → Anhängen.
- **Alles oder nichts:** Scheitert eine Einzelfrage, entsteht kein Ereignis, auch nicht für die übrigen.
- **Ein `append`**, in dieser Reihenfolge: je Einzelfrage `QuestionCaptured`, bei Bezug unmittelbar danach ihr
  `QuestionLinked` (derselbe Befehl, dieselbe `commandId`). So ist die Erfassung mit Bezug atomar; kein Zwischenstand „Frage
  ohne ihren Bezug“ ist lesbar.
- Die Antwort ist wie heute die Liste der Ansichten (gemaskt nach Entscheidung 7); das `ETag` bleibt die Version des
  Redebeitrags. `QuestionLinked` ändert weder die Version des Redebeitrags noch `speakerListVersion` noch die Version der
  Wortmeldung (Test 1).
- **Kein Statuskriterium** an der Bezugsfrage (Standard 2): Auch eine noch nicht beantwortete, eine zurückgezogene oder eine
  zusammengeführte Frage kann Bezugsfrage sein. Begründung: Eine Nachfrage kann sich auf eine Vorabantwort oder eine
  angekündigte Antwort beziehen; eine Statusbedingung wäre Statuslogik außerhalb der Tabelle (AGENTS.md R5) und eine still
  entschiedene Rechtsfrage (Leitplanken 6.1, Blocker). Ob eine Nachfrage nur zu vorgelesenen Antworten zulässig ist, ist
  Eigentümerfrage 2.
- Eine Bezugsfrage aus demselben Redebeitrag oder vom selben Redner ist zulässig (Recherche `:70`: „über alle Antworten,
  nicht nur über die eigene Frage“, und umgekehrt).

### 2a. `parentAnswerVersion` — auf welche vorgelesene Antwort sich die Nachfrage bezieht (Lesebefund M6, Nachprüfung, Legal)

- **Bedeutung:** die **zuletzt vorgelesene Antwortversion der Bezugsfrage zum Zeitpunkt der Erfassung**, also das, was der
  Aktionär im Saal gehört hat (Entscheidung Orchestrator, Variante a). Quelle ist `QuestionDelivered.answerVersion`
  (`events.ts:137`). Wurde die Bezugsfrage noch nie vorgelesen, oder wurde sie ohne Version vorgelesen (Podiumspfad ohne
  Antwortversion), **fehlt** das Feld. Ein neuerer Entwurf, eine neuere Freigabe oder eine noch nicht vorgelesene
  Korrektur ändert den Wert nicht.
- **Wie der Kern ihn erhält (gewählt: Projektionsfeld, nicht Protokollsuche):** Der Reduzierer pflegt am `QuestionRecord`
  das interne Feld `deliveredAnswerVersion` im Fall `QuestionDelivered`: trägt das Ereignis `answerVersion`, wird sie
  übernommen; ohne `answerVersion` bleibt der bisherige Wert. Eine Rückgabe (R-TRANS-06), ein Zurückziehen oder eine neue
  Version löschen ihn nicht (das Vorlesen bleibt eine Tatsache). `captureQuestions` liest beim Erfassen
  `parent.deliveredAnswerVersion` aus derselben Projektion, in der es R-LINK-01 prüft, und schreibt den Wert in
  `QuestionLinked`. Das ist billiger als eine Suche im Protokoll (O(1), keine zweite Lesestelle) und beim Neuaufbau der
  Projektion von selbst richtig, weil derselbe Reduzierer ihn erzeugt.
- Kein Wert vom Client, keine Uhr, keine Personendaten: eine ganze Zahl ≥ 1. Der Wert im Ereignis ist maßgeblich und bleibt,
  auch wenn die Bezugsfrage später erneut vorgelesen wird.
- Zweck: Die Recherche verlangt die „harte Verknüpfung zur Ursprungs**antwort**“ (`:256`). Wird die Antwort der Bezugsfrage
  später neu gefasst oder korrigiert (046c) und erneut vorgelesen, bleibt belegt, auf welche gehörte Fassung sich die
  Nachfrage bezog.
- Projektion und Ansicht wie `parentQuestionId`, also gemaskt nach Entscheidung 7; `deliveredAnswerVersion` selbst steht nie
  in einer Ansicht.

### 3. R-LINK-01 — Bezugsfrage im selben Jahrgang und lesbar (`rules.ts`, Art `Guard`)

- Erfüllt, wenn die Bezugsfrage in der Projektion des Jahrgangs der Erfassung steht (`state.questions`) **und**
  `can(actor, 'question.read', parent)` erlaubt.
- Verletzt → **422** mit Regel-id `R-LINK-01` und **einer** gleichlautenden Meldung für alle drei Fälle (unbekannte id,
  Frage eines anderen Jahrgangs, nicht lesbar). So verrät die Antwort nicht, ob es eine Frage mit dieser id gibt
  (MF-15). 422 statt 409, weil die Eingabe auf nichts Gültiges zeigt (wie der unbekannte Fachbereich in 048). Die Meldung
  enthält die id nicht.
- Der Fall „nicht lesbar“ ist mit den heutigen Rollen nicht herstellbar (jede Rolle mit `question.capture` liest alle
  Fragen); die Prüfung schützt eine spätere Rolle mit Erfassungsrecht und engem Leseumfang. Ein Kommentar im Code nennt das.
- **Warum nicht in `transitions.ts`.** ADR 0012 sagt „Guard oder Zeile in `transitions.ts`“. Ein Guard hängt dort an einer
  Statuszeile; die Erfassung hat keine (sie erzeugt eine Frage, sie überführt keine). Eine künstliche Zeile „Erfassen“ wäre
  neue Statuslogik. Deshalb steht R-LINK-01 wie R-ADM-01/02 im Regelregister von `rules.ts` und wird in `api.ts` geprüft.
  Abweichung vom Wortlaut des ADR, kein Widerspruch zum Sinn (Bericht nennt sie für die Folgeliste, Nit 19).
- `legalRef`: `source: 'Recherche'`; `citation`: `docs/anforderungen-recherche.md:256` („harte Verknüpfung zur
  Ursprungsantwort“; umgesetzt über `parentQuestionId` und `parentAnswerVersion`) und `:70` („Nachfrage-Threads über alle
  Antworten“); **Teilweise:** keine eigene Warteschlange, keine verkürzte Frist, keine Angemessenheitsgrenzen, keine
  Prüfschritte „echte Nachfrage oder neue Frage?“; `:195` verlangt getrennte Objekttypen mit eigenen Pflichtfeldern und
  eigener Fristuhr: hier ist die Nachfrage eine Einzelfrage mit Relation, kein eigener Objekttyp, ohne eigene Frist; eigene
  Fristen folgen für Zurückstellen und Korrektur in 046b/046c, ein eigener Objekttyp „Nachfrage“ ist nicht geplant
  (Lesebefund M6). **Ableitung (Spec 046):** Jahrgangsgrenze aus ADR 0012; Lesbarkeit und eine gleichlautende Ablehnung aus
  T-G1-I-01. „Auf Standard gebaut (Spec 046).“ `docVersion: null`, `docHash: null`, `verified: false`.

### 4. R-LINK-02 — Bezug nur bei Erfassung, einmal, unveränderlich (`rules.ts`, Art `Guard`)

- Der Kern schreibt `QuestionLinked` nur im Befehl `captureQuestions` und nur unmittelbar nach dem `QuestionCaptured`
  derselben Frage. Es gibt keine Operation zum Ändern oder Lösen eines Bezugs (Nicht-Ziel; Eigentümerfrage 3).
- Der **Reduzierer** hält die Regel auch gegen ein gefälschtes oder fehlerhaftes Protokoll. Er übernimmt ein `QuestionLinked`
  nur, wenn
  - (a) die Frage existiert,
  - (b) sie noch keinen Bezug hat,
  - (c) die Bezugsfrage in derselben Projektion existiert,
  - (d) Bezugsfrage und Frage verschieden sind,
  - (e) das **unmittelbar zuvor in dieser Projektion reduzierte Ereignis** das `QuestionCaptured` derselben Frage ist (der
    Reduzierer merkt sich Typ und `subjectId` des zuletzt angewendeten Ereignisses des Jahrgangs); tragen beide eine
    `commandId`, muss sie gleich sein. Damit ist die Bezugsfrage vor dem Kind erfasst, und ein später angehängter Bezug, auch
    auf eine unberührte Frage ohne `commandId`, bleibt ohne Wirkung (Lesebefund M4, Nachprüfung Minor 2: `version === 1`
    allein genügte nicht),
  - (f) `relation` in `QUESTION_RELATIONS` liegt und `parentAnswerVersion`, falls vorhanden, eine ganze Zahl ≥ 1 ist.
  Sonst lässt er das Ereignis ohne Wirkung (kein Wurf: Laden und Kettenprüfung eines gespeicherten Protokolls dürfen daran
  nicht scheitern, R7).
- Folge: Ein Thread ist zyklenfrei, weil ein Bezug nur im Augenblick der Erfassung entsteht und eine neue Frage nie Vorfahr
  einer älteren werden kann.
- **Regel-id im Produktivcode:** `state.ts` (Fall `QuestionLinked`) und `api.ts` (`captureQuestions`) nennen `'R-LINK-02'`
  bzw. `'R-LINK-01'` als Literal (Konstante oder Kommentar mit der id), damit die Codesuche Regel und Umsetzung verbindet
  (Lesebefund 12).
- `legalRef`: `source: 'Leitplanken'`; `citation`: AGENTS.md R7 (Ereignisse nur anhängen) und
  `docs/anforderungen-recherche.md:295` („Korrekturen nur als kompensierende Events“); **Ableitung (Spec 046):** ein
  falscher Bezug wird nicht umgeschrieben, sondern durch Zurückziehen und Neuerfassen ersetzt (R-TRANS-11). Nicht belegt.
  `verified: false`.

### 5. Ereignis `QuestionLinked` (`events.ts`, `envelope.ts`)

```ts
export type QuestionLinked = Base<'QuestionLinked', {
  parentQuestionId: string;
  relation: QuestionRelation;
  /** Last delivered answer version of the parent at capture (QuestionDelivered.answerVersion); absent if none. */
  parentAnswerVersion?: number;
}>;
```

- `subjectId` = die neue Einzelfrage (Kind); `meetingId` = Jahrgang der Erfassung; Akteur und `commandId` wie beim
  `QuestionCaptured`.
- **Gespeicherte Nutzlast genau** `{ parentQuestionId, relation, parentAnswerVersion? }`; kein `pii`-Teil, kein Freitext,
  keine Nummer, kein Wortlaut. Die Invariante des Umschlags (Personendaten nur im `pii`-Teil, seit 026) bleibt gewahrt.
- **Wiederholung:** Im Wiederholungspfad (`replayValue`, `api.ts:641-647`) maskiert `viewQuestion(question, historical)`
  und prüft die Lesbarkeit der Bezugsfrage in `source` = `historical`, also in derselben Projektion wie das Kind, nicht in
  `state` (Nachprüfung Minor 4).
- **Gelesene Nutzlast** (`EventRead`, jeder Ereignis-Lesepfad: `getQuestionHistory`, `listEvents`, Strom-Nachricht `event`):
  nur `{ relation }`. `parentQuestionId` und `parentAnswerVersion` entfernt die bestehende statische Maskierung
  (`stream.ts`, Muster `QuestionLegalCleared.note`, an den Ereignistyp gebunden) für jeden Leser; das gespeicherte Original
  behält sie (Lesebefund B1). Begründung: Die Maskierung der Ereignispfade kennt den Leser nicht (043a); eine Entfernung für
  alle ist die einzige sichere Form. Wer den Bezug lesen darf, liest ihn an der Ansicht der Frage.
- **Typ der Leseform:** `ReadEvent` (`events.ts:190`) führt für `QuestionLinked` die Nutzlast `{ relation }`, damit kein
  Lesepfad (etwa `eventSummary.ts`) die entfernten Felder typgerecht lesen kann.
- Aufbewahrungsklasse: wie `QuestionCaptured` (heute `working` durch den Standard des Umschlags). Der Widerspruch zu V3
  (`record`) betrifft beide gleich und bleibt bei der offenen Frage aus Spec 048 (Eigentümerfrage 9 dort).
- `EVENT_TYPES` erhält `QuestionLinked` nach `QuestionCaptured`; ein gespeicherter Typ bleibt für immer ladbar.

### 6. Projektion (`state.ts`)

- Fall `QuestionLinked` nach R-LINK-02: setzt `parentQuestionId`, `relation` und gegebenenfalls `parentAnswerVersion` am Kind
  und ruft `touch` für das Kind (Version und `updatedAt` wie bei jedem Ereignis der Frage; nach einer Erfassung mit Bezug steht
  das Kind also auf Version 2).
- **Die Bezugsfrage bleibt unberührt:** keine Version, kein `updatedAt`, kein Zähler. Wer gerade die Antwort der
  Bezugsfrage bearbeitet, bekommt durch eine neue Nachfrage keinen 412 (Entscheidung „Eltern-ETag stabil“, Test 1).
  Redebeitrag und Wortmeldung bleiben ebenso unberührt.
- Fall `QuestionDelivered`: zusätzlich `deliveredAnswerVersion` nach Entscheidung 2a (intern, nie in einer Ansicht).
- Keine Liste der Kinder an der Bezugsfrage in der Projektion; die Kinder liefert der Filter (Entscheidung 7).
- Zähler (`counts`), Kennzahlen und Restabdeckung ändern sich nicht. Eine „Nachfragequote“ ist Nicht-Ziel.

### 7. Lesepfade und Maskierung (Lesebefund B1, M2, M3)

- **Ansicht der Frage** (`viewQuestion`, also `getQuestion`, `listQuestions`, Antworten der Schreiboperationen):
  - `relation` steht an jeder Frage, die die lesende Person lesen darf.
  - `parentQuestionId` und `parentAnswerVersion` stehen **nur**, wenn zusätzlich `can(actor, 'question.read', parent)`
    erlaubt. Sonst fehlen beide Schlüssel (nicht `null`). Beispiele: Die Beobachtung sieht an einer vorgelesenen Nachfrage zu
    einer nicht vorgelesenen Frage nur „Nachfrage“; eine gebundene Fachkraft sieht an der Nachfrage ihres Fachbereichs die
    Bezugsfrage eines anderen Fachbereichs nicht.
  - Nummer und Wortlaut der Bezugsfrage stehen nie an der Nachfrage; wer sie lesen darf, ruft `getQuestion(parentQuestionId)`.
- **Bühne** (`getStage`, `getMeetingStage`): Fragen der Bühnenansicht tragen **nie** `parentQuestionId` oder
  `parentAnswerVersion`, auch nicht für Leser mit `question.read` (die Bühne ist ein eigenes Gerät, Prinzip 10; das Podium
  hat kein `question.read`). `relation` darf stehen; die Bühnenansicht zeigt in 046 nichts Neues (Eigentümerfrage 7).
- **Filter `parentQuestionId`** an `listQuestions` und `listMeetingQuestions`: wählt die **direkten** Nachfragen und
  Klarstellungen mit diesem `parentQuestionId` in der Projektion und filtert sie **je Kind** mit demselben Leseumfang wie jede
  Liste (`can(..., 'question.read', kind)`); die Lesbarkeit der Bezugsfrage spielt für die Auswahl keine Rolle. Die
  zurückgegebenen Ansichten sind nach der Regel oben gemaskt (Lesebefund M3). Sortierung und Paginierung wie heute; mit allen
  übrigen Filtern kombinierbar.
  - **Kern (in-process):** Der Filter wirkt, sobald `filter.parentQuestionId !== undefined`; auch `''` ist ein Filter und
    ergibt eine leere Liste. Keine Längenprüfung im Kern (wie die übrigen Listenfilter).
  - **Dienst (HTTP):** Der Validator weist `parentQuestionId=` (leer) und mehr als 128 Code-Punkte mit 422 ab, bevor der Kern
    läuft; ein fehlender Parameter filtert nicht.
- **Historie:** `getQuestionHistory(kind)` enthält `QuestionLinked` mit der gelesenen Nutzlast `{ relation }`; die Historie
  der Bezugsfrage enthält es nicht (das Ereignis gehört dem Kind).
- **Strom** (`stream.ts`): `EVENT_TOPICS.QuestionLinked = ['questions']` (Zähler ändern sich nicht);
  `EVENT_SUBJECTS.QuestionLinked` = **nur das Kind** (T-G1-I-09: ein Signal an Leser der Bezugsfrage würde die Existenz einer
  Nachfrage an Personen melden, die sie nicht lesen dürfen; die Liste der Nachfragen lädt die Historie bei ihrem eigenen
  Neuladen über das Thema `questions` nach, Lesebefund M2). Nicht in `SCOPE_EXIT_EVENTS` (der Leseumfang ändert sich nicht).

### 8. Dienst (`apps/api/src/app.ts`)

- `captureQuestions`: keine Codeänderung außer dem Typ; der Validator prüft das erweiterte Schema aus dem Vertrag (Paar,
  Enum, Länge) vor dem Kern. R-LINK-01 meldet der Kern.
- `questionFilter` (`app.ts:948`) reicht `parentQuestionId` an den Kern durch; der Validator prüft die Länge.
- Keine neue Route, kein Allowlist-Eintrag, keine Migration (das Ereignis ist eine Zeile wie jede andere).

### 9. Oberfläche Erfassung (`features/capture`)

- **Schaltfläche „Nachfrage zu …“** im Kopf des Redebeitrags (nur wenn `canCapture`, sonst fehlt sie; Prinzip 9), dazu die
  Taste `Alt+N`: erkannt über `event.code === 'KeyN'` (tastaturbelegungsfest, wie `Alt+Q` mit `KeyQ`), ohne Strg und Meta,
  und **nicht**, solange der Fokus in einem bearbeitbaren Feld liegt (`input`, `textarea`, `contenteditable`), damit
  Sonderzeichen auf `Alt+N` (etwa unter macOS) beim Schreiben ankommen (Vor-dem-Bau-Punkt 6, Lesebefund 18). Schaltfläche,
  Taste und Glossarzeile „Nachfrage“ tragen dasselbe Wort (Lesebefund 14). Beides öffnet den Dialog **„Bezug setzen“** (480 px,
  Muster der vorhandenen Dialoge):
  - Auswahl der Art: „Nachfrage“ (vorgewählt) oder „Klarstellung“ (Radiogruppe).
  - Suchfeld „Nummer oder Stichwort“, Treffer über `listQuestions({ q, limit: 8 })` mit 250 ms Verzögerung; jede Zeile zeigt
    Nummer (Mono), Auszug des Wortlauts und Status-Badge. Pfeiltasten und Enter wählen; Escape schließt und gibt den Fokus an
    die Schaltfläche zurück.
  - Zustände: leer (Hinweis „Nummer wie F-0012 oder ein Stichwort eingeben“), lädt (Skeleton-Zeilen), keine Treffer,
    Fehler (Grund, „Erneut versuchen“).
  - Primäraktion „Bezug setzen“, sekundär „Abbrechen“.
- **Chip über dem Text** des Redebeitrags: „Nachfrage zu F-0012“ bzw. „Klarstellung zu F-0012“ mit Schaltfläche „Bezug
  entfernen“ (×).
  - Der Chip gilt **nur für den nächsten Erfassungsaufruf mit genau einer Einzelfrage**: Markieren mit `Alt+Q` oder freie
    Eingabe (Lesebefund M7). Nach einem erfolgreichen Aufruf verschwindet er; nach einem Fehler (412, 422, Netz) bleibt er.
  - Die **Übernahme aus dem Vorschlagsdialog** (mehrere Einzelfragen auf einmal) übernimmt den Bezug **nicht**: Der Dialog
    zeigt bei gesetztem Chip den Hinweis „Der Bezug gilt nicht für übernommene Vorschläge“, sendet ohne Bezug, und der Chip
    bleibt danach stehen. Begründung: Ein Bezug lässt sich nicht ändern (R-LINK-02); ihn still an mehrere Fragen zu hängen,
    vervielfacht einen Bedienfehler.
  - Wechsel des Redebeitrags oder der Person (`actorId`) entfernt ihn.
  - **Warum einmalig (Standard 3):** Ein Chip, der stehen bliebe, würde vergessene Bezüge an alle weiteren Fragen hängen.
- Die Ergänzung um den Bezug geschieht an **einer** Stelle: in `Page.tsx` `captureQuestions`, über die reine Hilfsfunktion
  `withReference(items, reference)` in `followUp.ts`, die den Bezug nur bei genau einer Einzelfrage anhängt; der Vorschlagsweg
  ruft `captureQuestions` mit einem Kennzeichen „ohne Bezug“ auf.
- **Karte der Einzelfrage** (`QuestionCard.tsx`): bei `relation` ein Badge. Mit `parentQuestionId` löst die Karte die Nummer
  über `api.getQuestion(parentQuestionId)` auf (Import von `api` aus dem Ordner `apps/web/src/api` wie in den übrigen
  Erfassungskomponenten; je Bezugsfrage einmal je Ladevorgang; `QuestionsPane.tsx` bleibt unverändert, Lesebefund 15):
  „Nachfrage zu F-0012“ bzw. „Klarstellung zu F-0012“. Ohne `parentQuestionId` (gemaskt) oder bei 404: „Nachfrage“ bzw.
  „Klarstellung“ ohne Nummer. In der Erfassung tritt das heute nicht auf; die Karte zeigt es trotzdem richtig.
- Bezeichnungen der Relation über eine Funktion `relationLabel` in `apps/web/src/i18n/labels.ts` (Muster `forwardReasonLabel`).
- Keine Statusfarbe für den Bezug (Prinzip 4): neutrales Badge mit Symbol (Vorschlag: `CornerDownRight` aus lucide).

### 10. Oberfläche Historie (`features/history`)

- **Block „Bezug“** im Detail einer Frage, über der Zeitleiste und unter dem Antwortblock (`ThreadBlock.tsx`):
  - Zeile **Bezugsfrage**, wenn die Frage eine `relation` hat:
    - mit `parentQuestionId`: „Nachfrage zu F-0012“ (bzw. „Klarstellung zu …“), Auszug, Status-Badge und, falls
      `parentAnswerVersion` steht, „bezieht sich auf die vorgelesene Antwortversion 2“ (Zahl in Mono; fehlt das Feld, fehlt
      der Zusatz ganz); ein Klick öffnet die Bezugsfrage;
    - ohne `parentQuestionId` (gemaskt): „Nachfrage zu einer nicht sichtbaren Frage“, ohne Nummer, ohne Link, ohne Abruf
      (Lesebefund 8: der Block ruft nie eine id ab, die die Ansicht nicht geliefert hat).
  - Liste **„Nachfragen und Klarstellungen (n)“** aus `listQuestions({ parentQuestionId: id })`: je Zeile Nummer, Art, Auszug,
    Status-Badge, Klick öffnet die Frage. Nur direkte Nachfragen; eine Nachfrage auf eine Nachfrage erscheint an ihrer
    eigenen Bezugsfrage.
  - Hat eine Frage weder Relation noch Nachfragen, fehlt der Block ganz (kein leerer Kasten). Ladezustand: Skeleton in fester
    Höhe (nichts springt, Prinzip 8). Fehler: Grund und „Erneut versuchen“.
- **Zeitleiste:** `eventSummary.ts` fasst `QuestionLinked` aus der gelesenen Nutzlast zusammen: „Als Nachfrage erfasst“ bzw.
  „Als Klarstellung erfasst“ (die Nummer steht im Block, nicht in der Zeitleiste, weil die Ereignisnutzlast keine id trägt).
  Ein unbekannter Relationscode erscheint als Code.
- `labels.ts`: `EVENT_KEYS.QuestionLinked`, `relationLabel`.

### 11. Datenschutz und Sicherheit

- Kein neues personenbezogenes Feld: Die Nutzlast ist eine id, ein Code und eine Versionsnummer. Die DSFA-Zeile V3 nennt den
  „Bezug“ schon; sie erhält nur den Vermerk „Bezug zur Bezugsfrage und ihrer Antwortversion bei Nachfrage oder Klarstellung
  (046); id nur für Leser der Bezugsfrage“.
- Kein neuer Leser: Jede Frage und jede id bleibt nur für die lesbar, die die Frage heute lesen. Bühne und Ereignispfade tragen
  die id nie.
- Kein Existenzorakel bei der Erfassung: gleichlautende 422 bei R-LINK-01; 404 bei `getQuestion`. Der Filter verrät einem
  Leser lesbarer Kinder, dass sie auf die angegebene id zeigen; die Kinder sind für ihn ohnehin lesbar, ihre Bezugs-id
  bleibt gemaskt (hingenommen, MF-15 Angriff 4).
- Kein Fragetext in Zugriffslog oder Fehlermeldung (V10): die 422-Meldung nennt die Regel, nicht die id.

## Wahrheitstabellen-Diff (vor dem Bau, Leitplanken §4)

**Leer.** Kein neues Recht, keine neue Zeile, kein neuer Guard in `transitions.ts`, keine Änderung an `ROLE_PERMISSIONS`.
`packages/domain/policy-truth-table.md` bleibt byte-gleich (Akzeptanzkriterium 2). `docs/legal-trace.md` erhält genau zwei
Zeilen (R-LINK-01, R-LINK-02).

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6)

Additiv; keine neue Operation; kein Feld wird Pflicht; kein bestehendes Anfrageschema wird verengt.

- **Version:** nächste freie Patch-Stufe beim Merge (heute 0.4.5; ist 059 vorher gemergt, die dann nächste).
  `info.version`, `packages/contract/package.json`, Abschnitt `## [0.4.5]` in `CHANGELOG.md` mit `### Added` und `### Changed`
  und dem Vermerk „auf Standard gebaut (Spec 046)“.
- **Schema `QuestionRelation`:** `type: string`, `enum: [follow_up, clarification]`, Beschreibung je Wert (Nachfrage,
  Klarstellung); ausdrücklich ohne Freitext.
- **`QuestionCapture`:** `parentQuestionId: { type: string, minLength: 1, maxLength: 128 }` (JSON Schema zählt Code-Punkte),
  `relation: { $ref: QuestionRelation }`, `dependentRequired: { parentQuestionId: [relation], relation: [parentQuestionId] }`;
  Beschreibung: Bezugsfrage desselben Jahrgangs, R-LINK-01, unveränderlich (R-LINK-02), `parentAnswerVersion` leitet der
  Dienst ab.
- **`Question`:** `parentQuestionId` (string), `relation` (QuestionRelation), `parentAnswerVersion` (integer, `minimum: 1`;
  Beschreibung: „the answer version of the parent that had last been read out (`QuestionDelivered.answerVersion`) when this
  question was captured; absent if the parent had not been read out with a version by then; never changes afterwards“);
  **`dependentRequired: { parentQuestionId: [relation], parentAnswerVersion: [parentQuestionId] }`**, nicht umgekehrt:
  `relation` darf allein stehen. Beschreibung: „Since 0.4.5 (slice 046)“; `parentQuestionId` und `parentAnswerVersion` nur,
  wenn der Leser die Bezugsfrage lesen darf, nie in der Bühnenansicht; nie Nummer oder Wortlaut der Bezugsfrage.
- **`getStage`/`getMeetingStage`:** Beschreibung ergänzt: Fragen der Bühnenansicht tragen weder `parentQuestionId` noch
  `parentAnswerVersion`.
- **Parameter `ParentQuestionIdFilter`** (`in: query`, `name: parentQuestionId`, `string`, 1–128 Code-Punkte) an
  `listQuestions` und `listMeetingQuestions`; Beschreibung: direkte Nachfragen; jedes Kind nach dem Leseumfang der Liste,
  unabhängig von der Lesbarkeit der Bezugsfrage; Ansichten gemaskt wie `Question`.
- **`captureQuestions`:** Beschreibung ergänzt um `422` R-LINK-01 (eine Meldung für unbekannt, anderer Jahrgang, nicht
  lesbar), „alles oder nichts“ und die Ereignisfolge `QuestionCaptured`, `QuestionLinked`.
- **`Event.type`:** `QuestionLinked` nach `QuestionCaptured`; die Beschreibung von `Event` nennt die gespeicherte Form
  `{ parentQuestionId, relation, parentAnswerVersion? }` (wie `QuestionLegalCleared.note`: nur im gespeicherten Original).
- **Gebundenes Lese-Nutzlastschema `QuestionLinkedPayload`:** `additionalProperties: false`, `required: [relation]`,
  einzige Eigenschaft `relation`; in `EventRead` per `if`/`then` an `type: QuestionLinked` gebunden, nach dem Muster von
  `QuestionForwardedPayload`. Die Beschreibung von `EventRead` ergänzt die Liste der entfernten Felder um
  `parentQuestionId` und `parentAnswerVersion` von `QuestionLinked`, für jeden Leser.
- **Typen:** `pnpm contract:types`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.4 -> 0.4.5`; Versionszeilen in
  `contract.test.ts` und `takt-019-contract.test.ts`; Zahl der Operationen unverändert 71.
- **Rücknahme nach dem Merge** ist brechend (Enum-Wert, Ereignistyp; 0.5.0 nach ADR 0015); `QuestionLinked` bleibt in
  `EVENT_TYPES`. Ebenso fest sind das **geschlossene** Leseschema `QuestionLinkedPayload` (`additionalProperties: false`,
  nur `relation`) und die Bindung `parentAnswerVersion` ⇒ `parentQuestionId` in `Question`: Ein späteres Lockern (etwa die
  Bezugs-id im Ereignis für berechtigte Leser oder `parentAnswerVersion` ohne id) ist für Clients, die das geschlossene
  Schema prüfen, eine Änderung der Antwortform und wird nach ADR 0015 als eigene Vertragsstufe mit CHANGELOG-Eintrag und
  Übergangsfrist behandelt, nie als stiller Patch. Deshalb der Lesebefund vor dem Bau.

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
- Kein eigener Objekttyp „Nachfrage“ und keine eigene Fristuhr (Recherche `:195`; Fristen für Zurückstellen und Korrektur in
  046b/046c).
- Keine Kopplung an die Wortmeldung: `SpeakerReopenReason` `'follow_up'` (R-SPK-05) und die Relation bleiben unabhängig.
- Keine Übernahme des Bezugs in Erfassungsaufrufe mit mehreren Einzelfragen (Vorschlagsdialog, Entscheidung 9).
- Keine Änderung an der Lastkurve (`lib.ts`); die Doppelzählung ist hingenommen (Befund).
- Keine Änderung an Seed, Rechten, Übergängen, Zugriffslog, Persistenzschicht, Migrationen; an der Maskierung nur die an den
  Typ `QuestionLinked` gebundene Entfernung zweier Felder.

## Files allowed

Vertrag (erster Commit, Architekt):

- `packages/contract/openapi.yaml` (nur QuestionRelation, die Felder in QuestionCapture und Question, ParentQuestionIdFilter an zwei Listen, Beschreibungen von captureQuestions, getStage, getMeetingStage, Event und EventRead, Event.type-Eintrag, QuestionLinkedPayload und seine Bindung in EventRead, info.version)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/CHANGELOG.md` (nur der neue Abschnitt)
- `packages/contract/package.json` (nur Version)

Kern:

- `packages/domain/src/types.ts` (nur QUESTION_RELATIONS, QuestionRelation, QuestionRecord mit dem internen Feld deliveredAnswerVersion, QuestionCapture, QuestionFilter)
- `packages/domain/src/events.ts` (nur QuestionLinked, die Union und die Leseform von QuestionLinked in ReadEvent)
- `packages/domain/src/envelope.ts` (nur EVENT_TYPES)
- `packages/domain/src/state.ts` (nur der Fall QuestionLinked, deliveredAnswerVersion im Fall QuestionDelivered und das Merkfeld des zuletzt reduzierten Ereignisses für Regel e)
- `packages/domain/src/stream.ts` (nur EVENT_TOPICS, EVENT_SUBJECTS und die an den Typ QuestionLinked gebundene Entfernung in maskEvent)
- `packages/domain/src/api.ts` (nur captureQuestions, questionMatches, die Maskierung in viewQuestion (einschließlich Entfernen von deliveredAnswerVersion) und in getStage und, falls Vor-dem-Bau-Punkt 3 es verlangt, die Wiederholungszuordnung von captureQuestions)
- `packages/domain/src/rules.ts` (nur R-LINK-01 und R-LINK-02)
- `docs/legal-trace.md` (generiert)
- `packages/domain/src/__tests__/link046.test.ts` (neu)
- `packages/domain/src/__tests__/stream035.test.ts` (nur QuestionLinked in ALL_EVENT_TYPES und in den Erwartungen, die je Ereignistyp prüfen)

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
- `apps/web/src/features/capture/Page.tsx` (nur Bezugszustand, Alt+N, Anwendung in captureQuestions, Kennzeichen ohne Bezug für den Vorschlagsweg, Zurücksetzen)
- `apps/web/src/features/capture/SuggestDialog.tsx`, `apps/web/src/features/capture/SuggestDialog.test.tsx` (nur der Hinweis bei gesetztem Bezug)
- `apps/web/src/features/capture/ContributionPane.tsx` (nur Schaltfläche und Chip), `apps/web/src/features/capture/ContributionPane.test.tsx`
- `apps/web/src/features/capture/QuestionCard.tsx`, `apps/web/src/features/capture/QuestionCard.test.tsx` (neu)
- `apps/web/src/features/history/ThreadBlock.tsx` (neu), `apps/web/src/features/history/ThreadBlock.test.tsx` (neu)
- `apps/web/src/features/history/Page.tsx` (nur das Einsetzen des Blocks und das Öffnen einer Frage aus ihm)
- `apps/web/src/features/history/eventSummary.ts`, `apps/web/src/features/history/eventSummary.test.ts`
- `apps/web/src/i18n/labels.ts` (nur EVENT_KEYS und relationLabel)
- `apps/web/src/i18n/capture.de.ts`, `apps/web/src/i18n/capture.en.ts`
- `apps/web/src/i18n/history.de.ts`, `apps/web/src/i18n/history.en.ts`
- `apps/web/src/i18n/shell.de.ts`, `apps/web/src/i18n/shell.en.ts` (nur der Ereignisname)
- `apps/web/src/i18n/parity.test.ts` (nur die Zahl)

e2e und Nachweise:

- `apps/web/e2e/046-nachfragen.spec.ts` (neu)
- `apps/web/e2e/support/e2e-texts.ts` (nur die Konstanten dieser Scheibe und ihre Einträge in WRITTEN_TEXTS)
- `apps/web/playwright.config.ts` (nur SHARED_SPECS: die neue Datei zwischen 045 und 053, Pfadreihenfolge)
- `scripts/e2e-http-031.test.mjs` (nur SHARED_FILES und HTTP_ORDER: die neue Datei zwischen 045 und 053)
- `docs/evidence/046-*.png`

Dokumente:

- `docs/glossar.md` (nur drei Zeilen: Nachfrage mit beiden Codes, Relation und Grund der Wortmeldung nach R-SPK-05, sowie Schaltfläche „Nachfrage zu …“ mit Alt+N; Klarstellung; Bezugsfrage)
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
6. `Alt+N` frei? Prüfen in `ContributionText.tsx:146-158` (`Alt+Q` über `event.code`), `AppShell.tsx`, `RoleSwitcher.tsx` und
   `Dialog.tsx`. Erkennung über `event.code === 'KeyN'`, ohne Strg/Meta, nicht bei Fokus in `input`, `textarea` oder
   `contenteditable`. Ist die Taste belegt: eine freie Alt-Taste wählen und im Bericht nennen.
7. Laufzeit des Schritts `e2e-http` aus den letzten drei grünen Läufen notieren (Dauerzeile aus takt-046).
8. **Gemeinsame Datenbank im Projekt `http`** (Lesebefund M5). Die Dateien laufen in Pfadreihenfolge gegen eine Datenbank;
   046 läuft nach 045 und vor 053. 046 hinterlässt: einen neuen Redebeitrag mit zwei neuen Einzelfragen in `captured` (eine
   mit Bezug `clarification`, eine ohne), ohne Pfad und ohne Fachbereich; keine Klassifizierung, keine Zuweisung, keine
   Antwort, Bühne unverändert. Folgen prüfen und im Bericht festhalten:
   - **053:** S2 klassifiziert „eine Frage, die `captured` war“ über `findSteerable` (erste mit der gesuchten Schaltfläche, nie
     eine feste Nummer); das kann eine 046-Frage sein, S2 bleibt gültig. S3/S4 brauchen `classified`/`assigned`-Fragen, die
     046 nicht berührt. Die Endstandsliste im Kopf von 053 bleibt richtig.
   - **054 und 055b:** arbeiten als gebundene Fachkraft in „Finanzen“ an zugewiesenen Fragen; 046 legt keine Frage in
     „Finanzen“ an. Die Abfrage des Fragenzählers (`header-counter-questions`, 054 Zeile 60, 055b Zeile 54) wartet auf einen
     Wert, keinen festen Stand (prüfen: ist es ein Mindestwert, bleibt er erfüllt).
   - **080 und abnahme:** 080 berührt nur Wortmeldungen; prüfen, dass der Redebeitrag von 046 keine Wortmeldung in einen
     Zustand bringt, den 080 nicht erwartet (046 wählt einen Redner, den 080 nicht nutzt, oder nur einen schon sprechenden).
     Abnahme erfasst und klassifiziert eigene Fragen.
   Ist eine Annahme falsch: anhalten und melden, nicht die anderen Dateien anpassen.
9. Weichen Zeilenangaben ab: melden, nicht raten.

## Tests zuerst (rot, dann grün)

**Kern** (`packages/domain/src/__tests__/link046.test.ts`; Seed mit injizierter Uhr; Erfassung als Akteur mit Rolle
`capture`; zweiter Jahrgang wie in `meeting025.test.ts:88-160`; gebundene Fachkräfte über `assignRole` wie in
`forward048.test.ts`):

1. **Erfassung mit Nachfrage.** Ein Aufruf mit einer Einzelfrage und Bezug `follow_up` auf eine Bezugsfrage, deren Version 1
   vorgelesen wurde und die danach zurückgegeben wurde und einen **neueren Entwurf** Version 2 trägt: genau ein
   `QuestionCaptured` und unmittelbar danach (nächste `seq`, dieselbe `commandId`) genau ein `QuestionLinked`; gespeicherte
   Nutzlast genau `parentQuestionId`, `relation`, `parentAnswerVersion: 1` (die vorgelesene, nicht die neueste); kein `pii`;
   `meetingId` gleich; Ansicht (als Erfassung) mit allen drei Feldern, Version 2. Danach unverändert gegenüber vorher:
   Version und `updatedAt` der Bezugsfrage (Eltern-ETag stabil), Version der Wortmeldung, `speakerListVersion`; die Version
   des Redebeitrags steigt nur um die eine Einzelfrage (wie ohne Bezug), also bleibt das `ETag` der Antwort gleich dem eines
   Aufrufs ohne Bezug (Lesebefund 9).
2. **`parentAnswerVersion` nach Vorlesestand** (Nachprüfung, Legal):
   - Bezugsfrage nie vorgelesen (mit freigegebener Version 1 in `approved` oder `staged`): Feld fehlt in Nutzlast und Ansicht.
   - Podiumsfrage ohne Antwortversion vorgelesen (`QuestionDelivered` ohne `answerVersion`): Feld fehlt.
   - Korrektur und zweites Vorlesen: Version 1 vorgelesen, zurückgegeben, Version 2 freigegeben und vorgelesen. Eine Nachfrage,
     erfasst zwischen den beiden Vorlesungen, trägt 1; eine danach erfasste trägt 2; die erste behält 1.
   - `deliveredAnswerVersion` steht in keiner Ansicht (`getQuestion`, Liste, Bühne) der Bezugsfrage; nach Neuaufbau der
     Projektion aus dem Protokoll gleich.
3. **Gemischter Aufruf und ohne Bezug.** Drei Einzelfragen, zwei mit Bezug (`follow_up`, `clarification`), eine ohne:
   Reihenfolge Captured(1), Linked(1), Captured(2), Linked(2), Captured(3); die dritte Ansicht hat keinen der drei Schlüssel
   (fehlend, nicht `undefined`). Ein Aufruf ganz ohne Bezug: Ereignisse und Antwort gleich dem Verhalten vor der Scheibe.
4. **422 Form, alles oder nichts.** Nur `parentQuestionId`; nur `relation`; Relation `'duplicate'`; `parentQuestionId` leer;
   mit 129 Code-Punkten (darunter Zeichen außerhalb der BMP, damit UTF-16-Länge und Code-Punkte verschieden sind; 128
   Code-Punkte mit solchen Zeichen gelten als gültige Form und enden in R-LINK-01); ein Aufruf mit einer gültigen und einer
   ungültigen Einzelfrage: jeweils 422, **kein** Ereignis.
5. **R-LINK-01.** Unbekannte id; id einer Frage des anderen Jahrgangs; jeweils 422 mit `ruleId` `R-LINK-01`, kein Ereignis.
   Beide Problem-Antworten sind bis auf `instance` gleich und enthalten die id nicht. Kollidierende Subject-id in beiden
   Jahrgängen: der Bezug zeigt auf die Frage des eigenen Jahrgangs.
6. **R-LINK-02 im Reduzierer.** Ein gestempeltes Protokoll mit je einem gefälschten `QuestionLinked`:
   (a) zweiter Bezug für dasselbe Kind; (b) Bezugsfrage eines anderen Jahrgangs; (c) Bezug auf sich selbst; (d) unbekannte
   Frage; (e) **später Bezug**: ein `QuestionLinked` für eine ältere Frage A auf eine jüngere Frage B, die selbst schon auf A
   zeigt (Zyklus), angehängt nach einem weiteren Ereignis auf A und mit anderer `commandId`; (e2) dasselbe für eine Frage
   ohne Bezug, aber mit `version > 1`; (e3) eine **unberührte** ältere Frage A (Version 1, kein weiteres Ereignis, ohne
   `commandId`) und ein später angehängtes `QuestionLinked` A → B, wobei B schon auf A zeigt: nicht unmittelbar nach dem
   `QuestionCaptured` von A, also ohne Wirkung, kein Zyklus; (f) Relation `'duplicate'`; (f2) `parentAnswerVersion: 0`. Laden mit Kettenprüfung
   gelingt; die Projektion hält jeweils den ersten bzw. keinen Bezug; kein Zyklus entsteht; nichts wirft.
7. **Kette.** Nachfrage auf eine Nachfrage ist erlaubt; der Filter auf die oberste Frage liefert nur die direkte Nachfrage.
8. **Filter je Kind.**
   - Als Erfassung: alle Kinder, nach Nummer sortiert, `total` stimmt; kombiniert mit `status`.
   - Als gebundene Fachkraft `unit-fin` (Kinder an `unit-fin` und `unit-hr` zugewiesen): nur das Kind in `unit-fin`.
   - **Bezugsfrage nicht lesbar, Kind lesbar** (Bezugsfrage in `unit-hr`, Kind in `unit-fin`): die Fachkraft `unit-fin` erhält
     das Kind; seine Ansicht trägt `relation`, aber weder `parentQuestionId` noch `parentAnswerVersion` (Lesebefund M3).
   - Als Beobachtung: nur vorgelesene Kinder.
   - Unbekannte id: leere Liste, `total: 0`. **Kern:** `parentQuestionId: ''` filtert und ergibt eine leere Liste; ein Filter
     ohne den Schlüssel liefert alle Fragen wie heute.
9. **Maskierung der Ansicht** (Lesebefund B1):
   - **Beobachtung:** vorgelesene Nachfrage zu einer nicht vorgelesenen Bezugsfrage: `relation` ja, `parentQuestionId` und
     `parentAnswerVersion` fehlen; nach dem Vorlesen der Bezugsfrage erscheint `parentQuestionId` (`parentAnswerVersion` nur,
     wenn die Bezugsfrage schon bei der Erfassung vorgelesen war).
   - **Gebundene Fachkraft, anderer Fachbereich:** wie in Test 8; `getQuestion(kind)` ohne die beiden Felder; die id der
     Bezugsfrage steht nirgends in der Antwort (Suche im serialisierten JSON).
   - **Podium und Bühne:** `getStage` mit einer Nachfrage auf der Bühne, gelesen als Podium **und** als Moderation (hat
     `question.read`): weder `parentQuestionId` noch `parentAnswerVersion` in `current` oder `queue`.
   - Nummer und Wortlaut der Bezugsfrage stehen in keiner Ansicht der Nachfrage.
10. **Ereignis-Lesepfade.** `getQuestionHistory(kind)` als Erfassung, `listEvents` als admin und eine Strom-Nachricht `event`
    als admin: `QuestionLinked` mit Nutzlast genau `{ relation }`; die id der Bezugsfrage steht nicht im serialisierten
    Ereignis. `getQuestionHistory(bezugsfrage)` enthält kein `QuestionLinked`. Der gespeicherte Original-Datensatz im Store
    behält beide Felder.
11. **Wiederholung.** Gleicher `Idempotency-Key`, gleicher Rumpf: gleiche Antwort mit Bezugsfeldern, je Kind genau ein
    `QuestionLinked`. Gleicher Schlüssel mit anderem Bezug: Verhalten nach R-IDEM-01 wie heute.
12. **If-Match.** Ohne: 428; veraltet: 412; jeweils kein Ereignis, auch kein `QuestionLinked`.
13. **Rechte.** Moderation, Koordination, Recht, Freigabe, Administration (ohne `question.capture`): 403 R-PERM-01;
    Podium, Beobachtung: wie heute. Kein Ereignis.
14. **Zusammenführen und Zurückziehen danach.** Bezugsfrage nach dem Bezug zusammengeführt bzw. zurückgezogen: das Kind behält
    den Bezug; eine zusammengeführte oder zurückgezogene Frage kann Bezugsfrage einer neuen Erfassung sein (kein
    Statuskriterium, Standard 2). Neue Antwortversion oder neues Vorlesen der Bezugsfrage nach dem Bezug: `parentAnswerVersion`
    des Kinds bleibt.
15. **Strom** (T-G1-I-09, Lesebefund M2). `EVENT_TOPICS.QuestionLinked` ist `['questions']`; `EVENT_SUBJECTS.QuestionLinked`
    nennt **nur** das Kind; nicht in `SCOPE_EXIT_EVENTS`. Ein Abonnent, der die Bezugsfrage, aber nicht das Kind lesen darf
    (gebundene Fachkraft der Bezugsfrage, Kind in anderem Fachbereich), erhält **kein** Änderungssignal mit dem Kind oder der
    Bezugsfrage als Subjekt; ein Leser des Kinds erhält eines.
16. **Register und Tabellen.** R-LINK-01 und R-LINK-02 im Register mit `verified: false`; die Literale `'R-LINK-01'` und
    `'R-LINK-02'` stehen im Produktivcode (`api.ts`, `state.ts`); Schnappschuss von `legal-trace.md` mit genau zwei neuen
    Zeilen; Schnappschuss von `policy-truth-table.md` unverändert.
17. **Umschlag.** Ein Protokoll mit `QuestionLinked` besteht Stempeln und Laden mit Kettenprüfung; ein Typ mit Tippfehler nicht.

**Dienst ohne Postgres** (`apps/api/src/__tests__/link046.test.ts`; `createApp({ demoEnabled: true, clock, accessLog })`,
Seed über `POST /v1/demo/seed`, jede Antwort gegen den Vertrag geprüft):

- **H1** 201 mit Bezug; Antwort mit allen drei Feldern; `ETag` des Redebeitrags; `/v1/events` als admin zeigt `QuestionLinked`
  mit genau `{ relation }` (gebundenes Leseschema).
- **H2** 422 des Validators: Paar unvollständig (beide Richtungen), unbekannte Relation, 129 Code-Punkte; kein Ereignis.
- **H3** 422 des Kerns R-LINK-01 für unbekannte id; Problem mit `ruleId`; die Meldung enthält die id nicht.
- **H4** Beide Routen, `GET /v1/questions?parentQuestionId=…` **und** `GET /v1/meetings/{id}/questions?parentQuestionId=…`,
  je: direkte Kinder; unbekannte id: leere Liste; `parentQuestionId=` (leer): 422; 129 Code-Punkte: 422.
- **H5** Wiederholung mit gleichem Schlüssel: gleiche Antwort, ein `QuestionLinked`.
- **H6** Zugriffslog eines abgewiesenen Aufrufs: acht Schlüssel, `operationId` `captureQuestions`, `status` 422, `seq` `null`;
  kein Fragetext, keine id der Bezugsfrage.
- **H7** `GET /v1/meetings/{id}/stage` mit einer Nachfrage auf der Bühne: ohne `parentQuestionId` und `parentAnswerVersion`.

**Dienst mit Postgres** (`apps/api/src/__tests__/postgres-link046.test.ts`; ohne `TEST_DATABASE_URL` übersprungen, in CI
ausgeführt):

- **P1** Erfassung mit Bezug übersteht Neustart mit Kettenprüfung; danach stimmen Bezug, `parentAnswerVersion`, Version des
  Kinds und der unveränderte Stand der Bezugsfrage; der Filter liefert das Kind; die gespeicherte Zeile trägt beide Felder,
  `/v1/events` nur `relation`.
- **P2** Ein mit R-LINK-01 abgewiesener Aufruf schreibt keine Ereigniszeile und genau eine Zugriffslogzeile mit `seq` `null`.

**Oberfläche (Einheit):**

- **W1** `followUp.test.ts`: `withReference` hängt den Bezug an eine einzelne Einzelfrage, lässt mehrere Einzelfragen und
  „ohne Bezug“ unverändert, verändert die Eingabe nicht.
- **W2** `FollowUpDialog.test.tsx`: Suche nach Nummer und Stichwort (verzögert), Auswahl mit Pfeilen und Enter, Relation
  vorgewählt „Nachfrage“, Escape gibt den Fokus zurück; leer, lädt, keine Treffer, Fehler mit „Erneut versuchen“; DE und EN.
- **W3** `ContributionPane.test.tsx` und `SuggestDialog.test.tsx`: Chip mit Art und Nummer; „Bezug entfernen“; ohne
  `canCapture` fehlen Schaltfläche und Chip; `Alt+N` öffnet den Dialog, aber nicht bei Fokus in einem Eingabefeld. Nach
  erfolgreichem Einzelaufruf ist der Chip weg, nach 412 steht er noch; Wechsel des Redebeitrags oder der Person entfernt ihn.
  **Vorschlagsdialog bei gesetztem Chip:** Hinweis „Der Bezug gilt nicht für übernommene Vorschläge“ sichtbar; die übernommenen
  Einzelfragen werden ohne Bezug gesendet; der Chip steht danach noch (Lesebefund M7).
- **W4** `QuestionCard.test.tsx`: Badge „Nachfrage zu F-…“/„Klarstellung zu F-…“; ohne `parentQuestionId` oder bei 404 nur
  „Nachfrage“/„Klarstellung“ ohne Abruf bzw. ohne Nummer; ohne `relation` kein Badge.
- **W5** `ThreadBlock.test.tsx` und `eventSummary.test.ts`: Bezugsfrage mit „bezieht sich auf die vorgelesene
  Antwortversion N“ nur bei vorhandenem Feld (ohne Feld kein Zusatz) und Kinder; ohne `parentQuestionId`
  die Zeile „nicht sichtbare Frage“ **ohne** Abruf; ohne Relation und ohne Kinder kein Block; Ladezustand ohne Höhensprung;
  Fehler; Zusammenfassung von `QuestionLinked` aus `{ relation }`, beide Relationen, unbekannter Code; DE und EN.
- **W6** `http.test.ts`: `listQuestions` sendet `parentQuestionId`; `captureQuestions` reicht beide Felder im Rumpf durch.
- **W7** Paritätstest mit der neuen Zahl.

**e2e** (`apps/web/e2e/046-nachfragen.spec.ts`, gemeinsam für die Projekte in-process und `http`, Muster 031b: `test` aus
`support/http-guard`, Rollen über `asRole`, Nachweise über `support/evidence`; im Projekt `http` in Pfadreihenfolge zwischen
045 und 053, Abhängigkeiten in Vor-dem-Bau-Punkt 8):

- **E1 Erfassung.** Als Erfassung: Redner wählen, Redebeitrag mit dem Text aus `e2e-texts.ts` schreiben; die Nummer einer
  Bezugsfrage **lesen**, nicht fest verdrahten (Suchtreffer im Dialog); `Alt+N`, Nummer suchen, „Klarstellung“ wählen, „Bezug
  setzen“; Chip sichtbar; Satz markieren, `Alt+Q`; die neue Karte zeigt „Klarstellung zu F-…“, der Chip ist weg; eine zweite
  Einzelfrage ohne Bezug hat kein Badge.
- **E2 Historie.** Die neue Einzelfrage öffnen: Block „Bezug“ mit der Bezugsfrage; Klick öffnet die Bezugsfrage, deren Block
  die neue Einzelfrage unter „Nachfragen und Klarstellungen“ führt; die Zeitleiste der neuen Frage zeigt „Als Klarstellung
  erfasst“.
- **E3 Tastatur und axe.** `Alt+N` öffnet den Dialog mit Fokus im Suchfeld, Escape gibt ihn an die Schaltfläche zurück; axe
  ohne serious/critical auf der Erfassung mit offenem Dialog und auf der Historie mit Block.
- **E4 Screenshots (nur in-process, DE und EN):** `docs/evidence/046-erfassung-de.png` und `docs/evidence/046-erfassung-en.png`
  (Erfassung mit Chip und Karte mit Badge), `docs/evidence/046-historie-de.png` und `docs/evidence/046-historie-en.png`
  (Historie mit Block „Bezug“ und Liste der Nachfragen). Synthetische Daten aus dem Seed, keine Zugangsdaten im Bild (R11).
- **Projekt `http`:** E1 und E2 laufen gegen Hono, Postgres und Keycloak als Erfassung (Standardperson des Projekts); keine
  Screenshots aus `http`. Ein schlanker Fall: Mehrzeit des Schritts gegen Vor-dem-Bau-Punkt 7 im Bericht.

**Mutationsproben** (je einmal lokal rot belegen, dann zurücknehmen):
1. R-LINK-01 auslassen (Test 5 und H3 rot).
2. Im Reduzierer Regel (e) auf `version === 1` zurückstellen (Test 6e3 rot).
3. `touch` auch für die Bezugsfrage (Test 1 rot).
4. Bezugsfrage zu `EVENT_SUBJECTS.QuestionLinked` **hinzufügen** (Test 15 rot).
5. Maskierung in `viewQuestion` auslassen (Test 9 rot); Entfernung in `maskEvent` auslassen (Test 10 rot).
6. Chip nach Erfolg nicht zurücksetzen (W3 rot).
7. `parentAnswerVersion` aus der neuesten statt der vorgelesenen Version (Test 1 und 2 rot).

## Akzeptanzkriterium

1. Tests 1–17, H1–H7, P1–P2, W1–W7 und E1–E3 vor der Änderung rot (Ausgabe im Bericht), danach grün; die sieben
   Mutationsproben rot belegt.
2. `packages/domain/policy-truth-table.md` unverändert; `docs/legal-trace.md` um genau zwei Zeilen (R-LINK-01, R-LINK-02).
3. Vertrag 0.4.5 (oder die nächste freie Stufe): `contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`; Zahl der
   Operationen 71; `allowlist.json` unverändert; das neue Leseschema ist geschlossen, trägt nur `relation` und keinen Freitext;
   `Question` bindet `dependentRequired` nur in Richtung `parentQuestionId` ⇒ `relation`, `parentAnswerVersion` ⇒ `parentQuestionId`.
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
- Auszug: eine `QuestionLinked`-Zeile aus `/v1/events` (nur `relation`), eine Zugriffslogzeile aus H6, ein Ausschnitt der
  Bühnenansicht aus H7 ohne Bezugs-id.
- `docs/evidence/046-erfassung-de.png`, `docs/evidence/046-erfassung-en.png`, `docs/evidence/046-historie-de.png`,
  `docs/evidence/046-historie-en.png`.
- Grüne PR-CI mit Lauf-ID für P1–P2 und das Projekt `http`; Dauer des Schritts `e2e-http`.

## Qualitätswirkung

Reifestufe: demo (Freigabe-Demo), Vertrag und Kern auf Pilotniveau · Risikoklasse: hoch
Ausgelöst: [x] Fachregel [x] Vertrag, Ereignis [ ] Persistenz, Migration (nur eine weitere Ereigniszeile, keine Migration)
[ ] Rolle, Recht (kein neues Recht) [x] Schutz geschützter Vorgänge (Maskierung der Bezugs-id je Leser, SC-03)
[ ] personenbezogene Daten (keine neuen)
[ ] Betrieb [ ] Administration [x] Oberfläche, Barrierefreiheit [ ] Nachbarsystem [ ] KI [x] Dokumentation (Glossar, DSFA V3,
Bedrohungsmodell)
Perspektiven: Legal, Security, Datenschutz, Vertrag, UX · Nachweise: oben · Offene Entscheidung: E30 (betrifft 046b/c), E4
(betrifft 046d); für 046 selbst keine.

Checks: 6.1 (Regel-ID mit `legalRef`, Positiv- und Negativtest je Regel, Pflichtdaten im Kern), 6.3 (Transaktionsgrenze: ein
`append`; 412 sichtbar; Wiederholung idempotent; Aufbewahrungsklasse benannt), 6.4 (Vertrag zuerst, Changelog, Problem-Details
mit Regel-id), 6.5 (deny by default unverändert; keine ableitbare id geschützter Vorgänge, Maskierung in Ansicht, Bühne und
Ereignispfaden; kein Existenzorakel bei der Erfassung; Missbrauchsfall MF-15), 6.6 (kein neues Personenfeld;
DSFA V3), 6.9 (Zustände, Tastatur, axe, DE/EN), 6.12 (kein neues Konzept außer Bezug; eine Hilfsfunktion statt drei
Änderungen an den Erfassungswegen).

## Missbrauchsfälle (MF-15, neu im Bedrohungsmodell)

**MF-15 Bezug als Existenzorakel oder als Umweg zum Lesen** (046; verwandt T-G1-I-01, T-G1-I-09).
- *Angriff 1:* Eine Person mit Erfassungsrecht probiert ids durch, um zu erfahren, ob es eine Frage gibt (etwa in einem
  anderen Jahrgang). *Abwehr:* R-LINK-01 antwortet für unbekannt, fremder Jahrgang und nicht lesbar gleich und nennt die id
  nicht. *Erkennung:* Häufung von Antworten 422 auf `captureQuestions` je `subjectHash` im Zugriffslog (V10; das Log führt
  `operationId` und Status, keine Regel-id), Auswertung nur zu zweit (Lesebefund 11).
- *Angriff 2:* Über den Thread einer lesbaren Frage id, Nummer oder Wortlaut einer nicht lesbaren Bezugsfrage erfahren.
  *Abwehr:* `parentQuestionId` und `parentAnswerVersion` nur für Leser der Bezugsfrage; nie auf der Bühne, nie in einem
  Ereignis-Lesepfad; Nummer und Wortlaut nie an der Nachfrage (Tests 8, 9, 10, H7). *Erkennung:* keine eigene; Abdeckung durch
  die Negativtests.
- *Angriff 3:* Über den Strom erfahren, dass zu einer lesbaren Frage eine nicht lesbare Nachfrage erfasst wurde. *Abwehr:*
  `EVENT_SUBJECTS.QuestionLinked` nennt nur das Kind (Test 15).
- *Angriff 4 (hingenommen):* Mit dem Filter `parentQuestionId` und einer bekannten id prüfen, ob lesbare Kinder auf sie
  zeigen. Die Kinder sind für die Person ohnehin lesbar; ihre Bezugs-id bleibt gemaskt; preisgegeben wird nur, dass eine
  bekannte id die Bezugsfrage ist. Wer die id nicht kennt, erfährt nichts.
- *Angriff 5:* Einen falschen Bezug setzen, um eine Frage als „bloße Nachfrage“ abzuwerten. *Abwehr:* Der Bezug ist
  sichtbar, unveränderlich und mit Akteur protokolliert; Korrektur nur durch Zurückziehen mit Grund und Neuerfassen.
  *Erkennung:* Historie beider Fragen.

## Aufwand

| Teil | AStd |
|---|---|
| Vertragsschritt (Architekt) mit Changelog und Typen | 0,3 |
| Kern: Typen, Ereignis, Reduzierer (a–f), `captureQuestions` mit `parentAnswerVersion`, Filter, Register, Strom | 0,55 |
| Maskierung in Ansicht, Bühne und `maskEvent`, Leseform in `ReadEvent` | 0,3 |
| Kerntests 1–17 und Mutationsproben | 0,5 |
| Dienst: Filter, H1–H7, P1–P2 | 0,3 |
| Erfassung: Dialog, Chip (nur Einzelaufruf), Hinweis im Vorschlagsdialog, Karte, Alt+N, Tests | 0,55 |
| Historie: Block, Zusammenfassung, Tests | 0,3 |
| e2e mit vier Screenshots, Einreihung in `http`, Prüfung der Folgedateien | 0,2 |
| **Summe** | **3,0** (Spanne 2,5–3,75) |

Die Planzeile 046 nennt 2 AStd für alle vier Teile. Mit der Teilung ergeben sich rund 9,25 AStd (046 3,0; 046b 1,75; 046c
2,5; 046d 2,0). Die Differenz kommt aus Vertrag, Maskierung, Oberfläche und e2e, die der Plan für 046 nicht eingerechnet hat,
und aus Klasse hoch für alle vier Teile. Gemessene Bauzeiten der letzten Scheiben lagen weit unter Plan (048: 0,4 h gegen
3,0 AStd); die Planung bleibt trotzdem bei AStd, die Messung führt `docs/messung.md`.

## Standards (auf Standard gebaut)

1. **Klasse hoch** für 046 (Eigentümerfrage 1).
2. **Kein Statuskriterium** an der Bezugsfrage (Eigentümerfrage 2).
3. **Bezug nur bei der Erfassung, einmalig, unveränderlich;** der Chip gilt für einen Aufruf mit genau einer Einzelfrage,
   nicht für übernommene Vorschläge (Eigentümerfrage 3).
4. **Bezeichnungen** „Nachfrage“/„Follow-up question“ und „Klarstellung“/„Clarification“; „Bezugsfrage“/„Referenced question“
   (Eigentümerfrage 4).
5. **Seed unverändert;** die Demo erzeugt den Thread live in der Erfassung (Eigentümerfrage 5).
6. **Reihenfolge der Teile** 046 → 046b → 046c → 046d; 046d erst nach Antwort auf E4 (Eigentümerfrage 6).
7. **Keine Anzeige auf der Bühne** in 046 (Eigentümerfrage 7).
8. **Keine Angemessenheitsgrenzen** (Eigentümerfrage 8).
9. **Notizfeld bleibt aus** (E4); kein Schalter in 046.
10. **Maskierung:** Bezugs-id und Antwortversion nur für Leser der Bezugsfrage; nie auf der Bühne; in allen Ereignis-Lesepfaden
    für jeden Leser entfernt (Entscheidung Orchestrator zu Lesebefund B1, Variante a).
11. **`parentAnswerVersion`** = zuletzt vorgelesene Antwortversion der Bezugsfrage bei der Erfassung, vom Kern aus dem internen
    Projektionsfeld `deliveredAnswerVersion` abgeleitet, ohne Personendaten (Entscheidung Orchestrator zu M6 und zur Nachprüfung).

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
7. **Bühne.** Soll das Podium „Nachfrage zu F-…“ mit der Bezugsantwort sehen? Standard: nicht in 046, die Bühnenansicht trägt
   die Bezugs-id nie; eine Anzeige bräuchte eine eigene, auf das Podium zugeschnittene Lesefreigabe; Kandidat für 056 oder
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

- **Planzeile 046 teilen:** 046 (diese Spec, hoch · 3,0 AStd, Lanes contract, core, service, web-api, web-capture, web-history,
  web-shell, e2e, docs), dazu neue Planzeilen 046b (hoch · 1,75), 046c (hoch · 2,5) und 046d (hoch · 2,0, Abhängigkeit E4) in
  `docs/produktplan-beta.md` §5.5, damit `plan-graph` sie kennt; Kette E57 im Register entsprechend ergänzen (046b vor 060 nur,
  wenn die Demo es zeigen soll).
- **Planabweichung vom Zuschnitt aus 043a:** Antwortfeld, Filter und Ereignistyp kommen mit 046, nicht mit 043b (wie 048, 055).
- **Veraltete Regel-ids:** Plan Zeile 694 und ADR 0012 nennen R-TRANS-14..16 für die Kennzeichen; belegt sind sie seit 021c/044a.
  046 vergibt R-LINK-01/02; 046b/046c nehmen die nächste freie R-TRANS-/R-GUARD-Nummer. Doku-Takt gleicht Plan und ADR an
  (043a, Folgelisten-Eintrag 1).
- **ADR 0012, Wortlaut „Guard oder Zeile in `transitions.ts`“:** für den Bezug im Regelregister statt in der Tabelle
  (Entscheidung 3); der Bericht nennt die Abweichung, der Orchestrator trägt sie in die Folgeliste ein (Nit 19); Nachtrag
  beim nächsten Doku-Takt.
- **Folgeliste:** Aufbewahrungsklasse von `QuestionCaptured`/`QuestionLinked` (`working` im Code, `record` in V3) zur Frage an den
  DSB legen (wie 048, Eigentümerfrage 9 dort); Angemessenheitsgrenzen (Eigentümerfrage 8); Thread auf der Bühne (Eigentümerfrage 7).
- **Demo-Skript:** nach dem Merge eine Szene „Nachfrage zu F-n“ in der Erfassung (Minute 3–6) und den Block in der Historie
  (Minute 10–11) aufnehmen; „Nachfragen“ aus „Was bewusst nicht gezeigt wird“ streichen.

## Bericht (nach Bau ausfüllen)

```
Slice: 046-nachfragen-threads
Done: Vertrag 0.4.5 (QuestionRelation, Bezugspaar in QuestionCapture, drei Felder an Question mit einseitigem
      dependentRequired, Filter parentQuestionId an beiden Listen, Event.type QuestionLinked, geschlossenes
      QuestionLinkedPayload); Kern mit R-LINK-01 (gleichlautende 422 ohne id), R-LINK-02 im Reduzierer (a–f, Regel e
      über das Merkfeld State.lastReduced), parentAnswerVersion aus dem internen deliveredAnswerVersion, Maskierung in
      Ansicht, Bühne, maskEvent und Strom; Dienst reicht den Filter durch; Erfassung mit Schaltfläche „Nachfrage zu …“,
      Alt+B, Dialog „Bezug setzen“, Chip nur für den nächsten Einzelaufruf, Badge an der Karte; Historie mit Block
      „Bezug“ und Zeitleistenzeile; e2e in-process und Einreihung in http zwischen 045 und 053.
Evidence: pnpm gates mit TEST_DATABASE_URL/TEST_RUNTIME_DATABASE_URL (eigene Datenbank hv_test_s046) auf dem sauberen
          Baucommit 3a91c68, exit 0; Tests domain 526, web 846, api 701 (P1–P2 liefen, nichts übersprungen); Schluss:
            ✓ built in 2.05s
            mark-test-run: wrote /home/user/wt/s046/.claude/state/last-test-run (clean tree) at commit 3a91c68, tree fe9a46ef03cd…
          docs/evidence/046-erfassung-de.png, docs/evidence/046-erfassung-en.png, docs/evidence/046-historie-de.png,
          docs/evidence/046-historie-en.png; PR-CI gates und e2e-http: offen (nicht gepusht, Auftrag)
Rot vor Grün:
  Kern link046.test.ts vor der Kernänderung: „Tests 31 failed | 4 passed (35)“ (erster Lauf vor dem WIP-Commit; nach dem
    Abbruch erneut belegt durch vorübergehendes Zurücksetzen der Kerndateien auf 14d8995 mit den endgültigen Tests:
    wieder 31 failed | 4 passed). Grün: 35 passed; ganzes Paket 526 passed.
  Dienst link046.test.ts: gegen den Kernstand 14d8995 und app.ts ohne Filter 5 failed | 2 passed (H2 und H6 grün, weil
    der Validator aus dem Vertragsschritt sie schon trägt: Vertrag zuerst); nur app.ts zurückgesetzt: H4 rot. Grün 7/7,
    mit dem Test-16-Dateiteil 8/8.
  Postgres postgres-link046.test.ts gegen Kern 14d8995: 2 failed (P1, P2). Grün 2/2.
  Oberfläche (9 Dateien) vor der Umsetzung: 3 Dateien nicht ladbar (followUp, FollowUpDialog, ThreadBlock), 15 Tests rot
    in http, parity, eventSummary, ContributionPane, QuestionCard, SuggestDialog. Grün 846/846. Die i18n-Schlüssel und
    labels.ts entstanden vor den Tests; die Paritätszahl war trotzdem rot (falsch gezählt, korrigiert auf 648).
  e2e 046-nachfragen.spec.ts in-process: erster Lauf rot (axe Farbkontrast text-ink-500 bei 11 px), nach Anhebung auf
    text-ink-600 2/2 grün.
Mutationsproben (je lokal rot, danach zurückgenommen):
  1 R-LINK-01 ausgelassen: Kern Test 4 (128-Code-Punkte-Fall) und Test 5 rot; Dienst H3 rot.
  2 Regel (e) auf version === 1: Test 3 (Paar mit anderer commandId), Test 6e3 und Merkfeld-Test rot.
  3 touch auch für die Bezugsfrage: Test 1, Test 6e3, Test 14 rot.
  4 Bezugsfrage in EVENT_SUBJECTS.QuestionLinked: Test 15 rot.
  5 Maskierung in viewQuestion ausgelassen: Test 8 (Kind lesbar, Bezugsfrage nicht) und drei Fälle von Test 9 rot;
    Entfernung in maskEvent ausgelassen: Test 10 rot.
  6 Chip nach Erfolg nicht zurückgesetzt (heldAfterCapture gibt immer den Bezug zurück): W3 in followUp.test.ts rot.
  7 parentAnswerVersion aus der neuesten statt der vorgelesenen Version: Test 1 und Test 2 rot.
  Zusatz: Kopie des Merkfelds in snapshotBefore ausgelassen: der Kopietest rot.
Minors der Nachprüfung (Orchestrator): (1) Test 2 prüft deliveredAnswerVersion auch in der Antwort einer Wiederholung
  (deliverQuestion mit gleichem Idempotency-Key, replayValue/viewQuestion(…, historical)); (2) Kommentar „last delivered
  with a version“ an QuestionRecord.deliveredAnswerVersion und im Fall QuestionDelivered; (3) Test 3 belegt das legitime
  Paar Captured+Linked ohne commandId und mit gleicher commandId (wirkt) und mit anderer commandId (wirkt nicht);
  (4) Regel (e) über State.lastReduced, gesetzt am Ende von reduce für jedes Ereignis dieses Jahrgangs (angewendet oder
  nicht, nicht beim frühen Rücksprung für fremde Jahrgänge), kopiert in snapshotBefore; Tests „rule (e) memo“ und
  „the memo is carried by snapshotBefore copies“.
Vertrag: 0.4.5 (Integrationszweig noch 0.4.4); check.mjs (a)–(d) ok, (c) „0.4.4 -> 0.4.5“; contract:lint 12 Warnungen
  wie auf der Basis; allowlist.json unverändert; zweiter Lauf von contract:types ohne Diff. Zahl der Operationen 70
  laut check.mjs, auch auf der Basis (die Spec nennt 71: Zählfehler der Spec, keine Änderung).
Laufzeit e2e-http: vorher (Schritt „End-to-end http project“, letzte drei grüne PR-Läufe mit ausgeführtem Job)
  5:49 (37381243659), 5:06 (37369284554), 4:52 (37360163818); nachher: offen bis zur PR-CI. 046 läuft dort mit E1 und E2.
Vor-dem-Bau-Punkte:
  1 Vertrag 0.4.4 ohne QuestionLinked/QuestionRelation/ParentQuestionIdFilter, R-LINK frei: erfüllt.
  2 059 nicht vor 046 gemergt: 0.4.5 bleibt.
  3 Wiederholung: die Zuordnung filtert QuestionCaptured, QuestionLinked stört nicht; keine Änderung nötig. Test 11/H5.
    Die Maskierung im Wiederholungspfad prüft die Bezugsfrage in `historical` (viewQuestion(…, source)).
  4 Kein Test gleicht Event.type mit EVENT_TYPES oder labels.ts ab oder zählt QuestionCapture; ALL_EVENT_TYPES in
    stream035 ergänzt (erlaubt). Neuer Befund: api.test.ts:500 und :513 weisen ReadEvent[] einem DomainEvent[] zu; eine
    ReadEvent-Leseform { relation } wäre nicht zuweisbar (Scope-Befund, siehe Open).
  5 eventSummary.ts ohne default-Zweig; Fall ergänzt, W5 belegt ihn.
  6 Alt+N ist belegt (AppShell: Navigation ein- und ausklappen, Alt+N außerhalb von Eingabefeldern). Gewählt: Alt+B
    („Bezug“), event.code KeyB, ohne Strg/Meta, nicht in input/textarea/select/contenteditable; in der App frei.
    Glossarzeile nennt Alt+B.
  7 siehe Laufzeit e2e-http.
  8 Gemeinsame Datenbank http: 046 hinterlässt beim Redner am Mikrofon einen weiteren Redebeitrag mit zwei Fragen in
    captured (eine Klarstellung einer Seed-Frage aus dem Suchwort, eine ohne Bezug), ohne Pfad und Fachbereich, Bühne
    unverändert, kein Chip. 053: findSteerable nimmt die erste passende captured-Frage, auch eine aus 046, S2 bleibt
    gültig; S3/S4 unberührt. 054 und 055b: Zähler wartet auf >= CORPUS_DEMO.questions (Mindestwert), keine Frage in
    Finanzen. 080 prüft nur Layout der Wortmeldeliste; 046 ändert keinen Rednerstatus. Abnahme ruft einen eigenen Redner
    auf. Lokal nicht im http-Projekt ausgeführt (kein Keycloak), Beleg folgt mit der PR-CI.
  9 Zeilenangaben stimmten im Wesentlichen; Abweichung: 71 statt 70 Operationen (oben).
Abweichung ADR 0012: R-LINK-01/02 im Regelregister statt in transitions.ts (für die Folgeliste, Eintrag durch den Orchestrator)
Open:
  - ReadEvent-Leseform: Spec Entscheidung 5 verlangt für QuestionLinked die Nutzlast { relation } im Typ ReadEvent. Das
    bricht packages/domain/src/__tests__/api.test.ts:500/:513 (DomainEvent[][] nimmt ReadEvent[] auf),
    außerhalb Files allowed. Umgesetzt stattdessen: ReadEvent unverändert, eigener Typ QuestionLinkedReadPayload in
    events.ts, eventSummary.ts liest nur relation über diesen Typ. Laufzeit und Vertrag sind geschlossen (maskEvent,
    QuestionLinkedPayload). Für die Folgeliste: api.test.ts auf ReadEvent[][] umstellen, dann ReadEvent einengen.
  - Test 16, Dateiteil: das Paket domain darf node:fs nicht importieren (arch-Tor); die Literalprüfung in api.ts/state.ts
    und die zwei Zeilen in legal-trace.md stehen deshalb in apps/api/src/__tests__/link046.test.ts.
  - stream.ts: über die Spec-Liste hinaus kopiert snapshotBefore das Merkfeld lastReduced (Auftrag des Orchestrators,
    Nachprüfung Minor 4), mit eigenem Test.
  - W2/W3 ohne DOM: das Web-Paket hat keine DOM-Testumgebung; Dialog, Chip, Alt+B und Suche sind als reine Funktionen
    (followUp.ts) und statische Darstellungen getestet, die Interaktion (Fokus beim Öffnen, Escape zur Schaltfläche,
    Alt+B nicht im Eingabefeld, Pfeile/Enter) in e2e E1/E3.
  - Dialogbreite: die Dialog-Komponente kennt nur feste Größen; md = max-w-lg (512 px) statt 480 px.
  - 003-answers-stage.spec.ts war im vollen in-process-Lauf (182 grün, 1 übersprungen, 1 rot) und in einem Wiederholungslauf
    rot (Klick auf history-tab-stream läuft in den Zeitablauf), danach 6/6 grün; auf der Basis 4/4 grün. Wahrscheinlich
    Last (parallele Builds), aber nicht ausgeschlossen, dass der neue Block die Historie belastet; für den Review.
  - Lint-Warnung (keine Fehler): unicorn(no-useless-spread) in link046.test.ts Test 8.
  - PR-CI (gates, e2e-http) mit Lauf-ID und Dauer des Schritts e2e-http: offen, nicht gepusht.
  - Design-Kritik D1–D10: nicht Teil dieses Laufs.
Touched: packages/contract/{openapi.yaml,src/types.ts,CHANGELOG.md,package.json}; packages/domain/src/{types,events,
  envelope,state,stream,api,rules}.ts, __tests__/link046.test.ts, __tests__/stream035.test.ts; docs/legal-trace.md;
  apps/api/src/app.ts, __tests__/{link046,postgres-link046,contract,takt-019-contract}.test.ts; apps/web/src/api/http(.test).ts;
  apps/web/src/features/capture/{followUp,followUp.test,FollowUpDialog,FollowUpDialog.test,Page,SuggestDialog,
  SuggestDialog.test,ContributionPane,ContributionPane.test,QuestionCard,QuestionCard.test}; apps/web/src/features/history/
  {ThreadBlock,ThreadBlock.test,Page,eventSummary,eventSummary.test}; apps/web/src/i18n/{labels,capture.de,capture.en,
  history.de,history.en,shell.de,shell.en,parity.test}.ts; apps/web/e2e/046-nachfragen.spec.ts, support/e2e-texts.ts,
  playwright.config.ts; scripts/e2e-http-031.test.mjs; docs/evidence/046-*.png (4); docs/glossar.md;
  docs/datenschutz/dsfa-vorentwurf.md; docs/sicherheit/bedrohungsmodell.md
```

## Review findings

### Lesebefund der Spec (frischer Kontext, 05.10.2026, zu `a0d6fb6`): 1 blocker, 6 major, 11 minor, 4 nit

Entscheidungen des Orchestrators eingearbeitet im Folgecommit; je Befund:

| Nr. | Klasse | Befund (kurz) | Umsetzung |
|---|---|---|---|
| 1 | blocker | SC-03: `parentQuestionId` legt ids nicht lesbarer Fragen offen; „zufällig ohne Inhalt“ falsch | Variante a, Maskierung: Entscheidungen 1, 5, 7; Bezugs-id und `parentAnswerVersion` nur für Leser der Bezugsfrage, nie auf der Bühne, in jedem Ereignis-Lesepfad entfernt; `dependentRequired` in `Question` nur in eine Richtung; Befund „Ids sind nicht inhaltsleer“ (`seed.ts:388`); Tests 8, 9, 10, H7, Mutationsprobe 5 |
| 2 | major | Strom meldet die Nachfrage an Leser der Bezugsfrage | `EVENT_SUBJECTS.QuestionLinked` nur das Kind (Entscheidung 7, T-G1-I-09); Test 15 und Mutationsprobe 4 umgekehrt |
| 3 | major | Filter: Leseumfang und leere id unklar | Filter je Kind mit dem Leseumfang der Liste; Satz „nicht lesbar → leer“ gestrichen; Verhalten Kern (`!== undefined`, `''` filtert) und Dienst (422 für leer und zu lang) beschrieben; Test 8 mit „Bezugsfrage nicht lesbar, Kind lesbar“, H4 |
| 4 | major | Reduzierer lässt späten Bezug und unbekannte Relation zu | Regeln (e) Stand der Erfassung (`version === 1`, gleiche `commandId`) und (f) Relation und `parentAnswerVersion` gültig (Entscheidung 4); Test 6 (e), (e2), (f), (f2); Mutationsprobe 2 |
| 5 | major | Reihenfolge im Projekt `http` | Pfadreihenfolge zwischen 045 und 053 (Files allowed); Vor-dem-Bau-Punkt 8 nennt den Endstand von 046 und warum 053, 054, 055b, 080 und abnahme gültig bleiben |
| 6 | major (legal) | Bezug zur Ursprungs**antwort** fehlt; `:195` nicht erwähnt | `parentAnswerVersion` (Entscheidung 2a), gemaskt wie die id; `:195` im „Teilweise“ von R-LINK-01 mit Hinweis auf 046b/046c |
| 7 | major | Chip hängt Bezug still an mehrere Vorschläge | Chip nur für Einzelaufrufe (`Alt+Q`, freie Eingabe); Vorschlagsdialog sendet ohne Bezug mit sichtbarem Hinweis (Entscheidung 9); W1, W3 |
| 8 | minor | Block ruft id ab, die nicht geliefert wurde; H4 nur eine Route | Block ohne `parentQuestionId` ohne Abruf (Entscheidung 10, W5); H4 beide Routen |
| 9 | minor | ETags von Redebeitrag und Wortmeldungsliste nicht geprüft | Test 1 prüft sie |
| 10 | minor | Länge in Code-Punkten | Entscheidungen 1, 2; Vertragsschritt; Test 4 mit Zeichen außerhalb der BMP |
| 11 | minor | Erkennung MF-15 nennt Regel-id, die das Log nicht führt | 422 auf `captureQuestions` je `subjectHash` |
| 12 | minor | R-LINK-02 ohne Literal im Produktivcode | Entscheidung 4; Test 16 |
| 13 | minor | „E30 offen“ an R-LINK-01 | ersetzt durch „Auf Standard gebaut (Spec 046)“, auch im CHANGELOG-Vermerk |
| 14 | minor | `SpeakerReopenReason 'follow_up'` nicht erwähnt; Glossar und Alt+N | Befund, Nicht-Ziel, Glossarzeile, Entscheidung 9 |
| 15 | minor | Weg der Nummernauflösung in der Karte unklar | `QuestionCard` ruft `api.getQuestion`, `QuestionsPane.tsx` unverändert; `relationLabel` in `labels.ts` |
| 16 | minor | `stream035.test.ts` zu eng beschrieben | Files allowed: `ALL_EVENT_TYPES` und Erwartungen je Ereignistyp |
| 17 | minor | Lastkurve zählt doppelt | hingenommen und benannt (Befund, Nicht-Ziel); `lib.ts` unberührt |
| 18 | minor | Alt+N-Erkennung | `event.code === 'KeyN'`, nicht in bearbeitbaren Feldern; Vor-dem-Bau-Punkt 6; W3 |
| 19 | nit | ADR-Abweichung in die Folgeliste | im Bericht vorgesehen, Eintrag durch den Orchestrator |
| 20 | nit | nicht zur Umsetzung beauftragt (Entscheidung des Orchestrators) | — |
| 21 | nit | Aufwand | Punktschätzung 3,0 AStd (Spanne 2,5–3,75), Teilungssumme 9,25 |
| 22 | nit | Zeile in `labels.ts` | `labels.ts:105` (`EVENT_KEYS`) |

### Nachprüfung (frischer Kontext, 05.10.2026, zu `8c6f527`): Punkte 1, 2, 3, 5, 7 erledigt; 1 major, 3 minor

| Nr. | Klasse | Befund (kurz) | Umsetzung |
|---|---|---|---|
| N1 | major (legal) | `parentAnswerVersion` war die neueste Version, nicht das Gehörte | Variante a: zuletzt vorgelesene Version bei Erfassung aus `QuestionDelivered.answerVersion`; internes Projektionsfeld `deliveredAnswerVersion` (billiger als Protokollsuche), Files allowed `state.ts`/`types.ts`/`api.ts`; Entscheidung 2a, Vertragsbeschreibung, Oberfläche „bezieht sich auf die vorgelesene Antwortversion N“ nur bei vorhandenem Feld; Tests 1, 2, 14, W5, Mutationsprobe 7 |
| N2 | minor | Regel (e) mit `version === 1` zu schwach | Regel (e): unmittelbar zuvor reduziertes Ereignis ist das `QuestionCaptured` derselben Frage; Test 6e3; Mutationsprobe 2 |
| N3 | minor | Rücknahme: geschlossenes Leseschema und Bindung fehlen | Vertragsschritt, Absatz „Rücknahme nach dem Merge“ mit ADR-0015-Behandlung |
| N4 | minor | Lesbarkeit der Bezugsfrage im Wiederholungspfad | Entscheidung 5: Prüfung in `source` = `historical` |

### Design-Kritik und Review (frischer Kontext, 06.10.2026, zu PR #169 `153b056`): Design 2 blocker, 2 major, 2 minor; Review ohne blocker/major

Umgesetzt in `8aa7e41` (Tests zuerst: 14 neue bzw. verschärfte Einheitstests rot, danach grün). `pnpm gates` mit
Postgres-Variablen (Datenbank hv_test_s046) auf dem sauberen Commit `8aa7e41`, exit 0; domain 526, web 858, api 701;
Schluss: `✓ built in 1.65s` · `mark-test-run: wrote … (clean tree) at commit 8aa7e41, tree 268f79420abd…`.
e2e `046-nachfragen.spec.ts` in-process mit `--repeat-each=3`: 6 passed.

| Nr. | Klasse | Befund (kurz) | Umsetzung |
|---|---|---|---|
| D8 | blocker | aktiver Treffer unsichtbar (`bg-ink-25`) | Hausmuster: `bg-accent-50` und linke Akzentleiste `border-l-accent-600`, übrige Zeilen mit Hover; aktiver Treffer scrollt in Sicht; Trefferliste per Tastatur scrollbar (axe `scrollable-region-focusable`) |
| D6 | blocker | Block auf Elternseite bei Laden/Fehler leer (Fehlerbild 8) | Block entfällt nur bei geladenen null Kindern; Laden: Skeleton fester Höhe, Fehler: Grund und „Erneut versuchen“; Skeleton `bg-ink-200` (auch im Dialog) |
| D1 | major | Treffer nicht unterscheidbar, Wahl unumkehrbar | zweizeilige Treffer (Wortlaut; Nummer · Redner · Uhrzeit in 12 px, Nummer und Zeit Mono); Bestätigungszeile „Gewählt: F-… · …“ über dem Fuß |
| D7 | major | Begriff Schaltfläche vs. Chip/Karte (en) | en „Follow-up question to …“ wie Chip und Karte und Glossar |
| D-m5 | minor | Badge wächst beim Laden der Nummer | Platzhalter `F-` plus vier Ziffernleerzeichen, `aria-busy` |
| D-m6 | minor | Nachweis Kindseite fehlt; Chip-Screenshot irreführend | `046-historie-bezug-{de,en}.png` (Bezugsfrage mit „bezieht sich auf die vorgelesene Antwortversion 1“); `046-erfassung-*` zeigt den Chip allein vor der Erfassung; die e2e wählt per Pfeil den ersten vorgelesenen Treffer; Zeilenlayout des Blocks (abgeschnittenes Badge) behoben |
| R7 | review | Alt+B über anderen Dialogen | ignoriert, wenn ein Dialog offen ist oder das Ziel in `[role=dialog]` liegt (Einheitstest, e2e E3 mit Vorschlagsdialog) |
| R8 | review | Bezug nach Erfolg auch gelöscht, wenn inzwischen neu gesetzt | gelöscht nur, wenn noch derselbe gesendete Bezug (Einheitstest) |
| R9 | review | Tastenkürzel nicht ausgezeichnet | `aria-keyshortcuts="Alt+B"` |
| R10 | review | zweites Enter unerreichbar | Enter wählt, das nächste Enter setzt den Bezug (e2e E3) |

Nicht umgesetzt, in `docs/folgeliste.md` Abschnitt „Nachfragen-Threads (aus 046)“: Einengung von `ReadEvent`; Kopie des
Merkfelds in `snapshotBefore` als angenommene Scope-Abweichung; `RELATIONS` doppelt zu `QUESTION_RELATIONS`; Fehlertexte
ohne Grund; 11-px-Beschriftungen und Zahl „(n)“ nicht Mono; Chip accent gegen Badge neutral; linke Liste nach Öffnen aus dem
Block nicht nachgeführt; Dialogbreite 512 statt 480 px. Vertragsversion bleibt 0.4.5 (Umstellung auf 0.4.6 nach dem Merge
von 061 Teil A, auf Ansage des Orchestrators).
