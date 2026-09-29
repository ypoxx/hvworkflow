# Scheibe 033b — Kennzahlen, Kennzahlen-Allowlist-Tor und Auswertungskatalog

**Status:** spec (nach Lesebefund 29.09.2026 nachgebessert)
**Risikoklasse:** hoch · 1 AStd · 27.10.2026 (W5) · Lanes: service, core, infra, docs-plan, docs-adr, docs-sicherheit
**Rolle:** Implementierer-Backend; Architekt für die Absätze in ADR 0013 (Lane docs-adr, „nur Architekt“, Plan 5.1); unabhängiges Review in frischem Kontext mit Perspektive Datenschutz/Betrieb, zusätzlich Sicherheits-Checkliste des Reviewers (SC-03, SC-10, SC-11, SC-12, SP-2, SP-5, SP-6) (Modell nur in `.claude/agents/`, takt-012)
**Rule ids:** keine neue fachliche Regel, keine Änderung an `ROLE_PERMISSIONS`, keine Übergangszeile; AGENTS.md R4 (der Scraper ist kein Akteur, kein `can()`, keine Rollennamen), R6, R8, R11
**Quellen-IDs:** `docs/produktplan-beta.md` §5.4/033b (Teil 2 der am 29.09.2026 geteilten Scheibe 033); ADR 0013 (fünf Kennzahlen, Allowlist-Tor, generierter Katalog, Rate-Limit-Zähler flüchtig); Vertrag `getMetrics` und `metricsBearer` seit 0.3.0; Rechtekonzept Abschnitt 6; Bedrohungsmodell Abschnitt 6 Zeile 033; Leitplanken 6.6
**Depends on:** 033a (gemergt vor Baubeginn)
**Perspektive:** Datenschutz/Betrieb · **Glossar: neue Begriffe:** nein

Warum geteilt: siehe Abschnitt „Warum geteilt“ in `docs/slices/033a-serverzeit-health-zugriffslog.md`.

## Ziel und Entscheidungen vor Bau

1. **Reine Kernfunktion.** `packages/domain/src/indicators.ts` berechnet aus `readonly DomainEvent[]` (bzw. der Projektion) und einem übergebenen `now` die fünf Kennzahlen; keine I/O, keine Uhr, kein Akteur. Sie liegt im Kern, damit der Leitstand (061) dieselben Definitionen nutzt, statt sie nachzubauen; ob 061 sie über `HvApi` mit `cockpit.read` anbietet, entscheidet 061. Export über `packages/domain/src/index.ts`. Ereigniszeit ist `recordedAt ?? at` (Serverzeit, ADR 0011), nie `occurredAt` eines Geräts oder Papiers.
2. **Definitionen (Standard, im Katalog wörtlich):** betrachtet werden Jahrgänge im Status `running`; ohne laufenden Jahrgang erscheinen für 1–4 nur `# HELP`/`# TYPE`. „Offen“ heißt Status nicht in {`delivered`, `closed`, `withdrawn`, `merged`}.
   - `hv_open_question_oldest_age_seconds{meeting_id}` (gauge): `now` minus Erfassungszeit der ältesten offenen Einzelfrage; 0 ohne offene Frage.
   - `hv_open_questions{meeting_id,unit_id}` (gauge): offene Einzelfragen je zugewiesenem Fachbereich; ohne Zuweisung `unit_id="unassigned"`.
   - `hv_questions_captured_last_5m{meeting_id}` (gauge): in den letzten 300 s erfasste Einzelfragen.
   - `hv_questions_in_legal_review_over_10m{meeting_id}` (gauge): Einzelfragen im Status `in_review` ohne Rechtsfreigabe der aktuellen Fassung, deren Eintritt in `in_review` länger als 600 s zurückliegt.
   - `hv_events_last_1m` (gauge, ohne Label): Ereignisse mit Serverzeit in den letzten 60 s über alle Jahrgänge.
   Label-Werte sind nur Jahrgangs- und Fachbereichs-IDs aus der Konfiguration, nie Akteur-, Personen-, Sitzungs- oder Subject-IDs.
