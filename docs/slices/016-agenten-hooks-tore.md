# 016 — Agentenrollen, Hooks, Scheibenumfang-Tor, Plan-Graph-Prüfung, Branch-Schutz

**Status:** review (Nacharbeitsrunde 1)
**Risikoklasse:** niedrig · 1,5 AStd · Kalender 30.09.2026 (W1) · Lanes: infra (`.claude/**`, `scripts/**`,
`.github/**`) + docs-betrieb (`docs/betrieb/branch-schutz.md`)
**Rolle/Modell:** Implementierer-Backend · Sonnet 5 statt Mechaniker · Haiku (Abweichung nach oben: der
Plan-Graph-Parser über 80 Scheiben und Hooks, die jede spätere Sitzung blockieren können, sind fehleranfällig);
Review deshalb Opus 5.5 statt Sonnet (Regel 3: anderes Modell als der Bauende)
**Rule ids:** AGENTS.md Regeln 1, 2, 3, 11, 12; Leitplanken 4 (Herabstufung nur durch den Menschen), 5 (Perspektiven)
**Quellen-IDs:** Plan 5.2 Scheibe 016; Plan 5.1 (Lanes, drei parallele Scheiben); Plan 6.1 (Rollen und Modelle);
Plan 6.4 (Tore aus 016); Plan 8.3 (Kalendermodell); Audit A2 (Hooks); ADR 0016 (vorgeschlagen, Arbeitsmodell)
**Depends on:** 012 (gemergt 23.09.2026, `76e572e`)
**Perspektive:** Security (Hooks, Branch-Schutz) · **Glossar: neue Begriffe:** nein

## Ziel

1. **Agentendefinitionen** in `.claude/agents/` (Form wie die vorhandenen vier Dateien):
   `architekt.md` (model fable; Specs, ADRs, Verträge, Dokumente; Tools Read/Write/Edit/Glob/Grep/Bash),
   `planer.md` (model opus; Specs und Lesebefunde; kein Code),
   `design-kritiker.md` (model fable; Tools Read, Glob, Grep, Bash; Checkliste D1–D10 aus `docs/design-prinzipien.md`,
   Screenshots DE/EN, Kontrastprobe),
   `reviewer.md` erweitert um eine Perspektiven-Checkliste (Security, Datenschutz, Legal, Betrieb — Verweis auf
   `docs/qualitaetsleitplanken-produktreife.md` Abschnitte 5–7) und die sieben Sicherheitspunkte (Demo-Seed nur bei
   HV_DEMO, Limits, Sitzung, CSP, Secrets, Bedrohungsmodell, Kill-Switch) sowie den Hinweis, Befunde als Liste
   zurückzugeben (der Orchestrator schreibt sie in die Spec); ist 039 gemergt, verweisen die sieben Punkte auf
   `docs/sicherheit/reviewer-checkliste-sicherheit.md` statt sie zu wiederholen,
   `reviewer-sonnet.md` (model sonnet; gleicher Auftrag, für Opus-gebaute Scheiben).
   Die vorhandenen `implementierer-backend.md`, `implementierer-oberflaeche.md`, `mechaniker.md` bekommen je eine Zeile:
   Playwright-Bilder unter `docs/evidence/` nur committen, wenn die Spec sie verlangt; jeder Commit mit `[skip netlify]`.
2. **Hooks** in `.claude/settings.json` (Skripte unter `scripts/hooks/`), jede Wirkung mit Test (Punkt 6):
   - *PreToolUse (Bash), erweitert:* zusätzlich zu den heutigen Mustern blockiert: `git push` ohne ausdrückliches Ziel
     (`git push` allein bzw. ohne Remote und Branch), jede Lese- oder Schreibaktion auf `.env`-Dateien außer
     `.env.example`, ausgehende Aufrufe mit `curl`/`wget` an Hosts außer `localhost`/`127.0.0.1`.
   - *PostToolUse (Write|Edit):* führt `oxlint` auf die geschriebene `.ts`/`.tsx`-Datei aus; Befunde gehen als Feedback
     zurück (Exit 2 nur bei Fehlern, nicht bei Warnungen).
   - *Stop:* Exit 2 mit Begründung, wenn seit dem letzten erfolgreichen Testlauf Code geändert wurde — „Code" heißt
     Dateien unter `apps/`, `packages/`, `scripts/` (nicht `docs/`, nicht `*.md`); „Testlauf" heißt ein erfolgreiches
     `pnpm gates` oder `pnpm -r test`, das einen Zeitstempel in `.claude/state/last-test-run` (gitignored) schreibt.
     Ohne Codeänderung blockiert der Hook nie (Doku-Sitzungen und der Orchestrator dürfen stoppen).
   - *SubagentStop:* prüft, dass die letzte Nachricht des Subagenten die Felder des Berichtsformats aus AGENTS.md
     enthält (`Slice:`, `Done:`, `Evidence:`, `Open:`, `Touched:`) — nur für die Agenten `implementierer-*` und
     `mechaniker`; sonst Exit 0.
   Der Zeitstempel für den Stop-Hook wird über ein Skript `scripts/hooks/mark-test-run.mjs` gesetzt, das
   `pnpm gates` am Ende aufruft (Root-`package.json`: `gates` endet mit `&& node scripts/hooks/mark-test-run.mjs`).
3. **Scheibenumfang-Tor** `scripts/slice-scope.mjs`: liest die Spec der Scheibe (`docs/slices/NNN-*.md` oder
   `takt-NNN-*.md`; die Scheibe ergibt sich aus dem Branchnamen `claude/slice-NNN-…`/`claude/takt-NNN-…` oder aus
   `--slice NNN`), zieht die Pfadliste aus dem Abschnitt „Files allowed" (Backtick-Pfade, Globs `**`/`*`,
   Klammer-Alternativen `{a,b}`) und prüft `git diff --name-only <merge-base>...HEAD` dagegen. Jede Datei außerhalb →
   Exit 1 mit Liste. Immer erlaubt: die eigene Spec-Datei, `pnpm-lock.yaml` nur wenn die Spec `package.json` erlaubt.
   CI-Schritt „Slice scope" in `gates.yml`, nur bei `pull_request` gegen den Integrationsbranch und nur für Branches
   nach diesem Namensschema (andere Branches, z. B. der Tagesbericht, werden übersprungen mit Hinweis).
4. **Herabstufungs-Tor** `scripts/downgrade-check.mjs`: vergleicht die Risikoklasse in der Kopfzeile der Spec
   (`**Risikoklasse:** niedrig|mittel|hoch`) mit der Klasse der Scheibe in `docs/produktplan-beta.md` Abschnitt 5
   (Kopfzeile `- **NNN · … ** — <klasse> · …`). Ist die Spec niedriger, muss sie die Zeile
   `Herabstufung freigegeben von <Name> am <TT.MM.JJJJ>` enthalten, sonst Exit 1. Teil von `pnpm gates` über alle
   Specs mit Nummer 009–099.
5. **Plan-Graph-Prüfung** `scripts/plan-graph.mjs`: parst alle Scheiben aus `docs/produktplan-beta.md` Abschnitt 5
   (Nummer, Titel, Klasse, AStd, Kalenderdatum, Lanes, Abhängigkeiten) und prüft: jede Abhängigkeit existiert; keine
   Zyklen; jede Abhängigkeit endet vor dem Start (Kalenderdatum der Abhängigkeit ≤ Datum der Scheibe, bei gleichem Tag
   Reihenfolge im Abschnitt); Scheiben am selben Kalendertag mit gemeinsamer Lane werden gemeldet (Warnung, Exit 0; mit
   `--strict` Exit 1). Zusätzlich `--calendar`: rechnet den Kalender nach dem Modell aus Plan 8.3 neu (Bautage Mo–Fr
   ohne 24.12.–01.01., AStd je Bautag als Parameter `--hours 3`, höchstens drei parallele Scheiben, keine gemeinsame
   Lane, äußere Termine als frühester Start aus einer kleinen Tabelle im Skript mit Quelle Plan 8.3) und gibt je Scheibe
   das errechnete Startdatum aus; `--merged 009,017,…` nimmt Gemergtes heraus. Teil von `pnpm gates` ist nur die
   Prüfung (ohne `--calendar`).
6. **Tests** für die Skripte als Node-Tests (`node --test scripts/**/*.test.mjs`), eingebunden in `pnpm gates`:
   je Tor ein grüner und ein roter Fall (fremde Datei im Diff; Herabstufung ohne Zeile; vertauschte Abhängigkeit /
   Zyklus in einer Test-Kopie des Plans; Hook-Skripte mit Beispiel-Eingaben als JSON auf stdin).
