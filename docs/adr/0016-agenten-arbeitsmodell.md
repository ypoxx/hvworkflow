# ADR 0016 — Agenten-Arbeitsmodell

**Status:** vorgeschlagen · **Datum:** 23.09.2026 · **Entscheider:** Umsetzer; Eigentümer für Merge-Befugnis, Kleinänderungsregel und Nutzungsdeckel (E48, E44, E47) · **Annahme:** Prüfpunkt 1 (Plan 4)

## Kontext

Rund 80 Scheiben werden von mehreren Agenten in parallelen Worktrees gebaut; AGENTS.md (Regeln
1–12) und `docs/agentische-entwicklung-plan.md` setzen den Rahmen: kein Bau ohne Spec, Nachweise
statt Behauptungen, wer baut, reviewt nicht, kleine Diffs. Die Demo-Phase hat gezeigt, wo Parallelität
kollidiert (geteilte i18n-Datei, geteilte e2e-Dateien, README) und dass ein von Hand geschätzter
Kalender nicht hält. Der Kalender des Plans ist deshalb aus dem Abhängigkeitsgraphen gerechnet, nicht
geschätzt (Plan 8).

## Entscheidung

Standardannahme aus Plan 4 (Zeile 0016) und Plan 10 (E44, E47, E48):

- **Lanes mit exklusivem Dateibesitz.** Jede Scheibe nennt ihre Lanes; gleichzeitig laufende
  Scheiben teilen keine Lane. Geteilte Dateien (README, Glossar) gehören für eine Scheibe genau einer
  Lane.
- **Berechneter Kalender statt Handplanung:** `scripts/plan-graph.mjs` prüft den Scheibengraphen
  (jede Abhängigkeit existiert, keine Zyklen, jede Abhängigkeit endet vor dem Start, keine
  Lane-Kollision) und rechnet den Kalender neu.
- **Scheibenumfang-Tor:** ein PR mit Dateien außerhalb „Files allowed" der Spec ist rot
  (`scripts/slice-scope.mjs`). **Plan-Graph-Prüfung** läuft als Tor.
- **i18n je Feature-Modul** (017), **Feature-Register für Routen**, **e2e-Dateien je Scheibe** plus
  geteilte Altdateien.
- **Review-Paarung nach Regel 3:** ein anderes Modell in frischem Kontext, das nur Spec und Diff
  sieht; Rollen liegen in `.claude/agents/` (Architekt, Planer, Design-Kritiker, Reviewer,
  Reviewer für Opus-gebaute Scheiben).
- **Merge durch den Orchestrator** nach grünen Toren und unabhängigem Review (E48); der Mensch sieht
  jeden Merge im Tagesbericht und kann ihn zurücknehmen; Deploy nur nach Go des Eigentümers
  (Regel 11).
- **Herabstufung der Risikoklasse nur mit menschlicher Unterschrift** (Leitplanken Abschnitt 4).
- **Token-Regelkreis:** der Tagesdurchsatz wird in Woche 1 gemessen; liegt er nach fünf Bautagen
  unter einer Scheibe je Bautag, rechnet 016 den Kalender neu, und Prüfpunkt 1 entscheidet über
  zusätzliche Bautage oder einen API-Schlüssel mit Budgetgrenze (E47).
- **Hooks** setzen die Regeln durch: Stop ohne Testlauf, der jünger ist als die letzte Änderung →
  Exit 2; Berichtsformat beim Subagenten-Ende; Lint auf jede geschriebene Datei; Sperre für
  `git push` ohne Ziel, `.env`-Zugriff und ausgehende Netzaufrufe. Branch-Schutz erzwingt die Tore
  (B13).
- **Kleinänderungen:** jede mit Mini-Spec und eigenem Merge; Regeln 1 und 12 bleiben unverändert
  (E44).

## Konsequenzen

**Positiv.** Parallele Scheiben kollidieren nicht mehr an geteilten Dateien; der Kalender ist
ehrlich und nachrechenbar; jedes Tor, das der Plan nennt, läuft auch (B13). Der Mensch behält
Rücknahme, Deploy und Herabstufung.

**Negativ.** Lane-Disziplin kostet Planungsaufwand je Spec; Skripte, Hooks und Agentenrollen sind
Werkzeug, das gepflegt werden muss. Ein Orchestrator, der mergt, verschiebt die Kontrolle auf den
Tagesbericht — das setzt voraus, dass der Bericht gelesen wird.

**Risiko.** Ein Tor, das im Plan steht, aber nicht in `.github/workflows/gates.yml` läuft, wäre eine
Behauptung; B13 verlangt deshalb ein Plan-Ehrlichkeits-Tor.

## Kosten bei Änderung

- Der Plan beziffert Änderungen am Arbeitsmodell nicht in AStd. Sie sind Änderungen an AGENTS.md,
  `.claude/agents/`, den Hooks und den Toren; eine Sammelregel für Kleinänderungen wäre eine
  Änderung von AGENTS.md (E44).
- Kalenderänderungen: Neuberechnung mit `plan-graph.mjs` (Plan 3 „HV-Datum", E20; Durchsatz E47).

## Verworfene Alternativen

- **Von Hand geschätzter Kalender.** Verworfen: der Kalender ergibt sich aus Graph, Lanes und
  äußeren Terminen (Plan 8).
- **Der Mensch mergt jede Scheibe selbst.** Nicht gewählt: E48 — Orchestrator mergt nach Toren und
  Review, Rücknahme bleibt; Deploy bleibt beim Menschen.
- **Der Bauende reviewt selbst oder dasselbe Modell reviewt.** Verworfen: Regel 3.
- **Sammelregel oder Sammel-Merge für Kleinänderungen.** Nicht gewählt; Option E44.
- **Ein geteiltes i18n-Wörterbuch, geteilte e2e-Dateien.** Verworfen: Lane-Konflikte (017).
- **Herabstufung der Risikoklasse durch einen Agenten.** Verworfen: nur mit menschlicher
  Unterschrift (Leitplanken Abschnitt 4).

## Nachweis

Scheibe **016** (Plan 4): `settings.json`-Diff; Protokoll eines blockierten Stop-Versuchs;
Scheibenumfang-Tor rot bei absichtlich fremder Datei; `plan-graph.mjs` rot bei absichtlich
vertauschter Abhängigkeit; Screenshot des Branch-Schutzes (Eigentümer). i18n je Feature-Modul aus
017 (gemergt). Takt-Tabelle in `docs/messung.md` (B16).

## Offene Registerzeilen

- **E48** Merge-Befugnis beim Orchestrator (Prüfpunkt 0).
- **E44** Leichtere Regel für Kleinänderungen.
- **E47** Geld- und Nutzungsdeckel; Überprüfung an Prüfpunkt 1.
