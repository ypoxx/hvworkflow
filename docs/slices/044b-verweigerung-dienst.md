# Scheibe 044b — Verweigerungspfad A und B, Teil 2: Dienst und HTTP-Nachweis

**Status:** spec (03.10.2026; gelesen auf `83bc7e2`, Merge von 044a #131; Teil 2 der geteilten Scheibe 044, Zuschnitt in `docs/slices/044a-verweigerung-kern.md`, Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 2,0 AStd (Teilungstabelle 044a: 1; Begründung im Abschnitt „Aufwand“) · Plan 044: 06.11.2026 (W6), tatsächlich direkt nach 044a in der Lane service; **muss vor dem 27.11.2026 gemergt sein** (Ablauf der drei Allowlist-Einträge, `packages/contract/scripts/check.mjs` (d)) · Go des Eigentümers zum Zuschnitt (044a, Frage 2) am 03.10.2026, auf Standard gebaut · Lanes: service; contract (nur `allowlist.json`); core (nur die Längenprüfung von `proposeRefusal`); e2e (nur die Schlüsselliste des Zugriffslogs in zwei Skripten); docs-adr (nur Architekt, erster Commit); docs-datenschutz (nur Zeile V10 und Zeile „Technisches Zugriffslog“); docs-sicherheit
**Rolle:** architekt für den ADR-Nachtrag (erster Commit, nur `docs/adr/0013-zwei-protokollebenen.md`); danach implementierer-backend. Review in frischem Kontext mit den Perspektiven **Security** (Maskierung über HTTP, Rechte, Zugriffslog), **Datenschutz** (Begründung im `pii`-Teil der gespeicherten Zeile, neue Spalte im Zugriffslog, Aufbewahrungsklasse) und **Vertrag** (Gleichlauf von Validator und Kern, Antwortprüfung, Allowlist und Abdeckungstor). Lesebefund der Spec vor dem Bau; nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue. Über HTTP belegt: R-TRANS-15, R-TRANS-16, R-GUARD-03, R-GUARD-04, R-GUARD-06, R-GUARD-08, R-GUARD-09, R-GUARD-11, R-GUARD-12, R-GUARD-13, R-GUARD-14, R-TRANS-00, R-PERM-01, R-PERM-02, R-IDEM-01 (nur Abgrenzung). Dazu AGENTS.md R2, R3, R4, R6, R7, R8, R11, R12
**Quellen-IDs:**
- `docs/slices/044a-verweigerung-kern.md`: Teilungstabelle (Zeile 044b), „Hinweise an Folgescheiben: 044b“, Missbrauchstabellen (Einträge „044b“), Abweichungen 2–6 des Baus, Review-Runde `44704c9` (Befunde 1, 2, 5), Nachtrag des Orchestrators zu R-GUARD-14
- Codex-Review PR #131 (P2 „Count refusal lengths as Unicode characters“, `packages/domain/src/api.ts:322`)
- Spec 035b (Muster einer Dienstscheibe: Allowlist im Commit des ersten Routentests, Postgres-Test, Zugriffslog), Spec 033a (Entscheidung 5: Zugriffslog mit genau acht Schlüsseln), Spec 040b (Muster: Allowlist-Test nach dem Entfernen)
- ADR 0013 (Ebene 2), ADR 0011 (Hash-Kette), ADR 0009 (`pii`-Umschlag), ADR 0015 (Allowlist mit Ablauf), ADR 0002 (Demo im Prozess)
- Register E56 (CI-Artefakt als Nachweis), E14 (DSB), E13 (Betriebsvereinbarung)
- Bedrohungsmodell SG2, T-G1-E-01, T-G1-E-03, T-G1-I-01, T-G1-I-02, T-G1-I-05, T-G1-I-09, MF-07, MF-09; DSFA-Vorentwurf V7, V10

**Depends on:** 044a (gemergt, `83bc7e2`, Vertrag 0.4.2), 035b (Strom-Dienst), 033a (Zugriffslog), 034a (Grenzen)
**Perspektive:** Security, Datenschutz, Vertrag · **Glossar: neue Begriffe:** nein

## Befund (Ist-Stand, gelesen auf `83bc7e2`)

- **Routen fehlen.** `apps/api/src/app.ts` montiert `listRefusalGrounds`, `proposeRefusal` und `approveRefusal` nicht.
  Der Fallback antwortet 404 (`app.ts:727`). Vorbild sind `draftAnswer` (`app.ts:1169-1173`) und `approveQuestion`
  (`app.ts:1178-1182`): `guarded('<operationId>')`, `getValidatedBody`, `writeOptions(c)`, `questionResult`.
- **Allowlist.** `packages/contract/allowlist.json` führt die drei Operationen mit `slice` 044 und `expires` 2026-11-27,
  daneben `createMeeting` und `freezeMeetingConfig` (040). `contract-043a.test.ts:254-259` prüft, dass die drei Einträge
  **stehen**; dieser Test kehrt sich mit dem Entfernen um.
- **Validator.** `apps/api/src/validate.ts` prüft den Body vor dem Handler gegen den Vertrag (Ajv 2020, `strict: false`,
  `contractSchema.ts:25`). Ajv zählt `maxLength`/`minLength` in Unicode-Zeichen (Code-Punkte, Standard `unicode: true`),
  wie JSON Schema 2020-12 es verlangt. `describeErrors` (`contractSchema.ts:205-208`) gibt nur Pfad und Meldung aus, keinen
  Wert.
- **Längenprüfung im Kern** (`checkRefusalProposal`, `packages/domain/src/api.ts:311-338`) zählt `.length`, also
  UTF-16-Einheiten: `text` 20000, `refusalJustification` 4000, `refusalGroundId` 128, je Eintrag in `sources` 2000. Über HTTP
  läuft erst der Validator, dann der Kern. Eine Begründung aus 4000 Emoji (4000 Code-Punkte, 8000 UTF-16-Einheiten) besteht
  den Validator und scheitert danach im Kern mit 422. Der Dienst weist also eine vertragsgültige Anfrage ab, nicht nur die
  Demo (der Codex-Befund nennt nur die Demo).
- **`AnswerDraft` ist offen** (`openapi.yaml`, Schema `AnswerDraft`: nur `text`, `sources`, kein
  `additionalProperties: false`). Ein `answerKind` im Body von `draftAnswer` besteht den Validator; der Kern übernimmt nur
  benannte Felder (044a, Entscheidung 5; Test 16). Über HTTP entsteht also eine gewöhnliche Antwortversion.
- **Zugriffslog** (`apps/api/src/observability/requestLog.ts:61-70`): genau acht Schlüssel (`v`, `ts`, `requestId`,
  `subjectHash`, `operationId`, `status`, `latencyMs`, `seq`), festgelegt in 033a (Entscheidung 5), ADR 0013 (Ebene 2) und
  DSFA V10. **Eine Regel-id steht heute nicht darin.** 044a nennt in den Missbrauchstabellen „409 mit Regel-id im
  Zugriffslog (033a, ab 044b über HTTP)“; das setzt einen Schlüssel voraus, den 033a nicht kennt. Die Schlüsselmenge prüfen
  vier Stellen: `access-log033a.test.ts:21`, `stream035.test.ts:655`, `scripts/e2e-http-031.mjs:168` (Job `e2e-http`) und
  `scripts/keycloak-ci-029b.mjs:148` (Job `gates`, Schritt „Keycloak browser login against migrated Postgres“). Die beiden
  Skripte laufen mit Keycloak nur in der CI.
- **Problem-Antwort.** `ApiProblem` trägt `ruleId` (`apps/api/src/problem.ts:11`); `app.onError` bildet die Antwort mit
  `problemResponse` (`app.ts:716-726`). Der Anfragekontext (`observability/context.ts`) kennt `seq` und `subjectHash`, aber
  keine Regel-id.
- **Postgres** speichert das Ereignis als Spalte **`envelope`** (jsonb, `apps/api/migrations/0001_event_log.up.sql`), nicht
  als `payload`, wie 044a in den Hinweisen schreibt. Die Begründung liegt also unter `envelope->'payload'->'pii'`. Die
  Personentabelle `persons` füllt nur `SpeakerRegistered` (`persistence/postgres.ts:320`); ein `pii` in `AnswerDrafted`
  landet dort nicht.
- **Body-Grenze** 256 KiB (`apps/api/src/limits/config.ts:14`). Ein vertragsgültiger Höchstfall (`text` 20000 Code-Punkte,
  `sources` 50 × 2000 Code-Punkte, alles aus Vier-Byte-Zeichen) überschreitet sie und wird 413. Das ist dokumentiert (413
  steht an der Operation) und bleibt; die Grenzfalltests unten nutzen ASCII, wo sie mehrere Felder ausreizen.
- **Bühne.** Zwei Routen liefern `StageView`: `/v1/stage` (`getStage`, Alias, `guarded(undefined)`, ohne Validator) und
  `/v1/meetings/{meetingId}/stage` (`getMeetingStage`). Beide rufen `getStage()` im Kern, das die Begründung immer entfernt
  (044a).
- **Kennzahlen-Allowlist** (`apps/api/src/metrics/catalog.json`, Tor `scripts/metrics-allowlist-check.mjs`) führt Einträge
  **je Kennzahl**, nicht je Operation. 044b legt keine Kennzahl an; `hv_questions_in_legal_review_over_10m` zählt
  Verweigerungen schon seit 044a (Test 26). **Keine Änderung am Katalog**, kein Abschnitt „Kennzahlen-Allowlist“.

## Ziel und Entscheidungen vor Bau

Der Dienst bietet die drei Operationen über HTTP an, mit denselben Entscheidungen wie der Kern. Jede Abweisung kommt mit
Status und Regel-id, ohne Ereignis und ohne Inhalt in `detail`. Begründung und Vermerk der Rechtsfreigabe erreichen über
keinen HTTP-Lesepfad und keinen Strom einen Leser außerhalb des Leserkreises. Vorschlag, Rechtsfreigabe und Freigabe
überstehen auf Postgres einen Neustart mit Kettenprüfung. **Auf Standard gebaut** (Go des Eigentümers 03.10.2026; ADR 0012
vorgeschlagen, von Recht nicht gelesen).

### 1. Montage (`apps/api/src/app.ts`)

- `GET /v1/refusal-grounds` mit `guarded('listRefusalGrounds')` → `domain.listRefusalGrounds()`. Global, ohne Jahrgang
  (043a).
- `POST /v1/questions/:questionId/refusals` mit `guarded('proposeRefusal')` →
  `domain.proposeRefusal(id, getValidatedBody<RefusalProposal>(c), writeOptions(c))` → `questionResult`.
- `POST /v1/questions/:questionId/refusal-approvals` mit `guarded('approveRefusal')` →
  `domain.approveRefusal(id, body.answerVersion, writeOptions(c))` → `questionResult`.
- Die Routen stehen im Abschnitt „questions“ nach `clearQuestionLegally`. Kein Rollenname, keine Statuslogik in der Route
  (AGENTS.md R4, R5): Rechte, Tabelle und Guards entscheidet der Kern.
- **Allowlist:** Die drei Einträge mit `slice` 044 werden **im Commit des ersten Routentests** entfernt (wie 035b). Danach
  verlangt das Abdeckungstor die Ausübung jeder der drei Operationen. Die zwei Einträge von 040 bleiben.

### 2. Reihenfolge der Antworten über HTTP (bestehend, hier festgehalten)

Die Middleware-Kette entscheidet in dieser Reihenfolge; die Tests halten sie fest, ändern sie aber nicht:
1. 401 ohne Akteur (Akteur-Port);
2. 422 des Validators (Form, Länge, `additionalProperties`, `if`/`then` für Pfad A). **Vor** Recht und Existenz: Ein
   Nichtberechtigter mit fehlerhaftem Body erhält 422, nicht 403. Das gilt für jede Operation des Dienstes und verrät nichts
   über die Frage. Die 403- und 404-Tests senden deshalb einen gültigen Body;
3. im Kern: 422 der Eingabeprüfung (nur, was der Validator nicht prüft: `text` nur aus Leerraum, unbekanntes oder leeres
   `refusalGroundId`), dann 404 bzw. 403 R-PERM-01, Wiederholung mit Idempotenzschlüssel, 428 ohne `If-Match`, 412 bei
   veralteter Version, 409 aus Tabelle und Guards.

**Abweichung zwischen Validator und Kern bei leerer Begründung (bestehend, im Vertrag beschrieben):** `""` ist über HTTP 422
(`minLength: 1`), in der Demo 409 R-GUARD-09 (044a, Befund 7). `"   "` ist in beiden 409 R-GUARD-09. Die Tests belegen beides.

### 3. Gleichlauf der Längen (Codex P2 aus #131): **in 044b angeglichen**

**Entscheidung:** 044b stellt `checkRefusalProposal` auf Code-Punkte um, für alle vier Längen (`text`, `refusalJustification`,
`refusalGroundId`, jeder Eintrag in `sources`). Die Anzahl der Einträge in `sources` (50) bleibt eine Array-Länge.

**Begründung:**
- Über HTTP stimmen Validator und Kern heute **nicht** überein: Eine vertragsgültige Anfrage (zwischen 2001 und 4000
  Vier-Byte-Zeichen in der Begründung) besteht den Validator und scheitert im Kern mit 422. Das ist ein Verstoß gegen den
  Vertrag im Dienst selbst, nicht nur in der Demo. 044b ist die Scheibe, die den 422-Grenzfall über HTTP belegt; sie kann
  „422 genau an der Vertragsgrenze“ nicht nachweisen, solange der Kern anders zählt.
- Der Eingriff ist eng: eine Hilfsfunktion und vier Vergleiche in einer Funktion, die 044a gerade gebaut hat. Kein Vertrag,
  kein Ereignis, keine Projektion ändert sich. Die Prüfung wird nur großzügiger, nie strenger (Code-Punkte ≤ UTF-16-Einheiten).
  Keine bisher angenommene Eingabe wird abgewiesen.
- Kein Sicherheits-, Datenschutz- oder Rechtsbezug. Die Speichergröße bleibt durch die Body-Grenze (256 KiB) beschränkt.

**Umsetzung:** `codePointLength(s)` zählt wie Ajv (`ucs2length`): Ein Paar aus hohem und tiefem Surrogat ist ein Zeichen,
ein einzelnes Surrogat ebenfalls eins. `for (const _ of s)` zählt genau so. Ein Test vergleicht die Hilfsfunktion mit
`ucs2length` aus Ajv für eine feste Liste (Test 7).

**Bleibt auf der Folgeliste** (neuer Eintrag, nicht blockierend): die übrigen Längenprüfungen des Kerns mit `.length`
(`reason` 500 bei Rückgabe und Rücknahme, `subjectId` und `deputyForSubjectId` 128, `Idempotency-Key` 128). Sie gehören
nicht zu dieser Scheibe; ein gebündelter Takt core stellt sie um.

### 4. `draftAnswer` mit Verweigerungsfeldern: keine Verweigerung, Antwort 200

Der Auftrag nennt „`draftAnswer` mit `answerKind` im Body wird über HTTP abgewiesen“. 044a (Hinweise an 044b) verlangt
„erzeugt keine Verweigerung“. **Gebaut wird der Wortlaut von 044a:**
- `AnswerDraft` ist im Vertrag offen; ein 422 bräuchte eine Formänderung (`answerKind: false` u. a.). Die macht eine bisher
  gültige Anfrage ungültig, ist also brechend und nur mit ADR-Verweis zulässig (ADR 0015), und sie müsste vor jedem Code als
  eigener Vertragsschritt kommen (AGENTS.md R6).
- Die Demo müsste gleich antworten (ADR 0002). Das hieße, 044a Test 16 umzudrehen und den Kern zu ändern.
- Der Missbrauch „Verweigerung als Antwort verkleidet“ ist ohnehin nicht technisch abwehrbar (044a, Missbrauchstabelle):
  Jeder kann den Wortlaut einer Verweigerung als Antworttext schreiben. Ein 422 fängt nur Programmierfehler eines Clients.

Was 044b über HTTP belegt (Test 13): Die Antwort ist 200; die neue Version trägt weder `answerKind` noch ein `refusal*`-Feld;
das gespeicherte Ereignis hat kein `pii`; `_actions` von `approver` enthält auf dieser Version nie
`question.refuse.approve`; `approveRefusal` darauf ist 409 R-GUARD-13. Die Variante „422“ ist Eigentümerfrage 2.

### 5. Regel-id im Zugriffslog (auf Standard gebaut, Eigentümerfrage 1)

Die Teilungstabelle von 044a verlangt „Zugriffslog mit Regel-id“. Der Standard baut das so:
- **Neunter Schlüssel `ruleId`** in jeder Zeile: Zeichenkette oder `null`. Wert ist genau die `ruleId` der Problem-Antwort
  dieser Anfrage, sonst `null`. Er gilt für **jede** Operation (auch 403 R-AUTH-01, 409 R-IDEM-01), nicht nur für die drei
  neuen. Eine Sonderregel je Operation wäre eine zweite Wahrheit.
- **Geschlossener Wortschatz:** Geschrieben wird der Wert nur, wenn er `^R-[A-Z]+-\d{2}$` entspricht; sonst `null`. Regel-ids
  sind Code-Konstanten des Kerns; kein Client-String kann den Schlüssel füllen (T-G1-I-05).
- **Weg des Werts:** `problemResponse` bzw. `app.onError` hält die Regel-id im Anfragekontext fest (`noteRuleId`, wie
  `noteSeq`). `createRequestLog` liest sie im `finally`. Keine Änderung an der Senke, an Aufbewahrung oder Schlüssel.
- **Datenschutz:** Die Zeile bleibt ohne Nutzdaten. Neu ist, **welche Regel** eine Anfrage eines pseudonymen Subjects
  abgewiesen hat (etwa R-GUARD-06, Versuch der Selbstfreigabe). Das ist ein Verhaltensdatum über Beschäftigte und fällt unter
  dasselbe Verfahren „nur zu zweit“ wie `subjectHash` und `seq` (ADR 0013, MF-09). Keine Kennzahl daraus, keine Auswertung je
  Person.
- **ADR-Nachtrag (Architekt, erster Commit):** ADR 0013, Ebene 2 nennt `ruleId` mit Zweck (Erkennung abgewiesener Versuche,
  T-G1-E-03, MF-07) und Grenze (nur Regel-ids, nie Text). Ohne diesen Commit beginnt der Bau nicht.
- **DSFA:** Zeile „Technisches Zugriffslog“ und V10 nennen `ruleId`.

### 6. Nachweise über HTTP aus dem Review von 044a

- **Wiederholte Rechtsfreigabe:** `legalClearerIds` (intern, 044a Befund 1) erscheint in **keiner** Antwort dieser Tests:
  Fragen, Listen, Bühne, Historie, Ereignisse, Strom, Schreibantworten (Test 11, Volltextprüfung jeder Antwort).
- **R-GUARD-08 vor R-GUARD-14:** `approveRefusal` ohne Rechtsfreigabe antwortet `ruleId` R-GUARD-08, nicht R-GUARD-14
  (Test 4).
- **`sources`-Grenzen:** 50 Einträge mit je 2000 Zeichen gelingen; 51 Einträge, ein Eintrag mit 2001 Zeichen, ein Eintrag,
  der keine Zeichenkette ist, sind 422 (Validator). In der Demo dieselben Fälle 422 (Kern, Test 7).

## Nicht-Ziele

- Keine Änderung an `openapi.yaml` oder den Vertragstypen. Weicht der Vertrag vom Kern ab, ist das ein Befund: anhalten,
  melden.
- Keine Formänderung an `AnswerDraft` (Entscheidung 4; Eigentümerfrage 2).
- Keine Änderung an Rechten, Übergangstabelle, Guards, Projektion, Maskierung oder Wahrheitstabelle. Die einzige Änderung im
  Kern ist die Zählweise in `checkRefusalProposal`.
- Keine Oberfläche, kein Screenshot (045).
- Keine neue Kennzahl, keine Änderung am Kennzahlenkatalog.
- Keine Änderung an Senke, Aufbewahrung, Schlüssel oder Ablage des Zugriffslogs; kein weiterer Schlüssel außer `ruleId`.
- Keine Umstellung der übrigen Längenprüfungen im Kern (Folgeliste, Entscheidung 3).
- Kein Export (051), keine Untergründe für Pfad A (044c), kein echter `pii`-Codec (073).

## Files allowed

Architekt (erster Commit, vor jedem Code):

- `docs/adr/0013-zwei-protokollebenen.md` (nur Nachtrag zu Ebene 2: Schlüssel ruleId, Zweck, Grenze, Verfahren „nur zu zweit“; Entscheidung 5)

Dienst:

- `apps/api/src/app.ts` (nur: die drei Routen; die Regel-id im Anfragekontext festhalten, falls das in app.onError geschieht)
- `apps/api/src/problem.ts` (nur: die Regel-id im Anfragekontext festhalten, falls das in problemResponse geschieht)
- `apps/api/src/observability/context.ts` (nur: Feld ruleId und noteRuleId)
- `apps/api/src/observability/requestLog.ts` (nur: Schlüssel ruleId mit Musterprüfung; Kopfkommentar „nine keys“)
- `packages/contract/allowlist.json` (nur die drei Einträge mit slice 044 entfernen, im Commit des ersten Routentests)

Kern (nur Entscheidung 3):

- `packages/domain/src/api.ts` (nur checkRefusalProposal und eine Hilfsfunktion codePointLength)
- `packages/domain/src/__tests__/refusal044a.test.ts` (nur Test 6: Fälle mit Vier-Byte-Zeichen und einzelnen Surrogaten)

Tests im Dienst:

- `apps/api/src/__tests__/refusal044b.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-refusal044b.test.ts` (neu, mit Postgres)
- `apps/api/src/__tests__/access-log033a.test.ts` (nur: Schlüsselliste um ruleId und die neuen Fälle aus Test 15)
- `apps/api/src/__tests__/stream035.test.ts` (nur die Schlüsselliste der Zugriffslogzeile)
- `apps/api/src/__tests__/contract-043a.test.ts` (nur die Allowlist-Prüfung in Test 8: die drei Einträge stehen nicht mehr)

Skripte (nur die Schlüsselliste und ihre Meldung „eight keys“):

- `scripts/e2e-http-031.mjs`
- `scripts/e2e-http-031.test.mjs` (nur, falls eine Vorlage dort die acht Schlüssel führt)
- `scripts/keycloak-ci-029b.mjs`

Dokumente:

- `docs/datenschutz/dsfa-vorentwurf.md` (nur Zeile „Technisches Zugriffslog“ und V10: ruleId)
- `docs/sicherheit/bedrohungsmodell.md` (nur: Stand und Testnamen an SG2, T-G1-E-01, T-G1-E-03, T-G1-I-05, T-G1-I-09, MF-07, MF-09; Zeile 044 in „Weitere Scheiben mit Sicherheitsbezug“)
- `docs/folgeliste.md` (nur: Eintrag „übrige Längenprüfungen des Kerns in Code-Punkten“ aus Entscheidung 3 und neue nicht blockierende Befunde des Baus; keine Sicherheits-, Datenschutz- oder Rechtspunkte)
- `docs/slices/044b-verweigerung-dienst.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator mit dem Merge: Stand-Zeile Etappe C)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/openapi.yaml`, `packages/contract/src/types.ts`, `packages/contract/CHANGELOG.md`,
`packages/contract/scripts/**`, `packages/domain/src/**` außer den zwei genannten Dateien (insbesondere `transitions.ts`,
`permissions.ts`, `stream.ts`, `state.ts`, `refusalGrounds.ts`), `packages/domain/policy-truth-table.md`,
`apps/api/src/__tests__/helpers.ts`, `apps/api/src/stream/**`, `apps/api/src/persistence/**`, `apps/api/src/limits/**`,
`apps/api/src/metrics/**`, `apps/api/src/observability/accessLog.ts`, `apps/api/migrations/**`, `apps/web/**`,
`.github/workflows/**`, `docs/slices/033a-serverzeit-health-zugriffslog.md`. Dieser Abschnitt steht bewusst außerhalb von
„Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **044a gemergt** (`83bc7e2`) und Vertrag 0.4.2: `HvApi` hat `listRefusalGrounds`, `proposeRefusal`, `approveRefusal`;
   die Allowlist führt die drei Einträge mit `slice` 044. Fehlt etwas: anhalten.
2. **ADR-Nachtrag** zu 0013 ist der erste Commit des Zweigs (Architekt). Ohne ihn: nicht bauen.
3. **Demo-Kopf und Rollenwechsel:** Wie löst der Akteur-Port `X-Actor` (`id:rolle`) auf? Reicht derselbe `id` mit einer
   anderen Rolle für den Fall „S klärt als `legal`, gibt als `approver` frei“ (Test 4, R-GUARD-14), oder muss der Test die
   Rollen über `assignRole`/`revokeRole` setzen? Der Bericht nennt den Weg.
4. **R-GUARD-11 über HTTP:** Lässt sich `createApp({ persistence })` mit einer In-Memory-Persistenz starten, an die vorher ein
   `AnswerDrafted` mit veraltetem `refusalGroundHash` angehängt wurde (wie 044a Test 12)? Sonst Befund; der Fall bleibt dann
   im Kern belegt.
5. **Einzelne Surrogate auf Postgres:** Antwortet der Postgres-Pfad auf eine Begründung mit einem einzelnen Surrogat
   (`"\ud800"`) mit 200? jsonb lehnt solche Escapes ab. Ergibt das 500 oder 503: kein Teil dieser Scheibe, Eintrag auf der
   Folgeliste (Robustheit, besteht für jedes Textfeld); Test 7 läuft dann nur ohne Postgres.
6. **Wo entsteht die Problem-Antwort** bei einem Fehler innerhalb von `postgresBoundary` (Rollback)? Die Regel-id muss auch
   dort im Kontext landen (Test P4).
7. **Kennzahl:** Läuft der Seed-Jahrgang (`running`)? Sonst entfällt Test 16; der Bericht vermerkt es.
8. Weichen Zeilenangaben ab: melden, nicht raten.

## Tests zuerst (rot, dann grün)

Ohne Postgres: `apps/api/src/__tests__/refusal044b.test.ts`. `createApp({ demoEnabled: true, clock, accessLog })` mit
Speichersenke und injizierter Uhr, Seed über `POST /v1/demo/seed`. Alle Aufrufe über `req()` (prüft jede Antwort gegen den
Vertrag und zählt die Operation für das Abdeckungstor). Akteure über `X-Actor`, dazu lokal `coordination` und zweite
Personen je Rolle. Nach jedem abgewiesenen Aufruf ist die Zahl der Ereignisse (`GET /v1/events` als admin) unverändert und
die Zugriffslogzeile hat `seq: null`. Markertexte in `text`, Begründung und Vermerk prüfen, dass kein `detail` sie wiederholt.

1. **Montage:**
   - `GET /v1/refusal-grounds` gelingt für alle neun Rollen des Seeds; sieben Einträge; `id` und `hash` gleich
     `REFUSAL_GROUNDS` aus `@hv/domain`. Ohne Akteur 401. Ein Akteur ohne Leserecht → 403 R-PERM-02, sofern der Demo-Kopf
     einen solchen Akteur zulässt (wie 044a Test 19); sonst vermerkt der Bericht, dass der Fall nur im Kern belegt ist.
   - `proposeRefusal` (Pfad B, `legal`, Frage in `assigned` auf Textpfad) → 200, `status` `in_review`, neue Version mit
     `answerKind`, `refusalGroundId`, `refusalGroundHash` = Katalog-Hash; `ETag` gesetzt. Pfad A (`coordination`) → 200 ohne
     Grund und Hash.
   - `approveRefusal` nach Rechtsfreigabe durch eine zweite Person, durch eine dritte → 200, `status` `approved`.
2. **401** für `proposeRefusal` und `approveRefusal` ohne `X-Actor`.
3. **403 und 404:**
   - `proposeRefusal` als `expert`, `approver`, `moderation`, `capture`, admin → 403 R-PERM-01;
   - `approveRefusal` als `legal`, `coordination`, `expert`, admin → 403 R-PERM-01;
   - `proposeRefusal` und `approveRefusal` als `podium` → 404 (044a, Abweichung 2: ohne `question.read` meldet
     `requireQuestionFor` 404);
   - unbekannte `questionId` → 404 für beide.
4. **409 mit Regel-id** (`ruleId` im Problem-Body), jeweils kein Ereignis:
   - R-TRANS-00: Vorschlag aus `staged` und `delivered`; `approveRefusal` aus `answer_drafted` (zurückgegebene Verweigerung);
   - R-GUARD-03: Vorschlag auf einer Podiumsfrage in `classified`;
   - R-GUARD-09: Pfad B ohne `refusalGroundId`; Pfad B ohne Begründung; Pfad B mit `"   "`; Pfad A ohne Begründung;
   - **R-GUARD-08 vor R-GUARD-14:** `approveRefusal` ohne Rechtsfreigabe → `ruleId` R-GUARD-08;
   - R-GUARD-06: die Vorschlagende klärt rechtlich; ein Akteur mit ihrer id in der Rolle `approver` gibt frei;
   - **R-GUARD-14 mit wiederholter Rechtsfreigabe:** `coordination` C schlägt vor; S klärt als `legal`; K klärt dieselbe
     Version erneut; S gibt als `approver` frei → 409 R-GUARD-14; ein drittes Subject mit `approver` → 200;
   - R-GUARD-12: `approveQuestion` auf einer Verweigerungsversion; `submitForReview` (`expert`) nach Rückgabe;
   - R-GUARD-13: `approveRefusal` auf einer Antwortversion (nach Rechtsfreigabe);
   - R-GUARD-04: Verweigerung v2 rechtlich freigegeben, `approveRefusal` mit `answerVersion: 1`;
   - R-GUARD-11 (nach Vor-dem-Bau-Punkt 4): App auf vorbereiteter In-Memory-Persistenz mit veraltetem Hash, Rechtsfreigabe,
     `approveRefusal` → 409 R-GUARD-11; `_actions` von `approver` ohne `question.refuse.approve`.
5. **412 und 428:** beide Operationen mit veraltetem `If-Match` → 412; ohne `If-Match` → 428; jeweils kein Ereignis, `detail`
   ohne Text.
6. **422 des Validators** (Body), jeweils kein Ereignis, `detail` ohne Wert:
   - `proposeRefusal`: `answerKind` `answer`, unbekannt, keine Zeichenkette; `text` `""`, keine Zeichenkette, 20001
     Zeichen; `refusalJustification` `""`, 4001 Zeichen, keine Zeichenkette; `refusalGroundId` 129 Zeichen, keine
     Zeichenkette; `sources` kein Array, 51 Einträge, ein Eintrag mit 2001 Zeichen, ein Eintrag als Zahl; Pfad A mit
     `refusalGroundId`; ein unbekanntes Feld (`additionalProperties: false`);
   - `approveRefusal`: `answerVersion` 0, als Zeichenkette, fehlt; ein zusätzliches Feld.
   - **Grenzfälle gelingen:** `text` mit 20000 Zeichen; Begründung mit 4000 Zeichen; `sources` mit 50 × 2000 ASCII-Zeichen.
   **422 des Kerns** über HTTP: `text` nur aus Leerraum; Pfad B mit unbekanntem `refusalGroundId` (`detail` nennt nur die
   id); Pfad B mit `refusalGroundId: ""`.
   **Leere Begründung:** `""` → 422 (Validator), `"   "` → 409 R-GUARD-09 (Abschnitt 2).
7. **Gleichlauf der Längen (Entscheidung 3):**
   - `codePointLength` gleich `ucs2length` aus Ajv für: leere Zeichenkette, ASCII, Umlaute, ein Emoji, 4000 Emoji, ein
     einzelnes hohes Surrogat am Ende, ein einzelnes tiefes Surrogat, ein vertauschtes Paar;
   - über HTTP und in der Demo gleich: Begründung aus 4000 Emoji → 200 (heute 422 im Kern: **rot zuerst**); 4001 Emoji → 422;
     `text` aus 20000 Emoji → 200, 20001 → 422; ein Eintrag in `sources` aus 2000 Emoji → 200, 2001 → 422;
     `refusalGroundId` aus 129 Emoji → 422 (Validator und Kern);
   - in der Demo (`refusal044a.test.ts`, Test 6): dieselben Fälle; einzelne Surrogate nach Vor-dem-Bau-Punkt 5.
8. **Idempotenz:**
   - `proposeRefusal` als `legal` zweimal mit gleichem `Idempotency-Key` und gleichem Body → gleiche Version, gleiches
     `ETag`, kein neues Ereignis; die Wiederholung trägt die Begründung (Leser `legal`);
   - derselbe Schlüssel von einem anderen Akteur (`leg2:legal`) ist keine Wiederholung (Schlüssel je Akteur): ein neuer
     Vorschlag mit eigener Version;
   - `approveRefusal` zweimal mit gleichem Schlüssel → eine Freigabe, ein `QuestionApproved`.
9. **Maskierung der Begründung über HTTP.** Aufbau: Frage A mit Verweigerung Pfad B (vorgeschlagen, rechtlich freigegeben,
   freigegeben, auf der Bühne, vorgelesen); Frage B mit einer Verweigerung, die ein späterer Antwortentwurf verdrängt hat.
   - `getQuestion`: Begründung vorhanden für `legal`, `coordination`, `approver`; fehlt für admin, `moderation`, `capture`,
     `expert`, `observer` (nach `delivered`); fehlt in der verdrängten Version für `moderation`, vorhanden für `legal`;
   - `listQuestions` und `listMeetingQuestions`: fehlt als admin und `moderation`, vorhanden als `legal`;
   - `getQuestionHistory` als `legal` und als admin, `listEvents` als admin: kein `payload.pii`, keine
     `refusalJustification` an irgendeiner Stelle; Schnappschuss `refusalGround` und `toStatus` vorhanden;
   - **`/stream`** (Leser aus `stream-reader035.ts`): admin erhält die `event`-Nachricht zu `AnswerDrafted` ohne `pii` und
     ohne Begründung; `legal` (ohne `event.read`) erhält nur `change`-Nachrichten ohne Nutzlast;
   - `GET /v1/stage` und `GET /v1/meetings/{meetingId}/stage` als `approver`, `moderation` und `podium` (nach `staged`):
     fehlt;
   - **Schreibantworten:** `returnQuestion` als admin und `deliverQuestion` als `podium` tragen in keiner Version eine
     Begründung;
   - Suche: `GET /v1/questions?q=<Wort nur aus der Begründung>` als `legal` → 0 Treffer; ein Wort aus `text` → 1 Treffer.
10. **Vermerk der Rechtsfreigabe:** `clearQuestionLegally` mit `note` (Marker) auf einer Antwort und auf einer Verweigerung.
    `getQuestionHistory` (`legal`), `listEvents` (admin) und die `event`-Nachricht auf `/stream` (admin) zeigen
    `QuestionLegalCleared` ohne `note`; `getQuestion` trägt keinen Vermerk; der Marker steht in keiner Antwort.
11. **`legalClearerIds` nie sichtbar:** Jede Antwort aus Test 4 (R-GUARD-14) und Test 9 wird als Rohtext geprüft: Der
    Schlüssel `legalClearerIds` kommt nicht vor. Dazu: Die Begründungs-Marker erscheinen in keiner Antwort an einen Leser
    außerhalb von `legal`, `coordination`, `approver`.
12. **Antwortprüfung:** Jede Antwort mit einer Verweigerungsversion besteht die Vertragsprüfung von `req()` (Invarianten
    an `AnswerVersion`: Pfad B mit Grund und Hash, Pfad A ohne). Keine Ausnahme in `UNDOCUMENTED_STATUS_EXCEPTIONS`.
13. **`draftAnswer` mit Verweigerungsfeldern** (Entscheidung 4): Body `{ text, answerKind: 'refusal_with_ground',
    refusalGroundId: 'aktg-131-3-nr1', refusalJustification: <Marker> }` als `expert` → 200; die neue Version trägt kein
    `answerKind`, kein `refusal*`-Feld; das Ereignis in `listEvents` hat kein `pii`; der Marker steht in keiner Antwort,
    auch nicht für `legal`; nach Prüfung und Rechtsfreigabe enthält `_actions` von `approver` `question.approve`, nie
    `question.refuse.approve`; `approveRefusal` darauf → 409 R-GUARD-13.
14. **Ganze Kette über HTTP**, Pfad A und Pfad B: Vorschlag → Rechtsfreigabe → Freigabe → `stageQuestion` (`moderation`) →
    `deliverQuestion` (`podium`, `QuestionDelivered.answerVersion` = Verweigerungsversion) → `closeQuestion`.
15. **Zugriffslog** (Speichersenke; ergänzt in `access-log033a.test.ts`, Fälle der Verweigerung in `refusal044b.test.ts`):
    - jede Zeile hat genau **neun** Schlüssel (`ruleId` dazu);
    - 409 aus Test 4 (R-GUARD-08) → Zeile mit `operationId` `approveRefusal`, `status` 409, `ruleId` `R-GUARD-08`,
      `seq` `null`; 403 → `R-PERM-01`; 409 R-GUARD-09 → `R-GUARD-09`; 403 R-AUTH-01 (CSRF, bestehender Fall) → `R-AUTH-01`;
    - 200, 401, 404 und 422 des Validators → `ruleId` `null` (soweit die Problem-Antwort keine Regel-id trägt);
    - ein Client-Kopf `X-Rule-Id: R-GUARD-99` und ein Body-Feld `ruleId` erreichen die Zeile nicht;
    - ein `ApiProblem` mit einer Regel-id außerhalb des Musters (Testhaken oder konstruierter Fehler) → `null`;
    - kein Marker aus `text`, Begründung oder Vermerk steht in einer Zeile.
16. **Kennzahl** (nach Vor-dem-Bau-Punkt 7): Vorschlag bei t0; `GET /metrics` mit Token zeigt
    `hv_questions_in_legal_review_over_10m` bei t0 + 11 min mit 1, bei t0 + 9 min mit 0 (über die injizierte Uhr). Kein
    neuer Name im Katalog.

Mit Postgres: `apps/api/src/__tests__/postgres-refusal044b.test.ts` (eigene Datenbank je Lauf, wie
`postgres028.test.ts`; Variablen `TEST_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE`):

- **P1 Neustart mit Kettenprüfung:** App A: Vorschlag Pfad B (`coordination`) → Rechtsfreigabe (`legal`, mit `note`) →
  Freigabe (`approver`). App B auf derselben Datenbank (Neustart): Die erste Anfrage lädt und prüft die Kette ohne
  Integritätsfehler; `getQuestion` als `legal` zeigt `approved`, Version und Begründung, als admin keine Begründung;
  `listEvents` als admin ohne `pii` und ohne `note`; `stageQuestion` über App B gelingt (die Kette läuft weiter).
- **P2 Ablage:** über die Owner-Verbindung: In der Zeile des `AnswerDrafted` steht die Begründung unter
  `envelope->'payload'->'pii'->>'refusalJustification'`, `envelope->'payload'->'answer'` hat keinen Schlüssel
  `refusalJustification`; `envelope->>'retentionClass'` ist `record` für dieses `AnswerDrafted` und für das `QuestionApproved`
  aus `approveRefusal`, `working` für `QuestionLegalCleared`; dessen gespeicherte Nutzlast trägt `note`; `persons` hat keine
  Zeile mit dieser `source_seq`.
- **P3 Wiederholung nach Neustart:** derselbe `Idempotency-Key` von `approveRefusal` über App B → historische Antwort, keine
  neue Zeile in `events`.
- **P4 Abweisung auf Postgres:** `approveRefusal` ohne Rechtsfreigabe → 409 R-GUARD-08, keine neue Zeile, Zugriffslogzeile mit
  `ruleId` `R-GUARD-08` und `seq` `null`.
- **P5 Kette schützt die Begründung:** Die Owner-Verbindung ändert `refusalJustification` in der gespeicherten Zeile. Die
  nächste Anfrage einer frischen App antwortet 500 ohne Inhalt (Integritätsfehler, ADR 0011); die Begründung erscheint in
  keiner Antwort und keiner Logzeile.

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):

