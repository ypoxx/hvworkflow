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
5. **Nachgeschärft nach der Legal-Nachprüfung (24.09.2026):** Ein Zitat enthält nur Quelle, Lücke und Ableitung,
   keine Änderungsgeschichte (sie steht im Bericht). Wörter wie „Review“ oder „geprüft“ kommen in `legalRef` und in
   den Beschreibungen nicht vor, weil Recht sie als eigene Prüfung lesen würde (E15, Leitplanken 11). Fordert die
   zitierte Stelle mehr, als die Regel tut, steht „teilweise“ oder „nicht umgesetzt“ mit dem fehlenden Teil dabei.
6. **Nachgeschärft nach dem vierten Codex-Lauf (24.09.2026): jede Wirkung einer Regel ist belegt oder als unbelegt
   benannt.** Eine Regel hat oft mehr als eine Wirkung: der Stand wechselt, Felder werden festgehalten (z. B.
   Tagesordnungspunkt und Bühnenzuordnung bei R-TRANS-01), Folgen treten ein (z. B. eine Freigabe erlischt bei
   R-TRANS-03). Für jede der 22 Regeln listet der Bericht ihre Wirkungen aus dem Code (Übergangszeile, `build()` in
   `api.ts`, Guards) und nennt je Wirkung die Fundstelle oder „nicht belegt“. Das Zitat in `legalRef` deckt jede
   Wirkung ab oder sagt, welche Wirkung ohne Beleg ist. Verhalten und Rechte ändern sich nicht.

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

Slice: 011-legal-trace-regelregister
Done:
- `legalRef` (Festlegung 2: `{ source, citation, docVersion, docHash: null, verified: false }`) an jeder Zeile von
  `TRANSITIONS` und an jedem der fünf Guards (`packages/domain/src/transitions.ts`); `packages/domain/src/rules.ts`
  (neu) exportiert `LegalRef`, `LegalSource`, `RuleEntry` und `ruleRegister()` (sammelt Guard-IDs durch Durchlaufen
  von `TRANSITIONS[].guards`, ohne Doppelte, plus die fünf Regel-IDs außerhalb der Tabelle: `R-TRANS-00`,
  `R-PERM-01..03`, `R-IDEM-01`). Kein Übergang, kein Guard und keine Statuslogik geändert — die Wahrheitstabelle
  bleibt byte-gleich (Akzeptanz 2, s. u.).
- Test „jede Regel-ID hat legalRef und mindestens einen Test", auf zwei Dateien verteilt (Festlegung 3):
  `packages/domain/src/__tests__/rules.test.ts` (ohne Dateizugriff: legalRef/Duplikat/verified-Prüfung, Schnappschuss
  `docs/legal-trace.md`) und `apps/api/src/__tests__/rule-register.test.ts` (mit `node:fs`: sammelt jede Regel-ID aus
  `packages/domain/src/**/*.ts` und `apps/api/src/**/*.ts`, ohne Tests, gegen `ruleRegister()`; druckt die
  Zählzeile). `transitions.test.ts` bekam zusätzlich einen generierten `it()` je Guard (Positiv- und Negativfall).
