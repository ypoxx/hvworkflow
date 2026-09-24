# Slices

One file per slice of work. A slice is at most one agent-day. The file is the spec (R1), carries
the review findings (R3) and the acceptance mark (step 7 of the cycle). Template:

```
# NNN — Name

**Status:** spec | in progress | review | rework | accepted
**Risikoklasse:** niedrig/mittel/hoch · AStd · Kalenderdatum (Woche NN) · Lane: …
**Rolle:** [role]; Review in frischem Kontext [Perspektive] (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** …
**Quellen-IDs:** Plan section NNN; Audit code; Register entry
**Depends on:** NNN (gemergt)
**Perspektive:** … · **Glossar: neue Begriffe:** ja/nein

## Ziel
## Nicht-Ziele
## Files allowed
## Akzeptanzkriterium
## Nachweise
## Bericht
## Review findings
```

Wenn eine Scheibe herabgestuft wird: `**Herabstufung freigegeben von [Name] am [Datum]**` nach der Perspektive-Zeile.
