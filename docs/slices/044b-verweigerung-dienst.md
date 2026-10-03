# Scheibe 044b — Verweigerungspfad A und B, Teil 2: Dienst und HTTP-Nachweis

**Status:** angenommen; gebaut und gemergt als #134 `799cca5` (03.10.2026; auf Standard gebaut: Zugriffslog ohne neuen Schlüssel, `draftAnswer` mit `answerKind` → 200; Review ohne blocker/major, S/P/L-Befunde vor dem Merge behoben; MF-01-Korrektur durch den Orchestrator; Codex ohne Befund) · Spec: spec (03.10.2026; gelesen auf `83bc7e2`, Merge von 044a #131; Standard zum Zugriffslog nach Vorgabe des Orchestrators umgestellt: kein neuer Schlüssel; Lesebefund zu `66e69e2` eingearbeitet (3 major, Minor und Nits, Abschnitt „Review findings“); Teil 2 der geteilten Scheibe 044, Zuschnitt in `docs/slices/044a-verweigerung-kern.md`, Abschnitt „Teilung und Zuschnitt“)
**Risikoklasse:** hoch · 2,15 AStd (Spanne 2,0–2,3; Teilungstabelle 044a: 1; Begründung im Abschnitt „Aufwand“) · Plan 044: 06.11.2026 (W6), tatsächlich direkt nach 044a in der Lane service; **muss vor dem 27.11.2026 gemergt sein** (Ablauf der drei Allowlist-Einträge, `packages/contract/scripts/check.mjs` (d)) · Go des Eigentümers zum Zuschnitt (044a, Frage 2) am 03.10.2026, auf Standard gebaut · Lanes: service; contract (nur `allowlist.json`); core (nur die Längenprüfung von `proposeRefusal`); docs-sicherheit
**Rolle:** implementierer-backend (kein Vertrags- und kein ADR-Schritt). Review in frischem Kontext mit den Perspektiven **Security** (Maskierung über HTTP, Rechte, Erkennung abgewiesener Versuche), **Datenschutz** (Begründung im `pii`-Teil der gespeicherten Zeile, Aufbewahrungsklasse, Zugriffslog ausdrücklich unverändert) und **Vertrag** (Gleichlauf von Validator und Kern, Antwortprüfung, Allowlist und Abdeckungstor). Lesebefund der Spec vor dem Bau; nie gebündelt. Modell nur in `.claude/agents/` (takt-012)
**Rule ids:** keine neue. Über HTTP belegt: R-TRANS-15, R-TRANS-16, R-GUARD-03, R-GUARD-04, R-GUARD-06, R-GUARD-08, R-GUARD-09, R-GUARD-11, R-GUARD-12, R-GUARD-13, R-GUARD-14, R-TRANS-00, R-PERM-01, R-IDEM-01 (nur Abgrenzung); R-PERM-02 nur im Kern (über HTTP nicht erreichbar, Test 1). Dazu AGENTS.md R2, R3, R4, R6, R7, R8, R11, R12
**Quellen-IDs:**
- `docs/slices/044a-verweigerung-kern.md`: Teilungstabelle (Zeile 044b), „Hinweise an Folgescheiben: 044b“, Missbrauchstabellen (Einträge „044b“), Abweichungen 2–6 des Baus, Review-Runde `44704c9` (Befunde 1, 2, 5), Nachtrag des Orchestrators zu R-GUARD-14
- Codex-Review PR #131 (P2 „Count refusal lengths as Unicode characters“, `packages/domain/src/api.ts:322`)
- Spec 035b (Muster einer Dienstscheibe: Allowlist im Commit des ersten Routentests, Postgres-Test, Zugriffslog), Spec 033a (Entscheidung 5: Zugriffslog mit genau acht Schlüsseln), Spec 040b (Muster: Allowlist-Test nach dem Entfernen)
- ADR 0013 (Ebene 2), ADR 0011 (Hash-Kette), ADR 0009 (`pii`-Umschlag), ADR 0015 (Allowlist mit Ablauf), ADR 0002 (Demo im Prozess)
- Register E56 (CI-Artefakt als Nachweis; hier nicht berührt), E14 (DSB), E13 (Betriebsvereinbarung)
- Bedrohungsmodell SG2, T-G1-E-01, T-G1-E-03, T-G1-I-01, T-G1-I-02, T-G1-I-05, T-G1-I-09, MF-06, MF-07, MF-09, MF-13; DSFA-Vorentwurf V7, V10

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
- **Längenprüfung im Kern** (`checkRefusalProposal`, `packages/domain/src/api.ts:313-339`, Kommentar ab 310) zählt `.length`, also
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
- **Problem-Antwort.** `ApiProblem` (aus `@hv/domain`) trägt `ruleId`; der Typ `Problem` des Rumpfs steht in `apps/api/src/problem.ts:11`; `app.onError` bildet die Antwort mit
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

Die Middleware-Kette entscheidet in dieser Reihenfolge (`app.ts:465-467`, `api.ts` `transition`); die Tests halten sie fest,
ändern sie aber nicht:
1. 413 bei Überschreiten der Body-Grenze (Schicht 6, **vor** dem Akteur);
2. 401 ohne Akteur (Schicht 7, Akteur-Port);
3. 429 der Subject-Grenze (Schicht 8; 60 Schreibvorgänge je Subject und Minute, `DEFAULT_LIMITS.writePerSubject`);
4. 422 des Validators: erst Kopf- und Query-Parameter, dann der Body (Form, Länge, `additionalProperties`, `if`/`then` für
   Pfad A). **Vor** Recht und Existenz: Ein Nichtberechtigter mit fehlerhaftem Body erhält 422, nicht 403. Das gilt für jede
   Operation des Dienstes und verrät nichts über die Frage. Die 403- und 404-Tests senden deshalb einen gültigen Body.
   `If-Match` ist im Vertrag nur `type: string`; der Validator prüft sein Format nicht;
5. im Kern, `proposeRefusal`: 422 der Eingabeprüfung (nur, was der Validator nicht prüft: `text` nur aus Leerraum,
   unbekanntes oder leeres `refusalGroundId`) **vor** `transition()`;
6. in `transition()` (beide Operationen): **zuerst** die Wiederholung mit gleichem Idempotenzschlüssel (die historische
   Antwort kommt vor 404 und 403, `api.ts:777`), dann 404 bzw. 403 R-PERM-01 (`requireQuestionFor`), dann `checkIfMatch`:
   428 ohne `If-Match`, 422 bei einem `If-Match`, das nicht `"v<n>"` lautet, 412 bei veralteter Version; zuletzt 409 aus
   Tabelle und Guards. `approveRefusal` prüft vor `transition()` zusätzlich `answerVersion` als positive ganze Zahl (422;
   über HTTP fängt das schon der Validator).

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

### 5. Zugriffslog ohne neuen Schlüssel (auf Standard gebaut, Eigentümerfrage 1)

Die Teilungstabelle von 044a verlangt „Zugriffslog mit Regel-id“, und die Missbrauchstabellen von 044a nennen „409 mit
Regel-id im Zugriffslog (033a, ab 044b über HTTP)“. Das Zugriffslog hat aber genau acht Schlüssel (Befund). Ein neunter
Schlüssel `ruleId` würde die Verhaltensdaten je pseudonymem Subject erweitern (welche Regel einen Versuch abgewiesen hat,
etwa R-GUARD-06, Versuch der Selbstfreigabe; DSFA V10, MF-09, DSB und Betriebsrat). Ein Standard, der den Datenschutz
erweitert, wird nicht ohne Go des Eigentümers gebaut (Orchestrator, 03.10.2026). **Der Standard ist deshalb:**
- **Kein neuer Schlüssel.** Zugriffslog, ADR 0013, DSFA V10 und die vier Prüfstellen der Schlüsselmenge bleiben unverändert.
- **Erkennung über `operationId` und `status`.** Ein abgewiesener Vorschlag oder eine abgewiesene Freigabe erscheint als Zeile
  mit `operationId` `proposeRefusal` bzw. `approveRefusal`, `status` 409 (bzw. 403) und `seq` `null`. Welche Regel griff,
  steht nur im Problem-Body an den Client (`ruleId`) und lässt sich im Vorfall über den Zeitpunkt und den betroffenen Vorgang
  nachvollziehen, nicht aus dem Log allein.
