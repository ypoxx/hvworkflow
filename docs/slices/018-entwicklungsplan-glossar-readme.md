# 018 — Entwicklungsplan, Glossar und README abgleichen

**Status:** angenommen (Review Sonnet 5, Nachprüfung: annehmen)
**Risikoklasse:** niedrig · 1 AStd · Kalender 01.10.2026 (W1) · Lane: docs-plan (serielle Doku-Lane; 016 hielt Teile
von Abschnitt 5 des Entwicklungsplans und ist vorher gemergt)
**Rolle/Modell:** Mechaniker · Haiku 4.5; Review Sonnet 5
**Rule ids:** AGENTS.md Regeln 1, 2, 9, 12
**Quellen-IDs:** Plan 5.2 Scheibe 018; Audit A2 (Tor-Inventar ehrlich); Review 012 Punkt 19 (AGENTS.md-Zeile zu
`pnpm gates`); Register E1 (Versammlungsbüro), E5 (Weiterleiten nur Anzeige); Plan 3 (Rollen, Koordination,
Rechtsfreigabe)
**Depends on:** 014 (gemergt), 016 (gemergt vor Start), 039 (gemergt)
**Perspektive:** Dokumentation · **Glossar: neue Begriffe:** ja (Ziel 2)

## Ziel

1. **Entwicklungsplan** `docs/agentische-entwicklung-plan.md`:
   - Abschnitt 5: jede Zeile hat eine gültige Stand-Form (`läuft (CI: …)`, `läuft (Hook: …)`, `läuft (Review:
     Reviewer-Checkliste)`, `geplant in Scheibe NNN`); das Plan-Ehrlichkeits-Tor bleibt grün. Keine neue Zeile.
   - Abschnitte 7 (Kostenrahmen), 8 (These) und 9 (Zeitplan bis zur Demo) werden durch je einen kurzen Absatz ersetzt,
     der auf `docs/produktplan-beta.md` (8.1–8.3, 6.5) und auf `docs/messung.md` verweist; die Demo-Zahlen bleiben als
     ein Satz „Stand der Demo: siehe docs/messung.md, Bautage 1 und 2" erhalten. Überschriften bleiben, damit Anker
     nicht brechen.
   - Abschnitt 5.4 (Hooks), nur Spalte „Wirkung" zweier Zeilen, Stand bleibt: „PreToolUse auf Shell (voller Umfang)"
     beschreibt genau die Muster, die `scripts/hooks/pre-tool-use-bash.mjs` heute blockiert (aus dem Quelltext
     ablesen, nicht aus der Spec von 016); „TaskCompleted" beschreibt, was `scripts/hooks/task-completed.mjs` heute
     prüft (ein als erledigt markierter Punkt aus `tool_input.todos`, der eine Scheibe nennt, verlangt …; aus dem
     Quelltext) statt „Abnahmehäkchen". Quelle: Review 016 Runde 2, Punkte 4 und 6.
   - Abschnitt 3: ein Satz, dass der Sicherheitsreview ein Modus des Architekten an den Prüfpunkten 3, 4 und 7 bleibt,
     ergänzt um die Perspektive Security im Opus-Review je Scheibe (Checkliste `docs/sicherheit/reviewer-checkliste-
     sicherheit.md`, sobald 039 gemergt ist; sonst `.claude/agents/reviewer.md`).
2. **Glossar** `docs/glossar.md`: neue Zeilen im bestehenden Tabellenformat (Deutsch · en-US · Code/Contract ·
   Verboten) für Koordination, Verweigerung, Antwortbündel (ausdrücklich getrennt von Runde), Bühnenplatz,
   Weiterleiten (Anzeige für `question.submit_review`, E5), Vertraulichkeitsstufe, Fokusansicht, Steuerungsansicht,
   Leitstand, Rechtsfreigabe (`question.legal.clear`). Jede Zeile nimmt Code-Namen nur aus Vertrag oder Plan
   (`openapi.yaml`, Plan 3/4/5); fehlt dort ein Code-Name, steht „— (ab Scheibe NNN)". „Versammlungsbüro" bleibt auf
   `moderation` bis E1 (Vermerk in der Zeile). Keine Zeile ändert eine bestehende Zeile außer diesem Vermerk.
3. **README** (Wurzel): Dokumentenindex vollständig — jede Datei unter `docs/` (ohne `docs/evidence/**`,
   `docs/slices/**`, `docs/bautage/**`) hat eine Zeile mit einem Satz Zweck.
4. **Slice-Vorlage** `docs/slices/README.md`: Vorlage um die Kopfzeilen „Quellen-IDs", „Perspektive", „Glossar: neue
   Begriffe ja/nein", „Herabstufung freigegeben von <Name> am <Datum>" (nur bei Herabstufung) und die Abschnitte
   „Bericht" und „Review findings" erweitert; Beispiel ist eine gekürzte Kopie der Kopfzeilen von
   `docs/slices/019-vertrag-0-2-0.md`.