1. Eine der drei Routen nicht montiert → Test 1 rot, Abdeckungstor rot.
2. Ein Allowlist-Eintrag mit `slice` 044 bleibt stehen → Abdeckungstor rot („pre-declared … exercised“).
3. `proposeRefusal` ohne `guarded(...)`-Validator (nur `postgresBoundary`) → Test 6 rot (unbekanntes Feld, leere Begründung
   ergeben 409 bzw. 200 statt 422).
4. Die Route für `approveRefusal` ruft `approveQuestion` → Test 4 (R-GUARD-12/13) und Test 14 rot.
5. `writeOptions(c)` in `proposeRefusal` weggelassen → Test 5 und Test 8 rot.
6. `codePointLength` zurück auf `.length` → Test 7 rot.
7. `ruleId` im Zugriffslog nicht gesetzt → Test 15 und P4 rot; Musterprüfung entfernt → Test 15 (Wert außerhalb des Musters)
   rot.
8. Das Entfernen von `note` in `maskEvent` (Kern) gestrichen → Test 10 rot.
9. `viewQuestion` maskiert mit `can(actor(), p, q)` → Test 9 rot (`approver` ohne mögliche Freigabe).
10. `getStage` ohne Maskierung → Test 9 (beide Bühnenrouten) rot.
11. `viewQuestion` lässt `legalClearerIds` stehen → Test 11 rot.
12. R-GUARD-14 vor R-GUARD-08 in R-TRANS-16 → Test 4 (Reihenfolge) rot.
13. `retentionClass: 'record'` in `proposeRefusal` weggelassen → P2 rot.
14. Begründung in `answer` statt `pii` → P2 und Test 9 rot.

