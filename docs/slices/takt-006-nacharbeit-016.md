# takt-006 — Folgebefunde aus der Nachprüfung von 016 und dem Codex-Review von PR #14 (Hooks und Tore)

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lane: infra (`scripts/**`; keine laufende
Scheibe hält sie)
**Rolle/Modell:** Implementierer-Backend · Sonnet 5 (Sicherheitsmuster in Hooks, deshalb nicht Haiku); Review Opus 5.5
(Perspektive Security/Betrieb)
**Rule ids:** AGENTS.md Regeln 1, 2, 12; docs/agentische-entwicklung-plan.md 5.4 (Hooks sind erste Linie, nicht die
Durchsetzung)
**Quellen-IDs:** `docs/slices/016-agenten-hooks-tore.md`, Review findings Runde 2, Punkte 1–6; Codex-Review auf PR #14
(fünf Kommentare vom 23.09.2026, 19:49 UTC, nach dem Merge; hier C1–C5)
**Depends on:** 016 (gemergt), 018 (gemergt; 018 berichtigt den Wirkungstext in Abschnitt 5.4 auf den heutigen
Stand — ändert takt-006 das Verhalten eines Hooks, zieht es genau diese Zeile nach)

## Ziel

1. **Punkt 1 · `scripts/hooks/pre-tool-use-bash.mjs`:** die Umgehungen aus der Nachprüfung werden blockiert, je mit
   einem Test über stdin: kombinierte Kurzoptionen (`-uf`, `-fu`), gequotete Refspecs (`'+main'`, `"+main"`,
   `':main'`), abgekürzte Langoptionen (`--dele`, `--forc`), globale Optionen vor dem Unterbefehl (`git --work-tree=…
   push`, `git --no-pager push`, `git -C … push`), `git push --prune` mit Wildcard-Refspec. Kein Test darf einen
   heute erlaubten Aufruf (`git push -u origin claude/…`) blockieren (Positivtest).
2. **Punkt 2 · `scripts/hooks/stop-check.mjs`:** die Signatur des letzten Testlaufs enthält den Commit-Stand
   (`git rev-parse HEAD`) zusätzlich zum Arbeitsbaum; ein `git commit` nach dem Testlauf ohne neuen Testlauf lässt den
   Hook blockieren (Test). Wenn das im Hook nicht verlässlich geht, stattdessen als bekannte, durch CI abgedeckte
   Lücke im Kopfkommentar des Hooks dokumentieren und im Bericht begründen.
3. **Punkt 3 · `scripts/slice-scope.mjs`:** die Warnung „Files allowed geändert" vergleicht gegen den Stand der Spec
   im ersten Commit des Branches, der die Spec-Datei anlegt (nicht gegen die Merge-Basis, auf der es die Spec noch
   nicht gibt); Test mit einer Fixture, in der „Files allowed" nach dem Spec-Commit erweitert wird.
4. **Punkt 4 · `scripts/hooks/task-completed.mjs`:** liest zusätzlich `task_subject` und `task_description` (Form
   des Hook-Ereignisses TaskCompleted) neben `tool_input.todos`; Tests für beide Formen. Den Wirkungstext der Zeile
   „TaskCompleted" in `docs/agentische-entwicklung-plan.md` 5.4 an das neue Verhalten anpassen (nur Spalte „Wirkung").
5. **Punkt 5 · `scripts/i18n-literal-check.test.mjs`:** der Test liest keine Datei außerhalb des Repositoriums
   (heute `/home/user/wt/020`); eine Fixture unter `scripts/fixtures/` ersetzt den Pfad.
6. **Punkt 6 · `scripts/plan-graph.mjs`:** eine fehlerhafte Planzeile ergibt eine Meldung mit Zeilennummer und Exit 1
   statt eines Stacktraces (Test).
7. **Codex C1 (P1) · `scripts/contract-gate-strict.test.mjs`:** Der grüne Fall des Strict-Modus nutzt die Remotes des
   aufrufenden Checkouts. Ohne `origin/claude/dax-shareholder-meeting-workflow-0s934z` (frischer Klon ohne Remote)
   scheitert `pnpm test:scripts` und damit `pnpm gates`. Der Test baut den Referenzstand in einem temporären
   Git-Repositorium auf; Nachweis: Lauf in einem Klon ohne Remote grün.
