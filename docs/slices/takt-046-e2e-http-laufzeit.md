# takt-046 — Laufzeit e2e-http: Grenzen mit Puffer, Dauerzeile und weiche Warnschwelle

**Status:** gebaut · **Risikoklasse:** niedrig (nur CI-Konfiguration und das Test-Harness eines CI-Jobs, kein Produktivcode, kein Vertrag, keine Persistenz, kein Betrieb, keine neuen Rechte oder Geheimnisse; Leitplanken §4) · ≤ 0,5 AStd · **Lanes:** CI
**Rolle:** builder; Review in frischem Kontext (Perspektive: läuft die Aufräumphase weiter sicher innerhalb der Schrittgrenze, und verrät die neue Ausgabe nichts?), Modell nur in `.claude/agents/` (takt-012); niedriges Risiko, Review mit Sonnet zulässig (AGENTS.md R3)
**Regeln:** AGENTS.md R1, R2, R3, R11 (keine Zugangsdaten in Ausgaben), R12; 031a Entscheidung „die Aufräumphase läuft immer innerhalb der Schrittgrenze“ (`CLEANUP_RESERVE_MS`), 031a „bei einem Fehlschlag erreicht nur der Name der Phase stderr“
**Quellen-IDs:** Plan Abschnitt 5, Stand zu 054 (Zeile 781: Takt „Grenze anheben oder Job teilen“ fällig, bevor der Schritt etwa 6:30 erreicht); 055b-Spec (Messungen gegen 8:00/9:00)
**Depends on:** keine
**Perspektive:** CI-Laufzeit, Messbarkeit · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `f4e0278`)

**Grenzen heute:**

| Ort | Wert | Bedeutung |
|---|---|---|
| `.github/workflows/gates.yml`, Job `e2e-http` | `timeout-minutes: 15` | ganzer Job |
| ebd., Schritt „Install Chromium for Playwright“ | `timeout-minutes: 4` | Browser-Installation |
| ebd., Schritt „End-to-end http project against Hono, Postgres and Keycloak“ | `timeout-minutes: 9` | Harness-Lauf |
| `scripts/e2e-http-031.mjs`, `TOTAL_MS` | `480_000` (8:00) | interne Gesamtgrenze; darin `CLEANUP_RESERVE_MS = 30_000`, der Playwright-Lauf bekommt den Rest |
| `scripts/e2e-http-031.test.mjs` | Job `/timeout-minutes: 15/`, Schritt `/…timeout-minutes: 9/`, `TOTAL_MS < 9 * 60_000` | pinnt die drei Werte |

**Gemessene Dauer des Schritts „End-to-end http project …“** (Zeitstempel der Schritte über
`gh api repos/ypoxx/hvworkflow/actions/runs/<id>/jobs`):

| Lauf | Schritt | Vorlauf des Jobs bis zum Schritt | Chromium-Schritt |
|---|---|---|---|
| 37251657065 | 4:06 | 0:49 | 0:19 |
| 37240940303 | 4:09 | 0:51 | 0:20 |
| 37239067336 | 5:35 | 0:57 | 0:23 |
| 37249410736 | 5:45 | 0:57 | 0:22 |
| dazu laut Auftrag | 5:33 | – | – |
| früher (054): 37223187826, 37225467013 | 5:30, 4:45 | 0:55, 1:08 | 0:23, 0:28 |

Der Höchstwert 5:45 liegt 0:45 unter der Planschwelle 6:30 und 2:15 unter der Harness-Grenze 8:00. Auffällig: bei
gleicher Suite streuen die Läufe zweigipflig (rund 4:07 und rund 5:35), also um gut 1:30 allein durch den Runner. Die
Job-Logs sind über `gh api` nicht lesbar (Weiterleitung auf einen Blob-Host), daher gibt es heute keine Aufteilung nach
Phasen (Keycloak-Start, Migration, Bootstrap, Vite-Build, Playwright, Zugriffslog). Genau diese Zahlen bräuchte eine
spätere Entscheidung „Job teilen“.

**Reihenfolge-Abhängigkeit:** `SHARED_SPECS` in `apps/web/playwright.config.ts` (002, 021b, 021c, 045, 053, 054, 055b,
080, abnahme) laufen mit einem Worker in Pfadreihenfolge, zwischen 021c und 045 stehen 030 und 031. Jede geteilte Datei
startet vom Datenbankzustand ihrer Vorgänger. `scripts/e2e-http-031.test.mjs` pinnt die Reihenfolge (`HTTP_ORDER`, Test
„order: …“). 030 und 031 laufen auch ohne IdP und hängen nicht an der Kette.

## Abwägung

