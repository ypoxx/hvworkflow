# takt-040 — Strom-Vertragswortlaut: `meetingId`-Filter und `Retry-After` wie gebaut (Vertrag 0.3.12)

**Status:** spec · **Risikoklasse:** mittel (Vertragsänderung, nur Beschreibungen; kein Hoch-Auslöser; Leitplanken §4) · **Lanes:** contract · **Perspektive:** Vertrag (6.4)
**Rolle:** architect (Spec und Vertragstext in einem, kein Anwendungscode); Review in frischem Kontext (Perspektive Vertrag gegen Dienst 035b), Modell nur in `.claude/agents/` (takt-012)
**Regeln:** AGENTS.md R1, R2, R3, R6 (Vertrag vor dem Client 036b), R12; ADR 0014 (Echtzeit per SSE, Nachtrag aus 035b); ADR 0015 (Versionierung, Patch-Stufe); R-PERM-04 (unverändert)
**Quellen-IDs:** Spec 035b, Abschnitt „Bauklärung“ Punkte 1 und 2; Review 035b minor 7 und Nachprüfung; Folgeliste 035b, Abschnitt „Strom-Dienst (aus 035b)“, Einträge 1 und 2 (beide auf `origin/claude/slice-035b-sse-dienst`, PR #107)
**Depends on:** keine offene Scheibe im Bau. Der Wortlaut beschreibt den Dienst aus 035b (PR #107); er ändert kein Verhalten und darf vor oder nach dem Merge von 035b landen. **Vor dem Bau von 036b** (Web-Strom-Client) gemergt.
**Glossar: neue Begriffe:** nein

## Befund (gelesen auf `2e708e1` und `origin/claude/slice-035b-sse-dienst`)

Vertrag 0.3.11 (035a) ließ zwei Punkte offen, die 035b im Rahmen von Spec und Vertrag entschieden hat, ohne den Wortlaut
anzupassen:

1. `streamEvents`, Abschnitt „Rights per message“: Leser mit `event.read` bekommen jedes Ereignis „gap-free in `seq`“.
   Unter einem `meetingId`-Filter liefert der Dienst nur Ereignisse dieses Jahrgangs; `id` bleibt die globale `seq`,
   Lücken sind Ereignisse anderer Jahrgänge. Ereignisse ohne Jahrgang kommen unter einem Filter nicht. Der Kopf rückt über
   den Heartbeat-`cursor` nach; die Nachlaufgrenze von 1000 zählt den globalen Abstand.
2. `components/headers/RetryAfter` nennt nur die Werte für 429 (Fensterende) und `PersistenceBusy` (2 oder 30). Der Strom
   sendet auf jedem 503 `StreamUnavailable` (Prozessgrenze, Migrationen offen, Persistenz beschäftigt beim Öffnen) und auf
   seinen eigenen 429 (zu viele offene Ströme je Sitzung oder Subjekt) immer 30 (`apps/api/src/stream/route.ts`,
   `STREAM_RETRY_AFTER_SECONDS` in `apps/api/src/limits/config.ts`, 035b). Ein `end {unavailable}` im laufenden Strom
   trägt keinen `Retry-After`.

Ein Client, der nach dem Wortlaut 0.3.11 baut, würde unter Filter Lücken als Fehler deuten oder nach `end` einen Kopf
erwarten. Deshalb wird der Wortlaut vor 036b angeglichen.

## Ziel

1. **`streamEvents`-Beschreibung:** „gap-free in `seq`“ gilt nur ohne `meetingId`-Filter. Ein neuer Absatz
   „`meetingId` filter“ nennt die Filtersemantik: ein Leser mit `event.read` bekommt jedes Ereignis des Jahrgangs
   nach dem Cursor genau einmal und aufsteigend, lückenlos innerhalb des Jahrgangs; jeder andere Leser nur
   `change`-Nachrichten zu Ereignissen dieses Jahrgangs (R-PERM-04); `id` = globale `seq`; keine Ereignisse ohne Jahrgang unter Filter,
   auch nicht bei `event.read`; Kopf über die `cursor`-Nachricht (nach dem Nachholen und mit dem Heartbeat); die Grenze 1000 zählt `(cursor, head]` global.
2. **`streamEvents`, Abschnitt „Limits“:** `Retry-After` ist 30 bei jedem 503 `StreamUnavailable` und beim 429 für
   zu viele offene Ströme; eine `end`-Nachricht (auch `unavailable`) trägt keinen `Retry-After`; danach gilt der SSE-`retry`-Wert (3000 ms) oder das eigene Backoff des Clients.
3. **`RetryAfter`-Kopf:** der Wert 30 auf `/stream` für alle drei 503-Ursachen und die stromeigenen 429; ein 429 aus
   einer Lesequote behält die Fensterregel; ein offener Strom sendet den Kopf nie.
4. **Version 0.3.12** nach ADR 0015 (Patch-Stufe, siehe „Versionsentscheidung“), mit CHANGELOG-Abschnitt, regenerierten
   Typen und den beiden Versionszeilen-Tests.

## Versionsentscheidung

Nur Beschreibungen ändern sich; Schema, Parameter, Antworten und Operationen bleiben gleich. ADR 0015 kennt dafür keine
eigene Stufe; eine Einzeländerung innerhalb eines Zyklus hebt die Patch-Stufe. Das Vertragstor
(`packages/contract/scripts/check.mjs`, Prüfung c) verlangt bei jeder Änderung an `openapi.yaml` gegenüber dem
Integrationszweig eine höhere Version und einen CHANGELOG-Abschnitt dazu. Also **0.3.12**. Die Beschreibungen erscheinen
als JSDoc in `packages/contract/src/types.ts`; deshalb wird regeneriert. Wie in 035a prüfen zwei Tests die Versionszeile
wörtlich und werden angehoben.

## Nicht-Ziele

- Kein Schema-, Parameter- oder Antwortwechsel. Die `MeetingIdFilter`-Beschreibung (auch von `/events` genutzt) bleibt.
- Kein Anwendungscode: `apps/api/src/**` außer den zwei Versionszeilen, `apps/web/**`, `packages/domain/**` bleiben
  unberührt. Der Dienst aus 035b gilt als richtig; dieser Takt schreibt ihn nur nach.
- Kein 500 im Strom-Vertrag (Folgeliste 035b, Eintrag 3: mit 0.4.0, Scheibe 043).
- Die Folgeliste wird hier nicht bearbeitet: ihre Einträge 1 und 2 aus 035b liegen erst nach dem Merge von PR #107 auf
  dem Integrationszweig; der Orchestrator hakt sie beim Merge dieses Takts ab.
- Kein ADR-Nachtrag: ADR 0014 (Nachtrag aus 035b) hält die Entscheidungen schon fest.

## Files allowed

- `packages/contract/openapi.yaml` (nur `info.version`, `streamEvents`-Beschreibung, `components/headers/RetryAfter`)
- `packages/contract/package.json` (nur `version`)
- `packages/contract/CHANGELOG.md` (Abschnitt 0.3.12)
- `packages/contract/src/types.ts` (nur regeneriert mit `pnpm contract:types`)
- `apps/api/src/__tests__/contract.test.ts` (nur die Versionszeile)
- `apps/api/src/__tests__/takt-019-contract.test.ts` (nur die Versionszeile)
- diese Spec

## Tests

Keine neuen Tests: Beschreibungen haben kein prüfbares Verhalten jenseits der Vertragstore. Das beschriebene Verhalten
ist in 035b getestet (`apps/api/src/__tests__/stream035.test.ts` Test 18: 429 und 503 mit `Retry-After: 30`;
`postgres-stream035.test.ts` Test 12: Migrationen offen, 503 mit 30; die Filtertests derselben Datei). Geändert werden
nur die zwei Versionszeilen (`toBe('0.3.12')`). Das Vertragstor (a) Version = Paketversion, (b) CHANGELOG-Abschnitt,
(c) Anhebung gegenüber dem Integrationszweig, und Redocly-Lint laufen in `pnpm gates`.

## Akzeptanzkriterium

1. `openapi.yaml` enthält unter `streamEvents` den Zusatz „without a `meetingId` filter“ vor „gap-free in `seq`“ und den Absatz
   „**`meetingId` filter.**“ mit allen fünf Punkten aus Ziel 1; der Abschnitt „Limits“ nennt 30 und „An `end` message …
   carries no `Retry-After`“.
2. `components/headers/RetryAfter` nennt 30 auf `/stream` für alle drei 503-Ursachen und die stromeigenen 429.
3. `info.version` und `packages/contract/package.json` sind 0.3.12; CHANGELOG hat `## [0.3.12] - 2026-09-30`.
4. `git diff` gegen den Integrationszweig zeigt keine Änderung an Schemas, Parametern oder Antwortcodes (nur
   `description`-Text und Version).
5. `pnpm gates` mit Postgres-Variablen ist grün, einschließlich slice-scope; der Schluss steht unter „Bericht“.

## Wirkung und Risiko (Leitplanken §4, mittel)

- **Warum mittel, nicht niedrig:** Leitplanken §4 schließt jede Vertragsänderung von „niedrig“ aus. Der Wortlaut ist die
  Zusage an Clients (036b, Partner nach ADR 0008); er verengt „gap-free“ auf den ungefilterten Strom. Kein Hoch-Auslöser:
  keine Rechte, kein Personenbezug, keine Persistenz, kein Verhalten.
- **Kompatibilität:** Kein Client hängt am alten Wortlaut; `/stream` wird erst seit 035b bedient, der Web-Client (036b)
  ist nicht gebaut. Kein Client wird ungültig; einer, der unter Filter „lückenlos“ prüfte, wäre am Dienst 035b ohnehin
  gescheitert.
- **Risiko:** Wortlaut und Dienst driften. Gegenmittel: jede Aussage ist an einer Stelle in 035b belegt (Bauklärung 1
  und 2, `route.ts`, Tests 12 und 18); der Review prüft Satz gegen Code.
- **Doku- und Betriebswirkung:** keine Betriebsänderung; Runbooks nennen den Strom-`Retry-After` nicht.

## Bericht

```
Slice: takt-040-strom-vertragswortlaut
Done: streamEvents-Beschreibung (gap-free nur ohne Filter, Absatz zum meetingId-Filter, Retry-After 30 und kein
      Retry-After auf end) und RetryAfter-Kopf (30 auf /stream) an den Dienst 035b angeglichen; Vertrag 0.3.12 mit
      CHANGELOG, regenerierten Typen und den zwei Versionszeilen-Tests.
Evidence: siehe unten (pnpm gates auf 78ebb06, nach der Überarbeitung aus dem Review)
Open: Folgeliste 035b Einträge 1 und 2 abhaken, sobald PR #107 und dieser Takt gemergt sind (Orchestrator).
Touched: packages/contract/openapi.yaml, packages/contract/package.json, packages/contract/CHANGELOG.md,
         packages/contract/src/types.ts, apps/api/src/__tests__/contract.test.ts,
         apps/api/src/__tests__/takt-019-contract.test.ts, docs/slices/takt-040-strom-vertragswortlaut.md
```

**Überarbeitung nach Review (frischer Kontext, kein Blocker, kein Major), Commit `78ebb06`:** Befunde 1–4 behoben
(Leserbezug im Filterabsatz, `end` ohne `Retry-After` mit SSE-`retry` oder eigenem Backoff, „always“ gestrichen,
`cursor` auch nach dem Nachholen), in `openapi.yaml`, CHANGELOG 0.3.12 und Ziel dieser Spec. Version bleibt 0.3.12;
`pnpm contract:types` ändert nur JSDoc-Kommentare. Befund 5 (Nit, `StreamUnavailable` „both causes“) liegt außerhalb
von Files allowed und geht auf die Folgeliste (Orchestrator).

**`pnpm gates`** auf `78ebb06` (sauberer Baum, mit den Postgres-Variablen `TEST_DATABASE_URL`,
`TEST_RUNTIME_DATABASE_URL`, `HV_DB_RUNTIME_ROLE`, Datenbank `hv_t033`), Exit 0. Ausschnitt, wörtlich:

```
packages/contract test: contract gate: packages/contract/openapi.yaml (info.version 0.3.12, 66 operations)
packages/contract test:   ok    (a) info.version 0.3.12 = package.json version
packages/contract test:   ok    (b) CHANGELOG.md has a section for 0.3.12
packages/contract test:   ok    (c) openapi.yaml changed against merge base 2e708e1; version 0.3.11 -> 0.3.12
packages/contract test:   ok    (d) allowlist.json well-formed, 7 pre-declared operation(s), none expired (today 2026-09-30)
packages/contract test: contract gate: ok
packages/domain test:       Tests  261 passed (261)
apps/web test:       Tests  374 passed (374)
apps/api test:  Test Files  37 passed (37)
apps/api test:       Tests  524 passed (524)
slice-scope: 7 changed file(s), all within "docs/slices/takt-040-strom-vertragswortlaut.md"'s "Files allowed" list (11 pattern(s)).
```

Schluss, wörtlich:

```
✓ built in 2.11s
mark-test-run: wrote /home/user/wt/t040/.claude/state/last-test-run (clean tree) at commit 78ebb06, tree 9f63d1b543ba…
```

Der erste Lauf auf `d618177` (vor dem Review) war ebenfalls grün. Dieser Berichtsnachtrag ist ein reiner Doku-Commit
(R2: kein neuer lokaler Lauf nötig).

## Review findings
