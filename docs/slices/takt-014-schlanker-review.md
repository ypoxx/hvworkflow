# takt-014 — Schlanker Review-Modus, Folgeliste, Übergabe

**Status:** fertig (Orchestrator)
**Klasse:** S (Kleinänderungsspur) · Risikoklasse niedrig · Lanes: docs-plan (nur AGENTS.md), docs
**Rolle:** Architekt/Orchestrator. Review: entfällt — die Scheibe protokolliert eine Entscheidung des Eigentümers und
ändert keinen Code; CI (`pnpm gates`) prüft Vokabular und Umfang.
**Rule ids:** AGENTS.md Regeln 1, 3, 12
**Quellen-IDs:** Entscheidung des Eigentümers vom 25.09.2026 (Chat): Reviews und Codex schlanker, Kleinigkeiten
sammeln; Blocker und große Fehler werden bearbeitet; Opus bleibt Orchestrator und prüft wichtige und komplizierte
Scheiben; Orchestrator-Sitzungen früher neu starten.

## Ziel

1. AGENTS.md Regel 3 um den schlanken Review-Modus ergänzen.
2. `docs/folgeliste.md` als Sammelort für Minor/Nit/P2 anlegen, befüllt mit den offenen Punkten aus takt-008, 010c, 010d.
3. `docs/bautage/uebergabe-2026-09-25.md`: Übergabe an eine frische Orchestrator-Sitzung.

## Nicht-Ziele

Kein Code, keine Änderung an `docs/agentische-entwicklung-plan.md` (Nachzug in einem späteren Takt, wenn nötig).

## Files allowed

`AGENTS.md`, `docs/folgeliste.md`, `docs/bautage/uebergabe-2026-09-25.md`, diese Datei.

## Akzeptanzkriterium

`pnpm gates` grün in CI auf dem letzten Commit.