- `docs/legal-trace.md` generiert (22 Zeilen, Kopf „Generiert aus packages/domain; kein Eintrag ist durch Recht
  geprüft (E15)"); Ziel-4-Zählung durchgeführt (drei veraltete Zahl-Nennungen gefunden, alle außerhalb der erlaubten
  Dateien, nur gemeldet); Plan-Stand „Regeltabellen-Tests (mit Legal Trace)" auf `läuft (CI: …)` gestellt;
  `x-legal-notice`-Wortlaut für 023 vorgeschlagen (nicht angewendet — `openapi.yaml` ist nicht in „Files allowed").

### 1. Testausgabe und roter Lauf

Grüner Lauf (`apps/api`, `--reporter=verbose`, isoliert):

```
stdout | src/__tests__/rule-register.test.ts > rule register > prints the honest count
22 Regel-IDs, 22 legalRef, 0 verified

 ✓ src/__tests__/rule-register.test.ts > rule register > every rule id used in production code has a register entry 2ms
 ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has a legalRef 0ms
 ✓ src/__tests__/rule-register.test.ts > rule register > no register entry is verified 0ms
 ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has at least one test (transition row, guard, or literal rule id in a test file) 0ms
 ✓ src/__tests__/rule-register.test.ts > rule register > prints the honest count 2ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Roter Lauf, lokal erzeugt und **nicht committet** (`R-IDEM-01` vorübergehend aus `rules.ts` entfernt, obwohl es in
`packages/domain/src/api.ts:301` als Regel-ID vorkommt; danach zurückgesetzt, s. `git diff` unten war leer):

```
stdout | src/__tests__/rule-register.test.ts > rule register > prints the honest count
21 Regel-IDs, 21 legalRef, 0 verified

 × src/__tests__/rule-register.test.ts > rule register > every rule id used in production code has a register entry 8ms
   → rule id(s) used in code without a ruleRegister() entry: R-IDEM-01: expected [ 'R-IDEM-01' ] to deeply equal []
 ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has a legalRef 1ms
 ✓ src/__tests__/rule-register.test.ts > rule register > no register entry is verified 0ms
 ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has at least one test (transition row, guard, or literal rule id in a test file) 0ms
 ✓ src/__tests__/rule-register.test.ts > rule register > prints the honest count 1ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```

`git status` after the revert showed the file byte-identical to the committed version (`git diff` empty) before the
next commit was made.

### 2. Fundstellentabelle (Akzeptanz 3)

Kein Regel-Eintrag in dieser Scheibe trägt eine Norm (§ 131 Abs. 3 AktG bindet die Recherche ausdrücklich nur an die
Verweigerung, außerhalb dieser Scheibe — Festlegung 1); die Spalte „Recherche-Zeile für die Norm" bleibt deshalb für
jede Zeile leer/entfällt. `source`/`citation` je Regel-ID, mit Dateizeile:

Stand nach der Nacharbeit (Abschnitt 7); mehrere Zeilen tragen jetzt eine Quelle, eine Lücke oder eine Ableitung
explizit im Wortlaut, statt sie zu verschweigen oder eine Anforderung als erfüllt zu unterstellen, die die Regel
nicht umsetzt:

| Regel-ID | Art | Quelle | Fundstelle | Anmerkung |
|---|---|---|---|---|
| R-TRANS-00 | Übergang | Leitplanken | `docs/qualitaetsleitplanken-produktreife.md:175` (Prüfpunkt 6.4: 409 u. a. konsistent mit Regel-ID) | stützt nur das Antwortformat; Terminalität selbst ohne Fundstelle in Recherche/Ist-Analyse (Architekturentscheidung) |
| R-TRANS-01 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:42-43` (P3: „Frage klassifizieren → Zuordnung zu Pfad A, B oder C") | teilweise für `agendaItemId` (Recherche:62): optional, keine Mehrfachzuordnung, Umhängen ohne Vermerk (Abschnitt 10) |
| R-TRANS-02 | Übergang | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:107` (2.4: `classified → expert_answering`, Pflichtfeld „Segment") | offene Lücke: Recherche:221 fordert Personenzuweisung, Regel weist nur eine Einheit zu |
| R-TRANS-03 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:52` (Pfad C: „6 fachliche Beantwortung") | teilweise: Quelle optional statt Pflichtfeld (Rechtekonzept:108, Recherche:101; Abschnitt 10) |
| R-TRANS-04 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:52` (Pfad C: „7 Legal Clearing"; „ja, eigener Schritt") | — |
| R-TRANS-05 | Übergang | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:109` (2.4: `legal_clearing → ready_for_stage`, Pflichtfelder Freigabevermerk, Vier-Augen) | nicht umgesetzt: Freigabevermerk, Ersteller ≠ Freigeber (§4, Zeile 156); keine Verhaltensänderung in dieser Scheibe |
| R-TRANS-06 | Übergang | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:110` (2.4: `legal_clearing → expert_answering`, Pflichtfeld „Rückgabegrund") | ergänzend ist-analyse:90 („Antwort zurückgeben") |
| R-TRANS-07 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:92` („nur die zugeordneten und freigegebenen Fragen") | `stagePosition` nicht belegt (Architekturentscheidung: globale Warteschlange); ist:87 nennt eine andere Sortierung |
| R-TRANS-08 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:50` (Pfad A No-Brainer: freie Beantwortung durch den Vorstand) | `stagePosition` wie R-TRANS-07 |
| R-TRANS-09 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:89` („vorgelesen, weiter") | `answerVersion`: Recherche:103 (Soll-Ist-Abgleich), der Abgleich selbst nicht umgesetzt |
| R-TRANS-10 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:58-59` (Antwortprüfung Legal → „Ja: Frage beantwortet") | eigener Abschluss-Schritt, getrennt von R-TRANS-09 |
| R-TRANS-11 | Übergang | Recherche | `docs/anforderungen-recherche.md:285` (Zähldefinition: „zurückgezogene" als Zählkategorie) | Übergang selbst ohne Fundstelle; Ableitung: NICHT dasselbe wie „Kein Auskunftsanspruch" (Recherche:24) |
| R-TRANS-12 | Übergang | Recherche | `docs/anforderungen-recherche.md:147` („Dublettenerkennung …") | teilweise: `merged` ist terminal, kein Unmerge, kein Ähnlichkeitsscore, Ziel ohne Standprüfung (Abschnitt 10) |
| R-GUARD-01 | Guard | Prozess | `docs/ist-analyse-und-schnittstellen.md:52` (erst Beantwortung, dann Legal Clearing) | Ableitung: Prüfung setzt Antwort voraus |
| R-GUARD-02 | Guard | Prozess | `docs/ist-analyse-und-schnittstellen.md:50` (Pfad A: freie Beantwortung ohne Text) | — |
| R-GUARD-03 | Guard | Prozess | `docs/ist-analyse-und-schnittstellen.md:51-52` (Pfade B/C: Antwort über Publikation bzw. fachliche Beantwortung) | Ableitung: beide mit Text |
| R-GUARD-04 | Guard | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:163` (4: „Keine Freigabe ohne Bindung an die Textversion …") | — |
| R-GUARD-05 | Guard | Recherche | `docs/anforderungen-recherche.md:147` (Dublettenerkennung) | Ableitung: Ziel/Quelle müssen verschieden sein; teilweise wie R-TRANS-12 |
| R-PERM-01 | Recht | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:141` (3.4 „Deny by default") | Regel-ID zugeordnet seit a0c38c4 (02.09.2026) — nicht neu in Scheibe 010 |
| R-PERM-02 | Recht | Rechtekonzept | dieselbe Fundstelle wie R-PERM-01 | ID eingeführt in Scheibe 010, Festlegung 6 (das stimmt für diese ID) |
| R-PERM-03 | Recht | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:93` (2.3 Kontextattribut „Bühnenzuordnung") | Ableitung: gleiche Art Sichtbarkeitsbeschränkung wie „Leseumfang"; ID eingeführt Scheibe 010 Festlegung 2 |
| R-IDEM-01 | Idempotenz | Leitplanken | `docs/qualitaetsleitplanken-produktreife.md:167` (Prüfpunkt 6.3: „Wiederholungen sind idempotent je Akteur und Operation") | Prüfpunkt, kein Regel-Charakter (Leitplanken:8-9) |

Korrektur zu Punkt 6 der Legal-Review: Die vorherige Fassung dieses Berichts behauptete „R-TRANS-11 ist die einzige
Zeile ohne wörtlichen Beleg in den beiden Recherche-Dokumenten". Das war falsch — neun der 22 Zeilen zitieren als
Quelle weder `docs/anforderungen-recherche.md` noch `docs/ist-analyse-und-schnittstellen.md`, sondern Rechtekonzept
oder Leitplanken, und zwar bewusst, weil dort die genauere oder einzige echte Fundstelle liegt: R-TRANS-00
(Leitplanken), R-TRANS-02, R-TRANS-05, R-TRANS-06 (Rechtekonzept), R-GUARD-04 (Rechtekonzept), R-PERM-01, R-PERM-02,
R-PERM-03 (Rechtekonzept), R-IDEM-01 (Leitplanken). Das ist kein Fehler, sondern Festlegung 2: „Prozess"/„Leitplanken"
bzw. Rechtekonzept sind die richtige `source`, sobald keines der beiden Recherche-Dokumente die Regel selbst
beschreibt. Einzig R-TRANS-11 hat eine Sonderrolle: es zitiert zwar `docs/anforderungen-recherche.md:285`
(`source: 'Recherche'`), aber die Zeile deckt nur eine benachbarte Zählkategorie ab, nicht den Übergang selbst — das
ist im Text der Zeile selbst ausdrücklich gesagt, nicht verschwiegen.

### 3. Wo jede der 22 Regel-IDs getestet ist

| Regel-ID | Test |
|---|---|
| R-TRANS-01..05, 07, 09..12 | generierter Zeilentest in `transitions.test.ts` (`for (const t of TRANSITIONS) it(...)`) |
| R-TRANS-06 | zusätzlich eigener Test `R-TRANS-06: a returned podium question …` (`transitions.test.ts`) |
| R-TRANS-00 | wörtlich in `transitions.test.ts`, `packages/domain/src/__tests__/api.test.ts`, `apps/api/src/__tests__/negative.test.ts` |
| R-TRANS-08 | generierter Zeilentest **und** wörtlich in `transitions.test.ts` |
| R-GUARD-01..03, 05 | neuer generierter Guard-Test in `transitions.test.ts` (`describe('guards …')`) |
| R-GUARD-04 | generierter Guard-Test **und** eigener Test `R-GUARD-04: approval must name the latest answer version`, plus wörtlich in `api.test.ts` und `apps/api/src/__tests__/acceptance.test.ts` |
| R-PERM-01 | wörtlich in `api.test.ts`, `transitions.test.ts`, `apps/api/src/__tests__/read-rights.test.ts`, `negative.test.ts` |
| R-PERM-02 | wörtlich in `api.test.ts`, `transitions.test.ts`, `read-rights.test.ts` |
| R-PERM-03 | wörtlich in `api.test.ts`, `read-rights.test.ts` |
| R-IDEM-01 | wörtlich in `api.test.ts`, `negative.test.ts` |

Jede der 22 IDs erfüllt mindestens einen der drei Wege aus Festlegung 3; `rule-register.test.ts`s Test „every
register entry has at least one test" prüft das automatisch gegen `TRANSITIONS`, die Guard-Liste und einen
Volltextscan aller `*.test.ts`-Dateien unter beiden `__tests__`-Verzeichnissen.

### 4. Ehrliche Zählung (Ziel 4)

Gesucht wurde nach jeder Zahlangabe zu Regel-IDs/Regeln in `docs/` und `README.md`. Fundstellen:

| Datei:Zeile | Wortlaut | Befund |
|---|---|---|
| `docs/produktplan-beta.md:5` | „ereignisbasierter Kern mit 20 Regel-IDs (R-TRANS-00..12, R-GUARD-01..05, R-PERM-01, R-IDEM-01)" | veraltet (nach 010 fehlen `R-PERM-02`/`R-PERM-03`; die richtige Zahl ist 22) |
| `docs/produktplan-beta.md:367` | „Test … (20 IDs heute, …); Regelregister zählt ehrlich (20, nicht 24)" | veraltet, gleicher Grund |
| `docs/produktplan-beta.md:370` | „Testausgabe „20 Regel-IDs, 20 legalRef, 0 verified"" | veraltet, gleicher Grund |

Alle drei Stellen liegen in `docs/produktplan-beta.md`, das **nicht** in „Files allowed" dieser Scheibe steht — sie
werden hier nur gemeldet, nicht geändert (Ziel 4, letzter Satz). Innerhalb der erlaubten Dateien nennt keine Stelle
eine Zahl von Regel-IDs; `docs/legal-trace.md` selbst zählt nicht in Prosa, sondern zeigt die 22 Zeilen. Das
AGENTS.md-Vorwort „zwölf Regeln" bezieht sich auf die AGENTS.md-Regeln R1–R12, nicht auf Regel-IDs, und ist keine
falsche Zählung.

### 5. Vorschlag für `x-legal-notice` (für 023, hier nicht angewendet)

Heutiger Text (`packages/contract/openapi.yaml:27-29`) behauptet Normverweise im Plural, die es nicht gibt (Audit
A3). Vorschlag:

```yaml
x-legal-notice: >
  Rule ids referenced in error responses (`ruleId`) trace to the rule register
  (`packages/domain/src/rules.ts`, generated as `docs/legal-trace.md`). Each entry names a source and
  a citation; a citation names a statute only where the requirements research names that statute
  explicitly for the rule's subject. No entry is marked verified until the legal department has
  reviewed it (E15) — today none is, and none currently cites a statute (§ 131 Abs. 3 AktG is tied
  only to the refusal path, out of scope until slice 044).
```

### 6. Nachweise

`pnpm gates` (Ende, verbatim):

```
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> hvworkflow@0.1.0 i18n-literals /home/user/wt/011
> node scripts/i18n-literal-check.mjs

i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.

> hvworkflow@0.1.0 slice-scope /home/user/wt/011
> node scripts/slice-scope.mjs

slice-scope: 9 changed file(s), all within "docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).

> hvworkflow@0.1.0 downgrade-check /home/user/wt/011
> node scripts/downgrade-check.mjs

Downgrade check: 14 spec(s) with a number 009-099, no unauthorised risk-class downgrade against docs/produktplan-beta.md.

> hvworkflow@0.1.0 plan-graph /home/user/wt/011
> node scripts/plan-graph.mjs

plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
...
> @hv/web@0.0.0 build /home/user/wt/011/apps/web
> tsc -b && vite build
...
✓ built in 1.26s
mark-test-run: wrote /home/user/wt/011/.claude/state/last-test-run (clean tree) at commit 80de4c2, tree 77b30001eec8…
```

`node scripts/slice-scope.mjs` (separate run, Aufgabenstellung): `slice-scope: 9 changed file(s), all within
"docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).`

`git diff --exit-code -- packages/domain/policy-truth-table.md`: leer (Akzeptanz 2, verifiziert vor und nach jedem
Commit).

### 7. Nacharbeit nach Legal-Review und Codex

Eine Nacharbeitsrunde: Opus-Legal-Review (Vorabzug an Recht, E15) fand 1 major-Baustein mit vier Unterpunkten plus
mehrere minor-Befunde und Nits; Codex fand ein P2 auf PR #24. Alle Befunde 1–8 aus der Rückmeldung sind behoben:

1. R-TRANS-11: `source: 'Recherche'`, zitiert jetzt `:285` (Zähldefinition, „zurückgezogene" als Zählkategorie);
   Analogie zu `ist-analyse.md:44` entfernt (war eine Rechtsbewertung); Ableitung ausdrücklich als NICHT dasselbe
   wie „Kein Auskunftsanspruch" (`Recherche:24`) markiert.
2. Ehrliche Lücken/Teilweise-Kennzeichnung ergänzt bei R-TRANS-02 (Rechtekonzept:107 statt Recherche:221, Lücke
   benannt), R-TRANS-12/R-GUARD-05 („teilweise: nicht reversibel, kein Ähnlichkeitsscore"), R-TRANS-05 („nicht
   umgesetzt: Freigabevermerk, Ersteller ≠ Freigeber", ohne Verhaltens- oder Rechteänderung).
3. Falsche Fundstellen korrigiert: R-PERM-03 → `rollen:93`; R-TRANS-07 → `ist:92`; R-TRANS-06 → `rollen:110`;
   R-TRANS-00 benennt jetzt ausdrücklich, dass `Leitplanken:175` nur das 409-Format stützt, nicht die Terminalität.
4. R-PERM-01: „zugeordnet (Schreibrecht fehlt) seit a0c38c4 (02.09.2026)" statt der falschen Behauptung, die
   Regel-ID sei in Scheibe 010 eingeführt worden (das stimmt nur für R-PERM-02/R-PERM-03).
5. `apps/api/src/__tests__/rule-register.test.ts`: `rules.ts` aus dem Scan ausgeschlossen; neuer Test prüft beide
   Richtungen (Code → Register **und** Register → Code). Roter Lauf mit einer verwaisten `OTHER_RULES`-Zeile
   (`R-STALE-01`, danach zurückgesetzt — `git diff` war leer):

   ```
    ✓ src/__tests__/rule-register.test.ts > rule register > every rule id used in production code has a register entry 2ms
    × src/__tests__/rule-register.test.ts > rule register > every register entry corresponds to a rule id actually used in production code (no stale entries, rules.ts excluded from the scan) 8ms
      → register entry(ies) with no matching production code (stale): R-STALE-01: expected [ 'R-STALE-01' ] to deeply equal []
    ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has a legalRef 0ms
    ✓ src/__tests__/rule-register.test.ts > rule register > no register entry is verified 0ms
    × src/__tests__/rule-register.test.ts > rule register > every register entry has at least one test (transition row, guard, or literal rule id in a test file) 1ms
      → rule id(s) with no test: R-STALE-01: expected [ 'R-STALE-01' ] to deeply equal []
    ✓ src/__tests__/rule-register.test.ts > rule register > prints the honest count 1ms

    Test Files  1 failed (1)
         Tests  2 failed | 4 passed (6)
   ```

   Grüner Lauf danach (isoliert, `--reporter=verbose`), mit der Zählzeile:

   ```
   stdout | src/__tests__/rule-register.test.ts > rule register > prints the honest count
   22 Regel-IDs, 22 legalRef, 0 verified

    ✓ src/__tests__/rule-register.test.ts > rule register > every rule id used in production code has a register entry 2ms
    ✓ src/__tests__/rule-register.test.ts > rule register > every register entry corresponds to a rule id actually used in production code (no stale entries, rules.ts excluded from the scan) 0ms
    ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has a legalRef 0ms
    ✓ src/__tests__/rule-register.test.ts > rule register > no register entry is verified 0ms
    ✓ src/__tests__/rule-register.test.ts > rule register > every register entry has at least one test (transition row, guard, or literal rule id in a test file) 0ms
    ✓ src/__tests__/rule-register.test.ts > rule register > prints the honest count 1ms

    Test Files  1 passed (1)
         Tests  6 passed (6)
   ```

6. Der falsche Satz „R-TRANS-11 ist die einzige Zeile ohne wörtlichen Beleg in den beiden Recherche-Dokumenten" in
   Abschnitt 2 ist ersetzt (neun Zeilen zitieren bewusst Rechtekonzept/Leitplanken statt der beiden
   Recherche-Dokumente — das ist Festlegung 2, kein Fehler).
7. Nits behoben: „Ableitung:" vor eigenen Schlussfolgerungen (R-GUARD-01/03/05); R-TRANS-00/R-IDEM-01 nennen die
   Leitplanken jetzt als „Prüfpunkt, kein Regel-Charakter" (`Leitplanken:8-9`); R-TRANS-10 zitiert `ist:58-59`
   (eigener Abschluss-Schritt); `GUARD_SCENARIOS` hat einen neuen Test gegen verwaiste Einträge
   (`transitions.test.ts`).
8. Codex P2 (`rules.ts:64`): Die R-TRANS-00-Beschreibung nennt jetzt ausdrücklich, dass `resolveTransition()`s Regel-
   ID intern ist und die API sie für eine Frage, die der Akteur nicht lesen darf, hinter einem generischen 409 ohne
   Regel-ID maskiert (Festlegung 8, Scheibe 010). Propagiert über den Schnappschuss in `docs/legal-trace.md`.

`docs/legal-trace.md` neu generiert (`toMatchFileSnapshot`, nie handbearbeitet); `policy-truth-table.md` weiterhin
byte-gleich (`git diff --exit-code` leer, erneut geprüft).

`pnpm gates`-Ende nach der Nacharbeit (verbatim):

```
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.

> hvworkflow@0.1.0 i18n-literals /home/user/wt/011
> node scripts/i18n-literal-check.mjs

i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.

> hvworkflow@0.1.0 slice-scope /home/user/wt/011
> node scripts/slice-scope.mjs

slice-scope: 9 changed file(s), all within "docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).

> hvworkflow@0.1.0 downgrade-check /home/user/wt/011
> node scripts/downgrade-check.mjs

Downgrade check: 14 spec(s) with a number 009-099, no unauthorised risk-class downgrade against docs/produktplan-beta.md.

> hvworkflow@0.1.0 plan-graph /home/user/wt/011
> node scripts/plan-graph.mjs

plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
...
> @hv/web@0.0.0 build /home/user/wt/011/apps/web
> tsc -b && vite build
...
✓ built in 1.12s
mark-test-run: wrote /home/user/wt/011/.claude/state/last-test-run (clean tree) at commit c9ff931, tree 8a1e1db14841…
```

Davor im selben Lauf: `packages/domain test: Test Files 6 passed (6), Tests 85 passed (85)`; `apps/api test: Test
Files 6 passed (6), Tests 55 passed (55)`; `apps/web test: Test Files 4 passed (4), Tests 48 passed (48)`; `arch`:
„0 errors, 7 warnings" (dieselben sieben vorbestehenden `web-features-i18n-domain-types-only`-Befunde wie vor der
Nacharbeit, unverändert durch diesen Diff). Kein FAIL/not-ok im gesamten Lauf.

`node scripts/slice-scope.mjs` (separater Lauf nach der Nacharbeit): `slice-scope: 9 changed file(s), all within
"docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).`

Open:
- `docs/produktplan-beta.md`s drei veraltete Zahl-Nennungen (Abschnitt 4 oben) sind nur gemeldet — eine Korrektur
  braucht eine eigene Scheibe oder den Orchestrator-Tagesbericht, weil die Datei nicht in „Files allowed" steht.
- `x-legal-notice` bleibt unverändert (Festlegung 4); der Wortlaut oben ist ein Vorschlag für 023.
- Der Vorabzug von `docs/legal-trace.md` mit ADR 0012 an Recht (E15) ist Sache des Orchestrator-Tagesberichts
  (Arbeitsweise), nicht dieser Scheibe.
- Die fachlichen Lücken, die die Zitate offenlegen, stehen als offene Punkte 1–8 in Abschnitt 8 (Punkte 5–8 seit
  Abschnitt 10: TOP-Zuordnung, Quelle als Pflichtfeld, Merge-Ziel ohne Standprüfung, Bühnenreihenfolge).
- Der rote Lauf für Punkt 5 (Abschnitt 7) nutzte eine temporäre `R-STALE-01`-Zeile in `rules.ts`, die vor dem
  nächsten Commit vollständig zurückgesetzt wurde (`git diff` danach leer); kein Rest davon ist committet.

Touched:
- `packages/domain/src/transitions.ts`, `packages/domain/src/rules.ts` (neu), `packages/domain/src/index.ts`
- `packages/domain/src/__tests__/rules.test.ts` (neu), `packages/domain/src/__tests__/transitions.test.ts`
- `apps/api/src/__tests__/rule-register.test.ts` (neu)
- `docs/legal-trace.md` (neu, generiert)
- `docs/agentische-entwicklung-plan.md` (nur die Stand-Spalte der Zeile „Regeltabellen-Tests (mit Legal Trace)")
- `docs/slices/011-legal-trace-regelregister.md` (dieser Bericht)

### 8. Nacharbeit des Orchestrators nach der Legal-Nachprüfung

Die eine Nacharbeitsrunde des Bauers war verbraucht; die Nachprüfung fand zwei neue Hauptbefunde, beide reine
Textstellen. Der Orchestrator hat die Spec nachgeschärft (Festlegung 5) und sie selbst behoben (nach oben
abgewichen):

- R-TRANS-10 zitiert ist:58-59 (Antwortprüfung durch Legal · FOO/GC) jetzt mit „Nicht umgesetzt: keine
  Antwortprüfung durch Legal oder FOO/GC; den Abschluss lösen die Berechtigten von `question.close` aus (heute podium
  und admin), ohne Entscheidung „Antwort ausreichend?““.
- Alle Hinweise „rework nach Legal-Review …“ sind aus `legalRef` und Beschreibungen entfernt (R-TRANS-00, -02, -05,
  -06, -07, -10, -11, -12, R-PERM-01, -03); die Änderungsgeschichte steht in Abschnitt 7 und hier.
- R-PERM-03: „Durch diese Regel nicht umgesetzt: die Bühnenzuordnung für den Vorstand selbst (Attributregel, laut
  Scheibe 010 für 047 vorgesehen)“.
- R-TRANS-00: „die Domänen-API (api.ts `transition()`, die apps/api umhüllt)“ statt „HTTP-Schicht“.
- R-PERM-01: Commit-Betreff wörtlich („Fundament fuer die erste lauffaehige Version“).
- Scan-Test: `rules.ts` wird über den vollen Pfad ausgeschlossen, nicht über den Dateinamen.
- `docs/legal-trace.md` über `vitest run -u` neu erzeugt; Wahrheitstabelle unverändert.

**Offen (weitergetragen, damit die offengelegten Lücken nicht nur Tabellenzellen bleiben):**

1. Vier-Augen „Ersteller ≠ Freigeber“ (Rechtekonzept §4, nicht konfigurierbar) — im Plan als R-GUARD-06 in
   Scheibe 021 (B6); bis dahin hält `legal` `answer.draft` und `question.approve`. Punkt für den Eigentümer.
1a. Pflichtfeld Freigabevermerk bei der Freigabe (Rechtekonzept:109) — keine Scheibe benannt (der „Freigabevermerk
   mit Datum“ in 076 ist der Vermerk von Recht zur Vorabprüfung, nicht dieses Feld); zur Einordnung.
2. Antwortprüfung „Antwort ausreichend?“ vor dem Abschluss (ist:58-59) — keine Scheibe benannt; zur Einordnung durch
   den Architekten.
3. Merge reversibel mit Ähnlichkeitsscore (Recherche:147) — keine Scheibe benannt; zur Einordnung.
4. Zuweisung an Personen statt Einheiten (Recherche:221) — keine Scheibe benannt; zur Einordnung.
5. TOP-Zuordnung (Recherche:62) — heute optional, genau ein Tagesordnungspunkt, Umhängen nur aus `captured`/
   `classified` ohne Vermerk „von … nach …", und ein erneutes Klassifizieren ohne Punkt löscht die Zuordnung. Die
   Recherche fordert ein hartes Pflichtfeld mit Mehrfachzuordnung und Umhängen mit Historie („Ohne TOP-Bezug ist
   weder die Erforderlichkeit prüfbar …"). Keine Scheibe benannt; zur Einordnung (Abschnitt 10).
6. Quelle als Pflichtfeld der Antwort (Rechtekonzept:108, Recherche:101) — `sources` ist optional; keine Scheibe
   benannt; zur Einordnung.
7. Merge-Ziel ohne Standprüfung (Recherche:147 „gilt als nicht beantwortet") — eine Frage lässt sich in eine
   zurückgezogene, zusammengeführte oder abgeschlossene Frage zusammenführen und wird dann nie beantwortet; keine
   Scheibe benannt; zur Einordnung.
8. Bühnenreihenfolge (ist:87 „nach Fragesteller und vor allem nach Bühnenzuordnung") — heute eine globale
   Warteschlange; zur Einordnung durch den Architekten.

### 9. Wirkungen je Regel (Festlegung 6)

Vierter Codex-Lauf: eine Regel-Zeile kann mehrere Wirkungen haben (Stand, Feld, Folge, Verweigerung), und
ein Zitat, das nur eine davon trägt, ist trotzdem unvollständig. Für jede der 22 Regeln steht unten jede
Wirkung aus dem Code (Übergangszeile, `build()` in `api.ts`, Guard, `can()`/`permissions.ts`) mit ihrer
Fundstelle oder „nicht belegt“. Eine Verweigerung, die als eigene Regel-ID zurückkommt (Guard, R-TRANS-00,
R-PERM-01..03), ist dort selbst aufgeführt, nicht noch einmal bei der Zeile, die sie auslöst. Ein
Protokollfeld, das nur den Wechsel selbst hält (`fromStatus`/`toStatus` bei R-TRANS-06), ist die
Ereignisprotokoll-Pflicht selbst (AGENTS.md R7, Events sind Anhänge) und deshalb nicht gesondert
aufgeführt.

| Regel-ID | Wirkung | Fundstelle oder „nicht belegt" |
|---|---|---|
| R-TRANS-01 | Stand → `classified` | `docs/ist-analyse-und-schnittstellen.md:42-43` „Frage klassifizieren → Zuordnung zu Pfad A, B oder C" |
| R-TRANS-01 | Feld `track` | dieselbe Stelle |
| R-TRANS-01 | Feld `agendaItemId` (Tagesordnungspunkt) | `docs/anforderungen-recherche.md:62` „TOP-Zuordnung als hartes Pflichtfeld, Mehrfachzuordnung erlaubt, Umhängen mit Historie" — teilweise: optional statt Pflichtfeld (`types.ts:246`, `api.ts:535` prüft nur einen genannten Punkt); keine Mehrfachzuordnung (ein einzelner Wert); Umhängen nur durch erneutes Klassifizieren aus `captured`/`classified`, jede Klassifizierung als eigenes Ereignis im Protokoll, aber ohne Vermerk „von … nach …" |
| R-TRANS-01 | Folge: erneutes Klassifizieren ohne `agendaItemId` entfernt die bestehende Zuordnung (`state.ts:195-196`) | nicht belegt; widerspricht Recherche:62 („hartes Pflichtfeld"), als Teil von „teilweise" benannt |
| R-TRANS-01 | Feld `stageAssignment` (Bühnenzuordnung) | `docs/ist-analyse-und-schnittstellen.md:80` „Bühnenzuordnung (Aufsichtsrat / Vorstand / CFO)" |
| R-TRANS-02 | Stand → `assigned`, Feld `unitId` | `docs/rollen-und-rechtekonzept.md:107` „Pflichtfeld Segment" (teilweise: Personenzuweisung aus Recherche:221 nicht umgesetzt) |
| R-TRANS-03 | Stand → `answer_drafted`, Feld Antwortversion | `docs/ist-analyse-und-schnittstellen.md:52` „6 fachliche Beantwortung" |
| R-TRANS-03 | Feld `sources` (Quelle), optional (`api.ts:566`) | teilweise: `docs/rollen-und-rechtekonzept.md:108` nennt „Antworttext, Quelle" als Pflichtfelder für `expert_answering → legal_clearing`, `docs/anforderungen-recherche.md:101` „Jede Antwort an eine belastbare Quelle mit Fundstelle gebunden"; hier ist nur der Text Pflicht, auch R-TRANS-04 verlangt keine Quelle |
| R-TRANS-03 | Folge: eine neue Version holt die Frage aus `in_review` zurück nach `answer_drafted` | nicht belegt (Ableitung: nur die jeweils letzte Version geht über R-TRANS-04 erneut in die Prüfung, R-GUARD-04) |
| R-TRANS-03 | Folge: ein bestehender Rückgabegrund entfällt (`state.ts`, `AnswerDrafted`) | nicht belegt (Ableitung: er betraf die zurückgegebene Version) |
| R-TRANS-03 | Folge: eine bestehende Freigabe erlischt (`invalidatedApprovalOfVersion`) | `docs/rollen-und-rechtekonzept.md:163` „Keine Freigabe ohne Bindung an die Textversion. Jede Textänderung nach Freigabe setzt sie zurück." |
| R-TRANS-04 | Stand → `in_review` | `docs/ist-analyse-und-schnittstellen.md:52` „7 Legal Clearing" |
| R-TRANS-04 | Feld `answerVersion` | nicht belegt (Ableitung: hält nur die zuletzt entworfene Version fest, R-TRANS-03) |
| R-TRANS-05 | Stand → `approved`, Feld `answerVersion` | `docs/rollen-und-rechtekonzept.md:109` „legal_clearing → ready_for_stage" |
| R-TRANS-05 | Pflichtfeld Freigabevermerk, Vier-Augen | nicht umgesetzt (bereits so benannt, `rollen:109`/`156`) |
| R-TRANS-06 | Stand → `classified` (Podium) / `answer_drafted` (sonst), Feld `reason` | `docs/rollen-und-rechtekonzept.md:110` „Pflichtfeld Rückgabegrund"; ergänzend `ist-analyse:90` |
| R-TRANS-06 | Verzweigung nach Antwortpfad selbst | nicht belegt (Ableitung: Podiumsfragen durchlaufen `answer_drafted` nie, R-TRANS-08) |
| R-TRANS-06 | Folge: `stagePosition` entfällt, die Frage verlässt die Bühnen-Warteschlange (`state.ts:240`) | `docs/ist-analyse-und-schnittstellen.md:90` „Antwort zurückgeben" → zurück ins Backoffice |
| R-TRANS-06 | Folge: bei Rücksprung nach `classified` entfällt eine Freigabe | nicht belegt (Ableitung: eine Podiumsfrage erreicht `approved` nie, die Löschung greift heute ins Leere) |
| R-TRANS-07 | Stand → `staged` | `docs/ist-analyse-und-schnittstellen.md:92` „es laufen nur die zugeordneten und freigegebenen Fragen ein" |
| R-TRANS-07 | Feld `stagePosition` | nicht belegt (Architekturentscheidung: globale Warteschlange); `docs/ist-analyse-und-schnittstellen.md:87` nennt eine andere Sortierung („nach Fragesteller und vor allem nach Bühnenzuordnung") |
| R-TRANS-08 | Stand → `staged` (Podiumspfad) | `docs/ist-analyse-und-schnittstellen.md:50` „keine Rechtsprüfung vor der Bühne" |
| R-TRANS-08 | Feld `stagePosition` | nicht belegt (Architekturentscheidung: globale Warteschlange, derselbe Zähler wie R-TRANS-07); ist:87 nennt eine andere Sortierung |
| R-TRANS-09 | Stand → `delivered` | `docs/ist-analyse-und-schnittstellen.md:89` „vorgelesen, weiter" |
| R-TRANS-09 | Feld `answerVersion` (nur bei Freigabe) | `docs/anforderungen-recherche.md:103` „Soll-Ist-Abgleich der tatsächlich gesprochenen Antwort gegen den freigegebenen Wortlaut" (Ableitung: der Abgleich braucht die freigegebene Version als Soll); nicht umgesetzt: der Abgleich selbst, Overdisclosure-Alarm, Pflichtfeld absichtlich/unabsichtlich |
| R-TRANS-10 | Stand → `closed` | `docs/ist-analyse-und-schnittstellen.md:58-59`, bereits als „nicht umgesetzt: keine Antwortprüfung durch Legal/FOO/GC" benannt |
| R-TRANS-10 | Folge: `stagePosition` entfällt (`state.ts:266`) | nicht belegt (Ableitung: die Frage hat die Warteschlange schon mit R-TRANS-09 verlassen, `getStage` zeigt nur `staged`; die Löschung räumt nur das Feld auf) |
| R-TRANS-11 | Stand → `withdrawn` | nicht belegt (Recherche:285 nennt nur die Zählkategorie, ausdrücklich nicht der Übergang) |
| R-TRANS-11 | Feld `reason` | nicht belegt |
| R-TRANS-11 | Folge: `stagePosition` entfällt, eine Frage aus `staged` verlässt die Warteschlange (`state.ts:275`) | nicht belegt (Ableitung: ist:92 lässt nur zugeordnete und freigegebene Fragen einlaufen; eine zurückgezogene gehört nicht mehr dazu) |
| R-TRANS-12 | Stand → `merged`, Feld `intoQuestionId` | `docs/anforderungen-recherche.md:147` „Dublettenerkennung" (teilweise: kein Unmerge, kein Ähnlichkeitsscore) |
| R-TRANS-12 | Bestandscheck des Zielobjekts (404-Maskierung wie R-TRANS-00) | nicht belegt (Architekturentscheidung, `requireQuestionFor` in `api.ts`) |
| R-TRANS-12 | Ziel wird nur auf Bestand, nicht auf seinen Stand hin angenommen (`api.ts:279-288`, `mergeQuestion`): auch ein `withdrawn`-, `merged`- oder `closed`-Ziel | teilweise: `docs/anforderungen-recherche.md:147` „Eine fälschlich weggeclusterte Frage gilt als nicht beantwortet" — die zusammengeführte Frage kommt dann nie mehr auf die Bühne |
| R-GUARD-01 | Verweigerung: keine Antwortversion vorhanden | `docs/ist-analyse-und-schnittstellen.md:52` „erst 6 fachliche Beantwortung, dann 7 Legal Clearing" |
| R-GUARD-02 | Verweigerung: Track ≠ `podium` | `docs/ist-analyse-und-schnittstellen.md:50` „No-Brainer: freie Beantwortung" |
| R-GUARD-03 | Verweigerung: Track = `podium` | `docs/ist-analyse-und-schnittstellen.md:51-52` „Fast Track/Expert Track erzeugen einen Text" |
| R-GUARD-04 | Verweigerung: genannte oder einzige Version ist nicht die letzte | `docs/rollen-und-rechtekonzept.md:163` „Keine Freigabe ohne Bindung an die Textversion" (deckt auch den Fall ohne Payload — dieselbe Bindung) |
| R-GUARD-05 | Verweigerung: Ziel = Quelle des Merges | `docs/anforderungen-recherche.md:147`, Ableitung (teilweise wie R-TRANS-12) |
| R-TRANS-00 | Verweigerung: terminaler Stand / keine passende Zeile | nicht belegt (Architekturentscheidung, `TERMINAL_STATUSES`) |
| R-TRANS-00 | 409-Antwortformat mit Regel-ID | `docs/qualitaetsleitplanken-produktreife.md:175` Checkliste 6.4 |
| R-TRANS-00 | Maskierung (409 ohne Regel-ID für Nicht-Leser) | nicht belegt (Architekturentscheidung, `transition()` in `api.ts`) |
| R-PERM-01 | 403 mit Regel-ID bei fehlendem Schreibrecht | `docs/rollen-und-rechtekonzept.md:141` „Deny by default" |
| R-PERM-01 | 404-Maskierung für eine weder lesbare noch bearbeitbare Frage | nicht belegt (Architekturentscheidung, Festlegung 3 von Scheibe 010) |
| R-PERM-02 | 403 mit Regel-ID bei fehlendem Leserecht | `docs/rollen-und-rechtekonzept.md:141` „Deny by default" |
| R-PERM-02 | 404-Maskierung für eine nicht lesbare Frage | nicht belegt (Architekturentscheidung, Festlegung 3 von Scheibe 010) |
| R-PERM-03 | 403 bei Statusfilter außerhalb des Leseumfangs | `docs/rollen-und-rechtekonzept.md:93` „Bühnenzuordnung", Ableitung |
| R-PERM-03 | 404-Maskierung für eine einzelne Frage außerhalb des Leseumfangs | nicht belegt (Architekturentscheidung, Festlegung 3 von Scheibe 010) |
| R-PERM-03 | Bühnenzuordnung für den Vorstand selbst | nicht umgesetzt (bereits so benannt) |
| R-IDEM-01 | Replay liefert erstes Ergebnis statt Neuausführung, Scope Akteur+Operation | `docs/qualitaetsleitplanken-produktreife.md:167` Checkliste 6.3 |

**Zitate geändert (13 von 22 Regeln)** — jeweils die zuvor fehlende Wirkung ergänzt, keine der bereits
vorhandenen Fundstellen oder Lücken-Kennzeichnungen entfernt: R-TRANS-00, R-TRANS-01, R-TRANS-03,
R-TRANS-04, R-TRANS-06, R-TRANS-07, R-TRANS-08, R-TRANS-09, R-TRANS-11, R-TRANS-12, R-PERM-01, R-PERM-02,
R-PERM-03. Unverändert, weil bereits jede Wirkung deckten: R-TRANS-02, R-TRANS-05, R-TRANS-10,
R-GUARD-01..05, R-IDEM-01.

Verhalten, Übergänge, Guards und Rechte sind dabei nicht angefasst:
`git diff --exit-code -- packages/domain/policy-truth-table.md` bleibt leer (geprüft nach dem Commit unten).
`docs/legal-trace.md` wurde über `npx vitest run -u` (in `packages/domain`) neu erzeugt, nie von Hand.

`node /home/user/wt/011/scripts/slice-scope.mjs`:

```
slice-scope: 9 changed file(s), all within "docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).
```

`pnpm -C /home/user/wt/011 gates`, Ende (verbatim), gelaufen auf dem committeten Stand `b1f4457` (fix(domain):
jede Wirkung einer Regel belegt oder als unbelegt benannt, Scheibe 011) — dieser Bericht-Abschnitt selbst kam
danach dazu; `mark-test-run` hasht nur `apps/`, `packages/`, `scripts/`, ein reiner `docs/`-Zusatz ändert daran
nichts:

```
packages/domain test:  Test Files  6 passed (6)
packages/domain test:       Tests  85 passed (85)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  48 passed (48)
apps/api test:  Test Files  6 passed (6)
apps/api test:       Tests  55 passed (55)

> hvworkflow@0.1.0 vocabulary /home/user/wt/011
> node scripts/vocabulary-check.mjs

vocabulary-check: ok
...
x 7 dependency violations (0 errors, 7 warnings). 139 modules, 505 dependencies cruised.

> hvworkflow@0.1.0 role-literals /home/user/wt/011
> node scripts/role-literal-check.mjs

> hvworkflow@0.1.0 now-check /home/user/wt/011
> node scripts/now-check.mjs

> hvworkflow@0.1.0 plan-honesty /home/user/wt/011
> node scripts/plan-honesty.mjs

i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.

slice-scope: 9 changed file(s), all within "docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).

Downgrade check: 14 spec(s) with a number 009-099, no unauthorised risk-class downgrade against docs/produktplan-beta.md.

plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
...
# tests 196
# suites 0
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6482.015928

> @hv/web@0.0.0 build /home/user/wt/011/apps/web
> tsc -b && vite build
...
✓ built in 1.10s
mark-test-run: wrote /home/user/wt/011/.claude/state/last-test-run (clean tree) at commit b1f4457, tree 6ca337b2c94a…
```

Kein FAIL/`not ok` im gesamten Lauf (geprüft per `grep`); `arch`: „0 errors, 7 warnings" — dieselben sieben
vorbestehenden `web-features-i18n-domain-types-only`-Befunde wie in jedem früheren Lauf dieser Scheibe,
unverändert durch diesen Diff.

**Hinweis zum vorigen `pnpm gates`-Ende in Abschnitt 7/8:** Der dort eingefügte Lauf (Commit `c9ff931`
bzw. der Stand nach Abschnitt 8) ist durch den obigen ersetzt — er war nach diesem, vierten Codex-Lauf
nicht mehr der letzte Lauf auf dem tatsächlich committeten Stand. Beide Läufe zeigen dasselbe Bild (grün,
0 fail), nur der Diff dazwischen ist die Wirkungen-Nacharbeit dieses Abschnitts.

**Nachtrag Orchestrator:** Vor dem Push hat der Orchestrator den fehlenden Vermerk `[skip netlify]` im Betreff ergänzt (`git filter-branch --msg-filter`, nichts war gepusht). Dadurch änderten sich die Commit-Kennungen: `b1f4457` → `f08979a`, `c0d1f1d` → `389fa10`; der Inhalt ist gleich. `pnpm gates` auf `389fa10`, eigener Lauf des Orchestrators: Exit 0.

### 10. Letzte Legal-Befunde

Letzte Nachprüfung Opus 5.5 (Legal), Urteil „nacharbeiten" (0/1/3 + 1 nit). Jede Fundstelle vor der Änderung
gegen Code und Dokument nachgelesen. Geändert nur `legalRef`-Zitate in `packages/domain/src/transitions.ts`, der
Schnappschuss `docs/legal-trace.md` (über `npx vitest run -u` in `packages/domain`) und dieser Bericht. Kein
Verhalten, kein Recht, kein Übergang, kein Guard geändert.

1. **major · R-TRANS-01, Tagesordnungspunkt.** Zitat von Recherche:62 vollständig („… Mehrfachzuordnung
   erlaubt, Umhängen mit Historie. Ohne TOP-Bezug ist weder die Erforderlichkeit prüfbar …") und „Teilweise für
   `agendaItemId`" mit drei Teilen. Nachgeprüft: optional (`types.ts:246`; `api.ts:535` prüft nur einen genannten
   Punkt auf Bestand) — stimmt; keine Mehrfachzuordnung (ein `string`) — stimmt; „Umhängen ohne Historie" stimmt
   **so nicht**: erneutes Klassifizieren aus `captured`/`classified` hängt ein neues `QuestionClassified`-Ereignis an,
   das im Verlauf der Frage steht. Das Zitat sagt deshalb genauer: Umhängen nur durch erneutes Klassifizieren und
   nur aus `captured`/`classified`, jede Klassifizierung als eigenes Ereignis, kein Vermerk „von … nach …", und ein
   Klassifizieren ohne `agendaItemId` entfernt die Zuordnung (`state.ts:195-196`). Offen Punkt 5 (Abschnitt 8).
2. **minor · R-TRANS-07/-08, `stagePosition`.** „naheliegende Umsetzung" ersetzt durch „nicht belegt
   (Architekturentscheidung: globale Warteschlange)"; ist:87 mit der anderen Sortierung zitiert. Nachgeprüft:
   `stageQuestion` vergibt `stageCounter + 1`, `getStage` sortiert nur danach. Offen Punkt 8.
3. **minor · fehlende Wirkungen.** R-TRANS-03: `sources` optional (`api.ts:566`) als „teilweise" gegen
   Rechtekonzept:108 („Antworttext, Quelle"), ergänzend Recherche:101; Rückholung aus `in_review` „nicht belegt"
   mit Ableitung. R-TRANS-06: `stagePosition` entfällt (`state.ts:240`), belegt durch ist:90. R-TRANS-10
   (`state.ts:266`) und R-TRANS-11 (`state.ts:275`): „nicht belegt" mit Ableitung. Beim Nachlesen zwei weitere
   Wirkungen gefunden und ebenso behandelt: R-TRANS-03 löscht einen Rückgabegrund, R-TRANS-06 löscht beim
   Rücksprung nach `classified` eine Freigabe (beide „nicht belegt", Ableitung). Die Zeitpunkt- und Akteur-Felder
   aus dem Ereignis (`approvedAt`/`approvedBy`, `deliveredAt`) sind wie `fromStatus`/`toStatus` die
   Ereignisprotokoll-Pflicht selbst und nicht gesondert aufgeführt. Offen Punkt 6.
4. **minor · R-TRANS-12, Merge-Ziel.** „Teilweise auch beim Ziel": nur Bestand, nicht der Stand; zurückgezogene,
   zusammengeführte oder abgeschlossene Ziele werden angenommen, die Frage kommt nie mehr auf die Bühne;
   Recherche:147 „gilt als nicht beantwortet" zitiert. Nachgeprüft: `mergeQuestion` ruft im `build` nur
   `requireQuestionFor` (`api.ts:279-288`). Offen Punkt 7.
5. **nit · R-TRANS-09, `answerVersion`.** Recherche:103 (Soll-Ist-Abgleich gegen den freigegebenen Wortlaut)
   zitiert, mit „Ableitung:" und „nicht umgesetzt: der Abgleich selbst, Overdisclosure-Alarm, Pflichtfeld
   absichtlich/unabsichtlich".

Tabelle in Abschnitt 9 entsprechend ergänzt. Festlegung 5 eingehalten: kein Verlaufshinweis und kein „Review"
oder „geprüft" in den neuen Zitaten (`grep` auf die geänderten Zeilen).
`git diff --exit-code -- packages/domain/policy-truth-table.md`: leer.

`pnpm -C /home/user/wt/011 gates` auf dem committeten Stand `8f97f6d` (sauberer Baum), Exit 0. Auszug, wörtliche Zeilen aus dem Lauf (Testsummen, Tore, Ende; Vite-Hinweise zu Sourcemap und Chunkgröße weggelassen):

```
packages/domain test:  Test Files  6 passed (6)
packages/domain test:       Tests  85 passed (85)
apps/web test:  Test Files  4 passed (4)
apps/web test:       Tests  48 passed (48)
apps/api test:  Test Files  6 passed (6)
apps/api test:       Tests  55 passed (55)

vocabulary-check: ok
x 7 dependency violations (0 errors, 7 warnings). 139 modules, 505 dependencies cruised.
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.
i18n-literal check: 0 literals found under apps/web/src/features, apps/web/src/app.
slice-scope: 9 changed file(s), all within "docs/slices/011-legal-trace-regelregister.md"'s "Files allowed" list (9 pattern(s)).
Downgrade check: 14 spec(s) with a number 009-099, no unauthorised risk-class downgrade against docs/produktplan-beta.md.
plan-graph: ok.
...
# pass 196
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7940.619971
> @hv/web@0.0.0 build /home/user/wt/011/apps/web
> tsc -b && vite build
vite v8.2.2 building client environment for production...
transforming...
✓ 1715 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.43 kB │ gzip:   0.27 kB
dist/assets/jetbrains-mono-latin-ext-DIC32ArD.woff2   11.62 kB
dist/assets/jetbrains-mono-latin-6fWv1k7M.woff2       31.43 kB
dist/assets/inter-latin-Dx4kXJAl.woff2                48.25 kB
dist/assets/inter-latin-ext-DO1Apj_S.woff2            85.06 kB
dist/assets/index-D5Ngkhre.css                        39.95 kB │ gzip:   8.66 kB
dist/assets/index-frBADcGl.js                        543.92 kB │ gzip: 159.76 kB │ map: 2,217.06 kB
✓ built in 1.61s
mark-test-run: wrote /home/user/wt/011/.claude/state/last-test-run (clean tree) at commit 8f97f6d, tree 0acdf6f2af90…
```

Kein `FAIL`/`not ok` im Lauf (`grep`); `arch`: dieselben sieben vorbestehenden Warnungen. Dieser Absatz kam in einem reinen `docs/`-Commit danach dazu.

## Review findings

**Runde 1 · Opus 5.5 (Perspektive Legal) · 24.09.2026 · Urteil: nacharbeiten** (0/2/4 + nits), dazu Codex auf PR
#24 (1 × P2). Mechanik geprüft und für gut befunden: Register ohne zweite Liste, roter Lauf nachgestellt,
Guard-Tests keine Tautologien, Wahrheitstabelle unverändert, kein `node:` in der Domäne.

1. major · R-TRANS-11: „kein wörtlicher Beleg“ falsch (Recherche:285), Analogie zu ist:44 eine Rechtsbewertung, Quelle
   „Prozess“ ohne Prozessquelle → Recherche:285 als Zählkategorie, ausdrücklich nicht der Pfad Recherche:24.
2. major · Zitate verlangen mehr, als die Regel tut, ohne es zu sagen (R-TRANS-02 Personenzuweisung, R-TRANS-12 und
   R-GUARD-05 Merge reversibel, R-TRANS-05 Freigabevermerk und Vier-Augen) → „teilweise“ bzw. „nicht umgesetzt“.
3. minor · falsche Stellen (R-PERM-03, R-TRANS-07, R-TRANS-06, R-TRANS-00) → berichtigt.
4. minor · R-PERM-01 „eingeführt in 010“ falsch → seit a0c38c4.
5. minor · Scan prüfte nur eine Richtung → auch veraltete Registereinträge fallen auf (roter Lauf R-STALE-01).
6. minor · Bericht zählte falsch → berichtigt.
7. nits (Ableitung kennzeichnen, R-TRANS-10 eigene Stelle, veraltete Guard-Szenarien, „Prüfpunkt“) → erledigt.
- Codex P2 · R-TRANS-00 behauptete, beide Konfliktfälle kämen mit dieser ID zurück; seit 010 Festlegung 8 verbirgt die
  API sie vor Nicht-Lesern → als interne ID beschrieben.

**Runde 2 · Nachprüfung Opus 5.5 (Legal) · Urteil: nacharbeiten** (0/2/2 + nits):

1. major · R-TRANS-10 zitiert die Antwortprüfung durch Legal · FOO/GC ohne Lückenvermerk; Recht läse „abgeschlossen“
   als „Legal hat die Antwort für ausreichend befunden“.
2. major · „Rework nach Legal-Review“ in rund zwölf Zitaten; Recht läse das als eigene Prüfung (E15).
3. minor · R-PERM-03 → Zeile :93 betrifft den Vorstand, die Regel nur observer.
4. minor · offengelegte Lücken nicht als offene Punkte weitergetragen.
5. nits (Domänen-API statt HTTP-Schicht, Commit-Betreff wörtlich, Ausschluss über den vollen Pfad).

Die Nacharbeitsrunde des Bauers war verbraucht → Spec nachgeschärft (Festlegung 5), Behebung durch den Orchestrator,
siehe Bericht Abschnitt 8; Nachprüfung der Behebung durch Opus (Legal).

**Runde 3 · letzte Nachprüfung Opus 5.5 (Legal) · Urteil: annehmen** (0/0/1 + 1 nit): Freigabevermerk fälschlich
021 zugeordnet → als eigener offener Punkt 1a; „reviewed“ in der Beschreibung von R-TRANS-12 → „before legal
clearing“. Dazu Codex auf PR #24 (1 × P2): R-PERM-01 versprach immer 403, obwohl die API bei einer Frage, die der
Akteur weder lesen noch bearbeiten darf, dasselbe 404 wie für eine unbekannte ID antwortet → R-PERM-01, -02 und -03
beschreiben jetzt die Entscheidung und die 404-Maskierung (Festlegung 3 von 010). Behoben vom Orchestrator.

**Codex auf PR #24, weiterer Lauf (1 × P2):** Der Scan-Test zählte sich selbst und `rules.test.ts` zum Testkorpus;
seine Kopfzeile nennt die IDs aus `OTHER_RULES`, sodass „jede Regel hat einen Test“ auch ohne echten Test bestanden
hätte → beide Meta-Tests sind über den vollen Pfad aus dem Korpus genommen (Orchestrator). Jede der fünf Regeln
außerhalb der Tabelle hat weiter echte Tests (R-TRANS-00: api, transitions, negative; R-PERM-01: api, transitions,
negative, read-rights; R-PERM-02: api, transitions, read-rights; R-PERM-03: api, read-rights; R-IDEM-01: api,
negative). Probe mit einer Wegwerf-ID `R-META-99`, die nur im Produktionscode und im Kommentar des Scan-Tests
steht: mit dem Ausschluss „1 failed | 5 passed (6)“, ohne ihn „6 passed (6)“; Wegwerf-Änderungen zurückgesetzt.
