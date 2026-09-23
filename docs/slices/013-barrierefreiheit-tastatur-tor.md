# 013 — Barrierefreiheit und Tastaturpfad als Tor

**Status:** review
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
- `docs/agentische-entwicklung-plan.md` (Abschnitt 5, nur Stand-Spalte der Barrierefreiheits-Zeile(n))
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
`apps/web/e2e/support/axe-exceptions.json`) läuft jetzt an 33 Ansichts-/Zustandswechseln
in allen fünf Alt-Szenarien (001 ×2 Tests, 002, 003, abnahme) sowie in 020 selbst — 0
serious/critical in jedem der 33 × 2 Durchläufe. Neue
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

`pnpm gates`-Ende (voller Lauf, grün):
```
apps/web typecheck: Done
...
apps/web lint: Done
packages/contract test: contract gate: ok
packages/contract test: Done
packages/domain test:  Test Files  4 passed (4)
packages/domain test:       Tests  39 passed (39)
packages/domain test: Done
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
apps/web test: Done
apps/api test:  Test Files  4 passed (4)
apps/api test:       Tests  32 passed (32)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary
> node scripts/vocabulary-check.mjs
vocabulary-check: ok

> hvworkflow@0.1.0 arch
x 7 dependency violations (0 errors, 7 warnings). 131 modules, 484 dependencies cruised.

> hvworkflow@0.1.0 role-literals
Role-literal check: no role-name literal outside the policy layer …

> hvworkflow@0.1.0 now-check
now() check: no direct system-clock access outside the injected clock …

> hvworkflow@0.1.0 plan-honesty
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> @hv/web@0.0.0 build
✓ 1714 modules transformed.
✓ built in 1.22s
```
(Die 7 depcruise-Warnungen und die openapi.yaml-„oidc"-Warnung sind vorbestehend,
unverändert von dieser Scheibe, kein Blocker — `pnpm gates` endet mit Exit-Code 0.)

Playwright, voller Lauf `apps/web`, `E2E_PORT=4351 pnpm exec playwright test --reporter=list`,
alle 15 Szenarien grün:
```
Running 15 tests using 2 workers

  ✓  001-shell.spec.ts:17   shell: counters, role switch, language switch @screenshot (9.1s)
  ✓  001-shell.spec.ts:82   header strip on the answers desk @screenshot (5.2s)
  ✓  002-speakers-capture.spec.ts:62   speakers list and capture desk @screenshot (18.9s)
  ✓  013-tastaturpfad.spec.ts:143  013a: Wortmeldung per Tastatur anlegen und mit Pfeiltasten umsortieren (4.5s)
  ✓  013-tastaturpfad.spec.ts:240  013b: Redebeitrag erfassen und mit der Tastatur in Einzelfragen zerlegen (3.7s)
  ✓  013-tastaturpfad.spec.ts:316  013c: Antwort entwerfen und mit der Tastatur weiterleiten (3.7s)
  ✓  013-tastaturpfad.spec.ts:353  013d: Freigeben mit der Tastatur (2.3s)
  ✓  013-tastaturpfad.spec.ts:368  013e: Auf der Bühne "Vorgelesen, weiter" mit der Tastatur (1.9s)
  ✓  013-tastaturpfad.spec.ts:431  013f: prefers-reduced-motion — Übergänge und Animationen sind abgeschaltet (1.7s)
  ✓  020-rueckbau-passung.spec.ts:111  020: Rückbau und Passung — points 1–9, axe on the five views (21.3s)
  ✓  020-rueckbau-passung.spec.ts:512  020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (5.3s)
  ✓  020-rueckbau-passung.spec.ts:555  020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.4s)
  ✓  020-rueckbau-passung.spec.ts:595  020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (4.7s)
  ✓  003-answers-stage.spec.ts:44   backlog, approval, podium and history @screenshot (1.0m)
  ✓  abnahme.spec.ts:87  @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (45.9s)

  15 passed (2.0m)
```

