# 010c — Lesezustand je Ladevorgang

**Status:** spec
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

**Status:** fertig, bereit für Review. Commits: `08b8f25` (e2e zuerst, rot), `4bf3a0c` (Änderung und
Unit-Tabellen), dieser Commit (Bericht).

```
Slice: 010c-lesezustand-je-ladevorgang
Done: Jeder Lesezustand trägt den Schlüssel seines Ladevorgangs (Akteur und version); je Feature
      loadKey/isCurrentLoad/settledFor/readVerdict mit derselben Unit-Tabelle. Ein Fehler der neuen Rolle
      hebt "keine Leseberechtigung" auf (Beantwortung, Historie ×3, Bühne), die Erfassungssonde wartet
      speakers.settled ab, Antworten der vorigen Rolle verfallen; Serverfilter-Toast und takt-008 N1–N3 behoben.
Evidence: pnpm gates auf 4bf3a0c, Exit 0 (Schluss unten wörtlich); Playwright 59/59, 010c-Datei 16/16
      (dazu --repeat-each=3: 48/48); roter Lauf vorher 14 rot / 2 grün (unten). Keine Screenshots
      (docs/evidence nicht in Files allowed).
Open: siehe "Offen" unten (Daten der vorigen Rolle bis zur ersten Antwort, zwei Toasts in der Historie,
      geschluckter Detailfehler nach Rollenwechsel mit Filter).
Touched: siehe "Touched" unten.
```

### Das Muster

Je Feature eine lokale Kopie (kein gemeinsamer Ordner, Vorbild `stage/lib.ts`), in `answers/lib.ts`,
`history/lib.ts`, `stage/lib.ts`, `speakers/useSpeakers.ts`, `capture/useCapture.ts`:
- `loadKey(actorId, version)`: der Schlüssel eines Ladevorgangs.
- `isCurrentLoad(requested, current)`: eine Antwort zählt nur für ihren eigenen Ladevorgang. `current` wird
  im Moment der Antwort gebildet (`getActor()` aus dem Akteur-Speicher, `null` nach dem Aufräumen des
  Effekts). Damit verfällt auch eine Antwort, die in der Lücke zwischen Akteurwechsel und `version`-Sprung
  ankommt (dieselbe Regel wie Codex P2-B aus 010b auf der Bühne, jetzt überall).
- `readVerdict(previous, reads)`: das Urteil „keine Leseberechtigung" ändert sich erst, wenn alle Abrufe,
  von denen es abhängt, für den aktuellen Schlüssel geantwortet haben; dann ersetzt ihre Antwort es, auch
  ein gewöhnlicher Fehler. Bis dahin steht das vorige Urteil (kein Flackern, Prinzip 8; so verlangt es
  schon der 010b-Test „Runde 5 (1)" der Erfassung).
- Unit-Tabelle (zehn Fälle, in allen fünf `*.test.ts` gleich): gleicher Schlüssel, neuere `version`,
  anderer Akteur bei gleicher `version`, verlassene Ansicht, keine Kollision, `settledFor`, Fehler löst
  Verweigerung ab, Verweigerung/Bereit, laufender Ladevorgang lässt das Urteil stehen, mehrere Abrufe.

### Je Ziel

1. `answers/useBacklog.ts`: `listRead` (Schlüssel und Status) statt `setListForbidden`; `listForbidden`
   kommt aus `readVerdict`. Ein 500 setzt `error` und hebt die Verweigerung auf.
2. `history/Page.tsx`: Zeitleiste (Schlüssel mit gewählter Frage), Ereignisstrom und — dieselbe Klasse —
   die Hauptabfrage (`corpus` und Trefferliste, beide müssen geantwortet haben) je mit Schlüssel und
   `readVerdict`. Auch `listSpeakers` (Namen) verwirft Antworten der vorigen Rolle.
3. `capture`: `useAsync` bildet den Schlüssel mit dem Akteur (`settled` ist im Render direkt nach dem
   Akteurwechsel falsch), `needsProbe` wartet `speakers.settled` ab. Kein ungefilterter Abruf mehr beim
   Wechsel von verweigert zu berechtigt (Aufrufzähler im e2e).
4. **Wortmeldeliste:** die Klasse „Fehler lässt Verweigerung stehen" kommt nicht vor (jede Antwort setzt
   den Status), wohl aber die Lücke: eine Verweigerung der vorigen Rolle, die zwischen Akteurwechsel und
   `version`-Sprung ankommt, wurde übernommen (e2e rot). Jetzt `isCurrentLoad`. **Bühne:** nach einem
   Rollenwechsel kommt die Klasse nicht vor, weil der Akteurwechsel das Urteil schon im Render zurücksetzt
   (Minor B, Runde 4 von 010b) — der e2e „expert → admin, 500" war vorher schon grün. Gleich behandelt
   trotzdem: der Schlüssel ersetzt `requestedBy`, die Sonde für „Nur Bühne" verwirft Antworten der vorigen
   Rolle, und bei derselben Rolle löst ein 500 eine Verweigerung des vorigen Ladevorgangs ab (e2e rot/grün).
