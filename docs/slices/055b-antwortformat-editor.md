# Scheibe 055b — Antwortformat: Renderer und Editor in der Oberfläche

**Status:** gebaut, Review eingearbeitet (05.10.2026: Bau `f2dcb06`, Nachtrag 010d `27b5566`, Review-Befunde 1–6 und 8 in diesem Zweig; CI `e2e-http` steht aus). Spec vom 04.10.2026; gelesen auf `4da0165`, Integration mit 055 (Vertrag 0.4.4, PR #152), takt-043 (#153) und
takt-044 (#154)). Teil b der geteilten Planzeile 055 (Spec 055, Abschnitt „Teilung und Zuschnitt“ und „055b — Entwurf“);
sechste Scheibe der Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → **055b** → 059 → 046 → 060 → 061 → 041
(Register E57, Nachzug beim Orchestrator). **Geteilt** (Abschnitt „Teilung und Zuschnitt“): Diese Spec baut Renderer, Editor,
Einfügen und die Bildnachweise; die Word-spezifische Listenerkennung und das Rückgängigmachen eines Einfügens folgen als
**055c** (eigene Spec, Hinweise an den Orchestrator). Auf Standard gebaut (E6 Whitelist, E21 nur `de`); keine
Eigentümerfrage blockiert.
**Risikoklasse:** mittel · 4,0 AStd (3,95; Spanne 3,4–4,5; Plan-Notiz in 055: mittel · 3,6 AStd; Begründung in „Warum mittel“ und
„Aufwand“) · Plan 055: 18.11.2026 (W8), tatsächlich direkt nach 055 · Lanes: web-components (Renderer); web-answers (Editor,
Walker, Beantwortung); web-focus (Schreibmodus, Detail); web-stage (zwei Stellen); web-history (ein Block); web-api (nur
Wiederausgabe der Kernfunktionen als Vorschau); e2e (eigene Datei, im Projekt `http` eingereiht; Zusicherungen in 054 und 090
auf das neue Feld umgestellt); docs (Glossar, Bedrohungsmodell, Nachweise); scripts (eine Semgrep-Regel). **Kein** Vertrag,
**kein** Kern, **kein** Dienst.
**Bedrohungsmodell:** schließt die zweite Hälfte von T-G1-T-06 (Skripteinschleusung über Antworttext; „Einfügen aus Word“):
Darstellung nur über React-Elemente aus der geschlossenen Speicherform, Einfügen über ein mit `DOMParser` erzeugtes Dokument
ohne HTML-Senke; dass dabei **kein Nachladen** (Bild, Rahmen, Stilblatt, Medien) geschieht, ist nicht behauptet, sondern durch
den Pflichttest A2b nachgewiesen, mit Rückfall auf `text/plain` (Entscheidung 5, Codex P1 auf #156). Die Web-Seite hat heute
**keine** CSP (037b); das ist eine Vorbedingungsfrage an den Orchestrator, keine Änderung dieser Scheibe.
Keine neue Operation, kein neues Recht, kein neuer Leserkreis (der Antwortblock der Historie zeigt, was dieselbe Person in
der Beantwortung schon liest).
**Rolle:** implementierer-oberflaeche; Review in frischem Kontext mit den Perspektiven **Security** (Einfügen, Senken,
Quelle des Renderers), **UX/Barrierefreiheit** (D1–D10, Tastaturpfad, Screenreader, Kontrast) und einem Prüfpunkt
**Recht/Freigabe** (Beantwortung, in der freigegeben wird, und Bühne zeigen eine Version über denselben Renderer). Ablauf nach
E57 für Oberflächenscheiben mittleren Risikos: kein gesonderter Lesebefund der Spec, ein Review nach dem Bau; Sicherheits-,
Rechts- und Datenschutzbefunde werden nie vertagt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue Regel, kein Wahrheitstabellen-Diff. In der Oberfläche bedient und belegt: R-TRANS-03 (Antwortversion
anlegen, jetzt mit `body`), R-GUARD-04 (Hinweis: eine neue Version hebt eine Freigabe auf; auch eine reine Formatänderung ist
eine neue Version, 055 Entscheidung 7), R-PERM-01..03 (über `_actions`, unverändert); ADR-0005 („ein Renderer“, „Renderer
verengt seine Whitelist“), ADR-0005-P (Vorschau des Klartexts), ADR-0005-L (Rückfall alter Versionen). Dazu AGENTS.md R1–R4,
R6 (keine Vertragsänderung nötig), R9, R10, R11, R12; `docs/design-prinzipien.md` D1–D10
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 055 (Zeile 789–795: „Editor mit Tastenkürzeln und Einfügen aus Word“,
„Renderer-Komponente für Bühne, Historie, Export“, „Screenshots Bühne und Historie mit Format“), ADR-Tabelle Zeile 242,
Feedback-Umbauten Zeile 267 (#27/#30/#31 → 055), Zielbild-Zeile 277 (Z6 → 055), §8.6 Streichliste Punkt 8 (Zeile 1228),
Register E6 (Zeile 1273), E21 (Zeile 1289), E57; ADR 0005 (ganz, mit Absatz „Eingabe- und Speicherform“), ADR 0001 (Grenze 1),
ADR 0002 (Oberfläche spricht nur mit `HvApi`); `docs/feedback/2026-09-zielbild-oberflaeche.md` Z6 (Zeile 49);
`docs/feedback/2026-09-quickview-projektleitung.md` #27, #30, #31; Spec 055 (Entscheidungen 1–10, „055b — Entwurf“ Zeile
715–800, „Hinweise an Folgescheiben“, Lesebefunde Minor 1, Minor 2, Minor 10); Spec 054 (Entscheidungen 4–6, „Hinweise an
Folgescheiben: 055“, Laufzeit `e2e-http`); takt-043 (`focusDue`, `disarmFocus`, Vormerken vor dem Schreiben);
`docs/sicherheit/bedrohungsmodell.md` T-G1-T-06 (Zeile 208); `docs/qualitaetsleitplanken-produktreife.md` §4, §6.5, §6.9
**Depends on:** 055 (gemergt `4da0165`, PR #152, Vertrag 0.4.4: `AnswerDraft.body`, `AnswerVersion.body`, `answerFormat.ts`),
054 (gemergt `cc97005`), takt-043 (gemergt `6fbd2a0`), takt-044 (gemergt `d7020da`)
**Perspektive:** Security, UX/Barrierefreiheit, Recht/Freigabe (Prüfpunkt) · **Glossar: neue Begriffe:** ja (Hausformat,
Hervorhebung, Auszeichnung)

## Warum mittel

Der Plan führt 055 als „mittel“; 055 (Teil a) wurde wegen Vertrag, Ereignisform und Freigabebindung auf hoch gestuft. 055b
bleibt **mittel** (keine Herabstufung, kein Fall für `downgrade-check`), weil keiner der Hoch-Auslöser aus Leitplanken §4
berührt wird:

- **Kein Vertrag, kein Kern, kein Ereignis.** 055b sendet nur, was der Vertrag 0.4.4 schon kennt (`AnswerDraft.body` in der
  offenen Eingabeform), und liest nur, was die Projektion schon liefert (`AnswerVersion.body` in der geschlossenen
  Speicherform). Die Normalisierung bleibt allein im Kern (ADR 0001, ADR 0005); die Oberfläche benutzt sie nur als Vorschau.
- **Freigabe unverändert.** Ob eine Version neu ist, entscheidet weiter der Kern (jeder `draftAnswer` ist eine Version,
  R-GUARD-04). 055b entscheidet nur, ob „Speichern“ angeboten wird (`dirty`), und zeigt den vorhandenen Hinweis. Was eine
  Freigabe deckt, ist die gespeicherte Version (055 Entscheidung 7); Beantwortung und Bühne zeigen sie über **denselben**
  Renderer (Test 6, Prüfpunkt Recht/Freigabe).
- **Keine Rechte, keine Personendaten, kein neuer Leserkreis.** Der Antwortblock der Historie liest `Question.answers` aus der
  Projektion, die dieselbe Person schon liest.

Das verbleibende Risiko ist **Sicherheit der Darstellung** (ein Renderer, der Markup aus Daten erzeugt, oder ein Einfügen, das
fremdes HTML in das lebende Dokument bringt) und **Verhalten des Editors** (verlorener Text, falscher Caret, Kürzel, die mit dem
Browser kollidieren). Beides decken Regeln, eine Semgrep-Regel und Tests ab; der Review trägt die Perspektive Security. Hält
der Review die Einstufung für falsch, hebt der Eigentümer sie an (Eigentümerfrage 7); eine Hochstufung ist kein
Herabstufungsfall.

## Befund (Ist-Stand, gelesen auf `4da0165`)

- **Kern und Vertrag (055).** `packages/domain/src/answerFormat.ts` exportiert `normalizeAnswerBodyForWrite` (darf 422
  werfen), `normalizeAnswerBodyForRead(stored: unknown): AnswerBody | null` (wirft nie), `answerPlainText(body)` (P),
  `answerBodyFromText(text)` (L), `checkAnswerBodyInput`, `ANSWER_MARKS`, `ANSWER_LANGUAGES`, `ANSWER_INPUT_LIMITS`,
  `ANSWER_BODY_LIMITS` und die Typen `AnswerBody`, `AnswerBlock`, `AnswerInline`, `AnswerBodyInput`, `AnswerBlockInput`,
  `AnswerInlineInput`; `packages/domain/src/index.ts:17` reicht alles weiter. Jede Version in `Question.answers` trägt `body`
  (gespeichert und beim Lesen normalisiert, sonst aus L; fehlt nur bei kaputten Altdaten).
- **Übertragung.** `apps/web/src/api/http.ts:644` reicht die Eingabe von `draftAnswer` unverändert als Rumpf durch; keine
  Änderung nötig. Die Demo (`createInProcessApi`) normalisiert im selben Kern.
- **Grenze Oberfläche/Kern.** `features/**` darf aus `@hv/domain` nur Typen laden (`scripts/dependency-cruiser.cjs:53-63`,
  Stufe „warn“); Werte nur über `apps/web/src/api/**`. Eine Wiederausgabe von P und der Lesevariante gibt es noch nicht.
- **Darstellung heute (alles Klartext, Textknoten).** Versionen in der Beantwortung: `QuestionDetail.tsx:228`
  (`whitespace-pre-wrap`), Diff „Änderung gegenüber Version n-1“: `AnswerDiff` (`QuestionDetail.tsx:38-60`, `wordDiff` auf
  `text`); Fokus: `FocusDetail.tsx:181` (`focus-latest`); Bühne: `Podium.tsx:376-389` (`<p data-testid="stage-answer"
  data-prepared>`) und `Podium.tsx:480-492` (`<p data-testid="stage-preview-answer">`), beide nur mit der freigegebenen Version
  (`approvedAnswer`, `stage/lib.ts:20`). Die Bühne liegt in `.stage-contrast` (dunkler Grund, `--color-stage-text: #f8fafc`).
  **Die Historie zeigt keinen Antworttext**; `selected` ist die Einzelfrage aus dem Korpus (`history/Page.tsx:561-563`), die
  Zeitleiste steht bei `history/Page.tsx:864`.
- **Schreiben heute.** `WritingMode.tsx` (054): `<textarea data-testid="focus-editor">`, Caret ans Ende beim Öffnen,
  Strg+Enter über `isSaveChord`, Escape über `shouldLeaveWriting`, Vorlesezeit auf `text`. Der Entwurf (`FocusDraft` in
  `focus.ts`) hält `text`, `baseText`, `sources`, `baseSources`, `baseVersion`, `rebase`; `isDirty` vergleicht getrimmten Text,
  `writingOutcome` stellt einen unveränderten Text still auf eine neue Version um. Speichern in `focus/Page.tsx:240-262`
  (`api.draftAnswer(id, { text, sources? })`, danach `baseText = text`). Beantwortung: `AnswerEditor.tsx` (`<textarea
  data-testid="answer-editor">`, beginnt leer), Zustand in `QuestionDetail.tsx` (`draft`, `setDraft`), Senden in
  `answers/Page.tsx:79-92`, nach dem Speichern leer (`setDraftResetToken`).
- **Kein Entwurf im Browser-Speicher** (054); der Puffer kommt mit 060.
- **Testwerkzeug.** Kein jsdom, keine Testing Library (takt-043, Nicht-Ziel); Komponententests rendern statisch
  (`renderToStaticMarkup`, z. B. `WritingMode.test.tsx`). Ein DOM gibt es nur in Playwright; Module lassen sich im Projekt
  `in-process` über den Entwicklungsserver laden (Muster `API_MODULE` in `090-eingaben-je-akteur.spec.ts:145`).
- **Bestehende Zusicherungen auf den beiden Textfeldern** (werden mit einem `contenteditable`-Feld rot, weil Playwright
  `toHaveValue`/`inputValue` nur für Formularfelder kennt): `054-fokusansicht.spec.ts:246, 259, 275, 311, 324, 527, 539`
  (`focus-editor`); `090-eingaben-je-akteur.spec.ts:92-95, 128-132` (Helfer `expectVisibleAndEmpty`, `valueOrAbsent`, benutzt
  für `answer-editor` in 269, 280, 471, 473). `fill`, `focus`, `toBeVisible`, `toBeFocused` und `keyboard.type` funktionieren
  auch auf `contenteditable` (003:90/148, 010d:868/1026, 013:552/791/814/840, abnahme:182). `013-tastaturpfad.spec.ts:400`
  erreicht `answer-editor` mit höchstens 15 Tabulatorschritten; eine Werkzeugleiste davor kostet höchstens einen.
- **Kürzel der Anwendung.** `AppShell.tsx:26-31` (`isTextEntry`) behandelt `isContentEditable` schon als Eingabefeld (Alt+1…6,
  Alt+N, `?` greifen dort nicht); die Bühne ebenso (`stage/lib.ts:28-32`).
- **Tokens.** `--color-tone-warning-bg` `#fdf3e4` und `--color-tone-warning-fg` `#8a5a08` (`styles/index.css:162-163`),
  rechnerisch rund 5,4:1; eine Marke mit eigenem Vorder- und Hintergrund hält diesen Kontrast auch auf dem dunklen Grund der
  Bühne.
- **Senken.** Keine Verwendung von `innerHTML` oder `dangerouslySetInnerHTML` in `apps/web/src`; Semgrep-Regel nur gegen
  `dangerouslySetInnerHTML` (`scripts/semgrep/rules.yml:90-96`). Eine CSP für das Web-Dokument gibt es noch nicht (037).
- **i18n.** Paritätstest (f) bei **610** Schlüsseln je Sprache (`parity.test.ts:175-182`). Das Glossar meidet „Editor“ in
  Texten (`docs/glossar.md:55`).
- **e2e.** `SHARED_SPECS` (`playwright.config.ts:38-41`) und `HTTP_ORDER`/`SHARED_FILES` (`scripts/e2e-http-031.test.mjs:26-30`)
  enden mit 054, 080, abnahme. Laufzeit des Schritts „End-to-end http project …“ zuletzt **4:45–5:35** (054 und 055 Bericht,
  Lauf 37239067336) gegen die Harness-Grenze 8:00 (`TOTAL_MS`) und `timeout-minutes: 9`; Plan Zeile 781: der Takt „Grenze
  anheben oder Job teilen“ ist fällig, bevor der Schritt etwa 6:30 erreicht.

## Teilung und Zuschnitt

| Punkt | In 055b | In 055c | Grund |
|---|---|---|---|
| Renderer für Bühne (zwei Stellen), Beantwortung (Versionen), Fokus (letzte Version), Historie (neuer Block) | **ja** | — | Planzeile, ADR 0005 „ein Renderer“; Export ist 051/052 |
| Hinweis „Nur Auszeichnung geändert“ statt leerem Diff | **ja** | — | 055 Teilungstabelle |
| Editor mit Werkzeugleiste und Kürzeln in Schreibmodus **und** Beantwortung | **ja** | — | sonst überschreibt die Beantwortung ein Format als Klartext |
| Einfügen aus Word, Browsern und Textprogrammen (Marken, Absätze, `ul`/`ol`, Kommentare, Stilblöcke, verborgener Text) | **ja** | — | Planzeile, Sicherheitshälfte T-G1-T-06 |
| Word-Listen ohne `ul`/`ol` (`MsoListParagraph*`, `mso-list`-Ebenen) als Listenpunkte | nein: kommen als Absätze **ohne** Aufzählungszeichen an (Zeichen in `mso-list:Ignore` liefert keinen Text) | **ja** | 055 „Rückfall innerhalb 055b“ (über 4,0 AStd) |
| Rückgängig (Strg+Z) eines Einfügens in einer Stufe | nein: nur Schutz gegen einen verfälschten Stand (Entscheidung 5) | **ja** | Aufwand; Folge eines Einfügens ohne HTML-Senke |
| Bildnachweise Bühne und Historie mit Format (ADR 0005) | **ja** | — | — |

**Teilungsentscheidung.** Mit Word-Listen und einstufigem Rückgängig läge 055b bei rund 4,4 AStd und damit über der Grenze von
4,0, die 055 für den Rückfall setzt. Treiber gegenüber der Planzahl 3,6 sind zwei Befunde, die 055 noch nicht kannte: Das neue
Feld macht die Zusicherungen in 054 und 090 rot (Umstellung, keine Schwächung), und jedes Einfügen ohne HTML-Senke baut den
Inhalt per Skript um, sodass das Rückgängig des Browsers nicht mehr verlässlich ist. Ohne die beiden 055c-Punkte bleibt 055b
vollständig nutzbar: Eine Word-Liste kommt als Absätze an, die Person markiert sie und drückt „Aufzählung“.

**Rückfall innerhalb 055b** (Plan §8.6 Punkt 8, gilt künftig für 055b): Editor auf Klartext mit Absätzen, Renderer bleibt.
Nur mit Go des Eigentümers; der Bau hält an und meldet, bevor er ihn nimmt.

## Ziel und Entscheidungen vor Bau

Wer schreibt, sieht beim Schreiben, was die Bühne zeigt: fett, kursiv, Hervorhebung und Aufzählung über eine schmale
Werkzeugleiste oder Kürzel, mit dem Hinweis „Schrift und Größe kommen von der Ansicht“ (Z6). Ein Text aus Word bringt seine
erlaubte Auszeichnung mit, alles andere wird Text, und nichts davon kann ein Skript ausführen. Bühne, Historie, Beantwortung
und Fokus zeigen jede Antwort über **eine** Komponente, aus der Projektion, im richtigen Sprachkontext für Screenreader.

Alle Punkte sind **auf Standard gebaut**, wo nicht anders gesagt; spätere Wechsel kosten die Beträge unter „Standards“.

### 1. Renderer `AnswerText` (`apps/web/src/components/AnswerText.tsx`)

- **Signatur:** `AnswerText({ answer, className? })` mit `answer: Pick<AnswerVersion, 'body' | 'text'>` (Typ aus
  `@hv/domain`, nur `import type`). Wurzel `<div>` mit `lang` aus `body.language`, **nur** wenn der Wert in einer eigenen,
  engen Liste steht (`['de']`; sonst kein `lang`-Attribut). Keine Schriftfamilie, keine Schriftgröße, keine Farbe außer der
  Marke: alles erbt von der Ansicht (#31). Keine Texte, kein i18n, keine Abhängigkeit über `components/` hinaus (056 bündelt
  die Bühne einzeln).
- **Abbildung (eigene, engere Whitelist, ADR 0005 „Risiko“):** `paragraph` → `<p>`; `list` → `<ul>` mit `<li>` je Punkt
  (sichtbares Aufzählungszeichen, Einzug); `bold` → `<strong>`, `italic` → `<em>`, `highlight` → `<mark>` mit
  `--color-tone-warning-bg`/`--color-tone-warning-fg` als Inline-Stil (kein neues Token, keine Änderung an `index.css`);
  Schachtelung in der kanonischen Reihenfolge `strong` > `em` > `mark`. Eine unbekannte Blockart wird `<p>`, eine unbekannte
  Marke entfällt, ihr Text bleibt. Abstand zwischen Blöcken relativ zur Schriftgröße (em), damit Bühne (24 px) und Fokus
  (13 px) gleich gegliedert wirken.
- **Nur React-Elemente und Textknoten.** Kein `innerHTML`, kein `dangerouslySetInnerHTML`, kein Attribut aus Daten außer dem
  geprüften `lang`; Schlüssel der Listen sind Indizes. Ein Text wie `<script>…</script>` erscheint wörtlich.
- **Rückfall:** ohne `body` (kaputte Altdaten; ein Dienst vor 0.4.4) der Text wie heute in einem `<p>` mit
  `whitespace-pre-wrap`, ohne `lang`.
- **Quelle ist ausschließlich `Question.answers[n]`** (Projektion mit Lesevariante, in `Question`, `StageView` und den
  Strom-Aktualisierungen von `Question`), **nie** `payload.answer.body` aus einem Ereignis der Historie oder des Ereignisstroms
  (055 Entscheidung 10, Lesebefund Minor 2). Test 1 (h) sucht die Stelle im Quelltext.
- **Screenreader:** echte Liste (Anzahl der Punkte wird angesagt), semantische Marken, kein `aria-hidden`, keine zusätzliche
  Beschriftung; `lang="de"` lässt eine deutsche Antwort in der englischen Oberfläche richtig aussprechen (WCAG 3.1.2).

### 2. Einsatz des Renderers

- **Bühne** (`Podium.tsx`): `stage-answer` und `stage-preview-answer` werden `<div>` (ein `<p>` darf keine Blöcke enthalten),
  mit denselben Test-ids, Klassen, Inline-Stilen und `data-prepared`; darin `AnswerText` oder, ohne freigegebene Version, der
  bisherige Platzhalter (`stage.answer.none`/`stage.answer.podium`) als `<p>`. Zusicherungen in 003, 020, 045 und abnahme
  (`toContainText`, `not.toBeEmpty`, `not.toHaveText('')`, `data-prepared`) bleiben wörtlich.
- **Beantwortung** (`QuestionDetail.tsx`, `VersionCard`): der Text der Version über `AnswerText`; Verweigerungen ebenso (ihr
  Dokument stammt aus L, ohne Marken); `refusalJustification` bleibt, wo sie heute steht, als Klartext und nie im Renderer.
- **Diff** (`AnswerDiff`): bleibt `wordDiff` auf `text`. Sind `text` von Version n und n-1 gleich und die Dokumente
  verschieden (`sameBody` in `answers/lib.ts`, tiefer Vergleich der Speicherform), steht statt des leeren Diffs
  `answers.version.formatOnly` (`answer-diff-format-only`).
- **Fokus** (`FocusDetail.tsx`, `focus-latest`): die letzte Version über `AnswerText`; Vorlesezeit weiter auf `latest.text`.
- **Historie** (`history/AnswerBlock.tsx`, eingesetzt in `history/Page.tsx`): im Reiter „Vorgangshistorie“ über der Zeitleiste
  der gewählten Einzelfrage ein Block `history-answer` mit der Überschrift `history.answer.title` („Antwort, Version {version}“)
  und der **letzten** Version von `selected.answers` über `AnswerText`; bei einer Verweigerung als letzter Version zusätzlich
  das Badge `answers.refusal.badge`. Ohne Version, ohne `selected`, bei verweigertem Lesen (`history-*-forbidden`) oder im
  Reiter „Ereignisstrom“ kein Block. Kein neuer Lesezugriff: `selected` stammt aus dem Korpus, den die Seite schon lädt.

### 3. Editorform: minimales `contenteditable`-Feld ohne Bibliothek (die Wahl)

Drei Wege wurden gegeneinander gestellt:

| Weg | Für | Gegen | Urteil |
|---|---|---|---|
| **A. Ein `contenteditable`-Feld**, Befehle in genau einem Modul, Inhalt nur über einen Walker gelesen | sieht aus wie die Bühne (D1: Auszeichnung dort, wo man tippt); Caret, Eingabemethoden (IME), Rechtschreibung und Rückgängig des Browsers für das Tippen; `fill`/`keyboard.type` in e2e unverändert | `execCommand` ist veraltet (ohne Ersatz); Browser erzeugen verschiedenes Markup; ein Einfügen ohne HTML-Senke stört das Rückgängig des Browsers; 054/090 müssen ihre Zusicherungen umstellen | **gewählt** |
| B. `<textarea>` mit Auszeichnungszeichen (`**fett**`, `- `) und Vorschau | kein `contenteditable`, alle Tests bleiben | ein getippter Stern („3 %*“, Fußnote) würde Auszeichnung und verschwände aus dem Wortlaut: verletzt „nichts geht verloren“ und berührt den freigegebenen Wortlaut; 055 schließt Markdown aus | verworfen |
| B'. `<textarea>` mit Marken als Bereiche neben dem Text, Darstellung nur in einer Vorschau | kein `contenteditable`, gut testbar | Strg+B ändert im Feld nichts Sichtbares; Vorschau braucht Platz im Schreibmodus; Bereiche bei jeder Eingabe umrechnen | verworfen, Option (Eigentümerfrage 2) |
| C. Bibliothek (ProseMirror, Lexical, Tiptap) | ausgereiftes Modell, eigenes Rückgängig | neue Abhängigkeit (SC-10: Alter, Lizenz, Größe, Pflege prüfen), Bündelgröße, eigenes Schema neben dem Vertrag | nicht nötig; nur mit Eigentümerfrage 2 |

Der Weg A bleibt **minimal**: Das Feld ist nur Eingabefläche. Sein DOM ist nie Quelle der Wahrheit für etwas anderes als den
eigenen Entwurf, wird nie an anderer Stelle angezeigt und erreicht den Dienst nur als `AnswerBodyInput` über den Walker; die
Speicherform macht der Kern. **Keine neue Abhängigkeit.** Wer im Bau doch eine Bibliothek für nötig hält, hält an und legt die
SC-10-Prüfung vor (Eigentümerfrage 2); ohne Antwort keine Bibliothek.

### 4. Feld und Werkzeugleiste (`apps/web/src/features/answers/AnswerBodyEditor.tsx`, `editorCommands.ts`)

- **Signatur:** `AnswerBodyEditor({ testId, initial, generation, labelId, describedBy, size, onChange, onKeyDown?, autoFocusEnd? })`.
  `initial: AnswerBody | null` (Speicherform oder leer), `generation: number` (das Feld baut seinen Inhalt aus `initial` nur
  beim ersten Rendern und wenn `generation` sich ändert neu auf; sonst bleibt es unkontrolliert), `onChange(input:
  AnswerBodyInput | null)` nach jeder Eingabe (leer → `null`), `onKeyDown` erhält jede Taste, die das Feld nicht selbst
  verbraucht (Strg+Enter und Escape gehen immer durch). `size`: `'large'` (Schreibmodus) oder `'compact'` (Beantwortung).
- **Feld:** `<div contentEditable>` mit `role="textbox"`, `aria-multiline="true"`, `aria-labelledby` (Beschriftung
  `answers.editor.label`), `aria-describedby` (Tastenhinweis `answers.format.keys` und Hinweis Z6 `answers.format.hint`),
  `aria-placeholder` und ein sichtbarer Platzhalter (`answers.editor.placeholder`, eigener `aria-hidden`-Span, solange leer),
  `lang` = Sprache der Speicherform (`de`), damit die Rechtschreibprüfung deutsch prüft, `spellCheck`. Test-ids bleiben
  `focus-editor` und `answer-editor` (auf dem Feld selbst).
- **Werkzeugleiste:** `role="toolbar"`, `aria-label` `answers.format.toolbar`, `aria-controls` auf das Feld; vier
  Umschaltknöpfe `format-bold`, `format-italic`, `format-highlight`, `format-list` mit `aria-pressed`, Symbol aus
  `lucide-react` (vorhanden) und `aria-label`/`title` aus i18n; `aria-keyshortcuts` aus Konstanten in `editorCommands.ts`.
  **Ein** Tabulatorhalt (rovierender `tabIndex`, Pfeil links/rechts, Pos1/Ende). Ein Mausklick nimmt dem Feld den Fokus nicht
  (`mousedown` verhindert); eine Tastaturbetätigung stellt die zuletzt im Feld gemerkte Auswahl wieder her, führt den Befehl
  aus und gibt den Fokus ans Feld zurück. Daneben klein `answers.format.hint` (D10: ruhig, `text-2xs`, `ink-600`).
- **`aria-pressed`** folgt der Auswahl (`selectionchange`, nur solange die Auswahl im Feld liegt) über dieselbe Regel wie der
  Walker (`marksAt`, Entscheidung 6); `format-list` ist gedrückt, wenn der Caret in einem Listenpunkt steht.
- **Befehle** nur in `editorCommands.ts` (die einzige Stelle mit `document.execCommand`, ersetzbar): beim Einhängen
  `styleWithCSS` aus und `defaultParagraphSeparator` = `p`; `bold`, `italic`, `insertUnorderedList`; Hervorhebung über
  `hiliteColor` mit dem berechneten Wert von `--color-tone-warning-bg` bzw. `transparent` zum Aufheben. Das Feld baut eigene
  Inhalte deshalb mit `b`, `i` und `span` mit Hintergrundfarbe auf (nicht `strong`/`em`/`mark`), damit die Befehle sie
  umschalten können (Vor-dem-Bau-Punkt 3).
- **Eingaben, die das Feld zulässt** (`beforeinput`, Allowlist in `editorCommands.ts` als reine Funktion
  `allowedInputType`): `insertText`, `insertReplacementText`, `insertCompositionText`, `insertFromComposition`,
  `insertParagraph`, `insertLineBreak`, `insertFromYank`, `insertTranspose`, alle `delete*`, `historyUndo`/`historyRedo`
  (Entscheidung 5), `formatBold`, `formatItalic`, `insertUnorderedList`. **Alles andere wird verhindert**, darunter
  `formatUnderline`, `formatStrikeThrough`, Schriftart, -farbe, Ausrichtung, Einzug, `formatSetBlockTextDirection` und
  `formatSetInlineTextDirection` (Bidi), `insertLink`, `insertOrderedList`, `insertHorizontalRule`, und
  `insertFromPaste`/`insertFromDrop` (die laufen über Entscheidung 5). So zeigt das Feld nie eine Auszeichnung, die beim
  Speichern verschwände.
- **Ziehen innerhalb des Felds ist aus** (`dragstart` verhindert); Ablegen von außen läuft wie Einfügen (Entscheidung 5).

### 5. Einfügen und Ablegen (`domToBody.ts`, Aufruf im Feld)

- `paste` und `drop` werden immer abgefangen (`preventDefault`). Liegt `text/html` vor, wird es mit
  `new DOMParser().parseFromString(html, 'text/html')` gelesen. Der Walker (Entscheidung 6) macht daraus `AnswerBodyInput`;
  `bodyToDom` erzeugt daraus **neue** Knoten im lebenden Dokument (nur `createElement` für `p`, `ul`, `li`, `b`, `i`, `span`
  und `createTextNode`, Stil nur die eine Hintergrundfarbe); keine Senke `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `execCommand('insertHTML')`, `document.write`, `createContextualFragment` (Semgrep-Regel, Entscheidung 10). `DOMParser`
  steht nur in `domToBody.ts`.
- **Kein Nachladen beim Einfügen — Mechanismus, Nachweis, Rückfall (Codex P1 auf #156, Security).**
  - *Mechanismus (Erwartung, nicht Behauptung):* Nach der HTML-Spezifikation hat ein von `DOMParser` erzeugtes Dokument keinen
    Browsing-Kontext und ist nicht „fully active“; Skripte laufen dort nicht, und die Abrufschritte für `img`, `iframe`,
    `link rel=stylesheet`, `video poster`, `object`, SVG-`image`, `@import` und Hintergrundbilder sollten nicht starten. Diese
    Spec stützt die Sicherheit **nicht** auf diese Erwartung: Ob ein Browser dennoch abruft (Vorladescanner, eigenwillige
    Implementierung), weist allein der Pflichttest **A2b** nach, in einem echten Browser.
  - *Verteidigung in der Tiefe 1:* **Kein Knoten des geparsten Dokuments gelangt ins lebende** — kein `importNode`, kein
    `adoptNode`, kein `append`/`insertBefore`/`replaceWith` mit einem fremden Knoten, kein Klonen fremder Knoten. Der Walker
    **liest** nur Textdaten (`data`) sowie Tag-Namen und das Attribut `style` für die drei Marken; kein anderes Attribut wird
    gelesen (kein `src`, `href`, `srcset`, `poster`, `data`, `background`), und nichts Gelesenes wird zu einem Attribut eines
    neuen Knotens außer der einen festen Hintergrundfarbe aus dem Token. Ein Knoten im lebenden Dokument mit URL-Attribut kann
    so nicht entstehen (Test 2 (j), A2b).
  - *Verteidigung in der Tiefe 2, CSP:* Gelesen (nur lesend) auf `4da0165`/`f24dbea`: Die Web-Seite hat **keine**
    Content-Security-Policy — weder in `netlify.toml` (`[[headers]]` setzt nur `X-Frame-Options`, `X-Content-Type-Options`,
    `Referrer-Policy`), noch in `deploy/docker/nginx.conf` (Zeile 3: „No CSP here: it comes in 037b“), noch als `<meta>` in
    `apps/web/index.html`. Die CSP `default-src 'none'` in `apps/api/src/limits/middleware.ts:25` gilt nur für die
    JSON-Antworten des Dienstes, nicht für das Dokument der Oberfläche. Es gibt also heute **keine** Schranke für
    `img-src`/`frame-src`/`connect-src` auf `'self'`. Diese Scheibe ändert keine Auslieferungskonfiguration; die Frage geht als
    Vorbedingung an den Orchestrator (Hinweise an den Orchestrator). Bis 037b ist A2b die einzige Prüfung, deshalb Pflicht.
  - *Rückfall (verbindlich):* Zeigt A2b in irgendeinem Lauf **eine** Anfrage an den Wächter-Host, stellt der Bau das Einfügen
    auf **nur `text/plain`** um (`text/html` wird nicht mehr gelesen, `DOMParser` entfällt; Auszeichnung aus Word geht verloren,
    der Wortlaut bleibt), meldet es im Bericht und an den Orchestrator und hält für alles Weitere an. **Keine andere
    Umgehung** (kein Entfernen von Attributen per Zeichenkette, kein Sandbox-Rahmen, kein eigener Parser, keine Ausnahme).
- Nur `text/plain`: eine Zeile (getrennt an CR LF, CR, LF) je Absatz. Nur Dateien oder Bilder: nichts wird eingefügt.
- Die neuen Knoten ersetzen die Auswahl; danach baut das Feld seinen **ganzen** Inhalt einmal aus dem Walker neu auf
  (`bodyToDom`), damit keine verschachtelten Blöcke stehen bleiben, und setzt den Caret an das Ende des Eingefügten (Position
  im Modell: Block, Punkt, Zeichenversatz; `caretPosition`/`placeCaret` in `domToBody.ts`). Ablegen: Position aus
  `caretPositionFromPoint` bzw. `caretRangeFromPoint`, sonst die aktuelle Auswahl.
- **Schutz des Rückgängig:** Nach einem Neuaufbau durch das Feld ist der Verlauf des Browsers nicht mehr verlässlich. Zeigt
  Vor-dem-Bau-Punkt 4, dass Strg+Z danach einen Stand erzeugt, der nie bestand (Text verloren oder verdoppelt), verhindert das
  Feld `historyUndo`/`historyRedo` vom Neuaufbau bis zur nächsten getippten Eingabe (kein Verlust, nur kein Rückgängig des
  Einfügens). Sonst bleibt das Rückgängig des Browsers. Ein einstufiges Rückgängig des Einfügens bringt 055c.
- Der Walker wendet die Whitelist **nicht** an (055 Entscheidung 1): Er meldet Kandidaten wie `underline`, `strike`,
  `heading`, `quote`, `table`. Das Feld zeigt aber nur, was es darstellen kann (`bodyToDom` kennt nur Absatz, Liste und die
  drei Marken); ein solcher Kandidat erscheint als Text und erreicht den Kern beim Speichern deshalb nicht. Maßgeblich bleibt
  die Normalisierung des Kerns beim Speichern; der Client wird nie als vertrauenswürdig angenommen.

### 6. Walker `domToBodyInput(root)` und `bodyToDom(doc, body)` (`apps/web/src/features/answers/domToBody.ts`, rein)

- Arbeitet auf einer **minimalen Knotenschnittstelle** (`nodeType`, `nodeName`, `childNodes`, `data`, `getAttribute`), die
  echte DOM-Knoten erfüllen; so ist er ohne jsdom mit Testknoten prüfbar (Test 2) und im Browser mit echten (A3). Liest Stile
  nur aus dem Attribut `style` (ein geparstes Dokument hat keine berechneten Stile).
- **Blöcke:** `p`, `div`, `h1`–`h6` (Kandidat `heading`), `blockquote` (`quote`), `pre`, `td`/`th` (`table`), `dt`, `dd`,
  `li`, `section`, `article`, `header`, `footer`, `address`, `figcaption`, `caption` beginnen einen Block; Text direkt in der
  Wurzel oder zwischen Blöcken ist ein Absatz. `ul` und `ol` sind Listen (Kandidat `list`); ihre `li` werden Punkte;
  verschachtelte Listen werden flach (E6: keine Verschachtelung). Ein Block in einem Block teilt (Stücke vor, im, nach).
  `br` beendet den Absatz bzw. Punkt und beginnt einen neuen derselben Art; ein `br` am Ende eines Blocks liefert nichts.
- **Marken, die nächste ausdrückliche Angabe entscheidet** (wie CSS vererbt): fett = `b`/`strong` oder `font-weight` ≥ 600
  bzw. `bold`/`bolder`; `font-weight: normal`/`400` hebt auf (Google Docs umhüllt alles mit `<b style="font-weight:normal">`).
  Kursiv = `i`/`em` oder `font-style: italic`/`oblique`; `font-style: normal` hebt auf. Hervorhebung = `mark` oder ein
  **Inline**-Element mit Hintergrundfarbe bzw. `mso-highlight`, die nicht `transparent`, `none`, `inherit`, `initial`, Weiß
  (`white`, `#fff`, `#ffffff`, `rgb(255, 255, 255)`) ist; der Hintergrund eines Blocks (Tabellenzelle in Word) zählt nicht.
  Hervorhebung gilt, wenn **ein** Inline-Vorfahr im Block sie trägt (sichtbar ist der Hintergrund des Vorfahren). Kandidaten:
  `u` → `underline`, `s`/`strike`/`del` → `strike`.
- **Liefert keinen Text:** `script`, `style`, `template`, `head`, `title`, `meta`, `link`, `xml`, `noscript`, `iframe`,
  `object`, `embed`, `svg`, `math`, `img`, `input`, `textarea`, `select`, `button`, Kommentare (auch bedingte Kommentare von
  Word) und Verarbeitungsanweisungen; Elemente mit `display:none`, `visibility:hidden` oder `mso-hide:all` (verborgener Text
  wird nicht sichtbar); Spans mit `mso-list:Ignore` (das Aufzählungszeichen einer Word-Liste; 055c macht daraus Listenpunkte).
  Links werden ihr Text, `href` wird nie gelesen.
- Der Text bleibt roh (kein Trimmen, kein Zeichenfilter): Leerraum, Steuer- und Formatzeichen regelt der Kern (N3, N4).
  Der Walker hält die Grenzen der Eingabeform ein, soweit er sie erzeugt (höchstens fünf Marken-Kandidaten je Lauf, Blockarten
  aus der obigen Liste); mehr Blöcke oder Läufe als `ANSWER_INPUT_LIMITS` beantwortet der Dienst mit 422 (Entscheidung 7).
- **`bodyToDom(doc, body)`** baut aus einer Speicher- oder Eingabeform die Knoten des Felds (`p`, `ul`/`li`, `b`, `i`, `span`
  mit Hintergrundfarbe); unbekannte Marken und Blockarten werden Text bzw. Absatz. `domToBodyInput(bodyToDom(b))` ergibt nach
  der Lesevariante wieder `b` (Test 2).

### 7. Entwurf, Senden, Vorschau (`apps/web/src/api/answerFormat.ts`, `focus.ts`, Beantwortung)

- **Wiederausgabe** in `apps/web/src/api/answerFormat.ts` (dort dürfen Werte aus `@hv/domain` geladen werden):
  `previewAnswer(input: AnswerBodyInput | null): AnswerBody | null` = `normalizeAnswerBodyForRead(input)`,
  `previewText(input)` = `answerPlainText(previewAnswer(input))` bzw. `''`, `answerBodyOf(version)` = `version.body ??
  answerBodyFromText(version.text)`, `sameBody(a, b)`. **Nur Vorschau, nie Autorität.** Die Lesevariante statt der
  Schreibvariante, weil sie nie wirft: Für jede Eingabe, die die Schreibvariante annimmt, ergeben beide dasselbe Dokument
  (055 N1–N7); wo sie abweichen (einsames Ersatzzeichen, Klartext über 20 000 Code-Punkte, mehr Blöcke als die Eingabeform
  erlaubt), antwortet der Kern 422 und die Schreibtür zeigt die Meldung wie bei jedem 422.
- **Senden** (beide Ansichten): `api.draftAnswer(id, { text: previewText(input), body: input, ...(sources) })`. So trägt der
  Rumpf als `text` die Klartextprojektion des normalisierten Dokuments (055 Entscheidung 4, Lesebefund Minor 1); `language`
  wird nicht gesendet (fehlt → `de`, N8). Immer mit `body`, auch ohne Auszeichnung: ein Weg.
- **Entwurf im Fokus** (`FocusDraft`): `text`/`baseText` werden `body: AnswerBodyInput | null` und `baseBody: AnswerBody |
  null`; dazu `generation: number`. `draftBase` nimmt `answerBodyOf(latest)` (bei einer Verweigerung als letzter Version leer,
  wie 054). `isDirty` = `!sameBody(previewAnswer(body), baseBody)` oder die Quellen weichen ab; eine **reine Markenänderung ist
  eine Änderung** (055 Entscheidung 7), reiner Leerraum nicht (wie das Trimmen in 054). `canSave` braucht
  `previewText(body) !== ''`. Vorlesezeit auf `previewText(body)` (054 „Hinweise an Folgescheiben“).
- **`writingOutcome`** vergleicht Dokumente statt Text. Neu im Ergebnis `rebase`: `reseed: boolean`. Trifft die **eigene**
  gespeicherte Version über den Strom ein, bevor oder nachdem der Schreibaufruf antwortet (gleiches Dokument), ist `reseed`
  `false`: `generation` bleibt, Caret und Inhalt des Felds bleiben (055 „Entwurf“ Punkt 8). Eine fremde Version über
  unverändertem Entwurf: `reseed: true`, `generation + 1`. Eine fremde Version über verändertem Entwurf: `notice` wie 054. Die
  Neu-laden-Schaltfläche von `focus-rebase` legt einen neuen Entwurf mit `generation + 1` an.
- **Nach dem Speichern** im Fokus: `baseBody = previewAnswer(gesendet)`, `baseVersion` wie heute; was inzwischen getippt
  wurde, bleibt und zählt (054). Das Feld wird nicht neu aufgebaut, der Fokus bleibt im Feld.
- **Beantwortung:** `QuestionDetail` hält statt `draft: string` die Eingabeform und eine `generation`; das Feld beginnt leer
  wie heute (Eigentümerfrage 4). „Verwerfen“ und der Neustart nach dem Speichern (`setDraftResetToken`) und nach einem
  Akteurwechsel (090) erhöhen `generation`, sodass das Feld leer neu aufbaut. `empty` = `previewText(input) === ''`.
- Kein Browser-Speicher (054; der Puffer kommt mit 060).

### 8. Tastenkürzel und Tastaturpfad (D8)

| Wo | Taste | Wirkung |
|---|---|---|
| Feld | Strg/Cmd+B | fett umschalten |
| Feld | Strg/Cmd+I | kursiv umschalten |
| Feld | Strg/Cmd+Umschalt+H | Hervorhebung umschalten |
| Feld | Strg/Cmd+Umschalt+L | Aufzählung umschalten (wie Word) |
| Feld | Strg/Cmd+U | nichts (verhindert; Unterstreichen gibt es nicht) |
| Feld im Schreibmodus | Strg/Cmd+Enter | speichert wie 054 (nur mit Änderung und `answer.draft`), nie Weiterleiten |
| Feld im Schreibmodus | Escape | verlässt den Schreibmodus wie 054, Entwurf bleibt |
| Werkzeugleiste | Pfeil links/rechts, Pos1, Ende | wechselt den Knopf; Enter/Leertaste schaltet, Fokus zurück ins Feld |

- Reine Hilfe `formatChord(event: { key; ctrlKey; metaKey; altKey; shiftKey; isComposing?; altGraph? })` in
  `editorCommands.ts`: `'bold' | 'italic' | 'highlight' | 'list' | 'blocked' | null`; nie mit Alt oder AltGr (deutsche
  Tastaturen: AltGr ist Strg+Alt), nie während einer Komposition, Buchstabe ohne Rücksicht auf Groß- und Kleinschreibung. Keine
  Überschneidung mit `isSaveChord` (Enter) und den Kürzeln der Anwendung (Alt+1…6, Alt+N, Alt+Q, `?`, die im Feld wegen
  `isTextEntry` ohnehin nicht greifen).
- Fokus: Öffnen des Schreibmodus setzt den Caret ans Ende des Felds (054 Entscheidung 5); Speichern bewegt den Fokus nicht.
  Übergaben (Weiterleiten, An anderen Fachbereich weiterleiten) bleiben, wie takt-043 sie baut: Vormerken **vor** dem
  Schreibaufruf, `disarmFocus` bei Ablehnung, `focusDue` entscheidet, `settleFocus` sofort nach dem Vormerken, weil der Strom
  die neue Version liefern kann, bevor der Schreibaufruf antwortet. 055b ändert daran nichts (F4 aus 054 bleibt wörtlich).

### 9. Sprache und Begriffe

- **9 Schlüssel je Sprache**, Paritätstest (f) 610 → **619** (zu Baubeginn neu zählen; weicht die Basis ab, gilt Basis + 9):
  `answers.format.toolbar` („Hausformat“ / „House format“), `answers.format.bold` („Fett“ / „Bold“), `answers.format.italic`
  („Kursiv“ / „Italic“), `answers.format.highlight` („Hervorhebung“ / „Highlight“), `answers.format.list` („Aufzählung“ /
  „Bulleted list“), `answers.format.hint` („Schrift und Größe kommen von der Ansicht.“ / „Font and size come from the view.“),
  `answers.format.keys` („Strg+B fett · Strg+I kursiv · Strg+Umschalt+H Hervorhebung · Strg+Umschalt+L Aufzählung“ /
  „Ctrl+B bold · Ctrl+I italic · Ctrl+Shift+H highlight · Ctrl+Shift+L bulleted list“), `answers.version.formatOnly` („Nur die
  Auszeichnung ist geändert, der Wortlaut ist gleich.“ / „Only the formatting changed; the wording is the same.“),
  `history.answer.title` („Antwort, Version {version}“ / „Answer, version {version}“).
- Kein „Editor“, „Rich Text“, „Markdown“ in Texten; Hausvokabular (R9). Glossarzeilen: **Hausformat** (House format; die
  Whitelist aus ADR 0005; meiden: „Formatierung frei“), **Hervorhebung** (Highlight; Marke `highlight`; meiden: „Markierung“,
  weil das die Auswahl meint), **Auszeichnung** (Formatting; fett, kursiv, Hervorhebung; meiden: „Styling“).

### 10. Sicherheit (T-G1-T-06, zweite Hälfte)

- Eine Semgrep-Regel `no-html-sink` in `scripts/semgrep/rules.yml` für `apps/web/src`: Zuweisung an `innerHTML`,
  `outerHTML`, `srcdoc`; Aufrufe `insertAdjacentHTML`, `document.write`, `createContextualFragment`, `execCommand` mit
  `insertHTML`. Schwere ERROR (blockiert in CI wie die vorhandene Regel). Probe im Bau: eine Wegwerfdatei mit
  `el.innerHTML = x` meldet die Regel (Ausgabe im Bericht), danach gelöscht.
- Keine Ereignisnutzlast im Renderer (Entscheidung 1); keine fremden Knoten im lebenden Dokument (Entscheidung 5); kein
  Attribut aus Daten außer dem geprüften `lang`; kein `href`, kein `src`.
- **Kein Nachladen beim Einfügen** ist eine nachgewiesene, keine angenommene Eigenschaft: Pflichttest A2b, verbindlicher
  Rückfall auf `text/plain` (Entscheidung 5). Die fehlende CSP der Web-Seite bleibt bei 037b (Vorbedingungsfrage).
- **Trojan-Source-Lehre:** Steuer-, Format- und unsichtbare Zeichen (auch U+00A0, U+200B, U+202E, U+FEFF) stehen in Quell-,
  Test- und e2e-Dateien nur als `\u`-Escape oder HTML-Entität, nie roh. Akzeptanzkriterium 7 prüft das mit einer Suche.
- Die Word-Probe ist synthetisch (kein echtes Dokument, keine echten Namen, keine Unternehmensdaten; R11).
- Mit dem Merge von 055b fällt die Sperre aus 055 Entscheidung 10 („055 nicht vor 055b in eine geteilte Umgebung“). Ausgerollt
  wird weiterhin nur aus der Pipeline nach Go des Eigentümers.

## Nicht-Ziele

- Kein Vertrag, kein Kern, kein Dienst: keine Änderung an `packages/**`, `apps/api/**`, `openapi.yaml`, `answerFormat.ts`.
- Keine Normalisierung oder Whitelist als Regel in der Oberfläche; die Vorschau ist nie Autorität.
- Keine nummerierte Liste, keine verschachtelte Liste, keine Überschrift, keine Tabelle, kein Link, keine Schriftwahl, keine
  Schriftgröße, keine Farbe außer der Hervorhebung (E6).
- Keine Word-Listen ohne `ul`/`ol` als Listenpunkte, kein einstufiges Rückgängig eines Einfügens (055c).
- Kein Export (051/052), keine Bühne je Gerät (056), keine Rechtsfreigabe-Sicht (059).
- Kein Entwurf im Browser-Speicher, kein Entwurfspuffer, keine Präsenz (060).
- Keine Verweigerung mit `body` (055 Nicht-Ziel), keine Änderung am Verweigerungsdialog.
- Keine Änderung an `useWriteDoor`, `ForwardDialog`, `forward.ts`, `focusDue`, `disarmFocus`, an der Steuerungsansicht, an
  Rechten, Übergängen, Seed oder Lastkorpus.
- Keine neue Abhängigkeit (SC-10), kein jsdom, keine Testing Library.
- Kein Vorbelegen des Felds in der Beantwortung (Eigentümerfrage 4).

## Files allowed

Renderer:

- `apps/web/src/components/AnswerText.tsx` (neu), `apps/web/src/components/AnswerText.test.tsx` (neu)
- `apps/web/src/components/index.ts` (nur der Export von `AnswerText`)

Editor, Walker, Beantwortung:

- `apps/web/src/features/answers/AnswerBodyEditor.tsx` (neu), `apps/web/src/features/answers/AnswerBodyEditor.test.tsx` (neu)
- `apps/web/src/features/answers/editorCommands.ts` (neu), `apps/web/src/features/answers/editorCommands.test.ts` (neu)
- `apps/web/src/features/answers/domToBody.ts` (neu), `apps/web/src/features/answers/domToBody.test.ts` (neu)
- `apps/web/src/features/answers/AnswerEditor.tsx` (Feld statt `<textarea>`)
- `apps/web/src/features/answers/QuestionDetail.tsx`, `apps/web/src/features/answers/QuestionDetail.test.tsx` (Versionen über
  den Renderer, Hinweis „Nur Auszeichnung geändert“, Entwurf als Eingabeform)
- `apps/web/src/features/answers/Page.tsx` (nur der Fall `draft` in `onAction`: Senden mit `text` und `body`)
- `apps/web/src/features/answers/lib.ts`, `apps/web/src/features/answers/lib.test.ts` (nur `sameBody`, falls nicht in der
  Wiederausgabe)

Fokus:

- `apps/web/src/features/focus/WritingMode.tsx`, `apps/web/src/features/focus/WritingMode.test.tsx`
- `apps/web/src/features/focus/FocusDetail.tsx`, `apps/web/src/features/focus/FocusDetail.test.tsx` (nur `focus-latest`)
- `apps/web/src/features/focus/focus.ts`, `apps/web/src/features/focus/focus.test.ts` (Entwurf, `draftBase`, `isDirty`,
  `writingOutcome`; `focusDue`, `disarmFocus`, `focusActions` unverändert)
- `apps/web/src/features/focus/Page.tsx` (nur Entwurf, Speichern, `generation`; Fokuslogik aus takt-043 unverändert)

Bühne und Historie:

- `apps/web/src/features/stage/Podium.tsx`, `apps/web/src/features/stage/Podium.test.tsx` (nur `stage-answer`,
  `stage-preview-answer`)
- `apps/web/src/features/history/AnswerBlock.tsx` (neu), `apps/web/src/features/history/AnswerBlock.test.tsx` (neu)
- `apps/web/src/features/history/Page.tsx` (nur das Einsetzen des Antwortblocks)

Wiederausgabe:

- `apps/web/src/api/answerFormat.ts` (neu), `apps/web/src/api/answerFormat.test.ts` (neu)

Sprache:

- `apps/web/src/i18n/answers.de.ts`, `apps/web/src/i18n/answers.en.ts` (nur die acht Schlüssel aus Entscheidung 9)
- `apps/web/src/i18n/history.de.ts`, `apps/web/src/i18n/history.en.ts` (nur `history.answer.title`)
- `apps/web/src/i18n/parity.test.ts` (nur die Zahl in (f))

e2e:

- `apps/web/e2e/055b-antwortformat.spec.ts` (neu)
- `apps/web/e2e/support/word-sample-055b.ts` (neu, synthetische Word-, Google-Docs- und Browser-Proben als Zeichenketten)
- `apps/web/e2e/support/e2e-texts.ts` (nur die Konstanten dieser Scheibe und ihre Einträge in `WRITTEN_TEXTS`)
- `apps/web/playwright.config.ts` (nur `SHARED_SPECS`: die neue Datei nach 054)
- `scripts/e2e-http-031.test.mjs` (nur `SHARED_FILES` und `HTTP_ORDER`: die neue Datei zwischen 054 und 080)
- `apps/web/e2e/054-fokusansicht.spec.ts` (nur die Zusicherungen auf `focus-editor` in Zeile 246, 259, 275, 311, 324, 527, 539:
  `toHaveValue` → `toHaveText`, `inputValue` → Textinhalt; keine Zusicherung entfällt, keine wird schwächer)
- `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (nur `valueOrAbsent` und `expectVisibleAndEmpty`: für ein `contenteditable`-Feld
  den Textinhalt lesen; Aufrufe und Erwartungen bleiben)
- `apps/web/e2e/013-tastaturpfad.spec.ts` (nur falls Vor-dem-Bau-Punkt 6 es verlangt: die Höchstzahl der Tabulatorschritte zu
  `answer-editor` in Zeile 400 um eins)
- Nachtrag Orchestrator 05.10.2026: `apps/web/e2e/010d-ansichtsdaten.spec.ts` — nur die zwei `toHaveValue`-Prüfungen auf `answer-editor` (Z. 885, 1052) werden `toHaveText`, weil das Feld jetzt `contenteditable` ist

Sonstiges:

- `scripts/semgrep/rules.yml` (nur die Regel `no-html-sink`)
- `docs/evidence/055b-*.png`
- `docs/glossar.md` (nur die drei Zeilen aus Entscheidung 9)
- `docs/sicherheit/bedrohungsmodell.md` (nur die Zelle von T-G1-T-06 für die zweite Hälfte — Renderer, Einfügen ohne Senke,
  „kein Nachladen beim Einfügen, nachgewiesen durch A2b, Rückfall `text/plain`; CSP der Web-Seite weiter geplant in 037b“ —
  und eine Zeile 055b unter „Weitere Scheiben mit Sicherheitsbezug“)
- `docs/folgeliste.md` (nur nicht blockierende Befunde des Baus und des Reviews)
- `docs/slices/055b-antwortformat-editor.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

`packages/**`, `apps/api/**`, `apps/web/src/api/**` außer der neuen Wiederausgabe und ihrem Test (auch nicht `http.ts`),
`apps/web/src/styles/**` (kein neues Token), `apps/web/src/components/**` außer `AnswerText` und dem Export,
`apps/web/src/app/**`, `apps/web/src/features/{steering,capture,speakers}/**`, `useWriteDoor.ts`, `ForwardDialog.tsx`,
`forward.ts`, `RefusalDialog.tsx`, `apps/web/src/i18n/labels.ts`, fremde e2e-Dateien außer den genannten Stellen in 054, 090
und 013, `apps/web/e2e/support/**` außer `e2e-texts.ts` und der neuen Probendatei, `scripts/**` außer der Semgrep-Regel und den
beiden Dateilisten, `.github/**`, `package.json` und Lockfile (keine Abhängigkeit), `docs/produktplan-beta.md` und das
Register (Hinweise an den Orchestrator). Muss eine dieser Dateien sich ändern: anhalten und melden.

## Vor dem Bau prüfen

1. **Basis:** 055 gemergt (`4da0165` oder später); `normalizeAnswerBodyForRead`, `answerPlainText`, `answerBodyFromText` sind
   über `@hv/domain` erreichbar; `Question.answers[n].body` kommt in beiden Betriebsarten an (Probe: eine Version mit Marke
   über die Demo schreiben und lesen). Paritätstest (f) bei 610. Weicht etwas ab: anhalten und melden.
2. **Kürzel gegen Browser:** Strg/Cmd+B, I, U, Umschalt+H, Umschalt+L gegen die dokumentierten Kürzel von Chromium, Firefox
   und WebKit (Quellen im Bericht; bekannt: Firefox Strg+Umschalt+H öffnet die Chronik, Safari Cmd+Umschalt+H und
   Cmd+Umschalt+L sind Menübefehle). In Chromium über Playwright zeigen, dass `preventDefault` greift; Firefox und WebKit,
   soweit lokal installiert, sonst „nicht geprüft“ in Bericht und Folgeliste. Lässt sich ein Kürzel in einem unterstützten
   Browser nicht abfangen: anhalten und melden (Eigentümerfrage 3), nicht still ein anderes wählen.
3. **Befehle auf eigenem Inhalt:** Auf einem aus `bodyToDom` gebauten Inhalt schalten `bold`, `italic`, `hiliteColor` und
   `insertUnorderedList` in Chromium um und hin zurück, und der Walker liest danach dasselbe Modell wie vorher (Ergebnis je
   Befehl im Bericht). Lösen `execCommand`-Befehle `beforeinput` aus, nimmt die Allowlist sie mit; Ergebnis im Bericht.
4. **Rückgängig nach Neuaufbau:** In Chromium (und, soweit vorhanden, Firefox/WebKit) tippen, einfügen, Strg+Z: Entsteht ein
   Stand, der nie bestand, gilt der Schutz aus Entscheidung 5 (Ergebnis im Bericht).
5. **Seed `http`:** Nach 002 … 054 (`HTTP_ORDER`) hält die gebundene Fachkraft in Finanzen mindestens eine Einzelfrage in
   `assigned` oder `answer_drafted` mit `answer.draft` (nach 054 erwartet: F2, F4, F7). Prüfung über die Endzustände der
   Dateiköpfe, wo nötig über eine Probe gegen die lokale Datenbank. Fehlt sie: anhalten und melden.
6. **Tabulatorweg 013:** `013-tastaturpfad.spec.ts:400` mit der Werkzeugleiste (ein Halt) laufen lassen; reicht 15 nicht,
   die Zahl um eins erhöhen (einzige erlaubte Änderung dort), Ergebnis im Bericht.
7. **Laufzeit `e2e-http`:** Die Dauer des Schritts „End-to-end http project …“ aus den letzten drei grünen Läufen mit
   ausgeführtem Schritt neu lesen (`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`). Schätzung der Mehrzeit: ein
   Rollenwechsel, Schreiben, Neuladen, Prüfen ≈ **0:25–0:40**. Liegt Ist plus Schätzung über **6:30** (Plan Zeile 781), im
   Bericht und an den Orchestrator melden; über **8:00** anhalten. Der Bau ändert weder Workflow noch Harness.
7a. **CSP (nur lesend, Ergebnis steht schon in Entscheidung 5):** neu lesen, ob `netlify.toml`, `deploy/docker/nginx.conf`
   oder `apps/web/index.html` inzwischen eine CSP für die Web-Seite setzen; Ergebnis im Bericht. Keine Änderung daran in
   dieser Scheibe.
8. **Kontrast:** `<mark>` mit den beiden Tokens auf hellem Grund und in `.stage-contrast` ≥ 4,5:1 (axe misst mit; Wert im
   Bericht).

## Tests zuerst (rot, dann grün)

Jeder Test steht vor der Änderung und ist rot (Ausgabe im Bericht), danach grün. Zeichen wie U+00A0, U+200B, U+202E nur als
`\u`-Escape.

**Einheit (vitest, ohne DOM)**

1. **`AnswerText.test.tsx`** (statisch gerendert): (a) Absatz → `<p>`, Liste → `<ul><li>`; (b) Marken → `<strong>`, `<em>`,
   `<mark>` in kanonischer Schachtelung, `<mark>` mit den beiden Tokens; (c) unbekannte Blockart (erzwungen) → `<p>`;
   unbekannte Marke → nur Text; (d) Text `<script>alert(1)</script>` und `<b onclick=…>` erscheinen escaped, das Markup enthält
   kein `<script` und kein `onclick`; (e) `lang="de"` an der Wurzel; `language` mit anderem Wert (erzwungen, auch
   `x" onload="`) → kein `lang`; (f) ohne `body` → Text mit `whitespace-pre-wrap`, ohne `lang`; (g) keine Schriftklasse, keine
   Größenklasse an der Wurzel; (h) **Quelle:** eine Suche über `apps/web/src/features/**` und `apps/web/src/components/**`
   findet kein `payload.answer` mit `.body` (Test liest die Dateien, schlägt bei einem Treffer fehl).
2. **`domToBody.test.ts`** (Testknoten nach der minimalen Schnittstelle): (a) `b`, `strong`, `font-weight:700`, `bold`, `600` →
   fett; `500` nicht; `<b style="font-weight:normal">` mit innerem `font-weight:700` → nur der innere Teil fett; (b) `i`, `em`,
   `font-style:italic` → kursiv, `font-style:normal` hebt auf; (c) `mark`, `background:yellow`, `background-color:#ff0`,
   `mso-highlight:yellow` → Hervorhebung; `transparent`, `white`, `#fff`, `#ffffff`, `rgb(255, 255, 255)`, `inherit` nicht;
   Hintergrund einer `td` nicht; (d) `u` → `underline`, `s`/`del` → `strike` (Kandidaten); (e) `h2` → `heading`,
   `blockquote` → `quote`, `td` → `table`, `ol`/`ul` → `list` mit Punkten, verschachtelte Liste flach, Block im Block teilt;
   (f) `br` beendet Absatz bzw. Punkt, `br` am Blockende nichts; (g) kein Text aus `script`, `style`, `template`, `head`,
   `title`, `meta`, `xml`, `noscript`, `iframe`, `svg`, `img`, Kommentar, bedingtem Kommentar, `display:none`,
   `visibility:hidden`, `mso-hide:all`, `mso-list:Ignore`; Link → nur Text; (h) Text bleibt roh (U+00A0, U+200B als Escape
   bleiben im Lauf); (i) `domToBodyInput(bodyToDom(b))` nach der Lesevariante gleich `b` für fünf feste Dokumente; `bodyToDom`
   erzeugt nur `p`, `ul`, `li`, `b`, `i`, `span` und Textknoten (Aufzeichnung der Fabrikaufrufe); (j) der Walker ruft auf den
   Testknoten `getAttribute` nur mit `style` auf (Aufzeichnung; ein Testknoten mit `src`, `href`, `srcset`, `poster`, `data`,
   `background` wird gelesen, ohne dass eines davon abgefragt wird), und kein Knoten der Eingabe erscheint in der Ausgabe von
   `bodyToDom` (Identitätsvergleich).
3. **`editorCommands.test.ts`:** `formatChord` für Strg und Cmd, mit und ohne Umschalt, Groß- und Kleinbuchstabe; `null` mit
   Alt, mit AltGr, während einer Komposition, für Enter; `'blocked'` für Strg+U. `allowedInputType`: die Allowlist aus
   Entscheidung 4 ja, `formatUnderline`, `formatSetInlineTextDirection`, `insertLink`, `insertFromPaste`, `insertFromDrop`,
   ein unbekannter Typ nein.
4. **`focus.test.ts`** (Test 8 erweitert): `draftBase` mit `body` (aus der Version, aus L ohne `body`, leer bei Verweigerung);
   `isDirty` bei reiner Markenänderung `true`, bei reinem Leerraum `false`, bei Quellen wie 054; `writingOutcome`: eigene
   Version (gleiches Dokument) → `rebase` mit `reseed: false` vor und nach der Antwort des Schreibens; fremde Version über
   unverändertem Entwurf → `reseed: true`; über verändertem → `notice`; `focusDue`- und `disarmFocus`-Fälle aus takt-043
   unverändert grün. `readingSeconds(previewText(…))` zählt keine Aufzählungszeichen.
5. **`answerFormat.test.ts`** (Wiederausgabe): `previewText` einer Eingabe mit Liste, Marken, U+202E (Escape) und
   unbekannter Marke gleich `answerPlainText` der Schreibvariante; `previewAnswer(null)` und ein Dokument nur aus Leerraum →
   `null`; ein einsames Ersatzzeichen wirft nicht (Vorschau), `answerBodyOf` ohne `body` → L.
6. **Gleiche Darstellung (Recht/Freigabe):** für dieselbe Version erzeugen `VersionCard` (Beantwortung), `stage-answer`
   (Bühne), `focus-latest` und `history-answer` dasselbe Markup des Renderers (Vergleich des `AnswerText`-Teils im statischen
   Rendern; Tests in `QuestionDetail.test.tsx`, `Podium.test.tsx`, `FocusDetail.test.tsx`, `AnswerBlock.test.tsx`).
7. **`QuestionDetail.test.tsx`:** Hinweis `answer-diff-format-only` bei gleichem `text` und anderem `body`; Diff wie bisher bei
   anderem `text`; `answer-editor` ist ein Feld mit `role="textbox"` und Werkzeugleiste; `refusalJustification` steht nie im
   Renderer.
8. **`WritingMode.test.tsx`** (Test 7 umgestellt): Feld `focus-editor` mit `role="textbox"`, `aria-multiline`,
   `aria-labelledby`, `aria-describedby` (Kürzel und Hinweis Z6), `lang="de"`; Werkzeugleiste mit vier Knöpfen,
   `aria-pressed="false"`, genau einer mit `tabIndex=0`; `focus-save` mit `aria-disabled` ohne Änderung; Vorlesezeit aus der
   Vorschau; `focus-rebase` wie 054.
9. **`AnswerBodyEditor.test.tsx`** (statisch): Platzhalter sichtbar und `aria-hidden` bei leerem `initial`; kein Platzhalter
   mit Inhalt; Größen `large`/`compact`.
10. **`Podium.test.tsx`:** `stage-answer` und `stage-preview-answer` sind `<div>` mit `data-prepared` bzw. denselben Klassen,
    enthalten `<strong>`/`<mark>` aus der freigegebenen Version und ohne Version den Platzhalter.

**e2e, `apps/web/e2e/055b-antwortformat.spec.ts`** (Projekt `in-process`, `test.skip(isHttp())` außer H1; jede Datei frisch;
Viewport 1440 × 900)

- **A1 Schreibmodus mit Werkzeugleiste und Kürzeln @screenshot:** Fachkraft, Fokus, Schreibmodus einer Einzelfrage; Feld leeren,
  einen Absatz tippen, ein Wort mit der Tastatur markieren, Strg+B (Knopf `format-bold` wird `aria-pressed="true"`), ein
  anderes Wort Strg+Umschalt+H, Enter, zwei Zeilen und Strg+Umschalt+L (Liste mit zwei Punkten), Strg+U ändert nichts; Werkzeugleiste
  einmal nur mit der Tastatur (Tab, Pfeil, Leertaste) bedienen, Fokus kehrt ins Feld zurück. Screenshot `055b-editor-de.png`,
  Sprache umschalten, `055b-editor-en.png` (Feld behält Inhalt und `lang="de"`). Strg+Enter speichert: Fokus bleibt im Feld,
  Caret und Inhalt unverändert, auch nachdem die eigene Version über den Strom kam; `focus-save` `aria-disabled`. Escape:
  `focus-latest` zeigt `strong`, `mark`, `ul > li` (2) und `lang="de"`. axe ohne serious/critical.
- **A2 Einfügen aus Word, inert:** synthetisches `ClipboardEvent('paste')` mit `DataTransfer` (`text/html` = Word-Probe aus
  `word-sample-055b.ts`, `text/plain` dazu). Die Probe enthält fett, kursiv, Hintergrund, `<u>`, einen Stilblock, bedingte
  Kommentare, `<o:p>`, eine Word-Liste mit `mso-list:Ignore`, verborgenen Text, `<img src=x onerror=…>` und `<script>`, die
  beide einen Marker auf `window` setzen würden. Danach: Marker unberührt; im Feld nur `p`, `ul`, `li`, `b`, `i`, `span`,
  Textknoten und kein `img`, `style`, `script`; der unterstrichene Text steht als Text da; verborgener Text und
  Aufzählungszeichen fehlen; Caret am Ende des Eingefügten. Gleiche Prüfung für ein `drop`-Ereignis mit derselben Probe und
  für nur `text/plain` (drei Zeilen → drei Absätze). Speichern; `focus-latest` zeigt nur `strong`, `em`, `mark`, `p`.
- **A2b Einfügen lädt nichts nach (Pflicht, Codex P1 auf #156):** echter Browser, Projekt `in-process`. Vor dem Einfügen
  `context.route` auf einen eindeutigen Wächter-Host (z. B. `http://sentinel-055b.invalid/<Zufallspfad>`, Konstante in
  `word-sample-055b.ts`, ohne die Wörter KEY, TOKEN, SECRET, PASSWORD) mit Abbruch jeder Anfrage, dazu `page.on('request')`
  und `context.on('request')` (auch Anfragen aus Rahmen und Workern), die jede URL mit dem Wächter-Host zählen. Die Probe
  `SENTINEL_SAMPLE_055B` enthält, alles auf den Wächter zeigend: `<img src>`, `<img srcset>`, `<picture><source srcset>`,
  `<iframe src>`, `<link rel=stylesheet href>`, `<link rel=preload href>`, `<video poster>` mit `<source src>`, `<audio src>`,
  `<object data>`, `<embed src>`, `<svg><image href>` und `xlink:href`, `<style>@import url(…)</style>`, `style="background-image:url(…)"`,
  `<body background>`, `<table background>`, `<td background>`, `<input type=image src>`, `<meta http-equiv=refresh>`,
  `<base href>` und dazwischen fetten Text. Einfügen über `paste` und getrennt über `drop`. Ruhezustand an einem beobachtbaren
  Ereignis, **nicht** mit einer bloßen Wartezeit: nach `expect.poll` auf den neuen Inhalt des Felds (der fette Text steht im
  Feld) zusätzlich `page.waitForLoadState('networkidle')` und ein `requestAnimationFrame`-Doppel im Seitenkontext; danach
  speichern, bis `focus-latest` die Version zeigt (Renderer läuft einmal), erneut `networkidle`. Erwartung: **null**
  Anfragen an den Wächter-Host während und nach dem Einfügen; im Feld kein Element mit `src`, `href`, `srcset`, `poster`,
  `data`, `background`. Ein Kontrollfall im selben Test (ein absichtlich ins **lebende** Dokument gesetztes `img` mit
  Wächter-URL über `page.evaluate` nach dem Einfügen) zählt genau eine Anfrage und belegt, dass die Zählung greift. Läuft
  auch mit `--repeat-each=3`. Ist A2b rot: Rückfall aus Entscheidung 5, keine andere Umgehung.
- **A3 Walker gegen echtes DOM:** über den Entwicklungsserver `domToBody.ts` laden (Muster `API_MODULE` in 090), die Proben aus
  `word-sample-055b.ts` (Word, Google Docs mit `<b style="font-weight:normal">`, Browserkopie einer Webseite, LibreOffice) mit
  `DOMParser` lesen und `domToBodyInput` gegen wörtlich im Test stehende Eingabeformen prüfen. Kein Screenshot.
- **A4 Ganzer Weg bis zur Bühne @screenshot:** formatierte Antwort im Fokus speichern; in der Beantwortung eine neue Version
  nur mit zusätzlicher Marke (`answer-editor`, gleicher Wortlaut) → `answer-diff-format-only` sichtbar, Hinweis R-GUARD-04
  erschien vorher, falls eine Freigabe bestand; Weiterleiten, Rechtsfreigabe (Rolle Recht), Freigabe (Freigebende),
  auf die Bühne (Moderation); auf der Bühne die Vorschau der Einzelfrage aus der Warteschlange öffnen:
  `stage-preview-answer` zeigt `strong`, `mark`, `ul > li` und `lang="de"`. Screenshots `055b-buehne-de.png`,
  `055b-buehne-en.png` (Englisch: Oberfläche englisch, Antwort mit `lang="de"`). axe auf der Bühne.
- **A5 Historie @screenshot:** Historie, die Einzelfrage aus A4 wählen: `history-answer` mit „Antwort, Version n“ über der
  Zeitleiste, Format wie auf der Bühne. Screenshots `055b-historie-de.png`, `055b-historie-en.png`. axe.
- **A6 Daten je Akteur (090):** ungespeicherter formatierter Entwurf in der Beantwortung, Akteurwechsel und zurück → Feld
  leer, kein Text der vorigen Person im Hauptbereich.
- **H1 (nur `http`, schlank):** gebundene Fachkraft, Fokus, erste eigene Einzelfrage in `answer_drafted` oder `assigned`
  (`findMine`-Muster aus 054), Schreibmodus, Text mit einem fetten und einem hervorgehobenen Wort über die Werkzeugleiste,
  Strg+Enter, warten bis `focus-latest` die neue Version zeigt, `page.reload()`, `focus-latest` zeigt `strong` und `mark` mit
  den erwarteten Wörtern und `lang="de"`. Kein Screenshot, kein Rollenwechsel außer dem einen. Dateikopf nennt den Endzustand:
  „eine Einzelfrage in Finanzen hat eine zusätzliche Version mit `FORMAT_055B_HTTP_ANSWER` und `body`; sonst nichts geändert“.

## Akzeptanzkriterium

1. Tests 1–10 und A1–A6, A2b, H1 vor der Änderung rot (Ausgabe im Bericht), danach grün; A1–A6 und A2b im Projekt
   `in-process` auch mit `--repeat-each=3`.
1a. **A2b grün** (null Anfragen an den Wächter-Host, Kontrollfall zählt eine). Ist A2b nicht grün zu bekommen, gilt der
   Rückfall aus Entscheidung 5 (nur `text/plain`), A2b läuft dann gegen das umgestellte Einfügen und ist grün, und der Bericht
   nennt die Umstellung; ein Merge mit rotem A2b ist ausgeschlossen.
2. Volle Playwright-Suite `in-process` grün (Anzahl nennen), darunter **unverändert** 001, 003, 010b, 010c, 010d, 013 (außer
   der einen Zahl, falls Vor-dem-Bau-Punkt 6 sie verlangt), 020, 021b, 021c, 024, 040a, 045, 053, abnahme, und 054 sowie 090 nur
   mit den Umstellungen aus „Files allowed“ (Ergebnis je Datei im Bericht); axe ohne serious/critical. Projekt `http` grün im
   CI-Lauf `e2e-http` des PR, Dauer des Schritts im Bericht.
3. Sechs Screenshots in `docs/evidence/` aus `in-process`: `055b-editor-de.png`, `055b-editor-en.png`, `055b-buehne-de.png`,
   `055b-buehne-en.png`, `055b-historie-de.png`, `055b-historie-en.png`. Auf jedem sind fett, Hervorhebung und eine Aufzählung
   lesbar; auf dem Editorbild Werkzeugleiste und Hinweis Z6; auf dem Bühnenbild der dunkle Grund mit lesbarer Hervorhebung.
4. Kein `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `execCommand('insertHTML')`, `document.write`,
   `createContextualFragment`, `dangerouslySetInnerHTML` in `apps/web/src` (Semgrep `no-html-sink` und die vorhandene Regel,
   Probe im Bericht); `DOMParser` nur in `domToBody.ts`; `execCommand` nur in `editorCommands.ts` (Review prüft den Diff).
5. Kein Rollenname in einem Vergleich (`pnpm role-literals`), kein Literal in Komponenten (`pnpm i18n-literals`),
   `pnpm vocabulary` grün; Paritätstest bei Basis + 9.
6. `git diff` zeigt keine Datei unter `packages/`, `apps/api/`, keine Änderung an `package.json` oder Lockfile, kein
   `http.ts`; `pnpm slice-scope` grün auf dem Branch `claude/slice-055b-…`.
7. Eine Suche nach rohen Steuer-, Format- und unsichtbaren Zeichen (`LC_ALL=C.UTF-8 grep -nP`; ohne UTF-8-Locale bricht
   `grep` mit „code point value too large“ ab, was kein grüner Befund ist; über `\x{0000}-\x{0008}`, `\x{000B}`,
   `\x{000C}`, `\x{000E}-\x{001F}`, `\x{007F}-\x{009F}`, `\x{00A0}`, `\x{00AD}`, `\x{200B}-\x{200F}`, `\x{202A}-\x{202E}`,
   `\x{2060}-\x{2064}`, `\x{2066}-\x{2069}`, `\x{FEFF}`) über alle berührten Dateien findet nichts (Befehl und Ausgabe im
   Bericht).
8. Der Bericht enthält die Zeile „055 und 055b sind zusammen auslieferbar; Ausrollen nur nach Go des Eigentümers“.
9. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Nachweise

- Ausgabe der roten Tests vor der Änderung; Schluss von `pnpm gates`; Zahl der Playwright-Fälle `in-process`; Ergebnisse der
  Vor-dem-Bau-Punkte 2–8.
- `docs/evidence/055b-*.png` (sechs Dateien, Akzeptanzkriterium 3): der Bildnachweis aus ADR 0005.
- **Projekt `http`:** grüner CI-Lauf `e2e-http` des PR mit Lauf-ID, Job-ID, Commit, dem Schluss des Logs mit der Zeile von H1
  und der Dauer des Schritts „End-to-end http project …“ gegen 8:00/9:00 (Mehrzeit gegen die Läufe aus Vor-dem-Bau-Punkt 7).
  Kein Artefakt nötig, keine Workflow-Änderung.
- Probe der Semgrep-Regel (Ausgabe) und Suche aus Akzeptanzkriterium 7.
- Design-Kritik D1–D10 als Tabelle im Bericht (je Zeile ja/nein mit einem Satz).

### Design-Vorgaben D1–D10 (Checkliste `docs/design-prinzipien.md`)

| D | Vorgabe für diese Scheibe | Prüfung |
|---|---|---|
| D1 | Die Werkzeugleiste erklärt sich ohne Text: vier Symbole mit Namen als Tooltip, gedrückt sichtbar; der Hinweis Z6 in einem Satz. | Screenshot, Review |
| D2 | Keine neue primäre Aktion; „Entwurf speichern“ bleibt die eine primäre im Schreibmodus mit Änderung (054). | Test 8; A1 |
| D3 | Werkzeugleiste im 8-px-Raster bündig mit dem Feld; Blockabstände relativ zur Schrift, Bühne und Fokus gleich gegliedert. | Screenshot |
| D4 | Farbe nur für die Hervorhebung (ein vorhandenes Token, Kontrast ≥ 4,5:1 auch auf der Bühne); gedrückte Knöpfe über Tönung, nicht über Farbe allein. | Vor-dem-Bau-Punkt 8; axe |
| D5 | Versionsnummer im Historienblock in Mono wie in der Beantwortung. | Test 6; Screenshot |
| D6 | Leeres Feld mit Platzhalter; ohne Version kein Historienblock; ohne `body` Rückfall auf Text; 422 des Kerns über die Schreibtür. | Test 1, 9; A2 |
| D7 | 9 Schlüssel je Sprache, Hausvokabular („Hausformat“, „Hervorhebung“, „Auszeichnung“), kein „Editor“. | Paritätstest (f); `pnpm vocabulary`, `pnpm i18n-literals` |
| D8 | Kernszene mit Tastatur: Kürzel, Werkzeugleiste mit einem Tabulatorhalt und Pfeilen, Strg+Enter, Escape wie 054; Fokus sichtbar; Fokus nach Übergaben wie takt-043. | Test 3, 8; A1; 054 F2–F4 |
| D9 | Das Feld bleibt bei 20 000 Zeichen flüssig: der Walker läuft je Eingabe unter 16 ms (Messung in A1 mit einem langen Text, Wert im Bericht); Listen bei 800 Fragen unverändert. | A1; `timing053.test.ts` |
| D10 | Ruhig: vier Knöpfe, ein Satz Hinweis, keine Menüs, keine Farbwahl, keine Schriftwahl. | Screenshot, Design-Kritik |

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: mittel
Ausgelöst: [x] Fachregel, Status (nur Anzeige; R-TRANS-03 mit `body`, R-GUARD-04 Hinweis) [ ] Vertrag, Ereignis,
Konfiguration [ ] Persistenz, Migration, Nebenläufigkeit (Strom vor Schreibantwort: nur Oberfläche, Entscheidung 7) [ ] Rolle,
Recht, Identität, Schutzklasse [ ] personenbezogene oder vertrauliche Daten [ ] Betrieb, Wiederherstellung [ ] Administration
[x] Oberfläche, Barrierefreiheit (Renderer, Editor, Screenreader, Kontrast, Tastatur) [ ] Nachbarsystem [ ] KI, Agenten
[x] Dokumentation (Glossar, Bedrohungsmodell)
Perspektive(n): Security, UX/Barrierefreiheit, Prüfpunkt Recht/Freigabe · Nachweise: oben · Offene Entscheidung: E6 (Standard
Whitelist, keine nummerierte Liste), E21 (Standard nur `de`)

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| Skript aus Daten oder aus der Zwischenablage wird ausgeführt | Renderer nur mit React-Elementen; Einfügen über `DOMParser`-Dokument, nur neu erzeugte Knoten; Semgrep `no-html-sink` | Test 1 (d), 2 (g); A2 (Marker); Akzeptanz 4 |
| Eingefügtes HTML lädt Bild, Rahmen, Stilblatt oder Medien nach (Verfolgung, Datenabfluss über die Adresse; Codex P1 auf #156) | kein fremder Knoten im lebenden Dokument, Walker liest keine URL-Attribute; Nachweis statt Annahme; Rückfall `text/plain`; CSP der Web-Seite fehlt (037b, Vorbedingungsfrage) | Test 2 (j); A2b; Akzeptanz 1a |
| Renderer zeigt eine ungeprüfte Ereignisnutzlast | Quelle nur `Question.answers[n]`; Quelltextsuche | Test 1 (h); Review |
| Beantwortung (Freigabe) und Bühne zeigen dieselbe Version verschieden | ein Renderer für alle Stellen | Test 6; A4 |
| Feld zeigt Auszeichnung, die beim Speichern verschwindet | Allowlist für `beforeinput`, Strg+U verhindert, `bodyToDom` kennt nur die Whitelist | Test 3; A1, A2 |
| Ungespeicherter Text geht verloren (Strom, Akteurwechsel, Rückgängig nach Einfügen) | `reseed` nur bei fremder Version über unverändertem Entwurf; Akteurwechsel wie 090; Schutz des Rückgängig | Test 4; A1, A6; Vor-dem-Bau-Punkt 4 |
| Caret springt nach dem eigenen Speichern | `generation` bleibt bei eigener Version | Test 4; A1 |
| Kürzel kollidiert mit Browser oder AltGr | Vor-dem-Bau-Prüfung, nie mit Alt/AltGr | Vor-dem-Bau-Punkt 2; Test 3 |
| Verborgener Text aus Word wird auf der Bühne sichtbar | Walker überspringt `display:none`, `mso-hide:all`, `visibility:hidden` | Test 2 (g); A2 |
| `text` im Rumpf weicht vom Dokument ab | `text = previewText(input)`; der Kern speichert ohnehin P | Test 5 |
| Bestehende e2e werden still schwächer | Umstellung nur `toHaveValue` → `toHaveText`, Liste der Zeilen in „Files allowed“ | Akzeptanz 2; Review |
| Laufzeit `e2e-http` nähert sich der Grenze | ein schlanker Fall, Messung vorher/nachher, Meldung ab 6:30 | Vor-dem-Bau-Punkt 7; Nachweise |
| Trojan-Source-Zeichen in Proben und Tests | nur Escapes, Suche | Akzeptanz 7 |

## Aufwand

Geschätzt **4,0 AStd** (3,95; Spanne 3,4–4,5; +0,05 für A2b nach Codex P1 auf #156) nach dem Umzug von Word-Listen und einstufigem Rückgängig nach 055c (rund 0,5 AStd).
Die Plan-Notiz in 055 rechnete 3,6 AStd mit Word-Listen; sie kannte die Umstellung von 054/090 und die Folge eines Einfügens
ohne HTML-Senke für das Rückgängig noch nicht.

| Teil | AStd |
|---|---|
| Renderer `AnswerText` und Test 1 | 0,3 |
| Einsatz: Bühne (zwei Stellen), Beantwortung (Versionen, Hinweis „Nur Auszeichnung geändert“), Fokus, Historienblock; Tests 6, 7, 10 | 0,4 |
| Walker, `bodyToDom`, Caret-Abbildung; Test 2 | 0,4 |
| Feld und Werkzeugleiste, `editorCommands` (Kürzel, Allowlist, Einfügen und Ablegen, Neuaufbau, Schutz des Rückgängig); Tests 3, 9 | 0,9 |
| Fokus: Entwurf als Eingabeform, `draftBase`, `isDirty`, `writingOutcome` mit `reseed`, Vorlesezeit, Senden; Tests 4, 8 | 0,4 |
| Beantwortung: Feld, Entwurf, Senden | 0,2 |
| Wiederausgabe und Test 5 | 0,05 |
| i18n (9 Schlüssel je Sprache), Parität, Glossar | 0,1 |
| Semgrep-Regel und Probe | 0,1 |
| e2e A1–A6, A2b und H1, sechs Bilder, axe | 0,55 |
| Umstellung 054/090 (013 nach Bedarf), volle Suite `in-process` | 0,2 |
| Vor-dem-Bau-Prüfungen 2–8 | 0,15 |
| `pnpm gates`, Bericht, CI-Nachweis | 0,2 |

**055c** (Word-Listen ohne `ul`/`ol`, einstufiges Rückgängig eines Einfügens) rund **0,5 AStd**, Klasse mittel. Zusammen
055b + 055c rund **4,5 AStd** statt 3,6.

## Standards (auf Standard gebaut)

| Standard | Was 055b baut | Kosten einer späteren Änderung |
|---|---|---|
| WYSIWYG-Feld (`contenteditable`) ohne Bibliothek | Entscheidung 3, 4 | Textfeld mit Vorschau (B'): rund 0,8 AStd Umbau; Bibliothek: SC-10-Prüfung plus rund 1,5 AStd |
| Kürzel Strg/Cmd+B, I, Umschalt+H, Umschalt+L (Word-nah) | `editorCommands.ts` | anderes Kürzel < 0,1 AStd je Kürzel plus i18n |
| Word-Listen kommen als Absätze ohne Zeichen | Walker überspringt `mso-list:Ignore` | 055c, rund 0,3 AStd |
| Nach einem Einfügen kein verlässliches Rückgängig (nur Schutz) | Entscheidung 5 | einstufiges Rückgängig in 055c, rund 0,2 AStd |
| Unbekannte Kandidaten (`underline`, `heading`) erscheinen im Feld als Text | `bodyToDom` | Anzeige als Hinweis „wird beim Speichern Text“: rund 0,2 AStd |
| Beantwortung beginnt leer | wie heute | Vorbelegen mit der letzten Version: rund 0,2 AStd, ändert 090/010d |
| Historie zeigt die letzte Version | `AnswerBlock` | zusätzlich die freigegebene, wenn verschieden: rund 0,15 AStd |
| Senden immer mit `body` | Entscheidung 7 | — (ein Weg) |
| `lang` nur `de` aus dem Dokument | Renderer, Feld | zweiter Wert additiv mit E21 |
| Hinweis „Nur Auszeichnung geändert“ statt leerem Diff | `AnswerDiff` | Diff der Marken: rund 0,4 AStd |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Formatumfang (E6, Frage 7).** Standard: Absatz, Aufzählung, fett, kursiv, Hervorhebung. Zusatzfrage aus 055: Braucht das
   Haus **nummerierte Listen**? Aus Word kommen sie heute als Aufzählung an, die Nummern fallen weg. Option rund 0,75 AStd
   (Vertrag additiv, Kern, Renderer, Feld).
2. **Editorform und Abhängigkeit.** Standard: eigenes, minimales `contenteditable`-Feld ohne neue Abhängigkeit
   (Entscheidung 3). Option a: Textfeld mit Vorschau (kein `contenteditable`, Auszeichnung nur in der Vorschau sichtbar).
   Option b: eine Bibliothek (Lexical, Tiptap/ProseMirror) mit eigenem Rückgängig; nur nach SC-10-Prüfung (Alter, Lizenz, Größe,
   Pflege) und ausdrücklichem Go, weil eine neue Abhängigkeit dauerhaft gepflegt werden muss.
3. **Kürzel.** Standard: Strg/Cmd+Umschalt+H (Hervorhebung) und Strg/Cmd+Umschalt+L (Aufzählung, wie Word; Words eigenes
   Strg+Alt+H scheidet wegen AltGr aus). Option: Strg/Cmd+Umschalt+8 für die Aufzählung (wie Google Docs). Entscheidung nötig,
   falls Vor-dem-Bau-Punkt 2 eine Kollision findet.
4. **Beantwortung vorbelegen?** Standard: beginnt leer wie heute. Option: mit der letzten Version vorbelegen wie der
   Schreibmodus (rund 0,2 AStd; ändert die Erwartungen in 090 und 010d).
5. **Historie.** Standard: die letzte Version. Option: zusätzlich die freigegebene, wenn sie nicht die letzte ist
   (rund 0,15 AStd).
6. **Teilung und Budget.** Standard: 055b 4,0 AStd, 055c 0,5 AStd (zusammen 4,5 statt 3,6). Go zu Zuschnitt und Budget
   erbeten; 055c ist für die Freigabe-Demo nicht zwingend.
7. **Risikoklasse.** Standard: mittel. Anheben auf hoch kostet einen Lesebefund der Spec vor dem Bau (rund 0,3 AStd).
8. **Rückgängig nach Einfügen.** Standard in 055b: nur Schutz vor einem verfälschten Stand (Entscheidung 5); ein einstufiges
   Rückgängig bringt 055c. Reicht das für die Demo?

## Hinweise an den Orchestrator

- **Plan §5 (paralleler Doku-Durchgang, nicht Teil dieser Spec):** neuer Eintrag **055b** „Antwortformat: Renderer und
  Editor“ — mittel · **4,0 AStd** (3,95; vorher 3,9, +0,05 für A2b nach Codex P1 auf #156; die 055-Notiz sagte 3,6) · nach 055 · Lanes web-components, web-answers, web-focus,
  web-stage, web-history, web-api, e2e, docs, scripts (eine Semgrep-Regel) · Abhängigkeiten 055, 054, takt-043 · Nachweise:
  sechs Screenshots (Editor, Bühne, Historie; de/en), grüner Lauf `e2e-http` · Offene Entscheidung E6. `plan-graph --strict`
  danach prüfen.
- **Neuer Eintrag 055c** „Einfügen aus Word: Listen und Rückgängig“ — mittel · 0,5 AStd · nach 055b · Lanes web-answers, e2e ·
  Ziel: `MsoListParagraph*` und `mso-list`-Ebenen als Listenpunkte (flach), einstufiges Rückgängig eines Einfügens über einen
  eigenen Schnappschuss. Für die Freigabe-Demo nicht zwingend; die Spec schreibt der Orchestrator.
- **Freigabe-Demo-Kette (E57):** 045 → 048 → 053 → 054 → 055 → **055b** → 059 → 046 → 060 → 061 → 041 in Register und §11
  („Stand“-Absätze); 055c außerhalb der Kette.
- **Eintrag 055, Nachweise:** „Screenshots Bühne und Historie mit Format“ wandern zu 055b (wie in 055 vorgeschlagen); die Sperre
  „055 nicht vor 055b in eine geteilte Umgebung“ fällt mit dem Merge von 055b („Stand“-Zeile).
- **§8.6 Punkt 8** („055 Editor auf Klartext mit Absätzen“) meint künftig **055b**.
- **Laufzeit `e2e-http`:** 055b plant ≤ +0:40 (ein Fall). Danach liegt der Schritt bei bis zu rund 6:15. Plan Zeile 781 setzt die
  Schwelle für den Takt „Grenze anheben oder Job teilen“ bei etwa 6:30: **fällig unmittelbar nach 055b, vor 059**, weil 059
  und 060 eigene Fälle im Projekt `http` mitbringen.
- **Abhängigkeiten in §5** (aus 055 übernommen, noch offen): 056, 059, 081 hängen an **055b**; 066 an **055**.
- **Vorbedingungsfrage CSP (Codex P1 auf #156, Security):** Die Web-Seite hat in keiner Auslieferung eine
  Content-Security-Policy (`netlify.toml` nur drei Kopfzeilen; `deploy/docker/nginx.conf:3` „No CSP here: it comes in 037b“;
  kein `<meta>` in `apps/web/index.html`; `default-src 'none'` in `apps/api/src/limits/middleware.ts:25` gilt nur für die
  Dienstantworten). Frage: Soll 055b (mit formatiertem Einfügen) erst nach einer CSP der Web-Seite mit `img-src`, `frame-src`,
  `media-src`, `object-src`, `connect-src` auf `'self'` (037b) in eine geteilte Umgebung, oder genügt bis dahin der Nachweis
  A2b mit verbindlichem Rückfall auf `text/plain`? Standard der Spec: A2b genügt für den Merge; die Auslieferung bleibt ohnehin
  an das Go des Eigentümers gebunden. 055b ändert keine Auslieferungskonfiguration.
- **Glossar:** 055b bringt die Zeilen „Hausformat“, „Hervorhebung“, „Auszeichnung“ selbst mit (Files allowed).
- **Grenze `features` → `@hv/domain`:** 055b lädt Werte nur über `apps/web/src/api/answerFormat.ts`; keine neue Warnung von
  `web-features-i18n-domain-types-only`. Der Bericht nennt die Zahl der Warnungen vorher und nachher.
- **Folgeliste-Kandidaten** (nicht blockierend, Sammelgang): Diff der Marken statt nur Hinweis; Vorbelegen der Beantwortung;
  Anzeige „wird beim Speichern Text“ für nicht darstellbare Kandidaten.

## Hinweise an Folgescheiben

- **055c:** setzt auf `domToBodyInput` auf (die Stelle `mso-list:Ignore` ist schon da) und auf den Neuaufbau nach dem Einfügen
  (Schnappschuss vor dem Neuaufbau).
- **056 (Bühne je Gerät):** `AnswerText` hängt nur an Typen aus `@hv/domain` und `cx`; es lässt sich einzeln bündeln.
- **059 (Rechtsfreigabe-Sicht):** Versionen über `AnswerText`, Hinweis „Nur Auszeichnung geändert“ aus `sameBody`; die
  Zahlenprüfung (E51) arbeitet auf `text`.
- **060 (Entwurfspuffer):** puffert `AnswerBodyInput` und `baseBody`, nie DOM oder HTML; `generation` ist der Weg, das Feld aus
  einem wiederhergestellten Entwurf neu aufzubauen.
- **051/052 (Export, Niederschrift-Anlage):** `renderToStaticMarkup(<AnswerText …/>)` ist möglich (nur React-Elemente, eigene
  Whitelist, `lang`); ob das oder ein Serialisierer auf derselben Whitelist dient, entscheidet 051.
- **049 (Vorgelesen mit `versionHash`):** unverändert über die gespeicherte Nutzlast (055).
- **064/066 (Ingest, KI-Vorschläge):** ein Vorschlag kann über `bodyToDom` ins Feld; er bleibt Eingabeform bis zum Speichern.

## Lesebefunde und Codex-Befunde zur Spec

| Befund | Umsetzung |
|---|---|
| **Codex P1 auf #156 (Security):** Die Spec behauptete, ein `DOMParser`-Dokument lade nichts nach; eingefügtes `text/html` mit `<img src>`, `<iframe src>` u. a. könnte dennoch Abrufe auslösen, und der Marker-Test in A2 sähe das nicht. | Behauptung entfernt; Mechanismus als Erwartung nach HTML-Spezifikation beschrieben (kein Browsing-Kontext, nicht „fully active“), nicht als Tatsache (Entscheidung 5). Verteidigung in der Tiefe: kein fremder Knoten im lebenden Dokument, Walker liest keine URL-Attribute (Test 2 (j)). CSP gelesen: Die Web-Seite hat keine (netlify.toml, nginx.conf, index.html); Vorbedingungsfrage an den Orchestrator, keine Konfigurationsänderung. Pflichttest A2b (echter Browser, Wächter-Host, null Anfragen, Kontrollfall, Ruhezustand an beobachtbaren Ereignissen) und Akzeptanzkriterium 1a. Verbindlicher Rückfall: eine Anfrage → nur `text/plain`, keine andere Umgehung. Bedrohungsmodell T-G1-T-06 und Kopfzeile nachgezogen; Aufwand +0,05 AStd. Sicherheitsbefund, nicht in die Folgeliste. |

## Bericht (nach Bau ausfüllen)

```
Slice: 055b-antwortformat-editor
Done: Renderer AnswerText (eine Komponente für Bühne, Vorschau, Beantwortung, Fokus, Historie), Antwortfeld
      AnswerBodyEditor mit Werkzeugleiste, Kürzeln und Einfügen/Ablegen ohne HTML-Senke (Walker domToBody,
      editorCommands), Entwurf als Eingabeform in Fokus und Beantwortung, Semgrep-Regel no-html-sink.
Evidence: Schluss von `pnpm gates` im Bericht an den Orchestrator (Commit dort genannt), docs/evidence/055b-*.png (6),
      CI-Lauf e2e-http grün (Lauf 37251657065, unten).
Open: Firefox/WebKit nicht geprüft (Folgeliste); CSP der Webseite fehlt (037b, Eigentümerfrage vor geteilter Umgebung).
Touched: siehe Bericht an den Orchestrator.
```

### Vor-dem-Bau-Punkte

1. **Basis:** `794c192` (enthält 055 `4da0165`); `normalizeAnswerBodyForRead`, `answerPlainText`, `answerBodyFromText` über
   `@hv/domain` erreichbar; Paritätstest (f) bei 610 (jetzt 619). Eine Version mit Marke über die Demo geschrieben und
   gelesen: e2e A1 (`focus-latest` zeigt `strong`/`mark` nach dem Speichern).
2. **Kürzel (Chromium 1194 über Playwright):** `preventDefault` auf `keydown` für Strg/Cmd+B, I, U, Umschalt+H, Umschalt+L
   greift (Inhalt unverändert, keine Navigation, kein `beforeinput`). Ohne Abfangen löst Chromium für Strg+B/I/U
   `formatBold`/`formatItalic`/`formatUnderline` aus (abbrechbar); Strg+Umschalt+H/L tun in Chromium nichts. Firefox und
   WebKit sind nicht installiert: **nicht geprüft** (Folgeliste). Quellen der Browser-Kürzel: Chrome-Hilfe „Tastenkombinationen“
   (support.google.com/chrome/answer/157179), Firefox „Tastenkombinationen“ (support.mozilla.org, Strg+Umschalt+H = Chronik),
   Safari-Menü (Cmd+Umschalt+H Startseite, Cmd+Umschalt+L Seitenleiste); nicht live nachgeschlagen.
3. **Befehle auf eigenem Inhalt (Chromium):** `bold`, `italic`, `hiliteColor` (Farbe, dann `transparent`) und
   `insertUnorderedList` schalten auf einem aus `bodyToDom` gebauten Inhalt um und zurück; der Walker liest danach jeweils
   dasselbe Modell wie vorher. Ein teilweises Aufheben der Hervorhebung teilt den `span` sauber. `execCommand` löst **kein**
   `beforeinput` aus. Auffällig: `insertUnorderedList` erzeugt `<p><ul>…</ul></p>` (Walker liest es richtig; Folgeliste).
4. **Rückgängig nach Neuaufbau (Chromium):** Nach einem Neuaufbau durch Skript taten Strg+Z-Schritte in den alten Verlauf
   sichtbar nichts, ein anschließendes Strg+Umschalt+Z erzeugte aber einen Stand, der nie bestand (Text verdoppelt:
   `…EINGEFUEGT</p>Erster Satz.Erster Satz.<p>ZZweiter</p>`), **auch nachdem nach dem Neuaufbau getippt wurde**. Deshalb gilt der
   Schutz aus Entscheidung 5, in einer strengeren Form (Abweichung 1).
5. **Seed `http`:** nach 054 hält Finanzen laut Dateikopf von 054 F2 (eine Frage `answer_drafted` mit Version) und F7 (eine
   Frage `assigned`) Einzelfragen mit `answer.draft` für die gebundene Fachkraft; H1 nimmt die erste in `answer_drafted`
   oder `assigned`.
6. **Tabulatorweg 013:** `013-tastaturpfad.spec.ts:400` grün mit 15 (Werkzeugleiste ein Halt); keine Änderung an 013.
7. **Laufzeit `e2e-http`:** letzte drei grüne Läufe mit ausgeführtem Schritt: 37240940303 4:09, 37239067336 5:35,
   37239065778 5:33. Höchstwert plus Schätzung 0:40 = 6:15 < 6:30; keine Meldung nötig, aber knapp (Takt „Grenze anheben
   oder Job teilen“ vor 059).
7a. **CSP:** weiterhin keine CSP der Web-Seite (`netlify.toml` ohne, `deploy/docker/nginx.conf:3` „No CSP here: it comes in
   037b“, `apps/web/index.html` ohne `<meta>`); keine Änderung.
8. **Kontrast:** `<mark>` `#8a5a08` auf `#fdf3e4` = 5,39:1 (eigener Vorder- und Hintergrund, daher auch in `.stage-contrast`);
   axe auf Bühne (Kontrastmodus), Historie und Schreibmodus ohne serious/critical.

### Ergebnisse

- **A2b grün** (Akzeptanzkriterium 1a): null Anfragen an `sentinel-055b.invalid` bei `paste` und `drop` und nach dem Speichern
  und Rendern; der Kontrollfall (ein `img` mit Wächter-URL im lebenden Dokument) zählt genau eine. Auch mit
  `--repeat-each=3` (dreimal 0/1). Kein Rückfall auf `text/plain` nötig.
- **D9:** Walker über 20 000 Zeichen (100 Absätze mit Marken): Median 0,2–0,3 ms, Höchstwert 0,7–1,5 ms (A1).
- **Semgrep `no-html-sink`:** Probe mit `el.innerHTML = x`, `outerHTML +=`, `srcdoc`, `insertAdjacentHTML`, `document.write`,
  `createContextualFragment`, `execCommand('insertHTML')` meldet sieben Treffer (Exit 1), `execCommand('bold')` und
  `textContent` keinen; Wegwerfdatei gelöscht; `apps/web/src` und alle neuen Dateien: 0 Treffer.
- **Grenze `features` → `@hv/domain`:** 14 Warnungen vorher, 14 nachher (Werte nur über `apps/web/src/api/answerFormat.ts`).

### Abweichungen und offene Punkte

1. **Schutz des Rückgängig strenger als „bis zur nächsten getippten Eingabe“.** Vor-dem-Bau-Punkt 4 zeigte die Verfälschung
   auch nach Tippen. `UndoBudget` (`editorCommands.ts`) lässt Rückgängig und Wiederholen nur innerhalb der seit dem letzten
   Neuaufbau gemachten Schritte zu (von unten gezählt: ein Schritt je Tipp-Lauf, einer je Formatbefehl auf einer Auswahl);
   ein Rückgängig über den Neuaufbau hinaus wird verhindert. Kein Verlust; das Einfügen selbst bleibt nicht rückgängig
   (055c). Ein Neuaufbau ist auch das erste Aufbauen des Felds beim Öffnen.
2. **`initial` hat den Typ `AnswerBodyInput | null`** statt `AnswerBody | null`: der Schreibmodus baut ein ungespeichertes
   Feld nach dem Zurückkehren („Entwurf fortsetzen“) aus der Eingabeform des Entwurfs auf; die Speicherform ist darin
   enthalten.
3. **`010d-ansichtsdaten.spec.ts:885` und `:1052`** prüften `answer-editor` mit `toHaveValue`, das Playwright für ein
   `contenteditable`-Feld nicht kennt („Not an input element“). Zunächst gemeldet; nach Go des Orchestrators (Nachtrag in
   „Files allowed“, 05.10.2026) nur diese zwei Prüfungen auf `toHaveText` umgestellt, wie in 054; sonst nichts an 010d.
4. **Farbe des Platzhalters:** Der Platzhalter des Felds ist ein echter `<span>` und wird von axe gemessen; `ink-400` (2,48:1) fiel durch (003, 013h, 020, 090), daher `ink-600`.
5. Firefox/WebKit nicht geprüft (Punkt 2 und 4), Folgeliste.

055 und 055b sind zusammen auslieferbar; Ausrollen nur nach Go des Eigentümers.

### Design-Kritik D1–D10

| D | erfüllt | Satz |
|---|---|---|
| D1 | ja | Vier Symbole mit Namen als Tooltip und `aria-label`, gedrückt über Tönung und dickeren Strich; Hinweis Z6 in einem Satz neben der Leiste. |
| D2 | ja | Keine neue primäre Aktion; „Entwurf speichern“ bleibt die eine primäre im Schreibmodus mit Änderung (Test 8, A1). |
| D3 | ja | Leiste mit 32-px-Knöpfen bündig über dem Feld; Blockabstände in em, Bühne und Fokus gleich gegliedert. |
| D4 | ja | Farbe nur für die Hervorhebung (vorhandenes Token, 5,39:1); gedrückte Knöpfe über Tönung und Strichstärke. |
| D5 | ja | Versionsnummer im Historienblock als Mono-Badge wie in der Beantwortung. |
| D6 | ja | Leeres Feld mit Platzhalter; ohne Version kein Historienblock; ohne `body` Rückfall auf Text; 422 über die Schreibtür. |
| D7 | ja | 9 Schlüssel je Sprache, Hausvokabular, kein „Editor“ in Texten (`pnpm vocabulary`, `pnpm i18n-literals`). |
| D8 | ja | Kürzel, ein Tabulatorhalt mit Pfeilen/Pos1/Ende, Strg+Enter und Escape wie 054; Übergaben unverändert nach takt-043. |
| D9 | ja | Walker unter 2 ms bei 20 000 Zeichen. |
| D10 | ja | Vier Knöpfe, ein Satz Hinweis, keine Menüs, keine Farb- oder Schriftwahl. |

### Nachweise (Review-Nacharbeit, 05.10.2026)

**Commits:** `f2dcb06` (Bau), `27b5566` (Nachtrag 010d), `c0ccbc7` (Review-Befunde 1–6 und 8), danach dieser Doku-Commit.

**`pnpm gates` auf `c0ccbc7` (Schluss, wörtlich):**

```
slice-scope: warning — "docs/slices/055b-antwortformat-editor.md"'s "Files allowed" section differs from its version at the merge-base (794c192) with origin/claude/dax-shareholder-meeting-workflow-0s934z.
slice-scope: 51 changed file(s), all within "docs/slices/055b-antwortformat-editor.md"'s "Files allowed" list (85 pattern(s)).
...
# pass 318
# fail 0
...
✓ built in 2.83s
mark-test-run: wrote /home/user/wt/s055b/.claude/state/last-test-run (clean tree) at commit c0ccbc7, tree 2d501c4f2345…
gates exit=0
```

(Die Warnung von `slice-scope` stammt vom Nachtrag des Orchestrators in „Files allowed“.)

**e2e:** 055b mit `--repeat-each=3`: 18 passed, 3 skipped (H1 nur `http`); A2b dreimal „0; control: 1“ mit der erweiterten
Wächterprobe (`<script src>`, `<link rel=prefetch|modulepreload|icon>`, `<img loading=lazy>`, `@font-face src`). Volle Suite
`in-process` auf `c0ccbc7`: 163 passed, 0 failed, 1 skipped (H1).

**CI `e2e-http` (Orchestrator, 05.10.2026):** PR #157, Commit e25adda (Code-Stand c0ccbc7), Lauf 37251657065, Job 111580365445, grün:

```
✓  62 [http] › e2e/055b-antwortformat.spec.ts:687:3 › 055b http › H1 formatierte Version über den Dienst, nach dem Neuladen gleich (2.5s)
57 passed (3.5m)
```

Schritt „End-to-end http project …“ 01:30:51 bis 01:34:57, rund 4:06 gegen Limit 9:00 und Harness-Grenze 8:00. Artefakt
`evidence-031-http` (ID 11321147001, `sha256:86f433cad5ae653fdca4f6c2b43664dc3f421b47582a3326bb21bbd73683aada`). Vorher grün
auch auf 27b5566 (Lauf 37249410736, H1 3.9s, Schritt rund 5:45).

**Rot vor der Änderung:**

- Bau, Einheit (vor der Umsetzung): 28 Fälle in 12 Dateien rot — `answerFormat.test.ts`, `AnswerText.test.tsx`,
  `AnswerBodyEditor.test.tsx`, `domToBody.test.ts`, `editorCommands.test.ts`, `focus.test.ts`, `AnswerBlock.test.tsx` (Modul
  fehlt), dazu Test 6/7 in `QuestionDetail.test.tsx`, Test 6 in `FocusDetail.test.tsx`, Test 8 in `WritingMode.test.tsx` (zehn
  Fälle), Test 6/10 in `Podium.test.tsx` (vier), Parität (f) „expected 610 to be 619“.
- Bau, e2e (Quelltext zurückgestellt): `6 failed, 1 skipped` — A1 `toHaveCount`, A2 `toContainText`, A2b „Timeout 5000ms
  exceeded while waiting on the predicate“, A3 „Failed to fetch dynamically imported module …/domToBody.ts“, A4/A5
  `toHaveCount`, A6 `toHaveText`.
- Review-Befund 1 (alter Stand `27b5566`, Wiedergabe): Feld „Alt⟨S⟩teil⟨S⟩“, Caret am Ende, Einfügen „NEU“ →
  `{"text":"Alt"},{"text":"NEU"},{"text":"teil⟨S⟩"}` statt „AltteilNEU“ (⟨S⟩ = U+E055 U+E05B, unsichtbar).
- Review-Befund 5 (`AnswerEditor.tsx` zurückgestellt): `× with a draft: no placeholder, saving open …` — `Tests 1 failed | 12 passed (13)`.

**Semgrep-Probe (Wegwerfdatei `apps/web/src/zz/probe-sink.ts`, danach gelöscht), Exit 1, 18 Treffer:**

```
   ❯❯❱ scripts.semgrep.no-html-sink
            2┆ el.innerHTML = x;
            3┆ el['innerHTML'] = x;
            4┆ el.outerHTML += x;
            5┆ (el as HTMLIFrameElement).srcdoc = x;
            6┆ Object.assign(el, { id: 'a', innerHTML: x });
            7┆ el.insertAdjacentHTML('beforeend', x);
            8┆ document.write(x);
            9┆ w.document.writeln(x);
           10┆ d.write(x);
           11┆ d.createRange().createContextualFragment(x);
   ❯❯❱ scripts.semgrep.exec-command-only-in-editor-commands
           12┆ d.execCommand('insertHTML', false, x);
   ❯❯❱ scripts.semgrep.no-html-sink
           12┆ d.execCommand('insertHTML', false, x);
           13┆ (el as unknown as { setHTMLUnsafe(h: string): void }).setHTMLUnsafe(x);
           14┆ (Document as unknown as { parseHTMLUnsafe(h: string): Document }).parseHTMLUnsafe(x);
           15┆ d.importNode(el, true);
           16┆ d.adoptNode(el);
   ❯❯❱ scripts.semgrep.exec-command-only-in-editor-commands
           17┆ d.execCommand('bold');
   ❯❯❱ scripts.semgrep.dom-parser-only-in-walker
           18┆ new DOMParser().parseFromString(x, 'text/html');
 • Findings: 18 (18 blocking)
```

`el.textContent = x` (Zeile 19) meldet keine Regel. Über alle `.ts`/`.tsx` unter `apps/web/src`: „Ran 7 rules on 174 files: 0
findings.“ (Exit 0).

**Akzeptanzkriterium 7 (Suche nach rohen Steuer-, Format-, unsichtbaren und Private-Use-Zeichen):**

```
$ FILES=$(git diff --name-only 794c192 HEAD | grep -v '\.png$'); LC_ALL=C.UTF-8 grep -nP '[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}-\x{009F}\x{00A0}\x{00AD}\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2066}-\x{2069}\x{FEFF}\x{E000}-\x{F8FF}]' $FILES; echo "exit=$? files=$(echo "$FILES" | wc -l)"
exit=1 files=45
```

Kein Treffer (Exit 1 von `grep` = nichts gefunden) über alle 45 berührten Textdateien.

**Berührte Dateien (gegen `794c192`):**

- `apps/web/e2e/010d-ansichtsdaten.spec.ts`
- `apps/web/e2e/054-fokusansicht.spec.ts`
- `apps/web/e2e/055b-antwortformat.spec.ts`
- `apps/web/e2e/090-eingaben-je-akteur.spec.ts`
- `apps/web/e2e/support/e2e-texts.ts`
- `apps/web/e2e/support/word-sample-055b.ts`
- `apps/web/playwright.config.ts`
- `apps/web/src/api/answerFormat.test.ts`
- `apps/web/src/api/answerFormat.ts`
- `apps/web/src/components/AnswerText.test.tsx`
- `apps/web/src/components/AnswerText.tsx`
- `apps/web/src/components/index.ts`
- `apps/web/src/features/answers/AnswerBodyEditor.test.tsx`
- `apps/web/src/features/answers/AnswerBodyEditor.tsx`
- `apps/web/src/features/answers/AnswerEditor.tsx`
- `apps/web/src/features/answers/Page.tsx`
- `apps/web/src/features/answers/QuestionDetail.test.tsx`
- `apps/web/src/features/answers/QuestionDetail.tsx`
- `apps/web/src/features/answers/domToBody.test.ts`
- `apps/web/src/features/answers/domToBody.ts`
- `apps/web/src/features/answers/editorCommands.test.ts`
- `apps/web/src/features/answers/editorCommands.ts`
- `apps/web/src/features/focus/FocusDetail.test.tsx`
- `apps/web/src/features/focus/FocusDetail.tsx`
- `apps/web/src/features/focus/Page.tsx`
- `apps/web/src/features/focus/WritingMode.test.tsx`
- `apps/web/src/features/focus/WritingMode.tsx`
- `apps/web/src/features/focus/focus.test.ts`
- `apps/web/src/features/focus/focus.ts`
- `apps/web/src/features/history/AnswerBlock.test.tsx`
- `apps/web/src/features/history/AnswerBlock.tsx`
- `apps/web/src/features/history/Page.tsx`
- `apps/web/src/features/stage/Podium.test.tsx`
- `apps/web/src/features/stage/Podium.tsx`
- `apps/web/src/i18n/answers.de.ts`
- `apps/web/src/i18n/answers.en.ts`
- `apps/web/src/i18n/history.de.ts`
- `apps/web/src/i18n/history.en.ts`
- `apps/web/src/i18n/parity.test.ts`
- `docs/evidence/055b-buehne-de.png`
- `docs/evidence/055b-buehne-en.png`
- `docs/evidence/055b-editor-de.png`
- `docs/evidence/055b-editor-en.png`
- `docs/evidence/055b-historie-de.png`
- `docs/evidence/055b-historie-en.png`
- `docs/folgeliste.md`
- `docs/glossar.md`
- `docs/sicherheit/bedrohungsmodell.md`
- `docs/slices/055b-antwortformat-editor.md`
- `scripts/e2e-http-031.test.mjs`
- `scripts/semgrep/rules.yml`

## Review findings

Review nach dem Bau (frischer Kontext, Security, UX/Barrierefreiheit, Recht/Freigabe; 05.10.2026): kein Blocker, kein Major.
In der Scheibe behoben (`c0ccbc7`): 1 (Security/Integrität: Caret des Einfügens über den eingefügten Knoten statt Textsuche,
Wächterzeichen U+E055/U+E05B werden nicht mehr gesucht und, nach Codex P2 auf #157 (`1e0ee7c`), auch nicht mehr entfernt, weil der Kern Zeichen aus dem Privatbereich zulässt; Einheitstest der Wiedergabe), 2 (Security: Wächterprobe
A2b um `<script src>`, `<link rel=prefetch|modulepreload|icon>`, `<img loading=lazy>`, `@font-face` erweitert, A2b grün),
3 (Security: Semgrep `no-html-sink` erweitert, pfadgebundene Regeln für `execCommand` und `DOMParser`, Bedrohungsmodell
angeglichen), 4 (Nachweise oben), 5 (Security/Daten: Feld der Beantwortung aus dem Entwurf gebaut; Test), 6 (D1: Vordergrund
der Hervorhebung im Feld wie auf der Bühne), 8 (HTML ohne Text fällt auf `text/plain` zurück; Test). In die Folgeliste:
Minor 7 (e2e für den Schutz des Rückgängig), Nits 9–11.

**Codex auf #157 (Orchestrator, 05.10.2026):** P2 — das Entfernen von U+E055/U+E05B beim Einfügen hätte zulässige Zeichen
aus gespeicherten (auch freigegebenen) Fassungen gelöscht. Behoben in `1e0ee7c`: Caret nur über die Identität des eigenen leeren
Knotens, keine Zeichen werden entfernt; Tests (a) bis (c) in `domToBody.test.ts`, vorher (a) und (b) rot.
