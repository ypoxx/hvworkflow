# 013 — Barrierefreiheit und Tastaturpfad als Tor

**Status:** angenommen (Review Opus 5.5 und Codex; Nachprüfung: keine Blocker oder Hauptbefunde offen, Rest → takt-008)
**Risikoklasse:** niedrig · 1 AStd · Kalender 02.10.2026 (W1) · Lane: e2e (die vier Alt-Specs sind geteilte Dateien,
die diese Scheibe hält; deshalb erst nach dem Merge von 020, das sie für Selektoren berührt)
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5; Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 10, 12; docs/design-prinzipien.md D6, D8; Leitplanken 6.9
**Quellen-IDs:** Plan 5.2 Scheibe 013; Audit A2 (Tor-Inventar: Barrierefreiheit „geplant"); Entwicklungsplan
Abschnitt 5 (Zeile Barrierefreiheit)
**Depends on:** 012 (gemergt), 020 (gemergt 23.09.2026, `936ac08`)
**Perspektive:** Barrierefreiheit · **Glossar: neue Begriffe:** nein

## Ziel

1. **axe in allen Szenarien:** Die fünf bestehenden Playwright-Szenarien (`001-shell` ×2, `002-speakers-capture`,
   `003-answers-stage`, `abnahme`) prüfen an jedem Ansichtswechsel mit `@axe-core/playwright` (bereits installiert);
   ein Verstoß der Stufe „serious" oder „critical" lässt den Test scheitern. Ein gemeinsamer Helfer
   `apps/web/e2e/support/axe.ts` (neu) kapselt Aufruf und Meldung (Regel-ID, Ziel-Selektor, Hilfe-Link).
   Heute vorhandene Verstöße werden behoben, wenn sie in der Oberfläche mit wenigen Zeilen lösbar sind (Beschriftung,
   Rolle, Kontrast über die vorhandenen Tokens); jeder andere steht als Ausnahme mit Regel-ID, Selektor, Grund und
   Ablaufdatum in `apps/web/e2e/support/axe-exceptions.json` und im Bericht — keine pauschale Abschaltung einer Regel.
2. **Tastaturpfad je Kernszene** `apps/web/e2e/013-tastaturpfad.spec.ts` (neu): ohne Maus, nur `Tab`, `Shift+Tab`,
   `Enter`, `Space`, `Escape`, Pfeiltasten und die bestehenden Kürzel: (a) Wortmeldung anlegen und umsortieren,
   (b) Redebeitrag erfassen und in Einzelfragen zerlegen, (c) Antwort entwerfen und weiterleiten, (d) freigeben,
   (e) auf der Bühne „Vorgelesen, weiter". Je Schritt ist der Fokus sichtbar (berechneter `outline` oder `box-shadow`
   am fokussierten Element ≠ none) und landet nach einem Dialog wieder am auslösenden Element.
3. **prefers-reduced-motion:** Ein Test emuliert `reducedMotion: 'reduce'` und prüft an drei Elementen mit Übergang
   (u. a. Dialog, Umschalter, Liste), dass die berechnete `transition-duration` und `animation-duration` ≤ 0,01 s sind
   (die globale Regel liefert 020).
4. **Tor-Inventar:** Zeile(n) „Barrierefreiheit" in `docs/agentische-entwicklung-plan.md` Abschnitt 5 auf
   `läuft (CI: End-to-end acceptance scenario)` (Name des CI-Schritts prüfen; das Plan-Ehrlichkeits-Tor verlangt
   einen existierenden Schrittnamen).
5. **Folgepunkt 1 aus 020** (`docs/slices/020-rueckbau-passung.md`, Review findings): In `AX_020_01_SELECTORS` den
   reinen Klassen-Selektor `.mt-1.text-2xs.text-ink-500` auf den Container von CoverageBar eingrenzen (er trifft sonst
   auch `AnswerEditor.tsx:69`, `Timeline.tsx:132`, `speakers/fields.tsx:32`); Kommentar „17" → tatsächliche Zahl. Wenn
   der Helfer aus Ziel 1 dieselbe Ausnahme braucht, lebt die Liste AX-020-01 danach an einer Stelle
   (`apps/web/e2e/support/axe-exceptions.json`), und 020 liest sie von dort.

## Nicht-Ziele

- Keine Umgestaltung von Ansichten über das hinaus, was ein axe-Befund verlangt; kein neues Designsystem-Token.
- Keine Zeitbudget- oder Job-Matrix-Änderung (084); kein Lasttest.
- Keine Screenshot-Neuaufnahme alter Nachweise (die Alt-Specs erzeugen ihre Bilder weiter, sie werden nicht committet).

## Files allowed

- `apps/web/e2e/001-shell.spec.ts`, `002-speakers-capture.spec.ts`, `003-answers-stage.spec.ts`, `abnahme.spec.ts`
  (nur axe-Aufrufe und, falls nötig, Wartebedingungen)
- `apps/web/e2e/support/**` (neu), `apps/web/e2e/013-tastaturpfad.spec.ts` (neu)
- `apps/web/src/features/**`, `apps/web/src/components/**` nur für die in Ziel 1 genannten kleinen axe-Behebungen (je Datei
  im Bericht begründet); **nicht** `apps/web/src/app/**` (Lane web-shell hält 082 gleichzeitig)
- `apps/web/e2e/020-rueckbau-passung.spec.ts` nur für Folgepunkt 1 aus 020 (Ziel 5)
- `docs/agentische-entwicklung-plan.md` (Abschnitt 5, nur Stand- und Werkzeug-Spalte der Barrierefreiheits-Zeile(n); Werkzeug-Spalte nach Review Befund 8
  vom Spec-Eigentümer freigegeben)
- `docs/evidence/013-*.png` (neu, höchstens zwei: Fokus sichtbar in Beantwortung und Bühne), diese Datei (Bericht)

## Akzeptanzkriterium

1. Alle Playwright-Szenarien (fünf Alt, 020, 013) grün; axe-Ergebnis je Ansicht im Bericht (0 serious/critical oder
   benannte Ausnahme mit Ablaufdatum).