3. **Route `GET /metrics`** (`getMetrics`, außerhalb `/v1`): Auth-Ausnahme exakt `/metrics` in der Actor-Middleware; stattdessen Bearer-Prüfung gegen `HV_METRICS_TOKEN` (mindestens 32 Zeichen) mit `timingSafeEqual` über SHA-256-Digests. Ohne konfigurierten Token antwortet jeder Aufruf 401 (geschlossen, kein 503: der Vertrag kennt nur 200/401). Die Bearer-Prüfung liegt **vor** jedem Speicherzugriff. Antwort `text/plain; version=0.0.4; charset=utf-8` im Prometheus-Textformat, genau die Familien aus dem Katalog. Im Postgres-Modus lädt die Route einen eigenen Snapshot (`REPEATABLE READ READ ONLY`, kein Advisory-Lock, Kettenprüfung wie bei Fachlesungen); sie nutzt nie die globale In-Memory-Projektion (mit takt-024 wirft der `domain`-Proxy ohne Grenze). Ergebnis-Zwischenspeicher 10 s mit einer laufenden Berechnung, damit häufiges Abfragen keinen Vollscan je Aufruf auslöst (T-G2-D-03, Messung folgt 071). Zugriffslog-Zeile aus 033a mit `subjectHash: null` (der Scraper ist kein Akteur); der Token erscheint nirgends im Log. Der Eintrag `getMetrics` wird aus `packages/contract/allowlist.json` entfernt (Ausnahme zur Lane-Regel wie in 033a: Eintrag trägt `033`).
4. **Katalogquelle:** `apps/api/src/metrics/catalog.json` ist die einzige Quelle für Dienst, Tor und Katalog: je Kennzahl `name`, `type`, `help`, `labels`, `purpose`, `source` (Ereignisse), `aggregation`, `personalReference`, `spec`. JSON statt TypeScript, weil Node-22-Skripte in CI es ohne Übersetzer lesen.
5. **Kennzahlen-Allowlist-Tor** `scripts/metrics-allowlist-check.mjs` als `pnpm metrics-allowlist`, aufgenommen in `pnpm gates` (Root-`package.json`) und in die Gate-Liste von AGENTS.md. Rot, wenn (a) ein Name nicht `^hv_[a-z0-9_]+$` entspricht oder doppelt ist; (b) ein Label außerhalb {`meeting_id`, `unit_id`} liegt; (c) ein Name oder Label auf Personenbezug deutet (`subject`, `actor`, `person`, `user`, `employee`, `assignee`, `claim`, `session`, `login`, `email`, `ip`), und zwar **immer**, auch mit Spec-Eintrag. **Entscheidung (strenger als der Wortlaut von ADR 0013, Zeile 35 „keine Kennzahl je Subject ohne Spec-Eintrag“):** der Wortlaut ließe eine Kennzahl je Subject mit Spec-Eintrag zu; das widerspricht dem Satz „Keine Kennzahl je Person“ derselben ADR und dem Rechtekonzept Abschnitt 6 („technisch deaktiviert“). Das Tor folgt der strengeren Lesart; der Architekt hat die ADR am 29.09.2026 vor dem Bau angeglichen. Eine Lockerung braucht eine ADR-Änderung, keinen Tor-Schalter; (d) ein Name `rate_limit` enthält (flüchtig, ADR 0013, nie im Katalog); (e) das Feld `spec` keine Datei `docs/slices/<spec>-*.md` nennt, deren Abschnitt „## Kennzahlen-Allowlist“ den Namen in Backticks enthält. Ein Laufzeittest (unten) sichert, dass `/metrics` keine Familie und kein Label außerhalb des Katalogs ausgibt; Tor und Test zusammen schließen die Lücke „Code gibt eine Kennzahl aus, die nicht im Katalog steht“.
6. **Generierter Auswertungskatalog (Erstfassung)** `scripts/auswertungskatalog.mjs` schreibt deterministisch (keine Zeitstempel; Commit nur aus `GITHUB_SHA`, sonst `lokal`) `dist/auswertungskatalog/auswertungskatalog.md` und `.json` (Verzeichnis ist über `dist/` bereits ignoriert). Inhalt: die fünf Kennzahlen mit Definition, Zweck, Labels, Aggregation, Personenbezug; der ausdrückliche Satz „Es gibt keine Kennzahl je Person.“; Abschnitt „Nicht im Katalog“: Rate-Limit-Zähler (034, flüchtig, nicht auswertbar), Zugriffslog (033a, nur im Verfahren zu zweit, keine Kennzahl), Vorgangshistorie (Ebene 1). Neuer CI-Schritt in `.github/workflows/gates.yml` erzeugt ihn bei jedem Lauf und lädt ihn als Artefakt `auswertungskatalog` hoch; `actions/upload-artifact` auf einen vollen Commit-Hash gepinnt (SC-10), minimal berechtigt. Diff-Tor und Vervollständigung folgen in 073.
8. **Erkennungssignal Rollenverlust (Nachtrag Architekt, 29.09.2026, aus takt-023/Codex P1 zu Spec 030).** Zähler
   `hv_auth_no_active_role_total` (Counter, keine Labels) in `apps/api/src/app.ts`: +1 bei jeder Antwort `403
   NoActiveRole` auf `GET /auth/me` und bei jeder `403`, die eine Sitzung ohne aktive Rolle auf `/v1` erhält.
   Prozesslokal, nicht persistiert, nicht aus Ereignissen (Kernfunktion bleibt rein), kein Bezug auf Subject,
   Sitzung oder Pfad. Katalogeintrag mit `personalReference: "keiner"`, Zweck „Erkennung Missbrauchsfall
   Rollenverlust (Spec 030)“. Test: zwei 403 einer rollenlosen Sitzung → Zähler 2; die Ausgabe enthält keine
   Actor-ID. Damit endet die befristete Ausnahme in Spec 030.
