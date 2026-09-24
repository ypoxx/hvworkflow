# takt-011 — Plan: Service-Lane für 025, 026, 028, 040; Regelzählung nach 010 und 011

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-plan (nur
`docs/produktplan-beta.md`)
**Rolle:** Implementierer-Backend, Opus 5.5 (Entscheid des Eigentümers vom 24.09.2026; Plan-Graph und Plan-Ehrlichkeit müssen grün bleiben); Review in frischem Kontext,
Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 12; Produktplan 5.1 (Lanes, Dateibesitz)
**Quellen-IDs:** Review von 023, Befund 3 (major); Bericht von 011, „Offen“ (veraltete Zählungen)

## Festlegung des Architekten

023 hat 36 Operationen vorab in `packages/contract/allowlist.json` deklariert (Ablauf 2026-11-25). Ein Eintrag fällt nur
weg, wenn ein Test die Operation über den Dienst ausübt, und die Routen liegen in `apps/api/src` (Lane `service`). Die
Scheiben 025, 026, 028 und 040 besitzen diese Lane heute nicht. Ohne Änderung könnte keine von ihnen ihre Einträge
einlösen, und am 25.11. würde der Integrationsbranch für alle rot. **Entscheidung:** Diese vier Scheiben bekommen die
Lane `service` für genau die Routen ihrer Operationen, und ihr Ziel nennt das Einlösen ihrer Allowlist-Einträge.

## Ziel

1. **Lanes:** In `docs/produktplan-beta.md` Abschnitt 5 tragen die Kopfzeilen von 025, 026, 028 und 040 zusätzlich
   `service`. Das Ziel jeder dieser Scheiben bekommt einen Satz: sie montiert die Routen ihrer Operationen aus Vertrag
   0.3.0 im Dienst und entfernt deren Einträge aus `packages/contract/allowlist.json` (die Liste der Operationen je
   Scheibe steht in der Allowlist, Feld `slice`).
2. **Kalender:** `node scripts/plan-graph.mjs` bleibt ohne Befund (keine Lane-Überschneidung am selben Tag). Meldet es
   eine Überschneidung, verschiebt der Bauer nichts selbst, sondern hört auf und meldet sie.
3. **Regelzählung:** Die Zeile von 011 in Abschnitt 5.2 sagt noch „20 IDs heute“ und „Testausgabe „20 Regel-IDs, 20
   legalRef, 0 verified““. Nach 010 (R-PERM-02, R-PERM-03) sind es 22; entsprechend berichtigen. Die datierte
   Kopfzeile „Stand am 23. September 2026“ bleibt unverändert (sie beschreibt den Stand dieses Tages vor 010).
4. **Plan-Ehrlichkeit:** `node scripts/plan-honesty.mjs` bleibt grün.

## Nicht-Ziele

Keine andere Planzeile, keine Kalenderverschiebung, keine Änderung an der Allowlist oder am Vertrag.

## Files allowed

- `docs/produktplan-beta.md`
- `docs/slices/takt-011-plan-service-lane.md`

## Akzeptanzkriterium

1. `git diff` zeigt nur die vier Kopfzeilen, die vier Ziel-Sätze und die zwei Zählstellen der Zeile 011.
2. Ausgabe von `node scripts/plan-graph.mjs` und `node scripts/plan-honesty.mjs` wörtlich im Bericht.
3. `pnpm gates` grün (Tail wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-011-plan-service` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-011“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Bauer)

## Review findings

(vom Reviewer)
