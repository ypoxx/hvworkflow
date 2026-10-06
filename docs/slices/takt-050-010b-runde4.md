# takt-050 — 010b Runde 4 (B): „Resulting promise was garbage collected“ beim Laden der App-Module im Test

**Status:** gebaut · **Risikoklasse:** niedrig (nur e2e-Testcode, kein Produktivcode, kein Vertrag, keine Rechte, keine
Persistenz, kein Betrieb; Leitplanken §4) · ca. 2,5 AStd · 05.10.2026 · **Lanes:** web (e2e)
**Rolle:** builder; ein Review in frischem Kontext (Lean-Modus, AGENTS.md R3; Perspektive: Test-Determinismus), Modell nur
in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R12; 010c „CI-Befund auf `62f347b`“ und 010d Ziel 5 (gleiche Klasse, gleiche Abhilfe);
takt-049 (Testwarten, kein Produktfehler)
**Quellen-IDs:** CI `gates` (Projekt `in-process`), `apps/web/e2e/010b-lesepfade.spec.ts:802` rot in Lauf 37347756649
(Job 111890560965, Commit `d17bcbf`, Integrationszweig; in takt-049 als „nicht zugeordnet“ geführt) und Lauf 37360163818
(Job 111933081379, Commit `e1be691`, PR #162). Beide Male nach rund 2,0 s, Fehler
`page.evaluate: Resulting promise was garbage collected.` an Zeile 829 (zweites `page.evaluate` des Tests). Log und Trace
sind hier nicht abrufbar (Blob-Host gesperrt); die Angaben stammen vom Orchestrator.
**Depends on:** keine
**Perspektive:** Test-Determinismus · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `8215bc0`)

Der Test „Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" …“ (`010b-lesepfade.spec.ts:802–852`) setzt die
Bühne als podium mit gespeichertem „Nur Bühne“ auf. Danach laufen zwei `page.evaluate`. Das erste (`:816–823`) lädt
`/src/api/index.ts` per `await import(url)` und verzögert `getStage` um 1,5 s. Das zweite (`:829–840`) lädt
`/src/api/actor.ts` per `await import(url)`, legt einen `MutationObserver` an und ruft `setActor(expert)`. Das zweite
schlägt fehl.

### Was die Meldung bedeutet (bewiesen)

- Playwright 1.62.1 schickt `page.evaluate` als `Runtime.callFunctionOn` mit `awaitPromise: true`
  (`playwright-core/lib/coreBundle.js:35383–35395`). `rewriteError` (`:35306–35318`) übersetzt die CDP-Antwort
  „Promise was collected“ in „Resulting promise was garbage collected.“.
- Der V8-Inspektor hält das Promise, auf das er wartet, nur schwach. Er meldet „collected“, wenn die Speicherbereinigung
  das Promise einsammelt, solange es noch offen ist. Ein offenes Promise, das von nichts mehr erreichbar ist, kann nie
  mehr erfüllt werden, denn wer es erfüllen könnte, müsste es erreichen. Die Meldung heißt also: **das Evaluate hätte nie
  geendet.**
- Eine Navigation oder ein Neuladen (auch ein Vite-„full reload“) erzeugt diese Meldung nicht, sondern „Execution context
  was destroyed“. Ausnahme: Das Promise war schon vorher unerreichbar. Gemessen, siehe Tabelle.

### Ursache (Mechanismus bewiesen, Auslöser in CI sehr wahrscheinlich)

1. **Im zweiten Evaluate wartet nur der dynamische Import.** Der Rest des Rumpfs läuft synchron. `setActor`
   (`apps/web/src/api/actor.ts:58–67`) setzt den Akteur, schreibt `localStorage` und ruft die Hörer synchron. React plant
   das Neuzeichnen als Mikroaufgabe, also nach der Rückkehr. In beiden roten Läufen war demnach das Promise von
   `import('/src/api/actor.ts')` offen und unerreichbar. **`setActor` lief gar nicht.** Der Fehler sagt damit nichts über
   Bühne, „Nur Bühne“ oder den Rollenwechsel aus. Die Produktlogik ist nicht beteiligt.
