# takt-052 — Seed-Zeiten über die Stunde vor Demostart verteilen

**Status:** spec · **Risikoklasse:** mittel (Verhaltensänderung des synthetischen Demo-Korpus: andere Zeitstempel, damit
andere Hashes im gestempelten Log und andere Werte im Golden von `/metrics`; kein Vertrag, keine Rechte, kein Personenbezug,
kein Statusübergang, kein Produktivcode außerhalb des Seeds, keine Migration. Leitplanken §4; kein Hoch-Auslöser, weil
keine Zeitlogik, kein Audit und keine Freigabe berührt werden, nur Werte synthetischer Daten) · ca. 1 AStd · 06.10.2026 ·
**Lanes:** domain (Seed), Tests
**Rolle:** builder; ein Review in frischem Kontext (Lean-Modus, AGENTS.md R3; Perspektive: Fachliche Korrektheit und
Test-Determinismus), Modell nur in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R5 (keine Statuslogik im Seed, die Übergänge bleiben dieselben), R7 (Ereignisse nur
angehängt; der Seed erzeugt ein neues Log, ändert kein bestehendes), R8 (der Seed liest nur `o.now`, die injizierte Uhr
von `seedDemo`), R11 (nur synthetische Daten), R12. Keine Rule ids aus `transitions.ts` (keine Zeile ändert sich).
Gleiche Definitionen wie 061 (Zulauf: 12 Fenster je 300 s, `CAPTURED_WINDOW_MS`; Legal Clearing über 10 min,
`LEGAL_REVIEW_LIMIT_MS`) und 033b; ADR 0011 (`recordedAt` = Serverzeit = `at` bei `occurredAtSource: server`).
**Quellen-IDs:** Designkritik zum Leitstand (061): Zulauf ein Balken („215 in 5 min“) bzw. nach einer Stunde leer,
Listenalter alle gleich („22 min“), Faden mit derselben Uhrzeit an jeder Station. `docs/slices/061-leitstand.md`
(Zulauf, Älteste, Faden).
**Depends on:** 061 Teil A (gemergt, `68c87d9`)
**Perspektive:** Fachliche Korrektheit (Demo-Plausibilität), Test-Determinismus · **Glossar: neue Begriffe:** nein

## Befund (gelesen auf `68c87d9`)

1. **Woher die gleichen Zeiten kommen.** `seedEvents` (`packages/domain/src/seed.ts:382`) führt **eine** fortlaufende Uhr:
   Start `o.now − 6,5 h` (`seed.ts:390`), jedes Ereignis rückt sie mit `tick(min, max)` um einen Zufallsbetrag vor
   (`seed.ts:392–395`), und `tick` kappt bei `o.now` (`Math.min(clock, o.now)`, `seed.ts:394`). Der Korpus wird
   **Frage für Frage** erzeugt: Eine Einzelfrage durchläuft ihren ganzen Lebenslauf (erfasst … geschlossen), bevor die
   nächste erfasst wird. Die Summe der Ticks liegt weit über 6,5 h, also landet fast alles auf `o.now`. Gemessen
   (CORPUS_DEMO): **1566 von 1740 Ereignissen** und **215 von 230 Erfassungen** tragen genau `o.now`; die übrigen 15
   Erfassungen liegen verstreut zwischen 29 und 376 min vor `o.now`. CORPUS_LOAD: 6067 von 6329, 785 von 800.
2. **Nebenbefund (Fehler):** `AnswerDrafted.payload.answer.createdAt` ist `new Date(clock)` **ohne** Kappung
   (`seed.ts:613`, `seed.ts:627`). Im Demo-Korpus liegen damit **174** Antwort-Fassungen nach `o.now`, also in der
   Zukunft (sichtbar über `QuestionDetail.tsx:770`, `at={answer.createdAt}`).
3. **Wie die Demo sät.** Browser: `seedIfEmpty` (`apps/web/src/api/index.ts:154`) ruft `api.seedDemo(CORPUS_DEMO)` mit
   `clock: () => new Date()` (`index.ts:130`). Dienst: `seedDemo({})` beim Start ohne Postgres (`apps/api/src/app.ts:439`)
   und `POST /v1/demo/seed` (`app.ts:1256`). HTTP-e2e und lokaler Stack: `scripts/lib/demo-bootstrap.mjs:21`
   (`clock: () => new Date()`), danach `assignRole`-Ereignisse mit derselben Uhr, also später als jede Seed-Zeit.
   `seedDemo` (`packages/domain/src/api.ts:1643`) reicht `now: clock()` an den Seeder. Der Seed liest keine andere Zeit.
