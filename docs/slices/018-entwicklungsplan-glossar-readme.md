# 018 — Entwicklungsplan, Glossar und README abgleichen

**Status:** spec
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

`docs/agentische-entwicklung-plan.md` (Abschnitte 3, 5 einschließlich 5.4, 7, 8, 9), `docs/glossar.md`, `README.md`,
`docs/slices/README.md`, `AGENTS.md` (eine Zeile), diese Datei (Bericht).

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

(vom Mechaniker)

## Review findings

(vom Reviewer)
