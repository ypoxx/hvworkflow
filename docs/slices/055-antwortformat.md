# Scheibe 055 — Antwortformat: Normalisierung im Kern, Editor, einheitlicher Renderer

**Status:** angenommen (gemergt `4da0165`, PR #152; Spec als #151 `ea3eb9a`). Spec-Stand 04.10.2026; gelesen auf `cc97005`, Integration mit 053 und 054, Vertrag 0.4.3). Fünfte Scheibe der
Oberflächenkette der Freigabe-Demo 045 → 048 → 053 → 054 → 055 → 059 → 046 → 060 → 061 → 041 (Register E57). **Geteilt**
(Abschnitt „Teilung und Zuschnitt“): **diese Spec baut Teil a** (Vertrag, Kern, Dienst: Blockdokument, Normalisierung,
Klartextprojektion, Lesbarkeit alter Versionen) auf dem Branch `claude/slice-055-antwortformat`; **Teil b** (Renderer und
Editor in der Oberfläche) folgt als **055b** mit eigener Spec `docs/slices/055b-antwortformat-editor.md`, die der Orchestrator
aus dem Abschnitt „055b — Entwurf“ unten schreibt. Auf Standard gebaut (E6 Whitelist; E21 nur `de`); keine Eigentümerfrage
blockiert. Klasse hoch: Lesebefund der Spec vor dem Bau auf `0a8d5c1` erledigt (Urteil „erst nachbessern“), eingearbeitet am
04.10.2026, Abschnitt „Lesebefunde und Umsetzung“.
**Risikoklasse:** hoch · 3,1 AStd (Spanne 2,7–3,6; Plan 055: mittel · 3 AStd für alle drei Teile; 055b dazu 3,6 AStd, Klasse
mittel; Begründung in „Warum hoch“ und „Aufwand“) · Plan 055: 18.11.2026 (W8), tatsächlich direkt nach 054 als fünfte
Oberflächenscheibe der Freigabe-Demo · Lanes: contract (erster Commit, Architekt); core; service (Tests und die Begrenzung der Validator-Meldung); web-api (nur
Typzwang in `http.ts`); docs-sicherheit (eine Zeile); docs-adr (ein Absatz in ADR 0005, Architekt). **Keine** Änderung an
`apps/web/src/features/**`, `apps/web/src/components/**` oder an e2e-Dateien.
**Bedrohungsmodell:** berührt T-G1-T-06 (Skripteinschleusung über Antworttext; ab 055 formatierte Antworten mit „Einfügen
aus Word“). Teil a schließt die Hälfte im Kern: **Neue** `AnswerDrafted`-Ereignisse tragen nur noch die geschlossene
Speicherform (zwei Blockarten, drei Marken, reiner Text in Textläufen) und in `text` wie im Dokument keine Steuer- oder
Formatzeichen (`\p{Cc}`, `\p{Cf}`, Entscheidung 2 und 2a). **Alte** Ereignisse bleiben, wie sie sind (R7); ihr hergeleitetes
Dokument läuft beim Lesen durch die Whitelist, ihr `text` nicht. Die andere Hälfte (Renderer
ohne `innerHTML`, Einfügen über einen inerten Parser) schließt 055b. Keine neue Operation, kein neues Recht, kein neuer
Leserkreis.
**Rolle:** architect für den Vertragsschritt (erster Commit, vor jedem Code, AGENTS.md R6) und den Absatz in ADR 0005; danach
implementierer-backend. Review in frischem Kontext mit den Perspektiven **Vertrag/Architektur** (Eingabe- und Speicherform,
additive 0.4.x-Stufe, Validator und Kern im Gleichlauf, Lesbarkeit alter Ereignisse), **Security** (Whitelist, Steuer- und
Bidi-Zeichen, keine offene Zeichenkette im Protokoll) und **Recht/Freigabe** (eine Formatänderung ist eine neue Version und
hebt die Freigabe auf, R-GUARD-04). Lesebefund der Spec vor dem Bau (Klasse hoch, Leitplanken §4); nie gebündelt. Modell nur
in `.claude/agents/` (takt-012)
**Rule ids:** keine neue Übergangszeile, kein neuer Guard, kein neues Recht (Wahrheitstabellen-Diff: **keiner**). Bedient und
belegt: R-TRANS-03 (Antwortversion anlegen; jetzt mit Blockdokument), R-GUARD-03 (nur Textpfade, unverändert), R-GUARD-04
(Freigabe an die Version gebunden; eine Formatänderung allein ist eine neue Version), R-IDEM-01 (Wiederholung mit demselben
Schlüssel liefert das erste Ergebnis), R-PERM-01..03 (unverändert). Die Normalisierungsregeln heißen **ADR-0005-N1 … N10**,
die Projektion **ADR-0005-P**, die Herleitung alter Versionen **ADR-0005-L**; sie sind Regeln des Kerns aus ADR 0005, keine
Einträge im Regelregister (`rules.ts` kennt nur Übergang, Guard, Recht, Idempotenz; Hinweise an den Orchestrator). Dazu
AGENTS.md R2, R3, R6, R7, R8, R11, R12
**Quellen-IDs:** `docs/produktplan-beta.md` §5 Eintrag 055 (Zeile 787–793), ADR-Tabelle Zeile 242, Feedback-Umbauten Zeile 267
(#27/#30/#31 → 055), Zielbild-Zeile 277 (Z6 → 055), §8.6 Streichliste Punkt 8 (Zeile 1226), Register E6 (Zeile 1271), E21
(Zeile 1287), E57; ADR 0005 (ganz), ADR 0001 (Grenze 1: keine Geschäftsregel in der Oberfläche), ADR 0009 (Personendaten nur in
`pii`), ADR 0011 (Umschlag v2), ADR 0015 (Vertragsversionierung); `docs/feedback/2026-09-zielbild-oberflaeche.md` Z6 (Zeile
49); `docs/feedback/2026-09-quickview-projektleitung.md` #27, #30, #31 (Zeile 83, 86, 87), Frage 7 (Zeile 149); Spec 043a
(Teilungstabelle Zeile 043b; Vertragszeile `AnswerDraft.body` → 055, Zeile 114); Spec 048 (Inhaltssprache → 055, Zeile 55,
679–682, 731); Spec 054 („Hinweise an Folgescheiben: 055“, Lehre `armFocus`/`settleFocus`, Laufzeit `e2e-http`);
`docs/sicherheit/bedrohungsmodell.md` T-G1-T-06 (Zeile 208); `docs/rollen-und-rechtekonzept.md:163` (Bindung der Freigabe an
die Textversion)
**Depends on:** 054 (gemergt `cc97005`, PR #149), 048 (gemergt `7405efb`, Vertrag 0.4.3), 044b (Muster Kernprüfung im
Gleichlauf mit dem Validator, Längen in Code-Punkten). **Nicht** 043b: Dieser Vertragsteil ist nie geschrieben worden (Befund
048); 055 bringt seinen Vertragsschritt selbst mit, wie 048 (Planabweichung, Hinweise an den Orchestrator)
**Perspektive:** Vertrag/Architektur, Security, Recht/Freigabe · **Glossar: neue Begriffe:** nein (Teil a hat keinen
sichtbaren Text; „Hervorhebung“ und „Hausformat“ bringt 055b)

## Warum hoch

Der Plan führt 055 als „mittel“. Diese Spec stuft **hoch** ein (Hochstufung, kein Fall für `downgrade-check`), aus drei
Gründen nach Leitplanken §4:

- **Vertrag und Ereignisform im Kern.** Neue Schemas, zwei neue optionale Felder (`AnswerDraft.body`, `AnswerVersion.body`)
  und ein neues Feld in der Nutzlast von `AnswerDrafted`. Ereignisse sind unveränderlich (R7): Was einmal im Protokoll steht,
  muss jede spätere Fassung des Kerns lesen können. Eine Fehlentscheidung zur Speicherform ist nach dem ersten Ereignis nicht
  mehr zurückzunehmen, nur noch zu überlesen.
- **Freigabe.** Die Freigabe ist an die Antwortversion gebunden (R-GUARD-04, Rechtekonzept Abschnitt 4: „Jede Textänderung
  nach Freigabe setzt sie zurück“). Ob eine reine Formatänderung eine neue Version ist, entscheidet, was das Podium vorliest
  und was die Freigabe deckt. Freigabe ist ein Hoch-Auslöser.
- **Sicherheit.** Teil a ist die Stelle, an der beliebige Struktur aus der Zwischenablage (Word, Browser) zur Speicherform
  wird. Bleibt dort eine offene Zeichenkette (Blockart, Marke) stehen, erreicht sie Bühne, Historie und Export (T-G1-T-06).

Mittel wäre es nur, wenn das Format allein in der Oberfläche lebte; das verwirft ADR 0005 („Normalisierung in der Domäne …
nicht im Editor“). Hält der Review die Einstufung für überzogen, entscheidet der Eigentümer (Eigentümerfrage 6); ein Agent
stuft nie herab.

## Befund (Ist-Stand, gelesen auf `cc97005`)

- **Vertrag 0.4.3**, `AnswerVersion` (`openapi.yaml:3158-3215`): `required: [version, text, createdAt, createdBy]`, dazu
  `sources`, `answerKind` und die drei `refusal*`-Felder. **Kein `body`, kein `language`.** Die in 043a vorgesehene
  Vertragsform „Blockdokument plus `text`“ (ADR 0005 „Nachweis“, Spec 043a Zeile 56 und 114) ist nie geschrieben worden; 043b
  existiert nicht.
- **`AnswerDraft`** (`openapi.yaml:3366-3371`): `required: [text]`, `text` 1..20000, `sources` ≤ 50 × ≤ 2000. **Nicht
  geschlossen** (kein `additionalProperties: false`): ein heute mitgesendetes `body` passiert den Validator, der Kern liest es
  nicht (`api.ts:1404-1420` schreibt nur `text` und `sources`). Ein Feld `body` dort hinzuzufügen, ist additiv.
- **Validator** (`apps/api/src/contractSchema.ts:25`): `Ajv2020({ strict: false, allErrors: true })`, ohne `useDefaults`,
  ohne `removeAdditional`, ohne Typumwandlung; `maxLength` zählt Code-Punkte. Die Route `draftAnswer` (`app.ts:1178-1182`)
  reicht den geprüften Rumpf unverändert an `domain.draftAnswer` weiter: **keine Routenänderung nötig**.
- **Körpergrenze** des Dienstes 256 KiB (`apps/api/src/limits/config.ts:14`, 413).
- **Kern.** `AnswerVersion` (`types.ts:277-292`) und `AnswerDraft` (`types.ts:411-414`) ohne Format. `draftAnswer`
  (`api.ts:1404`) trimmt `text`, schreibt `AnswerDrafted { answer: { version, text, createdAt, createdBy, sources? },
  invalidatedApprovalOfVersion? }`. `proposeRefusal` (`api.ts:1517`) schreibt ebenfalls `AnswerDrafted`, mit Klartext.
  `submitForReview` und `forwardQuestion` tragen **keinen Text** (nur `answerVersion` bzw. `unitId`/`reasonCode`).
- **Projektion** (`state.ts:424-445`): `q.answers.push({ ...answer, ... })` aus der Nutzlast; jede neue Version löscht
  Freigabe, Rechtsfreigabe, Freigebende und Rückgabegrund (R-GUARD-04).
- **Suche** `q` (`api.ts:826-834`) durchsucht `q.answers.map((a) => a.text)`: bleibt auf der Klartextprojektion.
- **`EventRead`** (`openapi.yaml:3595-3690`): `payload.answer` ist offen (`additionalProperties: true`) mit Verboten für
  `createdBy.personId`, `createdBy.displayName`, `refusalJustification`. Bindungen je Ereignisart über `if/then` (Muster 048).
- **Personendaten.** Antworttext ist Inhalt, nicht `pii` (ADR 0009: nur `pii` trägt Personendaten; `text` stand nie dort).
  `body` ist derselbe Inhalt in anderer Form und folgt `text`.
- **Oberfläche (nur zur Einordnung, nicht Teil a).** Antworttexte stehen als Textknoten mit `whitespace-pre-wrap` in
  `QuestionDetail.tsx:228`, `FocusDetail.tsx:181`, auf der Bühne in `Podium.tsx:383, 486` (`<p data-testid="stage-answer">`).
  Die **Historie zeigt heute keinen Antworttext** (`eventSummary.ts:110-125` nennt Version, Verweigerungsart und Quellen).
  **Export gibt es noch nicht** (043d, 051, 052). Der Diff „Änderung gegenüber Version n-1“ läuft schon auf `text`
  (`answers/lib.ts:165` `wordDiff`). Schreiben: `WritingMode.tsx` (054) und `AnswerEditor.tsx`, beide `<textarea>`.
  `features/**` darf aus `@hv/domain` nur Typen laden (`scripts/dependency-cruiser.cjs:53-63`, Stufe „warn“); Werte nur über
  `apps/web/src/api/**`.
- **Abhängigkeiten.** Keine Bibliothek für Rich-Text im Repository; keine für eigenschaftsbasierte Tests (`fast-check` fehlt).
- **Laufzeit `e2e-http`** (054 Bericht): Schritt „End-to-end http project …“ zuletzt **4:45** (Lauf 37225467013), davor
  **5:30** (Lauf 37223187826); Harness-Grenze 8:00 (`TOTAL_MS`), Schritt `timeout-minutes: 9`. Teil a fügt keine e2e-Datei hinzu.

## Teilung und Zuschnitt

Die Planzeile bündelt Vertrag, Kern, Editor, Renderer und Nachweise. Zuschnitt:

| Punkt der Planzeile | In 055 (Teil a) | In 055b | Grund |
|---|---|---|---|
| `AnswerVersion.body` als Blockdokument plus `text` | **ja**, Vertrag und Kern | — | Vertrag zuerst (R6) |
| Normalisierung in der Domäne (Whitelist, leere Blöcke zusammenführen, idempotent) | **ja**, N1–N10 | — | Regel des Kerns (ADR 0005, ADR 0001 Grenze 1) |
| Normalisierung „beim Speichern und Weiterleiten“ | **ja**: jede Schreiboperation, die Antwortinhalt trägt, normalisiert; Weiterleiten trägt keinen Inhalt (Entscheidung 6) | Weiterleiten mit ungespeichertem Text bleibt ausgeblendet (054) | #31 meint das Hausformat; die Speicherform kennt keine Schrift |
| Klartextprojektion für Suche und Diff | **ja**, P | Diff-Hinweis „nur Auszeichnung geändert“ | — |
| Alte Versionen lesbar | **ja**, L | — | R7 |
| Reserviertes Feld `language` (E21) | **ja**, nur `de`, im Blockdokument (Entscheidung 8) | `lang`-Attribut im Renderer | einziger Abnehmer ist der Renderer; kein totes Feld |
| Editor mit Tastenkürzeln, Einfügen aus Word | nein | **ja** | Oberfläche |
| Renderer für Bühne, Historie, Export | nein | **ja** für Bühne, Historie, Beantwortung, Fokus; Export ist 051/052 | Oberfläche; Export existiert noch nicht |
| Nachweise ADR 0005: „verbotene Marke wird entfernt“, Idempotenz | **ja** (Kern, Dienst) | — | — |
| Nachweise ADR 0005: Screenshots Bühne und Historie mit Format | nein | **ja** | brauchen Renderer und Editor |

**Teilungsentscheidung: zwei Scheiben.** Zusammen rund 6,7 AStd (Teil a 3,1, Teil b 3,6) statt 3 laut Plan, und die Planzeile
mischt einen Hochrisiko-Kern (Vertrag, Ereignisform, Freigabebindung) mit einer Oberflächenscheibe. Getrennt bekommt der Kern
seinen Lesebefund und ein Review mit Vertrags- und Freigabeblick, die Oberfläche ein Review mit UX- und Sicherheitsblick
(Einfügen). Die Reihenfolge ist zwingend: 055b sendet `body` erst, wenn der Vertrag es kennt (R6).

**Warum der Renderer nicht in Teil a.** Ohne Editor gibt es kein formatiertes Ereignis, das der Renderer zeigen könnte, außer
über einen geänderten Seed (`seed.ts`, synthetischer Korpus mit Fingerabdrucktest). Den Seed für einen Screenshot zu ändern,
wäre Überbau; im 055b-e2e entsteht die formatierte Antwort über den Editor und erscheint danach auf Bühne und in der Historie.
Das ist der echte Weg und der Plan-Nachweis zugleich.

**Rückfall für 055b** (Plan §8.6, Punkt 8): „Editor auf Klartext mit Absätzen (Normalisierung und Renderer bleiben)“. Teil a
bleibt in jedem Fall vollständig; im Rückfall sendet 055b einen Body aus Absätzen ohne Marken.

## Ziel und Entscheidungen vor Bau

Eine Antwortversion trägt neben dem Klartext ein kleines Blockdokument im Hausformat: Absätze und eine Aufzählung, darin fett,
kursiv und Hervorhebung, sonst nichts. Der Kern macht aus jeder Eingabe, auch aus dem, was Word in die Zwischenablage legt, genau
diese Form, immer gleich und beliebig oft ohne weitere Änderung; der Klartext ist daraus abgeleitet und trägt Suche, Diff und
Vorlesezeit. Versionen von vor 055 bleiben lesbar und bekommen beim Lesen ein Blockdokument aus ihrem Text. Eine Version, die
sich nur in der Auszeichnung unterscheidet, ist eine neue Version. Kein Code der Oberfläche wird geändert.

Alle Punkte sind **auf Standard gebaut**, wo nicht anders gesagt; ein späterer Wechsel kostet die genannten Beträge.

### 1. Zwei Formen: Eingabe offen, Speicherform geschlossen (Vertrag und `packages/domain/src/answerFormat.ts`)

ADR 0005 verlangt zweierlei: „Der Markensatz ist ein Enum im Vertrag“ und „Normalisierung in der Domäne … nicht im Editor;
eine unbekannte Marke wird Klartext, nichts geht verloren“. Beides zugleich geht nur mit zwei Formen:

- **Eingabeform `AnswerBodyInput`** (nur in `AnswerDraft.body`): Blockart und Marke sind **begrenzte Zeichenketten**, nicht
  Enums. Der Editor (055b) bildet, was er im DOM findet, auf Kandidaten ab (`u` → `underline`, `h2` → `heading`, `ol` →
  `list`) und wendet die Whitelist **nicht** an. Der Validator prüft nur Gestalt und Größen.
- **Speicherform `AnswerBody`** (in `AnswerVersion.body`, im Ereignis, in `EventRead`): geschlossen. Blockarten `paragraph`,
  `list`; Marken `bold`, `italic`, `highlight` als Enum `AnswerMark`; `language` als Enum `[de]`.

So verhält sich der Kern in beiden Betriebsarten gleich (die Demo prüft nicht gegen den Vertrag, 034a): „verbotene Marke wird
entfernt“ gilt im Projekt `in-process` und über HTTP. Die offene Eingabe erreicht das Protokoll nie (Test 3, H4).

Verworfen: geschlossene Enums schon in der Eingabe. Dann müsste der Editor die Whitelist anwenden (Geschäftsregel in der
Oberfläche, ADR 0001), und eine unbekannte Marke wäre über HTTP ein 422 statt Klartext — gegen ADR 0005.

### 2. Normalisierung: Schreibvariante und Lesevariante (rein, ohne Uhr, ohne I/O)

Zwei Funktionen mit denselben Regeln, aber verschiedenem Vertrag (Lesebefund M2):

- **Schreibvariante** `normalizeAnswerBodyForWrite(input): AnswerBody` — für `draftAnswer`. Gestaltprüfung
  (`checkAnswerBodyInput`), dann N1–N10; darf **422** werfen (Gestalt, einsames Ersatzzeichen, N8, N9, kein Text übrig).
- **Lesevariante** `normalizeAnswerBodyForRead(stored: unknown): AnswerBody | null` — für die Projektion. Nur N1–N7 (ohne
  Gestaltprüfung im Sinne von 422, ohne N8 und N9), **wirft nie**: Unbrauchbares (kein Objekt, `blocks` kein Array, Block ohne
  Text) fällt weg; ein einsames Ersatzzeichen wird U+FFFD; `language` wird immer `de` (der einzige Wert der Speicherform; ein
  gespeichertes anderes kann es aus der Schreibvariante nicht geben). Bleibt nichts **oder überschreitet das Ergebnis eine
  Strukturgrenze der Speicherform** (10 000 Blöcke, 10 000 Punkte, 20 000 Läufe), liefert sie `null`, und die Projektion nimmt L
  (Nachprüfung Minor 2); überschreitet auch L eine Grenze (nur bei einem gespeicherten Text über 20 000 Code-Punkten denkbar),
  liefert L ebenfalls `null`, und die Version trägt kein `body`.
- **Kein verlustbehaftetes Lesen (Codex P1 auf #151, Nachtrag Orchestrator 04.10.2026):** Die Projektion vergleicht nach der
  Lesevariante `answerPlainText(ergebnis)` mit dem gespeicherten `text` der Version. Weichen sie ab (ein Block, ein Punkt oder
  ein Lauf ist beim Lesen weggefallen oder hat Text verloren), gilt das Ergebnis als unbrauchbar: die Projektion nimmt L aus dem
  gespeicherten `text`. Eine gestrichene Marke ändert den Klartext nicht und löst den Rückfall nicht aus. So zeigt das Podium nie
  weniger Wortlaut als der gespeicherte, gegebenenfalls freigegebene `text` (Entscheidung 7). Für gültige Daten aus der
  Schreibvariante sind beide gleich, weil `text` = P(gespeichertes `body`) und die Lesevariante auf solchen Daten nichts entfernt.

**Reihenfolge innerhalb eines Absatzes bzw. Listenpunkts (fest, Lesebefund M3):** N1 und N2 wählen Blöcke und Marken; dann
(1) Zeichen abbilden und entfernen (N3), (2) Leerraum (N4), (3) Läufe (N5), (4) **NFC je fertigem Lauf**, (5) erneute
Leerprüfung (ein Lauf, der jetzt leer ist, fällt weg; danach N5 noch einmal), (6) leere Blöcke (N6), (7) Listen zusammenführen
(N7). N8–N10 nur in der Schreibvariante bzw. als Eigenschaft.

- **N1 Blockarten.** Jeder Eingabeblock liefert Stücke: `content` (falls da) als ein Stück, jedes Element von `items` (falls
  da) als ein Stück. Ist `type` `list`, werden alle Stücke Listenpunkte einer Liste; **jede andere Blockart** (auch `heading`,
  `quote`, `table`, `paragraph` mit `items`) wird zu je einem Absatz je Stück. Nichts geht verloren, nichts wird erfunden.
- **N2 Marken.** Nur `bold`, `italic`, `highlight` bleiben; jede andere Marke fällt weg, ihr Text bleibt. Doppelte Marken
  einmal; Reihenfolge kanonisch `bold`, `italic`, `highlight`.
- **N3 Zeichen, nach Unicode-Kategorien (Lesebefund M4).** In dieser Reihenfolge: jedes Zeichen mit `\p{White_Space}` (auch
  Tab, Zeilenumbruch, Wagenrücklauf, U+0085, U+00A0, U+2028, U+2029, U+3000) wird U+0020; danach wird jedes verbleibende
  `\p{Cc}` entfernt und **jedes** `\p{Cf}` entfernt (darunter U+00AD, U+200B–U+200F, U+202A–U+202E, U+2060–U+2064,
  U+2066–U+2069, U+FEFF, die Tag-Zeichen U+E0001–U+E007F). Ein einsames Ersatzzeichen (`\p{Cs}`, nicht wohlgeformtes UTF-16)
  ist in der Schreibvariante ein **422** wie in 040b (`isWellFormed`, `packages/domain/src/masterData.ts:20`), in der
  Lesevariante U+FFFD. **Bewusste Folge:** Mit U+200D (ZWJ) fällt auch die Verbindung zusammengesetzter Emoji weg
  („Familie“ wird drei Einzel-Emoji); Variantenselektoren (`\p{Mn}`) bleiben. In Antworten des Vorstands ist das hinnehmbar;
  die Alternative (ZWJ nur zwischen Emoji erlauben) kostet rund 0,2 AStd.
- **N4 Leerraum.** Innerhalb eines Absatzes bzw. Punkts wird jede Folge von Leerzeichen **über Laufgrenzen hinweg** zu einem
  Leerzeichen. **Grenzregel (Lesebefund Minor 8):** Das verbleibende Leerzeichen gehört zu dem Lauf, in dem die Folge
  **beginnt** (dem früheren); in späteren Läufen fällt es weg. Ein Lauf, der danach nur aus Leerzeichen besteht, **verliert
  seine Marken** (eine Marke auf Leerraum ist unsichtbar und würde die Idempotenz stören). Leerraum am Anfang und Ende des
  Absatzes bzw. Punkts fällt weg, auch wenn er in einem eigenen Lauf steht.
- **N5 Läufe.** Leere Läufe fallen weg; benachbarte Läufe mit gleicher Markenmenge werden zusammengeführt.
- **NFC** je fertigem Lauf (Schritt 4). Läufe werden über NFC nicht zusammengezogen: Ein kombinierendes Zeichen am Anfang eines
  Laufs mit anderen Marken als der Basisbuchstabe davor bleibt zerlegt. Das ist stabil (eine zweite Normalisierung ändert
  nichts) und kommt nur bei Auszeichnung mitten in einem Buchstaben vor.
- **N6 Leere Blöcke.** Ein Absatz ohne Text fällt weg; ein leerer Listenpunkt fällt weg; eine Liste ohne Punkte fällt weg.
  Damit sind Folgen leerer Absätze („leere Blöcke zusammenführen“) aufgelöst.
- **N7 Listen zusammenführen.** Unmittelbar benachbarte Listen werden eine Liste.
- **N8 Sprache (nur Schreiben).** Fehlt `language`, gilt `de`. Ein anderer Wert ist ein 422 (Entscheidung 8), kein stiller Wechsel.
- **N9 Grenze (nur Schreiben).** Die Klartextprojektion (P) hat höchstens 20 000 Code-Punkte, wie `AnswerDraft.text`; sonst 422.
  **Strukturgrenzen der Speicherform folgen daraus und können nie allein greifen** (Lesebefund M2): jeder Absatz, Punkt und
  Lauf trägt mindestens ein Zeichen, Blöcke sind durch mindestens ein Trennzeichen getrennt. Daher im Vertrag: höchstens
  **10 000 Blöcke**, **10 000 Punkte je Liste**, **20 000 Läufe** je Absatz bzw. Punkt. Gewählt statt „L führt Zeilen zusammen“,
  weil so **jeder gültige Text** (≤ 20 000 Code-Punkte, also ≤ 10 000 nicht leere Zeilen) über L ein gültiges Dokument ergibt
  und die Zeilenstruktur alter, schon freigegebener Antworten erhalten bleibt (Recht: die Darstellung soll dem freigegebenen
  Wortlaut so nah wie möglich bleiben).
- **N10 Idempotenz.** `normalize(normalize(x))` ist tief gleich `normalize(x)` für jede gültige Eingabe, in beiden Varianten;
  die Speicherform ist ein Fixpunkt beider. Bleibt nach N1–N7 kein Block, wirft die Schreibvariante 422 „Answer text is
  required.“

Dazu die Gestaltprüfung `checkAnswerBodyInput(input): string | undefined` im Gleichlauf mit dem Vertragsschema (Typen,
Pflichtfelder, Größen der Eingabeform), damit die Demo dieselben 422 liefert wie der Validator (Muster `checkRefusalProposal`,
044a). Keine Meldung wiederholt eingegebenen Text. `codePointLength` zieht aus `api.ts` nach `answerFormat.ts` um; `api.ts`
exportiert es unverändert weiter (Lesebefund Minor 4).

**Invariante zu Schlüsselnamen (Nit 5):** Das Blockdokument benutzt nur die Schlüssel `language`, `blocks`, `type`,
`content`, `items`, `text`, `marks`. Keiner davon darf je einer der Schlüssel sein, die `maskValue` rekursiv entfernt
(`MASKED_KEYS` in `stream.ts:182`: Anzeigename, Organisation, `pii`, `personId`, Begründung); sonst verschwände ein Teil des
Dokuments still aus `EventRead`. Test 3 prüft das gegen die Konstante.

### 2a. Zeichenfilter auch für `text` (Lesebefund M1, Security)

Neue Ereignisse tragen auch im Klartext keine Steuer- oder Formatzeichen mehr, nicht nur im Dokument. `sanitizeAnswerText`
(in `answerFormat.ts`) wendet auf `text` **ohne** `body` in `draftAnswer` und auf `text` in `proposeRefusal` an: `\p{Cc}`
außer Tab, Zeilenumbruch, Wagenrücklauf entfernen; jedes `\p{Cf}` entfernen; NFC; danach `trim` wie bisher. Leerraum wird
**nicht** auf U+0020 abgebildet (die Zeilen eines Klartexts bleiben Zeilen). **Reihenfolge (Nachprüfung Minor 1):** (1) Form
und Längen auf der **rohen** Eingabe, wie der Validator (422; die Grenzen 20 000 bzw. 4 000 Code-Punkte gelten also vor dem
Filter); (2) einsames Ersatzzeichen → 422; (3) Filter, NFC, `trim`; (4) Leerprüfung auf dem gefilterten Wert: leerer
Antworttext → 422 „Answer text is required.“, leerer Verweigerungswortlaut → 422 wie heute bei leerem `text`, leere Begründung
auf Pfad B → 409 R-GUARD-09 wie heute bei „   “. Für einen Text **ohne Steuer- und Formatzeichen und bereits in NFC** (der
Normalfall, der ganze Seed) ist das Ereignis Byte für Byte wie vor 055 (Nachprüfung Minor 3). Alte Ereignisse werden nicht umgeschrieben und ihr `text` beim Lesen nicht gefiltert (R7, Bindung der Freigabe);
nur das daraus hergeleitete `body` läuft durch die Lesevariante. Auch die Begründung einer Verweigerung (`pii.refusalJustification`)
läuft in `proposeRefusal` durch `sanitizeAnswerText` (Entscheidung des Orchestrators, 04.10.2026), **vor** den bestehenden
Prüfungen: Eine Begründung, die danach leer ist, gilt wie eine leere (Pfad B: 409 R-GUARD-09, wie heute bei „   “); ein
einsames Ersatzzeichen ist 422. Ort (`pii`), Maskierung und Leserkreis der Begründung bleiben unverändert.

### 3. Klartextprojektion P und Herleitung alter Versionen L

- **P** `answerPlainText(body)`: Läufe eines Absatzes bzw. Punkts aneinander; Punkte einer Liste mit `\n` getrennt; Blöcke mit
  `\n\n` getrennt; **auf das Ganze NFC** (Lesebefund M3: an einer Laufgrenze kann ein zerlegtes Zeichen stehen, das erst im
  verbundenen Text zusammengesetzt wird; der Klartext dient Suche und Diff und soll durchgehend NFC sein). Kein
  Aufzählungszeichen im Klartext (die Vorlesezeit in 054 zählt Wörter; ein Zeichen wäre ein Wort).
- **L** `answerBodyFromText(text)`: Zeilen getrennt an `\r\n`, `\r` und `\n` (Codex P2 auf #151: ein einzelnes `\r` ist ein
  Zeilenende, das `sanitizeAnswerText` erhält; sonst machte N3 daraus ein Leerzeichen und die Zeile ginge in der Darstellung
  verloren), jede nicht leere Zeile ein Absatz mit einem Lauf ohne Marke,
  `language: de`, danach durch die **Lesevariante** (N3–N7). Wirft nie; ein Text nur aus Leerraum liefert `null`, und die
  Projektion lässt `body` weg (kommt nur bei kaputten Altdaten vor; der Kern nimmt keinen leeren Text an). Wegen N9 ergibt
  jeder gültige Text ein gültiges Dokument.
- Handgetippte Zeichen wie „- “ am Zeilenanfang werden **nicht** als Liste gedeutet (keine Heuristik im Kern).

### 4. `draftAnswer` mit `body` (`api.ts`, R-TRANS-03)

- **Ohne `body`:** wie bisher, nur mit dem Zeichenfilter aus 2a; kein `body` im Ereignis. Für Text ohne Steuer- und
  Formatzeichen und bereits in NFC Byte für Byte wie vor 055; bestehende Clients, Tests, Seed und Lastkorpus bleiben gleich.
- **Mit `body`:** Schreibvariante (422 bei Gestalt, Ersatzzeichen, N8, N9, nichts übrig), dann `text = answerPlainText(body)`.
  Das Ereignis trägt `answer.text` **und** `answer.body` (Speicherform). **Der mitgesendete `text`** bleibt im Vertrag Pflicht
  (0.4.x ist additiv, ADR 0015; 043a Regel 1) und muss die Vertragsform erfüllen (mindestens ein Zeichen, höchstens 20 000);
  **sein Inhalt wird mit `body` weder geprüft noch gespeichert**, auch ein `text: " "` ist dann zulässig (Lesebefund Minor 1).
  Mit `body` gewinnt das Blockdokument; die Beschreibung des Vertrags sagt das (Eigentümerfrage 3). 055b sendet als `text`
  `answerPlainText(normalize(input))`, damit ein Leser des Rumpfs ohne `body` denselben Text sieht.
- Die Reihenfolge der Prüfungen folgt dem Muster 048/044a: Gestalt und Normalisierung **vor** `transition(...)`, damit ein
  422 vor 403/404/409 kommt wie beim Validator, und kein Ereignis entsteht.
- **Idempotenz (Nit 3):** Eine Wiederholung mit demselben Idempotenzschlüssel und anderem `body` liefert das erste Ergebnis
  (R-IDEM-01, unverändert); der Vertrag sagt das in einem Satz an `AnswerDraft.body`.

### 5. Projektion: alte Ereignisse lesbar, Whitelist auch beim Lesen (`state.ts`)

Im Fall `AnswerDrafted` bekommt jede Version `body`:
`normalizeAnswerBodyForRead(payload.answer.body) ?? answerBodyFromText(payload.answer.text)` — gespeicherte Bodies laufen
beim Lesen noch einmal durch die Whitelist; die Projektion **wirft nie** (sonst wäre ein Jahrgang wegen eines Ereignisses
unlesbar). Für heutige Ereignisse ist das wegen N10 keine Änderung. Wird später eine Marke aus `ANSWER_MARKS` gestrichen,
verschwindet sie beim Lesen, **ohne** dass eine neue Version entsteht (ADR 0005 „Risiko“: keine Freigabe darf dadurch
zurückgesetzt werden). `text` wird nie neu berechnet: Was gespeichert ist, bleibt der Klartext der Version (Suche, Diff,
Vorlesezeit bleiben stabil). Verweigerungen (`proposeRefusal`) und alle Versionen von vor 055 bekommen ihr `body` aus L.
Kosten: L läuft beim Aufbau der Projektion für jede alte Version; Vor-dem-Bau-Punkt 7 misst das am Lastkorpus, bei
Überschreitung wird `body` je Ereignis-id gemerkt (Memo in der Projektion, kein Ereignis).

### 6. „Beim Weiterleiten“ (#31, Planzeile)

`submitForReview` und `forwardQuestion` tragen keinen Antwortinhalt; sie verweisen auf die letzte Version bzw. wechseln nur den
Fachbereich. Inhalt entsteht nur über `draftAnswer` und `proposeRefusal`. Damit ist „normalisiert beim Speichern und beim
Weiterleiten“ eine Invariante, keine zweite Stelle: Was weitergeleitet wird, ist immer eine schon normalisierte Version (Test
K6). Ungespeicherter Text wird nie weitergeleitet; 054 blendet die Übergaben dann aus. `proposeRefusal` bleibt in 055 ohne
`body` (Nicht-Ziel; Klartext wie bisher, `body` aus L).

### 7. Freigabe: Eine Formatänderung allein ist eine neue Version (R-GUARD-04)

Der Kern vergleicht nicht mit der Vorversion; jeder erfolgreiche `draftAnswer` ist eine neue Version und hebt eine Freigabe auf
(`invalidatedApprovalOfVersion`, unverändert). Das gilt auch, wenn sich nur eine Marke ändert und `text` gleich bleibt. Die
Freigabe deckt die **gespeicherte Version** (Klartext und, falls vorhanden, Dokument im Ereignis); was Bühne und Historie
zeigen, leitet sich daraus deterministisch ab (L für alte Versionen, Whitelist beim Lesen) und ändert den Wortlaut nie, nur
seine Gliederung in Absätze und die Auszeichnung (Lesebefund Minor 9). K13 hält diese Herleitung für feste alte Ereignisse fest. Ob eine
Version „wirklich“ geändert ist, entscheidet die Oberfläche vor dem Senden (055b: Vergleich auf der Eingabeform, nicht auf dem
Klartext). Option: Formatänderung ohne Freigabeverlust (Eigentümerfrage 2; braucht eine Regel „gleicher Klartext“ im Guard,
Klasse hoch, rund 0,5 AStd, nur mit Rechtsblick).

### 8. Inhaltssprache `language` (E21)

048 hat das Feld an 055 abgegeben („an der Antwortversion, deren Text sie beschreibt“). 055 **trägt es**, aber eng: als
Pflichtfeld der Speicherform `AnswerBody.language`, Enum `[de]`, in der Eingabe optional (fehlt → `de`). Abnehmer ist der
Renderer in 055b, der es als `lang`-Attribut setzt (WCAG 3.1.2 „Sprache von Teilen“: eine deutsche Antwort in der englischen
Oberfläche wird von Screenreadern richtig ausgesprochen). Damit ist es kein totes Feld. Keine DE/EN-Kopplung, kein zweiter Wert,
kein Feld an `Question` (E21 bleibt offen, Nach-Beta). Option: abtrennen (Eigentümerfrage 4).

### 9. Dienst

Keine Routenänderung (Befund). Der Validator prüft `AnswerDraft.body` gegen `AnswerBodyInput`; Antworten (`Question`,
`StageView`, `QuestionUpdated`) tragen `AnswerVersion.body` aus der Projektion. `EventRead` bindet `payload.answer.body` an die
geschlossene Speicherform (Vertragsschritt). Persistenz: `payload` ist JSON; keine Migration, keine Spalte. Ereignisse mit
`body` sind größer (Text doppelt, plus Struktur; bei 20 000 Zeichen grob 2–3 ×); die 256-KiB-Grenze bleibt die Schranke der
Anfrage. Die Problem-Meldung des Validators wird begrenzt (höchstens 20 Einzelfehler und die Restzahl), damit ein Rumpf mit
Tausenden fehlerhaften Läufen keine Antwort in Rumpfgröße erzeugt (Lesebefund Minor 6, Security/DoS): `describeErrors` in
`contractSchema.ts`, sonst nichts dort.

### 10. Datenschutz und Sicherheit

- `body` ist derselbe Inhalt wie `text`, keine neue Datenklasse, kein `pii`-Teil (ADR 0009 wie bisher für `text`); Maskierung,
  Zugriffslog, Aufbewahrung unverändert. Kein Datenschutz erweiternder Standard.
- In neue Ereignisse kommt nur die geschlossene Speicherform (N1, N2, N3); offene Zeichenketten der Eingabe nie (Test 3).
- Bidi-, Null-Breiten- und alle anderen `\p{Cf}`-Zeichen fallen in Dokument **und** `text` neuer Versionen weg (N3, 2a): Sie
  könnten auf Bühne und in der Freigabe einen anderen Text zeigen als den, der gesucht und verglichen wird. Einsame
  Ersatzzeichen sind ein 422.
- 055b rendert ausschließlich `Question.answers[n].body` (Projektion, Lesevariante), **nie** `payload.answer.body` aus einem
  Ereignis oder Strom (Lesebefund Minor 2, Security): Nur die Projektion garantiert die Whitelist auch für alte Ereignisse.
- Keine Auslieferung von 055 in eine geteilte Umgebung (Probe, Pilot) vor 055b (Lesebefund Minor 10, Recht): Ohne Renderer
  zeigt die Oberfläche formatierte Versionen nur als Klartext, und eine Freigabe in der Beantwortung sähe nicht, was die Bühne
  später zeigt. Der Bericht nennt das in einer Zeile. Ausgerollt wird ohnehin nur aus der Pipeline nach Go des Eigentümers.
- Kein HTML in Vertrag oder Kern; der Kern sieht nie Markup. Einfügen und Darstellung sind 055b.

## Vertragsschritt (Architekt, erster Commit, vor jedem Code; AGENTS.md R6)

Additiv: neue Schemas, zwei optionale Felder, eine Bindung im Lesepfad; keine neue Operation, kein `Action`, kein
`Event.type`, kein neues Pflichtfeld in einer Anfrage.

- **Version:** nächste freie Patch-Stufe beim Merge (heute 0.4.4). `info.version`, `packages/contract/package.json`, Abschnitt
  `## [0.4.4]` in `CHANGELOG.md` mit `### Added`, einem `### Changed` für die Verengung (Nit 1: `draftAnswer` und
  `proposeRefusal` entfernen Steuer- und Formatzeichen aus `text`, `proposeRefusal` auch aus `refusalJustification`; ein einsames Ersatzzeichen ist 422) und dem Vermerk „auf
  Standard gebaut (E6, E21 offen)“. Die Beschreibungen von `AnswerDraft.text`, `RefusalProposal.text` und `RefusalProposal.refusalJustification` sagen das in einem Satz.
- **`AnswerMark`:** `type: string`, `enum: [bold, italic, highlight]`, Beschreibung: Hausformat nach ADR 0005, keine Schriftwahl
  (E6); eine neue Marke ist additiv, eine gestrichene bleibt als Wert beschrieben stehen und wird beim Lesen entfernt.
- **`AnswerInline`:** geschlossen, `required: [text]`, `text` 1..20000, `marks` Array von `AnswerMark`, `uniqueItems`, ≤ 3.
- **`AnswerParagraph`:** geschlossen, `required: [type, content]`, `type: { const: paragraph }`, `content` 1..20000 × `AnswerInline`.
- **`AnswerList`:** geschlossen, `required: [type, items]`, `type: { const: list }`, `items` 1..10000, jedes 1..20000 × `AnswerInline`.
- **`AnswerBlock`:** `oneOf` aus beiden (die `const` trennt sie).
- **`AnswerBody`:** geschlossen, `required: [language, blocks]`, `language: { enum: [de] }` (E21), `blocks` 1..10000 × `AnswerBlock`.
  Beschreibung: die normalisierte Speicherform; `text` der Version ist ihre Klartextprojektion (Regel P in Prosa). Die
  Strukturgrenzen folgen aus der Textgrenze 20 000 (N9) und greifen nie allein; so hat jede gültige Version ein gültiges Dokument.
- **`AnswerInlineInput`:** geschlossen, `required: [text]`, `text` 0..20000, `marks` Array von Strings 1..32, ≤ 16.
- **`AnswerBlockInput`:** geschlossen, `required: [type]`, `type` String 1..32, `content` ≤ 2000 × `AnswerInlineInput`,
  `items` ≤ 1000 × (≤ 2000 × `AnswerInlineInput`).
- **`AnswerBodyInput`:** geschlossen, `required: [blocks]`, `language: { enum: [de] }` optional, `blocks` 1..2000 ×
  `AnswerBlockInput`. Beschreibung: offene Eingabe; der Kern wendet die Whitelist an (N1–N10, ADR 0005), unbekannte Blockarten
  werden Absätze, unbekannte Marken entfallen, ihr Text bleibt; Steuer- und Formatzeichen fallen weg; 422, wenn danach kein Text
  bleibt, der Klartext 20 000 Code-Punkte übersteigt oder ein einsames Ersatzzeichen vorkommt.
- **`AnswerDraft.body`:** optional, `$ref: AnswerBodyInput`. Beschreibung: mit `body` speichert der Dienst als `text` die
  Klartextprojektion des normalisierten Dokuments; der mitgesendete `text` bleibt Pflicht (0.4.x additiv), muss seine
  Vertragsform erfüllen und wird dann weder geprüft noch gespeichert. Ohne `body` wie bisher (mit dem Zeichenfilter). Eine
  Wiederholung mit demselben Idempotenzschlüssel liefert das erste Ergebnis, auch bei anderem `body` (R-IDEM-01).
- **`AnswerVersion.body`:** optional, `$ref: AnswerBody`. Beschreibung: ab 0.4.4 an jeder Version; für Versionen ohne
  gespeichertes Dokument (vor 0.4.4, Verweigerungen) aus `text` hergeleitet, eine nicht leere Zeile je Absatz, ohne Marken; nie maskiert,
  nie Personendaten im Sinne von `PiiEnvelope` (derselbe Inhalt wie `text`).
- **`EventRead.payload.answer.properties.body`:** `$ref: AnswerBody` — der Lesepfad ist geschlossen. Dazu ein Halbsatz in der
  Beschreibung von `Event` (Liste der Nutzlasten je Ereignisart): `AnswerDrafted.answer.body` ist die Speicherform ab 0.4.4.
  Hinweis: `EventRead` gibt die gespeicherte Nutzlast wieder; ein später gestrichener Enum-Wert bleibt deshalb im Vertrag
  beschrieben (siehe `AnswerMark`).
- **ADR 0005:** ein Absatz „Eingabe- und Speicherform“ (Entscheidungen 1, 2, 2a) unter „Entscheidung“, eine Zeile unter
  „Risiko“ (Lesevariante wirft nie; gestrichene Marke bleibt als Enum-Wert beschrieben) und eine Zeile unter „Nachweis“
  (055 Kern und Dienst, 055b Bilder); Status bleibt „vorgeschlagen“ (Annahme an Prüfpunkt 5).
- **Typen:** `pnpm contract:types` regeneriert `packages/contract/src/types.ts`; ein zweiter Lauf ergibt keinen Diff.
- **Tore:** `pnpm contract:lint` ohne neue Meldung; `check.mjs` (a)–(d) `ok`, (c) mit `0.4.3 -> 0.4.4`. Die Versionszeilen in
  `contract.test.ts:90` und `takt-019-contract.test.ts:8` ziehen nach (Zahl der Operationen unverändert).
  `contract-043a.test.ts` Test 10 (`no silent widening`, Zeile 268) pinnt die Schlüssel von `AnswerDraft` auf `['sources',
  'text']`; er bekommt `body` mit dem Kommentar „Vertragszeile von 055, 0.4.4“ (Lesebefund B1). Weitere Tests, die Schlüssel
  von `AnswerDraft`, `AnswerVersion` oder `EventRead.payload.answer` festhalten, gibt es auf `cc97005` nicht (gesucht in
  `apps/api/src/__tests__`, `packages/*/src`, `scripts`); Test 6 dort prüft nur `AnswerVersion.required` (bleibt gleich), Test
  13 nur das Verbot von `refusalJustification` (bleibt gleich). **Durch 2a berührt (Nachprüfung NB1):**
  `packages/domain/src/__tests__/refusal044a.test.ts:392-394` erwartet, dass eine Begründung mit einsamen Ersatzzeichen
  angenommen wird (`in_review`); mit 2a ist das 422. Diese drei Zeilen werden auf 422 umgestellt (Kommentar „055, Entscheidung
  2a“); die Emoji-Fälle 388–391 und der Längenfall 361 (4 001 Ersatzzeichen, 422 schon über die Länge) bleiben. Zweite Suche
  nach Tests, die einsame Ersatzzeichen, Steuer- oder Formatzeichen in `AnswerDraft.text`, `RefusalProposal.text` oder
  `refusalJustification` als angenommen erwarten (`packages/domain/src/__tests__`, `apps/api/src/__tests__`, `apps/web/src`):
  keine weitere. `refusal044b.test.ts:562` prüft nur `codePointLength` gegen Ajv und bleibt gleich (die Funktion zählt weiter
  einsame Ersatzzeichen; sie wird nur verschoben). Findet der Bau doch einen, hält er an und meldet.
- **Rücknahme nach dem Merge** ist teuer: Ein Feld oder einen Enum-Wert zu streichen, ist brechend (0.5.0, ADR 0015), und
  Ereignisse mit `body` bleiben für immer im Protokoll (R7). Deshalb Lesebefund vor dem Bau.
- Ist beim Baustart schon eine andere 0.4.x-Stufe gemergt, nimmt dieser Schritt die nächste.

## Nicht-Ziele

- Keine Oberfläche: kein Editor, keine Werkzeugleiste, kein Renderer, keine Änderung an `WritingMode.tsx`, `AnswerEditor.tsx`,
  `Podium.tsx`, Historie, i18n, e2e-Dateien (alles 055b). Kein Screenshot.
- Kein HTML in Vertrag oder Kern, kein Markdown, keine Schriftwahl, keine Schriftgröße, keine Farbe außer der einen Marke
  `highlight`, keine nummerierte Liste, keine verschachtelte Liste, keine Überschrift, keine Tabelle, kein Link (E6).
- Kein `body` für `proposeRefusal` (Verweigerungen bleiben Klartext mit Zeichenfilter, `body` aus L; Folgeliste, rund 0,3 AStd).
- Keine Auslieferung in eine geteilte Umgebung vor 055b (Entscheidung 10).
- Kein Neuschreiben alter Ereignisse, keine Migration, kein Upcast; L wirkt nur in der Projektion.
- Keine Neuberechnung von `text` beim Lesen; keine Änderung an Suche, Diff, Vorlesezeit.
- Keine DE/EN-Kopplung, kein zweiter Sprachwert, kein `language` an `Question` (E21).
- Kein Eintrag im Regelregister, keine neue Regelart (Hinweise an den Orchestrator).
- Keine Änderung an Rechten, Übergangstabelle, Guards, Wahrheitstabelle, Maskierung, Zugriffslog, Kennzahlen, Seed,
  Lastkorpus, Persistenzschicht, Strom-Themen.
- Kein Export (043d, 051, 052).
- Keine neue Abhängigkeit (SC-10); eigenschaftsbasierte Tests mit eigenem, gesätem Generator.

## Files allowed

Vertrag (erster Commit, Architekt):

- `packages/contract/openapi.yaml` (nur die neun Schemas aus dem Vertragsschritt, AnswerDraft.body, AnswerVersion.body, die Beschreibungen von AnswerDraft.text, RefusalProposal.text und RefusalProposal.refusalJustification, die Eigenschaft body unter EventRead.payload.answer, der Halbsatz in der Beschreibung von Event, info.version)
- `packages/contract/src/types.ts` (nur regeneriert)
- `packages/contract/CHANGELOG.md` (nur Abschnitt 0.4.4)
- `packages/contract/package.json` (nur Version)
- `docs/adr/0005-antwortformat.md` (nur der Absatz „Eingabe- und Speicherform“, je eine Zeile unter Risiko und Nachweis)

Kern:

- `packages/domain/src/answerFormat.ts` (neu)
- `packages/domain/src/types.ts` (nur AnswerVersion.body, AnswerDraft.body und die Typen des Blockdokuments, falls nicht in answerFormat.ts)
- `packages/domain/src/api.ts` (nur draftAnswer, proposeRefusal und die Weiterausgabe von codePointLength aus answerFormat.ts)
- `packages/domain/src/state.ts` (nur der Fall AnswerDrafted)
- `packages/domain/src/events.ts` (nur Kommentar und Typ der Nutzlast von AnswerDrafted, falls der Typzwang es verlangt)
- `packages/domain/src/index.ts` (nur die Exporte aus answerFormat.ts)
- `packages/domain/src/__tests__/answerFormat055.test.ts` (neu)
- `packages/domain/src/__tests__/answerDraft055.test.ts` (neu)
- `packages/domain/src/__tests__/support/answerBodyGen.ts` (neu, gesäter Generator für Test 2 und H5)
- `packages/domain/src/__tests__/refusal044a.test.ts` (nur Zeilen 392–394: einsames Ersatzzeichen in der Begründung jetzt 422, Kommentar „055, Entscheidung 2a“; die Emoji-Fälle 388–391 bleiben)

Dienst (Tests und eine Begrenzung):

- `apps/api/src/__tests__/answerFormat055.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-answerFormat055.test.ts` (neu, mit Postgres)
- `apps/api/src/__tests__/contract.test.ts` (nur Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur Versionszeile)
- `apps/api/src/__tests__/contract-043a.test.ts` (nur Test 10: body in der Schlüsselliste von AnswerDraft, Kommentar „Vertragszeile von 055, 0.4.4“)
- `apps/api/src/contractSchema.ts` (nur die Begrenzung in describeErrors: höchstens 20 Einzelfehler und die Restzahl)

Oberfläche (nur Typzwang):

- `apps/web/src/api/http.ts` (nur falls der regenerierte Typ von AnswerDraft eine Anpassung erzwingt)
- `apps/web/src/api/http.test.ts` (nur ein Fall: draftAnswer reicht body unverändert durch)

Dokumente:

- `docs/sicherheit/bedrohungsmodell.md` (nur eine Zeile 055 in „Weitere Scheiben mit Sicherheitsbezug“ und der Stand von T-G1-T-06 für die Kernhälfte)
- `docs/folgeliste.md` (nur nicht blockierende Befunde des Baus und des Reviews)
- `docs/slices/055-antwortformat.md` (diese Spec: Bericht, Review findings)

## Ausdrücklich nicht erlaubt

`apps/web/src/features/**`, `apps/web/src/components/**`, `apps/web/src/i18n/**`, `apps/web/e2e/**`, `apps/api/src/app.ts`
und jede andere Datei unter `apps/api/src` außer den genannten Tests und der einen Begrenzung in `contractSchema.ts`,
`packages/domain/src/masterData.ts` (nur importiert: `isWellFormed`), `packages/domain/src/seed.ts`, `transitions.ts`,
`permissions.ts`, `rules.ts`, `stream.ts`, `envelope.ts`, `policy-truth-table.md`, `docs/legal-trace.md`, `scripts/**`,
`.github/**`, `package.json` und Lockfile (keine Abhängigkeit), `docs/produktplan-beta.md` und das Register (Hinweise an den
Orchestrator), `docs/glossar.md`. Stellt der Bau fest, dass eine dieser Dateien sich ändern muss: anhalten und melden.

## Vor dem Bau prüfen

1. **Basis:** 054 gemergt (`cc97005` oder später), Vertrag 0.4.3, keine andere 0.4.x-Stufe offen. Sonst nächste Stufe nehmen
   und im Bericht nennen.
2. **Lesebefund der Spec** in frischem Kontext liegt vor (Klasse hoch); blocker und major sind eingearbeitet.
3. **Validator mit `oneOf` und `const`:** ein Probeaufruf mit `AnswerBody` gegen Ajv 2020 (`contractSchema.ts`) zeigt, dass
   ein Absatz mit `items` und eine Liste mit `content` abgelehnt werden und die Fehlermeldung keinen Text der Anfrage
   wiederholt. Erzeugt `openapi-typescript` für `AnswerBlock` keine saubere Vereinigung: Diskriminator-Hinweis im Schema
   ergänzen (nur Typgenerierung), nicht die Form ändern.
4. **Gleichlauf Kern und Validator:** jede Grenze der Eingabeform steht als Konstante in `answerFormat.ts`; Test 6 vergleicht
   sie mit dem geladenen Vertragsschema (Muster 044b), damit kein 422 nur in einer Betriebsart auftritt.
5. **Idempotenz (R-IDEM-01):** Eine Wiederholung mit demselben Schlüssel und **anderem** `body` liefert das erste Ergebnis
   (heutiges Verhalten für `text`). Bestätigen, im Bericht nennen; keine Änderung.
6. **Größe:** Ein `body` an der Grenze (20 000 Code-Punkte Klartext in 2 000 Läufen mit Marken) passt unter 256 KiB; ein
   Rumpf darüber ist 413 vor dem Validator. Messwert der Rumpfgröße im Bericht.
7. **Seed unverändert und Kosten der Projektion (Lesebefund Minor 7):** `CORPUS_DEMO` und `CORPUS_LOAD` erzeugen keine
   Ereignisse mit `body`; der Fingerabdrucktest des Lastkorpus bleibt grün ohne Änderung. Den vollständigen Aufbau der
   Projektion aus `CORPUS_LOAD` (800) **vor und nach** der Änderung messen (Median aus 10 Läufen, Werte im Bericht);
   `apps/web/src/api/timing053.test.ts` (p90 < 150 ms) und `apps/web/src/api/focus054.test.ts` bleiben grün ohne Änderung.
   Mehr als 10 % oder 50 ms Mehrzeit: `body` je Ereignis-id merken (Entscheidung 5), erneut messen.
8. **Validator-Meldung:** Mit 2 001 fehlerhaften Läufen ist die heutige Problem-Meldung so lang wie viele Einzelfehler
   (`describeErrors` ohne Grenze, `allErrors: true`). Messen, dann begrenzen; bestehende Tests, die eine vollständige Meldung
   erwarten, nennen (keiner erwartet mehr als 20 Fehler, sonst anhalten).
9. **Laufzeit `e2e-http`:** Teil a fügt keine e2e-Datei hinzu; der PR-Lauf muss in derselben Spanne bleiben (zuletzt 4:45 bis
   5:30). Dauer im Bericht. Eine Mehrzeit über 0:30 ohne Ursache ist ein Befund.

## Tests zuerst (rot, dann grün)

Jeder Test steht vor der Änderung und ist rot (Ausgabe im Bericht), danach grün.

**Kern, `answerFormat055.test.ts` (rein)**

1. **N1–N9 je ein Fall**, mit genau erwarteter Speicherform:
   a) `heading` mit Text → Absatz; `table` mit `items` → ein Absatz je Punkt; `list` mit `content` und `items` → eine Liste;
   b) **verbotene Marke wird entfernt** (ADR 0005): `underline`, `strike`, `font-family:Arial` fallen weg, der Text bleibt
   wörtlich; `['italic', 'bold', 'bold']` → `['bold', 'italic']`;
   c) je Klasse ein Fall (Lesebefund M4): `\p{White_Space}` (Tab, `\n`, U+0085, U+00A0, U+2028, U+3000) → U+0020; `\p{Cc}`
   (U+0000, U+001B, U+007F, U+009B) entfernt; `\p{Cf}` (U+00AD, U+200B, U+200D, U+202E, U+2066, U+FEFF, U+E0041) entfernt;
   einsames Ersatzzeichen (U+D800 allein) → Schreibvariante 422, Lesevariante U+FFFD; **NFC exakt:** Lauf `"a\u0308"` →
   `"ä"` (U+00E4); Hangul-Jamo `"\u1100\u1161"` → `"가"`; Lauf `"e"` (fett) gefolgt von Lauf `"\u0301x"` (ohne Marke) bleibt
   zwei Läufe, der zweite beginnt mit U+0301 (dokumentierte Ausnahme), und `answerPlainText` liefert `"éx"` (NFC über das Ganze);
   Familien-Emoji mit ZWJ wird drei Emoji (dokumentiert, Nit 6);
   d) Leerraum über Laufgrenzen (Grenzregel N4): `"Hallo "` + **`" Welt "`** + `"  "` → `"Hallo "` + **`"Welt"`**;
   `"a"` + **`" "`** + `"b"` → `"a b"` als **ein** Lauf (Leerlauf verliert die Marke, dann N5); `"a "` + *`" b"`* →
   `"a "` + *`"b"`*;
   e) leere Läufe weg, gleiche Marken zusammengeführt; f) leere Absätze, leere Punkte, leere Liste weg; g) zwei benachbarte
   Listen → eine, durch einen Absatz getrennte bleiben zwei; h) `language` fehlt → `de`; i) Grenze N9: 20 001 Code-Punkte
   Klartext (mit Ersatzpaaren gezählt) → 422, 20 000 → ok; 10 000 Absätze aus je einem Zeichen über die
   **Lesevariante** bzw. L → ok und gegen den Vertrag gültig (H5); die Schreibvariante nimmt höchstens 2 000 Eingabeblöcke (Grenze
   der Eingabeform), 2 000 → ok; die Lesevariante wirft für keinen dieser Fälle.