4. **Reihenfolge und Zeit.** Am Ende sortiert der Seed stabil nach `at` (`seed.ts:654`). Weil die Rohuhr in
   Erzeugungsreihenfolge monoton steigt und die Kappung nur Gleichstände erzeugt, ist diese Sortierung heute eine
   Identität: Log-Reihenfolge (später `seq`) = Erzeugungsreihenfolge. `QuestionLegalCleared` übernimmt die Zeit des
   Vorgängers (`seed.ts:587`, `seed.ts:634`), ein Gleichstand, den die stabile Sortierung hält.
5. **Invarianten über Ereigniszeiten.** `stampEvent` setzt `recordedAt = occurredAt = at` (`envelope.ts:131–166`) und
   prüft nur `occurredAt ≤ recordedAt`; `verifyEventChain` prüft `at === recordedAt` und den Hash über das ganze
   Ereignis (`envelope.ts:217–227`). **Keine** Prüfung verlangt, dass Zeiten mit `seq` steigen; auch Postgres nicht
   (`apps/api/migrations/0001_event_log.up.sql`: keine Zeitbedingung). Die Hashkette ändert sich nur in den Werten, nicht
   in der Struktur. `computeCockpit` schneidet je Frage nach `eventTime > now` (`cockpit.ts:110–123`) und faltet die
   Meeting-Ebene ganz; das setzt je Frage steigende Zeiten in Log-Reihenfolge voraus, nicht global.
6. **Wer von den Zeiten abhängt** (grep über `packages/domain/src/__tests__`, `apps/api/src/__tests__`, `apps/web/src`,
   `apps/web/e2e`, `scripts`):
   - `packages/domain/src/__tests__/seed-fictitious-names.test.ts:121` — `PRE_CHANGE_FINGERPRINT = '1bac7aa18a9d88'`
     hasht das ganze Log **einschließlich Zeiten** (Kommentar `:48`). **Muss sich ändern** (siehe Ziel 3).
   - `apps/api/src/__tests__/fixtures/metrics-golden-061.txt` (Test A5, `apps/api/src/__tests__/cockpit061.test.ts:121`)
     — rendert `/metrics` für CORPUS_DEMO bei `fixed + 120 s` und `+ 900 s`. **Muss sich ändern**, und zwar genau in
     vier Wertzeilen (nachgerechnet, siehe Ziel 4). Begründung: A5 sichert, dass 061 den Code von `indicators.ts` nicht
     verändert hat; `indicators.ts` bleibt in dieser Scheibe unberührt, nur die Eingabedaten ändern sich.
   - `packages/domain/src/__tests__/seed.test.ts:70–73` — „timestamps never run ahead of now and are ordered“: bleibt
     gültig und muss grün bleiben (ist die Reihenfolge-Invariante dieser Scheibe).
   - `packages/domain/src/__tests__/cockpit061.test.ts:67` — `OVER10M_AFTER_600S = 15` bei `SEED_NOW + 25 min`:
     **unverändert** (nachgerechnet: weiterhin 15, alle Eintritte ins Legal Clearing liegen vor `SEED_NOW`). K2 (`:134`)
     und K8 (`:283`) sind relativ (Gleichheit mit 033b, „+600 s auf jedes Alter“) und bleiben gültig.
   - `apps/api/src/__tests__/cockpit061.test.ts` A3 (`:106`): HTTP gleich In-Process, relativ, unverändert.
   - Reihenfolge nach Alter in der Oberfläche: `applyClientFilters` (`apps/web/src/features/answers/lib.ts:28`) und
     `myQuestions` (`apps/web/src/features/focus/focus.ts:34`) sortieren nach `createdAt`, Gleichstand nach Nummer. Die
     Nummern `F-0001…` steigen in Erzeugungsreihenfolge, die neuen Erfassungszeiten ebenso: **gleiche Reihenfolge wie
     heute.** `apps/web/src/api/focus054.test.ts`, `timing053.test.ts`: unverändert.
   - e2e: `003-answers-stage.spec.ts:69` prüft `data-level` nur gegen `/^[012]$/`, `054-fokusansicht.spec.ts:195` das
     Alter nur gegen `/^(eben|vor \d+ (min|Std\.|Tg\.))$/`; `020-rueckbau-passung.spec.ts:605` sät `questions: 0` (keine
     Rede, siehe Randfall in Ziel 1). Kein e2e prüft „22 min“ oder einen festen Zeitwert des Seeds.
   - Domain-, API- und Postgres-Tests, die den Seed nutzen (`legal-clearance`, `refusal044a`, `api`, `master-data040b`,
     `envelope`, `admin040a`, `stream035`, `answerDraft055`, `forward048`; `apps/api` `stream035`, `refusal044b`,
     `postgres-*`): keine Prüfung auf Seed-Zeitwerte oder feste `seq`/Hash-Werte des Seeds gefunden. Die Inline-Hashes in
     `refusal044a.test.ts:207` sind Hashes der Verweigerungsgründe, nicht des Logs.
   - Belegbilder in `docs/evidence/`: historische Nachweise ihrer Scheiben, werden nicht neu erzeugt. Ein lokaler e2e-Lauf
     im Projekt `in-process` überschreibt sie (`apps/web/e2e/support/evidence.ts`); vor dem Commit zurücksetzen.
