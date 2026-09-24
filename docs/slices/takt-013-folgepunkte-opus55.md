# takt-013 — Folgepunkte A–F aus takt-012: alte Modellbesetzung aus den übrigen Dokumenten

**Status:** review
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-plan, docs (nur die unten
genannten Dateien)
**Rolle:** Implementierer (Modell aus der Rollendatei); Review in frischem Kontext
**Rule ids:** AGENTS.md Regeln 1, 2, 3, 12; Entwicklungsplan R3, R6
**Quellen-IDs:** takt-012, Folgepunkte A–F (Review Runde 1 und Codex auf `de5890e`); Entscheid des Eigentümers vom
24.09.2026: „Fable braucht es definitiv nicht mehr"; dazu takt-012: Opus 5.5 baut und prüft, Sonnet 5 nur Mechanik,
Haiku nicht besetzt

## Festlegung des Architekten

1. **Eine Regel, überall.** Unabhängigkeit im Review entsteht durch frischen Kontext, der nur Spec und Diff sieht, nicht
   durch ein anderes Modell (AGENTS.md Regel 3, Plan R3 seit takt-012). Jede Stelle, die „anderes Modell" verlangt oder
   „dasselbe Modell reviewt" verwirft, wird darauf umgestellt.
2. **Rolle statt Modell im Plan.** Specs und Planzeilen nennen die Rolle, nicht das Modell; das Modell steht nur in
   `.claude/agents/*.md` (takt-012, Ziel 1). In `docs/produktplan-beta.md` heißt die Zeile „*Rolle/Modell:*" deshalb
   künftig „*Rolle:*" und nennt nur Rollen (Architekt, Planer, Implementierer-Backend, Implementierer-Oberfläche,
   Mechaniker, Reviewer, Design-Kritik) mit Perspektive, ohne Modellnamen. Das gilt für **alle** Scheibenzeilen in
   Abschnitt 5, auch für schon gemergte: der Plan beschreibt die Besetzung, die Geschichte steht in `docs/messung.md`,
   den Bautagberichten und den Specs.
   - Sonderfälle, die bisher an zwei Modellen hingen, werden über den Kontext ausgedrückt: „Design-Kritik Fable und
     Opus (zweite Sicht, weil Fable die Spec schrieb)" → „Design-Kritik in frischem Kontext (nicht die Sitzung, die die
     Spec schrieb)"; „Review Fable" bei Sicherheitsscheiben → „Review in frischem Kontext mit Perspektive Security".
   - Die Tabelle der Scheibentypen (Abschnitt „Besetzung", heute Spalte „Review (anderes Modell, …)") und die
     Bautag-Beschreibung (Orchestrator, Review, Design-Kritik, Sicherheitsreview) folgen derselben Regel.
3. **ADR 0016 ist vorgeschlagen, nicht angenommen.** Es wird direkt berichtigt (kein Folge-ADR): Review-Paarung und die
   verworfene Option „dasselbe Modell reviewt" werden auf Festlegung 1 umgestellt, mit einem Satz „Geändert am
   24.09.2026 (takt-013): …" unter „Status". Die übrigen Entscheidungen der ADR bleiben unberührt.
4. **Historische Dokumente bleiben Geschichte.** `docs/bauplan-demo.md` und `docs/messung.md` beschreiben, was
   gewesen ist. Sie bekommen je einen Vermerk oben (bauplan-demo: „Historischer Plan des Demo-Baus; die Besetzung ist
   ersetzt durch takt-012 und takt-013") bzw. einen Satz vor der ersten Tabelle ab 24.09.2026 (messung: „Ab 24.09.2026
   gilt die Besetzung aus `.claude/agents/`: Opus 5.5, Mechanik Sonnet 5"). Bestehende Messzeilen werden nicht
   geändert.

5. **Nachtrag des Architekten (nach dem Bau).** Akzeptanzkriterium 1 und die Nicht-Ziele widersprachen sich an drei
   Stellen, die Modellnamen in Zielen bzw. im Absatz 5.9 tragen (Zeilen 606, 826, 866). Entscheidung: auch diese werden
   auf Rollen umgestellt, ohne sonst etwas am Ziel zu ändern; ebenso die übrigen Modellnennungen „Opus" in Plan-Zeilen 234,
   340, 349, 994, und „fremdes Modell" bei Anleitungstests (B14, Tabelle 6.1 Spalte „Zusätzlich", Leitplanken Zeile 220)
   wird „Agent in frischem Kontext ohne Vorwissen". Die schon geänderten Zeilen 194 und 1122 sind damit gedeckt.
   Akzeptanzkriterium 2 erlaubt zusätzlich genau diese Zeilen.