2. **N10 Idempotenz**, eigenschaftsbasiert mit eigenem gesätem Generator (`__tests__/support/answerBodyGen.ts`, keine
   Abhängigkeit; fester Startwert im Test, 500 Fälle, zufällige Blockarten, Marken, Steuer- und Formatzeichen, Leerraum aller
   Arten, leere Läufe, **kombinierende Zeichen, zerlegte Umlaute, Hangul-Jamo, Ersatzpaare** über Laufgrenzen verteilt), für
   **beide** Varianten: `normalize(normalize(x))` tief gleich
   `normalize(x)`; jede Ausgabe besteht eine Strukturprüfung im Test und enthält nur Werte aus den Whitelists (die
   Prüfung gegen das Vertragsschema mit Ajv macht H5, weil der Kern das Schema nicht lädt). Dazu: `normalize(answerBodyFromText(answerPlainText(b)))` ist gültig; `answerPlainText(normalize(x))` enthält
   keines der entfernten Zeichen aus N3.
3. **Keine offene Zeichenkette in der Ausgabe:** für jede Eingabe aus Test 2 ist jede Blockart in `{paragraph, list}` und jede
   Marke in `ANSWER_MARKS`; ein Text wie `<script>alert(1)</script>` oder `<b onclick=…>` bleibt **wörtlicher Text** in einem
   Lauf (kein Markup im Kern, die Darstellung escapt in 055b). Kein Schlüssel des Blockdokuments ist in `MASKED_KEYS`
   (`stream.ts:182`); der Test liest die Konstante oder deren Export und schlägt fehl, sobald sich beide überschneiden (Nit 5).