5. **Serverfilter-Toast — gelöst, nicht offen.** `listOmits` (answers/lib.ts, mit Unit-Tests): eine
   gefilterte Liste gilt als „lässt die Auswahl aus", wenn die Auswahl von einem anderen Akteur stammt
   (`selectedBy`, gesetzt beim Wechsel der Auswahl). Begründung: direkt nach einem Rollenwechsel ist eine
   Auswahl, die die Liste der neuen Rolle nicht enthält, nicht von einer unlesbaren zu unterscheiden (der
   maskierte 404 ist Absicht, Festlegung 3 von 010); ein Toast dort wäre irreführend. Eine zweite,
   ungefilterte Liste wäre ein zusätzlicher Vollabruf je `version` nur für diesen Randfall. Ohne
   Rollenwechsel bleibt alles wie bisher: die Gegenprobe (dieselbe Rolle, Suche ohne die offene Frage,
   Detail 500) zeigt weiter genau einen Toast.
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

**`pnpm gates` auf `4bf3a0c`, Exit 0.** `slice-scope: 19 changed file(s), all within
"docs/slices/010c-lesezustand-je-ladevorgang.md"'s "Files allowed" list (3 pattern(s)).` Tests: domain 86,
web 140, api 57, scripts 206/206. Schluss wörtlich (nur ANSI-Farbcodes entfernt):

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
dist/assets/index-DMvNzZzF.js                        566.36 kB │ gzip: 165.83 kB │ map: 2,329.56 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.55s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 4bf3a0c, tree 7fa696723914…
```

**Playwright** (eigener Port 4917, Chromium unter `/opt/pw-browsers`):
- ganze Suite auf dem Baum von `4bf3a0c` (Tree `7fa6967`): `59 passed (5.2m)`, axe in allen Szenarien
  „0 serious/critical".
- `e2e/010c-lesezustand.spec.ts`: `16 passed (49.9s)`; mit `--repeat-each=3`: `48 passed (1.8m)`.

**Roter Lauf** der endgültigen e2e-Datei gegen den Code von `452e89e` (`git stash` nur `apps/web/src`):
`14 failed, 2 passed`. Wörtlich die Ergebniszeilen (Laufzeiten, Stacks und Call-Logs weggelassen):

```
  ✘   1 … 010c Ziel 1: Beantwortung — podium → expert, erste Liste mit 500 …            answers-forbidden  Expected: 0  Received: 1
  ✘   2 … 010c Ziel 2: Historie, Zeitleiste — observer → admin …                        history-timeline-forbidden  Expected: 0  Received: 1
  ✘   3 … 010c Ziel 2: Historie, Ereignisstrom — observer → admin …                     history-stream-forbidden  Expected: 0  Received: 1
  ✘   4 … 010c Ziel 2 (dieselbe Klasse): Historie, Hauptabfrage — podium → admin …      history-forbidden  Expected: 0  Received: 1
  ✘   5 … 010c Ziel 3: Erfassung — observer → moderation …                              calls.filter(null)  Expected: []  Received: [null] (ein ungefilterter Abruf)
  ✘   6 … 010c Ziel 4: Wortmeldeliste — Verweigerung der vorigen Rolle …                __sawForbidden  Expected: false  Received: true
  ✓   7 … 010c Ziel 4: Bühne — expert → admin, erster Abruf mit 500 …                   (Klasse kommt nicht vor, siehe Ziel 4)
  ✘   8 … 010c Ziel 4: Bühne — dieselbe Rolle, Verweigerung, dann 500 …                 stage-forbidden  Expected: 0  Received: 1
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

- **Daten der vorigen Rolle bis zur ersten Antwort** (bereit-Zustand mit `_actions`): Wortmeldeliste,
  Beantwortung, Historie und Erfassung zeigen nach einem Rollenwechsel die Zeilen der vorigen Rolle, bis
  die neue Rolle geantwortet hat (die Bühne setzt beim Akteurwechsel zurück). Nicht Ziel dieser Scheibe,
  die Schreibvorgänge entscheidet weiter der Dienst; nur im Demo erreichbar (in Produktion wechselt der
  Akteur nicht in der Sitzung). Kandidat für eine Folgescheibe, wenn gewünscht.
- **Historie, beide Hauptabfragen scheitern:** zwei Toasts (einer je Abruf). Vorher genauso; die
  Verweigerung hängt jetzt nicht mehr.
- **Ziel 5, bewusster Preis:** nach einem Rollenwechsel wird auch ein echter Fehler (500) der Detailabfrage
  einer Auswahl geschluckt, die die gefilterte Liste der neuen Rolle nicht enthält. Das Detail verschwindet
  trotzdem (die Abfrage scheitert).
- **Bühne, dieselbe Rolle, 500 nach Verweigerung:** statt „keine Leseberechtigung" steht nun die leere
  Bühne mit Toast, bis die nächste Antwort kommt (Regel des Musters: nur Zustände des aktuellen
  Schlüssels). Bei gespeichertem „Nur Bühne" ist das das leere Overlay.
- Keine Screenshots: `docs/evidence/` steht nicht in Files allowed; die Suite hat vorhandene PNGs
  überschrieben, sie wurden mit `git checkout -- docs/evidence` zurückgesetzt.

### Touched

- `apps/web/e2e/010c-lesezustand.spec.ts` (neu)
- `apps/web/src/features/answers/Page.tsx`, `QuestionDetail.tsx`, `lib.ts`, `lib.test.ts`, `useBacklog.ts`
- `apps/web/src/features/capture/Page.tsx`, `useCapture.ts`, `useCapture.test.ts`
- `apps/web/src/features/history/Page.tsx`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/speakers/useSpeakers.ts`, `useSpeakers.test.ts`
- `apps/web/src/features/stage/Page.tsx`, `Podium.tsx`, `lib.ts`, `lib.test.ts`
- `docs/slices/010c-lesezustand-je-ladevorgang.md` (dieser Bericht)

## Review findings

(vom Reviewer)
