# 010b — Lesepfade in der Oberfläche: gestalteter Zustand ohne Leseberechtigung

**Status:** spec (abgetrennt aus 010 am 23.09.2026, weil 010 sonst die Tokengrenze von 1,2 Mio. überschreitet)
**Risikoklasse:** mittel · 1 AStd · Lanes: web-speakers, web-capture, web-answers, web-stage, web-history, e2e
(eigene Datei)
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5; Review Opus 5.5 (Perspektive Barrierefreiheit und Security);
Design-Kritik entfällt (ein Zustand, vorhandene Komponenten)
**Rule ids:** AGENTS.md Regeln 1, 2, 4, 9, 10, 12; docs/design-prinzipien.md (leere und verweigerte Zustände)
**Quellen-IDs:** `docs/slices/010-lesepfade-leserechte.md` Ziel 6, e2e-Teil von Ziel 7, Kriterium 4 (dort als
„→ 010b" markiert)
**Depends on:** 010 (gemergt: Leserechte im Kern, 403 R-PERM-02/03), 013 (gemergt: axe-Helfer, Tastaturpfad)
**Perspektive:** Security, Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Ziel

1. **Gestalteter Zustand statt Fehlermeldung:** Jede Ansicht rendert bei 403 auf ihrer Hauptabfrage den Zustand
   „In dieser Rolle keine Leseberechtigung für diese Ansicht". Er steht als i18n-Eintrag im Feature-Modul, auf Deutsch
   und en-US, im Hausvokabular. Es erscheint keine Fehlermeldung und kein Fehler-Toast. Der Zustand nutzt die
   vorhandene Komponente für leere Zustände.
   - **Hauptabfrage je Ansicht:** Wortmeldeliste `listSpeakers`, Erfassung `listContributions`, Beantwortung
     `listQuestions`, Bühne `getStage`, Historie `listQuestions`.
2. **Nebenabfragen:** Eine verweigerte Nebenabfrage lässt die Ansicht mit weniger Daten stehen, z. B. `listSpeakers`
   für Namen in der Historie unter expert. Dafür wird das gemeinsame `Promise.all` in
   `apps/web/src/features/history/Page.tsx` getrennt. **Regression aus 010, hier zu beheben** (Nachprüfung B von
   010): unter expert, legal und approver (je `history.read` und `question.read`, aber kein `speaker.read`) scheitert
   heute das ganze Laden der Historie, die Zeitleiste öffnet sich nicht; vor 010 ging das.
3. **Historie unter observer:** Die Trefferliste zeigt nur Vorgelesenes. Zeitleiste und Ereignisstrom-Reiter zeigen
   den Zustand „keine Leseberechtigung".
4. **Kein Rollenname im Code (Regel 4):** Die Oberfläche erkennt den Zustand am 403 mit `ruleId` R-PERM-02 oder
   R-PERM-03, nie an der Rolle.
5. **e2e** `apps/web/e2e/010b-lesepfade.spec.ts` (neu), mit axe über den Helfer aus 013 bei jedem Zustand:
   - Historie unter observer: nur Vorgelesenes, Zeitleiste im Zustand „keine Leseberechtigung".
   - Beantwortung unter observer zeigt nur vorgelesene Fragen.
   - Bühne unter expert zeigt den Zustand „keine Leseberechtigung".
   - Wortmeldeliste unter podium zeigt den Zustand.
   - Historie unter expert: die Suche nach einer Frage öffnet ihre Zeitleiste; Namen aus `listSpeakers` fehlen, die
     Ansicht steht (Regression aus 010).
   - Kein Fehler-Toast in diesen Fällen.

## Nicht-Ziele

Keine Änderung an Kern, Vertrag, Dienst oder Rechten. Keine neue Route, keine Navigation nach Rechten (082). Keine
Änderung an den Alt-Specs; die Rollenwechsel hat 010 gemacht.

## Files allowed

- `apps/web/src/features/speakers/**`, `apps/web/src/features/capture/**`, `apps/web/src/features/answers/**`,
  `apps/web/src/features/stage/**`, `apps/web/src/features/history/**` (nur Ladepfade und der Zustand)
- `apps/web/src/i18n/speakers.de.ts`, `apps/web/src/i18n/speakers.en.ts`, `apps/web/src/i18n/capture.de.ts`,
  `apps/web/src/i18n/capture.en.ts`, `apps/web/src/i18n/answers.de.ts`, `apps/web/src/i18n/answers.en.ts`,
  `apps/web/src/i18n/stage.de.ts`, `apps/web/src/i18n/stage.en.ts`, `apps/web/src/i18n/history.de.ts`,
  `apps/web/src/i18n/history.en.ts`, `apps/web/src/i18n/parity.test.ts` (nur Schlüsselzahl)
- `apps/web/e2e/010b-lesepfade.spec.ts` (neu), `docs/evidence/010b-*.png` (neu)
- `docs/slices/010b-lesepfade-oberflaeche.md` (Bericht)

## Akzeptanzkriterium

1. Alle Playwright-Szenarien grün, einschließlich 010b und 013. axe meldet in den neuen Zuständen weder serious noch
   critical.
2. Screenshots DE/EN:
   - Historie unter observer: nur Vorgelesenes, Zeitleiste ohne Leseberechtigung.
   - Beantwortung unter observer.
   - Bühne unter expert.
3. `pnpm gates` grün, einschließlich `i18n-literals`, `role-literals` und `slice-scope`.
4. Das e2e „Historie unter expert öffnet die Zeitleiste“ ist grün und war vor der Trennung des `Promise.all` rot
   (roter Lauf im Bericht, wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/010b`, Branch `claude/slice-010b-lesepfade-ui` vom Integrationsbranch nach dem Merge von
  010. Absolute Pfade. Playwright mit eigenem Port, Chromium unter `/opt/pw-browsers`.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen. Nachweise wörtlich,
  kopiert und nicht abgetippt.

## Bericht

```
Slice: 010b-lesepfade-oberflaeche
Done: Jede der fünf Ansichten (Wortmeldeliste, Erfassung, Beantwortung, Bühne, Historie) erkennt
  einen 403 mit ruleId R-PERM-02/R-PERM-03 auf ihrer Hauptabfrage und rendert dafür die vorhandene
  EmptyState-Komponente statt eines Fehler-Toasts (Ziel 1, Regel 4 — kein Rollenname im Code).
  Historie: das gemeinsame Promise.all aus listUnits/listAgendaItems/listSpeakers/
  listQuestions(corpus) getrennt (Ziel 2) — behebt die Regression aus 010 (Nachprüfung B), bei der
  ein verweigertes listSpeakers unter expert/legal/approver den ganzen Bestand blockierte und die
  Zeitleiste sich nicht mehr öffnete; zusätzlich eigene Zustände für die Vorgangshistorie- und
  Ereignisstrom-Tabs (observer: question.read.delivered erlaubt die Trefferliste, aber weder
  history.read noch event.read, Ziel 3). Neue e2e-Datei mit fünf Szenarien plus axe und
  Toast-Freiheit; Screenshots DE/EN für Historie/observer, Beantwortung/observer, Bühne/expert.
Evidence: siehe unten (roter und grüner Lauf der Regressionsprobe, Playwright-Zusammenfassung,
  `pnpm gates`-Ende, slice-scope-Zeile).
Open: keins.
Touched: siehe "Touched" unten.
```

**Korrektur (Nacharbeit nach Review und Codex, siehe unten):** „Open: keins" oben war falsch — die
unabhängige Prüfung (Opus 5.5, Perspektive Barrierefreiheit/Security) fand einen Blocker, einen
Major-Befund, sechs Minor- und drei Nit-Befunde; Codex auf PR #26 fand ein P1 (deckungsgleich mit
dem Blocker) und ein P2 (deckungsgleich mit einem der Minor-Befunde). „Jede der fünf Ansichten …
erkennt … und rendert" oben stimmte für vier der fünf Hauptabfragen, aber nicht für die Erfassung:
`listContributions` lief dort nie, weil sie an einen `speakerId` gebunden war, der wiederum nur aus
einem erfolgreichen `listSpeakers` kam — eine Rolle ohne `contribution.read` sah den gewöhnlichen
leeren Schreibtisch statt des gestalteten Zustands (Blocker, siehe unten). Beide Korrekturen sind
jetzt behoben; Einzelheiten und Nachweise in „Nacharbeit nach Review und Codex" am Ende dieses
Berichts.

**Roter Lauf der Regressionsprobe** (vor der Trennung des `Promise.all`, `history/Page.tsx` auf den
Stand von Scheibe 010 zurückgesetzt, `git stash push -- apps/web/src/features/history/Page.tsx`;
`E2E_PORT=4391 npx playwright test --grep "Historie unter expert öffnet die Zeitleiste"
--reporter=list`, wörtlich kopiert):

```
Running 1 test using 1 worker

  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:200:1 › Historie unter expert öffnet die Zeitleiste (6.7s)


  1) [chromium] › e2e/010b-lesepfade.spec.ts:200:1 › Historie unter expert öffnet die Zeitleiste ───

    Error: expect(locator).toBeVisible() failed

    Locator: getByTestId('history-timeline')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByTestId('history-timeline')


      215 |
      216 |   await results.first().click();
    > 217 |   await expect(page.getByTestId('history-timeline')).toBeVisible();
          |                                                      ^
      218 |   await expect(page.getByTestId('history-event').first()).toBeVisible();
      219 |   await expect(page.getByTestId('history-timeline-forbidden')).toHaveCount(0);
      220 |
        at /home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:217:54

    Error Context: test-results/010b-lesepfade-Historie-unter-expert-öffnet-die-Zeitleiste-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/010b-lesepfade-Historie-unter-expert-öffnet-die-Zeitleiste-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/010b-lesepfade-Historie-unter-expert-öffnet-die-Zeitleiste-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [chromium] › e2e/010b-lesepfade.spec.ts:200:1 › Historie unter expert öffnet die Zeitleiste ────
```

Genau die beschriebene Regression: die Trefferliste lädt (die `results`-Abfrage ist vom
`Promise.all` unabhängig), aber ein Klick öffnet die Zeitleiste nicht — `selected` bleibt `null`,
weil `corpus` wegen des verweigerten `listSpeakers` nie gefüllt wird.

**Grüner Lauf** (nach `git stash pop`, derselbe Befehl, wörtlich kopiert):

```
Running 1 test using 1 worker

[axe] history (expert, Vorgangshistorie opens; listSpeakers denied as a Nebenabfrage) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] history (expert, Vorgangshistorie opens; listSpeakers denied as a Nebenabfrage) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓  1 [chromium] › e2e/010b-lesepfade.spec.ts:200:1 › Historie unter expert öffnet die Zeitleiste (4.9s)

  1 passed (6.9s)
