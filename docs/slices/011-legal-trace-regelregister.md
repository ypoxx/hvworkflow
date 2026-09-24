# 011 — Legal-Trace-Feld und Regelregister

**Status:** spec (nachgeschärft nach der Fable-Prüfung vom 23.09.2026: 1 Blocker, 1 major, 4 minor eingearbeitet;
Nachprüfung: freigegeben, 1 minor eingearbeitet)
**Risikoklasse:** mittel · 1,5 AStd · Kalender 07.10.2026 (W2) · Lanes: core (seriell; startet nach dem Merge von 010,
das `permissions.ts`, `api.ts` und die Wahrheitstabelle ändert), service (nur ein Test unter `apps/api`)
**Rolle/Modell:** Implementierer-Backend · Sonnet 5; Review Opus 5.5 mit Perspektive Legal
**Rule ids:** AGENTS.md Regeln 1, 2, 5, 7, 8, 12; Leitplanken 11 (nichts entscheiden, was Recht gehört; ein Zitat wird
nie als geprüft ausgegeben)
**Quellen-IDs:** Plan 5.2 Scheibe 011; Register E15 (Rechtsprüfung der Normzitate, Regelregister); Audit A3
(`x-legal-notice` behauptet Normverweise, die es nicht gibt); Entwicklungsplan 5 Zeile „Regeltabellen-Tests (mit Legal
Trace)" (`geplant in Scheibe 011`); ADR 0012 (Vorabzug an Recht nach 011)
**Depends on:** 010 (gemergt vor Start)
**Perspektive:** Legal, Architektur · **Glossar: neue Begriffe:** nein

## Festlegungen des Architekten

1. **Wo `legalRef` lebt.** `Transition` und `Guard` in `packages/domain/src/transitions.ts` bekommen ein Pflichtfeld
   `legalRef`. Regel-IDs außerhalb dieser Tabelle (nach 010: `R-TRANS-00`, `R-PERM-01`, `R-PERM-02`, `R-PERM-03`, `R-IDEM-01`) stehen
   in einer kleinen Datentabelle `packages/domain/src/rules.ts` (neu), die auch den Typ `LegalRef` und eine Funktion
   `ruleRegister()` exportiert: alle Regel-IDs mit Art (Übergang, Guard, Recht, Idempotenz), Beschreibung und
   `legalRef`, sortiert nach ID. Guard-IDs sammelt `ruleRegister()` durch Durchlaufen von `TRANSITIONS[].guards`
   (ohne Doppelte), nicht aus einer zweiten Liste.
2. **Form von `legalRef`:** `{ source, citation, docVersion, docHash, verified: false }`.
   - `source` ist ein Wert aus einer festen Liste: `'AktG' | 'Satzung' | 'Geschäftsordnung' | 'Recherche' |
     'Rechtekonzept' | 'Prozess' | 'Leitplanken'`. `'Recherche'` und `'Rechtekonzept'` nennen die Dokumente, die eine
     Regel tatsächlich tragen (z. B. Vier-Augen: `docs/anforderungen-recherche.md` und Rechtekonzept Abschnitt 4).
     Voraussichtlich trägt in dieser Scheibe keine Regel ein AktG-Zitat; die Recherche verbindet § 131 Abs. 3 AktG nur
     mit der Verweigerung (044).
   - `citation` nennt eine Norm **nur**, wenn `docs/anforderungen-recherche.md` oder
     `docs/ist-analyse-und-schnittstellen.md` diese Norm ausdrücklich mit dem Gegenstand der Regel verbindet (Fundstelle
     mit Datei und Zeile im Bericht). Sonst ist `source: 'Prozess'` oder `'Leitplanken'`, und `citation` nennt das
     Dokument und den Abschnitt, in dem die Regel beschrieben ist. Kein Zitat wird erfunden oder aus dem Gedächtnis
     ergänzt.
   - `docVersion` ist der Stand des zitierten Dokuments, soweit das Dokument ihn nennt, sonst `null`. `docHash` ist
     `null`; beides setzt die Rechtsprüfung (076).
   - `verified` ist als Literaltyp `false` festgelegt. Eine Prüfung durch Recht ändert den Typ in 076, nicht vorher.
3. **Generierung wie die Wahrheitstabelle.** `docs/legal-trace.md` entsteht über `toMatchFileSnapshot` aus einem Test
   in `packages/domain`, so wie heute `policy-truth-table.md`. Die Domäne importiert kein Node-Kernmodul, auch nicht
   in Tests: Das Tor `arch` (Regel `domain-no-node-core-modules`) gilt für `packages/domain/src` einschließlich
   `__tests__` und wird nicht aufgeweicht. Der Test, der Quelldateien nach Regel-IDs durchsucht und dafür Dateien
   lesen muss, liegt deshalb in `apps/api/src/__tests__/rule-register.test.ts` (neu). Er importiert
   `ruleRegister()` aus `@hv/domain` und liest mit `node:fs` die Quellen beider Pakete.
4. **`x-legal-notice` in `openapi.yaml` berichtigt 023**, nicht diese Scheibe. Grund: jede Änderung an `openapi.yaml`
   ist eine Vertragsversion und gehört in die serielle Lane contract; 023 läuft parallel. Der Bericht nennt den
   Wortlaut, den 011 dafür vorschlägt.

## Ziel

1. `legalRef` an jeder Zeile der Übergangstabelle und an jedem Guard; `rules.ts` für die übrigen Regel-IDs
   (Festlegungen 1 und 2).