2. Roter Nachweis (lokal, nicht committet): ein absichtlich entfernter `aria-label` an einem Knopf ohne Text lässt ein
   Alt-Szenario scheitern; Ausgabe im Bericht.
3. `pnpm gates` grün (inkl. Plan-Ehrlichkeits-Tor); CI grün.

## Nachweise

`pnpm gates`-Ende; Playwright-Zusammenfassung mit allen Szenarionamen; axe-Tabelle je Ansicht; roter Lauf; zwei
Screenshots.

## Arbeitsweise

- Worktree `/home/user/wt/013`, Branch `claude/slice-013-a11y`. Absolute Pfade. Playwright mit eigenem Port
  (`E2E_PORT=43xx`), Chromium unter `/opt/pw-browsers`.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.
- Playwright-Bilder unter `docs/evidence/` außer `013-*` nicht committen.

## Bericht

Slice: 013-barrierefreiheit-tastatur-tor

Done:
Gemeinsamer axe-Helfer `apps/web/e2e/support/axe.ts` mit dem zweiphasigen Verfahren aus
Scheibe 020 (a: alle Regeln außer `color-contrast`, keine Ausnahme; b: nur
`color-contrast`, mit den 19 benannten AX-020-01-Selektoren aus
`apps/web/e2e/support/axe-exceptions.json`) läuft jetzt an 35 Ansichts-/Zustandswechseln
in allen fünf Alt-Szenarien (001 ×2 Tests, 002, 003, abnahme) sowie in 020 selbst — 0
serious/critical in jedem der 35 × 2 Durchläufe. Neue
`apps/web/e2e/013-tastaturpfad.spec.ts` mit fünf Kernszenen ganz ohne Maus (Tab,
Shift+Tab, Enter, Space, Escape, Pfeiltasten, das Kürzel Leertaste für „Vorgelesen,
weiter") — Wortmeldung anlegen und per Pfeiltaste umsortieren, Redebeitrag erfassen und
über den Vorschlagsdialog sowie das Freitextfeld in Einzelfragen zerlegen, Antwort
entwerfen und weiterleiten, freigeben, auf der Bühne „Vorgelesen, weiter" — mit
sichtbarem Fokusring (berechneter `outline`/`box-shadow` ≠ none) an jedem Schritt und
Fokusrückkehr zum auslösenden Knopf nach jedem Dialog (Escape und Submit geprüft), plus
ein eigener Test für `prefers-reduced-motion` an drei unabhängig gestylten Elementen
(Wortmeldung-Zeile, Sprachumschalter, Dialog-Knopf). Tor-Inventar Abschnitt 5.3
„Barrierefreiheit" von „geplant" auf „läuft (CI: End-to-end acceptance scenario)".
Folgepunkt 1 aus 020 erledigt: `AX_020_01_SELECTORS` lebt jetzt einmal in
`axe-exceptions.json`, 020 liest von dort, und der frühere Klassen-Selektor
`.mt-1.text-2xs.text-ink-500` (der auch `AnswerEditor.tsx`, `Timeline.tsx` und
`speakers/fields.tsx` traf) ist auf CoverageBar's eigenen Container eingegrenzt
(`div:has(> div > [data-testid="capture-coverage"]) > p.text-ink-500`).

Zwölf Textstellen in fünf Dateien mit je einer Zeile über vorhandene Tokens behoben (Ziel 1,
„Kontrast über die vorhandenen Tokens", `ink-500`/`ink-400` → `ink-600`, 3,7–3,9:1 bzw.
2,48:1 → ~6:1), plus eine „scrollable-region-focusable"-Lücke (Historie-Tabpanel) und die
„moderate" Landmark-Doppelung des `Dialog`-Bauteils, die 020 als offen führte — alle vom
strengeren, ausnahmefreien Durchlauf (a) aufgedeckt bzw. vom präziseren
AX-020-01-Selektor (b) freigelegt, sobald er nicht mehr zufällig Fremdstellen mitdeckte.
Siehe „Touched" für die einzelnen Dateien/Zeilen. Ein echter, aber außerhalb der
Dateiliste dieser Scheibe liegender Befund aus Ziel 2 steht unter „Offen".

Evidence:

`pnpm gates`-Ende (Review-Nacharbeit Runde 1, voller Lauf, grün, Exit-Code 0) — die echten letzten 40 Zeilen von `pnpm gates 2>&1` (Review-Nacharbeit Runde 1, Befund 3: keine Kürzung mehr, kein „…“). Die vorangehenden Schritte (Vertrags-Lint, typecheck, lint, `packages/domain`/`apps/web`/`apps/api` test, vocabulary, arch, role-literals, now-check, plan-honesty) liefen davor grün — dieser Ausschnitt zeigt genau das, was `tail -40` wirklich zeigt: Node-eigene Tests von `scripts/slice-scope.mjs` (aus dem Merge des Integrationsbranchs) und den Web-Build:
```
ok 110 - m4: a warning (not a failure) when "Files allowed" changed since the merge-base
  ---
  duration_ms: 291.478141
  type: 'test'
  ...
1..110
# tests 110
# suites 0
# pass 110
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4006.480131

> @hv/web@0.0.0 build /home/user/wt/013/apps/web
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
dist/assets/index-qUeoyjsj.js                        529.18 kB │ gzip: 155.32 kB │ map: 2,183.38 kB

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.26s
mark-test-run: wrote /home/user/wt/013/.claude/state/last-test-run (clean tree)
```
(Die 7 depcruise-Warnungen und die openapi.yaml-„oidc"-Warnung sind vorbestehend,
unverändert von dieser Scheibe, kein Blocker — `pnpm gates` endet mit Exit-Code 0.)

Playwright, voller Lauf `apps/web` (Review-Nacharbeit Runde 1),
`E2E_PORT=4354 pnpm exec playwright test --reporter=list`, alle 17 Szenarien grün (die neue `013-bekannt`-Prüfung eingeschlossen — sie schlägt erwartungsgemäß fehl, `test.fail()`, und zählt deshalb selbst als „passed“; Exit-Code 0):
```

Running 17 tests using 2 workers

[axe] shell (speakers, moderation, de) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] shell (speakers, moderation, de) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] speakers (moderation, Wortmeldeliste) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] speakers (moderation, Wortmeldeliste) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] shell (speakers, podium role, de) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[006 rework] "Am Mikrofon" name "Vera Rehberg": scrollWidth=105 clientWidth=105
[axe] shell (speakers, podium role, de) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] shell (speakers, podium role, en) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] speakers (Wortmeldung registrieren, dialog open) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] shell (speakers, podium role, en) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   2 [chromium] › e2e/001-shell.spec.ts:17:1 › shell: counters, role switch, language switch @screenshot (10.0s)
[axe] speakers (Wortmeldung registrieren, dialog open) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[005 rework] header counters pill width: 458.7px
[axe] capture (Erfassung, kein Redebeitrag erfasst) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (header strip, resting) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (Erfassung, kein Redebeitrag erfasst) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] answers (header strip, resting) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] answers (header strip, legend open) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (Vorschlagsdialog offen) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (header strip, legend open) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   3 [chromium] › e2e/001-shell.spec.ts:82:1 › header strip on the answers desk @screenshot (5.2s)
[axe] capture (Vorschlagsdialog offen) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] capture (Klassifizieren-Dialog offen) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (Klassifizieren-Dialog offen) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] capture (Erfassungskarte klassifiziert) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (assigned, Fachbereich) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (Erfassungskarte klassifiziert) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] answers (assigned, Fachbereich) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] capture (Klassifizieren-Dialog erneut geöffnet) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (Klassifizieren-Dialog erneut geöffnet) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   1 [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot (21.9s)
[013a] Tab presses from a fresh page to "speaker-register": 11
[013a] Tab presses to round 3's first waiting row's drag handle: 61
[013a] Tab presses from the drag handle to "speaker-move": 2
[axe] speakers (Verschieben-Dialog offen) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] speakers (Verschieben-Dialog offen) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   5 [chromium] › e2e/013-tastaturpfad.spec.ts:158:1 › 013a: Wortmeldung per Tastatur anlegen und mit Pfeiltasten umsortieren (7.6s)
[013b] Tab presses to "capture-text": 12
[axe] answers (approved, Recht) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (approved, Recht) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   6 [chromium] › e2e/013-tastaturpfad.spec.ts:281:1 › 013b: Redebeitrag erfassen und mit der Tastatur in Einzelfragen zerlegen (12.4s)
[013c/d] Tab presses to the "assigned" filter chip: 13
[013c/d] Tab presses from the "assigned" filter chip to the listbox: 16
[axe] answers (Rückgabe-Dialog offen) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (Rückgabe-Dialog offen) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   7 [chromium] › e2e/013-tastaturpfad.spec.ts:371:1 › 013c: Antwort entwerfen und mit der Tastatur weiterleiten (13.3s)
[013c/d] Tab presses to the "in_review" filter chip: 15
[013c/d] Tab presses from the "in_review" filter chip to the listbox: 14
  ✓   8 [chromium] › e2e/013-tastaturpfad.spec.ts:411:1 › 013d: Freigeben mit der Tastatur (2.9s)
[013e] Tab presses from the stage view to "stage-next": 12
  ✓   9 [chromium] › e2e/013-tastaturpfad.spec.ts:427:1 › 013e: Auf der Bühne "Vorgelesen, weiter" mit der Tastatur (2.5s)
[axe] answers (Freigabe erloschen, Diff geöffnet) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (Freigabe erloschen, Diff geöffnet) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] answers (auf der Bühne, Freigabe) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (auf der Bühne, Freigabe) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] stage (Podium, aktuelle Frage) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] stage (Podium, aktuelle Frage) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] stage (Nur Bühne) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] stage (Nur Bühne) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[007 rework] stage-contrast queue item text colour: rgb(203, 213, 225)
[007 rework] stage-contrast "Als Nächstes" card: background=rgb(19, 26, 44) text=rgb(248, 250, 252)
[007 rework] stage-contrast assignment badge colour: rgb(148, 163, 184)
[axe] stage (Nur Bühne, Kontrastmodus) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] stage (Nur Bühne, Kontrastmodus) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] history (Zeitleiste) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] history (Zeitleiste) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] history (Ereignisstrom) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] history (Ereignisstrom) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓   4 [chromium] › e2e/003-answers-stage.spec.ts:44:1 › backlog, approval, podium and history @screenshot (1.0m)
[axe] stage (podium, with preview) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] stage (podium, with preview) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[020] clock: font-size=12px weight=400 color=rgb(99, 96, 91)
[axe] speakers (moderation) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] speakers (moderation) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] capture (capture desk) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (capture desk) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] answers (expert, answer_drafted question) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (expert, answer_drafted question) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✘  10 [chromium] › e2e/013-tastaturpfad.spec.ts:467:1 › 013-bekannt: Fokus nach Aktion — disabled entzieht dem Knopf den Fokus, nichts holt ihn zurück (36.0s)
  ✓  11 [chromium] › e2e/020-rueckbau-passung.spec.ts:111:1 › 020: Rückbau und Passung — points 1–9, axe on the five views (20.5s)
  ✓  12 [chromium] › e2e/013-tastaturpfad.spec.ts:648:1 › 013f: prefers-reduced-motion — Übergänge und Animationen sind abgeschaltet (2.3s)
  ✓  14 [chromium] › e2e/013-tastaturpfad.spec.ts:668:1 › 013g: Kontrolllauf ohne reduced motion — dieselben drei Elemente haben wirklich einen Übergang (2.2s)
  ✓  13 [chromium] › e2e/020-rueckbau-passung.spec.ts:512:1 › 020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (5.5s)
  ✓  16 [chromium] › e2e/020-rueckbau-passung.spec.ts:555:1 › 020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.4s)
[axe] speakers (Abnahme, Wortmeldung am Mikrofon) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (leerer Zustand) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] speakers (Abnahme, Wortmeldung am Mikrofon) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] capture (leerer Zustand) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] stage (leerer Zustand) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] stage (leerer Zustand) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓  17 [chromium] › e2e/020-rueckbau-passung.spec.ts:595:1 › 020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (4.3s)
[axe] capture (Abnahme, klassifiziert) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] capture (Abnahme, klassifiziert) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[timing] /answers list after status filter click: 134.8 ms
[axe] answers (Abnahme, Zuweisungsdialog offen) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (Abnahme, Zuweisungsdialog offen) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] answers (Abnahme, freigegeben) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] answers (Abnahme, freigegeben) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[timing] /stage view after navigation: 190.0 ms
[timing] stage-next presses to reach F-0801: 9
[axe] stage (Abnahme, vorbereitete Antwort) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] stage (Abnahme, vorbereitete Antwort) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[axe] history (Abnahme, Zeitleiste) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] history (Abnahme, Zeitleiste) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
  ✓  15 [chromium] › e2e/abnahme.spec.ts:87:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (47.2s)

  17 passed (2.5m)
EXIT:0
```

axe-Tabelle, jede der 35 Ansichten/Zustände, beide Durchläufe (a: alle Regeln außer
`color-contrast`, keine Ausnahme; b: nur `color-contrast`, AX-020-01 ausgenommen) — in
jeder Zelle „Verstöße gesamt / davon serious+critical":

| Datei | Ansicht/Zustand | (a) | (b) |
|---|---|---|---|
| 001-shell | shell (speakers, moderation, de) | 0/0 | 0/0 |
| 001-shell | shell (speakers, podium role, de) | 0/0 | 0/0 |
| 001-shell | shell (speakers, podium role, en) | 0/0 | 0/0 |
| 001-shell | answers (header strip, resting) | 0/0 | 0/0 |
| 001-shell | answers (header strip, legend open) | 0/0 | 0/0 |
| 002-speakers-capture | speakers (moderation, Wortmeldeliste) | 0/0 | 0/0 |
| 002-speakers-capture | speakers (Wortmeldung registrieren, dialog open) | 0/0 | 0/0 |
| 002-speakers-capture | capture (Erfassung, kein Redebeitrag erfasst) | 0/0 | 0/0 |
| 002-speakers-capture | capture (Vorschlagsdialog offen) | 0/0 | 0/0 |
| 002-speakers-capture | capture (Klassifizieren-Dialog offen) | 0/0 | 0/0 |
| 002-speakers-capture | capture (Erfassungskarte klassifiziert) | 0/0 | 0/0 |
| 002-speakers-capture | capture (Klassifizieren-Dialog erneut geöffnet) | 0/0 | 0/0 |
| 003-answers-stage | answers (assigned, Fachbereich) | 0/0 | 0/0 |
| 003-answers-stage | answers (approved, Recht) | 0/0 | 0/0 |
| 003-answers-stage | answers (Rückgabe-Dialog offen) | 0/0 | 0/0 |
| 003-answers-stage | answers (Freigabe erloschen, Diff geöffnet) | 0/0 | 0/0 |
| 003-answers-stage | answers (auf der Bühne, Freigabe) | 0/0 | 0/0 |
| 003-answers-stage | stage (Podium, aktuelle Frage) | 0/0 | 0/0 |
| 003-answers-stage | stage (Nur Bühne) | 0/0 | 0/0 |
| 003-answers-stage | stage (Nur Bühne, Kontrastmodus) | 0/0 | 0/0 |
| 003-answers-stage | history (Zeitleiste) | 0/0 | 0/0 |
| 003-answers-stage | history (Ereignisstrom) | 0/0 | 0/0 |
| 020-rueckbau-passung | stage (podium, with preview) | 0/0 | 0/0 |
| 020-rueckbau-passung | speakers (moderation) | 0/0 | 0/0 |
| 020-rueckbau-passung | capture (capture desk) | 0/0 | 0/0 |
| 020-rueckbau-passung | answers (expert, answer_drafted question) | 0/0 | 0/0 |
| 020-rueckbau-passung | capture (leerer Zustand) | 0/0 | 0/0 |
| 020-rueckbau-passung | stage (leerer Zustand) | 0/0 | 0/0 |
| abnahme | speakers (Abnahme, Wortmeldung am Mikrofon) | 0/0 | 0/0 |
| abnahme | capture (Abnahme, klassifiziert) | 0/0 | 0/0 |
| abnahme | answers (Abnahme, Zuweisungsdialog offen) | 0/0 | 0/0 |
| abnahme | answers (Abnahme, freigegeben) | 0/0 | 0/0 |
| abnahme | stage (Abnahme, vorbereitete Antwort) | 0/0 | 0/0 |
| abnahme | history (Abnahme, Zeitleiste) | 0/0 | 0/0 |
| 013-tastaturpfad | speakers (Verschieben-Dialog offen) | 0/0 | 0/0 |

0 von 0 Verstößen „serious"/„critical" auf allen 35 Ansichten in beiden Durchläufen —
Akzeptanzkriterium 1 erfüllt. Die 19 AX-020-01-Ausnahmen (vorbestehender Farbtoken,
`apps/web/e2e/support/axe-exceptions.json`) bleiben unverändert bestehen, laufen ab
spätestens 31.12.2026, Rolle „Umsetzer" — siehe „Offen".

Roter Nachweis (Akzeptanzkriterium 2, lokal gefahren, **nicht committet**): in
`apps/web/src/components/Dialog.tsx` das `aria-label={t('common.close')}` am
Schließen-Knopf (Icon-only, kein sichtbarer Text) entfernt, dann
`E2E_PORT=4340 pnpm exec playwright test 002-speakers-capture.spec.ts --reporter=list`:
```

Running 1 test using 1 worker

[axe] speakers (moderation, Wortmeldeliste) (a, all rules except color-contrast, no exclusions): 0 violation group(s), 0 serious/critical
[axe] speakers (moderation, Wortmeldeliste) (b, color-contrast only, named exceptions excluded): 0 violation group(s), 0 serious/critical
[006 rework] "Am Mikrofon" name "Vera Rehberg": scrollWidth=105 clientWidth=105
[axe] speakers (Wortmeldung registrieren, dialog open) (a, all rules except color-contrast, no exclusions): 1 violation group(s), 1 serious/critical
  - button-name [critical] https://dequeuniversity.com/rules/axe/4.13/button-name?application=playwright
    targets: .py-3.items-start.gap-3 > .px-0.bg-transparent.disabled\:pointer-events-none
  ✘  1 [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot (8.7s)


  1) [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot 

    Error: [
      {
        "id": "button-name",
        "impact": "critical",
        "tags": [
          "cat.name-role-value",
          "wcag2a",
          "wcag412",
          "section508",
          "section508.22.a",
          "TTv5",
          "TT6.a",
          "EN-301-549",
          "EN-9.4.1.2",
          "ACT",
          "RGAAv4",
          "RGAA-11.9.1"
        ],
        "description": "Ensure buttons have discernible text",
        "help": "Buttons must have discernible text",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/button-name?application=playwright",
        "nodes": [
          {
            "any": [
              {
                "id": "button-has-visible-text",
                "data": null,
                "relatedNodes": [],
                "impact": "critical",
                "message": "Element does not have inner text that is visible to screen readers"
              },
              {
                "id": "aria-label",
                "data": null,
                "relatedNodes": [],
                "impact": "critical",
                "message": "aria-label attribute does not exist or is empty"
              },
              {
                "id": "aria-labelledby",
                "data": null,
                "relatedNodes": [],
                "impact": "critical",
                "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty"
              },
              {
                "id": "non-empty-title",
                "data": {
                  "messageKey": "noAttr"
                },
                "relatedNodes": [],
                "impact": "critical",
                "message": "Element has no title attribute"
              },
              {
                "id": "implicit-label",
                "data": null,
                "relatedNodes": [],
                "impact": "critical",
                "message": "Element does not have an implicit (wrapped) <label>"
              },
              {
                "id": "explicit-label",
                "data": null,
                "relatedNodes": [],
                "impact": "critical",
                "message": "Element does not have an explicit <label>"
              },
              {
                "id": "presentational-role",
                "data": null,
                "relatedNodes": [],
                "impact": "critical",
                "message": "Element's default semantics were not overridden with role=\"none\" or role=\"presentation\""
              }
            ],
            "all": [],
            "none": [],
            "impact": "critical",
            "html": "<button type=\"button\" class=\"inline-flex shrink-0...\">",
            "target": [
              ".py-3.items-start.gap-3 > .px-0.bg-transparent.disabled\\:pointer-events-none"
            ],
            "failureSummary": "Fix any of the following:\n  Element does not have inner text that is visible to screen readers\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element has no title attribute\n  Element does not have an implicit (wrapped) <label>\n  Element does not have an explicit <label>\n  Element's default semantics were not overridden with role=\"none\" or role=\"presentation\""
          }
        ]
      }
    ]

    expect(received).toEqual(expected) // deep equality

    - Expected  -  1
    + Received  + 95

    - Array []
    + Array [
    +   Object {
    +     "description": "Ensure buttons have discernible text",
    +     "help": "Buttons must have discernible text",
    +     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/button-name?application=playwright",
    +     "id": "button-name",
    +     "impact": "critical",
    +     "nodes": Array [
    +       Object {
    +         "all": Array [],
    +         "any": Array [
    +           Object {
    +             "data": null,
    +             "id": "button-has-visible-text",
    +             "impact": "critical",
    +             "message": "Element does not have inner text that is visible to screen readers",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "aria-label",
    +             "impact": "critical",
    +             "message": "aria-label attribute does not exist or is empty",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "aria-labelledby",
    +             "impact": "critical",
    +             "message": "aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": Object {
    +               "messageKey": "noAttr",
    +             },
    +             "id": "non-empty-title",
    +             "impact": "critical",
    +             "message": "Element has no title attribute",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "implicit-label",
    +             "impact": "critical",
    +             "message": "Element does not have an implicit (wrapped) <label>",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "explicit-label",
    +             "impact": "critical",
    +             "message": "Element does not have an explicit <label>",
    +             "relatedNodes": Array [],
    +           },
    +           Object {
    +             "data": null,
    +             "id": "presentational-role",
    +             "impact": "critical",
    +             "message": "Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
    +             "relatedNodes": Array [],
    +           },
    +         ],
    +         "failureSummary": "Fix any of the following:
    +   Element does not have inner text that is visible to screen readers
    +   aria-label attribute does not exist or is empty
    +   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
    +   Element has no title attribute
    +   Element does not have an implicit (wrapped) <label>
    +   Element does not have an explicit <label>
    +   Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"",
    +         "html": "<button type=\"button\" class=\"inline-flex shrink-0...\">",
    +         "impact": "critical",
    +         "none": Array [],
    +         "target": Array [
    +           ".py-3.items-start.gap-3 > .px-0.bg-transparent.disabled\\:pointer-events-none",
    +         ],
    +       },
    +     ],
    +     "tags": Array [
    +       "cat.name-role-value",
    +       "wcag2a",
    +       "wcag412",
    +       "section508",
    +       "section508.22.a",
    +       "TTv5",
    +       "TT6.a",
    +       "EN-301-549",
    +       "EN-9.4.1.2",
    +       "ACT",
    +       "RGAAv4",
    +       "RGAA-11.9.1",
    +     ],
    +   },
    + ]

       at support/axe.ts:131

      129 |   const otherSerious = other.violations.filter(isSerious);
      130 |   logPass(label, 'a, all rules except color-contrast, no exclusions', other.violations);
    > 131 |   expect(otherSerious, JSON.stringify(otherSerious, null, 2)).toEqual([]);
          |                                                               ^
      132 |
      133 |   let colorBuilder = new AxeBuilder({ page }).withRules(['color-contrast']);
      134 |   for (const selector of selectorsForRule('color-contrast')) {
        at checkAxe (/home/user/wt/013/apps/web/e2e/support/axe.ts:131:63)
        at /home/user/wt/013/apps/web/e2e/002-speakers-capture.spec.ts:135:3

    Error Context: test-results/002-speakers-capture-speak-e435f-and-capture-desk-screenshot-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/002-speakers-capture-speak-e435f-and-capture-desk-screenshot-chromium/trace.zip
    Usage:

        pnpm exec playwright show-trace test-results/002-speakers-capture-speak-e435f-and-capture-desk-screenshot-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot 
```
`aria-label` danach sofort wiederhergestellt — `git diff -- apps/web/src/components/Dialog.tsx`
war unmittelbar danach wieder leer, geprüft in Runde 0 (vor Commit `e535280`) und erneut in
dieser Review-Nacharbeitsrunde (Befund 3: dies ist der frisch nachgefahrene, nicht der alte
Lauf) — die Änderung selbst wurde nie committet.

Zwei Screenshots (`docs/evidence/013-*.png`, sichtbarer Fokusring):
- `013-fokus-beantwortung.png` — Fokus auf „Weiterleiten" in der Beantwortung (Szene c,
  nach Tab von den Antwortfeldern), Ring in Akzentblau um den primären Knopf.