Proben 8 bis 14 ändern den Kern nur für den Probelauf; sie belegen, dass die HTTP-Tests die Eigenschaften aus 044a selbst
prüfen und nicht nur durchreichen.

## Akzeptanzkriterium

1. Tests 1–16 und P1–P5 grün, zuerst rot belegt (Routen fehlen; Test 7 vor der Angleichung); die 14 Mutationsproben rot
   belegt. Test 16 nur nach Vor-dem-Bau-Punkt 7.
2. `allowlist.json` ohne Eintrag mit `slice` 044; `check.mjs` (d) `ok`; das Abdeckungstor meldet `ok` mit zwei vorab
   erklärten Operationen (040). `openapi.yaml` unverändert (`git diff` gegen die Merge-Basis leer für
   `packages/contract/openapi.yaml`).
3. `git diff` gegen die Merge-Basis zeigt Änderungen nur in „Files allowed“; der erste Commit ist der ADR-Nachtrag des
   Architekten.
4. `pnpm gates` mit Postgres-Variablen wie in CI grün auf einem sauberen Baucommit, einschließlich `slice-scope` auf
   `claude/slice-044b-…`; der Schluss der Ausgabe steht einmal im Bericht. Lokal zusätzlich `E2E_HTTP_IDP=none pnpm e2e:http`
   grün (Schlüsselliste in `e2e-http-031.mjs` ohne Keycloak).