7. **Personenbezug über kleine Fachbereiche (offen, E13):** Hat ein Fachbereich genau eine Person, wird `hv_open_questions{unit_id}` faktisch eine Kennzahl je Person. Die Mindest-Aggregationsschwelle ist Sache der Betriebsvereinbarung (E13). Standard in 033b: Katalogfeld `personalReference` nennt diese Grenze wörtlich; keine Unterdrückung im Code. Der Bericht führt das unter „Open“.

## Kennzahlen-Allowlist

Die Einträge, auf die `catalog.json` mit `"spec": "033b"` verweist:

- `hv_open_question_oldest_age_seconds` — Labels `meeting_id`
- `hv_open_questions` — Labels `meeting_id`, `unit_id`
- `hv_questions_captured_last_5m` — Labels `meeting_id`
- `hv_questions_in_legal_review_over_10m` — Labels `meeting_id`
- `hv_events_last_1m` — keine Labels
- `hv_auth_no_active_role_total` — keine Labels (technische Zählung, prozesslokal, nicht aus Ereignissen)

## Nicht-Ziele

Keine Kennzahl je Person, je Subject, je Sitzung oder je Bühnenplatz. Kein Leitstand, keine Oberfläche (061). Keine Alarmierung, kein Prometheus/Grafana-Stack (037). Kein Diff-Tor des Katalogs, keine Rechtsgrundlagen-Matrix (073). Kein Rate-Limit und keine Rate-Limit-Kennzahl (034). Keine neue Berechtigung, kein `can()`-Pfad für den Scraper. Keine Änderung an Zugriffslog, NTP oder `X-Server-Time` (033a). Keine Vertragsänderung (Ausnahme nur nach „Vor dem Bau prüfen“, Punkt 2).

## Bedrohungen, Missbrauchsfall und Test je ID

| ID | Rolle in 033b | Test (Datei) |
|---|---|---|
| T-G3-I-03 | muss schließen (Anteil 033b; Alarmweg 037) | Tor rot bei absichtlicher Kennzahl je Person: Fixture mit Label `subject_hash`, Fixture mit Name `hv_answers_per_actor`, Fixture mit Label `unit_id` plus `user` im Namen, Fixture mit `rate_limit` (`scripts/metrics-allowlist-check.test.mjs`); `/metrics` mit synthetischem Korpus enthält keine Actor-ID, keine `personId`, keinen Anzeigenamen und keinen Marker-Fragetext (`metrics033b.test.ts`) |
| T-G3-I-04 | berührt | Label-Namen der Ausgabe ⊆ Katalog-Labels ⊆ {`meeting_id`, `unit_id`} (`metrics033b.test.ts`) |
| **T-G1-I-10 (neu)** | schließen | Kennzahlen ohne Berechtigung: 401 ohne `Authorization`, mit falschem Token, mit Token gleicher Länge, ohne konfigurierten Token; kein Speicherzugriff vor der Prüfung (Test-Store zählt Lesungen); Token in keiner Log-Zeile (`metrics033b.test.ts`); neue Zeile im Bedrohungsmodell |
| T-G2-D-03 | berührt | 20 Abfragen in 10 s lösen genau eine Berechnung aus (`metrics033b.test.ts`); Postgres-Pfad ohne Advisory-Lock und mit Kettenprüfung (`postgres-metrics033b.test.ts`) |
| T-G1-I-01/SC-03 | berührt | Werte sind Zählungen je Jahrgang/Fachbereich ohne Inhalt oder ID einer Einzelfrage; ein zurückgezogener oder zusammengeführter Vorgang ändert nur Zähler (`indicators033b.test.ts`) |