- **Berichtigung:** Diese Spec führt keine eigene Missbrauchstabelle; „Wirkung und Risiko“ und die Sicherheits-Checkliste
  nennen „Zugriffslog: `operationId` + `status`; Regel-id nur im Problem-Body“. Dieselbe falsche Annahme steht an drei Stellen
  außerhalb dieser Spec:
  - 044a, Missbrauchstabellen („409 mit Regel-id im Zugriffslog (033a, ab 044b über HTTP)“): gilt im Sinne dieses Standards;
    die Datei 044a wird nicht geändert, der Bericht nennt die Berichtigung;
  - Bedrohungsmodell **MF-13**, *Erkennung* („im Dienst steht er ab 044b im Zugriffslog (033a)“): wird berichtigt;
  - Bedrohungsmodell **MF-06**, *Erkennung* („ein verweigerter Versuch steht als 409 mit R-ADM-07 im Zugriffslog (033a)“):
    wird ebenso berichtigt (der Fehler stammt aus 040a; das Zugriffslog hatte nie eine Regel-id).
- **Option** (Eigentümerfrage 1): neunter Schlüssel `ruleId` mit Musterprüfung, für jede Operation; Kosten im Abschnitt
  „Offene Eigentümerfragen“.

### 6. Nachweise über HTTP aus dem Review von 044a

- **Wiederholte Rechtsfreigabe:** `legalClearerIds` (intern, 044a Befund 1) erscheint in **keiner** Antwort dieser Tests:
  Fragen, Listen, Bühne, Historie, Ereignisse, Strom, Schreibantworten (Test 11, Volltextprüfung jeder Antwort).
- **R-GUARD-08 vor R-GUARD-14:** `approveRefusal` ohne Rechtsfreigabe antwortet `ruleId` R-GUARD-08, nicht R-GUARD-14
  (Test 4).
- **`sources`-Grenzen:** 50 Einträge mit je 2000 Zeichen gelingen; 51 Einträge, ein Eintrag mit 2001 Zeichen, ein Eintrag,
  der keine Zeichenkette ist, sind 422 (Validator). In der Demo sind dieselben Fälle 422 aus dem Kern; sie stehen schon in 044a
  Test 6.

## Nicht-Ziele

- Keine Änderung an `openapi.yaml` oder den Vertragstypen. Weicht der Vertrag vom Kern ab, ist das ein Befund: anhalten,
  melden.
- Keine Formänderung an `AnswerDraft` (Entscheidung 4; Eigentümerfrage 2).
- Keine Änderung an Rechten, Übergangstabelle, Guards, Projektion, Maskierung oder Wahrheitstabelle. Die einzige Änderung im
  Kern ist die Zählweise in `checkRefusalProposal`.
- Keine Oberfläche, kein Screenshot (045).
- Keine neue Kennzahl, keine Änderung am Kennzahlenkatalog.
- Keine Änderung am Zugriffslog: kein neuer Schlüssel (auch nicht `ruleId`, Entscheidung 5), keine Änderung an Senke,
  Aufbewahrung oder Hash-Schlüssel; keine Änderung an ADR 0013 oder DSFA V10.
- Keine Umstellung der übrigen Längenprüfungen im Kern (Folgeliste, Entscheidung 3).
- Kein Export (051), keine Untergründe für Pfad A (044c), kein echter `pii`-Codec (073).

## Files allowed

Dienst:

- `apps/api/src/app.ts` (nur drei Routen und Typimport von RefusalProposal)
- `packages/contract/allowlist.json` (nur die drei Einträge mit slice 044 entfernen, im Commit des ersten Routentests)

Kern (nur Entscheidung 3):

- `packages/domain/src/api.ts` (nur checkRefusalProposal und eine Hilfsfunktion codePointLength)
- `packages/domain/src/__tests__/refusal044a.test.ts` (nur Test 6: Fälle mit Vier-Byte-Zeichen und einzelnen Surrogaten)

Tests im Dienst:

- `apps/api/src/__tests__/refusal044b.test.ts` (neu, ohne Postgres)
- `apps/api/src/__tests__/postgres-refusal044b.test.ts` (neu, mit Postgres)
- `apps/api/src/__tests__/contract-043a.test.ts` (nur Test 8: die Allowlist-Prüfung umgedreht, die drei Einträge stehen nicht mehr, und der Testtitel ohne „are pre-declared for 044“)

Dokumente:

- `docs/sicherheit/bedrohungsmodell.md` (nur: Stand und Testnamen an SG2, T-G1-E-01, T-G1-E-03, T-G1-I-01, T-G1-I-02, T-G1-I-09, MF-07; T-G1-I-05 um den Hinweis auf die Wiederholung von refusalGroundId im 422; MF-13 Erkennung und Nachweis; MF-06 nur der Satz zum Zugriffslog in Erkennung; Zeile 044 in „Weitere Scheiben mit Sicherheitsbezug“)
- `docs/folgeliste.md` (nur: Eintrag „übrige Längenprüfungen des Kerns in Code-Punkten“ aus Entscheidung 3, Eintrag „einzelnes Surrogat auf Postgres ergibt 500“ aus Vor-dem-Bau-Punkt 5 und neue nicht blockierende Befunde des Baus; keine Sicherheits-, Datenschutz- oder Rechtspunkte)
- `docs/slices/044b-verweigerung-dienst.md` (diese Spec: Bericht, Review findings)
- `docs/produktplan-beta.md` (nur durch den Orchestrator mit dem Merge: Stand-Zeile Etappe C)

Weitere Dateien sind Scope-Befunde.

## Ausdrücklich nicht erlaubt

`packages/contract/openapi.yaml`, `packages/contract/src/types.ts`, `packages/contract/CHANGELOG.md`,
`packages/contract/scripts/**`, `packages/domain/src/**` außer den zwei genannten Dateien (insbesondere `transitions.ts`,
`permissions.ts`, `stream.ts`, `state.ts`, `refusalGrounds.ts`), `packages/domain/policy-truth-table.md`,
`apps/api/src/__tests__/helpers.ts`, `apps/api/src/stream/**`, `apps/api/src/persistence/**`, `apps/api/src/limits/**`,
`apps/api/src/metrics/**`, `apps/api/src/observability/**`, `apps/api/src/problem.ts`, `apps/api/migrations/**`,
`apps/web/**`, `.github/workflows/**`, `scripts/**`, `docs/adr/**`, `docs/datenschutz/**`,
`docs/slices/033a-serverzeit-health-zugriffslog.md`. Dieser Abschnitt steht bewusst außerhalb von
„Files allowed“, damit `slice-scope` die Pfade nicht als erlaubt liest.

## Vor dem Bau prüfen

1. **044a gemergt** (`83bc7e2`) und Vertrag 0.4.2: `HvApi` hat `listRefusalGrounds`, `proposeRefusal`, `approveRefusal`;
   die Allowlist führt die drei Einträge mit `slice` 044. Fehlt etwas: anhalten.