2. **Dieselbe Klasse gab es schon einmal.** 010c, „CI-Befund auf `62f347b`“ (`docs/slices/010c-lesezustand-je-ladevorgang.md:96–118`):
   gleiche Meldung, gleiche Form (`await import(...)` im Evaluate, „einige hundert je Lauf“), nur in CI, lokal nicht
   nachstellbar. Die Abhilfe dort war `installHarness` (`apps/web/e2e/010c-lesezustand.spec.ts:118–160`, in 010d Ziel 5
   auf „starten und abfragen“ umgestellt): Module **einmal je Seite** im ruhigen Moment laden, ohne dass ein Evaluate auf
   den Import wartet. Seitdem ist in 010c kein Rückfall dokumentiert. **010b wurde nicht umgestellt.** Die Datei hat noch
   15 `await import(...)` in 14 asynchronen Evaluates (`:435, 488, 535, 613, 651, 690, 753, 776` (zwei), `816, 829, 858`
   (`switchActor`), `932, 956, 988`).
3. **Warum nur in CI:** CI installiert Playwrights eigenen Browser (`.github/workflows/gates.yml:152`,
   `playwright install --with-deps chromium`). Für 1.62.1 ist das Chrome Headless Shell 151.0.7922.34 (Revision 1234,
   `playwright-core/browsers.json`). Lokal nimmt die Konfiguration das fest abgelegte Chromium 141.0.7390.37
   (`apps/web/playwright.config.ts:27–28`, `/opt/pw-browsers/chromium-1194`), das es auf den Läufern nicht gibt. Auf 141
   bleibt die Kette `import()` → Evaluate auch unter erzwungener voller Speicherbereinigung erreichbar (Tabelle). Am
   wahrscheinlichsten verwirft also der CI-Browser in seltenen Fällen einen dynamischen Import, den ein per CDP
   ausgewertetes Skript startet, ohne ihn zu erfüllen. **Nicht bewiesen:** Revision 1234 ließ sich hier nicht
   installieren, weil die Netzrichtlinie des Repos Downloads von fremden Hosts sperrt.
4. Dazu passt die Dauer: Der Test ist in CI nach rund 2,0 s rot. Lokal beginnt das zweite Evaluate nach 2,5–3,1 s und
   braucht 92–125 ms. Der CI-Läufer ist schneller als diese Umgebung, also fiel der Fehler sofort beim zweiten Evaluate
   und nicht nach einer Wartezeit.

### Diagnose (Wegwerf-Instrumentierung, nicht festgeschrieben)

| Messung | Ergebnis |
|---|---|
| Evaluate wartet auf `new Promise(() => {})` (unerreichbar, offen) | „Resulting promise was garbage collected.“ nach 72 ms (natürliche Bereinigung) |
| dasselbe, danach `HeapProfiler.collectGarbage` per CDP | 10/10 dieselbe Meldung, **deterministisch** |
| dasselbe offene Promise, aber an `window` gehängt; Evaluate kehrt sofort zurück; dann `collectGarbage` | 10/10 kein Fehler, Zustand bleibt `loading` |
| Neuladen während offenem Timer / offenem `import()` (zwischengespeichert und frisch) | 11/12 „Execution context was destroyed“. Die eine Ausnahme ist die Variante mit unerreichbarem `new Promise(() => {})`: 2/3 „collected“, weil das Promise schon vor dem Neuladen unerreichbar war |
| dieselben vier Varianten unter `gc()` alle 1–4 ms (`--expose-gc`), je 5× | 20/20 „Execution context was destroyed“, nie „collected“ |
| geladene Modul-URLs der App (`performance.getEntriesByType('resource')`) | `/src/api/index.ts`, `/src/api/actor.ts` ohne `?t=`/`?v=`: der Testimport trifft dieselbe Modulinstanz aus der Modulliste, ohne Netz |
| R4B allein, `--repeat-each=40` (Chromium 141) | 40/40 grün |
| R4B, Headless Shell 141, `--repeat-each=40 --workers=4` | 40/40 grün |
| R4B `--repeat-each=60 --workers=2` gleichzeitig mit ganzer 010b `--repeat-each=3 --workers=2` und 4 CPU-Brennern (Last ~13 auf 4 Kernen) | 60/60 und 72/72 grün |
| R4B mit `gc()` alle 1–4 ms | 5/5 grün |
| R4B mit `gc()`-Schleife und `--stress-compaction` bzw. `--gc-global --stress-incremental-marking` | 20/20 und 20/20 grün |
| R4B, 2–4 volle `HeapProfiler.collectGarbage` **während** des zweiten Evaluate (Chromium 141 / Headless Shell 141) | 30/30 und 30/30 grün |
| 200 Importe von `/src/api/actor.ts` in Folge unter `--stress-compaction` bzw. `--gc-global --stress-incremental-marking` | 200/200 und 200/200 erfüllt |
| **Summe R4B lokal** | **ca. 250 grün, 0 rot**: auf 141 nicht getroffen (wie 010c) |