7. **Gemeinsame HTTP-e2e-Datenbank.** `demo-bootstrap.mjs` schreibt das Log in einer Transaktion in eine frische
   Datenbank je Lauf. Mit der Variante dieser Spec bleiben Anzahl, Ids, Typen, Reihenfolge (`seq`) und Status gleich;
   nur Zeitwerte und Hashes ändern sich. Die anschließenden `assignRole`-Ereignisse liegen weiter zeitlich nach dem Seed.
   Kein Risiko für die Reihenfolge der geteilten Specs.

## Bewertung

Zwei Varianten wurden nachgerechnet (Wegwerf-Kopie von `seed.ts` im Scratchpad, nicht festgeschrieben):

- **Variante A (diese Scheibe): die eine Rohuhr monoton in die 90 min vor `o.now` stauchen.** Die Ziehungen aus dem
  Zufallsgenerator bleiben Stück für Stück gleich, nur die Abbildung Rohzeit → `at` ändert sich. Weil die Abbildung
  monoton ist, bleibt die Log-Reihenfolge exakt erhalten. Wirkung (CORPUS_DEMO, bei `o.now`): Zulauf
  `[11,11,10,9,14,16,16,14,8,18,18,24]` (alle 12 Fenster belegt), älteste offene Frage 89 min, 8 Fragen über 10 min im
  Legal Clearing, 100 offene Fragen mit 48 verschiedenen Minutenaltern, Dringlichkeit (`urgencyLevel`, 15/45 min)
  47/39/14 statt heute alle gleich. Inhaltsgleichheit beweisbar (Fingerabdruck mit maskierten Zeiten vorher = nachher,
  `f28ff6ae63fc7`). Aufwand unter einer Agentenstunde.
- **Variante B (nicht diese Scheibe): jede Frage durchläuft ihren Lebenslauf über Minuten nach ihrer Erfassung.** Nur sie
  behebt den dritten Punkt der Kritik (Faden). Sie braucht eine zweite Uhr je Frage, damit verschränken sich die
  Lebensläufe verschiedener Fragen und die Sortierung am Ende **ändert die Log-Reihenfolge** (`seq`). Das berührt jeden
  Test und jede Spec, die über Log-Positionen oder Ereignisfolgen des Seeds geht, die Kappung bei `o.now` (späte Fragen
  stauen sich wieder auf `now`, wenn nicht je Frage skaliert wird), den Fingerabdruck (müsste zusätzlich nach Id
  sortieren) und die Reihenfolge der Bühnenpositionen im Log. Geschätzt 3–4 AStd mit eigener Wirkungsanalyse. **Für den
  Demo-Zeitrahmen zu riskant.**

**Empfehlung: Variante A bauen.** Ehrlich benannt: Sie behebt Zulauf und Listenalter, **nicht** den Faden. Auch nach A
liegen alle Stationen einer Seed-Frage innerhalb derselben Minute (die Lebensläufe werden mitgestaucht, nachgerechnet an
vier Stichproben). Ein Faden zeigt also weiter dieselbe Uhrzeit an jeder Station; für neue, in
der Demo bearbeitete Fragen stimmt er. Variante B kommt als Folgezeile in `docs/folgeliste.md`.

## Ziel

