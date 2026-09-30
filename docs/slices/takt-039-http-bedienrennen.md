# takt-039 — Bedienrennen im HTTP-Modus: „Vorgelesen, weiter“ wirkt beim ersten Druck, Umsortieren per Tastatur

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung im Web, kein Hoch-Auslöser; Leitplanken §4) · **Lanes:** web, e2e · **Perspektive:** Nebenläufigkeit (6.3), UX/Barrierefreiheit (6.9)
**Rolle:** web-implementer; Review in frischem Kontext (Perspektive Nebenläufigkeit und Bühne), Modell nur in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R4 (kein Rollenname, Angebot nur aus `_actions`), R6 (nur `HvApi`), R10 (keine neuen Texte vorgesehen; falls doch, DE und EN), R12; ADR 0002 (zwei Betriebsarten, gleiches Verhalten); Designprinzipien 5, 7, 8, 10 (`docs/design-prinzipien.md:24-35`); takt-008 (Sperre mit `aria-disabled`, Fokus bleibt); Slice 010c Ziel 6 (N1–N3); Review 3 Minor 4 und Codex P2-B auf 948a721 (kein Datensatz eines anderen Akteurs); takt-032 (`data-busy` an `speakers-round-N`); takt-033b (ein Abruf je Einhängen, H10); E56 (CI-Artefakt als Bildnachweis)
**Quellen-IDs:** CI-Job `e2e-http` rot auf dem unveränderten Integrationszweig `9f5cb08`: Diagnose-PR #103, Lauf 36703114671, gleich dem Neulauf auf PR #102. Tests `apps/web/e2e/abnahme.spec.ts:248-253` (3 von 4 Läufen rot) und `apps/web/e2e/002-speakers-capture.spec.ts:80-84` (1 von 3 Läufen rot), beide nur im Projekt `http`
**Depends on:** keine offene Scheibe; Basis ist der Integrationszweig ab `9f5cb08`
**Glossar: neue Begriffe:** nein

## Befund 1: „Vorgelesen, weiter“ (`stage-next`) bleibt beim ersten Druck wirkungslos

Beobachtet: Nach dem Wechsel auf `/stage` bewirkte der erste Klick auf `stage-next` nichts. Die Nummer blieb 5 s lang
bei F-0116, F-0055, F-0055. Im Projekt `in-process` ist derselbe Test grün.

**Gesichert durch Lesen des Codes (Stand `9f5cb08`):**

1. `deliver()` (`apps/web/src/features/stage/Page.tsx:406-440`) kehrt an drei Stellen ohne Schreiben und ohne Hinweis
   mit `false` zurück: `stageRef.current?.current` fehlt (`:407-408`), `_actions` enthält `question.deliver` nicht
   (`:409`) oder `writing.current !== null` (`:410`). Der Knopf (`Podium.tsx:296-306`) wird aber nur nach
   `busy = stageBusy` (`Page.tsx:204`) als gesperrt gezeichnet (`aria-disabled`, `Podium.tsx:64`). Keine der drei
   Bedingungen erscheint im gezeichneten Zustand. Der Knopf sieht bedienbar aus, während der Handler ablehnt.
2. `stageRef` ist nicht der gezeichnete Stand, sondern läuft ihm nach:
   - Er wird nur in einem passiven Effekt gesetzt (`Page.tsx:220-223`).
   - React 19.2 plant passive Effekte nach dem Commit als eigene Aufgabe mit normaler Priorität ein
     (`react-dom-client.production.js:11493-11500`, `scheduleCallback$1(NormalPriority$1, … flushPassiveEffects …)`).
   - Ein diskretes Ereignis wie ein Klick räumt anstehende passive Effekte vor dem Handler nicht ab
     (`dispatchDiscreteEvent`, `:15263ff.`).
   - Ein Klick zwischen dem Commit, der die Nummer zeigt, und dieser Aufgabe liest deshalb den alten Wert. Beim ersten
     Laden ist das `null`.
