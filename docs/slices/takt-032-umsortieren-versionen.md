# takt-032 — Nach eigenem Schreiben mit der Version aus der Antwort weiterarbeiten (Wortmeldeliste und Erfassung)

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung im Web, kein Hoch-Auslöser; Leitplanken §4) · **Lanes:** web · **Perspektive:** Qualität/Nebenläufigkeit, UX/Barrierefreiheit
**Rolle:** web-implementer; Review in frischem Kontext (Perspektive Nebenläufigkeit und UX), Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2 (Nachweis), R4 (kein Rollenname, Angebot nur aus `_actions`), R6 (nur `HvApi`), R10 (i18n), R12; ADR 0002 (zwei Betriebsarten, gleiches Verhalten); Slice 010d (Override und Daten gehören der Liste bzw. dem Akteur, für die sie entstanden); takt-008 (Sperre beim Schreiben mit `aria-disabled`, Fokus bleibt)
**Depends on:** takt-030 (PR #82, Branch `claude/takt-030-eigene-schreibvorgaenge`, **noch nicht gemergt**). takt-030 lässt `apps/web/src/api/http.ts` nach jedem eigenen 2xx-Schreiben die Hörer rufen; darauf lädt jede Ansicht sofort neu. Diese Scheibe setzt das voraus: Die neu gelesene Liste löst die Version aus der Antwort ab. Bau erst nach dem Merge von takt-030 von der dann aktuellen Basis.
**Quellen-IDs:** Diagnoselauf für Scheibe 031b, gemessen gegen Postgres am 30.09.2026 (Wortmeldeliste); CI-Lauf 36664034530 auf 031b und Lesen des Codes (Erfassung); Slice 002 (Umsortieren, Erfassen), 010d, takt-008

## Befund (Ist-Stand, gelesen auf `5a013f9`)

Es ist ein einziges Muster: Im HTTP-Modus schreibt die Seite, und das nächste Schreiben auf dieselbe Ressource
schickt die Version aus der Liste **vor** dem ersten Schreiben. Die Liste wird erst danach neu gelesen (drei GETs bzw.
zwei getrennte Lesungen). Folge: 412, Toast oder Veraltet-Banner, Neuladen. Der Server arbeitet richtig. Im
Nachspielen kamen 200/200 mit frischen Versionen, mit einer alten Version 412. Im Demo-Modus tritt das nicht auf,
weil der In-Process-Aufruf im selben Mikrotask-Takt auflöst.

**Wortmeldeliste**
- `apps/web/src/features/speakers/Page.tsx:284` setzt beim Ablegen `setOverride(...)` mit den Zeilen vor dem
  Umsortieren, also mit alten `version`-Werten. `Page.tsx:290-300` verwirft die Antwort von `reorderSpeakers` und hängt
  nur `.catch` an. Dabei trägt die Antwort (200, `ETag` = neue Listenversion) die Zeilen der Runde mit neuen Versionen:
  `packages/domain/src/api.ts:92` (`Promise<Speaker[]>`), Vertrag `packages/contract/openapi.yaml:224`.
- Der Override fällt weg, sobald eine neue Liste eintrifft (`Page.tsx:73-77`). Die kommt aus `useSpeakers.ts:98-124`
  über `readStableSpeakerList` (`useSpeakers.ts:50-60`), drei GETs nacheinander. `viewRef` wird erst nach dem Rendern
  nachgezogen (`Page.tsx:80-83`).
- `onCall` (`Page.tsx:169-186`), `onFinish`, `onWithdraw`, `onMove` und `NowSpeaking.tsx` (`speaker-call-next`,
  Beenden) schicken `etagOf(speaker.version)` aus der angezeigten Zeile. Im Fenster zwischen der Antwort und der neu
  gelesenen Liste (gemessen: ca. 0,5–1 s) endet das mit 412, und die laufende Wortmeldung bleibt stehen. Dasselbe gilt
  für ein Beenden direkt nach dem Aufrufen: Die Antwort von `updateSpeaker` (Rumpf `Speaker` mit neuer Version) wird
  ebenfalls verworfen.
- `register` (`Page.tsx:211-215`) und das nächste Umsortieren nutzen `listVersion` aus der Liste. Nach einem eigenen
  Anmelden oder Umsortieren ist sie bis zum Neuladen veraltet.

**Erfassung**
- `apps/web/src/features/capture/Page.tsx:210`: `captureQuestions` schickt `contribution.version` aus der Liste. Jede
  erfasste Einzelfrage erhöht die Version des Redebeitrags (`packages/domain/src/state.ts:285-288`). Zwei schnelle
  Erfassungen hintereinander (Markieren, Alt+Q, freie Eingabe, Vorschlag) → die zweite bekommt 412. Die Antwort
  (`Question[]`, Vertrag `openapi.yaml:345`) trägt die neue Version des Redebeitrags **nicht im Rumpf**, aber im
  `ETag` (`ETagRequired`). Beide Adapter geben sie über `HvApi.lastWriteEtag()` heraus: Domäne `api.ts:604`, HTTP über
  `perform`/`onWriteEtag`.
- `capture/Page.tsx:189`: `captureContribution` schickt `speaker.version`. `ContributionCaptured` erhöht die Version
  der Wortmeldung (`state.ts:249`). Die Antwort ist der `Contribution` mit dessen Version als `ETag`; die **neue
  Version der Wortmeldung steht nicht in der Antwort**.
- Karten (`/v1/questions`) und Restabdeckung (`/v1/contributions`, angezeigt in `CoverageBar.tsx`) werden getrennt neu
  gelesen, einmal über den `version`-Schlüssel der beiden `useAsync` und einmal über `refetch` (`capture/Page.tsx:222-225`).
  Sie landen in verschiedenen Renders, die Restabdeckung hinkt den Karten hinterher.

## Ziel

1. **Regel für beide Seiten: weiterarbeiten mit der Version aus der Antwort.** Nach einem erfolgreichen eigenen
   Schreiben nutzt das nächste Schreiben auf dieselbe Ressource die Version aus dieser Antwort:
   - Trägt der Rumpf die Ressource, gilt deren `version`: `updateSpeaker` → `Speaker`, `reorderSpeakers` → `Speaker[]`
     der Runde.
   - Sonst gilt das `ETag` der Antwort über `api.lastWriteEtag()`, gelesen **unmittelbar** nach dem `await` des
     Schreibens: `registerSpeaker` und `reorderSpeakers` → Listenversion, `captureQuestions` → Version des
     Redebeitrags. Der Wert wird als `ifMatch` unverändert weitergegeben, nicht geparst.
   - Die Seite zählt nie selbst hoch.
   - Die Version aus der Antwort gilt, bis eine Liste eintrifft, die **nach** der Antwort angefordert wurde; die ist
     mindestens so neu. Je `id` gewinnt die höhere Version, eine schon neuere Zeile wird nie durch eine ältere ersetzt.
   - Die Zusammenführung sind reine Funktionen: für die Wortmeldeliste in `useSpeakers.ts`, Vorschlag
     `applyWriteResult(view, returned)`, für die Erfassung in `useCapture.ts`. So sind sie ohne DOM testbar.
2. **Gesperrt, solange ein Schreiben läuft, mit deterministischem Signal.** Je Seite läuft höchstens ein eigenes
   Schreiben zugleich. Damit ist auch das Lesen von `lastWriteEtag()` eindeutig, denn ein zweites Schreiben kann das
   `ETag` nicht überholen.
   - **Wortmeldeliste:** Während ein Umsortieren einer Runde läuft, sind in dieser Runde `speaker-call`,
     `speaker-finish`, `speaker-move` und `speaker-withdraw` deaktiviert, ebenso das Ziehen (`useSortable({ disabled })`,
     zusätzlich bricht `onDragEnd` ab). In `NowSpeaking` sind `speaker-call-next` und Beenden gesperrt, wenn die
     betroffene Wortmeldung in dieser Runde liegt; ist das nicht sicher zu bestimmen, während jedes laufenden
     Umsortierens. Die Runde trägt `data-busy="true"` und `aria-busy="true"` am Element `speakers-round-<n>`
     (`<section>` in `RoundSection.tsx`). Ohne laufendes Schreiben fehlen beide oder stehen auf `false`. Zeilenaktionen
     sperren weiter über `busyId` wie heute.
   - **Erfassung:** Während ein Schreiben auf den gewählten Redebeitrag läuft (`captureQuestions` aus Markieren, Alt+Q,
     freier Eingabe oder Vorschlag), sind alle diese Wege gesperrt. Nach takt-008 geschieht das mit `aria-disabled`
     und einer Wächterprüfung im Handler, nicht mit `disabled`, damit der Fokus bleibt. Das Signal
     `data-busy="true"`/`aria-busy="true"` sitzt an einem Element mit `data-testid="capture-contribution-pane"`
     (`ContributionPane.tsx`). Für `captureContribution` gilt: Die neue Version der Wortmeldung kennt die Seite nicht
     (siehe Befund). Nach dem Erfolg bleibt die Eingabe für einen **weiteren** Redebeitrag derselben Wortmeldung
     deshalb gesperrt, mit demselben Signal, bis eine Liste der Wortmeldungen eintrifft, die nach der Antwort
     angefordert wurde. Das ist das Neuladen aus takt-030.
3. **Karten und Restabdeckung landen zusammen.** Die angezeigten Karten und die angezeigte Restabdeckung stammen immer
   aus Lesungen desselben Stands: gleicher `useApiVersion`-Wert bzw. dasselbe Neuladen nach dem eigenen Schreiben. Ein
   neueres Paar ersetzt das ältere erst, wenn beide Teile da sind; bis dahin bleibt das alte Paar sichtbar
   (Designprinzip 8). Die Restabdeckung kann nicht aus der Antwort kommen, denn `captureQuestions` liefert nur
   `Question[]` (siehe offene Frage 1). `CoverageBar.tsx` bleibt reine Anzeige.
4. **Nur auf den eigenen Stand.** Ein Ergebnis wird nur übernommen, wenn der Zustand, auf dem das Schreiben begann,
   noch der aktive ist: derselbe Akteur, beim Umsortieren derselbe Override (Marke oder Ref je Schreiben). Nach einem
   Akteurwechsel oder einer inzwischen eingetroffenen neueren Liste wird es verworfen, und kein Override wird
   wiederbelebt (010d).
5. **Fehlschlag unverändert.** Wortmeldeliste: Toast, Override verwerfen, `reload()`. Erfassung: Veraltet-Banner bei
   412 bzw. Toast wie heute. Das Busy-Signal endet im selben Render.
6. **Nichts am Server, am Vertrag, an der Domäne oder an den API-Adaptern.** Rechte kommen weiter nur aus `_actions`.
   Das Busy-Signal ist ein Ladezustand, keine Berechtigung.

## Nicht-Ziele

- Keine Vertragsänderung (offene Frage 1), keine Änderung an `http.ts`, `index.ts`, `useApiVersion.ts` oder am
  Demo-Adapter.
- Keine Sperre über Seiten hinweg und keine Änderung an Schreibwegen, die eine andere Ressource betreffen
  (Einordnen einer Einzelfrage, `ClassifyDialog`, schreibt auf die Frage).
- Keine Änderung an den e2e-Tests. Der e2e-Test 002 aus 031b wartet später auf `data-busy`; das gehört nicht in
  diesen Takt.
- Keine neue Testabhängigkeit (jsdom, Testing Library). Komponenten werden wie in `app/LoginPage.test.tsx` statisch
  gerendert (`react-dom/server`), die Logik steckt in reinen Funktionen.

## Files allowed

- `docs/slices/takt-032-umsortieren-versionen.md`
- `apps/web/src/features/speakers/Page.tsx` (Übernahme der Antworten, Busy-Zustand, Weitergabe)
- `apps/web/src/features/speakers/RoundSection.tsx` (Prop für Busy, data-busy und aria-busy am section-Element)
- `apps/web/src/features/speakers/SpeakerRow.tsx` (Knöpfe und Ziehen gesperrt, solange die Runde beschäftigt ist)
- `apps/web/src/features/speakers/NowSpeaking.tsx` (Aufrufen und Beenden gesperrt, solange die Runde beschäftigt ist)
- `apps/web/src/features/speakers/useSpeakers.ts` (nur neue reine Funktionen)
- `apps/web/src/features/speakers/useSpeakers.test.ts`
- `apps/web/src/features/speakers/RoundSection.test.tsx` (neu)
- `apps/web/src/features/speakers/NowSpeaking.test.tsx` (neu)
- `apps/web/src/features/capture/Page.tsx` (Version aus der Antwort, Busy-Zustand, gemeinsames Landen von Karten und Restabdeckung)
- `apps/web/src/features/capture/ContributionPane.tsx` (Busy-Signal, Sperre der Eingaben nach takt-008)
- `apps/web/src/features/capture/ContributionText.tsx` (Wächter für Markieren und Alt+Q)
- `apps/web/src/features/capture/SuggestDialog.tsx` (Wächter beim Übernehmen)
- `apps/web/src/features/capture/CoverageBar.tsx` (nur falls die Anzeige eine Prop für den Stand braucht)
- `apps/web/src/features/capture/useCapture.ts` (nur neue reine Funktionen)
- `apps/web/src/features/capture/useCapture.test.ts`
- `apps/web/src/features/capture/ContributionPane.test.tsx` (neu)
- `apps/web/src/features/capture/CoverageBar.test.tsx` (neu, nur falls CoverageBar.tsx geändert wird)
- `apps/web/src/i18n/speakers.de.ts`, `apps/web/src/i18n/speakers.en.ts`, `apps/web/src/i18n/capture.de.ts`, `apps/web/src/i18n/capture.en.ts` (nur falls ein neuer sichtbarer Text oder ein neues aria-label nötig wird, dann DE und EN)
- `docs/folgeliste.md` (nicht blockierende Reviewbefunde)
- `docs/evidence/takt-032-*.png`

Weitere Dateien sind Scope-Befunde.

## Akzeptanzkriterium

1. **Unit-Tests zuerst rot, dann grün** (reine Funktionen):
   - `useSpeakers.test.ts`: (a) zurückgegebene Zeilen mit höherer `version` ersetzen die angezeigten, die Reihenfolge
     folgt `round`/`position` der zusammengeführten Zeilen; (b) Zeilen anderer Runden bleiben dieselben Objekte;
     (c) gleiche oder kleinere `version` ersetzt nichts; (d) eine unbekannte `id` wird nicht eingefügt; (e) leere
     Rückgabe lässt die Ansicht gleich; (f) die Listenversion aus der Antwort gilt, bis eine nach der Antwort
     angeforderte Liste da ist, danach die der Liste.
   - `useCapture.test.ts`: (a) das `ETag` aus der Antwort gilt als `ifMatch` für den nächsten `captureQuestions`
     desselben Redebeitrags, für einen anderen Redebeitrag nicht; (b) eine nach der Antwort angeforderte Liste löst es
     ab; (c) Karten und Restabdeckung werden nur als Paar desselben Stands übernommen: nur Karten neu → altes Paar
     bleibt; beide neu → neues Paar.
2. **Komponententests** (statisch gerendert):
   - `RoundSection.test.tsx`: mit Busy `data-busy="true"`, `aria-busy="true"` und jeder `speaker-call`,
     `speaker-finish`, `speaker-move`, `speaker-withdraw` der Runde `disabled`; ohne Busy keine Attribute (oder
     `false`) und Knöpfe wie heute.
   - `NowSpeaking.test.tsx`: Aufrufen und Beenden bei Busy `disabled`, sonst wie heute.
   - `ContributionPane.test.tsx`: bei Busy `data-busy="true"`/`aria-busy="true"` an `capture-contribution-pane`,
     `capture-free-add`, `capture-suggest` und `capture-submit` mit `aria-disabled="true"`; ohne Busy wie heute.
3. **Ablauf, vom Review am Diff geprüft:** `lastWriteEtag()` wird direkt nach dem `await` gelesen, und je Seite läuft
   höchstens ein Schreiben. Ergebnisse werden nach Akteurwechsel oder neuerer Liste verworfen. Das Busy-Signal endet in
   `finally` bzw. im Fehlerzweig. Es gibt kein Hochzählen von Versionen und keinen Rollennamen (`pnpm role-literals`).
4. **Demo unverändert:** Projekt `in-process` nicht verändert, alle Web-Unit-Tests grün. Kein Diff in `packages/`,
   `apps/api/`, `apps/web/src/api/`, `apps/web/e2e/`.
5. **Screenshots** `docs/evidence/takt-032-umsortieren.png` (Wortmeldeliste nach einem Umsortieren per Tastatur, Rolle
   Versammlungsbüro, Demo) und `docs/evidence/takt-032-erfassung.png` (Erfassung nach zwei Einzelfragen hintereinander,
   Karten und Restabdeckung auf gleichem Stand). Das Busy-Signal dauert im Demo-Modus nur einen Mikrotask; es wird
   durch die Komponententests belegt, nicht durch ein Bild (offene Frage 2).
6. `pnpm gates` grün auf sauberem Commit, Abschnitt „Nachweis“ mit Gates-Commit und wörtlichem Schluss (eigener
   Doku-Commit, gezielt stagen, kein Amend). `slice-scope` akzeptiert nur die Dateien oben.
7. **Späterer Nachweis, nicht Teil dieser Abnahme:** Im Projekt `http` ruft der 031b-Test 002 nach dem Umsortieren auf
   und erfasst zwei Einzelfragen schnell hintereinander, ohne 412; er wartet dabei auf `data-busy` ohne `"true"`.

## Wirkung und Risiko (Leitplanken §4, mittel)

- Nebenläufigkeit (6.3): Versionen kommen nur vom Server. Ein fremder Schreiber mit alter Version bekommt weiter 412.
  Das Busy-Fenster dauert so lange wie das Schreiben (lokal unter 100 ms, CI http bis ca. 1 s). Nur nach
  `captureContribution` dauert es bis zum Neuladen der Wortmeldungen.
- Restfall: Ein Neuladen, das vor dem COMMIT gestartet ist (z. B. der 30-s-Takt), kann nach dem Erfolg mit älteren
  Zeilen eintreffen. Die Regel „höhere Version gewinnt“ fängt das für Zeilen ab, deren Antwort den Rumpf trägt. Für
  ETag-Versionen gilt die Ablösung erst durch eine Liste, die nach der Antwort angefordert wurde. Bleibt ein Fall
  übrig, endet er mit 412 und Neuladen wie heute, also kein Datenfehler.
- Barrierefreiheit (6.9): `aria-busy` an Runde bzw. Erfassungsbereich. In der Erfassung gilt `aria-disabled` statt
  `disabled` (takt-008), damit der Fokus nicht verloren geht. Deaktivierte Knöpfe behalten ihr `aria-label`.
- Betrieb: kein zusätzlicher Aufruf. Die Antworten werden nur nicht mehr verworfen, und das gemeinsame Landen wartet
  auf Lesungen, die ohnehin laufen.
- Umfang: zwei Seiten, ein Muster. Überschreitet der Bau einen Agententag, wird entlang der Seiten geteilt (032a
  Wortmeldeliste, 032b Erfassung). Das entscheidet der Orchestrator, nicht der Bauende.
- Kein Hoch-Auslöser. Berührt der Bau doch Rechte, Identität oder Persistenz, gilt hoch, und das ist ein Scope-Befund.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche, Barrierefreiheit [x] Persistenz, Migration, Nebenläufigkeit (nur clientseitige Versionsführung, kein Speicher)
Perspektive(n): UX/Barrierefreiheit (6.9), Nebenläufigkeit (6.3) · Nachweise: Unit- und Komponententests, Screenshots · Offene Entscheidung: keine E-Nummer, offene Fragen unten

## Vor dem Bau prüfen

Nach dem Merge von takt-030: `speakers/Page.tsx` (`onDragEnd`, `run`, `actions`, `register`, Override-Regel 010d),
`RoundSection.tsx`, `SpeakerRow.tsx`, `NowSpeaking.tsx`, `useSpeakers.ts`, `capture/Page.tsx` (`writeContribution`,
`captureQuestions`, `refetch`, `useAsync`-Schlüssel), `ContributionPane.tsx` (`writing`, takt-008), `ContributionText.tsx`
(Alt+Q), `SuggestDialog.tsx`, `apps/web/src/api/http.ts` (Hörer nach 2xx, `lastWriteEtag`). Weichen die Zeilenangaben ab
oder fehlt eine Datei, melden und anhalten.

## Offene Fragen

1. **Vertrag (Architekt/Owner):** Zwei Antworten tragen die neue Version nicht im Rumpf. `captureQuestions` liefert
   nur `Question[]`: Die Version des Redebeitrags steht im `ETag`, die Restabdeckung gar nicht. `captureContribution`
   liefert den `Contribution`: Die neue Version der Wortmeldung fehlt. Soll ein späterer Vertragsschritt den
   geänderten Redebeitrag (mit `coverage` und `version`) bzw. die Version der Wortmeldung mitliefern? Standard bis zur
   Entscheidung: kein Vertragsschritt. Diese Scheibe nutzt das `ETag` und das Neuladen aus takt-030.
2. R2 verlangt für Oberflächenarbeit einen Screenshot. Der Busy-Zustand ist im Demo-Modus nicht fotografierbar.
   Standard: Screenshots des Endzustands plus Komponententests. Ein Bild aus dem Projekt `http` kommt mit 031b.

## Nachweis

Gates-Commit: `eb0998e` (sauberer Baum). `pnpm gates` läuft bis `slice-scope` durch und bricht dort erwartungsgemäß ab: Die
gestapelten Dateien von takt-030 (`apps/web/src/api/http.ts`, `http.test.ts`, `e2e/031-http-betriebsart.spec.ts`,
`docs/slices/takt-030-*`) stehen noch nicht auf der Basis. Danach einzeln und grün: `downgrade-check`, `metrics-allowlist`,
`plan-graph`, `test:scripts`, Web-Build, `mark-test-run`. Web-Unit-Tests: 292 grün (vorher rot, dann grün). In-Process-e2e:
127 grün (`E2E_PORT=4232`). Der HTTP-Lauf entfällt hier, der Nachweis kommt aus der CI.

```
slice-scope: 4 file(s) outside "docs/slices/takt-032-umsortieren-versionen.md"'s "Files allowed" list:
  apps/web/e2e/031-http-betriebsart.spec.ts
  apps/web/src/api/http.test.ts
  apps/web/src/api/http.ts
  docs/slices/takt-030-eigene-schreibvorgaenge.md
mark-test-run: wrote .claude/state/last-test-run (clean tree) at commit eb0998e
```

Screenshots: `docs/evidence/takt-032-umsortieren.png`, `docs/evidence/takt-032-erfassung.png`. Das Busy-Signal ist nur durch
Komponententests belegt (offene Frage 2, Abnahme durch den Owner offen).

## Review findings

Review 1 (fresh context, Perspektive Nebenläufigkeit und UX): changes requested, 2 major. Disposition:

1. **Major, behoben.** `capture/Page.tsx`, `useCapture.ts`: ein Paar mit älterer Version übersteuerte das frischere
   Antwort-ETag. Jetzt basiert die Marke auf der zum Antwortzeitpunkt angezeigten Version (`markAfterAnswer`, Ref auf das
   angezeigte Paar), und sie hält für jede Version `<= base`; nur eine nach der Antwort gelesene Liste (Version größer)
   löst sie ab. Test: Folge Schreiben 1, Neuladen, Schreiben 2 in `useCapture.test.ts`.
2. **Major, behoben.** `speakers/Page.tsx`: `stillCurrent` verglich die Liste per Identität. Jetzt zählt nur der Akteur;
   je Zeile gewinnt die höhere Version (`applyWriteResult`), das Listen-ETag hält für Versionen `<= base`
   (`etagForList`, base = zum Antwortzeitpunkt angezeigte Version). Tests für beide Fälle in `useSpeakers.test.ts`.
3. **Minor, behoben.** Nach jedem eigenen `updateSpeaker` (Aufrufen, Beenden, Zurückziehen, Verschieben) wird die Marke
   gelöscht und Umsortieren/Anmelden warten (`isListStale`), bis eine Liste eine neuere Version zeigt.
4. **Minor, Restfall.** (a) `lastWriteEtag()` wird in `http.ts` vor dem Lesen des Rumpfs gesetzt; (b) `ClassifyDialog`
   (schreibt auf die Frage) ist nicht gesperrt. Beides nicht Teil dieser Scheibe (Nicht-Ziel, `http.ts` außerhalb der
   Dateiliste): `docs/folgeliste.md`.
5. **Minor, behoben.** `speakerLocked` sperrt nur noch `writeContribution` bzw. `capture-submit` (`submitBusy`), nicht
   Markieren, Alt+Q, freie Eingabe und Vorschlag auf dem eben angelegten Redebeitrag. Test in `ContributionPane.test.tsx`.
6. **Minor, behoben.** `capture-suggest` hat die Wächterprüfung `if (!busy) onOpenSuggest()`.
7. **Minor, Folgeliste.** Ein Schreiben, das während eines anderen läuft, wird stumm verworfen (kein Hinweis).
8. **Nachweis-Lauf.** Gates auf sauberem Commit nach dem Merge von takt-030: der Koordinator übernimmt das.
9. **Nit, Folgeliste.** `capture/Page.tsx:170-176` · das Paar trägt nicht, zu welchem Redebeitrag die Karten gehören; beim
   Wechsel des Redebeitrags stehen kurz die Karten des vorigen da (vorbestehend, kein Rückschritt) · `contributionId` der
   Fragelesung im Paar speichern.
10. **Nit, erledigt mit Befund 1/2.** `useSpeakers.test.ts` (`etagForList`) · der Fall „weicht ab → übernimmt“ unterschied
    Marke und Liste nicht · durch die Tests der beiden Szenarien veralteter Listen ersetzt.
