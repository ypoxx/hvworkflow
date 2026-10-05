# takt-047 — pnpm `minimumReleaseAge`: 7 Tage Mindestalter für neue Paketversionen, Ausnahme für Sicherheitspatches

**Status:** spec · **Risikoklasse:** niedrig (nur Konfiguration der Paketauflösung, ein Skripttest und Doku; kein Produktivcode, kein Vertrag, keine persistierten Daten, keine Rechte, kein Personenbezug, kein Deployment; die Lockdatei bleibt unverändert, belegt unter „Befund“. Leitplanken §4. Muss die Lockdatei doch neu aufgelöst werden oder ändert sich eine aufgelöste Version, ist das ein Befund: der Bau hält an und die Scheibe wird mittel wie takt-041) · ca. 1,5 AStd · **Lanes:** infra (Konfiguration), docs-plan (nur `docs/sicherheit/`)
**Rolle:** Mechaniker (builder); Review in frischem Kontext, Perspektive Security/Lieferkette (Modell nur in `.claude/agents/`, takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R11, R12; Plan 5.2 (Statische Sicherheitsanalyse); Bedrohungsmodell T-Q-T-01 (kompromittierte Abhängigkeit), Reviewer-Checkliste SC-10 (Lieferkette). Keine Rule ids aus `transitions.ts` (keine Fachregel).
**Quellen-IDs:** Plan `docs/produktplan-beta.md` Abschnitt 5, Eintrag takt-047; `docs/entscheidungsregister.md` „Vermerke 05.10.2026“ (Punkt minimumReleaseAge: „ja, 7 Tage, Ausnahme für Sicherheitspatches“)
**Depends on:** keine
**Perspektive:** Security/Lieferkette · **Glossar: neue Begriffe:** nein

## Befund (gelesen und ausprobiert auf `4e38512`)

- **pnpm-Version:** `package.json` `"packageManager": "pnpm@10.33.0+sha512…"`; die CI (`.github/workflows/gates.yml`, drei
  Jobs, `pnpm/action-setup@b906aff…` v4.3.0 ohne `version:`) und `nightly.yml` lesen die Version aus diesem Feld (Kommentar
  takt-001 in `gates.yml`). Lokal meldet `pnpm --version` `10.33.0` (`/opt/node22/lib/node_modules/pnpm`). Lockdatei
  `lockfileVersion: '9.0'`. `netlify.toml` ruft `pnpm install --frozen-lockfile`; welche pnpm-Version Netlify nimmt, ist
  hier nicht prüfbar (siehe „Offene Fragen“).
- **Unterstützung:** `minimumReleaseAge` und `minimumReleaseAgeExclude` gibt es ab pnpm 10.16; die installierte
  10.33.0 enthält beide (im gebündelten `dist/pnpm.cjs` nachgelesen, nicht vermutet). `minimumReleaseAgeExclude` nimmt
  Paketnamen, Namensmuster mit `*` (z. B. `@scope/binding-*`) und exakte Versionen `name@1.2.3` bzw. `name@1.2.3||1.2.4`;
  Namensmuster **mit** Version weist pnpm ab (`NAME_PATTERN_IN_VERSION_UNION`), Bereiche wie `^1.2.3` ebenfalls
  (`INVALID_VERSION_UNION`).
- **Ort:** `pnpm-workspace.yaml` (camelCase-Schlüssel, Liste als YAML). In einer Kopie des Arbeitsbaums mit angehängtem
  `minimumReleaseAge: 10080` meldet `pnpm config get minimumReleaseAge` `10080`. `.npmrc` gibt es im Repository nicht;
  sie wird auch nicht angelegt (eine Stelle für die Einstellung, die Ausnahmeliste braucht ohnehin YAML).
- **Wirkung, ausprobiert in der Kopie (Scratch, nicht im Repository):**
  1. `pnpm install --frozen-lockfile --ignore-scripts` mit der Einstellung: grün, nichts neu aufgelöst.
  2. `pnpm install --lockfile-only` mit Einstellung und Ausnahmeliste: Lockdatei byte-gleich (`diff` leer).
  3. `pnpm add -Dw oxlint@1.87.0` (am 05.10.2026 jünger als 7 Tage): pnpm verweigert mit Hinweis auf
     `minimumReleaseAgeExclude`. Mit `oxlint@1.87.0` in der Ausnahmeliste verweigert pnpm weiter, jetzt für die ebenso
     junge Plattformbindung `@oxlint/binding-darwin-arm64`; erst mit zusätzlichem `"@oxlint/binding-*"` löst es auf.
     Folge für das Verfahren: eine Ausnahme muss alle jungen Pakete desselben Patch-Releases nennen, nicht nur das
     Hauptpaket.
  4. `pnpm update --lockfile-only` mit Einstellung: läuft, löst nur ältere Versionen auf.
  Daraus: die Einstellung wirkt nur beim Auflösen (add, update, geänderte `package.json`), nicht bei
  `--frozen-lockfile`. Bereits gesperrte Versionen prüft sie nicht nachträglich.
- **Renovate/Dependabot:** keine Konfiguration im Repository (`git ls-files` ohne `renovate*`/`dependabot*`, kein
  `renovate`-Schlüssel in `package.json`). Es gibt also nichts abzugleichen; Abhängigkeiten werden heute nur in
  Scheiben angehoben (z. B. takt-041).
- **Vorbild für Ausnahmen:** `scripts/audit-exceptions.json` (Grund, Eigentümer, Ablauf; ein abgelaufener Eintrag
  blockiert selbst). Die Ausnahme hier folgt demselben Muster, steht aber neben der Einstellung in `pnpm-workspace.yaml`,
  damit es nur eine Quelle gibt.

## Ziel

1. `pnpm-workspace.yaml` setzt `minimumReleaseAge: 10080` (7 Tage in Minuten, Eigentümerentscheidung 05.10.2026) und
   `minimumReleaseAgeExclude: []` (leer, Platz für befristete Sicherheitsausnahmen), mit einem kurzen englischen
   Kommentar, der auf `docs/sicherheit/lieferkette-mindestalter.md` verweist.
2. Ein Skripttest in `pnpm test:scripts` (damit in `pnpm gates`) pinnt die Einstellung und das Format jeder Ausnahme.
3. Ein kurzes Verfahrensdokument beschreibt den Ausnahmeweg für einen dringenden Sicherheitspatch; Bedrohungsmodell
   T-Q-T-01 und Reviewer-Checkliste SC-10 nennen die neue Kontrolle.

### Format einer Ausnahme (verbindlich, der Test prüft es)

Jeder Listeneintrag steht auf einer Zeile mit Kommentar in genau dieser Form:

```yaml
minimumReleaseAgeExclude:
  - "hono@4.13.13" # GHSA-xxxx-xxxx-xxxx added 2026-10-06 expires 2026-10-13
```

- Eintrag: bevorzugt exakte Version(en) `name@x.y.z` (auch `name@x.y.z||x.y.w`); ein reines Namensmuster (z. B.
  `"@oxlint/binding-*"`) nur, wenn pnpm für ein Muster keine Version zulässt und die jungen Teilpakete desselben
  Releases sonst nicht auflösbar sind (Befund Punkt 3). Ein bloßer Paketname ohne Version und ohne `*` ist nicht
  erlaubt (er würde das Paket dauerhaft freistellen).
- Kommentar: eine Advisory-Kennung (`GHSA-xxxx-xxxx-xxxx` oder `CVE-JJJJ-NNNN…`), `added JJJJ-MM-TT`,
  `expires JJJJ-MM-TT`; `expires` liegt höchstens 7 Tage nach `added`.
- Läuft `expires` ab, wird der Eintrag entfernt (die Version ist dann ohnehin älter als 7 Tage). Ein abgelaufener
  Eintrag lässt den Test scheitern, wie ein abgelaufener Eintrag in `scripts/audit-exceptions.json` `audit:check`
  scheitern lässt.

### Ausnahmeweg (Inhalt von `docs/sicherheit/lieferkette-mindestalter.md`)

1. **Anlass:** ein veröffentlichter Sicherheitshinweis (GHSA/CVE) ab `moderate` betrifft ein Paket in `pnpm-lock.yaml`
   (meist sichtbar durch `pnpm audit:check`), und die behobene Version ist jünger als 7 Tage. Bequemlichkeit, neue
   Funktionen oder ein nicht sicherheitsbezogener Fix sind kein Anlass; dann wird gewartet.
2. **Wer entscheidet:** der Orchestrator legt eine eigene takt-Spec an (wie takt-041), die Hinweis, betroffene
   Version, Erreichbarkeit im Code und die Ausnahmeeinträge nennt; die Scheibe ist mindestens mittel (sie ändert eine
   Abhängigkeit) und wird in frischem Kontext mit Perspektive Security geprüft. Der Eigentümer wird im Bericht
   benachrichtigt; einer gesonderten Freigabe bedarf es nicht (Standard nach Vermerk 05.10.2026, siehe „Offene Fragen“).
   Ist der Hinweis nicht erreichbar oder ist ein Ausnahmeeintrag in `scripts/audit-exceptions.json` der kleinere
   Eingriff, ist Warten der Standard.
3. **Eintrag:** dieselbe Scheibe trägt die Ausnahme(n) im Format oben ein, hebt die Abhängigkeit an, prüft mit
   `pnpm install --frozen-lockfile` und `pnpm audit:check`.
4. **Rückbau:** nach `expires` entfernt die nächste Scheibe, die ohnehin baut, den Eintrag (Docs/Konfig-Commit,
   Zeile in `docs/folgeliste.md`, falls niemand baut); spätestens der Test erzwingt es.

## Nicht-Ziele

- Keine Abhängigkeit anheben oder absenken; `pnpm-lock.yaml` bleibt byte-gleich.
- Keine Renovate- oder Dependabot-Konfiguration einführen. Kommt später eine dazu, muss sie dasselbe Mindestalter
  setzen (Renovate `minimumReleaseAge: "7 days"`), sonst schlagen ihre Vorschläge am Install fehl; das ist dann deren
  Scheibe. Das Verfahrensdokument nennt es in einem Satz.
- Keine nachträgliche Altersprüfung der heute gesperrten Versionen; kein Prüfen der Einstellung in CI über den
  Skripttest hinaus; keine Änderung an Workflows, `netlify.toml`, `package.json` oder `.npmrc`.
- Kein Anwendungscode, kein Vertrag; kein Eintrag im Plan (der Planeintrag braucht keine Statuszeile).
- `pnpm` selbst nicht anheben (10.33.0 genügt).

## Files allowed

- `pnpm-workspace.yaml`
- `scripts/release-age.mjs` (Parser und Prüfung als exportierte Funktionen; optional, darf im Test stehen)
- `scripts/release-age.test.mjs`
- `docs/sicherheit/lieferkette-mindestalter.md` (neu)
- `docs/sicherheit/bedrohungsmodell.md` (nur Zeile T-Q-T-01, Spalte Kontrolle)
- `docs/sicherheit/reviewer-checkliste-sicherheit.md` (nur Zeile SC-10)
- diese Spec (Bericht, Review findings)

Die Lockdatei (pnpm-lock.yaml) steht bewusst nicht in der Liste, und package.json auch nicht; slice-scope schlägt also fehl, wenn sie sich ändert (Backticks hier absichtlich weggelassen, weil slice-scope jede Backtick-Spanne dieses Abschnitts als erlaubten Pfad liest).

## Akzeptanzkriterium

1. `pnpm-workspace.yaml` enthält `minimumReleaseAge: 10080` und `minimumReleaseAgeExclude: []` (oder eine leere
   Liste); `pnpm config get minimumReleaseAge` im Arbeitsbaum gibt `10080` aus (wörtlich im Bericht).
2. `pnpm install --frozen-lockfile` ist grün; `git diff --stat 4e38512 -- pnpm-lock.yaml` ist leer.
3. Der Builder belegt die Wirkung selbst, nicht durch Verweis auf diese Spec: ein `pnpm add` einer am Bautag weniger
   als 7 Tage alten Version in einer Wegwerfkopie (nicht committen) wird verweigert; die Meldung steht gekürzt im Bericht.
   Findet sich am Bautag keine passende Version, steht das so im Bericht.
4. `scripts/release-age.test.mjs` läuft in `pnpm test:scripts` und prüft gegen die echte `pnpm-workspace.yaml`:
   a. `minimumReleaseAge` ist genau `10080` (eine Zahl, kein String, genau ein Vorkommen);
   b. `minimumReleaseAgeExclude` ist vorhanden; jeder Eintrag erfüllt das Format oben (Version oder Namensmuster mit
      `*`, kein bloßer Name; Kommentar mit Advisory-Kennung, `added`, `expires`; `expires − added ≤ 7 Tage`);
   c. kein Eintrag ist abgelaufen, gemessen an einem in die Prüffunktion **übergebenen** Datum (der Test gegen die
      echte Datei übergibt das heutige Datum; die Fixture-Tests übergeben feste Daten, damit sie deterministisch sind).
   Fixture-Tests (Text als Zeichenkette, nicht als Datei) zeigen je Fall rot: Wert `1440`; Wert `"10080"`; Schlüssel
   fehlt; Eintrag ohne Kommentar; Kommentar ohne Advisory-Kennung; `expires` 8 Tage nach `added`; abgelaufener Eintrag;
   bloßer Paketname `hono`; sowie grün: leere Liste, ein gültiger Versions- und ein gültiger Mustereintrag.
   Der Parser ist zeilenbasiert und lehnt jede unbekannte Zeile innerhalb des Ausnahmeblocks ab (keine neue
   YAML-Abhängigkeit; eine neue Abhängigkeit wäre außerhalb der Files allowed).
5. `docs/sicherheit/lieferkette-mindestalter.md` beschreibt in höchstens einer Seite: Einstellung und Grund (T-Q-T-01:
   kompromittierte frische Versionen werden meist binnen Tagen entdeckt und zurückgezogen), dass sie nur beim Auflösen
   wirkt, das Ausnahmeformat und den Ausnahmeweg 1–4 oben, den Renovate-Satz. T-Q-T-01 und SC-10 nennen die Kontrolle
   mit Fundstelle (`pnpm-workspace.yaml`, `scripts/release-age.test.mjs`); der Status von T-Q-T-01 bleibt „teilweise“
   (SBOM aus 074 fehlt weiter).
6. `pnpm gates` (mit Postgres-Variablen wie in takt-041) ist grün, einschließlich `slice-scope`; der Schluss steht unter
   „Bericht“. Keine Oberfläche, also kein Screenshot.

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: niedrig
Ausgelöst: [x] Konfiguration (nur Paketauflösung, nicht Laufzeit) [x] Dokumentation · sonst nichts
Perspektive und Rolle: Security/Lieferkette, Reviewer in frischem Kontext. Nachweise: Kriterien 1–6.
Offene Entscheidung: keine Registerzeile (Vermerk 05.10.2026).

## Aufwand

Etwa 1,5 AStd: Konfiguration und Doku 0,5 AStd, Parser und Test mit Fixtures 0,75 AStd, Wirkprobe, Gates und Bericht
0,25 AStd.

## Offene Fragen

1. **Wer entscheidet eine Ausnahme:** die Spec setzt als Standard den Orchestrator mit Security-Review und
   Benachrichtigung des Eigentümers (gedeckt durch „ich folge allen deinen Empfehlungen“, 05.10.2026). Will der
   Eigentümer jede Ausnahme selbst freigeben, ändert sich nur Schritt 2 des Verfahrens.
2. **Netlify:** ob der Netlify-Build pnpm 10.33.0 aus `packageManager` nimmt, ist hier nicht prüfbar. Mit
   `--frozen-lockfile` wirkt die Einstellung dort ohnehin nicht; eine ältere pnpm-Version würde den unbekannten
   Schlüssel höchstens mit Warnung übergehen. Kein Bau-Hindernis; der Reviewer kann es im nächsten Netlify-Log nachsehen.
3. **Gesperrte junge Versionen:** ob `pnpm-lock.yaml` am Bautag Versionen jünger als 7 Tage enthält, prüft diese
   Scheibe nicht (Nicht-Ziel); bei Bedarf eine Zeile in `docs/folgeliste.md`.

## Bericht

```
Slice: takt-047-minimum-release-age
Done: Einstellung minimumReleaseAge 10080 und leere Ausnahmeliste in pnpm-workspace.yaml; Parser scripts/release-age.mjs mit Skripttest (13 Tests); Verfahrensdokument, T-Q-T-01 und SC-10 ergaenzt
Evidence: pnpm gates auf 45ac3dc (sauberer Baum, Postgres-Variablen TEST_DATABASE_URL, TEST_RUNTIME_DATABASE_URL, HV_DB_RUNTIME_ROLE), Exit 0; Ausgabe unten
Open: keine; pnpm-lock.yaml und package.json unveraendert (git diff --stat 4e38512 leer)
Touched: pnpm-workspace.yaml, scripts/release-age.mjs, scripts/release-age.test.mjs, docs/sicherheit/lieferkette-mindestalter.md, docs/sicherheit/bedrohungsmodell.md, docs/sicherheit/reviewer-checkliste-sicherheit.md, diese Spec
```

`pnpm config get minimumReleaseAge`, woertlich:

```
10080
```

Rot vor der Konfiguration (Parser vorhanden, pnpm-workspace.yaml noch ohne Einstellung; 12 pass, 1 fail), Anfang:

```
TAP version 13
# Subtest: real pnpm-workspace.yaml passes with today as the reference date
not ok 1 - real pnpm-workspace.yaml passes with today as the reference date
  ---
  duration_ms: 9.944754
  type: 'test'
  location: '/home/user/wt/takt047/scripts/release-age.test.mjs:20:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected
    
    + [
    +   'minimumReleaseAge must occur exactly once, found 0',
    +   'minimumReleaseAgeExclude is missing'
    + ]
    - []
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected:
  actual:
    0: 'minimumReleaseAge must occur exactly once, found 0'
    1: 'minimumReleaseAgeExclude is missing'
  operator: 'deepStrictEqual'
```

Danach gruen: `# pass 13`, `# fail 0` fuer `node --test scripts/release-age.test.mjs`.

Wirkprobe (Kriterium 3), gekuerzt, in Wegwerfkopie ausserhalb des Repositorys, `pnpm add -Dw hono@4.13.13` (veroeffentlicht 2026-10-04):

```
This error happened while installing a direct dependency of /tmp/claude-0/scratchcopy

The latest release of hono is "4.13.13". Published at 10/4/2026
...
If you want to install the matched version ignoring the time it was published, you can add the package name to the minimumReleaseAgeExclude setting.
```

`pnpm gates` auf `45ac3dc`, Schluss, woertlich:

```
dist/assets/index-B5FacydS.css                        44.49 kB │ gzip:   9.45 kB
dist/assets/index-CPbsjZGL.js                        764.46 kB │ gzip: 224.13 kB │ map: 3,162.87 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.99s
mark-test-run: wrote /home/user/wt/takt047/.claude/state/last-test-run (clean tree) at commit 45ac3dc, tree 6255494020f0…
```

### Nachbesserung nach Review (Befunde 1 bis 5)

Parser strikt: der Ausnahmeblock endet nur an einem neuen Top-Level-Schluessel; jede andere nicht leere Zeile muss eine exakte Eintragszeile sein (Spalte-0-Sequenz, Spalte-0-Kommentar, `---` sind Fehler); `added` darf nicht nach heute liegen; Muster brauchen ein woertliches Praefix (voller Scope plus `/` oder Namensstamm ab 3 Zeichen); CR und Dokumentmarker sind Fehler; Rot-Tests pruefen die Fehlermeldung.

Rot auf dem alten Parser (neue Tests, `node --test scripts/release-age.test.mjs`):

```
not ok 7 - red: nested key only
not ok 15 - red: added in the future
not ok 17 - red: over-broad patterns
not ok 19 - red: unindented sequence (column-0 bare name)
not ok 20 - red: column-0 comment or document marker between entries
not ok 21 - red: second document
not ok 22 - red: entries after an inline empty list
not ok 23 - red: CRLF entry line
# pass 16
# fail 8
```

Gruen nach der Korrektur: `# pass 24`, `# fail 0`. `pnpm gates` auf `17d57fd` (sauberer Baum), Exit 0, `pnpm test:scripts` `# pass 342`, `# fail 0`, Schluss:

```
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.88s
mark-test-run: wrote /home/user/wt/takt047/.claude/state/last-test-run (clean tree) at commit 17d57fd, tree 17c2537cf6e6…
```

### Nachbesserung 2: quoted Schluessel

Jedes Top-Level-Vorkommen von `minimumReleaseAge` und `minimumReleaseAgeExclude`, auch in einfachen oder doppelten Anfuehrungszeichen, zaehlt zu "genau einmal"; die quoted Form ist ausserdem ein eigener Fehler ("quoted key not allowed").

Rot auf dem Parser davor (`node --test scripts/release-age.test.mjs`):

```
not ok 24 - red: quoted duplicate or quoted-only keys
  error: 'expected an error matching /minimumReleaseAge must occur exactly once, found 2/, got []'
# pass 24
# fail 1
```

Gruen danach: `# pass 25`, `# fail 0`. Letzter Code-Commit, auf dem `pnpm gates` lief: `d05cb60` (sauberer Baum), Exit 0, `pnpm test:scripts` `# pass 343`, `# fail 0`, Schluss:

```
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.86s
mark-test-run: wrote /home/user/wt/takt047/.claude/state/last-test-run (clean tree) at commit d05cb60, tree a8fa8092a396…
```

## Review findings
