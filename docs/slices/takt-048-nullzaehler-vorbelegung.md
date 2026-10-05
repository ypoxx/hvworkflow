# takt-048 — Kleine Oberfläche: Nullzähler Grau 600 und Beantwortung mit letzter Version vorbelegen

**Status:** spec · **Risikoklasse:** mittel (Teil 1 reine Optik, für sich niedrig; Teil 2 ändert Verhalten des Antwortfelds:
womit es beginnt, wann Speichern angeboten wird und welche Aktion primär ist; es gilt die höhere Klasse, Leitplanken §4) ·
1,0 AStd · Lanes: web-steering, web-answers, i18n, e2e
**Rolle:** Implementierer-Oberfläche; Design-Kritik (D1–D10) vor dem Review; ein Review in frischem Kontext (Lean-Modus,
AGENTS.md R3), Perspektive UX/Barrierefreiheit und Freigabebindung („kann ein unveränderter oder veralteter Stand eine
Freigabe still aufheben?"); Modell nur in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R4, R9, R10, R12; R-TRANS-03 (Antwortentwurf; eine neue Version hebt Freigabe und
Rechtsfreigabe auf), R-GUARD-04 (Freigabe an die Version gebunden); 055 Entscheidung 7 und 055b §7 (eine reine
Markenänderung ist eine Änderung, reiner Leerraum nicht); 054 (Entwurf der Fokusansicht: Basis, `isDirty`,
`writingOutcome`); 045 (ein Entwurf verdrängt eine Verweigerung, deren Wortlaut ist kein Antwortbeginn); 090 und 010d Ziel 1/3
(Eingaben je Akteur, Ausgang eines Schreibens nur auf der gezeigten Frage); takt-008 (Sperre bis der Datensatz nachgezogen
hat, Fokus bleibt auf dem Knopf); WCAG 2.1 1.4.3 (Kontrast ≥ 4,5:1)
**Quellen-IDs:** Plan §5 takt-048; 053 Zusatz zu D4 („Entschieden 05.10.2026"); 055b Eigentümerfrage 4 („Entschieden
05.10.2026"); `docs/folgeliste.md` (055b-Sammeleintrag „Vorbelegen der Beantwortung"); ADR 0005 (Antwortformat), ADR 0002
**Depends on:** keine (053, 054, 055b gemergt)
**Perspektive:** Barrierefreiheit, Freigabebindung · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `4e38512`)

**Teil 1 — Nullzähler.**

- `apps/web/src/features/steering/DistributionPanel.tsx`, Funktion `Count`: `value === 0 ? 'text-ink-300' : 'text-ink-900'`.
  `Count` steht in allen drei Zellarten der Verteilung: Fachbereichszelle (Knopf), „Ohne Fachbereich" (gestrichelt),
  Bühnenplatzzelle.
- Token (`apps/web/src/styles/index.css`, helles Thema): `--color-ink-300: #cbc7c0`, `--color-ink-600: #63605b`. Die
  Steuerungsansicht nutzt das dunkle `.stage-contrast` nicht.