3. Jede Lesung setzt `stageRef.current = null` (`Page.tsx:274`), bis ihre Antwort da ist. Der sichtbare Stand bleibt
   absichtlich stehen (Designprinzip 8).
   - Lesungen folgen jedem Anstieg von `useApiVersion`: dem 30-s-Takt (`apps/web/src/api/http.ts:219-226`) und jedem
     eigenen erfolgreichen Schreiben irgendeiner Ansicht (`http.ts:156-161`, takt-030).
   - Im HTTP-Modus dauert dieses Fenster so lange wie `GET /v1/stage`, im Demo-Modus löst die Lesung im selben Takt
     auf.
   - Ein Druck auf den Knopf oder die Leertaste (`Page.tsx:482-485`, gleicher Handler) in diesem Fenster geht
     stillschweigend verloren. Das ist ein Produktfehler unabhängig von diesem Test: Er trifft die Person auf der Bühne
     alle 30 s. Er verletzt Designprinzip 5 (Zustände sind sichtbar) und 7 (Leertaste weiter).
4. `writing.current` wird erst in einem passiven Effekt geleert (`Page.tsx:232-234`), nachdem der Render die Sperre
   schon aufgehoben hat (`Page.tsx:226-231`). Das ist dasselbe Muster: Der Knopf ist wieder frei gezeichnet, der Handler
   lehnt noch ab.

**Für den ersten Druck nach dem Einhängen:**

- Bedingung 2 scheidet aus: Der Knopf wird nur gezeichnet, wenn der gezeichnete Datensatz `question.deliver` trägt
  (`Podium.tsx:176`, `:296`).
- Bedingung 3 scheidet aus: `writing` ist beim frischen Einhängen `null`, und `asRole` lädt im HTTP-Modus die Seite neu.
- Eine zweite Lesung nach dem Einhängen gibt es nicht. Das belegt H10 in `031-http-betriebsart.spec.ts:331-360`:
  genau ein `GET /v1/stage` je Einhängen. Kein anderes Modul schreibt auf dem Weg nach `/stage`.
- Übrig bleibt nach Code allein Punkt 2: der Nachlauf des passiven Effekts.

**Hypothesen (nicht belegt):**

- **H-1a (führend):** Der Klick aus Playwright fiel in das Fenster aus Punkt 2. Auf dem CI-Rechner laufen Postgres,
  Keycloak, Hono, `vite preview` und Chromium nebeneinander, deshalb kann die Aufgabe für die passiven Effekte spät
  laufen.
- **H-1b:** Der Klick hat geschrieben, das Schreiben wurde abgelehnt (Toast, `reload()`, `Page.tsx:430-437`), und die
  neue Lesung zeigt dieselbe Nummer. Dafür fehlt im Code jeder Anlass: keine fremden Schreiber, ein Worker,
  `fullyParallel: false`. Ausschließen lässt es sich ohne Fehlerbild nicht. Die Fehlerbilder des Projekts `http` liegen
  im privaten Zustandsverzeichnis der Hilfsumgebung und werden nicht hochgeladen (`apps/web/playwright.config.ts:53-56`).

## Befund 2: Umsortieren per Tastatur, ArrowDown ohne Wirkung (002)

Beobachtet: Nach dem Anheben mit der Leertaste blieb die Ansage 5 s lang bei „Position 6 von 7“. Weder „steht auf
Position 7 von 7“ noch „Verschieben abgebrochen“ erschien. Der Zug war also nicht abgebrochen. Der Pfeil hat ihn nur
nicht bewegt. Das geschah einmal in drei Läufen, nur im Projekt `http`.

**Gesichert durch Lesen des Codes:**

- Es gibt heute kein Produktsignal für „die Liste wird gerade neu gelesen“. `data-busy`/`aria-busy` an
  `speakers-round-N` (`RoundSection.tsx:66`) gilt nur, solange ein eigenes Umsortieren läuft (takt-032,
  `speakers/Page.tsx:139`). Beim Anheben läuft keins.