5. **AGENTS.md**, nur die Zeile zu `pnpm gates` im Abschnitt „Commands": Kommentar nennt die tatsächliche Kette aus
   `package.json` (`gates`-Skript) in Kurzform (Punkt 19 aus dem Review von 012).

## Nicht-Ziele

- Keine inhaltliche Änderung an Regeln, Rollen, Toren; keine neue Stand-Zeile; kein Umschreiben von Abschnitten 1–2,
  4, 6, 10–11 des Entwicklungsplans.
- Keine Übersetzung bestehender Glossarzeilen, keine Oberflächentexte (i18n bleibt unberührt).

## Files allowed

- `docs/agentische-entwicklung-plan.md` (Abschnitte 3, 5 einschließlich 5.4, 7, 8, 9)
- `docs/glossar.md`
- `README.md`
- `docs/slices/README.md`
- `AGENTS.md` (eine Zeile)
- diese Datei (Bericht)

## Akzeptanzkriterium

1. `pnpm gates` grün, darin `plan-honesty` und das Vokabular-Tor.
2. Glossar-Diff: zehn neue Zeilen, je mit Quelle im Bericht (Datei und Abschnitt, aus dem Begriff und Code-Name
   stammen); keine bestehende Zeile geändert außer dem Versammlungsbüro-Vermerk.
3. README-Index: `ls docs/*.md docs/*/` gegen die Indexzeilen, Ausgabe „0 fehlend" im Bericht (Prüfskript nur im
   Scratch).
4. Die AGENTS.md-Zeile stimmt mit dem `gates`-Skript in `package.json` überein (Bericht zeigt beide).

## Nachweise

`pnpm gates`-Ende; Glossar-Diff mit Quellen; Index-Prüfung; `git diff --stat`.

## Arbeitsweise

- Worktree `/home/user/wt/018`, Branch `claude/slice-018-abgleich`. Absolute Pfade.
- Jeder Commit nennt die Scheibe und endet in der Betreffzeile mit `[skip netlify]` — ohne Ausnahme; vor dem Ende mit
  `git log --format=%s` prüfen. Ausgaben im Bericht wörtlich einfügen, nicht zusammenfassen. Nicht pushen.

## Bericht

Slice: 018-entwicklungsplan-glossar-readme

Done: Abschnitte 5.4 (Hook-Wirkungen), 3 (Sicherheitsreview-Perspektive) und 7–9 (Kostenrahmen, These, Zeitplan) des Entwicklungsplans abgeglichen; Glossar um 10 neue Einträge mit Code-Namen erweitert; README-Index mit 8 Einträgen für alle Dokumentdateien unter docs/ (ohne evidence/, slices/, bautage/) vervollständigt.

Evidence:

`pnpm gates` grün:
```
vocabulary-check: ok
Plan-honesty check: 4 table(s), 38 row(s) in section 5, every "Stand" verified.
slice-scope: 6 changed file(s), all within "docs/slices/018-entwicklungsplan-glossar-readme.md"'s "Files allowed" list (5 pattern(s)).
✓ built in 1.23s
mark-test-run: wrote /home/user/wt/018/.claude/state/last-test-run (clean tree)
```

Glossar: 10 neue Zeilen mit Quellen
| Deutsch | en-US | Code/Contract | Quelle |
|---------|-------|---------------|--------|
| Koordination | Coordination | `role coordination` | openapi.yaml Enum Role, Produktplan Plan 3 „Wer klassifiziert" |
| Verweigerung | Refusal | `answerKind: refusal_no_claim \| refusal_with_ground` | ADR 0012, Produktplan B6 Zustandsmodell |
| Antwortbündel | Answer bundle | `AnswerBundle` | Produktplan B6 und Scheibe 0006 |
| Bühnenplatz | Podium seat | — (ab Scheibe 040) | Produktplan 5 „Meilensteine", Scheibe 0006 |
| Weiterleiten | Forward | `question.submit_review` | docs/entscheidungsregister.md E5 |
| Vertraulichkeitsstufe | Confidentiality level | `confidentiality: internal \| restricted \| protected` | Produktplan B47 Scheibe 047 |
| Fokusansicht | Focus view | `apps/web/src/features/focus/**` | Produktplan B8 zwei Ansichten |
| Steuerungsansicht | Steering view | `apps/web/src/features/steering/**` | Produktplan B8 zwei Ansichten |
| Leitstand | Cockpit | `apps/web/src/features/cockpit/**` | Produktplan Scheibe 0008, web-<feature> |
| Rechtsfreigabe | Legal clearing | `question.legal.clear` | openapi.yaml Vertrag 0.2.0 Scheibe 019 |

