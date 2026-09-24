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

**Nachtrag des Architekten (nach dem Bau):** Der Bauer fand in derselben Zeile eine dritte Zählstelle, „Regelregister
zählt ehrlich (20, nicht 24)“. Entscheidung: sie wird ebenfalls 22 (dieselbe Zählung, sonst widerspricht die Zeile sich
selbst). Akzeptanzkriterium 1 gilt damit für drei Zählstellen.

## Nicht-Ziele

Keine andere Planzeile, keine Kalenderverschiebung, keine Änderung an der Allowlist oder am Vertrag.

## Files allowed

- `docs/produktplan-beta.md`
- `docs/slices/takt-011-plan-service-lane.md`

## Akzeptanzkriterium

1. `git diff` zeigt nur die vier Kopfzeilen, die vier Ziel-Sätze und die drei Zählstellen der Zeile 011 (siehe Nachtrag des Architekten).
2. Ausgabe von `node scripts/plan-graph.mjs` und `node scripts/plan-honesty.mjs` wörtlich im Bericht.
3. `pnpm gates` grün (Tail wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-011-plan-service` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-011“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

Bauer: Opus 5.5, 24.09.2026. Plan-Änderung als Commit `a501513`; `pnpm gates` lief auf `a501513` (sauberer Baum), Exit 0.

**Erledigt**

1. Lanes: Die Kopfzeilen von 025, 026, 028 und 040 tragen zusätzlich `service`. Das Ziel jeder dieser Scheiben endet mit
   dem Satz, dass sie die Routen ihrer Operationen aus Vertrag 0.3.0 im Dienst (`apps/api/src`) montiert und deren
   Einträge aus `packages/contract/allowlist.json` entfernt (Operationen dort über Feld `slice`). Die Zuordnung ist aus
   der Allowlist im Worktree von 023 abgelesen und nicht kopiert: 025 hat 14 Einträge, 026 hat 3, 028 hat 4, 040 hat 6.
2. Kalender: keine Verschiebung. plan-graph meldet keine Lane-Überschneidung am selben Tag.
3. Regelzählung Zeile 011: „20 IDs heute“ → „22 IDs heute“ und Testausgabe „22 Regel-IDs, 22 legalRef, 0 verified“.
   Die Kopfzeile „Stand am 23. September 2026“ ist unverändert. Nachtrag (Orchestrator, `f7affda`): dritte Zählstelle
   „(20, nicht 24)“ → „(22, nicht 24)“, gemäß Nachtrag des Architekten.
4. Plan-Ehrlichkeit grün.

**Ausgabe `node scripts/plan-graph.mjs` (wörtlich)**

```
plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
```

**Ausgabe `node scripts/plan-honesty.mjs` (wörtlich)**

```
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.
```

**`pnpm gates` auf `a501513`, Tail (Exit 0)**

```
packages/domain test:       Tests  72 passed (72)
apps/web test:       Tests  48 passed (48)
apps/api test:       Tests  49 passed (49)
vocabulary-check: ok
slice-scope: 2 changed file(s), all within "docs/slices/takt-011-plan-service-lane.md"'s "Files allowed" list (2 pattern(s)).
plan-graph: ok.
# tests 206
# pass 206
# fail 0
...
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.65s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit a501513, tree 32b789473989…
```

(Die Zeilen über „...“ sind wörtlich aus derselben Ausgabe herausgesucht; alles ab „...“ ist das echte Ende.)

**Offen**

- Die Gründe in den Allowlist-Einträgen verweisen noch auf eine „Planänderung des Orchestrators (takt-011)“, die noch
  kommt. Die Allowlist ist ein Nicht-Ziel und bleibt hier unverändert; berichtigt wird in 023 vor dessen Merge.

**Nachweis auf `f7affda`** (Lauf des Reviewers, Exit 0; danach nur dieser Doku-Commit):
```
packages/domain test:       Tests  72 passed (72)
apps/web test:       Tests  48 passed (48)
apps/api test:       Tests  49 passed (49)
vocabulary-check: ok
slice-scope: 2 changed file(s), all within "docs/slices/takt-011-plan-service-lane.md"'s "Files allowed" list (2 pattern(s)).
plan-graph: ok.
# pass 206
# fail 0
✓ built in 1.23s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit f7affda, tree 32b789473989…
```

## Review findings

**Runde 1 — Opus 5.5, frischer Kontext, auf `f7affda`:** annehmen. Umfang eingehalten, Operationszahlen je Scheibe
gegen die Allowlist von 023 (`8ef3ad2`) bestätigt (029, 033, 035 tragen `service` schon), „22“ nachgezählt (18 in
`transitions.ts`, R-PERM-01..03, R-IDEM-01), Kalender unverschoben, plan-graph und plan-honesty grün.

1. minor — Nachweis nur auf `a501513`: behoben, Lauf auf `f7affda` im Bericht.
2. minor — Bericht nach dem Nachtrag nicht nachgezogen: behoben (Erledigt 3, Offen).
3. minor — Akzeptanzkriterium 1 sagte „zwei Zählstellen“: behoben, jetzt „drei“.
4. Hinweis — Zeile 028 sagt schon vorher „der Allowlist-Eintrag entfällt“ (If-Match, 0.3.1), das kann mit dem neuen Satz
   verwechselt werden: nicht Teil dieses Diffs, Folgepunkt für den Architekten.
5. Hinweis — `reason`-Texte der Allowlist in 023 veralten mit diesem Merge: wird in 023 vor dessen Merge berichtigt.