### Ausgeschlossen

- **Produkt:** `apps/web/src` enthält kein `import()`. `location.reload` steht nur in `resetDemo`
  (`apps/web/src/api/index.ts:195`). Die Bühne (`features/stage/Page.tsx`) navigiert beim Rollenwechsel nicht und
  ersetzt das Dokument nicht. Sie zeigt `stage-deciding` und danach `stage-forbidden`.
- **Vite-Neuladen / HMR:** Ein Neuladen gäbe eine andere Meldung (siehe oben). Der Watcher ignoriert `test-results/`, und
  `playwright-report/` entsteht erst am Ende. Die Tests schreiben sonst nur nach `docs/evidence/` (außerhalb der
  Vite-Wurzel).
- **Zweite Modulinstanz:** gleiche URL, gleiche Instanz (Tabelle). Eine zweite Instanz ließe außerdem die Prüfungen
  scheitern, nicht das Evaluate.
- **Live-Store:** `liveStore.ts:14–19` und `:332–343` lassen das Promise eines Lesevorgangs **absichtlich offen** und ohne
  Verweis, wenn der Akteur wechselt. Ein Evaluate, das über einen Rollenwechsel hinweg auf einen `api`-Lesevorgang
  wartet, endet deshalb **planmäßig** mit genau dieser Meldung. Das zweite Evaluate von R4B wartet auf keinen
  Lesevorgang, also ist der Live-Store hier nicht die Ursache. Er ist aber eine Falle für jeden künftigen Test. Ziel 3
  verbietet sie.

## Ziel

Kein `page.evaluate` in `010b-lesepfade.spec.ts` wartet mehr in der Seite auf einen dynamischen Import oder auf ein
Promise der App. Die zwei App-Module werden einmal je Seite über eine gemeinsame Hilfe geladen. Das Promise hängt an
`window`, kann also nicht eingesammelt werden. Ein nie erfüllter Import zeigt sich als benannte Meldung statt als
„garbage collected“.

1. **Neue Hilfsdatei `apps/web/e2e/support/app-modules.ts`.** Namen verbindlich:
   - `export const API_MODULE = '/src/api/index.ts'`, `export const ACTOR_MODULE = '/src/api/actor.ts'`.
   - `export interface AppModulesWindow { __appModules?: { state: 'loading' | 'ready' | `failed: ${string}`; modules: Record<string, unknown>; pending: Promise<void> } }`.
   - `loadAppModules(page: Page, urls: readonly string[] = [API_MODULE, ACTOR_MODULE], options?: { timeoutMs?: number }): Promise<void>`:
     a) **ein synchrones** `page.evaluate`. Gibt es `__appModules` schon und enthält es alle `urls`, kehrt es zurück.
     Sonst setzt es `state: 'loading'` und legt `pending = Promise.all(urls.map((u) => import(u))).then(…)` **an
     `window` ab**. Bei Erfolg: `modules[url] = namespace`, `state = 'ready'`. Bei Fehler: `state = `failed: ${String(error)}``.
     Das Evaluate gibt `undefined` zurück, nie ein Promise.
     b) `expect.poll(() => page.evaluate(() => state), { timeout: options?.timeoutMs ?? 10_000, message })`, dann `.toBe('ready')`.
     `message` nennt die URLs und sagt, dass der Zustand `loading` bedeutet: Der dynamische Import hat sich nicht erfüllt
     (takt-050).
   - Ein Kommentar im Kopf der Datei erklärt das *Warum* (Meldung, Inspektor hält schwach, 010c-Vorläufer, CI-Läufe dieser
     Spec) und den Live-Store-Fall (Ziel 3).
   - Die Datei importiert `expect` aus `./http-guard` (031b), damit geteilte Dateien sie später nutzen können.