5. **Keycloak-Teil (E56):** Die Schlüsselprüfung in `scripts/keycloak-ci-029b.mjs` (Job `gates`, Schritt „Keycloak browser
   login against migrated Postgres“) und in `scripts/e2e-http-031.mjs` (Job `e2e-http`) läuft nur mit Keycloak in der CI. Der
   Nachweisabschnitt nennt für den letzten Commit der PR je Job die Lauf-ID und die PASS-Zeile des Zugriffslogs aus dem
   Joblog. Wird ein CI-Artefakt als Nachweis genannt (etwa `evidence-031-http`), stehen Artefaktname, Lauf-ID, Artefakt-ID
   und Digest dabei (E56). Ein Merge braucht grüne CI auf dem letzten Commit der PR.
6. DSFA V10 und die Zeile „Technisches Zugriffslog“ nennen `ruleId`; ADR 0013 trägt den Nachtrag; das Bedrohungsmodell nennt
   die Testnamen.
7. Gemergt vor dem 27.11.2026.

## Nachweise

- Schluss von `pnpm gates` mit Postgres-Variablen und Commit-Hash; Abdeckungszeile („… exercised by tests, 2 pre-declared …“).
- Testnamen 1–16 und P1–P5, mit „rot zuerst“ (erster Lauf ohne Routen; Test 7 vor der Angleichung).
- Ergebnis der Mutationsproben.
- Auszug: eine Zugriffslogzeile eines abgewiesenen `approveRefusal` (neun Schlüssel, `ruleId` R-GUARD-08); eine
  `event`-Nachricht `AnswerDrafted` aus `/stream` als admin (ohne `pii`); das Ergebnis der SQL-Abfrage aus P2 mit
  synthetischer Begründung.
