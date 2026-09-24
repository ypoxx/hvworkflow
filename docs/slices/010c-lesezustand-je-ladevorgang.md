# 010c — Lesezustand je Ladevorgang

**Status:** review bestanden (Runde 4, 24.09.)
**Risikoklasse:** niedrig · 0,75 AStd · Lanes: web-speakers, web-capture, web-answers, web-stage, web-history, e2e (eigene
Datei). Startet nach takt-008 (dieselben Feature-Verzeichnisse).
**Rolle:** Implementierer-Oberfläche; Review in frischem Kontext (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 10, 12; docs/design-prinzipien.md (leere und verweigerte Zustände)
**Quellen-IDs:** `docs/slices/010b-lesepfade-oberflaeche.md`, Abschnitt „Codex auf `adec621` — Folgepunkte" (Punkte 1–4)
und Runde 5 (Serverfilter-Toast)
**Depends on:** 010b (gemergt `0a5eae3`), takt-008 (gemergt `c6ad01f`)
**Perspektive:** Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Festlegung des Architekten

010b hat den gestalteten Zustand „keine Leseberechtigung" gebaut und Detailfehler bei verweigerter Liste als Klasse
behandelt (`createDetailProblemGate`). Übrig ist eine zweite Klasse: **Verweigerung und Fehler hängen nicht an dem
Ladevorgang, der sie erzeugt hat.** Nach einem Rollenwechsel von verweigert zu berechtigt bleibt „keine
Leseberechtigung" stehen, wenn der erste Abruf der neuen Rolle mit einem gewöhnlichen Fehler scheitert. Lösung als Muster,
nicht je Stelle: Jeder Lesezustand (bereit, lädt, verweigert, Fehler) trägt den Schlüssel seines Ladevorgangs (Akteur und
`version`), und eine Ansicht zeigt nur Zustände des aktuellen Schlüssels. Ein gemeinsamer Ort außerhalb der Feature-Ordner
ist nicht erlaubt (Vorbild `stage/lib.ts`); das Muster steht daher je Feature in dessen `lib.ts` oder `use*.ts`, mit
derselben Testtabelle.

## Ziel

1. `answers/useBacklog.ts`: `listForbidden` gehört zum Ladevorgang; ein gewöhnlicher Fehler der neuen Rolle hebt es auf.
2. `history/Page.tsx`: `historyForbidden` (Zeitleiste) und `streamForbidden` (Ereignisstrom) ebenso.
3. `capture/Page.tsx`: `needsProbe` wartet `speakers.settled` für den aktuellen Schlüssel ab (kein ungefilterter Abruf beim
   Wechsel von verweigert zu berechtigt).
4. `speakers/` und `stage/`: prüfen, ob dieselbe Klasse vorkommt; wenn ja, gleich behandeln, sonst im Bericht begründen.
5. Serverfilter-Toast (Beantwortung, Runde 5 von 010b): mit Filter kennt die Liste die ausgelassenen Fragen nicht. Lösung
   nach Wahl, begründet: Detailfehler einer Auswahl, die die gefilterte Liste nicht enthält, nach einem Rollenwechsel
   schlucken — oder im Bericht als bewusst offen führen, wenn es nur mit zweiter Liste ginge.

6. Folgepunkte aus der Nachprüfung von takt-008 (N1–N3, dieselbe Klasse bei Schreibsperren): Fokusmerker
   `stepTaken`/`nextPressed` erst setzen oder löschen, wenn der nachgelesene Stand gerendert ist (nach 412 fällt der
   Fokus sonst auf BODY); Fehler eines älteren Schreibens gibt nur die eigene Sperre frei; `deliver` ohne Schreiben
   löscht `nextPressed`. Je Punkt ein Test (Fehler-Patch über das In-Process-`HvApi`).

## Nicht-Ziele

Keine Änderung an Kern, Vertrag, Dienst, Rechten; keine neue Komponente, kein neues Token; kein gemeinsamer Ordner
außerhalb der Features.

## Files allowed

- `apps/web/src/features/{speakers,capture,answers,stage,history}/**`
- `apps/web/e2e/010c-lesezustand.spec.ts` (neu)
- `docs/slices/010c-lesezustand-je-ladevorgang.md`
- `docs/evidence/010c-*.png` (Nachtrag des Architekten 24.09.: Beweis-Screenshot nach Regel 2, Review-Befund 8)

## Akzeptanzkriterium

1. Je Ziel ein e2e, das vor der Änderung rot ist: verweigerte Rolle → berechtigte Rolle, erster Abruf mit 500 (Fehler-Patch
   über das In-Process-`HvApi` wie in 010b); danach kein „keine Leseberechtigung", genau ein Toast. Für Ziel 3: kein
   ungefilterter Abruf (Aufrufzähler).
2. Unit-Tabelle je Feature für den Schlüsselvergleich (überholter Ladevorgang meldet nicht).
3. Alle Playwright-Szenarien grün, axe ohne serious/critical; `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt` nach takt-008, Branch `claude/slice-010c-lesezustand` vom Integrationsbranch.
- Playwright mit eigenem Port, Chromium unter `/opt/pw-browsers`; danach `git checkout -- docs/evidence`.
- Logdateien nur über `mktemp`. Jeder Commit nennt „Scheibe 010c" und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

**Status:** review bestanden (Runde 4, 24.09.)
`7f17174` (Bericht). Runde 1: `5c83da4` (e2e, rot auf `7f17174`), `5a4f3c5` (Änderung), `30032b7` (Screenshot
und Bericht). Runde 2: `c43e7a2` (e2e, rot auf `30032b7`), `cae59a5` (Änderung), `6703a26` (Bericht). Runde 3:
`a59760b` (e2e, rot auf `6703a26`), `439f737` (Änderung, **letzter Code-Commit**), dieser Commit (Bericht).

```
Slice: 010c-lesezustand-je-ladevorgang
Done: Jeder Lesezustand trägt den Schlüssel seines Ladevorgangs (Akteur und version); je Feature
      loadKey/isCurrentLoad/readVerdict mit derselben Unit-Tabelle, in allen fünf Ansichten benutzt. Eine
      Verweigerung gehört dem Akteur: ein Fehler der neuen Rolle hebt sie auf, ein Fehler derselben Rolle nicht;
      Erfassungssonde wartet speakers.settled ab; Antworten der vorigen Rolle verfallen (auch Detailabrufe der
      Beantwortung); Serverfilter: für eine Auswahl eines anderen Akteurs wird nur der maskierte 404
      geschluckt, jeder andere Fehler gemeldet — unabhängig von der Reihenfolge der Fehler (das Gate hält alle
      Fehler eines Durchgangs); takt-008 N1–N3 behoben.
Evidence: pnpm gates auf 439f737, Exit 0 (Schluss unten, einmal, wörtlich); Playwright 70/70, 010c-Datei
      27/27, --repeat-each=3 zweimal: 81/81 und 81/81; rote Läufe: Runde 0 14 rot / 2 grün auf 452e89e,
      Runde 1 8 rot / 15 grün auf 7f17174, Runde 2 2 rot / 23 grün auf 30032b7, Runde 3 2 rot / 25 grün auf
      6703a26 (jeweils genau die neuen bzw. umgedrehten Tests rot); docs/evidence/010c-beantwortung-erster-abruf-500.png.
Open: siehe "Offen" unten (Daten der vorigen Rolle bis zur ersten Antwort und „Kein Treffer" nach einem
      ersten 500 → 010d; zwei Toasts in der Historie).
Touched: siehe "Touched" unten.
```

### Nacharbeit Runde 3 (R3-1; Entscheidung des Architekten Runde 3)

- **R3-1:** `createDetailProblemGate` (in `answers/lib.ts` und `history/lib.ts` byte-gleich geändert) hält
  jetzt jeden Fehler eines Durchgangs statt nur des ersten. `flush` zeigt den ersten Fehler, den
  `omits(id, error)` nicht schluckt; ein Toast je Durchgang bleibt, ein Durchgang ohne solchen Fehler zeigt
  keinen. Damit entscheidet die Reihenfolge nicht mehr: ein maskierter 404 der einen Detailabfrage, der vor
  dem 5xx der anderen ankommt, verdeckt ihn nicht mehr, wenn die Liste zuletzt antwortet.
- Unit-Zeile in beiden `lib.test.ts` (Gate-Blöcke weiter byte-gleich): 404, dann 500, dann Liste ohne die
  Auswahl → gezeigt `[500]`; dazu die Spiegelung (500, dann 404 → `[500]`) und zwei 404 → nichts.
- Zwei e2e „Runde 3 (R3-1)" (Liste 600 ms verzögert; der 500 der einen Detailabfrage kommt 150 ms nach dem
  404 der anderen; Wechsel zu observer → genau ein Toast), in beiden Reihenfolgen: `getQuestion` 500 nach
  dem 404 von `getQuestionHistory` und umgekehrt. Beide rot auf `6703a26`.