2. **010b** (`010b-lesepfade.spec.ts`):
   - Die lokalen Konstanten `API_MODULE`/`ACTOR_MODULE` (`:99–102`) entfallen und kommen aus der Hilfe. Der Kommentar
     `:89–98` bleibt sinngemäß und verweist auf die Hilfe.
   - Jeder Test, der App-Module braucht, ruft `await loadAppModules(page)` einmal nach `waitForCorpus`. `switchActor`
     (`:857–868`) ruft es selbst (idempotent).
   - Alle 14 asynchronen Evaluates werden **synchron**. Sie lesen `(window as unknown as AppModulesWindow).__appModules!.modules[url]`.
     Der Rumpf bleibt sonst gleich: dieselben Umleitungen, dieselben Zähler, dieselben Wartezeiten (1500 ms, 300 ms).
   - **R4B (`:802–852`)**: Das zweite Evaluate legt den `MutationObserver` an und ruft `setActor(expert)` im **selben
     synchronen** Evaluate. Die Zusicherung „im selben Schritt wie der Wechsel scharf gemacht“ (Nit 4, Runde 5) bleibt
     wörtlich erhalten.
   - **R4A (`:776–794`)** wartet heute in der Seite auf `api.getMeeting()` und auf das Schreiben. Das wird zweigeteilt:
     (a) ein synchrones Evaluate startet `getMeeting()` und legt `speakerListVersion` (oder `failed: …`) an `window` ab;
     der Test fragt es per `expect.poll` ab. (b) Ein synchrones Evaluate tauscht den Akteur, startet
     `registerSpeaker(…, { ifMatch })`, stellt den Akteur im `finally` zurück und legt den Ausgang in `__writes` ab
     (`ok` / `failed: …`, wie `unrelatedEvent` in 010c). Der Test verlangt per `expect.poll` den Wert `ok`.
   - Danach gibt es in 010b kein `import(` und keinen `async`-Rückruf an `page.evaluate` mehr. Promise-Rückgaben bleiben
     nur in `settle` und `expectNoErrorToast` (`requestAnimationFrame`, vom Browser gehalten, nicht von der App).
3. **Regel im Kopf der Hilfe und als Kommentar in 010b:** Ein Evaluate wartet in der Seite nie über einen Rollenwechsel
   hinweg auf einen `api`-Aufruf. Der Live-Store lässt ihn absichtlich offen (`liveStore.ts:14–19`).
4. **Neuer Test `apps/web/e2e/takt-050-seitenmodule.spec.ts`** (nur `in-process`, nicht in `SHARED_SPECS`). Siehe „Tests
   zuerst“.

## Nicht-Ziele

- Keine Änderung unter `apps/web/src/` (kein Produktfehler, siehe Befund). Kein Test-Haken an `window` im Produktcode.
  Das ist die Eskalationsstufe, falls die benannte Meldung in CI auftritt, und braucht dann eine eigene Spec und das
  Einverständnis des Eigentümers.
- **Keine Wiederholung des Imports** in der Hilfe. Wie in 010c: Ein erneuter Versuch würde das Signal verdecken, ob der
  Import wirklich hängt. Bleibt der Zustand `loading`, soll der Test rot werden, mit benannter Meldung.
- Keine Umstellung der anderen Dateien mit demselben Muster (028, 053, 055b, takt-037, 010c): Folgeliste.
- Kein Browserwechsel in `playwright.config.ts` oder `.github/workflows/gates.yml`: Folgeliste.
- Keine Änderung an Prüfungen, Wartezeiten oder Testnamen in 010b, außer der in Ziel 2 beschriebenen Form der Evaluates.

## Files allowed