1. **Abbildung der Zeiten in `seedEvents`** (`packages/domain/src/seed.ts`), genau so:
   - `tick` zieht unverändert `intBetween(rnd, minMs, maxMs)` und rückt `clock` vor, gibt aber die **ungekappte**
     Rohzeit zurück (die Kappung `Math.min(clock, o.now)` entfällt; sie wird durch die Abbildung ersetzt).
   - Direkt vor `/* ---- speeches and questions ---- */` (`seed.ts:460`) die Rohzeit merken: `const speechFrom = clock;`.
     Alles bis dahin (MeetingCreated, MeetingStarted, SpeakerRegistered) behält seine Rohzeit (liegt ab `o.now − 6,5 h`,
     bei CORPUS_LOAD höchstens rund 80 min später, also stets vor `o.now − 90 min`).
   - Konstante `SEED_SPREAD_MS = 90 * 60_000` (Kommentar: warum 90 min — das Zulauffenster des Leitstands ist 60 min,
     die zusätzlichen 30 min halten die Balken in der ersten halben Stunde der Vorführung gefüllt).
   - Nach der Erzeugung, vor der bestehenden Sortierung: jede Rohzeit `r` wird zu
     `r <= speechFrom ? min(r, now) : now − SEED_SPREAD_MS + floor((r − speechFrom) · SEED_SPREAD_MS / (rawEnd − speechFrom))`,
     `rawEnd` = Endstand von `clock`. Das gilt für `at` jedes Ereignisses und für `payload.answer.createdAt` jedes
     `AnswerDrafted`, das danach **gleich dem eigenen `at`** ist (behebt Befund 2). `QuestionLegalCleared` erbt weiter
     die (abgebildete) Zeit des Vorgängers.
   - Randfall: Gibt es nach `speechFrom` kein Ereignis (`questions: 0`, `020-rueckbau-passung.spec.ts:605`, also
     `rawEnd === speechFrom`), wird nichts abgebildet; keine Division durch null.
   - Die stabile Sortierung `seed.ts:654` bleibt stehen (sie ist nach der monotonen Abbildung eine Identität); der
     Kommentar `seed.ts:652–653` wird auf die neue Begründung angepasst.
2. **Tests in `seed.test.ts`** (neuer `describe`-Block „takt-052 Zeiten“, CORPUS_DEMO und CORPUS_LOAD, festes `now`):
   - T1 Zeiten: `at <= now` für jedes Ereignis **und** jedes `answer.createdAt`; `answer.createdAt === at` für jedes
     `AnswerDrafted`. Die bestehende Prüfung „ordered“ (`:70`) bleibt und sichert die Log-Reihenfolge.
   - T2 Fenster: jede `QuestionCaptured`-Zeit liegt in `[now − 90 min, now]`; die erste mehr als 80 min vor `now`.
   - T3 Zulauf: `computeCockpit` über das gestempelte Demo-Log bei `now` ergibt `inflow.bins` ohne Null-Fenster und mit
     `bins` = `[11,11,10,9,14,16,16,14,8,18,18,24]` (fest, unabhängig vom absoluten `now`; nachgerechnet).
   - T4 Listenalter: unter den offenen Fragen des Demo-Logs (Projektion, `createdAt`) mindestens 30 verschiedene
     Minutenalter bei `now`, und jede der drei Altersklassen von `urgencyLevel` (unter 15 min, 15 bis unter 45 min, ab
     45 min) ist belegt (nachgerechnet 47/39/14). `urgencyLevel` liegt in `apps/web` und wird nicht importiert; die
     Klassengrenzen stehen als Testkonstanten mit Verweis auf `apps/web/src/features/answers/lib.ts:147`.
   - T5 Randfälle: `questions: 0` und `questions: 1` werfen nicht, alle Zeiten `<= now`.
3. **Fingerabdruck** (`seed-fictitious-names.test.ts`): `maskNames` maskiert zusätzlich `"at":"…"` und
   `"createdAt":"…"` (Kommentar: takt-052 darf nur Zeiten ändern). `PRE_CHANGE_FINGERPRINT` wird auf dem Seed **vor**
   dieser Scheibe (`68c87d9`) mit der erweiterten Maske neu berechnet und muss auf dem neuen Seed gleich sein. Erwartet
   (vorab nachgerechnet): **`f28ff6ae63fc7`** vorher wie nachher. Der Kommentar über der Konstante nennt takt-052 und
   den alten Wert `1bac7aa18a9d88`, wie es 080 getan hat.
4. **Golden** `apps/api/src/__tests__/fixtures/metrics-golden-061.txt` neu schreiben (A5 rendert ihn). Erwartete
   Änderung, sonst nichts (vorab nachgerechnet):
   ```
   3:  hv_open_question_oldest_age_seconds{meeting_id="hv-2031"} 20589  ->  5469
   18: hv_questions_captured_last_5m{meeting_id="hv-2031"} 215          ->  14
   21: hv_questions_in_legal_review_over_10m{meeting_id="hv-2031"} 0    ->  9
   30: hv_open_question_oldest_age_seconds{meeting_id="hv-2031"} 21369  ->  6249
   ```
   HELP-/TYPE-Zeilen, Labelmengen und alle `hv_open_questions`-Werte bleiben byte-gleich.