- Die Sonde der Nachprüfung (`zz-probe-r3.spec.ts`, P1–P12, C1, D10) lief einmal, vorübergehend nach
  `apps/web/e2e/` kopiert und danach wieder gelöscht, gegen `439f737`: `20 passed (1.4m)`. Sie ist nicht
  eingecheckt.

### Nacharbeit Runde 2 (N1–N3; Entscheidung des Architekten Runde 2)

- **N1/N2 (Befund 1 neu gefasst):** Die Übernahme der Auswahl nach der ersten Listenantwort (Runde 1,
  `adoptSelection`, `version:nonce`) ist entfernt; sie hat den maskierten 404 einer für die neue Rolle
  unlesbaren Auswahl ab dem zweiten Ladevorgang bei jedem Ereignis als Toast gemeldet. Jetzt gilt die
  Markierung „Auswahl von anderem Akteur" (`selectedBy`) so lange wie die Auswahl, wie auf `7f17174`, und
  `listOmits` verschluckt in diesem Fall nur den 404: ein 5xx und jeder andere Fehler wird gemeldet, auch
  im ersten Ladevorgang nach dem Wechsel. Dafür reicht das Gate den Fehler an `omits(id, error)` weiter
  (`createDetailProblemGate` in `answers/lib.ts` und `history/lib.ts`, beide Kopien gleich geändert, je ein
  neuer Testfall; die vollständige Liste lässt wie bisher jeden Fehler aus). Befund 1 bleibt behoben: der
  Befund-1-e2e (moderation liest die Auswahl, Suche ohne sie, 500 → genau ein Toast) ist grün.
  Neue e2e: „Runde 2 (N1)" (Ziel-5-Aufbau, dann zwei fremde Ereignisse → nach jedem 0 Toasts) und „Runde 2"
  (Ziel-5-Aufbau, erste Detailabfrage nach dem Wechsel mit 500 → genau ein Toast); beide rot auf `30032b7`.