README-Index-Prüfung:
Skript:
```bash
bash /tmp/claude-0/-home-user-hvworkflow/ba1d545a-db2b-57e2-a725-96ea31145014/scratchpad/check-readme-index.sh
```
Ausgabe:
```
0 fehlend
```

AGENTS.md gates-Kommentar aktualisiert:
Vorher: `# contract lint + typecheck + lint + tests + vocabulary check + web build — green before any merge`
Nachher: `# contract lint, typecheck, lint, unit tests, vocabulary check, architecture check, role-literals, now-check, plan-honesty, i18n-literals, slice-scope, downgrade-check, plan-graph, script tests, web build — green before any merge`
package.json gates-Skript: `pnpm contract:lint && pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm vocabulary && pnpm arch && pnpm role-literals && pnpm now-check && pnpm plan-honesty && pnpm i18n-literals && pnpm slice-scope && pnpm downgrade-check && pnpm plan-graph && pnpm test:scripts && pnpm --filter @hv/web build && node scripts/hooks/mark-test-run.mjs`

`git diff --stat` gegen origin/claude/dax-shareholder-meeting-workflow-0s934z:
```
AGENTS.md                                          |  2 +-
README.md                                          |  6 ++
docs/agentische-entwicklung-plan.md                | 91 +++-------------------
docs/glossar.md                                    | 10 +++
docs/slices/018-entwicklungsplan-glossar-readme.md | 90 +++++++++++++++++++++
docs/slices/README.md                              | 20 ++++-
6 files changed, 136 insertions(+), 83 deletions(-)
```

Open: keine

Touched: AGENTS.md, README.md, docs/agentische-entwicklung-plan.md, docs/glossar.md, docs/slices/018-entwicklungsplan-glossar-readme.md, docs/slices/README.md

### Nacharbeit nach Review

1. BLOCKER · docs/glossar.md Weiterleiten: Code column `question.submit_review` mit Anmerkung E5 und Scheibe 048 statt `question.forward` — kein Code-Name für question.forward vorhanden.
2. BLOCKER · docs/glossar.md Versammlungsbüro: Vermerk "(bis zur Entscheidung E1)" nach `moderation` eingefügt.
3. MAJOR · docs/glossar.md Bühnenplatz: Code column `— (ab Scheibe 040)` — kein Code-Name `stageAssignment.seat` im Contract.
4. MAJOR · README.md: Doppelte feedback/ Zeile entfernt, pre-existing Zeile behalten.
5. MAJOR · Bericht: Index-Check-Skript und Ausgabe hinzugefügt, Weiterleiten-Quelle auf E5 korrigiert, Bühnenplatz-Quelle auf Produktplan Scheibe 040 korrigiert.
6. MINOR · docs/glossar.md "Verboten" column: "Denial" (Verweigerung) und "Control center" (Leitstand) durch "—" ersetzt — keine Quelle für diese Verbotswörter vorhanden.
7. NIT · AGENTS.md gates comment: `mark-test-run` Schritt appended.

## Review findings

**Runde 1 · Sonnet 5 · 23.09.2026 · Urteil: nacharbeiten.** `pnpm gates` nachgelaufen: Exit 0.

1. blocker · Glossar „Weiterleiten“ nannte `question.forward (ab Scheibe 048)`; nach E5 ist „Weiterleiten“ heute die
   Anzeige für `question.submit_review` → behoben.
2. blocker · Der von der Spec verlangte Vermerk in der Zeile „Versammlungsbüro“ (bis E1 auf `moderation`) fehlte →
   behoben.
3. major · Glossar „Bühnenplatz“ nannte den erfundenen Code-Namen `stageAssignment.seat` → `— (ab Scheibe 040)`,
   behoben.
4. major · README: `docs/feedback/` stand zweimal im Index → Dublette entfernt, behoben.
5. major · Bericht: Indexprüfung ohne Befehl und Ausgabe; Quelle der Zeile „Weiterleiten“ widersprach der Zeile →
   behoben.
6. minor · „Verboten“-Einträge „Denial“ und „Control center“ ohne Quelle → „—“, behoben.
7. nit · AGENTS.md-Zeile ohne den letzten Schritt `mark-test-run` → ergänzt.
8. nit · „Files allowed“ der Spec vom Bauenden in Aufzählungsform gebracht (für das Scheibenumfang-Tor); Umfang
   unverändert → bleibt.

**Runde 2 · Nachprüfung Sonnet 5 · 23.09.2026 · Urteil: annehmen.** Punkte 1–7 erledigt, 8 bewusst unverändert;
`slice-scope` und `plan-honesty` grün; AGENTS.md weicht in genau einer Zeile ab.