5. **Folgeliste:** eine Zeile für Variante B (Faden je Frage über Minuten verteilen; Log-Reihenfolge ändert sich; eigene
   Wirkungsanalyse) und eine Zeile „Zulauf nach einer Stunde Vorführung leer (kein neuer Zulauf ohne Erfassung)“ als
   bewusstes Nicht-Ziel mit Verweis auf diese Spec.

## Nicht-Ziele

- **Keine Änderung am Korpus-Inhalt:** gleiche Wortmeldungen, Redebeiträge, Einzelfragen, Texte, Nummern, Ids, Akteure,
  Antwortpfade, Fachbereiche, Status, Zählungen und dieselbe Log-Reihenfolge. Keine zusätzliche und keine entfernte
  Ziehung aus dem Zufallsgenerator. Beweis: Ziel 3.
- Nicht die Folgeliste-Zeile 021b (Klassifizierungen mit der Erfassung als Akteur, `docs/folgeliste.md:112`) mitnehmen —
  das wäre eine Inhaltsänderung.
- Keine Variante B (Lebenslauf je Frage über Minuten, Faden), siehe Bewertung.
- Kein lebender Zulauf während der Vorführung (kein Zeitgeber, keine nachgeschobenen Ereignisse).
- Keine Änderung an `indicators.ts`, `cockpit.ts`, `state.ts`, `envelope.ts`, `transitions.ts`, `api.ts`, am Vertrag, an
  Schwellen (`COCKPIT_THRESHOLDS`, `urgencyLevel`) oder an der Oberfläche.
- Keine neuen Belegbilder als Pflicht, keine Neuerzeugung bestehender Bilder in `docs/evidence/`.
- Keine Änderung an `CORPUS_DEMO`/`CORPUS_LOAD`, an `SeedOptions` (keine Option „alte Zeiten“) oder an
  `demo-bootstrap.mjs`.

## Vor dem Bau prüfen

1. Auf dem Bau-Commit `grep -n "Math.min(clock" packages/domain/src/seed.ts` findet genau `seed.ts:394`, und
   `createdAt: new Date(clock)` steht genau zweimal (`:613`, `:627`). Weicht das ab, hat jemand den Seed inzwischen
   geändert: anhalten, berichten.
2. Den alten Fingerabdruck mit erweiterter Maske auf dem unveränderten Seed ausrechnen, **bevor** `seed.ts` geändert wird
   (Ergebnis `f28ff6ae63fc7` erwartet). Stimmt er nicht, ist die Maske anders als hier beschrieben.
3. `pnpm --filter @hv/domain test` und `pnpm --filter @hv/api test` (ohne Postgres reicht für die Sichtung) nach dem
   Umbau: Rot werden dürfen nur der Fingerabdruck (vor Ziel 3) und A5 (vor Ziel 4). Jeder andere rote Test ist ein
   Befund dieser Spec (eine übersehene Zeitabhängigkeit): **anhalten und berichten, nicht die Datei hinzunehmen.**
4. `rg -n "seedEvents|seedDemo|CORPUS_DEMO" apps/web/e2e` auf neue Specs seit `68c87d9` prüfen, die Seed-Zeiten lesen.

**Nachtrag (Bau, 06.10.2026): übersehene Zeitabhängigkeit.** `apps/api/src/__tests__/metrics033b.test.ts:221` („shows a
new question only after the window“) sät `{ questions: 30, seed: 3 }`, liest `hv_questions_captured_last_5m`, erfasst eine
Frage, rückt die Uhr um 10 s vor und erwartet `vorher + 1`. Das galt nur, weil fast alle Seed-Erfassungen auf `now` lagen;
mit den gestauchten Zeiten verlässt eine Seed-Erfassung in diesen 10 s das 300-s-Fenster (rot: `expected 6 to be 7`).
Entscheidung des Orchestrators: Die Absicht des Tests bleibt (neue Frage erst nach dem Fenster sichtbar, Werte aus dem
Cache, nicht aus dem Log); er darf nicht mehr annehmen, dass jede Seed-Erfassung auf `now` liegt. Umgesetzt ist das so:
Dieser eine Test sät `{ questions: 0, seed: 3 }` (zweiter, optionaler Parameter von `seeded()`, Vorgabe unverändert), prüft
`vorher = 0`, bei +9 s weiter 0 (Cache) und bei +10 s 1. Der zuerst erwogene Weg, den Erwartungswert über
`computeIndicators` zur späteren Uhrzeit zu berechnen, verlor in der Mutationsprobe seine Schärfe (bei TTL 0 grün) und wurde
verworfen (Review-Befund minor 1). Die Datei kommt unter Files allowed, nur für diesen Test und seine Fixture-Nutzung.

## Files allowed