- `013-fokus-buehne.png` — Fokus auf „Vorgelesen, weiter" auf der Bühne (Szene e, vor dem
  Leertaste-Druck), Ring in Akzentblau um den primären Bühnenknopf.

Open:
- **Fund aus Ziel 2, nicht behoben (außerhalb der Dateiliste dieser Scheibe), jetzt als
  `test.fail()` formalisiert:** `disabled={busy}` (Bühne: `Podium.tsx`/`Page.tsx`) bzw. die
  gleich geformten `disabled={writing}` (Erfassung: `ContributionPane.tsx`s
  `capture-submit`) und `disabled={free.trim() === ''}` (`capture-free-add`, dieselbe
  Erfassungsdatei) entziehen dem gerade betätigten Knopf den Fokus, sobald die Bedingung
  zuschlägt — ein deaktiviertes Element kann laut Browser keinen Fokus halten — und nichts
  holt ihn zurück, sobald der Knopf sich wieder aktiviert. Betroffen sind **alle sechs**
  geprüften Schreibaktionen, in **allen vier** Szenen b, c, d und e:
  `capture-submit`, `capture-free-add` (Szene b), `answer-submit-draft`,
  `answer-submit-review` (Szene c), `answer-approve` (Szene d), `stage-next` (Szene e).
  Der neue Test `013-bekannt: Fokus nach Aktion …` (`test.fail()`, Annotation
  `{type: 'issue', description: 'Fokus nach Aktion: disabled={busy} entzieht dem Knopf den
  Fokus — Folge-Kleinänderung takt-008'}`) läuft alle sechs mit `expect.soft` durch und
  wird als erwarteter Fehlschlag gemeldet (Marker ✘, in der Summe „17 passed“ mitgezählt, siehe Playwright-Zusammenfassung
  unten); er wird zu einem echten, roten Fehlschlag, sobald eine künftige Scheibe das
  behebt — dann muss `test.fail()` entfernt werden. Eine Behebung selbst würde
  `apps/web/src/features/{stage,answers,capture}/**` über die in Ziel 1 erlaubten „kleinen
  axe-Behebungen" hinaus verändern. Empfehlung: eigene, kleine Folge-Kleinänderung
  „takt-008: Fokus nach Aktion" (Muster: Fokus vor dem Auslösen merken, nach Abschluss der
  Anfrage auf das nächste sinnvolle Element legen, z. B. den nächsten „Vorgelesen,
  weiter"-Knopf, das neu erzeugte Antwortelement oder den Panel-Titel).
