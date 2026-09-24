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

## Review findings

(vom Reviewer)