- `packages/domain/src/seed.ts`
- `packages/domain/src/__tests__/seed.test.ts`
- `packages/domain/src/__tests__/seed-fictitious-names.test.ts`
- `apps/api/src/__tests__/fixtures/metrics-golden-061.txt`
- `apps/api/src/__tests__/metrics033b.test.ts` (Nachtrag: nur der Test an `:221` und seine Fixture-Nutzung)
- `docs/folgeliste.md` (nur die zwei Zeilen aus Ziel 5)
- `docs/slices/takt-052-seed-zeiten.md` (Bericht, Review findings)
- `docs/evidence/takt-052-*.png` (freiwillig, siehe Nachweise)

## Ausdrücklich nicht erlaubt

`packages/domain/src/` außer `seed.ts` und den zwei Testdateien (insbesondere `indicators.ts`, `cockpit.ts`, `api.ts`,
`state.ts`, `envelope.ts`, `transitions.ts`), `apps/api/src/` außer der Golden-Datei und dem Test in `metrics033b.test.ts` (Nachtrag; insbesondere
`apps/api/src/__tests__/cockpit061.test.ts`), `apps/web/`, `packages/contract/`, `scripts/`, `.github/`,
`docs/evidence/` außer `takt-052-*`.

## Tests zuerst

Reihenfolge im Bau: (a) Fingerabdruck-Maske erweitern und auf dem alten Seed neu berechnen (grün mit `f28ff6ae63fc7`);
(b) T1–T5 schreiben, T2–T4 sind auf dem alten Seed rot (heute 215 Erfassungen auf `now`, Zulauf `[0,…,0,215]` bzw. ein
Balken, ein einziges Minutenalter), T1 ist rot an `createdAt` (174 Fassungen nach `now`); die rote Ausgabe geht in den
Bericht; (c) `seed.ts` umbauen, alles grün; (d) Golden neu schreiben und den Diff gegen Ziel 4 prüfen.

## Akzeptanzkriterium

1. T1–T5 vor dem Umbau rot (Ausgabe im Bericht), danach grün.
2. Fingerabdruck mit Zeitmaske vorher = nachher = `f28ff6ae63fc7`; der Bericht zeigt beide Läufe.
3. `git diff 68c87d9 -- apps/api/src/__tests__/fixtures/metrics-golden-061.txt` zeigt genau die vier Wertzeilen aus
   Ziel 4.
4. `packages/domain/src/__tests__/cockpit061.test.ts` unverändert und grün (`OVER10M_AFTER_600S` bleibt 15).
5. `pnpm gates` grün (eigene Datenbank, z. B. `hv_test_t052`), einschließlich `slice-scope`; der Schluss steht im
   Bericht. CI auf dem PR grün, einschließlich `e2e-http` (gleiche Reihenfolge, neue Zeiten).
6. `git diff --stat 68c87d9` berührt nur die Files allowed; von e2e-Läufen überschriebene Bilder in `docs/evidence/`
   sind zurückgesetzt.

## Qualitätswirkung

Reifestufe: demo · Risikoklasse: mittel
Ausgelöst: [x] Vertrag, Ereignis, Konfiguration (nur Werte synthetischer Ereignisse, kein Schema) [x] Dokumentation ·
sonst nichts. Kein Persistenzschema, keine Rechte, kein Personenbezug (Seed bleibt synthetisch, R11).
Perspektive und Rolle: Fachliche Korrektheit und Test-Determinismus, Reviewer in frischem Kontext. Nachweise: Kriterien
1–6. Betriebswirkung: keine; eine bereits gesäte Datenbank oder ein `localStorage`-Log der Demo bleibt, wie es ist (der
Seed läuft nur in ein leeres Log); neue Zeiten sieht nur, wer neu sät („Demo zurücksetzen“).

## Nachweise

- Rote und grüne Ausgaben T1–T5, beide Fingerabdruck-Läufe, Golden-Diff, Ende von `pnpm gates` mit Commit-Hash.
- Keine Oberflächenänderung, daher kein Pflicht-Screenshot. Freiwillig: ein Bild der Beantwortung mit verschiedenen
  Altern und Dringlichkeitsstufen als `docs/evidence/takt-052-beantwortung-alter.png`.

## Aufwand

Variante A: ca. 1 AStd (Umbau rund 25 Zeilen in `seed.ts`, fünf Tests, Maske, Golden). Variante B: 3–4 AStd, eigene
Spec.

## Bericht

Slice: takt-052-seed-zeiten (Variante A) · Bau 06.10.2026 · Branch `claude/takt-052-seed-zeiten`