- Eine Auffrischung mit unveränderten Zeilen hält `id`, `key` und `disabled` jeder Zeile stabil
  (`SpeakerRow.tsx:66`, `RoundSection.tsx:151-166`). Nach Code bricht sie den Zug nicht ab. `SortableContext` misst nur
  neu, wenn sich die Reihenfolge der `id`s ändert.
- dnd-kit (`@dnd-kit/core` 6.3.1, `dist/core.esm.js`) hat zwei Stellen, an denen ein Pfeil still nichts bewegt:
  - `:1158`: Der Keydown-Hörer wird erst per `setTimeout` angehängt.
  - `:1175-1290`: Liegt das Ziel jenseits der Mitte des scrollbaren Vorfahren, scrollt der Sensor mit
    `scrollBehavior: 'smooth'` und kehrt ohne `handleMove` zurück (Kommentar „the scroll adjustment alone will trigger
    logic to auto-detect the new container“). Die Ansage ändert sich dann erst durch Scroll-Ereignisse. Bei 1440×900
    liegt Position 6 der offenen Runde 3 in der unteren Bildhälfte.
  - Außerdem gibt `sortableKeyboardCoordinates` `undefined` zurück, wenn `collisionRect` oder die Maße der Ziele fehlen.

**Hypothesen (nicht belegt, der Bau entscheidet sie durch Test):**

- **H-2a:** Eine Auffrischung, etwa der 30-s-Takt, landet zwischen Anheben und Pfeil. Nach Code unwahrscheinlich
  (siehe oben).
- **H-2b:** Der Pfeil trifft den Zweig „weich scrollen und zurückkehren“, und das Weiterziehen nach dem Scrollen
  bleibt aus.
- **H-2c:** Zwischen dem Messen des gezogenen Elements und dem Messen der Ziele verschiebt sich das Layout.

Der `setTimeout` aus `:1158` ist praktisch ausgeschlossen: Playwright drückt den Pfeil erst nach mehreren Rundreisen.

## Ziel

1. **Bühne: Was bedienbar aussieht, wirkt; was nicht wirkt, sieht gesperrt aus.**
   - Für Knopf und Leertaste gilt dieselbe reine Regel. Der Knopf ist genau dann ohne `aria-disabled`, wenn ein Druck
     schreiben würde.
   - Der Druck wirkt auf den Datensatz, der **gezeichnet** ist. Das Klickziel übergibt die Frage, mit der der Knopf
     gezeichnet wurde (`onNext(question)`).
   - Die Leertaste und „R“ lesen einen Ref, der in `useLayoutEffect` gesetzt wird. Der läuft im Commit, bevor der
     Browser ein Eingabeereignis zustellen kann.
   - Das Leeren beim Start jeder Lesung (`Page.tsx:274`) entfällt. Eine laufende Lesung nimmt der Bühne ihren
     Datensatz nicht mehr weg. Das `If-Match` mit der gelesenen Version schützt wie bisher: Ist der Stand inzwischen
     älter, kommen 412, Toast und Neuladen.
2. **Der Schutz aus Review 3 Minor 4 und Codex P2-B bleibt:** Nach einem Akteurwechsel wirkt kein Druck auf einen
   Datensatz des vorigen Akteurs.
   - Das leistet schon heute der Render: `setStage(null)` beim Akteurwechsel (`Page.tsx:250-257`), ebenso bei der
     Leseverweigerung (`:301`).
   - Der Ref folgt dem gezeichneten Stand, also gilt es auch für ihn.
   - Ein Test belegt es (Tests zuerst, 1c).
3. **Die Sperre nach dem Schreiben folgt demselben Render.** `deliver()` lehnt wegen einer laufenden Sperre nur ab,
   solange der Render sie auch zeigt: Die Sperre gehört zur gezeichneten Frage in der gezeichneten Version (Regel wie
   `Page.tsx:226-231`, eine reine Funktion für beide).
   - Die zweite Aktivierung in derselben Aufgabe vor dem Render bleibt gesperrt, wie heute über `writing.current`.
   - Der Nachlauf aus Befund 1, Punkt 4 entfällt.