6. **Tor auf gestapeltem Branch.** Solange takt-011 nicht gemergt ist, läuft `slice-scope` mit
   `--base claude/takt-011-plan-service`; nach dem Merge von takt-011 wird der Integrationsbranch eingemergt und
   `pnpm gates` unverändert neu gelaufen.

## Ziel

- **A** `docs/qualitaetsleitplanken-produktreife.md`: Risikoklassen-Spalte „Review" (Zeilen 120–122) ohne „anderes
  Modell" (frischer Kontext); Zeile 140 „Design-Kritik (Fable, D1–D10)" → „Design-Kritik (D1–D10)"; Zeile 143 an
  Festlegung 1; weitere Modellnennungen in dieser Datei (z. B. „Reviewer (Opus)") auf die Rolle.
- **B** `docs/produktplan-beta.md`: Zeile 7 (Zielgruppe) beschreibt die Besetzung nach takt-012; alle
  „*Rolle/Modell:*"-Zeilen in Abschnitt 5 nach Festlegung 2; Besetzungstabelle und Bautag-Absätze (heute um Zeile
  901–924) nach Festlegung 1 und 2; Zeile 343 (Ziel von 016, Agentendefinitionen mit Modellen) bleibt als Ziel einer
  gemergten Scheibe stehen, aber ohne Modellnamen in Klammern.
- **C** `docs/bauplan-demo.md`: Vermerk nach Festlegung 4.
- **D** `docs/messung.md`: Satz nach Festlegung 4.
- **E** `docs/adr/0016-agenten-arbeitsmodell.md`: nach Festlegung 3.
- **F** `docs/betrieb/branch-schutz.md` Zeilen 27–28: „ein anderes Modell reviewt" → Review in frischem Kontext.

## Nicht-Ziele