- `apps/web/e2e/support/app-modules.ts` (neu)
- `apps/web/e2e/takt-050-seitenmodule.spec.ts` (neu)
- `apps/web/e2e/010b-lesepfade.spec.ts`
- `docs/folgeliste.md` (nur die Einträge unten und die Erledigt-Markierung des 010c-Eintrags)
- `docs/slices/takt-050-010b-runde4.md` (Bericht)

## Ausdrücklich nicht erlaubt

Alles unter `apps/web/src/`, `packages/`, `apps/api/`, `scripts/`, `.github/`, `apps/web/playwright.config.ts`,
`package.json`, `pnpm-lock.yaml`. Nicht festschreiben: Wegwerf-Sonden (`zz-*.spec.ts`), `--js-flags`, CPU-Brenner.

## Tests zuerst

`takt-050-seitenmodule.spec.ts`, vier Blöcke. Die Speicherbereinigung wird per CDP erzwungen
(`page.context().newCDPSession(page)`, `HeapProfiler.collectGarbage`), nie über eine Zeitspanne oder Browserschalter.

**T1, Ursache (die alte Form ist rot, deterministisch):** `page.setContent('<p>takt-050</p>')`. Ein Evaluate
`async () => { await new Promise(() => {}); }` wird gestartet, aber nicht abgewartet. Dann `collectGarbage`. Das Evaluate
muss innerhalb von 5 s mit `/Resulting promise was garbage collected/` abgelehnt werden. Das ist ein Stellvertreter für
einen verworfenen Import. Der Test ist grün, wenn der Fehler eintritt. Der Kommentar nennt die CI-Läufe und diese Spec.

**T2, Prinzip:** Dasselbe offene Promise wird in einem synchronen Evaluate an `window` gehängt, mit Zustand `loading`.
Dann `collectGarbage`. Das Evaluate ist ohne Fehler zurückgekehrt, und der Zustand liest danach weiter `loading`. Ein
gehaltenes offenes Promise zeigt sich also als Zustand, nicht als Bereinigungsfehler.

**T3, Hilfe, Gutfall (Dev-Server):** `goto('/')`, Kopfzähler sichtbar, `loadAppModules(page)`. Dann
`modules[ACTOR_MODULE].setActor` als Funktion vorhanden. Ein **synchrones** Evaluate wechselt auf die podium-Person, und
`role-switcher` zeigt „Podium“. Damit ist es dieselbe Instanz wie in der App. Ein zweiter Aufruf von `loadAppModules`
kehrt ohne neuen Import zurück (Zähler oder unveränderte Referenz von `pending`).

**T4, Hilfe, hängender Import:** `page.route('**/takt-050-haengt.ts', () => {})` (wird nie beantwortet).
`loadAppModules(page, ['/takt-050-haengt.ts'], { timeoutMs: 1_500 })` muss abgelehnt werden. Die Meldung enthält die URL
und `loading`, nicht „garbage collected“. Während der Wartezeit läuft einmal `collectGarbage`. Gemessen und zugesichert:
Ablehnung nach weniger als 5 s.

**Rot vorher am echten Test (lokal, nicht festschreiben):** (c1) Im alten R4B wird das zweite Evaluate so verändert,
dass vor `await import(url)` ein `await new Promise(() => {})` steht. Der Test läuft dazu parallel `collectGarbage`.
Erwartet: rot mit genau der CI-Meldung „page.evaluate: Resulting promise was garbage collected.“ an der Zeile des
zweiten Evaluate. (c2) Im neuen R4B ersetzt `loadAppModules(page, ['/takt-050-haengt.ts', …], { timeoutMs: 2_000 })`
mit hängender Route den Aufruf. Erwartet: rot mit der benannten `loading`-Meldung der Hilfe. Der Bericht zeigt beide
Ausgaben.

## Akzeptanzkriterium

