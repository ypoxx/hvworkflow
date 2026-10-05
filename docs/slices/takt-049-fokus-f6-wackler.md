# takt-049 — 054 F6: die Wartehilfe `waitForMine` liest in einem Durchlauf nicht atomar

**Status:** spec · **Risikoklasse:** niedrig (nur e2e-Testcode, kein Produktivcode, kein Vertrag, keine Rechte, keine
Persistenz, kein Betrieb; Leitplanken §4) · ca. 1 AStd · 05.10.2026 · **Lanes:** web (e2e)
**Rolle:** builder; ein Review in frischem Kontext (Lean-Modus, AGENTS.md R3; Perspektive: Test-Determinismus), Modell nur
in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R12; 054 F6 („Lesehinweis, Rechte als Daten“); takt-044 (gleiche Klasse: Testwarten,
kein Produktfehler)
**Quellen-IDs:** CI `gates` (Projekt `in-process`), 054 F6 rot in Lauf 37337216828 (Job 111855623850, Commit `7928053`)
und Lauf 37343908853 (Job 111877576800, Commit `92b87bf`), jeweils Wiederholung grün. Ein dritter roter e2e-Schritt auf
`main` (Lauf 37347756649, Job 111890560965, `d17bcbf`) ist nicht zugeordnet (Log und Trace hier nicht abrufbar).
**Depends on:** keine
**Perspektive:** Test-Determinismus · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `3136bf0`)

Symptom: In `apps/web/e2e/054-fokusansicht.spec.ts` F6, Schritt „coordination: the notice, no rows“, läuft
`waitForMine` (Zeilen 94–103) nach 15 s ab. Die Läufe berühren die Web-App nicht, und der Fehler tritt nur selten auf.

### Ursache (Mechanismus lokal bewiesen, CI-Zuordnung sehr wahrscheinlich)

Das Prädikat in `expect.poll` liest das DOM in vier getrennten Playwright-Aufrufen:

```ts
if (await page.getByTestId('focus-forbidden').isVisible()) return true;   // 1
if (await page.getByTestId('focus-empty').isVisible()) return true;       // 2
const list = page.getByTestId('focus-list');
if ((await list.count()) === 0 || (await list.getAttribute('data-state')) !== 'ready') return false; // 3, 4
```

- `isVisible()` und `count()` warten nicht. `locator.getAttribute()` dagegen **wartet, bis das Element da ist**. Die
  Konfiguration setzt kein `actionTimeout` (`apps/web/playwright.config.ts`, `use`), also wartet der Aufruf ohne
  eigene Grenze.
- Für eine Rolle ohne eigene Fragen (Koordination, Recht) gibt es genau einen Wechsel: Skelett
  (`focus-list`, `data-state="loading"`, `FocusList.tsx` Zeilen 92–105) → Hinweis `focus-empty` (Zeilen 72–80).
  Im Zustand „bereit und leer“ rendert die Seite **kein** `focus-list` mehr (`Page.tsx` Zeilen 393–400).
- Fällt dieser Wechsel zwischen Schritt 3 (`count()` sieht das Skelett, Ergebnis 1) und Schritt 4, sucht
  `getAttribute` ein Element, das nie wiederkommt. Der Rückruf hängt, und `expect.poll` ruft ihn nicht erneut auf: Nach
  15 s endet es mit „Timeout 15000ms exceeded while waiting on the predicate“, obwohl `focus-empty` längst sichtbar ist.
- Für die Fachperson tritt das nicht auf: Ihr Zustand „bereit“ rendert wieder ein `focus-list` (mit Zeilen), also
  findet Schritt 4 das neue Element. Deshalb treffen die Fehlläufe nur F6 (Koordination, Recht), nicht F1–F5, F7 oder F8.

### Diagnose (Wegwerf-Instrumentierung, nicht festgeschrieben)

