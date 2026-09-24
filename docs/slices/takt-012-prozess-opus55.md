# takt-012 — Prozess an Opus 5.5 anpassen: Modellbesetzung, Review-Regel, Codex-Stoppregel, Nachweisform

**Status:** review
**Klasse:** S (Kleinänderungsspur, Produktplan 5.9) · Risikoklasse niedrig · Lanes: docs-plan, infra (nur
`.claude/agents/`)
**Rolle:** Orchestrator schreibt (Entscheid des Eigentümers vom 24.09.2026); Review in frischem Kontext (Opus 5.5)
**Rule ids:** AGENTS.md Regeln 1, 2, 3, 12; Entwicklungsplan R3, R6
**Quellen-IDs:** Assessment des Orchestrators vom 24.09.2026 (Chat); Entscheid des Eigentümers: kein Fable mehr, Opus
5.5 ist leistungsfähig genug; Befunde des Bautags B1 (Nacharbeitsrunden bei Sonnet-Bauten, unzuverlässige
Haiku-Nachweise, Codex-Schleifen ohne Ende bei 023 und takt-006, eingefügte gates-Ausgaben veralten sofort)

## Ziel

1. **Modellbesetzung:** Opus 5.5 besetzt Architekt, Planer, Implementierer (Backend und Oberfläche), Reviewer und
   Design-Kritik. Sonnet 5 übernimmt den Mechaniker (reine Mechanik ohne Entwurfsentscheidung); Haiku und Fable werden
   nicht mehr besetzt. Die Modellwahl steht nur in `.claude/agents/*.md`; Specs nennen die Rolle, nicht das Modell.
2. **Review-Regel (R3, AGENTS.md Regel 3):** Unabhängigkeit entsteht durch frischen Kontext, der nur Spec und Diff
   sieht, nicht durch ein anderes Modell. Wer baut, prüft nicht — auch nicht in derselben Sitzung.
3. **Codex-Stoppregel:** Codex prüft nach dem Review und nach der Nacharbeit. Einen Merge halten nur P1-Befunde mit
   nachvollziehbarer Probe und jeder Befund zu Sicherheit, Recht oder Datenschutz auf. Andere P2 werden Folgepunkte in
   der Spec. Nach zwei Codex-Läufen ohne neuen P1 entscheidet der Orchestrator über den Merge; Offene Befunde zu Sicherheit, Recht oder Datenschutz halten den Merge auch nach zwei Läufen auf; sie schließt nur eine Behebung oder eine benannte Fachperson, nicht der Orchestrator.
4. **Nachweisform (AGENTS.md Regel 2):** Der Bericht nennt den Commit, auf dem `pnpm gates` lief, und fügt den Schluss
   der Ausgabe einmal wörtlich ein. Reine Doku-Commits danach brauchen keinen neuen Lauf; die CI am PR ist der
   laufende Nachweis; gemergt wird nur mit grüner CI auf dem letzten Commit des PR.
5. **Kostentabelle** im Entwicklungsplan auf den Stand vom 24.09.2026 (Opus 5.5: 4 $ / 20 $ je Million Token).

## Nicht-Ziele

Keine Änderung an Toren, Skripten, Specs anderer Scheiben oder am Produktplan. Die Modellzeilen in bereits
geschriebenen Specs bleiben als Geschichte stehen; für laufende Arbeit gilt die Rollendatei.

## Files allowed

- `AGENTS.md`
- `docs/agentische-entwicklung-plan.md`
- `.claude/agents/architekt.md`
- `.claude/agents/design-kritiker.md`
- `.claude/agents/implementierer-backend.md`
- `.claude/agents/implementierer-oberflaeche.md`
- `.claude/agents/mechaniker.md`
- `.claude/agents/planer.md`
- `.claude/agents/reviewer.md`
- `.claude/agents/reviewer-sonnet.md`
- `docs/slices/takt-012-prozess-opus55.md`

## Akzeptanzkriterium

1. Kein `model: fable` und kein `model: haiku` mehr unter `.claude/agents/`.
2. AGENTS.md Regel 2 und 3, Plan R3, R6, Abschnitt 1.7, 3 und 4 sagen dasselbe.
3. `pnpm gates` grün (Schluss wörtlich im Bericht).

## Bericht

(vom Orchestrator)

## Review findings

**Runde 1 — Opus 5.5, frischer Kontext, auf `787990d`:** nacharbeiten, kein Blocker. Eigener `pnpm gates`-Lauf grün,
Umfang 9 Dateien in der Liste, Modellangaben gültig (`opus`, `sonnet`).

| # | Stufe | Befund | Erledigt |
|---|---|---|---|
| 1 | major | Plan, Kurzfassung Satz 4 („teuer plant, günstig implementiert“) widerspricht R6 | an R6 angeglichen |
| 2 | major | Plan, Kurzfassung Satz 9 („zweites, unabhängiges Modell“) widerspricht R3 | „unabhängiger Prüfer in frischem Kontext“ |
| 3 | major | Codex-Stoppregel: Orchestrator könnte nach zwei Läufen offene Befunde zu Sicherheit, Recht, Datenschutz überstimmen | Vorbehalt in Plan Abschnitt 4 und Ziel 3 |
| 4 | major | Nachweisform: Doku-Commits können Tore rot machen; grüne CI als Merge-Bedingung fehlt | AGENTS.md Regel 2, Plan Abschnitt 4, Ziel 4 |
| 5 | minor | Rollendateien nennen den gates-Commit nicht | Implementierer beide, Mechaniker |
| 6 | minor | Kostenklasse Implementierer „niedrig“ bei Opus | „mittel, Hauptvolumen“ |
| 7 | minor | Quellentabelle: Preisstand Juni 2026 | 24.09.2026 |
| 8 | minor | Anbieterangabe zu Opus 5.5 ohne Quellenzeile | Quellenzeile, Status „nicht nachgemessen“, Prüfung über `docs/messung.md` |
| 9 | minor | Befundtabelle 1.7: „14-fach günstiger“ unkommentiert | Vermerk „am Bautag B1 nicht bestätigt“ |
| 10 | minor | Takt-Tabelle ohne Codex-Schritt; Zählung der Nacharbeit unklar | Schritt 5a; Satz zur Zählung |
| 11 | minor | Bericht leer, Status „spec“ | Bericht unten, Status fortgeschrieben |
| 12 | nit | „im Opus-Review“ mehrdeutig | „im Review“ |

**Folgepunkte (Dateien außerhalb dieser Scheibe):** A `docs/qualitaetsleitplanken-produktreife.md` (Zeile 143
„anderes Modell“, Risikoklassen-Spalte, „Design-Kritik (Fable)“) — eigene Folge-Scheibe, inhaltlich am dringendsten;
B `docs/produktplan-beta.md` Zeile 7 (Besetzung im Präsens), 343, 440 („Review Fable“ für den Sicherheits-Lesebefund);
C `docs/bauplan-demo.md` Vermerk „ersetzt durch takt-012“; D `docs/messung.md` Modellzuordnung künftiger Zeilen.
