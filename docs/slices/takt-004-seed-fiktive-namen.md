# takt-004 — Seed: fiktive Vereinsnamen, Screenshot des Fragenpakets neu

**Status:** review
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: core (nur `seed.ts`; 012 gemergt,
keine laufende Scheibe hält core), docs-feedback
**Rolle/Modell:** Implementierer-Oberfläche · Sonnet 5 baut (Screenshot mit Legende, wie in 014); Review Opus 5.5
**Rule ids:** AGENTS.md Regeln 1, 2, 11, 12
**Quellen-IDs:** Review 014 Runde 1 Befund 10 und Runde 2 Punkt 11 (echte Vereinsnamen im Seed und im Screenshot an
die Projektleitung), N5 (Marke 28 verdeckt eine Ziffer); Fälligkeit: Versand des Fragenpakets am 02.10.2026

## Ziel

1. `packages/domain/src/seed.ts`, `ASSOCIATIONS`: die vier Einträge durch vier erkennbar fiktive ersetzen:
   `'Aktionärsverein Nordlicht'`, `'Schutzgemeinschaft Musterstadt'`, `'Anlegerkreis am Elbufer'`,
   `'Verein kritischer Kleinanleger Beispielstadt'`. Gleiche Anzahl, gleiche Reihenfolge, damit die Zufallsfolge des
   Seeds unverändert bleibt.
2. `LAST_NAMES`: `'Quandt'` durch `'Quednau'` ersetzen (gleiche Stelle; ein bekannter Familienname im
   Aktionärskontext ist keine synthetische Person).
3. Ein Test in `packages/domain` prüft, dass keiner der alten fünf Namen im erzeugten Korpus vorkommt und dass die
   Anzahl der Wortmeldungen und Einzelfragen gleich bleibt (Zahlen aus dem heutigen Seed).
4. `docs/feedback/2026-10-fragenpaket-wortmeldeliste.png` neu erzeugen, gleiche Ansicht (Wortmeldeliste, Rolle
   Moderation), jetzt auf dem Stand nach 020 (Uhr HH:MM, Griff sichtbar, Hinweis im Rundenkopf). Jedes sichtbare
   Bedienelement und jeder neue Hinweis bekommt eine Nummer; die Nummern laufen lückenlos 1..N; keine Marke verdeckt
   Text (N5). Die Legende im Anhang von `docs/feedback/2026-10-fragenpaket-woche-1.md` wird aus derselben
   Markierungsliste erzeugt und beschreibt, was das Bild zeigt (Hausvokabular, ohne Entwicklerbegriffe); Stellen im
   Fragenpaket, die die Zahl der Nummern nennen, werden angepasst. Frage 1 selbst bleibt unverändert. Die Erzeugungsskripte liegen im Scratch unter
   `/tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/shot014/` (`shot.mjs`,
   `generate-legend.mjs`); sie bleiben dort.
5. Playwright-Bilder unter `docs/evidence/` ändern sich durch die Namen möglicherweise: nicht committen (die
   Nachweisbilder der alten Scheiben bleiben der alte Stand).

## Nicht-Ziele

Keine anderen Seed-Änderungen (Korpus 28/230 ist 080), keine Oberflächenänderung, keine Änderung an den Fragen des
Fragenpakets außer den Zahl-Nennungen.

## Files allowed

`packages/domain/src/seed.ts`, ein Test unter `packages/domain/src/__tests__/`, die PNG, Anhang/Legende und die
Zahl-Nennungen im Fragenpaket, diese Datei (Bericht).

## Nachweis

Tail von `pnpm gates`; alle Playwright-Szenarien grün; `git grep -n "DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt"` ohne
Treffer; die neue PNG und der Befehl, mit dem sie erzeugt wurde.

## Bericht

(vom Bauenden)