| Messung | Ergebnis |
|---|---|
| F6 allein, `--repeat-each=20` (2 Worker) | 20/20 grün |
| ganze Datei 054, `--repeat-each=20 --workers=4`, zwei Läufe gleichzeitig (Last ~36 auf 4 Kernen) | 160/160 und 160/160 grün (40 × F6) |
| F6, `--repeat-each=60 --workers=2`, gleichzeitig mit der ganzen in-process-Suite | 60/60 grün |
| ganze in-process-Suite einmal (unter dieser Last) | F6 grün; 1 fremder Fehler (003, axe-Zeitüberschreitung), 1 übersprungen |
| **Summe F6 lokal** | **121 grün, 0 rot**: das natürliche Rennen ist lokal nicht getroffen |
| Listenlesen der Koordination in-process (n = 230), `useBacklog`-Spur | 9–34 ms je Lesen; Seite fertig 169–319 ms nach dem Klick (CPU 1×), 0,85–1,1 s (6×), 4,3–4,5 s (20×) |
| Ablauf nach dem Klick bei CPU 10× (Abtastung per `evaluate`) | URL schon `/my`, alte Seite noch ~1,5–2 s sichtbar → Skelett 74–183 ms → `focus-empty` |
| erster Prädikatdurchlauf bei CPU 1×, 20 Läufe | 20/20 sehen schon `focus-empty`: lokal ist das Fenster zu kurz, auf dem CI-Läufer (langsamer, Trace an) nicht |
| **erzwungene Reihenfolge** im echten Demo-Betrieb (CPU 10×): Schritte 1–3 wiederholt, bis `count()` das Skelett trifft; warten, bis `focus-empty` sichtbar ist; dann Schritt 4 | in 1 von 3 Läufen wurde das Skelett getroffen: Schritt 4 **wartet nach 16 004 ms noch** (> 15 s); in den anderen 2 Läufen kam `focus-empty` vor dem Skelett-Treffer (nicht verwertbar, kein Gegenbeweis) |
| Schritt 4 allein, nachdem `focus-empty` steht (`expect.poll`, 5 s) | „Timeout 5000ms exceeded while waiting on the predicate“ nach 5 002 ms |
| ein `page.evaluate` an derselben Stelle | `{"empty":true,"list":null}` sofort |

**Wie der Orchestrator die Zuordnung bestätigt:** Steht im CI-Log von Job 111855623850 oder 111877576800 „Timeout 15000ms
exceeded while waiting on the predicate“, hing der Rückruf (diese Ursache). Stünde dort „Expected: true / Received:
false“ mit einer Liste von Abfragen, hätte das Prädikat 15 s lang `false` geliefert. Das widerlegte diese Ursache, und
die Produkt-Hypothesen unten wären neu zu prüfen.

### Ausgeschlossen (Produkt)

Gelesen und gemessen: Die Seite bleibt nicht im Ladezustand hängen.
- In F6 gibt es nach dem Start keinen Schreibvorgang und keine Zeitsignale (die Demo hat keinen Strom; Seed ohne
  Belegungen). Die Spur zeigt genau ein `live:notify` (das `assignRole` beim Start), dann ein Listenlesen (zwei unter
  StrictMode, ein gemeinsamer Flug). Die Antwort kommt nach 9–34 ms und wird angewendet.
- `liveStore.forCaller` hält eine Antwort nur bei einem Wechsel der Akteur-Epoche zurück. Den gibt es nach dem einen
  Wechsel vor dem Seitenaufruf nicht mehr (`observeActor` läuft vor `startA`).
- `useBacklog` zeigt `loading` nur, solange für diesen Akteur keine Antwort vorliegt (`listLoading && items.length === 0`).
  Nach der ersten Antwort hält die Koordination 230 Einträge, also gilt `ready`, und `mine` ist leer. Damit steht
  `focus-empty` da, wie beabsichtigt.
- Kein Vite-Neuladen durch nachgeladene Abhängigkeiten (frischer `.vite`-Cache, 054/053/045/055b: nur „bundling
  dependencies“).

Ein Produktfehler ist das also nicht. Die Seite tut, was 054 verlangt. Falsch ist die Lesart des Tests.

## Ziel

Die Wartehilfe für „Meine Fragen“ liest den Zustand der Seite in **einem** atomaren Schritt (ein `page.evaluate`).
Innerhalb des `expect.poll`-Rückrufs steht keine Locator-Aktion, die auf ein Element wartet. Damit gibt es keine Lücke,
in die der Wechsel Skelett → Hinweis fallen kann.

