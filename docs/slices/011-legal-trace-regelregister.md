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
| R-TRANS-01 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:42-43` (P3: „Frage klassifizieren → Zuordnung zu Pfad A, B oder C") | — |
| R-TRANS-02 | Übergang | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:107` (2.4: `classified → expert_answering`, Pflichtfeld „Segment") | offene Lücke: Recherche:221 fordert Personenzuweisung, Regel weist nur eine Einheit zu |
| R-TRANS-03 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:52` (Pfad C: „6 fachliche Beantwortung") | — |
| R-TRANS-04 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:52` (Pfad C: „7 Legal Clearing"; „ja, eigener Schritt") | — |
| R-TRANS-05 | Übergang | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:109` (2.4: `legal_clearing → ready_for_stage`, Pflichtfelder Freigabevermerk, Vier-Augen) | nicht umgesetzt: Freigabevermerk, Ersteller ≠ Freigeber (§4, Zeile 156); keine Verhaltensänderung in dieser Scheibe |
| R-TRANS-06 | Übergang | Rechtekonzept | `docs/rollen-und-rechtekonzept.md:110` (2.4: `legal_clearing → expert_answering`, Pflichtfeld „Rückgabegrund") | ergänzend ist-analyse:90 („Antwort zurückgeben") |
| R-TRANS-07 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:92` („nur die zugeordneten und freigegebenen Fragen") | — |
| R-TRANS-08 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:50` (Pfad A No-Brainer: freie Beantwortung durch den Vorstand) | — |
| R-TRANS-09 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:89` („vorgelesen, weiter") | — |
| R-TRANS-10 | Übergang | Prozess | `docs/ist-analyse-und-schnittstellen.md:58-59` (Antwortprüfung Legal → „Ja: Frage beantwortet") | eigener Abschluss-Schritt, getrennt von R-TRANS-09 |
| R-TRANS-11 | Übergang | Recherche | `docs/anforderungen-recherche.md:285` (Zähldefinition: „zurückgezogene" als Zählkategorie) | Übergang selbst ohne Fundstelle; Ableitung: NICHT dasselbe wie „Kein Auskunftsanspruch" (Recherche:24) |
| R-TRANS-12 | Übergang | Recherche | `docs/anforderungen-recherche.md:147` („Dublettenerkennung …") | teilweise: `merged` ist terminal, kein Unmerge, kein Ähnlichkeitsscore |
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

1. Vier-Augen „Ersteller ≠ Freigeber“ (Rechtekonzept §4, nicht konfigurierbar) und Pflichtfeld Freigabevermerk —
   im Plan als R-GUARD-06 in Scheibe 021 (B6); bis dahin hält `legal` `answer.draft` und `question.approve`.
   Punkt für den Eigentümer.
2. Antwortprüfung „Antwort ausreichend?“ vor dem Abschluss (ist:58-59) — keine Scheibe benannt; zur Einordnung durch
   den Architekten.
3. Merge reversibel mit Ähnlichkeitsscore (Recherche:147) — keine Scheibe benannt; zur Einordnung.
4. Zuweisung an Personen statt Einheiten (Recherche:221) — keine Scheibe benannt; zur Einordnung.

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