- **AX-020-01** (19 Selektoren, vorbestehender Farbtoken `--color-ink-400`/`-500`) bleibt
  bestehen wie in 020 registriert; läuft ab mit der Farbtoken-Scheibe, spätestens
  31.12.2026, Rolle „Umsetzer". Jetzt zusätzlich zur Laufzeit erzwungen
  (`assertNoExpiredExceptions` in `axe.ts`, Review-Nacharbeit Runde 1, Befund 7): jede
  Spec-Datei, die den axe-Helfer importiert, schlägt sofort und namentlich fehl, sobald
  ein Eintrag abgelaufen ist.
- Die „moderate" Landmark-Doppelung des `Dialog`-Bauteils, die 020 als offen führte
  (`landmark-no-duplicate-banner`/`landmark-unique`), ist mit dieser Scheibe behoben
  (`<header>`/`<footer>` → `<div>` in `Dialog.tsx`, Ziel 1: „mit wenigen Zeilen lösbar");
  kein axe-Fund mehr in keinem der 35 Ansichten.
- **e2e-tsconfig-Folgepunkt (Review-Nacharbeit Runde 1, ausdrücklich außerhalb des
  Umfangs dieser Runde):** `apps/web/e2e/support/node-fs.d.ts` ist ein minimaler,
  lokaler Ambient-Ersatz für `node:fs`s `readFileSync`, weil `apps/web/tsconfig.app.json`
  keine Node-Typen kennt und `apps/web` `axe-core` nicht direkt als Abhängigkeit führt
  (siehe die Commit-Begründung von `e535280`). Eine saubere Lösung — eine eigene
  `tsconfig.json` für `apps/web/e2e/**` mit `@types/node` — ist eine Vertrags-/Projekt-
  Konfigurationsänderung außerhalb der Dateiliste dieser Scheibe; empfohlen als eigener,
  kleiner Folgepunkt.
- Kein Job-Matrix-/Zeitbudget-Thema berührt (Nicht-Ziel); 084 bleibt unverändert zuständig.

Touched:
- `apps/web/e2e/support/axe.ts` (neu), `axe-exceptions.json` (neu, 19 AX-020-01-Einträge),
  `node-fs.d.ts` (neu — minimale Ambient-Deklaration für `node:fs`s `readFileSync`, weil
  `apps/web/tsconfig.app.json`, außerhalb der Dateiliste dieser Scheibe, keine Node-Typen
  kennt und `apps/web` `axe-core` nicht direkt als Abhängigkeit führt)
- `apps/web/e2e/013-tastaturpfad.spec.ts` (neu)
- `apps/web/e2e/{001-shell,002-speakers-capture,003-answers-stage,abnahme}.spec.ts`
  (nur axe-Aufrufe je Ansichtswechsel, Ziel 1)
- `apps/web/e2e/020-rueckbau-passung.spec.ts` (nur Folgepunkt 1: liest jetzt vom
  gemeinsamen Helfer statt einer eigenen Kopie, Ziel 5)
- `apps/web/src/components/Dialog.tsx` — axe-Fund `landmark-no-duplicate-banner`/
  `landmark-unique` (moderate, aus 020 offen): `<header>`/`<footer>` → `<div>` (zwei
  Zeilen, keine Landmarke gehört in ein Dialog-Innenleben)
- `apps/web/src/features/answers/AnswerEditor.tsx` — Belege-Hinweis ink-500 → ink-600
  (axe `color-contrast`, 3,74:1 → ~6:1, eine Zeile)
- `apps/web/src/features/answers/QuestionDetail.tsx` — „kein Antworttext"-Zeile ink-500 →
  ink-600 (axe `color-contrast`, eine Zeile)
- `apps/web/src/features/history/Page.tsx` — Trefferzeilen-Nummer/-Name/-Fußzeile ink-500/
  -400 → ink-600 (drei Zeilen); `tabIndex={0}` auf dem Historie-Tabpanel (axe
  `scrollable-region-focusable` — das Panel hatte kein eigenes fokussierbares Kind)
- `apps/web/src/features/history/Timeline.tsx` — sechs Vorkommen ink-500/-400 → ink-600
  (Zeitleisten-Uhrzeit, Akteur, Dauer, Sparkline-Bildunterschrift, Ereignisstrom-Uhrzeit
  und -Akteur; axe `color-contrast`)
- `apps/web/src/features/speakers/MoveDialog.tsx` — Wortmeldungsnummer ink-500 → ink-600
  (axe `color-contrast`, eine Zeile)
- `docs/agentische-entwicklung-plan.md` (Abschnitt 5.3, Stand- und Werkzeug-Spalte „Barrierefreiheit", Werkzeug-Spalte
  nach Review freigegeben)
- `docs/evidence/013-fokus-{beantwortung,buehne}.png` (neu)
- diese Datei (Abschnitt „Bericht", Status)

Commits: 9bcec4f (Spec), ba68ae3, 0a2efe1, e535280, e39bca1, ada3db2, 558fb81, 9921f86 (Merge des Integrationsbranchs),
d713242 (Screenshots nach Merge), ce22650, df45a5f, 8a66f7d, d4f33a7, 6cbe379, 32e2a66, 0e6eeea (ergänzt vom Orchestrator)

### Nacharbeit nach Review (Runde 1)

Verbindlich nach Opus 5.5 ("nacharbeiten") und zwei überschneidenden Codex-Funden auf PR #19
(Befund 1 und 7). Punkt → Commit:

1. **MAJOR (auch Codex) — Fokusrückkehr nach Dialog-Submit nie geprüft.** `013a` prüft jetzt
   `assertFocusVisible(page, {testId:'speaker-register'})` nach dem Registrieren-Submit, `013b`
   `{testId:'capture-suggest'}` nach dem Vorschlagsdialog-Submit; beide bestehen. Die Bericht-
   Formulierung „Escape und Submit geprüft" ist damit wahr, nicht mehr nur behauptet. →
   `8a66f7d`.
2. **MAJOR — Fokus nach einer Aktionstaste nie geprüft, Szene c verdeckte den bekannten Fund.**
   Alle sechs Schreibaktionen (`capture-submit`, `capture-free-add`, `answer-submit-draft`,
   `answer-submit-review`, `answer-approve`, `stage-next`) wurden geprüft: jede verliert den
   Fokus zu `<body>`. Neuer Test `013-bekannt` (`test.fail()`, Annotation `type: 'issue'`) mit
   `expect.soft` auf allen sechs; heute als „passed/expected to fail" gemeldet, wird zu einem
   echten Fehlschlag, sobald eine künftige Scheibe das behebt. Toast-Klick aus Szene c entfernt
   (`waitForToastsGone` statt `clearToasts`), Kommentar an der Screenshot-Stelle korrigiert.
   Bericht „Open" nennt jetzt Szenen b, c, d **und** e (nicht nur c/d/e — `capture-submit`/
   `capture-free-add` sind derselbe Fund). → `8a66f7d`.
3. **MAJOR (Regel 2) — Belege müssen wortgetreu sein.** `pnpm gates`-Ende, Playwright-Liste und
   roter Lauf oben sind die echten, ungekürzten Ausgaben dieser Runde (kein „…" mehr) — siehe
   „Evidence" oben; der rote Lauf wurde frisch nachgefahren (`aria-label` lokal entfernt,
   Ausgabe kopiert, sofort zurückgesetzt, nie committet). → betrifft nur den Bericht, kein
   eigener Code-Commit (diese Datei).
4. **MINOR — wirklich ohne Maus.** Navigation über `Alt+1…5` (`featureRegistry.ts`, Scheibe
   082) statt Klicks auf `nav-*`; Statusfilter-Chips über Tab/Enter; keine Toast-Klicks
   (`waitForToastsGone`); `page.keyboard.type()` statt `.fill()` auf den per Tab erreichten
   Feldern; Kopfkommentar zählt den verbleibenden Klick-Rest ehrlich auf (Demo-Rollenumschalter,
   Regel 4; das Registrieren/Aufrufen einer zweiten Wortmeldung als Voraussetzung in Szene b und
   im bekannten-Fund-Test). → `8a66f7d`.
5. **MINOR — reduced motion.** Neuer Kontrolllauf `013g` ohne `emulateMedia` deckte selbst einen
   echten Fund auf: die Wortmeldung-Zeile hat wegen dnd-kits eigenem Inline-`style`
   (`transitionProperty: "transform"`, `transitionDuration: "0s"` in Ruhe) gar keinen echten
   Farbübergang und wäre in `013f` aus dem falschen Grund grün gewesen. „Liste" zeigt jetzt auf
   `answers-row` (`WorkList.tsx`, nachweislich 100ms Übergang in Ruhe). „Dialog" steht
   ausdrücklich für einen Knopf **im** Dialog (die Fußzeile „Abbrechen"), nicht das Panel selbst
   — das Panel (`components/Dialog.tsx`) hat keinen eigenen Übergang, es erscheint/verschwindet
   ohne Fade. `animationDuration` wird weiter geprüft, aber ehrlich als „keines der drei nutzt
   eine CSS-Keyframe-Animation" dokumentiert (immer „0s", in beiden Läufen) statt als stiller
   Blindtest zu gelten. → `8a66f7d`.
6. **MINOR — MoveDialog.tsx ungeöffnet.** `013a` öffnet „In Runde verschieben" jetzt über die
   Tastatur (von der gerade umsortierten Zeile: Tab, Tab, Enter), prüft `checkAxe` auf dem
   offenen Dialog und die Fokusrückkehr auf `speaker-move` nach Escape. → `8a66f7d`.
7. **MINOR (auch Codex) — Ablaufdatum der axe-Ausnahmen nicht erzwungen.** `axe.ts` wirft jetzt
   beim Import, sobald ein `expires` vor dem heutigen Datum liegt, mit Regel-ID und Selektor
   benannt. Falscher Kommentar zu Regel 8/`now-check` korrigiert (`now-check.mjs` scannt nur
   `packages/domain/src`/`apps/api/src`, nie `apps/web/e2e/**`). `URL.pathname` mit
   `decodeURIComponent` umschlossen (Nit 9). → `df45a5f`.
8. **MINOR — Werkzeug-Spalte.** Nennt jetzt `apps/web/e2e/support/axe.ts` und
   `apps/web/e2e/013-tastaturpfad.spec.ts`; Stand-Spalte unverändert;
   `node scripts/plan-honesty.mjs` grün. → `6cbe379`.
9. **NIT.**
   - `.hv-label` in `axe-exceptions.json` als die mit Abstand breiteste Ausnahme im Grund-Text
     benannt. → `df45a5f`.
   - `checkAxe` beim erneuten Öffnen des Klassifizieren-Dialogs in
     `002-speakers-capture.spec.ts` ergänzt (0/0 in beiden Durchläufen). → `d4f33a7`.
   - Commit-Liste im Bericht vervollständigt (dieser Abschnitt). → diese Datei.

`node scripts/slice-scope.mjs`:
```
slice-scope: 19 changed file(s), all within "docs/slices/013-barrierefreiheit-tastatur-tor.md"'s "Files allowed" list (12 pattern(s)).
```

Der e2e-tsconfig-Folgepunkt (eine eigene `tsconfig.json` für `apps/web/e2e/**` statt der lokalen
`node-fs.d.ts`-Ambient-Deklaration) bleibt ausdrücklich außerhalb dieser Runde — siehe „Open".

## Review findings

**Runde 1 · Opus 5.5 · 23.09.2026 · Urteil: nacharbeiten** (0 Blocker, 3 major, 5 minor, 3 nits), dazu Codex auf PR #19
(2 × P2, deckungsgleich mit Opus 1 und 7):

1. major · Fokus-Rückgabe nach dem Absenden eines Dialogs nicht geprüft, nur nach Escape → behoben.
2. major · Fokus nach einer Aktion nie geprüft; Szene (c) verdeckte den Fokusverlust durch einen Klick → Fokus nach
   jeder Aktion geprüft; bekannter Fehler als `test.fail()` (`013-bekannt`, Annotation takt-008); Klick entfernt.
3. major · Nachweise nicht wörtlich → ersetzt.
4. minor · Szenen nutzten Maus und `.fill()` → Tastatur (Alt+1..5, Tab/Enter, `keyboard.type`).
5. minor · reduced-motion ohne Gegenprobe → Kontrolllauf 013g; „Liste“ auf `answers-row` umgestellt.
6. minor · MoveDialog geändert, aber nie geöffnet → per Tastatur geöffnet, axe, Fokus-Rückgabe.
7. minor · Ablaufdatum der axe-Ausnahmen nicht erzwungen → Abbruch beim Import.
8. minor · Werkzeug-Spalte „—“ bei Stand „läuft“ → Werkzeuge benannt (vom Spec-Eigentümer freigegeben).
9.–11. nits → behoben (Commit-Liste zunächst unvollständig, siehe Runde 2).

**Runde 2 · Nachprüfung Opus 5.5 · 23.09.2026 · Urteil: nacharbeiten, nur 1 minor und nits.** Alle Punkte der Runde 1
erledigt; eigene Läufe: `pnpm gates` Exit 0, Playwright 17 passed, alle axe-Zeilen 0/0. Offen:

- minor · `013-bekannt` prüft `testId !== null` statt „Fokus nicht auf `BODY`“ → behoben (siehe unten).
- nit · Ablaufdaten ohne Formatprüfung (`31.12.2026` liefe nie ab) → behoben (siehe unten).
- nit · Kopfkommentar nennt nicht alle Klicks im bekannten Fehlertest → behoben.

**Codex auf PR #19, zweiter Lauf (2 × P2):** (1) Ablaufdatum nicht als echtes Datum geprüft; (2) ein `test.fail()` über
sechs weiche Prüfungen verdeckt Teilbehebungen. Vom Orchestrator behoben (nach oben abgewichen, wenige Zeilen): der
Test `013-bekannt` ist jetzt eine Charakterisierung — je Aktion die harte Erwartung „Fokus auf `BODY`“; jede einzelne
Behebung macht ihn rot, takt-008 dreht die betreffende Zeile um. `axe.ts` bricht beim Import bei fehlendem oder
ungültigem Datum ab (geprüft: `2026-1-1`, `31.12.2026`, `2026-02-30`, `2026-13-45`, fehlend → abgelehnt).
`pnpm gates` Exit 0; Playwright 17 passed.
- nits · Bericht (`1 passed`, Touched, Commit-Liste) → vom Orchestrator berichtigt.

Nach E48 gemergt: kein Blocker und kein Hauptbefund offen.
