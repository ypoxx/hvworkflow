# takt-010 — Zwei Lücken im Tor „Scheibenumfang“ und im TaskCompleted-Hook

**Status:** spec
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: scripts (nur die unten genannten
Dateien)
**Rolle/Modell:** Implementierer-Backend · Sonnet 5; Review Opus 5.5 (Perspektive Betrieb)
**Rule ids:** AGENTS.md Regeln 1, 2, 12
**Quellen-IDs:** Scheibe 010b, Bericht (Branch `claude/slice-010b-…` wird vom Tor übersprungen); takt-007, Befund des
Bauers (bloßer Dateiname im Wurzelverzeichnis wird dem Verzeichnis des vorigen Pfads zugeordnet)

## Ziel

1. **Buchstaben-Suffix:** `scripts/slice-scope.mjs` erkennt Scheiben mit Suffix wie `010b` genauso wie `010`:
   - Branch `claude/slice-010b-…` wird der Spec `docs/slices/010b-*.md` zugeordnet, nicht übersprungen und nicht
     mit `010-*.md` verwechselt.
   - Heute prüft das Tor solche Branches in CI gar nicht (Ausgabe „not on a claude/slice-NNN-… branch … skipping“).
2. **Derselbe Fehler im Hook:** `scripts/hooks/task-completed.mjs` (`SLICE_NUMBER_RE`, `findSpecFile`) erkennt
   `010b` und `takt-010b` als eigene Scheibe. `010b` darf nie die Annahme von `010` leihen und umgekehrt (dieselbe Klasse
   Fehler wie `takt-006` → `006`, behoben in takt-006).
3. **Wurzeldateien:** Ein bloßer Dateiname (ohne „/“) nach einem Pfad mit Verzeichnis im selben Listenpunkt wird heute
   dem Verzeichnis des vorigen Pfads zugeordnet. Das ist für Kurzformen gewollt (Spec 020: „Alt-Specs
   `apps/web/e2e/002-….spec.ts`, `003-answers-stage.spec.ts`, `abnahme.spec.ts`“), macht aber aus `README.md` ein
   `docs/README.md` (Fließtext der ersten Fassung der Spec von takt-007).
   - Lösung nach eigener Wahl, begründet im Bericht. Bedingungen: die Kurzform aus 020 gilt weiter; die erste
     Fassung von takt-007 (`git show c9d6655:docs/slices/takt-007-codex-befunde-018-takt005.md`) ergibt `README.md` im
     Wurzelverzeichnis; die Liste erlaubter Dateien wird nie weiter, als die Spec meint (kein pauschales „beides
     erlauben“ ohne Begründung).
4. **Tests zuerst:** je Ziel ein Test in den vorhandenen Testdateien (`scripts/slice-scope.test.mjs`,
   `scripts/hooks/task-completed.test.mjs`), der vor der Änderung rot ist (roter Lauf wörtlich im Bericht).

## Nicht-Ziele

Kein anderes Tor, keine Änderung an Specs, keine Änderung an CI-Dateien, kein neues Namensschema.

## Files allowed

- `scripts/slice-scope.mjs`
- `scripts/slice-scope.test.mjs`
- `scripts/hooks/task-completed.mjs`
- `scripts/hooks/task-completed.test.mjs`
- `scripts/fixtures/task-completed/docs/slices/*` (nur neue Fixtures mit Nummern ab 905)
- `docs/slices/takt-010-scheibenumfang-luecken.md`

## Akzeptanzkriterium

1. Rote und grüne Läufe je Ziel wörtlich im Bericht.
2. `node scripts/slice-scope.mjs` auf einem Arbeitsstand des Branches `claude/slice-010b-lesepfade-ui` (oder einem
   gleich benannten Wegwerf-Branch) prüft statt zu überspringen; Ausgabe wörtlich.
3. `pnpm gates` grün (Tail wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-010-scheibenumfang` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-010“ und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

(vom Bauer)

## Review findings

(vom Reviewer)
