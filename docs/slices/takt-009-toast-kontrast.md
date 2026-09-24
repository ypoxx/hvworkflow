# takt-009 — Kontrast der Regelzeile im Toast

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: components (nur `Toast.tsx`),
e2e (eigene Datei). Läuft parallel zu 010b; berührt keine Datei von 010b.
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5; Review Opus 5.5 (Perspektive Barrierefreiheit)
**Rule ids:** AGENTS.md Regeln 1, 2, 10, 12; docs/design-prinzipien.md D8 (Barrierefreiheit)
**Quellen-IDs:** Scheibe 010, Nachprüfung B Punkt 3 (bestätigt: `Toast.tsx:53`); vorbestehend seit Scheibe 001

## Ziel

1. **Kontrast:** Die Zeile „Regel R-…“ im Toast (`apps/web/src/components/Toast.tsx`, heute `text-ink-500` auf
   `bg-surface`, im hellen Thema #83807a auf #ffffff, rund 3,9:1) erreicht mindestens 4,5:1 in jedem Thema, das die
   Oberfläche hat (hell, dunkel, Kontrastmodus, soweit er den Toast betrifft). Vorhandenes Token, z. B. `text-ink-600`;
   kein neues Token.
2. **Nachweis mit axe:** Neue e2e-Datei `apps/web/e2e/takt-009-toast-kontrast.spec.ts`. Sie bringt einen Toast mit
   Regelzeile auf den Bildschirm und prüft ihn mit dem axe-Helfer aus 013 (`checkAxe`), ohne Ausnahme für den Toast.
   - Auslöser: eine echte, von Kern oder Dienst verweigerte Aktion in der Demo, die eine `ruleId` trägt und **nicht**
     von Leserechten abhängt (010b ersetzt den Toast bei verweigertem Lesen durch einen gestalteten Zustand). Der
     Bericht nennt den gewählten Auslöser und warum er stabil ist.
   - Kein Test-Haken im Produktionscode (kein `window.__…`, kein Export nur für Tests). Findet sich kein stabiler
     Auslöser über die Oberfläche, hört der Bauer auf und meldet das mit den geprüften Kandidaten.
3. **Roter Lauf zuerst:** Der Bericht zeigt den axe-Lauf der neuen Datei vor der Änderung an `Toast.tsx` (rot, mit
   `color-contrast` am Regeltext) und danach (grün), beide wörtlich.

## Nicht-Ziele

Keine Umgestaltung des Toasts, kein neues Token, keine Änderung am Toast-Speicher, an Kern, Vertrag oder Dienst,
keine Änderung an anderen e2e-Dateien.

## Files allowed

- `apps/web/src/components/Toast.tsx`
- `apps/web/e2e/takt-009-toast-kontrast.spec.ts`
- `docs/slices/takt-009-toast-kontrast.md`

## Akzeptanzkriterium

1. Roter und grüner axe-Lauf der neuen Datei wörtlich im Bericht; grün ohne serious oder critical.
2. Kontrastverhältnis je Thema aus den Token-Werten in `apps/web/src/styles/index.css` im Bericht, nachgerechnet.
3. Alle Playwright-Szenarien grün; `pnpm gates` grün (Tail wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-009-toast-kontrast` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-009“ und endet mit `[skip netlify]`. Nicht pushen.
- Playwright mit eigenem Port (`E2E_PORT=4381`), Chromium unter `/opt/pw-browsers`; danach
  `git checkout -- docs/evidence`, nichts unter `docs/evidence` committen.

## Bericht

(vom Bauer)

## Review findings

(vom Reviewer)
