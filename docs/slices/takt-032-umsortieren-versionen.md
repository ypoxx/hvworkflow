# takt-032 — Umsortieren übernimmt die frischen Versionen; Aufrufen erst nach der Antwort

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung im Web, kein Hoch-Auslöser; Leitplanken §4) · **Lanes:** web · **Perspektive:** Qualität/Betrieb, UX/Barrierefreiheit
**Rolle:** web-implementer; Review in frischem Kontext (Perspektive Nebenläufigkeit und UX), Modell nur in `.claude/agents/`
**Regeln:** AGENTS.md R2 (Nachweis), R4 (kein Rollenname, Angebot nur aus `_actions`), R6 (nur `HvApi`), R10 (i18n), R12; ADR 0002 (zwei Betriebsarten, gleiches Verhalten); Slice 010d (Override gehört der Liste, auf der er entstand)
**Depends on:** takt-030 (PR #82, Branch `claude/takt-030-eigene-schreibvorgaenge`, **noch nicht gemergt**). takt-030 lässt `apps/web/src/api/http.ts` nach jedem eigenen 2xx-Schreiben die Hörer rufen; das Umsortieren löst damit sofort ein Neuladen der Liste aus. Diese Scheibe setzt genau dieses Verhalten voraus (das Neuladen ersetzt den Override durch frische Zeilen) und wird erst nach dem Merge von takt-030 von der dann aktuellen Basis aus gebaut.
**Quellen-IDs:** Diagnoselauf für Scheibe 031b, gemessen gegen Postgres am 30.09.2026 (Nachlauf zur Zeitgrenze und zum 412 im Projekt `http`); Slice 002 (Umsortieren), 010d (Override)

## Befund (Ist-Stand, gelesen auf `5a013f9`)

- `apps/web/src/features/speakers/Page.tsx:284` setzt beim Ablegen `setOverride(...)` mit den Zeilen **vor** dem
  Umsortieren, also mit deren alten `version`-Werten.
- `Page.tsx:290-300` schickt `api.reorderSpeakers(...)` und hängt nur `.catch` an. Die Antwort (`PUT /v1/speakers/order`,
  200, `ETag`, Rumpf: die Zeilen der Runde mit neuen Versionen) wird verworfen. `HvApi.reorderSpeakers` liefert diese
  Zeilen bereits: `packages/domain/src/api.ts:92` (`Promise<Speaker[]>`), Vertrag `packages/contract/openapi.yaml:224`
  (Array von `Speaker`). Keine Vertragsänderung nötig.
- Der Override fällt weg, sobald eine neue Liste ankommt (`Page.tsx:73-77`). Die kommt aus `useSpeakers.ts:98-124`
  über `readStableSpeakerList` (`useSpeakers.ts:50-60`), also aus drei GETs nacheinander. `viewRef` wird erst nach dem
  Rendern nachgezogen (`Page.tsx:80-83`).
- `onCall` (`Page.tsx:169-186`) liest `viewRef` und die Zeile aus den Props. Im HTTP-Modus läuft ein Aufruf zwischen
  der Antwort auf das Umsortieren und dem Eintreffen der neu gelesenen Liste (gemessen: ca. 0,5–1 s) mit veraltetem
  `If-Match`. Folge: 412, Toast und Neuladen, und die laufende Wortmeldung bleibt stehen. Dasselbe gilt für `onFinish`,
  `onWithdraw`, `onMove` und die Knöpfe in `NowSpeaking.tsx` (`speaker-call-next`, Beenden), denn alle schicken
  `etagOf(speaker.version)` aus der angezeigten Zeile.
- Der Server arbeitet richtig. Im Nachspielen kamen 200/200 mit frischen Versionen, mit einer alten Version 412.
  Im Demo-Modus tritt das Problem nicht auf, weil der In-Process-Aufruf im selben Mikrotask-Takt auflöst.

## Ziel

1. **Frische Versionen nach Erfolg.** Löst `reorderSpeakers` auf, übernimmt die Seite die gelieferten Zeilen in den
   Override. Jede zurückgegebene Zeile ersetzt die Zeile mit gleicher `id`, aber nur, wenn ihre `version` größer ist
   als die angezeigte (eine schon neuere Zeile wird nie durch eine ältere ersetzt). Zeilen anderer Runden bleiben
   unverändert. Die Zusammenführung ist eine reine Funktion in `useSpeakers.ts`, Vorschlag
   `applyReorderResult(view, returned)`, damit sie ohne DOM testbar ist.
2. **Nur auf den eigenen Override.** Das Ergebnis wird nur übernommen, wenn der Override dieses Umsortierens noch der
   aktive ist (Marke oder Ref je Umsortieren). Ist inzwischen eine neue Liste eingetroffen (Regel 010d: Override fällt
   in demselben Render), wird das Ergebnis verworfen und kein Override wiederbelebt, auch nicht nach einem
   Akteurwechsel. Die neue Liste kommt dann aus dem Neuladen, das takt-030 anstößt.
3. **Gesperrt, solange das Schreiben läuft.** Ab dem Ablegen bis zur Antwort (Erfolg oder Fehler) gilt die Runde als
   beschäftigt:
   - In dieser Runde sind die Zeilenaktionen `speaker-call`, `speaker-finish`, `speaker-move` und `speaker-withdraw`
     deaktiviert (`disabled`). Ebenso deaktiviert sind in `NowSpeaking` die Knöpfe `speaker-call-next` und Beenden,
     wenn die betroffene Wortmeldung in dieser Runde liegt. Ist das nicht sicher zu bestimmen, sind sie während jedes
     laufenden Umsortierens gesperrt.
   - Ziehen ist in dieser Runde gesperrt (`useSortable({ disabled })`), und `onDragEnd` bricht zusätzlich ab, solange
     ein Umsortieren derselben Runde läuft. Kein zweites Schreiben mit alter Listenversion.
   - Die Runde trägt ein deterministisches Signal: `data-busy="true"` und `aria-busy="true"` am Element
     `speakers-round-<n>` (`<section>` in `RoundSection.tsx`). Ohne laufendes Schreiben fehlen beide Attribute oder
     stehen auf `false`. Dieses Signal nutzen Tests und assistive Technik. Die Ankündigungen von dnd-kit bleiben
     unverändert.
4. **Fehlschlag unverändert.** Toast, Override verwerfen, `reload()`. Das Busy-Signal endet auch hier, im selben
   Render wie das Verwerfen.
5. **Nichts am Server, am Vertrag oder an der Domäne.** Rechte kommen weiter nur aus `_actions`. Das Busy-Signal ist
   ein Ladezustand, keine Berechtigung.

## Nicht-Ziele

- Keine Vertrags- oder Serveränderung, keine Änderung an `http.ts`, `index.ts` oder `useApiVersion.ts`.
- Die **Listenversion** (`listVersion`, das Listen-ETag für Anmelden und nächstes Umsortieren) bleibt bis zum
  Neuladen die alte. Bis die neu gelesene Liste eintrifft, kann ein direkt folgendes Anmelden oder zweites
  Umsortieren weiter mit 412 enden (Toast, Neuladen). Das Fenster ist kurz, weil takt-030 sofort neu lädt. Wer es
  schließen will, braucht eine eigene Regel für das ETag der Antwort; das ist ein Folgeliste-Eintrag, nicht diese
  Scheibe (siehe offene Frage 1).
- Kein Warten auf das Neuladen nach dem Erfolg: Das Busy-Signal endet mit der Antwort auf das Schreiben.
- Keine Änderung an den e2e-Tests. Der e2e-Test 002 aus 031b wartet später auf `data-busy`; das gehört nicht in
  diesen Takt.
- Keine neue Testabhängigkeit (jsdom, Testing Library). Komponenten werden wie in `app/LoginPage.test.tsx` statisch
  gerendert (`react-dom/server`), die Logik ist eine reine Funktion.

## Files allowed

- `docs/slices/takt-032-umsortieren-versionen.md`
- `apps/web/src/features/speakers/Page.tsx` (Erfolgszweig von onDragEnd, Busy-Zustand je Runde, Weitergabe an die Kinder)
- `apps/web/src/features/speakers/RoundSection.tsx` (Prop für Busy, data-busy und aria-busy am section-Element, Weitergabe an die Zeilen)
- `apps/web/src/features/speakers/SpeakerRow.tsx` (Knöpfe und Ziehen gesperrt, solange die Runde beschäftigt ist)
- `apps/web/src/features/speakers/NowSpeaking.tsx` (Aufrufen/Beenden gesperrt, solange die Runde beschäftigt ist)
- `apps/web/src/features/speakers/useSpeakers.ts` (nur die neue reine Funktion zum Zusammenführen)
- `apps/web/src/features/speakers/useSpeakers.test.ts`
- `apps/web/src/features/speakers/RoundSection.test.tsx` (neu)
- `apps/web/src/features/speakers/NowSpeaking.test.tsx` (neu)
- `apps/web/src/i18n/speakers.de.ts`, `apps/web/src/i18n/speakers.en.ts` (nur falls ein neuer sichtbarer Text oder ein neues aria-label nötig wird, dann DE und EN)
- `docs/folgeliste.md` (nicht blockierende Reviewbefunde; Eintrag zur Listenversion aus den Nicht-Zielen)
- `docs/evidence/takt-032-*.png`

Weitere Dateien sind Scope-Befunde.

## Akzeptanzkriterium

1. **Unit-Tests zuerst rot, dann grün** (`useSpeakers.test.ts`, reine Funktion aus Ziel 1):
   (a) Zeilen der Runde 3 mit höherer `version` ersetzen die angezeigten, die Reihenfolge der Override-Zeilen bleibt;
   (b) Zeilen anderer Runden bleiben dieselben Objekte;
   (c) eine zurückgegebene Zeile mit gleicher oder kleinerer `version` ersetzt nichts;
   (d) eine zurückgegebene `id`, die nicht angezeigt wird, wird nicht eingefügt;
   (e) leere Rückgabe: die Ansicht bleibt unverändert.
2. **Komponententests** (statisch gerendert):
   - `RoundSection.test.tsx`: mit Busy tragen die `<section>` `data-busy="true"` und `aria-busy="true"`, und jeder
     `speaker-call`/`speaker-finish`/`speaker-move`/`speaker-withdraw` der Runde ist `disabled`. Ohne Busy fehlen beide
     Attribute (oder stehen auf `false`), und die Knöpfe sind so aktiv wie heute (gleiche `_actions`, kein `busyId`).
   - `NowSpeaking.test.tsx`: Aufrufen und Beenden sind bei Busy `disabled`, ohne Busy wie heute.
3. **Ablauf in `Page.tsx`, vom Review am Diff geprüft:** Der Erfolgszweig nutzt den Rückgabewert von
   `reorderSpeakers`. Die Marke aus Ziel 2 verhindert ein Übernehmen nach einer neuen Liste oder einem Akteurwechsel.
   Das Busy-Signal endet in `finally` bzw. im selben Render wie der Fehlerzweig. Ohne `listVersion` wird kein Busy
   gesetzt. Kein Rollenname im Diff (`pnpm role-literals`).
4. **Demo unverändert:** Projekt `in-process` nicht verändert, alle Web-Unit-Tests grün. Kein Diff in
   `packages/`, `apps/api/`, `apps/web/src/api/`, `apps/web/e2e/`.
5. **Screenshot** `docs/evidence/takt-032-umsortieren.png`: Wortmeldeliste (Rolle Versammlungsbüro, Demo) nach einem
   Umsortieren per Tastatur, gleicher Zustand wie in 002. Das Busy-Signal selbst dauert im Demo-Modus nur einen
   Mikrotask; es wird durch den Komponententest belegt, nicht durch ein Bild (siehe offene Frage 2).
6. `pnpm gates` grün auf sauberem Commit, Abschnitt „Nachweis“ mit Gates-Commit und wörtlichem Schluss (eigener
   Doku-Commit, gezielt stagen, kein Amend). `slice-scope` akzeptiert nur die Dateien oben.
7. **Späterer Nachweis, nicht Teil dieser Abnahme:** Der 031b-Test 002 im Projekt `http` ruft nach dem Umsortieren auf,
   wartet dabei auf `data-busy` ohne `"true"` und erhält kein 412.

## Wirkung und Risiko (Leitplanken §4, mittel)

- Nebenläufigkeit: Die Seite übernimmt Versionen nur vom Server, nie selbst hochgezählt. Ein zweiter Schreiber mit
  alter Version bekommt weiter 412 (6.3). Das Busy-Fenster dauert so lange wie das Schreiben (lokal unter 100 ms,
  CI http bis ca. 1 s).
- Restfall: Ein Neuladen, das vor dem COMMIT des Umsortierens gestartet ist (z. B. der 30-s-Takt), kann nach dem
  Erfolg mit älteren Zeilen eintreffen. Der Override fällt dann nach 010d weg, und bis zum Neuladen aus takt-030 zeigt
  die Liste die alte Reihenfolge und die alten Versionen. Ein Aufruf in diesem Fenster endet mit 412 und Neuladen wie
  heute, also kein Datenfehler.
- Barrierefreiheit (6.9): `aria-busy` an der Runde. Deaktivierte Knöpfe behalten ihre `aria-label`. Der Fokus bleibt
  am Ziehgriff, den dnd-kit nach dem Ablegen fokussiert. Die Scheibe verschiebt keinen Fokus.
- Betrieb: kein zusätzlicher Aufruf, die Antwort wird nur nicht mehr verworfen.
- Kein Hoch-Auslöser. Berührt der Bau doch Rechte, Identität oder Persistenz, gilt hoch, und das ist ein Scope-Befund.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: mittel
Ausgelöst: [x] Oberfläche, Barrierefreiheit [x] Persistenz, Migration, Nebenläufigkeit (nur clientseitige Versionsführung, kein Speicher)
Perspektive(n): UX/Barrierefreiheit (6.9), Nebenläufigkeit (6.3) · Nachweise: Unit- und Komponententests, Screenshot · Offene Entscheidung: keine E-Nummer

## Vor dem Bau prüfen

Nach dem Merge von takt-030: `Page.tsx` (`onDragEnd`, `run`, `actions`, Override-Regel 010d), `RoundSection.tsx`,
`SpeakerRow.tsx` (`busy`, `useSortable`), `NowSpeaking.tsx` (`busyId`), `useSpeakers.ts` (`reload`, `listVersion`),
`apps/web/src/api/http.ts` (Hörer nach 2xx aus takt-030). Weichen die Zeilenangaben im Befund ab oder fehlt eine
Datei, melden und anhalten.

## Offene Fragen

1. Soll ein späterer Takt auch die Listenversion aus der Antwort übernehmen (`lastWriteEtag()` nach dem Schreiben)?
   Damit schlösse sich das 412-Fenster für Anmelden und zweites Umsortieren. Standard bis zur Entscheidung: nein, nur
   Folgeliste.
2. R2 verlangt für Oberflächenarbeit einen Screenshot. Der Busy-Zustand ist im Demo-Modus nicht fotografierbar.
   Standard: Screenshot des Endzustands plus Komponententest. Ein Bild aus dem Projekt `http` kommt mit 031b.

## Nachweis

_offen (Gates-Commit, wörtlicher Schluss von `pnpm gates`, Screenshot)_

## Review findings

_offen_