4. **P und L:** Absätze `\n\n`, Punkte `\n`, kein Aufzählungszeichen, Ergebnis NFC; L: drei Zeilen mit Leerzeile → drei
   Absätze ohne Marken, `language: de`; nur Leerraum → `null`; 10 000 Zeilen aus je einem Zeichen → 10 000 Absätze, wirft nicht.
4a. **`sanitizeAnswerText`:** U+202E, U+200B, U+0007 entfernt, `\n` und Tab bleiben, NFC, `trim`; einsames Ersatzzeichen → Fehler;
   nur U+200B → leer (→ 422 im Aufrufer); Text ohne solche Zeichen → identisch (gleiche Zeichenkette).
5. **`checkAnswerBodyInput`:** fehlendes `blocks`, `blocks: []`, Block ohne `type`, `type` 33 Zeichen, Marke als Zahl, 17
   Marken, zusätzlicher Schlüssel, `language: 'en'` → je eine Meldung ohne Text der Eingabe; gültige Eingabe → `undefined`.
6. **Gleichlauf** mit dem Vertragsschema: die Grenzen in `answerFormat.ts` (Längen, Anzahlen, Enums) gleich den Werten aus
   `openapi.yaml` (geladen wie in den Vertragstests). Dieser Test liegt im Dienst (`apps/api/src/__tests__/answerFormat055.test.ts`),
   weil nur dort das Vertragsschema geladen wird.