8. **Codex C2 (P2) · `scripts/hooks/lib/dirty-tree-signature.mjs`:** Ein ganz unversioniertes Verzeichnis erscheint in
   `git status --porcelain` als eine Zeile `?? dir/`; Änderungen an Dateien darin ändern die Signatur nicht, und der
   Stop-Hook lässt einen ungetesteten Stand durch. `--untracked-files=all` und NUL-getrenntes Porcelain-Format (`-z`),
   jede Datei einzeln hashen; Test mit einer Datei in einem neuen Verzeichnis.
9. **Codex C3 (P2) · `scripts/hooks/task-completed.mjs`:** Enthält eine Hook-Eingabe mehrere erledigte Punkte mit
   Scheibennummer, bricht die Schleife nach der ersten auflösbaren Spec ab. Jeder erledigte Punkt mit existierender
   Spec wird geprüft; einer ohne Annahme blockiert (Test: 901 angenommen, 900 nicht → rot). Zusammen mit Punkt 4.
10. **Codex C4 (P2) · `scripts/hooks/pre-tool-use-bash.mjs`:** Optionen mit eigenem Wert (`-o`/`--push-option <v>`,
    `--receive-pack <v>`, `--repo <v>`) zählen heute als Ziel; `git push --push-option ci.skip origin` passiert den Hook
    ohne Refspec. Optionen mit Wert werden samt Wert übersprungen, bevor Repository und Refspec gezählt werden (Test).
    Zusammen mit Punkt 1.
11. **Codex C5 (P2) · `scripts/hooks/pre-tool-use-bash.mjs`:** `curl http://[::1]:3000/…` wird als externer Aufruf
    blockiert, weil die Host-Erkennung bei der ersten Doppelpunkt-Stelle abschneidet. Host über `new URL()` bzw.
    klammerbewusst bestimmen (Test für `[::1]` erlaubt, `[2001:db8::1]` blockiert).
12. **Review takt-005 · `scripts/role-literal-check.test.mjs`:** `makeScratchRoot()` kopiert mit `cpSync` den
    lebenden Baum `apps/api/src` und `packages/domain/src`. Laufen daneben andere Prozesse im selben Worktree (Build,
    ein zweiter `pnpm gates`), scheitert die Kopie mit `ENOENT` (beobachtet im Review von takt-005: erster Lauf rot in
    Test 92, zweiter grün). Nur versionierte Dateien kopieren (`git ls-files`) oder beim Kopieren verschwundene Dateien
    überspringen; Test, der während der Kopie eine Datei anlegt und löscht.

## Nicht-Ziele

Keine neuen Tore, keine Änderung an `.claude/settings.json` (insbesondere keine `permissions.deny`-Regel; die liegt
beim Eigentümer), keine Änderung an CI-Workflows.

## Files allowed

`scripts/hooks/**`, `scripts/contract-gate-strict.test.mjs`, `scripts/role-literal-check.test.mjs`, `scripts/slice-scope.mjs`, `scripts/slice-scope.test.mjs`, `scripts/i18n-literal-check.test.mjs`,
`scripts/plan-graph.mjs`, `scripts/plan-graph.test.mjs`, `scripts/fixtures/**`, `docs/agentische-entwicklung-plan.md`
(Abschnitt 5.4, Spalte „Wirkung" der Zeilen PreToolUse und TaskCompleted), diese Datei (Bericht).

## Akzeptanzkriterium

1. Je Punkt ein roter Lauf vor der Änderung und ein grüner danach (Testname und Ausgabe im Bericht).
2. `pnpm gates` grün (Tail wörtlich), `pnpm test:scripts` mit Anzahl.
3. `git grep -n "/home/user" -- scripts` ohne Treffer.

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-006-nacharbeit-016` vom Integrationsbranch. Absolute Pfade.
- Jeder Commit nennt „takt-006" und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