**Erledigt.** `seedEvents` staucht alle Rohzeiten ab der ersten Rede linear in die 90 min vor `now`
(`SEED_SPREAD_MS`); `tick` kappt nicht mehr; `AnswerDrafted.payload.answer.createdAt` ist das abgebildete `at` (Befund 2
behoben). Inhalt, Ids, Ziehungen und Log-Reihenfolge sind unverändert (Fingerabdruck). T1–T5 in `seed.test.ts`, Golden A5 neu
(vier Wertzeilen), Test `metrics033b.test.ts:221` nach Nachtrag angepasst, zwei Folgeliste-Zeilen.

**Vor dem Bau prüfen.**
1. `Math.min(clock` nur `seed.ts:394`; `createdAt: new Date(clock)` genau `:613` und `:627`. OK.
2. Fingerabdruck auf dem unveränderten Seed: Mit dem Platzhalter `<masked>` ergibt die erweiterte Maske `4497dc627aef8`; mit
   dem Platzhalter **`<time>`** (`"at":"<time>"`, `"createdAt":"<time>"`) genau `f28ff6ae63fc7`. Die Spec nennt den Platzhalter
   nicht; gebaut ist `<time>`.
3. Nach dem Umbau ohne Postgres rot: A5 (erwartet) und **`metrics033b.test.ts:221`** (nicht erwartet, `expected 6 to be 7`).
   Bau angehalten, berichtet; Entscheidung des Orchestrators und Nachtrag siehe „Vor dem Bau prüfen“, Commit `73e3b6e`.
4. Keine neuen e2e-Specs seit `68c87d9`; keine liest Seed-Zeiten. OK.

**Rot vor dem Umbau** (`npx vitest run src/__tests__/seed.test.ts`, alter Seed, neue Tests):
```
 FAIL  … takt-052 Zeiten > T1 CORPUS_DEMO … AssertionError: expected [ 'ev-00060', 'ev-00069', …(172) ] to deeply equal []
 FAIL  … takt-052 Zeiten > T2 CORPUS_DEMO … AssertionError: expected [ 1808205250269, 1808205637676, …(11) ] to deeply equal []
 FAIL  … takt-052 Zeiten > T1 CORPUS_LOAD … AssertionError: expected [ 'ev-000au', 'ev-000b3', …(667) ] to deeply equal []
 FAIL  … takt-052 Zeiten > T2 CORPUS_LOAD … AssertionError: expected [ 1808207252367, 1808207582913, …(10) ] to deeply equal []
 FAIL  … takt-052 Zeiten > T3 CORPUS_DEMO … AssertionError: expected [ +0, +0, +0, +0, +0, +0, +0, +0, +0 ] to deeply equal []
 FAIL  … takt-052 Zeiten > T4 CORPUS_DEMO … AssertionError: expected 3 to be greater than or equal to 30
      Tests  6 failed | 17 passed (23)
```
T1 rot an `createdAt` (174 Fassungen nach `now` im Demo-Korpus, 669 im Last-Korpus). **T5 war schon vor dem Umbau grün**: die
alte Kappung hielt jedes `at` bei `now`, und nichts warf. Akzeptanzkriterium 1 („T1–T5 vorher rot“) gilt damit nur für T1–T4.

**Grün nach dem Umbau:** `seed.test.ts` + `seed-fictitious-names.test.ts`: `Tests 27 passed (27)`;
`pnpm --filter @hv/domain test`: `Test Files 23 passed (23)`, `Tests 526 passed (526)` (`cockpit061.test.ts` unverändert,
`OVER10M_AFTER_600S = 15` grün).

**Fingerabdruck** (Maske mit `<time>`): Lauf 1 auf dem alten Seed `f28ff6ae63fc7` (grün, vor jeder Änderung an `seed.ts`),
Lauf 2 auf dem neuen Seed `f28ff6ae63fc7` (grün). Alter Wert `1bac7aa18a9d88` steht im Kommentar.

**Golden-Diff** (`git diff 68c87d9 -- apps/api/src/__tests__/fixtures/metrics-golden-061.txt`), genau Ziel 4:
```
@@ -3 +3 @@   20589 -> 5469    (hv_open_question_oldest_age_seconds)
@@ -18 +18 @@ 215   -> 14      (hv_questions_captured_last_5m)
@@ -21 +21 @@ 0     -> 9       (hv_questions_in_legal_review_over_10m)
@@ -30 +30 @@ 21369 -> 6249    (hv_open_question_oldest_age_seconds)
```