Keine Änderung an Toren, Skripten, Agentendateien, Specs anderer Scheiben, Kalender, Lanes, Abhängigkeiten oder
Zielen im Plan (außer dem Klammerinhalt in Zeile 343); keine neue ADR. `docs/agentische-entwicklung-plan.md` bleibt, wie
takt-012 ihn hinterlassen hat (Fable und Haiku stehen dort als „nicht mehr besetzt" in der Preistabelle).

## Files allowed

- `docs/qualitaetsleitplanken-produktreife.md`
- `docs/produktplan-beta.md`
- `docs/bauplan-demo.md`
- `docs/messung.md`
- `docs/adr/0016-agenten-arbeitsmodell.md`
- `docs/betrieb/branch-schutz.md`
- `docs/slices/takt-013-folgepunkte-opus55.md`

## Akzeptanzkriterium

1. `grep -niE "fable|haiku" docs/produktplan-beta.md docs/qualitaetsleitplanken-produktreife.md
   docs/adr/0016-agenten-arbeitsmodell.md docs/betrieb/branch-schutz.md` findet nichts; `grep -niE "anderes? Modell|dasselbe
   Modell"` über dieselben Dateien findet nur Stellen, die ausdrücklich sagen, dass kein anderes Modell nötig ist.
   Ausgaben wörtlich im Bericht.
2. In `docs/produktplan-beta.md` gibt es keine Zeile „*Rolle/Modell:*" mehr; `git diff` zeigt in Abschnitt 5 außer den
   Rollenzeilen und dem Klammerinhalt von Zeile 343 keine geänderte Zeile (Ziele, Kalender, Lanes, Abhängigkeiten,
   „Stand" unberührt).
3. `node scripts/plan-graph.mjs` und `node scripts/plan-honesty.mjs` grün, Ausgabe wörtlich.
4. `pnpm gates` grün (Commit nennen, Schluss einmal wörtlich).

## Arbeitsweise

- Worktree `/home/user/wt/prozess`, Branch `claude/takt-013-folgepunkte-opus55`. Er startet vom Stand von takt-011
  (`claude/takt-011-plan-service`), weil beide `docs/produktplan-beta.md` ändern; takt-013 wird nach takt-011 gemergt.
- Absolute Pfade oder `cd` in den Worktree; Logdateien nur über `mktemp`.
- Commit-Betreff nennt „takt-013" und endet mit `[skip netlify]`. Nicht pushen.

## Bericht

Slice: takt-013-folgepunkte-opus55
Done: A–F auf `99392d2`, Festlegung 5 auf `9f9a883`: alle 80 Zeilen „*Rolle/Modell:*" in Abschnitt 5 heißen „*Rolle:*"
und nennen nur Rollen; Zeile 7, Klammerinhalt 343, Tabelle 6.1, Absatz 911, 6.2 und 6.3 sowie die Zeilen aus
Festlegung 5 (36, 194, 234, 340, 349, 606, 826, 866, 994, 1122) ohne Modellnamen und mit frischem Kontext statt
anderem Modell; Leitplanken (auch Anleitungstest Zeile 219), ADR 0016 (Satz „Geändert am 24.09.2026"), Branch-Schutz
nach Festlegung 1 und 3; Vermerke in bauplan-demo und messung nach Festlegung 4.
Evidence:

Kriterium 1 (auf `9f9a883`):
```
$ grep -niE "fable|haiku" docs/produktplan-beta.md docs/qualitaetsleitplanken-produktreife.md docs/adr/0016-agenten-arbeitsmodell.md docs/betrieb/branch-schutz.md
$ echo $?
1
$ grep -niE "anderes? Modell|dasselbe Modell" docs/produktplan-beta.md docs/qualitaetsleitplanken-produktreife.md docs/adr/0016-agenten-arbeitsmodell.md docs/betrieb/branch-schutz.md
docs/produktplan-beta.md:911:Perspektiven (Security, Datenschutz, Legal, Betrieb) sind Checklisten im Spec und in reviewer.md, keine neuen Agentenrollen. Agentendefinitionen ab 016: architekt.md, planer.md, design-kritiker.md, reviewer.md, reviewer-sonnet.md, implementierer-backend.md, implementierer-oberflaeche.md, mechaniker.md; das Modell je Rolle steht nur dort. Unabhängigkeit im Review entsteht durch frischen Kontext, der nur Spec und Diff sieht, nicht durch ein anderes Modell (Regel 3). Jede Hoch-Spec und jede ADR bekommt vor dem Bau einen Lesebefund des Reviewers in frischem Kontext.
docs/produktplan-beta.md:919:- **Review.** Jede Scheibe bekommt nach dem ersten grünen Torlauf ein Review in frischem Kontext, der nur Spec und Diff sieht (Regel 3); ein anderes Modell ist dafür nicht nötig, wer baut, prüft aber nicht. Nacharbeit höchstens eine Runde; danach geht die Scheibe an den Planer zurück, weil meist die Spec falsch ist.
docs/adr/0016-agenten-arbeitsmodell.md:5:Geändert am 24.09.2026 (takt-013): Review-Paarung und die verworfene Option „dasselbe Modell reviewt" an
docs/adr/0016-agenten-arbeitsmodell.md:7:Kontext, nicht durch ein anderes Modell. Die übrigen Entscheidungen bleiben unverändert.
docs/adr/0016-agenten-arbeitsmodell.md:33:  wer baut, prüft nicht, auch nicht in derselben Sitzung. Ein anderes Modell ist dafür nicht nötig.
docs/adr/0016-agenten-arbeitsmodell.md:82:- **Der Bauende reviewt selbst oder in derselben Sitzung.** Verworfen: Regel 3. Dass dasselbe Modell
docs/adr/0016-agenten-arbeitsmodell.md:83:  in frischem Kontext reviewt, ist dagegen erlaubt (takt-012); ein anderes Modell ist keine Pflicht.
```
Alle Treffer sagen, dass kein anderes Modell nötig ist (ADR Zeile 5 zitiert die alte Option im Änderungsvermerk).

Kriterium 2: `grep -c "Rolle/Modell" docs/produktplan-beta.md` → `0`. Geänderte Zeilen in `docs/produktplan-beta.md`
laut `git diff -U0 ec27a8a` (Beginn der Hunks, `n,k` = k Zeilen ab n):
`7 36 194 234 315 321 327 333 339,2 343 345 349 351 357 363 369 386 392 398 404 410 416 422 440 446 452 458 464 470 476
482 488 494 500 506 512 518 524 530 536 542 548 554 560 566 584 590 596 602 606 608 614 620 626 632 638 644 650 667 673
679 685 691 697 703 709 715 721 727 745 751 757 763 769 775 781 787 804 810 816 822 826 828 834 840 846 852 858 866 901
903,7 911 915 919 923,2 994 1122`. Davon in Abschnitt 5 (Zeilen 255–896): die 80 Rollenzeilen, 343 (Klammerinhalt),
dazu nach Festlegung 5 die Zeilen 340, 349, 606, 826, 866 — je nur die Modellnennung; Ziele sonst, Kalender, Lanes,
Abhängigkeiten und „Stand" unberührt. Außerhalb von Abschnitt 5: 7, 36, 194, 234 (Festlegung 5 bzw. Ziel B), 901–911
(Tabelle 6.1 mit Absatz), 915, 919, 923–924 (6.2, 6.3), 994, 1122 (Festlegung 5).

Kriterium 3:
```
$ node scripts/plan-graph.mjs
plan-graph: 80 slice(s) found in docs/produktplan-beta.md section 5.
  missing dependencies: 0
  cycles: 0
  dependency-order problems: 0
  same-day lane-sharing warnings: 0

plan-graph: ok.
$ node scripts/plan-honesty.mjs
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.
```

Kriterium 4: nach Festlegung 6 die `gates`-Kette auf `9f9a883` mit `node scripts/slice-scope.mjs --base
claude/takt-011-plan-service` an Stelle von `pnpm slice-scope`, einschließlich `mark-test-run`, Exit 0, Schluss:
```
packages/domain test:       Tests  72 passed (72)
apps/web test:       Tests  48 passed (48)
apps/api test:       Tests  49 passed (49)
vocabulary-check: ok
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.
slice-scope: 7 changed file(s), all within "docs/slices/takt-013-folgepunkte-opus55.md"'s "Files allowed" list (7 pattern(s)).
Downgrade check: 13 spec(s) with a number 009-099, no unauthorised risk-class downgrade against docs/produktplan-beta.md.
plan-graph: ok.
# pass 206
# fail 0
✓ built in 1.19s
mark-test-run: wrote /home/user/wt/prozess/.claude/state/last-test-run (clean tree) at commit 9f9a883, tree 32b789473989…
```
Unverändertes `pnpm gates` läuft nach dem Merge von takt-011 (Festlegung 6); dieser Bericht ist ein reiner Doku-Commit
danach.

Open: Außerhalb der Liste aus Festlegung 5 stehen noch „fremden Modell" in Zeile 797 (Nachweiszeile M6, Anleitungen
befolgt) und „reviewer-sonnet.md für Opus-gebaute Scheiben" in Ziel 343 außerhalb der Klammern; beide unverändert, weil
nicht freigegeben. Kein Treffer für Kriterium 1.
Touched: `docs/produktplan-beta.md`, `docs/qualitaetsleitplanken-produktreife.md`, `docs/bauplan-demo.md`,
`docs/messung.md`, `docs/adr/0016-agenten-arbeitsmodell.md`, `docs/betrieb/branch-schutz.md`, diese Spec.

## Review findings

(vom Reviewer)