- Kontrast nachgerechnet (WCAG-Formel, relative Leuchtdichte):

  | Text | auf `surface` #ffffff (Zelle) | auf `accent-50` #eef3ff (aktive Zelle) | auf `ink-50` #f7f6f4 (Hover) | auf `canvas` #f4f3f1 |
  |---|---|---|---|---|
  | ink-300 #cbc7c0 (heute) | 1,68:1 | 1,52:1 | 1,56:1 | 1,52:1 |
  | ink-500 #83807a | 3,94:1 | 3,54:1 | 3,65:1 | 3,55:1 |
  | **ink-600 #63605b** | **6,26:1** | **5,63:1** | **5,80:1** | **5,64:1** |

  Grau 600 besteht auf jedem Grund, auf dem eine Zelle stehen kann; ein Ersatztoken ist nicht nötig. Grau 500 fiele durch
  (deshalb nicht „eine Stufe heller als 600").
- Weitere Nullen in Grau 300 (nicht Teil dieser Scheibe, siehe Nicht-Ziele): `apps/web/src/components/ProcessStrip.tsx:188/192`
  (nur im Modus ohne `compact`/`dense`; heute nutzt keine Ansicht diesen Modus: die Kopfleiste ist `dense`, die Arbeitsliste
  `compact` und blendet Nullen aus) und `apps/web/src/features/speakers/SpeakerRow.tsx:176` (Fragenzahl 0 in der
  Wortmeldeliste, nicht Steuerungsansicht).

**Teil 2 — Vorbelegung.**

- Fokusansicht (`apps/web/src/features/focus/focus.ts`): `draftBase` nimmt die letzte Version (`answerBodyOf(latest)`, Quellen
  mit „; " verbunden); ist die letzte Version eine Verweigerung, beginnt das Feld leer (`baseBody: null`, `baseVersion` = deren
  Nummer). `isDirty` vergleicht das Vorschau-Dokument und die Quellen mit der Basis (Marke zählt, Leerraum nicht).
  `writingOutcome` regelt eine neuere Version: eigene gespeicherte Version → Basis nachziehen ohne Neuaufbau; fremde über
  unverändertem Entwurf → still neu vorbelegen (`generation + 1`); fremde über verändertem Entwurf → Hinweis `focus-rebase`,
  Text bleibt. `WritingMode`: `canSave = mayDraft && dirty && text !== '' && !busy`. Nach dem Speichern wird die Basis das
  Gesendete (`focus/Page.tsx`, `save`).
- Beantwortung (`apps/web/src/features/answers/QuestionDetail.tsx`): `draft` beginnt `null`; `dirty = previewText(draft) !== ''`
  entscheidet die primäre Aktion; „Verwerfen" und der Neustart nach dem Speichern (`draftResetToken`) leeren das Feld
  (`generation + 1`). `AnswerEditor.tsx` sperrt Speichern nur bei `busy || empty`.
- Kern (`packages/domain/src/api.ts` `draftAnswer`, `state.ts` `AnswerDrafted`): **jede** neue Version, auch eine wortgleiche,
  wird angelegt und löscht `approval`, `legalClearance`, `legalClearerIds`, `returnReason`; der Status geht auf
  `answer_drafted`. Es gibt keinen Schutz gegen eine unveränderte Version im Kern.
- `If-Match` (`useWriteDoor.ts`): `etagOf(question.version)` des **beim Klick gezeigten** Datensatzes. Er schützt gegen einen
  Datensatz, der sich zwischen letztem Lesen und Schreiben bewegt hat, **nicht** gegen einen Entwurf, der auf einer älteren
  Antwortversion begonnen wurde: der Datensatz auf dem Schirm ist dann schon der neuere.

**Folge, wenn man naiv vorbelegt:** (a) `dirty` wäre immer wahr → „Antwort speichern" wäre immer primär und verdrängte
„Zur Prüfung", „Freigeben", „Auf die Bühne"; (b) ein Enter auf Speichern legte eine wortgleiche Version an und höbe eine
Freigabe still auf; (c) eine fremde neuere Version unter dem vorbelegten Feld würde beim Speichern still mit dem alten
Wortlaut überschrieben. Diese Spec schließt alle drei aus.

## Ziel

### Teil 1 — Nullzähler in Grau 600

In `DistributionPanel.tsx` (`Count`) zeigt eine Zelle mit dem Wert 0 ihre Zahl in `text-ink-600` statt `text-ink-300`, in
allen drei Zellarten (Fachbereich, „Ohne Fachbereich", Bühnenplatz) und in jedem Zustand (normal, Hover, aktiv). Werte > 0
bleiben `text-ink-900`. Die Unterscheidung „Null tritt zurück" bleibt erhalten (6,3:1 gegen rund 16:1), ohne Farbfläche (D4).
Der Kommentar von `Count` nennt die Entscheidung (053 Zusatz D4, 05.10.2026) statt „like the process strip".

### Teil 2 — Beantwortung beginnt mit der letzten Version

Entscheidungen (keine bleibt dem Implementierer überlassen):

1. **Welche Version.** Dieselbe Basis wie die Fokusansicht, aus derselben Funktion: `draftBase(question)` aus
   `features/focus/focus.ts`. Also die letzte Antwortversion mit ihrem Dokument (`answerBodyOf`) **und** ihren Quellen; ohne
   Version leer (`baseVersion` 0). **Ist die letzte Version eine Verweigerung, beginnt das Feld leer** (Platzhalter sichtbar,
   Hinweis `answer-editor-refusal-hint` wie heute), `baseVersion` = Nummer der Verweigerung. Begründung: Der Wortlaut einer
   Verweigerung (Textbaustein des Grunds, 045) ist kein Anfang einer Antwort; ihn vorzubelegen lädt dazu ein, ihn als Antwort
   zu speichern. Auch die letzte *Antwort* vor der Verweigerung wird nicht vorbelegt: Parität mit der Fokusansicht und keine
   zweite Regel „welche Version zählt"; die ältere Antwort bleibt in der Versionsliste lesbar.
2. **Wann.** Beim Aufbau des Details (die Komponente ist je Frage geschlüsselt, `key={question.id}`); zu diesem Zeitpunkt gibt
   es keinen lokalen Entwurf. Danach ersetzt die Vorbelegung **nie** einen veränderten Entwurf:
   - Ein neuer Datensatz derselben Frage wird **während des Renderns** (nicht in einem Effekt, takt-008) mit
     `writingOutcome(draft, question)` abgeglichen: `keep` → nichts; `rebase` mit `reseed: false` (eigene Version gleichen
     Inhalts) → Basis nachziehen, Feld nicht neu aufbauen; `rebase` mit `reseed: true` (fremde Version, Entwurf unverändert)
     → Feld zeigt die neue Version (`generation + 1`); `notice` (fremde Version, Entwurf verändert) → Text bleibt, über dem
     Feld steht `StaleBanner` mit `testId="answer-editor-rebase"` und Text `answers.editor.rebase`; dessen „Neu laden" legt
     den Entwurf aus der neuen Basis an (`generation + 1`). `end` (kein `answer.draft` mehr) → Entwurf bleibt unverändert
     (das Feld ist dann ohnehin nicht gezeigt; heutiges Verhalten).
   - **Akteurwechsel (090, 010d Ziel 1):** Das Detail vergleicht `useActor().id` während des Renderns wie `answers/Page.tsx`
     und legt bei einem Wechsel einen neuen Entwurf aus dem Datensatz an (`generation + 1`, Quellen aus der Basis). Der neue
     Akteur sieht den Stand des Datensatzes, nie den Text des vorigen. Bestehender Reset-Mechanismus bleibt oder wird dadurch
     ersetzt; der Bericht nennt, welcher greift.
   - **„Verwerfen"** stellt die Basis wieder her (Feld = letzte Version bzw. zuletzt Gespeichertes, Quellen ebenso,
     `generation + 1`), nicht ein leeres Feld. Der Knopf erscheint nur, wenn der Entwurf verändert ist.
   - Später: Ein gepufferter Entwurf aus 060 geht der Vorbelegung vor (Hinweis an 060, nicht hier gebaut).
3. **Verändert / Speichern.** `dirty = isDirty(draft)` (aus `focus.ts`) ersetzt `previewText(draft) !== ''` sowohl für die
   primäre Aktion als auch für das Speichern. `canSave = mayDraft && dirty && previewText(body) !== '' && !busy` (wie
   `WritingMode`). `AnswerEditor` erhält statt der eigenen `empty`-Sperre ein Prop `canSave` (Knopf `aria-disabled={!canSave}`,
   weiter `aria-disabled` statt `disabled`, takt-008) und ein Prop `dirty` (zeigt „Verwerfen"). `onSave` in `QuestionDetail`
   prüft `canSave` selbst noch einmal, bevor es `onAction` ruft (Schutz für jeden weiteren Speicherweg).
4. **Unverändert absenden ist gesperrt, keine No-op-Version.** Ein vorbelegter, unveränderter Entwurf (auch nach reinem
   Leerraum) lässt sich nicht speichern; es entsteht keine Version, eine bestehende Freigabe bleibt. Eine **reine
   Markenänderung** oder **nur geänderte Quellen** sind eine Änderung (055 Entscheidung 7; 054) und dürfen gespeichert werden;
   dann gilt R-TRANS-03 wie heute (neue Version, Freigabe und Rechtsfreigabe erlöschen) und der vorhandene Hinweis
   `answers.editor.hint` steht weiter, sobald eine Freigabe besteht. Der Kern bleibt unverändert (siehe Nicht-Ziele, Frage 1).
5. **Primäre Aktion (D2).** Solange der Entwurf unverändert ist, bleibt die primäre Aktion die des Vorgangs („Zur Prüfung",
   „Rechtlich freigeben", „Freigeben", „Auf die Bühne" …, Reihenfolge wie heute); erst ein veränderter Entwurf macht
   „Antwort speichern" primär. Ohne jeden anderen Schritt bleibt Speichern primär, aber gesperrt, bis etwas geändert ist.
6. **Nach dem Speichern.** Wie die Fokusansicht: das Feld wird **nicht** geleert und nicht neu aufgebaut; die Basis wird das
   Gesendete (`previewAnswer(body)`, normalisierte Quellen, `baseVersion = max(baseVersion, answers.length + 1)` gemessen am
   Datensatz beim Absenden). Dazu merkt sich `onSave` das Gesendete; der vorhandene `draftResetToken` (nur `onScreen`, 010d
   Ziel 3) wendet es an. Was während des Speicherns getippt wurde, bleibt und zählt als Änderung. Trifft der neue Datensatz
   vor dem Token ein, macht `writingOutcome` dasselbe (`rebase`, `reseed: false`); beide Reihenfolgen enden gleich. Folge: im
   Render, der die Sperre löst, ist der Entwurf unverändert und Speichern gesperrt; ein zweites Enter speichert nichts
   (takt-008 bleibt erfüllt, Fokus bleibt auf dem Knopf).
7. **`If-Match` / Versionsbasis.** Keine Änderung an `useWriteDoor` und am Vertrag: `If-Match` bleibt die Version des beim
   Klick gezeigten Datensatzes. Den Fall „Entwurf auf älterer Antwortversion begonnen" fängt Punkt 2 (`notice`) in der
   Oberfläche ab, genau wie in der Fokusansicht. Speichern bleibt bei sichtbarem Hinweis möglich (Parität mit `WritingMode`):
   die Person hat die neuere Version gesehen und entscheidet bewusst.
8. **Ort des Codes.** Die Beantwortung nutzt die reinen Helfer `draftBase`, `newDraft`, `isDirty`, `writingOutcome` und den
   Typ `FocusDraft` aus `features/focus/focus.ts` (eine Umsetzung, Parität per Konstruktion). Die beiden Beantwortungs-eigenen
   Schritte stehen rein und testbar in der neuen Datei `features/answers/draft.ts`: `onRecord(draft, question)` (bildet
   `writingOutcome` ab, `end` → `keep`, liefert neuen Entwurf und ob der Hinweis steht) und `afterSave(draft, sent,
   savedVersion)` (Punkt 6) sowie `canSave`. Keine Abhängigkeitsregel verbietet `answers → focus`, kein Zyklus entsteht
   (`focus.ts` importiert nur `answers/refusal.ts` und `api/answerFormat.ts`); das Verschieben der Helfer nach `answers/`
   geht als Kandidat in die Folgeliste.

## Nicht-Ziele

- Keine Änderung an `ProcessStrip.tsx` (die Grau-300-Nullen dort sind in keiner Ansicht sichtbar) und an `SpeakerRow.tsx`
  (Wortmeldeliste, nicht Steuerungsansicht; Frage 2); beide als Folgeliste-Eintrag.
- Keine neuen Design-Token, keine Änderung an `index.css`, keine Änderung am dunklen Bühnenthema.
- Keine Kern-, Vertrags- oder Ereignisänderung: kein Guard „wortgleiche Version" in `draftAnswer` (Frage 1), keine Änderung an
  R-TRANS-03/R-GUARD-04, an Rechten, Übergängen, Seed.
- Keine Änderung an der Fokusansicht (`focus.ts`, `WritingMode.tsx`, `focus/Page.tsx`) außer dass `answers/` aus `focus.ts`
  importiert; kein Verschieben der Helfer.
- Keine Änderung an `useWriteDoor.ts`, `answers/Page.tsx`, `AnswerBodyEditor.tsx`, Steuerungsdetail.
- Kein Browser-Speicher (060), kein Vorbelegen mit der freigegebenen statt der letzten Version.
- Kein e2e-Fall für die fremde Version (die Demo hat keinen zweiten Schreiber im selben Tab); `onRecord` ist mit
  Einheitstests belegt wie `writingOutcome` in 054.

## Files allowed

Teil 1:

- `apps/web/src/features/steering/DistributionPanel.tsx` (nur `Count` und dessen Kommentar)
- `apps/web/src/features/steering/DistributionPanel.test.tsx`

Teil 2:

- `apps/web/src/features/answers/QuestionDetail.tsx`
- `apps/web/src/features/answers/QuestionDetail.test.tsx`
- `apps/web/src/features/answers/AnswerEditor.tsx`
- `apps/web/src/features/answers/draft.ts` (neu), `apps/web/src/features/answers/draft.test.ts` (neu)
- `apps/web/src/i18n/answers.de.ts`, `apps/web/src/i18n/answers.en.ts` (nur die neuen Schlüssel answers.editor.rebase und, Nachtrag des Orchestrators nach der Design-Kritik, answers.editor.startsFrom)
- `apps/web/src/i18n/parity.test.ts` (nur die Schlüsselzahl-Sperre 619→621 und ihr Kommentar; Nachtrag des Orchestrators 05.10.2026; Bauklärung: der neue
  Schlüssel scheitert sonst an `pnpm gates`, Vorbild takt-038/takt-039; im Bericht als Befund genannt)

Tests und Nachweise:

- `apps/web/e2e/takt-048-nullzaehler-vorbelegung.spec.ts` (neu, Projekt in-process)
- `apps/web/e2e/010d-ansichtsdaten.spec.ts` (nur die Erwartung „Editor leer nach dem Speichern" im Test „010d Runde 2 (N1)" und
  ihr Kommentar)
- `apps/web/e2e/055b-antwortformat.spec.ts` (nur Schritt A4 und, falls rot, der Akteurwechsel-Test am Dateiende)
- `apps/web/e2e/090-eingaben-je-akteur.spec.ts` (nur der Test „Antwortentwurf", und nur falls rot)
- `apps/web/e2e/013-tastaturpfad.spec.ts` (nur die Kommentare „emptied editor" an den beiden Speicherstellen)
- `docs/evidence/takt-048-nullzaehler-de.png`, `docs/evidence/takt-048-nullzaehler-en.png`,
  `docs/evidence/takt-048-vorbelegung-de.png`, `docs/evidence/takt-048-vorbelegung-en.png`
- `docs/folgeliste.md` (055b-Sammeleintrag „Vorbelegen" als erledigt markieren; neue Einträge aus dieser Spec)
- `docs/slices/takt-048-nullzaehler-vorbelegung.md` (Bericht, Design-Kritik, Review findings)

## Ausdrücklich nicht erlaubt

`packages/**`, `apps/api/**`, `apps/web/src/features/focus/**`, `apps/web/src/components/**`, `apps/web/src/styles/**`,
`useWriteDoor.ts`, `answers/Page.tsx`, `playwright.config.ts`, `axe-exceptions.json` (keine neue Ausnahme), andere e2e-Dateien,
`scripts/`.

## Tests zuerst

Einheit (vitest, ohne jsdom, statisches Rendern wie heute):

- **U1 `DistributionPanel.test.tsx`:** Zellen mit 0 (Fachbereich, „Ohne Fachbereich", Bühnenplatz, auch die aktive
  Fachbereichszelle) tragen an der Zahl `text-ink-600` und nirgends `text-ink-300`; Zellen > 0 `text-ink-900`. Rot vorher.
- **U2 `draft.test.ts`, Start (Parität):** Für dieselbe Frage ist der Startentwurf der Beantwortung in `body`, `sources`,
  `baseVersion`, `baseBody` gleich `newDraft(...)` der Fokusansicht; Fälle: keine Version (leer, 0), letzte Version mit Marke
  und zwei Quellen (Dokument und „a; b"), letzte Version eine Verweigerung (leer, deren Nummer).
- **U3 `canSave`:** unverändert → false; nur Leerraum angehängt → false; nur eine Marke → true; nur Quellen → true; Feld
  geleert → false; `busy` → false; ohne `answer.draft` → false.
- **U4 `onRecord`:** eigene Version gleichen Inhalts → kein Neuaufbau, unverändert, kein Hinweis; fremde Version über
  unverändertem Entwurf → `generation + 1`, Feld = neue Version; fremde über verändertem → Text bleibt, Hinweis steht;
  zweite fremde Version bei stehendem Hinweis → bleibt; ohne `answer.draft` → Entwurf unverändert.
- **U5 `afterSave`:** Basis = Gesendetes, `baseVersion` = max; während des Speicherns zusätzlich Getipptes bleibt verändert;
  `afterSave` dann `onRecord` mit der eigenen Version und umgekehrt ergeben denselben Entwurf.
- **U6 `QuestionDetail.test.tsx`:** Frage mit letzter Antwortversion und `['answer.draft', 'question.submit_review']`: kein
  Platzhalter, `answer-submit-draft` `aria-disabled="true"`, „Zur Prüfung" ist primär, kein „Verwerfen". Letzte Version eine
  Verweigerung: Platzhalter und Hinweis. Der bestehende Test „AnswerEditor remounted with a draft" wird auf die Props
  `canSave`/`dirty` umgestellt (gleiche Aussage).

e2e (Projekt in-process; Screenshots über `support/evidence.ts`, axe über `support/axe.ts` ohne neue Ausnahme):

- **N1 Steuerung (de, en):** Mindestens eine Zelle mit `data-count="0"` ist sichtbar (sonst scheitert der Test mit „keine
  Nullzelle im Seed" und der Bericht nennt das als Befund; der Seed wird nicht geändert); die berechnete Farbe ihrer Zahl ist
  `rgb(99, 96, 91)`; `checkAxe` grün (Durchgang b `color-contrast` mit der Nullzelle im Bild). Screenshots
  `takt-048-nullzaehler-de.png`/`-en.png`.
- **V1 Vorbelegt (de, en):** Frage im Status „Entwurf" mit mindestens einer Antwortversion: Feldtext = Text der
  `answer-version`-Karte der letzten Version, `answer-sources` = deren Quellen mit „; ", Speichern `aria-disabled="true"`,
  „Zur Prüfung" primär, kein „Verwerfen", axe grün. Screenshots `takt-048-vorbelegung-de.png`/`-en.png`.
- **V2 Ändern und Verwerfen:** ein Leerzeichen am Ende → Speichern bleibt gesperrt; ein Wort am Ende → Speichern offen und
  primär, „Verwerfen" da; „Verwerfen" → Feld = letzte Version, Speichern gesperrt.
- **V3 Speichern:** geändert speichern → eine Version mehr, Feld zeigt den gespeicherten Text, Speichern
  `aria-disabled="true"`, Fokus sichtbar auf dem Knopf; ein zweites Enter ruft `draftAnswer` nicht noch einmal (Zähler wie in
  010d).
- **V4 Freigegeben:** freigegebene Frage mit `answer.draft` (Rolle nach `_actions` wählen, nie nach Namen im Code der
  Oberfläche): Feld vorbelegt, Hinweis `answers.editor.hint` sichtbar, Enter auf Speichern → kein `draftAnswer`-Aufruf, die
  Freigabe steht weiter; alles markieren und Strg+B → Speichern offen (nicht absenden).
- **V5 Verweigerung als letzte Version:** Feld leer mit Platzhalter, Hinweis `answer-editor-refusal-hint`.
- **V6 Akteurwechsel:** auf einer Frage mit Version Text anhängen, Rolle wechseln und zurück → Feld = letzte Version, der
  angehängte Text ist nirgends in `#main`.

Angepasste Erwartungen bestehender Fälle: 010d „Runde 2 (N1)": Editor zeigt nach dem Speichern „Entwurf zu A." statt leer,
Speichern gesperrt; 055b A4: Feld beginnt mit Version 1 (kein Platzhalter), vor dem Einfügen alles markieren, nach dem
Speichern zeigt das Feld Version 2; 013: nur Kommentare. 090 und der Akteurwechsel-Test in 055b wählen Fragen im Status
„zugewiesen" ohne Version und sollten unverändert grün bleiben; werden sie rot, erwarten sie die Vorbelegung statt leer.

## Akzeptanzkriterium

1. U1–U6 und N1, V1–V6 grün; angepasste Fälle grün; rot vorher für U1, U3, U6, V1, V2, V4 (Bericht nennt den Commit des roten
   Laufs und die Fehlerzeile).
2. Keine neue axe-Ausnahme; N1 und V1 mit axe in beiden Sprachen.
3. Vier Screenshots unter `docs/evidence/` (Nullzelle sichtbar; vorbelegtes Feld mit gesperrtem Speichern und primärem
   „Zur Prüfung").
4. Design-Kritik D1–D10 als Tabelle im Bericht (mindestens D2 primäre Aktion, D4 Farbe nur mit Bedeutung, D7 neuer Schlüssel
   de/en, D8 Fokus nach Speichern), vor dem Review.
5. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich); `pnpm --filter @hv/web e2e` für die berührten Dateien grün;
   CI des PR grün einschließlich `e2e-http`.
6. Der Bericht nennt: welcher Akteurwechsel-Reset greift (Ziel 2), die Zahl der Abhängigkeitswarnungen vorher/nachher, und
   die Folgeliste-Einträge.

## Wirkung und Risiko (Leitplanken §4, mittel)

- **Warum nicht niedrig:** Teil 2 ändert Verhalten (Startinhalt, Speichersperre, primäre Aktion) auf dem Weg, auf dem eine neue
  Antwortversion entsteht, und eine neue Version hebt eine Freigabe auf (R-TRANS-03). Fehler hier wären still: eine
  aufgehobene Freigabe oder ein überschriebener fremder Wortlaut.
- **Warum nicht hoch:** Freigaberegel, Guard, Ereignis, Rechte und Vertrag bleiben unverändert; die Oberfläche wird nur
  strenger (sie bietet weniger Speichern an als heute: nie unverändert). Der Eigentümer darf hochstufen (dann Lesebefund vor
  dem Bau, rund 0,3 AStd).
- **Risiken und Abfang:** unverändertes Absenden → `canSave` (U3, V2, V4); veralteter vorbelegter Stand → `onRecord`/Hinweis
  (U4); Doppelspeichern nach dem Speichern → Basis = Gesendetes in beiden Reihenfolgen (U5, V3); Text eines anderen Akteurs →
  Reset je Akteur (V6). Ein HTTP-Client außerhalb der Oberfläche kann weiter wortgleiche Versionen anlegen (Frage 1).
- **Doku/Betrieb:** keine Betriebswirkung. 055b §7 („beginnt leer") und Nicht-Ziel „Kein Vorbelegen" sind durch die
  Eigentümerentscheidung überholt; die Kommentare in `AnswerEditor.tsx`/`QuestionDetail.tsx` werden entsprechend geändert.

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche, Barrierefreiheit · [ ] Fachregel, Status (Regel unverändert, nur der Weg dorthin) · sonst nichts
Perspektive(n) und Rolle: UX/Barrierefreiheit (Design-Kritik), Freigabebindung (Reviewer) · Nachweise: siehe Akzeptanzkriterium
· Offene Entscheidung: Fragen 1 und 2 unten, beide mit Standard

## Aufwand

1,0 AStd (Teil 1 0,1; Teil 2 mit `draft.ts`, Tests und angepassten e2e-Fällen 0,7; Screenshots, Design-Kritik, Bericht 0,2).
Die 0,2 AStd aus 055b galten für das bloße Vorbelegen ohne Speichersperre und Abgleich.

## Offene Fragen an den Eigentümer (blockieren nicht; Standard gilt)

1. **Wortgleiche Version im Kern ablehnen?** Standard: nein in dieser Scheibe; die Oberfläche sperrt. Option: neuer Guard an
   R-TRANS-03 („Version unterscheidet sich von der letzten", Dokument per `sameBody`, Quellen normalisiert) mit 409 und
   Regel-id, Vertragsänderung vorab (AGENTS.md R6) — eigene Scheibe, Risikoklasse hoch (Freigabe), rund 0,6 AStd.
2. **Grau 600 auch für die Fragenzahl 0 in der Wortmeldeliste** (`SpeakerRow.tsx`, heute 1,7:1)? Standard: Folgeliste,
   Sammelgang. Option: in diese Scheibe aufnehmen (+0,05 AStd, Datei und Screenshot ergänzen).

## Hinweise an den Orchestrator

- Plan §5 takt-048 führt „niedrig"; diese Spec stuft auf **mittel** (Hochstufen braucht keine Freigabe, Leitplanken §4).
  Plan-Zeile bei Gelegenheit angleichen, Aufwand 1,0 AStd ergänzen.
- 055b §7 und Nicht-Ziel „Kein Vorbelegen" tragen bereits die Entscheidung vom 05.10.2026; keine weitere Spec-Änderung nötig.

## Hinweise an Folgescheiben

- **060 (Entwurfspuffer):** puffert in der Beantwortung denselben `FocusDraft` (Eingabeform plus Basis); ein wiederhergestellter
  Puffer geht der Vorbelegung vor, danach gilt `onRecord` gegen den aktuellen Datensatz.

## Bericht

```
Slice: takt-048-nullzaehler-vorbelegung
Done: Nullzähler der Verteilung in Grau 600 (6,26:1 auf der Zelle, 5,63:1 aktiv). Beantwortung beginnt mit der letzten
      Antwortversion (leer bei Verweigerung), Speichern nur bei Änderung, Basis nach dem Speichern = Gesendetes, Hinweis bei
      fremder neuerer Version; Helfer aus focus.ts, Abgleich in answers/draft.ts.
Evidence: pnpm gates auf f15442d (Exit 0), Schluss siehe unten; docs/evidence/takt-048-nullzaehler-{de,en}.png,
      docs/evidence/takt-048-vorbelegung-{de,en}.png; e2e-Lauf der berührten Dateien (in-process) 68 bestanden, 1 übersprungen
      (055b H1, nur http); Gegenprobe 003, 021c, 040a, 045, 053, 054, abnahme: 29 bestanden
Open: Befund Umfang: apps/web/src/i18n/parity.test.ts (Schlüsselzahl 619→620) fehlte in „Files allowed“; ohne die Zeile
      scheitert pnpm gates am neuen Schlüssel. In e76aa67 ergänzt (Liste und Datei, nur diese Zeile), slice-scope meldet
      die geänderte Liste als Warnung. CI des PR (einschließlich e2e-http) steht aus (nicht gepusht).
Touched: apps/web/src/features/steering/DistributionPanel.tsx, DistributionPanel.test.tsx,
      apps/web/src/features/answers/QuestionDetail.tsx, QuestionDetail.test.tsx, AnswerEditor.tsx, draft.ts (neu),
      draft.test.ts (neu), apps/web/src/i18n/answers.de.ts, answers.en.ts, parity.test.ts (Befund oben),
      apps/web/e2e/takt-048-nullzaehler-vorbelegung.spec.ts (neu), 010d-ansichtsdaten.spec.ts (N1-Erwartung),
      055b-antwortformat.spec.ts (A4), 013-tastaturpfad.spec.ts (zwei Kommentare), docs/evidence/takt-048-*.png (4),
      docs/folgeliste.md, diese Spec
```

**Commits:** `029c448` (Bau), `e76aa67` (Schlüsselzahl, Befund), `f15442d` (Markierung `i18n-ok` im Testmuster, von
`pnpm i18n-literals` verlangt), danach dieser Bericht (nur Doku).

**Rot vorher (auf `8ba5a97`, Tests vor der Änderung):**

- U1: `AssertionError: expected '<span class="min-w-5 text-right font-…' to contain 'text-ink-600'`
- U3/U4/U5 (`draft.test.ts`): `Error: Cannot find module './draft'` (die Datei gab es noch nicht)
- U6: `AssertionError: expected '<section class="flex min-h-0 flex-col…' not to contain 'answer-editor-placeholder'`
- N1: `expect(locator).toHaveCSS(expected) failed · Expected: "rgb(99, 96, 91)" · Received: "rgb(203, 199, 192)"`
- V1, V2, V6: `Expected: "DerBestätigungsvermerkbenennt…" · Received: ""` (Feld leer statt letzter Version)
- V3: `Expected: "Gespeichert048." …` (Feld war leer, nur der angehängte Text stand darin)
- V4: `Expected: "AufBasisdesJahresschlusskurses…" · Received: ""`
- V5 war vorher schon grün (eine Verweigerung begann auch vorher leer; der Fall sichert das neue Verhalten ab).

**Grün nachher:** Einheit `DistributionPanel`, `answers/`, `focus/` 15 Dateien, 251 Tests bestanden; e2e
`takt-048-nullzaehler-vorbelegung.spec.ts` 7 von 7 bestanden, zusammen mit 010d, 013, 055b, 090: 68 bestanden, 1 übersprungen.
090 und der Akteurwechsel-Test in 055b (A6) blieben unverändert grün.

**Akteurwechsel-Reset (Ziel 2):** Zwei Wege, beide vorhanden. In der Demo greift zuerst der bestehende: `useBacklog` hält
den gewählten Datensatz je Akteur (010d Ziel 1), beim Wechsel ist `question` kurz `null`, das Detail wird abgebaut und beim
Wiederaufbau aus dem Datensatz neu vorbelegt (`startDraft`). Der neue Vergleich `useActor().id` im Render von
`QuestionDetail` greift, wenn das Detail beim Wechsel stehen bleibt (der Datensatz des neuen Akteurs ist schon da); er legt
einen neuen Entwurf mit `generation + 1` an. Welcher Weg in V6 zuerst griff, ist nicht einzeln gemessen; V6 belegt das
Ergebnis (Feld = letzte Version, angehängter Text nirgends in `#main`).

**Abhängigkeitswarnungen (`pnpm arch`):** vorher 14 (Quellstand `8ba5a97`), nachher 14; die neuen Importe
`answers → focus/focus.ts` und `answers → api/actor.ts` lösen keine Warnung aus.

**Folgeliste:** 055b-Sammeleintrag „Vorbelegen der Beantwortung“ als erledigt markiert; neu: Helfer aus `focus.ts` nach
`answers/` verschieben; Kern-Guard „wortgleiche Version“ (Frage 1); doppelte Quellen-Normalisierung in `draft.ts`; Abschnitt
„Kontrast der Nullzähler“ mit `ProcessStrip.tsx` und `SpeakerRow.tsx` (Frage 2).

**Abweichungen von der Spec, benannt:**

- Die primäre Aktion im Status „Entwurf“ heißt in der Oberfläche „Weiterleiten“ / „Forward“ (`question.submit_review`,
  E5), nicht „Zur Prüfung“; geprüft ist der Knopf `answer-submit-review`.
- `draft.ts` hat zusätzlich `startDraft` (für U2) und `discard`: „Verwerfen“ stellt die Basis her und zieht, wenn der
  Hinweis stand, gleich auf die neuere Version nach, damit das Feld nach „Verwerfen“ nie eine überholte Version zeigt.
- U6 prüft den Feldinhalt über das Fehlen des Platzhalters und von `aria-placeholder`: das Feld schreibt seinen Inhalt in
  einem Effekt, im statischen Rendern steht er nicht.
- `normalSources` steht in `draft.ts` ein zweites Mal (in `focus.ts` nicht exportiert, `focus/**` gesperrt); Folgeliste.

**Schluss von `pnpm gates` auf `f15442d` (Exit 0):**

```
> @hv/web@0.0.0 build /home/user/wt/takt048/apps/web
> tsc -b && vite build
...
✓ built in 2.45s
mark-test-run: wrote /home/user/wt/takt048/.claude/state/last-test-run (clean tree) at commit f15442d, tree 112328d00a71…
```

### Nachbesserung nach Design-Kritik (05.10.2026)

Major D1 / Prinzip 5: das vorbelegte Feld sagte nicht, dass es mit der letzten Version beginnt, und das gesperrte
„Entwurf speichern“ hatte keine Erklärung. Behoben in `6acdec9`:

- Solange der Entwurf von einer Version ausgeht (`baseBody` vorhanden, `baseVersion` > 0) und unverändert ist, steht unter
  der Überschrift eine Zeile in `text-ink-600` (`answer-editor-start`): „Beginnt mit Version {n}. Speichern, sobald Sie etwas
  ändern.“ / „Starts from version {n}. Save once you change something.“ (neuer Schlüssel `answers.editor.startsFrom`,
  Schlüsselzahl 620→621). Der gesperrte Knopf trägt `aria-describedby` auf diese Zeile. Ohne Version, über einer
  Verweigerung und nach einer Änderung keine Zeile und kein `aria-describedby`.
- Rot vorher (auf `46c97fc`): Einheit `TypeError: Cannot read properties of undefined (reading 'replace')` (Schlüssel fehlte)
  und `AssertionError: expected '' not to be ''`; e2e V1 `Expected: "Beginnt mit Version 1. Speichern, sobald Sie etwas
  ändern." · element(s) not found`, V2 `toBeVisible() failed · element(s) not found`. Grün nachher: Einheit 19 Dateien,
  317 Tests; e2e takt-048 mit 010d, 055b, 090: 59 bestanden, 1 übersprungen (055b H1, nur http). Screenshots
  `takt-048-vorbelegung-{de,en}.png` neu, mit der Zeile.
- Im selben Commit: Bezeichner `secret` in der e2e-Datei heißt `typedText` (CI-Semgrep `hardcoded-credential-literal`),
  `tokenFirst` in `draft.test.ts` heißt `resetFirst`. Semgrep 1.177.0 lokal über die 14 geänderten .ts/.tsx-Dateien:
  0 Befunde.
- `pnpm gates` auf `6acdec9`: Exit 0. Zwei frühere Läufe scheiterten an Postgres-Zeittests in `apps/api`, weil die
  Gates des Worktrees takt049 zur selben Zeit dieselbe Datenbank `hv_test` nutzten; der grüne Lauf nutzte eine eigene
  Datenbank `hv_test_t048` (gleicher Eigentümer, migriert). Schluss:

```
✓ built in 2.65s
mark-test-run: wrote /home/user/wt/takt048/.claude/state/last-test-run (clean tree) at commit 6acdec9, tree 402b0933f9d0…
```

## Design-Kritik

| D | erfüllt | Beleg |
|---|---|---|
| D1 | ja (nach Nachbesserung) | Das Feld nennt die Version, mit der es beginnt, und warum Speichern gesperrt ist (`answers.editor.startsFrom`, `aria-describedby`); „Verwerfen“ erscheint erst mit einer Änderung, der Hinweis bei fremder Version steht direkt über dem Feld. |
| D2 | ja | Unverändert bleibt die Vorgangsaktion primär („Weiterleiten“ in V1, Screenshot); erst eine Änderung macht „Entwurf speichern“ primär (V2, U6). Ohne anderen Schritt bleibt Speichern primär, aber gesperrt. |
| D3 | ja | Kein neues Layout; der Hinweis nutzt `StaleBanner` wie die Fokusansicht und das „Stand veraltet“. |
| D4 | ja | Null tritt in Grau 600 zurück (6,26:1, aktiv 5,63:1, gegen rund 16:1 für Werte > 0), keine Farbfläche; N1 mit axe `color-contrast` in beiden Sprachen grün, keine neue Ausnahme. |
| D5 | ja | Zahl der Zelle weiter Mono und rechtsbündig. |
| D6 | ja | Ohne Version und über einer Verweigerung: leeres Feld mit Platzhalter und Hinweis (U6, V5). |
| D7 | ja | Zwei neue Schlüssel `answers.editor.rebase` und `answers.editor.startsFrom` in de und en, Hausvokabular („Antwortversion“); `pnpm vocabulary` und `pnpm i18n-literals` grün. |
| D8 | ja | Nach dem Speichern bleibt der Fokus sichtbar auf dem gesperrten Knopf, ein zweites Enter ruft `draftAnswer` nicht (V3); Enter auf dem unveränderten Entwurf schreibt nichts (V4). |
| D9 | ja | Der Abgleich ist ein Vergleich je neuem Datensatz der gezeigten Frage (`sameBody`), keine Listenarbeit. |
| D10 | ja | Keine neue Bedienfläche; weniger Speichern-Angebote als vorher, nichts Neues zu lernen. |

## Review findings

(leer)
