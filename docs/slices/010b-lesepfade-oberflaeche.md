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

## Review findings

(vom Reviewer)

### Runde 3 — Nachprüfung Opus 5.5 auf 7f542b6: annehmen

1. minor, `apps/web/src/features/capture/Page.tsx:79-84`.
   - `contributionsProbe` makes a second, unfiltered `listContributions()` call on every `version`. It fetches the whole corpus and throws the data away.
   - On a 500 or network error it shows two toasts.
   - Fix: run the probe only while `speakerId === null`, for example the loader `speakerId === null ? api.listContributions() : Promise.resolve(NO_CONTRIBUTIONS)` with key `cp:${version}:${speakerId === null}`, and `forbidden = probe forbidden || contributions forbidden`. The alternative is a single unfiltered call that filters locally.
   - **Umgang:** UMGANG1
2. minor, `apps/web/src/features/answers/useBacklog.ts:161-223`.
   - After the split, `selectedHistory` and `selectedHistoryForbidden` keep the previous question's state when the selection changes. `lapsedApproval(question, history)` at `QuestionDetail.tsx:248` then computes with the wrong events, which can briefly show a false "Freigabe erloschen".
   - A 404 or 500 on both calls shows two toasts.
   - Fix: store the history together with its `questionId` and pass it on only when it matches `selected.id`, or reset it on a `selectedId` change. Show at most one toast.
   - **Umgang:** UMGANG2
3. minor, test gap in `e2e/010b-lesepfade.spec.ts:283-290`.
   - No test covers a stale event count after switching roles, or the reset of `streamLastSeq`.
   - Add an e2e: admin on the event stream, switch to observer, the count is gone; back to admin, the stream is filled again.
   - **Umgang:** UMGANG3
4. minor, `apps/web/src/features/stage/Page.tsx:483`.
   - `stageOnly && !forbidden` only applies once the 403 has arrived. While loading, the fullscreen overlay with counters flashes and then jumps, which violates design principle #8.
   - When switching roles, the old `stage` stays in `stageRef`.
   - Fix: defer the layout decision until the first `getStage` result is known, as the `stage-deciding` skeleton already does. Reset forbidden and stage on a `version` change. The `!forbidden` at `:500` is dead code; remove it.
   - **Umgang:** UMGANG4
5. minor, test gap in `e2e/010b-lesepfade.spec.ts:176-179`.
   - The space-bar check would not have failed before the fix.
   - Start as podium with a current question, switch to expert, press space, then check that the delivered count or the event count stays the same.
   - **Umgang:** UMGANG5
6. nit: the `role="status"` comments promise reliable announcements. A live region that is mounted together with its content is often not announced. Tone down the comments.
   - **Umgang:** UMGANG6
7. nit: in the Bericht, mark the fixes for nits 9 and 10 in `history/Page.tsx` as "ohne Test, nicht beobachtbar".
   - **Umgang:** UMGANG7

### Codex auf 7f542b6

(a) P2, `useBacklog.ts:202`: history from question A stays in place while B loads, so `lapsedApproval` can mix the two. This is the same as finding 2 of Runde 3; the same fix covers it.
   - **Umgang:** UMGANGA

(b) P2, `useBacklog.ts:187`:
   - Setup: a question is selected, then the actor switches to a role without question read access.
   - `listQuestions` correctly renders `answers-forbidden`.
   - The concurrent `getQuestion` call gets the API's masked 404, which carries no R-PERM-02/03, so it falls through to `problem(error)` and shows an error toast on top of the designed state.
   - Fix: once the main query is forbidden, ignore or cancel the detail request, or clear the selection.
   - Test first: e2e with admin, select a question, switch to a role without `question.read`, then check `expectNoErrorToast` and `answers-forbidden`. Include the red run.
   - **Umgang:** UMGANGB