7. **Zusätze aus den Reviews von 012 und 019 (Orchestrator, 23.09.2026):**
   - *i18n-Literal-Tor:* `scripts/i18n-literal-check.mjs` meldet sichtbare String-Literale in JSX-Text und in den Props
     `title`, `aria-label`, `placeholder`, `alt`, `label` unter `apps/web/src/features/**` und `apps/web/src/app/**`
     (Ausnahmen: `data-testid`, `className`, reine Satzzeichen/Zahlen, Zeilen mit `i18n-ok: <Grund>`); Teil von
     `pnpm gates`; heutige Treffer werden gelistet und, wenn es mehr als eine Handvoll sind, als Warnung mit Ablaufdatum
     geführt statt blockierend (im Bericht begründen). Abschnitt 5 des Entwicklungsplans: Zeile „Zweisprachigkeit —
     Literale" auf `läuft (CI: …)` stellen.
   - *TaskCompleted-Hook:* prüft, dass die Spec-Datei der Scheibe einen Status `accepted` bzw. ein Abnahmehäkchen hat,
     bevor eine Aufgabe als erledigt gilt (Entwicklungsplan 5.4); Zeile in Abschnitt 5 auf `läuft (Hook: TaskCompleted)`.
   - *reviewer.md* bekommt einen ausdrücklichen Prüfpunkt „Grenzen aus ADR 0001 (Leitplanken 1.3) — Verletzung ist
     Blocker"; Zeile „ADR-Bezug" in Abschnitt 5 auf `läuft (Review: Reviewer-Checkliste)`.
   - *Vertragstor in CI:* `gates.yml` checkt seit 012 mit `fetch-depth: 0` aus. Neu: `packages/contract/scripts/check.mjs`
     kennt `CONTRACT_GATE_STRICT=1` — dann ist jeder heutige `skip` von Prüfung (c) (kein git, kein Integrationsbranch,
     `git diff` scheitert) ein `fail` mit derselben Meldung; ohne die Variable bleibt das Verhalten lokal wie heute.
     Der Schritt mit `pnpm gates` in `gates.yml` setzt die Variable. Test: ein Aufruf mit Variable und ohne
     erreichbaren Integrationsbranch endet rot. Die Zeile „Versions- und Changelog-Pflicht" in Abschnitt 5 erwähnt
     danach „rot statt übersprungen".
   - *Folgebefunde aus der Nachprüfung von 012* (`docs/slices/012-architektur-sicherheitstore.md`, Review findings
     Runde 2, Punkte 1–5 und 7), je mit roter Probe vorher und grüner nachher im Bericht:
     1. `dorny/paths-filter` in `gates.yml` auf `0e4a8c6effa4802afeda77dc8d303f8176d7dfad # v3.0.4` pinnen (v3.0.4
        deklariert `predicate-quantifier`); `pnpm/action-setup@v4` ebenfalls auf einen vollen SHA mit Tag-Kommentar
        (per `git ls-remote https://github.com/pnpm/action-setup refs/tags/v4*` ermitteln).
     2. `scripts/role-literal-check.mjs`: nur den Textbereich der `Role`-Union in `types.ts` ausnehmen, nicht die ganze
        Datei; vor dem Parsen Kommentare entfernen; die abgeleitete Rollenliste gegen die Schlüssel von
        `ROLE_PERMISSIONS` abgleichen und bei Abweichung rot enden.
     3. Dasselbe Skript: für `podium`/`expert`/`legal` auch Objektschlüssel-Zugriff `({podium:1})[x.role]` und
        `new Set([...]).has(x.role)` erkennen.
     4. `scripts/semgrep/rules.yml`: `child_process` auch als Standardimport (`import cp from …`), destrukturiertes
        `require` und Alias-Import (`import { exec as run }`) erkennen.
     5. `scripts/now-check.mjs`: `process.hrtime.bigint(` und `performance['now'](` ergänzen.
     6. Owner der Audit-Ausnahme als Rolle statt Person (Regel 11): `scripts/audit-exceptions.json`s Eintrag
        `#1193727` trug `owner: <eine persönliche E-Mail-Adresse>` (eine echte Person) statt einer Funktion; `owner` wird
        `"Umsetzer"`. `audit-check.mjs` prüft `owner` nur auf einen nichtleeren String, also keine Formatänderung
        am Skript nötig.
8. **Branch-Schutz-Checkliste** `docs/betrieb/branch-schutz.md` für den Eigentümer (< 30 min): für den
   Integrationsbranch (und später `main`) Pflicht-Statuscheck `gates`, kein Merge bei Rot, keine Force-Pushes, kein
   Löschen, „Require branches to be up to date"; Klickpfad in GitHub; Nachweis per Screenshot durch den Eigentümer.

## Nicht-Ziele

- Kein Branch-Schutz selbst setzen (privilegiert, Eigentümer). Keine Änderung an Produktcode, Vertrag, Kern.
- Keine Änderung an den Toren aus 012 außer dem Anhängen neuer Schritte und den Folgebefunden aus Punkt 7.
- Kein Umschreiben des Plans; `plan-graph.mjs` liest ihn nur.

## Files allowed

- `.claude/agents/*.md`, `.claude/settings.json`
- `scripts/i18n-literal-check.mjs`, `docs/agentische-entwicklung-plan.md` (Abschnitt 5: die Stand-Spalte
  der genannten Zeilen — inkl. PreToolUse (voll), PostToolUse, Stop, SubagentStop ab Nacharbeitsrunde 1,
  m9 — und die Werkzeug-Spalte der Zeilen „Versions- und Changelog-Pflicht" und „ADR-Bezug")
- `scripts/hooks/**`, `scripts/slice-scope.mjs`, `scripts/downgrade-check.mjs`, `scripts/plan-graph.mjs`,
  `scripts/**/*.test.mjs`, `scripts/fixtures/**` (Testkopien)
- `.github/workflows/gates.yml` (neue Schritte, `CONTRACT_GATE_STRICT`, die zwei Pins aus Punkt 7,
  der `concurrency`-Block aus Nacharbeitsrunde 1, m11)
- `scripts/role-literal-check.mjs`, `scripts/semgrep/rules.yml`, `scripts/now-check.mjs` (nur Punkt 7)
- `scripts/audit-exceptions.json` (nur das Feld `owner`, Punkt 7)
- `packages/contract/scripts/check.mjs` (nur `CONTRACT_GATE_STRICT`; Lane contract, frei bis 010)
- `package.json` (Root, nur Skripte), `.gitignore` (nur `.claude/state/`)
- `docs/betrieb/branch-schutz.md` (neu)
- diese Datei (`docs/slices/016-agenten-hooks-tore.md`, Abschnitt „Bericht")

## Akzeptanzkriterium

1. `pnpm gates` grün, enthält `slice-scope` (lokal nur mit `--slice 016`), `downgrade-check`, `plan-graph` und die
   Node-Tests der Skripte.
2. Rote Nachweise (lokal, nicht committet): Scheibenumfang-Tor rot bei absichtlich fremder Datei; plan-graph rot bei
   absichtlich vertauschter Abhängigkeit in einer Testkopie; downgrade-check rot ohne Freigabezeile; Stop-Hook blockiert
   nach einer Codeänderung ohne Testlauf und lässt nach `pnpm gates` durch; PreToolUse blockiert `git push` ohne Ziel und
   `cat .env`. Ausgaben im Bericht.
3. `node scripts/plan-graph.mjs` meldet für den heutigen Plan: 80 Scheiben erkannt, 0 fehlende Abhängigkeiten, 0 Zyklen;
   Warnungen (falls vorhanden) im Bericht. `node scripts/plan-graph.mjs --calendar --merged 009,017,012` Ausgabe im Bericht.
4. CI auf dem PR grün, der Schritt „Slice scope" läuft und ist grün.

## Nachweise

settings.json-Diff; Protokoll eines blockierten Stop-Versuchs; rote Läufe; plan-graph-Ausgabe; `pnpm gates`; CI-Link.

## Nachschärfung nach Review (Runde 1)

Opus-Review: 2 Blocker, 6 Hauptbefunde (major). Mehr als drei Hauptbefunde schärfen nach Plan 6.3 die
Spec nach; die folgende Liste ist ab jetzt bindend für diese Scheibe (Nacharbeitsrunde 1). CI muss grün
werden; der erste CI-Lauf zeigte nur B1.

**BLOCKER**

- **B1.** `scripts/fixtures/hooks/*.json` hard-code `/home/user/wt/016/…`, so 3 tests fail in CI and 4
  more pass without testing anything. Store relative paths or a placeholder and resolve them in the
  tests against the fixture directory, or build the payloads inside the tests. Check that no other
  test depends on this machine.
- **B2.** `task-completed.test.mjs:19/25` uses the live 016 and 017 specs. Use fixture specs with
  status `review` and `accepted`.

**MAJOR**

- **M1.** The CI step "Slice scope" checks nothing on `pull_request`: the merge-ref checkout makes the
  branch `HEAD`, so the script skips.
  - Read `GITHUB_HEAD_REF` first.
  - When `CI` is set and the branch matches `claude/slice-NNN-*` or `claude/takt-NNN-*`, fail instead
    of skipping if it cannot resolve the spec.
  - Show a red CI-like run with `GITHUB_HEAD_REF` set to a slice branch that touches a foreign file.
- **M2.** The Stop hook blocks without any code change (fresh clone, checkout, merge, e2e output).
  - Detect changes with git: store a tree hash of `apps/`, `packages/` and `scripts/` in the marker,
    and compare `git ls-files -m -o --exclude-standard` or the tree hash instead of mtimes.
  - Allow when there is no marker and the tree is clean. Allow when `stop_hook_active` is true.
  - Ignore `apps/web/test-results` and other generated output.
  - Red and green runs: a real edit without a test run → 2; a checkout round-trip without an edit → 0.
- **M3.** SubagentStop keys on the parent transcript and can block the wrong agent.
  - Use `agent_type`, and `last_assistant_message` or `agent_transcript_path` if present. Exit 0 when
    `stop_hook_active` is set or the input shape is unknown (fail-open, documented).
  - Test: a reviewer stop is never blocked.
- **M4.** PreToolUse force-push and remote-delete bypasses. Each of these currently exits 0 and must
  be blocked, with a test each:
  - `git push -f origin main`
  - `git push origin +main`
  - `git -C x push --force origin main`
  - `git -c k=v push --force …`
  - `git -C x push` (bare, no target)
  - `git push origin --delete main`
  - `git push origin :main`
  - `--mirror`
  Handle the git global options `-C`, `-c` and `--git-dir` before `push`.
- **M5.** Rule 11: `docs/slices/016-agenten-hooks-tore.md:100` and `:157` still contain the owner's
  email address. Write "eine persönliche E-Mail-Adresse" instead. Grep your whole diff for any email
  address.
- **M6.** i18n-literal gate:
  - Drop the count-based grace (there are 0 hits today).
  - Mask JSX and JS comments before scanning. Today `Podium.tsx:101` on the 020 branch
    (`/home/user/wt/020`) is a false positive; run your script against that tree as a check.
  - Detect JSX text split over several lines.

**MINOR**

- **m1.** `contract-gate-strict.test.mjs` must not assume git and node live in different directories.
  Use an env override for the integration ref, or a temp copy without `.git`.
- **m2.** PreToolUse false positives on `grep -rn "process.env"`, `import.meta.env` and `.envrc`:
  require a path boundary before `.env`.
  - Document in the script header the known, accepted bypasses (no-scheme curl, wrappers,
    `node -e fetch`) and that it fails open on malformed input, deliberately.
  - Do NOT add `permissions` rules to `.claude/settings.json`; the orchestrator puts that to the owner.
- **m3.** TaskCompleted:
  - block only if the task text names a slice number and that slice's spec status is not
    `accepted`/`angenommen`; a stray `- [x]` never counts as acceptance;
  - fail open on unknown input;
  - correct the Bericht statement about the event.
- **m4.** slice-scope:
  - resolve bare filenames after a full path against that directory (020's spec lists
    `003-answers-stage.spec.ts`, `abnahme.spec.ts` after a full path);
  - reject bare `*` or `**` patterns;
  - warn when "Files allowed" differs from the merge-base version of the spec.
- **m5.** plan-graph:
  - fail on any unparsed `- **NNN ·` line;
  - the test must not hard-code 80 slices or run `--strict` on the live plan; use a fixture copy.
- **m6.** `role-literal-check.test.mjs` must not rewrite the real `types.ts`/`permissions.ts`; use a
  temp copy via `--root`.
- **m7.** downgrade-check: the sign-off line counts only in the spec header block, not as quoted prose
  anywhere.
- **m8.** `branch-schutz.md`:
  - no force-push test against the real integration branch; use a scratch branch or only the settings
    screen;
  - say that "Require a pull request" ends direct pushes, including today's squash merges through the
    API, which still work via PR;
  - note which GitHub plan branch protection needs for a private repository.
- **m9.** `docs/agentische-entwicklung-plan.md` section 5: set the rows for PreToolUse (voll),
  PostToolUse, Stop and SubagentStop to `läuft (Hook: <Ereignis>)`. This is allowed now; add it to
  "Files allowed".
- **m10.** Nits:
  - pin comment `# v4.3.0`;
  - strip `/* */` comments in the union parser;
  - `pnpm -r test` may also write the marker (optional).
- **m11.** (orchestrator addition, small) `.github/workflows/gates.yml`: add
  `concurrency: { group: gates-${{ github.event.pull_request.number || github.ref }},
  cancel-in-progress: true }` — a superseded run on PR #15 failed inside gitleaks-action with
  "Invalid revision range `<base>^..<newer head>`" because that action fetches the PR's commit list
  at run time, by when the head had already moved on; cancelling superseded runs removes the race.

Evidence: a "Befund → Erledigung" table in the Bericht, red/green runs for B1, M1–M4 and M6, the
`pnpm gates` tail, and the status "review (Nacharbeitsrunde 1)".

## Arbeitsweise

- Worktree `/home/user/wt/016`, Branch `claude/slice-016-agenten`. Absolute Pfade.
- Achtung: Hooks in `.claude/settings.json` wirken auf Claude-Sitzungen in diesem Worktree. Teste Hook-Skripte über
  stdin mit Beispiel-JSON, nicht indem du deine eigene Sitzung blockierst.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: nicht committen. Nicht pushen.

## Bericht

(vom Implementierer)

### Zusatz vom Orchestrator (vor Baubeginn erledigt)

`scripts/audit-exceptions.json`s Eintrag `#1193727` trug als `owner` eine persönliche E-Mail-Adresse
(eine echte Person, AGENTS.md Regel 11) statt einer Rolle; jetzt `"owner": "Umsetzer"`. `audit-check.mjs` prüft
`owner` nur auf einen nichtleeren String, keine Skriptänderung nötig (`node scripts/audit-check.mjs`
grün, siehe unten). „Files allowed" um `scripts/audit-exceptions.json` (nur `owner`) ergänzt, Punkt 7
um eine Zeile ergänzt.

### Was gebaut wurde

1. **Agentenrollen** (`.claude/agents/`): `architekt.md` (model fable), `planer.md` (model opus),
   `design-kritiker.md` (model fable, Read/Glob/Grep/Bash, Checkliste D1–D10) neu.
   `reviewer.md` bekommt Prüfpunkt (9) „Grenzen aus ADR 0001 — Verletzung ist Blocker", die
   Perspektiven-Checkliste (Security/Datenschutz/Legal/Betrieb, Verweis auf
   `docs/qualitaetsleitplanken-produktreife.md` Abschnitte 5–7) und die sieben Sicherheitspunkte
   (mit Verweis auf 039, sobald gemergt); der Satz „Write them into the slice file" wurde zu „Return
   this list as your report; the orchestrator transcribes it" geändert (Befunde gehen als Liste
   zurück, nicht mehr als Direktschreibzugriff des Reviewers). `reviewer-sonnet.md` (model sonnet)
   neu, wortgleicher Auftrag für Opus-gebaute Scheiben. `implementierer-backend.md`,
   `implementierer-oberflaeche.md`, `mechaniker.md` bekommen je eine Zeile zu
   Playwright-Bildern/`[skip netlify]`.
