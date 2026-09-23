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

## Review findings

(vom Reviewer)