1. T1–T4 grün im Projekt `in-process`. Ausgabe im Bericht, dazu (c1) und (c2).
2. `rg -n "import\(" apps/web/e2e/010b-lesepfade.spec.ts` findet keinen Aufruf (höchstens Kommentarzeilen). `rg -U -n "page\.evaluate\(\s*async" apps/web/e2e/010b-lesepfade.spec.ts` (mehrzeilig, erfasst auch `switchActor`)
   ist leer. `rg -n "page\.evaluate" -A2` zeigt Promise-Rückgaben nur in `settle` und `expectNoErrorToast`. Der Bericht
   zeigt die drei Ergebnisse.
3. Wiederholung, Zählung im Bericht:
   - `pnpm --filter @hv/web exec playwright test e2e/010b-lesepfade.spec.ts --project=in-process -g "Runde 4" --repeat-each=40`,
     **zwei Läufe gleichzeitig** (verschiedene `E2E_PORT`): 160/160 grün;
   - `pnpm --filter @hv/web exec playwright test e2e/010b-lesepfade.spec.ts e2e/takt-050-seitenmodule.spec.ts --project=in-process --repeat-each=3`:
     alles grün;
   - (Belastung) eine lokale, nicht festgeschriebene Kopie von R4B in der neuen Form mit 2–4 `collectGarbage` während
     des Wechsels, `--repeat-each=30`: 30/30 grün.
4. `pnpm gates` grün (eigene Datenbank, z. B. `hv_test_t050`, damit parallele Gates auf `hv_test` nicht stören),
   einschließlich `scripts/e2e-http-031.test.mjs`. Die neue Datei gehört nicht in `SHARED_SPECS`.
5. CI auf dem PR grün (Job `gates`, in-process). Dazu nennt der Bericht, falls vorhanden, rote CI-Läufe mit der
   benannten `loading`-Meldung: Das wäre der Beweis, dass der Import in CI hängt (Eskalation, siehe Nicht-Ziele).
6. `git diff --stat` berührt nur die Files allowed. Nichts unter `apps/web/src/`.

## Folgeliste (vom Bau einzutragen)

- takt-050 · `apps/web/e2e/028-konflikte.spec.ts:20, 55, 77, 98` · `await import(...)` im Evaluate (gleiche Klasse wie
  010b R4B) · auf `support/app-modules.ts` umstellen, Evaluates synchron.
- takt-050 · `apps/web/e2e/053-steuerung.spec.ts:317` · `await import(...)` und danach `await` auf `listQuestions` und
  `assignQuestion` im Evaluate · Hilfe nutzen, Ausgang an `window`, abfragen.
- takt-050 · `apps/web/e2e/055b-antwortformat.spec.ts:307, 462` · `await import('…/domToBody')` im Evaluate · Hilfe mit
  eigener URL nutzen.
- takt-050 · `apps/web/e2e/takt-037-vorschlagsauswahl.spec.ts:56` · `await import(...)` und `await` auf App-Aufrufe im
  Evaluate · wie 053.
- takt-050 · `apps/web/e2e/010c-lesezustand.spec.ts:118–160` · eigenes `installHarness` mit gleichem Zweck, das Promise
  hängt nicht an `window` · auf die gemeinsame Hilfe umstellen. Der bestehende Eintrag „010c CI-Korrektur minor … prüfen
  ob erledigt“ wird als erledigt markiert (010d hat auf „starten und abfragen“ umgestellt).
- takt-050 · `apps/web/playwright.config.ts:27–28` und `.github/workflows/gates.yml:152` · lokal Chromium 141 (fest
  abgelegt), in CI Headless Shell 151 (Revision 1234): Browserabhängige Wackler lassen sich lokal nicht nachstellen ·
  Revision 1234 lokal bereitstellen oder CI auf denselben Browser festlegen (Eigentümer, Netzrichtlinie).

## Nachweise

- Ausgabe T1–T4, (c1), (c2); `rg`-Ergebnisse aus Akzeptanz 2; Zählungen aus Akzeptanz 3; Ende von `pnpm gates` mit
  Commit-Hash.
- Kein Screenshot (keine Interface-Änderung). Von den Läufen überschriebene `docs/evidence/010b-*` zurücksetzen.

## Bericht

