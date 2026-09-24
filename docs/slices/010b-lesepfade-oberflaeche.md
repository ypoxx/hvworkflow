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

(vom Implementierer)

## Review findings

(vom Reviewer)