1. **Neue Hilfsdatei `apps/web/e2e/support/focus-list.ts`.** Namen verbindlich:
   - `interface FocusListSnapshot { forbidden: boolean; empty: boolean; listState: 'loading' | 'ready' | 'failed' | null; units: string[] }`
   - `readFocusList(page: Page): Promise<FocusListSnapshot>`: genau ein `page.evaluate`. `forbidden`/`empty`: Element
     `[data-testid="focus-forbidden"]` bzw. `[data-testid="focus-empty"]` vorhanden **und** `checkVisibility()`;
     `listState`: `data-state` von `[data-testid="focus-list"]` oder `null`; `units`: `data-unit` aller
     `[data-testid="focus-row"]` innerhalb dieser Liste.
   - `focusListLanded(snapshot, unitId: string): boolean`, rein: `forbidden || empty` → `true`; sonst
     `listState === 'ready' && units.length > 0 && units.every(u => u === unitId)`.
   - `waitForMine(page, unitId)`: `expect.poll(async () => focusListLanded(await readFocusList(page), unitId), { timeout: 15_000 }).toBe(true)`.
     Die 15 s bleiben unverändert (kein neuer Spielraum).
   - Die Datei importiert `expect` aus `./http-guard` (031b).
2. **054** (`054-fokusansicht.spec.ts`): Die lokale `waitForMine` entfällt. Alle Aufrufe gehen auf die Hilfe mit
   `EXPERT_UNIT_ID`. Kein anderer Schritt ändert sich, auch F6 nicht (er prüft danach weiter `focus-empty` sichtbar und
   0 Zeilen).
3. **055b** (`055b-antwortformat.spec.ts`, Zeilen 72–79): gleiche Form (`count()` und dann `getAttribute` im
   Poll-Rückruf). Heute schadet sie nicht, weil die Fachperson immer Zeilen hat. Die Datei behält ihr strengeres
   Prädikat (nur `ready` mit eigenen Zeilen, kein Hinweis): `listState === 'ready' && units.length > 0 && units.every(…)`
   über `readFocusList`, ohne Locator-Aktion im Rückruf.
4. **Neuer Test `apps/web/e2e/takt-049-fokus-warten.spec.ts`** (nur `in-process`, nicht in `SHARED_SPECS`). Er arbeitet
   ohne App, nur mit `page.setContent` und festen DOM-Zuständen, die die Testids von `FocusList`/`Page` nachbilden.
   Siehe „Tests zuerst“.

## Nicht-Ziele

- Keine Änderung unter `apps/web/src/` (kein Produktfehler, siehe Befund). Das Skelett behält seine Testid, und der
  Hinweis bleibt ohne `focus-list`.
- Kein globales `actionTimeout` in `playwright.config.ts`. Das berührt jede Datei und gehört in die Folgeliste (siehe
  unten), nicht hierher.
- Keine Änderung an `support/roles.ts`, an den Wartezeiten anderer Dateien oder an der Reihenfolge der `http`-Dateien.
- `045-verweigerung.spec.ts` Zeile 160 (`count()` und dann `getAttribute('aria-pressed')` außerhalb eines Polls,
  der Umschalter verschwindet nicht) bleibt, wie sie ist: Folgelisteneintrag.

## Files allowed

- `apps/web/e2e/support/focus-list.ts` (neu)
- `apps/web/e2e/takt-049-fokus-warten.spec.ts` (neu)
- `apps/web/e2e/054-fokusansicht.spec.ts`
- `apps/web/e2e/055b-antwortformat.spec.ts`
- `docs/folgeliste.md` (nur die zwei Einträge unten)
- `docs/slices/takt-049-fokus-f6-wackler.md` (Bericht)

## Ausdrücklich nicht erlaubt

Alles unter `apps/web/src/`, `packages/`, `apps/api/`, `scripts/`, `apps/web/playwright.config.ts`, `package.json`,
`pnpm-lock.yaml`, `.github/`. Keine Instrumentierung von `useBacklog.ts` oder `liveStore.ts` festschreiben.

## Tests zuerst

`takt-049-fokus-warten.spec.ts`, zwei Blöcke. Beide sind deterministisch: Der Zustand wechselt per `page.evaluate` an
einer festen Stelle, nie über eine Zeitspanne.