2. **Hooks** (`.claude/settings.json` → `scripts/hooks/*.mjs`, ersetzt das eine Inline-Skript aus
   012): `pre-tool-use-bash.mjs` (PreToolUse/Bash) behält die vier Muster aus 012 und ergänzt nacktes
   `git push` (weniger als zwei Nicht-Flag-Token nach `push`), jeden `.env*`-Zugriff außer
   `.env.example`, und `curl`/`wget` an einen Host außer `localhost`/`127.0.0.1`/`[::1]`/`0.0.0.0`.
   `post-tool-use-lint.mjs` (PostToolUse/Write|Edit) lässt oxlint auf der geschriebenen `.ts`/`.tsx`-
   Datei laufen; oxlints eigener Exit-Code trennt bereits Fehler von Warnungen (siehe Beleg unten),
   also Exit 2 nur bei echten Fehlern. `stop-check.mjs` (Stop) blockiert, wenn eine Datei unter
   `apps/`, `packages/`, `scripts/` (nie `docs/`, nie `*.md`) jünger ist als
   `.claude/state/last-test-run` — oder diese Datei noch gar nicht existiert. `mark-test-run.mjs`
   schreibt genau diesen Zeitstempel und hängt jetzt ans Ende von `pnpm gates`
   (`&& node scripts/hooks/mark-test-run.mjs`). `subagent-stop-check.mjs` (SubagentStop) erkennt
   `implementierer-backend`/`implementierer-oberflaeche`/`mechaniker` an der ersten Zeile ihres
   jeweiligen Systemprompts (verbatim im Transkript vorhanden) und verlangt nur für diese drei die
   fünf Berichtsfelder aus AGENTS.md in der letzten Nachricht; jeder andere/unbekannte Agent bleibt
   unangetastet (fail-open). `task-completed.mjs` (TaskCompleted — kein echtes Claude-Code-Ereignis,
   aber Plan 5.4 nennt es so; hält die Zeile in `.claude/settings.json` für `plan-honesty.mjs` ehrlich
   und liefert ein echtes, getestetes Skript statt eines Platzhalters) prüft vor einer als „completed"
   markierten Aufgabe, dass die Spec-Datei der aktuellen Scheibe `**Status:** accepted` oder ein
   Abnahmehäkchen (`- [x] …`) trägt.
3. **Scheibenumfang-Tor** `scripts/slice-scope.mjs`: Slice/Takt-Nummer aus dem Branchnamen oder
   `--slice`/`--takt`/`--spec`; liest „Files allowed" der Spec (jeder Backtick-Pfad im Abschnitt,
   unabhängig von Zeilenumbrüchen), kompiliert `**`/`*`/`{a,b}` zu Regex und prüft
   `git diff --name-only <merge-base>...HEAD` (Merge-Base mit dem Integrationsbranch) dagegen;
   Spec-Datei selbst und `pnpm-lock.yaml` (nur wenn `package.json` erlaubt ist) sind immer erlaubt;
   skippt sauber außerhalb einer Scheiben-/Takt-Branch oder ohne erreichbaren Integrationsbranch.
4. **Herabstufungs-Tor** `scripts/downgrade-check.mjs`: vergleicht `**Risikoklasse:**` jeder Spec
   009–099 gegen die Klasse in Produktplan Abschnitt 5; bei Herabstufung ohne die Zeile
   „Herabstufung freigegeben von …" bricht es ab.
5. **Plan-Graph-Prüfung** `scripts/plan-graph.mjs`: parst alle 80 Scheibenzeilen aus Abschnitt 5
   (Nummer, Titel, Klasse, AStd, Kalenderdatum, Lanes, Abhängigkeiten), prüft fehlende Abhängigkeiten,
   Zyklen (DFS), Reihenfolge (Abhängigkeit endet vor dem Start, bei Gleichstand Reihenfolge im
   Abschnitt) und meldet gemeinsame Lanes am selben Kalendertag (Warnung; `--strict` = Fehler).
   `--calendar` simuliert einen Greedy-Scheduler nach Plan 8.3 (Bautage Mo–Fr ohne 24.12.–01.01.,
   `--hours` (Standard 3) AStd je aktiver Scheibe und Bautag, höchstens drei parallel, keine
   gemeinsame Lane, eine kleine Tabelle äußerer Frühtermine aus Plan 8.3s Fließtext); `--merged`
   nimmt Nummern aus der Planung heraus (als bereits fertig behandelt).
6. **i18n-Literal-Tor** `scripts/i18n-literal-check.mjs`: JSX-Text (`>Text<`, kein `{`/`}` dazwischen)
   und die Props `title`/`aria-label`/`placeholder`/`alt`/`label` als Zeichenkettenliteral unter
   `apps/web/src/features/**` und `apps/web/src/app/**`; Ausnahmen `data-testid`/`className` (per
   Konstruktion nie geprüfte Props), reine Satzzeichen/Zahlen, `i18n-ok: <Grund>`-Zeilen. Heutiger
   Fund: **0** (siehe unten) — die „mehr als eine Handvoll"-Kulanz aus der Spec blockiert deshalb
   nichts; sie bleibt als Sicherheitsnetz für einen künftigen Fund über 5 Stück scharf geschaltet,
   mit Ablaufdatum 2026-11-02 (danach blockiert es so oder so).