**(a) Grenzen mit Puffer anheben, Dauerzeile, weiche Warnschwelle.** Drei Zahlen und eine Ausgabe. Die Suite wird
nicht schneller, aber der Job bricht bei Runner-Streuung nicht mehr knapp ab. Jeder Lauf meldet seine Dauer je Phase, so
dass die Teilungsfrage später mit Daten entschieden wird. Aufwand ≤ 0,5 AStd. Risiko: Ein hängender Lauf belegt den
Runner bis zu 20 statt 15 Minuten.

**(b) Zwei Jobs mit je eigener Datenbank.** Die Kette 002 → 021b → 021c → 045 → 053 → 054 → 055b → 080 → abnahme lässt
sich nur an einer Stelle schneiden, wenn der zweite Job den Zustand am Schnitt herstellen kann. Dafür gibt es drei Wege,
alle teuer:
- *Präfix im zweiten Job wiederholen:* spart nichts an der Kette, verdoppelt nur die Kopfkosten.
- *Zustand übergeben* (Datenbankabzug als Artefakt): Dazu gehören auch die angemeldeten Zustände (`state-*.json` mit
  Sitzungs-Cookies), Keycloak-Sitzungen und die zufälligen Zugangsdaten je Lauf. Die liegen heute absichtlich nur in
  einem 0700-Verzeichnis außerhalb des Repos und werden am Ende gelöscht (031a). Eine Übergabe zwischen Jobs widerspräche
  dem und wäre selbst eine Sicherheitsscheibe (Risikoklasse mindestens mittel).
- *Jede geteilte Datei setzt ihren Ausgangszustand selbst auf:* betrifft neun e2e-Dateien, die zugleich im
  `in-process`-Projekt laufen, dazu Bootstrap-Hilfen. Geschätzt 6–10 AStd mit Review. Zusätzlich kostet jeder Job
  seinen eigenen Kopf: gemessen 0:49–1:08 Vorlauf und 0:19–0:28 Chromium, dazu Keycloak-Start, Migration, Bootstrap und
  Vite-Build des Harness (nicht getrennt gemessen, s. o.). Die Kopfzeit fällt doppelt an, die Runner-Minuten steigen.
  Und der neue Job müsste als Pflichtprüfung eingetragen werden (Owner-Frage 1 aus 031a).

Bei heute 5:45 gegen 8:00 ist das unverhältnismäßig.

**(c) Sharding** (`playwright test --shard`). Teilt nach Dateien auf getrennte Maschinen. Die geordnete Zustandskette
und `--workers=1` schließen das aus, solange (b) mit eigenem Ausgangszustand je Datei nicht gebaut ist. Nicht tragfähig.

**Entscheidung: (a).** Die Warnschwelle liegt auf der Planschwelle 6:30. Erscheint die Warnung regelmäßig, ist das der
datengestützte Auslöser für eine eigene Teilungsscheibe, mit den Phasenzeiten aus der Dauerzeile als Grundlage.

## Ziel

1. **Harness** (`scripts/e2e-http-031.mjs`):
   - `TOTAL_MS` von `480_000` auf `720_000` (12:00). Der Kommentar nennt die 14 Minuten des CI-Schritts.
     `CLEANUP_RESERVE_MS` bleibt `30_000`.
   - Neue Konstante `WARN_MS = 390_000` (6:30, Planschwelle). Sie ist weich: Sie ändert weder Exit-Code noch Ablauf.
   - Phasenzeiten: Beim Eintritt in jede der heutigen Hauptphasen (1 Keycloak, 2 Datenbank mit Migration, 3 Bootstrap,
     4 Dienststart, 5 Playwright, 6 Zugriffslog, 7 Aufräumen) hält der Harness `Date.now()` fest. Phasennamen sind feste
     Zeichenketten aus dem Quelltext, nie Fehlertexte. Ohne IdP fehlt Phase 1 in der Zeile.
   - Neue exportierte, reine Funktion `formatDuration({ totalMs, limitMs, warnMs, stages })`. `stages` ist eine Liste
     `[name, ms]` in Laufreihenfolge. Rückgabe `{ line, annotation }`:
     - `line`: `031a duration: total m:ss of limit m:ss, warning above m:ss; stages: <name> m:ss, …` (Minuten ohne
       führende Null, Sekunden zweistellig, abgerundet).
     - `annotation`: `::notice title=e2e-http duration::<line>`, wenn `totalMs <= warnMs`, sonst
       `::warning title=e2e-http duration::<line> (above the soft threshold; see takt-046 for the split decision)`.
     Die GitHub-Annotation macht die Zahl ohne Log-Zugriff abrufbar (`gh api repos/ypoxx/hvworkflow/check-runs/<job-id>/annotations`).
     Lokal ist sie eine harmlose Textzeile.
   - Ausgabe im `finally` von `main()` nach dem Aufräumen, also bei Erfolg, Fehlschlag, Signal und Gesamtgrenze: erst
     `line`, dann `annotation`, beide über `say` (stdout). `--check` gibt keine Dauerzeile aus.