4. **Kein Flackern.** Der Knopf wird **nicht** während jeder Lesung gesperrt (verworfene Alternative, siehe unten).
5. **002 nur nach bestätigter Ursache.** Der Bau entscheidet H-2a, H-2b oder H-2c zuerst durch einen roten Test
   (Tests zuerst, 3) und baut nur die Korrektur für die bestätigte Ursache, alle in `speakers/Page.tsx`:
   - **H-2a:** Die Liste bleibt während eines laufenden Zugs (Tastatur oder Zeiger) auf dem Stand beim Anheben stehen.
     Eine eintreffende Liste wird beim Ablegen oder Abbrechen übernommen (Designprinzip 8). Der Stand gehört dem Akteur;
     ein Akteurwechsel verwirft ihn und bricht den Zug ab (010d).
     - Das Ablegen schickt die Reihenfolge des stehenden Stands mit dem `If-Match` der neuesten Liste.
     - Ist das veraltet, entscheidet der Server (412, Toast, Neuladen wie heute).
     - Die Zusammenführung ist eine reine Funktion in `useSpeakers.ts`.
   - **H-2b:** `KeyboardSensor` mit `scrollBehavior: 'auto'`, damit Scrollen und Weiterziehen im selben Schritt
     geschehen. Das kommt auch Personen mit reduzierter Bewegung entgegen.
   - **H-2c:** Die Ziele werden während des Zugs neu gemessen (`measuring` des `DndContext`), aber nicht in jedem Frame.
     Der Bau begründet die gewählte Strategie im Kommentar.
   - **Keine bestätigt:** kein Produktcode für 002. Der Befund bleibt offen mit den Messergebnissen im Abschnitt
     „Nachweis“ und einem Eintrag in `docs/folgeliste.md`. Der Orchestrator entscheidet über eine Folgescheibe.

### Verworfene Alternative: Knopf während jeder Lesung sperren (`aria-disabled`/`aria-busy`)

Sie macht das Rennen sichtbar, schließt es aber nicht:

- Die Leertaste, der Hauptweg der Bühne (Designprinzip 7), fiele im selben Fenster weiter still ins Leere.
- Der Knopf würde alle 30 s und nach jedem Ereignis für die Dauer einer Lesung grau. Das verletzt Designprinzip 8
  (nichts springt) und Designprinzip 10 (Gerät auf zwei Meter Abstand).
- Den passiven Nachlauf aus Befund 1, Punkt 2 schlösse sie nicht: Die Sperre wäre ebenfalls Zustand aus einem Render.

Die gewählte Lösung braucht kein neues Signal. Das bestehende `aria-disabled` bleibt das einzige und stimmt künftig mit
dem Handler überein.

## Nicht-Ziele

- Keine Änderung an Vertrag, Domäne, Server, `apps/web/src/api/` (Takt, Hörer, `useApiVersion`) oder an den Rechten.
- Keine neue Testabhängigkeit (kein jsdom, keine Testing Library). Komponenten werden wie in
  `speakers/RoundSection.test.tsx` statisch gerendert.
- Keine Wartezeiten, `waitForTimeout`, Wiederholungen (`retries`, Schleifen um einen Klick),
  `test.skip`/`fixme`/Quarantäne oder abgeschwächten Zusicherungen. Ein Test darf nur auf Produktsignale warten
  (`aria-disabled`, `data-busy`, Ansage, sichtbarer Text) oder auf ein Netzereignis, das der Test selbst auslöst.
- Keine Änderung an `playwright.config.ts`, an `scripts/e2e-http-031*.mjs` oder an `.github/workflows/`. Die neuen
  HTTP-Tests kommen in die bestehende Datei `031-http-betriebsart.spec.ts` (nur Projekt `http`).
