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
| [`docs/adr/0001-vorlage-annahme.md`](docs/adr/0001-vorlage-annahme.md) | Vorlage zur Annahme von ADR 0001 an Prüfpunkt 1: was angenommen wird, was nicht, Nachweise je Grenze, Beschlussfeld. |
| [`docs/adr/0002-demo-betriebsart-in-process.md`](docs/adr/0002-demo-betriebsart-in-process.md) | Demo-Betriebsart: der Anwendungskern läuft im Browser hinter dem Vertrag; der HTTP-Dienst nutzt denselben Kern. |
| [`docs/adr/0003-persistenz-ereignislog.md`](docs/adr/0003-persistenz-ereignislog.md) | Architekturentscheidung (ADR), vorgeschlagen: Persistenz des Ereignislogs — Postgres, nur anhängend. Annahme Prüfpunkt 3. |
| [`docs/adr/0004-identitaet-oidc-bff.md`](docs/adr/0004-identitaet-oidc-bff.md) | Architekturentscheidung (ADR), vorgeschlagen: Identität — OIDC über einen BFF im Dienst. Annahme Prüfpunkt 3. |
| [`docs/adr/0005-antwortformat.md`](docs/adr/0005-antwortformat.md) | Architekturentscheidung (ADR), vorgeschlagen: Antwortformat — Blockdokument mit Whitelist. Annahme Prüfpunkt 5. |
| [`docs/adr/0006-buehne-je-geraet-und-antwortbuendel.md`](docs/adr/0006-buehne-je-geraet-und-antwortbuendel.md) | Architekturentscheidung (ADR), vorgeschlagen: Bühne je Person und Gerät, Antwortbündel. Annahme Prüfpunkt 5. |
| [`docs/adr/0007-deployment-hosting-umgebungen.md`](docs/adr/0007-deployment-hosting-umgebungen.md) | Architekturentscheidung (ADR), vorgeschlagen: Deployment, Hosting und Umgebungen. Annahme Prüfpunkt 3. |
| [`docs/adr/0008-integrationen.md`](docs/adr/0008-integrationen.md) | Architekturentscheidung (ADR), vorgeschlagen: Integrationen — ein kanonischer Vertrag je Nachbarsystem. Annahme Prüfpunkt 5. |
| [`docs/adr/0009-aufbewahrung-vertraulichkeit-personentabelle.md`](docs/adr/0009-aufbewahrung-vertraulichkeit-personentabelle.md) | Architekturentscheidung (ADR), vorgeschlagen: Aufbewahrung, Vertraulichkeit, Krypto-Umschlag und Personentabelle. Annahme Prüfpunkt 4, ergänzt nach 073. |
| [`docs/adr/0010-pilotmodus-uebungsbetrieb.md`](docs/adr/0010-pilotmodus-uebungsbetrieb.md) | Architekturentscheidung (ADR), vorgeschlagen: Pilotmodus und Übungsbetrieb. Annahme Prüfpunkt 3. |
| [`docs/adr/0011-ereignis-umschlag-v2.md`](docs/adr/0011-ereignis-umschlag-v2.md) | Architekturentscheidung (ADR), vorgeschlagen: Ereignis-Umschlag v2. Annahme Prüfpunkt 3. |
| [`docs/adr/0012-zustandsmodell-und-verweigerung.md`](docs/adr/0012-zustandsmodell-und-verweigerung.md) | Architekturentscheidung (ADR), vorgeschlagen: Zustandsmodell und Verweigerung. Annahme Prüfpunkt 4, Umsetzer und Recht. |
| [`docs/adr/0013-zwei-protokollebenen.md`](docs/adr/0013-zwei-protokollebenen.md) | Architekturentscheidung (ADR), vorgeschlagen: Zwei Protokollebenen. Annahme Prüfpunkt 4. |
| [`docs/adr/0014-realtime-sse.md`](docs/adr/0014-realtime-sse.md) | Architekturentscheidung (ADR), vorgeschlagen: Realtime über Server-Sent Events. Annahme Prüfpunkt 3. |
| [`docs/adr/0015-vertragsversionierung.md`](docs/adr/0015-vertragsversionierung.md) | Architekturentscheidung (ADR), vorgeschlagen: Vertragsversionierung. Annahme Prüfpunkt 1. |
| [`docs/adr/0016-agenten-arbeitsmodell.md`](docs/adr/0016-agenten-arbeitsmodell.md) | Architekturentscheidung (ADR), vorgeschlagen: Agenten-Arbeitsmodell. Annahme Prüfpunkt 1. |
| [`docs/entscheidungsregister.md`](docs/entscheidungsregister.md) | Entscheidungsregister E1–E49 mit Eigentümer, Fälligkeit, Rückfalltrigger, Kosten bei Änderung und Vermerk „auf Standard gebaut" (Scheibe 014). |
| [`docs/glossar.md`](docs/glossar.md) | Hausvokabular ↔ Code, verbindlich für Oberfläche und Contract. |
| [`docs/slices/`](docs/slices/) | Eine Spezifikation je Scheibe mit Nachweisen, Review-Befunden und Nacharbeit — wie gebaut wurde. |
| [`docs/demo-skript.md`](docs/demo-skript.md) | Drehbuch der Vorführung, bekannte Punkte, Lesereihenfolge für Entwickler. |
| [`docs/messung.md`](docs/messung.md) | Verbrauch, Reviewrunden und Befunde je Scheibe — die Zahlen hinter der These. |
| [`docs/evidence/`](docs/evidence/) | Screenshots aus den automatisierten Durchläufen, zuletzt im Endzustand erzeugt. |
| [`docs/feedback/2026-09-quickview-projektleitung.md`](docs/feedback/2026-09-quickview-projektleitung.md) | Feedback-Auswertung der Quickview der HV-Projektleitung: je Aussage berücksichtigt, geplant, neu oder unklar, als Grundlage für die Vervollständigung. |
| [`docs/feedback/2026-10-fragenpaket-woche-1.md`](docs/feedback/2026-10-fragenpaket-woche-1.md) | Fragenpaket Woche 1: Fragen an die HV-Projektleitung, jede mit Bezug zu ihrer Zeile im Entscheidungsregister. |
| [`docs/feedback/2026-10-fragenpaket-wortmeldeliste.png`](docs/feedback/2026-10-fragenpaket-wortmeldeliste.png) | Nummerierter Screenshot der Wortmeldeliste der Demo (Anhang zum Fragenpaket Woche 1); die Legende der Bedienelemente steht im Anhang von `docs/feedback/2026-10-fragenpaket-woche-1.md`. |
| [`docs/produktplan-beta.md`](docs/produktplan-beta.md) | Plan für die KI-Agenten vom MVP zur soliden Beta: Beta-Kriterien B1–B18, Standardannahmen mit Änderungskosten, 80 Scheiben in sieben Meilensteinen, Kalender in Agentenzeit aus dem Abhängigkeitsgraphen, Prüfpunkte, Token, Risiken, Entscheidungsregister. |
| [`docs/qualitaetsleitplanken-produktreife.md`](docs/qualitaetsleitplanken-produktreife.md) | Qualitätsleitplanken für Spec-Autoren und Reviewer: Risikoklassen, Perspektiven auf heutige Rollen, Qualitätschecks, Nachweise, durchgerechnetes Beispiel. Keine zweite Arbeitsordnung. |
| [`docs/abdeckungsmatrix.md`](docs/abdeckungsmatrix.md) | Anforderungs-Traceability: welche Anforderung aus docs/anforderungen-recherche.md durch welche Scheibe gebaut wird. |
| [`docs/changelog-projektleitung.md`](docs/changelog-projektleitung.md) | Zusammenfassung von Änderungen für die Projektleitung: was sich am Beta-Plan seit der letzten Rückmeldung geändert hat, neue Termine, neue Erkenntnisse. |
| [`docs/betrieb/branch-schutz.md`](docs/betrieb/branch-schutz.md) | Checkliste für den Eigentümer: Branch-Schutz setzen, ein privilegierter Schritt, den kein Agent ausführen darf. |
| [`docs/datenschutz/dsfa-vorentwurf.md`](docs/datenschutz/dsfa-vorentwurf.md) | DSFA-Vorentwurf für das HV-Tool (Beta), Status ungeprüft, Adressat die oder der Datenschutzbeauftragte. |
| [`docs/sicherheit/bedrohungsmodell.md`](docs/sicherheit/bedrohungsmodell.md) | Bedrohungsmodell v1 für das HV-Tool (Beta), Prüfhilfe mit Perspektive Security für Reviewer, Sicherheitsreview des Architekten und Pentest. |
| [`docs/sicherheit/pentest-scope.md`](docs/sicherheit/pentest-scope.md) | Pentest-Scope für das HV-Tool (Beta): Grundlage der Bestellung, noch keine Bestellung und keine Anfrage an Dritte. |
| [`docs/sicherheit/reviewer-checkliste-sicherheit.md`](docs/sicherheit/reviewer-checkliste-sicherheit.md) | Reviewer-Checkliste Sicherheit: Prüfhilfe für Reviews mit Perspektive Security. |

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