- CI-Angaben nach Akzeptanzkriterium 5.
- **Kein Screenshot:** keine Oberfläche ändert sich (045).

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Rolle, Recht, Schutzklasse (Rechte über HTTP, Maskierung auf sieben Lesepfaden, Strom und Schreibantworten)
- [x] personenbezogene oder vertrauliche Daten (Begründung in der gespeicherten Zeile unter `pii`; `ruleId` im Zugriffslog;
  DSFA V10)
- [x] Vertrag (drei Operationen bedient, Allowlist leer für 044, Gleichlauf von Validator und Kern bei Längen)
- [x] Persistenz (Postgres: Neustart, Kette, Ablage, Aufbewahrungsklasse)
- [ ] Fachregel, Status (keine Änderung, nur Nachweis über HTTP)
- [ ] Oberfläche

Perspektive(n): Security (6.5), Datenschutz (6.6), Vertrag (6.4) · Nachweise: Tests 1–16, P1–P5, Mutationsproben, CI nach E56 ·
Offene Entscheidung: Eigentümerfragen 1 und 2; E14 (DSB)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** Der Dienst öffnet die Verweigerung für jeden HTTP-Client. Jede Lücke zwischen Kern und Dienst (Validator,
  Route, Zugriffslog, Strom) wäre eine Umgehung der Oberfläche (T-G1-E-01) oder ein Leck der Begründung (SG2).