2. **Workflow** (`.github/workflows/gates.yml`, Job `e2e-http`): Schritt „End-to-end http project …“
   `timeout-minutes: 9` → `14` (12:00 Harness plus 2:00 für Node-Start, Prozessende und den 2-s-Notausgang). Job
   `timeout-minutes: 15` → `20`. Rechnung: gemessener Vorlauf höchstens 1:08, Chromium-Grenze 4:00, Schritt 14:00,
   Hochladen und Post-Schritte gemessen unter 0:10, zusammen etwa 19:20. Der Chromium-Schritt bleibt bei 4. Der
   Job-Kommentar bekommt einen Satz zu takt-046 (Grenzen, Warnschwelle). Sonst ändert sich nichts: kein
   `permissions`-Block, keine neue Action, kein neues Geheimnis, kein neuer Schritt.
3. **Test** (`scripts/e2e-http-031.test.mjs`) pinnt die neuen Werte und Bezüge (siehe „Tests“).

Puffer danach: 12:00 gegen den Höchstwert 5:45, also etwa das 2,1-Fache. Auch der langsame Runner-Gipfel plus eine
weitere e2e-Datei passt hinein.

## Nicht-Ziele

- Keine Beschleunigung der Suite. Keine Änderung an `apps/web/playwright.config.ts`, an e2e-Dateien, an der Reihenfolge
  (`HTTP_ORDER`), an `--workers=1`, an Playwright-Timeouts oder Retries.
- Kein Teilen des Jobs, kein Sharding (siehe Abwägung). Das ist eine spätere, eigene Scheibe, wenn die Warnung
  regelmäßig erscheint.
- Die Warnschwelle macht den Job nie rot.
- Keine Änderung am Job `gates`, an dessen Schrittgrenzen oder am Keycloak-Schritt aus 029b.
- Den Plan (`docs/produktplan-beta.md`) ändert diese Scheibe nicht. Den Stand trägt der Orchestrator nach.
- Ältere Specs, die 8:00/9:00 als damaligen Stand nennen (055, 055b, 045), bleiben unverändert. Sie sind historisch.

## Files allowed

- `.github/workflows/gates.yml`
- `scripts/e2e-http-031.mjs`
- `scripts/e2e-http-031.test.mjs`
- `docs/slices/takt-046-e2e-http-laufzeit.md`

## Tests (zuerst)

Der Bau ändert zuerst den Test und zeigt ihn rot gegen den alten Harness und den alten Workflow (Ausgabe in den Bericht).
Erst danach folgt die Umsetzung.

1. Test „workflow: e2e-http is a second job …“: Job `timeout-minutes: 20`, Schritt „End-to-end http project …“
   `timeout-minutes: 14`, Chromium unverändert 4. Die übrigen Zusicherungen (kein eigener `permissions`-Block,
   Workflow-Rechte `contents: read` / `pull-requests: read`, `persist-credentials: false`) bleiben.
2. Test „harness: signals, total time limit, …“: `TOTAL_MS === 720_000`. Die Grenzen werden aus dem Workflow gelesen,
   nicht abgeschrieben: `TOTAL_MS + 60_000 <= Schrittgrenze × 60_000`, und Job-Grenze ≥ Schrittgrenze + Chromium-Grenze
   + 1 (Minuten). Dazu `WARN_MS === 390_000` und `WARN_MS < TOTAL_MS - CLEANUP_RESERVE_MS`.
3. Neuer Test „harness: the duration line reports total, limit, threshold and stages; the annotation is a warning only
   above the threshold“ über `formatDuration`:
   - `totalMs` 345_000, `limitMs` 720_000, `warnMs` 390_000, zwei Phasen: `line` beginnt mit
     `031a duration: total 5:45 of limit 12:00, warning above 6:30; stages: `, die Phasen stehen in Eingabereihenfolge,
     `annotation` beginnt mit `::notice title=e2e-http duration::`.
   - `totalMs` 390_000: noch `::notice` (Grenze ist „darüber“). `totalMs` 390_001: `::warning title=e2e-http duration::`.
   - Formatierung: 61_999 ms ergibt `1:01`, 600_000 ms ergibt `10:00`.
4. Neuer Quelltext-Test: `formatDuration` wird im `finally` von `main` aufgerufen (Regex auf den Quelltext, wie die
   bestehenden Harness-Tests). Die Funktion bekommt keine Fehlerobjekte: Ihre Signatur kennt nur die vier Felder.

## Akzeptanzkriterium

