# hvworkflow

Arbeitsstand für ein Werkzeug, das die Fragen und Antworten einer Hauptversammlung
Ende-zu-Ende managt: Vorbereitung des Q&A-Katalogs, Erfassung über alle Eingangskanäle,
Clustering und Routing, Antworterstellung mit mehrstufiger Freigabe, Podiumsvorlage,
Protokollierung und Nachbereitung bis zur Anfechtungsverteidigung.

## Inhalt

| Dokument | Zweck |
|---|---|
| [`docs/anforderungen-recherche.md`](docs/anforderungen-recherche.md) | Anforderungsrecherche über 15 Bereiche — Recht, Kapitalmarkt, Datenschutz, KI, Featureset, Architektur, Sicherheit, Betrieb, UX, Produktstrategie, Organisation. Enthält zusätzlich die offenen Entscheidungen, die häufigsten Fallstricke, eine Zeitachse T-300 bis T+30 und die Verifikationsaufträge. |
| [`docs/ist-analyse-und-schnittstellen.md`](docs/ist-analyse-und-schnittstellen.md) | Wie der Q&A-Prozess heute läuft, wie das bestehende HV-Tool aufgebaut ist, welche Nachbarsysteme angebunden werden — und das daraus abgeleitete Delta samt Schnittstellenarchitektur. |
| [`docs/rollen-und-rechtekonzept.md`](docs/rollen-und-rechtekonzept.md) | Berechtigungsmodell: Rechte als Daten, ein Entscheidungspunkt, Policy-Tests als Wahrheitstabelle. Zugleich das zentrale Artefakt für Datenschutz- und Sicherheitsprüfung sowie Betriebsrat. |
| [`docs/adr/0001-schichtung-und-vertragskopplung.md`](docs/adr/0001-schichtung-und-vertragskopplung.md) | Architekturentscheidung zur Schichtung: keine vollständige Autarkie zwischen Oberfläche und Anwendung, sondern Kopplung an einen stabilen Vertrag. Drei harte Grenzen, verworfene Alternativen mit Begründung. |
| [`docs/erste-version-und-offene-fragen.md`](docs/erste-version-und-offene-fragen.md) | Schnitt der ersten lauffähigen Version: was sie beweisen muss, Abnahmesatz, drei nicht nachrüstbare Invarianten. Dazu die Fragen an die HV-Projektleitung und an die Umsetzung. |
| [`docs/agentische-entwicklung-plan.md`](docs/agentische-entwicklung-plan.md) | Wie das Werkzeug mit mehreren KI-Agenten unterschiedlicher Qualität und Kosten gebaut wird: Befunde der letzten Monate, zwölf Regeln, Rollen- und Modellbesetzung, Takt je Scheibe, Qualitätstore je Ebene, Kostenrahmen, ehrliche Bewertung der These „bauen statt kaufen", Zeitplan bis zur Demo. |
| [`docs/bauplan-demo.md`](docs/bauplan-demo.md) | Orchestrierung der Demo-Nacht: Besetzung je Aufgabe und Modell, Phasen, Tore, Token-Hygiene, Kostenrahmen, Entscheidungspunkte. |
| [`docs/design-prinzipien.md`](docs/design-prinzipien.md) | Was „beste Oberfläche" für dieses Werkzeug heißt: zehn Prinzipien, Muster, Checkliste der Design-Kritik. |
| [`docs/adr/0002-demo-betriebsart-in-process.md`](docs/adr/0002-demo-betriebsart-in-process.md) | Demo-Betriebsart: der Anwendungskern läuft im Browser hinter dem Vertrag; der HTTP-Dienst nutzt denselben Kern. |
| [`docs/glossar.md`](docs/glossar.md) | Hausvokabular ↔ Code, verbindlich für Oberfläche und Contract. |
| [`docs/slices/`](docs/slices/) | Eine Spezifikation je Scheibe mit Nachweisen, Review-Befunden und Nacharbeit — wie gebaut wurde. |
| [`docs/demo-skript.md`](docs/demo-skript.md) | Drehbuch der Vorführung, bekannte Punkte, Lesereihenfolge für Entwickler. |
| [`docs/messung.md`](docs/messung.md) | Verbrauch, Reviewrunden und Befunde je Scheibe — die Zahlen hinter der These. |
| [`docs/evidence/`](docs/evidence/) | Screenshots aus den automatisierten Durchläufen, zuletzt im Endzustand erzeugt. |

## Lauffähige Version

Die erste Version läuft als Demo auf **https://hvtool.netlify.app** (Demo-Betriebsart: synthetische
Daten, Anwendungskern im Browser, jedes Gerät hat seinen eigenen Stand). Sie deckt die Wirbelsäule
des Prozesses ab: Wortmeldeliste, Erfassung mit Atomisierung, Klassifizierung, Expert Track mit
Legal Clearing und versionsgebundener Freigabe, Bühne, Historie und Suche, Rechte je Status über
`_actions` für acht Rollen. Ablauf der Vorführung: `docs/demo-skript.md`.

```
pnpm install
pnpm gates                       # Vertrag, Typen, Lint, Tests, Vokabular, Build
pnpm --filter @hv/web dev        # Oberfläche auf http://localhost:5173
pnpm --filter @hv/web e2e        # Playwright: drei Scheiben-Szenarien und der Abnahmesatz
pnpm --filter @hv/api dev        # HTTP-Dienst mit demselben Kern auf :8787 (HV_DEMO=1)
```

Aufbau des Repositoriums und Arbeitsregeln für Menschen und Agenten: [`AGENTS.md`](AGENTS.md).

## Status

Erste lauffähige Version (Demo). Sämtliche Normverweise sind vor der Spezifikationsfreigabe durch
die Rechtsabteilung am geltenden Gesetzestext zu verifizieren — siehe Abschnitt 0 des
Recherchedokuments. Offen für den Piloten: HTTP-Dienst mit Datenbank statt In-Browser-Adapter,
Vorabfragen, Verweigerungspfad, Nachbarsysteme, Sicherheitsreview (`docs/erste-version-und-offene-fragen.md`).