2. **Eigentümerfrage 1:** Hat der Eigentümer die Option `ruleId` gewählt, wird diese Spec vorher vom Architekten angepasst
   (ADR-Nachtrag, Dateien, Tests); ohne Antwort gilt der Standard ohne neuen Schlüssel.
3. **Demo-Kopf und Rollenwechsel (vom Architekten beantwortet):** `X-Actor` nimmt jedes `id:rolle` an. Hat die id aber eine
   `RoleAssigned`-Geschichte im Seed, nutzt `resolveMeetingActor` (`packages/domain/src/stream.ts:222-226`) die bestehende
   Zuordnung statt der Rolle aus dem Kopf. Für S, K und C (Test 4, R-GUARD-14) und für jede weitere zweite Person nimmt der
   Test deshalb ids, die im Seed **nicht** vorkommen (vorher gegen `listRoleAssignments` bzw. die Seed-Ereignisse geprüft).
   Dann reicht derselbe id mit anderer Rolle für „S klärt als `legal`, gibt als `approver` frei“.
4. **R-GUARD-11 über HTTP (vom Architekten beantwortet):** `createApp` nimmt `persistence: { load, save }` (Muster
   `master-data040b.test.ts:56`). Die Ereignisse entstehen wie in 044a Test 12: ein Kern-Store mit Seed, dazu ein direkt
   angehängtes `AnswerDrafted` mit veraltetem `refusalGroundHash` (der Store stempelt Hash und Kette, die Kette bleibt
   gültig); `load` übergibt sie der App. Prüft `load` die Kette und lehnt sie ab, oder fehlt der Weg: Befund im Bericht, der
   Fall bleibt im Kern belegt, kein Ersatz durch Abschwächen.
5. **Einzelne Surrogate auf Postgres (Lesebefund nit 22, hingenommen):** jsonb lehnt ein einzelnes Surrogat (`"\ud800"`) ab;
   der Postgres-Pfad antwortet darauf mit 500. Das besteht für jedes Textfeld, ist kein Sicherheits- oder Datenschutzpunkt
   (kein Leck, kein Ereignis, die Anfrage scheitert ganz) und gehört nicht zu dieser Scheibe. Der Bau legt den Eintrag auf
   der Folgeliste an; Test 7 prüft einzelne Surrogate nur ohne Postgres.
6. **Zugriffslog bei Rollback:** Schreibt der Postgres-Pfad bei einer Abweisung innerhalb von `postgresBoundary` genau eine
   Zeile mit `status` 409 und `seq` `null` (Test P4)? Sonst Befund.
7. **Kennzahl (vom Architekten beantwortet):** Der Seed-Jahrgang läuft (`packages/domain/src/seed.ts:415-417`,
   `MeetingStarted`). Test 16 gilt also; er misst gegen eine Grundlinie, weil Seed-Fragen selbst in `in_review` liegen können.
8. Weichen Zeilenangaben ab: melden, nicht raten.

## Tests zuerst (rot, dann grün)

Ohne Postgres: `apps/api/src/__tests__/refusal044b.test.ts`. `createApp({ demoEnabled: true, clock, accessLog })` mit
Speichersenke und injizierter Uhr, Seed über `POST /v1/demo/seed`. Alle Aufrufe über `req()` (prüft jede Antwort gegen den
Vertrag und zählt die Operation für das Abdeckungstor). Akteure über `X-Actor`, dazu lokal `coordination` und zweite
Personen je Rolle.

**Testaufbau (Rate-Limit):** Die Subject-Grenze erlaubt 60 Schreibvorgänge je Subject und Minute. Jeder `it`-Block erhält
eine **frische App** mit eigenem Seed, oder die injizierte Uhr rückt zwischen Gruppen um mindestens 60 s vor. Die Grenzen
werden **nicht** über `limits` angehoben. Ein 429 in einem Test ist ein Fehler des Testaufbaus, nie ein erwartetes Ergebnis.

**Kopf und Ereignis-Scan mit Positivkontrolle.** `GET /v1/events` liefert ohne Parameter nur `after=0`, `limit=1000`; der
Seed hat mehr als 1000 Ereignisse. Deshalb:
- `headSeq()` blättert als admin mit `after=<zuletzt gesehene seq>&limit=5000` bis zur leeren Seite und gibt die höchste
  `seq` zurück. **„Kein neues Ereignis“** heißt: `headSeq()` vor und nach dem Aufruf gleich, und die Zugriffslogzeile des
  Aufrufs hat `seq: null`.
- `scanEvents(after)` liest als admin alle Ereignisse mit `seq > after` (blätternd). Jeder Scan in Tests 9, 10 und 13 nutzt
  `after` = `headSeq()` **vor** dem geprüften Schritt.
- **Positivkontrolle in jedem Scan:** Der gelesene Satz enthält nachweislich das geprüfte Ereignis (`AnswerDrafted` der
  Verweigerung mit `answer.answerKind` und `subjectId` der Frage bzw. `QuestionLegalCleared` dieser Frage). Fehlt es, ist der
  Test rot; eine Maskierungsprüfung über eine leere oder falsche Menge besteht nie.
- **`/stream`:** Der admin-Strom öffnet mit `Last-Event-ID` = Kopf vor dem Schritt (Leser `stream-reader035.ts`). Der Test
  wartet mit Zeitgrenze auf den `event`-Rahmen mit der `seq` des geprüften Ereignisses; kommt er nicht, ist der Test rot.
  Für `legal` (ohne `event.read`) muss mindestens ein `change`-Rahmen zu dieser Frage ankommen.
- `getQuestionHistory` ist je Frage ungeblättert; die Positivkontrolle gilt dort ebenso.

**Antwort-Haken (SG2).** Ein lokaler Wrapper um `req()` in `refusal044b.test.ts` (`helpers.ts` bleibt unverändert) prüft
**jeden** Rumpf der Tests 1–16 je aufrufendem Akteur: JSON-Antworten, Problem-Rümpfe und jeden SSE-Rahmen aus dem
Stromleser. Er liest den Rohtext (geklonte Antwort) und verlangt:
- der **Begründungs-Marker** erscheint nur, wenn der Akteur `legal`, `coordination` oder `approver` ist;
- der **Vermerk-Marker** (`note`) erscheint nie, für niemanden;
- der Schlüssel **`legalClearerIds`** erscheint nie;
- Text-, Begründungs- und Vermerk-Marker stehen in keinem `detail`.
Jeder Test erzeugt seine Marker eindeutig. Der Haken ersetzt keine gezielte Prüfung, er fängt jeden Pfad, den eine gezielte
Prüfung vergessen hat.

