# 013 — Barrierefreiheit und Tastaturpfad als Tor

**Status:** spec
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

(vom Implementierer)

## Review findings

(vom Reviewer)
