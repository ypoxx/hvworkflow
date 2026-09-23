# takt-001 — CI: pnpm-Version nur aus `packageManager`

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lane: infra
**Rolle/Modell:** Orchestrator (Opus 5.5) baut; Review Fable 5.1 (Regel 3)
**Rule ids:** AGENTS.md Regeln 1, 2, 12
**Quellen-IDs:** Plan 6.4 / B13 (Tore müssen laufen); gefunden am Bautag 23.09.2026 an PR #2 und #3

## Ziel

`gates` ist auf `claude/dax-shareholder-meeting-workflow-0s934z` seit mindestens 03.09.2026 bei jedem Push rot
(Läufe 32–39), noch bevor ein Tor läuft: `pnpm/action-setup@v4` bricht ab mit „Multiple versions of pnpm
specified: version 10 in the GitHub Action config … pnpm@10.33.0 in the package.json". Damit ist jeder PR rot und
E48 (Merge nur nach grüner CI) blockiert. Fix: `with: { version: 10 }` in `.github/workflows/gates.yml` entfällt;
die Version kommt allein aus `packageManager` in `package.json`.

## Nicht-Ziele

Keine weiteren Workflow-Änderungen (Pfadfilter, neue Tore: Scheibe 012). Falls nach dem Fix ein späterer Schritt
rot wird, ist das ein eigener Befund und wird nicht in dieser Kleinänderung behoben.

## Files allowed

`.github/workflows/gates.yml` (eine Zeile), diese Datei.

## Nachweis

CI-Lauf dieses PR: `pnpm/action-setup` läuft durch; Ergebnis der folgenden Schritte im Bericht.

## Bericht

(vom Umsetzer)

## Review findings

(vom Reviewer)
