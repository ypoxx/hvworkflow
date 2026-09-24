# takt-005 — Doku-Nachträge: E-Mail-Adresse aus dem Bericht von 012, Patch-Stufe in ADR 0015, Lanes von 010 im Plan

**Status:** angenommen (Review Sonnet 5, Nachprüfung: annehmen)
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-slices, docs-adr, docs-plan
(nur `docs/produktplan-beta.md`; 018 hält `docs/agentische-entwicklung-plan.md`, nicht den Produktplan)
**Rolle/Modell:** Mechaniker · Haiku 4.5; Review Sonnet 5
**Rule ids:** AGENTS.md Regeln 1, 2, 11, 12
**Quellen-IDs:** Review 016 Runde 2 („Außerhalb von 016 gemeldet"); 016 hat denselben Wert in
`scripts/audit-exceptions.json` bereits durch die Rolle ersetzt; Fable-Prüfung der Spec 010 Befunde 7 und 12

## Ziel

1. `docs/slices/012-architektur-sicherheitstore.md`, Abschnitt Bericht (heute Zeile 271): im Satz
   „covered by the one entry in `scripts/audit-exceptions.json` (owner `…`, expires `2026-12-31`)" wird der Wert von
   `owner` durch den Wert ersetzt, der nach 016 in `scripts/audit-exceptions.json` steht (Rolle „Umsetzer"; aus der
   Datei lesen, nicht raten). Sonst ändert sich nichts an der Zeile.
2. Nachweis, dass im Arbeitsbaum keine E-Mail-Adresse einer Person mehr steht:
   `git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- . ':!pnpm-lock.yaml' ':!**/node_modules/**'`
   im Bericht, jede verbleibende Fundstelle einzeln begründet (z. B. `noreply@anthropic.com` in Commit-Vorlagen,
   Beispieladressen `@example.…`). Eine weitere persönliche Adresse wird nicht still entfernt, sondern im Bericht
   gemeldet.
3. `docs/adr/0015-vertragsversionierung.md`, Abschnitt Entscheidung, am Ende der Aufzählung eine Zeile in der Form
   der Vorschläge ohne Planstütze (takt-003, N6): „Vorschlag (nicht im Plan): Ein Vertragszyklus des Architekten hebt
   die Minor-Stufe (0.2.0, 0.3.0, 0.4.0); eine additive Einzeländerung innerhalb eines Zyklus hebt die Patch-Stufe
   (0.2.1 in 010, 0.3.1 in 028)." Status und Datum des ADR bleiben.
4. `docs/produktplan-beta.md`, Abschnitt 5.2, Kopfzeile der Scheibe 010: `Lanes: core` wird zu
   `Lanes: core, contract, service, web-speakers, web-capture, web-answers, web-stage, web-history, e2e` (so wie die
   Spec `docs/slices/010-lesepfade-leserechte.md` sie braucht). Sonst ändert sich nichts an der Zeile. Danach
   `node scripts/plan-graph.mjs` und `node scripts/plan-graph.mjs --calendar` ausführen; die Ausgabe steht im
   Bericht (neue Lane-Warnungen sind Befunde, keine Fehler).

## Nicht-Ziele

Keine Änderung an der Git-Historie (die Adresse bleibt in `76e572e` und in den 016-Commits; ein Umschreiben der
Historie entscheidet der Eigentümer). Keine anderen Wortlautänderungen im Bericht von 012.

## Files allowed

`docs/slices/012-architektur-sicherheitstore.md` (eine Zeile), `docs/adr/0015-vertragsversionierung.md` (eine Zeile),
`docs/produktplan-beta.md` (eine Zeile), diese Datei (`docs/slices/takt-005-email-aus-012.md`, Bericht).

## Akzeptanzkriterium

1. `git diff --stat` zeigt genau vier Dateien; in 012-Spec, ADR 0015 und Produktplan je genau eine geänderte oder neue Zeile.
2. Der `git grep` aus Ziel 2 im Bericht, wörtlich.
3. `pnpm gates` grün (Tail wörtlich im Bericht).

## Arbeitsweise

- Worktree `/home/user/wt/takt`, Branch `claude/takt-005-email-012` vom Integrationsbranch. Absolute Pfade.
- Commit-Betreff nennt „takt-005" und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

**Nachweis-Ersatz durch takt-007, 23.09.2026:** Die beiden folgenden Nachweise (Diff-Stat und E-Mail-Scan) stammten
von einem früheren Stand vor dem Squash und wurden am 23.09.2026 durch takt-007 ersetzt: der Diff-Stat durch den
Squash-Commit, der Scan durch die Mengenform, ausgeführt auf `27333c4` (Branch von takt-007). Die Mengenform bleibt
beim Einfügen in einen Bericht gleich und gilt deshalb auch für jeden späteren Stand, der keine neue Adresse bringt.
Die Zählung endet mit Exit 1, weil `grep -c` bei 0 Treffern so endet; als Tor wäre sie umzudrehen.

**`git show --stat --format= e79c69d` (Squash-Commit von takt-005 gegen seinen Vorgänger), ausgeführt von takt-007:**
```
 docs/adr/0015-vertragsversionierung.md         |   3 +
 docs/produktplan-beta.md                       |   2 +-
 docs/slices/012-architektur-sicherheitstore.md |   2 +-
 docs/slices/takt-005-email-aus-012.md          | 192 +++++++++++++++++++++++++
 4 files changed, 197 insertions(+), 2 deletions(-)
```

**E-Mail-Adressen im Arbeitsbaum, als Menge verschiedener Adressen** (neu gefasst nach dem Codex-Befund auf
PR #22: eine Liste aller Fundstellen wächst mit jedem Einfügen in einen Bericht, so dass ein eingefügter Lauf nie
den Endstand zeigt; die Menge der verschiedenen Adressen und die Zählung der übrigen Fundstellen bleiben beim
Einfügen gleich). Beide Befehle laufen über den Arbeitsbaum einschließlich dieses Berichts:

```
$ git grep -ohE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- . ':!pnpm-lock.yaml' ':!**/node_modules/**' | sort -u
noreply@anthropic.com
t@t.invalid
$ git grep -nE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- . ':!pnpm-lock.yaml' ':!**/node_modules/**' | grep -cvE 't@t\.invalid|noreply@anthropic\.com'
0
```

Begründung je Adresse:
1. `t@t.invalid`: Die Domain `.invalid` ist nach RFC 2606 reserviert und nie zustellbar. Git-Identität in
   Testfixtures (`-c user.email=…` in `scripts/**/*.test.mjs`), ein Befehlsbeispiel in der Spec von 016 und
   Zitate davon in dieser Datei und im Bericht von takt-007.
2. `noreply@anthropic.com`: Automatisierungs-Adresse aus Commit-Vorlagen (Co-Authored-By), keine Person; nur als
   Beispiel in dieser Spec und Zitate davon.

Die zweite Zeile zählt alle Fundstellen, die keine der beiden Adressen enthalten: 0. Eine persönliche Adresse
steht damit nirgends im Arbeitsbaum.

**plan-graph.mjs:**
```
plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
```

**plan-graph.mjs --calendar | head -20:**
```
plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph --calendar: 80 slice(s) scheduled (0 taken out as already merged), 3 AStd/day, start 2026-09-28:
  009  start 2026-09-28  finish 2026-09-28  (1.5 AStd, lanes: docs-plan)  Leitplanken 008 konsolidieren, ADR 0001 zur Annahme vorlegen, Repositorium aufräumen
  017  start 2026-09-28  finish 2026-09-28  (1 AStd, lanes: web-shell)  i18n-Wörterbuch in Feature-Module teilen
  012  start 2026-09-29  finish 2026-09-29  (2 AStd, lanes: infra)  Architektur- und Sicherheitstore, Tor-Inventar ehrlich
  014  start 2026-09-29  finish 2026-09-29  (2.5 AStd, lanes: docs-register)  Entscheidungsregister, Abdeckungsmatrix, Fragenpaket, DSFA-Vorentwurf, Takt-Skript
  015  start 2026-09-29  finish 2026-09-29  (2.5 AStd, lanes: docs-adr)  ADR-Paket 0003–0016 als vorgeschlagen
  016  start 2026-09-30  finish 2026-09-30  (1.5 AStd, lanes: infra)  Agentenrollen, Hooks, Scheibenumfang-Tor, Plan-Graph-Prüfung, Branch-Schutz
  013  start 2026-09-30  finish 2026-09-30  (1 AStd, lanes: e2e)  Barrierefreiheit und Tastaturpfad als Tor
  019  start 2026-09-30  finish 2026-09-30  (1.5 AStd, lanes: contract)  Vertrag 0.2.0 (nur Vertrag): Redezeit und Art veraltet, Leserechte, Koordination, Rechtsfreigabe-Ereignis, Versionierung
  018  start 2026-10-01  finish 2026-10-01  (1 AStd, lanes: docs-plan)  Entwicklungsplan, Glossar und README abgleichen
  010  start 2026-10-01  finish 2026-10-01  (2 AStd, lanes: core, contract, service, web-speakers, web-capture, web-answers, web-stage, web-history, e2e)  Lesepfade unter can() mit Leserechten
  082  start 2026-10-01  finish 2026-10-01  (1 AStd, lanes: web-shell)  Feature-Register für Routen, Navigation, Kürzel und Hilfe
  011  start 2026-10-02  finish 2026-10-02  (1.5 AStd, lanes: core)  Legal-Trace-Feld und Regelregister
  020  start 2026-10-02  finish 2026-10-02  (2 AStd, lanes: web-answers, web-capture, web-stage, web-history, web-speakers, web-shell)  Oberfläche: Rückbau und Passung (S-Punkte)
```

**pnpm gates tail (exit 0):** vom Orchestrator ersetzt, weil der zuerst eingefügte Auszug nicht wörtlich war (Review
takt-005, Befund 2). Neuer Lauf auf demselben Stand, Exit 0, letzte 34 Zeilen, nur ANSI-Farbcodes entfernt:
```
# tests 110
# suites 0
# pass 110
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3744.533079

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

[plugin @tailwindcss/vite:generate:build] [SOURCEMAP_BROKEN] Sourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.30s
mark-test-run: wrote /home/user/wt/takt/.claude/state/last-test-run (clean tree)
```

**Done:**
- Updated owner value in docs/slices/012-architektur-sicherheitstore.md from the previous personal address to `Umsetzer`
  (Adresse vom Orchestrator geschwärzt, Review takt-005 Befund 1)
- Verified all email addresses in codebase with git grep and documented each remaining occurrence with rationale
- Added new proposal line to docs/adr/0015-vertragsversionierung.md Entscheidung section
- Updated slice 010 lanes in docs/produktplan-beta.md and verified plan-graph consistency

**Open:** none

**Touched:** 
- docs/slices/012-architektur-sicherheitstore.md (1 line changed)
- docs/adr/0015-vertragsversionierung.md (3 lines added)
- docs/produktplan-beta.md (1 line changed)
- docs/slices/takt-005-email-aus-012.md (this spec, Bericht section)

## Review findings

**Runde 1 · Sonnet 5 · 23.09.2026 · Urteil: nacharbeiten.**

1. blocker · Der Bericht nannte die persönliche Adresse im Klartext (Zeile „Done") → geschwärzt (Orchestrator).
2. blocker · Der gates-Auszug war nicht wörtlich („chunkifying" statt „chunking") → durch einen echten Lauf ersetzt
   (Orchestrator).
3. major · `pnpm gates` lief beim Reviewer einmal rot (`scripts/role-literal-check.test.mjs`, `ENOENT` beim Kopieren
   des lebenden Baums, während daneben ein zweiter Lauf arbeitete), dann grün → Wettlauf im Test, nicht in dieser
   Kleinänderung; als Punkt 12 in takt-006.
4. minor · ADR 0015: der eine neue Satz ist auf drei Zeilen umbrochen (Zeilenlänge der Datei), Wortlaut wie in der
   Spec → bleibt, hier vermerkt.
5. nit · Der Grep-Block im Bericht zitiert sich selbst → bleibt.

Nacharbeit vom Orchestrator statt vom Mechaniker (nach oben abgewichen): Haiku hat heute zum zweiten Mal einen
Nachweis umformuliert (auch takt-002); zwei Zeilen waren schneller selbst berichtigt als eine zweite Runde.

**Runde 2 · Nachprüfung Sonnet 5 · 23.09.2026 · Urteil: annehmen.** Keine persönliche Adresse mehr im Baum; neuer
gates-Auszug byte-gleich mit dem Lauf (nur ANSI entfernt); Scheibenumfang grün; Commit mit `[skip netlify]`.