- `abnahme.spec.ts` und `002-speakers-capture.spec.ts` bleiben unverändert, sofern ihre Warteschritte schon auf
  Produktsignale warten (tun sie: `not.toHaveText`, Ansage, `expectNotBusy`). Bestätigt der Bau H-2b, darf der
  Kommentar in `002-speakers-capture.spec.ts:77-78` angepasst werden; die Schritte nicht.
- Kein Umbau des Rückgabedialogs über das hinaus, was „R“ und `returnAnswer` für denselben Ref brauchen.

## Files allowed

- `docs/slices/takt-039-http-bedienrennen.md`
- `apps/web/src/features/stage/Page.tsx` (Regel aus Ziel 1–3, Ref per `useLayoutEffect`, kein Leeren beim Lesen, Weitergabe an `Podium`)
- `apps/web/src/features/stage/Podium.tsx` (`onNext(question)`, gesperrt genau nach der Regel)
- `apps/web/src/features/stage/lib.ts` (nur neue reine Funktionen, z. B. `deliverTarget`, `lockHolds`)
- `apps/web/src/features/stage/lib.test.ts`
- `apps/web/src/features/stage/Podium.test.tsx` (neu, statisch gerendert)
- `apps/web/src/features/speakers/Page.tsx` (nur die Korrektur zur bestätigten Hypothese aus Ziel 5)
- `apps/web/src/features/speakers/useSpeakers.ts` und `useSpeakers.test.ts` (nur bei H-2a, nur neue reine Funktion)
- `apps/web/e2e/031-http-betriebsart.spec.ts` (neue Tests H11 und H12)
- `apps/web/e2e/002-speakers-capture.spec.ts` (nur der Kommentar in Z. 77-78, nur bei H-2b)
- `docs/folgeliste.md` (nicht blockierende Reviewbefunde; offener 002-Befund, falls keine Hypothese bestätigt)

Weitere Dateien sind Scope-Befunde (R1).

## Tests zuerst

Jeder Test wird vor der Korrektur geschrieben und muss auf dem alten Code rot sein. Rot und Grün stehen im Abschnitt
„Nachweis“. Unit- und Komponententests laufen lokal. HTTP-Tests laufen nur in der PR-CI (kein Keycloak lokal): Der Bau
schiebt zuerst einen Commit mit den neuen Tests ohne Korrektur, belegt das Rot in der CI (Lauf-ID), dann die Korrektur.

1. **`lib.test.ts` (reine Regel der Bühne):**
   - (a) Ein gezeichneter Datensatz mit `question.deliver` und ohne Sperre ist ein Ziel, auch während einer laufenden
     Lesung. Das ist die rote Wiedergabe von Befund 1, Punkt 3: Das alte Verhalten gibt kein Ziel.
   - (b) Eine Sperre auf gezeichneter Frage und Version verhindert das Ziel. Zeigt der Render eine andere Frage oder
     Version, gilt sie nicht mehr (Befund 1, Punkt 4).
   - (c) Nach einem Akteurwechsel (gezeichneter Stand `null`) und bei Leseverweigerung gibt es kein Ziel.
   - (d) Für eine Tabelle von Zuständen gilt: „Knopf gezeichnet und nicht gesperrt“ genau dann, wenn ein Ziel da ist.
   - Rot, weil die Funktionen fehlen (wie takt-037).
2. **`Podium.test.tsx`:**
   - Bei gesperrter Regel trägt `stage-next` `aria-disabled="true"`, sonst nicht.
   - Das Klickziel übergibt die gezeichnete Frage an `onNext`. Das wird am übergebenen Callback geprüft, der Klick wird
     nicht simuliert. Die Komponente reicht `question` statisch an den Handler weiter; der Test ruft die gerenderte
     Prop auf oder prüft die Weitergabe über eine kleine exportierte Hilfsfunktion.