1. `node --test scripts/e2e-http-031.test.mjs` ist erst rot (vor der Umsetzung, Ausgabe im Bericht), dann grün.
2. `pnpm gates` grün auf sauberem Commit, einschließlich slice-scope. Der Schluss der Ausgabe steht im Bericht.
3. **CI auf dem PR:** Job `e2e-http` grün auf dem letzten Commit. Seine Annotationen enthalten genau eine Zeile
   `e2e-http duration` mit Gesamtdauer, Grenze 12:00, Schwelle 6:30 und den Phasen. Abruf über
   `gh api repos/ypoxx/hvworkflow/check-runs/<job-id>/annotations`, Lauf-ID, Job-ID und der Text stehen im Bericht. Die
   Gesamtdauer der Zeile und die Schrittdauer aus `…/actions/runs/<id>/jobs` liegen höchstens 0:15 auseinander.
4. Optional lokal: `E2E_HTTP_IDP=none pnpm e2e:http` druckt die Dauerzeile ohne Keycloak-Phase.

## Nachweise

Kein Screenshot (keine Oberfläche). Nachweise sind die rote und die grüne Testausgabe, der `pnpm gates`-Schluss sowie
Lauf-ID, Job-ID und Annotationstext aus Kriterium 3.

## Sicherheit

- Workflow-Rechte unverändert (`contents: read`, `pull-requests: read`, vererbt, der Test sichert es weiter). Keine
  neue Action, kein neues Geheimnis, keine neue Umgebungsvariable.
- Die neue Ausgabe enthält nur Zahlen und feste Phasennamen aus dem Quelltext, keine Fehlertexte, Pfade,
  Verbindungs-URLs, Datenbanknamen oder Werte aus `secrets`. Annotationen sind auf öffentlichen PRs sichtbar, das ist mit
  diesem Inhalt unbedenklich.
- Die Aufräum-Garantie bleibt erhalten: Die Harness-Grenze liegt 2:00 unter der Schrittgrenze (bisher 1:00), die
  Playwright-Grenze rechnet weiter `TOTAL_MS − verbrauchte Zeit − CLEANUP_RESERVE_MS`.
- Längere Grenzen verlängern nur die Belegung eines hängenden Runners (höchstens 20 Minuten), sie öffnen nichts.

## Wirkung und Risiko (Leitplanken §4, niedrig)

- **Produktivwirkung:** keine.
- **Risiko:** Ein echtes Hängen wird 5 Minuten später gemeldet. Gegenmittel: Die Phasenzeile zeigt beim Abbruch, in
  welcher Phase die Zeit lag (`total time limit, last stage …` bleibt zusätzlich auf stderr).
- **Folgeauslöser (für den Orchestrator, nicht Teil dieser Scheibe):** Warnt die Annotation in zwei der letzten fünf
  PR-Läufe, wird eine Teilungsscheibe auf Basis der Phasenzeiten fällig. Spätestens bei einer Schrittdauer um 10:00 kommt
  vor jeder weiteren e2e-Datei im `http`-Projekt zuerst die Teilung.

## Aufwand

≤ 0,5 AStd: Test zuerst etwa 0,15, Harness und Workflow etwa 0,15, Gates, CI-Lauf und Bericht etwa 0,2.

## Bericht

```
Slice: takt-046-e2e-http-laufzeit
Done: Test zuerst erweitert (Grenzen aus dem Workflow gelesen, WARN_MS, formatDuration, Quelltext-Test zum finally);
      danach Harness (TOTAL_MS 720_000, WARN_MS 390_000, formatDuration, Phasenzeiten, Ausgabe im finally von main) und
      Workflow (Schritt 14, Job 20, Chromium 4, Kommentar) umgesetzt.
Evidence: Test rot vor der Umsetzung: `node --test scripts/e2e-http-031.test.mjs` -> `# tests 1 / # fail 1`,
      `SyntaxError: The requested module './e2e-http-031.mjs' does not provide an export named 'formatDuration'`.
      Grün danach: `# tests 43 / # pass 43 / # fail 0`.
      `pnpm gates` exit 0 auf Commit 546f67c, Schluss:
      `mark-test-run: wrote .../.claude/state/last-test-run (clean tree) at commit 546f67c, tree 5ab9010e2ef5…`
      CI (Nachtrag des Orchestrators): Lauf 37333958013, Job e2e-http 111843861779, grün auf 695be18; Annotation
      `notice e2e-http duration: 031a duration: total 5:55 of limit 12:00, warning above 6:30; stages: keycloak 0:34,
      database 0:00, bootstrap 0:01, service 0:01, playwright 5:18, access-log 0:00, cleanup 0:00`.
Open: Akzeptanzkriterium 4 (optionaler lokaler Lauf) nicht ausgeführt. Review (Sonnet): kein Blocker, kein Major; ein Minor und drei Nits in die Folgeliste.
Touched: .github/workflows/gates.yml, scripts/e2e-http-031.mjs, scripts/e2e-http-031.test.mjs,
      docs/slices/takt-046-e2e-http-laufzeit.md
```

## Review findings