**T1 — Ursache (die alte Lesart ist an der schlechten Reihenfolge rot):** DOM mit Skelett
(`<div data-testid="focus-list" data-state="loading">`). Schritte 1–3 der alten Lesart wörtlich: `isVisible` für
Forbidden und Empty sind `false`, `count()` ist 1. Dann tauscht ein `page.evaluate` das Skelett gegen
`<div data-testid="focus-empty" role="status">…</div>`. Schritt 4 läuft mit eigener Grenze:
`list.getAttribute('data-state', { timeout: 2_000 })` muss mit einem `TimeoutError` enden. Der Test sichert damit die
Ursache, also dass Playwright auf ein Element wartet, das ein leerer, bereiter Zustand nie rendert. Er ist grün, wenn der
Fehler eintritt. Der Kommentar nennt CI-Läufe und diese Spec.

**T2 — Korrektur (die neue Lesart ist an derselben Stelle grün):**

| Fall | DOM | `readFocusList` → `focusListLanded(…, 'unit-fin')` |
|---|---|---|
| Skelett | `focus-list` `loading` | `listState: 'loading'` → `false` |
| schlechte Reihenfolge | Skelett, dann derselbe Tausch wie in T1, dann lesen | `empty: true, listState: null` → `true` |
| Hinweis | `focus-empty` | `true` |
| keine Leseberechtigung | `focus-forbidden` | `true` |
| eigene Zeilen | `focus-list` `ready` mit zwei Zeilen `data-unit="unit-fin"` | `true` |
| fremde Zeile | `ready` mit `unit-fin` und `unit-ops` | `false` |
| bereit ohne Zeilen | `focus-list` `ready`, keine Zeile | `false` |
| Fehler | `focus-list` `failed` | `false` |
| versteckter Hinweis | `focus-empty` mit `style="display:none"` | `false` (Sichtbarkeit zählt wie bei `isVisible`) |

Dazu `waitForMine(page, 'unit-fin')` auf dem DOM nach dem Tausch: Es kehrt in unter 2 s zurück (gemessen, eine
Zusicherung `< 2_000`).

**Rot vorher:** T1 ist der rote Beweis für die alte Lesart an der schlechten Reihenfolge (ohne die eigene 2-s-Grenze
hinge Schritt 4 bis zum Ablauf des Polls). Für die neue Lesart gibt es keinen Zwischenpunkt, in den der Tausch fallen
könnte: Sie liest einmal. Der Bericht zeigt deshalb (a) die Ausgabe von T1 und (b) die Ausgabe von T2. Er zeigt außerdem
(c) einen Lauf von T2 „schlechte Reihenfolge“, in dem `readFocusList` vorübergehend durch die alte Vier-Schritt-Lesart
ersetzt ist (lokale Änderung, nicht festschreiben), also mit dem Tausch zwischen `count()` und `getAttribute`. Dieser Lauf
muss mit einem Timeout rot sein.

## Akzeptanzkriterium

1. T1 und T2 grün im Projekt `in-process`; Ausgabe im Bericht, dazu (c) aus „Rot vorher“.
2. In `054-fokusansicht.spec.ts` und `055b-antwortformat.spec.ts` steht in keinem `expect.poll`-Rückruf eine
   Locator-Aktion auf `focus-list`, `focus-empty` oder `focus-forbidden` (`getAttribute`, `count`, `isVisible`,
   `innerText`). Zeilen über `focus-row` werden nur noch über `readFocusList` gelesen. Der Bericht zeigt das
   `rg`-Ergebnis.
3. Wiederholung, Zählung im Bericht:
   - `pnpm --filter @hv/web exec playwright test e2e/054-fokusansicht.spec.ts --project=in-process -g F6 --repeat-each=30`,
     **zwei Läufe gleichzeitig** (verschiedene `E2E_PORT`): 60/60 grün;
   - `pnpm --filter @hv/web exec playwright test e2e/054-fokusansicht.spec.ts e2e/055b-antwortformat.spec.ts --project=in-process --repeat-each=3`: alles grün.
4. `pnpm gates` grün, einschließlich `scripts/e2e-http-031.test.mjs` (geteilte Dateien nehmen `test` aus `http-guard`;
   die neue Hilfsdatei ändert daran nichts).