- **N2 (Wiederholungszahl):** Der Bericht der Runde 1 nannte `69 passed` für einen `--repeat-each=3`-Lauf.
  Dieser eine Lauf war echt, aber nicht belastbar: die Nachprüfung sah „Ziel 5" 1 von 3 rot, Ursache war N1
  (die Übernahme im selben Ladevorgang). Jetzt zwei dateiweite Läufe `--repeat-each=3`, beide unten.
- **N3:** Zeile „keine Lesevorgänge" in der `readVerdict`-Tabelle, in allen fünf Kopien byte-gleich (md5
  verglichen): dieselbe Rolle behält ihr Urteil, eine andere beginnt ohne Verweigerung. Dazu ein Kommentar
  an der Stelle in `capture/Page.tsx`, die `readVerdict` ohne Lesevorgang ruft.

### Nacharbeit Runde 1 (Befunde 1, 3, 4, 6, 8, 9; Entscheidung des Architekten)

- **Befund 1** (in Runde 2 ersetzt, siehe oben) (`answers/useBacklog.ts`): `selectedBy` hielt Akteur und Ladevorgang. Die Auswahl gilt als
  „von einem anderen Akteur" nur bis zum Ladevorgang (`version:nonce`), in dem die Liste der neuen Rolle zum
  ersten Mal geantwortet hat; ab dem nächsten gehört sie der neuen Rolle, und ein echter Fehler der
  Detailabfrage zeigt wieder einen Toast. Den ganzen Ladevorgang, nicht nur die erste Antwort: eine
  Filteränderung setzt denselben Ladevorgang im Gate neu (`settleMain`) und hätte den geschluckten
  maskierten 404 dieses Ladevorgangs sonst doch noch als Toast gezeigt (beim ersten Versuch, nur die erste
  Antwort zu zählen, wurde „Ziel 5" in `--repeat-each=3` zweimal rot — daher diese Fassung).
- **Befund 3**: `getQuestion`, `getQuestionHistory` und Einheiten/TOP der Beantwortung mit
  `requested`/`current()` und `isCurrentLoad`. Zwei e2e mit gehaltener Antwort der vorigen Rolle, in der
  Lücke übergeben: „Freigeben" verschwindet nicht, `answers-history-forbidden` erscheint nicht.
- **Befund 4 (nur der neue Bühnenfall, dazu dieselbe Regel überall):** `readVerdict(previous, reads, actorId)`
  hält das Urteil mit seinem Akteur (`ReadVerdict`). Eine Verweigerung wird ersetzt durch eine Antwort
  „bereit" oder eine Verweigerung, und durch einen Fehler nur, wenn sich der Akteur geändert hat; ein
  gewöhnlicher Fehler derselben Rolle (nur neue `version`) lässt sie stehen, der Toast erscheint trotzdem.
  Mehrere Abrufe (Historie): die Verweigerung bleibt nur, wenn alle scheitern. Angewandt in allen fünf
  Ansichten über `readVerdict`: Beantwortung, Historie (Hauptabfrage, Zeitleiste, Ereignisstrom),
  Wortmeldeliste (`useSpeakers` leitet `status` aus dem Urteil ab), Erfassung (das Urteil liest den Abruf,
  der wirklich gefragt hat: Sonde oder Abruf je Wortmeldung), Bühne (der Akteurwechsel setzt das Urteil
  weiter im Render zurück). Der bisherige e2e „Bühne — dieselbe Rolle … der Fehler löst die Verweigerung ab"
  ist umgedreht und als Tabelle über alle fünf Ansichten geführt. „Kein Treffer" nach einem ersten 500 in der
  Beantwortung bleibt wie vorgegeben für 010d.
- **Befund 6:** `settledFor` ist nicht mehr exportiert (in `readVerdict` aufgegangen). `readVerdict`,
  `KeyedRead`, `ReadVerdict`, `NO_VERDICT` werden durch Befund 4 in allen fünf Features benutzt, auch in
  speakers, stage und capture; darum bleiben sie. Die fünf Kopien (Code und Tabelle) sind weiter
  byte-gleich (md5 der Blöcke verglichen).
- **Befund 8:** `docs/evidence/010c-beantwortung-erster-abruf-500.png`, aufgenommen im e2e „Ziel 1"
  (podium → expert, erste Liste 500): Toast sichtbar, kein „keine Leseberechtigung". Zu sehen ist auch der
  vorbestehende Leerzustand „Kein Treffer" (Befund 4, Teil Beantwortung, geht an 010d).
- **Befund 9:** Status-Zeile gesetzt.

### Das Muster

Je Feature eine lokale Kopie (kein gemeinsamer Ordner, Vorbild `stage/lib.ts`), in `answers/lib.ts`,
`history/lib.ts`, `stage/lib.ts`, `speakers/useSpeakers.ts`, `capture/useCapture.ts`:
- `loadKey(actorId, version)`: der Schlüssel eines Ladevorgangs.
- `isCurrentLoad(requested, current)`: eine Antwort zählt nur für ihren eigenen Ladevorgang. `current` wird
  im Moment der Antwort gebildet (`getActor()` aus dem Akteur-Speicher, `null` nach dem Aufräumen des
  Effekts). Damit verfällt auch eine Antwort, die in der Lücke zwischen Akteurwechsel und `version`-Sprung
  ankommt (dieselbe Regel wie Codex P2-B aus 010b auf der Bühne, jetzt überall).
- `readVerdict(previous, reads, actorId)`: das Urteil „keine Leseberechtigung" ändert sich erst, wenn alle
  Abrufe, von denen es abhängt, für den aktuellen Schlüssel geantwortet haben. Bis dahin steht das vorige
  Urteil (kein Flackern, Prinzip 8; Befund 7 vom Architekten so angenommen). Dann gilt: eine Verweigerung
  setzt es, „bereit" hebt es auf, ein Fehler hebt es nur auf, wenn das vorige Urteil einem anderen Akteur
  galt. Ein unverändertes Urteil ist dasselbe Objekt (darf im Render gespeichert werden, ohne Schleife).
- Unit-Tabelle (13 Fälle, in allen fünf `*.test.ts` gleich): gleicher Schlüssel, neuere `version`,
  anderer Akteur bei gleicher `version`, verlassene Ansicht, keine Kollision, Fehler der neuen Rolle hebt
  auf, Fehler derselben Rolle hält, Verweigerung/Bereit, laufender Ladevorgang lässt das Urteil stehen,
  unverändertes Urteil ist dasselbe Objekt, mehrere Abrufe, dieselbe Rolle hält nur bei lauter Fehlern,
  keine Lesevorgänge (Runde 2, N3).

### Je Ziel

1. `answers/useBacklog.ts`: `listRead` (Schlüssel und Status) statt `setListForbidden`; `listForbidden`
   kommt aus `readVerdict`. Ein 500 der neuen Rolle hebt die Verweigerung auf, einer derselben Rolle nicht.
2. `history/Page.tsx`: Zeitleiste (Schlüssel mit gewählter Frage), Ereignisstrom und — dieselbe Klasse —
   die Hauptabfrage (`corpus` und Trefferliste, beide müssen geantwortet haben) je mit Schlüssel und
   `readVerdict`. Auch `listSpeakers` (Namen) verwirft Antworten der vorigen Rolle.
3. `capture`: `useAsync` bildet den Schlüssel mit dem Akteur (`settled` ist im Render direkt nach dem
   Akteurwechsel falsch) und gibt `read`/`key` für `readVerdict` heraus; `needsProbe` wartet
   `speakers.settled` ab. Kein ungefilterter Abruf mehr beim Wechsel von verweigert zu berechtigt.
4. **Wortmeldeliste:** eine Verweigerung der vorigen Rolle, die zwischen Akteurwechsel und `version`-Sprung
   ankam, wurde übernommen (e2e rot); jetzt `isCurrentLoad`, und das Urteil kommt aus `readVerdict`.
   **Bühne:** nach einem Rollenwechsel kam die Klasse nicht vor, weil der Akteurwechsel das Urteil schon im
   Render zurücksetzt (Minor B, Runde 4 von 010b) — der e2e „expert → admin, 500" war vorher schon grün.
   Gleich behandelt trotzdem: Schlüssel statt `requestedBy`, die Sonde für „Nur Bühne" verwirft Antworten
   der vorigen Rolle, das Urteil kommt aus `readVerdict` (bei derselben Rolle bleibt die Verweigerung nach
   einem 500, Befund 4).
5. **Serverfilter-Toast — gelöst, nicht offen.** `listOmits` (answers/lib.ts, mit Unit-Tests): eine
   gefilterte Liste gilt als „lässt die Auswahl aus", wenn die Auswahl von einem anderen Akteur stammt —
   seit Runde 2 nur für den maskierten 404, so lange die Auswahl besteht; ein 5xx oder anderer Fehler wird
   immer gemeldet. Begründung: direkt nach einem Rollenwechsel ist
   eine Auswahl, die die Liste der neuen Rolle nicht enthält, nicht von einer unlesbaren zu unterscheiden
   (der maskierte 404 ist Absicht, Festlegung 3 von 010); ein Toast dort wäre irreführend. Eine zweite,
   ungefilterte Liste wäre ein zusätzlicher Vollabruf je `version` nur für diesen Randfall. Ohne
   Rollenwechsel bleibt alles wie bisher (Gegenprobe: genau ein Toast).
6. takt-008 N1–N3:
   - **N1:** Der Fokusmerker hält den Stand, auf dem gedrückt wurde (`QuestionDetail.tsx`: die Frage,
     `Podium.tsx`: die `StageView`). Er wird erst gelöscht, wenn ein danach gelesener Stand gerendert ist
     und der Knopf den Fokus behalten hat; fällt der Fokus auf BODY, geht er auf `approval-block` bzw.
     `stage-current`.
   - **N2:** `answers/Page.tsx` und `stage/Page.tsx` geben bei einer Ablehnung nur die eigene Sperre frei
     (Vergleich über das Sperrobjekt). Auf der Bühne gibt ein gescheitertes Nachlesen die Sperre nur frei,
     wenn das Schreiben schon geantwortet hat (`DeliverLock.answered`).
   - **N3:** `deliver` meldet, ob es geschrieben hat; `Podium` setzt den Merker nur dann.

### Evidence

**`pnpm gates` auf `439f737` (letzter Code-Commit), Exit 0.** Tests: domain 86, web 159, api 57, scripts
206/206. `slice-scope` meldet dazu eine Warnung, weil der Architekt „Files allowed" nach `452e89e` um
`docs/evidence/010c-*.png` ergänzt hat (`b85b080`): `slice-scope: warning — "docs/slices/010c-lesezustand-je-ladevorgang.md"'s
"Files allowed" section differs from its version at the commit that introduced it (452e89e).` und
`slice-scope: 20 changed file(s), all within "docs/slices/010c-lesezustand-je-ladevorgang.md"'s "Files allowed"
list (4 pattern(s)).` Schluss wörtlich (nur ANSI-Farbcodes entfernt):

```
> @hv/web@0.0.0 build /home/user/wt/takt/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1715 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-BHYxwywz.css                        40.30 kB │ gzip:   8.71 kB
dist/assets/index-DlBe9xYy.js                        568.48 kB │ gzip: 166.24 kB │ map: 2,343.99 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.64s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 439f737, tree 3ab291049c6c…
```

**Playwright** (eigener Port 5147, Chromium unter `/opt/pw-browsers`), auf dem Baum von `439f737`:
- ganze Suite: `70 passed (5.1m)`, axe in allen Szenarien „0 serious/critical".
- `e2e/010c-lesezustand.spec.ts` dateiweit mit `--repeat-each=3`, zwei Läufe nacheinander: `81 passed (3.0m)`
  und `81 passed (3.0m)` (je 27 Tests × 3, kein Fehlschlag).
- Der Screenshot `010c-beantwortung-erster-abruf-500.png` bleibt der aus `30032b7` (Ansicht unverändert);
  alle von den Läufen überschriebenen PNGs wurden mit `git checkout -- docs/evidence` zurückgesetzt.

**Roter Lauf Runde 3** der e2e-Datei aus `a59760b` gegen den Code von `6703a26` (`git stash` nur
`apps/web/src`): `2 failed, 25 passed (1.6m)`, rot sind genau die zwei neuen Tests:

```
  ✘  16 … 010c Runde 3 (R3-1): Beantwortung — Liste zuletzt, getQuestion 500 nach dem 404 von getQuestionHistory, Wechsel zu observer: ein Toast   Toasts  Expected: 1  Received: 0
  ✘  17 … 010c Runde 3 (R3-1): Beantwortung — Liste zuletzt, getQuestionHistory 500 nach dem 404 von getQuestion, Wechsel zu observer: ein Toast   Toasts  Expected: 1  Received: 0
  2 failed
  25 passed (1.6m)
```

**Roter Lauf Runde 2** der e2e-Datei aus `c43e7a2` gegen den Code von `30032b7` (`git stash` nur
`apps/web/src`): `2 failed, 23 passed`, rot sind genau die zwei neuen Tests:

```
  ✘  14 … 010c Runde 2 (N1): Beantwortung — Suche aktiv, Wechsel zu observer, danach zwei fremde Ereignisse: kein Toast   Toasts  Expected: 0  Received: 1
  ✘  15 … 010c Runde 2: Beantwortung — Suche aktiv, Wechsel zu observer, erste Detailabfrage mit 500: ein Toast           Toasts  Expected: 1  Received: 0
  2 failed
  23 passed (1.5m)
```

**Roter Lauf Runde 1** der e2e-Datei aus `5c83da4` gegen den Code von `7f17174` (`git stash` nur
`apps/web/src`): `8 failed, 15 passed`, rot sind genau die acht neuen bzw. umgedrehten Tests. Ergebniszeilen
zusammengezogen wie unten, rechts die Assertion aus demselben Lauf:

```
  ✘   8 … 010c Befund 4: Beantwortung — dieselbe Rolle, Verweigerung, dann 500 …     answers-forbidden  Expected: visible  (element(s) not found)
  ✘   9 … 010c Befund 4: Historie — dieselbe Rolle …                                 history-forbidden  Expected: visible  (element(s) not found)
  ✘  10 … 010c Befund 4: Wortmeldeliste — dieselbe Rolle …                           speakers-forbidden  Expected: visible  (element(s) not found)
  ✘  11 … 010c Befund 4: Erfassung — dieselbe Rolle …                                capture-forbidden  Expected: visible  (element(s) not found)
  ✘  12 … 010c Befund 4: Bühne — dieselbe Rolle …                                    stage-forbidden  Expected: visible  (element(s) not found)
  ✘  15 … 010c Befund 1: Beantwortung — neue Rolle liest die Auswahl, Suche ohne sie, 500   Toasts  Expected: 1  Received: 0
  ✘  16 … 010c Befund 3: Beantwortung — Einzelfrage der vorigen Rolle …              __saw (answer-approve entfernt)  Expected: false  Received: true
  ✘  17 … 010c Befund 3: Beantwortung — Verlaufsverweigerung der vorigen Rolle …     __saw (answers-history-forbidden)  Expected: false  Received: true
  8 failed
  15 passed
```

**Roter Lauf Runde 0** (erste Fassung der e2e-Datei) gegen den Code von `452e89e` (`git stash` nur `apps/web/src`):
`14 failed, 2 passed`. Wörtlich die Ergebniszeilen (Laufzeiten, Stacks und Call-Logs weggelassen):

```
  ✘   1 … 010c Ziel 1: Beantwortung — podium → expert, erste Liste mit 500 …            answers-forbidden  Expected: 0  Received: 1
  ✘   2 … 010c Ziel 2: Historie, Zeitleiste — observer → admin …                        history-timeline-forbidden  Expected: 0  Received: 1
  ✘   3 … 010c Ziel 2: Historie, Ereignisstrom — observer → admin …                     history-stream-forbidden  Expected: 0  Received: 1
  ✘   4 … 010c Ziel 2 (dieselbe Klasse): Historie, Hauptabfrage — podium → admin …      history-forbidden  Expected: 0  Received: 1
  ✘   5 … 010c Ziel 3: Erfassung — observer → moderation …                              calls.filter(null)  Expected: []  Received: [null] (ein ungefilterter Abruf)
  ✘   6 … 010c Ziel 4: Wortmeldeliste — Verweigerung der vorigen Rolle …                __sawForbidden  Expected: false  Received: true
  ✓   7 … 010c Ziel 4: Bühne — expert → admin, erster Abruf mit 500 …                   (Klasse kommt nicht vor, siehe Ziel 4)
  ✘   8 … 010c Ziel 4: Bühne — dieselbe Rolle, Verweigerung, dann 500 …                 stage-forbidden  Expected: 0  Received: 1  (Test in Runde 1 umgedreht, siehe Befund 4)
  ✘   9 … 010c Ziel 5: Beantwortung — Suche aktiv, Wechsel zu observer …                Toasts  Expected: 0  Received: 1
  ✓  10 … 010c Ziel 5 (Gegenprobe): … dieselbe Rolle, Detail mit 500: der Toast bleibt  (Gegenprobe, soll grün bleiben)
  ✘  11 … 010c Ziel 6 (N1): Beantwortung — nach einem 412 auf "Freigeben" …             Fokus  Expected: "approval-block"  Received: "BODY"
  ✘  12 … 010c Ziel 6 (N1): Bühne — nach einem 412 auf "Vorgelesen, weiter" …          Fokus  Expected: "stage-current"  Received: "BODY"
  ✘  13 … 010c Ziel 6 (N2): Beantwortung — Fehler eines älteren Schreibens …            aria-disabled  Expected: "true"  Received: "false"
  ✘  14 … 010c Ziel 6 (N2): Bühne — Fehler eines älteren "Vorgelesen" …                 aria-disabled  Expected: "true"  Received: "false"
  ✘  15 … 010c Ziel 6 (N2): Bühne — gescheitertes Nachlesen …                           aria-disabled  Expected: "true"  Received: "false"
  ✘  16 … 010c Ziel 6 (N3): Bühne — Druck ohne Schreiben …                              Fokus  Expected: not "stage-current"
  14 failed
  2 passed
```

(Die Zeilen sind zu einer Tabelle zusammengezogen: Testtitel gekürzt, rechts die Assertion, an der der
Test scheiterte, aus demselben Lauf.) Die Fehler-Patches wickeln eine `HvApi`-Methode im laufenden
In-Process-API ein wie in `010b-lesepfade.spec.ts`; die Wortmeldung „von jemand anderem" schreibt die
Administration, Akteur im selben Task gesetzt und zurückgesetzt (die Ansicht sieht keinen Akteurwechsel).

### Offen

- **An 010d (Entscheidung des Architekten):** Zeilen und `_actions` der vorigen Rolle bis zur ersten
  Antwort (Befund 2), „Kein Treffer … Auswahl zurücksetzen" nach einem ersten 500 in der Beantwortung
  (Befund 4, vorbestehender Teil, auch im Screenshot zu sehen), Ausgang eines älteren Schreibens auf der
  jetzt gezeigten Frage (Befund 5).
- **Historie, beide Hauptabfragen scheitern:** zwei Toasts (einer je Abruf), vorher genauso.
- **Ziel 5, Restpreis:** für eine Auswahl eines anderen Akteurs, die die gefilterte Liste der neuen Rolle
  nicht enthält, wird ein 404 der Detailabfrage geschluckt, so lange die Auswahl besteht. Ein 404 heißt hier
  immer „nicht lesbar oder nicht vorhanden" (maskiert, Festlegung 3 von 010); jeder andere Fehler zeigt
  einen Toast.

### Touched

- `apps/web/e2e/010c-lesezustand.spec.ts` (neu)
- `apps/web/src/features/answers/Page.tsx`, `QuestionDetail.tsx`, `lib.ts`, `lib.test.ts`, `useBacklog.ts`
- `apps/web/src/features/capture/Page.tsx`, `useCapture.ts`, `useCapture.test.ts`
- `apps/web/src/features/history/Page.tsx`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/speakers/useSpeakers.ts`, `useSpeakers.test.ts`
- `apps/web/src/features/stage/Page.tsx`, `Podium.tsx`, `lib.ts`, `lib.test.ts`
- `docs/evidence/010c-beantwortung-erster-abruf-500.png` (neu)
- `docs/slices/010c-lesezustand-je-ladevorgang.md` (Status und Bericht)

## Review findings

Runde 1 (Opus 5.5, frischer Kontext, Perspektive Barrierefreiheit und Lesezustände; HEAD `7f17174`): Gates exit 0,
Playwright 59/59, axe ohne serious/critical; roter Lauf auf `c6ad01f` 14 rot / 2 grün bestätigt; die fünf Kopien des
Musters sind byte-gleich. Kein Rechteproblem (Server lehnt jeden Schreibversuch über veraltete `_actions` ab). Urteil:
mergebereit mit Auflagen.

1. **minor** — Ziel 5 verschluckt echte Fehler, solange die Auswahl besteht, nicht nur direkt nach dem Wechsel
   (`answers/useBacklog.ts:204, 248`, `answers/lib.ts:241`; `selectedBy` wird nur bei neuer Auswahl zurückgesetzt).
   Sonde: admin wählt Zeile 0 → Wechsel zu moderation (liest sie) → Suche → `getQuestion` 500 → 0 Toasts (vorher 1).
2. **minor, vorher schon da** — Zeilen und `_actions` der vorigen Rolle bleiben nach dem Wechsel bis zur ersten
   Antwort bedienbar; Server lehnt ab (maskierter 404, Toast mit englischem Titel). Verstößt kurz gegen D9 („was nicht
   erlaubt ist, wird nicht angeboten“), nicht gegen Regel 4.
3. **minor** — Muster in den Detail-Lesevorgängen der Beantwortung unvollständig (`useBacklog.ts:267` `getQuestion`,
   `:292` `getQuestionHistory`, `:167` Einheiten/Tagesordnung nur mit `cancelled`).
4. **minor** — Nach einem Fehler zeigt die Ansicht einen leeren Zustand mit falscher Aussage: Beantwortung „Kein
   Treffer … Auswahl zurücksetzen“ (vorher schon so bei jedem ersten 500); Bühne, gleiche Rolle, 500 nach Verweigerung
   „Die Bühne ist frei“ (neu in 010c, `stage/Page.tsx:288`, `:507`, `Podium.tsx:216`).
5. **minor, vorher schon da (takt-008)** — Ausgang eines älteren Schreibens wirkt auf die jetzt gezeigte Frage
   (`answers/Page.tsx:98, 103, 132`, `QuestionDetail.tsx:214-218`): 412 zeigt „Stand veraltet“ über B, Erfolg schließt
   B's Dialog und leert B's Entwurf.
6. **nit** — `readVerdict`, `settledFor`, `KeyedRead` in speakers, stage, capture nur von Tests benutzt.
7. **nit** — Während des Ladens bleibt das Urteil des vorigen Schlüssels stehen, auch die Verweigerung einer anderen
   Rolle; weicht vom Wortlaut „nur Zustände des aktuellen Schlüssels“ ab.
8. **minor (Prozess)** — kein Screenshot in `docs/evidence/` (Files allowed ließ es nicht zu).
9. **nit** — Status-Zeile noch „spec“.

Entscheidung des Architekten:
- In dieser Scheibe beheben: 1 (mit e2e), 3, 4 nur für den neuen Bühnenfall (eine Verweigerung gehört dem Akteur:
  bei gleichem Akteur und nur neuer `version` bleibt sie stehen, bis eine Antwort des aktuellen Schlüssels sie
  ersetzt; ein gewöhnlicher Fehler derselben Rolle ersetzt sie nicht), 6 (ungenutzte Exporte entfernen, Tabelle für
  `loadKey`/`isCurrentLoad` bleibt je Feature), 8 (Files allowed ergänzt), 9.
- 7 angenommen: Das vorige Urteil bleibt bis zur ersten Antwort des neuen Schlüssels stehen, damit nichts flackert
  (Designprinzip 8); die Bühne setzt beim Akteurwechsel zurück, weil sie ohnehin neu aufbaut. Der Satz „zeigt nur
  Zustände des aktuellen Schlüssels“ gilt für Antworten, nicht für den Übergang.
- 2, 5 und der schon bestehende Teil von 4 (Beantwortung) gehen in die Folgescheibe 010d „Ansichtsdaten gehören dem
  Schlüssel des Akteurs; gestalteter Ladefehler; alte Schreibvorgänge wirken nur auf ihre Frage“.

Runde 2 (Nachprüfung, Opus 5.5, frischer Kontext, HEAD `30032b7`): Gates exit 0, Playwright 66/66, axe ohne
serious/critical. Befunde 3, 4, 6, 8 behoben (Regel „Verweigerung gehört dem Akteur“ in allen fünf Ansichten per Sonde
bestätigt, keine Falle nach Rechtewechsel; Musterblöcke und Tabellen byte-gleich). Befund 1 wie vorgegeben behoben, aber:

- **N1 major** — Nach der Übernahme der Auswahl durch die neue Rolle (erste Listenantwort) wird der maskierte 404 einer
  Auswahl, die die neue Rolle nicht lesen darf, ab dem zweiten Ladevorgang bei **jedem** Ereignis als Toast gemeldet
  (englischer Titel, Live-Region wiederholt). Sonde: admin wählt, sucht, Wechsel zu observer → 0, nach einem Ereignis
  1, nach zwei 2 Toasts; auf `7f17174` 0/0/0. Ursache ist die Vorgabe des Architekten zu Befund 1.
  (`answers/useBacklog.ts:202-207, 228-236, 248, 257`, `answers/lib.ts:236`)
- **N2 major (gleiche Ursache)** — e2e „Ziel 5 … kein Toast“ 1 von 3 rot im dateiweiten `--repeat-each=3`; der Bericht
  nennt 69/69.
- **N3 nit** — `capture/Page.tsx:124-129` ruft `readVerdict` ohne Lesevorgänge; die Tabellen decken den Fall nicht ab.
- Befund 9: Bericht nicht aktuell (Wiederholungszahl, Ziel 5).

Entscheidung des Architekten (Runde 2): Vorgabe zu Befund 1 wird ersetzt. Für „Auswahl von anderem Akteur“ wird nur ein
404 verschluckt; ein 5xx (und jeder andere Fehler) ist immer ein echter Fehler und wird gemeldet. Die Markierung gilt
dann so lange wie die Auswahl (wie auf `7f17174`). Befund 1 bleibt damit behoben, N1/N2 entfallen. Dazu ein e2e:
Ziel-5-Aufbau plus zwei fremde Ereignisse → 0 Toasts; und der Befund-1-e2e (500 → genau ein Toast) bleibt grün, auch im
ersten Ladevorgang nach dem Wechsel. N3: eine Tabellenzeile „keine Lesevorgänge“ in allen fünf Kopien. Bericht mit den
echten Wiederholungszahlen.

Runde 3 (Nachprüfung, Opus 5.5, frischer Kontext, HEAD `6703a26`): Gates exit 0, Playwright 68/68, axe ohne
serious/critical, 010c-Datei zweimal 75/75 mit `--repeat-each=3`. N1–N3 und die Befunde 3, 4, 6, 8 halten; Gate-Kopien
und Tabellen byte-gleich.

- **R3-1 major (eng)** — `report` im Detail-Gate behält nur den ersten Fehler eines Durchgangs
  (`answers/lib.ts:283` mit `:263-270`, ebenso `history/lib.ts:201`, `:181`). Seit `omits(id, error)` entscheidet die
  Reihenfolge: kommt der maskierte 404 von `getQuestionHistory` vor dem 5xx von `getQuestion` und antwortet die Liste
  zuletzt, wird der 5xx verworfen und der 404 geschluckt → kein Toast, leere Detailansicht. Sonde: `listQuestions`
  600 ms verzögert, `getQuestion` 500, Wechsel zu observer → 0 Toasts (P8–P11); Kontrolle ohne Wechsel 1.

Entscheidung des Architekten (Runde 3): im Gate (beide Kopien identisch) alle Fehler eines Durchgangs halten; `flush`
zeigt den ersten, den `omits(id, error)` nicht schluckt; ein Toast je Durchgang bleibt. Unit-Zeile in beiden
`lib.test.ts` (404, dann 500, dann Liste ohne die Auswahl → gezeigt: 500) und ein e2e mit verzögerter Liste und 500 nach
dem 404 → genau ein Toast, rot auf `6703a26`.

Runde 4 (enge Nachprüfung nur R3-1, Opus 5.5, frischer Kontext, HEAD `6a007a7`): Gate hält alle Fehler eines
Durchgangs, zeigt den ersten nicht geschluckten, ein Toast je Durchgang; zwölf Randfälle per Sonde grün (veralteter
Durchgang, veralteter Ladevorgang, Auswahlwechsel mitten im Durchgang, Pufferschranke, keine Liste). Neue e2e 10/10 mit
`--repeat-each=5`, rot auf dem alten Gate; Sonde der Runde 3 20/20; 010b + 010c 51/51; Gates exit 0. Urteil: mergebereit.

- **nit** — R3-1-e2e prüft nur die Anzahl der Toasts, nicht den Text (`010c-lesezustand.spec.ts:715-717`).
- **nit** — Unit-Tabelle deckt nur „Liste zuletzt“ ab, nicht „Liste zuerst“ (`answers/lib.test.ts:151`,
  `history/lib.test.ts:121`).

Entscheidung des Architekten (Runde 4): beide nits gehen nach 010d (Testschärfung, kein Verhaltensunterschied).
