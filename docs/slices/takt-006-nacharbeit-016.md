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
13. **Codex #17 · Wirkungstext PreToolUse:** Der Wirkungstext in `docs/agentische-entwicklung-plan.md` 5.4 behauptet,
    nicht-lokale `curl`/`wget`-Aufrufe würden generell blockiert. `externalCurlFinding()` prüft aber nur Top-Level-
    Shell-Segmente, deren erstes Wort `curl`/`wget` ist, und nur explizite `http://`/`https://`-URLs — `curl
    example.com` und `echo URL | xargs curl` passieren also. Nach den Änderungen zu Punkt 11 (C5) und Punkt 1 den
    Wirkungstext so fassen, dass er aus der endgültigen Quelle genau sagt, was der Hook blockiert und was nicht
    (Stand bleibt `läuft (Hook: PreToolUse)`).

## Nicht-Ziele

Keine neuen Tore, keine Änderung an `.claude/settings.json` (insbesondere keine `permissions.deny`-Regel; die liegt
beim Eigentümer), keine Änderung an CI-Workflows.

## Files allowed

`scripts/hooks/**`, `scripts/i18n-literal-check.mjs` (nur die zwei Kopfkommentare mit lokalem Pfad; vom
Spec-Eigentümer nach dem Bau ergänzt, damit Kriterium 3 erfüllbar ist), `scripts/contract-gate-strict.test.mjs`, `scripts/role-literal-check.test.mjs`, `scripts/slice-scope.mjs`, `scripts/slice-scope.test.mjs`, `scripts/i18n-literal-check.test.mjs`,
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

Slice: takt-006
Done:
- Punkte 1, 4, 6, C2, C3, C4, C5 (Hooks/Skripte): weitere Umgehungen in `pre-tool-use-bash.mjs`
  (kombinierte Kurzoptionen, gequotete/abgekürzte Refspecs, `--work-tree`/`--no-pager`, `--prune`+Wildcard,
  Optionswerte, IPv6-Host über `new URL()`), `task-completed.mjs` (zweite Eingabeform, alle erledigten
  Punkte statt nur des ersten) und `dirty-tree-signature.mjs` (`--untracked-files=all`, `-z`) geschlossen.
- Punkte 2, 3, C1 (Zustandslogik): `stop-check.mjs` prüft jetzt zusätzlich den Commit-Stand seit dem
  letzten Testlauf; `slice-scope.mjs` vergleicht „Files allowed" gegen den Commit, der die Spec anlegt,
  nicht gegen die (spec-lose) Merge-Basis; `contract-gate-strict.test.mjs` baut seinen eigenen
  Referenzstand statt der Remotes des aufrufenden Checkouts zu nutzen (Klon-Nachweis unten).