5. CI auf dem PR grün: Job `gates` (in-process) und Job `e2e-http` (054 und 055b laufen dort auch).
6. `git diff --stat` berührt nur die Files allowed; nichts unter `apps/web/src/`.

## Folgeliste (vom Bau einzutragen)

- takt-049 · `apps/web/playwright.config.ts` · kein `actionTimeout`: Jede wartende Locator-Aktion in einem
  `expect.poll`-Rückruf kann über die Poll-Grenze hinaus hängen, und der Poll ruft dann nicht erneut auf · ein globales
  `actionTimeout` (z. B. 10 s) prüfen, dabei alle Dateien laufen lassen.
- takt-049 · `apps/web/e2e/045-verweigerung.spec.ts:160` · `count()` und danach `getAttribute('aria-pressed')`
  (gleiche Form, außerhalb eines Polls, der Umschalter bleibt stehen) · bei Gelegenheit auf eine atomare Lesung
  umstellen.

## Nachweise

- Ausgabe T1, T2 und (c); Zählungen aus Akzeptanz 3; Ende von `pnpm gates` mit Commit-Hash.
- Kein Screenshot (keine Interface-Änderung).

## Bericht

```
Slice: takt-049-fokus-f6-wackler
Done: Neue Hilfe apps/web/e2e/support/focus-list.ts (readFocusList: ein page.evaluate; focusListLanded rein;
      waitForMine mit 15 s); 054 nutzt sie mit EXPERT_UNIT_ID, 055b liest sein strengeres Prädikat über readFocusList.
      Neuer Test takt-049-fokus-warten.spec.ts (T1 Ursache, T2 neun Fälle + waitForMine < 2 s); zwei Folgelisteneinträge.
Evidence: pnpm gates grün auf Commit eda84c3 (sauberer Baum; slice-scope: 6 Dateien in Files allowed; Skripttests
      pass 346 / fail 0, einschließlich scripts/e2e-http-031.test.mjs). Ende:
        ✓ built in 2.39s
        mark-test-run: wrote /home/user/wt/takt049/.claude/state/last-test-run (clean tree) at commit eda84c3, tree 0805bd029fb8…
      T1/T2: takt-049-fokus-warten.spec.ts --project=in-process: 11 passed (8.1s).
      T1 roh (ohne Abfangen, lokal, nicht festgeschrieben): "TimeoutError: locator.getAttribute: Timeout 2000ms exceeded.
        Call log: - waiting for getByTestId('focus-list')".
      (c) T2 "schlechte Reihenfolge" mit der alten Vier-Schritt-Lesart, Tausch zwischen count() und getAttribute (lokal,
        nicht festgeschrieben): rot nach 15.3s, "Error: Timeout 15000ms exceeded while waiting on the predicate".
      F6 --repeat-each=30, zwei Läufe gleichzeitig (E2E_PORT 4201/4202): 30 passed (3.5m) + 30 passed (3.5m) = 60/60.
      054 + 055b --repeat-each=3: 42 passed, 3 skipped (H1, nur Projekt http) (4.8m).
      Kein Screenshot (keine Interface-Änderung); von den Läufen überschriebene docs/evidence/054-*/055b-* zurückgesetzt.
Open: CI auf dem PR (gates, e2e-http) steht aus; nicht gepusht (Auftrag).
Touched: apps/web/e2e/support/focus-list.ts (neu), apps/web/e2e/takt-049-fokus-warten.spec.ts (neu),
      apps/web/e2e/054-fokusansicht.spec.ts, apps/web/e2e/055b-antwortformat.spec.ts, docs/folgeliste.md,
      docs/slices/takt-049-fokus-f6-wackler.md
```

Akzeptanz 2, `rg -n -A3 "expect\.poll"` in 054/055b: die einzigen Poll-Rückrufe lesen den Zähler im Kopf
(`header-counter-questions`), den Fokus per `page.evaluate`, `steeringRows` (`answers-row`, Steuerung) und in 055b `readFocusList`; keiner
enthält eine Locator-Aktion auf `focus-list`, `focus-empty`, `focus-forbidden` oder `focus-row`.

## Review findings

(leer)