3. **`031-http-betriebsart.spec.ts`, H11 @idp (Bühne, Rolle `podium`):**
   - `page.clock.install()` vor der ersten Navigation, dann `/stage`, Nummer sichtbar.
   - Den **nächsten** `GET /v1/stage` per `page.route` festhalten.
   - Den 30-s-Takt mit `page.clock.fastForward('00:30')` auslösen und auf die festgehaltene Anfrage warten
     (Netzereignis, kein Timeout).
   - Dann `stage-next` klicken, die Anfrage freigeben und erwarten:
     - dass ein `POST …/delivery` für die gezeichnete Nummer gesendet wurde;
     - dass die Nummer wechselt.
   - Auf altem Code: kein POST, Nummer bleibt, rot. Das ist die Wiedergabe von Befund 1, Punkt 3 im echten Modus.
   - Screenshot `docs/evidence/031-h11-buehne-waehrend-lesung.png`.
   - H11 liest eine Frage vor und schließt sie. `abnahme` braucht danach eine Runde weniger (Schranke 130,
     `abnahme.spec.ts:37`).
4. **`031-http-betriebsart.spec.ts`, H12 @idp (Wortmeldeliste, Rolle `moderation`):** Er entscheidet die Hypothesen zu
   002.
   - (a) Anheben per Leertaste wie in 002. Dann den 30-s-Takt auslösen und auf die letzte Antwort von
     `readStableSpeakerList` warten (zweites `GET /v1/meeting` nach dem Takt). Dann ArrowDown und erwarten, dass sich
     die Ansage auf „Position 7 von 7“ ändert. Danach Esc, damit nichts geschrieben wird.
   - (b) Ohne Auffrischung dasselbe, mit einer Zeile, deren Ziel in der unteren Hälfte des scrollbaren Bereichs liegt.
   - Ist (a) auf altem Code rot und (b) grün, gilt H-2a. Ist (b) rot, gilt H-2b oder H-2c: Der Bau grenzt per
     Messung ab (Scroll-Position vor und nach dem Pfeil, Maße der Ziele) und hält das Ergebnis im „Nachweis“ fest.
   - Sind beide grün, ist keine Hypothese bestätigt (Ziel 5, letzter Fall). Der Test bleibt als Regressionstest.
   - Screenshot `docs/evidence/031-h12-umsortieren-nach-auffrischung.png`.
   - Bei H-2a zusätzlich in `useSpeakers.test.ts`: Eine während des Zugs eintreffende Liste ändert die Anzeige nicht.
     Nach dem Ablegen oder Abbrechen gilt die neueste Liste. Ein Akteurwechsel verwirft den stehenden Stand.

## Akzeptanzkriterium

1. Die Tests aus „Tests zuerst“ sind auf dem alten Code rot und nach der Korrektur grün. Für 1 und 2 ist das lokal
   belegt, für H11 und H12 durch zwei PR-CI-Läufe (Lauf-IDs im Nachweis).
2. `deliver()` enthält keine Ablehnung mehr, die der Render nicht als `aria-disabled` zeigt, oder bei fehlendem Recht
   gar nicht zeichnet. Der Review prüft das am Diff:
   - kein `stageRef.current = null` beim Start einer Lesung;
   - der Ref für die Tastatur wird in `useLayoutEffect` gesetzt;
   - Sperrregel und Zielregel sind dieselbe reine Funktion für Render und Handler;
   - kein Rollenname (`pnpm role-literals`).
3. Der Schutz aus Review 3 Minor 4 und Codex P2-B ist durch Test 1c belegt. Das Verhalten nach Leseverweigerung und
   nach gescheiterter Lesung („Minor A“, Review 4) bleibt: Die Bühne wirkt auf das, was sie zeigt.
4. `pnpm gates` grün auf sauberem Commit. Der Abschnitt „Nachweis“ nennt den Gates-Commit und den wörtlichen Schluss
   (eigener Doku-Commit, gezielt stagen, kein Amend). `slice-scope` akzeptiert nur die Dateien oben.