7. **Folgebefunde 012 Runde 2** (1, 2, 3, 4, 5, 7 — 6 war Sache des Orchestrators):
   `dorny/paths-filter` auf `0e4a8c6…` (v3.0.4, deklariert `predicate-quantifier`),
   `pnpm/action-setup` auf `b906aff…` (das, worauf `v4` heute zeigt — v4.3.0) gepinnt;
   `role-literal-check.mjs` nimmt nur noch die Textspanne der `Role`-Union aus (nicht `types.ts`
   ganz), parst sie aus einer kommentarmaskierten Kopie (ein `;` in einem Kommentar kann den
   Terminator nicht mehr vortäuschen) und bricht bei einer Abweichung zwischen der Union und den
   Schlüsseln von `ROLE_PERMISSIONS` ab; erkennt jetzt auch `({podium:1})[actor.role]` und
   `new Set([...]).has(actor.role)`; `scripts/semgrep/rules.yml` erkennt `child_process` zusätzlich
   als Standardimport, destrukturiertes `require` und Alias-Import; `now-check.mjs` ergänzt
   `performance['now']()` und `process.hrtime.bigint(`.
8. **Vertragstor CI** `packages/contract/scripts/check.mjs`: `CONTRACT_GATE_STRICT=1` (gesetzt im
   `pnpm gates`-Schritt in `gates.yml`) macht aus jedem heutigen `skip` von Prüfung (c) ein `fail` mit
   derselben Meldung.
9. **Branch-Schutz-Checkliste** `docs/betrieb/branch-schutz.md` (neu): Klickpfad, Prüfpunkte,
   Verweis auf die neuere „Rulesets"-Alternative.
10. **CI** (`gates.yml`): neuer, bedingter Schritt „Slice scope" (nur `pull_request` gegen den
    Integrationsbranch — `scripts/slice-scope.mjs` selbst skippt bei allem anderen ohnehin sauber).
11. **Root `package.json`**: `i18n-literals`, `slice-scope`, `downgrade-check`, `plan-graph`,
    `test:scripts` (`node --test 'scripts/**/*.test.mjs'`) neu; `gates` hängt sie an und endet mit
    `&& node scripts/hooks/mark-test-run.mjs`. `.gitignore`: `.claude/state/` neu.

### `pnpm gates` — Ende des grünen Laufs (vollständig, lokal, nach allen Commits dieser Scheibe)

```
$ pnpm gates
...
> hvworkflow@0.1.0 role-literals /home/user/wt/016
> node scripts/role-literal-check.mjs

Role-literal check: no role-name literal outside the policy layer (apps/api/src, packages/domain/src); roles from packages/domain/src/types.ts: moderation, capture, expert, legal, approver, podium, admin, observer (role-context required only for: expert, legal, podium).

> hvworkflow@0.1.0 now-check /home/user/wt/016
> node scripts/now-check.mjs

now() check: no direct system-clock access outside the injected clock (packages/domain/src, apps/api/src).

> hvworkflow@0.1.0 plan-honesty /home/user/wt/016
> node scripts/plan-honesty.mjs

Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> hvworkflow@0.1.0 i18n-literals /home/user/wt/016
> node scripts/i18n-literal-check.mjs

i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.

> hvworkflow@0.1.0 slice-scope /home/user/wt/016
> node scripts/slice-scope.mjs

slice-scope: 89 changed file(s), all within "docs/slices/016-agenten-hooks-tore.md"'s "Files allowed" list (24 pattern(s)).

> hvworkflow@0.1.0 downgrade-check /home/user/wt/016
> node scripts/downgrade-check.mjs

Downgrade check: 7 spec(s) with a number 009-099, no unauthorised risk-class downgrade against docs/produktplan-beta.md.

> hvworkflow@0.1.0 plan-graph /home/user/wt/016
> node scripts/plan-graph.mjs

plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.

> hvworkflow@0.1.0 test:scripts /home/user/wt/016
> node --test 'scripts/**/*.test.mjs'
...
# tests 75
# pass 75
# fail 0
...
> @hv/web@0.0.0 build /home/user/wt/016/apps/web
> tsc -b && vite build
...
✓ 1713 modules transformed.
✓ built in 1.81s
mark-test-run: wrote /home/user/wt/016/.claude/state/last-test-run
```
Exit `0`. `pnpm --filter @hv/domain test`: 39 passed. `pnpm --filter @hv/api test`: 32 passed
(inkl. `packages/contract test` = `node scripts/check.mjs`, alle vier Prüfungen `ok`).
`pnpm --filter @hv/web test`: 35 passed. `pnpm arch`: unverändert 6 Warnungen (0 Fehler, aus 012,
Oberflächen-Lane, nicht Teil dieser Scheibe). Die 75 `test:scripts`-Tests decken alle neuen/geänderten
Skripte ab (`slice-scope` 6, `downgrade-check` 4, `plan-graph` 7, `i18n-literal-check` 6,
`role-literal-check` 8, `now-check` 4, `contract-gate-strict` 3, `pre-tool-use-bash` 14,
`post-tool-use-lint` 5, `stop-check` 6, `subagent-stop-check` 6, `task-completed` 5,
`mark-test-run` 1 — Summe 75). `node scripts/audit-check.mjs`:
```
pnpm audit: high advisory 1193727 (js-yaml) allowed — ... [owner: Umsetzer, expires: 2026-12-31]
pnpm audit: 1 advisory(ies) found, all at "moderate"+ covered by an unexpired exception.
```
exit `0` — bestätigt, dass die Owner-Änderung (Person → Rolle) keine Regression ist.

### Rote Läufe (lokal, nicht committet)

**Scheibenumfang-Tor** (`--diff` mit einer absichtlich fremden Datei):
```
$ node scripts/slice-scope.mjs --slice 016 --diff "docs/slices/016-agenten-hooks-tore.md,scripts/slice-scope.mjs,apps/web/src/features/stage/Page.tsx"
slice-scope: 1 file(s) outside "docs/slices/016-agenten-hooks-tore.md"'s "Files allowed" list:
  apps/web/src/features/stage/Page.tsx
exit=1
```

**Herabstufungs-Tor** (Testkopie `scripts/fixtures/downgrade/red/`, Spec sagt niedrig, Plan sagt
mittel, keine Freigabezeile):
```
$ node scripts/downgrade-check.mjs --plan scripts/fixtures/downgrade/red/plan.md --slices-dir scripts/fixtures/downgrade/red/slices
Downgrade check failed (docs/qualitaetsleitplanken-produktreife.md section 4: a human decides a downgrade):
  scripts/fixtures/downgrade/red/slices/012-x.md: risk class "niedrig" is lower than "mittel" in scripts/fixtures/downgrade/red/plan.md section 5, without a "Herabstufung freigegeben von <Name> am <TT.MM.JJJJ>" line.
exit=1
```

**Plan-Graph-Prüfung** (Testkopien `scripts/fixtures/plan-graph/`):
```
$ node scripts/plan-graph.mjs --plan scripts/fixtures/plan-graph/missing-dep.md
  missing dependencies: 1
    009 depends on 999, which is not a slice in section 5.
exit=1

$ node scripts/plan-graph.mjs --plan scripts/fixtures/plan-graph/cycle.md
  cycles: 1
    009 -> 010 -> 009
exit=1

$ node scripts/plan-graph.mjs --plan scripts/fixtures/plan-graph/swapped-order.md
  dependency-order problems: 1
    009 (2026-09-28) depends on 010 (2026-09-29), which does not end before 009 starts.
exit=1

$ node scripts/plan-graph.mjs --plan scripts/fixtures/plan-graph/lane-conflict.md --strict
  same-day lane-sharing warnings: 1
    009 and 010 both start 2026-09-28 and share lane(s): infra.
exit=1
```
(ohne `--strict` ist derselbe Fund nur eine Warnung, Exit 0 — siehe Test „warning vs. --strict".)

**Stop-Hook** (Testverzeichnis, kein `.claude/state/last-test-run`):
```
$ node scripts/hooks/stop-check.mjs --root <scratch>
Stop blocked (Plan 5.4): no successful test run recorded yet (.claude/state/last-test-run is missing). Run "pnpm gates" (it writes the marker on success) before stopping. Newest code file: <scratch>/apps/api/src/index.ts.
exit=2

$ node scripts/hooks/mark-test-run.mjs --root <scratch>
$ node scripts/hooks/stop-check.mjs --root <scratch>
Stop check: no code change since the last successful test run (2026-09-23T16:01:32.081Z).
exit=0
```

**PreToolUse** (Fixture-JSON per Datei-Umleitung, nie inline im Bash-Aufruf — damit ein
Testnutzlast-String wie „git push" nie mit dem tatsächlich ausgeführten Bash-Befehl verwechselt
werden kann):
```
$ node scripts/hooks/pre-tool-use-bash.mjs < scripts/fixtures/hooks/pre-tool-use-bare-push.json
Blocked by repository policy (AGENTS.md rule 11, slice 016): "git push" without an explicit remote and branch — git push
exit=2

$ node scripts/hooks/pre-tool-use-bash.mjs < scripts/fixtures/hooks/pre-tool-use-env-read.json
Blocked by repository policy (AGENTS.md rule 11, slice 016): access to ".env" (only .env.example may be read or written) — cat .env
exit=2

$ node scripts/hooks/pre-tool-use-bash.mjs < scripts/fixtures/hooks/pre-tool-use-curl-external.json
Blocked by repository policy (AGENTS.md rule 11, slice 016): curl/wget to a non-local host — curl -sS https://example.com/install.sh -o install.sh (host: example.com)
exit=2
```
Gegenproben grün: `git push origin claude/slice-016-agenten`, `cat apps/api/.env.example`,
`curl http://127.0.0.1:5173/healthz`, `git ls-remote https://github.com/pnpm/action-setup …`
(kein `curl`/`wget`) — alle exit 0. Die vier Muster aus 012 (`git push --force`, `rm -rf /`,
`git reset --hard`, `curl … | sh`) bleiben unverändert rot.

**PostToolUse** (oxlint):
```
$ node scripts/hooks/post-tool-use-lint.mjs < scripts/fixtures/hooks/post-tool-use-error.json
oxlint found error(s) in .../post-tool-use-error.ts:
scripts/fixtures/hooks/post-tool-use-error.ts:2:1: error: Expected `}` but found `EOF`
exit=2

$ node scripts/hooks/post-tool-use-lint.mjs < scripts/fixtures/hooks/post-tool-use-warning-only.json
oxlint (warnings only, not blocking) for .../post-tool-use-warning-only.ts:
scripts/fixtures/hooks/post-tool-use-warning-only.ts:2:9: warning eslint(no-unused-vars): ...
exit=0
```
(oxlints eigener Exit-Code trennt WARNING/ERROR bereits zuverlässig — siehe Skriptkommentar für den
manuellen Beleg dazu.)