```

**Playwright-Zusammenfassung** (ganze Suite, `E2E_PORT=4391 npx playwright test --reporter=list`,
Chromium unter `/opt/pw-browsers`, auf dem committeten Stand, wörtlich kopiert — jede axe-Zeile
0 serious/critical):

```
Running 22 tests using 2 workers

  ✓   2 [chromium] › e2e/001-shell.spec.ts:25:1 › shell: counters, role switch, language switch @screenshot (9.3s)
  ✓   3 [chromium] › e2e/001-shell.spec.ts:93:1 › header strip on the answers desk @screenshot (5.6s)
  ✓   1 [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot (20.6s)
  ✓   5 [chromium] › e2e/010b-lesepfade.spec.ts:65:1 › Wortmeldeliste unter podium zeigt den Zustand "keine Leseberechtigung" (2.9s)
  ✓   6 [chromium] › e2e/010b-lesepfade.spec.ts:87:1 › Bühne unter expert zeigt den Zustand "keine Leseberechtigung" (3.2s)
  ✓   7 [chromium] › e2e/010b-lesepfade.spec.ts:116:1 › Beantwortung unter observer zeigt nur vorgelesene Fragen (3.9s)
  ✓   8 [chromium] › e2e/010b-lesepfade.spec.ts:148:1 › Historie unter observer: nur Vorgelesenes, Zeitleiste und Ereignisstrom ohne Leseberechtigung (10.1s)
  ✓   9 [chromium] › e2e/010b-lesepfade.spec.ts:200:1 › Historie unter expert öffnet die Zeitleiste (5.6s)
  ✓  10 [chromium] › e2e/013-tastaturpfad.spec.ts:158:1 › 013a: Wortmeldung per Tastatur anlegen und mit Pfeiltasten umsortieren (9.5s)
  ✓  11 [chromium] › e2e/013-tastaturpfad.spec.ts:281:1 › 013b: Redebeitrag erfassen und mit der Tastatur in Einzelfragen zerlegen (11.2s)
  ✓   4 [chromium] › e2e/003-answers-stage.spec.ts:44:1 › backlog, approval, podium and history @screenshot (1.0m)
  ✓  12 [chromium] › e2e/013-tastaturpfad.spec.ts:371:1 › 013c: Antwort entwerfen und mit der Tastatur weiterleiten (13.9s)
  ✓  14 [chromium] › e2e/013-tastaturpfad.spec.ts:411:1 › 013d: Freigeben mit der Tastatur (3.0s)
  ✓  15 [chromium] › e2e/013-tastaturpfad.spec.ts:427:1 › 013e: Auf der Bühne "Vorgelesen, weiter" mit der Tastatur (2.2s)
  ✓  13 [chromium] › e2e/020-rueckbau-passung.spec.ts:111:1 › 020: Rückbau und Passung — points 1–9, axe on the five views (21.6s)
  ✓  17 [chromium] › e2e/020-rueckbau-passung.spec.ts:533:1 › 020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (4.1s)
  ✓  18 [chromium] › e2e/020-rueckbau-passung.spec.ts:578:1 › 020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.2s)
  ✓  19 [chromium] › e2e/020-rueckbau-passung.spec.ts:618:1 › 020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (3.4s)
  ✓  16 [chromium] › e2e/013-tastaturpfad.spec.ts:471:1 › 013-bekannt: Fokus nach Aktion — Charakterisierung, der Fokus landet heute auf BODY (takt-008) (34.2s)
  ✓  21 [chromium] › e2e/013-tastaturpfad.spec.ts:650:1 › 013f: prefers-reduced-motion — Übergänge und Animationen sind abgeschaltet (1.7s)
  ✓  22 [chromium] › e2e/013-tastaturpfad.spec.ts:670:1 › 013g: Kontrolllauf ohne reduced motion — dieselben drei Elemente haben wirklich einen Übergang (1.7s)
  ✓  20 [chromium] › e2e/abnahme.spec.ts:88:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (44.3s)

  22 passed (2.6m)
```

**`pnpm gates` (Ende, exit 0, auf dem committeten Stand, wörtlich kopiert):**

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6535.313665

> @hv/web@0.0.0 build /home/user/wt/010b/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-GCpAV7TH.js                        538.18 kB │ gzip: 157.00 kB │ map: 2,224.90 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a
plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a
sourcemap for the transformation. Consult the plugin documentation for help:
https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.10s
mark-test-run: wrote /home/user/wt/010b/.claude/state/last-test-run (clean tree) at commit f057bc3, tree d95378289c49…
```

Zusätzlich, im selben Lauf: `vocabulary-check: ok`; `i18n-literal check: 0 literals found under
apps/web/src/features, apps/web/src/app.`; `arch`: 7 vorbestehende Warnungen (0 Fehler), keine neue
(dieselben, die 010 schon im Bericht nannte — Dateien, die diese Scheibe nicht anfasst);
`role-literal-check` grün; `packages/domain test`: 72/72; `apps/api test`: 49/49; `apps/web test`:
48/48 (i18n-Paritätstest mit der neuen Schlüsselzahl 456 eingeschlossen); `contract:lint` (redocly):
1 vorbestehende Warnung (`oidc`-Security-Scheme unbenutzt, unverändert seit 010).

`pnpm gates`s eigener `slice-scope`-Aufruf (ohne `--slice`) übersprang mit der Meldung "not on a
claude/slice-NNN-…/claude/takt-NNN-… branch" — der Branchname `claude/slice-010b-lesepfade-ui` trägt
einen Buchstaben nach den drei Ziffern, den `^claude/(slice|takt)-(\d{3})-` nicht fasst (bestehendes
Skriptverhalten, kein Befund dieser Scheibe: ein Sprung, kein Fehlschlag). Explizit mit `--slice
010b` aufgerufen, wörtlich:

```
slice-scope: 30 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
```

**Screenshots** (`docs/evidence/010b-*.png`, sechs Bilder, DE/EN):
`010b-history-observer-de.png`/`-en.png` (Trefferliste nur Vorgelesenes, Vorgangshistorie ohne
Leseberechtigung), `010b-answers-observer-de.png`/`-en.png` (nur `read out`/`closed`-Zeilen),
`010b-stage-expert-de.png`/`-en.png` (Bühne ohne Leseberechtigung, Zähler/Warteschlange ausgeblendet).

**Touched:**
- `apps/web/src/features/speakers/useSpeakers.ts`, `apps/web/src/features/speakers/Page.tsx`
- `apps/web/src/features/capture/useCapture.ts`, `apps/web/src/features/capture/Page.tsx`
- `apps/web/src/features/answers/lib.ts`, `apps/web/src/features/answers/useBacklog.ts`,
  `apps/web/src/features/answers/WorkList.tsx`
- `apps/web/src/features/stage/lib.ts`, `apps/web/src/features/stage/Page.tsx`
- `apps/web/src/features/history/lib.ts`, `apps/web/src/features/history/Page.tsx`
- `apps/web/src/i18n/speakers.de.ts`, `speakers.en.ts`, `capture.de.ts`, `capture.en.ts`,
  `answers.de.ts`, `answers.en.ts`, `stage.de.ts`, `stage.en.ts`, `history.de.ts`, `history.en.ts`,
  `parity.test.ts` (nur Schlüsselzahl 442 → 456)
- `apps/web/e2e/010b-lesepfade.spec.ts` (neu)
- `docs/evidence/010b-history-observer-de.png`, `-en.png`, `010b-answers-observer-de.png`, `-en.png`,
  `010b-stage-expert-de.png`, `-en.png` (neu)
- `docs/slices/010b-lesepfade-oberflaeche.md` (dieser Bericht)

## Nacharbeit nach Review und Codex

Runde 2: unabhängige Prüfung Opus 5.5 (Perspektive Barrierefreiheit und Security), Urteil
„nacharbeiten" (1 Blocker, 1 Major, 6 Minor, 3 Nits), plus Codex auf PR #26 (1 P1, deckungsgleich
mit dem Blocker; 1 P2, deckungsgleich mit Minor 4). Beide durch einen Playwright-Probe des
Reviewers bestätigt. Jeder Punkt unten nennt die Änderung und die Datei(en).

**Blocker (= Codex P1) — Erfassung zeigte den gestalteten Zustand nie.**
`listContributions` (Ziel 1s Hauptabfrage) lief nur, sobald `speakerId` feststand, und der kam
ausschließlich aus einem erfolgreichen `listSpeakers`. Jede Rolle ohne `contribution.read` hält
laut Festlegung 4 von Scheibe 010 aber auch kein `speaker.read` — die Hauptabfrage wurde nie
versucht, `capture/Page.tsx` zeigte den gewöhnlichen leeren Schreibtisch, dazu fälschlich den
Nur-Lesen-Hinweis (der `deskActions`-Probe auf `listQuestions` gelingt expert/observer ja). Fix: ein
zweiter, von `speakerId` unabhängiger Aufruf derselben Hauptabfrage (`contributionsProbe` in
`capture/Page.tsx`) stellt die eigentliche Frage direkt, ohne die Kopplung von `contribution.read`
und `speaker.read` kennen zu müssen (Regel 4 — kein Rollenname, keine Rechte-Tabelle im Code).

Rot (vor dem Fix, `E2E_PORT=4391 npx playwright test --grep "Erfassung unter observer zeigt den
Zustand" --reporter=list`, wörtlich):

```
Running 1 test using 1 worker

  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:116:1 › Erfassung unter observer zeigt den Zustand "keine Leseberechtigung" (7.5s)


  1) [chromium] › e2e/010b-lesepfade.spec.ts:116:1 › Erfassung unter observer zeigt den Zustand "keine Leseberechtigung" 

    Error: expect(locator).toBeVisible() failed

    Locator: getByTestId('capture-forbidden')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 5000ms
      - waiting for getByTestId('capture-forbidden')


      129 |
      130 |   const forbidden = page.getByTestId('capture-forbidden');
    > 131 |   await expect(forbidden).toBeVisible();
          |                           ^
      132 |   await expect(forbidden).toContainText('In dieser Rolle keine Leseberechtigung für diese Ansicht');
      133 |   await expect(page.getByTestId('capture-readonly-hint')).toHaveCount(0);
      134 |
        at /home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:131:27

  1 failed
    [chromium] › e2e/010b-lesepfade.spec.ts:116:1 › Erfassung unter observer zeigt den Zustand "keine Leseberechtigung" 
```

Grün (nach dem Fix, derselbe Befehl, wörtlich):

```
Running 1 test using 1 worker

[axe] capture (observer, no read permission) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (observer, no read permission) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓  1 [chromium] › e2e/010b-lesepfade.spec.ts:130:1 › Erfassung unter observer zeigt den Zustand "keine Leseberechtigung" (3.5s)

  1 passed (6.1s)
```

Neue e2e „Erfassung unter observer zeigt den Zustand ‚keine Leseberechtigung'" (`010b-lesepfade.spec.ts`).

**Major — ein Klick auf eine Zeile unter observer blieb ohne jede Rückmeldung.**
`getQuestion` und `getQuestionHistory` teilten sich ein `Promise.all` (`answers/useBacklog.ts`);
observer hält kein `history.read`, also scheiterte jeder Klick als Ganzes, „Keine Einzelfrage
gewählt" blieb stehen. Fix: beide Aufrufe in eigene Effekte getrennt — die Einzelfrage zeigt sich
unabhängig von ihrem Verlauf; ein neues Flag `selectedHistoryForbidden` setzt den gestalteten
Zustand (`answers-history-forbidden`, neuer Schlüssel `answers.history.forbidden`) genau dort, wo
sonst der Hinweis auf eine erloschene Freigabe stünde (`answers/QuestionDetail.tsx`). Die e2e
„Beantwortung unter observer …" öffnet jetzt eine Zeile und prüft `answers-detail`,
`answers-detail-number` und `answers-history-forbidden`; der DE-Screenshot zeigt die geöffnete
Einzelfrage mit dem Hinweis.

**Minor 3 — veraltete Ereigniszahl im Ereignisstrom-Tab.**
Die „Die letzten n Ereignisse"-Beschreibung blieb bei einer Verweigerung stehen und konnte die Zahl
der vorherigen, privilegierteren Rolle zeigen. Fix: `streamWindow`/`curve` werden geleert und
`streamLastSeq` auf 0 zurückgesetzt, sobald `listEvents` verweigert wird; die Beschreibung blendet
sich dann aus (`history/Page.tsx`). Die e2e „Historie unter observer …" prüft jetzt zusätzlich, dass
kein Text nach dem Muster „Die letzten n Ereignisse" mehr im DOM steht.