1. **Montage:**
   - `GET /v1/refusal-grounds` gelingt für alle neun Rollen des Seeds; sieben Einträge; `id` und `hash` gleich
     `REFUSAL_GROUNDS` aus `@hv/domain`. Ohne Akteur 401. **R-PERM-02 ist über HTTP nicht erreichbar:** `VALID_ROLES`
     sind die Schlüssel von `ROLE_PERMISSIONS` (`apps/api/src/actor.ts:8`), und jede Rolle hält eines der drei Leserechte;
     ein Akteur ohne Leserecht kommt am Akteur-Port nicht vorbei. Kein HTTP-Test dafür; der Fall bleibt in 044a Test 19 belegt.
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
   - `observer` für beide Operationen: auf einer Frage in `delivered` → 403 R-PERM-01 (lesbar über
     `question.read.delivered`, Recht fehlt), auf einer Frage in einem anderen Status → 404 (`requireQuestionFor`);
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
5. **412, 428 und fehlerhaftes `If-Match`:** beide Operationen mit veraltetem `If-Match` → 412; ohne `If-Match` → 428; mit
   `If-Match: abc` → 422 aus dem Kern (nach Recht und Existenz, Abschnitt 2); jeweils kein Ereignis, `detail` ohne Text.
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
7. **Gleichlauf der Längen (Entscheidung 3)**, in `refusal044b.test.ts`; `codePointLength` ist aus
   `packages/domain/src/api.ts` exportiert (über `@hv/domain`, `index.ts` exportiert `api.js` schon ganz); `ucs2length` wird
   mit `createRequire(import.meta.url)('ajv/dist/runtime/ucs2length').default` geladen (CommonJS, Standardexport unter
   `.default`; Ajv ist schon Abhängigkeit von `apps/api`):
   - `codePointLength` gleich `ucs2length` für: leere Zeichenkette, ASCII, Umlaute, ein Emoji, 4000 Emoji, ein
     einzelnes hohes Surrogat am Ende, ein einzelnes tiefes Surrogat, ein vertauschtes Paar;
   - über HTTP und in der Demo gleich: Begründung aus 4000 Emoji → 200 (heute 422 im Kern: **rot zuerst**); 4001 Emoji → 422;
     `text` aus 20000 Emoji → 200, 20001 → 422; ein Eintrag in `sources` aus 2000 Emoji → 200, 2001 → 422;
     `refusalGroundId` aus 129 Emoji → 422 (Validator und Kern);
   - in der Demo (`refusal044a.test.ts`, Test 6): dieselben Fälle; einzelne Surrogate nach Vor-dem-Bau-Punkt 5.
8. **Idempotenz:**
   - `proposeRefusal` als `legal` zweimal mit gleichem `Idempotency-Key` und gleichem Body → gleiche Version, gleiches
     `ETag`, kein neues Ereignis; die Wiederholung trägt die Begründung (Leser `legal`). Die Wiederholung sendet das
     `If-Match` des ersten Aufrufs, das inzwischen veraltet ist: Antwort 200 mit dem historischen Ergebnis, nicht 412 (die
     Wiederholung kommt vor `checkIfMatch`, Abschnitt 2);
   - derselbe Schlüssel von einem anderen Akteur (`leg2:legal`) ist keine Wiederholung (Schlüssel je Akteur): ein neuer
     Vorschlag mit eigener Version;
   - `approveRefusal` zweimal mit gleichem Schlüssel → eine Freigabe, ein `QuestionApproved`.
9. **Maskierung der Begründung über HTTP.** Aufbau: Frage A mit Verweigerung Pfad B (vorgeschlagen, rechtlich freigegeben,
   freigegeben, auf der Bühne, vorgelesen); Frage B mit einer Verweigerung, die ein späterer Antwortentwurf verdrängt hat.
   - `getQuestion`: Begründung vorhanden für `legal`, `coordination`, `approver`; fehlt für admin, `moderation`, `capture`,
     `expert`, `observer` (nach `delivered`); fehlt in der verdrängten Version für `moderation`, vorhanden für `legal`;
   - `listQuestions` und `listMeetingQuestions`: fehlt als admin und `moderation`, vorhanden als `legal`;
   - `getQuestionHistory` als `legal` und als admin, `scanEvents(Kopf vor dem Vorschlag)` als admin: das `AnswerDrafted` der
     Verweigerung ist enthalten (Positivkontrolle), ohne `payload.pii` und ohne `refusalJustification` an irgendeiner Stelle;
     Schnappschuss `refusalGround` und `toStatus` vorhanden;
   - **`/stream`**: admin erhält den `event`-Rahmen mit der `seq` dieses `AnswerDrafted` (Positivkontrolle mit Zeitgrenze),
     ohne `pii` und ohne Begründung; `legal` (ohne `event.read`) erhält mindestens einen `change`-Rahmen zu dieser Frage und
     keinen `event`-Rahmen;
   - `GET /v1/stage` und `GET /v1/meetings/{meetingId}/stage` als `approver`, `moderation` und `podium` (nach `staged`):
     fehlt;
   - **Schreibantworten** (zusätzlich zum Antwort-Haken gezielt): `returnQuestion` als admin, `stageQuestion` als
     `moderation`, `deliverQuestion` und `closeQuestion` als `podium`, `withdrawQuestion`, `claimQuestion` und
     `releaseQuestion` durch die Rollen, die sie halten (aus `_actions` gelesen, kein Rollenname im Code der Prüfung), sowie
     `draftAnswer` und `submitForReview` als `expert` auf Frage B (verdrängte Verweigerung in `answers`): keine Version trägt
     eine Begründung, außer der Akteur ist `legal`, `coordination` oder `approver`;
   - Suche: `GET /v1/questions?q=<Wort nur aus der Begründung>` als `legal` → 0 Treffer; ein Wort aus `text` → 1 Treffer.
10. **Vermerk der Rechtsfreigabe:** `clearQuestionLegally` mit `note` (Marker) auf einer Antwort und auf einer Verweigerung.
    Die Antwort von `clearQuestionLegally` selbst (als `legal`) trägt den Vermerk nicht. `getQuestionHistory` (`legal`),
    `scanEvents(Kopf vor der Rechtsfreigabe)` (admin) und der `event`-Rahmen auf `/stream` (admin) enthalten das
    `QuestionLegalCleared` dieser Frage (Positivkontrolle) und zeigen es ohne `note`; `getQuestion` trägt keinen Vermerk; der
    Antwort-Haken findet den Marker in keinem Rumpf.
11. **Antwort-Haken wirkt:** Ein eigener Fall belegt den Haken selbst: Nach der wiederholten Rechtsfreigabe aus Test 4
    (zwei Freigebende, also `legalClearerIds` mit zwei Einträgen im Kern) laufen `getQuestion`, `listQuestions`, beide
    Bühnenrouten, `getQuestionHistory`, `scanEvents` und ein Strom-Rahmen für jede Rolle; der Haken meldet keinen Treffer.
    Eine Kontrollprobe mit absichtlich eingeschleustem Marker in einem konstruierten Rumpf zeigt, dass der Haken rot wird.
12. **Antwortprüfung:** Jede Antwort mit einer Verweigerungsversion besteht die Vertragsprüfung von `req()` (Invarianten
    an `AnswerVersion`: Pfad B mit Grund und Hash, Pfad A ohne). Keine Ausnahme in `UNDOCUMENTED_STATUS_EXCEPTIONS`.
13. **`draftAnswer` mit Verweigerungsfeldern** (Entscheidung 4): Body `{ text, answerKind: 'refusal_with_ground',
    refusalGroundId: 'aktg-131-3-nr1', refusalJustification: <Marker> }` als `expert` → 200; die neue Version trägt kein
    `answerKind`, kein `refusal*`-Feld; das Ereignis in `scanEvents(Kopf vor dem Entwurf)` (Positivkontrolle: es ist enthalten) hat kein `pii`; der Marker steht in keiner Antwort,
    auch nicht für `legal`; nach Prüfung und Rechtsfreigabe enthält `_actions` von `approver` `question.approve`, nie
    `question.refuse.approve`; `approveRefusal` darauf → 409 R-GUARD-13.
14. **Ganze Kette über HTTP**, Pfad A und Pfad B: Vorschlag → Rechtsfreigabe → Freigabe → `stageQuestion` (`moderation`) →
    `deliverQuestion` (`podium`, `QuestionDelivered.answerVersion` = Verweigerungsversion) → `closeQuestion`.
15. **Zugriffslog unverändert, Erkennung über `operationId` und `status`** (Speichersenke, in `refusal044b.test.ts`):
    - jede Zeile der Verweigerungsaufrufe hat genau die **acht** Schlüssel aus 033a; kein Schlüssel `ruleId`;
    - 409 aus Test 4 (R-GUARD-08) → Zeile mit `operationId` `approveRefusal`, `status` 409, `seq` `null`; 403 aus Test 3 →
      `operationId` `proposeRefusal`, `status` 403; ein gelungener Vorschlag → `status` 200, `seq` gesetzt;
    - kein Marker aus `text`, Begründung oder Vermerk und keine Regel-id steht in einer Zeile.