axe-Tabelle, jede der 33 Ansichten/Zustände, beide Durchläufe (a: alle Regeln außer
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

0 von 0 Verstößen „serious"/„critical" auf allen 33 Ansichten in beiden Durchläufen —
Akzeptanzkriterium 1 erfüllt. Die 19 AX-020-01-Ausnahmen (vorbestehender Farbtoken,
`apps/web/e2e/support/axe-exceptions.json`) bleiben unverändert bestehen, laufen ab
spätestens 31.12.2026, Rolle „Umsetzer" — siehe „Offen".

Roter Nachweis (Akzeptanzkriterium 2, lokal gefahren, **nicht committet**): in
`apps/web/src/components/Dialog.tsx` das `aria-label={t('common.close')}` am
Schließen-Knopf (Icon-only, kein sichtbarer Text) entfernt, dann
`E2E_PORT=4340 pnpm exec playwright test 002-speakers-capture.spec.ts --reporter=list`:
```
[axe] speakers (Wortmeldung registrieren, dialog open) (a, all rules except color-contrast, no exclusions): 1 violation group(s), 1 serious/critical
  - button-name [critical] https://dequeuniversity.com/rules/axe/4.13/button-name?application=playwright
    targets: .py-3.items-start.gap-3 > .px-0.bg-transparent.disabled\:pointer-events-none
  ✘  1 [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot (8.1s)

  1) [chromium] › e2e/002-speakers-capture.spec.ts:62:1 › speakers list and capture desk @screenshot

    Error: [
      {
        "id": "button-name",
        "impact": "critical",
        ...
        "html": "<button type=\"button\" class=\"inline-flex shrink-0...\">",
        ...
      }
    ]
    expect(received).toEqual(expected)
    - Array []
    + Array [ … "button-name" … ]
       at support/axe.ts:95
        at checkAxe (/home/user/wt/013/apps/web/e2e/support/axe.ts:95:63)
        at /home/user/wt/013/apps/web/e2e/002-speakers-capture.spec.ts:135:3

  1 failed
```
`aria-label` danach sofort wiederhergestellt (`git diff` auf `Dialog.tsx` leer, siehe
Commit `e535280` und den Stand davor) — die Änderung selbst wurde nie committet.

Zwei Screenshots (`docs/evidence/013-*.png`, sichtbarer Fokusring):
- `013-fokus-beantwortung.png` — Fokus auf „Weiterleiten" in der Beantwortung (Szene c,
  nach Tab von den Antwortfeldern), Ring in Akzentblau um den primären Knopf.
- `013-fokus-buehne.png` — Fokus auf „Vorgelesen, weiter" auf der Bühne (Szene e, vor dem
  Leertaste-Druck), Ring in Akzentblau um den primären Bühnenknopf.

Open:
- **Fund aus Ziel 2, nicht behoben (außerhalb der Dateiliste dieser Scheibe):**
  `disabled={busy}` (`apps/web/src/features/stage/Podium.tsx`/`Page.tsx`) blendet den
  gerade betätigten Knopf aus, sobald die Anfrage beginnt — ein deaktiviertes Element kann
  keinen Fokus halten (Browser-Grundregel) — und nichts holt den Fokus zurück, sobald der
  Knopf sich wieder aktiviert. `013-tastaturpfad.spec.ts` (Szene e) belegt das:
  `[013e] focus after "Vorgelesen, weiter": {"testId":null,...,"tag":"BODY",...}`. Dasselbe
  Muster (`disabled={busy}`) liegt auf jedem schreibenden Knopf im Produkt
  (`answer-submit-draft`, `answer-submit-review`, `answer-approve`, …) — eine echte,
  produktweite Tastaturfokus-Lücke, aber keine axe-Regel, die automatisierte Werkzeuge
  prüfen, und eine Behebung würde `apps/web/src/features/stage/**` (und vermutlich weitere
  Features) über die in Ziel 1 erlaubten „kleinen axe-Behebungen" hinaus verändern.
  Empfehlung: eigene, kleine Scheibe „Fokus nach Aktion" (Muster: Fokus vor dem Auslösen
  merken, nach Abschluss der Anfrage auf das nächste sinnvolle Element legen, z. B. den
  nächsten „Vorgelesen, weiter"-Knopf oder den Panel-Titel).
- **AX-020-01** (19 Selektoren, vorbestehender Farbtoken `--color-ink-400`/`-500`) bleibt
  bestehen wie in 020 registriert; läuft ab mit der Farbtoken-Scheibe, spätestens
  31.12.2026, Rolle „Umsetzer".
- Die „moderate" Landmark-Doppelung des `Dialog`-Bauteils, die 020 als offen führte
  (`landmark-no-duplicate-banner`/`landmark-unique`), ist mit dieser Scheibe behoben
  (`<header>`/`<footer>` → `<div>` in `Dialog.tsx`, Ziel 1: „mit wenigen Zeilen lösbar");
  kein axe-Fund mehr in keinem der 33 Ansichten.
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
- `docs/agentische-entwicklung-plan.md` (Abschnitt 5.3, nur Stand-Spalte „Barrierefreiheit")
- `docs/evidence/013-fokus-{beantwortung,buehne}.png` (neu)
- diese Datei (Abschnitt „Bericht", Status)

Commits: ba68ae3, 0a2efe1, e535280, e39bca1, ada3db2

## Review findings

(vom Reviewer)