- **Bedrohungen:**
  - **T-G1-E-01** (Umgehung der Oberfläche): Alle Entscheidungen fallen im Kern; die Route reicht nur durch (Tests 3–6, 13).
  - **T-G1-E-03** (Verweigerung ohne Rechtsprüfung): 409 R-GUARD-08 über HTTP, sichtbar im Zugriffslog mit `ruleId`
    (Tests 4, 15, P4).
  - **MF-07** (Selbstfreigabe, auch nach Rollenwechsel): R-GUARD-06 und R-GUARD-14 über HTTP, mit wiederholter
    Rechtsfreigabe (Test 4).
  - **SG2, T-G1-I-01, T-G1-I-02, T-G1-I-09:** Maskierung über HTTP und `/stream` (Tests 9–11).
  - **T-G1-I-05** (Client-Strings im Log): `ruleId` nur aus dem Muster, nie aus Kopf oder Body (Test 15).
  - **MF-09** (Leistungsauswertung über das Zugriffslog): `ruleId` macht abgewiesene Versuche je `subjectHash` sichtbar.
    Abwehr wie bisher organisatorisch (nur zu zweit, 30 Tage, keine Auswertungswerkzeuge); technisch mit 047. Restrisiko
    benannt (Eigentümerfrage 1).
- **Invarianten:**
  - Keine Verweigerung entsteht über HTTP an `question.refuse.propose` vorbei; keine wird an `question.refuse.approve`,
    R-GUARD-08 oder R-GUARD-14 vorbei freigegeben.
  - Validator und Kern stimmen bei jeder Länge der Verweigerungsfelder überein (Code-Punkte).
  - Kein `EventRead`, keine Bühnenansicht, keine Strom-Nachricht und keine Antwort an Leser ohne `refuse.*` enthält die
    Begründung; kein Lesepfad enthält den Vermerk oder `legalClearerIds`.
  - Jede Zugriffslogzeile hat genau neun Schlüssel; `ruleId` ist `null` oder eine Regel-id des Kerns.
