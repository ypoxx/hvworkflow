# Bauplan Demo — Orchestrierung der Agenten für die erste sichtbare Version

**Stand:** 2. September 2026, 22:30. **Ziel:** eine Version auf hvtool.netlify.app, die den Workflow
Ende zu Ende zeigt, in bester Oberflächenqualität, ohne die nächsten Schritte zu verbauen.
**Gilt zusammen mit:** `docs/agentische-entwicklung-plan.md` (Regeln R1–R12, Tore),
`docs/design-prinzipien.md` (was „beste Oberfläche" hier heißt), `docs/slices/` (die Specs).

## 1. Ausgangslage

| Teil | Zustand |
|---|---|
| Vertrag (OpenAPI 3.1), Anwendungskern, Rechtetabelle, Statusmaschine, 800-Fragen-Korpus, 35 Tests | fertig, Tore grün, gepusht |
| Web-Gerüst mit In-Browser-Adapter hinter dem Vertrag (ADR 0002), Playwright, CI-Tore, Vokabular-Tor | fertig, gepusht |
| AGENTS.md, Glossar, Slice-Specs 001–004, Agentenrollen, Hook-Policy | fertig, gepusht |
| Netlify hvtool | an den Branch gekoppelt: **jeder Push baut und veröffentlicht**. Deshalb: Push nur an Meilensteinen nach Review. |
| Scheibe 001 Shell/Designsystem (Opus 5) und 004 API-Dienst (Sonnet 5) | **laufen** (vor der Anweisung „erst planen" gestartet). Ergebnis wird geprüft, aber ohne Freigabe weder gepusht noch fortgesetzt. |

## 2. Besetzung für diese Nacht — und warum

| Aufgabe | Modell | Begründung |
|---|---|---|
| Architektur, Vertrag, Kern, Design-Kritik, Endabnahme, Push | **Fable 5.1** (diese Sitzung) | Die Stellen, an denen ein Fehler später nicht korrigierbar ist, und das Urteil über die Oberfläche. Wird nicht für Codezeilen in den Scheiben eingesetzt. |
| Oberflächen-Scheiben 001, 002, 003 | **Opus 5** | Abweichung vom Standardplan (dort Sonnet). „Beste UI/UX" ist das Entscheidungskriterium der Demo; Opus hat das bessere Urteil für Hierarchie, Dichte, Typografie und Zustände. Mehrkosten: Faktor 2,5 auf drei Scheiben, etwa 20–40 $ gesamt. |
| Backend-Scheibe 004, Abnahmesatz als E2E-Test | **Sonnet 5** | Klar spezifiziert, durch Vertrag und Tests deterministisch prüfbar. |
| i18n-Vervollständigung, Lint-Reste, Messtabelle, Doku-Abgleich | **Haiku 4.5** | Mechanik ohne Ermessen. |
| Review Oberflächen-Scheiben (Spec-Treue, Rechte, i18n, Vokabular, Tore) | **Sonnet 5** | Muss ein anderes Modell als der Ersteller sein (R3). Mechanische Prüfung, günstig. |
| Review Backend-Scheibe | **Opus 5** | Anderes Modell als Sonnet; Vertragstests und Fehlerpfade brauchen Sorgfalt. |
| Design-Kritik jeder Oberflächen-Scheibe | **Fable 5.1** | Zwei Screenshots je Scheibe gegen die Checkliste in `design-prinzipien.md`; eine Nacharbeitsrunde. Bildlesen kostet Tokens, deshalb begrenzt auf 2 Bilder je Scheibe. |

Subagenten statt Agententeams (Teams kosten das 2- bis 7-fache). Höchstens zwei Implementierer
gleichzeitig, immer auf getrennten Verzeichnissen, mit eigenen E2E-Ports (`E2E_PORT`).

## 3. Phasenplan

| Phase | Inhalt | Modell | Voraussetzung | Dauer | Tor |
|---|---|---|---|---|---|
| P0 | Fundament | Fable | — | erledigt | `pnpm gates` grün |
| P1 | 001 Shell ∥ 004 API | Opus ∥ Sonnet | P0 | läuft, ~25 min | gates + e2e-Screenshot |
| P1R | Review 001 (Sonnet) + Design-Kritik (Fable); Review 004 (Opus); Nacharbeit durch die Ersteller | s. o. | P1 | ~25 min | Befunde behoben, gates grün |
| **Go 1** | Freigabe des Umsetzers, Meilenstein-Push (Shell sichtbar auf Netlify) | — | P1R | — | — |
| P2 | 002 Wortmeldeliste + Erfassung ∥ 003 Beantwortung + Bühne + Historie | Opus ∥ Opus | Go 1 | ~45 min | gates + Screenshots |
| P2R | Review 002, 003 (Sonnet) + Design-Kritik (Fable); Nacharbeit | s. o. | P2 | ~30 min | Befunde behoben |
| P3 | Abnahmesatz als Playwright-Szenario bei 800 Fragen; Screenshots als Beweis | Sonnet | P2R | ~20 min | e2e grün |
| P3b | i18n-Vollständigkeit, Lint-Reste, Messtabelle | Haiku | P3 | ~10 min | gates grün |
| P4 | Endabnahme: Diffs an den harten Grenzen lesen (Adapter, `_actions`, Vertrag), gates, Commit, Push, Netlify-Deploy prüfen, Demo-Skript final | Fable | P3b | ~20 min | Seite läuft |

Gesamt ab Go 1 etwa **2,5 Stunden**. Bei Go um 23:00 steht die Version gegen 01:30.

**Was bei Verzug fällt (in dieser Reihenfolge):** Suche, Ereignisstrom-Ansicht, Zusammenführen-Dialog,
Redezeitanzeige, vierte Rolle. **Nie fällt:** Atomisierung mit Restabdeckung, Freigabe an die
Textversion gebunden, Bühne mit „vorgelesen, weiter", 800-Fragen-Korpus, Rechte nur über `_actions`.

## 4. Wie „beste Oberfläche" abgesichert wird

1. `docs/design-prinzipien.md` ist Pflichtlektüre jedes Oberflächen-Agenten und Maßstab der Kritik.
2. Das Designsystem entsteht einmal (001) und wird von 002/003 nur benutzt, nicht neu erfunden.
3. Jede Oberflächen-Scheibe durchläuft zwei Prüfungen: Spec-Review (Sonnet) und Design-Kritik
   (Fable) mit einer Nacharbeitsrunde. Eine zweite Runde bedeutet: Spec oder Prinzipien sind unklar.
4. Der Dreißig-Sekunden-Test: Kopf, Wortmeldeliste und Bühne müssen ohne Erklärung verständlich sein.
   Die Vokabelprüfung läuft automatisch.
5. Screenshots aus dem Abnahmesatz liegen in `docs/evidence/` und werden dem Umsetzer geschickt.

## 5. Token-Hygiene — was in dieser Sitzung bewusst nicht benutzt wird

Der Umsetzer arbeitet über ein Abonnement mit Nutzungsfenster; jedes geladene Werkzeugschema, jeder
Skill und jeder Subagent zählt mit. Geprüft und ausgeschlossen:

| Nicht benutzt | Grund |
|---|---|
| GitHub-MCP-Werkzeuge (PRs, Issues, Reviews) | Kein Pull Request möglich (Branch ist Standard-Branch); Git läuft über die Shell. Schema-Laden wäre reiner Ballast. |
| Netlify-„Coding Context", Netlify-Deploy-Werkzeug | Deployment läuft über Git-Push; nur der kleine Projekt-Lesezugriff wurde benutzt. |
| Skills `design`, `web-artifacts-builder`, `artifact-design`, `theme-factory`, `brand-guidelines`, `canvas-design`, `algorithmic-art`, `dataviz` | Für eine echte React-Anwendung nicht nötig; sie laden umfangreiche Anleitungen. Das Design wird direkt im Code umgesetzt. |
| Skills `docx`, `pptx`, `xlsx`, `pdf`, `internal-comms`, `doc-coauthoring` | Keine Dokumente dieser Art gefordert. |
| Skill `code-review` / `security-review` / `simplify` | Spawnen mehrere Agenten mit breitem Kontext. Ersetzt durch einen schmalen Reviewer je Scheibe. `security-review` ist für den Piloten vorgesehen, nicht für heute Nacht. |
| Workflow-Werkzeug („ultracode") | Fächert auf viele Agenten auf; für diese Größe teurer als nötig. |
| Artifact-Veröffentlichung | Die Demo lebt auf Netlify; ein zweiter Host bringt nichts. |
| Bildlesen von Screenshots | Nur für die Design-Kritik, 2 Bilder je Oberflächen-Scheibe, sonst Textausgaben der Tests. |
| Lesen der Transkripte der Subagenten | Nie; nur der Abschlussbericht im festen Format. |

Zusätzlich: Subagenten lesen AGENTS.md, ihre Spec, das Glossar und die Domänentypen — nicht die
gesamten Recherchedokumente. Prompts nennen absolute Pfade und verbieten `pnpm install`, wenn keine
neue Abhängigkeit nötig ist.

## 6. Kostenrahmen dieser Nacht

| Posten | Schätzung (Listenpreis) |
|---|---|
| P1 (läuft): Opus Shell + Sonnet API | 12–25 $ |
| P1R Reviews + Nacharbeit | 8–15 $ |
| P2: zwei Opus-Scheiben | 25–45 $ |
| P2R Reviews + Design-Kritik + Nacharbeit | 12–20 $ |
| P3/P3b: E2E (Sonnet), Mechanik (Haiku) | 5–10 $ |
| P4 Endabnahme (Fable, diese Sitzung) | 5–10 $ |
| **Summe** | **≈ 70–125 $**, im Abonnement: das Nutzungsfenster ist die Grenze, nicht der Betrag |

## 7. Entscheidungspunkte

- **Jetzt:** Go für P1R und alles Folgende. Ohne Go: Ergebnisse von 001/004 werden geprüft und
  dokumentiert, nichts wird gepusht, keine weitere Scheibe gestartet.
- **Go 1 (nach P1R):** Der Umsetzer bekommt den Shell-Screenshot. Antwortet er nicht innerhalb von
  15 Minuten, geht es nach dem Urteil der Design-Kritik weiter — die Nacht ist kurz. Wer das nicht
  will, sagt es beim ersten Go.
- **Abschluss (P4):** Nachricht mit Adresse, Screenshots, Messtabelle, bekannten Punkten.
