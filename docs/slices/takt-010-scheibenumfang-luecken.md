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

Slice: takt-010
Done:
- Ziel 1 (`scripts/slice-scope.mjs`): `detectSliceFromBranch` erkennt jetzt `\d{3}[a-z]?` statt `\d{3}` —
  ein Branch `claude/slice-010b-…` wird der Spec `docs/slices/010b-*.md` zugeordnet und nicht mehr
  übersprungen; `findSpecFile` hielt `010` und `010b` schon vorher auseinander (sein Präfix schließt den
  Bindestrich ein), das musste nur die vollständige Nummer bekommen.
- Ziel 2 (`scripts/hooks/task-completed.mjs`): `SLICE_NUMBER_RE` erkennt jetzt ebenfalls `\d{3}[a-z]?` —
  vorher scheiterte `\b…\b` an "010b" komplett (eine Ziffer und der folgende Buchstabe sind beide `\w`,
  also nie eine Wortgrenze direkt nach den drei Ziffern), sodass weder "010b" noch fälschlich "010"
  gefunden wurde und der Hook stillschweigend nichts prüfte.
- Ziel 3 (`scripts/slice-scope.mjs`, `extractGlobs`): eine neue Regel `isRealRootFile(root, bareName)` —
  ein bloßer Dateiname ohne Jokerzeichen (`*`, `?`, `{`), der als echte Datei im Wurzelverzeichnis
  existiert, ist diese Wurzeldatei; die Verzeichnis-Vererbung aus Ziel m4 (Runde 1) greift dann nicht.
  Begründung unten.

Regel für Ziel 3 (eigene Wahl, mit Begründung):

Ich habe die Vererbung des vorigen Verzeichnisses auf einen bloßen Dateinamen genau dann abgeschaltet,
wenn dieser Dateiname (a) keine Jokerzeichen enthält und (b) tatsächlich als Datei direkt im
Wurzelverzeichnis existiert (`existsSync(join(root, bareName))`) — dann gilt er als diese Wurzeldatei,
sonst unverändert wie bisher (Vererbung vom vorigen Vollpfad im selben Textblock). Geprüft gegen alle
drei Bedingungen der Spec:

1. **020s Kurzform bleibt gültig:** `003-y.spec.ts` und `abnahme.spec.ts` existieren nirgends als echte
   Datei im Wurzelverzeichnis — `isRealRootFile` liefert `false`, also greift unverändert die
   Verzeichnis-Vererbung aus `apps/web/e2e/002-x.spec.ts`. Testet
   „takt-010 goal 3 regression: 020-style bare filenames …" (grün, unverändert vor und nach dem Fix).
2. **Die erste Fassung von takt-007 ergibt `README.md` im Wurzelverzeichnis:** `README.md` existiert
   real im Wurzelverzeichnis — die Vererbung von `docs` (aus dem vorigen Token
   `docs/agentische-entwicklung-plan.md` im selben Absatz) unterbleibt, das Glob bleibt `README.md`.
   Testet „takt-010 goal 3: a bare filename matching a real root file resolves to the root …" (rot →
   grün unten).
3. **Nie weiter als die Spec meint, kein „beides erlauben":** die Regel wählt genau eine Deutung, nie
   beide — derselbe Test prüft zusätzlich, dass `docs/README.md` (die alte, falsche Deutung) danach
   *nicht* mehr durchgeht (`carriedDocsReadme`, Status 1).

   *Korrektur (Minor 3, Nacharbeit nach Review):* der ursprüngliche Schlusssatz hier lautete „Es wird
   also nichts weiter erlaubt, nur die falsche Verzeichnis-Deutung durch die richtige (Wurzel-)Deutung
   ersetzt." Das war zu pauschal formuliert und traf so nicht zu: der Blocker/Major-Befund der Nacharbeit
   unten zeigt zwei Wege, wie genau diese Version der Regel doch weiter erlauben konnte, als die Spec
   meint — über die Quelle der Existenzprüfung (Arbeitsbaum statt Merge-Basis, Blocker) und über
   mehrdeutige bloße Namen, die an beiden Orten real sind (Major). Die jetzige Fassung der Regel (siehe
   Nacharbeit) behebt beides.