5. Projekt `in-process`: `abnahme.spec.ts`, `002-speakers-capture.spec.ts` und `003-answers-stage.spec.ts` grün.
6. **`e2e-http` grün in der PR-CI auf dem letzten Commit des PR**, einschließlich `abnahme` und `002`, ohne Wiederholung
   (`retries: 0` bleibt).
   - Bildnachweis nach E56: Artefakt `evidence-031-http` mit Lauf-ID, Artefakt-ID und Digest im Abschnitt „Nachweis“,
     darin `031-h11-*.png` und `031-h12-*.png`.
   - Wird `abnahme` oder `002` dort aus einem anderen Grund rot (etwa H-1b: ein Toast nach abgelehntem Schreiben), ist
     das ein Befund. Der Bau hält an und meldet ihn, statt den Test anzupassen.

## Wirkung und Risiko (Leitplanken §4, mittel)

- **Nebenläufigkeit (6.3):**
  - Die Bühne kann nun während einer Lesung auf den gezeichneten Stand schreiben. Ist der inzwischen veraltet, lehnt
    der Server mit 412 ab: Toast und Neuladen wie heute, kein Datenfehler.
  - Die Doppelaktivierung bleibt über `writing.current` gesperrt.
  - Risiko: Eine falsch gebildete Sperrregel ließe ein zweites „Vorgelesen“ zu. Test 1b deckt das ab.
- **Rechte:** unverändert. Der Knopf erscheint nur mit `question.deliver` in `_actions`. Ein Akteurwechsel leert den
  gezeichneten Stand im selben Render (Test 1c).
- **Barrierefreiheit (6.9):**
  - `aria-disabled` bleibt das Sperrsignal (takt-008, Fokus bleibt), jetzt deckungsgleich mit der Wirkung.
  - Die Leertaste wirkt in jedem Moment, in dem der Knopf frei gezeichnet ist.
  - Bei 002 mit H-2b entfällt die weiche Scrollbewegung beim Tastaturzug.
- **Betrieb:** keine zusätzlichen Anfragen. H11 und H12 verlängern `e2e-http` um wenige Sekunden (Takt per
  `page.clock`, keine Wartezeit).
- **Umfang:**
  - Bühne und Wortmeldeliste sind getrennt. Überschreitet der Bau einen Agententag, wird geteilt: 039a Bühne, 039b
    Umsortieren. Das entscheidet der Orchestrator.
  - Berührt der Bau doch Rechte, Identität oder Persistenz, gilt hoch; das ist ein Scope-Befund.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche, Barrierefreiheit [x] Nebenläufigkeit (clientseitig, kein Speicher)
Perspektive(n): Nebenläufigkeit (6.3), UX/Barrierefreiheit (6.9) · Nachweise: Unit- und Komponententests, HTTP-e2e H11/H12, CI-Artefakt nach E56 · Offene Entscheidung: keine E-Nummer

## Vor dem Bau prüfen

Vor dem Bau lesen: `stage/Page.tsx` (`stageRef`, `shownRef`, Lese-Effekt, `deliver`, `returnAnswer`, Tastatur-Handler,
Akteurwechsel im Render), `stage/Podium.tsx` (`PodiumButton`, `next`, Fokusmarke aus 010c Ziel 6), `stage/lib.ts`,
`speakers/Page.tsx` (`DndContext`, `sensors`, `announcements`, Override 010d, `onDragEnd`) und
`031-http-betriebsart.spec.ts` (H8–H10, `statePath`). Prüfen, ob `page.clock` in der eingesetzten Playwright-Version
mit `storageState` und dem Neuladen aus `asRole` zusammenarbeitet. Weichen die Zeilenangaben ab, fehlt eine Datei oder
geht `page.clock` nicht, melden und anhalten. Kein Ersatz durch Wartezeiten.

## Offene Fragen

1. Die Fehlerbilder des Projekts `http` werden nicht hochgeladen (nur `docs/evidence/031-*.png`). Soll ein späterer
   Takt die Fehlerbilder (ohne Seitentext, wegen der Passwortfelder) als Artefakt sichern, damit Fälle wie H-1b
   unterscheidbar werden? Standard: nein, diese Scheibe ändert keine Workflows.

## Nachweis

(folgt mit dem Bau)

## Review findings

(folgt mit dem Review)