**Minor 4 (= Codex P2) — Bühne räumte bei Verweigerung nicht auf.**
`getStage`s Verweigerung ließ die vorherige Rolle Frage (`stage`) stehen — Leertaste/R blieben auf
`stageRef.current` aktiv, und ein gespeichertes „Nur Bühne" (`hv-stage-only-v1=1`) zeigte weiter
Zähler, Kontrastregler und Umschalter neben dem gestalteten Zustand. Fix (`stage/Page.tsx`):
`setStage(null)` bei jeder Verweigerung; die Tastatur-Handler prüfen `forbidden` zuerst und tun dann
nichts; ein gespeichertes „Nur Bühne" fällt für eine Rolle ohne `stage.read` auf das gewöhnliche
Layout zurück statt auf die Vollbildansicht. Neue e2e „Bühne unter expert bleibt im gewöhnlichen
Layout, auch wenn ‚Nur Bühne' gespeichert ist" (setzt `hv-stage-only-v1=1` vor dem ersten Laden über
`page.addInitScript`, prüft `stage-only` Anzahl 0, jeden Zähler/Umschalter Anzahl 0, und dass die
Leertaste — nach einem Klick weg vom zuvor aktivierten Navigationslink — nichts auslöst).

**Minor 5 — verweigerte Zustände waren nur ein `<p>`.**
`role="status"` auf allen sieben gestalteten Zuständen (die fünf Hauptansichten plus die zwei
Historie-Unterzustände), damit ein Rollenwechsel sie einem Screenreader von selbst ankündigt. Der
e2e-Helfer `expectNoErrorToast` musste dafür auf den echten Toast-Container beschränkt werden
(`[aria-live="polite"] [role="status"]`) — sonst hätte er die neuen Zustände selbst gefunden.

**Minor 6 — rechte Spalte der Beantwortung blieb einladend, wenn die Liste selbst verweigert war.**
`answers/Page.tsx`: wenn `backlog.listForbidden`, zeigt die rechte Spalte nichts mehr statt „Wählen
Sie links eine Einzelfrage" — es gibt kein „links", aus dem etwas zu wählen wäre. Neue e2e
„Beantwortung unter podium …" prüft `answers-detail` Anzahl 0 und dass der Text „Wählen Sie links
eine Einzelfrage" nirgends steht.

**Minor 7 — Wortlaut kollidierte mit Freigabe/freigegeben.**
Alle `*.forbidden.body`-Einträge (DE) von „… ist für diese Rolle nicht zum Lesen freigegeben" auf
„Diese Rolle darf … nicht lesen" umgestellt; EN entsprechend auf „This role may not read …".
Beantwortung nennt jetzt „Answering" (der Seitenname) statt „the answer backlog" (Nit 11c).

**Test gap 8a — „Namen aus listSpeakers fehlen" in der Historie-unter-expert-Probe.**
Geprüft und dokumentiert statt blind zugesagt: `speakerNames` (das Ergebnis der Nebenabfrage) speist
ausschließlich `eventSubject()` (`eventSummary.ts`), gelesen nur vom Ereignisstrom-Tab. `event.read`
— dessen eigene Hauptabfrage — hält laut Festlegung 4 von Scheibe 010 ausschließlich admin, und
admin hält immer auch `speaker.read`. Unter den heutigen Rechtevergaben gibt es also keine Rolle,
für die „Namen fehlen, aber Ereignisse zeigen sich" ein Zustand ist, der irgendwo auf dem Bildschirm
stünde — die Vorgangshistorie (der hier offene Tab) liest `speakerNames` gar nicht erst
(`SpeakerRegistered`s Name kommt eingebettet aus dem Event selbst). Die e2e prüft stattdessen die
reale, greifbare Konsequenz: der Ereignisstrom-Tab zeigt unter expert seinerseits „keine
Leseberechtigung" (dieselbe Nebenabfrage-Verweigerung trägt keine Namen und keine Ereignisse vor).
Ein Kommentar an der Stelle in `010b-lesepfade.spec.ts` hält die Begründung fest, damit sie nicht
stillschweigend verschwindet.

**Test gap 8b — Beantwortung/Historie ganz ohne Leserecht (Akzeptanzkriterium 1).**
Zwei neue e2e: „Beantwortung unter podium zeigt den Zustand ‚keine Leseberechtigung'" und „Historie
unter podium zeigt den Zustand ‚keine Leseberechtigung'" — podium hält weder `question.read` noch
`question.read.delivered`, die Hauptabfrage verweigert also ganz, anders als bei observer (Ziel 3).
Beide mit axe, 0 serious/critical.