**Kern, `answerDraft055.test.ts` (über `createInProcessApi` mit injizierter Uhr)**

K1. **Ohne `body` unverändert für Text ohne Steuer- und Formatzeichen und bereits in NFC:** Ereignis gleich wie vor 055 (Schlüssel der Nutzlast genau `answer`, ggf.
    `invalidatedApprovalOfVersion`; `answer` ohne `body`); die Version in `Question` trägt `body` aus L.
K2. **Mit `body`:** Ereignis trägt `answer.text = answerPlainText(normalized)` und `answer.body` (Speicherform); ein
    abweichender mitgesendeter `text` steht **nicht** im Ereignis; `Question.answers[n].body` gleich der Speicherform. Auch
    `text: " "` mit gültigem `body` → 200 (Lesebefund Minor 1).
K3. **Verbotene Marke über die API entfernt** (ADR 0005, Demo-Pfad): `marks: ['underline']` → Lauf ohne Marke, Text gleich.
K4. **Negativ:** `body` ohne Text nach N6 → 422 „Answer text is required.“, **kein** Ereignis, Status unverändert; N9-Grenze →
    422; `language: 'en'` → 422; jeweils vor 403/409: ein Akteur ohne `answer.draft` mit ungültigem `body` bekommt 422 (wie der
    Validator), mit gültigem 403 (R-PERM-01).