16. **Kennzahl gegen Grundlinie** (Vor-dem-Bau-Punkt 7): zwei Apps mit gleichem Seed und gleicher Uhr; in der Versuchs-App ein
    Vorschlag bei t0, in der Kontroll-App nichts. `GET /metrics` mit Token: Der Wert von
    `hv_questions_in_legal_review_over_10m` ist bei t0 + 11 min in der Versuchs-App um genau 1 höher als in der Kontroll-App,
    bei t0 + 9 min gleich. Kein neuer Name im Katalog.

Mit Postgres: `apps/api/src/__tests__/postgres-refusal044b.test.ts` (eigenes Schema je Lauf über `search_path`,
wie `postgres028.test.ts`; Variablen `TEST_DATABASE_URL`, `TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE`):

- **P1 Neustart mit Kettenprüfung:** App A: Vorschlag Pfad B (`coordination`) → Rechtsfreigabe (`legal`, mit `note`) →
  Freigabe (`approver`). App B auf derselben Datenbank (Neustart): Die erste Anfrage lädt und prüft die Kette ohne
  Integritätsfehler; `getQuestion` als `legal` zeigt `approved`, Version und Begründung, als admin keine Begründung;
  `scanEvents` als admin ab dem Kopf vor dem Vorschlag enthält `AnswerDrafted` und `QuestionLegalCleared` dieser Frage
  (Positivkontrolle), beide ohne `pii` und ohne `note`; `stageQuestion` über App B gelingt (die Kette läuft weiter).
- **P2 Ablage:** über die Owner-Verbindung: In der Zeile des `AnswerDrafted` steht die Begründung unter
  `envelope->'payload'->'pii'->>'refusalJustification'`, `envelope->'payload'->'answer'` hat keinen Schlüssel
  `refusalJustification`; `envelope->>'retentionClass'` ist `record` für dieses `AnswerDrafted` und für das `QuestionApproved`
  aus `approveRefusal`, `working` für `QuestionLegalCleared`; dessen gespeicherte Nutzlast trägt `note`; `persons` hat keine
  Zeile mit dieser `source_seq`.
- **P3 Wiederholung nach Neustart:** derselbe `Idempotency-Key` von `approveRefusal` über App B → historische Antwort, keine
  neue Zeile in `events`.
- **P4 Abweisung auf Postgres:** `approveRefusal` ohne Rechtsfreigabe → 409 R-GUARD-08, keine neue Zeile, genau eine
  Zugriffslogzeile mit `operationId` `approveRefusal`, `status` 409, `seq` `null` und den acht Schlüsseln.
- **P5 Kette schützt die Begründung:** Die Owner-Verbindung ändert `refusalJustification` in der gespeicherten Zeile. Die
  nächste Anfrage einer frischen App antwortet 500 ohne Inhalt (Integritätsfehler, ADR 0011); die Begründung erscheint in
  keiner Antwort und keiner Logzeile.

**Mutationsproben** (im Bericht mit „rot“ belegt, danach zurückgesetzt):

1. Eine der drei Routen nicht montiert → Test 1 rot, Abdeckungstor rot.
2. Ein Allowlist-Eintrag mit `slice` 044 bleibt stehen → Abdeckungstor rot („pre-declared … exercised“).
3. Route mit `guarded(undefined)` statt `guarded('proposeRefusal')` (Postgres-Grenze bleibt, kein Validator) → Test 6 rot:
   ein unbekanntes Feld ergibt 200 statt 422, eine leere Begründung `""` 409 R-GUARD-09 statt 422.
4. Die Route für `approveRefusal` ruft `approveQuestion` → Test 4 (R-GUARD-12/13) und Test 14 rot.
5. `writeOptions(c)` in `proposeRefusal` weggelassen → Test 5 und Test 8 rot.
6. `codePointLength` zurück auf `.length` → Test 7 rot.
7. Die Zugriffslogzeile erhält probeweise einen Schlüssel `ruleId` → Test 15 und P4 (genau acht Schlüssel) rot.
8. Das Entfernen von `note` in `maskEvent` (Kern) gestrichen → Test 10 rot.
9. `viewQuestion` maskiert mit `can(actor(), p, q)` → Test 9 rot (`approver` ohne mögliche Freigabe).
10. `getStage` ohne Maskierung → Test 9 (beide Bühnenrouten) rot.
11. `viewQuestion` lässt `legalClearerIds` stehen → Antwort-Haken (Tests 4, 9, 11) rot.
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
3. `git diff` gegen die Merge-Basis zeigt Änderungen nur in „Files allowed“; `apps/api/src/observability/**`, ADR 0013 und die
   DSFA sind unverändert.
4. `pnpm gates` mit Postgres-Variablen wie in CI grün auf einem sauberen Baucommit, einschließlich `slice-scope` auf
   `claude/slice-044b-…`; der Schluss der Ausgabe steht einmal im Bericht.
5. **Kein Keycloak-only-Test, E56 nicht berührt:** Jeder Test dieser Scheibe läuft lokal (mit Postgres-Variablen). Die Jobs
   `gates` und `e2e-http` laufen in der PR-CI unverändert grün; ein Merge braucht grüne CI auf dem letzten Commit der PR. Wird
   die Option aus Eigentümerfrage 1 gewählt, kommt die E56-Angabe hinzu (siehe dort).
6. Das Bedrohungsmodell nennt die Testnamen.
7. Gemergt vor dem 27.11.2026.

## Nachweise

- Schluss von `pnpm gates` mit Postgres-Variablen und Commit-Hash; Abdeckungszeile („… exercised by tests, 2 pre-declared …“).
- Testnamen 1–16 und P1–P5, mit „rot zuerst“ (erster Lauf ohne Routen; Test 7 vor der Angleichung).
- Ergebnis der Mutationsproben.
- Auszug: eine Zugriffslogzeile eines abgewiesenen `approveRefusal` (acht Schlüssel, `status` 409, `seq` `null`); eine
  `event`-Nachricht `AnswerDrafted` aus `/stream` als admin (ohne `pii`); das Ergebnis der SQL-Abfrage aus P2 mit
  synthetischer Begründung.
- Grüne PR-CI auf dem letzten Commit (Lauf-ID).
- **Kein Screenshot:** keine Oberfläche ändert sich (045).

## Qualitätswirkung

Reifestufe: pilot · Risikoklasse: hoch

Ausgelöst:
- [x] Rolle, Recht, Schutzklasse (Rechte über HTTP, Maskierung auf sieben Lesepfaden, Strom und Schreibantworten)
- [x] personenbezogene oder vertrauliche Daten (Begründung in der gespeicherten Zeile unter `pii`; Zugriffslog bewusst
  unverändert, Eigentümerfrage 1)
- [x] Vertrag (drei Operationen bedient, Allowlist leer für 044, Gleichlauf von Validator und Kern bei Längen)
- [x] Persistenz (Postgres: Neustart, Kette, Ablage, Aufbewahrungsklasse)
- [ ] Fachregel, Status (keine Änderung, nur Nachweis über HTTP)
- [ ] Oberfläche

Perspektive(n): Security (6.5), Datenschutz (6.6), Vertrag (6.4) · Nachweise: Tests 1–16, P1–P5, Mutationsproben ·
Offene Entscheidung: Eigentümerfragen 1 und 2; E14 (DSB)

## Wirkung und Risiko (Leitplanken §4, hoch)