**SubagentStop** (Fixture-Transkript mit der Fingerabdruck-Zeile von `implementierer-backend.md`):
```
$ node scripts/hooks/subagent-stop-check.mjs < scripts/fixtures/hooks/subagent-stop-backend-incomplete.json
SubagentStop blocked (AGENTS.md report format, agent "implementierer-backend.md"): the last message is missing Slice:, Done:, Evidence:, Open:, Touched:.
exit=2
```
Grün: derselbe Agent mit vollständigem Bericht; ein `reviewer`-Transkript (nicht geprüfte Rolle) mit
oder ohne Berichtsformat; ein fehlendes/unlesbares Transkript (fail-open).

**TaskCompleted**:
```
$ node scripts/hooks/task-completed.mjs --spec docs/slices/016-agenten-hooks-tore.md < scripts/fixtures/hooks/task-completed-with-completed-todo.json
TaskCompleted blocked (AGENTS.md rule 2, "Evidence, not claims"): docs/slices/016-agenten-hooks-tore.md has neither "**Status:** accepted" nor an acceptance checkbox ("- [x] …") yet — a task is not done until the slice itself is.
exit=2
```
(Zum Zeitpunkt dieses Laufs stand die Spec noch auf `spec`; nach der Statusänderung auf `review` bliebe
der Befund gleich, erst `accepted` oder ein Häkchen macht ihn grün — geprüft an Spec 017, die schon
`accepted` ist, und an einer Checkbox-Fixture, beide grün.)

**Role-literal-check.mjs (Runde-2-Nachbesserungen)**:
```
$ (scratch .ts mit `return ({ podium: 1 })[actor.role];` unter apps/api/src/)
Role-literal check failed (AGENTS.md rule 4): a role name is used as a literal outside the policy layer.
  apps/api/src/__scratch_probe_objkey__.ts:2: return ({ podium: 1 })[actor.role];
exit=1

$ (scratch .ts mit `new Set(['podium', 'expert']).has(actor.role)`)
  apps/api/src/__scratch_probe_sethas__.ts:2: return new Set(['podium', 'expert']).has(actor.role);
exit=1

$ (Zeile `export const oops = { role: 'admin' };` ans Ende von types.ts angehängt — außerhalb der Role-Union)
  packages/domain/src/types.ts:241: export const oops = { role: 'admin' };
exit=1

$ (permissions.ts um einen Schlüssel `coordination` ohne passenden Role-Union-Eintrag erweitert)
Error: Role list mismatch between packages/domain/src/types.ts (...) and packages/domain/src/permissions.ts (..., coordination): only in the Role union: (none); only in ROLE_PERMISSIONS: coordination.
exit=1
```
Alle vier Proben wieder zurückgesetzt (git diff danach leer, per `try`/`finally` im Test bzw. manuell
mit `cp`-Sicherung geprüft).

**now-check.mjs (Runde-2-Nachbesserungen)**:
```
$ (scratch .ts mit `process.hrtime.bigint()`)
  apps/api/src/__scratch_probe_hrtime__.ts:1: export const a = () => process.hrtime.bigint();
exit=1

$ (scratch .ts mit `performance['now']()`)
  apps/api/src/__scratch_probe_perf__.ts:1: export const b = () => performance['now']();
exit=1
```