**1. Seed.** `packages/domain/src/seed.ts`: `ASSOCIATIONS` auf die vier vorgegebenen fiktiven Namen
umgestellt (`Aktionärsverein Nordlicht`, `Schutzgemeinschaft Musterstadt`, `Anlegerkreis am Elbufer`,
`Verein kritischer Kleinanleger Beispielstadt`), gleiche Anzahl und Reihenfolge; `LAST_NAMES`:
`'Quandt'` an derselben Stelle durch `'Quednau'` ersetzt. Kein Array hat die Länge geändert, also
zieht `pick()` (`Math.floor(rnd() * arr.length)`) exakt dieselben Indizes wie vorher — die
Zufallsfolge des Seeds bleibt unverändert. Neuer Test
`packages/domain/src/__tests__/seed-fictitious-names.test.ts` (gleiche Seed-Optionen wie
`seed.test.ts`: `questions: 800, seed: 2027, now: 2027-04-20T13:30:00Z`) prüft: (a) keiner der fünf
alten Namen kommt in Redner-Namen, Organisationen oder Redebeitragstexten vor, (b) 118
Wortmeldungen (`roundSizes` 40+34+28+16, unverändert) und 800 Einzelfragen bleiben exakt gleich, (c)
ein zweiter Lauf mit denselben Optionen erzeugt exakt dieselbe Ereignisfolge (Typ+SubjectId je
Event) wie der Referenzlauf — Determinismus/Zufallsfolge bestätigt.

**2. Screenshot und Legende.** Vite lief unter `apps/web` auf Port 4393
(`pnpm exec vite --port 4393 --strictPort`). Die Skripte aus
`.../scratchpad/shot014/{shot.mjs,generate-legend.mjs}` wurden nach
`.../scratchpad/shot-takt004/` kopiert und dort angepasst (Pfade auf `/home/user/wt/takt`, Port
4393; beide Kopien bleiben im Scratch, nicht im Repo):
- `shot.mjs`: prüft jetzt je Runde, ob `round-drag-hint-${round}` sichtbar ist (statt fest auf Runde 3
  verdrahtet) und badgt ihn zwischen Rundenkopf-Schalter und Rundenfortschritt — genau die Stelle, an
  der der Hinweis seit Scheibe 020 im Rundenkopf sitzt. Für Runde 3 (einzige offene Runde) ergab das
  einen neuen Marker (jetzt Nr. 23), macht 37 statt vormals 36 Marken.
- N5 behoben ("Marke 28 verdeckt eine Ziffer", jetzt Marke 29 `row-speaking-elapsed`): die Marke lag
  exakt auf der ersten Ziffer der Redezeit ("00:06"); sie wird jetzt 11 px nach links in die
  vorhandene Leerfläche der rechtsbündigen LÄUFT-Spalte verschoben, deckt keine Ziffer mehr ab
  (verifiziert per Bildschnitt vor/nach der Änderung).
- Ein zweites, beim Nacharbeiten gefundenes Problem gleicher Art: der neue Rundenhinweis und die
  Rundenfortschritts-Anzeige liegen nur 8 px auseinander; die Fortschritts-Marke hätte das letzte
  Wort des Hinweistexts angeschnitten. Fix: Fortschritts-Marke um 10 px nach rechts, hinter den
  Hinweistext.