**Test gap 8c — `isReadForbidden` fünffach kopiert, ungetestet.**
Kein gemeinsamer Ort außerhalb der fünf pro Scheibe erlaubten Feature-Ordner steht zur Verfügung
(„Files allowed" von `docs/slices/010b-lesepfade-oberflaeche.md`); das Haus hält Feature-Helfer
ohnehin lokal (`stage/lib.ts`s eigener Docstring: „must not start depending on the backlog's
machinery" — `clockTime` ist aus demselben Grund dreifach kopiert). Entscheidung: fünf kleine
Kopien bleiben, jede exportiert und mit derselben Testtabelle belegt (`speakers/useSpeakers.test.ts`,
`capture/useCapture.test.ts`, `answers/lib.test.ts`, `stage/lib.test.ts`, `history/lib.test.ts` — je
5 Fälle: R-PERM-02 wahr, R-PERM-03 wahr, R-PERM-01 falsch, 404 falsch, 500 falsch). Ein Docstring an
jeder Kopie verweist auf die anderen vier und auf diese Begründung.

**Nit 9 — Stammdaten noch mit der Hauptabfrage gebündelt.**
`history/Page.tsx`: `listUnits`/`listAgendaItems` liefen mit `listQuestions` (der Hauptabfrage) in
einem gemeinsamen `Promise.all` — ein verweigertes `listQuestions` (podium) riss zwei Abfragen mit,
die laut Festlegung 1 nie scheitern. Jetzt drei unabhängige Effekte.

**Nit 10 — `speakerNames` blieb bei Verweigerung auf dem alten Stand.**
`history/Page.tsx`: `setSpeakerNames(new Map())` im `catch`-Zweig, vor der `isReadForbidden`-Prüfung
— eine Rolle, die `speaker.read` gerade verloren hat, zeigt keine Namen einer vorherigen Rolle mehr.

**Nit 11 — mehrere kleine Punkte.**
- 11a: `expectNoErrorToast` wartet jetzt zwei `requestAnimationFrame`s, bevor es prüft, statt sich
  auf eine sofort erfüllte, nicht abwartende Zusicherung zu verlassen.
- 11b: die englischen Titel verlieren den Schlusspunkt, den die deutsche Fassung nie hatte.
- 11c: siehe Minor 7 („Answering" statt „the answer backlog").
- 11d: zwei Zeilen zurückgesetzt, die ein früherer `prettier --write`-Lauf gegen den bestehenden
  Stand umformatiert hatte, ohne dass diese Scheibe dort etwas geändert hätte: `mayRegister`/
  `mayWriteSpeakers` in `speakers/Page.tsx` (Scheibe 010), die `lcs`-Zeile in `answers/lib.ts`
  (Scheibe 007) und die `role="group"`-Zeile in `answers/WorkList.tsx` (Scheibe 007).

**Playwright-Zusammenfassung** (ganze Suite, `E2E_PORT=4391 npx playwright test --reporter=list`,
Chromium unter `/opt/pw-browsers`, auf dem committeten Stand nach der Nacharbeit, wörtlich kopiert —
jede axe-Zeile 0 serious/critical):

```
Running 26 tests using 2 workers

  ✓   2 [chromium] › e2e/001-shell.spec.ts:25:1 › shell: counters, role switch, language switch @screenshot (11.1s)
  ✓   3 [chromium] › e2e/001-shell.spec.ts:93:1 › header strip on the answers desk @screenshot (5.1s)
  ✓   1 [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot (22.7s)
  ✓   5 [chromium] › e2e/010b-lesepfade.spec.ts:90:1 › Wortmeldeliste unter podium zeigt den Zustand "keine Leseberechtigung" (2.6s)
  ✓   6 [chromium] › e2e/010b-lesepfade.spec.ts:112:1 › Bühne unter expert zeigt den Zustand "keine Leseberechtigung" (3.0s)
  ✓   7 [chromium] › e2e/010b-lesepfade.spec.ts:141:1 › Bühne unter expert bleibt im gewöhnlichen Layout, auch wenn "Nur Bühne" gespeichert ist (3.0s)
  ✓   8 [chromium] › e2e/010b-lesepfade.spec.ts:184:1 › Erfassung unter observer zeigt den Zustand "keine Leseberechtigung" (2.9s)
  ✓   9 [chromium] › e2e/010b-lesepfade.spec.ts:207:1 › Beantwortung unter observer zeigt nur vorgelesene Fragen (3.9s)
  ✓  10 [chromium] › e2e/010b-lesepfade.spec.ts:253:1 › Historie unter observer: nur Vorgelesenes, Zeitleiste und Ereignisstrom ohne Leseberechtigung (11.1s)
  ✓  11 [chromium] › e2e/010b-lesepfade.spec.ts:308:1 › Historie unter expert öffnet die Zeitleiste (6.3s)
  ✓  12 [chromium] › e2e/010b-lesepfade.spec.ts:350:1 › Beantwortung unter podium zeigt den Zustand "keine Leseberechtigung" (2.8s)
  ✓  13 [chromium] › e2e/010b-lesepfade.spec.ts:373:1 › Historie unter podium zeigt den Zustand "keine Leseberechtigung" (2.6s)
  ✓  14 [chromium] › e2e/013-tastaturpfad.spec.ts:158:1 › 013a: Wortmeldung per Tastatur anlegen und mit Pfeiltasten umsortieren (10.3s)
  ✓   4 [chromium] › e2e/003-answers-stage.spec.ts:44:1 › backlog, approval, podium and history @screenshot (1.1m)
  ✓  15 [chromium] › e2e/013-tastaturpfad.spec.ts:281:1 › 013b: Redebeitrag erfassen und mit der Tastatur in Einzelfragen zerlegen (13.0s)
  ✓  17 [chromium] › e2e/013-tastaturpfad.spec.ts:371:1 › 013c: Antwort entwerfen und mit der Tastatur weiterleiten (13.9s)
  ✓  18 [chromium] › e2e/013-tastaturpfad.spec.ts:411:1 › 013d: Freigeben mit der Tastatur (3.9s)
  ✓  19 [chromium] › e2e/013-tastaturpfad.spec.ts:427:1 › 013e: Auf der Bühne "Vorgelesen, weiter" mit der Tastatur (2.6s)
  ✓  16 [chromium] › e2e/020-rueckbau-passung.spec.ts:111:1 › 020: Rückbau und Passung — points 1–9, axe on the five views (28.8s)
  ✓  21 [chromium] › e2e/020-rueckbau-passung.spec.ts:533:1 › 020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (4.1s)
  ✓  22 [chromium] › e2e/020-rueckbau-passung.spec.ts:578:1 › 020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.4s)
  ✓  23 [chromium] › e2e/020-rueckbau-passung.spec.ts:618:1 › 020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (5.3s)
  ✓  20 [chromium] › e2e/013-tastaturpfad.spec.ts:471:1 › 013-bekannt: Fokus nach Aktion — Charakterisierung, der Fokus landet heute auf BODY (takt-008) (35.2s)
  ✓  25 [chromium] › e2e/013-tastaturpfad.spec.ts:650:1 › 013f: prefers-reduced-motion — Übergänge und Animationen sind abgeschaltet (2.2s)
  ✓  26 [chromium] › e2e/013-tastaturpfad.spec.ts:670:1 › 013g: Kontrolllauf ohne reduced motion — dieselben drei Elemente haben wirklich einen Übergang (2.8s)
  ✓  24 [chromium] › e2e/abnahme.spec.ts:88:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (48.5s)

  26 passed (2.9m)
```

Erneut auf dem endgültig committeten Stand (Commit `2347b37`) laufen lassen, wörtlich identisch bis
auf die Laufzeiten (26 passed, 2.8m) — kein Nachtrag hat die Suite verändert.

**`pnpm gates` (Ende, exit 0, auf dem committeten Stand, wörtlich kopiert):**

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6313.452662

> @hv/web@0.0.0 build /home/user/wt/010b/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-BjXao8PQ.js                        539.01 kB │ gzip: 157.14 kB │ map: 2,237.43 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a
plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a
sourcemap for the transformation. Consult the plugin documentation for help:
https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.09s
mark-test-run: wrote /home/user/wt/010b/.claude/state/last-test-run (clean tree) at commit 2347b37, tree 3580908ee729…
```

`pnpm gates`s eigener `slice-scope`-Aufruf (ohne `--slice`) überspringt weiterhin mit „not on a
claude/slice-NNN-…/claude/takt-NNN-… branch" — der Branchname trägt einen Buchstaben nach den drei
Ziffern (`010b`), den `^claude/(slice|takt)-(\d{3})-` nicht fasst; laut Koordinator ein bekannter,
in takt-010 zu behebender Lückenfall des Skripts, kein Befund dieser Scheibe. Explizit aufgerufen,
wörtlich:

```
slice-scope: 37 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
```

**Touched (Nacharbeit, zusätzlich zu oben):**
- `apps/web/src/features/speakers/Page.tsx`, `useSpeakers.ts` (role=status, Reformatierung
  zurückgesetzt), `useSpeakers.test.ts` (neu)
- `apps/web/src/features/capture/Page.tsx` (Blocker-Fix, role=status), `useCapture.ts`,
  `useCapture.test.ts` (neu)
- `apps/web/src/features/answers/Page.tsx` (minor 6), `QuestionDetail.tsx` (major),
  `WorkList.tsx` (role=status, Reformatierung zurückgesetzt), `useBacklog.ts` (major), `lib.ts`
  (Reformatierung zurückgesetzt), `lib.test.ts`
- `apps/web/src/features/stage/Page.tsx` (minor 4, role=status), `lib.ts`, `lib.test.ts` (neu)
- `apps/web/src/features/history/Page.tsx` (nits 9/10, minor 3, role=status), `lib.ts`,
  `lib.test.ts` (neu)
- `apps/web/src/i18n/*.de.ts`/`*.en.ts` der fünf Feature-Module (minor 7, nits 11b/11c),
  `parity.test.ts` (Schlüsselzahl 456 → 457)
- `apps/web/e2e/010b-lesepfade.spec.ts` (neue und erweiterte Szenarien, siehe oben)
- `docs/evidence/010b-answers-observer-{de,en}.png` (neu erzeugt, zeigt jetzt die geöffnete
  Einzelfrage mit dem Verlaufs-Hinweis); `010b-history-observer-{de,en}.png`,
  `010b-stage-expert-{de,en}.png` (neu erzeugt, inhaltlich unverändert)
- `docs/slices/010b-lesepfade-oberflaeche.md` (diese Nacharbeit)

## Nacharbeit Runde 3

Runde 3: Nachprüfung Opus 5.5 auf 7f542b6 (Urteil „annehmen“, 5 Minor, 2 Nits), dazu Codex auf
7f542b6 (zwei P2). Befunde und Umgang stehen unter „Review findings“. Zuerst kamen die Tests
(Commit `6683469`), dann die Fixes, je Bereich ein Commit:

| Punkt | Commit |
|---|---|
| Runde 3 Befund 1 (Erfassung) | `d1d1d1e` |
| Runde 3 Befund 2, **Codex (a)** und **Codex (b)** (Beantwortung) | `5e1cb30` |
| Runde 3 Befund 4 (Bühne) | `2a6c70a` |
| Runde 3 Befunde 3 und 5 (nur Tests) | `6683469` |
| Nit 6 (Kommentare zu `role="status"`) | `809ce5c`, Erfassung und Bühne in `d1d1d1e`/`2a6c70a` |
| Nit 7 (Bericht) | dieser Bericht-Commit |

Die neuen e2e hängen sich an das In-Process-API (ADR 0002). Vites Dev-Server gibt `page.evaluate`
dieselbe Modulinstanz `/src/api/index.ts`, die die App nutzt. Der Test ersetzt dort eine
`HvApi`-Methode, um Aufrufe zu zählen, eine Antwort zu verzögern oder einen 500 zu liefern. Code
außerhalb der erlaubten Dateien wird dabei nicht geändert.

1. **Erfassung** (`capture/Page.tsx`): die Probe `listContributions()` läuft nur, solange keine
   Wortmeldung aufgelöst ist. `forbidden` kommt aus der Probe oder aus der Abfrage je Wortmeldung.
2. **Beantwortung** (`answers/useBacklog.ts`):
   - Der Verlauf wird mit seiner `questionId` gespeichert und nur weitergegeben, wenn er zu
     `selected.id` gehört.
   - Scheitern beide Detailabfragen einer Auswahl, erscheint höchstens ein Toast.
   - Codex (b): die Detailabfragen warten, bis die Liste für dieselbe `version`/`nonce`
     geantwortet hat. Bei verweigerter Liste laufen sie nicht, die Auswahl wird geleert.
   - Beim Laden bleibt das angezeigte Detail stehen (Prinzip 8).
3. **Ereignisstrom:** nur ein Test, der Fix stammt aus Runde 2.
4. **Bühne** (`stage/Page.tsx`):
   - Das Layout wartet auf die erste `getStage`-Antwort (`stage-deciding`), das Overlay blitzt
     nicht mehr auf.
   - Bei jedem Laden wird `stageRef` geleert. Leertaste und R wirken erst auf die Antwort der
     aktuellen `version`.
   - Das tote `!forbidden` im Overlay ist entfernt.
   - Der Ladezweig in `podium` ist entfallen, weil er nicht mehr erreichbar ist.
   - Abweichung vom Vorschlag: der sichtbare `stage`/`forbidden`-Zustand wird bei einem
     `version`-Wechsel nicht zurückgesetzt. Begründung unter „Review findings“, Befund 4.
5. **Leertaste nach Rollenwechsel:** nur ein Test, der Fix stammt aus Runde 2.
6. **Nit 6:** die Kommentare zu `role="status"` versprechen keine Ansage mehr.
7. **Nit 7 — Korrektur zu „Nacharbeit nach Review und Codex“ oben:** die Fixes zu Nit 9
   (Stammdaten getrennt von `listQuestions`) und Nit 10 (`speakerNames` wird bei Verweigerung
   geleert) in `history/Page.tsx` sind **ohne Test, nicht beobachtbar**.
   - Nit 9: `listUnits`/`listAgendaItems` scheitern für keine Rolle, und unter podium steht ohnehin
     die ganze Ansicht im Zustand „keine Leseberechtigung“.
   - Nit 10: `speakerNames` liest nur der Ereignisstrom. `event.read` hält nur admin, und admin hat
     immer auch `speaker.read` (siehe Test gap 8a).

**Rote Läufe.** Wörtlich kopiert. Mein Filter `grep -v "^\s*$"` hat nur Leerzeilen entfernt.

(a) Befunde 1, 2 und 4 sowie Codex (b), auf dem Code von 7f542b6 mit den neuen Tests
(`E2E_PORT=4391 npx playwright test e2e/010b-lesepfade.spec.ts --grep "Runde 3|Codex"
--reporter=list`):
- Die Tests 3 und 5 waren hier grün, siehe (c).
- Test 2 scheiterte in diesem ersten Lauf an der Vorbereitung: in der sichtbaren Liste gab es
  keine Zeile `new`. Er filtert seitdem über den Chip „zugewiesen“. Sein roter Lauf steht unter (b).

```
Running 7 tests using 1 worker
  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:420:1 › Runde 3 (1): Erfassung fragt listContributions nicht ungefiltert nach, ein 500 bringt einen Toast (2.2s)
  ✘  2 [chromium] › e2e/010b-lesepfade.spec.ts:472:1 › Runde 3 (2) / Codex (a): Beantwortung — der Verlauf gehört zur gewählten Einzelfrage (6.9s)
  ✘  3 [chromium] › e2e/010b-lesepfade.spec.ts:514:1 › Runde 3 (2): Beantwortung — scheitern Einzelfrage und Verlauf beide, erscheint ein Toast (7.1s)
  ✘  4 [chromium] › e2e/010b-lesepfade.spec.ts:538:1 › Codex (b): Beantwortung — Rollenwechsel ohne Leserecht bei offener Einzelfrage bringt keinen Toast (7.6s)
  ✓  5 [chromium] › e2e/010b-lesepfade.spec.ts:560:1 › Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin (3.1s)
  ✘  6 [chromium] › e2e/010b-lesepfade.spec.ts:587:1 › Runde 3 (4): Bühne — ein gespeichertes "Nur Bühne" blitzt nicht auf, bevor getStage antwortet (7.0s)
  ✓  7 [chromium] › e2e/010b-lesepfade.spec.ts:626:1 › Runde 3 (5): Bühne — podium mit aktueller Frage, Wechsel zu expert, Leertaste liefert nichts aus (2.1s)
  1) [chromium] › e2e/010b-lesepfade.spec.ts:420:1 › Runde 3 (1): Erfassung fragt listContributions nicht ungefiltert nach, ein 500 bringt einen Toast 
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 1
    + Received  + 3
    - Array []
    + Array [
    +   null,
    + ]
      465 |   // A Wortmeldung is resolved, so no unfiltered call of the whole corpus is needed any more …
      466 |   const calls = await page.evaluate(() => (window as unknown as Probe).__calls);
    > 467 |   expect(calls.filter((call) => call === null)).toEqual([]);
          |                                                 ^
      468 |   // … and one failed load is one toast, not two.
      469 |   await expect(toasts(page)).toHaveCount(1);
      470 | });
  3) [chromium] › e2e/010b-lesepfade.spec.ts:514:1 › Runde 3 (2): Beantwortung — scheitern Einzelfrage und Verlauf beide, erscheint ein Toast 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('[aria-live="polite"] [role="status"]')
    Expected: 1
    Received: 2
    Timeout:  5000ms
      533 |   await expect(toasts(page).first()).toBeVisible();
      534 |   await settle(page);
    > 535 |   await expect(toasts(page)).toHaveCount(1);
          |                              ^
  4) [chromium] › e2e/010b-lesepfade.spec.ts:538:1 › Codex (b): Beantwortung — Rollenwechsel ohne Leserecht bei offener Einzelfrage bringt keinen Toast 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('[aria-live="polite"] [role="status"]')
    Expected: 0
    Received: 2
    Timeout:  5000ms
        at expectNoErrorToast (/home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:76:70)
        at /home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:556:3
  5) [chromium] › e2e/010b-lesepfade.spec.ts:587:1 › Runde 3 (4): Bühne — ein gespeichertes "Nur Bühne" blitzt nicht auf, bevor getStage antwortet 
    Error: expect(locator).toBeVisible() failed
    Locator: getByTestId('stage-deciding')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    > 615 |   await expect(page.getByTestId('stage-deciding')).toBeVisible();
          |                                                    ^
  5 failed
  2 passed (44.6s)
```

In diesem Block sind Call-Log-, Trace- und Error-Context-Zeilen weggelassen. Den Block zu Test 2
zeigt (b). Sonst ist nichts verändert.

(b) Befund 2 / Codex (a), die fertige Testfassung auf dem Code von 7f542b6
(`--grep "Codex \(a\)"`):

```
Running 1 test using 1 worker
  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:472:1 › Runde 3 (2) / Codex (a): Beantwortung — der Verlauf gehört zur gewählten Einzelfrage (7.3s)
  1) [chromium] › e2e/010b-lesepfade.spec.ts:472:1 › Runde 3 (2) / Codex (a): Beantwortung — der Verlauf gehört zur gewählten Einzelfrage 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  getByTestId('approval-lapsed')
    Expected: 0
    Received: 1
    Timeout:  5000ms
    Call log:
      - Expect "toHaveCount" with timeout 5000ms
      - waiting for getByTestId('approval-lapsed')
        14 × locator resolved to 1 element
           - unexpected value "1"
      511 |   await expect(page.getByTestId('answers-detail-number')).toHaveText(second ?? '');
      512 |   await settle(page);
    > 513 |   await expect(page.getByTestId('approval-lapsed')).toHaveCount(0);
          |                                                     ^
  1 failed
```

(c) Befunde 3 und 5: auf 7f542b6 grün, weil der Fix aus Runde 2 schon da war. Für den roten Lauf
habe ich diesen Fix vorübergehend zurückgenommen und danach wiederhergestellt:
- in `history/Page.tsx`: `setStreamLastSeq(0)` und die `streamForbidden`-Weiche der Beschreibung;
- in `stage/Page.tsx`: `setStage(null)` und `if (forbidden) return;`.

```
Running 2 tests using 1 worker
  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:562:1 › Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin (7.8s)
  ✘  2 [chromium] › e2e/010b-lesepfade.spec.ts:628:1 › Runde 3 (5): Bühne — podium mit aktueller Frage, Wechsel zu expert, Leertaste liefert nichts aus (2.0s)
  1) [chromium] › e2e/010b-lesepfade.spec.ts:562:1 › Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  getByText(/Die letzten \d+ Ereignisse/)
    Expected: 0
    Received: 1
    Timeout:  5000ms
    > 577 |   await expect(countLine).toHaveCount(0);
          |                           ^
  2) [chromium] › e2e/010b-lesepfade.spec.ts:628:1 › Runde 3 (5): Bühne — podium mit aktueller Frage, Wechsel zu expert, Leertaste liefert nichts aus 
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 0
    Received: 1
    > 662 |   expect(await page.evaluate(() => (window as unknown as Probe).__calls.length)).toBe(0);
          |                                                                                  ^
  2 failed
```

In einem zweiten Lauf habe ich nur `setStreamLastSeq(0)` zurückgenommen. Dieser Lauf zeigt, dass
Test 3 auch das Zurücksetzen von `streamLastSeq` prüft:

```
Running 1 test using 1 worker
  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:562:1 › Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin (7.8s)
  1) [chromium] › e2e/010b-lesepfade.spec.ts:562:1 › Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin 
    Error: expect(locator).toBeVisible() failed
    Locator: getByTestId('history-stream')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
      580 |   // Back to admin: `streamLastSeq` was rewound, so the unchanged log is read again, not skipped.
      581 |   await asRole(page, 'admin');
    > 582 |   await expect(page.getByTestId('history-stream')).toBeVisible();
          |                                                    ^
  1 failed
```

**Grüner Lauf** nach den Fixes (derselbe Befehl wie in (a), wörtlich):

```
Running 7 tests using 1 worker
  ✓  1 [chromium] › e2e/010b-lesepfade.spec.ts:421:1 › Runde 3 (1): Erfassung fragt listContributions nicht ungefiltert nach, ein 500 bringt einen Toast (2.0s)
  ✓  2 [chromium] › e2e/010b-lesepfade.spec.ts:473:1 › Runde 3 (2) / Codex (a): Beantwortung — der Verlauf gehört zur gewählten Einzelfrage (2.1s)
  ✓  3 [chromium] › e2e/010b-lesepfade.spec.ts:517:1 › Runde 3 (2): Beantwortung — scheitern Einzelfrage und Verlauf beide, erscheint ein Toast (2.1s)
  ✓  4 [chromium] › e2e/010b-lesepfade.spec.ts:541:1 › Codex (b): Beantwortung — Rollenwechsel ohne Leserecht bei offener Einzelfrage bringt keinen Toast (2.1s)
  ✓  5 [chromium] › e2e/010b-lesepfade.spec.ts:563:1 › Runde 3 (3): Ereignisstrom — Rollenwechsel admin → observer → admin (3.1s)
  ✓  6 [chromium] › e2e/010b-lesepfade.spec.ts:590:1 › Runde 3 (4): Bühne — ein gespeichertes "Nur Bühne" blitzt nicht auf, bevor getStage antwortet (3.4s)
  ✓  7 [chromium] › e2e/010b-lesepfade.spec.ts:629:1 › Runde 3 (5): Bühne — podium mit aktueller Frage, Wechsel zu expert, Leertaste liefert nichts aus (1.7s)
  7 passed (19.1s)
```

**Ganze Playwright-Suite** auf Commit `809ce5c` (`E2E_PORT=4391 npx playwright test
--reporter=list`, Chromium unter `/opt/pw-browsers`):
- 33 passed (2.7m), exit 0.
- Alle 90 axe-Zeilen melden 0 serious/critical.
- Danach `git checkout -- docs/evidence`, weil die Spec keinen neuen Screenshot verlangt.

```
  33 passed (2.7m)
```

**`pnpm -C /home/user/wt/010b gates`** auf Commit `809ce5c`, exit 0. Das Ende steht wörtlich da, nur die ANSI-Farbcodes sind entfernt:

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6556.384921

> @hv/web@0.0.0 build /home/user/wt/010b/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-DW1LJ5aU.js                        539.23 kB │ gzip: 157.33 kB │ map: 2,242.15 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.18s
mark-test-run: wrote /home/user/wt/010b/.claude/state/last-test-run (clean tree) at commit 809ce5c, tree d8cce19f8e88…
```

Im selben Lauf:
- `vocabulary-check: ok`.
- `i18n-literal check: 0 literals found`.
- `role-literals` grün.
- `arch`: dieselben 7 vorbestehenden Warnungen, 0 Fehler.
- `oxlint`: 25 Warnungen, genauso viele wie auf 7f542b6.
- Tests: `packages/domain` 72/72, `apps/web` 73/73, `apps/api` 49/49.
- Der `slice-scope`-Aufruf der Gates überspringt wie bisher, weil der Branchname die Endung `010b`
  trägt. Explizit aufgerufen mit `node scripts/slice-scope.mjs --slice 010b`:

```
slice-scope: 37 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
```

**Touched (Runde 3):**
- `apps/web/src/features/capture/Page.tsx`
- `apps/web/src/features/answers/useBacklog.ts`, `QuestionDetail.tsx` und `WorkList.tsx` (bei den
  letzten beiden nur Kommentare)
- `apps/web/src/features/stage/Page.tsx`
- `apps/web/src/features/history/Page.tsx`, `apps/web/src/features/speakers/Page.tsx` (nur
  Kommentare)
- `apps/web/e2e/010b-lesepfade.spec.ts` (sieben neue Szenarien, Helfer)
- `docs/slices/010b-lesepfade-oberflaeche.md` (Befunde und dieser Bericht)

## Nacharbeit Runde 4

Runde 4: Nachprüfung auf 4f0d231 (Urteil „annehmen“, 2 Minor, 2 Nits), dazu Codex auf 4f0d231
(zwei P2). Befunde und Umgang stehen unter „Review findings“. Zuerst kamen die Tests (Commit
`9eb3c76`), dann die Fixes:

| Punkt | Commit |
|---|---|
| **Codex P2-1** (Erfassung: Probe vor der Wortmeldungs-Abfrage) | `a3ae45d` |
| **Codex P2-2** (Historie: maskierter 404 als Toast), als Klasse behoben, zusammen mit Nit C | `8cbc85d` |
| Runde 4 A und B (Bühne) | `0953c18` |
| Nit D (Doc-Kommentar der e2e-Datei) | `9eb3c76` |
| Bericht | dieser Commit |

**Codex P2-2 als Klasse.** Der Fehler entsteht so: neben der Hauptabfrage einer Ansicht läuft eine
Detailabfrage zu einer gewählten ID. Nach einem Rollenwechsel verweigert die Hauptabfrage mit
R-PERM-02, die Detailabfrage bekommt aber den maskierten 404 (Festlegung 3 von Scheibe 010). Den
behandelt `isReadForbidden` zu Recht nicht als Leseverweigerung, also wurde er zum Toast.

Geprüft habe ich jeden Leseaufruf der fünf Features:

| Feature | Aufrufe | Befund |
|---|---|---|
| Wortmeldeliste | nur `listSpeakers` (Hauptabfrage) | keine Detailabfrage, nichts zu schützen |
| Erfassung | `listSpeakers`, `listContributions` (Hauptabfrage und Probe), `listQuestions({ contributionId })`, `listQuestions({ limit: 1 })` | nur Listen; sie antworten nie mit 404, eine Verweigerung ist immer 403 R-PERM-02/03 und wird in `useAsync` zum Zustand, nicht zum Toast |
| Beantwortung | `listQuestions` (Hauptabfrage), `getQuestion` und `getQuestionHistory` (Details), `listUnits`/`listAgendaItems` (Stammdaten, nie verweigert); `listQuestions({ q })` in `Page.tsx` löst nur die Nummer im Zusammenführen-Dialog auf (Nutzeraktion) | **betroffen**, jetzt geschützt |
| Bühne | `getStage` (Hauptabfrage), `listQuestions({ limit: 1 })` (Probe, deren `catch` still ist) | keine Detailabfrage |
| Historie | `listQuestions` ×2 (Hauptabfrage), `getQuestionHistory` (Detail), `listSpeakers` (Nebenabfrage, eigene Verweigerung), `listEvents` (eigene Hauptabfrage des Reiters, 403 statt 404), Stammdaten | **betroffen**, jetzt geschützt |

Die Muster in `packages/domain/src/api.ts` bestätigen das: 404 werfen nur `getQuestion`,
`getQuestionHistory` und `get*`-Einzelabrufe; `listSpeakers`, `listContributions`,
`listQuestions` und `getStage` werfen nur 403.

Das eine lokale Muster ist `createDetailProblemGate`, je eine Kopie in `answers/lib.ts` und
`history/lib.ts`. Beide Kopien haben dieselbe Testtabelle mit 5 Fällen in `lib.test.ts`. So
arbeitet es:
- Der Fehler einer Detailabfrage wird zurückgehalten, bis die Hauptabfrage desselben Ladevorgangs
  geantwortet hat.
- War sie verweigert, verfällt der Fehler. Sonst erscheint er, einmal je Auswahl (Runde 3,
  Befund 2).
- Nit C: die Detailabfragen selbst warten nicht mehr auf die Liste. Das alte `detailGate` wurde bei
  hoher Ereignisrate nie fertig. Die Abfragen stoppen nur bei einer bekannten Verweigerung
  (`listForbidden` bzw. `mainForbidden`). Ein Ladevorgang, den der nächste überholt, meldet nie;
  sein Nachfolger liest ohnehin neu.

**Codex P2-1** (`capture/Page.tsx`):
- Die Probe läuft erst, wenn die Wortmeldungs-Abfrage geantwortet hat und keine Wortmeldung
  ergab (verweigert, gescheitert oder leer).
- Weil die Probe dabei während eines Nachladens kurz „ready“ antwortet, ändert sich der Zustand
  „keine Leseberechtigung“ erst, wenn alle drei Abfragen geantwortet haben. (Korrektur in Runde 5: das galt nur ohne Latenz, siehe „Nacharbeit Runde 5“.) Sonst würde der
  Schreibtisch kurz aufblitzen (Prinzip 8).

**A** (`stage/Page.tsx`): scheitert `getStage` mit etwas anderem als einer Leseverweigerung, bekommt
`stageRef` den noch angezeigten Stand zurück (`shownRef`). Jeden Schreibvorgang entscheidet
weiterhin der Dienst.

**B** (`stage/Page.tsx`):
- Ein Akteurwechsel setzt `loading` zurück; bis zur ersten Antwort steht das Skelett
  `stage-deciding`. Bei einem gewöhnlichen Ereignis passiert das nicht.
- Das geschieht beim Rendern, nicht erst in einem Effekt; so wird kein Frame des alten Overlays
  gezeichnet.
- Der Akteur wird über `useActor()` erkannt und nach Identität verglichen, nie nach Rollenname
  (Regel 4).
- Bekannte Randlücke: eine noch laufende `getStage`-Antwort der vorigen `version` könnte in der
  Lücke zwischen Akteurwechsel und `version`-Sprung ankommen. Im In-Process-Betrieb ist das nicht
  zu beobachten.

**Roter Lauf** auf den neuen Tests mit dem Code von 4f0d231
(`E2E_PORT=4391 npx playwright test e2e/010b-lesepfade.spec.ts --grep "4f0d231|Runde 4"
--reporter=list`). Weggelassen sind Leerzeilen sowie Call-Log-, Trace- und Error-Context-Zeilen;
sonst ist der Text wörtlich:

```
Running 4 tests using 1 worker
  ✘  1 [chromium] › e2e/010b-lesepfade.spec.ts:680:1 › Codex P2-1 (4f0d231): Erfassung fragt vom ersten Aufruf an nicht ungefiltert, wenn es Wortmeldungen gibt (2.2s)
  ✘  2 [chromium] › e2e/010b-lesepfade.spec.ts:718:1 › Codex P2-2 (4f0d231): Historie — Rollenwechsel ohne Leserecht bei gewählter Frage bringt keinen Toast (7.5s)
  ✘  3 [chromium] › e2e/010b-lesepfade.spec.ts:738:1 › Runde 4 (A): Bühne — nach einem 500 von getStage wirkt "Vorgelesen, weiter" auf die angezeigte Frage (7.3s)
  ✘  4 [chromium] › e2e/010b-lesepfade.spec.ts:778:1 › Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" zeigt nicht das Overlay der vorigen Rolle (6.9s)
  1) [chromium] › e2e/010b-lesepfade.spec.ts:680:1 › Codex P2-1 (4f0d231): Erfassung fragt vom ersten Aufruf an nicht ungefiltert, wenn es Wortmeldungen gibt 
    Error: expect(received).toEqual(expected) // deep equality
    - Expected  - 1
    + Received  + 5
    - Array []
    + Array [
    +   null,
    +   null,
    +   null,
    + ]
    > 714 |   expect(calls.filter((call) => call === null)).toEqual([]);
          |                                                 ^
  2) [chromium] › e2e/010b-lesepfade.spec.ts:718:1 › Codex P2-2 (4f0d231): Historie — Rollenwechsel ohne Leserecht bei gewählter Frage bringt keinen Toast 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('[aria-live="polite"] [role="status"]')
    Expected: 0
    Received: 1
    Timeout:  5000ms
        at expectNoErrorToast (/home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:77:70)
        at /home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:735:3
  3) [chromium] › e2e/010b-lesepfade.spec.ts:738:1 › Runde 4 (A): Bühne — nach einem 500 von getStage wirkt "Vorgelesen, weiter" auf die angezeigte Frage 
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 1
    Received: 0
    - Timeout 5000ms exceeded while waiting on the predicate
    > 775 |   await expect.poll(() => page.evaluate(() => (window as unknown as Probe).__calls.length)).toBe(1);
          |                                                                                             ^
  4) [chromium] › e2e/010b-lesepfade.spec.ts:778:1 › Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" zeigt nicht das Overlay der vorigen Rolle 
    Error: expect(locator).toBeVisible() failed
    Locator: getByTestId('stage-deciding')
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found
    > 811 |   await expect(page.getByTestId('stage-deciding')).toBeVisible();
          |                                                    ^
  4 failed
```

**Grüner Lauf** nach den Fixes, derselbe Befehl, wörtlich:

```
Running 4 tests using 1 worker
  ✓  1 [chromium] › e2e/010b-lesepfade.spec.ts:680:1 › Codex P2-1 (4f0d231): Erfassung fragt vom ersten Aufruf an nicht ungefiltert, wenn es Wortmeldungen gibt (2.1s)
  ✓  2 [chromium] › e2e/010b-lesepfade.spec.ts:718:1 › Codex P2-2 (4f0d231): Historie — Rollenwechsel ohne Leserecht bei gewählter Frage bringt keinen Toast (2.4s)
  ✓  3 [chromium] › e2e/010b-lesepfade.spec.ts:738:1 › Runde 4 (A): Bühne — nach einem 500 von getStage wirkt "Vorgelesen, weiter" auf die angezeigte Frage (1.9s)
  ✓  4 [chromium] › e2e/010b-lesepfade.spec.ts:778:1 › Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" zeigt nicht das Overlay der vorigen Rolle (3.7s)
  4 passed (12.5s)
```

Nit C hat keinen eigenen e2e-Test: eine Ereignisrate über der Antwortzeit der Liste lässt sich im
In-Process-Betrieb nicht zuverlässig erzeugen. Belegt ist er über die Unit-Tabelle von
`createDetailProblemGate`; der Fall „ein überholter Ladevorgang meldet nie, die nächste Auswahl
schon“ gehört dazu. Die e2e-Tests aus Runde 3 zu Codex (a) und (b) bleiben grün.

**Ganze Playwright-Suite** auf Commit `0953c18` (`E2E_PORT=4391 npx playwright test
--reporter=list`, Chromium unter `/opt/pw-browsers`):
- 37 passed (3.5m), exit 0.
- Alle 90 axe-Zeilen melden 0 serious/critical.
- Danach `git checkout -- docs/evidence`.

```
  37 passed (3.5m)
```

**`pnpm -C /home/user/wt/010b gates`** auf Commit `0953c18`, exit 0, Log über `mktemp`. Das Ende
steht wörtlich da, nur die ANSI-Farbcodes sind entfernt:

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7045.326793

> @hv/web@0.0.0 build /home/user/wt/010b/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-CdF10d4X.js                        540.03 kB │ gzip: 157.68 kB │ map: 2,251.17 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.27s
mark-test-run: wrote /home/user/wt/010b/.claude/state/last-test-run (clean tree) at commit 0953c18, tree 0c25e40ab577…
```

Im selben Lauf:
- `vocabulary-check: ok`.
- `i18n-literal check: 0 literals found`.
- `role-literals` grün.
- `arch`: dieselben 7 vorbestehenden Warnungen, 0 Fehler.
- `oxlint`: 25 Warnungen, unverändert.
- Tests: `packages/domain` 72/72, `apps/web` 83/83 (10 neue Gate-Fälle), `apps/api` 49/49.
- `slice-scope --slice 010b` explizit aufgerufen:

```
slice-scope: 37 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
```

**Touched (Runde 4):**
- `apps/web/src/features/capture/Page.tsx`
- `apps/web/src/features/answers/useBacklog.ts`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/history/Page.tsx`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/stage/Page.tsx`
- `apps/web/e2e/010b-lesepfade.spec.ts`
- `docs/slices/010b-lesepfade-oberflaeche.md`

## Nacharbeit Runde 5

Runde 5: Nachprüfung auf 948a721 (Urteil „annehmen“; 1 Minor, 1 Nit, 2 optionale Nits), dazu Codex
auf 948a721 (zwei P2). Befunde und Umgang stehen unter „Review findings“. Zuerst kamen die Tests
(Commit `6631130`), dann die Fixes:

| Punkt | Commit |
|---|---|
| **Codex P2-A** (Beantwortung und Historie: gescopte Liste ohne die gewählte Frage) | `7f76dc9` |
| **Codex P2-B** (Bühne: eine Antwort der vorigen Rolle wird übernommen) | `e64af10` |
| Runde 5 Befund 1 (Erfassung: Flackern bei Latenz) | `bd9e250` |
| Runde 5 Nit 2 (ein Toast je Auswahl-Durchgang) | `7f76dc9` |
| Runde 5 Nit 3 (`actor.id` statt Objektidentität) | `e64af10` |
| Runde 5 Nit 4 (MutationObserver im Test „Runde 4 (B)“) | `6631130` |
| Test „Runde 4 (A)“ angepasst (siehe unten) | `150b81a` |
| Bericht | dieser Commit |

**Codex P2-A, als Erweiterung derselben Klasse** (`createDetailProblemGate`, je eine Kopie in
`answers/lib.ts` und `history/lib.ts`):
- `settleMain` nimmt jetzt zusätzlich `omits(id)` an: die Antwort der Hauptabfrage lässt die
  gewählte Frage bekanntermaßen aus. Ein Fehler der Detailabfrage zu einer solchen Frage verfällt
  genauso wie bei einer verweigerten Liste.
- `omits` gibt es nur für eine vollständige Liste: ohne serverseitigen Filter (Suche, Antwortpfad,
  Einheit, TOP) und ohne Abschnitt durch das Limit. Eine gefilterte Liste sagt nichts darüber, was
  sie weglässt.
- Beide Ansichten blenden die Auswahl aus, solange die Liste verweigert ist oder sie als
  vollständige Liste auslässt (`selectionHidden`). Dann gibt es keine Detailabfrage, kein Detail
  und keine `_actions` der vorigen Rolle. Die Auswahl selbst bleibt erhalten: nach dem Wechsel
  zurück erscheint sie wieder.

**Nit 2:** der Gate zählt Auswahl-Durchgänge (`select()` bei jedem Wechsel der Auswahl). A
(Fehler, Toast), dann B, dann wieder A meldet den zweiten Fehler von A. Die Testtabelle hat in
beiden Features zwei neue Fälle: den sechsten für Nit 2 und den siebten für P2-A.

**Codex P2-B** (`stage/Page.tsx`):
- Jede `getStage`-Antwort ist an den anfragenden Akteur gebunden. Hat sich
  `getActor().id` seit der Anfrage geändert, wird die Antwort verworfen. Gelesen wird im Moment
  der Antwort, nicht aus React-State; kein Render muss vorher laufen.
- Ein Akteurwechsel verwirft außerdem den angezeigten Stand der vorigen Rolle (`setStage(null)`).
  So kann auch ein späterer 500 (Befund A aus Runde 4) ihn nicht zurückgeben.
- Damit ist die Randlücke geschlossen, die der Bericht zu Runde 4 unter B genannt hatte.
- Folge für den Test „Runde 4 (A)“: er hat das fehlschlagende Nachladen bisher durch einen
  Rollenwechsel podium → admin ausgelöst. Der verwirft den Stand jetzt absichtlich. Der Test löst
  das Nachladen deshalb durch ein gewöhnliches Ereignis aus (admin legt eine Wortmeldung an).
  Gegenprobe: mit vorübergehend entfernter Zeile `stageRef.current = shownRef.current` ist der
  angepasste Test rot (`Expected: 1, Received: 0` bei den `deliverQuestion`-Aufrufen), mit der
  Zeile grün.

**Nit 3:** der Vergleich läuft über `actor.id`, nicht über die Identität des Objekts. Das hält auch
bei einem frischen Identitätsobjekt für dieselbe Person (OIDC-Token-Refresh).

**Befund 1** (`capture/useCapture.ts`, `capture/Page.tsx`): `useAsync` liefert jetzt `settled`.
Das heißt: der Status hat für den Schlüssel dieses Renders geantwortet. `settled` in der Erfassung
verlangt das für alle drei Abfragen.

**Korrektur zu Codex P2-1 im Bericht „Nacharbeit Runde 4“:** der Satz „ändert sich der Zustand
‚keine Leseberechtigung‘ erst, wenn alle drei Abfragen geantwortet haben“ stimmte nur ohne Latenz.
Direkt nach einem Schlüsselwechsel meldete `useAsync` noch den Status des vorigen Schlüssels. Mit
Latenz fiel der Zustand bei jedem `version`-Sprung für einen Render weg; das hat der neue Test
„Runde 5 (1)“ auf 948a721 gemessen. Seit `bd9e250` stimmt der Satz.

**Rote Läufe.** Wörtlich kopiert. Weggelassen sind Leerzeilen sowie Call-Log-, Trace- und
Error-Context-Zeilen.

(a) Die neuen e2e mit dem Code von 948a721 (`E2E_PORT=4391 npx playwright test
e2e/010b-lesepfade.spec.ts --grep "948a721|Runde 5|Runde 4 \(B\)" --reporter=list`):
- „Runde 4 (B)“ ist grün, weil B seit Runde 4 behoben ist. Der Test hat jetzt zusätzlich einen
  MutationObserver (Nit 4).
- Die `[WebServer] … Unhandled rejection`-Zeilen dieses Laufs stammen aus dem Latenz-Patch des
  P2-B-Tests. Der Test fängt die zurückgehaltene Ablehnung jetzt ab.

```
Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/010b-lesepfade.spec.ts:778:1 › Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" zeigt nicht das Overlay der vorigen Rolle (3.5s)
  ✘  2 [chromium] › e2e/010b-lesepfade.spec.ts:846:1 › Codex P2-A (948a721): Beantwortung — Wechsel zu observer bei offener, nicht vorgelesener Frage (7.1s)
  ✘  3 [chromium] › e2e/010b-lesepfade.spec.ts:872:1 › Codex P2-A (948a721): Historie — Wechsel zu observer bei gewählter, nicht vorgelesener Frage (7.5s)
  ✘  4 [chromium] › e2e/010b-lesepfade.spec.ts:895:1 › Codex P2-B (948a721): Bühne — eine Antwort, die noch für die vorige Rolle unterwegs ist, wird nicht übernommen (2.3s)
  ✘  5 [chromium] › e2e/010b-lesepfade.spec.ts:953:1 › Runde 5 (1): Erfassung — der Zustand "keine Leseberechtigung" flackert bei Latenz nicht (2.8s)
  1) [chromium] › e2e/010b-lesepfade.spec.ts:846:1 › Codex P2-A (948a721): Beantwortung — Wechsel zu observer bei offener, nicht vorgelesener Frage 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('[aria-live="polite"] [role="status"]')
    Expected: 0
    Received: 1
    Timeout:  5000ms
        at expectNoErrorToast (/home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:77:70)
        at /home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:867:3
  2) [chromium] › e2e/010b-lesepfade.spec.ts:872:1 › Codex P2-A (948a721): Historie — Wechsel zu observer bei gewählter, nicht vorgelesener Frage 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('[aria-live="polite"] [role="status"]')
    Expected: 0
    Received: 1
    Timeout:  5000ms
        at expectNoErrorToast (/home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:77:70)
        at /home/user/wt/010b/apps/web/e2e/010b-lesepfade.spec.ts:890:3
  3) [chromium] › e2e/010b-lesepfade.spec.ts:895:1 › Codex P2-B (948a721): Bühne — eine Antwort, die noch für die vorige Rolle unterwegs ist, wird nicht übernommen 
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: false
    Received: true
    > 944 |   expect(await page.evaluate(() => (window as unknown as { __sawStale: boolean }).__sawStale)).toBe(false);
          |                                                                                                ^
  4) [chromium] › e2e/010b-lesepfade.spec.ts:953:1 › Runde 5 (1): Erfassung — der Zustand "keine Leseberechtigung" flackert bei Latenz nicht 
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: 0
    Received: 1
    > 994 |   expect(await page.evaluate(() => (window as unknown as { __lostForbidden: number }).__lostForbidden)).toBe(0);
          |                                                                                                         ^
  4 failed
  1 passed (29.1s)
```

(b) Nit 2 als Unit-Lauf. Gate und Tag wie in `useBacklog.ts` auf 948a721 (`${load}:${selectedId}`)
laufen über A (Fehler), B und wieder A (Fehler). Die Testdatei war temporär und ist wieder
gelöscht (`npx vitest run src/features/answers/oldgate.tmp.test.ts`):

```
 ❯ src/features/answers/oldgate.tmp.test.ts (1 test | 1 failed) 10ms
     × A fails (shown), B, then A again fails: shown again — a new pass (nit 2, round 5) 9ms
AssertionError: expected [ 'first' ] to deeply equal [ 'first', 'second' ]
 Test Files  1 failed (1)
      Tests  1 failed (1)
```

**Grüner Lauf** nach den Fixes, derselbe e2e-Befehl wie in (a), wörtlich:

```
Running 5 tests using 1 worker
  ✓  1 [chromium] › e2e/010b-lesepfade.spec.ts:778:1 › Runde 4 (B): Bühne — Rollenwechsel bei offenem "Nur Bühne" zeigt nicht das Overlay der vorigen Rolle (3.5s)
  ✓  2 [chromium] › e2e/010b-lesepfade.spec.ts:846:1 › Codex P2-A (948a721): Beantwortung — Wechsel zu observer bei offener, nicht vorgelesener Frage (2.0s)
  ✓  3 [chromium] › e2e/010b-lesepfade.spec.ts:872:1 › Codex P2-A (948a721): Historie — Wechsel zu observer bei gewählter, nicht vorgelesener Frage (2.3s)
  ✓  4 [chromium] › e2e/010b-lesepfade.spec.ts:895:1 › Codex P2-B (948a721): Bühne — eine Antwort, die noch für die vorige Rolle unterwegs ist, wird nicht übernommen (2.5s)
  ✓  5 [chromium] › e2e/010b-lesepfade.spec.ts:955:1 › Runde 5 (1): Erfassung — der Zustand "keine Leseberechtigung" flackert bei Latenz nicht (2.7s)
  5 passed (15.6s)
```

Die Gate-Tabellen in `answers/lib.test.ts` und `history/lib.test.ts` sind grün: 27 Tests in
beiden Dateien zusammen.

**Ganze Playwright-Suite** auf Commit `150b81a` (`E2E_PORT=4391 npx playwright test
--reporter=list`, Chromium unter `/opt/pw-browsers`):
- 41 passed (2.9m), exit 0.
- Alle 90 axe-Zeilen melden 0 serious/critical.
- Danach `git checkout -- docs/evidence`.
- Ein erster Lauf auf `bd9e250` hatte „Runde 4 (A)“ rot (1 failed, 40 passed). Grund war die
  Wechselwirkung mit P2-B, siehe oben. Der Test ist in `150b81a` angepasst.

```
  41 passed (2.9m)
```

**`pnpm -C /home/user/wt/010b gates`** auf Commit `150b81a`, exit 0, Log über `mktemp`. Das Ende
steht wörtlich da, nur die ANSI-Farbcodes sind entfernt:

```
1..196
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6373.949934

> @hv/web@0.0.0 build /home/user/wt/010b/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-DVvT9WbR.js                        540.82 kB │ gzip: 158.10 kB │ map: 2,258.48 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.24s
mark-test-run: wrote /home/user/wt/010b/.claude/state/last-test-run (clean tree) at commit 150b81a, tree ac29e7e5133a…
```

Im selben Lauf:
- `vocabulary-check: ok`.
- `i18n-literal check: 0 literals found`.
- `role-literals` grün.
- `arch`: dieselben 7 vorbestehenden Warnungen, 0 Fehler.
- `oxlint`: 25 Warnungen, unverändert.
- Tests: `packages/domain` 72/72, `apps/web` 87/87, `apps/api` 49/49.
- `slice-scope --slice 010b` explizit aufgerufen:

```
slice-scope: 37 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
```

**Offen (Folgearbeit, kein Sicherheitsbezug):** in der Beantwortung mit aktivem serverseitigem
Filter (Suche, Antwortpfad, Einheit, TOP) kann die Liste nicht sagen, was sie weglässt.
- Was dann passiert: wechselt in diesem Zustand die Rolle zu einer, die die offene Frage nicht
  lesen darf, erscheint noch ein Fehler-Toast.
- Was nicht passiert: das Detail und seine `_actions` verschwinden trotzdem, weil der maskierte
  404 von `getQuestion` sie leert.
- Warum nicht jetzt behoben: die Lücke zu schließen hieße, die Filter der Beantwortung ganz in den
  Speicher zu verlegen oder eine zweite, ungefilterte Liste zu laden. Beides geht über diese
  Scheibe hinaus.

**Touched (Runde 5):**
- `apps/web/src/features/answers/useBacklog.ts`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/history/Page.tsx`, `lib.ts`, `lib.test.ts`
- `apps/web/src/features/stage/Page.tsx`
- `apps/web/src/features/capture/useCapture.ts`, `Page.tsx`
- `apps/web/e2e/010b-lesepfade.spec.ts`
- `docs/slices/010b-lesepfade-oberflaeche.md`

## Review findings

(vom Reviewer)

### Runde 3 — Nachprüfung Opus 5.5 auf 7f542b6: annehmen

1. minor, `apps/web/src/features/capture/Page.tsx:79-84`.
   - `contributionsProbe` makes a second, unfiltered `listContributions()` call on every `version`. It fetches the whole corpus and throws the data away.
   - On a 500 or network error it shows two toasts.
   - Fix: run the probe only while `speakerId === null`, for example the loader `speakerId === null ? api.listContributions() : Promise.resolve(NO_CONTRIBUTIONS)` with key `cp:${version}:${speakerId === null}`, and `forbidden = probe forbidden || contributions forbidden`. The alternative is a single unfiltered call that filters locally.
   - **Umgang:** angenommen, behoben in `d1d1d1e` wie vorgeschlagen (Probe nur bei `speakerId === null`, Schlüssel `cp:${version}:${speakerId === null}`, `forbidden` aus beiden). e2e „Runde 3 (1)“, rot/grün im Bericht „Nacharbeit Runde 3“.
2. minor, `apps/web/src/features/answers/useBacklog.ts:161-223`.
   - After the split, `selectedHistory` and `selectedHistoryForbidden` keep the previous question's state when the selection changes. `lapsedApproval(question, history)` at `QuestionDetail.tsx:248` then computes with the wrong events, which can briefly show a false "Freigabe erloschen".
   - A 404 or 500 on both calls shows two toasts.
   - Fix: store the history together with its `questionId` and pass it on only when it matches `selected.id`, or reset it on a `selectedId` change. Show at most one toast.
   - **Umgang:** angenommen, behoben in `5e1cb30`: der Verlauf wird mit seiner `questionId` gespeichert und nur weitergegeben, wenn sie `selected.id` entspricht; ein Toast je Auswahl (`problemOnce`). Zwei e2e „Runde 3 (2)“, rot/grün im Bericht.
3. minor, test gap in `e2e/010b-lesepfade.spec.ts:283-290`.
   - No test covers a stale event count after switching roles, or the reset of `streamLastSeq`.
   - Add an e2e: admin on the event stream, switch to observer, the count is gone; back to admin, the stream is filled again.
   - **Umgang:** angenommen, e2e „Runde 3 (3)“ in `6683469`. Auf 7f542b6 grün (der Fix aus Runde 2 war da); rot gegen den vorübergehend zurückgenommenen Fix aus Runde 2, zwei Läufe im Bericht.
4. minor, `apps/web/src/features/stage/Page.tsx:483`.
   - `stageOnly && !forbidden` only applies once the 403 has arrived. While loading, the fullscreen overlay with counters flashes and then jumps, which violates design principle #8.
   - When switching roles, the old `stage` stays in `stageRef`.
   - Fix: defer the layout decision until the first `getStage` result is known, as the `stage-deciding` skeleton already does. Reset forbidden and stage on a `version` change. The `!forbidden` at `:500` is dead code; remove it.
   - **Umgang:** angenommen, behoben in `2a6c70a`, mit einer Abweichung: das Layout wartet auf die erste `getStage`-Antwort (Skelett `stage-deciding`), `!forbidden` im Overlay ist entfernt. Bei jedem `version`-Wechsel wird nur `stageRef` geleert, nicht der sichtbare `stage`/`forbidden`-Zustand, weil `version` bei jedem neuen Ereignis steigt und die Bühne sonst bei jedem Ereignis springen würde (Prinzip 8). e2e „Runde 3 (4)“, rot/grün im Bericht.
5. minor, test gap in `e2e/010b-lesepfade.spec.ts:176-179`.
   - The space-bar check would not have failed before the fix.
   - Start as podium with a current question, switch to expert, press space, then check that the delivered count or the event count stays the same.
   - **Umgang:** angenommen, e2e „Runde 3 (5)“ in `6683469`. Sie zählt die Aufrufe von `deliverQuestion` und prüft auf Fehler-Toasts, nicht die Zahl der Vorgelesenen: der Dienst lehnt eine Auslieferung durch expert ohnehin ab (R-PERM-01), also bliebe diese Zahl auch ohne den Fix gleich. Rot gegen den vorübergehend zurückgenommenen Fix aus Runde 2.
6. nit: the `role="status"` comments promise reliable announcements. A live region that is mounted together with its content is often not announced. Tone down the comments.
   - **Umgang:** angenommen, in `809ce5c` (sowie in `d1d1d1e`/`2a6c70a` für Erfassung und Bühne): alle Kommentare zu `role="status"` versprechen keine Ansage mehr, nur noch einen Hinweis an Hilfstechnik.
7. nit: in the Bericht, mark the fixes for nits 9 and 10 in `history/Page.tsx` as "ohne Test, nicht beobachtbar".
   - **Umgang:** angenommen, im Bericht unten („Nacharbeit Runde 3“, Punkt 7) markiert.

### Codex auf 7f542b6

(a) P2, `useBacklog.ts:202`: history from question A stays in place while B loads, so `lapsedApproval` can mix the two. This is the same as finding 2 of Runde 3; the same fix covers it.
   - **Umgang:** angenommen, derselbe Fix wie Runde 3 Befund 2, Commit `5e1cb30`; e2e „Runde 3 (2) / Codex (a)“.

(b) P2, `useBacklog.ts:187`:
   - Setup: a question is selected, then the actor switches to a role without question read access.
   - `listQuestions` correctly renders `answers-forbidden`.
   - The concurrent `getQuestion` call gets the API's masked 404, which carries no R-PERM-02/03, so it falls through to `problem(error)` and shows an error toast on top of the designed state.
   - Fix: once the main query is forbidden, ignore or cancel the detail request, or clear the selection.
   - Test first: e2e with admin, select a question, switch to a role without `question.read`, then check `expectNoErrorToast` and `answers-forbidden`. Include the red run.
   - **Umgang:** angenommen, behoben in `5e1cb30`: die Detailabfragen warten, bis die Liste für dieselbe `version`/`nonce` geantwortet hat, und laufen gar nicht, wenn sie verweigert ist; die Auswahl wird dann geleert. e2e „Codex (b)“, rot/grün im Bericht.

### Runde 4 — Nachprüfung auf 4f0d231: annehmen

- A (minor), `stage/Page.tsx:191` together with :213/:288/:314/:352: if `getStage` fails with a non-403 error, `stageRef` stays null, and "Vorgelesen, weiter" (button and space/R) silently does nothing until the next event. Fix it by storing `stage` with its `version` and acting only when they match, or by resetting the ref to the visible stage in the error branch. Test with a 500 through your `page.evaluate` patch.
  - **Umgang:** angenommen, behoben in `0953c18` (zweite Variante): im Fehlerzweig bekommt `stageRef` den angezeigten Stand zurück. e2e „Runde 4 (A)“ mit einem 500 über den `page.evaluate`-Patch, rot/grün im Bericht „Nacharbeit Runde 4“.
- B (minor), `stage/Page.tsx:485`: when the role changes on an open page while the podium overlay is shown, the previous role's overlay is visible for one response time. Preferred fix: set `loading` again on an actor change (not on every event). Otherwise add an "Offen" line with the reason.
  - **Umgang:** angenommen, behoben in `0953c18` (bevorzugte Variante): ein Akteurwechsel setzt `loading` zurück, ein gewöhnliches Ereignis nicht. Der Akteur wird nach Identität verglichen, nicht nach Rollenname. e2e „Runde 4 (B)“, rot/grün im Bericht.
- C (nit), `answers/useBacklog.ts:186/213/241`: if the event rate is higher than the list's response time, `detailGate` never settles. Wait only for the "refused" outcome, or for the first response after an actor change; at the very least add a comment. Consider this together with Codex P2-2, since it is the same gate.
  - **Umgang:** angenommen, behoben in `8cbc85d` zusammen mit Codex P2-2: `detailGate` ist entfallen. Die Detailabfragen warten nur noch auf eine bekannte Verweigerung; auf das Urteil der Liste wartet nur der Toast (`createDetailProblemGate`). Belegt über die Unit-Tabelle; ein e2e ist im In-Process-Betrieb nicht zuverlässig herzustellen.
- D (nit), in the doc comment of the e2e file (e2e/010b-lesepfade.spec.ts:95): "Patch nur gegen `vite` dev, nicht gegen einen Build; eigener Port je Worktree."
  - **Umgang:** angenommen, in `9eb3c76` wörtlich übernommen, mit einer Begründung.

### Codex auf 4f0d231

- P2-1, `capture/Page.tsx:85`: on a fresh /capture visit without `?speaker`, `speakerId` is null at first render, so the probe loads the whole corpus before `listSpeakers` sets `fallbackSpeaker`. Wait with the probe until the speaker lookup has settled without producing a speaker. The round-3 test clears the call log too late to catch this; test from the very first call.
  - **Umgang:** angenommen, behoben in `a3ae45d`: die Probe läuft erst, wenn die Wortmeldungs-Abfrage geantwortet hat und keine Wortmeldung ergab. Das e2e „Codex P2-1 (4f0d231)“ zeichnet vom ersten Aufruf an auf, rot/grün im Bericht.
- P2-2, `history/Page.tsx:243`: select a question, then switch to podium. The list is refused, but `getQuestionHistory` gets the masked 404 and raises a toast over `history-forbidden`. The same class as Codex (b) in answers: fix the class at its root — every place in the five features where a detail request runs next to a list or main request that can be refused, gated the same way, preferably through one small local pattern per feature. Test first: history with a question selected, switch to podium, then `expectNoErrorToast` plus `history-forbidden`.
  - **Umgang:** angenommen, als Klasse behoben in `8cbc85d`: `createDetailProblemGate` je Feature mit Detailabfrage (Beantwortung, Historie). Die Liste der geprüften Stellen in allen fünf Features steht im Bericht „Nacharbeit Runde 4“. e2e „Codex P2-2 (4f0d231)“, rot/grün im Bericht.

### Runde 5 — Nachprüfung auf 948a721: annehmen

- 1 (minor), `capture/Page.tsx:90-108`: `settled` does not check which key a status belongs to. With latency, the designed state flickers `[false,true]` on every version jump. Fix: `useAsync` returns the key its status belongs to, and `settled` requires the current key for all three reads (alternatively, freeze `needsProbe` while `speakers.status === 'loading'`). Add an e2e with the latency patch and a MutationObserver, following the "Runde 3 (4)" pattern. Qualify the P2-1 claim in the Bericht.
  - **Umgang:** angenommen, behoben in `bd9e250` (erste Variante): `useAsync` liefert `settled`, gebunden an den Schlüssel des Renders. `settled` in der Erfassung verlangt das für alle drei Abfragen. e2e „Runde 5 (1)“ mit Latenz-Patch und MutationObserver, rot/grün im Bericht „Nacharbeit Runde 5“. Die Aussage zu P2-1 im Bericht zu Runde 4 ist eingeschränkt.
- 2 (nit), `answers/lib.ts:237` and `history/lib.ts:175`: select A (error, toast), then B (ok), then A again: the second error stays silent. Make the tag unique per selection pass, and add a sixth case to both test tables.
  - **Umgang:** angenommen, behoben in `7f76dc9`: der Gate zählt Auswahl-Durchgänge (`select()`). In beiden Tabellen steht ein sechster Fall; roter Unit-Lauf gegen den Stand von 948a721 im Bericht.
- 3 (nit, optional): compare `actor.id` instead of object identity (OIDC).
  - **Umgang:** angenommen, in `e64af10`: der Vergleich läuft über `actor.id`.
- 4 (nit, optional): MutationObserver in the "Runde 4 (B)" test.
  - **Umgang:** angenommen, in `6631130`: der Test „Runde 4 (B)“ hat einen MutationObserver, der im selben Task wie der Wechsel scharf geschaltet wird.

### Codex auf 948a721

- P2-A, `answers/useBacklog.ts:167` and the same in HistoryPage: an unrestricted actor has an undelivered question open, then switches to observer. `listQuestions` succeeds with a scoped list, so `refused=false`; `getQuestion` and `getQuestionHistory` get the masked 404, raise a toast, and the previous actor's detail and `_actions` stay visible. Fix: a successful list that does not contain the selected id must clear the selection and swallow its detail failures — an extension of the `createDetailProblemGate` class, not a special case. e2e: admin selects an undelivered question, switches to observer; no toast, no detail, no `_actions` from before.
  - **Umgang:** angenommen, als Erweiterung der Klasse behoben in `7f76dc9`: `createDetailProblemGate` nimmt `omits(id)` einer vollständigen Liste an; `selectionHidden` blendet die Auswahl in Beantwortung und Historie aus. Zwei e2e „Codex P2-A (948a721)“, rot/grün im Bericht. Offen als Folgearbeit: eine Liste mit aktivem serverseitigem Filter, siehe Bericht.
- P2-B, `stage/Page.tsx:202`: if the actor changes while `getStage()` is still pending, the old promise can resolve before the version bump and install the previous actor's stage and `_actions`. Tie each request to the actor, or invalidate it synchronously on an actor change. Test with the latency patch.
  - **Umgang:** angenommen, behoben in `e64af10`: jede `getStage`-Antwort ist an `getActor().id` zur Zeit der Anfrage gebunden, und ein Akteurwechsel verwirft den Stand der vorigen Rolle. e2e „Codex P2-B (948a721)“ mit Latenz-Patch (zurückgehaltene Antwort, im selben Task wie der Wechsel freigegeben), rot/grün im Bericht.

### Codex auf `adec621` — Folgepunkte (Stoppregel, Entwicklungsplan Abschnitt 4)

Vierter Codex-Lauf in Folge ohne P0/P1; kein Befund mit Bezug zu Sicherheit, Recht oder Datenschutz (alle vier zeigen
eher zu wenig als zu viel). Nach der Codex-Stoppregel werden sie Folgepunkte; der Orchestrator entscheidet über den Merge.

Klasse (drei der vier): **ein Verweigerungszustand hängt nicht am Ladevorgang, der ihn erzeugt hat.** Nach einem
Rollenwechsel von einer verweigerten zu einer berechtigten Rolle bleibt „keine Leseberechtigung" stehen, wenn der erste
Abruf der neuen Rolle mit einem gewöhnlichen Fehler (Netz, 500) scheitert:
1. `answers/useBacklog.ts:195` — `listForbidden` bleibt gesetzt.
2. `history/Page.tsx:281` — `historyForbidden` (Zeitleiste) bleibt gesetzt.
3. `history/Page.tsx:324` — `streamForbidden` (Ereignisstrom) bleibt gesetzt.

Einzelpunkt:
4. `capture/Page.tsx:91` — nach einem Schlüsselwechsel kann `speakers.status` noch zum alten Schlüssel gehören;
   `needsProbe` sollte `speakers.settled` für den aktuellen Schlüssel abwarten (sonst ein unnötiger ungefilterter Abruf
   beim Wechsel von verweigert zu berechtigt).

Dazu aus Runde 5: Beantwortung mit aktivem Serverfilter und Rollenwechsel zeigt noch einen Fehler-Toast.

**Folgescheibe:** „Lesezustand je Ladevorgang" — Verweigerung und Fehler werden an den Ladevorgang (Schlüssel) gebunden,
einmal als Muster für alle fünf Ansichten, mit e2e je Ansicht (Latenz- und Fehler-Patch). Spec folgt vom Architekten.