K5. **Freigabe (R-GUARD-04):** freigegebene Version 1, neue Version 2 mit gleichem Klartext und nur einer zusätzlichen Marke
    → `invalidatedApprovalOfVersion: 1`, `approval` weg, Status `answer_drafted`.
K6. **Weiterleiten:** nach `draftAnswer` mit `body` und `submitForReview` bzw. `forwardQuestion` ist die letzte Version
    unverändert (gleiches `body`, gleiches `text`); beide Ereignisse tragen kein `body`.
K7. **Alte Ereignisse lesbar, Projektion wirft nie:** von Hand angehängt (a) ein `AnswerDrafted` ohne `body` (Form vor 055);
    (b) ein reines Text-Ereignis mit **600 Zeilen**; (c) ein `body` mit einer **nicht mehr erlaubten Marke** und einem leeren
    Absatz (simuliert „Marke gestrichen“); (d) ein gespeichertes `body` mit `language: 'en'`; (e) **der strengste Fall** (Nit 2):
    ein `body` mit unbekannter Blockart, Marke als Zahl, leeren Läufen, `\p{Cf}`-Zeichen und einsamem Ersatzzeichen; in einer
    zweiten Version ein `body` mit 12 000 nicht leeren Blöcken (Lesevariante liefert `null` wegen der Strukturgrenze, `body` aus
    L, Nachprüfung Minor 2); in einer dritten `blocks` als Objekt. Die Projektion wirft für keinen; jede Version hat eine gültige Speicherform
    (bzw. bei (e) zweite und dritte Version `body` aus L), die gestrichene Marke fehlt, `language` ist `de`, `text` ist jeweils das
    gespeicherte, es entsteht keine neue Version und keine Freigabe geht verloren.
    (f) Codex P1 auf #151: ein gespeichertes `body` mit einem gültigen und einem unbrauchbaren Block (anderer Klartext als der
    gespeicherte `text`) → die Projektion zeigt `body` = L(`text`), kein Wort fehlt; (g) Codex P2: ein Altereignis ohne `body`
    mit `text` "a\rb" → zwei Absätze.
K8. **Verweigerung:** `proposeRefusal` schreibt kein `body`; die Version trägt `body` aus L; `refusalJustification` steht
    nicht im `body`.
K9. **Suche:** `q` findet ein Wort aus einem fett ausgezeichneten Lauf (über `text`).
K10. **Seed:** `CORPUS_DEMO` enthält kein Ereignis mit `answer.body`; jede gesäte Version trägt `body` aus L.
K11. **Zeichenfilter im Klartext (M1):** `draftAnswer` ohne `body` mit `text` = `"Umsatz\u202E stieg\u200B um 3 %"` → im
    Ereignis `"Umsatz stieg um 3 %"`; `text` nur aus U+200B → 422, kein Ereignis; einsames Ersatzzeichen → 422.
K12. **Zeichenfilter in `proposeRefusal`:** derselbe Text als Verweigerungswortlaut → gefiltert im Ereignis. Begründung mit
    U+202E und U+200B (Pfad B) → in `pii.refusalJustification` gefiltert gespeichert; eine Begründung nur aus U+200B → 409
    R-GUARD-09, kein Ereignis; eine Begründung mit einsamem Ersatzzeichen → 422, kein Ereignis (vorher angenommen; die drei Zeilen
    `refusal044a.test.ts:392-394` ziehen nach, NB1); 4 000 Code-Punkte roh mit Formatzeichen → angenommen (Länge vor dem Filter). Die Begründung erscheint weiterhin in keiner Ereignislesung, keinem Strom, keiner `StageView` und
    für keinen Leser ohne die Verweigerungsrechte; die bestehenden Maskierungstests aus 044a/044b bleiben unverändert grün.
K13. **Goldener Test der Herleitung (Lesebefund Minor 9, Recht):** drei feste alte Ereignisse als Testdaten (einzeilig;
    mehrzeilig mit Leerzeilen und Leerzeichen am Zeilenende; mit geschütztem Leerzeichen und Tab) ergeben ein wörtlich im Test
    stehendes `body`; der Wortlaut (Zeichenfolge ohne Leerraum) von `answerPlainText(body)` ist gleich dem des gespeicherten
    `text`. Eine Änderung an L macht diesen Test rot und braucht einen Rechtsblick.

**Dienst, `apps/api/src/__tests__/answerFormat055.test.ts` (ohne Postgres)**

H1. `POST /v1/questions/{id}/answers` mit gültigem `body` → 200; `Question.answers[n].body` validiert gegen `AnswerBody`; die
    Antwort validiert gegen den Vertrag.
H2. Validator-422: `blocks` fehlt, Marke 33 Zeichen, zusätzlicher Schlüssel im Lauf, `language: 'en'`, 2001 Blöcke; die
    Meldung enthält keinen eingegebenen Text. **Begrenzt (Minor 6):** ein Rumpf mit 2 000 fehlerhaften Läufen liefert eine
    Problem-Meldung mit höchstens 20 Einzelfehlern und der Restzahl, `detail` unter 4 KiB.
H3. Unbekannte Blockart und Marke über HTTP → 200, Speicherform wie in K3 (gleiches Verhalten wie die Demo).
H4. `getQuestionHistory` und `listEvents`: `AnswerDrafted` mit `payload.answer.body` validiert gegen `EventRead` (geschlossener
    Lesepfad); ein `AnswerDrafted` von vor 055 validiert ebenfalls.
H5. Test 6 (Gleichlauf der Grenzen); dazu die Ausgaben des gesäten Generators aus Test 2 (gleicher Startwert) gegen
    `AnswerBody` aus dem Vertrag (Ajv).
H6. Rumpf über 256 KiB mit `body` → 413 (vorhandene Grenze, Messwert aus Vor-dem-Bau-Punkt 6).

**Dienst, `postgres-answerFormat055.test.ts` (mit Postgres; Wiederherstellungsfall der Klasse hoch)**

P1. Version mit `body` schreiben, Dienst neu starten (Projektion aus dem Protokoll), `getQuestion` liefert dieselbe
    Speicherform und denselben `text`; die Hash-Kette prüft grün.
P2. Gesäte Versionen (Form vor 055) nach Neustart mit `body` aus L; kein Ereignis wurde geschrieben (`lastSeq` gleich).

**Oberfläche, `http.test.ts`:** `draftAnswer` reicht `{ text, body }` unverändert als Rumpf durch.

## Akzeptanzkriterium

1. Tests 1–6 mit 4a, K1–K13, H1–H6, P1–P2, Test 10 in `contract-043a.test.ts` und der `http.test.ts`-Fall vor der Änderung rot (Ausgabe im Bericht), danach grün.
2. Vertragsschritt als **erster** Commit, vor jedem Code; `pnpm contract:types` ohne Diff beim zweiten Lauf; `check.mjs`
   meldet `0.4.3 -> 0.4.4`.
3. `policy-truth-table.md` und `docs/legal-trace.md` ohne Diff (kein Recht, keine Regel geändert).
4. Volle Playwright-Suite `in-process` grün und **unverändert** (Anzahl nennen; keine e2e-Datei berührt); Projekt `http` grün
   im CI-Lauf `e2e-http` des PR, Dauer in der bisherigen Spanne.
5. `git diff` zeigt keine Datei unter `apps/web/src/features`, `apps/web/src/components`, `apps/web/e2e`, kein `seed.ts`, keine
   Änderung an `package.json` oder Lockfile. `pnpm slice-scope` grün auf `claude/slice-055-antwortformat`.