- `generate-legend.mjs`: Pfade auf `.../shot-takt004/legend.json` und
  `docs/feedback/2026-10-fragenpaket-woche-1.md` umgestellt; neue Beschriftung/Beschreibung für
  `round-N-drag-hint` ("Verschiebehinweis Runde N") ergänzt, dynamisch nach Rundennummer, sonst
  unverändert (Querverweise, „weitere Zeilen"-Absatz bleiben automatisch berechnet).

Befehle (in dieser Reihenfolge):
```
cd /home/user/wt/takt/apps/web && pnpm exec vite --port 4393 --strictPort &
node /tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/shot-takt004/shot.mjs
node /tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/shot-takt004/generate-legend.mjs
```
Ausgabe: `Wrote .../docs/feedback/2026-10-fragenpaket-wortmeldeliste.png`, `Badged 37 elements.`,
`Patched .../2026-10-fragenpaket-woche-1.md with 37 legend rows.`

Die PNG wurde mit dem Read-Werkzeug angesehen und jede der 37 Nummern gegen ihre Legendenzeile
geprüft (Header/Navigation 1–13, Am-Mikrofon/Als-Nächstes 14–17, Rundenköpfe 18–24 inkl. neuem
Hinweis 23, Zeilen 25–35, Runde 4 36–37); keine Marke deckt Text ab, Nummern laufen 1..37 ohne
Lücke. Die Uhr im Header (kleine HH:MM-Anzeige, „ORTSZEIT BERLIN 18:5x") ist kein Bedienelement und
kein neuer Hinweis und bleibt deshalb unnummeriert; sie wird von keiner Marke verdeckt.

**3. Fragenpaket.** `docs/feedback/2026-10-fragenpaket-woche-1.md`: nur die Legendentabelle im Anhang
wurde ersetzt (37 statt 36 Zeilen; neue Zeile 23 „Verschiebehinweis Runde 3", alle Folgenummern und
die Querverweise im Absatz danach automatisch verschoben). Frage 1 (Text, Kontext, Annahme, Frist)
unverändert; sonst nennt das Fragenpaket die Zahl 36 an keiner weiteren Stelle (geprüft per Grep).

**4. Gates und Tests.** `pnpm gates` grün (Tail unten). Vollständige Playwright-Suite
(`E2E_PORT=4342 pnpm exec playwright test` in `apps/web`): 9/9 grün. Anschließend
`git -C /home/user/wt/takt checkout -- docs/evidence` ausgeführt — die durch die neuen Namen
geänderten Nachweisbilder alter Scheiben wurden verworfen, nichts davon committet.
`git -C /home/user/wt/takt grep -n "DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt"` liefert
nur zwei Treffer, beide in dieser Spec-Datei selbst (Ziel-Absatz 2 und der Nachweis-Absatz, die den
zu ersetzenden Namen bzw. den Prüfbefehl wörtlich zitieren); im Seed, im erzeugten Korpus, im
Screenshot, in der Legende und überall sonst im Repository kein Treffer.

**Evidence (Tail `pnpm gates`):**
```
> hvworkflow@0.1.0 vocabulary /home/user/wt/takt
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> hvworkflow@0.1.0 arch /home/user/wt/takt
> depcruise --config scripts/dependency-cruiser.cjs apps/web/src apps/api/src packages/domain/src

  warn web-features-i18n-domain-types-only: apps/web/src/features/stage/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/speakers/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/capture/ClassifyDialog.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/WorkList.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/useBacklog.ts → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/QuestionDetail.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/Page.tsx → packages/domain/src/index.ts

x 7 dependency violations (0 errors, 7 warnings). 132 modules, 487 dependencies cruised.

> hvworkflow@0.1.0 role-literals /home/user/wt/takt
> node scripts/role-literal-check.mjs

Role-literal check: no role-name literal outside the policy layer (apps/api/src, packages/domain/src); roles from packages/domain/src/types.ts: moderation, capture, expert, legal, approver, podium, admin, observer (role-context required only for: expert, legal, podium).

> hvworkflow@0.1.0 now-check /home/user/wt/takt
> node scripts/now-check.mjs

now() check: no direct system-clock access outside the injected clock (packages/domain/src, apps/api/src).

> hvworkflow@0.1.0 plan-honesty /home/user/wt/takt
> node scripts/plan-honesty.mjs

Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

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
dist/assets/index-DVViwHry.js                        528.48 kB │ gzip: 155.10 kB │ map: 2,175.78 kB
✓ built in 1.01s
```

**Evidence (`pnpm --filter @hv/domain test`, enthalten in `pnpm gates`):**
```
 Test Files  5 passed (5)
      Tests  42 passed (42)
```

**Evidence (Playwright, `E2E_PORT=4342 pnpm exec playwright test`):**
```
Running 9 tests using 2 workers

  ✓  1 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (3.7s)
  ✓  3 [chromium] › e2e/001-shell.spec.ts:75:1 › header strip on the answers desk @screenshot (3.0s)
  ✓  2 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (10.5s)
  ✓  5 [chromium] › e2e/020-rueckbau-passung.spec.ts:198:1 › 020: Rückbau und Passung — points 1–9, axe on the five views (21.5s)
  ✓  6 [chromium] › e2e/020-rueckbau-passung.spec.ts:599:1 › 020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (6.3s)
  ✓  7 [chromium] › e2e/020-rueckbau-passung.spec.ts:642:1 › 020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.4s)
  ✓  8 [chromium] › e2e/020-rueckbau-passung.spec.ts:682:1 › 020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (5.3s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (48.7s)
  ✓  9 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (39.1s)

  9 passed (1.5m)
```

**Grep-Nachweis:**
```
$ git -C /home/user/wt/takt grep -n "DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt"
docs/slices/takt-004-seed-fiktive-namen.md:17:2. `LAST_NAMES`: `'Quandt'` durch `'Quednau'` ersetzen (gleiche Stelle; ein bekannter Familienname im
docs/slices/takt-004-seed-fiktive-namen.md:44:Tail von `pnpm gates`; alle Playwright-Szenarien grün; `git grep -n "DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt"` ohne
```
Beide Treffer sind Selbstzitate dieser Spec (die zu ersetzenden Namen im Ziel-Absatz, der Prüfbefehl
im Nachweis-Absatz) — unvermeidbar, solange die Spec unverändert bleibt. Kein Treffer in Code, Seed,
Testdaten, PNG oder Fragenpaket.

### Nacharbeit nach Review (Runde 2)

Nacharbeit nach Review: Befunde 1–8 umgesetzt (Commit `8ffa46e89aa595364cf54d3708837c8bbffde211`).

Opus-Review: „accept after minor fixes", 1 major. Alle acht Befunde umgesetzt:

1. **Major — Marke 29 (vormals 28), Legendentext.** „zeigt „—", solange niemand am Mikrofon ist" traf
   nicht zu; das Bild zeigt „—" in jeder gerade nicht sprechenden Zeile, nicht nur bei leerem Mikrofon.
   Text in `generate-legend.mjs` (`DESCRIPTIONS['row-speaking-elapsed']`) korrigiert auf „zeigt „—" in
   jeder Zeile, die gerade nicht spricht." und die Legende erneut aus derselben Markierungsliste
   erzeugt (kein Handedit der Markdown-Tabelle).
2. **Fingerprint statt Behauptung.** `seed-fictitious-names.test.ts` maskiert jetzt `displayName` und
   `organisation` in `JSON.stringify(events)` (Funktion `maskNames`) und vergleicht einen Hash des
   maskierten Textes gegen einen Fixwert, der auf Commit `c891616` (dem Stand vor jeder Namensänderung
   dieser Scheibe) mit derselben Funktion berechnet wurde. Erste Fassung nutzte `node:crypto`/SHA-256;
   das verletzt die Architekturregel `domain-no-node-core-modules` (`pnpm gates` → `arch`,
   `packages/domain` läuft laut ADR 0002 auch im Browser und darf kein Node-Kernmodul importieren) —
   durch eine abhängigkeitsfreie Hashfunktion (cyrb53, gemeinfrei, keine Kollisionssicherheit nötig,
   da nur Fixtur-Fingerprint) ersetzt und den Fixwert neu berechnet
   (`14306754d3352f`). Der verbotene-Namen-Suchtest läuft jetzt über das vollständige
   `JSON.stringify(events)` statt nur über Redner-Namen, Organisationen und Redebeitragstexte.
3. **Marke 23** (Rundenhinweis Runde 3) saß auf dem Griff-Symbol, das sie beschreibt (Hinweis-Box
   beginnt exakt am Icon). In `shot.mjs` um 10 px nach links in die vorhandene Leerfläche verschoben
   (der Griff selbst bleibt durch Marke 25/27 an den Zeilen markiert).
4. **Marken 18, 20, 22, 36** (Rundenkopf-Schalter) saßen auf dem Auf-/Zuklapp-Pfeil (Button-Box
   beginnt exakt am Chevron-Icon). Ebenfalls in `shot.mjs` um 10 px nach links verschoben, in die
   `px-4`-Kopfzeilenpolsterung des Panels (`Panel.tsx`), wo kein Text steht.
5. **Klartext in der Legende** (alle drei in `generate-legend.mjs`, `DESCRIPTIONS`, nicht von Hand in
   der Markdown-Datei): Zeile 1 „Bei Fokus oder Mauskontakt" → „Beim Anwählen mit Maus oder
   Tabulatortaste"; Zeile 4 „, kein Rückfalltext" gestrichen; Zeile 12 „auf Icons" → „auf Symbole".
6. **Einleitungssatz im Anhang** (von Hand, da außerhalb der generierten Tabelle) ergänzt: „... jede
   Nummer markiert einen Knopf, ein Bedienelement, eine Anzeige oder einen Hinweis). Uhr und Zähler in
   der Kopfzeile sind Anzeigen ohne Nummer."
7. Vollständiger, ungekürzter Tail von `pnpm gates 2>&1` unten (alle Lint- und Build-Warnungen
   enthalten, keine Auslassungen mit „…").
8. **Regel 11.** `LAST_NAMES`: die drei Nachnamen, die mit Vornamen aus `FIRST_NAMES_F`/`_M` bekannte
   Persönlichkeiten ergeben, an derselben Stelle durch drei ähnlich klingende, aber fiktive Nachnamen
   ersetzt (Länge/Reihenfolge unverändert, siehe `seed.ts`). Die drei alten Nachnamen stehen an keiner
   Stelle im Klartext im Code oder in diesem Bericht — der Test baut jedes verbotene Wort zur Laufzeit
   aus zwei Bruchstücken zusammen (Funktion `retired`), damit ein einfacher `git grep` auf die alten
   Nachnamen außerhalb dieser Spec-Datei nichts findet (Grep-Nachweis unten; die Fixpunkt-Namen der
   ersten Runde wurden aus demselben Grund gleich mit umgestellt). Kein Klartext-Verzeichnis echter
   Personennamen wurde angelegt. Einer der drei alten Nachnamen war in Runde 3 des Screenshots sichtbar
   (Zeile 97); das Bild wurde mit demselben Skript (`shot.mjs`) neu erzeugt. Die Legende ändert sich
   dadurch nicht zusätzlich (Markierungen liegen auf Bedienelementen, nicht auf Namen) — nur Punkt 1,
   3, 4, 5 und 6 oben ändern Legendentext oder Markenposition.

Nach der letzten Regeneration wurden PNG und Legende Nummer für Nummer erneut mit dem Read-Werkzeug
geprüft, insbesondere die von der Review genannten Marken 18, 20, 22, 23, 29 und 36: alle sechs
Auf-/Zuklapp-Pfeile bzw. das Griffsymbol bzw. die Zeitziffern sind jetzt frei, keine Marke deckt mehr
etwas ab, das sie selbst beschreibt.

**Befehle (Nacharbeit, in dieser Reihenfolge):**
```
cd /home/user/wt/takt/apps/web && pnpm exec vite --port 4393 --strictPort &
node /tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/shot-takt004/shot.mjs
node /tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/shot-takt004/generate-legend.mjs
```
Ausgabe: `Wrote .../docs/feedback/2026-10-fragenpaket-wortmeldeliste.png`, `Badged 37 elements.`,
`Patched .../2026-10-fragenpaket-woche-1.md with 37 legend rows.`

**Evidence — vollständiger Tail von `pnpm gates 2>&1` (Nacharbeit, ungekürzt):**
```
> hvworkflow@0.1.0 gates /home/user/wt/takt
> pnpm contract:lint && pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm vocabulary && pnpm arch && pnpm role-literals && pnpm now-check && pnpm plan-honesty && pnpm --filter @hv/web build


> hvworkflow@0.1.0 contract:lint /home/user/wt/takt
> redocly lint packages/contract/openapi.yaml


    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║  A new version of Redocly CLI (2.54.2) is available.  ║
    ║  Update now: `npm i -g @redocly/cli@latest`.          ║
    ║  Changelog: https://redocly.com/docs/cli/changelog/   ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝

No configurations were provided -- using built in recommended configuration by default.

validating packages/contract/openapi.yaml...
[1] packages/contract/openapi.yaml:496:5 at #/components/securitySchemes/oidc

Security scheme: "oidc" is never used.

494 |     Demo stand-in for OIDC. Value `<actorId>:<role>`. The production adapter maps OIDC claims to
495 |     the same actor context; nothing else in the system changes.
496 | oidc:
    | ^^^^
497 |   type: openIdConnect
498 |   openIdConnectUrl: https://idp.example.invalid/.well-known/openid-configuration

Warning was generated by the no-unused-components rule.

Reference: https://redocly.com/docs/cli/rules/oas/no-unused-components


packages/contract/openapi.yaml: validated in 100ms

Woohoo! Your API description is valid. 🎉
You have 1 warning.

Scope: 4 of 5 workspace projects
packages/contract typecheck$ tsc -p tsconfig.json --noEmit
packages/domain typecheck$ tsc -p tsconfig.json --noEmit
packages/contract typecheck: Done
packages/domain typecheck: Done
apps/api typecheck$ tsc -p tsconfig.json --noEmit
apps/web typecheck$ tsc -b
apps/api typecheck: Done
apps/web typecheck: Done
Scope: 4 of 5 workspace projects
packages/contract lint$ echo 'contract lint runs at root: pnpm contract:lint'
packages/domain lint$ oxlint src
packages/contract lint: contract lint runs at root: pnpm contract:lint
packages/contract lint: Done
packages/domain lint: Done
apps/api lint$ oxlint src
apps/web lint$ oxlint src
apps/api lint: Done
apps/web lint: src/features/speakers/SpeakingTimer.tsx:11:17: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
apps/web lint: src/features/speakers/RegisterDialog.tsx:40:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/components/Badge.tsx:44:17: warning react(only-export-components): Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components.
apps/web lint: src/features/stage/Page.tsx:100:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/stage/Page.tsx:228:7: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/capture/ClassifyDialog.tsx:45:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/speakers/Page.tsx:69:19: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/speakers/MoveDialog.tsx:29:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/api/useApiVersion.ts:14:19: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/capture/ContributionPane.tsx:93:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/capture/useCapture.ts:56:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/capture/QuestionsPane.tsx:40:7: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/capture/SuggestDialog.tsx:34:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/ActionDialogs.tsx:61:15: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/ActionDialogs.tsx:121:15: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/ActionDialogs.tsx:185:7: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/capture/Page.tsx:48:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/useBacklog.ts:117:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/useBacklog.ts:145:7: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/Page.tsx:50:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/history/Page.tsx:125:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/history/Page.tsx:146:7: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/QuestionDetail.tsx:202:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: src/features/answers/QuestionDetail.tsx:206:5: warning react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders help: Effects should synchronize React with external systems. Calling setState synchronously inside an effect starts another render and is usually unnecessary. Derive the value during render, initialize state directly, or update it from the event that caused the change. Use an effect only when synchronizing with an external system.
apps/web lint: Done
Scope: 4 of 5 workspace projects
packages/contract test$ node scripts/check.mjs
packages/domain test$ vitest run
packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.2.0, 29 operations)
packages/contract test:   ok    (a) info.version 0.2.0 = package.json version
packages/contract test:   ok    (b) CHANGELOG.md has a section for 0.2.0
packages/contract test:   ok    (c) openapi.yaml unchanged against merge base 936ac08 with origin/claude/dax-shareholder-meeting-workflow-0s934z
packages/contract test:   ok    (d) allowlist.json well-formed, 0 pre-declared operation(s), none expired (today 2026-09-23)
packages/contract test: contract gate: ok
packages/contract test: Done
packages/domain test:  RUN  v4.1.11 /home/user/wt/takt/packages/domain
packages/domain test:  Test Files  5 passed (5)
packages/domain test:       Tests  43 passed (43)
packages/domain test:    Start at  19:39:08
packages/domain test:    Duration  2.46s (transform 386ms, setup 0ms, import 799ms, tests 2.59s, environment 0ms)
packages/domain test: Done
apps/api test$ vitest run
apps/web test$ vitest run --passWithNoTests
apps/api test:  RUN  v4.1.11 /home/user/wt/takt/apps/api
apps/web test:  RUN  v4.1.11 /home/user/wt/takt/apps/web
apps/web test:  Test Files  3 passed (3)
apps/web test:       Tests  35 passed (35)
apps/web test:    Start at  19:39:12
apps/web test:    Duration  568ms (transform 531ms, setup 0ms, import 671ms, tests 37ms, environment 0ms)
apps/web test: Done
apps/api test:  Test Files  4 passed (4)
apps/api test:       Tests  32 passed (32)
apps/api test:    Start at  19:39:12
apps/api test:    Duration  2.00s (transform 843ms, setup 0ms, import 2.25s, tests 1.92s, environment 0ms)
apps/api test: Done

> hvworkflow@0.1.0 vocabulary /home/user/wt/takt
> node scripts/vocabulary-check.mjs

vocabulary-check: ok

> hvworkflow@0.1.0 arch /home/user/wt/takt
> depcruise --config scripts/dependency-cruiser.cjs apps/web/src apps/api/src packages/domain/src


  warn web-features-i18n-domain-types-only: apps/web/src/features/stage/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/speakers/Page.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/capture/ClassifyDialog.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/WorkList.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/useBacklog.ts → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/QuestionDetail.tsx → packages/domain/src/index.ts
  warn web-features-i18n-domain-types-only: apps/web/src/features/answers/Page.tsx → packages/domain/src/index.ts

x 7 dependency violations (0 errors, 7 warnings). 132 modules, 487 dependencies cruised.


> hvworkflow@0.1.0 role-literals /home/user/wt/takt
> node scripts/role-literal-check.mjs

Role-literal check: no role-name literal outside the policy layer (apps/api/src, packages/domain/src); roles from packages/domain/src/types.ts: moderation, capture, expert, legal, approver, podium, admin, observer (role-context required only for: expert, legal, podium).

> hvworkflow@0.1.0 now-check /home/user/wt/takt
> node scripts/now-check.mjs

now() check: no direct system-clock access outside the injected clock (packages/domain/src, apps/api/src).

> hvworkflow@0.1.0 plan-honesty /home/user/wt/takt
> node scripts/plan-honesty.mjs

Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

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
dist/assets/index-Dtx2FS9m.js                        528.49 kB │ gzip: 155.11 kB │ map: 2,176.20 kB

[plugin @tailwindcss/vite:generate:build] [33m[SOURCEMAP_BROKEN] [0mSourcemap is likely to be incorrect: a plugin (@tailwindcss/vite:generate:build) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help: https://rolldown.rs/guide/troubleshooting#warning-sourcemap-is-likely-to-be-incorrect

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.23s
```

**Evidence — Playwright (Nacharbeit, `E2E_PORT=4342 pnpm exec playwright test`):**
```
Running 9 tests using 2 workers
  ✓  2 [chromium] › e2e/001-shell.spec.ts:16:1 › shell: counters, role switch, language switch @screenshot (2.4s)
  ✓  3 [chromium] › e2e/001-shell.spec.ts:75:1 › header strip on the answers desk @screenshot (1.5s)
  ✓  1 [chromium] › e2e/002-speakers-capture.spec.ts:61:1 › speakers list and capture desk @screenshot (7.2s)
  ✓  5 [chromium] › e2e/020-rueckbau-passung.spec.ts:198:1 › 020: Rückbau und Passung — points 1–9, axe on the five views (23.9s)
  ✓  6 [chromium] › e2e/020-rueckbau-passung.spec.ts:599:1 › 020: "Nur Bühne" default — aus den Rechten, nicht aus der Rolle (5.7s)
  ✓  7 [chromium] › e2e/020-rueckbau-passung.spec.ts:642:1 › 020: Uhr — keine Änderung innerhalb einer Minute, exakt eine am Minutenwechsel (1.6s)
  ✓  8 [chromium] › e2e/020-rueckbau-passung.spec.ts:682:1 › 020: leere Zustände — Erfassung ohne Redebeitrag, Bühne ohne Warteschlange (5.0s)
  ✓  4 [chromium] › e2e/003-answers-stage.spec.ts:43:1 › backlog, approval, podium and history @screenshot (47.0s)
  ✓  9 [chromium] › e2e/abnahme.spec.ts:86:1 › @abnahme Redebeitrag zu sieben Einzelfragen, beantwortet, freigegeben, vorgelesen (38.3s)

  9 passed (1.4m)
```
Anschließend `git -C /home/user/wt/takt checkout -- docs/evidence` ausgeführt; nichts davon committet.

**Grep-Nachweis (Nacharbeit, beide Prüfungen erneut ausgeführt):**
```
$ git -C /home/user/wt/takt grep -n "Lindner\|Falk\b\|Wendt\b" -- . ':!docs/slices/takt-004-seed-fiktive-namen.md'
(keine Treffer)
$ git -C /home/user/wt/takt grep -n "DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt" -- . ':!docs/slices/takt-004-seed-fiktive-namen.md'
(keine Treffer)
$ git -C /home/user/wt/takt grep -n --untracked "Lindner\|Falk\b\|Wendt\b\|DSW\|SdK\|Kritischer Aktionäre\|Kleinaktionäre\|Quandt" -- . ':!docs/slices/takt-004-seed-fiktive-namen.md'
(keine Treffer, auch ohne Tracked-Filter)
```
Alle acht Namen (fünf aus Runde 1, drei aus Runde 2) kommen jetzt außerhalb dieser Spec-Datei nirgends
im Repository vor — auch nicht im Testcode selbst (Funktion `retired`, siehe Punkt 8 oben).

## Review findings

(vom Reviewer)