- **Warum hoch:** Der Dienst öffnet die Verweigerung für jeden HTTP-Client. Jede Lücke zwischen Kern und Dienst (Validator,
  Route, Zugriffslog, Strom) wäre eine Umgehung der Oberfläche (T-G1-E-01) oder ein Leck der Begründung (SG2).
- **Bedrohungen:**
  - **T-G1-E-01** (Umgehung der Oberfläche): Alle Entscheidungen fallen im Kern; die Route reicht nur durch (Tests 3–6, 13).
  - **T-G1-E-03** (Verweigerung ohne Rechtsprüfung): 409 R-GUARD-08 über HTTP; im Zugriffslog als Zeile mit `operationId`
    `approveRefusal` und `status` 409 sichtbar, ohne Regel-id (Tests 4, 15, P4).
  - **MF-07** (Selbstfreigabe, auch nach Rollenwechsel): R-GUARD-06 und R-GUARD-14 über HTTP, mit wiederholter
    Rechtsfreigabe (Test 4).
  - **SG2, T-G1-I-01, T-G1-I-02, T-G1-I-09:** Maskierung über HTTP und `/stream`, jeder Scan mit Positivkontrolle, jeder
    Rumpf durch den Antwort-Haken (Tests 9–11).
  - **MF-13** (Verweigerung ohne Rechtsprüfung oder mit geändertem Grund): über HTTP belegt (Tests 4, 13, 14, P4).
    *Erkennung* im Bedrohungsmodell wird „Zugriffslog: `operationId` + `status`; Regel-id nur im Problem-Body“; *Nachweis*
    nennt die Testnamen. **MF-06** erhält dieselbe Berichtigung seines Zugriffslog-Satzes (Entscheidung 5).
  - **T-G1-I-05** (Echo ungeprüfter Eingaben): Das 422 des Kerns für ein unbekanntes `refusalGroundId` nennt die id, also
    einen Client-String bis 128 Zeichen. Als JSON im Problem-Rumpf harmlos, nie im Zugriffslog (acht Schlüssel ohne
    Fehlermeldung, Test 15); der Hinweis kommt in die Zeile T-G1-I-05.
  - **MF-09** (Leistungsauswertung über das Zugriffslog): unverändert; diese Scheibe fügt dem Log nichts hinzu
    (Entscheidung 5).
- **Invarianten:**
  - Keine Verweigerung entsteht über HTTP an `question.refuse.propose` vorbei; keine wird an `question.refuse.approve`,
    R-GUARD-08 oder R-GUARD-14 vorbei freigegeben.
  - Validator und Kern stimmen bei jeder Länge der Verweigerungsfelder überein (Code-Punkte).
  - Kein `EventRead`, keine Bühnenansicht, keine Strom-Nachricht und keine Antwort an Leser ohne `refuse.*` enthält die
    Begründung; kein Lesepfad enthält den Vermerk oder `legalClearerIds`.
  - Jede Zugriffslogzeile hat weiter genau die acht Schlüssel aus 033a.
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
| SC-03 | ja: Maskierung auf allen Lesepfaden, im Strom und in Schreibantworten über HTTP belegt (Tests 9–11), jeder Rumpf durch den Antwort-Haken, jeder Ereignis-Scan mit Positivkontrolle; `detail` ohne Inhalt (Tests 4–6) |
| SC-04 | ja: bestehende Body-Grenze, Rate-Limit und Zeitgrenze gelten unverändert für die drei Routen |
| SC-05 | ja: kein Geheimnis im Diff; Sitzung und CSRF wie bei `draftAnswer` |
| SC-06 | ja: T-G1-E-03, MF-07, MF-13 (und MF-06 berichtigt) mit Erkennung „Zugriffslog: `operationId` + `status`; Regel-id nur im Problem-Body“ |
| SC-07 | ja: Zeit nur aus der injizierten Uhr (Test 16) |
| SC-08 | ja: keine neue SQL im Dienst; Postgres-Tests lesen über die Owner-Verbindung nur im Test |
| SC-09 | nicht anwendbar (kein Nachbarsystem) |
| SC-10 | ja: keine neue Abhängigkeit (`ucs2length` gehört zu Ajv, schon vorhanden) |
| SC-11 | ja: Zugriffslog unverändert (acht Schlüssel, Test 15); keine neue Logzeile |
| SC-12 | ja: Allowlist-Einträge entfernt, kein Tor und kein CI-Skript geändert |
| SP-5 | ja: kein Token, keine Begründung, kein Vermerk im Log (Test 15) |
| SP-6 | ja: SG2, T-G1-E-01, T-G1-E-03, T-G1-I-01, T-G1-I-02, T-G1-I-05, T-G1-I-09, MF-07, MF-13 mit Testnamen im Bedrohungsmodell; MF-06 Erkennung berichtigt |

## Aufwand

Ehrlich geschätzt **2,15 AStd** (Spanne 2,0–2,3) statt 1 aus der Teilungstabelle; nach dem Lesebefund um 0,5 AStd höher:

| Teil | AStd |
|---|---|
| Montage, Allowlist, umgedrehter Allowlist-Test | 0,15 |
| Testaufbau: frische App je `it`, `headSeq`/`scanEvents` mit Positivkontrolle, Antwort-Haken mit Kontrollprobe | 0,3 |
| Abweisungen über HTTP (401/403/404/409 mit zehn Regel-ids, 412/428/422 `If-Match`, 422 Validator und Kern, Idempotenz) | 0,45 |
| Maskierung über sieben Lesepfade, Strom, alle Schreibantworten, Vermerk | 0,3 |
| Postgres P1–P5 | 0,25 |
| Gleichlauf der Längen (Codex P2) | 0,15 |
| `draftAnswer`-Fall, Kennzahl gegen Grundlinie | 0,1 |
| Bedrohungsmodell (MF-13, MF-06, T-G1-I-01/-02/-05, Testnamen) | 0,1 |
| 14 Mutationsproben, `pnpm gates` mit Postgres, Bericht | 0,35 |

Summe 044a + 044b: 3,25 + 2,15 = 5,4 AStd statt 2,5 laut Plan. Mit der Option `ruleId` aus Eigentümerfrage 1 kämen 0,35 AStd
hinzu (2,5).

## Offene Eigentümerfragen

Keine blockiert den Bau; beide sind auf Standard gebaut.

1. **Regel-id im Zugriffslog (Datenschutz, Betriebsrat; E13, E14).** Neu gegenüber 044a: Das Zugriffslog hat genau acht
   Schlüssel (033a, ADR 0013, DSFA V10); 044a setzte eine Regel-id dort als vorhanden voraus.
   - **Standard (gebaut):** kein neuer Schlüssel; Erkennung abgewiesener Versuche über `operationId` und `status` 409, die
     Regel-id steht nur im Problem-Body an den Client (Entscheidung 5). Kein Eingriff in den Datenschutz.
   - **Option:** neunter Schlüssel `ruleId` in jeder Zeile, Zeichenkette oder `null`; nur Werte nach `^R-[A-Z]+-\d{2}$`, nie ein
     Client-String; für jede Operation. Nutzen: abgewiesene Versuche (fehlende Rechtsfreigabe, Selbstfreigabe) sind im Vorfall
     nach Regel unterscheidbar. Restrisiko: mehr Verhaltensdaten je pseudonymem Subject, unter „nur zu zweit“ (MF-09); braucht
     DSB und Betriebsrat. Kosten **0,35 AStd**: ADR-0013-Nachtrag des Architekten als erster Commit; DSFA V10 und Zeile
     „Technisches Zugriffslog“; Anfragekontext und Logzeile; die Schlüsselmenge an vier Stellen
     (`apps/api/src/__tests__/access-log033a.test.ts`, `apps/api/src/__tests__/stream035.test.ts`, `scripts/e2e-http-031.mjs`,
     `scripts/keycloak-ci-029b.mjs`). Die beiden Skripte laufen mit Keycloak nur in der CI; der Nachweis folgt dann E56
     (Lauf-ID und PASS-Zeile je Job, bei einem Artefakt Artefaktname, Lauf-ID, Artefakt-ID und Digest). Als eigener Takt nach
     044b oder als Anpassung dieser Spec vor dem Bau.
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
- **047:** Wählt der Eigentümer die Option `ruleId` (Frage 1), gehört der Schlüssel zu den Feldern, deren Auswertung zusammen
  mit der Historie „nur zu zweit“ technisch gesperrt wird.