5a. Messwerte aus Vor-dem-Bau-Punkt 7 im Bericht; `timing053.test.ts` und `focus054.test.ts` grün ohne Änderung.
5b. Der Bericht enthält die Zeile „055 nicht vor 055b in eine geteilte Umgebung“ (Entscheidung 10).
6. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Nachweise

- Ausgabe der roten Tests vor der Änderung; Schluss von `pnpm gates`; Zahl der Playwright-Fälle `in-process`.
- Postgres-Lauf P1–P2 (lokal oder CI-Job mit Postgres), Ausgabe im Bericht.
- **Projekt `http`:** grüner CI-Lauf `e2e-http` des PR mit Lauf-ID, Job-ID, Commit und Dauer des Schritts „End-to-end http
  project …“ gegen 8:00/9:00. Kein Artefakt nötig, keine Workflow-Änderung.
- Messwert der Rumpfgröße an der Grenze (Vor-dem-Bau-Punkt 6); Bestätigung zu R-IDEM-01 (Punkt 5).
- Kein Screenshot (keine Oberfläche; die Bildnachweise aus ADR 0005 bringt 055b).

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: hoch
Ausgelöst: [x] Fachregel, Status (R-TRANS-03 mit Blockdokument; R-GUARD-04 deckt Formatänderungen) [x] Vertrag, Ereignis,
Konfiguration (neue Schemas, zwei optionale Felder, neues Nutzlastfeld) [x] Persistenz, Migration, Nebenläufigkeit (Ereignisse
mit neuem Feld; keine Migration; alte Ereignisse lesbar; Idempotenz unverändert) [ ] Rolle, Recht, Identität, Schutzklasse [ ]
personenbezogene oder vertrauliche Daten (derselbe Inhalt wie `text`, keine neue Klasse) [ ] Betrieb, Wiederherstellung (nur
Neustart-Test P1) [ ] Administration [ ] Oberfläche, Barrierefreiheit (055b) [ ] Nachbarsystem [ ] KI, Agenten [x]
Dokumentation (ADR 0005 Absatz, Bedrohungsmodell)
Perspektive(n): Vertrag/Architektur, Security, Recht/Freigabe · Nachweise: oben · Offene Entscheidung: E6 (Standard
Whitelist), E21 (Standard nur `de`, keine Kopplung)

## Wirkung und Risiko

| Risiko | Abwehr | Nachweis |
|---|---|---|
| Offene Blockart oder Marke gelangt ins Protokoll | Speicherform geschlossen, N1/N2, Projektion normalisiert noch einmal | Test 2, 3; H3, H4 |
| Normalisierung ist nicht idempotent, jede Speicherung ändert die Form | N10 mit 500 gesäten Fällen | Test 2 |
| Demo und Dienst verhalten sich verschieden | offene Eingabe in beiden; Grenzen im Gleichlauf | Test 6; K3 gegen H3 |
| Alte Versionen werden unlesbar oder umgeschrieben | L nur in der Projektion; kein Upcast, kein neues Ereignis | K7, K10; P2 |
| Gestrichene Marke setzt Freigaben zurück | Whitelist beim Lesen, `text` nie neu berechnet | K7 |
| Formatänderung ohne neue Version, Freigabe deckt nicht, was das Podium sieht | jeder `draftAnswer` ist eine Version | K5 |
| Mitgesendeter `text` weicht vom Dokument ab | `body` gewinnt, Vertrag sagt es | K2 |
| Bidi- oder Null-Breiten-Zeichen zeigen anderen Text als gesucht | N3 | Test 1c |
| Ereignisse werden zu groß | Grenzen N9, Körpergrenze 256 KiB | Test 1i; H6 |
| Steuer- oder Formatzeichen im Klartext neuer Versionen oder in der Begründung einer Verweigerung (Trojan Source) | Zeichenfilter 2a in `draftAnswer` und `proposeRefusal` (Wortlaut und Begründung) | 4a, K11, K12 |
| Projektion wirft an einem alten oder kaputten Ereignis, der Jahrgang wird unlesbar | Lesevariante ohne 422, Strukturgrenzen aus der Textgrenze | K7 (a–e), Test 1i |
| Bühne zeigt einen anderen Wortlaut als den freigegebenen | Herleitung ändert nur Gliederung und Auszeichnung, goldener Test | K13 |
| Problem-Meldung in Rumpfgröße (DoS) | `describeErrors` begrenzt | H2 |
| Projektion wird am Lastkorpus langsamer | Messung vor und nach, Memo bei Überschreitung | Vor-dem-Bau-Punkt 7 |
| Vertragsänderung lässt sich nicht zurücknehmen | Lesebefund vor dem Bau, additive Stufe | Vor-dem-Bau-Punkt 2 |

## Aufwand

Geschätzt **3,1 AStd** (Spanne 2,7–3,6) für Teil a, nach den Lesebefunden (vorher 2,65). Der Plan rechnete 3 AStd für Vertrag, Kern, Editor und Renderer zusammen
und setzte den Vertrag aus 043b voraus, der nie kam.

| Teil | AStd |
|---|---|
| Vertragsschritt: neun Schemas, zwei Felder, Bindung `EventRead`, ADR-Absatz, CHANGELOG, Typen, Versionszeilen | 0,5 |
| `answerFormat.ts`: Schreib- und Lesevariante, N1–N10 nach Kategorien, P, L, Gestaltprüfung, `sanitizeAnswerText`; Tests 1–5, 4a mit gesätem Generator | 1,05 |
| `draftAnswer`, `proposeRefusal`, Projektion, Exporte; Tests K1–K13 | 0,6 |
| Dienst: H1–H6 (mit Test 6), Begrenzung `describeErrors`, Test 10 in 043a, Postgres P1–P2 | 0,55 |
| Messung der Projektion am Lastkorpus (vorher, nachher, ggf. Memo) | 0,1 |
| `http.ts`-Typzwang, ein Test | 0,1 |
| Bedrohungsmodell, Folgeliste | 0,1 |
| `pnpm gates`, volle in-process-Suite, Bericht, CI-Nachweis | 0,2 |

**055b** (Renderer und Editor) geschätzt **3,6 AStd** (Spanne 3,1–4,2), Klasse mittel, Abschnitt „055b — Entwurf“. Zusammen
rund **6,7 AStd** statt 3.

## Standards (auf Standard gebaut)

| Standard | Was 055 baut | Kosten einer späteren Änderung |
|---|---|---|
| Whitelist `paragraph`, `list`; `bold`, `italic`, `highlight` (E6) | `ANSWER_MARKS`, Enum `AnswerMark` | Marke ergänzen < 1 AStd (Vertrag, Kern, Renderer); entfernen: Whitelist beim Lesen verengen, Enum-Wert bleibt beschrieben |
| Nummerierte Liste wird Aufzählung (Word `ol` → `list`) | N1 | Blockart `ordered` oder Attribut an `list`: rund 0,75 AStd mit Renderer |
| Eingabe offen, Speicherform geschlossen | zwei Schemas | Eingabe schließen (422 statt Entfernen): rund 0,3 AStd, gegen ADR 0005 |
| Mit `body` gewinnt das Dokument, `text` wird nicht gespeichert | `draftAnswer` | 422 bei Abweichung: rund 0,2 AStd, verlangt die Projektion im Client |
| Jede Formatänderung ist eine neue Version und hebt die Freigabe auf | unverändertes R-GUARD-04 | Ausnahme bei gleichem Klartext: rund 0,5 AStd, Klasse hoch, nur mit Rechtsblick |
| `language` nur `de`, im Blockdokument (E21) | Enum `[de]` | zweiter Wert additiv rund 0,2 AStd; Kopplung DE/EN Nach-Beta |
| Gespeicherte Bodies laufen beim Lesen durch die Whitelist | Projektion | nur rohe Wiedergabe: < 0,1 AStd (nicht empfohlen) |
| Verweigerung ohne `body` | nichts | `RefusalProposal.body`: rund 0,3 AStd |
| Strukturgrenzen aus der Textgrenze (10 000 Blöcke), L behält jede Zeile | Vertrag, N9 | L führt Zeilen zusammen: rund 0,2 AStd, ändert die Darstellung alter Versionen (Rechtsblick) |
| ZWJ und alle `\p{Cf}` entfernt (zusammengesetzte Emoji zerfallen) | N3 | ZWJ zwischen Emoji erlauben: rund 0,2 AStd |
| Zeichenfilter auch für `text` neuer Versionen | 2a | — (Sicherheitsstandard, nicht abwählbar ohne Security-Review) |

## Offene Eigentümerfragen

Keine blockiert den Bau; alle mit Standard.

1. **Formatumfang (E6, Frage 7).** Standard: Absatz, Aufzählung, fett, kursiv, Hervorhebung; keine Schriftwahl, weil Schrift und
   Größe von der Ansicht kommen (#31). Zusatzfrage: Braucht das Haus **nummerierte Listen** (aus Word kommen sie heute als
   Aufzählung an, die Nummern fallen weg)? Option rund 0,75 AStd.
2. **Formatänderung und Freigabe.** Standard: Auch eine reine Formatänderung ist eine neue Version und hebt die Freigabe auf
   (Rechtekonzept: „Jede Textänderung nach Freigabe setzt sie zurück“; die Hervorhebung ist Teil dessen, was das Podium sieht).
   Option: gleicher Klartext behält die Freigabe (rund 0,5 AStd, Klasse hoch, Rechtsblick nötig).
3. **`text` neben `body`.** Standard: Mit `body` speichert der Dienst den abgeleiteten Klartext, der mitgesendete wird nicht
   gespeichert. Option: 422 bei Abweichung (rund 0,2 AStd).
4. **Inhaltssprache (E21).** Standard: 055 trägt `language` nur mit `de` im Blockdokument, Abnehmer ist das `lang`-Attribut
   des Renderers (055b). Option: abtrennen und erst mit einer Entscheidung zu E21 bauen (spart < 0,1 AStd; der Renderer setzt
   dann `lang="de"` fest).
5. **Teilung und Aufwand.** Standard: 055 (Teil a, hoch, 3,1 AStd) vor 055b (mittel, 3,6 AStd); zusammen rund 6,7 statt 3 AStd.
   Go des Eigentümers zu Zuschnitt und Budget erbeten.
6. **Risikoklasse.** Standard: hoch (Vertrag, Ereignisform, Freigabebindung). Herabstufen entscheidet nur der Eigentümer; dann
   entfiele der Lesebefund (rund 0,3 AStd).

## 055b — Entwurf für die eigene Spec (nicht Teil der Files allowed dieser Spec)

Der Orchestrator schreibt daraus `docs/slices/055b-antwortformat-editor.md` (AGENTS.md R1), nach dem Merge von 055. Klasse
**mittel** (Oberfläche, kein Vertrag, kein Recht; Einfügen ist eine Sicherheitsfrage, deshalb Review mit Perspektive
**Security** neben **UX/Barrierefreiheit**; hebt der Eigentümer an, wird es hoch). Rund 3,6 AStd. Lanes: web-components,
web-focus, web-answers, web-stage, web-history, web-api (nur Wiederausgabe der Kernfunktionen), e2e, docs.

**Ziel.** Ein Renderer und ein Editor für das Blockdokument. Bühne, Historie, Beantwortung und Fokus zeigen jede Antwort über
denselben Renderer; geschrieben wird in Fokus und Beantwortung mit derselben Werkzeugleiste (Z6: fett, kursiv, Hervorhebung,
Aufzählung; Hinweis „Schrift und Größe kommen von der Ansicht“). Einfügen aus Word bringt die erlaubte Auszeichnung mit, alles
andere wird Text.

**Entscheidungen, die 055b treffen muss (Vorschlag):**