```
Slice: takt-050-010b-runde4
Done: Neue Hilfe apps/web/e2e/support/app-modules.ts (loadAppModules: ein synchrones evaluate, Import-Promise an window,
      Zustand per expect.poll, benannte loading-Meldung); 010b lädt die App-Module einmal je Test (10 Tests, dazu
      switchActor), alle 14 Evaluates synchron, R4B scharf machen + setActor in einem synchronen Schritt, R4A
      zweigeteilt mit Ausgang an window (__speakerListVersion, __writes). Neuer Test takt-050-seitenmodule.spec.ts
      (T1 Ursache per CDP-GC, T2 Prinzip, T3 Gutfall, T4 hängender Import); Folgelisteneinträge, 010c-Eintrag erledigt.
Evidence: pnpm gates grün auf Commit 3d6c698 (sauberer Baum; slice-scope: 5 Dateien in Files allowed). Ende:
        dist/assets/index-CPbsjZGL.js                        764.46 kB │ gzip: 224.13 kB │ map: 3,162.87 kB
        ✓ built in 2.61s
        mark-test-run: wrote /home/user/wt/takt050/.claude/state/last-test-run (clean tree) at commit 3d6c698, tree 2fbbdfdfa22d…
      Skripttests darin (einschließlich scripts/e2e-http-031.test.mjs): # pass 352, # fail 0.
      Tests zuerst: ohne Hilfe rot ("Cannot find module …/e2e/support/app-modules"), danach
        ✓ T1 Ursache … endet mit "garbage collected" (308ms)
        ✓ T2 Prinzip … (226ms)
        ✓ T3 Hilfe, Gutfall … (1.8s)
        ✓ T4 Hilfe, hängender Import … in unter 5 s (2.4s)
        4 passed (8.6s)
      T1 war zuerst nicht deterministisch (3/20 „not settled within 5000 ms“: die Bereinigung lief, bevor das Evaluate in
      der Seite angekommen war). Abhilfe im Test: das Evaluate setzt zuerst eine Marke an window, der Test fragt sie ab und
      bereinigt erst dann. Danach T1 --repeat-each=40 --workers=2: 40 passed; ganze Datei --repeat-each=10: 40 passed.
      (c1) altes R4B, zweites Evaluate mit `await new Promise(() => {})` vor dem Import, parallel collectGarbage:
        ✘ Runde 4 (B) … (2.9s)
        Error: page.evaluate: Resulting promise was garbage collected.
          > 835 |   await Promise.all([gcProbe, page.evaluate(async (url) => {
      (c2) neues R4B mit loadAppModules(page, ['/takt-050-haengt.ts', API_MODULE, ACTOR_MODULE], { timeoutMs: 2_000 }):
        ✘ Runde 4 (B) … (3.8s)
        Error: app modules /takt-050-haengt.ts, /src/api/index.ts, /src/api/actor.ts not ready; state 'loading' means
        the dynamic import never settled (takt-050, support/app-modules.ts)
        Expected: "ready"  Received: "loading"
      rg (Akzeptanz 2): `import\(` keine Zeile (rc=1); `page\.evaluate\(\s*async` (-U) keine Zeile (rc=1);
        `page\.evaluate -A2 | rg Promise`: :77 (expectNoErrorToast), :116 (settle), :552 (`const fail = () =>
        Promise.reject(…)` im Rumpf eines Evaluate, das undefined zurückgibt; keine Promise-Rückgabe).
      Runde 4 --repeat-each=40, zwei Läufe gleichzeitig (E2E_PORT 4261/4262): 80/80 + 80/80 = 160/160.
      010b + takt-050 --repeat-each=3: 84/84. Belastungskopie R4B mit 2–4 collectGarbage während des Wechsels: 30/30.
      Überschriebene docs/evidence/010b-* nach jedem Lauf zurückgesetzt; nichts darunter festgeschrieben.
Open: CI auf dem PR (gates) steht aus; Beobachtung über die nächsten CI-Läufe (Akzeptanz 5). Nicht gepusht.
Touched: apps/web/e2e/support/app-modules.ts (neu), apps/web/e2e/takt-050-seitenmodule.spec.ts (neu),
      apps/web/e2e/010b-lesepfade.spec.ts, docs/folgeliste.md, docs/slices/takt-050-010b-runde4.md
```

## Review findings

(leer)