- **073 (Codec):** P2 liest die Begründung im Klartext aus `envelope->'payload'->'pii'`; mit einem echten Codec prüft der
  Test den verschlüsselten Wert.
- **Folgeliste (Takt core):** übrige Längenprüfungen des Kerns in Code-Punkten (Entscheidung 3); ggf. einzelne Surrogate auf
  Postgres (Vor-dem-Bau-Punkt 5).

## Bericht (nach Bau ausfüllen)

```
Slice: 044b-verweigerung-dienst
Done: Drei Routen (listRefusalGrounds, proposeRefusal, approveRefusal) reichen an den Kern durch; die drei
  Allowlist-Einträge mit slice 044 sind entfernt, contract-043a Test 8 umgedreht. checkRefusalProposal zählt alle
  vier Längen in Code-Punkten (codePointLength, wie Ajv ucs2length). Tests 1–16 über HTTP mit Antwort-Haken und
  Positivkontrollen, P1–P5 auf Postgres; Bedrohungsmodell und Folgeliste nachgeführt. Auf Standard gebaut
  (Go des Eigentümers 03.10.2026): Zugriffslog ohne neuen Schlüssel, draftAnswer mit answerKind → 200.
Evidence: pnpm gates mit TEST_DATABASE_URL/TEST_RUNTIME_DATABASE_URL/HV_DB_RUNTIME_ROLE (eigene Datenbank
  hv_t044b) auf Baucommit e22b411, Exit 0, Schluss der Ausgabe:
    ✓ built in 2.39s
    mark-test-run: wrote /home/user/wt/s044b/.claude/state/last-test-run (clean tree) at commit e22b411, tree 250df7ed9be3…
  Aus demselben Lauf: "apps/api test: Tests 663 passed (663)" (kein Test übersprungen, Postgres-Tests liefen);
  "operation-coverage: 69 operations in the contract, 67 exercised by tests, 2 pre-declared in allowlist.json" /
  "operation-coverage: ok"; "(d) allowlist.json well-formed, 2 pre-declared operation(s), none expired";
  "slice-scope: 9 changed file(s), all within … "Files allowed" list (11 pattern(s))".
  Rot zuerst: (1) refusal044b.test.ts ohne Routen 34 rot / 3 grün ("No such route."; die 3 grünen prüfen nur
  codePointLength und den Haken selbst); (2) nach der Montage nur Test 7 rot (4000 Emoji → 422 "refusalJustification
  must be a string of at most 4000 characters." aus dem Kern); (3) refusal044a Test 6 mit dem neuen Grenzfall rot
  (1 von 82); (4) postgres-refusal044b.test.ts P1–P5 rot ohne die Routen. Danach alles grün.
  Mutationsproben (jede rot, danach zurückgesetzt): 1 Route proposeRefusal nicht montiert → 30 Tests rot, u. a.
  Test 1; 1b Route listRefusalGrounds nicht montiert (Test 1a übersprungen, damit das Tor überhaupt läuft) →
  Abdeckungstor FAIL "listRefusalGrounds is neither exercised"; 2 Allowlist-Eintrag proposeRefusal/044 bleibt (Test 8
  übersprungen) → Abdeckungstor FAIL "pre-declared … but a test exercises it", mit Test 8 → Test 8 rot; 3
  guarded(undefined) → Test 6 rot (siehe Abweichung 1); 4 approveRefusal-Route ruft approveQuestion → 14 rot, u. a.
  Test 4 (R-GUARD-12/13, -08, -14) und Test 14; 5 writeOptions weg → 26 rot, u. a. Test 5 und Test 8 (428); 6
  codePointLength = .length → Test 7 rot (beide Fälle); 7 Zugriffslogzeile mit ruleId → Test 15 und P4 rot; 8
  note in maskEvent nicht entfernt → Tests 10 und 11 rot; 9 viewQuestion mit can(actor(), p, q) → Test 9 rot; 10
  getStage ohne { stage: true } → Test 9 rot; 11 legalClearerIds bleibt in viewQuestion → 20 rot (Haken), u. a.
  Tests 4, 9, 11; 12 R-GUARD-14 vor R-GUARD-08 → Test 4 (Reihenfolge) und Test 15 rot; 13 retentionClass record
  weg → P2 rot; 14 Begründung in answer statt pii → P2 rot (Test 9 grün, siehe Abweichung 2), 14b dazu
  refusalJustification aus MASKED_KEYS entfernt → Test 9 rot (listEvents mit answer.refusalJustification) und
  17 weitere.
  Auszüge (synthetisch): Zugriffslogzeile eines abgewiesenen approveRefusal:
    {"v":1,"ts":"2027-04-20T12:00:24.000Z","requestId":"a5b135a6-6d47-4359-b5a1-81ce42965cbb","subjectHash":"KPvwVbUKPk5pkVc4YUeO_Hx3cfg0b44NuU8vTxIq_AM","operationId":"approveRefusal","status":409,"latencyMs":0,"seq":null}
  /stream als admin, event-Rahmen AnswerDrafted (gekürzt): event: event / id: 307 / data: {"type":"AnswerDrafted",
    "seq":307,"payload":{"answer":{"version":1,"text":"WORTLAUT1X …","answerKind":"refusal_with_ground",
    "refusalGroundId":"aktg-131-3-nr1","refusalGroundHash":"4095dbd7…","refusalGround":{…}},"toStatus":"in_review"},
    "retentionClass":"record","redacted":true,…} — ohne pii, ohne refusalJustification.
  SQL aus P2: {"justification":"PGBEGRUENDUNG44BX: Offenlegung schadet der Gesellschaft.","inAnswer":false,
    "retention":"record"}; retentionClass AnswerDrafted record, QuestionLegalCleared working, QuestionApproved record;
    persons-Zeilen mit dieser source_seq: 0.
  Kein Screenshot (keine Oberfläche). Grüne PR-CI folgt mit der PR.
Open: Abweichung 1 (Probe 3): guarded(undefined) ergibt 500 statt 200/409, weil getValidatedBody ohne Validator
  keinen Rumpf hat; Test 6 ist rot, aber über einen anderen Weg als in der Spec vorhergesagt. Abweichung 2 (Probe
  14): Test 9 bleibt grün, weil maskEvent refusalJustification als zweite Sicherung überall entfernt (MASKED_KEYS,
  044a) und viewQuestion je Leser maskiert; kein Leck über HTTP, nur die Ablage (P2) zeigt den Fehler. Probe 14b belegt,
  dass Test 9 ohne die zweite Sicherung rot wird. Abweichung 3 (Zeilenangabe, Vor-dem-Bau-Punkt 8): der falsche
  Satz "ein verweigerter Versuch steht als 409 mit R-ADM-07 im Zugriffslog (033a)" steht in MF-01 (Erkennung,
  bedrohungsmodell.md:348), nicht in MF-06; MF-06 hat keinen Zugriffslog-Satz. MF-01 liegt außerhalb der erlaubten
  Abschnitte, daher nicht berichtigt; Befund an den Orchestrator. Ebenso nicht geändert (Spec): 044a
  Missbrauchstabellen ("409 mit Regel-id im Zugriffslog") gelten im Sinne von Entscheidung 5. Abweichung 4: Seed
  (30 Fragen, seed 7) hat keine Frage in staged; R-TRANS-00 aus staged/delivered baut die Fragen über HTTP auf.
  Umgebung: hv_owner hatte auf dem lokalen Cluster weder Superuser noch pg_read_all_stats (in CI ist er der
  Superuser des Images); postgres-takt024 und postgres027 sahen die Sperrwartenden in pg_stat_activity nicht und
  schlugen auch auf 92b3d18 fehl. Lokal GRANT pg_read_all_stats TO hv_owner, danach grün; kein Repo-Eingriff.
  Eigentümerfragen 1 und 2 offen (auf Standard gebaut); E14 (DSB).
Nachtrag Review (frischer Kontext, kein blocker/major; alle Befunde [S]/[P]/[L], in 84393f8 behoben): Test 15 mit
  422 für ein unbekanntes refusalGroundId (aktg-GRUND44BX) und Nachweis, dass keine Zugriffslogzeile es enthält
  (T-G1-I-05); Test 5 hält die Fehlerreihenfolge fest (expert mit unbekanntem Feld → 422 vor 403; veraltetes
  If-Match auf ungeklärtem Vorschlag → 412 vor 409 R-GUARD-08); Test 11 mit Strom-Kontrolle je Rolle aus
  ROLE_PERMISSIONS (event.read: event-Rahmen des QuestionLegalCleared; question.read: change-Rahmen mit byK.id;
  sonst kein Rahmen mit byK.id); Zähler für claim/release; /metrics-Rumpf durch den Antwort-Haken; MF-01 nennt
  operationId assignRole (Abschnitt MF-01 auf Weisung des Orchestrators, außerhalb der Abschnittsliste der Spec);
  MF-13 ergänzt (Standard-Log zeigt nur „abgewiesene Freigabe“, Regel nur mit Option aus Eigentümerfrage 1 oder
  Abgleich über Zeit und Frage). Semgrep (1.177.0, CI-Befehl) auf den geänderten .ts-Dateien: 0 findings.
  pnpm gates mit hv_t044b auf 84393f8, Exit 0, Schluss der Ausgabe:
    ✓ built in 1.81s
    mark-test-run: wrote /home/user/wt/s044b/.claude/state/last-test-run (clean tree) at commit 84393f8, tree fed7320172a8…
  Aus demselben Lauf: "apps/api test: Tests 663 passed (663)"; "operation-coverage: … 67 exercised by tests, 2
  pre-declared in allowlist.json" / "ok". Ein vorheriger Lauf auf 84393f8 scheiterte an zwei zeitkritischen Tests in
  postgres-limits034a (Last > 8 auf 4 Kernen, parallele Läufe; einzeln 21/21 grün; Folgeliste 040b); ohne Änderung
  wiederholt grün.
Touched: apps/api/src/app.ts, apps/api/src/__tests__/refusal044b.test.ts (neu),
  apps/api/src/__tests__/postgres-refusal044b.test.ts (neu), apps/api/src/__tests__/contract-043a.test.ts,
  packages/contract/allowlist.json, packages/domain/src/api.ts, packages/domain/src/__tests__/refusal044a.test.ts,
  docs/sicherheit/bedrohungsmodell.md, docs/folgeliste.md, docs/slices/044b-verweigerung-dienst.md (Bericht)
```