1. **Renderer** `apps/web/src/components/AnswerText.tsx`: rendert nur `paragraph` (`<p>`) und `list` (`<ul><li>`), Marken
   `bold` (`<strong>`), `italic` (`<em>`), `highlight` (`<mark>` mit vorhandenem Tönungs-Token, Kontrast ≥ 4,5:1 auch auf der
   Bühne, axe); unbekannte Blockart → Absatz, unbekannte Marke → Text (eigene, engere Whitelist, ADR 0005 „Risiko“). **Nur
   Textknoten**, kein `innerHTML`, kein `dangerouslySetInnerHTML`. Setzt `lang` aus `body.language`. Keine Schriftfamilie, keine
   Größe: erbt von der Ansicht (#31). Ohne `body` (alter Dienst) Rückfall auf `text` mit `whitespace-pre-wrap` wie heute. **Quelle ist ausschließlich
   `Question.answers[n].body`** (Projektion mit Lesevariante), nie `payload.answer.body` aus Historie, Ereignisstrom oder
   `StageView`-fremden Quellen (Lesebefund Minor 2, Security).
   Einsatz: `stage-answer` und `stage-preview-answer` (aus `<p>` wird ein Block-Element; bestehende Zusicherungen in 003, 020,
   045 prüfen; keine schwächen), Versionen in `QuestionDetail`, `focus-latest`, und **neu in der Historie** ein Block „Antwort,
   Version n“ über der Zeitleiste der gewählten Einzelfrage (die Historie zeigt heute keinen Antworttext). Für den Export
   (051/052) gilt dieselbe Whitelist; ob dort `renderToStaticMarkup` dieser Komponente oder ein Serialisierer auf derselben
   Whitelist dient, entscheidet 051.
2. **Editor** `apps/web/src/features/answers/AnswerBodyEditor.tsx` (oder `components/`), eingesetzt in `WritingMode.tsx` (054)
   **und** `AnswerEditor.tsx`, damit eine formatierte Version in der Beantwortung nicht als Klartext überschrieben wird.
   `contenteditable` mit `role="textbox"`, `aria-multiline="true"`, Beschriftung und Tastenhinweis über `aria-describedby`.
   Werkzeugleiste mit `aria-pressed` je Marke. Befehle über ein eigenes Modul (`editorCommands.ts`), damit `execCommand`
   (veraltet, aber ohne Ersatz) an genau einer Stelle steht und ersetzt werden kann. **Keine neue Abhängigkeit** (SC-10: wer
   eine Bibliothek wie ProseMirror, Lexical oder Tiptap vorschlägt, hält an und legt Alter, Lizenz, Größe vor).
3. **Lesen des Editors** über einen Walker `domToBodyInput(node)` (Eingabeform, ohne Whitelist): Blockelemente → Blöcke mit
   abgeleiteter Art, `b`/`strong`/`font-weight ≥ 600` → `bold`, `i`/`em`/`font-style: italic` → `italic`, `mark`/
   Hintergrundfarbe ≠ transparent/weiß → `highlight`, `u` → `underline`, `s`/`del` → `strike` (der Kern entfernt sie);
   `br` → neuer Absatz; `script`, `style`, `template`, `head`, `title`, `meta`, `xml`, Kommentare und bedingte Kommentare
   liefern **keinen** Text. Derselbe Walker liest Einfügungen.
4. **Einfügen:** `paste` abfangen, `text/html` über `new DOMParser().parseFromString(…, 'text/html')` lesen (inertes
   Dokument: keine Skripte, keine Ladevorgänge), mit dem Walker in die Eingabeform, als DOM-Knoten aus `createElement` und
   `createTextNode` einfügen; **kein** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `execCommand('insertHTML')`. Word-Listen
   ohne `ul`/`ol` (`MsoListParagraph*`, Aufzählungszeichen in `mso-list:Ignore`) werden Listenpunkte ohne das Zeichen. Nur
   `text/plain` → eine Zeile je Absatz. Eine Semgrep-Regel gegen die genannten Senken in `apps/web/src` (neben der vorhandenen
   gegen `dangerouslySetInnerHTML`).
5. **Tastenkürzel:** Strg/Cmd+B, Strg/Cmd+I, Strg/Cmd+Umschalt+H (Hervorhebung), Strg/Cmd+Umschalt+L (Aufzählung, wie Word);
   Vor-dem-Bau-Prüfung in Chromium, Firefox und WebKit auf Kollision mit Browserkürzeln, mit Strg+Enter (054), Alt+Q, Alt+1…6,
   `?` und AltGr-Eingaben deutscher Tastaturen (kein Strg+Alt). Strg+Enter speichert weiter nur (054 Eigentümerfrage 3).
6. **Senden:** `draftAnswer` mit `body` (Eingabeform) und `text = answerPlainText(normalize(input))` aus der Wiederausgabe in
   `apps/web/src/api/` (Lesebefund Minor 1), damit `text` im Rumpf auch ohne `body` lesbar bleibt.
6a. **Ungespeichert und Basis:** `dirty` vergleicht die Eingabeform des Editors mit der Eingabeform, die aus dem Rendern der
   letzten Version zurückgelesen wird (eine reine Markenänderung ist eine Änderung, Entscheidung 7 oben); `draftBase`,
   `isDirty`, `writingOutcome` und der Hinweis bei fremder neuer Version (054 Entscheidung 4) vergleichen Bodies, nicht Text.
   Vorlesezeit und Leerprüfung auf der Klartextprojektion des normalisierten Entwurfs: `normalizeAnswerBody` und
   `answerPlainText` kommen über eine Wiederausgabe in `apps/web/src/api/` (dort dürfen Werte aus `@hv/domain` geladen werden),
   nur als Vorschau, nie als Autorität.
7. **Diff:** bleibt `wordDiff` auf `text`; sind die Texte gleich und die Bodies verschieden, steht der Hinweis „Nur Auszeichnung
   geändert“ statt eines leeren Diffs.
8. **Fokus:** Nach dem Speichern bleibt der Fokus im Editor; das Muster aus 053/054 gilt unverändert in dieser Reihenfolge:
   `armFocus` ruft `settleFocus` sofort, weil der Strom die neue Version liefern kann, **bevor** der Schreibaufruf antwortet
   (054 Nachtrag, 42ea09c). Ein Strom-Update der eigenen Version darf Caret und Text im Editor nicht zurücksetzen.
9. **Sprache:** rund 14 Schlüssel je Sprache (Werkzeugleiste, Hinweis Z6, Kürzel, „Nur Auszeichnung geändert“, Historie
   „Antwort, Version n“); Glossarzeilen „Hausformat“ und „Hervorhebung“.

**Dateien (Vorschlag für „Files allowed“ von 055b):** `apps/web/src/components/AnswerText.tsx` und Test,
`apps/web/src/components/index.ts`, `apps/web/src/features/answers/AnswerBodyEditor.tsx` und Test,
`apps/web/src/features/answers/editorCommands.ts`, `apps/web/src/features/answers/domToBody.ts` und Test (mit synthetischer
Word-Probe als Testdatei, keine echten Daten), `apps/web/src/features/answers/AnswerEditor.tsx`,
`apps/web/src/features/answers/QuestionDetail.tsx` (Versionen, Diff-Hinweis), `apps/web/src/features/focus/WritingMode.tsx`,
`FocusDetail.tsx`, `focus.ts`, `Page.tsx` und ihre Tests, `apps/web/src/features/stage/Podium.tsx` und Test,
`apps/web/src/features/history/Page.tsx` (nur der Antwortblock), `apps/web/src/api/answerFormat.ts` (Wiederausgabe), i18n-Module
und Paritätstest, `scripts/semgrep/rules.yml` (nur die neue Regel), `apps/web/e2e/055b-antwortformat.spec.ts`,
`apps/web/e2e/support/e2e-texts.ts`, `apps/web/playwright.config.ts` und `scripts/e2e-http-031.test.mjs` (nur Einreihung),
`docs/evidence/055b-*.png`, `docs/glossar.md`, `docs/sicherheit/bedrohungsmodell.md` (T-G1-T-06 auf „vorhanden“ für den
Renderer), `docs/folgeliste.md`.

**Tests (Umriss):** Renderer: Whitelist, unbekannte Art und Marke als Text, `<script>` als Text sichtbar, `lang`, Rückfall ohne
`body`. Walker: Word-Probe (fett, kursiv, Hintergrundfarbe, `MsoListParagraph`, `<o:p>`, bedingte Kommentare, `style`-Block),
`script`/`style` ohne Text, `br`. Editor: Kürzel, `aria-pressed`, `dirty` bei reiner Markenänderung. e2e in-process: F1 Fokus
schreiben mit Werkzeugleiste und Kürzeln → speichern → Version zeigt Format; F2 Einfügen der Word-Probe über ein synthetisches
`ClipboardEvent` → nur erlaubte Auszeichnung, kein Skript ausgeführt (`window`-Marker bleibt leer); F3 Bühne zeigt die
formatierte Antwort (Screenshots `055b-buehne-de.png`, `-en.png`); F4 Historie zeigt den Antwortblock
(`055b-historie-de.png`, `-en.png`); F5 Editor (`055b-editor-de.png`, `-en.png`); axe ohne serious/critical. **Projekt `http`
schlank:** nur ein Fall (Format übersteht den Dienst: schreiben, neu laden, Bühnenvorschau zeigt `<strong>` und `<mark>`),
geschätzt ≤ 0:40 Mehrzeit; mit 4:45–5:30 also ≤ 6:10 bei 8:00 Harness-Grenze. Vor dem Bau neu messen; über 8:00 anhalten.

**Rückfall innerhalb 055b** (über 4,0 AStd): zuerst die Word-spezifische Listen-Erkennung (`MsoListParagraph`) als **055c**
mit eigener Spec (rund 0,4 AStd); im äußersten Fall Plan §8.6 Punkt 8 (Editor auf Klartext mit Absätzen, Renderer bleibt).

## Hinweise an den Orchestrator

- **Plan-Eintrag 055 (§5, Zeile 787–793)** stimmt nicht mehr; nicht Teil dieser Spec (paralleler Doku-Durchgang):
  - Klasse **mittel → hoch** (Vertrag, Ereignisform, Freigabebindung; „Warum hoch“); Aufwand **3 → 3,1 AStd** für 055 (055b 3,6; zusammen rund 6,7); Lanes
    „core, web-components“ → „contract, core, service, docs-adr, docs-sicherheit“; Abhängigkeiten **„043, 054“ → „054, 048“**
    (043b gibt es nicht; 055 bringt seinen Vertragsschritt selbst, wie 048).
  - **Neuer Eintrag 055b** „Antwortformat: Renderer und Editor“ — mittel · 3,6 AStd · nach 055 · Lanes web-components,
    web-focus, web-answers, web-stage, web-history, web-api, e2e, docs; Nachweise: Screenshots Bühne, Historie, Editor (de/en),
    grüner Lauf `e2e-http`; Offene Entscheidung E6. Ziel und Abhängigkeiten aus dem Abschnitt „055b — Entwurf“. `plan-graph
    --strict` danach prüfen.
  - Nachweise des Eintrags 055 teilen: „verbotene Marke wird entfernt, Idempotenz“ bei 055; „Screenshots Bühne und Historie mit
    Format“ bei 055b.
  - „Normalisierung beim Speichern und Weiterleiten“ ist eine Invariante (Weiterleiten trägt keinen Inhalt, Entscheidung 6);
    Vorschlag: „Normalisierung bei jeder Schreiboperation mit Antwortinhalt; Weiterleiten trägt keinen Inhalt“.
  - „Renderer-Komponente für Bühne, Historie, Export“: Export gibt es noch nicht; Vorschlag: „Bühne, Historie, Beantwortung,
    Fokus; Export (051/052) auf derselben Whitelist“.
- **Freigabe-Demo-Kette (E57):** 045 → 048 → 053 → 054 → **055 → 055b** → 059 → 046 → 060 → 061 → 041 im Register und in §11
  („Stand“-Absätze) nachziehen.
- **Abhängigkeiten in §5 (Lesebefund Minor 11):** 056 (Bühne je Gerät, Zeile 803 „049, 047, 055, 036“), 059
  (Rechtsfreigabe-Sicht, Zeile 828 „045, 047, 055, 082“) und 081 (Niederschrift-Anlage, Zeile 895) zeigen formatierte Antworten
  und hängen an **055b**, nicht nur an 055; 066 (KI-Port, Zeile 859 „055, 043“) hängt an **055** (Eingabeform, Normalisierung),
  nicht an 055b.
- **Zeile 675 (Eintrag 043, Ziel):** nennt „accountable“, „language“ und das Antwortformat als Teil von 043; ergänzen: Antwortformat
  und `language` kommen mit 055 (0.4.4), `accountable` mit 048b.
- **Zeile 1002 (Nach-Beta-Tabelle, „DE/EN-Kopplung der Antworttexte“):** „Feld language (048)“ → „Feld `language` im
  Blockdokument (055)“.
- **043c (Partnerschnittstellen, Webhooks):** die gebundene Nutzlast von `AnswerDrafted` muss `answer.body` (Speicherform)
  enthalten, sonst bekommen Nachbarn formatierte Antworten nur als Klartext; in der 043c-Planzeile vermerken.
- **Begründung einer Verweigerung (`pii.refusalJustification`):** entschieden am 04.10.2026: in 055 mitgenommen (Entscheidung
  2a, K12; < 0,1 AStd, im Aufwand enthalten). Der CHANGELOG-Abschnitt `### Changed` und die Beschreibung von
  `RefusalProposal.refusalJustification` nennen den Filter.
- **§8.6 Punkt 8** („055 Editor auf Klartext mit Absätzen“) meint künftig **055b**; 055 wird nie gestrichen (Kern und Vertrag).
- **Register E21:** Zielscheibe „Nach-Beta“ bleibt für die Kopplung; ergänzen „Feld `language` (nur `de`) im Blockdokument ab
  055“. **E6:** Zusatzfrage nummerierte Listen (Eigentümerfrage 1). Kein neuer Registereintrag nötig.
- **ADR-Tabelle (Zeile 242):** „055“ → „055, 055b“.
- **Plan-Eintrag 048 (Zeile 706)** „die Inhaltssprache (Feld language, E21) gehört zu 055“ ist mit dieser Spec eingelöst.
- **Regelregister:** Die Normalisierungsregeln N1–N10 tragen ADR-ids in Testnamen, keinen Eintrag in `rules.ts`
  (`RuleKind` kennt nur Übergang, Guard, Recht, Idempotenz). Will der Orchestrator sie im Register und in `legal-trace.md`
  sehen, braucht es eine neue Regelart (rund 0,25 AStd, eigene Takt-Scheibe).
- **Laufzeit `e2e-http`:** 055 +0; 055b ≤ +0:40 (nur ein Fall im Projekt `http`). Danach liegt der Schritt bei höchstens rund
  6:10; 059 und 060 sollten ihre Mehrzeit ebenso rechnen. Eine Anhebung der Grenze oder Teilung des Jobs bleibt eine eigene
  Takt-Scheibe.

## Hinweise an Folgescheiben

- **055b:** Abschnitt oben; baut nur auf der Speicherform auf, nie auf der Eingabeform beim Lesen; rendert nur
  `Question.answers[n].body`.
- **051/052 (Export, Niederschrift-Anlage):** formatierte Antworten über dieselbe Whitelist; Escape aller Texte; `lang` aus
  `body.language`; der Hash einer Version bleibt über das gespeicherte Ereignis definiert, nicht über eine Darstellung.
- **049 (Vorgelesen mit `versionHash`):** der Hash wird über die **gespeicherte Nutzlast** der Version gebildet, nicht über die
  Projektion (deren `body` kann bei alten Versionen aus L stammen und sich mit der Whitelist verengen; Nit 4); er deckt so
  ein gespeichertes `body` mit; eine
  reine Formatänderung ergibt einen anderen Hash (Entscheidung 7).
- **056 (Bühne je Gerät, eigenes Bundle):** der Renderer aus 055b muss ohne den übrigen Client laufen (keine Abhängigkeit über
  `components/index.ts` hinaus).
- **059 (Rechtsfreigabe-Sicht):** zeigt Versionen über den Renderer; Zahlenprüfung (E51) arbeitet auf `text`.
- **060 (Entwurfspuffer):** puffert die Eingabeform des Editors, nicht HTML.
- **064/066 (Ingest, KI-Vorschläge):** Vorschläge für Antworten kommen als `AnswerBodyInput` oder Klartext; der Kern normalisiert.

## Lesebefunde und Umsetzung

Lesung der Spec in frischem Kontext auf `0a8d5c1`, Urteil „erst nachbessern“; Entscheidungen des Orchestrators vom 04.10.2026.
Eingearbeitet im Commit „Spec 055: Befunde der Lesung eingearbeitet“.

| Befund | Umsetzung |
|---|---|
| **B1** `contract-043a.test.ts` Test 10 pinnt die Schlüssel von `AnswerDraft` und wird rot | In „Files allowed“ (nur Test 10, Kommentar „Vertragszeile von 055, 0.4.4“); Suche nach weiteren Tests mit festgehaltenen Schlüsseln von `AnswerDraft`, `AnswerVersion`, `EventRead.payload.answer`: keine weiteren auf `cc97005` (Vertragsschritt, letzter Punkt von „Tore“) |
| **M1** [Security] Zeichenfilter wirkte nur im Dokument, `text` neuer Versionen blieb ohne Filter; Kopfzeile zum Bedrohungsmodell behauptete mehr | Entscheidung 2a: `sanitizeAnswerText` (Cc außer Tab/LF/CR, alle Cf, NFC, Ersatzzeichen 422) in `draftAnswer` ohne `body` und in `proposeRefusal`; K1 jetzt „unverändert für Text ohne N3-Zeichen“; neue Fälle 4a, K11, K12; `api.ts` in „Files allowed“ auf beide Operationen erweitert; Kopfzeile „Bedrohungsmodell“ berichtigt (neue gegen alte Ereignisse) |
| **M2** Eine Normalisierung, die 422 werfen kann, lief auch in der Projektion; Strukturgrenzen hätten alte Texte unlesbar gemacht | Schreib- und Lesevariante getrennt (Entscheidung 2); Lesevariante nur N1–N7, wirft nie; Strukturgrenzen aus der Textgrenze abgeleitet (10 000 Blöcke, 10 000 Punkte, 20 000 Läufe), gewählt statt „L führt Zeilen zusammen“, Begründung bei N9; K7 mit 600-Zeilen-Text und gespeichertem `language: 'en'` |
| **M3** Reihenfolge von NFC und Leerraum offen, Idempotenz an Laufgrenzen nicht gesichert | Feste Reihenfolge (Zeichen → N4 → N5 → NFC je Lauf → Leerprüfung → N6/N7); NFC auch in P über das Ganze; Generator mit kombinierenden Zeichen, zerlegten Umlauten, Hangul-Jamo; exakte Fälle in Test 1c |
| **M4** [Security] N3 als Aufzählung einzelner Zeichen lückenhaft | N3 nach Kategorien (`\p{White_Space}` → U+0020, `\p{Cc}` und alle `\p{Cf}` entfernt, `\p{Cs}` 422 wie 040b bzw. U+FFFD beim Lesen); je Klasse ein Fall in 1c; Zerfall von ZWJ-Emoji dokumentiert |
| Minor 1 Wortlaut zu `text` neben `body` missverständlich | Entscheidung 4 neu gefasst; K2 mit `text: " "`; 055b sendet `answerPlainText(normalize(input))` |
| Minor 2 [Security] Quelle des Renderers offen | 055b rendert nur `Question.answers[n].body`, nie eine Ereignisnutzlast (Entscheidung 10, 055b-Entwurf Punkt 1, Hinweise an Folgescheiben) |
| Minor 3 „Files allowed“ deckte Event-Beschreibung und ADR-Zeilen nicht | ergänzt (Halbsatz in `Event`, Beschreibungen der beiden `text`, ADR-Absatz plus Zeilen unter Risiko und Nachweis) |
| Minor 4 `codePointLength` doppelt | zieht nach `answerFormat.ts`, `api.ts` exportiert weiter |
| Minor 5 Generator ohne Ort | `packages/domain/src/__tests__/support/answerBodyGen.ts` in „Files allowed“ |
| Minor 6 [Security, DoS] unbegrenzte Validator-Meldung | `describeErrors` auf 20 Einzelfehler plus Restzahl begrenzt (nur diese Stelle in `contractSchema.ts` erlaubt); H2 prüft die Grenze; nicht in die Folgeliste |
| Minor 7 Kosten von L beim Aufbau der Projektion | Vor-dem-Bau-Punkt 7: Messung am Lastkorpus vorher/nachher, `timing053` und `focus054` grün, Memo bei Überschreitung |
| Minor 8 Grenzregel von N4 fehlte | Leerzeichen bleibt im früheren Lauf, Leerlauf verliert Marken; Fälle in 1d |
| Minor 9 [Recht] „Freigabe deckt, was das Podium sieht“ ungenau | Entscheidung 7 neu gefasst (Freigabe deckt die gespeicherte Version, Darstellung ändert den Wortlaut nie); goldener Test K13 |
| Minor 10 [Recht] Teil a allein in einer geteilten Umgebung | keine Auslieferung vor 055b (Entscheidung 10, Nicht-Ziele, Akzeptanzkriterium 5b) |
| Minor 11 Plan- und Registerfolgen unvollständig | „Hinweise an den Orchestrator“: 056/059/081 → 055b, 066 → 055, Zeilen 675 und 1002, E57-Kette, 043c-Nutzlast mit `body` |
| Minor 12 Aufwand zu knapp | 3,1 AStd (2,7–3,6), zusammen rund 6,7 |
| Nit 1 CHANGELOG verschweigt die Verengung | `### Changed` im Abschnitt 0.4.4 |
| Nit 2 K7 ohne strengsten Fall | K7 (e) |
| Nit 3 Idempotenzschlüssel bei anderem `body` | Satz in Entscheidung 4 und an `AnswerDraft.body` |
| Nit 4 `versionHash` | über die gespeicherte Nutzlast (Hinweise an Folgescheiben, 049) |
| Nit 5 Schlüssel des Dokuments gegen `MASKED_KEYS` | Invariante unter Entscheidung 2, Prüfung in Test 3 |
| Nit 6 ZWJ | dokumentiert bei N3, Fall in 1c, Standardzeile |
| Zeilenverweis `proposeRefusal` | `api.ts:1517` |
| Nachprüfung NB1: `refusal044a.test.ts:392-394` erwartet angenommene einsame Ersatzzeichen in der Begründung | Datei mit nur diesen Zeilen in „Files allowed“ (jetzt 422, Kommentar „055, Entscheidung 2a“); Aussage „keine weiteren Tests“ im Vertragsschritt berichtigt; K12 erweitert; zweite Suche ohne weiteren Fund (`refusal044b.test.ts:562` prüft nur die Zählung) |
| Nachprüfung Minor 1: Reihenfolge Länge, Filter, Leerprüfung offen | 2a: Längen roh wie der Validator, dann Ersatzzeichen 422, Filter, Leerprüfung (422 bzw. 409 R-GUARD-09) |
| Nachprüfung Minor 2: Lesevariante über einer Strukturgrenze | liefert `null`, L greift; K7 (e) mit 12 000 Blöcken |
| Codex P1 (#151): Lesevariante verwirft nur den kaputten Block, das Podium zeigte weniger als `text` | Vergleich P(Ergebnis) mit gespeichertem `text`; bei Abweichung L (Entscheidung 2, Nachtrag); K7 (f) |
| Codex P2 (#151): L trennt nicht an einzelnem `\r` | L trennt an `\r\n`, `\r`, `\n`; K7 (g) |
| Nachprüfung Minor 3: „Byte für Byte“ zu weit | „ohne Steuer- und Formatzeichen und bereits in NFC“ in 2a, Entscheidung 4 und K1 |
| Nachtrag Orchestrator (04.10.2026) [Security]: Begründung einer Verweigerung ungefiltert | `sanitizeAnswerText` auch auf `pii.refusalJustification` in `proposeRefusal`, vor R-GUARD-09; K12 erweitert; Maskierung unverändert |

## Bericht (nach Bau ausfüllen)

```
Slice: 055-antwortformat
Done: Vertrag 0.4.4 als erster Commit (neun Schemas, AnswerDraft.body, AnswerVersion.body, EventRead-Bindung, ADR 0005);
      answerFormat.ts mit Schreib- und Lesevariante (N1–N10), P, L (CR LF/CR/LF), verlustfreier Projektion (Codex P1) und
      sanitizeAnswerText (2a, VT/FF/NEL werden LF) in draftAnswer und proposeRefusal (Text, Begründung, Quellen);
      Projektion gibt jeder Version body; describeErrors auf 20 Einzelfehler plus Restzahl begrenzt.
Evidence: Commits d68d90e (Vertrag), 8b40294 (Kern, Dienst), 8f25c09 (Review-Fixes); `pnpm gates` auf 8f25c09, Exit 0,
      Schluss unten. Playwright in-process 157 passed (7.5m) auf 8b40294, keine e2e-Datei berührt.
      timing053.test.ts und focus054.test.ts grün ohne Änderung (in `pnpm gates`, apps/web 684 passed).
      Projekt http: CI-Lauf `e2e-http` auf PR #152, Commit 914297b (nach Merge des Integrationszweigs mit takt-043),
      Lauf 37239067336, Job 111543918354, grün: „56 passed (4.9m)“; Schritt „End-to-end http project …“ 22:12:33 bis
      22:18:08, rund 5:35 gegen Limit 9:00 und Harness-Grenze 8:00 (055 fügt keine e2e-Datei hinzu). Artefakt
      `evidence-031-http` (ID 11316579253, `sha256:f5fbe6c3dd10f21c774da3e52928515f890991c0027c87ae460798edaeaefae2`).
      Vorher rot auf 0097ea5 nur wegen 054 F4 (Fokus-Rennen, behoben in takt-043, #153), nicht wegen 055.
Open: 055 nicht vor 055b in eine geteilte Umgebung (Entscheidung 10).
Touched: siehe Liste unten.
```

**Schluss von `pnpm gates` auf `8f25c09`** (domain 490, web 684, api 691 Tests grün; `contract gate: ok`, `(c) … 0.4.3 ->
0.4.4`; slice-scope 24 Dateien innerhalb „Files allowed“):

```
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.61s
mark-test-run: wrote /home/user/wt/s055/.claude/state/last-test-run (clean tree) at commit 8f25c09, tree 2161e1189224…
```

**Rot vor der Änderung:**

- Kern (mit Platzhalter-`answerFormat.ts`, das jede Funktion mit „not implemented“ abbricht): alle 66 Fälle der Scheibe rot
  (`answerFormat055` Tests 1–5 und 4a, `answerDraft055` K1–K13 und R-IDEM, `refusal044a` Ersatzzeichen-Fall). Drei Fälle
  (K5, leerer `text` mit `body`, K7-Freigabe) prüften zunächst nur Bestehendes und waren grün; sie bekamen body- und
  Längenzusicherungen, danach alle rot. Auszug: `× … ADR-0005-N1 a: heading becomes a paragraph …`, `× … ADR-0005-N2 b:
  forbidden mark is removed …`, `× … R-TRANS-03: the event is the pre-055 form (no body) …`.
- Dienst `answerFormat055` mit Platzhalter: 10 rot, 7 grün (die fünf Validatorfälle von H2 und H6 wurden mit dem
  Vertragscommit grün); gegen die `openapi.yaml` von `ea3eb9a` scheitert die Datei ganz („can't resolve reference
  openapi#/components/schemas/AnswerBody“). Postgres P1 und P2 rot.
- Vertragstests vor dem Vertragsschritt: Versionszeilen „expected '0.4.3' to be '0.4.4'“, 043a Test 10 „expected [ 'sources',
  'text' ] to deeply equal [ 'body', 'sources', 'text' ]“.
- Der Fall in `http.test.ts` konnte vor der Änderung nicht rot sein (`http.ts` sendet die Eingabe schon unverändert; in der
  Folgeliste).
- Review-Fixes: Mutanten, die in `exceedsStructure` die Block-, Punkt- oder Laufprüfung oder in `sanitizeAnswerText` die
  Abbildung VT/FF/NEL entfernen, machen je 1–2 Fälle rot.

**Vor dem Bau:** Basis `ea3eb9a` (054 gemergt, Vertrag 0.4.3 -> 0.4.4). oneOf/const-Probe: Absatz mit `items` und Liste mit
`content` abgelehnt, Meldung ohne Text; saubere Vereinigung ohne Diskriminator. R-IDEM-01 mit anderem gültigem `body` liefert
das erste Ergebnis (Test in `answerDraft055`). Rumpf an der Grenze 101 405 Byte (ASCII) bzw. 161 405 Byte (Emoji), über
256 KiB 413. Validator-Meldung ungebremst 2 000 Fehler / 128 888 Byte; kein bestehender Test erwartete mehr als 20.
**Projektion `CORPUS_LOAD`** (6 329 Ereignisse, 685 Antwortversionen; voller `reduce`, Median aus 10 Läufen nach 5
Aufwärmläufen, abwechselnd mit `state.ts` von `ea3eb9a` und dem neuen): vorher **237,9 ms**, nachher **226,4 ms** (alle drei
Paare: vorher 242,6 / 232,3 / 237,9, nachher 229,3 / 225,5 / 226,4); L allein rund 5 ms für alle 685 Versionen. Keine messbare
Mehrzeit, kein Memo. Maschine: Container mit 4 vCPU auf geteiltem Host, Node 22.22.2, vitest 4.1.11; Streuung ±10 ms.

**Touched:** `packages/contract/openapi.yaml`, `packages/contract/src/types.ts`, `packages/contract/CHANGELOG.md`,
`packages/contract/package.json`, `docs/adr/0005-antwortformat.md`, `packages/domain/src/answerFormat.ts` (neu),
`packages/domain/src/types.ts`, `packages/domain/src/api.ts`, `packages/domain/src/state.ts`, `packages/domain/src/index.ts`,
`packages/domain/src/__tests__/answerFormat055.test.ts`, `packages/domain/src/__tests__/answerDraft055.test.ts`,
`packages/domain/src/__tests__/support/answerBodyGen.ts`, `packages/domain/src/__tests__/refusal044a.test.ts`,
`apps/api/src/contractSchema.ts`, `apps/api/src/__tests__/answerFormat055.test.ts`,
`apps/api/src/__tests__/postgres-answerFormat055.test.ts`, `apps/api/src/__tests__/contract.test.ts`,
`apps/api/src/__tests__/takt-019-contract.test.ts`, `apps/api/src/__tests__/contract-043a.test.ts`,
`apps/web/src/api/http.test.ts`, `docs/sicherheit/bedrohungsmodell.md`, `docs/folgeliste.md`,
`docs/slices/055-antwortformat.md`. Nicht berührt: `events.ts`, `http.ts`, `features/**`, `components/**`, e2e, Seed,
`policy-truth-table.md`, `docs/legal-trace.md`.

## Review findings

Lesebefund der Spec vor dem Bau (frischer Kontext, auf `0a8d5c1`): „erst nachbessern“; 1 blocker, 4 major, 12 minor, 6 nit, alle
eingearbeitet, siehe „Lesebefunde und Umsetzung“. Review nach dem Bau: Einträge hier.

Codex P1 (#152): Das projizierte `body` und die `sources` einer Version waren in jeder Sicht dasselbe Objekt wie in der
Projektion und damit veränderbar; behoben in `514b564` (`body` tief eingefroren, `sources` kopiert und eingefroren, Test in
`answerDraft055.test.ts`). Die Voraussetzung für 055b (Aliasing) ist damit erledigt; Eintrag in `docs/folgeliste.md`.
