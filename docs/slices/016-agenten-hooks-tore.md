# 016 — Agentenrollen, Hooks, Scheibenumfang-Tor, Plan-Graph-Prüfung, Branch-Schutz

**Status:** spec
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
8. **Branch-Schutz-Checkliste** `docs/betrieb/branch-schutz.md` für den Eigentümer (< 30 min): für den
   Integrationsbranch (und später `main`) Pflicht-Statuscheck `gates`, kein Merge bei Rot, keine Force-Pushes, kein
   Löschen, „Require branches to be up to date"; Klickpfad in GitHub; Nachweis per Screenshot durch den Eigentümer.

## Nicht-Ziele

- Kein Branch-Schutz selbst setzen (privilegiert, Eigentümer). Keine Änderung an Produktcode, Vertrag, Kern.
- Keine Änderung an den Toren aus 012 außer dem Anhängen neuer Schritte und den Folgebefunden aus Punkt 7.
- Kein Umschreiben des Plans; `plan-graph.mjs` liest ihn nur.

## Files allowed

- `.claude/agents/*.md`, `.claude/settings.json`
- `scripts/i18n-literal-check.mjs`, `docs/agentische-entwicklung-plan.md` (Abschnitt 5: nur die Stand-Spalte der genannten Zeilen und die Werkzeug-Spalte der Zeile „Versions- und Changelog-Pflicht")
- `scripts/hooks/**`, `scripts/slice-scope.mjs`, `scripts/downgrade-check.mjs`, `scripts/plan-graph.mjs`,
  `scripts/**/*.test.mjs`, `scripts/fixtures/**` (Testkopien)
- `.github/workflows/gates.yml` (neue Schritte, `CONTRACT_GATE_STRICT`, die zwei Pins aus Punkt 7)
- `scripts/role-literal-check.mjs`, `scripts/semgrep/rules.yml`, `scripts/now-check.mjs` (nur Punkt 7)
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

## Arbeitsweise

- Worktree `/home/user/wt/016`, Branch `claude/slice-016-agenten`. Absolute Pfade.
- Achtung: Hooks in `.claude/settings.json` wirken auf Claude-Sitzungen in diesem Worktree. Teste Hook-Skripte über
  stdin mit Beispiel-JSON, nicht indem du deine eigene Sitzung blockierst.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`.
- Playwright-Läufe erzeugen die Bilder unter `docs/evidence/` neu: nicht committen. Nicht pushen.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