**CONTRACT_GATE_STRICT** (`git` aus PATH entfernt, damit Prüfung (c) den „nicht erreichbar"-Zweig nimmt):
```
$ PATH=/opt/node22/bin node packages/contract/scripts/check.mjs
  skip  (c) git or origin/claude/dax-shareholder-meeting-workflow-0s934z not available — version-bump check skipped
exit=0

$ PATH=/opt/node22/bin CONTRACT_GATE_STRICT=1 node packages/contract/scripts/check.mjs
  FAIL  (c) git or origin/claude/dax-shareholder-meeting-workflow-0s934z not available — version-bump check skipped
exit=1
```
Mit erreichbarem `git` (normal, mit und ohne die Variable) bleibt Prüfung (c) `ok` — siehe
`pnpm gates`-Ausschnitt oben (`packages/contract test`).

**Semgrep (Runde-2-Nachbesserung, Punkt 5 — child_process-Formen)**: lokales `pysemgrep` ist in
dieser Sandbox durch eine kaputte globale `cryptography`/`pyo3`-Installation defekt (Rust-Panic beim
Import von `semgrep.commands.mcp`, unabhängig vom verwendeten venv — reproduzierbar mit
`semgrep --version`); mit dem OCaml/Rust-Kern direkt (`semgrep --experimental`, umgeht den kaputten
Python-Subprozess) lässt sich die Regel trotzdem echt ausführen:
```
$ semgrep --experimental --config scripts/semgrep/rules.yml --metrics=off <probe-dir>
.../alias-import.ts        ❯❯❱ child-process-string-concatenation   (import { exec as run } ...; run('ls '+input))
.../default-import.ts      ❯❯❱ child-process-string-concatenation   (import cp from 'child_process'; cp.exec('ls '+input))
.../destructured-require.ts ❯❯❱ child-process-string-concatenation  (const { exec } = require(...); exec('ls '+input))
Ran 5 rules on 4 files: 3 findings.

$ semgrep --experimental --config scripts/semgrep/rules.yml --metrics=off good.ts   # execFile(['x'])
Ran 5 rules on 1 file: 0 findings.

$ semgrep --experimental --config scripts/semgrep/rules.yml --metrics=off --severity WARNING --severity ERROR --error <the three bad files>
exit=1
$ … --error good.ts
exit=0

$ semgrep --experimental --config scripts/semgrep/rules.yml --metrics=off apps/api/src packages/domain/src apps/web/src scripts
Ran 5 rules on 159 files: 2 findings.   # both the known INFO Math.random hint from 012, unchanged
```
`python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))"` bestätigt gültiges YAML. Der reguläre
`pip install semgrep==1.177.0 && semgrep …` aus `gates.yml` selbst wurde **nicht** reproduziert (die
kaputte globale Installation betrifft nur diese Sandbox, nicht einen frischen CI-Runner) — erster
echter Lauf dieses genauen Aufrufs ist CI, wie schon bei gitleaks in 012.

### `node scripts/plan-graph.mjs` — heutiger Plan

```
plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
```
Keine Warnungen heute (keine zwei Scheiben teilen sich Tag und Lane). `--strict` liefert dasselbe
Ergebnis (Exit 0).

### `node scripts/plan-graph.mjs --calendar --merged 009,017,012,014,015,019`

```
plan-graph --calendar: 74 slice(s) scheduled (6 taken out as already merged), 3 AStd/day, start 2026-09-28:
  016  start 2026-09-28  finish 2026-09-28  (1.5 AStd, lanes: infra)  Agentenrollen, Hooks, Scheibenumfang-Tor, Plan-Graph-Prüfung, Branch-Schutz
  013  start 2026-09-28  finish 2026-09-28  (1 AStd, lanes: e2e)  Barrierefreiheit und Tastaturpfad als Tor
  010  start 2026-09-28  finish 2026-09-28  (2 AStd, lanes: core)  Lesepfade unter can() mit Leserechten
  018  start 2026-09-29  finish 2026-09-29  (1 AStd, lanes: docs-plan)  Entwicklungsplan, Glossar und README abgleichen
  011  start 2026-09-29  finish 2026-09-29  (1.5 AStd, lanes: core)  Legal-Trace-Feld und Regelregister
  020  start 2026-09-29  finish 2026-09-29  (2 AStd, lanes: web-answers, web-capture, web-stage, web-history, web-speakers, web-shell)  Oberfläche: Rückbau und Passung (S-Punkte)
  082  start 2026-09-30  finish 2026-09-30  (1 AStd, lanes: web-shell)  Feature-Register für Routen, Navigation, Kürzel und Hilfe
  080  start 2026-09-30  finish 2026-09-30  (2.5 AStd, lanes: core, web-speakers, e2e, contract)  Redezeit und Art zurückbauen, Sprecher-Zustandstabelle R-SPK, Korpus 28/230 als eine Quelle
  ... (74 Zeilen gesamt, sortiert nach Startdatum; Bau endet im Modell 2026-11-04, die extern
      terminierten Scheiben 074/076/077/078/079 folgen 2027-02-01..03-08)
```
Das Modell ist ein einfacher, deterministischer Greedy-Scheduler (kein Backtracking, keine
Prioritäten außer Abschnittsreihenfolge) und optimistischer als der von Hand geplante Kalender in
Abschnitt 5 (der reale Plan streut die Scheiben über mehr Bautage, u. a. wegen Risikopuffern, die
dieses Modell nicht kennt) — die Spec verlangt nur, dass `--calendar` läuft und je Scheibe ein
Startdatum ausgibt, keine Deckungsgleichheit mit Abschnitt 5. Auch `--merged 009,017,012` (das
Spec-Beispiel) läuft, mit 77 statt 74 verbleibenden Scheiben.

### `docs/betrieb/branch-schutz.md` und CI

Branch-Schutz ist ein privilegierter Schritt (Eigentümer); die Checkliste liegt vor, der Screenshot-
Nachweis kann nur der Eigentümer liefern. **CI-Nachweis (Akzeptanzkriterium 4) ist offen** — dieser
Worktree pusht nicht (Arbeitsweise). Empfehlung für den Orchestrator: einen PR aus
`claude/slice-016-agenten` gegen den Integrationsbranch öffnen; der Schritt „Slice scope" sollte
laufen (Bedingung erfüllt) und grün sein (89 geänderte Dateien, alle innerhalb der Liste, siehe
`pnpm gates`-Ausschnitt oben); bei Bedarf einen Verstoß demonstrieren, indem testweise eine
`apps/web/src`-Datei in den PR aufgenommen wird (macht „Slice scope" rot), dann zurückgesetzt.

### `settings.json`-Diff

```diff
diff --git a/.claude/settings.json b/.claude/settings.json
index 1b9f0d4..febd618 100644
--- a/.claude/settings.json
+++ b/.claude/settings.json
@@ -6,7 +6,48 @@
         "hooks": [
           {
             "type": "command",
-            "command": "node -e \"const c=JSON.parse(require('fs').readFileSync(0,'utf8')).tool_input?.command||'';if(/git\\s+push\\s+.*--force|rm\\s+-rf\\s+\\/(\\s|$)|git\\s+reset\\s+--hard|curl[^|]*\\|\\s*(ba)?sh/.test(c)){console.error('Blocked by repository policy (AGENTS.md rule 11): '+c);process.exit(2)}\""
+            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/pre-tool-use-bash.mjs\""
+          }
+        ]
+      }
+    ],
+    "PostToolUse": [
+      {
+        "matcher": "Write|Edit",
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/post-tool-use-lint.mjs\""
+          }
+        ]
+      }
+    ],
+    "Stop": [
+      {
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/stop-check.mjs\""
+          }
+        ]
+      }
+    ],
+    "SubagentStop": [
+      {
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/subagent-stop-check.mjs\""
+          }
+        ]
+      }
+    ],
+    "TaskCompleted": [
+      {
+        "hooks": [
+          {
+            "type": "command",
+            "command": "node \"$CLAUDE_PROJECT_DIR/scripts/hooks/task-completed.mjs\""
           }
         ]
       }
```

### Offen

- **CI-Nachweis** (Akzeptanzkriterium 4): nicht durch mich ausführbar, siehe oben — Orchestrator.
- **Branch-Schutz-Screenshot**: Sache des Eigentümers (privilegiert), Checkliste liegt vor.
- **Semgrep-Regeländerung nicht mit dem exakten CI-Aufruf lokal reproduziert** (kaputtes lokales
  `pysemgrep`, siehe oben) — mit `--experimental` (echter Scan-Kern) aber sehr wohl real getestet;
  erster Lauf mit dem echten `pip install semgrep==1.177.0`-Pfad ist CI.
- ~~ADR-Bezug-Zeile bleibt mit veraltetem Werkzeug-Text stehen~~ — erledigt im Nachtrag unten, nachdem
  der Orchestrator die eine Zelle ausdrücklich freigegeben hat.
- **`AGENTS.md`** beschreibt `pnpm gates` weiterhin als „contract lint + typecheck + lint + tests +
  vocabulary check + web build" (Zeile 31) — jetzt mit neun weiteren Schritten noch unvollständiger
  als seit 012. Nicht in „Files allowed" dieser Scheibe, wie schon 012 vermerkt hat.
- **SubagentStop-/Stop-/TaskCompleted-Hook-Verhalten gegenüber der echten Claude-Code-Sitzung ist
  eine begründete Annahme, kein Beleg aus offizieller Schema-Dokumentation**: Ich habe kein
  Referenzdokument für die exakte JSON-Form dieser drei Ereignisse gefunden (im Unterschied zu
  `PreToolUse`, das schon aus 012 bekannt war). ~~Die Fingerabdruck-Erkennung in
  `subagent-stop-check.mjs` stützt sich darauf, dass die erste Zeile eines Agenten-Systemprompts
  wortgleich im eigenen Transkript auftaucht~~ — in Nacharbeitsrunde 1 (M3) durch `agent_type` plus
  `last_assistant_message`/`agent_transcript_path` ersetzt, siehe die Tabelle dort; der Rest dieses
  Punkts (kein amtliches Schema, bewusstes Fail-open) gilt unverändert für alle drei Hooks. Jedes der
  drei Skripte ist bewusst fail-open (blockiert nur bei positiver Erkennung, nie bei Unklarheit),
  damit ein falsches Schema-Verständnis niemals eine echte Sitzung blockiert statt nur wirkungslos zu
  bleiben. Ich habe die Hooks ausschließlich über Datei-Redirection getestet (nie inline im
  Bash-Aufruf), wie in der Aufgabenstellung verlangt, und keine meiner eigenen Sitzungsaktionen hätte
  laut Spec eines der neuen Muster ausgelöst.
- **`node --test scripts/**/*.test.mjs`** braucht in einer Shell die Glob-Syntax in Anführungszeichen
  (`'scripts/**/*.test.mjs'`), sonst expandiert die Shell `**` je nach `globstar`-Einstellung
  unvollständig; `package.json` nutzt die zitierte Form.

### Nachtrag: Reviewer-Checkliste verlinkt statt wiederholt, ADR-Bezug-Werkzeugtext berichtigt (nach Merge von 039)

Auslöser: Scheibe 039 (Bedrohungsmodell, Pentest-Scope, `docs/sicherheit/reviewer-checkliste-sicherheit.md`)
ist gemergt und liegt seit dem Merge-Commit `facfbb3` in diesem Worktree; die Spec sagt für genau
diesen Fall, dass die sieben Sicherheitspunkte auf die Checkliste verweisen statt sie zu wiederholen.

Eine Zeile je Änderung:

1. `.claude/agents/reviewer.md`: die wörtliche Liste der sieben Sicherheitspunkte (Demo-Seed, Limits,
   Sitzung, CSP, Secrets, Bedrohungsmodell, Kill-Switch) ist ersetzt durch einen Verweis auf
   `docs/sicherheit/reviewer-checkliste-sicherheit.md` — die Themenzeile bleibt lesbar, SP-1..7 und
   SC-01..12 daraus sind für die Perspektive Security jetzt ausdrücklich verbindlich.
2. `.claude/agents/reviewer-sonnet.md`: dieselbe Änderung, wortgleich (beide Dateien sind bewusst
   identische Zwillinge, Regel 3).
3. `docs/agentische-entwicklung-plan.md`, Zeile „ADR-Bezug": die Werkzeug-Spalte nannte noch „keine
   eigene ADR-0001-Grenzprüfung in `.claude/agents/reviewer.md`" (veraltet seit Prüfpunkt (9) aus
   dieser Scheibe); jetzt nennt sie diesen Prüfpunkt in `reviewer.md`/`reviewer-sonnet.md` als das
   Werkzeug. Nur diese eine Zelle geändert, wie vom Orchestrator ausdrücklich freigegeben — die
   Stand-Spalte bleibt `läuft (Review: Reviewer-Checkliste)`, unverändert korrekt.

`pnpm gates` — Ende des grünen Laufs (danach, vollständig):
```
# tests 75
# suites 0
# pass 75
# fail 0
...
> @hv/web@0.0.0 build /home/user/wt/016/apps/web
✓ 1713 modules transformed.
✓ built in 1.15s
mark-test-run: wrote /home/user/wt/016/.claude/state/last-test-run
```
Exit `0`. `plan-honesty` unverändert grün (`4 table(s), 38 row(s) …, every "Stand" verified`) — die
Stand-Spalte der ADR-Bezug-Zeile wurde nicht angefasst, nur ihre Werkzeug-Spalte, die `plan-honesty.mjs`
nicht prüft. `slice-scope`: weiterhin `89 changed file(s)`, alle innerhalb der Liste (die drei hier
geänderten Dateien waren schon vorher Teil des Diffs, die Zahl ändert sich durch eine Inhaltsänderung
nicht).

### Nacharbeitsrunde 1 (Review: 2 Blocker, 6 Hauptbefunde)

Reihenfolge wie im Auftrag: B1, B2, M1–M6 zuerst committet (dieser Abschnitt), Minor-Befunde danach in
einem eigenen Abschnitt/Commit.

| # | Befund | Erledigung |
|---|---|---|
| B1 | `scripts/fixtures/hooks/*.json` hard-coded `/home/user/wt/016/…` | Die vier `post-tool-use-*.json`- und fünf `subagent-stop-*.json`-Dateien mit gebackenem Pfad entfernt; `post-tool-use-lint.test.mjs` und `subagent-stop-check.test.mjs` bauen die Nutzlast jetzt zur Testzeit mit `join(FIXTURES, …)`/inline `agent_type`+`last_assistant_message`. `task-completed-*.json` ebenfalls entfernt (B2 ersetzt sie ohnehin). Geprüft: kein verbleibendes `scripts/fixtures/**/*.json(l)` mit `/home/user`-Pfad (`grep -rl "/home/user" scripts/fixtures/` nach der Änderung: leer). |
| B2 | `task-completed.test.mjs` nutzte die echten Specs 016/017 | `task-completed.mjs` neu entworfen (siehe m3): die Slice-Nummer kommt jetzt aus dem Text des erledigten To-dos, nie aus Branch/`--spec`. Tests laufen gegen `scripts/fixtures/task-completed/docs/slices/{900-review,901-accepted,902-stray-checkbox,903-angenommen}.md`, nie gegen echte Specs. |
| M1 | „Slice scope" prüft auf `pull_request` nichts (Merge-Ref macht `HEAD` zu einem fremden Ref) | `slice-scope.mjs` liest `GITHUB_HEAD_REF` vor `git rev-parse --abbrev-ref HEAD`; ist `CI` gesetzt und eine Scheiben-/Takt-Branch erkannt, wird ein unauflösbarer Merge-Base jetzt `fail` (Exit 1) statt `skip`. Rotes CI-artiges Beispiel unten. |
| M2 | Stop-Hook blockiert ohne Codeänderung (Checkout/Merge/e2e-Output) | `stop-check.mjs` fragt jetzt `git status --porcelain -- apps packages scripts` statt mtimes (ignoriert `.gitignore`-Pfade automatisch, u. a. `apps/web/test-results/`); ein sauberer Baum ist immer erlaubt, auch ohne Marker; sonst vergleicht es einen Inhalts-Fingerabdruck (Pfad+Hash je geänderter/unversionierter Datei) gegen den, den `mark-test-run.mjs` zuletzt geschrieben hat (neues gemeinsames `scripts/hooks/lib/dirty-tree-signature.mjs`); `stop_hook_active: true` im Hook-Input erlaubt immer. |
| M3 | SubagentStop hing am (mutmaßlich elterlichen) `transcript_path` und konnte den falschen Agenten treffen | Neu entworfen: nur `agent_type` (String) entscheidet, *ob* geprüft wird; die Nachricht kommt aus `last_assistant_message` oder, falls das fehlt, `agent_transcript_path` (nie mehr dem mehrdeutigen `transcript_path`); `stop_hook_active: true` oder ein unbekanntes Eingabeformat (kein `agent_type`) geben immer frei. Test „ein Reviewer-Stopp wird nie blockiert" grün, mit und ohne Berichtsformat. |
| M4 | PreToolUse: Force-Push/Remote-Löschung umgehbar | `gitPushFindings` neu: erkennt `-f`/`--force`/`--force-with-lease`, ein `+`-Refspec, `--mirror`, `--delete`/`-d` und ein `:`-Refspec; erkennt die globalen Optionen `-C <dir>`, `-c k=v`, `--git-dir=<dir>` vor `push`. Alle 8 im Befund genannten Formen einzeln getestet, plus zwei grüne Gegenproben (legitimer `-C`/`-c`/`--git-dir`-Aufruf mit explizitem Ziel, ohne Force). |
| M5 | E-Mail-Adresse in der Spec (Zeilen ~100, ~157) | Beide Stellen auf „eine persönliche E-Mail-Adresse" umgeschrieben; ganzer Diff gegen den Merge-Base auf E-Mail-Muster geprüft (siehe unten) — im *aktuellen* Dateiinhalt keine mehr; die *Historie* der bereits gemergten Commits `c456296`/`455f905` trägt sie weiterhin (kein Amend/Rebase, siehe „Offen"). |
| M6 | i18n-Literal-Tor: Kulanzschwelle, Kommentare, mehrzeiliger JSX-Text | Kulanz (`HANDFUL`/`GRACE_PERIOD_UNTIL`/`--strict`/`--today`) entfernt — jeder Fund blockiert sofort. `//` und `/* … */` werden vor dem Scannen maskiert (längen-/zeilenerhaltend); behebt den echten Fund `apps/web/src/features/stage/Podium.tsx:101` auf `/home/user/wt/020` (ein Kommentar, der `<div>`/`<p>`/`<button>` in Prosa erwähnt). JSX-Text darf jetzt bis zu 4 eingebettete Zeilenumbrüche überspannen; das deckte zwei echte, aber aus dieser Scheibe heraus unreparierbare Funde auf (`apps/web/src/app/{BootScreen,Header}.tsx`: das Monogramm „HV" auf einem `aria-hidden`-Badge) — dafür eine benannte, schmale Ausnahme `isHouseAbbreviationMonogram` ergänzt (kein allgemeines „kurzes Großbuchstabenwort"-Muster, das hätte z. B. „OK"/„Ja" mitgeschluckt); außerdem zwei echte Regex-Lücken behoben (`&&`/`||` und unausgeglichene Klammern als Code-Signal), die durch mehrzeiliges Matching neu sichtbar wurden (`{total > results.length && (` und ein Ternary mit Klammern). |