Grenzfälle der Kernfunktion mit fester Uhr (`indicators033b.test.ts`): genau 300 s und 301 s für den Zulauf, genau 600 s und 601 s für die Rechtsfreigabe, 60/61 s für Ereignisse, `occurredAt` aus Papier-Erfassung wird ignoriert, Frage ohne Zuweisung zählt unter `unassigned`, Rechtsfreigabe der Vorfassung zählt nicht als Freigabe, kein laufender Jahrgang.

**Missbrauchsfall (SC-06):** Ein späteres Release fügt „Antworten je Bearbeiterin“ hinzu, um Engpässe zu zeigen (ADR 0013, Risiko). Das Tor ist rot, unabhängig von einem Spec-Eintrag; der Katalog-Diff wäre für Betriebsrat und DSB sichtbar (Diff-Tor 073). Verwandt: MF-02.

## Files allowed

- `docs/slices/033b-kennzahlen-allowlist-katalog.md`
- `packages/domain/src/indicators.ts` (neu), `packages/domain/src/index.ts` (nur Export), `packages/domain/src/__tests__/indicators033b.test.ts`
- `apps/api/src/metrics/**` (neu: `catalog.json`, Prometheus-Ausgabe, Bearer-Prüfung, Zwischenspeicher)
- `apps/api/src/app.ts` (nur Route `/metrics`, Auth-Ausnahme exakt `/metrics`, Snapshot-Lesung im Postgres-Modus; dazu das Hochzählen von `hv_auth_no_active_role_total` bei `403 NoActiveRole` auf `/auth/me` und bei `403` einer rollenlosen Sitzung auf `/v1`, Ziel 8)
- `apps/api/src/server.ts` (nur `HV_METRICS_TOKEN`)
- `apps/api/src/observability/config.ts` (nur Prüfung von `HV_METRICS_TOKEN`, falls die Konfiguration dort liegt)
- `apps/api/src/__tests__/metrics033b.test.ts`, `apps/api/src/__tests__/postgres-metrics033b.test.ts`
- `packages/contract/allowlist.json` (nur Eintrag `getMetrics` entfernen)
- `packages/contract/openapi.yaml`, `packages/contract/CHANGELOG.md`, `packages/contract/package.json`, `packages/contract/src/types.ts`, `apps/api/src/__tests__/contract.test.ts`, `apps/api/src/__tests__/takt-019-contract.test.ts` (nur im Ausnahmefall aus „Vor dem Bau prüfen“, Punkt 2)
- `scripts/metrics-allowlist-check.mjs`, `scripts/metrics-allowlist-check.test.mjs`, `scripts/auswertungskatalog.mjs`, `scripts/auswertungskatalog.test.mjs`, `scripts/fixtures/metrics-allowlist/**`
- `package.json` (nur Skript `metrics-allowlist` und dessen Aufnahme in `gates`)
- `.github/workflows/gates.yml` (nur Katalog-Schritt mit gepinntem Artefakt-Upload, `postgres-metrics033b.test.ts` im Postgres-Schritt, Schrittname der gates-Zeile)
- `AGENTS.md` (nur die Gate-Liste im Kommentar zu `pnpm gates`)
- `docs/adr/0013-zwei-protokollebenen.md` (nur Zeile „Keine Kennzahl je Person“ auf die strengere Lesart des Tors und Nachweis-Abschnitt: Tor, Artefakt, Definitionen; **geschrieben vom Architekten**, nicht vom Implementierer; steht hier, damit dessen Commit auf dem Baubranch das Scheibenumfang-Tor passiert)
- `docs/sicherheit/bedrohungsmodell.md` (nur Status und Nachweise der oben genannten IDs, neue Zeile T-G1-I-10)
- `docs/folgeliste.md` (nur nicht blockierende Reviewbefunde dieser Scheibe)

## Vor dem Bau prüfen

