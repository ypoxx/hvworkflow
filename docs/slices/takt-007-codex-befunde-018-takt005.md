# takt-007 — Codex-Befunde zu 018 und takt-005 (Doku)

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-plan (Abschnitt 3 des
Entwicklungsplans), docs-readme, docs-slices (Bericht von takt-005); startet nach takt-006 in der Takt-Lane
**Rolle/Modell:** Implementierer · Sonnet 5 (Nachweise im Wortlaut; Haiku hat heute zweimal Nachweise umformuliert);
Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 11, 12
**Quellen-IDs:** Codex-Review auf PR #17 (Scheibe 018, drei Kommentare vom 23.09.2026, 20:13 UTC) und PR #18
(takt-005, zwei Kommentare, 20:15 UTC), beide nach dem Merge; der dritte Kommentar zu #17 (Wirkungstext PreToolUse)
geht an takt-006

## Ziel

1. **#17-1 · `docs/agentische-entwicklung-plan.md` Abschnitt 3:** Der Satz zum Sicherheitsreview nennt die Prüfpunkte
   3, 4 und 7 und zugleich „einmal je Meilenstein". Der Produktplan (Abschnitt 6.3) plant den Review des Architekten nur
   an diesen drei Prüfpunkten. Der Satz nennt nur noch die Prüfpunkte; sonst ändert sich nichts.
2. **#17-3 · `README.md` Dokumentenindex:** Die Spec von 018 verlangte eine Zeile je **Datei** unter `docs/` (ohne
   `docs/evidence/**`, `docs/slices/**`, `docs/bautage/**`). Der Index führt teils nur Verzeichnisse, z. B.
   `docs/betrieb/`, `docs/datenschutz/`, `docs/sicherheit/`, `docs/adr/`, `docs/feedback/`.
   - Jede Datei bekommt eine eigene Zeile mit einem Satz Zweck. Den Zweck aus der ersten Überschrift oder dem ersten
     Absatz der Datei nehmen, nicht erfinden.
   - Bestehende Zeilen bleiben, soweit sie eine Datei nennen.
   - Die Prüfung liegt nur im Scratch: `git ls-files docs | grep -v -e '^docs/evidence/' -e '^docs/slices/' -e
     '^docs/bautage/'` gegen die Pfade im README. Die Ausgabe endet mit „0 fehlend" und steht wörtlich im Bericht.
3. **#18-1 und #18-2 · `docs/slices/takt-005-email-aus-012.md`, Bericht:** Der E-Mail-Scan und der `git diff --stat`
   stammen von einem früheren Stand. Beides auf dem heutigen Integrationsbranch neu ausführen und wörtlich einsetzen.
   - Der Scan: der Befehl aus Ziel 2 jener Spec. Die Fundstellen im Bericht selbst werden als Selbstzitat benannt.
   - Der Diff-Stat: der Squash-Commit von takt-005 gegen seinen Vorgänger, also
     `git show --stat --format= <Squash von takt-005>`; er zeigt vier Dateien.
   - Ein Satz vermerkt, dass die Nachweise nachträglich ersetzt wurden, mit Datum.

## Nicht-Ziele

Keine andere Wortlautänderung im Entwicklungsplan, keine neue Zeile in Abschnitt 5, kein Glossar.

## Files allowed

`docs/agentische-entwicklung-plan.md` (nur Abschnitt 3), `README.md`, `docs/slices/takt-005-email-aus-012.md` (nur
Bericht), `docs/slices/takt-007-codex-befunde-018-takt005.md` (Bericht).

## Akzeptanzkriterium

1. Index-Prüfung „0 fehlend" auf Dateiebene (Befehl und Ausgabe wörtlich im Bericht).
2. `pnpm gates` grün (Tail wörtlich, kopiert, nicht abgetippt).
3. Die Codex-Threads auf #17 und #18 bekommen nach dem Merge je eine Antwort des Orchestrators mit dem Commit.

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-007-codex-doku` vom Integrationsbranch, nach dem Merge von
  takt-006. Absolute Pfade.
- Jeder Commit nennt „takt-007" und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