Ich habe bewusst nicht "bulletiert vs. Fließtext" als Unterscheidung gewählt (naheliegend, weil 020s
Kurzform in einem `- `-Aufzählungspunkt steht und takt-007s Absatz keiner ist): `takt-003-nacharbeit-015.md`
listet ebenfalls in einem reinen Fließtext-Abschnitt (kein `- ` überhaupt) bloße ADR-Dateinamen wie
`0009-*.md`, `0010-*.md`, … nach `docs/adr/0003-*.md` — dort *ist* die Verzeichnis-Vererbung gewollt, und
diese bestehende (angenommene) Spec würde durch eine reine Bulleted/Fließtext-Unterscheidung kaputtgehen.
Die Jokerzeichen dieser Namen (`*`) verhindern bei meiner Regel jede Wurzel-Prüfung dafür ohnehin (Punkt
(a) oben), die Vererbung bleibt für sie unverändert bestehen — ungetestet hier, weil außerhalb der
erlaubten Dateien (keine Spec-Änderung, Nicht-Ziel), aber am realen Text nachvollzogen und im Kommentar
über `isRealRootFile` in `scripts/slice-scope.mjs` dokumentiert. Als Nebeneffekt korrigiert die Regel
auch `004-api-server.md` (`pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml` nach `apps/api/**` im
selben Fließtext-Block) — dort war die Vererbung ebenfalls falsch (`apps/api/package.json` statt
Wurzel-`package.json`), unangetastet gelassen (Nicht-Ziel: keine Spec-Änderung), aber ab jetzt korrekt
gelesen.

Evidence (rot → grün je Ziel):