1. 033a ist gemergt; `/healthz`, Anfragekontext und Zugriffslog sind vorhanden. Mit takt-024 (`guarded`, Proxy wirft ohne Postgres-Grenze) muss `/metrics` seinen Snapshot selbst laden; ohne takt-024 ebenso, weil `/metrics` außerhalb von `/v1` liegt.
2. Vertragsversion wie in 033a Punkt 2: keine Änderung geplant; nur im Ausnahmefall additiv mit aktuellem Stand + 1 Patch und den beiden festen Versionsaussagen. Prüfen: `metricsBearer` und die 401-Antwort von `getMetrics` decken das Verhalten ohne Token; `helpers.ts` validiert `text/plain` als Zeichenkette.
3. `packages/contract/allowlist.json`: `getMetrics` mit `slice: "033"` entfernen; Operation-Coverage muss `getMetrics` über `req()` mit gültigem Token sehen (Test setzt den Token über die Option, nie aus der Umgebung des Entwicklers).
4. Status- und Ereignisnamen für „Eintritt in `in_review`“, Zuweisung an Fachbereich und Rechtsfreigabe der aktuellen Fassung in `packages/domain/src/transitions.ts`, `events.ts`, `state.ts` nachlesen (021c); weicht die Definition in Punkt 2 vom Kern ab, Spec klären, nicht still umdeuten.
5. Core-Lane am 27.10. frei (heute keine andere Kern-Scheibe an diesem Tag); `packages/domain/policy-truth-table.md` darf sich nicht ändern.
6. `node --test 'scripts/**/*.test.mjs'` erfasst die neuen Skript-Tests; `pnpm plan-honesty` bleibt grün (keine neue „geplant in Scheibe“-Zeile nötig).
7. Plan 5.1: Lane docs-adr ist „nur Architekt“. Liegen die ADR-Änderungen (Punkt 5, Nachweis) vor Baubeginn nicht vor, baut der Implementierer ohne sie; der Architekt reicht sie im Review-Nachtrag nach, der Merge wartet darauf. AGENTS.md (Lane docs-plan) ändert der Implementierer nur in der Gate-Liste.
8. Commit-Hash für `actions/upload-artifact` per `git ls-remote https://github.com/actions/upload-artifact 'refs/tags/v4*'` ermitteln und mit Versionskommentar pinnen.

## Tests zuerst und Abnahme

1. Vor der Implementierung rot: `indicators033b.test.ts` (Grenzfälle oben), `metrics033b.test.ts` (401-Fälle, 200 mit gültigem Token, Familien und Labels exakt aus dem Katalog, keine Personen-IDs oder Fragetexte, Zwischenspeicher, Zugriffslog-Zeile mit `subjectHash: null` und ohne Token), `scripts/metrics-allowlist-check.test.mjs` (grün auf dem echten Katalog, rot auf jeder Fixture), `scripts/auswertungskatalog.test.mjs` (zwei Läufe byteidentisch, Satz „Es gibt keine Kennzahl je Person.“ und Abschnitt „Nicht im Katalog“ vorhanden).
2. Postgres in CI: `postgres-metrics033b.test.ts` (Snapshot ohne Lock, beschädigte Kette → 500 ohne Kennzahl, keine Diagnosedaten).
3. `pnpm gates` mit dem neuen Tor auf sauberem Baucommit grün, wörtlicher Schluss im Bericht; der absichtlich rote Lauf des Tors gegen eine Fixture mit Kennzahl je Person als Ausgabe im Bericht; Katalog-Artefakt im PR-CI-Lauf sichtbar (Link oder Name des Artefakts). `curl -s -H "Authorization: Bearer <synthetischer Token>" localhost:8787/metrics` gegen den Demo-Dienst als Ausgabe im Bericht.
4. Unabhängiges Review in frischem Kontext mit Perspektive Datenschutz/Betrieb; Blocker/Major und jede Datenschutz- oder Sicherheitsfrage vor Merge, übrige Befunde in `docs/folgeliste.md`. PR-CI auf dem letzten Commit grün. Jeder Commit nennt „Scheibe 033b“ und endet `[skip netlify]`. Kein Deploy.

## Nachweise

`pnpm gates`-Schluss, roter Torlauf mit Fixture, Katalog-Artefakt aus CI, `curl /metrics`-Ausgabe mit synthetischem Korpus, Testnamen je Bedrohungs-ID.

## Bericht (nach Bau ausfüllen)

```
Slice: 033b-kennzahlen-allowlist-katalog
Done: <drei Zeilen>
Evidence: Baucommit <sha>; Schluss von `pnpm gates`; roter Torlauf; Artefakt `auswertungskatalog` im CI-Lauf <id>; curl /metrics
Bedrohungs-ID → Test: <je Zeile der Tabelle oben>
Open: E13 Mindest-Aggregationsschwelle (Einpersonen-Fachbereich); Diff-Tor 073; Alarmweg 037; Scan-Kosten 071
Touched: <Dateiliste>
```

## Lesebefund vor dem Bau (29.09.2026)

Lesebefund (Opus, frischer Kontext): nachbessern, 3 major / 6 minor / 1 nit → vom Planer eingearbeitet; ADR-0013-Absätze
vom Architekten. Schmale Nachprüfung (Opus): die drei Major gelöst; drei neue Major (ADR-Satz zu Betrieb/Support zu
weit, Planzeile 033b mit altem Tor-Wortlaut, Files allowed ohne Zähler-Hochzählen) vom Architekten behoben.

## Review findings

folgt