**Judgement-Aufruf zur Kenntnisnahme (M6, `isHouseAbbreviationMonogram`):** Ich habe entschieden, dass
das zweimal vorkommende „HV"-Monogramm (ein `aria-hidden`- bzw. dekoratives 36×36/28×28-px-Badge, kein
Fließtext) keine Übersetzung braucht, und eine benannte Ausnahme dafür ergänzt statt die zwei Fundstellen
zu reparieren (außerhalb „Files allowed" dieser Scheibe: `apps/web/src/app/{BootScreen,Header}.tsx`).
Das ist eine inhaltliche Einschätzung, keine rein mechanische — bitte im Review bestätigen oder als
Befund vermerken; die Gegenprobe ohne diese Ausnahme steht oben im Text (4 Funde statt 0).

#### Rote/grüne Läufe

**B1** (Nachweis, dass kein Test mehr von diesem Rechner abhängt):
```
$ grep -rl "/home/user" scripts/fixtures/
(kein Treffer)
```

**M1** (rotes CI-artiges Beispiel: `pull_request`-Checkout mit `GITHUB_HEAD_REF` gesetzt, fremde Datei im Diff):
```
$ CI=true GITHUB_HEAD_REF=claude/slice-016-agenten node scripts/slice-scope.mjs \
    --diff "docs/slices/016-agenten-hooks-tore.md,apps/web/src/features/stage/Page.tsx"
slice-scope: 1 file(s) outside "docs/slices/016-agenten-hooks-tore.md"'s "Files allowed" list:
  apps/web/src/features/stage/Page.tsx
exit=1
```
Zusätzlich, mit einem echten detachten `HEAD` (simuliert per `git checkout <sha>`) in einer Testkopie:
ohne `GITHUB_HEAD_REF` skippt das Tor fälschlich (Fehler reproduziert, `exit=0`, kein Fund trotz zweier
fremder Dateien); mit `GITHUB_HEAD_REF=claude/slice-016-agenten` findet es beide (`exit=1`).

**M2**:
```
$ # echte Bearbeitung, kein Testlauf seither
$ node scripts/hooks/stop-check.mjs   # (in einer Testkopie mit dirty apps/api/src/index.ts)
Stop blocked (Plan 5.4): apps/, packages/ or scripts/ have an uncommitted change and no successful
test run is recorded yet ... exit=2

$ # Checkout-Hin-und-Zurück ohne echte Änderung
$ git checkout -- apps/api/src/index.ts
$ node scripts/hooks/stop-check.mjs
Stop check: apps/, packages/ and scripts/ have no uncommitted change.
exit=0
```

**M3**:
```
$ echo '{"agent_type":"implementierer-backend","last_assistant_message":"Done, trust me."}' \
    | node scripts/hooks/subagent-stop-check.mjs
SubagentStop blocked ... exit=2

$ echo '{"agent_type":"reviewer","last_assistant_message":"Done, trust me."}' \
    | node scripts/hooks/subagent-stop-check.mjs
(kein Fund) exit=0
```

**M4** (alle acht Formen aus dem Befund, siehe `scripts/hooks/pre-tool-use-bash.test.mjs`):
```
git push -f origin main                          -> blocked (force flag)
git push origin +main                             -> blocked (forced refspec)
git -C x push --force origin main                 -> blocked (force flag)
git -c k=v push --force origin main                -> blocked (force flag)
git -C x push                                      -> blocked (no explicit remote and branch)
git push origin --delete main                      -> blocked (remote-branch deletion)
git push origin :main                              -> blocked (remote-branch deletion)
git push --mirror origin                           -> blocked (--mirror push)
```
Grün: `git -C /home/user/wt/016 -c user.email=t@t.invalid push origin claude/slice-016-agenten` und
`git --git-dir=/home/user/wt/016/.git push origin claude/slice-016-agenten` (explizites Ziel, keine
der obigen Formen).

**M5**:
```
$ git diff 76e572e... | grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" | grep -v "example\."
(nur `-`-Zeilen aus bereits gemergten, älteren Commits — der aktuelle Dateiinhalt ist sauber)
```

**M6**:
```
$ node scripts/i18n-literal-check.mjs --root /home/user/wt/020
i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.
```
(vorher, mit der alten Einzeilen-Regex ohne Kommentarmaskierung, war `Podium.tsx:101` ein Fund.)
Mehrzeiliger Fund als Beleg, dass die Erkennung jetzt wirklich mehrzeilig ist:
```
$ node scripts/i18n-literal-check.mjs --root scripts/fixtures/i18n-literal/multiline --scan-roots features
i18n-literal check: 1 literal(s) found under features:
  features/demo/Page.tsx:4: Hallo Welt
```

#### `pnpm gates` — Ende (nach B1, B2, M1–M6)

```
> hvworkflow@0.1.0 test:scripts /home/user/wt/016
> node --test 'scripts/**/*.test.mjs'
...
# tests 98
# pass 98
# fail 0
...
> @hv/web@0.0.0 build /home/user/wt/016/apps/web
✓ built in 1.58s
mark-test-run: wrote /home/user/wt/016/.claude/state/last-test-run (signature 94e8e65822ac…)
```
Exit `0`. Die neue Signatur-Zeile selbst ist der Beleg, dass `stop-check.mjs` jetzt git-basiert
arbeitet (ein leerer Baum hätte `(clean tree)` gemeldet).

### Nacharbeitsrunde 1 — Minor-Befunde (m1–m11)

Zweiter Commit dieser Runde, wie im Auftrag „B1, B2 und M1–M6 zuerst committen, dann die Minor-Befunde".

| # | Befund | Erledigung |
|---|---|---|
| m1 | `contract-gate-strict.test.mjs` nahm an, dass git und node in verschiedenen Verzeichnissen liegen (PATH-Manipulation) | Ersetzt durch `detachedContractDir()`: kopiert `packages/contract` per `cpSync` in ein frisches `mkdtempSync`-Verzeichnis ganz ohne `.git`-Vorfahren — `git rev-parse` schlägt dort deterministisch fehl, unabhängig davon, wo git/node auf dem jeweiligen Rechner liegen. |
| m2 | PreToolUse: `grep -rn "process.env"`, `import.meta.env`, `.envrc` als `.env`-Zugriff falsch erkannt | `envFileFinding()`-Regex verlangt jetzt eine Pfadgrenze vor `.env` (`(?:^|[\s/"'`=(:;,])(\.env(?:\.[\w-]+)*)(?![\w-])`); die drei genannten Fälle sind jetzt grün, ein echter `.env`-Zugriff weiterhin rot. Bekannte, akzeptierte Umgehungen (schemaloses `curl`, Wrapper, `node -e fetch`) und das bewusste Fail-open bei kaputtem Input stehen jetzt im Skriptkopf. Keine `permissions`-Regeln in `.claude/settings.json` ergänzt (Eigentümer-Entscheidung). |
| m3 | TaskCompleted: sollte nur bei genannter Slice-Nummer *und* Status ungleich `accepted`/`angenommen` blockieren, nie bei einem bloßen `- [x]` | Bereits mit B2 neu entworfen: `task-completed.mjs` liest die Slice-Nummer aus dem Text des erledigten To-dos, prüft ausschließlich `**Status:** accepted|angenommen` (`ACCEPTED_STATUS_RE`), ein `- [x]` zählt nirgends mehr als Abnahme; unbekanntes Eingabeformat und keine erkennbare Slice-Nummer geben immer frei. Bericht-Aussage zum Ereignis korrigiert (Abschnitt 5.4: „prüft, dass die Spec-Datei einen Status `accepted` … hat", nicht mehr „ein Abnahmehäkchen"). |
| m4 | slice-scope: bare Dateinamen nach einem vollen Pfad nicht aufgelöst; bare `*`/`**` nicht abgelehnt; keine Warnung bei geänderter „Files allowed" seit dem Merge-Base | `extractGlobs` löst jetzt bare Dateinamen gegen das Verzeichnis des zuletzt genannten vollen Pfads *im selben Aufzählungspunkt* auf (getrennt pro Punkt); ein bare `*`/`**` wird ausdrücklich abgelehnt statt als „alles" interpretiert; eine neue Warnung (kein Fehler) meldet, wenn der Abschnitt „Files allowed" gegenüber der Merge-Base-Version der Spec abweicht. |
| m5 | plan-graph: eine Zeile, die wie ein Scheiben-Aufzählungspunkt beginnt (`- **NNN ·`), aber nicht vollständig passt, wurde stillschweigend übersprungen | `parseSlices` wirft jetzt einen Fehler, sobald eine Zeile `NEXT_BULLET_RE` erfüllt, aber nicht dem vollen `HOURS_PER_CLASS_PATTERN` entspricht. Test hängt nicht mehr an „80 Scheiben" (nur noch an einer positiven Zahl) und lässt `--strict` gegen eine Testkopie (`ok.md`) statt den echten Plan laufen. |
| m6 | `role-literal-check.test.mjs` schrieb destruktiv in die echten `types.ts`/`permissions.ts` (mit Try/finally-Wiederherstellung) | `role-literal-check.mjs` bekommt ein neues `--root <pfad>`; die Tests kopieren `apps/api/src` und `packages/domain/src` per `cpSync` in ein `mkdtempSync`-Verzeichnis und mutieren nur die Kopie. Ein expliziter Test prüft `git status --porcelain -- types.ts permissions.ts` am Ende der Suite (leer). |
| m7 | downgrade-check: die Freigabe-Zeile zählte überall im Dateitext, auch als zitierte Prosa | Neue Funktion `headerBlock()`: nur der Text vor der ersten `## `-Überschrift (oder die ganze Datei, falls keine vorhanden) zählt für `DOWNGRADE_LINE_RE`. Rote Testkopie `scripts/fixtures/downgrade/quoted-prose/`: eine Herabstufung ohne echte Kopfzeilen-Freigabe, aber mit der Zeile als Beispiel-Zitat in einem späteren Abschnitt, schlägt weiterhin fehl. |
| m8 | `branch-schutz.md`: Force-Push-Test gegen den echten Integrationsbranch; fehlender Hinweis zu Squash-Merges per API; fehlender Hinweis zum nötigen GitHub-Plan | Prüfpunkt umformuliert: Nachweis über die gespeicherte Regel im Screenshot, kein `git push --force` gegen den echten Branch mehr; wer es scharf testen will, nur gegen einen eigenen Wegwerf-Branch. Schritt 5 ergänzt: „Require a pull request" beendet direkte Pushes, ein Squash-Merge per API/CLI läuft aber selbst über einen PR und funktioniert weiter. Neuer Absatz unter „Ziel": private Repositorien brauchen mindestens GitHub Pro bzw. Team/Enterprise für Branch-Schutzregeln. |
| m9 | Abschnitt 5.4 des Entwicklungsplans nannte vier Hooks als „geplant in Scheibe 016", obwohl sie in dieser Runde bereits laufen | Stand-Spalte für PreToolUse (voll), PostToolUse, Stop und SubagentStop auf `läuft (Hook: <Ereignis>)` gesetzt; „Files allowed" entsprechend ergänzt (bereits vor dieser Runde erledigt). |
| m10 | Nits: Pin-Kommentar, `/* */` im Rollen-Union-Parser, optionaler `pnpm -r test`-Marker | Pin-Kommentar in `gates.yml` von `# v4 (currently v4.3.0)` auf `# v4.3.0` vereinheitlicht (gleiche Form wie die anderen Pins). `maskLineComments` in `role-literal-check.mjs` zu `maskComments` erweitert: maskiert jetzt auch `/* … */`-Blockkommentare (längen-/zeilenerhaltend), nicht nur `//`. Roter-vor-Fix-Beweis: ein `/* … */`-Kommentar mit `;` und einem erfundenen zitierten Namen in der `Role`-Union hätte vorher die Union vorzeitig abgeschnitten und einen „Role list mismatch" ausgelöst — jetzt grün (neuer Test). `pnpm -r test` schreibt den Marker weiterhin nicht zusätzlich (optional, siehe „Offen"). |
| m11 | (Zusatz vom Orchestrator) `gates.yml`: fehlendes `concurrency`, dadurch schlug ein überholter Lauf auf PR #15 in `gitleaks-action` mit „Invalid revision range" fehl | `concurrency: { group: gates-${{ github.event.pull_request.number \|\| github.ref }}, cancel-in-progress: true }` ergänzt; überholte Läufe auf demselben PR/Branch werden jetzt abgebrochen statt zu Ende zu laufen. |