- **Ziel 1** (`scripts/slice-scope.test.mjs`, "takt-010 goal 1: a claude/slice-NNNb-… branch is checked
  against its own NNNb spec, not skipped, and not confused with plain NNN"): rot —
  ```
  The input was expected to not match the regular expression /skipping/. Input:

  'slice-scope: not on a claude/slice-NNN-…/claude/takt-NNN-… branch (checked GITHUB_HEAD_REF and git HEAD) and no --slice/--takt/--spec given — skipping.\n'
  ```
  (`scripts/slice-scope.test.mjs` Lauf davor: `# tests 17 / # pass 15 / # fail 2`). Grün: Test 15 ok,
  Gesamtlauf `# tests 17 / # pass 17 / # fail 0`.
- **Ziel 2** (`scripts/hooks/task-completed.test.mjs`, drei neue Tests): rot —
  ```
  # 906b (blockiert erwartet, war 0): Expected values to be strictly equal: 0 !== 2
  # 905b (Stdout sollte "905b" nennen, war leer): The input did not match the regular expression /905b/. Input: ''
  # takt-905b (blockiert erwartet, war 0): Expected values to be strictly equal: 0 !== 2
  ```
  (Lauf davor: `# tests 21 / # pass 18 / # fail 3`). Grün: alle drei ok, Gesamtlauf
  `# tests 21 / # pass 21 / # fail 0`.
- **Ziel 3** (`scripts/slice-scope.test.mjs`, "takt-010 goal 3: a bare filename matching a real root
  file resolves to the root …"): rot —
  ```
  slice-scope: 1 file(s) outside "docs/slices/905-fixture.md"'s "Files allowed" list:
    README.md


  1 !== 0
  ```
  Grün: Test 16 ok, Gesamtlauf `# tests 17 / # pass 17 / # fail 0` (siehe Ziel 1, gleicher Lauf).

`pnpm -C /home/user/wt/takt test:scripts` (nach allen drei Fixes, vollständiger Lauf):
```
1..202
# tests 202
# suites 0
# pass 202
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8098.647077
```

Akzeptanzkriterium 2 (Branch `claude/slice-010b-…` wird geprüft statt übersprungen): benutzt wurde der
schon vorhandene, unveränderte Arbeitsbaum `/home/user/wt/010b` — ein separates, bereits ausgechecktes
Geschwister-Arbeitsverzeichnis auf genau dem Branch `claude/slice-010b-lesepfade-ui` mit der echten Spec
`docs/slices/010b-lesepfade-oberflaeche.md` (nicht von mir angelegt, nicht verändert, nur mit `--root`
gelesen — kein `git checkout`, kein Wegwerf-Branch nötig, weil dieser Arbeitsbaum schon existierte). Der
Aufruf `node scripts/slice-scope.mjs --root /home/user/wt/010b` löst den Branchnamen dort ganz normal
über `git rev-parse --abbrev-ref HEAD` auf (kein `GITHUB_HEAD_REF` nötig, weil der Arbeitsbaum bereits
auf diesem Branch steht) — derselbe Codepfad, den `GITHUB_HEAD_REF` in einer echten Pull-Request-Prüfung
nähme.

Vorher (Stand vor Ziel 1, per `git stash` auf den unveränderten `slice-scope.mjs` zurückgesetzt, danach
`git stash pop`):
```
slice-scope: not on a claude/slice-NNN-…/claude/takt-NNN-… branch (checked GITHUB_HEAD_REF and git HEAD) and no --slice/--takt/--spec given — skipping.
exit: 0
```
Nachher (mit dem Fix aus Ziel 1, unverändert seit Ziel 3 — Ziel 3 betrifft keine bloßen Dateinamen in
dieser Spec):
```
slice-scope: 30 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
exit: 0
```
Das Tor identifiziert den Branch, ordnet ihn der richtigen (`010b`-) Spec zu und prüft echte 30
geänderte Dateien gegen deren 19 Muster — nicht die 010-Spec, und kein Überspringen mehr.

`pnpm -C /home/user/wt/takt gates` (Tail, wörtlich, Stand nach den beiden Fach-Commits, Commit `8feb02e`
— dieser Bericht-Commit selbst kommt danach). Die `slice-scope`-Zeile darin bestätigt nebenbei, dass das
Tor jetzt den echten, committeten Diff dieser Scheibe sieht (bei noch unverändertem Arbeitsbaum, direkt
nach dem Spec-Commit, war nur „1 changed file(s)" sichtbar — der `git diff` des Tors sieht nur Commits,
keine unverzeichneten Änderungen; nach beiden Fach-Commits korrekt alle zehn):
```
slice-scope: 10 changed file(s), all within "docs/slices/takt-010-scheibenumfang-luecken.md"'s "Files allowed" list (6 pattern(s)).
```
```
1..202
# tests 202
# suites 0
# pass 202
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6739.665159

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
dist/assets/index-DwK4D-x4.css                        39.98 kB │ gzip:   8.67 kB
dist/assets/index-BImqnPVW.js                        532.22 kB │ gzip: 156.05 kB │ map: 2,201.28 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.18s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 8feb02e, tree 399ca9d7971b…
```

Open:
- Kein offener Punkt aus dem Ziel. Die drei nicht geforderten, aber schon oben erwähnten Nebenwirkungen
  von Ziel 3 (`004-api-server.md` korrekt gelesen, `takt-003-…` unverändert korrekt gelesen) sind reine
  Beobachtungen an bereits angenommenen Alt-Specs, keine Änderung an ihnen (Nicht-Ziel).

Touched:
- `scripts/slice-scope.mjs`, `scripts/slice-scope.test.mjs`
- `scripts/hooks/task-completed.mjs`, `scripts/hooks/task-completed.test.mjs`
- `scripts/fixtures/task-completed/docs/slices/905-regulaer-offen.md` (neu)
- `scripts/fixtures/task-completed/docs/slices/905b-regulaer-angenommen.md` (neu)
- `scripts/fixtures/task-completed/docs/slices/906-regulaer-angenommen.md` (neu)
- `scripts/fixtures/task-completed/docs/slices/906b-regulaer-offen.md` (neu)
- `scripts/fixtures/task-completed/docs/slices/takt-905b-kleinaenderung-offen.md` (neu)
- `docs/slices/takt-010-scheibenumfang-luecken.md` (dieser Bericht)

### Nacharbeit nach Review und Codex

Ausgelöst durch das unabhängige Review (Opus, Betrieb: „nacharbeiten", 1 Blocker, 1 Major, 2 Minor,
2 Nit) und Codex' P2 auf PR #27 (derselbe Grund wie der Blocker). Ausgangspunkt `HEAD` `68564a2`. Zwei
Fach-Commits (Tests, dann Fix — der Fix deckt Blocker, Major und Nit 6 zusammen ab, da alle drei
dieselben paar Zeilen in `scripts/slice-scope.mjs` betreffen); Testname und zusammengefasste Ausgabe je
rot → grün:

1. **BLOCKER (und Codex P2 auf PR #27, derselbe Grund)** (`scripts/slice-scope.test.mjs`): `isRealRootFile`
   prüfte `existsSync` gegen den ausgecheckten Arbeitsbaum — genau den Baum, den der zu prüfende Diff
   selbst erzeugt. Ein von der Scheibe selbst neu angelegter Wurzeltreffer zählte dadurch fälschlich als
   Wurzeldatei (verbreitert den eigenen Umfang); umgekehrt fiel eine von der Scheibe gelöschte
   Wurzeldatei fälschlich auf die vererbte Verzeichnis-Deutung zurück. Rot:
   ```
   # "a root file created by the slice itself must not count as a root file"
   slice-scope: 1 changed file(s), all within "docs/slices/016-x.md"'s "Files allowed" list (3 pattern(s)).
   0 !== 1

   # "(reverse) a root file deleted by the slice must still resolve to root"
   slice-scope: 1 file(s) outside "docs/slices/016-x.md"'s "Files allowed" list:
     003-y.spec.ts
   1 !== 0
   ```
   Fix: `makeRootFileChecker(root, mergeBase)` prüft jetzt `git cat-file -e <mergeBase>:<pfad>` — die
   Merge-Basis wird dafür in `main()` vor dem Parsen von „Files allowed" aufgelöst (vorher geschah das
   erst kurz vor der Diff-Berechnung, danach). Im `--diff`-Modus (Tests, kein Branch, kein
   Merge-Basis-Begriff) bleibt es unverändert beim Arbeitsbaum, dokumentiert im Docstring. Grün: beide
   Tests ok, Gesamtlauf `# tests 20 / # pass 20 / # fail 0` (`slice-scope.test.mjs`).
2. **MAJOR** (`scripts/slice-scope.test.mjs`, „an ambiguous bare name …"): wenn ein bloßer Name an der
   Wurzel *und* im vererbten Verzeichnis zugleich real ist, gewann bisher stillschweigend die Wurzel.
   Rot:
   ```
   slice-scope: 1 changed file(s), all within "docs/slices/016-x.md"'s "Files allowed" list (3 pattern(s)).
   0 !== 1
   ```
   Fix: `extractGlobs` sammelt solche Namen jetzt in `ambiguous` statt sie aufzulösen; `main()` meldet sie
   und bricht mit Exit 1 ab („ambiguous bare name(s) — write the full path instead"). Grün: Test ok,
   gleicher Gesamtlauf wie oben.

   Vollabgleich über alle echten Specs in `docs/slices/` (Skript unter
   `/tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/ambiguity-audit.mjs`,
   nicht Teil des Repos — reine Prüfhilfe, dieselbe Bullet-/Backtick-/`currentDir`-Logik wie
   `extractGlobs`, gegen den aktuellen Arbeitsbaum als Stellvertreter für „die Merge-Basis jeder dieser
   bereits angenommenen Specs"):
   ```
   004-api-server.md: 1 ambiguous bare name(s)
     `package.json` also exists at `apps/api/package.json`
   ```
   Genau die vom Reviewer genannte Ausnahme, sonst keine (`(none)` für jede andere Spec). `004` ist
   längst angenommen und wird von keinem laufenden Branch mehr geprüft; keine Spec-Änderung (Nicht-Ziel).
3. **Minor 3** (dieser Bericht, Abschnitt „Regel für Ziel 3", Punkt 3): der Schlusssatz „Es wird also
   nichts weiter erlaubt, nur die falsche Verzeichnis-Deutung durch die richtige (Wurzel-)Deutung
   ersetzt" war zu pauschal und ist durch den Blocker/Major-Befund oben widerlegt (die Wurzel-Bevorzugung
   *konnte* mehr erlauben, als die Spec meinte — über die Existenzquelle und über Mehrdeutigkeit). Text
   oben korrigiert, mit Verweis hierher.
4. **Minor 4** (`scripts/hooks/task-completed.test.mjs`, „a completed plain 905 is blocked …"): die
   Rückrichtung war ungetestet — eine reine „905" darf die Annahme ihres Buchstaben-Geschwisters „905b"
   nicht leihen. Kein roter Lauf: die Regel aus Ziel 2 behandelte diesen Fall schon richtig (`findSpecFile`
   hält beide Präfixe über den Bindestrich auseinander); der neue Test sichert das nur ab, unter
   Verwendung der vorhandenen Fixture `905-regulaer-offen.md`. Lief beim ersten Versuch grün
   (`# tests 22 / # pass 22 / # fail 0`).
5. **Nit 5** (`scripts/hooks/task-completed.test.mjs:156-160`): die Zusicherung auf „takt-905b" prüfte nur
   die extrahierte Nummer in der Meldung, nicht den tatsächlich gelesenen Spec-Dateinamen — ein Treffer
   auf die falsche Datei wäre am Text allein nicht erkennbar gewesen. Ergänzt um
   `assert.match(r.stderr, /takt-905b-kleinaenderung-offen\.md/)`. Kein roter Lauf (dieselbe bereits
   korrekte Auflösung wie Punkt 4); Nachweis reine Testschärfung, gleicher Gesamtlauf.
6. **Nit 6** (`scripts/slice-scope.mjs:308`, `scripts/hooks/task-completed.mjs`-Docstring von
   `findSpecFile`): beide nannten nur „NNN", obwohl ein Großbuchstaben-Suffix (`010B`) von keinem der
   beiden Skripte erkannt wird und still durchfällt (`slice-scope` überspringt, `task-completed` prüft
   nichts). Entscheidung: das Namensschema bleibt bewusst klein geschrieben (kein neues Namensschema,
   Nicht-Ziel dieser Scheibe; alle echten Vorkommen — `010b`, die Fixtures dieser Nacharbeit — sind
   klein) — nur die Meldungen wurden berichtigt, sie nennen jetzt „NNNx" (`claude/slice-NNNx-…` bzw.
   `docs/slices/NNNx-*.md`) statt weiterhin nur „NNN" zu behaupten. Kein Test (reiner Text); Nachweis ist
   der geänderte Wortlaut selbst (siehe Diff) und dass `assert.match(r.stdout, /skipping/)` in den
   bestehenden Skip-Tests unverändert grün bleibt (die Tests prüfen nur auf „skipping", nicht auf den
   genauen Wortlaut).

`pnpm -C /home/user/wt/takt test:scripts` (nach beiden Fach-Commits, vollständiger Lauf):
```
1..206
# tests 206
# suites 0
# pass 206
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7681.060727
```

Akzeptanzkriterium 2, erneut geprüft nach der Nacharbeit (derselbe Arbeitsbaum `/home/user/wt/010b`,
unverändert, siehe oben):
```
slice-scope: 30 changed file(s), all within "docs/slices/010b-lesepfade-oberflaeche.md"'s "Files allowed" list (19 pattern(s)).
exit: 0
```
Unverändert gegenüber der ersten Abgabe — die 010b-Spec hat keine mehrdeutigen bloßen Namen, also
betrifft sie weder der Blocker- noch der Major-Fix inhaltlich; die Prüfung selbst (Merge-Basis statt
Arbeitsbaum) läuft jetzt intern anders, mit demselben Ergebnis.

`pnpm -C /home/user/wt/takt gates` (Tail, wörtlich, nach beiden Fach-Commits, Commit `365b623`, clean
tree — dieser Bericht-Commit selbst kommt danach):
```
slice-scope: 10 changed file(s), all within "docs/slices/takt-010-scheibenumfang-luecken.md"'s "Files allowed" list (6 pattern(s)).
```
```
1..206
# tests 206
# suites 0
# pass 206
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11590.576058

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
dist/assets/index-DwK4D-x4.css                        39.98 kB │ gzip:   8.67 kB
dist/assets/index-BImqnPVW.js                        532.22 kB │ gzip: 156.05 kB │ map: 2,201.28 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
✓ built in 1.30s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree) at commit 365b623, tree 32b789473989…
```

Touched (Nacharbeit, zusätzlich zur ersten Abgabe):
- `scripts/slice-scope.mjs`, `scripts/slice-scope.test.mjs`
- `scripts/hooks/task-completed.mjs` (nur Docstring, Nit 6), `scripts/hooks/task-completed.test.mjs`
- `docs/slices/takt-010-scheibenumfang-luecken.md` (dieser Abschnitt, Minor-3-Korrektur oben)

Commits: `8b1a020` (Tests), `365b623` (Fix), dieser Commit (Bericht).

## Review findings

**Runde 1 — Opus 5.5, frischer Kontext, Perspektive Betrieb, auf `68564a2`:** nacharbeiten.
1 Blocker (Existenzprüfung der Wurzeldatei gegen den Arbeitsbaum, den der Diff selbst erzeugt), 1 Major
(mehrdeutiger bloßer Name: Wurzel gewinnt still), 2 Minor (zu pauschaler Satz im Bericht; Rückrichtung
905 → 905b ungetestet), 2 Nit (Zusicherung auf den gelesenen Spec-Dateinamen; Meldungen nennen nur „NNN").
Alle sechs behoben, siehe Bericht, Abschnitt „Nacharbeit nach Review und Codex“.

**Codex auf PR #27:** P2 (Wurzeldatei gegen den Arbeitsbaum geprüft) = derselbe Grund wie der Blocker, mit ihm
behoben. Auf `f8f55cd`: „Didn't find any major issues“.

**Runde 2 — Nachprüfung Opus 5.5 auf `f8f55cd`:** annehmen. Blocker, Codex-P2 und Major geprüft mit eigenen
Wegwerf-Tests (neu angelegte Wurzeldatei → Exit 1, auch CI-artig mit `GITHUB_HEAD_REF`; gelöschte Wurzeldatei
→ Exit 0; nicht auflösbare Basis → lokal übersprungen, in CI Exit 1). `test:scripts`: `# tests 206 / # pass 206
/ # fail 0`.

Offen, als Folgepunkt (minor, blockiert nicht): Die Mehrdeutigkeitsprüfung in `extractGlobs` greift nur, wenn
der exakte Verzeichnispfad existiert. „`apps/web/src/x.ts`, `package.json`“ meint vermutlich
`apps/web/package.json`; weil `apps/web/src/package.json` nicht existiert, gewinnt still die Wurzel-`package.json`.
Vorschlag: Warnung, wann immer eine Wurzeldatei eine Verzeichnis-Deutung schlägt, oder `package.json` unter
`apps/*`/`packages/*` als mehrdeutig behandeln.