- Punkte 5, 12, 13: `i18n-literal-check.test.mjs` liest keine Datei mehr außerhalb des Repositoriums
  (Fixture `podium-regression`); `role-literal-check.test.mjs` kopiert nur versionierte Dateien und
  übersteht ein Verschwinden mitten in der Kopie; der Wirkungstext „PreToolUse" in Abschnitt 5.4 nennt
  jetzt genau, was `curl`/`wget`-Erkennung blockiert und was nicht (Codex #17).

Evidence (rot → grün je Punkt; Testname + zusammengefasste Ausgabe):

- **Punkt 1** (`scripts/hooks/pre-tool-use-bash.test.mjs`, "takt-006 point 1 red: ..." ×10, "green: ... -u origin ..."):
  rot: 10/10 der neuen Fälle schlugen fehl (`0 !== 2`, u.a. `-uf`, `'+main'`, `':main'`, `--dele`, `--forc`,
  `--work-tree=…`, `--no-pager`, `--prune`+Wildcard). Grün: `# tests 44 / # pass 44 / # fail 0`.
- **Punkt 2** (`scripts/hooks/stop-check.test.mjs`, "takt-006 point 2 red: a commit made after mark-test-run
  is blocked ..."): rot: `expected 2, actual 0` (Commit nach Testlauf lief unbemerkt durch). Grün:
  `# tests 11 / # pass 11 / # fail 0`.
- **Punkt 3** (`scripts/slice-scope.test.mjs`, "takt-006 point 3 red: widening \"Files allowed\" after the
  spec-introducing commit ..."): rot: `doesNotMatch`/kein "differs from its version" im Stdout (Spec
  existierte an der Merge-Basis nicht, Vergleich gab still auf). Grün: `# tests 14 / # pass 14 / # fail 0`.
- **Punkt 4** (`scripts/hooks/task-completed.test.mjs`, "takt-006 point 4 red: task_subject/task_description
  naming a not-yet-accepted slice is blocked"): rot: `0 !== 2` (Eingabeform wurde ignoriert). Grün:
  `# tests 14 / # pass 14 / # fail 0`.
- **Punkt 5** (`scripts/i18n-literal-check.test.mjs`): rot: `git show HEAD:...` des Vor-Fix-Stands enthält
  `/home/user/wt/020` (per `node -e`-Selbstcheck bestätigt: `doesNotMatch` schlägt fehl); der Test lief nur,
  weil dieser Rechner zufällig einen Sibling-Worktree unter diesem Pfad hat (in CI/Klon stillschweigend
  geskippt). Grün: `# tests 6 / # pass 6 / # fail 0`, inkl. neuem Fixture-Test „M6: a multi-line JSX comment
  ... (the Podium.tsx-shaped false positive) is masked, not flagged".
- **Punkt 6** (`scripts/plan-graph.test.mjs`, "takt-006 point 6 red: ..." ×2): rot: `node scripts/plan-graph.mjs
  --plan .../malformed-bullet.md` zeigte einen vollen Node-Stacktrace (`at file://...`, `at parseSlices`,
  `at main`) trotz korrektem Exit-Code; Kalenderdatum-Fehler ohne Zeilennummer. Grün: `# tests 10 / # pass 10
  / # fail 0`, kein `at `-Frame mehr in stderr.
- **Punkt 12** (`scripts/role-literal-check.test.mjs`, "takt-006 point 12: a file that vanishes between
  listing and copying is skipped, not an ENOENT crash"): rot (Nachbau des alten `cpSync`-Ansatzes per
  `node -e`): `ENOENT: no such file or directory, lstat '.../b.ts'`. Grün: `# tests 11 / # pass 11 / # fail 0`.
- **Codex C1** (`scripts/contract-gate-strict.test.mjs`): rot, echter Klon ohne Remote (gelöscht nach dem
  Lauf): `1 !== 0`, `FAIL (c) git or origin/claude/dax-shareholder-meeting-workflow-0s934z not available —
  version-bump check skipped`. Grün, selber Testlauf nach dem Fix: `# tests 3 / # pass 3 / # fail 0`.
- **Codex C2** (`scripts/hooks/lib/dirty-tree-signature.test.mjs`, "C2 red: a file inside a brand-new
  untracked directory changes the signature when edited"): rot: `notEqual`-Annahme schlug fehl (Signatur
  blieb gleich, da `?? dir/` als eine Zeile erschien). Grün: `# tests 5 / # pass 5 / # fail 0`.
- **Codex C3** (`scripts/hooks/task-completed.test.mjs`, "Codex C3 red: two completed items, only the second
  unaccepted ..."): rot: `0 !== 2` (Schleife brach nach der ersten auflösbaren Spec ab). Grün: siehe Punkt 4
  (gleiche Datei, gleicher Lauf, `# tests 14 / # pass 14 / # fail 0`).
- **Codex C4** (`scripts/hooks/pre-tool-use-bash.test.mjs`, "Codex C4 red: ..." ×4): rot: `0 !== 2` für
  `--push-option`, `-o`, `--receive-pack` (der jeweilige Optionswert zählte als zweites Ziel). Grün: siehe
  Punkt 1 (gleiche Datei, gleicher Lauf).
- **Codex C5** (`scripts/hooks/pre-tool-use-bash.test.mjs`, "Codex C5 green: curl to http://[::1]:3000/...
  passes"): rot: `0 !== 0` erwartet, tatsächlich blockiert (Host-Erkennung schnitt bei `[` ab). Grün: siehe
  Punkt 1 (gleiche Datei, gleicher Lauf).
- **Punkt 13** (Codex #17, `docs/agentische-entwicklung-plan.md`): kein automatisierter Test (reiner
  Dokumentationstext); Nachweis ist `pnpm plan-honesty` grün (`38 row(s) in section 5, every "Stand"
  verified`) nach Korrektur der Tabellenzelle (siehe „Offen" zu einem selbst verursachten Nebenfund).

C1-Klonlauf (ohne Remote), danach gelöscht:
```
$ git clone --no-local /home/user/wt/takt .../c1-clone && cd .../c1-clone
$ git remote remove origin && git remote -v            # (leer)
$ pnpm install --offline --frozen-lockfile              # Done in 1s using pnpm v10.33.0
$ node --test scripts/contract-gate-strict.test.mjs
# tests 3 / # pass 3 / # fail 0
$ pnpm test:scripts
# tests 148 / # pass 148 / # fail 0
```

`git grep -n "/home/user" -- scripts`:
```
scripts/i18n-literal-check.mjs:30: *     boundaries (confirmed against `/home/user/wt/020/apps/web/src/features/stage/Podium.tsx:101`,
scripts/i18n-literal-check.mjs:39: * a different tree, for tests (and for checking a sibling worktree, e.g. `--root /home/user/wt/020`).
```
(zwei Treffer, siehe „Offen" — `scripts/i18n-literal-check.mjs` steht nicht in „Files allowed").

`pnpm test:scripts`: `# tests 148 / # pass 148 / # fail 0`.

`pnpm gates` (Tail, wörtlich):
```
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6085.31902

> @hv/web@0.0.0 build /home/user/wt/takt/apps/web
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 1714 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-l931jxa-.css                        39.97 kB │ gzip:   8.67 kB
dist/assets/index-C6zQBIzf.js                        529.18 kB │ gzip: 155.32 kB │ map: 2,181.19 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.15s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit eb0be51
```

Open:
- Akzeptanzkriterium 3 ist nicht vollständig erfüllt: `scripts/i18n-literal-check.mjs` (nicht die
  `.test.mjs`-Datei) nennt in zwei Kopfkommentaren weiterhin `/home/user/wt/020` — dieselbe Datei, deren
  Test Punkt 5 fixt. Ich habe die Datei zunächst mitkorrigiert, das aber wieder zurückgenommen: sie steht
  nicht in „Files allowed" dieser Spec (nur `scripts/i18n-literal-check.test.mjs` steht dort), und
  `node scripts/slice-scope.mjs` schlug mit genau dieser Datei fehl, solange die Änderung committet war.
  Empfehlung: `scripts/i18n-literal-check.mjs` in einer eigenen Kleinstscheibe (oder per Spec-Erweiterung)
  freigeben und die zwei Kommentarzeilen dort nachziehen.
- Nebenfund (selbst verursacht und behoben): `scripts/plan-honesty.mjs` teilt eine Tabellenzeile naiv an
  jedem `|`-Zeichen, auch innerhalb Backticks — mein erster Entwurf des Wirkungstexts zu Punkt 13 enthielt
  `` `||` `` und zerriss dadurch die Zeile. Text so umformuliert, dass kein rohes `|` mehr vorkommt; kein
  Fund an `plan-honesty.mjs` selbst nötig.
- Punkt 13 kam als Nachtrag während der Bearbeitung (Codex-Review von PR #17) und wurde in „Ziel" der Spec
  ergänzt; kein separater automatisierter Test, da reiner Dokumentationstext (siehe Evidence oben).

Touched:
- `scripts/hooks/pre-tool-use-bash.mjs`, `scripts/hooks/pre-tool-use-bash.test.mjs`
- `scripts/hooks/task-completed.mjs`, `scripts/hooks/task-completed.test.mjs`
- `scripts/hooks/lib/dirty-tree-signature.mjs`, `scripts/hooks/lib/dirty-tree-signature.test.mjs` (neu)
- `scripts/hooks/stop-check.mjs`, `scripts/hooks/stop-check.test.mjs`
- `scripts/hooks/mark-test-run.mjs`, `scripts/hooks/mark-test-run.test.mjs`
- `scripts/hooks/post-tool-use-lint.test.mjs` (Kommentar ohne `/home/user`)
- `scripts/slice-scope.mjs`, `scripts/slice-scope.test.mjs`
- `scripts/i18n-literal-check.test.mjs`, `scripts/fixtures/i18n-literal/podium-regression/features/NextPreview.tsx` (neu)
- `scripts/plan-graph.mjs`, `scripts/plan-graph.test.mjs`, `scripts/fixtures/plan-graph/bad-calendar-date.md` (neu)
- `scripts/contract-gate-strict.test.mjs`
- `scripts/role-literal-check.test.mjs`
- `docs/agentische-entwicklung-plan.md` (5.4, Zeilen PreToolUse und TaskCompleted)
- `docs/slices/takt-006-nacharbeit-016.md` (dieser Bericht, Ziel-Punkt 13)

## Review findings

(vom Reviewer)