- **Fehler- und Wiederherstellungsfall:**
  - Neustart: Zustand aus dem Log, Kette geprüft (P1); Wiederholung nach Neustart ohne Doppelung (P3).
  - Manipulierte Zeile: 500 ohne Inhalt, kein Leck (P5).
  - Läuft der 27.11.2026 ab, bevor 044b gemergt ist, wird das Vertragstor rot; dann verlängert der Architekt die drei
    `expires` in einem eigenen Takt mit Begründung (044a, „Reihenfolge a → b“).
- **Demo und Dienst (ADR 0002):** Beide führen denselben Kern aus. Abweichend bleibt nur die leere Begründung `""` (422 im
  Dienst, 409 in der Demo; im Vertrag beschrieben). Nach Entscheidung 3 gibt es keine Abweichung bei Längen mehr.
- **Zwischenstand bis 045:** Ein HTTP-Client kann jetzt Verweigerungen anlegen; die Oberfläche zeigt sie ohne Kennzeichen
  (044a, „Zwischenstand bis 045“). Außer der eigenen Oberfläche gibt es in der Beta keinen Client.

## Sicherheits-Checkliste (Antworten für den Reviewer)

| Punkt | Antwort |
|---|---|
| SC-01 | ja: drei Routen hinter Akteur-Port und `validateOperation`; Rechte, Tabelle und Guards nur im Kern (`can()`); kein Rollenname im Diff (Tor role-literals) |
| SC-02 | ja: keine neue Aktion, keine Änderung an `ROLE_PERMISSIONS` oder der Wahrheitstabelle |
| SC-03 | ja: Maskierung auf allen Lesepfaden, im Strom und in Schreibantworten über HTTP belegt (Tests 9–11); `detail` ohne Inhalt (Tests 4–6) |
| SC-04 | ja: bestehende Body-Grenze, Rate-Limit und Zeitgrenze gelten unverändert für die drei Routen |
| SC-05 | ja: kein Geheimnis im Diff; Sitzung und CSRF wie bei `draftAnswer` |
| SC-06 | ja: T-G1-E-03, MF-07, MF-09 mit Erkennung (Zugriffslog mit `ruleId`) |
| SC-07 | ja: Zeit nur aus der injizierten Uhr (Test 16) |
| SC-08 | ja: keine neue SQL im Dienst; Postgres-Tests lesen über die Owner-Verbindung nur im Test |
| SC-09 | nicht anwendbar (kein Nachbarsystem) |
| SC-10 | ja: keine neue Abhängigkeit (`ucs2length` gehört zu Ajv, schon vorhanden) |
| SC-11 | ja: Zugriffslog mit einem Schlüssel mehr, nur Regel-ids; ADR 0013 und DSFA V10 angepasst |
| SC-12 | ja: Allowlist-Einträge entfernt, kein Tor geändert; Schlüsselliste in zwei CI-Skripten nachgezogen, nicht gelockert |
| SP-5 | ja: kein Token, keine Begründung, kein Vermerk im Log (Test 15) |
| SP-6 | ja: SG2, T-G1-E-01, T-G1-E-03, T-G1-I-05, T-G1-I-09, MF-07, MF-09 mit Testnamen im Bedrohungsmodell |