## Review findings

**Lesebefund der Spec (03.10.2026, frischer Kontext, zu `66e69e2`):** 0 blocker, 3 major (alle [S]), Minor und Nits.
Eingearbeitet:
- Major 1 [S]: `listEvents` liefert ohne Parameter nur 1000 Ereignisse, der Seed hat mehr. `headSeq()` und `scanEvents(after)`
  blättern; „kein neues Ereignis“ über den Kopf und `seq: null` im Zugriffslog; Positivkontrolle in jedem Scan und auf
  `/stream` (Abschnitt „Tests zuerst“, Tests 9, 10, 13, P1).
- Major 2 [S]: Antwort-Haken über alle Rümpfe der Tests 1–16 (JSON, Problem, SSE) je Akteur; gezielte Schreibantworten um
  `stageQuestion`, `closeQuestion`, `withdrawQuestion`, `claimQuestion`, `releaseQuestion`, `draftAnswer`/`submitForReview`
  auf verdrängter Verweigerung und die Antwort von `clearQuestionLegally` ergänzt; Test 11 belegt den Haken selbst.
- Major 3 [S][P]: MF-13 und MF-06 (Zugriffslog-Satz) in den erlaubten Abschnitten des Bedrohungsmodells, Erkennung
  berichtigt; MF-13 in SC-06/SP-6; T-G1-I-01/-02 zwischen Quellen, „Wirkung und Risiko“ und Files allowed angeglichen;
  T-G1-I-05 mit dem Hinweis auf die Wiederholung von `refusalGroundId` (bis 128 Zeichen) im 422 (nit 24).
- Minor 4: frische App je `it` oder Uhr um 60 s vor, Grenzen nicht angehoben. Minor 5: Test 16 gegen Kontroll-App;
  Vor-dem-Bau-Punkt 7 beantwortet (Seed läuft). Minor 6: Ort von Test 7, Export von `codePointLength`, Import von
  `ucs2length` über `.default`. Minor 7: Reihenfolge in Abschnitt 2 präzisiert (413, 429, Wiederholung vor 404/403,
  `If-Match` erst im Kern), Fall `If-Match: abc` → 422 in Test 5. Minor 8: Verweis auf Missbrauchstabellen berichtigt
  (044b hat keine; 044a, MF-13, MF-06 genannt). Minor 9: Wortlaut von Mutationsprobe 3. Minor 10: Aufwand 2,15 AStd, keine
  Probe gestrichen. Minor 12: Vor-dem-Bau-Punkt 4 beantwortet. Nit 22: einzelnes Surrogat auf Postgres ergibt 500,
  hingenommen (kein Sicherheitspunkt), Folgeliste über den Bau.
- Minor 11 (T-G1-I-01/-02 angleichen) war mit Major 3 erledigt.
- Nachgereicht (Wortlaut des Orchestrators, eigener Commit): 13 Zeilen von `checkRefusalProposal` (313-339, Kommentar ab 310);
  14 `ApiProblem` aus `@hv/domain`, `problem.ts:11` ist der Typ `Problem`; 15 Postgres-Test mit eigenem Schema über
  `search_path`; 16 R-PERM-02 über HTTP nicht erreichbar (`actor.ts:8`), vorn festgehalten statt getestet; 17
  Vor-dem-Bau-Punkt 3 beantwortet (ids außerhalb des Seeds wegen `resolveMeetingActor`); 18 `observer` in Test 3 (403 auf
  `delivered`, sonst 404); 19 Wiederholung mit veraltetem `If-Match` in Test 8 (Wiederholung vor 412); 20 Titel von
  contract-043a Test 8; 21 Demo-Fälle der `sources`-Grenzen stehen in 044a Test 6; 23 Typimport `RefusalProposal` in
  Files allowed. Kein neuer Sicherheitspunkt (16 und 17 machen Tests richtig, 18 ergänzt einen Rechtefall).

**Nachtrag des Orchestrators (03.10.2026):** Die falsche Aussage zum Zugriffslog stand in MF-01 (Erkennung, `bedrohungsmodell.md:348`), nicht in MF-06. Der Orchestrator hat sie in MF-01 korrigiert (Sicherheitsposten, nicht Folgeliste); der Abschnitt gilt damit als erlaubt.