**metrics033b (Nachtrag).** Der Test sät für sich `{ questions: 0, seed: 3 }` (Wortmeldungen ja, Einzelfragen nein; der Test
braucht nur einen Redner) und prüft `vorher = 0`, bei +9 s `vorher` (Cache), bei +10 s `vorher + 1`. Die zuerst versuchte
Variante (Basiswert aus `computeIndicators` über das Seed-Log bei +10 s, Seed mit 30 Fragen) war grün, verlor aber ihren Biss:
Mit Cache-Laufzeit 0 blieb der Test grün, weil eine Seed-Erfassung schon vor +9 s aus dem Fenster fiel und der ungecachte Wert
zufällig dem gecachten glich. Mutationsprobe auf der gebauten Fassung (`app.ts` danach zurückgesetzt, nicht committet):
- `createSingleFlightCache<Indicators>(0, clock)`: `× shows a new question only after the window … expected 1 to be +0`
- Cache im Handler umgangen (`((f) => f())(…)` statt `cachedIndicators(…)`): derselbe Test rot, `expected 1 to be +0`.
Die übrigen Tests von `seeded()` säen weiter `{ questions: 30, seed: 3 }` (Vorgabe des neuen zweiten Parameters).

**`pnpm gates`** auf sauberem Baum, Commit **`a42a795`**, eigene Datenbank `hv_test_t052` (Postgres-Tests liefen mit, keine
übersprungen; keine Zeitfehler unter Last, also kein Einzel-Nachlauf nötig). Ausschnitt aus dem echten Lauf:
```
packages/domain test:  Test Files  23 passed (23)
packages/domain test:       Tests  526 passed (526)
apps/web test:  Test Files  59 passed (59)
apps/web test:       Tests  925 passed (925)
apps/api test:  Test Files  50 passed (50)
apps/api test:       Tests  700 passed (700)
slice-scope: warning — "docs/slices/takt-052-seed-zeiten.md"'s "Files allowed" section differs from its version at the commit that introduced it (016b117).
slice-scope: 7 changed file(s), all within "docs/slices/takt-052-seed-zeiten.md"'s "Files allowed" list (9 pattern(s)).
✓ built in 1.89s
mark-test-run: wrote /home/user/wt/takt052/.claude/state/last-test-run (clean tree) at commit a42a795, tree a21736e8ad5a…
```
Die slice-scope-Warnung ist der Nachtrag `73e3b6e` (Files allowed um `metrics033b.test.ts` erweitert). Ein erster Lauf auf dem
Vorgänger-Commit scheiterte an der Typprüfung (`seed.ts`: `NewEvent` verliert die Verengung auf `type`); behoben durch einen
Payload-Cast, in denselben, nicht gepushten Commit eingefaltet.

**e2e in-process** (`pnpm --filter @hv/web e2e --project=in-process`, auf `a42a795`): `190 passed (12.3m)`, `1 skipped` (der
übersprungene Fall ist `055b-antwortformat.spec.ts:697` „055b http“, nur im HTTP-Projekt). Kein e2e hängt an den alten Zeiten. Die
vom Lauf überschriebenen Bilder in `docs/evidence/` sind mit `git checkout -- docs/evidence` zurückgesetzt.

**Offen.** CI auf dem PR (einschließlich `e2e-http`) steht aus; nicht gepusht. Review in frischem Kontext steht aus. Keine
Belegbilder (freiwillig; Leitstand-Oberfläche nicht gemergt).

**Berührt.** `packages/domain/src/seed.ts`, `packages/domain/src/__tests__/seed.test.ts`,
`packages/domain/src/__tests__/seed-fictitious-names.test.ts`, `apps/api/src/__tests__/fixtures/metrics-golden-061.txt`,
`apps/api/src/__tests__/metrics033b.test.ts` (Nachtrag), `docs/folgeliste.md`, `docs/slices/takt-052-seed-zeiten.md`.

## Review findings

### Gates nach dem Einmischen der Basis (Codex P1 auf #173)

`pnpm gates` lief nach dem Einmischen von 046 (Merge-Commit **228d237**, Basis fd6ebd7) auf sauberem Baum, mit hv_test_t052 und aktiven Postgres-Tests. Danach kamen nur Doku-Commits (85a726d und dieser). Echter Schluss:

```
packages/domain test:       Tests  562 passed (562)
apps/web test:       Tests  984 passed (984)
apps/api test:       Tests  710 passed (710)
slice-scope: warning — "docs/slices/takt-052-seed-zeiten.md"'s "Files allowed" section differs from its version at the commit that introduced it (016b117).
slice-scope: 7 changed file(s), all within "docs/slices/takt-052-seed-zeiten.md"'s "Files allowed" list (9 pattern(s)).
✓ built in 1.83s
mark-test-run: wrote /home/user/wt/takt052/.claude/state/last-test-run (clean tree) at commit 228d237, tree 4de63309ce71…
```