## Aufwand

Ehrlich geschätzt **2,0 AStd** statt 1 aus der Teilungstabelle:

| Teil | AStd |
|---|---|
| Montage, Allowlist, umgedrehter Allowlist-Test | 0,15 |
| Abweisungen über HTTP (401/403/404/409 mit zehn Regel-ids, 412/428, 422 Validator und Kern, Idempotenz) | 0,5 |
| Maskierung über sieben Lesepfade, Strom, Schreibantworten, Vermerk, `legalClearerIds` | 0,3 |
| Postgres P1–P5 | 0,25 |
| `ruleId` im Zugriffslog: Kontext, Log, vier Schlüssellisten, ADR-Nachtrag, DSFA (nicht in der Teilungstabelle bewertet; 044a setzte die Regel-id im Log als vorhanden voraus) | 0,35 |
| Gleichlauf der Längen (Codex P2) | 0,15 |
| `draftAnswer`-Fall, Kennzahl | 0,05 |
| Mutationsproben, `pnpm gates` mit Postgres, CI-Nachweis, Bericht | 0,25 |

Summe 044a + 044b: 3,25 + 2,0 = 5,25 AStd statt 2,5 laut Plan. Ohne die Regel-id im Zugriffslog (Eigentümerfrage 1,
Alternative) 1,65 AStd.

## Offene Eigentümerfragen

Keine blockiert den Bau; beide sind auf Standard gebaut.

1. **Regel-id im Zugriffslog (Datenschutz, Betriebsrat; E13, E14).** Neu gegenüber 044a: Das Zugriffslog hat heute genau acht
   Schlüssel (033a, ADR 0013, DSFA V10); 044a setzte eine Regel-id dort als vorhanden voraus.
   - **Standard (gebaut):** neunter Schlüssel `ruleId`, nur Regel-ids des Kerns, für jede Operation; ADR-Nachtrag und DSFA V10.
     Nutzen: abgewiesene Versuche (fehlende Rechtsfreigabe, Selbstfreigabe) sind im Vorfall nach Regel unterscheidbar.
     Kosten: 0,35 AStd. Restrisiko: mehr Verhaltensdaten je pseudonymem Subject, unter „nur zu zweit“ (MF-09).
   - **Alternative:** kein neuer Schlüssel; Erkennung nur über `operationId` und `status` 409 (die Regel-id steht weiter im
     Problem-Body an den Client). Die Missbrauchstabellen in 044a werden dann berichtigt. Spart 0,35 AStd.
2. **`draftAnswer` mit Verweigerungsfeldern (Security, Vertrag).** Neu durch den Auftragswortlaut „wird abgewiesen“.
   - **Standard (gebaut, wie 044a):** 200, die Felder werden verworfen, es entsteht eine gewöhnliche Antwort (Entscheidung 4,
     Test 13).
   - **Alternative:** 422 im Dienst und in der Demo. Dafür ein Vertragsschritt (`AnswerDraft` mit `answerKind: false`,
     `refusalGroundId: false`, `refusalGroundHash: false`, `refusalJustification: false`, Patch-Stufe mit Verweis auf ADR 0012
     als Begründung der brechenden Änderung), eine Bedingung im Kern und 044a Test 16 umgedreht. Rund 0,35 AStd, als eigener
     Takt nach 044b oder mit 045.

## Hinweise an Folgescheiben

- **045:** Die Oberfläche unterscheidet 422 (Eingabe; bei leerer Begründung im Dienst) und 409 R-GUARD-09 (leer nach Trimmen).
  Die Demo meldet für `""` 409; die Meldungstexte müssen beide Wege abdecken.
- **047:** `ruleId` im Zugriffslog gehört zu den Feldern, deren Auswertung zusammen mit der Historie „nur zu zweit“ technisch
  gesperrt wird.
- **073 (Codec):** P2 liest die Begründung im Klartext aus `envelope->'payload'->'pii'`; mit einem echten Codec prüft der
  Test den verschlüsselten Wert.
- **Folgeliste (Takt core):** übrige Längenprüfungen des Kerns in Code-Punkten (Entscheidung 3); ggf. einzelne Surrogate auf
  Postgres (Vor-dem-Bau-Punkt 5).

## Bericht (nach Bau ausfüllen)

```
Slice: 044b-verweigerung-dienst
Done:
Evidence:
Open:
Touched:
```

## Review findings