**m5/m7/m10 rote/grüne Läufe:**
```
$ node --test scripts/plan-graph.test.mjs
# m5 red: a line that starts like a slice bullet but does not match the full format fails loudly
ok 87 ...
# tests 8, pass 8, fail 0

$ node --test scripts/downgrade-check.test.mjs
# m7 red: the sign-off line quoted as prose in a later section does not count, only the header block does
ok 5 ...
# tests 5, pass 5, fail 0

$ node --test scripts/role-literal-check.test.mjs
# m10 green: a /* */ block comment in the Role union (with a semicolon and a fake quoted name inside) is masked, not just // line comments
ok 9 ...
# m6: the real types.ts and permissions.ts are untouched by this whole suite
ok 10 ...
# tests 10, pass 10, fail 0
```

#### Offen (Nacharbeitsrunde 1, Minor-Befunde)

- **m10, dritter Punkt (ausdrücklich optional):** `pnpm -r test` schreibt den Marker
  (`.claude/state/last-test-run`) nicht zusätzlich selbst — nur `pnpm gates` tut das am Ende, wie
  zuvor. Ein `pnpm -r test` allein (außerhalb von `pnpm gates`) hinterlässt also weiterhin keinen
  frischen Marker; das ist die bestehende, unveränderte Grenze von M2/`stop-check.mjs`, nicht neu
  durch diese Runde eingeführt.
- **Abschnitt 5.4, Zeile „TaskCompleted", Spalte „Wirkung"** sagt weiterhin „prüft, dass die
  Spec-Datei ein Abnahmehäkchen hat" — nach B2/m3 stimmt das nicht mehr (geprüft wird `**Status:**
  accepted`/`angenommen`, nie ein Häkchen). Nicht behoben: „Files allowed" dieser Runde erlaubt für
  diese Zeile ausdrücklich nur die Stand-Spalte, nicht die Wirkung-Spalte (siehe oben, Abschnitt
  „Files allowed"); eine Korrektur bräuchte eine weitere Freigabe des Orchestrators.
- Die Git-*Historie* (nicht der aktuelle Dateiinhalt) trägt weiterhin die persönliche E-Mail-Adresse
  aus den bereits gemergten, älteren Commits (siehe M5 oben) — unverändert seit dem ersten Commit
  dieser Runde, kein Amend/Rebase vorgenommen.

## Touched

`.claude/agents/architekt.md`, `planer.md`, `design-kritiker.md`, `reviewer-sonnet.md` (neu),
`reviewer.md`, `implementierer-backend.md`, `implementierer-oberflaeche.md`, `mechaniker.md`,
`.claude/settings.json`, `.gitignore`, `.github/workflows/gates.yml`, `package.json`,
`packages/contract/scripts/check.mjs`, `scripts/audit-exceptions.json`,
`scripts/role-literal-check.mjs` (+ `.test.mjs`, neu), `scripts/now-check.mjs` (+ `.test.mjs`, neu),
`scripts/semgrep/rules.yml`, `scripts/slice-scope.mjs` (+ `.test.mjs`, neu),
`scripts/downgrade-check.mjs` (+ `.test.mjs`, neu), `scripts/plan-graph.mjs` (+ `.test.mjs`, neu),
`scripts/i18n-literal-check.mjs` (+ `.test.mjs`, neu), `scripts/contract-gate-strict.test.mjs` (neu),
`scripts/hooks/pre-tool-use-bash.mjs`, `post-tool-use-lint.mjs`, `stop-check.mjs`,
`subagent-stop-check.mjs`, `task-completed.mjs`, `mark-test-run.mjs` (je + `.test.mjs`, alle neu),
`scripts/fixtures/hooks/**`, `scripts/fixtures/slice-scope/**`, `scripts/fixtures/downgrade/**`,
`scripts/fixtures/plan-graph/**`, `scripts/fixtures/i18n-literal/**` (neu, Testkopien),
`docs/agentische-entwicklung-plan.md` (Abschnitt 5, drei Stand-Zellen vor Nacharbeitsrunde 1, plus vier
weitere — PreToolUse (voll), PostToolUse, Stop, SubagentStop — in Runde 1, m9),
`docs/betrieb/branch-schutz.md` (neu), diese Datei (Bericht, Status, Files-allowed-Ergänzung).

## Review findings

(vom Reviewer)