2. **Test „jede Regel-ID hat legalRef und mindestens einen Test"**, verteilt auf zwei Dateien (Festlegung 3):
   - `packages/domain/src/__tests__/rules.test.ts` (neu, ohne Dateizugriff): Jede Register-ID hat `legalRef`, keine
     ist `verified`, keine ID doppelt; dazu der Snapshot von `docs/legal-trace.md`.
   - `apps/api/src/__tests__/rule-register.test.ts` (neu, mit Dateizugriff): Er sammelt jede Regel-ID der Form
     `\bR-[A-Z]+-\d{2,}\b`, die in `packages/domain/src/**/*.ts` oder `apps/api/src/**/*.ts` (ohne Tests) vorkommt.
     Jede davon muss im Register stehen.
   - **„Hat einen Test"** heißt: Die ID steht wörtlich in einer Testdatei unter `packages/domain/src/__tests__/` oder
     `apps/api/src/__tests__/`, oder sie ist eine Zeile von `TRANSITIONS` (dafür erzeugt `transitions.test.ts` je
     Zeile einen Test), oder sie ist ein Guard mit eigenem erzeugtem Test. Dafür bekommt `transitions.test.ts` je
     Guard (aus `TRANSITIONS[].guards`, ohne Doppelte) einen erzeugten `it()`, der den Guard einmal erfüllt und einmal
     verletzt prüft.
   - Der Test unter `apps/api` gibt aus: „N Regel-IDs, N legalRef, 0 verified". N ist die gezählte Zahl, erwartet nach 010: 22 (die 20 aus
     Plan-Stand 23.09. plus `R-PERM-02` und `R-PERM-03` aus 010). Die Zahl steht nicht fest im Test, der Test vergleicht Mengen.
   - Ein roter Lauf, lokal und nicht committet: eine Regel-ID ohne Registereintrag.
3. `docs/legal-trace.md` generiert: eine Tabelle Regel-ID · Art · Beschreibung · Quelle · Fundstelle · Stand ·
   geprüft. Kopfzeile: „Generiert aus packages/domain; kein Eintrag ist durch Recht geprüft (E15)".
4. **Ehrliche Zählung:** jede Stelle in `docs/` und `README.md`, die eine Zahl von Regel-IDs oder Regeln nennt, wird
   gesucht und im Bericht aufgelistet. Die Stellen in den erlaubten Dateien werden auf die gezählte Zahl berichtigt oder
   auf `docs/legal-trace.md` verwiesen. Stellen in anderen Dateien werden nur gemeldet, nicht geändert.
5. Entwicklungsplan Abschnitt 5, Zeile „Regeltabellen-Tests (mit Legal Trace)": Stand von `geplant in Scheibe 011`
   auf `läuft (CI: …)`, mit dem tatsächlichen Namen des CI-Schritts, in dem `pnpm -r test` läuft. Das Tor
   `plan-honesty` bleibt grün.

## Nicht-Ziele

- Keine Änderung an Übergängen, Guards, Rechten oder Statuslogik. Die Wahrheitstabelle bleibt byte-gleich.
- Keine Änderung an `openapi.yaml` (023). Keine Verweigerungsgründe (044). Kein Rechtsinhalt über das hinaus, was die
  zwei Recherche-Dokumente ausdrücklich sagen.
- Keine Anzeige „ungeprüft" in der Oberfläche; die kommt mit der ersten Oberfläche, die eine Regel zeigt.

## Files allowed

- `packages/domain/src/transitions.ts`, `packages/domain/src/rules.ts` (neu), `packages/domain/src/index.ts` (Export)
- `packages/domain/src/__tests__/rules.test.ts` (neu), `packages/domain/src/__tests__/transitions.test.ts` (erzeugte
  Tests je Guard; sonst nur, falls ein Test eine Regel-ID noch nicht nennt)
- `apps/api/src/__tests__/rule-register.test.ts` (neu)
- `docs/legal-trace.md` (neu, generiert)
- `docs/agentische-entwicklung-plan.md` (Abschnitt 5, nur die Stand-Spalte der Zeile „Regeltabellen-Tests")
- diese Datei (`docs/slices/011-legal-trace-regelregister.md`, Bericht)

## Akzeptanzkriterium

1. Testausgabe „N Regel-IDs, N legalRef, 0 verified" im Bericht, dazu der rote Lauf.
2. `git diff --exit-code -- packages/domain/policy-truth-table.md` ist leer.
3. Fundstellentabelle im Bericht: je Regel-ID `source` und `citation`, und für jede Norm die Zeile aus der Recherche,
   die sie stützt.
4. `pnpm gates` grün, einschließlich `arch` (ohne Änderung an `scripts/dependency-cruiser.cjs`), `plan-honesty` und
   `now-check`. CI grün.

## Nachweise

`pnpm gates`-Ende; Testausgabe; Fundstellentabelle; Liste der Zahl-Nennungen aus Ziel 4; Vorschlag für den Wortlaut von
`x-legal-notice`.

## Arbeitsweise

- Worktree `/home/user/wt/011`, Branch `claude/slice-011-legal-trace`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]`. Nicht pushen.
- Nach dem Merge geht ein Vorabzug von `docs/legal-trace.md` mit ADR 0012 über den Eigentümer an Recht (E15). Das
  übernimmt der Orchestrator im Tagesbericht.

## Bericht

(vom Implementierer)

## Review findings

(vom Reviewer)
